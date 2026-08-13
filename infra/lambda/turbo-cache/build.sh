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

cp "${build_dir}/index.cjs" "${build_dir}/index.js"
cp "${build_dir}/authorizer.cjs" "${build_dir}/authorizer.js"
cp "${build_dir}/writer.cjs" "${build_dir}/writer.js"
touch -t 198001010000 \
  "${build_dir}/index.js" \
  "${build_dir}/authorizer.js" \
  "${build_dir}/writer.js"

mkdir -p "${artifact_dir}"
rm -f "${zip_path}"
(
  cd "${build_dir}"
  zip -q -X "${zip_path}" index.js authorizer.js writer.js
)

zip_size="$(stat --format='%s' "${zip_path}")"
zip_sha256="$(sha256sum "${zip_path}" | cut -d ' ' -f 1)"
printf 'ZIP path: %s\nZIP size: %s bytes\nZIP sha256: %s\n' \
  "${zip_path}" "${zip_size}" "${zip_sha256}"
