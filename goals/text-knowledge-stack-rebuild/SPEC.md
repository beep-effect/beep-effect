# Text-Knowledge Stack Rebuild Spec

## Objective

Rebuild the foundation text-knowledge stack so that every object the vision
names (source text, anchor, annotation, term, claim, activity) has one
denotation, one owner, and lawful arrows to its neighbours, and so that the
core is the best we can build rather than the least that breaks (operator
ruling of 2026-11-09, recorded in `decisions/`). The final state is observable:

1. Eight layers in a compile-time dependency DAG inside `foundation/modeling`
   plus two existing capabilities and one cross-cutting agent contract:
   identity (L0), text identity and anchoring (L1), annotation (L2), taxonomy
   and alignments (L3), claims (L4), operations (L5), RDF interchange (L6),
   agent surface (L7). Every edge is legal under `standards/ARCHITECTURE.md`
   layering (modeling depends only on primitive and modeling; capability is
   unreachable from a slice's `domain`).
2. One text identity: `OccurrenceId` (scope, source ref, locator, the whole
   `SourceTextIdentity` with its extractor and normalization pins, unit, range,
   quote) is the only occurrence identity in the repository. The citation
   mention identifier is re-expressed over it (`citation-mention/v2` hashes
   engine artifact, semantic kind and the `OccurrenceId`; no table stores the
   old `cm1:` values, and citation receipts convert on read); the five
   non-canonical anchor encodings are deleted. `Selector` is the one selector union beside the
   canonical `TextAnchor`; quotes locate and verify, ranges identify;
   re-anchoring across captures is a recorded `Exact | Widened | Unmapped` map
   and `resolve` returns `Unique | Ambiguous | NotFound`.
3. One standoff annotation model over a text capture, in `@beep/annotation`:
   `Annotation<K>` with a content hash over deduplicated sorted targets, kind
   and body; an `anchors` table from `OccurrenceId` to range, quote and
   receipt; attribution as run-specific `Generation` records (content entity,
   activity, time) kept outside the content hash. The langextract handoff mints
   verified receipts before it emits annotations and carries both digests,
   scope, extractor and normalization pins, producer, attributes and typed
   candidates; `IrToLaw` and the semantica projection read it; the handoff's
   `Entity`, `Relation` and `Provenance` types are deleted.
4. Claims restructured around an immutable hashed core with separate records:
   `Stance` (`verbatim | proposed | admitted`), `Challenge`, `Admission`
   (grounding witness and human token bound to actor, action, revision and
   scope), owner-declared `Assessments<K>` coordinates with caller-supplied
   value schemas, and the existing five typed signals with `Absent{reason}`
   and no default algebra. The invented certainty (`1` at the lab boundary,
   `0.9` in the office-action spike, the docket citation check that passes when
   an attached document's text is unavailable) is gone and guarded by named
   tests.
5. Term IRIs declared in the registry, never derived from code paths: a
   `TermBinding` table and a stability snapshot that a published IRI leaves only
   with a deprecation record; the registry expands every namespace the repo speaks (`prov:`,
   `oa:`, `nif:`, `xsd:`, `gufo:` and `as:` included); today's path-derived IRIs are
   re-published, not pinned. `@beep/identity` stays effect-only: it holds
   `Namespace` (prefix, IRI), `Term`, `TermBinding` and `Deprecation`; each
   external namespace's pin (source, license, version, digest) is a
   `NamespacePin` in `@beep/rdf`, and gUFO class typing is a record keyed by
   term IRI in `@beep/ontology`.
6. Codecs at every boundary, each in an adapter subpath so the base packages
   stay rdf-free: `TextAnchor <-> oa:` selectors in `rdf/src/Adapters/WebAnnotation.ts`,
   `AnnotationDocument <-> OA/NIF` for a declared OA profile (unattributed
   third-party input gets the import activity as attribution),
   `ClaimCore + records <-> nanopub` named graphs, `fold -> Dataset` as the only
   serialization path, `prov:Entity` projected through `rdf/src/Prov.ts`.
   `Dataset` is a set with equality up to blank-node isomorphism and a digest
   on the canonical form; `Literal` is `Simple | Typed | LangTagged`; no
   compatibility shim is written for the old list and the old literal.
7. The law catalogue (`research/2026-11-08-rebuild-report.md` section 6, rows
   `L0-1` to `L6-2`) is implemented row by row through the ledger
   `research/law-test-plan.md`: a property test for every `law` row, the test
   form the ledger names for `profile` and `acceptance` rows, each test titled
   with its row id, or a recorded deletion with its reason.
8. The doctrine exists: a knowledge-stack chapter under
   `standards/architecture/`, the nine rulings of report section 7 plus the
   scoped amendment to the persisted-bytes clause of chapter 11 as dated
   `DECISIONS.md` entries with reversal clauses, the glossary entries of report
   section 5, and `packages/foundation/modeling/nlp/THEORY.md` rewritten as a
   narrative that links each structural claim to its test.
9. One complete office-action flow runs end to end on synthetic fixtures with
   law-owned claim structure, per-authority-type assessment profiles and an
   attorney admission bound to actor, action and revision, and it stays green
   at every phase exit from P3 on.
10. Package topology is executed, not deferred: `@beep/text` replaces
    `@beep/provenance`, `@beep/annotation` exists, `@beep/nlp-processing`
    absorbs `nlp/Operations` and `nlp/Algebra`, `@beep/nlp` is retired, and
    `@beep/schema-org` is retired whole (census: no consumer), each through
    `bun run beep create-package` and the retirement procedure with the
    consumer migration in the same PR.

## Relationships

- `goals/attributed-multi-claim-span` (superseded; paused 2026-09-12 until this
  packet superseded it on 2026-11-09): L2 and L4 replace its attributed annotation aggregate and its
  LangExtract-to-ClaimGate proof, and its "preserve distinct confidence per
  claim" acceptance is withdrawn in favour of `Absent{reason}` and no default
  signal algebra. Its manifest records `supersededBy: text-knowledge-stack-rebuild`,
  and it stays retained on `main` until this packet's P4 acceptance item
  `ClaimGate.two-claims-one-occurrence.test.ts` is green, which demonstrates the
  replacement; only then is it archived.
  Its lexicog competency question (OntoLex `lexicog` as a mention-class
  vocabulary) is absorbed into P0's registry census as a candidate external
  vocabulary under the adapter rule, with no commitment to adopt it.
- `goals/belief-view-engine` (superseded 2026-11-13; re-openable) stays the selection policy over
  contention sets and becomes a downstream consumer of L4; triage policies
  here never cross an admission gate and never write authority.
- `explorations/citation-grounding-hallucination-guard` (parked) carries
  alignment question Q7, where a qualifier-aware stance layer lives and the
  minimum qualifiers before two claims may be compared. L4 `Stance` here is the
  admission workflow (`verbatim | proposed | admitted`) and does not decide
  Q7; that question reopens with that exploration's guard gate.
- `goals/citation-extraction-engine` (completed-retained) owned the citation
  identity module; P2 re-expresses the mention id over `OccurrenceId`, converts
  receipts on read, and records the change in that packet's history.
- `goals/spar-document-annotation-wire` (completed-retained) shipped the OA/PROV
  document annotations and the Markdown-to-DOCO section fold; L2 and L6 extend
  those codecs rather than replacing them.
- `goals/epistemics-foundation-extraction` (completed-retained) provides
  `foundation/epistemics-vocabulary`, which this packet requires.
- `explorations/knowledge-endgame` (parked) states three vision laws this
  design keeps; it is not reopened here.

## Non-Goals

- Overturning the 2026-10-21 ruling (`standards/architecture/DECISIONS.md`
  "Epistemic Vocabulary Is Foundation; Party Is A Product Slice; Propositions
  Are Slice-Owned"), the `ClaimLifecycle` promotion to `shared/domain`, or the
  verdict law (`standards/architecture/GLOSSARY.md` "Verdict"). This packet
  gives those rulings content; it does not reopen them.
- Legal semantics in foundation. Claim numbers, dependencies, rejections,
  pinpoints, legal roles, Hohfeld positions, docketing vocabularies and MPEP
  source IRIs are law-practice profiles and asset packs, never generic kinds.
- A universal claim state machine. Status is a product of owner-declared
  coordinates; the foundation supplies the shape and the laws, each owner its
  transitions.
- An algebra over the five evidence signals, blended scores, or provenance
  semirings outside a bounded derivation query with a stored provenance term.
- Compatibility shims: no old-wire codecs for internal shapes, no parallel
  persisted encodings, no projections kept alive for deleted carriers.
  Breaking public API or wire changes still ship with a major changeset
  (a decision file for a private workspace; see Delivery).
- Local-only or on-device architecture language. Hosted providers are
  welcome; the operator withdrew the local-first framing, and this entry
  records that ruling.
- Corpus or client material in the repository. Fixtures are synthetic or
  public; authorized private material runs only in the operational
  environment.
- OWL authoring with a reasoner (that remains the `packages/ontology/*`
  slice), gUFO typing of every registry term, or NIF and DoCO as internal
  kinds.

## Source Hierarchy

1. The operator's request of 2026-11-08 (challenge the stack from first
   principles and rebuild it to be cohesive, semantically accurate,
   architecturally sound, ontologically grounded, composable and theoretically
   modelable, keeping the category-theoretic grounding where it predicts a law)
   and the ruling of 2026-11-09 (breaking changes are acceptable; build the
   best core).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`schema-first-development`,
   `effect-first-development`, `grill-with-docs`, `yeet`, `closeout`,
   `reflect`).
3. `standards/ARCHITECTURE.md`, `standards/architecture/DECISIONS.md`,
   `standards/architecture/GLOSSARY.md`,
   `standards/architecture/11-evolution-and-deprecation.md`,
   `standards/architecture/08-testing.md`,
   `standards/architecture/09-errors-across-boundaries.md`,
   `standards/architecture/12-observability.md`,
   `standards/schema-first-development-prompt.md`,
   `standards/effect-first-development.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/2026-11-08-rebuild-report.md` (the design with its revision-3
   corrections), the reader audits and critic reviews beside it,
   `research/law-test-plan.md`, and `research/SOURCES.md`.

Higher sources outrank lower sources when they conflict. The report is design
input, not doctrine: where it and a standard disagree, the standard wins and
the disagreement becomes a decision file. Where the report and this `SPEC.md`
differ (its section 9.4 lists four questions and its section 7 path keeps the
critics' repair-first order; the resolved five questions are in `decisions/`
and the phase order is `PLAN.md`), this file is normative.

## Target Surfaces

- `packages/foundation/modeling/identity` (L0, effect-only: registry with
  `Namespace` as prefix and IRI, `Term`, `TermBinding`, `Deprecation`, the
  stability snapshot, the IRI schemas), with the L0 digest brands over the primitive in
  `packages/foundation/modeling/schema` and canonical JSON plus the one
  minting function in `packages/foundation/modeling/jsonc`.
- `packages/foundation/modeling/text` (`@beep/text`, L1: `Selector`,
  `OccurrenceId`, `QuoteKey`, `Resolution`, `Reanchoring`, `LocatorMap`, the
  two text normalizations and unit conversion; `TextAnchor` and
  `VerifiedTextAnchor` keep their shapes). P2 created it through
  `bun run beep create-package` and retired `packages/foundation/modeling/provenance`
  (`@beep/provenance`) per chapter 11, with every consumer migrated in the same PR
  and no alias.
- `@beep/annotation`, created in P3 through `bun run beep create-package`
  (L2) once P0 has recorded the specific-home-first routing decision and the
  capability negative-gate clauses (`standards/ARCHITECTURE.md`): pure schemas
  belong in `foundation/modeling`; the named consumers are the langextract
  handoff, the semantica projection and the law-practice office-action flow.
- `packages/foundation/modeling/nlp` (retired in P7 after L2 and L5 absorb it).
- `packages/foundation/capability/nlp-processing` (existing capability package,
  the L5 home: absorbs `nlp/Operations` and `nlp/Algebra` after the upstream
  census of `effect/Combiner` and `effect/Reducer`; its instrumentation shard
  already exists and is regenerated).
- `packages/foundation/modeling/epistemics` (L4: immutable core, `Stance`,
  `Challenge`, `Admission`, `Assessments<K>`, `epistemics/rdf` adapter).
- `packages/foundation/modeling/ontology` (L3: SKOS schemes, editions, SSSOM
  `MappingSet`, `fold -> Dataset`, optional gUFO class typing as a record
  keyed by term IRI; legal seeds and
  their seed data files move to the law-practice asset pack through
  `ontology/src/TaxonomyLoader.ts`; the FOLIO DTOs are deleted).
- `packages/foundation/modeling/rdf` (L6: `Dataset` quotient and digest,
  `Literal` cases, `TextAnchor <-> oa:` in `src/Adapters/WebAnnotation.ts`,
  `prov:Entity` projection through `src/Prov.ts`, registry-backed `prov:`,
  `oa:`, `nif:`, `xsd:`, `NamespacePin` (source, license, version, digest)
  for every external namespace; the `rdf -> md` edge removed).
- `packages/foundation/modeling/md`: the one AST source map, `@beep/md/Md.anchors`
  (`anchorAt`, landed in P2), which yields a `VerifiedTextAnchor` for a mapped,
  non-empty node. `pandoc-ast`, `lexical-schema` and `html` record no text
  positions; each gains a source map over `@beep/text` when a phase needs one
  (decision `2026-11-22-p2-ast-source-maps-md-only`).
- `packages/foundation/modeling/schema-org`: retired whole in P7 (census: no consumer).
- `packages/foundation/capability/langextract/src/Handoff` (verified receipts
  first, lossless handoff), `apps/labs/semantica/src/layers` (projection and
  the `1` default), `packages/law-practice/use-cases` (`OfficeActionReview`
  `0.9`, `DocketIntake/DocketReview.policy.ts` unavailable-text check,
  `IrToLaw` ports), `packages/law-practice/server/src/internal/Citation` and
  `packages/law-practice/domain/src/values/Citation` (the `cm1:` preimage and
  the receipt read-time transform), the law-practice asset pack that receives the legal seeds.
- `packages/tooling/test-kit/test-runner` pinned `test-utils` IRIs
  (re-published from the registry).
- `standards/architecture/` (new knowledge-stack chapter, `DECISIONS.md`
  entries including the scoped chapter-11 amendment, `GLOSSARY.md` entries),
  `docs/PROSE_TO_PROOF_VISION.md` (local-first posture, BeepGraph status),
  `packages/foundation/modeling/nlp/THEORY.md` (its narrative moves into the
  chapter, then the file is retired with the package), `standards/instrumentation-catalog/` shards for every package
  that gains spans.

P3 lane facts (2026-11-22): annotation documents and the checked handoff are
implemented; readings and residuals retain every parsed candidate, including the
over-extraction-cap tail. Semantica grounds historical unmapped-predicate
residuals for E5 replay without declaring those predicates. The deterministic
Tika scaffold declares text-scaffold/1. Handoff and Ontology facets and Graph
float spans are deleted; Graph nodes remain for P6. The phase is content-complete
in its lane, with no P3 PR opened.

## Constraints

- Effect v4 against the installed `effect` (4.1.5 at P3; validate every API in
  `.repos/effect`, never from priors). Schema first: plain data as branded
  `S.Opaque` with `$I` annotations, finite cases as discriminated unions
  (`S.TaggedUnion` for canonical `_tag` unions, `S.toTaggedUnion` for other
  discriminators), named literal domains as `LiteralKit` with no `as const`,
  carriers as `effect/HashMap` and `effect/HashSet`, effectful functions as
  `Effect.fn` or `Effect.fnUntraced` per `standards/effect-first-development.md`
  EF-14, recursive codecs as `S.suspend((): S.Codec<D, E> => ...)`. Generic
  builders may return schema ingredients for caller-owned `S.Opaque` classes,
  as `makeClaimEnvelope` does. The `.schema.ts` file role stays the default.
- Layering: `foundation/modeling` depends only on `foundation/primitive` and
  `foundation/modeling`; `identity` never imports `rdf`; `text`, `annotation`
  and `epistemics` stay rdf-free with codecs in adapter subpaths; capability
  packages import modeling, never the reverse. A new foundation package needs
  the specific-home-first decision and the capability negative-gate clauses
  recorded before `create-package` runs.
- Identity: one digest format (`sha256:<64 hex>`) for identifiers the eight
  layers mint (the bare `Sha256Hex` primitive is out of scope) with one brand
  per domain and a versioned domain tag in every preimage; canonical JSON (RFC 8785) sorts
  object keys only, so every set-valued field (`HashSet` targets, members,
  `supportAtCreation`) is sorted on the preimage before hashing and `L0-2`
  tests that two orderings of one set hash alike; the public authority is
  `https://beep-effect.com/ns/`; a changed preimage bumps its domain tag in
  the same PR, never kept beside a parallel encoding; where rows are stored
  the stored-format law of `standards/ARCHITECTURE.md` governs and the change
  is a read-time transform.
- Upstream first with a facet census before any local construct. Retirement
  follows `standards/architecture/11-evolution-and-deprecation.md` per facet,
  with the consumer migration in the same PR. The persisted-bytes clause of
  chapter 11 is amended for this program by a scoped `DECISIONS.md` entry that
  P0 drafts and that must be merged and effective on `origin/main` before the
  first dependent PR (P2) opens; until it merges the exception is proposed and
  the current chapter applies; chapter 11's promoted-contract (V2) protection
  stays operative unless separately amended. S31 (the standing ruling that the
  repo's exception inventories and allowlists never grow): for every inventory
  or allowlist named in `research/consumer-census.md`, the entry count at a
  phase head is at or below its count at the P0 base commit, with moved
  packages carrying entries by rename only.
- Evidence: `Absent{reason}` is information and never coerces to a number;
  no signal has a default; rankings are named, versioned triage policies
  tested on unknowns and ties that never cross an admission gate; an admission
  requires a non-empty grounding witness that verifies against the current
  text digest at admission time plus a human token bound to actor, action,
  revision and scope.
- Matter walls are authorization at every access path (retrieval, anchor
  resolution, graph query, search, cache, draft assembly, provenance
  traversal), never graph names; identical bytes in two matters never grant
  cross-matter access.
- External vocabularies enter as registry entries with source pin, license and
  digest, and as adapters: P1 registers prov, oa, nif, xsd, gufo and as, and
  pins the existing skos and doco entries; LKIF and ELI are candidates with no
  commitment. Internal kinds stay repo-stable.
- Every structural claim in a README or chapter links the law test that
  falsifies it; a law without a named bug is deleted, not kept. Tests use
  `@effect/vitest` (`it.prop` and `it.effect.prop` for law rows), import package
  source through `@beep/*` aliases, and never run under `bun test`.
- Observability: every package that gains spans names them `Concept(.Sub)*.action`
  per `standards/architecture/12-observability.md` and regenerates its
  instrumentation shard (`bun run beep observability catalog --write`); every
  `Operation` run emits a `prov:Activity`; span attributes carry ids, digests
  and counts, never quote or matter text.
- Error boundaries: `resolve` and `reanchor` return typed results
  (`Ambiguous`, `NotFound`, `Unmapped`, a refused admission and a failed
  re-verification are values, not errors); driver and
  internal errors die in adapters, port errors in use-cases, with dropped
  technical detail logged at the translation boundary.
- Delivery: at most three concurrently open PRs for this packet; each phase
  lands through Yeet (`yeet final-check` before `yeet ready`); a breaking
  public API or wire change ships with a major changeset when the package is
  public, and is recorded in a decision file of its phase when the package is
  private, since repo-sanity forbids a changeset for a private workspace;
  `bun run beep quality package-verify <pkg>` before every handoff;
  `bun run beep architecture` for any new slice, concept or role file; the
  office-action flow test stays green at every phase exit from P3 on.

## Resolved Questions and P0 Design Items

The five open questions of the first revision are resolved in
`decisions/2026-11-09-open-questions-1-5-resolved-toward-the-clean-core-p0-confirms-or-reverses.md`;
P0 confirms or reverses each by a decision file before the dependent phase.
P0 also settles, in the `tsrs`-checked design module (in a `design/` directory under this packet's `ops/`, registered in the
manifest's `opsScripts` and checked by `bunx tsrs -p goals/tsconfig.ops.json --noEmit`; if
`@beep/*` aliases do not resolve there, P0 records the alternative home by
decision file) and the law-test ledger:

1. The `cm1:` to `OccurrenceId` relation: the full citation tuple, which
   fields are occurrence identity and which are retained detection metadata,
   and the version step for receipts and fixtures that carry it.
2. `Assessments<K>`: the caller-supplied coordinate-to-value-schema registry,
   partial versus total carriers, absent and unknown semantics, owner-defined
   gates, and the census of the eight status vocabularies (coordinate,
   duplicate, projection).
3. The temporal partition for the interval law: owner binding, scope and
   `logicalKey`; half-open bounds; successor ordering; where local bound
   checks and disjointness checks live.
4. Target-set canonicalization (`HashSet`, deduplicate then sort before
   hashing), how occurrences resolve to the document's exact capture, and
   whether `restrict` keeps dependency closure, drops dependents, or refuses.
5. The routing decision for `@beep/annotation` and the law-practice asset
   pack, with consumers named.
6. `Generation` identity: the run entity is derived deterministically from the
   content id and the activity (its own brand, distinct from `AnnotationId`);
   generation time is canonical per `(content, activity)` pair; attribution
   uniqueness is by pair, not whole-record equality; merging two records for
   one pair with different times is a typed refusal; the join laws are stated
   over compatible documents.
7. The OA profile: the classes and properties the codec supports, which
   unknown triples are preserved, how an imported activity's identity and time
   are retained, and the imported-input law as equivalence to the normalized
   input (`encode(decode s) = normalize(s)` for third-party OA input `s`), carried into ledger row `L2-6`
   and its tests.
8. Where the runtime `IRI` schema lives: it used to live only in `@beep/rdf`,
   while `identity` must stay rdf-free and `@beep/schema` depends on
   `identity`. P0 ruled the home and P1 moved it to
   `packages/foundation/modeling/identity/src/Iri.ts`, before L0 and L1 compile.
9. `Anchored` is an L1 `S.Opaque` that holds the powerless
   `TextAnchorVerificationReceipt` and reads range and quote from its anchor
   (never a `VerifiedTextAnchor`, so decoding a stored document grants no proof;
   landed in P2 as `@beep/text/Occurrence`); the `anchors` table checks that each key
   equals the occurrence hash of its value; `Instant` is
   `S.DateTimeUtcFromMillis` or P0 records why not.
10. `derivedFrom`: whether it lives in the hashed core or a separate record;
    `L4-3` is restated over that graph plus the admitted-support relation, or
    its support half is deleted.
11. The matter wall: `research/consumer-census.md` maps each of the seven
    access paths in Constraints to its owning code and test layer, and P6's
    authorization work is scoped from that map.

## Acceptance Criteria

- [ ] P0: decision files confirm or reverse each resolved question; the
      section 4 sketches compile under `tsrs` as a checked module that follows
      the Constraints idioms (`S.Opaque` with annotations for non-factory data,
      correct discriminator constructors, `LiteralKit` without `as const`);
      `research/law-test-plan.md` lists every catalogue row with id, kind,
      owning package and planned test; `research/consumer-census.md` lists
      every facet the program moves, renames or deletes with the chapter-11 row
      schema (facet; consumed surface; upstream coverage that survives
      derivation; covered and uncovered consumer-line sums; neutral construction
      counts; lines and files per facet for large retirements; disposition
      retire, adapt or keep; a semantic-loss row where meaning changes), and
      each retire or adapt disposition with both sums is recorded in a decision
      file before its dependent PR opens; the routing decision for
      `@beep/annotation` is recorded; the knowledge-stack chapter and the nine
      rulings are drafted; the scoped chapter-11 amendment is merged on
      `origin/main` (in P0's PR or its own) before P2 opens, and P2 to P7 hold
      until it is.
- [ ] L0: `TermBinding` and the term-stability snapshot exist; a test renames
      a module and proves no published IRI changes; the registry expands and
      contracts `prov:`, `oa:`, `nif:`, `xsd:`, `gufo:` and `as:` CURIEs;
      `@beep/identity` still depends on `effect` only; one
      canonical JSON implementation; path-derived IRIs are gone and the
      test-runner's pinned IRIs are re-published from the registry; `L0-1` to
      `L0-3` are green.
- [ ] L1: `@beep/text` exists and `@beep/provenance` is retired with every
      consumer migrated; `Selector`, `OccurrenceId`, `QuoteKey`, `Resolution`,
      `Reanchoring` and unit conversion are exported from `@beep/text`; the
      citation mention identifier is minted over `OccurrenceId` and a frozen
      v3 receipt converts on read to the new identifiers; the rdf selectors and
      the party `TextSpan` case are deleted (the other three non-canonical
      encodings go in P3 and P4); `TextAnchor <-> oa:` round-trips in `@beep/rdf`; `L1-1` to
      `L1-6` are green, including the repeated-boilerplate, NFKC,
      de-hyphenation and split-surrogate fixtures.
- [x] L2: `@beep/annotation` exists with `makeAnnotationDocument` (anchors
      table, content map, `Generation` attribution), `merge`, `restrict` and
      containment; the langextract handoff mints verified receipts and emits
      annotations with both digests, scope, extractor and normalization pins,
      producer, attributes and typed `RelationCandidate`/`CorefCandidate`
      records; the handoff's `Entity`, `Relation` and `Provenance` types and
      the nlp Handoff and Graph spans are deleted; `IrToLaw` and the semantica
      projection read the annotation document; the OA/NIF adapter round-trips the declared profile and
      attributes unattributed input to the import activity; P3 creates
      `OfficeActionReview.flow.test.ts` in the law-practice use-cases tests
      over the annotation document on synthetic fixtures (P4 adds the signal
      assertions, P6 the law-owned structure, assessment profiles and
      admission); `L2-1` to `L2-6` are green.
- [ ] L4: `makeClaimCore`, `Stance`, `Challenge`, `Admission` and
      `Assessments<K>` exist; `makeClaimEnvelope`, `ClaimVersion` and
      `EvidenceSpan` are retired with every consumer migrated, and stored
      `epistemic_evidence.span` and `ClaimVersion` rows keep their bytes behind
      declared read-time transforms proved by frozen old-row fixtures; the `1` and `0.9` defaults are deleted and
      guarded by `OfficeActionReview.signals.test.ts` in the law-practice use-cases
      tests and `Extractor.signals.test.ts` beside `Extractor.test.ts` in the
      semantica lab tests; the docket
      citation check no longer passes when a document is attached but its text
      is unavailable: `DeterministicCheck` gains a three-valued result, the
      review gate treats unknown as not passed without hiding urgent tentative
      entries, the existing assertion in `DocketReview.policy.test.ts` is
      rewritten, and the guard is `DocketReview.unavailable-document-text.test.ts`
      beside `DocketReview.policy.test.ts` in the law-practice use-cases tests;
      the nanopub adapter round-trips in `NanopubAdapter.test.ts` under
      `packages/foundation/modeling/epistemics/test`;
      the status census names each of the eight vocabularies as coordinate,
      duplicate or projection; the absorbed attributed-span proof passes: two
      claims anchored on one verified occurrence pass through the claim gate with
      accepted and rejected evidence retained per claim, in
      `ClaimGate.two-claims-one-occurrence.test.ts` in the law-practice use-cases
      tests (the proof `goals/attributed-multi-claim-span` promised); `L4-1` to
      `L4-7` are green.
- [ ] L3 and L6: legal seeds and their seed data files move to the
      law-practice asset pack with IRIs and approval metadata preserved and
      every consumer migrated; the FOLIO DTOs are deleted;
      `fold -> Dataset` is the only serialization path; `Dataset` equality is a
      quotient with a canonical digest and the semantica gold fixture is
      regenerated; `Literal` has three cases; `rdf` no longer imports `md`;
      `MappingSet` has a coherence check; `SourceTextIdentity` projects to
      `prov:Entity` through `rdf/src/Prov.ts` with a round-trip test; a test in
      `@beep/rdf` asserts license and digest on every external namespace's
      `NamespacePin`; the gUFO class typing is a record in `@beep/ontology`;
      `L3-1` to `L3-4` and `L6-1` to `L6-2` are green.
- [ ] L5 and L7: `@beep/nlp-processing` holds `Operation` with
      `withActivity`, Kleisli laws hold under the declared observation, every
      run emits a `prov:Activity` and the package's instrumentation shard is
      regenerated; MCP tool schemas are the Effect schemas and write tools
      emit `proposed` records only, proven by a test in the package that hosts
      the write tools (named in P0); the office-action flow test created in P3
      is complete (law-owned claim structure, assessment profiles, attorney
      admission) and green; the two-matter adversarial fixture
      (`MatterWall.two-matter.test.ts` in the law-practice server tests,
      composing the real server layer, identical bytes in two matters, one
      assertion per access path listed in Constraints) passes and P6's goal
      includes the authorization work the P0 access-path map scopes; `L5-1` to
      `L5-3` are green.
- [ ] Cut-over: `@beep/nlp` is retired and `@beep/schema-org` is retired
      whole (census: no consumer) through the retirement procedure with
      consumers migrated in the same PR; `research/consumer-census.md` records each
      disposition; every package under `packages/foundation/modeling` and
      `packages/foundation/capability` passes `bun run beep lint package-scripts`
      and `bun run beep lint identity-registry` (the create-package contract);
      no S31 inventory grew, by the Constraints definition, checked per file
      against the P0 base commit.
- [ ] Doctrine: the knowledge-stack chapter, the nine rulings, the chapter-11
      amendment (merged before P2 and confirmed in force), the glossary entries
      and the chapter section that absorbs the `THEORY.md` narrative are merged on
      `origin/main`; `rg -n "local-first|on-device" docs/PROSE_TO_PROOF_VISION.md`
      returns no sentence stating it as architecture.
- [ ] Every row of `research/law-test-plan.md` is `green` with a test file
      and test name, or `deleted` with its reason.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

The manifest's `verificationCommands` and the PLAN command block are the
packet-health subset; this matrix is the completion proof.

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/text-knowledge-stack-rebuild/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/text-knowledge-stack-rebuild/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/text-knowledge-stack-rebuild` | Passes |
| Packet health | `bun run beep goals doctor` and `bun run beep goals decisions check --slug text-knowledge-stack-rebuild` | No blocking finding for this packet |
| Research projection | `bun run beep goals manifest --check` | No drift |
| Fleet lint | `bun run beep explore --check` and `bun run beep lint roadmap-refs` | Clean |
| Touched packages | `bun run beep quality package-verify @beep/<pkg>` for every edited package | Passes |
| Schema laws | `bun run beep lint schema-first`, `bun run beep lint identity-registry`, `bun run beep lint laws --package packages/<family>/<kind>/<pkg>` (a workspace directory; the `@beep/<pkg>` alias scans nothing and exits green) | Passes |
| Law catalogue | for every non-deleted id in `research/law-test-plan.md`: `rg -n "<id>" <owning package>/test` finds a test and that package's vitest run is green | Green, or the row is `deleted` with a reason |
| Regression guards | the three named signal tests in the L4 acceptance row | Green |
| Office-action flow | `OfficeActionReview.flow.test.ts` (created in P3, complete at P6) plus the existing `packages/law-practice/server/test/LawPracticeServer.test.ts`, `server/test/OfficeActionStructure.test.ts`, `use-cases/test/OfficeActionStructure.test.ts` and `use-cases/test/OfficeActionFixtures.test.ts`, run with each package's `bun run test`, at every phase exit from P3 | Green |
| Matter wall | `MatterWall.two-matter.test.ts` in the law-practice server tests | Green |
| Observability | `bun run beep observability catalog --check` | Current for every package that gained spans |
| Docs | `bun run docgen:local` | Passes |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at close |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- A retirement or rename is attempted without its row in
  `research/consumer-census.md` or without the consumer migration in the same
  PR: that step stops, the packet does not.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add text-knowledge-stack-rebuild --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug text-knowledge-stack-rebuild`; add a `kind: decision` file there, never edit this block._

### Program shape: one packet, design first, layers bottom-up, folds by census, 2026-11-08

The operator read the reader audits and critic reviews behind the 2026-11-08 rebuild report and asked for a careful redesign and rewrite of the text-knowledge stack as a goal packet, rather than re-scoping the empty explorations/nlp-annotation-family packet. This packet is that program. Its shape follows the report's section 7 path, reordered against the dependency DAG: a design-and-grill phase that resolves the five open questions in SPEC.md, then the layers bottom-up (L0 identity, L1 text, L2 annotation, L4 claims, L3 and L6, L5 and L7), then a per-facet census that decides every fold and rename. The lossy boundaries (handoff, invented confidence, array-order ids, auditless projection) are repaired before any package is renamed, so the product keeps its evidence intact even if the census declines every fold. One packet per path step was considered and deferred to Open Question 5, decided by the three-PR rule in P0.


Amended 2026-11-09: the repair-before-rename sequencing and the late census in this decision are superseded by `2026-11-09-breaking-changes-accepted-the-best-core-outranks-compatibility.md` and `2026-11-09-open-questions-1-5-resolved-toward-the-clean-core-p0-confirms-or-reverses.md`; the program now rewrites the layers bottom-up and cuts consumers over as each lands, with the consumer census as P0's work list. The one-packet shape and the three-PR decomposition rule stand.

Lane goals/text-knowledge-stack-rebuild

Reverse: Split any phase into a child packet whose requires names only independently completed capabilities (never this packet's own provides), or reorder phases by a checkpoint; nothing persisted depends on the order.

### Breaking changes accepted: the best core outranks compatibility, 2026-11-09

Operator ruling, 2026-11-09, while PR #2993 was in review: "I'm totally ok with breaking changes. I'd rather have the best core that we can build than worry about what will break. We want the best core for this stuff & we can deal with breaking changes later." Consequences for this program: persisted identity encodings are re-minted through a migration rather than frozen beside new ones; legacy carriers (non-canonical anchor encodings, path-derived IRIs, the list-valued rdf.Dataset, language-tagged xsd:string literals, the handoff's Entity/Relation/Provenance types) are deleted, not kept as projections; package topology is decided in P0 and executed inside the layer phases rather than after a late census; no old-wire codecs are written for internal shapes. Repo doctrine that protects consumers still applies as text: every breaking public API or schema change ships with a major changeset, every retirement follows standards/architecture/11-evolution-and-deprecation.md with the consumer migration in the same PR, and P0 records a scoped DECISIONS.md amendment for the persisted-bytes clause instead of ignoring it. The critics' risk that effort goes to names before evidence is handled by keeping one office-action flow green at every phase exit from P3 on.

Lane goals/text-knowledge-stack-rebuild · PR #2993

Reverse: Reinstate the compatibility hedges by decision file before the affected phase starts: frozen persisted encodings with parallel new preimages, old-wire codecs for changed wire shapes, and renames deferred to a census gate.

### Open questions 1-5 resolved toward the clean core; P0 confirms or reverses, 2026-11-09

Resolved under the breaking-changes ruling and the round-1 review of PR #2993, which found the open questions contradicting the fixed acceptance criteria (R10-03, SPEC thread on line 198). (1) Annotation home: @beep/annotation is created in P3 through bun run beep create-package, with the specific-home-first routing decision and the capability negative-gate clauses recorded in P0 (consumers: the langextract handoff, the semantica projection, the law-practice office-action flow); the L2 contract is not landed inside @beep/nlp first. (2) Status: Assessments<K> owner-declared coordinates are the foundation shape; P0 defines the caller-supplied value schemas per coordinate and the census of the seven vocabularies; ClaimLifecycle stays in shared/domain and its transitions stay in the epistemic slice. (3) External vocabularies (NIF, DoCO, gUFO, OA, PROV-O, SKOS) enter as registry entries and adapters; internal kinds stay repo-stable. (4) OccurrenceId is the one text identity: the cm1: preimage is re-expressed as an occurrence preimage (whole SourceTextIdentity, unit, range, quote) and existing cm1: records are re-minted by a migration in the P2 PR; citation-extraction-engine remains the owner of the citation identity module. (5) One packet; a phase splits into a child packet only when it needs more than three concurrent PRs, and a child requires only independently completed capabilities. Also resolved: @beep/provenance is renamed to @beep/text in P2 (it is text identity and anchoring, not PROV), via create-package plus retirement of the old name with the consumer migration in the same PR; @beep/nlp-processing already exists and absorbs nlp/Operations and nlp/Algebra in P6 instead of being created. P0 amends (2) and (4): the status census covers eight sites (decision p0-rq2-assessments-confirmed-total-carrier-eight-sites), and no SQL migration is written, since citation document receipts convert v3 to v4 on read (decisions p0-rq4-occurrence-id-confirmed-mention-id-derives-from-it and p0-chapter-11-amendment-yields-to-the-stored-format-law).

Lane goals/text-knowledge-stack-rebuild · PR #2993

Reverse: Any single resolution is reversed by a decision file recorded in P0 before the phase that depends on it (P2 for the text package and cm1, P3 for the annotation package, P4 for Assessments); the SPEC acceptance row for that item is edited in the same change.

### Paused by operator ruling (finish board, 2026-11-13): Very large ten-phase program with no implementation started; set to paused until resourced rather than leaving active, 2026-11-13

Operator ruling on 2026-11-13 (about 05:20Z, in the orchestrator session, from the Goal Finish Board triage). The ruling sets this packet to `paused`.

Triage rationale: Very large ten-phase program with no implementation started; set to paused until resourced rather than leaving active.

No lane is working on it. Resume with `bun run beep goals set-status text-knowledge-stack-rebuild active` when it is picked up.

Lane chore/finish-board-pause-b2

Reverse: goals set-status text-knowledge-stack-rebuild active when it is picked up

### P0: ActivityId is minted from what is known when a run starts, and withActivity takes the used ids before the run, 2026-11-19

ActivityId is the hash of what is known when a run starts: (activity/v1, operation term, agent or engine pin, prompt digest when there is one, the sorted ids it used, start time). What it generated and when it ended are fields of the activity record, outside the id, because an output id that contained the activity id could not also be inside it. withActivity in @beep/nlp-processing computes the used ids before the operation runs, so the id can be minted at start; L5-3 then checks that generated is never earlier than used and that every output is attributed.

Lane goals/text-knowledge-stack-rebuild-p0-design · PR #3420

Reverse: Mint ActivityId from the finished run instead, by a decision file before P1 opens (or before P6 for the withActivity order), with output ids kept free of the activity id; the L0 and L5 design files are edited in the same change.

### P0: the actor of an admission, a person's challenge and a retraction is the slice-supplied principal id, 2026-11-19

The actor of an Admission, of a Challenge by a person and of a Retraction is the slice-supplied principal id. AgentRef (a software agent with its model pin, a person, an organization) describes who asserted or generated a record, not who acted on it. An admission token is bound to that principal, together with the action, the revision and the scope.

Lane goals/text-knowledge-stack-rebuild-p0-design · PR #3420

Reverse: Type the actor as an AgentRef instead, by a decision file before P4 opens; the L4 design file and the admission token binding are edited in the same change.

### P0 census dispositions: every facet the program moves, renames or deletes, with its consumer sums, 2026-11-19

Sums are consumer usage lines and files outside the owning package at base f9982f3b5e6, from research/consumer-census.md, where covered and uncovered sums per facet are tabulated. @beep/provenance: adapt by rename to @beep/text in P2, 1,100 usage lines in 156 files, 18 package.json dependents; no semantic change except that the SourceTextIdentity string fields, which admit lone surrogates today, are constrained to well-formed text, since RFC 8785 canonicalization rejects lone surrogates. @beep/nlp (404 usage lines in 45 files; covered 3, uncovered 257, neutral construction 168) is ADAPT under rule 2 of chapter 11, since its uncovered sum exceeds its covered sum, and this file logs that flip as rule 4 requires: the package name retires once its facets are rehomed, and only the covered UnitInterval re-export (24 lines, covered 3) retires to its upstream, @beep/schema/UnitInterval. Handoff contract is rehomed into @beep/annotation in P3 (40 lines in 10 files; covered 0; Entity, Relation and Provenance deleted); Graph Schema adapts into @beep/annotation kinds in P3 (147 lines in 10 files; the float Span is deleted); GraphOps retires in P6 as a duplicate of the nlp-processing graph layer over effect/Graph (0 consumers); Ontology Kind folds into the @beep/annotation kind registry in P3 (0 consumers); Operations adapt into @beep/nlp-processing in P6 (0 consumers), merged with that package's own makeOperation and Operation modules into one; Algebra retires in P6 except instances the Combiner and Reducer census leaves uncovered and a P6 consumer uses (0 consumers today). The facets the SPEC did not route: Core (Document, Sentence, Token, CharPosition, Similarity, Vectorization, Pattern; 217 lines in 33 files, mostly the wink driver and nlp-processing) moves to @beep/nlp-processing in P6, since it is the linguistic engine contract that capability already consumes and the wink driver already depends on that package; langextract's use of it is re-expressed on @beep/text positions in P3 where it is an offset and imports nlp-processing otherwise; CharPosition is deleted in favour of the text position. IdentifierText, PathText, QueryText and VariantText have no consumer and are deleted in P7. THEORY.md is absorbed by the chapter and deleted with the package. @beep/schema-org: retire the whole package in P7; it has no importer and no package.json dependent, so no facet is rehomed. @beep/ontology: legal seeds and the six seed data files under src/seed move to the law-practice asset pack and the FOLIO DTOs and their data are deleted in P5 (0 consumers each, covered 0, uncovered 0); the fold adapts to Dataset output (covered 0, uncovered 4) and the cli research library is migrated to it in the same PR; SkosMappingKind adapts in P5 into the SSSOM MappingPredicate (0 consumers outside the package, covered 0, uncovered 0). @beep/rdf: Dataset becomes a set with quotient equality and Literal three cases in P5 (341 import lines in 91 files touch the package; covered 0 for every adapt facet; uncovered Dataset 96, Dataset equality 4, Literal 8, hand-written prov, oa and xsd constants 80, namespace literals 74 (URI literals 52, CURIE literals 22), IRI schema 85; 347 in all; construction 393); the rdf to md edge is removed with its one test moved. Anchor encodings deleted: the rdf TextQuoteSelector and TextPositionSelector schemas in Evidence.ts are replaced by the @beep/text Selector in P2 (0 outside consumers); epistemics EvidenceSpan (22 lines in 10 files; covered 0, uncovered 13) in P4, where the stored epistemic_evidence.span bytes are kept and the epistemic tables package reads them (current and legacy shapes) through a declared read-time transform to the text position plus an extractor-confidence signal, proved by a frozen old-row fixture; the nlp Handoff Span (20 lines in 9 files; covered 0, uncovered 4) and Graph Span (0 direct consumers) in P3; the TextSpan case of party-domain EvidenceAnchor in P2 (10 lines in 4 files; covered 0, uncovered 4), whose three non-text cases keep a non-text locator. No anchor encoding has upstream coverage, so each uncovered sum is its usage less its construction lines, as the census tabulates. Also re-expressed on the text position in P2 and P3: langextract TextOffsetRange and Utf16TextRange, law-practice TextQuote, SourceRef and SourceQuote as projections of an occurrence. The cli knowledge-base Selector has a TextQuote case that is a text anchor (quote plus UTF-16 offsets); it is kept outside the program's scope because it is repo tooling with no consumer in the stack, and P7 re-checks it. @beep/epistemics: the Present or Absent carrier (makeSignal, AbsenceReason, Measurement) adapts by moving to @beep/schema in P4, so @beep/ontology can type a mapping confidence in P5 without depending on the claims layer (until then the design module imports them from epistemics); StructuralVerdict folds into ClaimGateResult in P4 under the verdict law; EvidenceSpan retires as above; makeClaimEnvelope and its ClaimVersion retire in P4 with every consumer migrated to makeClaimCore plus the separate records, and rows that store a ClaimVersion keep their bytes behind a read-time transform; the glossary entry is headed Claim (core). The covered and uncovered sums of these facets are in the census @beep/epistemics section. Identity (census section g): path-derived IRIs adapt in P1, re-published from the registry (3,263 usage lines in 3,117 files; covered 0, uncovered 46, construction 3,217); the duplicate Curie types (2 lines; covered 2, uncovered 0) and the three CURIE parsers (15 lines; covered 15, uncovered 0) retire in P1 into the one registry codec; the slice-local canonical-JSON re-export copies retire in P1 (7 lines; covered 7, uncovered 0); the pinned historical encoders are kept (39 lines; covered 33, uncovered 4, construction 2). S31: the per-inventory counts at the base commit are in the census and are the ceiling for every phase head.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Change a disposition by a decision file before the PR that executes it opens, with the re-measured sums from research/consumer-census.md.

### P0: the scoped chapter-11 amendment covers encodings with no stored rows; where rows are stored, the stored-format law governs and bytes convert on read, 2026-11-19

The 2026-11-18 ruling added the stored-format law to standards/ARCHITECTURE.md: stored bytes are never rewritten and an incompatible change is one declared read-time transform per version step, proved by frozen old-format fixtures. A standard outranks this packet, so the amendment drafted earlier today is narrowed to agree with it. The scoped amendment to rule 5 of chapter 11 now allows, in a PR of this program, a changed encoding for identifiers, wire shapes and fixtures that have no stored rows: bump the version tag, refuse the old version at decode where the module already works that way, regenerate fixtures and golden vectors. That covers the citation mention and authority identifiers (no table stores them), the rdf Dataset and Literal shapes, the handoff contract and the gold projection fixture. Where rows are stored the amendment grants nothing: the four persisted anchor columns keep their bytes, the SQL-pinned ClaimDispositionStatus and the stored LogicalEdgeIdentity key keep theirs, and any later change to a stored format is a read-time transform under the stored-format law. For citation document receipts held outside the database, P2 writes the v3 to v4 step as a declared read-time transform that recomputes the identifiers from the receipt's own source, anchor, engine artifact and kind, with a frozen v3 fixture, instead of refusing v3; CitationMentionMigration.test.ts proves that transform. This supersedes the refusal wording in the decisions p0-rq4 and p0-chapter-11-scoped-amendment-ships-with-p0. The amendment names its packages: identity, provenance (text), annotation, nlp, nlp-processing, epistemics, ontology, rdf, schema-org, md, pandoc-ast, lexical, html, langextract, the semantica lab, party-domain, agent-memory-store, and the law-practice domain, use-cases and server packages.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Widen the amendment to allow rewriting stored rows, by a DECISIONS.md entry that amends the 2026-11-18 stored-format law for the named table, before the PR that needs it opens.

### P0: the scoped chapter-11 amendment and the knowledge-stack doctrine ship in the P0 PR, 2026-11-19

The amendment is a dated standards/architecture/DECISIONS.md entry that amends rule 5 of the upstream-first retirement procedure (persisted and served bytes do not change in a retirement PR) for the packages this program names and for no other work: a PR of this program may change a persisted or served encoding when the same PR carries the migration, meaning a bumped version tag in the preimage or wire schema, refusal of the old version at decode, regenerated fixtures and golden vectors, and a tested reversal path where stored rows change. The promoted-contract V2 protection stays operative. The entry expires when this packet reaches completed-retained. It merges with the P0 PR together with the knowledge-stack chapter (chapter 16), the nine rulings of the report's section 7 as dated entries with reversal clauses, and the glossary entries of section 5. Doctrine text describes the target; where the code has not caught up yet the chapter marks the rule as pending the phase that lands it.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Split the amendment into its own PR if review of the chapter delays it; P2 still holds until the amendment is on origin/main.

### P0: makeClaimCore and the other builders take one options object, and valid is the existing ValidTime, 2026-11-19

makeClaimCore and the other layer builders take one options object, matching makeClaimEnvelope, so a slice passes its proposition and id schemas by name. The valid field of a claim core is the existing ValidTime schema (Unknown or Interval) rather than a bare interval, so a record that asserts no valid interval is representable. The shared canonical set codec and the rule that annotation and anchor records carry no id field are recorded in decision p0-items4-6-9-annotation-document-shape.

Lane goals/text-knowledge-stack-rebuild-p0-design · PR #3420

Reverse: Return to positional builder arguments or a bare Interval for valid time, by a decision file before P4 opens; the L4 design file is edited in the same change.

### P0 design module: goals ops home confirmed, checked on effect 4.1.4, with the Effect diagnostics run by a second config, 2026-11-19

The section 4 sketches become a module under this packet's ops/design directory, registered file by file in the manifest's opsScripts and checked by bunx tsrs -p goals/tsconfig.ops.json --noEmit, which resolves @beep/* aliases to package sources and passes on this checkout (design-facts section 8). The installed effect is 4.1.4, not the 4.1.2 the SPEC and the report name; every API is validated against 4.1.4 and the SPEC text is corrected. The ops tsconfig sets no compiler plugins, so the Effect language-service diagnostics do not run there. The design module is held to the same bar as package source, so P0 adds a second tsconfig beside the module that turns the diagnostics on and is run as a named verification command; it must report zero diagnostics. The module is a design artifact: each phase moves its part into the owning package and deletes it from ops/design in the same PR, so it is empty at P7. Handoff: the phase that moves a layer into its package also, in the same PR, re-points or removes every remaining import of that design file, updates index and generators, and removes the file's opsScripts entry; the PR that moves the last design file removes the design tsconfig and its verification command and keeps the general goals ops check. PLAN.md Execution Notes carries the same rule ("Design-module handoff").

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Move the design module to a scratchpad workspace package and drop the ops registration, by a decision file; nothing imports the module.

### P0 item 10: derivedFrom lives in the hashed core; L4-3 loses its support half; retraction is its own record, 2026-11-19

What a claim was derived from is true at creation and never changes, so derivedFrom is a set of ClaimId in the immutable core, sorted on the preimage. Because a ClaimId is the hash of a preimage that contains its derivedFrom ids, a core cannot name itself or any later core: derivation is acyclic by construction. supportAtCreation is a set of OccurrenceId and an admission's grounding is a list of anchor receipts, so neither forms a graph over claims and the support half of L4-3 is deleted from the ledger with that reason. L4-3 is restated: the ClaimId changes when derivedFrom changes; every log built through the minting function has an acyclic derivation graph (checked with effect/Graph isAcyclic on generated logs); a Challenge cycle is accepted by the log. Retraction is a record that points at a core (claim, actor, reason, time), like Challenge and Admission, never a mutation; L4-4 is stated over it: a claim whose derivedFrom is non-empty and wholly retracted is flagged by the closure, transitively.

Amended 2026-11-19 (PR #3420 review). A record's derivedFrom parents must already be in the log, so every parent starts no later than its child; the pure log checker reads derivedFrom and reports a missing or later parent. Ledger row L4-3 carries this clause.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Move derivedFrom to a separate Derivation record with an explicit acyclicity check over the log, by a decision file before P4 opens; L4-3 is restated over that graph in the same change.

### P0 item 11: the matter wall is one authority port checked at seven access paths; the two-matter test composes a widened law-practice server test layer, 2026-11-19

The access-path map is in research/consumer-census.md. Its findings: the law-practice server layer reaches only source retrieval and the office-action review path; the Practice KG, citation engine, mailbox and record repositories are outside it; scope is compared between two caller-supplied values at anchor resolution and is absent at graph query, full-text search, citation caches and draft assembly; law-practice has no vector index and no provenance traversal. Decision for P6: one MatterAuthority port in the law-practice slice answers whether a principal may act in a scope, and each of the seven paths calls it with a caller-independent principal. MatterWall.two-matter.test.ts in the law-practice server tests composes the real server layer widened with the Practice KG host, the citation engine layer, the notice mailbox over the fake mailbox and the record repositories over PGlite, loads identical bytes into two matters with distinct decisions, and makes one assertion per path. The search path is asserted on the full-text index that exists; a vector index gets the same check when one is added. Provenance traversal is built in P6 over annotation attribution and admissions, owned by the law-practice server, and is authorized like the other six.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Split the two-matter fixture into one test file per owning layer, by a decision file before P6 opens; the P6 exit criterion is edited in the same change.

### P0 item 3 amended: a knowledge interval ends at the record that supersedes it, so several current records per key are allowed, 2026-11-19

The first P0 decision on item 3 ended a record's knowledge interval at the next record of its partition. The design module showed the consequence: only one record per (scope, logicalKey) is ever current, which makes the valid-time disjointness clause vacuous and contradicts the database, where several unexpired rows of one logical key coexist with disjoint valid ranges. Amended: the claim core names the record it supersedes (an optional ClaimId in the hashed preimage, as ClaimVersion.supersedes is today). A record's knowledge interval ends at the knowledgeStart of the record that supersedes it and is open otherwise. The pure log checker tests, per partition (scope, logicalKey): supersession is acyclic by hash construction; a record is superseded at most once, and a second superseder is a reported fork; a superseder never starts earlier than the record it supersedes or than its own generation time; and the records not yet superseded have pairwise disjoint valid intervals, which mirrors the Postgres exclusion constraint. The rest of the first decision stands (half-open bounds, Instant, partition key, where the checks live).

Amended again 2026-11-19 (PR #3420 review). A record may supersede only a record of its own partition (scope, logicalKey); the log checker reports a cross-partition supersession as a violation, because a superseder that changed the key would end a knowledge interval in a partition it does not belong to. A record whose valid time is Unknown asserts no interval and is left out of the valid-time disjointness clause; it still takes part in supersession. The claim log is append-ordered in knowledge time: an append whose knowledgeStart is earlier than the knowledgeStart of the last record already in the log is refused, and the pure checker reports it as a knowledge-start regression. With that rule the as-of view at a time t cannot change after the log has passed t, which is what L4-1 promises; without it a late record with an early start would rewrite the past. Ledger row L4-1 carries the append clause.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Return to one current record per (scope, logicalKey) by a decision file before P4 opens; the valid-time clause of L4-1 is then deleted as vacuous.

### P0 item 3: the interval laws partition by (scope, logicalKey); knowledge intervals are disjoint by construction; a pure checker mirrors the database constraint, 2026-11-19

Facts (design-facts section 3): ValidInterval and KnowledgeInterval are half-open with local order checks in the schema; overlap is refused only by a Postgres exclusion constraint on valid time per logical_key among unexpired rows; nothing checks knowledge time. Decision: the partition key is the pair (scope, logicalKey), where scope is the slice-supplied id schema of the claim core builder. All bounds are half-open, inclusive start and exclusive end, and Instant is S.DateTimeUtcFromMillis (item 9), matching the millisecond int8range in storage. The core stores knowledgeStart only; the end of a record's knowledge interval is the knowledgeStart of its successor in the same partition, so knowledge intervals are disjoint by construction and the law to test is that the derivation is total and ordered: successors sort by knowledgeStart and then by ClaimId, and a successor never starts earlier than its predecessor or than its own generation time. Valid-time disjointness among current records of one partition is a second clause. Local bound checks stay in the schema checks; both partition-level clauses live in a pure function over a log in @beep/epistemics, which is what L4-1 property-tests; the Postgres constraint remains the enforcement in the epistemic server and its existing integration test is unchanged.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Drop the pure checker and state L4-1 over the Postgres constraint in the epistemic server integration tests only, by a decision file before P4 opens.

### P0 item 7: the declared OA profile, the residual dataset, and imported activities, 2026-11-19

The codec in the @beep/annotation rdf adapter subpath supports this profile and nothing else. Classes: oa:Annotation, oa:SpecificResource, oa:TextPositionSelector, oa:TextQuoteSelector, prov:Activity. Properties: oa:hasTarget, oa:hasSource, oa:hasSelector, oa:hasBody, oa:start, oa:end, oa:exact, oa:prefix, oa:suffix, rdf:type, dcterms:creator, dcterms:created, as:generator, prov:wasGeneratedBy, prov:specializationOf, prov:generatedAtTime. NIF is export-only for the Sentence and Word kinds (nif:Sentence, nif:Word, nif:beginIndex, nif:endIndex, nif:anchorOf, nif:referenceContext). OA and NIF offsets are Unicode code points on the wire: the codec converts the stored utf16-code-unit offsets to unicode-code-point on encode and back on decode through the @beep/text unit conversion (L1-2), and fails closed on a split surrogate. Decoding third-party input returns three things: the annotation document, a table of imported activities, and a residual dataset holding every triple outside the profile. Residual triples are never stored in the document and never dropped silently. An activity named in the input by IRI gets ActivityId = hash of (imported-activity/v1, IRI) and its record keeps the original IRI and the stated time when one is given; an annotation with no dcterms:creator, as:generator or prov:wasGeneratedBy is attributed to the import activity, which is a prov:Activity over the source document digest with a deterministic id, the hash of (import-activity/v1, source document digest); the import time is a field of its record outside the id, so normalize(s) is a function of s and the source digest. normalize(s) is defined as: project s to the profile, add the import attribution to unattributed annotations, and take the canonical form of the dataset quotient. Law L2-6: for document d, decode(encode(d)) equals d; for third-party input s, encode(decode(s)) equals normalize(s) on the dataset quotient; and resolve gives the same result before and after the round trip; an astral-plane fixture checks the code-point conversion.

Amended 2026-11-19 (PR #3420 review). The OA encoder takes the document together with the table of imported activities, the same pair the decoder returns without the residual, so the original activity IRI and stated time survive the round trip and L2-6 holds for imported activities. The OA decoder is built on the annotation document's checked decode entrypoint (decision p0-items4-6-9-annotation-document-shape).

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Widen or narrow the profile by a decision file before P3 opens; ledger row L2-6 is edited in the same change.

### P0 items 4, 6 and 9: target canonicalization, restrict as a closed selection, Generation identity, and Anchored as a receipt, 2026-11-19

Item 4. A target set is minted from an array: deduplicate, sort by the OccurrenceId string, then hash; the carrier is a HashSet and, because S.HashSet and S.HashMap encode in iteration order, every preimage sorts its set-valued fields explicitly (design-facts section 7). A document names one text capture (SourceTextIdentity); every row of the anchors table must carry a receipt whose source equals that capture, and its key must equal the occurrence hash of its value. The key check is effectful by choice, so the Digest service stays the one hash backend (the repository does have synchronous hashing, for example the JsoncFingerprint sync twins); it runs in the effectful constructor and in an effectful verify function that every decode path calls; the pure schema check covers resolution (every target has an anchors row), attribution (every annotation has a non-empty Generation set) and capture equality. Restriction: each kind in the registry declares the kinds its body references. restrict takes a kind set and refuses with a typed RestrictionNotClosed{missing} value when the set is not closed under those references; closure computes the closed set. A restriction never silently drops dependents and never silently widens; anchors and attribution are restricted to what the kept annotations use, so referential integrity holds by construction and L2-4 tests it. Item 6, confirmed as stated in the SPEC: RunEntityId is its own brand, the hash of (generation/v1, AnnotationId, ActivityId); attribution is unique per (content, activity) pair; time is canonical per pair; merging two records for one pair with different times returns a typed GenerationTimeConflict refusal; merge over two documents with different captures returns a typed CaptureMismatch refusal; the join laws of L2-1 are stated over compatible documents (same capture, no time conflict). Item 9, confirmed with one simplification: the canonical stored unit is utf16-code-unit, which is what TextAnchor's width check already assumes, and the occurrence preimage names the unit explicitly. Anchored is an S.Opaque holding the powerless TextAnchorVerificationReceipt, with range and quote read from the receipt's anchor rather than stored a second time, since two copies would need an equality check that one copy does not. A decoded Anchored grants no proof; only verification against the source text yields a VerifiedTextAnchor. Instant is S.DateTimeUtcFromMillis.

Amended 2026-11-19 (PR #3420 review). Set-valued fields that enter a preimage (annotation targets, supportAtCreation, derivedFrom, coreference members) use one shared codec: a HashSet when decoded, a deduplicated array sorted by the encoded string when encoded, so the encoded form is canonical without a separate sort step; this replaces the explicit sort in item 4. Annotation and anchor records carry no id field: the map key is the hash of the value. Each kind declares, beside the kinds its body may reference, a function from a body to the annotation ids it references; the document check requires every referenced id to resolve to an annotation of an allowed kind in the same document, merge and restrict preserve it, and L2-4 tests it. An annotation document has one checked decode entrypoint per boundary: it decodes through the schema (resolution, attribution, capture equality, body references) and then runs the effectful key verification before it returns. The package exports that entrypoint for wire and storage input; the bare schema is exported for composition and generators only, and an L2-4 test proves that a document whose annotation key was replaced is refused by the entrypoint. The OA decoder is built on it.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Change any one of the four by a decision file before P3 opens; the design module and ledger rows L2-1 to L2-4 are edited in the same change.

### P0 item 8 and L0 homes: the IRI schema moves into @beep/identity; canonical JSON stays in @beep/jsonc; ContentHash brands the existing prefixed digest (reverses SPEC wording that put canonical JSON in identity), 2026-11-19

Dependency facts (design-facts sections 5 and 6): @beep/identity depends on effect only; @beep/utils, @beep/schema and @beep/jsonc depend on identity directly; @beep/data depends on it through @beep/utils. So identity can use an IRI schema only if it owns it, and it cannot import the one RFC 8785 implementation, which already has a single owner in @beep/jsonc (JsoncFingerprint, from the completed canonical-digest-owner goal). Decision: (1) The RFC 3987 schemas (IRI, IRIReference, RelativeIRIReference, AbsoluteIRI) move from rdf/src/Iri.ts to @beep/identity, with their @beep/utils helper calls rewritten to effect/Array and effect/String; @beep/rdf imports them from identity and keeps canonicalizeSchemaOrgIri; every importer (ontology, ontology client, documents domain, the scratchpad workspace) is migrated in the P1 PR and no re-export is left behind. (2) L0 is a layer, not one package: @beep/identity owns terms, namespaces, the registry, TermBinding and the stability snapshot; @beep/schema owns the digest primitive; @beep/jsonc owns canonical JSON and the one minting function that hashes a versioned, domain-tagged preimage. The SPEC criterion of one canonical JSON implementation is met by the existing owner; P1 removes the two slice-local re-export copies and leaves the pinned historical encoders (party key v1, eyecite parity, the pipe-joined LogicalEdgeIdentity key that is stored in SQL) recorded as pinned. (3) ContentHash is a brand over the existing Sha256PrefixedDigest (sha256: plus 64 hex) and each domain adds its own brand (OccurrenceId, AnnotationId, RunEntityId, ActivityId, ClaimId). The one-digest-format rule binds identifiers minted by the eight layers; the bare Sha256Hex primitive (2,370 lines in 439 files repo-wide) is not migrated by this program. SPEC Objective item 5, Target Surfaces and Constraints are edited to match.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Move the RFC 8785 core below @beep/identity into a new effect-only primitive package and re-point @beep/jsonc at it, by a decision file before P1 opens.

### P0 review: L0 objects are split by dependency so @beep/identity stays effect-only, 2026-11-19

The reviewer of PR #3420 found that the design module typed identity-owned objects with primitives from @beep/schema (the prefixed digest, the semantic version, LiteralKit), which depends on @beep/identity, so P1 could not move them as written. Ruling: the registry is split along the dependency line. @beep/identity, which imports effect only, owns what expansion and binding need: the IRI schemas, Namespace as prefix and IRI, Term as IRI, namespace and local name, TermBinding (code id, term, since), the Deprecation record (term, since, replacement) and the term-stability snapshot. Its version field is a string with a local pattern check and its literal domains use S.Literals, the standing exception for the bottom package that @beep/schema itself depends on; the registry test cross-checks both against the @beep/schema schemas as a test dependency. The pin of an external namespace (source, license, version, digest) is a NamespacePin record keyed by prefix in @beep/rdf, beside the vendored vocabularies it describes, where the digest and SPDX schemas are importable. The optional gUFO class typing is a record keyed by term IRI in @beep/ontology, where the L3 audit reads it. ContentHash and its domain brands stay over the @beep/schema digest and the minting function stays in @beep/jsonc, as already decided. L0-1 and L0-3 are tested in identity; the license-and-digest assertion on every external namespace is tested in rdf.

The gUFO class typing record has three fields: the type of type (Kind, SubKind, Role, Phase, Category, Mixin, RoleMixin, PhaseMixin), the category of its instances (Object, Relator, Mode, Quality, Event), and for a Relator the set of role terms it mediates. The audit rules of L3-3 read those fields; an untyped term is skipped.

Amended 2026-11-19 (P1 ruling 14): the cross-check of the local version pattern and literal domains runs in @beep/schema's tests, not as a @beep/schema test dependency of identity, because that dependency would close the workspace cycle identity to schema to identity (decision 2026-11-19-p1-version-and-literal-cross-check-in-schema-tests).

Lane goals/text-knowledge-stack-rebuild-p0-design · PR #3420

Reverse: Move the digest, version and literal-kit primitives below @beep/identity into a new effect-only primitive package and reunite the registry record, by a decision file before P1 opens.

### P0: law-test generators produce well-formed text and valid boundaries; split surrogates are a negative fixture, 2026-11-19

Law-test generators produce well-formed text only (no lone surrogates) and ranges on valid boundaries, so a generated receipt would also pass re-verification. Split surrogates are a negative fixture for L1-2, not generator noise.

Lane goals/text-knowledge-stack-rebuild-p0-design · PR #3420

Reverse: Let generators emit lone surrogates and off-boundary ranges, by a decision file before P2 opens; the generator module and ledger row L1-2 are edited in the same change.

### P0 routing: @beep/annotation is foundation/modeling; the legal seeds become a law-practice asset pack; law-practice use-cases hosts the first claim-writing tool, 2026-11-19

Specific-home-first test (standards/ARCHITECTURE.md, routing table and the foundation/capability gate) applied to @beep/annotation: it carries no product semantics (kinds are supplied by the caller through a kind registry, and patent structure stays a law-practice profile); it wraps no external engine, SDK or service; it is not repo-operational tooling; it is not a UI primitive. It is repo-owned, domain-agnostic schema and pure behavior, so it is foundation/modeling, created with create-package (family foundation, kind modeling). The capability negative-gate clauses are recorded although the package is not a capability: named consumers at creation are the langextract handoff (packages/foundation/capability/langextract), the semantica projection (apps/labs/semantica) and the law-practice office-action flow (packages/law-practice/use-cases); the README lists them. Law-practice asset pack: the legal seeds in @beep/ontology (Vocabulary.seed.ts, SemanticFoundation.seed.ts and the six files under src/seed) have no consumer outside the package and no law-practice asset pack exists. They are product vocabulary, so the specific home is the law-practice slice: a manifested, digest-pinned data pack owned by the law-practice domain package and loaded through ontology/src/TaxonomyLoader.ts, with seed IRIs and approval metadata preserved; P5 fixes the directory when it reads the loader protocol. The FOLIO HTTP DTOs have no consumer either and are deleted in P5 rather than moved. Write-tool host for the L7 acceptance: no MCP tool writes a claim or an annotation today. The first one is defined in packages/law-practice/use-cases beside the existing ReviewHub and claim tools; its success schema is a proposed-only record schema exported by @beep/epistemics, and the test that write tools emit proposed records only lives in the law-practice use-cases tests. The mcp-kit TierGate stays the dispatch gate and is not changed.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Re-route any of the three by a decision file before its phase opens (P3 for the package, P5 for the asset pack, P6 for the tool host); no code exists at any of the three homes yet.

### P0 confirms RQ1: @beep/annotation is created in P3 as a foundation/modeling package, 2026-11-19

Confirmed against the live tree at f9982f3b5e6. The census (research/consumer-census.md, group b) shows the handoff contract has 40 consumer lines in 10 files, all in langextract and the semantica lab, and that neither IrToLaw nor the semantica projection reads AnnotatedDocument today, so there is no reader to keep compatible and no reason to land the contract inside a package that P7 retires. The package is pure schemas and pure functions over them (document, merge, restrict, containment), which is foundation/modeling; its OA and NIF codec lives in an adapter subpath so the base stays rdf-free. The routing proof is the separate decision p0-routing-annotation-asset-pack-and-write-tool-host.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Land the L2 contract inside @beep/nlp-processing instead, by a decision file before P3 opens; the SPEC L2 acceptance row is edited in the same change.

### P0 confirms RQ2: Assessments<K> is a total, owner-declared carrier; the status census covers eight sites, not seven, 2026-11-19

Confirmed with two corrections from research/2026-11-19-p0-design-facts.md section 2. (1) The cited vocabularies are eight sites: ReviewTag, ReviewState, ReviewerDisposition, StructuralVerdict, ClaimDispositionStatus, ClaimGateResult, ClaimEvidenceReviewStatus and ClaimLifecycle. Working classification, final in research/status-census.md at P4: ReviewState, ClaimDispositionStatus, ClaimEvidenceReviewStatus and ClaimLifecycle are coordinates; ReviewTag is a projection of ReviewState; StructuralVerdict duplicates ClaimGateResult and is folded into it under the verdict law; ReviewerDisposition is the value schema of the reviewer signal, not a status. SPEC text that says seven now says eight. (2) Shape: makeAssessments takes a record from coordinate name to a caller-supplied value schema and returns a struct with every coordinate present, each Assessed{value} or Unassessed{reason}, the same pattern makeSignal already uses. The carrier is total so a missing coordinate is a decode failure, and unknown is a value a gate must handle. A gate is an owner-defined predicate over the struct; the foundation supplies the law harness (refusal is a no-op, independent coordinates commute, a gate never passes on Unassessed and is monotone under the owner's declared order per coordinate). ClaimLifecycle stays in shared/domain and its transitions stay in the epistemic slice. ClaimDispositionStatus is pinned by a SQL CHECK and keeps its bytes.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Keep the single ClaimLifecycle and add nothing in foundation, by a decision file before P4 opens; delete rows L4-6 and the Assessments acceptance text in the same change.

### P0 confirms RQ3: external vocabularies enter as registry entries and adapters, 2026-11-19

Confirmed. The census found no nif: or gufo: term anywhere in code and prov:, oa: and xsd: only as hand-written constants outside the CURIE registry, so P1 adds six namespaces to the registry (prov, oa, nif, xsd, gufo and ActivityStreams as:, which the OA profile needs for as:generator), each with source pin, license and digest, adds source pin, license and digest to the existing skos and doco entries, and migrates the constants; nothing internal is renamed to an external vocabulary. The OntoLex lexicog question absorbed from attributed-multi-claim-span, LKIF and ELI are recorded as candidate registry entries with no commitment to adopt them.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Adopt an external vocabulary as an internal kind by a decision file naming the kind and its consumer; nothing persisted depends on the choice until a kind ships.

### P0 confirms RQ4 with a changed shape: the citation mention id is derived over OccurrenceId, and the re-mint is a receipt-version bump, not a SQL migration, 2026-11-19

Facts (design-facts section 1, census correction 2 and 3): the cm1 preimage is already scope, source ref, locator, both digests, extractor name and version, normalization version, UTF-16 range and quote, plus two detection fields (engine artifact digest and semantic kind) and no offset unit. No table, column or migration stores a cm1 value; it lives in citation document receipts (citation-document-receipt/v3, citation-mention-receipt/v1), one golden vector and fixtures. Decision: OccurrenceId in @beep/text is the hash of the versioned tuple (occurrence/v1, scopeRef, sourceRef, locator, sourceDigest, textDigest, extractor name, extractor version, normalizationVersion, unit, start, end, quote). The citation mention id becomes the hash of (citation-mention/v2, engineArtifact, semanticKind, OccurrenceId): two engines or two citation kinds at one occurrence stay two mentions that share one occurrence, so nothing is lost and the occurrence is identified once. Every identifier whose preimage contains a mention id (the case-occurrence authority id and the cl and cg ids sliced from it) is re-minted with a bumped domain tag; P2 fixes the display prefixes with golden vectors that pin v1 and v2 side by side. Citation document receipts convert v3 to v4 on read through a declared transform that recomputes the identifiers from the receipt's own source, anchor, engine artifact and kind, and CitationMentionMigration.test.ts proves it on a frozen v3 fixture (decision p0-chapter-11-amendment-yields-to-the-stored-format-law). The four persisted anchor columns (epistemic_evidence.span, epistemic_evidence_verification.verified_anchor and the two law-practice grounding columns) hold EvidenceSpan (TextAnchor fields plus confidence), VerifiedTextAnchor and TextAnchorVerificationReceipt shapes whose bytes do not change, so no SQL migration is written; when P4 deletes EvidenceSpan as an in-memory encoding, the epistemic tables package keeps a declared read-time transform from the stored epistemic_evidence.span shapes (current and legacy) to the text position plus an extractor-confidence signal, proved by a frozen old-row fixture. The citation-extraction-engine goal is completed-retained with no open PR, so P2 edits its module directly and records the change in that packet's history. The name OccurrenceId is reserved for @beep/text: party-domain's party-occ identifier is renamed in P2 (it identifies a party record occurrence, not a text occurrence), and the agent-memory-store OccurrenceAnchor preimage is re-expressed on OccurrenceId in P2, sequenced after that goal's open lane merges. Its stored node events keep their bytes: P2 derives OccurrenceId from the stored OccurrenceAnchor at read time, mapping its utf16 unit literal to utf16-code-unit, and any change to the event shape is a declared read-time transform proved by a frozen old-event fixture under the stored-format law.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Keep citation-mention/v1 frozen and treat OccurrenceId as a sibling identity, by a decision file before P2 opens; the L1 acceptance row loses its cm1 clause in the same change.

### P0 confirms RQ5: one packet, one PR or stack per phase, P0 does not split up front, 2026-11-19

Confirmed. The census puts the largest single move (the @beep/provenance rename) at 156 consumer files, which is one mechanical PR, and no two phases need to run in parallel because the DAG orders them. The decomposition rule in PLAN.md stands for later phases.

Lane goals/text-knowledge-stack-rebuild-p0-design

Reverse: Bootstrap a child packet for any phase that needs more than three open PRs, with a checkpoint naming it in PLAN.md.

### P0: containment is defined between structure kinds only, each with a declared containment level, 2026-11-19

Containment is defined between structure kinds only. The generic structure and segmentation kinds (Section, Paragraph, Title, Figure, Sentence, Word) are declared in the annotation package with a containment level each, and L2-5 is tested over them: strict range inclusion orders two annotations, and on equal spans the lower level contains the higher (a one-sentence paragraph contains its sentence). Extraction kinds (Mention, Chunk, the candidates) declare no level and are never contained or containing.

Lane goals/text-knowledge-stack-rebuild-p0-design · PR #3420

Reverse: Define containment over every kind, or drop the levels for a kind order, by a decision file before P3 opens; the L2 design file and ledger row L2-5 are edited in the same change.

### P0: TextAnchor is retained with its stored shape; Selector.Position is added beside it, not a rename, 2026-11-19

TextAnchor is retained in @beep/text with its stored shape, and the four persisted anchor columns keep their bytes. Selector.Position is added beside it as the position case of the one selector union and is not a rename of TextAnchor; the census TextAnchor row records the move to @beep/text with the shape kept.

Lane goals/text-knowledge-stack-rebuild-p0-design · PR #3420

Reverse: Make TextAnchor the Position case of Selector by a decision file before P2 opens, with its stored columns read through a declared read-time transform; the census TextAnchor row is edited in the same change.

### P1: the beep: CURIE prefix retires with the path-derived curie annotation; semantic-web identity predicates keep their bytes, 2026-11-19

P1 ruling 6. The beep: CURIE prefix retires together with the curie annotation that composers derive from code paths: the beep entry of CoreVocab and the four terms SemanticFoundationVocab declares (Vocab.ts:548-558) are removed, and their only readers are identity tests (map R section 1.2). The IRIs live on as instances minted under the semantic-foundation namespace, with today bytes. The semantic-web identity predicates (IdentityRdfBinding.ts:27-28, minted as $SemanticWebId.create("identity/identifier") and create("identity/curie")) keep their bytes, because their segments are chosen by hand and spell no module path (the module is identity/IdentityRdfBinding); they are declared as terms of an identity-rdf namespace semantic-web/identity/ with their current values. The rule for the rest: an identity predicate whose IRI spells a module path is re-minted with a deprecation row; one that does not keeps its bytes.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Re-declare beep: as a registry prefix over the authority root by a decision file in any later phase; no stored row uses the prefix.

### P1: every slice-local canonical-JSON copy retires to an existing owner export without a new dependency edge (amends design D10), 2026-11-19

P1 ruling 7, amending D10 of the registry-first design. P1 retires every slice-local canonical-JSON copy: the two the census names, packages/epistemic/domain/src/values/internal/CanonicalJson.ts (consumer Retention.behavior.ts:12) and packages/execution-authority/domain/src/internal/CanonicalJson.ts (consumers ExecutionRecord.model.ts:33 and GrantSet.model.ts:34), 7 lines in 3 files, and the public re-export the map found in packages/epistemic/domain/src/values/ContradictionDetection/ContradictionDetection.behavior.ts:7-10,32 (consumers epistemic/domain/test/ContradictionDetection.test.ts:72, epistemic/use-cases/src/ContradictionDetection/ContradictionDetection.layer.ts:51,166 and epistemic/use-cases/test/ContradictionDetection.golden.test.ts:42). Each consumer is re-pointed to an existing owner export without adding a package dependency edge where one already reaches an owner: @beep/epistemic-domain has @beep/epistemics and @beep/schema but not @beep/jsonc, so its consumers import @beep/epistemics/ContradictionDetection; @beep/execution-authority-domain already depends on @beep/jsonc. No re-export is left behind. The bytes do not change; the seal goldens at ExecutionAuthority.test.ts:533 and the canonical-digest-owner differential and replay tests prove it. The public @beep/epistemics alias chain (canonicalDetectionJson and canonicalDetectionJsonResult, ContradictionDetection.behavior.ts:42,67, over the internal wrapper) retires in P4 with its direct consumers.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Re-add the slice canonical-JSON aliases at their pre-P1 paths by a decision file; the bytes they produce are unchanged either way.

### P1: CanonicalHashSet lives in @beep/schema; @beep/identity uses strictly ascending sorted arrays (withdraws design D5), 2026-11-19

P1 ruling 8, withdrawing D5 of the registry-first design, which put CanonicalHashSet, CanonicalHashSetBy and sortedMembers in a new @beep/identity/CanonicalSet. CanonicalHashSet stays in @beep/schema, as decision 2026-11-19-p0-l0-split-by-dependency and the L0.digest.ts owner line say: a HashSet when decoded, a deduplicated array sorted by the encoded string when encoded (the set-codec amendment of decision 2026-11-19-p0-items4-6-9-annotation-document-shape). @beep/identity imports effect only, so its snapshot and registry collections (TermSnapshot terms, namespaces, bindings and deprecations; RegistryShard and RegistryTable members) are strictly ascending sorted arrays whose schema check rejects an out-of-order or duplicate member. That keeps the committed snapshot byte-deterministic without a HashSet: S.HashSet and S.HashMap encode in iteration order, so a TermSnapshot with S.HashSet fields (L0.identity.ts:111-117) would not be deterministic.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Move CanonicalHashSet into @beep/identity by a decision file, keeping @beep/identity effect-only, and swap the sorted arrays for it.

### P1 delivers ContentHash, the versioned domain-tagged minting function with definePreimage and golden vectors in @beep/jsonc, and the ActivityId brand, 2026-11-19

P1 ruling 9. P1 delivers three L0 objects. (1) ContentHash and DomainTag in @beep/schema/ContentHash, a brand over the existing Sha256PrefixedDigest (Sha256.ts:132), as at L0.digest.ts:49-78, per decision 2026-11-19-p0-l0-homes-iri-in-identity-canonical-json-stays-in-jsonc. (2) The minting function in @beep/jsonc: mintContentHash (Effect.fn, over JsoncFingerprint.hash, needs Digest.Digest) and mintContentHashResult (pure, over hashResult), whose preimage is the RFC 8785 form of [domainTag, ...preimage]; definePreimage declares a versioned domain tag with its preimage fields, and committed golden vectors pin the bytes, so a changed preimage must bump its domain tag in the same PR (SPEC Constraints, PLAN P1 preimage versioning). Duplicate domain tags and a preimage with no golden are refused. (3) The ActivityId brand with its start-time preimage (activity/v1, operation term, agent or engine pin, prompt digest when present, the sorted used ids, start time), per decision 2026-11-19-p0-activity-id-minted-at-start. The L0-2 law test proves that equivalent records hash alike under key order and set order.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Defer the minting function and ActivityId to their first consumers (P2 OccurrenceId, P3 import activity) by a decision file; ContentHash stays in @beep/schema.

### P1: IdentityAuthority moves to @beep/identity/Authority, a module with no imports (design D11), 2026-11-19

D11 of the registry-first design, not replaced by a ruling. IdentityAuthority moves from Id.ts:77 to a new @beep/identity/Authority module with no imports, because the generated registry data (identity/src/internal/generated/Registry.data.ts) and Id.ts both need it and Id.ts keeping it would close the cycle Id.ts to Registry.data.ts to Id.ts. Id.ts and packages.ts never import Iri.ts, Term.ts or Registry.ts; an ImportGraph test in identity guards that. The importer outside identity, public-site/test/PublicSite.test.ts, is re-pointed in the same commit. IdentityRegistry stays as the runtime view of the same table, and @beep/semantic-web IdentityEntry is built by IdentityEntry.fromBinding with iri typed TermIri (breaking; no changeset is written).

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Move IdentityAuthority back into Id.ts by a decision file and inline the authority string in the generated registry data.

### P1: instance IRIs are minted under a declared term or namespace with the composer segment grammar (design D3), 2026-11-19

D3 of the registry-first design, not replaced by a ruling. An instance IRI is minted under a declared term or namespace by Registry.mint(base, ...segments), which reuses the segment validation of create(...) moved to identity/src/internal/Segment.ts, so Registry.mint("practice-kg:" + kind, naturalKey) and graphIdentity.create(kind).create(naturalKey).iri (PracticeKg.projections.ts:285) produce the same bytes and refuse the same inputs; Registry.mintEncoded covers the encodeURIComponent form used by ClaimGate and the research library. The Namespace record stays prefix and IRI. A namespace IRI is itself in the snapshot, because instances are minted under it (practice-kg/, semantic-foundation/, semantica/, lejeune/ontology/). Kept instance families keep their bytes: the 7 KgNodeKind graph IRIs, the ClaimGate claim base, the semantic-foundation seed concepts and the lab namespaces.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Add a kind field to Namespace that separates term namespaces from instance namespaces, by a decision file.

### P1: the IRI schemas re-home under @beep/identity and are annotated with its own composer; the first term snapshot is taken after the move (amends design D4), 2026-11-19

P1 ruling 15, amending D4 of the registry-first design (map M option 1). The RFC 3987 schemas IRI, IRIReference, RelativeIRIReference and AbsoluteIRI move by git mv from rdf/src/Iri.ts to identity/src/Iri.ts, with their 34 @beep/utils calls rewritten to effect modules, canonicalizeSchemaOrgIri moved to rdf/src/Vocab/SchemaOrg.ts, the @beep/rdf/Iri subpath removed, and every importer re-pointed in the same commit (no re-export is left). The moved schemas are annotated with the identity package composer ($IdentityId), not the rdf one. The 18 identities that change carry no IRI under the registry-first design, so the move publishes nothing, and the first term snapshot is taken after the move so it never records the rdf form. @beep/documents-domain drops its @beep/rdf dependency. Breaking: @beep/rdf loses the IRI schemas and the branded Curie (Rdf.ts:301); no changeset is written.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Annotate the moved schemas with $RdfId.create("iri") from ./packages.ts by a decision file, re-taking the term snapshot in the same change.

### P1: the base design facts the judges flagged are corrected before implementation, 2026-11-19

P1 ruling 16. Before implementation the registry-first design carries a Rulings applied section with these corrections, and the implementation follows them. (1) The research-library fold publishes 87 distinct owned property IRIs, not 90: the 90 counted field keys, including the borrowed dcterms:created and dcterms:title (Library.schemas.ts, 7 .key( uses); measured by running assembleLibraryOntology(). (2) Class locals are the ones the live fold prints, Source to Manifest, not LibrarySource as in the section 4.1 shard example. (3) The design-module handoff covers every importer of ./L0.*: L0.digest.ts:28, L1.text.ts:21, L2.annotation.ts:34-35, L3.taxonomy.ts:23-24, L4.claims.ts:40, L5.operations.ts:18-20, L6.interchange.ts:25, generators.ts:53-54 and index.ts:44,46 (grep -rn on ops/design); the base design omitted L1, L4 and L6. (4) The IdentityAuthority importer outside identity is public-site/test/PublicSite.test.ts. (5) The citations of the deleted decision slugs 2026-11-19-p0-design-module-rulings and 2026-11-19-p0-review-round-one-rulings in the three designs and three maps now cite the split files that hold each ruling.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Restore a corrected figure by a decision file that cites a new measurement of it.

### P1: no changeset is written for a private workspace; each breaking change is recorded in a P1 decision file, 2026-11-19

P1 ruling 11, withdrawing section 5.5 (changesets) of the registry-first design. Every package P1 touches is private (package.json private true: @beep/identity 0.1.1, @beep/schema 0.1.2, @beep/semantic-web 0.0.2, @beep/jsonc, @beep/rdf, @beep/test-runner and @beep/ontology 0.0.0, and the slice packages), and repo-sanity forbids a changeset that names a private workspace (packages/tooling/tool/cli/src/commands/Quality/ChangesetGraph.ts:652-671, "private workspaces must not accumulate release notes"). So P1 writes no changeset. Each breaking change is recorded in a P1 decision file instead: the composer surface and annotation record of @beep/identity (2026-11-19-p1-registry-first-fold-terms-declared), the fold signature of @beep/ontology (same file), the IRI schema move out of @beep/rdf (2026-11-19-p1-iri-schemas-re-home-under-identity), the test-runner identifiers (2026-11-19-p1-test-runner-iris-re-minted-from-the-registry) and the IdentityEntry shape of @beep/semantic-web (2026-11-19-p1-identity-authority-moves-to-its-own-module). The SPEC Constraints Delivery sentence about majors is amended to say so.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Make the touched packages public by a decision file and write their changesets in the PR that publishes them; the P1 decision files then become the changeset text.

### P1 adds no Biome rule; the declared-term law is held by the identity-registry lint and the L0 tests, 2026-11-19

P1 ruling 13. P1 adds no Biome rule. Once the composer .iri, .curie and rebase members are deleted, a derived IRI does not type-check, so the compiler holds the law; the extended bun run beep lint identity-registry gate (snapshot violations against the base ref, binding and deprecation checks) and the L0-1 to L0-3 tests hold the rest.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Add a Biome GritQL rule for composer IRI reads by a decision file in any later phase.

### P1: pin prov, oa, nif, xsd, gufo, as, skos and doco plus the three SPAR pins; the every-namespace pin test stays in P5 (narrows design D8), 2026-11-19

P1 ruling 3, narrowing D8 of the registry-first design. P1 registers prov, oa, nif, xsd, gufo and as (ActivityStreams, for the OA profile as:generator) with source pin, license and digest, adds source pin, license and digest to the existing skos and doco entries, and carries the three SPAR pins already present (deo, fabio and cito, from SparTerms.ts). That is the scope of chapter 16 section 10 and decision 2026-11-19-p0-rq3-external-vocabularies-as-adapters-confirmed. The base design pinned all 19 external namespaces in P1, sh (SHACL, 11 files through 7 local SHACL_NAMESPACE constants) and void (VoID, 3 files) included; dcat, rdf, rdfs, owl, dcterms, schema, sh and void stay unpinned until P5, whose exit test asserts a pin for every external namespace. This takes 11 network acquisitions off the P1 critical path. Kept from D8: PinnedSource.revision uses the typed revision kinds of @beep/schema/Conformance (Conformance.source.schema.ts:139-348) instead of a free NonEmptyString; as is the http form http://www.w3.org/ns/activitystreams# that anno.jsonld binds and DocumentAnnotation.ts:37 loads; xsd pins RDF 1.1 Concepts REC 2014-02-25 section 5.1; prov pins the dated PROV-O of the REC of 2013-04-30. Upstream byte digests and license notices are recorded at acquisition, never invented. NamespacePin and its data live in @beep/rdf, which gains the edge @beep/rdf to @beep/spdx.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Widen the P1 pin set to every external namespace the registry holds (19 in the base design), by a decision file that also moves the P5 every-namespace pin test into P1.

### P1: registry first; only IRIs that leave a process are terms, and fold terms are declared registry terms bound by code id, 2026-11-19

The registry-first design (research/2026-11-19-p1-design-registry-first.md) is the P1 base, taken with grafts from the minimal-surface and evolution-first designs. Only an IRI that leaves a process is a term. A code id, the composer identity @beep/<pkg>/<module>/<Name>, stays a code path (identifier, Symbol.for, JSON Schema $defs, OpenAPI names), and none of the 3,303 create(...) chains change. The composer readers .iri and .curie, rebase, vocabRegistry, toIri, toCurie, IriFromIdentity and CurieFromIdentity are deleted, so no code path can compute an IRI from an identity, and the 21,434 distinct path-derived annotation IRIs (map I section 5) cease to exist instead of being snapshotted. Fold terms (P1 ruling 1): the class and owned property IRIs the ontology fold emits are declared terms of a registry namespace, and a class reaches its term through a TermBinding keyed by its code id. Nothing is derived from a class name or a field key. fold(composer, input) becomes fold(namespace, input), with the typed refusals UnboundClass and UndeclaredProperty added to OntologyAssemblyError. P1 binds 23 code ids: the 16 research-library classes the fold reads and the 7 test-runner schemas. An annotation carries iri and curie only for a bound code id; the other annotations lose two fields that nothing reads. This reverses the addressing rulings of the identity-iri-core and identity-iri-fold packets. Breaking: @beep/identity (composer surface), @beep/ontology (fold signature); no changeset is written (decision 2026-11-19-p1-no-changesets-for-private-workspaces).

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Bind every annotation identity with today's path-derived value and restore the composer iri and curie readers, by a decision file before P2 opens.

### P1: the registry generator follows the live tree on snapshot layout, conflicts and release, 2026-11-19

Commit 7 (PR B, `feat(repo-cli): identity registry generator`) follows the live tree at four points where the registry-first design and decision 2026-11-19-p1-term-snapshot-namespaces-and-violations differ from it. (1) Layout: the committed JSON (shards and `registry/term-snapshot.json`) is in the layout the repository's Biome JSON formatter keeps (line width 80): an object keeps one member per line, and an array of scalars sits on one line when it fits. A namespace or deprecation row in the snapshot therefore spans several lines instead of one canonical row per line. The generator renders that layout itself (`renderRegistryJson`), so `--check` is byte-exact and `biome check` passes with no override, and the hand-rolled JSON lint stays clean without a suppression. (2) Conflicts: `RegistryConflict` has ten cases, the eight of design section 3 plus `TermOutsideNamespace` (a decoded table's term IRI is its namespace IRI followed by its local) and `DuplicateDeprecation`, and `RegistryTable.fromShards` returns every conflict, ordered by kind and key, instead of the first, so one lint run reports them all. (3) Release: `RegistryTable.snapshot(table, previous)` takes the previous snapshot, since ruling 2 makes `release` depend on it: unchanged keeps it, the empty snapshot gives 1.0.0, a new deprecation bumps the major and any other change the minor. The generator's previous snapshot is the committed file in PR B; the base-ref comparison of design section 7 lands with the term-stability gate in PR C, whose writers succeed the base's snapshot (decision `2026-11-22-p1-the-snapshot-release-is-a-property-of-the-change-against-its-base-ref`). (4) Lint wiring: `lint identity-registry` reports `registry-shard-invalid`, `registry-conflict` and `registry-generated-drift` and `--fix` regenerates; a checkout with neither shards nor the generated data module (the lint's fixture repos) carries no registry and is not checked. The other section 7 kinds wait for commit 15.

Lane goals/text-knowledge-stack-rebuild-p1b-registry

Reverse: Restore one-row-per-line snapshot rows with a Biome formatter override for term-snapshot.json, narrow RegistryConflict to the eight design cases, and return only the first conflict, by a decision file before PR B opens.

### P1: kept or re-minted; a research-library IRI written to a committed or exported artifact gets a deprecation row, an in-process one does not (amends design D2), 2026-11-19

P1 ruling 10, amending D2 of the registry-first design. Persisted values and values whose segments were already chosen by hand are declared with their current bytes, so the stored-format law holds; values that spell a module path are re-minted to <namespace>/<local>. A research-library IRI that is written to a committed or exported artifact (the research-library T-Box and SHACL Turtle written by Library.paths.ts:39,53, the SPARQL lib: prefix) counts as published and gets a deprecation row naming its replacement when re-minted; an IRI that never leaves the process (the Library.views term base for metadata keys and the 6 v: locals) gets none. The judges corrected the base counts: the live fold publishes 16 class IRIs, whose locals are the ones the fold prints (Source to Manifest, not the schema class names such as LibrarySource), and 87 distinct owned property IRIs (measured by running assembleLibraryOntology(); 134 owned slots, plus the borrowed dcterms:created and dcterms:title, which are not re-minted). The base design counted 90 field keys and 119 deprecations; the codemod re-derives the rows from the live fold plus the projection predicates effectiveCategory and catalogIndex, computed from the composer expressions at the P1 base before the composer IRI surface is deleted, and freezes the old values in identity/test/fixtures/p1-retired-iris.json for L0-3.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Re-declare the old research-library values as live terms by a decision file, inverting their deprecation rows; in-process IRIs need no record either way.

### P1: S31 counts an inventory row that moves from the rdf column to the identity column with its file as a rename, 2026-11-19

P1 ruling 12. The S31 no-inventory-growth rule applies to P1 as follows: an exception-inventory, coverage, fallow or catalog row that moves from @beep/rdf to @beep/identity together with the file it names (the RFC 3987 IRI schemas, rdf/src/Iri.ts to identity/src/Iri.ts, and their tests) is a rename, not an addition. The sum of rows over the two packages may not grow, and no row is added for a file that did not move. The same holds for the RetiredIriAuthorities allowlist entry that moves to the generated test-runner projection: its count stays 1.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Count moved rows as new identity rows by a decision file, and burn them down before the move merges.

### P1: since is a vocabulary release of the term snapshot, not a package version (replaces design D7), 2026-11-19

P1 ruling 2, replacing D7 of the registry-first design. The since field of a term, a binding and a deprecation is a vocabulary release of the term snapshot. TermSnapshot carries a release field that starts at 1.0.0. The snapshot writer bumps the minor when a term is added and the major when a term is deprecated, and every existing row keeps its since: regeneration never rewrites one, and a rewritten since is a snapshot violation. No lint ties since to a changeset. The base design computed since as semver.inc(identity.version, highestPendingBump) from .changeset/*.md frontmatter and refused a registry change without an @beep/identity changeset; both are dropped, because @beep/identity is private (package.json private true, version 0.1.1) and a private workspace may not carry a changeset (decision 2026-11-19-p1-no-changesets-for-private-workspaces). Every row of the first P1 snapshot carries since 1.0.0. The doctrine text that called since a package version (ops/design/L0.identity.ts, chapter 16, GLOSSARY.md) is corrected in the same commit as this decision.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Tie since to the @beep/identity package version by a decision file and recompute the since values before the P1 snapshot merges; after P1 only a new release may change it.

### P1: TermSnapshot gains namespaces and a release, and snapshotViolations replaces unexplainedRemovals (design D6), 2026-11-19

D6 of the registry-first design, not replaced by a ruling, read with rulings 2 and 8. The committed snapshot packages/foundation/modeling/identity/registry/term-snapshot.json is regenerated from the source shards and holds every term IRI and every namespace IRI, the namespaces (so a prefix change is visible), the bindings and the append-only deprecations, as strictly ascending sorted arrays laid out one canonical row per line, plus the release field of decision 2026-11-19-p1-since-is-a-snapshot-vocabulary-release. snapshotViolations(previous, next) returns a typed SnapshotViolation union in place of the design-module unexplainedRemovals: a removal with no deprecation, a revived deprecated term, a changed or removed deprecation, a rewritten since, a reassigned or ambiguous binding and a dropped namespace. The gate compares against the base ref; an unreadable base is unknown, never clean. A git-free genesis floor fixture beside it guards the first snapshot.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Drop the namespaces field and keep only the removals check, by a decision file before the snapshot is first published.

### P1: the seven test-runner IRIs are re-minted from the registry with deprecation rows, and their code ids become @beep/test-runner (amends design D9), 2026-11-19

P1 ruling 5, amending D9 of the registry-first design. The 7 test-runner pinned IRIs (Vitest.errors.ts:23,55,65,121,131,141,151) spell the module path test-utils/Vitest/<Name>. They are re-minted from the registry under a stable term name, vitest/<Name> in a vitest namespace, and each old value gets a deprecation row naming its replacement. Their code ids are corrected from @beep/test-utils/Vitest/<Name> to @beep/test-runner/Vitest/<Name>: @beep/test-utils is a different live package, so the old identifier claimed an owner it does not have. Kept from D9: @beep/test-runner cannot import @beep/identity, because all 14 identity test files import @beep/test-runner, so the registry generator writes a projection test-runner/src/internal/generated/RegistryTerms.ts from the shards that declare projection @beep/test-runner, with identifier, iri and curie per row as plain literals. The RetiredIriAuthorities.model.ts allowlist entry moves to that file with its reason updated; it is a rename and the count stays 1 (decision 2026-11-19-p1-s31-rows-move-with-the-file). Breaking: @beep/test-runner published identifiers and IRIs; no changeset is written.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Restore the hand-written test-runner pins at their pre-P1 values and the @beep/test-utils code ids by a decision file; the P1 deprecation rows stay, since deprecations only grow.

### P1: the cross-check of identity version pattern and literal domains against @beep/schema runs in @beep/schema tests (design D12), 2026-11-19

P1 ruling 14, the same call as D12 of the registry-first design, and an amendment of decision 2026-11-19-p0-l0-split-by-dependency. @beep/identity keeps a local version pattern and S.Literals literal domains (the standing exception for the package @beep/schema depends on). The test that cross-checks them against @beep/schema SemanticVersion and LiteralKit lives in packages/foundation/modeling/schema/test/IdentityRegistryParity.test.ts, because a @beep/schema dev dependency in identity tests would close the workspace cycle identity to schema to identity, while schema to identity is the legal direction.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Add a schema-free copy of SemanticVersion to the identity tests by a decision file and move the cross-check there.

### P1: versioned contract and predicate-type IRIs are declared terms with multi-segment locals and keep their bytes, 2026-11-19

P1 ruling 4. The versioned contract and predicate-type IRIs under https://beep-effect.com/ns/ are declared terms in the snapshot: qa evidence/{cited-event-id-exists, declared-round-coherent, evidence-cross-check, judge-output-inventory, cited-artifact-exists}/v2, qa receipts/{accepted, delivered, persisted, recovery-attempt, semantically-applied}/v2, qa verifiers/judge-settlement/v1, skill-contract evidence/failure/v2, evidence/gate-summary/v2 and evidence/gate-certificate/v1, contracts qa-inventory/v1, and schemas qa-judge-input/v1 and qa-judge-settlement/v1. A TermLocal schema admits slash-separated segments for them. They keep their bytes because evidence receipts carry them and cli/skills/qa-inventory-judge/SKILL.md commits them (read sites JudgeContract.ts:64-72,770-773,841-855,942, CitedArtifactExistsGate.ts:30-32, Recovery.ts:340, EvidenceReceipt.ts:385, GateCertificate.ts:335-336). The canonical CURIE keeps the raw slash (qa:receipts/accepted/v2); Turtle writers escape it at the boundary with the existing prefixedNameOrIri (PnLocal.ts:480), because a bare slash is not a legal PN_LOCAL. Golden tests read the expected values from the frozen pre-P1 base fixture.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Re-declare the versioned contract IRIs as instances minted under their namespace by a decision file; their snapshot rows then leave only through deprecation rows naming the instance form.

### P1: the composer keeps deriving its IRI; the registry binds published IRIs at build time, 2026-11-20

Commit 14 (PR C) realises design section 14, item 14 ("the composer reads its IRI from the registry") under a constraint the design predates. Since main #3431, `@beep/identity` is bundled into the CI runner Lambda handlers. `packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts` allows exactly `Authority.ts`, `Id.ts`, `Root.ts`, `internal/Segment.ts` and `internal/schemaStatics.ts` in a handler source map, and `beep lint identity-registry` (`leaf-package-registry-import`) keeps leaf packages off the registry. Alchemy hashes each function zip with its source map, and the map embeds the text of every module the handler loads.

1. The composer keeps deriving its IRI. `Id.ts`, `Root.ts` and the other allowed sources do not change, so the eight handler maps stay byte-identical to the lane base and no CiRunners function redeploys. The design deletes `toIri`, `toCurie`, `localPathFromIdentity`, `IriFromIdentity`, `CurieFromIdentity`, `.iri`, `.curie`, `rebase`, `vocabRegistry` and the binding options, and adds `make(base, { registry })` with binding lookup in `identityAnnotation`. Every one of those edits is in `Id.ts`. Doing them would change every handler code hash, and removing `.iri` would also mean rewriting about 120 read sites in some 25 packages that commits 12 and 13 deliberately left on their composers. They are deferred, not dropped. A later phase can make that change once, with a decision that accepts one handler redeploy. The `make(base, { registry })` entry would be the registry-aware composer, built outside the allowed files, and leaves would never import it.
2. The registry holds the published IRIs, and the build proves it. The proof is in the generator, the lint and the tests, not in the composer:
   - The kept read sites read their IRI from `@beep/identity/Registry` (`iri`, `namespace`, `mint`), so their bytes are the declared terms' by construction (PR C review fix, decision `2026-11-20-p1-review-fixes-bind-kept-sites-and-harden-the-gate`). `identity/test/KeptValues.test.ts` (commit 12) proves each kept declaration equals the bytes its site minted through a composer before P1; it does not import the sites.
   - The research library and the test runner read their IRIs from the registry (commit 13).
   - `identity/test/TermStability.test.ts` gains L0-3 test 1 (the committed snapshot equals the snapshot of the table built from the source shards, and only a deprecation may remove a term) and L0-3 test 2 (a module rename changes no published IRI).
   - `beep identity registry --check` and `beep lint identity-registry` keep gating snapshot breaks and generated drift.
   - `HandlerBundles` and `IdentityLeaf` keep the handlers registry-free.
3. `RegistryTable.rebind(table, { from, to })` lands here because L0-3 test 2 needs it. It moves the binding of one code identity and every binding under `from/`, or every binding of a package, and keeps each term and `since`. A move onto a code that is already bound fails with `DuplicateBinding`. Commit 15 puts it behind `beep identity rebind`.
4. The rename test has no composer half. Annotations do not read bindings (item 1), so the test does not compare `annoteSchema` output under `make(..., { registry })`. Instead it checks the registry: after the rebind, the new code is bound to the same term the old code had, the old code is unbound, and `snapshotViolations` between the two snapshots is empty. The snapshot rows list bindings by code, so the two snapshots are compared on their terms, namespaces and deprecations, not compared whole.
5. `IdentityEntry.fromComposer` is deleted (the breaking change, `feat(identity)!`). It copied a composer's path-derived IRI and CURIE into an identity entry, and `@beep/semantic-web` publishes entries as RDF. An entry is now built only from a registry binding (`IdentityEntry.fromBinding`). Its callers are `identity/test/IdentityRegistry.test.ts` and `epistemic/server/test/IdentityShaclProjection.e2e.test.ts`, and both move to the bound `vitest:TestHang` term. No semantic-web source called it.
6. Left for later: the SemanticSchemaMetadata text and the 34 JSDoc lines that read a composer IRI stay unchanged, because the composer API they document is unchanged and docgen compiles them as they are.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings

Reverse: Delete the composer IRI surface from Id.ts and add make(base, { registry }) outside the handler-allowed files, by a decision that accepts one CiRunners handler redeploy; restore IdentityEntry.fromComposer.

### P1: handler maps allow the registry-free Authority and Segment, 2026-11-20

PR B widens `ALLOWED_IDENTITY_SOURCES` in `packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts` by two entries, `Authority.ts` and `internal/Segment.ts`. Design section 14, commit 6 splits `Id.ts`: `IdentityAuthority` moves to the import-free `@beep/identity/Authority` and the segment grammar schemas move to `internal/Segment.ts`. `Root.ts` loads `Authority.ts` and `Id.ts` loads `internal/Segment.ts`, so every CiRunners Lambda handler source map now embeds both files. Neither file loads the package registry or the declared-term registry, so registering a package or a term still leaves every function's code hash unchanged.

Evidence, measured on the lane head bdcd36259dc (the allowlist entries from bb0acdcb4f4, the per-file comment from bdcd36259dc):

- (a) Exact paths. The test strips each map source up to the last `foundation/modeling/identity/src/` and compares the remainder with `A.contains(ALLOWED_IDENTITY_SOURCES, source)`, which is equality. It does not match by directory, glob, prefix, `endsWith` or `includes`.
- (b) The allowlist comment gives each file's reason. `Authority.ts` has no imports and holds one constant. `internal/Segment.ts` holds the segment grammar schemas and imports only `effect/Function`, `effect/Schema`, `effect/String` and an erased `import type { TString } from "@beep/types"`.
- (c) No `@beep/types` source appears in any of the eight handler maps (job-retry, runner-binaries-syncer, scale-down, scale-up, ssm-housekeeper, termination-watcher, webhook and reaper). The only foundation sources in the maps are under `modeling/identity` and `modeling/schema`. Each map's identity sources are exactly `Authority.ts`, `Id.ts`, `Root.ts`, `internal/Segment.ts` and `internal/schemaStatics.ts`.
- (d) Mutation proof. A temporary `import * as RegistryProbe from "@beep/identity/packages"` was added to `webhook.ts` and used in a `console.log`. The test then failed on that row alone: `webhook.ts` reported `outsideAllowed: ["packages.ts"]` and the other seven rows held `outsideAllowed: []`. The mutation was reverted with `git checkout -- <path>` and the tree was clean afterwards.
- (f) Bundle attribution against PR A's head 7a7b87f0328. All eight handler maps were built on each side with the test's Alchemy bundler options and compared. All eight differ. Each map gains exactly `identity/src/Authority.ts` and `identity/src/internal/Segment.ts` and loses nothing. Among the sources both sides share, only `Id.ts` and `Root.ts` changed content, which is the split itself. The stack deploys eight handler entries (seven library, one stack), not eleven.

Lane goals/text-knowledge-stack-rebuild-p1b-registry

Reverse: Remove the two entries from ALLOWED_IDENTITY_SOURCES and move the definitions back to Id.ts

### P1: the kept internal namespaces land as shards proved against their read sites; read sites stay, 2026-11-20

Commit 12 (PR C, `feat(identity): internal namespaces with kept values`) follows the live tree at four points of design section 14. (1) Shards: the 13 kept shards of section 5.2 land as written there (epistemic, beepQA, qa, skill-contract, contracts, schemas, document, documents-taxonomy, practice-kg, identity-rdf, semantic-foundation, semantica, lejeune), with no bindings and no deprecations. The csv and xlsx packages main added (#3426) are package composers only: they read no IRI, so they add no shard. (2) Read sites: the read codemod of section 6.3 item 1 does not run here. Main #3431 bundles `@beep/identity` into the CI runner Lambda handlers and fixes `ALLOWED_IDENTITY_SOURCES` to Authority.ts, Id.ts, Root.ts, internal/Segment.ts and internal/schemaStatics.ts, so how commit 14 realises "the composer reads its IRI from the registry" is still open: if the composer keeps deriving its IRI purely, with a build-time proof that every published composer IRI is a declared term, rewriting the kept read sites to `@beep/identity/Registry` would be churn across twelve packages for no byte change. Commit 12 therefore leaves every read site on its composer and adds a pairing test instead (the PR C review fix later moves the named read sites onto the registry, decision `2026-11-20-p1-review-fixes-bind-kept-sites-and-harden-the-gate`): `identity/test/KeptValues.test.ts` pairs each kept read site's composer expression with the registry declaration it must equal, byte for byte, plus a property test that `Registry.mint` under a kept instance base equals the composer's bytes. All composers involved live in `@beep/identity/packages`, so the proof needs no new dependency edge. (3) Instance-only namespaces: semantic-foundation, semantica and lejeune declare no term, so the Vocab test that every namespace lists at least one term now applies to external namespaces only. (4) Release: additions bump the snapshot minor under ruling 2, so the term snapshot moves to release 1.2.0. No handler source map changes: the commit edits no module the handlers load; Registry.data.ts now imports Authority.ts, and only Registry.ts, IdentityRegistry.ts and a type-only import in Id.ts read it.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings

Reverse: Run the design section 6.3 read codemod over the kept-value read sites in a later commit, rewriting each composer read to Registry.iri, Registry.namespace or Registry.mint, by a decision file before PR C opens.

### P1: merging PR B into PR C keeps the first snapshot at 1.0.0; only a retired namespace IRI is succeeded by a namespace IRI, 2026-11-20

Merging PR B's review head into PR C surfaced two collisions that git merged without a conflict marker. This records how each was settled.

1. **Release.** `main` has no term snapshot, so the base the stability gate reads is the empty snapshot. Decision `2026-11-20-p1-schema-athlete-removed-before-first-snapshot` restarted PR B's unpublished snapshot at 1.0.0 for that reason. PR C's snapshot, which moved from 1.2.0 to 2.0.0 (point 5 of `2026-11-20-p1-republish-live-tree-calls`), was never published either. The merged snapshot was therefore deleted and regenerated from the empty base by `bun run beep identity registry --write`. That gives release 1.0.0, and every binding and deprecation row of the research-library and vitest shards records `since: "1.0.0"`, because 2.0.0 rows do not fit a 1.0.0 snapshot. The 113 deprecation rows stay as PR C wrote them: they retire IRIs that left the process before P1, and the snapshot never publishes them as live. `schema:Athlete` was never in a published snapshot, so it is absent and has no deprecation row. `lint identity-registry` reports the empty base and passes.
2. **Replacement chains.** PR B ruled that a replacement chain ends at a declared term, never at a namespace IRI. PR C let `ShardDeprecation.replacement` be `""` so the retired `lib:` namespace IRI `.../Library.schemas/` could name the `research-library` namespace as its successor, and let `replacementOf` follow a chain to any namespace IRI. After the textual merge, PR B's check refused PR C's row (`ReplacementUnknown`). The kept rule is the stricter one, with the category of the deprecated IRI preserved:
   - A retired term's chain ends at a declared term. It never ends at a namespace IRI, and a namespace IRI is never a binding target (PR B unchanged).
   - A retired namespace IRI's chain ends at a declared namespace IRI, never at a term. A retired namespace IRI is a deprecated IRI that ends with `/` or `#` (`isNamespaceShapedIri` in `Term.ts`). That test cannot misread a term: a `TermLocal` never ends with either character, so no term IRI does.
   - `RegistryView.replacementOf` applies the same rule, so the generated view and the table agree.
   - `beep identity deprecate` retires only live terms, so it now refuses `--replacement <prefix>:` with `replacement-unknown`. Before, it wrote a row that the table check would then refuse.
   Tests: `RegistryTable.test.ts` (both directions and both separators), `Registry.test.ts` (the view), `identity-shard-edit.test.ts` (the refusal) and `TermStability.test.ts` (the 113 retired IRIs, the namespace row included).
3. **Release arithmetic.** PR B made `nextMajor` and `nextMinor` exact `bigint` arithmetic. PR C's `releaseNumbers`, which orders releases for `ReleaseRegressed`, still used `Number`, so two releases past 2^53 could compare equal. It now reads `bigint` components with `Order.BigInt`, and `nextMajor` and `nextMinor` reuse it. `Term.test.ts` covers the case at 2^53 + 1.
4. **Minted IRIs.** PR B's `mint` returns a validated `IRI`. PR C's kept-value property test compared `mint` with the composer for arbitrary segments. It now expects equal bytes when the composer's output is an IRI and a refusal otherwise.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings

Reverse: Let followReplacement and the Registry view accept any declared term or namespace IRI again, restore the empty replacement in identity deprecate, and set the since values of the research-library and vitest rows and the snapshot release back to 2.0.0, by a decision file before the first snapshot merges.

### P1: namespace pins and the pinned-vocabulary target follow the acquired artifacts, 2026-11-20

Commit 9 (PR B, `feat(rdf,repo-cli): namespace pins and the pinned-vocabulary target`) follows the live tree and the acquired artifacts at these points. (1) Term modules: the generated `@beep/rdf` `*.terms.ts` modules read `<PREFIX>_NAMESPACE` and `<PREFIX>_TERMS` from `RegistryVocab`, which `@beep/identity/Registry` now re-exports, instead of copying the term lists; the rdf constants cannot drift from the registry, and the seven `fallow-ignore` duplication directives the old template emitted are gone. `vocab-terms` projects 16 registry namespaces; nif, gufo and as stay registry-only until a consumer needs named nodes. (2) Digests: `pinned-vocabularies` checks each artifact against a byte SHA-256 recorded by running the target (prov and skos equal the vendor manifest digests), its metadata markers and a per-format declaration of every curated term (Turtle, RDF/XML, spec document), then records `termsDigest` over the sorted curated locals in the pin; the four SPAR values equal the old `semanticSha256`. (3) Licenses: the W3C artifacts carry no SPDX-identifiable notice, so prov, oa, xsd and skos are `LicenseRef-W3C-Document`; ActivityStreams is `W3C-20150513` (its repository license); nif is `Apache-2.0 OR CC-BY-3.0` (dual, per its header); gufo and SPAR are `CC-BY-4.0`. (4) Artifacts: prov pins the dated PROV-O `prov-o-20130430`; xsd pins RDF 1.1 Concepts section 5.1 as a spec document; as pins `vocabulary/activitystreams2.owl` at w3c/activitystreams 258bce0, whose own prefix is the https form while the registry keeps the http form Web Annotation binds; nif pins nif-core.ttl at 225301d, the last commit touching it. (5) Curated lists: prov is the 34 `Prov.ts` locals plus `specializationOf` (`prov:type` is not a PROV-O term and is not registered); gufo is the 12 gUFO 1.0.0 classes the L3 typing names plus `mediates`, because gUFO declares no `Mode` (only IntrinsicMode and ExtrinsicMode), which P3 maps. (6) sh and void are registered as unpinned shards (ruling 3) holding the terms the repo uses, and the seven local `SHACL_NAMESPACE` constants and the VoID constants now import `@beep/rdf/Vocab/Shacl` and `@beep/rdf/Vocab/Void`. (7) The term snapshot moves to release 1.1.0: additions bump the minor under ruling 2. (8) `identity/src/internal/generated/SparTerms.ts` stays until commit 10 deletes it with `SparVocab`; nothing regenerates it after `spar-terms` folded into `pinned-vocabularies`. (9) The target writes external shards with empty bindings and deprecations; an external deprecation waits for the P5 pin work.

Lane goals/text-knowledge-stack-rebuild-p1b-registry

Reverse: Return the rdf term modules to literal term lists, re-pin a pre-typed semantic digest per pin, and narrow the license, artifact and curated-list choices, by a decision file before PR B opens.

### P1: one CURIE codec follows the live tree, 2026-11-20

Commit 10 (PR B, `refactor(identity,ontology,rdf): one CURIE codec`) follows the live tree at six points of design section 14. (1) `Curie.ts` is deleted whole, not only `CoreCurieCodec`, `makeCurieCodec`, `makeCurieFromIri` and `CurieFromIri`: its `expand`, `contract`, `expandOption`, `contractOption` and `expandPredicate` duplicated `@beep/identity/Registry`, so `Registry` is the one codec. The vocabulary-parametric lookups the fold still needs while composers carry a `vocab` binding (until commit 13) become `RegistryView` members (`expandPredicate`, `curieNamespace`, which replaces ontology `registryPrefix`) and `Registry.fromVocab(vocab)`, a view with no bindings or deprecations; `ExpandedPredicate` is a schema. (2) `Vocab.ts` stays as a type-only module (`VocabShape`, `Curie`, `Predicate`, `Expand`): the composer type parameters use them until commit 14. The composer `Vocab` default is `typeof RegistryVocab` through a type-only import, so the barrel never loads the registry data. (3) `PrefixMap.fromRegistry` is the function `prefixMapFromRegistry` in `@beep/rdf/Rdf`, because `PrefixMap` is a schema constant with no static members. (4) The fold Turtle projection compacts an IRI only under the five prefixes its header declares (the registry now holds `xsd`, `prov` and others the header does not declare); the Markdown projection compacts over the whole registry. (5) The design-module handoff of `ops/design/L0.identity.ts` lands here rather than in commit 16: every design importer reads `@beep/identity/Term`. (6) The coverage regression baseline keeps rows for the deleted `Curie.ts`, `internal/generated/SparTerms.ts` and ontology `internal/Fold.ts`; rewriting it needs a whole-package coverage run, which the lane does not run, so hosted coverage re-measures them.

Lane goals/text-knowledge-stack-rebuild-p1b-registry

Reverse: Restore Curie.ts with the vocabulary-parametric expand, contract and expandPredicate over VocabShape, drop Registry.fromVocab, curieNamespace and expandPredicate, and move prefixMapFromRegistry onto PrefixMap as a static, by a decision file before PR B opens.

### P1: PR C's term snapshot is release 2.0.0 after PR B's 1.0.0, and the gate refuses an understated release, 2026-11-20

This reverses point 1 of `2026-11-20-p1-merging-pr-b-into-pr-c-keeps-the-first-snapshot-at-1-0-0-only-a-retired-namespace-iri-is-succeeded-by-a-namespace-iri`. Points 2 to 4 of that decision stand.

PR B (#3439) merges to `main` before PR C, and it publishes the first term snapshot at release 1.0.0: 374 terms, no bindings and no deprecations. Point 1 regenerated PR C's snapshot from the empty base, which also produced 1.0.0, but with 545 terms, 23 bindings and 113 deprecations. Two different term sets would then have shipped under one release number.

1. **Release.** PR C's snapshot is regenerated against PR B's published 1.0.0 snapshot with `bun run beep identity registry --write`. It adds deprecations, so the generator gives the major bump, 2.0.0. The 136 `since` values in the research-library and vitest shards (23 bindings, 113 deprecations) say `2.0.0`. `RegistryData.test.ts` asserts release 2.0.0 and that every row records since 2.0.0.
2. **Gate.** The term-stability gate refused a release below its base but accepted a changed term set at the base's own release, so `lint identity-registry --base <PR B head>` passed the 1.0.0 snapshot. `snapshotViolations` now reports `ReleaseUnderstated`: the rows changed, and the release is lower than the one the change calls for (the release the generator computes from the base). That is a minor bump for additions, a major bump for a new deprecation, and 1.0.0 after the empty snapshot. A head above that release is refused as well (`ReleaseOverstated`), and so is an added row that records another release: the release is one per change against the base (decision `2026-11-22-p1-the-snapshot-release-is-a-property-of-the-change-against-its-base-ref`). The lint maps the new violation to `release-regressed`. The remedy is to merge the base if it is not merged yet, set every `since` the lint reports, and run `bun run beep identity registry --write`, which reads the base's snapshot. `lint-identity-registry.test.ts` walks these steps in a checkout whose base is already merged.
   - Proof: against PR B's head snapshot, the pre-fix 1.0.0 snapshot reports `ReleaseUnderstated` (base 1.0.0, expected 2.0.0, release 1.0.0). The regenerated 2.0.0 snapshot reports nothing.
   - Tests: `Term.test.ts` (an addition, a new deprecation, an unchanged set, the empty base) and `TermStability.test.ts` (L0-3: a change to the committed shards at the committed release).

Lane goals/text-knowledge-stack-rebuild-p1c-bindings

Reverse: Delete ReleaseUnderstated from snapshotViolations and its lint mapping, and regenerate PR C's snapshot from the empty base at 1.0.0 with since 1.0.0 rows, by a decision file that also rules PR B and PR C merge as one.

### P1: the Registry codec follows the live tree on its surface, 2026-11-20

Commit 8 (PR B, `feat(identity): the Registry codec`) follows the live tree at five points of design section 6.1. (1) Barrel: `@beep/identity/Registry` is a subpath only. A plain `export *` would collide with the `expand`, `contract` and `CurieFromIri` exports of `Curie.ts` until commit 10 deletes them, and the barrel must not pull the registry data into consumers that do not use it (the package is bundled into the runner Lambda handlers and the CI binary). (2) `mint` and `mintEncoded` return `string`, not the branded `IRI`: decision 2026-11-19-p1-instances-minted-under-a-declared-namespace says `mint` refuses exactly the inputs `create(...)` refuses, and an RFC 3987 check would refuse more; `mint` takes at least one segment. (3) `bindingOf` returns `Option<Term>`, which carries the IRI, namespace and local, so the CURIE is derived rather than stored twice. (4) `namespaceOf(prefix): Option<Namespace>` sits beside the literal-typed `namespace(prefix)` for callers holding a runtime string, and `view(table)` returns a `RegistryView` of the same five lookups. (5) `IdentityRegistry.layer` is `IdentityRegistry.layerFromBindings(RegistryBindings)`; the public `layerFromBindings` builds a registry from binding rows in the generated shape, so fixture bindings exercise the same path while the generated table binds no code identity yet. The six acceptance examples of the new namespaces join L0-1 with commit 9, as the plan says.

Lane goals/text-knowledge-stack-rebuild-p1b-registry

Reverse: Return the branded IRI from mint and mintEncoded, return { term, curie } from bindingOf, drop namespaceOf and IdentityRegistry.layerFromBindings, and add Registry to the barrel as a namespace export, by a decision file before PR B opens.

### P1: the research library and the test-runner terms are re-published from the registry; the composer still derives its IRI, 2026-11-20

Commit 13 (PR C, `feat(identity,ontology,repo-cli,test-runner): re-publish the research library and the test-runner terms`) follows the live tree at these points of design sections 5.3, 6.2, 6.3 and 14.

1. Composer and handler graph. The composer keeps deriving its IRI, as commit 12 left it. No module in `ALLOWED_IDENTITY_SOURCES` (Authority.ts, Id.ts, Root.ts, internal/Segment.ts, internal/schemaStatics.ts) changes, so the CI runner handler bundles keep the same module graph. The registry is read only by `Registry.ts`, `IdentityRegistry.ts`, the ontology fold, repo-cli and tests.
2. No read codemod. The research-library reads are rewritten by hand: the namespace through `Registry.namespace("research-library")`, the projection predicates through `Registry.iri`, and the instance IRIs through `Registry.mint` under the declared bases `Topic`, `SoftwareAgent` and `Distribution`. The view keys use the declared base `view`. The fixture `identity/test/fixtures/p1-retired-iris.json` was derived once from the live fold at the commit 12 head (`assembleLibraryOntology()`, class IRIs and owned property IRIs under the old base) and from the seven test-runner pins. That one-off derivation script is not committed because it can only run against the pre-P1 composer IRIs.
3. Deprecation rows. There are 113 rows. The research library has 106: 16 classes, 87 owned properties, `effectiveCategory`, `catalogIndex`, and the old `lib:` namespace IRI `.../Library.schemas/`, whose successor is the `research-library` namespace. The test runner has 7. The old `Topic`, `SoftwareAgent`, `Distribution` and `Library.views/term` IRIs never leave the process, so under ruling 10 they get no row.
4. A namespace successor. A shard replacement names a local of the shard namespace, so the namespace row could not be written. `ShardDeprecation.replacement` now accepts the empty local `""`, which names the shard namespace itself. `RegistryView.replacementOf` follows a chain to a namespace IRI as well as to a term IRI.
5. Release. A deprecation bumps the snapshot major under ruling 2, so the snapshot moves from 1.2.0 to 2.0.0, and every new binding and deprecation row carries `since: "2.0.0"`.
6. The fold. `fold(namespace, input)` runs over the generated registry, and `foldWith(view)(namespace, input)` runs over a fixture registry. A namespace the view does not declare fails with the existing `unknownTerm` reason. `reservedPrefix` is replaced by `unboundClass` and `undeclaredProperty` (decision `2026-11-22-p1-a-namespace-iri-ends-with-its-separator-and-a-fold-refuses-a-rebound-core-prefix` brings it back for a registry that rebinds a core prefix). `BoundComposer` is deleted because nothing reads it. `Fold.test.ts` moves to fixture registries now rather than in commit 14, because the fold signature changes here.
7. The projection. `RegistryLayout` gains `projections`, which `resolveRegistryLayout` fills from the workspace map: one `RegistryProjectionTarget` for each `RegistryProjection` package present in the checkout. A shard that projects into a package the checkout lacks is a `registry-shard-invalid` finding.
8. Test-runner test. `@beep/test-runner` does not export `./internal/*`, so `test/Vitest.errors.terms.test.ts` pins the seven expected identifiers, IRIs and CURIEs as literals. Equality with the registry is proved in `identity/test/VitestErrorsParity.test.ts`.
9. Composers kept for annotations. `Library.projection.ts` and `Library.views.ts` keep their `$I` composers, because they annotate `TopicPacket`, `LibraryTopic` and `ViewKind`. Only their IRI reads are removed, so those schema identifiers are unchanged.
10. L0-3. `identity/test/TermStability.test.ts` lands here with test 3 (every retired IRI has a deprecation naming a live replacement). Tests 1 and 2 follow in commit 14.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings

Reverse: Restore the pre-P1 composer IRIs as live terms by inverting the 113 deprecation rows of the research-library and vitest shards, and restore fold(composer) with its reservedPrefix check, by a decision file before PR C opens.

### P1: review fixes bind the kept read sites and harden the term-stability gate, 2026-11-20

The PR C review raised seven findings; this records the calls that change earlier decisions.

1. **Kept read sites read the registry.** Decision `2026-11-20-p1-kept-values-live-tree-calls` left every kept read site on its composer, and `KeptValues.test.ts` only paired a copy of each composer expression with the registry, so an edit at a site could change a published IRI with every gate green. The named sites now read `@beep/identity/Registry`: ClaimGate (`epistemic:`), ExiftoolConfig (`beepQA`), the QA judge contract and cited-artifact gate (`qa:`, `contracts:`, `schemas:`), the skill-contract predicate types, DocumentAnnotation (`document:`), the legal document taxonomy seed (`documents-taxonomy:`), IdentityRdfBinding (`identity-rdf:`), the practice KG graph IRIs (`Registry.mint` under `practice-kg:<kind>`) and the lejeune projections (`lejeune`). None of these packages is a leaf package or reaches a CI runner handler bundle, so `ALLOWED_IDENTITY_SOURCES` and the handler maps do not change. The semantic-foundation and semantica sites keep their exported package composer as the instance base; KeptValues compares the namespace against that same export. A scan of every composer `.iri` read in src is not adopted: most of those reads are code identities, which the design keeps off the published term set.
2. **`binding-dangling` comes back in its cheap form.** `beep identity rebind` refuses a move whose target code names no module file (`target-module-missing`), and `beep identity registry --check` (so also the lint) reports `binding-dangling` for any binding code with no `src/<path>.ts`, `.tsx` or `/index.ts` in its workspace. The ts-morph call-site scan stays out.
3. **The snapshot release is guarded.** `SnapshotViolation` gains `ReleaseRegressed` (the head release is below the base release), which maps to the new kind `release-regressed`. A regenerated release is never below a `since` its rows record, so a committed release below one is drift that `--check` reports and `--write` repairs (decision `2026-11-22-p1-the-snapshot-release-is-a-property-of-the-change-against-its-base-ref`).
4. **Each base finding names its own remedy**; only a removal points at `identity deprecate`.
5. **The base fallback is narrowed.** The default base falls back to the empty snapshot only on `NotARepositoryError`, `UnknownRefError` (no `origin/main`) or a disjoint history, and a base without a snapshot now logs the same notice. Other git failures fail the lint.
6. **`//#lint:identity-registry` is uncached.** The lint reads git state (the merge base and its snapshot) that turbo cannot hash, so a cache hit could replay a pass computed against another base. It moves from the affected `lint:policy:medium` graph to the unfiltered `lint:policy:state` graph (`Quality/Tasks.ts`), joins `DOCS_POLICY_ROOT_TASKS` (the Docs Policy lane runs every uncached root task it cannot exclude, and no exclusion is added), and `docs/runbooks/turbo-cache-inputs.md` records why. The policy fingerprint seals are regenerated.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings

Reverse: Revert the read sites to their composers, drop target-module-missing, binding-dangling and release-regressed, and set //#lint:identity-registry back to cache: true.

### P1: schema:Athlete leaves the schema shard and the first term snapshot restarts at 1.0.0, 2026-11-20

Narrows the PR B ruling that the external namespaces carry the values of the former CoreVocab: the schema shard drops `Athlete`. Schema.org defines `Person` and the property `athlete`, but no `Athlete` class (https://schema.org/Athlete answers 404), so `schema:Athlete` expanded to an IRI no vocabulary defines; this is the same correction as `prov:type` in 2026-11-20-p1-namespace-pins-live-tree-calls point (5). No source uses the term (`rg Athlete` finds only the shard, its generated projections and scratchpad prose). No term snapshot is published on `main`, so the base the gate compares against is the empty snapshot and the removal needs no deprecation; recording one would keep a never-defined external IRI in the append-only set and force a major release. The generator compares against the committed working-tree snapshot, so the unpublished snapshot was removed and regenerated by `bun run beep identity registry --write` from the empty base: it holds every remaining term and namespace IRI, no bindings or deprecations, at release 1.0.0. That replaces point (7) of 2026-11-20-p1-namespace-pins-live-tree-calls (release 1.1.0), which counted an intermediate commit of this unmerged PR as a published release. The `@beep/rdf` vocab-terms projection is regenerated with it.

Lane goals/text-knowledge-stack-rebuild-p1b-registry · PR #3439

Reverse: Restore Athlete to registry/namespaces/schema.json and regenerate with identity registry --write, by a decision file; once a snapshot is published, removal needs a deprecation instead.

### P1: term-stability gate, rebind and deprecate against the live tree, 2026-11-20

Commit 15 (PR C) realises design section 7 and section 14, item 15 against the live tree. Commit 14 kept the composer deriving its IRI (decision `2026-11-20-p1-composer-stays-registry-free`), so this commit adds the term-stability gate to the CLI and the lint only. No module that a CI runner handler loads changes.

1. **Base-ref comparison.** `beep lint identity-registry` takes `--base <ref>`. Without it, the base is `git merge-base HEAD origin/main`. The lint reads the base snapshot with `git show <base>:<snapshot>`, at the path the base tree has it (decision `2026-11-22-p1-registry-edits-move-codes-by-one-schema-retire-stale-projections-and-say-how-to-finish`, point 5), and runs `snapshotViolations(base, head)` on the snapshot regenerated from the head's shards. That catches a change that edits the shards and the committed snapshot together, which `--check` alone cannot see. A base whose tree has no `@beep/identity` snapshot counts as the empty snapshot, as the design says. A checkout with no default base (not a git work tree, no `origin/main`, or a disjoint history) also gets the empty snapshot and logs a line saying so. An explicit `--base` that git cannot resolve fails loudly.
2. **Kinds.** The design's `term-removed-without-deprecation` (also used for `NamespaceDropped`), `namespace-prefix-changed`, `deprecation-changed` (removed or changed) and `term-revived` are added to both `IdentityRegistryIssueKind` and the lint's violation kind. The design left the binding cases unnamed, so `binding-changed` is added for `SinceRewritten`, `BindingReassigned` and `BindingAmbiguous`. Every `SnapshotViolation` case now has a kind.
3. **`beep identity rebind <from> <to>`** rewrites only the shards whose bindings move. Both ends are code identities, or both are packages for a package rename. A package that a shard projects into needs two source edits first (the same decision, point 7). Before writing, it checks the move with `RegistryTable.rebind`, so a move onto a code that is already bound is refused. A move that finds no binding is also refused. It then regenerates the artifacts. The snapshot rows list bindings by code, so a rebind changes the snapshot's binding rows and is at least a minor change against the base. The design's "term-snapshot.json is byte-equal" therefore holds only for the snapshot's terms, namespaces and deprecations. The end-to-end test and L0-3 test 2 assert those collections, not the whole file.
4. **`beep identity deprecate <curie> [--replacement <curie>]`** is the only writer of a deprecation row, as section 7 requires. It removes the local from its shard and appends the row. Its `since` is the release the whole change against the base calls for, a major bump when the previous snapshot publishes a term set, which it computes with `RegistryTable.releaseAfter` rather than a second copy of the release rule. A second deprecation in the same branch records the same release. A `ShardDeprecation` replacement is a local of the shard's own namespace, so a replacement in another namespace is refused, and `<prefix>:` names the namespace itself. A term that is still bound is refused: a binding must name a live term, so the binding is removed from the shard first. A rebind does not help, because it keeps the term bound.
5. **Left for later, with reasons:**
   - The ts-morph form of `binding-dangling` (a scan for an annotation call site of each bound code) is not added, because annotations do not read bindings (commit 14). The fold's `unboundClass` refusal (commit 13) is not enough on its own: it fails only research-library tests at runtime, and nothing consumes the vitest bindings that way. The PR C review fix therefore adds the cheap form, decision `2026-11-20-p1-review-fixes-bind-kept-sites-and-harden-the-gate`: `rebind` refuses a target module the checkout lacks, and `identity registry --check` reports `binding-dangling` for a binding code that names no module file.
   - `term-local-multi-segment` is not added. The kept values of section 5.2 declare multi-segment locals such as `qa:receipts/accepted/v2` on purpose. Against `origin/main`, which has no snapshot, every one of them is new on P1's own PR, so the check would refuse the design's own data.
   - `registry-since-mismatch` was not added here. Decision `2026-11-22-p1-the-snapshot-release-is-a-property-of-the-change-against-its-base-ref` adds it as `since-misstated`: `SinceRewritten` guards the rows the base published, and the new kind guards the rows the change adds.
   - The `delete-package` guard (`--deprecate-terms`) is not added. No package that owns bindings is a deletion candidate in P1.
6. **L0-3 tests.** `identity/test/TermStability.test.ts` gains two tests on module-derived IRIs. In the first, the module-derived IRI of every bound code (`$BeepId.create(<module path>).iri`) is never in the published set, and where it left the process before P1, its deprecation names the bound term. In the second, a property test rebinds the research-library module to generated paths: the published terms and deprecations are unchanged, there are no violations, and no new module-derived IRI is published.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings

Reverse: Remove --base and the five base kinds from lint identity-registry and IdentityRegistryIssueKind, and delete commands/Identity/ShardEdit.ts with its tests; deprecations are then hand-authored in shards again.

### P1: a namespace IRI ends with its separator, and a fold refuses a rebound core prefix, 2026-11-22

A review of PR #3449 reproduced three places where a registry accepted a namespace its readers could not print. This records how each was closed.

1. **A namespace IRI ends with its separator.** `Namespace.iri` is a `NamespaceIri` (`@beep/identity/Term`): an `IRI` that ends with `/` or `#`, checked by `isNamespaceShapedIri` and branded. A term IRI is the namespace IRI followed by a local with nothing between them, so the separator belongs to the namespace. Before this, `https://example.test/old` was a valid namespace whose later retirement read as a retired term, and `urn:example:` was a valid namespace whose ontology projections printed `urn:example:/`. Every committed namespace already ends that way, so no shard, snapshot or pin changes. `NamespacePin.namespace` in `@beep/rdf` and `AssembledOntology.baseIri` in `@beep/ontology` use the same schema.
2. **What became unreachable is deleted.** `withNamespaceSeparator` in the ontology projections and the Markdown projection is gone. The `NamespaceIriIsTerm` conflict is gone: a term IRI is its namespace IRI and a local, a local never ends with `/` or `#`, so a term IRI that equals a namespace IRI always reports `TermOutsideNamespace`. `ReplacementUnknown` already names the kind it expected (a declared term or a declared namespace IRI); with point 1 that kind is always the right one.
3. **A fold refuses a rebound core prefix.** The projections bind `dcterms`, `owl`, `rdf`, `rdfs` and `skos` themselves and the fold compares against the SKOS IRIs, so `foldWith` fails with `reservedPrefix` when its registry binds one of the five to another namespace, whether that namespace owns the fold or only lends terms to it. A registry that omits a core prefix or binds it to the core namespace folds as before. `AssembledOntology` carries the owned half of the rule as a schema check, so a decoded ontology cannot bypass the fold. This brings `reservedPrefix` back for this one case, after point 6 of `2026-11-20-p1-republish-live-tree-calls` removed the check that reserved the five prefixes outright. Reading the prefixes from the registry was the alternative; the fold's SKOS gate and the `skos:Concept` markers would still mean the core namespace, so the output would contradict itself.
4. **Found while fixing.** The Turtle projection declared `skos:` twice when a core namespace owned the fold, printed a typed number as `42^^<...>`, which is not Turtle, and the Markdown projection labelled an IRI with the owned prefix when the generated registry binds that prefix to another namespace. All three are fixed and tested in `Fold.test.ts`.
5. **L0-3 wording.** The law ledger, the glossary, the knowledge-stack chapter and the goal text said the published set changes only with a deprecation record. An addition needs none, so they now say that a published IRI leaves the set only with one. The law id and the test title are unchanged.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings · PR #3449

Reverse: Set Namespace.iri, NamespacePin.namespace and AssembledOntology.baseIri back to IRI, restore NamespaceIriIsTerm and withNamespaceSeparator, and drop requireCorePrefixes and the AssembledOntology check, by a decision file.

### P1: over a base commit that publishes no term set, the writers keep the release, 2026-11-22

PR C review (round 2) found that the default base of a stacked layer still bumped the release once per command: while the parent is open, the merge base with origin/main has no term snapshot, so each writer succeeded the committed snapshot and a second deprecation over 2.0.0 wrote 3.0.0. The lint skips the exact-release checks against such a base, so nothing caught it until the parent merged.

1. A writer whose base commit publishes no term set now keeps the release the committed snapshot has (ReleasePolicy keep, RegistryTable.snapshotKeeping): until the base publishes, every edit is part of one unreleased change. The first write still takes the genesis release, raised to the largest since a row records. A deprecation records the kept release.
2. The committed snapshot stays the previous one for the term-set check, so the writer still refuses to drop a row it carries.
3. A checkout with no base commit at all (no origin/main, not a git work tree, disjoint history) says nothing about what is published. BaseSnapshot.resolved is false there and the writers succeed the committed snapshot as before; --check, which reads no git state, does the same.
4. The README no longer says the writers succeed the checkout's snapshot over an unpublished base, and its stack guidance states that the release is left alone until main publishes.
5. Tests: two deprecations over a base commit with no registry and a committed 2.0.0 stay at 2.0.0 (command level and planning level); an addition there keeps the release; the policy for published, unpublished and unresolved bases.

Lane tksr-p1c · PR #3449

Reverse: Remove ReleasePolicy and BaseSnapshot.resolved so a writer over an unpublished base succeeds the committed snapshot again, with a superseding decision.

### P1: registry edits move codes by one schema, retire stale projections and say how to finish, 2026-11-22

A second review of PR #3449 found five ways the registry commands or the lint let a checkout drift from its registry, or named a repair that does not work. Each was reproduced with a failing test first.

1. **A move is a schema.** `CodeMove` (`@beep/identity/Term`) is a union of `CodeIdMove`, from code identity to code identity, and `CodePackageMove`, from `CodePackage` to `CodePackage`. `RegistryTable.rebind(table, move)` and `beep identity rebind` take it, and `moveCode` is the one place that applies it. The design and the command's own documentation promised a package rename, but both ends were decoded as `CodeId`, which needs a path, so `rebind @beep/old @beep/new` was refused. `CodeId` is unchanged: a stored binding still names a kind. A move between a package and a code identity is refused (`mixed-move`), because moving a code onto a package would leave a code with no path. The shape replaces `RebindRequest` and the `(from, to)` arguments, with no shim.
2. **A projection module no shard targets is drift.** `RegistryPlan.retired` lists the projection module of every package in the checkout that no shard projects into. `--check` reports one that is on disk and `--write` removes it, but only when the file starts with the generated projection header. A file the generator did not write is never reported or removed. While any shard targets the package, its module is generated as before. `writeRegistry` answers a `RegistryWrite` with what it wrote and what it removed.
3. **A binding needs a regular file.** A directory named like a module file (`src/Runner.ts/`) passed as a module. The check now reads the file type, and a path below a file is no module instead of an I/O failure.
4. **A failed write says how to finish.** The whole plan runs before the first write, the edited shards are written before anything generated from them, and each file is staged and renamed, so a failure leaves whole files. A failure while the shards are written says to run the same command again, which edits the shards that are left. A failure after that says the edit was applied and to run `bun run beep identity registry --write`, because the edit no longer applies: the term is not live, or the old code is not bound.
5. **Deleting the registry does not pass the lint.** `lint identity-registry` returned early when a checkout had neither shards nor the generated data module, so deleting both passed over a base that published terms. It now reads the base snapshot first and compares an absent registry as the empty snapshot. A base that published nothing still passes, so a fixture repository needs no registry. The base snapshot is located in the base tree, never at the head's path: the lint lists that tree and takes the term snapshot beside the `package.json` that names `@beep/identity`. Reading the head's path let a change that moves the package directory find no base, so it could drop terms or the whole registry. Only a base tree with no such snapshot counts as empty. When a base tree has several, the one at the head's path is the base, and with none there the lint fails instead of guessing. The writers read the base through the same reader.
6. **Remedies that repair.** A release is repaired by regenerating against the base (decision `2026-11-22-p1-the-snapshot-release-is-a-property-of-the-change-against-its-base-ref`), and a bound term's refusal names the shard to remove the binding from instead of a rebind (decision `2026-11-20-p1-term-stability-gate-live-tree-calls`, point 4).
7. **A projected package's rename starts in source.** A package move rewrites binding codes and leaves `projection` as it is. `RegistryProjection` is a closed literal (the packages `@beep/identity` depends on), and it holds `@beep/test-runner` alone. A new name is a source edit in any case, and once the literal has only the new name, a shard with the old one does not decode. So rewriting `projection` in the move would need a step that keeps both names in the literal. The documented order is one edit fewer: put the new name in the literal and in the shard's `projection`, then rebind. A command run before that is refused, and its message now gives these steps.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings · PR #3449

Reverse: Restore RebindRequest and rebind(table, from, to), drop RegistryPlan.retired and the staged writes, and return early from the term lint when a checkout has no registry.

### P1: research-library topic keys and agent labels are schema invariants, 2026-11-22

`Registry.mint` checks each segment and throws for an empty one. The composer expression it replaced checked the composed string, so a catalog with an empty `model` or `effort` projected before commit 13 and threw inside `catalogDataset` after it. Topic keys were minted the same way from free text: a topic key with a space or a leading or trailing slash threw too.

1. **The schema carries the invariant.** `LibraryAgentLabel` is a label `libraryAgentIri` accepts, and `LibraryTopicId` is a key `libraryTopicIri` accepts. Both checks call the minter itself, so they cannot drift from what the registry accepts. `LibraryModelRun`, `LibrarySynthesisAuthor`, `LibraryMineProfile` and `LibraryVidbeeBinding` use the first for `model` and `effort`. `LibraryFinding.topicIds` and `LibraryTopic.id` use the second. A refused value is a decode error that names its field, and the projection mints only checked keys.
2. **Why a decode error.** No import path writes a refused value: mining profiles are constants, the VidBee import requires a model and writes `unrecorded` for a missing effort, a synthesis author was already non-empty, and mining keeps only topic keys of the packet list. An empty model or effort therefore names no agent, and keeping the old IRI with an empty segment would publish a resource for it.
3. **What is still accepted.** A label is percent-encoded, so spaces, slashes and angle brackets stay legal in `model` and `effort`. Only the empty string and a lone surrogate, which has no UTF-8 form, are refused. A topic key is used as it stands, so a space, an angle bracket, a stray `%` and a leading or trailing slash are refused.
4. **Free text stays out of the key set.** A packet's initiative id is free text (the goal template's is a placeholder in angle brackets), so mining offers a finding only the ids that are topic keys. A packet directory whose name forms no IRI is skipped and counted with the unreadable manifests.
5. **No published byte changes.** The T-Box and SHACL Turtle are byte-identical, and the live catalog (3,465 model runs, 12,330 findings) decodes and projects to the same quads before and after.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings · PR #3449

Reverse: Type LibraryModelRun and LibraryFinding keys as S.String again and mint them inside catalogDataset.

### P1: the snapshot release is a property of the change against its base ref, 2026-11-22

PR C review found that each write counted the same branch change again: two deprecations over 1.0.0 became 2.0.0 and 3.0.0, and repeated additions became 1.1.0 and 1.2.0. The release now belongs to the whole change against its base.

1. The lint, registry writer, deprecation writer and rebind writer share one base reader. Each accepts --base; the default is the merge base of HEAD with origin/main. A base that publishes no term set leaves the checkout snapshot as the previous one. The hermetic --check reads no git state.
2. RegistryTable.releaseAfter computes one release from the base and final rows. RegistryTable.snapshot raises it to the largest since its rows record, preserving the release of a stacked layer whose main base publishes nothing. planDeprecate records the whole change release, so consecutive retirements over a published base have equal since values.
3. Against a published base, the lint refuses both an understated and an overstated release. Each new binding or deprecation records the whole change release; a rebind preserves the since of the term it keeps bound. A base that publishes nothing skips exact-release and new-row since checks.
4. To repair release findings, merge the base when needed, correct each since reported as since-misstated in its source shard, and regenerate with identity registry --write using the same --base. Restoring the base snapshot by hand is no longer needed. After a parent merges, the same lint names the next release and each stale row.
5. Tests cover repeated writes, consecutive deprecations, additions followed by retirement, too-high releases, stale rows, empty bases, literal remedies and coherent random edit sequences. The default and explicit parent-base writes leave this layer byte-identical at 2.0.0. Handler-reachable identity modules are unchanged.

Lane tksr-p1c

Reverse: Restore committed-snapshot release arithmetic and remove exact-release and new-row since checks with a superseding decision.

### P1: writers refuse a since they cannot repair, moves never nest and a namespace is retired by hand, 2026-11-22

A third review of PR #3449 (13 threads, 5 nitpicks) found ways the registry writers, the rebind and the lint could report success on a state the lint later refuses, or follow a path they should not. Each behaviour finding was reproduced with a test that fails on the previous head.

1. **A writer refuses a `since` it cannot repair.** Against a base that publishes a term set, every writer (`registry --write`, `deprecate`, `rebind`, `lint --fix`) now refuses a binding or deprecation the change adds whose `since` is not the release of the change, as a `since-misstated` finding, and writes nothing. The release is still computed, so regenerating repairs it; a `since` is a shard row, so only a shard edit repairs it, and the message says to set it and run the same command again. Before, the writer wrote the snapshot and the lint reported the row afterwards. Rewriting the rows instead would make `registry --write` edit shards, which it never does. The policy of decision `2026-11-22-p1-over-a-base-commit-that-publishes-no-term-set-the-writers-keep-the-release` is unchanged: over a base that publishes no term set there is no such finding.
2. **A move never nests.** `CodeIdMove` refuses ends one of which is under the other. Such a move matches the codes it moved, so a retry after a partial write moved them again (`@beep/p/A/B/x` became `@beep/p/A/B/B/x`) and the documented recovery of a failed write did not hold. With disjoint ends every move is idempotent, which a property test checks, so running the same command again finishes the edit. `rebind` reports the refusal as `nested-move`; the move is made in two rebinds through a third code identity outside both ends that no binding uses, whose temporary module file is created first (a rebind target must name a module) and deleted after the second rebind. An identity that already has bindings will not do, because the second rebind would move them too. The rebind's module check now judges only the codes the move changes.
3. **A code identity names no path outside its package.** `CodeId` refuses a segment of dots alone, so `src/<module path>` never leaves `src`, and the module check treats any code that is not a `CodeId` as naming no module.
4. **A namespace is retired by hand.** `identity deprecate` takes a live term only, and no command retires a namespace. The remedy of `NamespaceDropped`, the lint documentation and the README now say the same thing: restore the shard, or deprecate the namespace IRI and each of its live terms in a remaining shard at the release of the change, then regenerate. A test follows that procedure through the writer and the lint.
5. **Staging and reads.** Each staged write goes to a directory `mkdtemp` creates beside the file, so concurrent writes never share a staging file and an entry left at a fixed path is never followed. The repository's existing atomic writers stage at a random sibling path, but `publishJournalTextAtomically` needs `SecureRandom` and fails with `QualitySchedulerError`, and `writePrivateFile` narrows its directory to `0700`, which a checkout directory must not get, so the registry keeps its own. An explicit `--base` is resolved to its commit before the first git read. The lint plans the shards once for the drift check and the base comparison (`checkRegistryAgainstBase` is gone; `checkRegistry` takes the base), `--fix` writes nothing over a base snapshot that does not decode, a term snapshot left without its registry is drift, and an edit that names no shard, or one shard twice, is refused before any write.

Lane tksr-p1c · PR #3449

Reverse: Drop sinceIssues from planRegistryArtifacts, the CodeIdMove disjointness filter and the CodeId dot-segment guard, and restore checkRegistryAgainstBase and the fixed .tmp staging path.

### P2: AlignedSegment lands in commit 5 with TextNormalization; the rest of LocatorMap stays in commit 6, 2026-11-22

Section 1.4 types NormalizedText.segments as S.Array(AlignedSegment) and section 1.2 places AlignedSegment in src/LocatorMap.ts, while section 10 lists TextNormalization in commit 5 and LocatorMap in commit 6. Commit 5 therefore adds src/LocatorMap.ts holding only the AlignedSegment schema and type, exported from the barrel, so the module list of section 1.2 holds at every commit and no schema moves file later. Commit 6 adds the LocatorMap class with its check, the identity and compose statics and CaptureMismatch to the same file. Every byte and identifier is the one the design names; only the commit that first carries the schema changes.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Move AlignedSegment into TextNormalization.ts and re-export it from LocatorMap.ts in commit 6, or land all of LocatorMap.ts in commit 5.

### P2: an Ambiguous count saturates at Number.MAX_SAFE_INTEGER, so a count there is a lower bound, 2026-11-22

Decision p2-selector-resolution-semantics makes a composite with an ambiguous part Ambiguous with the product of the counts, and Resolution.Ambiguous carries that count as S.Int, whose check is Number.isSafeInteger. A Quote count is at most the text length, but a Range multiplies the counts of its two parts and a Range may nest Ranges, so the product grows without bound: a Range of two Ranges of the quote a over ten thousand a counts 10^16 selections, past 2^53, and the Ambiguous constructor threw. Resolution outcomes are values, never errors (SPEC error boundaries), and Selector is a wire-decodable recursive union, so any decoded selector could reach the throw. resolve therefore saturates the product at Number.MAX_SAFE_INTEGER. Both factors are safe integers, so a product at or below the cap is exact and a product above it is finite; a saturated count is a lower bound on the true count. Ambiguity still fails closed, and no caller reads the count as anything but how many selections matched, which a lower bound past 2^53 still answers. A bigint count or a saturation flag would change the encoded shape of Resolution for a case no real selector reaches.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Carry the count as a bigint or a saturation flag in Resolution.Ambiguous, by a decision file before P3 builds on resolve.

### P2: the AST source map of @beep/md yields verified anchors; pandoc-ast, lexical-schema and html have no text positions to re-point, 2026-11-22

PLAN P2 says AST source maps point at @beep/text. Measured: only @beep/md has a source map (MdSourceMap); pandoc-ast locates by JSON path, and lexical-schema and html record no positions and have no consumer asking for them. P2 adds @beep/md/Md.anchors with anchorAt(map, document, path, source), which reads positionAt, keeps the offsets only when they are naturals with start < end, slices the verified text and returns an Option of VerifiedTextAnchor through verifyTextAnchorAgainstVerifiedSource. The module is bridge-side: the package lists its subpaths one by one, so ./Md.anchors is added to exports and publishConfig.exports, it stays out of src/index.ts, imports only Md.syntax and @beep/text at runtime and @beep/markdown as a type, and Md.import-boundary.test.ts classifies it with the bridge modules. A zero-width or synthetic markdown position has no text, so it is None and is never turned into an empty anchor. MdSourceMap and @beep/markdown Position keep their shapes (markdown is outside the amendment's packages and stays untouched). Chapter 16's source-map sentence is corrected to name md as landed and the other three as added when a phase needs them.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Add a positions feature to the named AST package in the phase that needs it; nothing in P2 depends on its absence.

### P2: authority-identity-cases.json is regenerated in place with a bumped schemaVersion; the oracle equality matrix is unchanged, 2026-11-22

The fixture holds an oracle observation (the 13 by 13 equality matrix and the eyecite inputs) and two derived columns minted by this repository's code: mentionId and expectedId. The scoped amendment says identifiers with no stored rows regenerate their fixtures. P2 rewrites the 13 mentionId inputs from cm1: to cm2: over the same synthetic hex, recomputes the expectedId of the two missing-page cases under citation-authority/v2, bumps schemaVersion to citation-authority-identity-cases/v2 and leaves every other byte, producerSha256 and the matrix included, as captured. The other 11 expectedId values must not change, and CitationAuthorityIdentity.test.ts proves it. A frozen copy beside it would keep 400 lines alive for two derived values; the v1 key derivation is pinned by the migration fixture instead. goals/citation-extraction-engine/history evidence that carries cm1 values is not edited; a dated note in that packet's history records the change.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Restore the v1 file beside a v2 sibling by a decision file; the v1 bytes are in git at the P2 base.

### P2: the biome-256-format-wave hold keeps its dated assertion naming the retired package, 2026-11-22

hold-ledger/claims.jsonl line 8 asserts, as recorded on 2026-10-17, that newer Biome releases reformat the sources of @beep/html and of the package P2 retired. The ledger is append-only and docs/runbooks/hold-ledger.md allows a new version only with fresh evidence (a probe run, or a qa.judge verdict for a Judgement hold), so an edit in place is not allowed and a renewal that only renames a package would be one without evidence. The hold targets nothing by package name: its anchors are the @biomejs/biome catalog entry and syncpack held entry, and its falsifier is a root biome check . count, which reads the moved sources under @beep/text wherever they are. The assertion is therefore left as the dated observation it is; the next renewal or the format wave that ends the hold names @beep/text. The delete-package doctor does not report the ledger as residue.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Append a renewal version of biome-256-format-wave that names @beep/text, with a fresh Biome probe or qa.judge verdict as its evidence.

### P2: the cache-baseline request names @beep/provenance in previous only, not among its subjects, 2026-11-22

Section 3.1 of research/2026-11-20-p2-design.md says the request's subjects name every changed subject, @beep/provenance included. bun run beep cache baseline refuses that request: the retired package is no longer in the task graph, and the command reports it as an unknown subject. The request docs/reports/tksr-p2-l1-move-cache-baseline-request-2026-11-22.json therefore lists the 22 subjects in the graph (the root, 20 consumers and @beep/text) and keeps the retired file's digest in previous. The command then drops standards/cache-baseline/@beep/provenance.json as a subject that left the graph (printed as Dropped), so no baseline file is deleted by hand, which is what the design asked for. bun run beep cache audit and bun run beep quality cache-policy read 0 blocking findings afterwards.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Add @beep/provenance to the request's subjects once beep cache baseline accepts a subject that left the task graph, and re-record.

### P2: commit 13 gates the check census and leaves the re-measure to the final check, 2026-11-22

Section 10 says the census is measured once at the end, on a built tree, after the last merge of the parent branch, and that merge has not happened. Commit 13 therefore runs the gate (bun run beep quality check-census --gate-only on a tree built with bunx turbo run build for the upstream of @beep/repo-cli, @beep/law-practice-domain and @beep/schema) and does not rewrite the baseline. The gate passes: @beep/law-practice-domain and @beep/schema are unchanged, @beep/repo-cli grew by 26602 instantiations (+0.32 percent, inside the 10 percent band) since the baseline of 2026-11-20, and no row failed. The re-measure with --write-baseline runs after the parent merge, before yeet final-check.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Run bun run beep quality check-census --write-baseline on this head and commit the rewritten standards/check-census.regression-baseline.jsonc.

### P2: mention ids are cm2 over a bare-hex digest, only the case-occurrence authority key bumps its tag, and the preimage belongs to law-practice, 2026-11-22

CitationMentionId becomes cm2: plus 64 hex, where the hex is the ContentHash of (citation-mention/v2, engineArtifact, semanticKind, OccurrenceId) without its sha256: prefix. The prefix bump keeps v3 and v4 receipts distinguishable on sight and lets the frozen v3 schema own cm1:. The bare-hex display form is the slice's existing token shape; the digest behind it is the standard one. The preimage is declared with definePreimage in packages/law-practice/server/src/internal/Citation/MentionIdentity.ts, not in @beep/text: citation kinds are legal semantics, which SPEC keeps out of foundation, so the CitationMention* exports of the design module are not moved into the package. Authorities: only the case-occurrence key embeds a mention id, so only that key changes its tag to citation-authority/v2; the case, law, journal and external-resource keys keep citation-authority/v1 and their ids. The ca1:, cl1: and cg1: prefixes stay, because they version the token format and the default-path cl and cg ids are a slice of the authority digest: they change exactly when that digest changes, which is the bumped tag p0-rq4 asks for. cd1 and the session-node cl1 and cg1 ids have no mention id in their preimage and do not change. Side-by-side goldens over the existing test source: cm1:dc70e426b0b9aa61caf21a5e6e0c7274720c7e674ff2b06a8cdfd82ee0346ae9 and cm2:7ece8d5655b197d8063442248a8f630cd05fee535fe5ae550f2b15754425cd44; its case-occurrence authority ca1:7f43ae8777fd804f01172cce2e73b1762c712f9f7e4c8d08bffdb58a49341bf6 (v1) and ca1:4d2adc3d142ce1c3a4b028bde50b9f27253a829404d1f7d773442e6d6ab5ee13 (v2).

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Return to cm1 with a further receipt version step and its own read-time transform; the v1 encoder is kept as a pinned historical encoder.

### P2: a composite rewrite absorbs text the second map inserts inside the first map's rewrite, so Exact through a composite is relative to the composite, 2026-11-22

LocatorMap.compose cuts the middle capture only at edges that are not strictly inside a Rewritten segment of either map (decision p2-reanchoring-shape-and-lax-direction). When the second map inserts text at an offset strictly inside a Rewritten segment of the first, that offset has no preimage in the first capture, so no cut can show the insertion: the piece over the rewrite becomes one Rewritten segment whose target includes the inserted text. Reproducer: ab rewritten to xy as one segment, then _ inserted between x and y (Kept 0..1 to 0..1, Kept 1..2 to 2..3); compose gives Rewritten 0..2 to 0..3; the occurrence 0..2 maps Exact to xy and then Widened to x_y stepwise, and Exact to x_y through the composite, with the same range. The AlignedSegment schema has two cases and a Rewritten segment already means text the step changed as a whole, with a target of any width; the composite is a coarser map, and a whole-rewrite image that lands on its edges is Exact relative to that map. A third segment case or a mark on Rewritten would change the encoded LocatorMap shape for a fact no consumer reads in P2. The laws stay as stated: when both steps and the composite are mapped, the stepwise range is inside the composite range, and Exact then Exact composes to the same Exact. The converse does not hold and is not claimed: Exact through a composite does not imply that every step was Exact. An image that spans text inserted between two segments of one map stays Widened, as before. LocatorMap.test.ts and Reanchoring.laws.test.ts pin the reproducer. Found by the verifier of commits 5 and 6.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Give AlignedSegment a third case that keeps inserted text visible and have compose emit it, by a decision file before P3 records a composite re-anchoring.

### P2: coverage rows written at 100 percent for new files count as registration under S31, 2026-11-22

Commit 13 re-records the coverage rows of @beep/text, @beep/rdf and @beep/md with the scoped writer (bun run coverage -- --filter=... --write-baseline). The writer drops the row of the deleted rdf/src/Evidence.ts and adds one row per file the old rows did not name: the ten new @beep/text modules, md/src/Md.anchors.ts and eleven rdf files that had no row (NamespacePin.ts, the generated NamespacePins.data.ts, the Dcat, Shacl and Void vocabularies and the generated term modules of Dcat, Oa, Prov, Shacl, Void and Xsd; all but the two Dcat files are new since the P0 base). Every added row records 100 percent on lines, statements, branches and functions with zero uncovered units, so it records no debt: it is the same bar the hosted ratchet applies to a file without a row. Under S31 those rows are registration, as S31a treats a re-stamped cache-baseline review for a new package, and the per-file line count of research/consumer-census.md grows by them (provenance and text 4 to 14, rdf 38 to 47, md 17 to 18). Rows below 100 percent are existing rows that the write raised (rdf/src/Rdf.ts, several md modules); no row was lowered.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Re-run bun run coverage -- --filter=@beep/text --filter=@beep/rdf --filter=@beep/md --write-baseline from the P2 base rows and drop the added file rows, leaving the hosted ratchet to judge the files as new.

### P2: webAnnotationTargetToTextAnchor refuses ill-formed text on every path, so a decoded anchor always re-encodes, 2026-11-22

Section 4.1 converts every position selector through convertPosition, which refuses a lone surrogate before the range end as ill-formed-text, but a quote-only target goes through resolve, which reads UTF-16 and accepts such text. The two paths would then disagree: a quote-only target over ill-formed text would decode to a candidate anchor that textAnchorToWebAnnotationTarget refuses, so decoding then encoding would not be total on what decodes. The quote-only path therefore converts its resolved range to code points as the encoder does and returns the same ill-formed-text refusal. Every anchor the decoder returns now encodes again. Text after the range end is not checked on either path, as convertPosition does not check it.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Drop the code-point check on the quote-only path of webAnnotationTargetToTextAnchor by a decision file; quote-only targets over ill-formed text then decode to anchors the encoder refuses.

### P2: the delete-package doctor reads dated records as history, fixed by its own small PR; the move commit is gated on a listed residue, 2026-11-22

delete-package ends with a doctor whose authored-references surface skips only goals/, research/ and .changeset/. Dated records in explorations/ (55 files) and docs/reports/ (15 files), the entries of standards/architecture/DECISIONS.md and the retired-package registry itself therefore count as residue of @beep/provenance, and the post-apply doctor exits 1 for any package a dated record names (checked: delete-package @beep/venice-ai --check, a package deleted weeks ago, exits 1). --acknowledge cannot accept them: standards hits are baseline hits, and docs and explorations are outside the dependents scan. Rewriting dated records would falsify them. The fix is one predicate in RegistrationGeometry.probes.ts that names the historical paths (goals/, research/, .changeset/, explorations/, docs/reports/, standards/architecture/DECISIONS.md, standards/changesets.retired-packages.json), used by the authored-references skip and the historical-records surface, with the surface declaration in RegistrationGeometry.plan.ts and cases in delete-package.test.ts; standards/architecture chapters and the glossary stay live and must be rewritten. The doctor is outside P2's files, so it is a small PR off main, opened before the move commit. The move does not wait for it: the apply runs every writer before the doctor, so a failure that reads post-apply doctor found residue means the writers finished, and the commit 2 gate is that the residue is a subset of the list in section 3.2. The final check requires a clean --check with --allow-stale-packets, which the check needs because it runs the same preflight.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Revert the doctor PR; the residue list of research/2026-11-20-p2-design.md section 3.2 is then the only gate of a package retirement.

### P2: isWellOrdered is deleted; every L1 range is non-empty, 2026-11-22

TextAnchor.isWellOrdered and its alias accept start == end, against TextAnchor, Position and every other L1 range, which require start < end. The map found no consumer outside the owner's tests. P2 deletes both with their tests instead of keeping a predicate that disagrees with the schema beside it. isInternallyConsistent, isUtf16Boundary and the rest of the 21 exports keep their names and behaviour.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Restore the static and its export from git.

### P2: langextract offset ranges, locate and history, and the law-practice quote projections, move in P3; P2 re-points their imports only, 2026-11-22

The census sends langextract TextOffsetRange and Utf16TextRange, and law-practice TextQuote, SourceRef and SourceQuote, to P2 and P3. The PLAN P2 row names none of them. P3 rewrites the langextract handoff and IrToLaw over the annotation document, so re-expressing their spans in P2 would edit the same code twice and put a behaviour change (refusal types, yield points, the million-unit limit) inside the mechanical package move. P2 changes only import paths in those files; the NFKC cluster defect found in VerifiedSpan.normalization.ts is fixed by its own small PR off main (decision p2-nfkc-clusters-join-on-the-normalized-mark), not inside P2. A P2 test in @beep/langextract asserts that convertTextOffsetRange and convertPosition agree on generated well-formed text and valid ranges for both shared units, so P3 starts from a proved equivalence. GroundedExtraction and the attempt records that embed it stay byte-identical.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Re-express convertTextOffsetRange on convertPosition inside the P2 PR by a decision file; its consumers are langextract, law-practice server OccurrenceProjection and two law-practice tests.

### P2: the agent-memory read-time OccurrenceId lands before feat/agent-memory-store-p3, as a function outside the payload schema, 2026-11-22

Decision p0-rq4 sequences this after that goal's open lane merges. The lane (c93b36cb77a, unpushed, no PR, last commit 2026-11-13) does not touch OccurrenceAnchor, SpanAnchor.models.ts or the anchor field of NodeCreated; its only overlap is the import line. Waiting on it has no end condition, so P2 lands first and the lane merges main. The derivation is occurrenceIdOf(anchor) in SpanAnchor.models.ts: it builds the receipt from source and anchor, maps the stored utf16 literal to utf16-code-unit by matching TextUnit, and calls mintOccurrenceId. It is not a payload transform: an effectful payload schema would put Digest into the event journal's decoding services. The stored literal, the three keys and the encoded field shapes stay, so the SchemaBinary layout is unchanged, and a fixture captured from the code before P2 proves it: frozen bytes decode, derive the golden id sha256:654d949fc9259fd7b3b3d90ef96c270b444cfece9feb03f15dfe29013001a06d and re-encode to the same bytes.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Drop occurrenceIdOf and its fixture test; the stored events and every schema stay as they were.

### P2: an NFKC cluster also joins a letter whose NFKC form starts with a combining mark; langextract's scan gets the same fix in its own PR, 2026-11-22

The joins-cluster scan of @beep/langextract joins a scalar that is a combining mark, or that normalizes differently together with the open cluster. Four letters have an NFKC form that starts with a mark: U+0E33, U+0EB3, U+FF9E and U+FF9F. Such a letter does not join, opens its own cluster, and a mark after it then composes with the previous cluster in the whole text but not in the segments. Measured on this base: normalizeTextLocator of Z, U+FF9E, U+0323 gives Z, U+3099, U+0323 where NFKC gives U+1E92, U+3099. The P2 simulation refuted the rule (84 of 100,000 strings) and the corrected rule passed it on 350,000 strings. @beep/text joins a scalar when its own NFKC form starts with a mark or when the pair normalizes differently. The langextract defect is live on main and outside P2's files, so it is fixed by a small PR off main: the combining-mark test of VerifiedSpan.normalization.ts reads the normalized scalar, with the fixture above and a property over the same alphabet. The old form of a text differs from its NFKC form only by canonical order and composition, so two texts with equal old forms have equal new forms and no persisted association that decoded before should be refused; the PR checks that over the same alphabet against a test-local copy of the old rule before it lands.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Join on the scalar's own category again in @beep/text; Normalization.test.ts then fails on the fixture Z, U+FF9E, U+0323.

### P2: @beep/text defines no Context.Service, 2026-11-22

Every L1 arrow is a pure function of its arguments or needs only core's effect/crypto/Digest service. There is no second implementation, no state, no IO and no policy to swap, so a service would be a name for a function. resolve and convertPosition are synchronous values (Resolution, Result); mintOccurrenceId, mintQuoteKey, reanchor and the verify functions are Effect.fn with Digest in their requirements. The service that resolves a SourceTextIdentity to text already exists as a port in @beep/file-processing with its workspace implementation, and stays there.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Add a service contract in the capability that first needs a replaceable resolver, by a decision file.

### P2: normalizeText takes the text first and the normalization second, the data-first order of every dual in @beep/text, 2026-11-22

Design section 1.7 writes normalizeText(normalization, text): NormalizedText. The implementation is dual(2, (text, normalization) => ...), so the data-first call is normalizeText(text, normalization) and the data-last call is normalizeText(normalization)(text). The repo's dual convention puts the data first, and every other dual of the package does: normalizeQuote(quote, normalization), mintQuoteKey(quote, normalization) (design 1.4), convertPosition(position, unit, sourceText) and slicePosition(position, sourceText) (design 1.5), resolve(sourceText, selector) (design 1.6) and reanchor(anchored, map, target) (design 1.8). The text is the data a normalization acts on, so section 1.7 is read as naming the parameters, not fixing a positional order, and its curried reading normalizeText(normalization)(text) is the data-last form the dual provides. Swapping the order would make normalizeText the one dual in @beep/text whose first argument is not the data, and its data-last form would curry over the text. Found by the verifier of commits 5 and 6.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Swap normalizeText to (normalization, text) data-first and normalization-last curried, by a decision file, updating every caller in one commit.

### P2: OccurrenceId is minted from a receipt through definePreimage with a literal canonical unit; the citation path keeps its proof gate, 2026-11-22

OccurrencePreimage is declared with @beep/jsonc/Mint definePreimage under domain tag occurrence/v1 with a committed golden vector, so a changed preimage fails its golden check unless the tag is bumped. The tuple is the one p0-rq4 fixes. Its unit slot is S.Literal("utf16-code-unit") rather than OffsetUnit: one range in two units would otherwise be two ids for one occurrence. mintOccurrenceId takes Anchored, a powerless receipt, because the id is a function of the receipt's fields and not a claim of proof: the L2 anchors table, the memory read path and the v3 receipt transform all hold receipts. The proof gate stays where it is today: makeCitationMentionId still accepts only a genuine VerifiedTextAnchor, projects it to its receipt and then mints. The error channel is PreimageMintError (schema error or canonicalization error); a quote with a lone surrogate, which TextAnchor admits, fails there. Goldens were checked on this base: the vector over the existing cm1 test source gives occurrence sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48 through the production minting function and through an independent SHA-256 over the JSON text.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Type the unit slot as OffsetUnit again or require a VerifiedTextAnchor in mintOccurrenceId, by a decision file that bumps occurrence/v1 if the bytes change.

### P2: one PR, stacked on PR C, thirteen commits, opened once PR C is merged or on the orchestrator's word, 2026-11-22

P2 ships as one PR from goals/text-knowledge-stack-rebuild-p2-text, a stack layer on PR C (#3449). With B (#3439) and C open that is three open PRs, the packet limit, so no second P2 PR opens. Chapter 11 rule 3 (retire in the PR that migrates the consumers, no alias) makes the package move indivisible; the L1 additions, the citation step, the rdf, party, md and memory changes are separate commits on top of it. The 2026-11-20 P1 checkpoint says P2 opens after PR C merges and the chapter-11 amendment is effective. The amendment is on origin/main (DECISIONS.md, 2026-11-19 scoped amendment). The lane may be built and proved while C is open; the PR itself opens after C merges, or earlier as a stack layer only when the orchestrator and the CI goals driver say so. The commit order is in research/2026-11-20-p2-design.md section 10. Two small PRs off main come first and are not packet PRs: the delete-package doctor and the langextract NFKC cluster rule, both defects found while designing in files P2 does not otherwise own. Every step before the rename only adds fixtures that today's code already satisfies, so byte-stability is proved by tests that are older than the change.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Split the commits at the boundary after the rename (commit 2) into two PRs by a decision file; the commit order already makes that cut clean.

### P2: @beep/text is scaffolded, the three modules move with git mv, and delete-package retires @beep/provenance in the same commit, 2026-11-22

bun run beep create-package text --family foundation --kind modeling --type library --description "Text identity, anchors, selectors and occurrence identity" creates the package and registers $TextId (dry run on this base confirms the path packages/foundation/modeling/text). SourceTextIdentity.ts, TextAnchor.ts and VerifiedTextAnchor.ts and their tests move with git mv and keep their module names, so every importer changes only the package segment (@beep/provenance/X becomes @beep/text/X). When no import, manifest, script or path hit is left, bun run beep delete-package @beep/provenance --allow-stale-packets removes the empty workspace, its identity segment, shape row, coverage rows, catalogs and lockfile entry, and the writers run before its doctor. The doctor cannot read clean on this base for any package a dated record names (docs/reports, explorations, DECISIONS.md and the retired registry are residue), so the gate of the move commit is a residue list no larger than the one in research/2026-11-20-p2-design.md section 3.2, and the clean --check is a gate of the final check, after the doctor fix of decision p2-delete-package-doctor-reads-dated-records-as-history is in the lane. Both calls take --allow-stale-packets because the packet hits are history of other goals and stay frozen. Before the dry run the 18 manifests are edited, the lockfile and config-sync run and the allowlist snapshot is regenerated, because preflight refuses on tsconfig hits and the command's own sync runs after preflight; the dry run must print 0 hard hits. The four ops/design modules are import-prod hits that nothing can acknowledge, so the codemod covers them; --acknowledge is not used, since every file-path hit is rewritten. The name @beep/provenance is added by hand to standards/changesets.retired-packages.json after the deletion, because the CLI's --retire-changesets flag does not write the row. No changeset is written (private workspaces). The scratchpad workspace (three effect-ontology files, its package.json, tsconfig and porting ledger) and packages/shared/domain/README.md are importers the 156-file census does not count; both move in the same commit. Inventory, fallow, allowlist and coverage rows move with their files and count as renames under S31, as in decision p1-s31-rows-move-with-the-file.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Re-create packages/foundation/modeling/provenance from the parent commit and invert the import codemod; no stored bytes name the package.

### P2: the party TextSpan case is deleted and replaced by a TextOccurrence case over Anchored; the party OccurrenceId becomes ArtifactOccurrenceId, 2026-11-22

TextSpan has no producer and no stored row; its one use is a negative decode test. It cannot be minted into an OccurrenceId (no extractor, no normalization version, no prefixed digests, no unit). The union keeps the ability to point at text: TextOccurrence { occurrence: ArtifactOccurrenceId, anchored: Anchored }, where Anchored is the @beep/text receipt. A bare OccurrenceId would name a place without saying where it is, since party has no anchors table, and the SPEC sentence that TextSpan becomes a text occurrence is met with the id derivable from the receipt. The case tag changes, so old TextSpan JSON is refused. HeaderField, MetadataTag and RecordRow are unchanged: they are not text selectors and no fragment specification IRI is invented for them. The party identifier that identifies a record occurrence is renamed ArtifactOccurrenceId, after the ArtifactOccurrence entity it keys; the party-occ prefix and every value stay. The party ActivityId and Digest and the private cli Codex OccurrenceId const share a word with a stack name and no reserved name; P4 decides ActivityId with the claims layer, and the cli const is module-private and stays.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Restore TextSpan and the old name from git; no row and no producer holds either.

### P2 corrects P0: three stored columns hold an anchor shape, one derived key hashes a receipt, and legal_position_relator.grounding holds none, 2026-11-22

Measured by the P2 provenance map. Stored anchor shapes: epistemic_evidence.span (EvidenceSpan), epistemic_evidence_verification.verified_anchor (a TextAnchorVerificationReceipt; a VerifiedTextAnchor is runtime-only and cannot be stored) and law_practice_patent_citation_event.grounding (a receipt). epistemic_evidence_verification.manifestation_key is a SHA-256 over the canonical JSON of the encoded receipt, so any change to the encoding of TextAnchor, SourceTextIdentity or the receipt would orphan every key. law_practice_legal_position_relator.grounding is a LegalPositionGrounding and holds no anchor. The P0 text that counts four columns and calls verified_anchor a VerifiedTextAnchor (decision p0-rq4, decision p0-census-dispositions, SPEC, census section f, DECISIONS.md) is read with this correction. The rule does not change: their bytes stay. P2 pins one frozen row per anchor column and one golden manifestation key before any code moves.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Edit this file if a re-measurement on origin/main finds another column; SPEC and the census follow it.

### P2: QuoteKey normalizes the quote itself under its own QuoteNormalization version, separate from SourceTextIdentity.normalizationVersion, 2026-11-22

SourceTextIdentity.normalizationVersion is the version of the locator-only normalization contract of one capture; it is occurrence identity. Quote grouping needs a different thing: one fold that makes two spellings of a passage group together. They are two versions, so the design module's mintQuoteKey(normalizationVersion, normalizedQuote) is replaced by mintQuoteKey(quote, normalization) where QuoteNormalization is LiteralKit(["nfkc-dehyphenate/v1"]) and the function applies the fold. A caller can no longer mint a key over text it did not normalize. The preimage is (quote-key/v1, normalization literal, normalized quote). QuoteKey stays explicitly non-injective and is never an identity; L1-4 asserts that three repeated passages share one QuoteKey and have three OccurrenceIds.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Take an already normalized quote and a caller-supplied version string again, as the design module did, and bump quote-key/v1.

### P2: rdf Evidence.ts and its codecs are deleted with no full-union replacement; the trustgraph script gets a local schema, 2026-11-22

EvidenceSelectorKind, the three selectors, EvidenceSelector, EvidenceTarget, EvidenceAnchor, BoundedEvidenceProjection and the nine evidence codecs in Adapters/WebAnnotation.ts go. They have no package or app consumer and every transform throws a defect on bad input. A DTO codec over the whole Selector union is not written: it would need RangeSelector and refinedBy DTOs plus two unregistered oa terms (a term-snapshot release), and the OA profile of p0-item7, which P3 implements, has only the position and quote selectors. The census missed one consumer: goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts decodes a frozen evidence artifact with BoundedEvidenceProjection through a relative path that no typecheck covers and that reference goal's rerun.verify runs. The script gets a local schema for the frozen shape (anchors of text-quote selectors, truncated) so the rerun still works; the artifact is not edited. Census row f-1 records the narrowings: positions are non-empty and unit-tagged, Fragment.conformsTo is required, and EvidenceAnchor id and note have no L1 counterpart (the WebAnnotation DTO keeps id and bodyValue).

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Restore Evidence.ts from git; the frozen trustgraph artifact decodes with either schema.

### P2: a re-anchored range the target text cannot hold is Unmapped split-boundary, 2026-11-22

Section 1.8 step 6 builds the TextAnchor from the target slice and verifies it, and a refusal is Unmapped split-boundary. A LocatorMap carries no text length, so a map whose target ranges run past the end of the target capture's text passes LocatorMapCheck, and the slice of such a range is shorter than the range: TextAnchor.make would throw on the width check instead of reaching verification. reanchor therefore checks the end of the image against the target text first and returns Unmapped split-boundary, the outcome verification gives for an end past the text (invalid-anchor). No new UnmappedReason is added: the design fixes the four reasons, and a range the target text cannot hold is a range whose boundaries are not boundaries of that text. A kept part that falls past the end is still quote-mismatch, because the kept comparison runs first. The segment lookup that compose and reanchor share is a binary search in src/internal/segments.ts, beside internal/scalars.ts; it is not exported from the package.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Add an UnmappedReason for a target range past the text, or treat it as quote-mismatch, by a decision file before P3 records a re-anchoring.

### P2: Reanchoring carries the target receipt, LocatorMap segments are Kept or Rewritten, and laxity is stepwise below composite, 2026-11-22

DECISIONS.md (2026-11-19) says re-anchoring is a recorded map with its own receipt, but the design module's cases held two ids and no receipt, so a caller could not read the new range. Exact and Widened become { from: OccurrenceId, to: Anchored }; to is produced by verifyTextAnchorAgainstVerifiedSource on the target capture and projected, and its id is minted from it, never stored beside it. LocatorMap segments become a tagged union: Kept (equal width, offsets inside map pointwise) and Rewritten (the segment maps only as a whole), both with UTF-16 positions, ordered and disjoint on both sides; a gap is unmapped. Exact means both boundaries land on a segment edge or inside a Kept segment; Widened means a boundary fell inside a Rewritten segment and the image grew to its edge; Unmapped otherwise. UnmappedReason becomes capture-mismatch, outside-map, split-boundary and quote-mismatch: ambiguous and quote-not-found are removed because no quote search takes part in reanchoring, and quote-mismatch is the refusal when a Kept segment's target text differs from the source quote. A range whose image spans text inserted in the target is Widened. Results are ordered by range inclusion, and the lax comparison runs from the two steps to the composite map: whenever reanchor by f then g and reanchor by compose(f, g) are both mapped, the stepwise range is inside the composite range; when both steps are Exact the composite is Exact with the same range; the identity map gives Exact with the same id. The comparison is not claimed against Unmapped: a first map may insert text that the second does not cover, so the steps can be Unmapped where the composite is not, and the composite may drop a straddling piece the steps kept. On maps without gaps Unmapped does not occur for an in-range occurrence and the comparison is total. compose cuts the middle capture at offsets that are not inside a Rewritten segment of either map and drops a piece that touches a gap. A throwaway simulation of these rules on this base found no counterexample: 400,000 random map pairs with gaps and 300,000 without, with 126,000 and 151,000 Exact pairs composing exactly; it did refute an earlier form of the law that put Unmapped on top of the order. @beep/text owns the two text normalizations L1-3 tests (nfkc and dehyphenate), each returning the text and its segments; the NFKC segmentation is the joins-cluster scan, since grapheme clusters alone are unsound (compatibility jamo compose across them), with the join rule of decision p2-nfkc-clusters-join-on-the-normalized-mark. The dehyphenate segment is the whole context its rule reads: the preceding scalar, the removed run and the following lowercase scalar are one Rewritten segment, and matches that share a scalar merge. With the following letter outside the segment naturality is false: in exam-, line break, ple the range of exam-, line break lands on segment edges and maps Exact to exam, while the normalization of that quote keeps its hyphen. A second simulation checks, for both normalizations, that the segments concatenate to the normalized text and that every Exact scalar-boundary range has the normalization of its quote as target, and the same for dehyphenate after nfkc: 350,000 random strings salted with hyphen breaks and every scalar NFKC changes, 13.9 million ranges, 12.2 million of them Exact, 966,000 composed Exact chains, no counterexample. The same script refutes both earlier segmentations.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Return bare OccurrenceIds and untagged segments again, as the design module did, by a decision file before P3 records a re-anchoring.

### P2: the receipt read functions fail with one sanitized CitationReceiptReadFailure; the codecs keep the reason as an issue message, 2026-11-22

readCitationDocumentReceipt and readCitationMentionReceipt, the only decode path for a receipt from outside the process, map every refusal to CitationReceiptReadFailure, a tagged error with no fields. A schema issue over a receipt can quote source text, and every other citation boundary in the server is sanitized the same way (CitationMentionFailure, CitationDocumentFailure). The reason is not lost for in-process callers: CitationDocumentReceiptRead and CitationMentionReceiptRead fail with InvalidValue issues whose messages name the refusal (a stored cm1 that is not its own recomputation, a mention reference the receipt does not hold, a mention that cannot be minted under citation-mention/v2, a standalone v1 receipt with warnings), and CitationMentionMigration.test.ts asserts each message through the codec and the sanitized failure through the read function. No caller distinguishes the reasons today; the first consumer that must, adds them.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Give CitationReceiptReadFailure a LiteralKit reason per refusal (stale-cm1, dangling-reference, unmintable, not-a-receipt) and map the issue to it.

### P2: v3 citation receipts convert to v4 through a server read codec that checks the stored cm1 and grants no proof, 2026-11-22

The live schemas become citation-document-receipt/v4 and citation-mention-receipt/v2 (the nested receipt's id changes meaning, so its version moves with the document). The read side is CitationDocumentReceiptRead in law-practice server, a union of the live schema and a frozen v3 schema decoded into it with SchemaGetter.transformEffect; encoding v3 is SchemaGetter.forbidden, so writes are always v4. It lives in the server because it needs Digest; the domain schema stays service-free. The frozen v3 schema types only what the step reads or rewrites (version tags, id positions with frozen cm1, ca1, cl1 and cg1 templates, engine artifact, citation.type and the anchor receipt) and passes every other encoded field through; the live v4 schema then decodes the result, so the coherence filter runs on it. Before minting, the pinned v1 encoder recomputes each cm1 and a mismatch is refused: a transform must not turn a stale or tampered id into a fresh one. Case-occurrence authorities are found by recomputing their v1 key, never by looking at the page component. Every reference is rewritten through the old-to-new maps and a dangling reference is refused. The converted receipt is still powerless: restoreCitationDocument re-verifies the source text and the anchors and re-mints every id. Neither restore function has a caller outside the tests and the package exports map ./internal/* to null, so the read codec and restore are both internal; the first consumer that holds a receipt exports their composition (read, then restore) from a public subpath, and until then CitationMentionMigration.test.ts is the only place that composes them. Out-of-band CitationResourceBinding values are adapter expectations that no one stores; adapters re-derive them and receive cm2 ids, so they are not converted. A standalone v1 mention receipt converts through the same mention step (CitationMentionReceiptRead); CitationEngineResolutionInput is a served input with no stored rows and refuses v1 under the amendment.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Delete the read codec and refuse v3 again by a decision file that records that no v3 receipt is held anywhere.

### P2: a Refined selector over a base that is not Unique resolves to the base's outcome, 2026-11-22

Decision p2-selector-resolution-semantics says Refined resolves by inside the segment base selects, and that a composite is NotFound when a part is NotFound and otherwise Ambiguous with the product of the counts. It does not say what by is resolved in when base is Ambiguous: there is no single segment, and Resolution carries a count, not the candidates. resolve therefore does not evaluate by over an ambiguous or absent base; the Refined outcome is the base outcome (Ambiguous with the base count, or NotFound). The product rule stays for Range, whose parts are both resolved over the whole text. The outcome still fails closed exactly when it should: a Refined selector is Unique only when its base is Unique and by is Unique inside it. Counting every by match inside every base candidate would need candidate enumeration, which the design rules out (callers that need candidates search for them explicitly), and a nested Refined would multiply that work.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Resolve by inside every candidate of an ambiguous base and report the summed count, by a decision file before P3 builds on resolve.

### P2: live standards and the cache baselines stop spelling the retired package name; the doctor is not widened, 2026-11-22

The final gate of research/2026-11-20-p2-design.md section 10 needs delete-package --allow-stale-packets --check to print clean. After the doctor fix of preparatory PR a it still found residue in 24 live files, all written by this lane: chapter 16 and the glossary named the retired package, and the review reason of the commit-13 cache request, which bun run beep cache baseline copies into every subject it stamps, spelled it in 22 baseline files. Chapter 16 and the glossary now say the former provenance package; decision p2-delete-package-doctor-reads-dated-records-as-history already holds that these chapters stay live. The baselines are re-stamped through the repo route with docs/reports/tksr-p2-l1-reason-cache-review-2026-11-22.md and its request; the diff touches only the review block of each file, and cache audit and cache-policy read 0 blocking findings. Widening the doctor's history predicate to cache-baseline reason fields was not taken: a baseline file is live configuration, and a predicate that skips part of a live file would hide a real reference there. The --check now prints clean.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Restore the package name in chapter 16, the glossary and the baseline review reason, and extend the delete-package history predicate to cache-baseline review fields instead.

### P2: schema identifiers follow the package to @beep/text and the epistemic identifier fixture is regenerated, 2026-11-22

packages/epistemic/domain/test/fixtures/value-schema-identifiers.txt pins 20 @beep/provenance/... annotation identifiers, and its test comment says they never move. They move in P2: an identifier is a schema annotation composed from a code path, not a published term (no registry shard or term-snapshot row names provenance, so L0-3 is not involved) and not a stored value (no reader of these strings exists outside the fixture). Keeping the old segment would be an alias for the retired name, which chapter 11 rule 3 forbids. The fixture is regenerated in the rename commit with exactly those 20 lines changed, and the later well-formedness commit adds the WellFormedText lines. The comment in ValueSchemaIdentifiers.test.ts is corrected: the fixture records identifier changes so they are reviewed, and a package rename under a decision is a reviewed change.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Give @beep/text a composer that keeps the provenance segment for the three moved modules and restore the fixture from git, by a decision file.

### P2: selector semantics follow the W3C model: Range ends before the end selector, Refined is relative, Fragment resolves NotFound, 2026-11-22

The design module described Range as the span from the start of from to the end of to. The W3C Web Annotation model (4.2.8) says the selection runs through to the beginning of the ending selector, but not including it, and endSelector is the exclusive end point. The union claims to be the Web Annotation selector algebra, so P2 follows the specification; an empty or inverted result is NotFound. Refined applies by inside the segment base selects, with offsets relative to that segment. Fragment.conformsTo is a required absolute IRI: a fragment without a specification cannot be interpreted, so it is not a selector of this algebra; DocumentAnnotation keeps its fragment as a wire DTO without conformsTo. No fragment specification is interpreted over plain text in P2, so resolve returns NotFound for every Fragment. Position resolves through convertPosition and is NotFound when the conversion refuses. Quote counts every occurrence at scalar boundaries whose context matches, overlapping occurrences included, in one linear scan whose needle is prefix, exact and suffix together: one is Unique, two or more are Ambiguous with the count, and the first hit is never returned. A composite selector whose part is NotFound is NotFound; otherwise any ambiguous part makes it Ambiguous with the product of the counts. Unique always carries a utf16-code-unit position and the slice.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Make Range run to the end of its end selector, or interpret a fragment specification, by a decision file before P3 builds on resolve.

### P2: SourceTextIdentity strings are well-formed on decode; no stored row can hold a lone surrogate except an attempt-log row, which is refused, 2026-11-22

scopeRef, sourceRef, extractor.name, extractor.version and normalizationVersion become @beep/schema/WellFormedText (non-empty, no lone surrogate), and locator becomes the exported SourceTextLocator (PosixPath with a well-formedness filter), which OccurrencePreimage reuses. This is the one narrowing decision p0-census-dispositions already accepts, because RFC 8785 cannot canonicalize a lone surrogate and an identity that cannot be minted is not an identity. The check applies to decode as well as construction. Under the stored-format law that would be an incompatible change if a stored row could hold a lone surrogate. The stores were censused over every field type, S.fromJsonString, text column, TEXT payload and file writer in the importing packages. (1) epistemic_evidence_verification.verified_anchor and law_practice_patent_citation_event.grounding are jsonb, and Postgres refuses an unpaired \ud800 or \udc00 escape at input (measured on PGlite 0.5.16, PostgreSQL 18.6: invalid input syntax for type json; a paired escape is accepted). (2) The agent-memory node events are SchemaBinary bytes written through TextEncoder, which replaces a lone surrogate with U+FFFD, so a decoded event string is always well-formed. (3) The semantica ledger writes TEXT payloads through canonicalJson, which throws on an unpaired surrogate before the insert. (4) The office-action attempt log (OfficeActionStructure.repo.ts, JSON lines) can hold one: JSON.stringify writes the ASCII escape \ud800 and S.fromJsonString reads it back. No such log exists, because officeActionStructureFileStore has no caller outside its test, and the row is refused on purpose: the only total read-time step would replace the surrogate with U+FFFD, which changes scopeRef (the matter-wall input and half of the predecessor-chain key) and can merge two scopes, and a permissive type in one store would be a second source identity. The store already fails closed with OfficeActionStructureStorageError on a row it cannot decode. Well-formed attempt rows stay byte-identical: commit 1 freezes two rows written by today's store and commit 3 adds the refusal case. (5) A v3 citation receipt held as JSON text could in principle spell an escaped lone surrogate; such a receipt has no OccurrenceId under any design, and the read transform refuses it with a schema issue. Two tests keep the first two facts true: a PGlite case in the epistemic server integration tests that inserts an unpaired escape and expects the refusal, and a SchemaBinary case in the agent-memory tests. The well-formed pattern is not re-spelled: VerifiedTextAnchor's private WellFormedSourceText keeps its own schema only because it admits the empty text. effect/String.isWellFormed exists in the reference checkout but not in the installed 4.1.4, so the filter uses the native String.prototype.isWellFormed, as jsonc, csv and markdown already do.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Restore S.NonEmptyString on the five string fields and drop the locator filter, by a decision file; minting still refuses a lone surrogate with a typed error.

### P2: the TextAnchor to oa: codec is a pair of Result functions over source text, and WebAnnotationTarget.selector becomes one or many selectors, 2026-11-22

textAnchorToWebAnnotationTarget(anchor, { source, sourceText }) and webAnnotationTargetToTextAnchor(target, sourceText) return Result with a typed WebAnnotationAnchorRefused. They cannot be a text-free schema codec, because a code-point start needs the text before it. They take raw text and not VerifiedSourceText: the result is a candidate TextAnchor, never a proof, and the caller verifies it. The oa:hasSource IRI is the caller's argument, since a SourceTextIdentity is not an IRI. Offsets convert through convertPosition. One anchor becomes a position selector and a quote selector, which OA models as several selectors of one target, so WebAnnotationTarget.selector becomes S.ArrayEnsure(WebAnnotationSelector) with at least one member: effect 4.1.4 decodes one object or an array to an array and encodes a one-member array back to the object, so a single-selector annotation keeps its wire bytes (checked on this base). The decoded type changes; the semantic-web test reads the first selector. Decoding fails closed: every selector is read and all must agree, although OA lets a consumer pick one: two positions must give one range, a quote beside a position must equal the slice and its stated prefix and suffix must match the text, and several quotes without a position must each resolve Unique to one range; a quote-only target must resolve Unique, an empty or inverted range is refused, and a target with neither selector is refused. A TextAnchor holds no context and no fragment, so prefix, suffix and fragments of a third-party target are not carried: re-encoding is stable on the anchor, not on the target. The refusal reasons are the named, exported WebAnnotationAnchorRefusal. DocumentAnnotation overrides selector and does not change. The round trip gets no ledger id (it is a PLAN exit criterion); its test titles start with P2-OA in packages/foundation/modeling/rdf/test/TextAnchorCodec.test.ts.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Restore the single selector field and nest the quote as oa:refinedBy by a decision file before P3 builds the OA document codec.

### P2: unit conversion refuses ill-formed text with its own reason, 2026-11-22

UnitConversionRefusal gains ill-formed-text beside split-boundary and out-of-range. A text with a lone surrogate has no UTF-8 encoding and no agreed code-point count, so the conversion cannot be a bijection on it; returning a number would be a silent wrong answer. verifySourceTextIdentity already refuses such text, so no verified capture reaches this case. langextract's convertTextOffsetRange keeps its own documented behaviour on ill-formed text until P3 re-expresses it.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Drop ill-formed-text from UnitConversionRefusal and let a lone surrogate count as one code point, by a decision file with the L1-2 row.

### P2: the v3 conversion refuses a dangling mention reference itself and leaves dangling authority, group and list references to the live coherence check, 2026-11-22

Step 5 of the read transform rewrites every reference through the old-to-new maps and refuses a dangling one. A mention reference has to be refused in the conversion: an id the mention map does not hold has no cm2 image, so there is nothing to write. Authority, group and list ids are kept unless the case-occurrence step re-keyed them, so a reference that names no node passes through unchanged, and the live CitationDocumentReceipt decode that ends the conversion refuses it with its relationship coherence check (unique ids, closed references, one resolution per mention). Checking those again in the conversion would duplicate the domain filter. The case-occurrence v2 key over a new mention id comes from makeCaseOccurrenceAuthorityId, exported from AuthorityIdentity.ts and shared with makeCitationAuthorityId, so the conversion cannot drift from the live key. Tests: a dangling warning and a dangling member list entry are refused by the conversion, an unknown authority by the coherence check.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Check every authority, group and list reference against the converted receipt inside convertDocumentV3 and refuse with its own issue message.

### P3: @beep/annotation exports its target-set schema and assembly-refusal kit, and the document view only as a type, 2026-11-22

Three surface calls the design did not settle, taken while writing commit 4.

- `AnnotationTargets` (the design's private `Targets`, a non-empty `CanonicalHashSet(OccurrenceId)`) is exported from `src/AnnotationId.ts`. It is the first element of the `annotation/v1` preimage there and the `targets` field of every content case in `src/Kind.ts`, so both modules read one schema, and the declared type of `AnnotationKind.case` names it.
- `DocumentAssemblyRefusal` is the exported `LiteralKit` of the three `DocumentAssemblyRefused` reasons, hoisted as `HandoffRefusal` is in section 4.2.
- `AnnotationDocumentView` is exported as a type over a module-private schema. A branded `S.Opaque` view would be nominal, so no caller-owned document would satisfy it. The private values are named `annotationDocumentView` and `documentEnvelope`, distinct from their exported types. `AnyAnnotationKind` is an operational registry contract with live schema handles and a method, excluded by the narrow detector rule. All three former schema-first exception rows are removed under S31; none is admitted.

`mintAnnotationId(kinds)` compiles one JSON body encoder per kind when it is applied to a registry and takes the kind-independent `{ _tag, targets, body }` shape, so a generic caller such as the document codec needs no cast. `assemble` mints every key first, then refuses in a fixed order (`anchor-off-capture`, `target-without-anchor`, `reference-unresolved`), and repeated parts collapse to one row each. `encode` returns the canonical JSON value; its bytes are the RFC 8785 form, which `test/fixtures/canonical-document-v1.json` holds.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Make the target set and the refusal kit module-private while preserving the type-only document view

### P3: merge and restrict return the caller's document type, conflicts take the least and greatest time, contains is dual, 2026-11-22

Four surface calls the design did not settle, taken while writing commit 5.

- `merge` and `restrict` take any document type over `AnnotationDocumentView` and return that type, rebuilt from the input with its tables replaced; neither re-runs the schema. Both preserve every pure check by construction (the union of content-keyed tables of one capture, refused when a pair would carry two times; the kept annotations of a set closed under references, with the anchors and attribution they use), and `L2-4` proves the outputs pass the schema and the checked codec.
- A `GenerationTimeConflict` takes the least and the greatest time of its (content, activity) group under `Option.makeOrder(DateTime.Order)`, `None` first. Two documents that each pass their checks give at most two times per pair, so the group is the two sides.
- `contains(kinds)` is dual: `(document, outer, inner)` and `(outer, inner)(document)`, as the design module had it.
- `restrictToOa` throws when its restriction or its `OaDocument` decode fails, which the design calls a defect; it stays a pure function with the signature of section 1.6, through `Result.getOrThrow`.

`closure` and `restrict` take any `KindRegistry`, and the kept set is `HashSet<KindName<Kinds>>`, so an unregistered name is a type error. The test generator of commit 4 now prefixes each activity seed with its index, so two equal drawn labels still name two activities and a generated document never holds two generations of one pair.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Re-validate the outputs through the schema, refuse more than two times, and drop the data-last contains form, by a decision file

### P3: annotation/v1 and generation/v1 are declared preimages with goldens; one preimage serves every kind through its JSON body, 2026-11-22

`AnnotationPreimage` is `definePreimage` under `annotation/v1` over `Tuple[CanonicalHashSet(OccurrenceId) (non-empty), TermIri, S.Unknown]`, whose third element is the body encoded by `S.toCodecJson(kind.body)`. One preimage serves every kind, because the kind IRI already separates the body schemas. `GenerationPreimage` is `definePreimage` under `generation/v1` over `Tuple[AnnotationId, ActivityId]`. The design module's hand sort goes: the set codec sorts.

Goldens: `[["sha256:68270708…4a48"], "https://beep-effect.com/ns/annotation/Mention", {"class": "https://beep-effect.com/ns/office-action/distinction"}]` gives `sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9`; `[that id, "sha256:2a2b259a…7388"]` gives `sha256:e1303854ed5d9fddcba55d0d0ae4e4dd5d9ca20c4e4738e0ba643f5696575acd`. Both were checked on this base through `Preimage.verifyGolden` with `Digest.layerWebCrypto` and by an independent SHA-256 over the RFC 8785 JSON, and one `PreimageRegistry` accepted both. `test/Preimages.test.ts` registers them with the two import preimages. An unregistered tag cannot reach the mint, because the document schema's annotation union is closed over the registry; the mint dies on one as a construction defect.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Declare one preimage per kind by a decision file that bumps annotation/v1

### P3: @beep/annotation defines no Context.Service, exports Annotation<Kinds, K>, and restrict takes registered kind names by type, 2026-11-22

`@beep/annotation` defines no `Context.Service`. Every arrow is pure or needs only core's `Digest.Digest`, as in `@beep/text` (decision `p2-no-context-service-in-text`); a service would be a name for a function. The SPEC name is exported as `Annotation<Kinds, K>`, the content of an annotation of kind `K` (all kinds by default), and `AnnotationOf` goes. `restrict` and `closure` take a `HashSet` of `KindName<Kinds>`, so an unregistered name is a type error and needs no runtime refusal. `verifyDocument` stays internal to the checked decode; a body that fails its kind's encoding there is a `PreimageMintError`, and only a key that is not the hash of its value is a `DocumentKeyMismatch`.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Add a service contract when a second implementation or state appears, by a decision file

### P3: candidates past maxExtractions enter the residual unaligned-by-cap; the cap still bounds alignment, 2026-11-22

Design section 4 requires every parsed candidate in the handoff, but alignCandidates bounds its work by maxExtractions and returns only that prefix. By orchestrator ruling, handoff accepts optional overCap: ReadonlyArray<ExtractionCandidate>, defaulting to empty for its non-schema input. The service passes the unattempted raw tail without manufacturing GroundedExtraction values. The handoff appends those candidates with reason over-extraction-cap, alignment unaligned meaning no aligned proof, and no anchor. The reason distinguishes alignment not attempted from attempted and failed. Text, attributes and confidence survive. candidateCount is attempted input length plus overCap length, equal to the parsed count; diagnostics remain as before and maxExtractions still bounds alignment work. No residual-specific alignment domain is added and IrToLawExtractionError keeps its wire. The existing two-parsed, cap-one service test pins the distinction. This is an explicit amendment of design sections 4.2 and 4.3.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Align every parsed candidate and drop the cap from alignment, by a superseding decision

### P3: @beep/text gains CaptureId, the capture/v1 hash of the whole SourceTextIdentity, as the id an extraction run used, 2026-11-22

An activity's `used` set holds the ids of what it read. The handoff reads one capture, and a capture has no id. Its `textDigest` is scope-free: two matters holding the same bytes share it, so a `used` set built from it would join activities across a matter wall in a provenance traversal.

`@beep/text/Capture` adds `CaptureId`, the hash of (`capture/v1`, `scopeRef`, `sourceRef`, `locator`, `sourceDigest`, `textDigest`, extractor name, extractor version, `normalizationVersion`), the first eight elements of `occurrence/v1` in the same order, declared through `definePreimage` with a golden. Golden: `["matter:example","source:example","documents/source.txt","sha256:aaaa…(64)","sha256:8de1c1a5…515f","utf8","1","1"]` gives `sha256:c7f8616c75be6548d508e2e6a071d3400673dd915454e7e90d97f26bb967eed6`, checked on this base through `Preimage.verifyGolden` with `Digest.layerWebCrypto` and by an independent SHA-256 over the RFC 8785 JSON. `mintCaptureId` is `Effect.fn("Capture.mint")`. P5's `prov:Entity` projection of `SourceTextIdentity` uses this id or amends this decision.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Use the capture's textDigest as the used id, accepting a scope-free provenance join, by a decision file before P3 merges

### P3: commit 1 freezes one hosted batch per model output of the Extractor test, through file snapshots, 2026-11-22

Section 10 of `research/2026-11-22-p3-design.md` asks commit 1 for "today's `EvidenceBatch` over the `Extractor.test.ts` model output". That file holds six hosted model outputs that reach a batch: a coreference cluster, synthesized relation endpoints, reused relation endpoints, an unresolved relation, a malformed relation contract and fuzzy relation evidence. All six are frozen, in that order, as `apps/labs/semantica/test/fixtures/hosted-batch-v1.json`, an array of `{ name, batch }`. Commit 8 changes the relation grounding and every degradation path, so freezing only the cluster case would leave the relation lane and the three degradations unproved. The six cases move to module scope in `Extractor.test.ts`, where the behaviour tests and the frozen test share them, so commit 7 and commit 8 rewrite one constructor per case.

The two frozen tests (semantica `C0 hosted extractor frozen batch`, law-practice `IrToLaw keeps the bytes of the frozen v1 law entities for the server fixture`) compare with `toMatchFileSnapshot`, as `ValueSchemaIdentifiers.test.ts` does. A missing file is written only outside CI, so each fixture was written by the code at `525c61bb090` and is compared byte for byte afterwards; a changed byte fails. The law-practice fixture freezes the entities of the primary model output (`match_lesser`), the one the design names; the minimal-fold run gives the same anchor and is already asserted by its own test.

The relation-preview report was produced with `SEMANTICA_OFFLINE=true`, `SEMANTICA_CORPUS_ROOT` set to the W1 PDF root and `SEMANTICA_PROVIDER_CACHE_DIR` set to a directory holding the three committed cache entries (sha256 of the entry files `60f24303…`, `91d2370b…`, `daee2459…` for the cases in fixture order 1, 2 and 3 by key prefix `5737`, `6bbc`, `0ac6`). Two runs gave the same bytes, sha256 `296bcd0d919d49b4ad6b7ef9299b82c763a24fc0489e3245e81ea2691aaa9ae6`, and the counts equal the table in `goals/semantica-canary/history/p2-c0-evidence-quote-reentry.md` (16/0/16, 7/2/5, 9/8/1).

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Freeze only the first hosted batch, or move the fixtures to hand-written comparisons, by a decision file before commit 8

### P3: containment needs a non-decreasing level under strict inclusion and a lower level on equal spans, 2026-11-22

Amends decision `p0-structure-kinds-carry-containment-levels`. Under the design rule a `Word` whose range strictly includes a `Sentence` contained it, because levels were consulted only on equal spans. Now `outer` contains `inner` when `outer`'s range covers `inner`'s and `outer.level <= inner.level`, with `outer.level < inner.level` on equal spans. Extraction kinds and multi-target annotations still take no part. The relation stays a strict order: over 200,000 random triples of ranges and levels it was irreflexive, asymmetric and transitive with no counterexample. Ledger row `L2-5` reads "containment is a strict order: range inclusion with a non-decreasing level, and the lower level on equal spans".

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Return to levels as an equal-span tie-break only, by a decision file with the L2-5 row

### P3: a document has one checked decode and one canonical encode; the decoder refuses a repeated table key, 2026-11-22

`S.HashMap` encodes its entries in iteration order and decodes a repeated key by keeping the last (`.repos/effect/packages/effect/src/Schema.ts:16021-16026`, `HashMap.ts:893-894`), so document bytes were not stable and a forged first entry was dropped without notice. The tables stay `S.HashMap`. `makeDocumentCodec(schema, kinds)` returns the one checked `decode` (an envelope decode, `DocumentKeyRepeated { table, key }` for a repeated key in `anchors`, `annotations` or `attribution`, then the schema, then the key verification) and the one canonical `encode` (the schema encode, then every table sorted by encoded key and every generation set sorted by run id). The bare schema stays exported for composition and generators.

A generic sorted-entry carrier was tried and dropped: `S.Tuple` over generic element schemas leaves its optionality conditional unresolved under tsrs, and the record form loses the key brand. Checked in a throwaway on this base: encode then decode round-trips; encode is a fixed point of the canonical sort; a repeated key is refused by the entrypoint and accepted by the bare schema; a consistently forged annotation key (key, attribution key, generation content and re-minted run all replaced) is accepted by the bare schema and refused by the entrypoint with `DocumentKeyMismatch` on `annotations`, the L2-4 case.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Encode tables as JSON objects keyed by id, which RFC 8785 sorts, by a decision file; fixtures are regenerated

### P3: extraction result and checked wire codecs live in acyclic module leaves, 2026-11-22

LangExtractResult lives in Extraction.result.ts so its dependency on Handoff.model does not cycle through Extraction.model. The Extraction public barrel still exports the result. Handoff.codec.ts owns the checked wire decode and canonical encode path, keeping Handoff.model available to the result and producer without a codec cycle.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Move the result and codec back into the existing model leaves using lazy schema composition

### P3: OfficeActionReview.flow.test.ts runs the real langextract service over a stubbed model on its own synthetic fixture, 2026-11-22

`packages/law-practice/use-cases/test/OfficeActionReview.flow.test.ts` composes: the file-processing test engine from `@beep/file-processing/test`, returning a new synthetic office-action text kept under the use-cases test fixtures (not a copy of the server-local fixture, which the use-cases tests cannot import); the real LangExtract layer over a stubbed `LanguageModel` wrapped in `Model.make` (`effect/ai/Model`), which supplies the provider and model names of the run's pin; the real `IrToLaw`; `makeClaimGate` over a conforming stub `ShaclValidationService` (the epistemic use-cases test pattern) and `makeClaimTransition`; `Digest.layerWebCrypto`.

It asserts that the handoff passes the checked decode after an encode; that every anchor receipt names the fixture capture; that the distinction anchor re-slices the text; that the candidate indices are lossless; that `IrToLaw` maps the five entities; that the loop ends at `shape_valid`; that a missing label fails typed; and that an unaligned label fails with `required-extraction-unaligned`. It asserts no confidence, so P4 adds `OfficeActionReview.signals.test.ts` without rewriting it.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Build the handoff by hand in the flow test instead of running the service, by a decision file

### P3: Generation.at is the stated generation time, absent when none was stated; an imported activity keeps only what the input named, 2026-11-22

Amends decisions `p0-items4-6-9-annotation-document-shape` (item 6) and `p0-item7-oa-profile`. Native generations always carry a time. A third-party annotation with `prov:wasGeneratedBy` and no time has none, and neither does an unattributed annotation given the import activity unless it states a time itself: writing the import time into its generation would make `normalize(s)` depend on the import time, which item 7 keeps outside. So `Generation.at` is `S.OptionFromOptionalKey(S.DateTimeUtcFromMillis)`, the stated generation time. Time stays canonical per (content, activity): two records for one pair that differ, `None` against `Some` included, are a `GenerationTimeConflict`, whose `left` and `right` are options. The import activity's own time is its record's `importedAt`.

`ImportedActivity` becomes a tagged union `Activity { iri } | Creator { agent } | Generator { agent }`, so `dcterms:creator` and `as:generator` round-trip as what they name, an agent, instead of being read as an activity. The stated-time field moves from the activity record to the generation, where the profile states it. `imported-activity/v1` hashes the encoded case; golden `[{"_tag":"Activity","iri":"https://example.org/activity/1"}]` gives `sha256:9924f029d9bb4a3a0788bb5c915176e98210d3b4bbd604efd8b2dfc65b6de8fa`. `import-activity/v1` golden `["sha256:bbbb…(64)"]` gives `sha256:f5431a3f22f3b795221229eb7c7b3e424d4f89fec11f5ebf7b536973d91429b1`. Both were checked through `Preimage.verifyGolden` and an independent SHA-256. A time stated on a third-party annotation (`prov:generatedAtTime`, else `dcterms:created`) applies to each generation its own statements give and to its import generation when it has no statement; a time stated on a run applies to the generations of that run's statements. On the wire every stated time is the `prov:generatedAtTime` of its generation's run entity, so two creators with two times are two runs (decision `p3-oa-codec-signatures-and-profile`).

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Require Generation.at and give imported generations the import time, accepting a normalize that depends on it, by a decision file with L2-6

### P3: the nlp Graph span becomes an optional Position resolved uniquely; the node schemas move with Core in P6, 2026-11-22

Census disposition change for Graph `Schema` (147 lines in 10 files, 138 of them in `@beep/nlp-processing`), from "adapt into `@beep/annotation` kinds in P3" to "moves with Core to `@beep/nlp-processing` in P6". The node types (text, POS, lemma, dependency, entity, relation) are an NLP engine's linguistic graph for which L2 has no kinds. The PLAN row asks only for the span, and P6 already moves Core and absorbs nlp-processing's graph layer.

P3 deletes the float `Span`. `EntityNode.span` and `RelationParticipant.span` become `S.OptionFromOptionalKey(Position)` from `@beep/text` (`start < end`, `utf16-code-unit`), and `@beep/nlp` gains `@beep/text`. The wink backend fills the span with `resolve` of a quote selector over the text: `Unique` gives the position, and `Ambiguous` or `NotFound` give none. Today it returns the first match, or the fabricated `{ start: 0, end: length }` when the value is absent, which is the L1-5 bug. semantica's pattern lane keeps its `fabricated-span` degradation for a missing span.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Adapt the Graph node schemas into annotation kinds in P3 by a decision file with re-measured census sums

### P3: aligned grounded extractions carry a TextAnchor; the office-action attempt log reads v1 rows through a declared transform, 2026-11-22

`GroundedExtraction` stays the langextract aligner's output: alignment returns it, `VerifiedSpan` locates over it and `OfficeActionStructure` stores it, and the PLAN exit forbids it only in `IrToLaw` and the semantica layers. Its four aligned cases replace `span: Contract.Span` and `matchedText` with `anchor: TextAnchor`, the canonical candidate anchor: `matchedText` is the source slice of `span` (`Alignment.behavior.ts:222-233`), so the pair already is one anchor. `Contract.Span` retires with no langextract twin, and every reader that rebuilt a `TextAnchor` from the pair (`IrToLaw`, semantica, `OfficeActionStructure`) reads the field instead. An aligned extraction with `start == end` can no longer be built; the three use-cases tests that build empty or inverted spans (`OfficeActionStructure.test.ts:148,177,191`) move from a verification refusal to a construction refusal.

The office-action attempt log is a stored format. `OfficeActionStructureAttempt.schemaVersion` becomes `"2"`. `OfficeActionStructureAttemptRead` decodes a v2 row, or a v1 row through a frozen v1 reader that maps `span` and `matchedText` to `anchor`, keeps every other field as stored, decodes the result through the live v2 schema and never encodes. The frozen `office-action-attempts-v1.jsonl` is not edited; a v2 fixture is captured beside it; the two byte tests become "reads every frozen v1 row to its v2 form" and "writes v2 rows byte for byte". Checked on this base in a throwaway: both frozen v1 rows read to v2 with width-checked anchors (0..25 and 176..303 on row 1; row 2 has none) and re-encode with `schemaVersion: "2"`. `VerifiedSpanAttemptRecord` has no store and changes shape under the chapter-11 amendment.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Keep span and matchedText on a langextract-owned span schema with the v1 key order and drop attempt v2, by a decision file before the anchor commit lands

### P3: the handoff run is an activity minted at start from operation:Extract, an Engine pin from Effect's model names, the prompt digest and the capture id, 2026-11-22

`GENERATED_BY` is deleted. The run's `ActivityStart` is:

- `operation`: the registry term `operation:Extract`.
- `pin`: `ActivityPin.Engine { engine, edition }`, read from Effect's own model services `Model.ProviderName` and `Model.ModelName` (`effect/ai/Model.ts:69`, `:86`).
- `promptDigest`: the SHA-256 of the prompt's UTF-8 bytes, through `Digest.digestHex`.
- `used`: the `CaptureId` of `request.source`.
- `started`: a clock read before the prompt.

`activity.id = mintActivityId(start)`.

Every model built with `Model.make` (`:135`) provides the two model names together with its `LanguageModel`, so no langextract service is added. The upstream `AnthropicLanguageModel.model` is `Model.make("anthropic", model, layer(...))` (`.repos/effect/packages/ai/anthropic/src/AnthropicLanguageModel.ts:704-708`), and `@beep/anthropic` builds its layer with it instead of `.layer`.

The pin is `Engine` rather than `Model` because a requester knows the provider and the model id it asked for, not the snapshot behind an alias. `ActivityPin.Model`'s `version` would therefore be invented.

`LangExtractService.layer` requires `LanguageModel`, the two names and `Digest`. These sites provide them:

- the law-practice server (`LawPracticeServerLive`'s requirement grows by the two names, and its hosts get them from `AnthropicLanguageModelLive`);
- semantica (the names come from its `ActiveModelIdentity`);
- the lejeune provider smoke (through `AnthropicLanguageModelLive`);
- the tests, which wrap their stub models in `Model.make`.

Checked on this base: `startExtraction` under `Model.make("test-provider", "stub-model", Layer.empty)` gives the pin `{"_tag":"Engine","engine":"test-provider","edition":"stub-model"}`, and `AnthropicLanguageModel.model(...)` type-checks as `Layer<LanguageModel | ProviderName | ModelName, never, AnthropicClient>`.

Every generation of the run has `at = Some(t)` for one clock read after alignment. Generated therefore never precedes started (the L5-3 order holds for the handoff), and one run has one time, so a run cannot conflict with itself.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Add a langextract service that carries a version-bearing ActivityPin, provided by each host, by a decision file

### P3: the request names its capture, the service verifies the text against it, and every target is a receipt of the aligner's own anchor, 2026-11-22

`LangExtractRequest` drops `documentId` (the `@beep/nlp/Core` `DocumentId`) and gains `source: SourceTextIdentity`; with the Handoff subpath gone and `UnitInterval` read from `@beep/schema`, langextract has no `@beep/nlp` import. Before any model call, the service calls `verifySourceTextIdentity` with the request's identity as both the expected and the supplied identity, so a text whose digest is not the capture's fails the run with a new `LangExtractError` reason `source-text-mismatch`: an input error, not a value.

Each aligned candidate's `TextAnchor` is verified against that `VerifiedSourceText` with `verifyTextAnchorAgainstVerifiedSource`, projected to its receipt and stored as `Anchored`. The anchor is the aligner's own range. It is not re-located through `VerifiedSpan.locateGroundedExtractions`, which ignores the span, searches for the model text and can pick another range for the lesser, minimal-fold and fuzzy tiers. A refused verification is a residual candidate with reason `verification-refused`, a value as the SPEC error boundaries require.

Scope: the capture's `scopeRef` is the scope; a cross-scope refusal belongs to a caller that compares an expected identity, as `OfficeActionStructure` does. `LangExtractService.layer` gains `Digest.Digest` in its requirement beside Effect's two model names (decision `p3-handoff-activity`); the composition sites are listed in section 2 of `research/2026-11-22-p3-design.md`. A `PreimageMintError` while minting over verified text cannot happen (every quote is a slice of well-formed text) and dies in the service as an internal error.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Take a caller-held VerifiedSourceText in the request instead of verifying inside the service, by a decision file

### P3: the handoff emits a checked annotation document with its activity, per-candidate readings and a residual; LangExtractResult is the handoff and its counts, 2026-11-22

The handoff emits `ExtractionHandoff`: `document`, an `ExtractionDocument` over the extraction kinds; `activity`, an `ExtractionActivity` `{ id, start: ActivityStart }`; `candidateCount`, the number of parsed candidates; `readings`, a `HashMap` from `AnnotationId` to a non-empty array of `ExtractionReading`; and `residual`, an array of `ResidualCandidate`. A reading keeps what the run said and the content hash must not: the candidate index, the raw label, the model text, the attributes, the alignment tier and the extractor confidence. Two runs, or two candidates of one run, that read one class at one occurrence are one annotation with their readings beside it. The residual keeps every candidate that became no annotation, with its tier, a `ResidualReason` (`unaligned`, `unmapped-label`, `verification-refused`, `relation-attribute-missing`, `unmapped-predicate`, `relation-endpoint-unresolved`) and, whenever the candidate aligned, the aligner's `TextAnchor` (the evidence range for a relation), unverified. Without it a reader could not place a `relation-unresolved` degradation in the chunk of its evidence, turn an aligned off-target label into the Entity claim semantica makes of it today, or refuse it as the lejeune smoke does today.

Schema checks: every readings key is an annotation of the document; every generation names the handoff's activity; the candidate indices across readings and residual are exactly `0..candidateCount-1`, each once, which is the lossless rule (without the count, losing the last candidates would pass); a residual has an anchor exactly when its tier is not `unaligned`. The encoded handoff is canonical like the document: the readings table is the array of entries sorted by annotation id, each reading array in candidate order. The checked decode for wire input refuses a repeated readings key, runs the document's checked decode and verifies `activity.id = mintActivityId(activity.start)`; the two handoff refusals are `HandoffRefused { reason: "readings-key-repeated" | "activity-id-mismatch", key }`. A reading belongs to the annotation its candidate became, a `Mention` or a `RelationCandidate`; an endpoint Mention minted for a relation and a `CorefCandidate` have none. Checked on this base: the checks accept candidate indices `0..3` of four across readings and residual and an empty run, and refuse a truncated tail (`0..2` of four), a gap, a repeat, an unaligned residual with an anchor and an aligned one without.

`LangExtractResult` becomes `{ handoff, diagnostics }`. `documentId`, `text`, `extractions` and `annotatedDocument` leave it: the caller holds the text, and the extractions are the readings plus the residual. Confidence stays an unpromoted reading field until P4 turns it into a signal.

`ExtractionDocument` is `@beep/annotation`'s caller-owned document over `ExtractionKinds`; it widens to `TextDocument` by decoding its type side, since every extraction kind is a document kind, so a later structure pass merges with it. The handoff emits no `Chunk`: the whole-text chunk of today duplicated the capture and cannot exist over empty text. The `Chunk` kind stays for a chunking pass, and `Mention.chunkId` has no successor.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Keep GroundedExtraction[] in LangExtractResult beside the document by a decision file; readers then choose between two carriers

### P3: IrToLaw maps a checked handoff, picks each label's Mention by text position and reads the model text from its reading, 2026-11-22

`toLaw(handoff: ExtractionHandoff)` returns `Effect<LawEntities, IrToLawExtractionError>`, stays pure and needs no `Digest`: the handoff comes from the service in process, built through the checked constructor, and a handoff from outside the process goes through the checked decode first. For each label, the candidates are the `Mention` annotations whose class is the label's `office-action` term, and the one with the least (start, end, `AnnotationId`) is taken. That is a function of the document alone; today the first in model order is taken, and the fixtures hold one of each. Its text is its first reading's model text, as today, which keeps the lower-case limitation the server test asserts. The distinction anchor is the anchors row's receipt anchor.

When a label has no annotation, a residual candidate with that label gives `required-extraction-unaligned` with its tier as `alignmentStatus`; otherwise the error is `required-extraction-missing`. The error's encoded shape does not change (`SchemaParity.test.ts:148-178`). The stale port comment (`IrToLaw.ports.ts:6-14`) goes.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Pick by candidate order instead of text position, by a decision file; the reading's candidate index carries the order

### P3: L2-3 lands in two halves, its decode and assemble half in commit 4 and its merge and restrict half in commit 5, 2026-11-22

Section 10 of the P3 design lists `L2-3` in commit 4, but the restated row (decision `p3-ledger-rows-restated`) also asks that `merge` and `restrict` keep every annotation attributed with one generation per pair, and those two functions arrive in commit 5. Commit 4 therefore ships `packages/foundation/modeling/annotation/test/Generation.laws.test.ts` with the cases its code can carry: the checked decode refuses an unattributed annotation and a second generation for one (content, activity) pair; `assemble` gives every annotation exactly one generation of its activity; every generated run is the `generation/v1` hash of its pair, with the golden; and a generation with no stated time encodes without the `at` key. Commit 5 adds the merge and restrict cases to the same file under the same ledger title, so the row turns green in commit 10 with both halves.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Move every L2-3 case into commit 5 and keep Generation.laws.test.ts out of commit 4, by a decision file

### P3: the aligner's codec yields a TextAnchor, langextract ranges give way to Position, and the attempt read codec is exported, 2026-11-22

Seven calls the design did not settle, taken while writing commit 7.

- `SpanFromMatch` and `spanFromMatch` keep their names and now produce a `TextAnchor`. The anchor carries its own quote, so the codec's encode is pure, `[startChar, quote]`, and no longer reads `CurrentAlignmentSource`; an empty matched slice is refused on decode, since an anchor is never empty.
- `TextOffsetUnit`, `TextOffsetRange`, `Utf16TextRange` and `convertTextOffsetRange` go with no langextract successor; callers use `@beep/text/OffsetUnit` `Position` and `convertPosition`. `VerifiedSpanOffsets.test.ts` goes with `UnitConversionAgreement.test.ts`: every case in it exercised the deleted function, and `@beep/text`'s offset-unit laws cover the conversion.
- `invalid-offset` leaves `VerifiedSpanErrorReason` and the verified-span attempt's location-failure reasons, because no producer of it remains. `VerifiedSpanAttemptRecord` has no store.
- The citation `OccurrenceProjection` maps every `convertPosition` refusal (`split-boundary`, `out-of-range`, `ill-formed-text`) to an unverified row, as it mapped `invalid-offset` and `absent-text` before. None of them names a UTF-16 range the source could prove. The old `limit-exceeded` failure cannot arise, since `convertPosition` has no source-length ceiling of its own.
- `OfficeActionStructureAttemptRead` is exported from `@beep/law-practice-use-cases/OfficeActionStructure`, because the server store reads through it and the package serves no deeper path. The frozen v1 schemas and `convertV1` stay private to `OfficeActionStructure.read.ts`.
- The read union lists the v1 reader first, `S.Union([FromV1, OfficeActionStructureAttempt])`, the reverse of the design. A v2 row never enters the v1 reader, whose `schemaVersion` literal prunes it; an encode enters it first and is refused by its forbidden getter, then falls through to the v2 schema. Every encode through the read codec therefore passes the refusal, and `test/OfficeActionStructure.read.test.ts` in the use-cases package covers the module at 100 percent without exporting the v1 reader.
- The two citation-extraction-engine ops scripts convert through `convertPosition`, which refuses a lone surrogate before the end boundary where the deleted function counted it as a code point. Their fixture texts are well formed.

`apps/labs/lejeune-bolt-workbench/src/workflows/Normalize.ts` and `Rules.ts` need no edit: they build unaligned extractions for the locate input and read the located `TextAnchor`, and neither named `TextOffsetRange`.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Restore the langextract range types and convertTextOffsetRange, the invalid-offset reason and a source-reading SpanFromMatch encode, by a decision file

### P3: the langextract offset ranges move in P3; the law-practice TextQuote, SourceRef and SourceQuote move in P4, 2026-11-22

Decision `p2-langextract-and-law-quotes-move-in-p3` sent the law-practice `TextQuote`, `SourceRef` and `SourceQuote` to P3 beside the langextract ranges. P3 takes the langextract ranges: `TextOffsetRange` and `Utf16TextRange` become `Position`, and `convertTextOffsetRange` becomes `convertPosition` with its refusals, including `ill-formed-text`. Their consumers are the law-practice `OccurrenceProjection` and two tests, lejeune `Normalize` and `Rules`, and two citation-extraction-engine ops scripts. The three law-practice shapes have no annotation reader: `TextQuote` and `SourceRef` locate ReviewHub evidence by quote, and `SourceQuote` feeds claim evidence, which P4 rewrites with `EvidenceSpan`. They move in P4, where `TextQuote` becomes the `@beep/text` quote selector.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Re-express the three law-practice shapes in the P3 PR by a decision file

### P3: ledger rows L2-1, L2-3, L2-5 and L2-6 are restated over the functions under test, 2026-11-22

`L2-1`: merge over one capture is idempotent, commutative and associative on content, attribution unions, and a refusal is the same value in either argument order (decision `p3-merge-refusals-are-symmetric`). `L2-3`: the checked decode refuses an annotation with no generation and a second generation for one (content, activity) pair, and `merge` and `restrict` keep every annotation attributed with one generation per pair. As written, the row restated two schema filters and named no function. `L2-5`: containment is a strict order, range inclusion with a non-decreasing level and the lower level on equal spans (decision `p3-containment-levels-are-monotone`). `L2-6`: for a document over the OA kinds, `decode(encode(d)) = d` with its imported activities; for third-party input `s`, `encode(decode(s)) = normalize(s)` on ground datasets; `resolve` gives the same result on every target before and after; offsets are code points on the wire and refuse a split surrogate (astral fixture); every generation is written as one run entity, and unattributed input is attributed to the import activity (decisions `p3-oa-codec-signatures-and-profile`, `p3-oa-instance-iris-and-ground-datasets`, `p3-oa-rejections-go-to-the-residual`, `p3-generation-time-is-the-stated-time`). Each row's package column becomes `@beep/annotation`, and each test title keeps its row id.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Restore the P0 row texts by a decision file edited with the ledger

### P3: merge reports the least conflict and orders the captures, so it commutes on refusals too; CaptureMismatch is the @beep/text one, 2026-11-22

The design module's `merge` reported the first conflict found by iteration with fixed sides, so `merge(a, b)` and `merge(b, a)` could fail with different values. `merge` now collects every `GenerationTimeConflict` and returns the least by (annotation id, activity id), with `left` the earlier time (`None` first). A `CaptureMismatch` names the two identities in a fixed order of their eight fields. The L2 copy of `CaptureMismatch`, with the same tag and fields as `@beep/text/LocatorMap`, goes; `merge` returns the text one, whose annotation description is widened from two locator maps to any two values that name different captures.

Simulated on this base over 400 generated document triples, 4 percent of the left documents on a second capture and times drawn from none and two instants, 23 of the pairs refused: idempotent 400 of 400, commutative including refusals 400 of 400, associative 363 of 363 where both groupings succeed.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Return the first conflict found and restrict L2-1 commutativity to compatible documents, by a decision file with the ledger row

### P3: the nlp Handoff and Ontology subpaths are deleted; UnitInterval consumers import @beep/schema/UnitInterval, 2026-11-22

The census b dispositions for the Handoff contract are executed: `AnnotatedDocument`, `Mention` and `TextChunk` are replaced by the annotation document and its kinds, and `Span`, `Provenance`, `Entity` and `Relation` are deleted, so `packages/foundation/modeling/nlp/src/Handoff`, its test and the `./Handoff` exports go. The `UnitInterval` re-export's consumers (8 files, covered) import `@beep/schema/UnitInterval`.

Ontology `Kind` (0 consumers) was to fold into the kind registry. The structure kinds' containment levels replace its poset, and its `Document`, `Token` and `Character` kinds have no annotation kind and no consumer, so it is deleted rather than ported. Semantic-loss row: those three kinds. The sums are re-measured in the census at the P3 base.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Restore the Ontology subpath from history by a decision file; the Handoff contract has no consumer to restore it for

### P3: the OA codec is @beep/annotation/rdf/OaCodec, held rdf-free at the base by an import-boundary test, with registry vocabulary, 2026-11-22

The codec lives in `packages/foundation/modeling/annotation/src/rdf/OaCodec.ts`, served as `@beep/annotation/rdf/OaCodec` by the `./*` export; `src/index.ts` does not re-export it. `test/Annotation.import-boundary.test.ts`, following `@beep/md`'s `Md.import-boundary.test.ts`, asserts that no module outside `src/rdf` reaches `@beep/rdf` in its import closure. The adapter's transitive `@beep/md` edge through `@beep/rdf` is accepted until P5 removes `rdf -> md`.

OA, PROV, dcterms, AS, NIF and rdf terms are read through `@beep/identity/Registry`; every profile term and `nif:Context` is declared, so no `Vocab/Nif.ts` or `Vocab/As.ts` is added to `@beep/rdf`. Each target's selectors go through P2's `textAnchorToWebAnnotationTarget` and `webAnnotationTargetToTextAnchor`. Chapter 16's "bound to DoCO terms" for the structure kinds becomes an SSSOM mapping in P5 (L3 `MappingSet`); P3 writes no DoCO triple and binds no DoCO term.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Move the adapter to its own package depending on @beep/annotation and @beep/rdf, by a decision file

### P3: the OA codec reads one default graph, refuses in the listed order, and needs IRI attribution and typed times, 2026-11-22

Calls taken while writing commit 6 that section 8 of the P3 design does not settle. Each keeps `L2-6` a law over every input: `decodeOa` and `normalize` share one reading rule, so a call changes both sides alike.

- Only the default graph is read. Quads in a named graph go to the residual untouched, and the input is deduplicated as a quad set before it is read.
- An annotation's kind is its one `rdf:type` besides `oa:Annotation`, and it must be an OA kind IRI. No other type, two, or a non-OA kind (such as `annotation:Section`) is `unknown-kind`.
- A `Mention` reads exactly one `oa:hasBody`, an IRI that decodes as a `TermIri`; the four empty-bodied kinds read none. Anything else is `body-refused`.
- A target needs an `oa:hasSource`, and one or more selectors typed `oa:TextPositionSelector` or `oa:TextQuoteSelector`. A selector typed both, a position without exactly one natural `oa:start` and `oa:end`, a quote without exactly one non-empty `oa:exact`, or a second `oa:prefix` or `oa:suffix` is `target-refused`, as is an annotation with no target. A selector of any other class is not read and stays in the residual. Offsets are read from the literal's lexical form whatever its datatype, and written as `xsd:integer`; quotes are written as `xsd:string`.
- The checks run in the order of the refusal list (`other-source`, `unknown-kind`, `body-refused`, `target-refused`, `time-conflict`), and the first that fails names the rejection. Rejections are ordered by the serialized subject term.
- An attribution statement needs an IRI object. A blank-node or literal activity, creator or generator is no statement: its triple stays in the residual, and an annotation with no other statement takes the import activity.
- A stated time is a literal typed `xsd:dateTime` with that lexical form. Another time literal is no time and stays in the residual. A subject's `prov:generatedAtTime` values win over its `dcterms:created` values, and two different values of the winning kind on one subject are `time-conflict`.
- An annotation's own time triples are carried only when its time is used: it makes statements itself, or it is unattributed and its time goes to the import generation. A run with no statement is not read: its triples, `prov:specializationOf` included, stay in the residual.
- The encoder writes only the anchors rows some annotation targets, so `decode(encode(d)) = d` holds for documents in which every row is a target, as `restrictToOa` and `decodeOa` leave them.
- The adapter's `selector-conflict`, an anchor whose quote is not the text it ranges over, is reported as `capture-mismatch`: the receipt is not over the given text. The other conversion refusals keep their own reasons. Neither happens for a verified receipt.
- `normalize` builds no document. It writes the run entities, selectors and NIF triples from what the shared rule read, by its own writer, and calls neither `decodeOa` nor `encodeOa`.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Widen what the reading rule admits by a decision file edited with the L2-6 row; decodeOa and normalize change together

### P3: the OA codec takes the verified text and the source IRI, returns typed results, and round-trips five kinds, 2026-11-22

Amends decision `p0-item7-oa-profile`. A code-point offset needs the text before it (decision `p2-text-anchor-oa-codec`), and no profile property carries the capture. So `encodeOa(kinds)({ document, importedActivities }, { source: IRI, text: VerifiedSourceText })` (an `OaDocument` with the imported-activity table, as the amended item 7 requires) returns `Result<Dataset, OaEncodeRefused>`, and `decodeOa(kinds)(dataset, { source, text, importActivity })` returns `Effect<{ document: OaDocument, importedActivities, residual, rejected }, PreimageMintError, Digest>`. `normalize` takes the same options. The decoder rebuilds the capture from the verified text it is given: `oa:hasSource` must equal `options.source`, and every decoded target is verified against that text before it becomes `Anchored`.

The OA kinds are the kinds whose body the profile can carry: `Mention`, whose class IRI is the `oa:hasBody`, and the empty-bodied `Title`, `Paragraph`, `Sentence` and `Word`. `encodeOa`'s input is an `OaDocument`, the caller-owned document of `@beep/annotation/Kinds` over the OA kinds. A caller narrows a `TextDocument` with `restrictToOa`, which restricts to the five kinds and decodes the result's type side through `OaDocument`; the five reference no kind, so neither step can fail, and a failure is a defect. `Section`, `Figure`, `Chunk`, `RelationCandidate` and `CorefCandidate` are not exported in P3; widening is a decision edited with the L2-6 row. The annotation kind is a second `rdf:type` of the `oa:Annotation`.

NIF stays export-only. `Sentence` and `Word` are also written as `nif:Sentence` or `nif:Word` with `nif:beginIndex`, `nif:endIndex`, `nif:anchorOf` and `nif:referenceContext` pointing at the source IRI typed `nif:Context`; `nif:Context` joins the NIF export terms. `nif:isString` is not written, so the export does not embed the source text. On decode every `nif:` triple goes to the residual, and `normalize` re-adds the NIF triples for `Sentence` and `Word`.

Every generation has one written form, in the encoder, the decoder and `normalize` alike: a run entity `<r> prov:specializationOf <a>` at the instance IRI of `mintRunEntityId(content, activity)`, with `<r> prov:generatedAtTime t` when the time is stated. A native activity, the import activity included, adds `<r> prov:wasGeneratedBy <act>` with `<act>` the instance IRI of its `ActivityId`; an `ImportedActivity.Activity` adds `<r> prov:wasGeneratedBy <iri>`; every such object is typed `prov:Activity`. A `Creator` or `Generator` adds `<r> dcterms:creator <agent>` or `<r> as:generator <agent>`, both profile properties, and no `prov:wasGeneratedBy`. The decoder reads an instance-form activity IRI as the native id it prints, so an import generation round-trips with no import record in the encoder's input, and an annotation holding an import generation beside a native one keeps both. `normalize` rewrites annotation-level `prov:wasGeneratedBy`, `dcterms:creator`, `as:generator` and `dcterms:created` into exactly these run triples and gives an annotation with no attribution the import run. Checked on a quad model of the attribution: `encode(decode(s)) = normalize(s)` for 2,000 of 2,000 generated datasets and the creator-only, generator-only, unattributed and two-creators fixtures, and `decode(encode(d)) = d` for 2,000 of 2,000 generated documents; the earlier form, with annotation-level creators and no import triples, held for 157 and 577.

The decoder mints every key itself and reads no annotation, occurrence or run IRI as an id, so its only error is `PreimageMintError`. It builds the document as the `merge` of one `assemble` per distinct (activity, time) of the decoded generations, since `assemble` gives every annotation one generation. With verified anchors, no body references in the OA kinds and the `time-conflict` rejections made first (decision `p3-oa-rejections-go-to-the-residual`), neither can refuse, and a refusal is a defect. This amends the 2026-11-19 amendment of item 7 that built the OA decoder on the checked decode entrypoint: that entrypoint decodes the document JSON, not RDF. Its purpose, that no key in the decoder's output is unverified, holds because every key is minted.

The import activity is the caller's argument to the decoder and `normalize`. Its `sourceDigest` is the SHA-256 of the RDF document bytes the caller parsed the dataset from, because the codec receives a `Dataset` and the canonical dataset digest lands only in P5 (L6-1); `normalize(s)` is then a function of `s` and that digest, as item 7 requires. P5 may switch the input to the canonical dataset digest by a decision, which re-mints import activity ids.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Widen the OA kinds with body properties by a decision file edited with the L2-6 row

### P3: content ids print as instance IRIs, so native documents round-trip and the codec's datasets are ground, 2026-11-22

Annotation, occurrence, run-entity and activity ids print as `https://beep-effect.com/ns/instance/sha256-<hex>` (`Registry.mint` under the `instance` namespace); the domain tags keep the hashes of different brands apart. A target is its occurrence's `oa:SpecificResource`, shared by every annotation on that occurrence, with selectors at `<occurrence IRI>/position` and `<occurrence IRI>/quote`. A generation is written `<run> prov:specializationOf <annotation>`, plus `prov:generatedAtTime` when its time is stated, and its activity on the run: `prov:wasGeneratedBy` the instance IRI of a native or import `ActivityId`, `prov:wasGeneratedBy` the original IRI of an `ImportedActivity.Activity`, or `dcterms:creator` or `as:generator` the agent of a `Creator` or `Generator` (decision `p3-oa-codec-signatures-and-profile`). On decode a `prov:wasGeneratedBy` object in the instance form is the native `ActivityId` it prints, so `decode(encode(d)) = d` holds for native documents, import generations included; any other object is an `ImportedActivity`.

`normalize(s)` renames every annotation subject to the instance IRI of its re-minted `AnnotationId`, every target and selector to the occurrence form, and writes every generation, annotation-level creators and generators and the import attribution included, as the run entity above. Its output and the encoder's are therefore ground (no blank nodes). Until P5 lands the `Dataset` quotient (L6-1), equality on these outputs is set equality of quads, which is the quotient restricted to ground datasets; the decoder still accepts blank nodes in its input. Checked on this base: 1,000 random hashes round-trip through the print and parse functions, and a foreign IRI parses to none. Only an activity IRI is read through the instance form: the decoder re-mints every annotation, occurrence and run id from the content, as `normalize` does, and never reads one from a subject IRI, so a third-party annotation IRI in the instance form with the wrong hash is renamed, not refused. A third-party activity IRI in the instance form is read as its hash; attribution grants no admission, since L4-2 requires grounding that verifies.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Use blank nodes for targets and selectors and prove L2-6 on the P5 quotient, by a decision file once L6-1 lands

### P3: a third-party annotation the profile cannot take is rejected into the residual with its reason; no whole input is refused, 2026-11-22

Amends decision `p0-item7-oa-profile`, which refused a whole input for one bad annotation. A third-party annotation is rejected, with its triples sent to the residual and an `OaRejection { subject, reason }` returned, when its target names another `oa:hasSource` (`other-source`), its kind IRI is not in the registry (`unknown-kind`), its body is not one its kind reads (`body-refused`), its selectors do not decode to one verified anchor (`target-refused`), or its times conflict (`time-conflict`): one subject, the annotation or one of its runs, states two different times, or the annotation gives one (content, activity) pair a time that another of its statements, or another annotation of equal content, contradicts (`None` against `Some` included). Every annotation contributing to such a pair is rejected, and `normalize` leaves out the same annotations. Multi-capture input therefore splits: the annotations on the given source decode and the others are `other-source`. Triples outside the profile go to the residual as before; nothing is dropped silently. The decoder mints each `importedActivities` key through `imported-activity/v1` and every other key from content, so it verifies nothing it reads. `decode` refuses no whole input; its error channel holds only `PreimageMintError`.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Refuse the whole input on the first rejected annotation, by a decision file with the L2-6 row

### P3: the OA residual keeps every quad a rejected annotation reaches, even when an accepted one carries it, 2026-11-22

A call the P3 design does not settle, taken in the fix commit after commit 6. Decision `p3-oa-rejections-go-to-the-residual` sends a rejected annotation's triples to the residual. Two third-party annotations can share a target node, and through it its selectors, or an activity node. Commit 6 removed from the residual every quad an accepted annotation consumed, so a rejected annotation that shared a target with an accepted one kept its `oa:hasTarget` link in the residual while the target and selector quads it points at left it, and a shared `prov:Activity` typing quad went the same way.

The residual now keeps every quad a rejected annotation reaches through the profile: the quads about the annotation, its targets, their selectors and the runs that specialize it, and the `rdf:type prov:Activity` quad of each activity it or one of its runs names. Where an accepted annotation shares those nodes, the same input quads are both carried by the document and kept in the residual; the residual is therefore not disjoint from what the document carries. `L2-6` states it two ways over generated input that now draws shared target nodes: each rejected annotation's reached quads, read by an independent walk in the test, are in the residual, and decoding the residual alone gives the same rejections. A fixture shares a target and an activity between an accepted `Word` and an `unknown-kind` `Section`.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Subtract only the quads no accepted annotation consumes, by a decision file edited with the L2-6 row

### P3: the OA codec writes and reads the xsd:dateTime lexical form of every instant a DateTime holds, 2026-11-22

A call the P3 design does not settle, taken in the fix commit after commit 6. `Generation.at` is any `DateTimeUtcFromMillis`, so a stated time can lie outside years 0000 to 9999. Commit 6 wrote `DateTime.formatIso`, which for such years prints `+010000-...` or `-000001-...`; neither is in the xsd:dateTime lexical space, and the decoder refused the first, so `decode(encode(d)) = d` failed for a valid document and a third-party time of `9999-12-31T23:59:59-14:00` was lost on the second decode.

The codec keeps the full range instead of bounding it, since bounding would refuse native documents the schema accepts. The encoder writes the year with no `+` and with four or more digits, negative years signed (`10000-01-01T00:00:00.000Z`, `-0001-01-01T00:00:00.000Z`, `275760-09-13T00:00:00.000Z`). The decoder reads the xsd:dateTime lexical form: a year of four or more digits with no leading zero past four, the date, the clock, an optional fraction and an optional zone. It converts the year to the ECMAScript form, truncates the fraction to milliseconds, reads a missing zone as UTC (as `DateTime.make` already did), and gives no time for a calendar date that does not exist (`2024-02-30`, which ECMAScript rolls to March 1) or an instant outside the range a DateTime holds. Such a literal stays in the residual, as decision `p3-oa-codec-reading-calls` says of any other time literal. Year numbering follows XSD 1.1 and ISO 8601: `0000` is 1 BCE. The `L2-6` generators now draw document times over the whole range, half of them at its edges, and third-party times on both sides of the four-digit year and around year 0.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Bound Generation.at and the decoder's times to years 0001 to 9999 by a schema check, by a decision file with L2-6

### P3: the office-action review builds its capture from the artifact and the processing result; OfficeActionStructure stays on extractions, 2026-11-22

`OfficeActionReviewInput` does not change. After file processing the use case builds the capture: `scopeRef` the matter fixture key, `sourceRef` the artifact id, `locator` the artifact's `relativePath`, `sourceDigest` the artifact digest, `textDigest` the SHA-256 of the extracted text, `extractor` the processing engine and its `engineVersion`, and `normalizationVersion` `"raw/1"`, since the text is used as extracted. A result with no `engineVersion` fails as the existing `FileProcessingOperationError`, because an unversioned extractor would be an invented pin. The server layer already requires `Digest`.

`OfficeActionStructure` is deterministic rule extraction with its own verified anchors and a stored attempt log. It keeps `GroundedExtraction`, now anchored (decision `p3-grounded-extraction-anchors-on-text-anchor`), and does not read the annotation document in P3.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Add a SourceTextIdentity field to OfficeActionReviewInput built by its callers, by a decision file

### P3: office-action review captures Digest as an explicit factory dependency, 2026-11-22

The pure office-action review factory receives the existing Digest service as an explicit dependency. The server layer captures the service and passes it to the factory so returned review methods keep no requirements. This supplies capture hashing without widening the existing public method environments.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Make the factory effectful and capture Digest during construction, updating its callers

### P3: one PR stacked on the P2 branch, opened under the three-PR limit and on the orchestrator's word, 2026-11-22

P3 ships as one PR from its lane, a stack layer on the P2 branch, in the commit order of section 10 of `research/2026-11-22-p3-design.md`. The handoff commit is indivisible: changing `LangExtractRequest`, `LangExtractResult` and the target breaks every caller, so chapter 11 rule 3 puts the consumer migration in the same commit. The registry terms, `@beep/text` additions, the annotation package, the OA adapter and the nlp deletions are separate commits around it. The PR opens only when the packet has fewer than three open PRs, after P2 is open, and on the orchestrator's word while P2 is unmerged. Before the final check the lane merges its parent once.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Split the commits after the annotation package into two PRs by a decision file; the commit order makes the cut clean

### P3: producer and checked wire path share the document codec, 2026-11-22

The producer and checked handoff wire path use the same exported module-scoped extractionDocumentCodec from Handoff.model. This preserves identical document verification and avoids constructing a schema or compiling a codec inside a call. The codec is configured for the extraction annotation document once at module scope.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Make each leaf own a private module-scoped document codec

### P3: the annotation, operation, instance and office-action namespaces and the semantica lab terms are declared at a minor release, 2026-11-22

Kind IRIs enter every `annotation/v1` preimage and the OA export, so they leave the process and must be declared terms (decision `p1-registry-first-fold-terms-declared`); no shard declares them on this base. New shards: `annotation` (`https://beep-effect.com/ns/annotation/`) with the ten kinds `Section`, `Paragraph`, `Title`, `Figure`, `Sentence`, `Word`, `Mention`, `Chunk`, `RelationCandidate`, `CorefCandidate`; `operation` (`https://beep-effect.com/ns/operation/`) with `Extract`; `instance` (`https://beep-effect.com/ns/instance/`) with no terms, the namespace content-addressed instance IRIs are minted under; `office-action` (`https://beep-effect.com/ns/office-action/`) with the four extraction labels `office_action`, `claim`, `rejection_reference` and `distinction` as locals, product vocabulary owned by law-practice.

The existing empty `semantica` shard gains its entity types (`person`, `organization`, `method`), its structure roles (`title`, `abstract`, `section`, `reference`), `relation-endpoint` and its six relation predicates as one-segment locals (`affiliatedWith`, `authoredBy`, `locatedIn`, `reEvaluatesClaimDueTo`, `selected`, `shows`); semantica keeps a label-to-term table for the strings its fixtures hold. The design generators' `annotation/class/*` and `annotation/predicate/relatedTo` IRIs, which have two-segment locals, are replaced by these terms.

Additions need no deprecation record; the snapshot release is the minor bump the writer computes against the base (2.0.0 to 2.1.0 if nothing else lands first). Production reads every one of these IRIs through `@beep/identity/Registry`.

The existing empty `lejeune` shard (`https://beep-effect.com/ns/lejeune/ontology/`) gains `project`, `delivery_date` and `finish`, the three targets of the lejeune provider smoke.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Drop a shard and its read sites by a decision file before P3 merges; after the merge a published term leaves only with a deprecation record

### P3: semantica grounds unmapped-predicate residuals for the E5 replay; the handoff keeps declared predicates only, 2026-11-22

The offline E5 replay contains pre-freeze non-empty predicates outside the six FrozenRelationPredicate surfaces. The strict handoff keeps them as unmapped-predicate residuals with the aligner's anchor. By the orchestrator ruling, semantica alone grounds these residuals with its existing evidence-scoped unique endpoint alignment, preserving the arbitrary historical predicate string. Hosted declared predicates still read RelationCandidate annotations. This departs from the letter of design section 5.4; the frozen batch, claim order, first-wins deduplication and byte-for-byte preview report remain gates. No historical predicate is declared as a registry term.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Declare a historical replay vocabulary in the semantica shard and map it in the target, by a superseding decision

### P3: semantica's hosted extractor reads the handoff; the projection, the ledger and the fixtures keep their shapes, 2026-11-22

`ExtractorLive` builds its `EvidenceBatch` from `ExtractionHandoff`. It reads the `Mention` annotations of its entity and structure classes (class back to label through its term table) and their anchors from the anchors table, still verified through its canonicalizer against `canonical.identity`, which is now the request's `source`. It reads depth and cluster from the readings, and the tier from the readings, so fuzzy relation evidence is still refused. It reads relation candidates with their endpoint Mentions and keeps choosing an existing entity claim at an endpoint anchor, or synthesizing a `relation-endpoint` claim, as today. It maps each residual candidate to what today's code makes of it, in today's order, from the fields the residual keeps. An aligned `unmapped-label` residual becomes today's Entity claim with its label as `entityType`, its anchor verified through the canonicalizer. Any other non-relation residual is `fabricated-span`. A relation residual is undecodable attributes (`model-output-invalid`), then an unaligned or fuzzy tier (`fabricated-span`), then an unresolved endpoint (`relation-unresolved`), placed in the chunk containing the residual's anchor. `groundHostedExtractions` becomes `groundHostedHandoff`; `canary/RelationPreview` calls it over a handoff built from the cached response. Its `relationCandidates` counts the candidates whose label is the relation target across readings and residual, and its `candidateCount` is the handoff's. Commit 1 freezes the preview report of the committed cases from today's code, and commit 8 compares the new report with it; the fixture `relation-preview.json` lists the cases only and proves nothing by staying unchanged.

`RdfProjectionLive` reads `EvidenceBatch`, which does not change shape, so "the semantica projection reads it" is met through the extractor that feeds the projection; `g-projection.json` waits for P5. The PGlite ledger is a per-run lab directory under a gitignored root whose payloads keep their shape; by this record it is outside the stored-format law. The `evidenceConfidence` default of `1` stays until P4.

The extractor grounds in two passes, as today, where every non-relation claim is built before any relation is grounded against all of them. Pass one walks, in candidate order, every reading of a `Mention` of an entity or structure class and every aligned `unmapped-label` residual, one claim each, so a Mention read twice with different depths or clusters gives two claims as today; the other non-relation residuals become `fabricated-span` in candidate order. Pass two walks, in candidate order, every `RelationCandidate` reading and every residual whose label is the relation target, with endpoint reuse over all of pass one's claims. Claims and degradations keep today's order, pass one's first, and the first-wins de-duplication (`ExtractorLive.ts:279`) is unchanged. Checked on a simulation of both: the two passes over the handoff give today's claim ids and degradations for 3,000 of 3,000 generated candidate lists, where one walk in model order gives them for 2,298.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Project annotations directly in RdfProjectionLive by a decision file, regenerating g-projection.json in the same PR

### P3: each extraction target declares what its label annotates; the handoff mints typed relation and coreference candidates from it, 2026-11-22

`ExtractionTarget` gains a required `annotates: TargetAnnotation`, a tagged union. `Mention { class: TermIri, coreference: Option<attribute name> }` reads the target's label as a class. `Relation { subject, predicate, object: attribute names; predicates: Record<string, TermIri>; endpoint: TermIri }` reads it as a relation. The prompt does not render it (`renderTarget` prints name, kind, attributes and description), so prompts and semantica's provider-cache keys do not change.

A `Mention` target turns each aligned, verified candidate whose label is the target name into a `Mention { class }` over its occurrence. Mentions of one class whose readings carry the same coreference attribute value form a `CorefCandidate` when there are two or more distinct Mentions; its targets are the union of its members' targets, which enters its `annotation/v1` id. A single-member cluster stays an attribute of its reading.

A `Relation` target takes the candidate's anchor as the evidence occurrence, the one target of its `RelationCandidate`, independent of the endpoints' occurrences; the ported test generator does the same, where the design module's (`ops/design/generators.ts:374-391`) used the endpoints' targets. Its subject and object attribute surfaces are aligned inside the evidence quote by the langextract aligner at fuzzy threshold 1, and only the exact, lesser and minimal-fold tiers count (semantica's `scopedEndpointAnchor` and `locateRelationEvidence`, `ExtractorLive.ts:403-437`, moved into the handoff); each is shifted by the evidence start, verified and anchored. Each endpoint is a `Mention { class: endpoint }` over its occurrence, so two relations naming one endpoint surface share one endpoint Mention by content. The handoff does not pick among other Mentions at the endpoint occurrence: semantica's endpoint reuse (`exactAnchoredEntity`, `:438-445`) chooses an entity claim by anchor and skips structure roles, a distinction the generic handoff cannot draw, and a refusal on two Mentions there could change the relation counts of the preview report. A reader that wants an entity at the endpoint reads the anchors row. An unaligned or fuzzy endpoint, a missing attribute or an unmapped predicate makes the candidate a residual with its reason (`relation-endpoint-unresolved`, `relation-attribute-missing`, `unmapped-predicate`) and its evidence anchor. A label that names no target is residual `unmapped-label`, with the aligner's anchor. Fuzzy relation evidence is kept; a reader that refuses it reads the tier from the reading, as semantica does.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Move the label mapping to a separate request vocabulary, or mint candidates in each consumer, by a decision file

### P3: the term snapshot keeps release 2.0.0, because the stack's base publishes no term set, 2026-11-22

Decision `p3-registry-terms` expected the registry writer to release the P3 term additions as 2.0.0 to 2.1.0, "if nothing else lands first". Commit 2 ran `bun run beep identity registry --write` with its default base, the merge base of the lane with `origin/main` (`9a4f7b0258d`). That commit has no `@beep/identity` term snapshot, because the P1 registry has not merged, so the writer took its `keep` release policy (`packages/tooling/tool/cli/src/commands/Identity/Registry.ts`, `releasePolicy`): until a base publishes a term set, every edit of the P1, P2 and P3 stack is part of one unreleased change, and the committed release stays 2.0.0. `beep lint identity-registry` and `beep identity registry --check` both pass on that snapshot.

The release is not set by hand and no `--base` naming the P2 lane is passed: that would release one step of an unpublished stack and bump once per layer. When a parent that publishes 2.0.0 reaches `origin/main` and the lane merges it, the writer then succeeds that snapshot. The lane regenerates at that merge, which gives 2.1.0 for these additions, and `release-regressed` in the identity-registry lint fails the lane until it does.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Regenerate with bun run beep identity registry --write --base <ref> against a ref that publishes 2.0.0, which writes 2.1.0

### P3: the @beep/text law generators move to src as @beep/text/Arbitrary and take the digest as an argument, 2026-11-22

The L2 laws need well-formed text, scalar-boundary ranges and `Anchored` rows, which `packages/foundation/modeling/text/test/support/generators.ts` already builds. Another package may not import a test file across packages, and a copy would trip the duplication gate. `@beep/file-processing` already ships its test engine from `src` (`src/test.ts`, served as `@beep/file-processing/test`). So `wellFormedTextWith`, `rangeIn`, `sourceFor` and `anchoredOn` move to `packages/foundation/modeling/text/src/Arbitrary.ts`, served as `@beep/text/Arbitrary`. They take a `JsoncDigest` argument instead of calling `node:crypto`, so the module stays runtime-neutral. The text tests import them from there, and the text laws cover the module fully. The annotation package's own generators (documents, document triples, containment cases) live in its `test/support`.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Move them back to text/test/support and give @beep/annotation its own copy under a duplication waiver, by a decision file

### P3: @beep/text/Arbitrary also serves scalarRangeIn, textDigestOf and wellFormedTextOf, with the digest as the first curried argument, 2026-11-22

Decision `p3-text-arbitraries-in-src` names four generators for `@beep/text/Arbitrary` (`wellFormedTextWith`, `rangeIn`, `sourceFor`, `anchoredOn`) and says they take a `JsoncDigest` argument. Three more move with them, and the digest is the first, curried argument.

- `scalarRangeIn` draws the scalar-index range that `rangeIn` turns into offsets. Without it, `rangeIn` alone gives the annotation generators no range on scalar boundaries, so they would rebuild it.
- `textDigestOf(digest)(text)` is the digest `sourceFor` writes as the capture's `textDigest`. The annotation generators need it for captures built from a document's text, as the design module's `mint.textDigest` does today.
- `wellFormedTextOf(codePoints)` is the text-and-boundaries builder behind `wellFormedTextWith`. The narrow-alphabet and overlapping-repeat generators that stay in `packages/foundation/modeling/text/test/support/generators.ts` build their text through it, so the builder is not copied.

`sourceFor(digest)(text)` and `textDigestOf(digest)(text)` take the digest first, so a test or generator fixes it once at module scope. `rangeIn` reads boundaries with `A.getUnsafe`, so the module has no unreachable fallback and its four coverage measures stay at 100 percent from the text tests alone. The narrow alphabet, the normalization pieces, `locatorStep`, `anchoredCase` and the platform SHA-256 stay in the text test support.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Keep only the four named generators in src and copy the range, digest and boundary helpers into each test support under a duplication waiver, by a decision file

### P3: the deterministic Tika scaffold declares text-scaffold/1, since the capture gate refuses an unversioned engine, 2026-11-22

The server standing tests use the deterministic apache-tika scaffold. Its descriptor and both ExtractionResult paths omitted engineVersion, so the versioned capture gate correctly refused review. By orchestrator ruling, the exported TIKA_TEXT_SCAFFOLD_VERSION constant is text-scaffold/1; descriptor.version and every scaffold result engineVersion use it. The engine name stays apache-tika. This is a pin of the in-process implementation, not a Java Tika version. The text and image-metadata paths have regression assertions in Tika.service.test.ts. Tika.tikaapp.ts and Tika.server.ts are untouched. The package is private, so no changeset is added. Commit 8 additionally runs package-verify for @beep/tika.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Replace the pin with the real Tika server version when the app/server path becomes the text engine

### P4: admission returns refusals and authenticates before writing, 2026-11-23

admit validates the core hash, nonempty claim-local grounding, all actor/action/revision/scope token bindings, token authenticity and current source receipts before producing Admission. A schema-valid token alone is powerless. The use-case port checks principal independently of caller input and resolves current text under the same scope. Expected missing, stale, ambiguous, denied or mismatched evidence is an AdmissionRefused value. Typed technical port failures remain failures until translated by the use-case; driver detail dies in adapters with boundary logging. No state is appended on refusal. Rehydrating any stored Admission repeats current verification and never grants a proof from decoding. P6 still owns the complete seven-path MatterAuthority deployment.

Independent review correction: membership in supportAtCreation alone cannot bind approval to a claim. Apply p4-trusted-claim-specific-admission-binding: trusted action/revision state must authorize the exact re-minted claim or trusted claim-set membership. The P0 token fields stay unchanged.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Change the refusal vocabulary and port in one breaking consumer migration; never restore decoder authority.

### P4: select stance and retraction independently at explicit as-of time, 2026-11-23

Design section 3.1 defines explicit core/event/snapshot/asOf inputs. Stance selects latest eligible stance/admission event; missing or conflicting events remain unresolved. Eligibility additionally requires selected core, verified authorization and grounding, no effective direct retraction and no wholly orphaned derivation. Retraction dominates eligibility even when stance remains admitted. Historical views select historical events and snapshot or return unknown. Readmission requires a new authorized action revision, fresh grounding and exact reference to the prior retraction being cleared; ordinary admission does not clear it. Readmission ends only that earlier retraction interval; equal-time retraction wins and later retractions block. Derived orphan clears only with live support. Test direct retraction, derived orphan, historical as-of and readmission.

Admission.clearsRetraction is an optional digest of the exact canonical encoded prior Retraction record. The trusted new action revision authorizes clearing that digest as well as the exact claim. Original events remain append-only.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Version the view and readmission event rules together while retaining immutable prior events.

### P4: decode assessment input before replacing a coordinate, 2026-11-23

updateAssessment accepts encoded input and a declared coordinate key. It decodes through the caller-supplied coordinate codec with S.decodeUnknownEffect before replacing the decoded value or evaluating any gate. Keep encoded and decoded sides distinct and preserve decoding service requirements. Malformed input returns InvalidAssessment with sanitized issue and the original unchanged record, and invokes the gate zero times. L4-6 adds this falsifier alongside totality, commute and owner monotonicity cases. Effect 4.1.5 source: .repos/effect/packages/effect/src/Schema.ts:1536.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Change coordinate codecs and refusal encoding together while preserving original records on failure.

### P4: bind stateless arrows to owner codecs, 2026-11-23

Schema factories return annotated ingredients for caller-owned Opaque wrappers. Bind the checked Effect.fn arrows once to the actual core or coordinate codecs through makeClaimArrows and makeAssessmentArrows; this captures no mutable state and creates no foundation service. Infer the core codec directly rather than through a whole generic factory return type, and reuse makeClaimRecords so encoded and constructor input types remain caller-owned. Refusal values preserve the original input record reference; schema decoding alone grants no checked identity or authority.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Replace the binding factories with explicit codec arguments while migrating callers and retaining the versioned encoded preimages.

### P4: CLI native cores link imported predecessors through a separate succession record, 2026-11-23

ClaimCore.supersedes names only a content-addressed ClaimId, and an imported legacy row has no ClaimId. A Holds renewal (or Kb revision) of an imported claim therefore appends a native v2 core with no supersedes field plus a separate Succession record from ClaimReference Imported{ledger, oldId} to the new ClaimId. The history reader closes the imported knowledge interval at the successor's knowledge start, refuses a second successor (fork), an unknown target or a logical-key mismatch with ClaimHistoryRefused, and never relabels the old id as a hash. Review changes are separate Review events, never new cores. Renewal facts (activity, generation end, knowledge start, agent, scope) are supplied by the effectful program, not a hidden clock.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Drop the Succession event kind and read native cores without imported predecessors; old v1 lines and v2 cores are unchanged.

### P4: historical docket checks carry provenance and never pass the gate, 2026-11-23

DeterministicCheck gains provenance (current or docket-check/v1) instead of a fourth result case. Stored v1 Boolean checks read through a private frozen projection as Passed or Failed tagged docket-check/v1. Only a current Passed check passes the review gate, and resumed rounds re-run their checks, so a historical true is never a fresh verification.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Drop the provenance field and read v1 Booleans as current results.

### P4: an Unknown docket gate reuses the deterministic-failure terminal status, 2026-11-23

A round whose gate is Unknown keeps the existing deterministic-failure terminal status (subject [CHECK FAILED]); its body shows a distinct line naming the unknown check, its side and the reason document-text-unavailable, so the explanation never asserts a disproved citation.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Add a dedicated terminal status literal for Unknown gates and route it separately.

### P4: evidence keeps position and a separate reported confidence signal, 2026-11-23

epistemic tables own frozen current and legacy span codecs. Strict current rows split to TextAnchor and extractor-confidence signal; loose legacy rows derive endChar as startChar plus UTF-16 quote width. A row still failing current text constraints is a LegacyEvidenceUnresolved record retaining old fields and reason, never a verified position. A stored scalar is Present reported confidence with method legacy-reported, never a calibrated probability. New writes use a tagged position-and-signal JSON shape in the existing span column; old rows are never rewritten. Table row schemas are separated from domain read records; both query shapes are supported by the span SQL accessors and converters. Verification receipts and manifestation-key bytes are not reminted; association compares the recovered position only, and unresolved spans cannot verify. Frozen synthetic fixtures cover strict, loose-width, empty and over-bound quotes.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Retain frozen row codecs and source digests so the read projection can be reverted without a rewrite.

### P4: prefix validation closes log gaps and owners supply key and gate laws, 2026-11-23

append validates minted core identity, repeated ids, existing same-partition supersedes, parent-before-child derivation, single supersession, ordered starts, generation start and current valid intervals on every prefix. Duplicate replay is idempotent only for the identical already-recorded core and is not a second append. Keep full-log check as a fold of append validations; do not let a future superseder hide a bad historical prefix. As-of stability is promised after knowledge time has strictly passed t. L4-3 is under content-hash collision resistance and parent ordering; generated graphs use effect/Graph.isAcyclic. L4-5 uses independently declared owner equivalence: party proposition equivalence, complete Kb proposition fields, Holds holdId equivalence. L4-6 tests actual owner gates with owner orders and total coordinates, never lifecycle chronology assumed monotone. Refusal returns unchanged state, unknown never passes. Retraction flags only nonempty wholly dead derivation. No L4 law row is marked green by a design simulation.

Independent review correction: apply p4-as-of-stance-and-retraction-eligibility for explicit selected-time stance and eligibility, and p4-assessment-decode-before-replacement for malformed encoded assessment refusals before any gate. These are required falsifiers, not claims of executed production proof.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Change the checker and law fixtures together while preserving immutable old import records.

### P4: recheck nanopub publication identity on decode, 2026-11-23

Decode rechecks ClaimId and canonical publication metadata, re-mints nanopub/v1 NanopubId and compares the publication plus four derived graph IRIs exactly. Stale publication id after publisher/time edits and wrong derived graph IRI are integrity refusals with original input. Foreign graph/publication names may remain import metadata but are not accepted native-profile publications. Normalization runs only after integrity validation and sorts/deduplicates accepted quads; it cannot rename or repair failed identity. Add both fixtures to NanopubAdapter.test.ts. The exact TTL licensing hold is unchanged.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Version the native profile and identity preimage together; retain refused foreign data with original names.

### P4: nanopub is a restricted adapter profile and never imports authority, 2026-11-23

@beep/epistemics/rdf/NanopubCodec is the only RDF-dependent claims entry. It exposes encode, decode and normalize over a declared four-named-graph profile: head, assertion, provenance and publication-info. Assertion contains canonical encoded ClaimCore as a typed literal supplied by the caller binding, with its recomputed ClaimId; provenance names generating activity and asserting agent; publication-info carries import/source metadata. The head links the three graphs through nanopublication vocabulary terms. Decoder validates graph separation, exact supported terms, core encoding/hash and matching provenance. Unsupported quads and authority records are residual or typed refusal, never silently dropped. Round-trip is over this declared profile, with quad-set normalization independently defined. Admission and human tokens are never imported as executable authority. Namespace and term registration plus a licensed, digested official-source NamespacePin are prerequisites in the same commit; base entry import-boundary test proves no RDF edge.

Publication identity is separate: NanopubId hashes ClaimId plus canonical publication metadata under nanopub/v1. Five distinct IRIs name publication and graphs. Provenance statements use the assertion graph as subject, and pubinfo uses the nanopublication subject. No Trusty URI or signature compatibility is claimed. The official https://nanopub.net/nschema bytes read during design hash to 1275f6a00121f54248899b9a4c39b2511fdbb65b2925a4dc6f4a13174059f649 and state modified date 2013-10-23, but no license. License attribution for the required NamespacePin remains an explicit implementation blocker for adapter admission; do not invent it.

Independent review correction: apply p4-nanopub-decode-publication-integrity. Recompute publication identity and check all five derived IRIs on decode; normalization never repairs failed integrity.

Reviewer-provided pinned source provenance (recorded here without a new GitHub access):

- [Website deployment workflow](https://github.com/Nanopublication/nanopub-website/blob/b6f41631a89791611f69ce5f7ffc63ad56e4fa08/.github/workflows/deploy.yml) copies Guidelines/nschema.ttl to /nschema.
- [Pinned TTL](https://github.com/Nanopublication/Guidelines/blob/8388dd90795b264f4b01c64d0f7218babcae4871/nschema.ttl) and served https://nanopub.net/nschema have SHA-256 1275f6a00121f54248899b9a4c39b2511fdbb65b2925a4dc6f4a13174059f649. The TTL has no license notice.
- [Companion HTML](https://github.com/Nanopublication/Guidelines/blob/8388dd90795b264f4b01c64d0f7218babcae4871/nschema.html), around line 137, grants Creative Commons ShareAlike Attribution 3.0 for "this document", linked as http://creativecommons.org/licenses/sa-by/3.0/.

The HTML notice does not explicitly cover the TTL. The website repository MIT license does not cover imported TTL bytes. Keep the exact TTL unlicensed/unresolved in the design and hold NamespacePin registration and adapter admission until attributable permission is established; neither source provenance nor the companion notice releases that hold.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Replace the declared profile and golden with a new adapter version while retaining rejected input as residual.

### P4: party corrections across a logical key retract and reassert instead of superseding, 2026-11-23

The append law accepts supersession only inside one (scope, logicalKey) partition. A party correction that changes the proposition's logical key (for example a corrected finance fact or a vetoed merge) is recorded as a direct Retraction of the old claim plus a newly minted claim, so the history stays checkable and nothing is silently overwritten. An exact replay of an identical record into PartyLedgerMemory is unchanged state, not a conflict; a different record under an existing id or claim/time key is still a LedgerConflict. Party challenge records must name existing claims at both ends.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Allow cross-key supersession in the append law and migrate party fixtures back; existing retraction records stay append-only.

### P4: require explicit native creation facts at party projection boundaries, 2026-11-23

Party projection entry points receive an explicit native ActivityStart, generation end, knowledge start, asserting agent and scope. Existing source activity ids and assertion timestamps remain source provenance; they are never relabeled as content-addressed generation facts. The projection mints text occurrences only from TextOccurrence receipts, and retains non-text assertion references separately with empty text support. Ledger writes store cores, generation receipts, evidence links, review records and signal records separately; reads join them at an explicit asOf time.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Version the party creation request and migrate callers without changing existing core identities or source assertion ids.

### P4: the review hub lists legacy imports and refuses answers to them, 2026-11-23

Unresolved legacy review items stay visible in hub queues for repair. Answering one fails with the typed ReviewItemRepairRequiredError (code repair-required), so admission and executable question writes refuse the imported case.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Hide imported items from the hub instead of listing them.

### P4: review item upsert holds unresolved imports; repair is a separate port method, 2026-11-23

ReviewItemStore.upsert returns the ids it held because their latest stored version is an unresolved legacy import, and never overwrites that import with a generated selector. The new repair method writes an explicit revision that retains the old bytes; writing an item equal to the stored current item is skipped. The docket question publisher logs held ids as a warning.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Fold repair into upsert behind an explicit flag.

### P4: new review hub items.jsonl lines use a review-item/v2 envelope, 2026-11-23

New items.jsonl lines are written as {format: review-item/v2, item}. Untagged v1 rows are read only through the frozen private ReviewItemLine reader, which projects nonempty quotes to QuoteSelector and empty ones to LegacyQuoteUnresolved; v1 bytes are never rewritten.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: No stored-data reversal is needed: v1 bytes are untouched; switching writes back means re-pointing the writer at the untagged v1 shape.

### P4: preserve ReviewHub quote imports across selector retirement, 2026-11-23

ReviewHub items.jsonl persists ReviewItem, including SourceRef arrays directly and inside QuestionFact. Freeze representative synthetic v1 rows before migration. A private frozen untagged quote reader preserves exact/prefix/suffix and all locators. Nonempty exact becomes QuoteSelector; empty exact becomes LegacyQuoteUnresolved with raw data and field path. Any unresolved nested quote yields LegacyReviewItemImported, displayed for repair and refused by executable writes/admission. Read old and versioned v2 rows; append only current v2 items and preserve raw old bytes. Migrate SourceRef, ReviewItem, QuestionFact, DocketQuestions and all measured consumers in commit 7 with ReviewFiles.test.ts reopened-store, mixed-version, byte-digest and no-op replay tests.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Replace the private versioned reader and explicit repair path together while preserving old JSONL bytes.

### P4: semantica v1 ledger scalars import as legacy-unknown with side-car raw values, 2026-11-23

Every ledger-evidence/v1 claim, top-level or nested in a batch, reads as Absent legacy-unknown without consulting the provider cache, because the old ledger wrote 1 whenever confidence was missing. The stored number is kept as a LegacyConfidenceImport in LedgerSnapshot.legacyConfidence, not on the current claim. New writes are ledger-evidence/v2 envelopes, read only after the raw payload bytes match the stored digest. Degraded batch ids stay the digest of the plain outcome encoding, so ids do not change. Pattern readings carry the producer pin Engine{wink-nlp, 0.0.0}. A fresh reading that differs from a stored v1 row fails with immutable-payload-conflict instead of overwriting it; re-appending the projected outcome is a no-op. hosted-batch-v1.json stays frozen beside the new v2 snapshot.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Add a reader that proves a v1 scalar from the cached provider response and upgrades that claim to Present without rewriting stored bytes; drop legacyConfidence once no v1 rows remain.

### P4: missing confidence stays absent and docket unknown is not passed, 2026-11-23

Office-action extraction with no model confidence emits Absent not-assessed; semantica optional confidence uses the same carrier, preserving explicit zero and one. Reported unit-interval confidence is a named reported measurement with producer/method provenance, not ClassifierProbability. DeterministicCheck replaces passed with Passed, Failed or Unknown document-text-unavailable. Check cited passages against available message text first; a demonstrated message match passes even if document text is unavailable. A missing passage with attached unavailable text is unknown, and with complete available text is failed. The gate passes only Passed, and explanation retains unknown separately from contradictions. Urgent tentative entries remain visible. Any stored boolean check reader maps old true to historical Passed with legacy provenance, never to a newly verified current check; rerun before using a live gate. SourceQuote becomes TextAnchor, TextQuote becomes the text quote selector, and SourceRef keeps its legal locator fields with the shared selector.

The extractor signal value schema accepts existing Measurement cases and the tagged ReportedConfidence case, with value, method and optional producer pin. Existing stored Measurement encodings remain readable. Semantica legacy scalar origin may be unprovable because of its old default: keep raw numeric metadata and emit Absent legacy-unknown unless the frozen provider response proves an explicit report. LedgerLive claims and nested batches verify their original raw digests before read projection; a repeat append compares normalized facts or returns an immutable-payload conflict, never overwrites the old payload.

Independent review correction: SourceRef reaches persisted ReviewHub items.jsonl through ReviewItem and nested QuestionFact, plus DocketQuestions.schemas.ts. Apply p4-reviewhub-private-quote-imports; an empty legacy exact remains unresolved import data, never invented nonempty text. Commit 1 freezes rows; commit 7 changes readers/writers with the reopened-store proof.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Revert consumer projections with explicit versioned stored readers; never silently infer missing numbers.

### P4: status census keeps distinct coordinates and retires envelope in one wave, 2026-11-23

research/status-census.md names all eight P0 sites with current consumer references. ReviewState, ClaimDispositionStatus, ClaimEvidenceReviewStatus and shared/domain ClaimLifecycle are distinct owner coordinates. ClaimGateResult is the structural verdict coordinate; StructuralVerdict is its duplicate and is removed. ReviewTag is derived from ReviewState. ReviewerDisposition is the reviewer signal value. SQL disposition literals and CHECK remain unchanged. Party, Kb and Holds all migrate in the same commit that deletes makeClaimEnvelope/ClaimVersion, including derived ports, policies, ids, projections, tests and CLI rendering. EvidenceSpan deletion likewise includes all its consumers. Remaining L4 design imports, generators, export and opsScripts registration move or disappear together. No standards exception inventory grows; all new src files are planned at 100 percent coverage.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Restore a retired facet only with its chapter-11 census and migrated consumers, never by an alias.

### P4: frozen claim rows become explicit import records without fabricated authority, 2026-11-23

Frozen Kb and Holds ClaimVersion schemas live only in private persistence readers, not public compatibility exports. Read a whole old log plus assertion/probe sidecars before resolving supersedes. Emit LegacyClaimImported records with source digest, old id, original valid/knowledge bounds, proposition, evidence references, five signals and review payload. Split review and challenges into separate claim-local imported records; preserve old reference namespaces in a lookup keyed by ledger and old id. Missing scope, generation, actor, text identity and human token are represented as a nonempty missing-facts set, not invented. These are new records returned by the declared read-time transform, not ClaimCore and not Admission. Historical CLI views read this import projection; live authority and L4 log appends accept only fully materialized minted cores. When all creation facts are available, materialization emits a new core plus an import-to-core link; otherwise it remains explicitly imported. Legacy accepted review never becomes an authenticated admission. Keep expiredAt even when no successor is present as import history; do not fake a superseder. New writes are version-tagged core/record events. This satisfies the stored-row-to-new-record requirement without claiming missing facts were stored.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Keep the frozen source bytes and revert the read projection; reassert any new core as another record.

### P4: annotated core ingredients and stateless claim arrows, 2026-11-23

L4 stays in @beep/epistemics with ClaimCore.schema.ts, ClaimCore.ts, ClaimLog.schema.ts, ClaimLog.ts, Assessments.ts, Admission.ts, Confidence.ts and rdf/NanopubCodec.ts. makeClaimCore takes one options object with caller identity composer, proposition and id codecs, including logicalKey. It returns annotated schema ingredients; callers wrap product records in branded S.Opaque classes. Tagged unions remain annotated schema unions; never extend Opaque over a whole union, which tsrs rejects. makeSignal, AbsenceReason and Measurement move to @beep/schema/Signal with no old aliases; Confidence moves to @beep/epistemics/Confidence. Foundation defines no Context.Service: pure functions and Digest effects use explicit resolver and token-verifier ports. The owning use-case service supplies authority and current-source access. Stance is a view over core and separate records; admitted is never a writable model flag.

Commit 2 must also move the retained ops/design/L4.claims.ts:16 AbsenceReason import to @beep/schema/Signal, leaving only ValidTime at the old Claim leaf. Search all retained goals/**/ops/design modules for retired exports before advancing, not only production package paths.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Restore a service only when a stateful owner or second implementation needs it; retain encoded preimages.

### P4: bind admission actions to exact claims in trusted state, 2026-11-23

Occurrence membership establishes support, not human approval of a proposition. Keep all P0 HumanAdmissionToken fields. A trusted resolver maps authenticated action and exact revision to a re-minted ClaimId or a versioned canonical claim-set digest with trusted immutable membership. The verifier checks the supplied checked ClaimRecord against that binding and all actor/action/revision/scope fields before admission. Caller metadata and a standalone claimed digest cannot establish the binding. Missing, stale or mismatched binding refuses without writes. L4-2 includes two claims A and B sharing occurrence O: a token authorizing A must refuse B.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Replace the trusted binding resolver and its refusal tests together without granting schema-decoded authority.

### P4: verify historical admission stance separately from selected eligibility, 2026-11-23

Selected-time views verify each stored admission at its admission time before observing admitted stance. An optional historicalPorts input supplies trusted historical authorization evidence independently of selected-snapshot ports; absent this input the same ports verify both times. Selected source denial or unavailable selected binding does not erase verified historical stance. A decoded admission without verifiable historical evidence stays unresolved. Selected authorization and grounding determine eligibility separately. This preserves stateless foundation arrows and creates no decoded capability.

Unavailable historical or selected binding evidence yields unknown authorization eligibility. It never grants admitted stance without historical verification or grants outward eligibility.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Remove the optional historical ports together with callers and stance regressions; never grant decoded records authority.

### P4: version admission bindings and verify selected snapshots, 2026-11-23

Use claim-set/v1 for canonical trusted claim-set membership and claim-retraction/v1 for the exact encoded prior Retraction record. Admission ports resolve authenticated principals, immutable action-revision claim bindings, native claim generation and current sources; historical views use a distinct selected-time source resolver. A readmission clearing is verified at its own admission time before closing the named prior retraction, and eligibility separately verifies the selected snapshot. Unavailable historical verification remains unknown and never grants eligibility; direct retractions at the same time as a clearing win.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Version the binding and retraction preimages together and migrate explicit verification ports while preserving old event records.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
