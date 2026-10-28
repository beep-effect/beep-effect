#!/usr/bin/env bash
# Prepare and check a source-pinned upstream policy patch. Does not install or activate it.
set -euo pipefail
set +x
umask 077
root="$(cd "$(dirname "$0")" && pwd)"
patch="$root/patches/4.0.20-signed-policy.patch"
metadata="$root/patches/4.0.20-signed-policy.json"
revision=0e893f63e1c7f1ac3c460d79e75fb63d4c9f7c85
readarray -t pins < <(python3 - "$metadata" <<'PY'
import json,sys
m=json.load(open(sys.argv[1]));print(m['upstreamCommit']);print(m['patchSha256'])
PY
)
[[ "${pins[0]}" == "$revision" ]] || { echo 'Unexpected upstream source pin' >&2; exit 1; }
printf '%s  %s\n' "${pins[1]}" "$patch" | sha256sum --check --status
cache="${XDG_CACHE_HOME:-$HOME/.cache}/beep/turbo-r2-policy/$revision-${pins[1]}"
source="$cache/source"
prepare() {
  mkdir -p "$cache"
  if [[ ! -d "$source/.git" ]]; then
    [[ ! -e "$source" ]] || { echo 'Source cache is incomplete; preserve it for inspection' >&2; return 1; }
    GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c advice.detachedHead=false clone --quiet --depth 1 --branch 4.0.20 \
      https://github.com/brunojppb/turbo-cache-server.git "$source"
    [[ "$(git -C "$source" rev-parse HEAD)" == "$revision" ]] || return 1
    git -C "$source" apply --check "$patch"
    git -C "$source" apply "$patch"
    git -C "$source" add -N src/auth/policy.rs tests/signed_policy.rs
  fi
  [[ "$(git -C "$source" rev-parse HEAD)" == "$revision" ]] || return 1
  # Compare all intended source modifications; an edited or partial cache never builds.
  # Drop optional Git hunk headings, whose truncated words are not source content.
  git -C "$source" diff --binary HEAD | sed -E 's/^(@@ -[0-9,]+ \+[0-9,]+ @@).*$/\1/' | cmp -s "$patch" - || { echo 'Patched source differs from the reviewed input' >&2; return 1; }
  [[ -z "$(git -C "$source" ls-files --others --exclude-standard)" ]] || { echo 'Source cache contains unreviewed files' >&2; return 1; }
}
case "${1:-}" in
  prepare) prepare ;;
  test-domain)
    prepare
    rustc --edition 2024 --test "$source/src/auth/policy.rs" -o "$cache/policy-tests"
    "$cache/policy-tests"
    ;;
  cargo-test|cargo-build)
    operation="$1"
    prepare
    # The caller supplies the canonical machine admission bracket (or hosted CI).
    export CARGO_BUILD_JOBS=2 CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 CARGO_INCREMENTAL=0 CARGO_TERM_COLOR=never
    export CARGO_TARGET_DIR="$cache/target"
    cd "$source"
    if [[ "$operation" == cargo-test ]]; then
      cargo test --locked --lib --test signed_policy
    else
      cargo build --locked --release --bin decay
    fi
    ;;
  *) echo 'Usage: policy.sh prepare|test-domain|cargo-test|cargo-build' >&2; exit 2 ;;
esac
