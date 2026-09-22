#!/usr/bin/env bash
# Smoke probe: record every hook event Cursor delivers, then allow.
# Sink: $BEEP_HOOKS_SMOKE_LOG, else $TMPDIR/beep-cursor-hooks-smoke/events.ndjson.
LOG="${BEEP_HOOKS_SMOKE_LOG:-${TMPDIR:-/tmp}/beep-cursor-hooks-smoke/events.ndjson}"
mkdir -p "$(dirname "${LOG}")"
input=$(cat)
printf '%s\n' "$input" | jq -c --arg ev "${1:-?}" '{probe_event:$ev, hook_event_name, conversation_id, generation_id, tool_name, command: (.command // null), keys: keys}' >> "${LOG}" 2>>"${LOG}.err" || printf '{"probe_event":"%s","raw":%s}\n' "${1:-?}" "$(printf '%s' "$input" | jq -Rs .)" >> "${LOG}"
echo '{"permission":"allow"}'
