# Effect v4 Workflow Engine Spike — Implementation Sources & Provenance

- **Primary ledger:**
  [`explorations/effect-orchestration-patterns/research/SOURCES.md`](../../../explorations/effect-orchestration-patterns/research/SOURCES.md).
  Corrections begin there and are synchronized here.
- **Current capability inventory:**
  [`explorations/effect-orchestration-patterns/RESEARCH.md`](../../../explorations/effect-orchestration-patterns/RESEARCH.md),
  refreshed 2026-07-14. Live vendored source must be re-read before implementation
  because the workflow namespace is unstable.
- **Gold-intake provenance:**
  [`ROUTING.md`](../../../explorations/_gold-intake/ROUTING.md),
  [`routing.json`](../../../explorations/_gold-intake/routing.json), and
  [`GOLD_SYNTHESIS.md`](../../../explorations/_gold-intake/GOLD_SYNTHESIS.md).

## 1. Relevant mined corpus

The source ledger's eight mined nuggets motivated the original helper-bundle
premise. The 2026-07-14 consumer-led reframe supersedes that premise for this
goal: none of those external snippets supplies the workflow adapter. They remain
provenance and demand-trigger evidence only.

| Source | Upstream | Location | License | Disposition for this goal |
| --- | --- | --- | --- | --- |
| research-squad#3 | research-squad | `src/infrastructure/retry-policies.ts:78-113` | MIT | Reference-only; do not create a shared retry module. Activity retry remains local to the proof contract. |
| research-squad#11 | research-squad | `src/services/MultiAgentOrchestratorService.ts:738-751` | MIT | Out of scope; generic fan-out remains demand-gated. |
| Juris.AI#5 | Juris.AI | `src/lib/quota-manager.ts:28-79` | MIT | Out of scope; native rate limiting is already composed by `@beep/api-transport`. |
| uspto_pfw_mcp#5 | uspto_pfw_mcp | `src/patent_filewrapper_mcp/api/enhanced_client.py:38-101` | MIT | Reference-only; circuit breaking/general resilience remains demand-gated and clean-room if triggered. |

No external source code is required for the adapter. Implement against the
vendored Effect contract and repo persistence capabilities.

## 2. Effect v4 workflow module paths

Authoritative live source: `.repos/effect-v4/packages/effect/src/unstable/workflow/`.

| Module | Recorded contract used by the spike | Disposition |
| --- | --- | --- |
| `Workflow.ts` | Typed workflow identity/payload, deterministic execution id, execute/poll/resume, encoded completion/suspension. | Reuse; lock consumed shape in the compile-time upgrade fixture. |
| `Activity.ts` | Named encoded activity, bounded retry schedule, deterministic `idempotencyKey`. | Reuse; prove the stated delivery/idempotency boundary. |
| `DurableClock.ts` | Engine-delegated durable timer. | Reuse; prove scheduling, overdue recovery, and wake crash windows. |
| `DurableDeferred.ts` | Externally completable engine-backed durable acknowledgment. | Reuse; prove duplicate, late, and completed acknowledgment behavior. |
| `DurableQueue.ts` | Persisted queued work with durable completion tokens. | Contract/parity probe only unless required by engine correctness; no product queue. |
| `WorkflowEngine.ts` | Low-level `WorkflowEngine.makeUnsafe` `Encoded` operations for register, execute/poll, interrupt/resume, activity, deferred, and clock behavior. `layerMemory` is test/local only. | Extend with a **NET-NEW** persistence-backed driver adapter; memory is negative control only. |
| `WorkflowProxy.ts` | Derived execute/discard/resume surface. | Reference/reuse only if the harness needs the canonical boundary. |
| `WorkflowProxyServer.ts` | RPC/HTTP server surface for proxy operations. | Reference/reuse only; no cluster dependency or general server platform. |
| `index.ts` | Workflow subsystem exports. | Reuse canonical exports; compile-time fixture detects drift. |

The external stability evidence already recorded by the exploration is Effect's
v4 beta recap: <https://effect.website/blog/effect-v4beta-launch-to-may-recap/>.
It supports the mandatory compile-time plus behavioral rerun policy; the live
vendored source remains authoritative for exact APIs.

## 3. Persistence and harness capabilities

| Capability | Path | Disposition |
| --- | --- | --- |
| Persistent local substrate candidate | `packages/drivers/pglite` | Reuse/evaluate in P0; existing integration-test precedent does not pre-decide production topology. |
| Encoded workflow adapter | `packages/drivers/workflow` | **NET-NEW** external engine wrapper; no product orchestration. |
| Process kill/restart crash harness | Focused driver integration-test/evidence surface selected in P0 | **NET-NEW**; must use a fresh process and the same persistent store. |
| Effect upgrade guard | Package compile-time fixture plus behavioral crash command selected in P1 | **NET-NEW**; mandatory on every Effect upgrade. |
| Docketing consumer | `goals/law-docketing-reliability` | Existing consumer; receives pass/fail evidence and integration preconditions. |

## 4. `@beep/api-transport` supersession evidence

These ledger entries explain why HTTP resilience and USPTO work do not enter
this goal:

| Capability | Path | Recorded evidence | Disposition |
| --- | --- | --- | --- |
| Shared official-source transport | `packages/foundation/capability/api-transport/src/Transport.ts` | Composes authentication, `HttpClient.withRateLimiter`, native unstable `RateLimiter`, and jittered transient retry. | Reuse in owning consumers; do not create a retry/resilience package here. |
| Promotion record | `packages/foundation/capability/api-transport/README.md` | Records incubation in GovInfo and promotion after congruent eCFR adoption. | Current shared HTTP-resilience authority. |
| GovInfo adopter | `packages/drivers/govinfo/src/Govinfo.service.ts` | Imports and applies `makeApiTransport`. | Existing live evidence. |
| eCFR adopter | `packages/drivers/ecfr/src/Ecfr.service.ts` | Imports and applies `makeApiTransport`. | Existing live evidence. |
| USPTO adoption owner | `goals/uspto-prosecution-read` and `packages/drivers/uspto` | Exploration inventory records no current api-transport adoption; work belongs to the sibling goal. | Out of this packet. |

## 5. Cross-links

- Source exploration:
  `explorations/effect-orchestration-patterns/{BRIEF,MAP,DECISIONS,RESEARCH}.md`.
- Primary provenance ledger:
  `explorations/effect-orchestration-patterns/research/SOURCES.md`.
- Graduated goal: `goals/effect-v4-workflow-engine-spike`.
- Handoff consumer: `goals/law-docketing-reliability`.
- Demand-gated candidates remain indexed only in the exploration `MAP.md`.
