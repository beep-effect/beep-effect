#!/usr/bin/env bash
# P0 spike 1 setup: root-owned immutable config generation + isolated user unit.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
require_context
require_preflight

mkdir -p "$LOGS"
LOG="$LOGS/setup-root.log"
exec > >(tee "$LOG") 2>&1

MUTATED=0
setup_abort() {
  local rc=$?
  trap - EXIT INT TERM
  unset GATEWAY_TOKEN
  if (( MUTATED != 0 )); then
    echo "SETUP-ABORT: restoring the pre-spike state"
    "$SCRIPT_DIR/cleanup.sh" || true
  fi
  exit "$rc"
}
trap setup_abort EXIT INT TERM

echo "== spike1 setup: preflight and teardown-first =="
test -x "$NODEBIN/node" || { echo "FATAL: Node binary disappeared after preflight"; exit 69; }
test -x "$OCA" || { echo "FATAL: OpenClaw binary disappeared after preflight"; exit 69; }
EXPECTED_PACKAGE_HASH="$(<"$S1/staged-package-tree.sha256")"
CURRENT_PACKAGE_HASH="$(package_tree_hash)"
[[ "$CURRENT_PACKAGE_HASH" == "$EXPECTED_PACKAGE_HASH" ]] ||
  { echo "FATAL: staged package tree changed after preflight"; exit 73; }
echo "staged_package_tree_sha256=$CURRENT_PACKAGE_HASH"
sudo -n true || { echo "FATAL: sudo is not interactively primed"; exit 77; }

fragment="$(systemctl --user show -p FragmentPath --value "$UNIT" 2>/dev/null || true)"
if [[ -n "$fragment" ]]; then
  unit_fragment_owned_or_absent
  systemctl --user stop "$UNIT"
  systemctl --user disable "$UNIT" 2>/dev/null || true
fi
if test -e "$UNIT_PATH"; then
  grep -q '^# BEEP_P0_SPIKE1$' "$UNIT_PATH" ||
    { echo "FATAL: refusing unmarked unit $UNIT_PATH"; exit 73; }
  rm -- "$UNIT_PATH"
fi
systemctl --user daemon-reload
systemctl --user reset-failed "$UNIT" 2>/dev/null || true
systemctl --user unset-environment OPENCLAW_GATEWAY_TOKEN TELEGRAM_BOT_TOKEN
manager_secret_environment_absent
remove_owned_root
safe_user_remove "$STATE" "$ISOHOME" "$WORKSPACE" "$CREDENTIALS"
mkdir -p "$STATE/log" "$ISOHOME" "$WORKSPACE" "$CREDENTIALS"
chmod 0700 "$CREDENTIALS"

echo "== spike1 setup: unit-private credentials =="
GATEWAY_TOKEN="$(openssl rand -hex 32)"
write_credential "$GATEWAY_CREDENTIAL" "$GATEWAY_TOKEN"
write_credential "$TELEGRAM_CREDENTIAL" ""
echo "gateway_token_fingerprint=$(credential_fingerprint "$GATEWAY_TOKEN")"
unset GATEWAY_TOKEN

echo "== spike1 setup: render canonical generation A =="
RENDERED="$S1/rendered-a.json"
jq -S -n \
  --arg logfile "$STATE/log/openclaw.log" \
  --arg workspace "$WORKSPACE" \
  '{
    gateway: {
      mode: "local",
      port: 19021,
      bind: "loopback",
      reload: { mode: "off" }
    },
    agents: {
      list: [{
        id: "spike",
        name: "P0 Spike 1",
        model: "ollama/gemma3:4b",
        workspace: $workspace
      }]
    },
    logging: { file: $logfile }
  }' > "$RENDERED"
CONFIG_HASH="$(sha256sum "$RENDERED" | awk '{print $1}')"
GEN="$CONFIG_HASH"
GEN_DIR="$ROOT/$GEN"

echo "== spike1 setup: privileged install =="
MUTATED=1
: > "$ROOT_MANIFEST"
chmod 0600 "$ROOT_MANIFEST"
sudo install -d -o root -g root -m 0755 "$ROOT"
record_root_path "$ROOT"
printf 'beep-p0-spike1\n' |
  sudo install -o root -g root -m 0644 /dev/stdin "$ROOT_MARKER"
record_root_path "$ROOT_MARKER"
stage_generation "$RENDERED" "$CONFIG_HASH"
switch_root_pointer "$GEN" setup
printf 'generation\tconfig_sha256\tport\n%s\t%s\t%s\n' "$GEN" "$CONFIG_HASH" "19021" \
  > "$S1/generations.tsv"

echo "== spike1 setup: install isolated user unit =="
mkdir -p "$(dirname "$UNIT_PATH")"
install -m 0644 /dev/stdin "$UNIT_PATH" <<EOF
# BEEP_P0_SPIKE1
[Unit]
Description=OpenClaw P0 spike 1 gateway (disposable)

[Service]
Type=simple
Environment=PATH=$NODEBIN:/usr/bin:/bin
Environment=HOME=$ISOHOME
Environment=OPENCLAW_CONFIG_PATH=$ROOT/current/openclaw.json
Environment=OPENCLAW_STATE_DIR=$STATE
Environment=OPENCLAW_NIX_MODE=1
Environment=OLLAMA_API_KEY=ollama-local
Environment=OPENCLAW_BIN=$OCA
LoadCredential=gateway-token:$GATEWAY_CREDENTIAL
LoadCredential=telegram-token:$TELEGRAM_CREDENTIAL
ExecStart=$SCRIPT_DIR/unit-entrypoint.sh
Restart=no

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
unit_fragment_owned_or_absent

echo "== spike1 setup: installed-root evidence =="
echo "config_sha256=$CONFIG_HASH generation=$GEN"
echo "installed_spike_root_sha256=$(root_hash)"
echo "root_hash_recipe=sha256(sorted type/mode/uid:gid/path/link plus sorted file sha256; no inode/mtime)"
sudo stat -c '%A %a %U:%G %n' "$ROOT" "$GEN_DIR" "$GEN_DIR/openclaw.json" "$ROOT/current"
inventory_runtime > "$S1/setup-runtime.inventory"
manager_secret_environment_absent

MUTATED=0
trap - EXIT INT TERM
echo "SETUP-PASS"
