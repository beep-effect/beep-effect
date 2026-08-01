# P0–P2 evidence — identity-iri-fold

Date: 2026-08-01. Executor: Claude (Fable). Branch: `feat/identity-iri-fold`
(stacked on `docs/identity-iri-fold-grill-decisions`, PR #530).

## P0 — contract and donor audit

- Donor recovery: the effect-only fold prototype exists only at commit
  `61160e1baf` (`scratchpad/identity/{Ontology,Projections}.ts`, 591+376 LOC,
  plus 6 test files); recovered via `git show` into the session scratchpad and
  merged with the checked-in `assets/ontology-prototype/` schema-first donor
  (Markdown projection, SKOS semantics). Old authoring API stayed dead.
- Identity shape-stable baseline: 6 files / 64 tests green before any edit.
- FOLIO migration inventory: 31 borrowed-identifier annotations in
  `Ontology.models.ts` — 10 rdfs, 4 owl, 13 skos, 3 legacy-DC, 1 MADS.
  Two of the owl sites (`owl#Class` on `iri`, `owl#ObjectProperty` on `iri`)
  are type markers, not predicates → migrated vocab-less.
- Coexistence audit: zero external consumers of `@beep/ontology` (the
  `packages/ontology/*` matches are the workbench slice `@beep/ontology-*`);
  FOLIO models and semantic-foundation M1 taxonomy surface preserved
  untouched; barrel extended additively.
- Compile baselines (tsbuildinfo cleared, `tsc --extendedDiagnostics`):
  identity 29,847 types / 154,604 instantiations; ontology 29,649 types /
  65,300 instantiations.

## P1 — fold and projections

- `@beep/identity`: additive `key`/`class` composer methods; borrowed
  predicates ride the `ontologyTerm` annotation channel, the SKOS marker
  rides `skosClassification` (module augmentation for typed reads). Effect-only
  discipline held (`effect` remains the only dependency). Shape-stable
  `composerFunctionProperties` extended to pin both methods. 73/73 tests,
  dtslint 13 tests / 47 assertions green (including `"skos:prefLabl"` and
  unknown-prefix compile-error assertions).
- `@beep/ontology`: `Fold.models.ts` (schema-first predicate-open
  `AssembledOntology`/`AssembledClass`/`AssembledPredicate`/`AssembledFact`,
  `TripleValue` runtime tuple grammar, `LiteralKit` reason domain +
  `TaggedErrorClass` diagnostics ledger), `Fold.assembly.ts` (propose → gate →
  record; AST datatype/object inference; boundary IRI decodes, no `as` casts;
  SKOS integrity gate: S13/S14 label rules + hierarchy cycle/contradiction
  hard-fail, scheme-membership/prefLabel/related-duplicates warnings
  observable), `Fold.projections.ts` (`toContext`/`toJsonLd` with `@reverse`,
  `toTurtle` with PN_LOCAL-safe locals + full-IRI fallback),
  `Fold.markdown.ts` (portable/obsidian link modes, IRI-slug anchors).
- Inference precision (found by the FOLIO acceptance test): class handles must
  be object-shaped — annotated scalar schemas (`FolioIriToken`) no longer
  masquerade as object ranges; property-less record ASTs count as datatype
  payloads.
- Tests: 35/35 in `@beep/ontology` — ported donor semantic assertions
  (round-trip facts, struct-key defaults, `@reverse`, Turtle escaping +
  unsafe-local fallback), SKOS gate suite, all four ratified negative fixtures
  (equal-label distinct resources unfolded; ambiguous bare mention → typed
  `unknownTerm`; reversed hierarchy → typed `skosIntegrity` naming both IRIs;
  byte-identical repeated assembly across all four projections), rebase
  hash-namespace fixture (`https://opip.law/ns/patent#`).

## P2 — FOLIO migration, vocab codegen, deprecations, compile budget

- FOLIO sweep: 28 borrowed identifiers → `$I.key({ term, title, … })`,
  3 vocab-less (2 owl type markers + MADS `country`, documentation URL kept),
  `parent_class_of` → `"^rdfs:subClassOf"` (direction bug now
  unrepresentable). `rg 'identifier: "https://'` finds zero legacy forms; the
  sweep patterns no longer match, so a second run is a no-op by construction.
  The migrated `OWLClass` folds and renders through all four projections
  byte-identically (acceptance test in `Fold.test.ts`).
- Vocab single-sourcing: new `sync-data-to-ts` target `vocab-terms` generates
  `@beep/rdf/src/Vocab/generated/{Rdf,Rdfs,Skos,Owl,Dcterms}.terms.ts`
  (+ canonical JSON) from identity `CoreVocab` — 187 terms / 5 namespaces;
  hand-authored Vocab modules re-export the inventories and keep their curated
  named-node constants; `--check` gate green. Deviation from plan, conservative
  direction: `VocabDrift.test.ts` KEPT (it now proves generation fidelity at
  test time) in addition to the `--check` gate, rather than replaced.
- `SemanticSchemaMetadata`: `canonicalIri`/`preferredPrefix` annotated
  deprecated (annotation-only; zero writer churn — the audit found zero
  production users of the address fields).
- cspell: no cspell pragma or violations exist in the current
  `Ontology.models.ts`; the SPEC's "existing cspell cleanup" had nothing left
  to clean.
- Compile budget after (same method): identity 30,255 types / 155,640
  instantiations (+1.4% / +0.7% — negligible); ontology 51,283 types /
  114,523 instantiations (+73% / +75% relative, absolute check time
  0.060s → 0.091s, memory 239MB → 262MB). The growth is the fold's own schema
  surface; no downstream blow-up observed.

## P3 verify attribution (2026-08-01)

- `@beep/box:build` TS2589 in the full forced verify: load-flake at the
  instantiation edge — three consecutive forced standalone builds pass with
  zero errors after the composer `key` overload was de-genericized
  (`fix(ontology): satisfy repo proof lanes for the fold`). `@beep/ui` and
  `@beep/xai` checks confirmed clean the same way.
- `@beep/repo-cli` `architecture-operation-plan.test.ts` ENOENT on
  `20260801021411_usage_record_optional_activity/migration.sql`: **inherited**
  from origin/main PR #527 (merged 2026-08-01 by a concurrent session), which
  added the db-admin migration without syncing the architecture proof
  fixture. Reproduces on a clean checkout of main; nothing in this branch's
  diff touches db-admin or the Architecture command. Reported as a separate
  task; hosted required checks gate this PR per repo law.
