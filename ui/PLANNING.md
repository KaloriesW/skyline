# UI Planning — Skyline (weather app)

Design (Claude Design canvas): https://claude.ai/artifact/LV5MG4J2AGih4Ew2fPBuC5

## Direction
- Like Apple Weather, but more playful and dynamic. The sky gradient changes with the weather mood (day, sunset, night, rain).
- Designed for desktop first, then mobile.
- Type: Bricolage Grotesque for display text, Inter for UI. Accent color: sun yellow `#FFC24B`.

## Screens
| Screen | Desktop | Mobile | Notes |
|---|---|---|---|
| Home | `Main.dc.html` | `HomeMobile.dc.html` | Location and temperature hero, plus a fully customizable tile grid with an Edit mode for remove, reorder, resize, and add |
| Predictions (Taiwan only) | `Predictions.dc.html` | `PredictionsMobile.dc.html` | Map layers for PM2.5, landslide risk, and climate projection. Includes a time slider, region detail, and a risk ranking |
| AI Assistant (RAG/MCP) | `Assistant.dc.html` | `AssistantMobile.dc.html` | Grounded answers with source chips, inline charts, and suggested prompts |

## Taiwan personality
- The Home hero shows a skyline and mountains for the user's city, switched by the **Location** tweak:
  - Taipei: Taipei 101, Elephant Mountain, Yangmingshan
  - Taichung: the National Theater's wave roof, Dakeng hills
  - Tainan: a temple roof with upturned eaves, low old-town houses
  - Kaohsiung: 85 Sky Tower, Shoushan
  - Hualien: the steep Central Range and Pacific waves
- The Predictions map shows the Central Range ridge and marks Yushan (3,952 m).

## Data-source rule
- Weather data can come from several APIs (CWA stations, Windy, others). **Each reading always comes from the source closest to the user's current location.**
- The UI shows which source it used and how far away it is, e.g. "Nearest source: CWA Xinyi station · 0.9 km". Tile headers name that source too.

## Tile catalog → data source
| Tile | Source |
|---|---|
| Hourly, 7-day, wind, UV, humidity, rain radar | Nearest weather source (CWA station, Windy grid point, etc.) |
| PM2.5 | Team PM2.5 model |
| Landslide risk | Team landslide model (Taiwan) |
| Climate outlook | Climate projections |
| Future: typhoon track, tides, AQI | TBD |

## Open items
- Real data wiring. Every value in the design is sample data.
- Confirm which climate projection dataset to use.
- Make the °C/°F and 中文/EN toggles actually work.
