import * as NodeURL from "node:url";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { makeCitationNativeLane } from "@beep/law-practice-server/internal/Citation/NativeLane";
import { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { citationUnaccountedText } from "@beep/law-practice-server/internal/Citation/RegexInput";
import { makeCitationRegexSession } from "@beep/law-practice-server/internal/Citation/RegexSession";
import { makeCitationRegexSessionPreparation } from "@beep/law-practice-server/internal/Citation/RegexSessionProtocol";
import { CitationRegexWorkerFailure } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { decodeCitationRegexReply } from "@beep/law-practice-server/internal/Citation/RegexWorkerRpc";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import {
  citationBunTestExecutable,
  citationNativeNodeTestPlatform,
  citationNodeTestExecutable,
  makeCitationNativeManualClock,
  makeCitationObservedSpawner,
  makeCitationRegexTestRuntime,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const descriptor = S.decodeEffect(CitationRegexPatternDescriptor)({
  patternSha256: "b07d89ba5ecfc4ef7c8c6208e879a81454b1cc89203805eceef7e16b55117bb7",
  flags: 0,
  profile: {
    groups: 2,
    names: { maybe: 1 },
    minimumWidthFloor: 1,
    repeatedCaptures: false,
    nullableMultiRepeat: false,
  },
});
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const setup = Effect.fn("RegexSessionTest.setup")(function* (kind: CitationNativeRuntimeKind, mode: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-regex-session-" });
  const executable = yield* kind === "bun" ? citationBunTestExecutable : citationNodeTestExecutable;
  const workerFile = path.join(cwd, `${mode}.mjs`);
  const runtime =
    mode === "real"
      ? yield* makeCitationRegexTestRuntime(kind, cwd)
      : CitationNativeProcessRuntime.make({ kind, executable, cwd, workerFile });
  if (mode !== "real")
    yield* fs.copyFile(NodeURL.fileURLToPath(new URL("./CitationRegexSession.child.mjs", import.meta.url)), workerFile);
  const timer = yield* makeCitationNativeManualClock(Duration.millis(800));
  const limits = {
    ...(yield* defaultCitationEnginePolicy).limits,
    regexDeadline: Duration.millis(800),
    cleanupDeadline: Duration.seconds(2),
    processMessageBytes: mode === "oversize" ? 1024 : 8192,
  };
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
  const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
    Effect.provideService(Scope.Scope, scope),
    Effect.provideService(Clock.Clock, timer.clock),
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  const session = yield* makeCitationRegexSession(limits, "extract", lane).pipe(
    Effect.provideService(Scope.Scope, scope)
  );
  const prepare = yield* makeCitationRegexSessionPreparation(limits, citationUnaccountedText);
  const bound = yield* descriptor;
  const evaluate = session.evaluate(
    runtime,
    "python-re",
    Effect.fnUntraced(function* (sequence, run) {
      const job = yield* prepare.prepare(bound, sequence, native("(?P<maybe>a)?(b)"), native("ab b"), 0, 2, () =>
        lane.reserve.pipe(
          Effect.mapError((error) =>
            error._tag === "CitationNativeLaneFailure"
              ? CitationRegexWorkerFailure.make({ reason: error.reason })
              : error
          )
        )
      );
      return yield* run(job.job, job.frame);
    })
  );
  return { fs, runtime, workerFile, evaluate, session, lane, scope, admission, observed, timer };
});

const assertRetired = Effect.fn("RegexSessionTest.assertRetired")(function* (
  fixture: Effect.Success<ReturnType<typeof setup>>
) {
  const counts = yield* fixture.observed.snapshot;
  expect(counts).toEqual({ spawned: 1, confirmed: 1 });
  const lane = yield* fixture.lane.snapshot;
  expect(lane).toMatchObject({ started: 1, confirmed: 1, occupied: false });
});

it.layer(citationNativeNodeTestPlatform, { excludeTestServices: true, timeout: "30 seconds" })(
  "regex sessions with real child runtimes",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(`reuses one real ${kind} worker and restarts only after a lane handover`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "real");
          const first = yield* fixture.evaluate;
          const reply = yield* decodeCitationRegexReply(first);
          expect(reply).toMatchObject({ _tag: "Complete", matches: 2 });
          yield* fixture.evaluate;
          const reused = yield* fixture.observed.snapshot;
          expect(reused).toEqual({ spawned: 1, confirmed: 0 });
          const other = yield* fixture.lane.start(
            "diff",
            ChildProcess.make(fixture.runtime.executable, ["-e", "process.stdin.resume()"])
          );
          yield* other.child;
          yield* fixture.evaluate;
          yield* Scope.close(fixture.scope, Exit.void);
          const counts = yield* fixture.observed.snapshot;
          expect(counts).toEqual({ spawned: 3, confirmed: 3 });
          const lane = yield* fixture.lane.snapshot;
          expect(lane).toMatchObject({ started: 3, confirmed: 3, occupied: false });
        })
      );

      it.effect(`expires only the ${kind} job timer during a catastrophic regex and confirms death before return`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "running");
          const pending = yield* Effect.forkChild(fixture.evaluate);
          yield* waitForCitationNativeTest(fixture.fs.exists(`${fixture.workerFile}.entered`));
          yield* waitForCitationNativeTest(
            fixture.session.snapshot.pipe(Effect.map((snapshot) => snapshot.state === "running"))
          );
          const running = yield* fixture.session.snapshot;
          expect(running.state).toBe("running");
          let responsive = false;
          yield* Effect.sync(() => {
            responsive = true;
          }).pipe(Effect.forkChild, Effect.flatMap(Fiber.join));
          expect(responsive).toBe(true);
          const sleeps = yield* fixture.timer.sleeps;
          expect(sleeps).toBe(2);
          yield* fixture.timer.triggerSleep(1);
          const failure = yield* Fiber.join(pending).pipe(Effect.flip);
          expect(failure).toMatchObject({
            _tag: "CitationSafetyLimitExceeded",
            operation: "extract",
            limit: "regexDeadline",
          });
          yield* assertRetired(fixture);
        })
      );

      it.effect(`fails closed without a ${kind} respawn after a killed job`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "running");
          const pending = yield* Effect.forkChild(fixture.evaluate);
          yield* waitForCitationNativeTest(fixture.fs.exists(`${fixture.workerFile}.entered`));
          yield* fixture.timer.triggerSleep(1);
          const first = yield* Fiber.join(pending).pipe(Effect.flip);
          const second = yield* fixture.evaluate.pipe(Effect.flip);
          expect(second).toEqual(first);
          yield* assertRetired(fixture);
        })
      );

      for (const mode of ["wrong-sequence", "eof", "oversize"] as const) {
        it.effect(`kills and confirms ${kind} on ${mode}`, () =>
          Effect.gen(function* () {
            const fixture = yield* setup(kind, mode);
            const failure = yield* fixture.evaluate.pipe(Effect.flip);
            expect(failure._tag).toBe(
              mode === "oversize" ? "CitationSafetyLimitExceeded" : "CitationRegexWorkerFailure"
            );
            yield* assertRetired(fixture);
            const again = yield* fixture.evaluate.pipe(Effect.flip);
            expect(again).toEqual(failure);
            yield* assertRetired(fixture);
          })
        );
      }

      it.effect(`kills and confirms ${kind} on a frame while idle`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "idle");
          yield* fixture.evaluate;
          const before = yield* fixture.session.snapshot;
          expect(before.state).toBe("idle");
          yield* fixture.fs.writeFileString(`${fixture.workerFile}.release`, "release");
          yield* waitForCitationNativeTest(
            fixture.session.snapshot.pipe(Effect.map((snapshot) => snapshot.state === "killed"))
          );
          const failed = yield* fixture.evaluate.pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "invalid-frame" });
          yield* assertRetired(fixture);
        })
      );

      for (const mode of ["sent", "running"] as const) {
        it.effect(`confirms ${kind} death before acknowledging interruption during ${mode}`, () =>
          Effect.gen(function* () {
            const fixture = yield* setup(kind, mode);
            const pending = yield* Effect.forkChild(fixture.evaluate);
            yield* waitForCitationNativeTest(
              fixture.session.snapshot.pipe(Effect.map((snapshot) => snapshot.state === mode))
            );
            yield* Fiber.interrupt(pending);
            const outcome = yield* Fiber.await(pending);
            expect(Exit.hasInterrupts(outcome)).toBe(true);
            yield* assertRetired(fixture);
            const refused = yield* fixture.evaluate.pipe(Effect.flip);
            expect(refused).toMatchObject({ reason: "closed" });
            yield* assertRetired(fixture);
          })
        );
      }
    }
  }
);
