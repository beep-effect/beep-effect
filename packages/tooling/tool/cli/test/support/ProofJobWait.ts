/**
 * Drives a proof job wait that must not return to its timeout on the TestClock.
 *
 * A wait that must not return proves nothing until it has polled. Forking the
 * wait and moving the clock straight past its timeout fires the timeout while
 * the first poll is still reading the record and the inbox, so the wait times
 * out even when a wave is there to hand back. Here the waiter runs on a clock
 * that reports its poll-interval sleep, which it reaches only after a whole
 * poll found nothing to return, and the clock moves past the timeout only then.
 * A waiter that returns instead fails the test with what it returned.
 */

import { assertInclude } from "@effect/vitest/utils";
import { Clock, Deferred, Duration, Effect, Fiber } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as TestClock from "effect/testing/TestClock";
import type { ProofJobLauncherShape, ProofJobWaitOptions } from "@beep/repo-cli/test/Yeet";
import type { UUID } from "@beep/schema/String";

export const waitTimesOut = Effect.fnUntraced(function* (
  launcher: ProofJobLauncherShape,
  jobId: UUID,
  options: ProofJobWaitOptions
) {
  // The poll interval is what tells the poll loop's sleep from the timeout's own.
  const timeoutMs = yield* O.match(
    O.filter(options.timeoutMs, (ms) => ms > options.pollIntervalMs),
    {
      onNone: () => Effect.die("waitTimesOut needs a timeoutMs longer than the poll interval"),
      onSome: Effect.succeed,
    }
  );
  const testClock = yield* TestClock.testClockWith(Effect.succeed);
  const polled = yield* Deferred.make<void>();
  const clock: Clock.Clock = {
    ...testClock,
    sleep: (duration) =>
      Duration.toMillis(duration) === options.pollIntervalMs
        ? Deferred.succeed(polled, undefined).pipe(Effect.andThen(testClock.sleep(duration)))
        : testClock.sleep(duration),
  };
  const waiter = yield* launcher.wait(jobId, options).pipe(Effect.provideService(Clock.Clock, clock), Effect.forkChild);
  // A waiter that returns never sleeps, so its exit also ends the race.
  yield* Effect.raceFirst(Deferred.await(polled), Fiber.await(waiter));
  yield* testClock.adjust(Duration.millis(timeoutMs + 1));
  yield* Result.match(yield* Effect.result(Fiber.join(waiter)), {
    onFailure: (error) => Effect.sync(() => assertInclude(error.message, "Timed out")),
    onSuccess: (returned) => Effect.die(`the wait returned ${returned.kind} where it had to time out`),
  });
});
