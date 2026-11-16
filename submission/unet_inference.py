"""Frozen Taiwan pilot U-Net: physical L2A inputs, native-grid segmentation."""
from pathlib import Path
import hashlib
import json
import os
import sys
import numpy as np
import rasterio
from evidence import read_aligned, reflectance, clear_land, terrain
import mosaic

HERE = Path(__file__).resolve().parent
ASSETS = ('coastal','blue','green','red','rededge1','rededge2','rededge3',
          'nir','nir09','swir16','swir22')
BANDS = ('B1','B2','B3','B4','B5','B6','B7','B8','B9','B11','B12','slope','DEM')


def profile():
    data = json.loads((HERE/'models/unet13.json').read_text())
    if tuple(data['bands']) != BANDS or data['tile_size'] != 128:
        raise ValueError('U-Net input contract mismatch.')
    mean, std = np.array(data['train_mean']), np.array(data['train_std'])
    if mean.shape != (13,) or std.shape != (13,) or not np.isfinite(mean).all() or not np.isfinite(std).all() or (std <= 0).any():
        raise ValueError('Invalid frozen U-Net normalization.')
    return data


def load_model(device='cpu'):
    import torch
    # Existing local environment keeps SMP dependencies isolated from YOLO.
    deps = HERE.parent.parent/'work/pretrained-unet-deps'
    if deps.is_dir() and str(deps) not in sys.path:
        sys.path.insert(0,str(deps))
    import segmentation_models_pytorch as smp
    p = profile()
    path = HERE/'models/unet13.pt'
    with path.open('rb') as f:
        if hashlib.file_digest(f,'sha256').hexdigest() != p['checkpoint_sha256']:
            raise ValueError('Saved U-Net checkpoint checksum mismatch.')
    model = smp.Unet(encoder_name='resnet34',encoder_weights=None,in_channels=13,
                    classes=1,activation=None,decoder_channels=(256,128,64,32,16))
    saved = torch.load(path,map_location='cpu',weights_only=True)
    model.load_state_dict({k.removeprefix('network.'):v for k,v in saved['model'].items()},strict=True)
    return model.eval().to(device)


def normalize(data,p):
    mean=np.asarray(p['train_mean'],np.float32)[:,None,None]
    std=np.asarray(p['train_std'],np.float32)[:,None,None]
    return np.nan_to_num((data-mean)/std,nan=0,posinf=0,neginf=0)


def fetch_inputs(item,transform,crs,shape,bbox,directory,catalog,get_json,safe_asset,update):
    """One owner for all optical bands; disk-backed tensor bounds memory use."""
    scl,owner=mosaic.quality(item,transform,crs,shape,safe_asset)
    path=directory/'unet-input.npy'
    data=np.lib.format.open_memmap(path,mode='w+',dtype='float32',shape=(13,*shape))
    data[:]=np.nan
    provenance=[]
    for index,tile in enumerate(mosaic.tiles(item)):
        target=owner==index
        if not target.any():continue
        applied=tile['properties'].get('earthsearch:boa_offset_applied') is True
        sources={}
        for channel,key in enumerate(ASSETS):
            update(f'Loading U-Net bands · {BANDS[channel]} · source {index+1}…',20+channel)
            url=safe_asset(tile,key)
            values=reflectance(read_aligned(url,transform,crs,shape),tile['assets'][key],applied)
            data[channel,target]=values[target]
            sources[key]={'href':url,'calibration':tile['assets'][key].get('raster:bands')}
        provenance.append({'scene_id':tile['id'],'offset_already_applied':applied,'assets':sources})
    update('Aligning elevation and 30 m terrain slope…',33)
    slope,dem,dem_sources=terrain(bbox,transform,crs,shape,catalog,get_json,include_elevation=True)
    data[11]=slope;data[12]=dem;data.flush()
    valid=np.isin(scl,[4,5])
    for band in data: valid &= np.isfinite(band)
    # Erode finite-data boundaries too, matching training's unknown-pixel rule.
    valid=clear_land(np.where(valid,4,0))
    metadata={'bands':list(BANDS),'sources':provenance,'dem_sources':dem_sources,
              'shape':list(shape),'transform':list(transform)[:6],'crs':str(crs),
              'clear_land_pixels':int(valid.sum()),'terrain_native_resolution_m':30,
              'optical_native_resolutions_m':[60,10,10,10,20,20,20,10,60,20,20]}
    (directory/'input_provenance.json').write_text(json.dumps(metadata,indent=2))
    return data,valid,metadata


def starts(length,size=128,stride=96):
    return sorted(set(range(0,max(1,length-size+1),stride))|{max(0,length-size)})


def segment(data,valid,threshold,update=lambda *args:None,model=None,device='cpu'):
    import torch
    p=profile(); torch.set_num_threads(2)
    if model is None:model=load_model(device)
    h,w=valid.shape;size=p['tile_size']
    scores=np.zeros((h,w),np.float32);weights=np.zeros((h,w),np.float32)
    # Nonzero taper avoids gaps at image edges; blend before thresholding.
    taper=np.maximum(np.outer(np.hanning(size),np.hanning(size)),.05).astype(np.float32)
    windows=[(y,x) for y in starts(h) for x in starts(w)]
    used=0
    with torch.inference_mode():
        for i,(y,x) in enumerate(windows):
            th,tw=min(size,h-y),min(size,w-x)
            if not valid[y:y+th,x:x+tw].any():continue
            patch=np.zeros((13,size,size),np.float32)
            patch[:,:th,:tw]=normalize(data[:,y:y+th,x:x+tw],p)
            prob=model(torch.from_numpy(patch[None]).to(device))[0,0].sigmoid().cpu().numpy()[:th,:tw]
            if not np.isfinite(prob).all():raise ValueError('U-Net returned nonfinite scores.')
            scores[y:y+th,x:x+tw]+=prob*taper[:th,:tw]
            weights[y:y+th,x:x+tw]+=taper[:th,:tw];used+=1
            update(f'U-Net · tile {i+1} of {len(windows)}…',35+int(53*(i+1)/len(windows)))
    np.divide(scores,weights,out=scores,where=weights>0)
    scores[~valid]=0
    return (scores>np.float32(threshold))&valid,scores,used


def run(item,transform,crs,shape,bbox,directory,catalog,get_json,safe_asset,threshold,update):
    import torch
    device=os.environ.get('TERRAIN_UNET_DEVICE','cpu')
    if device not in {'cpu','mps'}:raise ValueError('TERRAIN_UNET_DEVICE must be cpu or mps.')
    if device=='mps' and not torch.backends.mps.is_available():raise ValueError('MPS unavailable.')
    data,valid,metadata=fetch_inputs(item,transform,crs,shape,bbox,directory,catalog,get_json,safe_asset,update)
    from scene_quality import require_usable
    require_usable(valid)
    mask,scores,used=segment(data,valid,threshold,update,device=device)
    with rasterio.open(directory/'segmentation.tif','w',driver='GTiff',height=shape[0],width=shape[1],
                       count=2,dtype='float32',crs=crs,transform=transform,nodata=-9999,compress='deflate') as dst:
        dst.write(np.where(valid,scores,-9999).astype('float32'),1)
        dst.write(np.where(valid,mask,-9999).astype('float32'),2)
        dst.set_band_description(1,'U-Net score; not calibrated risk probability')
        dst.set_band_description(2,'Binary prediction at selected threshold')
    # Retain reproducible inputs in a compressed, georeferenced artifact.
    with rasterio.open(directory/'unet_inputs.tif','w',driver='GTiff',height=shape[0],width=shape[1],count=13,
                       dtype='float32',crs=crs,transform=transform,nodata=np.nan,compress='deflate',tiled=True) as dst:
        for i,name in enumerate(BANDS,1):dst.write(data[i-1],i);dst.set_band_description(i,name)
        dst.write_mask(valid.astype('uint8')*255)
    del data
    (directory/'unet-input.npy').unlink(missing_ok=True)
    metadata['device']=device
    return mask,scores,used,valid,metadata
