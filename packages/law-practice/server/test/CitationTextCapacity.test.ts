import { CitationCleanerFailure } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";

const setup = Effect.fn("TextCapacityTest.setup")(function* (maximum: number) {
  const policy = yield* defaultCitationEnginePolicy;
  return yield* makeCitationTextBudget({ ...policy.limits, producedTextUtf16: maximum });
});
it.effect("holds competing reservations through producer cleanup and settles exact remaining capacity", () =>
  Effect.gen(function* () {
    const budget = yield* setup(5);
    yield* budget.reserve(1);
    const entered = yield* Deferred.make<number>();
    const release = yield* Deferred.make<void>();
    const retired = yield* Deferred.make<void>();
    const producing = yield* budget
      .withCapacity((remaining) =>
        Deferred.succeed(entered, remaining).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.as({ value: "abc", units: 3 }),
          Effect.ensuring(Deferred.succeed(retired, undefined))
        )
      )
      .pipe(Effect.forkChild);
    const allowance = yield* Deferred.await(entered);
    const settled = yield* Deferred.make<void>();
    const waiting = yield* budget
      .reserve(2)
      .pipe(Effect.ensuring(Deferred.succeed(settled, undefined)), Effect.flip, Effect.forkChild);
    yield* Effect.yieldNow;
    const completedEarly = yield* Deferred.isDone(settled);
    yield* Deferred.succeed(release, undefined);
    const result = yield* Fiber.join(producing);
    expect(result).toEqual({ value: "abc", units: 3 });
    expect(allowance).toBe(4);
    expect(completedEarly).toBe(false);
    const failure = yield* Fiber.join(waiting);
    expect(failure).toMatchObject({ limit: "producedTextUtf16" });
    const done = yield* Deferred.isDone(retired);
    expect(done).toBe(true);
    const used = yield* budget.snapshot;
    expect(used).toBe(4);
  })
);
it.effect("rejects producer and inherited child reentry without deadlocking", () =>
  Effect.gen(function* () {
    const budget = yield* setup(2);
    const result = yield* budget.withCapacity(
      Effect.fnUntraced(function* () {
        const direct = yield* budget.reserve(1).pipe(Effect.flip);
        expect(direct).toMatchObject({ limit: "producedTextUtf16" });
        const child = yield* budget.reserve(1).pipe(Effect.flip, Effect.forkChild);
        const inherited = yield* Fiber.join(child);
        expect(inherited).toMatchObject({ limit: "producedTextUtf16" });
        const other = yield* setup(2);
        const nested = yield* other.withCapacity(() => Effect.succeed({ value: "x", units: 1 }));
        expect(nested.units).toBe(1);
        return { value: "", units: 0 };
      })
    );
    expect(result.units).toBe(0);
    yield* budget.reserve(2);
  })
);
it.effect("retains exclusion until interrupted producer finalization completes", () =>
  Effect.gen(function* () {
    const budget = yield* setup(1);
    const entered = yield* Deferred.make<void>();
    const retiring = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const producing = yield* budget
      .withCapacity(() =>
        Deferred.succeed(entered, undefined).pipe(
          Effect.andThen(Effect.never),
          Effect.ensuring(Deferred.succeed(retiring, undefined).pipe(Effect.andThen(Deferred.await(release))))
        )
      )
      .pipe(Effect.forkChild);
    yield* Deferred.await(entered);
    const interrupting = yield* Fiber.interrupt(producing).pipe(Effect.forkChild);
    yield* Deferred.await(retiring);
    const settled = yield* Deferred.make<void>();
    const waiting = yield* budget
      .reserve(1)
      .pipe(Effect.ensuring(Deferred.succeed(settled, undefined)), Effect.forkChild);
    yield* Effect.yieldNow;
    const completedEarly = yield* Deferred.isDone(settled);
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(interrupting);
    yield* Fiber.join(waiting);
    expect(completedEarly).toBe(false);
    const used = yield* budget.snapshot;
    expect(used).toBe(1);
  })
);
it.effect("refuses invalid settlement without a charge and permits empty output at zero remaining", () =>
  Effect.gen(function* () {
    const budget = yield* setup(2);
    const deliberate = CitationCleanerFailure.make({ reason: "callback-failed" });
    const rejected = yield* budget.withCapacity(() => Effect.fail(deliberate)).pipe(Effect.flip);
    expect(rejected).toBe(deliberate);
    for (const units of [-1, 3]) {
      const failure = yield* budget.withCapacity(() => Effect.succeed({ value: "", units })).pipe(Effect.flip);
      expect(failure).toMatchObject({ limit: "producedTextUtf16" });
      const used = yield* budget.snapshot;
      expect(used).toBe(0);
    }
    yield* budget.reserve(2);
    const empty = yield* budget.withCapacity((remaining) => {
      expect(remaining).toBe(0);
      return Effect.succeed({ value: "", units: 0 });
    });
    expect(empty.value).toBe("");
  })
);
