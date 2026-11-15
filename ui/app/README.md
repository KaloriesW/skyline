# Skyline app

The Skyline UI and everything it calls, as one process: `server.py` serves the page from `web/` and answers the `/api` routes and `/mcp` on the same origin.

| Route | What it does | Needs |
|---|---|---|
| `GET /` and `/app.js`, `/styles.css`, … | The web UI, straight from `web/` | — |
| `GET /api/health` | `{ok, version, features: {ask, typhoon, landslide, pm25, pm25_cities, mcp}}` | — |
| `GET /api/predict?lat=&lon=` | Next-day PM2.5 / PM10 from the nearest city's model. No `lat`/`lon`: Taichung | Open-Meteo reachable (no key) |
| `GET /api/model?city=<id>` | That city's test-year report (default `taichung`) | — |
| `GET /api/model/cities` | Every city with its coordinates and scores | — |
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

With no settings at all you get the page, live typhoon data, the PM2.5 city models and `/mcp`. Ask AI shows as unavailable until there is an OpenRouter key, and landslide returns 503 until a model URL exists.

## Settings

Environment variables, or a `.env` file next to `server.py` (copy `.env.example`). Real environment variables win over the file. `.env` is in `.gitignore`: this repo auto-commits and pushes, so never put a key anywhere else in it.

| Variable | Default | Meaning |
|---|---|---|
| `HOST`, `PORT` | `127.0.0.1`, `8765` | Read by `run.sh`. |
| `PM25_CACHE_SECONDS` | `1800` | How long a city's prediction is reused. |
| `PM25_MAX_KM` | `25` | A point farther than this from every city centre gets 404 from `/api/predict`. |
| `PM25_MODEL_URL` | none | Fallback only: the team app's `/api/predict`. Used for Taichung when `model/models/taichung.json` is missing. |
| `OPENROUTER_API_KEY` | none | Turns on Ask AI. Stays on the server. |
| `ASK_SPEND_FILE` | `ask_spend.json` next to `server.py` | Running spend total. Ignored by git. |
| `CWA_API_KEY` | none | Use CWA's member API for typhoon data instead of the public mirror. |
| `CWA_TYPHOON_URL` | CWA's AWS open-data mirror, when there is no `CWA_API_KEY` | Typhoon file URL. Wins over the key. Set it empty to switch the feed off. |
| `LANDSLIDE_API_URL` | none | Landslide model, called as `GET <url>?lat=&lon=`. |
| `MCP_ALLOWED_HOSTS` | `veritas.premiersalesri.com` | Public host names `/mcp` answers on. Localhost always works. |

The other `ASK_*`, `TYPHOON_*` and `MCP_*` settings are listed in `.env.example` and explained in [../server/README.md](../server/README.md).

`/api/health` reports only true/false per feature, plus `pm25_cities`, the number of cities with a usable model file. `pm25` is true when that number is above zero (or the fallback URL is set). It never includes keys or URLs.

## PM2.5 / PM10 city models

One model per city or county: Taiwan's 22, listed in `model/cities.json` with the coordinates of each government seat. Taichung keeps the team's coordinates (24.1477, 120.6736). The recipe is the team's Taichung model (`skyline/backend` on the `app` branch) with the coordinates as a parameter: CAMS global PM and weather from Open-Meteo, today's values plus tomorrow's weather forecast, predicting tomorrow's daily mean.

### `GET /api/predict`

| Request | Answer |
|---|---|
| no `lat`/`lon` | Taichung, as before |
| `lat` and `lon` within 25 km of a city centre | 200, that city's prediction |
| farther than 25 km from every centre | 404 `{error, nearest: {id, name, name_zh, lat, lon, distance_km}, max_km}`: fall back to the CAMS forecast |
| only one of the two, or not numbers | 400 `{error}` |
| Open-Meteo fails and nothing is cached for that city | 502 `{error}` |
| the city has no model file | 503 `{error, nearest}` |

The 200 body is the team's `/api/predict` shape (`date, pm25, pm25_range, pm10, pm10_range, aqi, category, color, bad_day, advice{level,title,detail}, today, baseline, tomorrow_weather, model{kind,test_mae,baseline_mae}`) plus `city: {id, name, name_zh, lat, lon, distance_km}`. The model always runs on the city's own coordinates; the visitor's point only picks the city and is never sent upstream.

Answers are cached per city for 30 minutes and until the local date changes. If Open-Meteo fails, the last good answer is served with `X-Skyline-Stale: 1` and an `Age` header. Each fresh answer costs two small Open-Meteo requests, so 22 cities are at most 44 requests per half hour.

`model/predict.py` does all of this with the standard library and `httpx`. The server needs no pandas, scikit-learn or pickle. Model files are read on first use and kept in memory (about 4 KB each); restart the app after replacing them.

### `GET /api/model` and `GET /api/model/cities`

`/api/model?city=<id>` returns `model/metrics/<id>.json`: the same structure as the team's `metrics.json` (`trained_on, tested_on, n_train, n_test, features, chosen, results, interval, monthly, failures, test_dates, series, …`), so their Model Check page can read it. Added fields: `city`, `deployed`, `validation_choice`, `notes` and `data_range`. An unknown id is 404 with the list of ids.

`/api/model/cities` returns `model/summary.json` with every city listed: `{default_city, max_km, cities: [{id, name, name_zh, lat, lon, has_model, n_train, n_test, pm25: {baseline_mae, model_mae, improvement_pct, beats_baseline, boosted_mae, validation_choice}, pm10: {…}, warnings: {bad_days, warned, caught, precision, recall, …}, notes}], missing}`.

### What is deployed, and how honest the numbers are

- Every city serves the ridge model, because it exports to a few numbers. The boosted model is still trained and scored. Where the validation slice would have picked boosted, the city's `validation_choice` and `notes` say so and give both test-year errors.
- `chosen` in a metrics file is what is served (always ridge), so the report's series, intervals and worst misses describe the served model. The team's file used `chosen` for the validation pick; ours puts that in `validation_choice`.
- The test year is scored once and nothing is tuned on it. `beats_baseline` in the summary is false when ridge is no better than "tomorrow = same as today".
- The PM values are CAMS global model estimates, not station readings, on a grid of about 40 km. Neighbouring cities can share one PM grid cell (`city.aq_grid` in each metrics file shows which), so their models and scores are close to identical.

### Retraining

```bash
python3 -m venv /somewhere/outside/the/repo/venv
/somewhere/outside/the/repo/venv/bin/pip install -r ui/app/requirements-train.txt
/somewhere/outside/the/repo/venv/bin/python ui/app/model/train.py --cache-dir /somewhere/outside/the/repo/pm_data
```

- `--cities taichung,taipei` trains a subset, `--force` retrains cities already done for the same end date, `--end YYYY-MM-DD` fixes the last day (default: today minus 7 days).
- Raw downloads are cached in `--cache-dir` (about 3.4 MB per city; it must be outside the repo) and never fetched twice. A finished city is skipped on the next run, and `summary.json` is rewritten after every city, so an interrupted run can simply be started again.
- Open-Meteo's free tier allows 600 calls a minute, 5,000 an hour and 10,000 a day, and a long range counts as many calls: about 110 per request here, two requests per city, so about 4,900 for all 22. The script waits 90 seconds between downloads (`--pause`) and backs off on HTTP 429. A full run takes a little over an hour.
- After retraining Taichung, refresh the parity fixture: add `--cities taichung --force --parity-fixture ui/app/model/fixtures/taichung_parity.json`.

Responses are gzipped (except the Ask AI stream), carry `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`, and there are no CORS headers. There is no Content-Security-Policy, because the page loads fonts, Leaflet, the Anthropic SDK, map tiles and Windy from other hosts and calls AI endpoints the user chooses. The page and its assets are sent with `Cache-Control: no-cache`, so browsers revalidate on every load and a deploy shows up at once.

## Tests

```bash
pip install -r ui/app/requirements-dev.txt
cd ui/app && PYTHONDONTWRITEBYTECODE=1 python -m pytest -p no:cacheprovider test_server.py test_predict.py
```

Every upstream is mocked; no network or keys are needed. `test_predict.py` checks that the plain-Python features and ridge give the same numbers as pandas and scikit-learn on recorded rows (`model/fixtures/taichung_parity.json`); one of its tests recomputes the comparison live and is skipped unless pandas and scikit-learn are installed.

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

- `/api/predict` and `/api/model` are the team's own routes there, and they know Taichung only. For the other cities, copy `model/` next to their `server.py` and route `/api/predict?lat=&lon=`, `/api/model?city=` and `/api/model/cities` to `model/predict.py` the way `ui/app/server.py` does. That is new code in the team app.
- `/api/health` doesn't exist there. If the page comes to rely on it, add that one route to the team app too.
- The keyless typhoon default is set by `ui/app/server.py`, not by `skyline_extras`. On the box, set `CWA_TYPHOON_URL=https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Warning/W-C0034-005.json` (or `CWA_API_KEY`) in `.env`.
- The spend file defaults to `ask_spend.json` next to `skyline_extras.py`.
- Assets are served by the team app's static handler: ETag revalidation, no gzip, no extra headers. `app.js` is about 240 KB uncompressed.

### Option B: run this app on a second port and have the team app forward to it

Start it with `PORT=8766 ui/app/run.sh` (leave `HOST` at `127.0.0.1`). The team app then has to forward, at its root: a page path (for example `/skyline/…` → our `/…`), `/api/ask`, `/api/ask/status`, `/api/typhoon`, `/api/landslide`, `/api/health`, `/mcp` and, for the city models, `/api/predict`, `/api/model` and `/api/model/cities` (which replaces their own Taichung-only versions of the first two).

- The forwarder is new code in the team app. It must stream the `/api/ask` response instead of buffering it, and pass `CF-Connecting-IP` through, or every visitor shares one rate limit.
- `/mcp` checks the `Host` header. Either the forwarder keeps the public host name, or set `MCP_ALLOWED_HOSTS` to match what it sends.
- The team's `run.sh` runs `pkill -f 'uvicorn server:app'` before starting. That pattern matches this app too, so restarting the team app stops ours. Start ours again afterwards, or change one of the two.
- A second Python process costs roughly 70–100 MB of the shared 4 GB and almost no CPU when idle.

This is more work in the team app than option A, for the gain of keeping our code in its own process.

### Option C: this app on port 8000, the team app behind it

Move the team app to another local port and run this app on 8000 with `HOST=0.0.0.0`. Skyline becomes the site at `/`. This app answers `/api/predict` and `/api/model` from its own city models and does not need the team app.

This takes the team's own page and its other routes (`/api/weather`, `/static/…`) off the public URL, because this app does not forward them. Choose it only if the team decides this UI replaces theirs.

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
ui/app/model/predict.py   PM2.5 / PM10 inference in plain Python
ui/app/model/cities.json  the 22 cities and their coordinates
ui/app/model/models/      one ridge model per city (JSON)
ui/app/model/metrics/     one test-year report per city (JSON)
ui/app/model/summary.json every city's scores in one file
ui/app/model/train.py     training (offline; needs requirements-train.txt)
ui/app/web/               the frontend (index.html, app.js, styles.css)
ui/app/run.sh             create the virtualenv, install, start uvicorn
ui/app/requirements.txt   runtime packages; requirements-dev.txt adds pytest
ui/app/.env.example       every setting, commented out
ui/app/test_server.py     tests for the server
ui/app/test_predict.py    tests for model/predict.py, including parity with pandas / scikit-learn
```
