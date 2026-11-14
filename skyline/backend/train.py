"""Train the next-day PM2.5 / PM10 models for Taichung and write model/metrics.json.

Run on the box:  cd ~/skyline/backend && python train.py
Split is by time: the last 365 days are the test set, everything before is training.
The main model is picked on a validation slice (the last 180 days of training), never on the test set.
"""
import json
from datetime import date, timedelta

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import sources
from airmodel import BAD_DAY_PM25, MODEL_DIR, daily_table, features

START = "2022-08-05"  # CAMS global data for Taichung starts 2022-08-04
END = (date.today() - timedelta(days=7)).isoformat()  # ERA5 weather lags ~5 days
TEST_DAYS = 365
VAL_DAYS = 180


def hgb():
    return HistGradientBoostingRegressor(max_iter=400, learning_rate=0.04, max_leaf_nodes=15,
                                         min_samples_leaf=20, l2_regularization=1.0, random_state=0)


def ridge():
    return make_pipeline(StandardScaler(), Ridge(alpha=1.0))


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
        "precision": tp / prd.sum() if prd.sum() else None,
        "recall": tp / act.sum() if act.sum() else None,
    }


def main():
    print(f"Downloading {START} .. {END}")
    aq, wx = sources.history(START, END)
    d = daily_table(aq, wx)
    d = d[d["hours"] >= 20]
    full = features(d)
    nowx = features(d, tomorrow_weather=False)
    targets = pd.DataFrame({"pm25": d["pm25"].shift(-1), "pm10": d["pm10"].shift(-1)}, index=d.index)
    # The target day must exist (consecutive days only).
    nxt = d.index.to_series().shift(-1)
    ok = (nxt - d.index.to_series() == pd.Timedelta(days=1)) & full.notna().all(axis=1) & targets.notna().all(axis=1)
    full, nowx, targets = full[ok], nowx[ok], targets[ok]
    cols, cols_nowx = list(full.columns), list(nowx.columns)
    print(f"{len(full)} usable days, {len(cols)} features")

    test_start = full.index.max() - pd.Timedelta(days=TEST_DAYS - 1)
    train_mask = full.index < test_start - pd.Timedelta(days=1)  # 1-day gap so no target overlaps the test inputs
    test_mask = full.index >= test_start
    val_start = full.index[train_mask].max() - pd.Timedelta(days=VAL_DAYS - 1)
    fit_mask = train_mask & (full.index < val_start)
    val_mask = train_mask & (full.index >= val_start)

    results, chosen, series, failures, intervals, monthly = {}, {}, {}, {}, {}, {}
    test_dates = full.index[test_mask]
    for target in ["pm25", "pm10"]:
        y = targets[target]
        # Choose the main model on the validation slice.
        val_scores = {}
        for name, make, X in [("ridge", ridge, full), ("boosted", hgb, full)]:
            m = make().fit(X[fit_mask], y[fit_mask])
            val_scores[name] = mae(y[val_mask], m.predict(X[val_mask]))
        best = min(val_scores, key=val_scores.get)
        chosen[target] = best

        # Refit on all training days, score once on the test year.
        preds = {"baseline": full.loc[test_mask, target].values}
        models = {}
        for name, make, X in [("ridge", ridge, full), ("boosted", hgb, full), ("boosted_no_weather", hgb, nowx)]:
            m = make().fit(X[train_mask], y[train_mask])
            preds[name] = m.predict(X[test_mask])
            models[name] = m
        actual = y[test_mask].values
        results[target] = {
            name: {"mae": mae(actual, p), "rmse": rmse(actual, p)} for name, p in preds.items()
        }
        results[target]["validation_mae"] = val_scores
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
            {"month": str(mo), "model": mae(actual[months == mo], main_pred[months == mo]),
             "baseline": mae(actual[months == mo], preds["baseline"][months == mo])}
            for mo in months.unique()
        ]
        if target == "pm25":
            results["warnings"] = {name: warn_scores(actual, p) for name, p in preds.items()}
            worst = np.argsort(-np.abs(resid))[:5]
            failures = [{
                "date": (test_dates[i] + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
                "actual": round(float(actual[i]), 1),
                "model": round(float(main_pred[i]), 1),
                "baseline": round(float(preds["baseline"][i]), 1),
                "tomorrow_rain_mm": round(float(full["tmr_rain"].iloc[np.where(test_mask)[0][i]]), 1),
                "tomorrow_wind_kmh": round(float(full["tmr_wind"].iloc[np.where(test_mask)[0][i]]), 1),
            } for i in worst]

        # Live model: same recipe, refit on every day we have (train + test).
        final = (ridge() if best == "ridge" else hgb()).fit(full, y)
        joblib.dump(final, MODEL_DIR / f"{target}.joblib")

    metrics = {
        "trained_on": f"{full.index.min():%Y-%m-%d} .. {full.index[train_mask].max():%Y-%m-%d}",
        "tested_on": f"{test_dates.min():%Y-%m-%d} .. {test_dates.max():%Y-%m-%d}",
        "n_train": int(train_mask.sum()),
        "n_test": int(test_mask.sum()),
        "features": cols,
        "features_no_weather": cols_nowx,
        "chosen": chosen,
        "results": results,
        "interval": intervals,
        "monthly": monthly,
        "failures": failures,
        "test_dates": [(t + pd.Timedelta(days=1)).strftime("%Y-%m-%d") for t in test_dates],
        "series": series,
        "bad_day_threshold": BAD_DAY_PM25,
        "data": "PM2.5/PM10: CAMS global via Open-Meteo (model estimates). Weather: ERA5 via Open-Meteo archive.",
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=1))
    print(json.dumps({k: metrics[k] for k in ["trained_on", "tested_on", "n_train", "n_test", "chosen"]}, indent=1))
    print(json.dumps(results, indent=1))
    print(json.dumps(failures, indent=1))


if __name__ == "__main__":
    main()
