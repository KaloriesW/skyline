"""Resumable, serialized Taiwan imagery watch. Priorities are screening, not hazard predictions."""
import copy,hashlib,json,math,threading,time,uuid,shutil
from datetime import datetime,timezone,timedelta
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse
from fastapi import HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from shapely.geometry import shape,box,Point,mapping
from shapely.ops import unary_union
import weather

HERE=Path(__file__).resolve().parent
STATE=HERE/'national_monitor.json'
REPORTS=HERE/'national_reports'
LOCK=threading.RLock()
STOP=threading.Event()
INTERVAL=900
RULES={'rain_24h_mm':80,'peak_hour_mm':20,'near_road_m':200,
       'note':'Experimental review rules, not CWA warning thresholds or calibrated landslide risk. Wind and temperature are context, not slope-failure predictors.'}

def iso(t=None):return datetime.fromtimestamp(time.time() if t is None else t,timezone.utc).isoformat()

@lru_cache(maxsize=1)
def grid():
    data=json.loads((HERE/'static/taiwan-monitor-boundary.geojson').read_text())
    counties=[(f['properties']['name'],shape(f['geometry']).buffer(.001)) for f in data['features']]
    land=unary_union([g for _,g in counties]);cells=[]
    for y in range(218,265):
        for x in range(1180,1221):
            b=box(x/10,y/10,(x+1)/10,(y+1)/10)
            if not land.intersects(b):continue
            cells.append({'id':f'{x}-{y}','lat':(y+.5)/10,'lon':(x+.5)/10,'width_km':12,
                          'bbox':list(b.bounds),'counties':[n for n,g in counties if g.intersects(b)]})
    return cells

@lru_cache(maxsize=1)
def land_shape():
    data=json.loads((HERE/'static/taiwan-monitor-boundary.geojson').read_text())
    return unary_union([shape(f['geometry']).buffer(.001) for f in data['features']])

def read():
    with LOCK:
        if STATE.exists():return json.loads(STATE.read_text())
        return {'enabled':False,'message':'Whole-Taiwan mode is paused. Preview coverage before starting.',
                'queue':[],'seen':{},'latest':{},'failed':{},'active':None,'weather':{}}

def write(s):
    tmp=STATE.with_suffix('.tmp');tmp.write_text(json.dumps(s,ensure_ascii=False));tmp.replace(STATE)

def mutate(**fields):
    with LOCK:
        s=read();s.update(fields);write(s)


def rank_candidate(p,forecast,now=None):
    """Missing/stale forecasts never count as zero rainfall or as evidence of safety."""
    now=time.time() if now is None else now
    f=forecast or {};fresh=now-f.get('collected_epoch',0)<6*3600
    rain=f.get('precipitation_24h_mm') if fresh else None
    peak=f.get('peak_hourly_precipitation_24h_mm') if fresh else None
    heavy=(rain is not None and rain>=RULES['rain_24h_mm']) or (peak is not None and peak>=RULES['peak_hour_mm'])
    support=sum(p.get(k)=='supports' for k in ['vegetation_check','slope_check'])
    road=p.get('road_distance_m');near=p.get('road_proximity_status')=='available' and road is not None and 0<=road<=200
    label='Priority review · rain + supporting evidence' if heavy and support else 'Rain-exposed candidate' if heavy else 'Evidence-led review' if support else 'Uncorroborated candidate'
    reasons=[]
    if heavy:reasons.append('Forecast rain exceeds the experimental screening threshold')
    if support:reasons.append(f'{support}/2 vegetation/slope checks support review')
    if near:reasons.append('Within 200 m of a mapped road; condition unknown')
    if rain is None:reasons.append('Current complete rainfall forecast unavailable; risk is not inferred')
    return {'priority':label,'review_score':(100 if heavy else 0)+support*20+(10 if near else 0),
            'reasons':reasons,'weather_fresh':fresh,'rain_24h_mm':rain,'peak_hour_mm':peak,
            'wind_max_24h_kmh':f.get('wind_max_24h_kmh') if fresh else None,
            'temperature_min_24h_c':f.get('temperature_min_24h_c') if fresh else None,
            'temperature_max_24h_c':f.get('temperature_max_24h_c') if fresh else None,
            'rain_48h_mm':f.get('precipitation_48h_mm') if fresh else None,
            'forecast_start':f.get('forecast_start'),'forecast_end':f.get('forecast_end'),
            'weather_issued_at':f.get('issued_at'),'weather_source':'MET Norway · ECMWF IFS (~9 km)'}


def candidates(s,now=None):
    rows=[]
    for cell_id,scan in s.get('latest',{}).items():
        for p in scan.get('candidates',[]):
            rows.append({**p,**rank_candidate(p,s.get('weather',{}).get(cell_id),now),
                         'scan_id':scan['scan_id'],'image_date':scan['acquired'],'cell_id':cell_id})
    return sorted(rows,key=lambda p:(-p['review_score'],-p.get('area_m2',0)))


def public_state(s=None):
    s=read() if s is None else s;now=time.time();rows=candidates(s,now)
    queued={q['cell_id'] for q in s.get('queue',[])};active=s.get('active')
    cells=[]
    for cell in grid():
        latest=s.get('latest',{}).get(cell['id']);failed=s.get('failed',{}).get(cell['id'])
        status='scanning' if active and active['cell_id']==cell['id'] else 'queued' if cell['id'] in queued else 'failed' if failed else 'partial' if latest and latest.get('usable_percent',0)<99.9 else 'completed' if latest else 'unassessed'
        cells.append({**cell,'status':status,'latest_scan':latest['scan_id'] if latest else None,
                      'image_date':latest.get('acquired') if latest else None,'usable_percent':latest.get('usable_percent') if latest else None,
                      'failure':failed.get('message') if failed else None,
                      'forecast':rank_candidate({},s.get('weather',{}).get(cell['id']),now)})
    return {'enabled':s['enabled'],'message':s.get('message'),'last_checked':s.get('last_checked'),
            'next_check':s.get('next_check'),'weather_updated':s.get('weather_updated'),'weather_error':s.get('weather_error'),
            'catalogue_error':s.get('catalogue_error'),'queue_count':len(s.get('queue',[])),
            'active':active,'total_cells':len(cells),'cells_with_results':len(s.get('latest',{})),
            'failed_cells':len(s.get('failed',{})),'candidate_count':sum(x.get('candidate_count',0) for x in s.get('latest',{}).values()),
            'listed_candidate_count':len(rows),'priority_count':sum(r['priority'].startswith('Priority review') for r in rows),
            'candidates':rows[:50],'cells':cells,'weather_watch':sorted([c for c in cells if c['forecast']['priority']=='Rain-exposed candidate'],key=lambda c:-(c['forecast']['rain_24h_mm'] or 0))[:20],'rules':RULES,
            'last_report':s.get('last_report'),
            'coverage_note':'Approximate land grid for Taiwan main island, Penghu, Kinmen, Matsu and mapped islands within 118–122.1 E / 21.8–26.5 N. Outside-map offshore territories are excluded. A cell with results is not fully assessed: clouds and missing inputs remain unassessed. Results have different acquisition dates. The catalogue checks a rolling 14-day window; longer offline gaps are not automatically backfilled.',
            'limitations':'Review priorities are not confirmed critical hazards, forecasts of landslide failure, or official warnings. No actual antecedent rainfall, soil moisture, or validated climate susceptibility model is included. Temperature and wind are context only.'}


def catalogue(backend):
    end=datetime.now(timezone.utc);start=end-timedelta(days=14)
    params={'collections':backend.COLLECTION,'bbox':'118,21.8,122.1,26.5',
            'datetime':start.isoformat()+'/'+end.isoformat(),'limit':100}
    url=backend.CATALOG+'/search';items=[];pages=0
    while url:
        if urlparse(url).netloc!=urlparse(backend.CATALOG).netloc:raise ValueError('Unexpected catalogue page host')
        data=backend.get_json(url,params=params);items.extend(data.get('features',[]));pages+=1
        nxt=next((link for link in data.get('links',[]) if link.get('rel')=='next'),None)
        if not nxt:break
        if pages>=30:raise ValueError('Catalogue pagination limit reached; coverage incomplete. Retrying later.')
        if nxt.get('method','GET')!='GET':raise ValueError('Unsupported catalogue pagination; coverage incomplete')
        url=nxt['href'];params=None
    return [f for f in items if 'visual' in f.get('assets',{}) and 'scl' in f.get('assets',{})]


def enqueue(s,items):
    """One mosaic pass per cell; fingerprint changes when an intersecting source updates."""
    footprints=[(f,shape(f['geometry'])) for f in items]
    added=[];all_keys=[];existing={q['key'] for q in s['queue']}
    if s.get('active'):existing.add(s['active']['key'])
    for cell in grid():
        groups={};footprint=box(*cell['bbox'])
        for item,geometry in footprints:
            if not footprint.intersects(geometry):continue
            p=item['properties'];group=(p['datetime'][:10],p.get('platform',item['id'][:3]),p.get('sat:relative_orbit',''))
            groups.setdefault(group,[]).append(item)
        jobs=[]
        for sources in groups.values():
            sources.sort(key=lambda f:(-shape(f['geometry']).intersection(footprint).area,f['id']))
            signature=sorted((f['id'],f['properties'].get('updated','')) for f in sources)
            key=hashlib.sha256(json.dumps([cell['id'],signature]).encode()).hexdigest()
            all_keys.append(key)
            jobs.append({'key':key,'cell_id':cell['id'],'scene_id':sources[0]['id'],
                         'acquired':sources[0]['properties']['datetime'],'attempts':0,'retry_after':0})
        jobs.sort(key=lambda q:q['acquired'],reverse=True)
        if not s.get('initialized'):jobs=jobs[:1]
        for job in jobs:
            if job['key'] not in s['seen'] and job['key'] not in existing:added.append(job);existing.add(job['key'])
    if not s.get('initialized'):
        selected={q['key'] for q in added}
        for key in all_keys:
            if key not in selected:s['seen'][key]='baseline older acquisition'
    s['queue'].extend(added);s['initialized']=True
    s['last_checked']=iso();s['next_check']=time.time()+INTERVAL;s['catalogue_error']=None
    s['message']=f'Catalogue checked. {len(added)} new cell/pass jobs queued; {len(s["queue"])} waiting.'
    return s


def refresh_forecasts():
    cells=grid();w=weather.collect([(c['lat'],c['lon']) for c in cells]);out={}
    for cell,p in zip(cells,w['points']):
        if p:out[cell['id']]={k:v for k,v in p.items() if k!='hourly'}|{'forecast_start':w['forecast_start'],
                         'forecast_end':iso(datetime.fromisoformat(w['forecast_start']).timestamp()+86400),'collected_epoch':time.time()}
    return out,w


def summarize_result(cell,result):
    b=cell['bbox'];land=land_shape();rows=[]
    for feature in result['geojson']['features']:
        p=feature['properties'];lat=p['latitude'];lon=p['longitude']
        # Unique ownership by review point prevents overlap duplicates across scan squares.
        if b[0]<=lon<b[2] and b[1]<=lat<b[3] and land.covers(Point(lon,lat)):
            rows.append({k:p.get(k) for k in ['id','latitude','longitude','area_m2','confidence','vegetation_check','slope_check','ndvi_drop','slope_median_deg','road_distance_m','road_proximity_status','nearest_road_name']})
    rows.sort(key=lambda p:(-sum(p.get(k)=='supports' for k in ['vegetation_check','slope_check']),-(10 if p.get('road_proximity_status')=='available' and p.get('road_distance_m') is not None and 0<=p['road_distance_m']<=200 else 0),-p['area_m2']))
    return {'scan_id':result['id'],'acquired':result['acquired'],'created_at':result['created_at'],
            'usable_percent':result['usable_percent'],'imagery_coverage_percent':result['imagery_coverage_percent'],
            'candidate_count':len(rows),'candidates':rows[:20]}


def save_report(s):
    now=time.time()
    if now<s.get('next_report',0):return
    view=public_state(s);view.pop('cells');view['created_at']=iso();view['id']=uuid.uuid4().hex
    REPORTS.mkdir(exist_ok=True);p=REPORTS/(view['id']+'.json');tmp=p.with_suffix('.tmp')
    tmp.write_text(json.dumps(view,ensure_ascii=False,indent=2));tmp.replace(p)
    s['last_report']=view['id'];s['next_report']=now+3600
    for old in sorted(REPORTS.glob('*.json'),key=lambda p:p.stat().st_mtime,reverse=True)[168:]:old.unlink()


def tick(backend):
    s=read();now=time.time()
    active=s.get('active')
    if active:
        try:job=backend.scan_status(active['job_id'])
        except HTTPException:job={'state':'failed','message':'Interrupted scan; retry queued after restart.'}
        if job['state']!='running':
            with LOCK:
                s=read();s['active']=None
                if job['state']=='completed':
                    cell=next(c for c in grid() if c['id']==active['cell_id']);result=job['result']
                    previous=s['latest'].get(cell['id'])
                    if not previous or result['acquired']>=previous['acquired']:s['latest'][cell['id']]=summarize_result(cell,result)
                    s['seen'][active['key']]='completed';s['failed'].pop(cell['id'],None)
                else:
                    active['attempts']+=1;active['retry_after']=now+INTERVAL;active.pop('job_id',None)
                    s['failed'][active['cell_id']]={'message':job.get('message','Scan failed'),'at':iso()}
                    if active['attempts']<3 and 'Less than 2%' not in job.get('message',''):s['queue'].append(active)
                    else:s['seen'][active['key']]='failed / unassessed'
                write(s)
    s=read()
    if not s['enabled']:return
    if now>=s.get('next_check',0):
        try:
            items=catalogue(backend)
            with LOCK:s=enqueue(read(),items);write(s)
        except Exception as exc:mutate(catalogue_error=str(exc)[:300],next_check=now+INTERVAL,message='Catalogue unavailable; coverage is incomplete. Will retry.')
    s=read()
    if not s['enabled']:return
    if now>=s.get('next_weather',0):
        try:
            mutate(message='Refreshing regional rainfall, wind and temperature forecasts…')
            forecasts,w=refresh_forecasts()
            mutate(weather=forecasts,weather_updated=iso(),next_weather=now+3600,
                   weather_error=None if w['status']=='available' else 'Some forecasts unavailable; missing values do not mean low risk.')
        except Exception as exc:mutate(weather_error=str(exc)[:300],next_weather=now+900)
    with LOCK:
        s=read()
        if not s['enabled']:return
        save_report(s);write(s)
        if s.get('active') or backend.ACTIVE.locked():return
        # A manually selected area watch retains priority over the bulk queue.
        area_watch=backend.read_watch()
        if area_watch.get('active_job') or (area_watch.get('enabled') and time.time()>=area_watch.get('next_check',0)):return
        available=[q for q in s['queue'] if q.get('retry_after',0)<=time.time()]
        if not available:return
        def order(q):
            f=s.get('weather',{}).get(q['cell_id'],{});rain=f.get('precipitation_24h_mm')
            return (-(rain if rain is not None else -1),q['acquired'],q['cell_id'])
        if shutil.disk_usage(backend.RESULTS).free<10*1024**3:
            s['enabled']=False;s['message']='Paused: less than 10 GiB free disk space. Free space before resuming.';write(s);return
        task=min(available,key=order);cell=next(c for c in grid() if c['id']==task['cell_id'])
        try:job=backend.start_scan(backend.Scan(lat=cell['lat'],lon=cell['lon'],width_km=12,scene_id=task['scene_id'],model='unet13'))
        except HTTPException as exc:
            s['message']=str(exc.detail);write(s);return
        s['queue'].remove(task);s['active']={**task,'job_id':job['id']};s['message']=f'Scanning {cell["id"]} · {", ".join(cell["counties"])}. {len(s["queue"])} jobs waiting.';write(s)


class Control(BaseModel):
    enabled:bool


def register(api,backend):
    @api.get('/api/national/plan')
    def plan():
        import scan_assistant
        estimate=scan_assistant.estimate(12,'unet13',backend.RESULTS)
        return {'cells':grid(),'total_cells':len(grid()),'cell_scan_width_km':12,'interval_minutes':15,
                'per_cell_estimate':estimate,'estimated_initial_hours':[round(len(grid())*estimate[k]/60,1) for k in ['min_minutes','max_minutes']],
                'free_disk_gib':round(shutil.disk_usage(backend.RESULTS).free/1024**3,1),'storage_note':'Hundreds of native-resolution scans can use tens of GB. Pauses automatically below 10 GiB free; no existing results are deleted.',
                'note':'Serial full-resolution scans. Initial coverage may take many hours or days; the queue resumes after restart. Preview is approximate land coverage, not proof of usable imagery.'}

    @api.get('/api/national')
    def status():return public_state()

    @api.post('/api/national')
    def configure(request:Control):
        if request.enabled and not any(m['id']=='unet13' and m['available'] for m in backend.model_list()):raise HTTPException(409,'The trained U-Net is unavailable.')
        with LOCK:
            s=read();s['enabled']=request.enabled
            s['message']='Whole-Taiwan monitoring enabled; checking new imagery.' if request.enabled else 'Whole-Taiwan monitoring paused. Any active scan finishes.'
            if request.enabled:s['next_check']=0;s['next_report']=0
            write(s)
        return public_state(s)

    @api.get('/api/national/report/{report_id}')
    def report(report_id:str):
        import re
        if not re.fullmatch('[a-f0-9]{32}',report_id):raise HTTPException(404)
        p=REPORTS/(report_id+'.json')
        if not p.exists():raise HTTPException(404)
        return Response(report_text(json.loads(p.read_text())),media_type='text/plain',headers={'Content-Disposition':'attachment; filename="taiwan-monitor-report.txt"'})

    @api.on_event('startup')
    def start():
        STOP.clear()
        def loop():
            while not STOP.wait(10):
                try:tick(backend)
                except Exception as exc:
                    import traceback
                    traceback.print_exc();mutate(message='National monitor error; will retry: '+str(exc)[:200])
        threading.Thread(target=loop,daemon=True).start()

    @api.on_event('shutdown')
    def stop():STOP.set()


def assistant_context():
    view=public_state()
    return {k:v for k,v in view.items() if k not in ['cells','candidates','weather_watch']}|{'candidates':view['candidates'][:5]}


def assistant_answer(question,context):
    import re
    if not re.search(r'whole.?taiwan|national|all (?:of )?taiwan|全台',question,re.I):return None
    lines=[f"Whole-Taiwan monitoring is {'on' if context['enabled'] else 'paused'}. {context['cells_with_results']}/{context['total_cells']} planning cells have saved results; {context['queue_count']} scan jobs are waiting. Clouds and missing pixels remain unassessed."]
    if context['last_checked']:lines.append('Last imagery check: '+context['last_checked'])
    for row in context.get('candidates',[])[:3]:
        rain='unavailable' if row['rain_24h_mm'] is None else f"{row['rain_24h_mm']} mm"
        lines.append(f"{row['priority']}: {row['latitude']:.6f}, {row['longitude']:.6f} (cell {row['cell_id']}, candidate {row['id']}). Image {row['image_date']}; forecast 24 h rain {rain}, starting {row['forecast_start'] or 'unavailable'}.")
    if not context.get('candidates'):lines.append('There are no national candidate results yet. Use Whole-Taiwan watch → Preview coverage → Start whole-Taiwan monitoring to begin.')
    lines.append('These are review priorities, not confirmed critical hazards or landslide probabilities. I have not changed monitoring.')
    return '\n'.join(lines)


def report_text(r):
    lines=['Terrain Watch — whole-Taiwan monitoring report', 'Created (UTC): '+r['created_at'],
           f"{r['cells_with_results']}/{r['total_cells']} planning cells with saved results; {r['queue_count']} queued passes; {r['failed_cells']} cells with failed latest attempts.",
           f"{r['candidate_count']} candidate points within mapped land. Showing {len(r['candidates'])} retained review candidates below.",
           'Catalogue check: '+str(r.get('last_checked') or 'not yet checked'),
           'Weather context refreshed: '+str(r.get('weather_updated') or 'not yet retrieved'),
           'Status: '+str(r.get('message')),'',r['coverage_note'],'',r['limitations'],'',
           'Rain watch (may include unscanned cells):']
    for c in r.get('weather_watch',[]):
        f=c['forecast'];lines.append(f"Cell {c['id']} ({', '.join(c['counties'])}), {c['status']}: {f['rain_24h_mm']} mm / 24 h; peak {f['peak_hour_mm']} mm/hour. Forecast starts {f['forecast_start']}.")
    lines.extend(['','Review priorities — not confirmed critical hazards:'])
    for p in r['candidates']:
        lines.append(f"{p['priority']} | {p['latitude']:.6f}, {p['longitude']:.6f} | cell {p['cell_id']}, candidate {p['id']} | image {p['image_date']} | {(p['area_m2']/10000):.2f} ha")
        lines.append(f"24 h rain {p['rain_24h_mm']} mm; 48 h rain {p['rain_48h_mm']} mm; peak {p['peak_hour_mm']} mm/hour; wind {p['wind_max_24h_kmh']} km/h; temperature {p['temperature_min_24h_c']} to {p['temperature_max_24h_c']} C.")
        lines.append(f"Forecast {p['forecast_start']} → {p['forecast_end']}. "+'; '.join(p['reasons']))
    lines.extend(['','None = unavailable, never zero. Image dates and forecast dates differ.',
                  'Rules: experimental 80 mm/24 h or 20 mm/hour plus supporting evidence; not official warning thresholds.',
                  'Sources: Copernicus Sentinel-2 via Earth Search; MET Norway / ECMWF (CC BY 4.0); g0v/twgeojson (CC0).'])
    return '\n'.join(lines)+'\n'
