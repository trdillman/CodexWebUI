from __future__ import annotations

from datetime import datetime
from typing import Dict

from fastapi import APIRouter

router = APIRouter()


@router.get("/hello")
def hello() -> Dict[str, str]:
    """Return a simple payload verifying the extension API shim works."""
    return {
        "message": "Hello from hello-codex",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
