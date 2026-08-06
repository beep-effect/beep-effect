import {
  buildSweepPlan,
  executeSweep,
  MergeOutcome,
  observeSweepGitState,
  overrideSweepBranch,
  RepoRunContext,
  refreshNotCompletedHandoff,
  renderSweepReport,
  revalidateLocalDeletion,
  revalidateRemoteDeletion,
  SweepGitState,
  SweepPlan,
  SweepReport,
  SweepReportJson,
  SweepReportStep,
  SweepStepExecuted,
  SweepStepId,
  SweepStepNeedsOperator,
  SweepStepSkipped,
  sweepReportPath,
  sweepStepBlockers,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, FileSystem, Layer, pipe, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { SweepPlanStep } from "@beep/repo-cli/test/Yeet";

const mergedTip = "aaaa1111bbbb2222";
const mainTipBeforeUpdate = "eeee5555ffff6666";
const createdAt = "2026-08-04T00:00:00.000Z";
const endedAt = "2026-08-04T00:00:01.000Z";

/**
 * A squash-merged branch in the ideal shape: the pull request is MERGED and its
 * head branch is the branch being swept, the local and remote tips both still
 * equal its recorded head, every probe read completely, no worktree holds the
 * branch, and the clone is clean and already sitting on `main`.
 */
const mergedFacts = {
  branch: "feat/merge-loop",
  mainBranch: "main",
  headBranch: "main",
  worktreeDirty: false,
  mainCheckedOutElsewhere: false,
  branchCheckedOutElsewhere: false,
  branchMergedIntoBase: false,
  lockfileMovedOnMainUpdate: true,
  statusProbeUnreliable: false,
  worktreeProbeUnreliable: false,
  mainWorktreePath: O.none<string>(),
  mainTip: O.some(mainTipBeforeUpdate),
  localTip: O.some(mergedTip),
  remoteTip: O.some(mergedTip),
  pullRequestState: O.some("MERGED"),
  pullRequestHeadBranch: O.some("feat/merge-loop"),
  pullRequestHeadOid: O.some(mergedTip),
};

const stateWith = (overrides: Partial<typeof mergedFacts>): SweepGitState =>
  SweepGitState.make({ ...mergedFacts, ...overrides });

const mergedState = stateWith({});

const stepFor = (state: SweepGitState, id: SweepStepId): SweepPlanStep =>
  O.getOrThrow(A.findFirst(buildSweepPlan(state, createdAt).steps, (step) => step.id === id));

const blockerText = (state: SweepGitState, id: SweepStepId): ReadonlyArray<string> =>
  A.map(sweepStepBlockers(stepFor(state, id)), (blocker) => blocker.description);

const emptyPlan = SweepPlan.make({
  schemaVersion: "yeet-sweep-plan/v1",
  createdAt,
  branch: "feat/merge-loop",
  steps: [],
});

const reportOf = (steps: ReadonlyArray<SweepReportStep>): SweepReport =>
  SweepReport.make({
    schemaVersion: "yeet-sweep-report/v1",
    plan: emptyPlan,
    steps,
    startedAt: createdAt,
    endedAt,
  });

describe("buildSweepPlan shape", () => {
  it("plans every step id exactly once, in execution order", () => {
    expect(A.map(buildSweepPlan(mergedState, createdAt).steps, (step) => step.id)).toEqual([...SweepStepId.Options]);
  });

  it("stamps the schema version, branch, and creation timestamp", () => {
    const plan = buildSweepPlan(mergedState, createdAt);
    expect(plan.schemaVersion).toBe("yeet-sweep-plan/v1");
    expect(plan.branch).toBe("feat/merge-loop");
    expect(plan.createdAt).toBe(createdAt);
  });

  it("leaves every step runnable for a cleanly merged branch", () => {
    const blocked = A.map(
      A.filter(buildSweepPlan(mergedState, createdAt).steps, (step) => A.isReadonlyArrayEmpty(sweepStepBlockers(step))),
      (step) => step.id
    );
    expect(blocked).toEqual([...SweepStepId.Options]);
  });
});

describe("local branch deletion contract", () => {
  it("uses -d and records ancestry when the tip is an ancestor of origin/main", () => {
    const step = stepFor(stateWith({ branchMergedIntoBase: true }), "delete-local-branch");
    expect(step.action).toBe("git branch -d feat/merge-loop");
    expect(A.map(step.preconditions, (observed) => observed.description)).toContain(
      "feat/merge-loop is an ancestor of origin/main"
    );
  });

  it("uses -D for a squash merge, whose tip is not an ancestor of origin/main", () => {
    expect(stepFor(mergedState, "delete-local-branch").action).toBe("git branch -D feat/merge-loop");
  });

  it("blocks -D when the pull request is not MERGED", () => {
    expect(blockerText(stateWith({ pullRequestState: O.some("OPEN") }), "delete-local-branch")).toEqual([
      "pull request for feat/merge-loop is MERGED",
    ]);
  });

  it("blocks -D when the local tip has moved past the pull request head", () => {
    expect(blockerText(stateWith({ localTip: O.some("cccc3333") }), "delete-local-branch")).toEqual([
      "local tip cccc3333 equals pull request head aaaa1111bbbb2222",
    ]);
  });

  it("blocks -D when another worktree holds the branch", () => {
    expect(blockerText(stateWith({ branchCheckedOutElsewhere: true }), "delete-local-branch")).toEqual([
      "no worktree holds feat/merge-loop",
    ]);
  });

  it("blocks -D when the sweeping worktree itself holds the branch", () => {
    expect(blockerText(stateWith({ headBranch: "feat/merge-loop" }), "delete-local-branch")).toEqual([
      "no worktree holds feat/merge-loop",
    ]);
  });

  it("blocks deletion when there is no local branch left to delete", () => {
    expect(blockerText(stateWith({ localTip: O.none() }), "delete-local-branch")).toEqual([
      "local branch feat/merge-loop exists",
      "local tip <absent> equals pull request head aaaa1111bbbb2222",
    ]);
  });

  it("blocks -D when the pull request never recorded a head oid", () => {
    expect(blockerText(stateWith({ pullRequestHeadOid: O.none() }), "delete-local-branch")).toEqual([
      "local tip aaaa1111bbbb2222 equals pull request head <absent>",
    ]);
  });

  it("never asks the operator to force-delete a local branch", () => {
    expect(stepFor(stateWith({ localTip: O.some("cccc3333") }), "delete-local-branch").requiresOperator).toBe(false);
  });
});

describe("pull request identity contract", () => {
  const otherBranchPr = { pullRequestHeadBranch: O.some("feat/other-work") };

  it("blocks -D when the resolved pull request heads a different branch", () => {
    expect(blockerText(stateWith(otherBranchPr), "delete-local-branch")).toEqual([
      "pull request head branch feat/other-work is feat/merge-loop",
    ]);
  });

  it("blocks the remote deletion when the resolved pull request heads a different branch", () => {
    const state = stateWith(otherBranchPr);
    expect(blockerText(state, "delete-remote-branch")).toEqual([
      "pull request head branch feat/other-work is feat/merge-loop",
    ]);
    expect(stepFor(state, "delete-remote-branch").requiresOperator).toBe(false);
  });

  it("blocks both deletions when no pull request head branch was observed", () => {
    const state = stateWith({ pullRequestHeadBranch: O.none() });
    expect(blockerText(state, "delete-local-branch")).toEqual(["pull request head branch <absent> is feat/merge-loop"]);
    expect(blockerText(state, "delete-remote-branch")).toEqual([
      "pull request head branch <absent> is feat/merge-loop",
    ]);
  });

  it("never turns an identity mismatch into an operator handoff", () => {
    expect(stepFor(stateWith(otherBranchPr), "delete-local-branch").requiresOperator).toBe(false);
  });
});

describe("truncated probe rail", () => {
  // What `observeSweepGitState` records when the capture bound cut the probe
  // off: the flag plus the conservative value of every fact it feeds.
  const truncatedWorktreeProbe = {
    worktreeProbeUnreliable: true,
    branchCheckedOutElsewhere: true,
    mainCheckedOutElsewhere: true,
  };
  const truncatedStatusProbe = { statusProbeUnreliable: true, worktreeDirty: true };

  it("blocks the local deletion and names the truncated command", () => {
    expect(blockerText(stateWith(truncatedWorktreeProbe), "delete-local-branch")).toEqual([
      "git worktree list --porcelain succeeded without truncation",
    ]);
  });

  it("blocks moving HEAD back to main on a truncated worktree list", () => {
    expect(blockerText(stateWith({ ...truncatedWorktreeProbe, headBranch: "feat/merge-loop" }), "end-state")).toEqual([
      "git worktree list --porcelain succeeded without truncation",
    ]);
  });

  it("blocks the fast-forward fetch on a truncated worktree list", () => {
    expect(blockerText(stateWith({ ...truncatedWorktreeProbe, headBranch: "feat/merge-loop" }), "ff-main")).toEqual([
      "git worktree list --porcelain succeeded without truncation",
    ]);
  });

  it("blocks the in-place merge and the install on a truncated status probe", () => {
    const state = stateWith(truncatedStatusProbe);
    expect(blockerText(state, "ff-main")).toEqual(["git status --porcelain succeeded without truncation"]);
    expect(blockerText(state, "lockfile-install")).toEqual(["git status --porcelain succeeded without truncation"]);
  });

  it("leaves the remote deletion untouched by a truncated worktree list", () => {
    expect(blockerText(stateWith(truncatedWorktreeProbe), "delete-remote-branch")).toEqual([]);
  });
});

describe("remote branch deletion contract", () => {
  it("flags the authorized deletion as an operator handoff with the exact command", () => {
    const step = stepFor(mergedState, "delete-remote-branch");
    expect(step.action).toBe(
      "git push origin --force-with-lease=refs/heads/feat/merge-loop:aaaa1111bbbb2222 :refs/heads/feat/merge-loop"
    );
    expect(step.requiresOperator).toBe(true);
  });

  it("blocks deletion when the remote tip does not match the pull request head", () => {
    const state = stateWith({ remoteTip: O.some("dddd4444") });
    expect(blockerText(state, "delete-remote-branch")).toEqual([
      "remote tip dddd4444 equals pull request head aaaa1111bbbb2222",
    ]);
    expect(stepFor(state, "delete-remote-branch").requiresOperator).toBe(false);
  });

  it("blocks deletion when the remote branch is already gone", () => {
    expect(blockerText(stateWith({ remoteTip: O.none() }), "delete-remote-branch")).toEqual([
      "remote branch origin/feat/merge-loop exists",
      "remote tip <absent> equals pull request head aaaa1111bbbb2222",
    ]);
  });

  it("blocks deletion when the pull request is not MERGED", () => {
    expect(blockerText(stateWith({ pullRequestState: O.some("CLOSED") }), "delete-remote-branch")).toEqual([
      "pull request for feat/merge-loop is MERGED",
    ]);
  });
});

describe("fast-forward refusal", () => {
  const onFeatureBranch = { headBranch: "feat/merge-loop" };

  it("fetches the ref directly when no worktree holds main", () => {
    const step = stepFor(stateWith(onFeatureBranch), "ff-main");
    expect(step.action).toBe("git fetch origin main:main");
    expect(sweepStepBlockers(step)).toEqual([]);
  });

  it("skips with a reason when another worktree holds main", () => {
    const state = stateWith({ ...onFeatureBranch, mainCheckedOutElsewhere: true });
    expect(blockerText(state, "ff-main")).toEqual(["main is not checked out in another worktree"]);
    expect(stepFor(state, "ff-main").action).toBe("git fetch origin main:main");
  });

  it("never turns a fast-forward refusal into an operator handoff", () => {
    const state = stateWith({ ...onFeatureBranch, mainCheckedOutElsewhere: true });
    expect(stepFor(state, "ff-main").requiresOperator).toBe(false);
  });

  it("merges in place when the sweeping worktree is the one on main", () => {
    const step = stepFor(mergedState, "ff-main");
    expect(step.action).toBe("git merge --ff-only refs/remotes/origin/main");
    expect(sweepStepBlockers(step)).toEqual([]);
  });

  it("refuses the in-place merge when that worktree is dirty", () => {
    expect(blockerText(stateWith({ worktreeDirty: true }), "ff-main")).toEqual(["worktree is clean"]);
  });
});

describe("dirty worktree rail", () => {
  const dirty = stateWith({ headBranch: "feat/merge-loop", worktreeDirty: true });

  it("blocks the lockfile install", () => {
    expect(blockerText(dirty, "lockfile-install")).toEqual(["worktree is clean"]);
  });

  it("blocks moving HEAD back to main", () => {
    expect(blockerText(dirty, "end-state")).toEqual(["worktree is clean"]);
  });

  it("leaves ref-only steps untouched by dirtiness", () => {
    expect(blockerText(dirty, "fetch-prune")).toEqual([]);
    expect(blockerText(dirty, "delete-remote-branch")).toEqual([]);
  });

  it("plans the install as an execution-time re-check, carrying the pre-refresh forecast", () => {
    expect(blockerText(stateWith({ lockfileMovedOnMainUpdate: false }), "lockfile-install")).toEqual([]);
    const forecastUnchanged = stepFor(stateWith({ lockfileMovedOnMainUpdate: false }), "lockfile-install");
    expect(A.map(forecastUnchanged.preconditions, (observed) => observed.description)).toContain(
      "bun.lock movement is re-checked after the refresh (pre-refresh forecast: unchanged)"
    );
    const forecastMoved = stepFor(mergedState, "lockfile-install");
    expect(A.map(forecastMoved.preconditions, (observed) => observed.description)).toContain(
      "bun.lock movement is re-checked after the refresh (pre-refresh forecast: moved)"
    );
  });
});

describe("end state", () => {
  it("asks for nothing when the clone is already on main", () => {
    const step = stepFor(mergedState, "end-state");
    expect(step.preconditions).toEqual([]);
    expect(step.action).toBe("git switch main");
  });

  it("requires a clean worktree and a free main to switch back", () => {
    const step = stepFor(stateWith({ headBranch: "feat/merge-loop" }), "end-state");
    expect(A.map(step.preconditions, (observed) => observed.description)).toEqual([
      "worktree is clean",
      "main is not checked out in another worktree",
    ]);
  });
});

describe("renderSweepReport", () => {
  const handoffReport = reportOf([
    SweepReportStep.make({ id: "fetch-prune", outcome: SweepStepExecuted.make({ detail: O.some("pruned 2") }) }),
    SweepReportStep.make({
      id: "ff-main",
      outcome: SweepStepSkipped.make({ reason: "blocked: main is not checked out in another worktree" }),
    }),
    SweepReportStep.make({
      id: "delete-remote-branch",
      outcome: SweepStepNeedsOperator.make({
        reason: "deleting origin/feat/merge-loop was denied by permission: 403",
        operatorCommand:
          "git push origin --force-with-lease=refs/heads/feat/merge-loop:aaaa1111bbbb2222 :refs/heads/feat/merge-loop",
      }),
    }),
  ]);

  it("summarizes each outcome kind", () => {
    const rendered = renderSweepReport(handoffReport);
    expect(rendered).toContain("fetch-prune: executed: pruned 2");
    expect(rendered).toContain("ff-main: skipped: blocked: main is not checked out in another worktree");
    expect(rendered).toContain("delete-remote-branch: needs-operator:");
  });

  it("batches every needs-operator command into one handoff block", () => {
    const rendered = renderSweepReport(handoffReport);
    expect(rendered).toContain("operator handoff (1 command(s) only you can run):");
    expect(rendered).toContain(
      "    git push origin --force-with-lease=refs/heads/feat/merge-loop:aaaa1111bbbb2222 :refs/heads/feat/merge-loop"
    );
  });

  it("omits the handoff block when nothing needs the operator", () => {
    const rendered = renderSweepReport(reportOf(A.take(handoffReport.steps, 2)));
    expect(rendered).not.toContain("operator handoff");
  });

  it("names the swept branch in its header", () => {
    expect(renderSweepReport(reportOf([]))).toBe("[yeet] sweep feat/merge-loop");
  });
});

const encoder = new TextEncoder();

type CommandStub = {
  readonly exitCode: number;
  readonly output: string;
};

const ok = (output: string): CommandStub => ({ exitCode: 0, output });

const nonzero = (exitCode: number): CommandStub => ({ exitCode, output: "" });

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

/**
 * A spawner that answers by command-line prefix; anything unlisted succeeds
 * silently, which is exactly how the mutating steps of a clean sweep behave.
 */
const stubSpawnerLayer = (stubs: ReadonlyArray<readonly [string, CommandStub]>) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.succeed(
      ChildProcessSpawner.make((command) =>
        ChildProcess.isStandardCommand(command)
          ? Effect.succeed(
              stubHandle(
                pipe(
                  A.findFirst(stubs, ([prefix]) =>
                    Str.startsWith(prefix)(A.join([command.command, ...command.args], " "))
                  ),
                  O.match({ onNone: () => ok(""), onSome: ([, stub]) => stub })
                )
              )
            )
          : Effect.die("the sweep never spawns a piped command")
      )
    )
  );

const prViewJson = `{"number":559,"headRefName":"feat/merge-loop","state":"MERGED","headRefOid":"${mergedTip}"}`;

// The probes answer for a clone at /repo whose only worktree is the sweeping
// one; the temp directory below is where the artifact lands, not what git sees.
const mergedSweepStubs: ReadonlyArray<readonly [string, CommandStub]> = [
  ["git rev-parse --abbrev-ref HEAD", ok("main")],
  ["git rev-parse --show-toplevel", ok("/repo")],
  ["git rev-parse --verify --quiet refs/heads/main", ok(mainTipBeforeUpdate)],
  ["git rev-parse --verify --quiet refs/remotes/origin/main", ok(mainTipBeforeUpdate)],
  ["git rev-parse --verify --quiet refs/heads/feat/merge-loop", ok(mergedTip)],
  ["git rev-parse --verify --quiet refs/remotes/origin/feat/merge-loop", ok(mergedTip)],
  ["git status --porcelain", ok("")],
  ["git worktree list --porcelain", ok(`worktree /repo\nHEAD ${mergedTip}\nbranch refs/heads/main`)],
  ["git merge-base --is-ancestor", nonzero(1)],
  ["git diff --name-only", ok("bun.lock")],
  ["git ls-remote origin refs/heads/feat/merge-loop", ok(`${mergedTip}\trefs/heads/feat/merge-loop`)],
  ["gh pr view feat/merge-loop", ok(prViewJson)],
];

// Longer than the 512 KiB repo-run capture bound, so the probe comes back
// flagged truncated. Every block that survives is a detached worktree holding
// no branch, so "the branch is held" can only come from the truncation itself.
const truncatedWorktreeOutput = Str.repeat(40_000)("worktree /repo/detached-worktree\nHEAD aaaa1111\ndetached\n\n");

const truncatedWorktreeStubs: ReadonlyArray<readonly [string, CommandStub]> = [
  ["git worktree list --porcelain", ok(truncatedWorktreeOutput)],
  ...mergedSweepStubs,
];

const sweepContext = (root: string): RepoRunContext =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feat/merge-loop",
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

const sweepTestLayer = (stubs: ReadonlyArray<readonly [string, CommandStub]>) =>
  Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, stubSpawnerLayer(stubs));

describe("executeSweep", () => {
  it.effect("writes a sweep-report.json that decodes back through SweepReportJson", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const context = sweepContext(root);
        const report = yield* executeSweep(context);
        expect(A.map(report.steps, (step) => step.id)).toEqual([...SweepStepId.Options]);
        expect(A.map(report.steps, (step) => step.outcome.status)).toEqual(A.map(report.steps, () => "executed"));

        const fs = yield* FileSystem.FileSystem;
        const written = yield* fs.readFileString(yield* sweepReportPath(context));
        expect(yield* SweepReportJson.decode(written)).toEqual(report);
      })
    ).pipe(provideScopedLayer(sweepTestLayer(mergedSweepStubs)))
  );

  it.effect("reads a truncated worktree list as unknown, not as an empty worktree set", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const state = yield* observeSweepGitState(sweepContext(root));
        expect(state.worktreeProbeUnreliable).toBe(true);
        expect(state.branchCheckedOutElsewhere).toBe(true);
        expect(state.mainCheckedOutElsewhere).toBe(true);
        expect(blockerText(state, "delete-local-branch")).toEqual([
          "git worktree list --porcelain succeeded without truncation",
        ]);
      })
    ).pipe(provideScopedLayer(sweepTestLayer(truncatedWorktreeStubs)))
  );

  it.effect("keeps the observed pull request head branch for the identity check", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const state = yield* observeSweepGitState(sweepContext(root));
        expect(state.pullRequestHeadBranch).toEqual(O.some("feat/merge-loop"));
        expect(blockerText(state, "delete-local-branch")).toEqual([]);
      })
    ).pipe(provideScopedLayer(sweepTestLayer(mergedSweepStubs)))
  );

  it.effect("reads a failed status probe as unknown, not as a clean worktree", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const state = yield* observeSweepGitState(sweepContext(root));
        expect(state.statusProbeUnreliable).toBe(true);
        expect(state.worktreeDirty).toBe(true);
        expect(blockerText(state, "lockfile-install")).toContain("git status --porcelain succeeded without truncation");
      })
    ).pipe(provideScopedLayer(sweepTestLayer([["git status --porcelain", nonzero(128)], ...mergedSweepStubs])))
  );

  it.effect("reads a failed worktree list as held branches, not as a free clone", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const state = yield* observeSweepGitState(sweepContext(root));
        expect(state.worktreeProbeUnreliable).toBe(true);
        expect(state.branchCheckedOutElsewhere).toBe(true);
        expect(state.mainCheckedOutElsewhere).toBe(true);
        expect(blockerText(state, "delete-local-branch")).toEqual([
          "git worktree list --porcelain succeeded without truncation",
        ]);
      })
    ).pipe(provideScopedLayer(sweepTestLayer([["git worktree list --porcelain", nonzero(128)], ...mergedSweepStubs])))
  );

  it.effect("hands a generic remote rejection to the operator with its own words, never a stale lease", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const report = yield* executeSweep(sweepContext(root));
        const remoteStep = O.getOrThrow(A.findFirst(report.steps, (step) => step.id === "delete-remote-branch"));
        expect(remoteStep.outcome.status).toBe("needs-operator");
        if (remoteStep.outcome.status === "needs-operator") {
          expect(remoteStep.outcome.reason).not.toContain("moved after planning");
          expect(remoteStep.outcome.reason).toContain("custom hook said no");
          expect(remoteStep.outcome.operatorCommand).toContain("--force-with-lease");
        }
      })
    ).pipe(
      provideScopedLayer(
        sweepTestLayer([
          [
            "git push origin --force-with-lease",
            { exitCode: 1, output: " ! [remote rejected] refs/heads/feat/merge-loop (custom hook said no)" },
          ],
          ...mergedSweepStubs,
        ])
      )
    )
  );

  it.effect("hands an unrefreshed main to the operator as unreconciled, never as unchanged", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const report = yield* executeSweep(sweepContext(root));
        const step = O.getOrThrow(A.findFirst(report.steps, (reported) => reported.id === "lockfile-install"));
        expect(step.outcome.status).toBe("needs-operator");
        if (step.outcome.status === "needs-operator") {
          expect(step.outcome.reason).toContain("was not refreshed");
          expect(step.outcome.reason).not.toContain("did not move");
          expect(step.outcome.operatorCommand).toBe("bun run beep yeet sweep");
        }
      })
    ).pipe(
      provideScopedLayer(
        sweepTestLayer([
          ["git rev-parse --verify --quiet refs/remotes/origin/main", ok("9999aaaa8888bbbb")],
          ...mergedSweepStubs,
        ])
      )
    )
  );

  it.effect("skips the install when the post-refresh update window shows bun.lock unchanged", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const report = yield* executeSweep(sweepContext(root));
        const step = O.getOrThrow(A.findFirst(report.steps, (reported) => reported.id === "lockfile-install"));
        expect(step.outcome.status).toBe("skipped");
        expect(step.outcome.status === "skipped" ? step.outcome.reason : "").toContain("did not move");
      })
    ).pipe(
      provideScopedLayer(sweepTestLayer([[`git diff --name-only ${mainTipBeforeUpdate}`, ok("")], ...mergedSweepStubs]))
    )
  );

  it.effect("classifies a rejected lease as moved-after-planning, not as a plain failure", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const report = yield* executeSweep(sweepContext(root));
        const remoteStep = O.getOrThrow(A.findFirst(report.steps, (step) => step.id === "delete-remote-branch"));
        expect(remoteStep.outcome.status).toBe("skipped");
        expect(remoteStep.outcome.status === "skipped" ? remoteStep.outcome.reason : "").toContain(
          "moved after planning"
        );
      })
    ).pipe(
      provideScopedLayer(
        sweepTestLayer([
          [
            "git push origin --force-with-lease",
            { exitCode: 1, output: " ! [rejected] refs/heads/feat/merge-loop (stale info)" },
          ],
          ...mergedSweepStubs,
        ])
      )
    )
  );

  it.effect("skips remote deletion when the live remote tip moved since planning", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const report = yield* executeSweep(sweepContext(root));
        const remoteStep = O.getOrThrow(A.findFirst(report.steps, (step) => step.id === "delete-remote-branch"));
        expect(remoteStep.outcome.status).toBe("skipped");
        expect(remoteStep.outcome.status === "skipped" ? remoteStep.outcome.reason : "").toContain(
          "moved since planning"
        );
      })
    ).pipe(
      provideScopedLayer(
        sweepTestLayer([
          ["git ls-remote origin refs/heads/feat/merge-loop", ok("ffff9999eeee8888\trefs/heads/feat/merge-loop")],
          ...mergedSweepStubs,
        ])
      )
    )
  );
});

describe("deletion revalidation", () => {
  it.effect("refuses a local deletion when the branch tip moved since planning", () =>
    Effect.gen(function* () {
      const drifted = stateWith({ localTip: O.some("cccc3333dddd4444") });
      const refusal = yield* revalidateLocalDeletion("/repo", drifted);
      expect(O.isSome(refusal)).toBe(true);
      expect(O.getOrElse(refusal, () => "")).toContain("moved since planning");

      const unchanged = yield* revalidateLocalDeletion("/repo", mergedState);
      expect(unchanged).toEqual(O.none());
    }).pipe(provideScopedLayer(sweepTestLayer(mergedSweepStubs)))
  );

  it.effect("refuses a remote deletion when ls-remote cannot be read", () =>
    Effect.gen(function* () {
      const refusal = yield* revalidateRemoteDeletion("/repo", mergedState);
      expect(O.getOrElse(refusal, () => "")).toContain("could not re-verify");
    }).pipe(
      provideScopedLayer(
        sweepTestLayer([["git ls-remote origin refs/heads/feat/merge-loop", nonzero(128)], ...mergedSweepStubs])
      )
    )
  );

  it.effect("treats an already-deleted remote ref as nothing to delete", () =>
    Effect.gen(function* () {
      const refusal = yield* revalidateRemoteDeletion("/repo", mergedState);
      expect(O.getOrElse(refusal, () => "")).toContain("no longer exists");
    }).pipe(
      provideScopedLayer(
        sweepTestLayer([["git ls-remote origin refs/heads/feat/merge-loop", ok("")], ...mergedSweepStubs])
      )
    )
  );

  it.effect("allows the remote deletion when the live tip still matches the plan", () =>
    Effect.gen(function* () {
      const allowed = yield* revalidateRemoteDeletion("/repo", mergedState);
      expect(allowed).toEqual(O.none());
    }).pipe(provideScopedLayer(sweepTestLayer(mergedSweepStubs)))
  );
});

describe("MergeOutcome", () => {
  it("carries the confirmed pull request state alongside the sweep report", () => {
    const outcome = MergeOutcome.make({
      pullRequestNumber: 559,
      state: "MERGED",
      sweep: reportOf([]),
    });
    expect(outcome.pullRequestNumber).toBe(559);
    expect(outcome.sweep.plan.branch).toBe("feat/merge-loop");
  });
});

// Decision 45(d) shipped claiming "a re-run completes the deletion". It does
// not: `end-state` leaves the clone on main, so the second pass observes main
// as the current branch and never reconsiders the merged branch. The override
// is what makes the documented two-pass design actually reachable.
describe("sweep branch override", () => {
  const contextAt = (branch: string) =>
    RepoRunContext.make({
      base: "origin/main",
      branch,
      cwd: "/repo",
      head: "HEAD",
      originalArgv: [],
      packetDir: "/repo",
      repoRoot: "/repo",
      turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
    });

  it.effect("re-aims the sweep at a branch the clone is no longer standing on", () =>
    Effect.gen(function* () {
      const reaimed = yield* overrideSweepBranch(contextAt("main"), "feat/merge-loop");
      expect(reaimed.branch).toBe("feat/merge-loop");
    })
  );

  it.effect("changes only the branch coordinate", () =>
    Effect.gen(function* () {
      const original = contextAt("main");
      const reaimed = yield* overrideSweepBranch(original, "feat/merge-loop");
      expect({ ...reaimed, branch: original.branch }).toEqual({ ...original });
    })
  );

  it.effect("refuses an option-like branch name instead of passing it to git", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(overrideSweepBranch(contextAt("main"), "--upload-pack=touch /tmp/pwn"));
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

describe("refresh handoff addressing", () => {
  const localMain = O.some("cccc3333");
  const trackingMain = O.some("dddd4444");

  it("sends the operator to the worktree that holds main, aimed back at this branch", () => {
    const handoff = refreshNotCompletedHandoff(
      stateWith({ mainCheckedOutElsewhere: true, mainWorktreePath: O.some("/home/dev/beep-effect") }),
      localMain,
      trackingMain
    );
    expect(handoff.operatorCommand).toBe(
      "cd '/home/dev/beep-effect' && bun run beep yeet sweep --branch 'feat/merge-loop'"
    );
    expect(handoff.reason).toContain("/home/dev/beep-effect holds main");
  });

  // guardLiteralArg refuses option-like values; it does not escape whitespace,
  // and worktree paths routinely contain spaces.
  it("quotes a worktree path containing whitespace so the copied command still cds there", () => {
    const handoff = refreshNotCompletedHandoff(
      stateWith({ mainCheckedOutElsewhere: true, mainWorktreePath: O.some("/home/dev/beep effect/main") }),
      localMain,
      trackingMain
    );
    expect(handoff.operatorCommand).toContain("cd '/home/dev/beep effect/main'");
  });

  it("escapes an embedded single quote instead of ending the quoted string early", () => {
    const handoff = refreshNotCompletedHandoff(
      stateWith({ mainCheckedOutElsewhere: true, mainWorktreePath: O.some("/home/dev/o'brien") }),
      localMain,
      trackingMain
    );
    expect(handoff.operatorCommand).toContain(`cd '/home/dev/o'\\''brien'`);
  });

  it("never tells the operator to re-run in place, which is the loop that was shipped", () => {
    const handoff = refreshNotCompletedHandoff(
      stateWith({ mainCheckedOutElsewhere: true, mainWorktreePath: O.some("/home/dev/beep-effect") }),
      localMain,
      trackingMain
    );
    expect(handoff.operatorCommand).not.toBe("bun run beep yeet sweep");
  });

  it("names no path when the worktree probe could not be read", () => {
    const handoff = refreshNotCompletedHandoff(
      stateWith({ mainCheckedOutElsewhere: true, worktreeProbeUnreliable: true }),
      localMain,
      trackingMain
    );
    expect(handoff.operatorCommand).toBe("bun run beep yeet sweep");
    expect(handoff.reason).toContain("Re-running here cannot fix it");
  });
});
