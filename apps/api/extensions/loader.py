from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter
from fastapi.staticfiles import StaticFiles

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EXTENSIONS_ROOT = PROJECT_ROOT / "workspace" / "extensions"


@dataclass
class ExtensionRecord:
    name: str
    path: Path
    has_static: bool = False
    has_api: bool = False
    static_url: str | None = None
    api_url: str | None = None
    error: str | None = None


_registry: List[ExtensionRecord] = []


def _load_api_router(name: str, api_path: Path) -> tuple[APIRouter | None, str | None]:
    spec = importlib.util.spec_from_file_location(f"codex_ext_{name}", api_path)
    if not spec or not spec.loader:
        return None, "Unable to create module loader"

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)  # type: ignore[assignment]
    except Exception as exc:  # pragma: no cover - defensive import guard
        return None, f"API import failed: {exc}"

    router = getattr(module, "router", None)
    if not isinstance(router, APIRouter):
        return None, "api.py must expose a FastAPI APIRouter named 'router'"

    return router, None


def load_extensions(app) -> List[Dict[str, Any]]:
    """Discover extensions under workspace/extensions and mount static/API resources."""
    global _registry
    EXTENSIONS_ROOT.mkdir(parents=True, exist_ok=True)

    records: List[ExtensionRecord] = []
    for entry in sorted(EXTENSIONS_ROOT.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_dir():
            continue

        record = ExtensionRecord(name=entry.name, path=entry)
        static_dir = entry / "static"
        if static_dir.is_dir():
            try:
                mount_path = f"/ext/{record.name}/static"
                app.mount(
                    mount_path,
                    StaticFiles(directory=str(static_dir), html=True),
                    name=f"ext-static-{record.name}",
                )
                record.has_static = True
                record.static_url = mount_path
            except Exception as exc:  # pragma: no cover - mounting failures are surfaced to UI
                record.error = f"Static mount failed: {exc}"

        api_file = entry / "api.py"
        if api_file.is_file():
            router, router_error = _load_api_router(record.name, api_file)
            if router:
                prefix = f"/ext/{record.name}/api"
                app.include_router(router, prefix=prefix)
                record.has_api = True
                record.api_url = prefix
            else:
                record.error = (record.error + " | " if record.error else "") + str(router_error)

        records.append(record)

    _registry = records
    return [record_to_dict(item) for item in records]


def record_to_dict(record: ExtensionRecord) -> Dict[str, Any]:
    return {
        "name": record.name,
        "hasStatic": record.has_static,
        "hasApi": record.has_api,
        "staticUrl": record.static_url,
        "apiUrl": record.api_url,
        "error": record.error,
    }


def get_extensions() -> List[Dict[str, Any]]:
    return [record_to_dict(item) for item in _registry]
