# All Seeing Eye

Use lane-contract.md. Lens: observability. Own D7 and P2's final adoption step.
P0e designs and proves the runner; other packages adopt it only in P2.

## Mission and rules

Give a failed or hung Effect test a concrete name, last observed log, outcome
and duration without changing its TestEnv, resource ownership or semantics.
Use the public instrumented it subpath in @beep/test-utils after P0e acceptance.
Do not recreate per-package runner wrappers or switch to live for logging.

Start/end/duration/outcome logs use Effect.log and annotations through a Logger
layer enabled only by BEEP_TEST_TRACE=1 or CI. Preserve user loggers and
TestConsole; keep identity and last-log state isolated per concurrent test.
Diagnostic duration is not the P1/P2 timing source; use the Node JSON reporter.

The live-clock watchdog must beat the resolved Vitest task timeout and name
the actual case/property test. A layer option controls hook acquisition, not
the body limit. Zero/Infinity disables the task timeout and needs explicit
handling. Preserve normal errors, defects, interruption, finalizers and loser
cancellation. Do not advance TestClock to make the watchdog fire.

Default it.live and excludeTestServices environments have no TestClock.
TestClock.withLive requires an installed TestClock; explicit provision can
satisfy it, but a universal watchdog cannot assume it. Runtime tests must cover
both environments and shared-layer TestClock behavior.

## Judgment beyond detectors

Check missing context on failures, swallowed causes, unnamed bounded waits,
last-log races, logger replacement, trace noise when disabled, concurrent
state leaks and watchdogs that themselves wait on frozen test time.
Audit the complete tester surface: call/skip/skipIf/runIf/only/each/fails/prop
and named/unnamed/nested layer callbacks. Preserve generic requirements,
TestContext and property parameters. At rc.113 each supplies only its case;
prop also supplies TestContext. Do not invent missing callback arguments.

Suggested rules: L-OBS-01 missing diagnostic context, L-OBS-02 wrong watchdog
clock, L-OBS-03 timeout/name mismatch, L-OBS-04 logger/state leak,
L-OBS-05 wrapper API loss. Emit shared-schema rows with concrete missing
information or changed semantics, not a generic preference for more logs.

## Evidence and pinned anchors

Use the accepted instrumented runner and its Node/Bun fixtures, actual failing
job/test output, the package's logger conventions and detector residue.
Use the current graph anchors for Effect.raceFirst, Effect.annotateLogs,
Logger.layer, Logger.consolePretty, TestClock.withLive, makeMethods and
it.effect / it.live with their layer/tester interfaces. The public TestContext
supplies resolved identity and timeout. Verify the accepted Vitest runtime in
the integration receipt and prove the public seam for each variant. rc.113's
native property engine must retain one registration-wide lifecycle and deadline.

## Worked adoption

Before: this valid test has ordinary runner behavior but no D7 instrumentation.

~~~ts
import { it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect } from "effect"

it.effect("finishes the operation", Effect.fnUntraced(function* () {
  yield* Effect.log("operation started")
  strictEqual(2 + 2, 4)
}))
~~~

After P0e acceptance, adopt the instrumented subpath during the P2 observability
step. The test remains effect-based; tracing is controlled by the environment.

~~~ts
import { it } from "@beep/test-utils/Vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect } from "effect"

it.effect("finishes the operation", Effect.fnUntraced(function* () {
  yield* Effect.log("operation started")
  strictEqual(2 + 2, 4)
}))
~~~

The initial Node/Bun and package proofs in history/2026-09-08-p0e-verification.md
are rc.112 evidence. Current acceptance requires the rc.113 integration receipt
and refreshed Node/Bun, compiler and package results.
Adoption remains the P2 observability step. Preserve the complete tester-mode
proof; a standalone race helper alone does not satisfy D7.
