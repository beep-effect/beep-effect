# Identity IRI Fold Spec

## Objective

Join the shipped literal-typed identity/IRI core to a repopulated ontology
layer through nominal `$I.key`, `$I.class`, and `$I.ontology` entrypoints. The
ontology fold accepts schema-validated triples-as-tuples, resolves schema
handles/CURIEs/absolute IRIs, infers datatype versus object properties from
schema ASTs, gates assembly through typed diagnostics, and returns an
`AssembledOntology` with pure JSON-LD, JSON-LD context, Turtle, and Markdown
projections. Migrate the FOLIO `Ontology.models.ts` annotations under the same
contract with idempotent sweeps.

## Non-Goals

- No `Fibered` kit, `JSDocTagDefinition.make` migration, `IdentityRegistry`,
  Oxigraph/store layer, or SHACL projection; those remain in
  `identity-iri-fibered`.
- No resurrection of `Ontology.create`, `createOntologyIdentity`, string refs,
  runtime draft sniffing, or synonym methods such as `parent`/`exact`/`sameAs`.
- No independent inline `is:` implementation. It may ship only as strict sugar
  over the same tuple grammar, assembly walk, and diagnostics ledger.
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

- `packages/foundation/modeling/identity` — composer-facing nominal
  `$I.key`/`$I.class`/`$I.ontology` surface, without breaking the shipped core.
- `packages/foundation/modeling/ontology` — fold, assembly model/error taxonomy,
  profiles, pure projections, public barrels, fixtures, and tests.
- `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts` only for the
  ratified address-field deprecation/layering needed by the fold.
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
4. Fold-first is binding. Inline `is:` is later strict desugaring only and must
   share tuple validation, assembly, and diagnostics exactly.
5. Assembly follows propose → gate → record. Unresolved handles and hard SKOS
   failures become typed `OntologyAssemblyError` variants; warnings remain
   observable. Once assembled, projections are pure and total.
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

- [ ] Nominal `$I.key`, `$I.class`, and `$I.ontology` entrypoints have distinct
      schema-validated payloads; no overload sniffing or string-ref wrappers.
- [ ] Tuple grammar accepts every ratified endpoint kind, rejects unknown CURIEs,
      and infers datatype/object properties from representative schema ASTs.
- [ ] Assembly error/warning fixtures prove propose → gate → record, unresolved
      handle failures, SKOS profiles, inverse predicates, and deterministic output.
- [ ] One FOLIO-derived module renders through JSON-LD, context, Turtle, and
      Markdown; repeated assembly/projection is byte-identical.
- [ ] All four FOLIO migration contracts land through an idempotent sweep, with
      no borrowed predicate left in the owned `identifier` channel.
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
| Repo quality | `bun run beep yeet verify` | Green or unrelated failure attributed |

## Stop Conditions

- The shipped identity-core contract must change incompatibly.
- Tuple grammar or diagnostics would diverge between authoring channels.
- A FOLIO predicate cannot be mapped without new domain authority.
- Work requires Fibered, store, SHACL, dependency, auth, infra, or migration
  scope outside this spec.

## Decision Log

- D1–D9 are locked in the handoff; D7 was resolved fold-first, inline only as
  strict sugar, in the exploration decisions.
- Packaging is pure core/runtime downstream; address metadata is layered; the
  strict sequence is core → fold → fibered.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
