"""Skyline MCP server: Taiwan-focused weather tools for any MCP client.

Tools
  find_location            place / postal code / district / airport code / coordinates -> lat, lon (+ Taiwan district)
  get_weather              current conditions, next hours and 7 days (Open-Meteo)
  get_air_quality          PM2.5, PM10, AQI now and over the next 24 h (Open-Meteo, CAMS)
  get_thunderstorm_risk    storm risk for the next 24 h from CAPE, rain chance and thunderstorm weather codes
  get_pm25_forecast_taichung  the team's next-day PM2.5/PM10 model (Skyline API on the hackathon box)

Run
  python3 skyline_mcp.py                    # stdio (Claude Desktop, Claude Code, Cursor, ...)
  python3 skyline_mcp.py --http --port 8790 # streamable HTTP at http://localhost:8790/mcp

No API keys are needed. SKYLINE_API overrides where the team model is called
(default https://veritas.premiersalesri.com).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from mcp.server.mcpserver import MCPServer

HERE = Path(__file__).resolve().parent
DISTRICTS: list[dict[str, Any]] = json.loads((HERE / "taiwan_districts.json").read_text(encoding="utf-8"))
SKYLINE_API = os.environ.get("SKYLINE_API", "https://veritas.premiersalesri.com").rstrip("/")
HEADERS = {"User-Agent": "skyline-mcp/0.1"}

# IATA -> (ICAO, name, lat, lon). Taiwan's airports plus the region's main hubs.
AIRPORTS: dict[str, tuple[str, str, float, float]] = {
    "TPE": ("RCTP", "Taoyuan International Airport", 25.0777, 121.2328),
    "TSA": ("RCSS", "Taipei Songshan Airport", 25.0694, 121.5525),
    "KHH": ("RCKH", "Kaohsiung International Airport", 22.5771, 120.3500),
    "RMQ": ("RCMQ", "Taichung International Airport", 24.2647, 120.6208),
    "TNN": ("RCNN", "Tainan Airport", 22.9504, 120.2057),
    "HUN": ("RCYU", "Hualien Airport", 24.0231, 121.6178),
    "TTT": ("RCFN", "Taitung Airport", 22.7550, 121.1018),
    "CYI": ("RCKU", "Chiayi Airport", 23.4618, 120.3928),
    "MZG": ("RCQC", "Penghu Magong Airport", 23.5687, 119.6282),
    "KNH": ("RCBS", "Kinmen Airport", 24.4279, 118.3592),
    "LZN": ("RCFG", "Matsu Nangan Airport", 26.1598, 119.9582),
    "MFK": ("RCMT", "Matsu Beigan Airport", 26.2242, 120.0028),
    "GNI": ("RCGI", "Green Island Airport", 22.6739, 121.4667),
    "KYD": ("RCLY", "Lanyu Airport", 22.0270, 121.5350),
    "HKG": ("VHHH", "Hong Kong International Airport", 22.3080, 113.9185),
    "NRT": ("RJAA", "Narita International Airport", 35.7720, 140.3929),
    "HND": ("RJTT", "Tokyo Haneda Airport", 35.5494, 139.7798),
    "KIX": ("RJBB", "Kansai International Airport", 34.4320, 135.2304),
    "OKA": ("ROAH", "Naha Airport", 26.1958, 127.6459),
    "ICN": ("RKSI", "Incheon International Airport", 37.4602, 126.4407),
    "PVG": ("ZSPD", "Shanghai Pudong International Airport", 31.1443, 121.8083),
    "SIN": ("WSSS", "Singapore Changi Airport", 1.3644, 103.9915),
    "BKK": ("VTBS", "Suvarnabhumi Airport", 13.6900, 100.7501),
    "MNL": ("RPLL", "Ninoy Aquino International Airport", 14.5086, 121.0194),
    "SFO": ("KSFO", "San Francisco International Airport", 37.6213, -122.3790),
    "LAX": ("KLAX", "Los Angeles International Airport", 33.9416, -118.4085),
    "JFK": ("KJFK", "John F. Kennedy International Airport", 40.6413, -73.7781),
    "LHR": ("EGLL", "London Heathrow Airport", 51.4700, -0.4543),
}
ICAO = {v[0]: k for k, v in AIRPORTS.items()}

WMO = {
    0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "freezing fog",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain",
    66: "freezing rain", 67: "heavy freezing rain", 71: "light snow", 73: "snow", 75: "heavy snow",
    80: "light showers", 81: "showers", 82: "violent showers", 95: "thunderstorm",
    96: "thunderstorm with hail", 99: "thunderstorm with heavy hail",
}

mcp = MCPServer(
    "skyline",
    instructions=(
        "Weather tools focused on Taiwan. Call find_location first to turn a place name, Taiwan postal code "
        "(e.g. 408), district (南屯區 / Nantun), airport code (TPE, RCTP) or coordinates into latitude and "
        "longitude, then pass those to the other tools. Say which source each number comes from."
    ),
)


# ---------- helpers ----------

def _fetch_json(url: str, params: dict[str, Any] | None = None) -> Any:
    full = url + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(full, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))


async def _get(url: str, params: dict[str, Any] | None = None) -> Any:
    try:
        return await asyncio.to_thread(_fetch_json, url, params)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{urllib.parse.urlparse(url).netloc} returned HTTP {e.code}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise RuntimeError(f"Couldn't reach {urllib.parse.urlparse(url).netloc}: {e}") from e


def _km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    r = math.pi / 180
    h = math.sin((b_lat - a_lat) * r / 2) ** 2 + math.cos(a_lat * r) * math.cos(b_lat * r) * math.sin((b_lon - a_lon) * r / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def _in_taiwan(lat: float, lon: float) -> bool:
    return 21.7 <= lat <= 26.5 and 118.0 <= lon <= 122.2


def _district_record(d: dict[str, Any]) -> dict[str, Any]:
    suffix = {"區": "District", "鄉": "Township", "鎮": "Township", "市": "City"}.get(d["zh"][-1], "")
    en = d["en"] if d["en"].endswith("District") else f"{d['en']} {suffix}".strip()
    return {"district": f"{en} ({d['zh']})", "city": f"{d['city_en']} ({d['city_zh']})", "postal_code": d["postal"]}


def _nearest_district(lat: float, lon: float) -> dict[str, Any] | None:
    """Nearest district centre. A centre-point match, so a spot near a boundary can land in the neighbour."""
    if not _in_taiwan(lat, lon):
        return None
    best = min(DISTRICTS, key=lambda d: _km(lat, lon, d["lat"], d["lon"]))
    return _district_record(best)


_COORD = re.compile(
    r"([+-]?\d+(?:\.\d+)?)\s*(?:°|º|d|deg)?\s*(?:(\d+(?:\.\d+)?)\s*(?:'|′|’|m)\s*)?"
    r"(?:(\d+(?:\.\d+)?)\s*(?:\"|″|”|''|s)\s*)?\s*([NSEWnsew])?"
)


def _parse_coords(q: str) -> tuple[float, float] | None:
    s = re.sub(r"\b(lat(itude)?|lon(gitude)?|lng)\b\s*[:=]?", " ", q, flags=re.I).strip()
    parts = [m for m in _COORD.finditer(s) if m.group(0).strip()]
    if len(parts) != 2 or re.sub(r"[\s,;/]+", "", _COORD.sub("", s)):
        return None
    vals = []
    for m in parts:
        v = abs(float(m.group(1))) + float(m.group(2) or 0) / 60 + float(m.group(3) or 0) / 3600
        neg = m.group(1).startswith("-") or (m.group(4) or "").upper() in ("S", "W")
        vals.append((-v if neg else v, (m.group(4) or "").upper()))
    (lat, h1), (lon, h2) = vals
    if h1 in ("E", "W") or h2 in ("N", "S"):
        lat, lon = lon, lat
    if abs(lat) > 90 or abs(lon) > 180:
        return None
    return lat, lon


def _norm(s: str) -> str:
    return re.sub(r"[\s'’\-]", "", s.lower().replace("臺", "台"))


# ---------- tools ----------

@mcp.tool()
async def find_location(query: str) -> list[dict[str, Any]]:
    """Turn what a user typed into coordinates.

    Accepts decimal or degree/minute/second coordinates ("24.14, 120.64", "23°58′N 121°36′E"),
    Taiwan 3-digit postal codes ("408" is 南屯區 Nantun District, Taichung; 5- or 6-digit codes use their
    first 3 digits), district names in English or Chinese ("Beitun", "北屯區"), IATA or ICAO airport codes
    ("TPE", "RCTP"), or any other place name (worldwide geocoder). Returns up to 8 candidates; inside Taiwan
    each one includes its district, city and postal code.
    """
    q = query.strip()
    coords = _parse_coords(q)
    if coords:
        lat, lon = coords
        return [{"name": f"{lat:.4f}, {lon:.4f}", "lat": lat, "lon": lon, "kind": "coordinates", **(_nearest_district(lat, lon) or {})}]

    m = re.match(r"^\s*(\d{3})(?:\d{2,3})?(?!\d)\s*(.*)$", q)
    if m:
        hits = [d for d in DISTRICTS if d["postal"] == m.group(1)]
        rest = _norm(m.group(2))
        if rest:
            narrowed = [d for d in hits if _norm(d["zh"]).rstrip("區鄉鎮市") in rest or _norm(d["en"]) in rest]
            hits = narrowed or hits
        if not hits:
            return [{"error": f"No Taiwan district has postal code {m.group(1)}."}]
        return [{"name": _district_record(d)["district"], "lat": d["lat"], "lon": d["lon"], "kind": "postal code", **_district_record(d)} for d in hits]

    code = q.upper()
    if re.fullmatch(r"[A-Z]{3}", code) and code in AIRPORTS or re.fullmatch(r"[A-Z]{4}", code) and code in ICAO:
        iata = code if code in AIRPORTS else ICAO[code]
        icao, name, lat, lon = AIRPORTS[iata]
        return [{"name": name, "iata": iata, "icao": icao, "lat": lat, "lon": lon, "kind": "airport", **(_nearest_district(lat, lon) or {})}]

    nq = _norm(q)
    if nq:
        scored = []
        for d in DISTRICTS:
            keys = [_norm(d["zh"]), _norm(d["zh"]).rstrip("區鄉鎮市"), _norm(d["en"]), _norm(d["city_zh"] + d["zh"])]
            if nq in keys:
                scored.append((0, d))
            elif any(k.startswith(nq) for k in keys if len(nq) >= 2):
                scored.append((1, d))
        if scored:
            scored.sort(key=lambda x: x[0])
            return [{"name": _district_record(d)["district"], "lat": d["lat"], "lon": d["lon"], "kind": "district", **_district_record(d)} for _, d in scored[:8]]

    data = await _get("https://geocoding-api.open-meteo.com/v1/search", {"name": q, "count": 8, "language": "en", "format": "json"})
    out = []
    for r in data.get("results", []) or []:
        lat, lon = r["latitude"], r["longitude"]
        out.append({"name": ", ".join(x for x in (r.get("name"), r.get("admin1"), r.get("country")) if x), "lat": lat, "lon": lon, "kind": "place", **(_nearest_district(lat, lon) or {})})
    return out or [{"error": f"Nothing found for {q!r}."}]


@mcp.tool()
async def get_weather(lat: float, lon: float, hours: int = 12) -> dict[str, Any]:
    """Current conditions, the next `hours` hours (1-48) and a 7-day outlook for a point.

    Source: Open-Meteo (blend of national weather models). Times are local to the point.
    """
    hours = max(1, min(48, hours))
    d = await _get("https://api.open-meteo.com/v1/forecast", {
        "latitude": lat, "longitude": lon, "timezone": "auto", "forecast_days": 7, "forecast_hours": hours,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m",
        "hourly": "temperature_2m,precipitation_probability,precipitation,weather_code,wind_gusts_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset",
    })
    c, h, dy = d.get("current", {}), d.get("hourly", {}), d.get("daily", {})
    return {
        "source": "Open-Meteo forecast API",
        "location": {"lat": lat, "lon": lon, "timezone": d.get("timezone"), **(_nearest_district(lat, lon) or {})},
        "current": {**c, "conditions": WMO.get(c.get("weather_code"), "unknown")},
        "units": d.get("current_units"),
        "next_hours": [
            {"time": t, "temp_c": h["temperature_2m"][i], "rain_chance_pct": h["precipitation_probability"][i],
             "rain_mm": h["precipitation"][i], "gusts_kmh": h["wind_gusts_10m"][i], "conditions": WMO.get(h["weather_code"][i], "unknown")}
            for i, t in enumerate(h.get("time", []))
        ],
        "next_7_days": [
            {"date": t, "conditions": WMO.get(dy["weather_code"][i], "unknown"), "min_c": dy["temperature_2m_min"][i], "max_c": dy["temperature_2m_max"][i],
             "rain_mm": dy["precipitation_sum"][i], "rain_chance_pct": dy["precipitation_probability_max"][i], "uv_max": dy["uv_index_max"][i],
             "sunrise": dy["sunrise"][i], "sunset": dy["sunset"][i]}
            for i, t in enumerate(dy.get("time", []))
        ],
    }


@mcp.tool()
async def get_air_quality(lat: float, lon: float) -> dict[str, Any]:
    """PM2.5, PM10, ozone, NO2 and US AQI now, plus hourly PM2.5 for the next 24 hours.

    Source: Open-Meteo air-quality API (Copernicus CAMS model estimates, not ground stations).
    For Taichung's next-day forecast from the team's model, use get_pm25_forecast_taichung.
    """
    d = await _get("https://air-quality-api.open-meteo.com/v1/air-quality", {
        "latitude": lat, "longitude": lon, "timezone": "auto", "forecast_hours": 24,
        "current": "pm2_5,pm10,ozone,nitrogen_dioxide,us_aqi",
        "hourly": "pm2_5,us_aqi",
    })
    h = d.get("hourly", {})
    return {
        "source": "Open-Meteo air quality (Copernicus CAMS)",
        "location": {"lat": lat, "lon": lon, **(_nearest_district(lat, lon) or {})},
        "current": d.get("current"), "units": d.get("current_units"),
        "next_24h": [{"time": t, "pm2_5": h["pm2_5"][i], "us_aqi": h["us_aqi"][i]} for i, t in enumerate(h.get("time", []))],
    }


@mcp.tool()
async def get_thunderstorm_risk(lat: float, lon: float) -> dict[str, Any]:
    """Thunderstorm risk over the next 24 hours: low, moderate, high or severe, with the hours of highest risk.

    Derived from Open-Meteo CAPE (storm energy), rain probability and thunderstorm weather codes (95, 96, 99).
    """
    d = await _get("https://api.open-meteo.com/v1/forecast", {
        "latitude": lat, "longitude": lon, "timezone": "auto", "forecast_hours": 24,
        "hourly": "cape,precipitation_probability,weather_code",
    })
    h = d.get("hourly", {})
    rows = []
    for i, t in enumerate(h.get("time", [])):
        cape, pop, code = h["cape"][i] or 0, h["precipitation_probability"][i] or 0, h["weather_code"][i]
        score = (3 if code in (96, 99) else 2 if code == 95 else 0) + (2 if cape >= 2500 else 1 if cape >= 1000 else 0) + (1 if pop >= 60 else 0)
        rows.append({"time": t, "cape_j_kg": cape, "rain_chance_pct": pop, "conditions": WMO.get(code, "unknown"), "score": score})
    top = max((r["score"] for r in rows), default=0)
    level = "severe" if top >= 5 else "high" if top >= 3 else "moderate" if top >= 2 else "low"
    return {
        "source": "Open-Meteo forecast (CAPE, rain probability, weather codes)",
        "location": {"lat": lat, "lon": lon, **(_nearest_district(lat, lon) or {})},
        "risk": level,
        "peak_hours": [r for r in rows if r["score"] == top and top > 0][:6],
        "max_cape_j_kg": max((r["cape_j_kg"] for r in rows), default=0),
    }


@mcp.tool()
async def get_pm25_forecast_taichung() -> dict[str, Any]:
    """Tomorrow's average PM2.5 and PM10 for Taichung from the Skyline team's own model.

    Includes the likely range, AQI and category, and a go / limit / indoors call for school PE.
    The model is a ridge regression on CAMS air-quality and ERA5 weather data (test error 4.46 µg/m³
    vs 5.91 for "tomorrow = today").
    """
    data = await _get(f"{SKYLINE_API}/api/predict")
    return {"source": f"Skyline team PM2.5 model ({SKYLINE_API}/api/predict)", **data}


def main() -> None:
    ap = argparse.ArgumentParser(description="Skyline MCP server")
    ap.add_argument("--http", action="store_true", help="serve streamable HTTP instead of stdio")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8790)
    args = ap.parse_args()
    if args.http:
        mcp.run("streamable-http", host=args.host, port=args.port)
    else:
        mcp.run()


if __name__ == "__main__":
    main()
