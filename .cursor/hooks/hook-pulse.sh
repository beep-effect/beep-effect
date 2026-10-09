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
# SessionStart uses the same payload projection and bounded stamp as tool events.
# Without `timeout` the writer would run uncapped against the 5 s hook budget, so the row is
# skipped instead.
# `BEEP_CURSOR_HOOK_PULSE_WRITER_CAP` overrides the 3 s cap for conformance tests on a loaded
# host; a live hook leaves it unset. Always exits 0.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
shared="${here}/../../.claude/hooks/hook-pulse.sh"
answer_protocol() {
  case "$1" in
    preToolUse|beforeShellExecution|beforeMCPExecution|beforeReadFile|subagentStart) printf '{"permission":"allow"}\n' ;;
    beforeSubmitPrompt) printf '{"continue":true}\n' ;;
    *) printf '{}\n' ;;
  esac
}
# Registered hooks pass the event as command metadata. Disarm can preserve the
# exact protocol response without reading stdin or processing any payload.
registered_event=""
[ "${1:-}" != "--event" ] || registered_event="${2:-}"
evidence_root="${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/beep/agent-evidence}"
sentinel="${BEEP_HOOK_PULSE_DISARM_SENTINEL:-${evidence_root}/hook-pulse.disarmed}"
if [ -e "${sentinel}" ]; then
  answer_protocol "${registered_event}"
  [ ! -x "${shared}" ] || BEEP_HOOK_PULSE_AGENT_KIND=cursor-cli "${shared}" < /dev/null >/dev/null 2>&1
  exit 0
fi
input="$(cat)"
event="$(printf '%s' "${input}" | jq -r '.hook_event_name // empty' 2>/dev/null || true)"
answer_protocol "${registered_event:-${event}}"
if [ -x "${shared}" ] && command -v jq >/dev/null 2>&1 && command -v timeout >/dev/null 2>&1; then
  result=0
  printf '%s' "${input}" | jq -c '
    .hook_event_name as $e
    | .hook_event_name = ({
        "sessionStart": "SessionStart",
        "preToolUse": "PreToolUse",
        "postToolUse": "PostToolUse",
        "postToolUseFailure": "PostToolUseFailure",
        "sessionEnd": "SessionEnd",
        "stop": "Stop",
        "beforeSubmitPrompt": "UserPromptSubmit"
      }[$e] // $e)' 2>/dev/null \
    | BEEP_HOOK_PULSE_AGENT_KIND=cursor-cli timeout --kill-after=1s "${BEEP_CURSOR_HOOK_PULSE_WRITER_CAP:-3s}" "${shared}" --bounded-body >/dev/null 2>&1 || result=$?
  if [ "${result}" -eq 124 ] || [ "${result}" -eq 137 ]; then
    BEEP_HOOK_PULSE_AGENT_KIND=cursor-cli "${shared}" --refuse timeout >/dev/null 2>&1
  elif [ "${result}" -ne 0 ]; then
    BEEP_HOOK_PULSE_AGENT_KIND=cursor-cli "${shared}" --refuse encode-failed >/dev/null 2>&1
  fi
elif [ -x "${shared}" ]; then
  if command -v jq >/dev/null 2>&1; then
    BEEP_HOOK_PULSE_AGENT_KIND=cursor-cli "${shared}" --refuse no-timeout >/dev/null 2>&1
  else
    BEEP_HOOK_PULSE_AGENT_KIND=cursor-cli "${shared}" --refuse no-jq >/dev/null 2>&1
  fi
fi
exit 0
