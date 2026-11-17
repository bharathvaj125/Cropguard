"""ONNX Runtime wrappers around the exported classifiers.

PyTorch is only used for training. Serving needs just onnxruntime and numpy, which keeps
the container small enough for a low-cost cloud instance.
"""

from __future__ import annotations

import base64
import io
import json
import os
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from .preprocessing import INPUT_SIZE, to_tensor

# Smallest drop in logit margin that counts as "the model needed this region".
MIN_HEATMAP_DROP = 0.25

MODELS_DIR = Path(os.environ.get("MODELS_DIR", Path(__file__).resolve().parent.parent / "models"))


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


class Classifier:
    """One exported model: model.onnx + labels.json + metrics.json in a folder."""

    def __init__(self, name: str, folder: Path):
        self.name = name
        self.labels: list[str] = json.loads((folder / "labels.json").read_text(encoding="utf-8"))
        self.metrics: dict = json.loads((folder / "metrics.json").read_text(encoding="utf-8"))
        # Fitted on the validation set during training so that reported confidence
        # matches how often the model is actually right.
        self.temperature: float = float(self.metrics.get("temperature", 1.0))
        self.version: str = f"{name}-{self.metrics.get('trained_at', 'unknown')[:10]}"

        options = ort.SessionOptions()
        options.intra_op_num_threads = int(os.environ.get("ORT_THREADS", min(4, os.cpu_count() or 1)))
        self.session = ort.InferenceSession(str(folder / "model.onnx"), options,
                                            providers=["CPUExecutionProvider"])
        if self.session.get_outputs()[0].shape[-1] != len(self.labels):
            raise RuntimeError(f"{name}: labels.json does not match the model's output size")

    def logits(self, batch: np.ndarray) -> np.ndarray:
        """batch: float32 (N, 3, 224, 224) in 0..1 -> raw class scores (N, classes)."""
        return self.session.run(None, {"image": batch.astype(np.float32, copy=False)})[0]

    def probabilities(self, batch: np.ndarray) -> np.ndarray:
        """batch: float32 (N, 3, 224, 224) in 0..1 -> calibrated probabilities (N, classes)."""
        return softmax(self.logits(batch) / self.temperature)

    def predict(self, crop: Image.Image) -> tuple[list[dict], np.ndarray]:
        tensor = to_tensor(crop)
        probs = self.probabilities(tensor[None])[0]
        order = np.argsort(-probs)
        ranked = [{"label": self.labels[i], "confidence": round(float(probs[i]), 6)} for i in order]
        return ranked, tensor

    def info(self) -> dict:
        test = self.metrics.get("test", {})
        return {
            "name": self.name,
            "version": self.version,
            "architecture": self.metrics.get("architecture"),
            "framework": self.metrics.get("framework"),
            "dataset": self.metrics.get("dataset"),
            "trained_at": self.metrics.get("trained_at"),
            "num_classes": len(self.labels),
            "labels": self.labels,
            "split_sizes": self.metrics.get("split_sizes"),
            "temperature": self.temperature,
            "test": {k: test.get(k) for k in ("samples", "accuracy", "top3_accuracy", "macro_f1",
                                               "macro_precision", "macro_recall",
                                               "expected_calibration_error")},
            "per_class": test.get("per_class", []),
        }


def occlusion_heatmap(model: Classifier, tensor: np.ndarray, class_index: int,
                      patch: int = 56, stride: int = 28) -> np.ndarray | None:
    """Which parts of the image does the prediction depend on?

    Slide a grey patch over the image and record how much the evidence for the predicted
    class drops when each region is hidden. Regions whose removal hurts the most are the
    ones the model relied on. This needs no gradients, so it works with any exported model.

    Evidence is the class's raw score minus the best competing score (the logit margin),
    not the probability: when the model is very sure, the probability stays at ~100% no
    matter which patch is hidden, while the margin still shows which regions mattered.

    Returns a coarse grid (one value per `stride` pixels) scaled to 0..1, or None when
    hiding any single region barely changes the answer, in which case a map would only
    show noise.
    """
    positions = [(y, x) for y in range(0, INPUT_SIZE - patch + 1, stride)
                 for x in range(0, INPUT_SIZE - patch + 1, stride)]
    fill = tensor.mean(axis=(1, 2), keepdims=True)
    batch = np.repeat(tensor[None], len(positions) + 1, axis=0)
    for i, (y, x) in enumerate(positions, start=1):
        batch[i, :, y:y + patch, x:x + patch] = fill
    logits = model.logits(batch)
    others = np.delete(logits, class_index, axis=1).max(axis=1)
    margin = logits[:, class_index] - others
    drops = np.clip(margin[0] - margin[1:], 0, None)
    if drops.max() < MIN_HEATMAP_DROP:
        return None

    cells = INPUT_SIZE // stride
    span = patch // stride
    heat = np.zeros((cells, cells), dtype=np.float32)
    cover = np.zeros_like(heat)
    for drop, (y, x) in zip(drops, positions):
        cy, cx = y // stride, x // stride
        heat[cy:cy + span, cx:cx + span] += drop
        cover[cy:cy + span, cx:cx + span] += 1
    heat /= np.maximum(cover, 1)
    return heat / heat.max()


def render_heatmap(crop: Image.Image, heat: np.ndarray, size: int = 448) -> str:
    """Blend the heatmap over the cropped photo and return it as a base64 PNG."""
    # Upsampling the coarse grid with a bicubic filter gives smooth blobs, not squares.
    smooth = Image.fromarray((heat * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
    h = np.asarray(smooth, dtype=np.float32) / 255.0
    # Transparent -> yellow -> red as importance rises.
    colour = np.stack([np.full_like(h, 255.0), 235.0 * (1 - h) + 40.0 * h, 40.0 * (1 - h)], axis=-1)
    alpha = (np.clip(h, 0, 1) ** 1.3 * 0.72)[..., None]
    base = np.asarray(crop.resize((size, size), Image.BICUBIC), dtype=np.float32)
    blended = (base * (1 - alpha) + colour * alpha).clip(0, 255).astype(np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(blended).save(buffer, "PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def load_models() -> dict[str, Classifier]:
    """Load every model folder that is present. A missing model is reported, not fatal."""
    models: dict[str, Classifier] = {}
    for name in ("disease", "pest", "produce"):
        folder = MODELS_DIR / name
        if (folder / "model.onnx").is_file():
            models[name] = Classifier(name, folder)
    return models
