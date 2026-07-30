#!/usr/bin/env bash
# P0 spike 4 — setup (disposable spike code). Builds two side-by-side
# generations from the pre-staged npm installs and the active-generation
# pointer, plus the systemd --user spike unit.
#   gen-A: openclaw 2026.7.1-2, gateway port 19011 (the EXPECTED port)
#   gen-B: openclaw 2026.7.2-beta.4, gateway port 19012 (deliberate misrender:
#          acceptance probes expect 19011, so B must fail acceptance)
# Generation dirs are user-owned here: OS-enforced root ownership is spike 1's
# subject; spike 4 exercises the generation state machine across SQLite stamps.
set -euo pipefail
P="${SPIKE_P:?export SPIKE_P=<scratchpad p0 dir>}"
S4="$P/spike4"
BASE="$S4/root"; STATE="$S4/state"; SNAP="$S4/snapshots"
NODEBIN="$HOME/.local/share/mise/installs/node/24/bin"

render_config() { # port
  jq -n --argjson port "$1" --arg logfile "$STATE/log/openclaw.log" '{
    gateway: { mode: "local", port: $port, bind: "loopback" },
    logging: { file: $logfile }
  }'
}

mkdir -p "$BASE" "$STATE/log" "$SNAP" "$P/isohome"

stage_gen() { # name version port
  local gen="$BASE/$1" ver="$2" port="$3"
  mkdir -p "$gen"
  cp -al "$P/stage/openclaw-$ver/node_modules" "$gen/node_modules"
  render_config "$port" > "$gen/openclaw.json"
  cat > "$gen/run.sh" <<EOF
#!/usr/bin/env bash
exec "\$(dirname "\$0")/node_modules/.bin/openclaw" gateway
EOF
  chmod +x "$gen/run.sh"
  echo "staged $1 = openclaw@$ver port=$port cfg-sha=$(sha256sum "$gen/openclaw.json" | cut -c1-16)"
}

stage_gen gen-A 2026.7.1-2 19011
stage_gen gen-B 2026.7.2-beta.4 19012
ln -sfnT gen-A "$BASE/current"

install -Dm0644 /dev/stdin "$HOME/.config/systemd/user/openclaw-spike.service" <<EOF
[Unit]
Description=OpenClaw P0 spike 4 gateway (disposable)

[Service]
Environment=PATH=$NODEBIN:/usr/bin:/bin
Environment=HOME=$P/isohome
Environment=OPENCLAW_CONFIG_PATH=$BASE/current/openclaw.json
Environment=OPENCLAW_STATE_DIR=$STATE
ExecStart=$BASE/current/run.sh
Restart=no

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
echo "SPIKE4-SETUP-OK base=$BASE state=$STATE"
ls -la "$BASE"
