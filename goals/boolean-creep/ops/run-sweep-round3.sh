#!/usr/bin/env bash
# Round-2 residue-hunt sweep: bounded lanes, alternative netting patterns.
# The skip-list comes from data/inventory.jsonl, which now carries all
# round-1 records. Runs up to 5 lanes concurrently by default.
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
max_jobs="${BOOLEAN_CREEP_MAX_JOBS:-5}"
round="${BOOLEAN_CREEP_ROUND:-round3}"

residue="ROUND-3 FINAL RESIDUE HUNT: two prior sweeps already triaged the obvious clusters (see ALREADY RECORDED — skip those). Hunt the remaining veins: (a) module-level 'let handled/done/ready = false' latch siblings (mutually exclusive dispatch phases flattened into let-bools); (b) component-local derived booleans projected from one AsyncResult/status literal (const isX = AsyncResult.isFailure(...) siblings — this vein produced 3 finds last round); (c) tuple types of booleans (readonly [a: boolean, b: boolean, ...]); (d) multi-boolean return structs of one function ({ ok, skipped, ... } returns); (e) sibling boolean atoms/useState across one aggregate's files. APPEND your record IMMEDIATELY after deciding each suspect, BEFORE opening the next file — a decision that is not appended is lost. Every suspect you read code for MUST produce exactly one appended record, even when disqualified."

lanes=(
  $'r3-tooling\t60\tpackages/tooling/*/src packages/tooling/tool/*/src'
  $'r3-foundation-capability-primitive\t60\tpackages/foundation/capability/*/src packages/foundation/primitive/*/src'
  $'r3-foundation-modeling\t60\tpackages/foundation/modeling/*/src'
  $'r3-foundation-ui\t60\tpackages/foundation/ui-system/*/src'
  $'r3-domains\t60\tpackages/ontology/*/src packages/epistemic/*/src packages/workspace/*/src packages/agents/*/src packages/shared/*/src packages/documents/*/src packages/law-practice/*/src'
  $'r3-drivers-a-f\t60\tpackages/drivers/[a-f]*/src'
  $'r3-drivers-g-m\t60\tpackages/drivers/[g-m]*/src'
  $'r3-drivers-n-r\t60\tpackages/drivers/[n-r]*/src'
  $'r3-drivers-s-z\t60\tpackages/drivers/[s-z]*/src'
  $'r3-architecture-ecosystem-internal\t60\tpackages/architecture-lab/*/src packages/ecosystem/*/src packages/_internal/*/src'
  $'r3-apps\t60\tapps/professional-desktop/src apps/oip-web/src apps/practice-kg-mcp/src apps/architecture-lab-proof/src'
)

running=0
failed=0
for spec in "${lanes[@]}"; do
  IFS=$'\t' read -r lane turns areas <<< "$spec"
  "$script_dir/run-sweep-lane.sh" "$lane" "$round" "$turns" "$areas" "$residue" &
  running=$((running + 1))
  if [ "$running" -ge "$max_jobs" ]; then
    if ! wait -n; then failed=1; fi
    running=$((running - 1))
  fi
done
while [ "$running" -gt 0 ]; do
  if ! wait -n; then failed=1; fi
  running=$((running - 1))
done
echo "[sweep] round3 driver done"
exit "$failed"
