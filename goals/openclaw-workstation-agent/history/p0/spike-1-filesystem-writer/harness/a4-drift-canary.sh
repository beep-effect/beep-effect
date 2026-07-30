#!/usr/bin/env bash
# Contract assertion 4: alert-only drift detection, followed by operator restore.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
require_context
require_preflight
LOG="$S1/logs/a4-drift-canary.log"
CFG="$ROOT/current/openclaw.json"
BACKUP="$S1/a4-pristine.json"
CANARY_INTERVAL_SECONDS=10

mkdir -p "$S1/logs"
exec > >(tee "$LOG") 2>&1

test -r "$CFG" || { echo "FATAL: run setup-root.sh first"; exit 66; }
sudo -n true || { echo "FATAL: sudo is not interactively primed"; exit 77; }
verify_owned_root
EXPECTED_GEN="$(readlink "$ROOT/current")"
EXPECTED_FULL="$(awk -F '\t' -v gen="$EXPECTED_GEN" \
  'NR > 1 && $1 == gen { value=$2 } END { print value }' "$S1/generations.tsv")"
test -n "$EXPECTED_FULL" || { echo "FATAL: no recorded hash for active generation $EXPECTED_GEN"; exit 65; }
[[ "$(readlink -f "$CFG")" == "$ROOT/"*"/openclaw.json" ]] ||
  { echo "FATAL: drift target escapes the verified spike root"; exit 73; }
CFG="$(readlink -f "$CFG")"
cp "$CFG" "$BACKUP"

restore() {
  [[ "$(readlink -f "$CFG")" == "$ROOT/"*"/openclaw.json" ]] ||
    { echo "FATAL: restore target escapes the verified spike root" >&2; return 73; }
  sudo install -o root -g root -m 0644 "$BACKUP" "$CFG"
}
restore_and_exit() {
  local rc=$?
  trap - EXIT INT TERM
  restore || true
  exit "$rc"
}
trap restore_and_exit EXIT INT TERM

echo "== assertion 4: baseline =="
echo "generation=$EXPECTED_GEN expected_sha256=$EXPECTED_FULL"
BASELINE="$(sha256sum "$CFG" | awk '{print $1}')"
[[ "$BASELINE" == "$EXPECTED_FULL" ]] || { echo "FATAL: baseline already drifted: $BASELINE"; exit 1; }

echo "== assertion 4: root-assisted deliberate edit =="
printf '\n' | sudo tee -a "$CFG" >/dev/null
ACTUAL="$(sha256sum "$CFG" | awk '{print $1}')"
echo "actual_sha256=$ACTUAL"
if [[ "$ACTUAL" != "$EXPECTED_FULL" ]]; then
  echo "ALERT: OPENCLAW_CONFIG_DRIFT generation=$EXPECTED_GEN expected=$EXPECTED_FULL actual=$ACTUAL"
  echo "ASSERT-PASS: drift canary detected the mismatch"
else
  echo "ASSERT-FAIL: deliberate drift was not detected"
  exit 1
fi

echo "== assertion 4: bounded alert-only observation interval =="
echo "canary_interval_seconds=$CANARY_INTERVAL_SECONDS"
sleep "$CANARY_INTERVAL_SECONDS"
AFTER_INTERVAL="$(sha256sum "$CFG" | awk '{print $1}')"
if [[ "$AFTER_INTERVAL" != "$ACTUAL" ]]; then
  echo "ASSERT-FAIL: config changed asynchronously during the canary interval: $AFTER_INTERVAL"
  exit 1
fi
echo "ASSERT-PASS: drifted hash remained byte-identical for one bounded canary interval"

echo "== assertion 4: explicit operator-driven restore =="
echo "OPERATOR-ACTION-BOUNDARY: alert acknowledged; operator now performs redeploy/restore"
restore
trap - EXIT INT TERM
RESTORED="$(sha256sum "$CFG" | awk '{print $1}')"
[[ "$RESTORED" == "$EXPECTED_FULL" ]] || { echo "ASSERT-FAIL: operator restore hash=$RESTORED"; exit 1; }
stat -c '%A %a %U:%G %n' "$CFG"
echo "ASSERT-PASS: operator restore returned the active config to its recorded hash"
echo "A4-PASS"
