import { HEAVY_ADMISSION_LABEL } from "@beep/repo-cli/commands/Ci";
import {
  collectYeetWatchSnapshot,
  GreptileSummary,
  loadYeetRemediationWave,
  PrCloseoutReport,
  PrCloseoutReportJson,
  RepoRunContext,
  runArtifactPathForContext,
  runYeetWatchStream,
  YeetCommandError,
  YeetInboxRowJson,
  YeetMonitorCommentStateJson,
  YeetRulesetRequiredContexts,
  YeetWatchEnded,
  YeetWatchEvent,
  yeetInboxPaths,
  yeetMonitorCommentStatePath,
  yeetWatchExitFailure,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { YeetCheckFailedRow } from "@beep/repo-cli/test/Yeet";

const decodeUnknownYeetWatchEventJson = S.decodeUnknownEffect(S.fromJsonString(YeetWatchEvent));

const contextFor = (repoRoot: string): RepoRunContext =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/watch",
    cwd: repoRoot,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

const context = contextFor(".");

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

interface ScriptedAnswer {
  readonly exitCode: number;
  readonly output: string;
}

/**
 * The answers one watch tick reads, in spawn order: the three snapshot
 * collections plus the two comment-collection polls that follow them. Comment
 * answers default to an empty collection so pre-comment-stream scripts stay
 * terse.
 */
interface PollScript {
  readonly checks: ScriptedAnswer;
  readonly issueComments?: ScriptedAnswer;
  readonly requiredChecks?: ScriptedAnswer;
  readonly reviewComments?: ScriptedAnswer;
  readonly threads: ScriptedAnswer;
  readonly view: ScriptedAnswer;
}

const viewJson = (
  state: string,
  headSha: string,
  mergeStateStatus = "CLEAN",
  reviewDecision: string | null = null,
  labels: ReadonlyArray<string> = []
): string =>
  JSON.stringify({
    headRefOid: headSha,
    id: "PR_watch",
    isDraft: false,
    labels: A.map(labels, (name) => ({ name, color: "0e8a16" })),
    mergeable: "MERGEABLE",
    mergeStateStatus,
    number: 751,
    reviewDecision,
    state,
  });
// The merge-base diff the scripted git answers; code-bearing unless a test says otherwise.
const codeDiff = "packages/a/src/index.ts\n";

interface CheckRowFixture {
  readonly bucket: string;
  readonly link?: string;
  readonly name: string;
  readonly state: string;
  readonly workflow?: string;
}

const checksJson = (rows: ReadonlyArray<CheckRowFixture>) =>
  JSON.stringify(
    A.map(rows, (row) => ({
      bucket: row.bucket,
      link: row.link ?? "https://github.com/beep/beep/actions/runs/1/job/2",
      name: row.name,
      state: row.state,
      workflow: row.workflow ?? "CI",
    }))
  );

const threadsJson = (
  nodes: ReadonlyArray<{ readonly id: string; readonly isResolved: boolean }>,
  pageInfo: { readonly endCursor: string | null; readonly hasNextPage: boolean } = {
    endCursor: null,
    hasNextPage: false,
  }
) => JSON.stringify({ data: { node: { reviewThreads: { nodes, pageInfo } } } });

const emptyCollection: ScriptedAnswer = { exitCode: 0, output: "[]" };

// One scripted answer set per poll. Each command family keeps its own served
// count, because the comment polls run *after* the tick's GraphQL thread read:
// a single shared cursor advanced by the thread read would hand the comment
// polls the NEXT tick's script.
const scriptedSpawnerLayer = (scripts: ReadonlyArray<PollScript>, diff: string = codeDiff) =>
  Layer.mergeAll(
    PlatformLayer,
    Layer.effect(
      ChildProcessSpawner.ChildProcessSpawner,
      Effect.gen(function* () {
        const threadsServed = yield* Ref.make(0);
        const reviewServed = yield* Ref.make(0);
        const issueServed = yield* Ref.make(0);
        const scriptAt = (index: number): PollScript => scripts[Math.min(index, A.length(scripts) - 1)] as PollScript;
        return ChildProcessSpawner.make((command) => {
          if (!ChildProcess.isStandardCommand(command)) {
            return Effect.die("the watch never spawns a piped command");
          }
          const line = A.join([command.command, ...command.args], " ");
          // fallow-ignore-next-line complexity -- Scripted command router preserves independent per-family poll cursors.
          return Effect.gen(function* () {
            if (Str.includes("rules/branches/")(line)) return stubHandle(1, "rules unavailable");
            // The once-per-head merge-base diff owns no poll index: it answers by argv prefix.
            if (command.command === "git" && command.args[0] === "diff" && command.args[1] === "--name-only")
              return stubHandle(0, diff);
            if (Str.includes("pulls/751/comments")(line)) {
              const answer = scriptAt(yield* Ref.getAndUpdate(reviewServed, (value) => value + 1));
              const review = answer.reviewComments ?? emptyCollection;
              return stubHandle(review.exitCode, review.output);
            }
            if (Str.includes("issues/751/comments")(line)) {
              const answer = scriptAt(yield* Ref.getAndUpdate(issueServed, (value) => value + 1));
              const issue = answer.issueComments ?? emptyCollection;
              return stubHandle(issue.exitCode, issue.output);
            }
            const script = scriptAt(yield* Ref.get(threadsServed));
            if (Str.includes("pr view")(line)) {
              return stubHandle(script.view.exitCode, script.view.output);
            }
            if (Str.includes("pr checks")(line)) {
              const checks = A.contains(command.args, "--required")
                ? (script.requiredChecks ?? script.checks)
                : script.checks;
              return stubHandle(checks.exitCode, checks.output);
            }
            yield* Ref.update(threadsServed, (value) => value + 1);
            return stubHandle(script.threads.exitCode, script.threads.output);
          });
        });
      })
    )
  );

const greenScript = (headSha: string, labels: ReadonlyArray<string> = []): PollScript => ({
  view: { exitCode: 0, output: viewJson("OPEN", headSha, "CLEAN", null, labels) },
  checks: { exitCode: 0, output: checksJson([{ bucket: "pass", name: "Check", state: "SUCCESS" }]) },
  threads: { exitCode: 0, output: threadsJson([]) },
});

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(
  FileSystemLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer))
);

// Watch runs in a disposable checkout root, because dispatching reds writes
// the inbox and the wave record under `<repoRoot>/.beep/inbox/`.
const inTempRepo = Effect.fn("inTempRepo")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(fs.makeTempDirectory(), use, (root) =>
    Effect.ignore(fs.remove(root, { recursive: true }))
  );
});

const readInboxRows = Effect.fn("readInboxRows")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(root);
  const text = yield* Effect.option(fs.readFileString(paths.failuresPath));
  const lines = O.match(text, {
    onNone: () => A.empty<string>(),
    onSome: (value) => A.filter(Str.split(value, "\n"), Str.isNonEmpty),
  });
  return yield* Effect.forEach(lines, (line) => YeetInboxRowJson.decode(line));
});

describe("collectYeetWatchSnapshot", () => {
  it.effect("decodes, classifies, and keeps each check's own record", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetWatchSnapshot(context);

      expect(snapshot.headSha).toBe("aaa111");
      expect(snapshot.state).toBe("OPEN");
      expect(snapshot.prNumber).toBe(751);
      expect(A.map(snapshot.checks, (check) => check.outcome)).toEqual(["pending", "fail"]);
      expect(A.map(snapshot.threads, (thread) => thread.isResolved)).toEqual([false]);

      // The failing check keeps its own record for capsule derivation; a
      // plain commit status's empty link/workflow read as null, not "".
      const failing = snapshot.checks[1];
      expect(failing?.link).toBe("https://github.com/beep/beep/actions/runs/9/job/9");
      expect(failing?.workflow).toBe("Check");
      expect(failing?.signal.bucket).toBe("fail");
      expect(failing?.signal.state).toBe("FAILURE");
      expect(snapshot.checks[0]?.link).toBeNull();
      expect(snapshot.checks[0]?.workflow).toBeNull();
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111", "CLEAN", "APPROVED") },
            checks: {
              exitCode: 0,
              output: checksJson([
                { bucket: "pending", link: "", name: "Coverage", state: "IN_PROGRESS", workflow: "" },
                {
                  bucket: "fail",
                  link: "https://github.com/beep/beep/actions/runs/9/job/9",
                  name: "Lint",
                  state: "FAILURE",
                  workflow: "Check",
                },
              ]),
            },
            threads: { exitCode: 0, output: threadsJson([{ id: "T1", isResolved: false }]) },
          },
        ])
      )
    )
  );

  it.effect("treats gh's empty review decision as absent", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetWatchSnapshot(context);

      expect(snapshot.criteria.reviewDecisionAcceptable).toBe(true);
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111", "CLEAN", "") },
            checks: { exitCode: 0, output: checksJson([{ bucket: "pass", name: "Check", state: "SUCCESS" }]) },
            threads: { exitCode: 0, output: threadsJson([]) },
          },
        ])
      )
    )
  );

  it.effect("paginates past 100 review threads before computing resolution", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetWatchSnapshot(context);

      expect(snapshot.threads).toHaveLength(101);
      expect(snapshot.criteria.threadsResolved).toBe(false);
      expect(snapshot.threads[100]).toMatchObject({ id: "T101", isResolved: false });
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111", "CLEAN", "CHANGES_REQUESTED") },
            checks: { exitCode: 0, output: checksJson([{ bucket: "pass", name: "Check", state: "SUCCESS" }]) },
            threads: {
              exitCode: 0,
              output: threadsJson(
                A.makeBy(100, (index) => ({ id: `T${index + 1}`, isResolved: true })),
                { endCursor: "cursor-100", hasNextPage: true }
              ),
            },
          },
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
            checks: { exitCode: 0, output: checksJson([]) },
            threads: { exitCode: 0, output: threadsJson([{ id: "T101", isResolved: false }]) },
          },
        ])
      )
    )
  );

  it.live("binds merge readiness to a closeout for the observed head", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const subjectContext = contextFor(root);
        const closeoutPath = yield* runArtifactPathForContext(subjectContext, "pr-closeout.json");
        yield* fs.makeDirectory(closeoutPath.slice(0, closeoutPath.lastIndexOf("/")), { recursive: true });
        const report = PrCloseoutReport.make({
          actionableReviewThreadCount: 0,
          botCommentCount: 1,
          greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
          issueCount: 0,
          issues: [],
          prNumber: 751,
          prUrl: "https://github.com/beep/beep/pull/751",
          reviewedHeadSha: O.some("aaa111"),
          retriggeredGreptile: false,
          schemaVersion: "yeet-pr-closeout/v1",
        });
        yield* fs.writeFileString(closeoutPath, yield* PrCloseoutReportJson.encode(report));

        const snapshot = yield* collectYeetWatchSnapshot(subjectContext);

        expect(snapshot.criteria.closeoutRun).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pass", name: "Check", state: "SUCCESS" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  it.effect("rejects a paginated review-thread response without a usable cursor", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(collectYeetWatchSnapshot(context));

      expect(failure.message).toContain("another GraphQL page without an end cursor");
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
            checks: { exitCode: 0, output: checksJson([]) },
            threads: {
              exitCode: 0,
              output: threadsJson([], { endCursor: "", hasNextPage: true }),
            },
          },
        ])
      )
    )
  );

  it.effect("fails loudly when no pull request exists for the branch", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(collectYeetWatchSnapshot(context));

      expect(failure).toBeInstanceOf(YeetCommandError);
      expect(failure.message).toContain("requires an open pull request");
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 1, output: "no pull requests found" },
            checks: { exitCode: 0, output: "[]" },
            threads: { exitCode: 0, output: threadsJson([]) },
          },
        ])
      )
    )
  );

  // "no checks reported" is gh's registration gap, not a poll failure — the
  // snapshot carries an empty rollup and the caller's policy decides.
  it.effect("reads a failed checks read as an empty rollup", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetWatchSnapshot(context);

      expect(snapshot.checks).toEqual([]);
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
            checks: { exitCode: 1, output: "no checks reported on the 'feature/watch' branch" },
            threads: { exitCode: 0, output: threadsJson([]) },
          },
        ])
      )
    )
  );
  // An outage that decoded to an empty thread set would make the next good
  // poll re-report every existing thread as newly opened (#751 review P1).
  it.effect("fails a poll whose thread read fails, instead of faking emptiness", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(collectYeetWatchSnapshot(context));

      expect(failure).toBeInstanceOf(YeetCommandError);
      expect(failure.message).toContain("could not read PR review threads");
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
            checks: { exitCode: 0, output: checksJson([]) },
            threads: { exitCode: 1, output: "gh: API rate limit exceeded" },
          },
        ])
      )
    )
  );

  // Only gh's registration message buys an empty rollup; any other checks
  // failure ending the watch as green `all-terminal` was #751's first P1.
  it.effect("fails a poll whose checks read fails for a non-registration reason", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(collectYeetWatchSnapshot(context));

      expect(failure).toBeInstanceOf(YeetCommandError);
      expect(failure.message).toContain("could not read PR checks");
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
            checks: { exitCode: 1, output: "gh: API rate limit exceeded" },
            threads: { exitCode: 0, output: threadsJson([]) },
          },
        ])
      )
    )
  );

  // GraphQL answers `node: null` for an id the token cannot see; a null
  // mergeable is GitHub still computing it. Neither may kill a poll.
  it.effect("reads a null GraphQL node and a null mergeable as empty and UNKNOWN", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetWatchSnapshot(context);

      expect(snapshot.threads).toEqual([]);
      expect(snapshot.mergeable).toBe("UNKNOWN");
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: {
              exitCode: 0,
              output: JSON.stringify({
                headRefOid: "aaa111",
                id: "PR_watch",
                isDraft: false,
                mergeable: null,
                mergeStateStatus: null,
                number: 751,
                reviewDecision: null,
                state: "OPEN",
              }),
            },
            checks: { exitCode: 0, output: checksJson([]) },
            threads: { exitCode: 0, output: JSON.stringify({ data: { node: null } }) },
          },
        ])
      )
    )
  );
});

describe("runYeetWatchStream", () => {
  // it.live: the loop sleeps between polls, and under the TestClock a real
  // sleep parks forever (A7's receipt). Zero interval keeps it instant.
  it.live("streams started, transitions, and ended rows as decodable NDJSON", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(1);

        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeUnknownYeetWatchEventJson(line));
        expect(A.map(events, (event) => event.kind)).toEqual([
          "watch-started",
          "check-transition",
          "settle-changed",
          "watch-ended",
        ]);
        const transition = events[1] as Extract<YeetWatchEvent, { readonly kind: "check-transition" }>;
        expect(transition.from).toBe("pending");
        expect(transition.to).toBe("fail");
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111", "BEHIND") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pending", name: "Coverage", state: "QUEUED" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "fail", name: "Coverage", state: "FAILURE" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  it.live("converts a failed later poll into a typed poll-error ending", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("poll-error");
        expect(ended.failing).toBe(0);
        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeUnknownYeetWatchEventJson(line));
        expect(A.map(events, (event) => event.kind)).toEqual(["watch-started", "watch-ended"]);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("watch poll failed")(line))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pending", name: "Coverage", state: "QUEUED" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 1, output: "gh: API rate limit exceeded" },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  it.live("ends immediately when the first snapshot is already terminal", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(0);
        const lines = A.map(yield* TestConsole.logLines, String);
        expect(A.length(lines)).toBe(2);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(TestConsole.layer, PlatformLayer, scriptedSpawnerLayer([greenScript("aaa111")]))
      )
    )
  );

  it.live("keeps watching terminal checks when review-thread inbox persistence fails", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const paths = yield* yeetInboxPaths(root);
        yield* fs.makeDirectory(paths.dir, { recursive: true });
        yield* fs.writeFileString(paths.failuresPath, "");
        yield* fs.symlink(paths.failuresPath, paths.activePath);

        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("failed to append review-thread inbox row T1")(line))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111", "BEHIND") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pass", name: "Check", state: "SUCCESS" }]) },
              threads: { exitCode: 0, output: threadsJson([{ id: "T1", isResolved: false }]) },
            },
          ])
        )
      )
    )
  );
});

describe("remediation dispatch through the watch", () => {
  // A1 acceptance, first half: the capsule is appended on the same poll tick
  // that observes the transition — no batching, no end-of-watch flush — so
  // with the production 10s interval a first red reaches the inbox well
  // inside the 15s p95 budget.
  it.live("delivers a first red's capsule to the inbox on the tick that observes it", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });
        expect(ended.failing).toBe(1);

        const rows = yield* readInboxRows(root);
        expect(A.length(rows)).toBe(3);
        const row = O.getOrThrow(
          A.findFirst(rows, (subject): subject is YeetCheckFailedRow => subject.kind === "check-failed")
        );
        expect(row.severity).toBe("P0");
        expect(row.checkout).toBe(root);
        expect(row.capsule.lane).toBe("Coverage");
        expect(row.capsule.headSha).toBe("aaa111");
        expect(row.capsule.prNumber).toBe(751);
        expect(row.capsule.link).toBe("https://github.com/beep/beep/actions/runs/3/job/4");
        expect(row.capsule.workflow).toBe("Check");
        expect(row.capsule.state).toBe("FAILURE");
        expect(A.some(rows, (subject) => subject.kind === "review-thread" && subject.capsule.threadId === "T1")).toBe(
          true
        );
        expect(A.some(rows, (subject) => subject.kind === "base-drift" && subject.capsule.base === "origin/main")).toBe(
          true
        );

        const wave = yield* loadYeetRemediationWave(root);
        expect(O.isSome(wave)).toBe(true);
        if (O.isSome(wave)) {
          expect(wave.value.headSha).toBe("aaa111");
          expect(wave.value.sessionStartedAt).not.toBeNull();
          expect(wave.value.capsuleIds).toEqual([row.id]);
        }

        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("repair session opened")(line))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111", "BEHIND") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pending", name: "Coverage", state: "QUEUED" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  {
                    bucket: "fail",
                    link: "https://github.com/beep/beep/actions/runs/3/job/4",
                    name: "Coverage",
                    state: "FAILURE",
                    workflow: "Check",
                  },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([{ id: "T1", isResolved: false }]) },
            },
          ])
        )
      )
    )
  );

  // A1 acceptance, second half: three reds on one head produce ONE repair
  // session with three queued capsules — not three sessions, not one capsule.
  it.live("queues three reds on one head into a single repair session", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });
        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(3);

        const rows = yield* readInboxRows(root);
        expect(A.length(rows)).toBe(3);
        expect(
          A.getSomes(A.map(rows, (row) => (row.kind === "check-failed" ? O.some(row.capsule.lane) : O.none<string>())))
        ).toEqual(["Check", "Coverage", "Lint"]);

        const wave = yield* loadYeetRemediationWave(root);
        expect(O.isSome(wave)).toBe(true);
        if (O.isSome(wave)) {
          expect(A.length(wave.value.capsuleIds)).toBe(3);
          expect(wave.value.capsuleIds).toEqual(A.map(rows, (row) => row.id));
        }

        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.length(A.filter(errors, (line) => Str.includes("repair session opened")(line)))).toBe(1);
        expect(A.length(A.filter(errors, (line) => Str.includes("queued to the head")(line)))).toBe(2);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "pending", name: "Check", state: "QUEUED" },
                  { bucket: "pending", name: "Coverage", state: "QUEUED" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Check", state: "FAILURE" },
                  { bucket: "pending", name: "Coverage", state: "QUEUED" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Check", state: "FAILURE" },
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Check", state: "FAILURE" },
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "fail", name: "Lint", state: "FAILURE" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // Dedup by headSha+lane: a lane that re-runs (fail → pending → fail) on the
  // same head re-derives the same capsule id and must not duplicate the row.
  it.live("does not duplicate a capsule when the same lane goes red twice on one head", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });
        expect(ended.failing).toBe(1);

        const rows = yield* readInboxRows(root);
        expect(A.length(rows)).toBe(1);

        const wave = yield* loadYeetRemediationWave(root);
        if (O.isSome(wave)) {
          expect(A.length(wave.value.capsuleIds)).toBe(1);
        }
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.length(A.filter(errors, (line) => Str.includes("repair session opened")(line)))).toBe(1);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pending", name: "Coverage", state: "QUEUED" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "fail", name: "Coverage", state: "FAILURE" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pending", name: "Coverage", state: "QUEUED" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "fail", name: "Coverage", state: "FAILURE" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // A new push supersedes the wave: the old head's capsules stay in the
  // inbox, the wave record restarts on the new head, and reds already present
  // in the new baseline are seeded even though they emit no transition.
  it.live("supersedes the wave on a head change and seeds the new baseline's reds", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });
        expect(ended.reason).toBe("all-terminal");

        const rows = yield* readInboxRows(root);
        expect(
          A.getSomes(
            A.map(rows, (row) =>
              row.kind === "check-failed" ? O.some([row.capsule.lane, row.capsule.headSha]) : O.none()
            )
          )
        ).toEqual([
          ["Coverage", "aaa111"],
          ["Coverage", "bbb222"],
        ]);

        const wave = yield* loadYeetRemediationWave(root);
        expect(O.isSome(wave)).toBe(true);
        if (O.isSome(wave)) {
          expect(wave.value.headSha).toBe("bbb222");
          expect(A.length(wave.value.capsuleIds)).toBe(1);
        }
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("superseded")(line))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "pending", name: "Coverage", state: "QUEUED" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "bbb222") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "bbb222") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pass", name: "Lint", state: "SUCCESS" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // A watch attached to an already-red wave seeds the baseline, and a second
  // watch over the same checkout re-derives the same ids and stays silent —
  // restart idempotency is what makes the seed safe to run unconditionally.
  it.live("seeds already-failing checks at watch start, idempotently across restarts", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const first = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });
        expect(first.reason).toBe("all-terminal");
        expect(first.failing).toBe(1);

        const second = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });
        expect(second.failing).toBe(1);

        const rows = yield* readInboxRows(root);
        expect(A.length(rows)).toBe(1);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.length(A.filter(errors, (line) => Str.includes("repair session opened")(line)))).toBe(1);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "fail", name: "Coverage", state: "FAILURE" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );
});

describe("registration patience", () => {
  const unregistered = (headSha: string): PollScript => ({
    view: { exitCode: 0, output: viewJson("OPEN", headSha) },
    checks: { exitCode: 1, output: "no checks reported on the 'feature/watch' branch" },
    threads: { exitCode: 0, output: threadsJson([]) },
  });

  // The #751-class fix: a zero-check OPEN snapshot inside gh's registration
  // gap must not end the watch as a green all-terminal — the push's checks
  // are about to run and may all fail.
  it.live("polls through the registration gap at watch start instead of settling green", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(1);
        expect(A.length(yield* readInboxRows(root))).toBe(1);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("no checks registered")(line))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            unregistered("aaa111"),
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pending", name: "Coverage", state: "QUEUED" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "fail", name: "Coverage", state: "FAILURE" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  it.live("times out a checkless PR instead of declaring a green settle", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0, settleTimeoutMs: 0 });

        expect(ended.reason).toBe("settle-timeout");
        expect(ended.failing).toBe(0);
        const errors = A.filter(A.map(yield* TestConsole.errorLines, String), (line) =>
          Str.includes("no checks registered")(line)
        );
        // An expired settle budget is a failure even when no check registered.
        expect(A.length(errors)).toBe(0);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(TestConsole.layer, PlatformLayer, scriptedSpawnerLayer([unregistered("aaa111")]))
      )
    )
  );

  // The registration budget belongs to a head: polls the OLD head spent must
  // not shorten the NEW head's window, or a push landing late in the old
  // window could exit green before its checks register (#754 review P1).
  it.live("restarts the registration budget when the head changes mid-window", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.failing).toBe(1);
        const patience = A.filter(A.map(yield* TestConsole.errorLines, String), (line) =>
          Str.includes("no checks registered")(line)
        );
        expect(A.some(patience, (line) => Str.includes("head aaa111 yet (2/10)")(line))).toBe(true);
        expect(A.some(patience, (line) => Str.includes("head bbb222 yet (1/10)")(line))).toBe(true);
        expect(A.some(patience, (line) => Str.includes("(3/10)")(line))).toBe(false);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            unregistered("aaa111"),
            unregistered("aaa111"),
            unregistered("bbb222"),
            {
              view: { exitCode: 0, output: viewJson("OPEN", "bbb222") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "fail", name: "Coverage", state: "FAILURE" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // Scenario B of the review P1: a push lands mid-watch and the next poll
  // reads the new head while gh still answers "no checks reported". Ending
  // there would retire the superseded wave AND report the new push green.
  it.live("polls through a mid-watch push whose checks have not registered yet", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(1);

        const rows = yield* readInboxRows(root);
        expect(
          A.getSomes(
            A.map(rows, (row) =>
              row.kind === "check-failed" ? O.some([row.capsule.lane, row.capsule.headSha]) : O.none()
            )
          )
        ).toEqual([
          ["Coverage", "aaa111"],
          ["Coverage", "bbb222"],
        ]);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("superseded")(line))).toBe(true);
        expect(A.some(errors, (line) => Str.includes("no checks registered")(line))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            unregistered("bbb222"),
            {
              view: { exitCode: 0, output: viewJson("OPEN", "bbb222") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "bbb222") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pass", name: "Lint", state: "SUCCESS" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );
});

describe("comment rows and --until-event", () => {
  const issueCommentsJson = (comments: ReadonlyArray<{ readonly id: number; readonly createdAt: string }>) =>
    JSON.stringify(
      A.map(comments, (comment) => ({
        body: `comment ${comment.id}`,
        created_at: comment.createdAt,
        html_url: `https://github.com/beep/beep/pull/751#issuecomment-${comment.id}`,
        id: comment.id,
        user: { login: "greptile-apps[bot]" },
      }))
    );

  const pendingChecks = checksJson([{ bucket: "pending", name: "Coverage", state: "QUEUED" }]);

  it.live("ends immediately when the pull request is already merged", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("pr-merged");
        expect(ended.failing).toBe(0);
        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeUnknownYeetWatchEventJson(line));
        expect(A.map(events, (event) => event.kind)).toEqual(["watch-started", "watch-ended"]);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("MERGED", "aaa111") },
              checks: { exitCode: 0, output: pendingChecks },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // The event exit on a red keys on the snapshot while siblings still run —
  // the whole point of the mode: the supervisor is woken with the failure
  // capsule already durable instead of waiting out the rest of the wave.
  it.live("exits with reason event on a red transition while a sibling check is still pending", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0, untilEvent: true });

        expect(ended.reason).toBe("event");
        expect(ended.failing).toBe(1);
        expect(yeetWatchExitFailure(ended)).toBe(true);

        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeUnknownYeetWatchEventJson(line));
        expect(A.map(events, (event) => event.kind)).toEqual(["watch-started", "check-transition", "watch-ended"]);
        // The capsule is durable before the exit row is emitted.
        expect(A.length(yield* readInboxRows(root))).toBe(1);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "pending", name: "Coverage", state: "QUEUED" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // Lane A's gotcha: the very first snapshot emits no transition rows, so the
  // event exit must key on the snapshot's census, not on a diff.
  it.live("exits immediately when the first snapshot already carries a red", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0, untilEvent: true });

        expect(ended.reason).toBe("event");
        expect(ended.failing).toBe(1);
        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeUnknownYeetWatchEventJson(line));
        expect(A.map(events, (event) => event.kind)).toEqual(["watch-started", "watch-ended"]);
        expect(A.length(yield* readInboxRows(root))).toBe(1);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: {
                exitCode: 0,
                output: checksJson([
                  { bucket: "fail", name: "Coverage", state: "FAILURE" },
                  { bucket: "pending", name: "Lint", state: "QUEUED" },
                ]),
              },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  it.live("reports an all-terminal red as an event wake", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0, untilEvent: true });

        expect(ended.reason).toBe("event");
        expect(ended.failing).toBe(1);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "fail", name: "Coverage", state: "FAILURE" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // The settle window batches a comment burst into one wake: the second
  // comment lands inside the window and joins the session instead of costing
  // a second one. A comment-only exit is a clean zero.
  it.live("batches a comment burst through the settle window, then exits with reason event", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0, untilEvent: true });

        expect(ended.reason).toBe("event");
        expect(ended.failing).toBe(0);
        expect(yeetWatchExitFailure(ended)).toBe(false);

        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeUnknownYeetWatchEventJson(line));
        expect(A.map(events, (event) => event.kind)).toEqual([
          "watch-started",
          "comment-posted",
          "comment-posted",
          "watch-ended",
        ]);
        const first = events[1] as Extract<YeetWatchEvent, { readonly kind: "comment-posted" }>;
        expect(first.source).toBe("issue");
        expect(first.author).toBe("greptile-apps[bot]");
        expect(first.commentId).toBe(44);

        // The durable watermark already excludes the batch, so a relaunched
        // session resumes past it instead of re-waking on the same comments.
        const statePath = yield* yeetMonitorCommentStatePath(contextFor(root));
        const fs = yield* FileSystem.FileSystem;
        const state = yield* YeetMonitorCommentStateJson.decode(yield* fs.readFileString(statePath));
        expect(state.prNumber).toBe(751);
        expect(state.watermark.issue.id).toBe(45);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: pendingChecks },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: pendingChecks },
              threads: { exitCode: 0, output: threadsJson([]) },
              issueComments: {
                exitCode: 0,
                output: issueCommentsJson([{ id: 44, createdAt: "2099-01-01T00:00:00Z" }]),
              },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: pendingChecks },
              threads: { exitCode: 0, output: threadsJson([]) },
              issueComments: {
                exitCode: 0,
                output: issueCommentsJson([{ id: 45, createdAt: "2099-01-01T00:00:10Z" }]),
              },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: pendingChecks },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // Plain --watch gains the comment rows without the exit contract: the gap
  // where ordinary PR comments were invisible to the stream is closed, and
  // the stream still runs to its terminal settle.
  it.live("emits comment rows in plain watch mode without exiting on them", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(0);
        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeUnknownYeetWatchEventJson(line));
        expect(A.map(events, (event) => event.kind)).toEqual([
          "watch-started",
          "comment-posted",
          "check-transition",
          "merge-ready-criterion-changed",
          "settle-changed",
          "watch-ended",
        ]);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: pendingChecks },
              threads: { exitCode: 0, output: threadsJson([]) },
              issueComments: {
                exitCode: 0,
                output: issueCommentsJson([{ id: 43, createdAt: "2099-01-01T00:00:00Z" }]),
              },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pass", name: "Coverage", state: "SUCCESS" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
            },
          ])
        )
      )
    )
  );

  // A comment-poll failure degrades the comment surface alone: the check
  // watch still reaches its terminal settle, and the operator sees why.
  it.live("keeps watching checks when the comment poll fails", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(0);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("watch comment poll failed")(line))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: pendingChecks },
              threads: { exitCode: 0, output: threadsJson([]) },
              reviewComments: { exitCode: 1, output: "gh: API rate limit exceeded" },
            },
            {
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
              checks: { exitCode: 0, output: checksJson([{ bucket: "pass", name: "Coverage", state: "SUCCESS" }]) },
              threads: { exitCode: 0, output: threadsJson([]) },
              reviewComments: { exitCode: 1, output: "gh: API rate limit exceeded" },
            },
          ])
        )
      )
    )
  );

  it.live("stops polling comments at the failure bound while checks keep advancing", () => {
    const failedCommentPoll: PollScript = {
      view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
      checks: { exitCode: 0, output: pendingChecks },
      threads: { exitCode: 0, output: threadsJson([]) },
      reviewComments: { exitCode: 1, output: "gh: API rate limit exceeded" },
    };
    return inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("stopped after 5 consecutive failed polls")(line))).toBe(true);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          PlatformLayer,
          scriptedSpawnerLayer([
            failedCommentPoll,
            failedCommentPoll,
            failedCommentPoll,
            failedCommentPoll,
            failedCommentPoll,
            failedCommentPoll,
            {
              ...greenScript("aaa111"),
              reviewComments: { exitCode: 1, output: "gh: API rate limit exceeded" },
            },
          ])
        )
      )
    );
  });
});

describe("yeetWatchExitFailure", () => {
  it("fails on any red, on a closed PR, and on a poll error; passes a green settle and a merge", () => {
    expect(yeetWatchExitFailure({ failing: 2, reason: "all-terminal" })).toBe(true);
    expect(yeetWatchExitFailure({ failing: 0, reason: "pr-closed" })).toBe(true);
    expect(yeetWatchExitFailure({ failing: 0, reason: "poll-error" })).toBe(true);
    expect(yeetWatchExitFailure({ failing: 0, reason: "all-terminal" })).toBe(false);
    expect(yeetWatchExitFailure({ failing: 0, reason: "pr-merged" })).toBe(false);
    // An event exit is only a failure when the event was a red.
    expect(yeetWatchExitFailure({ failing: 1, reason: "event" })).toBe(true);
    expect(yeetWatchExitFailure({ failing: 0, reason: "event" })).toBe(false);
  });
});

describe("B7 watch settle cache and timeout", () => {
  it.live("waits for missing contexts, resets on a push, and ends with a typed settle-timeout", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const reads = yield* Ref.make(0);
        const ticks = yield* Ref.make(0);
        const ended = yield* runYeetWatchStream(contextFor(root), {
          intervalMillis: 0,
          settleTimeoutMs: 1000,
          now: Ref.getAndUpdate(ticks, (value) => value + 1).pipe(
            Effect.map((tick) => DateTime.makeUnsafe(tick * 500))
          ),
          rulesetRead: () =>
            Ref.update(reads, (value) => value + 1).pipe(
              Effect.as(
                O.some(
                  YeetRulesetRequiredContexts.make({
                    base: "main",
                    contexts: ["Check", "Heavy / Check"],
                    rulesetIds: [10240248],
                    readAt: "2026-09-16T00:00:00Z",
                  })
                )
              )
            ),
        });
        expect(ended.reason).toBe("settle-timeout");
        expect(yeetWatchExitFailure(ended)).toBe(true);
        expect(yield* Ref.get(reads)).toBe(2);
        expect(yield* Ref.get(ticks)).toBe(4);
        const events = yield* Effect.forEach(A.map(yield* TestConsole.logLines, String), (line) =>
          decodeUnknownYeetWatchEventJson(line)
        );
        expect(A.filter(events, (event) => event.kind === "head-changed")).toHaveLength(1);
        expect(A.filter(events, (event) => event.kind === "settle-changed")).toMatchObject([
          { from: "required-pending", to: "settle-timeout", missing: ["Heavy / Check"] },
        ]);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          scriptedSpawnerLayer([
            greenScript("aaa111", [HEAVY_ADMISSION_LABEL]),
            greenScript("bbb222", [HEAVY_ADMISSION_LABEL]),
            greenScript("bbb222", [HEAVY_ADMISSION_LABEL]),
            greenScript("bbb222", [HEAVY_ADMISSION_LABEL]),
          ])
        )
      )
    )
  );
});

describe("B8 watch heavy admission", () => {
  const heavyRuleset = () =>
    Effect.succeedSome(
      YeetRulesetRequiredContexts.make({
        base: "main",
        contexts: ["Check", "Heavy / Check"],
        rulesetIds: [10240248],
        readAt: "2026-09-16T00:00:00Z",
      })
    );
  const settleRows = Effect.fn("watchAdmissionTest.settleRows")(function* () {
    const events = yield* Effect.forEach(A.map(yield* TestConsole.logLines, String), (line) =>
      decodeUnknownYeetWatchEventJson(line)
    );
    return A.filter(events, (event) => event.kind === "settle-changed");
  });
  const stderr = TestConsole.errorLines.pipe(Effect.map(A.map(String)), Effect.map(A.join("\n")));

  it.live("holds an unlabelled code head past the budget and never reaches settle-timeout", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ticks = yield* Ref.make(0);
        const ended = yield* runYeetWatchStream(contextFor(root), {
          intervalMillis: 0,
          settleTimeoutMs: 1000,
          now: Ref.getAndUpdate(ticks, (value) => value + 1).pipe(
            Effect.map((tick) => DateTime.makeUnsafe(tick * 500))
          ),
          rulesetRead: heavyRuleset,
        });
        // Four held ticks span 1.5s against a 1s budget; the merged view ends the stream.
        expect(ended.reason).toBe("pr-merged");
        expect(yield* Ref.get(ticks)).toBe(5);
        expect(yield* settleRows()).toEqual([]);
        const lines = yield* stderr;
        expect(lines).toContain(
          "settle: heavy-not-admitted; gated: Heavy / Check; admit: gh pr edit --add-label ready-for-heavy; waited 1s 500ms (not counted toward the 1s settle timeout)"
        );
        expect(lines).not.toContain("settle-timeout");
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          scriptedSpawnerLayer([
            greenScript("aaa111"),
            greenScript("aaa111"),
            greenScript("aaa111"),
            greenScript("aaa111"),
            { ...greenScript("aaa111"), view: { exitCode: 0, output: viewJson("MERGED", "aaa111") } },
          ])
        )
      )
    )
  );

  it.live("streams one settle-changed row when the label lands and the heavy lane reports", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ticks = yield* Ref.make(0);
        const diffs = yield* Ref.make(0);
        const ended = yield* runYeetWatchStream(contextFor(root), {
          intervalMillis: 0,
          settleTimeoutMs: 1000,
          now: Ref.getAndUpdate(ticks, (value) => value + 1).pipe(
            Effect.map((tick) => DateTime.makeUnsafe(tick * 2000))
          ),
          rulesetRead: heavyRuleset,
          changedPathsRead: () => Ref.update(diffs, (value) => value + 1).pipe(Effect.as(["packages/a/src/index.ts"])),
        });
        expect(ended.reason).toBe("all-terminal");
        expect(yeetWatchExitFailure(ended)).toBe(false);
        expect(yield* Ref.get(diffs)).toBe(1);
        expect(yield* settleRows()).toMatchObject([
          { from: "heavy-not-admitted", to: "closeout-pending", pending: [], missing: [], gated: [] },
        ]);
        const lines = yield* stderr;
        expect(lines).toContain("[yeet] heavy admission: hold → run");
        expect(lines).not.toContain("settle-timeout");
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          scriptedSpawnerLayer([
            // Held: 2s of wall clock pass before the label, more than the budget.
            greenScript("aaa111"),
            greenScript("aaa111"),
            {
              ...greenScript("aaa111", [HEAVY_ADMISSION_LABEL]),
              checks: {
                exitCode: 0,
                output: checksJson([
                  { name: "Check", bucket: "pass", state: "SUCCESS" },
                  { name: "Heavy / Check", bucket: "pass", state: "SUCCESS" },
                ]),
              },
            },
          ])
        )
      )
    )
  );

  it.live("settles a docs-only head on the skipped heavy outcomes without the label", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), {
          intervalMillis: 0,
          settleTimeoutMs: 1000,
          rulesetRead: heavyRuleset,
        });
        expect(ended.reason).toBe("all-terminal");
        expect(yeetWatchExitFailure(ended)).toBe(false);
        expect(yield* stderr).toContain(
          "settle: closeout-pending; required census settled, running the read-first closeout; heavy: docs-only, lanes report skipped"
        );
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
          scriptedSpawnerLayer(
            [
              {
                ...greenScript("aaa111"),
                checks: {
                  exitCode: 0,
                  output: checksJson([
                    { name: "Check", bucket: "pass", state: "SUCCESS" },
                    { name: "Heavy / Check", bucket: "skipping", state: "SKIPPED" },
                  ]),
                },
              },
            ],
            "docs/runbooks/ci.md\ngoals/time-to-certainty/PLAN.md\n"
          )
        )
      )
    )
  );
});

it.live("a settled watch head never times out while optional checks are pending", () =>
  inTempRepo((root) =>
    Effect.gen(function* () {
      const ticks = yield* Ref.make(0);
      const ended = yield* runYeetWatchStream(contextFor(root), {
        intervalMillis: 0,
        settleTimeoutMs: 10,
        now: Ref.getAndUpdate(ticks, (n) => n + 1).pipe(Effect.map((n) => DateTime.makeUnsafe(n * 1000))),
        rulesetRead: () => Effect.succeedNone,
      });
      expect(ended.reason).toBe("all-terminal");
      expect(yield* Ref.get(ticks)).toBe(2);
    })
  ).pipe(
    provideScopedLayer(
      Layer.mergeAll(
        TestConsole.layer,
        scriptedSpawnerLayer([
          {
            ...greenScript("aaa111"),
            requiredChecks: greenScript("aaa111").checks,
            checks: {
              exitCode: 0,
              output: checksJson([
                { name: "Check", bucket: "pass", state: "SUCCESS" },
                { name: "Optional", bucket: "pending", state: "QUEUED" },
              ]),
            },
          },
          greenScript("aaa111"),
        ])
      )
    )
  )
);

describe("required-only watch exits", () => {
  for (const untilEvent of [false, true]) {
    it.live(`keeps a standing optional red visible without failing (untilEvent=${untilEvent})`, () =>
      inTempRepo((root) =>
        Effect.gen(function* () {
          const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0, untilEvent });
          expect(ended.reason).toBe("all-terminal");
          expect(ended.failing).toBe(0);
          expect(ended.optionalFailing).toBe(1);
          expect(yeetWatchExitFailure(ended)).toBe(false);
          const lines = A.map(yield* TestConsole.logLines, String);
          const rows = yield* Effect.forEach(lines, (line) => decodeUnknownYeetWatchEventJson(line));
          expect(A.filter(rows, (row) => row.kind === "watch-ended")).toEqual([ended]);
          expect(A.some(rows, (row) => row.kind === "check-transition")).toBe(true);
        })
      ).pipe(
        provideScopedLayer(
          Layer.mergeAll(
            PlatformLayer,
            TestConsole.layer,
            scriptedSpawnerLayer([
              {
                ...greenScript("aaa111"),
                checks: {
                  exitCode: 0,
                  output: checksJson([
                    { bucket: "fail", name: "Vercel", state: "FAILURE" },
                    { bucket: "pending", name: "Check", state: "QUEUED" },
                  ]),
                },
                requiredChecks: {
                  exitCode: 0,
                  output: checksJson([{ bucket: "pending", name: "Check", state: "QUEUED" }]),
                },
              },
              {
                ...greenScript("aaa111"),
                checks: {
                  exitCode: 0,
                  output: checksJson([
                    { bucket: "fail", name: "Vercel", state: "FAILURE" },
                    { bucket: "pass", name: "Check", state: "SUCCESS" },
                  ]),
                },
                requiredChecks: greenScript("aaa111").checks,
              },
            ])
          )
        )
      )
    );
  }

  it("ignores optional failures for every successful watch ending", () => {
    for (const reason of ["all-terminal", "pr-merged", "event"] as const) {
      expect(
        yeetWatchExitFailure(
          YeetWatchEnded.make({
            at: "now",
            headSha: "abc",
            failing: 0,
            optionalFailing: 2,
            reason,
          })
        )
      ).toBe(false);
    }
    expect(yeetWatchExitFailure({ failing: 0, reason: "settle-timeout" })).toBe(true);
  });
});
