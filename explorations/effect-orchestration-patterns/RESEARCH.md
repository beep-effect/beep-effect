# Effect Orchestration Patterns — Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
Synthesized 2026-06-29 from research/*.md (5 subtopics) + CAPTURE.md. Raw,
fully-sourced notes per subtopic live in research/<subtopic>.md — this file is
the cited summary; follow the links for line-level provenance and Open/Unverified.
-->

## 2026-07-14 — Dossier Refresh (Superseding Inventory)

This dated inventory supersedes the June claims that `RateLimiter` was unused
and that the repo lacked a vendored durable-workflow surface. Older sections
remain as research provenance, not as the current adoption premise.

### Effect v4 workflow-module capability inventory

The authoritative vendored surface is
`.repos/effect-v4/packages/effect/src/unstable/workflow/`:

- `Workflow.ts` defines typed workflows, execution/poll/resume operations,
  deterministic execution ids derived from workflow identity and payload, and
  encoded complete/suspended results.
- `Activity.ts` defines named, encoded activities whose outcomes an engine can
  persist/replay. It supports retry schedules and deterministic
  `idempotencyKey` derivation.
- `DurableDeferred.ts` provides externally completable, engine-backed durable
  acknowledgments; `DurableClock.ts` delegates durable timers to the engine;
  and `DurableQueue.ts` coordinates persisted background work with durable
  completion tokens.
- `WorkflowEngine.ts` exposes `WorkflowEngine.makeUnsafe`, a low-level pluggable
  `Encoded` engine contract for register, execute, poll, interrupt, resume,
  activity execution, deferred completion, and clock scheduling. The adapter
  must persist, resume, and encode workflow state correctly. Its
  `layerMemory` is explicitly for tests/local development and is not durability
  evidence.
- `WorkflowProxy.ts` and `WorkflowProxyServer.ts` derive RPC/HTTP execute,
  discard, and resume surfaces.
- `index.ts` exports the subsystem. None of these modules requires an Effect
  cluster runtime.

The inventory changes the build-vs-adopt order: first prove a persistence-backed
encoded engine against the docketing contract. Only a demonstrated contract
gap can justify bespoke checkpoint/replay/orchestration machinery. Because the
surface is `unstable`, every Effect upgrade must rerun compile-time and
behavioral compatibility proof.

### Live HTTP resilience inventory

- `packages/foundation/capability/api-transport/src/Transport.ts` already
  composes authentication, `HttpClient.withRateLimiter`, native
  `effect/unstable/persistence/RateLimiter`, and
  `HttpClient.retryTransient` with a jittered exponential `Schedule`.
- `packages/foundation/capability/api-transport/README.md` records that this
  transport was incubated in GovInfo and promoted after a congruent eCFR
  consumer. It names both live adopters.
- `packages/drivers/govinfo/src/Govinfo.service.ts` and
  `packages/drivers/ecfr/src/Ecfr.service.ts` import and apply
  `makeApiTransport`; both supply the native in-memory limiter store in their
  live layers.
- `packages/drivers/uspto` currently has no `@beep/api-transport` import or
  dependency. Its adoption belongs to the owning
  `goals/uspto-prosecution-read` packet as a P0 spike and named P1 work item.

Therefore HTTP resilience extends `@beep/api-transport`; it does not create a
new retry home. LLM retry predicates remain at LLM driver boundaries,
build-time provider selection remains app-local, and the June `Retry.ts` /
schema-helper / generic-selector pre-draft is superseded.

## External Landscape

The single most load-bearing external fact: **the repo compiles against `effect@4.0.0-beta.91`**
(the effect-smol line), not the v3 documented on effect.website. Effect v4 is explicitly beta —
"breaking changes may occur," and new APIs ship under `effect/unstable/*` to "experiment … without
committing to long-term stability too early"
([effect.website/blog/effect-v4beta-launch-to-may-recap](https://effect.website/blog/effect-v4beta-launch-to-may-recap/)).
Several CAPTURE seed snippets are v2/v3-flavored gold-corpus code and **will not typecheck as-written** —
specifically the ones touching removed/renamed APIs (`Schedule.compose`, `Layer.unwrapEffect`, `Layer.die`,
and the `Effect.zipRight`/`zipLeft` aliases); the vendored tree at `.repos/effect-v4/packages/effect` and
`node_modules/effect/dist` is authoritative. (The bounded fan-out seed `Effect.forEach(tasks, …, { concurrency })`
is *not* among them — that options shape still matches v4: `CAPTURE.md:43`, `.repos/effect-v4/packages/effect/src/Effect.ts:776`.)
Migration docs are admittedly incomplete ([effect-smol#1378](https://github.com/Effect-TS/effect-smol/issues/1378)),
so several v3→v4 renames below were established by adversarial diff of two primary API sources, not prose changelogs.

### Orchestration primitives — what v4 actually ships
- **Bounded fan-out (law EF-27).** `Effect.forEach` in v4 takes only `{ concurrency?, discard? }` — **the v3 `mode: "either" | "validate"` option is gone from `forEach`**; copying v3 tutorials breaks the build. The mode switch survives only on `Effect.all` as `mode: "default" | "result"` (`Result`-valued, for a *fixed/heterogeneous* set, not a homogeneous collection). Per-item graceful degradation uses `Effect.partition` (→ `[failures, successes]`, never fails), `Effect.validate` (collects all failures, lossy on success), or per-effect wrappers `Effect.result`/`Effect.option`/`Effect.exit`. Contrast docs: [v3 basic-concurrency](https://effect.website/docs/concurrency/basic-concurrency/), [v3 error-accumulation](https://effect.website/docs/error-management/error-accumulation/). Critically, `catchAll`/`result`/`option` recover **typed failures only, not defects** — so a degraded-to-`failed` batch still correctly dies on a schema-decode defect (composes cleanly with EF-31). Raw: [research/bounded-fanout-graceful-degradation.md](research/bounded-fanout-graceful-degradation.md).
- **Failure vs defect (law EF-31).** Effect's canonical split is expected/typed failures (`Effect.fail`, in the error channel) vs defects (`Effect.die`/`orDie`, runtime-tracked, "no sensible way to recover"); the rule is "if there is business logic to handle the error, `fail`; otherwise `die`" — schema/parse errors are **not** inherently defects ([two-error-types](https://effect.website/docs/error-management/two-error-types/), [unexpected-errors](https://effect.website/docs/error-management/unexpected-errors/)). v4 GOTCHA: defect detection moved from `Cause`-level (`Cause.isDie`, 3.x docs) to **`Reason<E>`-level** (`Cause.isDieReason`, reasons tagged `"Fail"|"Die"|"Interrupt"`); any `isDefect` must be written against beta.91, not the published docs. The `while`-refinement type-narrowing on `retry` is reported **unsound when combined with an attempt cap** ([effect-smol#1982](https://github.com/Effect-TS/effect-smol/issues/1982), [effect#6122](https://github.com/Effect-TS/effect/issues/6122)). Raw: [research/failure-vs-defect-error-helpers.md](research/failure-vs-defect-error-helpers.md).
- **Provider selection.** `Layer.unwrapEffect` (the CAPTURE seed name, "zero usages") **does not exist in v4** — v4 merged `unwrapEffect`+`unwrapScoped` into a single **`Layer.unwrap`** (signature carries `Exclude<R, Scope.Scope>`, the old scoped form). `Layer.die`/`Layer.fail` constructors were **removed**; survivors are `Layer.orDie`, `Layer.catchTag`, `Layer.catchCause`, `Layer.catch`. v4 adds `Config.literals([...], name)` (@since 4.0.0) for env-restricted-to-a-set selection. The before/after diff is grounded on the [v3 API ref](https://effect-ts.github.io/effect/effect/Layer.ts.html) vs the vendored v4 source; no official changelog line names the rename. Raw: [research/layer-unwrap-effect-provider-selection.md](research/layer-unwrap-effect-provider-selection.md).
- **Provider-agnostic pattern.** The official analogue is `@effect/ai`'s `LanguageModel`/`EmbeddingsModel` tags: write logic against base tags, "defer choosing the underlying provider … until runtime," swap "without initializing unused provider packages" ([ai/introduction](https://effect.website/docs/ai/introduction/)). Multi-provider fallback is `ExecutionPlan.make({ provide, attempts, schedule, while }, { provide: <fallback> })` + `Effect.withExecutionPlan` ([effect-ai blog](https://effect.website/blog/effect-ai/)).

### Retry / backoff / resilience standards
- **Backoff + jitter (AWS canon).** Three reference formulas — Full Jitter `random(0, min(cap, base·2^n))`, Equal Jitter, Decorrelated Jitter — with the conclusion **Full Jitter wins** (least client work) ([AWS Architecture blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/), [AWS Builders' Library](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), [Brooker](https://brooker.co.za/blog/2015/03/21/backoff.html)). GOTCHA: Effect's built-in `Schedule.jittered` is **unary, ±20% multiplicative** (factor 0.8–1.2) — a narrow Equal-Jitter band, **not** Full Jitter (which goes to 0); Full Jitter needs a custom `Schedule.modifyDelay`+`Random` helper.
- **Retry-After / 429 honoring.** `Retry-After` = [RFC 9110 §10.2.3](https://http.dev/retry-after) (delay-seconds or HTTP-date); `429 Too Many Requests` = [RFC 6585 §4](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429). Rule: honor `Retry-After` exactly if present, else capped exponential+jitter. **Anthropic** returns `retry-after` + token-bucket headers (`anthropic-ratelimit-*`); `529 "overloaded"` is server-wide (retry with backoff) ([platform.claude.com/docs/en/api/rate-limits](https://platform.claude.com/docs/en/api/rate-limits)). **OpenAI** exposes `x-ratelimit-*` + `retry-after` ([cookbook](https://developers.openai.com/cookbook/examples/how_to_handle_rate_limits), [guide](https://platform.openai.com/docs/guides/rate-limits)). v4 composition point: `Schedule.modifyDelay((output, delay) => Effect<Duration.Input>)`.
- **Retry budgets.** [Google SRE "Handling Overload"](https://sre.google/sre-book/handling-overload/) caps retries at a **10% retry-ratio** atop a per-request 3-attempt budget (~1.1× amplification ceiling). [gRPC](https://grpc.io/docs/guides/retry/) encodes the same as a token bucket `retryThrottling: { maxTokens, tokenRatio }` ([proposal A6](https://github.com/grpc/proposal/blob/master/A6-client-retries.md)). A budget is **stateful** — it cannot live in a pure `Schedule`; it needs a `Ref`-backed token-bucket service layered *over* the named policies.
- **Idempotency gating.** [IETF `Idempotency-Key` draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) (`draft-ietf-httpapi-idempotency-key-header-07`) is an **expired/archived Internet-Draft** (datatracker IESG state "Expired", observed 2026-06-29) — never an RFC, and no longer even an active WG draft; treat its header semantics as unstable. Safe-by-default: auto-retry only idempotent ops (reads, GET, side-effect-free LLM completions) + any op carrying an idempotency key; require opt-in for un-keyed mutations.
- Raw: [research/schedule-retry-policy-library-design.md](research/schedule-retry-policy-library-design.md).

### Resilience stack beyond retry (gov-data drivers)
- **Rate limiting — already shipped.** v4 ships `effect/unstable/persistence/RateLimiter` (`consume({ key, limit, window, algorithm: "fixed-window"|"token-bucket", onExceeded: "delay"|"fail" })` → `ConsumeResult`; `RateLimitExceeded` carries `{ retryAfter, key, limit, remaining }`), with `layerStoreMemory` + `layerStoreRedis` stores, an **adaptive** phase machine, and HTTP wiring `HttpClient.withRateLimiter` (auto-honors `retry-after`, auto-retries 429). This is **structurally identical** to the Juris.AI#5 hand-rolled quota-manager — reuse, do not port. v4 also ships `HttpClient.retryTransient({ retryOn, while, schedule, times })`. (Vendored `.d.ts` primary; acknowledged in the [v4 recap](https://effect.website/blog/effect-v4beta-launch-to-may-recap/).)
- **Circuit breaker — genuinely none.** Effect core has **no** circuit breaker in any version; the request is [effect#2843 "Add Circuit Breaker"](https://github.com/Effect-TS/effect/issues/2843), **open since 2024-05-24**, no maintainer decision. References: [Cockatiel v4.0.0](https://github.com/connor4312/cockatiel) (MIT, zero deps, Promise-based) and [opossum v10.0.0](https://github.com/nodeshift/opossum) (Apache-2.0, zero deps, EventEmitter/Promise). Both incur an `Effect.tryPromise`+`AbortSignal` interop tax that erases typed-error/`Cause` fidelity → recommendation is to **clean-room a ~80–150-line state machine (closed → open → half-open) as a `Ref`-held Effect Layer from the documented behavioral spec/tests**, not adopt a dep. LICENSE GUARD: do **not** line-translate Cockatiel/opossum source — a close translation stays a derivative work and would still obligate carrying the upstream MIT/Apache-2.0 notice even with no dependency adopted; implement from behavior, or preserve notices if any source is copied.
- **Bulkhead pools — primitives exist.** v4 ships `Semaphore` (`withPermitsIfAvailable` for fail-fast) and `PartitionedSemaphore<K>` (per-key permit pool, round-robin release) — reuse primitives, net-new is only a thin pool Layer + typed `BulkheadRejected`.
- **Served-while-open cache — net-new glue.** v4 `Cache`/`ScopedCache`/`PersistedCache` are memoization/request-coalescing only; none serve last-known-good while a breaker is OPEN. Must be co-designed with the breaker Layer.
- Raw: [research/resilience-stack-rate-limit-circuit-breaker.md](research/resilience-stack-rate-limit-circuit-breaker.md).

### Conceptual port reference (non-Effect)
- `freelawproject/courts-db` Python `__getattr__` lazy module-attribute load (defers a ~2,809-entry regex compile until first access) is a **P3 conceptual analogue** for lazy reference-data builds — the Effect-native equivalent is `Layer.unwrap`/`Layer.suspend`/`Layer.fresh` (build-time, memoized) or `Effect.cached`/`cachedWithTTL` (first-access). License: BSD (permissive; exact 2- vs 3-clause unverified) — [github.com/freelawproject/courts-db](https://github.com/freelawproject/courts-db). Pattern is unencumbered; vendoring its *data tables* would require BSD attribution.

## In-Repo Capability Inventory

beep-effect already owns most of the substrate; net-new is **consolidation + two gaps**, not invention. All paths verified via `rg`/`ls` on 2026-06-29 against the working tree.

**Vendored authority (the contract that matters):**
- `effect@4.0.0-beta.91` pinned at root `package.json` (`"effect": "4.0.0-beta.91"`; drivers consume via `catalog:`). Vendored source: `.repos/effect-v4/packages/effect/src/{Layer,Schedule,Cause,Result}.ts` (verified present). Type-def surface for `unstable/*`: `node_modules/effect/dist/unstable/persistence/RateLimiter.d.ts`, `node_modules/effect/dist/unstable/http/HttpClient.d.ts`, `node_modules/effect/dist/{Semaphore,PartitionedSemaphore,Cache,Schedule}.d.ts` (all present). `node_modules/effect/dist/RateLimiter.d.ts` **NOT FOUND** (confirms the v3 top-level single-limiter is gone; only the per-key `unstable/persistence` variant ships).

**Documented laws (reuse, don't re-document):**
- `standards/effect-first-development.md:659` — **EF-27** "Parallel fan-out needs explicit concurrency" (verified).
- `standards/effect-first-development.md:730` — **EF-31** "Separate expected failures from defects" (verified).
- `.patterns/error-handling.md` — error-handling pattern (cited by CAPTURE secondaryTarget; referenced in research).

**LLM drivers (the DRY-extraction surface):**
- `@beep/anthropic` (`packages/drivers/anthropic/src/`) — the only driver with a real `Schedule`/`ExecutionPlan` retry policy. `Anthropic.service.ts:103-107` = `ExecutionPlan.make({ … schedule: Schedule.exponential(Duration.millis(ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS), 2), while: (error) => AiError.isAiError(error) && error.isRetryable })` (verified); duplicated at `Anthropic.repair.ts`; constants in `Anthropic.config.ts`; typed errors in `Anthropic.errors.ts`. This is the canonical `layerConfig`+`ExecutionPlan` shape the consolidation reuses.
- `@beep/m365` (`packages/drivers/m365/src/`) — **second real driver-retry prior art (Codex gate-1), hand-rolled rather than `Schedule`-based.** `M365.service.ts:769` parses `retry-after` (delay-seconds) off the response; `executeWithRetry` (`M365.service.ts:800`) recursively retries `429`/`503` while a per-call budget remains (`DEFAULT_MAX_RETRIES = 3`, `M365.config.ts:80`), sleeping the honored `retry-after` else `DEFAULT_THROTTLE_RETRY_AFTER_SECONDS`; covered by `M365.service.test.ts:519` ("retries throttled requests after Retry-After within the configured budget"). The consolidation should fold this Retry-After-honoring recursion *into* the shared `networkRetry` policy (it is exactly the `Schedule.modifyDelay`-honors-`retry-after` shape the retry module needs) rather than leave it driver-local; add it to the extraction inventory and migration plan alongside the anthropic site.
- `@beep/openai-compat` (`packages/drivers/openai-compat/src/OpenAiCompatClient.service.ts`) — **resilience GAP, not a duplicate.** Its only "retry" token is `mapSseRetry` rejecting an unsupported SSE directive (verified line 251); has **no** `Schedule`/`ExecutionPlan` retry. `xai`, `venice-ai`, `ai-provider-cli` likewise have no retry.
- `@beep/ai-provider-cli` (`packages/drivers/ai-provider-cli/src/`) — `LiteralKit(["claude","codex"])` at `AiProviderCli.models.ts:27` + `.$match(provider, {…})` at `AiProviderCli.service.ts:75` (verified): the repo-native provider-vocabulary + exhaustive-dispatch precedent for a unified LLM-provider `LiteralKit` feeding `Config.literals`.

**`Layer.unwrap` (provider selection) — already battle-tested:**
- `Layer.unwrapEffect` usages: **0 / NOT FOUND** (confirms the v3 spelling is absent). But `Layer.unwrap` (the v4 name) is in active use across `packages/tooling/test-kit/test-utils/src/SqlTest.ts` (6 call sites incl. the switch-based lazy selector at `:1340`), `packages/drivers/m365/src/M365.service.ts:1176` (`static readonly layer: Layer.Layer<M365, M365Error> = Layer.unwrap(…)` — the **typed-error-at-config-boundary** precedent, verified), `packages/drivers/postgres/test/.../Postgres.pglite.test.ts`, `packages/drivers/drizzle/test/.../Drizzle.pglite.test.ts`, `packages/foundation/capability/observability/src/experimental/server/OtlpPacketLab.ts`. Net-new = a shared provider-agnostic `Context.Service` tag + one selector, mirroring proven shapes.

**Error toolkit (host for generic helpers):**
- `@beep/schema` (`packages/foundation/modeling/schema/src/index.ts`) — already exports `CauseTaggedError` (:49), `StatusCauseError` (:326), `StatusCauseTaggedErrorClass` (:331), `TaggedErrorClass` (:341) (verified). Depends on `effect` core only (no `effect/unstable/ai`) → correct home for AI-free `decodeOrDie`/`isDefect`/`getErrorMessage`. The `isRetryable`-over-`AiError` predicate belongs with the retry-policy module (LLM scope), to avoid coupling foundation to the AI module.
- `effect/unstable/ai/AiError` (vendored `.repos/effect-v4/.../AiError.ts:100,388`) already ships `get isRetryable()` + `isAiError(u)` per-reason — the shared LLM predicate is a thin re-export, not a fresh classifier. It **also** ships a typed `get retryAfter(): Duration.Duration | undefined` (`AiError.ts:1486`) that delegates to the reason's `retryAfter` — `RateLimitError.retryAfter: Schema.optional(Schema.Duration)` (`AiError.ts:372`) — so the Retry-After-honoring `Schedule.modifyDelay` extractor can read a parsed `Duration` today (verified, Codex gate-1; resolves the prior "only `isRetryable`?" open item). Only the *raw* provider reset header (vs. the parsed `Duration`) remains provider-specific and still needs inspection. Non-AI driver precedent: `packages/drivers/m365-mcp/src/M365Handlers.ts:35` `isRetryableM365Error = (e) => e.reason === "throttled" || e.reason === "transport"` (verified) — a generic helper should *compose* these, not replace them.

**Decode→die precedents (the genuine surface):**
- `packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts:60-61` — `S.decodeUnknownSync(ClaimProjectionView)({…})` re-decoding "known-good plain numbers" into branded `NonNegativeInt` (verified); throw=die is correct here. Same shape in `packages/workspace/tables/src/entities/*/.../*.converters.ts` and law-practice use-case decoders.
- ADVERSARIAL FINDING: the repo's real streamed-LLM-output path **rejects** the seed's "parse=defect" rule. `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:75-111` treats a per-block `decodeSlice` failure as **recoverable** (held for repair, unrepairable blocks dropped+logged, never died); `BlockRepair` fails with typed `BlockRepairFailed`. Corroborated by effect itself marking `InvalidOutputError` as `isRetryable: true`. Do NOT port the BamlClientService parse-is-defect rule onto LLM output.

**Fan-out / degradation precedents:**
- `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts:531-532` — `Effect.forEach(lines, (line) => skipInvalid ? Effect.option(parseJson(...)) : …, { concurrency: 1 })` (verified): existing per-item degradation, but short-circuiting elsewhere.
- CORRECTION (Codex gate-1): `packages/foundation/capability/nlp/src/Graph/GraphOperations/Executor.ts` is **already a production degraded fan-out**, not a first-failure short-circuit — `applyOne` wraps each leaf in `Effect.result` (`:236`), folds a failure into a one-element `errors` array (`:237`) instead of failing the batch, runs the bounded `Effect.forEach(leafNodes, …, { concurrency })` (`:354`), and `foldApplications` (`:306`) flattens per-leaf `errors`/`newNodes` across the batch. This is reusable degraded-batch prior art, not a gap.
- Genuine short-circuit fan-outs (degrade-on-first-failure) that remain: `packages/agents/server/src/AssistantTurn/BlockRepair.ts` (`concurrency: 1`), `packages/tooling/library/ai-metrics/*`.
- What is **still net-new** is a *generic, tagged-status* degraded-batch combinator (`forEachSettled`-style returning `{ ok, failed }` per item): `Effect.partition`/`Effect.validate`/`mode:"result"` have **zero usages** in production fan-out (the one `partition` hit is in docgen `Parser.ts`, unrelated), and the nlp Executor's shape is bespoke (`Result`-per-leaf folded into a domain `errors` array), not a shared helper. Net-new work is to **extract the Executor's proven shape into a generic combinator**, not invent one from scratch.

**Retry-policy module — NOT FOUND (net-new #1):**
- Zero hits for `RetryPolicy`/`llmRetry`/`networkRetry`/`databaseRetry` anywhere under `packages/**` except the inline anthropic sites. A v4-idiomatic `databaseRetry` shape already exists to generalize: `packages/tooling/test-kit/test-utils/src/SqlTest.ts:616` `const PgConnectRetryPolicy = Schedule.both(Schedule.spaced(Duration.millis(250)), Schedule.recurs(20))` (verified — note: the research note called this `PgConnectl`; the actual symbol is `PgConnectRetryPolicy`). Candidate host `@beep/utils` (`packages/foundation/modeling/utils`) already has per-concern modules (`Stream.ts`, `Random.ts`, `Function.ts`) — a `Retry.ts` slots in.

**Resilience built-ins — present but UNUSED in repo:**
- `RateLimiter`/`retryTransient` usages across `packages/**`: **0 / NOT FOUND** — adoption is greenfield-in-repo even though the v4 primitives exist. `PartitionedSemaphore`/`Semaphore` (bulkhead) and `Cache`/`ScopedCache` ship but no circuit breaker exists at any layer.

## Constraints

**Deprecations / renames / removals (with dates, all forced by the `effect@4.0.0-beta.91` pin):**
- `Layer.unwrapEffect` + `Layer.unwrapScoped` → **merged into `Layer.unwrap`** (v4). The CAPTURE seed name must be rewritten. (No official changelog line; established by primary-source diff — treat names/signatures as verified against vendored source, "renamed" narrative as inferred. [effect-smol#1378](https://github.com/Effect-TS/effect-smol/issues/1378).)
- `Layer.die` / `Layer.fail` constructors → **REMOVED** in v4; use `Effect.die`/`Effect.fail` inside the `Layer.unwrap` generator, or `Layer.orDie`/`Layer.catchTag`.
- `Effect.forEach` `mode: "either"|"validate"` → **REMOVED**; only `Effect.all` keeps a mode (`"default"|"result"`, `Result`-valued).
- `Effect.once` → **REMOVED**; use `Effect.cached` for "build once, lazily."
- `Schedule.compose`/`union`/`intersect`/`whileInput`/`whileOutput`/`check`/`recurWhile` → **absent** in beta.91; bound a count with `Schedule.both(Schedule.recurs(n))` (intersection, takes the **max** delay) or `attempts`/`times` on `ExecutionPlan`/`retry`. The seed's `Schedule.exponential(...).pipe(Schedule.compose(Schedule.recurs(2)))` will not compile.
- `Cause.isDie`/`isDieType` (3.x, whole-`Cause`) → in v4 detection is at `Reason<E>` level (`Cause.isDieReason`); write `isDefect` against beta.91.
- v3→v4 helper aliases on any lifted seed code: `Effect.zipRight → andThen`, `Effect.zipLeft → tap`.
- `effect/unstable/RateLimiter` namespace is **explicitly unstable** — API may shift across betas; pin and re-verify on each `effect` bump. v3 top-level `effect/RateLimiter` is gone (single in-memory limiter → per-key store-backed).
- `docs.anthropic.com/en/api/rate-limits` now **301-redirects** to `platform.claude.com/docs/en/api/rate-limits` (observed 2026-06-29); `anthropic-fast-*` / `529` behaviors are research-preview and may change.
- `Idempotency-Key` is an **expired/archived Internet-Draft (-07), never an RFC** (datatracker IESG state "Expired", observed 2026-06-29) — cite as an expired I-D (not an active WG draft), do not assume stable header semantics.
- Known soundness bug: `retry` `while`-refinement narrowing is **unsound with an attempt cap** ([effect-smol#1982](https://github.com/Effect-TS/effect-smol/issues/1982)) — keep post-plan error types pinned explicitly (the kernel already casts).

**Licensing gravity (reimplement-not-copy where required):**
- `effect` (the only runtime dep involved) = **MIT** — first-party-clean; named policies are first-party.
- External resilience CBs are reference-only: **Cockatiel = MIT**, **opossum = Apache-2.0** (both permissive, zero-dep) — but the **recommendation is to clean-room the algorithm from its documented state-machine behavior, not adopt the dep and not line-translate its source** (Promise/AbortSignal interop erases typed-error fidelity and adds a runtime dep against the repo's no-new-runtime-dep / privilege-hygiene posture). LICENSE NOTE (Codex gate-1): "reference-only / no dep adopted" does **not** by itself shed the license — a close translation of Cockatiel/opossum source stays a derivative work and would still obligate carrying the upstream MIT/Apache-2.0 notice; implement from behavioral specs/tests, or preserve notices if any source is copied or translated. AWS blogs, RFC 9110/6585, Google SRE, gRPC docs, IETF draft are **standards/concepts only — no code adopted, no license attaches.**
- `courts-db` = **BSD** (permissive; exact 2- vs 3-clause UNVERIFIED) — only a P3 *concept* reference; the lazy-load *pattern* is unencumbered, but vendoring its court/reporter *data tables* would require BSD attribution and a header check (Free Law Project occasionally dual-states data vs code terms).
- The external CAPTURE seeds (`BamlClientService`, `MultiAgentOrchestratorService`, `WebSearchService`, `quota-manager.ts`, `enhanced_client.py`) are **gold-corpus provenance, not in-repo files and not ported** — their snippets are design inspiration; the parse-is-defect rule is explicitly rejected. No third-party license attaches to the net-new work.

**Locked decisions / scope guards (from CAPTURE + tree-snapshot):**
- This is a **library-extraction/consolidation** task, not greenfield. EF-25/26/27/31 and the anthropic retry+error code already exist — **DRY-extract and reuse; do not rebuild documented standards or working driver code.** `goals/effect-native-migration` is migration of native JS types, NOT runtime orchestration — out of scope.
- `Layer.unwrap` must be validated against the **vendored** beta.91 API before adoption (done here: it exists, with 6+ in-repo precedents).
- Net-new is exactly two things: (1) a centralized `Schedule` retry-policy module (`@beep/utils/Retry` candidate), and (2) a `Layer.unwrap`-based provider selector — plus the adjacent net-new glue (per-item degraded-batch helper, circuit breaker, served-while-open cache, decode→die helper, retry-budget service).
- The stateful resilience layer (retry budget / token-bucket limiter / circuit breaker / bulkhead) is heavier than the pure `Schedule` policies — **home undecided** (`@beep/utils` sibling vs a new `@beep/resilience` leaf); an align-stage decision, tied to the Juris.AI#5 / uspto#5 nuggets.

**Auth / secret / offline boundaries:**
- API keys flow through `Config.redacted(...)` (e.g. anthropic `AnthropicClient.layerConfig({ apiKey: Config.redacted(ANTHROPIC_API_KEY_ENV) })`) — provider selection must keep secrets redacted and **never initialize unused providers'** clients/credentials (the `Layer.unwrap` "return only the chosen branch" property guarantees this).
- `RateLimiter` store choice is an offline/online boundary: `layerStoreMemory` (dev, process-local) vs `layerStoreRedis` (prod, cross-process) — net-new is the store-selection + per-provider tier-config schema, not the limiter.
- `getErrorMessage`/decode→die diagnostics must respect existing redaction (`@beep/observability` `redactString` is already used in `BlockRepair`) — do not leak raw payloads into a `Die` defect.

**Routing cautions (from tree-snapshot.md):**
- Verify the `effect-orchestration-patterns` slug before scaffolding (it is a *proposed* P2 new-exploration). Provider *fallback/dispatch* is a separate proposed packet (`multi-provider-llm-dispatch-fallback`) — keep the selector (build-time provider choice) distinct from runtime fallback/dispatch.
- Gov-data drivers (`courtlistener`/`ecfr`/`dol`/`federal-register` skeletons, `govinfo` substantial, `uspto` hand-rolled ODP-only) are the consuming surface for the resilience stack but belong to `gov-legal-data-driver-codegen` / `uspto-patent-driver-depth`; reuse the repo's own Effect codegen path (`runpod` precedent) — do NOT introduce Orval/axios/Zod, and NEVER PatentsView (sunset) for uspto.

---

_Codex gate-1 folded 2026-06-29: 2 blocking + 5 advisory addressed._
