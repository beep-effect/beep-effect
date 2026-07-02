# Identity as IRI

## Status

Stage: `shape`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The identity path (`@beep/ontology/patent/Claim`) and the IRI
(`https://ns.beep.sh/ontology/patent/Claim`) should be two literal-typed
encodings of the same value: promote `IdentityComposer` into an IRI/CURIE
builder with borrowed RDF vocab baked in as literal types, replace the dead
`Ontology.create` API with a `$I.ontology` fold over triples-as-tuples, and
generalize the `JSDocTagDefinition.make` fibration pattern into a `Fibered`
kit for deterministic agent metadata retrieval.

## Next Open Question

Prototype COMPLETE (2026-07-02 01:54): `scratchpad/identity/` proves the
design end-to-end — Vocab literal types → CURIE codec → PN_LOCAL codec →
Composer (literal iri/curie, rebase, interning) → tuple grammar +
`$I.ontology` fold (D4/D5/D6/D9 enforced, AST datatype/object inference,
typed error taxonomy) → JSON-LD/@context/Turtle pure projections
(`@reverse` for `^curie`, full-IRI fallback for unsafe locals). 27/27 tests
green including the effect-only purity gate (~1.6K LOC). Guidance steps
10–12 (SHACL-as-data, IdentityRegistry index, drift canaries) are Phase-4
scope, intentionally not prototyped. NEXT: decompose stage — MAP.md naming
the goal packets (one per handoff phase) with the prototype as capability
evidence; also decide when to commit the working tree (~20 files
uncommitted). Deferred: authority host.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`assets/identity-iri-fibration-handoff.md`](./assets/identity-iri-fibration-handoff.md) - the authoritative design handoff (D1–D9).
4. [`assets/exploration-report-2026-07-01.md`](./assets/exploration-report-2026-07-01.md) - synthesized exploration report.
5. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
6. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
7. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
8. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-02 (01:54): prototype COMPLETE — resumed post-restart, fresh codex
  builders shipped `Ontology.ts` (fold, 591 LOC) and `Projections.ts`
  (JSON-LD/@context/Turtle, 360 LOC; builder self-healed 2 test failures);
  27/27 tests green, purity gate holds. The superseded
  `goals/ontology-modeling-foundation` GOAL mission (annotated schemas →
  JSON-LD/Turtle) is now demonstrated by the superseding design. Stopped
  at: decompose (MAP.md).
- 2026-07-02 (01:30, paused for PC restart): prototype build launched under
  `/goal` (treated as BRIEF approval; goal = superseded
  `goals/ontology-modeling-foundation` → redirect here). Codex builders
  shipped `scratchpad/identity/{Vocab,Curie,PnLocal,Composer}.ts` + tests —
  20/20 green, purity gate enforced. Fold builder (Ontology.ts) was in
  flight when paused; relaunch fresh. Then projections. All work
  uncommitted in the working tree.
- 2026-07-02: align completed in one grilling session — packaging seam (pure
  core in identity, runtime downstream), SemanticSchemaMetadata (layer +
  deprecate address fields), D7 (fold-first, inline as strict sugar), $I.key
  (struct-key only), IdentityRegistry naming, authority host DEFERRED; all in
  [`DECISIONS.md`](./DECISIONS.md). Applied the
  `goals/ontology-modeling-foundation` supersession (README/SPEC/manifest +
  `goals/README.md` index + interop-roadmap caveat). Drafted
  [`BRIEF.md`](./BRIEF.md); stage → `shape`. Stopped at: BRIEF review.
- 2026-07-01 (night): research stage completed — 3 spec docs
  ([`research/specs/`](./research/specs/)), 12 repo-mining reports
  ([`research/repos/`](./research/repos/), licenses verified, 3
  reference-only), 3 repo audits, synthesis
  ([`20`](./research/20-repo-mining-synthesis.md)) + adversarial review
  ([`21`](./research/21-synthesis-adversarial-review.md), 7 corrections
  accepted, license ledger clean), all folded into
  [`RESEARCH.md`](./RESEARCH.md) + [`SOURCES.md`](./research/SOURCES.md).
  Stopped at: align on packaging seam.
- 2026-07-01 (later): prototype home decided —
  [`scratchpad/identity/`](../../scratchpad/identity/README.md), effect-only
  imports enforced by test ([`DECISIONS.md`](./DECISIONS.md) pre-seeded);
  research fan-out running (3 spec-prose agents + 1 repo-audit agent).
- 2026-07-01: packet opened from the "Identity as IRI" scratch workspace;
  handoff + XML packet + prototype + exploration report captured into
  `assets/`; stage advanced to `research`; Codex fan-out launched for spec
  prose + repo audits.
