#!/usr/bin/env bash
# Contract assertion 2: running A -> privileged stage/switch -> restarted B.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
require_context
require_preflight

LOG="$LOGS/a2-switch.log"
mkdir -p "$LOGS"
exec > >(tee "$LOG") 2>&1

MUTATED=0
a2_abort() {
  local rc=$?
  trap - EXIT INT TERM
  if (( MUTATED != 0 )); then
    echo "A2-ABORT: running full harness cleanup"
    "$SCRIPT_DIR/cleanup.sh" || true
  fi
  exit "$rc"
}
trap a2_abort EXIT INT TERM

test -s "$GATEWAY_CREDENTIAL" || { echo "FATAL: gateway credential is missing"; exit 66; }
A2_GATEWAY_TOKEN=""
IFS= read -r A2_GATEWAY_TOKEN < "$GATEWAY_CREDENTIAL" || [[ -n "$A2_GATEWAY_TOKEN" ]]
sanitize_a2_stream() {
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '%s\n' "${line//"$A2_GATEWAY_TOKEN"/[REDACTED_GATEWAY_TOKEN]}"
  done | redact_stream
}

wait_health() {
  local port="$1" waited=0 code path
  while (( waited < 40 )); do
    for path in /health /healthz /readyz; do
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 \
        "http://127.0.0.1:$port$path" 2>/dev/null || true)"
      if [[ "$code" =~ ^2 ]]; then
        echo "probe=http://127.0.0.1:$port$path status=$code"
        return 0
      fi
    done
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

reject_listener() {
  local port="$1"
  if ss -H -ltn "sport = :$port" | grep -q .; then
    echo "ASSERT-FAIL: listener remains on port $port"
    ss -H -ltnp "sport = :$port" || true
    return 1
  fi
  echo "ASSERT-PASS: no listener on port $port"
}

running_evidence() {
  local label="$1" expected_port="$2" expected_gen="$3" pid cmdline
  pid="$(systemctl --user show -p MainPID --value "$UNIT")"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || { echo "ASSERT-FAIL: $label has no MainPID"; return 1; }
  printf '%s_main_pid=%s\n' "$label" "$pid"
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline")"
  [[ "$cmdline" != *"$A2_GATEWAY_TOKEN"* ]] ||
    { echo "ASSERT-FAIL: secret appeared in process argv"; return 1; }
  printf '%s_argv=%s\n' "$label" "$cmdline"
  printf '%s_pointer=%s resolved=%s\n' "$label" "$(readlink "$ROOT/current")" \
    "$(readlink -f "$ROOT/current")"
  printf '%s_config_sha256=%s version=%s\n' "$label" \
    "$(sha256sum "$ROOT/current/openclaw.json" | awk '{print $1}')" \
    "$(env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$ISOHOME" \
      OPENCLAW_STATE_DIR="$STATE" "$OCA" --version)"
  [[ "$(readlink "$ROOT/current")" == "$expected_gen" ]] ||
    { echo "ASSERT-FAIL: $label pointer is not expected generation $expected_gen"; return 1; }
  wait_health "$expected_port"
  unit_cgroup_pids | sanitize_a2_stream
}

test -f "$S1/generations.tsv" || { echo "FATAL: run setup-root.sh first"; exit 66; }
sudo -n true || { echo "FATAL: sudo is not interactively primed"; exit 77; }
A_GEN="$(awk -F '\t' 'NR == 2 {print $1}' "$S1/generations.tsv")"
test -n "$A_GEN" || { echo "FATAL: generation A is not recorded"; exit 65; }
[[ "$(readlink "$ROOT/current")" == "$A_GEN" ]] ||
  { echo "FATAL: assertion 2 must begin on generation A"; exit 65; }

echo "== assertion 2: prove running generation A before staging B =="
verify_owned_root
MUTATED=1
systemctl --user reset-failed "$UNIT" 2>/dev/null || true
systemctl --user start "$UNIT"
running_evidence generation_a 19021 "$A_GEN"
reject_listener 19022
echo "ASSERT-PASS: generation A is running and healthy before the switch"

ACTIVE_CFG="$ROOT/current/openclaw.json"
RENDERED="$S1/rendered-b.json"
jq -S '.gateway.port = 19022' "$ACTIVE_CFG" > "$RENDERED"
CONFIG_HASH="$(sha256sum "$RENDERED" | awk '{print $1}')"
B_GEN="$CONFIG_HASH"
B_DIR="$ROOT/$B_GEN"

echo "== assertion 2: stop A, stage B, and validate B before activation =="
systemctl --user stop "$UNIT"
stage_generation "$RENDERED" "$CONFIG_HASH"
printf '%s\t%s\t%s\n' "$B_GEN" "$CONFIG_HASH" "19022" >> "$S1/generations.tsv"
env -i \
  PATH="$NODEBIN:/usr/bin:/bin" \
  HOME="$ISOHOME" \
  OPENCLAW_CONFIG_PATH="$B_DIR/openclaw.json" \
  OPENCLAW_STATE_DIR="$STATE" \
  OPENCLAW_NIX_MODE=1 \
  OLLAMA_API_KEY=ollama-local \
  timeout 45 "$OCA" config validate

echo "== assertion 2: atomic pointer switch =="
switch_root_pointer "$B_GEN" switch
[[ "$(readlink "$ROOT/current")" == "$B_GEN" ]] ||
  { echo "ASSERT-FAIL: atomic pointer switch did not select B"; exit 1; }
echo "pointer=$B_GEN config_sha256=$(sha256sum "$ACTIVE_CFG" | awk '{print $1}')"
echo "installed_spike_root_sha256=$(root_hash)"

echo "== assertion 2: restart stopped unit and prove generation B =="
systemctl --user restart "$UNIT"
running_evidence generation_b 19022 "$B_GEN"
reject_listener 19021
journalctl --user -u "$UNIT" -n 160 --no-pager 2>&1 |
  sanitize_a2_stream > "$LOGS/a2-gateway-journal.log" || true
scan_secret_exact "$A2_GATEWAY_TOKEN" "$LOG" "$LOGS/a2-gateway-journal.log"
scan_token_shapes "$LOG" "$LOGS/a2-gateway-journal.log"
manager_secret_environment_absent
unset A2_GATEWAY_TOKEN
MUTATED=0
trap - EXIT INT TERM
echo "ASSERT-PASS: a running A followed the privileged pointer switch to B on restart"
echo "A2-PASS"
