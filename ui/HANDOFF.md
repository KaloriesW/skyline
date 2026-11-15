# Skyline UI: handoff

Last updated 2026-11-15. This covers the UI work in `ui/`: what exists, where it lives, how to run and deploy it, and what's left.

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
  mockup/index.html     the whole web app: one file, no build step (~2,900 lines)
  mcp/skyline_mcp.py    MCP server with weather tools for Claude/ChatGPT/Cursor
  mcp/taiwan_districts.json   368 districts: postal code, 中文/English name, city, lat/lon
  mcp/requirements.txt  mcp>=2.3,<3
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

| Real | Sample |
|---|---|
| Postal code and district table, airports, universities (coordinates) | Every number on Home, Predictions and the default Ask AI answers |
| Windy embeds, Esri satellite imagery | Typhoon "TD-27" |
| MCP tools: Open-Meteo weather/air quality/storm risk, the team PM2.5 model (`/api/predict`) | Landslide and climate values |
| Nearest-source *logic* (station list is approximate) | |

## Next steps

1. **Wire real data into the UI.**
   - Current conditions and forecast: Open-Meteo works without keys, and CWA needs a key.
   - PM2.5: the team's `/api/predict` on the same origin.
   - The MCP server shows the calls to make.
2. **Landslide and typhoon.** Add API endpoints for the landslide model and CWA typhoon warnings, then add them as MCP tools and map layers.
3. **Our own overlay on Windy.** Drawing our data on top of Windy's map needs the Windy Map Forecast API, which needs a key; the free key is for development only.
4. **AI with no setup.** Today users bring their own key. To use the team's OpenRouter key, add a small server proxy on the box, because the key must never go in the page. Mind the $50 cap.
5. **Public MCP URL.** ChatGPT needs public HTTPS. Only port 8000 is public, so ask the organizer (Eric) for a second public URL, or mount the MCP server inside the team app.
6. **Small known gaps.**
   - Card previews use one fixed satellite still.
   - On the Windy view the slider only changes the region values, not Windy's own timeline.
   - District naming picks the nearest district centre, so a spot on a boundary can get the neighbouring district.
   - Canned Ask AI answers stay in English in 中文 mode.

## Tested

- Browser pane at 1280×800 and 375×812, in English and 中文.
- Live site serves the same file as local (hash match).
- The team app still answers on `/api/model`.
- MCP server: tested end to end over stdio with mcp 2.3.0 (tool listing and calls).
- Ask AI with real providers: only model listing (OpenRouter), a rejected Claude key, and a local mock streaming server. No real model answer yet, because no key was available.
