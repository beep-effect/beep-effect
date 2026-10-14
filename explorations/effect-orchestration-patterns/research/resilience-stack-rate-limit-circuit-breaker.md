# resilience-stack-rate-limit-circuit-breaker

Scope: external landscape + build/reuse decisions for the resilience stack beyond retry (circuit breaker, bulkhead pools, served-while-open cache, outbound per-key quota/rate limiting) as Effect Layers, measured against what vendored Effect v4-beta.91 already ships. Seeds: `uspto_pfw_mcp#5`, `Juris.AI#5`.

## Findings

### Vendored substrate: the repo pins Effect `4.0.0-beta.91`, which changes the whole calculus

- The repo's `effect` dependency is `4.0.0-beta.91` (root `package.json` + `node_modules/effect/package.json`). This is **Effect v4 beta**, not v3 — and v4's resilience surface is materially different from the v3 docs most blog posts describe. Effect v4 is "still in beta, so breaking changes may occur," and new APIs ship as `@stability unstable` modules (`effect/ai`, `effect/http`, …) to "experiment ... without committing to long-term stability too early." (primary: https://effect.website/blog/effect-v4beta-launch-to-may-recap/)
- The repo currently uses **none** of these built-ins: `rg "RateLimiter|retryTransient"` over `packages/**` returns zero hits. The only retry in production is the Anthropic driver's `ExecutionPlan.make({ attempts, schedule: Schedule.exponential(...), while: isRetryable })` (`packages/drivers/anthropic/src/Anthropic.service.ts`). So adoption of any Effect-native resilience primitive is greenfield-in-repo even though the primitives already exist in the vendored package.

### Outbound per-key quota / rate limiting — REUSE (Effect v4 ships exactly the Juris.AI#5 shape)

- Effect v4-beta.91 ships `effect/persistence/RateLimiter` (verified in `node_modules/effect/dist/persistence/RateLimiter.d.ts`). It "consumes tokens for string keys using fixed-window counters or token-bucket state ... to protect external APIs, enforce quotas, or throttle workers across fibers and processes that share the same store." `consume({ key, limit, window, algorithm: "fixed-window"|"token-bucket", onExceeded: "delay"|"fail", tokens })` returns `ConsumeResult { delay, limit, remaining, resetAfter }`. (primary: vendored `.d.ts`; module is also referenced as added to `@effect/experimental` in the v4 recap: https://effect.website/blog/effect-v4beta-launch-to-may-recap/)
- The failure value `RateLimitExceeded` carries `{ retryAfter, key, limit, remaining }` — **structurally identical** to Juris.AI#5's hand-rolled `quota-manager.ts` return `{ allowed, remaining, resetTime, retryAfter }`. The store layer comes in two flavors: `layerStoreMemory` (process-local) and `layerStoreRedis(...)` / `layerStoreRedisConfig(...)` (Lua-script backed) — matching the nugget's "in-memory now, Redis/persistent in prod" note. (source: `node_modules/effect/dist/persistence/RateLimiter.d.ts` lines 187–214, 418–492)
- Effect v4 also wires this directly into HTTP: `HttpClient.withRateLimiter({ limiter, window, limit, key: string | (req)=>string, algorithm, tokens, disableResponseInspection?, disableAdaptiveLearning? })` "applies request rate limiting ... can update limits by inspecting common rate limit response headers and automatically retries HTTP `429` responses ... by forcing the retry back through the limiter." The v4 beta recap explicitly logs: "Improved `HttpClient.withRateLimiter` with automatic delay from `retry-after` headers." (source: `node_modules/effect/dist/http/HttpClient.d.ts` lines 678–770; https://effect.website/blog/effect-v4beta-launch-to-may-recap/)
- There is even **adaptive** rate limiting: `adaptiveConsume`/`adaptiveFeedback` take HTTP `status` + parsed `Retry-After` and run a phase machine (`inactive → cooldown → learning → learned`) to self-tune the limit from server feedback. (source: `node_modules/effect/dist/persistence/RateLimiter.d.ts` lines 274–352)
- **Decision:** outbound per-key quota limiting for gov-data drivers is **not net-new**. Reuse `RateLimiter` + `HttpClient.withRateLimiter`. Net-new is only (a) the per-provider **tier config** schema (USPTO ODP / CourtListener / GovInfo / Anthropic limits) and (b) the key strategy + store-layer selection (`layerStoreMemory` dev / `layerStoreRedis` prod). Do **not** port Juris.AI's sliding-window quota-manager. Caveat: `effect/persistence` namespace → API may shift across betas; pin and re-verify on each `effect` bump.

### v3 vs v4 RateLimiter — a real migration delta worth recording

- The **v3** `effect/RateLimiter` (`make({ limit, interval, algorithm })`, `@since 2.0.0`) is a **single shared in-memory limiter**: no per-key support, no cross-process persistence, "only the moment of starting the effect is rate limited; the number of concurrent executions is not bounded." It supports `withCost`/composition. (primary: https://effect-ts.github.io/effect/effect/RateLimiter.ts.html)
- In vendored v4-beta.91 there is **no top-level `effect/RateLimiter`** module (`node_modules/effect/dist/RateLimiter.d.ts` is ABSENT); it has been replaced by the per-key, store-backed `effect/persistence/RateLimiter`. Any guidance written against the v3 single-limiter API is stale for this repo. (source: filesystem check of `node_modules/effect/dist/`)

### Retry budget — REUSE (already the exploration's netNew #1, plus `retryTransient` exists)

- Effect v4 `HttpClient.retryTransient({ retryOn: "errors-only"|"response-only"|"errors-and-responses", while?, schedule?, times? })` "retries common transient errors, such as rate limiting, timeouts or network issues," and can treat transient **responses** (e.g. 429/503) as retryable, not just thrown errors. `retry(scheduleOrOptions)` accepts any `Schedule`. (source: `node_modules/effect/dist/http/HttpClient.d.ts` lines 557–676)
- `Schedule` has all the policy combinators the centralized retry module needs: `exponential(base, factor)`, `fibonacci`, `spaced`, `recurs`, `jittered`, `addDelay`, plus `compose`/`intersect`/`union`. (source: `node_modules/effect/dist/Schedule.d.ts` lines 480, 3172–4120) — so the seed's "retry budget" is the already-scoped centralized-`Schedule` library (netNew #1), not a separate build.

### Circuit breaker (CLOSED/OPEN/HALF_OPEN) — GENUINELY NET-NEW (Effect has none)

- Effect core has **no** circuit breaker in any version. A `.d.ts`-only search of vendored v4 for `CircuitBreaker|half[_-]?open` returns nothing (the two stray hits in `Random.d.ts`/`Crypto.d.ts` are "half-open interval" math docs). (source: filesystem check)
- The request is tracked in Effect issue **#2843 "Add Circuit Breaker"**, opened **2024-05-24**, still **OPEN** with no maintainer decision; it cites Martin Fowler and opossum as references. (primary: https://github.com/Effect-TS/effect/issues/2843)
- This is exactly `uspto_pfw_mcp#5`'s `CircuitBreaker` (`can_execute(): if state==OPEN and now-last_failure > timeout: state=HALF_OPEN`). **Net-new for the repo.** Two viable build paths:
  - **(Recommended) Port the pattern as an Effect-native Layer**, not a dependency: a `Ref`-held state machine (`{ state: "closed"|"open"|"half_open", failures, lastFailureAt }`) gated by `Clock.currentTimeMillis`, exposing `protect(effect)` that fails fast with a typed `CircuitOpenError` when OPEN and probes once in HALF_OPEN. This composes with `Schedule` retry and the existing `TaggedErrorClass` taxonomy, keeps typed errors, and adds zero runtime deps — aligning with the repo's Effect-first law and privilege/dependency-hygiene posture. Comparable Cockatiel/opossum CBs are ~80–150 lines of logic.
  - **(Alternative) Wrap Cockatiel** at the HTTP boundary. Cockatiel `4.0.0` is **MIT, zero runtime dependencies, promise-based and framework-agnostic** — its `circuitBreaker(policy, { halfOpenAfter, breaker: new ConsecutiveBreaker(n) | new SamplingBreaker(...) | new CountBreaker(...) })` plus `breaker.isolate()` cover the full state machine. (primary: https://github.com/connor4312/cockatiel ; license/version/deps verified at https://github.com/connor4312/cockatiel/blob/master/package.json). Downside: it is `Promise`-based, so wrapping it requires `Effect.tryPromise` + `AbortSignal` interop and erases typed-error/`Cause` fidelity — so prefer porting the algorithm over adopting the library wholesale.
  - opossum `10.0.0` (**Apache-2.0, zero deps**, half-open via `resetTimeout`, rolling-window stats over `rollingCountTimeout`/`rollingCountBuckets`, `errorThresholdPercentage`, `volumeThreshold`, fallback, Prometheus/Hystrix) is the Node de-facto CB but is heavier and EventEmitter/Promise-based — same Effect-interop tax. (primary: https://github.com/nodeshift/opossum ; Apache-2.0 + v10.0.0 + 0 deps verified at https://raw.githubusercontent.com/nodeshift/opossum/main/package.json)

### Bulkhead pools — REUSE PRIMITIVES (thin net-new wrapper only)

- Effect v4 has no named "bulkhead," but ships the two primitives it decomposes into: `Semaphore` (`make(permits)`, `withPermits(n)`, `withPermitsIfAvailable(n)` for fail-fast) and `PartitionedSemaphore<K>` — a **shared permit pool that tracks waiters by partition key and distributes released permits across partitions in round-robin order** so "one busy group [does not] monopolize released permits." (source: `node_modules/effect/dist/Semaphore.d.ts` lines 209/296/420; `node_modules/effect/dist/PartitionedSemaphore.d.ts` lines 1–10, 104–160)
- `PartitionedSemaphore` is effectively a per-workload bulkhead keyed by workload/provider; `withPermitsIfAvailable` gives the "reject when pool exhausted" semantics (Cockatiel's `BulkheadRejectedError`). **Decision:** reuse the primitives; net-new is only a thin per-pool Layer + a typed `BulkheadRejected` error. Do **not** pull in Cockatiel just for bulkheads.

### Served-while-open response cache — NET-NEW glue (no off-the-shelf primitive)

- Effect v4 ships `Cache` / `ScopedCache` (`make({ lookup, capacity, timeToLive })` with `invalidate`/`invalidateWhen`/`refresh`) and `effect/persistence/PersistedCache` — but these are **request-coalescing / memoization** caches keyed on success; none implement "serve last-known-good stale value while the circuit is OPEN." (source: `node_modules/effect/dist/Cache.d.ts` lines 86–227, 1468–2078; `node_modules/effect/dist/persistence/` listing)
- This matches `uspto_pfw_mcp#5`'s "served-while-open cache." **Net-new**: a small Layer that records the last successful response per key (a `Cache`/`ScopedCache` or `Ref<HashMap>`), and when the circuit-breaker Layer reports OPEN, returns the cached value (optionally stamped stale) instead of failing. This is the one part of the resilience stack with no direct Effect analog, and it must be co-designed with the circuit-breaker Layer.

### Net-new vs reuse summary (for gov-data drivers: USPTO ODP / CourtListener / GovInfo)

| Capability (seed) | Effect v4-beta.91 status | Verdict |
| --- | --- | --- |
| Outbound per-key quota/rate limit (Juris.AI#5) | `persistence/RateLimiter` + `HttpClient.withRateLimiter` (per-key, fixed-window/token-bucket, adaptive, memory+Redis stores) | **REUSE**; net-new = tier-config schema + store selection |
| Retry budget (uspto_pfw_mcp#5) | `HttpClient.retryTransient` + `Schedule` combinators | **REUSE** (= netNew #1 centralized Schedule lib) |
| Bulkhead pools | `Semaphore` + `PartitionedSemaphore<K>` + `withPermitsIfAvailable` | **REUSE primitives**; net-new = thin pool Layer + rejection error |
| Circuit breaker CLOSED/OPEN/HALF_OPEN | none (issue #2843 open since 2024-05-24) | **NET-NEW** (port Effect-native Layer; Cockatiel/opossum reference only) |
| Served-while-open response cache | `Cache`/`ScopedCache`/`PersistedCache` (memoization only) | **NET-NEW glue** over `Cache` |

## Sources

- Effect v4 beta recap (primary; rate-limiter + unstable-namespace stability caveats, dated Feb–May 2026): https://effect.website/blog/effect-v4beta-launch-to-may-recap/
- Effect v4-beta.91 vendored type defs (most authoritative for what ships in this repo): `node_modules/effect/dist/persistence/RateLimiter.d.ts`, `node_modules/effect/dist/http/HttpClient.d.ts`, `node_modules/effect/dist/Semaphore.d.ts`, `node_modules/effect/dist/PartitionedSemaphore.d.ts`, `node_modules/effect/dist/Schedule.d.ts`, `node_modules/effect/dist/Cache.d.ts`
- Effect v3 RateLimiter reference (single shared in-memory limiter, @since 2.0.0): https://effect-ts.github.io/effect/effect/RateLimiter.ts.html
- Effect issue #2843 "Add Circuit Breaker" (open, 2024-05-24, no core decision): https://github.com/Effect-TS/effect/issues/2843
- Effect issue #4179 "Add a general purpose RateLimitMiddleware" / #1685 "Add a RateLimiter module": https://github.com/Effect-TS/effect/issues/4179 , https://github.com/Effect-TS/effect/issues/1685
- Cockatiel (Polly-style TS resilience: CB, bulkhead, retry, timeout, fallback; MIT, zero deps, v4.0.0): https://github.com/connor4312/cockatiel , https://github.com/connor4312/cockatiel/blob/master/package.json
- opossum (Node circuit breaker; Apache-2.0, zero deps, v10.0.0): https://github.com/nodeshift/opossum , https://raw.githubusercontent.com/nodeshift/opossum/main/package.json
- Repo anchors: `packages/drivers/anthropic/src/Anthropic.service.ts` (ExecutionPlan+Schedule retry); root `package.json` (`effect 4.0.0-beta.91`)

## Open / Unverified

- **UNVERIFIED (exact PR/date)**: the specific PR and beta tag that introduced `effect/persistence/RateLimiter` and `HttpClient.withRateLimiter`. Confirmed present in vendored beta.91 and acknowledged in the Feb–May 2026 recap, but the recap does not pin the module's package path or a precise version; treat the API as **unstable** (`@stability unstable`) and re-verify on each `effect` bump.
- **UNVERIFIED (in-repo)**: whether the repo's vendored `@effect/platform-*` (node/bun/browser) re-export the v4 `effect/http` `HttpClient`, or whether drivers must import `effect/http/HttpClient` directly. The gov-data driver work should confirm the exact import path against the driver scaffolds (`packages/drivers/uspto`, `courtlistener`).
- **UNVERIFIED (provenance)**: the two seed source files (`uspto_pfw_mcp .../enhanced_client.py:38-101`, `Juris.AI .../quota-manager.ts:28-79`) live in external repos and were not fetched here; claims about their exact shapes are taken from the CAPTURE.md nugget snippets, not re-read from source.
- **OPEN (design)**: whether to port a compact Effect-native circuit breaker (recommended, typed-error/`Cause`-preserving, zero-dep) or wrap Cockatiel/opossum behind an Effect boundary (faster, but Promise/AbortSignal interop loses typed-error fidelity and adds a runtime dep). Needs an align-stage decision against the repo's no-new-runtime-dep posture.
- **OPEN (cache semantics)**: TTL/staleness policy for the served-while-open cache (hard-expire vs serve-stale-stamped) is undefined and must be co-designed with the circuit-breaker Layer.
