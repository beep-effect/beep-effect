#!/usr/bin/env bash
# Package the esbuild output (from bundle:check / build.sh) into the Lambda
# deploy ZIP: .cjs -> .js handler names, normalized timestamps for a
# deterministic archive, then zip. Shared by build.sh (real artifact path)
# and CI's zip:check (temp path), so every stage of artifact assembly is
# exercised by required PR checks.
set -euo pipefail

build_dir="$1"
zip_path="$2"

cp "${build_dir}/index.cjs" "${build_dir}/index.js"
cp "${build_dir}/authorizer.cjs" "${build_dir}/authorizer.js"
cp "${build_dir}/writer.cjs" "${build_dir}/writer.js"
touch -t 198001010000 \
  "${build_dir}/index.js" \
  "${build_dir}/authorizer.js" \
  "${build_dir}/writer.js"

mkdir -p "$(dirname "${zip_path}")"
rm -f "${zip_path}"
(
  cd "${build_dir}"
  zip -q -X "${zip_path}" index.js authorizer.js writer.js
)

zip_size="$(stat --format='%s' "${zip_path}")"
zip_sha256="$(sha256sum "${zip_path}" | cut -d ' ' -f 1)"
[ "${zip_size}" -gt 1000000 ] || { echo "ZIP suspiciously small: ${zip_size} bytes" >&2; exit 1; }
printf 'ZIP path: %s\nZIP size: %s bytes\nZIP sha256: %s\n' \
  "${zip_path}" "${zip_size}" "${zip_sha256}"
