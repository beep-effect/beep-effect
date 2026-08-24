#!/usr/bin/env bash
# Round-2 residue-hunt sweep: broader lanes, alternative netting patterns.
# The skip-list comes from data/inventory.jsonl, which now carries all
# round-1 records. Runs up to 5 lanes concurrently.
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
max_jobs=5

residue="ROUND-2 RESIDUE HUNT: a first sweep already triaged the obvious S.Boolean / ': boolean' clusters (see ALREADY RECORDED — skip those). Hunt what it under-covered: (a) sibling useState(false)/useState<boolean> calls and sibling boolean atoms in one module; (b) class fields (private/# flags initialized to false); (c) boolean struct fields wrapped in pipes/defaults (S.Boolean.pipe(...), optionalKey(S.Boolean)); (d) props destructured with boolean defaults; (e) parallel booleans split across sibling files of one aggregate. APPEND your record IMMEDIATELY after deciding each suspect, BEFORE opening the next file — a decision that is not appended is lost. Every suspect you read code for MUST produce exactly one appended record, even when disqualified."

lanes=(
  $'r2-tooling\t60\tpackages/tooling/*/src packages/tooling/tool/*/src'
  $'r2-foundation\t60\tpackages/foundation/*/src packages/foundation/*/*/src'
  $'r2-domains\t60\tpackages/ontology/*/src packages/epistemic/*/src packages/workspace/*/src packages/agents/*/src packages/shared/*/src packages/documents/*/src packages/law-practice/*/src'
  $'r2-drivers-arch\t60\tpackages/drivers/*/src packages/architecture-lab/*/src packages/ecosystem/*/src packages/_internal/*/src'
  $'r2-apps\t60\tapps/professional-desktop/src apps/oip-web/src apps/practice-kg-mcp/src apps/architecture-lab-proof/src'
)

running=0
for spec in "${lanes[@]}"; do
  IFS=$'\t' read -r lane turns areas <<< "$spec"
  "$script_dir/run-sweep-lane.sh" "$lane" round2 "$turns" "$areas" "$residue" &
  running=$((running + 1))
  if [ "$running" -ge "$max_jobs" ]; then
    wait -n || true
    running=$((running - 1))
  fi
done
wait
echo "[sweep] round2 driver done"
