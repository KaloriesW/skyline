# Skyline UI: handoff

Last updated 2026-11-15. This covers the UI work in `ui/`: what exists, where it lives, how to run and deploy it, and what's left.

> **In transition (2026-11-15).** The single-file mockup was split and moved to `ui/app/web/`, and `ui/mockup/` no longer exists. The app now runs from `ui/app/` (`ui/app/run.sh`, see [app/README.md](app/README.md)). It is being merged with the team's app from the `app` branch, and per-city PM2.5 models are being trained. The Files, Run, Deploy and "What the mockup does" sections below describe the old layout and are wrong until this file is rewritten. The live site on the box is unchanged.

## Links

| What | Where |
|---|---|
| Live mockup | https://veritas.premiersalesri.com/static/mockup/index.html |
| GitHub | `KaloriesW/special-octo-enigma`, branch `main` (auto-synced, see below) |
| Team app (PM2.5 model, separate) | branch `app` (`skyline/`), running on the box at https://veritas.premiersalesri.com |
| Claude Design canvas (earlier static design) | https://claude.ai/artifact/LV5MG4J2AGih4Ew2fPBuC5 (private until shared) |
| Planning notes | [PLANNING.md](PLANNING.md) |
| Usage notes | [README.md](README.md), [mcp/README.md](mcp/README.md) |

## Files

```
ui/
  HANDOFF.md            this file
  PLANNING.md           product decisions, data sources, tile catalog
  README.md             how to use the mockup
  mockup/index.html     the whole web app: one file, no build step (~3,600 lines)
  mcp/skyline_mcp.py    MCP server with weather tools for Claude/ChatGPT/Cursor
  mcp/taiwan_districts.json   368 districts: postal code, 中文/English name, city, lat/lon
  mcp/skyline_sources.py   typhoon parser and source settings (shared with server/)
  mcp/requirements.txt  mcp>=2.3,<3
  server/skyline_extras.py   FastAPI router: /api/ask, /api/typhoon, /api/landslide, /mcp
  server/README.md      how to add it to the team app
.claude/launch.json     local preview server config (port 8765)
```

## Run it locally

```bash
python3 -m http.server 8765 --directory ui/mockup
```

Open http://localhost:8765. Use a server: hash routing (`#home`, `#predictions/pm25`, …) doesn't work from some file previews.

## Deploy to the box

The box is reached over SSH through a Cloudflare tunnel. `cloudflared` is installed on this Mac and `~/.ssh/config` has a `Host veritas` entry (user `kids`, key `~/.ssh/veritas_kid1`). Never commit or share that key.

```bash
scp ui/mockup/index.html veritas:skyline/static/mockup/index.html
```

- The mockup sits in its own folder inside the team app's static directory. The team's FastAPI app (`~/skyline`, uvicorn on port 8000, the only public port) serves it at `/static/mockup/index.html`. Deploying never touches the app itself.
- To check a deploy, compare hashes:

  ```bash
  shasum -a 256 ui/mockup/index.html
  curl -s https://veritas.premiersalesri.com/static/mockup/index.html | shasum -a 256
  ```

- The box has 2 CPUs and 4 GB shared by the whole team, a $50 shared LLM key, and is deleted after the hackathon. The organizer's rules are in `~/AGENTS.md` on the box.

## GitHub

An auto-sync job on this Mac commits and pushes everything to `main` within about a minute ("Auto-sync … from MacBook-Air-4.local"). To confirm a change is up:

```bash
git fetch && git status -sb
```

`main...origin/main` with nothing pending means it's pushed. The team app lives on the `app` branch and hasn't been touched.

## What the mockup does

Four screens with hash routing. Desktop first, plus a phone layout (bottom tab bar below 760 px).

- **Home**
  - Weather background:
    - The sky gradient, sun, lens flare, moon and stars are CSS.
    - Clouds, rain (three depths, wind, splashes, haze) and lightning (branching bolts, in-cloud flashes) are drawn on two canvases in `SkyFX`. Flashes stay under the photosensitivity limit, and Reduce motion draws one still frame.
  - City skyline for the nearest of Taipei, Taichung, Tainan, Kaohsiung or Hualien. Taichung shows the National Taichung Theater, and windows light up at night and in storms.
  - Hero area: big temperature, headline, today's H/L, and a 7-day high/low row.
  - Pinned items: 3 to 10, set in Settings.
  - All stats grid: drag, resize, hide and restore tiles. The "Live map" tile is a real Windy embed.
  - A "Demo: station conditions" picker switches the weather for demos.
- **Predictions**
  - Two groups: By Skyline (PM2.5, landslide) and Others (rain, thunderstorms, wind, typhoon, waves, climate). Card previews use a real satellite photo of Taiwan.
  - Each dataset opens a real, zoomable map:
    - **Satellite:** Leaflet 1.9.4 on Esri World Imagery with our blurred colored overlay, labels, typhoon track and the user's pin.
    - **Windy:** the official embed with the matching layer.
  - Satellite is the default for By Skyline and Windy for Others. The 12-step slider runs from −72h to +7d.
- **Ask AI**
  - Demo (canned answers), any OpenAI-compatible API, or Claude through `@anthropic-ai/sdk@1.3.0` loaded from jsDelivr. Claude Opus 5.5 is the default, with server-side refusal fallback on.
  - Answers stream in. The model gets the on-screen Skyline data for the current location (`skylineContext()`).
  - Keys stay in the browser, in memory only unless "Remember" is on.
- **Settings**
  - Home: pinned count and order.
  - Theme: accent, risk colors, background, tile style, fonts, corner radius, skyline, map base.
  - Reduce motion, data-source switches, °C/°F, 中文/English.
  - AI provider setup and MCP setup snippets.
  - Saved in `localStorage` under `skyline-mockup-v1`.
- **Search** (button, `/` or ⌘K) accepts:
  - coordinates (decimal or DMS)
  - Taiwan postal codes (`408` → 南屯區)
  - district names in English or 中文
  - IATA and ICAO codes
  - universities and cities
  - "Search worldwide" (Open-Meteo geocoder) and GPS

  Automatic locations are named by district. Universities, airports and landmarks become the name only when the user picks them.

### Finding your way around `index.html`

Everything is inside one script (an IIFE), in this order:

1. Data: places, airports, universities, `DISTRICTS`, stations, `SKYLINES`, `WEATHER`, `DATASETS`
2. State: `S` and `DEFAULTS`
3. Helpers: `nearestSource`, `nearestPlace`/`autoLoc`, `skylineFor`
4. `SkyFX` (canvas sky)
5. `catalog()` (tiles) and `weekData()`/`todayHL()`
6. Live maps: `renderLive`, `thumbHTML`, `windyURL`
7. Views: `homeView`, `predView`, `askView`, `settingsView`
8. AI: `llmAsk`, `streamOpenAI`, `streamClaude`
9. Router and `render()`
10. `ACTIONS` (click handlers keyed by `data-action`)
11. Search
12. 中文 layer (`ZH`, `ZHP`, `translateTree`)

Views render as HTML strings in English. The 中文 layer swaps visible text after each render.

## What's real and what's sample

Each tile and dataset labels its own source: "… · live" or "Sample · …".

| Real | Sample |
|---|---|
| Postal code and district table, airports, universities (coordinates) | Landslide and climate values |
| Home hero, 7-day row and most tiles: Open-Meteo forecast and CAMS air quality at the user's coordinates | Waves tile away from the coast, and the waves dataset |
| Predictions region levels for PM2.5, rain, thunderstorms and wind (Open-Meteo, seven cities) | Typhoon "TD-27", shown whenever `/api/typhoon` doesn't answer |
| Team PM2.5 model (`/api/predict`), when the page is served from the box | Demo Ask AI answers (they still quote fixed sample numbers) |
| Windy embeds, Esri satellite imagery | Everything, when Open-Meteo is switched off or unreachable |
| MCP tools: Open-Meteo weather/air quality/storm risk, team PM2.5 model, CWA typhoon status | |

## Built on 2026-11-15, not deployed

Nothing below is on the box yet. The live mockup is still the old file.

- **Live data in the UI** (`mockup/index.html`, "Live data" block before the tile catalog). First render is sample, then it redraws when data arrives. Cached 10 minutes per location. "Live weather" is the default in the demo picker; a demo condition only overrides the sky.
- **Ask AI with no setup.** A "Skyline (no setup)" provider calls `/api/ask` on the same origin. It becomes the default when `/api/ask/status` says it is available, and shows as unavailable otherwise.
- **Server pieces** in `server/` (see [server/README.md](server/README.md)): `skyline_extras.py` adds `/api/ask` (OpenRouter proxy with a spend cap, default $5, and rate limits), `/api/typhoon` (CWA dataset W-C0034-005), `/api/landslide` (pass-through to `LANDSLIDE_API_URL`, 503 until a model exists) and mounts the MCP server at `/mcp`. The team app adds one line: `import skyline_extras; skyline_extras.install(app)`.
- **MCP:** new tools `get_typhoon_status` and `get_landslide_risk`; `mount_http()` serves the tools over streamable HTTP on port 8000, so no second public URL is needed.
- **Known gaps closed:** 中文 demo answers, a distinct preview per dataset card, the slider reopens Windy at the chosen forecast time (future steps only; Windy's embed can't open in the past), and locations near a district boundary say so.

## Next steps

1. **Deploy.** Copy the new `index.html` to the box, then install the server pieces into the team app (`app` branch) and set `OPENROUTER_API_KEY`, and either `CWA_API_KEY` or `CWA_TYPHOON_URL`. Agree the change with the team first: it touches their app.
2. **Test with real keys.** The proxy has only run against mocks (38 tests pass). Check a real streamed answer, that spend is recorded, and that `/mcp` answers through the Cloudflare tunnel (adjust `MCP_ALLOWED_HOSTS` if it returns 421).
3. **Landslide model API.** None exists. Once it does, set `LANDSLIDE_API_URL` and wire the tile and map.
4. **Our own overlay on Windy.** Needs the Windy Map Forecast API and a key; the free key is for development only.
5. **Small gaps left.**
   - Demo Ask AI answers and the typhoon card preview still use sample numbers.
   - District naming still uses the nearest centre; true boundaries need polygon data.
   - A few Ask AI and AI-settings strings have no 中文.
   - The CAMS PM2.5 forecast ends about four days out, so +5d and +7d repeat the last level.

## Tested

- Browser pane at phone width and 1280×800, English and 中文, on localhost: Home with live Open-Meteo values, Predictions cards and maps, the Windy slider at +48h, Ask AI demo, Settings. Only the expected 404s for `/api/*` in the console.
- Server: 38 pytest cases with upstreams mocked; MCP over stdio (7 tools) and over HTTP on localhost.
- Not tested: anything on the box, a real OpenRouter or CWA key, a live typhoon, the UI against the real `/api/ask` and `/api/typhoon`.
