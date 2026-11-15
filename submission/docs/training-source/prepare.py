"""Fetch real L2A/DEM inputs on one grid; preserve provenance and unknown pixels."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import sys,json,math,time
import numpy as np
import requests,rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform as project,transform_bounds,reproject
from rasterio.enums import Resampling
from PIL import Image
from core import HERE,ROOT,BANDS,ASSETS,CONTRACT,write,sha,check_plan
sys.path.insert(0,str(ROOT/'outputs/taiwan-landslide-map'))
from evidence import read_aligned,reflectance,slope_degrees

CATALOG='https://earth-search.aws.element84.com/v1'

def get(url,params=None):
 last=None
 for attempt in range(3):
  try:
   r=requests.get(url,params=params,timeout=60);r.raise_for_status();return r.json()
  except requests.RequestException as e:last=e;time.sleep(attempt+1)
 raise last

def item(sid):
 p=HERE/'sources'/(sid+'.json')
 if not p.exists():write(p,get(CATALOG+'/collections/sentinel-2-l2a/items/'+sid))
 return json.loads(p.read_text())

def asset(scene,key):
 url=scene['assets'][key]['href']
 if not url.startswith('https://sentinel-cogs.s3.'):raise ValueError('Unexpected optical source host')
 return url

def terrain(tr,shape):
 west,south,east,north=rasterio.transform.array_bounds(*shape,tr)
 dt=from_origin(west-90,north+90,30,30);ds=(math.ceil((north-south)/30)+6,math.ceil((east-west)/30)+6)
 bbox=transform_bounds('EPSG:32651','EPSG:4326',*rasterio.transform.array_bounds(*ds,dt))
 found=get(CATALOG+'/search',{'collections':'cop-dem-glo-30','bbox':','.join(map(str,bbox)),'limit':12})
 dem=np.full(ds,np.nan,np.float32);sources=[]
 for f in found['features']:
  url=f['assets']['data']['href'].replace('s3://copernicus-dem-30m/','https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/')
  if not url.startswith('https://copernicus-dem-30m.s3.'):raise ValueError('Unexpected DEM host')
  a=read_aligned(url,dt,'EPSG:32651',ds);ok=np.isfinite(a);dem[ok]=a[ok];sources.append(url)
 slope=slope_degrees(dem,30);out=[]
 for a in [slope,dem]:
  b=np.full(shape,np.nan,np.float32)
  reproject(a,b,src_transform=dt,src_crs='EPSG:32651',dst_transform=tr,dst_crs='EPSG:32651',src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.bilinear)
  out.append(b)
 return out,sources

def tiff(path,data,tr,names):
 with rasterio.open(path,'w',driver='GTiff',height=data.shape[1],width=data.shape[2],count=data.shape[0],dtype='float32',crs='EPSG:32651',transform=tr,nodata=np.nan,compress='deflate') as dst:
  dst.write(data.astype('float32'))
  for i,name in enumerate(names,1):dst.set_band_description(i,name)

def preview(data):
 rgb=np.stack([data[3],data[2],data[1]])
 rgb=np.power(np.nan_to_num(rgb/.3).clip(0,1),1/1.8)
 return (rgb.transpose(1,2,0)*255).astype('uint8')

def region_data(region):
 scene=item(region['scene_id']);n=384
 x,y=project('EPSG:4326','EPSG:32651',[region['center'][1]],[region['center'][0]])
 tr=from_origin(math.floor((x[0]-n*5)/10)*10,math.ceil((y[0]+n*5)/10)*10,10,10)
 applied=scene['properties'].get('earthsearch:boa_offset_applied') is True
 def band(key):return reflectance(read_aligned(asset(scene,key),tr,'EPSG:32651',(n,n)),scene['assets'][key],applied)
 with ThreadPoolExecutor(max_workers=3) as pool:arrays=list(pool.map(band,ASSETS))
 scl=read_aligned(asset(scene,'scl'),tr,'EPSG:32651',(n,n),Resampling.nearest)
 terr,dem_sources=terrain(tr,(n,n));data=np.stack(arrays+terr)
 # No guesses about cloud/shadow/water pixels. They are unavailable for annotation.
 valid=np.isin(scl,[4,5])&np.isfinite(data).all(0)
 raw_valid=valid.copy()
 pad=np.pad(raw_valid,1,constant_values=False)
 valid=np.logical_and.reduce([pad[i:i+n,j:j+n] for i in range(3) for j in range(3)])
 before=None;before_valid=None;before_scene=None;before_warning=None
 try:
  if region.get('before_id'):before_scene=item(region['before_id'])
  else:
   from datetime import datetime,timedelta
   dt=datetime.fromisoformat(scene['properties']['datetime'].replace('Z','+00:00'))
   bbox=transform_bounds('EPSG:32651','EPSG:4326',*rasterio.transform.array_bounds(n,n,tr))
   found=get(CATALOG+'/search',{'collections':'sentinel-2-l2a','bbox':','.join(map(str,bbox)),
       'datetime':f'{(dt-timedelta(days=90)).isoformat()}/{(dt-timedelta(days=7)).isoformat()}','limit':50})['features']
   before_scene=min(found,key=lambda f:f['properties'].get('eo:cloud_cover',100)) if found else None
  if before_scene:
   write(HERE/'sources'/(before_scene['id']+'.json'),before_scene)
   before=np.zeros((4,n,n),np.float32)
   flag=before_scene['properties'].get('earthsearch:boa_offset_applied') is True
   for idx,key in [(1,'blue'),(2,'green'),(3,'red')]:
    before[idx]=reflectance(read_aligned(asset(before_scene,key),tr,'EPSG:32651',(n,n)),before_scene['assets'][key],flag)
   bscl=read_aligned(asset(before_scene,'scl'),tr,'EPSG:32651',(n,n),Resampling.nearest)
   before_valid=np.isin(bscl,[4,5])&np.isfinite(before[1:]).all(0)
 except Exception as e:before=None;before_warning=str(e)
 records=[]
 for row in range(3):
  for col in range(3):
   sid=f'{region["id"]}-r{row}-c{col}';out=HERE/'samples'/sid;out.mkdir(parents=True,exist_ok=True)
   sl=(slice(row*128,(row+1)*128),slice(col*128,(col+1)*128));tile=data[(slice(None),*sl)]
   tt=tr*rasterio.Affine.translation(col*128,row*128)
   tiff(out/'input.tif',tile,tt,BANDS);np.save(out/'valid.npy',valid[sl]);Image.fromarray(preview(tile)).save(out/'after.png')
   Image.fromarray((~valid[sl]*255).astype('uint8')).save(out/'excluded.png')
   if before is not None:
    Image.fromarray(preview(before[(slice(None),*sl)])).save(out/'before.png')
    Image.fromarray((~before_valid[sl]*255).astype('uint8')).save(out/'before_excluded.png')
   bounds=list(transform_bounds('EPSG:32651','EPSG:4326',*rasterio.transform.array_bounds(128,128,tt)))
   meta={'id':sid,'region':region['id'],'region_label':region['label'],'split':region['split'],
    'contract_id':CONTRACT['id'],'bands':BANDS,'bbox':bounds,'crs':'EPSG:32651','transform':list(tt)[:6],
    'date':scene['properties']['datetime'],'scene_id':scene['id'],'before_date':before_scene['properties']['datetime'] if before is not None else None,
    'before_warning':before_warning,'usable_fraction':float(valid[sl].mean()),'image_sha256':sha(out/'input.tif'),
    'source_item':str((HERE/'sources'/(scene['id']+'.json')).resolve()),'dem_sources':dem_sources,
    'acquisition_offset_already_applied':applied,'reference_status':'unreviewed',
    'attribution':'Contains modified Copernicus Sentinel-2 data and Copernicus DEM via Earth Search/AWS.'}
   write(out/'meta.json',meta);records.append(meta)
 return records

def main():
 plan=json.loads((HERE/'plan.json').read_text());check_plan(plan);write(HERE/'input_contract.json',CONTRACT)
 write(HERE/'compatibility_audit.json',{'compatible':False,'contract':CONTRACT,'sources':[
  'https://documentation.v1.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html',
  'https://huggingface.co/datasets/ibm-nasa-geospatial/Landslide4sense']})
 records=[]
 for i,region in enumerate(plan['regions']):
  write(HERE/'prepare_status.json',{'state':'fetching','region':region['id'],'regions_completed':i,'regions_total':len(plan['regions'])})
  cached=list((HERE/'samples').glob(region['id']+'-*/meta.json'))
  if len(cached)==9:rows=[json.loads(p.read_text()) for p in sorted(cached)]
  else:rows=region_data(region)
  records.extend(rows);write(HERE/'manifest.json',{'contract':CONTRACT,'samples':records})
  print('Prepared',region['id'],len(rows),'patches',flush=True)
 write(HERE/'prepare_status.json',{'state':'completed','samples':len(records),'reviewed':0,'training_started':False})

if __name__=='__main__':
 try:main()
 except Exception as e:
  write(HERE/'prepare_status.json',{'state':'failed','error':str(e)});raise
