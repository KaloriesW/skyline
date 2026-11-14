# Skyline: Taichung weather and tomorrow's air

**Track:** Climate
**Team:** _TODO: names_
**Live demo:** https://veritas.premiersalesri.com (runs on the hackathon box)

## The problem

Fine-particle (PM2.5) pollution is a real problem in Taichung, especially from autumn to spring. Schools decide each morning whether PE and sports practice happen outside, but the official air-quality numbers describe *right now*, not tomorrow. Teachers and coaches need to know a day ahead so they can plan indoor PE and warn students with asthma.

## What we built

A weather app for Taichung in the style of Apple's macOS Weather, with its own AI forecast of tomorrow's air.

- **In:** the last two days of PM2.5/PM10 for Taichung, today's weather, and tomorrow's weather forecast.
- **Out:** tomorrow's average PM2.5 and PM10 (with a likely range), the AQI and category they imply, and a go / limit / indoors call for school PE.
- The dashboard also shows live weather and air quality: hourly and 10-day forecasts, AQI, PM2.5, PM10, pollutants, wind, UV, sunrise, pressure, visibility, a live Windy map, and more.
- The **+** button (top right) opens a widget gallery. Add or remove any widget, press **···** (or long-press a tile) to drag widgets into a new order. The layout is saved in the browser.
- The sky behind the dashboard is animated to match the weather (rain, storm with lightning, clouds, stars, sun glare, fog). A haze layer gets stronger as PM2.5 rises. Add `?mood=storm` (or `clear-day`, `clear-night`, `cloudy-day`, `fog`, `dusk`...) to the URL to preview a mood.
- Tapping the gold “Tomorrow” widgets opens the model report: test scores, a chart of the test year, error by month, and the biggest misses.

## What we added

We started from the suggested project “Next-day air quality forecast” (4.3.2) and added:

- **Our own user and setting:** Taichung schools deciding about outdoor PE, with the forecast turned into a go / limit / indoors decision.
- **Our own question:** how much does tomorrow's weather forecast help? (Removing it raises the error from 4.46 to 5.43 µg/m³.)
- **A real app** that runs the model live every day, not just a notebook.

## How it works

**Data.** Hourly PM2.5 and PM10 for Taichung (24.15°N, 120.67°E) from the Copernicus CAMS global model via the Open-Meteo air-quality API, August 2022 to November 2026. Hourly weather from ERA5 via the Open-Meteo archive API. Both are averaged into daily values (days with fewer than 20 hours of data are dropped).

**Model.** One regression model per pollutant predicts tomorrow's daily average from 25 features:
- today's PM2.5 (average, peak, evening level), PM10, and yesterday's averages
- today's weather: temperature, humidity, rain, wind speed, wind direction (as east/north components), pressure, mixing-layer height
- the same weather variables for tomorrow (from the forecast when running live)
- season (day of year) and whether tomorrow is a weekend

We tried a linear model (Ridge regression with standardised inputs) and gradient-boosted trees (scikit-learn `HistGradientBoostingRegressor`). We picked the model on a validation slice (the last 180 days of the training period), never on the test set. Ridge won for both pollutants.

**Testing.** The split is by time, with no shuffling. Training covers 2022-08-06 to 2025-11-05 (1,006 days). Testing covers the following 365 days, 2025-11-07 to 2026-11-06, which the model never saw. A one-day gap keeps any training target from overlapping a test input. For the live app the model is then refit on every day.

Code: [`backend/train.py`](backend/train.py) (training and evaluation), [`backend/airmodel.py`](backend/airmodel.py) (features, AQI, advice), [`backend/server.py`](backend/server.py) (API), [`static/`](static) (frontend).

## Results

Mean absolute error on the 365-day test year (µg/m³, lower is better):

| Model | PM2.5 | PM10 |
|---|---|---|
| Baseline: tomorrow = today | 5.91 | 6.05 |
| **Ridge regression (chosen)** | **4.46** | **4.87** |
| Gradient-boosted trees | 4.60 | 5.16 |
| Boosted trees, no weather forecast | 5.43 | 5.59 |

Our baseline scored 5.91 µg/m³. Our model scored 4.46 µg/m³ on held-out test data, which is **25% less error**. It beat the baseline in all 13 test months.

**Bad-air warnings (daily PM2.5 above 35 µg/m³):** of 143 bad days in the test year, the baseline warned for 109 with 34 false alarms. Our model warned for 96 with 15 false alarms. The model is more precise (86% vs 76%) but misses more bad days (recall 67% vs 76%). For a school, a missed warning is worse than a false alarm, so we should lower the warning threshold (see next steps).

**Where it fails.** The five biggest misses are listed in the app. Four of them are sudden spikes the model under-predicted. For example, on 2026-04-16 the actual value was 59.9 µg/m³ and the model said 39.0. We think this happens because the model only knows Taichung's own weather and today's level, so pollution blown in from elsewhere, or a sudden stagnant day, surprises it. Two of the misses had rain in the forecast, so the model may expect rain to clean the air more than it does. We haven't tested that yet.

**Honest caveats.**
- The PM2.5/PM10 values are **model estimates (CAMS), not ground measurements**. They put 143 of 365 test days above 35 µg/m³ (test-year mean 32 µg/m³), which looks high for Taichung. Also, the CAMS PM10 values are almost equal to PM2.5, which is unusual, since PM10 includes PM2.5. The absolute numbers need checking against official station data.
- In training we used the weather that actually happened as “tomorrow's forecast”. Live, the model gets a real forecast, which has errors, so live accuracy will be a bit worse than the test score.
- The AQI uses the US EPA 2024 breakpoints with PM2.5 and PM10 only (no ozone), not Taiwan's official AQI formula.

## What we'd do next

1. Retrain and test on official Ministry of Environment (MOENV) station measurements, for example the Zhongming (忠明) station. The app already shows the live Zhongming reading when a `MOENV_API_KEY` is put in `skyline/.env`, and use CWA forecasts for the weather inputs.
2. Tune the bad-air warning threshold on the validation set so that the model catches at least as many bad days as the baseline, and add wind-direction and upwind-pollution features to catch the spikes.

## Running it

On the hackathon box:

```bash
cd ~/skyline
pip install -r requirements.txt
cd backend && python train.py && cd ..   # retrain (about 10 seconds), writes backend/model/
./run.sh                                  # serves on port 8000 (stops the starter app)
```

`run.sh` takes over port 8000, the box's only public port. To go back to the starter app, run `restart-app`, which only works after you stop Skyline with `pkill -u kids -f 'uvicorn server:app'`.

## Sources

- [Open-Meteo](https://open-meteo.com): forecast API, air-quality API (Copernicus CAMS global), historical weather API (ERA5). CC BY 4.0.
- [Copernicus Atmosphere Monitoring Service (CAMS)](https://atmosphere.copernicus.eu): air-quality model data.
- [ERA5 reanalysis](https://cds.climate.copernicus.eu): historical weather.
- [Windy.com embed](https://www.windy.com): live map widget.
- [Taiwan MOENV open data](https://data.moenv.gov.tw) (optional, needs an API key): Zhongming station readings.
- US EPA AQI breakpoints (2024 PM2.5 revision).
- Libraries: FastAPI, uvicorn, httpx, pandas, NumPy, scikit-learn, joblib.
- Design inspired by Apple's macOS Weather app. Fonts: system font, with [Inter](https://fonts.google.com/specimen/Inter) as a fallback.
- AI tools: Claude Code (Anthropic) helped write the code and this write-up.
