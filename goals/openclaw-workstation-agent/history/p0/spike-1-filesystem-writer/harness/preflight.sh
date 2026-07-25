#!/usr/bin/env bash
# No-secret, no-privileged-mutation capability and baseline preflight.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
require_context
init_scratch

mkdir -p "$LOGS" "$S1/help" "$S1/source-contract"
LOG="$LOGS/preflight.log"
exec > >(tee "$LOG") 2>&1
assert_user_contained "$S1/preflight.ok"
rm -f "$S1/preflight.ok"

echo "== spike1 no-secret capability preflight =="
test -x "$NODEBIN/node" || { echo "FATAL: Node v24 binary missing: $NODEBIN/node"; exit 69; }
test -x "$OCA" || { echo "FATAL: staged OpenClaw missing: $OCA"; exit 69; }
test -d "$PACKAGE_ROOT/dist" || { echo "FATAL: staged OpenClaw dist tree missing"; exit 69; }
for tool in curl find grep jq npm op openssl realpath rg sed sha256sum ss stat systemctl timeout; do
  command -v "$tool" >/dev/null || { echo "FATAL: required tool missing: $tool"; exit 69; }
done
sudo -n true || { echo "FATAL: sudo is not interactively primed"; exit 77; }
sudo test -d /etc/beep && sudo test ! -L /etc/beep &&
  [[ "$(sudo realpath -e /etc/beep)" == "/etc/beep" ]] &&
  [[ "$(sudo stat -c '%U:%G:%a' /etc/beep)" == "root:root:755" ]] ||
  { echo "FATAL: /etc/beep must already be canonical root:root 0755; harness never creates it"; exit 73; }

if sudo test -e "$ROOT" && ! sudo test -f "$ROOT/.beep-p0-spike1"; then
  echo "FATAL: $ROOT is not a marked spike1 root"
  exit 73
fi
if test -L "$UNIT_PATH"; then
  echo "FATAL: $UNIT_PATH is a symlink"
  exit 73
fi
if test -e "$UNIT_PATH" && ! grep -q '^# BEEP_P0_SPIKE1$' "$UNIT_PATH"; then
  echo "FATAL: $UNIT_PATH is not a marked spike1 unit"
  exit 73
fi
fragment="$(systemctl --user show -p FragmentPath --value "$UNIT" 2>/dev/null || true)"
if [[ -n "$fragment" && "$fragment" != "$UNIT_PATH" ]]; then
  echo "FATAL: same-named unit is loaded from unowned fragment: $fragment"
  exit 73
fi

echo "== archive all CLI help surfaces before mutation =="
help_probe() {
  local name="$1"
  shift
  env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$S1/preflight-home" \
    OPENCLAW_STATE_DIR="$S1/preflight-state" "$OCA" "$@" --help \
    >"$S1/help/$name.txt" 2>&1
}
help_probe root
help_probe config-set config set
help_probe doctor doctor
help_probe channels-status channels status
help_probe channels-restart channels restart
help_probe pairing-list pairing list
help_probe pairing-approve pairing approve
help_probe message-send message send

require_flag() {
  local file="$1" flag="$2"
  grep -Eq "(^|[[:space:],])${flag//-/\\-}([=[:space:],]|$)" "$file" ||
    { echo "FATAL: required flag $flag absent from $file"; exit 69; }
}
require_flag "$S1/help/channels-status.txt" --probe
require_flag "$S1/help/channels-status.txt" --json
require_flag "$S1/help/pairing-list.txt" --channel
require_flag "$S1/help/pairing-list.txt" --json
require_flag "$S1/help/message-send.txt" --channel
require_flag "$S1/help/message-send.txt" --message

grep -Eq '(^|[[:space:]])--fix([=[:space:]]|$)' "$S1/help/doctor.txt" ||
  { echo "FATAL: pinned doctor has no exact --fix repair surface"; exit 69; }
grep -Eq '(^|[[:space:]])--non-interactive([=[:space:]]|$)' "$S1/help/doctor.txt" ||
  { echo "FATAL: pinned doctor has no exact --non-interactive surface"; exit 69; }

echo "== bind writer assertions to pinned implementation =="
printf 'writer\tsha256\tsource\n' > "$S1/source-contract/writer-source-sha256.tsv"
source_anchor() {
  local writer="$1" pattern="$2" source
  source="$(rg -l "$pattern" "$PACKAGE_ROOT/dist" --glob '*.js' | sed -n '1p')"
  test -n "$source" ||
    { echo "FATAL: pinned source anchor absent for $writer"; exit 69; }
  printf '%s\t%s\t%s\n' "$writer" "$(sha256sum "$source" | awk '{print $1}')" "$source" |
    tee -a "$S1/source-contract/writer-source-sha256.tsv"
}
source_anchor login-bootstrap 'envToken: params\.env\?\.TELEGRAM_BOT_TOKEN'
source_anchor pairing-first-owner 'Command owner configured.*commands\.ownerAllowFrom was empty'
source_anchor defaultTo-writeback 'failed to persist Telegram defaultTo target'
source_anchor reconnect 'restartPending'
source_anchor token-swap 'Bot token is likely invalid\. Telegram may DELETE the bot'
source_anchor group-supergroup-migration 'Config writes disabled; skipping group config migration\.'
source_anchor configWrites-policy 'function resolveChannelConfigWritesShared'
source_anchor config-set-denial 'await replaceConfigFile'
source_anchor doctor-write-skip 'Doctor config writes are disabled because OpenClaw is running in Nix mode\.'

echo "== pinned inputs =="
VERSION="$(jq -er .version "$PACKAGE_ROOT/package.json")"
BINARY_VERSION="$(env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$S1/preflight-home" \
  OPENCLAW_STATE_DIR="$S1/preflight-state" "$OCA" --version)"
echo "node_version=$("$NODEBIN/node" --version)"
echo "node_binary_sha256=$(sha256sum "$NODEBIN/node" | awk '{print $1}')"
echo "openclaw_version=$BINARY_VERSION"
echo "op_version=$(op --version)"
[[ "$BINARY_VERSION" == *"$VERSION"* ]] ||
  { echo "FATAL: staged binary version does not match package.json $VERSION"; exit 69; }
npm view "openclaw@$VERSION" dist --json |
  tee "$S1/registry-dist.json"
jq -e '.shasum | strings | length > 0' "$S1/registry-dist.json" >/dev/null
jq -e '.integrity | strings | length > 0' "$S1/registry-dist.json" >/dev/null
package_tree_manifest | tee "$S1/staged-package-tree.manifest" | sha256sum |
  awk '{print $1}' | tee "$S1/staged-package-tree.sha256" |
  awk '{print "staged_package_tree_sha256=" $1}'
echo "tree_recipe=sha256(sorted type/mode/path/link records plus sorted regular-file sha256; no inode/mtime)"

echo "== pre-spike inventories =="
{
  printf 'config_dir_preexisting=%s\n' \
    "$(test -d "$HOME/.config" && echo yes || echo no)"
  printf 'systemd_dir_preexisting=%s\n' \
    "$(test -d "$HOME/.config/systemd" && echo yes || echo no)"
  printf 'unit_dir_preexisting=%s\n' \
    "$(test -d "$HOME/.config/systemd/user" && echo yes || echo no)"
} > "$S1/pre-state.txt"
inventory_real_openclaw > "$S1/pre-real-openclaw.inventory"
inventory_root > "$S1/pre-root.inventory"
{
  inventory_tree "$STATE"
  inventory_tree "$ISOHOME"
  inventory_tree "$WORKSPACE"
  inventory_tree "$CREDENTIALS"
} > "$S1/pre-disposable.inventory"
unit_cgroup_pids > "$S1/pre-unit-cgroup.inventory"
ports_inventory > "$S1/pre-listeners.inventory"
manager_secret_environment_absent
if test -d "$HOME/.config/systemd/user"; then
  find "$HOME/.config/systemd/user" -name 'openclaw-spike*' -printf '%m %U:%G %p\n' |
    LC_ALL=C sort > "$S1/pre-unit-files.inventory"
else
  : > "$S1/pre-unit-files.inventory"
fi
sudo find /etc/beep -maxdepth 2 -name 'openclaw-spike*' -printf '%m %U:%G %p -> %l\n' |
  LC_ALL=C sort > "$S1/pre-root-generations.inventory"
safe_user_remove "$S1/preflight-home" "$S1/preflight-state"

touch "$S1/preflight.ok"
echo "PREFLIGHT-PASS"
