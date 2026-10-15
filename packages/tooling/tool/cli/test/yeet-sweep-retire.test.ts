import {
  CLAUDE_WORKTREES_RELATIVE_ROOT,
  WorktreeRemovalReceipt,
  WorktreeRemovalRequest,
  WorktreeRemovalService,
  WorktreeRemovalServiceLive,
} from "@beep/repo-cli/commands/Worktree";
import {
  ProcessStatus,
  ProcessTable,
  ProcessTableEntry,
  processTableWithLineage,
  procProcessTable,
  RepoRunContext,
} from "@beep/repo-cli/test/RepoRun";
import { GhPrView } from "@beep/repo-cli/test/SharedInternals";
import {
  planRetire,
  renderRetireGate,
  renderRetirement,
  retireInvokingWorktree,
  retirementFailureMessage,
  retireVerdict,
  runYeetSweep,
  SweepGitState,
  YeetRetirePlan,
  YeetRetireSweepPlanJson,
  YeetRetireSweepReportJson,
  YeetRetireVerdict,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

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

const encodePrView = S.encodeEffect(S.fromJsonString(GhPrView));
const encodePacketLifecycle = S.encodeEffect(
  S.fromJsonString(
    S.Struct({
      lifecycle: S.String,
      statusNote: S.optionalKey(S.String),
      blockedBy: S.String.pipe(S.Array, S.optionalKey),
    })
  )
);

const encodePrFiles = S.encodeEffect(S.fromJsonString(S.Struct({ files: S.Array(S.Struct({ path: S.String })) })));

// `none` is a branch that never headed a pull request: `gh pr view` exits 1
// with its "no pull requests found" line, which the sweep reads as no
// observation rather than as a failure.
type FakePullRequestState = "MERGED" | "OPEN" | "none";

const ghSpawner = Effect.fn("YeetRetireTest.ghSpawner")(function* (
  headRefOid: string,
  state: FakePullRequestState,
  files: ReadonlyArray<string> = [],
  filesExitCode = ChildProcessSpawner.ExitCode(0)
) {
  const real = yield* ChildProcessSpawner.ChildProcessSpawner;
  // The fake answers with the same documents a real `gh pr view --json`
  // prints, encoded through the schemas the sweep decodes them with: the
  // pull request view, or its file list when `--json files` is asked for.
  const viewText =
    state === "none"
      ? 'no pull requests found for branch "claude/lane"'
      : yield* encodePrView(GhPrView.make({ number: 1, headRefName: "claude/lane", state, headRefOid }));
  const viewExitCode = ChildProcessSpawner.ExitCode(state === "none" ? 1 : 0);
  const filesText = yield* encodePrFiles({ files: A.map(files, (path) => ({ path })) });
  const handleFor = (text: string, exitCode = ChildProcessSpawner.ExitCode(0)) => {
    const output = Stream.make(new TextEncoder().encode(text));
    return ChildProcessSpawner.makeHandle({
      all: output,
      exitCode: Effect.succeed(exitCode),
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
  };
  return ChildProcessSpawner.make((command) =>
    ChildProcess.isStandardCommand(command) && command.command === "gh"
      ? Effect.succeed(
          A.contains(command.args, "files") ? handleFor(filesText, filesExitCode) : handleFor(viewText, viewExitCode)
        )
      : real.spawn(command)
  );
});

const ghLayer = (headRefOid: string, state: FakePullRequestState, files: ReadonlyArray<string> = []) =>
  Layer.effect(ChildProcessSpawner.ChildProcessSpawner, ghSpawner(headRefOid, state, files));

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

// `remoteBranch: false` is a lane whose branch was never pushed: its tip still
// reaches origin/main (pushed straight there), but no `origin/claude/lane`
// and no pull request ever existed.
const withScratchRepo = <A, E, R>(
  use: (fixture: {
    repoRoot: string;
    lane: string;
    tip: string;
    packetDir: string;
    residueRoot: string;
    env: Record<string, string>;
  }) => Effect.Effect<A, E, R>,
  options: { readonly remoteBranch?: boolean } = {}
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
      if (options.remoteBranch !== false) {
        yield* runGit(lane, ["push", "origin", "claude/lane"]);
      }
      yield* runGit(lane, ["push", "origin", "claude/lane:main"]);
      yield* runGit(repoRoot, ["fetch", "origin"]);
      const tip = yield* runGitText(lane, ["rev-parse", "HEAD"]);
      expect(yield* runGitText(repoRoot, ["rev-parse", "main"])).not.toBe(tip);
      const residueRoot = path.join(tmp, "test-residue");
      // The fixture env stands in for the process environment, so the real
      // session's CLAUDE_PID never leaks into a test: each case names its own.
      const env = { HOME: tmp, BEEP_WORKTREE_RESIDUE_ROOT: residueRoot };
      yield* use({ repoRoot, lane, tip, packetDir: path.join(tmp, "packet"), residueRoot, env }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))
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

// Re-provide the fixture environment with one more key, such as the session
// pid the harness exports for its tool shells.
const withEnv = <A, E, R>(env: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

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
// app's Terminal-panel shell: a `zsh` row whose parent is the app (55) and that
// owns a pty. At its prompt the terminal's foreground group is its own pid;
// `foregroundGroup` set to anything else is a command running in it. Its
// context-switch count stays put, which is a shell that never woke.
const desktopPanelTable = (holder: number, foregroundGroup = holder) =>
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
        foregroundGroup,
        contextSwitches: 41,
      }),
    ],
  });

// The same idle panel shell, except it wakes every time it is looked at: each
// status read reports one more context switch, as a shell that ran a builtin
// such as `echo x >> notes` between the fence's scans would.
const wakingPanelTable = (holder: number) => {
  const table = desktopPanelTable(holder);
  const switches = MutableRef.make(0);
  return {
    ...table,
    status: (pid: number) =>
      pid === holder
        ? Effect.sync(() =>
            O.some(
              ProcessStatus.make({
                pid,
                parent: 55,
                command: "zsh",
                contextSwitches: O.some(switches.pipe(MutableRef.incrementAndGet)),
              })
            )
          )
        : table.status(pid),
  };
};

const spawnSleepIn = (cwd: string) =>
  ChildProcess.make("sleep", ["60"], { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" });

// A holder that stands outside the lane but keeps `lane.txt` open: it opens the
// file, leaves for `/`, says so on stdout, and execs into `sleep`. The retirement
// starts only after that line, so the fence sees only the descriptor.
const spawnDescriptorHolder = Effect.fn("YeetRetireTest.spawnDescriptorHolder")(function* (lane: string) {
  const holder = yield* ChildProcess.make("sh", ["-c", "exec 3<lane.txt; cd /; echo held; exec sleep 60"], {
    cwd: lane,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore",
  });
  const ready = yield* holder.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead);
  assertSome(ready, "held");
  return holder;
});

// The facts the retirement gate reads for a merged lane, as the support invoker
// states them: the lane's pull request is MERGED and heads its branch.
const retireMergedLane = (repoRoot: string, lane: string) =>
  retireInvokingWorktree(
    YeetRetirePlan.make({ worktreePath: lane, owningClone: repoRoot, name: "lane", branch: "claude/lane" }),
    SweepGitState.make({
      branch: "claude/lane",
      mainBranch: "main",
      headBranch: "claude/lane",
      worktreeDirty: false,
      mainCheckedOutElsewhere: false,
      branchCheckedOutElsewhere: false,
      branchMergedIntoBase: true,
      lockfileMovedOnMainUpdate: false,
      statusProbeUnreliable: false,
      worktreeProbeUnreliable: false,
      pullRequestState: O.some("MERGED"),
      pullRequestHeadBranch: O.some("claude/lane"),
    })
  );

const RETIRE_FENCE_INVOKER = new URL("./support/RetireFenceInvoker.ts", import.meta.url).pathname;

const RetireInvokerOutcome = S.Struct({ ok: S.Boolean, message: S.String });
const decodeRetireInvokerOutcome = S.decodeUnknownEffect(S.fromJsonString(RetireInvokerOutcome));
const encodeRetireInvokerOutcome = S.encodeEffect(S.fromJsonString(RetireInvokerOutcome));

// The retirement step in its own process, with this test process as the agent
// session above it: whatever CLAUDE_PID `env` carries lands in the invoker's
// real initial environment, which is the /proc view the fence proves against.
const runRetireInvoker = Effect.fn("YeetRetireTest.runRetireInvoker")(function* (
  lane: string,
  owningClone: string,
  env: Record<string, string>
) {
  const handle = yield* ChildProcess.make(
    "bun",
    ["run", RETIRE_FENCE_INVOKER, lane, owningClone, "lane", "claude/lane"],
    {
      cwd: lane,
      env,
      extendEnv: true,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const output = yield* handle.all.pipe(Stream.decodeText(), Stream.runCollect, Effect.map(A.join("")));
  const exitCode = yield* handle.exitCode;
  const line = O.getOrElse(A.findLast(Str.split(Str.trim(output), "\n"), Str.startsWith("{")), () => output);
  const outcome = yield* decodeRetireInvokerOutcome(line);
  return { exitCode, ...outcome } as const;
});

describe("yeet sweep --retire", { concurrent: false }, () => {
  it.effect.prop(
    "roundtrips retirement plans through the JSON boundary",
    [Arbitrary.schema(YeetRetirePlan)],
    Effect.fn(function* ([plan]) {
      const codec = S.fromJsonString(YeetRetirePlan);
      const encoded = yield* S.encodeEffect(codec)(plan);
      const decoded = yield* S.decodeEffect(codec)(encoded);
      expect(S.toEquivalence(YeetRetirePlan)(plan, decoded)).toBe(true);
    }),
    { arbitrary: { runs: 20 } }
  );

  it.effect.prop(
    "roundtrips retirement verdicts through the JSON boundary",
    [Arbitrary.schema(YeetRetireVerdict)],
    Effect.fn(function* ([verdict]) {
      const codec = S.fromJsonString(YeetRetireVerdict);
      const encoded = yield* S.encodeEffect(codec)(verdict);
      const decoded = yield* S.decodeEffect(codec)(encoded);
      expect(S.toEquivalence(YeetRetireVerdict)(verdict, decoded)).toBe(true);
    }),
    { arbitrary: { runs: 20 } }
  );

  it("judges a lane by its pull request when one was observed, otherwise by git", () => {
    const plan = YeetRetirePlan.make({
      worktreePath: "/clones/x/.claude/worktrees/lane",
      owningClone: "/clones/x",
      name: "lane",
      branch: "claude/lane",
    });
    const tip = "1ed08f66df016a18c6d7d56bd97aa778912cb37b";
    const base = SweepGitState.make({
      branch: "claude/lane",
      mainBranch: "main",
      headBranch: "claude/lane",
      worktreeDirty: false,
      mainCheckedOutElsewhere: false,
      branchCheckedOutElsewhere: false,
      branchMergedIntoBase: true,
      lockfileMovedOnMainUpdate: false,
      statusProbeUnreliable: false,
      worktreeProbeUnreliable: false,
      localTip: O.some(tip),
    });
    // No pull request, tip on origin/main, clean tree: the lane landed some other way.
    const prLess = retireVerdict(plan, base);
    expect(prLess).toEqual(YeetRetireVerdict.cases["pr-less-on-main"].make({ tip, mainBranch: "main" }));
    expect(renderRetireGate(prLess)).toBe(
      `  gate: no pull request; tip ${tip} is already on origin/main and the lane is clean`
    );
    expect(pipe(plan, retireVerdict(base))).toEqual(prLess);
    // Without a pull request, only git can vouch: an unmerged tip or a dirty tree refuses.
    expect(retireVerdict(plan, SweepGitState.make({ ...base, branchMergedIntoBase: false }))).toEqual(
      YeetRetireVerdict.cases.refused.make({
        reason: `no pull request was observed for claude/lane and its tip ${tip} is not contained in origin/main`,
      })
    );
    expect(retireVerdict(plan, SweepGitState.make({ ...base, worktreeDirty: true }))).toEqual(
      YeetRetireVerdict.cases.refused.make({
        reason: "no pull request was observed for claude/lane and the lane has uncommitted changes",
      })
    );
    // An observed pull request decides on its own, whatever git says about the tip.
    const merged = SweepGitState.make({
      ...base,
      branchMergedIntoBase: false,
      pullRequestState: O.some("MERGED"),
      pullRequestHeadBranch: O.some("claude/lane"),
    });
    expect(retireVerdict(plan, merged)).toEqual(YeetRetireVerdict.cases["pr-merged"].make({}));
    expect(renderRetireGate(retireVerdict(plan, merged))).toBe("  gate: pull request MERGED");
    expect(retireVerdict(plan, SweepGitState.make({ ...merged, pullRequestState: O.some("OPEN") }))).toEqual(
      YeetRetireVerdict.cases.refused.make({ reason: "the pull request for claude/lane is OPEN, not MERGED" })
    );
    const elsewhere = retireVerdict(
      plan,
      SweepGitState.make({ ...merged, pullRequestHeadBranch: O.some("claude/other") })
    );
    expect(elsewhere).toEqual(
      YeetRetireVerdict.cases.refused.make({ reason: "the resolved pull request heads claude/other, not claude/lane" })
    );
    expect(renderRetireGate(elsewhere)).toBe(
      "  blocked: the resolved pull request heads claude/other, not claude/lane"
    );
  });

  it.effect.prop(
    "generated retire-invoker outcomes round-trip through the JSON line the invoker prints",
    { outcome: Arbitrary.schema(RetireInvokerOutcome) },
    ({ outcome }) =>
      Effect.gen(function* () {
        const line = yield* encodeRetireInvokerOutcome(outcome);
        expect(yield* decodeRetireInvokerOutcome(line)).toEqual(outcome);
      })
  );

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
        // The retirement deleted the branch before the sweep observed the clone.
        expect(output).toContain("delete-local-branch: skipped: local branch claude/lane is already deleted");
        expect(output).not.toContain("local tip <absent>");
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

  it.effect("retires a lane that never headed a pull request once origin/main contains its tip", () =>
    withScratchRepo(
      ({ repoRoot, lane, tip, packetDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          // The branch was never pushed and `gh pr view` finds nothing; the tip
          // reached origin/main some other way, so the lane is a leftover.
          const output = yield* captureOutput(
            withCwd(lane, sweep(packetDir)).pipe(provideScopedLayer(ghLayer(tip, "none")))
          );
          expect(yield* fs.exists(lane)).toBe(false);
          expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
          expect(yield* runGitText(repoRoot, ["rev-parse", "main"])).toBe(tip);
          expect(output).toContain("[yeet] retired");
          expect(output).toContain("branch claude/lane: deleted");
          expect(output).toContain(`gate: no pull request; tip ${tip} is already on origin/main and the lane is clean`);
        }),
      { remoteBranch: false }
    )
  );

  it.effect("refuses a pull-request-less lane whose tip origin/main does not contain", () =>
    withScratchRepo(
      ({ lane, packetDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString(path.join(lane, "ahead.txt"), "not on main\n");
          yield* runGit(lane, ["add", "ahead.txt"]);
          yield* runGit(lane, ["commit", "-m", "ahead"]);
          const tip = yield* runGitText(lane, ["rev-parse", "HEAD"]);
          const error = yield* withCwd(lane, sweep(packetDir)).pipe(
            provideScopedLayer(ghLayer(tip, "none")),
            Effect.flip
          );
          expect(error._tag).toBe("YeetCommandError");
          expect(error.message).toContain(
            `no pull request was observed for claude/lane and its tip ${tip} is not contained in origin/main`
          );
          expect(yield* fs.exists(lane)).toBe(true);
        }),
      { remoteBranch: false }
    )
  );

  it.effect("refuses a pull-request-less lane with uncommitted changes and says so in plan mode", () =>
    withScratchRepo(
      ({ lane, tip, packetDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString(path.join(lane, "lane.txt"), "edited after the push\n");
          const planOutput = yield* captureOutput(
            withCwd(lane, sweep(packetDir, { plan: true })).pipe(provideScopedLayer(ghLayer(tip, "none")))
          );
          expect(planOutput).toContain(
            "blocked: no pull request was observed for claude/lane and the lane has uncommitted changes"
          );
          const error = yield* withCwd(lane, sweep(packetDir)).pipe(
            provideScopedLayer(ghLayer(tip, "none")),
            Effect.flip
          );
          expect(error.message).toContain("the lane has uncommitted changes");
          expect(yield* fs.exists(lane)).toBe(true);
          expect(yield* runGitText(lane, ["status", "--porcelain"])).toContain("lane.txt");
        }),
      { remoteBranch: false }
    )
  );

  it.effect("refuses a pull-request-less retirement once the lane's HEAD moved past the approved tip", () =>
    withScratchRepo(
      ({ repoRoot, lane, tip }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          // The gate approved `tip`; a commit lands in the lane before removal.
          const approved = SweepGitState.make({
            branch: "claude/lane",
            mainBranch: "main",
            headBranch: "claude/lane",
            worktreeDirty: false,
            mainCheckedOutElsewhere: false,
            branchCheckedOutElsewhere: false,
            branchMergedIntoBase: true,
            lockfileMovedOnMainUpdate: false,
            statusProbeUnreliable: false,
            worktreeProbeUnreliable: false,
            localTip: O.some(tip),
          });
          yield* fs.writeFileString(path.join(lane, "late.txt"), "landed after the gate\n");
          yield* runGit(lane, ["add", "late.txt"]);
          yield* runGit(lane, ["commit", "-m", "late"]);
          const error = yield* Effect.flip(
            retireInvokingWorktree(
              YeetRetirePlan.make({ worktreePath: lane, owningClone: repoRoot, name: "lane", branch: "claude/lane" }),
              approved
            )
          );
          expect(error.message).toContain(`is not the authorized ${tip}`);
          expect(yield* fs.exists(lane)).toBe(true);
          expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toContain("claude/lane");
        }),
      { remoteBranch: false }
    )
  );

  it.effect("prints the pull-request-less verdict in the JSON plan and report", () =>
    withScratchRepo(
      ({ lane, tip, packetDir }) =>
        Effect.gen(function* () {
          const planOutput = yield* captureOutput(
            withCwd(lane, sweep(packetDir, { plan: true, json: true })).pipe(provideScopedLayer(ghLayer(tip, "none")))
          );
          const plan = yield* YeetRetireSweepPlanJson.decode(planOutput);
          expect(plan.verdict).toEqual(YeetRetireVerdict.cases["pr-less-on-main"].make({ tip, mainBranch: "main" }));
          const runOutput = yield* captureOutput(
            withCwd(lane, sweep(packetDir, { json: true })).pipe(provideScopedLayer(ghLayer(tip, "none")))
          );
          const report = yield* YeetRetireSweepReportJson.decode(runOutput);
          expect(report.verdict._tag).toBe("pr-less-on-main");
          expect(report.receipt.branchDeleted).toBe(true);
        }),
      { remoteBranch: false }
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
    const blocked = retirementFailureMessage(plan, "pid 7 (zsh) via cwd still hold it, and any write would be lost.");
    expect(blocked).toContain("Those holders are outside this command's own session");
    expect(blocked).toContain(
      'cd "/clones/x" && bun run "/clones/x/.claude/worktrees/lane/packages/tooling/tool/cli/src/bin.ts" -- yeet sweep --retire --lane "/clones/x/.claude/worktrees/lane"'
    );
    expect(retirementFailureMessage(plan, "pid 7 via cwd still hold it, and any write would be lost.")).toContain(
      "redirect output to a file instead of piping it, and rerun from the lane: bun run beep yeet sweep --retire."
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

  it.effect("retires a sibling lane named with --lane from another lane of the same clone", () =>
    withScratchRepo(({ repoRoot, lane, tip, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        // A fresh lane at a current checkout is where a later session runs
        // once the desktop lane that owned the merged branch has closed.
        const sibling = path.join(repoRoot, CLAUDE_WORKTREES_RELATIVE_ROOT, "sibling");
        yield* runGit(repoRoot, ["worktree", "add", "-b", "claude/sibling", sibling]);
        const output = yield* captureOutput(
          withCwd(sibling, sweep(packetDir, { lane: O.some(lane) })).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        expect(yield* fs.exists(lane)).toBe(false);
        expect(yield* fs.exists(sibling)).toBe(true);
        expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
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
          expect(error.message).toContain("(sleep) via cwd");
          expect(error.message).toContain(
            `cd "${repoRoot}" && bun run "${lane}/packages/tooling/tool/cli/src/bin.ts" -- yeet sweep --retire --lane "${lane}"`
          );
          expect(yield* fs.exists(lane)).toBe(true);
        })
      )
    )
  );

  it.effect("retires the lane under an idle Claude Desktop Terminal panel shell and says to cd out of it", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The app starts this shell in the session folder whether or not the
        // operator ever opened the panel; at its prompt it writes nothing.
        const holder = yield* spawnSleepIn(lane);
        const receipt = yield* withCwd(lane, retireMergedLane(repoRoot, lane)).pipe(
          Effect.provideService(ProcessTable, desktopPanelTable(holder.pid)),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        expect(receipt.idleTerminalShells).toEqual([holder.pid]);
        expect(
          renderRetirement(
            YeetRetirePlan.make({ worktreePath: lane, owningClone: repoRoot, name: "lane", branch: "claude/lane" }),
            receipt
          )
        ).toContain(
          `note: the idle Claude Desktop Terminal panel shell (pid ${holder.pid}) stood in the lane and was left running; the lane was removed under it, so run \`cd ~\` in that Terminal tab before using it`
        );
        expect(yield* fs.exists(lane)).toBe(false);
        expect(yield* runGitText(repoRoot, ["branch", "--list", "claude/lane"])).toBe("");
      })
    )
  );

  it.effect("preserves the fenced copy when the idle panel shell woke between the fence's scans", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const holder = yield* spawnSleepIn(lane);
        const error = yield* Effect.flip(withCwd(lane, retireMergedLane(repoRoot, lane))).pipe(
          Effect.provideService(ProcessTable, wakingPanelTable(holder.pid)),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        // Idle at both scans, yet it ran something in between: the archive may be
        // missing that write, so the fenced copy is kept rather than deleted.
        expect(error.message).toContain("became active, during capture; the fenced copy is preserved at");
        const fenced = A.filter(
          yield* fs.readDirectory(path.dirname(lane)),
          Str.startsWith(`${path.basename(lane)}.retiring-`)
        );
        expect(A.length(fenced)).toBe(1);
      })
    )
  );

  it.effect("preserves the fenced copy when an initially idle panel shell departs before the final scan", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const holder = yield* spawnSleepIn(lane);
        const table = desktopPanelTable(holder.pid);
        const reads = MutableRef.make(0);
        const departingTable = {
          ...table,
          status: (pid: number) =>
            pid === holder.pid
              ? Effect.gen(function* () {
                  const read = MutableRef.incrementAndGet(reads);
                  if (read === 2) yield* holder.kill();
                  return read > 2 ? O.none() : yield* table.status(pid);
                })
              : table.status(pid),
        };
        const error = yield* Effect.flip(withCwd(lane, retireMergedLane(repoRoot, lane))).pipe(
          Effect.provideService(ProcessTable, departingTable),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        expect(error.message).toContain("became active, during capture; the fenced copy is preserved at");
        const fenced = A.filter(
          yield* fs.readDirectory(path.dirname(lane)),
          Str.startsWith(`${path.basename(lane)}.retiring-`)
        );
        expect(A.length(fenced)).toBe(1);
      })
    )
  );

  it.effect("refuses an idle panel shell in a lane that --lane names from outside it", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // Not started inside the lane: the shell may belong to the session that
        // still has the lane open, so the lane is not removed under it.
        const holder = yield* spawnSleepIn(lane);
        const error = yield* Effect.flip(retireMergedLane(repoRoot, lane)).pipe(
          Effect.provideService(ProcessTable, desktopPanelTable(holder.pid)),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        expect(error.message).toContain(
          `pid ${holder.pid} (sleep) via cwd (the Claude Desktop Terminal panel shell) still hold it`
        );
        expect(error.message).toContain("run `cd ~` in that Terminal tab");
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("refuses a Claude Desktop Terminal panel shell running a command and says to cd ~ in its tab", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const holder = yield* spawnSleepIn(lane);
        const error = yield* Effect.flip(withCwd(lane, retireMergedLane(repoRoot, lane))).pipe(
          Effect.provideService(ProcessTable, desktopPanelTable(holder.pid, holder.pid + 1)),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        expect(error.message).toContain(
          `pid ${holder.pid} (sleep) via cwd (the Claude Desktop Terminal panel shell, running a command) still hold it`
        );
        expect(error.message).toContain("closing the tab does not free the checkout");
        expect(error.message).toContain("run `cd ~` in that Terminal tab, then rerun");
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("refuses an idle Claude Desktop Terminal panel shell that holds a descriptor in the lane", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // Only standing in the lane by cwd is harmless; an open file is a writer.
        const holder = yield* spawnDescriptorHolder(lane);
        const error = yield* Effect.flip(withCwd(lane, retireMergedLane(repoRoot, lane))).pipe(
          Effect.provideService(ProcessTable, desktopPanelTable(holder.pid)),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        expect(error.message).toContain(
          `pid ${holder.pid} (sleep) via descriptor (the Claude Desktop Terminal panel shell) still hold it`
        );
        expect(yield* fs.exists(lane)).toBe(true);
      })
    )
  );

  it.effect("keeps an idle Claude Desktop Terminal panel shell blocking a removal that exempts no invoker", () =>
    withScratchRepo(({ repoRoot, lane }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const removal = yield* WorktreeRemovalService;
        const holder = yield* spawnSleepIn(lane);
        const error = yield* Effect.flip(
          removal.remove(
            WorktreeRemovalRequest.make({
              name: "lane",
              targetPath: lane,
              mainCheckout: repoRoot,
              branch: O.some("claude/lane"),
              archive: true,
              deleteBranch: true,
              expectedHead: O.none(),
            })
          )
        ).pipe(
          Effect.provideService(ProcessTable, desktopPanelTable(holder.pid)),
          Effect.ensuring(Effect.ignore(holder.kill()))
        );
        expect(error.message).toContain(
          `pid ${holder.pid} (sleep) via cwd (the Claude Desktop Terminal panel shell) still hold it`
        );
        expect(error.message).toContain("run `cd ~` in that Terminal tab");
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
          const outcome = yield* runRetireInvoker(lane, repoRoot, { ...env, CLAUDE_PID: String(process.pid) }).pipe(
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
    withScratchRepo(({ repoRoot, lane, env }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          // Same topology, but the marker in the invoker's real environment claims
          // pid 1: an ancestor of everything that never exported it, so nothing on
          // the invoker's path vouches for it and the sibling holder still blocks.
          const holder = yield* spawnLaneHolder(lane);
          const outcome = yield* runRetireInvoker(lane, repoRoot, { ...env, CLAUDE_PID: "1" }).pipe(
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

  it.effect("refuses the holder when CLAUDE_PID names init, a universal ancestor", () =>
    withScratchRepo(({ lane, tip, packetDir, env }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const holder = yield* spawnLaneHolder(lane);
          // pid 1 sits on every invoker's chain, but no process on this path was
          // started by init carrying CLAUDE_PID=1, so the claim proves nothing.
          const error = yield* Effect.flip(
            withEnv({ ...env, CLAUDE_PID: "1" }, withCwd(lane, sweep(packetDir))).pipe(
              provideScopedLayer(ghLayer(tip, "MERGED"))
            )
          ).pipe(Effect.ensuring(Effect.ignore(holder.kill())));
          expect(error.message).toContain("still hold it");
          expect(error.message).toContain("(sh) via cwd");
          expect(yield* fs.exists(lane)).toBe(true);
        })
      )
    )
  );

  it.effect("refuses the holder when CLAUDE_PID names an ancestor that never exported it", () =>
    withScratchRepo(({ lane, tip, packetDir, env }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const holder = yield* spawnLaneHolder(lane);
          // This process's parent is a real ancestor, yet this process was not
          // started with CLAUDE_PID naming it, so the desktop-host case refuses.
          const error = yield* Effect.flip(
            withEnv({ ...env, CLAUDE_PID: String(process.ppid) }, withCwd(lane, sweep(packetDir))).pipe(
              provideScopedLayer(ghLayer(tip, "MERGED"))
            )
          ).pipe(Effect.ensuring(Effect.ignore(holder.kill())));
          expect(error.message).toContain("still hold it");
          expect(yield* fs.exists(lane)).toBe(true);
        })
      )
    )
  );

  it.effect("refuses the holder when CLAUDE_PID names a pid off the invoker's path", () =>
    withScratchRepo(({ lane, tip, packetDir, env }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const holder = yield* spawnLaneHolder(lane);
          // The holder's own pid sits in its ancestry but nowhere on the invoker's
          // path, so no process below it can carry the marker and the proof fails.
          const error = yield* Effect.flip(
            withEnv({ ...env, CLAUDE_PID: String(holder.pid) }, withCwd(lane, sweep(packetDir))).pipe(
              provideScopedLayer(ghLayer(tip, "MERGED"))
            )
          ).pipe(Effect.ensuring(Effect.ignore(holder.kill())));
          expect(error.message).toContain("still hold it");
          expect(error.message).toContain("(sh) via cwd");
          expect(yield* fs.exists(lane)).toBe(true);
        })
      )
    )
  );

  it.effect("treats a malformed session pid as no session at all", () =>
    withScratchRepo(({ lane, tip, packetDir, env }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const output = yield* captureOutput(
          withEnv({ ...env, CLAUDE_PID: "not-a-pid" }, withCwd(lane, sweep(packetDir))).pipe(
            provideScopedLayer(ghLayer(tip, "MERGED"))
          )
        );
        expect(output).toContain("[yeet] retired");
        expect(yield* fs.exists(lane)).toBe(false);
      })
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

  it.effect("names the touched goal packets the merged branch left active", () =>
    withScratchRepo(({ repoRoot, lane, packetDir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        // One packet the branch flipped (closed), one it left active, and one
        // left active with a statusNote saying why: only the unexplained open
        // one is an advisory, and a non-packet path under goals/ is ignored.
        for (const [slug, manifest] of [
          ["open-packet", { lifecycle: "active", blockedBy: [] }],
          ["blocked-packet", { lifecycle: "active", blockedBy: ["operator"] }],
          ["closed-packet", { lifecycle: "completed-retained" }],
          ["noted-packet", { lifecycle: "active", statusNote: "P8 is an operator gate." }],
        ] as const) {
          yield* fs.makeDirectory(path.join(lane, "goals", slug, "ops"), { recursive: true });
          yield* fs.writeFileString(
            path.join(lane, "goals", slug, "ops", "manifest.json"),
            `${yield* encodePacketLifecycle(manifest)}\n`
          );
        }
        yield* fs.writeFileString(path.join(lane, "goals", "INDEX.md"), "# index\n");
        yield* fs.makeDirectory(path.join(lane, "goals", "malformed-packet", "ops"), { recursive: true });
        yield* fs.writeFileString(
          path.join(lane, "goals", "malformed-packet", "ops", "manifest.json"),
          "invalid JSON\n"
        );
        yield* runGit(lane, ["add", "goals"]);
        yield* runGit(lane, ["commit", "-m", "packets"]);
        yield* runGit(lane, ["push", "origin", "claude/lane"]);
        yield* runGit(lane, ["push", "origin", "claude/lane:main"]);
        yield* runGit(repoRoot, ["fetch", "origin"]);
        const tip = yield* runGitText(lane, ["rev-parse", "HEAD"]);
        // A failed GitHub files read falls back to the branch's own diff.
        // A malformed manifest contributes no active-packet advisory.
        const planOutput = yield* captureOutput(
          withCwd(lane, sweep(packetDir, { plan: true, json: true })).pipe(
            Effect.provideServiceEffect(
              ChildProcessSpawner.ChildProcessSpawner,
              ghSpawner(tip, "MERGED", [], ChildProcessSpawner.ExitCode(1))
            )
          )
        );
        const plan = yield* YeetRetireSweepPlanJson.decode(planOutput);
        expect(plan.activePackets).toEqual(["open-packet"]);
        // Once the clone's main already contains the merge, the diff is
        // empty and the pull request's own file list carries the packets. An
        // uncommitted edit closing the packet in the working tree does not
        // hide it: the lifecycle is read from the committed HEAD.
        yield* runGit(repoRoot, ["merge", "--ff-only", "origin/main"]);
        yield* fs.writeFileString(
          path.join(lane, "goals", "open-packet", "ops", "manifest.json"),
          `${yield* encodePacketLifecycle({ lifecycle: "completed-retained" })}\n`
        );
        const prFiles = ["goals/open-packet/ops/manifest.json", "goals/closed-packet/ops/manifest.json", "lane.txt"];
        const laterPlan = yield* YeetRetireSweepPlanJson.decode(
          yield* captureOutput(
            withCwd(lane, sweep(packetDir, { plan: true, json: true })).pipe(
              Effect.provideServiceEffect(ChildProcessSpawner.ChildProcessSpawner, ghSpawner(tip, "MERGED", prFiles))
            )
          )
        );
        expect(laterPlan.activePackets).toEqual(["open-packet"]);
        const output = yield* captureOutput(
          withCwd(lane, sweep(packetDir)).pipe(
            Effect.provideServiceEffect(ChildProcessSpawner.ChildProcessSpawner, ghSpawner(tip, "MERGED", prFiles))
          )
        );
        expect(output).toContain("[yeet] packet still active after merge: goals/open-packet");
        expect(output).not.toContain("closed-packet");
        expect(output).not.toContain("noted-packet");
        expect(yield* fs.exists(lane)).toBe(false);
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
        expect(plan.verdict._tag).toBe("pr-merged");
        expect(plan.sweep.steps.length).toBeGreaterThan(0);
        const runOutput = yield* captureOutput(
          withCwd(lane, sweep(packetDir, { json: true })).pipe(provideScopedLayer(ghLayer(tip, "MERGED")))
        );
        const report = yield* YeetRetireSweepReportJson.decode(runOutput);
        expect(report.verdict._tag).toBe("pr-merged");
        expect(report.receipt.branchDeleted).toBe(true);
        expect(report.sweep.steps.length).toBeGreaterThan(0);
      })
    )
  );
});
