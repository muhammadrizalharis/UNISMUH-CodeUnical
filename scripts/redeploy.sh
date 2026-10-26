#!/usr/bin/env bash
# Redeploy CodeUnical.
# PENTING: Aplikasi web & api CodeUnical dijalankan via systemd user service
# (bukan Docker). docker-compose HANYA menyediakan infra: postgres & minio.
# Jalankan skrip ini di host tempat service berjalan.
#
#   ./scripts/redeploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pull kode terbaru (main)"
git fetch origin
git checkout main
git pull --ff-only origin main

echo "==> Pastikan infra (postgres, minio) berjalan"
docker compose up -d postgres minio

echo "==> API (NestJS): install deps + build"
( cd api && npm ci && npm run build )

echo "==> Web (Next.js): install deps (mode next dev merekompilasi otomatis)"
( cd web && npm ci )

echo "==> Restart service aplikasi (systemd --user)"
systemctl --user daemon-reload
systemctl --user restart codeunical-api codeunical-web codeunical-guard

echo "==> Status"
for u in codeunical-api codeunical-web codeunical-guard; do
  echo "    $u -> $(systemctl --user is-active "$u")"
done

echo "==> Verifikasi (opsional):"
echo "    curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:47080/   # api"
echo "    curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:47300/   # web"
