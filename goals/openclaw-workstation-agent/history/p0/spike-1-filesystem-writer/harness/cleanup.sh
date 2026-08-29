#!/usr/bin/env bash
# P0 spike 1 cleanup: provenance-first removal and zero-residue proof.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
require_context

mkdir -p "$LOGS"
LOG="$LOGS/cleanup.log"
exec > >(tee -a "$LOG") 2>&1
echo "== cleanup invocation $(date -u '+%Y-%m-%dT%H:%M:%SZ') =="
FAILURES=0
OWNED_UNIT=0
CLEANUP_GATEWAY_TOKEN=""
CLEANUP_TELEGRAM_TOKEN=""
if test -s "$GATEWAY_CREDENTIAL"; then
  IFS= read -r CLEANUP_GATEWAY_TOKEN < "$GATEWAY_CREDENTIAL" ||
    [[ -n "$CLEANUP_GATEWAY_TOKEN" ]]
fi
if test -s "$TELEGRAM_CREDENTIAL"; then
  IFS= read -r CLEANUP_TELEGRAM_TOKEN < "$TELEGRAM_CREDENTIAL" ||
    [[ -n "$CLEANUP_TELEGRAM_TOKEN" ]]
fi
sanitize_cleanup_stream() {
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ -n "$CLEANUP_GATEWAY_TOKEN" ]]; then
      line="${line//"$CLEANUP_GATEWAY_TOKEN"/[REDACTED_GATEWAY_TOKEN]}"
    fi
    if [[ -n "$CLEANUP_TELEGRAM_TOKEN" ]]; then
      line="${line//"$CLEANUP_TELEGRAM_TOKEN"/[REDACTED_TELEGRAM_TOKEN]}"
    fi
    printf '%s\n' "$line"
  done | redact_stream
}

echo "== cleanup: provenance before any unit mutation =="
fragment="$(systemctl --user show -p FragmentPath --value "$UNIT" 2>/dev/null || true)"
if [[ -n "$fragment" ]]; then
  if unit_fragment_owned_or_absent; then
    OWNED_UNIT=1
    unit_cgroup_pids | sanitize_cleanup_stream |
      tee "$S1/cleanup-pre-unit-cgroup.inventory"
    systemctl --user stop "$UNIT"
    systemctl --user disable "$UNIT" 2>/dev/null || true
  else
    echo "CLEANUP-FAIL: refusing to mutate unowned loaded unit"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "unit_fragment=not-found; no unit mutation needed"
fi

systemctl --user unset-environment OPENCLAW_GATEWAY_TOKEN TELEGRAM_BOT_TOKEN
manager_secret_environment_absent || FAILURES=$((FAILURES + 1))

if test -e "$UNIT_PATH"; then
  if [[ "$fragment" == "$UNIT_PATH" || -z "$fragment" ]] &&
      grep -q '^# BEEP_P0_SPIKE1$' "$UNIT_PATH"; then
    rm -- "$UNIT_PATH"
  else
    echo "CLEANUP-FAIL: refusing to remove unmarked or mismatched $UNIT_PATH"
    FAILURES=$((FAILURES + 1))
  fi
fi
systemctl --user daemon-reload
if (( OWNED_UNIT != 0 )); then
  systemctl --user reset-failed "$UNIT" 2>/dev/null || true
fi

echo "== cleanup: verified privileged root removal =="
if sudo test -e "$ROOT"; then
  if remove_owned_root; then
    echo "CLEANUP-PASS: verified marked root removed"
  else
    echo "CLEANUP-FAIL: privileged root verification/removal failed"
    FAILURES=$((FAILURES + 1))
  fi
fi

echo "== cleanup: disposable state and credentials =="
safe_user_remove "$STATE" "$ISOHOME" "$WORKSPACE" "$S1/a1-user" "$CREDENTIALS"

echo "== cleanup: post-state inventories =="
if test -d "$HOME/.config/systemd/user"; then
  find "$HOME/.config/systemd/user" -name 'openclaw-spike*' -printf '%m %U:%G %p\n' |
    LC_ALL=C sort > "$S1/post-unit-files.inventory"
else
  : > "$S1/post-unit-files.inventory"
fi
sudo find /etc/beep -maxdepth 2 -name 'openclaw-spike*' -printf '%m %U:%G %p -> %l\n' |
  LC_ALL=C sort > "$S1/post-root-generations.inventory"
inventory_real_openclaw > "$S1/post-real-openclaw.inventory"
{
  inventory_tree "$STATE"
  inventory_tree "$ISOHOME"
  inventory_tree "$WORKSPACE"
  inventory_tree "$CREDENTIALS"
} > "$S1/post-disposable.inventory"
unit_cgroup_pids > "$S1/post-unit-cgroup.inventory"
ports_inventory > "$S1/post-listeners.inventory"

if systemctl --user show -p FragmentPath --value "$UNIT" 2>/dev/null | grep -q .; then
  echo "CLEANUP-FAIL: a same-named unit fragment remains loaded"
  FAILURES=$((FAILURES + 1))
else
  echo "CLEANUP-PASS: no same-named loaded unit"
fi
if test -s "$S1/post-unit-files.inventory"; then
  echo "CLEANUP-FAIL: matching unit files remain"
  cat "$S1/post-unit-files.inventory"
  FAILURES=$((FAILURES + 1))
else
  echo "CLEANUP-PASS: zero matching unit files"
fi
if sudo test -e "$ROOT" || test -s "$S1/post-root-generations.inventory"; then
  echo "CLEANUP-FAIL: spike root/generations remain"
  FAILURES=$((FAILURES + 1))
else
  echo "CLEANUP-PASS: zero spike roots/generations"
fi
for path in "$STATE" "$ISOHOME" "$WORKSPACE" "$S1/a1-user" "$CREDENTIALS" \
    "$RUNTIME_CREDENTIALS"; do
  if test -e "$path"; then
    echo "CLEANUP-FAIL: disposable path remains: $path"
    FAILURES=$((FAILURES + 1))
  else
    echo "CLEANUP-PASS: absent $path"
  fi
done

if test -s "$S1/post-listeners.inventory"; then
  echo "CLEANUP-FAIL: a spike port listener remains"
  cat "$S1/post-listeners.inventory"
  FAILURES=$((FAILURES + 1))
else
  echo "CLEANUP-PASS: zero listeners on spike ports"
fi

if grep -Eq '^(MainPID|ExecMainPID)=[1-9][0-9]*$|^cgroup_pid=' \
    "$S1/post-unit-cgroup.inventory"; then
  echo "CLEANUP-FAIL: cgroup member remains"
  FAILURES=$((FAILURES + 1))
else
  echo "CLEANUP-PASS: zero cgroup members"
fi

declare -A EXCLUDED_PIDS=()
ancestor_pid="$$"
while [[ "$ancestor_pid" =~ ^[1-9][0-9]*$ ]] &&
    [[ -r "/proc/$ancestor_pid/stat" ]]; do
  EXCLUDED_PIDS["$ancestor_pid"]=1
  ancestor_stat="$(<"/proc/$ancestor_pid/stat")"
  ancestor_tail="${ancestor_stat##*) }"
  ancestor_pid="${ancestor_tail#* }"
  ancestor_pid="${ancestor_pid%% *}"
done
process_matches=0
for proc in /proc/[0-9]*/cmdline; do
  test -r "$proc" || continue
  pid="${proc#/proc/}"
  pid="${pid%/cmdline}"
  [[ -z "${EXCLUDED_PIDS[$pid]:-}" ]] || continue
  argv="$(tr '\0' ' ' < "$proc" 2>/dev/null || true)"
  exe="$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)"
  env_paths=""
  if [[ -r "/proc/$pid/environ" ]]; then
    env_paths="$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null || true)"
  fi
  state_match=0
  executable_match=0
  [[ "$env_paths" == *$'OPENCLAW_STATE_DIR='"$STATE"$'\n'* ||
     "$env_paths" == *$'OPENCLAW_STATE_DIR='"$STATE" ]] && state_match=1
  if [[ "$exe" == "$(readlink -f "$NODEBIN/node" 2>/dev/null || true)" &&
        "$argv" == *"$PACKAGE_ROOT/"* &&
        "$argv" == *"gateway"* ]]; then
    executable_match=1
  fi
  if (( state_match != 0 || executable_match != 0 )); then
    printf 'CLEANUP-FAIL: residual_pid=%s argv=%s\n' \
      "$pid" "${argv//$'\n'/ }" | sanitize_cleanup_stream
    process_matches=$((process_matches + 1))
  fi
done
if (( process_matches == 0 )); then
  echo "CLEANUP-PASS: zero non-ancestor processes keyed by verified executable or OPENCLAW_STATE_DIR"
else
  FAILURES=$((FAILURES + process_matches))
fi

if test -f "$S1/pre-real-openclaw.inventory"; then
  if cmp -s "$S1/pre-real-openclaw.inventory" "$S1/post-real-openclaw.inventory"; then
    echo "CLEANUP-PASS: real ~/.openclaw inventory is byte-identical"
  else
    echo "CLEANUP-FAIL: real ~/.openclaw inventory changed"
    diff -u "$S1/pre-real-openclaw.inventory" "$S1/post-real-openclaw.inventory" || true
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "CLEANUP-FAIL: preflight real ~/.openclaw inventory is missing"
  FAILURES=$((FAILURES + 1))
fi
manager_secret_environment_absent || FAILURES=$((FAILURES + 1))

if grep -q '^unit_dir_preexisting=no$' "$S1/pre-state.txt" 2>/dev/null; then
  rmdir -- "$HOME/.config/systemd/user" 2>/dev/null || true
fi
if grep -q '^systemd_dir_preexisting=no$' "$S1/pre-state.txt" 2>/dev/null; then
  rmdir -- "$HOME/.config/systemd" 2>/dev/null || true
fi
if grep -q '^config_dir_preexisting=no$' "$S1/pre-state.txt" 2>/dev/null; then
  rmdir -- "$HOME/.config" 2>/dev/null || true
fi

mapfile -t EVIDENCE_LOGS < <(find "$LOGS" -maxdepth 1 -type f -name '*.log' -print | LC_ALL=C sort)
scan_secret_exact "$CLEANUP_GATEWAY_TOKEN" "${EVIDENCE_LOGS[@]}" ||
  FAILURES=$((FAILURES + 1))
scan_secret_exact "$CLEANUP_TELEGRAM_TOKEN" "${EVIDENCE_LOGS[@]}" ||
  FAILURES=$((FAILURES + 1))
scan_token_shapes "${EVIDENCE_LOGS[@]}" || FAILURES=$((FAILURES + 1))
unset CLEANUP_GATEWAY_TOKEN CLEANUP_TELEGRAM_TOKEN
echo "evidence_retained=$S1"

if (( FAILURES == 0 )); then
  echo "CLEANUP-PASS: exact pre-spike state restored except sanitized evidence"
else
  echo "CLEANUP-FAIL count=$FAILURES"
  exit 1
fi
