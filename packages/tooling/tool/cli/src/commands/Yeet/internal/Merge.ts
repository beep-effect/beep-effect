/**
 * Operator-authorized squash-merge porcelain with the workspace sweep as its tail.
 *
 * {@link mergePr} exists because `gh pr merge --squash --delete-branch` conflates
 * two operations with different failure modes. On 2026-08-04 the API merge of
 * #551 succeeded and the CLI's own local cleanup then failed —
 * `'main' is already used by worktree at …` — so the command exited nonzero,
 * looked like a failed merge, and silently abandoned the remote branch deletion.
 * This porcelain splits them: merge WITHOUT `--delete-branch`, confirm `MERGED`
 * from the API, and only then hand the whole cleanup sequence to the
 * worktree-aware sweep.
 *
 * **Details**
 *
 * Nothing in this repository calls {@link mergePr}. It is an explicitly-run,
 * operator-authorized action: the sweep is safe to auto-run on a merged-PR
 * detection, but merging is a decision, not a step, and no monitor loop, closeout
 * path, or publish flow may reach it.
 *
 * **Gotchas**
 *
 * The `MERGED` confirmation is a bounded poll rather than a single read, because
 * `gh pr merge` returns as soon as GitHub accepts the request while the pull
 * request's own state settles a moment later. Exhausting the budget is an error,
 * not a silent pass — an unconfirmed merge must never be followed by branch
 * deletion.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { guardLiteralArg } from "@beep/repo-utils";
import { Duration, Effect, Schedule } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhPrView, ghOutput } from "../../../internal/github/index.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { SweepReport } from "./Sweep.schemas.ts";
import { executeSweep } from "./Sweep.ts";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Merge");

const mergedState = "MERGED";
const pullRequestViewFields = "number,headRefName,state,headRefOid";

/**
 * Bounded-poll settings for the post-merge `MERGED` confirmation.
 */
interface MergePrOptions {
  /** Extra confirmation reads after the first one. */
  readonly pollAttempts: number;
  /** Delay between confirmation reads. */
  readonly pollInterval: Duration.Input;
}

/**
 * The default confirmation budget: ten extra reads, three seconds apart.
 *
 * **Example** (Read the default budget)
 *
 * ```ts
 * import { defaultMergePrOptions } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(defaultMergePrOptions.pollAttempts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const defaultMergePrOptions: MergePrOptions = {
  pollAttempts: 10,
  pollInterval: Duration.seconds(3),
};

/**
 * What one operator-authorized merge did, and what the sweep tail found afterwards.
 *
 * **Example** (Report a merged pull request)
 *
 * ```ts
 * import { MergeOutcome, SweepPlan, SweepReport } from "@beep/repo-cli/test/Yeet"
 *
 * const outcome = MergeOutcome.make({
 *   pullRequestNumber: 559,
 *   state: "MERGED",
 *   sweep: SweepReport.make({
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
 *   }),
 * })
 * console.log(outcome.pullRequestNumber)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeOutcome extends S.Class<MergeOutcome>($I`MergeOutcome`)(
  {
    pullRequestNumber: S.Finite,
    state: S.NonEmptyString,
    sweep: SweepReport,
  },
  $I.annote("MergeOutcome", {
    description: "Result of one operator-authorized squash merge and the workspace sweep that followed it.",
  })
) {}

const decodePullRequestView = S.decodeUnknownEffect(S.fromJsonString(GhPrView));

const readPullRequest = Effect.fn("Yeet.readMergePullRequest")(function* (
  context: RepoRunContext,
  selector: string
): Effect.fn.Return<GhPrView, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* ghOutput({
    args: ["pr", "view", selector, "--json", pullRequestViewFields],
    cwd: context.repoRoot,
    label: `gh pr view ${selector}`,
    onFailure: (failure) =>
      YeetCommandError.make({
        message: `Failed to read pull request "${selector}" (${failure._tag}).`,
        command: failure.command,
        exitCode: 1,
      }),
  });
  return yield* decodePullRequestView(output).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode gh pr view JSON for "${selector}".`))
  );
});

const confirmMerged = Effect.fn("Yeet.confirmPullRequestMerged")(function* (
  context: RepoRunContext,
  pullRequestNumber: number
): Effect.fn.Return<GhPrView, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const view = yield* readPullRequest(context, `${pullRequestNumber}`);
  if (view.state !== mergedState) {
    return yield* YeetCommandError.make({
      message: `pull request #${pullRequestNumber} reports state ${view.state}, not ${mergedState}.`,
      command: `gh pr view ${pullRequestNumber} --json ${pullRequestViewFields}`,
      exitCode: 1,
    });
  }
  return view;
});

/**
 * Squash-merge the current branch's pull request, confirm it, then sweep the clone.
 *
 * **Details**
 *
 * Three phases, in order and never reordered: `gh pr merge <number> --squash`
 * without `--delete-branch`; a bounded poll until the API reports `MERGED`; then
 * {@link executeSweep}, which owns every ref update and deletion under its own
 * worktree-aware safety rails. A merge that cannot be confirmed fails here, so no
 * deletion is ever attempted against an unconfirmed merge.
 *
 * **Gotchas**
 *
 * Never wire this into an automatic path. Monitor's merged-PR detection may run
 * the sweep; only a human may run the merge.
 *
 * **Example** (Build the merge effect)
 *
 * ```ts
 * import { mergePr } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(mergePr)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root and the branch to merge.
 * @param options - Confirmation poll budget; defaults to {@link defaultMergePrOptions}.
 * @returns The merged pull request number, its confirmed state, and the sweep report.
 * @category workflows
 * @since 0.0.0
 */
export const mergePr = Effect.fn("Yeet.mergePr")(function* (
  context: RepoRunContext,
  options: MergePrOptions = defaultMergePrOptions
): Effect.fn.Return<
  MergeOutcome,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const branch = yield* guardLiteralArg(context.branch).pipe(
    Effect.mapError(
      YeetCommandError.new(`yeet merge refuses an option-like branch name "${context.branch}".`, {
        command: "gh pr view",
        exitCode: 1,
      })
    )
  );
  const view = yield* readPullRequest(context, branch);
  if (view.headRefName !== context.branch) {
    return yield* YeetCommandError.make({
      message: `yeet merge expected PR head "${context.branch}" but gh reported "${view.headRefName}".`,
      command: `gh pr view ${context.branch} --json ${pullRequestViewFields}`,
      exitCode: 1,
    });
  }
  if (view.state !== "OPEN") {
    return yield* YeetCommandError.make({
      message: `yeet merge requires an open pull request; #${view.number} is ${view.state}.`,
      command: `gh pr view ${context.branch} --json ${pullRequestViewFields}`,
      exitCode: 1,
    });
  }

  // Head-pinned on purpose: GitHub rejects the merge server-side if the head
  // moved after the view above, so a push landing in that window cannot be
  // merged sight-unseen — the same compare-and-swap posture as the sweep's
  // leased remote deletion. A view without a head oid cannot be pinned, so it
  // cannot be merged.
  const pinnedHead = O.fromUndefinedOr(view.headRefOid);
  if (O.isNone(pinnedHead)) {
    return yield* YeetCommandError.make({
      message: `yeet merge refuses to merge #${view.number} without a head oid to pin the merge to.`,
      command: `gh pr view ${context.branch} --json ${pullRequestViewFields}`,
      exitCode: 1,
    });
  }
  const mergeCommand = `gh pr merge ${view.number} --squash --match-head-commit ${pinnedHead.value}`;
  const merge = yield* runRepoCommandCapture(
    "gh",
    ["pr", "merge", `${view.number}`, "--squash", "--match-head-commit", pinnedHead.value],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new(`Failed to run ${mergeCommand}.`)));
  if (merge.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `${mergeCommand} failed:\n${Str.trim(merge.output)}`,
      command: mergeCommand,
      exitCode: merge.exitCode,
    });
  }

  const confirmed = yield* confirmMerged(context, view.number).pipe(
    Effect.retry({ times: options.pollAttempts, schedule: Schedule.spaced(options.pollInterval) })
  );

  return MergeOutcome.make({
    pullRequestNumber: confirmed.number,
    state: confirmed.state,
    sweep: yield* executeSweep(context),
  });
});
