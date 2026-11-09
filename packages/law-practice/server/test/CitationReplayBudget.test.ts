import { makeCitationOperationAdmission } from "@beep/law-practice-server/internal/Citation/Admission";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";
import {
  citationReplayOperationBudget,
  makeCitationReplayBudgetClock,
  widenCitationReplaySleep,
} from "./CitationReplayBudget.ts";

/** The canonical replay's declared limits (`setupCitationMetadataRuntime(kind, _, _, true)` on the shared policy). */
const replayLimits = Effect.gen(function* () {
  const defaults = (yield* defaultCitationEnginePolicy).limits;
  return {
    ...defaults,
    regexDeadline: Duration.millis(997),
    extractDeadline: Duration.millis(997),
    concurrentOperations: 1,
  };
});

it.effect("widens the declared operationDeadline and passes every other replay deadline through", () =>
  Effect.gen(function* () {
    const limits = yield* replayLimits;
    const widen = widenCitationReplaySleep(limits.operationDeadline);
    expect(Duration.toMillis(widen(limits.operationDeadline))).toBe(Duration.toMillis(citationReplayOperationBudget));
    const others = A.filter(
      R.toEntries(limits),
      (entry): entry is [(typeof entry)[0], Duration.Duration] =>
        entry[0] !== "operationDeadline" && Duration.isDuration(entry[1])
    );
    expect(A.length(others)).toBeGreaterThan(0);
    for (const [name, value] of others) {
      expect([name, Duration.equals(widen(value), value)]).toEqual([name, true]);
      expect([name, Duration.equals(value, limits.operationDeadline)]).toEqual([name, false]);
    }
    // The widening never shortens a declared limit above the budget.
    const longer = Duration.seconds(400);
    expect(Duration.toMillis(widenCitationReplaySleep(longer)(longer))).toBe(400_000);
  })
);

it.effect("refuses a policy whose other limit equals operationDeadline", () =>
  Effect.gen(function* () {
    const limits = yield* replayLimits;
    const inner = yield* Clock.Clock;
    const exit = yield* makeCitationReplayBudgetClock(
      { ...limits, cleanDeadline: limits.operationDeadline },
      inner
    ).pipe(Effect.exit);
    expect(Exit.hasDies(exit)).toBe(true);
  })
);

it.effect("keeps an admitted extract alive past the declared operationDeadline until the replay budget", () =>
  Effect.gen(function* () {
    const limits = yield* replayLimits;
    const inner = yield* Clock.Clock;
    const requested = yield* Ref.make(A.empty<number>());
    // TestClock keeps its time reads on the prototype, so delegate them instead of spreading.
    const spy = {
      currentTimeMillisUnsafe: () => inner.currentTimeMillisUnsafe(),
      currentTimeNanosUnsafe: () => inner.currentTimeNanosUnsafe(),
      currentTimeMillis: inner.currentTimeMillis,
      currentTimeNanos: inner.currentTimeNanos,
      monotonicTimeNanosUnsafe: () => inner.monotonicTimeNanosUnsafe(),
      monotonicTimeNanos: inner.monotonicTimeNanos,
      sleep: (duration: Duration.Duration) =>
        Ref.update(requested, A.append(Duration.toMillis(duration))).pipe(Effect.andThen(inner.sleep(duration))),
    } satisfies Clock.Clock;
    const clock = yield* makeCitationReplayBudgetClock(limits, spy);
    const admission = yield* makeCitationOperationAdmission(limits).pipe(Effect.provideService(Clock.Clock, clock));
    const fiber = yield* admission.run("extract", Effect.never).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    // The spy sits under the widening: a 150 s wait reaches it only from a sleep for exactly the
    // declared 50 s, so the admission's own timeout is the sleep the replay clock matches.
    const sleeps = yield* Ref.get(requested);
    expect(sleeps).toContain(Duration.toMillis(citationReplayOperationBudget));
    yield* TestClock.adjust(limits.operationDeadline);
    const pending = yield* admission.snapshot;
    expect(pending).toMatchObject({ active: 1 });
    yield* TestClock.adjust(Duration.subtract(citationReplayOperationBudget, limits.operationDeadline));
    const failure = yield* fiber.pipe(Fiber.join, Effect.flip);
    expect(failure).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "extract",
      limit: "operationDeadline",
    });
    const released = yield* admission.snapshot;
    expect(released).toMatchObject({ active: 0 });
  })
);
