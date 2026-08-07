# Coding Agent Effectiveness Evidence Loop

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make coding-agent effectiveness on this workstation measurable with
trustworthy schema-first evidence — flight records, coverage attestation,
legible Yeet verdicts — then reduce at least one dominant agent wait
(plan-approval p95 105 min, polling at 3.4x tool-execution time) behind
controlled, guardrailed experiments.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/coding-agent-effectiveness-evidence-loop/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (locked decisions,
   evidence-integrity laws, acceptance gates).
3. [`PLAN.md`](./PLAN.md) - active execution plan (phases P0–P8 with
   first-steps and load-bearing risks).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
6. [`research/2026-07-31-adhd-amendments.md`](./research/2026-07-31-adhd-amendments.md) -
   divergent-ideation report behind the amended plan.

## Current Phase

P1 is in progress. All three instrument steps are done, and the instrument is
live and verified in production; the phase is now waiting on baseline wall-clock:

1. **Hook semantics verified** (2026-08-01) — all three wait classes emit
   distinguishable, sessionId-bearing events. **`PermissionRequest`** (not
   `PreToolUse`, not `Notification`) is the wait-start marker.
2. **`HookPulseV1` schema landed** (2026-08-01, PR #535) — the canonical
   row, its derivation, and the raw-event codec.
3. **Writer landed** (2026-08-05) — `.claude/hooks/hook-pulse.sh` emits the
   rows for nine registered hook events, with the privacy whitelist applied
   in the writer (amendment 6) and a kill switch that disarms the instrument
   before any parsing. `notifierRev` is `log-only-0`: notifications stay
   **off** by design.

**The ~1 week log-only baseline is running**, open since
`2026-08-06T13:12:30Z`, target close on or after `2026-08-13T13:12:30Z`. This is
wall-clock, not work: the instrument-before-treat method in
[`PLAN.md`](./PLAN.md) requires a baseline before any wait treatment, so nothing
downstream (notifications, escalation ladder, the P8 paired trial) can start
until it accrues, and turning any of them on mid-window destroys it.
`notifierRev` stays `log-only-0` throughout.

**P0 (storage cutover + identity registry) completed 2026-08-07** in parallel,
as PLAN.md permitted: the 20G canonical store moved atomically to
`${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics` with byte-identical
census gates, the data-root precedence (`--data-root` →
`BEEP_AI_METRICS_DATA_ROOT` → XDG default) replaced every clone-relative
default, the identity registry and bounded config snapshots are live
(25,741 → 256 snapshot files, five stage timings, nested worktrees excluded),
and the codec↔writer hash-salt divergence noted below is resolved. Evidence:
[`history/outputs/2026-08-07-p0-cutover.md`](./history/outputs/2026-08-07-p0-cutover.md).
The cutover never touched the sibling `agent-evidence/` ledger — the P1
baseline window is undisturbed.

**Day-1 checks and both pre-baseline gates: closed 2026-08-06**
(`research/2026-08-06-p1-instrument-live-handoff.md`). Verified against 1,329
live rows: `PermissionRequest` fires, `PostToolUseFailure` fires (amendment 8
validated), payload shapes hold. Then the two blockers were cleared:

1. **Plan approval is observed.** A full `ExitPlanMode` bracket was captured at
   13:10:06Z — `PreToolUse` → `PermissionRequest{waitReason: "plan-approval"}` →
   `PostToolUse`, joined through the amendment-4 two-hop rule, true wait 12.935s.
   The headline wait class is instrumented. New hazard recorded there:
   `permissionMode` flips *within* a bracket, so stratification must key on the
   `PermissionRequest` row, never the terminal event.
2. **Operator salt provisioned**, sourced from `op://TBK/ai-metrics/hash-salt`,
   cut over globally at `2026-08-06T13:12:20Z`. Pre-cutover rows are verification
   data in a different pseudonym namespace and are not baseline data.

**Open risk — sampling power, checkpoint 2026-08-09.** 20 of 22 observed sessions
run `bypassPermissions`, where ordinary tool gates emit no `PermissionRequest` at
all. Zero *organic* plan approvals have been seen (the one captured was induced),
and all organic `tool-permission` rows are `AskUserQuestion`. The baseline
therefore measures plan approvals and `AskUserQuestion` only — a narrower slice
than "agent waits", by construction rather than by chance. Re-check at mid-week
before assuming the window can produce a p95.

## Latest Evidence

[`research/2026-08-01-p1-hook-semantics-spike.md`](./research/2026-08-01-p1-hook-semantics-spike.md),
ledger committed at
[`history/evidence/2026-08-01-hook-pulse-spike.ndjson`](./history/evidence/2026-08-01-hook-pulse-spike.ndjson)
— 74 hook events across three rounds of real Claude Code 2.1.220 sessions.
Measured: `PermissionRequest` fires only for permission-gated calls while
auto-approved tools complete `PreToolUse`→`PostToolUse` in ≤1s; plan
approval bracketed at 82s and tool permission at 99s (both before
subtracting `PostToolUse.duration_ms`); idle notification at exactly 60s
after `Stop`, once, never repeating; `SIGKILL` emits no `SessionEnd`
(confirms P2's tombstone requirement); plan-mode turns emit no `Stop`;
denials and plan rejections leave open brackets with no closing event;
every ledger value is an enum, UUID, path, timestamp, or tool name.

## Notes

- Born from `explorations/agent-effectiveness-pulse` wave-2 graduation
  (2026-07-31): one packet absorbing the previously proposed
  `yeet-verdict-instrumentation` and `repo-replay-evals` splits, amended by
  a five-frame ADHD ideation run (see research report).
- The audit's phase numbering (P0.5/P1.5) maps to this packet's sequential
  P0–P8; the map lives at the top of `PLAN.md`.
- Depends on `goals/effect-v4-workflow-engine-spike` (durability boundary)
  and consumes `goals/ai-metrics-stack` P7f output; reopens neither.
