# Text-Knowledge Stack Rebuild

## Status

Lifecycle: `paused`

**Paused by operator ruling (finish board, 2026-11-13).** Very large ten-phase program with no implementation started; set to paused until resourced rather than leaving active. No lane is working on it; resume with `bun run beep goals set-status text-knowledge-stack-rebuild active` when it is picked up. Decision: [`decisions/2026-11-13-finish-board-ruling-pause.md`](./decisions/2026-11-13-finish-board-ruling-pause.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Redesign and rewrite the foundation text-knowledge stack (identity, text anchoring, annotation, taxonomy, claims, operations, RDF interchange, agent surface) as eight lawful layers in a dependency DAG: design first, rewrite the layers bottom-up and cut consumers over as each lands, retire what they replace.

The program took this shape after the operator's 2026-11-09 ruling that
breaking changes are acceptable: the consumer census is P0's work list rather
than a late gate, and the office-action flow is the standing acceptance test
from P3 on. `SPEC.md` is normative.

Authored directly on 2026-11-08 from the operator's request to challenge
`@beep/identity`, `@beep/provenance`, `@beep/rdf`, `@beep/epistemics`,
`@beep/ontology` and `@beep/nlp` from first principles (cohesive, semantically
accurate, architecturally sound, ontologically grounded, composable,
theoretically modelable; category theory kept where it predicts a law; built
for rigorous law-practice work and for tools agents can use) and the resulting
rebuild report ([`research/2026-11-08-rebuild-report.md`](./research/2026-11-08-rebuild-report.md),
revision 2 after three adversarial critiques, with revision-3 corrections from
the PR #2993 review). No source exploration; the parked
[`knowledge-endgame`](../../explorations/knowledge-endgame/README.md)
exploration supplies three of the vision laws the design keeps.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/text-knowledge-stack-rebuild/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth: objective, relationships
   to neighbouring packets, constraints, the resolved questions P0 confirms,
   acceptance per layer, the verification matrix.
3. [`PLAN.md`](./PLAN.md) - active execution plan: design, six layer phases,
   cut-over, yeet, close, with observable exit criteria.
4. [`decisions/`](./decisions/) - the program shape, the breaking-changes
   ruling and the resolved questions, projected into `SPEC.md`.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing; its
   `researchReports` array is generated from `research/` by
   `bun run beep goals manifest --write`, never hand-edited.
6. [`research/2026-11-08-rebuild-report.md`](./research/2026-11-08-rebuild-report.md) -
   the design: vision invariants, diagnosis D1-D8, research grounding, the
   eight layers with schema sketches, names, the law catalogue (rows `L0-1` to
   `L6-2`), the DAG and path, what the critics refuted. Figures in
   [`research/figures/`](./research/figures/).
7. [`research/law-test-plan.md`](./research/law-test-plan.md) - the ledger that
   turns every catalogue row into a named test or a recorded deletion.
8. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger: in-repo
   bricks, external papers, cross-links.
9. [`research/`](./research/) - the four reader audits and three critic
   reviews the report rests on.
10. [`history/`](./history/) - evidence and closeouts, when present.

## Current Phase

P0 Design and grill, not started. Next action: run `/grill-with-docs` over
`SPEC.md` "Resolved Questions and P0 Design Items", confirm or reverse each
resolved question by decision file, write `research/consumer-census.md`, and
rewrite the section 4 schema sketches as a `tsrs`-checked module.

## Latest Evidence

2026-11-09: PR #2993 reviewed by CodeRabbit and an eight-role, three-provider
reviewer panel (Codex, Grok, Claude); the design corrections and packet fixes
are recorded in the report's revision-3 note, `research/OPPORTUNITIES.md` and
the decision files. No package code has changed.

## Notes

- The report's first revision was refuted on five points and the design
  moved: anchor identity is occurrence-first (the `cm1:` preimage
  generalized), not quote-first; annotation content and attribution are
  separate; evidence signals have no algebra; admission is approval for a
  stated use with a grounding witness, not a move into truth; status is a
  product of owner-declared coordinates. Do not re-propose the refuted forms
  (report section 9.1).
- The 2026-11-09 review added: the occurrence preimage binds the whole text
  capture including extractor and normalization pins; the annotation document
  carries an `anchors` table; attribution is run-specific `Generation`
  records; the OA codec has a declared profile; `@beep/nlp-processing` already
  exists.
- The 2026-10-21 split, the `ClaimLifecycle` promotion and the verdict law
  are inputs, not questions.
- Fixtures are synthetic or public. Corpus and client material stay out of
  the repository.
