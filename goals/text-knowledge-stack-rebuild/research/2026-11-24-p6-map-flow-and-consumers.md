# P6 map: the office-action flow end to end, P6 consumers, stored formats and moving gates

Read-only measurement at f8cbd3c9f69 (`git rev-parse --short HEAD` in the tksr-p6 lane, the P5 tip). Source formats and committed synthetic fixtures only; no corpus, client document or private live data was read. The public USPTO-style structure fixtures (`oa-001.txt` to `oa-034.txt`) were counted, not quoted.

Counting rules. "Outside" means outside the owning package. File lists come from `rg` over the tree minus `goals/`, `.repos/`, `explorations/` and `CHANGELOG.md`; `scratchpad/` is listed where it matters. Kinds: `import` (a `src` module), `test` (a `test/` path), `jsdoc` (an `**Example**` line inside a doc comment), `indirect` (a path alias, a package-name string, a generated table). Effect citations are to `.repos/effect/packages/effect/src` at 4.1.5, the installed version (`node_modules/effect/package.json`).

Sources read: PLAN P6 row (`PLAN.md:30`), SPEC Target Surfaces (`SPEC.md:180-244`), Constraints (`:246-321`), Resolved item 11 (`:371-373`), Acceptance "L2" (the P6 tail of the flow test, `:409-421`) and "L5 and L7" (`:458-471`), Verification Matrix (`:488-509`), law-test-plan rows L5-1 to L5-3 (`research/law-test-plan.md:33-35`), consumer-census `@beep/nlp` rows (`research/consumer-census.md:142-198`) and the matter-wall map (`:583-626`), the sketch `ops/design/L5.operations.ts`, chapter 16 sections L5, 11 and 12 (`standards/architecture/16-knowledge-stack.md:382-408,706-742`), the rebuild report L5 and L7 (`research/2026-11-08-rebuild-report.md:282-306`), reader C (`research/2026-11-08-reader-c-agent-surfaces.md:19,135`), and the decisions that name P6: `2026-11-19-p0-routing-annotation-asset-pack-and-write-tool-host`, `2026-11-19-p0-item11-matter-wall-test-shape`, `2026-11-19-p0-census-dispositions`, `2026-11-19-p0-activity-id-minted-at-start`, `2026-11-22-p3-flow-test-shape`, `2026-11-22-p3-graph-span-becomes-an-optional-position`, `2026-11-23-p4-admission-refusals-and-current-grounding`, `2026-11-23-p4-l4-exits-recorded`.

## 1. The office-action flow as it stands

### 1.1 What the flow test composes and asserts

`packages/law-practice/use-cases/test/OfficeActionReview.flow.test.ts` (193 lines) follows decision `p3-flow-test-shape` exactly:

| Step | Real or stubbed | Evidence |
| --- | --- | --- |
| File processing | real `makeFileProcessingServiceLayer` over `TestFileProcessingEngine`, with `engineVersion` forced to `"1"` | flow test `:58-66` |
| Language model | stub `LanguageModel.make` returning the fixture JSON, wrapped in `Model.make("test", "office-action-stub", ...)` | `:42-56` |
| LangExtract | real `layer` from `@beep/langextract/Service` under `allowRemoteExtractionPolicyLayer` | `:57` |
| Digest | `Digest.layerWebCrypto` | `:67` |
| Capture | built by the use case from the artifact and the processed text (`SourceTextIdentity`, `normalizationVersion: "raw/1"`, `scopeRef = matterFixtureKey`) | `OfficeActionReview.service.ts:149-173` |
| Handoff | real; captured by a `tap` around `langExtract.extract` | flow test `:94,108-116,120` |
| IrToLaw | real `makeIrToLaw()`; five law entities from spike envelopes | `IrToLaw.service.ts:122-155,181` |
| Claim gate | `makeClaimGate` over a conforming stub `ShaclValidationService` (legacy `@beep/epistemic-use-cases`) | flow test `:95-105` |
| Lifecycle | `makeClaimTransition()` (legacy), `candidate -> shape_valid` | `OfficeActionReview.service.ts:254-266` |
| Projection | `projectClaims([advanced])` (legacy `ClaimProjectionView`) | `OfficeActionReview.service.ts:265` |

Assertions (five tests in three layers): the loop ends at `shape_valid` with five law entities (`:127-133`); the handoff survives encode then checked decode, every receipt names the capture, `scopeRef` and `sourceRef` match the input, the distinction anchor re-slices the text (`:135-149`); candidate indices 0 to 3 are lossless across readings and residual (`:151-167`); a missing label fails `required-extraction-missing` (`:170-178`); an unaligned label fails `required-extraction-unaligned` with alignment status `unaligned` (`:180-191`). P4's sibling `OfficeActionReview.signals.test.ts` adds `L4-7` (absent confidence survives, `:118-129`).

### 1.2 What "complete end to end on synthetic fixtures" still lacks

SPEC assigns P6 "the law-owned structure, assessment profiles and admission" (`SPEC.md:418-420`) and repeats it in the L5 and L7 row ("law-owned claim structure, assessment profiles, attorney admission", `:465-466`). Measured gaps:

| Gap | Measured state | Evidence |
| --- | --- | --- |
| Law-owned claim structure | none. The review still decodes a legacy `CandidateClaim` and `Evidence` from `@beep/epistemic-domain` with spike envelopes (`spikeEntityInput("EpistemicCandidateClaim", seed * 10)`), keyed by fixture keys, with the distinction quote as a free-text `snapshot`. No law-practice file calls `makeClaimCore`, `makeClaimRecords`, `makeAssessments` or `makeAdmissionArrows` (0 files under `packages/law-practice`) | `OfficeActionReview.service.ts:17,90-113`; `internal/spikeEntity.ts:60`; `internal/claimEvidence.ts:274,281` (a second site, ClaimSelfCheck) |
| Claim id, activity and support | absent. `ClaimId`, `generatedBy: ActivityId`, `supportAtCreation: CanonicalHashSet(OccurrenceId)` and `scope` exist only in `@beep/epistemics/ClaimCore.schema` (`:159-170`); the handoff already carries an `ActivityStart` (`langextract/src/Handoff/Handoff.model.ts:10`) and verified anchors whose occurrence ids could be the support set | |
| Assessment profile | none for law-practice; party is the only owner with a profile (`party/domain/test/Assessments.party.laws.test.ts:1`) | `rg makeAssessments packages/law-practice` = 0 |
| Attorney admission | none. `Admission`, `AdmissionPorts.verifyToken`, `TrustedClaimBinding` and `AdmissionRefused` are in `@beep/epistemics/Admission` (`:101,187,280,302`); no law-practice port supplies a principal, a token verifier or current-text resolution under scope | decision `p4-admission-refusals-and-current-grounding` |
| Proposed stance | `Stance = verbatim | proposed | admitted` and `ProposedClaimRecord` exist (`ClaimCore.schema.ts:64,267-284`); the flow ends at the legacy `shape_valid` lifecycle, not at a proposed record | |
| Write tool | none; no law-practice tool writes a claim or annotation (section 4) | |
| Matter scope | the capture's `scopeRef` is the free string `"matter.flow"` (`flow test :75`); nothing authorizes it | section 5 |
| Second matter | the flow fixture has one text and one matter; the two-matter fixture belongs to the server test (section 5) | `fixtures/office-action-review/fixture.ts:1-8` |

The legacy chain (`@beep/epistemic-domain` `CandidateClaim`/`Evidence`, `@beep/epistemic-use-cases` `ClaimGate`/`ClaimLifecycle`/`ClaimProjection`) is still the server wiring: `LawPracticeServerLive` provides `ClaimGate` and `ClaimTransition` through `EpistemicServerLive`, which is in-memory (`server/src/Layer.ts:19-20,81-95`; `epistemic/server/src/Layer.ts:85-95`). Replacing it in the flow therefore moves `OfficeActionReviewDeps` (`OfficeActionReview.service.ts:195-204`), `OfficeActionReviewShape` and the `ClaimProjectionView` return type (`OfficeActionReview.ports.ts:23,219`), the server layer and `LawPracticeServer.test.ts`.

### 1.3 Synthetic fixtures

| Fixture | Content | Consumers |
| --- | --- | --- |
| `use-cases/test/fixtures/office-action-review/fixture.ts` | one 4-line synthetic text and three model outputs (full, missing distinction, unaligned distinction) | flow test `:35`, signals test `:29` |
| `use-cases/test/fixtures/office-action-structure/` | 34 `oa-NNN.txt` texts, `labels.jsonl` and `labels-a.jsonl` (34 rows each), `integrity.jsonl` and `shadow.jsonl` (4 each), `Fixture.schema.ts`, `texts.ts` | `use-cases/test/officeActionFixtures.ts:1-14`, `OfficeActionFixtures.test.ts`, `OfficeActionStructure*.test.ts`; server `officeActionFixtures.ts:2` re-exports `oa-001.txt` |
| `server/test/fixtures/ir-to-law-entities-v1.json` | frozen `LawEntities` bytes | `LawPracticeServer.test.ts:167` ("IrToLaw keeps the bytes of the frozen v1 law entities") |
| `server/test/fixtures/office-action-attempts-v1.jsonl`, `-v2.jsonl` | frozen attempt-log rows | `server/test/OfficeActionStructure.test.ts:38,299-463` |

The flow fixture has no second matter, no attorney principal, no token and no assessment values. Completing the flow needs those as synthetic test data; none exists.

### 1.4 The office-action standing list (Verification Matrix, `SPEC.md:503`)

| File | Exists at f8cbd3c9f69 |
| --- | --- |
| `use-cases/test/OfficeActionReview.flow.test.ts` | yes (P3; complete at P6) |
| `server/test/LawPracticeServer.test.ts` | yes; four `it.layer` blocks (`:125,202,232,241`) |
| `server/test/OfficeActionStructure.test.ts` | yes |
| `use-cases/test/OfficeActionStructure.test.ts` | yes (plus `OfficeActionStructure.read.test.ts`) |
| `use-cases/test/OfficeActionFixtures.test.ts` | yes |

Each must stay green at the P6 exit; any change to `LawEntities` or the review return type reaches the frozen v1 fixture and the server test.

## 2. What P6 moves out of `@beep/nlp`: export inventory and consumers

P0's dispositions (decision `p0-census-dispositions`; census rows `consumer-census.md:163-172`) give P6 four facets, not two: Operations adapt into `@beep/nlp-processing` merged with its own operation modules; Algebra retires except a census-uncovered instance a P6 consumer uses; GraphOps retires; Core and the Graph node schemas move to `@beep/nlp-processing` (decision `p3-graph-span-becomes-an-optional-position` re-routed the node schemas "with Core in P6"); `CharPosition` is deleted for the text position. The four text helpers retire in P7. PLAN's P6 row names only Operations and Algebra (F1).

### 2.1 `@beep/nlp/Operations` (794 lines, 3 files) and `@beep/nlp/Algebra` (1,792 lines, 3 files)

| File | Line | Symbol | Kind |
| --- | --- | --- | --- |
| `nlp/src/Operations/Composable.ts` | 55 | `NLPOperation` | type |
| | 81 | `OperationBuilder` | class |
| | 282 | `makeOperation` | function |
| | 327 | `fromDefinition` | function |
| | 355 | `makePureOperation` | function |
| | 396, 438, 481, 528, 560, 582, 628 | `map`, `product`, `zipWith`, `compose`, `identity`, `traverse`, `aggregate` | function |
| | 609 | `Aggregated` | type |
| `nlp/src/Operations/Definition.ts` | 51, 84, 111 | `OperationDefinition`, `OperationInput`, `OperationOutput` | type |
| `nlp/src/Operations/index.ts` | 32, 47 | `Composable`, `Definition` (type-only) | barrel |
| `nlp/src/Algebra/Monoid.ts` | 43-859 | `Monoid`, `make`, `fold`, `combineAll`, `StringConcat`, `StringJoin`, `StringDelimited`, `NumberSum`, `NumberProduct`, `NumberMax`, `NumberMin`, `ArrayConcat`, `MultiSet`, `SetUnion`, `SetIntersection`, `VectorAdd`, `VectorAverage`, `getAverage`, `Product`, `Product3`, `Option`, `Endo`, `Dual`, `BooleanAll`, `BooleanAny`, `checkLeftIdentity`, `checkRightIdentity`, `checkAssociativity`, `checkLaws` | 29 exports |
| `nlp/src/Algebra/NLPMonoid.ts` | 106-872 | `BagOfWords`, `TokenConcat`, `TokenBagOfWords`, `TokenSetUnion`, `SentenceConcat`, `SentenceArray`, `DocumentText`, `DocumentStatistics`, `DocumentStats`, `AnnotationMap`, `NamedEntity`, `NamedEntityList`, `DependencyEdge`, `DependencyParse`, `TermFrequency`, `DocumentFrequency`, `Vocabulary`, `WeightedTokens`, `NGramFrequency`, `TextAnalysis`, `TextAnalysisMonoid`, `bagOfWordsToTF`, `computeTFIDF`, `aggregateTokens`, `aggregateSentences`, `aggregateStats` | 26 exports |
| `nlp/src/Algebra/index.ts` | 22, 37 | `Monoid`, `NLPMonoid` | barrel |

Consumers outside `@beep/nlp`: **0 import sites** for either subpath. The only references are the generated path aliases (`tsconfig.json:801,807,1349,1354`; `vitest.aliases.generated.json:708,712,1216,1219`), the coverage baseline rows (`standards/coverage.regression-baseline.jsonc:28898,28910,28922,29102,29114,29126`; Monoid 62.06 lines, NLPMonoid 93.84, Composable 97.43, the rest 100), the five NLPMonoid schema-catalog rows (`standards/schema-catalog/@beep/nlp.generated.jsonc:7-11`) and the chapter prose (`16-knowledge-stack.md:385`). In-package tests: `nlp/test/Operations/Composable.test.ts`, `nlp/test/Algebra/Monoid.test.ts`, `nlp/test/Algebra/NLPMonoid.test.ts`.

Upstream census re-measured against the 4.1.5 source: `Combiner.ts` exports `make`, `flip`, `min`, `max`, `first`, `last`, `constant`, `intercalate` (`:82-310`); `Reducer.ts` exports `make`, `flip` (`:120,173`); module instances: `Number.ReducerSum/Multiply/Max/Min` (`Number.ts:805-886`), `String.ReducerConcat` (`String.ts:1603`), `Boolean.ReducerAnd/Or` (`Boolean.ts:458,479`), `Array.makeReducerConcat` (`Array.ts:5127`), `Option.makeReducer` and fail-fast variants (`Option.ts:2473-2551`), `Struct.makeReducer` (`Struct.ts:1026`), `Tuple.makeReducer` (`Tuple.ts:736`), `Record.makeReducerUnion`/`makeReducerIntersection` (`Record.ts:1524,1553`), `Order.makeReducer`, `Equivalence.makeReducer`, `UndefinedOr.makeReducer`. `HashSet.ts` and `HashMap.ts` have no reducer (0 matches in `node_modules/effect/dist/HashSet.d.ts` and `HashMap.d.ts`). Uncovered therefore: `SetUnion`, `SetIntersection`, `MultiSet`, `VectorAdd`, `VectorAverage`, `StringDelimited`, `Endo`, `Product3`, the `check*` helpers and every NLPMonoid instance. None has a consumer, so under rule 2 none survives unless a P6 consumer needs it (F2).

### 2.2 Operation models already in `@beep/nlp-processing` (the three-way merge)

| File | Line | Symbol | Consumers outside its own test |
| --- | --- | --- | --- |
| `nlp-processing/src/Graph/TypeClass.ts` (1,031 lines; coverage 77.64) | 62, 83, 115, 150, 173, 203, 307, 351, 392-1024 | `TextOperation`, `makeOperation`, `pureOperation`, `Composable`, `identityOperation`, `composeOperations`, `executeOperation`, `executeOperations`, `FreeOperation`, `ForgetfulOperation`, `makeAdjunction`, functor/applicative/monad helpers | 0 (only `test/Graph/TypeClass.test.ts:12`) |
| `nlp-processing/src/Graph/GraphOperations/Operation.ts` (356; coverage 91.3) | 61, 105, 148, 187, 225, 257, 293, 316, 334, 356 | `GraphOperation`, `make`, `pure`, `transform`, `expand`, `filter`, `identity`, `map`, `flatMap`, `getCategory` | `test/Graph/GraphOperations.test.ts:2`; wink `test/Graph/GraphOperationsCatalog.test.ts:12` (`Catalog`, which uses `makeNode`) |
| `nlp-processing/src/Graph/EffectGraph.ts` (797; coverage 86.11) | 65-771 | `NodeId`, `generateNodeId`, `NodeNotFoundError`, `NodeMetadata`, `GraphNode`, `GraphEdge`, `EffectGraph`, `makeNode`, `singleton`, `cata`, `ana`, `map`, ... | `GraphOperations/{Types,ResultStore,Operation,Executor,Errors,Catalog}.ts`; tests `TaggedError.equivalence.test.ts:3`, `TypeClass.test.ts:11`, `GraphOperations.test.ts:1`, `EffectGraph.test.ts:1`; wink `GraphOperationsCatalog.test.ts:11` |
| `nlp/src/Graph/GraphOps.ts` (1,184; coverage 89.74) | whole file | retire (duplicate over `effect/Graph`) | 0; its one span `mapNodesEffect` is the only row of `standards/instrumentation-catalog/@beep/nlp.generated.jsonc:9` |

`THEORY.md:70,172` cite `src/Graph/TypeClass.ts`; the chapter (`16-knowledge-stack.md:388`) says the duplicates "merge into one (Pending P6)".

### 2.3 `@beep/nlp/Core` and `@beep/nlp/Graph/Schema` import sites outside `@beep/nlp`

46 import statements of `@beep/nlp/*` in 27 files (19 src, 7 test, 1 scratchpad) plus 25 jsdoc lines; every one is Core or Graph/Schema.

| File | Line | Symbol(s) | Kind |
| --- | --- | --- | --- |
| `apps/labs/semantica/src/layers/ExtractorLive.ts` | 60 | `EntityNode` (type) from `Graph/Schema` | import |
| `apps/labs/semantica/test/Extractor.signals.test.ts` | 9 | `EntityNode` | test |
| `apps/labs/semantica/test/Extractor.test.ts` | 42 | `EntityNode` | test |
| `packages/drivers/wink/src/internal/bm25.ts` | 3, 4 | `Token` (type), `BM25Norm` (type) | import |
| `packages/drivers/wink/src/WinkBackend.service.ts` | 27 | `* as Schema` from `Graph/Schema` | import |
| `packages/drivers/wink/src/WinkCorpus.service.ts` | 9, 10 | `Document`, `DocumentId`; `BM25Config`, `BM25Norm`, `DefaultBM25Config`, `DocumentVector`, `PositiveNumber` | import |
| `packages/drivers/wink/src/Wink.models.ts` | 9, 19 | `MarkRange`; `Pattern`, `PatternElement` (type) | import |
| `packages/drivers/wink/src/WinkSimilarity.service.ts` | 10, 22, 23; jsdoc 279-280, 313-314 | `SimilarityScore`; `DocumentTermSet`, `TverskyParams`; `BagOfWords`, `DocumentVector` | import, jsdoc |
| `packages/drivers/wink/src/WinkTokenization.service.ts` | 9, 10, 11; jsdoc 50; uses 165, 174 | `Document`, `DocumentId`; `Sentence`, `SentenceIndex`; `CharPosition`, `Token`, `TokenIndex` | import, jsdoc |
| `packages/drivers/wink/src/WinkTools.service.ts` | 9, 10, 11, 12, 40, 41 | `BracketStringToPatternElement` (from `Core`); `DocumentId`; `DocumentTermSet`, `TverskyParams`; `BagOfWords`; `Token`; `BM25Norm` | import |
| `packages/drivers/wink/src/WinkVectorizer.service.ts` | 9, 28, 29 | `BagOfWords`, `DefaultBM25Config`, `DocumentVector`, `TermFrequency`; `Document`, `DocumentId`; `BM25Config` | import |
| `packages/drivers/wink/test/Graph/TextGraph.test.ts` | 9 | `TextNode` | test |
| `packages/drivers/wink/test/ToolValidation.test.ts` | 1 | `SentenceIndex` | test |
| `packages/foundation/capability/nlp-processing/src/Backend/NLPBackend.ts` | 30 | `type * as GraphSchema` | import |
| `.../nlp-processing/src/Core/Tokenization.ts` | 13, 14, 15; jsdoc 82, 121, 160, 205 | `Document`, `DocumentId`; `Sentence`; `Token` | import, jsdoc |
| `.../nlp-processing/src/Graph/AnnotatedTextGraph.ts` | 30-38; jsdoc 61, 88, 114, 134, 154, 181, 199, 224 | `DependencyNode`, `EntityNode`, `LemmaNode`, `POSNode`, `RelationNode`, `TextEdge`, `TextNode` | import, jsdoc |
| `.../nlp-processing/src/Graph/GraphOperations/Catalog.ts` | 35 | `DependencyNode`, `EntityNode`, `LemmaNode`, `POSNode`, `RelationNode` (type) | import |
| `.../nlp-processing/src/Graph/TextGraph.ts` | 24; jsdoc 179-181, 275, 351-352, 360-361 | `TextEdge`, `TextNode`; jsdoc `Document`, `Sentence`, `TokenIndex`, `CharPosition`, `Token` | import, jsdoc |
| `.../nlp-processing/src/NLPService.ts` | 26 | `EntityNode`, `POSNode`, `RelationNode` (type) | import |
| `.../nlp-processing/src/Tools/BowCosineSimilarity.ts` | 9 | `SimilarityMethod` | import |
| `.../nlp-processing/src/Tools/CreateCorpus.ts` | 9 | `BM25Norm`, `PositiveNumber` | import |
| `.../nlp-processing/src/Tools/LearnCustomEntities.ts` | 9 | `MarkRange` | import |
| `.../nlp-processing/src/Tools/_schemas.ts` | 9 | `BM25Norm` | import |
| `.../nlp-processing/src/Tools/TextSimilarity.ts` | 9 | `SimilarityMethod` | import |
| `.../nlp-processing/src/Tools/TverskySimilarity.ts` | 9 | `SimilarityMethod` | import |
| `.../nlp-processing/test/Graph/AnnotatedTextGraph.test.ts` | 1 | `EntityNode`, `LemmaNode`, `POSNode` | test |
| `.../nlp-processing/test/NLPService.test.ts` | 1, 28, 29 | `Document`, `DocumentId`; `Sentence`; `Token` | test |
| `packages/law-practice/use-cases/test/ClaimInspection.lexical.test.ts` | 13; uses 51-52 | `CharPosition`, `Token`, `TokenIndex` | test |
| `scratchpad/effect-ontology/Service/Nlp.ts` | 15, 16 | `BM25Config` (type), `DefaultBM25Config` | import (scratchpad) |

`CharPosition` (deleted for the text position): 6 code lines in 2 files (`WinkTokenization.service.ts:11,165,174`; `ClaimInspection.lexical.test.ts:13,51,52`) plus 3 jsdoc lines (`TextGraph.ts:352,360,361`). It is a field type of `Token`, so its deletion changes `Token`'s schema, not only the import.

Package manifests that depend on `@beep/nlp` (`"@beep/nlp": "workspace:^"`): `nlp-processing/package.json:83`, `drivers/wink/package.json:66`, `law-practice/use-cases/package.json:82`, `law-practice/server/package.json:109` (no import site: an unused edge), `apps/labs/semantica/package.json:47`, `scratchpad/package.json:34`. langextract and lejeune-bolt-workbench no longer depend on it (census `:187-191` was at the P0 base).

Non-import references to the package name: `identity/src/packages.ts:804` (`$NlpId`), `identity/test/shape-stable.test.ts`, `cli/src/commands/Ci/CiLanePartitions.ts:412,827`, `cli/src/commands/Quality/internal/CoverageScope.ts:394`, `cli/test/quality-tasks.test.ts`, `standards/cache-baseline/@beep/nlp.json`, the two generated catalogs, `fallow.boundaries.*`, `tsconfig.json`, `vitest.aliases.generated.json`. Every `@beep/nlp` schema identity is minted from `$NlpId` (`nlp/src/{Algebra/NLPMonoid,Core/*,Graph/*,internal/numbers}.ts`); a schema moved into nlp-processing is re-annotated under `$NlpProcessingId` (`packages.ts:820`), so its identifier string changes (the P2 precedent is decision `p2-schema-identifiers-follow-the-package`).

## 3. `@beep/nlp-processing` exports and their consumers

Package: 50 src files (12,997 lines), 10 test files; exports `.`, `./Backend[/*]`, `./Core[/*]`, `./Graph[/*]`, `./Graph/GraphOperations[/*]`, `./NLPService`, `./Tools[/*]` (`nlp-processing/package.json` exports). Dependencies: `@beep/identity`, `@beep/nlp`, `@beep/observability`, `@beep/schema`, `@beep/utils`, `effect`. It does not depend on `@beep/jsonc` (which owns `ActivityStart`, `mintActivityId`), `@beep/text`, `@beep/annotation` or `@beep/epistemics`; the sketch's `withActivity` needs at least `@beep/jsonc` and `@beep/schema/ContentHash`/`CanonicalHashSet` (`ops/design/L5.operations.ts:13-15`). Chapter 16 already allows `nlp-processing -> annotation, epistemics, ontology, text, L0` (`:462-463`).

Import sites outside the package (25 files, plus the indirect references in the last row):

| File | Line | Symbol | Kind |
| --- | --- | --- | --- |
| `apps/labs/semantica/src/layers/CanaryC0Live.ts` | 1 | `* as NLPService` | import |
| `apps/labs/semantica/src/layers/ExtractorLive.ts` | 16 | `NLPService` | import |
| `apps/labs/semantica/test/Extractor.signals.test.ts` | 10 | `NLPService` | test |
| `apps/labs/semantica/test/Extractor.test.ts` | 43, 44 | `notSupported` (`Backend/NLPBackend`), `NLPService` | test |
| `packages/drivers/nlp-mcp/src/Server.ts` | 25 | `NlpToolkit` | import |
| `packages/drivers/nlp-mcp/src/StreamingHandlers.ts` | 21 | `AiToolError` | import |
| `packages/drivers/nlp-mcp/src/StreamingTools.ts` | 19 | `AiToolError` | import |
| `packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts` | 12 | `NlpToolkit` | test |
| `packages/drivers/nlp-mcp/test/Server.test.ts` | 2 | `NlpToolkit`, `NlpTools` | test |
| `packages/drivers/wink/src/WinkBackend.service.ts` | 28; jsdoc 159 | `BackendCapabilities`, `NLPBackend`, `notSupported`, `operationError` | import |
| `packages/drivers/wink/src/Wink.layer.ts` | jsdoc 26, 207 | `Tokenization` | jsdoc |
| `packages/drivers/wink/src/WinkObservability.ts` | 9 | `AiToolError` | import |
| `packages/drivers/wink/src/WinkTokenization.service.ts` | 12; jsdoc 366, 392 | `Tokenization`, `TokenizationError` | import |
| `packages/drivers/wink/src/WinkTools.service.ts` | 13, 14, 42; jsdoc 370 | `Tokenization`, `NlpToolkit`, `AiToolError` (type) | import |
| `packages/drivers/wink/test/Backend/WinkBackend.test.ts` | 9 | `* as Backend` | test |
| `packages/drivers/wink/test/Graph/GraphOperationsCatalog.test.ts` | 11, 12 | `* as EG` (`EffectGraph`), `Catalog` | test |
| `packages/drivers/wink/test/Graph/TextGraph.test.ts` | 10 | `* as TG` | test |
| `packages/drivers/wink/test/Layers.test.ts` | 1 | `tokenCount` | test |
| `packages/drivers/wink/test/NLPService.test.ts` | 8, 9 | `* as Graph` (`AnnotatedTextGraph`), `* as NLPService` | test |
| `packages/drivers/wink/test/ParityTools.test.ts` | 1 | `NlpToolkit` | test |
| `packages/drivers/wink/test/ToolValidation.test.ts` | 2-8 | seven `Tools/*` tools | test |
| `packages/drivers/wink/test/WinkTokenization.test.ts` | 1 | `sentences`, `tokenCount`, `tokenize`, `tokenizeToDocument` | test |
| `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.lexical.ts` | 21 | `Tokenization`, `TokenizationError` | import |
| `packages/law-practice/use-cases/test/ClaimInspection.lexical.test.ts` | 14 | `Tokenization`, `TokenizationError` | test |
| `scratchpad/effect-ontology/Service/Nlp.ts` | 17 | `Tokenization` | import (scratchpad) |
| `identity/src/packages.ts:820`, `identity/test/shape-stable.test.ts:162`, `CiLanePartitions.ts:333,683`, `CoverageScope.ts:396`, `cli/test/quality-tasks.test.ts:9344` | | package name | indirect |

Package manifests that depend on it: `drivers/wink/package.json:67`, `drivers/nlp-mcp/package.json:69`, `law-practice/use-cases/package.json:83`, `apps/labs/semantica/package.json:48`, `scratchpad/package.json:35`.

No consumer outside the package imports `Graph/TypeClass` or `Graph/GraphOperations/Operation`; wink imports `Graph/GraphOperations` only for `Catalog`. A merge that keeps `Core/Tokenization`, `Backend/*`, `NLPService`, `Tools/*`, `Graph/{AnnotatedTextGraph,TextGraph,EffectGraph}` and the `Catalog` stable reaches no outside consumer except through the moved Core and Graph Schema types.

## 4. MCP tool modules (L7)

### 4.1 Tool definitions and their write hints

| Module | Tools | Hints | Writes |
| --- | --- | --- | --- |
| `law-practice/use-cases/src/Tools.ts:38-52` (`PracticeKgToolkit`, 13 tools) | `kg_clients`, `kg_docket_family`, `kg_application_lookup`, `kg_find`, `corpus_search_text`, `corpus_get_document`, `email_search`, `kg_candidate_claims`, `claim_self_check`, `claim_inspect_input`, `kg_provenance`, `kg_matter_lookup`, `kg_correspondent_lookup` | all `readTool` (`PracticeKg.tools.ts:1174-1187`: `readOnly: true`, `destructive: false`) or `readOnly: true` four-hint annotations (`ClaimInspection.tools.ts:48`, `ClaimSelfCheck.tools.ts:134`) | none |
| `law-practice/use-cases/src/ReviewHub/ReviewHub.tools.ts:152` (`ReviewHubToolkit`) | `review_open_items` (read), `review_record_verdict`, `review_lock_batch`, `review_record_answer` | `appendHints` (`:20-25`: `readOnly: false`, `idempotent: false`, `destructive: false`) | appends verdict, lock and answer rows; no claim or annotation |
| `nlp-processing/src/Tools/*.ts` (`NlpToolkit.ts`, 25 tool files) | includes stateful `CreateCorpus`, `DeleteCorpus` (`:63`), `LearnCorpus` (`:86`), `LearnCustomEntities` | no four-hint annotations on these tools | in-memory corpus state only |
| `drivers/nlp-mcp/src/StreamingTools.ts`, `Server.ts` | streaming tools over `NlpToolkit` | | none persistent |
| `ontology/use-cases/src/tools/OntologyToolkit.ts`, `ontology/server/src/tools/OntologyToolHandlers.ts` | ontology session and publish tools, under `TierGate` | | ontology workspace files, not claims |
| `drivers/{gov-legal,m365,uspto}-mcp`, `apps/practice-gateway/src/{BoxDriveTools,SetupTools}.ts`, `cli/src/commands/Palantiri/Palantiri.tools.ts` | vendor tools | | outbox and setup writes; none writes a claim or annotation |

Re-measured: no MCP tool writes a claim or an annotation (the P0 routing finding holds). The first claim-writing tool is to be defined in `packages/law-practice/use-cases` beside ReviewHub and the claim tools, its success schema a proposed-only record schema exported by `@beep/epistemics`, and its test in the law-practice use-cases tests (decision `p0-routing-annotation-asset-pack-and-write-tool-host`; chapter 16 `:729-733`). `@beep/epistemics` exports the generic factory, not a fixed schema: `makeClaimRecords({ $I, core })` returns `{ ClaimRecord, ProposedClaimRecord }` (`ClaimCore.schema.ts:267-284`), and `makeClaimCore` returns a `ProposedClaimRecord` bound to the owner's core (`:178`). A law-practice owner must first exist (section 1.2) for the tool's success schema to name.

### 4.2 Consumers that pin a toolkit's shape

| File | Line | What it pins |
| --- | --- | --- |
| `law-practice/use-cases/test/SchemaParity.test.ts` | 144 | `PracticeKgToolkit` has 13 tools |
| `law-practice/use-cases/test/ClaimInspection.test.ts` | 379-384 | tool name, success schema and four hints |
| `apps/practice-kg-mcp/test/StrictTier.toolkit.test.ts` | 29 | `PracticeKgToolId` literals equal the toolkit keys |
| `apps/practice-kg-mcp/test/Host.test.ts` | 198, 578-580 | tool count; `kg_provenance` calls |
| `apps/practice-kg-mcp/src/package.ts` | 26-31, 87 | manifest descriptions keyed by toolkit names |
| `apps/practice-kg-mcp/src/smoke.ts` | 30 | expected tools |
| `apps/practice-gateway/src/package.ts` | 10, 37 | `R.values(PracticeKgToolkit.tools)` |
| `apps/practice-review-hub/src/runtime/Layer.ts` | 11, 69, 80 | `ReviewHubToolkit.toLayer`, `sanitizedToolkit(ReviewHubToolkit)` |
| `apps/practice-claude-mod/src/PracticeMod.values.ts` | 41 | tool-name list including `kg_provenance` |
| `apps/practice-claude-mod/src/PracticeMod.phrases.ts` | 104 | per-tool phrases |
| `drivers/nlp-mcp/test/Server.test.ts` | 2 | `NlpToolkit`, `NlpTools` |

Adding the write tool to `PracticeKgToolkit` moves every row above except the review-hub and nlp ones; adding it to `ReviewHubToolkit` or a new toolkit moves only that toolkit's host (F7).

`@beep/mcp-kit` derives tool JSON Schema through `S.toJsonSchemaDocument` (`mcp-kit/src/SanitizedSpan.ts:302`); `TierGate` (`mcp-kit/src/TierGate.ts`) stays the dispatch gate. "Prompts render from schema annotations" has one known half-hand-written site, `langextract/src/Service/Service.prompt.ts` (rebuild report `:300`).

## 5. Matter wall: the seven paths re-measured at the P5 tip

No `MatterAuthority`, `MatterWall` or `matterWall` symbol exists in any package (`rg` hits only docs and explorations). Scope-check counts (`rg -c "scopeRef|orgId|matterId|tenant|authoriz"`):

| Path | Owning code | Count | Change since the P0 map |
| --- | --- | --- | --- |
| Source retrieval | `workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts:152,207` (scope names a workspace); law-practice callers `server/src/internal/Citation/SourceEvidence.ts` (0), `use-cases/src/CandorPolicy/CandorPolicy.service.ts:136` | 3 / 0 | none |
| Anchor resolution | `text/src/VerifiedTextAnchor.ts:594` (`expectedSource.scopeRef` equals `source.scopeRef`, both caller-supplied); `server/src/internal/Citation/SourceResolution.ts` (0) | 11 / 0 | the check moved from `provenance/` to `@beep/text` in P2 |
| Graph query | `server/src/PracticeKg.queries.ts` (0), `PracticeKg.tool-handlers.ts` (0, 656 lines); epistemic `ContradictionTriage.layer.ts:109-153` (`sourceScopeRef`, `orgId`) | 0 / 0 / 7 | none |
| Search and vector | `server/src/PracticeKg.fts.ts` (0); no vector index in law-practice | 0 | none |
| Cache lookup | `server/src/internal/Citation/Resolve.ts` (0), `SessionDocument.ts` (0) | 0 | none |
| Draft assembly | `server/src/NoticeMailbox/NoticeMailbox.layer.ts:303` (`createDraftMessage`), 0 scope matches | 0 | none |
| Provenance traversal | no service over annotation attribution or admissions. Correction to the P0 map: a provenance read already exists, `kg_provenance` (`use-cases/src/PracticeKg.tools.ts:1410`; handler `server/src/PracticeKg.tool-handlers.ts:602-651`), which resolves a graph node or document to its catalog row, unscoped; `rdf/src/ProvRdf.ts` 0 | 0 | `kg_provenance` is the nearest owning code |

Layer reach: `LawPracticeServerLive` still composes only `OfficeActionReview`, `IrToLaw`, file processing, guarded LangExtract and `EpistemicServerLive` (`server/src/Layer.ts:81-95`). The test layers the two-matter fixture must widen to: `server/test/PracticeKgHost.test.ts` (Practice KG), `PracticeKg.projections.test.ts` (`buildDuckDb`, the FTS index), `CitationEngineLayer.test.ts` (caches), `NoticeMailbox.test.ts:62` (fake mailbox), `CandorRecord.pglite.test.ts` and `LegalPositionRecord.pglite.test.ts` (PGlite repositories). Org-scoped repositories that already isolate tenants: `CandorRecord.repo.ts`, `LegalPositionRecord.repo.ts`; `OfficeActionStructure.repo.ts:32,108` uses `scopeRef` as a partition key, not authorization.

The server unit tests are sharded by a committed plan: `server/vitest.shards.json` lists every unit test file (`LawPracticeServer.test.ts` at `:115`, timing at `:596`), and `server/test/vitest-shards-plan.test.ts:120` asserts "names every unit test file exactly once and nothing else". `MatterWall.two-matter.test.ts` must be added to a shard and given a timing, or placed under `test/integration/` and `vitest.integration.shards.json`.

## 6. Stored formats whose bytes P6 changes

The law (decision `2026-11-19-p0-chapter-11-amendment-yields-to-the-stored-format-law`): where rows are stored, bytes are never rewritten and an incompatible change is one read-time transform; encodings with no stored rows may bump and regenerate.

| Artifact | What P6 does | Stored rows? | Disposition |
| --- | --- | --- | --- |
| `standards/instrumentation-catalog/@beep/nlp-processing.generated.jsonc` (50 spans; 11 non-conforming: `applyOne`, `cacheResult`, `executeOperation`, `executeOperations`, `fromDocument`, `fromDocumentAnnotated`, `makeNode`, `runStrategy`, `singleton`, `tokenizeNodes`, `withCaching`) | new `Operation.*` spans; deleted `TypeClass` spans (`executeOperation(s)`); EffectGraph and Graph spans change if merged | No (generated) | regenerate with `observability catalog --write`; current at the tip (`--check`: 170 shards, drifted 0) |
| `standards/instrumentation-catalog/@beep/nlp.generated.jsonc` (1 span `mapNodesEffect`) | becomes empty when GraphOps is deleted | No | regenerate |
| `standards/instrumentation-catalog/@beep/law-practice-use-cases.generated.jsonc` (76 spans; the office-action three `law_practice.office_action.*` are non-conforming) | new admission, write-tool and claim spans; renamed review spans if the flow is rebuilt | No | regenerate |
| `standards/instrumentation-catalog/@beep/law-practice-server.generated.jsonc` (1,180 lines) | `MatterAuthority` and provenance-traversal spans | No | regenerate |
| `nlp-processing/src/internal/observability.ts:15-28` | `package: "@beep/nlp"` attribute and `nlp_*` metric names (census correction 7) | metric names are runtime telemetry, not rows | rename by decision (F10) |
| `standards/schema-catalog/@beep/nlp.generated.jsonc` (52 rows: NLPMonoid 5, Core 33, Graph 14) and `@beep/nlp-processing.generated.jsonc` (56) | NLPMonoid rows leave; Core and Graph rows move with a new identity under `$NlpProcessingId`; `CharPosition` row leaves | No | regenerate |
| `standards/schema-catalog/@beep/law-practice-use-cases.generated.jsonc`, `@beep/law-practice-domain.generated.jsonc` | law claim core, proposition, profile, tool result schemas | No | regenerate |
| `server/test/fixtures/ir-to-law-entities-v1.json` | frozen `LawEntities` bytes; moves only if `LawEntities` changes | test-owned frozen golden of a wire shape | keep bytes; any change is a v2 golden plus a read transform, not a rewrite (F5) |
| `server/test/fixtures/office-action-attempts-v1.jsonl`, `-v2.jsonl` | untouched unless the attempt log changes | yes (attempt log written by `OfficeActionStructure.repo.ts`) | frozen; read transform only |
| `server/test/fixtures/review-items-v1.jsonl`, `-v2.jsonl` (ReviewHub ledger) | touched only if the write tool writes through `ReviewItemStore` | yes (`review-item/v2` envelope, decision `p4-review-items-v2-envelope`) | frozen; a new row kind needs a new envelope version |
| A law-practice claim log | none exists; a proposed-record write tool needs a store (in-memory, JSONL or PGlite) | not yet | a new format, versioned from the first byte (F6) |
| `epistemic_*` tables | the flow's legacy gate and lifecycle are in-memory (`epistemic/server/src/Layer.ts:85-95`) | yes, but P6's flow does not write them | none |
| `server/vitest.shards.json` | one new file entry plus timing | committed plan, not data | regenerate through the plan tool |
| `identity/registry/term-snapshot.json` (`release` `2.2.0`), `namespaces/operation.json` (`terms: ["Extract"]`), new law-practice terms | new operation names (for example compose or admit) or a law claim proposition IRI | No | a release bump against `origin/main` per decision `p5-stack-layers-write-the-term-snapshot-against-origin-main` |
| `standards/coverage.regression-baseline.jsonc` (nlp 25 rows, nlp-processing 50, law-practice use-cases 145, server 275) | 6 Operations/Algebra rows and `GraphOps.ts` leave; `TypeClass.ts` (77.64), `Operation.ts` (91.3), `EffectGraph.ts` (86.11) change or leave; Core rows move by rename; new src files at 100% | No | regenerate; S31 counts rows that move with the file as renames |
| `.gitleaks.toml:293-294,296` | allowlist lines pin `nlp-processing/src/Core/Tokenization.ts`, `Tools/Tokenize.ts` and `nlp/src/Core/Token.ts` by path and hash | No | `Token.ts` moves by rename; any edit to the three files changes their hash line |

## 7. Gates that move

| Gate | Why it moves in P6 | Evidence |
| --- | --- | --- |
| Identity registry and term snapshot | new terms (operation names, a law claim kind, a matter-authority action) bump the release; `Registry.data.ts` regenerates | `identity-registry` lint OK at the tip (219 packages); base `9a4f7b0258d6` has no snapshot, so stability compares to empty |
| Schema catalog | rows move between `@beep/nlp` and `@beep/nlp-processing`; law-practice rows are added | section 6 |
| Observability catalog | every package that gains spans regenerates; P6's exit is `observability catalog --check` current | `--check` at the tip: drifted 0; `12-observability.md` current |
| package-scripts | no new package (nlp-processing exists); `create-package` not needed unless F11 rules for one | `lint package-scripts` |
| Fallow boundaries | new edges `nlp-processing -> jsonc` (and `text`, `annotation`, `epistemics` if `HasIds` reads their ids); edges to `@beep/nlp` drop from wink, semantica, law-practice use-cases and server once Core moves | rule `fallow.boundaries.generated.jsonc:717-719`; nlp-processing references at `:3544,3568,3924-3960,5619`; provenance `fallow.boundaries.provenance.jsonc:490` |
| `bun.lock` | every package.json dependency edit above | in the CI binary closure (`bun run beep ci binary-closure --list`: 354 lines, `bun.lock` listed) |
| CI binary closure | `bun.lock`; and `identity/src/internal/generated/Registry.data.ts`, `packages.ts`, `Term.ts`, `Iri.ts` are in it, so a new registry term moves the closure digest. No nlp, nlp-processing, law-practice, mcp-kit, epistemics or jsonc source is in it | same listing |
| Runner-Lambda handler bundles | none if P6 leaves the five allowed identity sources (`Authority.ts`, `Id.ts`, `Root.ts`, `internal/Segment.ts`, `internal/schemaStatics.ts`) untouched; `Registry.data.ts` and `packages.ts` are outside every handler map | `ci-runners/test/HandlerBundles.test.ts:16-43` |
| Cache baselines | `standards/cache-baseline/@beep/{nlp,nlp-processing,law-practice-use-cases,law-practice-server,wink,semantica}.json` and `_root.json` follow package.json edits; `policy-tools.fingerprint.json` (nlp 1, nlp-processing 1, law-practice 1 each) | 5 baseline files name nlp-processing, 1 names `@beep/nlp` |
| CI partitions and coverage scope | `CiLanePartitions.ts:333,411-412,683,720,827`; `CoverageScope.ts:394-396` (`@beep/nlp` 3.4, `@beep/nlp-processing` 4), `:251` pairs `epistemic-server` with `law-practice-server` | move only if package dependencies change lanes |
| Lint-rule per-file allowance | `policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts:72-74` names `nlp/test/Graph/Schema.test.ts` (16), `nlp/test/Handoff/Contract.test.ts` (1, a file P3 deleted: a stale row), `nlp/test/PatternCore.test.ts` (6) | S31: the moved tests carry their rows by rename; the stale row only shrinks |
| S31 inventories at the tip | coverage baseline nlp 25 (P0 base 29), nlp-processing 50 (50); schema-first inventory nlp 0 (1), nlp-processing 2 (2: `NLPBackend.ts:633`, `ToolExport.ts:641`); fallow health nlp-processing 1 (`Composition.ts:77`); gitleaks nlp 1, nlp-processing 2; in-package suppressions nlp 0, nlp-processing 2 | `consumer-census.md:545-560` for the base |
| Design module and manifest | `ops/design/L5.operations.ts` is the last sketch (`ops/design/index.ts` exports only `L5`); retiring it empties `ops/design` and the manifest command `bunx tsrs -p goals/text-knowledge-stack-rebuild/ops/design/tsconfig.json --noEmit` (`ops/manifest.json:162`) and its `opsScripts` entry | P5 design section 11 kept the L5 sketch "while L5 remains" |
| Goals manifest projection | this map joins `researchReports`; `bun run beep goals manifest --write` then `--check` | not run here (read-only task) |
| Docs | `16-knowledge-stack.md:59,61,306,388,475,720,727,733,735,740` ("Pending P6"); `nlp/THEORY.md:70,172`; `DECISIONS.md:2935-2980` (the nlp split ruling); nlp-processing and wink READMEs if subpaths change | lines cited |
| Repo laws | no free comments (`beep laws comments` against the merge base); `Effect.fn` for generators; `effect/HashMap`/`HashSet`; `LiteralKit`; new src files at 100% coverage; `create-package` only for a new package | AGENTS.md Code Laws |

## 8. What the P5 tip has that P6 must not regress

| Item | Where it is held |
| --- | --- |
| L3-1 to L3-4 green | `ontology/test/{ConceptScheme.profile,MappingSet.profile,OntoAudit.laws,ClassificationEdition}.test.ts` |
| L6-1, L6-2 green | `rdf/test/{Dataset.laws,Projection.laws}.test.ts` |
| L0 to L2 and L4 rows green | `research/law-test-plan.md:13-32` |
| The office-action standing list green | section 1.4 |
| `ClaimGate.two-claims-one-occurrence.test.ts` | in `epistemics/test`, not the law-practice use-cases tests SPEC names (`SPEC.md:443-446`); P4's exit decision records it as existing (F12) |
| The legal asset pack, `LegalPositionRelatorTyping.test.ts`, `LegalVocabularyRendering.test.ts`, `LegalPositionRelatorPolicy.test.ts` in law-practice use-cases | P5 rows 10-12 |
| Term snapshot release `2.2.0` written against `origin/main`, with a re-stamp after each parent merge | decision `p5-stack-layers-write-the-term-snapshot-against-origin-main` |
| Every external namespace pinned (`rdf/test/NamespacePin.test.ts`) | a new external vocabulary in P6 (for example a matter or ODRL term) needs a pin |
| Observability catalog current, identity-registry lint OK | measured above |
| The legacy `scopeRef` consistency check at `VerifiedTextAnchor.ts:594` stays a consistency check; P6 adds authorization beside it, not instead | chapter 16 section 11 |
| Stored readers kept by P4 (evidence span, claim version, review items v1/v2, docket checks v1) | P4 decisions; fixtures in section 6 |

## 9. PLAN exit criteria against the measured state

| Exit (`PLAN.md:30`) | Measured at f8cbd3c9f69 |
| --- | --- |
| `L5-1` to `L5-3` green by id in `nlp-processing/test` | the three planned files are absent; no `Operation` with `withActivity` exists in any package |
| `OfficeActionReview.flow.test.ts` complete and green | present and covering extraction to `shape_valid`; lacks law-owned claim structure, assessment profile, admission and the proposed stance (section 1.2) |
| `MatterWall.two-matter.test.ts` in the server tests green | absent; no authority port; six of seven paths have no scope check (section 5) |
| write-tools-emit-proposed test green | no write tool and no test; file name unnamed (F8) |
| `observability catalog --check` current | current now; must stay current after the new spans |

## Open questions

F1. Does P6 move `@beep/nlp/Core` (217 lines in 33 files at the P0 base; 46 import statements in 27 files now) and the Graph node schemas into `@beep/nlp-processing`, as decisions `p0-census-dispositions` and `p3-graph-span-becomes-an-optional-position` say, or only Operations and Algebra, as PLAN's P6 row reads? If both, PLAN's row needs the amendment; if only two, the Core move and `CharPosition` deletion need a P7 decision.

F2. The Combiner/Reducer census leaves `SetUnion`, `SetIntersection`, `MultiSet`, `VectorAdd`, `VectorAverage`, `StringDelimited`, `Endo`, `Product3`, the `check*` helpers and all of `NLPMonoid` uncovered, with 0 consumers. Does `aggregate` over a `HashSet` of activities (the Writer log) count as the P6 consumer that keeps a `HashSet` union reducer, and if so does it live in nlp-processing or as an upstream-style `HashSet.makeReducerUnion` in `@beep/utils`?

F3. Which of the three operation models survives the merge: the sketch's `Operation { name: TermIri, run }` replacing nlp `Composable`, `TypeClass.TextOperation` and `GraphOperations.GraphOperation`, or does `GraphOperation` stay as the graph executor's node operation (it has one outside consumer through `Catalog`)? `TypeClass.ts` (1,031 lines, 0 outside consumers, coverage 77.64) looks deletable outright.

F4. What is the declared observation for `L5-1` and `L5-2`: `Exit` under `TestClock` plus a `Ref` trace (rebuild report `:290`), with defects, tracing and interruption excluded? Does the throwing `sync` counterexample use `Effect.sync` with a throw (a defect, excluded from the observation) or `Effect.try`?

F5. Which law-owned claim structure completes the flow: a law-practice `makeClaimCore` owner whose proposition is the distinction (with claim text and reference), `supportAtCreation` the handoff's distinction occurrence, `generatedBy` the handoff activity id, and `scope` the matter? Where does it live (law-practice domain for the schema, use-cases for arrows)? Does `LawEntities` change, and with it the frozen `ir-to-law-entities-v1.json`?

F6. Where are proposed records and admissions stored for the flow and the write tool: in memory for P6, a JSONL log beside ReviewHub, or PGlite tables in law-practice? A stored log needs a versioned envelope from its first row.

F7. Which toolkit hosts the first claim-writing tool: `PracticeKgToolkit` (moves `SchemaParity.test.ts:144`, `StrictTier.toolkit.test.ts:29`, `practice-kg-mcp` manifest and smoke, `practice-gateway`, `practice-claude-mod`), `ReviewHubToolkit`, or a new toolkit? And does the write tool replace the legacy `review` path or sit beside it?

F8. What is the write-tools-emit-proposed test's file and test name (PLAN names none)? Does "write tools" cover only claim and annotation writers, or also ReviewHub's three append tools and nlp's `CreateCorpus`/`DeleteCorpus`/`LearnCorpus`/`LearnCustomEntities`, which have no four-hint annotations?

F9. What is the assessment profile for office-action claims: which coordinates (for example alignment, distinction support, reference identity), which gate, and how does `Unassessed` block admission? Is the human token issued by ReviewHub's verdict path or by a new attorney action?

F10. Does nlp-processing's `observability.ts` keep `package: "@beep/nlp"` and the `nlp_*` metric names, or rename them in P6 (a telemetry name change with no stored rows)? Do the 11 non-conforming span names get conforming names in the same regeneration?

F11. Does `withActivity` need `@beep/jsonc` (`ActivityStart`, `mintActivityId`) in nlp-processing, and `HasIds` instances that read `@beep/text` occurrence ids and `@beep/annotation` content ids? Each edge moves `bun.lock`, the binary closure digest and fallow boundaries; the chapter allows them.

F12. SPEC places `ClaimGate.two-claims-one-occurrence.test.ts` in the law-practice use-cases tests; it lives in `epistemics/test`. Does P6's completed flow add the law-practice instance (two claims over one verified occurrence through the law gate), or is the P4 location ratified by decision?

F13. MatterAuthority: what is the principal's caller-independent source in tests and in hosts (a `Context.Service` provided by the host layer, never a request field)? Which seven assertions does the two-matter test make, given that `kg_provenance` already serves provenance unscoped and the annotation/admission traversal does not exist yet? Is the provenance traversal built over annotation attribution and admissions (decision `p0-item11-matter-wall-test-shape`) in addition to scoping `kg_provenance`?

F14. Does `MatterWall.two-matter.test.ts` join `server/vitest.shards.json` (unit) or `test/integration/` with `vitest.integration.shards.json`, given it composes PGlite repositories, DuckDB and the citation engine?

F15. Do new operation names (compose, admit, propose) become `operation:` registry terms (today only `operation:Extract`), forcing a term-snapshot release and a closure move, or stay unregistered until they leave a process?

F16. When `ops/design/L5.operations.ts` retires, does the manifest's design `tsrs` command and `opsScripts` entry retire with the directory, or does the design module stay as an empty checked module until P7?

F17. Does the unused `@beep/nlp` dependency of `law-practice/server/package.json:109` leave in P6 (it has no import site) and the `scratchpad/effect-ontology` imports migrate with the Core move, or are the scratchpad sites left red as in P5's FOLIO precedent?
