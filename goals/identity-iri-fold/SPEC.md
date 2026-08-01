# Identity IRI Fold Spec

## Objective

Join the shipped literal-typed identity/IRI core to a repopulated ontology
layer through a split authoring surface: nominal `$I.key` and `$I.class`
composer methods in `@beep/identity` (effect-only annotation writers over the
in-package `Predicate` literal type), and one fold entrypoint
`Ontology.fold($I, { label, schemas, triples })` in `@beep/ontology`. The
fold accepts schema-validated triples-as-tuples, resolves schema
handles/CURIEs/absolute IRIs, infers datatype versus object properties from
schema ASTs, gates assembly through typed diagnostics, and returns a
predicate-open `AssembledOntology` (subject/predicate/object facts with a
reverse marker — never enumerated relation fields) with pure JSON-LD, JSON-LD
context, Turtle, and Markdown projections. Migrate the FOLIO
`Ontology.models.ts` annotations under the same contract with idempotent
sweeps, and single-source the shared vocabulary term inventories from the
identity registry.

## Non-Goals

- No `Fibered` kit, `JSDocTagDefinition.make` migration, `IdentityRegistry`,
  Oxigraph/store layer, or SHACL projection; those remain in
  `identity-iri-fibered`.
- No resurrection of `Ontology.create`, `createOntologyIdentity`, string refs,
  runtime draft sniffing, or synonym methods such as `parent`/`exact`/`sameAs`.
- No inline `is:` channel. Per the 2026-07-31 exploration decision it is not
  planned — not merely deferred — and returns only on concrete diff evidence
  from a real authored module, under the original bar: same tuple grammar,
  same assembly walk, same diagnostics ledger.
- No enumerated SKOS profile payloads. SKOS relations and labels ride the
  tuple grammar; the opt-in `$I.class` payload carries only a classification
  marker (`skos: "concept" | "conceptScheme"`).
- No runtime-computed identities, IRIs, or CURIEs; static literals remain
  grep-harvestable.
- No general version fibers, new graph-store decision, or unrelated ontology
  domain expansion.

## Source Hierarchy

1. The ratified 2026-07-14 fold graduation and locked
   [`identity-iri-fibration-handoff.md`](../../explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md)
   D1–D9.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. Exploration [`BRIEF.md`](../../explorations/identity-as-iri/BRIEF.md),
   [`DECISIONS.md`](../../explorations/identity-as-iri/DECISIONS.md),
   [`MAP.md`](../../explorations/identity-as-iri/MAP.md), and research.

## Target Surfaces

- `packages/foundation/modeling/identity` — additive nominal `$I.key` and
  `$I.class` composer methods (effect-only; `ontologyTerm` annotation channel),
  without breaking the shipped core; shape-stable and dtslint suites extended.
- `packages/foundation/modeling/ontology` — `Ontology.fold` entrypoint,
  assembly model/error taxonomy, classification markers, pure projections,
  public barrels, fixtures, and tests, coexisting with the FOLIO models and
  the semantic-foundation M1 taxonomy surface (no deletions).
- `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts` only for the
  ratified address-field deprecation/layering needed by the fold.
- `packages/foundation/modeling/rdf/src/Vocab/*` — shared-five term
  inventories (`rdf`/`rdfs`/`skos`/`owl`/`dcterms`) regenerated from the
  identity `CoreVocab` registry via a `sync-data-to-ts` target; curated
  named-node constants stay hand-authored and byte-untouched.
- `packages/foundation/modeling/ontology/src/Ontology.models.ts` — FOLIO
  annotation migrations and existing cspell cleanup in the same sweep.

## Constraints

1. `identity-iri-core` is a satisfied completed-retained dependency. Preserve
   its shape-stable composer contract, authority `https://ns.beep.sh/`, literal
   `.iri`/`.curie` types, vocab registry, and interning behavior.
2. D4–D6 are binding: references are schema handles, known CURIEs, absolute IRI
   literals, or typed literals; predicates use the composer’s closed CURIE type;
   relational facts are `[Subject, Predicate, Object]` tuples; property kind is
   inferred from the AST.
3. `$I.key` defaults owned local names from struct keys and writes borrowed
   predicates through a dedicated `term` annotation channel. Owned `identifier`
   annotations never carry borrowed vocabulary (D5/D9).
4. Fold-only is binding. The inline `is:` channel is not planned (2026-07-31
   decision); the fold is the single authoring channel for relational facts.
5. Assembly follows propose → gate → record. Unresolved handles and hard SKOS
   integrity failures (S9/S13/S14/S27) become typed `OntologyAssemblyError`
   variants; scheme-membership and hierarchy warnings remain observable. Once
   assembled, projections are pure and total. The assembled model is
   predicate-open: facts are subject/predicate/object records with a reverse
   marker, and the SKOS gate filters facts by predicate rather than reading
   enumerated fields.
6. Turtle uses safe PN_LOCAL escaping or full-IRI fallback; JSON-LD inverse
   predicates emit `@reverse`; Markdown anchors derive from identity slugs.
7. FOLIO migration contracts are mandatory and idempotent: borrowed
   `identifier` → `$I.key`, `parent_class_of` → `^rdfs:subClassOf`, legacy DC →
   `dcterms:*`, and the bad MADS `country` anchor → vetted term or vocab-less.
8. `SemanticSchemaMetadata` remains the documentation payload layer;
   composer-derived `iri`/`curie` own addressing. Deprecate duplicate address
   fields without broad writer churn.
9. Effect-first/schema-first/JSDoc laws apply; use package aliases in tests and
   preserve unrelated worktree changes.

## Acceptance Criteria

- [ ] Nominal `$I.key` and `$I.class` composer methods plus the
      `Ontology.fold($I, …)` entrypoint have distinct schema-validated
      payloads; no overload sniffing or string-ref wrappers.
- [ ] Tuple grammar accepts every ratified endpoint kind, rejects unknown CURIEs,
      and infers datatype/object properties from representative schema ASTs.
- [ ] Assembly error/warning fixtures prove propose → gate → record, unresolved
      handle failures, the SKOS integrity gate, inverse predicates, and
      deterministic output.
- [ ] One FOLIO-derived module renders through JSON-LD, context, Turtle, and
      Markdown; repeated assembly/projection is byte-identical.
- [ ] A `rebase`d hash-namespace fixture (`https://opip.law/ns/patent#…` style)
      renders through all four projections as a golden file.
- [ ] Negative fixtures pass: equal-label distinct resources survive unfolded;
      an ambiguous mention yields a typed unresolved diagnostic; a reversed
      SKOS hierarchy direction is rejected by the gate; repeated identical
      assembly is byte-identical.
- [ ] All four FOLIO migration contracts land through an idempotent sweep, with
      no borrowed predicate left in the owned `identifier` channel.
- [ ] The shared-five vocabulary term inventories are generated from the
      identity `CoreVocab` registry with a `--check` drift gate; curated
      named-node constants and their consumers are byte-untouched.
- [ ] Existing identity shape-stability tests and relevant identity/rdf/ontology
      package tests, check, lint, and docgen remain green.
- [ ] No Fibered/registry/store/SHACL scope or unrelated churn lands.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher | `test "$(wc -m < goals/identity-iri-fold/GOAL.md)" -le 4000` | Pass |
| Manifest | `jq . goals/identity-iri-fold/ops/manifest.json` | Pass |
| Package proof | Focused identity/rdf/ontology check, lint, test, docgen | Green |
| Fold determinism | Repeated fixture assembly and all projections | Byte-identical |
| Migration sweep | Focused FOLIO tests + search for legacy forms | Idempotent; no stale borrowed identifiers |
| Compile budget | `tsc --extendedDiagnostics` before/after on `@beep/ontology` + one heavy downstream consumer (identity-iri-core P2 methodology) | Deltas recorded in packet evidence; no unexplained blow-up |
| Vocab generation | `sync-data-to-ts` vocab target `--check` | No drift; curated constants byte-identical |
| Repo quality | `bun run beep yeet verify` | Green or unrelated failure attributed |

## Stop Conditions

- The shipped identity-core contract must change incompatibly.
- Tuple grammar or diagnostics would diverge between authoring channels.
- A FOLIO predicate cannot be mapped without new domain authority.
- Work requires Fibered, store, SHACL, dependency, auth, infra, or migration
  scope outside this spec.

## Decision Log

- D1–D9 are locked in the handoff; D7 was resolved fold-first in the
  exploration decisions, then hardened 2026-07-31: the inline `is:` channel is
  not planned.
- Packaging superseded 2026-07-31 (exploration DECISIONS): split surface —
  `$I.key`/`$I.class` composer methods in `@beep/identity`; fold, assembly,
  errors, and projections in `@beep/ontology` behind `Ontology.fold`. Address
  metadata is layered; the strict sequence is core → fold → fibered.
- SKOS collapsed into the fact channel 2026-07-31: classification marker on
  `$I.class`, integrity gate over facts; enumerated profile models stay dead.
- Donor provenance: the effect-only fold prototype
  (`scratchpad/identity/{Ontology,Projections}.ts`, 27/27 tests) exists only
  at commit `61160e1baf`; the checked-in
  `explorations/identity-as-iri/assets/ontology-prototype/` tree supplies
  schema-first idioms, the Markdown projection, and SKOS integrity semantics.
  Port merges both; the old authoring API stays dead.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
