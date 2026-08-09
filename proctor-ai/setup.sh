#!/usr/bin/env bash
# Siapkan venv proctor-ai yang ME-REUSE torch/torchvision/numpy dari conda env py310
# (TIDAK mengunduh torch lagi) via --system-site-packages. facenet dipasang --no-deps
# agar tidak menurunkan torch ke 2.2.x. Jalankan sekali dari folder proctor-ai.
set -euo pipefail
cd "$(dirname "$0")"
PY310="${PY310:-$HOME/DATA_ICAL/miniforge3/envs/py310/bin/python}"
"$PY310" -m venv --system-site-packages .venv
.venv/bin/python -m pip install -q --upgrade pip
.venv/bin/pip install --no-deps facenet-pytorch
.venv/bin/pip install ultralytics fastapi "uvicorn[standard]" python-multipart opencv-python-headless tqdm requests
echo "OK. Jalankan service: ./run.sh"
