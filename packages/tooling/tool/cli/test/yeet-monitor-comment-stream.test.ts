import {
  loadYeetMonitorCommentWatermark,
  RepoRunContext,
  renderYeetMonitorCommentStreamStopped,
  runYeetPullRequestCommentMonitor,
  YeetMonitorCommentCursor,
  YeetMonitorCommentState,
  YeetMonitorCommentStateJson,
  YeetMonitorCommentWatermark,
  yeetMonitorCommentStatePath,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, FileSystem, Layer, Path, Ref, Schedule, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const PR_NUMBER = 558;
const EARLIER_COMMENT_AT = "2026-08-16T12:00:00.000Z";
// A session with no saved position starts its cursors at wall-clock now, so a
// comment the stub means to be "new" has to be dated after the test runs.
const LATER_COMMENT_AT = "2099-01-01T00:00:00.000Z";
const encoder = new TextEncoder();

type CommandStub = {
  readonly exitCode: number;
  readonly output: string;
};

const stubHandle = (stub: CommandStub) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(stub.output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(stub.exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(stub.output)),
    unref: Effect.succeed(Effect.void),
  });

/** A spawner that records every command line and answers from one function. */
const recordingSpawnerLayer = (
  commandsRef: Ref.Ref<ReadonlyArray<string>>,
  respond: (commandLine: string) => CommandStub
) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.succeed(
      ChildProcessSpawner.make((command) =>
        ChildProcess.isStandardCommand(command)
          ? Effect.map(
              Ref.updateAndGet(commandsRef, A.append(A.join([command.command, ...command.args], " "))),
              (commands) => stubHandle(respond(O.getOrElse(A.last(commands), () => Str.empty)))
            )
          : Effect.die("the comment monitor never spawns a piped command")
      )
    )
  );

const issueCommentJson = (id: number, createdAt: string): string =>
  JSON.stringify([
    {
      body: "The hosted checks are green.",
      created_at: createdAt,
      html_url: `https://github.com/o/r/pull/${PR_NUMBER}#issuecomment-${id}`,
      id,
      user: { login: "octocat" },
    },
  ]);

const commentEndpointStub = (commandLine: string): CommandStub =>
  Str.includes("/issues/")(commandLine)
    ? { exitCode: 0, output: issueCommentJson(44, LATER_COMMENT_AT) }
    : { exitCode: 0, output: "[]" };

const deniedStub = (): CommandStub => ({ exitCode: 1, output: "gh: API rate limit exceeded" });

const monitorContext = (root: string): RepoRunContext =>
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

/**
 * Poll a condition until it holds, so a tick is awaited rather than timed.
 * Bounded so a broken expectation fails the test instead of hanging it.
 */
const until = <Failure, Requirements>(probe: Effect.Effect<boolean, Failure, Requirements>) =>
  Effect.repeat(probe, { until: (ready: boolean) => ready, schedule: Schedule.spaced(Duration.millis(5)) }).pipe(
    Effect.timeout(Duration.seconds(5))
  );

const writeStateText = Effect.fnUntraced(function* (context: RepoRunContext, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const statePath = yield* yeetMonitorCommentStatePath(context);
  yield* fs.makeDirectory(path.dirname(statePath), { recursive: true });
  yield* fs.writeFileString(statePath, text);
});

const writeState = Effect.fnUntraced(function* (context: RepoRunContext, state: YeetMonitorCommentState) {
  yield* writeStateText(context, yield* YeetMonitorCommentStateJson.encode(state));
});

const stateAt = (prNumber: number, createdAt: string, id: number): YeetMonitorCommentState => {
  const cursor = YeetMonitorCommentCursor.make({ createdAt, id });
  return YeetMonitorCommentState.make({
    schemaVersion: "yeet-monitor-comments/v1",
    prNumber,
    updatedAt: createdAt,
    watermark: YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor }),
  });
};

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

// A7 (ship-velocity): the comment stream used to start both cursors at process
// start, so a comment posted while no monitor was attached was never printed by
// any run, and a single failed poll cancelled the check watcher it was raced
// against.
describe("yeet monitor comment cursor persistence", () => {
  it.effect("has no position before a session has run", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        expect(yield* loadYeetMonitorCommentWatermark(monitorContext(root), PR_NUMBER)).toEqual(O.none());
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("reads back a position written for the same pull request", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = monitorContext(root);
        yield* writeState(context, stateAt(PR_NUMBER, EARLIER_COMMENT_AT, 44));

        const watermark = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);

        expect(O.map(watermark, (mark) => mark.issue.createdAt)).toEqual(O.some(EARLIER_COMMENT_AT));
        expect(O.map(watermark, (mark) => mark.review.id)).toEqual(O.some(44));
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("refuses a position recorded against a different pull request", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = monitorContext(root);
        yield* writeState(context, stateAt(PR_NUMBER + 1, EARLIER_COMMENT_AT, 44));

        expect(yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER)).toEqual(O.none());
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("treats an unreadable position as no position rather than failing", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = monitorContext(root);
        yield* writeStateText(context, "{ this is not the artifact }");

        expect(yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER)).toEqual(O.none());
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("writes its starting position even when the pull request is quiet", () => {
    const commandsRef = Ref.makeUnsafe<ReadonlyArray<string>>(A.empty());
    return withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = monitorContext(root);
        const fs = yield* FileSystem.FileSystem;
        const statePath = yield* yeetMonitorCommentStatePath(context);

        yield* Effect.raceFirst(until(fs.exists(statePath)), runYeetPullRequestCommentMonitor(context, PR_NUMBER));

        // Nothing was streamed, so the position is this session's own start —
        // and it exists, which is the point: a quiet run that left no position
        // would send the next run back to its own clock, straight past any
        // comment posted in between.
        const persisted = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
        expect(O.map(persisted, (mark) => mark.issue.id)).toEqual(O.some(0));
        expect(O.isSome(persisted)).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          PlatformLayer,
          recordingSpawnerLayer(commandsRef, () => ({ exitCode: 0, output: "[]" }))
        )
      )
    );
  });

  it.live("persists the cursor of a streamed comment, and resumes from it next run", () => {
    // Both runs share one recorder because one spawner is provided once, at the
    // test's edge; the second run's commands are the ones recorded after the
    // first run ended.
    const commandsRef = Ref.makeUnsafe<ReadonlyArray<string>>(A.empty());
    return withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = monitorContext(root);
        // The session seeds its starting position immediately, so waiting for
        // the file to exist would race the comment; wait for the cursor to
        // reach the streamed comment instead.
        const streamed = Effect.map(loadYeetMonitorCommentWatermark(context, PR_NUMBER), (persisted) =>
          O.exists(persisted, (mark) => mark.issue.id === 44)
        );

        yield* Effect.raceFirst(until(streamed), runYeetPullRequestCommentMonitor(context, PR_NUMBER));

        const persisted = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
        expect(O.map(persisted, (mark) => mark.issue.id)).toEqual(O.some(44));
        expect(O.map(persisted, (mark) => mark.issue.createdAt)).toEqual(O.some(LATER_COMMENT_AT));

        // The second run must ask GitHub for everything since the saved
        // position — not since its own start — or a comment posted between the
        // two runs is invisible to both.
        const firstRunCommandCount = A.length(yield* Ref.get(commandsRef));
        yield* Effect.raceFirst(
          until(Effect.map(Ref.get(commandsRef), (commands) => A.length(commands) >= firstRunCommandCount + 2)),
          runYeetPullRequestCommentMonitor(context, PR_NUMBER)
        );

        const secondRunCommands = A.drop(yield* Ref.get(commandsRef), firstRunCommandCount);
        const issuePoll = A.findFirst(secondRunCommands, Str.includes("/issues/"));
        expect(O.map(issuePoll, Str.includes(`since=${LATER_COMMENT_AT}`))).toEqual(O.some(true));
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, recordingSpawnerLayer(commandsRef, commentEndpointStub))));
  });
});

describe("yeet monitor comment poll failures", () => {
  it("names where comments can still be read once the stream gives up", () => {
    expect(renderYeetMonitorCommentStreamStopped(5)).toContain("yeet status --remote");
  });

  it.live("never cancels the check watcher it is raced against", () => {
    const commandsRef = Ref.makeUnsafe<ReadonlyArray<string>>(A.empty());
    return withTempDirectory((root) =>
      Effect.gen(function* () {
        // Stands in for `gh pr checks --watch`: the effect the operator is
        // actually waiting on. Before this fix, the failing comment poll won
        // the race with an error and took this fiber down with it.
        const checkWatch = Effect.as(Effect.sleep(Duration.millis(30)), "checks finished");

        const winner = yield* Effect.raceFirst(
          checkWatch,
          runYeetPullRequestCommentMonitor(monitorContext(root), PR_NUMBER, 1)
        );

        expect(winner).toBe("checks finished");
        // It really did try, and really did fail: the race was survived, not skipped.
        expect(A.length(yield* Ref.get(commandsRef))).toBeGreaterThan(0);
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, recordingSpawnerLayer(commandsRef, deniedStub))));
  });

  it.live("surfaces every failed poll and says so when it stops streaming", () => {
    const commandsRef = Ref.makeUnsafe<ReadonlyArray<string>>(A.empty());
    return withTempDirectory((root) =>
      Effect.gen(function* () {
        yield* Effect.raceFirst(
          until(
            Effect.map(TestConsole.errorLines, (lines) =>
              A.some(lines, (line) => Str.includes("stopped after")(String(line)))
            )
          ),
          runYeetPullRequestCommentMonitor(monitorContext(root), PR_NUMBER, 1)
        );

        const errors = A.map(yield* TestConsole.errorLines, String);
        // Each failed tick is reported with gh's own words, numbered against
        // the bound, and says the checks are still being watched.
        expect(A.some(errors, Str.includes("API rate limit exceeded"))).toBe(true);
        expect(A.some(errors, Str.includes("PR comment poll failed (1/1)"))).toBe(true);
        expect(A.some(errors, Str.includes("Check watching is unaffected"))).toBe(true);
        expect(A.some(errors, Str.includes("PR comment streaming stopped"))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(commandsRef, deniedStub))
      )
    );
  });
});
