#!/usr/bin/env bash
# Pack the fork's Linux x64 CLI archive from an already-built T3 Code worktree and
# publish it in GitHub-release layout on a tailnet-only Tailscale Serve port, so
# fleet hosts install it through T3's own updater (T3CODE_RELEASE_BASE_URL).
#
# Usage: t3code-fork-publish <build-tree> <version> <fork-commit> <upstream-commit>
#   <build-tree>  worktree where `vp install` and the desktop build already ran
#   <version>     the stamped release version (apps/server/package.json)
#
# Layout under $publish_dir (served as https://<hub>.<tailnet>.ts.net:<port>/):
#   latest.json                       {version, forkCommit, upstreamCommit, arch, node, archive, sha256, builtAt}
#   v<version>/t3-<version>-linux-x64.tar.gz
#   v<version>/SHA256SUMS
# Version directories are immutable; latest.json is replaced atomically.
set -euo pipefail

build_tree=${1:?build tree}
version=${2:?version}
fork_commit=${3:?fork commit}
upstream_commit=${4:-}
publish_dir=${T3CODE_FORK_PUBLISH_DIR:-$HOME/.local/opt/t3code/publish}
serve_port=${T3CODE_FORK_SERVE_PORT:-8447}
keep_versions=${T3CODE_FORK_KEEP_VERSIONS:-3}
archive="t3-$version-linux-x64.tar.gz"

[[ -d "$build_tree/apps/server/dist/client" ]] || { echo "missing apps/server/dist/client in $build_tree (desktop build first)" >&2; exit 1; }
[[ "$(uname -m)" == x86_64 ]] || { echo "publish builds linux-x64 only" >&2; exit 1; }
node_version=$(node -p 'process.versions.node')
engines=$(node -p "require('$build_tree/package.json').engines.node")
[[ "$node_version" == "$engines" ]] || { echo "node $node_version on PATH; the single-executable build needs $engines" >&2; exit 1; }

cd "$build_tree"
# The server build scripts spawn `vp` by name.
export PATH="$build_tree/node_modules/.bin:$PATH"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

# build-cli-archive.ts attributes the bundled libatomic.so.1 through dpkg-query (Ubuntu CI).
# On a pacman host answer the same two queries from pacman; the GPL license text still ships.
if ! command -v dpkg-query >/dev/null 2>&1 && command -v pacman >/dev/null 2>&1; then
  mkdir -p "$stage/bin"
  cat > "$stage/bin/dpkg-query" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  -S) pkg=$(pacman -Qoq "$2"); printf '%s: %s\n' "$pkg" "$2" ;;
  -W) pkg=${*: -1}; ver=$(pacman -Q "$pkg" | awk '{print $2}'); printf '%s %s %s' "$ver" "$pkg" "$ver" ;;
  *) exit 2 ;;
esac
SHIM
  chmod +x "$stage/bin/dpkg-query"
  export PATH="$stage/bin:$PATH"
fi

echo "[fork-publish] building resource monitor"
cargo build --locked --release --manifest-path native/resource-monitor/Cargo.toml
mkdir -p "$stage/resource-monitor/linux-x64"
cp native/resource-monitor/target/release/t3-resource-monitor "$stage/resource-monitor/linux-x64/"

echo "[fork-publish] building server single-executable"
node apps/server/scripts/cli.ts build-exe

echo "[fork-publish] building CLI archive $archive"
node scripts/build-cli-archive.ts --platform linux --arch x64 --version "$version" \
  --resource-monitor-dir "$stage/resource-monitor" --output-dir "$stage/out"
[[ -f "$stage/out/$archive" ]] || { echo "archive build produced no $stage/out/$archive" >&2; exit 1; }

(cd "$stage/out" && sha256sum "$archive" > SHA256SUMS)
sha256=$(cut -d' ' -f1 "$stage/out/SHA256SUMS")

version_dir="$publish_dir/v$version"
mkdir -p "$publish_dir"
rm -rf "$version_dir.new"
mkdir -p "$version_dir.new"
install -m644 "$stage/out/$archive" "$stage/out/SHA256SUMS" "$version_dir.new/"
rm -rf "$version_dir"
mv "$version_dir.new" "$version_dir"

printf '{"version":"%s","forkCommit":"%s","upstreamCommit":"%s","arch":"linux-x64","node":"%s","archive":"v%s/%s","sha256":"%s","builtAt":"%s"}\n' \
  "$version" "$fork_commit" "$upstream_commit" "$node_version" "$version" "$archive" "$sha256" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$publish_dir/latest.json.new"
mv -f "$publish_dir/latest.json.new" "$publish_dir/latest.json"

# Keep the newest $keep_versions version directories (the live one is always newest).
ls -1dt "$publish_dir"/v*/ 2>/dev/null | tail -n +"$((keep_versions + 1))" | while read -r old; do
  echo "[fork-publish] pruning $old"; rm -rf "$old"
done

# Tailnet-only directory serve (no Funnel). Idempotent.
if ! tailscale serve status 2>/dev/null | grep -A1 ":$serve_port " | grep -q "path  $publish_dir"; then
  tailscale serve --bg --https="$serve_port" "$publish_dir" >/dev/null
fi
host=$(tailscale status --json | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).Self.DNSName.replace(/\.$/,'')")
url="https://$host:$serve_port"
curl -fsS --max-time 15 "$url/latest.json" >/dev/null || { echo "serve check failed at $url/latest.json" >&2; exit 1; }
echo "[fork-publish] published $version ($fork_commit) at $url"
