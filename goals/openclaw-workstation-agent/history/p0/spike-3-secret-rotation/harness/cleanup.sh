#!/usr/bin/env bash
set -euo pipefail

HARNESS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib.sh
source "$HARNESS/lib.sh"
spike3_require_scratch

S3=$SPIKE3_DIR
LOGS=$SPIKE3_LOGS
UNIT_FILE=$(spike3_unit_file)
NODE=$HOME/.local/share/mise/installs/node/24/bin/node
OC=$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw
rc=0

spike3_assert_scratch_ownership
[[ ! -L "$S3" && "$(realpath -e -- "$S3")" == "$S3" ]] ||
  spike3_fail "CLEANUP-FAIL: Spike 3 scratch root is symlinked or non-canonical"
exec > >(tee -a "$LOGS/cleanup.log") 2>&1
pass() { printf 'CLEANUP-PASS: %s\n' "$*"; }
failr() { printf 'CLEANUP-FAIL: %s\n' "$*" >&2; rc=1; }

printf '\n=== establish unit ownership before mutation ===\n'
spike3_assert_unit_owned_or_absent
fragment=$(systemctl --user show "$SPIKE3_UNIT" -p FragmentPath --value \
  2>/dev/null || true)
control_group=$(systemctl --user show "$SPIKE3_UNIT" -p ControlGroup --value \
  2>/dev/null || true)

printf '\n=== stop and remove only the dedicated user unit ===\n'
if [[ -n "$fragment" || -e "$UNIT_FILE" ]]; then
  systemctl --user stop "$SPIKE3_UNIT" 2>/dev/null || true
  systemctl --user disable "$SPIKE3_UNIT" 2>/dev/null || true
  rm -f -- "$UNIT_FILE"
  systemctl --user daemon-reload
  systemctl --user reset-failed "$SPIKE3_UNIT" 2>/dev/null || true
fi

printf '\n=== remove verified root generation and pointer ===\n'
spike3_remove_owned_root_artifacts

printf '\n=== remove exact verified bootstrap credential ===\n'
if sudo test -e "$SPIKE3_CREDENTIAL" || sudo test -L "$SPIKE3_CREDENTIAL"; then
  spike3_assert_exact_privileged_path "$SPIKE3_CREDENTIAL"
  spike3_assert_credential
  [[ "$(realpath -e -- "$SPIKE3_CREDENTIAL")" == "$SPIKE3_CREDENTIAL" ]] ||
    spike3_fail "CLEANUP-FAIL: credential escaped exact path before removal"
  sudo rm -f -- "$SPIKE3_CREDENTIAL"
fi
if sudo test -d "$SPIKE3_ETC_ROOT"; then
  spike3_assert_exact_privileged_path "$SPIKE3_ETC_ROOT"
  [[ ! -L "$SPIKE3_ETC_ROOT" &&
    "$(realpath -e -- "$SPIKE3_ETC_ROOT")" == "$SPIKE3_ETC_ROOT" &&
    "$(sudo stat -Lc '%u:%g:%a:%F' -- "$SPIKE3_ETC_ROOT")" == \
      "0:0:755:directory" ]] ||
    spike3_fail "CLEANUP-FAIL: refusing non-canonical or unowned Spike 3 root"
  sudo rmdir -- "$SPIKE3_ETC_ROOT" ||
    spike3_fail "CLEANUP-FAIL: unexpected entries remain in Spike 3 root"
fi
: >"$LOGS/privileged-paths.manifest"

printf '\n=== pre-removal runtime log token-shape scan ===\n'
spike3_scan_token_shapes "$LOGS"/*.log "$LOGS"/*.json \
  "$S3/state/log/openclaw.log"

printf '\n=== remove runtime while preserving sanitized evidence ===\n'
for client_config in "$S3"/a1-old-client.json "$S3"/a1-new-client.json \
  "$S3"/a2-client.json; do
  spike3_remove_client_config "$client_config" || rc=1
done
spike3_assert_scratch_ownership
find "$S3" -mindepth 1 -maxdepth 1 ! -name logs \
  ! -name .beep-spike3-scratch -exec rm -rf -- {} +

printf '\n=== verify exact pre-spike state ===\n'
[[ ! -e "$UNIT_FILE" && ! -L "$UNIT_FILE" ]] &&
  pass "unit file absent" || failr "unit file remains"
post_fragment=$(systemctl --user show "$SPIKE3_UNIT" -p FragmentPath --value \
  2>/dev/null || true)
[[ -z "$post_fragment" ]] &&
  pass "unit absent from user manager" || failr "loaded unit fragment remains"
if systemctl --user list-unit-files 'openclaw-spike*' --no-legend \
  2>/dev/null | grep -q .; then
  failr "matching unit files remain"
else
  pass "zero matching unit files"
fi
if [[ -n "$control_group" &&
  -e "/sys/fs/cgroup$control_group/cgroup.procs" ]] &&
  [[ -s "/sys/fs/cgroup$control_group/cgroup.procs" ]]; then
  failr "unit cgroup still has member processes"
else
  pass "zero unit cgroup members"
fi
if sudo test -e "$SPIKE3_CREDENTIAL" || sudo test -L "$SPIKE3_CREDENTIAL"; then
  failr "credential remains"
else
  pass "credential removed"
fi
if sudo test -e "$SPIKE3_ETC_ROOT" || sudo test -L "$SPIKE3_ETC_ROOT"; then
  failr "root generation path remains"
else
  pass "root generation, pointer, marker, and credential root removed"
fi
if grep -Fq 'present:' "$LOGS/preflight-etc-beep.state" 2>/dev/null; then
  [[ ! -L /etc/beep &&
    "$(stat -Lc '%u:%g:%a:%F' -- /etc/beep 2>/dev/null || true)" == \
      "0:0:755:directory" ]] &&
    pass "pre-existing /etc/beep metadata preserved" ||
    failr "pre-existing /etc/beep metadata changed"
else
  failr "preflight /etc/beep state evidence missing"
fi
if find "$S3" -mindepth 1 -maxdepth 1 ! -name logs -print -quit |
  grep -q .; then
  failr "runtime config/state/home/workspace remains"
else
  pass "state, home, workspace, and runtime config removed"
fi
if ss -ltnH "sport = :$SPIKE3_PORT" 2>/dev/null | grep -q .; then
  failr "listener remains on $SPIKE3_PORT"
else
  pass "listener absent on $SPIKE3_PORT"
fi

mapfile -t matching_pids < <(
  spike3_matching_pids "$S3/state" "$OC" "$NODE" \
    "$control_group" "$SPIKE3_PORT" | sort -nu
)
if ((${#matching_pids[@]} == 0)); then
  pass "zero Spike 3 processes"
else
  failr "Spike 3 processes remain: ${matching_pids[*]}"
fi

manager_secret_names=$(systemctl --user show-environment 2>/dev/null |
  cut -d= -f1 |
  grep -E '^(OP_SERVICE_ACCOUNT_TOKEN|OPENCLAW_GATEWAY_TOKEN|SPIKE_TG_BOT_TOKEN)$' |
  paste -sd, - || true)
if [[ -z "$manager_secret_names" ]]; then
  pass "manager contains no secret variables"
else
  failr "manager retains secret variable names: $manager_secret_names"
fi

if [[ -f "$LOGS/preflight-real-openclaw.inventory" ]]; then
  spike3_inventory "$HOME/.openclaw" >"$LOGS/postflight-real-openclaw.inventory"
  if cmp -s "$LOGS/preflight-real-openclaw.inventory" \
    "$LOGS/postflight-real-openclaw.inventory"; then
    pass "real ~/.openclaw inventory byte-identical"
  else
    failr "real ~/.openclaw inventory changed"
  fi
else
  failr "preflight real ~/.openclaw inventory missing"
fi

printf '\n=== final evidence token-shape scan ===\n'
spike3_scan_token_shapes "$LOGS"/*.log "$LOGS"/*.json

printf '\nOperator action: revoke the disposable service account and delete the disposable vault/item.\n'
if [[ "$rc" -eq 0 ]]; then
  printf 'SPIKE3-CLEANUP-PASS\n'
else
  printf 'SPIKE3-CLEANUP-FAIL\n'
fi
exit "$rc"
