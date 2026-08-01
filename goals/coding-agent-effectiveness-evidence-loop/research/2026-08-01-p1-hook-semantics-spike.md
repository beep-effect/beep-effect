# P1 instrument-verification spike — hook firing semantics (2026-08-01)

Phase: P1 sequence-break instrument, **first step** (PLAN.md: verify hook
firing semantics in a scratch clone BEFORE writing any schema).

Question under test (load-bearing risk named in PLAN.md): do Claude Code
hooks on this harness emit a distinguishable, sessionId-bearing event for
each of the three wait classes — permission prompt, plan approval, ≥60s
idle?

**Verdict: yes for all three.** The wait-start marker is `PermissionRequest`
(round 2), not `Notification` (assumed by the original plan) and not
`PreToolUse` (this report's own round-1 error, corrected below). Wait end
requires `PostToolUse` minus its `duration_ms`. The plan's four-hook set
(Notification / UserPromptSubmit / Stop / SessionEnd) must become the
seven-event set named in PLAN.md P1 before `HookPulseV1` is authored.

Ledger evidence for both rounds is committed at
`history/evidence/2026-08-01-hook-pulse-spike.ndjson`: 65 rows,
whitelist-only. The denominator, stated precisely because this packet's
thesis is trustworthy evidence — 64 rows from **six real sessions**, plus one
synthetic smoke-test row (`sessionId: "s"`) written while validating the
writer. The smoke row is retained rather than deleted: the ledger is
append-only, so labelling a row is honest where removing it is not.

## Setup

- Harness under test: Claude Code 2.1.220, Haiku 4.5 sessions.
- Scratch clone: depth-1 local clone in the session scratchpad (tmpfs). Hook
  wiring confined to the clone's `.claude/settings.json` per the packet's
  rollout sequencing — the real repo settings were untouched.
- Instrument: `.claude/hooks/hook-pulse-spike.sh` (zsh + jq, fail-open, always
  exits 0) appending whitelist-only NDJSON. Ledger fields are an explicit
  whitelist: no field can hold prompt, command, tool-argument, or tool-result
  content (privacy by unrepresentability, spike-grade). `payloadKeys` records
  observed key *names* only, never values.
- Round 1 wired six events (Notification, UserPromptSubmit, Stop, SessionEnd,
  then PreToolUse/PostToolUse). Round 2 added `PermissionRequest` and
  `PermissionDenied` after PR review challenged the round-1 conclusion.
- All permission and plan decisions were made deliberately; two accidental
  approvals are disclosed under Method errors below.

## Round 2 — the corrected wait model

Round 2 exists because reviewers on PR #532 challenged this report's round-1
claim that `PreToolUse` marks a wait. They were right. Measured sequences:

| Case | Observed sequence |
| --- | --- |
| Auto-approved tool (allowlisted `ls`) | `PreToolUse` → `PostToolUse` in ≤1s, **no `PermissionRequest`**, no Notification |
| Permission-gated tool, approved | `PreToolUse` → **`PermissionRequest`** (same second) → *wait* → `PostToolUse` |
| Permission-gated tool, denied | `PreToolUse` → `PermissionRequest` → Notification (+6s) → **nothing** |
| Plan approval | `PreToolUse{ExitPlanMode}` → **`PermissionRequest{ExitPlanMode}`** (same second) → Notification (+6s) → `PostToolUse` on approval, **nothing** on rejection |

Corrections this forces:

1. **`PermissionRequest` is the human-wait start marker; `PreToolUse` is
   not.** `PreToolUse` fires before *every* tool call. A single round-2 trace
   contains `Write`, `ToolSearch`, and `ls` each completing
   `PreToolUse`→`PostToolUse` in ≤1s with no `PermissionRequest` and no human
   involvement. Treating that bracket as a wait would count ordinary
   execution as blocked time, and would fire false permission escalations for
   any slow tool.
2. **`PermissionRequest.tool_name` is the wait-class discriminator.**
   `ExitPlanMode` ⇒ plan-approval wait; any other tool ⇒ tool-permission
   wait. This replaces both the Notification message-text derivation
   (original plan) and the `PreToolUse` derivation (round 1).
3. **Wait end ≠ `PostToolUse` timestamp.** `PostToolUse` marks execution
   completion, so the raw bracket contains wait **plus** execution. The true
   wait is `PostToolUse.ts − PermissionRequest.ts − PostToolUse.duration_ms`.
   Without that subtraction, permission waits are systematically inflated by
   the tool's own runtime.
4. **Open brackets must not be closed by "the next event of any kind"** (as
   round 1 wrongly proposed). The corroborating Notification arrives ~6s
   after `PermissionRequest`, so that rule would record ~6s for a wait
   measured at 82s. Close a bracket only on its matching decision or terminal
   evidence; otherwise leave it open and tombstone it.
5. **`PermissionDenied` did not fire** on an interactive denial in 2.1.220
   with this wiring. Recorded as an observed absence, not proof it never
   fires. Denial therefore leaves an open bracket exactly like plan
   rejection.
6. **`PermissionRequest` carries no `tool_use_id`.** Its observed keys are
   `cwd`, `hook_event_name`, `permission_mode`, `prompt_id`, `session_id`,
   `tool_input`, `tool_name`, `transcript_path`, and sometimes
   `permission_suggestions` — while `PreToolUse` and `PostToolUse` both
   carry `tool_use_id`. A wait bracket therefore cannot be paired directly
   from its start event: pairing must join `PermissionRequest` to the
   nearest preceding **unpaired** `PreToolUse` (same session, same
   `tool_name`), whose `tool_use_id` then pairs with `PostToolUse`. P4's
   span reconstruction must implement that two-hop join rather than
   assuming a shared id, and must treat it as a strict one-to-one matching:
   the same tool can be requested repeatedly and a denied request stays
   open forever, so a looser join lets a later attempt's `PostToolUse`
   close an earlier open bracket — fabricating a long wait and swallowing
   the real one. PLAN.md P1 amendment 4 carries the binding rule.
   (`permission_suggestions` is deliberately excluded from `HookPulseV1`: it
   can carry tool-argument-shaped content, so law 3 keeps it
   unrepresentable.)

## Round 1 — findings that survive

### Idle notification: exactly 60s after Stop, fires once, Stop-gated

Two independent measurements: Stop 06:27:21 → idle Notification 06:28:21;
Stop 06:32:43 → idle Notification 06:33:43. Exactly 60s both times, and only
**one** notification across a 150s hold.

That the idle signal fires *once* is load-bearing for P2: a long human wait
produces no further hook events at all, so "any hook event renews the lease"
cannot keep a blocked session alive, and a live-but-waiting session would
satisfy a naive expiry test. P1 must supply a periodic heartbeat or an
explicit pending-wait state; lease TTL alone cannot distinguish a parked
human from a dead session.

The idle timer is gated on `Stop`: the plan-rejected session sat at its
prompt for 3m46s and emitted nothing, because plan-mode turns produce no
`Stop`.

### Stop does not fire for plan-mode turns

The rejected-plan session's complete history was `UserPromptSubmit` →
`Notification` → `SessionEnd`: no `Stop`, despite a completed assistant turn.
Lease renewal must not treat `Stop` as the turn boundary.

### Measured brackets

Plan approval start 06:40:07 → `PostToolUse` 06:41:29 = 82s, matching the
held wall-clock. Tool permission 06:38:20 → 06:39:59 = 99s. Both are upper
bounds until `duration_ms` is subtracted (correction 3).

### SIGKILL produces no SessionEnd — P2's assumption confirmed

`kill -9` on a live session produced zero subsequent events. Clean `/exit`
produces `SessionEnd` with `reason: "prompt_input_exit"`. Channel dropout is
real; lease-driven tombstone reconciliation is mandatory.

### Hook payloads are content-bearing — privacy law 3 binds at the source

Observed raw payload keys include `prompt` (UserPromptSubmit),
`last_assistant_message` (Stop), `tool_input` / `tool_response`
(Pre/PostToolUse), and `message` (Notification). The hook input stream
carries exactly what the packet forbids in telemetry, so
privacy-by-unrepresentability cannot be a downstream filter — the whitelist
projection must happen in the hook writer itself. Every value in the
committed 65-event ledger is an enum, UUID, path, timestamp, or tool name.

Safe non-content fields available to `HookPulseV1`: `session_id`,
`transcript_path`, `prompt_id`, `cwd`, `permission_mode`, `tool_name`,
`tool_use_id`, `duration_ms` (PostToolUse), `notification_type`, `reason`
(SessionEnd), `stop_hook_active`, `permission_suggestions`
(PermissionRequest).

### Every row must carry its schema version

These rows are replayed by P4 as first-class raw history. `notifierRev`
identifies notifier state, not row layout, so a shared append store could
hold multiple layouts with no decoder discriminator. Each row carries an
explicit `schemaVersion` literal.

### Instrument defect found before it could corrupt data

jq's `capture()` yields an **empty stream** (not `null`, not an error) on
no-match, and an empty stream inside jq object construction annihilates the
whole object. The first script draft silently dropped every idle-wait ledger
line while exiting 0 — a fail-open instrument losing data with no error
signal. Fix: `[... | capture(...).t][0]` → `null`. `try/catch` does **not**
help; there is no error to catch. The production writer needs a no-match
regression fixture.

## Method errors (recorded as evidence, not hidden)

1. **False negative from a delta baseline.** The round-1 reading "zero hook
   events during a 120s pending plan approval" was wrong: the Notification
   had fired 6s *before* the line-count baseline was taken. Recovered by
   reading absolute ledger state. For P4 trust gates: derived deltas must
   reconcile against absolute state, and "no event observed" is evidence of
   absence only when the observation window provably precedes the wait.
2. **Two accidental approvals.** Submitting a prompt with a second `Enter`
   (sent because the first appeared not to register) landed on the following
   permission dialog and approved it, twice — once creating an empty
   `spike-permission-marker.txt` and once `perm-probe.txt`, both in the
   disposable tmpfs clone, both removed. Deliberate denials afterwards were
   verified by confirming the target file did not exist.
3. **Round-1 over-generalization.** `PreToolUse` was promoted to "the wait
   marker" from traces where every observed `PreToolUse` happened to precede
   a permission prompt. The auto-approved control case was never run until
   review forced it. Instrument verification needs the negative control, not
   only the positive one.

## Verdicts

- **Tool-permission wait** — distinguishable via `PermissionRequest` with a
  non-`ExitPlanMode` `tool_name`, sessionId-bearing, both edges measurable
  after `duration_ms` subtraction: **YES**.
- **Plan-approval wait** (the headline p95 105-min class) — distinguishable
  via `PermissionRequest{tool_name: "ExitPlanMode"}`: **YES**; end edge
  present only on approval, open bracket on rejection.
- **Idle wait** — distinguishable, sessionId-bearing, 60s threshold measured
  twice: **YES**, with the caveats that it is Stop-gated (blind to plan-mode
  sessions) and fires once (cannot sustain a lease).

## Evidence

- Committed ledger: `history/evidence/2026-08-01-hook-pulse-spike.ndjson`
  (65 events across both rounds; spike rows carry `instrumentClass: "spike"`
  and `notifierRev: "spike-0"`).
- Pane snapshots and the spike hook script live in the session scratchpad
  (tmpfs, non-durable); the committed ledger and this report are the durable
  record.
