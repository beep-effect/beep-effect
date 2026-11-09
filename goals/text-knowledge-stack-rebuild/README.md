# Text-Knowledge Stack Rebuild

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Redesign and rewrite the foundation text-knowledge stack (identity, text anchoring, annotation, taxonomy, claims, processing, RDF interchange, agent surface) as eight lawful layers in a dependency DAG: repair the lossy boundaries first, decide package folds by facet census.

Authored directly on 2026-11-08 from the operator's request to challenge
`@beep/identity`, `@beep/provenance`, `@beep/rdf`, `@beep/epistemics`,
`@beep/ontology` and `@beep/nlp` from first principles and the resulting
rebuild report ([`research/2026-11-08-rebuild-report.md`](./research/2026-11-08-rebuild-report.md),
revision 2 after three adversarial critiques). No source exploration; the
parked [`knowledge-endgame`](../../explorations/knowledge-endgame/README.md)
exploration supplies three of the vision laws the design keeps.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/text-knowledge-stack-rebuild/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth, including the five open
   questions P0 must resolve.
3. [`PLAN.md`](./PLAN.md) - active execution plan: design, seven layer phases,
   census, close.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing; its
   `researchReports` array is generated from `research/` by
   `bun run beep goals manifest --write`, never hand-edited.
5. [`research/2026-11-08-rebuild-report.md`](./research/2026-11-08-rebuild-report.md) -
   the design: vision invariants, diagnosis D1-D8, research grounding, the
   eight layers with schema sketches, names, the law catalogue, the DAG and
   path, what the critics refuted. Figures in
   [`research/figures/`](./research/figures/).
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger: in-repo
   bricks, external papers, cross-links.
7. [`research/`](./research/) - the four reader audits and three critic
   reviews the report rests on.
8. [`history/`](./history/) - evidence and closeouts, when present.

## Current Phase

P0 Design and grill, not started. Next action: run `/grill-with-docs` over
`SPEC.md` "Open Questions" and the nine rulings in report section 7, then
rewrite the section 4 schema sketches as a `tsrs`-checked module.

## Latest Evidence

2026-11-08: rebuild report revision 2 with three figures, four read-only
reader audits (law practice, modeling, agent surfaces, standards and vision)
and three adversarial critiques (theory, doctrine, product) landed under
`research/`. No code has changed.

## Notes

- The report's first revision was refuted on five points and the design
  moved: anchor identity is occurrence-first (the `cm1:` preimage
  generalized), not quote-first; annotation content and attribution are
  separate maps; evidence signals have no algebra; admission is approval for a
  stated use with a grounding witness, not a move into truth; status is a
  product of owner-declared coordinates. Do not re-propose the refuted forms
  (report section 9.1).
- Renames and folds are decided at P7 by a per-facet census. The lossy
  boundaries (handoff, defaults, array-order ids, auditless projection) are
  repaired first so the product keeps its evidence even if every fold is
  declined.
- The 2026-10-21 split, the `ClaimLifecycle` promotion and the verdict law
  are inputs, not questions.
- Fixtures are synthetic or public. Corpus and client material stay out of
  the repository.
