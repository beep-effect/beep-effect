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
- `packages/foundation/modeling/provenance`, becoming `@beep/text` in P2 (L1:
  `Selector`, `OccurrenceId`, `QuoteKey`, `Resolution`, `Reanchoring`, unit
  conversion; `TextAnchor` and `VerifiedTextAnchor` keep their shapes; created
  through `bun run beep create-package`, the old name retired per chapter 11
  with every consumer migrated in the same PR).
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
- `packages/foundation/modeling/md`, `pandoc-ast`, `lexical`, `html`: AST
  source maps that import `@beep/text`.
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

## Constraints

- Effect v4 against the installed `effect` (4.1.4 at P0; validate every API in
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
9. `Anchored` is an L1 `S.Opaque` of range, quote and the powerless
   `TextAnchorVerificationReceipt` (never a `VerifiedTextAnchor`, so decoding a
   stored document grants no proof); the `anchors` table checks that each key
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
- [ ] L2: `@beep/annotation` exists with `makeAnnotationDocument` (anchors
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

Commit 7 (PR B, `feat(repo-cli): identity registry generator`) follows the live tree at four points where the registry-first design and decision 2026-11-19-p1-term-snapshot-namespaces-and-violations differ from it. (1) Layout: the committed JSON (shards and `registry/term-snapshot.json`) is in the layout the repository's Biome JSON formatter keeps (line width 80): an object keeps one member per line, and an array of scalars sits on one line when it fits. A namespace or deprecation row in the snapshot therefore spans several lines instead of one canonical row per line. The generator renders that layout itself (`renderRegistryJson`), so `--check` is byte-exact and `biome check` passes with no override, and the hand-rolled JSON lint stays clean without a suppression. (2) Conflicts: `RegistryConflict` has ten cases, the eight of design section 3 plus `TermOutsideNamespace` (a decoded table's term IRI is its namespace IRI followed by its local) and `DuplicateDeprecation`, and `RegistryTable.fromShards` returns every conflict, ordered by kind and key, instead of the first, so one lint run reports them all. (3) Release: `RegistryTable.snapshot(table, previous)` takes the previous snapshot, since ruling 2 makes `release` depend on it: unchanged keeps it, the empty snapshot gives 1.0.0, a new deprecation bumps the major and any other change the minor. The generator's previous snapshot is the committed file; the base-ref comparison of design section 7 lands with the term-stability gate in PR C. (4) Lint wiring: `lint identity-registry` reports `registry-shard-invalid`, `registry-conflict` and `registry-generated-drift` and `--fix` regenerates; a checkout with neither shards nor the generated data module (the lint's fixture repos) carries no registry and is not checked. The other section 7 kinds wait for commit 15.

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

1. **Release.** `main` has no term snapshot, so the base the stability gate reads is the empty snapshot. Decision `2026-11-20-p1-schema-athlete-removed-before-first-snapshot` restarted PR B's unpublished snapshot at 1.0.0 for that reason. PR C's snapshot, which moved from 1.2.0 to 2.0.0 (point 5 of `2026-11-20-p1-republish-live-tree-calls`), was never published either. The merged snapshot was therefore deleted and regenerated from the empty base by `bun run beep identity registry --write`. That gives release 1.0.0, and every binding and deprecation row of the research-library and vitest shards records `since: "1.0.0"`; `ReleaseBelowSince` would refuse 2.0.0 rows in a 1.0.0 snapshot. The 113 deprecation rows stay as PR C wrote them: they retire IRIs that left the process before P1, and the snapshot never publishes them as live. `schema:Athlete` was never in a published snapshot, so it is absent and has no deprecation row. `lint identity-registry` reports the empty base and passes.
2. **Replacement chains.** PR B ruled that a replacement chain ends at a declared term, never at a namespace IRI. PR C let `ShardDeprecation.replacement` be `""` so the retired `lib:` namespace IRI `.../Library.schemas/` could name the `research-library` namespace as its successor, and let `replacementOf` follow a chain to any namespace IRI. After the textual merge, PR B's check refused PR C's row (`ReplacementUnknown`). The kept rule is the stricter one, with the category of the deprecated IRI preserved:
   - A retired term's chain ends at a declared term. It never ends at a namespace IRI, and a namespace IRI is never a binding target (PR B unchanged).
   - A retired namespace IRI's chain ends at a declared namespace IRI, never at a term. A retired namespace IRI is a deprecated IRI that ends with `/` or `#` (`isNamespaceShapedIri` in `Term.ts`). That test cannot misread a term: a `TermLocal` never ends with either character, so no term IRI does.
   - `RegistryView.replacementOf` applies the same rule, so the generated view and the table agree.
   - `beep identity deprecate` retires only live terms, so it now refuses `--replacement <prefix>:` with `replacement-unknown`. Before, it wrote a row that the table check would then refuse.
   Tests: `RegistryTable.test.ts` (both directions and both separators), `Registry.test.ts` (the view), `identity-shard-edit.test.ts` (the refusal) and `TermStability.test.ts` (the 113 retired IRIs, the namespace row included).
3. **Release arithmetic.** PR B made `nextMajor` and `nextMinor` exact `bigint` arithmetic. PR C's `releaseNumbers`, which orders releases for `ReleaseRegressed` and `ReleaseBelowSince`, still used `Number`, so two releases past 2^53 could compare equal. It now reads `bigint` components with `Order.BigInt`, and `nextMajor` and `nextMinor` reuse it. `Term.test.ts` covers the case at 2^53 + 1.
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
2. **Gate.** The term-stability gate refused a release below its base but accepted a changed term set at the base's own release, so `lint identity-registry --base <PR B head>` passed the 1.0.0 snapshot. `snapshotViolations` now reports `ReleaseUnderstated`: the rows changed, and the release is lower than the one the change calls for (the release the generator computes from the base). That is a minor bump for additions, a major bump for a new deprecation, and 1.0.0 after the empty snapshot. A head can still be above that release, because a branch may cross several regenerations before it merges. The lint maps the new violation to `release-regressed`. Merging the base and regenerating is not the remedy: `--write` reads the checkout's own snapshot, so a snapshot that already holds the changed rows at the wrong release regenerates to itself. The remedy is to merge the base if it is not merged yet, put the base's `term-snapshot.json` back (`git restore --source <base> -- <snapshot>`), set the `since` of every row the change adds to the release the change calls for, and then run `bun run beep identity registry --write`. `lint-identity-registry.test.ts` walks these steps in a checkout whose base is already merged.
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
3. **The snapshot release is guarded.** `SnapshotViolation` gains `ReleaseRegressed` (the head release is below the base release) and `ReleaseBelowSince` (a snapshot release below a `since` its own rows record, reported by `--check`). Both map to the new kind `release-regressed`.
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
3. **`beep identity rebind <from> <to>`** rewrites only the shards whose bindings move. Both ends are code identities, or both are packages for a package rename. A package that a shard projects into needs two source edits first (the same decision, point 7). Before writing, it checks the move with `RegistryTable.rebind`, so a move onto a code that is already bound is refused. A move that finds no binding is also refused. It then regenerates the artifacts. The snapshot rows list bindings by code, so a rebind changes the snapshot's binding rows and bumps the minor release. The design's "term-snapshot.json is byte-equal" therefore holds only for the snapshot's terms, namespaces and deprecations. The end-to-end test and L0-3 test 2 assert those collections, not the whole file.
4. **`beep identity deprecate <curie> [--replacement <curie>]`** is the only writer of a deprecation row, as section 7 requires. It removes the local from its shard and appends the row. Its `since` is the release the regenerated snapshot will carry, the next major, which it computes with `RegistryTable.snapshot` rather than a second copy of the release rule. A `ShardDeprecation` replacement is a local of the shard's own namespace, so a replacement in another namespace is refused, and `<prefix>:` names the namespace itself. A term that is still bound is refused: a binding must name a live term, so the binding is removed from the shard first. A rebind does not help, because it keeps the term bound.
5. **Left for later, with reasons:**
   - The ts-morph form of `binding-dangling` (a scan for an annotation call site of each bound code) is not added, because annotations do not read bindings (commit 14). The fold's `unboundClass` refusal (commit 13) is not enough on its own: it fails only research-library tests at runtime, and nothing consumes the vitest bindings that way. The PR C review fix therefore adds the cheap form, decision `2026-11-20-p1-review-fixes-bind-kept-sites-and-harden-the-gate`: `rebind` refuses a target module the checkout lacks, and `identity registry --check` reports `binding-dangling` for a binding code that names no module file.
   - `term-local-multi-segment` is not added. The kept values of section 5.2 declare multi-segment locals such as `qa:receipts/accepted/v2` on purpose. Against `origin/main`, which has no snapshot, every one of them is new on P1's own PR, so the check would refuse the design's own data.
   - `registry-since-mismatch` is not added. `deprecate` now computes `since`, and binding `since` values are already guarded by `SinceRewritten` against the base.
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

### P1: registry edits move codes by one schema, retire stale projections and say how to finish, 2026-11-22

A second review of PR #3449 found five ways the registry commands or the lint let a checkout drift from its registry, or named a repair that does not work. Each was reproduced with a failing test first.

1. **A move is a schema.** `CodeMove` (`@beep/identity/Term`) is a union of `CodeIdMove`, from code identity to code identity, and `CodePackageMove`, from `CodePackage` to `CodePackage`. `RegistryTable.rebind(table, move)` and `beep identity rebind` take it, and `moveCode` is the one place that applies it. The design and the command's own documentation promised a package rename, but both ends were decoded as `CodeId`, which needs a path, so `rebind @beep/old @beep/new` was refused. `CodeId` is unchanged: a stored binding still names a kind. A move between a package and a code identity is refused (`mixed-move`), because moving a code onto a package would leave a code with no path. The shape replaces `RebindRequest` and the `(from, to)` arguments, with no shim.
2. **A projection module no shard targets is drift.** `RegistryPlan.retired` lists the projection module of every package in the checkout that no shard projects into. `--check` reports one that is on disk and `--write` removes it, but only when the file starts with the generated projection header. A file the generator did not write is never reported or removed. While any shard targets the package, its module is generated as before. `writeRegistry` answers a `RegistryWrite` with what it wrote and what it removed.
3. **A binding needs a regular file.** A directory named like a module file (`src/Runner.ts/`) passed as a module. The check now reads the file type, and a path below a file is no module instead of an I/O failure.
4. **A failed write says how to finish.** The whole plan runs before the first write, the edited shards are written before anything generated from them, and each file is staged and renamed, so a failure leaves whole files. A failure while the shards are written says to run the same command again, which edits the shards that are left. A failure after that says the edit was applied and to run `bun run beep identity registry --write`, because the edit no longer applies: the term is not live, or the old code is not bound.
5. **Deleting the registry does not pass the lint.** `lint identity-registry` returned early when a checkout had neither shards nor the generated data module, so deleting both passed over a base that published terms. It now reads the base snapshot first and compares an absent registry as the empty snapshot. A base that published nothing still passes, so a fixture repository needs no registry. The base snapshot is located in the base tree, never at the head's path: the lint lists that tree and takes the term snapshot beside the `package.json` that names `@beep/identity`. Reading the head's path let a change that moves the package directory find no base, so it could drop terms or the whole registry. Only a base tree with no such snapshot counts as empty. When a base tree has several, the one at the head's path is the base, and with none there the lint fails instead of guessing. The release remedy names the base's path when it is not the head's.
6. **Remedies that repair.** The release remedy restores the base's snapshot before regenerating (decision `2026-11-20-p1-pr-c-snapshot-is-release-2-0-0-after-pr-b`, point 2), and a bound term's refusal names the shard to remove the binding from instead of a rebind (decision `2026-11-20-p1-term-stability-gate-live-tree-calls`, point 4).
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

### P2: mention ids are cm2 over a bare-hex digest, only the case-occurrence authority key bumps its tag, and the preimage belongs to law-practice, 2026-11-22

CitationMentionId becomes cm2: plus 64 hex, where the hex is the ContentHash of (citation-mention/v2, engineArtifact, semanticKind, OccurrenceId) without its sha256: prefix. The prefix bump keeps v3 and v4 receipts distinguishable on sight and lets the frozen v3 schema own cm1:. The bare-hex display form is the slice's existing token shape; the digest behind it is the standard one. The preimage is declared with definePreimage in packages/law-practice/server/src/internal/Citation/MentionIdentity.ts, not in @beep/text: citation kinds are legal semantics, which SPEC keeps out of foundation, so the CitationMention* exports of the design module are not moved into the package. Authorities: only the case-occurrence key embeds a mention id, so only that key changes its tag to citation-authority/v2; the case, law, journal and external-resource keys keep citation-authority/v1 and their ids. The ca1:, cl1: and cg1: prefixes stay, because they version the token format and the default-path cl and cg ids are a slice of the authority digest: they change exactly when that digest changes, which is the bumped tag p0-rq4 asks for. cd1 and the session-node cl1 and cg1 ids have no mention id in their preimage and do not change. Side-by-side goldens over the existing test source: cm1:dc70e426b0b9aa61caf21a5e6e0c7274720c7e674ff2b06a8cdfd82ee0346ae9 and cm2:7ece8d5655b197d8063442248a8f630cd05fee535fe5ae550f2b15754425cd44; its case-occurrence authority ca1:7f43ae8777fd804f01172cce2e73b1762c712f9f7e4c8d08bffdb58a49341bf6 (v1) and ca1:4d2adc3d142ce1c3a4b028bde50b9f27253a829404d1f7d773442e6d6ab5ee13 (v2).

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Return to cm1 with a further receipt version step and its own read-time transform; the v1 encoder is kept as a pinned historical encoder.

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

### P2: Reanchoring carries the target receipt, LocatorMap segments are Kept or Rewritten, and laxity is stepwise below composite, 2026-11-22

DECISIONS.md (2026-11-19) says re-anchoring is a recorded map with its own receipt, but the design module's cases held two ids and no receipt, so a caller could not read the new range. Exact and Widened become { from: OccurrenceId, to: Anchored }; to is produced by verifyTextAnchorAgainstVerifiedSource on the target capture and projected, and its id is minted from it, never stored beside it. LocatorMap segments become a tagged union: Kept (equal width, offsets inside map pointwise) and Rewritten (the segment maps only as a whole), both with UTF-16 positions, ordered and disjoint on both sides; a gap is unmapped. Exact means both boundaries land on a segment edge or inside a Kept segment; Widened means a boundary fell inside a Rewritten segment and the image grew to its edge; Unmapped otherwise. UnmappedReason becomes capture-mismatch, outside-map, split-boundary and quote-mismatch: ambiguous and quote-not-found are removed because no quote search takes part in reanchoring, and quote-mismatch is the refusal when a Kept segment's target text differs from the source quote. A range whose image spans text inserted in the target is Widened. Results are ordered by range inclusion, and the lax comparison runs from the two steps to the composite map: whenever reanchor by f then g and reanchor by compose(f, g) are both mapped, the stepwise range is inside the composite range; when both steps are Exact the composite is Exact with the same range; the identity map gives Exact with the same id. The comparison is not claimed against Unmapped: a first map may insert text that the second does not cover, so the steps can be Unmapped where the composite is not, and the composite may drop a straddling piece the steps kept. On maps without gaps Unmapped does not occur for an in-range occurrence and the comparison is total. compose cuts the middle capture at offsets that are not inside a Rewritten segment of either map and drops a piece that touches a gap. A throwaway simulation of these rules on this base found no counterexample: 400,000 random map pairs with gaps and 300,000 without, with 126,000 and 151,000 Exact pairs composing exactly; it did refute an earlier form of the law that put Unmapped on top of the order. @beep/text owns the two text normalizations L1-3 tests (nfkc and dehyphenate), each returning the text and its segments; the NFKC segmentation is the joins-cluster scan, since grapheme clusters alone are unsound (compatibility jamo compose across them), with the join rule of decision p2-nfkc-clusters-join-on-the-normalized-mark. The dehyphenate segment is the whole context its rule reads: the preceding scalar, the removed run and the following lowercase scalar are one Rewritten segment, and matches that share a scalar merge. With the following letter outside the segment naturality is false: in exam-, line break, ple the range of exam-, line break lands on segment edges and maps Exact to exam, while the normalization of that quote keeps its hyphen. A second simulation checks, for both normalizations, that the segments concatenate to the normalized text and that every Exact scalar-boundary range has the normalization of its quote as target, and the same for dehyphenate after nfkc: 350,000 random strings salted with hyphen breaks and every scalar NFKC changes, 13.9 million ranges, 12.2 million of them Exact, 966,000 composed Exact chains, no counterexample. The same script refutes both earlier segmentations.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Return bare OccurrenceIds and untagged segments again, as the design module did, by a decision file before P3 records a re-anchoring.

### P2: v3 citation receipts convert to v4 through a server read codec that checks the stored cm1 and grants no proof, 2026-11-22

The live schemas become citation-document-receipt/v4 and citation-mention-receipt/v2 (the nested receipt's id changes meaning, so its version moves with the document). The read side is CitationDocumentReceiptRead in law-practice server, a union of the live schema and a frozen v3 schema decoded into it with SchemaGetter.transformEffect; encoding v3 is SchemaGetter.forbidden, so writes are always v4. It lives in the server because it needs Digest; the domain schema stays service-free. The frozen v3 schema types only what the step reads or rewrites (version tags, id positions with frozen cm1, ca1, cl1 and cg1 templates, engine artifact, citation.type and the anchor receipt) and passes every other encoded field through; the live v4 schema then decodes the result, so the coherence filter runs on it. Before minting, the pinned v1 encoder recomputes each cm1 and a mismatch is refused: a transform must not turn a stale or tampered id into a fresh one. Case-occurrence authorities are found by recomputing their v1 key, never by looking at the page component. Every reference is rewritten through the old-to-new maps and a dangling reference is refused. The converted receipt is still powerless: restoreCitationDocument re-verifies the source text and the anchors and re-mints every id. Neither restore function has a caller outside the tests and the package exports map ./internal/* to null, so the read codec and restore are both internal; the first consumer that holds a receipt exports their composition (read, then restore) from a public subpath, and until then CitationMentionMigration.test.ts is the only place that composes them. Out-of-band CitationResourceBinding values are adapter expectations that no one stores; adapters re-derive them and receive cm2 ids, so they are not converted. A standalone v1 mention receipt converts through the same mention step (CitationMentionReceiptRead); CitationEngineResolutionInput is a served input with no stored rows and refuses v1 under the amendment.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Delete the read codec and refuse v3 again by a decision file that records that no v3 receipt is held anywhere.

### P2: a Refined selector over a base that is not Unique resolves to the base's outcome, 2026-11-22

Decision p2-selector-resolution-semantics says Refined resolves by inside the segment base selects, and that a composite is NotFound when a part is NotFound and otherwise Ambiguous with the product of the counts. It does not say what by is resolved in when base is Ambiguous: there is no single segment, and Resolution carries a count, not the candidates. resolve therefore does not evaluate by over an ambiguous or absent base; the Refined outcome is the base outcome (Ambiguous with the base count, or NotFound). The product rule stays for Range, whose parts are both resolved over the whole text. The outcome still fails closed exactly when it should: a Refined selector is Unique only when its base is Unique and by is Unique inside it. Counting every by match inside every base candidate would need candidate enumeration, which the design rules out (callers that need candidates search for them explicitly), and a nested Refined would multiply that work.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Resolve by inside every candidate of an ambiguous base and report the summed count, by a decision file before P3 builds on resolve.

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

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
