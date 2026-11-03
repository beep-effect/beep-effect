import { makeCitationOperationAdmission } from "@beep/law-practice-server/internal/Citation/Admission";
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
import type { CitationOperationAdmission } from "@beep/law-practice-server/internal/Citation/Admission";

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
    const citationResult1 = yield* admission.snapshot;
    expect(citationResult1).toEqual({ active: 1, queued: 1, closed: false });
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
    const citationResult2 = yield* Fiber.join(second);
    expect(citationResult2).toBe("resolved");
    const citationResult3 = yield* admission.snapshot;
    expect(citationResult3).toEqual({ active: 0, queued: 0, closed: false });
  })
);

it.effect("returns cancelled queue capacity and preserves the active operation", () =>
  Effect.gen(function* () {
    const citationResult4 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationOperationAdmission(citationResult4.limits);
    const first = yield* hold(admission);
    yield* first.entered;
    const queued = yield* admission.run("resolve", Effect.never).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* Fiber.interrupt(queued);
    const citationResult5 = yield* Fiber.await(queued);
    expect(Exit.hasInterrupts(citationResult5)).toBe(true);
    const citationResult6 = yield* admission.snapshot;
    expect(citationResult6).toEqual({ active: 1, queued: 0, closed: false });
    yield* first.release;
    yield* Fiber.join(first.fiber);
    const citationResult7 = yield* admission.run("annotate", Effect.succeed("next"));
    expect(citationResult7).toBe("next");
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
    const citationResult8 = yield* Fiber.join(queued).pipe(Effect.flip);
    expect(citationResult8).toMatchObject({ operation: "extract", limit: "queueDeadline" });
    const citationResult9 = yield* admission.snapshot;
    expect(citationResult9).toEqual({ active: 1, queued: 0, closed: false });
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
    const citationResult10 = yield* Fiber.join(first.fiber).pipe(Effect.flip);
    expect(citationResult10).toMatchObject({ limit: "operationDeadline" });
    yield* TestClock.adjust(Duration.millis(30));
    const citationResult11 = yield* Fiber.join(queued).pipe(Effect.flip);
    expect(citationResult11).toMatchObject({
      operation: "resolve",
      limit: "operationDeadline",
    });
    const citationResult12 = yield* admission.snapshot;
    expect(citationResult12).toEqual({ active: 0, queued: 0, closed: false });
  })
);

it.effect("retains the active permit until cancellation cleanup finishes", () =>
  Effect.gen(function* () {
    const citationResult13 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationOperationAdmission(citationResult13.limits);
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
    const citationResult14 = yield* admission.snapshot;
    expect(citationResult14).toEqual({ active: 1, queued: 1, closed: false });
    yield* Deferred.succeed(cleaned, undefined);
    yield* Fiber.join(interruption);
    const citationResult15 = yield* Fiber.join(next);
    expect(citationResult15).toBe("after cleanup");
  })
);

it.effect("closes and drains active and queued calls, rejecting subsequent calls", () =>
  Effect.gen(function* () {
    const owner = yield* Scope.make();
    const citationResult16 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationOperationAdmission(citationResult16.limits).pipe(
      Effect.provideService(Scope.Scope, owner)
    );
    const first = yield* hold(admission);
    yield* first.entered;
    const queued = yield* admission.run("annotate", Effect.never).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* Scope.close(owner, Exit.void);
    const citationResult17 = yield* Fiber.join(first.fiber).pipe(Effect.flip);
    expect(citationResult17).toMatchObject({ reason: "closed" });
    const citationResult18 = yield* Fiber.join(queued).pipe(Effect.flip);
    expect(citationResult18).toMatchObject({ reason: "closed" });
    const citationResult19 = yield* admission.snapshot;
    expect(citationResult19).toEqual({ active: 0, queued: 0, closed: true });
    const citationResult20 = yield* Effect.flip(admission.run("clean", Effect.succeed("late")));
    expect(citationResult20).toMatchObject({ reason: "closed" });
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
    const citationResult21 = yield* admission.snapshot;
    expect(citationResult21).toEqual({ active: 2, queued: 0, closed: false });
    yield* first.release;
    yield* Fiber.join(first.fiber);
    const citationResult22 = yield* admission.run("extract", Effect.fail("captured body failure")).pipe(Effect.flip);
    expect(citationResult22).toBe("captured body failure");
    const citationResult23 = yield* admission.snapshot;
    expect(citationResult23).toEqual({ active: 1, queued: 0, closed: false });
    yield* second.release;
    yield* Fiber.join(second.fiber);
    const citationResult24 = yield* admission.snapshot;
    expect(citationResult24).toEqual({ active: 0, queued: 0, closed: false });
  })
);
