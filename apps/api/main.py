from __future__ import annotations

import copy
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .adapters import sdnext
from .capabilities import get_capabilities
from .settings_store import load_settings, save_settings

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent.parent
RUNS_DIR = PROJECT_ROOT / "runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CodexWebUI API")
app.mount("/runs", StaticFiles(directory=str(RUNS_DIR)), name="runs")


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    negative_prompt: Optional[str] = None
    steps: Optional[int] = Field(None, ge=1)
    width: Optional[int] = Field(None, ge=64)
    height: Optional[int] = Field(None, ge=64)
    sampler_name: Optional[str] = None
    cfg_scale: Optional[float] = Field(None, ge=1.0)
    seed: Optional[int] = None
    model: Optional[str] = None


class CompileSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    backend: Optional[str] = None


class QuantizeSettingsUpdate(BaseModel):
    method: Optional[str] = None  # Allow explicit null to disable
    params: Optional[Dict[str, Any]] = None


class AttentionSettingsUpdate(BaseModel):
    sage: Optional[bool] = None


class PerformanceSettingsUpdate(BaseModel):
    xformers: Optional[bool] = None
    sdpa: Optional[bool] = None


class ModelSettingsUpdate(BaseModel):
    name: Optional[str] = None


class UiSettingsUpdate(BaseModel):
    mobile_compact: Optional[bool] = None


class SettingsUpdate(BaseModel):
    compile: Optional[CompileSettingsUpdate] = None
    quantize: Optional[QuantizeSettingsUpdate] = None
    attention: Optional[AttentionSettingsUpdate] = None
    performance: Optional[PerformanceSettingsUpdate] = None
    model: Optional[ModelSettingsUpdate] = None
    ui: Optional[UiSettingsUpdate] = None


@app.get("/health")
def health() -> Dict[str, bool]:
    return {"ok": True}


@app.get("/backend/health")
def backend_health() -> Dict[str, Any]:
    return sdnext.health()


@app.get("/backend/capabilities")
def backend_capabilities() -> Dict[str, Any]:
    return get_capabilities()


@app.get("/settings")
def get_settings() -> Dict[str, Any]:
    return load_settings()


def _deep_merge(base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in updates.items():
        if (
            key in base
            and isinstance(base[key], dict)
            and isinstance(value, dict)
        ):
            base[key] = _deep_merge(copy.deepcopy(base[key]), value)
        else:
            base[key] = value
    return base


@app.post("/settings")
def update_settings(payload: SettingsUpdate) -> Dict[str, Any]:
    current = load_settings()
    updates = payload.model_dump(exclude_unset=True)
    merged = _deep_merge(copy.deepcopy(current), updates)
    save_settings(merged)
    return merged


@app.post("/generate")
def generate(request: GenerateRequest) -> Dict[str, Any]:
    payload = request.model_dump(exclude_none=True)
    settings_snapshot = load_settings()
    generation_context = {
        "compile": settings_snapshot.get("compile"),
        "quantize": settings_snapshot.get("quantize"),
        "attention": settings_snapshot.get("attention"),
        "performance": settings_snapshot.get("performance"),
        "model": settings_snapshot.get("model"),
    }


    image_bytes, meta = sdnext.txt2img(payload)

    job_id = uuid.uuid4().hex[:12]
    image_path = RUNS_DIR / f"{job_id}.png"
    image_path.write_bytes(image_bytes)

    response_meta = meta or {}
    if isinstance(response_meta, dict):
        response_meta.setdefault("codex_settings", generation_context)

    return {
        "id": job_id,
        "image_url": f"/runs/{job_id}.png",
        "meta": response_meta,
        "settings": generation_context,
    }

