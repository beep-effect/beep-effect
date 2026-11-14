import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import {
  makeCitationNativeLane,
  makeCitationStandaloneNativeStarter,
} from "@beep/law-practice-server/internal/Citation/NativeLane";
import {
  CitationNativeProcessRuntime,
  citationNativeProcessCommand,
} from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import {
  citationNativeNodeTestPlatform,
  makeCitationNativeManualClock,
  makeCitationNativeWorkerFixture,
  makeCitationObservedSpawner,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("native lane refusal boundaries", (it) => {
  it.effect("refuses nested withUse in a callback and its child fiber without taking the lock", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(CitationNativeProcessAdmission, admission)
      );
      yield* lane.withUse(() =>
        Effect.gen(function* () {
          const same = yield* lane.withUse(() => Effect.void).pipe(Effect.flip);
          expect(same).toMatchObject({ reason: "invalid-runtime" });
          const child = yield* lane.withUse(() => Effect.void).pipe(Effect.flip, Effect.forkChild);
          const result1 = yield* Fiber.join(child);
          expect(result1).toMatchObject({ reason: "invalid-runtime" });
        })
      );
      yield* lane.withUse(() => Effect.void);
      const result2 = yield* lane.snapshot;
      expect(result2).toMatchObject({ started: 0, unitsAcquired: 0 });
    })
  );
  for (const interrupt of [false, true]) {
    it.effect(
      `quarantines an unresolved admission on drain ${interrupt ? "interruption" : "deadline"} and closes Scope`,
      () =>
        Effect.gen(function* () {
          const base = (yield* defaultCitationEnginePolicy).limits;
          const limits = { ...base, queueDeadline: Duration.millis(100) };
          const timer = yield* makeCitationNativeManualClock(limits.queueDeadline);
          const admission = yield* makeCitationNativeProcessAdmission(limits);
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
          const observed = yield* makeCitationObservedSpawner();
          const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
            Effect.provideService(Clock.Clock, timer.clock),
            Effect.provideService(Scope.Scope, scope),
            Effect.provideService(ChildProcessSpawner, observed.spawner),
            Effect.provideService(CitationNativeProcessAdmission, {
              ...admission,
              acquire: (operation) =>
                Deferred.succeed(entered, undefined).pipe(
                  Effect.andThen(Deferred.await(release)),
                  Effect.andThen(admission.acquire(operation))
                ),
            })
          );
          const pending = yield* lane
            .withUse((_start, reserve) =>
              Effect.gen(function* () {
                yield* reserve.pipe(Effect.exit, Effect.forkChild);
                yield* Deferred.await(entered);
              })
            )
            .pipe(Effect.flip, Effect.forkChild);
          yield* waitForCitationNativeTest(timer.sleeps.pipe(Effect.map((count) => count === 1)));
          if (interrupt) {
            const interrupting = yield* Fiber.interrupt(pending).pipe(Effect.forkChild);
            yield* Effect.yieldNow;
            yield* timer.triggerSleep(0);
            yield* Fiber.join(interrupting);
          } else {
            yield* timer.triggerSleep(0);
            const result = yield* Fiber.join(pending);
            expect(result).toMatchObject({ reason: "cleanup-unconfirmed" });
          }
          const refused = yield* lane.withUse(() => Effect.void).pipe(Effect.flip);
          expect(refused).toMatchObject({ reason: "quarantined" });
          const result3 = yield* lane.ensureOpen.pipe(Effect.flip);
          expect(result3).toMatchObject({ reason: "quarantined" });
          yield* Scope.close(scope, Exit.void);
          const fixture = yield* makeCitationNativeWorkerFixture("busy");
          const denied = yield* lane
            .start("regex", citationNativeProcessCommand(CitationNativeProcessRuntime.make(fixture), ""))
            .pipe(Effect.flip);
          expect(denied).toMatchObject({ reason: "closed" });
          yield* Deferred.succeed(release, undefined);
          yield* waitForCitationNativeTest(admission.snapshot.pipe(Effect.map((state) => state.active === 0)));
          const result4 = yield* observed.snapshot;
          expect(result4).toEqual({ spawned: 0, confirmed: 0 });
        })
    );
  }
});

it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("late lane spawn ownership", (it) => {
  for (const kind of ["bun", "node"] as const) {
    for (const uncertain of [false, true]) {
      it.effect(
        `retires a ${kind} spawn resolving after its drain bound${uncertain ? " with an unconfirmed first retirement" : ""} and returns capacity once`,
        () =>
          Effect.gen(function* () {
            const base = (yield* defaultCitationEnginePolicy).limits;
            const limits = { ...base, queueDeadline: Duration.millis(100), cleanupDeadline: Duration.millis(50) };
            const timer = yield* makeCitationNativeManualClock(Duration.millis(200));
            const admission = yield* makeCitationNativeProcessAdmission(limits);
            const observed = yield* makeCitationObservedSpawner();
            const entered = yield* Deferred.make<void>();
            const release = yield* Deferred.make<void>();
            let returns = 0;
            let observations = 0;
            const spawner = ChildProcessSpawner.of({
              ...observed.spawner,
              spawn: Effect.fn("LateLaneTest.spawn")(function* (command) {
                const child = yield* observed.spawner.spawn(command);
                yield* Deferred.succeed(entered, undefined);
                yield* Deferred.await(release);
                return {
                  ...child,
                  isRunning: Effect.suspend(() =>
                    uncertain && observations++ < 2 ? Effect.succeed(true) : child.isRunning
                  ),
                };
              }),
            });
            const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
            const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
              Effect.provideService(Clock.Clock, timer.clock),
              Effect.provideService(Scope.Scope, scope),
              Effect.provideService(ChildProcessSpawner, spawner),
              Effect.provideService(CitationNativeProcessAdmission, {
                ...admission,
                acquire: Effect.fnUntraced(function* (operation) {
                  const lease = yield* admission.acquire(operation);
                  return {
                    ...lease,
                    release: Effect.sync(() => {
                      returns++;
                    }).pipe(Effect.andThen(lease.release)),
                  };
                }),
              })
            );
            const fixture = yield* makeCitationNativeWorkerFixture("busy", "html", kind);
            const command = citationNativeProcessCommand(CitationNativeProcessRuntime.make(fixture), "");
            const pending = yield* lane
              .withUse((start) =>
                Effect.gen(function* () {
                  yield* start("regex", command).pipe(Effect.exit, Effect.forkChild);
                  yield* Deferred.await(entered);
                })
              )
              .pipe(Effect.flip, Effect.forkChild);
            yield* waitForCitationNativeTest(timer.sleeps.pipe(Effect.map((count) => count === 1)));
            yield* timer.triggerSleep(0);
            const result5 = yield* Fiber.join(pending);
            expect(result5).toMatchObject({ reason: "cleanup-unconfirmed" });
            const result6 = yield* admission.snapshot;
            expect(result6).toMatchObject({ active: 1, quarantined: 1 });
            const result7 = yield* lane.withUse(() => Effect.void).pipe(Effect.flip);
            expect(result7).toMatchObject({ reason: "quarantined" });
            const retirement = yield* lane.retire.pipe(Effect.flip);
            expect(retirement).toMatchObject({ reason: "cleanup-unconfirmed" });
            expect(returns).toBe(0);
            yield* Scope.close(scope, Exit.void);
            yield* Deferred.succeed(release, undefined);
            yield* waitForCitationNativeTest(observed.snapshot.pipe(Effect.map((state) => state.confirmed === 1)));
            yield* waitForCitationNativeTest(admission.snapshot.pipe(Effect.map((state) => state.active === 0)));
            const result8 = yield* observed.snapshot;
            expect(result8).toEqual({ spawned: 1, confirmed: 1 });
            const result9 = yield* lane.snapshot;
            expect(result9).toMatchObject({ started: 1, confirmed: 1, acquired: false });
            expect(returns).toBe(1);
            const result10 = yield* lane.start("diff", command).pipe(Effect.flip);
            expect(result10).toMatchObject({ reason: "closed" });
            yield* Scope.close(scope, Exit.void);
            expect(returns).toBe(1);
          })
      );
    }
  }
});

it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("revocable lane capabilities", (it) => {
  it.effect("revokes a returned unlocked start and a forked late user before releasing the lane", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(CitationNativeProcessAdmission, admission),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const fixture = yield* makeCitationNativeWorkerFixture("busy");
      const command = citationNativeProcessCommand(CitationNativeProcessRuntime.make(fixture), "");
      const escaped = yield* lane.withUse((start) => Effect.succeed(start));
      const failed = yield* escaped("regex", command).pipe(Effect.flip);
      expect(failed).toMatchObject({ _tag: "CitationNativeLaneFailure", reason: "closed" });
      const release = yield* Deferred.make<void>();
      const late = yield* lane.withUse((start) =>
        Deferred.await(release).pipe(Effect.andThen(start("regex", command)), Effect.flip, Effect.forkChild)
      );
      yield* Deferred.succeed(release, undefined);
      const refused = yield* Fiber.join(late);
      expect(refused).toMatchObject({ _tag: "CitationNativeLaneFailure", reason: "closed" });
      const reserve = yield* lane.withUse((_start, reserve) => Effect.succeed(reserve));
      const refusedReserve = yield* reserve.pipe(Effect.flip);
      expect(refusedReserve).toMatchObject({ reason: "closed" });
      const retire = yield* lane.withUse((_start, _reserve, release) => Effect.succeed(release));
      const refusedRelease = yield* retire.pipe(Effect.flip);
      expect(refusedRelease).toMatchObject({ reason: "closed" });
      const capacity = yield* admission.snapshot;
      expect(capacity).toMatchObject({ active: 0, queued: 0, quarantined: 0 });
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
      const receipt = yield* lane.snapshot;
      expect(receipt).toMatchObject({ acquired: false, unitsAcquired: 0, started: 0, confirmed: 0 });
    })
  );
  it.effect("revokes capabilities even when the callback throws before returning an Effect", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(CitationNativeProcessAdmission, admission),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const services = yield* Effect.context<never>();
      let leaked = O.none<typeof lane.start>();
      const outcome = yield* lane
        .withUse((start): Effect.Effect<void> => {
          leaked = O.some(start);
          return Effect.runSyncWith(services)(Effect.die("synchronous callback defect"));
        })
        .pipe(Effect.exit);
      expect(Exit.hasDies(outcome)).toBe(true);
      const start = yield* Effect.fromOption(leaked);
      const fixture = yield* makeCitationNativeWorkerFixture("busy");
      const refused = yield* start(
        "regex",
        citationNativeProcessCommand(CitationNativeProcessRuntime.make(fixture), "")
      ).pipe(Effect.flip);
      expect(refused).toMatchObject({ reason: "closed" });
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
      const receipt = yield* lane.snapshot;
      expect(receipt).toMatchObject({ unitsAcquired: 0, acquired: false });
    })
  );
  for (const kind of ["bun", "node"] as const) {
    it.effect(`holds handover until a concurrently admitted ${kind} operation finishes`, () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        const observed = yield* makeCitationObservedSpawner();
        const entered = yield* Deferred.make<void>();
        const proceed = yield* Deferred.make<void>();
        const callbackDone = yield* Deferred.make<void>();
        let interleaved = false;
        let attempts = 0;
        const spawner = ChildProcessSpawner.of({
          ...observed.spawner,
          spawn: Effect.fn("LaneLifetimeTest.spawn")(function* (command) {
            attempts++;
            if (attempts === 1) {
              yield* Deferred.succeed(entered, undefined);
              yield* Deferred.await(proceed);
            }
            return yield* observed.spawner.spawn(command);
          }),
        });
        const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
        const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
          Effect.provideService(Scope.Scope, scope),
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, spawner)
        );
        const fixture = yield* makeCitationNativeWorkerFixture("busy", "html", kind);
        const command = citationNativeProcessCommand(CitationNativeProcessRuntime.make(fixture), "");
        const using = yield* lane
          .withUse((start) =>
            Effect.gen(function* () {
              yield* start("regex", command).pipe(Effect.forkChild);
              yield* Deferred.await(entered);
              yield* Deferred.succeed(callbackDone, undefined);
            })
          )
          .pipe(Effect.forkChild);
        yield* Deferred.await(callbackDone);
        const evaluation = yield* lane
          .withUse(() =>
            Effect.sync(() => {
              interleaved = true;
            })
          )
          .pipe(Effect.forkChild);
        const another = yield* lane.start("diff", command).pipe(Effect.forkChild);
        yield* Effect.yieldNow;
        const before = attempts;
        const early = interleaved;
        const pending = using.pollUnsafe();
        yield* Deferred.succeed(proceed, undefined);
        expect(before).toBe(1);
        expect(early).toBe(false);
        expect(pending).toBeUndefined();
        yield* Fiber.join(using);
        yield* Fiber.join(evaluation);
        yield* Fiber.join(another);
        expect(interleaved).toBe(true);
        expect(attempts).toBe(2);
        yield* Scope.close(scope, Exit.void);
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 2, confirmed: 2 });
      })
    );
  }
  it.effect("retains quarantine after Scope retirement cannot confirm a real child, then settles on retry", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      let uncertain = true;
      const spawner = ChildProcessSpawner.of({
        ...observed.spawner,
        spawn: Effect.fn("NativeLaneCoverage.uncertainScopeSpawn")((command) =>
          observed.spawner.spawn(command).pipe(
            Effect.map((child) => ({
              ...child,
              isRunning: Effect.suspend(() => (uncertain ? Effect.succeed(true) : child.isRunning)),
            }))
          )
        ),
      });
      const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.provideService(CitationNativeProcessAdmission, admission),
        Effect.provideService(ChildProcessSpawner, spawner)
      );
      const fixture = yield* makeCitationNativeWorkerFixture("busy");
      const record = yield* lane.start(
        "markup",
        citationNativeProcessCommand(CitationNativeProcessRuntime.make(fixture), "")
      );
      yield* record.child;
      yield* Effect.gen(function* () {
        yield* Scope.close(scope, Exit.void);
        const held = yield* admission.snapshot;
        expect(held).toMatchObject({ active: 1, quarantined: 1 });
        uncertain = false;
        yield* record.process.retire(true);
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
        const receipt = yield* lane.snapshot;
        expect(receipt).toMatchObject({ started: 1, confirmed: 1, acquired: false });
        const settled = yield* admission.snapshot;
        expect(settled).toMatchObject({ active: 0, quarantined: 0 });
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            uncertain = false;
          })
        )
      );
    })
  );
  it.effect("refuses every lane entry after its Scope closes without acquiring or spawning", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const scope = yield* Scope.make();
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(CitationNativeProcessAdmission, admission),
        Effect.provideService(ChildProcessSpawner, observed.spawner),
        Effect.provideService(Scope.Scope, scope)
      );
      yield* Scope.close(scope, Exit.void);
      for (const entry of [
        lane.ensureOpen,
        lane.reserve,
        lane.start("regex", ChildProcess.make("unused")),
        lane.yieldTo(Effect.die("closed cleaner ran")),
      ]) {
        const failure = yield* entry.pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationNativeLaneFailure", reason: "closed" });
      }
      const receipt = yield* lane.snapshot;
      expect(receipt).toMatchObject({ started: 0, confirmed: 0, unitsAcquired: 0, yieldDepth: 0 });
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
      const state = yield* admission.snapshot;
      expect(state.active).toBe(0);
    })
  );
  it.effect("settles a failed OS spawn and immediately notifies a late retirement subscriber once", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const f = yield* makeCitationNativeWorkerFixture("busy");
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(CitationNativeProcessAdmission, admission),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const record = yield* lane.start("regex", ChildProcess.make(`${f.cwd}/missing-executable`));
      expect(record.child).toMatchObject({ _tag: "Failure" });
      const refused = yield* record.child.pipe(Effect.flip);
      expect(refused).toMatchObject({ reason: "spawn-failed" });
      yield* record.process.retire(false);
      let notifications = 0;
      yield* record.onRetired(
        Effect.sync(() => {
          notifications++;
        })
      );
      yield* record.process.retire(true);
      expect(notifications).toBe(1);
      const receipt = yield* lane.snapshot;
      expect(receipt).toMatchObject({ started: 0, confirmed: 0, acquired: true });
      yield* lane.yieldTo(Effect.void);
      const state = yield* admission.snapshot;
      expect(state.active).toBe(0);
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("returns the unit if admission closes immediately after a successful claim", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const scope = yield* Scope.make();
      const admission = yield* makeCitationNativeProcessAdmission(limits).pipe(
        Effect.provideService(Scope.Scope, scope)
      );
      const observed = yield* makeCitationObservedSpawner();
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(CitationNativeProcessAdmission, {
          ...admission,
          acquire: (operation) => admission.acquire(operation).pipe(Effect.tap(() => Scope.close(scope, Exit.void))),
        }),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const refused = yield* lane.reserve.pipe(Effect.flip);
      expect(refused).toMatchObject({ reason: "closed" });
      const receipt = yield* lane.snapshot;
      expect(receipt).toMatchObject({ unitsAcquired: 1, acquired: false, started: 0 });
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, closed: true });
    })
  );
  it.effect("releases a standalone claim when its physical owner closes before spawn", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const scope = yield* Scope.make();
      const standalone = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.provideService(CitationNativeProcessAdmission, {
          ...admission,
          acquire: (operation) => admission.acquire(operation).pipe(Effect.tap(() => Scope.close(scope, Exit.void))),
        }),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const refused = yield* standalone.start("markup", ChildProcess.make("unused")).pipe(Effect.flip);
      expect(refused).toMatchObject({ reason: "closed" });
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, quarantined: 0 });
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  for (const kind of ["bun", "node"] as const) {
    it.effect(`refuses a quarantined ${kind} physical owner until a retry confirms the exact child`, () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const f = yield* makeCitationNativeWorkerFixture("busy", "html", kind);
        const observed = yield* makeCitationObservedSpawner();
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        let unconfirmed = true;
        const standalone = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, {
            ...observed.spawner,
            spawn: (command) =>
              observed.spawner.spawn(command).pipe(
                Effect.map((child) => ({
                  ...child,
                  isRunning: Effect.suspend(() => (unconfirmed ? Effect.succeed(true) : child.isRunning)),
                }))
              ),
          })
        );
        yield* Effect.gen(function* () {
          const command = citationNativeProcessCommand(CitationNativeProcessRuntime.make(f), "");
          const record = yield* standalone.start("markup", command);
          yield* record.child;
          const failed = yield* record.process.retire(false).pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "cleanup-unconfirmed" });
          const refused = yield* standalone.start("markup", command).pipe(Effect.flip);
          expect(refused).toMatchObject({ reason: "quarantined" });
          const retained = yield* admission.snapshot;
          expect(retained).toMatchObject({ active: 1, quarantined: 1 });
          unconfirmed = false;
          yield* standalone.reap();
          const counts = yield* observed.snapshot;
          expect(counts).toEqual({ spawned: 1, confirmed: 1 });
          const state = yield* admission.snapshot;
          expect(state).toMatchObject({ active: 0, quarantined: 0 });
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              unconfirmed = false;
            })
          )
        );
      })
    );
  }
  it.effect("does not double-count confirmation or release an absent permit when a retirement listener defects", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const f = yield* makeCitationNativeWorkerFixture("busy");
      const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.provideService(CitationNativeProcessAdmission, admission),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const record = yield* lane.start("regex", citationNativeProcessCommand(CitationNativeProcessRuntime.make(f), ""));
      yield* record.child;
      let notifications = 0;
      yield* record.onRetired(
        Effect.sync(() => {
          notifications++;
        }).pipe(Effect.andThen(Effect.die("test retirement listener defect")))
      );
      let entered = false;
      const refused = yield* lane
        .yieldTo(
          Effect.sync(() => {
            entered = true;
          })
        )
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationNativeLaneFailure", reason: "cleanup-unconfirmed" });
      expect(entered).toBe(false);
      const before = yield* lane.snapshot;
      expect(before).toMatchObject({ started: 1, confirmed: 1, acquired: false });
      yield* record.process.retire(true);
      expect(notifications).toBe(1);
      const after = yield* lane.snapshot;
      expect(after).toMatchObject({ started: 1, confirmed: 1, acquired: false });
      yield* Scope.close(scope, Exit.void);
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, quarantined: 0 });
    })
  );
  it.effect("preserves interruption when returning an unspawned claim encounters a release defect", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const f = yield* makeCitationNativeWorkerFixture("busy");
      const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
      const acquired = yield* Deferred.make<void>();
      const proceed = yield* Deferred.make<void>();
      let claims = 0;
      let returns = 0;
      const controlled = CitationNativeProcessAdmission.of({
        ...admission,
        acquire: Effect.fn("LaneCoverageTest.acquire")(function* (operation) {
          const lease = yield* admission.acquire(operation);
          claims++;
          if (claims !== 2) return lease;
          yield* Deferred.succeed(acquired, undefined);
          yield* Deferred.await(proceed);
          return {
            ...lease,
            release: lease.release.pipe(
              Effect.andThen(
                Effect.suspend(() => {
                  returns++;
                  return returns === 1 ? Effect.die("test lease return defect") : Effect.void;
                })
              )
            ),
          };
        }),
      });
      const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.provideService(CitationNativeProcessAdmission, controlled),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const command = citationNativeProcessCommand(CitationNativeProcessRuntime.make(f), "");
      const first = yield* lane.start("regex", command);
      yield* first.child;
      yield* lane.yieldTo(Effect.void);
      const pending = yield* lane.start("regex", command).pipe(Effect.forkChild);
      yield* Deferred.await(acquired);
      yield* Effect.sync(() => pending.interruptUnsafe());
      yield* Deferred.succeed(proceed, undefined);
      const outcome = yield* Fiber.await(pending);
      expect(Exit.hasInterrupts(outcome)).toBe(true);
      expect(Exit.hasDies(outcome)).toBe(false);
      expect(returns).toBe(1);
      yield* Scope.close(scope, Exit.void);
      expect(returns).toBe(2);
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      const receipt = yield* lane.snapshot;
      expect(receipt).toMatchObject({ started: 1, confirmed: 1, unitsAcquired: 2, acquired: false });
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, quarantined: 0 });
    })
  );
});
