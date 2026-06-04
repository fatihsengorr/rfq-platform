#!/usr/bin/env bash
# PostgreSQL daily backup — triggered by systemd timer.
#
# Dumps the production database (custom/compressed format) from inside the
# rfq-postgres container, uploads it to S3 under a db-backups/ prefix, then
# prunes backups older than the retention window.
#
# All credentials are read from .env.prod at runtime — nothing is baked into
# this script or the systemd unit.
#
# Restore procedure: see deploy/lightsail/RESTORE.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.prod"
CONTAINER="rfq-postgres"
RETENTION_DAYS=14
PREFIX="db-backups"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

# Pull only the keys we need from .env.prod (strip quotes).
getenv() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

POSTGRES_USER="$(getenv POSTGRES_USER)"
POSTGRES_DB="$(getenv POSTGRES_DB)"
STORAGE_BUCKET="$(getenv STORAGE_BUCKET)"
STORAGE_REGION="$(getenv STORAGE_REGION)"
STORAGE_ACCESS_KEY="$(getenv STORAGE_ACCESS_KEY)"
STORAGE_SECRET_KEY="$(getenv STORAGE_SECRET_KEY)"

for v in POSTGRES_USER POSTGRES_DB STORAGE_BUCKET STORAGE_REGION STORAGE_ACCESS_KEY STORAGE_SECRET_KEY; do
  if [ -z "${!v}" ]; then
    echo "ERROR: $v missing in $ENV_FILE" >&2
    exit 1
  fi
done

# Date-stamped key. Sorts lexicographically = chronologically.
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILENAME="rfq_${POSTGRES_DB}_${STAMP}.dump"
LOCAL_PATH="/tmp/${FILENAME}"
S3_URI="s3://${STORAGE_BUCKET}/${PREFIX}/${FILENAME}"

cleanup() { rm -f "$LOCAL_PATH"; }
trap cleanup EXIT

echo "[$(date -u +%H:%M:%S)] Dumping ${POSTGRES_DB} from ${CONTAINER}..."
# -Fc = custom format (compressed, supports pg_restore). Local socket inside
# the container uses trust auth, so no password is needed.
docker exec "$CONTAINER" pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$LOCAL_PATH"

# Sanity check: a real dump is never tiny. Guards against a silent failure
# producing a 0-byte file that would overwrite our only good backup.
SIZE=$(stat -c%s "$LOCAL_PATH")
if [ "$SIZE" -lt 1000 ]; then
  echo "ERROR: dump is suspiciously small (${SIZE} bytes) — aborting upload" >&2
  exit 1
fi
echo "[$(date -u +%H:%M:%S)] Dump OK (${SIZE} bytes). Uploading to ${S3_URI}..."

export AWS_ACCESS_KEY_ID="$STORAGE_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$STORAGE_SECRET_KEY"
export AWS_DEFAULT_REGION="$STORAGE_REGION"

# SSE-S3 server-side encryption at rest.
aws s3 cp "$LOCAL_PATH" "$S3_URI" --sse AES256 --only-show-errors

echo "[$(date -u +%H:%M:%S)] Upload complete."

# ── Rotation: delete backups older than RETENTION_DAYS ──────────────
# Parse the ISO date out of each key and compare to the cutoff. We do this
# client-side (rather than an S3 lifecycle rule) so the whole policy lives
# in one place and needs no console setup.
CUTOFF=$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
echo "[$(date -u +%H:%M:%S)] Pruning backups older than ${CUTOFF}..."

aws s3 ls "s3://${STORAGE_BUCKET}/${PREFIX}/" --recursive | while read -r line; do
  key=$(echo "$line" | awk '{print $4}')
  # Extract YYYY-MM-DD from the filename (rfq_<db>_YYYY-MM-DDT...).
  fdate=$(echo "$key" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  [ -z "$fdate" ] && continue
  if [[ "$fdate" < "$CUTOFF" ]]; then
    echo "  deleting old backup: $key"
    aws s3 rm "s3://${STORAGE_BUCKET}/${key}" --only-show-errors
  fi
done

echo "[$(date -u +%H:%M:%S)] Backup job finished successfully."
