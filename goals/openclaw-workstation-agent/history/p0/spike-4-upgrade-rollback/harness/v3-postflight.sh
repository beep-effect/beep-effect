#!/usr/bin/env bash
set -euo pipefail

P="${SPIKE_P:?export SPIKE_P=<disposable spike root>}"
S4="$P/spike4"
LOG="$S4/logs/v3-postflight.log"
BEFORE="$S4/logs/v3-openclaw-before.txt"
AFTER="$S4/logs/v3-openclaw-after.txt"
UNIT="openclaw-spike.service"
UNIT_FILE="$HOME/.config/systemd/user/$UNIT"

mkdir -p "$S4/logs"

teardown() {
  systemctl --user stop "$UNIT" 2>/dev/null || true
  systemctl --user disable "$UNIT" 2>/dev/null || true
  rm -f "$UNIT_FILE"
  systemctl --user daemon-reload
  systemctl --user reset-failed "$UNIT" 2>/dev/null || true
}

capture_openclaw_listing() {
  local destination="$1"
  # exclude the '..' parent-dir line: $HOME's mtime is outside the spike boundary
  ls -la "$HOME/.openclaw" 2>&1 | grep -v ' \.\.$' > "$destination" || true
}

preflight() {
  echo "[spike4] === v3 teardown/preflight ==="
  teardown
  capture_openclaw_listing "$BEFORE"
  echo "captured pre-run ~/.openclaw listing: $BEFORE"
}

postflight() {
  local unit_files unit_state processes

  echo "[spike4] === v3 teardown/postflight ==="
  teardown
  capture_openclaw_listing "$AFTER"

  [ ! -e "$UNIT_FILE" ] && echo "ASSERT-PASS: unit file absent" || {
    echo "ASSERT-FAIL: unit file remains: $UNIT_FILE"
    return 1
  }

  unit_files=$(systemctl --user list-unit-files 'openclaw-spike*' --no-legend 2>&1 || true)
  printf 'matching unit files: %s\n' "${unit_files:-<none>}"
  [ -z "$unit_files" ] && echo "ASSERT-PASS: no openclaw-spike unit files registered" || {
    echo "ASSERT-FAIL: matching unit files remain"
    return 1
  }

  unit_state=$(systemctl --user is-active "$UNIT" 2>&1 || true)
  echo "unit state: $unit_state"
  [ "$unit_state" != active ] && echo "ASSERT-PASS: unit inactive/not found" || {
    echo "ASSERT-FAIL: unit is active"
    return 1
  }

  # exclude the orchestrating shell itself: its argv carries $SPIKE_P via env exports
  processes=$(pgrep -af "$P|openclaw.*1901[1-4]" | grep -vE 'zsh -c|shell-snapshots|pgrep' || true)
  printf 'matching processes: %s\n' "${processes:-<none>}"
  [ -z "$processes" ] && echo "ASSERT-PASS: zero matching spike processes" || {
    echo "ASSERT-FAIL: matching spike processes remain"
    return 1
  }

  cmp -s "$BEFORE" "$AFTER" && echo "ASSERT-PASS: no ~/.openclaw mutation (ls -la unchanged)" || {
    echo "ASSERT-FAIL: ~/.openclaw listing changed"
    diff -u "$BEFORE" "$AFTER" || true
    return 1
  }

  echo "SPIKE4-V3-POSTFLIGHT-PASS"
}

case "${1:-}" in
  preflight)
    : > "$LOG"
    preflight 2>&1 | tee -a "$LOG"
    ;;
  postflight)
    [ -f "$LOG" ] || { echo "missing preflight log: $LOG" >&2; exit 1; }
    if postflight >> "$LOG" 2>&1; then
      cat "$LOG"
    else
      status=$?
      cat "$LOG"
      exit "$status"
    fi
    ;;
  *)
    echo "usage: $0 preflight|postflight" >&2
    exit 2
    ;;
esac
