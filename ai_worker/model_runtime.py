"""Load transformer checkpoint once and run beam-search generation."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import torch

# Reuse training/inference code from the Node server package.
_SERVER_SRC = Path(__file__).resolve().parents[1] / "server" / "src"
if str(_SERVER_SRC) not in sys.path:
    sys.path.insert(0, str(_SERVER_SRC))

from recipe_model_infer import (  # noqa: E402
    build_model,
    default_checkpoint_path,
    generate_beam,
    sentence_steps,
)

_model_bundle: dict[str, Any] | None = None


def _checkpoint_path() -> Path:
    configured = os.environ.get("MODEL_PATH", "").strip()
    if configured:
        return Path(configured)
    return Path(default_checkpoint_path())


def _select_device() -> torch.device:
    name = os.environ.get("RECIPE_MODEL_DEVICE", "auto").strip() or "auto"
    if name == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device(name)


def _beam_size() -> int:
    try:
        return max(1, int(os.environ.get("RECIPE_MODEL_BEAM_SIZE", "4")))
    except ValueError:
        return 4


def _max_len() -> int:
    try:
        return max(20, int(os.environ.get("RECIPE_MODEL_MAX_LEN", "110")))
    except ValueError:
        return 110


def _min_len() -> int:
    try:
        return max(4, int(os.environ.get("RECIPE_MODEL_MIN_LEN", "18")))
    except ValueError:
        return 18


def ensure_model_loaded() -> dict[str, Any]:
    global _model_bundle
    if _model_bundle is not None:
        return _model_bundle

    checkpoint_path = _checkpoint_path()
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    device = _select_device()
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model, input_lang, output_lang = build_model(checkpoint, device)

    _model_bundle = {
        "model": model,
        "input_lang": input_lang,
        "output_lang": output_lang,
        "checkpoint": checkpoint,
        "device": device,
        "checkpoint_path": str(checkpoint_path),
    }
    return _model_bundle


def generate_recipe(ingredients: list[str]) -> dict[str, Any]:
    bundle = ensure_model_loaded()
    ingredients_text = ", ".join(ingredients)
    text = generate_beam(
        bundle["model"],
        bundle["input_lang"],
        bundle["output_lang"],
        ingredients_text,
        bundle["device"],
        max_len=_max_len(),
        min_len=_min_len(),
        beam_size=_beam_size(),
    )
    checkpoint = bundle["checkpoint"]
    return {
        "source": "transformer_local_worker",
        "ingredients": ingredients,
        "title": "Generated low-carbon meal",
        "text": text,
        "steps": sentence_steps(text),
        "checkpointEpoch": checkpoint.get("epoch"),
        "bestDevLoss": checkpoint.get("best_dev_loss"),
        "device": str(bundle["device"]),
    }
