#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <kv_namespace_id>"
  echo ""
  echo "Uploads projects.json to the dispatcher KV namespace."
  echo ""
  echo "Steps:"
  echo "  1. cp projects.example.json projects.json"
  echo "  2. Edit projects.json with your repo/chat mappings"
  echo "  3. Run: $0 <kv_namespace_id>"
  exit 1
fi

KV_ID="$1"
CONFIG_FILE="${PROJECTS_JSON:-projects.json}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: $CONFIG_FILE not found."
  echo "Copy projects.example.json and edit it first:"
  echo "  cp projects.example.json projects.json"
  exit 1
fi

echo "Seeding KV namespace $KV_ID with $CONFIG_FILE ..."
npx wrangler kv key put \
  --namespace-id "$KV_ID" \
  "projects" \
  --path "$CONFIG_FILE" \
  --remote
echo "Done."
