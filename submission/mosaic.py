"""Stitch one Sentinel-2 acquisition on a single georeferenced pixel grid."""
from datetime import datetime,timedelta
import math
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds,Window
from evidence import read_aligned


def acquired(item):
    return datetime.fromisoformat(item['properties']['datetime'].replace('Z','+00:00'))


def same_pass(a,b):
    pa,pb=a['properties'],b['properties']
    if pa.get('platform')!=pb.get('platform'):return False
    if abs((acquired(a)-acquired(b)).total_seconds())>600:return False
    da,db=pa.get('s2:datatake_id'),pb.get('s2:datatake_id')
    # Strip only the processing-baseline suffix; the pass itself must match.
    if da and db:return da.split('_N')[0]==db.split('_N')[0]
    return True  # Same spacecraft cannot make two overpasses in ten minutes.


def tiles(item):return item.get('_tiles',[item])


def bundle(primary,items):
    chosen=[primary];seen={primary['properties'].get('grid:code',primary['id'])}
    for item in sorted(items,key=lambda f:f['properties'].get('created',''),reverse=True):
        key=item['properties'].get('grid:code',item['id'])
        if key not in seen and same_pass(primary,item) and all(k in item['assets'] for k in ['visual','scl']):
            chosen.append(item);seen.add(key)
    return {**primary,'_tiles':chosen}


def discover(primary,bbox,catalog,get_json):
    dt=acquired(primary)
    start=(dt-timedelta(minutes=10)).isoformat();end=(dt+timedelta(minutes=10)).isoformat()
    data=get_json(catalog+'/search',params={'collections':'sentinel-2-l2a',
        'bbox':','.join(map(str,bbox)),'datetime':f'{start}/{end}','limit':100})
    return bundle(primary,data.get('features',[]))


def group_passes(items):
    remaining=sorted(items,key=acquired,reverse=True);groups=[]
    while remaining:
        primary=remaining[0];group=bundle(primary,remaining);groups.append(group)
        remaining=[i for i in remaining if not same_pass(primary,i)]
    return groups


def grid(primary,bbox,safe_asset):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'),rasterio.open(safe_asset(primary,'visual')) as src:
        raw=from_bounds(*transform_bounds('EPSG:4326',src.crs,*bbox,densify_pts=21),transform=src.transform)
        left,top=math.floor(raw.col_off),math.floor(raw.row_off)
        right,bottom=math.ceil(raw.col_off+raw.width),math.ceil(raw.row_off+raw.height)
        win=Window(left,top,right-left,bottom-top)
        if win.width>6500 or win.height>6500:raise ValueError('Selected area is too large. Choose 60 km or less.')
        return src.window_transform(win),src.crs,(int(win.height),int(win.width))


def quality(item,transform,crs,shape,safe_asset):
    """Prefer clear land in overlaps; retain one source owner per output pixel."""
    cache_key=(tuple(transform),str(crs),shape)
    if item.get('_quality_key')==cache_key:return item['_quality_cache']
    owner=np.full(shape,-1,dtype='int16');scl=np.zeros(shape,dtype='float32')
    rank=np.full(shape,-1,dtype='int8')
    for index,tile in enumerate(tiles(item)):
        data=read_aligned(safe_asset(tile,'scl'),transform,crs,shape,Resampling.nearest)
        valid=np.isfinite(data)&(data>0)
        score=np.where(np.isin(data,[4,5]),2,np.where(data==6,1,0))
        take=valid&(score>rank)
        scl[take]=data[take];rank[take]=score[take];owner[take]=index
    item['_quality_key']=cache_key;item['_quality_cache']=(scl,owner)
    return scl,owner


def rgb(item,transform,crs,shape,safe_asset,owner=None):
    if owner is None:_,owner=quality(item,transform,crs,shape,safe_asset)
    result=np.zeros((3,*shape),dtype='uint8');valid=np.zeros(shape,bool)
    for index,tile in enumerate(tiles(item)):
        target=owner==index
        if not target.any():continue
        bands=np.stack([read_aligned(safe_asset(tile,'visual'),transform,crs,shape,band=b) for b in [1,2,3]])
        usable=target&np.isfinite(bands).any(axis=0)
        result[:,usable]=np.nan_to_num(bands[:,usable]).clip(0,255).astype('uint8');valid|=usable
    return result,valid


def native_rgb(item,transform,crs,shape,safe_asset):
    """Read B4/B3/B2 without TCI clipping, retaining mosaic source ownership."""
    _,owner=quality(item,transform,crs,shape,safe_asset)
    result=np.zeros((3,*shape),dtype='float32');valid=np.zeros(shape,bool)
    for index,tile in enumerate(tiles(item)):
        target=owner==index
        if not target.any():continue
        bands=np.stack([read_aligned(safe_asset(tile,key),transform,crs,shape) for key in ['red','green','blue']])
        usable=target & np.isfinite(bands).all(axis=0)
        result[:,usable]=bands[:,usable];valid |= usable
    return result,valid


def fetch(item,bbox,catalog,get_json,safe_asset):
    combined=discover(item,bbox,catalog,get_json)
    transform,crs,shape=grid(item,bbox,safe_asset)
    scl,owner=quality(combined,transform,crs,shape,safe_asset)
    image,valid=rgb(combined,transform,crs,shape,safe_asset,owner)
    return combined,image,valid,valid&np.isin(scl,[4,5,6]),transform,crs


def provenance(item,catalog):
    return [{'id':t['id'],'acquired':t['properties']['datetime'],
             'source_url':f'{catalog}/collections/sentinel-2-l2a/items/{t["id"]}'} for t in tiles(item)]
