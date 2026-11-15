"""Tests for the Skyline app server. No network and no real keys: every upstream is an httpx.MockTransport.

    python -m pytest -p no:cacheprovider test_server.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import server  # noqa: E402
from server import extras  # noqa: E402

FAKE_OR_KEY = "sk-or-test-not-a-real-key"
FAKE_CWA_KEY = "CWA-TEST-not-a-real-key"
SECRET_URL = "https://landslide.test/secret-path-token"
MODEL_URL = "https://model.test/api/predict"
PREDICTION = {  # the shape skyline/backend/server.py returns on the `app` branch
    "date": "2026-11-16", "pm25": 18.4, "pm25_range": [9.1, 27.7], "pm10": 33.0, "pm10_range": [18.2, 47.9],
    "aqi": 64, "category": "Moderate", "color": "#ffff00", "bad_day": False, "advice": "Fine for outdoor class.",
    "today": {"pm25": 16.0, "pm10": 30.1, "aqi": 59, "category": "Moderate"},
    "baseline": {"pm25": 16.0, "pm10": 30.1},
    "tomorrow_weather": {"rain_mm": 0.4, "wind_kmh": 11.2},
    "model": {"kind": "gbr", "test_mae": 5.12, "baseline_mae": 6.3},
}
ENV = [
    "OPENROUTER_API_KEY", "ASK_MODEL", "ASK_BUDGET_USD", "ASK_RESERVE_USD", "ASK_SPEND_FILE", "CWA_API_KEY",
    "CWA_TYPHOON_URL", "TYPHOON_CACHE_SECONDS", "TYPHOON_STALE_HOURS", "LANDSLIDE_API_URL", "PM25_MODEL_URL",
    "PM25_CACHE_SECONDS", "MCP_ALLOWED_HOSTS", "MCP_ALLOWED_ORIGINS",
]
TYPHOON_DOC = json.loads((HERE.parent / "server" / "fixtures" / "cwa_W-C0034-005.json").read_text(encoding="utf-8"))


class Upstream:
    def __init__(self):
        self.requests = []
        self.model = lambda req: httpx.Response(200, json=PREDICTION)

    def __call__(self, req: httpx.Request) -> httpx.Response:
        self.requests.append(req)
        if req.url.host == "model.test":
            return self.model(req)
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
    monkeypatch.setenv("PM25_MODEL_URL", MODEL_URL)
    upstream = Upstream()
    transport = httpx.MockTransport(upstream)
    server.predict_state.transport = extras.state.transport = transport
    server.predict_state.reset()
    extras.state.reset()
    yield upstream
    server.predict_state.transport = extras.state.transport = None
    server.predict_state.reset()
    extras.state.reset()


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

def test_health_with_nothing_configured(client, monkeypatch):
    monkeypatch.delenv("PM25_MODEL_URL")
    r = client.get("/api/health")
    assert r.status_code == 200
    # typhoon is off here only because the fixture removed the default server.py set at import
    assert r.json() == {"ok": True, "version": server.VERSION,
                        "features": {"ask": False, "typhoon": False, "landslide": False, "pm25": True, "mcp": False}}


def test_health_with_everything_configured(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", FAKE_OR_KEY)
    monkeypatch.setenv("CWA_API_KEY", FAKE_CWA_KEY)
    monkeypatch.setenv("LANDSLIDE_API_URL", SECRET_URL)
    r = client.get("/api/health")
    assert r.json()["features"] == {"ask": True, "typhoon": True, "landslide": True, "pm25": True, "mcp": False}
    for secret in (FAKE_OR_KEY, FAKE_CWA_KEY, SECRET_URL, MODEL_URL, "model.test"):
        assert secret not in r.text


def test_health_pm25_can_be_switched_off(client, monkeypatch):
    monkeypatch.setenv("PM25_MODEL_URL", "")
    assert client.get("/api/health").json()["features"]["pm25"] is False
    r = client.get("/api/predict")
    assert r.status_code == 503 and "error" in r.json()


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


# ---------- /api/predict ----------

def test_predict_passes_the_model_answer_through(client, up):
    r = client.get("/api/predict")
    assert r.status_code == 200 and r.json() == PREDICTION
    assert "x-skyline-stale" not in r.headers
    (req,) = up.to("model.test")
    assert str(req.url) == MODEL_URL and req.method == "GET"


def test_predict_is_cached(client, up):
    for _ in range(3):
        assert client.get("/api/predict").json() == PREDICTION
    assert len(up.to("model.test")) == 1


def test_predict_refetches_after_the_cache_expires(client, up, monkeypatch):
    client.get("/api/predict")
    at, url, body = server.predict_state.cache
    server.predict_state.cache = (at - 601, url, body)  # ten minutes and a second ago
    up.model = lambda req: httpx.Response(200, json={**PREDICTION, "pm25": 99.0})
    assert client.get("/api/predict").json()["pm25"] == 99.0
    assert len(up.to("model.test")) == 2


@pytest.mark.parametrize("failure", ["http500", "network", "not-json", "not-an-object"])
def test_predict_serves_stale_on_failure(client, up, failure):
    assert client.get("/api/predict").status_code == 200
    at, url, body = server.predict_state.cache
    server.predict_state.cache = (at - 3600, url, body)

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
    assert r.status_code == 200 and r.json() == PREDICTION  # unchanged body
    assert r.headers["x-skyline-stale"] == "1" and int(r.headers["age"]) >= 3600


def test_predict_503_when_never_fetched(client, up):
    up.model = lambda req: httpx.Response(502, text="bad gateway")
    r = client.get("/api/predict")
    assert r.status_code == 503 and r.json() == {"error": "PM2.5 model unavailable (HTTP 502)"}

    def down(req):
        raise httpx.ConnectError(f"cannot connect to {MODEL_URL}")
    up.model = down
    r = client.get("/api/predict")
    assert r.status_code == 503 and set(r.json()) == {"error"}
    assert "model.test" not in r.text
    # and it recovers as soon as the model answers
    up.model = lambda req: httpx.Response(200, json=PREDICTION)
    assert client.get("/api/predict").json() == PREDICTION


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
        "/", "/index.html", "/app.js", "/styles.css", "/api/health", "/api/predict", "/api/ask/status", "/api/typhoon",
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
        assert c.get("/").status_code == 200 and c.get("/api/predict").json() == PREDICTION


def test_app_runs_without_the_mcp_package(up, monkeypatch):
    monkeypatch.setitem(sys.modules, "skyline_mcp", None)  # makes `import skyline_mcp` raise ImportError
    with TestClient(server.build_app()) as c:
        assert c.get("/api/health").json()["features"]["mcp"] is False
        assert c.get("/api/ask/status").status_code == 200 and c.get("/").status_code == 200
        assert c.post("/mcp", json={}).status_code in (404, 405)
