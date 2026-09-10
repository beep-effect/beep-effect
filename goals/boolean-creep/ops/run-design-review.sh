#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
packet="$(cd "$script_dir/.." && pwd)"
review="${BOOLEAN_CREEP_REVIEW:-refresh-2026-09-03}"
lane_count="${BOOLEAN_CREEP_REVIEW_LANES:-8}"
max_turns="${BOOLEAN_CREEP_REVIEW_MAX_TURNS:-180}"
max_jobs="${BOOLEAN_CREEP_REVIEW_MAX_JOBS:-4}"

mapfile -t ids < <(jq -r 'select(.status != "disqualified") | .id' "$packet/data/inventory.jsonl" | sort)
declare -a batches
for ((index = 0; index < lane_count; index += 1)); do batches[index]=""; done
for index in "${!ids[@]}"; do
  lane_index=$((index % lane_count))
  batches[lane_index]="${batches[lane_index]} ${ids[index]}"
done

running=0
failed=0
for ((index = 0; index < lane_count; index += 1)); do
  [ -n "${batches[index]// /}" ] || continue
  lane="review-$((index + 1))"
  "$script_dir/run-review-lane.sh" "$lane" "$review" "$max_turns" "${batches[index]}" &
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
echo "[review] driver done"
exit "$failed"
