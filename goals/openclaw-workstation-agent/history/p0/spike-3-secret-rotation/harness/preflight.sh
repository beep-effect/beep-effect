#!/usr/bin/env bash
set -euo pipefail

HARNESS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib.sh
source "$HARNESS/lib.sh"
spike3_require_scratch

S3=$SPIKE3_DIR
LOGS=$SPIKE3_LOGS
CAPS=$LOGS/capabilities
PREFLIGHT_HOME=$S3/preflight-home
PREFLIGHT_STATE=$S3/preflight-state
NODE_DIR=$HOME/.local/share/mise/installs/node/24/bin
PACKAGE=$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/openclaw
OC=$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw

fail() { spike3_fail "PREFLIGHT-BLOCKED: $*"; }
section() { printf '\n=== %s ===\n' "$*"; }
capture_help() {
  local name=$1
  shift
  set +e
  "$@" >"$CAPS/$name.txt" 2>&1
  local rc=$?
  set -e
  [[ "$rc" -eq 0 ]] || fail "$name --help exited $rc"
}
require_flag() {
  local help_file=$1 flag=$2
  grep -Eo -- '--[[:alnum:]-]+' "$help_file" | grep -Fxq -- "$flag" ||
    fail "$(basename "$help_file") lacks exact flag $flag"
  printf '%s %s\n' "$(basename "$help_file")" "$flag"
}

[[ -x "$OC" && -d "$PACKAGE" ]] || fail "staged OpenClaw package is missing"
[[ -x "$NODE_DIR/node" ]] || fail "staged Node 24 is missing"
for command in jq npm op openssl rg sha256sum systemctl ss realpath stat; do
  command -v "$command" >/dev/null || fail "required command missing: $command"
done

[[ -d "$SPIKE3_P" && ! -L "$SPIKE3_P" &&
  "$(realpath -e -- "$SPIKE3_P")" == "$SPIKE3_P" ]] ||
  fail "SPIKE_P must already be a canonical, non-symlink directory"
[[ "$(stat -c '%u:%a' -- "$SPIKE3_P")" == "$(id -u):700" ]] ||
  fail "SPIKE_P must be owned by the runner and mode 0700"
if find "$SPIKE3_P" -mindepth 1 -print -quit | grep -q .; then
  fail "SPIKE_P must be empty before the first preflight"
fi
mkdir -p "$CAPS" "$PREFLIGHT_HOME" "$PREFLIGHT_STATE"
chmod 0700 "$S3" "$LOGS" "$CAPS" "$PREFLIGHT_HOME" "$PREFLIGHT_STATE"
scratch_nonce=$(openssl rand -hex 16)
printf '%s\n' "$scratch_nonce" >"$S3/.beep-spike3-scratch"
printf '%s\n' "$scratch_nonce" >"$LOGS/preflight-nonce"
: >"$LOGS/privileged-paths.manifest"
chmod 0600 "$S3/.beep-spike3-scratch" "$LOGS/preflight-nonce" \
  "$LOGS/privileged-paths.manifest"
unset scratch_nonce
spike3_assert_scratch_ownership
exec > >(tee -a "$LOGS/preflight.log") 2>&1
HELP_ENV=(env -i
  PATH="$NODE_DIR:/usr/bin:/bin"
  HOME="$PREFLIGHT_HOME"
  OPENCLAW_CONFIG_PATH="$S3/preflight-openclaw.json"
  OPENCLAW_STATE_DIR="$PREFLIGHT_STATE")
spike3_assert_config_path "$S3/preflight-openclaw.json"

section "no-secret capability surfaces"
capture_help logs-help "${HELP_ENV[@]}" "$OC" logs --help
capture_help secrets-reload-help "${HELP_ENV[@]}" "$OC" secrets reload --help
capture_help gateway-call-help "${HELP_ENV[@]}" "$OC" gateway call --help
capture_help agent-help "${HELP_ENV[@]}" "$OC" agent --help
capture_help channels-status-help "${HELP_ENV[@]}" "$OC" channels status --help

require_flag "$CAPS/logs-help.txt" --follow
require_flag "$CAPS/logs-help.txt" --url
require_flag "$CAPS/secrets-reload-help.txt" --url
require_flag "$CAPS/secrets-reload-help.txt" --json
require_flag "$CAPS/gateway-call-help.txt" --url
require_flag "$CAPS/gateway-call-help.txt" --json
require_flag "$CAPS/agent-help.txt" --agent
require_flag "$CAPS/agent-help.txt" --session-key
require_flag "$CAPS/agent-help.txt" --message
require_flag "$CAPS/agent-help.txt" --thinking
require_flag "$CAPS/agent-help.txt" --timeout
require_flag "$CAPS/agent-help.txt" --json
require_flag "$CAPS/channels-status-help.txt" --channel
require_flag "$CAPS/channels-status-help.txt" --probe
require_flag "$CAPS/channels-status-help.txt" --timeout
require_flag "$CAPS/channels-status-help.txt" --json

section "non-argv authentication source proof"
rg -l --glob '*.js' \
  'default: OPENCLAW_GATEWAY_TOKEN env if set' "$PACKAGE/dist" \
  >"$CAPS/openclaw-gateway-token-env-source.txt"
[[ -s "$CAPS/openclaw-gateway-token-env-source.txt" ]] ||
  fail "staged CLI does not advertise OPENCLAW_GATEWAY_TOKEN environment auth"
printf 'OPENCLAW_GATEWAY_TOKEN environment auth found in staged CLI source\n'
rg -l --glob '*.js' 'fallbackFrom: "gateway"' "$PACKAGE/dist" \
  >"$CAPS/agent-gateway-fallback-source.txt"
[[ -s "$CAPS/agent-gateway-fallback-source.txt" ]] ||
  fail "cannot prove the staged agent CLI marks embedded fallback"
printf 'agent embedded-fallback marker found in staged CLI source\n'

section "pinned immutable inputs"
registry_json=$(npm --cache "$S3/npm-cache" view \
  openclaw@2026.7.1-2 dist.shasum dist.integrity --json)
# npm --json returns the requested fields under their dotted literal keys
jq -e '.["dist.shasum"] and .["dist.integrity"]' <<<"$registry_json" >/dev/null ||
  fail "registry shasum/integrity unavailable"
package_tree_sha=$(spike3_tree_hash "$PACKAGE")
jq -n \
  --arg openclaw "$("${HELP_ENV[@]}" "$OC" --version 2>&1 | head -n 1)" \
  --arg node "$("$NODE_DIR/node" --version)" \
  --arg op "$(op --version)" \
  --arg registryShasum "$(jq -r '.["dist.shasum"]' <<<"$registry_json")" \
  --arg registryIntegrity "$(jq -r '.["dist.integrity"]' <<<"$registry_json")" \
  --arg packageTreeRecipe \
    'find -P, sort NUL paths, record quoted relative path/type/mode/uid/gid/size/content sha256 or symlink target, sha256 manifest' \
  --arg packageTreeSha "$package_tree_sha" \
  '{openclaw:$openclaw,node:$node,op:$op,
    registry:{shasum:$registryShasum,integrity:$registryIntegrity},
    stagedPackage:{recipe:$packageTreeRecipe,sha256:$packageTreeSha}}' \
  >"$LOGS/preflight-versions.json"
printf 'versions and package provenance archived\n'

section "pre-setup isolation inventory"
if [[ -e "$SPIKE3_ETC_ROOT" || -L "$SPIKE3_ETC_ROOT" ]]; then
  fail "$SPIKE3_ETC_ROOT must be absent before credential provisioning"
fi
[[ -d /etc/beep && ! -L /etc/beep &&
  "$(realpath -e -- /etc/beep)" == /etc/beep &&
  "$(stat -Lc '%u:%g:%a:%F' -- /etc/beep)" == "0:0:755:directory" ]] ||
  fail "/etc/beep is an operator prerequisite: canonical root:root mode 0755"
printf 'present:0:0:755:directory\n' >"$LOGS/preflight-etc-beep.state"
spike3_inventory "$HOME/.openclaw" >"$LOGS/preflight-real-openclaw.inventory"
{
  for path in "$SPIKE3_ETC_ROOT" "$S3/state" "$S3/home" "$S3/workspace"; do
    if [[ -e "$path" || -L "$path" ]]; then
      printf 'path=%s state=present\n' "$path"
    else
      printf 'path=%s state=absent\n' "$path"
    fi
  done
} >"$LOGS/preflight-runtime.inventory"
{
  spike3_assert_unit_owned_or_absent
  control_group=$(systemctl --user show "$SPIKE3_UNIT" -p ControlGroup --value \
    2>/dev/null || true)
  printf 'fragment=%s\n' \
    "$(systemctl --user show "$SPIKE3_UNIT" -p FragmentPath --value 2>/dev/null || true)"
  printf 'control-group=%s\n' "$control_group"
  printf 'listener-pids='
  ss -ltnpH "sport = :$SPIKE3_PORT" 2>/dev/null |
    sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -nu | paste -sd, -
  printf '\nmatching-pids='
  spike3_matching_pids "$S3/state" "$OC" "$NODE_DIR/node" \
    "$control_group" "$SPIKE3_PORT" | sort -nu | paste -sd, -
  printf '\nmanager-secret-variable-names='
  manager_secret_names=$(systemctl --user show-environment 2>/dev/null |
    cut -d= -f1 |
    grep -E '^(OP_SERVICE_ACCOUNT_TOKEN|OPENCLAW_GATEWAY_TOKEN|SPIKE_TG_BOT_TOKEN)$' |
    paste -sd, - || true)
  printf '%s' "$manager_secret_names"
  printf '\n'
} >"$LOGS/preflight-system.inventory"
[[ -z "$manager_secret_names" ]] ||
  fail "user manager already contains a secret variable"
sha256sum "$CAPS"/*.txt "$LOGS/preflight-versions.json" |
  sha256sum | cut -d' ' -f1 >"$LOGS/preflight.ok"
printf 'PREFLIGHT-PASS: no privileged, 1Password, unit, or Telegram mutation performed\n'
