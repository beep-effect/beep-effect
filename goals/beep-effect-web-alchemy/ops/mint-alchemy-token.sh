#!/usr/bin/env bash
# Mint the account-owned Cloudflare API token that the beep-effect-web Alchemy
# stack deploys with, verify it, and store it in 1Password as
# op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN.
#
# Operator-run: uses your `cf auth login` session. Reads go through the `op`
# agent shim; the write goes through `op-human`, because the agent service
# account is read-only on BEEP_SECRETS. Per the vault layout rule
# (docs/runbooks/onepassword-beep-secrets-layout.md), the field lands in the
# CLOUD section and is still referenced with the 3-part op:// form.
# The token value is held only in a shell variable: it is never printed,
# logged, or written to disk.
#
# Usage: bash goals/beep-effect-web-alchemy/ops/mint-alchemy-token.sh
set -euo pipefail
umask 077

readonly VAULT="BEEP_SECRETS"
readonly ITEM="BEEP_SECRETS"
readonly FIELD="CLOUD_CLOUDFLARE_ALCHEMY_TOKEN"
readonly SECTION="CLOUD"
readonly TOKEN_NAME="alchemy-beep-effect-web"
readonly OP_WRITE="${OP_BIN:-op-human}"
readonly ZONE_ID="82866058fd8b10c4875b1ed4d97a8948" # beep-effect.com

# Permission group IDs resolved from `cf accounts tokens permission-groups list` on 2026-10-28.
readonly ACCOUNT_GROUPS='[
  {"id":"e086da7e2179491d91ee5f35b3ca210a"},
  {"id":"adc8fa2bc6124928a8b3314dc63a1235"},
  {"id":"c1fde68c7bcc44588cbb6ddbc16d6480"}
]' # Workers Scripts Write, Secrets Store Write, Account Settings Read
readonly ZONE_GROUPS='[
  {"id":"c8fed203ed3043cba015a93ad1616f1f"},
  {"id":"4755a26eedb94da69e1066d98aa820be"},
  {"id":"28f4b596e7d643029c524985477ae49a"},
  {"id":"74e1036f577a48528b78d2413b40538d"}
]' # Zone Read, DNS Write, Workers Routes Write, Dynamic URL Redirects Write

for bin in cf op "$OP_WRITE" jq curl; do
  command -v "$bin" >/dev/null || { echo "missing: $bin" >&2; exit 1; }
done

CLOUDFLARE_ACCOUNT_ID="$(op read "op://${VAULT}/${ITEM}/CLOUD_CLOUDFLARE_ACCOUNT_ID")"
export CLOUDFLARE_ACCOUNT_ID

if op item get "$ITEM" --vault "$VAULT" --fields "label=${FIELD}" >/dev/null 2>&1; then
  echo "note: ${FIELD} already exists and will be overwritten"
fi

policies="$(jq -cn \
  --arg account "com.cloudflare.api.account.${CLOUDFLARE_ACCOUNT_ID}" \
  --arg zone "com.cloudflare.api.account.zone.${ZONE_ID}" \
  --argjson accountGroups "$ACCOUNT_GROUPS" \
  --argjson zoneGroups "$ZONE_GROUPS" \
  '[{effect:"allow",resources:{($account):"*"},permission_groups:$accountGroups},
    {effect:"allow",resources:{($zone):"*"},permission_groups:$zoneGroups}]')"

# A token with this name whose value never reached 1Password is unrecoverable
# (Cloudflare shows a value once), so replace it rather than accumulate orphans.
stale_ids="$(cf accounts tokens list --per-page 50 | sed -n '/^[{[]/,$p' |
  jq -r --arg name "$TOKEN_NAME" '(.[]? // .result[]?) | select(.name == $name) | .id')"
for stale_id in $stale_ids; do
  echo "deleting previous '${TOKEN_NAME}' token ${stale_id} ..."
  cf accounts tokens delete "$stale_id" --force >/dev/null
done

echo "creating token '${TOKEN_NAME}' ..."
# stdout carries the JSON result (token included); stderr (errors, never the
# token) goes straight to the terminal.
if ! created="$(cf accounts tokens create --name "$TOKEN_NAME" --policies "$policies" | sed -n '/^[{[]/,$p')"; then
  echo "token create failed (see the error above)" >&2
  exit 1
fi

token="$(printf '%s' "$created" | jq -r '.value // .result.value // empty' 2>/dev/null || true)"
if [[ -z "$token" ]]; then
  echo "token create returned no value; output shape (values redacted):" >&2
  printf '%s' "$created" | jq 'del(.value, .result.value)' >&2 2>/dev/null || echo "<non-JSON output>" >&2
  exit 1
fi
token_id="$(printf '%s' "$created" | jq -r '.id // .result.id // empty')"
unset created

status="$(curl -fsS -H "Authorization: Bearer ${token}" \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/verify" |
  jq -r '.result.status // "unknown"')"
[[ "$status" == "active" ]] || { echo "new token verify status: ${status}" >&2; exit 1; }

# If the write fails, the next run deletes this token and mints a fresh one.

"$OP_WRITE" item edit "$ITEM" --vault "$VAULT" "${SECTION}.${FIELD}[password]=${token}" >/dev/null
unset token

echo "stored op://${VAULT}/${ITEM}/${FIELD} (token id ${token_id:-unknown}, status active)"
echo "the old CLOUD_CLOUDFLARE_ACCOUNT_IAC_TOKEN is untouched"
