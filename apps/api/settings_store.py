from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Dict

APP_DIR = Path(__file__).resolve().parent
SETTINGS_PATH = APP_DIR / "settings.json"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "compile": {"enabled": True, "backend": "triton"},
    "quantize": {"method": None, "params": {}},
    "attention": {"sage": True},
    "performance": {"xformers": False, "sdpa": True},
    "model": {"name": None},
    "ui": {"mobile_compact": True},
}


def _deep_merge(base: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in overrides.items():
        if (
            key in base
            and isinstance(base[key], dict)
            and isinstance(value, dict)
        ):
            base[key] = _deep_merge(copy.deepcopy(base[key]), value)
        else:
            base[key] = value
    return base


def _ensure_defaults(data: Dict[str, Any]) -> Dict[str, Any]:
    merged = copy.deepcopy(DEFAULT_SETTINGS)
    return _deep_merge(merged, data)


def load_settings() -> Dict[str, Any]:
    if not SETTINGS_PATH.exists():
        save_settings(DEFAULT_SETTINGS)
        return copy.deepcopy(DEFAULT_SETTINGS)

    try:
        loaded = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        if not isinstance(loaded, dict):
            raise ValueError("settings.json must contain an object")
    except (json.JSONDecodeError, ValueError):
        save_settings(DEFAULT_SETTINGS)
        return copy.deepcopy(DEFAULT_SETTINGS)

    return _ensure_defaults(loaded)


def save_settings(data: Dict[str, Any]) -> None:
    normalized = _ensure_defaults(data)
    SETTINGS_PATH.write_text(
        json.dumps(normalized, indent=2, sort_keys=True), encoding="utf-8"
    )
