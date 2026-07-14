# Multi-Provider LLM Dispatch + Graceful Fallback — Research

<!--
Stage 1 synthesis (2026-06-29). Grounds CAPTURE.md's 5-item netNew build list in
external prior art and the existing beep-effect substrate. Per-subtopic raw
findings (verbatim sources, line numbers, Open/Unverified caveats) live under
research/*.md — this file is the cited summary that routes to them.
-->

## External Landscape

The verdict across all five research threads is consistent: **the multi-provider
fallback engine is not net-new — it already ships, MIT-licensed, in the vendored
`effect@4.0.0-beta.91` as `ExecutionPlan`.** The external survey's job was to fix
the reuse-vs-build boundary, kill stale recommendations, and map the BAML /
Instructor / agentmemory / LiteLLM idioms onto Effect primitives.

### Effect fallback/retry substrate — `ExecutionPlan`, not `Layer.orElse`
Raw: [`research/effect-fallback-execution-plan-survey.md`](research/effect-fallback-execution-plan-survey.md)

- The CAPTURE open question "`Layer.orElse` vs `ExecutionPlan` vs `Schedule`"
  resolves decisively: **`Layer.orElse` does not exist in effect v4** (the gold
  nuggets Juris.AI#1 / GOLD_SYNTHESIS proposed it; that is stale v3 advice). The
  canonical multi-provider fallback primitive is **`ExecutionPlan`**, and the
  official Effect doc example is *literally* LLM-provider fallback:
  `ExecutionPlan.make({ provide: OpenAiLanguageModel.model(...), attempts: 3,
  schedule: Schedule.exponential(...), while: (e) => e._tag === "NetworkError" },
  { provide: AnthropicLanguageModel.model(...) })` applied with
  `Effect.withExecutionPlan` — "keeping your business logic provider-agnostic."
  ([effect.website/docs/ai/planning-llm-interactions](https://effect.website/docs/ai/planning-llm-interactions/);
  [effect.website/blog/effect-ai](https://effect.website/blog/effect-ai/), dated 2025-04-01)
- Each `ExecutionPlan` step is `{ provide: Layer|Context, attempts?, schedule?,
  while? }`; the runtime tries steps in declaration order until one succeeds.
  `ExecutionPlan.merge(...plans)` concatenates per-provider sub-plans;
  `ExecutionPlan.CurrentMetadata` exposes `{ attempt, stepIndex }` for "which
  provider served this turn" telemetry.
  ([effect-ts.github.io/effect ExecutionPlan API](https://effect-ts.github.io/effect/effect/ExecutionPlan.ts.html))
- **`ExecutionPlan` is strictly ORDERED fallback. Effect has NO built-in
  round-robin / load-balance and NO circuit breaker.** BAML's `provider
  fallback` maps 1:1 onto ordered steps; BAML's `provider round-robin` does NOT
  map and is net-new. The CircuitBreaker module is still only an open upstream
  proposal — issue
  [Effect-TS/effect#2843](https://github.com/Effect-TS/effect/issues/2843) +
  unmerged PR [#2854](https://github.com/Effect-TS/effect/pull/2854) (ports the
  ZIO Rezilience breaker; last activity ~Oct 2024). Round-robin provider selection,
  if built, composes a `Ref`-indexed `NonEmptyArray` of provider layers over
  **`Layer.unwrap(effectProducingLayer)`** — the current v4 unwrap API. The raw
  notes' `Layer.unwrapEffect` is stale and does NOT exist in vendored effect (only
  `Layer.unwrap`; verified `rg` of `node_modules/effect/src/Layer.ts`, 2026-06-29);
  compile a tiny `Layer.unwrap` provider-selection spike before treating round-robin
  as settled.

### Resilience-strategy config model (BAML/Instructor → Effect)
Raw: [`research/resilience-strategy-config-model.md`](research/resilience-strategy-config-model.md)

- **BAML is Apache-2.0** ([github.com/BoundaryML/baml](https://github.com/BoundaryML/baml));
  its declarative `client<llm>` grammar — ordered `fallback`, `round-robin` (with
  `start` index + rotate-after-retry), and named `retry_policy { type
  constant_delay | exponential_backoff; max_retries; multiplier (default 1.5);
  max_delay_ms (default 10000) }` — is a safe **shape reference only; do NOT
  adopt the Rust runtime**.
  ([fallback](https://docs.boundaryml.com/ref/llm-client-strategies/fallback) ·
  [retry-policy](https://docs.boundaryml.com/ref/llm-client-strategies/retry-policy) ·
  [round-robin](https://docs.boundaryml.com/ref/llm-client-strategies/round-robin))
- **Schedule migration trap (load-bearing):** in effect v4 beta.91
  `Schedule.compose`, `.intersect`, and `.union` DO NOT EXIST — renamed to
  **`either`** (OR/union, min-of-delays) and **`both`** (AND/intersection,
  max-of-delays, stops on first exhaustion). The v4 re-expressions:
  `constant_delay` → `Schedule.both(Schedule.spaced(D), Schedule.recurs(N))`;
  `exponential_backoff` →
  `Schedule.both(Schedule.either(Schedule.exponential(I, M), Schedule.spaced(Max)),
  Schedule.recurs(N))`, optionally `Schedule.jittered`.
  ([built-in schedules](https://effect.website/docs/scheduling/built-in-schedules/) ·
  [retrying](https://effect.website/docs/error-management/retrying/))
- BAML semantics nuance: a `retry_policy` on a *fallback* client tests the
  fallback *after* the whole strategy fails (retry wraps the chain), whereas
  `ExecutionPlan` interleaves each step's own `attempts`/`schedule` then advances
  — so a faithful port puts per-client retry inside each step.
- Circuit-breaker port sources are both Apache-2.0 (reimplement idiomatically
  over `Ref`/`Clock`/`Schedule`, do not vendor):
  [Rezilience (ZIO)](https://github.com/svroonland/rezilience) ·
  [Opossum (Node)](https://github.com/nodeshift/opossum).

### Provider registry + key precedence + prefix auto-detect
Raw: [`research/provider-registry-and-key-precedence-design.md`](research/provider-registry-and-key-precedence-design.md)

- Key precedence is expressed with **`Config.orElse`** (catches *all*
  `ConfigError`, not just missing data — unlike `Config.withDefault`) or, cleaner,
  **`ConfigProvider.orElse` + `ConfigProvider.layer`** so the whole user>env>CLI
  chain is one provided Layer; `ConfigProvider.constantCase` normalizes
  `openai.apiKey` → `OPENAI_API_KEY`.
  ([effect.website/docs/configuration](https://effect.website/docs/configuration/))
- **API-key prefix facts (auto-detect must be ADVISORY, longest-prefix-first):**
  OpenAI `sk-proj-`/`sk-svcacct-`/`sk-admin-` (legacy bare `sk-` phasing out
  since April 2024); Anthropic `sk-ant-api03-` (OAuth `sk-ant-oat01-`); xAI
  `xai-`; OpenRouter `sk-or-v1-`; DeepSeek bare `sk-` (**collides with OpenAI
  legacy**); Mistral has **no** standardized prefix. So naive first-match `sk-`
  misroutes Anthropic/OpenRouter/DeepSeek; a prefix is a *suggestion an explicit
  selection overrides*, never a validity check.
  ([Gemini key docs](https://ai.google.dev/gemini-api/docs/api-key) ·
  [xAI quickstart](https://docs.x.ai/developers/quickstart) ·
  [OpenRouter auth](https://openrouter.ai/docs/api/reference/authentication) ·
  [DeepSeek](https://api-docs.deepseek.com/) ·
  [Mistral keys](https://docs.mistral.ai/admin/security-access/api-keys);
  exact prefix strings corroborated by secondary sources, flagged UNVERIFIED in the raw note)

### Per-provider default-model resolution (the #778 bug class)
Raw: [`research/per-provider-default-model-resolution.md`](research/per-provider-default-model-resolution.md)

- The motivating failure (agentmemory #778): a cross-provider fallback that
  **inherited the primary's model id** 404'd every call and tripped the breaker.
  Fix: each provider in the chain resolves its OWN env-driven default
  (`defaultModelFor(provider) = env(${PROVIDER}_MODEL) ?? pinnedDefault`).
  ([github.com/rohitg00/agentmemory `src/providers/index.ts`](https://github.com/rohitg00/agentmemory/blob/main/src/providers/index.ts))
- **Model strings are NOT portable across provider surfaces** — the same Claude
  model has ≥5 mutually-incompatible id encodings: Anthropic native
  `claude-opus-4-8`; OpenRouter `anthropic/claude-opus-4.8` (dotted); Bedrock
  `anthropic.claude-opus-4-8` / cross-region `us.anthropic.claude-opus-4-8`;
  Vertex `claude-opus-4-5@20251101`. Reusing one across boundaries is a
  guaranteed 404.
  ([code.claude.com model-config](https://code.claude.com/docs/en/model-config) ·
  [Bedrock inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html) ·
  [Vertex Claude](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude);
  cross-boundary 404 corroborated by [OpenClaw #20107](https://github.com/openclaw/openclaw/issues/20107))
- Canonical prior art for the invariant (each fallback target carries its own
  model+auth, never the requester's): **Claude Code** model-selection precedence
  `/model` → `--model` → `ANTHROPIC_MODEL` → settings, with `ANTHROPIC_BASE_URL`
  orthogonal to model resolution and `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU,FABLE}_MODEL`
  per-family pinning; **LiteLLM** per-deployment `model_list` + `fallbacks` /
  `context_window_fallbacks` / `default_fallbacks`
  ([docs.litellm.ai/docs/proxy/reliability](https://docs.litellm.ai/docs/proxy/reliability));
  **Vercel AI SDK** `createProviderRegistry` `providerId:modelId` namespacing
  ([ai-sdk.dev provider-management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)).

### Structured output + secret governance
Raw: [`research/structured-output-and-secret-governance.md`](research/structured-output-and-secret-governance.md)

- `response_model`-style structured output (courtlistener#5 / Instructor
  `from_provider`+`response_model`) is **already first-class in effect**:
  `LanguageModel.generateObject({ prompt, schema })` returns the DECODED type, and
  per-provider JSON-Schema differences are handled by a pluggable
  `CodecTransformer` with two shipped instances (`OpenAiStructuredOutput`,
  `AnthropicStructuredOutput`) — the caller does not re-implement `response_model`.
  ([Instructor models](https://python.useinstructor.com/concepts/models/) ·
  [effect LanguageModel API](https://effect-ts.github.io/effect/ai/ai/LanguageModel.ts.html))
- Provider gotchas the fallback must respect: **OpenAI** `strict:true` requires
  `additionalProperties:false`, all props in `required`, no `default`
  ([OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)).
  **Anthropic** structured outputs went GA (public beta **2025-11-14**, header
  `structured-outputs-2025-11-13`, param moved `output_format` →
  `output_config.format`); limits: no recursion, no `$ref`, ≤20 strict tools, ≤16
  union params
  ([platform.claude.com structured-outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).
  Effect's **vendored Anthropic provider does native `json_schema` structured
  output** for supported model ids: `AnthropicLanguageModel.ts` detects
  `supportsStructuredOutput` per model and `getOutputFormat` emits
  `{ type: "json_schema", schema }` when supported, falling back to the tool-based
  path only for unsupported/unknown models (verified
  `node_modules/@effect/ai-anthropic/src/AnthropicLanguageModel.ts`, 2026-06-29).
  Upstream issue
  [Effect-TS/effect#6091](https://github.com/Effect-TS/effect/issues/6091) is now
  historical/migration context, not an open caveat for supported Claude 4.5+ ids.
  **Gemini** rejects empty-`properties` object schemas — forward-looking only (no
  Gemini driver in repo).
- **Secret governance — desktop-never-holds-the-key broker indirection**
  (stenoai#2, **MIT**, freely reimplementable): route AI requests through an
  adapter that holds the provider key server-side; the desktop carries only a
  short-lived JWT/bearer to a `base_url`. Canonical prior art: **LiteLLM**
  JWT→virtual-key mapping
  ([jwt_key_mapping](https://docs.litellm.ai/docs/proxy/jwt_key_mapping)) and
  **Cloudflare AI Gateway** BYOK
  ([authentication](https://developers.cloudflare.com/ai-gateway/configuration/authentication/)).
  Local-keychain alternative (Electron `safeStorage`) has a **Linux trap**: with no
  secret store it silently falls back to plaintext (`basic_text`)
  ([electronjs safe-storage](https://www.electronjs.org/docs/latest/api/safe-storage)).

## In-Repo Capability Inventory

beep-effect already owns nearly the entire substrate. The net-new is a thin
dispatch Layer ABOVE the four existing drivers — NOT the drivers, NOT a retry
engine, NOT a structured-output binder. All paths below verified via `rg`/`ls`
on 2026-06-29.

**Runtime / fallback engine (vendored, MIT):**
- `effect@4.0.0-beta.91` pinned with `@effect/ai-{anthropic,openai,openrouter}` all
  **declared** at matching `4.0.0-beta.91` in root `package.json` — but only
  `@effect/ai-anthropic` is **materialized in `node_modules/@effect/`**;
  `@effect/ai-openai` and `@effect/ai-openrouter` are ABSENT from the current
  checkout (verified `ls node_modules/@effect/`, 2026-06-29). Treat the trio as a
  *root-manifest/catalog* declaration, NOT a verified-installed-vendored inventory.
  V1 implementation must target the existing `@beep/openai-compat` / `@beep/xai` /
  `@beep/venice-ai` drivers, NOT the un-installed `@effect/ai-openai` /
  `@effect/ai-openrouter` packages.
- **`ExecutionPlan`** (`ExecutionPlan.make` / `.merge` / `CurrentMetadata`) +
  `Effect.withExecutionPlan` / `Stream.withExecutionPlan` (with
  `preventFallbackOnPartialStream`) — the ordered-fallback engine. Verified
  imported and used in repo at `packages/drivers/anthropic/src/Anthropic.service.ts:103`
  and `Anthropic.repair.ts:102,156`.
- **`Schedule`** combinators (`exponential`, `spaced`, `recurs`, `jittered`,
  `either`, `both`) — the retry-policy vocabulary; used at
  `packages/drivers/anthropic/src/Anthropic.service.ts:106`.
- **`Config` / `ConfigProvider`** (`Config.redacted`, `Config.orElse`,
  `Config.option`, `ConfigProvider.orElse`, `ConfigProvider.layer`,
  `constantCase`) — the key-precedence primitives. Verified present in
  `node_modules/effect/dist/{Config,ConfigProvider}.d.ts`.
- **`effect/unstable/ai`** surface present: `LanguageModel` (with
  `generateObject`), `Model` (provides `ProviderName`+`ModelName`), `AiError`
  (normalized `isRetryable` taxonomy + provider-directed backoff), `Toolkit`/`Tool`,
  `OpenAiStructuredOutput`, `AnthropicStructuredOutput` — verified
  `ls node_modules/effect/dist/unstable/ai/`. **`AiError.RateLimitError` carries an
  optional `retryAfter: Duration` and is always retryable; the top-level `AiError`
  delegates `isRetryable` and `retryAfter` to the underlying reason** (verified
  `node_modules/effect/src/unstable/ai/AiError.ts`, 2026-06-29) — so resilience
  policy must make `retryAfter` first-class: keep
  `while: AiError.isAiError(e) && e.isRetryable` as the advance gate, but have
  schedule construction consult `error.retryAfter` when present instead of keying on
  `isRetryable` alone, or the chain ignores provider-directed backoff and retries
  earlier than the provider requested.

**Four LLM drivers — public barrel APIs are NOT uniform; the registry must adapt
per-driver. Each package's `exports` field exposes only `"."`, so deep
service-path imports are NOT public aliases — usage below is verified against each
`src/index.ts` barrel (2026-06-29):**
- `@beep/anthropic` (`packages/drivers/anthropic`): public constructor is
  `makeAnthropicLanguageModelLayer(options?)` →
  `Layer.Layer<LanguageModel.LanguageModel, ...>` (`Anthropic.service.ts:57`).
  **There is NO `.model()` constructor** — the barrel exports config/errors/repair +
  `AnthropicLanguageModelLive`, not an `AnthropicLanguageModel.model`. Ships
  single-provider `AnthropicTurnPlan` / `makeAnthropicRepairPlan` built with
  `ExecutionPlan.make`; pins `ANTHROPIC_API_KEY_ENV = "AI_ANTHROPIC_API_KEY"`
  (non-standard) and `ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-6"`
  (`Anthropic.config.ts:26,46`). The `while` predicate is typed
  `(error: AiError.AiError | Config.ConfigError) => AiError.isAiError(error) &&
  error.isRetryable` (`Anthropic.service.ts:107`).
- `@beep/openai-compat` (`packages/drivers/openai-compat`): the barrel re-exports
  **top-level `layer` and `model`** (`export * from
  "./OpenAiCompatLanguageModel.service.ts"`) — import as
  `import { layer as openAiCompatLayer, model as openAiCompatModel } from
  "@beep/openai-compat"`. There is **no `OpenAiCompatLanguageModel` namespace
  export** (the earlier `OpenAiCompatLanguageModel.layer` reading was wrong; that
  module path is internal, not a public alias). `layer(...)` →
  `Layer.Layer<LanguageModel.LanguageModel, never, OpenAiCompatClient>`
  (`OpenAiCompatLanguageModel.service.ts`). **Already broker-ready:** `apiUrl` is
  `S.optionalKey` (defaults `https://api.openai.com/v1`) and the bearer is
  conditional — `options.apiKey === undefined ? identity :
  HttpClientRequest.bearerToken(...)` (`OpenAiCompatClient.service.ts:55-56,173-174`).
- `@beep/xai` (`packages/drivers/xai`): namespaced `export * as XAiLanguageModel`
  exposes both `XAiLanguageModel.layer` →
  `Layer.Layer<LanguageModel.LanguageModel, never, XAi>` (service.ts:208) and
  `XAiLanguageModel.model(name)` → `AiModel.Model<"xai", LanguageModel, XAi>`
  (`XAiLanguageModel.service.ts:226`); reads `XAI_API_KEY`.
- `@beep/venice-ai` (`packages/drivers/venice-ai`): namespaced
  `export * as VeniceAiLanguageModel` exposes `VeniceAiLanguageModel.layer` →
  `Layer.Layer<LanguageModel.LanguageModel, never, VeniceAI>` (service.ts:201) and
  `VeniceAiLanguageModel.model(name)` → `AiModel.Model<"venice", LanguageModel,
  VeniceAI>` (`VeniceAiLanguageModel.service.ts:219`);
  `VENICE_CHAT_MODEL = "venice-uncensored-1-2"` (`VeniceAI.service.ts:55`).
- **The `.model(name)` → `AiModel.Model<provider, ...>` model-identity carrier (the
  per-step carrier that structurally prevents the #778 model-inheritance bug) exists
  ONLY on xai/venice.** Anthropic and openai-compat expose only Layer constructors
  (`makeAnthropicLanguageModelLayer` / top-level `layer`). So the dispatch registry
  MUST be an **adapter table over these four distinct surfaces**, not a single
  `driver.model(...)` call — a literal "each driver exposes `.model`" registry will
  NOT compile. **Add a compile / dtslint proof of the registry import surface before
  shape/decompose.**

**Consumer wiring already exists:** `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:129`
runs `Stream.withExecutionPlan(AnthropicTurnPlan, { preventFallbackOnPartialStream:
true })` — so the streaming-fallback plumbing is proven; net-new is swapping the
single-provider plan for a multi-provider one.

**Supporting capability:**
- Typed-error convention `TaggedErrorClass` from `@beep/schema`
  (`packages/foundation/modeling/schema/src/TaggedErrorClass/`) — the structured
  `api_key_required`/`ProviderApiKeyMissing` error must be a `TaggedErrorClass`,
  not a bare throw.
- `LiteralKit` + `S.toTaggedUnion` (driver error-reason enums, e.g.
  `packages/drivers/venice-ai/src/VeniceAI.service.ts`) — the provider-name union
  and key-source enum (`user`|`env`|`cli`) should be `LiteralKit` literals.
- `@beep/onepassword-cli` driver (`packages/drivers/onepassword-cli`) + the
  `onepassword-secret-refs` skill — a third local credential option (`op://`
  resolution) for the pluggable key resolver.
- `@beep/ai-provider-cli` (`packages/drivers/ai-provider-cli`) — driver-level
  Claude/Codex CLI auth-status wrapper (adjacent, not a dispatch component).

**Genuine gaps (NOT FOUND — these are the build list):**
- **NOT FOUND**: any multi-provider dispatch Layer / registry — `rg` for
  `ProviderRegistry|dispatchLanguageModel|fallbackChain|LanguageModelRouter|PROVIDER_REGISTRY`
  across `packages/` returns nothing. Only the single-provider Anthropic kernel
  uses `withExecutionPlan` today. (netNew #1, #3)
- **NOT FOUND**: any user-key>env>CLI key-precedence resolver — each driver only
  reads its own `Config.redacted(ENV)`; no shared resolver service exists.
  (netNew #1 / secret-governance §E)
- **NOT FOUND**: `Layer.orElse` in vendored effect — `grep` of
  `node_modules/effect/dist/Layer.d.ts` finds no `orElse` (only `catch`,
  `catchCause`, `catchTag`, `fresh`, `provide`). The gold-nugget recommendation is
  stale; use `ExecutionPlan`.
- **NOT FOUND**: any `CircuitBreaker` or `RateLimiter` module in vendored effect
  (`ls node_modules/effect/dist/` — none). Round-robin + circuit-breaker are
  genuine net-new (`Ref`/`Clock`/`Schedule` state machines). (netNew #4)
- **NOT FOUND**: any shared `@beep` `RetryPolicy`/`Schedule` foundation module —
  `rg "RetryPolicy"` across `packages/` finds only inline per-driver Anthropic
  schedules and a `PgConnectRetryPolicy` test helper
  (`packages/tooling/test-kit/test-utils/src/SqlTest.ts`), NOT an importable shared
  LLM/network policy library (verified 2026-06-29). The sibling
  `effect-orchestration-patterns` exploration may *own* this future module, but it is
  NOT an available dependency today — this is a **sequencing dependency, not an
  import**. Either graduate/build that sibling policy module first, or let this packet
  own a minimal local config-to-`Schedule` adapter that can later be promoted without
  changing the dispatch contract.
- **NOT FOUND**: a Gemini/Google driver — `packages/drivers/` has no Gemini entry
  (anthropic, openai-compat, xai, venice-ai, ai-provider-cli only). A registry
  `gemini` entry is net-new driver work (non-bearer `x-goog-api-key` auth + 2026
  key transition → highest-maintenance; defer past V1).
- **NOT FOUND**: a `GeminiStructuredOutput` transformer in vendored
  `effect/unstable/ai` (only OpenAI + Anthropic) — so the Gemini empty-`properties`
  normalization is documented-but-not-needed unless a Gemini driver is added.

## Constraints

**Deprecations / dated moving targets:**
- `effect/unstable/ai` is in the explicitly-`unstable` namespace and the repo is
  on a **beta** (`4.0.0-beta.91`); `ExecutionPlan`, `Model.make`, and the
  `AiError` union may shift before GA. Pinned beta current as of 2026-06-29.
- **`Schedule.compose`/`.intersect`/`.union` removed in v4** → use `either`/`both`.
  Any seed snippet using `.compose` will not compile (verified absent from
  `node_modules/effect/dist/Schedule.d.ts`).
- **OpenAI** legacy bare `sk-` keys phasing out since **April 2024**.
- **Google Gemini** Standard `AIza` keys will be **REJECTED starting September
  2026** (new "Auth keys", some `AQ.` prefixed); auth uses `x-goog-api-key`, not
  `Authorization: Bearer`. Treat `AIza`/`AQ.` detection as advisory + time-boxed.
- **`ANTHROPIC_SMALL_FAST_MODEL` deprecated** in favor of
  `ANTHROPIC_DEFAULT_HAIKU_MODEL` (Claude Code config).
- **Anthropic structured outputs** GA since **2025-11-14**; the **vendored
  `@effect/ai-anthropic` does native `json_schema`** for supported model ids and
  tool-emulates only for unsupported/unknown ones (`AnthropicLanguageModel.ts`
  `supportsStructuredOutput`/`getOutputFormat`, verified 2026-06-29) — issue #6091 is
  historical context, not an open risk for supported Claude 4.5+ ids.

**Licensing gravity (reimplement, do not copy):**
- harvest-mcp#1 `ProviderFactory` (registry+precedence): **unknown license →
  reimplement clean-room**, do not port verbatim.
- agentmemory#4 `defaultModelFor` (#778 fix): **license unverified → reimplement**;
  the pattern is trivial enough to rebuild license-free. Default-model literals
  (`claude-sonnet-4-20250514`, `gpt-4o-mini`, …) are stale — port the pattern, not
  the strings.
- courtlistener#5 (`response_model`) + mike#10 (tool-schema adapter):
  **AGPL-3.0 → patterns only, NO code** (both verified). Both are structurally
  superseded by effect `generateObject` / `Toolkit`.
- BAML (TalentScore#2 / research-squad#15): **Apache-2.0 → config-shape reference
  only; do NOT adopt the Rust runtime.**
- stenoai#2 (adapter/JWT governance): **MIT → free to reimplement** (re-express in
  Effect regardless).
- Circuit-breaker port sources Rezilience + Opossum: **both Apache-2.0** →
  reimplement idiomatically over `Ref`/`Clock`/`Schedule`, do not vendor.

**Locked / structural decisions (settled by this research):**
- Fallback mechanism = **`ExecutionPlan`** (Layer.orElse is dead).
- `ExecutionPlan` is **strictly ordered**; round-robin + circuit-breaker are
  net-new state machines, not framework features.
- Per-provider model resolution is **mandatory** (model strings non-portable);
  resolve `env(${PROVIDER}_MODEL) ?? pinnedDefault` per provider at fallback time.
  Registry MUST READ the driver config constants (e.g. `ANTHROPIC_DEFAULT_MODEL`),
  not re-declare them, to prevent drift.
- Registry MUST source `requiredEnvVar` from the driver constant — Anthropic's is
  **non-standard `AI_ANTHROPIC_API_KEY`**, not `ANTHROPIC_API_KEY`.
- Do NOT re-implement `response_model` or a tool-schema adapter — compose
  `generateObject` + the shipped per-provider `CodecTransformer`s, and author
  tools once with `Tool.make`/`Toolkit.make`.
- The shared `Schedule`-policy library is a **sequencing dependency on** sibling
  exploration `effect-orchestration-patterns` (netNew #1), NOT an available import —
  no such `@beep` module exists yet (verified 2026-06-29). Either build that module
  first or have this packet own a promotable local config-to-`Schedule` adapter; the
  declarative config surface ABOVE it is this packet's scope.

**Auth / secret / offline boundaries:**
- **Repo is PUBLIC** — provider strategy/keys must never enter the tree. Broker
  indirection (desktop holds only a short-lived JWT to an adapter `base_url`) is
  recommended for the privilege-sensitive solo-attorney app; the openai-compat
  driver already supports it (optional `apiUrl` + conditional bearer) — so this is
  a new dispatch-level `ApiKeyResolver` service, NOT new driver code.
- Electron `safeStorage` on Linux with no secret store silently degrades to
  plaintext (`basic_text`) — prefer `op://` (onepassword-cli) or broker over raw
  at-rest keys.
- Key-prefix auto-detect is **advisory only, never a validity check** — Mistral
  has no prefix, DeepSeek collides with OpenAI legacy `sk-`; never reject a key on
  unrecognized prefix; explicit selection always overrides.

**Routing cautions / unresolved (carry to ALIGN):**
- **Precedence direction is an explicit ALIGN decision, not a fact** — the gold
  nuggets contradict each other (harvest-mcp "CLI > params > env"; Juris.AI "user >
  env"; netNew#3 "user > env > CLI"). Research recommends
  `user-supplied (per-request) > CLI flag > env` for an interactive desktop app;
  log in DECISIONS.md.
- **Missing-key on the PRIMARY fails fast today** — the existing Anthropic `while`
  predicate (`AiError.isAiError && isRetryable`) does NOT advance on a
  `Config.ConfigError`. Decide whether a missing primary key should advance to the
  fallback step or fail fast (currently fails fast). Unresolved.
- **Cross-provider streaming fallback UX** — `preventFallbackOnPartialStream: true`
  surfaces a mid-stream provider failure as an error rather than splicing a second
  provider. Fail-hard vs restart-on-new-provider for streamed turns is a product
  decision, not framework-settled.
- **Schema-validation failures must be defects (`Effect.die`), never retried** —
  align with sibling law EF-31 (`BamlParseError` → `Effect.die`); keep them out of
  the `while`-retryable channel.
- Verify the BAML Apache-2.0 LICENSE and the Rezilience/Opossum LICENSE files
  before mirroring any grammar/port; re-check upstream Effect circuit-breaker
  PR #2854 status (last datapoint Oct 2024) in case a native primitive landed.

---

_Codex gate-1 folded 2026-06-29: 1 blocking + 5 advisory addressed._

## 2026-07-14 — Closure amendment

The June research correctly identified ordered `ExecutionPlan` reuse, but its
Q1-Q7 build list was overtaken by two sibling packets and the shipped auth leg.
This amendment is the closure-time inventory; where it conflicts with the June
recommendations, the 2026-07-14 locked decisions control.

### Cross-packet constraints that close Q1-Q7

- [`effect-orchestration-patterns`](../effect-orchestration-patterns/DECISIONS.md)
  now locks consumer-led adoption: LLM retry predicates remain at driver
  boundaries; shared LLM retry policy requires a second `ExecutionPlan`
  consumer; runtime provider selection stays app-local until a concrete runtime
  needs compatible providers; round-robin and circuit breaking remain behind
  their own demand gates. This removes shared schedules, build-time selection,
  circuit breaking, round-robin, and a resilience bundle from this packet.
- [`ingestion-security-secret-governance`](../ingestion-security-secret-governance/DECISIONS.md)
  owns provider-neutral credential resolution. Its resolution semantics advance
  only on typed absence/placeholder outcomes and stop on authentication,
  transport, malformed-reference, and integrity failures. The source order is
  user vault -> `op://` reference -> environment; CLI subscription tokens are
  outside the chain. Dispatch therefore consumes a credential-resolution port
  and decides only whether an eligible target is available or the ordered plan
  may advance.
- Key-prefix detection has no authorization meaning. At most it remains
  app-local onboarding advice; it is not a dispatch or resolution contract.

### Live ExecutionPlan and driver surface inventory

- Vendored ordered fallback is implemented at
  `.repos/effect-v4/packages/effect/src/ExecutionPlan.ts`. Its public step shape
  provides a `Context` or `Layer` plus optional `attempts`, `while`, and
  `schedule`; no wrapper engine is needed. Provider-neutral structured output
  remains available through
  `.repos/effect-v4/packages/effect/src/unstable/ai/LanguageModel.ts`
  (`generateObject`).
- Anthropic public barrel: `packages/drivers/anthropic/src/index.ts`; its live
  language-model constructors and plan are exported from
  `packages/drivers/anthropic/src/Anthropic.service.ts`
  (`makeAnthropicLanguageModelLayer`, `AnthropicLanguageModelLive`,
  `AnthropicTurnPlan`).
- OpenAI-compatible public barrel:
  `packages/drivers/openai-compat/src/index.ts`; the current barrel exports
  `make`, `layer`, and `model` from
  `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts`.
  This corrects the June snapshot that described it as layer-only.
- xAI public barrel: `packages/drivers/xai/src/index.ts`; it exposes the
  `XAiLanguageModel` namespace backed by
  `packages/drivers/xai/src/XAiLanguageModel.service.ts` (`make`, `layer`,
  `model`).
- Venice AI public barrel: `packages/drivers/venice-ai/src/index.ts`; it
  exposes the `VeniceAiLanguageModel` namespace backed by
  `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts` (`make`,
  `layer`, `model`).

These are four live provider drivers, not one uniform driver interface. The
first two-target consumer should use an app-local match. A later static adapter
table must use these public barrels only and carry compile/dtslint evidence that
each adapter constructs the common `LanguageModel.LanguageModel` surface.

### Corrected ProviderInstance premise

[`goals/llm-provider-subscription-auth/SPEC.md`](../../goals/llm-provider-subscription-auth/SPEC.md)
defines `ProviderInstance` as vendor-CLI delegation. The live entity at
`packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.model.ts`
stores a CLI binary path, isolated HOME, token-safe env configuration, and the
latest auth-probe snapshot. Its value schemas at
`packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.values.ts`
reject token-bearing environment names, and
`packages/agents/server/src/ProviderInstance/ProviderInstance.probe.ts` invokes
the `@beep/ai-provider-cli` auth probe.

That surface has no language-model endpoint, model identity, API base URL, or
beep-readable provider credential. An authenticated `ProviderInstance` is not a
dispatchable target, and vendor CLI tokens are never beep-resolvable
credentials. Runtime dispatch remains demand-gated until a real consumer has
two compatible targets whose credentials resolve through the secret-governance
port.
