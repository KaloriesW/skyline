"""Contracts and human-label gates for a separate Taiwan adaptation dataset."""
from pathlib import Path
import hashlib,json,math,re
import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
BANDS=['B1','B2','B3','B4','B5','B6','B7','B8','B9','B11','B12','slope','DEM']
ASSETS=['coastal','blue','green','red','rededge1','rededge2','rededge3','nir','nir09','swir16','swir22']
CONTRACT={'id':'taiwan-l2a-copdem13-v1','bands':BANDS,'shape':[13,128,128],
 'spectral_units':'L2A surface reflectance using scene scale/offset and boa_offset_applied flag',
 'slope_units':'degrees; computed at 30 m before resampling','elevation_units':'metres; Copernicus GLO-30',
 'grid':'EPSG:32651, 10 m; coarse bands resampled, not native 10 m',
 'normalization':'Fit per-band statistics on reviewed training pixels only at export.',
 'direct_14band_checkpoint_compatible':False,
 'blockers':['L2A has no B10; never invent it or substitute B8A.',
 'L4S publisher-normalized values cannot be equated to physical reflectance without a verified inverse transform.',
 'Copernicus DEM/slope differ from L4S ALOS-derived terrain.'],
 'adaptation':'Fine-tune a separately adapted 13-channel copy on reviewed local masks. Original checkpoint remains intact.'}

def write(path,obj):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
 tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(obj,indent=2));tmp.replace(path)

def sha(path):
 with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def distance(a,b):
 lat1,lon1=map(math.radians,a);lat2,lon2=map(math.radians,b)
 h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
 return 6371*2*math.asin(min(1,math.sqrt(h)))

def check_plan(plan):
 regions=plan['regions']
 if len({r['id'] for r in regions})!=len(regions):raise ValueError('Duplicate region')
 for a in regions:
  if a['split'] not in ['train','val','test']:raise ValueError('Unknown split')
  for b in regions:
   if a['split']!=b['split'] and distance(a['center'],b['center'])<10:
    raise ValueError('Cross-split regions must be at least 10 km apart')

def sample_dir(sample_id,root=HERE):
 if not re.fullmatch(r'[a-z_]+-r[0-2]-c[0-2]',sample_id):raise ValueError('Invalid sample id')
 p=root/'samples'/sample_id
 if not (p/'meta.json').exists():raise ValueError('Unknown sample')
 return p

def latest_label(sample_id,root=HERE):
 pointer=root/'labels'/sample_id/'latest.json'
 return json.loads(pointer.read_text()) if pointer.exists() else None

def validate_annotation(mask,valid,reviewer,decision):
 a=np.asarray(mask)
 if a.shape!=(128,128) or not np.isin(a,[0,1,255]).all():raise ValueError('Mask must be 128x128 values 0, 1, or 255')
 if not reviewer.strip():raise ValueError('Reviewer name is required')
 if decision not in ['draft','reviewed']:raise ValueError('Invalid decision')
 if np.any((a!=255)&~valid):raise ValueError('Cloud/no-data pixels must remain unknown')
 if decision=='reviewed' and (a!=255).sum()<256:raise ValueError('Review at least 256 valid pixels or save a draft')
 return a.astype('uint8')

def export_dataset(root=HERE):
 """Freeze only explicit human reviews; never convert unlabeled pixels to background."""
 from datetime import datetime,timezone
 plan=json.loads((root/'plan.json').read_text());check_plan(plan)
 manifest=json.loads((root/'manifest.json').read_text())
 rows=[];counts={s:0 for s in ['train','val','test']}
 sums=np.zeros(13,np.float64);squares=sums.copy();n=0
 for item in manifest['samples']:
  sid=item['id'];p=sample_dir(sid,root);ann=latest_label(sid,root)
  if not ann or ann['decision']!='reviewed':continue
  if ann['sample_sha256']!=sha(p/'input.tif'):raise ValueError('Image changed after review')
  mask_path=root/'labels'/sid/ann['mask_file']
  if sha(mask_path)!=ann['mask_sha256']:raise ValueError('Annotation checksum mismatch')
  mask=np.asarray(Image.open(mask_path));valid=np.load(p/'valid.npy')
  validate_annotation(mask,valid,ann['reviewer'],'reviewed')
  meta=json.loads((p/'meta.json').read_text())
  if meta['contract_id']!=CONTRACT['id']:raise ValueError('Incompatible input contract')
  if meta['split']!=next(r['split'] for r in plan['regions'] if r['id']==meta['region']):raise ValueError('Region split changed')
  counts[meta['split']]+=1
  row={**meta,'mask_path':str(mask_path.resolve()),'mask_sha256':ann['mask_sha256'],
       'image_path':str((p/'input.tif').resolve()),'image_sha256':sha(p/'input.tif'),
       'reviewer':ann['reviewer'],'tags':ann['tags'],'positive_pixels':int((mask==1).sum()),'reviewed_pixels':int((mask!=255).sum())}
  rows.append(row)
  if meta['split']=='train':
   import rasterio
   with rasterio.open(p/'input.tif') as src:x=src.read().astype('float64')
   v=x[:,mask!=255]
   if not np.isfinite(v).all():raise ValueError('Nonfinite reviewed input')
   sums+=v.sum(1);squares+=(v*v).sum(1);n+=v.shape[1]
 if not n:raise ValueError('No reviewed training pixels yet; label data first.')
 mean=sums/n;std=np.sqrt(np.maximum(squares/n-mean*mean,1e-12))
 doc={'contract':CONTRACT,'created_at':datetime.now(timezone.utc).isoformat(),'plan_sha256':sha(root/'plan.json'),
      'counts':counts,'samples':rows,'train_mean':mean.tolist(),'train_std':std.tolist(),
      'reference_type':'Human visual interpretation, not field-verified ground truth',
      'normalization_fit':'Reviewed training pixels only; no validation/test values.'}
 key=hashlib.sha256(json.dumps(doc,sort_keys=True).encode()).hexdigest()[:12]
 out=root/'exports'/key;write(out/'dataset.json',doc)
 return out/'dataset.json'

def training_gate(doc):
 errors=[]
 for split,minimum in [('train',20),('val',8),('test',8)]:
  rows=[r for r in doc['samples'] if r['split']==split]
  if len(rows)<minimum:errors.append(f'{split}: need {minimum} reviewed patches, have {len(rows)}')
  if sum(r['positive_pixels'] for r in rows)<64:errors.append(f'{split}: need at least 64 reviewed landslide pixels')
 groups={}
 for r in doc['samples']:
  if r['region'] in groups and groups[r['region']]!=r['split']:errors.append('Region leakage')
  groups[r['region']]=r['split']
 if len({r['region'] for r in doc['samples'] if r['split']=='train'})<2:errors.append('Need two training regions')
 if doc['contract']['id']!=CONTRACT['id']:errors.append('Wrong preprocessing contract')
 if errors:raise ValueError('; '.join(errors))

