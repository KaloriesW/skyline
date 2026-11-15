# Skyline MCP server

Use Skyline's weather tools from the assistant you already use: Claude Desktop, Claude Code, ChatGPT, Cursor, VS Code, or any other MCP client.

| Tool | What it does | Source |
|---|---|---|
| `find_location` | Place name, Taiwan postal code (`408` → 南屯區), district (`Beitun`, `北屯區`), airport code (`TPE`, `RCTP`) or coordinates → latitude and longitude, plus the Taiwan district | Built-in table of all 368 districts (coordinates from Wikidata), Open-Meteo geocoder for everything else |
| `get_weather` | Now, the next 1–48 hours, and 7 days | Open-Meteo |
| `get_air_quality` | PM2.5, PM10, ozone, NO₂, US AQI now and over the next 24 h | Open-Meteo (Copernicus CAMS) |
| `get_thunderstorm_risk` | Low / moderate / high / severe for the next 24 h, with peak hours | Open-Meteo CAPE, rain chance, thunderstorm codes |
| `get_pm25_forecast_taichung` | Tomorrow's PM2.5/PM10 for Taichung, AQI and the school-PE advice | The team's model at `https://veritas.premiersalesri.com/api/predict` |

No API keys are needed.

## Install

Python 3.10 or newer:

```bash
pip install -r ui/mcp/requirements.txt
```

## Connect it

Use the full path to `skyline_mcp.py` on your machine.

**Claude Code**

```bash
claude mcp add skyline -- python3 /full/path/to/ui/mcp/skyline_mcp.py
```

**Claude Desktop, Cursor and other clients that use a JSON config** (Claude Desktop: Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "skyline": {
      "command": "python3",
      "args": ["/full/path/to/ui/mcp/skyline_mcp.py"]
    }
  }
}
```

**Clients that connect to a URL.** Start it over HTTP, then add `http://localhost:8790/mcp`:

```bash
python3 ui/mcp/skyline_mcp.py --http --port 8790
```

ChatGPT and other web apps need a public HTTPS URL, not `localhost`. On the hackathon box only port 8000 is public, so that needs a second public URL from the organizer.

## Settings

- `SKYLINE_API`: where the team's PM2.5 model is called (default `https://veritas.premiersalesri.com`).

## Notes

- Inside Taiwan every answer includes the district, picked by nearest district centre. A point right on a boundary can come back as the neighbouring district.
- Landslide risk and typhoon tracks aren't tools yet. They'll be added once the landslide model has an API and CWA typhoon data is wired up.
