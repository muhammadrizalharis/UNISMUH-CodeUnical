"""API service proctoring GPU CodeUnical. Model resident (standby) di GPU."""
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .detector import Detector

state: dict[str, Detector | None] = {"detector": None}


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Muat model ke GPU sekali saat start; tetap resident selama service hidup.
    state["detector"] = Detector()
    yield
    state["detector"] = None


app = FastAPI(title="CodeUnical Proctor AI", lifespan=lifespan)


def _detector() -> Detector:
    d = state["detector"]
    if d is None:
        raise HTTPException(503, "model belum siap")
    return d


def _read(file: UploadFile) -> np.ndarray:
    arr = np.frombuffer(file.file.read(), np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "gambar tak terbaca")
    return img


@app.get("/health")
def health():
    d = state["detector"]
    return {
        "ok": d is not None,
        "device": __import__("os").environ.get("DEVICE", "cuda:0"),
        "whitelist": list(d.whitelist.keys()) if d else [],
    }


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    return _detector().detect(_read(file))


@app.post("/enroll")
async def enroll(name: str = Form(...), file: UploadFile = File(...)):
    return {"ok": _detector().enroll(name, _read(file))}
