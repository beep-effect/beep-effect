# Lab Apps Lifecycle

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Law-abiding experimental apps under `apps/labs/*` — minted by
`bun run beep create-package` variants (nextjs, vite, service; tauri in a
later phase) — plus a `beep delete-package` command that fully prunes a
package or app from every registration surface, both standing on a
schema-first registration-geometry model with a `doctor` residue audit.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/lab-apps-lifecycle/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (Decision Log D1–D14 is locked).
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - the 2026-08-13 six-lane fan-out reports this packet was synthesized from.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Census ratification and geometry schema design: re-verify the
registration-surface census (`research/02-registration-blast-radius.md`
§19 master table) against the live tree, then design the
`RegistrationSurface` geometry schema that `create-package`,
`delete-package`, and `doctor` all consume.

## Latest Evidence

Not started. Scaffold evidence: the six lane reports under
[`research/`](./research/) and the locked interview decisions in
`SPEC.md` Decision Log.

## Notes

- Two tracks, one packet (operator-ratified): delete/geometry first, labs
  second, tauri last. Split tripwire: if either track grows a second
  primary, supersede the phase into a sibling packet
  (`ci-fleet-endgame` precedent) — do not widen this one.
- Known live acceptance fixture: the 2026-08-13 residue of PR #680's
  driver deletions (stale `standards/jsdoc-documentation.inventory.jsonc`
  rows, retired-list-papered pending changesets, untracked artifact
  dirs). `delete-package --check` (doctor) must fail on it; fixing that
  residue lands with P1 as the command's acceptance test.
- Naming is settled: `apps/labs/*`, glossary term "lab app" — NOT
  "experiments", which doctrine 11 already uses for feature-flag-gated
  experiments.
