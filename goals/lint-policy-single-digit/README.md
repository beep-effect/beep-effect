# Lint Policy Single Digit

## Status

Lifecycle: `active`

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

P1 — Phase-1 CLI speedup PR: inner 4-way deprecated-apis shards with per-shard caches,
LPT step ordering, empty-set step omission; outer concurrency stays 2.

## Latest Evidence

Baseline: hosted run `31683014887` (PR #673, 2026-08-13) — job ~20 min,
`lint:deprecated-apis` 975s of the 1124s lane at step concurrency 2. Full per-step table:
[`research/00-evidence-brief.md`](./research/00-evidence-brief.md).
