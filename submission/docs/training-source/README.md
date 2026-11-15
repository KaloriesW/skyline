# Historical training source

These are the actual scripts used for the Taiwan pilot pipeline and its common
training/data preparation functions, provided for code review. They retain the
original experiment directory layout and references to earlier checkpoints.
They are **not** the portable app launcher or a self-contained retraining kit.
The full training data and earlier experiment checkpoints are not bundled.
Run the root README setup to reproduce application inference; use the recorded
config/history/comparison and the bundled smoke test to inspect the retained
model. The smoke test checks installation, not independent accuracy.
