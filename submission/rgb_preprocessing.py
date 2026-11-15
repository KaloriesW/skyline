"""Use the SAME image-only transform on dataset RGB and deployment RGB crops.
Input channels must be in R,G,B order. Not a conversion to physical reflectance.
"""
import numpy as np

def rgb_to_uint8(rgb, valid=None):
    rgb=np.asarray(rgb,dtype=np.float32)
    if rgb.ndim!=3 or rgb.shape[-1]!=3:raise ValueError('Expected HWC RGB')
    finite=np.isfinite(rgb).all(axis=-1)
    good=finite if valid is None else finite & np.asarray(valid,dtype=bool)
    if good.sum()<16:raise ValueError('Too few valid RGB pixels')
    low,high=np.percentile(rgb[good],[2,98],axis=0)
    scale=np.maximum(high-low,1e-6)
    out=np.rint(np.clip((np.nan_to_num(rgb)-low)/scale,0,1)*255).astype(np.uint8)
    out[~good]=0
    return out
