# Pack ontology-service — round 1 JSDoc review

Read-only review of `scratchpad/effect-ontology/Service/` against `.patterns/jsdoc-documentation.md` and the census slice. Census reports 78 exporting modules (0 open) and 470 owning exports (6 open). This review walked every exporting module and every census-owning export. No source was edited.

## Rejected false positives (do not open)

Census treats `export { Name }` / `export type { Name }` **without** `from` as owning. Those are graph edges; document the owning declaration, not the re-export (REVIEW-BRIEF: `export { Foo }` is not owning).

| Census row | Why rejected |
| --- | --- |
| `effect-ontology/Service/EntityIndex.ts:28` `cosineSimilarity` (value/re-export) missing=@category\|@since\|@example | `import { cosineSimilarity } from "./EmbeddingProvider.ts"; export { cosineSimilarity };`. Owner is `EmbeddingProvider.ts:256`. |
| `effect-ontology/Service/Extraction.ts:51` `Mention` (type/re-export) missing=@category\|@since | `export type { Mention };` re-export of `../Schema/MentionFactory.ts`. Type-level Example would not be required even if owning. |
| `effect-ontology/Service/Shacl.ts:44` `ShaclValidationReport` (value/re-export) | `export { ShaclValidationReport, ValidationPolicy };` from `../Domain/Schema/Shacl.ts`. |
| `effect-ontology/Service/Shacl.ts:44` `ValidationPolicy` (value/re-export) | Same local re-export statement. |
| `effect-ontology/Service/WorkflowOrchestrator.ts:1161` `BatchWorkflowPayload` (value/re-export) | `import { BatchWorkflowPayload } from "../Domain/Schema/Batch.ts";` then `export { BatchWorkflowPayload };`. |

`export { X } from "mod"` (Embedding.ts NomicNlp re-exports, WorkflowPersistence `Persistence`) is already classified `kind: re-export` and is not in the open-owning list.

## Confirmed mechanical

### ontology-service-R1-001: NomicNlpService missing useful lead

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/NomicNlp.ts:126
- `symbol`: NomicNlpService
- `kind`: value
- `evidence`: Census `missing-summary` (`hasLead: false`). Adjacent JSDoc lead is the two-word fragment `Service Tag` (census useful-lead heuristic requires length >= 12). Tags `@category services` and `@since 0.0.0` plus a titled Example are present, so this is summary-only mechanically.
- `impact`: Hover shows no purpose; callers cannot tell the tag from `NomicNlpConfig` or the live layers.
- `suggestedFix`: Replace the lead with the problem the Context tag solves (Nomic embed/batch/similarity capability). Do not document the `export { cosineSimilarity }` graph edge.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial — placeholder Examples (one item per file)

Law: value-level exports need a titled Example that shows the symbol doing its job with realistic inputs. `import { X }; console.log(X)`, `Layer.isLayer(X)`, unused `acceptsX = (_value: X): void => undefined`, and `S.is(X)({})` without a success path are defects. Type-level Examples are optional, but a present placeholder is still a defect. Fixers touching a file must bring the whole file to rubric (leads, categories, annotations).

Shared item fields for R1-002..R1-073 unless overridden: `round` 1, `reviewer` jsdoc-annotation-specialist, `label` issue, `blockingStatus` blocking, `severity` P1-high, `doctrineBucket` target-doctrine-violation, `sourceRefs` .patterns/jsdoc-documentation.md, `kind` value (symbols list both value and type), `recommendedSkillOrAgent` jsdoc-annotation-specialist, `fixerGroup` ontology-service, `acceptanceCommands` bun scratchpad/.jsdoc-loop/census.ts, `testsNeeded` none, `dependencies` none, `status` open, `fixedCommit` pending.

### ontology-service-R1-002: AgentCoordinator placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Agent/AgentCoordinator.ts:27,205,274
- `symbol`: AgentCoordinator, ExecutionResult
- `kind`: value
- `evidence`: Module header Example is `Layer.isLayer(AgentCoordinator.Default) // true`. Class Example is `console.log(AgentCoordinator)`. Value-level `ExecutionResult` Example is unused `acceptsExecutionResult`. ExecutionPolicy/input/hooks/options Examples construct values and are acceptable.
- `impact`: Callers never see register/execute/provide.
- `suggestedFix`: Show `Layer.provide` or a method call; construct `ExecutionResult.make` with realistic state. Drop or replace the module-header Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-003: AgentKit placeholder Examples and misidentified leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Agent/AgentKit.ts:42,78
- `symbol`: AgentInputError, AgentKit
- `kind`: value
- `evidence`: Both Examples are `console.log(Symbol)`. Lead on AgentInputError is `Provides the agent input error service capability` (error, not a service). Lead on AgentKit is `Validates and represents agent kit values at runtime` (Context.Service, not a schema).
- `impact`: Callers cannot construct/handle the error or acquire the kit.
- `suggestedFix`: Show `AgentInputError.make`/`_tag` and AgentKit acquisition or Default layer provision. Rewrite leads to purpose.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-004: CorrectorAgent placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Agent/CorrectorAgent.ts:23,305,332,360,396,476,658
- `symbol`: CorrectionError, CorrectionApplicationError, CorrectionResult, BatchCorrectionResult, CorrectorInput, CorrectorAgent
- `kind`: value
- `evidence`: Module `Layer.isLayer(CorrectorAgent.Default)`. Class/error Examples `console.log(Symbol)`. `CorrectorInput` unused-binding. CorrectionStrategy `S.is(...)("generate-value") // true` and Correction `correction.strategy` are acceptable.
- `impact`: Correction pipeline is undocumented at the service boundary.
- `suggestedFix`: Construct errors/results; show CorrectorAgent provision or a correction method. CorrectionStrategy/Correction already teach; do not add extra Examples there.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-005: Agent types placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Agent/types.ts:104,310,356,463,486,509,533,595,740,881,931,958,984,1007
- `symbol`: AgentTask (type companion), PipelineConfig, HumanApprove, HumanReject, HumanModify, HumanSkip, RefinementConfig, RefinementResult, ExecutionContext, AgentExecutionError, PipelineExecutionError, AgentNotFoundError, CheckpointTimeoutError
- `kind`: value
- `evidence`: Value-level tagged classes/errors Example as `console.log(Class)`. AgentTask type companion logs `typeof taskId // "function"`. AgentGraph narrowing and `AgentTask.forExtraction` are acceptable.
- `impact`: Feedback/config/error constructors are the caller’s job and are never shown.
- `suggestedFix`: Use `.make` / tagged constructors and read a field. Drop the type-companion Example or show narrowing.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-006: Assertion placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Assertion.ts:58,95,121,143,175,247,662
- `symbol`: CreateAssertionInput, AssertionFilter, AssertionWithProvenance, AssertionRow, AssertionError, AssertionService, AssertionServiceLive
- `kind`: value
- `evidence`: Four type contracts use unused-binding. AssertionError `console.log`. AssertionService Example is `Layer.isLayer(AssertionService.Default)`. AssertionServiceLive `console.log`.
- `impact`: No create/filter/reject path is shown.
- `suggestedFix`: Show error construction and Layer.provide or a method. Type Examples may be dropped or show a realistic object.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-007: BatchState placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/BatchState.ts:109,129,145,163,199,242
- `symbol`: BatchStateHub, BatchStateHubLayer, BatchStatePersistenceLayer, persistState, getBatchStateFromStore, publishState
- `kind`: value
- `evidence`: All six Examples `console.log(symbol)` without calling persist/get/publish. Persistence/decode error Examples construct failures and are acceptable.
- `impact`: Durable batch-state API looks like dead bindings.
- `suggestedFix`: Run or compose persist/get/publish with a fixture BatchState; show layer provision.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-008: BatchStateBridge placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/BatchStateBridge.ts:66,150,166
- `symbol`: BatchStateBridge, BatchStateBridgeLive, BatchStateBridgeDefault
- `kind`: value
- `evidence`: Tag and Default `console.log`. Live is `Layer.isLayer(BatchStateBridgeLive) // true`.
- `impact`: Bridge methods never appear.
- `suggestedFix`: Provide the live layer and call a bridge method, or compose the effect.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-009: Claim schema/layer placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Claim.ts:63,103,177
- `symbol`: CreateClaimInput, DeprecationResult, ClaimService
- `kind`: value
- `evidence`: Schemas only `S.is(X)({}) // false`. ClaimService only `Layer.isLayer(ClaimService.Default) // true`.
- `impact`: No successful claim input or service method is shown.
- `suggestedFix`: `.make` realistic inputs; show Default provision or a method.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-010: ClaimPersistence placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ClaimPersistence.ts:39,69,103
- `symbol`: ArticleMetadata, PersistenceResult, ClaimPersistenceService
- `kind`: value
- `evidence`: `S.is(X)({}) // false` plus `console.log(ClaimPersistenceService)`.
- `impact`: Persistence contract is never exercised.
- `suggestedFix`: Construct metadata/result; show a persist method.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-011: Config layer placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Config.ts:650
- `symbol`: ConfigServiceDefault
- `kind`: value
- `evidence`: Sole Example is `Layer.isLayer(ConfigServiceDefault) // true`. AppConfig.make, DEFAULT_CONFIG duration, and makeConfigServiceLayer(provider) are acceptable. ConfigService composes `yield* ConfigService` then `console.log(program)` (effect object, not the model).
- `impact`: Live config layer is not shown providing AppConfig.
- `suggestedFix`: Provide ConfigServiceDefault and read `config.llm.model`, or Effect.provide the existing program.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-012: ContentEnrichmentAgent placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ContentEnrichmentAgent.ts:19,56,167
- `symbol`: ContentEnrichmentError, ContentEnrichmentAgent
- `kind`: value
- `evidence`: Module `Layer.isLayer(Default)`. Error and class `console.log`. Lead `Validates and represents content enrichment agent values at runtime` misidentifies a Context.Service as a schema.
- `impact`: Enrichment API never appears.
- `suggestedFix`: Construct the error; show Default provision or an enrich method. Rewrite the service lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-013: CrossBatchEntityResolver tautological layer Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/CrossBatchEntityResolver.ts:250,592
- `symbol`: CrossBatchEntityResolver, CrossBatchEntityResolverLive
- `kind`: value
- `evidence`: Both Examples are `Layer.isLayer(...) // true`. Result/entity/stats/config Examples construct values and are acceptable.
- `impact`: Resolver methods and Live vs Default choice are untaught.
- `suggestedFix`: Show provision or a resolve call. Keep the construction Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-014: Curation placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Curation.ts:68,92
- `symbol`: CurationResult, CurationService
- `kind`: value
- `evidence`: Unused-binding type Example; `console.log(CurationService)`. Lead `Provides the curation service service capability`.
- `impact`: Curation actions never appear.
- `suggestedFix`: Show a realistic CurationResult and a service method. Rewrite the lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-015: CurationJobProcessor placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/CurationJobProcessor.ts:91
- `symbol`: CurationJobProcessor
- `kind`: value
- `evidence`: `console.log(CurationJobProcessor)`. JobProcessingStats.make is acceptable.
- `impact`: Job processing is untaught.
- `suggestedFix`: Show Default provision or process-jobs composition.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-016: DocumentClassifier placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/DocumentClassifier.ts:41,101,135,165,205,308,343
- `symbol`: DocumentClassification, BatchClassificationResponse, ClassifyInput, ClassifyBatchInput, ClassificationError, defaultClassification, DocumentClassifier
- `kind`: value
- `evidence`: Four structs `S.is(X)({})` with no expected result. Error and defaultClassification `console.log`. Layer `Layer.isLayer(DocumentClassifier.Default)`. Formulaic type-companion leads `Describes the … data exposed by this module`.
- `impact`: Callers never see a valid classification payload.
- `suggestedFix`: Decode/make realistic structs; construct ClassificationError; provide Default. Add `$I.annoteSchema` (R1-076).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-017: Embedding service placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Embedding.ts:93,118,208
- `symbol`: EmbeddingService, EmbeddingServiceLive, EmbeddingServiceDefault
- `kind`: value
- `evidence`: All three `console.log(symbol)`. `export type { NomicTaskType }` and `export { NomicNlpService, NomicNlpServiceLive } from "./NomicNlp.ts"` are graph edges — do not document them here.
- `impact`: embed/embedBatch never appears.
- `suggestedFix`: Provide a test layer and call embed, or compose the effect.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-018: EmbeddingCache placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingCache.ts:38,96,169,257,315,362,719
- `symbol`: Embedding, EmbeddingCacheConfig, EmbeddingCache, EmbeddingCacheTest, PersistentEmbeddingCache, makePersistentEmbeddingCache, EmbeddingCacheWithPersistence
- `kind`: value
- `evidence`: `S.is(Embedding)({})` on an array schema. Several `console.log(symbol)`. Config `.make` Example is acceptable. Persistent `clear` does not clear GCS (R1-076).
- `impact`: Cache get/set/test layer never appears; empty-object guard mis-teaches Embedding.
- `suggestedFix`: Validate a finite vector; provide EmbeddingCacheTest and get/set. Document GCS clear Gotcha.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-019: EmbeddingCircuitBreaker placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingCircuitBreaker.ts:78,106,193,347
- `symbol`: ProviderCircuitConfig, CircuitStatus, EmbeddingCircuitBreaker, EmbeddingCircuitBreakerLive
- `kind`: value
- `evidence`: Type contracts unused-binding; service/live `console.log`. ProviderId Options Example is acceptable.
- `impact`: Open/closed/half-open behavior never appears.
- `suggestedFix`: Construct config/status; protect a call or read circuit status through the live layer.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-020: EmbeddingFallback placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingFallback.ts:158,320
- `symbol`: EmbeddingProviderFallbackLive, EmbeddingProviderFallbackDefault
- `kind`: value
- `evidence`: Both `console.log(layer)`. FallbackChainConfig/ActiveProviderInfo/DEFAULT_FALLBACK_CHAIN construct values and are acceptable.
- `impact`: Fallback chain execution is untaught.
- `suggestedFix`: Show provision or which provider is active after failure.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-021: EmbeddingProvider placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingProvider.ts:227,245
- `symbol`: EmbeddingProvider, cosineSimilarity
- `kind`: value
- `evidence`: Both Examples `console.log(symbol)` without calling embed or similarity. cosineSimilarity is `@category services` (role is combinators/utilities). Implementation returns 0 for length mismatch/empty/zero-norm (R1-075). TaskType/Embedding/Request Examples are acceptable.
- `impact`: Callers never see a similarity score or provider method.
- `suggestedFix`: Call `cosineSimilarity([1,0],[1,0])` and a mismatched pair; show embed via a test provider. Recategorize cosineSimilarity.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-022: EmbeddingRateLimiter placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingRateLimiter.ts:152,170,232,248,264
- `symbol`: EmbeddingRateLimiter, makeEmbeddingRateLimiter, EmbeddingRateLimiterVoyage, EmbeddingRateLimiterLocal, EmbeddingRateLimiterNoop
- `kind`: value
- `evidence`: All `console.log(symbol)`. VOYAGE_RATE_LIMITS field read is acceptable.
- `impact`: Acquire/limit behavior never appears.
- `suggestedFix`: Provide a limiter layer and wrap a call, or show Noop succeeding immediately.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-023: EmbeddingRequest placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingRequest.ts:46,67
- `symbol`: EmbedTextRequest, embedRequestHash
- `kind`: value
- `evidence`: Both `console.log(symbol)`. EmbedTextRequest is `@category services` (constructors). Hash format `providerId::modelId::taskType::text` is in Details but never shown.
- `impact`: Dedup key format is unobservable.
- `suggestedFix`: Build a tagged request and log `embedRequestHash(req)`. Recategorize.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-024: EmbeddingResolver placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingResolver.ts:55
- `symbol`: makeEmbeddingResolver
- `kind`: value
- `evidence`: `console.log(makeEmbeddingResolver)`. DEFAULT_MAX_BATCH_SIZE inspect is a constant and acceptable if the value is commented.
- `impact`: Batch resolver is never composed.
- `suggestedFix`: Call makeEmbeddingResolver with a fixture provider/cache and show the request handler.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-025: EntityIndex placeholder Examples and orphaned cosineSimilarity docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EntityIndex.ts:79,101,198,347,376,393,474,492,625
- `symbol`: ScoredEntity, FindSimilarOptions, EntityIndex, EntityIndexDefault, SerializedEntityIndex, PersistentEntityIndex, makePersistentEntityIndex, PersistentEntityIndexLayer
- `kind`: value
- `evidence`: Unused-binding type Examples; several `console.log(symbol)`; `S.is(SerializedEntityIndex)({})`. Lines 195–208 JSDoc titled `Cosine similarity` with `import { cosineSimilarity } from "@effect-ontology/Service/EntityIndex"` sit on **private** `updateTypeIndex`, not an export. `export { cosineSimilarity }` at line 28 is a graph edge (rejected FP).
- `impact`: k-NN search is untaught; hover on a private helper claims to document cosineSimilarity.
- `suggestedFix`: Delete or retarget the orphaned block. Show findSimilar/add. Do not document the re-export.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-026: EntityResolution placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EntityResolution.ts:58
- `symbol`: EntityResolutionService
- `kind`: value
- `evidence`: `console.log(EntityResolutionService)` plus formulaic lead `Provides the entity resolution service service capability`.
- `impact`: `resolve` never appears.
- `suggestedFix`: Show Default provision or resolve composition. Rewrite lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-027: EventBus placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EventBus.ts:72,87,186,292,506,707,739,759
- `symbol`: EventEntry, EventBusService, EventBusServiceMemory, EventBusServiceSql, EventBusServiceSqlLayers, EventBusServiceSqlLive, EventBusServiceDefault
- `kind`: value
- `evidence`: Schema `console.log(EventEntry)`. Type companion logs the `eventName` function, not an event. Service/layers `console.log`. JobWithMetadata negative `S.is` is a weak reject-only Example.
- `impact`: publish/takeJob never appears; SQL vs memory choice is untaught.
- `suggestedFix`: Provide Memory and take/publish a job. Decode a realistic EventEntry.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-028: Examples service placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Examples.ts:73,103,125,150
- `symbol`: StageRetrievalOptions, StageExamples, ExampleStats, ExamplesService
- `kind`: value
- `evidence`: Three unused-binding type Examples; `console.log(ExamplesService)`.
- `impact`: Stage retrieval never appears.
- `suggestedFix`: Construct option/stats objects; show a retrieval method.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-029: ExecutionDeduplicator placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ExecutionDeduplicator.ts:29,73,161,181
- `symbol`: ExecutionFailure, makeExecutionDeduplicator, ExecutionDeduplicator, ExecutionDeduplicatorLive
- `kind`: value
- `evidence`: All `console.log`. Lead on ExecutionFailure `Provides the execution failure service capability` (error, not a service).
- `impact`: Dedupe/in-flight behavior never appears.
- `suggestedFix`: Construct ExecutionFailure; show two overlapping executions sharing a handle.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-030: Extraction extractor placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Extraction.ts:82,311,408
- `symbol`: EntityExtractor, MentionExtractor, RelationExtractor
- `kind`: value
- `evidence`: Each Example is `console.log(Extractor)`. `export type { Mention }` is a rejected FP — do not document it here.
- `impact`: Two-stage extraction API never appears.
- `suggestedFix`: Show Test/Default provision or extract composition with a stub LanguageModel.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-031: ExtractionCache placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ExtractionCache.ts:34,77,113,159,179,195
- `symbol`: CachedExtractionResult, DEFAULT_CACHE_DIR, makeFileSystemExtractionCache, ExtractionCache, ExtractionCacheLive, FileSystemExtractionCacheLive
- `kind`: value
- `evidence`: `S.is({})`; `console.log` of dir/function/service/layers. DEFAULT_CACHE_DIR lead `Provides the default cache dir service capability` (string constant).
- `impact`: Cache read/write never appears.
- `suggestedFix`: Decode a realistic CachedExtractionResult; provide a filesystem cache with a temp dir. Rewrite the constant lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-032: ExtractionRun placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ExtractionRun.ts:83,130,278,659,675
- `symbol`: getRunIdFromText, ExtractionRunError, ExtractionRunService, ExtractionRunServiceLive, ExtractionRunServiceDefault
- `kind`: value
- `evidence`: All `console.log`. ExtractionRunError lead `Provides the extraction run error service capability`.
- `impact`: Run-id derivation and run APIs never appear.
- `suggestedFix`: Call `getRunIdFromText("Ada founded Acme")` and show the id; construct the error; provide the live layer.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-033: ExtractionWorkflow placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ExtractionWorkflow.ts:43
- `symbol`: ExtractionWorkflow
- `kind`: value
- `evidence`: `console.log(ExtractionWorkflow)`. Methods interface lead is formulaic `Describes the extraction workflow methods data exposed by this module`.
- `impact`: Workflow methods never appear.
- `suggestedFix`: Show tag acquisition or Default provision.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-034: GenerateWithFeedback placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/GenerateWithFeedback.ts:109
- `symbol`: generateObjectWithFeedback
- `kind`: value
- `evidence`: `console.log(generateObjectWithFeedback)`. Policy.make Example is acceptable.
- `impact`: Feedback retry loop never appears.
- `suggestedFix`: Compose generateObjectWithFeedback with a stub schema/model (do not void-discard).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-035: GraphRAG placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/GraphRAG.ts:89,190,335,363,390,863,1125
- `symbol`: ScoredNode, RetrievalResult, GroundedAnswer, ReasoningStep, ReasoningTrace, GraphRAG, GraphRAGDefault
- `kind`: value
- `evidence`: Several schemas only `S.is(X)({}) // false`. GraphRAG Example is `console.log(GraphRAG.key)`. GraphRAGDefault is `Layer.isLayer`. Options `.make` Examples are acceptable.
- `impact`: retrieve/answer/explain never appear.
- `suggestedFix`: `.make` realistic scored nodes/answers; provide GraphRAGDefault or compose retrieve. Keep options Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-036: Grounder tautological layer Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Grounder.ts:740
- `symbol`: Grounder
- `kind`: value
- `evidence`: Sole service Example `Layer.isLayer(Grounder.Default) // true`. Input/result Examples are meaningful and must be kept.
- `impact`: Grounder methods are documented on classes but the service tag is not shown in use.
- `suggestedFix`: Replace with provision or a verify call. Do not add extra Examples on the already-good schemas.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-037: ImageBlobStore placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ImageBlobStore.ts:118
- `symbol`: ImageBlobStore
- `kind`: value
- `evidence`: `console.log(ImageBlobStore)`. Nearby `// Service Tag` comment echoes the census miss pattern.
- `impact`: Blob put/get never appears.
- `suggestedFix`: Show tag acquisition or a store method.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-038: ImageExtractor placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ImageExtractor.ts:41,177
- `symbol`: ImageExtractionInput, ImageExtractor
- `kind`: value
- `evidence`: Unused-binding input; `console.log(ImageExtractor)`.
- `impact`: Extraction input shape and service never appear in use.
- `suggestedFix`: Construct ImageExtractionInput; show extract composition.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-039: ImageFetcher placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ImageFetcher.ts:107,259
- `symbol`: ImageFetchOptions, ImageFetcher
- `kind`: value
- `evidence`: Unused-binding plus `console.log(ImageFetcher)`. Configure-options Example that logs `options` after make is acceptable.
- `impact`: Fetch never appears.
- `suggestedFix`: Show ImageFetcher method composition.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-040: ImagePromptAdapter placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ImagePromptAdapter.ts:123,261,290
- `symbol`: ImagePromptAdapter, imagesToPromptParts, buildMultimodalContent
- `kind`: value
- `evidence`: All three `console.log(symbol)` without calling the duals.
- `impact`: Multimodal prompt parts never appear.
- `suggestedFix`: Call imagesToPromptParts/buildMultimodalContent with a fixture image.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-041: ImageStore placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ImageStore.ts:159
- `symbol`: ImageStore
- `kind`: value
- `evidence`: `console.log(ImageStore)`.
- `impact`: Store methods never appear.
- `suggestedFix`: Show acquisition or a put/get composition.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-042: InheritanceService placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Inheritance.ts:30
- `symbol`: InheritanceService
- `kind`: value
- `evidence`: `console.log(InheritanceService)`. Implementation comments cache ontology context (missing Gotcha on the service).
- `impact`: Inheritance lookup never appears.
- `suggestedFix`: Show a lookup method; mention context caching in Gotchas.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-043: JinaReaderClient placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/JinaReaderClient.ts:47,95,173
- `symbol`: FetchOptions, JinaResponse, JinaReaderClient
- `kind`: value
- `evidence`: Unused-binding contracts; `console.log(JinaReaderClient)`. Lead `Validates and represents jina reader client values at runtime`. FetchOptions make Example is acceptable.
- `impact`: Reader fetch never appears.
- `suggestedFix`: Show a client method; rewrite the service lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-044: LinkIngestionService placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/LinkIngestionService.ts:16,79,112,144,178,202,250
- `symbol`: LinkIngestionError, IngestOptions, IngestResult, BulkIngestOptions, IngestedLinkFilter, LinkIngestionService
- `kind`: value
- `evidence`: Module `Layer.isLayer(Default)`. Error/service `console.log`. Four unused-binding type Examples.
- `impact`: Ingest pipeline never appears.
- `suggestedFix`: Construct the error; show ingest options as a realistic object; provide Default.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-045: CentralRateLimiter placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/LlmControl/RateLimiter.ts:46,78,131,308,324
- `symbol`: RateLimiterState, RateLimiterConfig, CentralRateLimiterServiceLive, CentralRateLimiterServiceTest
- `kind`: value
- `evidence`: Unused-binding types; Live `Layer.isLayer`; Live/Test also `console.log`. CircuitState type-level has prose only (acceptable).
- `impact`: 50 rpm / token budget / circuit never appears.
- `suggestedFix`: Use Test layer and show allow vs CircuitOpenError.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-046: StageTimeout tautological layer Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/LlmControl/StageTimeout.ts:225,272
- `symbol`: StageTimeoutService, StageTimeoutServiceLive
- `kind`: value
- `evidence`: Service Example composes `getConfig("chunking")` then `console.log(program)` (effect object). Live is `Layer.isLayer`. Gotchas about nested retry deadlines are already present and must be kept. TimedStage/TimeoutError Examples are acceptable.
- `impact`: Timeouts are not shown firing or being provided.
- `suggestedFix`: Provide the live/test layer and observe getConfig/wouldTimeout. Keep Gotchas.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-047: TokenBudget placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/LlmControl/TokenBudget.ts:39,75,121,245,261
- `symbol`: BudgetedStage, TokenBudgetState, TokenBudgetServiceLive, TokenBudgetServiceTest
- `kind`: value
- `evidence`: `console.log(BudgetedStage)` on a LiteralKit (`@category services`, should be schemas). Unused-binding state. Live `Layer.isLayer` plus later `console.log` Live/Test. Missing LiteralKit annotate (R1-083).
- `impact`: Stage budgets never appear.
- `suggestedFix`: Show BudgetedStage.Options or a typed stage; provide Test and record token use.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-048: LlmWithRetry placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/LlmWithRetry.ts:75
- `symbol`: generateObjectWithRetry
- `kind`: value
- `evidence`: `console.log(generateObjectWithRetry)`.
- `impact`: Retry wrapper never composed.
- `suggestedFix`: Compose with a stub schema (R may be non-never — provide or do not runPromise).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-049: NlpService tautological layer Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Nlp.ts:646
- `symbol`: NlpService
- `kind`: value
- `evidence`: `Layer.isLayer(NlpService.Default) // true`. Tokenize/similarity/chunk/search Examples are acceptable.
- `impact`: NLP methods exist in other Examples; the service tag itself is not shown acquired.
- `suggestedFix`: Replace with provision or tokenize via NlpService. Keep model Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-050: NomicEmbeddingProvider placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/NomicEmbeddingProvider.ts:45,104
- `symbol`: NomicEmbeddingProviderLive, NomicEmbeddingProviderDefault
- `kind`: value
- `evidence`: Both `console.log(layer)`.
- `impact`: Local Nomic embedding provision never appears.
- `suggestedFix`: Show Layer.merge/provide onto EmbeddingProvider and compose embed.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-051: NomicNlp placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/NomicNlp.ts:33,120,139,158,174,281,301,331
- `symbol`: NomicNlpError, NomicNlpService, NomicNlpConfigValue, NomicNlpConfig, NomicNlpServiceLive, NomicNlpServiceDefault, NomicNlpConfigFromConfigService, NomicNlpServiceFromConfig
- `kind`: value
- `evidence`: Seven `console.log(symbol)` plus unused-binding config value. Complements R1-001 (Service Tag lead).
- `impact`: embed/embedBatch/cosineSimilarity on the service never appear.
- `suggestedFix`: Construct NomicNlpError; provide FromConfig/Default; call cosineSimilarity on two fixture vectors.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-052: Ontology parser/service placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Ontology.ts:228,615
- `symbol`: parseOntologyFromStore, OntologyService
- `kind`: value
- `evidence`: `console.log(typeof parseOntologyFromStore) // "function"` and `console.log(OntologyService)`.
- `impact`: Parser and ontology search never appear.
- `suggestedFix`: Parse a tiny RDF store; show searchClasses via the service.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-053: OntologyAgent placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/OntologyAgent.ts:98,168
- `symbol`: OntologyAgentError, OntologyAgent
- `kind`: value
- `evidence`: Error `console.log`; service `Layer.isLayer(OntologyAgent.Default)`. Nested method Examples (query/extract) exist on the class body and must be migrated onto the owning export or kept as method docs without replacing a class-level observable Example.
- `impact`: Owning export Example does not show the agent doing work.
- `suggestedFix`: Construct OntologyAgentError; class Example should provide Default or call a method.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-054: OntologyLoader placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/OntologyLoader.ts:34
- `symbol`: OntologyLoader
- `kind`: value
- `evidence`: `console.log(OntologyLoader)`. Lead `Provides the ontology loader service capability`. Module Details already explain it is a compatibility adapter over OntologyService — the export lead does not.
- `impact`: Callers may think this still loads ontologies from storage.
- `suggestedFix`: Lead: adapter exposing `searchClasses` from OntologyService. Example: provide Default and call searchClasses (or compose).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-055: OntologyRegistry placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/OntologyRegistry.ts:39,67,98,150
- `symbol`: RegistryNotFoundError, RegistryParseError, OntologyNotFoundError, OntologyRegistryService
- `kind`: value
- `evidence`: All `console.log`. Leads on parse/not-found errors `Provides the … service capability` (they are errors).
- `impact`: Registry lookup/error handling never appears.
- `suggestedFix`: `.make` each error and log `_tag`; show a get-by-id method.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-056: ProgressStreaming placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ProgressStreaming.ts:63,97,127,161,216,264,312,368,428,484,555,614,669,689,718,745,843,921,943,968,998,1054,1090,1117
- `symbol`: ProgressStreamingError, ProgressBuilderState, makeProgressBuilder, createExtractionStarted, createChunkingProgress, createChunkProcessingStarted, createEntityFound, createRelationFound, createChunkProcessingComplete, createExtractionComplete, createExtractionFailed, createRecoverableError, markChunkProcessed, setPhaseProgress, BackpressureState, makeBackpressureHandler, enqueueEvent, dequeueEvent, getQueueSize, combineProgressStreams, withBackpressure, ResumableExtractionState, extractResumableState
- `kind`: value
- `evidence`: Nearly every constructor/combinator Example is `console.log(fn)` without invoking the dual. Three unused-binding types.
- `impact`: Progress event construction — the entire module job — is untaught.
- `suggestedFix`: `Effect.runSync`/`Ref.make` a builder and call one create* dual; show enqueue/dequeue size. One realistic event per constructor.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-057: PromptCache structured helper placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/PromptCache.ts:69
- `symbol`: makeCachedPromptFromStructured
- `kind`: value
- `evidence`: `console.log(makeCachedPromptFromStructured)`. Sibling `makeCachedPrompt` already calls the dual with realistic strings (keep it). Details on makeCachedPrompt contradict the implementation (R1-074).
- `impact`: Structured-prompt wrapper is untaught.
- `suggestedFix`: Call the dual with a fixture StructuredPrompt. Do not invent cache_control behavior the runtime does not apply.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-058: PubSubClient placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/PubSubClient.ts:50,93,166,186,218,391,427
- `symbol`: PublishResult, PubSubClientConfig, PubSubClient, PubSubClientLive, EventBusPubSubBridge, PubSubClientDefault
- `kind`: value
- `evidence`: Unused-binding types plus `console.log` of tag/config/layers.
- `impact`: Publish/subscribe never appears.
- `suggestedFix`: Construct PublishResult; compose Live as a Layer (not Layer.isLayer-only).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-059: Rdf store helpers placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Rdf.ts:194,212,228,247,263,293,310,331,352,368,411,502,559,596,813
- `symbol`: isRdfStore, emptyRdfStore, rdfStoreFromDataset, rdfStoreSize, rdfStoreQuads, rdfStoreAllQuads, rdfStoreAddQuad, rdfStoreRemoveQuads, cloneRdfStore, rdfStoreApplyRules, QuadPattern, rdfStoreToDataset, AddTriplesOptions, ExtractionMetadata, RdfBuilder
- `kind`: value
- `evidence`: Store helpers `console.log(fn)` without calling. Three unused-binding types. RdfBuilder `Layer.isLayer(Default)`. Several helpers `@category services` (predicates/constructors/utilities). emptyRdfStore is a thunk that is logged, not invoked.
- `impact`: Opaque store API — add/size/clone — never appears; category search dumps helpers under services.
- `suggestedFix`: `const store = emptyRdfStore(); console.log(isRdfStore(store), rdfStoreSize(store))`. Recategorize. Show RdfBuilder method or provision.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-060: Reasoner placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Reasoner.ts:45,76,114,138,210,388,580
- `symbol`: ReasoningError, RuleParseError, ReasoningProfile, ReasoningConfig, ReasoningResult, Reasoner
- `kind`: value
- `evidence`: Errors/config/result/profile `console.log`. Reasoner Default `Layer.isLayer` twice (class + another export). ReasoningProfile is LiteralKit with `@category services` and no `.annotate($I.annote)` (R1-083). Nested static Examples also `console.log(ReasoningConfig)`.
- `impact`: Reasoning over a store never appears.
- `suggestedFix`: Construct config via `.make`/`rdfs`; provide Reasoner.Default; show a reason call. Recategorize ReasoningProfile as schemas.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-061: ReconciliationService placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ReconciliationService.ts:40,78,111,154,205
- `symbol`: ReconciliationError, ReconciliationConfig, ReconciliationResult, VerificationTask, ReconciliationService
- `kind`: value
- `evidence`: Error/config/service `console.log`. Unused-binding result. VerificationTask `S.is({})`. Missing class `$I.annote` / struct `annoteSchema` (R1-084).
- `impact`: Auto-link vs queue thresholds never appear in use.
- `suggestedFix`: `ReconciliationConfig.make({})` and read thresholds; construct error; provide the service.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-062: RelationLinker placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/RelationLinker.ts:97
- `symbol`: RelationLinker
- `kind`: value
- `evidence`: `console.log(RelationLinker)`. LinkedRelation reject-empty and LinkingResult.make are acceptable.
- `impact`: Canonicalization never appears.
- `suggestedFix`: Provide Default or call link on a fixture relation batch.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-063: ShaclWorkflowService placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Shacl.ts:137,158,177,196
- `symbol`: ShaclWorkflowServiceTestConfig, defaultTestConfig, ShaclWorkflowService
- `kind`: value
- `evidence`: Unused-binding test config; `console.log(defaultTestConfig)` (`@category services`, should be fixtures/testing). Class Example `console.log(ShaclWorkflowService)`. Useful `ShaclWorkflowService.Test({ conforms: false, violations: [...] })` sits on a static method **after** `@param`/`@returns` (section/tag order violation) and is not the owning-export Example. `export { ShaclValidationReport, ValidationPolicy }` is a rejected FP.
- `impact`: Callers miss the Test double; hover on the class is a placeholder.
- `suggestedFix`: Move the Test() Example onto the class (or Test static with tags after Example). Recategorize defaultTestConfig. Do not document the re-export.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-064: SimilarityScorer placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/SimilarityScorer.ts:36,66
- `symbol`: SimilarityResult, SimilarityScorer
- `kind`: value
- `evidence`: Unused-binding result; `console.log(SimilarityScorer)`.
- `impact`: Score/decision never appears.
- `suggestedFix`: `SimilarityResult.make` with a method/score; provide the scorer.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-065: SparqlGenerator placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/SparqlGenerator.ts:51,85,119,189
- `symbol`: SparqlGenerationError, SparqlSyntaxError, SparqlCorrectionError, SparqlGenerator
- `kind`: value
- `evidence`: Errors `console.log`. Service `Layer.isLayer(Default)`.
- `impact`: SPARQL generate/correct never appears.
- `suggestedFix`: Construct errors with `_tag`; provide Default and compose generate.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-066: Storage placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Storage.ts:139,163,250,269,320,346,1001,1037
- `symbol`: ObjectWithGeneration, GenerationMismatchError, StorageService, StorageConfigValue, StorageConfig, StorageServiceLive, StorageServiceTest
- `kind`: value
- `evidence`: Unused-binding types; error/service/config/layers `console.log`. StorageBackend Options/use Examples are acceptable.
- `impact`: get/put/generation mismatch never appears.
- `suggestedFix`: Construct GenerationMismatchError; provide StorageServiceTest and get/put.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-067: SubgraphExtractor placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/SubgraphExtractor.ts:323,391
- `symbol`: SubgraphExtractor, SubgraphExtractorDefault
- `kind`: value
- `evidence`: `console.log(SubgraphExtractor.key)` and `console.log(SubgraphExtractorDefault)`. NodeDistance/Subgraph/options Examples construct values and are acceptable.
- `impact`: extract/extractRelevant never appear.
- `suggestedFix`: Provide Default and compose extract. Keep model Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-068: Ticket placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/Ticket.ts:49,237,257
- `symbol`: TicketStorageError, TicketService, TicketServiceLive
- `kind`: value
- `evidence`: All `console.log`. Leads `Provides the ticket service service capability` / `Provides the Effect layer for ticket service live dependencies`.
- `impact`: One-time ticket persist/consume never appears.
- `suggestedFix`: Construct TicketStorageError; provide Live and issue/consume a ticket (or compose).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-069: ViolationExplainer placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/ViolationExplainer.ts:44,82,147,195,272
- `symbol`: ExplanationError, ExplanationContext, LlmViolationExplanation, BatchExplanationResult, ViolationExplainer
- `kind`: value
- `evidence`: Classes `console.log`. Nested member Examples also `console.log(Class)`. Service `Layer.isLayer(Default)`. Classes use string identifiers without `$I.annote` (R1-084).
- `impact`: Explain-batch never appears.
- `suggestedFix`: `.make` context/explanation; provide Default. Keep member docs from duplicating a class Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-070: VoyageEmbeddingProvider placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/VoyageEmbeddingProvider.ts:318,360,549,601
- `symbol`: VoyageProviderConfig, makeVoyageProvider, VoyageEmbeddingProviderLive, VoyageEmbeddingProviderDefault
- `kind`: value
- `evidence`: Unused-binding config; `console.log(makeVoyageProvider)` / layers. Model Options/dimension/default constant Examples that log the actual constant are acceptable.
- `impact`: Provider construction never embeds text.
- `suggestedFix`: Call makeVoyageProvider with VoyageProviderConfig.make and compose embed (or show the layer provided to EmbeddingProvider).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-071: WikidataClient placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/WikidataClient.ts:42,76,145,377
- `symbol`: WikidataApiError, WikidataRateLimitError, WikidataCandidate, WikidataClient
- `kind`: value
- `evidence`: Errors/candidate schema/client `console.log`. Lead `Validates and represents wikidata client values at runtime`. Match/entity type Options and SearchOptions.make are acceptable.
- `impact`: wbsearchentities never appears.
- `suggestedFix`: Construct errors; decode a candidate; show a search method. Rewrite the client lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-072: WorkflowOrchestrator placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/WorkflowOrchestrator.ts:180,303,343,1049,1075,1126,1153
- `symbol`: BatchExtractionWorkflow, pollToBatchState, BatchExtractionWorkflowLayer, WorkflowOrchestrator, makeWorkflowOrchestrator, WorkflowOrchestratorLive, WorkflowOrchestratorFullLive
- `kind`: value
- `evidence`: All `console.log(symbol)` without starting a workflow. pollToBatchState lead `Validates and represents poll to batch state values at runtime` (Effect.fn, not a schema). `export { BatchWorkflowPayload }` is a rejected FP. Implementation comments: `failOnViolation=true` throws ValidationPolicyError (R1-077).
- `impact`: start/startAndWait never appear; payload re-export must not be documented here.
- `suggestedFix`: Compose start/poll with a fixture payload type (do not invent a live engine). Document failOnViolation in Gotchas. Skip the re-export.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-073: WorkflowPersistence placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/WorkflowPersistence.ts:34,81,105,128
- `symbol`: StorageKeyValueStoreLive, WorkflowPersistenceLive, WorkflowPersistenceTest, WorkflowPersistenceMemory
- `kind`: value
- `evidence`: All `console.log(layer)`. `export { Persistence } from "effect/unstable/persistence"` is a true re-export — do not document it.
- `impact`: Live vs Test vs Memory choice is untaught.
- `suggestedFix`: Show Layer.provide of Memory/Test onto a tiny persist/get, or compose the layer with WorkflowEngine. Mention the `workflow-state/` prefix already in Details.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial — Details/Gotchas vs implementation

### ontology-service-R1-074: makeCachedPrompt Details contradict implementation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/PromptCache.ts:17
- `symbol`: makeCachedPrompt
- `kind`: value
- `evidence`: Details claim `When caching is enabled, the system message is marked with cache_control: "ephemeral"`. Implementation is `dual3((_, _, _enableCaching) => Prompt.fromMessages([...]))` — `_enableCaching` is unused; no cache_control is set. The Example passes `true` as if it mattered.
- `impact`: Callers will believe Anthropic prompt caching is wired. It is not.
- `suggestedFix`: Rewrite Details/params to the actual behavior (messages are built; the flag currently does nothing). Do not document cache_control until runtime applies it. A Gotcha is appropriate.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-075: cosineSimilarity missing Gotcha for degenerate vectors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingProvider.ts:256
- `symbol`: cosineSimilarity
- `kind`: value
- `evidence`: Implementation returns `0` when lengths differ, either vector is empty, or a norm is 0. Docs have no Gotchas; Example is `console.log(cosineSimilarity)` (R1-021). `@returns Similarity score between -1 and 1` is on the interface method, not this export, and does not mention the 0-sentinel.
- `impact`: Callers treat 0 as “orthogonal” rather than “incomparable”.
- `suggestedFix`: Add Gotchas: unequal/empty/zero-norm vectors yield 0, not an error. Show both a real score and a mismatched-length 0 in the Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-076: PersistentEmbeddingCache.clear does not clear GCS

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/EmbeddingCache.ts:536
- `symbol`: PersistentEmbeddingCache
- `kind`: value
- `evidence`: Implementation comment on `clear`: `Note: Does not clear GCS - that would need storage.clear`. Owning JSDoc has no Gotchas; Example is `console.log(PersistentEmbeddingCache)`.
- `impact`: Operators will assume clear wipes the persistent cache.
- `suggestedFix`: Gotchas on PersistentEmbeddingCache (and makePersistentEntityIndex if the same trap applies): `clear` drops only the in-memory map.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-077: BatchExtractionWorkflow missing failOnViolation Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Service/WorkflowOrchestrator.ts:186,841
- `symbol`: BatchExtractionWorkflow
- `kind`: value
- `evidence`: Implementation comment: policy enforcement is in `validateWithPolicy`; default `failOnViolation=true` throws `ValidationPolicyError`. Owning workflow JSDoc has no Gotchas; Example is `console.log(BatchExtractionWorkflow)`.
- `impact`: Callers of start/startAndWait will not expect a typed policy failure on SHACL violations.
- `suggestedFix`: Gotchas on BatchExtractionWorkflow / WorkflowOrchestratorMethods: default fail-closed on SHACL violations.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial — missing `$I.annote` / `$I.annoteSchema`

Same-name type aliases exist for the structs/LiteralKits below; the runtime schemas still lack identity annotations required by `references/annotation-patterns.md`. Class schemas using a bare string identifier also omit `$I.annote` as the third factory argument.

### ontology-service-R1-078: DocumentClassifier structs missing annoteSchema

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Service/DocumentClassifier.ts:47,107,141,171
- `symbol`: DocumentClassification, BatchClassificationResponse, ClassifyInput, ClassifyBatchInput
- `kind`: value
- `evidence`: Exported `S.Struct` values with same-name type aliases but no `$I.annoteSchema(...)`.
- `impact`: Identity/description never reaches schema metadata or generated docs.
- `suggestedFix`: `.pipe($I.annoteSchema("Name", { description: "..." }))` on each exported struct.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-079: EmbeddingCache Embedding missing annoteSchema

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Service/EmbeddingCache.ts:44
- `symbol`: Embedding
- `kind`: value
- `evidence`: `export const Embedding = S.Array(S.Finite);` with a same-name type alias and no `$I.annoteSchema`. (Contrast EmbeddingProvider.ts Embedding which is annotated.)
- `impact`: Duplicate Embedding schema in this file has no identity; docs/tooling cannot distinguish it.
- `suggestedFix`: Pipe `$I.annoteSchema("Embedding", { description: "Finite embedding vector cached by EmbeddingCache." })`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-080: EventEntry missing annoteSchema

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Service/EventBus.ts:78
- `symbol`: EventEntry
- `kind`: value
- `evidence`: `S.toType(OntologyEventEntry).pipe(SchemaUtils.withEffectCodecStatics)` — no `$I.annoteSchema`.
- `impact`: Canonical event codec has no identity annotation.
- `suggestedFix`: Add `$I.annoteSchema("EventEntry", { description: "..." })` in the pipe.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-081: ExtractionCache CachedExtractionResult missing annoteSchema

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Service/ExtractionCache.ts:40
- `symbol`: CachedExtractionResult
- `kind`: value
- `evidence`: Exported `S.Struct` with field `annotateKey` only; no `$I.annoteSchema`. Same-name type alias exists.
- `impact`: Cache payload schema is unannotated.
- `suggestedFix`: Pipe `$I.annoteSchema("CachedExtractionResult", { description: "..." })`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-082: EntityIndex SerializedEntityIndex missing annoteSchema

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Service/EntityIndex.ts:399
- `symbol`: SerializedEntityIndex
- `kind`: value
- `evidence`: Exported `S.Struct` with same-name type alias, no `$I.annoteSchema`.
- `impact`: Persistence payload schema is unannotated.
- `suggestedFix`: Pipe `$I.annoteSchema("SerializedEntityIndex", { description: "..." })`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-083: LiteralKits missing `.annotate($I.annote)` / annoteSchema

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Service/Reasoner.ts:120, effect-ontology/Service/LlmControl/StageTimeout.ts:31, effect-ontology/Service/LlmControl/TokenBudget.ts:45, effect-ontology/Service/Agent/CorrectorAgent.ts:80
- `symbol`: ReasoningProfile, TimedStage, BudgetedStage, CorrectionStrategy
- `kind`: value
- `evidence`: Exported `LiteralKit([...])` without `.annotate($I.annote(...))` or `$I.annoteSchema`. Same-name type aliases exist. VoyageModel/EmbeddingTaskType/StorageBackend in this pack show the required form.
- `impact`: Closed string unions have no schema identity.
- `suggestedFix`: `.annotate($I.annote("Name", { description: "..." }))` (or annoteSchema pipe, matching file convention).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-service-R1-084: Class schemas missing `$I.annote` third argument

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Service/ReconciliationService.ts:84,160, effect-ontology/Service/Reasoner.ts:144,216, effect-ontology/Service/ViolationExplainer.ts:88,153,201, effect-ontology/Service/Agent/types.ts:362,601,746,887, effect-ontology/Service/Agent/CorrectorAgent.ts:366,402
- `symbol`: ReconciliationConfig, VerificationTask, ReasoningConfig, ReasoningResult, ExplanationContext, LlmViolationExplanation, BatchExplanationResult, PipelineConfig, RefinementConfig, RefinementResult, ExecutionContext, CorrectionResult, BatchCorrectionResult
- `kind`: value
- `evidence`: `S.Class<X>("X")({ fields })` or exported `S.Struct` (VerificationTask) without `$I.annote` / `$I.annoteSchema`. Neighboring files in this pack pass `$I.annote("X", { description })` as the third Class argument.
- `impact`: Schema identity/description missing for a large set of runtime models.
- `suggestedFix`: Switch identifier to `$I\`Name\`` and pass `$I.annote("Name", { description })`. For VerificationTask use `annoteSchema`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Files reviewed with no accepted findings

- `effect-ontology/Service/Retry.ts` — owning exports construct policies, classify retryability, and compose `retryEffect`.
- `effect-ontology/Service/EntityLinker.ts` — `getCanonicalId` / `getMentionsForEntity` / `toMermaid` call the duals on a decoded graph. `@category services` is a weak role (getters/utilities) but is a canonical slug; not opened (taste vs missing Example).
- `effect-ontology/Service/LlmProvider.ts` — two type-level exports with useful prose; Example optional.
- Barrels `effect-ontology/Service/index.ts`, `Agent/index.ts`, `LlmControl/index.ts` — `@packageDocumentation` + `@since 0.0.0`, no owning exports. Leads are thin (`Service Layer Exports`) but documenting barrels as symbols is rejected.

No `@example` / `@remarks` / `@module` / `@template`, no `@effected/*` imports, no named `Schema`/`Option`/`Array` example imports, no undescribed `@see` (the four `@see` hits include purpose phrases). Module headers all have `@packageDocumentation` and `@since 0.0.0` (census 0 open modules confirmed).

## Pack verdict

- files reviewed: 78
- owning exports reviewed: 470 (census owning; 5 of those are local `export { Name }` graph edges, not true owning declarations)
- confirmed mechanical items: 1
- editorial items: 83
- rejected false positives: 5
- accepted findings: 84
