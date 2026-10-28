# Epistemic Memory Retention Projections

## Status

Lifecycle: `completed-retained`

This is the retained landing state proposed by [PR #2321](https://github.com/beep-effect/beep-effect/pull/2321);
it takes effect after the exact-head gates, review window and merge.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship rebuildable memory-tier and pressure projections over accepted epistemic
authority, with policy as schema-validated data behind a calibration gate.

## Launch

```text
/goal follow the instructions in goals/epistemic-memory-retention-projections/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`research/SOURCES.md`](./research/SOURCES.md)

## Current Phase

P0–P4 complete in the proposed landing state. The implementation, verification
and reflection are retained; no production policy is active. PR publication,
final-check, hosted review and merge are the separate landing gate.

## Latest Evidence

The [P0 contract](history/2026-10-28-p0-contract.md), eleven use-case reporting
tests, three domain tests, and the migrated-database delete/rebuild drill. See the
[operator runbook](ops/REPORT.md). Full audits and docgen pass for all three packages. The [verification record](history/2026-10-28-verification.md) and
[reflection](history/reflections/2026-10-28-codex.md) preserve the proof and its limits.

## Notes

RRF integration is a follow-on after `hybrid-retrieval-fusion-core` wakes;
this goal owns no fusion arithmetic.
