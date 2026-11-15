"""User-triggered Photon/OSM lookups, cached locally and serialized at <=1 request/s."""
import hashlib,json,math,os,threading,time
from pathlib import Path
import requests
from fastapi import HTTPException

BASE=os.environ.get('TERRAIN_GEOCODER_URL','https://photon.komoot.io').rstrip('/')
CACHE=Path(__file__).resolve().parent/'geocode_cache'
LOCK=threading.Lock();LAST=0.
WEST,SOUTH,EAST,NORTH=118.0,21.8,122.1,26.5

def in_bounds(lat,lon):return math.isfinite(lat) and math.isfinite(lon) and SOUTH<=lat<=NORTH and WEST<=lon<=EAST

def fetch(endpoint,params):
    global LAST
    key=hashlib.sha256(json.dumps([BASE,endpoint,params],sort_keys=True).encode()).hexdigest()
    with LOCK:
        CACHE.mkdir(exist_ok=True);file=CACHE/(key+'.json')
        if file.exists() and time.time()-file.stat().st_mtime<30*86400:
            try:return json.loads(file.read_text())
            except ValueError:pass
        time.sleep(max(0,1.05-(time.monotonic()-LAST)))
        try:
            LAST=time.monotonic()
            r=requests.get(BASE+'/'+endpoint,params=params,headers={'User-Agent':'TerrainWatch/1.0 (Taiwan satellite screening prototype)'},timeout=(5,25))
            r.raise_for_status();data=r.json()
            if not isinstance(data.get('features'),list):raise ValueError('Invalid place response')
        except (requests.RequestException,ValueError) as exc:
            raise HTTPException(503,'Place search is temporarily unavailable. Retry shortly; saved scan plans are unaffected.') from exc
        temp=file.with_suffix('.tmp');temp.write_text(json.dumps(data));temp.replace(file)
        return data

def matches(data):
    result=[];seen=set()
    for f in data.get('features',[]):
        try:
            p=f['properties'];lon,lat=map(float,f['geometry']['coordinates'])
            if p.get('countrycode','').upper()!='TW' or not in_bounds(lat,lon):continue
            typ=p['osm_type'];osm_id=int(p['osm_id'])
            if typ not in ['N','W','R']:continue
            key=f'{typ}{osm_id}'
            if key in seen:continue
            seen.add(key)
            names=list(dict.fromkeys(str(p[k]) for k in ['name','district','city','county','state'] if p.get(k)))
            result.append({'id':key,'name':p.get('name') or p.get('street') or 'Mapped location',
                'label':' · '.join(names),'lat':lat,'lon':lon,'kind':p.get('osm_value','place'),
                'layer':p.get('type','other'),'extent':p.get('extent'),
                'parents':[p[k] for k in ['district','city','county','state'] if p.get(k)],
                'source_url':f"https://www.openstreetmap.org/{ {'N':'node','W':'way','R':'relation'}[typ]}/{osm_id}"})
        except (KeyError,ValueError,TypeError):continue
    return result

def search(query,region_only=False):
    params={'q':query,'countrycode':'TW','bbox':f'{WEST},{SOUTH},{EAST},{NORTH}','limit':6}
    if region_only:params['layer']=['state','county','city','district','locality']
    found=matches(fetch('api/',params))
    if region_only:
        found=[p for p in found if p['kind'] in {'administrative','state','county','city','town','village','hamlet','district','municipality','borough','suburb','quarter','neighbourhood','locality','island'}]
    return found

def mountains(region):
    extent=region.get('extent')
    if not extent or len(extent)!=4:return []
    west,north,east,south=map(float,extent)
    params={'include':'osm.natural.peak','countrycode':'TW',
            'bbox':f'{max(WEST,west)},{max(SOUTH,south)},{min(EAST,east)},{min(NORTH,north)}','limit':10}
    found=matches(fetch('api/',params));normalize=lambda s:s.replace('台','臺').casefold()
    name=normalize(region['name'])
    # A rectangular search extent can include adjacent counties: require the
    # returned address hierarchy to identify the requested region as well.
    return [p for p in found if p['kind']=='peak' and any(normalize(parent)==name for parent in p['parents'])][:5]

def reverse(lat,lon):
    if not in_bounds(lat,lon):raise HTTPException(400,'Choose coordinates within Taiwan and its offshore islands.')
    found=matches(fetch('reverse',{'lat':lat,'lon':lon,'radius':15,'limit':5}))
    if not found:raise HTTPException(400,'No nearby Taiwan location could be verified. Choose a Taiwan place name or adjust the map point.')
    return {**found[0],'lat':lat,'lon':lon,'label':f'{lat:.6f}, {lon:.6f} (near {found[0]["label"]})'}

def suggested_width(place,regional=False):
    if regional:return 60
    extent=place.get('extent')
    if extent and len(extent)==4:
        west,north,east,south=map(float,extent)
        span=max(abs(north-south)*111.32,abs(east-west)*111.32*math.cos(math.radians(place['lat'])))
        return next((w for w in [6,12,24,36,60] if w>=span),60)
    return 6
