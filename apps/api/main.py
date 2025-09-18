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
from .extensions.loader import get_extensions, load_extensions
from .queue import JobQueue
from .settings_store import load_settings, save_settings

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent.parent
RUNS_DIR = PROJECT_ROOT / "runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CodexWebUI API")
app.mount("/runs", StaticFiles(directory=str(RUNS_DIR)), name="runs")


job_queue = JobQueue(RUNS_DIR, load_settings)
_ = load_extensions(app)


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
    queue: Optional[bool] = True


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


@app.get("/backend/models")
def backend_models() -> Dict[str, Any]:
    return sdnext.list_models()


@app.get("/jobs")
def list_jobs() -> Dict[str, Any]:
    return {"items": job_queue.list_jobs()}


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> Dict[str, Any]:
    return job_queue.get_job(job_id)


@app.post("/jobs")
def create_job(request: GenerateRequest) -> Dict[str, Any]:
    payload = request.model_dump(exclude_none=True)
    payload.pop("queue", None)
    job = job_queue.enqueue(payload)
    return {"job": job}


@app.delete("/jobs/{job_id}")
def cancel_job(job_id: str) -> Dict[str, Any]:
    return job_queue.cancel_job(job_id)


@app.get("/extensions")
def list_extensions() -> Dict[str, Any]:
    return {"items": get_extensions()}


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
    queue_mode = payload.pop("queue", True)

    if queue_mode:
        job = job_queue.enqueue(payload)
        return {"job": job}

    return job_queue.run_sync(payload)




