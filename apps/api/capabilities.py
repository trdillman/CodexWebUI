from __future__ import annotations

import json
import platform
import sys
from importlib import import_module
from pathlib import Path
from typing import Any, Dict, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MATRIX_PATH = PROJECT_ROOT / "build" / "compat_matrix.json"
REPORT_PATH = PROJECT_ROOT / "build" / "compat_report.md"


def _normalize_cuda(tag: Optional[str]) -> Optional[str]:
    if not tag:
        return None
    tag = tag.lower()
    if tag.startswith("cu") and tag[2:].isdigit():
        digits = tag[2:]
        if len(digits) >= 2:
            major = digits[:-1]
            minor = digits[-1]
            return f"{int(major)}.{minor}"
    return tag


def _import_optional(module: str):
    try:
        return import_module(module), None
    except Exception as exc:  # pragma: no cover - diagnostic path
        return None, str(exc)


def _package_ok(packages: Dict[str, Any], name: str) -> bool:
    info = packages.get(name)
    if not info:
        return False
    verdict = str(info.get("verdict", "")).lower()
    return verdict.startswith("ok")


def _collect_notes(packages: Dict[str, Any]) -> Dict[str, str]:
    notes: Dict[str, str] = {}
    for name, info in packages.items():
        note_parts = []
        verdict = info.get("verdict")
        if verdict:
            note_parts.append(str(verdict))
        if info.get("notes"):
            note_parts.append(str(info["notes"]))
        if note_parts:
            notes[name] = " | ".join(note_parts)
    return notes


def get_capabilities() -> Dict[str, Any]:
    matrix = {}
    packages: Dict[str, Any] = {}
    notes: Dict[str, str] = {}

    if MATRIX_PATH.exists():
        try:
            matrix = json.loads(MATRIX_PATH.read_text(encoding="utf-8"))
            packages = matrix.get("packages", {})
            notes.update(_collect_notes(packages))
        except json.JSONDecodeError:
            matrix = {}

    env_meta = matrix.get("environment", {}) if isinstance(matrix, dict) else {}

    env = {
        "python": env_meta.get(
            "python", f"{sys.version_info.major}.{sys.version_info.minor}"
        ),
        "cuda": _normalize_cuda(env_meta.get("cuda")) or "unknown",
        "platform": env_meta.get(
            "platform", platform.machine().lower() or sys.platform
        ),
    }

    torch_module, torch_err = _import_optional("torch")
    torch_version = None
    torch_compile = False
    if torch_module:
        torch_version = getattr(torch_module, "__version__", None)
        torch_compile = bool(getattr(torch_module, "compile", None))
    elif torch_err:
        notes.setdefault("torch", torch_err)

    if not torch_version and packages.get("torch"):
        torch_version = packages["torch"].get("required_version")

    backends = {
        "triton": _package_ok(packages, "triton"),
        "stablefast": False,
        "deepcache": False,
        "onediff": False,
        "teacache": False,
    }

    quantize = {
        "torchao": False,
        "bitsandbytes": "unavailable",
        "optimum_quanto": False,
        "sdnq": False,
    }

    torchao_mod, torchao_err = _import_optional("torchao")
    if torchao_mod:
        quantize["torchao"] = True
    elif torchao_err:
        notes.setdefault("torchao", torchao_err)

    bnb_mod, bnb_err = _import_optional("bitsandbytes")
    if bnb_mod:
        # Windows CUDA builds are generally unavailable; treat as CPU fallback if module imports.
        quantize["bitsandbytes"] = "cpu"
    elif bnb_err:
        notes.setdefault("bitsandbytes", bnb_err)

    optimum_mod, optimum_err = _import_optional("optimum")
    quanto_mod = None
    quanto_err = None
    if optimum_mod:
        quanto_mod, quanto_err = _import_optional("optimum.quanto")
    else:
        quanto_err = optimum_err

    if quanto_mod:
        quantize["optimum_quanto"] = True
    elif quanto_err:
        notes.setdefault("optimum_quanto", quanto_err)

    sdnq_mod, sdnq_err = _import_optional("sdnq")
    if sdnq_mod:
        quantize["sdnq"] = True
    elif sdnq_err:
        notes.setdefault("sdnq", sdnq_err)

    sage_mod, sage_err = _import_optional("sageattention")
    extras = {
        "sage_attention": bool(sage_mod),
        "gguf": False,
        "chroma": True,
    }
    if not sage_mod and sage_err:
        notes.setdefault("sageattention", sage_err)

    capabilities = {
        "env": env,
        "torch": {
            "version": torch_version,
            "compile": torch_compile,
        },
        "backends": backends,
        "quantize": quantize,
        "extras": extras,
        "notes": notes,
    }

    return capabilities
