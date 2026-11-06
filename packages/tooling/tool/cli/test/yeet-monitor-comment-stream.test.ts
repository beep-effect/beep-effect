import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  acknowledgeYeetMonitorComments,
  collectNewYeetMonitorComments,
  defaultYeetRunOptions,
  loadYeetMonitorCommentWatermark,
  openYeetMonitorCommentStream,
  RepoRunContext,
  ReviewBodyGreptile,
  readYeetReviewLaneLedger,
  renderYeetMonitorCommentReplay,
  renderYeetMonitorCommentStateWarning,
  renderYeetMonitorCommentStreamStopped,
  renderYeetMonitorReviewBodySignal,
  replayYeetMonitorComments,
  replayYeetMonitorCommentsAsGhLogin,
  runStatusModeForTesting,
  runYeetPullRequestCommentMonitor,
  YeetMonitorCommentCursor,
  YeetMonitorCommentState,
  YeetMonitorCommentStateJson,
  YeetMonitorCommentWatermark,
  YeetReviewBodyFindingCounts,
  yeetMonitorCommentStatePath,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { githubCallLine, legacyGhGithubLayer, legacyGhLayer, recordedGithub } from "./support/YeetGithub.ts";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

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
type CommandStub = {
  readonly exitCode: number;
  readonly output: string;
};

/** A spawner that records every command line and answers from one function. */
const $I = $RepoCliId.create("test/yeet-monitor-comment-stream");
class RecordedCommands extends Context.Service<RecordedCommands, Effect.Effect<ReadonlyArray<string>>>()(
  $I`RecordedCommands`
) {}

const recordingSpawnerLayer = (respond: (commandLine: string) => CommandStub) =>
  Layer.provideMerge(
    Git.layer,
    Layer.suspend(() => {
      const spawner = ScriptedSpawner.make((command, args) => {
        const stub = respond(A.join([command, ...args], " "));
        return { stdout: stub.output, exit: stub.exitCode };
      });
      const commandLines = Effect.sync(() =>
        A.map(spawner.spawns, (spawn) => A.join([spawn.command, ...spawn.args], " "))
      );
      // The kit's comment reads reach the spawner as the `gh api` argv they replaced (W6).
      return Layer.provideMerge(
        legacyGhLayer,
        Layer.mergeAll(spawner.layer, Layer.succeed(RecordedCommands, commandLines), BunCrypto.layer)
      );
    })
  );

// `gh api --paginate --slurp` answered with one array OF PAGES; the stubs keep
// that shape, and the legacy transport folds the pages back into GitHub's one.
const pages = (rows: ReadonlyArray<unknown>): string => encodeJson([rows]);
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
  const encodedState = yield* YeetMonitorCommentStateJson.encode(state);
  yield* writeStateText(context, encodedState);
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
  encodeJson({
    schemaVersion: "yeet-monitor-comments/v1",
    prNumber,
    updatedAt: createdAt,
    watermark: { issue: { createdAt, id }, review: { createdAt, id } },
  });

const readStateText = Effect.fnUntraced(function* (context: RepoRunContext) {
  const fs = yield* FileSystem.FileSystem;
  const statePath = yield* yeetMonitorCommentStatePath(context);
  return yield* fs.readFileString(statePath);
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
            const watermark = yield* loadYeetMonitorCommentWatermark(monitorContext(root), PR_NUMBER);
            assertNone(watermark);
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

            const watermark2 = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
            assertNone(watermark2);
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

            const watermark3 = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
            assertNone(watermark3);
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
              const watermark4 = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
              assertSome(
                O.map(watermark4, (mark) => mark.issue.id),
                1
              );

              // Both monitor surfaces emit before they call this seam. If emission
              // is interrupted, this call never happens and the comment repeats on
              // the next session instead of disappearing behind a durable cursor.
              yield* acknowledgeYeetMonitorComments(context, PR_NUMBER, watermarkRef, comments);

              expect((yield* Ref.get(watermarkRef)).issue.id).toBe(44);
              const watermark5 = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
              assertSome(
                O.map(watermark5, (mark) => mark.issue.id),
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
            const recordedCommands = yield* RecordedCommands;
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
            const commands8 = yield* recordedCommands;
            const firstRunCommandCount = A.length(commands8);
            yield* recordedCommands.pipe(
              Effect.map((commands) => A.length(commands) >= firstRunCommandCount + 2),
              until,
              Effect.raceFirst(runYeetPullRequestCommentMonitor(context, PR_NUMBER))
            );

            const commands9 = yield* recordedCommands;
            const secondRunCommands = A.drop(commands9, firstRunCommandCount);
            const issuePoll = A.findFirst(secondRunCommands, Str.includes("/issues/"));
            // The kit sends `since` as a query parameter, percent-encoded.
            assertSome(O.map(issuePoll, Str.includes(`since=${encodeURIComponent(LATER_COMMENT_AT)}`)), true);
          }),
        removeTempDirectory
      )
    );
  });
});

describe("yeet monitor comment lines", () => {
  it("names a replay with nothing new, a cursor it could not persist, and a Greptile round", () => {
    expect(renderYeetMonitorCommentReplay(0, "2026-08-16T12:00:00.000Z")).toBe(
      "[yeet] comment replay: nothing new since 2026-08-16T12:00:00.000Z"
    );
    expect(renderYeetMonitorCommentStateWarning("disk is full")).toContain(
      "could not persist the PR comment cursor (disk is full)"
    );
    assertSome(
      renderYeetMonitorReviewBodySignal(
        ReviewBodyGreptile.make({
          signal: "greptile",
          newFindings: YeetReviewBodyFindingCounts.make({ p0: 0, p1: 1, p2: 2 }),
        })
      ),
      "greptile: confidence unknown, new P0:0 P1:1 P2:2 (advisory)"
    );
  });
});

describe("yeet monitor comment poll failures", () => {
  it("names where comments can still be read once the stream gives up", () => {
    expect(renderYeetMonitorCommentStreamStopped(5)).toContain("yeet status --remote");
  });

  it.layer(
    Layer.provideMerge(Git.layer, Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(deniedStub))),
    {
      timeout: "30 seconds",
      excludeTestServices: true,
    }
  )((it) => {
    it.effect("never cancels the check watcher it is raced against", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const recordedCommands = yield* RecordedCommands;
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
            const commands10 = yield* recordedCommands;
            expect(A.length(commands10)).toBeGreaterThan(0);
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(
    Layer.provideMerge(Git.layer, Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(deniedStub))),
    {
      timeout: "30 seconds",
      excludeTestServices: true,
    }
  )((it) => {
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

            const errorLines = yield* TestConsole.errorLines;
            const errors = A.map(errorLines, String);
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

  it.layer(
    Layer.provideMerge(Git.layer, Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(missedStub))),
    {
      timeout: "30 seconds",
    }
  )((it) => {
    it.effect("replays what a stale v1 position missed, prints it, and upgrades to v2", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeStateText(context, stateTextV1(PR_NUMBER, MISSED_AT, 1));

            yield* replayYeetMonitorComments(context, PR_NUMBER);

            const logLines = yield* TestConsole.logLines;
            const printed = A.join(A.map(logLines, String), "\n");
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
            const persistedText = yield* readStateText(context);
            expect(persistedText).toContain("yeet-monitor-comments/v2");
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

  it.layer(
    Layer.provideMerge(Git.layer, Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(missedStub))),
    {
      timeout: "30 seconds",
      excludeTestServices: true,
    }
  )((it) => {
    it.effect("says so, and records a position, when the branch has none yet", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const recordedCommands = yield* RecordedCommands;
            const context = monitorContext(root);

            yield* replayYeetMonitorComments(context, PR_NUMBER);

            const logLines2 = yield* TestConsole.logLines;
            const printed = A.join(A.map(logLines2, String), "\n");
            expect(printed).toContain(`comment replay: no watermark for #${PR_NUMBER}; starting at`);
            // Nothing was read, because there was no "since" to read from — the
            // point of the line is that the NEXT open is the one that resumes.
            const commands15 = yield* recordedCommands;
            expect(A.length(commands15)).toBe(0);
            (yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER)).pipe(O.isSome, assertTrue);
          }),
        removeTempDirectory
      )
    );
  });

  it.layer(
    Layer.provideMerge(Git.layer, Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(deniedStub))),
    {
      timeout: "30 seconds",
    }
  )((it) => {
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

            const errorLines2 = yield* TestConsole.errorLines;
            const warnings = A.join(A.map(errorLines2, String), "\n");
            expect(warnings).toContain("comment replay unavailable");
            const watermark6 = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
            assertSome(
              O.map(watermark6, (mark) => mark.issue.id),
              1
            );
          }),
        removeTempDirectory
      )
    );
  });
});

describe("yeet monitor comment replay as the gh login", () => {
  const MISSED_AT = "2026-08-16T12:00:00.000Z";
  const missedIssueStub = (commandLine: string): CommandStub =>
    endpointOf(commandLine) === "issues"
      ? { exitCode: 0, output: issueCommentJson(44, "2026-08-16T12:31:00.000Z") }
      : { exitCode: 0, output: EMPTY_PAGE };

  it.layer(
    Layer.provideMerge(
      Git.layer,
      Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(missedIssueStub))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("replays through the operator's gh login", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER, MISSED_AT, 1));
            yield* replayYeetMonitorCommentsAsGhLogin(context, PR_NUMBER);
            const logLines3 = yield* TestConsole.logLines;
            const printed = A.join(A.map(logLines3, String), "\n");
            expect(printed).toContain("comment replay: 1 comment(s)");
            const watermark7 = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
            assertSome(
              O.map(watermark7, (mark) => mark.issue.id),
              44
            );
          }),
        removeTempDirectory
      )
    );
  });

  // No suite login and a `gh` that answers nothing: the login does not build.
  it.layer(
    Layer.provideMerge(
      Git.layer,
      Layer.mergeAll(PlatformLayer, TestConsole.layer, ScriptedSpawner.make(() => ({ exit: 1 })).layer)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("reports a login that does not build as an unavailable replay and keeps the position", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER, MISSED_AT, 1));
            yield* replayYeetMonitorCommentsAsGhLogin(context, PR_NUMBER);
            const errorLines3 = yield* TestConsole.errorLines;
            const warnings = A.join(A.map(errorLines3, String), "\n");
            expect(warnings).toContain("comment replay unavailable: GitHub access failed (");
            const watermark8 = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
            assertSome(
              O.map(watermark8, (mark) => mark.issue.id),
              1
            );
          }),
        removeTempDirectory
      )
    );
  });
});

describe("yeet monitor comment long reads", () => {
  const FIRST_AT = "2026-08-16T12:30:00.000Z";
  const SECOND_AT = "2026-08-16T12:40:00.000Z";
  const issueComment = (id: number, createdAt: string, body: string) => ({
    body,
    created_at: createdAt,
    html_url: `https://github.com/o/r/pull/${PR_NUMBER}#issuecomment-${id}`,
    id,
    user: { login: "octocat" },
  });
  // The kit reads every page whole, so a comment past the old capture bound is
  // streamed like any other and nothing is clipped (W6).
  const github = recordedGithub((call) =>
    Str.includes("/issues/")(call.path)
      ? {
          body: [
            issueComment(1, FIRST_AT, "the one that used to fit"),
            issueComment(2, SECOND_AT, Str.repeat(600 * 1024)("x")),
          ],
        }
      : { body: [] }
  );
  it.layer(
    Layer.provideMerge(
      Git.layer,
      Layer.mergeAll(PlatformLayer, TestConsole.layer, ScriptedSpawner.make(() => ({ exit: 1 })).layer)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("streams a comment past the old capture bound and advances the cursor to it", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER, "2026-08-16T12:00:00.000Z", 0));
            const watermarkRef = yield* openYeetMonitorCommentStream(context, PR_NUMBER);

            const comments = yield* collectNewYeetMonitorComments(context, PR_NUMBER, watermarkRef);
            yield* acknowledgeYeetMonitorComments(context, PR_NUMBER, watermarkRef, comments);

            expect(A.map(comments, (comment) => comment.id)).toStrictEqual([1, 2]);
            const watermark9 = yield* loadYeetMonitorCommentWatermark(context, PR_NUMBER);
            assertSome(
              O.map(watermark9, (mark) => mark.issue.id),
              2
            );
            const errorLines4 = yield* TestConsole.errorLines;
            expect(A.join(A.map(errorLines4, String), "\n")).not.toContain("clipped");
            expect(A.map(github.calls, githubCallLine)).toContain(`GET {repo}/issues/${PR_NUMBER}/comments`);
          }).pipe(github.provide),
        removeTempDirectory
      )
    );
  });
});

// The replay is a side effect of the status *mode*, so `--json` suppressing it
// can only be proved by running the mode: a comment printed to stdout there
// would land inside the document the caller is parsing.
const statusPullRequestJson = encodeJson({
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

const statusThreadsJson = encodeJson({
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
  it.layer(
    Layer.provideMerge(
      legacyGhGithubLayer,
      Layer.provideMerge(
        Git.layer,
        Layer.mergeAll(PlatformLayer, TestConsole.layer, recordingSpawnerLayer(statusCommandStub))
      )
    ),
    {
      timeout: "30 seconds",
    }
  )((it) => {
    it.effect("never replays the comment stream under --json", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const recordedCommands = yield* RecordedCommands;
            const context = monitorContext(root);
            yield* writeState(context, stateAt(PR_NUMBER, EARLIER_COMMENT_AT, 0));

            yield* runStatusModeForTesting(
              context,
              defaultYeetRunOptions({ base: context.base, json: true, mode: "status", packetDir: root, remote: true })
            );

            const commands = yield* recordedCommands;
            // The pull request was read — so the replay had a number to work with —
            // and none of the three comment endpoints was touched anyway.
            expect(A.some(commands, Str.includes("pr view"))).toBe(true);
            expect(A.filter(commands, Str.includes(`repos/{owner}/{repo}`))).toEqual([]);
            const logLines4 = yield* TestConsole.logLines;
            const printed = A.join(A.map(logLines4, String), "\n");
            expect(printed).not.toContain("comment replay:");
          }),
        removeTempDirectory
      )
    );
  });
});

// Ruling 81: the reviews the poll reads are the review lane's source. A
// body-less approval is dropped by the stream (nothing to print) and must
// still reach the ledger; a pending review is not an event yet; a second poll
// that reads the same reviews writes nothing new.
describe("yeet monitor review lane recording", () => {
  const REVIEWED_AT = "2099-01-02T00:00:00.000Z";
  const REVIEWED_SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const REVIEWED_SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const reviewsStub = (commandLine: string): CommandStub =>
    endpointOf(commandLine) === "reviews"
      ? {
          exitCode: 0,
          output: pages([
            {
              body: "**Actionable comments posted: 1**",
              commit_id: REVIEWED_SHA_A,
              html_url: `https://github.com/o/r/pull/${PR_NUMBER}#pullrequestreview-1`,
              id: 1,
              state: "COMMENTED",
              submitted_at: REVIEWED_AT,
              user: { login: "coderabbitai[bot]", type: "Bot" },
            },
            {
              body: null,
              commit_id: REVIEWED_SHA_B,
              html_url: `https://github.com/o/r/pull/${PR_NUMBER}#pullrequestreview-2`,
              id: 2,
              state: "APPROVED",
              submitted_at: REVIEWED_AT,
              user: { login: "octocat", type: "User" },
            },
            {
              body: "still typing",
              commit_id: null,
              html_url: `https://github.com/o/r/pull/${PR_NUMBER}#pullrequestreview-3`,
              id: 3,
              state: "PENDING",
              submitted_at: null,
              user: { login: "octocat", type: "User" },
            },
          ]),
        }
      : { exitCode: 0, output: EMPTY_PAGE };

  it.layer(Layer.mergeAll(PlatformLayer, recordingSpawnerLayer(reviewsStub)), { timeout: "30 seconds" })((it) => {
    it.effect("records every submitted review once, body or not, while the stream prints only the body", () =>
      Effect.acquireUseRelease(
        makeTempDirectory,
        (root) =>
          Effect.gen(function* () {
            const context = monitorContext(root);
            const watermarkRef = yield* openYeetMonitorCommentStream(context, PR_NUMBER);

            const comments = yield* collectNewYeetMonitorComments(context, PR_NUMBER, watermarkRef);
            // Not acknowledged, so the next poll reads the same reviews again.
            const again = yield* collectNewYeetMonitorComments(context, PR_NUMBER, watermarkRef);

            expect(A.map(comments, (comment) => comment.id)).toStrictEqual([1]);
            expect(A.map(again, (comment) => comment.id)).toStrictEqual([1]);
            const ledger = yield* readYeetReviewLaneLedger(root);
            expect(ledger.unreadable).toBe(false);
            expect(
              A.map(ledger.rows, (row) =>
                row._tag === "review"
                  ? [row.reviewId, row.reviewer.kind, O.getOrNull(row.commitSha), row.state, row.prNumber]
                  : [row._tag]
              )
            ).toEqual([
              [1, "coderabbit", REVIEWED_SHA_A, "COMMENTED", PR_NUMBER],
              [2, "human", REVIEWED_SHA_B, "APPROVED", PR_NUMBER],
            ]);
          }),
        removeTempDirectory
      )
    );
  });
});
