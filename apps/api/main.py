from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .adapters import sdnext

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


@app.get("/health")
def health() -> Dict[str, bool]:
    return {"ok": True}


@app.get("/backend/health")
def backend_health() -> Dict[str, Any]:
    return sdnext.health()


@app.post("/generate")
def generate(request: GenerateRequest) -> Dict[str, Any]:
    payload = request.model_dump(exclude_none=True)
    image_bytes, meta = sdnext.txt2img(payload)

    job_id = uuid.uuid4().hex[:12]
    image_path = RUNS_DIR / f"{job_id}.png"
    image_path.write_bytes(image_bytes)

    return {
        "id": job_id,
        "image_url": f"/runs/{job_id}.png",
        "meta": meta,
    }
