# syntax=docker/dockerfile:1
# Service GPU proctoring CodeUnical (YOLO deteksi HP + InsightFace face-rec).
# Model resident di VRAM (standby). Build (butuh jaringan, ~beberapa GB):
#   sudo -n docker compose --env-file .env build proctor-ai
# Base CUDA+cuDNN diperlukan onnxruntime-gpu (torch membawa CUDA sendiri).
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODELS_DIR=/models \
    INSIGHTFACE_HOME=/models/insightface \
    YOLO_CONFIG_DIR=/tmp/ultralytics \
    HF_HOME=/tmp/hf

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip libgl1 libglib2.0-0 \
 && ln -sf /usr/bin/python3 /usr/bin/python \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Torch dengan CUDA 12.4 (wheel resmi PyTorch).
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cu124

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pra-unduh bobot ke /models (self-contained; tak perlu unduh saat runtime).
RUN mkdir -p /models
RUN python - <<'PY'
from ultralytics import YOLO
import shutil, os
YOLO('yolo11n.pt')  # unduh ke cwd
if os.path.exists('yolo11n.pt'):
    shutil.move('yolo11n.pt', '/models/yolo11n.pt')
from insightface.app import FaceAnalysis
a = FaceAnalysis(name='buffalo_l', root='/models/insightface',
                 providers=['CPUExecutionProvider'])
a.prepare(ctx_id=-1, det_size=(640, 640))
print('models siap')
PY

COPY app ./app

EXPOSE 47610
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "47610"]
