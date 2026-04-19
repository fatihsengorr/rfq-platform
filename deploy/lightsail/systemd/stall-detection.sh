#!/usr/bin/env bash
# Stall Detection — triggered by systemd timer
# Calls the API's cron endpoint from the host via localhost.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.prod"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: CRON_SECRET not found in $ENV_FILE" >&2
  exit 1
fi

RESPONSE=$(curl -s -f -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  "http://localhost:4000/api/cron/stall-detection") || {
  echo "ERROR: API call failed (curl exit code: $?)" >&2
  exit 1
}

echo "Stall detection result: $RESPONSE"
