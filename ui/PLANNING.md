# UI Planning — Skyline (weather app)

Design (Claude Design canvas): https://claude.ai/artifact/LV5MG4J2AGih4Ew2fPBuC5
HTML mockup: [mockup/index.html](mockup/index.html)

## Direction
- Like Apple Weather, but more playful and dynamic. The sky gradient changes with the weather mood (day, sunset, night, rain).
- Designed for desktop first, then mobile.
- Type: Bricolage Grotesque for display text, Inter for UI. Accent color: sun yellow `#FFC24B`.

## Customization
- **Everything can be changed in Settings:** accent color, risk color scale, background (live weather or static), tile style, fonts, corner roundness, skyline art, map base, pinned items, the stats grid, data sources, units and language.
- The design shows the **defaults** only:
  - Accent: sun yellow `#FFC24B`
  - Risk scale: green, yellow, orange, red
  - Background: live weather
  - Tiles: glass
  - Fonts: Bricolage Grotesque + Inter
  - Corners: 24 px
  - Skyline: follows the user's city
  - Map base: satellite for Skyline models, Windy for others

## Screens
| Screen | Desktop | Mobile | Notes |
|---|---|---|---|
| Home | `Main.dc.html` | `HomeMobile.dc.html` | Location and temperature hero, plus a fully customizable tile grid with an Edit mode for remove, reorder, resize, and add |
| Predictions (Taiwan only) | `Predictions.dc.html` | `PredictionsMobile.dc.html` | Map layers for PM2.5, landslide risk, and climate projection. Includes a time slider, region detail, and a risk ranking |
| AI Assistant (RAG/MCP) | `Assistant.dc.html` | `AssistantMobile.dc.html` | Grounded answers with source chips, inline charts, and suggested prompts |
| Predictions map | (inside `Predictions.dc.html`) | `PredictionsMapMobile.dc.html` | Satellite or Windy base, colored overlay, and a past ↔ forecast slider |
| Settings | `Settings.dc.html` | `SettingsMobile.dc.html` | Pinned count, Theme & colors (defaults), data sources, units |

## Taiwan personality
- The Home hero shows a skyline and mountains for the user's city, switched by the **Location** tweak:
  - Taipei: Taipei 101, Elephant Mountain, Yangmingshan
  - Taichung: the National Theater's wave roof, Dakeng hills
  - Tainan: a temple roof with upturned eaves, low old-town houses
  - Kaohsiung: 85 Sky Tower, Shoushan
  - Hualien: the steep Central Range and Pacific waves
- The Predictions map shows the Central Range ridge and marks Yushan (3,952 m).

## Location search
- The search button (also `/` or ⌘K) accepts:
  - place names in English or 中文
  - decimal or degrees/minutes/seconds coordinates
  - IATA and ICAO airport codes
  - university names and short forms
- An offline list covers all 368 Taiwan districts with their 3-digit postal codes (coordinates from Wikidata), plus cities, landmarks, airports and universities, and a few international places. Anything else goes to a worldwide geocoder.
- Automatic locations (typed coordinates, GPS) are named by district. Universities, airports and landmarks are used as names only when the user picks them.
- Picking a result sets the location, which drives the skyline, the nearest source, and the map pin.

## AI assistant
- **Bring your own model:** any OpenAI-compatible API (OpenAI, OpenRouter, Ollama, LM Studio) or Claude through the Anthropic SDK. Ask AI streams the answer and grounds it on the Skyline data for the user's location.
- **MCP:** `ui/mcp/skyline_mcp.py` exposes find_location, get_weather, get_air_quality, get_thunderstorm_risk and get_pm25_forecast_taichung. This lets people use Skyline from Claude, ChatGPT, Cursor and other MCP clients.
- **Next:** add landslide and typhoon tools once those have APIs. To give the assistant a public URL, the organizer needs to set up a second public URL.

## Data-source rule
- Weather data can come from several APIs (CWA stations, Windy, others). **Each reading always comes from the source closest to the user's current location.**
- The UI shows which source it used and how far away it is, e.g. "Nearest source: CWA Xinyi station · 0.9 km". Tile headers name that source too.

## Home layout
- **Top half:** a big centered temperature, the location, and one headline (e.g. "Thunderstorms likely 4–7 PM").
- **Bottom half:** pinned items, 3 by default and up to 10 (set in Settings).
- **Scroll down → All stats:** a fully customizable grid. Each tile can be moved, made bigger or smaller, or hidden.
- **Live background** follows the nearest station's conditions: clear day with lens flare, partly cloudy, cloudy, rain, thunderstorm with lightning, clear night with moon and stars, dawn, and dusk. Settings has a "Reduce motion" switch.

## Predictions layout
- A grid of dataset cards in two categories:
  - **By Skyline** (our own models, gold outline): PM2.5 forecast, landslide risk
  - **Others** (pulled from APIs): rain, thunderstorms, wind and gusts, typhoon track, coast and waves, climate projection
- Opening a card shows a Taiwan map of that dataset, with a time slider underneath that runs from −72h through Now to +7d. Left of Now shows observed past data, and right of Now shows predictions with a confidence level. A side panel lists the value for each region.
- **Map bases are always real imagery:** either **Satellite**, the default for By Skyline because the landslide model runs on satellite data, or a **Windy map** (Windy Map Forecast), the default for Others. Each map has a Satellite / Windy toggle.
- Datasets sit on top as a soft **colored overlay**, e.g. a PM2.5 heat overlay or landslide hotspots.
- For the real build, the satellite layer could come from tiles such as Sentinel-2, NASA GIBS, or Himawari. The mockup uses a drawn stand-in.

## What Windy's API gives us
- **Point Forecast:** temp, dewpoint, precip, convPrecip, snowPrecip, wind, windGust, **cape** (thunderstorm energy), ptype, low/mid/high clouds, rh, pressure, cbase, visibility, **weatherWarnings** (code 95 = thunderstorm, 96 = heavy thunderstorm or hail). Sea: waves, swell, currents (gfsWave etc.). Air quality: CAMS aqi, pm2p5, pm10, no2, o3.
- **Map Forecast:** an embeddable Leaflet map with Windy layers. The free key is for development only, and production needs a paid plan.
- **Not in Windy's API:** typhoon tracks. Use CWA typhoon warnings for those.

## Tile catalog → data source
| Tile | Source |
|---|---|
| Hourly, 7-day, wind, UV, humidity, rain radar | Nearest weather source (CWA station, Windy grid point, etc.) |
| PM2.5 | Team PM2.5 model |
| Landslide risk | Team landslide model (Taiwan) |
| Climate outlook | Climate projections |
| Thunderstorm risk, storm outlook | Windy cape + convPrecip + weatherWarnings |
| Live map | Windy Map Forecast |
| Typhoon watch | CWA typhoon warnings |
| Cloud layers, pressure, visibility | Windy |
| Coast & waves | Windy gfsWave |

## Open items
- Real data wiring. Every value in the design is sample data.
- Confirm which climate projection dataset to use.
- Make the °C/°F and 中文/EN toggles actually work.
