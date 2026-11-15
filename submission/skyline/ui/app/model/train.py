"""Train next-day PM2.5 / PM10 models, one per Taiwan city/county, and export them as JSON.

This is the team's "Model v2" (branch `app`, skyline/backend/train.py + airmodel.py + sources.py, commit
0a863c3) with the city coordinates as the only parameter:

- Inputs: CAMS global PM2.5/PM10 and ERA5 weather, both hourly from Open-Meteo (no key), plus daily mean
  CAMS PM2.5 at four fixed upwind points (the same four for every city).
- Row t describes day t (plus tomorrow's weather) and predicts day t+1's mean PM2.5 / PM10.
- Feature sets: "v1" (the first model's 25 features), "full" (v1 + rolling means, trend, upwind PM2.5 and
  north_push = 33) and "nowx" (full without tomorrow's weather, for the report only).
- Candidates per target: v1 (ridge on v1), ridge (full), boosted (HistGradientBoosting on full) and
  blend (mean of that ridge and those trees).
- Split by time: the last 365 days are the test set, everything before (minus a 1-day gap) is training.
- Every choice (model per target, bad-day warning threshold) is made with rolling-origin cross-validation
  inside the training period: 4 folds of 91 days covering its last year. The test year is scored once.
- Baseline: "tomorrow = same as today".
- The live model is the cross-validation winner, refitted on every day, and exported as plain numbers:
  ridge as mean/scale/coef/intercept, trees as node tables. The server (predict.py) needs no
  scikit-learn, pandas or pickle. Each export is checked against scikit-learn on every row before it is
  written (the difference is recorded in the model file as `parity`).

Run (from a virtualenv with requirements-train.txt; keep the cache OUTSIDE the repo):

    python ui/app/model/train.py --cache-dir /some/dir/pm_data                 # every city still missing
    python ui/app/model/train.py --cache-dir /some/dir/pm_data --cities taichung,taipei
    python ui/app/model/train.py --cache-dir /some/dir/pm_data --force         # retrain everything

It is resumable: raw downloads are cached per city, cities whose output already exists for the same END
date and recipe are skipped, and summary.json is rewritten after every city.

Open-Meteo's free tier (https://open-meteo.com/en/pricing, read 2026-11-15): 600 calls/minute, 5,000/hour,
10,000/day. A request for more than two weeks or more than 10 variables counts as several calls
(fractionally: days/14 x variables/10), so one city's ~4.3 years costs about 110 calls per request and two
requests per city, and the four upwind points about 450 once. 22 cities are about 5,300 calls: under the
daily limit and over the hourly one, so downloads are spaced out (--pause) and 429s are retried with a
long back-off.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

# About 1,400 rows per city: one thread grows these trees faster than several (much faster on a busy
# machine) and gives the same sums every run. Set OMP_NUM_THREADS yourself to override.
os.environ.setdefault("OMP_NUM_THREADS", "1")

import httpx  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import sklearn  # noqa: E402
from sklearn.ensemble import HistGradientBoostingRegressor  # noqa: E402
from sklearn.linear_model import Ridge  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import predict as pyinfer  # noqa: E402  (the server-side, plain-Python inference: used to check every export)

FORMAT = 2  # model file format / recipe version; a city trained with another one is retrained
TZ = "Asia/Taipei"
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
MODEL_WX = ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m",
            "wind_direction_10m", "surface_pressure", "boundary_layer_height"]
WX_DAY = ["temp", "rh", "rain", "wind", "u", "v", "pres", "blh"]
BAD_DAY_PM25 = 35.0  # µg/m³, US EPA 24-hour standard used by the brief
UPWIND = {  # CAMS points that pollution often blows in from (the team's four, used for every city)
    "north": (25.0, 121.2),      # Taoyuan / Hsinchu
    "fujian": (25.0, 119.0),     # mainland coast across the strait
    "southwest": (23.8, 120.3),  # Changhua / Yunlin coast (Mailiao)
    "south": (22.6, 120.3),      # Kaohsiung
}

START = "2022-08-05"  # CAMS global data via Open-Meteo starts 2022-08-04
TEST_DAYS = 365
FOLDS, FOLD_DAYS = 4, 91
MIN_HOURS = 20
MIN_USABLE_DAYS = TEST_DAYS + FOLDS * FOLD_DAYS + 365  # refuse to train a city with less than this
PARITY_TOLERANCE = 1e-6
DATA_NOTE = "PM2.5/PM10: CAMS global via Open-Meteo (model estimates). Weather: ERA5 via Open-Meteo archive."


# ---------- features: copied from the team's airmodel.py v2 (must stay identical) ----------

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


def features(d: pd.DataFrame, up: pd.DataFrame | None = None, tomorrow_weather: bool = True) -> pd.DataFrame:
    """Row t describes day t and is used to predict day t+1.

    Without `up` this is the first model's 25 features. With `up` (daily upwind PM2.5) it adds
    rolling averages, the day-to-day trend and pollution levels upwind.
    """
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
    X["doy_sin"] = np.sin(2 * np.pi * tmr.day_of_year / 365.25)
    X["doy_cos"] = np.cos(2 * np.pi * tmr.day_of_year / 365.25)
    X["tmr_weekend"] = (tmr.day_of_week >= 5).astype(int)
    if up is not None:
        X["pm25_3d"] = d["pm25"].rolling(3).mean()
        X["pm25_7d"] = d["pm25"].rolling(7).mean()
        X["pm25_trend"] = d["pm25"] - d["pm25"].shift(1)
        for c in up.columns:
            X["up_" + c] = up[c].reindex(d.index)
        if tomorrow_weather:
            # A northerly wind tomorrow (v < 0) carries the northern air south.
            X["north_push"] = X["up_north"] * np.clip(-d["v"].shift(-1), 0, None)
    return X


def hourly_frame(data: dict) -> pd.DataFrame:
    df = pd.DataFrame(data["hourly"])
    df.index = pd.to_datetime(df.pop("time"))
    return df


def upwind_frame(locations: list) -> pd.DataFrame:
    """Daily mean CAMS PM2.5 at each UPWIND point, one column per point (the team's sources.upwind())."""
    cols = {}
    for name, loc in zip(UPWIND, locations):
        h = hourly_frame(loc)["pm2_5"]
        cols[name] = h.groupby(h.index.normalize()).mean()
    return pd.DataFrame(cols)


# ---------- polite, cached downloads ----------

class RateLimited(RuntimeError):
    """Open-Meteo said no (or could not be reached) and waiting a sensible time did not help."""


def _usable(data) -> bool:
    if isinstance(data, list):
        return len(data) > 0 and all(isinstance(x, dict) and "hourly" in x for x in data)
    return isinstance(data, dict) and "hourly" in data


class Downloader:
    def __init__(self, cache_dir: Path, pause: float, max_wait: float):
        self.cache_dir = cache_dir
        self.pause = pause          # seconds between two network requests
        self.max_wait = max_wait    # longest single back-off sleep we accept
        self.last = 0.0
        self.calls = 0
        self.client = httpx.Client(timeout=120, headers={"User-Agent": "skyline-train/1.0"})

    def get(self, name: str, url: str, params: dict):
        """Cached GET. `name` is the cache file name; a cached file is never re-downloaded."""
        path = self.cache_dir / name
        if path.exists():
            try:
                data = json.loads(path.read_text())
                if _usable(data):
                    return data
            except ValueError:
                pass  # a truncated file from an interrupted run: fetch again
        delay = 20.0
        for attempt in range(1, 9):
            wait = self.last + self.pause - time.time()
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            try:
                r = self.client.get(url, params=params)
            except httpx.HTTPError as e:
                print(f"    {name}: {e.__class__.__name__}, retry {attempt} in {delay:.0f}s", flush=True)
                time.sleep(delay)
                delay = min(delay * 2, 600)
                continue
            self.calls += 1
            if r.status_code == 200:
                data = r.json()
                if not _usable(data):
                    raise RuntimeError(f"{name}: unexpected answer")
                tmp = path.with_suffix(".tmp")
                tmp.write_text(json.dumps(data))
                tmp.replace(path)
                return data
            try:
                reason = str(r.json().get("reason", ""))
            except (ValueError, AttributeError):
                reason = r.text[:200]
            if r.status_code == 429:
                low = reason.lower()
                if "daily" in low:
                    raise RateLimited(f"daily limit reached: {reason}")
                sleep = 3660.0 if "hourly" in low else max(70.0, delay)  # minutely limit: a bit over a minute
                if sleep > self.max_wait:
                    raise RateLimited(f"{reason} (would need to wait {sleep:.0f}s; --max-wait is {self.max_wait:.0f}s)")
                print(f"    {name}: 429 {reason!r}, sleeping {sleep:.0f}s", flush=True)
                time.sleep(sleep)
            elif r.status_code >= 500:
                print(f"    {name}: HTTP {r.status_code}, retry {attempt} in {delay:.0f}s", flush=True)
                time.sleep(delay)
            else:
                raise RuntimeError(f"{name}: HTTP {r.status_code} {reason}")
            delay = min(delay * 2, 600)
        raise RateLimited(f"{name}: gave up after 8 attempts")

    def history(self, city: dict, start: str, end: str) -> tuple[dict, dict]:
        """Raw hourly history for one city (CAMS air quality + ERA5 weather), same requests as the team's sources.history()."""
        base = {"latitude": city["lat"], "longitude": city["lon"], "timezone": TZ, "start_date": start, "end_date": end}
        aq = self.get(f"{city['id']}_aq_{start}_{end}.json", AQ_URL,
                      {**base, "domains": "cams_global", "hourly": "pm2_5,pm10"})
        wx = self.get(f"{city['id']}_wx_{start}_{end}.json", ARCHIVE_URL, {**base, "hourly": ",".join(MODEL_WX)})
        return aq, wx

    def upwind(self, start: str, end: str) -> list:
        """Raw hourly PM2.5 at the four upwind points: one multi-point request, shared by every city."""
        return self.get(f"upwind_{start}_{end}.json", AQ_URL, {
            "latitude": ",".join(str(p[0]) for p in UPWIND.values()),
            "longitude": ",".join(str(p[1]) for p in UPWIND.values()),
            "timezone": TZ, "domains": "cams_global", "hourly": "pm2_5", "start_date": start, "end_date": end,
        })


# ---------- models and scores (the team's train.py v2) ----------

def hgb():
    return HistGradientBoostingRegressor(max_iter=200, learning_rate=0.05, max_leaf_nodes=31,
                                         min_samples_leaf=20, l2_regularization=1.0, random_state=0)


def ridge():
    return make_pipeline(StandardScaler(), Ridge(alpha=1.0))


class Blend:
    """Average of a Ridge regression and gradient-boosted trees."""

    def __init__(self):
        self.parts = [ridge(), hgb()]

    def fit(self, X, y):
        for m in self.parts:
            m.fit(X, y)
        return self

    def predict(self, X):
        return np.mean([m.predict(X) for m in self.parts], axis=0)


# name -> (model factory, feature set). "v1" is the first model the team shipped (Ridge, 25 features).
CANDIDATES = {"v1": (ridge, "v1"), "ridge": (ridge, "full"), "boosted": (hgb, "full"), "blend": (Blend, "full")}
EXTRA = {"blend_no_weather": (Blend, "nowx")}


def mae(a, b):
    return float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))


def rmse(a, b):
    return float(np.sqrt(np.mean((np.asarray(a) - np.asarray(b)) ** 2)))


def warn_scores(actual, pred, threshold=BAD_DAY_PM25):
    act, prd = np.asarray(actual) > BAD_DAY_PM25, np.asarray(pred) > threshold
    tp = int((act & prd).sum())
    return {
        "threshold": threshold,
        "bad_days": int(act.sum()),
        "warned": int(prd.sum()),
        "caught": tp,
        "precision": float(tp / prd.sum()) if prd.sum() else None,
        "recall": float(tp / act.sum()) if act.sum() else None,
    }


def cv_predict(make, X, y, train_idx):
    """Out-of-fold predictions for the last FOLDS*FOLD_DAYS training days (expanding window)."""
    pred = pd.Series(np.nan, index=train_idx)
    end = train_idx.max()
    for k in range(FOLDS, 0, -1):
        v0 = end - pd.Timedelta(days=k * FOLD_DAYS - 1)
        val = train_idx[(train_idx >= v0) & (train_idx < v0 + pd.Timedelta(days=FOLD_DAYS))]
        fit = train_idx[train_idx < v0 - pd.Timedelta(days=1)]  # 1-day gap, as for the test year
        pred[val] = make().fit(X.loc[fit], y[fit]).predict(X.loc[val])
    return pred.dropna()


def f2(w):
    """F2 score: like F1 but a missed bad day counts twice as much as a false alarm."""
    p, r = w["precision"] or 0, w["recall"] or 0
    return 5 * p * r / (4 * p + r) if p + r else 0.0


def tune_threshold(actual, pred):
    """Warning threshold (predicted PM2.5 above it -> warn) with the best F2 score."""
    return max((float(t) for t in np.arange(20, BAD_DAY_PM25 + 0.1, 0.5)),
               key=lambda t: (f2(warn_scores(actual, pred, t)), t))


# ---------- export to plain numbers ----------

def export_ridge(pipe) -> dict:
    """StandardScaler + Ridge: prediction = sum(coef * (x - mean) / scale) + intercept."""
    scaler, reg = pipe.named_steps["standardscaler"], pipe.named_steps["ridge"]
    return {
        "mean": [float(v) for v in scaler.mean_],
        "scale": [float(v) for v in scaler.scale_],
        "coef": [float(v) for v in reg.coef_],
        "intercept": float(reg.intercept_),
    }


def export_trees(model: HistGradientBoostingRegressor) -> dict:
    """HistGradientBoostingRegressor as node tables, one flat set of parallel arrays for all trees.

    Checked against scikit-learn 1.9.1 (ensemble/_hist_gradient_boosting: gradient_boosting.py
    `_raw_predict`, `_predictor.pyx` `_predict_one_from_raw_data`, grower.py `make_predictor`):
    prediction = _baseline_prediction + sum over iterations of one tree's leaf value (the learning rate is
    already in the leaf values); in a split node a NaN goes left when missing_go_to_left, otherwise
    x <= num_threshold goes left; num_threshold is +inf when every non-missing value goes left.

    Per node: f = feature index (-1 = leaf), v = num_threshold of a split (null = +inf) or the value of a
    leaf, l / r = children as positions inside the node's own tree, m = "1" when a missing value goes left.
    `root` holds each tree's first position in the flat arrays.
    """
    if model.n_trees_per_iteration_ != 1 or getattr(model, "_preprocessor", None) is not None:
        raise ValueError("only single-output trees on numeric features can be exported")
    base = np.asarray(model._baseline_prediction, dtype=float).ravel()
    if base.size != 1:
        raise ValueError("unexpected baseline prediction shape")
    f, v, left, right, m, root = [], [], [], [], [], []
    for (predictor,) in model._predictors:
        root.append(len(f))
        for node in predictor.nodes:
            if node["is_leaf"]:
                f.append(-1), v.append(float(node["value"])), left.append(0), right.append(0), m.append("0")
            else:
                if node["is_categorical"]:
                    raise ValueError("categorical splits cannot be exported")
                threshold = float(node["num_threshold"])
                f.append(int(node["feature_idx"]))
                v.append(None if math.isinf(threshold) else threshold)
                left.append(int(node["left"])), right.append(int(node["right"]))
                m.append("1" if node["missing_go_to_left"] else "0")
    return {"baseline": float(base[0]), "root": root, "f": f, "v": v, "l": left, "r": right, "m": "".join(m)}


def export_target(kind: str, fitted, columns: list[str]) -> dict:
    """One target's live model, by candidate name."""
    out = {"kind": kind, "features": list(columns)}
    if kind in ("v1", "ridge"):
        out["ridge"] = export_ridge(fitted)
    elif kind == "boosted":
        out["trees"] = export_trees(fitted)
    elif kind == "blend":
        out["ridge"], out["trees"] = export_ridge(fitted.parts[0]), export_trees(fitted.parts[1])
    else:
        raise ValueError(kind)
    return out


def parity(exported: dict, fitted, X: pd.DataFrame) -> float:
    """Largest |plain-Python prediction - scikit-learn prediction| over the rows of X, through a JSON round trip."""
    loaded = pyinfer.load_target(json.loads(json.dumps(exported)))
    want = np.asarray(fitted.predict(X), dtype=float)
    got = np.array([pyinfer.predict_target(loaded, row) for row in X.to_numpy(dtype=float).tolist()])
    return float(np.max(np.abs(got - want)))


def end_to_end_parity(d: pd.DataFrame, aq_raw: dict, wx_raw: dict, up_raw: list, exported: dict, fitted, X: pd.DataFrame) -> dict:
    """The whole serving path against the whole training path, on the city's history.

    Serving: raw hourly rows -> predict.py's daily table and features -> the JSON model.
    Training: pandas daily table and features (X) -> the scikit-learn model.
    Compared on every usable day whose week before and day after are all in the pandas table (around a hole
    in the data pandas works on neighbouring rows where the server insists on neighbouring days).
    Boosted trees split exactly on values seen in training, so this only agrees when predict.py rebuilds
    every feature to the last bit; `over_tolerance` counts the days where it did not.
    """
    table = {day: row for day, row in pyinfer.daily_table(aq_raw["hourly"], wx_raw["hourly"]).items()
             if row["hours"] >= MIN_HOURS}  # the same days training kept
    up = pyinfer.upwind_daily(up_raw)
    rolled = pyinfer.rolling_pm25(table)
    loaded = pyinfer.load_target(json.loads(json.dumps(exported)))
    have = set(d.index)
    want = np.asarray(fitted.predict(X), dtype=float)
    rows, worst, over = 0, 0.0, 0
    for day, w in zip(X.index, want):
        if any(day + pd.Timedelta(days=k) not in have for k in range(-7, 2)):
            continue
        feats = pyinfer.features(table, day.date(), up, rolled)
        diff = abs(pyinfer.predict_target(loaded, [feats[c] for c in exported["features"]]) - w)
        rows, worst, over = rows + 1, max(worst, diff), over + (diff > PARITY_TOLERANCE)
    return {"rows": rows, "max_diff": float(worst), "over_tolerance": int(over)}


# ---------- one city ----------

def prepare(aq_raw: dict, wx_raw: dict, up: pd.DataFrame):
    """Raw downloads -> (daily table, {feature set: frame}, targets), usable rows only (the team's filter)."""
    d = daily_table(hourly_frame(aq_raw), hourly_frame(wx_raw))
    d = d[d["hours"] >= MIN_HOURS]
    X = {"full": features(d, up), "nowx": features(d, up, tomorrow_weather=False), "v1": features(d)}
    targets = pd.DataFrame({"pm25": d["pm25"].shift(-1), "pm10": d["pm10"].shift(-1)}, index=d.index)
    # The target day must exist (consecutive days only), and every feature set must be complete.
    nxt = d.index.to_series().shift(-1)
    ok = (nxt - d.index.to_series() == pd.Timedelta(days=1)) & X["full"].notna().all(axis=1) \
        & targets.notna().all(axis=1)
    return d, {k: v[ok] for k, v in X.items()}, targets[ok]


def train_city(city: dict, aq_raw: dict, wx_raw: dict, up_raw: list, up: pd.DataFrame, end: str) -> tuple[dict, dict, dict]:
    """Returns (model json, metrics json, {"X": feature frames, "targets": frame}) for one city."""
    d, X, targets = prepare(aq_raw, wx_raw, up)
    full = X["full"]
    if len(full) < MIN_USABLE_DAYS:
        raise ValueError(f"only {len(full)} usable days (need {MIN_USABLE_DAYS}); days with PM data: {len(d)}"
                         + (f", first {d.index.min():%Y-%m-%d}" if len(d) else ""))

    test_start = full.index.max() - pd.Timedelta(days=TEST_DAYS - 1)
    train_mask = full.index < test_start - pd.Timedelta(days=1)  # 1-day gap so no target overlaps the test inputs
    test_mask = full.index >= test_start
    train_idx = full.index[train_mask]

    results, chosen, series, failures, intervals, monthly, cv, feature_cols = {}, {}, {}, [], {}, {}, {}, {}
    exported, parity_diff = {}, {}
    warn_threshold, cv_warn = BAD_DAY_PM25, {}
    test_dates = full.index[test_mask]
    for target in ["pm25", "pm10"]:
        y = targets[target]
        # 1. Choose the model with cross-validation on training days.
        #    The blend is the mean of that ridge and those trees fitted on the same rows, so its predictions
        #    are taken as the mean of theirs instead of growing the same trees twice (check_blend_shortcut()
        #    confirms this equals fitting Blend).
        oof = {name: cv_predict(make, X[fs], y, train_idx) for name, (make, fs) in CANDIDATES.items() if name != "blend"}
        oof["blend"] = (oof["ridge"] + oof["boosted"]) / 2
        cv_idx = oof["ridge"].index
        cv[target] = {name: mae(y[cv_idx], p) for name, p in oof.items()}
        cv[target]["baseline"] = mae(y[cv_idx], full.loc[cv_idx, target])
        best = min(CANDIDATES, key=lambda n: cv[target][n])
        chosen[target] = best
        if target == "pm25":
            warn_threshold = tune_threshold(y[cv_idx], oof[best])
            cv_warn = {"baseline": warn_scores(y[cv_idx], full.loc[cv_idx, "pm25"]),
                       "model_35": warn_scores(y[cv_idx], oof[best]),
                       "model_tuned": warn_scores(y[cv_idx], oof[best], warn_threshold)}

        # 2. Refit on all training days, score once on the test year.
        preds = {"baseline": full.loc[test_mask, target].values}
        for name, (make, fs) in {**CANDIDATES, **EXTRA}.items():
            if name == "blend":
                preds[name] = np.mean([preds["ridge"], preds["boosted"]], axis=0)
                continue
            m = make().fit(X[fs][train_mask], y[train_mask])
            preds[name] = m.predict(X[fs][test_mask])
        actual = y[test_mask].values
        results[target] = {name: {"mae": mae(actual, p), "rmse": rmse(actual, p)} for name, p in preds.items()}
        results[target]["cv_mae"] = cv[target]
        main_pred = preds[best]
        resid = actual - main_pred
        intervals[target] = [float(np.percentile(resid, 10)), float(np.percentile(resid, 90))]
        series[target] = {
            "actual": np.round(actual, 1).tolist(),
            "model": np.round(main_pred, 1).tolist(),
            "baseline": np.round(preds["baseline"], 1).tolist(),
        }
        months = test_dates.to_period("M")
        monthly[target] = [
            {"month": str(mo), "model": round(mae(actual[months == mo], main_pred[months == mo]), 3),
             "baseline": round(mae(actual[months == mo], preds["baseline"][months == mo]), 3)}
            for mo in months.unique()
        ]
        if target == "pm25":
            results["warnings"] = {name: warn_scores(actual, p) for name, p in preds.items()}
            results["warnings"]["tuned"] = warn_scores(actual, main_pred, warn_threshold)
            worst = np.argsort(-np.abs(resid))[:5]
            rows = np.where(test_mask)[0]
            failures = [{
                "date": (test_dates[i] + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
                "actual": round(float(actual[i]), 1),
                "model": round(float(main_pred[i]), 1),
                "baseline": round(float(preds["baseline"][i]), 1),
                "tomorrow_rain_mm": round(float(full["tmr_rain"].iloc[rows[i]]), 1),
                "tomorrow_wind_kmh": round(float(full["tmr_wind"].iloc[rows[i]]), 1),
            } for i in worst]

        # 3. Live model: same recipe, refit on every day we have (train + test), exported and checked.
        make, fs = CANDIDATES[best]
        feature_cols[target] = list(X[fs].columns)
        final = make().fit(X[fs], y)
        exported[target] = export_target(best, final, feature_cols[target])
        export_diff = parity(exported[target], final, X[fs])
        if not export_diff < PARITY_TOLERANCE:
            raise RuntimeError(f"{target}: the exported {best} model differs from scikit-learn by {export_diff:.3g}")
        parity_diff[target] = {"export": export_diff,
                               "end_to_end": end_to_end_parity(d, aq_raw, wx_raw, up_raw, exported[target], final, X[fs])}

    notes = []
    for target in ["pm25", "pm10"]:
        r, best = results[target], chosen[target]
        winner = min(CANDIDATES, key=lambda n: r[n]["mae"])
        if winner != best:
            notes.append(f"{target}: cross-validation chose {best} (test-year MAE {r[best]['mae']:.3f}); "
                         f"{winner} did better on the test year ({r[winner]['mae']:.3f}). The choice was not changed.")
        if r[best]["mae"] >= r["baseline"]["mae"]:
            notes.append(f"{target}: the chosen {best} model does NOT beat the 'same as today' baseline on the test year "
                         f"(MAE {r[best]['mae']:.3f} vs {r['baseline']['mae']:.3f}).")

    city_info = {
        "id": city["id"], "name": city["name"], "name_zh": city["name_zh"], "lat": city["lat"], "lon": city["lon"],
        # The grid points Open-Meteo actually answered from. CAMS global is coarse (~0.4°, about 40 km):
        # neighbouring cities can share one PM grid cell.
        "aq_grid": [aq_raw.get("latitude"), aq_raw.get("longitude")],
        "wx_grid": [wx_raw.get("latitude"), wx_raw.get("longitude")],
    }
    upwind = {k: list(v) for k, v in UPWIND.items()}
    metrics = {
        "trained_on": f"{full.index.min():%Y-%m-%d} .. {full.index[train_mask].max():%Y-%m-%d}",
        "tested_on": f"{test_dates.min():%Y-%m-%d} .. {test_dates.max():%Y-%m-%d}",
        "cv_on": f"{train_idx[-FOLDS * FOLD_DAYS]:%Y-%m-%d} .. {train_idx.max():%Y-%m-%d} ({FOLDS} folds)",
        "n_train": int(train_mask.sum()),
        "n_test": int(test_mask.sum()),
        "features": feature_cols,
        "upwind": upwind,
        "chosen": chosen,
        "results": results,
        "warn_threshold": warn_threshold,
        "cv_warnings": cv_warn,
        "interval": intervals,
        "monthly": monthly,
        "failures": failures,
        "test_dates": [(t + pd.Timedelta(days=1)).strftime("%Y-%m-%d") for t in test_dates],
        "series": series,
        "bad_day_threshold": BAD_DAY_PM25,
        "data": DATA_NOTE,
        # Not in the team's file: which city this is, honest remarks, and what data there was.
        "city": city_info,
        "notes": notes,
        "data_range": {"requested": f"{START} .. {end}", "first_day": f"{d.index.min():%Y-%m-%d}",
                       "last_day": f"{d.index.max():%Y-%m-%d}", "days_with_data": int(len(d)),
                       "usable_days": int(len(full))},
    }
    model = {
        "format": FORMAT,
        "city": city_info,
        "sklearn": sklearn.__version__,  # the version the trees were grown and read with (see export_trees)
        "pandas": pd.__version__,        # predict.py adds daily sums up in this version's order
        "chosen": chosen,
        "targets": exported,
        "interval": intervals,
        "warn_threshold": warn_threshold,
        "bad_day_threshold": BAD_DAY_PM25,
        "upwind": upwind,
        "test_mae": {t: round(results[t][chosen[t]]["mae"], 2) for t in ["pm25", "pm10"]},
        "baseline_mae": {t: round(results[t]["baseline"]["mae"], 2) for t in ["pm25", "pm10"]},
        # Checked when this file was written. export: the JSON model against scikit-learn on every training
        # row. end_to_end: predict.py from the raw hourly rows against pandas + scikit-learn (see train.py).
        "parity": parity_diff,
        "trained_through": f"{full.index.max():%Y-%m-%d}",
        "n_days": int(len(full)),
        "end": end,
    }
    return model, metrics, {"X": X, "targets": targets, "train_idx": train_idx, "train_mask": train_mask, "test_mask": test_mask}


def check_blend_shortcut(fitted: dict) -> float:
    """train_city() takes the blend's predictions as the mean of the ridge's and the trees' instead of
    fitting the team's Blend class again. This fits Blend the long way (cross-validation folds and the
    test year, PM2.5) and returns the largest difference between the two; it should be exactly 0."""
    X, y, idx = fitted["X"]["full"], fitted["targets"]["pm25"], fitted["train_idx"]
    long_way = cv_predict(Blend, X, y, idx)
    short = (cv_predict(ridge, X, y, idx) + cv_predict(hgb, X, y, idx)) / 2
    worst = float(np.max(np.abs(long_way - short)))
    tr, te = fitted["train_mask"], fitted["test_mask"]
    long_way = Blend().fit(X[tr], y[tr]).predict(X[te])
    short = np.mean([ridge().fit(X[tr], y[tr]).predict(X[te]), hgb().fit(X[tr], y[tr]).predict(X[te])], axis=0)
    return max(worst, float(np.max(np.abs(long_way - short))))


# ---------- summary ----------

def _warn_row(w: dict) -> dict:
    rnd = lambda v: None if v is None else round(v, 3)  # noqa: E731
    return {"threshold": w["threshold"], "bad_days": w["bad_days"], "warned": w["warned"], "caught": w["caught"],
            "false_alarms": w["warned"] - w["caught"], "missed": w["bad_days"] - w["caught"],
            "precision": rnd(w["precision"]), "recall": rnd(w["recall"])}


def summary_row(m: dict) -> dict:
    row = {**{k: m["city"][k] for k in ["id", "name", "name_zh", "lat", "lon"]},
           "n_train": m["n_train"], "n_test": m["n_test"], "tested_on": m["tested_on"], "cv_on": m["cv_on"],
           "chosen": m["chosen"]}
    for t in ["pm25", "pm10"]:
        r, best = m["results"][t], m["chosen"][t]
        base, model = r["baseline"]["mae"], r[best]["mae"]
        row[t] = {
            "chosen": best,
            "baseline_mae": round(base, 3), "model_mae": round(model, 3),
            "improvement_pct": round(100 * (base - model) / base, 1),
            "beats_baseline": bool(model < base),
            "cv_mae": {k: round(v, 3) for k, v in r["cv_mae"].items()},
            "test_mae": {k: round(v["mae"], 3) for k, v in r.items() if k != "cv_mae"},
            "best_on_test": min(CANDIDATES, key=lambda n: r[n]["mae"]),
        }
    w = m["results"]["warnings"]
    row["warn_threshold"] = m["warn_threshold"]
    row["warnings"] = {"at_35": _warn_row(w[m["chosen"]["pm25"]]), "tuned": _warn_row(w["tuned"]),
                       "baseline": _warn_row(w["baseline"])}
    row["notes"] = m.get("notes", [])
    return row


def write_summary(cities: list[dict], out_dir: Path) -> list[dict]:
    rows, missing = [], []
    for c in cities:
        try:
            model = json.loads((out_dir / "models" / f"{c['id']}.json").read_text())
            if model.get("format") != FORMAT:
                raise ValueError("old format")
            rows.append(summary_row(json.loads((out_dir / "metrics" / f"{c['id']}.json").read_text())))
        except (OSError, ValueError, KeyError):
            missing.append(c["id"])
    doc = {"model": "v2: cross-validation winner per city and target (v1, ridge, boosted or blend)",
           "bad_day_threshold": BAD_DAY_PM25, "data": DATA_NOTE, "baseline": "tomorrow = same as today",
           "upwind": {k: list(v) for k, v in UPWIND.items()}, "cities": rows, "missing": missing}
    (out_dir / "summary.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    return rows


# ---------- parity fixture ----------

def write_parity_fixture(path: Path, city: dict, model: dict, aq_raw: dict, wx_raw: dict, up_raw: list,
                         fitted: dict, days: int = 30) -> None:
    """A recorded slice (the last `days` days of raw hourly input) with the pandas features and the
    scikit-learn predictions of every model kind for it, so a test can check the plain-Python path
    without pandas, scikit-learn or a network.

    All four kinds are fitted on every day for PM2.5 (v1, ridge, boosted, blend) and v1 for PM10, whatever
    cross-validation chose; `model` in the fixture is the city's model file with pm25 = blend and pm10 = v1.
    A few values are blanked on purpose so the missing-value rules (mean/sum skip gaps, the evening mean
    uses the last six hourly rows) are covered too.
    """
    n = days * 24

    def tail(raw: dict) -> dict:
        return {"hourly": {k: list(v[-n:]) for k, v in raw["hourly"].items()}}

    aq, wx = tail(aq_raw), tail(wx_raw)
    up = [{"latitude": loc.get("latitude"), "longitude": loc.get("longitude"), **tail(loc)} for loc in up_raw]
    blanks = {"aq": [["pm2_5", 9 * 24 + 5], ["pm2_5", 9 * 24 + 22], ["pm10", 9 * 24 + 5], ["pm2_5", 12 * 24 + 23]],
              "wx": [["precipitation", 10 * 24 + 7], ["wind_direction_10m", 11 * 24 + 12], ["boundary_layer_height", 11 * 24 + 3]],
              "up": [[0, 13 * 24 + 4], [2, 14 * 24 + 20]]}
    for src, frame in (("aq", aq), ("wx", wx)):
        for name, i in blanks[src]:
            frame["hourly"][name][i] = None
    for k, i in blanks["up"]:
        up[k]["hourly"]["pm2_5"][i] = None

    d = daily_table(hourly_frame(aq), hourly_frame(wx))
    up_daily = upwind_frame(up)
    Xf, Xv = features(d, up_daily), features(d)
    ok = Xf.notna().all(axis=1)
    X, y = fitted["X"], fitted["targets"]
    sk = {
        "v1": ridge().fit(X["v1"], y["pm25"]), "ridge": ridge().fit(X["full"], y["pm25"]),
        "boosted": hgb().fit(X["full"], y["pm25"]), "blend": Blend().fit(X["full"], y["pm25"]),
        "pm10_v1": ridge().fit(X["v1"], y["pm10"]),
    }
    cols = {"v1": list(Xv.columns), "full": list(Xf.columns)}
    kinds = {k: export_target(k, sk[k], cols["v1" if k == "v1" else "full"]) for k in ("v1", "ridge", "boosted", "blend")}
    # The blend's two parts are the same fits as the "ridge" and "boosted" candidates, so the fixture
    # stores them once (in model.targets.pm25) and the test takes the ridge and boosted kinds from there.
    if kinds["boosted"]["trees"] != kinds["blend"]["trees"] or kinds["ridge"]["ridge"] != kinds["blend"]["ridge"]:
        raise RuntimeError("the blend's parts differ from the ridge / boosted candidates")
    fixture_model = copy.deepcopy(model)
    fixture_model["chosen"] = {"pm25": "blend", "pm10": "v1"}
    fixture_model["targets"] = {"pm25": kinds["blend"], "pm10": export_target("v1", sk["pm10_v1"], cols["v1"])}
    rows = []
    for day in Xf.index[ok]:
        xf, xv = Xf.loc[[day]], Xv.loc[[day]]
        rows.append({
            "today": f"{day:%Y-%m-%d}",
            "features": [float(v) for v in xf.iloc[0]],
            "pm25": {"v1": float(sk["v1"].predict(xv)[0]), "ridge": float(sk["ridge"].predict(xf)[0]),
                     "boosted": float(sk["boosted"].predict(xf)[0]), "blend": float(sk["blend"].predict(xf)[0])},
            "pm10": {"v1": float(sk["pm10_v1"].predict(xv)[0])},
        })

    def table(frame: pd.DataFrame) -> dict:
        return {f"{day:%Y-%m-%d}": {c: (None if pd.isna(v) else float(v)) for c, v in row.items()}
                for day, row in frame.iterrows()}

    doc = {"about": "Recorded Open-Meteo hourly rows (CAMS global + ERA5 + the four upwind points) for the parity tests; "
                    "written by train.py --parity-fixture. `daily`, `up_daily` and `expected[].features` are what pandas "
                    "computes from them; `expected[].pm25/pm10` are scikit-learn predictions of each model kind; `model` "
                    "(pm25 = blend, pm10 = v1) and `v1_pm25` are the JSON exports of the same fitted models. The ridge and "
                    "boosted kinds are the two parts of the blend.",
           "city": city["id"], "sklearn": sklearn.__version__, "pandas": pd.__version__, "numpy": np.__version__,
           "blanked": blanks, "feature_names": cols,
           "aq": aq, "wx": wx, "up": up, "daily": table(d), "up_daily": table(up_daily), "expected": rows,
           "v1_pm25": kinds["v1"], "model": fixture_model}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    print(f"  parity fixture: {path} ({path.stat().st_size / 1024:.0f} KB, {len(rows)} rows)")


# ---------- main ----------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cache-dir", required=True, type=Path, help="where raw downloads are kept (outside the repo)")
    ap.add_argument("--cities", default="", help="comma-separated city ids (default: all in cities.json)")
    ap.add_argument("--end", default=(date.today() - timedelta(days=7)).isoformat(),
                    help="last day to download (default: today - 7 days, because ERA5 lags about 5 days)")
    ap.add_argument("--out-dir", type=Path, default=HERE, help="where models/, metrics/ and summary.json go")
    ap.add_argument("--pause", type=float, default=90.0, help="seconds between two downloads (default 90)")
    ap.add_argument("--max-wait", type=float, default=3700.0, help="longest single rate-limit sleep to accept, in seconds")
    ap.add_argument("--force", action="store_true", help="retrain cities that already have output for this END")
    ap.add_argument("--parity-fixture", type=Path, help="also write the parity-test fixture (uses the first city trained)")
    args = ap.parse_args()

    cache_dir = args.cache_dir.resolve()
    if HERE.parent.parent.parent in cache_dir.parents or cache_dir == HERE:
        ap.error("--cache-dir must be outside the repo (it auto-commits everything)")
    cache_dir.mkdir(parents=True, exist_ok=True)
    cities = json.loads((HERE / "cities.json").read_text())
    wanted = [c.strip() for c in args.cities.split(",") if c.strip()]
    unknown = set(wanted) - {c["id"] for c in cities}
    if unknown:
        ap.error(f"unknown city ids: {sorted(unknown)}")
    todo = [c for c in cities if not wanted or c["id"] in wanted]
    (args.out_dir / "models").mkdir(parents=True, exist_ok=True)
    (args.out_dir / "metrics").mkdir(parents=True, exist_ok=True)

    dl = Downloader(cache_dir, args.pause, args.max_wait)
    done, skipped, failed, stopped = [], [], {}, None
    fixture_pending = args.parity_fixture
    up_raw, up = None, None
    for city in todo:
        cid = city["id"]
        model_path = args.out_dir / "models" / f"{cid}.json"
        if model_path.exists() and not args.force and not fixture_pending:
            try:
                old = json.loads(model_path.read_text())
                if old.get("end") == args.end and old.get("format") == FORMAT:
                    skipped.append(cid)
                    continue
            except ValueError:
                pass
        print(f"{cid}: {city['lat']}, {city['lon']}  ({START} .. {args.end})", flush=True)
        try:
            if up is None:
                up_raw = dl.upwind(START, args.end)
                up = upwind_frame(up_raw)
            aq_raw, wx_raw = dl.history(city, START, args.end)
            t0 = time.time()
            model, metrics, fitted = train_city(city, aq_raw, wx_raw, up_raw, up, args.end)
        except RateLimited as e:
            stopped = f"{cid}: {e}"
            print(f"  STOPPED: {e}", flush=True)
            break
        except Exception as e:  # one bad city must not stop the others
            failed[cid] = f"{e.__class__.__name__}: {e}"
            print(f"  FAILED: {failed[cid]}", flush=True)
            continue
        model_path.write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")) + "\n")
        (args.out_dir / "metrics" / f"{cid}.json").write_text(
            json.dumps(metrics, ensure_ascii=False, separators=(",", ":")) + "\n")
        if fixture_pending:
            write_parity_fixture(fixture_pending, city, model, aq_raw, wx_raw, up_raw, fitted)
            fixture_pending = None
            print(f"  blend shortcut vs fitting Blend (CV folds + test year): max difference {check_blend_shortcut(fitted):.3g}", flush=True)
        r, w = metrics["results"], metrics["results"]["warnings"]
        line = []
        for t in ["pm25", "pm10"]:
            line.append(f"{t} -> {metrics['chosen'][t]}: baseline {r[t]['baseline']['mae']:.3f}, " + ", ".join(
                f"{n} {r[t][n]['mae']:.3f} (cv {r[t]['cv_mae'][n]:.3f})" for n in CANDIDATES))
        print(f"  {metrics['n_train']} train / {metrics['n_test']} test days ({metrics['tested_on']}), {time.time() - t0:.0f}s\n  "
              + "\n  ".join(line)
              + f"\n  warnings: threshold {metrics['warn_threshold']}: {w['tuned']['caught']} of {w['tuned']['bad_days']} caught, "
                f"{w['tuned']['warned']} warned; at 35: {w[metrics['chosen']['pm25']]['caught']} caught, "
                f"{w[metrics['chosen']['pm25']]['warned']} warned"
              + "\n  parity vs pandas + scikit-learn: " + "; ".join(
                  f"{t} export {v['export']:.1e}, end to end {v['end_to_end']['max_diff']:.1e} over {v['end_to_end']['rows']} days"
                  f" ({v['end_to_end']['over_tolerance']} above {PARITY_TOLERANCE:g})" for t, v in model["parity"].items())
              + f"; model file {model_path.stat().st_size / 1024:.0f} KB", flush=True)
        done.append(cid)
        write_summary(cities, args.out_dir)  # after every city, so an interrupted run leaves a correct summary

    rows = write_summary(cities, args.out_dir)
    print(f"\ntrained now: {done or 'none'}\nalready done (skipped): {skipped or 'none'}\nfailed: {failed or 'none'}")
    print(f"network requests this run: {dl.calls}; summary.json covers {len(rows)} of {len(cities)} cities")
    if stopped:
        print(f"stopped early at {stopped}\nRun the same command again later: cached downloads and finished cities are reused.")
        return 2
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
