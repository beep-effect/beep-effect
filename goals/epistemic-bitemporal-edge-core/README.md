# Epistemic Bitemporal Edge Core

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver the Postgres bitemporal claim/edge authority core: durable disposition,
atomic supersession, two-axis history, and restart-safe migration proof.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/epistemic-bitemporal-edge-core/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - implementation provenance and license ledger.
6. [`history/`](./history/) - evidence and closeouts.

## Current Phase

Closed (completed-retained). Reflection:
[`history/reflections/2026-07-25-claude.md`](./history/reflections/2026-07-25-claude.md).

## Latest Evidence

P1 vertical slice LANDED —
[`history/2026-07-25-p1-implementation.md`](./history/2026-07-25-p1-implementation.md):
domain/tables/use-cases/server/db-admin implemented exactly on the P0-ratified
design; durable rejected disposition via `resolveClaimGateOutcome`; atomic
close-and-insert supersession with deterministic real-Postgres races (4/4, six
consecutive runs) and a ratified creation-race mapping refinement; restart
proof off one persistent dataDir; Graphiti Apache-2.0 duties discharged and the
retirement doctrine trigger recorded; spike suites/fixtures deleted with all
touchpoints reverted. P0 verdict remains at
[`history/2026-07-25-p0-verdict.md`](./history/2026-07-25-p0-verdict.md).

## Notes

This is explicitly the `@beep/epistemic-tables` bitemporal port milestone.
Landing it fires the doctrine trigger to retire the write-frozen operator-level
Graphiti deployment; product tables never become an operator-memory backend.
