# Skyline extras (server side)

Server pieces the UI needs, written to drop into the team's FastAPI app (`skyline/backend/server.py` on the `app` branch) without changing anything it already does.

| Endpoint | What it does | Needs |
|---|---|---|
| `GET /api/ask/status` | `{available, model, remaining_usd}` for the built-in AI | — |
| `POST /api/ask` | Streaming Ask AI through the team's OpenRouter key, with a spend cap and rate limits | `OPENROUTER_API_KEY` |
| `GET /api/typhoon` | Active tropical cyclones and their tracks from CWA | `CWA_API_KEY` |
| `GET /api/landslide?lat=&lon=` | Passes the question to the team's landslide model | `LANDSLIDE_API_URL` |
| `POST /mcp` | The Skyline MCP server over streamable HTTP, for ChatGPT, Claude and other URL-based clients | `mcp` package |

Nothing here is deployed yet.

## Files

```
ui/server/skyline_extras.py        the router, the OpenRouter proxy, install(app)
ui/server/test_skyline_extras.py   tests (all upstreams mocked)
ui/server/fixtures/cwa_W-C0034-005.json   trimmed copy of a real CWA typhoon file, for the tests
ui/server/requirements.txt         runtime deps; requirements-dev.txt adds pytest
ui/mcp/skyline_sources.py          typhoon parser and source settings, shared with the MCP server (stdlib only)
ui/mcp/skyline_mcp.py              MCP server; now also has mount_http(app) and two new tools
```

## Add it to the team app

1. Copy four files next to `server.py` (on the box: `~/skyline/backend/`):

   ```
   ui/server/skyline_extras.py
   ui/mcp/skyline_sources.py
   ui/mcp/skyline_mcp.py
   ui/mcp/taiwan_districts.json
   ```

2. Install the one new package into the app's venv (`fastapi` and `httpx` are already in `skyline/requirements.txt`):

   ```bash
   /home/kids/venv/bin/pip install 'mcp>=2.3,<3'
   ```

   `mcp` needs Python 3.10 or newer. Without it, the `/api` routes still work and `/mcp` is skipped with a warning in the log.

3. Add one line to `server.py`, anywhere after `app = FastAPI(...)`:

   ```python
   import skyline_extras; skyline_extras.install(app)
   ```

   To add only the `/api` routes and no MCP endpoint, use `app.include_router(skyline_extras.router)` instead.

4. Put the settings in `~/skyline/.env` (the app already loads that file) and restart with `run.sh`:

   ```
   OPENROUTER_API_KEY=...        # the shared key; stays on the server
   ASK_BUDGET_USD=5
   CWA_API_KEY=...               # CWA open data member key
   ```

5. Check it:

   ```bash
   curl -s https://veritas.premiersalesri.com/api/ask/status
   curl -s https://veritas.premiersalesri.com/api/typhoon
   curl -s -X POST https://veritas.premiersalesri.com/mcp \
     -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```

Keep the app on one uvicorn worker (as `run.sh` does now). The spend total and rate limits live in that one process.

## Settings

All are environment variables, read on each request.

| Variable | Default | Meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | none | Without it, `/api/ask/status` says `available: false` and `/api/ask` returns 503. |
| `ASK_MODEL` | `google/gemini-2.5-flash-lite` | OpenRouter model id. The page can't choose the model. |
| `ASK_BUDGET_USD` | `5` | Hard cap on what this proxy may spend, in total. |
| `ASK_SPEND_FILE` | `ask_spend.json` next to `skyline_extras.py` | Where the running total is kept across restarts. Delete it to reset the total. |
| `ASK_RESERVE_USD` | `0.01` | Held per request while it runs; charged if OpenRouter doesn't report a cost. |
| `ASK_RATE_PER_MIN` / `ASK_RATE_PER_DAY` | `5` / `40` | Questions per visitor IP. |
| `ASK_GLOBAL_PER_MIN` | `30` | Questions per minute from everyone together. |
| `ASK_MAX_CONCURRENT` | `4` | Answers streaming at once. |
| `ASK_MAX_MESSAGES` | `12` | Messages per request. |
| `ASK_MAX_INPUT_CHARS` / `ASK_MAX_CONTEXT_CHARS` | `6000` / `4000` | Size limits for the conversation and for `context`. |
| `ASK_MAX_TOKENS` | `600` | Answer length; never more than 2000. |
| `ASK_MAX_SECONDS` | `60` | Longest a single answer may stream. |
| `ASK_TRUST_PROXY_HEADERS` | `1` | Take the visitor IP from `CF-Connecting-IP` / `X-Forwarded-For` (needed behind the Cloudflare tunnel). |
| `CWA_API_KEY` | none | Without it `/api/typhoon` returns 503 and the UI keeps its sample storm. |
| `CWA_TYPHOON_URL` | none | Fetch the typhoon file from this URL instead; no key is sent. |
| `TYPHOON_CACHE_SECONDS` | `600` | How long a CWA answer is reused. |
| `TYPHOON_STALE_HOURS` | `12` | A storm counts as active while its newest fix is at most this old. |
| `LANDSLIDE_API_URL` | none | Called as `GET <url>?lat=&lon=`. Without it `/api/landslide` returns 503. |
| `MCP_ALLOWED_HOSTS` | `veritas.premiersalesri.com` | Host names `/mcp` answers on (localhost is always allowed). `*` turns the check off. |
| `MCP_ALLOWED_ORIGINS` | `https://<each allowed host>` | Browser origins allowed to call `/mcp`. |

## Ask AI proxy

Request: `POST /api/ask` with `{"messages": [{"role": "user" | "assistant", "content": "..."}], "context": "..."}`.

Response: an OpenAI-style event stream, passed through from OpenRouter:

```
data: {"choices":[{"delta":{"content":"Light "}}], ...}
data: {"choices":[{"delta":{"content":"rain."}}], ...}
data: [DONE]
```

Errors are JSON `{"error": "..."}` with a non-200 status:

| Status | When |
|---|---|
| 400 | Bad JSON, a `system` role, too many messages, too much text, last message not from the user |
| 413 | Body over 64 KB |
| 429 | Visitor or global rate limit (with `Retry-After`), too many answers at once, budget used up, OpenRouter rate limit or out of credit |
| 502 | OpenRouter unreachable or returned an error |
| 503 | No key on the server |

How the key is protected:

- The key is read from the environment, sent only to `openrouter.ai`, and never logged or returned. Upstream error text isn't forwarded.
- The server sets the model, `max_tokens` and the system prompt. Extra fields in the request are ignored, and `system` messages are refused.
- The system prompt keeps the model to Skyline weather questions and wraps `context` as data.
- Each request holds `ASK_RESERVE_USD` against the budget before it is sent. When the stream ends, the hold is replaced by the cost OpenRouter reports in `usage.cost`. If no cost arrives (for example the visitor closes the page mid-answer), the hold is charged.
- If the spend file exists but can't be read, the proxy stays off until the file is fixed or removed.

At the default model's price a full-length answer costs about $0.0005, so $5 is roughly 10,000 answers.

## Typhoon data

Source: CWA open data dataset **W-C0034-005**, 「颱風消息與警報-熱帶氣旋路徑」, fetched as a JSON file:

```
https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/W-C0034-005?Authorization=<key>&downloadType=WEB&format=JSON
```

| Our field | CWA field |
|---|---|
| `name`, `name_zh` | `TyphoonName`, `CwaTyphoonName` (an unnamed depression becomes `TD-<CwaTdNo>`, 熱帶性低氣壓) |
| `time` (past) | `AnalysisData.Fix[].DateTime` |
| `time` (forecast) | `ForecastData.Fix[].InitialTime` + `ForecastHour` hours |
| `lat`, `lon` | `CoordinateLatitude`, `CoordinateLongitude` |
| `wind_ms` | `MaxWindSpeed` (m/s). `null` where CWA leaves it out. |
| `pressure_hpa` | `Pressure` (hPa) |
| `updated` | `Sent` |

CWA keeps the last bulletin in the file after a storm ends, so `active` is true only while a storm's newest fix is within `TYPHOON_STALE_HOURS`.

CWA also publishes the same file without a key in its AWS Open Data bucket. To use that instead of a member key:

```
CWA_TYPHOON_URL=https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Warning/W-C0034-005.json
```

## MCP at /mcp

`skyline_mcp.mount_http(app)` (called by `install`) adds the MCP library's streamable-HTTP endpoint as a route on the team app and starts its session manager with the app. It runs stateless with JSON responses, so it keeps nothing in memory between calls. The public URL is `https://veritas.premiersalesri.com/mcp`.

The endpoint has no login: anyone with the URL can call the weather tools. They are read-only and don't use the OpenRouter key.

Stdio (`python3 skyline_mcp.py`) and the standalone HTTP mode (`--http`) work as before.

## Run standalone

```bash
python3 -m venv .venv && .venv/bin/pip install -r ui/server/requirements.txt
cd ui/server
../../.venv/bin/uvicorn skyline_extras:create_app --factory --port 8791
```

`create_app()` serves the `/api` routes only. Set the variables above in the shell first to turn features on.

## Tests

```bash
pip install -r ui/server/requirements-dev.txt
cd ui/server && python -m pytest -p no:cacheprovider test_skyline_extras.py
```

OpenRouter, CWA and the landslide model are mocked; the tests need no network and no keys.
