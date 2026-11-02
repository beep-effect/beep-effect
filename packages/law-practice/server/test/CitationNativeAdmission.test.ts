import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Scope from "effect/Scope";
import * as TestClock from "effect/testing/TestClock";
import { makeCitationNativeProcessAdmission } from "../src/internal/Citation/NativeAdmission.ts";

it.effect("bounds shared native ownership and returns cancelled queue capacity", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationNativeProcessAdmission({ ...base, queuedOperations: 1 });
    const first = yield* admission.acquire("clean");
    const waiting = yield* admission.acquire("extract").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    expect(yield* admission.snapshot).toEqual({ active: 1, regexActive: 0, queued: 1, quarantined: 0, closed: false });
    expect(yield* admission.acquire("annotate").pipe(Effect.flip)).toMatchObject({
      operation: "annotate",
      limit: "queuedOperations",
    });
    yield* Fiber.interrupt(waiting);
    expect(Exit.hasInterrupts(yield* Fiber.await(waiting))).toBe(true);
    expect(yield* admission.snapshot).toMatchObject({ active: 1, queued: 0 });
    yield* first.release;
    yield* first.release;
    expect(yield* admission.snapshot).toMatchObject({ active: 0, queued: 0 });
  })
);

it.effect("quarantine rejects queued and new workers until every isolated lease acknowledges exit", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationNativeProcessAdmission({ ...base, concurrentOperations: 2 });
    const first = yield* admission.acquire("clean");
    const second = yield* admission.acquire("extract");
    const waiting = yield* admission.acquire("clean").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* first.quarantine;
    yield* first.quarantine;
    yield* second.quarantine;
    expect(yield* Fiber.join(waiting).pipe(Effect.flip)).toMatchObject({ reason: "quarantined" });
    expect(yield* admission.snapshot).toEqual({ active: 2, regexActive: 0, queued: 0, quarantined: 2, closed: false });
    yield* first.release;
    expect(yield* admission.acquire("clean").pipe(Effect.flip)).toMatchObject({ reason: "quarantined" });
    yield* second.release;
    yield* first.quarantine;
    const recovered = yield* admission.acquire("clean");
    expect(yield* admission.snapshot).toMatchObject({ active: 1, quarantined: 0 });
    const recoveredSecond = yield* admission.acquire("extract");
    const laterWaiting = yield* admission.acquire("clean").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* recovered.quarantine;
    expect(yield* Fiber.join(laterWaiting).pipe(Effect.flip)).toMatchObject({ reason: "quarantined" });
    yield* recoveredSecond.release;
    yield* recovered.release;
    expect(yield* admission.snapshot).toMatchObject({ active: 0, quarantined: 0 });
  })
);

it.effect("captures queue policy and Clock without releasing an active native owner on timeout", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const policy = { ...base, queueDeadline: Duration.millis(20) };
    const admission = yield* makeCitationNativeProcessAdmission(policy);
    policy.queueDeadline = Duration.seconds(1);
    const first = yield* admission.acquire("clean");
    const clock = yield* Clock.Clock;
    const callerClock: Clock.Clock = { ...clock, sleep: () => Effect.never };
    const waiting = yield* admission
      .acquire("extract")
      .pipe(Effect.provideService(Clock.Clock, callerClock), Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(20));
    expect(yield* Fiber.join(waiting).pipe(Effect.flip)).toMatchObject({
      operation: "extract",
      limit: "queueDeadline",
    });
    expect(yield* admission.snapshot).toMatchObject({ active: 1, queued: 0 });
    yield* first.release;
  })
);

it.effect("Scope closure cancels waiters and retains quarantine authority until later exit acknowledgement", () =>
  Effect.gen(function* () {
    const owner = yield* Scope.make();
    const admission = yield* makeCitationNativeProcessAdmission((yield* defaultCitationEnginePolicy).limits).pipe(
      Effect.provideService(Scope.Scope, owner)
    );
    const first = yield* admission.acquire("clean");
    const waiting = yield* admission.acquire("extract").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* Scope.close(owner, Exit.void);
    expect(yield* Fiber.join(waiting).pipe(Effect.flip)).toMatchObject({ reason: "closed" });
    yield* first.quarantine;
    expect(yield* admission.snapshot).toEqual({ active: 1, regexActive: 0, queued: 0, quarantined: 1, closed: true });
    yield* first.release;
    expect(yield* admission.snapshot).toEqual({ active: 0, regexActive: 0, queued: 0, quarantined: 0, closed: true });
    expect(yield* admission.acquire("clean").pipe(Effect.flip)).toMatchObject({ reason: "closed" });
  })
);

it.effect("enforces both regex and total capacity without reserving unused total slots for queued regex work", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationNativeProcessAdmission({
      ...base,
      concurrentOperations: 2,
      concurrentRegexProcesses: 1,
    });
    const first = yield* admission.acquireRegex("extract");
    const observed = yield* admission.snapshot;
    expect(yield* admission.snapshot).not.toBe(observed);
    const waiting = yield* admission.acquireRegex("extract").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    const html = yield* admission.acquire("clean");
    expect(yield* admission.snapshot).toEqual({ active: 2, regexActive: 1, queued: 1, quarantined: 0, closed: false });
    yield* first.release;
    const second = yield* Fiber.join(waiting);
    expect(yield* admission.snapshot).toMatchObject({ active: 2, regexActive: 1, queued: 0 });
    yield* second.quarantine;
    expect(yield* admission.acquire("clean").pipe(Effect.flip)).toMatchObject({ reason: "quarantined" });
    expect(yield* admission.acquireRegex("extract").pipe(Effect.flip)).toMatchObject({ reason: "quarantined" });
    yield* html.release;
    expect(yield* admission.snapshot).toMatchObject({ active: 1, regexActive: 1, quarantined: 1 });
    yield* second.release;
    expect(yield* admission.snapshot).toEqual({ active: 0, regexActive: 0, queued: 0, quarantined: 0, closed: false });
  })
);

it.effect("keeps one regex queue deadline across unrelated capacity notifications", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationNativeProcessAdmission({
      ...base,
      concurrentOperations: 2,
      concurrentRegexProcesses: 1,
      queueDeadline: Duration.millis(20),
    });
    const first = yield* admission.acquireRegex("extract");
    const html = yield* admission.acquire("clean");
    const waiting = yield* admission.acquireRegex("extract").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(10));
    yield* html.release;
    yield* TestClock.adjust(Duration.millis(10));
    expect(yield* Fiber.join(waiting).pipe(Effect.flip)).toMatchObject({
      operation: "extract",
      limit: "queueDeadline",
    });
    expect(yield* admission.snapshot).toMatchObject({ active: 1, regexActive: 1, queued: 0 });
    yield* first.release;
  })
);

it.effect("serializes quarantine and retirement of the same exact lease", () =>
  Effect.gen(function* () {
    const admission = yield* makeCitationNativeProcessAdmission((yield* defaultCitationEnginePolicy).limits);
    for (let attempt = 0; attempt < 64; attempt++) {
      const lease = yield* admission.acquireRegex("extract");
      yield* Effect.all([lease.quarantine, lease.release, lease.quarantine, lease.release], { concurrency: 4 });
      expect(yield* admission.snapshot).toEqual({
        active: 0,
        regexActive: 0,
        queued: 0,
        quarantined: 0,
        closed: false,
      });
    }
  })
);

it.effect("does not lose either kind of permit when queue handoff races cancellation", () =>
  Effect.gen(function* () {
    const admission = yield* makeCitationNativeProcessAdmission((yield* defaultCitationEnginePolicy).limits);
    for (const acquire of [admission.acquire, admission.acquireRegex])
      for (let attempt = 0; attempt < 32; attempt++) {
        const first = yield* acquire("extract");
        const waiting = yield* Effect.uninterruptibleMask((restore) =>
          acquire("extract").pipe(Effect.flatMap((lease) => restore(Effect.never).pipe(Effect.ensuring(lease.release))))
        ).pipe(Effect.forkChild);
        yield* TestClock.adjust(Duration.zero);
        yield* Effect.all([first.release, Fiber.interrupt(waiting)], { concurrency: 2 });
        expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, queued: 0, quarantined: 0 });
      }
  })
);
