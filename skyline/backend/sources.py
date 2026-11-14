"""Data fetching: Open-Meteo (no key) and, when a key is set, Taiwan MOENV station readings."""
import os
import time

import httpx
import pandas as pd

LAT, LON = 24.1477, 120.6736  # Taichung City Hall, Xitun District
TZ = "Asia/Taipei"
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
FC_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
MOENV_URL = "https://data.moenv.gov.tw/api/v2/aqx_p_432"
MOENV_STATION = "忠明"  # Zhongming station, central Taichung

MODEL_WX = ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m",
            "wind_direction_10m", "surface_pressure", "boundary_layer_height"]

_cache: dict = {}


def _get(url: str, params: dict, ttl: int = 600) -> dict:
    key = url + repr(sorted(params.items()))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    r = httpx.get(url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    _cache[key] = (time.time(), data)
    return data


def hourly_frame(data: dict) -> pd.DataFrame:
    df = pd.DataFrame(data["hourly"])
    df.index = pd.to_datetime(df.pop("time"))
    return df


def weather() -> dict:
    return _get(FC_URL, {
        "latitude": LAT, "longitude": LON, "timezone": TZ,
        "past_days": 1, "forecast_days": 10,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,"
                   "weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
        "hourly": "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,"
                  "is_day,visibility,uv_index,dew_point_2m,relative_humidity_2m,cloud_cover,"
                  "wind_speed_10m,wind_direction_10m,pressure_msl",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,"
                 "precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
    })


def air() -> dict:
    return _get(AQ_URL, {
        "latitude": LAT, "longitude": LON, "timezone": TZ, "domains": "cams_global",
        "past_days": 2, "forecast_days": 4,
        "current": "us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,dust",
        "hourly": "pm2_5,pm10,us_aqi,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,dust",
    })


def model_inputs() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hourly frames covering yesterday..tomorrow for the live model."""
    aq = hourly_frame(_get(AQ_URL, {
        "latitude": LAT, "longitude": LON, "timezone": TZ, "domains": "cams_global",
        "past_days": 2, "forecast_days": 3, "hourly": "pm2_5,pm10",
    }))
    wx = hourly_frame(_get(FC_URL, {
        "latitude": LAT, "longitude": LON, "timezone": TZ,
        "past_days": 2, "forecast_days": 3, "hourly": ",".join(MODEL_WX),
    }))
    return aq, wx


def history(start: str, end: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hourly history for training (CAMS air quality + ERA5 weather)."""
    aq = hourly_frame(_get(AQ_URL, {
        "latitude": LAT, "longitude": LON, "timezone": TZ, "domains": "cams_global",
        "start_date": start, "end_date": end, "hourly": "pm2_5,pm10",
    }, ttl=0))
    wx = hourly_frame(_get(ARCHIVE_URL, {
        "latitude": LAT, "longitude": LON, "timezone": TZ,
        "start_date": start, "end_date": end, "hourly": ",".join(MODEL_WX),
    }, ttl=0))
    return aq, wx


def moenv_station() -> dict | None:
    """Latest official reading from MOENV's Zhongming station. Needs MOENV_API_KEY."""
    key = os.environ.get("MOENV_API_KEY")
    if not key:
        return None
    data = _get(MOENV_URL, {"api_key": key, "format": "json", "limit": 1000}, ttl=900)
    records = data["records"] if isinstance(data, dict) else data
    for rec in records:
        if rec.get("sitename") == MOENV_STATION:
            return {
                "station": "Zhongming (忠明)",
                "aqi": rec.get("aqi"),
                "status": rec.get("status"),
                "pm25": rec.get("pm2.5"),
                "pm10": rec.get("pm10"),
                "time": rec.get("publishtime"),
            }
    return None
