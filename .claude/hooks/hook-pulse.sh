#!/usr/bin/env bash
# hook-pulse: appends exactly one privacy-safe `HookPulseV1` NDJSON row per
# Claude Code hook event to the clone-independent XDG evidence store
# (goals/coding-agent-effectiveness-evidence-loop, P1 sequence-break
# instrument). The binding contract is
# `packages/tooling/library/ai-metrics/src/hook-pulse.ts`; the conformance test
# `packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts` decodes
# this script's output with `HookPulseV1`, whose `HookPulseWaitReasonInvariant`
# filter fails the decode if the jq derivation below ever disagrees with the
# TypeScript `deriveWaitReason`. The schema, not this comment, is the oracle.
#
# Load-bearing decisions:
# - Kill switch first. The sentinel test runs before jq, before reading stdin,
#   and before any parsing, so a disarm takes effect within one syscall. The
#   hook fires on every tool call in every clone; a week-long always-on
#   instrument with no sub-second disarm is not acceptable.
# - Whitelist projection happens HERE (spike amendment 6). Raw payloads carry
#   `prompt`, `message`, `tool_input`, `tool_response`, `last_assistant_message`,
#   `background_tasks`, `session_crons`, `permission_suggestions`, and `error`
#   (PostToolUseFailure). The output object is built key-by-key from an explicit
#   whitelist and never by deleting keys from the input, so an unforeseen future
#   content-bearing key cannot leak.
# - `evidenceTier` is `derived`, never `observed`. `waitReason` is derived, so
#   under evidence-law 2 (weakest link) the row cannot outrank its weakest input;
#   the codec's `clampDerivedEvidenceTier` maps `observed` to `derived`, so
#   stamping `observed` here would make P4's replay-twice-diff determinism gate
#   fail on every row.
# - No `capture()`. jq's `capture()` returns an EMPTY STREAM on no-match, and an
#   empty stream inside object construction annihilates the whole object while
#   this fail-open script still exits 0 — the spike defect that silently dropped
#   every idle-wait row. `try`/`catch` does not help; there is no error to catch.
#   Every expression feeding the object construction is an if/else or `index(...)`
#   (which yields `null`, not empty), so none of them can be empty. The one
#   literal `empty` below is the top-level refusal path — it annihilates the row
#   on purpose, and the shell guards on an empty `$output`. `put` additionally
#   forces its value through `[v][0]`, so even a future empty-capable expression
#   degrades to `null` instead of silently deleting the whole row.
# - One row per file shard `hook-pulse-<UTC day>-<sessionId>.ndjson`, appended as
#   a single `printf` under PIPE_BUF. Sharding per session makes interleaving
#   between concurrent sessions in sibling worktrees structurally impossible
#   rather than merely improbable; the single-write append is the second guard
#   for same-session concurrency (parallel subagent tool calls).
# Always exits 0 — the instrument must never block the agent.

# Precedence mirrors the P0 store rule (`--data-root` -> env -> XDG default) and
# must stay in lockstep with `agentEvidenceRoot` / `hookPulseLedgerDir` exported
# from `@beep/repo-ai-metrics`; the conformance test derives its expected
# location from those exports so the two halves cannot drift apart.
BEEP_AGENT_EVIDENCE_ROOT="${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/beep/agent-evidence}"
BEEP_HOOK_PULSE_DISARM_SENTINEL="${BEEP_HOOK_PULSE_DISARM_SENTINEL:-${BEEP_AGENT_EVIDENCE_ROOT}/hook-pulse.disarmed}"
if [ -e "${BEEP_HOOK_PULSE_DISARM_SENTINEL}" ]; then
  exit 0
fi

# HARD REQUIREMENT: this script must never write to stdout. `PermissionRequest`
# is a *decision* hook — the harness feeds hook stdout into the permission
# outcome, and a hook returning
# `{hookSpecificOutput: {hookEventName: "PermissionRequest", decision: {behavior: "allow"}}}`
# auto-approves the tool call. Only that exact JSON shape decides, so stray text
# cannot flip a permission today, but the failure mode is catastrophic in both
# directions: it would bypass permission gating AND destroy the experiment, since
# an auto-approved call produces no human wait and the instrument would record
# zeros. Closing fd 1 here makes the guarantee structural rather than a promise
# about every future edit. (`$(...)` below still captures jq's output correctly —
# command substitution installs its own pipe on fd 1.) This is deliberately
# unlike `law-pulse.sh`, which writes to stdout on purpose to inject context.
exec 1>/dev/null

set -euo pipefail

# Without jq the instrument degrades to silence rather than to noise or a block.
command -v jq >/dev/null 2>&1 || exit 0

# Millisecond precision is load-bearing: the spike measured `PreToolUse` and its
# `PermissionRequest` in the same second, and P4's two-hop join pairs each
# `PermissionRequest` with the nearest preceding unpaired `PreToolUse`. Fall back
# to second precision only where `%3N` is unsupported.
ts="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
case "${ts}" in
  *N*) ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)" ;;
esac

notifier_rev="${BEEP_HOOK_PULSE_NOTIFIER_REV:-log-only-0}"
instrument_class="${BEEP_HOOK_PULSE_INSTRUMENT_CLASS:-production}"
# A misconfigured class would make every row undecodable, so fail back to the
# default rather than poisoning the ledger.
case "${instrument_class}" in
  production | spike | meta) ;;
  *) instrument_class="production" ;;
esac

payload="$(cat)"

jq_program='
def as_string: if type == "string" then . else null end;
def as_present: as_string | if . == "" then null else . end;
# Must be no weaker than the schema side: `NonNegNum` is `S.Finite` plus a
# non-negative check, and jq happily carries `1e400` through as `1E+400`, which
# parses back to `Infinity` and fails `S.Finite`. Writing that row would put an
# *undecodable* line in the ledger, which is worse than dropping the field —
# a poisoned shard breaks replay for every row it contains, not just this one.
def as_non_negative: if type == "number" and . >= 0 and . < infinite then . else null end;
def as_boolean: if type == "boolean" then . else null end;
# `v` is deliberately NOT a `$`-parameter. jq desugars `def f($a)` to
# `a as $a | body`, and that binding ITERATES its argument stream: an
# empty-capable argument makes the whole row vanish (jq still exits 0, the shell
# writes nothing), and a two-valued one emits two rows. `[v][0]` collapses the
# stream first — `[empty][0]` is `null`, `[a,b][0]` is `a`. This is the exact
# re-entry point of the spike defect the `capture()` note above describes.
# DO NOT "simplify" the null guard to `v // null` or `$value // ...`. The jq
# alternative operator treats `false` as absent, so `isInterrupt: false` would be
# silently erased and with it the "human hit escape" vs "tool errored"
# distinction the field exists to carry.
def put($key; v): ([v][0]) as $value | if $value == null then . else . + { ($key): $value } end;

# Hand-duplicating these lists against `HookPulseEvent` / `HookPulseNotificationType`
# is the one drift this script cannot detect on its own: a typo silently drops
# 100% of one event and every row it would have produced, while every example
# fixture for the other events stays green. `hook-pulse-writer.test.ts`
# reads both definitions back out of this file and asserts set equality with the
# schema `Options`, so the duplication is checked rather than merely intended.
def hook_events: [ "PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure",
                   "Notification", "UserPromptSubmit", "Stop", "SessionEnd",
                   "PermissionDenied" ];
def notification_types: [ "permission_prompt", "idle_prompt" ];

(.session_id | as_present) as $sessionId
| (.hook_event_name | as_present) as $hookEventName
| (if $hookEventName != null and (hook_events | index($hookEventName)) != null
   then $hookEventName
   else null
   end) as $hookEvent
| (.cwd | as_string) as $cwd
| (.tool_name | as_present) as $toolName
| (.tool_use_id | as_present) as $toolUseId
| (.prompt_id | as_present) as $promptId
| (.transcript_path | as_present) as $transcriptPath
| (.permission_mode | as_present) as $permissionMode
| (.notification_type | as_present) as $notificationTypeRaw
| (.duration_ms | as_non_negative) as $durationMs
| (.reason | as_present) as $reason
| (.is_interrupt | as_boolean) as $isInterrupt
| (if $notificationTypeRaw != null
     and (notification_types | index($notificationTypeRaw)) != null
   then $notificationTypeRaw
   else null
   end) as $notificationType
| (if $hookEvent == "PermissionRequest" then
     (if $toolName == null then "unknown"
      elif $toolName == "ExitPlanMode" then "plan-approval"
      else "tool-permission"
      end)
   elif $hookEvent == "Notification" then
     (if $notificationTypeRaw == "idle_prompt" then "idle-input" else "unknown" end)
   else "none"
   end) as $waitReason
| if $sessionId == null or $hookEvent == null then
    empty
  else
    ({
       schemaVersion: "hook-pulse/v1",
       ts: $ts,
       sessionId: $sessionId,
       agentKind: $agentKind,
       hookEvent: $hookEvent,
       cwd: (if $cwd == null then $fallbackCwd else $cwd end),
       notifierRev: $notifierRev,
       instrumentClass: $instrumentClass,
       evidenceTier: "derived",
       waitReason: $waitReason
     }
     | put("toolName"; $toolName)
     | put("toolUseId"; $toolUseId)
     | put("promptId"; $promptId)
     | put("transcriptPath"; $transcriptPath)
     | put("permissionMode"; $permissionMode)
     | put("notificationType"; (if $hookEvent == "Notification" then $notificationType else null end))
     | put("durationMs"; $durationMs)
     | put("sessionEndReason"; (if $hookEvent == "SessionEnd" then $reason else null end))
     | put("isInterrupt"; (if $hookEvent == "PostToolUseFailure" then $isInterrupt else null end))
    ) as $row
    | (($ts[0:10]) + "-" + ($sessionId | gsub("[^A-Za-z0-9._-]"; "_"))), $row
  end
'

# Two raw lines: the file shard key, then the canonical row.
output="$(
  jq -c -r \
    --arg ts "${ts}" \
    --arg agentKind "claude-code" \
    --arg notifierRev "${notifier_rev}" \
    --arg instrumentClass "${instrument_class}" \
    --arg fallbackCwd "${PWD}" \
    "${jq_program}" <<<"${payload}" 2>/dev/null
)" || exit 0

if [ -z "${output}" ]; then
  exit 0
fi

shard="${output%%$'\n'*}"
row="${output#*$'\n'}"
# A single-line or multi-document result means the projection did not produce
# exactly one row; write nothing rather than a partial or interleaved line.
if [ -z "${shard}" ] || [ -z "${row}" ] || [ "${shard}" = "${row}" ]; then
  exit 0
fi
case "${row}" in
  *$'\n'*) exit 0 ;;
esac

store="${BEEP_AGENT_EVIDENCE_ROOT}/hook-events"
if [ ! -d "${store}" ]; then
  mkdir -p "${store}" 2>/dev/null || exit 0
fi
printf '%s\n' "${row}" >>"${store}/hook-pulse-${shard}.ndjson" 2>/dev/null || exit 0

exit 0
