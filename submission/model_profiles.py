"""Versioned inference settings for the calibrated Sentinel-2 checkpoint."""
import hashlib
import json
from pathlib import Path
from rgb_preprocessing import rgb_to_uint8

KEY = 'sentinel2448'
HERE = Path(__file__).resolve().parent

def release(root=HERE):
    path = root / 'models' / 'sentinel2448.json'
    return json.loads(path.read_text()) if path.exists() else None

def profile(key, root=HERE):
    if key == 'unet13':
        import unet_inference
        return unet_inference.profile()
    if key != KEY:
        return dict(confidence=.35, tile_size=224, stride=168, max_det=100,
                    nms_iou=.7, preprocessing='TCI RGB; native 224-pixel overlapping tiles')
    data = release(root)
    if not data:
        raise ValueError('Sentinel-2 calibration is not ready.')
    return data

def verify(root=HERE):
    data = release(root)
    if not data or not .001 <= data['confidence'] <= .95:
        raise ValueError('Missing or invalid Sentinel-2 calibration.')
    if (data['tile_size'], data['stride'], data['imgsz'], data['max_det'], data['nms_iou']) != (128,96,448,1000,.7):
        raise ValueError('Unsupported Sentinel-2 inference settings.')
    with (root / 'models' / f'{KEY}.pt').open('rb') as f:
        digest = hashlib.file_digest(f, 'sha256').hexdigest()
    if digest != data['checkpoint_sha256']:
        raise ValueError('Calibrated checkpoint checksum mismatch.')
    return data
