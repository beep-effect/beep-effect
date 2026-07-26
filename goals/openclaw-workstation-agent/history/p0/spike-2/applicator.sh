#!/usr/bin/bash
# OpenClaw P0 Spike 2 — model of the workstation-local applicator.
#
# Models the SPEC "applicator contract + identity binding" decision:
#   renderers stay pure; the applicator declares user/UID, runtime dir, bus
#   reachability, linger ownership, privilege boundary; preflight exercises the
#   exact non-interactive `systemd --user` context and binds the stack to
#   /etc/machine-id + hostname + UID + expected home and runtime paths, failing
#   BEFORE mutation on mismatch.
#
# Deliberately does NOT read XDG_RUNTIME_DIR / DBUS_SESSION_BUS_ADDRESS from the
# inherited environment: both are derived from the resolved UID.
#
# Inputs (env):
#   SPIKE_TARGET_USER          required  target user the units belong to
#   SPIKE_EXPECTED_IDENTITY    required  path to expected-identity JSON
#   SPIKE_STATE_DIR            required  throwaway state dir
#   SPIKE_RUNTIME_UID_OVERRIDE optional  negative lane: derive runtime dir from
#                                        this UID instead of the resolved one
#
# Exit codes:
#   0  apply completed
#   10 PREFLIGHT_FAIL_LINGER    linger not enabled for target user
#   20 PREFLIGHT_FAIL_BUS       user bus unreachable from derived runtime dir
#   30 PREFLIGHT_FAIL_IDENTITY  identity tuple mismatch vs expectation
#   40 APPLY_FAIL               a mutation step failed
#   64 USAGE                    missing required input

set -uo pipefail

UNIT_NAME="openclaw-spike.service"

log()  { printf '[%s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
step() { printf '\n=== %s ===\n' "$*"; }
die()  { printf '\nFAIL(%s): %s\n' "$1" "$2" >&2; exit "$1"; }

# ---------------------------------------------------------------- step 0: ctx
step "step 0: non-interactive context probe"
log "pid=$$ ppid=$PPID sid=$(ps -o sid= -p $$ | tr -d ' ')"
log "tty(stdin)=$(tty 2>&1)"
for fd in 0 1 2; do
  if [ -t "$fd" ]; then die 64 "fd $fd is a TTY; this must run non-interactively"; fi
done
log "no fd is a tty: confirmed"
log "inherited env var count=$(env | wc -l); names: $(env | cut -d= -f1 | sort | tr '\n' ' ')"
log "XDG_RUNTIME_DIR inherited? ${XDG_RUNTIME_DIR:-<unset>}"
log "DBUS_SESSION_BUS_ADDRESS inherited? ${DBUS_SESSION_BUS_ADDRESS:-<unset>}"
# The applicator never trusts inherited session env; drop it outright.
unset XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS

: "${SPIKE_TARGET_USER:?SPIKE_TARGET_USER required}"
: "${SPIKE_EXPECTED_IDENTITY:?SPIKE_EXPECTED_IDENTITY required}"
: "${SPIKE_STATE_DIR:?SPIKE_STATE_DIR required}"

# ------------------------------------------------------- step 1: resolve self
step "step 1: resolve target identity from the OS (not from env)"
TARGET_USER="$SPIKE_TARGET_USER"
TARGET_UID="$(id -u "$TARGET_USER")" || die 64 "cannot resolve uid for $TARGET_USER"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
MACHINE_ID_SHA="$(sha256sum /etc/machine-id | cut -d' ' -f1)"
HOSTNAME_VAL="$(cat /proc/sys/kernel/hostname)"
log "user=$TARGET_USER uid=$TARGET_UID home=$TARGET_HOME"
log "hostname=$HOSTNAME_VAL machine_id_sha256=$MACHINE_ID_SHA"

# ------------------------------------------------------------ step 2: linger
step "step 2: linger ownership check"
LINGER="$(loginctl show-user "$TARGET_USER" --property=Linger --value 2>&1)"
log "loginctl show-user $TARGET_USER --property=Linger --value -> ${LINGER}"
[ "$LINGER" = "yes" ] || die 10 "PREFLIGHT_FAIL_LINGER: linger='${LINGER}' for $TARGET_USER; \
a user manager is not guaranteed to exist outside a login session. No mutation performed."
log "linger enabled: OK"

# ------------------------------------------------ step 3: derive runtime + bus
step "step 3: derive runtime dir and bus address from UID"
RUNTIME_UID="${SPIKE_RUNTIME_UID_OVERRIDE:-$TARGET_UID}"
if [ "$RUNTIME_UID" != "$TARGET_UID" ]; then
  log "NOTE: runtime derivation overridden to uid=$RUNTIME_UID (negative-lane injection)"
fi
DERIVED_RUNTIME_DIR="/run/user/${RUNTIME_UID}"
if [ -n "${SPIKE_RUNTIME_DIR_OVERRIDE:-}" ]; then
  log "NOTE: runtime dir overridden to ${SPIKE_RUNTIME_DIR_OVERRIDE} (negative-lane injection)"
  DERIVED_RUNTIME_DIR="$SPIKE_RUNTIME_DIR_OVERRIDE"
fi
DERIVED_BUS="unix:path=${DERIVED_RUNTIME_DIR}/bus"
export XDG_RUNTIME_DIR="$DERIVED_RUNTIME_DIR"
export DBUS_SESSION_BUS_ADDRESS="$DERIVED_BUS"
log "derived XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
log "derived DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS"

# ------------------------------------------------- step 4: bus reachability
step "step 4: user bus reachability (read-only probes)"
if [ ! -d "$DERIVED_RUNTIME_DIR" ]; then
  die 20 "PREFLIGHT_FAIL_BUS: runtime dir $DERIVED_RUNTIME_DIR does not exist. No mutation performed."
fi
if [ ! -S "${DERIVED_RUNTIME_DIR}/bus" ]; then
  die 20 "PREFLIGHT_FAIL_BUS: bus socket ${DERIVED_RUNTIME_DIR}/bus is not a socket. No mutation performed."
fi
BUSCTL_OUT="$(timeout 15 busctl --user --no-pager --list 2>&1)"
BUSCTL_RC=$?
log "busctl --user --list (rc=$BUSCTL_RC) first 3 lines of $(printf '%s\n' "$BUSCTL_OUT" | wc -l):"
printf '%s\n' "$BUSCTL_OUT" | head -3 | sed 's/^/    | /'
SHOW_OUT="$(timeout 15 systemctl --user show --property=Version --value 2>&1)"
SHOW_RC=$?
log "systemctl --user show --property=Version --value (rc=$SHOW_RC) -> ${SHOW_OUT}"
if [ "$SHOW_RC" -ne 0 ] || [ "$BUSCTL_RC" -ne 0 ]; then
  die 20 "PREFLIGHT_FAIL_BUS: user manager for uid=$RUNTIME_UID not reachable over \
${DERIVED_BUS} (busctl rc=$BUSCTL_RC, systemctl rc=$SHOW_RC). No mutation performed."
fi
IS_RUNNING="$(timeout 15 systemctl --user is-system-running 2>&1)"
log "systemctl --user is-system-running -> ${IS_RUNNING}"
log "bus reachable, user manager version=$SHOW_OUT: OK"

# ------------------------------------------------- step 5: identity binding
step "step 5: identity binding vs expectation"
[ -f "$SPIKE_EXPECTED_IDENTITY" ] || die 30 "PREFLIGHT_FAIL_IDENTITY: expectation file \
$SPIKE_EXPECTED_IDENTITY missing. No mutation performed."

ACTUAL_JSON="$(jq -n \
  --arg machine_id_sha256 "$MACHINE_ID_SHA" \
  --arg hostname "$HOSTNAME_VAL" \
  --argjson uid "$TARGET_UID" \
  --arg user "$TARGET_USER" \
  --arg home "$TARGET_HOME" \
  --arg runtime_dir "$DERIVED_RUNTIME_DIR" \
  --arg bus_address "$DERIVED_BUS" \
  '{machine_id_sha256:$machine_id_sha256,hostname:$hostname,uid:$uid,user:$user,home:$home,runtime_dir:$runtime_dir,bus_address:$bus_address}')"
log "actual identity tuple:"
printf '%s\n' "$ACTUAL_JSON" | sed 's/^/    | /'
log "expected identity tuple ($SPIKE_EXPECTED_IDENTITY):"
jq -S . "$SPIKE_EXPECTED_IDENTITY" | sed 's/^/    | /'

MISMATCHES="$(jq -r -n \
  --argjson actual "$ACTUAL_JSON" \
  --slurpfile exp "$SPIKE_EXPECTED_IDENTITY" \
  '($exp[0]) as $e
   | ($actual | keys) as $ks
   | [ $ks[] | select(($e[.] // null) != $actual[.])
       | "\(.): expected=\($e[.] // "<absent>" | tostring) actual=\($actual[.] | tostring)" ]
   | .[]')"
if [ -n "$MISMATCHES" ]; then
  printf 'identity mismatches:\n' >&2
  printf '%s\n' "$MISMATCHES" | sed 's/^/    ! /' >&2
  die 30 "PREFLIGHT_FAIL_IDENTITY: identity tuple does not match the bound expectation. \
No mutation performed."
fi
log "identity tuple matches expectation on all 7 fields: OK"

# ------------------------------------------------------------ mutation phase
step "PREFLIGHT OK — entering mutation phase"
UNIT_DIR="${TARGET_HOME}/.config/systemd/user"
UNIT_PATH="${UNIT_DIR}/${UNIT_NAME}"

mkdir -p "$UNIT_DIR" "$SPIKE_STATE_DIR" || die 40 "APPLY_FAIL: cannot create dirs"
log "writing unit $UNIT_PATH"
cat >"$UNIT_PATH" <<EOF || die 40 "APPLY_FAIL: cannot write unit"
[Unit]
Description=OpenClaw P0 Spike 2 placeholder unit (no OpenClaw binary involved)
Documentation=https://example.invalid/openclaw-spike-2

[Service]
Type=simple
ExecStart=/usr/bin/sleep infinity
WorkingDirectory=${SPIKE_STATE_DIR}
Environment=OPENCLAW_SPIKE_STATE=${SPIKE_STATE_DIR}
Restart=no

[Install]
WantedBy=default.target
EOF
log "unit content:"
sed 's/^/    | /' "$UNIT_PATH"

run_step() {
  local label="$1"; shift
  local out rc
  out="$(timeout 30 "$@" 2>&1)"; rc=$?
  log "\$ $* (rc=$rc)"
  [ -n "$out" ] && printf '%s\n' "$out" | sed 's/^/    | /'
  [ "$rc" -eq 0 ] || die 40 "APPLY_FAIL: ${label} failed (rc=$rc)"
}

run_step "daemon-reload" systemctl --user daemon-reload
run_step "enable"        systemctl --user enable "$UNIT_NAME"
run_step "start"         systemctl --user start "$UNIT_NAME"
run_step "is-active"     systemctl --user is-active "$UNIT_NAME"
log "post-start unit properties:"
systemctl --user show "$UNIT_NAME" \
  --property=LoadState,ActiveState,SubState,UnitFileState,FragmentPath,MainPID \
  | sed 's/^/    | /'
run_step "stop"          systemctl --user stop "$UNIT_NAME"
log "post-stop ActiveState: $(systemctl --user show "$UNIT_NAME" --property=ActiveState --value)"
run_step "disable"       systemctl --user disable "$UNIT_NAME"
log "post-disable UnitFileState: $(systemctl --user show "$UNIT_NAME" --property=UnitFileState --value)"

step "APPLY OK"
exit 0
