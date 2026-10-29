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
    git -C "$source" add -N src/auth/policy.rs tests/signed_policy.rs tests/dependency_scope.rs
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
  cargo-security)
    prepare
    # The caller supplies machine admission or hosted CI; never mount a home or credential store.
    mkdir -p "$cache/security"
    run="$(mktemp -d "$cache/security/run.XXXXXX")"
    cp "$source/Cargo.lock" "$run/Cargo.lock"
    chmod 0444 "$run/Cargo.lock"
    scan_options=()
    if python3 - "$run/Cargo.lock" <<'PY'
import sys,tomllib
with open(sys.argv[1],'rb') as handle: lock=tomllib.load(handle)
packages=[p for p in lock['package'] if p['name']=='block-buffer']
sys.exit(0 if len(packages)==1 and packages[0]['version']=='0.10.4' and
  packages[0].get('checksum')=='3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71' else 1)
PY
    then
      cp "$root/osv-scanner.toml" "$run/osv-scanner.toml"
      chmod 0444 "$run/osv-scanner.toml"
      scan_options=(--mount "type=bind,src=$run/osv-scanner.toml,dst=/scan/osv-scanner.toml,readonly")
      scan_arguments=(--config=/scan/osv-scanner.toml)
    else
      scan_arguments=()
    fi
    status=0
    docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
      --memory 512m --cpus 1 --pids-limit 128 -e GOMAXPROCS=1 \
      --tmpfs /tmp:rw,noexec,nosuid,size=128m \
      --mount "type=bind,src=$run/Cargo.lock,dst=/scan/Cargo.lock,readonly" \
      "${scan_options[@]}" --entrypoint /root/osv-scanner \
      ghcr.io/google/osv-scanner-action@sha256:d54770fe0b09493894e76a02aaed9f51a0513fa57c5186452a755d257b0068a6 \
      --lockfile=/scan/Cargo.lock --format=json "${scan_arguments[@]}" > "$run/result.json" 2> "$run/scan.log" || status=$?
    printf 'Adapter dependency scan exit=%s; private result: %s\n' "$status" "$run/result.json"
    exit "$status"
    ;;
  cargo-test|cargo-build|cargo-build-musl)
    operation="$1"
    prepare
    # The caller supplies the canonical machine admission bracket (or hosted CI).
    export CARGO_BUILD_JOBS=2 CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 CARGO_INCREMENTAL=0 CARGO_TERM_COLOR=never
    export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$cache/target}"
    cd "$source"
    [[ "$(rustc --version | cut -d ' ' -f 2)" == 1.96.0 ]] || { echo 'This component is pinned to installed Rust1.96.0' >&2; exit 1; }
    if [[ "$operation" == cargo-test ]]; then
      cargo test --locked --lib --bin decay --test signed_policy --test dependency_scope
    elif [[ "$operation" == cargo-build-musl ]]; then
      [[ "$(cargo-zigbuild --version)" == 'cargo-zigbuild 0.20.1' && "$(zig version)" == 0.14.1 ]] || { echo 'Portable build needs cargo-zigbuild0.20.1 and Zig0.14.1' >&2; exit 1; }
      cargo zigbuild --locked --release --bin decay --target x86_64-unknown-linux-musl
    else
      cargo build --locked --release --bin decay
    fi
    ;;
  *) echo 'Usage: policy.sh prepare|test-domain|cargo-test|cargo-security|cargo-build|cargo-build-musl' >&2; exit 2 ;;
esac
