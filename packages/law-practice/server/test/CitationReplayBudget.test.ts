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

const canonicalReplayDeclaredLimits = Effect.gen(function* () {
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
    const limits = yield* canonicalReplayDeclaredLimits;
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
    const longer = Duration.seconds(400);
    expect(
      longer.pipe(widenCitationReplaySleep(longer), Duration.toMillis),
      "the widening never shortens a declared limit above the budget"
    ).toBe(400_000);
  })
);

it.effect("refuses a policy whose other limit equals operationDeadline", () =>
  Effect.gen(function* () {
    const limits = yield* canonicalReplayDeclaredLimits;
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
    const limits = yield* canonicalReplayDeclaredLimits;
    const inner = yield* Clock.Clock;
    const requested = yield* Ref.make(A.empty<number>());
    const spyDelegatingTestClockPrototypeReads = {
      currentTimeMillisUnsafe: () => inner.currentTimeMillisUnsafe(),
      currentTimeNanosUnsafe: () => inner.currentTimeNanosUnsafe(),
      currentTimeMillis: inner.currentTimeMillis,
      currentTimeNanos: inner.currentTimeNanos,
      monotonicTimeNanosUnsafe: () => inner.monotonicTimeNanosUnsafe(),
      monotonicTimeNanos: inner.monotonicTimeNanos,
      sleep: (duration: Duration.Duration) =>
        Ref.update(requested, A.append(Duration.toMillis(duration))).pipe(Effect.andThen(inner.sleep(duration))),
    } satisfies Clock.Clock;
    const clock = yield* makeCitationReplayBudgetClock(limits, spyDelegatingTestClockPrototypeReads);
    const admission = yield* makeCitationOperationAdmission(limits).pipe(Effect.provideService(Clock.Clock, clock));
    const fiber = yield* admission.run("extract", Effect.never).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    const sleeps = yield* Ref.get(requested);
    expect(
      sleeps,
      "the spy sits under the widening: a 150 s sleep reaches it only from the admission timeout for the declared 50 s"
    ).toContain(Duration.toMillis(citationReplayOperationBudget));
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
