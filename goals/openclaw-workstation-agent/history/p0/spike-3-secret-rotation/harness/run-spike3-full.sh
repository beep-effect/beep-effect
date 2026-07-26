#!/usr/bin/env bash
# Full spike-3 cycle in ONE pass: preflight -> record manifest -> (operator
# credential already installed) -> setup -> a1 -> a2 -> cleanup.
# Cleanup consumes the credential by design, so the whole cycle must run once
# per installed token.
set -uo pipefail
H=/home/elpresidank/YeeBois/projects/beep-effect3/.beep/p0-orchestration/spike3
OUT=/home/elpresidank/.cache/beep-p0-spike3-run
ROOT=/etc/beep/openclaw-spike
CRED="$ROOT/op-service-account-token"
PARK=/etc/beep/.op-token-parked
mkdir -p "$OUT"; rm -f "$OUT"/*.log

sudo -n test -f "$CRED" || { echo "FATAL: credential absent at $CRED — operator must install it first"; exit 1; }

# preflight requires the spike root ABSENT; park the credential (never read)
sudo -n mv -f "$CRED" "$PARK" && sudo -n chown root:root "$PARK" && sudo -n chmod 0400 "$PARK"
sudo -n rmdir "$ROOT" 2>/dev/null || { sudo -n find "$ROOT" -mindepth 1 | head -5; echo "FATAL: spike root not empty"; exit 1; }

export SPIKE_P="$(mktemp -d /home/elpresidank/.cache/beep-p0-spike3.XXXXXX)"
export SPIKE_OP_REF='op://beep-p0-spike3/spike3-rotating/password'
echo "SPIKE_P=$SPIKE_P" | tee "$OUT/SPIKE_P.txt"
cd "$H" || exit 1

restore_cred() {
  sudo -n install -d -o root -g root -m 0755 "$ROOT"
  sudo -n mv -f "$PARK" "$CRED" 2>/dev/null
  sudo -n chown root:elpresidank "$CRED"; sudo -n chmod 0440 "$CRED"
}

echo "=== preflight ==="
bash ./preflight.sh > "$OUT/preflight.log" 2>&1 || { echo "preflight FAILED"; tail -5 "$OUT/preflight.log"; restore_cred; exit 1; }
echo "preflight exit=0"

MAN="$SPIKE_P/spike3/logs/privileged-paths.manifest"
grep -Fxq "$ROOT" "$MAN" || printf '%s\n' "$ROOT" >> "$MAN"
grep -Fxq "$CRED" "$MAN" || printf '%s\n' "$CRED" >> "$MAN"
restore_cred
echo "manifest recorded + credential restored"

echo "=== setup ==="
bash ./setup.sh > "$OUT/setup.log" 2>&1; rc=$?
echo "setup exit=$rc"; grep -aE 'SETUP-|FATAL|ASSERT-FAIL' "$OUT/setup.log" | tail -4
[ "$rc" = 0 ] || exit 1

echo "=== a1 (agent triggers the rotation on cue) ==="
bash ./a1-rotate-same-ref.sh > "$OUT/a1.log" 2>&1 &
A1_PID=$!
# watch for the harness's rotation cue and perform it with no value in argv
( for _ in $(seq 1 120); do
    sleep 2
    if grep -qa 'ROTATE-NOW' "$OUT/a1.log" 2>/dev/null; then
      # rotate via the service account (write_items scope) — no desktop-op
      # authorization prompt; token scoped to this single invocation
      OP_SERVICE_ACCOUNT_TOKEN="$(cat "$CRED")" \
        op item edit spike3-rotating --vault beep-p0-spike3 --generate-password >/dev/null 2>&1 \
        && echo "[runner] rotation performed" >> "$OUT/a1.log"
      break
    fi
    kill -0 "$A1_PID" 2>/dev/null || break
  done ) &
ROT=$!
wait "$A1_PID"; rc1=$?
kill "$ROT" 2>/dev/null
echo "a1 exit=$rc1"; grep -aE 'ASSERT-|A1-|cold-owner|FATAL' "$OUT/a1.log" | tail -12

echo "=== a2 (broken reference) ==="
bash ./a2-broken-ref.sh > "$OUT/a2.log" 2>&1; rc2=$?
echo "a2 exit=$rc2"; grep -aE 'ASSERT-|A2-|FATAL' "$OUT/a2.log" | tail -8

echo "=== cleanup ==="
bash ./cleanup.sh > "$OUT/cleanup.log" 2>&1
echo "cleanup exit=$?"; grep -aE 'CLEANUP-FAIL|CLEANUP-PASS: exact|FATAL' "$OUT/cleanup.log" | tail -4
echo "SPIKE3-CYCLE-DONE a1=$rc1 a2=$rc2"
