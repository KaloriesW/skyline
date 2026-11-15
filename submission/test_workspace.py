import json
from types import SimpleNamespace
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
import app
import workspace_assistant as wa


def test_monitor_pause_resume_preserves_seen_and_inflight(monkeypatch,tmp_path):
    monkeypatch.setattr(app,'WATCH_FILE',tmp_path/'watch.json')
    monkeypatch.setattr(app,'model_list',lambda:[{'id':'unet13','available':True}])
    config=dict(lat=24.16,lon=121.6,width_km=6,model='unet13')
    state=app.configure_watch(app.Watch(**config,enabled=True))
    state.update(seen=['already-scanned'],active_job='inflight',active_scene='scene')
    app.write_watch(state)
    paused=app.configure_watch(app.Watch(**(config|{'width_km':12}),enabled=False))
    assert paused['width_km']==6
    assert paused['seen']==['already-scanned'] and paused['active_job']=='inflight'
    assert paused['generation']==state['generation']
    monkeypatch.setattr(app,'scan_status',lambda _: {'state':'completed','id':'inflight','result':{'count':2,'source_scene_ids':['scene']}})
    app.monitor_tick()
    assert not app.read_watch()['enabled'] and app.read_watch()['last_result']=='inflight'
    resumed=app.configure_watch(app.Watch(**config,enabled=True))
    assert resumed['seen']==['already-scanned','scene']
    changed=app.configure_watch(app.Watch(**(config|{'width_km':12}),enabled=True))
    assert changed['seen']==[] and changed['generation']!=state['generation']


def test_paused_monitor_never_fetches_or_starts(monkeypatch,tmp_path):
    monkeypatch.setattr(app,'WATCH_FILE',tmp_path/'watch.json')
    app.write_watch({'enabled':False})
    def forbidden(*args):raise AssertionError('Paused watcher did work')
    monkeypatch.setattr(app,'scenes',forbidden)
    monkeypatch.setattr(app,'start_scan',forbidden)
    app.monitor_tick()
    assert TestClient(app.app).post('/api/watch/check').status_code==409


def assistant_fixture(monkeypatch,unavailable=False):
    async def predict(req):
        if unavailable:raise RuntimeError('offline')
        return JSONResponse({'city':{'id':'taichung'},'pm25':25.7,'date':'2026-11-16'})
    async def typhoon():return {'active':[]}
    skyline=SimpleNamespace(predict=predict,extras=SimpleNamespace(typhoon=typhoon),predict_state=SimpleNamespace(models=SimpleNamespace(metrics_json=lambda _:json.dumps({'n_test':365,'chosen':{'pm25':'blend'},'results':{'pm25':{'blend':{'mae':4.379},'baseline':{'mae':5.906}}}}))))
    backend=SimpleNamespace(watch_status=lambda:{'enabled':False},scan_status=lambda _: {'result':{'id':'a'*32,'count':2,'center':[24.1,121.6],'acquired':'2026-11-10','width_km':6,'model':'unet13','usable_percent':90,'geojson':{'features':[]}}})
    monkeypatch.setattr(wa.weather,'area_forecast',lambda *args:{'status':'available','summary':'Rain 5 mm','source':'MET Norway'})
    seen={}
    def qwen(system,message,schema,history=None):
        seen.update(system=system,context=json.loads(message),history=history)
        return wa.scan_assistant.Answer(answer='Grounded answer')
    monkeypatch.setattr(wa.scan_assistant,'qwen',qwen)
    api=FastAPI();wa.register(api,backend,skyline)
    return TestClient(api),seen


def test_workspace_uses_server_metrics_weather_scan_and_followups(monkeypatch):
    client,seen=assistant_fixture(monkeypatch)
    r=client.post('/api/assistant/workspace/chat',json={'message':'And the MAE?','lat':24.1,'lon':120.6,'scan_id':'a'*32,'dashboard_snapshot':'MAE 100','history':[{'role':'user','content':'How good is PM2.5?'}]})
    assert r.status_code==200,r.text
    c=seen['context'];assert c['question']=='And the MAE?'
    assert c['city_model_training']['n_test']==365
    assert c['city_model_training']['results']['pm25']['blend']['mae']==4.379
    assert round(c['selected_model_comparisons']['pm25']['error_reduction_percent'],1)==25.9
    assert c['scan']['count']==2 and c['monitor']['enabled'] is False
    assert c['location_weather']['summary']=='Rain 5 mm'
    assert seen['history'][0]['content']=='How good is PM2.5?'
    assert 'cannot see imagery, execute actions' in seen['system']


def test_workspace_missing_air_is_not_zero_and_validates_input(monkeypatch):
    client,seen=assistant_fixture(monkeypatch,True)
    payload={'message':'Weather?','lat':24.1,'lon':120.6}
    assert client.post('/api/assistant/workspace/chat',json=payload).status_code==200
    assert seen['context']['city_air_prediction']=={'status':'unavailable'}
    assert 'city_model_training' not in seen['context']
    assert client.post('/api/assistant/workspace/chat',json=payload|{'scan_id':'../etc'}).status_code==422
    assert client.post('/api/assistant/workspace/chat',json=payload|{'enabled':True}).status_code==422


def test_monitor_followup_uses_actual_workflow_without_qwen_or_mutation(monkeypatch):
    client,seen=assistant_fixture(monkeypatch)
    payload={'message':'What do I need to do to enable it?','lat':24.1,'lon':121.6,
             'history':[{'role':'user','content':'Is monitoring running?'},
                        {'role':'assistant','content':'Monitoring is off.'}]}
    r=client.post('/api/assistant/workspace/chat',json=payload)
    assert r.status_code==200
    assert r.json()['model']=='Monitoring controls'
    assert 'newly published Sentinel-2 scenes' in r.json()['answer']
    assert 'Preview boundary' in r.json()['answer']
    assert 'I have not enabled monitoring' in r.json()['answer']
    assert not seen  # No language-model generation for this factual control answer.


def test_monitoring_state_is_grounded_and_unrelated_followups_remain_open():
    assert 'currently on' in wa.monitoring_answer('Is monitoring running?',[],{'enabled':True})
    assert 'currently off' in wa.monitoring_answer('Is monitoring running?',[],{'enabled':False})
    assert wa.monitoring_answer('How do I enable it?',[{'role':'user','content':'What is a weather layer?'}],{'enabled':False}) is None
