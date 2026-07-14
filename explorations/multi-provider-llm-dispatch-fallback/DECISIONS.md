# Multi-Provider LLM Dispatch + Graceful Fallback — Decisions

<!--
Stage 2 (align) seed. Pre-drafted from RESEARCH.md + CAPTURE.md. Each question
poses a branch-closing fork with a RECOMMENDED answer and grounded rationale,
left **open** for the user to resolve via `/grill-with-docs
multi-provider-llm-dispatch-fallback`. Do not treat recommendations as decided.
-->

## Q1: Does this packet own only the declarative dispatch/registry surface ABOVE `ExecutionPlan`, or also the shared retry/`Schedule` policy library plus round-robin + circuit-breaker?

**Recommended:** Own only the thin dispatch surface — the provider registry,
the user>CLI>env key-precedence resolver, per-provider default-model resolution,
and the multi-provider `ExecutionPlan` *builder*. Treat the reusable
`Schedule`-policy library as a **sequencing dependency on sibling exploration
`effect-orchestration-patterns`**, not an import this packet ships. Round-robin
and circuit-breaker are explicitly out of V1 (see Q7). Where this packet needs a
config-to-`Schedule` adapter before the sibling graduates, own a *minimal,
promotable local* adapter that can later be lifted without changing the dispatch
contract.

**Rationale:** RESEARCH is decisive that the fallback engine itself is not
net-new — `ExecutionPlan` already ships MIT-licensed in vendored
`effect@4.0.0-beta.91` and the official doc example is literally LLM-provider
fallback. The genuine `NOT FOUND` gaps are the dispatch Layer/registry, the
user>env>CLI resolver, and per-provider model resolution — a thin Layer ABOVE
the four existing drivers. RESEARCH also flags that no shared `@beep`
`RetryPolicy`/`Schedule` module exists today and that the sibling
`effect-orchestration-patterns` packet (whose own openQuestions include "pure-
Schedule layer" and "which driver migrates first") plausibly owns that future
module — making it a *sequencing dependency, not an available import*. Absorbing
the retry library + state machines would re-scope a P2 wedge into a multi-goal
program and collide with a sibling that already claims that ground.

**Status:** open (for /grill-with-docs)

## Q2: Build-vs-buy the fallback engine — reuse vendored `ExecutionPlan` + the four existing drivers and clean-room only the glue, or build/port a bespoke fallback engine?

**Recommended:** Buy the engine (vendored `ExecutionPlan` +
`Effect.withExecutionPlan`/`Stream.withExecutionPlan`) and the four existing
drivers; build only the clean-room glue (registry, resolver, per-provider model
resolution, multi-provider plan builder). Port *shapes* from prior art, never
code: harvest-mcp#1 `ProviderFactory` and agentmemory#4 `defaultModelFor` are
reimplement-clean-room (unknown/unverified license); courtlistener#5 + mike#10
are AGPL-3.0 (patterns only) and structurally superseded; BAML is Apache-2.0
config-shape reference only — do NOT adopt its Rust runtime.

**Rationale:** RESEARCH locks "Fallback mechanism = `ExecutionPlan` (Layer.orElse
is dead)" — the gold-nugget `Layer.orElse` recommendation is stale v3 advice and
`grep` confirms it is absent from vendored effect. The drivers, the `AiError`
retryable taxonomy (with first-class `retryAfter`), and structured output
(`generateObject` + shipped `CodecTransformer`s) all already exist, so a bespoke
engine would duplicate vendored MIT substrate. The licensing gravity section
makes literal "buy/copy" of the prior-art repos infeasible regardless; the
remaining glue is small enough to rebuild license-free.

**Status:** open (for /grill-with-docs)

## Q3: First slice — which providers and which consumer prove V1?

**Recommended:** Prove V1 with Anthropic-primary → one fallback step (xAI or
openai-compat) over the **four already-installed drivers** (`@beep/anthropic`,
`@beep/openai-compat`, `@beep/xai`, `@beep/venice-ai`), wired into the existing
`AnthropicTurnKernel` `Stream.withExecutionPlan` seam — swapping its single-
provider `AnthropicTurnPlan` for a multi-provider plan. Do NOT target the
`@effect/ai-openai` / `@effect/ai-openrouter` packages, and defer a Gemini/Google
driver entirely.

**Rationale:** RESEARCH verified that although the `@effect/ai-{openai,openrouter}`
packages are *declared* in root `package.json`, they are ABSENT from
`node_modules/@effect/` (only `@effect/ai-anthropic` is materialized) — so V1
must target the existing `@beep/*` drivers, not the un-installed packages. The
streaming-fallback plumbing is already proven: `AnthropicTurnKernel.ts:129` runs
`Stream.withExecutionPlan(AnthropicTurnPlan, { preventFallbackOnPartialStream:
true })`, so the net-new is swapping a single-provider plan for a multi-provider
one at a seam that already exists. A Gemini driver is net-new driver work
(non-bearer `x-goog-api-key` + the Sept-2026 `AIza` key rejection → highest
maintenance) and is explicitly defer-past-V1. Open sub-fork to resolve here:
cross-provider streaming fallback UX — `preventFallbackOnPartialStream: true`
fails a mid-stream provider error rather than splicing a second provider
(fail-hard vs restart-on-new-provider is a product decision, not framework-
settled).

**Status:** open (for /grill-with-docs)

## Q4: Registry shape — an adapter table over the four non-uniform driver surfaces (reading each driver's config constants), or a uniform `driver.model(...)` registry?

**Recommended:** Model the registry as an **adapter table over four distinct
surfaces**, and have it READ each driver's own config constants rather than
re-declare them. The `.model(name) → AiModel.Model<provider, …>` identity carrier
exists ONLY on `@beep/xai` and `@beep/venice-ai`; `@beep/anthropic`
(`makeAnthropicLanguageModelLayer`) and `@beep/openai-compat` (top-level `layer`)
expose only Layer constructors. Source `requiredEnvVar` and `defaultModel` from
the driver constants — e.g. Anthropic's non-standard `AI_ANTHROPIC_API_KEY` and
`ANTHROPIC_DEFAULT_MODEL` — never hard-code them. Add a compile / dtslint proof
of the registry import surface BEFORE shape/decompose.

**Rationale:** RESEARCH verified each driver's public barrel against its
`src/index.ts` (2026-06-29) and found the surfaces are not uniform — every
package's `exports` field exposes only `"."`, deep service paths are not public
aliases, and a literal "each driver exposes `.model`" registry "will NOT
compile." It also locks "Registry MUST READ the driver config constants … not
re-declare them, to prevent drift" and that per-provider model resolution is
mandatory because model strings are non-portable across provider surfaces (the
#778 404 bug class — the same Claude model has ≥5 incompatible id encodings). The
explicit pre-shape compile/dtslint proof guards against discovering the
non-uniformity only at implementation time.

**Status:** open (for /grill-with-docs)

## Q5: Vendor/auth — key-precedence direction, prefix auto-detect, missing-primary-key behavior, and broker indirection?

**Recommended:** Resolve precedence as **user-supplied (per-request) > CLI flag >
env**, expressed with `ConfigProvider.orElse` + `ConfigProvider.layer` (one
provided chain) and `constantCase` normalization. Treat API-key prefix detection
as **advisory only, never a validity check** (longest-prefix-first; explicit
selection always overrides). Make `retryAfter` first-class in schedule
construction. Decide missing-primary-key as: **advance to the fallback step**
(widen the `while` gate to also advance on a `ConfigError`/`ProviderApiKeyMissing`
for the primary), rather than today's fail-fast. Recommend **broker indirection**
(desktop holds only a short-lived JWT to an adapter `base_url`) for the
privilege-sensitive solo-attorney app, implemented as a new dispatch-level
`ApiKeyResolver` service — NOT new driver code.

**Rationale:** RESEARCH explicitly flags precedence direction as "an ALIGN
decision, not a fact" — the gold nuggets contradict each other (harvest-mcp
"CLI > params > env"; Juris.AI "user > env"; netNew#3 "user > env > CLI") — and
recommends user > CLI > env for an interactive desktop app. Prefix facts make
naive `sk-` first-match misroute Anthropic/OpenRouter/DeepSeek (Mistral has no
prefix; DeepSeek collides with OpenAI legacy `sk-`), so detection must stay
advisory. The existing Anthropic `while` predicate (`AiError.isAiError &&
isRetryable`) does NOT advance on a `ConfigError`, so a missing primary key fails
fast today — an explicit fork. Broker indirection is MIT-reimplementable and
`@beep/openai-compat` is already broker-ready (optional `apiUrl` + conditional
bearer), so this is a resolver service, not driver work. `op://`
(`@beep/onepassword-cli`) is the preferred local credential source given the
Electron `safeStorage` Linux plaintext trap.

**Status:** open (for /grill-with-docs)

## Q6: Package placement — a new `@beep` driver-tier dispatch package, `foundation/capability`, or inlined in `agents/server`?

**Recommended:** A new shared driver-tier package (e.g.
`packages/drivers/llm-dispatch`, `@beep/llm-dispatch`) that sits alongside the
four existing drivers and houses the registry adapter table, the
`ApiKeyResolver`, per-provider model resolution, and the multi-provider
`ExecutionPlan` builder. Park the schema-first, domain-agnostic models (provider-
name `LiteralKit` union, key-source `user|cli|env` enum, the
`ProviderApiKeyMissing` `TaggedErrorClass`) in `foundation/capability` only if a
cycle-free home is needed. Do NOT inline the dispatch Layer in `agents/server` —
that package is the first *consumer*, not the owner.

**Rationale:** RESEARCH's `NOT FOUND` sweep confirms no multi-provider dispatch
Layer/registry exists anywhere under `packages/`, and the four drivers are
standalone driver-tier packages — a new sibling driver package mirrors that
placement and lets every consumer (starting with `agents/server`) depend on one
dispatch package without import cycles. The typed-error and literal conventions
(`TaggedErrorClass` from `@beep/schema`, `LiteralKit` + `S.toTaggedUnion`) are
already the in-repo idiom for exactly these provider-name/key-source/structured-
error shapes. Per the CLAUDE.md search-first rule, the placement is genuinely
net-new, not a duplication of an existing `@beep` package. (Mirror Q4 of sibling
`effect-orchestration-patterns`, which faces the same placement fork for its pure
policies.)

**Status:** open (for /grill-with-docs)

## Q7: V1 resilience scope — ordered fallback only (defer round-robin + circuit-breaker), and reuse `generateObject` for structured output rather than rebuild?

**Recommended:** Scope V1 to **ordered fallback only** via `ExecutionPlan`'s
per-step `{ provide, attempts, schedule, while }`. Defer round-robin and
circuit-breaker past V1 (both are genuine net-new `Ref`/`Clock`/`Schedule` state
machines, and round-robin needs a `Layer.unwrap` provider-selection spike first).
Drop netNew #5 (`response_model` binding) from the build list — reuse
`LanguageModel.generateObject({ prompt, schema })` + the shipped per-provider
`CodecTransformer`s (`OpenAiStructuredOutput`, `AnthropicStructuredOutput`).
Treat schema-validation failures as defects (`Effect.die`), never retried, and
keep them out of the `while`-retryable channel.

**Rationale:** RESEARCH locks "`ExecutionPlan` is strictly ordered; round-robin +
circuit-breaker are net-new state machines, not framework features" — Effect has
no built-in round-robin or circuit breaker (the upstream breaker is an unmerged
2024-era proposal), and the raw notes' `Layer.unwrapEffect` is stale (only
`Layer.unwrap` exists), warranting a spike before treating round-robin as
settled. Structured output is already first-class: `generateObject` returns the
decoded type and the vendored Anthropic provider does native `json_schema` for
supported model ids, so re-implementing `response_model` would duplicate vendored
substrate. RESEARCH aligns schema-validation-as-defect with sibling law EF-31
(`BamlParseError → Effect.die`).

**Status:** open (for /grill-with-docs)

## Graduation Note (2026-07-11): CLI subscription-auth leg — partial graduation

The CLI leg of Q5's key-precedence chain (user>CLI>env) graduated to
[`goals/llm-provider-subscription-auth`](../../goals/llm-provider-subscription-auth/README.md)
after a /grill-with-docs session. Locked there: vendor-CLI delegation (t3code
methodology — the vendor CLI owns login/tokens/refresh; beep probes and
isolates HOME dirs), local-first deployment, `agents` slice owns the
`ProviderInstance` concept, no provider tokens at rest in beep-owned storage.

Constraint inherited by this packet: when Q5 is resolved, the "CLI" leg of the
precedence resolver consumes that goal's rich probe surface
(`drivers/ai-provider-cli`) and `ProviderInstance` records; it must not
re-implement CLI probing or instance management. Q5 itself (resolver shape,
advisory prefix detect, advance-vs-fail-fast, broker ApiKeyResolver) remains
open here.

**Status:** recorded (partial graduation; packet stays `active`)
