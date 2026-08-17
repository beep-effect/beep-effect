import {
  awaitYeetCheckRegistration,
  isAwaitingYeetCheckRegistration,
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  renderYeetCheckRegistrationExhausted,
  runMonitorCheckWatchForTesting,
  runMonitorPhaseForTesting,
  YEET_CHECK_REGISTRATION_BACKOFF,
  YeetExecutedStep,
  yeetCheckRegistration,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, FileSystem, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

// A7 (ship-velocity): `gh pr checks --watch` reports a head with no check runs
// as an error — exit 1, "no checks reported on the '<branch>' branch" — and
// GitHub needs a moment after a push to register them. Reading that as the
// watch's answer ended the monitor before the pipeline started.
const watchResult = (exitCode: number, output: string): RepoStepRunResult =>
  RepoStepRunResult.make({
    stepId: "monitor:02-pr-checks-watch",
    commandText: "gh pr checks --watch",
    exitCode,
    output,
  });

const unregistered = watchResult(1, "no checks reported on the 'feat/yeet-monitor-hardening' branch");
const green = watchResult(0, "All checks were successful\n0 failing, 16 successful");
const red = watchResult(1, "Some checks were not successful\n1 failing, 15 successful");

describe("yeetCheckRegistration", () => {
  it("reads the empty-check error as awaiting registration", () => {
    expect(yeetCheckRegistration(unregistered)).toBe("awaiting-registration");
  });

  it("reads the --required variant of the same message the same way", () => {
    expect(yeetCheckRegistration(watchResult(1, "no required checks reported on the 'feat/x' branch"))).toBe(
      "awaiting-registration"
    );
  });

  it("reads a red watch as registered — waiting cannot improve a real failure", () => {
    expect(yeetCheckRegistration(red)).toBe("registered");
  });

  it("reads any other failure as registered, so the backoff is not spent on it", () => {
    expect(yeetCheckRegistration(watchResult(4, "gh: authentication required"))).toBe("registered");
  });

  it("reads a successful watch as registered", () => {
    expect(yeetCheckRegistration(green)).toBe("registered");
  });

  // `output` is optional on a step result: a capture that was skipped or lost
  // leaves none. Absent output cannot claim "no checks reported", so it must
  // not buy the backoff.
  it("reads a failure with no captured output as registered", () => {
    expect(
      yeetCheckRegistration(
        RepoStepRunResult.make({
          stepId: "monitor:02-pr-checks-watch",
          commandText: "gh pr checks --watch",
          exitCode: 1,
        })
      )
    ).toBe("registered");
  });

  it("treats an attempt that ran no steps as nothing to wait for", () => {
    expect(isAwaitingYeetCheckRegistration(A.empty())).toBe(false);
  });
});

describe("awaitYeetCheckRegistration", () => {
  const noDelays = [Duration.zero, Duration.zero];

  it.effect("re-attempts an unregistered head until checks appear", () =>
    Effect.gen(function* () {
      const callsRef = yield* Ref.make(0);
      const attempt = Effect.gen(function* () {
        const call = yield* Ref.getAndUpdate(callsRef, (count) => count + 1);
        return call < 2 ? [unregistered] : [green];
      });

      const results = yield* attempt.pipe(awaitYeetCheckRegistration(noDelays));

      expect(yield* Ref.get(callsRef)).toBe(3);
      expect(A.map(results, (result) => result.exitCode)).toEqual([0]);
    })
  );

  it.effect("stops re-attempting the moment checks are registered", () =>
    Effect.gen(function* () {
      const callsRef = yield* Ref.make(0);
      const attempt = Ref.updateAndGet(callsRef, (count) => count + 1).pipe(Effect.as([green]));

      yield* attempt.pipe(awaitYeetCheckRegistration(noDelays));

      expect(yield* Ref.get(callsRef)).toBe(1);
    })
  );

  it.effect("never re-attempts a watch that failed for any other reason", () =>
    Effect.gen(function* () {
      const callsRef = yield* Ref.make(0);
      const attempt = Ref.updateAndGet(callsRef, (count) => count + 1).pipe(Effect.as([red]));

      yield* attempt.pipe(awaitYeetCheckRegistration(noDelays));

      expect(yield* Ref.get(callsRef)).toBe(1);
    })
  );

  it.effect("is bounded, and hands the empty answer back unchanged rather than green", () =>
    Effect.gen(function* () {
      const callsRef = yield* Ref.make(0);
      const attempt = Ref.updateAndGet(callsRef, (count) => count + 1).pipe(Effect.as([unregistered]));

      const results = yield* attempt.pipe(awaitYeetCheckRegistration(noDelays));

      expect(yield* Ref.get(callsRef)).toBe(A.length(noDelays) + 1);
      // Exhaustion must not launder "no checks" into a pass: the caller sees the
      // non-zero result and the awaiting classification, and fails the phase.
      expect(A.map(results, (result) => result.exitCode)).toEqual([1]);
      expect(isAwaitingYeetCheckRegistration(results)).toBe(true);
    })
  );

  it.effect("tells the operator why it is pausing, and where in the bound it is", () =>
    Effect.gen(function* () {
      const attempt = Effect.succeed([unregistered]);

      yield* attempt.pipe(awaitYeetCheckRegistration([Duration.zero, Duration.zero]));

      const logs = A.map(yield* TestConsole.logLines, String);
      expect(A.some(logs, Str.includes("no checks registered for this head yet"))).toBe(true);
      expect(A.some(logs, Str.includes("(1/2)"))).toBe(true);
      expect(A.some(logs, Str.includes("(2/2)"))).toBe(true);
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

  it.effect("propagates a failing attempt instead of retrying it", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(Effect.fail("spawn failed").pipe(awaitYeetCheckRegistration(noDelays)));

      expect(failure).toBe("spawn failed");
    })
  );
});

describe("the shipped check-registration backoff", () => {
  it("is bounded and short enough to stay a monitor, not a hang", () => {
    const total = A.reduce(YEET_CHECK_REGISTRATION_BACKOFF, Duration.zero, (sum, delay) => Duration.sum(sum, delay));
    expect(A.length(YEET_CHECK_REGISTRATION_BACKOFF)).toBe(5);
    expect(Duration.toMillis(total)).toBeLessThanOrEqual(Duration.toMillis(Duration.minutes(2)));
  });

  it("explains the exhausted case in terms of attempts, wait, and what to check", () => {
    const message = renderYeetCheckRegistrationExhausted(YEET_CHECK_REGISTRATION_BACKOFF);
    expect(message).toContain("6 attempts");
    expect(message).toContain("path filters");
  });
});

// The wiring, not just the combinator: the monitor phase must route its check
// steps through the registration wrapper and keep the comment stream racing
// alongside. Driving `runMonitorPhaseForTesting` is what proves the seam in
// Handler.ts, which the combinator's own tests cannot reach.
const encoder = new TextEncoder();

const stubHandle = (exitCode: number, output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(output)),
    unref: Effect.succeed(Effect.void),
  });

const PR_VIEW_JSON = `{"number":558,"headRefName":"feat/yeet-monitor-hardening","state":"OPEN"}`;

/** Answers `gh pr view` and `gh api`; the check watch answers from `watch`. */
const monitorSpawnerLayer = (watch: { readonly exitCode: number; readonly output: string }) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.succeed(
      ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("the monitor phase never spawns a piped command");
        }
        const line = A.join([command.command, ...command.args], " ");
        if (Str.includes("pr view")(line)) {
          return Effect.succeed(stubHandle(0, PR_VIEW_JSON));
        }
        if (Str.includes("pr checks")(line)) {
          return Effect.succeed(stubHandle(watch.exitCode, watch.output));
        }
        return Effect.succeed(stubHandle(0, "[]"));
      })
    )
  );

const monitorSteps = (cwd: string): ReadonlyArray<RepoPlanStep> => [
  RepoPlanStep.make({
    id: "monitor:01-pr-context",
    label: "monitor:pr-context",
    phase: "monitor",
    command: "gh",
    args: ["pr", "view", "--json", "number,headRefName,state"],
    cwd,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
  }),
  RepoPlanStep.make({
    id: "monitor:02-pr-checks-watch",
    label: "monitor:pr-checks:watch",
    phase: "monitor",
    command: "gh",
    args: ["pr", "checks", "--watch"],
    cwd,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
  }),
];

const monitorPhaseContext = (root: string): RepoRunContext =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feat/yeet-monitor-hardening",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: root,
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

const withTempDirectory = Effect.fn("withTempDirectory")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(fs.makeTempDirectory(), use, (root) =>
    Effect.ignore(fs.remove(root, { recursive: true }))
  );
});

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

describe("the monitor phase check watch", () => {
  it.live("completes when the watch finds registered checks and they pass", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = monitorPhaseContext(root);
        const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());

        yield* runMonitorPhaseForTesting(context, monitorSteps(root), recorder, "yeet monitor failed.");

        // Both planned steps ran, and the comment stream did not decide the race.
        expect(A.map(yield* Ref.get(recorder), (executed) => executed.step.id)).toEqual([
          "monitor:01-pr-context",
          "monitor:02-pr-checks-watch",
        ]);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(PlatformLayer, monitorSpawnerLayer({ exitCode: 0, output: "All checks were successful" }))
      )
    )
  );

  it.live("fails a red watch immediately, without spending the registration backoff", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = monitorPhaseContext(root);
        const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());

        const error = yield* Effect.flip(
          runMonitorPhaseForTesting(context, monitorSteps(root), recorder, "yeet monitor failed.")
        );

        expect(error.message).toContain("yeet monitor failed.");
        // A red is about the code, so the registration story must stay out of it.
        expect(error.message).not.toContain("No checks registered");
        expect(error.exitCode).toBe(1);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          PlatformLayer,
          monitorSpawnerLayer({ exitCode: 1, output: "Some checks were not successful\n1 failing, 15 successful" })
        )
      )
    )
  );
});

// Greptile P1 on #738: the registration retry re-runs a recorder-mutating
// phase, so a first attempt that found no checks and a later attempt that
// passed both landed in the recorder. The verdict, the PR body, and
// `yeet status` all read that recorder, so one step id reported as failed AND
// passed — and status would print a repair command for a lane that passed.
const registrationThenSuccessSpawnerLayer = (callsRef: Ref.Ref<number>) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.succeed(
      ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("the check watch never spawns a piped command");
        }
        return Effect.map(
          Ref.updateAndGet(callsRef, (count) => count + 1),
          (call) =>
            call === 1
              ? stubHandle(1, "no checks reported on the 'feat/yeet-monitor-hardening' branch")
              : stubHandle(0, "All checks were successful")
        );
      })
    )
  );

describe("the monitor check watch recorder", () => {
  it.effect("records only the final attempt, never the attempt it retried", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = monitorPhaseContext(root);
        const callsRef = yield* Ref.make(0);
        const priorStep = YeetExecutedStep.make({
          durationMs: 1,
          result: RepoStepRunResult.make({
            stepId: "monitor:01-pr-context",
            commandText: "gh pr view",
            exitCode: 0,
          }),
          step: A.headNonEmpty(monitorSteps(root) as A.NonEmptyReadonlyArray<RepoPlanStep>),
        });
        const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([priorStep]);
        const checkSteps = A.filter(monitorSteps(root), (step) => step.id === "monitor:02-pr-checks-watch");

        yield* runMonitorCheckWatchForTesting(context, checkSteps, recorder, "yeet monitor failed.", [
          Duration.zero,
        ]).pipe(Effect.provide(registrationThenSuccessSpawnerLayer(callsRef)));

        const recorded = yield* Ref.get(recorder);
        const watchEntries = A.filter(recorded, (entry) => entry.step.id === "monitor:02-pr-checks-watch");
        expect(yield* Ref.get(callsRef)).toBe(2);
        // Exactly one entry for the retried step, carrying the attempt that won.
        expect(A.length(watchEntries)).toBe(1);
        expect(A.map(watchEntries, (entry) => entry.result.exitCode)).toEqual([0]);
        // The rewind must not eat entries recorded before the watch began.
        expect(A.length(A.filter(recorded, (entry) => entry.step.id === "monitor:01-pr-context"))).toBe(1);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});
