import {
  CLAUDE_WORKTREES_RELATIVE_ROOT,
  WorktreeRemovalReceipt,
  WorktreeRemovalServiceLive,
} from "@beep/repo-cli/commands/Worktree";
import { RepoRunContext } from "@beep/repo-cli/test/RepoRun";
import {
  planRetire,
  renderRetirement,
  retirementFailureMessage,
  runYeetSweep,
  YeetRetirePlan,
  YeetRetireSweepPlanJson,
  YeetRetireSweepReportJson,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Console, Effect, FileSystem, Layer, Path, pipe, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  WorktreeRemovalServiceLive.pipe(Layer.provide(NodeServices.layer))
);

const runGit = Effect.fn("YeetRetireTest.runGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });
  expect(yield* handle.exitCode).toBe(0);
});

const runGitText = Effect.fn("YeetRetireTest.runGitText")(function* (cwd: string, args: ReadonlyArray<string>) {
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

const ghLayer = (headRefOid: string, state: "MERGED" | "OPEN") =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const real = yield* ChildProcessSpawner.ChildProcessSpawner;
      const output = Stream.make(
        new TextEncoder().encode(
          JSON.stringify({
            number: 1,
            headRefName: "claude/lane",
            state,
            headRefOid,
          })
        )
      );
      const handle = ChildProcessSpawner.makeHandle({
        all: output,
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        pid: ChildProcessSpawner.ProcessId(1),
        stderr: Stream.empty,
        stdin: Sink.drain,
        stdout: output,
        unref: Effect.succeed(Effect.void),
      });
      return ChildProcessSpawner.make((command) =>
        ChildProcess.isStandardCommand(command) && command.command === "gh"
          ? Effect.succeed(handle)
          : real.spawn(command)
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
    })
  );
  return A.join(A.map(output, String), "\n");
});

const withScratchRepo = <A, E, R>(
  use: (fixture: {
    repoRoot: string;
    lane: string;
    tip: string;
    packetDir: string;
    residueRoot: string;
  }) => Effect.Effect<A, E, R>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // The CLI moves its own cwd into the owning clone while retiring, and
      // that clone is this scratch tree; put the process back before the tree
      // is deleted so the next test does not inherit a vanished cwd.
      const previousCwd = process.cwd();
      yield* Effect.addFinalizer(() => Effect.sync(() => process.chdir(previousCwd)));
      const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-retire-test-" });
      const repoRoot = path.join(tmp, "main");
      const origin = path.join(tmp, "origin.git");
      yield* fs.makeDirectory(repoRoot);
      yield* fs.makeDirectory(origin);
      yield* runGit(origin, ["init", "--bare", "-b", "main"]);
      yield* runGit(repoRoot, ["init", "-b", "main"]);
      for (const root of [origin, repoRoot]) {
        yield* runGit(root, ["config", "user.email", "yeet-retire-test@example.com"]);
        yield* runGit(root, ["config", "user.name", "Yeet Retire Test"]);
        yield* runGit(root, ["config", "commit.gpgsign", "false"]);
      }
      yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# scratch\n");
      yield* runGit(repoRoot, ["add", "README.md"]);
      yield* runGit(repoRoot, ["commit", "-m", "init"]);
      yield* runGit(repoRoot, ["remote", "add", "origin", origin]);
      yield* runGit(repoRoot, ["push", "--set-upstream", "origin", "main"]);
      const lane = path.join(repoRoot, CLAUDE_WORKTREES_RELATIVE_ROOT, "lane");
      yield* runGit(repoRoot, ["worktree", "add", "-b", "claude/lane", lane]);
      yield* fs.writeFileString(path.join(lane, "lane.txt"), "merged lane\n");
      yield* runGit(lane, ["add", "lane.txt"]);
      yield* runGit(lane, ["commit", "-m", "lane"]);
      yield* runGit(lane, ["push", "origin", "claude/lane"]);
      yield* runGit(lane, ["push", "origin", "claude/lane:main"]);
      yield* runGit(repoRoot, ["fetch", "origin"]);
      const tip = yield* runGitText(lane, ["rev-parse", "HEAD"]);
      expect(yield* runGitText(repoRoot, ["rev-parse", "main"])).not.toBe(tip);
      const residueRoot = path.join(tmp, "test-residue");
      yield* use({ repoRoot, lane, tip, packetDir: path.join(tmp, "packet"), residueRoot }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({
            env: { HOME: tmp, BEEP_WORKTREE_RESIDUE_ROOT: residueRoot },
          })
        )
      );
    }).pipe(provideScopedLayer(testLayer))
  );

const sweep = (
  packetDir: string,
  extra: Partial<{
    readonly plan: boolean;
    readonly json: boolean;
    readonly branch: string;
    readonly lane: O.Option<string>;
  }> = {}
) =>
  runYeetSweep({
    base: "origin/main",
    head: "HEAD",
    packetDir,
    branch: "",
    json: false,
    plan: false,
    retire: true,
    ...extra,
  });

// The real working directory, not the `process.cwd` override `withCwd` installs:
// the archive fence reads `/proc`, so only the OS-level cwd counts for it.
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

describe("yeet sweep --retire", { concurrent: false }, () => {
  it.effect("retires the merged nested lane, deletes its branch, and fast-forwards the owning clone", () =>
    withScratchRepo(({ repoRoot, lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const output = yield* captureOutput(
          withCwd(lane, sweep(packetDir)).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        expect(yield* fs.exists(lane)).toBe(false);
        expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
        expect(yield* runGitText(repoRoot, ["rev-parse", "main"])).toBe(tip);
        expect(yield* runGitText(repoRoot, ["rev-parse", "origin/main"])).toBe(tip);
        expect(output).toContain("[yeet] retired");
        expect(output).toContain("branch claude/lane: deleted");
      })
    )
  );

  it.effect("refuses to retire a lane whose pull request is not MERGED", () =>
    withScratchRepo(({ lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const error = yield* withCwd(lane, sweep(packetDir)).pipe(
          provideScopedLayer(ghLayer(tip, "OPEN")),
          Effect.flip
        );
        expect(error._tag).toBe("YeetCommandError");
        expect(error.message).toContain("not MERGED");
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("refuses retirement from the clone itself", () =>
    withScratchRepo(({ repoRoot, lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const error = yield* withCwd(repoRoot, sweep(packetDir)).pipe(
          provideScopedLayer(ghLayer(tip, "MERGED")),
          Effect.flip
        );
        expect(error._tag).toBe("YeetCommandError");
        expect(error.message).toContain("is the clone itself");
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("prints the retirement plan and MERGED gate without removing the lane", () =>
    withScratchRepo(({ repoRoot, lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const before = yield* runGitText(repoRoot, ["rev-parse", "main"]);
        const output = yield* captureOutput(
          withCwd(lane, sweep(packetDir, { plan: true })).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        expect(output).toContain("[yeet] retire");
        expect(output).toContain("gate: pull request MERGED");
        expect(yield* fs.exists(lane)).toBe(true);
        expect(yield* runGitText(repoRoot, ["rev-parse", "claude/lane"])).toBe(tip);
        expect(yield* runGitText(repoRoot, ["rev-parse", "main"])).toBe(before);
      })
    )
  );

  it.effect("archives untracked residue before retiring the merged lane", () =>
    withScratchRepo(({ lane, tip, packetDir, residueRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fs.writeFileString(path.join(lane, "recovery.txt"), "recover me\n");
        const output = yield* captureOutput(
          withCwd(lane, sweep(packetDir)).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        expect(yield* fs.exists(lane)).toBe(false);
        expect(output).toContain("archived under");
        const repositories = yield* fs.readDirectory(residueRoot);
        expect(repositories).toHaveLength(1);
        const repositoryRoot = path.join(residueRoot, O.getOrThrow(A.head(repositories)));
        const archives = yield* fs.readDirectory(repositoryRoot);
        expect(archives).toHaveLength(1);
        const archiveRoot = path.join(repositoryRoot, O.getOrThrow(A.head(archives)));
        expect(yield* fs.exists(path.join(archiveRoot, "manifest.json"))).toBe(true);
        expect(yield* fs.readFileString(path.join(archiveRoot, "untracked", "recovery.txt"))).toBe("recover me\n");
      })
    )
  );

  it.effect("prints the blocker in plan mode when the pull request is not MERGED", () =>
    withScratchRepo(({ lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const output = yield* captureOutput(
          withCwd(lane, sweep(packetDir, { plan: true })).pipe(provideScopedLayer(ghLayer(tip, "OPEN")))
        );
        expect(output).toContain("blocked: the pull request for claude/lane is OPEN, not MERGED");
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("reports a git failure while planning a retirement outside any repository", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const bare = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-retire-nongit-" });
        const context = RepoRunContext.make({
          base: "origin/main",
          branch: "claude/lane",
          cwd: bare,
          head: "HEAD",
          originalArgv: [],
          packetDir: bare,
          repoRoot: bare,
          turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
        });
        const error = yield* Effect.flip(planRetire(context, O.none()));
        expect(error._tag).toBe("YeetCommandError");
        expect(error.message).toContain("git rev-parse --path-format=absolute --git-common-dir exited with");
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it("appends the working form only when a holder blocked the retirement", () => {
    const plan = YeetRetirePlan.make({
      worktreePath: "/clones/x/.claude/worktrees/lane",
      owningClone: "/clones/x",
      name: "lane",
      branch: "claude/lane",
    });
    expect(retirementFailureMessage(plan, "pid 7 via cwd still hold it, and any write would be lost.")).toContain(
      'cd "/clones/x" && bun run beep yeet sweep --retire --lane "/clones/x/.claude/worktrees/lane"'
    );
    expect(retirementFailureMessage(plan, "Could not write the residue manifest.")).not.toContain("--lane");
    expect(pipe(plan, retirementFailureMessage("disk full"))).toBe(retirementFailureMessage(plan, "disk full"));
  });

  it.effect("refuses --lane that belongs to another clone of the repository", () =>
    withScratchRepo(({ repoRoot, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const origin = yield* runGitText(repoRoot, ["remote", "get-url", "origin"]);
        const other = path.join(path.dirname(repoRoot), "other");
        yield* runGit(path.dirname(repoRoot), ["clone", "--quiet", origin, other]);
        const otherLane = path.join(other, CLAUDE_WORKTREES_RELATIVE_ROOT, "lane");
        yield* fs.makeDirectory(path.dirname(otherLane), { recursive: true });
        yield* runGit(other, ["worktree", "add", "-b", "claude/elsewhere", otherLane]);
        const error = yield* Effect.flip(
          withCwd(repoRoot, sweep(packetDir, { lane: O.some(otherLane) })).pipe(
            provideScopedLayer(ghLayer(tip, "MERGED"))
          )
        );
        expect(error.message).toContain(`belongs to ${other}, not to the clone this command runs in`);
      })
    )
  );

  it("renders a retirement that archived nothing and kept its branch", () => {
    const plan = YeetRetirePlan.make({
      worktreePath: "/clones/x/.claude/worktrees/lane",
      owningClone: "/clones/x",
      name: "lane",
      branch: "claude/lane",
    });
    const receipt = WorktreeRemovalReceipt.make({
      targetPath: plan.worktreePath,
      branch: O.some(plan.branch),
      reason: "clean",
      manifest: O.none(),
      branchDeleted: false,
    });
    const text = renderRetirement(plan, receipt);
    expect(text).toContain("[yeet] retired /clones/x/.claude/worktrees/lane into /clones/x");
    expect(text).toContain("residue: clean");
    expect(text).not.toContain("archived under");
    expect(text).toContain("branch claude/lane: kept");
    expect(pipe(plan, renderRetirement(receipt))).toBe(text);
  });

  it.effect("retires a lane named with --lane from the owning clone", () =>
    withScratchRepo(({ repoRoot, lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const output = yield* captureOutput(
          withCwd(repoRoot, sweep(packetDir, { lane: O.some(lane) })).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        expect(yield* fs.exists(lane)).toBe(false);
        expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
        expect(yield* runGitText(repoRoot, ["rev-parse", "main"])).toBe(tip);
        expect(output).toContain(`[yeet] retired ${lane}`);
      })
    )
  );

  it.effect("refuses --lane when it names the clone itself", () =>
    withScratchRepo(({ repoRoot, tip, packetDir }) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          withCwd(repoRoot, sweep(packetDir, { lane: O.some(repoRoot) })).pipe(
            provideScopedLayer(ghLayer(tip, "MERGED"))
          )
        );
        expect(error.message).toContain("is the clone itself");
      })
    )
  );

  it.effect("refuses --lane on a detached lane, which has no branch to retire", () =>
    withScratchRepo(({ repoRoot, lane, tip, packetDir }) =>
      Effect.gen(function* () {
        yield* runGit(lane, ["checkout", "--detach"]);
        const error = yield* Effect.flip(
          withCwd(repoRoot, sweep(packetDir, { lane: O.some(lane) })).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        expect(error.message).toContain("detached HEAD has nothing to retire");
      })
    )
  );

  it.effect("retires the lane the process is actually standing in", () =>
    withScratchRepo(({ repoRoot, lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The real cwd is inside the lane, exactly where an agent's shell and
        // session sit; the CLI moves itself out and the fence exempts the rest.
        yield* withRealCwd(
          lane,
          Effect.gen(function* () {
            yield* captureOutput(withCwd(lane, sweep(packetDir)).pipe(provideScopedLayer(ghLayer(tip, "MERGED"))));
            expect(process.cwd()).toBe(repoRoot);
          })
        );
        expect(yield* fs.exists(lane)).toBe(false);
        expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
      })
    )
  );

  it.effect("refuses while another process holds the lane and prints the working form", () =>
    withScratchRepo(({ repoRoot, lane, tip, packetDir }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const holder = yield* ChildProcess.make("sleep", ["60"], {
            cwd: lane,
            stdin: "ignore",
            stdout: "ignore",
            stderr: "ignore",
          });
          const error = yield* Effect.flip(
            withCwd(lane, sweep(packetDir)).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
          ).pipe(Effect.ensuring(Effect.ignore(holder.kill())));
          expect(error.message).toContain("still hold it");
          expect(error.message).toContain(`cd "${repoRoot}" && bun run beep yeet sweep --retire --lane "${lane}"`);
          expect(yield* fs.exists(lane)).toBe(true);
        })
      )
    )
  );

  it.effect("refuses --branch alongside --retire", () =>
    withScratchRepo(({ lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const error = yield* Effect.flip(
          withCwd(lane, sweep(packetDir, { branch: "claude/other" })).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        expect(error.message).toContain("--branch cannot override it");
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("prints one decodable document in JSON mode for the plan and the run", () =>
    withScratchRepo(({ lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const planOutput = yield* captureOutput(
          withCwd(lane, sweep(packetDir, { plan: true, json: true })).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        const plan = yield* YeetRetireSweepPlanJson.decode(planOutput);
        expect(plan.retire.branch).toBe("claude/lane");
        expect(O.isNone(plan.blocker)).toBe(true);
        expect(plan.sweep.steps.length).toBeGreaterThan(0);
        const runOutput = yield* captureOutput(
          withCwd(lane, sweep(packetDir, { json: true })).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        const report = yield* YeetRetireSweepReportJson.decode(runOutput);
        expect(report.receipt.branchDeleted).toBe(true);
        expect(report.sweep.steps.length).toBeGreaterThan(0);
      })
    )
  );
});
