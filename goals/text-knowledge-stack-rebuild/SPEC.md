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
   `cm1:` preimage is re-expressed as an occurrence preimage and existing
   records are re-minted by a migration; the five non-canonical anchor
   encodings are deleted. `Selector` is the one selector union beside the
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
   `TermBinding` table and a stability snapshot that only a deprecation record
   may change; the registry expands every namespace the repo speaks (`prov:`,
   `oa:`, `nif:`, `xsd:`, `gufo:` included); today's path-derived IRIs are
   re-published, not pinned.
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
    every `@beep/schema-org` facet is rehomed or deleted, each through
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
- `goals/belief-view-engine` (paused) stays the selection policy over
  contention sets and becomes a downstream consumer of L4; triage policies
  here never cross an admission gate and never write authority.
- `explorations/citation-grounding-hallucination-guard` (parked) carries
  alignment question Q7, where a qualifier-aware stance layer lives and the
  minimum qualifiers before two claims may be compared. L4 `Stance` here is the
  admission workflow (`verbatim | proposed | admitted`) and does not decide
  Q7; that question reopens with that exploration's guard gate.
- `goals/citation-extraction-engine` (active) remains the owner of the
  citation identity module; P2 changes its preimage to the occurrence form and
  migrates its records in one PR with that lane's review.
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
  Breaking public API or wire changes still ship with a major changeset.
- Local-only or on-device architecture language. Hosted providers are
  welcome; the 2026-08-17 revision of the confidentiality rule withdrew the
  local-first framing.
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

- `packages/foundation/modeling/identity` (L0: registry, `TermBinding`,
  `ContentHash`, `ActivityId`, canonical JSON).
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
  `MappingSet`, `fold -> Dataset`, optional gUFO class typing; legal seeds and
  FOLIO DTOs move out to the law-practice asset pack through
  `ontology/src/TaxonomyLoader.ts`).
- `packages/foundation/modeling/rdf` (L6: `Dataset` quotient and digest,
  `Literal` cases, `TextAnchor <-> oa:` in `src/Adapters/WebAnnotation.ts`,
  `prov:Entity` projection through `src/Prov.ts`, registry-backed `prov:`,
  `oa:`, `nif:`, `xsd:`; the `rdf -> md` edge removed).
- `packages/foundation/modeling/md`, `pandoc-ast`, `lexical`, `html`: AST
  source maps that import `@beep/text`.
- `packages/foundation/modeling/schema-org`: every facet rehomed or deleted in P7.
- `packages/foundation/capability/langextract/src/Handoff` (verified receipts
  first, lossless handoff), `apps/labs/semantica/src/layers` (projection and
  the `1` default), `packages/law-practice/use-cases` (`OfficeActionReview`
  `0.9`, `DocketIntake/DocketReview.policy.ts` unavailable-text check,
  `IrToLaw` ports), `packages/law-practice/server/src/internal/Citation` and
  `packages/law-practice/domain/src/values/Citation` (the `cm1:` preimage and
  its migration), the law-practice asset pack that receives the legal seeds.
- `packages/tooling/test-kit/test-runner` pinned `test-utils` IRIs
  (re-published from the registry).
- `standards/architecture/` (new knowledge-stack chapter, `DECISIONS.md`
  entries including the scoped chapter-11 amendment, `GLOSSARY.md` entries),
  `docs/PROSE_TO_PROOF_VISION.md` (local-first posture, BeepGraph status),
  `packages/foundation/modeling/nlp/THEORY.md` (its narrative moves into the
  chapter, then the file is retired with the package), `standards/instrumentation-catalog/` shards for every package
  that gains spans.

## Constraints

- Effect v4 against the installed `effect` (validate every API in
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
- Identity: one digest format (`sha256:<64 hex>`) with one brand per domain
  and a versioned domain tag in every preimage; canonical JSON (RFC 8785) sorts
  object keys only, so every set-valued field (`HashSet` targets, members,
  `supportAtCreation`) is sorted on the preimage before hashing and `L0-2`
  tests that two orderings of one set hash alike; the public authority is
  `https://beep-effect.com/ns/`; a changed preimage re-mints existing records
  by a migration in the same PR, never by a parallel encoding.
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
- External vocabularies (OA, PROV-O, NIF, DoCO, SKOS, gUFO, LKIF, ELI) enter
  as registry entries with source pin, license and digest, and as adapters;
  internal kinds stay repo-stable.
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
  public API or wire change ships with a major changeset;
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
   and the migration that re-mints existing records.
2. `Assessments<K>`: the caller-supplied coordinate-to-value-schema registry,
   partial versus total carriers, absent and unknown semantics, owner-defined
   gates, and the census of the seven status vocabularies (coordinate,
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
8. Where the runtime `IRI` schema lives: today only in
   `packages/foundation/modeling/rdf/src/Iri.ts`, while `identity` must stay
   rdf-free and `@beep/schema` depends on `identity`; P0 moves it (into
   `identity` or a dependency-free home) before L0 and L1 compile.
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
      contracts `prov:`, `oa:`, `nif:`, `xsd:` and `gufo:` CURIEs; one
      canonical JSON implementation; path-derived IRIs are gone and the
      test-runner's pinned IRIs are re-published from the registry; `L0-1` to
      `L0-3` are green.
- [ ] L1: `@beep/text` exists and `@beep/provenance` is retired with every
      consumer migrated; `Selector`, `OccurrenceId`, `QuoteKey`, `Resolution`,
      `Reanchoring` and unit conversion are exported from `@beep/text`; the
      `cm1:` preimage is the occurrence preimage and existing records are
      re-minted by the migration; the five non-canonical anchor encodings are
      deleted; `TextAnchor <-> oa:` round-trips in `@beep/rdf`; `L1-1` to
      `L1-6` are green, including the repeated-boilerplate, NFKC,
      de-hyphenation and split-surrogate fixtures.
- [ ] L2: `@beep/annotation` exists with `makeAnnotationDocument` (anchors
      table, content map, `Generation` attribution), `merge`, `restrict` and
      containment; the langextract handoff mints verified receipts and emits
      annotations with both digests, scope, extractor and normalization pins,
      producer, attributes and typed `RelationCandidate`/`CorefCandidate`
      records; the handoff's `Entity`, `Relation` and `Provenance` types are
      deleted; `IrToLaw` and the semantica projection read the annotation
      document; the OA/NIF adapter round-trips the declared profile and
      attributes unattributed input to the import activity; P3 creates
      `OfficeActionReview.flow.test.ts` in the law-practice use-cases tests
      over the annotation document on synthetic fixtures (P4 adds the signal
      assertions, P6 the law-owned structure, assessment profiles and
      admission); `L2-1` to `L2-6` are green.
- [ ] L4: `makeClaimCore`, `Stance`, `Challenge`, `Admission` and
      `Assessments<K>` exist; the `1` and `0.9` defaults are deleted and
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
      the status census names each of the seven vocabularies as coordinate,
      duplicate or projection; the absorbed attributed-span proof passes: two
      claims anchored on one verified occurrence pass through the claim gate with
      accepted and rejected evidence retained per claim, in
      `ClaimGate.two-claims-one-occurrence.test.ts` in the law-practice use-cases
      tests (the proof `goals/attributed-multi-claim-span` promised); `L4-1` to
      `L4-7` are green.
- [ ] L3 and L6: legal seeds and FOLIO DTOs are out of `@beep/ontology` with
      IRIs and approval metadata preserved and every consumer migrated;
      `fold -> Dataset` is the only serialization path; `Dataset` equality is a
      quotient with a canonical digest and the semantica gold fixture is
      regenerated; `Literal` has three cases; `rdf` no longer imports `md`;
      `MappingSet` has a coherence check; `SourceTextIdentity` projects to
      `prov:Entity` through `rdf/src/Prov.ts` with a round-trip test; the
      registry test asserts license and digest on every external namespace;
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
- [ ] Cut-over: `@beep/nlp` is retired and every `@beep/schema-org` facet is
      rehomed or deleted through the retirement procedure with consumers
      migrated in the same PR; `research/consumer-census.md` records each
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

Resolved under the breaking-changes ruling and the round-1 review of PR #2993, which found the open questions contradicting the fixed acceptance criteria (R10-03, SPEC thread on line 198). (1) Annotation home: @beep/annotation is created in P3 through bun run beep create-package, with the specific-home-first routing decision and the capability negative-gate clauses recorded in P0 (consumers: the langextract handoff, the semantica projection, the law-practice office-action flow); the L2 contract is not landed inside @beep/nlp first. (2) Status: Assessments<K> owner-declared coordinates are the foundation shape; P0 defines the caller-supplied value schemas per coordinate and the census of the seven vocabularies; ClaimLifecycle stays in shared/domain and its transitions stay in the epistemic slice. (3) External vocabularies (NIF, DoCO, gUFO, OA, PROV-O, SKOS) enter as registry entries and adapters; internal kinds stay repo-stable. (4) OccurrenceId is the one text identity: the cm1: preimage is re-expressed as an occurrence preimage (whole SourceTextIdentity, unit, range, quote) and existing cm1: records are re-minted by a migration in the P2 PR; citation-extraction-engine remains the owner of the citation identity module. (5) One packet; a phase splits into a child packet only when it needs more than three concurrent PRs, and a child requires only independently completed capabilities. Also resolved: @beep/provenance is renamed to @beep/text in P2 (it is text identity and anchoring, not PROV), via create-package plus retirement of the old name with the consumer migration in the same PR; @beep/nlp-processing already exists and absorbs nlp/Operations and nlp/Algebra in P6 instead of being created.

Lane goals/text-knowledge-stack-rebuild · PR #2993

Reverse: Any single resolution is reversed by a decision file recorded in P0 before the phase that depends on it (P2 for the text package and cm1, P3 for the annotation package, P4 for Assessments); the SPEC acceptance row for that item is edited in the same change.

### Paused by operator ruling (finish board, 2026-11-13): Very large ten-phase program with no implementation started; set to paused until resourced rather than leaving active, 2026-11-13

Operator ruling on 2026-11-13 (about 05:20Z, in the orchestrator session, from the Goal Finish Board triage). The ruling sets this packet to `paused`.

Triage rationale: Very large ten-phase program with no implementation started; set to paused until resourced rather than leaving active.

No lane is working on it. Resume with `bun run beep goals set-status text-knowledge-stack-rebuild active` when it is picked up.

Lane chore/finish-board-pause-b2

Reverse: goals set-status text-knowledge-stack-rebuild active when it is picked up

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
