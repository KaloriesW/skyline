import time
from types import SimpleNamespace as NS
import pytest
from shapely.geometry import box,mapping,Point
from fastapi.testclient import TestClient
import national_monitor as n
import app
C={'id':'1210-240','lat':24.05,'lon':121.05,'width_km':12,'bbox':[121,24,121.1,24.1],'counties':['test']}
def isolate(m,p):
 m.setattr(n,'STATE',p/'state.json');m.setattr(n,'REPORTS',p/'reports');m.setattr(n,'grid',lambda:[C]);m.setattr(n,'land_shape',lambda:box(*C['bbox']))
def scene(id='S2A_one_L2A',day='2026-11-15',updated=''):
 return {'id':id,'geometry':mapping(box(121,24,121.2,24.2)),'properties':{'datetime':day+'T02:00:00Z','platform':'sentinel-2a','updated':updated},'assets':{'visual':{},'scl':{}}}
def test_grid_covers_mainland_and_outlying_islands():
 cells=n.grid();assert len(cells)>300
 for lon,lat in [(121.56,25.03),(121.60,23.99),(119.57,23.57),(118.32,24.43),(119.94,26.16)]:assert any(box(*c['bbox']).covers(Point(lon,lat)) for c in cells)
 for c in cells:assert box(*app.Area(lat=c['lat'],lon=c['lon'],width_km=12).bbox()).covers(box(*c['bbox']))
def test_initial_latest_and_new_fingerprint_dedup(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);items=[scene(),scene('S2A_old_L2A','2026-11-10')];s=n.enqueue(n.read(),items);assert len(s['queue'])==1
 s=n.enqueue(s,items);assert len(s['queue'])==1
 first=s['queue'].pop();s['seen'][first['key']]='completed'
 s=n.enqueue(s,items+[scene('S2B_new_L2A','2026-11-16')]);assert len(s['queue'])==1
 s=n.enqueue(s,items+[scene('S2B_new_L2A','2026-11-16','changed')]);assert len(s['queue'])==2
 assert len(n.enqueue(n.read(),[scene('S2A_tile1_L2A'),scene('S2A_tile2_L2A')])['queue'])==1
def test_unknown_and_stale_weather_not_zero_or_high_risk():
 p={'vegetation_check':'supports','slope_check':'supports'}
 assert n.rank_candidate(p,{},10000)['rain_24h_mm'] is None
 r=n.rank_candidate(p,{'collected_epoch':1,'precipitation_24h_mm':500},100000)
 assert r['priority']=='Evidence-led review' and r['rain_24h_mm'] is None
 assert n.rank_candidate(p,{'collected_epoch':10000,'precipitation_24h_mm':80},10000)['priority'].startswith('Priority review')
 assert n.rank_candidate({}, {'collected_epoch':10000,'precipitation_24h_mm':100},10000)['priority']=='Rain-exposed candidate'
def test_overlap_ownership(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);p={'id':7,'latitude':24.05,'longitude':121.05,'area_m2':1000,'confidence':.5}
 r={'id':'a'*32,'acquired':'2026-11-15','created_at':'2026-11-16','usable_percent':90,'imagery_coverage_percent':100,'geojson':{'features':[{'properties':p},{'properties':p|{'id':8,'longitude':121.15}}]}}
 result=n.summarize_result(C,r);assert result['candidate_count']==1 and result['candidates'][0]['id']==7
def test_busy_scanner_and_paused_do_not_start_jobs(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);s=n.enqueue(n.read(),[scene()]);s.update(enabled=True,next_check=time.time()+1000,next_weather=time.time()+1000);n.write(s)
 b=NS(ACTIVE=NS(locked=lambda:True));n.tick(b);assert len(n.read()['queue'])==1
 n.mutate(enabled=False);monkeypatch.setattr(n,'catalogue',lambda _:pytest.fail('paused fetched'));n.tick(b);assert len(n.read()['queue'])==1
def test_failure_retry_persisted_even_when_paused(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);s=n.enqueue(n.read(),[scene()]);task=s['queue'].pop();task['job_id']='b'*32;s.update(enabled=False,active=task);n.write(s)
 n.tick(NS(scan_status=lambda _:{'state':'failed','message':'Network timeout'}));s=n.read()
 assert s['active'] is None and s['queue'][0]['attempts']==1 and not s['enabled'] and C['id'] in s['failed']
def test_cloud_failure_not_success(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);s=n.enqueue(n.read(),[scene()]);task=s['queue'].pop();task['job_id']='b'*32;s['active']=task;n.write(s)
 n.tick(NS(scan_status=lambda _:{'state':'failed','message':'Less than 2% clear inputs'}));view=n.public_state()
 assert view['cells_with_results']==0 and view['cells'][0]['status']=='failed'
def test_completed_job_recovered_without_duplicate(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);s=n.enqueue(n.read(),[scene()]);task=s['queue'].pop();task['job_id']='b'*32;s['active']=task;n.write(s)
 monkeypatch.setattr(n,'summarize_result',lambda c,r:{'scan_id':'b'*32,'acquired':'2026-11-15','candidate_count':0,'candidates':[],'usable_percent':80})
 n.tick(NS(scan_status=lambda _:{'state':'completed','result':{'acquired':'2026-11-15'}}));s=n.read()
 assert s['active'] is None and task['key'] in s['seen'] and n.public_state()['cells'][0]['status']=='partial'
 assert len(n.enqueue(s,[scene()])['queue'])==0
def test_catalogue_pagination():
 calls=[]
 def get(url,**kw):
  calls.append(url)
  return {'features':[scene()],'links':[{'rel':'next','href':'https://earth-search.aws.element84.com/v1/search?next=1'}]} if len(calls)==1 else {'features':[scene('S2A_two_L2A')],'links':[]}
 b=NS(CATALOG='https://earth-search.aws.element84.com/v1',COLLECTION='sentinel-2-l2a',get_json=get)
 assert len(n.catalogue(b))==2 and len(calls)==2
def test_reports_read_only_until_enabled(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);client=TestClient(app.app);assert client.get('/api/national').json()['enabled'] is False and not n.STATE.exists()
 s=n.read();n.save_report(s);n.write(s);report=client.get('/api/national/report/'+s['last_report'])
 assert report.status_code==200 and '0/1 planning cells' in report.text
 assert client.get('/api/national/report/not-valid').status_code==404
 assert 'paused' in n.assistant_answer('whole Taiwan status',n.assistant_context())

def test_queue_starts_real_scan_request_and_disk_guard(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);s=n.enqueue(n.read(),[scene()]);s.update(enabled=True,next_check=time.time()+1000,next_weather=time.time()+1000);n.write(s)
 calls=[]
 backend=NS(ACTIVE=NS(locked=lambda:False),read_watch=lambda:{},RESULTS=tmp_path,Scan=app.Scan,
            start_scan=lambda req:(calls.append(req) or {'id':'c'*32}))
 monkeypatch.setattr(n.shutil,'disk_usage',lambda _:NS(free=20*1024**3))
 n.tick(backend)
 assert len(calls)==1 and calls[0].model=='unet13' and calls[0].width_km==12
 assert n.read()['active']['job_id']=='c'*32 and not n.read()['queue']
 s=n.read();s['queue']=[s['active']];s['active']=None;n.write(s)
 monkeypatch.setattr(n.shutil,'disk_usage',lambda _:NS(free=5*1024**3))
 n.tick(backend)
 assert not n.read()['enabled'] and len(calls)==1 and n.read()['queue']

def test_rain_watch_visible_without_segmentation(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path);s=n.read();s['weather']={C['id']:{'collected_epoch':time.time(),'precipitation_24h_mm':100}}
 v=n.public_state(s)
 assert len(v['weather_watch'])==1 and v['weather_watch'][0]['status']=='unassessed'
 assert v['candidate_count']==0 and v['priority_count']==0

def test_start_pause_preserves_queue_and_inflight_scan(monkeypatch,tmp_path):
 isolate(monkeypatch,tmp_path)
 monkeypatch.setattr(app,'model_list',lambda:[{'id':'unet13','available':True}])
 s=n.enqueue(n.read(),[scene()]);n.write(s);client=TestClient(app.app)
 assert client.post('/api/national',json={'enabled':True}).json()['enabled'] is True
 assert len(n.read()['queue'])==1
 s=n.read();s['active']=s['queue'].pop()|{'job_id':'d'*32};n.write(s)
 response=client.post('/api/national',json={'enabled':False}).json()
 assert not response['enabled'] and response['active']['job_id']=='d'*32
