# Effect v4 Workflow Engine Spike Spec

## Objective

Prove whether a persistence-backed implementation of Effect v4's unstable
`WorkflowEngine.makeUnsafe` contract, housed in `packages/drivers/workflow`,
survives a real process kill and restart with one retryable keyed activity, one
durable clock, one externally completed durable deferred acknowledgment, and a
deterministic execution id. Deliver a documented pass/fail contract and handoff
evidence for `goals/law-docketing-reliability`, plus a compile-time and
behavioral proof guard that reruns whenever Effect is upgraded.

## Non-Goals

- A product reminder, docketing, polling, or notification workflow.
- A bespoke checkpoint, replay, or orchestration layer.
- A general resilience stack or shared retry package.
- A circuit breaker, generic degraded-fan-out helper, provider selector, or LLM
  retry consolidation; their demand triggers remain in the exploration map.
- Production store topology selection beyond what the bounded proof can support.
- Legal-calendar, court-holiday, jurisdictional-deadline, or reminder-policy logic.
- USPTO transport adoption or a duplicate `law-docketing-reliability` goal.
- Durability claims based on `WorkflowEngine.layerMemory` or graceful-only tests.

## Source Hierarchy

1. The user-ratified graduation objective and
   [`BRIEF.md`](../../explorations/effect-orchestration-patterns/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration [`DECISIONS.md`](../../explorations/effect-orchestration-patterns/DECISIONS.md),
   [`MAP.md`](../../explorations/effect-orchestration-patterns/MAP.md), and
   supporting `research/`, `ops/`, and `history/` artifacts.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/workflow` for the external encoded-engine adapter and its
  package-local compile-time/behavioral proof surfaces.
- Focused integration fixtures and a process-level kill/restart harness using a
  selected persistent store.
- Goal history for the pass/fail contract, crash matrix, upgrade-guard evidence,
  and `goals/law-docketing-reliability` handoff.

## Constraints (P0 checklist, locked and normative)

P0 must answer each item with executable proof or an explicit documented
contract before P1 freezes the adapter design:

1. Classify every engine operation as at-most-once, at-least-once, or
   effectively-once under a named idempotency boundary. Never claim exactly-once
   delivery without evidence.
2. Specify how execution ids are derived, collision-checked, reused, and
   versioned when workflow payloads or schemas change.
3. Specify how activity idempotency keys are derived, scoped, retained, and
   reconciled after ambiguous completion.
4. Define the atomic ordering among an external side effect, persisted activity
   outcome, and consumer cursor commit.
5. Define when polling cursors and heartbeats may advance and how a crash between
   business completion and progress persistence is repaired.
6. Identify the persisted clock, overdue-timer recovery, and behavior under wall-
   clock jumps and process downtime.
7. Keep legal-calendar meaning outside the engine so a durable timer is never
   mistaken for jurisdictional deadline calculation.
8. Prove how a fresh process discovers suspended/running executions and decides
   which are safe to resume without operator intervention.
9. Exercise controlled crashes across registration, activity start/finish,
   timer scheduling/wake, deferred completion, and terminal-result persistence.
10. Classify retry-safe failures, bounds/backoff, and unkeyed mutations that are
    prohibited from automatic retry.
11. Specify competing-worker, lease, duplicate-delivery, and activity-
    concurrency coordination after restart.
12. Prove or explicitly bound composition of nested concurrency, durable queues,
    clocks, and deferreds against deadlock, lost wake-ups, and unbounded duplicate
    work.
13. Separate process, store, remote-source, notifier, limiter, and monitor
    failure domains and name which recovery mechanism owns each.
14. Define duplicate, late, and already-completed deferred-acknowledgment
    semantics and consistent terminal-result observation.

Additional locked constraints:

- P0 selects and justifies the persistence store. Existing PGlite is a local
  candidate, not permission to imply production-topology parity; store atomicity
  and failure-domain gaps must be explicit.
- The representative workflow contains exactly the minimum proof elements: one
  named activity with bounded retry and deterministic idempotency key, one
  durable clock, one durable deferred completed outside the suspended workflow,
  and one deterministic execution id.
- The harness must kill the process at controlled boundaries and start a fresh
  process against the same store. `layerMemory` may appear only as a negative
  control; graceful shutdown alone is insufficient.
- Because `effect/unstable/workflow` is unstable, an Effect upgrade must trigger
  both a compile-time fixture over the consumed contract and the behavioral
  kill/restart suite. Drift fails close to the version bump with actionable
  evidence.

## Decision Log

Full rationale and rejected options remain in the exploration.

| Date | Locked decision | Source |
| --- | --- | --- |
| 2026-07-14 | Adopt consumer-led proof before shared checkpoint/retry/orchestration abstractions; HTTP resilience stays with `@beep/api-transport`. | [`Consumer-led adoption`](../../explorations/effect-orchestration-patterns/DECISIONS.md#2026-07-14--locked-consumer-led-adoption) |
| 2026-07-14 | Graduate only this persistence-backed workflow-engine spike; put the external adapter in `packages/drivers/workflow` and leave product workflows with their owners. | [`First goal`](../../explorations/effect-orchestration-patterns/DECISIONS.md#2026-07-14--locked-first-goal-is-the-workflow-engine-spike) |
| 2026-07-14 | USPTO transport adoption belongs to its existing sibling goal, not this packet. | [`USPTO`](../../explorations/effect-orchestration-patterns/DECISIONS.md#2026-07-14--locked-uspto-transport-adoption-folds-into-its-sibling) |
| 2026-07-14 | Breaker, fan-out promotion, provider selection, and LLM retry consolidation remain demand-gated. | [`Deferred stack`](../../explorations/effect-orchestration-patterns/DECISIONS.md#2026-07-14--locked-deferred-stack-is-demand-gated) |

## Pass/Fail Contract

The engine passes only if the same deterministic execution is rediscovered by a
fresh process, the keyed activity's business effect is not duplicated beyond
the documented delivery/idempotency boundary, the durable clock and deferred
acknowledgment recover at the exercised crash windows, one consistent terminal
result is observable, and all 14 constraints have evidence or honest limits.

The engine fails the docketing contract if any required state is lost or
stranded, unsafe duplication cannot be bounded, cursor/outcome ordering cannot
be made explicit, competing recovery is indeterminate, or the selected store's
atomicity makes the required guarantee impossible. A fail is a valid spike
result only when the smallest demonstrated contract gap, reproduction, and
handoff recommendation are archived without silently beginning a bespoke layer.

## Acceptance Criteria

- [ ] P0 records the selected store, rejected alternatives, atomicity/failure-
      domain limits, and a parity matrix mapping all 14 constraints to tests or
      explicit contracts.
- [ ] The adapter implements the consumed `WorkflowEngine.makeUnsafe` encoded
      operations in `packages/drivers/workflow` without product workflow logic.
- [ ] A fresh process resumes the deterministic execution against the same
      persistent store after controlled kills across all named crash windows.
- [ ] Evidence covers one keyed bounded-retry activity, one durable clock, one
      external durable-deferred acknowledgment, and one consistent terminal result.
- [ ] Delivery, idempotency, cursor/heartbeat ordering, retry safety, competing
      workers, concurrency composition, acknowledgment behavior, and independent
      failure domains are documented without an unsupported exactly-once claim.
- [ ] A negative/control lane shows why `layerMemory` or graceful-only restart is
      not durability evidence.
- [ ] The compile-time fixture and behavioral kill/restart command are wired into
      the documented Effect-upgrade procedure and fail actionably on drift.
- [ ] `history/` contains a pass/fail contract, crash matrix, known gaps, and a
      handoff document consumable by `goals/law-docketing-reliability`.
- [ ] Focused tests, repo quality gates, reflection lint, and Yeet PR-to-mergeable
      proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| P0 parity contract | Dated `history/` evidence mapping constraints 1–14 | Every row has executable proof or an explicit limit |
| Store selection | P0 decision/evidence note | Atomicity, crash model, topology limits, and rejected alternatives recorded |
| Process recovery | Focused process-level crash harness | Fresh process resumes the same execution across named crash windows |
| Activity safety | Focused keyed-activity tests and business-effect ledger | Delivery class is explicit; retries do not exceed the stated idempotency boundary |
| Clock/deferred/result | Focused persistent recovery tests | Overdue clock, external acknowledgment, duplicates/lateness, and terminal result match contract |
| Worker/failure domains | Competing-worker and fault-injection evidence | Ownership and unsupported overlap are explicit; no lost wake-up or unbounded duplication |
| Upgrade guard | Compile-time contract fixture plus behavioral crash command | Both are documented mandatory reruns on Effect upgrades |
| Docketing handoff | Dated `history/` handoff | Pass/fail, guarantees, gaps, and integration preconditions are actionable |
| Launcher size | `test "$(wc -m < goals/effect-v4-workflow-engine-spike/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-v4-workflow-engine-spike/ops/manifest.json` | Passes |
| Packet references | `rg -n "effect-v4-workflow-engine-spike|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-v4-workflow-engine-spike` | Expected references present |
| Whitespace | `git diff --check -- goals/effect-v4-workflow-engine-spike explorations/effect-orchestration-patterns explorations/ATLAS.md` | Passes |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at P3 close |

## Stop Conditions

- P0 cannot name a store and explicit atomicity contract capable of exercising
  meaningful process-restart durability.
- The encoded engine contract cannot represent or recover a required proof state.
- The proof exposes unsafe duplication, lost/stranded state, indeterminate
  competing recovery, or an ordering gap that blocks the docketing contract.
- Progress would require a product workflow, bespoke checkpoint layer, general
  resilience stack, or another named non-goal.
- Implementation requires an unapproved dependency/lockfile, public API/schema,
  auth, infrastructure, security, destructive-state, credential, cost, or policy
  change.
- The unstable API changes and the compile-time/behavioral guard cannot be
  restored within the bounded spike without redesign.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
