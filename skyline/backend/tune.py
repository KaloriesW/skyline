"""Tuning experiments for the next-day PM2.5 model. Uses training days only (never the test year).

Run on the box:  cd ~/skyline/backend && python tune.py
Scores each candidate with rolling-origin cross-validation: 4 folds of 91 days covering the
last year of the training period, so every season is in the validation data.
"""
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import sources
from airmodel import daily_table, features
from train import END, START, TEST_DAYS

CACHE = Path(__file__).parent / "tune_cache.pkl"
FOLDS, FOLD_DAYS = 4, 91


def load():
    if CACHE.exists():
        return pickle.loads(CACHE.read_bytes())
    out = sources.history(START, END)
    CACHE.write_bytes(pickle.dumps(out))
    return out


def extra_features(d, up, kind):
    X = features(d)  # the first model's 25 features
    if kind in ("rolling", "upwind"):
        X["pm25_3d"] = d["pm25"].rolling(3).mean()
        X["pm25_7d"] = d["pm25"].rolling(7).mean()
        X["pm25_trend"] = d["pm25"] - d["pm25"].shift(1)
    if kind == "upwind":
        for c in up.columns:
            X["up_" + c] = up[c].reindex(d.index)
        # Northerly wind tomorrow (v < 0) carries the northern air south to Taichung.
        X["north_push"] = X["up_north"] * np.clip(-d["v"].shift(-1), 0, None)
    return X


def ridge(alpha):
    return lambda: make_pipeline(StandardScaler(), Ridge(alpha=alpha))


def hgb(lr, leaves, iters):
    return lambda: HistGradientBoostingRegressor(max_iter=iters, learning_rate=lr, max_leaf_nodes=leaves,
                                                 min_samples_leaf=20, l2_regularization=1.0, random_state=0)


def cv_predict(make, X, y, train_idx, log=False):
    """Out-of-fold predictions for the last FOLDS*FOLD_DAYS training days (expanding window)."""
    pred = pd.Series(np.nan, index=y.index)
    end = train_idx.max()
    for k in range(FOLDS, 0, -1):
        v0 = end - pd.Timedelta(days=k * FOLD_DAYS - 1)
        v1 = v0 + pd.Timedelta(days=FOLD_DAYS - 1)
        fit = train_idx[train_idx < v0 - pd.Timedelta(days=1)]
        val = train_idx[(train_idx >= v0) & (train_idx <= v1)]
        yt = np.log1p(y[fit]) if log else y[fit]
        p = make().fit(X.loc[fit], yt).predict(X.loc[val])
        pred[val] = np.expm1(p) if log else p
    return pred.dropna()


def main():
    aq, wx, up = load()
    d = daily_table(aq, wx)
    d = d[d["hours"] >= 20]
    y = d["pm25"].shift(-1)
    nxt = d.index.to_series().shift(-1)
    consecutive = nxt - d.index.to_series() == pd.Timedelta(days=1)

    sets = {k: extra_features(d, up, k) for k in ["base", "rolling", "upwind"]}
    ok = consecutive & y.notna() & sets["upwind"].notna().all(axis=1)  # same rows for every set
    test_start = d.index[ok].max() - pd.Timedelta(days=TEST_DAYS - 1)
    train_idx = d.index[ok & (d.index < test_start - pd.Timedelta(days=1))]

    candidates = [("baseline", None, None, False)]
    for fs in sets:
        for a in [1, 10, 30, 100]:
            candidates.append((f"ridge a={a}", ridge(a), fs, False))
        candidates.append(("ridge a=10 log", ridge(10), fs, True))
        for lr, leaves, it in [(0.04, 15, 400), (0.03, 7, 600), (0.05, 31, 200)]:
            candidates.append((f"boosted lr={lr} leaves={leaves}", hgb(lr, leaves, it), fs, False))

    rows, oof = [], {}
    for name, make, fs, log in candidates:
        if make is None:  # tomorrow = today
            p = sets["base"].loc[train_idx[-FOLDS * FOLD_DAYS:], "pm25"]
        else:
            p = cv_predict(make, sets[fs], y, train_idx, log)
        err = float(np.mean(np.abs(y[p.index] - p)))
        rows.append({"features": fs or "-", "model": name, "cv_mae": round(err, 3)})
        oof[(fs, name)] = p
    # Simple blend of the best ridge and best boosted model on each feature set.
    res = pd.DataFrame(rows)
    for fs in sets:
        sub = res[res.features == fs]
        br = sub[sub.model.str.startswith("ridge")].sort_values("cv_mae").iloc[0].model
        bb = sub[sub.model.str.startswith("boosted")].sort_values("cv_mae").iloc[0].model
        p = (oof[(fs, br)] + oof[(fs, bb)]) / 2
        rows.append({"features": fs, "model": f"blend({br} + {bb})",
                     "cv_mae": round(float(np.mean(np.abs(y[p.index] - p))), 3)})
    res = pd.DataFrame(rows).sort_values("cv_mae")
    pd.set_option("display.width", 160)
    print(f"CV folds cover {train_idx[-FOLDS * FOLD_DAYS]:%Y-%m-%d} .. {train_idx.max():%Y-%m-%d}")
    print(res.to_string(index=False))


if __name__ == "__main__":
    main()
