#!/usr/bin/env bash
set -euo pipefail

HARNESS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib.sh
source "$HARNESS/lib.sh"
spike3_require_scratch

OP_REF=${SPIKE_OP_REF:?export SPIKE_OP_REF=op://vault/item/field}
ROTATION_TIMEOUT=${SPIKE_ROTATION_TIMEOUT_SECONDS:-300}
S3=$SPIKE3_DIR
LOGS=$SPIKE3_LOGS
OC=$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw
NODE_DIR=$HOME/.local/share/mise/installs/node/24/bin
URL=ws://127.0.0.1:$SPIKE3_PORT
CONFIG=$SPIKE3_ETC_ROOT/current/openclaw.json
HOME_DIR=$S3/home
STATE=$S3/state
OLD_CLIENT_CONFIG=$S3/a1-old-client.json
NEW_CLIENT_CONFIG=$S3/a1-new-client.json
ACP_INPUT=$S3/a1-old-token-cold-owner.stdin
setup_verified=0

fail() { spike3_fail "ASSERT-FAIL: $*"; }
fp() { printf %s "$1" | sha256sum | cut -c1-8; }
section() { printf '\n=== %s ===\n' "$*"; }
run_client() {
  local config=$1
  shift
  spike3_run_openclaw "$OC" "$NODE_DIR" "$HOME_DIR" "$config" "$STATE" "$@"
}
on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if [[ -n ${cold_pid:-} ]]; then
    kill "$cold_pid" 2>/dev/null || true
    wait "$cold_pid" 2>/dev/null || true
  fi
  if [[ -n ${cold_input_fd:-} ]]; then
    exec {cold_input_fd}>&-
  fi
  rm -f -- "$ACP_INPUT"
  spike3_remove_client_config "$OLD_CLIENT_CONFIG" || rc=1
  spike3_remove_client_config "$NEW_CLIENT_CONFIG" || rc=1
  if [[ -n ${old_value:-} ]]; then
    (spike3_scan_logs old-gateway "$old_value" \
      "$LOGS"/*.log "$LOGS"/*.json \
      "$S3/state/log/openclaw.log") || rc=1
  fi
  if [[ -n ${new_value:-} ]]; then
    (spike3_scan_logs new-gateway "$new_value" \
      "$LOGS"/*.log "$LOGS"/*.json \
      "$S3/state/log/openclaw.log") || rc=1
  fi
  if [[ -n ${op_token:-} ]]; then
    (spike3_scan_logs service-account "$op_token" \
      "$LOGS"/*.log "$LOGS"/*.json \
      "$S3/state/log/openclaw.log") || rc=1
  fi
  unset OP_SERVICE_ACCOUNT_TOKEN op_token old_value new_value observed
  if [[ "$rc" -ne 0 && "$setup_verified" -eq 1 ]]; then
    printf 'restoring verified setup after failed a1 assertion\n'
    if SPIKE_P=$SPIKE3_P bash "$HARNESS/setup.sh"; then
      printf 'setup-restored-after-a1-failure=yes\n'
    else
      printf 'ASSERT-FAIL: setup restoration after a1 failure failed\n' >&2
      rc=1
    fi
  fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

spike3_require_ref "$OP_REF"
[[ "$ROTATION_TIMEOUT" =~ ^[1-9][0-9]*$ ]] ||
  fail "SPIKE_ROTATION_TIMEOUT_SECONDS must be a positive integer"
[[ -s "$LOGS/preflight.ok" &&
  -f "$LOGS/setup-capabilities-verified" ]] ||
  fail "verified setup capability evidence missing"
[[ -x "$OC" && -f "$CONFIG" ]] || fail "run setup.sh first"
spike3_assert_credential
systemctl --user is-active --quiet "$SPIKE3_UNIT" ||
  fail "gateway unit is not active"
setup_verified=1

spike3_assert_scratch_ownership
mkdir -p "$LOGS"
exec > >(tee -a "$LOGS/a1-rotate.log") 2>&1

op_token=$(<"$SPIKE3_CREDENTIAL")
export OP_SERVICE_ACCOUNT_TOKEN=$op_token
old_value=$(op read "$OP_REF" --no-newline)
[[ -n "$old_value" && "$old_value" != *$'\n'* &&
  "$old_value" != *$'\r'* ]] || fail "old value is empty or multiline"
old_fp=$(fp "$old_value")
spike3_write_client_config "$CONFIG" "$OLD_CLIENT_CONFIG" "$URL" "$old_value"

section "establish old-snapshot cold owner"
[[ ! -e "$ACP_INPUT" && ! -L "$ACP_INPUT" ]] ||
  fail "cold-owner ACP input path already exists"
mkfifo -m 0600 "$ACP_INPUT"
exec {cold_input_fd}<>"$ACP_INPUT"
(
  spike3_assert_config_path "$OLD_CLIENT_CONFIG"
  exec env -i PATH="$NODE_DIR:/usr/bin:/bin" HOME="$HOME_DIR" \
    OPENCLAW_CONFIG_PATH="$OLD_CLIENT_CONFIG" OPENCLAW_STATE_DIR="$STATE" \
    "$OC" acp
) <"$ACP_INPUT" >"$LOGS/a1-old-token-cold-owner.log" \
  2>"$LOGS/a1-old-token-cold-owner.stderr.log" &
cold_pid=$!
jq -cn '{
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: 1,
    clientCapabilities: {
      fs: {readTextFile: false, writeTextFile: false},
      terminal: false
    },
    clientInfo: {name: "beep-spike3", version: "1"}
  }
}' >&"$cold_input_fd"
jq -cn --arg cwd "$S3/workspace" '{
  jsonrpc: "2.0",
  id: 2,
  method: "session/list",
  params: {cwd: $cwd}
}' >&"$cold_input_fd"
cold_socket_inode=
cold_response_ready=0
deadline=$((SECONDS + 10))
while ((SECONDS < deadline)); do
  kill -0 "$cold_pid" 2>/dev/null ||
    fail "old-token cold-owner client did not remain connected"
  if jq -e -s '
    . as $frames |
    ($frames | map(select(
      .jsonrpc == "2.0" and
      .id == 1 and
      .result.protocolVersion == 1 and
      (.result.agentCapabilities | type == "object") and
      (.result.authMethods | type == "array") and
      (.error? == null)
    ))) as $first |
    ($frames | map(select(
      .jsonrpc == "2.0" and
      .id == 2 and
      (.result | type == "object") and
      (.result.sessions | type == "array") and
      (.error? == null)
    ))) as $gateway |
    select(($first | length) == 1 and ($gateway | length) == 1) |
    {firstResponse: $first[0], gatewayBackedResponse: $gateway[0]}
  ' "$LOGS/a1-old-token-cold-owner.log" \
    >"$LOGS/a1-old-token-cold-owner-frame.json.new" 2>/dev/null; then
    mv -f -- "$LOGS/a1-old-token-cold-owner-frame.json.new" \
      "$LOGS/a1-old-token-cold-owner-frame.json"
    cold_response_ready=1
  fi
  # the ACP CLI holds its gateway WS in a CHILD process (verified 2026-07-26
  # in diag-repro: tree='parent child', socket ESTABLISHED on the child and
  # persistent), so scan the whole process tree, not just $cold_pid's fds
  cold_tree="$cold_pid"
  for _pass in 1 2; do
    for tp in $cold_tree; do
      for tc in $(cat /proc/"$tp"/task/*/children 2>/dev/null); do
        case " $cold_tree " in *" $tc "*) ;; *) cold_tree="$cold_tree $tc" ;; esac
      done
    done
  done
  for tp in $cold_tree; do
    for fd in /proc/"$tp"/fd/*; do
      [[ -L "$fd" ]] || continue
      target=$(readlink -- "$fd") || continue
      [[ "$target" =~ ^socket:\[([0-9]+)\]$ ]] || continue
      inode=${BASH_REMATCH[1]}
      if awk -v inode="$inode" -v lp="0100007F:$(printf '%04X' "$SPIKE3_PORT")" \
        '$3 == lp && $4 == "01" && $10 == inode { found=1 }
         END { exit !found }' /proc/net/tcp /proc/net/tcp6; then
        cold_socket_inode=$inode
        break 2
      fi
    done
  done
  if [[ "$cold_response_ready" -eq 1 && -n "$cold_socket_inode" ]]; then
    break
  fi
  sleep 1
done
rm -f -- "$LOGS/a1-old-token-cold-owner-frame.json.new"
[[ -n "$cold_socket_inode" ]] ||
  fail "old-token cold-owner lacks an established loopback gateway socket"
[[ "$cold_response_ready" -eq 1 ]] ||
  fail "old-token cold-owner lacks pinned ACP first/gateway-backed responses"
kill -0 "$cold_pid" 2>/dev/null ||
  fail "old-token cold-owner exited after connection proof"
printf 'cold-owner-connected=acp socket-inode=%s old-sha256-prefix=%s\n' \
  "$cold_socket_inode" "$old_fp"

section "operator rotation at unchanged reference"
printf '%s\n' \
  "ROTATE-NOW: replace the disposable field in the 1Password UI; do not use an argv-valued op edit."
printf 'polling unchanged reference=%s timeout-seconds=%s\n' \
  "$OP_REF" "$ROTATION_TIMEOUT"
deadline=$((SECONDS + ROTATION_TIMEOUT))
new_value=
while ((SECONDS < deadline)); do
  observed=$(op read "$OP_REF" --no-newline)
  [[ -n "$observed" && "$observed" != *$'\n'* &&
    "$observed" != *$'\r'* ]] || fail "observed value is empty or multiline"
  if [[ "$(fp "$observed")" != "$old_fp" ]]; then
    new_value=$observed
    break
  fi
  sleep 2
done
[[ -n "$new_value" ]] ||
  fail "rotation was not observed before timeout; no reload attempted"
new_fp=$(fp "$new_value")
[[ "$new_fp" != "$old_fp" ]] || fail "fingerprint did not change"
spike3_write_client_config "$CONFIG" "$NEW_CLIENT_CONFIG" "$URL" "$new_value"
printf 'before sha256-prefix=%s length=%s\n' "$old_fp" "${#old_value}"
printf 'after  sha256-prefix=%s length=%s reference-unchanged=yes\n' \
  "$new_fp" "${#new_value}"

section "reload through old authenticated snapshot"
set +e
run_client "$OLD_CLIENT_CONFIG" secrets reload --json \
  >"$LOGS/a1-first-reload.log" 2>&1
first_rc=$?
set -e
printf 'first-reload-exit=%s disconnect-on-generation-change-allowed=yes\n' \
  "$first_rc"

section "clean current-snapshot degradation check"
run_client "$NEW_CLIENT_CONFIG" secrets reload --json \
  >"$LOGS/a1-current-reload.log" 2>&1 ||
  fail "reload with the rotated token failed"
jq -e '(.ok == true) and (.warningCount == 0)' \
  "$LOGS/a1-current-reload.log" >/dev/null ||
  fail "current reload did not prove ok=true and warningCount=0"
for _ in {1..10}; do
  if ! awk -v inode="$cold_socket_inode" \
    '$10 == inode { found=1 } END { exit !found }' \
    /proc/net/tcp /proc/net/tcp6; then
    break
  fi
  sleep 1
done
awk -v inode="$cold_socket_inode" \
  '$10 == inode { found=1 } END { exit !found }' \
  /proc/net/tcp /proc/net/tcp6 &&
  fail "pre-rotation old-token socket inode remains present"
exec {cold_input_fd}>&-
unset cold_input_fd
kill "$cold_pid" 2>/dev/null || true
wait "$cold_pid" 2>/dev/null || true
[[ ! -d /proc/"$cold_pid" ]] ||
  fail "disconnected pre-rotation client PID remains"
unset cold_pid
printf 'cold-owner-disconnected=yes client-terminated=yes socket-inode-absent=%s\n' \
  "$cold_socket_inode"

section "old value rejected and new value accepted"
set +e
run_client "$OLD_CLIENT_CONFIG" gateway call health --json \
  >"$LOGS/a1-old-token-probe.log" 2>&1
old_rc=$?
set -e
[[ "$old_rc" -ne 0 ]] || fail "old token still authenticates"
grep -qiE 'unauthori[sz]ed|forbidden|authentication|invalid.*token|token.*invalid' \
  "$LOGS/a1-old-token-probe.log" ||
  fail "old-token failure lacks an authentication-rejection signature"
run_client "$NEW_CLIENT_CONFIG" gateway call health --json \
  >"$LOGS/a1-new-token-probe.log" 2>&1 ||
  fail "new token does not authenticate"
grep -qiE '"ok"[[:space:]]*:[[:space:]]*true|healthy|health' \
  "$LOGS/a1-new-token-probe.log" ||
  fail "new-token probe lacks a health-success signature"

section "evidence secret scan"
for file in "$LOGS"/*.log "$LOGS"/*.json "$S3/state/log/openclaw.log"; do
  [[ -e "$file" ]] || continue
  spike3_scan_logs old-gateway "$old_value" "$file"
  spike3_scan_logs new-gateway "$new_value" "$file"
  spike3_scan_logs service-account "$op_token" "$file"
done
printf 'ASSERT-PASS: current snapshot clean; cold owner disconnected; old auth rejected; new auth accepted\n'
unset OP_SERVICE_ACCOUNT_TOKEN op_token

section "chain assertion 3 to this rotation event"
chain_nonce=$(openssl rand -hex 12)
reload_epoch=$(date +%s)
printf '%s %s %s %s\n' "$chain_nonce" "$old_fp" "$new_fp" "$reload_epoch" \
  >"$S3/a1-rotation-event"
export A1_CHAIN_NONCE=$chain_nonce
export A1_NEW_GATEWAY_TOKEN=$new_value
export A1_CLIENT_CONFIG=$NEW_CLIENT_CONFIG
bash "$HARNESS/a3-rotation-tied-probes.sh"
