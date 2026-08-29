#!/usr/bin/env bash
# Round-2 residue-hunt sweep: broader lanes, alternative netting patterns.
# The skip-list comes from data/inventory.jsonl, which now carries all
# round-1 records. Runs up to 5 lanes concurrently.
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
max_jobs=5

residue="ROUND-3 FINAL RESIDUE HUNT: two prior sweeps already triaged the obvious clusters (see ALREADY RECORDED — skip those). Hunt the remaining veins: (a) module-level 'let handled/done/ready = false' latch siblings (mutually exclusive dispatch phases flattened into let-bools); (b) component-local derived booleans projected from one AsyncResult/status literal (const isX = AsyncResult.isFailure(...) siblings — this vein produced 3 finds last round); (c) tuple types of booleans (readonly [a: boolean, b: boolean, ...]); (d) multi-boolean return structs of one function ({ ok, skipped, ... } returns); (e) sibling boolean atoms/useState across one aggregate's files. APPEND your record IMMEDIATELY after deciding each suspect, BEFORE opening the next file — a decision that is not appended is lost. Every suspect you read code for MUST produce exactly one appended record, even when disqualified."

lanes=(
  $'r3-tooling\t60\tpackages/tooling/*/src packages/tooling/tool/*/src'
  $'r3-foundation\t60\tpackages/foundation/*/src packages/foundation/*/*/src'
  $'r3-domains\t60\tpackages/ontology/*/src packages/epistemic/*/src packages/workspace/*/src packages/agents/*/src packages/shared/*/src packages/documents/*/src packages/law-practice/*/src'
  $'r3-drivers-arch\t60\tpackages/drivers/*/src packages/architecture-lab/*/src packages/ecosystem/*/src packages/_internal/*/src'
  $'r3-apps\t60\tapps/professional-desktop/src apps/oip-web/src apps/practice-kg-mcp/src apps/architecture-lab-proof/src'
)

running=0
for spec in "${lanes[@]}"; do
  IFS=$'\t' read -r lane turns areas <<< "$spec"
  "$script_dir/run-sweep-lane.sh" "$lane" round3 "$turns" "$areas" "$residue" &
  running=$((running + 1))
  if [ "$running" -ge "$max_jobs" ]; then
    wait -n || true
    running=$((running - 1))
  fi
done
wait
echo "[sweep] round3 driver done"
