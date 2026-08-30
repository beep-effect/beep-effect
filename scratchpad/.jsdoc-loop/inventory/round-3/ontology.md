# Round 3 inventory: effect-ontology

Independent editorial re-review of `scratchpad/effect-ontology/**`
(excluding `test/` and `docs/`) against `.patterns/jsdoc-documentation.md`.
Mechanical census is `openModuleCount: 0` / `openOwningExportCount: 0`.
Zero `@example` / `@remarks` / `@module` / `@template`. Round-2
ontology-service and ontology-runtime-rest items were verified closed on
disk. Domain had no accepted R2 items for that round's hunt list
(typeof-function, `Layer.isLayer`, unused-binding, contradictory Details).

This round does not re-open closed mechanical misses, R2-prescribed
observations (`Layer.provide` inequality, CLI `Command.runWith` + argv,
`activity.name`, RPC `_tag`, table-key `"uri" in fields`), extra
reject-only `S.is({})` fences beside a success decode, or barrel
`export *` graph edges.

`drizzle.config.ts` is census-excluded and is not public API.

## R2 fix verification

| Round-2 item | Status |
| --- | --- |
| ontology-domain-service-R2-001 PubSubClientConfig | closed — interface Example deleted; Config value `runSync`s defaults |
| ontology-domain-service-R2-002 GraphRAG | closed — `.make` fixtures; `EntityId` from `Model/shared`; `keyof` Example gone |
| ontology-domain-service-R2-003 Correction type companion | closed — Example deleted; runtime skip-construction kept |
| ontology-domain-service-R2-004 PromptCache module | closed — Details deny `cache_control`; Example logs absence |
| ontology-domain-service-R2-005 LinkedRelation | closed — remapped `.make`; `@category models` |
| ontology-domain-service-R2-006 EventBus DTOs | closed — `JobWithMetadata.make`; `EventEntry` decodes `ClaimCorrected` |
| ontology-runtime-R2-001 `documented` tuples | closed — no `documented =` remains |
| ontology-runtime-R2-002 `isEffect` / `isLayer` | closed — `Layer.isLayer` is gone; middleware/health run |
| ontology-runtime-R2-003 EventBroadcast schemas | closed — `PingMessage` / `ConnectedMessage` `.make` |
| ontology-rest-R2-001 repository live layers | closed — sibling inequality |
| ontology-rest-R2-002 `S.is({})` schemas | closed — success payload plus optional reject |
| ontology-rest-R2-003 `runCli` typeof | closed — `runCli.length` + argv |
| ontology-rest-R2-004 CLI `.name` only | closed — `Command.runWith` + flag argv |
| ontology-rest-R2-005 QuadDelta / collisions | closed — `runSync` logs `deltaCount` / `length // 0` |

## Rejected (not opened)

- `drizzle.config.ts` default export — Kit config, not public API. Module
  header already has a useful lead, `@packageDocumentation`, `@since 0.0.0`.
- `server.ts`, `cli.ts`, `Runtime/ActivityRunner.ts`, and `scripts/*` — no
  owning exports. Module headers exist; they are process entry points, not
  the public surface.
- Census / local `export { Foo }` and `export *` barrel edges
  (`Domain/index.ts`, `Error/index.ts`, `Model/index.ts`, `Schema/index.ts`,
  `Rdf/index.ts`, service/runtime barrels). Document the owner.
- Extra `S.is({}) // false` on `ExtractionResult` / `ExtractWithClaimsResult`
  / `ClaimData` / `ConflictRecord` / `CorrectionChainEntry` / `ScoredExample`
  / `Embedding` that already have a success observation (REVIEW-BRIEF).
- `LlmAttributes` `typeof annotate // "object"` — R1 rest fixer residual:
  helpers stay unrun so they do not require a tracer; fences already compose
  realistic attrs and log keys / cost / truncation length.
- Repository service `typeof counts // "object"` and Article
  `inspectPeople.pipe !== undefined` — R1 residual: Postgres Effects are
  composed, not executed. R2 listed `Article.ts` / `CachedArticle.ts` /
  `Embedding.ts` / `EntityRegistry.ts` as clean under that policy.
- `EventBusServiceMethods` / `Agent` interface stubs that bind a realistic
  object then `Effect.isEffect` — type-level Example optional; R2 accepted
  the EventBus stub.
- Taste titles (`**Example** (Use X)`) when the fence already calls the
  symbol (`PathLayout`, Utils, Prompt generators).
- `@see {@link https://… | Google Cloud Storage …}` on `GcsBucket` /
  `GcsObject` — link title describes the target; not a bare `@see`.
- Canonical `@category type-level` on same-name type companions and
  `.Encoded` aliases.

---

### ontology-R3-001: ErrorRecoverySemantics unused-binding + typeof-function

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Contract/ProgressStreaming.ts:2063
- `symbol`: ErrorRecoverySemantics
- `kind`: value
- `evidence`: Value-level `S.Class` Example is `import type { ErrorRecoverySemantics }`, then `const streamEnds = (semantics: ErrorRecoverySemantics): true => semantics.clientCancellation.streamEnds` and `console.log(typeof streamEnds) // "function"`. Unused accessor plus residual typeof-function (R1 domain/rest and R2-001 hunt). The class is never constructed. Sibling `ErrorRecoverySemanticsSpec` already `.make`s the canonical fixture and logs `contentErrors.continuesWithNextChunk` / `systemicErrors.streamEnds`.
- `impact`: Hover never shows that client cancellation ends the stream with partial results. Callers cannot tell the protocol class from an unapplied getter.
- `suggestedFix`: `ErrorRecoverySemantics.make` (reuse the Spec payload) and log `clientCancellation.streamEnds // true`. Delete the unused accessor. Keep `ErrorRecoverySemanticsSpec`. Do not log `typeof`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-R3-002: CoreOntology / OntologyEmbeddings identifier Examples only `Effect.isEffect`

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/CoreOntology.ts:208; scratchpad/effect-ontology/Domain/Model/CoreOntology.ts:364; scratchpad/effect-ontology/Domain/Model/CoreOntology.ts:481; scratchpad/effect-ontology/Domain/Model/OntologyEmbeddings.ts:238
- `symbol`: MentionId, CanonicalEntityId, EventId, OntologyEmbeddings
- `kind`: value
- `evidence`: Required value-level Examples call `MentionId.fromCoordinates("doc-1", 0, 5)`, `CanonicalEntityId.fromSeed("Bruce Harrell")`, `EventId.fromSeed("announcement-2026-07-25")`, and `OntologyEmbeddings.computeVersion("@prefix …")`, then only `console.log(Effect.isEffect(...))`. `@invariant` on the three identifiers is `` `mention-` / `entity-` / `event-` plus 12 hex ``; that form never appears. Same tautology class as runtime R2-002. Type companions already `MentionId.make("mention-a1b2c3d4e5f6")`. `OntologyEmbeddings` also `O.map`s `storagePathFor` with no expected URI; `computeVersion` is the leftover `isEffect`.
- `impact`: Hover does not teach the digest identifier the statics exist to produce. Callers cannot distinguish `fromCoordinates` from any other `Effect.fn`.
- `suggestedFix`: Prefer observing the branded form: `MentionId.is("mention-a1b2c3d4e5f6") // true` and a failing input. If `fromCoordinates` / `fromSeed` stay in the fence, `Effect.runSync` (provide a tracer only if `Effect.fn` / `withSpan` requires it) and log `Str.startsWith("mention-")` / 12-hex length. For `OntologyEmbeddings`, log the `storagePathFor` URI (`…ontology.ttl` → `…-embeddings.json`) and drop `isEffect` unless `computeVersion` is actually run to a 64-char digest.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-R3-003: Nineteen Service `S.Class` values still tagged `@category type-level`

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Category annotation: choose the symbol's semantic role; `type-level` is for aliases/interfaces/`.Encoded` companions)
- `affectedFiles`: scratchpad/effect-ontology/Service/Claim.ts:75; scratchpad/effect-ontology/Service/Claim.ts:119; scratchpad/effect-ontology/Service/ClaimPersistence.ts:47; scratchpad/effect-ontology/Service/ClaimPersistence.ts:82; scratchpad/effect-ontology/Service/CurationJobProcessor.ts:63; scratchpad/effect-ontology/Service/EmbeddingCircuitBreaker.ts:80; scratchpad/effect-ontology/Service/EmbeddingCircuitBreaker.ts:111; scratchpad/effect-ontology/Service/EmbeddingFallback.ts:51; scratchpad/effect-ontology/Service/EmbeddingFallback.ts:78; scratchpad/effect-ontology/Service/EmbeddingProvider.ts:118; scratchpad/effect-ontology/Service/EmbeddingProvider.ts:144; scratchpad/effect-ontology/Service/EmbeddingRateLimiter.ts:48; scratchpad/effect-ontology/Service/ImageFetcher.ts:109; scratchpad/effect-ontology/Service/JinaReaderClient.ts:49; scratchpad/effect-ontology/Service/JinaReaderClient.ts:103; scratchpad/effect-ontology/Service/ProgressStreaming.ts:111; scratchpad/effect-ontology/Service/ProgressStreaming.ts:909; scratchpad/effect-ontology/Service/Storage.ts:144; scratchpad/effect-ontology/Service/VoyageEmbeddingProvider.ts:324
- `symbol`: CreateClaimInput, DeprecationResult, ArticleMetadata, PersistenceResult, JobProcessingStats, ProviderCircuitConfig, CircuitStatus, FallbackChainConfig, ActiveProviderInfo, EmbeddingRequest, ProviderMetadata, EmbeddingRateLimiterConfig, ImageFetchOptions, FetchOptions, JinaResponse, ProgressBuilderState, BackpressureState, ObjectWithGeneration, VoyageProviderConfig
- `kind`: value
- `evidence`: Each is `export class … extends S.Class` with a titled, observable `.make` Example, then `@category type-level`. R2 recategorized `LinkedRelation` and `JobWithMetadata` from `type-level` to `models` on the files it already touched; this sweep did not run. Runtime/rest/Domain have no remaining `S.Class` tagged `type-level` (R2 rest verified their slices). Same-name `*Input` type companions in these files correctly stay `type-level`.
- `impact`: Runtime constructors are indexed under type-level. Callers scanning models/configuration miss claim payloads, Jina fetch options, and Voyage credentials.
- `suggestedFix`: Recategorize each class to `models`, or `configuration` for `*Config` / `*Options`. Do not retag the type companions. Do not add extra Examples — the fences already construct realistic values.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Pack verdict

- files reviewed: 228 exporting modules (55 domain + 78 service + 40 runtime + 55 rest) plus `drizzle.config.ts`, `server.ts`, `cli.ts`, `Runtime/ActivityRunner.ts`, and four `scripts/*` (no owning exports)
- owning exports reviewed: 1590 (569 domain + 465 service + 202 runtime + 354 rest)
- confirmed mechanical items: 0
- editorial items: 3
- rejected false positives: drizzle default; barrel re-exports; extra `S.is({})`; LlmAttributes / repository unrun-Effect typeof; type-level stubs; R2-prescribed layer/CLI/activity observations; entry scripts without exports
- accepted findings: 3

Illegal headings: 0. Legacy carriers: 0. `Layer.isLayer` / `documented = [symbol, literal]`: 0.
`drizzle.config.ts` is not public API.
