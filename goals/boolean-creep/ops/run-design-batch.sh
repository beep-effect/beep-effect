#!/usr/bin/env bash
# Run one P2 design batch on codex (Sol, --effort medium per campaign decision 4).
# Usage: ops/run-design-batch.sh <batch> "<output-contract>" ["<batch-extra>"]
set -euo pipefail

batch="$1"
output_contract="$2"
batch_extra="${3:-}"

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
packet="$repo_root/goals/boolean-creep"
scratch="${BOOLEAN_CREEP_SCRATCH:-${TMPDIR:-/tmp}/boolean-creep}"
mkdir -p "$scratch/design-transcripts" "$packet/designs"

prompt="$(cat "$packet/ops/prompts/design-batch.md")"
prompt="${prompt//\{\{BATCH\}\}/$batch}"
prompt="${prompt//\{\{OUTPUT_CONTRACT\}\}/$output_contract}"
prompt="${prompt//\{\{BATCH_EXTRA\}\}/$batch_extra}"

transcript="$scratch/design-transcripts/$batch.log"
status=0
codex exec -s workspace-write --cd "$repo_root" -c model_reasoning_effort=medium "$prompt" </dev/null > "$transcript" 2>&1 || status=$?
docs=$(ls "$packet/designs/"*.md 2>/dev/null | wc -l)
echo "[design:$batch] exit=$status designs_on_disk=$docs transcript=$transcript"
exit "$status"
