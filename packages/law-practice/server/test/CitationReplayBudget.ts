/** Wall-clock budget for canonical replays that run real native workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as R from "effect/Record";
import type * as Clock from "effect/Clock";

/**
 * Real-clock wait that stands in for the policy `operationDeadline` during a canonical replay.
 *
 * **Details**
 *
 * The shared test policy declares a 50 s `operationDeadline` for each `engine.extract` call (one
 * canonical row). That fits the workstation and the 8-vCPU heavy runner. On the 4-vCPU hosted
 * `Test Integration (lps-int-N)` partitions, two replays from one range file share a single
 * Vitest worker and its native children. In PR #3020 `lps-int-12` the "documents 121-130" test
 * failed after 71 s in total, when one of its rows passed the 50 s `operationDeadline`
 * (`CitationSafetyLimitExceeded`) while "law inputs in group 0" ran alongside.
 *
 * How far that row overran is not observable: the deadline interrupts it at 50 s. The value here
 * is therefore an estimate, not a measured row maximum. Hosted group durations put per-row means
 * between about 5 s and 18 s, hosted runners are about 1.5x slower than the workstation, and
 * three times the declared limit leaves a 2x tail margin on top of that factor. It stays well
 * under the 600 s Vitest timeout, which still bounds a real hang.
 *
 * The engine schema caps a declared `operationDeadline` at 60 s, which is less headroom than the
 * hosted slowdown, so the replay keeps the declared 50 s limit (and the engine artifact derived
 * from it) and widens only the test Clock's wait.
 *
 * **Gotchas**
 *
 * A row can now be three times slower than the declared limit and still pass a replay, so the
 * replays do not catch a per-row slowdown smaller than that.
 *
 * @internal @category testing @since 0.0.0
 */
export const citationReplayOperationBudget = Duration.seconds(150);

/**
 * Duration-valued limits whose sleeps a replay clock must tell apart from `operationDeadline`.
 *
 * @internal @category testing @since 0.0.0
 */
export interface CitationReplayBudgetLimits {
  readonly operationDeadline: Duration.Duration;
  readonly [limit: string]: unknown;
}

/**
 * Map one requested sleep to the real wait a canonical replay grants it.
 *
 * **Details**
 *
 * A sleep equal to `operationDeadline` waits `citationReplayOperationBudget`, or the declared
 * limit itself if a policy ever declares more than the budget, so the widening never shortens a
 * deadline. Every other sleep passes through unchanged.
 *
 * **Example** (Widening only the operation deadline)
 * ```ts
 * import * as Duration from "effect/Duration";
 * import { widenCitationReplaySleep } from "./CitationReplayBudget.ts";
 *
 * const widen = widenCitationReplaySleep(Duration.seconds(50));
 * widen(Duration.seconds(50)); // 150 seconds
 * widen(Duration.seconds(10)); // 10 seconds
 * ```
 *
 * @internal @category testing @since 0.0.0
 */
export const widenCitationReplaySleep =
  (operationDeadline: Duration.Duration) =>
  (input: Duration.Duration): Duration.Duration =>
    Duration.equals(input, operationDeadline) ? Duration.max(input, citationReplayOperationBudget) : input;

/**
 * Wrap a replay's Clock so the declared `operationDeadline` waits the replay budget.
 *
 * **Details**
 *
 * The wrapper recognises the operation deadline by value, because the owners
 * (`Citation/Admission.ts`, `CleanerPipeline.ts`, `MarkupWorker.ts`) sleep for exactly the
 * declared limit. The clock dies at install time when any other Duration-valued limit equals
 * `operationDeadline`, since that limit's sleeps would be widened as well.
 *
 * Every time read (`currentTimeMillis`, `currentTimeNanos`, `monotonicTimeNanos` and their unsafe
 * forms) and every sleep goes to `inner`, so the wrapped clock never mixes two time sources.
 *
 * **Gotchas**
 *
 * An owner that sleeps for exactly `operationDeadline` under another name, such as
 * `Duration.min(stageDeadline, operationDeadline)` once a stage deadline reaches it, is widened
 * too. The shared test policy's stage deadlines (10 s and below) keep that from happening.
 *
 * **Example** (Wrapping a replay's manual clock)
 * ```ts
 * import * as Clock from "effect/Clock";
 * import * as Duration from "effect/Duration";
 * import * as Effect from "effect/Effect";
 * import { makeCitationReplayBudgetClock } from "./CitationReplayBudget.ts";
 *
 * const program = Effect.gen(function* () {
 *   const inner = yield* Clock.Clock;
 *   return yield* makeCitationReplayBudgetClock({ operationDeadline: Duration.seconds(50) }, inner);
 * });
 * ```
 *
 * @internal @category testing @since 0.0.0
 */
export const makeCitationReplayBudgetClock = Effect.fn("CitationReplayBudget.clock")(function* (
  limits: CitationReplayBudgetLimits,
  inner: Clock.Clock
) {
  const collisions = pipe(
    R.toEntries(limits),
    A.filter(
      ([name, value]) =>
        name !== "operationDeadline" && Duration.isDuration(value) && Duration.equals(value, limits.operationDeadline)
    ),
    A.map(([name]) => name)
  );
  if (A.isReadonlyArrayNonEmpty(collisions)) {
    return yield* Effect.die(
      `CitationReplayBudget: ${A.join(collisions, ", ")} equals operationDeadline and would be widened with it`
    );
  }
  const widen = widenCitationReplaySleep(limits.operationDeadline);
  return {
    currentTimeMillisUnsafe: () => inner.currentTimeMillisUnsafe(),
    currentTimeNanosUnsafe: () => inner.currentTimeNanosUnsafe(),
    currentTimeMillis: inner.currentTimeMillis,
    currentTimeNanos: inner.currentTimeNanos,
    monotonicTimeNanosUnsafe: () => inner.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: inner.monotonicTimeNanos,
    sleep: (input: Duration.Duration) => inner.sleep(widen(input)),
  } satisfies Clock.Clock;
});
