"""Optional road proximity from cached OSM ways; no road-condition inference."""
import hashlib,json,math,os,threading,time
from datetime import datetime,timezone
from pathlib import Path
import requests
from rasterio.warp import transform_geom
from shapely.geometry import shape,mapping,LineString
from shapely.strtree import STRtree

ENDPOINT=os.environ.get('TERRAIN_OVERPASS_URL','https://overpass-api.de/api/interpreter')
CACHE=Path(__file__).resolve().parent/'road_cache'
LOCK=threading.Lock()
RADIUS_M=2000
NEAR_M=200
KINDS={'motorway','trunk','primary','secondary','tertiary','unclassified','residential','service','living_street','track','road','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link'}
FIELDS=['road_proximity_status','nearest_road_name','nearest_road_ref','nearest_road_type','nearest_road_osm_id','road_distance_m','near_road']

def fetch(bbox):
    west,south,east,north=bbox
    # Pad past all candidate edges so the 2 km search includes boundary roads.
    dy=RADIUS_M/110000+0.001;dx=dy/math.cos(math.radians(max(abs(south),abs(north))))
    box=f'{south-dy:.6f},{west-dx:.6f},{north+dy:.6f},{east+dx:.6f}'
    query='[out:json][timeout:35];way["highway"~"^('+ '|'.join(sorted(KINDS))+')$"]('+box+');out tags geom;'
    key=hashlib.sha256((ENDPOINT+query).encode()).hexdigest()
    with LOCK:
        CACHE.mkdir(exist_ok=True);file=CACHE/(key+'.json')
        if file.exists() and time.time()-file.stat().st_mtime<7*86400:
            try:return json.loads(file.read_text())
            except ValueError:pass
        with requests.post(ENDPOINT,data={'data':query},headers={'User-Agent':'TerrainWatch/1.0 (local Taiwan landslide screening prototype)'},timeout=(5,45),stream=True) as response:
            response.raise_for_status();chunks=[];size=0
            for chunk in response.iter_content(65536):
                size+=len(chunk)
                if size>32*1024*1024:raise ValueError('Road response exceeds prototype size limit; try a smaller area.')
                chunks.append(chunk)
        data=json.loads(b''.join(chunks))
        if data.get('remark') or not isinstance(data.get('elements'),list):raise ValueError('Road provider returned an incomplete response.')
        payload={'data':data,'fetched_at':datetime.now(timezone.utc).isoformat()}
        temp=file.with_suffix('.tmp');temp.write_text(json.dumps(payload));temp.replace(file)
        return payload

def annotate(geojson,bbox,payload):
    # Use the local UTM zone and actual polygon geometry, never degree distance.
    crs='EPSG:32650' if (bbox[0]+bbox[2])/2<120 else 'EPSG:32651'
    roads=[];projected=[]
    for way in payload['data']['elements']:
        tags=way.get('tags',{});kind=tags.get('highway')
        if way.get('type')!='way' or kind not in KINDS:continue
        try:
            coords=[(float(p['lon']),float(p['lat'])) for p in way['geometry']]
            if len(coords)<2 or not all(math.isfinite(x) and math.isfinite(y) and -180<=x<=180 and -90<=y<=90 for x,y in coords):continue
            geometry=mapping(LineString(coords));metric=shape(transform_geom('EPSG:4326',crs,geometry))
            if metric.is_empty or not metric.is_valid:continue
            roads.append({'type':'Feature','geometry':geometry,'properties':{'osm_id':int(way['id']),
                'name':tags.get('name') or tags.get('name:zh') or tags.get('ref') or 'Unnamed road',
                'ref':tags.get('ref'),'highway':kind}});projected.append(metric)
        except (KeyError,ValueError,TypeError):continue
    tree=STRtree(projected) if projected else None;selected={};near=0
    for f in geojson['features']:
        p=f['properties'];p.update({key:None for key in FIELDS});p['road_proximity_status']='not_found'
        if tree is None:continue
        polygon=shape(transform_geom('EPSG:4326',crs,f['geometry']))
        if not polygon.is_valid:polygon=polygon.buffer(0)
        if polygon.is_empty:continue
        index=int(tree.nearest(polygon));distance=float(polygon.distance(projected[index]))
        if distance>RADIUS_M:continue
        road=roads[index];r=road['properties'];selected[r['osm_id']]=road
        p.update(road_proximity_status='available',nearest_road_name=r['name'],nearest_road_ref=r['ref'],
            nearest_road_type=r['highway'],nearest_road_osm_id=r['osm_id'],road_distance_m=round(distance,1),near_road=distance<=NEAR_M)
        near+=distance<=NEAR_M
    return {'status':'available','search_radius_m':RADIUS_M,'near_threshold_m':NEAR_M,'near_count':int(near),
        'roads_searched':len(roads),'fetched_at':payload['fetched_at'],
        'osm_timestamp':payload['data'].get('osm3s',{}).get('timestamp_osm_base'),
        'source':'OpenStreetMap via Overpass','attribution':'© OpenStreetMap contributors · ODbL',
        'method':'Shortest projected distance from candidate polygon edge/interior to mapped road centerline. Zero means geometric intersection.',
        'limitations':'Proximity is not a blockage, impact or safety assessment. Road widths, access, current conditions and landslide runout are not modeled. OSM may omit roads; road data dates differ from satellite dates. Tracks are included; footpaths are excluded.',
        'geojson':{'type':'FeatureCollection','features':list(selected.values())}}

def analyze(geojson,bbox):
    if not geojson['features']:
        return {'status':'not_needed','message':'No candidates to check.','geojson':{'type':'FeatureCollection','features':[]}}
    try:return annotate(geojson,bbox,fetch(bbox))
    except Exception as exc:
        for f in geojson['features']:
            f['properties'].update({key:None for key in FIELDS});f['properties']['road_proximity_status']='unavailable'
        return {'status':'unavailable','message':'Road lookup unavailable; detections remain valid for review. '+str(exc)[:180],
            'search_radius_m':RADIUS_M,'geojson':{'type':'FeatureCollection','features':[]}}
