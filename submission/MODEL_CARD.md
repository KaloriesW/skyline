# Retained Taiwan U-Net model

- Architecture: ResNet34 U-Net; 13 inputs; 128-pixel windows; stride 96.
- Inputs: B1, B2, B3, B4, B5, B6, B7, B8, B9, B11, B12, slope and elevation. B10 is not a physical Sentinel-2 L2A input; B8A is not substituted.
- Source: Taiwan inventory adaptation run `20261115-143739`, best epoch 5.
- Frozen threshold: 0.024, selected on pilot validation. It is not a calibrated hazard probability.
- Frozen normalization: `models/unet13.json`; fitted on training-labelled pixels only.
- Checkpoint SHA-256: `752989d5b2555dad4b26946ae34b3c31d6cfae97de873ad4d69aa4bf588daf8c`.
- Earlier initialization: the team's 14-channel Landslide4Sense experiment, with the B10 kernel removed for 13-channel physical L2A transfer. It was not a fresh random initialization.
- Training settings: AdamW, learning rate 0.0001, weight decay 0.0001, batch 8, BCE positive weight 3 plus Dice, rotations/flips, seed 2023. See the recorded config/history for the actual completed run.

## Historical evaluation

24 patches in three geographically separated test regions, 287,516 valid evaluated pixels. Unknown/cloudy/boundary pixels are excluded. Production inference reproduced TP=3290, FP=2005, FN=767, TN=281454: IoU 54.27%, Dice 70.36%, precision 62.13%, recall 81.09%. The frozen transferred comparator had IoU 43.15% on the same holdout. Validation IoU was 42.47%. Macro region IoU was 44.78%.

These patches were repeatedly compared during development. The holdout should not be described as a new untouched evaluation. Inventory-derived background can miss small/unmapped landslides; the source mapping limit is 0.1 hectare. Data are positive-enriched, and prior benchmark exposure to the geographic areas is unknown. A good-looking outline does not establish a true landslide. See `evidence/error-examples.png` for actual evaluation failures.

## Intended use and non-use

Use for experimental image screening and human review. Do not use as an evacuation alert, a confirmed disaster map, a road closure detector or a probability of future slope failure. Coordinates inherit satellite/grid uncertainty. Cloud/missing pixels are unassessed. Image resampling does not create native 10 m information in coarser bands. The map discards polygons smaller than 400 m², while raster masks retain the full thresholded segmentation.

The bundled smoke fixture is one previously evaluated Taiwan patch, used only to detect setup/preprocessing regressions. It is not an additional accuracy test. Live 2026 scenes were checked for pipeline consistency, not independently annotated accuracy.
