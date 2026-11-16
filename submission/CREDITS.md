# Credits and provenance

## Team contribution

The submitting team built the Taiwan landslide review workflow and integrated its teammate's Skyline app during the hackathon, as confirmed by the team. Skyline source was supplied from [KaloriesW/special-octo-enigma](https://github.com/KaloriesW/special-octo-enigma). The public submission should include the final integrated code, not just a link to an older/private copy. Team names, schools and emails belong in the submission form; they have not been invented in these materials.

## Data

- [Taiwan Ministry of Agriculture: 112年度全臺崩塌地圖層 (2023)](https://data.gov.tw/dataset/168661): satellite-interpreted inventory labels for local adaptation. Taiwan Open Government Data License v1.0. Image dates are not confirmed event dates. Labels were modified into masks with uncertain/cloudy pixels excluded.
- [Sentinel-2 L2A COGs](https://registry.opendata.aws/sentinel-2-l2a-cogs/) and [Element 84 Earth Search](https://earth-search.aws.element84.com/v1): free multispectral imagery and catalogue. Contains modified Copernicus Sentinel data.
- [Copernicus DEM](https://registry.opendata.aws/copernicus-dem/): elevation and derived slope; contains modified Copernicus DEM data.
- [Landslide4Sense](https://github.com/iarai/Landslide4Sense-2022), [Zenodo dataset](https://zenodo.org/records/10463239), [Hugging Face mirror](https://huggingface.co/datasets/ibm-nasa-geospatial/Landslide4sense): earlier multispectral segmentation training and comparison. The Taiwan checkpoint was initialized from our earlier experiment, not trained from scratch. Benchmark geographic overlap with Taiwan fine-tuning data is not established.
- [LMHLD](https://zenodo.org/records/17258777): original high-resolution Taiwan RGB YOLO experiments. Those checkpoints are not included in this final U-Net release.
- [OpenStreetMap](https://www.openstreetmap.org/copyright) and [Overpass API](https://overpass-api.de/): roads and basemap; © OpenStreetMap contributors, ODbL. Road geometry does not establish road condition.
- [MET Norway Locationforecast](https://api.met.no/weatherapi/locationforecast/2.0/documentation): map/scan rainfall context, CC BY 4.0; [MET Norway](https://www.met.no/).
- [Open-Meteo weather](https://open-meteo.com/en/docs), [historical weather / ERA5](https://open-meteo.com/en/docs/historical-weather-api) and [air quality / CAMS](https://open-meteo.com/en/docs/air-quality-api): Skyline weather and air-quality inputs. CAMS is modelled air quality, not local station truth.
- [Taiwan Central Weather Administration](https://www.cwa.gov.tw/) and [CWA open data](https://opendata.cwa.gov.tw/): typhoon information.
- [Windy](https://www.windy.com/): optional embedded weather view, with its original attribution and controls.

## Models and software

- [Segmentation Models PyTorch](https://github.com/qubvel-org/segmentation_models.pytorch): U-Net implementation; [PyTorch](https://pytorch.org/), [torchvision](https://github.com/pytorch/vision), [timm](https://github.com/huggingface/pytorch-image-models) and the ResNet architecture/pretraining ecosystem. The retained U-Net uses the team's earlier trained initialization; the supplied checkpoint loads without fetching pretrained weights.
- [Ultralytics YOLO11](https://docs.ultralytics.com/models/yolo11/): earlier baselines and optional backend code; subject to its own licensing terms. No YOLO training results are relabelled as U-Net results.
- [Qwen](https://github.com/QwenLM) and [Ollama](https://ollama.com/): pretrained language model and local serving. Development configuration: local alias `qwen3.5:9b-mlx`. This alias is not a hosted public artifact or evidence of team language-model training. A documented portable option is [qwen3:8b](https://ollama.com/library/qwen3:8b), with quality/performance not asserted equivalent. Qwen weights are not bundled.
- [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/), [Pydantic](https://docs.pydantic.dev/), [HTTPX](https://www.python-httpx.org/) and [Requests](https://requests.readthedocs.io/): application/API stack.
- [Rasterio](https://rasterio.readthedocs.io/), [Shapely](https://shapely.readthedocs.io/), [NumPy](https://numpy.org/), [Pillow](https://python-pillow.org/), [Leaflet](https://leafletjs.com/): imagery processing, geometry and map presentation.
- [scikit-learn](https://scikit-learn.org/) and [pandas](https://pandas.pydata.org/): Skyline air-model training/evaluation. Its exported models use the supplied plain-Python inference implementation.
- [OpenAI Codex](https://openai.com/codex/): AI-assisted coding, debugging, tests, data preparation, interface integration and submission-document drafting. The team must understand and verify the submitted work.
- [ReportLab](https://www.reportlab.com/) and [Poppler](https://poppler.freedesktop.org/): submission PDF creation and rendering.

Upstream notices and licenses remain applicable. This credit list does not relicense third-party datasets, libraries, model weights or embedded services. No blanket license has been asserted for the team's combined submission. See `MANIFEST.json` for the distributed files and hashes.

- National scan planning boundaries: [g0v/twgeojson](https://github.com/g0v/twgeojson), CC0 1.0, historic 2010 county GeoJSON; simplified and clipped to 118–122.1°E / 21.8–26.5°N. Approximate planning coverage, not authoritative legal boundaries. [Source data](https://github.com/g0v/twgeojson/blob/master/json/twCounty2010.geo.json).
- National weather context: [MET Norway Locationforecast](https://api.met.no/doc/ForecastJSON), CC BY 4.0; ECMWF regional forecast samples. Experimental priority thresholds are project heuristics, not official CWA thresholds.
