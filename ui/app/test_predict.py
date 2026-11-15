"""Tests for model/predict.py: the plain-Python daily table, features, ridge and boosted trees must match
pandas and scikit-learn. No network: the inputs are recorded rows in model/fixtures/taichung_parity.json,
written by `train.py --parity-fixture` together with the pandas features and the scikit-learn predictions
of every model kind (v1, ridge, boosted, blend) for them.

    python -m pytest -p no:cacheprovider test_predict.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

import pytest

os.environ.setdefault("OMP_NUM_THREADS", "1")  # the optional scikit-learn test: tiny data, threads only slow it down

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from model import predict as pm  # noqa: E402

FIXTURE = json.loads((HERE / "model" / "fixtures" / "taichung_parity.json").read_text(encoding="utf-8"))
AQ, WX, UP_RAW = FIXTURE["aq"]["hourly"], FIXTURE["wx"]["hourly"], FIXTURE["up"]
MODEL_DOC = FIXTURE["model"]              # pm25 = blend (33 features), pm10 = v1 (25 features)
MODEL = pm.load_model(MODEL_DOC)
V1, FULL = FIXTURE["feature_names"]["v1"], FIXTURE["feature_names"]["full"]
BLEND = MODEL_DOC["targets"]["pm25"]
KINDS = {  # every model kind for PM2.5; ridge and boosted are the two parts of the blend
    "v1": pm.load_target(FIXTURE["v1_pm25"]),
    "ridge": pm.load_target({"kind": "ridge", "features": FULL, "ridge": BLEND["ridge"]}),
    "boosted": pm.load_target({"kind": "boosted", "features": FULL, "trees": BLEND["trees"]}),
    "blend": pm.load_target(BLEND),
}
D = pm.daily_table(AQ, WX)
UP = pm.upwind_daily(UP_RAW)
TOLERANCE = 1e-6


# ---------- parity with pandas / scikit-learn (recorded) ----------

def test_sums_follow_numpy_and_pandas_order():
    assert pm._np_sum([0.1] * 7) == 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1
    a = [0.1 * k for k in range(1, 20)]
    r = [a[j] + a[8 + j] for j in range(8)]  # eight running sums, then pairs, then the leftovers in order
    assert pm._np_sum(a) == ((r[0] + r[1]) + (r[2] + r[3])) + ((r[4] + r[5]) + (r[6] + r[7])) + a[16] + a[17] + a[18]
    assert pm._group_sum([9.7, 49.7, 40.6], False) == 9.7 + (49.7 + 40.6) == 100.00000000000001  # no gap in the column
    assert pm._group_sum([9.7, 49.7, 40.6], True) == 100.0                                       # Kahan when there is one
    assert pm._group_sum([float("nan")] * 3, True) == 0.0 and pm._group_mean([float("nan")] * 3, True) != pm._group_mean([1.0], True)
    assert pm._series_mean([1.0, float("nan"), 2.0]) == 1.5 and pm._series_mean([float("nan")]) != pm._series_mean([1.0])
    nan = float("nan")
    got = pm._rolling_mean([1.0, 2.0, 4.0, nan, 5.0, 5.0, 5.0, 0.1, 0.2, 0.3], 3)
    assert all(v != v for v in got[:2])                               # no full window yet
    assert got[2] == 7.0 / 3 and all(v != v for v in got[3:6])       # a gap empties the windows that hold it
    assert got[6] == 5.0                                              # one repeated value: exactly that value
    assert abs(got[9] - 0.2) < 1e-15 and len(got) == 10


def test_fixture_is_what_the_test_needs():
    assert FIXTURE["city"] == "taichung" and len(FIXTURE["expected"]) >= 20
    assert len(V1) == 25 and len(FULL) == 33 and FULL[:25] == V1
    assert FULL[25:] == ["pm25_3d", "pm25_7d", "pm25_trend", "up_north", "up_fujian", "up_southwest", "up_south", "north_push"]
    assert BLEND["kind"] == "blend" and BLEND["features"] == FULL and MODEL_DOC["targets"]["pm10"]["kind"] == "v1"
    assert len(BLEND["trees"]["root"]) == 200  # 200 boosting iterations
    assert any(v is None for v in AQ["pm2_5"]) and any(v is None for v in WX["precipitation"])  # gaps are covered
    assert any(v is None for v in UP_RAW[0]["hourly"]["pm2_5"])
    assert FIXTURE["sklearn"] == MODEL_DOC["sklearn"]


def same(a, b):
    """Equal to the last bit (a missing value matches a missing value)."""
    return a != a if b is None else a == b


def test_daily_table_matches_pandas_bit_for_bit():
    """Not just close: boosted trees can split between two values one rounding step apart."""
    assert list(D) == list(FIXTURE["daily"])
    for day, want in FIXTURE["daily"].items():
        assert set(D[day]) == set(want)
        for col, v in want.items():
            assert same(D[day][col], v), (day, col, D[day][col], v)


def test_upwind_daily_matches_pandas_bit_for_bit():
    assert list(UP) == ["north", "fujian", "southwest", "south"]
    for day, want in FIXTURE["up_daily"].items():
        for name, v in want.items():
            assert same(UP[name][day], v), (day, name)


def test_features_match_pandas():
    for row in FIXTURE["expected"]:
        today = date.fromisoformat(row["today"])
        x = pm.features(D, today, UP)
        assert list(x) == FULL  # same order as the training columns
        for name, got, want in zip(FULL, x.values(), row["features"]):
            assert got == want, (row["today"], name, got, want)  # every feature, to the last bit
        v1 = pm.features(D, today)
        assert list(v1) == V1 and list(v1.values()) == list(x.values())[:25]


@pytest.mark.parametrize("kind", ["v1", "ridge", "boosted", "blend"])
def test_every_model_kind_matches_scikit_learn(kind):
    """The headline check: plain-Python features + JSON model == pandas + scikit-learn, to 1e-6, per kind."""
    target = KINDS[kind]
    assert target["features"] == (V1 if kind == "v1" else FULL)
    worst = 0.0
    for row in FIXTURE["expected"]:
        feats = pm.features(D, date.fromisoformat(row["today"]), UP)
        got = pm.predict_target(target, [feats[n] for n in target["features"]])
        worst = max(worst, abs(got - row["pm25"][kind]))
    assert worst < TOLERANCE, (kind, worst)


def test_pm10_v1_matches_scikit_learn():
    target = MODEL["targets"]["pm10"]
    for row in FIXTURE["expected"]:
        feats = pm.features(D, date.fromisoformat(row["today"]), UP)
        assert abs(pm.predict_target(target, [feats[n] for n in V1]) - row["pm10"]["v1"]) < TOLERANCE


def test_the_kinds_really_differ():
    """Guards the parity test against comparing a model with itself."""
    row = FIXTURE["expected"][-1]
    values = {round(row["pm25"][k], 6) for k in ("v1", "ridge", "boosted", "blend")}
    assert len(values) == 4
    assert abs(row["pm25"]["blend"] - (row["pm25"]["ridge"] + row["pm25"]["boosted"]) / 2) < 1e-9


def test_committed_taichung_model_is_the_recorded_one():
    """If this fails, Taichung was retrained without --parity-fixture: regenerate the fixture."""
    committed = json.loads((HERE / "model" / "models" / "taichung.json").read_text(encoding="utf-8"))
    assert committed["format"] == pm.FORMAT
    if committed.get("end") == MODEL_DOC.get("end") and committed["chosen"] == MODEL_DOC["chosen"]:
        assert committed["targets"] == MODEL_DOC["targets"] and committed["interval"] == MODEL_DOC["interval"]


def test_parity_live_when_pandas_and_sklearn_are_installed():
    """The same comparisons computed now (not from the recording), plus trees with missing values and an
    infinite threshold; skipped on the server's slim install."""
    pd = pytest.importorskip("pandas")
    np = pytest.importorskip("numpy")
    pytest.importorskip("sklearn")
    sys.path.insert(0, str(HERE / "model"))
    import train  # noqa: E402

    d_pd = train.daily_table(train.hourly_frame(FIXTURE["aq"]), train.hourly_frame(FIXTURE["wx"]))
    X = train.features(d_pd, train.upwind_frame(UP_RAW))
    ok = X.notna().all(axis=1)
    assert list(X.columns) == FULL and ok.sum() >= 20
    rows = []
    for day in X.index[ok]:
        feats = pm.features(D, day.date(), UP)
        np.testing.assert_array_equal(list(feats.values()), X.loc[day].to_numpy(dtype=float))  # to the last bit
        rows.append(list(feats.values()))
    # fresh models on made-up rows shaped like the features -> export -> JSON -> plain Python
    rng = np.random.default_rng(0)
    base = np.asarray(rows)
    Xfit = pd.DataFrame(np.vstack([base + rng.normal(0, 3, base.shape) for _ in range(30)]), columns=FULL)
    y = Xfit["pm25"] * 0.7 - Xfit["tmr_wind"] * 0.3 + np.where(Xfit["up_north"] > base[:, 28].mean(), 4.0, 0.0) + rng.normal(0, 1, len(Xfit))
    Xnan = Xfit.copy()
    Xnan.loc[rng.random(len(Xnan)) < 0.15, "up_north"] = np.nan  # trees learn where missing values go
    Xnan.loc[rng.random(len(Xnan)) < 0.5, "tmr_rain"] = np.nan
    cases = [("v1", train.ridge().fit(Xfit[V1], y), Xfit[V1]), ("ridge", train.ridge().fit(Xfit, y), Xfit),
             ("boosted", train.hgb().fit(Xfit, y), Xfit), ("blend", train.Blend().fit(Xfit, y), Xfit),
             ("boosted", train.hgb().fit(Xnan, y), Xnan)]
    for kind, fitted, frame in cases:
        exported = json.loads(json.dumps(train.export_target(kind, fitted, list(frame.columns))))
        target = pm.load_target(exported)
        want = fitted.predict(frame)
        got = [pm.predict_target(target, r) for r in frame.to_numpy(dtype=float).tolist()]
        np.testing.assert_allclose(got, want, rtol=0, atol=TOLERANCE, err_msg=kind)
    assert any(t is None for t in exported["trees"]["v"]) or "1" in exported["trees"]["m"]  # the NaN case has NaN routing


# ---------- trees by hand ----------

TINY = {"kind": "boosted", "features": ["a", "b"], "trees": {
    # tree 0: a <= 1.5 ? (b <= +inf ? 10 : 20) : 30, NaN in a goes right, NaN in b goes right;  tree 1: one leaf
    "baseline": 100.0, "root": [0, 5],
    "f": [0, 1, -1, -1, -1, -1], "v": [1.5, None, 10.0, 20.0, 30.0, 0.5],
    "l": [1, 2, 0, 0, 0, 0], "r": [4, 3, 0, 0, 0, 0], "m": "000000"}}


def test_tree_traversal_rules():
    t = pm.load_target(TINY)
    nan = float("nan")
    assert pm.predict_target(t, [1.5, 7.0]) == 110.5      # a <= threshold goes left; b <= +inf goes left
    assert pm.predict_target(t, [1.5000001, 7.0]) == 130.5  # above the threshold goes right
    assert pm.predict_target(t, [nan, 7.0]) == 130.5      # missing: this node sends it right
    assert pm.predict_target(t, [0.0, nan]) == 120.5      # missing below an infinite threshold goes right
    left = json.loads(json.dumps(TINY))
    left["trees"]["m"] = "110000"
    t = pm.load_target(left)
    assert pm.predict_target(t, [nan, 7.0]) == 110.5 and pm.predict_target(t, [0.0, nan]) == 110.5


@pytest.mark.parametrize("change", [
    {"f": [0, 2, -1, -1, -1, -1]},            # feature index beyond the feature list
    {"l": [1, 9, 0, 0, 0, 0]},                # child outside its tree
    {"r": [0, 3, 0, 0, 0, 0]},                # child not after its parent (a loop)
    {"l": [5, 2, 0, 0, 0, 0]},                # child in the next tree
    {"root": [1, 5]}, {"root": [0, 9]}, {"root": []},
    {"v": [1.5, None, 10.0]},                 # arrays of different lengths
])
def test_broken_tree_tables_are_refused(change):
    doc = json.loads(json.dumps(TINY))
    doc["trees"].update(change)
    with pytest.raises((ValueError, IndexError, OverflowError, TypeError)):
        pm.load_target(doc)


def test_broken_model_files_are_refused():
    for change in ({"format": 1}, {"targets": {"pm25": MODEL_DOC["targets"]["pm10"]}}, {"interval": {"pm25": [1], "pm10": [1, 2]}}):
        with pytest.raises((ValueError, KeyError, TypeError)):
            pm.load_model({**MODEL_DOC, **change})
    bad = json.loads(json.dumps(MODEL_DOC["targets"]["pm10"]))
    bad["ridge"]["scale"][3] = 0
    with pytest.raises(ValueError):
        pm.load_target(bad)
    bad = json.loads(json.dumps(MODEL_DOC["targets"]["pm10"]))
    bad["kind"] = "forest"
    with pytest.raises(ValueError):
        pm.load_target(bad)


# ---------- the answer ----------

LAST = FIXTURE["expected"][-1]
TODAY = date.fromisoformat(LAST["today"])
TOMORROW = "2026-11-08"


def test_predict_answer_shape_and_values():
    out = pm.predict(MODEL, AQ, WX, UP, TODAY)
    assert list(out) == ["date", "pm25", "pm25_range", "pm10", "pm10_range", "aqi", "category", "color", "bad_day",
                         "advice", "today", "baseline", "tomorrow_weather", "model"]
    p25, p10 = LAST["pm25"]["blend"], LAST["pm10"]["v1"]
    assert out["date"] == TOMORROW
    assert out["pm25"] == round(max(0.0, p25), 1) and out["pm10"] == round(max(0.0, p10), 1)
    lo, hi = MODEL_DOC["interval"]["pm25"]
    assert out["pm25_range"] == [round(max(0, p25 + lo), 1), round(p25 + hi, 1)]
    assert out["pm25_range"][0] <= out["pm25"] <= out["pm25_range"][1]
    today = FIXTURE["daily"][LAST["today"]]
    assert out["today"]["pm25"] == out["baseline"]["pm25"] == round(today["pm25"], 1)
    assert out["today"]["aqi"] == pm.aqi(today["pm25"], today["pm10"])
    assert out["aqi"] == pm.aqi(max(0.0, p25), max(0.0, p10))
    assert (out["category"], out["color"]) == pm.category(out["aqi"])
    assert out["bad_day"] is (p25 > MODEL_DOC["warn_threshold"])
    assert set(out["advice"]) == {"level", "title", "detail"} and out["advice"] == pm.school_advice(out["aqi"])
    tomorrow = FIXTURE["daily"][TOMORROW]
    assert out["tomorrow_weather"] == {"rain_mm": round(tomorrow["rain"], 1), "wind_kmh": round(tomorrow["wind"], 1)}
    assert out["model"] == {"kind": "blend", "test_mae": MODEL_DOC["test_mae"]["pm25"],
                            "baseline_mae": MODEL_DOC["baseline_mae"]["pm25"]}
    json.dumps(out)  # plain JSON types only


def with_pm25(kind_target, **changes):
    return {**MODEL, **changes, "targets": {"pm25": kind_target, "pm10": MODEL["targets"]["pm10"]}}


@pytest.mark.parametrize("kind", ["v1", "ridge", "boosted", "blend"])
def test_predict_reports_the_chosen_kind(kind):
    out = pm.predict(with_pm25(KINDS[kind]), AQ, WX, UP, TODAY)
    assert out["model"]["kind"] == kind and out["pm25"] == round(max(0.0, LAST["pm25"][kind]), 1)


def test_bad_day_uses_the_tuned_threshold():
    p25 = LAST["pm25"]["blend"]
    assert pm.predict(with_pm25(KINDS["blend"], warn_threshold=p25 - 0.01), AQ, WX, UP, TODAY)["bad_day"] is True
    assert pm.predict(with_pm25(KINDS["blend"], warn_threshold=p25 + 0.01), AQ, WX, UP, TODAY)["bad_day"] is False
    assert pm.load_model({k: v for k, v in MODEL_DOC.items() if k != "warn_threshold"})["warn_threshold"] == 35.0


def test_upwind_is_needed_only_beyond_v1():
    v1_only = with_pm25(KINDS["v1"])
    assert pm.needs_upwind(MODEL) is True and pm.needs_upwind(v1_only) is False
    assert pm.predict(v1_only, AQ, WX, None, TODAY)["pm25"] == round(LAST["pm25"]["v1"], 1)
    with pytest.raises(pm.InputError, match="upwind"):
        pm.predict(MODEL, AQ, WX, None, TODAY)
    with pytest.raises(pm.InputError, match="up_north"):
        pm.predict(MODEL, AQ, WX, {**UP, "north": {}}, TODAY)


def test_predict_needs_the_week_before_and_tomorrow():
    with pytest.raises(pm.InputError):
        pm.predict(MODEL, AQ, WX, UP, date(2026, 11, 8))   # no tomorrow in the data
    first = date.fromisoformat(min(FIXTURE["daily"]))
    with pytest.raises(pm.InputError):
        pm.predict(MODEL, AQ, WX, UP, first)                # no yesterday
    with pytest.raises(pm.InputError, match="pm25_7d"):
        pm.predict(MODEL, AQ, WX, UP, date.fromordinal(first.toordinal() + 3))  # yesterday, but not a full week
    wx = {**WX, "surface_pressure": [None] * len(WX["time"])}
    with pytest.raises(pm.InputError, match="pres"):
        pm.predict(MODEL, AQ, wx, UP, TODAY)


def test_negative_predictions_are_clamped_to_zero():
    doc = json.loads(json.dumps(MODEL_DOC))
    doc["targets"]["pm25"]["ridge"]["intercept"] -= 5000
    out = pm.predict(pm.load_model(doc), AQ, WX, UP, TODAY)
    assert out["pm25"] == 0.0 and out["pm25_range"][0] == 0.0 and out["bad_day"] is False


# ---------- AQI, categories, advice (ported from the team's airmodel.py) ----------

@pytest.mark.parametrize("pm25,pm10,want", [
    (0, 0, 0), (9.0, 0, 50), (9.09, 0, 50), (9.1, 0, 51), (12.0, 0, 56), (35.4, 0, 100), (35.49, 0, 100),
    (35.5, 0, 101), (55.4, 0, 150), (55.5, 0, 151), (125.4, 0, 200), (225.4, 0, 300), (325.4, 0, 500), (400, 0, 500),
    (0, 54, 50), (0, 54.9, 50), (0, 55, 51), (0, 154, 100), (0, 155, 101), (0, 604, 500), (0, 700, 500),
    (12.0, 155, 101), (40.0, 20, 112),
])
def test_aqi(pm25, pm10, want):
    assert pm.aqi(pm25, pm10) == want


def test_category_and_advice():
    assert pm.category(50) == ("Good", "#3ad06e") and pm.category(51) == ("Moderate", "#f5d33b")
    assert pm.category(150)[0] == "Unhealthy for Sensitive Groups" and pm.category(200)[0] == "Unhealthy"
    assert pm.category(300)[0] == "Very Unhealthy" and pm.category(301) == ("Hazardous", "#8a1538")
    assert [pm.school_advice(a)["level"] for a in (50, 100, 150, 200, 201)] == ["go", "go", "limit", "indoor", "indoor"]
    assert pm.school_advice(50)["title"] == "Outdoor PE as normal" and pm.school_advice(100)["title"] == "Outdoor PE OK"
    assert pm.school_advice(200)["title"] == "Move PE indoors" and pm.school_advice(300)["title"] == "Keep students indoors"


# ---------- requests ----------

def test_requests_are_the_team_apps():
    (aq_url, aq), (wx_url, wx) = pm.input_requests(24.1477, 120.6736)
    assert aq_url.endswith("/v1/air-quality") and wx_url.endswith("/v1/forecast")
    assert aq == {"latitude": 24.1477, "longitude": 120.6736, "timezone": "Asia/Taipei", "domains": "cams_global",
                  "past_days": 8, "forecast_days": 3, "hourly": "pm2_5,pm10"}
    assert wx["past_days"] == 8 and wx["forecast_days"] == 3 and wx["hourly"].split(",") == pm.MODEL_WX
    url, up = pm.upwind_request()
    assert url == aq_url and up == {"latitude": "25.0,25.0,23.8,22.6", "longitude": "121.2,119.0,120.3,120.3",
                                    "timezone": "Asia/Taipei", "domains": "cams_global", "hourly": "pm2_5",
                                    "past_days": 8, "forecast_days": 3}
    assert MODEL_DOC["upwind"] == {k: list(v) for k, v in pm.UPWIND.items()}  # trained on the points we fetch


# ---------- cities and files ----------

def test_cities_file():
    models = pm.Models()
    assert len(models.cities) == 22 and len(models.by_id) == 22
    t = models.by_id["taichung"]
    assert (t["lat"], t["lon"]) == (24.1477, 120.6736)  # the team's coordinates, so results stay comparable
    for c in models.cities:
        assert 21.8 < c["lat"] < 26.5 and 118.0 < c["lon"] < 122.2 and c["name"] and c["name_zh"]


def test_nearest_city():
    models = pm.Models()
    city, km = models.nearest(24.1477, 120.6736)
    assert city["id"] == "taichung" and km < 0.01
    city, km = models.nearest(25.033, 121.565)  # Taipei 101
    assert city["id"] == "taipei" and km < 2
    city, km = models.nearest(23.47, 120.96)    # Yushan: far from every city centre
    assert km > pm.MAX_DISTANCE_KM
    assert abs(pm.distance_km(25.0375, 121.5637, 22.6203, 120.3120) - 297) < 3  # Taipei - Kaohsiung


def test_every_committed_model_loads_and_has_a_report():
    models = pm.Models()
    ready = models.available()
    assert "taichung" in ready
    summary = {r["id"]: r for r in models.summary()["cities"]}
    assert set(summary) == set(models.by_id)
    for cid in ready:
        m = models.model(cid)
        assert m is not None, cid
        report = json.loads(models.metrics_json(cid))
        assert report["city"]["id"] == cid and report["n_test"] == 365
        assert report["chosen"] == m["chosen"] and set(m["chosen"].values()) <= set(pm.KINDS)
        assert report["warn_threshold"] == m["warn_threshold"] and 20 <= m["warn_threshold"] <= 35
        row = summary[cid]
        assert row["has_model"] is True and row["chosen"] == m["chosen"]
        for t in ("pm25", "pm10"):
            kind = m["chosen"][t]
            assert m["targets"][t]["kind"] == kind and report["features"][t] == m["targets"][t]["features"]
            assert len(m["targets"][t]["features"]) == (25 if kind == "v1" else 33)
            assert round(report["results"][t][kind]["mae"], 2) == m["test_mae"][t]
            assert len(report["series"][t]["actual"]) == 365
            # checked when the file was written: the JSON model against scikit-learn on every training row,
            # and predict.py from the raw hourly history against pandas + scikit-learn on every usable day
            par = m["parity"][t]
            assert par["export"] < TOLERANCE, (cid, t)
            assert par["end_to_end"]["rows"] > 1000 and par["end_to_end"]["over_tolerance"] == 0, (cid, t, par)
            assert par["end_to_end"]["max_diff"] < TOLERANCE, (cid, t)
            # the choice came from cross-validation, never from the test year
            cv = report["results"][t]["cv_mae"]
            assert kind == min(pm.KINDS, key=lambda k: cv[k])
            assert row[t]["beats_baseline"] is (row[t]["model_mae"] < row[t]["baseline_mae"])
    for cid in set(models.by_id) - set(ready):
        assert summary[cid]["has_model"] is False


def test_missing_or_broken_model_files(tmp_path):
    (tmp_path / "models").mkdir()
    (tmp_path / "models" / "taichung.json").write_text("{not json")
    models = pm.Models(tmp_path)  # no cities.json: falls back to Taichung alone
    assert [c["id"] for c in models.cities] == ["taichung"]
    assert models.model("taichung") is None and models.available() == [] and models.metrics_json("taichung") is None
    assert models.model("../cities") is None and models.metrics_json("../../server") is None  # ids come from the list only
    assert models.summary()["missing"] == ["taichung"]
    # a file in the right format that turns out to be unusable stops counting once it has been tried
    (tmp_path / "models" / "taichung.json").write_text('{"format":2,"targets":{}}')
    models = pm.Models(tmp_path)
    assert models.available() == ["taichung"] and models.model("taichung") is None and models.available() == []
    # an old (v1 recipe) file is not the current format
    (tmp_path / "models" / "taichung.json").write_text('{"city":{},"kind":"ridge","features":[]}')
    assert pm.Models(tmp_path).available() == []
