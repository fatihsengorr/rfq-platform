#!/usr/bin/env bash
# Deadline Reminder — triggered by systemd timer
# Calls the API's cron endpoint inside the Docker network
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.prod"

# Read CRON_SECRET from .env.prod
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: CRON_SECRET not found in $ENV_FILE" >&2
  exit 1
fi

# Call the API endpoint via Docker network (container name: rfq-api)
RESPONSE=$(docker exec rfq-api wget -q -O - \
  --header="X-Cron-Secret: $CRON_SECRET" \
  --post-data="" \
  "http://localhost:4000/api/cron/deadline-reminders" 2>&1) || {
  echo "ERROR: API call failed: $RESPONSE" >&2
  exit 1
}

echo "Deadline reminder result: $RESPONSE"
