#!/usr/bin/env bash
# P0 spike 4 — staged upgrade + forced-fail rollback sequence (disposable).
# Contract assertion 1: stage B -> validate with B binary -> stop -> snapshot
# (incl. WAL) -> switch pointer -> start B (migrates+stamps) -> forced failed
# acceptance probe -> [assertion 2: downgrade WITHOUT restore is refused] ->
# restore snapshot + switch back -> A starts cleanly against restored state.
set -uo pipefail
P="${SPIKE_P:?export SPIKE_P=<scratchpad p0 dir>}"
S4="$P/spike4"; BASE="$S4/root"; STATE="$S4/state"; SNAP="$S4/snapshots"
NODEBIN="$HOME/.local/share/mise/installs/node/24/bin"
UNIT=openclaw-spike.service
rc=0
say()  { echo "[spike4] $*"; }
pass() { echo "ASSERT-PASS: $*"; }
failr() { echo "ASSERT-FAIL: $*"; rc=1; }

uv() { python3 -c "import sqlite3,sys; c=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True); print(c.execute('PRAGMA user_version').fetchone()[0])" "$STATE/state/openclaw.sqlite" 2>/dev/null || echo "ERR"; }
probe() { curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$1/health"; }
wait_health() { # port timeout_s -> 0 if healthy
  local t=0; while [ "$t" -lt "$2" ]; do [ "$(probe "$1")" = 200 ] && return 0; sleep 1; t=$((t+1)); done; return 1
}
switch_ptr() { # gen-name (atomic swap)
  ln -sfnT "$1" "$BASE/.current.tmp.$$" 2>/dev/null || { ln -s "$1" "$BASE/.current.tmp.$$"; }
  mv -T "$BASE/.current.tmp.$$" "$BASE/current"
  say "pointer -> $(readlink "$BASE/current")"
}

say "=== step 0: start gen-A, prove healthy baseline ==="
systemctl --user start "$UNIT"
if wait_health 19011 30; then pass "gen-A live: /health on 19011 = 200"; else failr "gen-A never became healthy"; fi
say "baseline user_version=$(uv)"
[ "$(uv)" = 1 ] && pass "baseline stamp user_version=1" || failr "unexpected baseline stamp $(uv)"

say "=== step 1: gen-B staged side-by-side (setup) ==="
[ -x "$BASE/gen-B/run.sh" ] && pass "gen-B staged side-by-side" || failr "gen-B missing"

say "=== step 2: validate gen-B config with the CANDIDATE (B) binary ==="
env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" OPENCLAW_CONFIG_PATH="$BASE/gen-B/openclaw.json" OPENCLAW_STATE_DIR="$STATE" \
  "$BASE/gen-B/node_modules/.bin/openclaw" config validate >"$S4/validate-B.log" 2>&1
[ $? -eq 0 ] && pass "B binary validates gen-B config" || failr "B config validate failed: $(cat "$S4/validate-B.log")"

say "=== step 3: stop ==="
systemctl --user stop "$UNIT"; sleep 1
systemctl --user is-active "$UNIT" >/dev/null 2>&1 && failr "unit still active after stop" || pass "unit stopped"

say "=== step 4: snapshot state incl. WAL ==="
rm -rf "$SNAP/pre-upgrade"; cp -a "$STATE" "$SNAP/pre-upgrade"
ls "$SNAP/pre-upgrade/state/" | grep -q "openclaw.sqlite-wal" && pass "snapshot contains WAL sidecar" || say "note: no -wal at snapshot time (checkpointed on close)"
[ -f "$SNAP/pre-upgrade/state/openclaw.sqlite" ] && pass "snapshot contains shared sqlite db" || failr "snapshot missing db"

say "=== step 5: atomic pointer switch -> gen-B ==="
switch_ptr gen-B

say "=== step 6: start B; state must migrate and stamp ==="
systemctl --user start "$UNIT"
if wait_health 19012 30; then pass "gen-B booted (listens on its rendered port 19012)"; else failr "gen-B never served"; fi
say "post-migrate user_version=$(uv)"
[ "$(uv)" = 5 ] && pass "migrations ran: user_version 1 -> 5" || failr "expected stamp 5, got $(uv)"

say "=== step 7: acceptance probe against EXPECTED port 19011 must FAIL (forced) ==="
code=$(probe 19011)
if [ "$code" != 200 ]; then pass "acceptance probe failed as forced (http='$code' on 19011) -> rollback path engages"; else failr "acceptance unexpectedly passed"; fi

say "=== step 8 (assertion 2): downgrade WITHOUT restore must be refused ==="
systemctl --user stop "$UNIT"; sleep 1
switch_ptr gen-A
systemctl --user start "$UNIT"; sleep 4
if wait_health 19011 6; then
  failr "old binary unexpectedly serves against migrated state"
else
  jr=$(journalctl --user -u "$UNIT" -n 40 --no-pager 2>/dev/null | grep -c "uses newer schema version")
  st=$(systemctl --user is-active "$UNIT" 2>&1)
  if [ "$jr" -ge 1 ]; then pass "old binary REFUSED migrated state (journal: 'uses newer schema version', unit=$st)"; else failr "no refusal signature in journal (unit=$st)"; fi
fi
systemctl --user stop "$UNIT" 2>/dev/null; systemctl --user reset-failed "$UNIT" 2>/dev/null

say "=== step 9: restore snapshot + switch back -> A starts cleanly ==="
rm -rf "$STATE"; cp -a "$SNAP/pre-upgrade" "$STATE"
switch_ptr gen-A
systemctl --user start "$UNIT"
if wait_health 19011 30; then pass "gen-A healthy against RESTORED state"; else failr "gen-A unhealthy after restore"; fi
[ "$(uv)" = 1 ] && pass "restored stamp user_version=1" || failr "restored stamp wrong: $(uv)"
systemctl --user stop "$UNIT"

echo; if [ "$rc" = 0 ]; then echo "SPIKE4-SEQUENCE-PASS"; else echo "SPIKE4-SEQUENCE-FAIL"; fi
exit "$rc"
