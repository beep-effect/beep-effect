#!/usr/bin/env bash
# Render and run one boolean-creep inventory sweep lane on the headless grok CLI.
#
# Usage:
#   ops/run-sweep-lane.sh <lane> <round> <max-turns> "<areas>" ["<lane-extra>"]
#
# The rendered prompt and the raw streaming-json transcript (the recovery
# layer) land in a private, unique run below $BOOLEAN_CREEP_SCRATCH
# (default: the user cache directory). Existing roots must be owned by this
# user with mode 0700; the final status line gives the transcript's path.
# The lane report lands at goals/boolean-creep/data/sweeps/<round>/<lane>.jsonl.
set -euo pipefail
umask 077

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

[[ "$lane" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ && "$round" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || {
  echo "Invalid lane or round name" >&2
  exit 1
}

# Validate every ancestor without following links, then reserve a private run.
# Existing shared roots are refused rather than chmodded into apparent safety.
scratch="$(python3 - "$scratch" <<'PY'
import os
import stat
import sys
import tempfile
from pathlib import Path

root = Path(os.path.abspath(sys.argv[1]))
current = Path(root.anchor)
for part in root.parts[1:]:
    current /= part
    try:
        current.mkdir(mode=0o700)
    except FileExistsError:
        pass
    info = current.lstat()
    if not stat.S_ISDIR(info.st_mode):
        sys.exit("Scratch path contains a symlink or non-directory")
    shared = info.st_mode & 0o022
    trusted_sticky = info.st_uid == 0 and info.st_mode & stat.S_ISVTX
    if info.st_uid not in (0, os.getuid()) or (shared and not trusted_sticky):
        sys.exit("Scratch path has an untrusted ancestor")
info = root.lstat()
if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
    sys.exit("Scratch root must be owned by the current user with mode 0700")
print(tempfile.mkdtemp(prefix="lane-", dir=root))
PY
)"

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
(set -o noclobber; printf '%s\n' "$prompt" > "$prompt_file")

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
(set -o noclobber; grok "${model_args[@]}" "${resume_args[@]}" --prompt-file "$prompt_file" \
  --output-format streaming-json \
  --no-auto-update \
  --max-turns "$max_turns" \
  --always-approve \
  --disable-web-search \
  --no-subagents \
  > "$transcript" 2>&1) || status=$?

report="$packet/data/sweeps/$round/$lane.jsonl"
lines=0
[ -f "$report" ] && lines="$(wc -l < "$report")"
echo "[sweep:$lane] exit=$status model=${model:-default} resume=${resume_session:-new} report_lines=$lines transcript=$transcript"
exit "$status"
