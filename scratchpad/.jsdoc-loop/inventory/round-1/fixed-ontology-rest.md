# Round 1 fixer report: ontology-rest

JSDoc-only edits under `scratchpad/effect-ontology/{Cli,Contract,Prompt,Repository,Telemetry,Utils}` plus package barrels. Runtime behavior is unchanged. `drizzle.config.ts` was left as a Kit config file. `Utils/IdempotencyKey.ts` `export { IdempotencyKey }` remains an undocumented graph edge.

## Changed files

### This resume

- `scratchpad/effect-ontology/Contract/ProgressStreaming.ts`
- `scratchpad/effect-ontology/Repository/schema.ts`
- `scratchpad/effect-ontology/Telemetry/LlmAttributes.ts`

### Already applied before this resume

- `scratchpad/effect-ontology/index.ts`
- `scratchpad/effect-ontology/Cli/index.ts`
- `scratchpad/effect-ontology/Cli/ErrorHandler.ts`
- `scratchpad/effect-ontology/Cli/Commands/Extract.ts`
- `scratchpad/effect-ontology/Cli/Commands/Fetch.ts`
- `scratchpad/effect-ontology/Cli/Commands/Inference.ts`
- `scratchpad/effect-ontology/Cli/Commands/Ingest.ts`
- `scratchpad/effect-ontology/Cli/Commands/Link.ts`
- `scratchpad/effect-ontology/Cli/Commands/Reconcile.ts`
- `scratchpad/effect-ontology/Cli/Commands/Storage.ts`
- `scratchpad/effect-ontology/Cli/Commands/Workflow.ts`
- `scratchpad/effect-ontology/Telemetry/index.ts`
- `scratchpad/effect-ontology/Telemetry/CostCalculator.ts`
- `scratchpad/effect-ontology/Telemetry/ExtractionTelemetry.ts`
- `scratchpad/effect-ontology/Telemetry/Metrics.ts`
- `scratchpad/effect-ontology/Telemetry/Tracing.ts`
- `scratchpad/effect-ontology/Telemetry/TracingContext.ts`
- `scratchpad/effect-ontology/Utils/index.ts`
- `scratchpad/effect-ontology/Utils/Activity.ts`
- `scratchpad/effect-ontology/Utils/ClaimFactory.ts`
- `scratchpad/effect-ontology/Utils/Datatype.ts`
- `scratchpad/effect-ontology/Utils/Hash.ts`
- `scratchpad/effect-ontology/Utils/IdempotencyKey.ts`
- `scratchpad/effect-ontology/Utils/Iri.ts`
- `scratchpad/effect-ontology/Utils/Provenance.ts`
- `scratchpad/effect-ontology/Utils/QuadDelta.ts`
- `scratchpad/effect-ontology/Utils/Rdf.ts`
- `scratchpad/effect-ontology/Utils/Retrieval.ts`
- `scratchpad/effect-ontology/Utils/Similarity.ts`
- `scratchpad/effect-ontology/Utils/Sql.ts`
- `scratchpad/effect-ontology/Utils/Text.ts`
- `scratchpad/effect-ontology/Repository/index.ts`
- `scratchpad/effect-ontology/Repository/Article.ts`
- `scratchpad/effect-ontology/Repository/CachedArticle.ts`
- `scratchpad/effect-ontology/Repository/CachedClaim.ts`
- `scratchpad/effect-ontology/Repository/Claim.ts`
- `scratchpad/effect-ontology/Repository/Conflict.ts`
- `scratchpad/effect-ontology/Repository/Embedding.ts`
- `scratchpad/effect-ontology/Repository/EntityRegistry.ts`
- `scratchpad/effect-ontology/Repository/Examples.ts`
- `scratchpad/effect-ontology/Prompt/PromptGenerator.ts`
- `scratchpad/effect-ontology/Prompt/RuleSet.ts`

Left untouched as required: `drizzle.config.ts`, `Utils/IdempotencyKey.ts` re-export, already-good Dual/Entity/String/RefineKG/Prompt Doc/ExtractionRule/FeedbackGenerator/SchemaGenerator/Prompt index/Contract index.

## Items closed this resume

| ID | Action |
| --- | --- |
| ontology-rest-R1-012 (residual) | `annotateLlmCall` / `annotateRetry` / `annotateError` / `annotateExtraction` no longer end in tautological `Effect.isEffect`. Examples compose realistic attrs, log the keys they write, show cost (`0.0009` USD for 100/40 Sonnet tokens) or 500-char truncation, and keep the Effect unrun (no tracer). |
| ontology-rest-R1-036 (residual) | Table Model Examples no longer dump `Class.fields.x` schema objects. They assert the job-bearing keys (`"uri" in Articles.fields`, triple columns on `Claims`, embedding on `CanonicalEntities` / `Embeddings`, etc.). Drizzle projections now log SQL names with expected comments (`"ontology_id"`, `"correction_type"`, `"original_claim_id"`, `"canonical_entity_id"`, `"content_hash"`, `"example_type"`, …). Model leads no longer say “Provides repository access”. |
| ontology-rest-R1-047 (residual) | `BackpressureStrategy` Example uses `.is.drop_oldest` instead of logging `.Options`. Type companions `BackpressureStrategy` and `BackpressureConfigInput` dropped dummy `console.log(strategy|config)`; described `@see` only. `BackpressureConfig.make` Example was already attached. |

## Items closed before this resume

| ID | Action |
| --- | --- |
| R1-001 … R1-010 | CLI command leads + `name`/`description`/subcommand Examples; `withErrorHandler` stderr/channel; `runCli` argv + Postgres-gated LinkIngestion Gotcha. Categories `cli-commands` / `error-handling`. |
| R1-011 | `getPricing` / `calculateCost` USD results and unknown-model `undefined` / `0`. |
| R1-013 … R1-016 | TracingConfig/Metrics S.Class → `configuration`/`models`; layer/service Examples; capture telemetry snapshots (`Complete` / `Unavailable`). |
| R1-017 … R1-022 | Activity interrupt-only schedule; Hash real hex lengths + Node-only Gotcha + described `@see` twins; Idempotency helpers called; ExtractionParams type companion prose. |
| R1-023 … R1-034 | Similarity Entity/Relation Examples + 0.95 bypass Gotcha; ProvenanceUri `$I.annoteSchema` + canonical parse/`null`; `buildIri`; `normalizeDrizzleError` run+`_tag`; Text inner `@packageDocumentation` deleted; dual2 fake defaults removed; S.Class categories; IRI Option `@returns` + last-wins Gotchas; Retrieval `useBoosting` fake default deleted. |
| R1-035, R1-037 … R1-046 | Repository live layers constructed; services method-shaped; `canonicalConflictPair` runSync ordered UUID + self-pair fail; Prompt RuleSet getters on `makeMentionRuleSet()`; OntologyPromptContext logs empty classes + `O.isNone(imageContexts)`. |
| R1-048 | Utils/Telemetry/package barrel leads name hashing/IRI, OTLP/LLM/cost, and Domain/Runtime/Workflow facade. |

## Not documented (rejected / note only)

- `Utils/IdempotencyKey.ts` `export { IdempotencyKey }` — local re-export of `Domain/Identity.ts`.
- `drizzle.config.ts` default export — Kit config, not public API.

## Residual risk

- Table Examples use `"field" in Model.fields` and Drizzle `.name` comments. If `@beep/effect-drizzle` stores SQL names somewhere other than `.name`, the comments are wrong while the code still compiles.
- `annotate*` helpers remain unrun so they do not require a tracer; `typeof annotate === "object"` only proves composition.
- `activityRetryPolicy` `Schedule.toStep` + `Effect.runSync` assumes jittered Random is defaulted (`R = never`).
- `captureExtractionTelemetry(Effect.runSync(...))` assumes `Effect.fn` tracing does not add a required Tracer channel.
- `calculateCost("claude-sonnet-4-5", 100, 40) // 0.0009` is exact for the in-module pricing table (`3+15` USD / 1M tokens).
- Repository service Examples compose method calls against Postgres-backed Defaults without providing Drizzle; they typecheck as Effects, they do not execute SQL.
- `{@link LinkIngestionService.Disabled}` from `Cli/index.ts` points at a static on a Service module outside this pack.

## Commands run

Verification was not executed in this fixer pass (no shell tool in the subagent). Required follow-up from the repo root:

```bash
zsh -ic 'bun run --cwd scratchpad docgen:effect-ontology'
zsh -ic 'bun run --cwd scratchpad check:effect-ontology'
# optional pack census
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
```

Root `bun run docgen:local` does not use `scratchpad/docgen.effect-ontology.json`; the ontology-scoped script is the bounded Example gate for this pack.
