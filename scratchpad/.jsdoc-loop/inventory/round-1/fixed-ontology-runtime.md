# Pack ontology-runtime — round 1 JSDoc fixes

Editorial pass over `scratchpad/effect-ontology/{Runtime,Cluster,Workflow,Schema}` against
`.patterns/jsdoc-documentation.md`. Census graph-edge opens were left as re-exports.

## Changed files

- `scratchpad/effect-ontology/Cluster/BackpressureHandler.ts`
- `scratchpad/effect-ontology/Cluster/ExtractionEntity.ts`
- `scratchpad/effect-ontology/Cluster/ExtractionEntityHandler.ts`
- `scratchpad/effect-ontology/Runtime/AssetRouter.ts`
- `scratchpad/effect-ontology/Runtime/AuthRouter.ts`
- `scratchpad/effect-ontology/Runtime/ImageRouter.ts`
- `scratchpad/effect-ontology/Runtime/LinkIngestionRouter.ts`
- `scratchpad/effect-ontology/Runtime/CircuitBreaker.ts`
- `scratchpad/effect-ontology/Runtime/ClusterRuntime.ts`
- `scratchpad/effect-ontology/Runtime/EmbeddingLayers.ts`
- `scratchpad/effect-ontology/Runtime/EventBridge.ts`
- `scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts`
- `scratchpad/effect-ontology/Runtime/HealthCheck.ts`
- `scratchpad/effect-ontology/Runtime/HttpMiddleware.ts`
- `scratchpad/effect-ontology/Runtime/HttpServer.ts`
- `scratchpad/effect-ontology/Runtime/InferenceRouter.ts`
- `scratchpad/effect-ontology/Runtime/JobPushHandler.ts`
- `scratchpad/effect-ontology/Runtime/LlmSemaphore.ts`
- `scratchpad/effect-ontology/Runtime/Persistence/DatabaseReady.ts`
- `scratchpad/effect-ontology/Runtime/Persistence/MigrationRunner.ts`
- `scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts`
- `scratchpad/effect-ontology/Runtime/ProductionRuntime.ts`
- `scratchpad/effect-ontology/Runtime/RateLimitedLanguageModel.ts`
- `scratchpad/effect-ontology/Runtime/Shutdown.ts`
- `scratchpad/effect-ontology/Runtime/TestRuntime.ts`
- `scratchpad/effect-ontology/Runtime/WorkflowLayers.ts`
- `scratchpad/effect-ontology/Runtime/index.ts`
- `scratchpad/effect-ontology/Workflow/index.ts`
- `scratchpad/effect-ontology/Schema/MentionFactory.ts`
- `scratchpad/effect-ontology/Schema/EntityFactory.ts`
- `scratchpad/effect-ontology/Schema/RelationFactory.ts`
- `scratchpad/effect-ontology/Workflow/DurableActivities.ts`
- `scratchpad/effect-ontology/Workflow/EntityResolution.ts`
- `scratchpad/effect-ontology/Workflow/EntityResolutionGraph.ts`
- `scratchpad/effect-ontology/Workflow/Merge.ts`
- `scratchpad/effect-ontology/Workflow/StreamingExtraction.ts`
- `scratchpad/effect-ontology/Workflow/StreamingExtractionActivity.ts`

Untouched on purpose (no accepted finding): `Cluster/index.ts`, `Runtime/Persistence/index.ts`, `Schema/index.ts`.

Runtime behavior was not changed. Allowed edits only: JSDoc, `$I.annote` / `$I.annoteSchema`, and missing same-name type aliases.

## Items closed

| ID | Status | What changed |
| --- | --- | --- |
| ontology-runtime-R1-001 | closed | Realistic `BackpressureConfig.make`; critical start event vs metered drop counters. Type-level keyof stubs dropped. |
| ontology-runtime-R1-002 | closed | `withBackpressure` / `withBackpressureMetered` `@category combinators`. |
| ontology-runtime-R1-003 | closed | Payload/status decode Examples; RPC `_tag`; extractor `type`. |
| ontology-runtime-R1-004 | closed | `$I.annoteSchema` on exported structs/union; type companions described `@see`. |
| ontology-runtime-R1-005 | closed | Handler leads describe extract/cache/cancel/status; layer Example wires `ClusterSqliteLive`. |
| ontology-runtime-R1-006 | closed | Asset router lead + route path; `@category endpoints`; `Layer.isLayer` lie removed. |
| ontology-runtime-R1-007 | closed | Auth/Image/Link routers name actual paths; `@category endpoints`. LinkIngestionBackgroundTasks Example kept. |
| ontology-runtime-R1-008 | closed | `CircuitBreakerConfig.make`; `makeCircuitBreaker` opens after one failure. `CircuitState.Options` kept. |
| ontology-runtime-R1-009 | closed | Orphan CircuitState stub deleted; config `@category models`; `CircuitBreaker` type `@see makeCircuitBreaker`. |
| ontology-runtime-R1-010 | closed | Module chooser sqlite vs injected SQL; factories construct layers; `@category layers`. |
| ontology-runtime-R1-011 | closed | ConfigService unwrap **Gotchas** on `EmbeddingProviderFromConfig`; remaining-requirement Examples. |
| ontology-runtime-R1-012 | closed | `EventBridgeError.make({ phase: "setup" })`; service start handle; layer tags. |
| ontology-runtime-R1-013 | closed | Memory hub `getClientCount`; `broadcastDomainEvent(entry)` is an Effect; config `@category configuration`. Envelope Examples kept. |
| ontology-runtime-R1-014 | closed | Cloud architecture folded into module Details; `ServerMessage` `$I.annoteSchema`; hub/config/type leads. |
| ontology-runtime-R1-015 | closed | HealthResult orphan deleted; `HealthResult.make`; service Default + liveness; `@category services`. Options Examples kept. |
| ontology-runtime-R1-016 | closed | `CurrentConflictActor` provideService; middleware Examples name 401/503. |
| ontology-runtime-R1-017 | closed | Per-router path leads; `@category endpoints`; `HttpServerLive*` stay `layers`. |
| ontology-runtime-R1-018 | closed | Job-store put/get; `InferenceExecutionError.make({ stage: "parse" })`; router `@category endpoints`. |
| ontology-runtime-R1-019 | closed | Pub/Sub ingress lead; 400 vs 500 **Gotchas**; health GET Example; default JSDoc removed. |
| ontology-runtime-R1-020 | closed | `SemaphoreTimeoutError.make` with `waitDuration`; `withPermit` around dummy LLM effect. |
| ontology-runtime-R1-021 | closed | Realistic `PostgresConfig` decode; migrateOnBoot as databaseReady step; layer merge Examples; runners `@category constructors`. `migrationsFolder.endsWith` kept. |
| ontology-runtime-R1-022 | closed | `$I.annoteSchema("PostgresConfig")`; type companion described `@see`, no void Example. |
| ontology-runtime-R1-023 | closed | LanguageModel **Gotchas**; `UnsupportedLlmProviderError.make({ provider: "google" })`; BunHttpServer composition attached to `ProductionInfrastructure`; orphan deleted. |
| ontology-runtime-R1-024 | closed | Provider-choice Examples; described `@see` to `makeLanguageModelLayer` and sibling adapter. |
| ontology-runtime-R1-025 | closed | `makeGracefulShutdown` orphan deleted; `ShutdownConfig` `@category models`; `ShutdownService` `@category services`; construct `ShutdownError` and reject after `initiateShutdown`. |
| ontology-runtime-R1-026 | closed | `TestConfigProvider` `@category testing` + Config.string; `MockShaclService({ conforms: false })`; `TestRuntime.runPromise`. |
| ontology-runtime-R1-027 | closed | Activity-deps list attached to `ActivityDependenciesLayer`; open-bundle loose `ts` fence converted to titled Example on `NlpBundleOpen`; `RdfBuilderBundleOpen` `@category layers`. `makeCliExtractionLayer` kept. |
| ontology-runtime-R1-028 | closed | Runtime/Workflow barrel leads state purpose, not filename. |
| ontology-runtime-R1-029 | closed | `MentionGraph` `$I.annoteSchema` (LLM annotate retained); decode `{ mentions: [Mention.make(...)] }`. Mention.make Example kept. |
| ontology-runtime-R1-030 | closed | Entity/Relation type companions: decoded-graph leads + described `@see`; Examples dropped. Factory value Examples kept. |
| ontology-runtime-R1-031 | closed | Realistic decode/construct per schema; `make*Activity` logs `activity.name`; `CrossBatchResolutionInput.make`. |
| ontology-runtime-R1-032 | closed | `$I.annoteSchema` on structs; missing `export type` aliases; `ValidationOutput` `@category schemas`; `CrossBatchResolutionInput` `@category models`; WorkflowEngine module **Gotchas**. |
| ontology-runtime-R1-033 | closed | Config `@category models`; Eze/Eberechi merge via `Effect.runSync(resolveEntities(...))`. |
| ontology-runtime-R1-034 | closed | Two Person entities under a failing embedding layer; log cluster/embedding counts. |
| ontology-runtime-R1-035 | closed | `MergeConflict` `@category models`; shared-id `name` conflict Example. `MergeConflict.make` kept. |
| ontology-runtime-R1-036 | closed | `makeExtractionWorkflow` 6-phase lead; orphaned service block deleted; StorageService **Gotchas** on Live. |
| ontology-runtime-R1-037 | closed | Full `StreamingExtractionOutput` decode; `buildRunConfig` logs `maxChunkSize`/`grounding.mode`; `enrichEntityMetadata` logs `documentId`; activity `name`; type `@see`. Retired `makeExtractionActivity` is not exported. |

Rejected census opens were not documented:

- `JobPushHandler.ts` `export default JobPushRouter` (graph edge; leftover “Export the router” comment deleted)
- `ProductionRuntime.ts` local `export { ... }` of imported names
- `WorkflowLayers.ts` `export { ConfigService, ConfigServiceDefault }`

## Residual risk

- Ontology example compilation was **not executed in this subagent** (no shell tool in the worker). Parent should run the commands below before treating the pack as green.
- Cross-file `{@link}` targets (`makeLanguageModelLayer` from RateLimited adapters, `TestConfigProvider` from WorkflowLayers, `ProgressEvent` from BackpressureHandler) are real symbols; docgen link resolution is deferred.
- A few HTTP/layer Examples still use `[symbol, path]` tuples so the router is referenced without lying about `Layer.isLayer`. They compile and name the route; they do not execute an HTTP request.
- `PingMessage` / `ConnectedMessage` `S.is({})` Examples were left as the inventory requested.

## Commands run

None in this worker (no shell). Required follow-up from repo root:

```bash
zsh -ic 'bun run --cwd scratchpad docgen:effect-ontology'
zsh -ic 'bun run --cwd scratchpad check:effect-ontology'
# optional census
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
```

Root `bun run docgen:local` does not use `scratchpad/docgen.effect-ontology.json`; the ontology-scoped script is the bounded Example gate for this pack.
