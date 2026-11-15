import json
import numpy as np
import torch
from affine import Affine
from fastapi.testclient import TestClient
import app
import unet_inference as unet


def test_normalization_matches_frozen_training_and_handles_missing_values():
    p=unet.profile()
    x=np.asarray(p['train_mean'],np.float32)[:,None,None]+np.asarray(p['train_std'],np.float32)[:,None,None]
    assert np.allclose(unet.normalize(x,p),1,atol=2e-6)
    x[0]=np.nan;x[1]=np.inf;x[2]=-np.inf
    assert np.all(unet.normalize(x,p)[:3]==0)


def test_overlap_covers_edges_and_never_predicts_invalid_pixels():
    class Constant(torch.nn.Module):
        def forward(self,x):return torch.ones((len(x),1,128,128))*2
    x=np.zeros((13,257,209),np.float32);valid=np.ones((257,209),bool)
    valid[100:140,50:190]=False
    mask,scores,used=unet.segment(x,valid,.024,model=Constant())
    assert np.array_equal(mask,valid)
    assert np.all(scores[~valid]==0)
    assert np.allclose(scores[valid],torch.sigmoid(torch.tensor(2.)).item(),atol=1e-6)
    assert used==6


def test_all_bands_share_mosaic_owner_and_scale_offset(monkeypatch,tmp_path):
    shape=(8,10);owner=np.zeros(shape,int);owner[:,5:]=1;scl=np.full(shape,4);scl[3:5,4:6]=9
    tiles=[]
    for i in range(2):
        tiles.append({'id':str(i),'properties':{'earthsearch:boa_offset_applied':bool(i)},
          'assets':{key:{'raster:bands':[{'scale':.0001,'offset':-.1,'nodata':0}]} for key in unet.ASSETS}})
    monkeypatch.setattr(unet.mosaic,'quality',lambda *a:(scl,owner))
    monkeypatch.setattr(unet,'read_aligned',lambda url,*a:np.full(shape,2000+int(url.split(':')[1]),np.float32))
    monkeypatch.setattr(unet,'terrain',lambda *a,**k:(np.full(shape,32.),np.full(shape,1800.),['dem']))
    x,valid,meta=unet.fetch_inputs({'_tiles':tiles},Affine(10,0,300000,0,-10,2600000),'EPSG:32651',shape,[1,2,3,4],tmp_path,'catalog',None,lambda t,k:t['id']+':'+str(unet.ASSETS.index(k)),lambda *a:None)
    for i in range(11):
        assert np.allclose(x[i,:,:5],.1+i*.0001)
        assert np.allclose(x[i,:,5:],.2+i*.0001)
    assert np.all(x[11]==32) and np.all(x[12]==1800)
    assert not valid[2:6,3:7].any() and valid[1,1]
    assert not valid[0].any() and not valid[-1].any()
    assert meta['bands']==list(unet.BANDS)


def test_single_server_contract_and_geographic_lookup(monkeypatch,tmp_path):
    monkeypatch.setattr(app,'RESULTS',tmp_path)
    client=TestClient(app.app)
    assert client.get('/').status_code==200
    assert client.get('/skyline/').status_code==200
    assert client.get('/skyline/app.js').status_code==200
    assert client.get('/api/health').json()['features']['landslide']
    models=client.get('/api/models').json()
    assert any(m['id']=='unet13' and m['preferred'] and m['confidence']==.024 for m in models)
    assert client.get('/api/landslide?lat=24&lon=121').json()['status']=='not_scanned'
    assert client.get('/api/landslide?lat=24').status_code==400
    row={'id':'a'*32,'model':'U-Net','acquired':'2026-11-05T02:00:00Z','created_at':'2026-11-15',
         'count':1,'center':[24,121],'bbox':[120.9,23.9,121.1,24.1],'width_km':6,'usable_percent':90,'geojson':{'type':'FeatureCollection','features':[]}}
    directory=tmp_path/row['id'];directory.mkdir();(directory/'result.json').write_text(json.dumps(row))
    assert client.get('/api/landslide?lat=24&lon=121').json()['id']==row['id']
    assert client.get('/api/landslide?lat=23&lon=121').json()['count'] is None
    assert client.get('/api/landslide').json()['map_url']=='/?scan='+row['id']


def test_missing_optional_yolo_calibration_does_not_break_model_list(monkeypatch):
    monkeypatch.setattr(app.model_profiles,'release',lambda:None)
    response=TestClient(app.app).get('/api/models')
    assert response.status_code==200
    rows=response.json()
    assert next(m for m in rows if m['id']=='unet13')['available']
    assert not next(m for m in rows if m['id']=='sentinel2448')['available']
