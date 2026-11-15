import json,tempfile,unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock,patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
import app,scan_assistant as assistant

class AssistantTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);(self.root/'results').mkdir()
        self.backend=SimpleNamespace(HERE=self.root,RESULTS=self.root/'results',Area=app.Area,Search=app.Search,Scan=app.Scan,
            scenes=Mock(return_value={'scenes':[{'id':'S2C_51RUH_20261105_0_L2A','date':'2026-11-05T02:40:00Z','cloud':1}]}),
            model_list=Mock(return_value=[{'id':'nano448','label':'YOLO11n · 448','available':True,'preferred':True}]),
            start_scan=Mock(return_value={'id':'b'*32,'state':'running'}),scan_status=Mock(return_value={'state':'running','progress':20,'message':'Scanning'}))
        api=FastAPI();assistant.register(api,self.backend);self.client=TestClient(api)
        self.qwen=patch.object(assistant,'qwen',return_value=assistant.Intent(action='scan',place_query='Yushan')).start()
        self.place={'id':'N11','name':'玉山','label':'玉山 · 南投縣','lat':24.05,'lon':121.45,'kind':'peak','extent':None,'parents':['南投縣']}
        self.search=patch.object(assistant.geocoder,'search',return_value=[self.place]).start()
        self.reverse=patch.object(assistant.geocoder,'reverse',side_effect=lambda lat,lon:{**self.place,'lat':lat,'lon':lon}).start()
        self.peaks=patch.object(assistant.geocoder,'mountains',return_value=[self.place]).start()
        self.forecast=patch.object(assistant.weather,'area_forecast',return_value={'status':'unavailable','summary':'Weather unavailable in this unit test.'}).start()
        self.addCleanup(patch.stopall)
        self.thread=patch.object(assistant,'start_worker').start()
        self.addCleanup(assistant.WORKERS.clear)
    def plan(self):
        response=self.client.post('/api/assistant/plans',json={'message':"scan huelian's mountains",'lat':23.7,'lon':121,'width_km':6})
        self.assertEqual(response.status_code,200,response.text);return response.json()
    def test_scan_this_area_uses_selection_even_if_qwen_would_clarify(self):
        self.qwen.return_value=assistant.Intent(action='clarify',question='Where?')
        for message in ['Scan this area', 'please scan here!', '掃描這裡']:
            with self.subTest(message=message):
                response=self.client.post('/api/assistant/plans',json={
                    'message':message,'lat':24.16,'lon':121.6,'width_km':2,'proposed_width_km':6})
                self.assertEqual(response.status_code,200,response.text)
                plan=response.json()
                self.assertEqual(plan['state'],'awaiting_confirmation')
                self.assertEqual(plan['request']['lat'],24.16)
                self.assertEqual(plan['request']['lon'],121.6)
                self.assertEqual(plan['request']['width_km'],6)
        self.qwen.assert_not_called()
        self.backend.start_scan.assert_not_called()

    def test_negative_current_area_command_is_not_auto_interpreted_as_scan(self):
        self.qwen.return_value=assistant.Intent(action='clarify',question='No scan requested.')
        response=self.client.post('/api/assistant/plans',json={
            'message':"do not scan this area",'lat':24.16,'lon':121.6,'width_km':6})
        self.assertEqual(response.json()['state'],'clarify')
        self.qwen.assert_called_once()
        self.backend.start_scan.assert_not_called()

    def test_prepare_outline_and_estimate_without_starting_scan(self):
        p=self.plan();self.backend.start_scan.assert_not_called()
        self.assertEqual(p['request']['lat'],24.05);self.assertEqual(p['request']['width_km'],6);self.assertEqual(len(p['bbox']),4)
        self.assertEqual(p['state'],'awaiting_confirmation');self.assertGreater(p['estimate']['max_minutes'],p['estimate']['min_minutes'])
    def test_arbitrary_place_resolves_without_a_preset(self):
        self.qwen.return_value=assistant.Intent(action='scan',place_query='大武鄉',place_kind='region')
        self.search.return_value=[{**self.place,'lat':22.34,'lon':120.89,'name':'大武鄉','label':'大武鄉 · 臺東縣'}]
        p=self.plan();self.assertEqual(p['request']['lat'],22.34);self.assertEqual(p['request']['lon'],120.89)
        self.search.assert_called_once_with('大武鄉',region_only=True);self.backend.start_scan.assert_not_called()

    def test_plan_uses_calibrated_model_confidence(self):
        self.backend.model_list.return_value=[{'id':'sentinel2448','label':'Sentinel-2','available':True,'preferred':True,'confidence':.032}]
        p=self.plan()
        self.assertEqual(p['request']['confidence'],.032)
        self.assertEqual(p['request']['model'],'sentinel2448')
        self.backend.start_scan.assert_not_called()

    def test_ambiguity_and_mountain_choices_cannot_start_before_confirmation(self):
        self.search.return_value=[self.place,{**self.place,'id':'N22','label':'Other 玉山','lon':121.2}]
        p=self.plan();self.assertEqual(p['state'],'choose_location')
        url=f"/api/assistant/plans/{p['id']}"
        self.assertEqual(self.client.post(url+'/start',json={'confirm':True}).status_code,409)
        self.assertEqual(self.client.post(url+'/location',json={'candidate_id':'N999'}).status_code,400)
        chosen=self.client.post(url+'/location',json={'candidate_id':'N22'}).json()
        self.assertEqual(chosen['state'],'awaiting_confirmation');self.assertEqual(chosen['request']['lon'],121.2)
        self.backend.start_scan.assert_not_called()
        self.search.return_value=[self.place]
        self.qwen.return_value=assistant.Intent(action='scan',place_query='Taichung',place_kind='region',mountains=True)
        p=self.plan();self.assertEqual(p['phase'],'mountain')
        chosen=self.client.post(f"/api/assistant/plans/{p['id']}/location",json={'candidate_id':'N11'}).json()
        self.assertEqual(chosen['request']['width_km'],60);self.backend.start_scan.assert_not_called()

    def test_coordinate_values_must_come_from_user_and_islands_are_supported(self):
        self.qwen.return_value=assistant.Intent(action='scan',mode='coordinates')
        self.assertEqual(self.plan()['state'],'clarify');self.reverse.assert_not_called()
        r=self.client.post('/api/assistant/plans',json={'message':'scan 26.16, 119.94','lat':24.1,'lon':121,'width_km':6})
        self.assertEqual(r.status_code,200);self.assertEqual(r.json()['request']['lat'],26.16)
        self.reverse.assert_called_once_with(26.16,119.94)

    def test_explicit_smaller_area_is_respected(self):
        self.qwen.return_value=assistant.Intent(action='scan',place_query='Yushan',width_km=12)
        self.assertEqual(self.plan()['request']['width_km'],12)
        r=self.client.post('/api/assistant/plans',json={'message':'scan Hualien mountains',
            'lat':24.16,'lon':121.6,'width_km':6,'proposed_width_km':36})
        self.assertEqual(r.json()['request']['width_km'],36)
        self.backend.start_scan.assert_not_called()

    def test_confirmation_required_and_double_start_idempotent(self):
        p=self.plan();url=f"/api/assistant/plans/{p['id']}/start"
        self.assertEqual(self.client.post(url,json={'confirm':False}).status_code,422)
        self.assertEqual(self.client.post(url,json={}).status_code,422)
        self.backend.start_scan.assert_not_called()
        first=self.client.post(url,json={'confirm':True});second=self.client.post(url,json={'confirm':True})
        self.assertEqual(first.status_code,200);self.assertEqual(second.json()['job_id'],first.json()['job_id'])
        self.backend.start_scan.assert_called_once()
        self.assertEqual(self.backend.start_scan.call_args.args[0].model,'nano448')
    def test_expired_or_cancelled_plan_cannot_start(self):
        p=self.plan();path=self.root/'assistant'/f"{p['id']}.json"
        p['expires_at']=(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat();path.write_text(json.dumps(p))
        self.assertEqual(self.client.post(f"/api/assistant/plans/{p['id']}/start",json={'confirm':True}).status_code,409)
        p=self.plan();self.client.post(f"/api/assistant/plans/{p['id']}/cancel",json={})
        self.assertEqual(self.client.post(f"/api/assistant/plans/{p['id']}/start",json={'confirm':True}).status_code,409)
        self.backend.start_scan.assert_not_called()
    def test_unknown_place_clarifies_and_current_uses_map_coordinates(self):
        self.qwen.return_value=assistant.Intent(action='clarify',question='Select a location on the map.')
        self.assertEqual(self.plan()['state'],'clarify');self.backend.scenes.assert_not_called()
        self.qwen.return_value=assistant.Intent(action='scan',mode='current')
        p=self.plan();self.assertEqual(p['request']['lat'],23.7);self.assertEqual(p['request']['lon'],121)
    def test_invalid_bounds_or_llm_command_rejected(self):
        r=self.client.post('/api/assistant/plans',json={'message':'scan','lat':40,'lon':121,'width_km':6})
        self.assertEqual(r.status_code,422);self.qwen.assert_not_called()
        with self.assertRaises(ValidationError):assistant.Intent(action='execute',mode='current',command='rm')
        with self.assertRaises(ValidationError):assistant.Intent(action='scan',mode='current',latitude=40)
    def test_report_uses_measured_coordinates_and_ranks_support_before_area(self):
        def feature(i,area,veg,slope):return {'properties':{'id':i,'latitude':24+i/100,'longitude':121.6,'area_m2':area,'confidence':.75,'vegetation_check':veg,'slope_check':slope}}
        result={'id':'a'*32,'acquired':'2026-11-05','center':[24.16,121.6],'width_km':6,'model':'nano448','count':2,'usable_percent':95,
            'geojson':{'features':[feature(1,100000,'not_supported','supports'),feature(2,2000,'supports','supports')]}}
        r=assistant.measured_report(result)
        self.assertEqual(r['both_checks_count'],1);self.assertEqual(r['priority_locations'][0]['id'],2)
        self.assertEqual(r['priority_locations'][0]['latitude'],24.02)
        self.assertIn('not severity',r['ranking_method'])
    def test_completed_scan_still_has_report_when_qwen_unavailable(self):
        p=self.plan();self.client.post(f"/api/assistant/plans/{p['id']}/start",json={'confirm':True})
        result={'id':'b'*32,'acquired':'2026-11-05','center':[24.16,121.6],'width_km':6,
                'model':'nano448','count':0,'usable_percent':95,'geojson':{'features':[]}}
        self.backend.scan_status.return_value={'state':'completed','result':result}
        self.qwen.side_effect=assistant.HTTPException(503,'Ollama offline')
        target,identifier=self.thread.call_args.args;target(identifier)
        report=self.client.get(f"/api/assistant/plans/{p['id']}").json()
        self.assertEqual(report['state'],'completed');self.assertEqual(report['report']['priority_locations'],[])
        self.assertEqual(report['report']['narrative_source'],'measured summary')
        download=self.client.get(f"/api/assistant/plans/{p['id']}/report")
        self.assertEqual(download.status_code,200);self.assertIn('Candidates: 0',download.text)

    def test_narrative_choices_match_full_scan_evidence(self):
        empty=assistant.summary_choices({'count':0,'both_checks_count':0})
        unsupported=assistant.summary_choices({'count':27,'both_checks_count':0})
        supported=assistant.summary_choices({'count':27,'both_checks_count':4})
        self.assertIn('no suspected regions',empty[1])
        self.assertIn('none were supported',unsupported[0])
        self.assertIn('Some suspected regions',supported[0])
        self.assertNotIn('five',unsupported[0])

    def test_fabricated_narrative_is_replaced_with_measured_summary(self):
        p=self.plan();self.client.post(f"/api/assistant/plans/{p['id']}/start",json={'confirm':True})
        self.backend.scan_status.return_value={'state':'completed','result':{'id':'b'*32,'acquired':'2026-11-05',
            'center':[24.16,121.6],'width_km':6,'model':'nano448','count':0,'usable_percent':95,'geojson':{'features':[]}}}
        self.qwen.return_value=assistant.Narrative(overview='Five severe landslides were confirmed.')
        target,identifier=self.thread.call_args.args;target(identifier)
        report=self.client.get(f"/api/assistant/plans/{p['id']}").json()['report']
        self.assertEqual(report['narrative_source'],'measured summary')
        self.assertNotIn('Five severe',report['overview'])

    def test_weather_request_does_not_search_or_start_satellite_scan(self):
        self.qwen.return_value=assistant.Intent(action='weather',mode='current')
        p=self.plan();self.assertEqual(p['state'],'weather_ready');self.assertIn('weather',p)
        self.backend.scenes.assert_not_called();self.backend.start_scan.assert_not_called()
        self.assertEqual(self.client.post(f"/api/assistant/plans/{p['id']}/start",json={'confirm':True}).status_code,409)

    def test_estimate_calibrates_to_matching_model(self):
        for i,model,seconds in [(1,'nano448',60),(2,'large448',6000)]:
            p=self.root/'results'/str(i);p.mkdir();(p/'result.json').write_text(json.dumps({'model_id':model,'processing_seconds':seconds,'width_km':6}))
        e=assistant.estimate(6,'nano448',self.root/'results')
        self.assertEqual(e['max_minutes'],2);self.assertIn('1 recent timed scans',e['basis'])

    def test_followup_remembers_conversation_without_starting_scan(self):
        p=self.plan();self.qwen.return_value=assistant.Answer(answer='This is a proposed scan, not a completed detection.')
        body={'plan_id':p['id'],'message':'What would this scan cover?'}
        r=self.client.post('/api/assistant/chat',json=body)
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(len(r.json()['messages']),2)
        body['message']='And how long would that take?'
        self.client.post('/api/assistant/chat',json=body)
        call=self.qwen.call_args
        self.assertEqual(call.kwargs['history'][0]['content'],'What would this scan cover?')
        self.assertIn('estimate',json.loads(call.args[1])['context'])
        saved=self.client.get('/api/assistant/chat',params={'plan_id':p['id']}).json()
        self.assertEqual(len(saved['messages']),4)
        self.assertEqual(self.client.get('/api/assistant/chat').json()['messages'],[])
        self.backend.start_scan.assert_not_called()

    def test_followup_scan_context_includes_named_candidate_outside_top_twenty(self):
        features=[{'properties':{'id':i,'latitude':24+i/10000,'longitude':121.6,'area_m2':10000-i,
            'confidence':.7,'vegetation_check':'supports','slope_check':'not_supported',
            'nearest_road_name':'Test road','road_distance_m':123}} for i in range(1,32)]
        result={'id':'b'*32,'acquired':'2026-11-05','center':[24.16,121.6],'width_km':6,
            'model':'nano448','count':31,'usable_percent':95,'geojson':{'features':features},
            'weather':{'summary':'Saved forecast','forecast_start':'2026-11-15','fetched_at':'2026-11-14'}}
        self.backend.scan_status.return_value={'state':'completed','result':result}
        self.qwen.return_value=assistant.Answer(answer='Area 31 is a candidate for review.')
        r=self.client.post('/api/assistant/chat',json={'scan_id':'b'*32,'message':'What about Area 31?'})
        self.assertEqual(r.status_code,200,r.text)
        context=json.loads(self.qwen.call_args.args[1])['context']
        self.assertEqual(context['report']['count'],31)
        self.assertEqual(context['candidates'][0]['id'],31)
        self.assertEqual(context['candidates'][0]['road_distance_m'],123)
        self.assertEqual(context['weather']['forecast_start'],'2026-11-15')
        self.client.post('/api/assistant/chat',json={'scan_id':'b'*32,'message':'How close is it to a road?'})
        context=json.loads(self.qwen.call_args.args[1])['context']
        self.assertEqual(context['candidates'][0]['id'],31)
        self.backend.start_scan.assert_not_called();self.forecast.assert_not_called()

    def test_chat_failure_does_not_save_reply_and_invalid_context_is_rejected(self):
        self.qwen.side_effect=assistant.HTTPException(503,'Qwen offline')
        self.assertEqual(self.client.post('/api/assistant/chat',json={'message':'Help'}).status_code,503)
        self.assertEqual(self.client.get('/api/assistant/chat').json()['messages'],[])
        self.assertEqual(self.client.post('/api/assistant/chat',json={'message':'  '}).status_code,422)
        self.assertEqual(self.client.get('/api/assistant/chat?scan_id=../../app.py').status_code,404)
        self.assertEqual(self.client.post('/api/assistant/chat',json={'message':'Start now','plan_id':'a'*32,'scan_id':'b'*32}).status_code,400)
        self.backend.start_scan.assert_not_called()
    def test_server_restart_marks_missing_scan_interrupted_without_rescanning(self):
        p=self.plan();self.client.post(f"/api/assistant/plans/{p['id']}/start",json={'confirm':True})
        self.backend.scan_status.side_effect=assistant.HTTPException(404,'missing')
        target,identifier=self.thread.call_args.args;target(identifier)
        self.assertEqual(self.client.get(f"/api/assistant/plans/{p['id']}").json()['state'],'interrupted')
        self.backend.start_scan.assert_called_once()

if __name__=='__main__':unittest.main()
