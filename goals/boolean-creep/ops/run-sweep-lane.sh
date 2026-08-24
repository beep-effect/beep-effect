#!/usr/bin/env bash
# Render and run one boolean-creep inventory sweep lane on the headless grok CLI.
#
# Usage:
#   ops/run-sweep-lane.sh <lane> <round> <max-turns> "<areas>" ["<lane-extra>"]
#
# The rendered prompt and the raw streaming-json transcript (the recovery
# layer) land under $BOOLEAN_CREEP_SCRATCH (default: ${TMPDIR:-/tmp}/boolean-creep).
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
scratch="${BOOLEAN_CREEP_SCRATCH:-${TMPDIR:-/tmp}/boolean-creep}"

mkdir -p "$scratch/prompts/$round" "$scratch/transcripts/$round" "$packet/data/sweeps/$round"

seeds="$(jq -r '"- " + .file + " :: " + .symbol' "$packet/data/inventory.jsonl")"

prompt="$(cat "$template")"
prompt="${prompt//\{\{LANE\}\}/$lane}"
prompt="${prompt//\{\{ROUND\}\}/$round}"
prompt="${prompt//\{\{AREAS\}\}/$areas}"
prompt="${prompt//\{\{SEEDS\}\}/$seeds}"
prompt="${prompt//\{\{LANE_EXTRA\}\}/$lane_extra}"

prompt_file="$scratch/prompts/$round/$lane.md"
transcript="$scratch/transcripts/$round/$lane.ndjson"
printf '%s\n' "$prompt" > "$prompt_file"

cd "$repo_root"
status=0
grok --prompt-file "$prompt_file" \
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
echo "[sweep:$lane] exit=$status report_lines=$lines transcript=$transcript"
exit "$status"
