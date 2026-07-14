# Effect Orchestration Patterns — Brief

## Problem

The repo needs durable, restart-safe orchestration for malpractice-grade legal
reminder loops and rate-limited polling of official sources. A killed process
must not lose a scheduled wake-up, repeat an unsafe side effect, skip a cursor,
or strand an acknowledgment. At the same time, the repo must not duplicate
capability already present in Effect v4's vendored workflow subsystem or in the
promoted `@beep/api-transport` used by GovInfo and eCFR.

The immediate unknown is narrow and consequential: can a persistence-backed
implementation of Effect v4's pluggable encoded workflow engine satisfy the
docketing durability contract across a real process kill and restart? That
evidence must exist before designing a bespoke checkpoint/replay layer.

## Appetite

**Proposed — ratify at shape sign-off:** one focused spike goal, bounded to the
encoded persistence adapter, a representative kill/restart proof, and an
Effect-upgrade guard. Stop after producing a documented pass/fail contract and
handoff evidence for `goals/law-docketing-reliability`; do not implement the
product reminder workflow or a general resilience stack in this appetite.

## Solution Sketch

Graduate `effect-v4-workflow-engine-spike` as the first and only immediate goal.
Place the external engine wrapper in `packages/drivers/workflow`; keep product
workflows in their owning slice/server.

The spike wires a persistence-backed `WorkflowEngine.makeUnsafe` adapter to one
minimal workflow containing:

1. a named activity with bounded retry and a deterministic idempotency key;
2. a durable clock that suspends the execution;
3. a durable deferred acknowledgment completed outside the suspended workflow;
4. a deterministic execution id that finds the same run after restart.

The harness starts the workflow, records progress, kills the process at
controlled boundaries, restarts against the same store, resumes the execution,
and proves the activity/clock/deferred outcome and terminal result. It must
exercise crash windows rather than only graceful shutdown. Compile-time API
fixtures plus the behavioral kill/restart proof rerun on every Effect upgrade
because the workflow namespace is unstable.

The resulting evidence flows into the existing
`goals/law-docketing-reliability`, which remains the real first orchestration
consumer. Official-source HTTP polling composes `@beep/api-transport`; USPTO
adoption is owned by `goals/uspto-prosecution-read`.

## Rabbit Holes

- **Unstable API churn:** encoded engine contracts may change between Effect
  upgrades; the guard must fail close to the version bump with actionable
  compile-time and behavioral evidence.
- **Persistence-store selection:** PGlite is an existing repo persistence brick
  and a useful local spike candidate, but the adapter contract must not silently
  assume one production topology before crash/atomicity requirements are known.
- **At-least-once versus effectively-once:** replay can repeat activity delivery;
  safe completion depends on idempotency keys, persisted outcomes, and explicit
  mutation policy—not an exactly-once claim.
- **Cursor/heartbeat ordering:** official-source cursors and worker heartbeats
  must not advance before the durable business outcome they represent.
- **Clock versus legal-calendar meaning:** a durable duration/timer does not
  itself compute court holidays, jurisdictional deadlines, or reminder policy.
- **Failure-domain overlap:** process, persistence store, remote source,
  notification provider, limiter, and monitor failures must be distinguished so
  one mechanism is not credited with recovery it cannot provide.

## No-Gos

- No bespoke checkpoint, replay, or orchestration layer before the vendored
  workflow proof demonstrates a docketing-contract gap.
- No generic resilience grab-bag package or new shared retry home;
  `@beep/api-transport` remains the HTTP resilience surface.
- No circuit breaker, generic degraded fan-out, provider selector, or LLM retry
  consolidation before its ratified demand trigger fires.
- No product orchestration inside `packages/drivers/workflow`; drivers wrap the
  external engine, while workflows remain in their owning slice/server.
- No duplicate `law-docketing-reliability` or standalone USPTO transport goal.
- No durability claims based on `WorkflowEngine.layerMemory` or graceful-only
  restart tests.
