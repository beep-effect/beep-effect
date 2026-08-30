# Round 2 JSDoc inventory — ontology-runtime + ontology-rest

Independent editorial re-review after round-1 fixes. Mechanical census is
already `openModuleCount: 0` / `openOwningExportCount: 0`. Zero `@example` /
`@remarks` / `@module` / `@template`. Hunt list: residual placeholder
Examples, illegal headings, wrong `@category`.

Pack slices:

| Pack | modules | owning exports |
| --- | ---: | ---: |
| ontology-runtime (`Runtime`, `Cluster`, `Workflow`, `Schema`) | 40 | 210 |
| ontology-rest (`Cli`, `Contract`, `Prompt`, `Repository`, `Utils`, `Telemetry`, `drizzle.config.ts`, package `index.ts`) | 56 | 356 |

Every exporting module in both slices was opened. Binding law:
`.patterns/jsdoc-documentation.md`.

## Rejected (not re-opened)

- Census graph edges (`export { ... }`, `export default JobPushRouter`,
  `Utils/IdempotencyKey.ts` `export { IdempotencyKey }`). Document the owning
  declaration.
- `drizzle.config.ts` default export — Kit config, not public API. Module
  header already has a useful lead, `@packageDocumentation`, `@since 0.0.0`.
- Taste-only titles (`Inspect …`, `Use …`, `**Example** (Usage)`) when the
  fence already calls the symbol with realistic inputs
  (`generateStructuredPrompt`, `buildCaseInsensitiveIriMap`, `getPricing`).
- Durable activity constructors that build a real `Activity.make` input and
  log `activity.name` (`makeResolutionActivity`,
  `makeStreamingExtractionActivity`, siblings). Round-1 prescribed that
  observation.
- Cluster RPC `_tag` logs (`ExtractFromTextRpc._tag`). Round-1 prescribed.
- Repository table Examples that assert job-bearing keys (`"uri" in
  Articles.fields`). Round-1 prescribed.
- `S.is(ArticleFilter)({ ontologyId, limit: 10 })` and other `S.is` fences
  with populated payloads.
- `CircuitState.Options` — LiteralKit closed-set observation, not
  `console.log(fn)`.
- `storageCommand` / `workflowCommand` subcommand-name maps — they read
  `command.subcommands`, not only the parent identity.
- Type-level exports with prose only (Example optional).
- Canonical role tags that survived R1 (`endpoints` on routers,
  `cli-commands` on commands, `tables` on Drizzle models, `protocols` on
  RPCs, `type-level` on same-name type companions). No topology leftovers
  (`exports` / `core` / `modules`). No `S.Class` still tagged `type-level`.
- Illegal section headings (`**Note**`, `**Cloud-Native Architecture:**`,
  `**Usage**` as a body heading). None remain. `**documentType**` inside
  `DurableActivities` classification prompt text is implementation, not
  JSDoc grammar.

## Notes

- Round-1 fixers replaced `console.log(fn)` with a compile trick:
  `const documented = [symbol, "literal"] as const; console.log(documented[1])`.
  That is the same defect class as `void x`: the observable value is a
  string the author typed, not a result of the symbol.
- `Layer.isLayer` / `Effect.isEffect` remaining fences are tautologies.
  Several construct a realistic program and then throw the result away.

---

## Accepted findings

### ontology-runtime-R2-001: `documented = [symbol, literal]` compile-trick Examples

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Example quality: “shows the symbol doing its actual job with realistic inputs”; “A void-discarded value is a compile trick, not documentation”)
- `affectedFiles`: scratchpad/effect-ontology/Runtime/AssetRouter.ts:35, scratchpad/effect-ontology/Runtime/AuthRouter.ts:152, scratchpad/effect-ontology/Runtime/ImageRouter.ts:52, scratchpad/effect-ontology/Runtime/LinkIngestionRouter.ts:96, scratchpad/effect-ontology/Runtime/JobPushHandler.ts:193, scratchpad/effect-ontology/Runtime/InferenceRouter.ts:396, scratchpad/effect-ontology/Runtime/HttpServer.ts:364, scratchpad/effect-ontology/Runtime/HttpServer.ts:657, scratchpad/effect-ontology/Runtime/HttpServer.ts:1049, scratchpad/effect-ontology/Runtime/HttpServer.ts:1094, scratchpad/effect-ontology/Runtime/HttpServer.ts:1142, scratchpad/effect-ontology/Runtime/HttpServer.ts:1190, scratchpad/effect-ontology/Runtime/HttpServer.ts:1219, scratchpad/effect-ontology/Runtime/HttpServer.ts:1299, scratchpad/effect-ontology/Runtime/HttpServer.ts:1316, scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts:545, scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts:562, scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts:599, scratchpad/effect-ontology/Runtime/HttpMiddleware.ts:97, scratchpad/effect-ontology/Runtime/HttpMiddleware.ts:179, scratchpad/effect-ontology/Runtime/ClusterRuntime.ts:20, scratchpad/effect-ontology/Runtime/ClusterRuntime.ts:44, scratchpad/effect-ontology/Runtime/ClusterRuntime.ts:81, scratchpad/effect-ontology/Runtime/ClusterRuntime.ts:105, scratchpad/effect-ontology/Runtime/ClusterRuntime.ts:125, scratchpad/effect-ontology/Runtime/ClusterRuntime.ts:156, scratchpad/effect-ontology/Runtime/EmbeddingLayers.ts:55, scratchpad/effect-ontology/Runtime/EmbeddingLayers.ts:100, scratchpad/effect-ontology/Runtime/EmbeddingLayers.ts:139, scratchpad/effect-ontology/Runtime/EmbeddingLayers.ts:166, scratchpad/effect-ontology/Runtime/EmbeddingLayers.ts:203, scratchpad/effect-ontology/Runtime/EmbeddingLayers.ts:238, scratchpad/effect-ontology/Runtime/ProductionRuntime.ts:134, scratchpad/effect-ontology/Runtime/ProductionRuntime.ts:168, scratchpad/effect-ontology/Runtime/ProductionRuntime.ts:196, scratchpad/effect-ontology/Runtime/ProductionRuntime.ts:224, scratchpad/effect-ontology/Runtime/ProductionRuntime.ts:248, scratchpad/effect-ontology/Runtime/ProductionRuntime.ts:288, scratchpad/effect-ontology/Runtime/EventBridge.ts:182, scratchpad/effect-ontology/Runtime/EventBridge.ts:204, scratchpad/effect-ontology/Runtime/RateLimitedLanguageModel.ts:173, scratchpad/effect-ontology/Runtime/RateLimitedLanguageModel.ts:216, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:271, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:354, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:388, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:418, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:453, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:523, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:548, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:575, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:597, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:118, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:188, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:206, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:224, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:243, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:274, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:302, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:328, scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts:358, scratchpad/effect-ontology/Runtime/Persistence/DatabaseReady.ts:23, scratchpad/effect-ontology/Runtime/Persistence/MigrationRunner.ts:65, scratchpad/effect-ontology/Cluster/ExtractionEntityHandler.ts:522, scratchpad/effect-ontology/Workflow/StreamingExtraction.ts:170, scratchpad/effect-ontology/Workflow/StreamingExtraction.ts:819
- `symbol`: AssetRouter, AuthRouter, ImageRouter, LinkIngestionRouter, JobPushRouter, InferenceRouter, TimelineRouter, SearchRouter, ExtractionRouter, HealthRouter, OntologyRouter, ApiRouter, ApiRouterWithoutRepositories, HttpServerLive, HttpServerWithoutRepositoriesLive, EventBroadcastHubPubSub, EventBroadcastHubLive, EventBroadcastRouter, makeAuthMiddleware, makeShutdownMiddleware, ClusterRuntime (module), ClusterSqliteLive, ClusterWithSqlClient, ClusterShardingConfigFromEnv, ClusterSqliteLiveFromEnv, ClusterAutoLiveFromEnv, EmbeddingProviderFromConfig, EmbeddingRateLimiterFromConfig, NomicEmbeddingInfrastructure, VoyageEmbeddingInfrastructure, EmbeddingInfrastructure, EmbeddingInfrastructureDefault, makeLanguageModelLayer, ExtractionLayersLive, TracingLive, ProductionLayersWithTracing, LlmControlLive, ProductionInfrastructure, EventBridgeLive, EventBridgeAutoStart, RateLimitedAnthropicClientLayer, RateLimitedOpenAiClientLayer, CrossBatchEntityResolverBundle, ActivityDependenciesLayer, BatchExtractionWorkflowWithDepsLayer, WorkflowOrchestratorFullLayer, CliExtractionLayer, NlpBundleOpen, EmbeddingBundleOpen, RdfBuilderBundleOpen, StorageBundleOpen, PostgresConfigFromEnv, PgClientLive, DrizzleLive, PgDrizzleLive, DatabaseReadyLive, MessageStorageLive, RunnerStorageLive, ShardingConfigLive, PostgresPersistenceLive, databaseReady, migrateOnBoot, ExtractionEntityHandlerLayer, makeExtractionWorkflow, ExtractionWorkflowLive
- `kind`: value
- `evidence`: Canonical residual after R1. Every listed fence stuffs the export into an unused tuple beside a string/tag the author typed, then logs the literal (or `documented[1] !== undefined`, which is always true for an imported binding). Worst cases: `ClusterSqliteLive({ filename: "output/cluster.db" })` is constructed and then the filename is re-logged from the tuple, not from the layer; `makeAuthMiddleware` is paired with `401` and only `Effect.isEffect` is asserted; `PostgresConfigFromEnv` logs `"POSTGRES_PASSWORD"` without decoding config; `RateLimitedAnthropicClientLayer` logs `"createMessage"` after a ternary that does not consult `ConfigService`; `ProductionInfrastructure` builds `ServerLive` with Bun/HTTP and then logs `8080` from the tuple. Contrast `PgClientLayerFromConfig`, which actually decodes `PostgresConfig` and maps it through the constructor. `InferenceRouterDefinition` (line 185) is a non-export — do not document it; the owning export at 396 is the public subject.
- `impact`: Hover docs typecheck and census-green while teaching nothing the signature does not already say. Callers still cannot see remaining requirements, route merge, env decoding, or middleware status codes as results of the symbol.
- `suggestedFix`: Delete the `documented` tuple. Keep path/env names in Details. Observe the symbol: decode `PostgresConfig`; `Layer.provide` / `Layer.mergeAll` against a real sibling and assert remaining requirements or inequality; run `Effect.exit` on middleware/auth programs; `ConfigProvider.fromUnknown({ ONTOLOGY_PATH })` into `makeCliExtractionLayer`. `ClusterRuntime` module header should drop its Example (modules are not value-level).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R2-002: Effect.isEffect / Layer.isLayer tautologies after a real setup

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (vacuous Example: no observable result)
- `affectedFiles`: scratchpad/effect-ontology/Cluster/ExtractionEntityHandler.ts:163, scratchpad/effect-ontology/Runtime/EventBridge.ts:69, scratchpad/effect-ontology/Runtime/HealthCheck.ts:144, scratchpad/effect-ontology/Runtime/LlmSemaphore.ts:73, scratchpad/effect-ontology/Runtime/HttpMiddleware.ts:209, scratchpad/effect-ontology/Runtime/TestRuntime.ts:273, scratchpad/effect-ontology/Runtime/Persistence/MigrationRunner.ts:37, scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts:761, scratchpad/effect-ontology/Runtime/WorkflowLayers.ts:488
- `symbol`: makeExtractionEntityHandler, EventBridgeService, HealthCheckService, LlmSemaphoreService, makeLoggingMiddleware, TestLayers, migrateFromFolder, broadcastDomainEvent, makeCliExtractionLayer
- `kind`: value
- `evidence`: These fences do more than `console.log(fn)` — they yield a service method, wrap `withPermit(Effect.succeed("ok"))`, `Effect.provide(TestLayers)`, or `makeCliExtractionLayer(customProvider)` — then the only assertion is `Effect.isEffect` / `Layer.isLayer` / `O.map(program, Effect.isEffect)`. `broadcastDomainEvent` decodes a realistic `EventEntry` and never runs the broadcast. `HealthCheckService.liveness()` is built with `.Default` and never executed. Titles claim 401/503/permit wrapping that the fence does not observe. Do not double-count symbols already listed in R2-001 (`makeAuthMiddleware`, `databaseReady`, `makeExtractionWorkflow`) even though they also `isEffect`.
- `impact`: Callers of health, semaphore, logging middleware, and CLI extraction still never see a probe payload, a permit result, a 503, or a remaining-requirement hole.
- `suggestedFix`: Run or inspect the program: `Effect.runSync(Effect.exit(...))` for liveness/permit; log `migrateFromFolder(migrationsFolder)` only after showing the folder string already documented on `migrationsFolder`; for `makeCliExtractionLayer`, keep the `ConfigProvider.fromUnknown({ ONTOLOGY_PATH })` setup and observe the returned layer by providing it into a tiny `Effect.void` or logging a remaining-requirement tag. For `broadcastDomainEvent`, either `Effect.isEffect(broadcastDomainEvent(entry))` after `O.getOrThrow` with a successful decode, or drop `isEffect` and show `_tag`/`ontologyId` from the decoded entry (the helper’s input job) plus that the returned value is an Effect — not `O.map(..., Effect.isEffect)` of an Option.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R2-003: EventBroadcast schema/type Examples still dummy

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (placeholder Examples; type-level Example if present must obey Example grammar)
- `affectedFiles`: scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts:87, scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts:112, scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts:155
- `symbol`: BroadcastEvent (type), PingMessage, ConnectedMessage
- `kind`: value
- `evidence`: Value schemas `PingMessage` / `ConnectedMessage` still `console.log(S.is(Schema)({}))` with no expected outcome (always false: required `type` tag missing). Type companion `BroadcastEvent` defines `readOntology` and logs the function identity — unused binding, no call. Sibling type `PingMessage` already constructs `PingMessage.make({ timestamp })` and logs `0`; copy that shape.
- `impact`: Empty-object `S.is` was R1-013’s exact defect. Callers never see a ping timestamp or connected `serverId`. The type-level Example, being present, must teach narrowing and currently does not.
- `suggestedFix`: `PingMessage.make({ timestamp: NonNegativeInt.make(0) })`; `ConnectedMessage.make({ type: "connected", ontologyId, serverId, timestamp })`. On the type companion, either drop the Example or call `readOntology(message)` after a make. Do not keep `S.is({})`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R2-001: Repository live-layer Examples only `Layer.isLayer`

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (vacuous Example)
- `affectedFiles`: scratchpad/effect-ontology/Repository/index.ts:63, scratchpad/effect-ontology/Repository/index.ts:87, scratchpad/effect-ontology/Repository/index.ts:105, scratchpad/effect-ontology/Repository/index.ts:123, scratchpad/effect-ontology/Repository/index.ts:142, scratchpad/effect-ontology/Repository/index.ts:160, scratchpad/effect-ontology/Repository/index.ts:182, scratchpad/effect-ontology/Repository/index.ts:204, scratchpad/effect-ontology/Repository/index.ts:237, scratchpad/effect-ontology/Repository/index.ts:273
- `symbol`: DrizzleLive, PgClientLive, DrizzleWithPgLive, ClaimRepositoryLive, ConflictRepositoryLive, ArticleRepositoryLive, EntityRegistryRepositoryLive, EmbeddingRepositoryLive, RepositoriesLive, makeTestRepositoriesLayer
- `kind`: value
- `evidence`: Every live-layer Example is `console.log(Layer.isLayer(x)) // true`. `makeTestRepositoriesLayer({ host, port, database, username, password })` is the one fence that passes realistic config, then still only `isLayer`. `RepositoriesLive` merge is constructed and then `isLayer(composed) && isLayer(RepositoriesLive)`. Round-1 R1-035 closed this as “layers constructed”; observation is still the tautology R1 called out on `EntityRegistryRepository`.
- `impact`: Ten sibling layers are indistinguishable in hovers. Callers cannot see Postgres env vs explicit test config vs pgvector Gotchas as results.
- `suggestedFix`: One observable difference per layer: `makeTestRepositoriesLayer` logs the explicit `host`/`database` used; `RepositoriesLive` vs a single `ClaimRepositoryLive` inequality; `PgClientLive` remaining-requirement / described `@see` to `POSTGRES_PASSWORD` already in Gotchas. Do not leave `Layer.isLayer` as the only statement.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R2-002: `S.is(Schema)({})` dummy schema Examples

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (placeholder Examples; empty-object `S.is` is always false for required fields)
- `affectedFiles`: scratchpad/effect-ontology/Utils/ClaimFactory.ts:254, scratchpad/effect-ontology/Repository/Conflict.ts:47, scratchpad/effect-ontology/Repository/Claim.ts:151, scratchpad/effect-ontology/Repository/Examples.ts:160
- `symbol`: ClaimData, ConflictRecord, CorrectionChainEntry, ScoredExample
- `kind`: value
- `evidence`: All four fences are `console.log(S.is(X)({})) // false`. Titles say “Reject an incomplete …”. That is a compile trick: `{}` fails any required-field struct. Contrast `ConflictCandidate`, which uses `{ conflictType: "position" }` (still incomplete, but names a real field). `ClaimData` additionally jams the fence onto the Example heading with no blank line — grammar-legal, still dummy.
- `impact`: Hover never shows a valid `claimId` join, ordered claim pair, or scored retrieval hit — the reason these types exist.
- `suggestedFix`: Construct with `X.make` / decode a minimal valid payload (ClaimData needs `claimId` plus CreateClaimInput fields; ScoredExample needs `id`/`ontologyId`/score). Optionally keep one `S.is(X)({}) // false` only if a second observation shows a passing payload. Prefer one titled Example with success + failure like the `UserName` template.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R2-003: `runCli` Example logs `typeof` and never uses argv

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (placeholder `console.log(fn)` class; unused binding)
- `affectedFiles`: scratchpad/effect-ontology/Cli/index.ts:133
- `symbol`: runCli
- `kind`: value
- `evidence`: Fence builds a realistic argv vector (`effect-onto extract ontologies/people.ttl --text "Ada Lovelace was a mathematician"`) then `console.log(typeof runCli) // "function"` and `console.log(argv[1]) // "extract"`. `runCli` is never called. This is the textbook residual placeholder plus an unused argv binding.
- `impact`: The root runner’s job (dispatch extract through `CliLive`, Postgres-gated LinkIngestion Gotcha) is invisible. Callers cannot tell `runCli` from any other exported function.
- `suggestedFix`: Keep the argv vector. Observe something about `runCli` other than `typeof`: e.g. that it is the same arity as `Command.run` expects, or compose `runCli(argv)` without executing the process (if that typechecks as an Effect, log `Effect.isEffect` is still weak — prefer not launching; document that the returned Effect is the CLI program). Smallest honest fix: drop `typeof` and show `runCli.length` / named parameters if any, plus that `argv` is the vector `runCli` consumes. Do not leave `typeof runCli`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R2-004: CLI command Examples only log `.name` / `.description`

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (placeholder Examples; argv belongs in the fence, not only in comments)
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Extract.ts:272, scratchpad/effect-ontology/Cli/Commands/Fetch.ts:147, scratchpad/effect-ontology/Cli/Commands/Fetch.ts:241, scratchpad/effect-ontology/Cli/Commands/Fetch.ts:353, scratchpad/effect-ontology/Cli/Commands/Fetch.ts:454, scratchpad/effect-ontology/Cli/Commands/Inference.ts:96, scratchpad/effect-ontology/Cli/Commands/Ingest.ts:197, scratchpad/effect-ontology/Cli/Commands/Link.ts:184, scratchpad/effect-ontology/Cli/Commands/Reconcile.ts:294
- `symbol`: extractCommand, fetchCommand, ingestLinkCommand, documentsCommand, ingestBatchCommand, inferenceCommand, ingestCommand, linkCommand, reconcileCommand
- `kind`: value
- `evidence`: Each fence is `console.log(command.name)` plus `command.description`, with the user-facing argv left in `//` comments (`--text`, `--file`, `--input`, `--delta-only`, `--wikidata-id`, `--batch-id`). Names are observable but identity-level. Round-1 suggested “flag listing that names ontology / text / file” as code. `storageCommand` / `workflowCommand` already map `subcommands` — copy that pattern for parent commands that have flags instead of children.
- `impact`: Extract vs ingest vs fetch vs ingest-link remain distinguished only by the string `"extract"` / `"ingest"`. Hover does not prove `--text` versus `--file` exist as typed options.
- `suggestedFix`: Keep `.name`. Replace comment argv with an observation of the command config: option names from the command’s parsed config object if exposed, or a `Command` descriptor listing (`ontology`, `text`, `file`). Do not execute the handler (FS/network). Do not only `console.log(command)`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R2-005: QuadDelta / ClaimFactory still `Effect.isEffect` without the result

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (vacuous Example)
- `affectedFiles`: scratchpad/effect-ontology/Utils/QuadDelta.ts:103, scratchpad/effect-ontology/Utils/ClaimFactory.ts:396
- `symbol`: computeQuadDelta, checkIriCollisions
- `kind`: value
- `evidence`: `computeQuadDelta(store, store)` on two empty datasets then `Effect.isEffect(delta) // true` — never runs, so the identity delta (`deltaCount === 0`) is unshown. Sibling `groupDeltaByPredicate` / `filterTypeInferences` / `summarizeDelta` already construct `QuadDelta.make({ newQuads: [], … })` and log `0`; `computeQuadDelta` should match after `Effect.runSync`. `checkIriCollisions([], "https://example.com/entity/")` is only `Effect.isEffect`. Title “Create an empty collision check” never shows the yielded entities array.
- `impact`: The only Effect-returning helpers in these files hide the empty-delta / empty-entity identity they exist to compute.
- `suggestedFix`: `Effect.runSync(computeQuadDelta(store, store))` and log `deltaCount` / `newQuads.length // 0`. `Effect.runSync(checkIriCollisions([], base))` and log `length // 0`. Keep empty inputs; they are valid identity cases once observed.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Files reviewed with no accepted finding

Leads, canonical `@category`, and Examples that call the symbol with realistic
inputs (or type-level prose only):

**ontology-runtime:** `Cluster/BackpressureHandler.ts`, `Cluster/ExtractionEntity.ts`,
`Cluster/index.ts`, `Runtime/CircuitBreaker.ts`, `Runtime/Shutdown.ts`,
`Runtime/index.ts`, `Runtime/Persistence/index.ts`, `Schema/EntityFactory.ts`,
`Schema/RelationFactory.ts`, `Schema/MentionFactory.ts`, `Schema/index.ts`,
`Workflow/DurableActivities.ts`, `Workflow/EntityResolution.ts`,
`Workflow/EntityResolutionGraph.ts`, `Workflow/Merge.ts`,
`Workflow/StreamingExtractionActivity.ts`, `Workflow/index.ts`.
`TestConfigProvider` in `Runtime/TestRuntime.ts` is clean; `TestLayers` is R2-002.

**ontology-rest:** `Cli/ErrorHandler.ts`, `Cli/Commands/Storage.ts`,
`Cli/Commands/Workflow.ts`, `Prompt/Doc.ts`, `Prompt/ExtractionRule.ts`,
`Prompt/FeedbackGenerator.ts`, `Prompt/SchemaGenerator.ts`,
`Prompt/RuleSet.ts`, `Prompt/PromptGenerator.ts` (Usage titles are taste;
bodies call the generators), `Prompt/index.ts`, `Contract/ProgressStreaming.ts`,
`Contract/index.ts`, `Telemetry/CostCalculator.ts`, `Telemetry/Metrics.ts`,
`Telemetry/Tracing.ts`, `Telemetry/TracingContext.ts`,
`Telemetry/LlmAttributes.ts`, `Telemetry/ExtractionTelemetry.ts`,
`Telemetry/index.ts`, `Utils/Dual.ts`, `Utils/Entity.ts`, `Utils/String.ts`,
`Utils/RefineKG.ts`, `Utils/Hash.ts`, `Utils/Iri.ts`, `Utils/Provenance.ts`,
`Utils/Similarity.ts`, `Utils/Retrieval.ts`, `Utils/Text.ts`,
`Utils/Datatype.ts`, `Utils/Sql.ts`, `Utils/Rdf.ts`, `Utils/Activity.ts`,
`Utils/IdempotencyKey.ts` (owning helpers; re-export edge rejected),
`Utils/index.ts`, `Repository/schema.ts`, `Repository/Article.ts`,
`Repository/CachedArticle.ts`, `Repository/CachedClaim.ts`,
`Repository/Embedding.ts`, `Repository/EntityRegistry.ts`,
package `index.ts`. `drizzle.config.ts` — note only.

Other files in the slices were reviewed; findings are the items above.

## Pack verdict

- files reviewed: 96
- owning exports reviewed: 566
- confirmed mechanical items: 0
- editorial items: 8
- rejected false positives: 14 (re-exports, drizzle default, taste titles, R1-prescribed `_tag` / table-key / activity-name observations, optional type-level Examples, canonical categories)
- accepted findings: 8

Illegal headings: 0. Wrong `@category`: 0. Residual work is placeholder
Examples: the R1 `documented = [symbol, literal]` compile trick,
`Layer.isLayer` / `Effect.isEffect` tautologies, `S.is({})`, `typeof runCli`,
and CLI `.name` logs with argv left in comments.
