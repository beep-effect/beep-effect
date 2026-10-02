import { $RepoCliId } from "@beep/identity/packages";
import {
  acknowledgeYeetMonitorComments,
  collectNewYeetMonitorComments,
  defaultYeetRunOptions,
  loadYeetMonitorCommentWatermark,
  openYeetMonitorCommentStream,
  RepoRunContext,
  renderYeetMonitorCommentStreamStopped,
  replayYeetMonitorComments,
  runStatusModeForTesting,
  runYeetPullRequestCommentMonitor,
  salvageYeetMonitorClippedJson,
  YeetMonitorCommentCursor,
  YeetMonitorCommentState,
  YeetMonitorCommentStateJson,
  YeetMonitorCommentWatermark,
  yeetMonitorCommentStatePath,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Context, Duration, Effect, FileSystem, Layer, Path, Ref, Schedule, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const isStoppedPollMessage = S.is(
  S.String.check(
    S.isIncluding("PR comment streaming stopped", {
      identifier: "StoppedPollMessage",
      title: "Stopped poll message",
      description: "The captured diagnostic proving the failed poll reached its terminal streaming state.",
    })
  )
);

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
const $I = $RepoCliId.create("test/yeet-monitor-comment-stream");
class RecordedCommands extends Context.Service<RecordedCommands, Ref.Ref<ReadonlyArray<string>>>()(
  $I`RecordedCommands`
) {}
const RecordedCommandsLayer = Layer.effect(RecordedCommands, Ref.make<ReadonlyArray<string>>(A.empty()));

const recordingSpawnerLayer = (respond: (commandLine: string) => CommandStub) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.map(RecordedCommands, (commandsRef) =>
      ChildProcessSpawner.make((command) =>
        ChildProcess.isStandardCommand(command)
          ? Effect.map(
              Ref.updateAndGet(commandsRef, A.append(A.join([command.command, ...command.args], " "))),
              (commands) => stubHandle(respond(O.getOrElse(A.last(commands), () => Str.empty)))
            )
          : Effect.die("the comment monitor never spawns a piped command")
      )
    )
  ).pipe(Layer.provideMerge(RecordedCommandsLayer));

// `gh api --paginate --slurp` answers with one array OF PAGES, so every stub
// here wraps its rows in a page the way the real command does.
const pages = (rows: ReadonlyArray<unknown>): string => JSON.stringify([rows]);
const EMPTY_PAGE = pages([]);

const issueCommentJson = (id: number, createdAt: string): string =>
  pages([
    {
      body: "The hosted checks are green.",
      created_at: createdAt,
      html_url: `https://github.com/o/r/pull/${PR_NUMBER}#issuecomment-${id}`,
      id,
      user: { login: "octocat" },
    },
  ]);

const reviewCommentJson = (id: number, createdAt: string): string =>
  pages([
    {
      body: "Please add a regression test.",
      created_at: createdAt,
      html_url: `https://github.com/o/r/pull/${PR_NUMBER}#discussion_r${id}`,
      id,
      line: 88,
      original_line: 88,
      path: "src/Monitor.ts",
      user: { login: "greptile-apps[bot]" },
    },
  ]);

const reviewBodyJson = (id: number, submittedAt: string): string =>
  pages([
    {
      body: "**Actionable comments posted: 2**\n\n<summary>🧹 Nitpick comments (11)</summary>",
      html_url: `https://github.com/o/r/pull/${PR_NUMBER}#pullrequestreview-${id}`,
      id,
      state: "COMMENTED",
      submitted_at: submittedAt,
      user: { login: "coderabbitai[bot]" },
    },
  ]);

const endpointOf = (commandLine: string): "issues" | "reviews" | "review-comments" =>
  Str.includes("/issues/")(commandLine)
    ? "issues"
    : Str.includes("/reviews")(commandLine)
      ? "reviews"
      : "review-comments";

const commentEndpointStub = (commandLine: string): CommandStub =>
  endpointOf(commandLine) === "issues"
    ? { exitCode: 0, output: issueCommentJson(44, LATER_COMMENT_AT) }
    : { exitCode: 0, output: EMPTY_PAGE };

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

const makeTempDirectory = FileSystem.FileSystem.use((fs) => fs.makeTempDirectory());
const removeTempDirectory = Effect.fn("removeTempDirectory")((root: string) =>
  FileSystem.FileSystem.use((fs) => fs.remove(root, { recursive: true }))
);

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
    schemaVersion: "yeet-monitor-comments/v2",
    prNumber,
    updatedAt: createdAt,
    watermark: YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor, reviewBody: cursor }),
  });
};

// The literal shape a monitor session wrote before review bodies were streamed.
// Written as text on purpose: the v1 class is module-private, and this is what
// is actually sitting on disk in every lane that ran the previous build.
const stateTextV1 = (prNumber: number, createdAt: string, id: number): string =>
  JSON.stringify({
    schemaVersion: "yeet-monitor-comments/v1",
    prNumber,
    updatedAt: createdAt,
    watermark: { issue: { createdAt, id }, review: { createdAt, id } },
  });

const readStateText = Effect.fnUntraced(function* (context: RepoRunContext) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(yield* yeetMonitorCommentStatePath(context));
});

const PlatformLayer = Layer.mergeAll(BunCrypto.layer, MemoryFileSystem.layer, NodePath.layer);

// A7 (ship-velocity): the comment stream used to start both cursors at process
// start, so a comment posted while no monitor was attached was never printed by
// any run, and a single failed poll cancelled the check watcher it was raced
// against.
describe("yeet monitor comment cursor persistence", () => {
  it.layer(PlatformLayer, { timeout: "30 seconds" })((it) => {
    it.effect("has no position before a session has run", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            assertNone(yield* loadYeetMonitorCommentWatermark(monitorContext(root), PR_NUMBER));
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(PlatformLayer, { timeout: "30 seconds" })((it) => {
    it.effect("reads back a position written for the same pull request", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER, EARLIER_COMMENT_AT, 44));

            const watermark = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);

            assertSome(
              O.map(watermark, (mark) => mark.issue.createdAt),
              EARLIER_COMMENT_AT
            );
            assertSome(
              O.map(watermark, (mark) => mark.review.id),
              44
            );
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(PlatformLayer, { timeout: "30 seconds" })((it) => {
    it.effect("refuses a position recorded against a different pull request", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER + 1, EARLIER_COMMENT_AT, 44));

            assertNone(yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER));
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(PlatformLayer, { timeout: "30 seconds" })((it) => {
    it.effect("treats an unreadable position as no position rather than failing", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeStateText(context, "{ this is not the artifact }");

            assertNone(yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER));
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(Layer.mergeAll(PlatformLayer, recordingSpawnerLayer(commentEndpointStub)), { timeout: "30 seconds" })(
    (it) => {
      it.effect("persists the cursor only after every collected row has been emitted", () =>
        Effect.acquireUseRelease(
          makeTempDirectory,
          (root) =>
            Effect.gen(function* () {
              const context = monitorContext(root);
              yield* writeState(context, stateAt(PR_NUMBER, EARLIER_COMMENT_AT, 1));
              const watermarkRef = yield* openYeetMonitorCommentStream(context, PR_NUMBER);

              const comments = yield* collectNewYeetMonitorComments(context, PR_NUMBER, watermarkRef);

              expect(A.map(comments, (comment) => comment.id)).toStrictEqual([44]);
              expect((yield* Ref.get(watermarkRef)).issue.id).toBe(1);
              assertSome(
                O.map(yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER), (mark) => mark.issue.id),
                1
              );

              // Both monitor surfaces emit before they call this seam. If emission
              // is interrupted, this call never happens and the comment repeats on
              // the next session instead of disappearing behind a durable cursor.
              yield* acknowledgeYeetMonitorComments(context, PR_NUMBER, watermarkRef, comments);

              expect((yield* Ref.get(watermarkRef)).issue.id).toBe(44);
              assertSome(
                O.map(yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER), (mark) => mark.issue.id),
                44
              );
            }),
          removeTempDirectory
        )
      );
    }
  );

  it.layer(
    Layer.mergeAll(
      PlatformLayer,
      recordingSpawnerLayer(() => ({ exitCode: 0, output: EMPTY_PAGE }))
    ),
    { timeout: "30 seconds", excludeTestServices: true }
  )((it) => {
    it.effect("writes its starting position even when the pull request is quiet", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
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
            assertSome(
              O.map(persisted, (mark) => mark.issue.id),
              0
            );
            persisted.pipe(O.isSome, assertTrue);
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(Layer.mergeAll(PlatformLayer, recordingSpawnerLayer(commentEndpointStub)), {
    timeout: "30 seconds",
    excludeTestServices: true,
  })((it) => {
    it.effect("persists the cursor of a streamed comment, and resumes from it next run", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const commandsRef = yield* RecordedCommands;
            const context = monitorContext(root);
            // The session seeds its starting position immediately, so waiting for
            // the file to exist would race the comment; wait for the cursor to
            // reach the streamed comment instead.
            const streamed = Effect.map(loadYeetMonitorCommentWatermark(context, PR_NUMBER), (persisted) =>
              O.exists(persisted, (mark) => mark.issue.id === 44)
            );

            yield* Effect.raceFirst(until(streamed), runYeetPullRequestCommentMonitor(context, PR_NUMBER));

            const persisted = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
            assertSome(
              O.map(persisted, (mark) => mark.issue.id),
              44
            );
            assertSome(
              O.map(persisted, (mark) => mark.issue.createdAt),
              LATER_COMMENT_AT
            );

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
            assertSome(O.map(issuePoll, Str.includes(`since=${LATER_COMMENT_AT}`)), true);
          }),
        removeTempDirectory
      )
    );
  });
});

describe("yeet monitor comment poll failures", () => {
  it("names where comments can still be read once the stream gives up", () => {
    expect(renderYeetMonitorCommentStreamStopped(5)).toContain("yeet status --remote");
  });

  it.layer(Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(deniedStub)), {
    timeout: "30 seconds",
    excludeTestServices: true,
  })((it) => {
    it.effect("never cancels the check watcher it is raced against", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const commandsRef = yield* RecordedCommands;
            // Stands in for `gh pr checks --watch`: the effect the operator is
            // actually waiting on. Before this fix, the failing comment poll won
            // the race with an error and took this fiber down with it.
            const checkWatch = Effect.as(
              until(Effect.map(TestConsole.errorLines, (lines) => A.some(lines, isStoppedPollMessage))),
              "checks finished"
            );

            const winner = yield* Effect.raceFirst(
              checkWatch,
              runYeetPullRequestCommentMonitor(monitorContext(root), PR_NUMBER, 1)
            );

            expect(winner).toBe("checks finished");
            // It really did try, and really did fail: the race was survived, not skipped.
            expect(A.length(yield* Ref.get(commandsRef))).toBeGreaterThan(0);
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(deniedStub)), {
    timeout: "30 seconds",
    excludeTestServices: true,
  })((it) => {
    it.effect("surfaces every failed poll and says so when it stops streaming", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
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
          }),
        removeTempDirectory
      )
    );
  });
});

// R7 (reviewer follow-ups): a monitor that was never attached — a lane resumed
// after a reboot, an agent opening `yeet closeout` hours later — used to start
// every cursor at its own clock, so everything said in the gap was invisible to
// every surface. Replay is the one read that closes that gap.
describe("yeet monitor comment replay", () => {
  const MISSED_AT = "2026-08-16T12:00:00.000Z";
  const REVIEW_COMMENT_AT = "2026-08-16T12:30:00.000Z";
  const ISSUE_COMMENT_AT = "2026-08-16T12:31:00.000Z";
  const REVIEW_BODY_AT = "2026-08-16T12:32:00.000Z";

  const missedStub = (commandLine: string): CommandStub =>
    ({
      issues: { exitCode: 0, output: issueCommentJson(44, ISSUE_COMMENT_AT) },
      reviews: { exitCode: 0, output: reviewBodyJson(5275652920, REVIEW_BODY_AT) },
      "review-comments": { exitCode: 0, output: reviewCommentJson(43, REVIEW_COMMENT_AT) },
    })[endpointOf(commandLine)];

  it.layer(Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(missedStub)), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("replays what a stale v1 position missed, prints it, and upgrades to v2", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeStateText(context, stateTextV1(PR_NUMBER, MISSED_AT, 1));

            yield* replayYeetMonitorComments(context, PR_NUMBER);

            const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
            // The header quotes the position it read from, so an operator can tell
            // "nothing happened" apart from "the cursor was already past it".
            expect(printed).toContain(`comment replay: 3 comment(s) since ${MISSED_AT}`);
            expect(printed).toContain("new PR review comment: greptile-apps[bot] @ src/Monitor.ts:88");
            expect(printed).toContain("new PR issue comment: octocat");
            expect(printed).toContain("new PR review: coderabbitai[bot] (COMMENTED)");
            // The review body's structural signal is summarized, and named advisory
            // where it is printed so it is never read as a merge gate.
            expect(printed).toContain("coderabbit: 2 actionable, 11 nitpick(s), 0 outside diff (advisory)");

            const persisted = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
            assertSome(
              O.map(persisted, (mark) => mark.review.id),
              43
            );
            assertSome(
              O.map(persisted, (mark) => mark.issue.id),
              44
            );
            assertSome(
              O.map(persisted, (mark) => mark.reviewBody.id),
              5275652920
            );
            expect(yield* readStateText(context)).toContain("yeet-monitor-comments/v2");
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(Layer.mergeAll(PlatformLayer, recordingSpawnerLayer(missedStub)), { timeout: "30 seconds" })((it) => {
    it.effect("seeds a v1 review-body cursor from the earlier of the two it carried", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeStateText(context, stateTextV1(PR_NUMBER, MISSED_AT, 1));

            const persisted = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);

            // Nothing in a v1 artifact knows about review bodies, so the only seed
            // that cannot skip one is the furthest back it reaches.
            assertSome(
              O.map(persisted, (mark) => mark.reviewBody.createdAt),
              MISSED_AT
            );
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(missedStub)), {
    timeout: "30 seconds",
    excludeTestServices: true,
  })((it) => {
    it.effect("says so, and records a position, when the branch has none yet", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const commandsRef = yield* RecordedCommands;
            const context = monitorContext(root);

            yield* replayYeetMonitorComments(context, PR_NUMBER);

            const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
            expect(printed).toContain(`comment replay: no watermark for #${PR_NUMBER}; starting at`);
            // Nothing was read, because there was no "since" to read from — the
            // point of the line is that the NEXT open is the one that resumes.
            expect(A.length(yield* Ref.get(commandsRef))).toBe(0);
            (yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER)).pipe(O.isSome, assertTrue);
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(deniedStub)), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("keeps the saved position when the replay read fails", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER, MISSED_AT, 1));

            // A closeout must not exit non-zero because GitHub was briefly
            // unreachable while it tried to print old comments.
            yield* replayYeetMonitorComments(context, PR_NUMBER);

            const warnings = A.join(A.map(yield* TestConsole.errorLines, String), "\n");
            expect(warnings).toContain("comment replay unavailable");
            assertSome(
              O.map(yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER), (mark) => mark.issue.id),
              1
            );
          }),
        removeTempDirectory
      )
    );
  });
});

describe("yeet monitor comment truncation", () => {
  const FIRST_AT = "2026-08-16T12:30:00.000Z";
  const SECOND_AT = "2026-08-16T12:40:00.000Z";

  it("keeps the elements a clipped capture read in full", () => {
    expect(salvageYeetMonitorClippedJson('[[{"id":1}],[{"id":2')).toBe('[[{"id":1}]]');
    expect(salvageYeetMonitorClippedJson('[[{"id":1},{"id":2')).toBe('[[{"id":1}]]');
    expect(salvageYeetMonitorClippedJson('[[{"id":1}]]')).toBe('[[{"id":1}]]');
    // Nothing closed before the cut, so nothing can honestly be kept.
    expect(salvageYeetMonitorClippedJson('[[{"id":')).toBe("[]");
  });

  const clipped = JSON.stringify([
    [
      {
        body: "the one that fits",
        created_at: FIRST_AT,
        html_url: `https://github.com/o/r/pull/${PR_NUMBER}#issuecomment-1`,
        id: 1,
        user: { login: "octocat" },
      },
      {
        body: "x".repeat(600 * 1024),
        created_at: SECOND_AT,
        html_url: `https://github.com/o/r/pull/${PR_NUMBER}#issuecomment-2`,
        id: 2,
        user: { login: "octocat" },
      },
    ],
  ]);
  it.layer(
    Layer.mergeAll(
      PlatformLayer,
      TestConsole.layer,
      recordingSpawnerLayer((commandLine) =>
        endpointOf(commandLine) === "issues" ? { exitCode: 0, output: clipped } : { exitCode: 0, output: EMPTY_PAGE }
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("advances only to the last comment a clipped read decoded", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER, "2026-08-16T12:00:00.000Z", 0));
            const watermarkRef = yield* openYeetMonitorCommentStream(context, PR_NUMBER);

            const comments = yield* collectNewYeetMonitorComments(context, PR_NUMBER, watermarkRef);
            yield* acknowledgeYeetMonitorComments(context, PR_NUMBER, watermarkRef, comments);

            // A clipped read is no longer a failed read: what was read is streamed,
            // and the cursor stops at it so the rest repeats rather than vanishing.
            expect(A.map(comments, (comment) => comment.id)).toStrictEqual([1]);
            assertSome(
              O.map(yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER), (mark) => mark.issue.id),
              1
            );
            const warned = A.join(A.map(yield* TestConsole.errorLines, String), "\n");
            expect(warned).toContain("was clipped by the capture bound");
          }),
        removeTempDirectory
      )
    );
  });
});

// The replay is a side effect of the status *mode*, so `--json` suppressing it
// can only be proved by running the mode: a comment printed to stdout there
// would land inside the document the caller is parsing.
const statusPullRequestJson = JSON.stringify({
  headRefOid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  id: "PR_kwDOA",
  isDraft: false,
  labels: [],
  mergeStateStatus: "CLEAN",
  mergeable: "MERGEABLE",
  number: PR_NUMBER,
  reviewDecision: "APPROVED",
  state: "OPEN",
  url: `https://github.com/o/r/pull/${PR_NUMBER}`,
});

const statusThreadsJson = JSON.stringify({
  data: {
    node: {
      author: { login: "kriegcloud" },
      reviewThreads: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } },
    },
  },
});

const statusCommandStub = (commandLine: string): CommandStub =>
  Str.includes("pr view")(commandLine)
    ? { exitCode: 0, output: statusPullRequestJson }
    : Str.includes("api graphql")(commandLine)
      ? { exitCode: 0, output: statusThreadsJson }
      : Str.startsWith("gh ")(commandLine)
        ? { exitCode: 0, output: "[]" }
        : { exitCode: 0, output: Str.empty };

describe("yeet status comment replay", () => {
  it.layer(Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(statusCommandStub)), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("never replays the comment stream under --json", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const commandsRef = yield* RecordedCommands;
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER, EARLIER_COMMENT_AT, 0));

            yield* runStatusModeForTesting(
              context,
              defaultYeetRunOptions({ base: context.base, json: true, mode: "status", packetDir: root, remote: true })
            );

            const commands = yield* Ref.get(commandsRef);
            // The pull request was read — so the replay had a number to work with —
            // and none of the three comment endpoints was touched anyway.
            expect(A.some(commands, Str.includes("pr view"))).toBe(true);
            expect(A.filter(commands, Str.includes(`repos/{owner}/{repo}`))).toEqual([]);
            const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
            expect(printed).not.toContain("comment replay:");
          }),
        removeTempDirectory
      )
    );
  });
});
