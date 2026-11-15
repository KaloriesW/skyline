"""Train next-day PM2.5 / PM10 models, one per Taiwan city/county, and export them as small JSON.

Same recipe as the team's Taichung model (branch `app`, skyline/backend/train.py + airmodel.py), with the
coordinates as a parameter:

- Inputs: CAMS global PM2.5/PM10 and ERA5 weather, both hourly from Open-Meteo (no key).
- Row t describes day t (plus tomorrow's weather) and predicts day t+1's mean PM2.5 / PM10.
- Split by time: the last 365 days are the test set, everything before (minus a 1-day gap) is training.
  A validation slice (the last 180 days of training) says which model would be picked; the test year
  is scored once and never used for a choice.
- Baseline: "tomorrow = same as today".
- Deployed model: ridge (StandardScaler + Ridge) for every city, exported as plain numbers so the server
  needs no scikit-learn / pandas / pickle. The boosted model is still fitted and scored like the original;
  each city's metrics say which one validation would have chosen and what the test gap is.

Run (from a virtualenv with requirements-train.txt; keep the cache OUTSIDE the repo):

    python ui/app/model/train.py --cache-dir /some/dir/pm_data                 # every city still missing
    python ui/app/model/train.py --cache-dir /some/dir/pm_data --cities taichung,taipei
    python ui/app/model/train.py --cache-dir /some/dir/pm_data --force         # retrain everything

It is resumable: raw downloads are cached per city, cities whose output already exists for the same END
date are skipped, and summary.json is rebuilt from whatever metrics files exist.

Open-Meteo's free tier (https://open-meteo.com/en/pricing, read 2026-11-15): 600 calls/minute, 5,000/hour,
10,000/day. A request for more than two weeks or more than 10 variables counts as several calls
(fractionally: days/14 x variables/10), so one city's ~4.3 years costs about 110 calls per request and two
requests per city. 22 cities are about 4,900 calls: under the daily limit and just under the hourly one,
so downloads are spaced out (--pause) and 429s are retried with a long back-off.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
TZ = "Asia/Taipei"
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
MODEL_WX = ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m",
            "wind_direction_10m", "surface_pressure", "boundary_layer_height"]
WX_DAY = ["temp", "rh", "rain", "wind", "u", "v", "pres", "blh"]
BAD_DAY_PM25 = 35.0  # µg/m³, US EPA 24-hour standard used by the brief

START = "2022-08-05"  # CAMS global data via Open-Meteo starts 2022-08-04
TEST_DAYS = 365
VAL_DAYS = 180
MIN_HOURS = 20
RIDGE_ALPHA = 1.0
MIN_USABLE_DAYS = TEST_DAYS + VAL_DAYS + 365  # refuse to train a city with less than this
DATA_NOTE = "PM2.5/PM10: CAMS global via Open-Meteo (model estimates). Weather: ERA5 via Open-Meteo archive."


# ---------- features: copied from the team's airmodel.py (must stay identical) ----------

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
    X["doy_sin"] = np.sin(2 * np.pi * tmr.day_of_year / 365.25)
    X["doy_cos"] = np.cos(2 * np.pi * tmr.day_of_year / 365.25)
    X["tmr_weekend"] = (tmr.day_of_week >= 5).astype(int)
    return X


def hourly_frame(data: dict) -> pd.DataFrame:
    df = pd.DataFrame(data["hourly"])
    df.index = pd.to_datetime(df.pop("time"))
    return df


# ---------- polite, cached downloads ----------

class RateLimited(RuntimeError):
    """Open-Meteo said no and waiting a sensible time did not help."""


class Downloader:
    def __init__(self, cache_dir: Path, pause: float, max_wait: float):
        self.cache_dir = cache_dir
        self.pause = pause          # seconds between two network requests
        self.max_wait = max_wait    # longest single back-off sleep we accept
        self.last = 0.0
        self.calls = 0
        self.client = httpx.Client(timeout=120, headers={"User-Agent": "skyline-train/1.0"})

    def get(self, name: str, url: str, params: dict) -> dict:
        """Cached GET. `name` is the cache file name; a cached file is never re-downloaded."""
        path = self.cache_dir / name
        if path.exists():
            try:
                data = json.loads(path.read_text())
                if "hourly" in data:
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
                tmp = path.with_suffix(".tmp")
                tmp.write_text(json.dumps(data))
                tmp.replace(path)
                return data
            try:
                reason = str(r.json().get("reason", ""))
            except ValueError:
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


# ---------- models and scores ----------

def hgb():
    return HistGradientBoostingRegressor(max_iter=400, learning_rate=0.04, max_leaf_nodes=15,
                                         min_samples_leaf=20, l2_regularization=1.0, random_state=0)


def ridge():
    return make_pipeline(StandardScaler(), Ridge(alpha=RIDGE_ALPHA))


def mae(a, b):
    return float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))


def rmse(a, b):
    return float(np.sqrt(np.mean((np.asarray(a) - np.asarray(b)) ** 2)))


def warn_scores(actual, pred):
    act, prd = np.asarray(actual) > BAD_DAY_PM25, np.asarray(pred) > BAD_DAY_PM25
    tp = int((act & prd).sum())
    return {
        "bad_days": int(act.sum()),
        "warned": int(prd.sum()),
        "caught": tp,
        "precision": float(tp / prd.sum()) if prd.sum() else None,
        "recall": float(tp / act.sum()) if act.sum() else None,
    }


def export_ridge(pipe) -> dict:
    """StandardScaler + Ridge as plain numbers: prediction = sum(coef * (x - mean) / scale) + intercept."""
    scaler, reg = pipe.named_steps["standardscaler"], pipe.named_steps["ridge"]
    return {
        "mean": [float(v) for v in scaler.mean_],
        "scale": [float(v) for v in scaler.scale_],
        "coef": [float(v) for v in reg.coef_],
        "intercept": float(reg.intercept_),
    }


def prepare(aq_raw: dict, wx_raw: dict):
    """Raw downloads -> (daily table, features, features without tomorrow's weather, targets), usable rows only."""
    d = daily_table(hourly_frame(aq_raw), hourly_frame(wx_raw))
    d = d[d["hours"] >= MIN_HOURS]
    full = features(d)
    nowx = features(d, tomorrow_weather=False)
    targets = pd.DataFrame({"pm25": d["pm25"].shift(-1), "pm10": d["pm10"].shift(-1)}, index=d.index)
    # The target day must exist (consecutive days only).
    nxt = d.index.to_series().shift(-1)
    ok = (nxt - d.index.to_series() == pd.Timedelta(days=1)) & full.notna().all(axis=1) & targets.notna().all(axis=1)
    return d, full[ok], nowx[ok], targets[ok]


def train_city(city: dict, aq_raw: dict, wx_raw: dict, end: str) -> tuple[dict, dict, dict]:
    """Returns (model json, metrics json, fitted final pipelines by target)."""
    d, full, nowx, targets = prepare(aq_raw, wx_raw)
    if len(full) < MIN_USABLE_DAYS:
        raise ValueError(f"only {len(full)} usable days (need {MIN_USABLE_DAYS}); first day with data: "
                         f"{d.index.min():%Y-%m-%d}" if len(d) else "no days with PM data at all")
    cols, cols_nowx = list(full.columns), list(nowx.columns)

    test_start = full.index.max() - pd.Timedelta(days=TEST_DAYS - 1)
    train_mask = full.index < test_start - pd.Timedelta(days=1)  # 1-day gap so no target overlaps the test inputs
    test_mask = full.index >= test_start
    val_start = full.index[train_mask].max() - pd.Timedelta(days=VAL_DAYS - 1)
    fit_mask = train_mask & (full.index < val_start)
    val_mask = train_mask & (full.index >= val_start)

    results, validation_choice, series, failures, intervals, monthly, exported, finals = {}, {}, {}, [], {}, {}, {}, {}
    test_dates = full.index[test_mask]
    for target in ["pm25", "pm10"]:
        y = targets[target]
        # Which model would the validation slice pick? (Recorded; ridge is deployed either way.)
        val_scores = {}
        for name, make in [("ridge", ridge), ("boosted", hgb)]:
            m = make().fit(full[fit_mask], y[fit_mask])
            val_scores[name] = mae(y[val_mask], m.predict(full[val_mask]))
        validation_choice[target] = min(val_scores, key=val_scores.get)

        # Refit on all training days, score once on the test year.
        preds = {"baseline": full.loc[test_mask, target].values}
        for name, make, X in [("ridge", ridge, full), ("boosted", hgb, full), ("boosted_no_weather", hgb, nowx)]:
            preds[name] = make().fit(X[train_mask], y[train_mask]).predict(X[test_mask])
        actual = y[test_mask].values
        results[target] = {name: {"mae": mae(actual, p), "rmse": rmse(actual, p)} for name, p in preds.items()}
        results[target]["validation_mae"] = val_scores
        main_pred = preds["ridge"]  # the deployed model: intervals, series and failures describe what is served
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

        # Live model: same recipe, refit on every day we have (train + test).
        finals[target] = ridge().fit(full, y)
        exported[target] = export_ridge(finals[target])

    notes = []
    for target in ["pm25", "pm10"]:
        r = results[target]
        if validation_choice[target] != "ridge":
            gap = r["ridge"]["mae"] - r["boosted"]["mae"]
            notes.append(
                f"{target}: validation would have chosen the boosted model (validation MAE {r['validation_mae']['boosted']:.2f} "
                f"vs ridge {r['validation_mae']['ridge']:.2f}). Ridge is deployed for portability; on the test year ridge MAE is "
                f"{r['ridge']['mae']:.2f} and boosted {r['boosted']['mae']:.2f} (ridge is {abs(gap):.2f} µg/m³ "
                f"{'worse' if gap > 0 else 'better'}).")
        if r["ridge"]["mae"] >= r["baseline"]["mae"]:
            notes.append(f"{target}: the deployed ridge model does NOT beat the 'same as today' baseline on the test year "
                         f"(MAE {r['ridge']['mae']:.2f} vs {r['baseline']['mae']:.2f}).")

    city_info = {
        "id": city["id"], "name": city["name"], "name_zh": city["name_zh"], "lat": city["lat"], "lon": city["lon"],
        # The grid points Open-Meteo actually answered from. CAMS global is coarse (~0.4°, about 40 km):
        # neighbouring cities can share one PM grid cell.
        "aq_grid": [aq_raw.get("latitude"), aq_raw.get("longitude")],
        "wx_grid": [wx_raw.get("latitude"), wx_raw.get("longitude")],
    }
    trained_through = f"{full.index.max():%Y-%m-%d}"
    metrics = {
        "city": city_info,
        "trained_on": f"{full.index.min():%Y-%m-%d} .. {full.index[train_mask].max():%Y-%m-%d}",
        "tested_on": f"{test_dates.min():%Y-%m-%d} .. {test_dates.max():%Y-%m-%d}",
        "n_train": int(train_mask.sum()),
        "n_test": int(test_mask.sum()),
        "features": cols,
        "features_no_weather": cols_nowx,
        # `chosen` is what is served (the team UI reads results[target][chosen[target]]): ridge everywhere.
        "chosen": {"pm25": "ridge", "pm10": "ridge"},
        "deployed": "ridge",
        "validation_choice": validation_choice,
        "notes": notes,
        "results": results,
        "interval": intervals,
        "monthly": monthly,
        "failures": failures,
        "test_dates": [(t + pd.Timedelta(days=1)).strftime("%Y-%m-%d") for t in test_dates],
        "series": series,
        "bad_day_threshold": BAD_DAY_PM25,
        "data": DATA_NOTE,
        "data_range": {"requested": f"{START} .. {end}", "first_day": f"{d.index.min():%Y-%m-%d}",
                       "last_day": f"{d.index.max():%Y-%m-%d}", "days_with_data": int(len(d)),
                       "usable_days": int(len(full))},
    }
    model = {
        "city": city_info,
        "kind": "ridge",
        "alpha": RIDGE_ALPHA,
        "features": cols,
        "targets": exported,
        "interval": intervals,
        "test_mae": {t: round(results[t]["ridge"]["mae"], 2) for t in ["pm25", "pm10"]},
        "baseline_mae": {t: round(results[t]["baseline"]["mae"], 2) for t in ["pm25", "pm10"]},
        "bad_day_threshold": BAD_DAY_PM25,
        "trained_through": trained_through,
        "n_days": int(len(full)),
        "end": end,
    }
    return model, metrics, finals


# ---------- summary ----------

def summary_row(m: dict) -> dict:
    row = {**{k: m["city"][k] for k in ["id", "name", "name_zh", "lat", "lon"]},
           "n_train": m["n_train"], "n_test": m["n_test"], "tested_on": m["tested_on"], "deployed": m["deployed"]}
    for t in ["pm25", "pm10"]:
        r = m["results"][t]
        base, model = r["baseline"]["mae"], r["ridge"]["mae"]
        row[t] = {
            "baseline_mae": round(base, 3), "model_mae": round(model, 3),
            "improvement_pct": round(100 * (base - model) / base, 1),
            "beats_baseline": bool(model < base),
            "boosted_mae": round(r["boosted"]["mae"], 3),
            "validation_choice": m["validation_choice"][t],
        }
    w = m["results"]["warnings"]
    rnd = lambda v: None if v is None else round(v, 3)  # noqa: E731
    row["warnings"] = {
        "bad_days": w["ridge"]["bad_days"], "warned": w["ridge"]["warned"], "caught": w["ridge"]["caught"],
        "precision": rnd(w["ridge"]["precision"]), "recall": rnd(w["ridge"]["recall"]),
        "baseline_precision": rnd(w["baseline"]["precision"]), "baseline_recall": rnd(w["baseline"]["recall"]),
    }
    row["notes"] = m.get("notes", [])
    return row


def write_summary(cities: list[dict], out_dir: Path) -> list[dict]:
    rows, missing = [], []
    for c in cities:
        p = out_dir / "metrics" / f"{c['id']}.json"
        if p.exists() and (out_dir / "models" / f"{c['id']}.json").exists():
            rows.append(summary_row(json.loads(p.read_text())))
        else:
            missing.append(c["id"])
    doc = {"model": "ridge", "bad_day_threshold": BAD_DAY_PM25, "data": DATA_NOTE,
           "baseline": "tomorrow = same as today", "cities": rows, "missing": missing}
    (out_dir / "summary.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    return rows


# ---------- parity fixture ----------

def write_parity_fixture(path: Path, city: dict, aq_raw: dict, wx_raw: dict, finals: dict, days: int = 12) -> None:
    """A small recorded slice (the last `days` days of raw hourly input) with the pandas features and the
    scikit-learn predictions for it, so a test can check the pure-Python path without pandas or a network.

    A few values are blanked on purpose so the missing-value rules (mean/sum skip gaps, the evening mean
    uses the last six hourly rows) are covered too.
    """
    n = days * 24

    def tail(raw: dict) -> dict:
        return {"hourly": {k: list(v[-n:]) for k, v in raw["hourly"].items()}}

    aq, wx = tail(aq_raw), tail(wx_raw)
    blanks = {"aq": [["pm2_5", 3 * 24 + 5], ["pm2_5", 3 * 24 + 22], ["pm10", 3 * 24 + 5], ["pm2_5", 6 * 24 + 23]],
              "wx": [["precipitation", 4 * 24 + 7], ["wind_direction_10m", 5 * 24 + 12], ["boundary_layer_height", 5 * 24 + 3]]}
    for src, frame in (("aq", aq), ("wx", wx)):
        for name, i in blanks[src]:
            frame["hourly"][name][i] = None

    d = daily_table(hourly_frame(aq), hourly_frame(wx))
    X = features(d)
    cols = list(X.columns)
    ok = X.notna().all(axis=1)
    rows = []
    for day in X.index[ok]:
        x = X.loc[[day], cols]
        rows.append({
            "today": f"{day:%Y-%m-%d}",
            "features": [float(v) for v in x.iloc[0]],
            "pm25": float(finals["pm25"].predict(x)[0]),
            "pm10": float(finals["pm10"].predict(x)[0]),
        })
    daily = {f"{day:%Y-%m-%d}": {c: (None if pd.isna(v) else float(v)) for c, v in row.items()} for day, row in d.iterrows()}
    doc = {"about": "Recorded Open-Meteo hourly rows (CAMS global + ERA5) for the parity test; written by train.py "
                    "--parity-fixture. `expected` holds the pandas features and the scikit-learn ridge predictions.",
           "city": city["id"], "blanked": blanks, "feature_names": cols, "aq": aq, "wx": wx,
           "daily": daily, "expected": rows}
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
    for city in todo:
        cid = city["id"]
        model_path = args.out_dir / "models" / f"{cid}.json"
        if model_path.exists() and not args.force and not fixture_pending:
            try:
                if json.loads(model_path.read_text()).get("end") == args.end:
                    skipped.append(cid)
                    continue
            except ValueError:
                pass
        print(f"{cid}: {city['lat']}, {city['lon']}  ({START} .. {args.end})", flush=True)
        try:
            aq_raw, wx_raw = dl.history(city, START, args.end)
            model, metrics, finals = train_city(city, aq_raw, wx_raw, args.end)
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
            write_parity_fixture(fixture_pending, city, aq_raw, wx_raw, finals)
            fixture_pending = None
        r, w = metrics["results"], metrics["results"]["warnings"]["ridge"]
        print(f"  {metrics['n_train']} train / {metrics['n_test']} test days ({metrics['tested_on']}); "
              f"pm25 MAE baseline {r['pm25']['baseline']['mae']:.2f} ridge {r['pm25']['ridge']['mae']:.2f} "
              f"boosted {r['pm25']['boosted']['mae']:.2f}; pm10 baseline {r['pm10']['baseline']['mae']:.2f} "
              f"ridge {r['pm10']['ridge']['mae']:.2f}; validation picks {metrics['validation_choice']}; "
              f"bad days {w['bad_days']}, warned {w['warned']}, caught {w['caught']}", flush=True)
        done.append(cid)

    rows = write_summary(cities, args.out_dir)
    print(f"\ntrained now: {done or 'none'}\nalready done (skipped): {skipped or 'none'}\nfailed: {failed or 'none'}")
    print(f"network requests this run: {dl.calls}; summary.json covers {len(rows)} of {len(cities)} cities")
    if stopped:
        print(f"stopped early at {stopped}\nRun the same command again later: cached downloads and finished cities are reused.")
        return 2
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
