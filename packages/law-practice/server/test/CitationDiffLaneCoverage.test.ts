import { makeCitationDiffWorker } from "@beep/law-practice-server/internal/Citation/DiffWorker";
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
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import { holdCitationNativeQueue } from "./CitationNativeQueue.fixtures.ts";
import {
  citationNativeNodeTestPlatform,
  makeCitationNativeManualClock,
  makeCitationNativeSleepClock,
  makeCitationNativeWorkerFixture,
  makeCitationObservedSpawner,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const word = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const fixture = Effect.fn("DiffLaneCoverage.fixture")(function* (
  changes: Partial<CitationEngineLimits>,
  missing: boolean
) {
  const base = (yield* defaultCitationEnginePolicy).limits;
  const limits = { ...base, ...changes };
  const f = yield* makeCitationNativeWorkerFixture("busy", "diff");
  const runtime = CitationNativeProcessRuntime.make({
    ...f,
    executable: missing ? `${f.cwd}/missing-executable` : f.executable,
  });
  const observed = yield* makeCitationObservedSpawner();
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
  const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
    Effect.provideService(Scope.Scope, scope),
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  const worker = yield* makeCitationDiffWorker(limits, runtime).pipe(Effect.provideService(Scope.Scope, scope));
  const budget = yield* makeCitationTextBudget(limits);
  return { limits, runtime, observed, admission, scope, lane, worker, budget, native: f };
});

it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("diff lane refusal adapters", (it) => {
  it.effect("refuses a closed diff installation before reservation or spawn", () =>
    Effect.gen(function* () {
      const f = yield* fixture({}, false);
      yield* Scope.close(f.scope, Exit.void);
      const refused = yield* f.worker
        .evaluate(f.lane.start, f.lane.reserve, f.budget.reserve, word("a"), word("b"))
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationDiffWorkerFailure", reason: "closed" });
      const receipt = yield* f.lane.snapshot;
      expect(receipt.unitsAcquired).toBe(0);
      const counts = yield* f.observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("maps a kernel URL refusal before constructing an evaluator", () =>
    Effect.gen(function* () {
      const f = yield* fixture({}, false);
      const path = yield* Path.Path;
      let urls = 0;
      const refused = yield* makeCitationDiffWorker(f.limits, f.runtime).pipe(
        Effect.provideService(Path.Path, {
          ...path,
          fromFileUrl: () =>
            Effect.sync(() => {
              urls++;
            }).pipe(
              Effect.andThen(Effect.fail(new PlatformError.BadArgument({ module: "Path", method: "fromFileUrl" })))
            ),
        }),
        Effect.flip
      );
      expect(refused).toMatchObject({ _tag: "CitationDiffWorkerFailure", reason: "invalid-runtime" });
      expect(urls).toBe(1);
      const counts = yield* f.observed.snapshot;
      expect(counts.spawned).toBe(0);
    })
  );
  for (const cap of ["diffInputUtf16", "producedTextUtf16"] as const) {
    it.effect(`refuses ${cap} before reserving or starting a child`, () =>
      Effect.gen(function* () {
        const f = yield* fixture({ [cap]: 1 }, false);
        const refused = yield* f.worker
          .evaluate(f.lane.start, f.lane.reserve, f.budget.reserve, word("aa"), word("b"))
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "extract", limit: cap });
        const charge = yield* f.budget.snapshot;
        expect(charge).toBe(0);
        const receipt = yield* f.lane.snapshot;
        expect(receipt.unitsAcquired).toBe(0);
        const counts = yield* f.observed.snapshot;
        expect(counts).toEqual({ spawned: 0, confirmed: 0 });
      })
    );
  }
  it.effect("translates a failed OS spawn through the exact child record", () =>
    Effect.gen(function* () {
      const f = yield* fixture({}, true);
      const refused = yield* f.worker
        .evaluate(f.lane.start, f.lane.reserve, f.budget.reserve, word("a"), word("b"))
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationDiffWorkerFailure", reason: "spawn-failed" });
      const state = yield* f.worker.snapshot;
      expect(state).toMatchObject({ processes: 0, quarantined: 0 });
      yield* Scope.close(f.scope, Exit.void);
      const admission = yield* f.admission.snapshot;
      expect(admission.active).toBe(0);
      const counts = yield* f.observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("translates a lane closed between reservation and spawn", () =>
    Effect.gen(function* () {
      const f = yield* fixture({}, false);
      const laneScope = yield* Scope.make();
      const lane = yield* makeCitationNativeLane(f.limits, "extract").pipe(
        Effect.provideService(Scope.Scope, laneScope),
        Effect.provideService(CitationNativeProcessAdmission, f.admission),
        Effect.provideService(ChildProcessSpawner, f.observed.spawner)
      );
      const reserve = lane.reserve.pipe(Effect.tap(() => Scope.close(laneScope, Exit.void)));
      const refused = yield* f.worker
        .evaluate(lane.start, reserve, f.budget.reserve, word("a"), word("b"))
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationDiffWorkerFailure", reason: "closed" });
      const receipt = yield* lane.snapshot;
      expect(receipt).toMatchObject({ acquired: false, started: 0, confirmed: 0 });
      const counts = yield* f.observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("translates the inner Unicode deadline while the enclosing timer is held", () =>
    Effect.gen(function* () {
      const duration = Duration.millis(997);
      const clock = yield* Clock.Clock;
      let timers = 0;
      const controlled = yield* makeCitationNativeSleepClock((input) => {
        if (!Duration.equals(input, duration)) return clock.sleep(input);
        timers++;
        return timers === 1 ? Effect.yieldNow : Effect.never;
      });
      const f = yield* fixture({ extractDeadline: duration }, false).pipe(
        Effect.provideService(Clock.Clock, controlled)
      );
      const refused = yield* f.worker
        .evaluate(f.lane.start, f.lane.reserve, f.budget.reserve, { width: 1, bytes: new Uint8Array(65536) }, word("b"))
        .pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "extractDeadline",
      });
      expect(timers).toBeGreaterThanOrEqual(2);
      const counts = yield* f.observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("retries an unconfirmed real diff retirement without duplicating its quarantine", () =>
    Effect.gen(function* () {
      const f = yield* fixture({ extractDeadline: Duration.millis(997) }, false);
      const timer = yield* makeCitationNativeManualClock(f.limits.extractDeadline);
      const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
      let unconfirmed = true;
      const lane = yield* makeCitationNativeLane(f.limits, "extract").pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.provideService(Clock.Clock, timer.clock),
        Effect.provideService(CitationNativeProcessAdmission, f.admission),
        Effect.provideService(ChildProcessSpawner, {
          ...f.observed.spawner,
          spawn: (command) =>
            f.observed.spawner.spawn(command).pipe(
              Effect.map((child) => ({
                ...child,
                isRunning: Effect.suspend(() => (unconfirmed ? Effect.succeed(true) : child.isRunning)),
              }))
            ),
        })
      );
      const worker = yield* makeCitationDiffWorker(f.limits, f.runtime).pipe(
        Effect.provideService(Clock.Clock, timer.clock)
      );
      yield* Effect.gen(function* () {
        const pending = yield* worker
          .evaluate(lane.start, lane.reserve, f.budget.reserve, word("a"), word("b"))
          .pipe(Effect.forkChild);
        yield* waitForCitationNativeTest(f.native.fs.exists(f.native.marker));
        yield* timer.trigger;
        const failed = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(failed).toMatchObject({ _tag: "CitationDiffWorkerFailure", reason: "cleanup-unconfirmed" });
        const retry = yield* worker.reap().pipe(Effect.flip);
        expect(retry).toMatchObject({ _tag: "CitationDiffWorkerFailure", reason: "cleanup-unconfirmed" });
        const retained = yield* worker.snapshot;
        expect(retained).toMatchObject({ processes: 1, quarantined: 1 });
        unconfirmed = false;
        yield* worker.reap();
        const settled = yield* worker.snapshot;
        expect(settled).toMatchObject({ processes: 0, quarantined: 0 });
        const counts = yield* f.observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
        yield* Scope.close(scope, Exit.void);
        const admission = yield* f.admission.snapshot;
        expect(admission.active).toBe(0);
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            unconfirmed = false;
          })
        )
      );
    })
  );
  it.effect("preserves a start-time queue refusal after an intervening cleaner yield", () =>
    Effect.gen(function* () {
      const queueDeadline = Duration.millis(991);
      const extractDeadline = Duration.millis(997);
      const clock = yield* Clock.Clock;
      const controlled = yield* makeCitationNativeSleepClock((duration) =>
        Duration.equals(duration, queueDeadline) || Duration.equals(duration, extractDeadline)
          ? Effect.never
          : clock.sleep(duration)
      );
      const f = yield* fixture(
        { concurrentOperations: 1, concurrentRegexProcesses: 1, queuedOperations: 1, queueDeadline, extractDeadline },
        false
      ).pipe(Effect.provideService(Clock.Clock, controlled));
      const standalone = yield* makeCitationStandaloneNativeStarter(f.limits, "clean").pipe(
        Effect.provideService(CitationNativeProcessAdmission, f.admission),
        Effect.provideService(ChildProcessSpawner, f.observed.spawner)
      );
      const queueScope = yield* Scope.Scope;
      let held = O.none<Effect.Success<ReturnType<typeof holdCitationNativeQueue>>>();
      const reserve = f.lane.reserve.pipe(
        Effect.andThen(f.lane.yieldTo(Effect.void)),
        Effect.andThen(
          holdCitationNativeQueue(f.admission, standalone.start, citationNativeProcessCommand(f.runtime, ""))
        ),
        Effect.tap((blocker) =>
          Effect.sync(() => {
            held = O.some(blocker);
          })
        ),
        Effect.asVoid,
        Effect.provideService(Scope.Scope, queueScope)
      );
      const refused = yield* f.worker
        .evaluate(f.lane.start, reserve, f.budget.reserve, word("a"), word("b"))
        .pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "queuedOperations",
      });
      const receipt = yield* f.lane.snapshot;
      expect(receipt).toMatchObject({ unitsAcquired: 1, acquired: false, started: 0 });
      const blocker = yield* Effect.fromOption(held);
      yield* blocker.release;
      const counts = yield* f.observed.snapshot;
      expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      const state = yield* f.admission.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
    })
  );
});
