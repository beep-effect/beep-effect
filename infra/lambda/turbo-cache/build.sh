#!/usr/bin/env bash
set -euo pipefail

export BUN_INSTALL="/tmp/turbo-cache-bun-home"
export BUN_TMPDIR="/tmp"
export TMPDIR="/tmp"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
build_dir="${script_dir}/build"
cd "${script_dir}"

shim_version="$(bun -e 'console.log((await Bun.file("package.json").json()).dependencies["turborepo-remote-cache"])')"
artifact_dir="/home/elpresidank/beep-infra-artifacts/turbo-cache/${shim_version}"
zip_path="${artifact_dir}/turbo-cache.zip"

bun install --frozen-lockfile
bun run typecheck
bun test

# Shared with CI: infra's test:lambda chain runs the same bundle + smoke via
# this script, so an esbuild resolution or handler-export break fails PRs.
bun run bundle:check

./package-zip.sh "${build_dir}" "${zip_path}"
