import { sessionCommand } from "@beep/repo-cli";
import {
  decodeSessionLedger,
  makeSessionLedgerLive,
  openSessionRows,
  PrRepository,
  recordSweepDone,
  renderSessionRow,
  SessionLedgerError,
  SessionLedgerRow,
  sessionCheckoutFacts,
  sessionHarness,
  sessionLedgerFileName,
} from "@beep/repo-cli/test/Session";
import { SweepGitState, sweepWritesLedgerDone } from "@beep/repo-cli/test/Yeet";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { ConfigProvider, Console, DateTime, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import { ChildProcess } from "effect/process";
import * as TestConsole from "effect/testing/TestConsole";

const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" });

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);

const row = (
  overrides: Partial<{
    checkout: string;
    state: "open" | "blocked" | "done";
    next: string;
    recordedAt: number;
    pr: O.Option<number>;
    summary: O.Option<string>;
  }> = {}
) =>
  SessionLedgerRow.make({
    schemaVersion: "session-ledger/v1",
    repository,
    clone: "/work/beep-effect",
    checkout: overrides.checkout ?? "/work/beep-effect-worktrees/lane",
    lane: "lane",
    branch: "feat/lane",
    state: overrides.state ?? "open",
    next: overrides.next ?? "resume",
    summary: overrides.summary ?? O.none(),
    pr: overrides.pr ?? O.none(),
    harness: "claude-code",
    sessionId: O.none(),
    recordedAt: DateTime.makeUnsafe(overrides.recordedAt ?? 0),
  });

const runGit = Effect.fn("SessionLedgerTest.runGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });
  expect(yield* handle.exitCode).toBe(0);
});

// A scratch clone whose origin names a GitHub repository, with a linked lane.
const withScratchCheckout = <A, E, R>(
  use: (fixture: { clone: string; lane: string; stateRoot: string }) => Effect.Effect<A, E, R>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "session-ledger-test-" });
      const clone = path.join(tmp, "clone");
      yield* fs.makeDirectory(clone);
      yield* runGit(clone, ["init", "-b", "main"]);
      yield* runGit(clone, ["config", "user.email", "session-ledger-test@example.com"]);
      yield* runGit(clone, ["config", "user.name", "Session Ledger Test"]);
      yield* runGit(clone, ["config", "commit.gpgsign", "false"]);
      yield* runGit(clone, ["remote", "add", "origin", "git@github.com:Beep-Effect/Beep-Effect.git"]);
      yield* fs.writeFileString(path.join(clone, "README.md"), "# scratch\n");
      yield* runGit(clone, ["add", "README.md"]);
      yield* runGit(clone, ["commit", "-m", "init"]);
      const lane = path.join(tmp, "clone-worktrees", "lane");
      yield* fs.makeDirectory(path.dirname(lane), { recursive: true });
      yield* runGit(clone, ["worktree", "add", "-b", "feat/lane", lane]);
      const stateRoot = path.join(tmp, "state");
      return yield* use({ clone, lane, stateRoot }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({
            env: { BEEP_SESSION_STATE_ROOT: stateRoot, HOME: tmp, CODEX_THREAD_ID: "thread-1" },
          })
        )
      );
    })
  );

const withCwd = <A, E, R>(cwd: string, effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = process.cwd;
      process.cwd = () => cwd;
      return previous;
    }),
    () => effect,
    (previous) =>
      Effect.sync(() => {
        process.cwd = previous;
      })
  );

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
      error: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
    })
  );
  return A.join(A.map(output, String), "\n");
});

const runSession = Command.runWith(sessionCommand, { version: "0.0.0" });

const gitStateBase = {
  branch: "feat/lane",
  mainBranch: "main",
  headBranch: "feat/lane",
  worktreeDirty: false,
  mainCheckedOutElsewhere: false,
  branchCheckedOutElsewhere: false,
  branchMergedIntoBase: false,
  lockfileMovedOnMainUpdate: false,
  statusProbeUnreliable: false,
  worktreeProbeUnreliable: false,
};

describe("session ledger rows", () => {
  it("keeps the newest row per checkout, drops done checkouts, and sorts newest first", () => {
    const rows = [
      row({ checkout: "/a", recordedAt: 1, next: "old a" }),
      row({ checkout: "/a", recordedAt: 5, next: "new a" }),
      row({ checkout: "/b", recordedAt: 3, next: "b", state: "blocked" }),
      row({ checkout: "/c", recordedAt: 2 }),
      row({ checkout: "/c", recordedAt: 4, state: "done" }),
      row({ checkout: "/d", recordedAt: 9, state: "done" }),
      row({ checkout: "/d", recordedAt: 9, next: "same instant wins by order" }),
    ];
    expect(A.map(openSessionRows(rows), (item) => [item.checkout, item.next])).toStrictEqual([
      ["/d", "same instant wins by order"],
      ["/a", "new a"],
      ["/b", "b"],
    ]);
    expect(openSessionRows([])).toStrictEqual([]);
  });

  it("renders a row with and without its optional fields", () => {
    const full = renderSessionRow(row({ pr: O.some(12), summary: O.some("PR is green"), state: "blocked" }));
    expect(full).toContain("- blocked lane (feat/lane, PR #12) 1970-01-01T00:00:00.000Z by claude-code");
    expect(full).toContain("  summary: PR is green");
    const bare = renderSessionRow(row());
    expect(bare).toContain("- open lane (feat/lane) ");
    expect(bare).not.toContain("summary:");
  });

  it("decodes JSON Lines content and counts corrupt lines", () => {
    const decoded = decodeSessionLedger('\nnot-json\n{"schemaVersion":"nope"}\n');
    expect(decoded.rows).toStrictEqual([]);
    expect(decoded.corruptLineCount).toBe(2);
  });

  it.effect("reads the harness from the environment", () =>
    Effect.gen(function* () {
      const claude = yield* sessionHarness.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { CLAUDE_CODE_SESSION_ID: "s1" } })
        )
      );
      expect(claude.harness).toBe("claude-code");
      expect(O.getOrThrow(claude.sessionId)).toBe("s1");
      const codex = yield* sessionHarness.pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { CODEX_THREAD_ID: "t1" } }))
      );
      expect(codex.harness).toBe("codex");
      expect(O.getOrThrow(codex.sessionId)).toBe("t1");
      const unknown = yield* sessionHarness.pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} }))
      );
      expect(unknown.harness).toBe("unknown");
      assertNone(unknown.sessionId);
    })
  );
});

describe("sweep ledger gate", () => {
  it("writes the done row only for an observed MERGED pull request on a checkout that held the branch", () => {
    const merged = SweepGitState.make({ ...gitStateBase, pullRequestState: O.some("MERGED") });
    expect(sweepWritesLedgerDone(merged, O.none())).toBe(true);
    expect(
      sweepWritesLedgerDone(SweepGitState.make({ ...gitStateBase, pullRequestState: O.some("OPEN") }), O.none())
    ).toBe(false);
    expect(sweepWritesLedgerDone(SweepGitState.make(gitStateBase), O.none())).toBe(false);
    // `yeet sweep --branch feat/lane` as the second pass from a clone already
    // back on main: the documented case, so the row closes.
    expect(sweepWritesLedgerDone(SweepGitState.make({ ...merged, headBranch: "main" }), O.none())).toBe(true);
    // The same command from a checkout parked on a third branch: that
    // checkout's own row stays.
    const parked = SweepGitState.make({ ...merged, headBranch: "feat/other" });
    expect(sweepWritesLedgerDone(parked, O.none())).toBe(false);
    // A retirement vouches for the lane it removed.
    expect(sweepWritesLedgerDone(parked, O.some("/lanes/lane"))).toBe(true);
    expect(
      sweepWritesLedgerDone(SweepGitState.make({ ...gitStateBase, headBranch: "feat/other" }), O.some("/lanes/lane"))
    ).toBe(false);
  });
});

describe("session ledger service", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })((it) => {
    it.effect("appends with private modes, lists, tolerates corrupt lines, and treats a missing file as empty", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const ledger = yield* makeSessionLedgerLive().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: { BEEP_SESSION_STATE_ROOT: root, HOME: root } })
          )
        );
        expect(yield* ledger.list(repository)).toStrictEqual([]);
        yield* ledger.append(row({ next: "first" }));
        yield* ledger.append(row({ next: "second", recordedAt: 1 }));
        const file = path.join(root, sessionLedgerFileName(repository));
        yield* fs.writeFileString(file, "not-json\n", { flag: "a" });
        const listed = yield* ledger.list(repository);
        expect(A.map(listed, (item) => item.next)).toStrictEqual(["first", "second"]);
        expect((yield* fs.stat(file)).mode & 0o777).toBe(0o600);
        expect((yield* fs.stat(root)).mode & 0o777).toBe(0o700);
      })
    );

    it.effect("resolves XDG and HOME fallback roots and fails typed when the root is a file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const xdg = yield* makeSessionLedgerLive().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: { XDG_STATE_HOME: path.join(root, "xdg"), HOME: root } })
          )
        );
        yield* xdg.append(row());
        expect(yield* fs.exists(path.join(root, "xdg", "beep", "sessions", sessionLedgerFileName(repository)))).toBe(
          true
        );
        const home = yield* makeSessionLedgerLive().pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { HOME: root } }))
        );
        yield* home.append(row());
        expect(
          yield* fs.exists(path.join(root, ".local", "state", "beep", "sessions", sessionLedgerFileName(repository)))
        ).toBe(true);
        const blocked = yield* makeSessionLedgerLive().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                BEEP_SESSION_STATE_ROOT: path.join(root, "xdg", "beep", "sessions", sessionLedgerFileName(repository)),
              },
            })
          )
        );
        const error = yield* blocked.append(row()).pipe(Effect.flip);
        assert.instanceOf(error, SessionLedgerError);
        const unreadable = yield* makeSessionLedgerLive().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: { BEEP_SESSION_STATE_ROOT: root } })
          )
        );
        yield* fs.makeDirectory(path.join(root, sessionLedgerFileName(repository)));
        const listError = yield* unreadable.list(repository).pipe(Effect.flip);
        assert.instanceOf(listError, SessionLedgerError);
      })
    );
  });
});

describe("beep session", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })((it) => {
    it.effect("notes a lane, lists it, supersedes it, and retires it on sweep-done", () =>
      withScratchCheckout(({ clone, lane, stateRoot }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const facts = yield* sessionCheckoutFacts(lane);
          expect(facts.repository).toStrictEqual(repository);
          expect(facts.lane).toBe("lane");
          expect(facts.branch).toBe("feat/lane");
          expect(facts.clone).toBe(path.resolve(clone));

          const noted = yield* captureOutput(
            withCwd(
              lane,
              runSession([
                "note",
                "--state",
                "blocked",
                "--next",
                " operator merges ",
                "--summary",
                "PR green",
                "--pr",
                "7",
              ])
            )
          );
          expect(noted).toContain("[session] noted blocked for lane (feat/lane): operator merges");
          const file = path.join(stateRoot, sessionLedgerFileName(repository));
          expect(decodeSessionLedger(yield* fs.readFileString(file)).rows[0]?.harness).toBe("codex");

          const open = yield* captureOutput(withCwd(clone, runSession(["open"])));
          expect(open).toContain("1 live session(s) for beep-effect/beep-effect");
          expect(open).toContain("- blocked lane (feat/lane, PR #7)");
          expect(open).toContain("  summary: PR green");

          yield* captureOutput(withCwd(lane, runSession(["note", "--next", "publish"])));
          const json = yield* captureOutput(withCwd(clone, runSession(["open", "--json"])));
          expect(json).toContain('"schemaVersion":"session-open/v1"');
          expect(json).toContain('"next":"publish"');
          expect(json).not.toContain("operator merges");

          yield* recordSweepDone({ gitCwd: clone, checkout: path.resolve(lane), branch: "feat/lane" });
          const after = yield* captureOutput(withCwd(clone, runSession(["open"])));
          expect(after).toContain("no live sessions recorded");
          // A checkout git cannot read is ignored by the best-effort sweep row.
          yield* recordSweepDone({ gitCwd: path.join(clone, "missing"), checkout: lane, branch: "x" });
        })
      )
    );

    it.effect("rejects a bad state, an empty next step, and a non-positive pr", () =>
      withScratchCheckout(({ lane }) =>
        Effect.gen(function* () {
          for (const args of [
            ["note", "--state", "paused", "--next", "x"],
            ["note", "--next", "   "],
            ["note", "--next", "x", "--pr", "0"],
          ]) {
            const exit = yield* Effect.exit(withCwd(lane, runSession(args)));
            expect(exit._tag).toBe("Failure");
          }
          const outside = yield* Effect.exit(withCwd("/", runSession(["open"])));
          expect(outside._tag).toBe("Failure");
          const usage = yield* captureOutput(runSession([]));
          expect(usage).toContain("Session commands:");
        })
      )
    );
  });
});
