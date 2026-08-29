#!/usr/bin/env bash
# P0 spike 4 v2 — setup with realistic pre-upgrade state (disposable).
# Staging order mirrors the real auth-bootstrap ceremony:
#   1. render staging config (agent declared, local ollama model)
#   2. boot gen-A, run one agent turn (creates legacy sessions.json + JSONLs)
#   3. auth ceremony: models auth paste-api-key -> creates per-agent SQLite
#      (stamp 1) AND writes auth-profile metadata into the config
#   4. bake the post-ceremony config into gen-A (19011) and gen-B (19012 —
#      deliberate misrender so acceptance probes on 19011 must fail)
set -euo pipefail
P="${SPIKE_P:?export SPIKE_P=<scratchpad p0 dir>}"
S4="$P/spike4"; BASE="$S4/root"; STATE="$S4/state"; SNAP="$S4/snapshots"
NODEBIN="$HOME/.local/share/mise/installs/node/24/bin"
TOK_FILE="$S4/gateway-token"; [ -f "$TOK_FILE" ] || openssl rand -hex 24 > "$TOK_FILE"
TOK=$(cat "$TOK_FILE")

echo "== teardown previous run state =="
systemctl --user stop openclaw-spike.service 2>/dev/null || true
rm -rf "$STATE" "$SNAP"; mkdir -p "$STATE/log" "$SNAP" "$P/isohome"
[ -d "$BASE/gen-A/node_modules" ] || { echo "gen-A missing — run setup.sh first"; exit 1; }

echo "== step 1: staging config (user-owned during ceremony) =="
jq -n --arg logfile "$STATE/log/openclaw.log" '{
  gateway: { mode: "local", port: 19011, bind: "loopback",
             reload: { mode: "off" } },
  agents: { list: [ { id: "spike", name: "Spike Agent", model: "ollama/gemma3:4b" } ] },
  logging: { file: $logfile }
}' > "$BASE/gen-A/openclaw.json"

OCA="$BASE/gen-A/node_modules/.bin/openclaw"
ENVA=(env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" OPENCLAW_CONFIG_PATH="$BASE/gen-A/openclaw.json" OPENCLAW_STATE_DIR="$STATE" OPENCLAW_GATEWAY_TOKEN="$TOK" OLLAMA_API_KEY=ollama-local)

echo "== step 2: boot gen-A once, run an agent turn to create legacy sessions =="
"${ENVA[@]}" timeout 45 "$OCA" gateway --port 19011 > "$S4/staging-gateway.log" 2>&1 &
sleep 7
"${ENVA[@]}" timeout 30 "$OCA" agent --agent spike -m "spike4 staging turn" --json > "$S4/staging-turn.json" 2>&1 || true
wait || true
ls "$STATE/agents/spike/sessions/" | head -4

echo "== step 3: auth ceremony (writes config metadata + creates per-agent DB) =="
printf 'ollama-local\n' | env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" OPENCLAW_CONFIG_PATH="$BASE/gen-A/openclaw.json" OPENCLAW_STATE_DIR="$STATE" OPENCLAW_AGENT_DIR="$STATE/agents/spike/agent" "$OCA" models auth paste-api-key --provider ollama
rm -f "$BASE/gen-A/openclaw.json.bak"

echo "== step 4: bake post-ceremony config into both generations =="
# gen-B is RE-RENDERED for the candidate version's schema (beta.4: agents.entries
# replaces agents.list; meta.lastTouchedAt is rejected) — the versioned render
# adapter semantics the SPEC mandates, discovered the hard way in run 1.
jq '{gateway: (.gateway | .port = 19012), agents: { entries: { spike: { name: "Spike Agent", model: "ollama/gemma3:4b" } } }, logging, auth}' \
  "$BASE/gen-A/openclaw.json" > "$BASE/gen-B/openclaw.json"
ln -sfnT gen-A "$BASE/current"
for g in gen-A gen-B; do echo "$g cfg-sha256=$(sha256sum "$BASE/$g/openclaw.json" | cut -c1-16) port=$(jq -r .gateway.port "$BASE/$g/openclaw.json")"; done

echo "== step 5: unit =="
install -Dm0644 /dev/stdin "$HOME/.config/systemd/user/openclaw-spike.service" <<EOF
[Unit]
Description=OpenClaw P0 spike 4 gateway (disposable)

[Service]
Environment=PATH=$NODEBIN:/usr/bin:/bin
Environment=HOME=$P/isohome
Environment=OPENCLAW_CONFIG_PATH=$BASE/current/openclaw.json
Environment=OPENCLAW_STATE_DIR=$STATE
Environment=OPENCLAW_GATEWAY_TOKEN=$TOK
Environment=OLLAMA_API_KEY=ollama-local
ExecStart=$BASE/current/run.sh
Restart=no

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload

echo "== pre-upgrade state inventory =="
for db in $(find "$STATE" -name '*.sqlite' | sort); do
  echo "$db user_version=$(python3 -c "import sqlite3,sys; c=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True); print(c.execute('PRAGMA user_version').fetchone()[0])" "$db")"
done
[ -f "$STATE/agents/spike/sessions/sessions.json" ] && echo "legacy sessions.json present"
echo "SPIKE4-V2-SETUP-OK"
