# ontology-rest round 1

Read-only JSDoc review of pack `ontology-rest` (Prompt, Repository, Utils, Telemetry, Cli, Contract, package `index.ts`, `drizzle.config.ts`). Census input: 56 modules, 356 owning exports, 0 open modules, 2 open owning.

Mechanical census was almost green. Editorial quality is not: a large share of value-level Examples only `console.log` the imported symbol, several schema classes are tagged `@category type-level`, and a handful of Examples document results the implementation cannot produce.

## Census disposition

- `effect-ontology/Utils/IdempotencyKey.ts:36` `export { IdempotencyKey }` is a local graph-edge re-export of `../Domain/Identity.ts`. Census recorded it as owning (`kind: value`, `exportKind: re-export`) with `missing-summary|missing-required-tags`. **Rejected false positive** — document the owning declaration, not this edge.
- `effect-ontology/drizzle.config.ts:9` default export is a Drizzle Kit config object. Census `missing-summary|missing-required-tags` is mechanically true. **Note only** — do not rewrite as public API docs. Module header already has a useful lead, `@packageDocumentation`, and `@since 0.0.0`.

## Rejected false positives

- `IdempotencyKey` re-export at `Utils/IdempotencyKey.ts:36` (not owning).

## Notes

- `drizzle.config.ts` default export: leave undocumented as a config file; do not add `@category` / `@since` / Example to `defineConfig(...)`.

---

## Accepted findings

### ontology-rest-R1-001: extractCommand placeholder Example, restated lead, wrong category

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Extract.ts:258
- `symbol`: extractCommand
- `kind`: value
- `evidence`: Lead is "Exposes extract command for composition by callers of this module." Example is `console.log(extractCommand)`. `@category layers` while sibling commands use `cli-commands`; the export is a `Command.make("extract", ...)`, not a Layer.
- `impact`: Hover docs do not show flags, stdin/file/text input, or how the command is composed into `runCli`. Callers scanning `@category layers` will miss it among CLI commands.
- `suggestedFix`: Rewrite the lead around ad-hoc extraction without a server. Replace the Example with a compilable composition or flag listing that names `ontology` / `text` / `file`. Change `@category` to `cli-commands`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-002: Fetch command placeholders

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Fetch.ts:135
- `symbol`: fetchCommand, ingestLinkCommand, documentsCommand, ingestBatchCommand
- `kind`: value
- `evidence`: Each Example is `console.log(<command>)`. Leads: fetchCommand "Retrieves fetch command data for downstream processing" (inaccurate — it is a CLI command, not a getter); ingestLinkCommand / documentsCommand / ingestBatchCommand "Exposes … command for composition by callers of this module."
- `impact`: Four sibling commands are indistinguishable in hovers; callers cannot tell fetch vs ingest-link vs batch vs document listing.
- `suggestedFix`: One observable Example per command showing its actual job (URL fetch, link ingest, document list, batch ingest) and leads that state the user-facing problem each solves.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-003: inferenceCommand placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Inference.ts:83
- `symbol`: inferenceCommand
- `kind`: value
- `evidence`: Lead is useful ("Run RDFS inference on a Turtle file") but the Example is `console.log(inferenceCommand)`.
- `impact`: Callers never see `--input` / `--output` / `--profile` / `--delta-only` or that this command is the inference entry point.
- `suggestedFix`: Keep the lead. Replace the Example with a composition or flag walkthrough that mentions Turtle input and optional delta-only output.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-004: ingestCommand placeholder Example and restated lead

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Ingest.ts:184
- `symbol`: ingestCommand
- `kind`: value
- `evidence`: Lead "Exposes ingest command for composition by callers of this module." Example `console.log(ingestCommand)`.
- `impact`: Same placeholder as every other CLI command; ingest-from-storage vs fetch-from-URL is invisible.
- `suggestedFix`: Lead that states local-document ingest. Example that shows the command's inputs doing that job.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-005: linkCommand placeholder Example and restated lead

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Link.ts:172
- `symbol`: linkCommand
- `kind`: value
- `evidence`: Lead "Exposes link command for composition by callers of this module." Example `console.log(linkCommand)`.
- `impact`: Callers cannot distinguish entity-linking from ingest-link.
- `suggestedFix`: Lead and Example that show the linking workflow the command actually runs.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-006: reconcileCommand placeholder Example and restated lead

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Reconcile.ts:281
- `symbol`: reconcileCommand
- `kind`: value
- `evidence`: Lead "Exposes reconcile command for composition by callers of this module." Example `console.log(reconcileCommand)`.
- `impact`: Conflict-reconciliation CLI is undocumented beyond the identifier.
- `suggestedFix`: Lead and Example that show reconcile operating on persisted conflicts.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-007: storageCommand placeholder Example and restated lead

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Storage.ts:183
- `symbol`: storageCommand
- `kind`: value
- `evidence`: Lead "Exposes storage command for composition by callers of this module." Example `console.log(storageCommand)`.
- `impact`: Storage subcommands are invisible in the published Example.
- `suggestedFix`: Lead and Example that show a storage subcommand doing its job.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-008: workflowCommand placeholder Example and restated lead

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/Commands/Workflow.ts:213
- `symbol`: workflowCommand
- `kind`: value
- `evidence`: Lead "Exposes workflow command for composition by callers of this module." Example `console.log(workflowCommand)`.
- `impact`: Durable-workflow CLI entry is a name echo.
- `suggestedFix`: Lead and Example that show the workflow the command launches.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-009: withErrorHandler placeholder Example and wrong category

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/ErrorHandler.ts:38
- `symbol`: withErrorHandler
- `kind`: value
- `evidence`: Example `console.log(withErrorHandler)`. `@category errors` (error types) rather than `error-handling`. `@param` / `@returns` restate the signature ("The effect to wrap" / "The effect with error handler attached").
- `impact`: Callers never see that failures print a formatted Cause to stderr and that the typed error channel is unchanged.
- `suggestedFix`: Example that wraps `Effect.fail` / a defect and shows `Console.error` formatting. Category `error-handling`. Drop restating `@param`/`@returns` or replace with the stderr / channel invariant.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-010: runCli placeholder Example and wrong category

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Cli/index.ts:125
- `symbol`: runCli
- `kind`: value
- `evidence`: Example `console.log(runCli)`. `@category layers` on a function that runs the root command with `CliLive`, not a Layer export.
- `impact`: Callers cannot see argv shape or that LinkIngestion is swapped to Disabled when `POSTGRES_HOST` is absent (implementation comment at the unwrap).
- `suggestedFix`: Example that names `runCli` with a realistic argv vector (even if not executed). Category `cli-commands`. Add a Gotcha for the Postgres-gated LinkIngestion layer.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-011: CostCalculator placeholder Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Telemetry/CostCalculator.ts:39
- `symbol`: getPricing, calculateCost
- `kind`: value
- `evidence`: Both Examples are `console.log(getPricing)` / `console.log(calculateCost)`. Implementation returns `undefined` / `0` for unknown models (`calculateCost` line 76).
- `impact`: Callers cannot see units (USD per 1M tokens) or the unknown-model zero/undefined contract.
- `suggestedFix`: Call `getPricing("claude-sonnet-4-5")` and `calculateCost("gpt-4o-mini", 1_000_000, 1_000_000)` with observable USD results; show the unknown-model path.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-012: LlmAttributes placeholder Examples and missing PII Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Telemetry/LlmAttributes.ts:16
- `symbol`: LlmAttributes, annotateLlmCall, annotateRetry, annotateError, annotateExtraction
- `kind`: value
- `evidence`: Every Example is `console.log(<symbol>)`. Implementation comment at annotateLlmCall:115-116: "NOTE: Removed PROMPT_TEXT and RESPONSE_TEXT to prevent PII leakage". annotateError:167 truncates messages to 500 characters.
- `impact`: Callers may try to span-annotate prompt/response text; truncation of `errorMessage` is invisible. `annotateError` is `@category errors` rather than `observability`.
- `suggestedFix`: Examples that read `LlmAttributes.MODEL` / compose `annotateLlmCall` without running a tracer. Gotcha: no prompt/response payloads; error messages truncated to 500 chars. Category `observability` for `annotateError`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-013: TracingConfig is a runtime class tagged type-level; layer Examples are placeholders

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Telemetry/Tracing.ts:22
- `symbol`: TracingConfig, makeTracingLayer, TracingTestLayer
- `kind`: value
- `evidence`: `export class TracingConfig extends S.Class` is `@category type-level` with a `keyof` field dump imported as a type. `makeTracingLayer` / `TracingTestLayer` Examples are `console.log(<symbol>)`. Disabled config returns `Layer.empty` (line 90-91) with no Gotcha.
- `impact`: Schema classes are value-level and require a `.make` / decode Example. Callers will not learn that `enabled: false` is a no-op layer.
- `suggestedFix`: Category `configuration` (or `schemas`) on TracingConfig with `TracingConfig.make({ serviceName: "effect-ontology" })`. Example `makeTracingLayer` with `enabled: false` yielding `Layer.empty`. Keep TracingConfigInput as type-level.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-014: TracingContext placeholder Example and wrong category

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Telemetry/TracingContext.ts:17
- `symbol`: TracingContextShape, TracingContext
- `kind`: value
- `evidence`: Shape Example dumps `keyof TracingContextShape`. Service Example `console.log(TracingContext)`. Class is `@category layers`; it is a `Context.Service`.
- `impact`: Callers never see `TracingContext.make("claude-sonnet-4-5", "anthropic")` or Default `"unknown"` / `"unknown"`.
- `suggestedFix`: Type-level Shape needs prose only (drop the keyof dump). Service Example should construct Default or `make`. Category `services`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-015: Metrics schema classes tagged type-level; MetricsService placeholder

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Telemetry/Metrics.ts:25
- `symbol`: ExtractionMetrics, LlmCallMetrics, EmbeddingCacheMetrics, MetricsService
- `kind`: value
- `evidence`: Three `S.Class` values use `@category type-level` and `keyof` dumps imported as types. MetricsService Example `console.log(MetricsService)` with `@category layers`.
- `impact`: Hover treats runtime metric payloads as types; the Prometheus service is never acquired or recorded against.
- `suggestedFix`: Category `models` on the three classes with `.make` Examples. MetricsService category `services` with a method-call Example (record + scrape, or at least `Layer.isLayer` is not enough — show a record helper).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-016: ExtractionTelemetry tautological Effect.isEffect Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Telemetry/ExtractionTelemetry.ts:68
- `symbol`: ExtractionTelemetryCollector, recordProviderAttempt, recordProviderUsage, recordExtractionChunkCount, captureExtractionTelemetry
- `kind`: value
- `evidence`: Every Example is `console.log(Effect.isEffect(...)) // true`. Details already say each `captureExtractionTelemetry` installs a fresh collector so concurrent runs cannot share counters — never shown.
- `impact`: Callers cannot see snapshot shape (`Complete` / `Partial` / `Unavailable`) or that record* is a no-op outside a capture scope.
- `suggestedFix`: One Example that `Effect.runSync`/`runPromise`s `captureExtractionTelemetry` around `recordProviderAttempt` / `recordProviderUsage` and asserts the snapshot. Gotcha: record* is silent without a collector.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-017: activityRetryPolicy placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Activity.ts:11
- `symbol`: activityRetryPolicy
- `kind`: value
- `evidence`: Example `console.log(activityRetryPolicy)`. Policy is jittered exponential, max 3 recurs, only while `Cause.hasInterrupts`.
- `impact`: Interrupt-only retry is the whole API; logging the Schedule object hides it.
- `suggestedFix`: Example that inspects schedule metadata or documents the interrupt-only + 3-retry + 1s exponential contract with an observable driver, and a Gotcha that non-interrupt failures do not retry.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-018: Hash value Examples only log the function

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Hash.ts:61
- `symbol`: sha256, hashEmbeddingKey, sha256SyncFull, sha256Sync, hashEmbeddingKeySync, hashVersionedEmbeddingKey, hashVersionedEmbeddingKeySync, sha256Bytes, sha256BytesSync
- `kind`: value
- `evidence`: Each Example is `console.log(<fn>)`. HashingError is the only symbol that actually constructs. EmbeddingKeyMetadata uses a `keyof` dump.
- `impact`: Callers never see hex length (full 64 vs truncated 16), `::` collision separators, or versioned `providerId::modelId::dimension::taskType::text`.
- `suggestedFix`: Call the sync helpers with realistic strings and log the hex; run the Effect helpers with `Effect.runPromise`. Drop the Metadata keyof dump; keep type-level prose.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-019: sha256Sync* docs claim a browser fallback the code does not implement

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Hash.ts:113
- `symbol`: sha256SyncFull, sha256Sync, sha256BytesSync
- `kind`: value
- `evidence`: Details: "Falls back to a simple hash in browser (should not be called in browser)." Implementation is `createHash("sha256")` from `node:crypto` with no fallback. sha256 / sha256Bytes correctly use WebCrypto.
- `impact`: A browser caller will follow the Details, call the sync helper, and throw — the opposite of "falls back".
- `suggestedFix`: Move "Node `crypto` only; do not call from a browser" into **Gotchas**. Delete the fallback sentence. Add described `@see` from each sync helper to its WebCrypto twin.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-020: Hash sibling choice missing described @see

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Hash.ts:80
- `symbol`: sha256, sha256Sync, sha256SyncFull, sha256Bytes, sha256BytesSync, hashEmbeddingKey, hashEmbeddingKeySync, hashVersionedEmbeddingKey, hashVersionedEmbeddingKeySync
- `kind`: value
- `evidence`: Nine overlapping hash constructors with no `@see` purpose phrase linking sync vs Effect, truncated vs full, or versioned vs unversioned keys.
- `impact`: Callers must choose among twins that differ in environment, length, and collision domain.
- `suggestedFix`: On each twin, `@see {@link sha256Sync} for the Node-only truncated digest.` (and the inverse). Same for bytes and embedding-key families.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-021: IdempotencyKey helpers log the function; Effect twin unshown

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/IdempotencyKey.ts:93
- `symbol`: normalizeText, hashParams, computeOntologyVersion, computeIdempotencyKeyEffect, isValidIdempotencyKey, parseIdempotencyKey, shortKey, formatKeyForLog
- `kind`: value
- `evidence`: Each Example is `console.log(<fn>)`. `computeIdempotencyKey` is the only helper with a real call. No `@see` between `computeIdempotencyKey` and `computeIdempotencyKeyEffect`.
- `impact`: The key formula lives in Details on one symbol; the rest of the module looks unused. Callers cannot choose the Effect twin.
- `suggestedFix`: Call normalize/hash/parse/short/format with realistic text and show 16-char vs 12-char vs `run-` prefix. `@see` the Effect twin from the sync constructor.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-022: ExtractionParams type companion is a formulaic dummy

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/IdempotencyKey.ts:69
- `symbol`: ExtractionParams
- `kind`: type
- `evidence`: Lead "Describes the extraction params data exposed by this module." Example maps decode of `{}` through `(_value) => "valid extraction params"`. Runtime schema Example is `S.is(ExtractionParams)({})`.
- `impact`: Same-name aliases need prose about decoded fields (optional maxTokens/temperature/threshold), not a discarded binding. Empty-object `S.is` does not teach optional-key semantics.
- `suggestedFix`: Type-level: described `@see {@link ExtractionParams}` and a lead about decoded extraction knobs. Runtime: decode a realistic `{ temperature: 0.1 }` and a rejected non-finite.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-023: Similarity placeholders hide the 0.95 type-overlap bypass

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Similarity.ts:20
- `symbol`: getNeighbors, computeEntitySimilarity, shouldConsiderMerge, detectResolutionMethod
- `kind`: value
- `evidence`: All four Examples are `console.log(<fn>)`. getNeighbors implementation skips self-references. shouldConsiderMerge:244-247 bypasses the type-overlap fast path when `embeddingSimilarity > 0.95`; comments admit false negatives with hierarchy. `@param embeddingSimilarity` / `isSubclass` text is "Input consumed by runs the should consider merge utility against its supplied inputs.."
- `impact`: Merge gating is the caller-facing contract and is undocumented. Garbage `@param` lines fail TSDoc purpose.
- `suggestedFix`: Examples that call each helper on two `Entity` values. Gotchas: self-neighbors excluded; embedding > 0.95 bypasses type overlap. Delete or rewrite the broken `@param` lines. Described `@see` among the four.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-024: ProvenanceUri missing $I.annoteSchema; dummy type companion; isProvenanceUri placeholder

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Provenance.ts:22
- `symbol`: ProvenanceUri, isProvenanceUri
- `kind`: value
- `evidence`: Runtime schema uses `S.annotate({ title, description })` with no `$I` composer. Value Example `S.is(ProvenanceUri)({})` is always false. Type lead "Describes the provenance uri data exposed by this module" plus dummy summarize. `isProvenanceUri` Example `console.log(isProvenanceUri)`.
- `impact`: Identity annotations never attach. Empty-object decode teaches the wrong failure. Predicate is unused in its Example.
- `suggestedFix`: Introduce `$I` and `$I.annoteSchema("ProvenanceUri", …)`. Example `S.is(ProvenanceUri)("urn:provenance:batch/batch-1234567890ab/doc/doc-abcdef123456")`. Type companion: described `@see` only. Predicate Example with a valid and invalid URI.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-025: parseProvenanceUri Example documents a result the regex rejects

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Provenance.ts:118
- `symbol`: parseProvenanceUri
- `kind`: value
- `evidence`: Example input `urn:provenance:batch/batch-123/doc/doc-456/chunk/0` claimed to parse to `{ batchId: "batch-123", … }`. Implementation requires `batch-[a-f0-9]{12}` and `doc-[a-f0-9]{12}` and returns `null` for that string. `makeProvenanceUri` Example uses canonical 12-hex ids.
- `impact`: Copy-pasting the Example produces `null`, not the commented object. Callers will mint non-canonical ids.
- `suggestedFix`: Use the same canonical ids as `makeProvenanceUri`. Show the `null` path for a malformed URI. Described `@see` to `makeProvenanceUri` / `isProvenanceUri`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-026: buildIri placeholder Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Rdf.ts:16
- `symbol`: buildIri
- `kind`: value
- `evidence`: Example `console.log(buildIri)`. Sibling `canonicalNamedNode` / `canonicalLiteral` / `canonicalQuad` already call the helpers.
- `impact`: The only public IRI factory in the file has no concatenation/validation Example.
- `suggestedFix`: `buildIri("https://example.com/", "ada")` and log the IRI string; Gotcha if `IRI.fromUnknown` defects on invalid input.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-027: normalizeDrizzleError Example logs an unrun Effect

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Sql.ts:14
- `symbol`: normalizeDrizzleError
- `kind`: value
- `evidence`: Example pipes `Effect.fail("connection closed")` into `normalizeDrizzleError("execute")` then `console.log(query)` without running it. `formatPgVector` Example is already observable.
- `impact`: Callers never see the `DrizzleError` tag/operation mapping.
- `suggestedFix`: `Effect.runSyncExit` / `runPromise` the failed effect and log `_tag` / `operation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-028: Utils/Text.ts second @packageDocumentation block

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Text.ts:91
- `symbol`: (module)
- `kind`: module
- `evidence`: File header already has `@packageDocumentation` (line 4). A second block at 91-99 ("Text Processing Utilities") repeats `@packageDocumentation` `@since 0.0.0` in the middle of the file, attached to no export.
- `impact`: `@packageDocumentation` is for package entry points. A second copy is a grammar defect and a leftover module header.
- `suggestedFix`: Delete the inner block or turn it into a non-TSDoc section comment without `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-029: generateNGrams / enhanceTextForSearch document a default dual2 does not provide

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Text.ts:140
- `symbol`: generateNGrams, enhanceTextForSearch
- `kind`: value
- `evidence`: `@param n - N-gram size (default: 2 for bigrams)` and `@param ngramSize - Size of n-grams to generate (default: 2)` but both are `dual2` with a required `number`. Examples pass the size explicitly (good).
- `impact`: Callers will omit `n` and fail to typecheck / fail at runtime.
- `suggestedFix`: Remove "default: 2". If a default is desired, it belongs in the implementation, not the docs.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-030: NormalizedValue S.Class tagged type-level

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Datatype.ts:27
- `symbol`: NormalizedValue
- `kind`: value
- `evidence`: `export class NormalizedValue extends S.Class` with `@category type-level`. Example does construct via `.make` (good).
- `impact`: Kind-split and category taxonomy treat this as a type; it is a runtime schema class (`models` / `schemas`).
- `suggestedFix`: `@category models` (or `schemas`). Keep the Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-031: Iri annotation, category, @returns, and collision Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Iri.ts:159
- `symbol`: extractLocalNameFromIri, makeLocalNameSchema, LocalNameMapResult, buildLocalNameToIriMapSafe, expandLocalNameToIri
- `kind`: value
- `evidence`: `extractLocalNameFromIri` is `@category schemas` (it is a string splitter). `makeLocalNameSchema` uses `S.annotate` not `$I.annoteSchema`. `LocalNameMapResult` is an `S.Class` tagged `@category type-level`. `buildLocalNameToIriMapSafe` uses a rogue `**IMPORTANT**` heading (last IRI wins on collision) instead of **Gotchas**. `expandLocalNameToIri` `@returns Full IRI if found, undefined otherwise` but the type is `O.Option<IRI>`.
- `impact`: Callers will treat Option as `undefined`, miss last-wins collisions, and miscategorize a function as a schema.
- `suggestedFix`: Category `utilities`/`getters` for extract; `models` for LocalNameMapResult. `$I.annoteSchema` on generated local-name schemas or document why identity is dynamic. Move last-wins into **Gotchas**. `@returns` must say Option, not undefined. Described `@see` to `buildLocalNameToIriMapSafe`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-032: QuadDelta S.Class tagged type-level

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/QuadDelta.ts:53
- `symbol`: QuadDelta
- `kind`: value
- `evidence`: `export class QuadDelta extends S.Class` with `@category type-level`. Construct Example is otherwise fine.
- `impact`: Same kind-split error as other schema classes in this pack.
- `suggestedFix`: `@category models`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-033: ClaimFactory schema-class categories, dummy Input Example, effectful encoder logged as data

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/ClaimFactory.ts:103
- `symbol`: ClaimFactoryOptions, ClaimFactoryOptionsInput, ClaimData, claimExtractionArtifactToQuads
- `kind`: value
- `evidence`: `ClaimFactoryOptions` and `ClaimData` are `S.Class` with `@category type-level`. Input Example is `const field: keyof … = "ontologyId"`. `claimExtractionArtifactToQuads` is `Effect.fn` / dual2 but the Example assigns the call to `encoded` and `console.log(encoded)` as if it were quads.
- `impact`: Categories lie about kind. The encoder Example will print an Effect, not RDF.
- `suggestedFix`: `models` on the classes. Type Input: described `@see` only. Encoder Example must `Effect.runPromise` / inspect `_tag` or yield quads. Described `@see` if a sync twin exists.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-034: buildExpandedQuery documents a dual2 default it does not have

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/Retrieval.ts:417
- `symbol`: buildExpandedQuery, ExpandedTerm
- `kind`: value
- `evidence`: `@param useBoosting - … default: false` but `dual2` requires the boolean (Examples correctly pass `false`/`true`). Type companion Example is `const field: keyof ExpandedTerm = "source"; console.log(field)`.
- `impact`: Callers will omit `useBoosting`. The type Example does not teach narrowing on `source`.
- `suggestedFix`: Delete the fake default. Type alias: described `@see {@link ExpandedTerm}` only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-035: Repository live layers only console.log the Layer

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/index.ts:50
- `symbol`: DrizzleLive, PgClientLive, DrizzleWithPgLive, ClaimRepositoryLive, ConflictRepositoryLive, ArticleRepositoryLive, EntityRegistryRepositoryLive, EmbeddingRepositoryLive, RepositoriesLive, makeTestRepositoriesLayer
- `kind`: value
- `evidence`: Every Example is `console.log(<Layer>)`. PgClientLive Details list required env vars including `POSTGRES_PASSWORD`; EntityRegistry/Embedding Details require pgvector — never shown.
- `impact`: Ten layers are indistinguishable. Test-layer config shape is never constructed.
- `suggestedFix`: One Example per layer family: env requirements as a Gotcha; `makeTestRepositoriesLayer({ host, port, database, username, password })` actually called; `Layer.mergeAll` composition for `RepositoriesLive`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-036: schema.ts tables tagged repositories; row types formulaic; orphaned vector docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/schema.ts:117
- `symbol`: Articles, Claims, Corrections, CorrectionClaims, Conflicts, BatchRuns, CanonicalEntities, EntityAliases, EntityBlockingTokens, IngestedLinks, LinkBatches, LinkBatchItems, LlmExamples, Embeddings, ArticleRow, ArticleInsertRow, and the other *Row / *InsertRow aliases
- `kind`: value
- `evidence`: Table classes/consts use `@category repositories` (topology of the folder). Lines 117-131 are two JSDoc blocks for 512- and 1024-d vectors with `@since` before `@category` and **no following declaration**. Row aliases use "Describes the … data exposed by this module" plus `keyof` dumps. EmbeddingVector768 Example only logs `meta.column?.ident`.
- `impact`: Canonical category for these symbols is `tables`. Orphaned 512/1024 docs describe APIs that do not exist. Row aliases do not say they are drizzle select/insert shapes.
- `suggestedFix`: `@category tables` on table exports. Delete or implement the 512/1024 docs. Row aliases: one-sentence lead ("Select row decoded from {@link Articles}") plus described `@see`. Keep type-level Examples optional — drop the keyof dumps.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-037: ArticleRepository placeholder, restated lead, category layers

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/Article.ts:56
- `symbol`: ArticleId, ArticleRepository
- `kind`: value
- `evidence`: Type lead "Describes the article id data exposed by this module." Service lead "Provides repository access for article repository." Example `console.log(ArticleRepository)`. `@category layers` on a `Context.Service` (EntityRegistry in the same pack already uses `repositories`).
- `impact`: Service vs layer vs table categories disagree across the folder. The service is never method-called.
- `suggestedFix`: Category `repositories`. Example `ArticleRepository.Default` provided into a `countArticles` / `articleExists` call (or a typed method shape). Type alias: described `@see` only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-038: CachedArticleRepository placeholder and category layers

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/CachedArticle.ts:51
- `symbol`: CachedArticleRepository, CachedArticleRepositoryLayer
- `kind`: value
- `evidence`: Examples `console.log(CachedArticleRepository)` and `console.log(CachedArticleRepositoryLayer)`. Category `layers` on the service. Details mention Effect.Cache but never show invalidate/stats.
- `impact`: Cache wrapper is undocumented as a cache.
- `suggestedFix`: Category `repositories` (service) / `layers` (layer only). Example `cacheStats` / `invalidateAll`. Described `@see` to `ArticleRepository`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-039: CachedClaimRepository placeholder and category layers

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/CachedClaim.ts:51
- `symbol`: CachedClaimRepository, CachedClaimRepositoryLayer
- `kind`: value
- `evidence`: Same `console.log` + `@category layers` pattern as CachedArticle.
- `impact`: Claim cache vs article cache cannot be distinguished from docs.
- `suggestedFix`: Same as R1-038 against ClaimRepository.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-040: Claim type Examples log unused functions; formulaic leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/Claim.ts:59
- `symbol`: PersistedClaimId, ArticleId, PersistedCorrectionId, ClaimFilter, ConflictCandidate
- `kind`: type
- `evidence`: PersistedClaimId / PersistedCorrectionId Examples define `printX` then `console.log(printX)` without calling it. ArticleId / ClaimFilter / ConflictCandidate leads "Describes the … data exposed by this module" (ClaimFilter construct Example is otherwise fine). ClaimRepository Example `console.log` of the service (line 285).
- `impact`: Type Examples are unused bindings. Filter/candidate aliases do not say they are query inputs vs row ids.
- `suggestedFix`: Type-level: prose + described `@see` (drop printX). Keep ClaimFilter.make Example. ClaimRepository: category `repositories` and a method Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-041: canonicalConflictPair Example never runs the Effect

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/Conflict.ts:136
- `symbol`: canonicalConflictPair, ConflictRepository
- `kind`: value
- `evidence`: Example builds `Effect.gen` that would log the ordered pair, then `console.log(program)` so the generator never runs. EqualConflictPairError Example is good. ConflictRepository layer Example is `console.log` (line 282).
- `impact`: Canonical ordering (smaller UUID first) is the whole point and is not observed. Self-pair error is documented; success is not.
- `suggestedFix`: `Effect.runSync` / `runPromise` the pair and log the ordered tuple. Show the self-pair fail path via `EqualConflictPairError`. Repository category `repositories` with a method Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-042: EmbeddingRepository placeholder and category layers

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/Embedding.ts:64
- `symbol`: EmbeddingEntityType, EmbeddingRepository
- `kind`: value
- `evidence`: Type lead "Describes the embedding entity type data exposed by this module." Service Example `console.log(EmbeddingRepository)`, `@category layers`. Details mention pgvector hybrid search.
- `impact`: Hybrid search options exist as sibling exports; the service Example never calls them.
- `suggestedFix`: Category `repositories`. Example a similarity/hybrid search method. Type alias: described `@see`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-043: EntityRegistryRepository tautological Layer.isLayer Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/EntityRegistry.ts:48
- `symbol`: CanonicalEntityId, EntityAliasId, CanonicalEntityFilter, EntityRegistryRepository
- `kind`: value
- `evidence`: Type leads "Describes the … data exposed by this module." Service Example `console.log(Layer.isLayer(EntityRegistryRepository.Default)) // true` — tautological. Category `repositories` is already correct.
- `impact`: Blocking-token / alias behavior is the actual job and is not shown.
- `suggestedFix`: Drop tautological Layer check. Example `getStats` or blocking-candidate lookup. Type aliases: described `@see` only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-044: ExamplesRepository placeholder, restated lead, category layers

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Repository/Examples.ts:96
- `symbol`: ExampleType, ExampleSource, ScoredExample, ExamplesRepository
- `kind`: value
- `evidence`: Type leads "Describes the … data exposed by this module." Service lead "Validates and represents examples repository values at runtime" (signature echo). Example `console.log(ExamplesRepository)`. `@category layers`.
- `impact`: Few-shot example storage is never retrieved or scored in docs.
- `suggestedFix`: Category `repositories`. Example `getStats` / scored retrieval. Type aliases: described `@see`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-045: RuleSet getters log the class, not the getter

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Prompt/RuleSet.ts:197
- `symbol`: RuleSet.allRules, RuleSet.errorRules, RuleSet.warningRules, RuleSet.getRulesByCategory
- `kind`: value
- `evidence`: Each method Example is `console.log(RuleSet)`. `@returns Result produced by this operation.` `@param category - Input consumed by this operation.`
- `impact`: Hard vs soft vs category filtering is the public surface of RuleSet and is never demonstrated. Callers of SchemaGenerator already depend on `errorRules` / `warningRules`.
- `suggestedFix`: `const rules = makeMentionRuleSet(); console.log(rules.errorRules.length)` (and warning/category). Delete restating `@returns`/`@param`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-046: OntologyPromptContext Example is an unused binding

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Prompt/PromptGenerator.ts:57
- `symbol`: OntologyPromptContext
- `kind`: value
- `evidence`: Example constructs `OntologyPromptContext.make({ classes: [], … })` and discards it — no log, assertion, or inferred-type teaching. Downstream generate* Examples do call the builders (keep those). `buildMultimodal*` Examples `console.log(prompt)` after a real call are weak but not unused.
- `impact`: Empty-ontology context is the interesting default and is not observed (entityIds/images Option-none).
- `suggestedFix`: Log `context.classes.length` / `O.isNone(context.imageContexts)` or pass the context into `generateMentionPrompt`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-047: ProgressStreaming orphaned JSDoc, garbled When-to-use, dummy retry-strategy docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Contract/ProgressStreaming.ts:102
- `symbol`: ProgressEvent, ExtractionFailedRetryStrategy, BackpressureConfig, BackpressureStrategy
- `kind`: value
- `evidence`: Consecutive JSDoc at 102-118 (run id) and 119-135 (timestamp) attach to nothing; examples rebuild inline schemas instead of `ExtractionRunId` / `ISOStr`. JSDoc at 1886-1913 (good BackpressureConfig.make Example) is immediately followed by another block, so it never attaches to `BackpressureConfig`. ProgressEvent **When to use** is "Use when use at rpc and websocket boundaries that must decode any progress event before." ProgressEvent type Example is `console.log(typeof tagOf) // "function"`. ExtractionFailedRetryStrategy value Example `console.log(ExtractionFailedRetryStrategy)`; type companion "Describes the … data exposed by this module" plus dummy summarize of `{}`.
- `impact`: The useful BackpressureConfig Example is invisible on hover. Run-id/timestamp docs never bind. Garbled When-to-use fails the opener quality bar. Retry-strategy union is not shown.
- `suggestedFix`: Delete or reattach orphaned blocks to real exports. Fix When-to-use to `Use when decoding any progress event at RPC/WebSocket boundaries.` Attach the existing BackpressureConfig.make Example to the class. Retry strategy: construct exponential_backoff / none. Type aliases: described `@see` only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-rest-R1-048: Barrel module leads restate "exports"

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Utils/index.ts:2; scratchpad/effect-ontology/Telemetry/index.ts:2; scratchpad/effect-ontology/index.ts:2
- `symbol`: (module)
- `kind`: module
- `evidence`: Leads "Utility Module Exports", "Telemetry Module Exports", "Public effect-ontology APIs for index." Module headers require a useful lead, `@packageDocumentation`, `@since 0.0.0`. Prompt/index.ts already has a useful lead and is not in this item. Contract/index.ts extra JSDoc on `export *` is a barrel edge — not opened (re-exports are not documentation subjects).
- `impact`: Package and folder barrels do not tell the next reader what to import for hashing vs telemetry vs the public facade.
- `suggestedFix`: One-sentence leads that name the actual surface (idempotency/IRI/RDF helpers; OTLP/LLM/cost telemetry; public Domain/Runtime/Workflow facade).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-rest
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Files reviewed with no accepted findings

Owning exports in these files already have useful leads, canonical categories, `$I` annotations where required, and Examples that call the symbol with realistic inputs:

- `Utils/Dual.ts`
- `Utils/Entity.ts`
- `Utils/String.ts`
- `Utils/RefineKG.ts`
- `Prompt/Doc.ts`
- `Prompt/ExtractionRule.ts`
- `Prompt/FeedbackGenerator.ts`
- `Prompt/SchemaGenerator.ts`
- `Prompt/index.ts` (barrel re-exports only)
- `Contract/index.ts` (barrel re-exports only; extra JSDoc on `export *` not opened)
- `Telemetry/index.ts` is **not** clean — see R1-048
- `drizzle.config.ts` — note only, see Census disposition

Other files in the slice were reviewed; findings are the items above.

## Pack verdict

- files reviewed: 56
- owning exports reviewed: 356
- confirmed mechanical items: 2
- editorial items: 48
- rejected false positives: 1 (`export { IdempotencyKey }`)
- accepted findings: 48

Census mechanical gaps are not the work. The accepted set is editorial: placeholder `console.log(fn)` Examples across Cli/Telemetry/Utils/Repository, schema classes tagged `@category type-level`, missing `$I.annoteSchema` on `ProvenanceUri`, factually wrong `parseProvenanceUri` / Hash browser-fallback / dual2 "defaults", and orphaned JSDoc in `Contract/ProgressStreaming.ts` plus `Repository/schema.ts`.
