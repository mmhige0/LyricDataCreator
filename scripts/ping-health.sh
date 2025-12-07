#!/usr/bin/env bash
set -euo pipefail

URL="${HEALTHCHECK_URL:-}"
RETRIES="${RETRIES:-3}"
SLEEP_SECS="${SLEEP_SECS:-5}"
TIMEOUT_SECS="${TIMEOUT_SECS:-10}"

if [ -z "$URL" ]; then
  echo "HEALTHCHECK_URL is not set. Export it before running."
  exit 1
fi

for i in $(seq 1 "$RETRIES"); do
  if curl -fsS --max-time "$TIMEOUT_SECS" "$URL"; then
    echo "Health check succeeded on attempt $i"
    exit 0
  fi
  echo "Attempt $i failed, retrying in $SLEEP_SECS seconds..."
  sleep "$SLEEP_SECS"
done

echo "Health check failed after $RETRIES attempts"
exit 1
