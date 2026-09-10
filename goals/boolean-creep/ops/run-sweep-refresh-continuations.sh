#!/usr/bin/env bash
# Resume the dense first-refresh lanes from their schema-valid partial reports.
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
packet="$(cd "$script_dir/.." && pwd)"
round="${BOOLEAN_CREEP_ROUND:-refresh-2026-09-03-r1}"
base="$packet/data/sweeps/$round"
scratch="${BOOLEAN_CREEP_SCRATCH:-${TMPDIR:-/tmp}/boolean-creep}"
extra="CONTINUATION: the first lane hit its turn ceiling. Its partial report is the seed list. Rescan the complete area, skip those pairs, and finish only after covering the remaining corpus."

specs=(
  $'foundation-cap-prim-cont1\t120\tfoundation-cap-prim.jsonl\tpackages/foundation/capability/*/src packages/foundation/primitive/*/src'
  $'epistemic-cont1\t120\tepistemic.jsonl\tpackages/epistemic/*/src'
  $'tooling-tool-cont1\t180\ttooling-tool.jsonl\tpackages/tooling/tool/*/src'
  $'shared-documents-cont1\t120\tshared-documents.jsonl\tpackages/shared/*/src packages/documents/*/src'
  $'tooling-rest-cont1\t120\ttooling-rest.jsonl\tpackages/tooling/library/*/src packages/tooling/policy-pack/*/src packages/tooling/test-kit/*/src'
)

pids=()
for spec in "${specs[@]}"; do
  IFS=$'\t' read -r lane turns seed areas <<< "$spec"
  BOOLEAN_CREEP_SCRATCH="$scratch" \
    BOOLEAN_CREEP_SEED_INVENTORY="$base/$seed" \
    "$script_dir/run-sweep-lane.sh" "$lane" "$round" "$turns" "$areas" "$extra" &
  pids+=("$!")
done

failed=0
for pid in "${pids[@]}"; do
  if ! wait "$pid"; then failed=1; fi
done
exit "$failed"
