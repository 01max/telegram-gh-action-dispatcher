#!/bin/bash
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <worker_url> <setup_token>"
  echo ""
  echo "Registers the worker's /webhook endpoint as the Telegram webhook."
  echo ""
  echo "Arguments:"
  echo "  worker_url   The deployed worker URL (e.g. https://my-worker.username.workers.dev)"
  echo "  setup_token  The WEBHOOK_SECRET value (used as X-Setup-Token header)"
  echo ""
  echo "Example:"
  echo "  $0 https://telegram-dispatcher.username.workers.dev my-secret-token"
  exit 1
fi

WORKER_URL="${1%/}"
SETUP_TOKEN="$2"

echo "Registering webhook at ${WORKER_URL}/register ..."

curl -s -X POST "${WORKER_URL}/register" \
  -H "X-Setup-Token: ${SETUP_TOKEN}" \
  -H "Content-Type: application/json" | jq .
