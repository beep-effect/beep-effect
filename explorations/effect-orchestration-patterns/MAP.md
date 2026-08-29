# Effect Orchestration Patterns — Map

## Candidate Goal Packets

| Candidate | Timing | Mission | Dependency / explicit trigger |
| --- | --- | --- | --- |
| [`effect-v4-workflow-engine-spike`](../../goals/effect-v4-workflow-engine-spike/README.md) | **GRADUATED — 2026-07-14** | Prove a persistence-backed `WorkflowEngine.makeUnsafe` survives kill/restart with one activity, durable clock, deferred acknowledgment, and deterministic execution id; add an Effect-upgrade guard. | None; produces prerequisite evidence for the existing docketing goal. |
| `circuit-breaker-consumer-spike` | Demand-gated | Incubate a clean-room breaker in the failing consumer boundary. | A measured failure mode must survive limiter + bounded retry + workflow recovery + independent monitoring; promotion requires a second congruent consumer. |
| `degraded-fanout-promotion` | Demand-gated | Promote a settled-result helper from proven local compositions. | A second consumer must match the NLP executor's failure, defect, ordering, and result semantics. |
| `provider-build-selector` | Demand-gated | Add app-local `Layer.unwrap` selection with redacted config and a literal vocabulary. | A concrete runtime must choose among compatible providers; unselected credentials must remain unevaluated. |
| `llm-retry-consolidation` | Demand-gated | Consolidate congruent LLM `ExecutionPlan` retry behavior. | A second `ExecutionPlan` consumer must appear with matching retry semantics. |

## Cross-References — Not Candidates

| Existing / sibling goal | Relationship |
| --- | --- |
| `goals/law-docketing-reliability` | Existing real first orchestration consumer. It consumes the engine spike's durability evidence; do not create a duplicate goal. |
| `goals/uspto-prosecution-read` | Absorbs `@beep/api-transport` adoption in `@beep/uspto` as a P0 spike and named P1 work item; this packet does not graduate a transport goal. |

## Sequencing

Only `effect-v4-workflow-engine-spike` graduated. Its pass/fail evidence
precedes the existing docketing consumer and determines whether any bespoke
durability machinery is justified. The other four rows are trigger-indexed
options, not a promised backlog; each stays dormant until its named consumer
evidence exists.

## First Vertical Slice

A test operator starts a deterministic workflow against a persistent store,
observes its activity complete and its durable timer/deferred suspension become
recoverable, kills the process at controlled crash boundaries, then starts a
fresh process against the same store. The new process resumes the same
execution id, does not duplicate the keyed activity's business effect, receives
the deferred acknowledgment, and reaches one inspectable terminal result.

The proof includes a negative/control lane showing that `layerMemory` cannot
satisfy restart durability, plus an upgrade lane that compiles against the
vendored unstable interfaces and reruns the crash harness whenever Effect is
bumped.

## P0 Spike Checklist / SPEC Constraints

The align gate's 14 missed questions are owned by the spike and must be answered
with tests or an explicit documented contract:

1. What delivery guarantee does each engine operation provide: at-most-once,
   at-least-once, or effectively-once under a stated idempotency boundary?
2. How are execution ids derived, collision-checked, reused, and versioned when
   workflow payload or schema changes?
3. How are activity idempotency keys derived, scoped, retained, and reconciled
   after ambiguous completion?
4. What is the atomic ordering among an external side effect, persisted
   activity outcome, and any consumer cursor commit?
5. When may polling cursors and heartbeats advance, and how are they repaired
   after a crash between business completion and progress persistence?
6. Which clock is persisted, how are overdue timers recovered, and what happens
   under wall-clock jumps or process downtime?
7. Where is legal-calendar meaning computed so a durable timer is never
   mistaken for jurisdictional deadline calculation?
8. How does a fresh process discover suspended/running executions and decide
   which are safe to resume without operator intervention?
9. Which crash points are exercised across register, activity start/finish,
   timer scheduling/wake, deferred completion, and terminal-result persistence?
10. Which failures are retry-safe, what bounds/backoff apply, and which
    unkeyed mutations are prohibited from automatic retry?
11. How are competing workers, leases, duplicate delivery, and activity
    concurrency coordinated after restart?
12. How do nested concurrency, durable queues, clocks, and deferreds compose
    without deadlock, lost wake-ups, or unbounded duplicate work?
13. What are the independent failure domains for process, store, remote source,
    notifier, limiter, and monitor, and which recovery mechanism owns each?
14. What acknowledgment semantics govern duplicate, late, or already-completed
    deferred completion, and how is the final result observed consistently?

## Capability Check

| Component | Existing capability or disposition |
| --- | --- |
| Typed workflow and deterministic execution identity | Reuse `.repos/effect-v4/packages/effect/src/unstable/workflow/Workflow.ts`. |
| Retryable/keyed activities | Reuse `.repos/effect-v4/packages/effect/src/unstable/workflow/Activity.ts`. |
| Durable timer, acknowledgment, and queued work | Reuse `DurableClock.ts`, `DurableDeferred.ts`, and `DurableQueue.ts` in the same vendored workflow directory. |
| Engine/proxy contracts | Reuse `WorkflowEngine.ts`, `WorkflowProxy.ts`, and `WorkflowProxyServer.ts`; no cluster dependency. |
| Official-source auth, limiter, and jittered transient retry | Extend `packages/foundation/capability/api-transport/src/Transport.ts`; live GovInfo/eCFR adoption is recorded in its README. |
| Degraded fan-out | Reuse the domain-local `packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Executor.ts` pattern; compose `Effect.result`/`partition`/`validate` locally until a second congruent consumer. |
| Persistence substrate candidate | Reuse `packages/drivers/pglite` and its persistent integration-test precedent for local proof; do not pre-decide the production store topology. |
| Encoded persistence adapter | **NET-NEW** in `packages/drivers/workflow`. |
| Process kill/restart crash harness | **NET-NEW**. |
| Unstable workflow API compile-time + behavioral upgrade guard | **NET-NEW**. |

## Open Risks Inherited From The Brief

- Effect's unstable workflow contract may churn before the docketing consumer
  lands.
- Store atomicity may be insufficient for the required activity/cursor order.
- At-least-once recovery may expose non-idempotent reminder or source actions.
- Legal-calendar semantics may be accidentally coupled to engine clock
  semantics.
- A local PGlite proof may not model the selected production store's failure
  domain; the proof must state that boundary honestly.
