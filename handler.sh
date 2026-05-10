#!/bin/bash
set -euo pipefail

COMMAND="$1"
CHAT_ID="$2"
ARGS="${3:-}"
BOT_TOKEN="$4"

if [ ! -x "bin/handle_command" ]; then
  echo "Error: bin/handle_command not found or not executable in consumer repository."
  echo "The consumer project must provide an executable bin/handle_command"
  echo "that accepts: <command> <chat_id> <args> <bot_token>"
  exit 1
fi

exec bin/handle_command "$COMMAND" "$CHAT_ID" "$ARGS" "$BOT_TOKEN"
