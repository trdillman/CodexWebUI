from __future__ import annotations

import base64
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Tuple

import httpx
from fastapi import HTTPException, status

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.json"
DEFAULT_BASE_URL = "http://127.0.0.1:7860"
TIMEOUT = httpx.Timeout(10.0)


def _load_config() -> Dict[str, Any]:
    try:
        raw = CONFIG_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in {CONFIG_PATH}: {exc}") from exc

    if not isinstance(data, dict):
        raise RuntimeError(f"Config at {CONFIG_PATH} must be a JSON object")

    return data


@lru_cache(maxsize=1)
def _config() -> Dict[str, Any]:
    return _load_config()


def _base_url() -> str:
    cfg = _config()
    base = cfg.get("sdnext_base_url") if isinstance(cfg, dict) else None
    if not base:
        return DEFAULT_BASE_URL
    return str(base).rstrip("/") or DEFAULT_BASE_URL


def _http_client() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT)


def _summarize_models(payload: Any) -> Any:
    if isinstance(payload, list):
        return [model.get("model_name") or model.get("title") for model in payload[:3] if isinstance(model, dict)]
    return payload


def health() -> Dict[str, Any]:
    base = _base_url()
    with _http_client() as client:
        try:
            response = client.get(f"{base}/sdapi/v1/sd-models")
            response.raise_for_status()
            return {"ok": True, "endpoint": base, "models": _summarize_models(response.json())}
        except httpx.HTTPError:
            pass

        try:
            fallback = client.get(f"{base}/sdapi/v1/progress")
            fallback.raise_for_status()
            return {"ok": True, "endpoint": base, "progress": fallback.json()}
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to reach SD.Next backend",
            ) from exc


def txt2img(params: Dict[str, Any]) -> Tuple[bytes, Dict[str, Any]]:
    prompt = params.get("prompt")
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="prompt is required")

    base = _base_url()

    payload: Dict[str, Any] = {"prompt": prompt}
    optional_fields = (
        "negative_prompt",
        "steps",
        "width",
        "height",
        "sampler_name",
        "cfg_scale",
        "seed",
    )
    for field in optional_fields:
        value = params.get(field)
        if value is not None:
            payload[field] = value

    model = params.get("model")
    if model:
        payload.setdefault("override_settings", {})
        payload["override_settings"]["sd_model_checkpoint"] = model

    with _http_client() as client:
        try:
            response = client.post(f"{base}/sdapi/v1/txt2img", json=payload)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="txt2img request failed",
            ) from exc

    try:
        data = response.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid JSON response from SD.Next",
        ) from exc

    images = data.get("images") if isinstance(data, dict) else None
    if not images or not isinstance(images, list):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="SD.Next response missing images")

    first_image = images[0]
    if not isinstance(first_image, str):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid image payload from SD.Next")

    if "," in first_image:
        first_image = first_image.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(first_image)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to decode SD.Next image payload",
        ) from exc

    meta: Dict[str, Any] = {}
    info = data.get("info")
    if info:
        if isinstance(info, str):
            try:
                meta = json.loads(info)
            except json.JSONDecodeError:
                meta = {"raw_info": info}
        elif isinstance(info, dict):
            meta = info
        else:
            meta = {"raw_info": info}

    return image_bytes, meta
