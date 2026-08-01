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

P1 is in progress. Its instrument-verification first step passed on
2026-08-01: all three wait classes (tool permission, plan approval, 60s
idle) emit distinguishable, sessionId-bearing hook events. Next concrete
action: author `HookPulseV1` in effect/Schema under the five binding spike
amendments in [`PLAN.md`](./PLAN.md) — most importantly a six-event hook set
(`PreToolUse`/`PostToolUse` added) with `waitReason` derived from
`PreToolUse.tool_name`. P0 storage-cutover preparation may proceed in
parallel by a separate actor.

## Latest Evidence

[`research/2026-08-01-p1-hook-semantics-spike.md`](./research/2026-08-01-p1-hook-semantics-spike.md) —
43 hook events across 4 real Claude Code 2.1.220 sessions. Measured: plan
approval bracketed at 82s and tool permission at 99s via
`PreToolUse`→`PostToolUse`; idle notification at exactly 60s after `Stop`
(twice); `SIGKILL` emits no `SessionEnd` (confirms P2's tombstone
requirement); plan-mode turns emit no `Stop`; ledger privacy sweep clean
across all 43 events.

## Notes

- Born from `explorations/agent-effectiveness-pulse` wave-2 graduation
  (2026-07-31): one packet absorbing the previously proposed
  `yeet-verdict-instrumentation` and `repo-replay-evals` splits, amended by
  a five-frame ADHD ideation run (see research report).
- The audit's phase numbering (P0.5/P1.5) maps to this packet's sequential
  P0–P8; the map lives at the top of `PLAN.md`.
- Depends on `goals/effect-v4-workflow-engine-spike` (durability boundary)
  and consumes `goals/ai-metrics-stack` P7f output; reopens neither.
