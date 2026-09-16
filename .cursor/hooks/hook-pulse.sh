#!/usr/bin/env bash
# Cursor -> hook-pulse adapter (goals/agent-pool-doctrine, D14/D19). Cursor delivers the
# same snake_case stdin keys the shared writer reads (`hook_event_name`, `session_id`,
# `cwd`, `transcript_path`, `tool_name`, ...) but camelCase event names. This script answers
# Cursor's hook protocol FIRST, then renames the event into the ledger's `HookPulseEvent`
# vocabulary, tags the row `cursor-cli`, and delegates to the shared writer body under a
# 3 s cap so metrics never sit on the critical path of an allow/continue decision: on a
# permission event an EMPTY stdout is treated as malformed JSON and BLOCKS the tool, and the
# hook has a 5 s budget in `.cursor/hooks.json`. `allow` is the lowest priority, so a deny
# from another hook (deny-shell.sh, yeet-inbox P0) still wins.
# Only events with a `HookPulseEvent` literal are registered for this adapter;
# `sessionStart` has none and must not be wired here. Always exits 0.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
shared="${here}/../../.claude/hooks/hook-pulse.sh"
input="$(cat)"
event="$(printf '%s' "${input}" | jq -r '.hook_event_name // empty' 2>/dev/null || true)"
case "${event}" in
  preToolUse|beforeShellExecution|beforeMCPExecution|beforeReadFile|subagentStart)
    printf '{"permission":"allow"}\n' ;;
  beforeSubmitPrompt)
    printf '{"continue":true}\n' ;;
  *)
    printf '{}\n' ;;
esac
if [ -x "${shared}" ] && command -v jq >/dev/null 2>&1; then
  bound=(); command -v timeout >/dev/null 2>&1 && bound=(timeout 3s)
  printf '%s' "${input}" | jq -c '
    .hook_event_name as $e
    | .hook_event_name = ({
        "preToolUse": "PreToolUse",
        "postToolUse": "PostToolUse",
        "postToolUseFailure": "PostToolUseFailure",
        "sessionEnd": "SessionEnd",
        "stop": "Stop",
        "beforeSubmitPrompt": "UserPromptSubmit"
      }[$e] // $e)' 2>/dev/null \
    | BEEP_HOOK_PULSE_AGENT_KIND=cursor-cli "${bound[@]}" "${shared}" >/dev/null 2>&1 || true
fi
exit 0
