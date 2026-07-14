# Projection Dispatch Core

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver one restart-safe accepted-record projection cycle with an atomic
authority/intent commit, persistence-backed Effect v4 worker, isolated
rebuildable projection state, and a disposable authenticated desktop freshness
hint.

## Launch

```text
/goal follow the instructions in goals/projection-dispatch-core/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract and acceptance cycle.
3. [`PLAN.md`](./PLAN.md) - P0 handoff/store proof and execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine routing and blocker.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance.
6. [`local-first-projection-sync`](../../explorations/local-first-projection-sync/README.md) - source exploration.

## Current Phase

P0 atomic handoff design and `DurableQueue` store-integration proof is blocked
until `goals/effect-v4-workflow-engine-spike` lands its persistence adapter,
crash matrix, competing-worker contract, and kill/restart evidence.

## Latest Evidence

Not started.

## Notes

The durable plane owns convergence; the desktop hint owns latency only. The
per-launch token authenticates a desktop launch, not a user, and every requested
workspace/matter scope must be server-authorized before subscription.
