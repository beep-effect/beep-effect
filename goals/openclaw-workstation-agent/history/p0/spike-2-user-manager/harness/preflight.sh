#!/usr/bin/env bash
# P0 spike 2 — applicator preflight prototype (disposable spike code).
# Verifies target identity + user-manager reachability BEFORE any mutation.
# Exit 0 = safe to apply; non-zero = refuse, nothing may be mutated.
# Usage: preflight.sh <expected.json>
set -euo pipefail

exp="${1:?usage: preflight.sh <expected.json>}"
fail() { echo "PREFLIGHT-FAIL: $*" >&2; exit 78; }
want() { jq -r ".$1" "$exp"; }

actual_machine_id=$(cat /etc/machine-id)
actual_hostname=$(cat /proc/sys/kernel/hostname)
actual_uid=$(id -u)
actual_user=$(id -un)
actual_home=$(getent passwd "$actual_uid" | cut -d: -f6)
expected_runtime="/run/user/$actual_uid"

[ "$(want machineId)" = "$actual_machine_id" ] || fail "machine-id mismatch: expected $(want machineId), target is $actual_machine_id"
[ "$(want hostname)"  = "$actual_hostname"  ] || fail "hostname mismatch: expected $(want hostname), target is $actual_hostname"
[ "$(want uid)"       = "$actual_uid"       ] || fail "uid mismatch: expected $(want uid), target is $actual_uid"
[ "$(want user)"      = "$actual_user"      ] || fail "user mismatch: expected $(want user), target is $actual_user"
[ "$(want home)"      = "$actual_home"      ] || fail "home mismatch: expected $(want home), target is $actual_home"
[ "$(want runtimeDir)" = "$expected_runtime" ] || fail "runtime dir mismatch: expected $(want runtimeDir), computed $expected_runtime"

# Linger must be active: the applicator's units must survive logout.
linger=$(loginctl show-user "$actual_user" -p Linger --value)
[ "$linger" = "yes" ] || fail "linger not enabled for $actual_user (Linger=$linger)"

[ -d "$expected_runtime" ] || fail "runtime dir $expected_runtime missing"

# User DBus bus reachable in the exact env the applicator will construct.
export XDG_RUNTIME_DIR="$expected_runtime"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$expected_runtime/bus"
state=$(systemctl --user is-system-running 2>&1 || true)
case "$state" in
  running|degraded|maintenance|starting) : ;;
  *) fail "user manager unreachable (is-system-running: $state)" ;;
esac

echo "PREFLIGHT-OK machine=$actual_machine_id host=$actual_hostname uid=$actual_uid home=$actual_home runtime=$expected_runtime linger=$linger manager=$state tty=$(tty || true)"
