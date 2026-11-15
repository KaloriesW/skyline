"""Free weather forecasts with explicit time windows; never landslide probabilities."""
import csv,hashlib,json,math,threading,time
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
from datetime import datetime,timezone
from pathlib import Path
import requests

URL='https://api.met.no/weatherapi/locationforecast/2.0/compact'
CACHE=Path(__file__).resolve().parent/'weather_cache'
LOCK=threading.Lock();POINT_LOCKS={};GRID_JOBS={};GRID_LOCK=threading.Lock();REQUEST_LOCK=threading.Lock();LAST_REQUEST=0.
VARIABLES=['precipitation','precipitation_probability','temperature_2m','wind_speed_10m','cloud_cover','wind_from_direction']
LIMITATIONS='Weather-model forecasts, not observations or landslide probabilities. Regional samples can miss mountain rainfall extremes. Old satellite scars do not establish current slope condition. Follow official Taiwan warnings for safety decisions.'
FIELDS=['forecast_precipitation_24h_mm','forecast_peak_hourly_precipitation_mm','forecast_start','forecast_end','forecast_sample_latitude','forecast_sample_longitude']

def iso(timestamp):return datetime.fromtimestamp(timestamp,timezone.utc).isoformat()
def finite(v):return isinstance(v,(int,float)) and math.isfinite(v)

def canonical(raw):
    props=raw['properties'];units=props['meta']['units']
    if units.get('precipitation_amount')!='mm' or units.get('wind_speed')!='m/s' or units.get('air_temperature')!='celsius':raise ValueError('Unexpected weather units.')
    hourly={'time':[],**{k:[] for k in VARIABLES}}
    for row in props['timeseries']:
        t=datetime.fromisoformat(row['time'].replace('Z','+00:00')).timestamp()
        d=row['data'];instant=d.get('instant',{}).get('details',{});period=d.get('next_1_hours',{}).get('details',{})
        # Store precipitation at its interval END; instant values sample START.
        hourly['time'].append(t+3600)
        hourly['precipitation'].append(period.get('precipitation_amount'))
        hourly['precipitation_probability'].append(period.get('probability_of_precipitation'))
        hourly['temperature_2m'].append(instant.get('air_temperature'))
        wind=instant.get('wind_speed');hourly['wind_speed_10m'].append(wind*3.6 if finite(wind) else None)
        hourly['cloud_cover'].append(instant.get('cloud_area_fraction'))
        hourly['wind_from_direction'].append(instant.get('wind_from_direction'))
    lon,lat=raw['geometry']['coordinates'][:2]
    return {'latitude':lat,'longitude':lon,'issued_at':props['meta']['updated_at'],'hourly':hourly,
            'hourly_units':{'time':'unixtime','precipitation':'mm','precipitation_probability':'%','temperature_2m':'°C','wind_speed_10m':'km/h'}}

def fetch_point(point):
    key=tuple(round(x,4) for x in point)
    with LOCK:lock=POINT_LOCKS.setdefault(key,threading.Lock())
    with lock:return _fetch_point(point)

def _fetch_point(point):
    global LAST_REQUEST
    params={'lat':round(point[0],4),'lon':round(point[1],4)}
    key=hashlib.sha256(json.dumps({'schema':2,**params},sort_keys=True).encode()).hexdigest()
    CACHE.mkdir(exist_ok=True);file=CACHE/(key+'.json');old=None
    if file.exists():
        try:
            old=json.loads(file.read_text())
            if time.time()<old['expires_at']:return old
        except (ValueError,KeyError):old=None
    headers={'User-Agent':'TerrainWatch/1.0 (local educational Taiwan satellite screening prototype)'}
    if old and old.get('last_modified'):headers['If-Modified-Since']=old['last_modified']
    with REQUEST_LOCK:
        time.sleep(max(0,.3-(time.monotonic()-LAST_REQUEST)));LAST_REQUEST=time.monotonic()
    response=requests.get(URL,params=params,headers=headers,timeout=(5,20));response.raise_for_status()
    expiry=time.time()+3*3600
    try:expiry=max(expiry,parsedate_to_datetime(response.headers['Expires']).timestamp())
    except (KeyError,ValueError,TypeError):pass
    data=old['data'] if response.status_code==304 and old else canonical(response.json())
    payload={'data':data,'fetched_at':iso(time.time()),'expires_at':expiry,'last_modified':response.headers.get('Last-Modified',old.get('last_modified') if old else None)}
    temp=file.with_suffix('.tmp');temp.write_text(json.dumps(payload));temp.replace(file)
    return payload

def summarize(raw,point,anchor):
    units=raw.get('hourly_units',{})
    if units.get('precipitation')!='mm' or units.get('time')!='unixtime':raise ValueError('Unexpected forecast units.')
    hourly=raw.get('hourly',{});times=hourly.get('time',[])
    rows=[]
    for index,t in enumerate(times):
        # Accumulated precipitation at t describes the preceding hour.
        if not finite(t) or not anchor<t<=anchor+48*3600:continue
        row={'time':iso(t)}
        for key in VARIABLES:
            values=hourly.get(key,[]);v=values[index] if index<len(values) else None
            row[key]=v if finite(v) else None
        rows.append(row)
    expected=[iso(anchor+i*3600) for i in range(1,49)]
    lookup={r['time']:r for r in rows}
    rows=[lookup.get(t,{'time':t,**{k:None for k in VARIABLES}}) for t in expected]
    def aggregate(key,hours,operation):
        values=[r[key] for r in rows[:hours]]
        if len(values)!=hours or any(v is None for v in values):return None
        return round(operation(values),1)
    out={'requested_latitude':point[0],'requested_longitude':point[1],
         'model_latitude':raw.get('latitude'),'model_longitude':raw.get('longitude'),
         'precipitation_6h_mm':aggregate('precipitation',6,sum),
         'precipitation_24h_mm':aggregate('precipitation',24,sum),
         'precipitation_48h_mm':aggregate('precipitation',48,sum),
         'peak_hourly_precipitation_24h_mm':aggregate('precipitation',24,max),
         'max_hourly_precipitation_probability_24h_percent':aggregate('precipitation_probability',24,max),
         'temperature_min_24h_c':aggregate('temperature_2m',24,min),
         'temperature_max_24h_c':aggregate('temperature_2m',24,max),
         'wind_max_24h_kmh':aggregate('wind_speed_10m',24,max),
         'hourly':rows}
    if units.get('temperature_2m')!='°C':out['temperature_min_24h_c']=out['temperature_max_24h_c']=None
    if units.get('wind_speed_10m')!='km/h':out['wind_max_24h_kmh']=None
    if units.get('precipitation_probability')!='%':out['max_hourly_precipitation_probability_24h_percent']=None
    return out

def collect(points,progress=None):
    anchor=int(time.time()//3600)*3600;output=[];fetched=[];errors=[]
    def get(point):
        try:
            payload=fetch_point(point)
            p=summarize(payload['data'],point,anchor);p['issued_at']=payload['data'].get('issued_at')
            return p,payload['fetched_at'],None
        except (requests.RequestException,ValueError,KeyError,TypeError) as exc:return None,None,str(exc)[:150]
    # Per-point locks deduplicate concurrent collections; HTTP calls are paced globally.
    with ThreadPoolExecutor(max_workers=4) as pool:
        for p,t,error in pool.map(get,points):
            output.append(p)
            if t:fetched.append(t)
            if error:errors.append(error)
            if progress:progress(len(output),len(points))
    available=[p for p in output if p and p['precipitation_24h_mm'] is not None]
    return {'status':'available' if len(available)==len(points) else 'partial' if available else 'unavailable',
            'source':'MET Norway · Locationforecast','source_url':'https://www.met.no/',
            'model':'ECMWF IFS via MET Norway','model_resolution_km':9,'license':'CC BY 4.0','fetched_at':min(fetched) if fetched else iso(time.time()),
            'forecast_start':iso(anchor),'forecast_end':iso(anchor+48*3600),'timezone':'Asia/Taipei',
            'points':output,'available_points':len(available),'requested_points':len(points),
            'limitations':LIMITATIONS,'errors':errors}

def area_forecast(lat,lon,width_km):
    dy=width_km/2/111.32;dx=dy/math.cos(math.radians(lat))
    if width_km<=12:
        points=[(lat,lon),(lat-dy,lon-dx),(lat-dy,lon+dx),(lat+dy,lon-dx),(lat+dy,lon+dx)]
    else:
        spec=grid_spec(lon-dx,lat-dy,lon+dx,lat+dy)
        points=[(lat,lon)]+spec['points']
    w=collect(points);w['summary']=summary(w);return w

def summary(w):
    points=[p for p in w.get('points',[]) if p and p.get('precipitation_24h_mm') is not None]
    if not points:return 'Weather forecast unavailable. No rainfall or landslide prediction is inferred from missing data.'
    rain=[p['precipitation_24h_mm'] for p in points]
    peak=[p['peak_hourly_precipitation_24h_mm'] for p in points if p.get('peak_hourly_precipitation_24h_mm') is not None]
    text=f"Forecast precipitation over the next 24 hours: {min(rain):g}–{max(rain):g} mm across {len(points)} available sample locations."
    if peak:text+=f" Highest forecast hourly precipitation among samples: {max(peak):g} mm."
    return text+' This is rainfall context, not a prediction that a particular slope will fail.'

def grid_spec(west,south,east,north):
    values=[west,south,east,north]
    if not all(finite(x) for x in values) or west>=east or south>=north:raise ValueError('Invalid weather bounds.')
    west=max(118.,west);east=min(122.5,east);south=max(21.5,south);north=min(26.5,north)
    if west>=east or south>=north:raise ValueError('Pan the map to Taiwan for weather data.')
    # Keep native-scale samples for local views. Overview requests are bounded.
    for step in [.1,.2,.25,.4,.5]:
        x0=math.floor((west+1e-8)/step);x1=math.ceil((east-1e-8)/step)
        y0=math.floor((south+1e-8)/step);y1=math.ceil((north-1e-8)/step)
        if (x1-x0+1)*(y1-y0+1)<=256:break
    xs=[round(i*step,4) for i in range(x0,x1+1)];ys=[round(i*step,4) for i in range(y0,y1+1)]
    return {'step':step,'nx':len(xs),'ny':len(ys),'bbox':[xs[0],ys[0],xs[-1],ys[-1]],'points':[(y,x) for y in ys for x in xs]}

def dense_grid(spec,progress=None):
    w=collect(spec['points'],progress)
    # Preserve row-major slots (including failures), so no interpolation spans a hole.
    w.update(grid_step_degrees=spec['step'],nx=spec['nx'],ny=spec['ny'],bbox=spec['bbox'],
        map_note='Forecast samples; smooth shading is interpolation. Model resolution about 9 km. Missing samples are unassessed.')
    return w

def start_grid(west,south,east,north):
    spec=grid_spec(west,south,east,north)
    key=hashlib.sha256(json.dumps([spec['bbox'],spec['step'],int(time.time()//10800)]).encode()).hexdigest()[:24]
    with GRID_LOCK:
        if key in GRID_JOBS:
            old=GRID_JOBS[key]
            if old['state']=='failed' or old.get('result',{}).get('status')=='unavailable':del GRID_JOBS[key]
            else:return {'id':key,'state':old['state']}
        # Bound parallel whole-map work and accumulated in-memory responses.
        if any(j['state']=='running' for j in GRID_JOBS.values()):return {'state':'busy'}
        for k in list(GRID_JOBS):
            if time.time()-GRID_JOBS[k]['created_at']>10800:del GRID_JOBS[k]
        while len(GRID_JOBS)>12:del GRID_JOBS[next(iter(GRID_JOBS))]
        GRID_JOBS[key]={'id':key,'state':'running','completed':0,'total':len(spec['points']),'created_at':time.time()}
    def run():
        try:
            def progress(done,total):GRID_JOBS[key].update(completed=done,total=total)
            result=dense_grid(spec,progress);GRID_JOBS[key].update(state='completed',result=result)
        except Exception as exc:GRID_JOBS[key].update(state='failed',message=str(exc)[:200])
    threading.Thread(target=run,daemon=True).start()
    return {'id':key,'state':'running'}

def taiwan_grid():
    return dense_grid(grid_spec(120,21.8,122.3,25.5))

def attach(result,w):
    result['weather']=w
    result['weather']['satellite_acquired']=result['acquired']
    valid=[p for p in w.get('points',[]) if p and p.get('precipitation_24h_mm') is not None]
    for f in result['geojson']['features']:
        p=f['properties'];p.update({key:None for key in FIELDS})
        if not valid:continue
        closest=min(valid,key=lambda q:(q['requested_latitude']-p['latitude'])**2+((q['requested_longitude']-p['longitude'])*math.cos(math.radians(p['latitude'])))**2)
        p.update(forecast_precipitation_24h_mm=closest['precipitation_24h_mm'],
            forecast_peak_hourly_precipitation_mm=closest['peak_hourly_precipitation_24h_mm'],
            forecast_start=w['forecast_start'],forecast_end=iso(datetime.fromisoformat(w['forecast_start']).timestamp()+24*3600),
            forecast_sample_latitude=closest['requested_latitude'],forecast_sample_longitude=closest['requested_longitude'])
    return result

def save(directory,w):
    temp=directory/'forecast.tmp';temp.write_text(json.dumps(w,indent=2));temp.replace(directory/'forecast.json')
    fields=['sample_latitude','sample_longitude','hour_end_utc']+VARIABLES
    temp=directory/'forecast-csv.tmp'
    with temp.open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
        for point in w.get('points',[]):
            if not point:continue
            for r in point.get('hourly',[]):writer.writerow({'sample_latitude':point['requested_latitude'],'sample_longitude':point['requested_longitude'],'hour_end_utc':r['time'],**{k:r[k] for k in VARIABLES}})
    temp.replace(directory/'forecast.csv')
