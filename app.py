from fastapi import FastAPI
import torch
import os

app = FastAPI()

@app.get("/")
def home():
    return {
        "status": "ok",
        "message": "ClimateQuest backend is running",
        "torch_version": torch.__version__
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }