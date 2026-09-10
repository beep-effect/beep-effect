#!/usr/bin/env bash
set -euo pipefail

lane="$1"
review="$2"
max_turns="$3"
ids="$4"

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
packet="$repo_root/goals/boolean-creep"
template="$packet/ops/prompts/review-lane.md"
scratch="${BOOLEAN_CREEP_SCRATCH:-${XDG_CACHE_HOME:-$HOME/.cache}/beep/boolean-creep}"
model="${BOOLEAN_CREEP_MODEL:-}"
source_sha="$(git -C "$repo_root" rev-parse HEAD)"
report_dir="$packet/data/reviews/$review"
report="$report_dir/$lane.jsonl"

mkdir -p "$scratch/prompts/$review" "$scratch/transcripts/$review" "$report_dir"
printf '%s\n' "$source_sha" > "$report_dir/source-sha.txt"
: > "$report"

id_lines="$(printf '%s\n' $ids | sed 's/^/- /')"
prompt="$(cat "$template")"
prompt="${prompt//\{\{REVIEW\}\}/$review}"
prompt="${prompt//\{\{LANE\}\}/$lane}"
prompt="${prompt//\{\{SOURCE_SHA\}\}/$source_sha}"
prompt="${prompt//\{\{IDS\}\}/$id_lines}"

prompt_file="$scratch/prompts/$review/$lane.md"
transcript="$scratch/transcripts/$review/$lane.ndjson"
printf '%s\n' "$prompt" > "$prompt_file"

cd "$repo_root"
status=0
model_args=()
if [ -n "$model" ]; then
  model_args=(--model "$model")
fi
grok "${model_args[@]}" --prompt-file "$prompt_file" \
  --output-format streaming-json \
  --no-auto-update \
  --max-turns "$max_turns" \
  --always-approve \
  --disable-web-search \
  --no-subagents \
  > "$transcript" 2>&1 || status=$?

lines=0
[ -f "$report" ] && lines="$(wc -l < "$report")"
echo "[review:$lane] exit=$status model=${model:-default} report_lines=$lines transcript=$transcript"
exit "$status"
