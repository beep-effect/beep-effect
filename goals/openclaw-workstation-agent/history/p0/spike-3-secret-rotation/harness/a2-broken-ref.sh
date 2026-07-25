#!/usr/bin/env bash
set -euo pipefail

HARNESS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib.sh
source "$HARNESS/lib.sh"
spike3_require_scratch

OP_REF=${SPIKE_OP_REF:?export SPIKE_OP_REF=op://vault/item/field}
S3=$SPIKE3_DIR
LOGS=$SPIKE3_LOGS
OC=$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw
NODE_DIR=$HOME/.local/share/mise/installs/node/24/bin
URL=ws://127.0.0.1:$SPIKE3_PORT
CONFIG=$SPIKE3_ETC_ROOT/current/openclaw.json
HOME_DIR=$S3/home
STATE=$S3/state
CLIENT_CONFIG=$S3/a2-client.json
MARKER=$S3/break-reference

fail() { spike3_fail "ASSERT-FAIL: $*"; }
section() { printf '\n=== %s ===\n' "$*"; }
run_client() {
  spike3_run_openclaw "$OC" "$NODE_DIR" "$HOME_DIR" "$CLIENT_CONFIG" "$STATE" "$@"
}
on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  rm -f -- "$MARKER"
  spike3_remove_client_config "$CLIENT_CONFIG" || rc=1
  if [[ -n ${current_value:-} ]]; then
    (spike3_scan_logs gateway "$current_value" \
      "$LOGS"/*.log "$LOGS"/*.json \
      "$S3/state/log/openclaw.log") || rc=1
  fi
  if [[ -n ${op_token:-} ]]; then
    (spike3_scan_logs service-account "$op_token" \
      "$LOGS"/*.log "$LOGS"/*.json \
      "$S3/state/log/openclaw.log") || rc=1
  fi
  unset OP_SERVICE_ACCOUNT_TOKEN op_token current_value
  if [[ "$rc" -ne 0 ]]; then
    SPIKE_P=$SPIKE3_P bash "$HARNESS/cleanup.sh" || true
  fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

spike3_require_ref "$OP_REF"
[[ -s "$LOGS/preflight.ok" &&
  -f "$LOGS/setup-capabilities-verified" ]] ||
  fail "verified setup capability evidence missing"
[[ -x "$OC" && -f "$CONFIG" ]] || fail "run setup.sh first"
spike3_assert_credential
systemctl --user is-active --quiet "$SPIKE3_UNIT" ||
  fail "gateway unit is not active"

spike3_assert_scratch_ownership
mkdir -p "$LOGS"
exec > >(tee -a "$LOGS/a2-broken-ref.log") 2>&1
op_token=$(<"$SPIKE3_CREDENTIAL")
export OP_SERVICE_ACCOUNT_TOKEN=$op_token
current_value=$(op read "$OP_REF" --no-newline)
[[ -n "$current_value" && "$current_value" != *$'\n'* &&
  "$current_value" != *$'\r'* ]] || fail "current token is empty or multiline"
spike3_write_client_config "$CONFIG" "$CLIENT_CONFIG" "$URL" "$current_value"

since=$(date --iso-8601=seconds)
gateway_log=$LOGS/gateway.log
openclaw_log=$S3/state/log/openclaw.log
gateway_before=$(wc -c <"$gateway_log" 2>/dev/null || printf 0)
openclaw_before=$(wc -c <"$openclaw_log" 2>/dev/null || printf 0)

section "activate nonexistent-field resolver target"
: >"$MARKER"
set +e
run_client secrets reload --json \
  >"$LOGS/a2-failed-reload.log" 2>&1
broken_rc=$?
set -e
[[ "$broken_rc" -ne 0 ]] || fail "broken-reference reload unexpectedly succeeded"
grep -qiE 'resolve|1password|field|not found|does not exist' \
  "$LOGS/a2-failed-reload.log" ||
  fail "failed reload lacks a secret-resolution failure signature"

{
  tail -c "+$((gateway_before + 1))" "$gateway_log" 2>/dev/null || true
  tail -c "+$((openclaw_before + 1))" "$openclaw_log" 2>/dev/null || true
  journalctl --user -u "$SPIKE3_UNIT" --since "$since" --no-pager \
    2>/dev/null || true
} >"$LOGS/a2-failed-reload-alert.log"
grep -qi 'secrets.reload failed' "$LOGS/a2-failed-reload-alert.log" ||
  fail "degraded-reload alert signal missing from gateway logs/journal"
printf 'ASSERT-PASS: broken reference caused causal reload failure and alert\n'

section "restore exact reference and prove clean reload"
rm -f -- "$MARKER"
run_client secrets reload --json \
  >"$LOGS/a2-restored-reload.log" 2>&1 ||
  fail "reload after exact reference restore failed"
jq -e '(.ok == true) and (.warningCount == 0)' \
  "$LOGS/a2-restored-reload.log" >/dev/null ||
  fail "restored reload did not prove ok=true and warningCount=0"
printf 'ASSERT-PASS: exact op:// reference restored and current\n'

section "evidence secret scan"
for file in "$LOGS"/*.log "$LOGS"/*.json "$S3/state/log/openclaw.log"; do
  [[ -e "$file" ]] || continue
  spike3_scan_logs gateway "$current_value" "$file"
  spike3_scan_logs service-account "$op_token" "$file"
done
