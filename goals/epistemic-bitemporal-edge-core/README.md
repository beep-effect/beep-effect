# Epistemic Bitemporal Edge Core

## Status

Lifecycle: `active`

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

P1 Implement: build the domain/tables/use-cases/server/migration vertical slice on the
P0-ratified enforcement design
([`ops/handoffs/p0-to-p1-handoff.md`](./ops/handoffs/p0-to-p1-handoff.md)).

## Latest Evidence

P0 hard gate CLEARED — **PROCEED** verdict at
[`history/2026-07-25-p0-verdict.md`](./history/2026-07-25-p0-verdict.md): full
exclusion-constraint parity across production Postgres (17.10) and PGlite (18.3 wasm),
deterministic concurrent supersession on two real connections, restart proof, safe
identity partition, and a PASS provenance inventory (Graphiti `v0.29.2`, no NOTICE,
zero mined-location drift). Spike evidence: S1–S6 NOTES under
[`history/p0/`](./history/p0/).

## Notes

This is explicitly the `@beep/epistemic-tables` bitemporal port milestone.
Landing it fires the doctrine trigger to retire the write-frozen operator-level
Graphiti deployment; product tables never become an operator-memory backend.
