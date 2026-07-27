#!/usr/bin/env bash
# Spike-1 writer-surface leg (assertions 5-6) in one pass:
# preflight -> teardown -> setup-root -> a5 -> cleanup.
set -uo pipefail
H=/home/elpresidank/YeeBois/projects/beep-effect3/.beep/p0-orchestration/spike1
OUT=/home/elpresidank/.cache/beep-p0-spike1-a5
rm -rf "$OUT"; mkdir -p "$OUT"

export SPIKE_TG_GROUP_ID='-1004475923698'
export SPIKE_TG_GROUP_USERNAME='@p0_spike1_jul25'
export SPIKE_PAIRING_WINDOW="${SPIKE_PAIRING_WINDOW:-600}"
export SPIKE_P="$(mktemp -d /home/elpresidank/.cache/beep-p0-spike1a5.XXXXXX)"
echo "SPIKE_P=$SPIKE_P" | tee "$OUT/SPIKE_P.txt"
cd "$H" || exit 1

for step in preflight cleanup setup-root; do
  bash ./"$step".sh > "$OUT/$step.log" 2>&1
  rc=$?
  echo "$step exit=$rc"
  [ "$rc" = 0 ] || { grep -aE 'FATAL|ASSERT-FAIL' "$OUT/$step.log" | tail -5; exit 1; }
done

echo "=== a5 writer surface (DM window opens shortly) ==="
SPIKE_TG_BOT_TOKEN="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/BEEP_IP_BOT_TOKEN')" \
  bash ./a5-writer-surface.sh > "$OUT/a5.log" 2>&1
rc=$?
echo "a5 exit=$rc"
grep -aE 'ASSERT-PASS|ASSERT-FAIL|BLOCKED|INCOMPATIBLE|OPERATOR-ACTION|pairing-window|declarative|graceful skip|A5-' "$OUT/a5.log" | tail -25
echo "=== compatibility matrix ==="
cat "$SPIKE_P/spike1/compatibility-matrix.md" 2>/dev/null || echo "(not generated)"

echo "=== cleanup ==="
bash ./cleanup.sh > "$OUT/cleanup.log" 2>&1
echo "cleanup exit=$?"
grep -aE 'CLEANUP-FAIL|CLEANUP-PASS: exact|FATAL' "$OUT/cleanup.log" | tail -3
echo "A5-CYCLE-DONE rc=$rc evidence=$SPIKE_P/spike1"
