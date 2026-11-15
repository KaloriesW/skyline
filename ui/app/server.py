"""Skyline app server: the whole app as one process.

  GET  /                        the web UI (web/index.html) and its assets (web/app.js, web/styles.css, ...)
  GET  /api/health              what is switched on: {ok, version, features: {ask, typhoon, landslide, pm25, mcp}}
  GET  /api/predict             the team PM2.5 model, proxied from PM25_MODEL_URL (10-minute cache, stale on failure)
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
PM25_MODEL_DEFAULT_URL = "https://veritas.premiersalesri.com/api/predict"

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

for _p in (HERE.parent / "mcp", HERE.parent / "server"):  # use the modules in place, no copies
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import httpx  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from starlette.middleware.gzip import GZipMiddleware  # noqa: E402
from starlette.staticfiles import StaticFiles  # noqa: E402

import skyline_extras as extras  # noqa: E402
import skyline_sources as sources  # noqa: E402


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


# ---------- /api/predict: proxy to the team PM2.5 model ----------

def pm25_url() -> str:
    """Where the team model answers. `PM25_MODEL_URL=` (set but empty) switches the proxy off."""
    return os.environ.get("PM25_MODEL_URL", PM25_MODEL_DEFAULT_URL).strip()


def _pm25_ttl() -> float:
    try:
        return max(0.0, float(_env("PM25_CACHE_SECONDS") or 600))
    except ValueError:
        return 600.0


class Predict:
    """Last good answer from the model, plus the client used to fetch it."""

    def __init__(self) -> None:
        self.transport: Optional[httpx.AsyncBaseTransport] = None  # tests put an httpx.MockTransport here
        self.reset()

    def reset(self) -> None:
        self.cache: Optional[Tuple[float, str, Any]] = None  # (fetched at, url, body)
        self.client: Optional[httpx.AsyncClient] = None
        self.lock: Optional[asyncio.Lock] = None

    def http(self) -> httpx.AsyncClient:
        if self.client is None:
            self.client = httpx.AsyncClient(
                transport=self.transport, timeout=httpx.Timeout(20.0, connect=8.0),
                follow_redirects=True, headers={"User-Agent": "skyline-app/" + VERSION, "Accept": "application/json"},
            )
        return self.client


predict_state = Predict()


async def predict() -> JSONResponse:
    url = pm25_url()
    if not url:
        return JSONResponse({"error": "PM2.5 model not configured"}, status_code=503)
    st = predict_state
    ttl = _pm25_ttl()

    def fresh() -> Optional[Any]:
        hit = st.cache
        return hit[2] if hit and hit[1] == url and time.time() - hit[0] < ttl else None

    body = fresh()
    if body is not None:
        return JSONResponse(body)
    if st.lock is None:
        st.lock = asyncio.Lock()
    async with st.lock:  # one upstream call at a time; the others reuse its answer
        body = fresh()
        if body is not None:
            return JSONResponse(body)
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
            hit = st.cache
            if hit and hit[1] == url:  # serve the last good answer, unchanged; the header says it is old
                return JSONResponse(hit[2], headers={"X-Skyline-Stale": "1", "Age": str(int(time.time() - hit[0]))})
            return JSONResponse({"error": f"PM2.5 model unavailable ({reason})"}, status_code=503)
        st.cache = (time.time(), url, body)
        return JSONResponse(body)


# ---------- static files ----------

class WebFiles(StaticFiles):
    """web/ at the site root. Everything revalidates on each load (ETag/304), so a deploy shows up at once."""

    async def get_response(self, path: str, scope: Any):
        if any(part.startswith(".") for part in path.replace("\\", "/").split("/")):
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
        return JSONResponse({
            "ok": True,
            "version": VERSION,
            "features": {
                "ask": bool(_env("OPENROUTER_API_KEY")),
                "typhoon": sources.typhoon_request() is not None,
                "landslide": bool(sources.landslide_url()),
                "pm25": bool(pm25_url()),
                "mcp": mcp_mounted,
            },
        }, headers={"Cache-Control": "no-store"})

    app.add_api_route("/api/predict", predict, methods=["GET"])

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    async def api_not_found(rest: str) -> JSONResponse:  # JSON, not the static handler's text page
        return JSONResponse({"error": "not found"}, status_code=404)

    app.mount("/", WebFiles(directory=str(WEB), html=True, check_dir=False), name="web")
    return app


app = build_app()
