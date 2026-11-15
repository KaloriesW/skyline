"""Tests for model/predict.py: the plain-Python daily table, features and ridge must match pandas and
scikit-learn. No network: the inputs are recorded rows in model/fixtures/taichung_parity.json, written by
`train.py --parity-fixture` together with the pandas features and the scikit-learn predictions for them.

    python -m pytest -p no:cacheprovider test_predict.py
"""

from __future__ import annotations

import json
import math
import sys
from datetime import date
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from model import predict as pm  # noqa: E402

FIXTURE = json.loads((HERE / "model" / "fixtures" / "taichung_parity.json").read_text(encoding="utf-8"))
AQ, WX, MODEL = FIXTURE["aq"]["hourly"], FIXTURE["wx"]["hourly"], FIXTURE["model"]


def close(a, b, rel=1e-9, abs_tol=1e-9):
    if b is None or (isinstance(b, float) and math.isnan(b)):
        return a != a
    return math.isclose(a, b, rel_tol=rel, abs_tol=abs_tol)


# ---------- parity with pandas / scikit-learn (recorded) ----------

def test_fixture_is_what_the_test_needs():
    assert FIXTURE["city"] == "taichung" and len(FIXTURE["expected"]) >= 8
    assert FIXTURE["feature_names"] == MODEL["features"] and len(MODEL["features"]) == 25
    assert any(v is None for v in AQ["pm2_5"]) and any(v is None for v in WX["precipitation"])  # gaps are covered


def test_daily_table_matches_pandas():
    d = pm.daily_table(AQ, WX)
    assert list(d) == list(FIXTURE["daily"])
    for day, want in FIXTURE["daily"].items():
        assert set(d[day]) == set(want)
        for col, v in want.items():
            assert close(d[day][col], v), (day, col, d[day][col], v)


def test_features_match_pandas():
    d = pm.daily_table(AQ, WX)
    for row in FIXTURE["expected"]:
        x = pm.features(d, date.fromisoformat(row["today"]))
        assert list(x) == FIXTURE["feature_names"]  # same order as the training columns
        for name, got, want in zip(FIXTURE["feature_names"], x.values(), row["features"]):
            assert close(got, want), (row["today"], name, got, want)


def test_json_ridge_matches_scikit_learn():
    """The headline check: plain-Python features + JSON ridge == pandas + scikit-learn pipeline, to 1e-6."""
    d = pm.daily_table(AQ, WX)
    worst = 0.0
    for row in FIXTURE["expected"]:
        feats = pm.features(d, date.fromisoformat(row["today"]))
        x = [feats[n] for n in MODEL["features"]]
        for target in ("pm25", "pm10"):
            got = pm.ridge_predict(MODEL["targets"][target], x)
            worst = max(worst, abs(got - row[target]))
            assert abs(got - row[target]) < 1e-6, (row["today"], target, got, row[target])
    assert worst < 1e-6


def test_committed_taichung_model_is_the_recorded_one():
    """If this fails, Taichung was retrained without --parity-fixture: regenerate the fixture."""
    committed = json.loads((HERE / "model" / "models" / "taichung.json").read_text(encoding="utf-8"))
    assert committed["features"] == MODEL["features"]
    if committed.get("end") == MODEL.get("end"):
        assert committed["targets"] == MODEL["targets"] and committed["interval"] == MODEL["interval"]


def test_parity_live_when_pandas_and_sklearn_are_installed():
    """Same comparison computed now (not from the recording); skipped on the server's slim install."""
    pd = pytest.importorskip("pandas")
    np = pytest.importorskip("numpy")
    pytest.importorskip("sklearn")
    sys.path.insert(0, str(HERE / "model"))
    import train  # noqa: E402

    d_pd = train.daily_table(train.hourly_frame(FIXTURE["aq"]), train.hourly_frame(FIXTURE["wx"]))
    X = train.features(d_pd)
    d = pm.daily_table(AQ, WX)
    ok = X.notna().all(axis=1)
    assert ok.sum() >= 8
    rows = []
    for day in X.index[ok]:
        feats = pm.features(d, day.date())
        assert list(feats) == list(X.columns)
        np.testing.assert_allclose(list(feats.values()), X.loc[day].to_numpy(dtype=float), rtol=1e-9, atol=1e-9)
        rows.append(list(feats.values()))
    # a fresh pipeline -> export -> plain-Python prediction
    rng = np.random.default_rng(0)
    Xfit = pd.DataFrame(np.asarray(rows) + rng.normal(0, 1, (len(rows), len(X.columns))).cumsum(axis=0), columns=X.columns)
    Xfit = pd.concat([Xfit] * 4, ignore_index=True) + rng.normal(0, 3, (len(rows) * 4, len(X.columns)))
    y = Xfit["pm25"] * 0.7 + Xfit["tmr_wind"] * -0.3 + rng.normal(0, 1, len(Xfit))
    pipe = train.ridge().fit(Xfit, y)
    exported = train.export_ridge(pipe)
    want = pipe.predict(X[ok])
    got = [pm.ridge_predict(exported, r) for r in rows]
    np.testing.assert_allclose(got, want, rtol=0, atol=1e-6)


# ---------- the answer ----------

def test_predict_answer_shape_and_values():
    row = FIXTURE["expected"][-1]
    out = pm.predict(MODEL, AQ, WX, date.fromisoformat(row["today"]))
    assert list(out) == ["date", "pm25", "pm25_range", "pm10", "pm10_range", "aqi", "category", "color", "bad_day",
                         "advice", "today", "baseline", "tomorrow_weather", "model"]
    assert out["date"] == "2026-11-08"
    assert out["pm25"] == round(max(0.0, row["pm25"]), 1) and out["pm10"] == round(max(0.0, row["pm10"]), 1)
    lo, hi = MODEL["interval"]["pm25"]
    assert out["pm25_range"] == [round(max(0, row["pm25"] + lo), 1), round(row["pm25"] + hi, 1)]
    assert out["pm25_range"][0] <= out["pm25"] <= out["pm25_range"][1]
    today = FIXTURE["daily"][row["today"]]
    assert out["today"]["pm25"] == out["baseline"]["pm25"] == round(today["pm25"], 1)
    assert out["today"]["aqi"] == pm.aqi(today["pm25"], today["pm10"])
    assert out["aqi"] == pm.aqi(max(0.0, row["pm25"]), max(0.0, row["pm10"]))
    assert (out["category"], out["color"]) == pm.category(out["aqi"])
    assert out["bad_day"] is (row["pm25"] > 35.0)
    assert set(out["advice"]) == {"level", "title", "detail"} and out["advice"] == pm.school_advice(out["aqi"])
    tomorrow = FIXTURE["daily"]["2026-11-08"]
    assert out["tomorrow_weather"] == {"rain_mm": round(tomorrow["rain"], 1), "wind_kmh": round(tomorrow["wind"], 1)}
    assert out["model"] == {"kind": "ridge", "test_mae": MODEL["test_mae"]["pm25"], "baseline_mae": MODEL["baseline_mae"]["pm25"]}
    json.dumps(out)  # plain JSON types only


def test_predict_needs_three_days_and_no_gaps():
    with pytest.raises(pm.InputError):
        pm.predict(MODEL, AQ, WX, date(2026, 11, 8))   # no tomorrow in the data
    with pytest.raises(pm.InputError):
        pm.predict(MODEL, AQ, WX, date(2026, 10, 28))  # no yesterday
    wx = {**WX, "surface_pressure": [None] * len(WX["time"])}
    with pytest.raises(pm.InputError, match="pres"):
        pm.predict(MODEL, AQ, wx, date(2026, 11, 5))


def test_negative_predictions_are_clamped_to_zero():
    model = json.loads(json.dumps(MODEL))
    model["targets"]["pm25"]["intercept"] -= 1000
    out = pm.predict(model, AQ, WX, date(2026, 11, 5))
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
        assert m["features"] == MODEL["features"] and m["kind"] == "ridge"
        report = json.loads(models.metrics_json(cid))
        assert report["chosen"] == {"pm25": "ridge", "pm10": "ridge"} and report["city"]["id"] == cid
        assert report["n_test"] == 365 and len(report["series"]["pm25"]["actual"]) == 365
        assert round(report["results"]["pm25"]["ridge"]["mae"], 2) == m["test_mae"]["pm25"]
        row = summary[cid]
        assert row["has_model"] is True
        assert row["pm25"]["beats_baseline"] is (row["pm25"]["model_mae"] < row["pm25"]["baseline_mae"])
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
