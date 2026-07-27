#!/usr/bin/env bash
# v3 fixture seeder: create $SPIKE_P/stampcheck/s633 — a state dir born under
# openclaw 2026.6.33 — required by the classification sequence's additive
# control leg. (The v2 run relied on a manually pre-seeded copy that was lost
# with the dead session's scratchpad; this makes the fixture reproducible.)
set -euo pipefail
P="${SPIKE_P:?export SPIKE_P=<disposable spike root>}"
NODEBIN="$HOME/.local/share/mise/installs/node/24/bin"
FIX="$P/stampcheck/s633"
rm -rf "$FIX"; mkdir -p "$FIX" "$P/isohome" "$P/spike4/logs"
CFG="$P/spike4/s633-seed-config.json"
cat > "$CFG" <<EOF
{ "gateway": { "mode": "local", "port": 19013, "bind": "loopback" }, "logging": { "file": "$P/spike4/s633-seed-openclaw.log" } }
EOF
env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" OPENCLAW_CONFIG_PATH="$CFG" OPENCLAW_STATE_DIR="$FIX" \
  timeout 15 "$P/stage/openclaw-2026.6.33/node_modules/.bin/openclaw" gateway --port 19013 \
  > "$P/spike4/logs/v3-seed-s633.log" 2>&1 || true
uvv=$(python3 -c "import sqlite3,sys; c=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True); print(c.execute('PRAGMA user_version').fetchone()[0])" "$FIX/state/openclaw.sqlite" 2>/dev/null || echo ERR)
echo "seeded s633 state: user_version=$uvv"
[ "$uvv" = 1 ] || { echo "SEED-FAIL: unexpected 2026.6.33 baseline stamp: $uvv"; exit 1; }
echo "SEED-OK"
