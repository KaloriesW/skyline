import json
import numpy as np
import pytest
from unittest.mock import Mock
from fastapi.testclient import TestClient
from affine import Affine
import app,scene_quality,unet_inference,scan_assistant

@pytest.mark.parametrize('percent',[None,float('nan'),-1,0,2.6,49.99,101])
def test_missing_or_insufficient_quality_never_passes(percent):
    assert not scene_quality.assessment(percent)['suitable']

@pytest.mark.parametrize('percent',[50,76.9,100])
def test_screening_threshold_is_inclusive(percent):
    assert scene_quality.assessment(percent)['suitable']

def test_newest_cloudy_scene_skipped_for_older_clear_acquisition(monkeypatch):
    found=[{'id':'cloudy','date':'2026-11-15T02:00:00Z'},
           {'id':'same-pass-adjacent','date':'2026-11-15T02:00:01Z'},
           {'id':'clear','date':'2026-11-10T02:00:00Z'}]
    check=Mock(side_effect=lambda scene,area:scene_quality.assessment(76.9 if scene['id']=='clear' else 2.6))
    monkeypatch.setattr(app,'scene_preflight',check)
    chosen=app.select_usable_scene(found,app.Area())
    assert chosen['scene']['id']=='clear'
    assert len(chosen['checked'])==2

def test_unverifiable_and_cloudy_acquisitions_do_not_fallback_to_latest(monkeypatch):
    check=Mock(side_effect=[RuntimeError('network unavailable'),scene_quality.assessment(2.6)])
    monkeypatch.setattr(app,'scene_preflight',check)
    result=app.select_usable_scene([{'id':'a','date':'2026-11-15'},{'id':'b','date':'2026-11-10'}],app.Area())
    assert result['scene'] is None
    assert len(result['checked'])==2

def test_local_quality_uses_selected_pixels_instead_of_scene_cloud_metadata(monkeypatch):
    import mosaic
    scl=np.full((100,100),9,dtype=float);scl[:4,:]=4
    monkeypatch.setattr(app,'get_json',lambda *args,**kwargs:{'id':'test'})
    monkeypatch.setattr(mosaic,'discover',lambda item,*args:item)
    monkeypatch.setattr(mosaic,'grid',lambda *args:(Affine.identity(),'EPSG:32651',scl.shape))
    monkeypatch.setattr(mosaic,'quality',lambda *args:(scl,np.zeros(scl.shape)))
    result=app.scene_preflight({'id':'test','cloud':0},app.Area())
    assert not result['suitable'] and result['usable_percent']<4

def test_cloudy_scan_stops_before_checkpoint_or_inference(monkeypatch,tmp_path):
    import mosaic
    mask=np.zeros((100,100),bool);mask[:3]=True
    monkeypatch.setattr(app,'RESULTS',tmp_path)
    monkeypatch.setattr(app,'get_json',lambda *args,**kwargs:{'id':'test'})
    monkeypatch.setattr(app,'fetch_crop',lambda *args:({},np.zeros((3,100,100),dtype='uint8'),np.ones_like(mask),mask,Affine.identity(),'EPSG:32651'))
    monkeypatch.setattr(mosaic,'quality',lambda *args:(np.where(mask,4,9),None))
    checkpoint=Mock(side_effect=AssertionError('Must not load checkpoint'))
    monkeypatch.setattr(app,'model_weights',checkpoint)
    monkeypatch.setattr(app,'JOBS',{'test':{'state':'running'}})
    app.ACTIVE.acquire();app.scan_job('test',app.Scan(scene_id='S2C_51RUH_20261115_0_L2A'))
    assert app.JOBS['test']['state']=='failed'
    assert 'Imagery unsuitable' in app.JOBS['test']['message']
    assert 'result' not in app.JOBS['test']
    checkpoint.assert_not_called()
    assert not (tmp_path/'test'/'result.json').exists()

def test_full_input_coverage_rechecked_before_unet_inference(monkeypatch,tmp_path):
    valid=np.zeros((100,100),bool);valid.flat[:260]=True
    monkeypatch.setattr(unet_inference,'fetch_inputs',lambda *args:(None,valid,{}))
    segment=Mock(side_effect=AssertionError('Must not run inference'))
    monkeypatch.setattr(unet_inference,'segment',segment)
    with pytest.raises(ValueError,match='2.6%'):
        unet_inference.run({},None,None,valid.shape,None,tmp_path,'',None,None,.024,lambda *args:None)
    segment.assert_not_called()

def test_historical_cloudy_scan_rejected_in_status_history_and_home(monkeypatch,tmp_path):
    monkeypatch.setattr(app,'RESULTS',tmp_path)
    identifier='c'*32
    row={'id':identifier,'usable_percent':2.6,'count':0}
    directory=tmp_path/identifier;directory.mkdir();(directory/'result.json').write_text(json.dumps(row))
    client=TestClient(app.app)
    result=client.get('/api/scans/'+identifier).json()
    assert result['state']=='failed' and 'result' not in result
    assert result['reason']=='unsuitable_imagery'
    assert client.get('/api/history').json()==[]
    assert client.get('/api/landslide').json()['status']=='not_scanned'
    with pytest.raises(ValueError,match='Imagery unsuitable'):scan_assistant.measured_report(row)
