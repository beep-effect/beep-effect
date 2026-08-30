# Pack ontology-runtime — round 1 JSDoc review

Read-only review of slice modules under `effect-ontology/{Runtime,Cluster,Workflow,Schema}`. Census reported 0 open modules and 12 open owning exports. Those 12 are local `export { ... }` / `export default` graph edges and are rejected below. Remaining work is editorial: placeholder Examples, signature-echo leads, kind/category mismatches, orphaned JSDoc, and missing `$I.annoteSchema` / same-name type aliases.

Binding law: `.patterns/jsdoc-documentation.md`, `.agents/skills/jsdoc-annotation-specialist/references/conventions.md`, `references/annotation-patterns.md`.

## Rejected census findings

Census treated these as owning `value` exports missing `@category` / `@since` / `@example`. They are re-export graph edges. Do not invent new doc blocks. Document the owning declaration.

| Census row | Why rejected |
| --- | --- |
| `effect-ontology/Runtime/JobPushHandler.ts:305` `default` | `export default JobPushRouter` aliases the already-documented `JobPushRouter` const. Same class as `export { default }`. Delete the leftover “Export the router” comment; do not complete tags on the default. |
| `effect-ontology/Runtime/ProductionRuntime.ts:50-58` `CentralRateLimiterServiceLive`, `DEFAULT_SHUTDOWN_CONFIG`, `ExtractionRouter`, `HealthCheckService`, `LlmSemaphoreService`, `ShutdownError`, `ShutdownService`, `StageTimeoutServiceLive`, `TokenBudgetServiceLive` | Local `export { ... }` of names imported from `./HealthCheck.ts`, `./HttpServer.ts`, `./LlmSemaphore.ts`, `./Shutdown.ts`, and `../Service/LlmControl`. Contrast the earlier `export { ... } from "..."` at line 42, which census already classified as `re-export` with empty findings. |
| `effect-ontology/Runtime/WorkflowLayers.ts:597` `ConfigService`, `ConfigServiceDefault` | `export { ConfigService, ConfigServiceDefault }` re-exports imports from `../Service/Config.ts`. |

The slice also lists true barrels (`Cluster/index.ts`, `Runtime/index.ts`, `Runtime/Persistence/index.ts`, `Schema/index.ts`, `Workflow/index.ts`) and other `export { ... } from` edges (`ExtractionEntity.ts:27`, `CircuitBreaker.ts:334`, `PostgresLayer.ts:28`) as `kind: re-export` with empty findings — correctly ignored.

## Accepted findings

### ontology-runtime-R1-001: Vacuous Examples on BackpressureHandler value exports

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Cluster/BackpressureHandler.ts:53,171,283
- `symbol`: BackpressureConfig, withBackpressure, withBackpressureMetered
- `kind`: value
- `evidence`: Placeholder `console.log(BackpressureConfig)` / `console.log(withBackpressureMetered)`. `withBackpressure` only wraps `Stream.empty` and asserts `Stream.isStream(controlled) // true`. Law forbids `import { fn } from "..."; console.log(fn)` and requires the symbol doing its job with realistic inputs (critical vs sampled events). Type-level `ExtractionProgressEvent` example only logs `["_tag"]`.
- `impact`: Callers cannot see which events always pass, when sampling starts, or how metrics differ from `withBackpressure`.
- `suggestedFix`: Construct `BackpressureConfig.make`, feed a small tagged event stream, and show a delivered critical event versus a dropped non-critical one; for the metered form log `eventsDropped`. Drop or replace the type-level keyof stub.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-002: Backpressure operators tagged as services

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Cluster/BackpressureHandler.ts:168,280
- `symbol`: withBackpressure, withBackpressureMetered
- `kind`: value
- `evidence`: `@category services` on stream combinators (no Context.Service). Canonical role is `combinators` or `streams`.
- `impact`: Docgen grouping puts operators with runtime services; callers hunt the wrong catalog.
- `suggestedFix`: Use `@category combinators` (or `streams`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-003: Vacuous Examples on ExtractionEntity RPCs and schemas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Cluster/ExtractionEntity.ts:42,232,257,277,309,350,384
- `symbol`: ExtractFromTextPayload, ExtractFromTextRpc, GetCachedResultRpc, CancelExtractionRpc, ExtractionStatus, GetExtractionStatusRpc, KnowledgeGraphExtractor
- `kind`: value
- `evidence`: Schema Examples are `S.is(Schema)({})` with no expected outcome. RPC/service Examples are `console.log(ExtractFromTextRpc)` (and siblings). Type companions decode `{}` then map through `_value => "valid ..."`.
- `impact`: Empty-object `S.is` is always false for required payloads; RPCs never show stream-vs-unary or cache-miss `None`.
- `suggestedFix`: Decode a realistic `ExtractFromTextPayload`, show `ExtractionStatus` pending vs complete, and for RPCs log `ExtractFromTextRpc._tag` / stream flag rather than the function identity.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-004: ExtractionEntity exported structs lack `$I.annoteSchema` and described `@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Cluster/ExtractionEntity.ts:48,99,141,180,315
- `symbol`: ExtractFromTextPayload, ExtractionSummary, GetCachedResultPayload, KnowledgeGraphResult, ExtractionStatus
- `kind`: value
- `evidence`: Exported `S.Struct` / `S.Union` values have JSDoc but no `$I.annoteSchema`. Same-name type aliases use “Describes the X data exposed by this module” and omit `@see {@link Schema} for the runtime schema...`.
- `impact`: Schema identity/description never reach generated JSON Schema; type aliases do not point callers at the decoder.
- `suggestedFix`: `.pipe($I.annoteSchema("Name", { description }))` on each exported non-class schema; rewrite type-companion leads and add described `@see`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-005: ExtractionEntityHandler placeholder lead and Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Cluster/ExtractionEntityHandler.ts:147,494
- `symbol`: makeExtractionEntityHandler, ExtractionEntityHandlerLayer
- `kind`: value
- `evidence`: Leads “Validates and represents make extraction entity handler values at runtime” / “Provides the Effect layer for extraction entity handler layer dependencies.” Examples `console.log(makeExtractionEntityHandler)` and `console.log(ExtractionEntityHandlerLayer)`.
- `impact`: Hover docs restate the name; callers never see cluster entity wiring or `orDie` on handler construction.
- `suggestedFix`: Lead with the Cluster entity handler job (idempotent extract / cache / cancel). Example: `Layer.isLayer(ExtractionEntityHandlerLayer)` is still tautological — compose `KnowledgeGraphExtractor` and show a method name, or document providing the layer beside `ClusterSqliteLive`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-006: AssetRouter false Layer.isLayer Example, echo lead, topology category

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/AssetRouter.ts:28
- `symbol`: AssetRouter
- `kind`: value
- `evidence`: Lead “Validates and represents asset router values at runtime.” Example `console.log(Layer.isLayer(AssetRouter)) // true` but `AssetRouter` is `HttpRouter.addAll([...])`, not a Layer — the `// true` assertion is false. `@category layers`.
- `impact`: Callers may `Layer.provide(AssetRouter)` and fail to typecheck; docs assert a lie.
- `suggestedFix`: Lead as the raw-asset HTTP surface. Example a route path or `HttpRouter` merge. `@category endpoints`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-007: AuthRouter / ImageRouter / LinkIngestionRouter placeholder router docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/AuthRouter.ts:145, effect-ontology/Runtime/ImageRouter.ts:45, effect-ontology/Runtime/LinkIngestionRouter.ts:89
- `symbol`: AuthRouter, ImageRouter, LinkIngestionRouter
- `kind`: value
- `evidence`: Identical lead “Exposes X router for composition by callers of this module.” Identical Example `console.log(X)`. `@category services` on HTTP routers. `LinkIngestionBackgroundTasks` already has a real provide/fork Example — the router does not.
- `impact`: Three public HTTP surfaces document as opaque values; category dumps them with Context services.
- `suggestedFix`: Lead with the actual routes (`POST /v1/auth/ticket`, image GET, `POST .../batches/from-links`). Observable Example: path list or a schema-validated body. `@category endpoints`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-008: Vacuous Examples on CircuitBreaker runtime values

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/CircuitBreaker.ts:88,132,163
- `symbol`: CircuitBreakerConfig, DEFAULT_CIRCUIT_CONFIG, makeCircuitBreaker
- `kind`: value
- `evidence`: Class `CircuitBreakerConfig` is documented as a type contract (`acceptsCircuitBreakerConfig = (_value) => undefined`). `console.log(DEFAULT_CIRCUIT_CONFIG)` and `console.log(makeCircuitBreaker)` never trip closed/open/half_open. `CircuitState.Options` on the schema is acceptable; keep it.
- `impact`: The module exists to fail-fast LLM calls; Examples never show `CircuitOpenError` or a state transition.
- `suggestedFix`: `CircuitBreakerConfig.make({})`, run `makeCircuitBreaker` under a test layer, force failures past `maxFailures`, and observe `getState()` / `CircuitOpenError`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-009: Orphaned CircuitState JSDoc and type-level category on a class

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/CircuitBreaker.ts:30,84,101,314
- `symbol`: CircuitState, CircuitBreakerConfig, CircuitBreaker
- `kind`: value
- `evidence`: Consecutive `/**` blocks at lines 30 and 47 — TS attaches only the second to `export const CircuitState`. The first “Use the CircuitState contract” stub is dead. `CircuitBreakerConfig` class has `@category type-level`. Type alias `CircuitBreaker` uses the void-accept stub.
- `impact`: Hover on `CircuitState` never shows the orphaned contract block; a runtime class is catalogued as a type.
- `suggestedFix`: Delete the orphaned block. `@category models` (or `configuration`) on `CircuitBreakerConfig`. Drop or replace type-level stubs with a described `@see` to `makeCircuitBreaker`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-010: Vacuous ClusterRuntime Examples including the module header

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/ClusterRuntime.ts:11,33,68,90,109,139
- `symbol`: ClusterSqliteLive, ClusterWithSqlClient, ClusterShardingConfigFromEnv, ClusterSqliteLiveFromEnv, ClusterAutoLiveFromEnv
- `kind`: value
- `evidence`: Module header Example logs both factories. Each export is `console.log(ClusterSqliteLive)` (identity of a factory, not a constructed layer). `ClusterWithSqlClient` / `ClusterShardingConfigFromEnv` use `@category services` while they return layers.
- `impact`: Callers cannot choose sqlite-dev vs injected SQL vs env sharding from the Examples.
- `suggestedFix`: Show `ClusterSqliteLive({ filename: "output/cluster.db" })` composed with a handler layer. `@category layers` on the two mis-tagged factories. Remove the module-header Example or make it the chooser (`if (useSqlite) ClusterSqliteLive() else ClusterWithSqlClient()`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-011: Vacuous EmbeddingLayers Examples; ConfigService provide is an undocumentated Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/EmbeddingLayers.ts:43,86,122,146,181,214
- `symbol`: EmbeddingProviderFromConfig, EmbeddingRateLimiterFromConfig, NomicEmbeddingInfrastructure, VoyageEmbeddingInfrastructure, EmbeddingInfrastructure, EmbeddingInfrastructureDefault
- `kind`: value
- `evidence`: Every Example is `console.log(Symbol)`. Implementation comments warn “CRITICAL: The returned layer needs ConfigService, so we provide it here” and Nomic vs Voyage requirement unions — not in Gotchas.
- `impact`: Callers pick Nomic/Voyage stacks without seeing leftover requirements after unwrap.
- `suggestedFix`: One Example per public layer that logs `Layer.successors` / remaining requirements, or compose `EmbeddingInfrastructureDefault` with `ConfigService`. Move the ConfigService unwrap invariant into `**Gotchas**` on `EmbeddingProviderFromConfig`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-012: Vacuous EventBridge Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/EventBridge.ts:35,68,86,174,195
- `symbol`: EventBridgeServiceMethods, EventBridgeService, EventBridgeError, EventBridgeLive, EventBridgeAutoStart
- `kind`: value
- `evidence`: Type stub `acceptsEventBridgeServiceMethods`. Values `console.log(EventBridgeService)`, `console.log(EventBridgeError.make)` (constructor identity, not a constructed error), `console.log(EventBridgeLive)`. Lead on the service is “Provides the event bridge service service capability.”
- `impact`: Callers never see `start` / `stop` or setup-vs-runtime `phase`.
- `suggestedFix`: Construct `EventBridgeError.make({ phase: "setup", message: "...", cause })`. For the layer, provide hub+bus test doubles and assert the service tag. Rewrite the service lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-013: Vacuous / misleading EventBroadcast hub and helper Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/EventBroadcastRouter.ts:283,322,512,528,544,580,721
- `symbol`: EventBroadcastHub, EventBroadcastConfig, EventBroadcastHubMemory, EventBroadcastHubPubSub, EventBroadcastHubLive, EventBroadcastRouter, broadcastDomainEvent
- `kind`: value
- `evidence`: Hubs/router are `console.log(Symbol)`. `broadcastDomainEvent` Example is `console.log(Effect.isEffect(broadcastDomainEvent)) // false` — `Effect.fn` is not itself an Effect, so the Example teaches “this is not an Effect.” Envelope schemas (`BroadcastEvent`, `PingMessage`, `ConnectedMessage`) already have meaningful Examples; leave those.
- `impact`: Callers may skip yielding `broadcastDomainEvent(entry)` and treat it as a plain function.
- `suggestedFix`: Call `broadcastDomainEvent` with a fixture `EventEntry` and assert `Effect.isEffect(...)` on the returned effect. For hubs, show `EventBroadcastHubMemory` provided into a small `subscribe` program. `@category configuration` on `EventBroadcastConfig` (currently `services`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-014: EventBroadcastRouter non-canonical module section, ServerMessage annotation gap, formulaic leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/EventBroadcastRouter.ts:9,214,220,281,320
- `symbol`: ServerMessage, EventBroadcastHub, EventBroadcastConfig
- `kind`: value
- `evidence`: Module body uses `**Cloud-Native Architecture:**`, which is not in the When/Details/Gotchas/Example grammar. `ServerMessage` union has no `$I.annoteSchema`. Leads “Exposes event broadcast hub/config for composition…” and “Describes the server message data…”.
- `impact`: Pub/Sub fan-out semantics hide under an illegal heading; the union has no schema identity.
- `suggestedFix`: Fold architecture into Details/Gotchas. Annotate `ServerMessage`. Rewrite hub/config/type leads; add described `@see` on the type companion (the other three companions already have it).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-015: HealthCheck service/result Examples and category; orphaned JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/HealthCheck.ts:27,121,147
- `symbol`: HealthResult, HealthCheckService
- `kind`: value
- `evidence`: Orphaned type-stub block (lines 27–43) immediately before `HealthStatus`. `HealthResult` Example is `console.log(HealthResult)`. `HealthCheckService` lead “HealthCheckService - Liveness and readiness probes” restates the name; Example `console.log(HealthCheckService)`; `@category layers` on a `Context.Service` class. `HealthStatus` / `HealthCheckStatus` `.Options` Examples are acceptable.
- `impact`: Probe methods never appear; service is filed under layers.
- `suggestedFix`: Delete the orphan. Construct `HealthResult.make({ status: "ok", timestamp: "..." })`. Example `HealthCheckService` via `.Default` and `liveness`/`readiness`. `@category services`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-016: Vacuous HttpMiddleware Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/HttpMiddleware.ts:30,84,163,190
- `symbol`: CurrentConflictActor, makeAuthMiddleware, makeShutdownMiddleware, makeLoggingMiddleware
- `kind`: value
- `evidence`: All four Examples `console.log` the symbol. Auth/shutdown Details mention API-key vs drain behavior that the Examples never demonstrate.
- `impact`: Callers cannot see how anonymous actor, 401, or shutdown 503 are produced.
- `suggestedFix`: Show `CurrentConflictActor` provided with `ConflictActor.make`. For middleware, apply to a tiny `HttpApp` and assert a 401 without a key vs 503 after `initiateShutdown`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-017: HttpServer routers: echo leads, vacuous Examples, `@category schemas`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/HttpServer.ts:357,649,1040,1084,1131,1178,1206,1285,1301
- `symbol`: TimelineRouter, SearchRouter, ExtractionRouter, HealthRouter, OntologyRouter, ApiRouter, ApiRouterWithoutRepositories, HttpServerLive, HttpServerWithoutRepositoriesLive
- `kind`: value
- `evidence`: Leads are the bulk templates (“Validates and represents timeline router values at runtime”, “Exposes X for composition”, “Provides the Effect layer for http server live dependencies”). Examples `console.log(TimelineRouter)` (and siblings). First five routers `@category schemas`. Module lead “Public effect-ontology APIs for runtime/http server” is topology.
- `impact`: The public HTTP API is catalogued as schemas; Examples never name a path.
- `suggestedFix`: Per-router lead naming the routes. `@category endpoints` for routers, `layers` for `HttpServerLive*`. Example at least one path or merge into `ApiRouter`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-018: InferenceRouter vacuous Examples and router tagged as a layer

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/InferenceRouter.ts:47,67,112,148,358
- `symbol`: InferenceJobStore, InferenceJobStoreLive, InferenceExecutionError, InferenceRouter
- `kind`: value
- `evidence`: `console.log(InferenceJobStore)`, `console.log(InferenceExecutionError.make)`, `console.log(InferenceRouter)` twice (const definition + `export const InferenceRouter = InferenceRouterDefinition`). `@category layers` on the router. Details already list POST/GET paths the Example ignores.
- `impact`: Job-store vs router vs typed failure are indistinguishable in hovers.
- `suggestedFix`: Construct `InferenceExecutionError.make({ stage: "parse", message, cause })`. `@category endpoints` on `InferenceRouter`. Show `put`/`get` on a memory store.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-019: JobPushRouter placeholder docs, wrong category, missing retry Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/JobPushHandler.ts:173,305
- `symbol`: JobPushRouter
- `kind`: value
- `evidence`: Lead “Job Push Handler Router” restates the name. Example `console.log(JobPushRouter)`. `@category schemas`. Implementation comments “Return 400 to not retry on job schema errors” / “Return 500 to trigger retry” are not in Gotchas. Default export JSDoc “Export the router” is a graph-edge leftover.
- `impact`: Pub/Sub subscribers will retry parse failures if they copy a 200-only mental model; docs never mention 400 vs 500.
- `suggestedFix`: Lead as the Pub/Sub push ingress. `**Gotchas**` for 400 (no retry) vs 500 (retry). Example the health GET or a parse-failure status. `@category endpoints`. Remove the default JSDoc.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-020: Vacuous LlmSemaphore Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/LlmSemaphore.ts:24,58
- `symbol`: SemaphoreTimeoutError, LlmSemaphoreService
- `kind`: value
- `evidence`: `console.log(SemaphoreTimeoutError)` and `console.log(LlmSemaphoreService)`. Service Details say “wrap LLM calls” but never show `withPermits` / timeout.
- `impact`: Callers do not see how waitDuration is populated or how to wrap a call.
- `suggestedFix`: `SemaphoreTimeoutError.make({ message, waitDuration: Duration.seconds(5) })`. Service Example: `Effect.provide(LlmSemaphoreService.Default)` around a dummy LLM effect.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-021: Vacuous Persistence Examples (databaseReady, migrate*, Postgres layers)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/Persistence/DatabaseReady.ts:16, effect-ontology/Runtime/Persistence/MigrationRunner.ts:30,56, effect-ontology/Runtime/Persistence/PostgresLayer.ts:37,102,129,157,173,189,206,236,263,287,315,334
- `symbol`: databaseReady, migrateFromFolder, migrateOnBoot, PostgresConfig, PostgresConfigFromEnv, PgClientLayerFromConfig, PgClientLive, DrizzleLive, PgDrizzleLive, DatabaseReadyLive, MessageStorageLive, RunnerStorageLive, ShardingConfigLive, PostgresPersistenceLive, PostgresPersistenceFromConfig
- `kind`: value
- `evidence`: `console.log(databaseReady)`, `console.log(migrateFromFolder)`, `console.log(migrateOnBoot)`, and the same identity log for every Postgres layer. `PostgresConfig` uses `S.is(PostgresConfig)({})` (always false; password is redacted). `migrationsFolder.endsWith("/migrations")` is acceptable — keep. `PostgresConfig` lead is “Validates and represents postgres config values at runtime.” `@category services` on Effect.fn runners.
- `impact`: Startup composition (client → drizzle → migrate → message/runner storage) never appears.
- `suggestedFix`: Decode a realistic `PostgresConfig`. Show `migrateOnBoot` as `databaseReady`’s second step. Layer Examples: `Layer.mergeAll(PgClientLive, DrizzleLive)` or remaining requirements. `@category constructors` or `layers` as appropriate.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-022: PostgresConfig missing `$I.annoteSchema`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Runtime/Persistence/PostgresLayer.ts:49
- `symbol`: PostgresConfig
- `kind`: value
- `evidence`: Exported `S.Struct` piped only through `withEffectCodecStatics`. Type companion uses the formulaic “Describes the postgres config data…” lead and a void-accept Example, with no `@see`.
- `impact`: No schema identity; type alias does not send callers to the decoder (ssl default, redacted password).
- `suggestedFix`: `$I.annoteSchema("PostgresConfig", { description })`. Type companion: described `@see`, no Example unless it decodes a real config.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-023: ProductionRuntime placeholder Examples, orphaned useful Example, illegal **Note**

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/ProductionRuntime.ts:9,64,120,154,181,209,222,259,279
- `symbol`: UnsupportedLlmProviderError, makeLanguageModelLayer, ExtractionLayersLive, TracingLive, ProductionLayersWithTracing, LlmControlLive, ProductionInfrastructure
- `kind`: value
- `evidence`: Value Examples are `console.log(Symbol)` or `Layer.isLayer(x) // true`. Consecutive JSDoc at 222–248 (production infrastructure + BunHttpServer composition) is orphaned; the attached `LlmControlLive` block is a different Example. Module uses `**Note**: LanguageModel.LanguageModel must be provided separately` — not Details/Gotchas. `ProductionInfrastructure` lead is “Exposes production infrastructure for composition…”.
- `impact`: The one Example that actually launches a server is detached from every export. The LanguageModel requirement is easy to miss.
- `suggestedFix`: Attach the BunHttpServer composition to `ProductionInfrastructure`. Move the LanguageModel requirement into Gotchas. Construct `UnsupportedLlmProviderError.make({ provider: "google" })`. Drop tautological `Layer.isLayer`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-024: Vacuous RateLimitedLanguageModel Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/RateLimitedLanguageModel.ts:165,202
- `symbol`: RateLimitedAnthropicClientLayer, RateLimitedOpenAiClientLayer
- `kind`: value
- `evidence`: `console.log(RateLimitedAnthropicClientLayer)` / OpenAI sibling. Callers must choose between them from provider config (see `makeLanguageModelLayer`) but neither Example nor `@see` says so.
- `impact`: Wrong adapter layer is a silent runtime miss once ConfigService selects the other vendor.
- `suggestedFix`: Example wrapping a dummy `createMessage` through the layer. Described `@see` to `makeLanguageModelLayer` and the sibling adapter.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-025: Shutdown: type-level docs on a class, orphaned makeGracefulShutdown, tags-before-Example, vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/Shutdown.ts:21,50,66,89,114
- `symbol`: ShutdownConfig, DEFAULT_SHUTDOWN_CONFIG, ShutdownError, ShutdownService
- `kind`: value
- `evidence`: `ShutdownConfig` class carries `@category type-level` and a void-accept Example. `console.log(DEFAULT_SHUTDOWN_CONFIG)`, `console.log(ShutdownError)`, `console.log(ShutdownService)`. Orphaned block at 89–112 documents `makeGracefulShutdown` (not exported), puts `@param`/`@returns` before `**Example**`, and uses bare `yield*` (would not compile). `ShutdownService` is `@category layers`.
- `impact`: Drain/reject-during-shutdown contract lives on a dead comment; the live service looks like a Layer tag.
- `suggestedFix`: Delete the orphan (or fold track/initiate/drain into `ShutdownService` Details/Example). `@category models` on `ShutdownConfig`, `services` on `ShutdownService`. Construct `ShutdownError.make({ message })` and show `trackRequest` rejecting after `initiateShutdown`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-026: Vacuous TestRuntime Examples; TestConfigProvider category

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/TestRuntime.ts:96,125,256,288
- `symbol`: TestConfigProvider, MockShaclService, TestLayers, TestRuntime
- `kind`: value
- `evidence`: All four `console.log(Symbol)`. `TestLayers` lead “Exposes test layers for composition…”. `TestConfigProvider` `@category services` (it is a `ConfigProvider`, role `testing`/`fixtures`/`configuration`).
- `impact`: Tests copy `console.log(TestRuntime)` instead of `ManagedRuntime.runPromise` / providing `TestConfigProvider`.
- `suggestedFix`: Show `MockShaclService({ conforms: false })` and `TestRuntime` running a tiny effect. `@category testing` (or `fixtures`) on the provider.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-027: WorkflowLayers: orphaned useful docs, loose `ts` fence, vacuous Examples, wrong category

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/WorkflowLayers.ts:241,299,343,373,402,436,488,511,534,560,580
- `symbol`: CrossBatchEntityResolverBundle, ActivityDependenciesLayer, BatchExtractionWorkflowWithDepsLayer, WorkflowOrchestratorFullLayer, CliExtractionLayer, NlpBundleOpen, EmbeddingBundleOpen, RdfBuilderBundleOpen, StorageBundleOpen
- `kind`: value
- `evidence`: Useful “All services required by workflow activities…” block (299–317) is orphaned before `ReasonerBundle`; attached `ActivityDependenciesLayer` lead is “Provides the Effect layer for activity dependencies layer dependencies.” Open-bundle JSDoc (488–502) contains a fenced `ts` block outside an Example (forbidden). Most Examples `console.log(Layer)`. `RdfBuilderBundleOpen` is `@category services` but is `RdfBuilder.Default` (a layer). `makeCliExtractionLayer` is the only Example that builds a provider — keep and extend. Implementation “CRITICAL: workflow execute yields services that must be available when the layer is constructed” is Details on `BatchExtractionWorkflowWithDepsLayer` (acceptable) but GraphRAG ConfigService comments never become Gotchas.
- `impact`: Callers merge CrossBatch too late or bake ConfigService into test bundles. Loose `ts` fence fails the section grammar if the file is scored as touched.
- `suggestedFix`: Attach the orphaned activity-deps list to `ActivityDependenciesLayer`. Convert the open-bundle fence into a titled Example on `NlpBundleOpen`. `@category layers` on `RdfBuilderBundleOpen`. Replace identity logs with remaining-requirement / `Layer.provide(TestConfigProvider)` compositions.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-028: Runtime and Workflow barrel module leads restate the filename

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Runtime/index.ts:2, effect-ontology/Workflow/index.ts:2
- `symbol`: (module)
- `kind`: module
- `evidence`: Leads “Runtime Layer Exports” and “Workflow Layer Exports” restate the barrel. Contrast `Cluster/index.ts`, `Schema/index.ts`, and `Runtime/Persistence/index.ts`, which state purpose. Headers do have `@packageDocumentation` `@since 0.0.0`.
- `impact`: Barrel hovers do not tell a caller whether HTTP, cluster, or durable activities live here.
- `suggestedFix`: One-sentence purpose (production HTTP/LLM/persistence wiring; durable extraction/resolution/merge activities).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-029: MentionGraph missing `$I.annoteSchema`; vacuous schema/type Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Schema/MentionFactory.ts:62,92
- `symbol`: MentionGraph
- `kind`: value
- `evidence`: `Mention.make` Example is good — keep. `MentionGraph` uses `.annotate({ identifier, title, description })` (LLM JSON-Schema copy) instead of `$I.annoteSchema`. Example `S.is(MentionGraph)({})`. Type companion lead is “Type helpers” with a decode-`{}` stub and no `@see`.
- `impact`: Factory identity is the LLM blob, not the `$I` composer; empty-object `S.is` is false (`mentions` required).
- `suggestedFix`: `.pipe($I.annoteSchema("MentionGraph", { description }))` (retain LLM annotate if still required). Decode `{ mentions: [Mention.make({...})] }`. Type companion: described `@see`, drop Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-030: EntityFactory / RelationFactory type-companion placeholders

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Schema/EntityFactory.ts:176,195, effect-ontology/Schema/RelationFactory.ts:206,225
- `symbol`: EntityGraphSchema, EntityGraph, RelationGraphSchema, RelationGraph
- `kind`: type
- `evidence`: `makeEntitySchema` / `makeRelationSchema` value Examples are compilable and decode realistic graphs — keep. Type companions use “Type helpers” / “Describes the … type data…” and Examples that log `factory.length` or `["entities"]` keys. Kind-split makes type Examples optional; if present they must teach inference, not identity.
- `impact`: Hover on the decoded graph type does not show Stage-1 vs Stage-2 shape.
- `suggestedFix`: Drop type Examples. Leads: “Decoded entity graph produced by {@link makeEntitySchema}.” Described `@see` to the factory.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-031: DurableActivities: placeholder Examples on schemas and activity constructors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Workflow/DurableActivities.ts:115,145,161,182,207,236,441,602,754,981,1035,1243,1349,1386,1438,1596,1626,1679,1814,1854,1886,1922,2077,2238,2315
- `symbol`: ResolutionOutput, ValidationOutput, IngestionOutput, ClaimPersistenceOutput, CrossBatchResolutionOutput, CrossBatchResolutionInput, makeResolutionActivity, makeValidationActivity, makeIngestionActivity, ClaimPersistenceInput, makeClaimPersistenceActivity, makeCrossBatchResolutionActivity, InferenceInput, InferenceOutput, makeInferenceActivity, ComputeEmbeddingsInput, ComputeEmbeddingsOutput, makeComputeEmbeddingsActivity, EntityPair, LlmVerificationInput, VerifiedPair, LlmVerificationOutput, makeLlmVerificationActivity, PreprocessingOutput, makePreprocessingActivity
- `kind`: value
- `evidence`: Schema Examples are `S.is(X)({})` or `console.log(ValidationOutput)`. Class `CrossBatchResolutionInput` is documented as a type contract (`acceptsCrossBatchResolutionInput`). Every `make*Activity` Example is `console.log(makeResolutionActivity)`. Constructor Details already describe pipelines the Examples never run.
- `impact`: Durable activities look like opaque factories; journaled success schemas never show a legal payload.
- `suggestedFix`: Decode one realistic input/output per schema. For constructors, `makeResolutionActivity(input)` and log `activity.name` / success schema. Construct `CrossBatchResolutionInput` with `Class.make`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-032: DurableActivities schema annotation, missing same-name types, wrong categories, module Note

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: effect-ontology/Workflow/DurableActivities.ts:14,127,156,173,194,249,993,1361,1398,1608,1638,1826,1866,1898,1934,2250
- `symbol`: ResolutionOutput, ValidationOutput, IngestionOutput, ClaimPersistenceOutput, CrossBatchResolutionInput, ClaimPersistenceInput, InferenceInput, InferenceOutput, ComputeEmbeddingsInput, ComputeEmbeddingsOutput, EntityPair, LlmVerificationInput, VerifiedPair, LlmVerificationOutput, PreprocessingOutput
- `kind`: value
- `evidence`: Exported `S.Struct`s have no `$I.annoteSchema`. `ResolutionOutput`, `ValidationOutput`, `IngestionOutput`, `ClaimPersistenceOutput` lack same-name `export type`. `ValidationOutput` is `@category workflows` (alias of a DTO). `CrossBatchResolutionInput` class is `@category type-level`. Type companions that exist use “Describes the X data…” and omit `@see`. Module header “Note: These activities require WorkflowEngine…” is an unlabeled Gotcha (standalone vs `Activities.ts`).
- `impact`: Generated schema docs have no identity; callers import `ValidationOutput` thinking it is a workflow. Missing type aliases break `import type` usage.
- `suggestedFix`: Annotate structs; add `export type X = typeof X.Type` after each non-class schema; `@category schemas` on `ValidationOutput`; `@category models` on `CrossBatchResolutionInput`; move the WorkflowEngine requirement into module Gotchas.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-033: EntityResolution: type-level class docs and tautological workflow Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Workflow/EntityResolution.ts:29,74,204
- `symbol`: EntityResolutionConfig, DEFAULT_CONFIG, resolveEntities
- `kind`: value
- `evidence`: `EntityResolutionConfig` class has `@category type-level` and a void-accept Example. `DEFAULT_CONFIG` lead “Exposes default config for composition…” + `console.log(DEFAULT_CONFIG)`. `resolveEntities` runs on an empty graph and only asserts `Effect.isEffect(resolved) // true` — never a merged mention pair (“Eze” / “Eberechi Eze” from the module Details).
- `impact`: The module’s reason to exist (coreference merge) is absent from Examples.
- `suggestedFix`: `@category models` on the class; `EntityResolutionConfig.make`. Example two Person entities with overlapping mentions and `Effect.runSync` the resolved id set.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-034: EntityResolutionGraph Examples only assert Effect.isEffect

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Workflow/EntityResolutionGraph.ts:71,381
- `symbol`: clusterEntities, buildEntityResolutionGraph
- `kind`: value
- `evidence`: `clusterEntities([], [], EntityResolutionConfig.default())` then `Effect.isEffect(clusters) // true`. Same pattern for `buildEntityResolutionGraph`. Details describe embeddings + connected components; Examples pass empty arrays.
- `impact`: Transitive clustering is undocumented at the call site.
- `suggestedFix`: Two similar entities, run the effect under a test embedding layer (or the in-process fallback), log cluster count.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-035: MergeConflict tagged type-level; merge Examples use only empty graphs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Workflow/Merge.ts:46,321,347
- `symbol`: MergeConflict, mergeGraphs, mergeGraphsWithConflicts
- `kind`: value
- `evidence`: `MergeConflict.make` Example is observable — keep. Class is `@category type-level`. `mergeGraphs` / `mergeGraphsWithConflicts` only merge `KnowledgeGraph.make({})` and log `length === 0`. Details already mention functional-property conflicts.
- `impact`: Callers never see an attribute conflict or entity-id merge, which is the reason `mergeGraphsWithConflicts` exists.
- `suggestedFix`: `@category models` (or `errors`) on `MergeConflict`. Second Example: two graphs sharing an entity id with distinct `name` values; assert `conflicts[0].property`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-036: StreamingExtraction vacuous Examples, orphaned service JSDoc, StorageService Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Workflow/StreamingExtraction.ts:162,801,814,846,834
- `symbol`: makeExtractionWorkflow, ExtractionWorkflowLive, ExtractionWorkflowDefault
- `kind`: value
- `evidence`: `makeExtractionWorkflow` lead “Validates and represents make extraction workflow values at runtime” + `console.log(makeExtractionWorkflow)`. Orphaned “ExtractionWorkflow Service” block (801–810) sits on `ExtractionWorkflowLive`. Both layer Examples `console.log`. Comment at 834–835: “StorageService is required by OntologyService.Default but not in its dependencies array” is not a Gotcha.
- `impact`: Callers provide `ExtractionWorkflowLive` without `StorageService` and get a construction-time hole. The service contract JSDoc is detached (the service itself lives in `Service/ExtractionWorkflow.ts`).
- `suggestedFix`: Delete the orphaned service block (or `@see` the service module). Lead `makeExtractionWorkflow` as the 6-phase program constructor. Gotcha on `ExtractionWorkflowLive` for the StorageService provideMerge. Example remaining requirements, not `console.log(layer)`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-runtime-R1-037: StreamingExtractionActivity vacuous Examples on helpers and constructor

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: effect-ontology/Workflow/StreamingExtractionActivity.ts:74,189,263,319
- `symbol`: StreamingExtractionOutput, buildRunConfig, enrichEntityMetadata, makeStreamingExtractionActivity
- `kind`: value
- `evidence`: `S.is(StreamingExtractionOutput)({})`. `console.log(buildRunConfig)`, `console.log(enrichEntityMetadata)`, `console.log(makeStreamingExtractionActivity)`. Output schema is already `$I.annoteSchema`’d — keep that. Type companion at 129 has no `@see`. Details say this replaces legacy `makeExtractionActivity`; no `@see` to that sibling.
- `impact`: Helpers that map batch input → `RunConfig` / provenance never show a worked mapping; callers cannot tell this is the canonical extraction activity.
- `suggestedFix`: Decode a full `StreamingExtractionOutput`. `buildRunConfig` with a fixture input and log `chunking.maxChunkSize` / grounding enabled. `enrichEntityMetadata` on one entity and log `documentId`. Activity: log `name`. Described `@see` on the type alias and to the retired constructor if it remains exported elsewhere.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Files reviewed with no accepted finding

- `effect-ontology/Cluster/index.ts` — useful module lead, `@packageDocumentation`, `@since 0.0.0`; exports are barrels.
- `effect-ontology/Runtime/Persistence/index.ts` — same.
- `effect-ontology/Schema/index.ts` — same.
- `LinkIngestionBackgroundTasks` (value) and `Mention` (value) Examples already construct/provide the symbol; remaining issues in those files are other exports.

## Pack verdict

- files reviewed: 40
- owning exports reviewed: 210
- confirmed mechanical items: 0
- editorial items: 37
- rejected false positives: 12
- accepted findings: 37

Every slice module was opened. The 12 census “open owning” rows are local graph edges (reject). No file in this pack is fully rubric-clean except the three purpose-written barrels above: value-level Examples are overwhelmingly `console.log(symbol)`, `Layer.isLayer` / `Effect.isEffect` tautologies, or `S.is(Schema)({})`, which the quality bar names as defects. Secondary law breaks ride along on the same files (orphaned consecutive JSDoc, `$I.annoteSchema` gaps, type-level `@category` on classes, topology categories on routers, extra `**Note**` / `**Cloud-Native Architecture:**` / loose `ts` fences).
