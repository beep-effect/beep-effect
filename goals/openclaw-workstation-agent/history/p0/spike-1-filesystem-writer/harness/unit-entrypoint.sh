#!/usr/bin/env bash
# Unit-private credential bridge. Secret values never enter argv or logs.
set -euo pipefail

: "${CREDENTIALS_DIRECTORY:?systemd credentials directory is required}"
: "${OPENCLAW_BIN:?OPENCLAW_BIN is required}"

IFS= read -r OPENCLAW_GATEWAY_TOKEN < "$CREDENTIALS_DIRECTORY/gateway-token" ||
  [[ -n "$OPENCLAW_GATEWAY_TOKEN" ]]
export OPENCLAW_GATEWAY_TOKEN
if test -s "$CREDENTIALS_DIRECTORY/telegram-token"; then
  IFS= read -r TELEGRAM_BOT_TOKEN < "$CREDENTIALS_DIRECTORY/telegram-token" ||
    [[ -n "$TELEGRAM_BOT_TOKEN" ]]
  export TELEGRAM_BOT_TOKEN
fi

exec "$OPENCLAW_BIN" gateway
