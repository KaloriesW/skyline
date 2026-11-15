"""Date-matched official-inventory dataset; never writes human-review labels."""
from pathlib import Path
import collections, datetime as dt, json, math, shutil, sys, zipfile
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT/'work/inventory-review-deps'))
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform, transform_bounds, transform_geom
from rasterio.features import rasterize
from rasterio.enums import Resampling
from PIL import Image
from scipy.ndimage import binary_dilation, binary_erosion, distance_transform_edt
from shapely.geometry import shape, mapping, box
from shapely import make_valid

sys.path.insert(0,str(ROOT/'outputs/taiwan-unet-validation'))
import shapefile
from core import BANDS, ASSETS, CONTRACT, sha, write
from prepare import get, CATALOG, asset, terrain, tiff, preview
from evidence import read_aligned, reflectance, clear_land

ARCHIVE=ROOT/'outputs/taiwan-unet-validation/published_sources/taiwan_inventory_2023.zip'
ARCHIVE_SHA='eafec379cb631443e691c3304900ce419bc683d16be09cab70d93c596eb5f3d9'
STEM='2023_SWCB_LS_Smooth6m'
SIDE=3840
DATE_TOLERANCE=3
REFERENCE='Official Taiwan 2023 satellite-interpreted inventory; unreviewed transfer to Sentinel-2, not field-confirmed labels'

def status(**kw):
 write(HERE/'status.json',{'updated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'app_integration':False,**kw})

def inventory():
 dest=HERE/'source';dest.mkdir(parents=True,exist_ok=True)
 if sha(ARCHIVE)!=ARCHIVE_SHA:raise ValueError('Inventory checksum mismatch')
 with zipfile.ZipFile(ARCHIVE) as z:
  for ext in ['shp','shx','dbf','prj','cpg']:
   name=f'{STEM}.{ext}';target=dest/name
   if not target.exists() or target.stat().st_size!=z.getinfo(name).file_size:
    tmp=target.with_suffix('.part')
    with z.open(name) as src,tmp.open('wb') as out:shutil.copyfileobj(src,out)
    tmp.replace(target)
 return shapefile.Reader(str(dest/STEM),encoding='utf-8')

def date(s):return dt.datetime.strptime(s,'%Y%m%d').date()

def make_plan(reader):
 """Select regions using inventory geometry/dates only, before fetching imagery."""
 records=[r.as_dict() for r in reader.iterRecords()]
 xs,ys=transform('EPSG:3826','EPSG:32651',[r['X'] for r in records],[r['Y'] for r in records])
 groups=collections.defaultdict(list)
 for i,(x,y) in enumerate(zip(xs,ys)):groups[(math.floor(x/SIDE),math.floor(y/SIDE))].append(i)
 candidates=[]
 for (cx,cy),ids in groups.items():
  common,n=collections.Counter(records[i]['DATE'] for i in ids).most_common(1)[0]
  if n<8 or n/len(ids)<.85:continue
  candidates.append({'x':cx*SIDE,'y':cy*SIDE,'inventory_date':common,'polygon_count':n,'date_purity':n/len(ids)})
 # Dense mapped areas first; spatial thinning prevents neighboring sample blocks.
 candidates.sort(key=lambda r:(-r['polygon_count'],r['x'],r['y']))
 chosen=[]
 for row in candidates:
  if all(math.hypot(row['x']-r['x'],row['y']-r['y'])>=16000 for r in chosen):chosen.append(row)
  if len(chosen)==18:break
 if len(chosen)<12:raise ValueError('Too few geographically separated date-consistent regions')
 order=np.random.default_rng(2023).permutation(len(chosen))
 n_holdout=3
 assignment={int(i):('test' if j<n_holdout else 'val' if j<2*n_holdout else 'train') for j,i in enumerate(order)}
 for i,row in enumerate(chosen):
  row.update(id=f'block_{i:02d}',split=assignment[i])
  lon,lat=transform('EPSG:32651','EPSG:4326',[row['x']+SIDE/2],[row['y']+SIDE/2])
  row['center']=[lat[0],lon[0]]
 plan={'seed':2023,'regions':chosen,'source_sha256':ARCHIVE_SHA,'maximum_date_offset_days':DATE_TOLERANCE,
  'region_side_m':SIDE,'minimum_center_distance_m':16000,'selection':'Inventory density/date consistency; fixed before imagery inspection; exploratory positive-enriched dataset.'}
 return plan

def verify_plan(plan):
 rows=plan['regions']
 if len({r['id'] for r in rows})!=len(rows):raise ValueError('Duplicate region')
 for i,a in enumerate(rows):
  if a['split'] not in ['train','val','test']:raise ValueError('Invalid split')
  for b in rows[i+1:]:
   if math.hypot(a['x']-b['x'],a['y']-b['y'])<16000:raise ValueError('Regions not sufficiently separated')

def region_geometries(reader,region):
 extent=box(region['x'],region['y'],region['x']+SIDE,region['y']+SIDE)
 bbox=transform_bounds('EPSG:32651','EPSG:3826',*extent.bounds)
 matched=[];other=[];ids=[];repaired=0
 for sr in reader.iterShapeRecords(bbox=bbox):
  g=shape(transform_geom('EPSG:3826','EPSG:32651',sr.shape.__geo_interface__))
  if not g.is_valid:g=make_valid(g);repaired+=1
  if g.is_empty or not g.intersects(extent):continue
  g=g.intersection(extent)
  # GeometryCollection may contain lines; rasterize only polygon parts.
  parts=list(g.geoms) if g.geom_type=='GeometryCollection' else [g]
  polygons=[mapping(p) for p in parts if p.geom_type in ['Polygon','MultiPolygon'] and p.area>0]
  if sr.record.as_dict()['DATE']==region['inventory_date']:
   matched+=polygons;ids.append(sr.record.oid)
  else:other+=polygons
 return matched,other,ids,repaired

def make_mask(matched,other,tr,valid):
 dims=valid.shape
 def burn(geoms):return rasterize([(g,1) for g in geoms],out_shape=dims,transform=tr,fill=0,dtype='uint8').astype(bool) if geoms else np.zeros(dims,bool)
 positive=burn(matched);different_date=burn(other)
 # One pixel inside and two outside the boundary are unknown, not negative.
 core=binary_erosion(positive,iterations=1)
 boundary=binary_dilation(positive,iterations=2)&~core
 ambiguous=binary_dilation(different_date,iterations=3)
 # Do not infer map-wide negative labels from an inventory without acquisition footprints.
 neighborhood=distance_transform_edt(~positive)*10<=500 if positive.any() else np.zeros(dims,bool)
 usable=valid&neighborhood&~boundary&~ambiguous
 mask=np.full(dims,255,np.uint8);mask[usable]=0;mask[usable&core]=1
 return mask,positive

def search_all(params):
 page=get(CATALOG+'/search',params);rows=[];seen=set()
 for _ in range(10):
  features=page.get('features',[])
  if not features:return rows
  for feature in features:
   if feature['id'] not in seen:rows.append(feature);seen.add(feature['id'])
  link=next((v for v in page.get('links',[]) if v.get('rel')=='next'),None)
  if not link:return rows
  if link.get('method','GET')!='GET' or not link['href'].startswith(CATALOG+'/search?'):raise ValueError('Unexpected catalog pagination')
  page=get(link['href'])
 raise ValueError('Catalog pagination exceeded limit')

def scenes(region,tr,matched,other):
 bbox=transform_bounds('EPSG:32651','EPSG:4326',region['x'],region['y'],region['x']+SIDE,region['y']+SIDE)
 day=date(region['inventory_date'])
 rows=search_all({'collections':'sentinel-2-l2a','bbox':','.join(map(str,bbox)),
  'datetime':f'{day-dt.timedelta(days=DATE_TOLERANCE)}T00:00:00Z/{day+dt.timedelta(days=DATE_TOLERANCE)}T23:59:59Z','limit':100})
 def offset(s):return abs((dt.datetime.fromisoformat(s['properties']['datetime'].replace('Z','+00:00')).date()-day).days)
 rows.sort(key=lambda s:(offset(s),s['properties'].get('eo:cloud_cover',100),s['id']))
 trials=[]
 for scene in rows:
  if offset(scene)>DATE_TOLERANCE:continue
  scl=read_aligned(asset(scene,'scl'),tr,'EPSG:32651',(384,384),Resampling.nearest)
  valid=clear_land(scl);mask,pos=make_mask(matched,other,tr,valid)
  trial={'scene_id':scene['id'],'date_offset_days':offset(scene),'clear_fraction':float(valid.mean()),'scored_pixels':int((mask!=255).sum()),'positive_pixels':int((mask==1).sum())}
  trials.append(trial)
  if valid.mean()>=.45 and (mask==1).sum()>=128 and (mask!=255).sum()>=8192:
   return scene,valid,trials
 raise ValueError('No sufficiently clear date-matched scene: '+json.dumps(trials))

def prepare_region(reader,region):
 out=HERE/'regions'/region['id'];out.mkdir(parents=True,exist_ok=True)
 if (out/'complete.json').exists():return json.loads((out/'complete.json').read_text())['samples']
 tr=from_origin(region['x'],region['y']+SIDE,10,10)
 matched,other,ids,repaired=region_geometries(reader,region)
 if not matched:raise ValueError('No matched polygons')
 scene,valid,trials=scenes(region,tr,matched,other)
 write(HERE/'sources'/(scene['id']+'.json'),scene)
 applied=scene['properties'].get('earthsearch:boa_offset_applied') is True
 def band(key):return reflectance(read_aligned(asset(scene,key),tr,'EPSG:32651',(384,384)),scene['assets'][key],applied)
 with ThreadPoolExecutor(max_workers=3) as pool:optical=list(pool.map(band,ASSETS))
 terr,dem_sources=terrain(tr,(384,384));data=np.stack(optical+terr)
 valid &= np.isfinite(data).all(0)
 if valid.sum()==0:raise ValueError('No finite clear pixels')
 if np.mean(data[:11,valid]<-.05)>.02:raise ValueError('Reflectance scale/offset check failed')
 mask,raw_positive=make_mask(matched,other,tr,valid)
 rows=[]
 for r in range(3):
  for c in range(3):
   sid=f'{region["id"]}_r{r}_c{c}';dest=HERE/'samples'/sid;dest.mkdir(parents=True,exist_ok=True)
   sl=(slice(r*128,(r+1)*128),slice(c*128,(c+1)*128));a=data[(slice(None),*sl)];label=mask[sl]
   if (label!=255).sum()<4096:continue
   tt=tr*rasterio.Affine.translation(c*128,r*128)
   tiff(dest/'input.tif',a,tt,BANDS);Image.fromarray(label).save(dest/'mask.png')
   Image.fromarray(preview(a)).save(dest/'rgb.png')
   overlay=preview(a).copy();overlay[label==1]=(overlay[label==1]*.4+np.array([255,80,40])*.6).astype('uint8')
   overlay[label==255]=(overlay[label==255]*.35).astype('uint8');Image.fromarray(overlay).save(dest/'overlay.png')
   meta={'id':sid,'region':region['id'],'split':region['split'],'scene_id':scene['id'],
    'inventory_date':region['inventory_date'],'image_date':scene['properties']['datetime'],
    'date_offset_days':trials[-1]['date_offset_days'],'image_path':str((dest/'input.tif').resolve()),
    'mask_path':str((dest/'mask.png').resolve()),'image_sha256':sha(dest/'input.tif'),'mask_sha256':sha(dest/'mask.png'),
    'positive_pixels':int((label==1).sum()),'scored_pixels':int((label!=255).sum()),'tags':[],
    'reference_type':REFERENCE,'human_reviewed':False,'transform':list(tt)[:6],
    'polygon_record_ids':ids,'geometry_repairs_in_region':repaired,'dem_sources':dem_sources}
   write(dest/'meta.json',meta);rows.append(meta)
 write(out/'complete.json',{'region':region,'scene_trials':trials,'samples':rows})
 return rows

def freeze(plan,rows,save=True):
 """Inventory-specific checks, separate from the manual-review workflow."""
 verify_plan(plan)
 by_region={r['id']:r for r in plan['regions']}
 if len({r['id'] for r in rows})!=len(rows):raise ValueError('Duplicate sample')
 for split,minimum,min_regions in [('train',30,5),('val',12,2),('test',12,2)]:
  subset=[r for r in rows if r['split']==split]
  if len(subset)<minimum or len({r['region'] for r in subset})<min_regions:raise ValueError(f'Insufficient {split} coverage: {len(subset)} patches')
  if sum(r['positive_pixels'] for r in subset)<256:raise ValueError(f'Too few {split} positives')
 sums=np.zeros(13,np.float64);squares=sums.copy();n=0
 for row in rows:
  region=by_region.get(row['region'])
  if not region or row['split']!=region['split'] or row['inventory_date']!=region['inventory_date']:raise ValueError('Sample/region split mismatch')
  offset=abs((dt.datetime.fromisoformat(row['image_date'].replace('Z','+00:00')).date()-date(row['inventory_date'])).days)
  if offset!=row['date_offset_days'] or offset>DATE_TOLERANCE:raise ValueError('Temporal mismatch')
  if sha(row['image_path'])!=row['image_sha256'] or sha(row['mask_path'])!=row['mask_sha256']:raise ValueError('Data changed')
  with rasterio.open(row['image_path']) as src:
   if list(src.descriptions)!=BANDS or src.shape!=(128,128) or src.crs.to_epsg()!=32651:raise ValueError('Input contract mismatch')
   west,south,east,north=src.bounds
   if src.res!=(10,10) or not (region['x']<=west<east<=region['x']+SIDE and region['y']<=south<north<=region['y']+SIDE):raise ValueError('Sample outside its geographic region')
   a=src.read()
  label=np.array(Image.open(row['mask_path']))
  if label.shape!=(128,128) or not np.isin(label,[0,1,255]).all():raise ValueError('Invalid mask values')
  if (label!=255).sum()<4096 or int((label==1).sum())!=row['positive_pixels']:raise ValueError('Label counts changed')
  values=a[:,label!=255].astype('float64')
  if not np.isfinite(values).all():raise ValueError('Invalid labeled input')
  if row['split']=='train':sums+=values.sum(1);squares+=(values**2).sum(1);n+=values.shape[1]
 mean=sums/n;std=np.sqrt(np.maximum(squares/n-mean**2,1e-12))
 contract={**CONTRACT,'normalization':'Training inventory-labeled pixels only; no validation/test values.',
  'adaptation':'Separate 13-channel model fine-tuned on date-matched official inventory; labels not individually human reviewed here.'}
 doc={'contract':contract,'source_sha256':ARCHIVE_SHA,'plan_sha256':sha(HERE/'plan.json'),'reference_type':REFERENCE,
  'samples':rows,'counts':dict(collections.Counter(r['split'] for r in rows)),
  'train_mean':mean.tolist(),'train_std':std.tolist(),'training_normalization_pixels':n,
  'limits':['Satellite interpretation, not field-confirmed events or future landslide prediction.',
   'Unmapped areas within 500 m are weak background labels; inventory mapping limit is 1000 m2.',
   'Clouds, mismatched-date polygons and boundary uncertainty excluded. Up to 3-day temporal mismatch remains.',
   'Positive-enriched geographic subset; not a representative nationwide accuracy estimate.',
   'Geographic separation applies to this local fine-tuning split; prior pretrained exposure to these areas is unknown.']}
 if save:write(HERE/'dataset.json',doc)
 return doc

def prepare_all():
 reader=inventory();plan_path=HERE/'plan.json'
 if not plan_path.exists():write(plan_path,make_plan(reader))
 plan=json.loads(plan_path.read_text());verify_plan(plan)
 if plan['source_sha256']!=ARCHIVE_SHA:raise ValueError('Plan inventory changed')
 rows=[];failures=[]
 for i,region in enumerate(plan['regions']):
  status(state='preparing',region=region['id'],regions_completed=i,regions_total=len(plan['regions']),samples=len(rows))
  try:
   new=prepare_region(reader,region);rows+=new
   print(f'{region["id"]}: {len(new)} usable patches ({region["split"]})',flush=True)
  except Exception as exc:
   failures.append({'region':region['id'],'error':str(exc)});print(f'{region["id"]}: rejected: {exc}',flush=True)
  write(HERE/'preparation.json',{'samples':rows,'failures':failures})
 reader.close()
 doc=freeze(plan,rows)
 status(state='data_ready',counts=doc['counts'],rejected_regions=len(failures))
 return HERE/'dataset.json'

if __name__=='__main__':prepare_all()
