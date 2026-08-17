import {
  collectYeetWatchSnapshot,
  loadYeetRemediationWave,
  RepoRunContext,
  runYeetWatchStream,
  YeetCommandError,
  YeetInboxRowJson,
  YeetWatchEvent,
  yeetInboxPaths,
  yeetWatchExitFailure,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

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

/** The three answers one snapshot collection reads, in spawn order. */
interface PollScript {
  readonly checks: { readonly exitCode: number; readonly output: string };
  readonly threads: { readonly exitCode: number; readonly output: string };
  readonly view: { readonly exitCode: number; readonly output: string };
}

const viewJson = (state: string, headSha: string): string =>
  JSON.stringify({ headRefOid: headSha, id: "PR_watch", mergeable: "MERGEABLE", number: 751, state });

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

const threadsJson = (nodes: ReadonlyArray<{ readonly id: string; readonly isResolved: boolean }>) =>
  JSON.stringify({ data: { node: { reviewThreads: { nodes } } } });

// One scripted answer set per poll; `gh api graphql` — the last read of each
// collection — advances the cursor to the next poll's script.
const scriptedSpawnerLayer = (scripts: ReadonlyArray<PollScript>) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const cursor = yield* Ref.make(0);
      return ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("the watch never spawns a piped command");
        }
        const line = A.join([command.command, ...command.args], " ");
        return Effect.gen(function* () {
          const index = Math.min(yield* Ref.get(cursor), A.length(scripts) - 1);
          const script = scripts[index] as PollScript;
          if (Str.includes("pr view")(line)) {
            return stubHandle(script.view.exitCode, script.view.output);
          }
          if (Str.includes("pr checks")(line)) {
            return stubHandle(script.checks.exitCode, script.checks.output);
          }
          yield* Ref.update(cursor, (value) => value + 1);
          return stubHandle(script.threads.exitCode, script.threads.output);
        });
      });
    })
  );

const greenScript = (headSha: string): PollScript => ({
  view: { exitCode: 0, output: viewJson("OPEN", headSha) },
  checks: { exitCode: 0, output: checksJson([{ bucket: "pass", name: "Check", state: "SUCCESS" }]) },
  threads: { exitCode: 0, output: threadsJson([]) },
});

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

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
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
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
                mergeable: null,
                number: 751,
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
  const decodeLine = S.decodeUnknownEffect(S.fromJsonString(YeetWatchEvent));

  // it.live: the loop sleeps between polls, and under the TestClock a real
  // sleep parks forever (A7's receipt). Zero interval keeps it instant.
  it.live("streams started, transitions, and ended rows as decodable NDJSON", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(1);

        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeLine(line));
        expect(A.map(events, (event) => event.kind)).toEqual(["watch-started", "check-transition", "watch-ended"]);
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

  it.live("converts a failed later poll into a typed poll-error ending", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("poll-error");
        expect(ended.failing).toBe(0);
        const lines = A.map(yield* TestConsole.logLines, String);
        const events = yield* Effect.forEach(lines, (line) => decodeLine(line));
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
        expect(A.length(rows)).toBe(1);
        const row = rows[0];
        expect(row?.kind).toBe("check-failed");
        expect(row?.severity).toBe("P0");
        expect(row?.checkout).toBe(root);
        expect(row?.capsule.lane).toBe("Coverage");
        expect(row?.capsule.headSha).toBe("aaa111");
        expect(row?.capsule.prNumber).toBe(751);
        expect(row?.capsule.link).toBe("https://github.com/beep/beep/actions/runs/3/job/4");
        expect(row?.capsule.workflow).toBe("Check");
        expect(row?.capsule.state).toBe("FAILURE");

        const wave = yield* loadYeetRemediationWave(root);
        expect(O.isSome(wave)).toBe(true);
        if (O.isSome(wave)) {
          expect(wave.value.headSha).toBe("aaa111");
          expect(wave.value.sessionStartedAt).not.toBeNull();
          expect(wave.value.capsuleIds).toEqual([row?.id]);
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
              view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
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
        expect(A.map(rows, (row) => row.capsule.lane)).toEqual(["Check", "Coverage", "Lint"]);

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
        expect(A.map(rows, (row) => [row.capsule.lane, row.capsule.headSha])).toEqual([
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

  it.live("believes a genuinely checkless PR once the patience bound is spent", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const ended = yield* runYeetWatchStream(contextFor(root), { intervalMillis: 0 });

        expect(ended.reason).toBe("all-terminal");
        expect(ended.failing).toBe(0);
        const errors = A.filter(A.map(yield* TestConsole.errorLines, String), (line) =>
          Str.includes("no checks registered")(line)
        );
        // One patience line per empty observation, then the bound is spent.
        expect(A.length(errors)).toBe(10);
      })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(TestConsole.layer, PlatformLayer, scriptedSpawnerLayer([unregistered("aaa111")]))
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
        expect(A.map(rows, (row) => [row.capsule.lane, row.capsule.headSha])).toEqual([
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

describe("yeetWatchExitFailure", () => {
  it("fails on any red, on a closed PR, and on a poll error; passes a green settle and a merge", () => {
    expect(yeetWatchExitFailure({ failing: 2, reason: "all-terminal" })).toBe(true);
    expect(yeetWatchExitFailure({ failing: 0, reason: "pr-closed" })).toBe(true);
    expect(yeetWatchExitFailure({ failing: 0, reason: "poll-error" })).toBe(true);
    expect(yeetWatchExitFailure({ failing: 0, reason: "all-terminal" })).toBe(false);
    expect(yeetWatchExitFailure({ failing: 0, reason: "pr-merged" })).toBe(false);
  });
});
