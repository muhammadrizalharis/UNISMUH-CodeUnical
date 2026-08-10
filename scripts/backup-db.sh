#!/usr/bin/env bash
# Backup harian database CodeUnical (Postgres lokal di container codeunical-postgres).
# Dijalankan oleh systemd --user timer (codeunical-backup.timer) tiap malam.
# Simpan 14 salinan terakhir (format custom pg_dump) di ~/codeunical-backups.
#
# Restore: sudo -n docker exec -i codeunical-postgres pg_restore -U codeunical \
#            --clean --if-exists -d codeunical < <file.dump>
set -u

CONTAINER="codeunical-postgres"
DBUSER="codeunical"
DBNAME="codeunical"
DIR="$HOME/codeunical-backups"
LOG="$HOME/.codeunical-backup.log"
KEEP=14

log() { echo "$(date -Is) $*" >> "$LOG"; }

mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$DIR/codeunical-$STAMP.dump"

# Pastikan container DB jalan sebelum dump.
if ! sudo -n docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q "$CONTAINER"; then
  log "GAGAL: container $CONTAINER tidak berjalan"
  exit 1
fi

# pg_dump di dalam container (user codeunical = superuser image, tanpa sandi via socket lokal).
if sudo -n docker exec "$CONTAINER" \
    pg_dump -U "$DBUSER" --format=custom --no-owner --no-privileges "$DBNAME" > "$FILE" 2>> "$LOG"; then
  if [ ! -s "$FILE" ]; then
    log "GAGAL: hasil dump kosong -> hapus $FILE"
    rm -f "$FILE"
    exit 1
  fi
  SIZE=$(du -h "$FILE" | cut -f1)
  COUNT=$(ls -1 "$DIR"/codeunical-*.dump 2>/dev/null | wc -l)
  log "OK: $FILE ($SIZE, total $COUNT salinan)"
  # Rotasi: simpan KEEP terbaru, hapus sisanya.
  ls -1t "$DIR"/codeunical-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
else
  log "GAGAL: pg_dump error (lihat baris di atas)"
  rm -f "$FILE"
  exit 1
fi
