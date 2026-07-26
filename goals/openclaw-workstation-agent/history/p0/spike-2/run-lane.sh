#!/usr/bin/bash
# Runs the applicator in a non-interactive context equivalent to a real
# applicator's: new session (setsid, no controlling TTY), scrubbed environment
# (env -i) carrying only HOME/USER/LOGNAME/PATH plus the applicator's own inputs.
# Notably absent: XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS, TERM, SHELL.
#   $1 = lane name; $2 = expected-identity file; $3 = optional runtime-uid override
set -uo pipefail
SPIKE_DIR="$(cd "$(dirname "$0")" && pwd)"
LANE="$1"; EXPECTED="$2"; OVERRIDE="${3:-}"
LOG="${SPIKE_DIR}/logs/${LANE}.log"
mkdir -p "${SPIKE_DIR}/logs"

CMD=(setsid -w env -i
  HOME="$HOME" USER="$(id -un)" LOGNAME="$(id -un)" PATH=/usr/bin:/bin
  SPIKE_TARGET_USER="$(id -un)"
  SPIKE_EXPECTED_IDENTITY="$EXPECTED"
  SPIKE_STATE_DIR="${SPIKE_DIR}/throwaway-state")
case "$OVERRIDE" in
  "")   ;;
  /*)   CMD+=(SPIKE_RUNTIME_DIR_OVERRIDE="$OVERRIDE") ;;
  *)    CMD+=(SPIKE_RUNTIME_UID_OVERRIDE="$OVERRIDE") ;;
esac
CMD+=(bash "${SPIKE_DIR}/applicator.sh")

{
  printf '### LANE %s (%s)\n' "$LANE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '### COMMAND: %s\n\n' "${CMD[*]}"
} >"$LOG"

"${CMD[@]}" </dev/null >>"$LOG" 2>&1
RC=$?
printf '\n### EXIT CODE: %s\n' "$RC" >>"$LOG"
printf 'lane=%s exit=%s log=%s\n' "$LANE" "$RC" "$LOG"
exit "$RC"
