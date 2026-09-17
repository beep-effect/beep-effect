# Effect Schema Parity

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Effect main keeps absorbing things `@beep/schema` hand-rolls, and the repo's
schema usage was written against older RCs. Build a queryable knowledge layer
over effect's schema surfaces, audit every `effect/Schema` usage in the repo
against it, delete every `@beep/schema` concept whose intent upstream now
covers, and leave a standing gate so parity holds on every effect bump.

## Next Open Question

Graduated 2026-09-15 into [`goals/effect-schema-parity`](../../goals/effect-schema-parity/README.md).
This packet stays as provenance. Re-entry gates live in `MAP.md` §Later
Candidates: an F05 / F06 / F04 probe clearing confidence 0.70, or a
boundary-table row that is not byte-identical, reopens the packet at
decompose.

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
- 2026-09-14: align done. Ten frontier questions settled in two rounds:
  LiteralKit retires (helpers are ergonomics); Role B modules may be
  retirement targets; the selective-statics goal ships first, then statics
  retire; wire shape per boundary in a SPEC table; case brands retire; keep
  reports, scripts and inventory, drop three regenerable receipts (done in
  this commit); three-package instantiation baseline as the perf gate;
  doctrine PR ahead of the goal; gate cut = confidence >= 0.70 and >= 100
  files (F01, F03, F13, F24, F26 correction; F15 after the goal); inventory
  moves to a repo-cli per-RC fixture with a generator and `--check`.
- 2026-09-14: shape done. `BRIEF.md` drafted and confirmed in one review
  loop; PR batching revised to a six-phase train (doctrine → knowledge
  layer → LiteralKit codemod → retirement train → gate cut → statics + perf
  close); appetite = six phases before the next RC bump. Stage advanced to
  decompose.
- 2026-09-15: decompose done. `MAP.md` written: one goal, six phases as the
  sequencing, P3 grouped into seven retirement groups by upstream target,
  first slice = P0 + P1. Capability check verified against the worktree;
  five NET-NEW claims downgraded (type-check ratchet extends
  `quality check-census`, codemod reuses ts-morph plus the jsdoc-migrate
  apply pipeline, occurrence identity ports the effect-vitest shape,
  generator is a MOVE of `research/tools`, `literal-kit-const-assertion`
  retires with the kit). Definition-of-ready passes; stage stays decompose
  until the user confirms the map and the branch.
- 2026-09-15: decision reopened at decompose (loop to align and back). A
  static-facet census showed LiteralKit's keyed API is the product, not
  ergonomics; `/grill-with-docs` settled 14 items in four rounds: LiteralKit
  and MappedLiteralKit are ADAPT (retire Options, pick/omit, HashSet, thunk;
  drop enumMapping and the `M` parameter; override `rebuild`; keep Enum, is,
  $match, toTaggedUnion), doctrine judges intent per facet with a census
  gate on every RETIRE over 100 consumers, AGENTS.md line narrowed not
  replaced, F01 leaves the gate cut. DECISIONS, BRIEF and MAP re-cut; stage
  stays decompose, DoR still passes.
- 2026-09-15: graduated. `goals/effect-schema-parity` scaffolded from
  `goals/_template` (manifest, README, SPEC with phase contract, boundary
  table, facet census gate and back-linked decision log, PLAN with the P3 PR
  order, GOAL launcher, carried SOURCES, OPPORTUNITIES ledger). Manifests
  cross-linked; status `graduated`.
