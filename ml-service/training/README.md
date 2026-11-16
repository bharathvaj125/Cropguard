# Training

Scripts that produce the models in `../models/`:

- `pest_groups.py`: how the 102 IP102 species are merged into 25 pest groups
- `prepare_data.py`: turns the raw datasets into train / val / test manifests
- `train.py`: fine-tunes MobileNetV3-Large, calibrates it, evaluates on the test split and exports ONNX

Data sources, the full method, results, limitations and the exact commands are in
[docs/ML_MODEL.md](../../docs/ML_MODEL.md#retrain).
