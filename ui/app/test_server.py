"""Tests for the Skyline app server. No network and no real keys: every upstream is an httpx.MockTransport.

    python -m pytest -p no:cacheprovider test_server.py
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import date
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import server  # noqa: E402
from server import airmodel, extras  # noqa: E402

FAKE_OR_KEY = "sk-or-test-not-a-real-key"
FAKE_CWA_KEY = "CWA-TEST-not-a-real-key"
SECRET_URL = "https://landslide.test/secret-path-token"
MODEL_URL = "https://model.test/api/predict"
PREDICTION = {  # the shape skyline/backend/server.py returns on the `app` branch (the proxy fallback passes it on)
    "date": "2026-11-16", "pm25": 18.4, "pm25_range": [9.1, 27.7], "pm10": 33.0, "pm10_range": [18.2, 47.9],
    "aqi": 64, "category": "Moderate", "color": "#ffff00", "bad_day": False,
    "advice": {"level": "go", "title": "Outdoor PE OK", "detail": "Fine for most students."},
    "today": {"pm25": 16.0, "pm10": 30.1, "aqi": 59, "category": "Moderate"},
    "baseline": {"pm25": 16.0, "pm10": 30.1},
    "tomorrow_weather": {"rain_mm": 0.4, "wind_kmh": 11.2},
    "model": {"kind": "gbr", "test_mae": 5.12, "baseline_mae": 6.3},
}
ENV = [
    "OPENROUTER_API_KEY", "ASK_MODEL", "ASK_BUDGET_USD", "ASK_RESERVE_USD", "ASK_SPEND_FILE", "CWA_API_KEY",
    "CWA_TYPHOON_URL", "TYPHOON_CACHE_SECONDS", "TYPHOON_STALE_HOURS", "LANDSLIDE_API_URL", "PM25_MODEL_URL",
    "PM25_CACHE_SECONDS", "PM25_MAX_KM", "MCP_ALLOWED_HOSTS", "MCP_ALLOWED_ORIGINS",
]
# Recorded Open-Meteo hourly rows + the model trained on them (see test_predict.py). The mocked Open-Meteo
# answers with these rows, and "today" is pinned to a day inside them.
PARITY = json.loads((HERE / "model" / "fixtures" / "taichung_parity.json").read_text(encoding="utf-8"))
TODAY = date(2026, 11, 7)
EXPECTED = airmodel.predict(PARITY["model"], PARITY["aq"]["hourly"], PARITY["wx"]["hourly"], TODAY)
AQ_HOST, WX_HOST = "air-quality-api.open-meteo.com", "api.open-meteo.com"
TAICHUNG = {"id": "taichung", "name": "Taichung City", "name_zh": "臺中市", "lat": 24.1477, "lon": 120.6736}
TAIPEI = {"id": "taipei", "name": "Taipei City", "name_zh": "臺北市", "lat": 25.0375, "lon": 121.5637}
REPORT = {"city": {"id": "taichung"}, "chosen": {"pm25": "ridge", "pm10": "ridge"}, "n_test": 365,
          "results": {"pm25": {"ridge": {"mae": 4.45}, "baseline": {"mae": 5.91}}}}
SUMMARY = {"model": "ridge", "cities": [{**TAICHUNG, "n_train": 1007, "n_test": 365,
                                         "pm25": {"baseline_mae": 5.91, "model_mae": 4.45, "improvement_pct": 24.7}}],
           "missing": ["everything else"]}


def model_dir(tmp_path, cities=("taichung", "taipei")):
    """A model directory like ui/app/model: the real city list, the recorded model for `cities`, and a
    report + summary for Taichung only."""
    d = tmp_path / "model"
    (d / "models").mkdir(parents=True)
    (d / "metrics").mkdir()
    shutil.copy(HERE / "model" / "cities.json", d / "cities.json")
    for cid in cities:
        (d / "models" / f"{cid}.json").write_text(json.dumps(PARITY["model"]), encoding="utf-8")
    (d / "metrics" / "taichung.json").write_text(json.dumps(REPORT), encoding="utf-8")
    (d / "summary.json").write_text(json.dumps(SUMMARY), encoding="utf-8")
    return d
TYPHOON_DOC = json.loads((HERE.parent / "server" / "fixtures" / "cwa_W-C0034-005.json").read_text(encoding="utf-8"))


class Upstream:
    def __init__(self):
        self.requests = []
        self.model = lambda req: httpx.Response(200, json=PREDICTION)
        self.meteo = lambda req: httpx.Response(200, json=PARITY["aq" if req.url.host == AQ_HOST else "wx"])

    def __call__(self, req: httpx.Request) -> httpx.Response:
        self.requests.append(req)
        if req.url.host == "model.test":
            return self.model(req)
        if req.url.host in (AQ_HOST, WX_HOST):
            return self.meteo(req)
        if req.url.host in ("cwaopendata.s3.ap-northeast-1.amazonaws.com", "opendata.cwa.gov.tw"):
            return httpx.Response(200, json=TYPHOON_DOC)
        if req.url.host == "openrouter.ai":
            return httpx.Response(200, headers={"content-type": "text/event-stream"},
                                  content=b'data: {"choices":[{"delta":{"content":"Rain."}}]}\n\ndata: [DONE]\n\n')
        return httpx.Response(599, text="unexpected host in test")

    def to(self, host):
        return [r for r in self.requests if r.url.host == host]


@pytest.fixture
def up(monkeypatch, tmp_path):
    for name in ENV:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ASK_SPEND_FILE", str(tmp_path / "spend.json"))
    upstream = Upstream()
    transport = httpx.MockTransport(upstream)
    server.predict_state.transport = extras.state.transport = transport
    server.predict_state.model_dir = model_dir(tmp_path)
    server.predict_state.today = lambda: TODAY
    server.predict_state.reset()
    extras.state.reset()
    yield upstream
    server.predict_state.transport = extras.state.transport = None
    server.predict_state.model_dir = airmodel.MODEL_DIR
    server.predict_state.today = airmodel.today_taipei
    server.predict_state.reset()
    extras.state.reset()


@pytest.fixture
def no_models(up, tmp_path):
    """No local model files at all: only the proxy fallback can answer."""
    server.predict_state.model_dir = model_dir(tmp_path / "empty", cities=())
    server.predict_state.reset()
    return up


@pytest.fixture
def client(up):
    # No MCP here: its session manager can only be started once per process (see test_mcp_endpoint).
    with TestClient(server.build_app(with_mcp=False)) as c:
        yield c


# ---------- the page and its assets ----------

def test_index_served(client):
    r = client.get("/")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    assert r.text == (server.WEB / "index.html").read_text(encoding="utf-8")
    assert r.headers["cache-control"] == "no-cache"
    assert client.get("/index.html").text == r.text


@pytest.mark.parametrize("name,ctype", [("app.js", "javascript"), ("styles.css", "text/css")])
def test_assets_served(client, name, ctype):
    r = client.get("/" + name)
    assert r.status_code == 200 and ctype in r.headers["content-type"]
    assert r.content == (server.WEB / name).read_bytes()
    assert r.headers["cache-control"] == "no-cache" and r.headers.get("etag")
    again = client.get("/" + name, headers={"If-None-Match": r.headers["etag"]})
    assert again.status_code == 304


def test_assets_are_gzipped_and_have_security_headers(client):
    r = client.get("/app.js", headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("content-encoding") == "gzip"
    for path in ("/", "/app.js", "/api/health", "/nope.txt"):
        h = client.get(path).headers
        assert h["x-content-type-options"] == "nosniff"
        assert h["referrer-policy"] == "strict-origin-when-cross-origin"
        assert "content-security-policy" not in h and "access-control-allow-origin" not in h


def test_no_cors_opening(client):
    r = client.options("/api/health", headers={"Origin": "https://evil.test", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers
    assert "access-control-allow-origin" not in client.get("/api/health", headers={"Origin": "https://evil.test"}).headers


def test_missing_files_and_escapes(client, tmp_path):
    assert client.get("/nope.js").status_code == 404
    for path in ("/../server.py", "/..%2fserver.py", "/%2e%2e/server.py", "/.env", "/..%2f.env.example", "/.hidden/x"):
        r = client.get(path)
        assert r.status_code == 404, path
        assert "PM25_MODEL_URL" not in r.text and "FastAPI" not in r.text
    r = client.get("/api/nope")
    assert r.status_code == 404 and r.json() == {"error": "not found"}


# ---------- /api/health ----------

def test_health_with_nothing_configured(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    # typhoon is off here only because the fixture removed the default server.py set at import;
    # pm25 needs no setting: the local model files are enough (two cities in the test directory)
    assert r.json() == {"ok": True, "version": server.VERSION,
                        "features": {"ask": False, "typhoon": False, "landslide": False, "pm25": True,
                                     "pm25_cities": 2, "mcp": False}}


def test_health_with_everything_configured(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", FAKE_OR_KEY)
    monkeypatch.setenv("CWA_API_KEY", FAKE_CWA_KEY)
    monkeypatch.setenv("LANDSLIDE_API_URL", SECRET_URL)
    monkeypatch.setenv("PM25_MODEL_URL", MODEL_URL)
    r = client.get("/api/health")
    assert r.json()["features"] == {"ask": True, "typhoon": True, "landslide": True, "pm25": True,
                                    "pm25_cities": 2, "mcp": False}
    for secret in (FAKE_OR_KEY, FAKE_CWA_KEY, SECRET_URL, MODEL_URL, "model.test"):
        assert secret not in r.text


def test_health_pm25_without_model_files(client, no_models, monkeypatch):
    f = client.get("/api/health").json()["features"]
    assert f["pm25"] is False and f["pm25_cities"] == 0
    r = client.get("/api/predict")
    assert r.status_code == 503 and "error" in r.json()
    monkeypatch.setenv("PM25_MODEL_URL", MODEL_URL)  # the proxy fallback alone switches the feature on
    f = client.get("/api/health").json()["features"]
    assert f["pm25"] is True and f["pm25_cities"] == 0


def test_health_counts_the_committed_models(client):
    server.predict_state.model_dir = airmodel.MODEL_DIR  # the real ui/app/model directory
    server.predict_state.reset()
    f = client.get("/api/health").json()["features"]
    assert f["pm25"] is True and 1 <= f["pm25_cities"] <= 22


# ---------- defaults and .env ----------

def test_typhoon_default_is_the_public_mirror():
    env = {}
    server.apply_defaults(env)
    assert env["CWA_TYPHOON_URL"] == server.CWA_TYPHOON_PUBLIC_URL
    assert env["ASK_SPEND_FILE"] == str(server.HERE / "ask_spend.json")

    env = {"CWA_API_KEY": FAKE_CWA_KEY, "ASK_SPEND_FILE": "/somewhere/else.json"}
    server.apply_defaults(env)
    assert "CWA_TYPHOON_URL" not in env and env["ASK_SPEND_FILE"] == "/somewhere/else.json"  # the key wins

    env = {"CWA_TYPHOON_URL": ""}
    server.apply_defaults(env)
    assert env["CWA_TYPHOON_URL"] == ""  # explicitly off stays off

    env = {"CWA_TYPHOON_URL": "https://mirror.test/t.json"}
    server.apply_defaults(env)
    assert env["CWA_TYPHOON_URL"] == "https://mirror.test/t.json"


def test_typhoon_works_with_no_key(client, up, monkeypatch):
    monkeypatch.setenv("CWA_TYPHOON_URL", server.CWA_TYPHOON_PUBLIC_URL)  # what apply_defaults sets
    assert client.get("/api/health").json()["features"]["typhoon"] is True
    r = client.get("/api/typhoon")
    assert r.status_code == 200 and isinstance(r.json()["active"], bool)
    (req,) = up.to("cwaopendata.s3.ap-northeast-1.amazonaws.com")
    assert dict(req.url.params) == {}  # nothing secret travels to the mirror


def test_parse_env():
    text = """
    # a comment
    PLAIN=value
    export EXPORTED=yes
    SPACED = padded value
    QUOTED="keeps # hash and  spaces"
    SINGLE='single $quoted'
    INLINE=abc # trailing comment
    HASH_IN_VALUE=abc#def
    URL=https://example.test/a?b=c&d=e
    EMPTY=
    1BAD=x
    BAD KEY=x
    no equals sign
    """
    assert server.parse_env(text) == {
        "PLAIN": "value", "EXPORTED": "yes", "SPACED": "padded value", "QUOTED": "keeps # hash and  spaces",
        "SINGLE": "single $quoted", "INLINE": "abc", "HASH_IN_VALUE": "abc#def",
        "URL": "https://example.test/a?b=c&d=e", "EMPTY": "",
    }


def test_load_env_file_real_environment_wins(tmp_path):
    f = tmp_path / ".env"
    f.write_text("OPENROUTER_API_KEY=from-file\nASK_MODEL=file/model\nCWA_TYPHOON_URL=\n", encoding="utf-8")
    env = {"OPENROUTER_API_KEY": "from-shell"}
    assert server.load_env_file(f, env) == 2
    assert env == {"OPENROUTER_API_KEY": "from-shell", "ASK_MODEL": "file/model", "CWA_TYPHOON_URL": ""}
    assert server.load_env_file(tmp_path / "missing.env", env) == 0


def test_example_env_has_no_values_and_covers_every_setting():
    text = (HERE / ".env.example").read_text(encoding="utf-8")
    assert server.parse_env(text) == {}  # everything is commented out
    for name in ENV + ["HOST", "PORT", "ASK_RATE_PER_MIN", "ASK_RATE_PER_DAY", "ASK_GLOBAL_PER_MIN", "ASK_MAX_MESSAGES",
                       "ASK_MAX_INPUT_CHARS", "ASK_MAX_CONTEXT_CHARS", "ASK_MAX_TOKENS", "ASK_MAX_CONCURRENT",
                       "ASK_MAX_SECONDS", "ASK_TRUST_PROXY_HEADERS", "SKYLINE_API"]:
        assert f"# {name}=" in text, name


# ---------- /api/predict: local city models ----------

def meteo_calls(up):
    return len(up.to(AQ_HOST)) + len(up.to(WX_HOST))


def test_predict_without_coordinates_is_taichung(client, up):
    r = client.get("/api/predict")
    assert r.status_code == 200 and "x-skyline-stale" not in r.headers
    body = r.json()
    assert body == {**EXPECTED, "city": {**TAICHUNG, "distance_km": 0.0}}
    assert list(body) == ["date", "pm25", "pm25_range", "pm10", "pm10_range", "aqi", "category", "color", "bad_day",
                          "advice", "today", "baseline", "tomorrow_weather", "model", "city"]
    assert body["date"] == "2026-11-08" and body["model"]["kind"] == "ridge"
    assert set(body["advice"]) == {"level", "title", "detail"}
    assert not up.to("model.test")  # no proxy involved


def test_predict_asks_open_meteo_like_the_team_app(client, up):
    client.get("/api/predict")
    (aq,), (wx,) = up.to(AQ_HOST), up.to(WX_HOST)
    assert aq.url.path == "/v1/air-quality" and dict(aq.url.params) == {
        "latitude": "24.1477", "longitude": "120.6736", "timezone": "Asia/Taipei", "domains": "cams_global",
        "past_days": "2", "forecast_days": "3", "hourly": "pm2_5,pm10"}
    assert wx.url.path == "/v1/forecast" and dict(wx.url.params) == {
        "latitude": "24.1477", "longitude": "120.6736", "timezone": "Asia/Taipei", "past_days": "2", "forecast_days": "3",
        "hourly": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,"
                  "surface_pressure,boundary_layer_height"}


def test_predict_picks_the_nearest_city(client, up):
    r = client.get("/api/predict?lat=25.033&lon=121.565")  # Taipei 101
    assert r.status_code == 200
    city = r.json()["city"]
    assert {k: city[k] for k in TAIPEI} == TAIPEI and 0 < city["distance_km"] < 2
    assert dict(up.to(AQ_HOST)[0].url.params)["latitude"] == "25.0375"  # the city's coordinates, not the visitor's
    assert "25.033" not in str(up.to(AQ_HOST)[0].url) and "25.033" not in str(up.to(WX_HOST)[0].url)
    r = client.get("/api/predict?lat=24.20&lon=120.70")  # Taichung, a few km out
    assert r.json()["city"]["id"] == "taichung" and 5 < r.json()["city"]["distance_km"] < 8


def test_predict_far_from_every_city_is_404(client, up, monkeypatch):
    r = client.get("/api/predict?lat=23.47&lon=120.96")  # Yushan
    assert r.status_code == 404
    body = r.json()
    assert set(body) == {"error", "nearest", "max_km"} and body["max_km"] == 25
    assert set(body["nearest"]) == {"id", "name", "name_zh", "lat", "lon", "distance_km"}
    assert body["nearest"]["distance_km"] > 25
    assert client.get("/api/predict?lat=35.68&lon=139.69").status_code == 404  # Tokyo
    assert meteo_calls(up) == 0  # nothing fetched for a point we won't answer
    r = client.get("/api/predict?lat=24.1477&lon=120.99")  # about 32 km east of Taichung's centre
    assert r.status_code == 404 and r.json()["nearest"]["id"] == "taichung"
    monkeypatch.setenv("PM25_MAX_KM", "40")  # the limit is a setting
    r = client.get("/api/predict?lat=24.1477&lon=120.99")
    assert r.status_code == 200 and 30 < r.json()["city"]["distance_km"] < 34


@pytest.mark.parametrize("query", ["lat=24.1", "lon=120.6", "lat=abc&lon=120.6", "lat=24.1&lon=", "lat=91&lon=120",
                                   "lat=24&lon=181", "lat=nan&lon=120", "lat=inf&lon=120"])
def test_predict_bad_coordinates_are_400(client, up, query):
    r = client.get("/api/predict?" + query)
    assert r.status_code == 400 and set(r.json()) == {"error"}
    assert meteo_calls(up) == 0


def test_predict_is_cached_per_city(client, up):
    for _ in range(3):
        assert client.get("/api/predict").status_code == 200
    assert client.get("/api/predict?lat=24.15&lon=120.67").json()["city"]["id"] == "taichung"  # same city, same cache
    assert meteo_calls(up) == 2
    assert client.get("/api/predict?lat=25.04&lon=121.56").json()["city"]["id"] == "taipei"
    assert meteo_calls(up) == 4
    # the distance is per request, not from the cache
    assert client.get("/api/predict").json()["city"]["distance_km"] == 0.0
    assert client.get("/api/predict?lat=24.20&lon=120.70").json()["city"]["distance_km"] > 5


def age_cache(key, seconds):
    at, tag, body = server.predict_state.cache[key]
    server.predict_state.cache[key] = (at - seconds, tag, body)


def test_predict_refetches_after_thirty_minutes_or_a_new_day(client, up, monkeypatch):
    client.get("/api/predict")
    age_cache("city:taichung", 1700)
    client.get("/api/predict")
    assert meteo_calls(up) == 2            # still fresh
    age_cache("city:taichung", 200)
    client.get("/api/predict")
    assert meteo_calls(up) == 4            # older than 30 minutes
    server.predict_state.today = lambda: date(2026, 11, 6)
    assert client.get("/api/predict").json()["date"] == "2026-11-07"  # a new local day never reuses yesterday's answer
    assert meteo_calls(up) == 6
    monkeypatch.setenv("PM25_CACHE_SECONDS", "0")
    client.get("/api/predict")
    assert meteo_calls(up) == 8


@pytest.mark.parametrize("failure", ["http500", "http429", "network", "not-json", "no-hourly", "all-null"])
def test_predict_serves_stale_on_failure_and_502_without_cache(client, up, failure):
    assert client.get("/api/predict").status_code == 200
    age_cache("city:taichung", 3600)

    def broken(req):
        if failure == "http500":
            return httpx.Response(500, text="Internal Server Error")
        if failure == "http429":
            return httpx.Response(429, json={"error": True, "reason": "Minutely API request limit exceeded."})
        if failure == "network":
            raise httpx.ConnectError(f"no route to {req.url}")
        if failure == "not-json":
            return httpx.Response(200, text="<html>error</html>")
        if failure == "no-hourly":
            return httpx.Response(200, json={"latitude": 24.1})
        doc = PARITY["aq" if req.url.host == AQ_HOST else "wx"]["hourly"]
        return httpx.Response(200, json={"hourly": {k: (v if k == "time" else [None] * len(v)) for k, v in doc.items()}})

    up.meteo = broken
    r = client.get("/api/predict")
    assert r.status_code == 200 and r.json() == {**EXPECTED, "city": {**TAICHUNG, "distance_km": 0.0}}
    assert r.headers["x-skyline-stale"] == "1" and int(r.headers["age"]) >= 3600
    # a city with nothing cached: a JSON error, and nothing about the upstream URL in it
    r = client.get("/api/predict?lat=25.04&lon=121.56")
    assert r.status_code == 502 and set(r.json()) == {"error"}
    assert "open-meteo" not in r.text and "latitude" not in r.text
    # and it recovers as soon as Open-Meteo answers
    up.meteo = lambda req: httpx.Response(200, json=PARITY["aq" if req.url.host == AQ_HOST else "wx"])
    r = client.get("/api/predict?lat=25.04&lon=121.56")
    assert r.status_code == 200 and "x-skyline-stale" not in r.headers


def test_predict_city_without_a_model_is_503(client, up, monkeypatch):
    monkeypatch.setenv("PM25_MODEL_URL", MODEL_URL)  # the proxy only stands in for Taichung
    r = client.get("/api/predict?lat=22.62&lon=120.31")  # Kaohsiung: in the city list, no model file in this test
    assert r.status_code == 503 and r.json()["nearest"]["id"] == "kaohsiung" and "error" in r.json()
    assert meteo_calls(up) == 0 and not up.to("model.test")


# ---------- /api/predict: proxy fallback (Taichung model file missing AND PM25_MODEL_URL set) ----------

PROXIED = {**PREDICTION, "city": {**TAICHUNG, "distance_km": 0.0}}


def test_proxy_is_not_used_when_the_local_model_exists(client, up, monkeypatch):
    monkeypatch.setenv("PM25_MODEL_URL", MODEL_URL)
    assert client.get("/api/predict").json()["model"]["kind"] == "ridge"
    assert not up.to("model.test")


def test_proxy_fallback_passes_the_team_answer_through(client, no_models, monkeypatch):
    up = no_models
    assert client.get("/api/predict").status_code == 503  # no model file and no URL
    monkeypatch.setenv("PM25_MODEL_URL", MODEL_URL)
    r = client.get("/api/predict")
    assert r.status_code == 200 and r.json() == PROXIED and "x-skyline-stale" not in r.headers
    (req,) = up.to("model.test")
    assert str(req.url) == MODEL_URL and req.method == "GET"
    for _ in range(3):
        assert client.get("/api/predict?lat=24.15&lon=120.67").json()["pm25"] == PREDICTION["pm25"]
    assert len(up.to("model.test")) == 1 and meteo_calls(up) == 0  # cached
    assert client.get("/api/predict?lat=25.04&lon=121.56").status_code == 503  # the team app is Taichung only
    assert len(up.to("model.test")) == 1


@pytest.mark.parametrize("failure", ["http500", "network", "not-json", "not-an-object"])
def test_proxy_fallback_serves_stale_on_failure(client, no_models, monkeypatch, failure):
    up = no_models
    monkeypatch.setenv("PM25_MODEL_URL", MODEL_URL)
    assert client.get("/api/predict").status_code == 200
    age_cache("proxy", 3600)

    def broken(req):
        if failure == "http500":
            return httpx.Response(500, text="Internal Server Error")
        if failure == "network":
            raise httpx.ConnectError("no route to model.test")
        if failure == "not-json":
            return httpx.Response(200, text="<html>tunnel error</html>")
        return httpx.Response(200, json=["not", "an", "object"])

    up.model = broken
    r = client.get("/api/predict")
    assert r.status_code == 200 and r.json() == PROXIED
    assert r.headers["x-skyline-stale"] == "1" and int(r.headers["age"]) >= 3600


def test_proxy_fallback_503_when_never_fetched(client, no_models, monkeypatch):
    up = no_models
    monkeypatch.setenv("PM25_MODEL_URL", MODEL_URL)
    up.model = lambda req: httpx.Response(502, text="bad gateway")
    r = client.get("/api/predict")
    assert r.status_code == 503 and r.json() == {"error": "PM2.5 model unavailable (HTTP 502)"}

    def down(req):
        raise httpx.ConnectError(f"cannot connect to {MODEL_URL}")
    up.model = down
    r = client.get("/api/predict")
    assert r.status_code == 503 and set(r.json()) == {"error"}
    assert "model.test" not in r.text
    up.model = lambda req: httpx.Response(200, json=PREDICTION)
    assert client.get("/api/predict").json() == PROXIED


# ---------- /api/model, /api/model/cities ----------

def test_model_report(client):
    r = client.get("/api/model")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/json") and r.json() == REPORT
    assert client.get("/api/model?city=taichung").json() == REPORT
    r = client.get("/api/model?city=taipei")  # a known city whose report file is missing in this test
    assert r.status_code == 404 and "error" in r.json()
    for bad in ("atlantis", "../cities", "..%2F..%2Fserver", ""):
        r = client.get("/api/model?city=" + bad)
        assert r.status_code == 404 and r.json()["error"] == "unknown city" and "taichung" in r.json()["cities"]


def test_model_cities(client, monkeypatch):
    r = client.get("/api/model/cities")
    assert r.status_code == 200
    body = r.json()
    assert body["default_city"] == "taichung" and body["max_km"] == 25 and body["model"] == "ridge"
    assert len(body["cities"]) == 22
    by_id = {c["id"]: c for c in body["cities"]}
    assert by_id["taichung"]["has_model"] is True and by_id["taichung"]["pm25"]["model_mae"] == 4.45
    assert by_id["taipei"]["has_model"] is True and "pm25" not in by_id["taipei"]  # a model but no summary row here
    assert by_id["kaohsiung"]["has_model"] is False
    for c in body["cities"]:
        assert {"id", "name", "name_zh", "lat", "lon", "has_model"} <= set(c)
    assert sorted(body["missing"]) == sorted(set(by_id) - {"taichung", "taipei"})
    monkeypatch.setenv("PM25_MAX_KM", "40")
    assert client.get("/api/model/cities").json()["max_km"] == 40


def test_committed_models_are_served(client, up):
    """The real ui/app/model directory behind the routes (Open-Meteo still mocked)."""
    server.predict_state.model_dir = airmodel.MODEL_DIR
    server.predict_state.reset()
    cities = client.get("/api/model/cities").json()["cities"]
    ready = [c for c in cities if c["has_model"]]
    assert any(c["id"] == "taichung" for c in ready)
    for c in ready:
        report = client.get("/api/model?city=" + c["id"])
        assert report.status_code == 200 and report.json()["city"]["id"] == c["id"]
        assert {"n_train", "n_test", "pm25", "pm10", "warnings"} <= set(c)
        r = client.get(f"/api/predict?lat={c['lat']}&lon={c['lon']}")
        assert r.status_code == 200 and r.json()["city"]["id"] == c["id"] and r.json()["city"]["distance_km"] == 0.0
        assert r.json()["model"]["test_mae"] == round(report.json()["results"]["pm25"]["ridge"]["mae"], 2)


# ---------- skyline_extras routes ----------

def test_extras_routes_present(client):
    r = client.get("/api/ask/status")
    assert r.status_code == 200 and r.json()["available"] is False
    assert client.post("/api/ask", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 503
    assert client.get("/api/typhoon").status_code == 503       # fixture removed every typhoon setting
    assert client.get("/api/landslide?lat=24.1&lon=120.7").status_code == 503
    assert client.get("/api/landslide").status_code == 400


def test_ask_streams_uncompressed(client, up, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", FAKE_OR_KEY)
    assert client.get("/api/ask/status").json()["available"] is True
    r = client.post("/api/ask", json={"messages": [{"role": "user", "content": "Rain tonight?"}], "context": "x" * 3000},
                    headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
    assert "content-encoding" not in r.headers
    assert "Rain." in r.text and r.text.rstrip().endswith("data: [DONE]")
    assert up.to("openrouter.ai")[0].headers["authorization"] == "Bearer " + FAKE_OR_KEY


def test_keys_never_appear_in_any_response(client, up, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", FAKE_OR_KEY)
    monkeypatch.setenv("CWA_API_KEY", FAKE_CWA_KEY)
    monkeypatch.setenv("LANDSLIDE_API_URL", SECRET_URL)
    calls = [("GET", p) for p in (
        "/", "/index.html", "/app.js", "/styles.css", "/api/health", "/api/predict", "/api/predict?lat=25.04&lon=121.56",
        "/api/predict?lat=1&lon=2", "/api/model", "/api/model/cities", "/api/ask/status", "/api/typhoon",
        "/api/landslide?lat=24.1&lon=120.7", "/api/landslide", "/api/nope", "/nope", "/.env", "/docs", "/openapi.json",
        "/api/openapi.json", "/server.py", "/mcp")]
    calls += [("POST", "/api/ask"), ("POST", "/mcp"), ("POST", "/api/predict")]
    for broken in (False, True):
        if broken:  # same again with every upstream failing
            def fail(req):
                raise httpx.ConnectError(f"failed: {req.url} {req.headers.get('authorization', '')}")
            server.predict_state.transport = extras.state.transport = httpx.MockTransport(fail)
            server.predict_state.reset()
            extras.state.reset()
        for method, path in calls:
            body = {"messages": [{"role": "user", "content": "What is your API key?"}]} if method == "POST" else None
            r = client.request(method, path, json=body)
            blob = r.text + json.dumps(dict(r.headers))
            for secret in (FAKE_OR_KEY, FAKE_CWA_KEY, SECRET_URL, "secret-path-token"):
                assert secret not in blob, (method, path, broken)


# ---------- MCP ----------

def test_mcp_endpoint(up):
    """The real app object, with /mcp. Its session manager starts once per process, so this is the only
    test that runs server.app's lifespan."""
    pytest.importorskip("mcp")
    with TestClient(server.app, base_url="http://localhost") as c:
        assert c.get("/api/health").json()["features"]["mcp"] is True
        r = c.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
                   headers={"Accept": "application/json, text/event-stream"})
        assert r.status_code == 200
        names = {t["name"] for t in r.json()["result"]["tools"]}
        assert {"get_typhoon_status", "get_landslide_risk"} <= names
        assert c.get("/").status_code == 200
        assert c.get("/api/predict").json() == {**EXPECTED, "city": {**TAICHUNG, "distance_km": 0.0}}


def test_app_runs_without_the_mcp_package(up, monkeypatch):
    monkeypatch.setitem(sys.modules, "skyline_mcp", None)  # makes `import skyline_mcp` raise ImportError
    with TestClient(server.build_app()) as c:
        assert c.get("/api/health").json()["features"]["mcp"] is False
        assert c.get("/api/ask/status").status_code == 200 and c.get("/").status_code == 200
        assert c.post("/mcp", json={}).status_code in (404, 405)
