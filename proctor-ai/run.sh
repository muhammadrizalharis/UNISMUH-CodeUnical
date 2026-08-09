#!/usr/bin/env bash
# Jalankan service proctoring GPU (model resident/standby di GPU). Default port 47610, GPU1.
# CUDA_VISIBLE_DEVICES memilih GPU fisik; di dalam proses ia jadi cuda:0.
set -euo pipefail
cd "$(dirname "$0")"
export CUDA_VISIBLE_DEVICES="${PROCTOR_GPU:-1}"
export DEVICE="${DEVICE:-cuda:0}"
export MODELS_DIR="${MODELS_DIR:-$PWD/models}"
export YOLO_WEIGHTS="${YOLO_WEIGHTS:-$MODELS_DIR/yolo11n.pt}"
export YOLO_CONFIG_DIR="${YOLO_CONFIG_DIR:-/tmp/ultralytics}"
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-47610}"
