import json
from fastapi.testclient import TestClient
import app
import workspace_assistant


def setup_watch(monkeypatch,tmp_path,**extra):
    monkeypatch.setattr(app,'WATCH_FILE',tmp_path/'monitor.json')
    state=dict(enabled=True,generation='a'*32,lat=24.16,lon=121.6,width_km=6,model='unet13',
               message='No new scene available. Next check in one hour.',last_checked='2026-11-16T01:00:00Z')
    state.update(extra);app.write_watch(state)


def test_no_new_image_reports_hourly_and_survives_restart(monkeypatch,tmp_path):
    setup_watch(monkeypatch,tmp_path)
    first=app.hourly_report_tick(now=10000)
    assert 'No new scene' in first['text'] and first['latest_scan'] is None
    assert app.hourly_report_tick(now=13599) is None
    assert json.loads(app.WATCH_FILE.read_text())['next_report']==13600
    second=app.hourly_report_tick(now=13600)
    assert second['id']!=first['id'] and len(app.saved_watch_reports())==2
    app.hourly_report_tick(now=100000)
    assert len(app.saved_watch_reports())==3


def test_pause_and_active_scan_states(monkeypatch,tmp_path):
    setup_watch(monkeypatch,tmp_path,enabled=False)
    assert app.hourly_report_tick(now=10000) is None
    setup_watch(monkeypatch,tmp_path,active_job='b'*32,message='Automatic scan: Reading inputs')
    report=app.hourly_report_tick(now=10000)
    assert 'scan is in progress' in report['text'] and report['latest_scan'] is None


def test_saved_results_explicitly_carried_forward(monkeypatch,tmp_path):
    setup_watch(monkeypatch,tmp_path,last_result='b'*32)
    monkeypatch.setattr(app,'scan_status',lambda _: {'result':{'id':'b'*32}})
    measured=dict(scan_id='b'*32,acquired='2026-11-05',count=3,both_checks_count=1,
                  usable_percent=80,priority_locations=[{'id':2,'latitude':24.1,'longitude':121.6}],
                  overview='Area 2 at 24.1,121.6 requires review.',
                  weather={'summary':'0.4 mm','forecast_start':'old start','forecast_end':'old end'})
    monkeypatch.setattr(app.scan_assistant,'measured_report',lambda _: measured)
    report=app.hourly_report_tick(now=10000)
    assert report['latest_scan']['count']==3
    assert 'snapshot, not an hourly change count' in report['text']
    assert 'not refreshed by this report' in report['text']
    assert 'old start → old end' in report['text']
    assert report['text'] in workspace_assistant.monitoring_answer('Show the latest hourly report',[],app.watch_status())


def test_report_download_and_retention(monkeypatch,tmp_path):
    setup_watch(monkeypatch,tmp_path)
    monkeypatch.setattr(app,'REPORT_LIMIT',2)
    reports=[app.hourly_report_tick(now=t) for t in [10000,13600,17200]]
    assert len(app.saved_watch_reports())==2
    client=TestClient(app.app)
    assert client.get('/api/watch/reports').json()['reports'][0]['id']==reports[-1]['id']
    response=client.get('/api/watch/reports/'+reports[-1]['id']+'/download')
    assert response.status_code==200 and response.text==reports[-1]['text']
    assert 'attachment' in response.headers['content-disposition']
    assert client.get('/api/watch/reports/'+reports[0]['id']+'/download').status_code==404
    assert client.get('/api/watch/reports/not-a-report/download').status_code==404


def test_failed_check_and_unreadable_scan_are_not_zero_detections(monkeypatch,tmp_path):
    setup_watch(monkeypatch,tmp_path,last_result='c'*32,message='Catalogue check failed; will retry in one hour.')
    def missing(_):raise app.HTTPException(404)
    monkeypatch.setattr(app,'scan_status',missing)
    report=app.hourly_report_tick(now=10000)
    assert 'Catalogue check failed' in report['text']
    assert 'candidate counts are unavailable' in report['text']
    assert report['latest_scan'] is None
