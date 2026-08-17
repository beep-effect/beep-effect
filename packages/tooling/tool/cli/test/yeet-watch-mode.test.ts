import {
  collectYeetWatchSnapshot,
  RepoRunContext,
  runYeetWatchStream,
  YeetCommandError,
  YeetWatchEvent,
  yeetWatchExitFailure,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feature/watch",
  cwd: ".",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: ".",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

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
  JSON.stringify({ headRefOid: headSha, id: "PR_watch", mergeable: "MERGEABLE", state });

const checksJson = (rows: ReadonlyArray<{ readonly name: string; readonly bucket: string; readonly state: string }>) =>
  JSON.stringify(rows);

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

describe("collectYeetWatchSnapshot", () => {
  it.effect("decodes and classifies one full snapshot", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetWatchSnapshot(context);

      expect(snapshot.headSha).toBe("aaa111");
      expect(snapshot.state).toBe("OPEN");
      expect(A.map(snapshot.checks, (check) => check.outcome)).toEqual(["pending", "fail"]);
      expect(A.map(snapshot.threads, (thread) => thread.isResolved)).toEqual([false]);
    }).pipe(
      provideScopedLayer(
        scriptedSpawnerLayer([
          {
            view: { exitCode: 0, output: viewJson("OPEN", "aaa111") },
            checks: {
              exitCode: 0,
              output: checksJson([
                { bucket: "pending", name: "Coverage", state: "IN_PROGRESS" },
                { bucket: "fail", name: "Lint", state: "FAILURE" },
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
  it.effect("degrades a failed thread read to an empty thread set", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetWatchSnapshot(context);

      expect(snapshot.threads).toEqual([]);
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
              output: JSON.stringify({ headRefOid: "aaa111", id: "PR_watch", mergeable: null, state: "OPEN" }),
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
    Effect.gen(function* () {
      const ended = yield* runYeetWatchStream(context, { intervalMillis: 0 });

      expect(ended.reason).toBe("all-terminal");
      expect(ended.failing).toBe(1);

      const lines = A.map(yield* TestConsole.logLines, String);
      const events = yield* Effect.forEach(lines, (line) => decodeLine(line));
      expect(A.map(events, (event) => event.kind)).toEqual(["watch-started", "check-transition", "watch-ended"]);
      const transition = events[1] as Extract<YeetWatchEvent, { readonly kind: "check-transition" }>;
      expect(transition.from).toBe("pending");
      expect(transition.to).toBe("fail");
    }).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          TestConsole.layer,
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

  it.live("ends immediately when the first snapshot is already terminal", () =>
    Effect.gen(function* () {
      const ended = yield* runYeetWatchStream(context, { intervalMillis: 0 });

      expect(ended.reason).toBe("all-terminal");
      expect(ended.failing).toBe(0);
      const lines = A.map(yield* TestConsole.logLines, String);
      expect(A.length(lines)).toBe(2);
    }).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, scriptedSpawnerLayer([greenScript("aaa111")]))))
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
