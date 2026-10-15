import {
  CLAUDE_WORKTREES_RELATIVE_ROOT,
  invokerExemption,
  WorktreeRemovalServiceLive,
  worktreeCommand,
} from "@beep/repo-cli/commands/Worktree";
import {
  ProcessTable,
  ProcessTableEntry,
  processTableWithLineage,
  procProcessTable,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

// The same fence `yeet sweep --retire` runs behind, reached through
// `worktree remove --archive --delete-branch`: the invoker's ancestry and its
// proven session are exempt, an idle desktop Terminal panel shell is set aside
// only when the command starts inside the lane, and every other holder refuses.

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  WorktreeRemovalServiceLive.pipe(Layer.provide(NodeServices.layer))
);

const runGit = Effect.fn("WorktreeRemoveFenceTest.runGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });
  expect(yield* handle.exitCode).toBe(0);
});

const runGitText = Effect.fn("WorktreeRemoveFenceTest.runGitText")(function* (
  cwd: string,
  args: ReadonlyArray<string>
) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  expect(yield* handle.exitCode).toBe(0);
  return Str.trim(output);
});

// The `process.cwd` override the command resolves its clone from, as the
// nested-removal test installs it; the OS-level cwd is a separate matter.
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

// The real working directory: the archive fence reads `/proc`, so only the
// OS-level cwd counts for it, and the command moves it when it starts inside
// the lane it removes.
const withRealCwd = <A, E, R>(cwd: string, effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = process.cwd();
      process.chdir(cwd);
      return previous;
    }),
    () => effect,
    (previous) =>
      Effect.sync(() => {
        process.chdir(previous);
      })
  );

const withEnv = <A, E, R>(env: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
    })
  );
  return A.join(A.map(output, String), "\n");
});

const failureMessage = (error: unknown): string =>
  P.hasProperty(error, "message") && P.isString(error.message) ? error.message : String(error);

// A clone with a nested Claude Code lane whose only commit is already on
// origin/main, so archive mode finds nothing to preserve and deletes the branch.
const withScratchRepo = <A, E, R>(
  use: (fixture: { repoRoot: string; lane: string; env: Record<string, string> }) => Effect.Effect<A, E, R>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // The command moves its own cwd into the clone while removing the lane it
      // stands in, and that clone is this scratch tree; put the process back
      // before the tree is deleted so the next test does not inherit a vanished cwd.
      const previousCwd = process.cwd();
      yield* Effect.addFinalizer(() => Effect.sync(() => process.chdir(previousCwd)));
      const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "worktree-remove-fence-test-" });
      const repoRoot = path.join(tmp, "main");
      const origin = path.join(tmp, "origin.git");
      yield* fs.makeDirectory(repoRoot);
      yield* fs.makeDirectory(origin);
      yield* runGit(origin, ["init", "--bare", "-b", "main"]);
      yield* runGit(repoRoot, ["init", "-b", "main"]);
      for (const root of [origin, repoRoot]) {
        yield* runGit(root, ["config", "user.email", "worktree-remove-fence-test@example.com"]);
        yield* runGit(root, ["config", "user.name", "Worktree Remove Fence Test"]);
        yield* runGit(root, ["config", "commit.gpgsign", "false"]);
      }
      yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# scratch\n");
      yield* runGit(repoRoot, ["add", "README.md"]);
      yield* runGit(repoRoot, ["commit", "-m", "init"]);
      yield* runGit(repoRoot, ["remote", "add", "origin", origin]);
      yield* runGit(repoRoot, ["push", "--set-upstream", "origin", "main"]);
      const lane = path.join(repoRoot, CLAUDE_WORKTREES_RELATIVE_ROOT, "lane");
      yield* runGit(repoRoot, ["worktree", "add", "-b", "claude/lane", lane]);
      // The fixture env stands in for the process environment, so the real
      // session's CLAUDE_PID never leaks into a test: each case names its own.
      const env = { HOME: tmp, BEEP_WORKTREE_RESIDUE_ROOT: path.join(tmp, "test-residue") };
      yield* use({ repoRoot, lane, env }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))
      );
    }).pipe(provideScopedLayer(testLayer))
  );

const remove = (cwd: string) =>
  withCwd(
    cwd,
    Command.runWith(worktreeCommand, { version: "0.0.0" })(["remove", "lane", "--archive", "--delete-branch"])
  );

const spawnSleepIn = (cwd: string) =>
  ChildProcess.make("sleep", ["60"], { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" });

// A holder that descends from this process without being it: `sh` forks the
// sleep, so the lane is held by a child and a grandchild of the test process,
// which is where a session's MCP servers and their workers sit.
const spawnLaneHolder = (lane: string) =>
  ChildProcess.make("sh", ["-c", "sleep 60; true"], {
    cwd: lane,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });

// A real lane holder dressed, through scripted lineage, as the Claude Desktop
// app's Terminal-panel shell at its prompt: a `zsh` row whose parent is the
// app (55), that owns a pty, and whose foreground group is its own pid.
const desktopPanelTable = (holder: number) =>
  processTableWithLineage({
    base: procProcessTable,
    self: process.pid,
    entries: [
      ProcessTableEntry.make({ pid: 55, parent: 1, command: "claude-desktop" }),
      ProcessTableEntry.make({
        pid: holder,
        parent: 55,
        command: "zsh",
        terminal: 34823,
        foregroundGroup: holder,
        contextSwitches: 41,
      }),
    ],
  });

const WORKTREE_REMOVE_FENCE_INVOKER = new URL("./support/WorktreeRemoveFenceInvoker.ts", import.meta.url).pathname;

const RemoveInvokerOutcome = S.Struct({ ok: S.Boolean, message: S.String });
const decodeRemoveInvokerOutcome = S.decodeUnknownEffect(S.fromJsonString(RemoveInvokerOutcome));

// The removal in its own process, started inside the lane, with this test
// process as the agent session above it: whatever CLAUDE_PID `env` carries
// lands in the invoker's real initial environment, which is the /proc view the
// fence proves against.
const runRemoveInvoker = Effect.fn("WorktreeRemoveFenceTest.runRemoveInvoker")(function* (
  lane: string,
  env: Record<string, string>
) {
  const handle = yield* ChildProcess.make("bun", ["run", WORKTREE_REMOVE_FENCE_INVOKER, "lane"], {
    cwd: lane,
    env,
    extendEnv: true,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = yield* handle.all.pipe(Stream.decodeText(), Stream.runCollect, Effect.map(A.join("")));
  const exitCode = yield* handle.exitCode;
  const line = O.getOrElse(A.findLast(Str.split(Str.trim(output), "\n"), Str.startsWith("{")), () => output);
  const outcome = yield* decodeRemoveInvokerOutcome(line);
  return { exitCode, ...outcome } as const;
});

describe("worktree remove archive fence", { concurrent: false }, () => {
  it.effect("names the invoker and steps out of the lane only when standing inside it", () =>
    withScratchRepo(({ repoRoot, lane, env }) =>
      Effect.gen(function* () {
        // Started inside the lane: the process moves to the clone and the
        // exemption says so; a malformed session pid is no session at all.
        const inside = yield* withRealCwd(
          lane,
          Effect.gen(function* () {
            const exemption = yield* withEnv({ ...env, CLAUDE_PID: "not-a-pid" }, invokerExemption(lane, repoRoot));
            expect(process.cwd()).toBe(repoRoot);
            return exemption;
          })
        );
        expect(inside.selfRetirement).toBe(true);
        assertNone(inside.sessionMarker);
        // Started elsewhere: nothing moves, and a well-formed pid names the session.
        const outside = yield* withRealCwd(
          repoRoot,
          withEnv({ ...env, CLAUDE_PID: String(process.pid) }, invokerExemption(lane, repoRoot))
        );
        expect(outside.selfRetirement).toBe(false);
        assertSome(
          O.map(outside.sessionMarker, (marker) => [marker.name, marker.pid]),
          ["CLAUDE_PID", process.pid]
        );
      })
    )
  );

  it.effect("removes the lane the process is actually standing in", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The real cwd is inside the lane, exactly where an agent's shell and
        // session sit; the command moves itself out and the fence exempts the rest.
        yield* withRealCwd(
          lane,
          Effect.gen(function* () {
            const output = yield* captureOutput(remove(lane));
            expect(output).toContain(`Worktree retirement complete: ${lane}`);
            expect(output).toContain("branch deleted: claude/lane");
            expect(process.cwd()).toBe(repoRoot);
          })
        );
        expect(yield* fs.exists(lane)).toBe(false);
        expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
      })
    )
  );

  it.effect("refuses while another process holds the lane", () =>
    withScratchRepo(({ lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const holder = yield* spawnSleepIn(lane);
        const error = yield* Effect.flip(remove(lane)).pipe(Effect.ensuring(Effect.ignore(holder.kill())));
        expect(failureMessage(error)).toContain("still hold it");
        expect(failureMessage(error)).toContain("(sleep) via cwd");
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("removes the lane under an idle Claude Desktop Terminal panel shell when started inside it", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The app starts this shell in the session folder whether or not the
        // operator ever opened the panel; at its prompt it writes nothing.
        const holder = yield* spawnSleepIn(lane);
        const output = yield* captureOutput(remove(lane)).pipe(
          Effect.provideService(ProcessTable, desktopPanelTable(holder.pid)),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        expect(output).toContain(
          `note: the idle Claude Desktop Terminal panel shell (pid ${holder.pid}) stood in the worktree and was left running; the worktree was removed under it, so run \`cd ~\` in that Terminal tab before using it`
        );
        expect(yield* fs.exists(lane)).toBe(false);
        expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
      })
    )
  );

  it.effect("refuses a foreign Claude Desktop Terminal panel shell when the removal starts outside the lane", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // Not started inside the lane: the shell may belong to the session that
        // still has the lane open, so the lane is not removed under it.
        const holder = yield* spawnSleepIn(lane);
        const error = yield* Effect.flip(remove(repoRoot)).pipe(
          Effect.provideService(ProcessTable, desktopPanelTable(holder.pid)),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        expect(failureMessage(error)).toContain(
          `pid ${holder.pid} (sleep) via cwd (the Claude Desktop Terminal panel shell) still hold it`
        );
        expect(failureMessage(error)).toContain("run `cd ~` in that Terminal tab");
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("exempts holders under the session that exported CLAUDE_PID to the invoker", () =>
    withScratchRepo(({ repoRoot, lane, env }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          // This test process is the session: it exports its own pid as CLAUDE_PID
          // to the invoker it spawns, and the lane holder is its other child, a
          // sibling of the invoker's chain, exactly where an MCP server sits.
          const holder = yield* spawnLaneHolder(lane);
          const outcome = yield* runRemoveInvoker(lane, { ...env, CLAUDE_PID: String(process.pid) }).pipe(
            Effect.ensuring(Effect.ignore(holder.kill()))
          );
          expect(outcome).toMatchObject({ ok: true, exitCode: 0 });
          expect(yield* fs.exists(lane)).toBe(false);
          expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
        })
      )
    )
  );

  it.effect("refuses the same holder when the invoker was started with CLAUDE_PID naming init", () =>
    withScratchRepo(({ lane, env }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          // Same topology, but the marker in the invoker's real environment claims
          // pid 1: an ancestor of everything that never exported it, so nothing on
          // the invoker's path vouches for it and the sibling holder still blocks.
          const holder = yield* spawnLaneHolder(lane);
          const outcome = yield* runRemoveInvoker(lane, { ...env, CLAUDE_PID: "1" }).pipe(
            Effect.ensuring(Effect.ignore(holder.kill()))
          );
          expect(outcome.ok).toBe(false);
          expect(outcome.message).toContain("still hold it");
          expect(outcome.message).toContain("(sh) via cwd");
          expect(yield* fs.exists(lane)).toBe(true);
        })
      )
    )
  );

  it.effect("refuses the holder when CLAUDE_PID names a pid off the invoker's path", () =>
    withScratchRepo(({ lane, env }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const holder = yield* spawnLaneHolder(lane);
          // The holder's own pid sits in its ancestry but nowhere on the invoker's
          // path, so no process below it can carry the marker and the proof fails.
          const error = yield* Effect.flip(withEnv({ ...env, CLAUDE_PID: String(holder.pid) }, remove(lane))).pipe(
            Effect.ensuring(Effect.ignore(holder.kill()))
          );
          expect(failureMessage(error)).toContain("still hold it");
          expect(failureMessage(error)).toContain("(sh) via cwd");
          expect(yield* fs.exists(lane)).toBe(true);
        })
      )
    )
  );
});
