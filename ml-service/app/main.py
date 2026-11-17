"""CropGuard inference service.

    uvicorn app.main:app --port 8000

Endpoints
    GET  /health    liveness and which models are loaded
    GET  /models    model cards: dataset, test metrics, class list
    POST /analyze   multipart image -> disease and/or pest probabilities

This service is internal: only the Node API calls it. It holds no user data and no
business rules. It returns raw calibrated probabilities and the API decides what
they mean.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from .inference import Classifier, load_models, occlusion_heatmap, render_heatmap
from .preprocessing import InvalidImage, assess_quality, center_crop, load_image

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
models: dict[str, Classifier] = {}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    models.update(load_models())
    yield
    models.clear()


app = FastAPI(title="CropGuard ML service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok" if models else "no_models", "models": sorted(models)}


@app.get("/models")
def model_cards() -> dict:
    return {"models": [m.info() for m in models.values()]}


def run_analysis(data: bytes, mode: str, explain: bool) -> dict:
    started = time.perf_counter()
    image = load_image(data)
    quality = assess_quality(image)
    crop = center_crop(image)

    result: dict = {"quality": quality.as_dict()}
    wanted = ["disease", "pest"] if mode == "both" else [mode]
    for name in wanted:
        model = models.get(name)
        if model is None:
            continue
        ranked, tensor = model.predict(crop)
        entry = {"model": name, "version": model.version, "predictions": ranked}
        if explain and name == "disease":
            top = model.labels.index(ranked[0]["label"])
            heat = occlusion_heatmap(model, tensor, top)
            if heat is not None:
                entry["heatmap_png_base64"] = render_heatmap(crop, heat)
        result[name] = entry

    result["inference_ms"] = round((time.perf_counter() - started) * 1000)
    return result


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    mode: Literal["disease", "pest", "both", "produce"] = Form("both"),
    explain: bool = Form(False),
) -> dict:
    missing = [m for m in (["disease", "pest"] if mode == "both" else [mode]) if m not in models]
    if missing:
        raise HTTPException(503, f"Model not loaded: {', '.join(missing)}")

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image is larger than 10 MB.")
    try:
        # Inference is CPU-bound; keep it off the event loop so /health stays responsive.
        return await run_in_threadpool(run_analysis, data, mode, explain)
    except InvalidImage as exc:
        raise HTTPException(422, str(exc)) from exc
