# Goals Doctor & Index

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make `goals/` lifecycle machine-truthful: a canonical `GoalManifest` schema, a
generated `goals/INDEX.md`, a `beep goals doctor` that diffs manifest claims
against git evidence, and a single-writer `beep goals set-status` — all wired
into `yeet verify` so packet drift blocks instead of accumulating.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/goals-doctor/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (locked decisions D1-D7).
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance: audit evidence
   and the external patterns each decision is stolen from.

## Current Phase

P1 Schema + set-status + migrate — `GoalManifest` v2, `beep goals set-status`
with `--migrate`, manifests migrated, 5 missing manifests backfilled.

## Latest Evidence

P0 census committed 2026-07-11
([`research/status-token-census.md`](./research/status-token-census.md),
oracle in [`history/p0-oracle.md`](./history/p0-oracle.md)): 83 packets,
78 manifests, 14+7 status tokens, 12 phase tokens, 10 status↔lifecycle
disagreements — audit confirmed with fresh deltas.

## Notes

- Follow-ups deliberately out of scope here: `goals/_archive/` physical moves,
  and scheduled reconciliation (`portfolio-heartbeat`) which will run this
  packet's doctor on a cron.
- The doctor's baseline ratchet (`goals/goals-doctor.baseline.jsonc`) follows
  the fallow pattern: inherited findings advisory, new findings blocking,
  baseline only shrinks.
