from unittest.mock import patch
from fastapi.testclient import TestClient
import app
import weather


def test_saved_demos_have_required_assets_and_are_immutable():
    client=TestClient(app.app)
    rows=client.get('/api/demos').json()['demos']
    assert len(rows)==2 and all(r['available'] for r in rows)
    with patch.object(weather,'area_forecast',side_effect=AssertionError('Demo must not fetch weather')):
        for r in rows:
            result=client.get('/api/scans/'+r['scan_id']).json()['result']
            assert result['demo_snapshot'] and result['count']==r['count']
            assert client.get('/results/'+r['scan_id']+'/before.png').status_code==200
            assert client.post('/api/scans/'+r['scan_id']+'/weather').status_code==409
            assert client.post('/api/scans/'+r['scan_id']+'/roads').status_code==409
    history=client.get('/api/history').json()
    assert not {r['scan_id'] for r in rows}&{r['id'] for r in history}
