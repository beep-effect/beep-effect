# Runtime Composition and Telemetry Inventory

### Decorated production service graph
- **Source:** `packages/@core-v2/src/Runtime/ProductionRuntime.ts:65-145,164-234` (effect-ontology)
- **What:** A provider-selected `LanguageModel` is wrapped once by the rate-limited Layer, then supplied to the extraction services; tracing, health, concurrency control, and LLM-control Layers are merged at progressively wider runtime boundaries. The executable builds a second, independent server graph instead of reusing `ProductionInfrastructure`, which makes the two production compositions vulnerable to drift (`packages/@core-v2/src/server.ts:230-250`).
- **Category:** pattern
- **Proposed beep home:** `packages/ontology/server` for the slice-local extraction Layer, with only the final published slice Layers composed in app runtime; beep assigns live composition to server/client/app boundaries and forbids it in use-cases (`standards/architecture/05-layer-composition.md:43-49,147-171`).
- **beep overlap & design delta:** Confirmed present: professional-desktop already selects live or fixture providers at Layer-build time and publishes app-local `RuntimeLive`/`RuntimeTest` graphs (`apps/professional-desktop/src/runtime/Layer.ts:123-160,175-212`). Effect-ontology contributes the useful single decoration seam around the model, but its unknown-provider branch silently defaults to Anthropic and its tracing endpoint is hard-coded (`packages/@core-v2/src/Runtime/ProductionRuntime.ts:69-111,164-168`); beep's typed driver Layers and slice ownership are the safer baseline.
- **Goal linkage:** `ontology-agent-surface` and `agentic-professional-runtime` — both converge on the professional-desktop sidecar/runtime boundary (`goals/ontology-agent-surface/README.md:9-14`; `goals/agentic-professional-runtime/README.md:65-71`).
- **v3→v4 notes:** Replace the split v3 `@effect/ai-*` and `@effect/platform` imports with beep's provider drivers and deliberate v4 unstable AI/HTTP surfaces; replace the provider `switch`/default with a schema-backed exhaustive domain and match helper (`packages/@core-v2/src/Runtime/ProductionRuntime.ts:15-19,65-113`; `apps/professional-desktop/src/runtime/Layer.ts:31-45,123-160`). Preserve only the Layer seam, not the rate-limiter internals owned by the LLM-governance inventory.
- **Effort:** M
- **Verdict hint:** adapt-improve

### Production-shaped deterministic test runtime
- **Source:** `packages/@core-v2/src/Runtime/TestRuntime.ts:49-102,169-246` (effect-ontology)
- **What:** The test graph substitutes deterministic language-model, embedding, SHACL, extraction, grounding, storage, and governance implementations while retaining the production dependency shape; an outer test config provider closes the graph before `ManagedRuntime.make`. The model and embedding mocks rely on `any` and assertions, so the composition idea is stronger than the mock typing (`packages/@core-v2/src/Runtime/TestRuntime.ts:49-61,176-187`).
- **Category:** pattern
- **Proposed beep home:** design-reference → `apps/*/src/runtime/Layer.ts`; app code may export app-specific live and test Layers, while slice test fixtures remain slice-owned (`standards/architecture/05-layer-composition.md:152-171`).
- **beep overlap & design delta:** Confirmed present: professional-desktop's `RuntimeTest` swaps the live kernel, stores, usage sink, and document service for fixture/in-memory Layers (`apps/professional-desktop/src/runtime/Layer.ts:189-212`). Effect-ontology's broader config and dependency fixture is useful when an app needs a closed `ManagedRuntime`, but beep's current test graph is smaller and follows the same boundary.
- **Goal linkage:** `agentic-professional-runtime` — the initiative explicitly starts with a deterministic fixture agent and an app-level contract harness (`goals/agentic-professional-runtime/README.md:84-100`).
- **v3→v4 notes:** Rewrite the v3 `@effect/ai` response mocks against `effect/unstable/ai`, keep `ManagedRuntime` disposal explicit, and migrate `ConfigProvider.fromMap`/`Layer.setConfigProvider` to the v4 `ConfigProvider.fromUnknown` plus `ConfigProvider.layer` pattern already used by ontology config tests (`packages/@core-v2/src/Runtime/TestRuntime.ts:19-22,49-102,234-246`; `packages/ontology/config/src/layer.ts:22-46`).
- **Effort:** M
- **Verdict hint:** design-reference

### Open SQL seam for cluster runtime
- **Source:** `packages/@core-v2/src/Runtime/ClusterRuntime.ts:42-134` (effect-ontology)
- **What:** The runtime offers both a convenient SQLite-backed `SingleRunner` and an open `ClusterWithSqlClient` Layer that preserves SQL as a caller-supplied boundary, plus environment-selected variants. Its automatic variant falls back to SQLite for unsupported URLs and interpolates the configured URL into a warning, so a production adaptation must fail explicitly and redact connection material (`packages/@core-v2/src/Runtime/ClusterRuntime.ts:101-132`).
- **Category:** pattern
- **Proposed beep home:** design-reference → `apps/*/src/runtime/Layer.ts`; cluster selection is deployment-specific final wiring, not a reason to create a global runtime package (`standards/architecture/05-layer-composition.md:152-171,185-197`).
- **beep overlap & design delta:** NOT FOUND after live source/barrel searches for `@effect/cluster`, `SingleRunner`, or a cluster runtime. Beep does have app-specific Live/Test composition (`apps/professional-desktop/src/runtime/Layer.ts:175-212`), so a future cluster variant should extend that ownership ladder rather than introduce a cross-slice God Layer.
- **Goal linkage:** none
- **v3→v4 notes:** Move the split `@effect/cluster` imports to the target's `effect/unstable/cluster` surface, retain the external SQL-client requirement, model connection URLs with redacted config, and replace native prefix/conditional dispatch with Effect string and match helpers (`packages/@core-v2/src/Runtime/ClusterRuntime.ts:31-33,80-134`).
- **Effort:** M
- **Verdict hint:** design-reference

### Dependency-satisfied workflow bundles with open test seams
- **Source:** `packages/@core-v2/src/Runtime/WorkflowLayers.ts:47-198,303-384,414-583` (effect-ontology)
- **What:** Small bundles pre-satisfy config, platform, storage, NLP, ontology, SHACL, and extraction requirements before the activity/workflow Layers are built; the sharpest lesson is that an optional service must be provided before a consumer using `serviceOption` constructs, not merely merged as a parallel sibling (`packages/@core-v2/src/Runtime/WorkflowLayers.ts:159-176`). The final `ActivityDependenciesLayer` becomes a broad registry and `makeCliExtractionLayer` duplicates much of the graph, creating God-Layer and drift pressure (`packages/@core-v2/src/Runtime/WorkflowLayers.ts:307-353,414-523`).
- **Category:** pattern
- **Proposed beep home:** `packages/ontology/server`; keep concept/package composition local and publish one slice Layer for the app (`standards/architecture/05-layer-composition.md:30-49,152-171`).
- **beep overlap & design delta:** Confirmed present: `SessionServerLayer` composes ontology use-cases with Turtle, file-store, reasoner, SPARQL, and validation Layers inside the ontology server package, then exports it as `OntologyServerLive` (`packages/ontology/server/src/aggregates/Session/Session.layer.ts:134-173`; `packages/ontology/server/src/Layer.ts:1-9`). Effect-ontology's construction-order note and open test bundles are worth retaining; its aggregate workflow registry is explicitly contrary to beep's God-Layer rejection (`standards/architecture/05-layer-composition.md:13-49,185-197`).
- **Goal linkage:** `ontology-agent-surface` — the goal requires thin ontology handlers proven against the real engine stack, which benefits from one published slice-owned server Layer (`goals/ontology-agent-surface/README.md:9-14`).
- **v3→v4 notes:** Rebuild `.Default`/`Effect.Service` dependencies as explicit `Context.Service` contracts and boundary-owned Layers, migrate split workflow APIs to `effect/unstable/workflow`, and use v4 `ConfigProvider.fromUnknown`/`ConfigProvider.layer` for open test graphs (`standards/architecture/05-layer-composition.md:56-150`; `packages/ontology/config/src/layer.ts:22-46`). Do not reproduce the 589-line composition registry.
- **Effort:** M
- **Verdict hint:** design-reference

### Config-selected embedding subgraph
- **Source:** `packages/@core-v2/src/Runtime/EmbeddingLayers.ts:45-183` (effect-ontology)
- **What:** `Layer.unwrapEffect` selects Nomic or Voyage after reading config, then composes provider-specific NLP/HTTP requirements with rate limiting, cache, metrics, and config into open and closed infrastructure Layers. Repeated union casts reveal that provider selection is occurring too deep in the graph and should be normalized behind driver Layers or moved to the outer runtime (`packages/@core-v2/src/Runtime/EmbeddingLayers.ts:45-79,160-169`).
- **Category:** pattern
- **Proposed beep home:** design-reference → `apps/*/src/runtime/Layer.ts`; concrete provider implementations would remain separate driver boundaries, while the app selects and supplies one published capability Layer (`standards/architecture/05-layer-composition.md:147-171`).
- **beep overlap & design delta:** Partial overlap is confirmed: the Venice AI driver exposes a provider-specific `POST /embeddings` operation through `createEmbedding` (`packages/drivers/venice-ai/src/VeniceAI.service.ts:1117-1124,1941-1955`). NOT FOUND after live source/barrel searches: a provider-neutral embedding capability or config-selected embedding Layer. Professional-desktop's config-selected fixture/Anthropic Layers confirm the outer-runtime selection pattern (`apps/professional-desktop/src/runtime/Layer.ts:114-160`); effect-ontology adds useful multi-provider dependency normalization, but its assertions should not be copied.
- **Goal linkage:** none
- **v3→v4 notes:** Use v4 `Layer.unwrap` as the app runtime already does, an exhaustive `LiteralKit` provider domain plus match helper, explicit `Context.Service` provider contracts, and the target HTTP surface; keep cache, limiter, and metrics requirements visible instead of hiding them behind a broad default (`packages/@core-v2/src/Runtime/EmbeddingLayers.ts:11-27,45-103`; `apps/professional-desktop/src/runtime/Layer.ts:123-160`).
- **Effort:** M
- **Verdict hint:** design-reference

### Liveness, readiness, and deep-health triad
- **Source:** `packages/@core-v2/src/Runtime/HealthCheck.ts:17-153` (effect-ontology)
- **What:** The service separates cheap liveness, configuration-only readiness, and slower dependency diagnostics; deep storage probes are bounded by five-second timeouts and the HTTP layer maps readiness/deep results to status codes (`packages/@core-v2/src/Runtime/HealthCheck.ts:37-146`; `packages/@core-v2/src/Runtime/HttpServer.ts:1049-1076`). Its readiness check only tests whether config strings exist, while deep health unwraps the API key, blanket-catches failures, and returns a plain interface (`packages/@core-v2/src/Runtime/HealthCheck.ts:17-22,48-77,94-139`).
- **Category:** service
- **Proposed beep home:** design-reference → `apps/*/src/runtime/Layer.ts`, with dependency-specific probes implemented by the owning slice/server Layers and aggregated only at the executable boundary (`standards/architecture/05-layer-composition.md:152-171`).
- **beep overlap & design delta:** NOT FOUND: a reusable app-runtime liveness/readiness Layer in the inspected observability and app-runtime surfaces. The desktop HTTP executable currently mounts RPC/auth/CORS without a health route (`apps/professional-desktop/server/main.ts:63-91`), while Graphiti tooling provides a subsystem-specific `/healthz` example with queue and dependency snapshots (`packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyRuntime.ts:58-87`); effect-ontology contributes the reusable three-depth probe shape.
- **Goal linkage:** `ontology-agent-surface` and `agentic-professional-runtime` — both depend on an operable professional-desktop sidecar/local runtime (`goals/ontology-agent-surface/README.md:9-14`; `goals/agentic-professional-runtime/README.md:65-71`).
- **v3→v4 notes:** Replace `Effect.Service` with `Context.Service` plus an explicit app/server Layer, model the externally returned health payload as `S.Class` with schema optionals, use Effect date/collection helpers, and replace broad `catchAll` with precise v4 `Effect.catch` recovery (`packages/@core-v2/src/Runtime/HealthCheck.ts:10-30,83-153`; `standards/architecture/05-layer-composition.md:56-150`).
- **Effort:** M
- **Verdict hint:** adapt-improve

### Request admission cutoff and bounded drain
- **Source:** `packages/@core-v2/src/Runtime/Shutdown.ts:70-148` (effect-ontology)
- **What:** A Ref-backed service rejects new work after shutdown begins, counts in-flight requests, and guarantees decrement with `Effect.ensuring`; HTTP middleware applies that accounting to each request, and the entrypoint invokes initiate/drain on `SIGTERM` (`packages/@core-v2/src/Runtime/HttpMiddleware.ts:98-115`; `packages/@core-v2/src/server.ts:275-314`). The drain busy-polls, swallows timeout, then logs completion, while the entrypoint's direct `process.on`/`runPromiseExit`/`process.exit` path bypasses structured runtime teardown (`packages/@core-v2/src/Runtime/Shutdown.ts:120-145`; `packages/@core-v2/src/server.ts:288-314`).
- **Category:** service
- **Proposed beep home:** design-reference → `apps/*/src/runtime/Layer.ts`; request admission and process lifetime are executable-boundary concerns (`standards/architecture/05-layer-composition.md:152-171`).
- **beep overlap & design delta:** Partial overlap is confirmed: professional-desktop owns PGlite release through Layer scope and delegates lifetime to `BunRuntime.runMain(Layer.launch(...))` (`apps/professional-desktop/src/runtime/Pglite.ts:13-22`; `apps/professional-desktop/server/main.ts:105-107`), while `makeDrainableWorker` provides reusable scoped queue drain tracking (`packages/foundation/modeling/utils/src/DrainableWorker.ts:11-41,44-104`). NOT FOUND: a reusable HTTP request-admission plus process-lifecycle coordinator. Graphiti tooling has the stronger scoped signal-listener and queue-drain composition using `Effect.acquireRelease` and a deferred shutdown gate (`packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyRuntime.ts:107-164`). Harvest the admission/accounting seam, not the manual process control.
- **Goal linkage:** `agentic-professional-runtime` — graceful sidecar shutdown protects the local-first governed runtime and its durable usage/activity writes (`goals/agentic-professional-runtime/README.md:65-71`; `goals/agentic-professional-runtime/docs/product-feature-map.md:24-32`).
- **v3→v4 notes:** Replace `Effect.Service` with `Context.Service`; model config and boundary payloads with `S.Class`, but migrate the existing tagged `ShutdownError` to beep's schema-tagged error form at the correct boundary (`packages/@core-v2/src/Runtime/Shutdown.ts:11-38,70-148`; `standards/architecture/09-errors-across-boundaries.md:3-15`). Use `Duration`, surface timeout as an explicit outcome, and register signals through scoped acquisition or the runtime teardown hook instead of calling `process.exit` (`packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyRuntime.ts:107-164`).
- **Effort:** M
- **Verdict hint:** adapt-improve

### Trace-only OTLP Layer with disabled/test switch
- **Source:** `packages/@core-v2/src/Telemetry/Tracing.ts:21-73` (effect-ontology)
- **What:** `makeTracingLayer` creates a trace-only OTLP exporter with export/shutdown timing, an enabled flag, and an empty test Layer; production supplies the HTTP client and merges tracing at the runtime root (`packages/@core-v2/src/Telemetry/Tracing.ts:31-73`; `packages/@core-v2/src/Runtime/ProductionRuntime.ts:148-183,228-234`). The disabled branch needs an unsafe cast and production fixes the endpoint to localhost (`packages/@core-v2/src/Telemetry/Tracing.ts:44-53`; `packages/@core-v2/src/Runtime/ProductionRuntime.ts:164-168`).
- **Category:** pattern
- **Proposed beep home:** design-reference → `packages/foundation/capability/observability`, composed from `apps/*/src/runtime/Layer.ts` (`standards/architecture/12-observability.md:230-234`).
- **beep overlap & design delta:** Confirmed present and stronger: `@beep/observability` merges runtime metrics with effect-native OTLP logs, metrics, traces, resource metadata, export intervals, and shutdown control (`packages/foundation/capability/observability/src/server/Layer.ts:42-80`). Professional-desktop already gates native OTLP from standard environment config and composes it at the app root (`apps/professional-desktop/src/runtime/Observability.ts:27-50,91-104`; `apps/professional-desktop/src/runtime/Layer.ts:175-187`).
- **Goal linkage:** none
- **v3→v4 notes:** Do not port v3 `@effect/opentelemetry/OtlpTracer` or `@effect/platform/HttpClient`; reuse beep's v4 `effect/unstable/observability/Otlp` and `effect/unstable/http` wiring, schema-backed config, and `Duration` values (`packages/@core-v2/src/Telemetry/Tracing.ts:11-13,44-62`; `apps/professional-desktop/src/runtime/Observability.ts:21-49`).
- **Effort:** S
- **Verdict hint:** skip

### Extraction, LLM, and embedding-cache metric vocabulary
- **Source:** `packages/@core-v2/src/Telemetry/Metrics.ts:19-315` (effect-ontology)
- **What:** `MetricsService` aggregates extraction, provider/model LLM, and embedding-cache counters in a `Ref`, exposes cache snapshots/reset, and manually renders Prometheus text. The vocabulary is useful, but `chunkCount` is accepted and never recorded, LLM success/failure totals are stored but never emitted, and sums/averages stand in for native histograms (`packages/@core-v2/src/Telemetry/Metrics.ts:19-25,57-83,122-161,213-311`).
- **Category:** service
- **Proposed beep home:** design-reference → `packages/foundation/capability/observability`; concrete ontology/LLM/cache metric names stay with their owning slice or adapter under beep's attribute-ownership rules (`standards/architecture/12-observability.md:30-56`).
- **beep overlap & design delta:** Confirmed present and stronger: beep wraps native Effect metrics for timers, workflow outcomes, and span annotations (`packages/foundation/capability/observability/src/Metric.ts:153-190,200-360`) and exposes native v4 Prometheus formatting through an HTTP Layer (`packages/foundation/capability/observability/src/server/Prometheus.ts:35-69`). Harvest only the bounded metric vocabulary; do not port the Ref store or handwritten exposition.
- **Goal linkage:** none
- **v3→v4 notes:** A literal port would require `Effect.Service`→`Context.Service`, but the better v4 adaptation deletes the service in favor of `Metric` instruments and `effect/unstable/observability/PrometheusMetrics`, using `Effect.fn` wrappers where reusable behavior is warranted (`packages/@core-v2/src/Telemetry/Metrics.ts:103-315`; `packages/foundation/capability/observability/src/Metric.ts:1-29,222-293`).
- **Effort:** S
- **Verdict hint:** design-reference

### Provider-priced LLM cost attribution
- **Source:** `packages/@core-v2/src/Telemetry/CostCalculator.ts:10-68` (effect-ontology)
- **What:** A cross-provider table maps model identifiers to per-million input/output prices, and a pure calculator turns token counts into estimated USD; `annotateLlmCall` attaches that estimate whenever both token counts exist (`packages/@core-v2/src/Telemetry/LlmAttributes.ts:73-100`). The table is self-dated December 2025, lacks provider/effective-date identity, uses floating USD, and silently reports an unknown model as zero cost (`packages/@core-v2/src/Telemetry/CostCalculator.ts:10-31,42-68`).
- **Category:** capability
- **Proposed beep home:** `packages/epistemic/domain` for versioned, deterministic usage-cost attribution; provider price rows remain driver-owned and server/app code may project the result into telemetry. Beep explicitly treats price metadata as product attribution while OTLP remains observability-only (`packages/drivers/anthropic/src/Anthropic.config.ts:124-163`).
- **beep overlap & design delta:** Confirmed present: `UsageRecord` already stores provider, model, input/output/total tokens, latency, and approximate integer USD micros, and the Anthropic driver owns an approximate price row (`packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts:71-128`; `packages/drivers/anthropic/src/Anthropic.config.ts:148-184`). NOT FOUND: a shared token-to-cost calculator or live population path; the desktop handler marks real token/latency wiring TODO and currently writes null cost/tokens (`apps/professional-desktop/src/chat/ChatOrchestrator.ts:167-203`), while repo AI metrics declares provider/model/token/cost unavailable and later work (`packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:1936-1945`; `packages/tooling/library/ai-metrics/README.md:45-49`).
- **Goal linkage:** `agentic-professional-runtime` — model and cost attribution must track provider, model, credential, actor, activity, tokens, latency, and cost (`goals/agentic-professional-runtime/docs/product-feature-map.md:24-32`).
- **v3→v4 notes:** The arithmetic has no difficult Effect API migration; redesign the catalog as schema-first, versioned provider data, return an explicit unavailable/unknown result instead of `0`, and convert once to `costUsdApproxMicros`. Use match helpers for provider/model variants and keep live catalog selection in server/app composition (`standards/architecture/05-layer-composition.md:147-171`).
- **Effort:** M
- **Verdict hint:** adapt-improve

### Privacy-bounded GenAI span attributes
- **Source:** `packages/@core-v2/src/Telemetry/LlmAttributes.ts:19-189` (effect-ontology)
- **What:** One facade defines GenAI provider/model/token attributes plus cost, safe prompt/response lengths, schema hashes, retries, errors, rate-limiter metadata, and extraction counts. It deliberately excludes prompt and response text, but error messages are only truncated and generic technical attributes are mixed with domain-specific `extraction.*` names (`packages/@core-v2/src/Telemetry/LlmAttributes.ts:19-61,73-109,138-189`).
- **Category:** capability
- **Proposed beep home:** `packages/foundation/capability/observability` for vendor-neutral technical GenAI helpers; ontology/extraction attributes stay in the owning use-case/server boundary (`standards/architecture/12-observability.md:30-56`).
- **beep overlap & design delta:** NOT FOUND: a shared product-runtime `gen_ai.*` facade after live source/barrel search. Beep already supplies the stronger policy and primitives: low-cardinality attributes may not contain raw input, secrets, large payloads, or PII (`standards/architecture/12-observability.md:47-56`), deterministic redaction sanitizes and bounds telemetry strings (`packages/foundation/capability/observability/src/CauseRedaction.ts:1-15,169-215`), and repo AI metrics uses an explicit redacted OTLP allowlist (`packages/tooling/library/ai-metrics/src/otlp.ts:39-62`). Adapt the vocabulary, but route errors through beep redaction and keep durable cost in `UsageRecord`.
- **Goal linkage:** `agentic-professional-runtime` — the runtime's durable assertions and usage records require cost-aware, privacy-safe operational evidence (`goals/agentic-professional-runtime/README.md:65-71`; `goals/agentic-professional-runtime/docs/product-feature-map.md:24-32`).
- **v3→v4 notes:** `Effect.annotateCurrentSpan` remains the right v4 primitive, but public helpers should be `Effect.fn`, accept schema-first optional inputs, follow the slice/concept attribute namespace law, and call existing redaction rather than native `.slice` (`packages/@core-v2/src/Telemetry/LlmAttributes.ts:73-151`; `packages/foundation/capability/observability/src/Metric.ts:222-234,323-360`).
- **Effort:** M
- **Verdict hint:** adapt-improve

## Sources (to merge)

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| eo-rt-01 | Production runtime bundles | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/ProductionRuntime.ts:65-234` | provider-selected LLM decoration, extraction, tracing, and infrastructure composition | adapt-improve with attribution |
| eo-rt-02 | Final server runtime and lifecycle | mepuka/effect-ontology | `packages/@core-v2/src/server.ts:140-163,230-314` | app-level Layer graph, startup, health, and graceful shutdown | design-reference |
| eo-rt-03 | Deterministic test runtime | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/TestRuntime.ts:49-246` | production-shaped mocks, config override, and managed runtime | design-reference |
| eo-rt-04 | Pluggable cluster runtime | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/ClusterRuntime.ts:42-134` | SQLite/caller-provided SQL single-runner composition | design-reference |
| eo-rt-05 | Workflow dependency bundles | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/WorkflowLayers.ts:47-583` | pre-provided service bundles, construction order, and open test seams | design-reference |
| eo-rt-06 | Config-driven embedding layers | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/EmbeddingLayers.ts:45-183` | dynamic embedding provider, limiter, cache, metrics, and config composition | design-reference |
| eo-rt-07 | Health-check service | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/HealthCheck.ts:17-153` | liveness, readiness, and bounded deep dependency checks | adapt-improve with attribution |
| eo-rt-08 | Health HTTP routes | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/HttpServer.ts:1049-1076` | probe endpoints and status mapping | design-reference |
| eo-rt-09 | Graceful shutdown service | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Shutdown.ts:16-148` | admission cutoff, in-flight accounting, and bounded drain | adapt-improve with attribution |
| eo-rt-10 | Shutdown request middleware | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/HttpMiddleware.ts:98-115` | HTTP request tracking around shutdown | design-reference |
| eo-rt-11 | Effect-native OTLP tracing Layer | mepuka/effect-ontology | `packages/@core-v2/src/Telemetry/Tracing.ts:21-73` | trace export, shutdown, and disabled/test wiring | skip |
| eo-rt-12 | In-memory Prometheus metrics service | mepuka/effect-ontology | `packages/@core-v2/src/Telemetry/Metrics.ts:19-315` | extraction, LLM, and embedding-cache metric vocabulary | design-reference |
| eo-rt-13 | LLM token cost calculator | mepuka/effect-ontology | `packages/@core-v2/src/Telemetry/CostCalculator.ts:10-68` | model pricing and token-to-USD estimation | adapt-improve with attribution |
| eo-rt-14 | GenAI and extraction span semantics | mepuka/effect-ontology | `packages/@core-v2/src/Telemetry/LlmAttributes.ts:19-189` | PII-minimized usage, cost, retry, error, and extraction attributes | adapt-improve with attribution |
