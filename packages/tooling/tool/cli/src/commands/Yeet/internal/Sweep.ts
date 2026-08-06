/**
 * Post-merge workspace sweep: observe the clone, plan the cleanup, run it.
 *
 * The sweep is the tail that returns a clone to a ready state after a merge
 * lands. It is split into three pieces so the interesting half is testable
 * without a git fixture: {@link observeSweepGitState} performs every read-only
 * git and `gh` probe, {@link buildSweepPlan} is a pure function from those
 * observations to a {@link SweepPlan}, and {@link executeSweep} threads the two
 * together, runs the plan, and writes a {@link SweepReport}.
 *
 * **Details**
 *
 * Every planned step carries the preconditions that must hold for its action.
 * The executor's rule is one line: a step whose preconditions all hold runs its
 * action; any unsatisfied precondition is a skip whose reason names the facts
 * that blocked it. That is why the plan is worth reading — `--plan` output is a
 * complete explanation of what the sweep will and will not do, before it does
 * anything.
 *
 * The sweep never fails on a step. A dirty worktree, a branch checked out
 * elsewhere, a local tip that has moved past the merged pull request head — each
 * is reported, never overridden, because unpushed local work is sacred. "Merged,
 * cleanup skipped: reason" is a success. The only outcome that asks for a human
 * is `needs-operator`, raised when an action is refused by authority rather than
 * by safety (a denied remote ref deletion), and it carries the exact command so
 * handoffs batch instead of arriving one failure at a time.
 *
 * **Gotchas**
 *
 * Worktree detection goes through `git worktree list --porcelain`, never a
 * `[ -d "$dir/.git" ]` probe: `.git` is a FILE in a linked worktree, so the
 * directory test silently reports "no worktree holds this branch" while a linked
 * worktree has it checked out — precisely the case the force-deletion contract
 * exists to prevent.
 *
 * A probe whose captured output was truncated is UNKNOWN, never "no rows". A
 * truncated `git worktree list --porcelain` would otherwise read as "no worktree
 * holds this branch" — the same silent miss with a different cause — so
 * truncation forces the facts it feeds to their conservative value (branch held,
 * worktree dirty) and the blocked step's reason names the truncated command
 * instead of a fact nobody observed.
 *
 * The pull request is only trusted once its head branch is confirmed to be the
 * branch being swept. `gh pr view <branch>` resolves a pull request by more than
 * an exact head match, so anchoring the MERGED-gated deletions to an unverified
 * pull request would let another branch's merge authorize this branch's
 * force-deletion.
 *
 * `delete-local-branch` is planned before `end-state`, so a sweep run from the
 * merged branch's own worktree skips the deletion ("no worktree holds
 * `<branch>`" fails) and then leaves the clone on `main`. Re-running the sweep
 * completes the deletion. Moving HEAD first would mean mutating the worktree
 * before the plan's safety facts were acted on, which the rails forbid.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { guardLiteralArg } from "@beep/repo-utils";
import { SchemaUtils } from "@beep/schema";
import { Clock, DateTime, Effect, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhPrView, ghOutput } from "../../../internal/github/index.ts";
import { runRepoCommandCapture, safeOriginBranchFromBase } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { artifactDirForContext } from "./ArtifactPaths.ts";
import { optionFromNonEmpty } from "./GitExec.ts";
import { writeTextFile } from "./IssueArtifacts.ts";
import {
  SweepPlan,
  SweepPlanStep,
  SweepPrecondition,
  SweepReport,
  SweepReportJson,
  SweepReportStep,
  SweepStepExecuted,
  SweepStepId,
  SweepStepNeedsOperator,
  SweepStepOutcome,
  SweepStepSkipped,
} from "./Sweep.schemas.ts";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Sweep");

const sweepReportFileName = "sweep-report.json";

const permissionDenialMarkers = [
  "permission denied",
  "permission to",
  "denied to",
  "403",
  "not authorized",
  "protected branch",
  "pre-receive hook declined",
  "refusing to allow",
] as const;

/**
 * The git and GitHub facts one sweep is planned from.
 *
 * **Details**
 *
 * This record is the seam between the world and the planner: everything
 * {@link buildSweepPlan} needs, and nothing it can observe for itself. Splitting
 * it out is what makes the deletion contract testable — a force-deletion
 * precondition is falsified by constructing a state, not by staging a repository.
 *
 * "Elsewhere" in `mainCheckedOutElsewhere` and `branchCheckedOutElsewhere` means
 * a worktree other than the one being swept; whether the sweeping worktree holds
 * a branch is read off `headBranch`, so the two facts together answer "does any
 * worktree hold it".
 *
 * `pullRequestHeadBranch` is kept rather than discarded because a pull request
 * only speaks for this sweep when its head is this branch; the deletion steps
 * check it, so a pull request `gh` resolved by some other route cannot authorize
 * deleting a branch it never belonged to.
 *
 * **Gotchas**
 *
 * `statusProbeTruncated` and `worktreeProbeTruncated` are the "this fact is
 * unknown" carriers. When either is true the boolean it feeds is already forced
 * to its conservative value here, so a reader of the raw facts is safe too; the
 * flag exists so the plan can name the truncated command as the blocker instead
 * of asserting a worktree state nobody observed.
 *
 * **Example** (Describe a merged branch that is safe to delete)
 *
 * ```ts
 * import { SweepGitState } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const state = SweepGitState.make({
 *   branch: "feat/merge-loop",
 *   mainBranch: "main",
 *   headBranch: "main",
 *   worktreeDirty: false,
 *   mainCheckedOutElsewhere: false,
 *   branchCheckedOutElsewhere: false,
 *   branchMergedIntoBase: false,
 *   lockfileMovedOnMainUpdate: true,
 *   statusProbeTruncated: false,
 *   worktreeProbeTruncated: false,
 *   localTip: O.some("aaaa1111"),
 *   remoteTip: O.some("aaaa1111"),
 *   pullRequestState: O.some("MERGED"),
 *   pullRequestHeadBranch: O.some("feat/merge-loop"),
 *   pullRequestHeadOid: O.some("aaaa1111"),
 * })
 * console.log(state.branch)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SweepGitState extends S.Class<SweepGitState>($I`SweepGitState`)(
  {
    branch: S.NonEmptyString,
    mainBranch: S.NonEmptyString,
    headBranch: S.NonEmptyString,
    worktreeDirty: S.Boolean,
    mainCheckedOutElsewhere: S.Boolean,
    branchCheckedOutElsewhere: S.Boolean,
    branchMergedIntoBase: S.Boolean,
    lockfileMovedOnMainUpdate: S.Boolean,
    statusProbeTruncated: S.Boolean,
    worktreeProbeTruncated: S.Boolean,
    localTip: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    remoteTip: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pullRequestState: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pullRequestHeadBranch: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pullRequestHeadOid: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("SweepGitState", {
    description: "Read-only git and GitHub facts one post-merge workspace sweep is planned from.",
  })
) {}

const precondition = (description: string, satisfied: boolean): SweepPrecondition =>
  SweepPrecondition.make({ description, satisfied });

const unsatisfied = (preconditions: ReadonlyArray<SweepPrecondition>): ReadonlyArray<SweepPrecondition> =>
  A.filter(preconditions, (observed) => !observed.satisfied);

/**
 * The preconditions blocking a planned step, empty when the step will run.
 *
 * **Details**
 *
 * This is the executor's whole decision rule, exposed so a `--plan` renderer and
 * the run itself agree by construction: a step with no blockers executes its
 * action, and any blocker becomes the skip reason verbatim.
 *
 * **Example** (Read the blockers off a planned step)
 *
 * ```ts
 * import { sweepStepBlockers, SweepPlanStep, SweepPrecondition } from "@beep/repo-cli/test/Yeet"
 *
 * const blockers = sweepStepBlockers(
 *   SweepPlanStep.make({
 *     id: "delete-local-branch",
 *     action: "git branch -D feat/merge-loop",
 *     preconditions: [SweepPrecondition.make({ description: "worktree is clean", satisfied: false })],
 *     requiresOperator: false,
 *   })
 * )
 * console.log(blockers.length)
 * ```
 *
 * @param planStep - Planned sweep step to inspect.
 * @returns Every unsatisfied precondition, in plan order.
 * @category planning
 * @since 0.0.0
 */
export const sweepStepBlockers = (planStep: SweepPlanStep): ReadonlyArray<SweepPrecondition> =>
  unsatisfied(planStep.preconditions);

const statusProbeCommand = "git status --porcelain";

const worktreeProbeCommand = "git worktree list --porcelain";

const optionText = (value: O.Option<string>): string => O.getOrElse(value, () => "<absent>");

const holdsBranch = (held: boolean, headBranch: string, branch: string): boolean => held || headBranch === branch;

const pullRequestIsMerged = (state: SweepGitState): boolean =>
  O.exists(state.pullRequestState, (value) => value === "MERGED");

const truncatedProbePrecondition = (command: string): SweepPrecondition =>
  precondition(`${command} output was not truncated`, false);

/**
 * A truncated probe leaves the fact unknown, so the blocker names the command
 * whose output was cut instead of a worktree state nobody observed.
 *
 * @param state - Observed git state carrying the probe-truncation flags.
 * @returns The clean-worktree precondition, or the truncation blocker.
 */
const cleanWorktreePrecondition = (state: SweepGitState): SweepPrecondition =>
  state.statusProbeTruncated
    ? truncatedProbePrecondition(statusProbeCommand)
    : precondition("worktree is clean", !state.worktreeDirty);

const mainFreePrecondition = (state: SweepGitState): SweepPrecondition =>
  state.worktreeProbeTruncated
    ? truncatedProbePrecondition(worktreeProbeCommand)
    : precondition(`${state.mainBranch} is not checked out in another worktree`, !state.mainCheckedOutElsewhere);

const branchFreePrecondition = (state: SweepGitState): SweepPrecondition =>
  state.worktreeProbeTruncated
    ? truncatedProbePrecondition(worktreeProbeCommand)
    : precondition(
        `no worktree holds ${state.branch}`,
        !holdsBranch(state.branchCheckedOutElsewhere, state.headBranch, state.branch)
      );

/**
 * The pull request `gh` resolved is only this branch's pull request when its
 * head branch says so; every MERGED-gated step carries this check.
 *
 * @param state - Observed git state carrying the resolved PR's head branch.
 * @returns A precondition holding only when the PR's head equals the branch.
 */
const pullRequestIdentityPrecondition = (state: SweepGitState): SweepPrecondition =>
  precondition(
    `pull request head branch ${optionText(state.pullRequestHeadBranch)} is ${state.branch}`,
    O.exists(state.pullRequestHeadBranch, (head) => head === state.branch)
  );

const tipsMatch = (left: O.Option<string>, right: O.Option<string>): boolean =>
  O.isSome(left) && O.isSome(right) && left.value === right.value;

const fetchPrunePlanStep = (): SweepPlanStep =>
  SweepPlanStep.make({
    id: "fetch-prune",
    action: "git fetch --prune origin",
    preconditions: [],
    requiresOperator: false,
  });

const ffMainPlanStep = (state: SweepGitState): SweepPlanStep =>
  state.headBranch === state.mainBranch
    ? SweepPlanStep.make({
        id: "ff-main",
        action: `git merge --ff-only refs/remotes/origin/${state.mainBranch}`,
        preconditions: [cleanWorktreePrecondition(state)],
        requiresOperator: false,
      })
    : SweepPlanStep.make({
        id: "ff-main",
        action: `git fetch origin ${state.mainBranch}:${state.mainBranch}`,
        preconditions: [mainFreePrecondition(state)],
        requiresOperator: false,
      });

const deleteLocalBranchPlanStep = (state: SweepGitState): SweepPlanStep => {
  const shared = [
    precondition(`local branch ${state.branch} exists`, O.isSome(state.localTip)),
    precondition(`pull request for ${state.branch} is MERGED`, pullRequestIsMerged(state)),
    pullRequestIdentityPrecondition(state),
    branchFreePrecondition(state),
  ];
  return state.branchMergedIntoBase
    ? SweepPlanStep.make({
        id: "delete-local-branch",
        action: `git branch -d ${state.branch}`,
        preconditions: A.append(
          shared,
          precondition(`${state.branch} is an ancestor of origin/${state.mainBranch}`, true)
        ),
        requiresOperator: false,
      })
    : SweepPlanStep.make({
        id: "delete-local-branch",
        action: `git branch -D ${state.branch}`,
        preconditions: A.append(
          shared,
          precondition(
            `local tip ${optionText(state.localTip)} equals pull request head ${optionText(state.pullRequestHeadOid)}`,
            tipsMatch(state.localTip, state.pullRequestHeadOid)
          )
        ),
        requiresOperator: false,
      });
};

const deleteRemoteBranchPlanStep = (state: SweepGitState): SweepPlanStep => {
  const preconditions = [
    precondition(`remote branch origin/${state.branch} exists`, O.isSome(state.remoteTip)),
    precondition(`pull request for ${state.branch} is MERGED`, pullRequestIsMerged(state)),
    pullRequestIdentityPrecondition(state),
    precondition(
      `remote tip ${optionText(state.remoteTip)} equals pull request head ${optionText(state.pullRequestHeadOid)}`,
      tipsMatch(state.remoteTip, state.pullRequestHeadOid)
    ),
  ];
  return SweepPlanStep.make({
    id: "delete-remote-branch",
    action: `git push origin --delete ${state.branch}`,
    preconditions,
    requiresOperator: A.isReadonlyArrayEmpty(unsatisfied(preconditions)),
  });
};

const lockfileInstallPlanStep = (state: SweepGitState): SweepPlanStep =>
  SweepPlanStep.make({
    id: "lockfile-install",
    action: "bun install",
    preconditions: [
      precondition(`bun.lock moved in the ${state.mainBranch} update`, state.lockfileMovedOnMainUpdate),
      cleanWorktreePrecondition(state),
    ],
    requiresOperator: false,
  });

const endStatePlanStep = (state: SweepGitState): SweepPlanStep =>
  SweepPlanStep.make({
    id: "end-state",
    action: `git switch ${state.mainBranch}`,
    preconditions:
      state.headBranch === state.mainBranch ? [] : [cleanWorktreePrecondition(state), mainFreePrecondition(state)],
    requiresOperator: false,
  });

/**
 * Turn observed git state into the plan a sweep would execute.
 *
 * **Details**
 *
 * Pure: the same state and timestamp always produce the same plan, which is what
 * makes the branch-deletion contract testable without a repository fixture.
 *
 * `requiresOperator` is derived, never asserted. It is true only for a remote ref
 * deletion whose preconditions all hold, because that is the one action the
 * running session may lack authority for; flagging it at plan time lets `--plan`
 * output batch the operator handoff instead of discovering the denial mid-run.
 * Safety blockers — a tip mismatch, a dirty worktree, a branch held by a worktree
 * — never become handoffs, because performing them anyway would destroy work.
 *
 * **Gotchas**
 *
 * The `-d` and `-D` variants of `delete-local-branch` carry different
 * precondition sets on purpose. `-d` leans on git's own ancestry check, so it
 * records the ancestry fact and stops. `-D` overrides that check, so it demands
 * the full review-hardened set: the pull request is MERGED, the pull request's
 * head branch is this branch, the local tip still equals the pull request's
 * recorded head (a post-merge push makes MERGED stale), and no worktree holds the
 * branch.
 *
 * A worktree fact the observer could not read — a truncated
 * `git worktree list --porcelain` or `git status --porcelain` — is not silently
 * treated as "nothing found". The step blocks, and its blocker names the
 * truncated command rather than claiming a worktree state.
 *
 * **Example** (Plan a sweep for a squash-merged branch)
 *
 * ```ts
 * import { buildSweepPlan, SweepGitState } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const plan = buildSweepPlan(
 *   SweepGitState.make({
 *     branch: "feat/merge-loop",
 *     mainBranch: "main",
 *     headBranch: "main",
 *     worktreeDirty: false,
 *     mainCheckedOutElsewhere: false,
 *     branchCheckedOutElsewhere: false,
 *     branchMergedIntoBase: false,
 *     lockfileMovedOnMainUpdate: false,
 *     statusProbeTruncated: false,
 *     worktreeProbeTruncated: false,
 *     localTip: O.some("aaaa1111"),
 *     remoteTip: O.some("aaaa1111"),
 *     pullRequestState: O.some("MERGED"),
 *     pullRequestHeadBranch: O.some("feat/merge-loop"),
 *     pullRequestHeadOid: O.some("aaaa1111"),
 *   }),
 *   "2026-08-04T00:00:00.000Z"
 * )
 * console.log(plan.steps.length)
 * ```
 *
 * @param state - Observed git and GitHub facts for the branch being swept.
 * @param createdAt - ISO timestamp recorded on the plan.
 * @returns The ordered plan, one step per {@link SweepStepId}.
 * @category planning
 * @since 0.0.0
 */
export const buildSweepPlan = (state: SweepGitState, createdAt: string): SweepPlan =>
  SweepPlan.make({
    schemaVersion: "yeet-sweep-plan/v1",
    createdAt,
    branch: state.branch,
    steps: [
      fetchPrunePlanStep(),
      ffMainPlanStep(state),
      deleteLocalBranchPlanStep(state),
      deleteRemoteBranchPlanStep(state),
      lockfileInstallPlanStep(state),
      endStatePlanStep(state),
    ],
  });

type CommandProbe = {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
};

type WorktreeEntry = {
  readonly path: string;
  readonly branch: O.Option<string>;
};

const captureCommand = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
): Effect.Effect<CommandProbe, never, ChildProcessSpawner.ChildProcessSpawner> =>
  runRepoCommandCapture(command, args, cwd).pipe(
    Effect.map(
      (result): CommandProbe => ({
        exitCode: result.exitCode,
        output: Str.trim(result.output),
        truncated: result.truncated,
      })
    ),
    Effect.orElseSucceed((): CommandProbe => ({ exitCode: 1, output: "", truncated: false }))
  );

const captureGit = (
  cwd: string,
  args: ReadonlyArray<string>
): Effect.Effect<CommandProbe, never, ChildProcessSpawner.ChildProcessSpawner> => captureCommand("git", args, cwd);

const firstLine = (text: string): string =>
  pipe(
    Str.split(text, "\n"),
    A.map(Str.trim),
    A.findFirst(Str.isNonEmpty),
    O.getOrElse(() => "no output")
  );

const probeFailureText = (probe: CommandProbe): string => firstLine(probe.output);

const valueAfter = (prefix: string, line: string): string => Str.trim(Str.slice(Str.length(prefix))(line));

const parseWorktreeList = (output: string): ReadonlyArray<WorktreeEntry> =>
  pipe(
    Str.split(output, "\n\n"),
    A.map((block) => {
      const lines = pipe(Str.split(block, "\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));
      return pipe(
        A.findFirst(lines, Str.startsWith("worktree ")),
        O.map(
          (line): WorktreeEntry => ({
            path: valueAfter("worktree ", line),
            branch: pipe(
              A.findFirst(lines, Str.startsWith("branch refs/heads/")),
              O.map((branchLine) => valueAfter("branch refs/heads/", branchLine))
            ),
          })
        )
      );
    }),
    A.getSomes
  );

const heldByOtherWorktree = (worktrees: ReadonlyArray<WorktreeEntry>, branch: string, selfPath: string): boolean =>
  A.some(worktrees, (entry) => entry.path !== selfPath && O.exists(entry.branch, (held) => held === branch));

const observeSha = (
  cwd: string,
  ref: string
): Effect.Effect<O.Option<string>, never, ChildProcessSpawner.ChildProcessSpawner> =>
  captureGit(cwd, ["rev-parse", "--verify", "--quiet", ref]).pipe(
    Effect.map((probe) => (probe.exitCode === 0 ? optionFromNonEmpty(probe.output) : O.none<string>()))
  );

const decodePullRequestView = S.decodeUnknownOption(S.fromJsonString(GhPrView));

const observePullRequest = Effect.fn("Yeet.observeSweepPullRequest")(function* (
  context: RepoRunContext,
  branch: string
): Effect.fn.Return<O.Option<GhPrView>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* ghOutput({
    args: ["pr", "view", branch, "--json", "number,headRefName,state,headRefOid"],
    cwd: context.repoRoot,
    label: `gh pr view ${branch}`,
    onFailure: (failure) => failure,
  }).pipe(
    Effect.map(O.some),
    Effect.orElseSucceed(() => O.none<string>())
  );
  return O.flatMap(output, decodePullRequestView);
});

const mainBranchFromContext = (context: RepoRunContext): string =>
  pipe(
    safeOriginBranchFromBase(context.base),
    O.getOrElse(() => "main")
  );

const refuseUnsafeName = (value: string, role: string) =>
  guardLiteralArg(value).pipe(
    Effect.mapError(
      YeetCommandError.new(`yeet sweep refuses an option-like ${role} name "${value}".`, {
        command: "git",
        exitCode: 1,
      })
    )
  );

/**
 * Probe the clone for every fact {@link buildSweepPlan} needs.
 *
 * **Details**
 *
 * Read-only by construction: `rev-parse`, `status --porcelain`,
 * `worktree list --porcelain`, `merge-base --is-ancestor`, a `bun.lock` diff
 * between local and remote `main`, and one `gh pr view`. Individual probes are
 * failure-tolerant — a missing ref or an absent pull request reads as `None`,
 * not as an error — so planning still succeeds in a half-configured clone and
 * the plan simply reports more unsatisfied preconditions.
 *
 * **Gotchas**
 *
 * The branch and base names are pushed through `guardLiteralArg` before they
 * reach any argv, so an option-like branch name fails the sweep outright instead
 * of becoming a git flag. That refusal is the one way sweep planning errors.
 *
 * Failure-tolerant is not the same as optimistic. A truncated `status` or
 * `worktree list` capture is recorded as such and the fact it feeds is forced to
 * its conservative value — dirty worktree, branch held — because "the output was
 * cut off" and "the branch is free" are the same bytes to a parser and only one
 * of them is safe to force-delete against.
 *
 * **Example** (Observe the current clone)
 *
 * ```ts
 * import { observeSweepGitState } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(observeSweepGitState)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root, branch, and base ref.
 * @returns The observed git and GitHub facts for the branch being swept.
 * @category planning
 * @since 0.0.0
 */
export const observeSweepGitState = Effect.fn("Yeet.observeSweepGitState")(function* (
  context: RepoRunContext
): Effect.fn.Return<SweepGitState, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const branch = yield* refuseUnsafeName(context.branch, "branch");
  const mainBranch = yield* refuseUnsafeName(mainBranchFromContext(context), "base branch");
  const repoRoot = context.repoRoot;

  const head = yield* captureGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const status = yield* captureGit(repoRoot, ["status", "--porcelain"]);
  const toplevel = yield* captureGit(repoRoot, ["rev-parse", "--show-toplevel"]);
  const worktreeList = yield* captureGit(repoRoot, ["worktree", "list", "--porcelain"]);
  const localTip = yield* observeSha(repoRoot, `refs/heads/${branch}`);
  const remoteTip = yield* observeSha(repoRoot, `refs/remotes/origin/${branch}`);
  const ancestry = yield* captureGit(repoRoot, [
    "merge-base",
    "--is-ancestor",
    `refs/heads/${branch}`,
    `refs/remotes/origin/${mainBranch}`,
  ]);
  const lockfile = yield* captureGit(repoRoot, [
    "diff",
    "--name-only",
    `refs/heads/${mainBranch}..refs/remotes/origin/${mainBranch}`,
    "--",
    "bun.lock",
  ]);
  const pullRequest = yield* observePullRequest(context, branch);

  const worktrees = parseWorktreeList(worktreeList.output);
  return SweepGitState.make({
    branch,
    mainBranch,
    headBranch: pipe(
      optionFromNonEmpty(head.output),
      O.getOrElse(() => "HEAD")
    ),
    worktreeDirty: status.truncated || (status.exitCode === 0 && Str.isNonEmpty(status.output)),
    mainCheckedOutElsewhere: worktreeList.truncated || heldByOtherWorktree(worktrees, mainBranch, toplevel.output),
    branchCheckedOutElsewhere: worktreeList.truncated || heldByOtherWorktree(worktrees, branch, toplevel.output),
    branchMergedIntoBase: ancestry.exitCode === 0 && O.isSome(localTip),
    lockfileMovedOnMainUpdate: lockfile.exitCode === 0 && Str.isNonEmpty(lockfile.output),
    statusProbeTruncated: status.truncated,
    worktreeProbeTruncated: worktreeList.truncated,
    localTip,
    remoteTip,
    pullRequestState: O.flatMap(pullRequest, (view) => optionFromNonEmpty(view.state)),
    pullRequestHeadBranch: O.flatMap(pullRequest, (view) => optionFromNonEmpty(view.headRefName)),
    pullRequestHeadOid: O.flatMap(pullRequest, (view) =>
      O.flatMap(O.fromNullishOr(view.headRefOid), optionFromNonEmpty)
    ),
  });
});

/**
 * Observe the clone and build the plan without executing anything.
 *
 * **Details**
 *
 * This is `--plan` mode. The caller renders the returned plan through
 * `SweepPlanJson.encode` — the plan is a document, so it crosses any boundary
 * through its codec rather than `JSON.stringify`.
 *
 * **Example** (Build a dry-run plan)
 *
 * ```ts
 * import { planSweep } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(planSweep)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root, branch, and base ref.
 * @returns The plan the sweep would execute against the observed clone.
 * @category planning
 * @since 0.0.0
 */
export const planSweep = Effect.fn("Yeet.planSweep")(function* (
  context: RepoRunContext
): Effect.fn.Return<SweepPlan, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const createdAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  return buildSweepPlan(yield* observeSweepGitState(context), createdAt);
});

const isPermissionDenial = (output: string): boolean => {
  const lowered = Str.toLowerCase(output);
  return A.some(permissionDenialMarkers, (marker) => Str.includes(marker)(lowered));
};

const executedFrom = (probe: CommandProbe): SweepStepOutcome =>
  SweepStepExecuted.make({ detail: optionFromNonEmpty(probe.output) });

const skippedFromFailure = (action: string, probe: CommandProbe): SweepStepOutcome =>
  SweepStepSkipped.make({
    reason: `${action} failed (exit ${probe.exitCode}): ${probeFailureText(probe)}`,
  });

const runCommandStep = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  action: string
): Effect.Effect<SweepStepOutcome, never, ChildProcessSpawner.ChildProcessSpawner> =>
  captureCommand(command, args, cwd).pipe(
    Effect.map((probe) => (probe.exitCode === 0 ? executedFrom(probe) : skippedFromFailure(action, probe)))
  );

const runRemoteDeletionStep = (
  state: SweepGitState,
  cwd: string,
  action: string
): Effect.Effect<SweepStepOutcome, never, ChildProcessSpawner.ChildProcessSpawner> =>
  captureGit(cwd, ["push", "origin", "--delete", state.branch]).pipe(
    Effect.map((probe) => {
      if (probe.exitCode === 0) {
        return executedFrom(probe);
      }
      if (isPermissionDenial(probe.output)) {
        return SweepStepNeedsOperator.make({
          reason: `deleting origin/${state.branch} was denied by permission: ${probeFailureText(probe)}`,
          operatorCommand: action,
        });
      }
      return skippedFromFailure(action, probe);
    })
  );

const runEndStateStep = (
  state: SweepGitState,
  cwd: string,
  action: string
): Effect.Effect<SweepStepOutcome, never, ChildProcessSpawner.ChildProcessSpawner> =>
  state.headBranch === state.mainBranch
    ? Effect.succeed(SweepStepExecuted.make({ detail: O.some(`already on ${state.mainBranch}`) }))
    : captureGit(cwd, ["switch", state.mainBranch]).pipe(
        Effect.map((probe) =>
          probe.exitCode === 0
            ? SweepStepExecuted.make({ detail: O.some(`switched to ${state.mainBranch}`) })
            : skippedFromFailure(action, probe)
        )
      );

const performSweepStep = (
  context: RepoRunContext,
  state: SweepGitState,
  planStep: SweepPlanStep
): Effect.Effect<SweepStepOutcome, never, ChildProcessSpawner.ChildProcessSpawner> =>
  SweepStepId.$match(planStep.id, {
    "fetch-prune": () => runCommandStep("git", ["fetch", "--prune", "origin"], context.repoRoot, planStep.action),
    "ff-main": () =>
      state.headBranch === state.mainBranch
        ? runCommandStep(
            "git",
            ["merge", "--ff-only", `refs/remotes/origin/${state.mainBranch}`],
            context.repoRoot,
            planStep.action
          )
        : runCommandStep(
            "git",
            ["fetch", "origin", `${state.mainBranch}:${state.mainBranch}`],
            context.repoRoot,
            planStep.action
          ),
    "delete-local-branch": () =>
      runCommandStep(
        "git",
        ["branch", state.branchMergedIntoBase ? "-d" : "-D", state.branch],
        context.repoRoot,
        planStep.action
      ),
    "delete-remote-branch": () => runRemoteDeletionStep(state, context.repoRoot, planStep.action),
    "lockfile-install": () => runCommandStep("bun", ["install"], context.repoRoot, planStep.action),
    "end-state": () => runEndStateStep(state, context.repoRoot, planStep.action),
  });

const runSweepStep = Effect.fn("Yeet.runSweepStep")(function* (
  context: RepoRunContext,
  state: SweepGitState,
  planStep: SweepPlanStep
): Effect.fn.Return<SweepReportStep, never, ChildProcessSpawner.ChildProcessSpawner> {
  const startedAt = yield* Clock.currentTimeMillis;
  const blocked = sweepStepBlockers(planStep);
  const outcome = A.isReadonlyArrayEmpty(blocked)
    ? yield* performSweepStep(context, state, planStep)
    : SweepStepSkipped.make({
        reason: `blocked: ${A.join(
          A.map(blocked, (observed) => observed.description),
          "; "
        )}`,
      });
  const endedAt = yield* Clock.currentTimeMillis;
  return SweepReportStep.make({ id: planStep.id, outcome, durationMs: O.some(endedAt - startedAt) });
});

/**
 * Resolve the sweep report artifact path for a repo run context.
 *
 * **Example** (Resolve the report path)
 *
 * ```ts
 * import { sweepReportPath } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(sweepReportPath)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the artifact directory.
 * @returns Absolute path to `.beep/yeet/sweep-report.json`.
 * @category artifacts
 * @since 0.0.0
 */
export const sweepReportPath = Effect.fn("Yeet.sweepReportPath")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(yield* artifactDirForContext(context), sweepReportFileName);
});

/**
 * Observe, plan, execute, and record one post-merge workspace sweep.
 *
 * **Details**
 *
 * Steps run in {@link SweepStepId} order and each produces exactly one outcome.
 * No step outcome fails the sweep: the returned {@link SweepReport} is the whole
 * result, and a caller that renders it exits 0 whether every step ran, every step
 * skipped, or a remote deletion needs the operator. The report is written to
 * `.beep/yeet/sweep-report.json` through {@link SweepReportJson} so the artifact
 * is encoded rather than stringified.
 *
 * **Gotchas**
 *
 * The sweep still errors on one thing: an option-like branch or base name, which
 * is refused before any argv is built. That is a refusal to plan, not a failed
 * step, so it has no place in the report.
 *
 * **Example** (Run the sweep)
 *
 * ```ts
 * import { executeSweep } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(executeSweep)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root, branch, base, and artifact directory.
 * @returns The executed sweep report, already persisted.
 * @category workflows
 * @since 0.0.0
 */
export const executeSweep = Effect.fn("Yeet.executeSweep")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  SweepReport,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const state = yield* observeSweepGitState(context);
  const plan = buildSweepPlan(state, startedAt);
  const steps = yield* Effect.forEach(plan.steps, (planStep) => runSweepStep(context, state, planStep));
  const endedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const report = SweepReport.make({
    schemaVersion: "yeet-sweep-report/v1",
    plan,
    steps,
    startedAt,
    endedAt,
  });
  const encoded = yield* SweepReportJson.encode(report).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode the yeet sweep report."))
  );
  yield* writeTextFile(yield* sweepReportPath(context), encoded);
  return report;
});

const outcomeSummary = (outcome: SweepStepOutcome): string =>
  SweepStepOutcome.match(outcome, {
    executed: (executed) =>
      `executed${pipe(
        executed.detail,
        O.map((detail) => `: ${firstLine(detail)}`),
        O.getOrElse(() => "")
      )}`,
    skipped: (skipped) => `skipped: ${skipped.reason}`,
    "needs-operator": (handoff) => `needs-operator: ${handoff.reason}`,
  });

const operatorCommands = (report: SweepReport): ReadonlyArray<string> =>
  pipe(
    A.map(report.steps, (step) =>
      step.outcome.status === "needs-operator" ? O.some(step.outcome.operatorCommand) : O.none<string>()
    ),
    A.getSomes
  );

/**
 * Render a sweep report as operator-facing text with a batched handoff block.
 *
 * **Details**
 *
 * The trailing block exists because discovering permission boundaries one failed
 * command at a time is the friction this command was built to remove: every
 * `needs-operator` outcome contributes its exact command, so the human runs them
 * as one batch.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { renderSweepReport, SweepPlan, SweepReport } from "@beep/repo-cli/test/Yeet"
 *
 * const rendered = renderSweepReport(
 *   SweepReport.make({
 *     schemaVersion: "yeet-sweep-report/v1",
 *     plan: SweepPlan.make({
 *       schemaVersion: "yeet-sweep-plan/v1",
 *       createdAt: "2026-08-04T00:00:00.000Z",
 *       branch: "feat/merge-loop",
 *       steps: [],
 *     }),
 *     steps: [],
 *     startedAt: "2026-08-04T00:00:00.000Z",
 *     endedAt: "2026-08-04T00:00:01.000Z",
 *   })
 * )
 * console.log(rendered)
 * ```
 *
 * @param report - Executed sweep report to render.
 * @returns Multi-line operator summary, ending with the handoff block when one is needed.
 * @category rendering
 * @since 0.0.0
 */
export const renderSweepReport = (report: SweepReport): string => {
  const header = `[yeet] sweep ${report.plan.branch}`;
  const lines = A.map(report.steps, (step) => `  ${step.id}: ${outcomeSummary(step.outcome)}`);
  const handoff = operatorCommands(report);
  const handoffLines = A.isReadonlyArrayEmpty(handoff)
    ? A.empty<string>()
    : [
        `  operator handoff (${handoff.length} command(s) only you can run):`,
        ...A.map(handoff, (command) => `    ${command}`),
      ];
  return A.join([header, ...lines, ...handoffLines], "\n");
};
