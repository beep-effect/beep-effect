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

P2 is in progress. P1 closed on 2026-09-03 after the ntfy phone transport was
restored to its original optional status and deferred with an explicit trigger.
The fixed baseline is closed, the sharp notifier revision is
merged, the guarded fleet rollout is dispositioned, and the first treatment
readout is favorable:

1. **Hook semantics verified** (2026-08-01) — all three wait classes emit
   distinguishable, sessionId-bearing events. **`PermissionRequest`** (not
   `PreToolUse`, not `Notification`) is the wait-start marker.
2. **`HookPulseV1` schema landed** (2026-08-01, PR #535) — the canonical
   row, its derivation, and the raw-event codec.
3. **Writer landed** (2026-08-05) — `.claude/hooks/hook-pulse.sh` emits the
   rows for nine registered hook events, with the privacy whitelist applied
   in the writer (amendment 6) and a kill switch that disarms the instrument
   before any parsing.
4. **Baseline closed** (2026-09-03) — the fixed seven-day `log-only-0` window
   contains 63,598 eligible rows across 113 sessions and 80 closed
   `AskUserQuestion` waits: p50 37.464 s, p90 13 min 19.489 s, p95 22 min
   40.934 s, max 1 h 25 min 29.275 s. Strict matching guessed no brackets,
   found zero duplicates, and observed zero `ExitPlanMode` events. The recorded
   decision targets the sampled `AskUserQuestion` tail and keeps plan approval
   explicitly unmeasured.
5. **Sharp sequence breaker merged and rollout dispositioned** (2026-09-03) —
   `desktop-ntfy-1` is stamped by every locally configured Claude and Codex
   pulse. The worker notifies only a strictly attributed open
   `PermissionRequest`, rechecks exact closure before two escalation rungs, and
   atomically damps duplicates per session/target. Desktop delivery was
   accepted by the live Plasma bus. A shared schema-owned `op`/`gh`/`network`
   circuit breaker turns retries into labeled skips across both agent adapters.
   PR #973 merged at `2026-09-03T14:32:50Z`; the two existing adopters plus
   five clean, process-idle `main` clones now carry the sharp revision. Other
   active, dirty, detached, or feature-branch checkouts were not mutated.
   Subsequent owner integrations raised adoption to 19 of 22 direct clones.
   The other three are explicitly excluded from the current rollout
   denominator: an Effect-v3 archive, protected live dirty work on open PR
   #982, and a clean inactive feature checkout with no PR or observed liveness
   signal. Their revision-labelled rows remain controls, and each re-enters the
   rollout decision on integration or reactivation.
6. **First sharp readout recorded** (2026-09-03) — eight treatment
   `AskUserQuestion` starts yielded seven exact-ID closures and one honest
   `SessionEnd` tombstone, with zero guessed or ambiguous joins. Closed waits
   had p50 7.439 s versus the fixed baseline p50 of 37.464 s, an early
   descriptive reduction of 30.025 s / 80.1%. The treatment is retained, but
   the small, mode-shifted sample is not promoted to an unqualified causal
   claim.
7. **Telemetry-v2 contracts landed** (2026-09-03). Schema-first flight
   records now separate agent-supplied semantics from mechanical evidence, and
   ingest has distinct pre-read enumeration and final attestation contracts.
   The first fixtures cover one real Codex session and all six current source
   instances without retaining transcript content. P2 remains open for the
   service, emitters, leases, reconciliation, and coverage gate.

The interrupted-series lower bound is `2026-09-03T09:41:33.322Z`, after a
six-second old/new writer overlap excluded from analysis. The census through
`2026-09-03T17:04:13.599Z` contains 17,735 rows: 3,298
`desktop-ntfy-1` and 14,437 `log-only-0`. The strict two-hop replay found eight
sharp and one comparison `AskUserQuestion` starts; notification evidence
records two accepted initial desktop sends, storm damping for six same-session
retries, and exact-bracket suppression of a resolved reminder. This remains a
staggered, revision-qualified intervention, not a merge-time claim of
fleet-wide adoption.
Phone delivery remains unconfigured, but it is not a P1 exit gate. The
normative spec never requires a phone transport, and the originating amendment
called ntfy optional. A repository audit found no provisioned ntfy service,
runtime reference, or existing operator dependency. The implemented transport
continues to fail open as `transport-unconfigured`; reconsider it only after an
explicit operator request and a least-privilege design. The historical
`desktop-ntfy-1` revision name remains unchanged because evidence labels are
immutable. P1 is complete and P2 is current. Full evidence is in
[`research/2026-09-03-p1-baseline-close.md`](./research/2026-09-03-p1-baseline-close.md),
[`research/2026-09-03-p1-first-treatment-readout.md`](./research/2026-09-03-p1-first-treatment-readout.md),
[`research/2026-09-03-p1-phone-transport-disposition.md`](./research/2026-09-03-p1-phone-transport-disposition.md),
[`research/2026-09-03-p2-contract-foundation.md`](./research/2026-09-03-p2-contract-foundation.md),
and
[`history/outputs/2026-09-03-p1-sharp-cutover.md`](./history/outputs/2026-09-03-p1-sharp-cutover.md).

**P0 (storage cutover + identity registry) completed 2026-08-07** in parallel,
as PLAN.md permitted: the 20G canonical store moved atomically to
`${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics` with byte-identical
census gates, the data-root precedence (`--data-root` →
`BEEP_AI_METRICS_DATA_ROOT` → XDG default) replaced every clone-relative
default, the identity registry and bounded config snapshots are live
(25,741 → 256 snapshot files, per-stage timings, nested worktrees excluded),
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

**Sampling decision — checkpoint closed 2026-09-03.**
The mid-window check
([`research/2026-08-10-p1-sampling-power-checkpoint.md`](./research/2026-08-10-p1-sampling-power-checkpoint.md))
found **zero `ExitPlanMode` rows in any hook event** at ~day 4 — plan mode is
simply not part of the operator's in-window working style, so this window
could not produce a plan-approval p95. It did produce a defensible
`AskUserQuestion` wait distribution (n = 35, 100% bracket closure, p50 59 s,
p95 ≈ 26.6 min, strongly bimodal), stratified 31/36 `bypassPermissions` on the
`PermissionRequest` row. The fixed-window close expanded that denominator to 80
closed waits and adopted checkpoint option 3: treat the observed human-input
tail now; require a separately labeled induced or organic protocol before any
future plan-approval claim.

## Latest Evidence

[`research/2026-09-03-p1-baseline-close.md`](./research/2026-09-03-p1-baseline-close.md)
and
[`history/outputs/2026-09-03-p1-sharp-cutover.md`](./history/outputs/2026-09-03-p1-sharp-cutover.md)
are the current P1 evidence. The original semantics proof remains in
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
