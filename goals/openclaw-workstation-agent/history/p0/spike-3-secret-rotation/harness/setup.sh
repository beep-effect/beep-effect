#!/usr/bin/env bash
set -euo pipefail

HARNESS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib.sh
source "$HARNESS/lib.sh"
spike3_require_scratch

OP_REF=${SPIKE_OP_REF:?export SPIKE_OP_REF=op://vault/item/field}
TG_REF=${SPIKE_TG_OP_REF:-}
TG_GROUP=${SPIKE_TG_GROUP_ID:-}
S3=$SPIKE3_DIR
LOGS=$SPIKE3_LOGS
STATE=$S3/state
HOME_DIR=$S3/home
RENDER=$S3/render/openclaw.json
UNIT_FILE=$(spike3_unit_file)
NODE_DIR=$HOME/.local/share/mise/installs/node/24/bin
PACKAGE=$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/openclaw
OC=$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw

fail() { spike3_fail "SETUP-FAIL: $*"; }
section() { printf '\n=== %s ===\n' "$*"; }
assert_package_unchanged() {
  local expected actual
  expected=$(jq -r '.stagedPackage.sha256' "$LOGS/preflight-versions.json")
  actual=$(spike3_tree_hash "$PACKAGE")
  [[ "$actual" == "$expected" ]] ||
    fail "staged OpenClaw package tree changed after preflight"
  printf 'staged-package-sha256=%s unchanged=yes\n' "$actual"
}
setup_complete=0
on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if [[ "$setup_complete" -eq 0 ]]; then
    if [[ -r "$SPIKE3_CREDENTIAL" ]]; then
      credential_audit=$(<"$SPIKE3_CREDENTIAL")
      if [[ -n "$credential_audit" ]]; then
        (spike3_scan_logs service-account "$credential_audit" \
          "$LOGS"/*.log "$LOGS"/*.json \
          "$S3/state/log/openclaw.log") || rc=1
        export OP_SERVICE_ACCOUNT_TOKEN=$credential_audit
        gateway_audit=$(op read "$OP_REF" --no-newline 2>/dev/null || true)
        if [[ -n "$gateway_audit" ]]; then
          (spike3_scan_logs gateway "$gateway_audit" \
            "$LOGS"/*.log "$LOGS"/*.json \
            "$S3/state/log/openclaw.log") || rc=1
        fi
        unset OP_SERVICE_ACCOUNT_TOKEN credential_audit gateway_audit
      fi
    fi
    SPIKE_P=$SPIKE3_P bash "$HARNESS/cleanup.sh" || true
  fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

spike3_require_ref "$OP_REF"
if [[ -n "$TG_REF" || -n "$TG_GROUP" ]]; then
  [[ -n "$TG_REF" && -n "$TG_GROUP" ]] ||
    fail "set both SPIKE_TG_OP_REF and SPIKE_TG_GROUP_ID"
  spike3_require_ref "$TG_REF"
  [[ "$TG_GROUP" =~ ^-?[0-9]+$ ]] ||
    fail "SPIKE_TG_GROUP_ID must be numeric"
fi
[[ -s "$LOGS/preflight.ok" ]] || fail "run preflight.sh before provisioning"
preflight_expected=$(sha256sum "$LOGS/capabilities"/*.txt \
  "$LOGS/preflight-versions.json" |
  sha256sum | cut -d' ' -f1)
[[ "$(cat "$LOGS/preflight.ok")" == "$preflight_expected" ]] ||
  fail "capability evidence changed after preflight"
: >"$LOGS/setup-capabilities-verified"
[[ -x "$OC" && -d "$PACKAGE" ]] || fail "staged OpenClaw package is missing"
[[ -x "$NODE_DIR/node" ]] || fail "Node 24 is missing"
for command in jq op sudo systemctl sha256sum realpath stat; do
  command -v "$command" >/dev/null || fail "required command missing: $command"
done

mkdir -p "$LOGS"
[[ ! -L "$S3" && "$(realpath -e -- "$S3")" == "$S3" ]] ||
  fail "Spike 3 scratch root is symlinked or non-canonical"
spike3_assert_scratch_ownership
exec > >(tee -a "$LOGS/setup.log") 2>&1

section "exact credential metadata and service-user readability"
spike3_manifest_has "$SPIKE3_ETC_ROOT" &&
  spike3_manifest_has "$SPIKE3_CREDENTIAL" ||
  fail "record root and credential in the privileged manifest before provisioning"
spike3_assert_credential

section "teardown-first"
spike3_assert_unit_owned_or_absent
fragment=$(systemctl --user show "$SPIKE3_UNIT" -p FragmentPath --value \
  2>/dev/null || true)
if [[ -n "$fragment" || -e "$UNIT_FILE" ]]; then
  systemctl --user stop "$SPIKE3_UNIT" 2>/dev/null || true
  systemctl --user disable "$SPIKE3_UNIT" 2>/dev/null || true
  rm -f -- "$UNIT_FILE"
  systemctl --user daemon-reload
  systemctl --user reset-failed "$SPIKE3_UNIT" 2>/dev/null || true
fi
spike3_remove_owned_root_artifacts
spike3_assert_scratch_ownership
find "$S3" -mindepth 1 -maxdepth 1 ! -name logs \
  ! -name .beep-spike3-scratch -exec rm -rf -- {} +
mkdir -p "$STATE/log" "$HOME_DIR" "$S3/workspace" "$(dirname "$RENDER")"
chmod 0700 "$STATE" "$HOME_DIR" "$S3/workspace" "$(dirname "$RENDER")"

OP_BIN=$(readlink -f -- "$(command -v op)")
[[ -x "$OP_BIN" ]] || fail "resolved op binary is not executable"

section "render runtime helpers"
cat >"$S3/op-resolver.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
op_bin=${1:?missing op binary}
ref=${2:?missing op reference}
if [[ -e ${SPIKE3_DIR:?}/break-reference ]]; then
  ref="${ref}_spike3_nonexistent"
fi
exec "$op_bin" read "$ref" --no-newline
EOF
chmod 0700 "$S3/op-resolver.sh"

cat >"$S3/service-entry.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
mode=${1:?preflight|gateway}
credential=${CREDENTIALS_DIRECTORY:?}/op-token
[[ -r "$credential" && ! -L "$credential" ]] ||
  { echo "credential unreadable" >&2; exit 78; }
op_token=$(<"$credential")
export OP_SERVICE_ACCOUNT_TOKEN=$op_token
unset OP_SESSION OP_CONNECT_TOKEN
case "$mode" in
  preflight)
    "$SPIKE_OP_BIN" whoami >/dev/null
    echo "SERVICE-ENV-OP-WHOAMI-PASS"
    ;;
  gateway)
    resolved_config=$(realpath -e -- "$SPIKE_CONFIG")
    case "$resolved_config" in
      "$SPIKE3_DIR"/*|/etc/beep/openclaw-spike/*) ;;
      *) echo "resolved config escaped Spike 3 isolation" >&2; exit 78 ;;
    esac
    exec env -i PATH="$SPIKE_PATH" HOME="$SPIKE_HOME" \
      OPENCLAW_CONFIG_PATH="$SPIKE_CONFIG" OPENCLAW_STATE_DIR="$SPIKE_STATE" \
      SPIKE3_DIR="$SPIKE3_DIR" SPIKE_CREDENTIAL="$credential" \
      SPIKE_OC="$SPIKE_OC" bash -c '
        op_token=$(<"$SPIKE_CREDENTIAL")
        export OP_SERVICE_ACCOUNT_TOKEN=$op_token
        exec "$SPIKE_OC" gateway
      '
    ;;
  *) echo "unknown mode: $mode" >&2; exit 64 ;;
esac
EOF
chmod 0700 "$S3/service-entry.sh"

section "render declarative config"
base=$(jq -n \
  --argjson port "$SPIKE3_PORT" \
  --arg opRef "$OP_REF" \
  --arg opBin "$OP_BIN" \
  --arg resolver "$S3/op-resolver.sh" \
  --arg trustedDir "$S3" \
  --arg logfile "$STATE/log/openclaw.log" \
  --arg workspace "$S3/workspace" \
  '{
    gateway: {
      mode: "local",
      port: $port,
      bind: "loopback",
      auth: {
        mode: "token",
        token: {source: "exec", provider: "op_gateway", id: "value"}
      },
      reload: {mode: "off"}
    },
    secrets: {
      providers: {
        op_gateway: {
          source: "exec",
          command: $resolver,
          args: [$opBin, $opRef],
          passEnv: ["OP_SERVICE_ACCOUNT_TOKEN", "SPIKE3_DIR", "PATH"],
          trustedDirs: [$trustedDir],
          jsonOnly: false
        }
      }
    },
    agents: {
      list: [{
        id: "spike3",
        name: "Spike 3",
        workspace: $workspace,
        model: {primary: "ollama/gemma3:4b"}
      }]
    },
    models: {
      providers: {
        ollama: {
          baseUrl: "http://127.0.0.1:11434",
          apiKey: "ollama-local",
          api: "ollama",
          models: [{id: "gemma3:4b", name: "gemma3:4b", input: ["text"]}]
        }
      }
    },
    logging: {file: $logfile}
  }')
if [[ -n "$TG_REF" ]]; then
  jq --arg tgRef "$TG_REF" --arg group "$TG_GROUP" \
    '.secrets.providers.op_telegram = (.secrets.providers.op_gateway |
       .args[1] = $tgRef) |
     .channels.telegram = {
       enabled: true,
       botToken: {source: "exec", provider: "op_telegram", id: "value"},
       dmPolicy: "disabled",
       groupPolicy: "open",
       groups: {($group): {requireMention: false}},
       configWrites: false
     }' <<<"$base" >"$RENDER"
  : >"$S3/telegram-enabled"
  printf 'operator-created Telegram SecretRef configured\n'
else
  printf '%s\n' "$base" >"$RENDER"
  printf 'Telegram reference absent; assertion 3 will be BLOCKED\n'
fi
unset base
chmod 0600 "$RENDER"

section "validate before privileged install"
assert_package_unchanged
spike3_run_openclaw "$OC" "$NODE_DIR" "$HOME_DIR" "$RENDER" "$STATE" \
  config validate

section "install root-owned content-addressed generation"
config_sha=$(sha256sum "$RENDER" | cut -d' ' -f1)
GENERATION=$SPIKE3_ETC_ROOT/$config_sha
[[ "$(sudo stat -Lc '%u:%g:%a:%F' -- /etc/beep)" == \
  "0:0:755:directory" ]] || fail "/etc/beep metadata is not root:root 0755"
[[ "$(sudo stat -Lc '%u:%g:%a:%F' -- "$SPIKE3_ETC_ROOT")" == \
  "0:0:755:directory" ]] ||
  fail "Spike 3 root metadata is not root:root 0755"
spike3_record_privileged_path "$SPIKE3_ETC_ROOT/.beep-spike3-root"
printf '%s\n' "$SPIKE3_MARKER_TEXT" |
  sudo install -o root -g root -m 0644 /dev/stdin \
    "$SPIKE3_ETC_ROOT/.beep-spike3-root"
spike3_record_privileged_path "$GENERATION"
sudo install -d -o root -g root -m 0755 "$GENERATION"
spike3_record_privileged_path "$GENERATION/.beep-spike3-generation"
printf '%s\n' "$SPIKE3_MARKER_TEXT" |
  sudo install -o root -g root -m 0644 /dev/stdin \
    "$GENERATION/.beep-spike3-generation"
spike3_record_privileged_path "$GENERATION/openclaw.json"
sudo install -o root -g root -m 0644 "$RENDER" "$GENERATION/openclaw.json"
spike3_record_privileged_path "$SPIKE3_ETC_ROOT/current.new"
sudo ln -s -- "$config_sha" "$SPIKE3_ETC_ROOT/current.new"
spike3_record_privileged_path "$SPIKE3_ETC_ROOT/current"
sudo mv -Tf -- "$SPIKE3_ETC_ROOT/current.new" "$SPIKE3_ETC_ROOT/current"
[[ "$(realpath -e -- "$SPIKE3_ETC_ROOT/current")" == "$GENERATION" ]] ||
  fail "active pointer escaped the installed generation"
[[ "$(sudo stat -c '%u:%g:%F' -- "$SPIKE3_ETC_ROOT/current")" == \
  "0:0:symbolic link" ]] || fail "active pointer is not root-owned"
[[ "$(sudo stat -Lc '%u:%g:%a:%F' -- "$GENERATION/openclaw.json")" == \
  "0:0:644:regular file" ]] ||
  fail "installed config metadata mismatch"
spike3_assert_privileged_tree

section "validate through the root-owned active pointer"
CONFIG=$SPIKE3_ETC_ROOT/current/openclaw.json
assert_package_unchanged
spike3_run_openclaw "$OC" "$NODE_DIR" "$HOME_DIR" "$CONFIG" "$STATE" \
  config validate

section "install dedicated user unit"
install -Dm0644 /dev/stdin "$UNIT_FILE" <<EOF
# beep-p0-spike3-owned-v1
[Unit]
Description=OpenClaw P0 spike 3 gateway (disposable)
After=network-online.target

[Service]
Type=simple
LoadCredential=op-token:$SPIKE3_CREDENTIAL
Environment=SPIKE_PATH=$NODE_DIR:/usr/bin:/bin
Environment=SPIKE_HOME=$HOME_DIR
Environment=SPIKE_CONFIG=$CONFIG
Environment=SPIKE_STATE=$STATE
Environment=SPIKE3_DIR=$S3
Environment=SPIKE_OP_BIN=$OP_BIN
Environment=SPIKE_OC=$OC
UnsetEnvironment=OP_SERVICE_ACCOUNT_TOKEN OP_SESSION OP_CONNECT_TOKEN OPENCLAW_GATEWAY_TOKEN
ExecStartPre=$S3/service-entry.sh preflight
ExecStart=$S3/service-entry.sh gateway
StandardOutput=append:$LOGS/gateway.log
StandardError=append:$LOGS/gateway.log
Restart=no

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
assert_package_unchanged
systemctl --user start "$SPIKE3_UNIT"

section "exact service-environment preflight"
deadline=$((SECONDS + 30))
until systemctl --user is-active --quiet "$SPIKE3_UNIT"; do
  ((SECONDS < deadline)) || {
    systemctl --user show "$SPIKE3_UNIT" -p ActiveState -p SubState \
      -p Result --no-pager || true
    fail "gateway did not become active"
  }
  sleep 1
done
grep -F 'SERVICE-ENV-OP-WHOAMI-PASS' "$LOGS/gateway.log" \
  >"$LOGS/service-preflight.log" || true
grep -Fxq 'SERVICE-ENV-OP-WHOAMI-PASS' "$LOGS/service-preflight.log" ||
  fail "op whoami evidence missing from exact service environment"

section "installed-root provenance"
spike3_assert_privileged_tree
spike3_installed_root_manifest >"$LOGS/installed-root.manifest"
installed_root_sha=$(sha256sum "$LOGS/installed-root.manifest" | cut -d' ' -f1)
jq --arg configSha "$config_sha" \
  --arg installedRootSha "$installed_root_sha" \
  --arg installedRootRecipe \
    'sorted find -P -xdev traversal of complete /etc/beep/openclaw-spike with bootstrap credential digest redacted' \
  '. + {configSha256:$configSha,
    spikeRoot:{recipe:$installedRootRecipe,sha256:$installedRootSha}}' \
  "$LOGS/preflight-versions.json" >"$LOGS/versions.json.new"
mv -f -- "$LOGS/versions.json.new" "$LOGS/versions.json"
printf 'config-sha256=%s\nspike-root-sha256=%s\n' \
  "$config_sha" "$installed_root_sha"

section "last-resort secret scan"
credential_value=$(<"$SPIKE3_CREDENTIAL")
export OP_SERVICE_ACCOUNT_TOKEN=$credential_value
gateway_value=$("$OP_BIN" read "$OP_REF" --no-newline)
[[ -n "$gateway_value" ]] || fail "gateway secret is empty"
spike3_scan_logs service-account "$credential_value" \
  "$LOGS/setup.log" "$LOGS/gateway.log" "$LOGS/service-preflight.log" \
  "$STATE/log/openclaw.log"
spike3_scan_logs gateway "$gateway_value" \
  "$LOGS/setup.log" "$LOGS/gateway.log" "$LOGS/service-preflight.log" \
  "$STATE/log/openclaw.log"
if [[ -n "$TG_REF" ]]; then
  telegram_value=$("$OP_BIN" read "$TG_REF" --no-newline)
  [[ -n "$telegram_value" ]] || fail "Telegram secret is empty"
  spike3_scan_logs telegram "$telegram_value" \
    "$LOGS/setup.log" "$LOGS/gateway.log" "$LOGS/service-preflight.log" \
    "$STATE/log/openclaw.log"
  unset telegram_value
fi
unset OP_SERVICE_ACCOUNT_TOKEN credential_value gateway_value

setup_complete=1
trap - EXIT INT TERM
printf 'SETUP-PASS unit=%s port=%s config=%s\n' \
  "$SPIKE3_UNIT" "$SPIKE3_PORT" "$CONFIG"
