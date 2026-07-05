# Repo Crispening Orchestration

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Run a durable, repo-wide crispening — push invariants and pure behavior into
`effect/Schema` and onto the data via enforce-first lint doctrine, bounded
family-scoped remediation waves, and a per-owner blocking ratchet — so
business-logic modules read as pure intent and the property survives after
this packet closes.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/repo-crispening-orchestration/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth: Non-Goals (the nine
   fences), Constraints, Rule Cards S1-S5, Definition of Done, Verification
   Matrix, Stop Conditions.
3. [`PLAN.md`](./PLAN.md) - active execution plan, phase table, and burndown.
4. [`research/decisions-locked.md`](./research/decisions-locked.md) - locked
   decisions D1-D5 and grill outcomes G1-G7. Locked — do not reopen.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
6. [`history/`](./history/) - evidence and closeouts, once produced.

## Current Phase

P0 Enforce foundations — pending; next action: execute the P0 items in
`tasks/tasks.jsonc`.

## Latest Evidence

Packet scaffold merged via PR #292 (2026-07-05); WIP gaps filled on
`feat/repo-crispening-p0`.

## Notes

Locked decisions are in [`research/decisions-locked.md`](./research/decisions-locked.md)
— do not reopen; amendments require a superseding entry in
`standards/architecture/DECISIONS.md`. This packet orchestrates and adds
novel work only (D1): it cross-links, and never supersedes,
`goals/schema-first-v4-capabilities`, `goals/schema-first-zero-actionables`,
`goals/effect-native-migration`, and `goals/beep-schema-topology`.
