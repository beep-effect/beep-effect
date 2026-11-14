import { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
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
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { installCitationRegexEvaluator } from "@beep/law-practice-server/internal/Citation/RegexWorker";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { holdCitationNativeQueue } from "./CitationNativeQueue.fixtures.ts";
import { makeCitationNativeSleepClock, makeCitationNativeWorkerFixture } from "./CitationNativeSpawner.fixtures.ts";
import { setupCitationRegexRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const descriptor = CitationRegexPatternDescriptor.make({
  patternSha256: Sha256Hex.make("e3254ea61c09ead5a01d3bf07e946a561c6c2cd1c46b8ca1bfa8729d26a7d09f"),
  flags: 0,
  profile: { groups: 0, names: {}, minimumWidthFloor: 1, repeatedCaptures: false, nullableMultiRepeat: false },
});
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), {
  excludeTestServices: true,
  timeout: "30 seconds",
})("regex lane refusal adapters", (it) => {
  for (const point of ["before evaluation", "after reservation"] as const) {
    it.effect(`translates a lane closed ${point} without spawning`, () =>
      Effect.gen(function* () {
        const setup = yield* setupCitationRegexRuntime("bun");
        const worker = yield* installCitationRegexEvaluator(setup.limits, setup.runtime, [descriptor]).pipe(
          Effect.provideContext(setup.context)
        );
        yield* withCitationTestInvocation(
          Effect.gen(function* () {
            const invocation = yield* CitationInvocation;
            const scope = yield* Scope.make();
            const lane = yield* makeCitationNativeLane(setup.limits, "extract").pipe(
              Effect.provideService(Scope.Scope, scope)
            );
            if (point === "before evaluation") yield* Scope.close(scope, Exit.void);
            const selected =
              point === "after reservation"
                ? { ...lane, reserve: lane.reserve.pipe(Effect.tap(() => Scope.close(scope, Exit.void))) }
                : lane;
            const refused = yield* worker
              .evaluate(word("a"), word("a"), 0)
              .pipe(Effect.provideService(CitationInvocation, { ...invocation, lane: selected }), Effect.flip);
            expect(refused).toMatchObject({ _tag: "CitationRegexWorkerFailure", reason: "closed" });
            const receipt = yield* lane.snapshot;
            expect(receipt).toMatchObject({ started: 0, confirmed: 0, acquired: false });
            const counts = yield* setup.observed.snapshot;
            expect(counts).toEqual({ spawned: 0, confirmed: 0 });
          }),
          setup.limits
        ).pipe(Effect.provideContext(setup.context));
        const state = yield* setup.admission.snapshot;
        expect(state.active).toBe(0);
      })
    );
  }
  it.effect("translates an actual failed OS spawn and confirms the empty process record", () =>
    Effect.gen(function* () {
      const setup = yield* setupCitationRegexRuntime("bun");
      const runtime = CitationNativeProcessRuntime.make({
        ...setup.runtime,
        executable: `${setup.runtime.cwd}/missing-executable`,
      });
      const worker = yield* installCitationRegexEvaluator(setup.limits, runtime, [descriptor]).pipe(
        Effect.provideContext(setup.context)
      );
      yield* withCitationTestInvocation(
        Effect.gen(function* () {
          const refused = yield* worker.evaluate(word("a"), word("a"), 0).pipe(Effect.flip);
          expect(refused).toMatchObject({ _tag: "CitationRegexWorkerFailure", reason: "spawn-failed" });
          const { lane } = yield* CitationInvocation;
          const receipt = yield* lane.snapshot;
          expect(receipt).toMatchObject({ started: 0, confirmed: 0, occupied: false });
        }),
        setup.limits
      ).pipe(Effect.provideContext(setup.context));
      const counts = yield* setup.observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
      const state = yield* setup.admission.snapshot;
      expect(state.active).toBe(0);
    })
  );
  it.effect("refuses an absolute-schema-valid match quota above the installed policy before reservation", () =>
    Effect.gen(function* () {
      const setup = yield* setupCitationRegexRuntime("bun");
      const limits = { ...setup.limits, patternMatches: 1 };
      const worker = yield* installCitationRegexEvaluator(limits, setup.runtime, [descriptor]).pipe(
        Effect.provideContext(setup.context)
      );
      yield* withCitationTestInvocation(
        Effect.gen(function* () {
          const refused = yield* worker.evaluate(word("a"), word("a"), 0, 2).pipe(Effect.flip);
          expect(refused).toMatchObject({
            _tag: "CitationSafetyLimitExceeded",
            operation: "extract",
            limit: "patternMatches",
          });
          const { lane } = yield* CitationInvocation;
          const receipt = yield* lane.snapshot;
          expect(receipt.unitsAcquired).toBe(0);
        }),
        limits
      ).pipe(Effect.provideContext(setup.context));
      const counts = yield* setup.observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("translates an unconfirmed real regex retirement and settles it on Scope retry", () =>
    Effect.gen(function* () {
      const setup = yield* setupCitationRegexRuntime("bun");
      let unconfirmed = true;
      const spawner = ChildProcessSpawner.of({
        ...setup.observed.spawner,
        spawn: Effect.fn("RegexLaneCoverage.spawn")(function* (command) {
          const child = yield* setup.observed.spawner.spawn(command);
          return {
            ...child,
            isRunning: Effect.suspend(() => (unconfirmed ? Effect.succeed(true) : child.isRunning)),
          };
        }),
      });
      const context = setup.context.pipe(Context.add(ChildProcessSpawner, spawner));
      const worker = yield* installCitationRegexEvaluator(setup.limits, setup.runtime, [descriptor]).pipe(
        Effect.provideContext(context)
      );
      yield* withCitationTestInvocation(
        Effect.gen(function* () {
          const invocation = yield* CitationInvocation;
          const ownerScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
          const lane = yield* makeCitationNativeLane(setup.limits, "extract").pipe(
            Effect.provideService(Scope.Scope, ownerScope)
          );
          const failed = yield* worker
            .evaluate(word("a"), word("a"), 0)
            .pipe(Effect.provideService(CitationInvocation, { ...invocation, lane }), Effect.flip);
          expect(failed).toMatchObject({ _tag: "CitationRegexWorkerFailure", reason: "cleanup-unconfirmed" });
          const retained = yield* setup.admission.snapshot;
          expect(retained).toMatchObject({ active: 1, quarantined: 1 });
          unconfirmed = false;
          yield* Scope.close(ownerScope, Exit.void);
          const receipt = yield* lane.snapshot;
          expect(receipt).toMatchObject({ started: 1, confirmed: 1, acquired: false });
        }),
        setup.limits
      ).pipe(
        Effect.provideContext(context),
        Effect.ensuring(
          Effect.sync(() => {
            unconfirmed = false;
          })
        )
      );
      const counts = yield* setup.observed.snapshot;
      expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      const state = yield* setup.admission.snapshot;
      expect(state).toMatchObject({ active: 0, quarantined: 0 });
    })
  );
  it.effect("preserves a regex start-time queue refusal after an intervening cleaner yield", () =>
    Effect.gen(function* () {
      const setup = yield* setupCitationRegexRuntime("bun");
      const queueDeadline = Duration.millis(991);
      const limits = {
        ...setup.limits,
        concurrentOperations: 1,
        concurrentRegexProcesses: 1,
        queuedOperations: 1,
        queueDeadline,
      };
      const controlled = yield* makeCitationNativeSleepClock((duration) =>
        Duration.equals(duration, queueDeadline) ? Effect.never : setup.timer.clock.sleep(duration)
      );
      const admission = yield* makeCitationNativeProcessAdmission(limits).pipe(
        Effect.provideService(Clock.Clock, controlled)
      );
      const context = setup.context.pipe(
        Context.add(Clock.Clock, controlled),
        Context.add(CitationNativeProcessAdmission, admission)
      );
      const worker = yield* installCitationRegexEvaluator(limits, setup.runtime, [descriptor]).pipe(
        Effect.provideContext(context)
      );
      const idle = yield* makeCitationNativeWorkerFixture("busy");
      const standalone = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
        Effect.provideContext(context)
      );
      yield* withCitationTestInvocation(
        Effect.gen(function* () {
          const invocation = yield* CitationInvocation;
          const queueScope = yield* Scope.Scope;
          let held = O.none<Effect.Success<ReturnType<typeof holdCitationNativeQueue>>>();
          const reserve = invocation.lane.reserve.pipe(
            Effect.andThen(invocation.lane.yieldTo(Effect.void)),
            Effect.andThen(
              holdCitationNativeQueue(
                admission,
                standalone.start,
                citationNativeProcessCommand(CitationNativeProcessRuntime.make(idle), "")
              )
            ),
            Effect.tap((blocker) =>
              Effect.sync(() => {
                held = O.some(blocker);
              })
            ),
            Effect.asVoid,
            Effect.provideService(Scope.Scope, queueScope)
          );
          const refused = yield* worker
            .evaluate(word("a"), word("a"), 0)
            .pipe(
              Effect.provideService(CitationInvocation, { ...invocation, lane: { ...invocation.lane, reserve } }),
              Effect.flip
            );
          expect(refused).toMatchObject({
            _tag: "CitationSafetyLimitExceeded",
            operation: "extract",
            limit: "queuedOperations",
          });
          const receipt = yield* invocation.lane.snapshot;
          expect(receipt).toMatchObject({ unitsAcquired: 1, acquired: false, started: 0 });
          const blocker = yield* Effect.fromOption(held);
          yield* blocker.release;
        }),
        limits
      ).pipe(Effect.provideContext(context));
      const counts = yield* setup.observed.snapshot;
      expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
    })
  );
});
