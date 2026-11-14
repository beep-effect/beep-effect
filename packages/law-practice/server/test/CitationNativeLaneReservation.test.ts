import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationDiffWorker } from "@beep/law-practice-server/internal/Citation/DiffWorker";
import { makeCitationHtmlWorker } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import {
  CitationInvocation,
  CitationInvocationPolicy,
  openCitationInvocation,
} from "@beep/law-practice-server/internal/Citation/Invocation";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { CitationNativeLaneFailure } from "@beep/law-practice-server/internal/Citation/NativeLane";
import {
  makeCitationNativeProcessOwner,
  CitationNativeProcessRuntime as NativeRuntime,
} from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { installCitationRegexEvaluator } from "@beep/law-practice-server/internal/Citation/RegexWorker";
import { makeCitationXmlWorker } from "@beep/law-practice-server/internal/Citation/XmlWorker";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import { ownCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
import {
  citationBunTestExecutable,
  citationNativeNodeTestPlatform,
  citationNodeTestExecutable,
  makeCitationNativeManualClock,
  makeCitationNativeSleepClock,
  makeCitationNativeWorkerFixture,
  makeCitationObservedSpawner,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { makeCitationXmlTestRuntime } from "./CitationXmlWorker.fixtures.ts";
import type { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const Descriptors = S.Array(CitationRegexPatternDescriptor);
const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
const jobLimits = {
  regex: "regexDeadline",
  diff: "extractDeadline",
  xml: "annotateDeadline",
  html: "cleanDeadline",
} satisfies Record<string, keyof CitationEngineLimits>;
const workerFailureTag = {
  regex: "CitationRegexWorkerFailure",
  diff: "CitationDiffWorkerFailure",
  xml: "CitationXmlWorkerFailure",
  html: "CitationHtmlWorkerFailure",
};
const operationFor = (family: "regex" | "diff" | "xml" | "html") =>
  family === "html" ? "clean" : family === "xml" ? "annotate" : "extract";
const installJob = Effect.fn("NativeReservationTest.installJob")(function* (
  family: "regex" | "diff" | "xml" | "html",
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime
) {
  return yield* Match.value(family).pipe(
    Match.when("regex", () =>
      Effect.gen(function* () {
        const descriptors = yield* ownCitationTestConfiguration(Descriptors, [
          {
            patternSha256: "b07d89ba5ecfc4ef7c8c6208e879a81454b1cc89203805eceef7e16b55117bb7",
            flags: 0,
            profile: {
              groups: 2,
              names: { maybe: 1 },
              minimumWidthFloor: 1,
              repeatedCaptures: false,
              nullableMultiRepeat: false,
            },
          },
        ]);
        const worker = yield* installCitationRegexEvaluator(limits, runtime, descriptors);
        return { run: worker.evaluate(word("(?P<maybe>a)?(b)"), word("ab"), 0).pipe(Effect.asVoid) };
      })
    ),
    Match.when("diff", () =>
      Effect.gen(function* () {
        const worker = yield* makeCitationDiffWorker(limits, runtime);
        return {
          run: Effect.flatMap(CitationInvocation, (invocation) =>
            worker.evaluate(
              invocation.lane.start,
              invocation.lane.reserve,
              invocation.budget.reserve,
              word("ab"),
              word("a")
            )
          ).pipe(Effect.asVoid),
        };
      })
    ),
    Match.when("xml", () =>
      Effect.map(makeCitationXmlWorker(limits, runtime), (worker) => ({
        run: worker.balance(word("<p>Example</p>")).pipe(Effect.asVoid),
      }))
    ),
    Match.when("html", () =>
      Effect.map(makeCitationHtmlWorker(limits, runtime), (worker) => ({
        run: worker.clean("<p>Example</p>").pipe(Effect.asVoid),
      }))
    ),
    Match.exhaustive
  );
});

const makeReservationFixture = Effect.fn("NativeReservationTest.fixture")(function* (
  family: Parameters<typeof installJob>[0],
  kind: "bun" | "node",
  path: "queue-full" | "queue-expiry" | "quarantine" | "job-deadline"
) {
  const base = (yield* defaultCitationEnginePolicy).limits;
  const limits = {
    ...base,
    queuedOperations: 1,
    regexDeadline: Duration.millis(101),
    queueDeadline: Duration.millis(211),
    cleanDeadline: Duration.millis(401),
    extractDeadline: Duration.millis(503),
    annotateDeadline: Duration.millis(607),
    operationDeadline: Duration.seconds(5),
    cleanupDeadline: Duration.seconds(1),
  };
  const operation = operationFor(family);
  const jobLimit = jobLimits[family];
  const operations = yield* makeCitationOperationAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const spawned = yield* Deferred.make<void>();
  const returnSpawn = yield* Deferred.make<void>();
  const spawner = ChildProcessSpawner.of({
    ...observed.spawner,
    spawn: Effect.fn("NativeReservationTest.spawn")((command) =>
      observed.spawner
        .spawn(command)
        .pipe(
          Effect.tap(() =>
            path === "job-deadline"
              ? Deferred.succeed(spawned, undefined).pipe(Effect.andThen(Deferred.await(returnSpawn)))
              : Effect.void
          )
        )
    ),
  });
  const timer = yield* makeCitationNativeManualClock(path === "job-deadline" ? limits[jobLimit] : limits.queueDeadline);
  let regexTimerStarted = false;
  const clock = yield* makeCitationNativeSleepClock((duration) => {
    if (path !== "job-deadline" && Duration.equals(duration, limits.regexDeadline)) {
      regexTimerStarted = true;
      return Effect.never;
    }
    return timer.clock.sleep(duration);
  });
  // The shared admission has its own captured Clock, exactly as at installation.
  const admission = yield* makeCitationNativeProcessAdmission(limits).pipe(Effect.provideService(Clock.Clock, clock));
  const runtime = yield* family === "xml"
    ? makeCitationXmlTestRuntime(kind)
    : makeCitationNativeWorkerFixture("busy", family, kind).pipe(
        Effect.flatMap((runtime) =>
          ownCitationTestConfiguration(
            // The fixture's filesystem/marker capabilities are not runtime fields.
            NativeRuntime,
            runtime
          )
        )
      );
  const provide = <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(
      Effect.provideService(CitationNativeProcessAdmission, admission),
      Effect.provideService(CitationOperationAdmission, operations),
      Effect.provideService(ChildProcessSpawner, spawner),
      Effect.provideService(Clock.Clock, clock)
    );
  const installed = yield* installJob(family, limits, runtime).pipe(provide);
  const job: Effect.Effect<void, Effect.Error<typeof installed.run>, CitationInvocation> = installed.run;
  const owner = yield* makeCitationNativeProcessOwner(limits, "clean", (reason) =>
    CitationNativeLaneFailure.make({ reason })
  ).pipe(Effect.provideService(ChildProcessSpawner, observed.spawner));
  const executable = yield* kind === "bun" ? citationBunTestExecutable : citationNodeTestExecutable;
  const cmd = ChildProcess.make(executable, ["-e", "process.stdin.resume()"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
    killSignal: "SIGKILL",
    forceKillAfter: Duration.zero,
  });
  // Isolate the private stage's captured timer from the enclosing
  // invocation timer of the same duration; production placement is unchanged.
  const enclosureClock = yield* makeCitationNativeSleepClock((duration) =>
    path === "job-deadline" && Duration.equals(duration, limits[jobLimit]) ? Effect.never : clock.sleep(duration)
  );
  const invoke = <A, E, R>(body: Effect.Effect<A, E, R | CitationInvocation>) =>
    openCitationInvocation(
      CitationInvocationPolicy.make({ limits, operation, deadlineStarts: "before-admission" }),
      body
    ).pipe(Effect.provideService(Clock.Clock, enclosureClock), provide);
  return {
    family,
    operation,
    jobLimit,
    job,
    invoke,
    admission,
    owner,
    cmd,
    spawned,
    returnSpawn,
    timer,
    observed,
    regexTimerStarted: () => regexTimerStarted,
  };
});
type ReservationFixture = Effect.Success<ReturnType<typeof makeReservationFixture>>;
const proveJobDeadline = Effect.fn("NativeReservationTest.jobDeadline")(function* (fixture: ReservationFixture) {
  const { family, operation, jobLimit, job, invoke, spawned, returnSpawn, timer, observed } = fixture;
  const pending = yield* invoke(
    Effect.gen(function* () {
      const result = yield* job.pipe(Effect.flip);
      expect(result).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation, limit: jobLimit });
      const invocation = yield* CitationInvocation;
      const snapshot = yield* invocation.lane.snapshot;
      expect(snapshot).toMatchObject(
        family === "html"
          ? { unitsAcquired: 0, acquired: false }
          : { unitsAcquired: 1, acquired: true, started: 1, confirmed: 1 }
      );
    })
  ).pipe(Effect.forkChild);
  yield* Deferred.await(spawned);
  yield* timer.trigger;
  yield* Deferred.succeed(returnSpawn, undefined);
  yield* Fiber.join(pending);
  const counts = yield* observed.snapshot;
  expect(counts).toEqual({ spawned: 1, confirmed: 1 });
});
const proveContention = Effect.fn("NativeReservationTest.contention")(function* (
  fixture: ReservationFixture,
  path: "queue-full" | "queue-expiry" | "quarantine"
) {
  const { family, operation, job, invoke, admission, owner, cmd, timer, observed, regexTimerStarted } = fixture;
  const lease = yield* admission.acquire("clean");
  const blocker = yield* owner.start(cmd, lease);
  yield* blocker.child;
  if (path === "quarantine") yield* lease.quarantine;
  if (path === "queue-full") {
    const waiter = yield* admission.acquire("clean").pipe(Effect.forkChild);
    yield* waitForCitationNativeTest(Effect.map(admission.snapshot, (s) => s.queued === 1));
    const result = yield* invoke(job).pipe(Effect.flip);
    expect(result).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation,
      limit: "queuedOperations",
    });
    yield* Fiber.interrupt(waiter);
  } else if (path === "queue-expiry") {
    const pending = yield* invoke(job).pipe(Effect.forkChild);
    yield* waitForCitationNativeTest(Effect.map(admission.snapshot, (s) => s.queued === 1));
    expect(regexTimerStarted()).toBe(false);
    yield* timer.trigger;
    const result = yield* Fiber.join(pending).pipe(Effect.flip);
    expect(result).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation,
      limit: "queueDeadline",
    });
  } else {
    const result = yield* invoke(job).pipe(Effect.flip);
    expect(result).toMatchObject({
      _tag: workerFailureTag[family],
      reason: "quarantined",
    });
  }
  expect(regexTimerStarted()).toBe(false);
  const beforeRelease = yield* observed.snapshot;
  expect(beforeRelease).toEqual({ spawned: 1, confirmed: 0 });
  yield* blocker.process.retire(false);
  const counts = yield* observed.snapshot;
  expect(counts).toEqual({ spawned: 1, confirmed: 1 });
});
it.layer(
  process.versions.bun === undefined
    ? citationNativeNodeTestPlatform
    : Layer.merge(citationTokenizerTestLayer, BunCrypto.layer),
  {
    excludeTestServices: true,
    timeout: "30 seconds",
    concurrent: false,
  }
)("native reservations preserve admission timers", (it) => {
  for (const kind of ["bun", "node"] as const) {
    for (const family of ["regex", "diff", "xml", "html"] as const) {
      for (const path of ["queue-full", "queue-expiry", "quarantine", "job-deadline"] as const) {
        it.effect(
          `${kind} ${family}: ${path}`,
          () =>
            Effect.gen(function* () {
              const fixture = yield* makeReservationFixture(family, kind, path);
              if (path === "job-deadline") yield* proveJobDeadline(fixture);
              else yield* proveContention(fixture, path);
              const state = yield* fixture.admission.snapshot;
              expect(state).toMatchObject({ active: 0, queued: 0, quarantined: 0 });
            }),
          { timeout: 20000 }
        );
      }
    }
  }
});
