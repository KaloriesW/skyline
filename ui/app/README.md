# Skyline app

The Skyline UI and everything it calls, as one process: `server.py` serves the page from `web/` and answers the `/api` routes and `/mcp` on the same origin.

| Route | What it does | Needs |
|---|---|---|
| `GET /` and `/app.js`, `/styles.css`, … | The web UI, straight from `web/` | — |
| `GET /api/health` | `{ok, version, features: {ask, typhoon, landslide, pm25, mcp}}` | — |
| `GET /api/predict` | Team PM2.5 model, proxied from `PM25_MODEL_URL` | the team app reachable |
| `GET /api/typhoon` | Active tropical cyclones from CWA | — (public mirror by default) |
| `GET /api/ask/status`, `POST /api/ask` | Built-in Ask AI through OpenRouter, with a spend cap | `OPENROUTER_API_KEY` |
| `GET /api/landslide?lat=&lon=` | Pass-through to the landslide model | `LANDSLIDE_API_URL` |
| `POST /mcp` | Skyline MCP server over streamable HTTP | `mcp` package |

The Ask AI, typhoon, landslide and MCP code is not copied here: `server.py` imports `ui/server/skyline_extras.py` and `ui/mcp/skyline_mcp.py` in place. Their details (limits, error codes, data mapping) are in [../server/README.md](../server/README.md).

## Run it locally

```bash
ui/app/run.sh
```

Open http://127.0.0.1:8765. The first run creates `ui/app/.venv` and installs `requirements.txt`; later runs reinstall only when that file changes. Python 3.10 or newer.

```bash
PORT=9000 ui/app/run.sh               # another port
HOST=0.0.0.0 ui/app/run.sh            # listen on every interface, not just this machine
SKYLINE_VENV=/path/to/venv ui/app/run.sh   # use a virtualenv somewhere else
```

Without `run.sh`, from a virtualenv that has the requirements:

```bash
PYTHONDONTWRITEBYTECODE=1 uvicorn server:app --app-dir ui/app --port 8765
```

Run one worker only. The Ask AI spend total, the rate limits and the caches live in the process.

With no settings at all you get the page, live typhoon data, the PM2.5 proxy and `/mcp`. Ask AI shows as unavailable until there is an OpenRouter key, and landslide returns 503 until a model URL exists.

## Settings

Environment variables, or a `.env` file next to `server.py` (copy `.env.example`). Real environment variables win over the file. `.env` is in `.gitignore`: this repo auto-commits and pushes, so never put a key anywhere else in it.

| Variable | Default | Meaning |
|---|---|---|
| `HOST`, `PORT` | `127.0.0.1`, `8765` | Read by `run.sh`. |
| `PM25_MODEL_URL` | `https://veritas.premiersalesri.com/api/predict` | Where the team model answers. Set it empty to switch `/api/predict` off (503). |
| `PM25_CACHE_SECONDS` | `600` | How long a model answer is reused. |
| `OPENROUTER_API_KEY` | none | Turns on Ask AI. Stays on the server. |
| `ASK_SPEND_FILE` | `ask_spend.json` next to `server.py` | Running spend total. Ignored by git. |
| `CWA_API_KEY` | none | Use CWA's member API for typhoon data instead of the public mirror. |
| `CWA_TYPHOON_URL` | CWA's AWS open-data mirror, when there is no `CWA_API_KEY` | Typhoon file URL. Wins over the key. Set it empty to switch the feed off. |
| `LANDSLIDE_API_URL` | none | Landslide model, called as `GET <url>?lat=&lon=`. |
| `MCP_ALLOWED_HOSTS` | `veritas.premiersalesri.com` | Public host names `/mcp` answers on. Localhost always works. |

The other `ASK_*`, `TYPHOON_*` and `MCP_*` settings are listed in `.env.example` and explained in [../server/README.md](../server/README.md).

`/api/predict` returns the model's JSON unchanged. If the model can't be reached, the last good answer is served with an `X-Skyline-Stale: 1` header; if there has never been one, the answer is 503 `{"error": …}`.

`/api/health` reports only true/false per feature. It never includes keys or URLs.

Responses are gzipped (except the Ask AI stream), carry `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`, and there are no CORS headers. There is no Content-Security-Policy, because the page loads fonts, Leaflet, the Anthropic SDK, map tiles and Windy from other hosts and calls AI endpoints the user chooses. The page and its assets are sent with `Cache-Control: no-cache`, so browsers revalidate on every load and a deploy shows up at once.

## Tests

```bash
pip install -r ui/app/requirements-dev.txt
cd ui/app && PYTHONDONTWRITEBYTECODE=1 python -m pytest -p no:cacheprovider test_server.py
```

Every upstream is mocked; no network or keys are needed.

## Deploying on the box

None of this has been done. The facts that shape it (from [../HANDOFF.md](../HANDOFF.md) and the `app` branch):

- Only port 8000 is public, and the team app (`~/skyline`, `uvicorn server:app`) is on it.
- The box has 2 CPUs and 4 GB for the whole team.
- The page calls `/api/...` with absolute paths, so the API routes must be at the root of whatever host serves the page. The page itself can sit under any path, because its asset paths are relative.
- Every option changes the team app or its port. Agree it with the team first.

### Option A: put the pieces into the team app (recommended)

One process, no second server, three small changes on the box:

1. Copy `web/` to `~/skyline/static/skyline/`. The team app already serves `static/`, so the page is at `https://veritas.premiersalesri.com/static/skyline/index.html`.
2. Install `skyline_extras` into the team app as [../server/README.md](../server/README.md) describes: copy four files next to their `server.py`, `pip install 'mcp>=2.3,<3'`, and add `import skyline_extras; skyline_extras.install(app)`.
3. Add settings to `~/skyline/.env` and restart with their `run.sh`.

What differs from running `ui/app/server.py`:

- `/api/predict` is the team's own route. Ours isn't needed.
- `/api/health` doesn't exist there. If the page comes to rely on it, add that one route to the team app too.
- The keyless typhoon default is set by `ui/app/server.py`, not by `skyline_extras`. On the box, set `CWA_TYPHOON_URL=https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Warning/W-C0034-005.json` (or `CWA_API_KEY`) in `.env`.
- The spend file defaults to `ask_spend.json` next to `skyline_extras.py`.
- Assets are served by the team app's static handler: ETag revalidation, no gzip, no extra headers. `app.js` is about 240 KB uncompressed.

### Option B: run this app on a second port and have the team app forward to it

Start it with `PORT=8766 ui/app/run.sh` (leave `HOST` at `127.0.0.1`) and set `PM25_MODEL_URL=http://127.0.0.1:8000/api/predict`. The team app then has to forward, at its root: a page path (for example `/skyline/…` → our `/…`), `/api/ask`, `/api/ask/status`, `/api/typhoon`, `/api/landslide`, `/api/health` and `/mcp`.

- The forwarder is new code in the team app. It must stream the `/api/ask` response instead of buffering it, and pass `CF-Connecting-IP` through, or every visitor shares one rate limit.
- `/mcp` checks the `Host` header. Either the forwarder keeps the public host name, or set `MCP_ALLOWED_HOSTS` to match what it sends.
- The team's `run.sh` runs `pkill -f 'uvicorn server:app'` before starting. That pattern matches this app too, so restarting the team app stops ours. Start ours again afterwards, or change one of the two.
- A second Python process costs roughly 70–100 MB of the shared 4 GB and almost no CPU when idle.

This is more work in the team app than option A, for the gain of keeping our code in its own process.

### Option C: this app on port 8000, the team app behind it

Move the team app to another local port, run this app on 8000 with `HOST=0.0.0.0`, and set `PM25_MODEL_URL=http://127.0.0.1:<team port>/api/predict`. Skyline becomes the site at `/`.

This takes the team's own page and its other routes (`/api/weather`, `/api/model`, `/static/…`) off the public URL, because this app only proxies `/api/predict`. Choose it only if the team decides this UI replaces theirs.

### After any deploy

```bash
curl -s https://veritas.premiersalesri.com/api/ask/status
curl -s https://veritas.premiersalesri.com/api/typhoon
curl -s -X POST https://veritas.premiersalesri.com/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

If `/mcp` returns 421 through the tunnel, the `Host` header isn't on the allow-list: adjust `MCP_ALLOWED_HOSTS`.

## Files

```
ui/app/server.py          the app
ui/app/web/               the frontend (index.html, app.js, styles.css)
ui/app/run.sh             create the virtualenv, install, start uvicorn
ui/app/requirements.txt   runtime packages; requirements-dev.txt adds pytest
ui/app/.env.example       every setting, commented out
ui/app/test_server.py     tests
```
