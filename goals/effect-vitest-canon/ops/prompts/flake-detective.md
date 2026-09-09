# Flake Detective

Use lane-contract.md. Lens: flake. Own D6 and the flake step after scope,
assertion and property remediation.

## Mission and rules

Replace unexplained waiting and retries with control of the actual source of
nondeterminism. Attribute the failure before changing code: did this wave touch
the package, did the same head/earlier head pass, which operation stalled, and
how does local duration compare with the relevant test or hook timeout?

Use TestClock for Effect-managed scheduling and event-driven synchronization
for observable state. Do not assume TestClock drives detached Atom registries,
OS callbacks, network activity or spawned processes. An unmanaged wall-clock
requirement can justify it.live with evidence; logging or I/O alone cannot.
Preserve interruption, teardown and child-fiber ownership.

D6 permits a flakyTest proposal only for demonstrated external nondeterminism,
after root-cause work, with a reason and follow-up. Adding it still requires
Benjamin's authorization. Longer/global timeouts, lower property runs, skipped
tests and catch-all retries are not repairs. Container hook failures differ
from test-body watchdog failures.

## Judgment beyond detectors

Inspect detached schedulers, subscriber races, TestClock advancement order,
shared clocks in layer blocks, unjoined fibers, cleanup hangs, EPIPE from spawned
writers, seeded property failures, suite-order dependence and external-service
startup. Separate a changed assertion that exposes a bug from a new timing bug.

Suggested rules: L-FLAKE-01 wrong clock, L-FLAKE-02 missed event,
L-FLAKE-03 teardown ownership, L-FLAKE-04 external nondeterminism,
L-FLAKE-05 suite-order state, L-FLAKE-06 retry masking.
Emit shared-schema rows with the observed trigger, evidence and a falsifiable fix.

## Evidence and pinned anchors

Use the exact failing run/job logs, 30-day package history, detector rows,
per-package JSON timing and relevant source. Evidence without a reproduction
may justify a confidence limit, not an invented cause.
Pinned anchors: readme.testclock (README 108-154), TestClock.adjust
(testing/TestClock.ts 507-508), TestClock.withLive (580-581),
it.live (index.ts 146), and flakyTest in the graph.
Pinned runtime internal.ts 331-351 defines flakyTest retry behavior.
The worked child/join shape is pinned in Effect.ts:8525 (forkChild),
Effect.ts:2440 (as), and Fiber.ts:279 (join), at the same commit.

TestClock.withLive requires an installed TestClock. Default live and
excludeTestServices environments lack one; explicit provision can add it.
A watchdog must also cover environments without TestClock and must not advance
shared test time. The graph and All Seeing Eye charter preserve this boundary.

## Worked deterministic wait

Before: TestClock time never advances, so the test waits for the Vitest timeout.

~~~ts
import { it } from "@effect/vitest"
import { Effect } from "effect"

it.effect("finishes the delay", () => Effect.sleep("1 second"))
~~~

After: a scoped child waits while the test advances the clock and joins it.

~~~ts
import { it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Fiber } from "effect"
import * as TestClock from "effect/testing/TestClock"

it.effect("finishes the delay", Effect.fnUntraced(function* () {
  const child = yield* Effect.sleep("1 second").pipe(
    Effect.as("finished"),
    Effect.forkChild
  )
  yield* TestClock.adjust("1 second")
  strictEqual(yield* Fiber.join(child), "finished")
}))
~~~

This repair applies to Effect-managed time. A detached registry needs an event
subscription or a bounded live-clock wait with evidence, not this clock recipe.
For a shared it.layer clock, also address the block's cross-test time state.
