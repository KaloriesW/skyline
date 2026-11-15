# Skyline MCP server

Use Skyline's weather tools from the assistant you already use: Claude Desktop, Claude Code, ChatGPT, Cursor, VS Code, or any other MCP client.

| Tool | What it does | Source |
|---|---|---|
| `find_location` | Place name, Taiwan postal code (`408` → 南屯區), district (`Beitun`, `北屯區`), airport code (`TPE`, `RCTP`) or coordinates → latitude and longitude, plus the Taiwan district | Built-in table of all 368 districts (coordinates from Wikidata), Open-Meteo geocoder for everything else |
| `get_weather` | Now, the next 1–48 hours, and 7 days | Open-Meteo |
| `get_air_quality` | PM2.5, PM10, ozone, NO₂, US AQI now and over the next 24 h | Open-Meteo (Copernicus CAMS) |
| `get_thunderstorm_risk` | Low / moderate / high / severe for the next 24 h, with peak hours | Open-Meteo CAPE, rain chance, thunderstorm codes |
| `get_pm25_forecast_taichung` | Tomorrow's PM2.5/PM10 for Taichung, AQI and the school-PE advice | The team's model at `https://veritas.premiersalesri.com/api/predict` |
| `get_typhoon_status` | Active typhoons and tropical depressions with their past and forecast track | CWA open data, dataset W-C0034-005. Needs `CWA_API_KEY` |
| `get_landslide_risk` | Landslide risk at a point from the team's landslide model | Needs `LANDSLIDE_API_URL`. The model has no API yet |

The first five tools need no API keys. The last two say "not configured" or "not connected" until their setting is present; they never make up values.

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

ChatGPT and other web apps need a public HTTPS URL, not `localhost`. On the hackathon box only port 8000 is public, so the server can run inside the team app instead: `skyline_mcp.mount_http(app)` serves it at `/mcp` on the same port. The steps are in [../server/README.md](../server/README.md).

## Settings

- `SKYLINE_API`: where the team's PM2.5 model is called (default `https://veritas.premiersalesri.com`).
- `CWA_API_KEY`: CWA open data member key, for `get_typhoon_status`. `CWA_TYPHOON_URL` fetches the typhoon file from another URL instead, with no key.
- `LANDSLIDE_API_URL`: the landslide model's endpoint, called as `GET <url>?lat=&lon=`.
- `MCP_ALLOWED_HOSTS`: host names the mounted `/mcp` endpoint answers on (default `veritas.premiersalesri.com`, plus localhost).

## Notes

- Inside Taiwan every answer includes the district, picked by nearest district centre. A point right on a boundary can come back as the neighbouring district.
- `skyline_sources.py` must sit next to `skyline_mcp.py`. It holds the typhoon parser shared with the web API.
