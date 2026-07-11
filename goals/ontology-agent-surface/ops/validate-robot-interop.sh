#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

if ! command -v robot >/dev/null 2>&1; then
  echo "ROBOT is required but was not found on PATH." >&2
  exit 127
fi

fixtures=(
  "packages/ontology/server/test/fixtures/base-prefix/round-trip.ttl"
  "packages/ontology/server/test/fixtures/foaf-social-network/graph.ttl"
  "packages/ontology/server/test/fixtures/real-world/prov-o-starting-point.ttl"
)

while IFS= read -r -d '' fixture; do
  fixtures+=("$fixture")
done < <(find packages/ontology/server/test/fixtures/ontoauthor-mat -name '*.ttl' -print0 | sort -z)

for fixture in "${fixtures[@]}"; do
  echo "ROBOT validate: $fixture"
  robot validate --input "$fixture"
done

echo "ROBOT validated ${#fixtures[@]} Turtle fixtures."
