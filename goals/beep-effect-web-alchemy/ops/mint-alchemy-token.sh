#!/usr/bin/env bash
# Mint (or rotate) the account-owned Cloudflare API token that the
# beep-effect-web Alchemy stack deploys with. The script stores it in 1Password as
# op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN and refreshes the
# GitHub environment secret beep-effect-web-prod/CLOUDFLARE_API_TOKEN. It
# revokes earlier tokens of the same name only after both stores hold the new
# one, so a failed run never leaves CI without a working token.
#
# Operator-run. It uses your `cf auth login` session. Reads go through the `op`
# agent shim. The write goes through `op-human`, because the agent service
# account is read-only on BEEP_SECRETS. Per the vault layout rule
# (docs/runbooks/onepassword-beep-secrets-layout.md), the field lands in the
# CLOUD section and is still referenced with the 3-part op:// form.
#
# The token value never appears in a process argument list. Every consumer
# reads it from stdin (curl config, the piped 1Password item, gh secret set),
# except jq, which reads it from its environment (owner-readable only). It is
# never printed, logged, or written to disk.
#
# Usage (repo root): bash goals/beep-effect-web-alchemy/ops/mint-alchemy-token.sh
set -euo pipefail
umask 077

readonly VAULT="BEEP_SECRETS"
readonly ITEM="BEEP_SECRETS"
readonly FIELD="CLOUD_CLOUDFLARE_ALCHEMY_TOKEN"
readonly SECTION="CLOUD"
readonly TOKEN_NAME="alchemy-beep-effect-web"
readonly GH_REPO="beep-effect/beep-effect"
readonly GH_ENV="beep-effect-web-prod"
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

for bin in cf op "$OP_WRITE" gh jq curl; do
  command -v "$bin" >/dev/null || { echo "missing: $bin" >&2; exit 1; }
done

CLOUDFLARE_ACCOUNT_ID="$(op read "op://${VAULT}/${ITEM}/CLOUD_CLOUDFLARE_ACCOUNT_ID")"
export CLOUDFLARE_ACCOUNT_ID

# Tokens of this name that exist before the mint; revoked only at the end.
previous_ids="$(cf accounts tokens list --per-page 50 | sed -n '/^[{[]/,$p' |
  jq -r --arg name "$TOKEN_NAME" '(.[]? // .result[]?) | select(.name == $name) | .id')"

policies="$(jq -cn \
  --arg account "com.cloudflare.api.account.${CLOUDFLARE_ACCOUNT_ID}" \
  --arg zone "com.cloudflare.api.account.zone.${ZONE_ID}" \
  --argjson accountGroups "$ACCOUNT_GROUPS" \
  --argjson zoneGroups "$ZONE_GROUPS" \
  '[{effect:"allow",resources:{($account):"*"},permission_groups:$accountGroups},
    {effect:"allow",resources:{($zone):"*"},permission_groups:$zoneGroups}]')"

echo "creating token '${TOKEN_NAME}' ..."
# stdout carries the JSON result (token included); stderr (errors, never the
# token) goes straight to the terminal.
if ! created="$(cf accounts tokens create --name "$TOKEN_NAME" --policies "$policies" | sed -n '/^[{[]/,$p')"; then
  echo "token create failed (see the error above); nothing was revoked" >&2
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
echo "minted token ${token_id:-unknown}; if a later step fails, delete it with: cf accounts tokens delete ${token_id:-<id>} --force"

status="$(printf 'header = "Authorization: Bearer %s"\n' "$token" |
  curl -fsS -K - "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/verify" |
  jq -r '.result.status // "unknown"')"
[[ "$status" == "active" ]] || { echo "new token verify status: ${status}" >&2; exit 1; }

# Store: patch the item JSON in a pipe (no argv assignment, no file).
"$OP_WRITE" item get "$ITEM" --vault "$VAULT" --format json |
  NEW_TOKEN="$token" jq --arg field "$FIELD" --arg section "$SECTION" '
    (.sections // [] | map(select(.label == $section)) | first | .id) as $sectionId
    | if any(.fields[]; .label == $field)
      then .fields |= map(if .label == $field then .value = env.NEW_TOKEN else . end)
      else .fields += [{label: $field, type: "CONCEALED", value: env.NEW_TOKEN}
                       + (if $sectionId then {section: {id: $sectionId}} else {} end)]
      end' |
  "$OP_WRITE" item edit "$ITEM" --vault "$VAULT" >/dev/null
echo "stored op://${VAULT}/${ITEM}/${FIELD}"

printf '%s' "$token" | gh secret set CLOUDFLARE_API_TOKEN --env "$GH_ENV" --repo "$GH_REPO"
unset token
echo "refreshed ${GH_ENV}/CLOUDFLARE_API_TOKEN"

for stale_id in $previous_ids; do
  [[ "$stale_id" == "$token_id" ]] && continue
  echo "revoking previous '${TOKEN_NAME}' token ${stale_id} ..."
  cf accounts tokens delete "$stale_id" --force >/dev/null
done

echo "done: token ${token_id:-unknown} active in 1Password and ${GH_ENV}"
