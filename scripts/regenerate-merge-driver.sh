#!/usr/bin/env bash
set -euo pipefail

ancestor_file="${1:?ancestor file required}"
current_file="${2:?current file required}"
other_file="${3:?other file required}"
repo_path="${4:?repository path required}"

# A low-level merge driver runs before Git has installed the complete incoming
# tree. Repository generators therefore cannot safely resolve a projection at
# this boundary: they could read stale manifests and certify stale output.
: "$ancestor_file" "$current_file" "$other_file"

case "$repo_path" in
  standards/fallow.boundaries.generated.jsonc)
    ;;
  tsconfig.json|tsconfig.packages.json)
    ;;
  apps/professional-desktop/src/runtime/Migrations.gen.ts)
    ;;
  *)
    echo "regenerate merge driver refused non-projection path: $repo_path" >&2
    exit 1
    ;;
esac

echo "regenerate merge driver left $repo_path conflicted; regenerate it after Git installs the merged tree" >&2
exit 1
