# Effect Orchestration Patterns — Sources & Provenance

Provenance ledger for this packet: it joins the 8 gold nuggets of the
gold-intake cluster **"Effect orchestration patterns (Schedule, Layer provider,
bounded fan-out)"** to their upstream repos + licenses, the external research
citations already on disk in this packet, and the in-repo `@beep/*` bricks the
work composes. An implementing agent should be able to trace any decision in
DECISIONS.md back through this file to (a) a mined nugget with its upstream
`file:line`, (b) the upstream repo + LICENSE, (c) an external citation, or (d) an
in-repo capability.

- **Cluster:** Effect orchestration patterns (Schedule, Layer provider, bounded fan-out) — 8 nuggets (P1×5, P2×2, P3×1).
- **Route:** `new-exploration` → this packet (`effect-orchestration-patterns`); primary target of the cluster.
- **Gold-intake provenance:** [`explorations/_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) · [`explorations/_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`explorations/_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md).
- **Themes:** `effect-ts` (6 nuggets), `governance-ops` (2 nuggets).
- **Codex review on disk:** [`reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md) (research-gate critique: 2 blocking + 5 advisory, folded into RESEARCH.md).

---

## 1. Mined source corpus (gold nuggets)

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| research-squad#3 | Centralized Effect Schedule retry-policy library | research-squad (MIT) | `src/infrastructure/retry-policies.ts:78-113` | effect-ts | P1 | port → net-new `@beep/utils/Retry` (rewrite to v4 `Schedule`) |
| research-squad#5 | Lazy provider selection via `Layer.unwrapEffect` | research-squad (MIT) | `src/services/WebSearchService.ts:119-145` | effect-ts | P1 | adopt pattern → `Layer.unwrap` selector (seed name renamed in v4) |
| research-squad#11 | Bounded-concurrency subagent execution with graceful degradation | research-squad (MIT) | `src/services/MultiAgentOrchestratorService.ts:738-751` | effect-ts | P1 | adopt → tagged-status degraded-batch combinator |
| research-squad#2 | Failure-vs-defect split in LLM client wrapper | research-squad (MIT) | `src/services/BamlClientService.ts:619-648` | effect-ts | P1 | port pattern, **reject parse-is-defect rule** for LLM output |
| research-squad#7 | Domain error taxonomy with retryable/defect classification helpers | research-squad (MIT) | `src/domain/errors.ts:341-361` | effect-ts | P1 | port → foundation `isDefect`/`isRetryable` predicates |
| Juris.AI#5 | Sliding-window per-key API quota limiter with tier config | Juris.AI (MIT) | `src/lib/quota-manager.ts:28-79` | governance-ops | P2 | reuse v4 built-in (not port) — see §2 caution |
| uspto_pfw_mcp#5 | Resilience stack: circuit breaker + retry budget + cache + bulkhead | uspto_pfw_mcp (MIT) | `src/patent_filewrapper_mcp/api/enhanced_client.py:38-101` | governance-ops | P2 | clean-room (behavioral) → deferred stateful-resilience sibling |
| courts-db#9 | Lazy module-attribute loading of heavy data structures | courts-db (BSD-2-Clause) | `courts_db/__init__.py:23-38` | effect-ts | P3 | reference only (concept → `Layer.unwrap`/`Effect.cached`) |

### How these inform this packet

**Retry-policy module (research-squad#3) — the primary net-new #1.**
Take the *shape*: a single module of named, rationale-documented schedules
(`llmRetry` 2 retries / `networkRetry` 5 retries / `databaseRetry`). Leave the
literal code: the seed's `Schedule.exponential(...).pipe(Schedule.compose(Schedule.recurs(2)))`
**will not compile** on the repo's `effect@4.0.0-beta.91` pin (`Schedule.compose`
is absent — bound a count with `Schedule.both(Schedule.recurs(n))`). The repo
already has a v4-idiomatic policy to generalize (`SqlTest.ts:616`
`PgConnectRetryPolicy = Schedule.both(Schedule.spaced(...), Schedule.recurs(20))`).
Implementing agent: DRY-extract anthropic's working `ExecutionPlan` retry into
this module; do not invent backoff math from scratch.

**Provider selection (research-squad#5) — primary net-new #2.**
Take the *adapter pattern*: read config at layer-build time and construct only
the chosen provider's Layer behind one provider-agnostic tag, so unused
providers' `Config.redacted` keys are never read. Leave the seed's API names:
`Layer.unwrapEffect` / `Layer.die` **do not exist in v4** — they merged into
`Layer.unwrap` and were removed respectively. Battle-tested in-repo precedents
exist (`M365.service.ts:1176`, `SqlTest.ts:1340`). Keep this build-time selector
distinct from runtime fallback/dispatch (separate proposed packet
`multi-provider-llm-dispatch-fallback`).

**Bounded fan-out + graceful degradation (research-squad#11).**
Take the structured-concurrency + per-item-recovery contract:
`Effect.forEach(tasks, withRecovery, { concurrency })` where a failure becomes a
`status:'failed'` item rather than aborting the batch. The `{ concurrency }`
options shape **still matches v4** (this is the one seed snippet that is not
broken). The repo already has production degraded fan-out to reuse
(`nlp/.../GraphOperations/Executor.ts` wraps each leaf in `Effect.result` and
folds failures into an `errors` array); net-new is only extracting that proven
shape into a generic tagged-status combinator.

**Failure-vs-defect + error taxonomy (research-squad#2, research-squad#7).**
Take the deliberate channel split (recoverable typed failures via `Effect.fail`
+ retry vs contract-violation defects via `Effect.die`) and the
`isRetryable`/`isDefect` predicate structure. **Load-bearing caution:** the
seed's "schema-validation of LLM output ⇒ defect" rule is **explicitly rejected**
for this repo — the real streamed-LLM path
(`AnthropicTurnKernel.ts:75-111`) treats a per-block decode failure as
*recoverable* (held for repair, dropped+logged, never died), and effect itself
marks `InvalidOutputError` as `isRetryable: true`. v4 GOTCHA: defect detection
moved from `Cause`-level (`Cause.isDie`) to `Reason<E>`-level
(`Cause.isDieReason`) — write `isDefect` against beta.91. Host the AI-free
helpers in `@beep/schema`; keep the `AiError.isRetryable` predicate LLM-scoped.

**Quota limiter (Juris.AI#5) — P2, governance-ops.**
The hand-rolled keyed sliding-window quota tracker is **structurally identical**
to v4's shipped `effect/unstable/persistence/RateLimiter`
(`consume({ key, limit, window, algorithm })` + `RateLimitExceeded.retryAfter`)
— **reuse the built-in, do not port** the JS. Net-new is only the
store-selection (`layerStoreMemory` vs `layerStoreRedis`) + per-provider
tier-config schema. Belongs to the deferred stateful-resilience scope.

**Resilience stack (uspto_pfw_mcp#5) — P2, deferred.**
The Python circuit-breaker (CLOSED/OPEN/HALF_OPEN) + served-while-open cache +
retry budget + bulkhead pools is the blueprint for the *heavier stateful* layer.
Effect core has **no** circuit breaker at any version
([effect#2843](https://github.com/Effect-TS/effect/issues/2843), open since
2024-05-24) → **clean-room a ~80–150-line `Ref`-held state machine from the
documented behavioral spec**, not from any source. v4 already ships the
bulkhead primitives (`Semaphore`, `PartitionedSemaphore`). This whole stack is
DECISIONS Q1's *deferred* fork (provisional sibling
`resilience-stack-circuit-breaker-budget`).

**Lazy reference-data load (courts-db#9) — P3, reference only.**
Python `__getattr__` lazy module-attribute load is a conceptual analogue for
deferring heavy reference-data builds; the Effect-native equivalent is
`Layer.unwrap`/`Layer.suspend` (build-time, memoized) or
`Effect.cached`/`cachedWithTTL` (first-access). Pattern only — vendoring
courts-db's *data tables* would require BSD attribution.

> No SPLIT siblings: `crossref` is empty in the bundle. The two governance-ops
> nuggets are scoped *out* of this packet (deferred stateful stack), not shared
> with another live packet.

---

## 2. Upstream repositories & licenses

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| research-squad | T1 | MIT | port-with-attribution (permissive) | Schedule retry policies (#3), `Layer.unwrap`-style provider selection (#5), bounded fan-out + recovery (#11), failure-vs-defect split (#2), error-taxonomy predicates (#7) |
| Juris.AI | T2 | MIT | port-with-attribution (permissive) — but superseded by v4 built-in | keyed sliding-window quota concept (#5); reuse `effect/unstable/.../RateLimiter` instead of porting |
| uspto_pfw_mcp | T1 | MIT | port-with-attribution (permissive) for behavior; CB itself clean-roomed | resilience blueprint (#5): circuit breaker, retry budget, served-while-open cache, bulkhead |
| courts-db | T1 | BSD-2-Clause | reference-only (concept); data-table vendoring needs BSD attribution | lazy reference-data load concept (#9) |

> **Caution (echoed from bundle).** This is **largely a library-extraction /
> consolidation task, not greenfield** — the laws (EF-25/26/27/31) and the
> per-driver retry+error code already exist in-repo. Scope must avoid rebuilding
> documented standards or working anthropic/openai-compat retry+error code:
> reuse and DRY-extract them. **No licensing concerns on the net-new core** —
> all of it is first-party Effect code (MIT) and the four upstream repos are
> permissive (MIT / BSD-2). **`Layer.unwrapEffect` must be validated against the
> vendored effect-v4 API before adopting** — done: it does not exist in v4; the
> v4 name is `Layer.unwrap` (6+ in-repo precedents).

> **License guard for the deferred CB (RESEARCH §Resilience).** The external
> circuit-breaker references **Cockatiel (MIT)** and **opossum (Apache-2.0)** are
> zero-dep but reference-only: a *close line-translation* of their source stays a
> derivative work and would still obligate carrying the upstream notice even with
> no dependency adopted. Implement the breaker from behavioral specs/tests, or
> preserve notices if any source is copied. AWS blogs, RFC 9110/6585, Google SRE,
> gRPC docs, and the IETF Idempotency-Key draft are **standards/concepts only —
> no code adopted, no license attaches.**

---

## 3. External research sources

All URLs below are reproduced from this packet's RESEARCH.md / `research/*.md` —
none invented. Grouped by the claim they ground.

**Effect v4 grounding & primitives**
- Effect v4-beta launch→May recap — https://effect.website/blog/effect-v4beta-launch-to-may-recap/
- effect-smol migration-docs incompleteness — https://github.com/Effect-TS/effect-smol/issues/1378
- `retry` `while`-refinement unsound with attempt cap — https://github.com/Effect-TS/effect-smol/issues/1982 · https://github.com/Effect-TS/effect/issues/6122
- v3 basic concurrency — https://effect.website/docs/concurrency/basic-concurrency/
- v3 error accumulation — https://effect.website/docs/error-management/error-accumulation/
- two error types — https://effect.website/docs/error-management/two-error-types/
- unexpected errors — https://effect.website/docs/error-management/unexpected-errors/
- v3 Layer API ref — https://effect-ts.github.io/effect/effect/Layer.ts.html
- `@effect/ai` introduction (`LanguageModel`/`EmbeddingsModel` tags) — https://effect.website/docs/ai/introduction/
- effect-ai blog (`ExecutionPlan`/`withExecutionPlan`) — https://effect.website/blog/effect-ai/

**Retry / backoff / resilience standards**
- AWS exponential backoff & jitter — https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- AWS Builders' Library (timeouts, retries, backoff) — https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Brooker on backoff — https://brooker.co.za/blog/2015/03/21/backoff.html
- Retry-After (RFC 9110 §10.2.3) — https://http.dev/retry-after
- 429 Too Many Requests (RFC 6585 §4) — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429
- Anthropic rate limits — https://platform.claude.com/docs/en/api/rate-limits
- OpenAI rate-limit cookbook — https://developers.openai.com/cookbook/examples/how_to_handle_rate_limits
- OpenAI rate-limit guide — https://platform.openai.com/docs/guides/rate-limits
- Google SRE "Handling Overload" (10% retry-ratio) — https://sre.google/sre-book/handling-overload/
- gRPC retry guide — https://grpc.io/docs/guides/retry/
- gRPC client-retries proposal A6 — https://github.com/grpc/proposal/blob/master/A6-client-retries.md
- IETF Idempotency-Key (expired/archived I-D -07) — https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/

**Circuit breaker (deferred stateful stack)**
- effect#2843 "Add Circuit Breaker" (open since 2024-05-24) — https://github.com/Effect-TS/effect/issues/2843
- Cockatiel (MIT, reference-only) — https://github.com/connor4312/cockatiel
- opossum (Apache-2.0, reference-only) — https://github.com/nodeshift/opossum

**Conceptual port reference**
- freelawproject/courts-db (BSD) — https://github.com/freelawproject/courts-db

> Deeper line-level provenance, Open/Unverified flags, and the per-subtopic
> citations live in the five raw notes:
> [`research/schedule-retry-policy-library-design.md`](schedule-retry-policy-library-design.md),
> [`research/layer-unwrap-effect-provider-selection.md`](layer-unwrap-effect-provider-selection.md),
> [`research/bounded-fanout-graceful-degradation.md`](bounded-fanout-graceful-degradation.md),
> [`research/failure-vs-defect-error-helpers.md`](failure-vs-defect-error-helpers.md),
> [`research/resilience-stack-rate-limit-circuit-breaker.md`](resilience-stack-rate-limit-circuit-breaker.md).

---

## 4. In-repo capability references

The `@beep/*` bricks this packet composes (from bundle `secondaryTargets` +
RESEARCH In-Repo Inventory). Marked reuse / extend / NET-NEW.

| Capability | Path | Disposition |
| --- | --- | --- |
| `@beep/anthropic` (canonical `ExecutionPlan`/`Schedule` retry) | `packages/drivers/anthropic` | **extend** — DRY-extract its retry into the shared module; de-dupe `Anthropic.repair.ts` copy |
| `@beep/m365` (hand-rolled Retry-After recursion) | `packages/drivers/m365` | **reuse** prior art — fold into shared `networkRetry` via `Schedule.modifyDelay` |
| `@beep/openai-compat` (resilience gap, no retry) | `packages/drivers/openai-compat` | **extend** — close the gap on the shared module |
| `@beep/ai-provider-cli` (`LiteralKit`+`.$match` provider vocab) | `packages/drivers/ai-provider-cli` | **reuse** pattern — shape for the unified provider literal feeding `Config.literals` |
| `@beep/utils` (per-concern modules) | `packages/foundation/modeling/utils` | **NET-NEW** `Retry.ts` concern-module (candidate home for named policies) |
| `@beep/schema` (`*TaggedError*` helpers, AI-free) | `packages/foundation/modeling/schema` | **extend / NET-NEW** — host `decodeOrDie`/`isDefect`/`getErrorMessage` |
| `@beep/nlp` (`Executor` degraded fan-out prior art) | `packages/foundation/modeling/nlp` | **reuse** — extract its `Effect.result`-per-leaf shape into a generic combinator |
| `@beep/nlp-mcp` (batch-extraction fan-out consumer) | `packages/drivers/nlp-mcp` | **reuse / extend** — consuming surface for the degraded-batch combinator |
| `standards/effect-first-development.md` (laws EF-25/26/27/31) | `standards/effect-first-development.md` | **reuse** — documented laws; do not re-document |
| `.patterns/error-handling.md` | `.patterns/error-handling.md` | **reuse** — error-handling pattern reference |
| `effect/unstable/persistence/RateLimiter`, `Semaphore`, `PartitionedSemaphore`, `Cache` (v4 built-ins) | `node_modules/effect/dist/unstable/*`, vendored `.repos/effect-v4` | **reuse** — present but unused in repo; adopt rather than port Juris.AI#5 |
| `goals/effect-native-migration` (native-JS-type migration) | `goals/effect-native-migration` | **out-of-scope sibling** — NOT runtime orchestration |

---

## 5. Cross-links & provenance

- **Cluster id / route:** "Effect orchestration patterns (Schedule, Layer provider, bounded fan-out)" → `new-exploration` → this packet (cluster primary target).
- **Exploration ↔ goal links:** graduated [`goals/effect-v4-workflow-engine-spike`](../../../goals/effect-v4-workflow-engine-spike/README.md) on 2026-07-14; `ops/manifest.json` records the same link. `secondaryTargets` name `goals/effect-native-migration` only as an explicit out-of-scope boundary.
- **Sibling packets (proposed, not yet live):** `multi-provider-llm-dispatch-fallback` (runtime fallback/dispatch — keep distinct from this packet's build-time selector) and the deferred `resilience-stack-circuit-breaker-budget` (Q1/Q5/Q7 stateful stack). `crossref` in the bundle is empty.
- **This packet's own artifacts:** [`CAPTURE.md`](../CAPTURE.md) · [`RESEARCH.md`](../RESEARCH.md) (External Landscape + In-Repo Inventory + Constraints) · [`DECISIONS.md`](../DECISIONS.md) (7 open forks, recommended answers) · [`BRIEF.md`](../BRIEF.md) · [`MAP.md`](../MAP.md).
- **Codex review:** [`reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md) — folded 2026-06-29 (2 blocking: M365 retry prior art, existing degraded fan-out; 5 advisory).
- **Gold-intake provenance:** [`ROUTING.md`](../../_gold-intake/ROUTING.md) · [`routing.json`](../../_gold-intake/routing.json) · [`GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (Effect orchestration section).
