# Pack ontology-runtime + ontology-rest — round 2 JSDoc fixes

Editorial pass over `scratchpad/effect-ontology/{Runtime,Cluster,Workflow,Schema,Prompt,Repository,Utils,Telemetry,Cli,Contract}` against `.patterns/jsdoc-documentation.md`. `drizzle.config.ts` was not touched.

Runtime behavior was not changed. Allowed edits only: JSDoc blocks.

## Changed files

**ontology-runtime**

- `scratchpad/effect-ontology/Runtime/AssetRouter.ts`
- `scratchpad/effect-ontology/Runtime/AuthRouter.ts`
- `scratchpad/effect-ontology/Runtime/ImageRouter.ts`
- `scratchpad/effect-ontology/Runtime/LinkIngestionRouter.ts`
- `scratchpad/effect-ontology/Runtime/JobPushHandler.ts`
- `scratchpad/effect-ontology/Runtime/HttpServer.ts`
- `scratchpad/effect-ontology/Runtime/ClusterRuntime.ts`
- `scratchpad/effect-ontology/Runtime/InferenceRouter.ts`
- `scratchpad/effect-ontology/Runtime/HttpMiddleware.ts`
- `scratchpad/effect-ontology/Runtime/EmbeddingLayers.ts`
- `scratchpad/effect-ontology/Runtime/ProductionRuntime.ts`
- `scratchpad/effect-ontology/Runtime/RateLimitedLanguageModel.ts`
- `scratchpad/effect-ontology/Runtime/WorkflowLayers.ts`
- `scratchpad/effect-ontology/Runtime/Persistence/PostgresLayer.ts`
- `scratchpad/effect-ontology/Runtime/Persistence/DatabaseReady.ts`
- `scratchpad/effect-ontology/Runtime/Persistence/MigrationRunner.ts`
- `scratchpad/effect-ontology/Runtime/EventBridge.ts`
- `scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts`
- `scratchpad/effect-ontology/Runtime/HealthCheck.ts`
- `scratchpad/effect-ontology/Runtime/LlmSemaphore.ts`
- `scratchpad/effect-ontology/Runtime/TestRuntime.ts`
- `scratchpad/effect-ontology/Cluster/ExtractionEntityHandler.ts`
- `scratchpad/effect-ontology/Workflow/StreamingExtraction.ts`

**ontology-rest**

- `scratchpad/effect-ontology/Repository/index.ts`
- `scratchpad/effect-ontology/Repository/Conflict.ts`
- `scratchpad/effect-ontology/Repository/Claim.ts`
- `scratchpad/effect-ontology/Repository/Examples.ts`
- `scratchpad/effect-ontology/Utils/ClaimFactory.ts`
- `scratchpad/effect-ontology/Utils/QuadDelta.ts`
- `scratchpad/effect-ontology/Cli/index.ts`
- `scratchpad/effect-ontology/Cli/Commands/Extract.ts`
- `scratchpad/effect-ontology/Cli/Commands/Fetch.ts`
- `scratchpad/effect-ontology/Cli/Commands/Inference.ts`
- `scratchpad/effect-ontology/Cli/Commands/Ingest.ts`
- `scratchpad/effect-ontology/Cli/Commands/Link.ts`
- `scratchpad/effect-ontology/Cli/Commands/Reconcile.ts`

Untouched on purpose: `Schema/**`, `Prompt/**`, `Telemetry/**`, `Contract/**`, `drizzle.config.ts`, package `index.ts`, and the round-2 “no accepted finding” files.

## Items closed

| ID | Status | What changed |
| --- | --- | --- |
| ontology-runtime-R2-001 | closed | Deleted every `documented = [symbol, literal]` tuple. Routers `Layer.provide` onto `HttpRouter.layer` and assert inequality; paths/env names moved into Details. Cluster/embedding/production/workflow/postgres layers compose against a sibling or decode `PostgresConfigFromEnv` via `ConfigProvider.fromUnknown`. `ClusterRuntime` module header Example dropped. `InferenceRouterDefinition` Example dropped (non-export). |
| ontology-runtime-R2-002 | closed | `makeAuthMiddleware` runs a missing-key `/v1/extract` request and logs `401`. `makeShutdownMiddleware` initiates drain and observes `ShutdownError`. `makeLoggingMiddleware` runs a request and logs `204`. `HealthCheckService` / `EventBridgeService` use `Layer.mock` and run `liveness` / `start`. `LlmSemaphoreService.withPermit` runs to `"ok"`. `TestLayers` wraps `Effect.succeed("ready")` and asserts inequality. `migrateFromFolder` / `databaseReady` observe the migrations folder and constructor inequality. `broadcastDomainEvent` `O.getOrThrow`s a `ClaimCorrected` entry and logs `ontologyId`. `makeCliExtractionLayer` keeps `ConfigProvider.fromUnknown({ ONTOLOGY_PATH })` and asserts inequality with `CliExtractionLayer`. |
| ontology-runtime-R2-003 | closed | `PingMessage.make({ timestamp })` and `ConnectedMessage.make({ ontologyId, serverId, timestamp })`. Type companion `BroadcastEvent` Example dropped (type-level). |
| ontology-rest-R2-001 | closed | Repository live layers observe sibling inequality (`ClaimRepositoryLive !== RepositoriesLive`, etc.). `makeTestRepositoriesLayer` logs explicit `host` / `database` used in the constructor. |
| ontology-rest-R2-002 | closed | `ClaimData.make` with `claimId` plus CreateClaimInput fields. `ConflictRecord` / `CorrectionChainEntry` / `ScoredExample` decode a populated payload and keep `S.is({}) // false` as the failure case. |
| ontology-rest-R2-003 | closed | `runCli.length` plus argv vector (`extract`, `--text`). `runCli` is not invoked (it calls `BunRuntime.runMain`). |
| ontology-rest-R2-004 | closed | Leaf commands keep `.name` and construct `Command.runWith(command, { version: "0.0.0" })(argv)` without executing the handler. Flag names live in the argv fence (`--text`, `--file`/`--input`, `--delta-only`, `--wikidata-id`, `--batch-id`, `--ontology-id`, `--metadata`, `--status`). |
| ontology-rest-R2-005 | closed | `Effect.runSync(computeQuadDelta(store, store))` logs `deltaCount` / `newQuads.length`. `Effect.runSync(checkIriCollisions([], base))` logs `length // 0`. |

## Residual risk

- HTTP routers and most production layers cannot be dispatched in a JSDoc fence (live Storage/LLM/Postgres). Observation is `Layer.provide` / sibling inequality, with route/env names in Details.
- `ConflictRecord` / `CorrectionChainEntry` decode fixtures depend on drizzle `select` nullability; if a generated column is required beyond the named join keys, docgen will fail and the payload needs another field.
- `makeAuthMiddleware` / `makeShutdownMiddleware` / `makeLoggingMiddleware` examples actually `runSync` against `DEFAULT_CONFIG` / `ShutdownService.Default`. They typecheck only if `HttpMiddleware` accepts `Effect.succeed(HttpServerResponse.empty())`.
- CLI examples construct `Command.runWith` programs; they do not parse help or execute handlers (FS/network).

## Commands run

Verification was not executed in this fixer session (no shell tool in the worker). Intended commands:

```bash
bun scratchpad/.jsdoc-loop/census.ts
bun run --cwd scratchpad docgen:effect-ontology
bun run --cwd scratchpad check:effect-ontology
bun run docgen:local -- --package @beep/scratchpad
```

## Symbols not documented

None of the eight accepted findings were skipped. Non-export `InferenceRouterDefinition` had its placeholder Example removed rather than upgraded.
