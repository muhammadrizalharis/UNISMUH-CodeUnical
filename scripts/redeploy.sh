#!/usr/bin/env bash
# Redeploy CodeUnical di server self-hosted.
# Jalankan DI SERVER tempat docker-compose berjalan, bukan di mesin dev.
#
#   ./scripts/redeploy.sh
#
# Script akan: ambil kode terbaru dari main, rebuild image Docker (menarik
# base image Node/Postgres terbaru), lalu restart service tanpa downtime lama.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pull kode terbaru (main)"
git fetch origin
git checkout main
git pull --ff-only origin main

echo "==> Rebuild & restart container (tanpa cache base image lama)"
docker compose pull || true
docker compose build --pull
docker compose up -d

echo "==> Status"
docker compose ps

echo "==> Selesai. Verifikasi versi Next.js/Node di dalam container bila perlu:"
echo "    docker compose exec web node --version"
