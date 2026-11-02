import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Scope from "effect/Scope";
import * as TestClock from "effect/testing/TestClock";
import { makeCitationOperationAdmission } from "../src/internal/Citation/Admission.ts";
import type { CitationOperationAdmission } from "../src/internal/Citation/Admission.ts";

const hold = Effect.fn("AdmissionTest.hold")(function* (
  admission: CitationOperationAdmission["Service"],
  finalize: Effect.Effect<void> = Effect.void
) {
  const entered = yield* Deferred.make<void>();
  const release = yield* Deferred.make<void>();
  const fiber = yield* admission
    .run(
      "clean",
      Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.ensuring(finalize))
    )
    .pipe(Effect.forkChild);
  return { entered: Deferred.await(entered), release: Deferred.succeed(release, undefined), fiber };
});

it.effect("shares operation slots across kinds and rejects overload before evaluating a body", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationOperationAdmission({
      ...limits,
      concurrentOperations: 1,
      queuedOperations: 1,
    });
    const first = yield* hold(admission);
    yield* first.entered;
    const second = yield* admission.run("resolve", Effect.succeed("resolved")).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    expect(yield* admission.snapshot).toEqual({ active: 1, queued: 1, closed: false });
    let evaluated = false;
    const overloaded = yield* Effect.flip(
      admission.run(
        "extract",
        Effect.sync(() => {
          evaluated = true;
        })
      )
    );
    expect(overloaded).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "extract",
      limit: "queuedOperations",
    });
    expect(evaluated).toBe(false);
    yield* first.release;
    yield* Fiber.join(first.fiber);
    expect(yield* Fiber.join(second)).toBe("resolved");
    expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
  })
);

it.effect("returns cancelled queue capacity and preserves the active operation", () =>
  Effect.gen(function* () {
    const admission = yield* makeCitationOperationAdmission((yield* defaultCitationEnginePolicy).limits);
    const first = yield* hold(admission);
    yield* first.entered;
    const queued = yield* admission.run("resolve", Effect.never).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* Fiber.interrupt(queued);
    expect(Exit.hasInterrupts(yield* Fiber.await(queued))).toBe(true);
    expect(yield* admission.snapshot).toEqual({ active: 1, queued: 0, closed: false });
    yield* first.release;
    yield* Fiber.join(first.fiber);
    expect(yield* admission.run("annotate", Effect.succeed("next"))).toBe("next");
  })
);

it.effect("expires queue waiting without running the queued body", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationOperationAdmission({ ...limits, queueDeadline: Duration.millis(20) });
    const first = yield* hold(admission);
    yield* first.entered;
    const queued = yield* admission.run("extract", Effect.succeed("must not run")).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(20));
    expect(yield* Fiber.join(queued).pipe(Effect.flip)).toMatchObject({ operation: "extract", limit: "queueDeadline" });
    expect(yield* admission.snapshot).toEqual({ active: 1, queued: 0, closed: false });
    yield* first.release;
    yield* Fiber.join(first.fiber);
  })
);

it.effect("includes queue time in the captured total deadline and ignores caller Clock replacement", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationOperationAdmission({ ...limits, operationDeadline: Duration.millis(50) });
    const clock = yield* Clock.Clock;
    const changed: Clock.Clock = { ...clock, sleep: () => Effect.never };
    const first = yield* hold(admission);
    yield* first.entered;
    yield* TestClock.adjust(Duration.millis(30));
    const queued = yield* admission
      .run("resolve", Effect.never)
      .pipe(Effect.provideService(Clock.Clock, changed), Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(20));
    expect(yield* Fiber.join(first.fiber).pipe(Effect.flip)).toMatchObject({ limit: "operationDeadline" });
    yield* TestClock.adjust(Duration.millis(30));
    expect(yield* Fiber.join(queued).pipe(Effect.flip)).toMatchObject({
      operation: "resolve",
      limit: "operationDeadline",
    });
    expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
  })
);

it.effect("retains the active permit until cancellation cleanup finishes", () =>
  Effect.gen(function* () {
    const admission = yield* makeCitationOperationAdmission((yield* defaultCitationEnginePolicy).limits);
    const cleaning = yield* Deferred.make<void>();
    const cleaned = yield* Deferred.make<void>();
    const first = yield* hold(
      admission,
      Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(cleaned)))
    );
    yield* first.entered;
    const interruption = yield* Fiber.interrupt(first.fiber).pipe(Effect.forkChild);
    yield* Deferred.await(cleaning);
    const next = yield* admission.run("resolve", Effect.succeed("after cleanup")).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    expect(yield* admission.snapshot).toEqual({ active: 1, queued: 1, closed: false });
    yield* Deferred.succeed(cleaned, undefined);
    yield* Fiber.join(interruption);
    expect(yield* Fiber.join(next)).toBe("after cleanup");
  })
);

it.effect("closes and drains active and queued calls, rejecting subsequent calls", () =>
  Effect.gen(function* () {
    const owner = yield* Scope.make();
    const admission = yield* makeCitationOperationAdmission((yield* defaultCitationEnginePolicy).limits).pipe(
      Effect.provideService(Scope.Scope, owner)
    );
    const first = yield* hold(admission);
    yield* first.entered;
    const queued = yield* admission.run("annotate", Effect.never).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* Scope.close(owner, Exit.void);
    expect(yield* Fiber.join(first.fiber).pipe(Effect.flip)).toMatchObject({ reason: "closed" });
    expect(yield* Fiber.join(queued).pipe(Effect.flip)).toMatchObject({ reason: "closed" });
    expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: true });
    expect(yield* Effect.flip(admission.run("clean", Effect.succeed("late")))).toMatchObject({ reason: "closed" });
  })
);

it.effect("captures two-operation policy and returns permits after a failed body", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const policy = { ...base, concurrentOperations: 2 };
    const admission = yield* makeCitationOperationAdmission(policy);
    policy.concurrentOperations = 1;
    const first = yield* hold(admission);
    const second = yield* hold(admission);
    yield* first.entered;
    yield* second.entered;
    expect(yield* admission.snapshot).toEqual({ active: 2, queued: 0, closed: false });
    yield* first.release;
    yield* Fiber.join(first.fiber);
    expect(yield* admission.run("extract", Effect.fail("captured body failure")).pipe(Effect.flip)).toBe(
      "captured body failure"
    );
    expect(yield* admission.snapshot).toEqual({ active: 1, queued: 0, closed: false });
    yield* second.release;
    yield* Fiber.join(second.fiber);
    expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
  })
);
