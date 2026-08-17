# Lab Apps Lifecycle

## Status

Lifecycle: `completed-retained`

All seven phases complete, closed out 2026-08-17. Final work shipped in
[#756](https://github.com/beep-effect/beep-effect/pull/756) (`5ec933e8e2`);
earlier phases in #722 (P0), #723 (P1), #732 + #742 (P2), #752 (P3).

Latest evidence: [`history/p4-first-vertical-slice.md`](./history/p4-first-vertical-slice.md)
is the round-trip record, [`history/reflections/2026-08-17-claude.md`](./history/reflections/2026-08-17-claude.md)
the closeout reflection, and [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md)
carries eleven friction receipts — of which **receipt 9 is a live defect in
shipped tooling**: `beep delete-package`'s default path cannot complete on a
tree with any failing test, because its baseline rebuild runs the repo-wide
coverage suite, and it removes the package before discovering that.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Law-abiding experimental apps under `apps/labs/*` — minted by
`bun run beep create-package` variants (nextjs, vite, service, tauri) — plus
a `beep delete-package` command that fully prunes a
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

P2 Implement apps/labs substrate and v1 variants: the one-time
`apps/labs/*` glob + gate-scoping PR (exactly the fourteen ratified edits
in `research/12-p0-gate-scoping-ratified.md`), the lab manifest schema +
`beep labs list`, vite + service AppKinds, GLOSSARY "lab app", the
promotion runbook, and the trustgraph-ts workbench lab shell.

## Latest Evidence

P1 complete 2026-08-16 (PR #723, `e97f73be44`): `beep delete-package` with
doctor mode on the `RegistrationGeometry` substrate, identity removal +
orphan-composer lint, and the synthetic #680 residue fixture — see
[`history/p1-implementation-notes.md`](./history/p1-implementation-notes.md).
P0 complete 2026-08-14 (PR #722): census ratification, geometry design, and
the ratified gate-scoping list under [`research/`](./research/).

## Notes

- Two tracks, one packet (operator-ratified): delete/geometry first, labs
  second, tauri last. Split tripwire: if either track grows a second
  primary, supersede the phase into a sibling packet
  (`ci-fleet-endgame` precedent) — do not widen this one.
- Doctor's P1 acceptance fixture is SYNTHETIC: a test constructs the
  residue classes catalogued from PR #680's deletions (stale inventory
  rows, orphaned pending changesets, leftover identity composer,
  untracked artifact dirs — `research/05` §0 / Appendix A) and asserts
  `delete-package --check` reports each. Review-verified 2026-08-13: the
  live residue was machine-local and has since been cleaned, so ambient
  tree state is never the fixture.
- Naming is settled: `apps/labs/*`, glossary term "lab app" — NOT
  "experiments", which doctrine 11 already uses for feature-flag-gated
  experiments.
