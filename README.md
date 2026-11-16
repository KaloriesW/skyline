# Skyline / TerrainWatch

**Taiwan landslide review, weather and air quality — Veritas AI Hackathon 2026, Climate track.**

This is our **hackathon submission repository**. Run the integrated application in **[submission/](submission/)**; that folder contains the trained checkpoint, source code, setup instructions, evaluation evidence and submission documents.

![TerrainWatch](submission/docs/workspace.jpg)

## What it does

- **Review suspected landslides across Taiwan:** scan Sentinel-2 imagery with our retained multispectral U-Net and inspect mapped candidate polygons.
- **Investigate each candidate:** compare before/after vegetation, slope and nearby roads, with close-up buttons for areas recommended for review.
- **Ask follow-up questions:** Qwen uses the current scan, weather, air-quality and monitoring context.
- **Monitor new imagery:** selected-area checks and hourly reports, plus an optional resumable whole-Taiwan queue with rainfall-informed review priorities.
- **View weather and air quality:** Skyline's interface includes city weather and trained forecasts of tomorrow's daily-average **PM2.5 and PM10**.

Monitoring starts only when enabled. The whole-Taiwan mode has not completed a full national live pass; its estimated initial run is **29–79 hours** on the development Mac. Rainfall-informed ranking is experimental review guidance, not a validated prediction of slope failure.

## Run the final version

```bash
cd submission
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python check_setup.py --inference
python run.py
```

Open http://127.0.0.1:8765/skyline/ for the home workspace or http://127.0.0.1:8765/terrain/ for the landslide map. Tested on macOS Apple Silicon with Python 3.14.4. See the [complete setup, optional Qwen configuration and limitations](submission/README.md).

## Validation

The integrated merge passed **256 Python tests and 15 JavaScript tests**, plus the setup check and actual U-Net inference. Three optional Python checks were skipped. The subsequent teammate updates changed layout/CSS and asset versions; the app JavaScript syntax check passed. These checks verify software behavior, not live landslide accuracy.

## Submission documents

- [One-page write-up](submission/one-page-writeup.pdf)
- [Demo script and recording instructions](submission/two-minute-demo-script.txt)
- [Model results and limitations](submission/MODEL_CARD.md)
- [Historical YOLO training curves, metrics and threshold experiments](submission/evidence/yolo/README.md)
- [Data, model and AI-tool credits](submission/CREDITS.md)
- [Final readiness audit](submission/evidence/final-readiness.json)
- [Submission checklist and judge access](submission/GITHUB_SUBMISSION.md)
- [Validation evidence](submission/evidence/)

The retained U-Net achieved 54.27% pixel IoU and 70.36% Dice on a small, repeatedly consulted development holdout. Live Taiwan accuracy remains unmeasured. Detected regions are **suspected landslides**, not confirmed hazards or validated predictions of slope failure.

The original teammate source remains in `ui/`. The integrated release uses its tested bundled Skyline snapshot in `submission/skyline/`. The integrated frontend includes the teammate’s ui-glass update while keeping landslide review as the focus. Demo scans and simulated-weather controls are excluded.

Before submitting, ensure judges can access the repository; this branch upload does not change its visibility.
