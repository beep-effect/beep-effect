#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-$(git rev-parse --show-toplevel)}"
driver="$repo_root/scripts/regenerate-merge-driver.sh"

git -C "$repo_root" config --local merge.regenerate.name "Regenerate pure repository projections"
git -C "$repo_root" config --local merge.regenerate.driver "bash '$driver' %O %A %B %P"
git -C "$repo_root" config --local merge.regenerate.recursive binary

echo "installed merge.regenerate for $repo_root"
