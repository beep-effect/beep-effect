# P1 instrument-verification spike — hook firing semantics (2026-08-01)

Phase: P1 sequence-break instrument, **first step** (PLAN.md: verify hook
firing semantics in a scratch clone BEFORE writing any schema).

Question under test (load-bearing risk named in PLAN.md): do Claude Code
hooks on this harness emit a distinguishable, sessionId-bearing event for
each of the three wait classes — permission prompt, plan approval, ≥60s
idle?

**Verdict: yes for all three, but not the way PLAN.md assumed.** The
canonical wait-start marker is `PreToolUse`, not `Notification`; the
`Notification` message text does not carry the tool name and does not
contain the word "permission" for plan approvals. Wait *end* requires
`PostToolUse`, which PLAN.md's four-hook set (Notification /
UserPromptSubmit / Stop / SessionEnd) does not include. The hook set in
PLAN.md must be amended to six events before `HookPulseV1` is authored.

## Setup

- Harness under test: Claude Code 2.1.220, Haiku 4.5 sessions.
- Scratch clone: depth-1 local clone in the session scratchpad (tmpfs).
  Hook wiring confined to the clone's `.claude/settings.json` per the
  packet's rollout sequencing — the real repo settings were untouched.
- Instrument: `.claude/hooks/hook-pulse-spike.sh` (zsh + jq, fail-open,
  always exits 0) appending whitelist-only NDJSON to
  `${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence/hook-events/hook-pulse-spike.ndjson`.
- Four scenarios in tmux-hosted interactive sessions: permission prompt,
  plan approval (rejected), 60s idle, plan approval (approved, to capture
  the closing edge). 43 ledger events across 4 real sessions.
- Model allocation: the Codex driver (gpt-5.6-sol, xhigh) was launched per
  the packet constraint but was blocked by its sandbox from reaching the
  tmux control socket ("Operation not permitted") and correctly stopped
  without running any scenario; Fable then drove the sessions directly.
  **Carry-forward:** codex-driven interactive-TTY automation is not
  available from `codex exec` sandboxes — future harness-driving lanes must
  either run Codex outside the sandbox or keep TTY driving with the
  orchestrator.

## Findings

### 1. The wait classes are distinguishable — via PreToolUse, not message text

| Wait class | Start marker | Corroborating Notification | End marker |
| --- | --- | --- | --- |
| Tool permission | `PreToolUse{tool_name}` | `notification_type: permission_prompt`, message `"Claude needs your permission"` (**no tool name**) | `PostToolUse{same tool}` |
| Plan approval | `PreToolUse{tool_name: "ExitPlanMode"}` | `notification_type: permission_prompt`, message `"Claude Code needs your approval for the plan"` | `PostToolUse{ExitPlanMode}` — **only when approved** |
| Idle (≥60s) | `Notification` `notification_type: idle_prompt`, message `"Claude is waiting for your input"` | — | next `UserPromptSubmit` |

Measured brackets: permission wait `06:38:20 → 06:39:59` = 99s; plan
approval `PreToolUse 06:40:07 → PostToolUse 06:41:29` = 82s, both matching
the held wall-clock exactly.

**`notification_type` does not separate plan approval from tool
permission** — both are `permission_prompt`. Only the message string
differs, and message strings are harness-authored English that can change
between releases. `HookPulseV1` must derive `waitReason` from
`PreToolUse.tool_name` (`ExitPlanMode` ⇒ plan approval) with the message
string as corroboration only, and must fall back to `unknown` rather than
guess (evidence-integrity law 1).

### 2. Idle notification: exactly 60s after Stop, fires once, and is Stop-gated

Two independent measurements: Stop 06:27:21 → idle Notification 06:28:21;
Stop 06:32:43 → idle Notification 06:33:43. Exactly 60s both times, and
**only one** notification across a 150s hold (no repeat) — the notifier
itself does not storm, so P1's per-session storm damping is needed for the
*escalation ladder*, not for raw idle events.

Critically, the idle timer is gated on `Stop`: the plan-rejected session
sat at its prompt for 3m46s and emitted **nothing**, because plan-mode
turns produce no `Stop` (see below). A session parked after a rejected
plan is invisible to an idle-based instrument.

### 3. Stop does not fire for plan-mode turns

The rejected-plan session's complete event history was `UserPromptSubmit`
→ `Notification` → `SessionEnd`: no `Stop` at all, despite a completed
assistant turn. Lease renewal (P2) must therefore renew on **any** hook
event — as PLAN.md already specifies — and must not treat `Stop` as the
turn-boundary signal, since plan-mode turns have none.

### 4. Rejected plans leave an unterminated bracket

`PreToolUse{ExitPlanMode}` fired at 06:43:08; Escape-rejection produced no
`PostToolUse` and no other event. Two of the three observed
`PreToolUse{ExitPlanMode}` events in the final ledger have no closing
`PostToolUse`. The wait-span model must represent open brackets as a
first-class state (closed by the next event of any kind, else tombstoned)
rather than assuming every wait has a matching end.

Related: the plan Notification arrives ~6s after `PreToolUse`, so waits
resolved faster than that produce **no Notification at all** — a further
reason `PreToolUse` is the correct start marker.

### 5. SIGKILL produces no SessionEnd — P2's assumption confirmed

`kill -9` on a live session produced zero subsequent ledger events. Clean
`/exit` produces `SessionEnd` with `reason: "prompt_input_exit"`. This
directly confirms the P2 load-bearing risk: channel dropout is real, and
lease-driven tombstone reconciliation is mandatory rather than defensive.

### 6. Hook payloads are content-bearing — privacy law 3 is load-bearing at the source

Observed raw payload fields include `prompt` (UserPromptSubmit),
`last_assistant_message` (Stop), `tool_input` / `tool_response`
(Pre/PostToolUse), and `message` (Notification). The hook input stream
carries exactly the content the packet forbids in telemetry, so
privacy-by-unrepresentability cannot be a downstream filter — the
whitelist projection must happen in the hook writer itself. The spike
ledger's final privacy sweep found zero occurrences of any prompt, command,
or assistant-message content across 43 events. The spike's raw-payload
debug capture (tmpfs, synthetic sessions only) was deleted after shape
extraction.

Useful non-content fields available for `HookPulseV1`: `session_id`,
`transcript_path`, `prompt_id`, `cwd`, `permission_mode`, `tool_name`,
`tool_use_id`, `duration_ms` (PostToolUse), `notification_type`, `reason`
(SessionEnd), `stop_hook_active`.

### 7. Instrument defect found before it could corrupt data

jq's `capture()` yields an **empty stream** (not `null`, not an error) on
no-match, and an empty stream inside jq object construction annihilates the
whole object. The first script draft silently dropped every idle-wait
ledger line while exiting 0 — a fail-open instrument losing data with no
error signal. Fix: `[... | capture(...).t][0]` → `null`. `try/catch` does
**not** help; there is no error to catch. The production writer needs a
no-match regression fixture, and this is concrete support for PLAN.md's
decision to define `HookPulseV1` in effect/Schema with round-trip fixtures
even though the writer stays zsh+jq.

### 8. A measurement error I made, recorded as method evidence

My first live reading concluded "zero hook events during a 120s pending
plan approval" — a false negative. The plan Notification had fired 6s
*before* I snapshotted the line-count baseline, so my delta poll could not
see it. The correct result (Notification does fire) was only recovered by
reading the full ledger instead of the delta. Two lessons for P4 trust
gates: derived deltas must be reconciled against absolute ledger state, and
"no event observed" is only evidence of absence when the observation window
provably precedes the wait.

## Verdicts

- **Tool-permission wait** — distinguishable, sessionId-bearing, both edges
  measurable: **YES**.
- **Plan-approval wait** (the headline p95 105-min class) — distinguishable
  and sessionId-bearing via `PreToolUse{ExitPlanMode}`: **YES**; end edge
  present only on approval, open bracket on rejection.
- **Idle wait** — distinguishable, sessionId-bearing, 60s threshold
  measured twice: **YES**, with the caveat that it is Stop-gated and
  therefore blind to plan-mode sessions.

## Required amendments to PLAN.md P1 before schema authoring

1. Hook set becomes six events: add `PreToolUse` and `PostToolUse` to
   Notification / UserPromptSubmit / Stop / SessionEnd. Without them the
   headline wait has neither a reliable start nor any end.
2. `waitReason` derives from `PreToolUse.tool_name`, not Notification
   message text; unmatched shapes yield `unknown`.
3. Wait spans model open brackets explicitly (rejection, crash).
4. Lease renewal must not assume `Stop` marks turn boundaries.
5. The notifier's escalation ladder cannot rely on idle notifications for
   plan-parked sessions (no `Stop` ⇒ no idle event).

## Evidence

- Archived ledger (43 events, 4 sessions, whitelist-only):
  session scratchpad `hook-spike/ledger-final.ndjson`; live ledger at
  `${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence/hook-events/hook-pulse-spike.ndjson`
  (spike events carry `instrumentClass: "spike"`, `notifierRev: "spike-0"`).
- Pane snapshots: `hook-spike/panes/` (permission dialog, pending plan
  approval, post-rejection state).
- Spike instrument: `hook-spike/clone/.claude/hooks/hook-pulse-spike.sh`.

Scratchpad evidence is tmpfs and non-durable; the findings above are the
durable record.
