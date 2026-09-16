#!/usr/bin/env bash
# Smoke probe: record every hook event Cursor delivers, then allow.
input=$(cat)
printf '%s\n' "$input" | jq -c --arg ev "${1:-?}" '{probe_event:$ev, hook_event_name, conversation_id, generation_id, tool_name, command: (.command // null), keys: keys}' >> "/home/elpresidank/.cache/claude-tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect/225ff6cd-a87e-4975-961c-3303e5db8b35/scratchpad/cursor-hooks-smoke/events.ndjson" 2>>"/home/elpresidank/.cache/claude-tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect/225ff6cd-a87e-4975-961c-3303e5db8b35/scratchpad/cursor-hooks-smoke/events.ndjson.err" || printf '{"probe_event":"%s","raw":%s}\n' "${1:-?}" "$(printf '%s' "$input" | jq -Rs .)" >> "/home/elpresidank/.cache/claude-tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect/225ff6cd-a87e-4975-961c-3303e5db8b35/scratchpad/cursor-hooks-smoke/events.ndjson"
echo '{"permission":"allow"}'
