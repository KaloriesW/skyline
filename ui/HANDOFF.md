# Skyline: handoff

Last updated 2026-11-15 (evening). Skyline is a Taiwan weather and air-quality app with its own next-day PM2.5 forecast for 22 cities.

## Links

| What | Where |
|---|---|
| Live app | https://veritas.premiersalesri.com |
| GitHub | `KaloriesW/special-octo-enigma`, branch `main` (auto-synced from this Mac about once a minute) |
| Teammate's original app and model | branch `app` (`skyline/`), also in `~/skyline` on the box |
| Planning notes | [PLANNING.md](PLANNING.md) |
| App server docs | [app/README.md](app/README.md) |

## What it is

The app combines two pieces of work: our UI (search for any location, Predictions maps, Ask AI, Settings, 中文) and a teammate's Apple-Weather-style page (sky, glass tiles, widget editing) and PM2.5 model. Fonts and city skylines are ours; the style, sky, tiles and tile editing are theirs.

## Files

```
ui/
  app/server.py        FastAPI app: serves web/, /api/health, /api/predict, /api/model
  app/web/             the frontend: index.html, styles.css, sky.js, horizon.js (skyline art), icons.js, app.js (no build step)
  app/model/           train.py (offline), predict.py (serving, plain Python), cities.json,
                       models/ and metrics/ (one JSON per city), summary.json
  app/run.sh           creates app/.venv and starts the server
  server/skyline_extras.py   Ask AI proxy, /api/typhoon, /api/landslide
  mcp/                 MCP server (stdio; HTTP mount needs the `mcp` package)
.claude/launch.json    local preview: the real server on port 8766
```

## Run it locally

```bash
PORT=8766 ui/app/run.sh
```

Open http://localhost:8766. Tests: `pytest ui/server ui/app` (155 pass) in any environment with fastapi, httpx and pytest.

## The server

Reached over SSH as `veritas` (see `~/AGENTS.md` on the box for the rules; never commit the SSH key).

- Our app is in `~/skyline-ui` and runs on the one public port, 8000. `~/skyline-ui/run.sh` restarts it.
- The teammate's app in `~/skyline` is untouched. `~/skyline/run.sh` puts their page back on the public port.
- Deploy:

  ```bash
  rsync -az --delete --exclude .venv --exclude __pycache__ --exclude .env --exclude ask_spend.json --exclude '*.log' ui/app ui/server ui/mcp veritas:skyline-ui/
  ```

  ```bash
  ssh veritas 'bash ~/skyline-ui/run.sh'
  ```

- Ask AI is on, using the team's shared OpenRouter key from the box's environment, model `deepseek/deepseek-v4.1-flash`. The proxy stops at 5 USD (`ASK_BUDGET_USD`); limits are set in `~/skyline-ui/run.sh`.
- `/mcp` is off on the box: the shared Python environment has no `mcp` package.

## The PM2.5 model

- The teammate's "Model v2" recipe, trained per city for Taiwan's 22 cities and counties: 25 or 33 daily inputs (PM levels, weather, tomorrow's forecast, four upwind points), with ridge, boosted trees or a blend chosen per city by cross-validation.
- Taichung reproduces the teammate's numbers exactly (PM2.5 error 4.38 µg/m³ against a 5.91 baseline). Across cities the PM2.5 error is 18% to 41% below "tomorrow = today". Per-city numbers are in `app/model/summary.json`.
- Models are exported to JSON and run in plain Python, so the server needs no scikit-learn.
- A location uses the nearest city model within 25 km; beyond that the app shows the CAMS forecast and says so.
- Retrain: `python ui/app/model/train.py --cache-dir <dir>` in an environment with `requirements-train.txt`.

Limits to keep in mind: the training target is the CAMS model estimate, not station readings; cities in the same CAMS grid cell get near-identical models; the tuned warning catches most bad days at the cost of many false alarms; warning numbers mean little in cities with almost no bad days.

## Live and not live

| Live data | Not connected |
|---|---|
| Weather, air quality, waves, seasonal outlook (Open-Meteo) | Landslide model (no API exists) |
| Skyline PM2.5/PM10 forecast for 22 cities | Our own overlay on Windy (needs a Windy key) |
| Typhoon track (CWA open data) | |
| Ask AI (shared key) | |

## Known issues

A code review on 2026-11-15 confirmed about 70 medium and 45 low findings. The high ones and a batch of quick ones are fixed. Still open, most useful first:

- Ask AI context is larger than the proxy's default cap; the cap was raised rather than the context trimmed.
- Only the first storm is shown when several typhoons are active.
- The Predictions PM2.5 page is badged "By Skyline" but shows CAMS values only.
- Stale forecasts: the page can keep showing a prediction made for an earlier day if a refresh fails.
- Low contrast for secondary text on bright daytime skies.
- A few strings stay English in 中文 mode; several district names resolve to the wrong Chinese name.
- The prediction interval ("likely" range) is fitted on the test year.
- Drag-to-reorder does not work on touch screens.
