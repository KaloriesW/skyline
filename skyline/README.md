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
- **Our own questions:** how much does tomorrow's weather forecast help? (Removing it raises the error from 4.38 to 5.12 µg/m³.) And does pollution upwind of Taichung help? (A little: see Results.)
- **A warning tuned for schools:** a missed bad-air day is worse than a false alarm, so the warning threshold is tuned for that.
- **A real app** that runs the model live every day, not just a notebook.

## How it works

**Data.** Hourly PM2.5 and PM10 for Taichung (24.15°N, 120.67°E) from the Copernicus CAMS global model via the Open-Meteo air-quality API, August 2022 to November 2026. Hourly weather from ERA5 via the Open-Meteo archive API. Both are averaged into daily values (days with fewer than 20 hours of data are dropped).

**Model.** One regression model per pollutant predicts tomorrow's daily average. The first version (v1) used 25 features:
- today's PM2.5 (average, peak, evening level), PM10, and yesterday's averages
- today's weather: temperature, humidity, rain, wind speed, wind direction (as east/north components), pressure, mixing-layer height
- the same weather variables for tomorrow (from the forecast when running live)
- season (day of year) and whether tomorrow is a weekend

Version 2 adds 8 more: 3- and 7-day PM2.5 averages, the day-to-day change, today's PM2.5 at four upwind points (Taoyuan, the Fujian coast, the Changhua/Yunlin coast, Kaohsiung; also CAMS), and "north push" (the northern PM2.5 times tomorrow's north wind).

We compared v1 with three models on the 33 features: Ridge regression, gradient-boosted trees (scikit-learn `HistGradientBoostingRegressor`), and a blend that averages the two. The models are trained from scratch on our data, in about 20 seconds on the hackathon box. [`backend/tune.py`](backend/tune.py) holds the wider search we ran first (Ridge strengths, tree settings, a log target, three feature sets).

**Choosing without peeking.** v1 was picked on one validation slice, the last 180 training days. That slice was mostly summer, when the air is clean, which is a bad way to choose a model for winter smog. Version 2 uses rolling-origin cross-validation: four 91-day folds covering the last training year (2024-11-08 to 2025-11-06), each trained only on days before it. Cross-validation picked the **blend for PM2.5** and **kept v1 for PM10**, because the extra features didn't help PM10 in cross-validation.

**Testing.** The split is by time, with no shuffling. Training covers 2022-08-11 to 2025-11-06 (1,002 days). Testing covers the following 365 days, 2025-11-08 to 2026-11-07, which no model saw during any choice. A one-day gap keeps any training target from overlapping a test input. For the live app the chosen models are then refit on every day.

Code: [`backend/train.py`](backend/train.py) (training and evaluation), [`backend/airmodel.py`](backend/airmodel.py) (features, AQI, advice), [`backend/server.py`](backend/server.py) (API), [`static/`](static) (frontend).

## Results

Mean absolute error on the 365-day test year (µg/m³, lower is better):

| Model | CV PM2.5 | Test PM2.5 | CV PM10 | Test PM10 |
|---|---|---|---|---|
| Baseline: tomorrow = today | 6.48 | 5.91 | 6.66 | 6.04 |
| v1: Ridge, 25 features | 5.11 | 4.45 | **5.18** | **4.86** (chosen) |
| Ridge + upwind features | 4.80 | 4.32 | 5.46 | 4.74 |
| Boosted trees + upwind features | 5.07 | 4.79 | 7.77 | 5.33 |
| **Blend + upwind features** | **4.75** | **4.38** (chosen) | 6.07 | 4.69 |
| Blend, no weather forecast | | 5.12 | | 5.28 |

Our baseline scored 5.91 µg/m³. Our model scored 4.38 µg/m³ on held-out test data, which is **26% less error**.

The honest part: in cross-validation the new PM2.5 model looked 7% better than v1 (4.75 vs 5.11). On the test year it is only 1.6% better (4.38 vs 4.45). Most of the gain did not carry over. The plain Ridge with upwind features did slightly better on the test year (4.32), and for PM10 the blend would have beaten v1, but we stuck with what cross-validation chose, because picking by test score would make the test score meaningless.

**Bad-air warnings (daily PM2.5 above 35 µg/m³).** The test year had 143 bad days.

| Warning rule | Bad days caught | False alarms |
|---|---|---|
| Baseline: warn if today > 35 | 109 (76%) | 34 |
| Our model, warn if forecast > 35 | 98 (69%) | 19 |
| **Our model, warn if forecast > 28.5 (tuned)** | **139 (97%)** | **91** |

The threshold was tuned on the cross-validation folds with the F2 score, which counts a missed bad day twice as much as a false alarm. Our first tuning rule was "catch as many bad days as the baseline", but it left the threshold at 35, so we switched to F2 after seeing that, and we're saying so here. The tuned warning almost never misses a bad day, at the cost of about one false alarm every four days. Whether that trade-off is right for a school is a decision for the people using it, and it is a single number to change.

**Where it fails.** The five biggest misses are listed in the app. Three are sudden spikes the model under-predicted; for example, on 2026-04-16 the actual value was 59.9 µg/m³ and the model said 35.8. Two are days that cleared up faster than expected. Upwind pollution helped a little, but the model only sees daily averages at four points, so a sudden stagnant day or a short burst of polluted air still surprises it. Two of the under-predicted days had rain in the forecast, so the model may expect rain to clean the air more than it does. We haven't tested that yet.

**Honest caveats.**
- The PM2.5/PM10 values are **model estimates (CAMS), not ground measurements**. They put 143 of 365 test days above 35 µg/m³ (test-year mean 32 µg/m³), which looks high for Taichung. Also, the CAMS PM10 values are almost equal to PM2.5, which is unusual, since PM10 includes PM2.5. The absolute numbers need checking against official station data.
- In training we used the weather that actually happened as “tomorrow's forecast”. Live, the model gets a real forecast, which has errors, so live accuracy will be a bit worse than the test score.
- The AQI uses the US EPA 2024 breakpoints with PM2.5 and PM10 only (no ozone), not Taiwan's official AQI formula.

## What we'd do next

1. Retrain and test on official Ministry of Environment (MOENV) station measurements, for example the Zhongming (忠明) station. The app already shows the live Zhongming reading when a `MOENV_API_KEY` is put in `skyline/.env`, and use CWA forecasts for the weather inputs.
2. Use hourly upwind data and back-trajectories (where tomorrow's air is coming from) instead of daily averages at four fixed points, to catch the spikes.

## Running it

On the hackathon box:

```bash
cd ~/skyline
pip install -r requirements.txt
cd backend && python train.py && cd ..   # retrain (about 20 seconds), writes backend/model/
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
