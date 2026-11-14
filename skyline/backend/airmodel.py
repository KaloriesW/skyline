"""Features, AQI maths and live prediction for the next-day PM2.5 / PM10 model."""
import json
from pathlib import Path

import numpy as np
import pandas as pd

MODEL_DIR = Path(__file__).parent / "model"
WX_DAY = ["temp", "rh", "rain", "wind", "u", "v", "pres", "blh"]
BAD_DAY_PM25 = 35.0  # µg/m³, US EPA 24-hour standard used by the brief


def daily_table(aq: pd.DataFrame, wx: pd.DataFrame) -> pd.DataFrame:
    """Hourly air quality + weather (local time index) -> one row per day."""
    df = aq.join(wx, how="inner")
    rad = np.deg2rad(df["wind_direction_10m"])
    df["u"] = -df["wind_speed_10m"] * np.sin(rad)
    df["v"] = -df["wind_speed_10m"] * np.cos(rad)
    g = df.groupby(df.index.normalize())
    d = pd.DataFrame({
        "pm25": g["pm2_5"].mean(),
        "pm25_max": g["pm2_5"].max(),
        "pm25_eve": g["pm2_5"].apply(lambda s: s.iloc[-6:].mean()),
        "pm10": g["pm10"].mean(),
        "temp": g["temperature_2m"].mean(),
        "rh": g["relative_humidity_2m"].mean(),
        "rain": g["precipitation"].sum(),
        "wind": g["wind_speed_10m"].mean(),
        "u": g["u"].mean(),
        "v": g["v"].mean(),
        "pres": g["surface_pressure"].mean(),
        "blh": g["boundary_layer_height"].mean(),
        "hours": g["pm2_5"].count(),
    })
    return d


def features(d: pd.DataFrame, tomorrow_weather: bool = True) -> pd.DataFrame:
    """Row t describes day t and is used to predict day t+1."""
    X = pd.DataFrame(index=d.index)
    for c in ["pm25", "pm25_max", "pm25_eve", "pm10"]:
        X[c] = d[c]
    X["pm25_prev"] = d["pm25"].shift(1)
    X["pm10_prev"] = d["pm10"].shift(1)
    for c in WX_DAY:
        X[c] = d[c]
    if tomorrow_weather:
        for c in WX_DAY:
            X["tmr_" + c] = d[c].shift(-1)
    tmr = d.index + pd.Timedelta(days=1)
    X["doy_sin"] = np.sin(2 * np.pi * tmr.dayofyear / 365.25)
    X["doy_cos"] = np.cos(2 * np.pi * tmr.dayofyear / 365.25)
    X["tmr_weekend"] = (tmr.dayofweek >= 5).astype(int)
    return X


# US EPA AQI breakpoints (2024 revision), 24-hour averages.
PM25_BP = [(0.0, 9.0, 0, 50), (9.1, 35.4, 51, 100), (35.5, 55.4, 101, 150),
           (55.5, 125.4, 151, 200), (125.5, 225.4, 201, 300), (225.5, 325.4, 301, 500)]
PM10_BP = [(0, 54, 0, 50), (55, 154, 51, 100), (155, 254, 101, 150),
           (255, 354, 151, 200), (355, 424, 201, 300), (425, 604, 301, 500)]
CATEGORIES = [
    (50, "Good", "#3ad06e"),
    (100, "Moderate", "#f5d33b"),
    (150, "Unhealthy for Sensitive Groups", "#ff8c32"),
    (200, "Unhealthy", "#ff4545"),
    (300, "Very Unhealthy", "#a35cd6"),
    (10**9, "Hazardous", "#8a1538"),
]


def _sub_index(c, bps):
    for lo, hi, ilo, ihi in bps:
        if c <= hi:
            return round((ihi - ilo) / (hi - lo) * (max(c, lo) - lo) + ilo)
    return 500


def aqi(pm25: float, pm10: float) -> int:
    return max(_sub_index(int(pm25 * 10) / 10, PM25_BP), _sub_index(int(pm10), PM10_BP))


def category(a: int):
    for top, name, color in CATEGORIES:
        if a <= top:
            return name, color


def school_advice(a: int) -> dict:
    if a <= 50:
        return {"level": "go", "title": "Outdoor PE as normal",
                "detail": "Air should be clean all day. Good day for sports practice outside."}
    if a <= 100:
        return {"level": "go", "title": "Outdoor PE OK",
                "detail": "Fine for most students. Students with asthma should keep their inhaler nearby."}
    if a <= 150:
        return {"level": "limit", "title": "Shorten hard outdoor exercise",
                "detail": "Sensitive students (asthma, heart or lung conditions) should do PE indoors or take it easy."}
    if a <= 200:
        return {"level": "indoor", "title": "Move PE indoors",
                "detail": "Everyone should cut down on long or hard activity outside."}
    return {"level": "indoor", "title": "Keep students indoors",
            "detail": "Avoid outdoor activity. Close windows if indoor air is filtered."}


class AirModel:
    def __init__(self):
        import joblib
        self.pm25 = joblib.load(MODEL_DIR / "pm25.joblib")
        self.pm10 = joblib.load(MODEL_DIR / "pm10.joblib")
        self.metrics = json.loads((MODEL_DIR / "metrics.json").read_text())

    def predict(self, d: pd.DataFrame, today: pd.Timestamp) -> dict:
        """d must contain rows for yesterday, today and tomorrow (tomorrow = forecast weather)."""
        X = features(d).loc[[today], self.metrics["features"]]
        p25 = max(0.0, float(self.pm25.predict(X)[0]))
        p10 = max(0.0, float(self.pm10.predict(X)[0]))
        lo25, hi25 = self.metrics["interval"]["pm25"]
        lo10, hi10 = self.metrics["interval"]["pm10"]
        a = aqi(p25, p10)
        name, color = category(a)
        today_aqi = aqi(float(d.loc[today, "pm25"]), float(d.loc[today, "pm10"]))
        return {
            "date": (today + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
            "pm25": round(p25, 1),
            "pm25_range": [round(max(0, p25 + lo25), 1), round(p25 + hi25, 1)],
            "pm10": round(p10, 1),
            "pm10_range": [round(max(0, p10 + lo10), 1), round(p10 + hi10, 1)],
            "aqi": a,
            "category": name,
            "color": color,
            "bad_day": p25 > BAD_DAY_PM25,
            "advice": school_advice(a),
            "today": {
                "pm25": round(float(d.loc[today, "pm25"]), 1),
                "pm10": round(float(d.loc[today, "pm10"]), 1),
                "aqi": today_aqi,
                "category": category(today_aqi)[0],
            },
            "baseline": {"pm25": round(float(d.loc[today, "pm25"]), 1),
                         "pm10": round(float(d.loc[today, "pm10"]), 1)},
            "tomorrow_weather": {
                "rain_mm": round(float(d.loc[today + pd.Timedelta(days=1), "rain"]), 1),
                "wind_kmh": round(float(d.loc[today + pd.Timedelta(days=1), "wind"]), 1),
            },
        }
