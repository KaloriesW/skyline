"""Next-day PM2.5 / PM10 for Taiwan's cities, in plain Python (standard library + httpx; no pandas,
scikit-learn or pickle).

This is a port of the team's Taichung model code (branch `app`: skyline/backend/airmodel.py, sources.py,
server.py) with the coordinates as a parameter. train.py writes one small JSON per city (ridge coefficients
plus the scaler's mean/scale); this module fetches the same live inputs as sources.model_inputs(), rebuilds
the daily table and the features, applies the numbers and returns the same answer shape as the team's
/api/predict, plus a `city` block.

test_predict.py checks that the daily table, the features and the predictions match pandas/scikit-learn
on recorded rows.
"""
from __future__ import annotations

import asyncio
import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

MODEL_DIR = Path(__file__).resolve().parent
DEFAULT_CITY = "taichung"
MAX_DISTANCE_KM = 25.0  # a point farther than this from every city centre gets no model answer

TZ = "Asia/Taipei"
TAIPEI = timezone(timedelta(hours=8))  # Taiwan has no daylight saving time
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
FC_URL = "https://api.open-meteo.com/v1/forecast"
MODEL_WX = ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m",
            "wind_direction_10m", "surface_pressure", "boundary_layer_height"]
WX_DAY = ["temp", "rh", "rain", "wind", "u", "v", "pres", "blh"]
BAD_DAY_PM25 = 35.0  # µg/m³, US EPA 24-hour standard used by the brief
NAN = float("nan")


class UpstreamError(RuntimeError):
    """Open-Meteo could not be reached or answered with something unusable. The text is safe to show."""


class InputError(RuntimeError):
    """The live data does not cover yesterday..tomorrow well enough to make a prediction."""


def today_taipei() -> date:
    return datetime.now(TAIPEI).date()


# ---------- AQI maths and advice: copied from the team's airmodel.py ----------

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


# ---------- daily table and features, the pandas way without pandas ----------

def _num(v: Any) -> float:
    """JSON null (or anything that is not a finite number) is a gap, like NaN in pandas."""
    if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v):
        return float(v)
    return NAN


def _mean(vals: List[float]) -> float:
    ok = [v for v in vals if v == v]
    return math.fsum(ok) / len(ok) if ok else NAN


def _sum(vals: List[float]) -> float:
    return math.fsum(v for v in vals if v == v)  # all gaps -> 0.0, like pandas


def _max(vals: List[float]) -> float:
    ok = [v for v in vals if v == v]
    return max(ok) if ok else NAN


def daily_table(aq_hourly: Dict[str, list], wx_hourly: Dict[str, list]) -> Dict[str, Dict[str, float]]:
    """Open-Meteo `hourly` blocks (air quality, weather; local time) -> {"YYYY-MM-DD": daily row}.

    Same result as airmodel.daily_table(): hours present in both blocks, grouped by local day; means and
    sums skip gaps; `pm25_eve` is the mean of the day's last six hourly rows; `hours` counts PM2.5 values.
    """
    wx_at = {t: i for i, t in enumerate(wx_hourly["time"])}
    days: Dict[str, Dict[str, List[float]]] = {}
    for i, t in enumerate(aq_hourly["time"]):
        j = wx_at.get(t)
        if j is None:
            continue  # inner join
        row = days.setdefault(t[:10], {k: [] for k in ("pm2_5", "pm10", "u", "v", *MODEL_WX)})
        row["pm2_5"].append(_num(aq_hourly["pm2_5"][i]))
        row["pm10"].append(_num(aq_hourly["pm10"][i]))
        for k in MODEL_WX:
            row[k].append(_num(wx_hourly[k][j]))
        speed, rad = row["wind_speed_10m"][-1], math.radians(row["wind_direction_10m"][-1])
        row["u"].append(-speed * math.sin(rad))  # NaN when either part is a gap
        row["v"].append(-speed * math.cos(rad))
    out: Dict[str, Dict[str, float]] = {}
    for day in sorted(days):
        r = days[day]
        out[day] = {
            "pm25": _mean(r["pm2_5"]),
            "pm25_max": _max(r["pm2_5"]),
            "pm25_eve": _mean(r["pm2_5"][-6:]),
            "pm10": _mean(r["pm10"]),
            "temp": _mean(r["temperature_2m"]),
            "rh": _mean(r["relative_humidity_2m"]),
            "rain": _sum(r["precipitation"]),
            "wind": _mean(r["wind_speed_10m"]),
            "u": _mean(r["u"]),
            "v": _mean(r["v"]),
            "pres": _mean(r["surface_pressure"]),
            "blh": _mean(r["boundary_layer_height"]),
            "hours": float(sum(1 for v in r["pm2_5"] if v == v)),
        }
    return out


def features(d: Dict[str, Dict[str, float]], today: date) -> Dict[str, float]:
    """The feature row for `today` (it predicts today + 1). Needs yesterday, today and tomorrow in `d`."""
    tmr = today + timedelta(days=1)
    row, prev, nxt = d.get(today.isoformat()), d.get((today - timedelta(days=1)).isoformat()), d.get(tmr.isoformat())
    if row is None or prev is None or nxt is None:
        raise InputError("the data does not cover yesterday, today and tomorrow")
    x = {c: row[c] for c in ("pm25", "pm25_max", "pm25_eve", "pm10")}
    x["pm25_prev"] = prev["pm25"]
    x["pm10_prev"] = prev["pm10"]
    for c in WX_DAY:
        x[c] = row[c]
    for c in WX_DAY:
        x["tmr_" + c] = nxt[c]
    doy = tmr.timetuple().tm_yday
    x["doy_sin"] = math.sin(2 * math.pi * doy / 365.25)
    x["doy_cos"] = math.cos(2 * math.pi * doy / 365.25)
    x["tmr_weekend"] = 1.0 if tmr.weekday() >= 5 else 0.0
    return x


def ridge_predict(target: Dict[str, Any], x: List[float]) -> float:
    """StandardScaler + Ridge: sum(coef * (x - mean) / scale) + intercept."""
    return math.fsum(c * (v - m) / s for c, v, m, s in zip(target["coef"], x, target["mean"], target["scale"])) \
        + target["intercept"]


def predict(model: Dict[str, Any], aq_hourly: Dict[str, list], wx_hourly: Dict[str, list], today: date) -> Dict[str, Any]:
    """The team's AirModel.predict() + the `model` block their server adds, for one city's JSON model."""
    d = daily_table(aq_hourly, wx_hourly)
    feats = features(d, today)
    try:
        x = [feats[name] for name in model["features"]]
    except KeyError as e:
        raise InputError(f"the model wants an unknown feature {e}") from None
    if any(v != v for v in x):
        missing = [n for n, v in zip(model["features"], x) if v != v]
        raise InputError("live data has gaps: " + ", ".join(missing[:6]))
    p25 = max(0.0, ridge_predict(model["targets"]["pm25"], x))
    p10 = max(0.0, ridge_predict(model["targets"]["pm10"], x))
    lo25, hi25 = model["interval"]["pm25"]
    lo10, hi10 = model["interval"]["pm10"]
    a = aqi(p25, p10)
    name, color = category(a)
    now, nxt = d[today.isoformat()], d[(today + timedelta(days=1)).isoformat()]
    today_aqi = aqi(now["pm25"], now["pm10"])
    return {
        "date": (today + timedelta(days=1)).isoformat(),
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
            "pm25": round(now["pm25"], 1),
            "pm10": round(now["pm10"], 1),
            "aqi": today_aqi,
            "category": category(today_aqi)[0],
        },
        "baseline": {"pm25": round(now["pm25"], 1), "pm10": round(now["pm10"], 1)},
        "tomorrow_weather": {"rain_mm": round(nxt["rain"], 1), "wind_kmh": round(nxt["wind"], 1)},
        "model": {
            "kind": model.get("kind", "ridge"),
            "test_mae": model["test_mae"]["pm25"],
            "baseline_mae": model["baseline_mae"]["pm25"],
        },
    }


# ---------- live inputs: the same two requests as the team's sources.model_inputs() ----------

def input_requests(lat: float, lon: float) -> Tuple[Tuple[str, dict], Tuple[str, dict]]:
    """(url, params) for the air-quality and the weather request: hourly, yesterday..tomorrow and a bit more."""
    return (
        (AQ_URL, {"latitude": lat, "longitude": lon, "timezone": TZ, "domains": "cams_global",
                  "past_days": 2, "forecast_days": 3, "hourly": "pm2_5,pm10"}),
        (FC_URL, {"latitude": lat, "longitude": lon, "timezone": TZ,
                  "past_days": 2, "forecast_days": 3, "hourly": ",".join(MODEL_WX)}),
    )


async def fetch_inputs(client: Any, lat: float, lon: float) -> Tuple[Dict[str, list], Dict[str, list]]:
    """Fetch both hourly blocks with an httpx.AsyncClient. Raises UpstreamError with a short, URL-free reason."""

    async def one(url: str, params: dict, needed: List[str]) -> Dict[str, list]:
        try:
            r = await client.get(url, params=params)
        except Exception as e:  # don't pass exception text on: it can contain the URL
            raise UpstreamError(e.__class__.__name__) from None
        if r.status_code != 200:
            raise UpstreamError(f"HTTP {r.status_code}")
        try:
            hourly = r.json()["hourly"]
            n = len(hourly["time"])
            if n == 0 or any(len(hourly[k]) != n for k in needed):
                raise ValueError
        except Exception:
            raise UpstreamError("unexpected answer") from None
        return hourly

    (aq_url, aq_params), (wx_url, wx_params) = input_requests(lat, lon)
    aq, wx = await asyncio.gather(one(aq_url, aq_params, ["pm2_5", "pm10"]), one(wx_url, wx_params, MODEL_WX))
    return aq, wx


# ---------- cities and model files ----------

def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p = math.pi / 180
    h = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742.0 * math.asin(math.sqrt(h))


FALLBACK_CITIES = [{"id": "taichung", "name": "Taichung City", "name_zh": "臺中市", "lat": 24.1477, "lon": 120.6736}]


class Models:
    """cities.json, models/<city>.json, metrics/<city>.json and summary.json under one directory.

    Files are read on first use and kept; they are small (a model is about 4 KB, a metrics file about 20 KB).
    """

    def __init__(self, directory: Path = MODEL_DIR) -> None:
        self.dir = Path(directory)
        try:
            cities = json.loads((self.dir / "cities.json").read_text(encoding="utf-8"))
            self.cities: List[dict] = [c for c in cities if {"id", "name", "name_zh", "lat", "lon"} <= set(c)]
        except (OSError, ValueError, TypeError):
            self.cities = []
        if not self.cities:
            self.cities = [dict(c) for c in FALLBACK_CITIES]
        self.by_id = {c["id"]: c for c in self.cities}
        self._models: Dict[str, Optional[dict]] = {}
        self._metrics: Dict[str, Optional[bytes]] = {}
        self._summary: Optional[dict] = None

    def model(self, city_id: str) -> Optional[dict]:
        """The city's model, or None when its file is missing or unusable."""
        if city_id not in self.by_id:
            return None
        if city_id not in self._models:
            try:
                m = json.loads((self.dir / "models" / f"{city_id}.json").read_text(encoding="utf-8"))
                n = len(m["features"])
                for t in ("pm25", "pm10"):
                    if any(len(m["targets"][t][k]) != n for k in ("mean", "scale", "coef")) or len(m["interval"][t]) != 2:
                        raise ValueError
                    float(m["targets"][t]["intercept"]), float(m["test_mae"][t]), float(m["baseline_mae"][t])
            except (OSError, ValueError, TypeError, KeyError):
                m = None
            self._models[city_id] = m
        return self._models[city_id]

    def available(self) -> List[str]:
        return [c["id"] for c in self.cities if self.model(c["id"]) is not None]

    def metrics_json(self, city_id: str) -> Optional[bytes]:
        """The city's metrics file as stored (JSON bytes), or None."""
        if city_id not in self.by_id:
            return None
        if city_id not in self._metrics:
            try:
                raw = (self.dir / "metrics" / f"{city_id}.json").read_bytes()
                json.loads(raw)
            except (OSError, ValueError):
                raw = None
            self._metrics[city_id] = raw
        return self._metrics[city_id]

    def summary(self) -> dict:
        """summary.json with every city listed (coordinates always; scores when the city has been trained)."""
        if self._summary is None:
            try:
                doc = json.loads((self.dir / "summary.json").read_text(encoding="utf-8"))
                rows = {r["id"]: r for r in doc.get("cities", [])}
            except (OSError, ValueError, TypeError, KeyError, AttributeError):
                doc, rows = {}, {}
            ready = set(self.available())
            cities = []
            for c in self.cities:
                base = {k: c[k] for k in ("id", "name", "name_zh", "lat", "lon")}
                cities.append({**base, **rows.get(c["id"], {}), **base, "has_model": c["id"] in ready})
            self._summary = {**{k: v for k, v in doc.items() if k not in ("cities", "missing")},
                             "default_city": DEFAULT_CITY, "cities": cities,
                             "missing": [c["id"] for c in self.cities if c["id"] not in ready]}
        return self._summary

    def nearest(self, lat: float, lon: float) -> Tuple[dict, float]:
        """(city, distance in km) of the closest city centre."""
        best = min(self.cities, key=lambda c: distance_km(lat, lon, c["lat"], c["lon"]))
        return best, distance_km(lat, lon, best["lat"], best["lon"])

    @staticmethod
    def city_block(city: dict, km: float) -> dict:
        return {"id": city["id"], "name": city["name"], "name_zh": city["name_zh"],
                "lat": city["lat"], "lon": city["lon"], "distance_km": round(km, 1)}
