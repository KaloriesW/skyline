"""Offline release check. Does not download imagery, contact Qwen or enable monitoring."""
import argparse,hashlib,json,platform,sys,time
from pathlib import Path

ROOT=Path(__file__).resolve().parent

def check(inference=False):
    import app
    from fastapi.testclient import TestClient
    from shapely.geometry import shape
    import numpy as np
    import rasterio
    checks=[]
    client=TestClient(app.app)  # No lifespan: the monitoring thread stays stopped.
    for route in ['/','/skyline/','/terrain/','/api/health','/api/models','/api/model/cities']:
        response=client.get(route);assert response.status_code==200,(route,response.text[:200])
        checks.append(route)
    cities=client.get('/api/model/cities').json()['cities']
    assert len(cities)==22 and all(c['has_model'] for c in cities)
    for city in cities:
        report=client.get('/api/model',params={'city':city['id']})
        assert report.status_code==200
    assert not client.get('/api/watch').json().get('enabled'), 'Pause monitoring before a release check.'
    assert client.get('/api/demos').status_code==404
    checks.append('demo endpoint removed')
    for file in ['static/workspace.js','static/monitor-ui.js','skyline/ui/app/web/field-desk.css']:
        assert (ROOT/file).is_file(),file
    meta=json.loads((ROOT/'models/unet13.json').read_text())
    with (ROOT/'models/unet13.pt').open('rb') as f:
        assert hashlib.file_digest(f,'sha256').hexdigest()==meta['checkpoint_sha256']
    checks.append('model SHA-256')
    if inference:
        import unet_inference
        sample=np.load(ROOT/'tests/fixtures/unet-smoke.npz')
        start=time.monotonic()
        mask,score,windows=unet_inference.segment(sample['data'],sample['valid'],meta['confidence'])
        assert np.isfinite(score).all() and windows==1
        assert np.array_equal(mask,sample['expected']), 'Frozen smoke-mask differs.'
        assert mask.any() and not mask[~sample['valid']].any()
        checks.append({'actual_model_inference':'passed','seconds':round(time.monotonic()-start,3),'candidate_pixels':int(mask.sum())})
    return {'passed':True,'python':sys.version.split()[0],'platform':platform.platform(),'checks':checks,'note':'Offline setup and inference checks; not a new accuracy evaluation.'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--inference',action='store_true');p.add_argument('--output',type=Path)
    args=p.parse_args();result=check(args.inference);text=json.dumps(result,indent=2)
    if args.output:args.output.write_text(text+'\n')
    print(text)
