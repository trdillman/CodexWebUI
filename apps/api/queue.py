from __future__ import annotations

import threading
import queue
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status

from .adapters import sdnext


@dataclass
class JobRecord:
    id: str
    payload: Dict[str, Any]
    prompt: str
    negative_prompt: Optional[str]
    model: Optional[str]
    settings_snapshot: Dict[str, Any]
    status: str = "queued"
    progress: int = 0
    image_url: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    cancel_requested: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "prompt": self.prompt,
            "negativePrompt": self.negative_prompt,
            "model": self.model,
            "status": self.status,
            "progress": self.progress,
            "imageUrl": self.image_url,
            "meta": self.meta,
            "settings": self.settings_snapshot,
            "error": self.error,
            "cancelRequested": self.cancel_requested,
            "createdAt": _iso(self.created_at),
            "startedAt": _iso(self.started_at) if self.started_at else None,
            "completedAt": _iso(self.completed_at) if self.completed_at else None,
        }


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=int(dt.microsecond / 1000) * 1000).isoformat() + "Z"


class JobQueue:
    def __init__(self, runs_dir: Path, settings_loader):
        self._runs_dir = runs_dir
        self._settings_loader = settings_loader
        self._queue: "queue.Queue[str]" = queue.Queue()
        self._jobs: Dict[str, JobRecord] = {}
        self._lock = threading.Lock()
        self._worker = threading.Thread(target=self._worker_loop, name="codex-job-worker", daemon=True)
        self._worker.start()

    # API helpers -----------------------------------------------------------------
    def enqueue(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_id = uuid4().hex[:12]
        prompt = payload.get("prompt") or ""
        negative_prompt = payload.get("negative_prompt")
        model = payload.get("model")
        settings_snapshot = self._settings_loader()
        job = JobRecord(
            id=job_id,
            payload=payload,
            prompt=prompt,
            negative_prompt=negative_prompt,
            model=model,
            settings_snapshot=settings_snapshot,
            progress=0,
        )
        with self._lock:
            self._jobs[job_id] = job
        self._queue.put(job_id)
        return job.to_dict()

    def list_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            jobs = list(self._jobs.values())
        jobs.sort(key=lambda job: job.created_at, reverse=True)
        return [job.to_dict() for job in jobs[:limit]]

    def get_job(self, job_id: str) -> Dict[str, Any]:
        job = self._get_job(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return job.to_dict()

    def cancel_job(self, job_id: str) -> Dict[str, Any]:
        job = self._get_job(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        with self._lock:
            job.cancel_requested = True
            if job.status == "queued":
                job.status = "error"
                job.error = "Cancelled"
                job.progress = 100
                job.completed_at = datetime.utcnow()
        return job.to_dict()

    # Worker ----------------------------------------------------------------------
    def _worker_loop(self) -> None:
        while True:
            job_id = self._queue.get()
            job = self._get_job(job_id)
            if not job:
                self._queue.task_done()
                continue

            if job.cancel_requested and job.status == "error":
                self._queue.task_done()
                continue

            self._mark_running(job)
            try:
                image_bytes, meta = sdnext.txt2img(job.payload)
                self._mark_progress(job, 85)
                if job.cancel_requested:
                    self._mark_cancelled(job)
                else:
                    self._finalize_success(job, image_bytes, meta)
            except HTTPException as exc:
                self._finalize_error(job, str(exc.detail if hasattr(exc, "detail") else exc))
            except Exception as exc:  # pragma: no cover - defensive guard
                self._finalize_error(job, str(exc))
            finally:
                self._queue.task_done()

    # Internal helpers ------------------------------------------------------------
    def _get_job(self, job_id: str) -> Optional[JobRecord]:
        with self._lock:
            return self._jobs.get(job_id)

    def _mark_running(self, job: JobRecord) -> None:
        with self._lock:
            if job.status != "queued":
                return
            job.status = "running"
            job.started_at = datetime.utcnow()
            job.progress = 10

    def _mark_progress(self, job: JobRecord, value: int) -> None:
        with self._lock:
            if job.status == "running":
                job.progress = max(job.progress, min(95, value))

    def _mark_cancelled(self, job: JobRecord) -> None:
        with self._lock:
            job.status = "error"
            job.error = "Cancelled"
            job.progress = 100
            job.completed_at = datetime.utcnow()

    def _finalize_success(self, job: JobRecord, image_bytes: bytes, meta: Optional[Dict[str, Any]]) -> None:
        image_path = self._runs_dir / f"{job.id}.png"
        image_path.write_bytes(image_bytes)
        payload_meta: Dict[str, Any] = meta or {}
        if isinstance(payload_meta, dict):
            payload_meta.setdefault("codex_settings", job.settings_snapshot)
        with self._lock:
            job.status = "done"
            job.progress = 100
            job.image_url = f"/runs/{job.id}.png"
            job.meta = payload_meta
            job.completed_at = datetime.utcnow()

    def _finalize_error(self, job: JobRecord, error_message: str) -> None:
        with self._lock:
            job.status = "error"
            job.error = error_message
            job.progress = 100
            job.completed_at = datetime.utcnow()

    # Immediate execution ---------------------------------------------------------
    def run_sync(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        settings_snapshot = self._settings_loader()
        prompt = payload.get("prompt") or ""
        negative_prompt = payload.get("negative_prompt")
        model = payload.get("model")

        image_bytes, meta = sdnext.txt2img(payload)
        job_id = uuid4().hex[:12]
        image_path = self._runs_dir / f"{job_id}.png"
        image_path.write_bytes(image_bytes)
        payload_meta: Dict[str, Any] = meta or {}
        if isinstance(payload_meta, dict):
            payload_meta.setdefault("codex_settings", settings_snapshot)
        return {
            "id": job_id,
            "prompt": prompt,
            "negativePrompt": negative_prompt,
            "model": model,
            "image_url": f"/runs/{job_id}.png",
            "meta": payload_meta,
            "settings": settings_snapshot,
        }