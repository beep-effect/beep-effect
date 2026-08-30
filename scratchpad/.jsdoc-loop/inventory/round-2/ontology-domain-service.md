# Round 2 inventory: ontology-domain + ontology-service

Independent read-only re-review of `scratchpad/effect-ontology/Domain/` and
`scratchpad/effect-ontology/Service/` against `.patterns/jsdoc-documentation.md`.
Mechanical census after round-1 fixes is `openModuleCount: 0`,
`openOwningExportCount: 0`. This round hunts residual **typeof-function**,
**Layer.isLayer**, **unused-binding** Examples, and **contradictory Details**.
Graph-edge re-exports were not opened as documentation subjects.

Hunt results:

| Pattern | Domain | Service |
| --- | --- | --- |
| `typeof x === "function"` / `console.log(typeof Symbol)` | none | `PubSubClientConfig` interface |
| `Layer.isLayer(...)` | none | none |
| unused-binding accessor (`const f = (x) => x.field; console.log(f)`) | none | `Correction` type companion |
| contradictory Details | none | `PromptCache` module header vs runtime |

Additional editorial leftovers that fail the titled-Example quality bar
(value-level Examples that never construct or decode the symbol) remain in
GraphRAG, RelationLinker, and EventBus. OntologyAgent `ExtractionResult` /
`ExtractWithClaimsResult` extra `S.is({}) // false` fences sit beside a real
decode Example and were **not** re-opened (REVIEW-BRIEF: extra Examples when
one observable Example already exists).

`fixerGroup` is the owning pack (`ontology-domain` or `ontology-service`).

## Rejected false positives

Census `exportKind: re-export` / local `export { Foo }` graph edges. Do not
invent barrel Examples:

| Census / statement | Owner |
| --- | --- |
| `Domain/Schema/Batch.ts` `export { ValidationPolicy }` | `Domain/Schema/Shacl.ts` |
| `Domain/Schema/LinkIngestion.ts` `export { HttpUrl }` | `@beep/ontology/Ontology.models` |
| `Domain/Schema/Timeline.ts` `export { ClaimRank }` | `Domain/Schema/KnowledgeModel.ts` |
| `Service/EntityIndex.ts` `export { cosineSimilarity }` | `Service/EmbeddingProvider.ts` |
| `Service/Extraction.ts` `export type { Mention }` | `Schema/MentionFactory.ts` |
| `Service/Shacl.ts` `export { ShaclValidationReport, ValidationPolicy }` | `Domain/Schema/Shacl.ts` |
| `Service/WorkflowOrchestrator.ts` `export { BatchWorkflowPayload }` | `Domain/Schema/Batch.ts` |

Barrel `export *` Examples on `Domain/index.ts`, `Error/index.ts`,
`Model/index.ts`, `Rdf/index.ts`, `Schema/index.ts`, `Service/index.ts`,
`Agent/index.ts`, and `LlmControl/index.ts` were not opened as new symbols.

---

### ontology-domain-service-R2-001: PubSubClientConfig residual typeof-function + non-Effect Config Example

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Service/PubSubClient.ts:88; scratchpad/effect-ontology/Service/PubSubClient.ts:189
- `symbol`: PubSubClientConfig (interface), PubSubClientConfig (Config value)
- `kind`: type | value
- `evidence`: Same-name interface and `Config.all` value. The interface Example is `import type { PubSubClientConfig }` plus `import { PubSubClientConfig }` then `console.log(typeof PubSubClientConfig)` — residual typeof-function; the value import binds the later Config object, so hover on the interface documents `typeof` of a Config, not the contract. The value Example is `Effect.withConfigProvider(PubSubClientConfig, ConfigProvider.fromUnknown({}))`. Effect v4 has no `Effect.withConfigProvider`; Configs are Effects yielded after `ConfigProvider.layer(...)`. Round-1 residual called this combinator out; it is still the only value-level Example.
- `impact`: Callers hovering either symbol never see `projectId` / topic defaults, and the value Example cannot compile under the docgen TypeScript gate.
- `suggestedFix`: Delete the interface Example (type-level is optional) or bind a decoded config object and log `projectId`. On the Config value, `Effect.runSync(Effect.provide(PubSubClientConfig, ConfigProvider.layer(ConfigProvider.fromUnknown({}))))` (or yield it) and log a default field. Do not log `typeof`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-service-R2-002: GraphRAG leftover reject-only / keyof / contradictory title Examples

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Service/GraphRAG.ts:83; scratchpad/effect-ontology/Service/GraphRAG.ts:196; scratchpad/effect-ontology/Service/GraphRAG.ts:341; scratchpad/effect-ontology/Service/GraphRAG.ts:369; scratchpad/effect-ontology/Service/GraphRAG.ts:396; scratchpad/effect-ontology/Service/GraphRAG.ts:516
- `symbol`: ScoredNode, RetrievalResult, GroundedAnswer, ReasoningStep, ReasoningTrace, GraphRAGService
- `kind`: value | type
- `evidence`: Round-1 residual: `RetrievalResult` / `GroundedAnswer` / `ReasoningStep` / `ReasoningTrace` still only `console.log(S.is(X)({})) // false`. Sibling `RetrievalStats` / options already `.make` realistic values. `ScoredNode` was upgraded to `.make` + `node.isSeed // true` but the title is still **Example** (Reject an incomplete scored node); it also `import { Entity, EntityId } from "@effect-ontology/Model/Entity"` and `Entity.ts` does not export `EntityId` (`@effect-ontology/Model/shared` does). `GraphRAGService` type Example is `const operation: keyof GraphRAGService = "retrieve"; console.log(operation) // "retrieve"` — the tautology round-1 deleted from OntologyAgent type companions. Service/Default Examples now compose `Effect.provide` and are acceptable.
- `impact`: Value-level retrieval/answer/trace DTOs never show citations, hop distance, or a subgraph. The upgraded ScoredNode fence contradicts its title and likely fails docgen on `EntityId`. The service interface hover teaches a string literal, not retrieve/answer.
- `suggestedFix`: `.make` a minimal `RetrievalResult` / `GroundedAnswer` / `ReasoningStep` / `ReasoningTrace` (reuse the ScoredNode/RetrievalStats fixtures) and log an observable field. Retitle ScoredNode to construction and import `EntityId` from `@effect-ontology/Model/shared`. Delete the `GraphRAGService` keyof Example (type-level is optional) or compose `retrieve` on a stub. Do not add extra Examples on already-good options classes.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-service-R2-003: Correction type companion unused-binding Example

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Service/Agent/CorrectorAgent.ts:242
- `symbol`: Correction
- `kind`: type
- `evidence`: Same-name type companion Example is `const strategy = (correction: Correction): Correction["strategy"] => correction.strategy` then `console.log(strategy)` — unapplied accessor, residual unused-binding. The runtime `Correction` const already constructs `Correction.cases.skip.make` and logs `correction.strategy // "skip"`.
- `impact`: Type hover shows a function object, not a tagged strategy. Type-level Example is optional; a present placeholder is still a defect.
- `suggestedFix`: Delete the type-level Example; keep the described lead/`@see` if added. Do not clone the runtime skip-construction fence.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-service-R2-004: PromptCache module Details still claim Anthropic caching

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Service/PromptCache.ts:5
- `symbol`: (module)
- `kind`: module
- `evidence`: Round-1 `ontology-service-R1-074` closed `makeCachedPrompt` by stating the helper does not attach `cache_control` and that `enableCaching` is ignored. The `@packageDocumentation` Details still say "Utilities for building Prompt objects with Anthropic prompt caching support. Separates cacheable system messages from variable user messages." Implementation remains `Prompt.fromMessages([...])` with `_enableCaching` unused. The `makeCachedPrompt` Example still passes `true` as the third argument while only logging `prompt.content.length // 2`.
- `impact`: File hover still tells callers Anthropic prompt caching is wired. It is not. The per-symbol Gotcha is contradicted by the module lead.
- `suggestedFix`: Rewrite the module Details to two-message Prompt construction without claiming caching. Optionally have the Example pass `true` and log that no `cache_control` metadata is present, matching the existing Gotcha. Do not document `cache_control` until runtime applies it.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-service-R2-005: LinkedRelation reject-only Example on a value class

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Service/RelationLinker.ts:30
- `symbol`: LinkedRelation
- `kind`: value
- `evidence`: Required class Example is only `console.log(S.is(LinkedRelation)({})) // false`. `@category type-level` on an `S.Class` (role is models, not type-level). Sibling `LinkingResult.make({ linkedRelations: Chunk.empty(), remappedCount: 0, literalObjectCount: 0 })` already shows construction. Service Example composes `RelationLinker.Default` and is acceptable.
- `impact`: Canonical subject/object remapping flags never appear. Hover cannot distinguish a linked relation from an empty object reject.
- `suggestedFix`: `.make` a fixture `Relation` with canonical IDs and log `subjectRemapped` / `canonicalSubjectId`. Recategorize to `models`. Keep `LinkingResult`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-service-R2-006: EventBus JobWithMetadata / EventEntry reject-only Examples

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Service/EventBus.ts:41; scratchpad/effect-ontology/Service/EventBus.ts:68
- `symbol`: JobWithMetadata, EventEntry
- `kind`: value
- `evidence`: `JobWithMetadata` is titled **Example** (Attach queue metadata) but only `S.is(JobWithMetadata)({ id: "queue-1", attempts: -1 }) // false` — no `job`, so it never teaches the attempts check or attachment. `@category type-level` on an `S.Class`. `EventEntry` is only `S.is(EventEntry)({}) // false`; Domain `OntologyEventEntry` already decodes a `ClaimCorrected` journal row. `EventBusServiceMethods` stub is acceptable for a type-level interface.
- `impact`: Queue identity/retry attempts and journal event tags never appear at the service boundary.
- `suggestedFix`: `JobWithMetadata.make` with a `BackgroundJob` plus `attempts: 0` and log `attempts` (and optionally a negative-attempts reject beside it). Decode/`S.is` a realistic `OntologyEventEntry` payload on `EventEntry` and log `event`. Recategorize `JobWithMetadata` to `models`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Not opened

- Extra reject-only fences on Domain `ExtractionResult` / `ExtractWithClaimsResult` that already have a success decode Example.
- EmbeddingCache `Embedding` `S.is([0.12, -0.4, 0.88]) // true` plus `S.is({}) // false` (both outcomes).
- Type-level interface Examples that bind and read a realistic object (`CreateAssertionInput`, `IngestOptions`, `StageRetrievalOptions`, …).
- Service layers that compose `Effect.provide(Default)` and `console.log(program)` without `runSync` (network/LLM). Not unused-binding; not `Layer.isLayer`.
- `cosineSimilarity` / `PersistentEmbeddingCache.clear` / `BatchExtractionWorkflow` Gotchas added in round 1; implementation still matches.

## Pack verdict

- files reviewed: 133 (55 domain + 78 service)
- owning exports reviewed: 1046 (576 domain + 470 service)
- confirmed mechanical items: 0
- editorial items: 6
- rejected false positives: 8 (re-export graph edges) plus extra OntologyAgent reject fences
- accepted findings: 6

ontology-domain has **0** residual typeof-function, Layer.isLayer, unused-binding, or contradictory Details findings. All accepted items are in ontology-service.
