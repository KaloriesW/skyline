"""Skyline app server: the whole app as one process.

  GET  /                        the web UI (web/index.html) and its assets (web/app.js, web/styles.css, ...)
  GET  /api/health              what is switched on: {ok, version, features: {ask, typhoon, landslide, pm25, pm25_cities, mcp}}
  GET  /api/predict?lat=&lon=   next-day PM2.5 / PM10 from the nearest city's model (model/predict.py: ridge and
                                boosted trees as plain numbers; 30-minute cache per city, stale on failure).
                                No lat/lon: Taichung.
  GET  /api/model?city=<id>     that city's test-year report; GET /api/model/cities lists every city and its scores
  GET  /api/ask/status, POST /api/ask, GET /api/typhoon, GET /api/landslide     from ui/server/skyline_extras.py
  POST /mcp                     the Skyline MCP server (ui/mcp/skyline_mcp.py), when the `mcp` package is installed

Run:  ./run.sh        (or: uvicorn server:app --app-dir ui/app --port 8765)

Settings are environment variables; a `.env` file next to this file is loaded first (real environment
variables win). See .env.example and README.md. Keep it to one uvicorn worker: the Ask AI spend total,
the rate limits and the caches live in this one process.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, MutableMapping, Optional, Tuple

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
VERSION = "0.1.0"

# Typhoon file in CWA's public AWS Open Data bucket: same content as the member API, no key needed.
CWA_TYPHOON_PUBLIC_URL = "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Warning/W-C0034-005.json"

log = logging.getLogger("skyline.app")


# ---------- .env and defaults (must run before skyline_extras / skyline_mcp are set up) ----------

def parse_env(text: str) -> Dict[str, str]:
    """Tiny .env parser: KEY=VALUE lines, `#` comments, optional `export `, single or double quotes.

    Unquoted values lose a trailing ` # comment`; quoted values are taken literally (no escapes).
    """
    out: Dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, sep, value = line.partition("=")
        key = key.strip()
        if not sep or not key or not all(c.isalnum() or c == "_" for c in key) or key[0].isdigit():
            continue
        value = value.strip()
        if value[:1] in ("'", '"'):
            end = value.find(value[0], 1)
            value = value[1:end] if end != -1 else value[1:]
        else:
            for i, c in enumerate(value):
                if c == "#" and (i == 0 or value[i - 1].isspace()):
                    value = value[:i].rstrip()
                    break
        out[key] = value
    return out


def load_env_file(path: Path, environ: Optional[MutableMapping[str, str]] = None) -> int:
    """Copy settings from `path` into the environment without replacing anything already set there."""
    environ = os.environ if environ is None else environ
    try:
        values = parse_env(path.read_text(encoding="utf-8"))
    except OSError:
        return 0
    added = 0
    for key, value in values.items():
        if key not in environ:
            environ[key] = value
            added += 1
    return added


def apply_defaults(environ: Optional[MutableMapping[str, str]] = None) -> None:
    """Defaults this app wants on top of skyline_extras' own.

    - Typhoon works with no key: when neither CWA_API_KEY nor CWA_TYPHOON_URL is set, point
      CWA_TYPHOON_URL at CWA's public mirror. skyline_sources reads that variable on each request and
      prefers it over the key, so it is only filled in when there is no key. `CWA_TYPHOON_URL=`
      (set but empty) switches the typhoon feed off.
    - The Ask AI spend file goes next to this file (ignored by .gitignore), not into ui/server.
    """
    environ = os.environ if environ is None else environ
    if not environ.get("CWA_API_KEY", "").strip() and "CWA_TYPHOON_URL" not in environ:
        environ["CWA_TYPHOON_URL"] = CWA_TYPHOON_PUBLIC_URL
    if not environ.get("ASK_SPEND_FILE", "").strip():
        environ["ASK_SPEND_FILE"] = str(HERE / "ask_spend.json")


load_env_file(HERE / ".env")
apply_defaults()

for _p in (HERE.parent / "mcp", HERE.parent / "server", HERE):  # use the modules in place, no copies
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import httpx  # noqa: E402
from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import JSONResponse, Response  # noqa: E402
from starlette.middleware.gzip import GZipMiddleware  # noqa: E402
from starlette.staticfiles import StaticFiles  # noqa: E402

import skyline_extras as extras  # noqa: E402
import skyline_sources as sources  # noqa: E402
from model import predict as airmodel  # noqa: E402


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


# ---------- /api/predict, /api/model: one next-day PM2.5 / PM10 model per city (model/predict.py) ----------

def pm25_url() -> str:
    """The team app's /api/predict (Taichung only). Used only when our own Taichung model file is missing."""
    return _env("PM25_MODEL_URL")


def _pm25_ttl() -> float:
    try:
        return max(0.0, float(_env("PM25_CACHE_SECONDS") or 1800))
    except ValueError:
        return 1800.0


def _pm25_max_km() -> float:
    try:
        km = float(_env("PM25_MAX_KM") or airmodel.MAX_DISTANCE_KM)
        return km if km > 0 else airmodel.MAX_DISTANCE_KM
    except ValueError:
        return airmodel.MAX_DISTANCE_KM


class Predict:
    """The city models, the last good answer per city, and the client used to fetch live inputs."""

    def __init__(self) -> None:
        self.transport: Optional[httpx.AsyncBaseTransport] = None  # tests put an httpx.MockTransport here
        self.model_dir: Path = airmodel.MODEL_DIR                   # tests point this at a temporary directory
        self.today = airmodel.today_taipei                          # tests pin the date
        self.reset()

    def reset(self) -> None:
        self.cache: Dict[str, Tuple[float, str, Any]] = {}  # key -> (fetched at, local date or proxy url, body)
        self.upwind_cache: Optional[Tuple[float, str, Any]] = None  # (fetched at, local date, daily upwind PM2.5)
        self.client: Optional[httpx.AsyncClient] = None
        self.locks: Dict[str, asyncio.Lock] = {}
        self._models: Optional[airmodel.Models] = None

    @property
    def models(self) -> airmodel.Models:
        if self._models is None or self._models.dir != self.model_dir:
            self._models = airmodel.Models(self.model_dir)
        return self._models

    def lock(self, key: str) -> asyncio.Lock:
        if key not in self.locks:
            self.locks[key] = asyncio.Lock()
        return self.locks[key]

    async def upwind(self, today: str) -> Any:
        """Daily PM2.5 at the four upwind points: one request, shared by every city for ten minutes."""
        def fresh() -> Optional[Any]:
            hit = self.upwind_cache
            ok = hit and hit[1] == today and time.time() - hit[0] < airmodel.UPWIND_CACHE_SECONDS
            return hit[2] if ok else None

        data = fresh()
        if data is None:
            async with self.lock("upwind"):
                data = fresh()
                if data is None:
                    data = await airmodel.fetch_upwind(self.http())
                    self.upwind_cache = (time.time(), today, data)
        return data

    def http(self) -> httpx.AsyncClient:
        if self.client is None:
            self.client = httpx.AsyncClient(
                transport=self.transport, timeout=httpx.Timeout(20.0, connect=8.0),
                limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
                follow_redirects=True, headers={"User-Agent": "skyline-app/" + VERSION, "Accept": "application/json"},
            )
        return self.client


predict_state = Predict()


def _coordinate(raw: Optional[str], limit: float) -> Optional[float]:
    try:
        v = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return v if abs(v) <= limit else None  # also rejects nan and inf


async def _cached(key: str, tag: str, ttl: float, produce: Any, extra: Dict[str, Any]) -> JSONResponse:
    """Answer from cache[key] while it is fresh and carries the same tag; otherwise call produce() (one
    caller at a time per key). produce() returns the body, or a JSONResponse when it failed: then the last
    good answer is served with a stale header, or that error when there has never been one. `extra` is
    added to a good answer on the way out (it is not cached)."""
    st = predict_state

    def fresh() -> Optional[Any]:
        hit = st.cache.get(key)
        return hit[2] if hit and hit[1] == tag and time.time() - hit[0] < ttl else None

    body = fresh()
    if body is None:
        async with st.lock(key):  # one upstream round at a time per city; the others reuse its answer
            body = fresh()
            if body is None:
                result = await produce()
                if isinstance(result, JSONResponse):  # failed
                    hit = st.cache.get(key)
                    if not hit:
                        return result
                    return JSONResponse({**hit[2], **extra},  # the last good answer; the headers say it is old
                                        headers={"X-Skyline-Stale": "1", "Age": str(int(time.time() - hit[0]))})
                st.cache[key] = (time.time(), tag, result)
                body = result
    return JSONResponse({**body, **extra})


async def _predict_local(city: dict, city_block: dict, model: dict) -> JSONResponse:
    st = predict_state
    today = st.today()

    async def produce() -> Any:
        try:
            up = await st.upwind(today.isoformat()) if airmodel.needs_upwind(model) else None
            aq, wx = await airmodel.fetch_inputs(st.http(), city["lat"], city["lon"])
            body = airmodel.predict(model, aq, wx, up, today)
        except airmodel.UpstreamError as e:
            log.warning("PM2.5 inputs for %s failed: %s", city["id"], e)
            return JSONResponse({"error": f"Weather source unavailable ({e})"}, status_code=502)
        except airmodel.InputError as e:
            log.warning("PM2.5 inputs for %s unusable: %s", city["id"], e)
            return JSONResponse({"error": f"Weather source returned incomplete data ({e})"}, status_code=502)
        return body

    # The cached body has no `city` block: the distance depends on who asks. A new local day ends the cache.
    return await _cached("city:" + city["id"], today.isoformat(), _pm25_ttl(), produce, {"city": city_block})


async def _predict_proxy(url: str, city_block: dict) -> JSONResponse:
    """Fallback for Taichung when our own model file is missing: the team app's answer, plus the `city` block."""
    st = predict_state

    async def produce() -> Any:
        try:
            r = await st.http().get(url)
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")
            body = r.json()
            if not isinstance(body, dict):
                raise RuntimeError("unexpected answer")
        except Exception as e:  # don't echo exception text: it can contain the upstream URL
            reason = str(e) if isinstance(e, RuntimeError) else e.__class__.__name__
            log.warning("PM2.5 model fetch failed: %s", reason)
            return JSONResponse({"error": f"PM2.5 model unavailable ({reason})"}, status_code=503)
        return body

    return await _cached("proxy", url, _pm25_ttl(), produce, {"city": city_block})


async def predict(request: Request) -> JSONResponse:
    models = predict_state.models
    q = request.query_params
    if "lat" in q or "lon" in q:
        lat, lon = _coordinate(q.get("lat"), 90.0), _coordinate(q.get("lon"), 180.0)
        if lat is None or lon is None:
            return JSONResponse({"error": "lat and lon must both be numbers (lat -90..90, lon -180..180)"}, status_code=400)
        city, km = models.nearest(lat, lon)
        block = models.city_block(city, km)
        max_km = _pm25_max_km()
        if km > max_km:
            return JSONResponse({"error": f"No city model within {max_km:g} km of this point", "nearest": block,
                                 "max_km": max_km}, status_code=404)
    else:  # backward compatible: no coordinates means Taichung
        city = models.by_id.get(airmodel.DEFAULT_CITY) or models.cities[0]
        block = models.city_block(city, 0.0)
    model = models.model(city["id"])
    if model is not None:
        return await _predict_local(city, block, model)
    url = pm25_url()
    if url and city["id"] == airmodel.DEFAULT_CITY:  # the team app only knows Taichung
        return await _predict_proxy(url, block)
    return JSONResponse({"error": f"No PM2.5 model for {city['name']} yet", "nearest": block}, status_code=503)


async def model_report(city: str = airmodel.DEFAULT_CITY) -> Response:
    models = predict_state.models
    if city not in models.by_id:
        return JSONResponse({"error": "unknown city", "cities": [c["id"] for c in models.cities]}, status_code=404)
    raw = models.metrics_json(city)
    if raw is None:
        return JSONResponse({"error": f"No model report for {models.by_id[city]['name']} yet"}, status_code=404)
    return Response(raw, media_type="application/json")


async def model_cities() -> JSONResponse:
    return JSONResponse({**predict_state.models.summary(), "max_km": _pm25_max_km()})


# ---------- static files ----------

class WebFiles(StaticFiles):
    """web/ at the site root. Everything revalidates on each load (ETag/304), so a deploy shows up at once."""

    async def get_response(self, path: str, scope: Any):
        if any(part.startswith(".") and part != "." for part in path.replace("\\", "/").split("/")):
            return JSONResponse({"error": "not found"}, status_code=404)  # no dotfiles
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


class SecurityHeaders:
    """Adds two safe headers to every response. No Content-Security-Policy: the page loads fonts,
    Leaflet, the Anthropic SDK, map tiles and Windy from other hosts and calls user-chosen AI endpoints."""

    HEADERS = (
        (b"x-content-type-options", b"nosniff"),
        (b"referrer-policy", b"strict-origin-when-cross-origin"),
    )

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_with_headers(message: Any) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers") or [])
                present = {k.lower() for k, _ in headers}
                headers.extend(h for h in self.HEADERS if h[0] not in present)
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


# ---------- the app ----------

def build_app(with_mcp: bool = True) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        for holder in (predict_state, extras.state):
            client, holder.client = holder.client, None
            if client is not None:
                try:
                    await client.aclose()
                except Exception:
                    pass

    app = FastAPI(title="Skyline", version=VERSION, lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(GZipMiddleware, minimum_size=1024)  # leaves text/event-stream (/api/ask) alone
    app.add_middleware(SecurityHeaders)

    routes_before = len(app.router.routes)
    extras.install(app, "/mcp" if with_mcp else None)  # logs a warning and carries on if `mcp` is missing
    mcp_mounted = any(getattr(r, "path", None) == "/mcp" for r in app.router.routes[routes_before:])

    @app.get("/api/health")
    async def health() -> JSONResponse:
        pm25_cities = len(predict_state.models.available())  # cities with a usable local model file
        return JSONResponse({
            "ok": True,
            "version": VERSION,
            "features": {
                "ask": bool(_env("OPENROUTER_API_KEY")),
                "typhoon": sources.typhoon_request() is not None,
                "landslide": bool(sources.landslide_url()),
                "pm25": pm25_cities > 0 or bool(pm25_url()),
                "pm25_cities": pm25_cities,
                "mcp": mcp_mounted,
            },
        }, headers={"Cache-Control": "no-store"})

    app.add_api_route("/api/predict", predict, methods=["GET"])
    app.add_api_route("/api/model/cities", model_cities, methods=["GET"])
    app.add_api_route("/api/model", model_report, methods=["GET"])

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    async def api_not_found(rest: str) -> JSONResponse:  # JSON, not the static handler's text page
        return JSONResponse({"error": "not found"}, status_code=404)

    app.mount("/", WebFiles(directory=str(WEB), html=True, check_dir=False), name="web")
    return app


app = build_app()
