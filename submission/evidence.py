"""Independent, optional vegetation-change and terrain evidence for candidates."""
from datetime import datetime, timedelta
import math
import numpy as np
import rasterio
from affine import Affine
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.warp import transform_bounds, transform_geom, reproject
from rasterio.windows import from_bounds, Window

# Exploratory screening rules, not calibrated landslide probabilities.
RULES = dict(min_pair_coverage=0.5, min_before_ndvi=0.4, min_ndvi_drop=0.2,
             min_loss_fraction=0.3, min_slope_degrees=15, min_slope_coverage=0.5)
ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',
           CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_HTTP_TIMEOUT='45',
           GDAL_HTTP_MAX_RETRY='1', GDAL_HTTP_RETRY_DELAY='1')


def read_aligned(url, transform, crs, shape, resampling=Resampling.bilinear, band=1):
    """Range-read a small window, mask nodata before resampling onto a shared grid."""
    dst=np.full(shape,np.nan,dtype='float32')
    bounds=rasterio.transform.array_bounds(*shape,transform)
    with rasterio.Env(**ENV), rasterio.open(url) as src:
        projected=transform_bounds(crs,src.crs,*bounds,densify_pts=21)
        raw=from_bounds(*projected,transform=src.transform)
        left,top=math.floor(raw.col_off)-2,math.floor(raw.row_off)-2
        right=math.ceil(raw.col_off+raw.width)+2
        bottom=math.ceil(raw.row_off+raw.height)+2
        window=Window(left,top,right-left,bottom-top)
        data=src.read(band,window=window,boundless=True,masked=True).astype('float32').filled(np.nan)
        reproject(data,dst,src_transform=src.window_transform(window),src_crs=src.crs,
                  dst_transform=transform,dst_crs=crs,src_nodata=np.nan,dst_nodata=np.nan,
                  resampling=resampling)
    return dst


def clear_land(scl):
    # Only confidently classified land; erode a pixel at cloudy/invalid boundaries.
    mask=np.isin(scl,[4,5]);pad=np.pad(mask,1,constant_values=False)
    return np.logical_and.reduce([pad[y:y+mask.shape[0],x:x+mask.shape[1]]
                                  for y in range(3) for x in range(3)])


def reflectance(raw, asset, offset_already_applied=False):
    band=asset.get('raster:bands',[{}])[0]
    if 'scale' not in band or 'offset' not in band:
        raise ValueError('Missing reflectance scale/offset; NDVI unavailable.')
    # DN=0 is no-data even when the asset has a negative physical offset.
    # Earth Search can retain the original offset in raster:bands after its
    # COG converter has applied it. Respect the explicit item-level flag.
    offset=0 if offset_already_applied else band['offset']
    return np.where(raw!=band.get('nodata',0),raw*band['scale']+offset,np.nan)


def calibration(item):
    if '_tiles' in item:return {'tiles':{t['id']:calibration(t) for t in item['_tiles']}}
    applied=item['properties'].get('earthsearch:boa_offset_applied') is True
    return {'offset_already_applied':applied,'bands':{key:{
        'scale':item['assets'][key]['raster:bands'][0].get('scale'),
        'declared_offset':item['assets'][key]['raster:bands'][0].get('offset'),
        'used_offset':0 if applied else item['assets'][key]['raster:bands'][0].get('offset')}
        for key in ['red','nir']}}


def ndvi(red,nir,valid):
    total=red+nir
    good=valid&np.isfinite(total)&(red>=0)&(nir>=0)&(total>1e-6)
    result=np.full(red.shape,np.nan,dtype='float32')
    np.divide(nir-red,total,out=result,where=good)
    return result


def scene_ndvi(item, transform, crs, shape, safe_asset, land=None):
    if '_tiles' in item:
        import mosaic
        scl,owner=mosaic.quality(item,transform,crs,shape,safe_asset)
        if land is None:land=clear_land(scl)
        result=np.full(shape,np.nan,dtype='float32')
        for index,tile in enumerate(item['_tiles']):
            target=(owner==index)&land
            if not target.any():continue
            values=scene_ndvi(tile,transform,crs,shape,safe_asset,land=target)
            result[target]=values[target]
        return result
    if land is None:
        land=clear_land(read_aligned(safe_asset(item,'scl'),transform,crs,shape,Resampling.nearest))
    applied=item['properties'].get('earthsearch:boa_offset_applied') is True
    red=reflectance(read_aligned(safe_asset(item,'red'),transform,crs,shape),item['assets']['red'],applied)
    nir=reflectance(read_aligned(safe_asset(item,'nir'),transform,crs,shape),item['assets']['nir'],applied)
    measured=land&np.isfinite(red)&np.isfinite(nir)
    if measured.any() and np.mean(((red<0)|(nir<0))[measured])>.2:
        raise ValueError('Reflectance metadata may be inconsistent: over 20% negative clear-land reflectance. Comparison withheld.')
    return ndvi(red,nir,land)


def slope_degrees(elevation,spacing=30):
    dy,dx=np.gradient(elevation,spacing,spacing)
    slope=np.degrees(np.arctan(np.hypot(dx,dy))).astype('float32')
    slope[~np.isfinite(elevation)]=np.nan
    # Gradient at the outside edge is one-sided and less reliable.
    slope[[0,-1],:]=np.nan;slope[:,[0,-1]]=np.nan
    return slope


def terrain(bbox,transform,crs,shape,catalog,get_json,include_elevation=False):
    # Compute slope in metres at 30 m, then align to the image only for sampling.
    west,south,east,north=rasterio.transform.array_bounds(*shape,transform)
    tr=Affine(30,0,west-90,0,-30,north+90)
    dem_shape=(math.ceil((north-south)/30)+6,math.ceil((east-west)/30)+6)
    padded_bbox=transform_bounds(crs,'EPSG:4326',*rasterio.transform.array_bounds(*dem_shape,tr))
    items=get_json(catalog+'/search',params={'collections':'cop-dem-glo-30',
                   'bbox':','.join(map(str,padded_bbox)),'limit':12}).get('features',[])
    dem=np.full(dem_shape,np.nan,dtype='float32');sources=[]
    for item in items:
        href=item['assets']['data']['href']
        if href.startswith('s3://copernicus-dem-30m/'):
            href=href.replace('s3://copernicus-dem-30m/','https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/',1)
        if not href.startswith('https://copernicus-dem-30m.s3.'):
            raise ValueError('Unexpected elevation data host.')
        tile=read_aligned(href,tr,crs,dem_shape)
        valid=np.isfinite(tile);dem[valid]=tile[valid];sources.append(href)
    if not np.isfinite(dem).any():raise ValueError('No elevation coverage for this area.')
    slope=slope_degrees(dem)
    aligned=np.full(shape,np.nan,dtype='float32')
    reproject(slope,aligned,src_transform=tr,src_crs=crs,dst_transform=transform,dst_crs=crs,
              src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.bilinear if include_elevation else Resampling.nearest)
    if include_elevation:
        elevation=np.full(shape,np.nan,dtype='float32')
        reproject(dem,elevation,src_transform=tr,src_crs=crs,dst_transform=transform,dst_crs=crs,
                  src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.bilinear)
        return aligned,elevation,sources
    return aligned,sources


def summarize(inside,before,after,slope):
    count=int(inside.sum());p={'vegetation_check':'unavailable','slope_check':'unavailable',
        'ndvi_before':None,'ndvi_after':None,'ndvi_drop':None,'vegetation_loss_percent':None,
        'paired_clear_percent':0.0,'slope_median_deg':None,'slope_coverage_percent':0.0}
    if not count:return p
    pair=inside&np.isfinite(before)&np.isfinite(after)
    p['paired_clear_percent']=round(100*pair.sum()/count,1)
    if pair.sum()/count>=RULES['min_pair_coverage'] and pair.sum()>=4:
        b,a=before[pair],after[pair]
        loss=(b>=RULES['min_before_ndvi'])&((b-a)>=RULES['min_ndvi_drop'])
        p.update(ndvi_before=round(float(np.median(b)),3),ndvi_after=round(float(np.median(a)),3),
                 ndvi_drop=round(float(np.median(b-a)),3),vegetation_loss_percent=round(float(loss.mean()*100),1),
                 vegetation_check='supports' if loss.mean()>=RULES['min_loss_fraction'] else 'not_supported')
    valid=inside&np.isfinite(slope);p['slope_coverage_percent']=round(100*valid.sum()/count,1)
    if valid.sum()/count>=RULES['min_slope_coverage']:
        median=float(np.median(slope[valid]));p['slope_median_deg']=round(median,1)
        p['slope_check']='supports' if median>=RULES['min_slope_degrees'] else 'not_supported'
    checks=[p['vegetation_check'],p['slope_check']]
    p['evidence_summary']='both_support' if checks==['supports','supports'] else ('incomplete' if 'unavailable' in checks else 'review')
    return p


def analyze(item,geojson,transform,crs,shape,bbox,job_dir,catalog,get_json,safe_asset,save_overlay,update):
    import mosaic
    empty=lambda:np.full(shape,np.nan,dtype='float32')
    before,after,slope=empty(),empty(),empty()
    meta={'rules':RULES,'before':None,'after':{'id':item['id'],'date':item['properties']['datetime']},
          'vegetation_status':'unavailable','terrain_status':'unavailable','warnings':[],
          'baseline_window_days':[7,90], 'dem_resolution_m':30,
          'method':'NDVI=(NIR-red)/(NIR+red), per-asset reflectance scale/offset; cloud-filtered paired pixels. Slope computed on a 30 m projected elevation grid.',
          'limitations':'Exploratory thresholds, not validated for Taiwan. Seasonal changes, agriculture and image misalignment can cause vegetation loss signals. An older landslide may show no new loss. Flat runout deposits can fail the slope check. Copernicus DEM is a surface model including vegetation/buildings, not current bare-earth terrain. Missing evidence is not negative evidence.'}
    # Evidence failure must never discard otherwise valid model detections.
    try:
        update('Comparing vegetation with an earlier clear image…',91)
        after=scene_ndvi(item,transform,crs,shape,safe_asset)
        meta['after']['calibration']=calibration(item)
        meta['after']['source_tiles']=mosaic.provenance(item,catalog)
        acquired=datetime.fromisoformat(item['properties']['datetime'].replace('Z','+00:00'))
        start=(acquired-timedelta(days=90)).date();end=(acquired-timedelta(days=7)).date()
        candidates=get_json(catalog+'/search',params={'collections':'sentinel-2-l2a',
            'bbox':','.join(map(str,bbox)),'datetime':f'{start}T00:00:00Z/{end}T23:59:59Z','limit':100}).get('features',[])
        candidates=[f for f in candidates if all(k in f['assets'] for k in ['red','nir','scl','visual'])]
        candidates=mosaic.group_passes(candidates)
        candidates.sort(key=lambda f:np.mean([t['properties'].get('eo:cloud_cover',100) for t in mosaic.tiles(f)]))
        candidates=candidates[:5]
        # Prefer common clear coverage within predicted regions, then whole crop.
        regions=[transform_geom('EPSG:4326',crs,f['geometry']) for f in geojson['features']]
        interest=geometry_mask(regions,shape,transform,invert=True) if regions else np.ones(shape,bool)
        ranked=[]
        for candidate in candidates:
            try:
                land=clear_land(mosaic.quality(candidate,transform,crs,shape,safe_asset)[0])
                pair=land&np.isfinite(after)
                ranked.append(((int((pair&interest).sum()),int(pair.sum()),candidate['properties']['datetime']),candidate,land))
            except Exception as exc:meta['warnings'].append('Earlier-scene quality read failed: '+str(exc)[:180])
        for _,candidate,land in sorted(ranked,key=lambda x:x[0],reverse=True):
            try:
                proposed=scene_ndvi(candidate,transform,crs,shape,safe_asset,land)
                if not (np.isfinite(proposed)&np.isfinite(after)).any():continue
                before=proposed;meta['before']={'id':candidate['id'],'date':candidate['properties']['datetime'],
                    'calibration':calibration(candidate),'source_tiles':mosaic.provenance(candidate,catalog),
                    'source_url':f'{catalog}/collections/sentinel-2-l2a/items/{candidate["id"]}'}
                meta['vegetation_status']='available';break
            except Exception as exc:meta['warnings'].append('Earlier-scene reflectance read failed: '+str(exc)[:180])
        if meta['before'] is None:meta['warnings'].append('No usable earlier image among the five clearest satellite passes 7–90 days before acquisition.')
        else:
            # A real before image, spatially aligned to the after image.
            try:
                rgb,valid=mosaic.rgb(candidate,transform,crs,shape,safe_asset)
                meta['before_overlay_bounds']=save_overlay(np.nan_to_num(rgb).clip(0,255).astype('uint8'),valid,transform,crs,job_dir/'before.png')
            except Exception as exc:meta['warnings'].append('Before preview unavailable: '+str(exc)[:180])
    except Exception as exc:meta['warnings'].append('Vegetation comparison unavailable: '+str(exc)[:220])
    try:
        update('Checking terrain slope from the 30 m elevation model…',95)
        slope,meta['dem_sources']=terrain(bbox,transform,crs,shape,catalog,get_json)
        meta['terrain_status']='available'
    except Exception as exc:meta['warnings'].append('Slope unavailable: '+str(exc)[:220])
    pair=np.isfinite(before)&np.isfinite(after);drop=before-after
    meta['paired_clear_percent']=round(float(pair.mean()*100),1)
    for feature in geojson['features']:
        from spatial import local_mask
        region,inside=local_mask(transform_geom('EPSG:4326',crs,feature['geometry']),shape,transform)
        feature['properties'].update(summarize(inside,before[region],after[region],slope[region]))
        feature['properties']['before_acquired']=meta['before']['date'] if meta['before'] else None
    meta['both_support_count']=sum(f['properties']['evidence_summary']=='both_support' for f in geojson['features'])
    # Warm colors = NDVI loss; green = gain/no loss. Transparent = unavailable.
    if pair.any():
        intensity=np.clip(np.nan_to_num(drop)/0.5,0,1)
        colors=np.stack([60+195*intensity,170-110*intensity,np.full(shape,60)])
        meta['vegetation_overlay_bounds']=save_overlay(colors.astype('uint8'),pair,transform,crs,job_dir/'vegetation.png')
    if np.isfinite(slope).any():
        intensity=np.clip(np.nan_to_num(slope)/60,0,1)
        colors=np.stack([50+205*intensity,100+40*intensity,180-140*intensity])
        meta['slope_overlay_bounds']=save_overlay(colors.astype('uint8'),np.isfinite(slope),transform,crs,job_dir/'slope.png')
    with rasterio.open(job_dir/'evidence.tif','w',driver='GTiff',height=shape[0],width=shape[1],count=4,
                       dtype='float32',crs=crs,transform=transform,nodata=np.nan,compress='deflate') as dst:
        for i,(name,array) in enumerate([('before_ndvi',before),('after_ndvi',after),('ndvi_drop_before_minus_after',drop),('slope_degrees_30m',slope)],1):
            dst.write(array,i);dst.set_band_description(i,name)
    return meta
