#!/usr/bin/env bash
# Orchestrator runner for spike-1 assertions 1-4 (no Telegram legs).
# One sudo tap up front; a refresher keeps the tty ticket warm for the run.
set -uo pipefail
H=/home/elpresidank/YeeBois/projects/beep-effect3/.beep/p0-orchestration/spike1
OUT=/home/elpresidank/.cache/beep-p0-spike1-run
rm -rf "$OUT"; mkdir -p "$OUT"

tty -s || { echo "FATAL: must run under a pty (script -qec ...) so sudo tickets are tty-keyed"; exit 1; }
if ! sudo -n true 2>/dev/null; then
  echo ">>> Touch your YubiKey when it cues (one tap primes the whole run)."
  sudo -v || { echo "FATAL: no sudo ticket; rerun and tap when cued"; exit 1; }
fi

# keep the ticket alive for the duration (no extra taps)
( while sleep 45; do sudo -n -v 2>/dev/null || exit 0; done ) &
REFRESH=$!
trap 'kill "$REFRESH" 2>/dev/null' EXIT

if ! sudo -n test -d /etc/beep; then
  sudo -n install -d -o root -g root -m 0755 /etc/beep && echo "operator-prereq: created /etc/beep root:root 0755"
else
  echo "operator-prereq: /etc/beep already present"
fi
sudo -n stat -c '%U:%G:%a %n' /etc/beep

export SPIKE_P="$(mktemp -d /home/elpresidank/.cache/beep-p0-spike1.XXXXXX)"
echo "SPIKE_P=$SPIKE_P" | tee "$OUT/SPIKE_P.txt"
cd "$H" || exit 1

run_step() {
  local name="$1"; shift
  echo "=== $name ==="
  "$@" > "$OUT/$name.log" 2>&1
  local rc=$?
  echo "$name exit=$rc"
  grep -aE 'ASSERT-(PASS|FAIL)|FATAL|SPIKE1-' "$OUT/$name.log" | head -25
  return $rc
}

rc_total=0
for step in preflight cleanup setup-root a1-bypass a2-switch a3-config-set-doctor a4-drift-canary; do
  run_step "$step" ./"$step".sh || { rc_total=1; echo "STOPPING after failed step: $step"; break; }
done

echo "=== final cleanup (always) ==="
./cleanup.sh > "$OUT/cleanup-final.log" 2>&1
echo "cleanup-final exit=$?"
grep -aE 'ASSERT-(PASS|FAIL)|FATAL|residue' "$OUT/cleanup-final.log" | head -20

echo "=== run rc_total=$rc_total ; logs in $OUT ; evidence in $SPIKE_P/spike1 ==="
