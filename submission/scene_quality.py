"""Operational imagery suitability gate; not a validated accuracy threshold."""
import math
MIN_USABLE_PERCENT = 50.0
MAX_PREFLIGHT_SCENES = 8

def assessment(percent):
    try: value=float(percent)
    except (TypeError,ValueError): value=None
    known=value is not None and math.isfinite(value) and 0 <= value <= 100
    passed=known and value >= MIN_USABLE_PERCENT
    measured=f"{value:.1f}%" if known else "unknown"
    return {"suitable":passed,"usable_percent":value if known else None,
            "minimum_percent":MIN_USABLE_PERCENT,
            "message":(f"Imagery quality passed: {measured} usable in the selected area." if passed else
                f"Imagery unsuitable: only {measured} usable in the selected area; at least {MIN_USABLE_PERCENT:g}% is required. "
                "Clouds, shadows, water or missing inputs leave the rest unassessed. Choose another acquisition. This is not a zero-landslide result."),
            "policy":"Operational screening minimum over the full selected footprint, not a validated model-accuracy guarantee."}

def require_usable(mask):
    quality=assessment(float(mask.mean())*100 if mask.size else None)
    if not quality['suitable']: raise ValueError(quality['message'])
    return quality

def saved_quality(result):
    return assessment(result.get('usable_percent'))
