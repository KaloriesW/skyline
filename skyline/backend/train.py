"""Train the next-day PM2.5 / PM10 models for Taichung and write model/metrics.json.

Run on the box:  cd ~/skyline/backend && python train.py
Split is by time: the last 365 days are the test set, everything before is training.
Every choice (model, bad-day warning threshold) is made with rolling-origin cross-validation
inside the training period: 4 folds of 91 days covering its last year, so all seasons count.
The test year is scored once, at the end.
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
from airmodel import BAD_DAY_PM25, MODEL_DIR, Blend, daily_table, features

START = "2022-08-05"  # CAMS global data for Taichung starts 2022-08-04
END = (date.today() - timedelta(days=7)).isoformat()  # ERA5 weather lags ~5 days
TEST_DAYS = 365
FOLDS, FOLD_DAYS = 4, 91


def hgb():
    return HistGradientBoostingRegressor(max_iter=200, learning_rate=0.05, max_leaf_nodes=31,
                                         min_samples_leaf=20, l2_regularization=1.0, random_state=0)


def ridge():
    return make_pipeline(StandardScaler(), Ridge(alpha=1.0))


# name -> (model factory, feature set). "v1" is the first model we shipped (Ridge, 25 features).
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
        "precision": tp / prd.sum() if prd.sum() else None,
        "recall": tp / act.sum() if act.sum() else None,
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


def main():
    print(f"Downloading {START} .. {END}")
    aq, wx, up = sources.history(START, END)
    d = daily_table(aq, wx)
    d = d[d["hours"] >= 20]
    X = {"full": features(d, up), "nowx": features(d, up, tomorrow_weather=False), "v1": features(d)}
    targets = pd.DataFrame({"pm25": d["pm25"].shift(-1), "pm10": d["pm10"].shift(-1)}, index=d.index)
    # The target day must exist (consecutive days only), and every feature set must be complete.
    nxt = d.index.to_series().shift(-1)
    ok = (nxt - d.index.to_series() == pd.Timedelta(days=1)) & X["full"].notna().all(axis=1) \
        & targets.notna().all(axis=1)
    X = {k: v[ok] for k, v in X.items()}
    targets = targets[ok]
    full = X["full"]
    print(f"{len(full)} usable days, {full.shape[1]} features")

    test_start = full.index.max() - pd.Timedelta(days=TEST_DAYS - 1)
    train_mask = full.index < test_start - pd.Timedelta(days=1)  # 1-day gap so no target overlaps the test inputs
    test_mask = full.index >= test_start
    train_idx = full.index[train_mask]

    results, chosen, series, failures, intervals, monthly, cv, feature_cols = {}, {}, {}, {}, {}, {}, {}, {}
    warn_threshold = BAD_DAY_PM25
    test_dates = full.index[test_mask]
    for target in ["pm25", "pm10"]:
        y = targets[target]
        # 1. Choose the model with cross-validation on training days.
        oof = {name: cv_predict(make, X[fs], y, train_idx) for name, (make, fs) in CANDIDATES.items()}
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
            {"month": str(mo), "model": mae(actual[months == mo], main_pred[months == mo]),
             "baseline": mae(actual[months == mo], preds["baseline"][months == mo])}
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

        # 3. Live model: same recipe, refit on every day we have (train + test).
        make, fs = CANDIDATES[best]
        feature_cols[target] = list(X[fs].columns)
        joblib.dump(make().fit(X[fs], y), MODEL_DIR / f"{target}.joblib")

    metrics = {
        "trained_on": f"{full.index.min():%Y-%m-%d} .. {full.index[train_mask].max():%Y-%m-%d}",
        "tested_on": f"{test_dates.min():%Y-%m-%d} .. {test_dates.max():%Y-%m-%d}",
        "cv_on": f"{train_idx[-FOLDS * FOLD_DAYS]:%Y-%m-%d} .. {train_idx.max():%Y-%m-%d} ({FOLDS} folds)",
        "n_train": int(train_mask.sum()),
        "n_test": int(test_mask.sum()),
        "features": feature_cols,
        "upwind": {k: list(v) for k, v in sources.UPWIND.items()},
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
        "data": "PM2.5/PM10: CAMS global via Open-Meteo (model estimates). Weather: ERA5 via Open-Meteo archive.",
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=1))
    print(json.dumps({k: metrics[k] for k in ["trained_on", "tested_on", "cv_on", "n_train", "n_test",
                                              "chosen", "warn_threshold", "cv_warnings"]}, indent=1))
    print(json.dumps(results, indent=1))
    print(json.dumps(failures, indent=1))


if __name__ == "__main__":
    main()
