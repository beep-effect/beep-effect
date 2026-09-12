# Effect Schema Parity

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Effect main keeps absorbing things `@beep/schema` hand-rolls, and the repo's
schema usage was written against older RCs. Build a queryable knowledge layer
over effect's schema surfaces, audit every `effect/Schema` usage in the repo
against it, delete every `@beep/schema` concept whose intent upstream now
covers, and leave a standing gate so parity holds on every effect bump.

## Next Open Question

Align: ratify or revise the 11 pre-research decisions against `RESEARCH.md`.
The two that research put in tension: LiteralKit is the largest retirement
(536 consumers) and a standing repo rule; six concepts are covered only by
Role B modules that the module-roles decision excludes as targets. Frontier is
in `ops/manifest.json` `openQuestions`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): original brief, verified facts, module roles, upstream hint list.
3. [`DECISIONS.md`](./DECISIONS.md) - pre-research grill (2026-09-12); ratify at align.
4. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-09-12: packet opened from WebStorm scratch `scratch_65.md`; capture
  filed; `/grill-with-docs` pre-research round settled 11 decisions (see
  `DECISIONS.md`). Stopped before research.
- 2026-09-12: research done. Six Codex lanes (`gpt-6-astra`, medium) wrote
  `research/`: symbol inventory (2,105 rows / 14 modules), retirement audit
  (137 concepts: 52 retire / 2 adapt / 77 keep / 6 unsure), 30 idiom
  families, 28-commit delta (5 adopt / 8 migrate / 14 noop; the one
  retire-lead withdrawn as `@internal`), measured type-check baseline, gate
  plumbing. graft index built at the effect checkout. `RESEARCH.md` maps it;
  stage advanced to align with a 10-question frontier. Inventory verifier
  reconcile pending (single-writer lane).
