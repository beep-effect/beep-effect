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

P0 Research — re-verify the audit inventory (status-token census, manifest-less
packets, GOAL.md violations) and commit it as the migration's ground truth.

## Latest Evidence

Not started. Packet authored 2026-07-11 from the goals-system recommendations
and the PR #365 housekeeping sweep, which demonstrated every targeted failure
mode by hand before this packet automates it.

## Notes

- Follow-ups deliberately out of scope here: `goals/_archive/` physical moves,
  and scheduled reconciliation (`portfolio-heartbeat`) which will run this
  packet's doctor on a cron.
- The doctor's baseline ratchet (`goals/goals-doctor.baseline.jsonc`) follows
  the fallow pattern: inherited findings advisory, new findings blocking,
  baseline only shrinks.
