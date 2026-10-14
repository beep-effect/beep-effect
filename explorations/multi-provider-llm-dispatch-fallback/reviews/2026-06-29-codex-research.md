# Codex research-gate critique — multi-provider-llm-dispatch-fallback (2026-06-29)

## Blocking

- **Claim** | `RESEARCH.md` / In-Repo Capability Inventory / Four LLM drivers: "Each driver also exposes `.model(name)` returning `AiModel.Model<provider, ...>`" and the surrounding inventory names `OpenAiCompatLanguageModel.layer`.
  Why wrong | Barrel verification does not support a uniform public API. `@beep/anthropic` exports `makeAnthropicLanguageModelLayer`, `AnthropicTurnPlan`, and config constants, but no public `.model` constructor. `@beep/openai-compat` exports top-level `layer` / `model` from `src/index.ts`, not an `OpenAiCompatLanguageModel` namespace; its package exports only `"."`, so deep service imports are not a public alias. `@beep/xai` and `@beep/venice-ai` do export `XAiLanguageModel` / `VeniceAiLanguageModel` namespaces with `.layer` and `.model`. The research's "each driver" wording will produce a non-compiling registry if implemented literally.
  Fix | Replace the uniform-driver claim with an adapter table using the actual package barrels: Anthropic `makeAnthropicLanguageModelLayer(...)`; OpenAI-compatible `{ layer, model }` imported from `@beep/openai-compat` with local aliases; xAI `XAiLanguageModel.layer/model`; Venice `VeniceAiLanguageModel.layer/model`. Add a compile/dtslint proof for the registry import surface before shape/decompose.

## Advisory

- **Claim** | `RESEARCH.md` / Runtime fallback engine: "`effect@4.0.0-beta.91` pinned with `@effect/ai-{anthropic,openai,openrouter}` all at matching `4.0.0-beta.91` -- verified `package.json`."
  Why wrong | The root `package.json` lists all three, but the current checkout's materialized `node_modules/@effect` only contains `ai-anthropic`; `node_modules/@effect/ai-openai/package.json` and `node_modules/@effect/ai-openrouter/package.json` are absent, and a lock/package search found no installed package records for those two. The statement is safe only as a root manifest/catalog claim, not as a verified installed-vendored inventory.
  Fix | Qualify this as "declared in root package.json" unless an install materializes and verifies the packages. Keep V1 implementation guidance pointed at the existing `@beep/openai-compat`, `@beep/xai`, and `@beep/venice-ai` drivers, not missing `@effect/ai-openai` / `@effect/ai-openrouter` packages.

- **Claim** | `research/resilience-strategy-config-model.md` / Round-robin and circuit breaker: provider selection should use "`Layer.unwrapEffect`"; the same raw note says the sibling policy library includes "`Layer.unwrapEffect` provider selection."
  Why wrong | `node_modules/effect/src/Layer.ts` exports `Layer.unwrap` for `Effect<Layer<...>>`; `rg` found no `unwrapEffect` symbol in `node_modules/effect/src`, `node_modules/effect/dist`, or packages. This is stale API naming in the raw evidence that `RESEARCH.md` routes to.
  Fix | Update the raw note and any derived shape language to `Layer.unwrap(effectProducingLayer)`. If round-robin remains in scope, compile a tiny `Layer.unwrap` provider-selection spike before treating the pattern as settled.

- **Claim** | `RESEARCH.md` / Runtime fallback engine: `Schedule` is the retry-policy vocabulary and `AiError` supplies a normalized `isRetryable` taxonomy.
  Why wrong | This is incomplete for rate limits. `node_modules/effect/src/ai/AiError.ts` defines `RateLimitError` with optional `retryAfter`, marks it retryable, and the top-level `AiError` delegates `retryAfter`. A design that only keys on `isRetryable` can ignore provider-directed backoff and retry earlier than requested.
  Fix | Extend the resilience strategy notes so `RateLimitError.retryAfter` is first-class. Keep `while: AiError.isAiError(error) && error.isRetryable` as the gate, but let schedule construction consult `error.retryAfter` when present.

- **Claim** | `RESEARCH.md` / Structured output + constraints: "`@effect/ai-anthropic` may still emulate via forced tool-call ... verify the vendored build."
  Why wrong | The uncertainty can now be closed locally. `node_modules/@effect/ai-anthropic/src/AnthropicLanguageModel.ts` has model capability detection with `supportsStructuredOutput`, and `getOutputFormat` returns `{ type: "json_schema", schema }` for JSON response format on supported models. The provider still has tool-based paths, but native structured output is present for supported Claude model ids in this vendored build.
  Fix | Replace the open caveat with the verified local behavior: native Anthropic `json_schema` output for supported 4.5+ model ids; tool-based fallback for unsupported/unknown models. Keep the upstream issue only as historical/migration context.

- **Claim** | `RESEARCH.md` / Locked structural decisions: "The shared `Schedule`-policy library is owned by sibling exploration `effect-orchestration-patterns` ... this packet imports it."
  Why wrong | The actual repo has no shared public `@beep` RetryPolicy/Schedule foundation module yet. Targeted `rg` found inline Anthropic schedules and a `PgConnectRetryPolicy` test helper, but no importable shared LLM/network/database policy library. The sibling exploration may own the future work, but it is not an available dependency today.
  Fix | Rephrase as an explicit sequencing dependency: either graduate/build the sibling policy module first, or let this packet own a minimal local config-to-`Schedule` adapter that can later be promoted without changing the dispatch contract.

## Confirmed sound

- `Layer.orElse` is absent from `node_modules/effect/src/Layer.ts` and `node_modules/effect/dist/Layer.d.ts`; `Layer.unwrap` is the current unwrap API.
- `ExecutionPlan` is present, ordered, and consumed by `Effect.withExecutionPlan` / `Stream.withExecutionPlan`; `CurrentMetadata` exposes `attempt` and `stepIndex`.
- `ExecutionPlan.while` is not just decorative: `internal/executionPlan.ts` builds schedules with `step.while`, including when moving to a later step after a previous failure. The "missing primary key fails fast with the current AiError-only predicate" caution survives scrutiny.
- v4 `Schedule.either` / `Schedule.both` / `exponential` / `spaced` / `recurs` / `jittered` are present; `Schedule.compose`, `Schedule.intersect`, and `Schedule.union` were not found as exported v4 APIs.
- The claimed `@beep/*` package aliases all exist and have `src/index.ts` barrels: `@beep/anthropic`, `@beep/openai-compat`, `@beep/xai`, `@beep/venice-ai`, `@beep/schema`, `@beep/onepassword-cli`, and `@beep/ai-provider-cli`.
- `@beep/schema` publicly exports `TaggedErrorClass` and `LiteralKit`; the Venice driver uses `LiteralKit` plus `S.toTaggedUnion` in the cited error-reason modeling pattern.
- No existing multi-provider dispatch Layer / registry was found for `ProviderRegistry|dispatchLanguageModel|fallbackChain|LanguageModelRouter|PROVIDER_REGISTRY` across `packages/`.
- No vendored Effect `CircuitBreaker` or `RateLimiter` module was found; no Gemini driver exists under `packages/drivers`, and `effect/ai` ships OpenAI and Anthropic structured-output transformers but no Gemini transformer.
