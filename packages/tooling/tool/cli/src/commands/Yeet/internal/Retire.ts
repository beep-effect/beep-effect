/**
 * Retire the linked worktree a sweep was started from, then sweep its owning clone.
 *
 * **Details**
 *
 * `yeet sweep` on its own resets the checkout it runs in, which inside a linked
 * worktree is the wrong checkout: `main` lives in the owning clone, and the
 * merged branch is the one checked out right here. `--retire` closes that gap
 * for the post-merge closeout an agent performs from its lane: it archives any
 * residue, removes the worktree and its branch through the worktree removal
 * service, and hands the sweep the owning clone as its repo root.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { constant, dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ghOutput } from "../../../internal/github/index.ts";
import { runCapturedStreams } from "../../../internal/process/index.ts";
import {
  fallowAuditCacheEnv,
  fallowAuditCacheRemoveArgs,
  RepoRunContext,
  resolveFallowAuditCacheSettings,
  runRepoCommandCapture,
} from "../../../internal/repo-run/index.ts";
import { describeInotifyWatcher, invokerExemption } from "../../Worktree/Worktree.command.ts";
import { WorktreeRemovalRequest } from "../../Worktree/Worktree.schemas.ts";
import { WorktreeRemovalService } from "../../Worktree/Worktree.service.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { isSettledProofJob, isTerminalProofJobPhase } from "./ProofJob.ts";
import { ProofJobLauncher } from "./ProofJobLauncher.ts";
import { StoppedLaneJob, YeetRetirePlan, YeetRetireVerdict } from "./Retire.schemas.ts";
import type { WorktreeRemovalReceipt } from "../../Worktree/Worktree.schemas.ts";
import type { ProofJobRecord } from "./ProofJob.ts";
import type { SweepGitState } from "./Sweep.ts";

const decodeWorktreeName = S.decodeUnknownEffect(WorktreeRemovalRequest.fields.name);
const decodeRetirePlan = S.decodeUnknownEffect(YeetRetirePlan);
const decodeVerdictTip = S.decodeUnknownOption(YeetRetireVerdict.cases["pr-less-on-main"].fields.tip);

// The lane's own CLI always carries --retire, whatever branch the clone sits on.
const REPO_CLI_ENTRY_PATH = "packages/tooling/tool/cli/src/bin.ts";

const gitOutput = Effect.fn("Yeet.retireGitOutput")(function* (cwd: string, args: ReadonlyArray<string>) {
  const commandLine = `git ${A.join(args, " ")}`;
  const result = yield* runRepoCommandCapture("git", args, cwd).pipe(
    Effect.mapError(YeetCommandError.new(`${commandLine} could not run in ${cwd}.`))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `${commandLine} exited with ${result.exitCode} in ${cwd}: ${Str.trim(result.output)}`,
    });
  }
  return Str.trim(result.output);
});

// A shared thunk, not a lambda per call site: the fallback is the same text everywhere.
const unknownText = constant("unknown");

const optionText = (value: O.Option<string>): string => O.getOrElse(value, unknownText);

const refused = (reason: string): YeetRetireVerdict => YeetRetireVerdict.cases.refused.make({ reason });

// The pull request's own facts, in the order an operator would check them:
// MERGED first, then whether it heads the branch being retired.
const pullRequestVerdict = (plan: YeetRetirePlan, state: SweepGitState): YeetRetireVerdict =>
  O.match(
    A.findFirst(
      [
        [
          !O.exists(state.pullRequestState, (value) => Eq.equals(value, "MERGED")),
          `the pull request for ${plan.branch} is ${optionText(state.pullRequestState)}, not MERGED`,
        ] as const,
        [
          !O.exists(state.pullRequestHeadBranch, (head) => Eq.equals(head, plan.branch)),
          `the resolved pull request heads ${optionText(state.pullRequestHeadBranch)}, not ${plan.branch}`,
        ] as const,
      ],
      ([blocked]) => blocked
    ),
    {
      onNone: () => YeetRetireVerdict.cases["pr-merged"].make({}),
      onSome: ([, reason]) => refused(reason),
    }
  );

// Without a pull request the branch itself must prove it landed: its tip is
// already an ancestor of the remote main branch and nothing uncommitted would
// be archived away. `branchMergedIntoBase` is the observed
// `merge-base --is-ancestor refs/heads/<branch> refs/remotes/origin/<main>`,
// and `worktreeDirty` folds an unreliable status probe in as dirty.
const pullRequestLessVerdict = (plan: YeetRetirePlan, state: SweepGitState): YeetRetireVerdict =>
  O.getOrElse(
    O.map(
      A.findFirst(
        [
          [
            !state.branchMergedIntoBase,
            `no pull request was observed for ${plan.branch} and its tip ${optionText(state.localTip)} is not contained in origin/${state.mainBranch}`,
          ] as const,
          [
            state.worktreeDirty,
            `no pull request was observed for ${plan.branch} and the lane has uncommitted changes`,
          ] as const,
        ],
        ([blocked]) => blocked
      ),
      ([, reason]) => refused(reason)
    ),
    () =>
      O.match(O.flatMap(state.localTip, decodeVerdictTip), {
        onNone: () => refused(`no pull request was observed for ${plan.branch} and its tip could not be resolved`),
        onSome: (tip) => YeetRetireVerdict.cases["pr-less-on-main"].make({ tip, mainBranch: state.mainBranch }),
      })
  );

/**
 * The retirement gate's decision for a lane.
 *
 * **Details**
 *
 * A lane whose branch headed a pull request is judged by that pull request:
 * it must be MERGED and head the branch (`pr-merged`). A lane whose branch
 * never headed one is judged by git: its tip must already be contained in
 * `origin/<main>` and its tree clean (`pr-less-on-main`), the case of a
 * scratch checkout, a stacked parent, or a branch pushed straight to main.
 * Anything else is `refused` with the first reason an operator would check.
 *
 * **Example** (Read the gate)
 *
 * ```ts
 * import { retireVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof retireVerdict) // function
 * ```
 *
 * @param plan - The retirement plan under review.
 * @param state - The observed git and pull request facts for its branch.
 * @returns Why the retirement proceeds, or the reason it does not.
 * @category planning
 * @since 0.0.0
 */
export const retireVerdict: {
  (plan: YeetRetirePlan, state: SweepGitState): YeetRetireVerdict;
  (state: SweepGitState): (plan: YeetRetirePlan) => YeetRetireVerdict;
} = dual(
  2,
  (plan: YeetRetirePlan, state: SweepGitState): YeetRetireVerdict =>
    O.isSome(state.pullRequestState) ? pullRequestVerdict(plan, state) : pullRequestLessVerdict(plan, state)
);

/**
 * Render a verdict as the plan's `gate:` or `blocked:` line.
 *
 * **Example** (Render the merged gate)
 *
 * ```ts
 * import { renderRetireGate, YeetRetireVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderRetireGate(YeetRetireVerdict.cases["pr-merged"].make({}))) // "  gate: pull request MERGED"
 * ```
 *
 * @param verdict - The gate's decision.
 * @returns One indented report line.
 * @category formatting
 * @since 0.0.0
 */
export const renderRetireGate = (verdict: YeetRetireVerdict): string =>
  YeetRetireVerdict.match(verdict, {
    "pr-merged": () => "  gate: pull request MERGED",
    "pr-less-on-main": ({ tip, mainBranch }) =>
      `  gate: no pull request; tip ${tip} is already on origin/${mainBranch} and the lane is clean`,
    refused: ({ reason }) => `  blocked: ${reason}`,
  });

/**
 * Locate the linked worktree the sweep runs in and the clone that owns it.
 *
 * **Details**
 *
 * The lane is the checkout the command runs in, or the one `--lane` names
 * when the command runs from the owning clone (or anywhere else in the same
 * repository). The owning clone is the parent of the git common dir
 * (`git rev-parse --git-common-dir`); when the lane's top level equals it the
 * lane is the clone itself and the plan fails: there is nothing to retire and
 * a plain `yeet sweep` is the right command. A detached lane has no branch to
 * retire and fails the same way, and a `--lane` from another repository is
 * refused.
 *
 * **Example** (Build a plan effect)
 *
 * ```ts
 * import { planRetire } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(Effect.succeed(planRetire))) // true
 * ```
 *
 * @param context - Repo run context whose repo root is the checkout the sweep started in.
 * @param lane - The lane to retire when it is not the checkout the command runs in.
 * @returns The worktree, owning clone, and branch a retirement would act on.
 * @category planning
 * @since 0.0.0
 */
export const planRetire = Effect.fn("Yeet.planRetire")(function* (context: RepoRunContext, lane: O.Option<string>) {
  const path = yield* Path.Path;
  const anchor = O.match(lane, { onNone: () => context.repoRoot, onSome: (given) => path.resolve(given) });
  const common = yield* gitOutput(anchor, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const toplevel = yield* gitOutput(anchor, ["rev-parse", "--show-toplevel"]);
  const worktreePath = path.resolve(toplevel);
  const owningClone = path.dirname(path.resolve(common));
  if (Eq.equals(worktreePath, owningClone)) {
    return yield* YeetCommandError.make({
      message: O.isSome(lane)
        ? `yeet sweep --retire --lane names a linked worktree, but ${worktreePath} is the clone itself.`
        : `yeet sweep --retire runs inside a linked worktree, but ${worktreePath} is the clone itself; run \`yeet sweep\` without --retire, or name a lane with --lane.`,
    });
  }
  // A lane named from elsewhere must belong to this repository, so the sweep
  // that follows resets the clone the lane came from.
  const invokingCommon = yield* gitOutput(context.repoRoot, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  if (!Eq.equals(path.dirname(path.resolve(invokingCommon)), owningClone)) {
    return yield* YeetCommandError.make({
      message: `yeet sweep --retire --lane ${worktreePath} belongs to ${owningClone}, not to the clone this command runs in.`,
    });
  }
  const branch = O.isSome(lane) ? yield* gitOutput(anchor, ["rev-parse", "--abbrev-ref", "HEAD"]) : context.branch;
  return yield* decodeRetirePlan({
    worktreePath,
    owningClone,
    name: path.basename(worktreePath),
    branch: Eq.equals(branch, "HEAD") ? "" : branch,
  }).pipe(
    Effect.mapError(
      YeetCommandError.new(
        `yeet sweep --retire needs a branch checked out in ${worktreePath}; a detached HEAD has nothing to retire.`
      )
    )
  );
});

// A retired lane never audits again, so its ~600 MB Fallow base snapshot is
// deleted before the checkout goes: `audit-cache remove --root` only touches
// snapshots this root owns, and the janitor still reaps it if this fails.
const discardLaneFallowBaseCache = Effect.fn("Yeet.discardLaneFallowBaseCache")(function* (worktreePath: string) {
  const settings = yield* resolveFallowAuditCacheSettings();
  yield* runCapturedStreams({
    command: "bun",
    args: fallowAuditCacheRemoveArgs(worktreePath),
    cwd: worktreePath,
    env: fallowAuditCacheEnv(settings),
    extendEnv: true,
  }).pipe(Effect.ignore);
});

/**
 * Archive-retire the planned worktree and delete its branch once the gate opens.
 *
 * **Details**
 *
 * The gate is {@link retireVerdict}: the pull request resolved for the
 * branch is MERGED and heads it, or, for a branch that never headed one, the
 * tip is already contained in `origin/<main>` and the tree is clean.
 * Retirement always archives, so dirty files, unpushed commits and the lane's
 * git-ignored `.beep` material behind a merged pull request are preserved under
 * the residue root rather than blocking the closeout. A pull-request-less retirement is pinned to the tip
 * its verdict proved on `origin/<main>`: if the lane's HEAD moves before or
 * inside the archive fence, the removal refuses instead of retiring new work. The archive fence refuses a lane any process still
 * stands in; this command first moves its own working directory to the
 * owning clone and asks the fence to exempt the invoker's ancestry (the
 * shell and agent session that started it) plus, when the harness names the
 * session process through `CLAUDE_PID` and the fence can prove it did,
 * everything that session spawned into the lane (its MCP servers, tool
 * shells, and background jobs), through the exemption `worktree remove`
 * shares. When the command started inside the lane it retires, the fence
 * also leaves an idle Claude Desktop Terminal panel shell standing in it,
 * which the app starts in the session folder whether or not the operator
 * ever opened the panel, as long as that shell stays quiet until the lane is
 * deleted; the lane is removed under it and the report says to `cd` out of
 * it. Retiring the lane one is standing in therefore works from a desktop
 * session too, while any other holder (a panel shell running a command, an
 * editor, another session, or any panel shell when `--lane` names some
 * other lane) still refuses it and the message names what to close.
 *
 * **Example** (Build the retirement effect)
 *
 * ```ts
 * import { retireInvokingWorktree } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(Effect.succeed(retireInvokingWorktree))) // true
 * ```
 *
 * @param plan - The worktree, owning clone, and branch to retire.
 * @param state - The git and pull request facts observed for the branch.
 * @returns The removal receipt, naming any archived residue.
 * @category commands
 * @since 0.0.0
 */
export const retireInvokingWorktree = Effect.fn("Yeet.retireInvokingWorktree")(function* (
  plan: YeetRetirePlan,
  state: SweepGitState
) {
  const verdict = retireVerdict(plan, state);
  if (YeetRetireVerdict.guards.refused(verdict)) {
    return yield* YeetCommandError.make({
      message: `yeet sweep --retire refuses to retire ${plan.worktreePath}: ${verdict.reason}.`,
    });
  }
  const service = yield* WorktreeRemovalService;
  const name = yield* decodeWorktreeName(plan.name).pipe(
    Effect.mapError(YeetCommandError.new(`Worktree name ${plan.name} is not one safe path component.`))
  );
  // Leave the lane before it is renamed away and name the invoker to the
  // fence; starting inside the lane is what makes this a session closing its
  // own lane, the only retirement that may leave an idle desktop Terminal
  // panel shell.
  const exemptInvoker = yield* invokerExemption(plan.worktreePath, plan.owningClone);
  yield* discardLaneFallowBaseCache(plan.worktreePath);
  return yield* service
    .remove(
      WorktreeRemovalRequest.make({
        name,
        targetPath: plan.worktreePath,
        mainCheckout: plan.owningClone,
        branch: O.some(plan.branch),
        archive: true,
        deleteBranch: true,
        // A pull-request-less retirement was approved for one tip; pin the
        // removal to it so a HEAD that moves before or inside the fence refuses.
        expectedHead: YeetRetireVerdict.guards["pr-less-on-main"](verdict) ? O.some(verdict.tip) : O.none(),
        exemptInvoker,
      })
    )
    .pipe(
      Effect.mapError((error) =>
        YeetCommandError.make({
          message: retirementFailureMessage(plan, error.message),
          cause: error,
        })
      )
    );
});

// Unsettled is live: a `finished` job's loop has ended, but its unit stays
// loaded until the ExecStopPost finalizer has written the record by path.
const isLiveLaneJob = (record: ProofJobRecord): boolean => !isSettledProofJob(record);

/**
 * Stop the retiring lane's own live detached jobs before the fence.
 *
 * **Details**
 *
 * A detached yeet job (a readiness monitor or a proof) runs with the lane as
 * its working directory and appends its log under the lane's
 * `.beep/yeet/jobs/`. Once the gate has opened, its work is moot; left
 * running, it holds the fence and, by reopening its log by path, recreates the
 * lane after the fence renames it away (#2130). Every job not yet settled
 * counts, a `finished` one included: its unit stays loaded until its
 * finalizer has written the record, so its unit is stopped without a cancel
 * stamp that would overwrite the recorded outcome. `systemctl --user stop`
 * returns once the unit and its finalizer have stopped, so their last writes
 * land in the lane before its residue is captured. A listing that cannot be
 * read stops nothing; a stop systemd refuses is reported as `stop-failed`,
 * and the fence still refuses a job left holding the lane.
 *
 * **Example** (Build the stop effect)
 *
 * ```ts
 * import { stopLaneJobs } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(Effect.succeed(stopLaneJobs))) // true
 * ```
 *
 * @param plan - The retirement plan naming the lane.
 * @returns Each job it asked to stop, with the outcome of the request.
 * @category commands
 * @since 0.0.0
 */
export const stopLaneJobs = Effect.fn("Yeet.stopLaneJobs")(function* (plan: YeetRetirePlan) {
  const launcher = yield* ProofJobLauncher.make(plan.worktreePath);
  const records = yield* launcher.list.pipe(Effect.orElseSucceed(A.empty<ProofJobRecord>));
  return yield* Effect.forEach(A.filter(records, isLiveLaneJob), (record) =>
    // A cancel stamp would overwrite a finished job's outcome, so its unit is
    // only stopped; anything still running is cancelled.
    (isTerminalProofJobPhase(record.phase) ? launcher.stopUnit(record.jobId) : launcher.cancel(record.jobId)).pipe(
      Effect.map((outcome) => StoppedLaneJob.make({ jobId: record.jobId, outcome }))
    )
  );
});

/**
 * Render the detached jobs a retirement stopped.
 *
 * **Example** (Render no stopped jobs)
 *
 * ```ts
 * import { renderStoppedLaneJobs } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderStoppedLaneJobs([])) // ""
 * ```
 *
 * @param stopped - The jobs {@link stopLaneJobs} asked to stop.
 * @returns One line per job, or the empty string.
 * @category formatting
 * @since 0.0.0
 */
export const renderStoppedLaneJobs = (stopped: ReadonlyArray<StoppedLaneJob>): string =>
  A.join(
    A.map(stopped, ({ jobId, outcome }) => `  lane job ${jobId}: ${outcome}`),
    "\n"
  );

/**
 * Name the lane jobs a refused retirement had already stopped in its failure message.
 *
 * **Details**
 *
 * {@link stopLaneJobs} runs before the fence, so a retirement the fence then
 * refuses leaves the lane in place with its monitor already stopped; the
 * message says which jobs, so the operator can resubmit one if the lane is
 * kept. Without stopped jobs the error is returned unchanged.
 *
 * **Example** (Leave an error without stopped jobs unchanged)
 *
 * ```ts
 * import { withStoppedLaneJobs } from "@beep/repo-cli/test/Yeet"
 * import { YeetCommandError } from "@beep/repo-cli/commands/Yeet"
 *
 * const error = YeetCommandError.make({ message: "refused" })
 * console.log(withStoppedLaneJobs(error, []).message) // refused
 * ```
 *
 * @param error - The retirement failure; the data-last form takes it alone.
 * @param stopped - The jobs {@link stopLaneJobs} asked to stop.
 * @returns The failure, naming each stopped job and its outcome.
 * @category formatting
 * @since 0.0.0
 */
export const withStoppedLaneJobs: {
  (stopped: ReadonlyArray<StoppedLaneJob>): (error: YeetCommandError) => YeetCommandError;
  (error: YeetCommandError, stopped: ReadonlyArray<StoppedLaneJob>): YeetCommandError;
} = dual(
  2,
  (error: YeetCommandError, stopped: ReadonlyArray<StoppedLaneJob>): YeetCommandError =>
    A.isReadonlyArrayNonEmpty(stopped)
      ? YeetCommandError.make({
          message: `${error.message} Lane jobs stopped before the refusal: ${A.join(
            A.map(stopped, ({ jobId, outcome }) => `${jobId} (${outcome})`),
            ", "
          )}.`,
          cause: error,
        })
      : error
);

// Only the lifecycle and the packet's own account of why it stays open
// matter here; the full manifest is the goals doctor's business, and a
// manifest that fails to decode is simply not active.
const PacketLifecycleProbe = S.Struct({
  lifecycle: S.optionalKey(S.String),
  statusNote: S.optionalKey(S.String),
  blockedBy: S.String.pipe(S.Array, S.optionalKey),
});
const decodePacketLifecycle = S.decodeUnknownEffect(S.fromJsonString(PacketLifecycleProbe));

// The same deferral the goals doctor applies: a statusNote or a non-empty
// blockedBy says the packet is open on purpose, so it is not an advisory.
const isOpenWithoutContext = (manifest: typeof PacketLifecycleProbe.Type): boolean =>
  Eq.equals(manifest.lifecycle, "active") &&
  manifest.statusNote === undefined &&
  (manifest.blockedBy === undefined || A.length(manifest.blockedBy) === 0);

// The paths a pull request changed, as GitHub records them.
const PullRequestFiles = S.Struct({ files: S.Array(S.Struct({ path: S.String })) });
const decodePullRequestFiles = S.decodeUnknownEffect(S.fromJsonString(PullRequestFiles));

const packetSlugFromPath = (relativePath: string): O.Option<string> => {
  const segments = Str.split(relativePath, "/");
  return A.length(segments) >= 3 && Eq.equals(A.get(segments, 0), O.some("goals")) ? A.get(segments, 1) : O.none();
};

// GitHub's own list of the pull request's files is independent of how the
// merge landed; a failed or truncated read contributes nothing.
const pullRequestPaths = Effect.fn("Yeet.pullRequestPaths")(function* (plan: YeetRetirePlan) {
  const output = yield* ghOutput({
    args: ["pr", "view", plan.branch, "--json", "files"],
    cwd: plan.worktreePath,
    label: `gh pr view ${plan.branch} --json files`,
    onFailure: (failure) => failure,
  });
  const document = yield* decodePullRequestFiles(output);
  return A.map(document.files, (file) => file.path);
});

// The paths the branch changed since it forked from the main branch. Once the
// clone's main already contains the branch this is empty, which is why the
// pull request's own list is read as well.
const branchPaths = Effect.fn("Yeet.branchPaths")(function* (plan: YeetRetirePlan, state: SweepGitState) {
  const mergeBase = yield* gitOutput(plan.worktreePath, ["merge-base", state.mainBranch, "HEAD"]);
  const changed = yield* gitOutput(plan.worktreePath, ["diff", "--name-only", mergeBase, "HEAD", "--", "goals/"]);
  return pipe(Str.split(changed, "\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));
});

/**
 * The goal packets the retired branch touched whose lifecycle is still `active`.
 *
 * **Details**
 *
 * A branch that carried a packet and merged should also have flipped that
 * packet's lifecycle (same-PR packet-state flips). The touched paths are the
 * union of the pull request's file list on GitHub and the branch's diff
 * against the main branch, so a clone whose main already contains the merge
 * still names the packets. A packet whose manifest carries a `statusNote` or
 * a non-empty `blockedBy` stays open on purpose and is not named, the same
 * deferral the goals doctor applies. Each packet's lifecycle is read from the manifest
 * committed at the lane's `HEAD`, never from its working tree, so an
 * uncommitted edit cannot hide what the merged PR left open. It is an
 * advisory: any probe failure yields no slugs rather than failing the
 * retirement.
 *
 * **Example** (Build the probe effect)
 *
 * ```ts
 * import { activePacketsOnBranch } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(Effect.succeed(activePacketsOnBranch))) // true
 * ```
 *
 * @param plan - The retirement plan naming the lane and its branch.
 * @param state - The observed git facts, for the main branch name.
 * @returns The sorted slugs of touched packets still marked active.
 * @category planning
 * @since 0.0.0
 */
export const activePacketsOnBranch = Effect.fn("Yeet.activePacketsOnBranch")(function* (
  plan: YeetRetirePlan,
  state: SweepGitState
) {
  const none = constant(A.empty<string>());
  const fromPullRequest = yield* pullRequestPaths(plan).pipe(Effect.orElseSucceed(none));
  const fromBranch = yield* branchPaths(plan, state).pipe(Effect.orElseSucceed(none));
  const slugs: ReadonlyArray<string> = pipe(
    A.appendAll(fromPullRequest, fromBranch),
    A.map(packetSlugFromPath),
    A.getSomes,
    A.dedupe,
    A.sort(Str.Order)
  );
  return yield* Effect.filter(slugs, (slug) =>
    gitOutput(plan.worktreePath, ["show", `HEAD:goals/${slug}/ops/manifest.json`]).pipe(
      Effect.flatMap(decodePacketLifecycle),
      Effect.map(isOpenWithoutContext),
      Effect.orElseSucceed(constant(false))
    )
  );
});

/**
 * Render the active-packet advisory lines for a retirement.
 *
 * **Example** (Render no advisories)
 *
 * ```ts
 * import { renderActivePackets } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderActivePackets([])) // ""
 * ```
 *
 * @param slugs - Packets the branch touched that are still active.
 * @returns One line per packet, or the empty string.
 * @category formatting
 * @since 0.0.0
 */
export const renderActivePackets = (slugs: ReadonlyArray<string>): string =>
  A.join(
    A.map(
      slugs,
      (slug) =>
        `[yeet] packet still active after merge: goals/${slug} (this branch touched it); flip its lifecycle in a closeout PR`
    ),
    "\n"
  );

/**
 * The message a failed retirement reports, with the working form appended when a holder blocked it.
 *
 * **Details**
 *
 * A holder the fence could not exempt is a process outside the invoking
 * session: a Claude Desktop Terminal panel shell running a command, an
 * editor, a dev server, another agent session standing in the lane, or,
 * outside Claude Code, the other stages of a shell pipeline this command's
 * output was piped into. The service names each one (and says to `cd ~` in a
 * panel shell, since closing its tab starts a new shell in the lane); this
 * message says to move them out of the lane or close them, redirect output to a
 * file instead of piping it, and rerun from the lane, because `bun run beep`
 * resolves the CLI from the checkout it runs in. It appends the form that
 * retires the lane from the owning clone through the lane's own CLI, which
 * carries `--retire` even when that clone's checkout predates it. Any other
 * removal failure is reported as the service phrased it.
 *
 * **Example** (Append the hint only for a holder)
 *
 * ```ts
 * import { retirementFailureMessage, YeetRetirePlan } from "@beep/repo-cli/test/Yeet"
 *
 * const plan = YeetRetirePlan.make({ worktreePath: "/c/.claude/worktrees/l", owningClone: "/c", name: "l", branch: "b" })
 * console.log(retirementFailureMessage(plan, "pid 7 (zsh) via cwd still hold it").includes("--lane")) // true
 * console.log(retirementFailureMessage(plan, "disk full").includes("--lane")) // false
 * ```
 *
 * @param plan - The retirement that failed; the data-last form takes it alone.
 * @param message - The removal service's own message.
 * @returns The message to report.
 * @category formatting
 * @since 0.0.0
 */
export const retirementFailureMessage: {
  (plan: YeetRetirePlan, message: string): string;
  (message: string): (plan: YeetRetirePlan) => string;
} = dual(2, (plan: YeetRetirePlan, message: string): string =>
  Str.includes("still hold it")(message)
    ? `yeet sweep --retire could not retire ${plan.worktreePath}: ${message} Those holders are outside this command's own session (a Claude Desktop Terminal panel shell running a command, an editor, another shell or agent session, or the other stages of a pipeline its output was piped into): move them out of the lane or close them, redirect output to a file instead of piping it, and rerun from the lane: bun run beep yeet sweep --retire. From the owning clone, run the lane's own CLI: cd "${plan.owningClone}" && bun run "${plan.worktreePath}/${REPO_CLI_ENTRY_PATH}" -- yeet sweep --retire --lane "${plan.worktreePath}"`
    : `yeet sweep --retire could not retire ${plan.worktreePath}: ${message}`
);

/**
 * The sweep context for the owning clone, so the sweep resets the right checkout.
 *
 * **Example** (Repoint a context)
 *
 * ```ts
 * import { owningCloneContext, YeetRetirePlan } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof owningCloneContext) // function
 * ```
 *
 * @param context - The context hydrated from the linked worktree; the data-last form takes it alone.
 * @param plan - The retirement plan naming the owning clone.
 * @returns The same context rooted at the owning clone.
 * @category planning
 * @since 0.0.0
 */
export const owningCloneContext: {
  (context: RepoRunContext, plan: YeetRetirePlan): RepoRunContext;
  (plan: YeetRetirePlan): (context: RepoRunContext) => RepoRunContext;
} = dual(
  2,
  (context: RepoRunContext, plan: YeetRetirePlan): RepoRunContext =>
    RepoRunContext.make({ ...context, repoRoot: plan.owningClone, cwd: plan.owningClone })
);

/**
 * Render a retirement plan and its gate for `--plan` mode.
 *
 * **Example** (Render a plan)
 *
 * ```ts
 * import { renderRetirePlan } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof renderRetirePlan) // function
 * ```
 *
 * @param plan - The retirement plan; the data-last form takes it alone.
 * @param state - The observed facts the gate reads.
 * @returns The plan lines.
 * @category formatting
 * @since 0.0.0
 */
export const renderRetirePlan: {
  (plan: YeetRetirePlan, state: SweepGitState): string;
  (state: SweepGitState): (plan: YeetRetirePlan) => string;
} = dual(2, (plan: YeetRetirePlan, state: SweepGitState): string =>
  A.join(
    [
      `[yeet] retire ${plan.worktreePath}`,
      `  owning clone: ${plan.owningClone}`,
      `  branch: ${plan.branch}`,
      renderRetireGate(retireVerdict(plan, state)),
    ],
    "\n"
  )
);

/**
 * Render what a retirement did.
 *
 * **Details**
 *
 * An idle Claude Desktop Terminal panel shell the fence left in the lane gets
 * a note: the lane was removed under it, so its working directory no longer
 * exists until the operator runs `cd ~` in that Terminal tab.
 *
 * **Example** (Render a receipt)
 *
 * ```ts
 * import { renderRetirement } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof renderRetirement) // function
 * ```
 *
 * @param plan - The retirement plan that ran; the data-last form takes it alone.
 * @param receipt - The removal receipt the worktree service returned.
 * @returns The report lines.
 * @category formatting
 * @since 0.0.0
 */
export const renderRetirement: {
  (plan: YeetRetirePlan, receipt: WorktreeRemovalReceipt): string;
  (receipt: WorktreeRemovalReceipt): (plan: YeetRetirePlan) => string;
} = dual(2, (plan: YeetRetirePlan, receipt: WorktreeRemovalReceipt): string =>
  A.join(
    [
      `[yeet] retired ${plan.worktreePath} into ${plan.owningClone}`,
      `  residue: ${receipt.reason}${O.match(receipt.manifest, {
        onNone: () => "",
        onSome: (manifest) => ` (archived under ${manifest.residueRoot})`,
      })}`,
      `  branch ${plan.branch}: ${receipt.branchDeleted ? "deleted" : "kept"}`,
      ...A.map(
        receipt.idleTerminalShells,
        (pid) =>
          `  note: the idle Claude Desktop Terminal panel shell (pid ${pid}) stood in the lane and was left running; the lane was removed under it, so run \`cd ~\` in that Terminal tab before using it`
      ),
      ...A.map(
        receipt.inotifyWatchers,
        (watcher) =>
          `  warning: ${describeInotifyWatcher(watcher)} held only an inotify watch on the lane, which cannot write into it, so the lane was removed under it; an editor watching the clone (WebStorm's fsnotifier, for one) stops doing this once \`.claude/worktrees\` is excluded from its project`
      ),
    ],
    "\n"
  )
);
