"""Shared, dependency-free helpers for Skyline's typhoon and landslide sources.

Used by both the MCP server (skyline_mcp.py, urllib) and the HTTP extras router
(ui/server/skyline_extras.py, httpx), so the two always read the same upstream the same way.
Standard library only.

Typhoon source
  CWA open data, dataset W-C0034-005 「颱風消息與警報-熱帶氣旋路徑」 (tropical cyclone track:
  past/current fixes and the forecast for every active cyclone in the NW Pacific / South China Sea).
  Fetched as the JSON file through CWA's file API, which needs a member key (CWA_API_KEY):
    https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/W-C0034-005?Authorization=<key>&downloadType=WEB&format=JSON
  CWA_TYPHOON_URL overrides the URL (then no key is sent). CWA also publishes the same file, key-less,
  in its AWS Open Data bucket: https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Warning/W-C0034-005.json

Landslide source
  There is no team landslide API yet. LANDSLIDE_API_URL, when set, is called as GET <url>?lat=&lon=.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

CWA_TYPHOON_DATASET = "W-C0034-005"
CWA_FILE_API = "https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/" + CWA_TYPHOON_DATASET
TYPHOON_SOURCE = "CWA open data " + CWA_TYPHOON_DATASET + " (tropical cyclone track)"
TYPHOON_NOT_CONFIGURED = "typhoon data not configured: set CWA_API_KEY (CWA open data member key)"
LANDSLIDE_NOT_CONNECTED = "landslide model not connected"
TAIPEI_TZ = timezone(timedelta(hours=8))


def cwa_key() -> str:
    return os.environ.get("CWA_API_KEY", "").strip()


def typhoon_request() -> tuple[str, dict[str, str]] | None:
    """(url, query params) for the typhoon file, or None when nothing is configured."""
    override = os.environ.get("CWA_TYPHOON_URL", "").strip()
    if override:
        return override, {}
    key = cwa_key()
    if not key:
        return None
    return CWA_FILE_API, {"Authorization": key, "downloadType": "WEB", "format": "JSON"}


def typhoon_stale_hours() -> float:
    try:
        return float(os.environ.get("TYPHOON_STALE_HOURS", "12"))
    except ValueError:
        return 12.0


def landslide_url() -> str:
    return os.environ.get("LANDSLIDE_API_URL", "").strip()


# ---------- CWA W-C0034-005 parsing ----------

def _ci(d: Any, *names: str) -> Any:
    """Case-insensitive dict lookup; first name that exists wins."""
    if not isinstance(d, dict):
        return None
    low = {str(k).lower(): v for k, v in d.items()}
    for n in names:
        if n.lower() in low:
            return low[n.lower()]
    return None


def _find(d: Any, name: str, depth: int = 0) -> Any:
    """Find a key anywhere in the first few levels (the root differs between CWA's file and REST APIs)."""
    if depth > 5 or not isinstance(d, dict):
        return None
    hit = _ci(d, name)
    if hit is not None:
        return hit
    for v in d.values():
        hit = _find(v, name, depth + 1)
        if hit is not None:
            return hit
    return None


def _as_list(x: Any) -> list[Any]:
    """XML-to-JSON gives a dict for one element and a list for several."""
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def _num(x: Any) -> float | None:
    if isinstance(x, dict):
        x = x.get("#text")
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _time(s: Any) -> datetime | None:
    if not isinstance(s, str) or not s:
        return None
    try:
        t = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=TAIPEI_TZ)


def _latlon(fix: dict[str, Any]) -> tuple[float | None, float | None]:
    lat, lon = _num(_ci(fix, "CoordinateLatitude")), _num(_ci(fix, "CoordinateLongitude"))
    if lat is None or lon is None:
        # Older layout of this dataset: "coordinate": "<lon>,<lat>"
        c = _ci(fix, "coordinate")
        if isinstance(c, str) and "," in c:
            a, b = c.split(",", 1)
            lon, lat = _num(a), _num(b)
    return lat, lon


def _point(fix: dict[str, Any], when: datetime, forecast: bool) -> dict[str, Any] | None:
    lat, lon = _latlon(fix)
    if lat is None or lon is None:
        return None
    return {
        "time": when.isoformat(),
        "lat": lat,
        "lon": lon,
        "wind_ms": _num(_ci(fix, "MaxWindSpeed")),        # 近中心最大風速, m/s
        "pressure_hpa": _num(_ci(fix, "Pressure")),       # 中心氣壓, hPa
        "forecast": forecast,
    }


def parse_cwa_typhoon(doc: Any, now: datetime | None = None, stale_hours: float | None = None) -> dict[str, Any]:
    """CWA W-C0034-005 JSON -> {active, storms: [{name, name_zh, track: [...]}], source, updated}.

    CWA leaves the last bulletin in place after a cyclone dissipates, so a storm only counts as active
    while its newest analysis fix is at most `stale_hours` old (CWA updates every 6 h, 3 h under warning).
    Values are passed through as published: wind in m/s, pressure in hPa, times with their UTC offset.
    A forecast point's time is its InitialTime plus ForecastHour.
    """
    now = now or datetime.now(timezone.utc)
    stale = timedelta(hours=typhoon_stale_hours() if stale_hours is None else stale_hours)
    root = doc if isinstance(doc, dict) else {}
    cyclones = _as_list(_ci(_find(root, "TropicalCyclones"), "TropicalCyclone"))

    storms = []
    for tc in cyclones:
        if not isinstance(tc, dict):
            continue
        track: list[dict[str, Any]] = []
        last_fix: datetime | None = None
        for fix in _as_list(_ci(_ci(tc, "AnalysisData"), "Fix")):
            when = _time(_ci(fix, "DateTime", "fixTime"))
            if when is None:
                continue
            p = _point(fix, when, False)
            if p:
                track.append(p)
                last_fix = when if last_fix is None or when > last_fix else last_fix
        for fix in _as_list(_ci(_ci(tc, "ForecastData"), "Fix")):
            init, hours = _time(_ci(fix, "InitialTime", "initTime")), _num(_ci(fix, "ForecastHour", "ForecastHr", "tau"))
            if init is None or hours is None:
                continue
            p = _point(fix, init + timedelta(hours=hours), True)
            if p:
                track.append(p)
        if last_fix is None or now - last_fix > stale:
            continue
        track.sort(key=lambda p: (p["forecast"], _time(p["time"]) or now))
        td_no = _ci(tc, "CwaTdNo")
        name = _ci(tc, "TyphoonName") or (f"TD-{td_no}" if td_no else "Tropical depression")
        storms.append({
            "name": name,
            "name_zh": _ci(tc, "CwaTyphoonName") or "熱帶性低氣壓",
            "track": track,
        })

    return {
        "active": bool(storms),
        "storms": storms,
        "source": TYPHOON_SOURCE,
        "updated": _find(root, "Sent") if isinstance(_find(root, "Sent"), str) else None,
    }
