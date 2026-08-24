#!/usr/bin/env bash
# Fire the round-1 boolean-creep sweep lanes, up to 5 concurrently.
# Any lane names passed as arguments are skipped (e.g. an already-run pilot):
#   ops/run-sweep-round1.sh ontology-mcp
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
skip=" $* "
max_jobs=5

drivers_extra="- In driver packages most boolean clusters mirror wire contracts: record ONE representative D2 entry per driver model file (note the mirrored contract) instead of exhaustively enumerating every mirrored struct, and spend your reading budget on internal service/logic state instead."

lanes=(
  $'tooling-tool\t90\tpackages/tooling/tool/*/src'
  $'foundation-modeling\t90\tpackages/foundation/modeling/*/src'
  $'law-practice\t90\tpackages/law-practice/*/src'
  $'drivers\t90\tpackages/drivers/*/src'
  $'foundation-ui-system\t60\tpackages/foundation/ui-system/*/src'
  $'foundation-cap-prim\t60\tpackages/foundation/capability/*/src packages/foundation/primitive/*/src'
  $'epistemic\t60\tpackages/epistemic/*/src'
  $'shared-documents\t60\tpackages/shared/*/src packages/documents/*/src'
  $'tooling-rest\t60\tpackages/tooling/library/*/src packages/tooling/policy-pack/*/src packages/tooling/test-kit/*/src'
  $'workspace-agents\t60\tpackages/workspace/*/src packages/agents/*/src'
  $'arch-eco-internal\t60\tpackages/architecture-lab/*/src packages/ecosystem/*/src packages/_internal/*/src'
  $'ontology-mcp\t60\tpackages/ontology/*/src apps/practice-kg-mcp/src apps/architecture-lab-proof/src'
  $'apps\t60\tapps/professional-desktop/src apps/oip-web/src'
)

running=0
for spec in "${lanes[@]}"; do
  IFS=$'\t' read -r lane turns areas <<< "$spec"
  case "$skip" in *" $lane "*)
    echo "[sweep:$lane] skipped"
    continue
    ;;
  esac
  extra=""
  [ "$lane" = "drivers" ] && extra="$drivers_extra"
  "$script_dir/run-sweep-lane.sh" "$lane" round1 "$turns" "$areas" "$extra" &
  running=$((running + 1))
  if [ "$running" -ge "$max_jobs" ]; then
    wait -n || true
    running=$((running - 1))
  fi
done
wait
echo "[sweep] round1 driver done"
