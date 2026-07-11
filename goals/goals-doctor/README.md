# Goals Doctor & Index

## Status

Lifecycle: `completed-retained`

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

Closed. All phases complete; shipped via
[PR #373](https://github.com/beep-effect/beep-effect/pull/373).

## Latest Evidence

Shipped 2026-07-11 via [PR #373](https://github.com/beep-effect/beep-effect/pull/373)
(all checks green, MERGEABLE). Phase oracles in [`history/`](./history):
P0 census, P1 migration convergence (83/83 manifests decode), P2 index
drift check, P3 doctor + verify wiring, P4 PR-to-mergeable. Closeout
reflection in
[`history/reflections/2026-07-11-claude.md`](./history/reflections/2026-07-11-claude.md);
packet closed with `bun run beep goals set-status goals-doctor
completed-retained` (dogfood).

## Notes

- Follow-ups deliberately out of scope here: `goals/_archive/` physical moves,
  and scheduled reconciliation (`portfolio-heartbeat`) which will run this
  packet's doctor on a cron.
- The doctor's baseline ratchet (`goals/goals-doctor.baseline.jsonc`) follows
  the fallow pattern: inherited findings advisory, new findings blocking,
  baseline only shrinks.
