import { CitationHtmlWorkerFailure } from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";
import { makeCitationMarkupWorker } from "@beep/law-practice-server/internal/Citation/MarkupWorker";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import {
  CitationNativeLaneFailure,
  makeCitationStandaloneNativeStarter,
} from "@beep/law-practice-server/internal/Citation/NativeLane";
import {
  CitationNativeProcessRuntime,
  citationNativeProcessCommand,
} from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import { holdCitationNativeQueue } from "./CitationNativeQueue.fixtures.ts";
import {
  citationNativeNodeTestPlatform,
  makeCitationNativeManualClock,
  makeCitationNativeWorkerFixture,
  makeCitationObservedSpawner,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationNativeStart } from "@beep/law-practice-server/internal/Citation/NativeLane";

const failure = (reason: CitationHtmlWorkerFailure["reason"]) => CitationHtmlWorkerFailure.make({ reason });
it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("markup retirement adapter boundaries", (it) => {
  it.effect("translates a closed standalone starter and releases the untransferred private slot", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const f = yield* makeCitationNativeWorkerFixture("busy");
      const observed = yield* makeCitationObservedSpawner();
      const scope = yield* Scope.make();
      const starter = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const worker = yield* makeCitationMarkupWorker(
        limits,
        CitationNativeProcessRuntime.make(f),
        "",
        "clean",
        failure
      );
      yield* Scope.close(scope, Exit.void);
      const refused = yield* worker
        .run(
          Effect.succeed(() => Effect.die("closed child was used")),
          starter.start
        )
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationHtmlWorkerFailure", reason: "closed" });
      const state = yield* worker.snapshot;
      expect(state).toMatchObject({ active: 0, processes: 0, quarantined: 0 });
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  for (const kind of ["bun", "node"] as const) {
    for (const refusal of ["lane", "deadline"] as const) {
      it.effect(`preserves a live ${kind} record when reap receives a ${refusal} refusal`, () =>
        Effect.gen(function* () {
          const { limits } = yield* defaultCitationEnginePolicy;
          const f = yield* makeCitationNativeWorkerFixture("busy", "html", kind);
          const observed = yield* makeCitationObservedSpawner();
          const admission = yield* makeCitationNativeProcessAdmission(limits);
          const starter = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
            Effect.provideService(CitationNativeProcessAdmission, admission),
            Effect.provideService(ChildProcessSpawner, observed.spawner)
          );
          const worker = yield* makeCitationMarkupWorker(
            limits,
            CitationNativeProcessRuntime.make(f),
            "",
            "clean",
            failure
          );
          const entered = yield* Deferred.make<void>();
          const finish = yield* Deferred.make<void>();
          const start: CitationNativeStart = Effect.fn("MarkupCoverageTest.start")(function* (nativeKind, command) {
            const record = yield* starter.start(nativeKind, command);
            return {
              ...record,
              process: {
                retire: (retry) =>
                  retry
                    ? refusal === "lane"
                      ? Effect.fail(CitationNativeLaneFailure.make({ reason: "cleanup-unconfirmed" }))
                      : Effect.fail(CitationSafetyLimitExceeded.make({ operation: "clean", limit: "cleanupDeadline" }))
                    : record.process.retire(false),
              },
            };
          });
          yield* Effect.gen(function* () {
            const call = yield* worker
              .run(
                Effect.succeed((child) =>
                  child.isRunning.pipe(
                    Effect.tap((running) => Effect.sync(() => expect(running).toBe(true))),
                    Effect.andThen(Deferred.succeed(entered, undefined)),
                    Effect.andThen(Deferred.await(finish))
                  )
                ),
                start
              )
              .pipe(Effect.forkChild);
            yield* Deferred.await(entered);
            const failed = yield* worker.reap().pipe(Effect.flip);
            expect(failed).toMatchObject(
              refusal === "lane"
                ? { _tag: "CitationHtmlWorkerFailure", reason: "cleanup-unconfirmed" }
                : { _tag: "CitationSafetyLimitExceeded", operation: "clean", limit: "cleanupDeadline" }
            );
            const retained = yield* worker.snapshot;
            expect(retained).toMatchObject({ active: 1, processes: 1 });
            const before = yield* observed.snapshot;
            expect(before).toEqual({ spawned: 1, confirmed: 0 });
            yield* Deferred.succeed(finish, undefined);
            yield* Fiber.join(call);
            const after = yield* observed.snapshot;
            expect(after).toEqual({ spawned: 1, confirmed: 1 });
            const state = yield* admission.snapshot;
            expect(state.active).toBe(0);
          }).pipe(Effect.ensuring(Deferred.succeed(finish, undefined)));
        })
      );
    }
    it.effect(`does not quarantine an already acknowledged ${kind} retirement error`, () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const f = yield* makeCitationNativeWorkerFixture("busy", "html", kind);
        const observed = yield* makeCitationObservedSpawner();
        const starter = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
          Effect.provideService(ChildProcessSpawner, observed.spawner)
        );
        const worker = yield* makeCitationMarkupWorker(
          limits,
          CitationNativeProcessRuntime.make(f),
          "",
          "clean",
          failure
        );
        const start: CitationNativeStart = Effect.fn("MarkupCoverageTest.afterConfirmation")(
          function* (nativeKind, command) {
            const record = yield* starter.start(nativeKind, command);
            return {
              ...record,
              process: {
                retire: (retry) =>
                  record.process
                    .retire(retry)
                    .pipe(
                      Effect.andThen(Effect.fail(CitationNativeLaneFailure.make({ reason: "cleanup-unconfirmed" })))
                    ),
              },
            };
          }
        );
        const refused = yield* worker
          .run(
            Effect.succeed(() => Effect.void),
            start
          )
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationHtmlWorkerFailure", reason: "cleanup-unconfirmed" });
        const state = yield* worker.snapshot;
        expect(state).toMatchObject({ active: 0, processes: 0, quarantined: 0 });
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      })
    );
  }
  it.effect("returns its private slot when shared admission refuses the standalone start queue", () =>
    Effect.gen(function* () {
      const base = (yield* defaultCitationEnginePolicy).limits;
      const limits = {
        ...base,
        concurrentOperations: 1,
        concurrentRegexProcesses: 1,
        queuedOperations: 1,
        queueDeadline: Duration.millis(991),
      };
      const timer = yield* makeCitationNativeManualClock(limits.queueDeadline);
      const admission = yield* makeCitationNativeProcessAdmission(limits).pipe(
        Effect.provideService(Clock.Clock, timer.clock)
      );
      const f = yield* makeCitationNativeWorkerFixture("busy");
      const observed = yield* makeCitationObservedSpawner();
      const standalone = yield* makeCitationStandaloneNativeStarter(limits, "clean").pipe(
        Effect.provideService(CitationNativeProcessAdmission, admission),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const blocker = yield* holdCitationNativeQueue(
        admission,
        standalone.start,
        citationNativeProcessCommand(CitationNativeProcessRuntime.make(f), "")
      );
      const worker = yield* makeCitationMarkupWorker(
        limits,
        CitationNativeProcessRuntime.make(f),
        "",
        "clean",
        failure
      );
      const refused = yield* worker
        .run(
          Effect.succeed(() => Effect.die("refused child was used")),
          standalone.start
        )
        .pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "clean",
        limit: "queuedOperations",
      });
      const privateState = yield* worker.snapshot;
      expect(privateState).toMatchObject({ active: 0, queued: 0, processes: 0 });
      yield* blocker.release;
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
    })
  );
});
