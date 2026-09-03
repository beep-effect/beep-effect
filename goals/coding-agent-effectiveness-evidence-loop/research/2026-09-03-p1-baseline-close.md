# P1 log-only baseline close

Date: 2026-09-03
Window: `[2026-08-06T13:12:30Z, 2026-08-13T13:12:30Z)`
Instrument revision: `log-only-0`
Decision: target the observed `AskUserQuestion` wait tail in P1; keep
plan-approval explicitly unmeasured pending a separate induced or longer
protocol.

## Method

The analysis read only the canonical hook-pulse shards whose UTC dates overlap
the fixed seven-day window under
`${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence/hook-events`. The
window begins at the sharp operator-salt boundary recorded in
`2026-08-06-p1-instrument-live-handoff.md`; pre-cutover verification rows were
not eligible.

Rows were ordered by `sessionId`, millisecond timestamp, and lifecycle rank.
Each `PermissionRequest` claimed the nearest preceding unpaired `PreToolUse` in
the same session with the same `toolName`. Only a terminal event carrying that
attempt's exact `toolUseId` could close it. Wait duration was
`terminal.ts - PermissionRequest.ts - terminal.durationMs`. `SessionEnd`
tombstoned any still-open bracket; `Stop` did not. This is the PLAN.md
amendment-4 two-hop join, including amendments 3 and 8.

The report retains only counts, enums, timestamps, and durations. It emits no
session, clone, transcript, or path digest and no cleartext path-to-digest pair.

## Instrument health

- 63,598 eligible production rows across 113 sessions.
- Every eligible row was `hook-pulse/v1`, `claude-code`, `production`,
  `derived`, and `log-only-0`.
- All private references matched `Sha256Hex`; every shard's UTC day and session
  suffix agreed with every row it contained.
- The canonical key allowlist held. Prompt, command, tool-input, tool-result,
  assistant-message, notification-message, error, permission-suggestion,
  background-task, and session-cron keys were absent.
- Byte-identical duplicate rows: 0.
- Disarm windows overlapping the baseline: 0.
- Wait-attribution invariants, non-negative durations, and event-owned fields
  passed the live-row checks.

The event census was 28,492 `PreToolUse`, 82 `PermissionRequest`, 28,063
`PostToolUse`, 337 `PostToolUseFailure`, 1 `PermissionDenied`, 1,457
`Notification`, 2,609 `UserPromptSubmit`, 2,415 `Stop`, and 142 `SessionEnd`.

## Wait results

There were zero `ExitPlanMode` events of any kind and therefore zero organic
plan-approval samples. Extending the window would not repair a structural
absence from the operator's in-window working style.

The 82 permission starts were:

- 81 `AskUserQuestion` requests;
- 1 session-archive MCP request;
- 77 under `bypassPermissions` and 5 under `auto`, keyed on the
  `PermissionRequest` row as required.

The strict matcher closed 81 brackets on `PostToolUse`, guessed none, produced
no ambiguous joins or negative waits, and tombstoned one `AskUserQuestion`
bracket at `SessionEnd`. No bracket remained open at the window boundary.

All 81 closed waits had p50 37.642 s, p90 13 min 25.877 s, p95 25 min
22.112 s, and max 3 h 30 min 11.669 s. The single session-archive gate is the
all-class maximum and is not a population from which to infer a treatment.

The 80 closed `AskUserQuestion` waits had p50 37.464 s, p90 13 min 19.489 s,
p95 22 min 40.934 s, and max 1 h 25 min 29.275 s. This is the only sampled
wait class with enough observations to support an interrupted time-series
treatment in P1.

## Decision

Adopt option 3 from `2026-08-10-p1-sampling-power-checkpoint.md`:

1. P1 notifications target open `AskUserQuestion` brackets as the measured
   human-input wait class. Plan-approval remains an eligible notifier trigger,
   but its effect is not inferred from this baseline.
2. The notifier revision changes only after this close record lands, preserving
   a sharp intervention boundary.
3. A plan-approval claim in P8 requires its own clearly labelled induced-sample
   protocol or a future organic accrual window. The July p95 remains historical
   candidate-generation evidence, not a baseline measurement.
4. The post-intervention report must use the same join, publish its denominator,
   stratify on notifier revision and permission mode, and preserve tombstones.

P1 is not complete at this checkpoint. Notifications, the escalation/storm
damping path, the shared probe circuit breaker, and a measured post-intervention
series remain required by the phase exit criteria.
