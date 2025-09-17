from datetime import datetime, timedelta
from typing import Any, Dict
import uuid

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="CodexWebUI API")

class JobCreate(BaseModel):
    """Minimal payload accepted by the stub pipeline."""
    type: str = "pipeline.run"
    payload: Dict[str, Any] = Field(default_factory=dict)

JOBS: Dict[str, Dict[str, Any]] = {}

@app.get("/health")
def health() -> Dict[str, bool]:
    """Service heartbeat."""
    return {"ok": True}

@app.post("/jobs")
def create_job(payload: JobCreate) -> Dict[str, str]:
    """Register a job and return an identifier to poll."""
    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {
        "id": job_id,
        "status": "processing",
        "created_at": datetime.utcnow(),
        "type": payload.type,
        "payload": payload.payload,
        "result": None,
        "error": None,
    }
    return {"id": job_id}

@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> Dict[str, Any]:
    """Return the state of the requested job."""
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "processing":
        if datetime.utcnow() - job["created_at"] >= timedelta(seconds=1):
            job["status"] = "done"
            job["result"] = {
                "message": "Stubbed pipeline result",
                "echo": job["payload"],
            }

    response = {key: value for key, value in job.items() if key != "created_at"}
    return response
