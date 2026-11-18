import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import {
  CitationNativeLaneFailure,
  makeCitationNativeLane,
} from "@beep/law-practice-server/internal/Citation/NativeLane";
import {
  CitationNativeProcessRuntime,
  citationNativeProcessCommand,
  makeCitationNativeProcessOwner,
} from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scheduler from "effect/Scheduler";
import * as Scope from "effect/Scope";
import * as Tracer from "effect/Tracer";
import {
  citationNativeNodeTestPlatform,
  makeCitationNativeAcknowledgementSpawner,
  makeCitationNativeManualClock,
  makeCitationNativeWorkerFixture,
  makeCitationObservedSpawner,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const makeOwnerPause = Effect.fn("LaneFenceTest.scheduler")(function* (
  stage: string,
  pauseAt: number,
  entered: Deferred.Deferred<void>
) {
  const scheduler = yield* Scheduler.Scheduler;
  let armed = false;
  let steps = 0;
  let parkNext = false;
  let resume = O.none<() => void>();
  const controlled: Scheduler.Scheduler = {
    executionMode: scheduler.executionMode,
    shouldYield: (fiber) => {
      if (armed && ++steps === pauseAt) {
        parkNext = true;
        return true;
      }
      return scheduler.shouldYield(fiber);
    },
    makeDispatcher: () => {
      const dispatcher = scheduler.makeDispatcher();
      return {
        flush: () => dispatcher.flush(),
        scheduleTask: (task, priority) => {
          if (parkNext) {
            parkNext = false;
            resume = O.some(() => dispatcher.scheduleTask(task, priority));
            Deferred.doneUnsafe(entered, Effect.void);
          } else dispatcher.scheduleTask(task, priority);
        },
      };
    },
  };
  const tracer = Tracer.make({
    span: (options) => {
      if (stage === "owner" && options.name === "Citation.startOwnedNativeProcess") armed = true;
      return new Tracer.NativeSpan(options);
    },
  });
  return { controlled, tracer, resume: Effect.sync(() => O.map(resume, (run) => run())), steps: () => steps };
});

const ownerFencePoints = Effect.fn("LaneFenceTest.ownerFencePoints")(function* (kind: CitationNativeRuntimeKind) {
  const { limits } = yield* defaultCitationEnginePolicy;
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const entered = yield* Deferred.make<void>();
  const controller = yield* makeOwnerPause("owner", 0, entered);
  const owner = yield* makeCitationNativeProcessOwner(limits, "extract", (reason) =>
    CitationNativeLaneFailure.make({ reason })
  ).pipe(Effect.provideService(ChildProcessSpawner, observed.spawner));
  const fixture = yield* makeCitationNativeWorkerFixture("busy", "html", kind);
  const command = citationNativeProcessCommand(CitationNativeProcessRuntime.make(fixture), "");
  const lease = yield* admission.acquire("extract");
  let points = 0;
  const record = yield* owner
    .start(command, lease, () => {
      points = controller.steps();
      return O.some(CitationNativeLaneFailure.make({ reason: "closed" }));
    })
    .pipe(Effect.provideService(Scheduler.Scheduler, controller.controlled), Effect.withTracer(controller.tracer));
  yield* record.process.retire(false);
  const physical = yield* observed.snapshot;
  expect(physical).toEqual({ spawned: 0, confirmed: 0 });
  expect(points).toBeGreaterThan(0);
  return points;
});

const exerciseFence = Effect.fn("LaneFenceTest.exercise")(function* (
  kind: CitationNativeRuntimeKind,
  stage: string,
  pauseAt: number,
  expire: boolean
) {
  const base = (yield* defaultCitationEnginePolicy).limits;
  const limits = { ...base, queueDeadline: Duration.millis(100), cleanupDeadline: Duration.millis(50) };
  const timer = yield* makeCitationNativeManualClock(Duration.millis(200));
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const entered = yield* Deferred.make<void>();
  const release = yield* Deferred.make<void>();
  const controller = yield* makeOwnerPause(stage, pauseAt, entered);
  let returns = 0;
  let handoff = O.none<number>();
  const spawner = ChildProcessSpawner.of({
    ...observed.spawner,
    spawn: Effect.fn("LaneFenceTest.spawn")((command) => {
      handoff = O.some(controller.steps());
      return observed.spawner.spawn(command);
    }),
  });
  const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
  const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
    Effect.provideService(Clock.Clock, timer.clock),
    Effect.provideService(Scope.Scope, scope),
    Effect.provideService(ChildProcessSpawner, spawner),
    Effect.provideService(CitationNativeProcessAdmission, {
      ...admission,
      snapshot: Effect.gen(function* () {
        const state = yield* admission.snapshot;
        if (stage === "snapshot") {
          yield* Deferred.succeed(entered, undefined);
          yield* Deferred.await(release);
        }
        return state;
      }),
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
  const running = lane.withUse((start) =>
    Effect.gen(function* () {
      yield* start("regex", command).pipe(
        Effect.provideService(Scheduler.Scheduler, controller.controlled),
        Effect.withTracer(controller.tracer),
        Effect.exit,
        Effect.forkChild
      );
      yield* Deferred.await(entered);
    })
  );
  const waiting = expire
    ? running.pipe(
        Effect.flip,
        Effect.tap((failure) =>
          Effect.sync(() => {
            expect(failure).toMatchObject({ reason: "cleanup-unconfirmed" });
          })
        ),
        Effect.asVoid
      )
    : running;
  const pending = yield* waiting.pipe(Effect.forkChild);
  yield* waitForCitationNativeTest(timer.sleeps.pipe(Effect.map((count) => count === 1)));
  if (expire) {
    yield* timer.triggerSleep(0);
    yield* Fiber.join(pending);
  }
  const before = yield* observed.snapshot;
  expect(before).toEqual({ spawned: 0, confirmed: 0 });
  yield* Deferred.succeed(release, undefined);
  yield* controller.resume;
  yield* waitForCitationNativeTest(admission.snapshot.pipe(Effect.map((state) => state.active === 0)));
  if (!expire) yield* Fiber.join(pending);
  const after = yield* observed.snapshot;
  expect(handoff).toEqual(O.none());
  expect(after).toEqual({ spawned: 0, confirmed: 0 });
  expect(returns).toBe(1);
  if (expire) {
    const next = yield* lane.start("regex", command).pipe(Effect.flip);
    expect(next).toMatchObject({ reason: "quarantined" });
    const again = yield* lane.withUse(() => Effect.void).pipe(Effect.flip);
    expect(again).toMatchObject({ reason: "quarantined" });
  }
  yield* Scope.close(scope, Exit.void);
  expect(returns).toBe(1);
  return after;
});

const exerciseLazyHandoff = Effect.fn("LaneFenceTest.lazyHandoff")(function* (kind: CitationNativeRuntimeKind) {
  const base = (yield* defaultCitationEnginePolicy).limits;
  const limits = { ...base, queueDeadline: Duration.millis(100), cleanupDeadline: Duration.seconds(5) };
  const bound = Duration.sum(limits.queueDeadline, Duration.times(limits.cleanupDeadline, 2));
  const timer = yield* makeCitationNativeManualClock(bound);
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const fs = yield* FileSystem.FileSystem;
  const entered = yield* Deferred.make<void>();
  const resume = yield* Deferred.make<void>();
  const killed = yield* Deferred.make<void>();
  const confirm = yield* Deferred.make<void>();
  const observed = yield* makeCitationNativeAcknowledgementSpawner(
    Deferred.succeed(killed, undefined).pipe(Effect.andThen(Deferred.await(confirm)))
  );
  let handoffs = 0;
  let returns = 0;
  let kills = 0;
  let pid = O.none<ChildProcessHandle["pid"]>();
  const spawner = ChildProcessSpawner.of({
    ...observed.spawner,
    spawn: Effect.fn("LaneFenceTest.lazySpawn")((command) => {
      handoffs++;
      return Deferred.succeed(entered, undefined).pipe(
        Effect.andThen(Deferred.await(resume)),
        Effect.andThen(() => observed.spawner.spawn(command)),
        Effect.map((child) => {
          pid = O.some(child.pid);
          return {
            ...child,
            kill: (options) =>
              Effect.sync(() => {
                expect(options?.killSignal).toBe("SIGKILL");
                kills++;
              }).pipe(Effect.andThen(child.kill(options))),
          };
        })
      );
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
  return yield* Effect.gen(function* () {
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
    const failure = yield* Fiber.join(pending);
    expect(failure).toMatchObject({ _tag: "CitationNativeLaneFailure", reason: "cleanup-unconfirmed" });
    expect(handoffs).toBe(1);
    const beforeBirth = yield* observed.snapshot;
    expect(beforeBirth).toEqual({ spawned: 0, confirmed: 0 });
    const held = yield* admission.snapshot;
    expect(held).toMatchObject({ active: 1, quarantined: 1 });
    expect(returns).toBe(0);
    const denied = yield* lane.start("regex", command).pipe(Effect.flip);
    expect(denied).toMatchObject({ reason: "quarantined" });
    expect(handoffs).toBe(1);
    yield* Deferred.succeed(resume, undefined);
    yield* Deferred.await(killed);
    expect(kills).toBe(1);
    const awaitingConfirmation = yield* observed.snapshot;
    expect(awaitingConfirmation).toEqual({ spawned: 1, confirmed: 0 });
    const stillHeld = yield* admission.snapshot;
    expect(stillHeld).toMatchObject({ active: 1, quarantined: 1 });
    expect(returns).toBe(0);
    const childPid = yield* Effect.fromOption(pid);
    yield* waitForCitationNativeTest(fs.exists(`/proc/${childPid}`).pipe(Effect.map((exists) => !exists)));
    yield* Deferred.succeed(confirm, undefined);
    yield* waitForCitationNativeTest(admission.snapshot.pipe(Effect.map((state) => state.active === 0)));
    const settled = yield* observed.snapshot;
    expect(settled).toEqual({ spawned: 1, confirmed: 1 });
    const receipt = yield* lane.snapshot;
    expect(receipt).toMatchObject({ started: 1, confirmed: 1, acquired: false });
    expect(returns).toBe(1);
    const later = yield* lane.start("diff", command).pipe(Effect.flip);
    expect(later).toMatchObject({ reason: "quarantined" });
    const again = yield* lane.withUse(() => Effect.void).pipe(Effect.flip);
    expect(again).toMatchObject({ reason: "quarantined" });
    const noFurtherBirths = yield* observed.snapshot;
    expect(noFurtherBirths).toEqual(settled);
    expect(handoffs).toBe(1);
    yield* Scope.close(scope, Exit.void);
    expect(returns).toBe(1);
    return settled;
  }).pipe(
    Effect.ensuring(Deferred.succeed(resume, undefined).pipe(Effect.andThen(Deferred.succeed(confirm, undefined))))
  );
});

it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("spawner hand-off fences", (it) => {
  for (const kind of ["bun", "node"] as const) {
    it.effect(`retires an already-handed-off ${kind} child born after drain expiry`, () =>
      Effect.gen(function* () {
        const physical = yield* exerciseLazyHandoff(kind);
        expect(physical).toEqual({ spawned: 1, confirmed: 1 });
      })
    );
    for (const stage of ["snapshot", "owner"] as const) {
      it.effect(`refuses a ${kind} spawner hand-off after revocation at ${stage}`, () =>
        Effect.gen(function* () {
          if (stage === "snapshot") {
            yield* exerciseFence(kind, stage, 10, true);
          } else {
            const points = yield* ownerFencePoints(kind);
            yield* Effect.forEach(
              A.makeBy(points, (index) => index + 1),
              (point) => exerciseFence(kind, stage, point, true),
              { concurrency: 1, discard: true }
            );
          }
        })
      );
      it.effect(`refuses a ${kind} hand-off when its call is revoked before drain expiry at ${stage}`, () =>
        Effect.gen(function* () {
          const physical = yield* exerciseFence(kind, stage, 10, false);
          expect(physical).toEqual({ spawned: 0, confirmed: 0 });
        })
      );
    }
  }
});
