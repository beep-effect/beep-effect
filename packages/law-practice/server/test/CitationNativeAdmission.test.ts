import { makeCitationNativeProcessAdmission } from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as Scope from "effect/Scope";
import * as TxRef from "effect/TxRef";
import * as TestClock from "effect/testing/TestClock";
import type { CitationNativeProcessLease } from "@beep/law-practice-server/internal/Citation/NativeAdmission";

it.effect("bounds shared native ownership and returns cancelled queue capacity", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationNativeProcessAdmission({ ...base, queuedOperations: 1 });
    const first = yield* admission.acquire("clean");
    const waiting = yield* admission.acquire("extract").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    const citationResult1 = yield* admission.snapshot;
    expect(citationResult1).toEqual({ active: 1, regexActive: 0, queued: 1, quarantined: 0, closed: false });
    const citationResult2 = yield* admission.acquire("annotate").pipe(Effect.flip);
    expect(citationResult2).toMatchObject({
      operation: "annotate",
      limit: "queuedOperations",
    });
    yield* Fiber.interrupt(waiting);
    const citationResult3 = yield* Fiber.await(waiting);
    expect(Exit.hasInterrupts(citationResult3)).toBe(true);
    const citationResult4 = yield* admission.snapshot;
    expect(citationResult4).toMatchObject({ active: 1, queued: 0 });
    yield* first.release;
    yield* first.release;
    const citationResult5 = yield* admission.snapshot;
    expect(citationResult5).toMatchObject({ active: 0, queued: 0 });
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
    const citationResult6 = yield* Fiber.join(waiting).pipe(Effect.flip);
    expect(citationResult6).toMatchObject({ reason: "quarantined" });
    const citationResult7 = yield* admission.snapshot;
    expect(citationResult7).toEqual({ active: 2, regexActive: 0, queued: 0, quarantined: 2, closed: false });
    yield* first.release;
    const citationResult8 = yield* admission.acquire("clean").pipe(Effect.flip);
    expect(citationResult8).toMatchObject({ reason: "quarantined" });
    yield* second.release;
    yield* first.quarantine;
    const recovered = yield* admission.acquire("clean");
    const citationResult9 = yield* admission.snapshot;
    expect(citationResult9).toMatchObject({ active: 1, quarantined: 0 });
    const recoveredSecond = yield* admission.acquire("extract");
    const laterWaiting = yield* admission.acquire("clean").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* recovered.quarantine;
    const citationResult10 = yield* Fiber.join(laterWaiting).pipe(Effect.flip);
    expect(citationResult10).toMatchObject({ reason: "quarantined" });
    yield* recoveredSecond.release;
    yield* recovered.release;
    const citationResult11 = yield* admission.snapshot;
    expect(citationResult11).toMatchObject({ active: 0, quarantined: 0 });
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
    const citationResult12 = yield* Fiber.join(waiting).pipe(Effect.flip);
    expect(citationResult12).toMatchObject({
      operation: "extract",
      limit: "queueDeadline",
    });
    const citationResult13 = yield* admission.snapshot;
    expect(citationResult13).toMatchObject({ active: 1, queued: 0 });
    yield* first.release;
  })
);

it.effect("Scope closure cancels waiters and retains quarantine authority until later exit acknowledgement", () =>
  Effect.gen(function* () {
    const owner = yield* Scope.make();
    const citationResult14 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationNativeProcessAdmission(citationResult14.limits).pipe(
      Effect.provideService(Scope.Scope, owner)
    );
    const first = yield* admission.acquire("clean");
    const waiting = yield* admission.acquire("extract").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    yield* Scope.close(owner, Exit.void);
    const citationResult15 = yield* Fiber.join(waiting).pipe(Effect.flip);
    expect(citationResult15).toMatchObject({ reason: "closed" });
    yield* first.quarantine;
    const citationResult16 = yield* admission.snapshot;
    expect(citationResult16).toEqual({ active: 1, regexActive: 0, queued: 0, quarantined: 1, closed: true });
    yield* first.release;
    const citationResult17 = yield* admission.snapshot;
    expect(citationResult17).toEqual({ active: 0, regexActive: 0, queued: 0, quarantined: 0, closed: true });
    const citationResult18 = yield* admission.acquire("clean").pipe(Effect.flip);
    expect(citationResult18).toMatchObject({ reason: "closed" });
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
    const citationResult19 = yield* admission.snapshot;
    expect(citationResult19).not.toBe(observed);
    const waiting = yield* admission.acquireRegex("extract").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.zero);
    const html = yield* admission.acquire("clean");
    const citationResult20 = yield* admission.snapshot;
    expect(citationResult20).toEqual({ active: 2, regexActive: 1, queued: 1, quarantined: 0, closed: false });
    yield* first.release;
    const second = yield* Fiber.join(waiting);
    const citationResult21 = yield* admission.snapshot;
    expect(citationResult21).toMatchObject({ active: 2, regexActive: 1, queued: 0 });
    yield* second.quarantine;
    const citationResult22 = yield* admission.acquire("clean").pipe(Effect.flip);
    expect(citationResult22).toMatchObject({ reason: "quarantined" });
    const citationResult23 = yield* admission.acquireRegex("extract").pipe(Effect.flip);
    expect(citationResult23).toMatchObject({ reason: "quarantined" });
    yield* html.release;
    const citationResult24 = yield* admission.snapshot;
    expect(citationResult24).toMatchObject({ active: 1, regexActive: 1, quarantined: 1 });
    yield* second.release;
    const citationResult25 = yield* admission.snapshot;
    expect(citationResult25).toEqual({ active: 0, regexActive: 0, queued: 0, quarantined: 0, closed: false });
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
    const citationResult26 = yield* Fiber.join(waiting).pipe(Effect.flip);
    expect(citationResult26).toMatchObject({
      operation: "extract",
      limit: "queueDeadline",
    });
    const citationResult27 = yield* admission.snapshot;
    expect(citationResult27).toMatchObject({ active: 1, regexActive: 1, queued: 0 });
    yield* first.release;
  })
);

it.effect("serializes quarantine and retirement of the same exact lease", () =>
  Effect.gen(function* () {
    const citationResult28 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationNativeProcessAdmission(citationResult28.limits);
    for (let attempt = 0; attempt < 64; attempt++) {
      const lease = yield* admission.acquireRegex("extract");
      yield* Effect.all([lease.quarantine, lease.release, lease.quarantine, lease.release], { concurrency: 4 });
      const citationResult29 = yield* admission.snapshot;
      expect(citationResult29).toEqual({
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
    const citationResult30 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationNativeProcessAdmission(citationResult30.limits);
    for (const acquire of [admission.acquire, admission.acquireRegex])
      for (let attempt = 0; attempt < 32; attempt++) {
        const first = yield* acquire("extract");
        const waiting = yield* Effect.uninterruptibleMask((restore) =>
          acquire("extract").pipe(Effect.flatMap((lease) => restore(Effect.never).pipe(Effect.ensuring(lease.release))))
        ).pipe(Effect.forkChild);
        yield* TestClock.adjust(Duration.zero);
        yield* Effect.all([first.release, Fiber.interrupt(waiting)], { concurrency: 2 });
        const citationResult31 = yield* admission.snapshot;
        expect(citationResult31).toMatchObject({ active: 0, regexActive: 0, queued: 0, quarantined: 0 });
      }
  })
);

it.effect("closure wakes every blocked HTML and regex claimant without acknowledging active children", () =>
  Effect.gen(function* () {
    const owner = yield* Scope.make();
    const citationResult32 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationNativeProcessAdmission({
      ...citationResult32.limits,
      concurrentOperations: 2,
      concurrentRegexProcesses: 1,
      queuedOperations: 3,
    }).pipe(Effect.provideService(Scope.Scope, owner));
    const regex = yield* admission.acquireRegex("extract");
    const html = yield* admission.acquire("clean");
    const waiting = yield* Effect.all([
      admission.acquireRegex("extract").pipe(Effect.forkChild),
      admission.acquire("clean").pipe(Effect.forkChild),
      admission.acquireRegex("extract").pipe(Effect.forkChild),
    ]);
    yield* TestClock.adjust(Duration.zero);
    const citationResult33 = yield* admission.snapshot;
    expect(citationResult33).toMatchObject({ active: 2, regexActive: 1, queued: 3 });
    yield* Scope.close(owner, Exit.void);
    yield* Effect.forEach(
      waiting,
      Effect.fnUntraced(function* (fiber) {
        const citationResult34 = yield* Fiber.join(fiber).pipe(Effect.flip);
        expect(citationResult34).toMatchObject({ reason: "closed" });
      })
    );
    const citationResult35 = yield* admission.snapshot;
    expect(citationResult35).toEqual({ active: 2, regexActive: 1, queued: 0, quarantined: 0, closed: true });
    yield* Effect.all([regex.release, html.release], { concurrency: 2 });
    const citationResult36 = yield* admission.snapshot;
    expect(citationResult36).toEqual({ active: 0, regexActive: 0, queued: 0, quarantined: 0, closed: true });
  })
);

it.effect("queue entry and cancellation notifications do not renew an older claimant's deadline", () =>
  Effect.gen(function* () {
    const citationResult37 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationNativeProcessAdmission({
      ...citationResult37.limits,
      concurrentOperations: 1,
      queuedOperations: 2,
      queueDeadline: Duration.millis(20),
    });
    const owned = yield* admission.acquireRegex("extract");
    const older = yield* admission.acquireRegex("extract").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(5));
    const newer = yield* admission.acquire("clean").pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(5));
    const citationResult38 = yield* admission.snapshot;
    expect(citationResult38).toMatchObject({ active: 1, regexActive: 1, queued: 2 });
    yield* Fiber.interrupt(newer);
    yield* TestClock.adjust(Duration.millis(10));
    const citationResult39 = yield* Fiber.join(older).pipe(Effect.flip);
    expect(citationResult39).toMatchObject({ operation: "extract", limit: "queueDeadline" });
    const citationResult40 = yield* admission.snapshot;
    expect(citationResult40).toEqual({ active: 1, regexActive: 1, queued: 0, quarantined: 0, closed: false });
    yield* owned.release;
  })
);

it.effect("a returned native claim cannot be rolled back by its caller's transaction", () =>
  Effect.gen(function* () {
    const citationResult41 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationNativeProcessAdmission(citationResult41.limits);
    let issued = O.none<CitationNativeProcessLease>();
    const outcome = yield* admission.acquireRegex("extract").pipe(
      Effect.tap((lease) =>
        Effect.sync(() => {
          issued = O.some(lease);
        })
      ),
      Effect.andThen(Effect.fail("caller-rollback")),
      Effect.tx,
      Effect.flip
    );
    expect(outcome).toBe("caller-rollback");
    const citationResult42 = yield* admission.snapshot;
    expect(citationResult42).toMatchObject({ active: 1, regexActive: 1 });
    const lease = yield* Effect.fromOption(issued);
    yield* lease.release;
    const citationResult43 = yield* admission.snapshot;
    expect(citationResult43).toMatchObject({ active: 0, regexActive: 0 });
  })
);

it.effect("quarantine and exit acknowledgement survive caller transaction rollback", () =>
  Effect.gen(function* () {
    const citationResult44 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationNativeProcessAdmission(citationResult44.limits);
    const lease = yield* admission.acquireRegex("extract");
    const callerState = yield* TxRef.make(0);
    const citationResult45 = yield* TxRef.set(callerState, 1).pipe(
      Effect.andThen(lease.quarantine),
      Effect.andThen(Effect.fail("caller-rollback")),
      Effect.tx,
      Effect.flip
    );
    expect(citationResult45).toBe("caller-rollback");
    const citationResult46 = yield* admission.snapshot;
    expect(citationResult46).toMatchObject({ active: 1, regexActive: 1, quarantined: 1 });
    const citationResult47 = yield* TxRef.get(callerState);
    expect(citationResult47).toBe(0);
    const citationResult48 = yield* lease.release.pipe(
      Effect.andThen(Effect.fail("caller-rollback")),
      Effect.tx,
      Effect.flip
    );
    expect(citationResult48).toBe("caller-rollback");
    const citationResult49 = yield* admission.snapshot;
    expect(citationResult49).toEqual({ active: 0, regexActive: 0, queued: 0, quarantined: 0, closed: false });
  })
);

it.effect("owner Scope closure cannot be undone by a caller transaction rollback", () =>
  Effect.gen(function* () {
    const owner = yield* Scope.make();
    const citationResult50 = yield* defaultCitationEnginePolicy;
    const admission = yield* makeCitationNativeProcessAdmission(citationResult50.limits).pipe(
      Effect.provideService(Scope.Scope, owner)
    );
    const citationResult51 = yield* Scope.close(owner, Exit.void).pipe(
      Effect.andThen(Effect.fail("caller-rollback")),
      Effect.tx,
      Effect.flip
    );
    expect(citationResult51).toBe("caller-rollback");
    const citationResult52 = yield* admission.snapshot;
    expect(citationResult52).toMatchObject({ closed: true });
    const citationResult53 = yield* admission.acquire("clean").pipe(Effect.flip);
    expect(citationResult53).toMatchObject({ reason: "closed" });
  })
);
