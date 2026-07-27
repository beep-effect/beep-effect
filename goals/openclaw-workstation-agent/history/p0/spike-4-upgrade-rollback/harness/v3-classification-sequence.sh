#!/usr/bin/env bash
# P0 spike 4 v2 — full contract sequence (disposable spike code).
# Assertion 1: stage -> validate(B) -> stop -> snapshot(+WAL) -> switch ->
#              start B (shared 1->5, agent 1->14, sessions flip) -> forced
#              acceptance fail -> restore + switch back -> A clean start.
# Assertion 2: downgrade WITHOUT restore refused (shared + agent surfaces).
# Extras: additive control leg (6.33 state under 7.1-2 rolls back w/o restore),
#         future-version guard fixture (meta.lastTouchedVersion 2099.1.1).
set -euo pipefail
P="${SPIKE_P:?}"; S4="$P/spike4"; BASE="$S4/root"; STATE="$S4/state"; SNAP="$S4/snapshots"
NODEBIN="$HOME/.local/share/mise/installs/node/24/bin"
TOK=$(cat "$S4/gateway-token")
UNIT=openclaw-spike.service
rc=0
say()  { echo "[spike4] $*"; }
pass() { echo "ASSERT-PASS: $*"; }
failr(){ echo "ASSERT-FAIL: $*"; rc=1; }
uv()   { python3 -c "import sqlite3,sys; c=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True); print(c.execute('PRAGMA user_version').fetchone()[0])" "$1" 2>/dev/null || echo ERR; }
probe(){ curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$1/health"; }
wait_health(){ local t=0; while [ "$t" -lt "$2" ]; do [ "$(probe "$1")" = 200 ] && return 0; sleep 1; t=$((t+1)); done; return 1; }
switch_ptr(){ ln -s "$1" "$BASE/.ptr.$$"; mv -T "$BASE/.ptr.$$" "$BASE/current"; say "pointer -> $(readlink "$BASE/current")"; }
SHARED="$STATE/state/openclaw.sqlite"; AGENT="$STATE/agents/spike/agent/openclaw-agent.sqlite"

say "=== step 0: baseline on gen-A ==="
systemctl --user start "$UNIT"
wait_health 19011 30 && pass "gen-A live on 19011" || failr "gen-A not healthy"
[ "$(uv "$SHARED")" = 1 ] && pass "shared db user_version=1" || failr "shared stamp: $(uv "$SHARED")"
[ "$(uv "$AGENT")" = 1 ] && pass "per-agent db user_version=1" || failr "agent stamp: $(uv "$AGENT")"
[ -f "$STATE/agents/spike/sessions/sessions.json" ] && pass "legacy sessions.json present pre-upgrade" || failr "sessions.json missing"

say "=== step 1-2: gen-B staged; validate with CANDIDATE binary ==="
env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" OPENCLAW_CONFIG_PATH="$BASE/gen-B/openclaw.json" OPENCLAW_STATE_DIR="$STATE" \
  "$BASE/gen-B/node_modules/.bin/openclaw" config validate > "$S4/v2-validate-B.log" 2>&1 \
  && pass "B binary validates gen-B config" || failr "B validate failed: $(tail -1 "$S4/v2-validate-B.log")"

say "=== step 3-4: stop; snapshot state incl. WAL sidecars ==="
systemctl --user stop "$UNIT"; sleep 1
rm -rf "$SNAP/pre-upgrade"; cp -a "$STATE" "$SNAP/pre-upgrade"
n_wal=$(find "$SNAP/pre-upgrade" -name '*-wal' | wc -l)
say "snapshot WAL sidecars: $n_wal"
[ -f "$SNAP/pre-upgrade/state/openclaw.sqlite" ] && [ -f "$SNAP/pre-upgrade/agents/spike/agent/openclaw-agent.sqlite" ] \
  && pass "snapshot holds shared + per-agent DBs" || failr "snapshot incomplete"

say "=== step 5-6: switch -> gen-B; start; migrations must stamp ==="
switch_ptr gen-B
systemctl --user start "$UNIT"
wait_health 19012 40 && pass "gen-B serving on its rendered port 19012" || failr "gen-B not serving"
sleep 2
[ "$(uv "$SHARED")" = 5 ] && pass "shared db migrated 1 -> 5" || failr "shared post-migrate: $(uv "$SHARED")"
[ "$(uv "$AGENT")" = 14 ] && pass "per-agent db migrated 1 -> 14" || failr "agent post-migrate: $(uv "$AGENT")"
if [ -f "$STATE/agents/spike/sessions/sessions.json" ]; then say "note: sessions.json still on disk post-flip (import keeps file)"; else say "note: sessions.json consumed by SQLite flip"; fi
ls "$STATE/agents/spike/sessions/" > "$S4/v2-sessions-after-migrate.txt" 2>&1 || true

say "=== step 7: forced acceptance failure (expected port 19011) ==="
code=$(probe 19011 || true)
[ "$code" != 200 ] && pass "acceptance probe on 19011 failed as forced (http='$code')" || failr "acceptance unexpectedly passed"

say "=== step 8 (assertion 2): downgrade WITHOUT restore refused ==="
systemctl --user stop "$UNIT"; sleep 1
switch_ptr gen-A
systemctl --user start "$UNIT"; sleep 4
if wait_health 19011 6; then
  failr "old binary unexpectedly healthy on migrated state"
else
  journalctl --user -u "$UNIT" -n 60 --no-pager > "$S4/v2-refusal-journal.log" 2>&1
  grep -q "uses newer schema version" "$S4/v2-refusal-journal.log" \
    && pass "downgrade refused: $(grep -o 'uses newer schema version [0-9]*; this OpenClaw build supports [0-9]*' "$S4/v2-refusal-journal.log" | head -1)" \
    || failr "refusal signature missing (unit=$(systemctl --user is-active "$UNIT" 2>&1))"
fi
systemctl --user stop "$UNIT" 2>/dev/null; systemctl --user reset-failed "$UNIT" 2>/dev/null

say "=== step 8b (assertion 3): forward recovery on migrated state ==="
switch_ptr gen-B
systemctl --user start "$UNIT"
wait_health 19012 30 && pass "gen-B healthy against still-migrated state" || failr "gen-B unhealthy on forward recovery"
[ "$(uv "$SHARED")" = 5 ] && pass "forward recovery shared db remains user_version=5" || failr "forward recovery shared stamp: $(uv "$SHARED")"
[ "$(uv "$AGENT")" = 14 ] && pass "forward recovery per-agent db remains user_version=14" || failr "forward recovery agent stamp: $(uv "$AGENT")"
systemctl --user stop "$UNIT"

say "=== step 9: restore snapshot + switch back; A starts cleanly ==="
rm -rf "$STATE"; cp -a "$SNAP/pre-upgrade" "$STATE"
switch_ptr gen-A
systemctl --user start "$UNIT"
wait_health 19011 30 && pass "gen-A healthy against restored state" || failr "gen-A unhealthy post-restore"
[ "$(uv "$SHARED")" = 1 ] && [ "$(uv "$AGENT")" = 1 ] && pass "restored stamps shared=1 agent=1" || failr "restored stamps wrong: shared=$(uv "$SHARED") agent=$(uv "$AGENT")"
[ -f "$STATE/agents/spike/sessions/sessions.json" ] && pass "legacy sessions.json restored" || failr "sessions.json missing after restore"
systemctl --user stop "$UNIT"

say "=== extra A: additive control leg — 2026.6.33 state under 7.1-2, rollback w/o restore ==="
CTRL="$S4/ctrl-state"; rm -rf "$CTRL"; cp -a "$P/stampcheck/s633" "$CTRL"
cat > "$S4/ctrl-config.json" <<EOF
{ "gateway": { "mode": "local", "port": 19013, "bind": "loopback" }, "logging": { "file": "$SPIKE_P/spike4/ctrl-openclaw.log" } }
EOF
env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" OPENCLAW_CONFIG_PATH="$S4/ctrl-config.json" OPENCLAW_STATE_DIR="$CTRL" \
  timeout 15 "$P/stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw" gateway --port 19013 > "$S4/v2-ctrl-712.log" 2>&1 || true
[ "$(uv "$CTRL/state/openclaw.sqlite")" = 1 ] && pass "additive hop: 7.1-2 leaves user_version=1" || failr "control stamp: $(uv "$CTRL/state/openclaw.sqlite")"
env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" OPENCLAW_CONFIG_PATH="$S4/ctrl-config.json" OPENCLAW_STATE_DIR="$CTRL" \
  timeout 15 "$P/stage/openclaw-2026.6.33/node_modules/.bin/openclaw" gateway --port 19013 > "$S4/v2-ctrl-633-back.log" 2>&1 || rcx=$?
rcx=${rcx:-0}
if [ "$rcx" = 124 ] && grep -q "listening" "$S4/v2-ctrl-633-back.log"; then pass "6.33 starts cleanly on 7.1-2-touched state WITHOUT restore (additive hop is rollback-benign)"; else failr "control rollback failed (exit $rcx)"; fi

say "=== extra B: future-version guard fixture ==="
jq '.meta = { lastTouchedVersion: "2099.1.1" }' "$BASE/gen-A/openclaw.json" > "$S4/future-config.json"
env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" OPENCLAW_CONFIG_PATH="$S4/future-config.json" OPENCLAW_STATE_DIR="$S4/future-state" \
  timeout 15 "$P/stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw" gateway --port 19014 > "$S4/v2-future-guard.log" 2>&1 || rcf=$?
rcf=${rcf:-0}
if [ "$rcf" != 124 ] && [ "$rcf" != 0 ]; then pass "future-version guard blocked older binary (exit $rcf): $(grep -iEo 'newer.{0,120}' "$S4/v2-future-guard.log" | head -1)"; else failr "future-version guard did NOT block (exit $rcf)"; fi

echo; [ "$rc" = 0 ] && echo "SPIKE4-V3-PASS" || echo "SPIKE4-V3-FAIL"
exit "$rc"
