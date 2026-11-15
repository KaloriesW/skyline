"""Rasterize each candidate only within its local pixel window."""
import math
import numpy as np
from rasterio.features import bounds,geometry_mask
from rasterio.windows import from_bounds,Window,transform as window_transform


def local_mask(geometry,shape,transform):
    raw=from_bounds(*bounds(geometry),transform=transform)
    x0=max(0,min(shape[1],math.floor(raw.col_off)-1))
    y0=max(0,min(shape[0],math.floor(raw.row_off)-1))
    x1=max(x0,min(shape[1],math.ceil(raw.col_off+raw.width)+1))
    y1=max(y0,min(shape[0],math.ceil(raw.row_off+raw.height)+1))
    region=(slice(y0,y1),slice(x0,x1))
    if x0==x1 or y0==y1:return region,np.zeros((y1-y0,x1-x0),bool)
    window=Window(x0,y0,x1-x0,y1-y0)
    mask=geometry_mask([geometry],(y1-y0,x1-x0),window_transform(window,transform),invert=True)
    return region,mask
