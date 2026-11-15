"""Skyline API + static frontend. Run: uvicorn server:app --host 0.0.0.0 --port 8000"""
import os
import time
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import sources
from airmodel import AirModel, aqi, category, daily_table

ROOT = Path(__file__).resolve().parent.parent
env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

app = FastAPI(title="Skyline", docs_url="/api/docs", openapi_url="/api/openapi.json")
model = AirModel()
_pred_cache: dict = {}


@app.get("/api/weather")
def weather():
    try:
        out = {"weather": sources.weather(), "air": sources.air()}
    except Exception as e:  # upstream outage: tell the UI instead of a 500 page
        raise HTTPException(502, f"Weather source unavailable: {e}")
    try:
        out["station"] = sources.moenv_station()
    except Exception:
        out["station"] = None
    return out


@app.get("/api/predict")
def predict():
    hit = _pred_cache.get("p")
    if hit and time.time() - hit[0] < 1800:
        return hit[1]
    try:
        aq, wx, up = sources.model_inputs()
    except Exception as e:
        raise HTTPException(502, f"Weather source unavailable: {e}")
    d = daily_table(aq, wx)
    today = pd.Timestamp.now(tz=sources.TZ).normalize().tz_localize(None)
    result = model.predict(d, up, today)
    result["model"] = {
        "kind": model.metrics["chosen"]["pm25"],
        "test_mae": round(model.metrics["results"]["pm25"][model.metrics["chosen"]["pm25"]]["mae"], 2),
        "baseline_mae": round(model.metrics["results"]["pm25"]["baseline"]["mae"], 2),
    }
    _pred_cache["p"] = (time.time(), result)
    return result


@app.get("/api/model")
def model_report():
    return model.metrics


@app.get("/api/aqi")
def aqi_calc(pm25: float, pm10: float):
    a = aqi(pm25, pm10)
    return {"aqi": a, "category": category(a)[0]}


app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/")
def index():
    return FileResponse(ROOT / "static" / "index.html")
