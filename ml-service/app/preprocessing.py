"""Image decoding, quality checks and model preprocessing.

The resize/crop here must stay identical to `eval_tf` in training/train.py:
shorter side to 256 (bilinear), centre crop 224, scale to 0..1. Mean/std
normalisation is inside the ONNX graph, so it is not repeated here.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError

INPUT_SIZE = 224
RESIZE_TO = 256
MAX_PIXELS = 40_000_000  # refuse absurdly large images (decompression bombs)

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class InvalidImage(ValueError):
    """The upload is not an image we can analyse."""


@dataclass
class Quality:
    width: int
    height: int
    brightness: float  # 0 (black) .. 1 (white)
    sharpness: float  # variance of an edge filter; low means blurry
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "brightness": round(self.brightness, 3),
            "sharpness": round(self.sharpness, 1),
            "warnings": self.warnings,
        }


def load_image(data: bytes) -> Image.Image:
    """Decode bytes into an upright RGB image, or raise InvalidImage."""
    if not data:
        raise InvalidImage("The uploaded file is empty.")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImage("The uploaded file is not a readable image.") from exc
    image = ImageOps.exif_transpose(image)  # phone photos are often stored rotated
    if image.mode != "RGB":
        image = image.convert("RGB")
    if min(image.size) < 64:
        raise InvalidImage("The image is too small to analyse (minimum 64 pixels).")
    return image


def assess_quality(image: Image.Image) -> Quality:
    """Cheap checks that explain most bad predictions: too dark, too bright, or blurry."""
    small = image.copy()
    small.thumbnail((512, 512))
    gray = small.convert("L")
    pixels = np.asarray(gray, dtype=np.float32)
    brightness = float(pixels.mean() / 255.0)
    edges = np.asarray(gray.filter(ImageFilter.FIND_EDGES), dtype=np.float32)
    sharpness = float(edges[1:-1, 1:-1].var())  # border pixels of the filter are artefacts

    warnings: list[str] = []
    if brightness < 0.2:
        warnings.append("The photo is very dark. Retake it in daylight for a more reliable result.")
    elif brightness > 0.88:
        warnings.append("The photo is over-exposed. Avoid direct flash or harsh sunlight on the leaf.")
    if sharpness < 60:
        warnings.append("The photo looks blurry. Hold the camera steady and tap to focus on the leaf.")
    if min(image.size) < 200:
        warnings.append("The photo has a low resolution. Move closer or use a higher-quality setting.")
    return Quality(image.width, image.height, brightness, sharpness, warnings)


def center_crop(image: Image.Image) -> Image.Image:
    """The exact 224x224 region the model sees."""
    w, h = image.size
    if w <= h:
        new_w, new_h = RESIZE_TO, max(RESIZE_TO, int(RESIZE_TO * h / w))
    else:
        new_w, new_h = max(RESIZE_TO, int(RESIZE_TO * w / h)), RESIZE_TO
    resized = image.resize((new_w, new_h), Image.BILINEAR)
    left = (new_w - INPUT_SIZE) // 2
    top = (new_h - INPUT_SIZE) // 2
    return resized.crop((left, top, left + INPUT_SIZE, top + INPUT_SIZE))


def to_tensor(crop: Image.Image) -> np.ndarray:
    """224x224 RGB image -> float32 array of shape (3, 224, 224) in 0..1."""
    array = np.asarray(crop, dtype=np.float32) / 255.0
    return np.ascontiguousarray(array.transpose(2, 0, 1))
