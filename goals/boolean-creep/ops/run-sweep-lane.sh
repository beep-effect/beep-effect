#!/usr/bin/env bash
# Render and run one boolean-creep inventory sweep lane on the headless grok CLI.
#
# Usage:
#   ops/run-sweep-lane.sh <lane> <round> <max-turns> "<areas>" ["<lane-extra>"]
#
# The rendered prompt and the raw streaming-json transcript (the recovery
# layer) land under $BOOLEAN_CREEP_SCRATCH (default: the user cache directory).
# The lane report lands at goals/boolean-creep/data/sweeps/<round>/<lane>.jsonl.
set -euo pipefail

lane="$1"
round="$2"
max_turns="$3"
areas="$4"
lane_extra="${5:-}"

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
packet="$repo_root/goals/boolean-creep"
template="$packet/ops/prompts/sweep-lane-round1.md"
scratch="${BOOLEAN_CREEP_SCRATCH:-${XDG_CACHE_HOME:-$HOME/.cache}/beep/boolean-creep}"
seed_inventory="${BOOLEAN_CREEP_SEED_INVENTORY:-$packet/data/inventory.jsonl}"
model="${BOOLEAN_CREEP_MODEL:-}"
resume_session="${BOOLEAN_CREEP_RESUME_SESSION:-}"

mkdir -p "$scratch/prompts/$round" "$scratch/transcripts/$round" "$packet/data/sweeps/$round"

source_sha="$(git -C "$repo_root" rev-parse HEAD)"
printf '%s\n' "$source_sha" > "$packet/data/sweeps/$round/source-sha.txt"

if [ -s "$seed_inventory" ]; then
  seeds=""
  while IFS=$'\t' read -r seed_file seed_symbol; do
    for area in $areas; do
      if [[ "$seed_file" == $area || "$seed_file" == $area/* ]]; then
        seeds+="- $seed_file :: $seed_symbol"$'\n'
        break
      fi
    done
  done < <(jq -r '[.file, .symbol] | @tsv' "$seed_inventory")
  if [ -z "$seeds" ]; then
    seeds="- none in this lane's corpus"
  fi
else
  seeds="- none; this is an unseeded current-corpus refresh"
fi

prompt="$(cat "$template")"
prompt="${prompt//\{\{LANE\}\}/$lane}"
prompt="${prompt//\{\{ROUND\}\}/$round}"
prompt="${prompt//\{\{SOURCE_SHA\}\}/$source_sha}"
prompt="${prompt//\{\{AREAS\}\}/$areas}"
prompt="${prompt//\{\{SEEDS\}\}/$seeds}"
prompt="${prompt//\{\{LANE_EXTRA\}\}/$lane_extra}"

prompt_file="$scratch/prompts/$round/$lane.md"
transcript="$scratch/transcripts/$round/$lane.ndjson"
printf '%s\n' "$prompt" > "$prompt_file"

cd "$repo_root"
status=0
model_args=()
if [ -n "$model" ]; then
  model_args=(--model "$model")
fi
resume_args=()
if [ -n "$resume_session" ]; then
  resume_args=(--resume "$resume_session")
fi
grok "${model_args[@]}" "${resume_args[@]}" --prompt-file "$prompt_file" \
  --output-format streaming-json \
  --no-auto-update \
  --max-turns "$max_turns" \
  --always-approve \
  --disable-web-search \
  --no-subagents \
  > "$transcript" 2>&1 || status=$?

report="$packet/data/sweeps/$round/$lane.jsonl"
lines=0
[ -f "$report" ] && lines="$(wc -l < "$report")"
echo "[sweep:$lane] exit=$status model=${model:-default} resume=${resume_session:-new} report_lines=$lines transcript=$transcript"
exit "$status"
