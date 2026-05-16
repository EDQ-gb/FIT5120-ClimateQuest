"""
FastAPI local AI worker for recipe generation.

Run: uvicorn ai_worker.app:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import os
import secrets
import traceback
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from ai_worker.model_runtime import ensure_model_loaded, generate_recipe


class GenerateRequest(BaseModel):
    ingredients: list[str] = Field(default_factory=list)


def _expected_token() -> str:
    return os.environ.get("AI_WORKER_TOKEN", "").strip()


def verify_bearer(authorization: str | None = Header(default=None)) -> None:
    expected = _expected_token()
    if not expected:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    provided = authorization[7:].strip()
    if not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid bearer token")


def _normalize_ingredients(raw: list[str]) -> list[str]:
    out: list[str] = []
    for item in raw:
        text = str(item or "").strip()
        if text:
            out.append(text)
    return out


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Eager load so first /generate is fast; skip load if MODEL_LAZY_LOAD=1.
    if os.environ.get("MODEL_LAZY_LOAD", "").strip() != "1":
        try:
            ensure_model_loaded()
        except Exception as exc:
            # Worker still starts; /health reports not ready until model loads.
            print(f"[ai_worker] model preload failed: {exc}", flush=True)
    yield


app = FastAPI(title="ClimateQuest AI Worker", lifespan=lifespan)


@app.get("/health")
def health():
    ready = False
    detail = "ok"
    try:
        ensure_model_loaded()
        ready = True
    except Exception as exc:
        detail = str(exc)
    return {
        "status": "ok" if ready else "degraded",
        "service": "recipe-ai-worker",
        "model_ready": ready,
        "detail": detail if not ready else None,
    }


@app.post("/generate")
def generate(
    body: GenerateRequest,
    _auth: Annotated[None, Depends(verify_bearer)],
):
    ingredients = _normalize_ingredients(body.ingredients)
    if len(ingredients) < 3 or len(ingredients) > 5:
        raise HTTPException(
            status_code=400,
            detail="INGREDIENT_COUNT_MUST_BE_3_TO_5",
        )
    try:
        return generate_recipe(ingredients)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        print("[ai_worker] generate failed:", traceback.format_exc(limit=5), flush=True)
        raise HTTPException(status_code=500, detail="MODEL_INFERENCE_FAILED") from exc
