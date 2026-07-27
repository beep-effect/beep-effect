#!/usr/bin/env bash
set -euo pipefail

P="${SPIKE_P:?export SPIKE_P=<disposable spike root>}"
S4="$P/spike4"
LOG="$S4/logs/v3-pins.log"
NODEBIN="$HOME/.local/share/mise/installs/node/24/bin"
VERSIONS=(2026.6.33 2026.7.1-2 2026.7.2-beta.4)

mkdir -p "$S4/logs" "$P/isohome"

capture_pre() {
  echo "[spike4] === v3 pins: staged inputs ==="
  echo "node --version: $("$NODEBIN/node" --version)"

  local version stage binary package_json
  for version in "${VERSIONS[@]}"; do
    stage="$P/stage/openclaw-$version"
    binary="$stage/node_modules/.bin/openclaw"
    package_json="$stage/node_modules/openclaw/package.json"
    [ -x "$binary" ] || { echo "missing staged binary: $binary"; return 1; }
    [ -f "$package_json" ] || { echo "missing staged package manifest: $package_json"; return 1; }

    echo
    echo "[openclaw@$version]"
    echo "openclaw --version: $(env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" "$binary" --version)"
    echo "npm view openclaw@$version dist.shasum dist.integrity:"
    env -i PATH="$NODEBIN:/usr/bin:/bin" HOME="$P/isohome" \
      npm view "openclaw@$version" dist.shasum dist.integrity
    echo "package.json sha256: $(sha256sum "$package_json" | awk '{print $1}')"
  done

  cat <<'EOF'

[spike-root content-hash recipe]
Root: $SPIKE_P/spike4/root after v2-setup.sh has rendered both generation configs.
Scope: every regular file below that root; symlinks are excluded. The generated
gateway-token is outside this root and MUST NOT be hashed or archived.
Recipe: sort root-relative file names bytewise; for each file feed
<relative-path><NUL><file-sha256><NUL> into sha256sum. This makes the result
independent of mtimes, inode numbers, and traversal order. Rendered file
content includes the disposable absolute SPIKE_P path, so the resulting hash
intentionally pins this specific run.
EOF
}

capture_post() {
  local root="$S4/root"
  local gen config_hash root_hash

  echo "[spike4] === v3 pins: rendered configs and spike root ==="
  for gen in gen-A gen-B; do
    [ -f "$root/$gen/openclaw.json" ] || {
      echo "missing rendered config: $root/$gen/openclaw.json"
      return 1
    }
    config_hash=$(sha256sum "$root/$gen/openclaw.json" | awk '{print $1}')
    echo "$gen openclaw.json sha256: $config_hash"
  done

  root_hash=$(
    find "$root" -type f -printf '%P\0' |
      LC_ALL=C sort -z |
      while IFS= read -r -d '' relative_path; do
        printf '%s\0' "$relative_path"
        sha256sum "$root/$relative_path" | awk '{printf "%s", $1}'
        printf '\0'
      done |
      sha256sum |
      awk '{print $1}'
  )
  echo "spike-root content sha256: $root_hash"
}

case "${1:-}" in
  pre)
    : > "$LOG"
    capture_pre 2>&1 | tee -a "$LOG"
    ;;
  post)
    [ -f "$LOG" ] || { echo "missing pre-capture log: $LOG" >&2; exit 1; }
    capture_post 2>&1 | tee -a "$LOG"
    ;;
  *)
    echo "usage: $0 pre|post" >&2
    exit 2
    ;;
esac
