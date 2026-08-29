# Lint Policy Single Digit

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Drive the hosted `Lint Policy` required check from ~20 minutes to single-digit minutes
with the full-scope proof intact: parallel deprecated-apis shards + LPT ordering now, an
oxlint-tsgolint engine swap behind hard parity/timing gates, and PR changed-scope
explicitly deferred.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/lint-policy-single-digit/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher (current phase: P1).
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - phase table and closeout checklist.
4. [`ops/manifest.json`](./ops/manifest.json) - locked decisions, killed ideas,
   baseline, stop conditions.
5. [`research/`](./research/) - evidence brief + five exploration reports
   (2026-08-13, Codex Sol medium fan-out).

## Current Phase

Closed 2026-08-13. Delivered ~20 min -> 10m32s (P1, PR #678) plus the closeout outer-3 raise; oxlint-tsgolint cutover disproven (P2 NO-GO). Backlog: P2b re-spike precondition, docgen ownership move, deferred PR changed-scope.

## Latest Evidence

P1 hosted: deprecated-apis 975s -> 435s, job 10m39s/10m32s (PR #678). P2 spike verdict:
[`history/p2-spike-2026-08-13.md`](./history/p2-spike-2026-08-13.md). Closeout reflection:
[`history/reflections/2026-08-13-claude.md`](./history/reflections/2026-08-13-claude.md).
Baseline table: [`research/00-evidence-brief.md`](./research/00-evidence-brief.md).
