"""Local satellite scene search and georeferenced landslide inference."""
from __future__ import annotations
import csv
import io
import json
import math
import os
import re
import threading
import traceback
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WORK = ROOT / 'work' if (ROOT / 'work/landslide-venv').exists() else HERE / '.runtime'
os.environ.setdefault('YOLO_CONFIG_DIR', str(WORK / 'yolo-config'))
os.environ.setdefault('MPLCONFIGDIR', str(WORK / 'mpl-config'))
os.environ.setdefault('YOLO_AUTOINSTALL', 'false')

import numpy as np
import requests
import rasterio
from rasterio.enums import Resampling
from rasterio.features import shapes, geometry_mask
from rasterio.warp import transform_bounds, transform_geom, reproject, calculate_default_transform
from rasterio.windows import Window, from_bounds
from shapely.geometry import shape, mapping
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator
import model_profiles

CATALOG = 'https://earth-search.aws.element84.com/v1'
COLLECTION = 'sentinel-2-l2a'
RESULTS = HERE / 'results'
RESULTS.mkdir(exist_ok=True)
TRAINING = HERE.parent / 'landslide-training'
SELECTION_FILE = HERE / 'model_selection.json'
MODEL_CONFIG = {
    'unet13': ('U-Net · Taiwan · 13 bands', 'unet13', 'status_unet13.json', 128),
    'nano224': ('YOLO11n · 224', 'yolo11n-seg-224', 'status.json', 224),
    'nano448': ('YOLO11n · 448', 'yolo11n-seg-448', 'status_448.json', 448),
    'large448': ('YOLO11l · 448', 'yolo11l-seg-448', 'status_l448.json', 448),
    'sentinel2448': ('YOLO11l · Sentinel-2 · 448', 'yolo11l-seg-sentinel2-448', 'status_sentinel2.json', 448),
}
JOBS = {}
ACTIVE = threading.Lock()
app = FastAPI(title='Taiwan Landslide Observatory')
app.mount('/static', StaticFiles(directory=HERE / 'static'), name='static')

class Area(BaseModel):
    lat: float = Field(default=24.16, ge=21.8, le=26.5)
    lon: float = Field(default=121.60, ge=118.0, le=122.1)
    width_km: float = Field(default=6, ge=2, le=60)

    def bbox(self):
        dy = self.width_km / 2 / 111.32
        dx = dy / math.cos(math.radians(self.lat))
        return [self.lon-dx, self.lat-dy, self.lon+dx, self.lat+dy]

class Search(Area):
    start: date
    end: date
    cloud: float = Field(default=60, ge=0, le=100)

    @model_validator(mode='after')
    def dates(self):
        if self.start > self.end or (self.end-self.start).days > 366:
            raise ValueError('Choose an ordered date range of at most one year.')
        return self

class Scan(Area):
    scene_id: str = Field(pattern=r'^S2[ABC]_[A-Za-z0-9_]+_L2A$', max_length=100)
    model: str = 'unet13'
    confidence: float | None = Field(default=None, ge=0.001, le=0.95)

    @model_validator(mode='after')
    def default_confidence(self):
        if self.confidence is None:
            self.confidence = model_profiles.profile(self.model)['confidence']
        return self


def get_json(url, **kwargs):
    r = requests.get(url, timeout=(15, 90), **kwargs)
    r.raise_for_status()
    return r.json()


def model_list():
    output = []
    preferred = read_selection().get('default_model', 'nano224')
    for key, (label, folder, status_name, size) in MODEL_CONFIG.items():
        f = TRAINING / status_name
        bundled = HERE / 'models' / f'{key}.pt'
        status = json.loads(f.read_text()) if f.exists() else {'state': 'completed' if bundled.exists() else 'not installed'}
        weights = model_weights(key)
        calibration = model_profiles.release() if key == model_profiles.KEY else model_profiles.profile(key) if key == 'unet13' else None
        available = status['state']=='completed' and weights.exists()
        if key == model_profiles.KEY:
            available = available and calibration is not None
            if status['state']=='completed' and not available:
                status = {**status, 'state':'calibrating'}
        output.append(dict(id=key, label=label, imgsz=size,
                           preferred=key == preferred,
                           confidence=calibration['confidence'] if calibration else .35,
                           state=status['state'], available=available))
    return output


def model_weights(key):
    if key in {model_profiles.KEY,'unet13'}:
        return HERE / 'models' / f'{key}.pt'
    trained = TRAINING / MODEL_CONFIG[key][1] / 'weights/best.pt'
    return trained if trained.exists() else HERE / 'models' / f'{key}.pt'


def read_selection():
    return json.loads(SELECTION_FILE.read_text()) if SELECTION_FILE.exists() else {'default_model':'nano224'}


def write_selection(state):
    tmp=SELECTION_FILE.with_suffix('.tmp')
    tmp.write_text(json.dumps(state,indent=2));tmp.replace(SELECTION_FILE)


@app.get('/')
def index():
    return FileResponse(HERE / 'static/index.html')

@app.get('/api/models')
def models():
    return model_list()

@app.post('/api/scenes')
def scenes(query: Search):
    try:
        data = get_json(CATALOG+'/search', params={
            'collections': COLLECTION, 'bbox': ','.join(map(str, query.bbox())),
            'datetime': f'{query.start}T00:00:00Z/{query.end}T23:59:59Z',
            'limit': 100, 'query': json.dumps({'eo:cloud_cover': {'lte': query.cloud}})})
        features = data.get('features', [])
        eligible = [f for f in features if f['properties'].get('eo:cloud_cover', 100) <= query.cloud
                    and 'visual' in f['assets'] and 'scl' in f['assets']]
        eligible.sort(key=lambda f:f['properties'].get('eo:cloud_cover', 100))
        return {'scenes': [dict(id=f['id'], date=f['properties']['datetime'],
                               cloud=f['properties']['eo:cloud_cover'], bbox=f['bbox'],
                               platform=f['properties'].get('platform','Sentinel-2')) for f in eligible],
                'searched_count': len(features), 'limit': 100, 'bbox': query.bbox(),
                'note': 'Up to 100 matching scenes, sorted by whole-scene cloud cover. Local cloud coverage is checked during scanning.'}
    except requests.RequestException as e:
        raise HTTPException(502, 'Satellite catalogue unavailable. Please retry. '+str(e))


def safe_asset(item, key):
    href = item['assets'][key]['href']
    if not href.startswith('https://sentinel-cogs.s3.us-west-2.amazonaws.com/'):
        raise ValueError('Unexpected satellite asset host.')
    return href


def fetch_crop(item, bbox):
    import mosaic
    return mosaic.fetch(item,bbox,CATALOG,get_json,safe_asset)


def tile_starts(length, size=224, stride=168):
    if length <= size:return [0]
    return sorted(set(list(range(0,length-size+1,stride))+[length-size]))


def make_features(mask, scores, transform, crs, scene_id, acquired):
    features=[]
    for geometry,value in shapes(mask.astype('uint8'),mask=mask,transform=transform,connectivity=4):
        if value != 1:continue
        polygon=shape(geometry)
        if polygon.area < 400:continue  # Four native 10 m pixels.
        # Score only this component, including correct handling of holes.
        from spatial import local_mask
        region,inside=local_mask(geometry,mask.shape,transform)
        point=polygon.representative_point()
        point_geo=transform_geom(crs,'EPSG:4326',mapping(point))['coordinates']
        features.append({'type':'Feature','geometry':transform_geom(crs,'EPSG:4326',geometry),
            'properties': {'id':len(features)+1,'longitude':round(point_geo[0],6),
                'latitude':round(point_geo[1],6),'area_m2':round(polygon.area),
                'confidence':round(float(scores[region][inside].max()),4),
                'scene_id':scene_id,'acquired':acquired,'classification':'suspected landslide',
                'location_method':'point inside predicted polygon',
                'score_method':'maximum contributing instance confidence; not a calibrated probability'}})
    return {'type':'FeatureCollection','features':features}


def save_overlay(rgb, valid, transform, crs, path):
    h,w=valid.shape
    bounds=rasterio.transform.array_bounds(h,w,transform)
    # Leaflet displays image overlays in Web Mercator. Warp first to avoid
    # stretching a UTM raster onto an inaccurate latitude/longitude rectangle.
    dst_transform,dw,dh=calculate_default_transform(crs,'EPSG:3857',w,h,*bounds)
    rgba=np.zeros((4,dh,dw),dtype='uint8')
    for band in range(3):
        reproject(rgb[band],rgba[band],src_transform=transform,src_crs=crs,
                  dst_transform=dst_transform,dst_crs='EPSG:3857',resampling=Resampling.bilinear)
    reproject(valid.astype('uint8')*255,rgba[3],src_transform=transform,src_crs=crs,
              dst_transform=dst_transform,dst_crs='EPSG:3857',resampling=Resampling.nearest)
    Image.fromarray(rgba.transpose(1,2,0)).save(path)
    west,south,east,north=transform_bounds('EPSG:3857','EPSG:4326',*rasterio.transform.array_bounds(dh,dw,dst_transform))
    return [[south,west],[north,east]]


def save_detection_exports(directory,geojson):
    import roads,weather
    fields=['id','latitude','longitude','area_m2','confidence','acquired','scene_id','classification',
            'before_acquired','ndvi_before','ndvi_after','ndvi_drop','vegetation_loss_percent',
            'paired_clear_percent','vegetation_check','slope_median_deg','slope_coverage_percent',
            'slope_check','evidence_summary']+roads.FIELDS+weather.FIELDS
    for filename in ['detections.geojson','coordinates.csv']:
        target=directory/filename;temp=target.with_suffix('.tmp')
        if filename.endswith('.geojson'):temp.write_text(json.dumps(geojson,indent=2))
        else:
            with temp.open('w',newline='') as f:
                writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader()
                writer.writerows(feature['properties'] for feature in geojson['features'])
        temp.replace(target)

ROAD_UPDATE=threading.Lock()
@app.post('/api/scans/{job_id}/roads')
def update_roads(job_id:str):
    if not re.fullmatch('[a-f0-9]{32}',job_id):raise HTTPException(404,'Scan not found.')
    if not ROAD_UPDATE.acquire(blocking=False):raise HTTPException(409,'A road lookup is already running. Please wait.')
    try:
        job=scan_status(job_id)
        if job['state']!='completed':raise HTTPException(409,'Wait for the scan to complete.')
        result=job['result']
        if result.get('demo_snapshot'):raise HTTPException(409,'Demo snapshots are read-only. Exit the demo for live checks.')
        if result.get('roads',{}).get('status') not in ['available','not_needed']:
            import roads
            result['roads']=roads.analyze(result['geojson'],result['bbox'])
            directory=RESULTS/job_id;save_detection_exports(directory,result['geojson'])
            temp=directory/'result.tmp';temp.write_text(json.dumps(result,indent=2));temp.replace(directory/'result.json')
            if job_id in JOBS:JOBS[job_id]['result']=result
        return result
    finally:ROAD_UPDATE.release()


@app.get('/api/weather/map')
def weather_map():
    import weather
    return weather.taiwan_grid()

class WeatherBounds(BaseModel):
    west:float=Field(ge=110,le=130,allow_inf_nan=False)
    south:float=Field(ge=15,le=32,allow_inf_nan=False)
    east:float=Field(ge=110,le=130,allow_inf_nan=False)
    north:float=Field(ge=15,le=32,allow_inf_nan=False)

@app.post('/api/weather/grid')
def weather_grid(bounds:WeatherBounds):
    import weather
    try:return weather.start_grid(bounds.west,bounds.south,bounds.east,bounds.north)
    except ValueError as exc:raise HTTPException(400,str(exc))

@app.get('/api/weather/grid/{identifier}')
def weather_grid_status(identifier:str):
    import weather
    if identifier not in weather.GRID_JOBS:raise HTTPException(404,'Forecast request expired. Reload this area.')
    return weather.GRID_JOBS[identifier]

@app.post('/api/weather/area')
def weather_area(area:Area):
    import weather
    return weather.area_forecast(area.lat,area.lon,area.width_km)

@app.post('/api/scans/{job_id}/weather')
def update_weather(job_id:str):
    if not re.fullmatch('[a-f0-9]{32}',job_id):raise HTTPException(404,'Scan not found.')
    if not ROAD_UPDATE.acquire(blocking=False):raise HTTPException(409,'A result update is already running. Please wait.')
    try:
        job=scan_status(job_id)
        if job['state']!='completed':raise HTTPException(409,'Wait for the scan to complete.')
        import weather
        result=job['result']
        if result.get('demo_snapshot'):raise HTTPException(409,'Demo snapshots are read-only. Exit the demo for live checks.')
        w=weather.area_forecast(*result['center'],result['width_km'])
        # Keep the saved snapshot if a refresh fails, but return the failure explicitly.
        if w['status']=='unavailable' and result.get('weather',{}).get('status') in ['available','partial']:
            raise HTTPException(503,'Forecast refresh failed. The previous dated snapshot is preserved.')
        weather.attach(result,w);directory=RESULTS/job_id;weather.save(directory,w)
        save_detection_exports(directory,result['geojson'])
        temp=directory/'result.tmp';temp.write_text(json.dumps(result,indent=2));temp.replace(directory/'result.json')
        if job_id in JOBS:JOBS[job_id]['result']=result
        import scan_assistant
        scan_assistant.refresh_saved_weather(HERE,result)
        return result
    finally:ROAD_UPDATE.release()


def scan_job(job_id,request):
    import time
    started=time.monotonic()
    job=JOBS[job_id]
    def update(message,progress):job.update(message=message,progress=progress)
    try:
        update('Fetching georeferenced Sentinel-2 imagery…',5)
        item=get_json(f'{CATALOG}/collections/{COLLECTION}/items/{request.scene_id}')
        import mosaic
        item,rgb,valid,clear,transform,crs=fetch_crop(item,request.bbox())
        if clear.mean()<0.02:
            raise ValueError('Less than 2% of this area has usable clear pixels. Choose another scene or location.')
        job_dir=RESULTS/job_id;job_dir.mkdir()
        bounds=save_overlay(rgb,valid,transform,crs,job_dir/'satellite.png')
        # Excluded pixels have a separate overlay, leaving true-color imagery intact.
        excluded=np.zeros_like(rgb);excluded[0]=240;excluded[1]=180;excluded[2]=70
        save_overlay(excluded,~clear,transform,crs,job_dir/'excluded.png')
        update('Loading the completed checkpoint on CPU…',20)
        import torch
        torch.set_num_threads(2)
        label,folder,_,size=MODEL_CONFIG[request.model]
        checkpoint=model_weights(request.model)
        import hashlib
        checkpoint_hash=hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        profile=model_profiles.profile(request.model)
        if request.model == model_profiles.KEY:
            model_profiles.verify()
        h,w=valid.shape
        input_metadata=None
        if request.model == 'unet13':
            import unet_inference
            union,scores,used,clear,input_metadata=unet_inference.run(
                item,transform,crs,(h,w),request.bbox(),job_dir,CATALOG,get_json,safe_asset,
                request.confidence,update)
            save_overlay(excluded,~clear,transform,crs,job_dir/'excluded.png')
        else:
            from ultralytics import YOLO
            model=YOLO(str(checkpoint))
            h,w=valid.shape
            native=profile['tile_size'];stride=profile['stride']
            inference_rgb=rgb
            inference_valid=valid
            if request.model == model_profiles.KEY:
                update('Fetching native Sentinel-2 RGB bands for the fine-tuned model…',20)
                inference_rgb,inference_valid=mosaic.native_rgb(item,transform,crs,(h,w),safe_asset)
                clear=clear & inference_valid
                if clear.mean()<.02:raise ValueError('Insufficient valid native RGB coverage for Sentinel-2 inference.')
            union=np.zeros((h,w),bool);scores=np.zeros((h,w),np.float32)
            tiles=[(y,x) for y in tile_starts(h,native,stride) for x in tile_starts(w,native,stride)]
            used=0
            for i,(y,x) in enumerate(tiles):
                th,tw=min(native,h-y),min(native,w-x)
                if clear[y:y+th,x:x+tw].mean()<0.05:continue
                patch=inference_rgb[:,y:y+th,x:x+tw].transpose(1,2,0)
                if request.model == model_profiles.KEY:
                    good=inference_valid[y:y+th,x:x+tw]
                    if good.sum()<16:continue
                    patch=model_profiles.rgb_to_uint8(patch,good)
                # Ultralytics expects BGR arrays; pad edges before inference.
                bgr=np.zeros((native,native,3),dtype='uint8');bgr[:th,:tw]=patch[:,:,::-1]
                prediction=model.predict(bgr,imgsz=size,conf=request.confidence,device='cpu',
                                         retina_masks=True,verbose=False,max_det=profile['max_det'],iou=profile['nms_iou'])[0]
                used+=1
                if prediction.masks is not None:
                    masks=prediction.masks.data.cpu().numpy()
                    confidences=prediction.boxes.conf.cpu().numpy()
                    for detected,score in zip(masks,confidences):
                        m=(detected[:th,:tw]>0.5)&clear[y:y+th,x:x+tw]
                        union[y:y+th,x:x+tw] |= m
                        target=scores[y:y+th,x:x+tw];target[m]=np.maximum(target[m],score)
                update(f'Analyzing tile {i+1} of {len(tiles)}…',20+int(65*(i+1)/len(tiles)))
        update('Converting detected boundaries to geographic coordinates…',90)
        geojson=make_features(union,scores,transform,crs,item['id'],item['properties']['datetime'])
        if request.model == 'unet13':
            for feature in geojson['features']:
                feature['properties']['score_method']='Maximum blended U-Net pixel score; not calibrated risk probability'
        import evidence
        try:
            evidence_result=evidence.analyze(item,geojson,transform,crs,(h,w),request.bbox(),
                job_dir,CATALOG,get_json,safe_asset,save_overlay,update)
        except Exception as exc:
            traceback.print_exc()
            evidence_result={'vegetation_status':'unavailable','terrain_status':'unavailable',
                             'warnings':['Additional evidence could not be completed: '+str(exc)],
                             'rules':evidence.RULES}
        update('Checking nearby mapped roads…',98)
        import roads
        road_result=roads.analyze(geojson,request.bbox())
        update('Saving coordinates and supporting evidence…',99)
        save_detection_exports(job_dir,geojson)
        with rasterio.open(job_dir/'source_crop.tif','w',driver='GTiff',height=h,width=w,
                           count=3,dtype='uint8',crs=crs,transform=transform,compress='deflate') as dst:
            dst.write(rgb);dst.write_mask(valid.astype('uint8')*255)
        result={'id':job_id,'scene_id':item['id'],'acquired':item['properties']['datetime'],
                'scene_cloud_percent':item['properties'].get('eo:cloud_cover'),
                'source_tiles':mosaic.provenance(item,CATALOG),
                'source_scene_ids':[t['id'] for t in item['_tiles']],
                'imagery_coverage_percent':round(float(valid.mean()*100),1),
                'coverage_warning':None if valid.all() else 'Some pixels have no imagery for this satellite pass. Missing or cloudy pixels are not assessed.',
                'usable_percent':round(float(clear.mean()*100),1),'model':label,'model_id':request.model,
                'checkpoint_sha256':checkpoint_hash,'checkpoint_name':checkpoint.name,
                'confidence_threshold':request.confidence,'tiles_analyzed':used,'minimum_mapped_area_m2':400,
                'pixel_size_m':abs(transform.a),'overlay_bounds':bounds,'bbox':request.bbox(),
                'center':[request.lat,request.lon],'width_km':request.width_km,
                'geojson':geojson,'count':len(geojson['features']),
                'evidence':evidence_result,'roads':road_result,
                'created_at':datetime.now(timezone.utc).isoformat(),
                'processing_seconds':round(time.monotonic()-started,2),
                'input_metadata':input_metadata,
                'preprocessing':profile['preprocessing'] if request.model=='unet13' else profile['preprocessing']+'; resized to model input size; SCL 4/5/6 retained.',
                'calibration':profile if request.model in {model_profiles.KEY,'unet13'} else None,
                'limitations':('Experimental Taiwan inventory-trained U-Net. Historical inventory holdout performance does not measure accuracy on this live scene. Terrain is also a model input, so slope is supporting context, not independent validation. ' if request.model=='unet13' else 'Experimental Landslide4Sense Sentinel-2 adaptation. Validation calibration is not independent Taiwan field validation. ' if request.model == model_profiles.KEY else 'Experimental transfer from PlanetScope training to Sentinel-2. Accuracy on Sentinel-2 is unmeasured. ' )+'Candidates can be bare soil, roads or riverbeds; human review required. Coordinates are derived from imagery, not survey-accurate. A single scene cannot establish event timing.',
                'source_url':f'{CATALOG}/collections/{COLLECTION}/items/{item["id"]}',
                'attribution':'Contains modified Copernicus Sentinel data and Copernicus DEM; distributed through Element 84 Earth Search / AWS. Copernicus DEM accessed '+datetime.now(timezone.utc).date().isoformat()+' from https://registry.opendata.aws/copernicus-dem/.'}
        update('Adding the current 48-hour weather forecast…',99)
        import weather
        weather.attach(result,weather.area_forecast(request.lat,request.lon,request.width_km))
        weather.save(job_dir,result['weather']);save_detection_exports(job_dir,geojson)
        (job_dir/'result.json').write_text(json.dumps(result,indent=2))
        job.update(state='completed',message='Scan complete',progress=100,result=result)
    except Exception as e:
        traceback.print_exc()
        (RESULTS/job_id/'unet-input.npy').unlink(missing_ok=True)
        job.update(state='failed',message=str(e),progress=0)
    finally:
        ACTIVE.release()


@app.post('/api/scans',status_code=202)
def start_scan(request: Scan):
    if request.model not in MODEL_CONFIG or not any(m['id']==request.model and m['available'] for m in model_list()):
        raise HTTPException(400,'Choose a completed model checkpoint.')
    if not ACTIVE.acquire(blocking=False):raise HTTPException(409,'A scan is already running. Please let it finish.')
    job_id=uuid.uuid4().hex
    JOBS[job_id]={'id':job_id,'state':'running','message':'Starting scan…','progress':0}
    threading.Thread(target=scan_job,args=(job_id,request),daemon=True).start()
    return JOBS[job_id].copy()

@app.get('/api/scans/{job_id}')
def scan_status(job_id: str):
    if job_id in JOBS:return JOBS[job_id].copy()
    f=RESULTS/job_id/'result.json' if re.fullmatch('[a-f0-9]{32}',job_id) else None
    if f and f.exists():return {'id':job_id,'state':'completed','progress':100,'result':json.loads(f.read_text())}
    raise HTTPException(404,'Scan not found.')

@app.get('/api/history')
def history():
    results=[]
    for f in sorted(RESULTS.glob('*/result.json'),key=lambda p:p.stat().st_mtime,reverse=True)[:12]:
        r=json.loads(f.read_text())
        if r.get('demo_snapshot'):continue
        results.append({k:r[k] for k in ['id','acquired','model','count','usable_percent','created_at']})
    return results

@app.get('/results/{job_id}/{filename}')
def artifact(job_id: str,filename: str):
    allowed={'satellite.png','excluded.png','before.png','vegetation.png','slope.png','evidence.tif',
             'detections.geojson','coordinates.csv','result.json','source_crop.tif','forecast.json','forecast.csv',
             'segmentation.tif','unet_inputs.tif','input_provenance.json'}
    if not re.fullmatch('[a-f0-9]{32}',job_id) or filename not in allowed:raise HTTPException(404)
    p=RESULTS/job_id/filename
    if not p.is_file():raise HTTPException(404)
    return FileResponse(p,filename=filename if not filename.endswith('.png') else None)

# Application-level monitoring. No external scheduler or API credentials required.
WATCH_FILE=HERE/'monitor.json'
WATCH_LOCK=threading.RLock()
WATCH_STOP=threading.Event()
WATCH_INTERVAL=3600
WATCH_LOOKBACK_DAYS=14

class Watch(Area):
    enabled: bool
    model: str='unet13'
    confidence: float|None=Field(default=None,ge=0.001,le=0.95)

    @model_validator(mode='after')
    def default_confidence(self):
        if self.confidence is None:self.confidence=model_profiles.profile(self.model)['confidence']
        return self


def read_watch():
    with WATCH_LOCK:
        if WATCH_FILE.exists():return json.loads(WATCH_FILE.read_text())
        return {'enabled':False,'message':'Monitoring off'}


def write_watch(data):
    with WATCH_LOCK:
        tmp=WATCH_FILE.with_suffix('.tmp')
        tmp.write_text(json.dumps(data,indent=2));tmp.replace(WATCH_FILE)


def update_watch(generation,**fields):
    with WATCH_LOCK:
        current=read_watch()
        if current.get('generation')!=generation:return
        current.update(fields);write_watch(current)


@app.get('/api/watch')
def watch_status():
    return {**read_watch(), 'source':'Sentinel-2 · Earth Search',
            'lookback_days':WATCH_LOOKBACK_DAYS,'latest_hourly_report':next(iter(saved_watch_reports(1)),None)}


@app.post('/api/watch/check')
def check_watch_now():
    """Schedule a check without resetting the selected area or seen scenes."""
    with WATCH_LOCK:
        state=read_watch()
        if not state.get('enabled'):
            raise HTTPException(409,'Start monitoring before checking for new images.')
        if not state.get('active_job'):
            state.update(next_check=0,message='Checking for new imagery shortly…')
            write_watch(state)
    return watch_status()

@app.post('/api/watch')
def configure_watch(request: Watch):
    if request.enabled and not any(m['id']==request.model and m['available'] for m in model_list()):
        raise HTTPException(400,'Choose a completed model for monitoring.')
    with WATCH_LOCK:
        previous=read_watch()
        config=request.model_dump()
        if not request.enabled and all(k in previous for k in config):
            config={k:previous[k] for k in config};config['enabled']=False
        same=all(previous.get(k)==config[k] for k in ['lat','lon','width_km','model','confidence'])
        if previous.get('active_job') and not same:
            raise HTTPException(409,'Wait for the current scan to finish before changing the watched area or model.')
        state=previous.copy() if same else {'generation':uuid.uuid4().hex,
            'started_at':datetime.now(timezone.utc).isoformat(),'seen':[],'attempts':{}}
        if request.enabled and not previous.get('enabled'):state['next_report']=0
        state.update(config,interval_seconds=WATCH_INTERVAL,next_check=0,
            message='Monitoring enabled. Checking for recent scenes…' if request.enabled else 'Monitoring paused')
        write_watch(state)
    return state


# Persisted hourly snapshots; no synthetic backfill while the server is asleep/off.
REPORT_LIMIT=168

def report_directory():
    return WATCH_FILE.parent/'monitor_reports'

def saved_watch_reports(limit=24):
    directory=report_directory()
    if not directory.exists():return []
    rows=[]
    for path in directory.glob('*.json'):
        try:rows.append(json.loads(path.read_text()))
        except (OSError,ValueError):continue
    return sorted(rows,key=lambda row:row['created_at'],reverse=True)[:limit]

@app.get('/api/watch/reports')
def watch_reports():
    return {'reports':saved_watch_reports(), 'retention':REPORT_LIMIT,
            'note':'Snapshots are saved while monitoring and the server are running. Missed hours are not backfilled.'}

@app.get('/api/watch/reports/{report_id}/download')
def download_watch_report(report_id:str):
    if not re.fullmatch('[a-f0-9]{32}',report_id):raise HTTPException(404)
    path=report_directory()/(report_id+'.json')
    if not path.is_file():raise HTTPException(404)
    report=json.loads(path.read_text())
    return Response(report['text'],media_type='text/plain',
                    headers={'Content-Disposition':f'attachment; filename="terrain-hourly-{report_id[:8]}.txt"'})

def hourly_report_tick(now=None):
    import time
    now=time.time() if now is None else now
    with WATCH_LOCK:
        state=read_watch()
        if not state.get('enabled') or now<state.get('next_report',0):return
        stamp=datetime.fromtimestamp(now,timezone.utc).isoformat()
        record={'id':uuid.uuid4().hex,'created_at':stamp,'generation':state.get('generation'),
                'center':[state['lat'],state['lon']],'width_km':state['width_km'],
                'model':state['model'],'last_catalogue_check':state.get('last_checked'),
                'status':state.get('message','Waiting for the first catalogue check.'),
                'active_job':state.get('active_job'),'latest_scan':None}
        lines=['Terrain Watch — hourly monitoring report',f'Report time (UTC): {stamp}',
               f"Watched center: {state['lat']:.6f}, {state['lon']:.6f} · {state['width_km']} × {state['width_km']} km",
               'Status: '+record['status'],
               'Last catalogue check: '+str(state.get('last_checked') or 'Not checked yet')]
        if state.get('active_job'):lines.append('A satellite scan is in progress; its results are not available yet.')
        if ACTIVE.locked():lines.append('The scanner is busy. Catalogue checks may be delayed; this report is still saved on schedule.')
        if state.get('last_result'):
            try:
                result=scan_status(state['last_result']).get('result')
                if result:
                    measured=scan_assistant.measured_report(result)
                    record['latest_scan']={k:measured.get(k) for k in ['scan_id','acquired','count','both_checks_count','usable_percent','priority_locations']}
                    lines.extend(['','Latest completed scan — snapshot, not an hourly change count:',
                                  'Satellite image: '+str(measured['acquired']),measured['overview']])
                    forecast=measured.get('weather') or {}
                    record['saved_weather']={k:forecast.get(k) for k in ['status','summary','forecast_start','forecast_end','fetched_at']}
                    if forecast.get('summary'):
                        lines.extend(['','Weather saved with that scan (not refreshed by this report):',
                                      str(forecast['summary']),f"Forecast period: {forecast.get('forecast_start','unavailable')} → {forecast.get('forecast_end','unavailable')}"])
            except (HTTPException,OSError,ValueError,KeyError,TypeError):
                lines.append('The latest saved scan could not be read; candidate counts are unavailable.')
        if not record['latest_scan']:lines.append('No completed scan results are available for this monitoring session.')
        lines.extend(['','No new image is not evidence of no landslides. Candidates require review.',
                      'Reports require an awake computer and running server; missed hours are not backfilled.'])
        record['text']='\n'.join(lines)+'\n'
        directory=report_directory();directory.mkdir(exist_ok=True)
        path=directory/(record['id']+'.json');tmp=path.with_suffix('.tmp')
        tmp.write_text(json.dumps(record,ensure_ascii=False,indent=2));tmp.replace(path)
        state.update(next_report=now+WATCH_INTERVAL,last_report=record['id']);write_watch(state)
        for old in saved_watch_reports(100000)[REPORT_LIMIT:]:
            (directory/(old['id']+'.json')).unlink(missing_ok=True)
        return record


def monitor_tick():
    import time
    from datetime import timedelta
    state=read_watch()
    if not state.get('enabled') and not state.get('active_job'):return
    generation=state['generation']
    if state.get('active_job'):
        active=scan_status(state['active_job'])
        if active['state']=='running':
            update_watch(generation,message='Automatic scan: '+active['message']);return
        seen=state.get('seen',[])
        if active['state']=='completed':
            seen=list(dict.fromkeys(seen+active['result'].get('source_scene_ids',[state['active_scene']])))
            update_watch(generation,seen=seen[-500:],active_job=None,last_result=active['id'],
                         message=f'Latest scan: {active["result"]["count"]} candidates. Waiting for new imagery.')
        else:
            attempts=state.get('attempts',{});sid=state['active_scene'];attempts[sid]=attempts.get(sid,0)+1
            if attempts[sid]>=3 or 'Less than 2%' in active['message']:seen.append(sid)
            update_watch(generation,active_job=None,seen=seen[-500:],attempts=attempts,
                         message='Scene could not be analyzed: '+active['message'],next_check=time.time()+WATCH_INTERVAL)
        return
    if not state.get('enabled'):return
    if time.time()<state.get('next_check',0) or ACTIVE.locked():return
    now=datetime.now(timezone.utc)
    # Include several nominal five-day revisit cycles plus publication delays.
    # Older scenes remain available via manual search.
    query=Search(lat=state['lat'],lon=state['lon'],width_km=state['width_km'],
                 start=(now-timedelta(days=WATCH_LOOKBACK_DAYS)).date(),end=now.date(),cloud=100)
    update_watch(generation,last_checked=now.isoformat(),message='Checking the satellite catalogue…',
                 next_check=time.time()+WATCH_INTERVAL)
    try:
        available=scenes(query)['scenes']
        available.sort(key=lambda s:s['date'],reverse=True)
        unseen=[s for s in available if s['id'] not in state.get('seen',[])]
        if not unseen:
            update_watch(generation,message='No new scene available. Next check in one hour.');return
        chosen=unseen[0]
        # Ignore already-existing older scenes when first enabling monitoring.
        if not state.get('initialized'):
            update_watch(generation,initialized=True,seen=[s['id'] for s in available[1:]])
        with WATCH_LOCK:
            current=read_watch()
            if current.get('generation')!=generation or not current.get('enabled'):return
            job=start_scan(Scan(lat=state['lat'],lon=state['lon'],width_km=state['width_km'],
                                scene_id=chosen['id'],model=state['model'],confidence=state['confidence']))
            update_watch(generation,active_job=job['id'],active_scene=chosen['id'],
                         message='New scene found. Downloading and analyzing automatically.')
    except Exception as e:
        update_watch(generation,message='Catalogue check failed; will retry in one hour. '+str(e))


def promotion_tick():
    """Apply the user's one-time request after a successful training completion."""
    import shutil
    state=read_selection()
    if state.get('phase') == 'waiting_calibration':
        if not model_profiles.release() or ACTIVE.locked() or read_watch().get('active_job'):return
        profile=model_profiles.verify()
        if state.get('training_started_at') != profile.get('training_started_at'):
            raise ValueError('Staged calibration does not belong to the requested training run.')
        with WATCH_LOCK:
            watch=read_watch()
            watch.update(model=model_profiles.KEY,confidence=profile['confidence'])
            write_watch(watch)
        state.update(default_model=model_profiles.KEY,phase='completed',
                     confidence=profile['confidence'],checkpoint_sha256=profile['checkpoint_sha256'],
                     switched_at=datetime.now(timezone.utc).isoformat())
        write_selection(state)
        return
    if state.get('phase') not in {'waiting','refresh_pending','refreshing'}:return
    target=state['promote_to']
    if state['phase']=='waiting':
        status_path=TRAINING/MODEL_CONFIG[target][2]
        if not status_path.exists():return
        status=json.loads(status_path.read_text())
        if status.get('state')!='completed' or ACTIVE.locked() or read_watch().get('active_job'):return
        source=model_weights(target)
        if not source.is_file() or source.stat().st_size==0:return
        destination=HERE/'models'/f'{target}.pt'
        destination.parent.mkdir(exist_ok=True)
        if source.resolve()!=destination.resolve():
            tmp=destination.with_suffix('.tmp')
            shutil.copy2(source,tmp);tmp.replace(destination)
        # Keep monitoring's area, seen scenes, interval and enabled state intact.
        with WATCH_LOCK:
            watch=read_watch();watch['model']=target;write_watch(watch)
        state.update(default_model=target,phase='refresh_pending',
                     switched_at=datetime.now(timezone.utc).isoformat())
        saved=sorted(RESULTS.glob('*/result.json'),key=lambda p:p.stat().st_mtime,reverse=True)
        if saved:
            previous=json.loads(saved[0].read_text())
            state['refresh_request']={'lat':previous['center'][0],'lon':previous['center'][1],
                'width_km':previous['width_km'],'scene_id':previous['scene_id'],
                'model':target,'confidence':previous['confidence_threshold']}
        else:state['phase']='completed'
        write_selection(state)
    if state['phase']=='refresh_pending':
        if ACTIVE.locked():return
        job=start_scan(Scan(**state['refresh_request']))
        state.update(phase='refreshing',refresh_job=job['id']);write_selection(state)
    elif state['phase']=='refreshing':
        try:job=scan_status(state['refresh_job'])
        except HTTPException as exc:
            if exc.status_code!=404:raise
            # Recover a refresh that was interrupted by a server restart.
            state['phase']='refresh_pending';write_selection(state);return
        if job['state']=='running':return
        if job['state']=='completed':
            with WATCH_LOCK:
                watch=read_watch();watch['last_result']=job['id'];write_watch(watch)
            state.update(phase='completed',refresh_result=job['id'])
        else:state.update(phase='refresh_failed',error=job['message'])
        write_selection(state)


def monitor_loop():
    while not WATCH_STOP.wait(10):
        try:
            promotion_tick()
            monitor_tick()
        except Exception:
            traceback.print_exc()
        try:
            hourly_report_tick()
        except Exception:
            traceback.print_exc()


@app.on_event('startup')
def startup_monitor():
    state=read_watch()
    if state.get('active_job') and state['active_job'] not in JOBS:
        f=RESULTS/state['active_job']/'result.json'
        if not f.exists():
            state.update(active_job=None,next_check=0,message='Server restarted. Rechecking interrupted scan.')
            write_watch(state)
    WATCH_STOP.clear()
    threading.Thread(target=monitor_loop,daemon=True).start()

@app.on_event('shutdown')
def shutdown_monitor():WATCH_STOP.set()


# Local language interface; Qwen can prepare plans, but only confirmation starts a scan.
import sys
import scan_assistant
scan_assistant.register(app,sys.modules[__name__])

# Skyline city models, typhoon feed and connected weather dashboard.
import skyline_integration
skyline_integration.register(app,sys.modules[__name__])

# Independent persisted national queue; shares the single inference slot.
import national_monitor
national_monitor.register(app,sys.modules[__name__])
