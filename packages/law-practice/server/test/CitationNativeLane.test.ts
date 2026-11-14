import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import {
  makeCitationNativeLane,
  makeCitationStandaloneNativeStarter,
  withCitationNativeStart,
} from "@beep/law-practice-server/internal/Citation/NativeLane";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import {
  citationBunTestExecutable,
  citationNativeNodeTestPlatform,
  citationNodeTestExecutable,
  makeCitationNativeAcknowledgementSpawner,
  makeCitationObservedSpawner,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("invocation native lanes with real children", (it) => {
  for (const kind of ["bun", "node"] as const) {
    const command = Effect.gen(function* () {
      const executable = yield* kind === "bun" ? citationBunTestExecutable : citationNodeTestExecutable;
      return ChildProcess.make(executable, ["-e", "process.stdin.resume()"], {
        env: {},
        extendEnv: false,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "ignore",
        killSignal: "SIGKILL",
        forceKillAfter: Duration.zero,
      });
    });
    it.effect(`hands over and yields one ${kind} lane without overlapping children`, () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        const observed = yield* makeCitationObservedSpawner();
        const cmd = yield* command;
        const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
        const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, observed.spawner),
          Effect.provideService(Scope.Scope, scope)
        );
        const standalone = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, observed.spawner)
        );
        const empty = yield* admission.snapshot;
        expect(empty.active).toBe(0);
        const first = yield* lane.start("regex", cmd);
        yield* first.child;
        const second = yield* lane.start("diff", cmd);
        yield* second.child;
        const third = yield* lane.start("markup", cmd);
        yield* third.child;
        yield* lane.yieldTo(withCitationNativeStart(standalone.start, "markup", cmd, () => Effect.void));
        const yielded = yield* lane.snapshot;
        expect(yielded).toMatchObject({ started: 3, confirmed: 3, acquired: false, unitsAcquired: 1 });
        const afterYield = yield* admission.snapshot;
        expect(afterYield.active).toBe(0);
        const last = yield* lane.start("regex", cmd);
        yield* last.child;
        yield* Scope.close(scope, Exit.void);
        const final = yield* lane.snapshot;
        expect(final).toMatchObject({ started: 4, confirmed: 4, acquired: false, unitsAcquired: 2 });
        const maximum = yield* observed.maximumAlive;
        expect(maximum).toBe(1);
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 5, confirmed: 5 });
        const released = yield* admission.snapshot;
        expect(released).toMatchObject({ active: 0, queued: 0, quarantined: 0 });
      })
    );
    it.effect(`supports concurrent and nested ${kind} cleaner yields without taking a lane unit`, () =>
      Effect.gen(function* () {
        const base = (yield* defaultCitationEnginePolicy).limits;
        const limits = { ...base, concurrentOperations: 2, concurrentRegexProcesses: 2 };
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        const observed = yield* makeCitationObservedSpawner();
        const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, observed.spawner)
        );
        const standalone = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, observed.spawner)
        );
        const cmd = yield* command;
        const both = yield* Deferred.make<void>();
        let entered = 0;
        const child = withCitationNativeStart(standalone.start, "markup", cmd, () =>
          Effect.gen(function* () {
            entered++;
            if (entered === 2) yield* Deferred.succeed(both, undefined);
            if (entered <= 2) yield* Deferred.await(both);
          })
        );
        yield* Effect.all([lane.yieldTo(child), lane.yieldTo(child)], {
          concurrency: 2,
        });
        yield* lane.yieldTo(lane.yieldTo(child));
        const invalid = yield* lane.yieldTo(lane.start("regex", cmd)).pipe(Effect.flip);
        expect(invalid).toMatchObject({ reason: "invalid-runtime" });
        const receipt = yield* lane.snapshot;
        expect(receipt).toMatchObject({ started: 0, confirmed: 0, unitsAcquired: 0 });
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 3, confirmed: 3 });
        const maximum = yield* observed.maximumAlive;
        expect(maximum).toBe(2);
        const state = yield* admission.snapshot;
        expect(state.active).toBe(0);
      })
    );
    it.effect(`waits for ${kind} yield retirement and restores depth after interruption`, () =>
      Effect.gen(function* () {
        const base = (yield* defaultCitationEnginePolicy).limits;
        const limits = { ...base, cleanupDeadline: Duration.seconds(5) };
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        const killed = yield* Deferred.make<void>();
        const acknowledge = yield* Deferred.make<void>();
        const observed = yield* makeCitationNativeAcknowledgementSpawner(
          Deferred.succeed(killed, undefined).pipe(Effect.andThen(Deferred.await(acknowledge)))
        );
        const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, observed.spawner)
        );
        const cmd = yield* command;
        const record = yield* lane.start("regex", cmd);
        yield* record.child;
        const entered = yield* Deferred.make<void>();
        const bothEntered = yield* Deferred.make<void>();
        const attempted = yield* Deferred.make<void>();
        let entries = 0;
        const cleaner = lane.yieldTo(
          Effect.gen(function* () {
            entries++;
            yield* Deferred.succeed(entered, undefined);
            if (entries === 2) yield* Deferred.succeed(bothEntered, undefined);
            return yield* Effect.never;
          })
        );
        const first = yield* cleaner.pipe(Effect.forkChild);
        yield* Deferred.await(killed);
        const second = yield* Deferred.succeed(attempted, undefined).pipe(Effect.andThen(cleaner), Effect.forkChild);
        yield* Deferred.await(attempted);
        yield* Effect.yieldNow;
        const premature = yield* Deferred.isDone(entered);
        expect(premature).toBe(false);
        const held = yield* admission.snapshot;
        expect(held.active).toBe(1);
        yield* Deferred.succeed(acknowledge, undefined);
        yield* Deferred.await(bothEntered);
        const returned = yield* admission.snapshot;
        expect(returned.active).toBe(0);
        yield* Fiber.interrupt(first);
        yield* Fiber.interrupt(second);
        const next = yield* lane.start("regex", cmd);
        yield* next.child;
        yield* next.process.retire(false);
        yield* lane.yieldTo(Effect.void);
        const receipt = yield* lane.snapshot;
        expect(receipt).toMatchObject({ started: 2, confirmed: 2, unitsAcquired: 2, acquired: false });
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 2, confirmed: 2 });
        const final = yield* admission.snapshot;
        expect(final).toMatchObject({ active: 0, quarantined: 0, queued: 0 });
      })
    );
    it.effect(`releases the unused ${kind} unit when quarantine appears after acquisition`, () =>
      Effect.gen(function* () {
        const base = (yield* defaultCitationEnginePolicy).limits;
        const limits = { ...base, concurrentOperations: 2, concurrentRegexProcesses: 2 };
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        const observed = yield* makeCitationObservedSpawner();
        const blocker = yield* admission.acquire("clean");
        const standalone = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
          Effect.provideService(
            CitationNativeProcessAdmission,
            CitationNativeProcessAdmission.of({
              ...admission,
              acquire: Effect.fn("NativeLaneTest.blockerLease")(() => Effect.succeed(blocker)),
            })
          ),
          Effect.provideService(ChildProcessSpawner, observed.spawner)
        );
        const cmd = yield* command;
        const child = yield* standalone.start("markup", cmd);
        yield* child.child;
        const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
        const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
          Effect.provideService(
            CitationNativeProcessAdmission,
            CitationNativeProcessAdmission.of({
              ...admission,
              acquire: Effect.fn("NativeLaneTest.quarantineAfterAcquire")((operation) =>
                admission.acquire(operation).pipe(Effect.tap(() => blocker.quarantine))
              ),
            })
          ),
          Effect.provideService(ChildProcessSpawner, observed.spawner),
          Effect.provideService(Scope.Scope, scope)
        );
        const failed = yield* lane.start("regex", cmd).pipe(Effect.flip);
        expect(failed).toMatchObject({ reason: "quarantined" });
        const held = yield* admission.snapshot;
        expect(held).toMatchObject({ active: 1, quarantined: 1 });
        yield* child.process.retire(false);
        yield* Scope.close(scope, Exit.void);
        const released = yield* admission.snapshot;
        expect(released).toMatchObject({ active: 0, quarantined: 0 });
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      })
    );
    it.effect(`releases ${kind} capacity on interruption between acquire and spawn`, () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        const acquired = yield* Deferred.make<void>();
        const proceed = yield* Deferred.make<void>();
        const observed = yield* makeCitationObservedSpawner();
        const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
        let acquisitions = 0;
        const controlled = CitationNativeProcessAdmission.of({
          ...admission,
          acquire: Effect.fn("NativeLaneTest.pauseAcquire")(function* (operation) {
            const lease = yield* admission.acquire(operation);
            acquisitions++;
            if (acquisitions === 2) {
              yield* Deferred.succeed(acquired, undefined);
              yield* Deferred.await(proceed);
            }
            return lease;
          }),
        });
        const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
          Effect.provideService(CitationNativeProcessAdmission, controlled),
          Effect.provideService(ChildProcessSpawner, observed.spawner),
          Effect.provideService(Scope.Scope, scope)
        );
        const cmd = yield* command;
        const seed = yield* lane.start("regex", cmd);
        yield* seed.child;
        yield* lane.yieldTo(Effect.void);
        const pending = yield* lane.start("regex", cmd).pipe(Effect.forkChild);
        yield* Deferred.await(acquired);
        yield* Effect.sync(() => pending.interruptUnsafe());
        yield* Deferred.succeed(proceed, undefined);
        const interrupted = yield* Fiber.await(pending);
        interrupted.pipe(Exit.hasInterrupts, assertTrue);
        yield* Scope.close(scope, Exit.void);
        const released = yield* admission.snapshot;
        expect(released).toMatchObject({ active: 0, quarantined: 0, queued: 0 });
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      })
    );
    it.effect(`quarantines an unconfirmed ${kind} yield and refuses the cleaner`, () =>
      Effect.gen(function* () {
        const base = (yield* defaultCitationEnginePolicy).limits;
        const limits = { ...base, cleanupDeadline: Duration.millis(25) };
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        const acknowledge = yield* Deferred.make<void>();
        const observed = yield* acknowledge.pipe(Deferred.await, makeCitationNativeAcknowledgementSpawner);
        const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
        const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, observed.spawner),
          Effect.provideService(Scope.Scope, scope)
        );
        const cmd = yield* command;
        const record = yield* lane.start("regex", cmd);
        yield* record.child;
        let called = false;
        const result = yield* lane
          .yieldTo(
            Effect.sync(() => {
              called = true;
            })
          )
          .pipe(Effect.flip);
        expect(result).toMatchObject({ limit: "cleanupDeadline" });
        expect(called).toBe(false);
        const quarantined = yield* admission.snapshot;
        expect(quarantined).toMatchObject({ active: 1, quarantined: 1 });
        yield* Deferred.succeed(acknowledge, undefined);
        yield* waitForCitationNativeTest(Effect.map(observed.snapshot, (counts) => counts.confirmed === 1));
        yield* waitForCitationNativeTest(Effect.map(admission.snapshot, (state) => state.active === 0));
        const noRespawn = yield* lane.start("regex", cmd).pipe(Effect.flip);
        expect(noRespawn).toMatchObject({ reason: "quarantined" });
        const noCleaner = yield* lane
          .yieldTo(
            Effect.sync(() => {
              called = true;
            })
          )
          .pipe(Effect.flip);
        expect(noCleaner).toMatchObject({ reason: "quarantined" });
        expect(called).toBe(false);
        const settled = yield* lane.snapshot;
        expect(settled.acquired).toBe(false);
        yield* Scope.close(scope, Exit.void);
        const released = yield* admission.snapshot;
        expect(released).toMatchObject({ active: 0, quarantined: 0 });
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      })
    );
  }
});
