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
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import {
  citationNativeNodeTestPlatform,
  makeCitationNativeWorkerFixture,
  makeCitationObservedSpawner,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("native lane refusal boundaries", (it) => {
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
