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

import { Effect } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { constant, dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { RepoRunContext, runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { WorktreeRemovalRequest } from "../../Worktree/Worktree.schemas.ts";
import { WorktreeRemovalService } from "../../Worktree/Worktree.service.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { YeetRetirePlan } from "./Retire.schemas.ts";
import type { WorktreeRemovalReceipt } from "../../Worktree/Worktree.schemas.ts";
import type { SweepGitState } from "./Sweep.ts";

const decodeWorktreeName = S.decodeUnknownEffect(WorktreeRemovalRequest.fields.name);
const decodeRetirePlan = S.decodeUnknownEffect(YeetRetirePlan);

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

/**
 * The first reason a retirement must not proceed, in the order an operator would check them.
 *
 * **Details**
 *
 * No pull request observed, pull request not MERGED, pull request heading a
 * different branch. `None` means the gate is open.
 *
 * **Example** (Read the gate)
 *
 * ```ts
 * import { retireBlocker } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof retireBlocker) // function
 * ```
 *
 * @param plan - The retirement plan under review.
 * @param state - The observed git and pull request facts for its branch.
 * @returns The blocking reason when the gate is closed.
 * @category planning
 * @since 0.0.0
 */
export const retireBlocker: {
  (plan: YeetRetirePlan, state: SweepGitState): O.Option<string>;
  (state: SweepGitState): (plan: YeetRetirePlan) => O.Option<string>;
} = dual(
  2,
  (plan: YeetRetirePlan, state: SweepGitState): O.Option<string> =>
    O.map(
      A.findFirst(
        [
          [O.isNone(state.pullRequestState), `no pull request was observed for ${plan.branch}`] as const,
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
      ([, reason]) => reason
    )
);

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
 * import { Effect } from "effect"
 *
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

/**
 * Archive-retire the planned worktree and delete its branch once its pull request is MERGED.
 *
 * **Details**
 *
 * The gate is the same one the sweep's own branch deletion uses: the pull
 * request resolved for the branch must be MERGED and must head that branch.
 * Retirement always archives, so dirty files and unpushed commits are
 * preserved under the residue root rather than blocking the closeout. The
 * archive fence refuses a lane any process still stands in; this command
 * first moves its own working directory to the owning clone and asks the
 * fence to exempt the invoker's ancestry (the shell and agent session that
 * started it), so retiring the lane one is standing in works, while any
 * other holder still refuses it with the command that would work instead.
 *
 * **Example** (Build the retirement effect)
 *
 * ```ts
 * import { retireInvokingWorktree } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
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
  const blocker = retireBlocker(plan, state);
  if (O.isSome(blocker)) {
    return yield* YeetCommandError.make({
      message: `yeet sweep --retire refuses to retire ${plan.worktreePath}: ${blocker.value}.`,
    });
  }
  const service = yield* WorktreeRemovalService;
  const path = yield* Path.Path;
  const name = yield* decodeWorktreeName(plan.name).pipe(
    Effect.mapError(YeetCommandError.new(`Worktree name ${plan.name} is not one safe path component.`))
  );
  // Leave the lane before it is renamed away: a process whose cwd is inside
  // it would be a holder, and later steps run against the owning clone anyway.
  if (isWithin(path, plan.worktreePath, process.cwd())) {
    yield* Effect.sync(() => process.chdir(plan.owningClone));
  }
  return yield* service
    .remove(
      WorktreeRemovalRequest.make({
        name,
        targetPath: plan.worktreePath,
        mainCheckout: plan.owningClone,
        branch: O.some(plan.branch),
        archive: true,
        deleteBranch: true,
        expectedHead: O.none(),
        exemptInvokerAncestry: true,
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

// Two absolute paths on one filesystem relate by a relative path; only a
// leading `..` means the candidate lies outside the root.
const isWithin = (path: Path.Path, root: string, candidate: string): boolean =>
  !Str.startsWith("..")(path.relative(root, candidate));

/**
 * The message a failed retirement reports, with the working form appended when a holder blocked it.
 *
 * **Details**
 *
 * A holder the fence could not exempt is a process outside the invoker's own
 * ancestry: an editor or another shell left in the lane, or the other stages
 * of a shell pipeline this command's output was piped into. The hint says to
 * leave or close them, redirect the output to a file, and rerun from the lane,
 * because `bun run beep` resolves the CLI from the checkout it runs in and the
 * owning clone's `main` may still be behind the merge; the `--lane` form is
 * kept for a clone that already carries the merged CLI. Any other removal
 * failure is reported as the service phrased it.
 *
 * **Example** (Append the hint only for a holder)
 *
 * ```ts
 * import { retirementFailureMessage, YeetRetirePlan } from "@beep/repo-cli/test/Yeet"
 *
 * const plan = YeetRetirePlan.make({ worktreePath: "/c/.claude/worktrees/l", owningClone: "/c", name: "l", branch: "b" })
 * console.log(retirementFailureMessage(plan, "pid 7 via cwd still hold it").includes("--lane")) // true
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
    ? `yeet sweep --retire could not retire ${plan.worktreePath}: ${message} Those holders are outside this command's own ancestry (an editor, another shell, or the other stages of a pipeline its output was piped into): leave or close them, redirect output to a file instead of piping it, and rerun from the lane: bun run beep yeet sweep --retire. From a clone that already carries the merged CLI: cd "${plan.owningClone}" && bun run beep yeet sweep --retire --lane "${plan.worktreePath}"`
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
      O.match(retireBlocker(plan, state), {
        onNone: () => "  gate: pull request MERGED",
        onSome: (reason) => `  blocked: ${reason}`,
      }),
    ],
    "\n"
  )
);

/**
 * Render what a retirement did.
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
    ],
    "\n"
  )
);
