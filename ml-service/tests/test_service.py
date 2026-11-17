"""Tests for the inference service.  Run with:  pytest

Preprocessing tests need nothing but Pillow. The API tests use the exported models in
models/ and are skipped if those files are not present.
"""

from __future__ import annotations

import base64
import io

import numpy as np
import pytest
from PIL import Image, ImageFilter

from app.inference import MODELS_DIR
from app.preprocessing import (INPUT_SIZE, InvalidImage, assess_quality, center_crop, load_image,
                               to_tensor)


def jpeg_bytes(image: Image.Image, **kwargs) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", **kwargs)
    return buffer.getvalue()


def leaf_like(width: int = 640, height: int = 480, seed: int = 0) -> Image.Image:
    """A green image with some texture, so it is neither blank nor blurry."""
    rng = np.random.default_rng(seed)
    pixels = np.zeros((height, width, 3), dtype=np.uint8)
    pixels[..., 0] = rng.integers(20, 90, (height, width))
    pixels[..., 1] = rng.integers(90, 200, (height, width))
    pixels[..., 2] = rng.integers(20, 80, (height, width))
    return Image.fromarray(pixels)


# --- preprocessing -----------------------------------------------------------


def test_rejects_things_that_are_not_images():
    for data in (b"", b"definitely not an image", b"\xff\xd8\xff\xe0 truncated jpeg"):
        with pytest.raises(InvalidImage):
            load_image(data)


def test_rejects_tiny_images():
    with pytest.raises(InvalidImage):
        load_image(jpeg_bytes(Image.new("RGB", (32, 32), "green")))


def test_converts_png_with_alpha_to_rgb():
    buffer = io.BytesIO()
    Image.new("RGBA", (300, 200), (10, 200, 10, 128)).save(buffer, "PNG")
    assert load_image(buffer.getvalue()).mode == "RGB"


def test_applies_exif_orientation():
    image = Image.new("RGB", (400, 200), "green")
    exif = image.getexif()
    exif[0x0112] = 6  # "rotate 90 degrees clockwise to view"
    upright = load_image(jpeg_bytes(image, exif=exif))
    assert upright.size == (200, 400)


@pytest.mark.parametrize("size", [(640, 480), (480, 640), (224, 224), (3000, 500), (100, 90)])
def test_crop_is_always_224_square(size):
    crop = center_crop(leaf_like(*size))
    assert crop.size == (INPUT_SIZE, INPUT_SIZE)
    tensor = to_tensor(crop)
    assert tensor.shape == (3, INPUT_SIZE, INPUT_SIZE)
    assert tensor.dtype == np.float32
    assert 0.0 <= tensor.min() and tensor.max() <= 1.0


def test_quality_warnings():
    assert assess_quality(leaf_like()).warnings == []
    dark = assess_quality(Image.new("RGB", (640, 480), (8, 12, 8)))
    assert any("dark" in w for w in dark.warnings)
    bright = assess_quality(Image.new("RGB", (640, 480), (250, 250, 250)))
    assert any("over-exposed" in w for w in bright.warnings)
    blurry = assess_quality(leaf_like().filter(ImageFilter.GaussianBlur(12)))
    assert any("blurry" in w for w in blurry.warnings)
    small = assess_quality(leaf_like(160, 120))
    assert any("resolution" in w for w in small.warnings)


# --- API ---------------------------------------------------------------------

MODEL_NAMES = ("disease", "pest", "produce")
needs_models = pytest.mark.skipif(
    not all((MODELS_DIR / name / "model.onnx").is_file() for name in MODEL_NAMES),
    reason="exported models are not present in models/",
)


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@needs_models
def test_health_and_model_cards(client):
    assert client.get("/health").json() == {"status": "ok", "models": sorted(MODEL_NAMES)}
    cards = {m["name"]: m for m in client.get("/models").json()["models"]}
    assert cards["disease"]["num_classes"] == 38
    assert cards["pest"]["num_classes"] == 26
    assert "no_pest" in cards["pest"]["labels"]
    assert cards["produce"]["num_classes"] == 18
    assert {label.split("__")[1] for label in cards["produce"]["labels"]} == {"Good", "Mixed", "Bad"}
    for card in cards.values():
        assert 0.5 < card["test"]["accuracy"] <= 1.0
        assert card["temperature"] > 0


@needs_models
def test_analyze_returns_a_probability_for_every_class(client):
    response = client.post(
        "/analyze",
        files={"file": ("leaf.jpg", jpeg_bytes(leaf_like()), "image/jpeg")},
        data={"mode": "both", "explain": "true"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["quality"]["width"] == 640
    for name, classes in (("disease", 38), ("pest", 26)):
        predictions = body[name]["predictions"]
        assert len(predictions) == classes
        scores = [p["confidence"] for p in predictions]
        assert scores == sorted(scores, reverse=True)
        assert abs(sum(scores) - 1.0) < 1e-3
    heatmap = body["disease"].get("heatmap_png_base64")
    if heatmap:  # omitted when no single region matters
        assert Image.open(io.BytesIO(base64.b64decode(heatmap))).size == (448, 448)
    assert "heatmap_png_base64" not in body["pest"]


@needs_models
def test_produce_mode_returns_fruit_quality_classes(client):
    files = {"file": ("fruit.jpg", jpeg_bytes(leaf_like()), "image/jpeg")}
    body = client.post("/analyze", files=files, data={"mode": "produce"}).json()
    assert set(body) >= {"quality", "produce", "inference_ms"} and "disease" not in body
    predictions = body["produce"]["predictions"]
    assert len(predictions) == 18
    assert abs(sum(p["confidence"] for p in predictions) - 1.0) < 1e-3


@needs_models
def test_mode_selects_the_model(client):
    files = {"file": ("leaf.jpg", jpeg_bytes(leaf_like()), "image/jpeg")}
    only_pest = client.post("/analyze", files=files, data={"mode": "pest"}).json()
    assert "pest" in only_pest and "disease" not in only_pest
    assert client.post("/analyze", files=files, data={"mode": "weeds"}).status_code == 422


@needs_models
def test_bad_uploads_are_rejected(client):
    bad = client.post("/analyze", files={"file": ("x.jpg", b"nope", "image/jpeg")}, data={"mode": "both"})
    assert bad.status_code == 422
    assert "not a readable image" in bad.json()["detail"]
    assert client.post("/analyze", data={"mode": "both"}).status_code == 422


@needs_models
def test_predictions_are_deterministic(client):
    files = {"file": ("leaf.jpg", jpeg_bytes(leaf_like(seed=3)), "image/jpeg")}
    first = client.post("/analyze", files=files, data={"mode": "disease"}).json()["disease"]["predictions"]
    second = client.post("/analyze", files=files, data={"mode": "disease"}).json()["disease"]["predictions"]
    assert first == second
