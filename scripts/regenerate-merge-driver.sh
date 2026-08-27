#!/usr/bin/env bash
set -euo pipefail

ancestor_file="${1:?ancestor file required}"
current_file="${2:?current file required}"
other_file="${3:?other file required}"
repo_path="${4:?repository path required}"

# Keep the unused merge stages explicit: this driver never resolves by taking
# either side; it succeeds only after the owning generator recreates the path.
: "$ancestor_file" "$other_file"

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

case "$repo_path" in
  standards/fallow.boundaries.generated.jsonc)
    bun run fallow:boundaries:write >/dev/null
    ;;
  tsconfig.json|tsconfig.packages.json)
    bun run config-sync >/dev/null
    ;;
  apps/professional-desktop/src/runtime/Migrations.gen.ts)
    bun run --cwd apps/professional-desktop codegen >/dev/null
    ;;
  *)
    echo "regenerate merge driver refused non-projection path: $repo_path" >&2
    exit 1
    ;;
esac

if [[ ! -f "$repo_path" ]]; then
  echo "regenerate merge driver did not produce $repo_path" >&2
  exit 1
fi

cp -- "$repo_path" "$current_file"
