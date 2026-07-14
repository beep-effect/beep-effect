# Effect Orchestration Patterns — Decisions

The align gate closed on 2026-07-14 with a **RATIFIED REFRAME**. The locked
entries below supersede the open 2026-06-29 pre-draft.

## 2026-07-14 — LOCKED: Consumer-led adoption

**Question:** Should the repo first build a shared retry/checkpoint/orchestration
layer, or prove the capabilities already vendored and promoted against real
consumers?

**Answer:** Reframe the work around consumer-led adoption. Before any bespoke
checkpoint, replay, or orchestration layer, prove that Effect v4's vendored
workflow subsystem cannot satisfy the docketing durability contract. Extend
HTTP resilience through the already-promoted `@beep/api-transport`. Keep LLM
retry predicates at the LLM driver boundary and build-time provider selection
app-local via `Layer.unwrap` at the composition root.

**Rationale:** The June premise was materially stale. The vendored workflow
surface provides `Workflow`, retryable/keyed `Activity`, `DurableDeferred`,
`DurableClock`, `DurableQueue`, `WorkflowProxy`, and a pluggable encoded
`WorkflowEngine.makeUnsafe` without a cluster dependency. Separately,
`@beep/api-transport` already provides jittered transient retry and the native
`RateLimiter`, with live GovInfo and eCFR consumers. Adoption evidence must
precede new abstraction.

**Rejected options:** The pre-draft's `Retry.ts` in `@beep/utils`, generic error
helpers in `@beep/schema`, and generic provider selector are rejected. They
centralize policies whose safe predicates and credential boundaries belong to
consumers, duplicate promoted HTTP resilience, and answer an abstraction
question before the durable workflow consumer is proven. A bespoke
checkpoint/replay layer is also rejected until the vendored workflow proof
fails the docketing contract.

## 2026-07-14 — LOCKED: First goal is the workflow-engine spike

**Question:** What is the first bounded proof, and where does its adapter live?

**Answer:** Graduate `effect-v4-workflow-engine-spike` first. Build a
persistence-backed `WorkflowEngine.makeUnsafe` implementation in
`packages/drivers/workflow` and prove kill/restart recovery with one activity,
one durable clock, one deferred acknowledgment, and a deterministic execution
id. Add a compile-time and behavioral unstable-API guard that reruns on every
Effect upgrade. Product workflows remain in their owning slice/server.

**Rationale:** This is the smallest vertical proof of the unknown: whether the
vendored encoded engine contract can meet restart-safe durability. A driver is
the correct home for an external engine wrapper; putting product orchestration
there would invert ownership. The spike supplies prerequisite evidence to the
existing `goals/law-docketing-reliability`, the real first orchestration
consumer.

**Rejected options:** Do not create a duplicate docketing goal, use
`WorkflowEngine.layerMemory` as durability evidence, place product workflows in
the driver, or proceed directly to a bespoke engine. The memory layer is
test-only and cannot prove process-restart recovery.

## 2026-07-14 — LOCKED: USPTO transport adoption folds into its sibling

**Question:** Does this packet graduate a separate USPTO transport goal?

**Answer:** No. `@beep/api-transport` adoption in `@beep/uspto` becomes a named
P1 work item plus a P0 spike in `goals/uspto-prosecution-read`, which is being
scaffolded from `explorations/uspto-patent-driver-depth`.

**Rationale:** Transport adoption belongs with the owning official-source
consumer and its acceptance contract. This packet records the dependency and
cross-link only.

**Rejected options:** A separate transport goal and a new retry package would
split one consumer change across packets and duplicate `@beep/api-transport`.

## 2026-07-14 — LOCKED: Deferred stack is demand-gated

**Question:** Which adjacent resilience abstractions should this packet build
now?

**Answer:** None. Circuit breaking, degraded-fan-out promotion, provider
build-selection, and LLM retry consolidation remain deferred behind the
explicit triggers below.

**Rationale:** Each abstraction has zero or one proven consumer today. Local
composition preserves semantics and evidence while avoiding a generic
resilience grab-bag.

**Rejected options:** The June bundle that extracted retry policies, error
helpers, degraded fan-out, and provider selection together is rejected as
supply-led consolidation without congruent consumer demand.

## 2026-07-14 — DEFERRED: Circuit breaker

**Question:** When may a circuit breaker be built?

**Answer:** Only after a measured failure mode survives rate limiting, bounded
retry, workflow recovery, and independent monitoring.

**Rationale:** A breaker is justified by observed failure-domain isolation, not
by completeness of a resilience catalog. When triggered, implement it
clean-room from behavioral requirements in the specific consuming boundary;
do not line-translate without attribution. Promote it only after a second
congruent consumer appears.

**Rejected options:** No speculative shared breaker, no dependency adoption by
default, and no breaker copied from a reference implementation.

## 2026-07-14 — DEFERRED: Degraded fan-out promotion

**Question:** When may the proven NLP fan-out shape become generic?

**Answer:** Keep the NLP executor domain-local. New consumers compose
`Effect.result`, `Effect.partition`, or `Effect.validate` locally. Extract a
settled-result helper only when a second consumer demonstrates matching
semantics.

**Rationale:** Matching failure accumulation, defect behavior, ordering, and
result shape matter more than superficial structural similarity.

**Rejected options:** The pre-draft generic tagged-status combinator is
rejected until a second congruent consumer exists.

## 2026-07-14 — DEFERRED: Provider build-selector

**Question:** When should provider selection be abstracted?

**Answer:** Only when a concrete runtime must choose among compatible
providers. Keep it app-local using `Layer.unwrap`, `Config.redacted`, and a
literal provider vocabulary; unselected credentials must never be evaluated.

**Rationale:** Provider compatibility and secret evaluation are composition-root
facts, not a foundation utility contract.

**Rejected options:** No generic selector package and no eager construction of
all provider layers.

## 2026-07-14 — DEFERRED: LLM retry consolidation

**Question:** When may LLM retry policy be consolidated?

**Answer:** Only when a second `ExecutionPlan` consumer appears.

**Rationale:** Retryability is provider- and operation-specific. Until two
consumers prove congruent semantics, predicates stay at each LLM driver
boundary.

**Rejected options:** No foundation-level LLM schedule or generic
`isRetryable` helper based on one driver.

## 2026-07-14 — CROSS-LINK: Owning consumers

`goals/law-docketing-reliability` remains the existing first orchestration
consumer and depends on evidence from `effect-v4-workflow-engine-spike`.
`goals/uspto-prosecution-read` absorbs USPTO transport adoption; it is a
cross-reference, not a candidate graduated by this packet.
