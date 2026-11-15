"""Next-day PM2.5 / PM10 for Taiwan's cities, in plain Python (standard library + httpx; no pandas,
scikit-learn or pickle).

This is a port of the team's "Model v2" code (branch `app`: skyline/backend/airmodel.py, sources.py,
server.py) with the coordinates as a parameter. train.py picks a model per city and target by
cross-validation (v1, ridge, boosted or blend) and writes it as numbers: a ridge as the scaler's mean/scale
plus coefficients, boosted trees as node tables. This module fetches the same live inputs as
sources.model_inputs(), rebuilds the daily table and the features, applies the numbers and returns the
same answer shape as the team's /api/predict, plus a `city` block.

test_predict.py checks that the daily table, the features and the predictions of every model kind match
pandas / scikit-learn on recorded rows; train.py checks every exported model on every row before writing it.
"""
from __future__ import annotations

import asyncio
import json
import math
from array import array
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

MODEL_DIR = Path(__file__).resolve().parent
FORMAT = 2  # the model file format this module reads (train.py's FORMAT)
DEFAULT_CITY = "taichung"
MAX_DISTANCE_KM = 25.0  # a point farther than this from every city centre gets no model answer
UPWIND_CACHE_SECONDS = 600  # the upwind points are the same for every city: fetched once, shared

TZ = "Asia/Taipei"
TAIPEI = timezone(timedelta(hours=8))  # Taiwan has no daylight saving time
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
FC_URL = "https://api.open-meteo.com/v1/forecast"
MODEL_WX = ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m",
            "wind_direction_10m", "surface_pressure", "boundary_layer_height"]
WX_DAY = ["temp", "rh", "rain", "wind", "u", "v", "pres", "blh"]
UPWIND = {  # CAMS points that pollution often blows in from (the team's four, used for every city)
    "north": (25.0, 121.2),      # Taoyuan / Hsinchu
    "fujian": (25.0, 119.0),     # mainland coast across the strait
    "southwest": (23.8, 120.3),  # Changhua / Yunlin coast (Mailiao)
    "south": (22.6, 120.3),      # Kaohsiung
}
PAST_DAYS, FORECAST_DAYS = 8, 3  # the last week (for the 7-day mean) .. tomorrow
BAD_DAY_PM25 = 35.0  # µg/m³, US EPA 24-hour standard used by the brief
KINDS = ("v1", "ridge", "boosted", "blend")
NAN = float("nan")


class UpstreamError(RuntimeError):
    """Open-Meteo could not be reached or answered with something unusable. The text is safe to show."""


class InputError(RuntimeError):
    """The live data does not cover the last week..tomorrow well enough to make a prediction."""


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


def upwind_daily(locations: List[dict]) -> Dict[str, Dict[str, float]]:
    """The multi-point answer for the UPWIND points -> {point name: {"YYYY-MM-DD": daily mean PM2.5}}
    (the team's sources.upwind(): the mean skips gaps)."""
    out: Dict[str, Dict[str, float]] = {}
    for name, loc in zip(UPWIND, locations):
        hourly = loc["hourly"]
        days: Dict[str, List[float]] = {}
        for t, v in zip(hourly["time"], hourly["pm2_5"]):
            days.setdefault(t[:10], []).append(_num(v))
        out[name] = {day: _mean(vals) for day, vals in days.items()}
    return out


def features(d: Dict[str, Dict[str, float]], today: date, up: Optional[Dict[str, Dict[str, float]]] = None) -> Dict[str, float]:
    """The feature row for `today` (it predicts today + 1), in the training column order.

    Without `up`: the first model's 25 features (needs yesterday, today and tomorrow in `d`).
    With `up` (upwind_daily()): the full 33, which also need the six days before today.
    """
    def row_of(offset: int) -> Optional[Dict[str, float]]:
        return d.get((today + timedelta(days=offset)).isoformat())

    row, prev, nxt = row_of(0), row_of(-1), row_of(1)
    if row is None or prev is None or nxt is None:
        raise InputError("the data does not cover yesterday, today and tomorrow")
    tmr = today + timedelta(days=1)
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
    if up is not None:
        def rolling(n: int) -> float:  # a gap anywhere in the window makes the mean a gap, as in pandas
            vals = [(row_of(-k) or {}).get("pm25", NAN) for k in range(n)]
            return math.fsum(vals) / n if all(v == v for v in vals) else NAN

        x["pm25_3d"] = rolling(3)
        x["pm25_7d"] = rolling(7)
        x["pm25_trend"] = row["pm25"] - prev["pm25"]
        for name in UPWIND:
            x["up_" + name] = up.get(name, {}).get(today.isoformat(), NAN)
        # A northerly wind tomorrow (v < 0) carries the northern air south.
        v_tmr = nxt["v"]
        x["north_push"] = x["up_north"] * (max(-v_tmr, 0.0) if v_tmr == v_tmr else NAN)
    return x


# ---------- the exported models ----------

def ridge_predict(ridge: Dict[str, Any], x: List[float]) -> float:
    """StandardScaler + Ridge: sum(coef * (x - mean) / scale) + intercept."""
    return math.fsum(c * (v - m) / s for c, v, m, s in zip(ridge["coef"], x, ridge["mean"], ridge["scale"])) \
        + ridge["intercept"]


def trees_predict(trees: Dict[str, Any], x: List[float]) -> float:
    """HistGradientBoostingRegressor: the baseline plus one leaf value per tree.

    In a split node a missing value (NaN) goes left when the node says so, otherwise x <= threshold goes
    left and anything larger goes right (scikit-learn's _predict_one_from_raw_data).
    """
    f, v, left, right, miss = trees["f"], trees["v"], trees["l"], trees["r"], trees["m"]
    total = trees["baseline"]
    for i in trees["root"]:
        while True:
            k = f[i]
            if k < 0:
                total += v[i]
                break
            xv = x[k]
            if xv != xv:
                i = left[i] if miss[i] else right[i]
            elif xv <= v[i]:
                i = left[i]
            else:
                i = right[i]
    return total


def predict_target(target: Dict[str, Any], x: List[float]) -> float:
    """One loaded target (load_target()) applied to its feature row."""
    kind = target["kind"]
    if kind == "boosted":
        return trees_predict(target["trees"], x)
    if kind == "blend":
        return (ridge_predict(target["ridge"], x) + trees_predict(target["trees"], x)) / 2
    return ridge_predict(target["ridge"], x)


def _load_ridge(doc: dict, n: int) -> dict:
    out = {k: [float(v) for v in doc[k]] for k in ("mean", "scale", "coef")}
    if any(len(out[k]) != n for k in out) or any(s == 0 or s != s for s in out["scale"]):
        raise ValueError("bad ridge")
    out["intercept"] = float(doc["intercept"])
    return out


def _load_trees(doc: dict, n_features: int) -> dict:
    """Node tables as written by train.export_trees() -> compact arrays with absolute child positions."""
    n = len(doc["f"])
    root = [int(i) for i in doc["root"]]
    if not root or root[0] != 0 or root != sorted(set(root)) or root[-1] >= n \
            or any(len(doc[k]) != n for k in ("v", "l", "r", "m")):
        raise ValueError("bad trees")
    f = array("h", doc["f"])
    v = array("d", (math.inf if t is None else float(t) for t in doc["v"]))  # null = +inf: every value goes left
    left, right = array("i", bytes(4 * n)), array("i", bytes(4 * n))
    ends = root[1:] + [n]
    for start, end in zip(root, ends):
        for i in range(start, end):
            if f[i] >= 0:
                if f[i] >= n_features:
                    raise ValueError("bad feature index")
                a, b = start + doc["l"][i], start + doc["r"][i]
                if not (i < a < end and i < b < end):  # children come after their parent, inside the same tree
                    raise ValueError("bad child index")
                left[i], right[i] = a, b
    return {"baseline": float(doc["baseline"]), "root": root, "f": f, "v": v, "l": left, "r": right,
            "m": bytes(1 if c == "1" else 0 for c in doc["m"])}


def load_target(doc: dict) -> dict:
    """Validate one target of a model file and turn it into what predict_target() wants."""
    kind, names = doc["kind"], list(doc["features"])
    if kind not in KINDS or not names or not all(isinstance(n, str) for n in names):
        raise ValueError("bad target")
    out: Dict[str, Any] = {"kind": kind, "features": names}
    if kind != "boosted":
        out["ridge"] = _load_ridge(doc["ridge"], len(names))
    if kind in ("boosted", "blend"):
        out["trees"] = _load_trees(doc["trees"], len(names))
    return out


def load_model(doc: dict) -> dict:
    """A model file (models/<city>.json) -> the loaded model predict() takes. Raises on anything unusable."""
    if doc.get("format") != FORMAT:
        raise ValueError("unknown model format")
    out = {k: v for k, v in doc.items() if k != "targets"}
    out["targets"] = {t: load_target(doc["targets"][t]) for t in ("pm25", "pm10")}
    for t in ("pm25", "pm10"):
        lo, hi = doc["interval"][t]
        float(lo), float(hi), float(doc["test_mae"][t]), float(doc["baseline_mae"][t])
    out["warn_threshold"] = float(doc.get("warn_threshold", BAD_DAY_PM25))
    return out


def needs_upwind(model: Dict[str, Any]) -> bool:
    """Only the 25-feature v1 model works without the upwind points."""
    return any(t["kind"] != "v1" for t in model["targets"].values())


def predict(model: Dict[str, Any], aq_hourly: Dict[str, list], wx_hourly: Dict[str, list],
            up: Optional[Dict[str, Dict[str, float]]], today: date) -> Dict[str, Any]:
    """The team's AirModel.predict() + the `model` block their server adds, for one city's loaded model.

    `up` is upwind_daily(...) and may be None when needs_upwind(model) is false.
    """
    d = daily_table(aq_hourly, wx_hourly)
    if up is None and needs_upwind(model):
        raise InputError("the upwind data is missing")
    feats = features(d, today, up)
    out = {}
    for t in ("pm25", "pm10"):
        target = model["targets"][t]
        try:
            x = [feats[name] for name in target["features"]]
        except KeyError as e:
            raise InputError(f"the model wants an unknown feature {e}") from None
        if any(v != v for v in x):
            missing = [n for n, v in zip(target["features"], x) if v != v]
            raise InputError("live data has gaps: " + ", ".join(missing[:6]))
        out[t] = max(0.0, predict_target(target, x))
    p25, p10 = out["pm25"], out["pm10"]
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
        "bad_day": p25 > model["warn_threshold"],
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
            "kind": model["targets"]["pm25"]["kind"],
            "test_mae": model["test_mae"]["pm25"],
            "baseline_mae": model["baseline_mae"]["pm25"],
        },
    }


# ---------- live inputs: the same requests as the team's sources.model_inputs() ----------

def input_requests(lat: float, lon: float) -> Tuple[Tuple[str, dict], Tuple[str, dict]]:
    """(url, params) for a city's air-quality and weather request: hourly, the last week..tomorrow."""
    return (
        (AQ_URL, {"latitude": lat, "longitude": lon, "timezone": TZ, "domains": "cams_global",
                  "past_days": PAST_DAYS, "forecast_days": FORECAST_DAYS, "hourly": "pm2_5,pm10"}),
        (FC_URL, {"latitude": lat, "longitude": lon, "timezone": TZ,
                  "past_days": PAST_DAYS, "forecast_days": FORECAST_DAYS, "hourly": ",".join(MODEL_WX)}),
    )


def upwind_request() -> Tuple[str, dict]:
    """(url, params) for the one multi-point request that covers the four upwind points."""
    return (AQ_URL, {"latitude": ",".join(str(p[0]) for p in UPWIND.values()),
                     "longitude": ",".join(str(p[1]) for p in UPWIND.values()),
                     "timezone": TZ, "domains": "cams_global", "hourly": "pm2_5",
                     "past_days": PAST_DAYS, "forecast_days": FORECAST_DAYS})


async def _get_json(client: Any, url: str, params: dict) -> Any:
    try:
        r = await client.get(url, params=params)
    except Exception as e:  # don't pass exception text on: it can contain the URL
        raise UpstreamError(e.__class__.__name__) from None
    if r.status_code != 200:
        raise UpstreamError(f"HTTP {r.status_code}")
    try:
        return r.json()
    except Exception:
        raise UpstreamError("unexpected answer") from None


def _hourly(doc: Any, needed: List[str]) -> Dict[str, list]:
    try:
        hourly = doc["hourly"]
        n = len(hourly["time"])
        if n == 0 or any(len(hourly[k]) != n for k in needed):
            raise ValueError
    except Exception:
        raise UpstreamError("unexpected answer") from None
    return hourly


async def fetch_inputs(client: Any, lat: float, lon: float) -> Tuple[Dict[str, list], Dict[str, list]]:
    """A city's two hourly blocks, with an httpx.AsyncClient. Raises UpstreamError with a short, URL-free reason."""
    (aq_url, aq_params), (wx_url, wx_params) = input_requests(lat, lon)
    aq, wx = await asyncio.gather(_get_json(client, aq_url, aq_params), _get_json(client, wx_url, wx_params))
    return _hourly(aq, ["pm2_5", "pm10"]), _hourly(wx, MODEL_WX)


async def fetch_upwind(client: Any) -> Dict[str, Dict[str, float]]:
    """Daily mean PM2.5 at the four upwind points (one request). Raises UpstreamError."""
    url, params = upwind_request()
    doc = await _get_json(client, url, params)
    if not isinstance(doc, list) or len(doc) != len(UPWIND):
        raise UpstreamError("unexpected answer")
    for loc in doc:
        _hourly(loc, ["pm2_5"])
    return upwind_daily(doc)


# ---------- cities and model files ----------

def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p = math.pi / 180
    h = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742.0 * math.asin(math.sqrt(h))


FALLBACK_CITIES = [{"id": "taichung", "name": "Taichung City", "name_zh": "臺中市", "lat": 24.1477, "lon": 120.6736}]


class Models:
    """cities.json, models/<city>.json, metrics/<city>.json and summary.json under one directory.

    Files are read on first use and kept. A ridge model is a few KB; a model with trees is a few hundred
    KB on disk and about 200 KB in memory (packed arrays).
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
        self._present: Optional[List[str]] = None
        self._metrics: Dict[str, Optional[bytes]] = {}
        self._summary: Optional[dict] = None

    def model(self, city_id: str) -> Optional[dict]:
        """The city's loaded model, or None when its file is missing or unusable."""
        if city_id not in self.by_id:
            return None
        if city_id not in self._models:
            try:
                m = load_model(json.loads((self.dir / "models" / f"{city_id}.json").read_text(encoding="utf-8")))
            except (OSError, ValueError, TypeError, KeyError, IndexError, OverflowError):
                m = None
            self._models[city_id] = m
        return self._models[city_id]

    def available(self) -> List[str]:
        """Cities with a model file in the current format. Looks at each file's first bytes only, so
        counting them (for /api/health) does not load every tree."""
        if self._present is None:
            present = []
            for c in self.cities:
                if c["id"] in self._models:
                    ok = self._models[c["id"]] is not None
                else:
                    try:
                        with open(self.dir / "models" / f"{c['id']}.json", "rb") as fh:
                            ok = fh.read(64).replace(b" ", b"").startswith(b'{"format":%d,' % FORMAT)
                    except OSError:
                        ok = False
                if ok:
                    present.append(c["id"])
            self._present = present
        return [cid for cid in self._present if self._models.get(cid, True) is not None]

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
