/**
 * GitHub PR closeout inspection for Yeet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// cspell:ignore greptileai

import { O } from "@beep/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Str from "effect/String";
import { normalizedTokens } from "../../../internal/cli/Flags.ts";
import { GhComment } from "../../../internal/github/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { PrCloseoutOptions, PrCloseoutReport, PrCloseoutReportJson } from "./closeout/Closeout.schemas.ts";
import {
  closeoutGateStates,
  closeoutReviewAdvisories,
  closeoutReviewThreadTriage,
  gateIssues,
  reviewFollowUpThreadIssue,
  reviewThreadIssue,
} from "./closeout/Gates.ts";
import { closeoutGhOutput, collectPrCloseoutPayload, performCloseoutWriteActions } from "./closeout/GhCollect.ts";
import {
  greptileAuthoredReviewThreadCount,
  inferGreptileIssueCount,
  isBotComment,
  latestGreptileSummary,
} from "./closeout/GreptileSignal.ts";
import { closeoutWritePlan } from "./closeout/WritePlan.ts";
import { writeTextFile } from "./IssueArtifacts.ts";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { PrCloseoutWriteAction } from "./closeout/Closeout.schemas.ts";

const GREPTILE_RETRIGGER_COMMENT = "@greptileai review" as const;

/**
 * Greptile retrigger comment body used by closeout mode.
 *
 * @category testing
 * @since 0.0.0
 */
export const greptileRetriggerCommentForTesting = GREPTILE_RETRIGGER_COMMENT;

export {
  GreptileSummary,
  PrCloseoutGateState,
  PrCloseoutOptions,
  PrCloseoutReport,
  PrCloseoutReportJson,
  PrCloseoutWriteAction,
} from "./closeout/Closeout.schemas.ts";
export {
  closeoutGateStatesForTesting,
  closeoutReviewAdvisories,
  closeoutReviewThreadTriage,
  greptileIssueLimitExceededForTesting,
  reviewFollowUpThreadIssue,
} from "./closeout/Gates.ts";
export { inferGreptileIssueCountForTesting, latestGreptileSummaryForTesting } from "./closeout/GreptileSignal.ts";
export { closeoutWritePlanForTesting } from "./closeout/WritePlan.ts";

/**
 * Inspect current PR review and bot closeout state.
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runPrCloseout = Effect.fn("YeetCloseout.runPrCloseout")(function* (
  context: RepoRunContext,
  options: PrCloseoutOptions
): Effect.fn.Return<PrCloseoutReport, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  let { pullRequest, pr } = yield* collectPrCloseoutPayload(context);
  const writeRequested =
    Str.isNonEmpty(Str.trim(options.replyThread)) ||
    Str.isNonEmpty(Str.trim(options.replyBody)) ||
    Str.isNonEmpty(Str.trim(options.resolveThreads));
  let writeActions: ReadonlyArray<PrCloseoutWriteAction> = A.empty();
  if (writeRequested) {
    const plan = closeoutWritePlan({
      knownThreadIds: pipe(
        pullRequest.reviewThreads.nodes,
        A.map((thread) => thread.id)
      ),
      replyBody: options.replyBody,
      replyThread: options.replyThread,
      resolveThreads: options.resolveThreads,
    });
    if (O.isSome(plan.error)) {
      return yield* YeetCommandError.make({ message: plan.error.value, exitCode: 1 });
    }
    writeActions = yield* performCloseoutWriteActions(context, plan.intents);
    const refreshed = yield* collectPrCloseoutPayload(context);
    pullRequest = refreshed.pullRequest;
    pr = refreshed.pr;
  }
  const botTokens = normalizedTokens(options.bots);
  // Every thread goes through the shared state rule, so a thread the author
  // resolved with a reviewer speaking after them blocks closeout even though
  // GitHub reports it resolved.
  const triage = closeoutReviewThreadTriage(
    pullRequest.reviewThreads.nodes,
    pipe(
      O.fromUndefinedOr(pr.author),
      O.flatMap(O.fromNullishOr),
      O.map((author) => author.login)
    )
  );
  const actionableThreads = triage.unresolvedThreads;
  const threadIssues = [
    ...pipe(actionableThreads, A.map(reviewThreadIssue)),
    ...pipe(triage.followUpThreads, A.map(reviewFollowUpThreadIssue)),
  ];
  const topLevelBotComments = pipe(
    pullRequest.comments.nodes,
    A.filter((comment) => isBotComment(botTokens, comment.author))
  );
  const reviewBotComments = pipe(
    pullRequest.reviews.nodes,
    A.flatMap((review) => [
      ...(isBotComment(botTokens, review.author)
        ? [
            GhComment.make({
              author: review.author,
              body: review.body,
              id: review.id,
              url: pr.url ?? "",
            }),
          ]
        : []),
      ...pipe(
        review.comments.nodes,
        A.filter((comment) => isBotComment(botTokens, comment.author)),
        A.map((comment) =>
          GhComment.make({
            author: comment.author,
            body: comment.body,
            id: comment.id,
            url: comment.url,
          })
        )
      ),
    ])
  );
  const botComments = [...topLevelBotComments, ...reviewBotComments];
  const greptile = inferGreptileIssueCount(
    latestGreptileSummary(botComments),
    greptileAuthoredReviewThreadCount(pullRequest.reviewThreads.nodes)
  );
  const advisories = closeoutReviewAdvisories(pullRequest.reviews.nodes, pullRequest.reviewThreads.nodes);
  const issues = [...threadIssues, ...gateIssues(options, actionableThreads.length, greptile)];
  const states = closeoutGateStates({
    actionableReviewThreadCount: actionableThreads.length,
    advisories,
    botComments,
    followUpThreadCount: triage.counts.followUp,
    greptile,
    options,
    reviewThreads: pullRequest.reviewThreads.nodes,
  });

  if (options.retriggerGreptile) {
    yield* closeoutGhOutput(
      context,
      ["pr", "comment", `${pr.number}`, "--body", GREPTILE_RETRIGGER_COMMENT],
      "gh pr comment"
    );
  }

  return PrCloseoutReport.make({
    acknowledgedThreadCount: triage.counts.acknowledged,
    actionableReviewThreadCount: actionableThreads.length,
    advisoryCount: advisories.count,
    botCommentCount: botComments.length,
    followUpThreadCount: triage.counts.followUp,
    greptile,
    issueCount: issues.length,
    issues,
    prNumber: pr.number,
    prUrl: pr.url ?? "",
    reviewedHeadSha: O.fromUndefinedOr(pr.headRefOid),
    retriggeredGreptile: options.retriggerGreptile,
    schemaVersion: "yeet-pr-closeout/v1",
    states,
    writeActions,
  });
});

/**
 * Write a closeout report to the branch's `pr-closeout.json` artifact.
 *
 * **Details**
 *
 * Encoded through the artifact schema so Option fields (`reviewedHeadSha`)
 * land in the optional-key form `yeet status` decodes, not as raw Option
 * objects. Shared by `yeet closeout` and the merge loop's automatic closeout.
 *
 * **Example** (Reference the closeout artifact writer)
 *
 * ```ts
 * import { writePrCloseoutReport } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof writePrCloseoutReport) // "function"
 * ```
 *
 * @param context - Yeet run context naming the branch.
 * @param report - The closeout report to persist.
 * @returns The artifact path written.
 * @category use-cases
 * @since 0.0.0
 */
export const writePrCloseoutReport = Effect.fn("Yeet.writePrCloseoutReport")(function* (
  context: RepoRunContext,
  report: PrCloseoutReport
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const reportPath = yield* runArtifactPathForContext(context, "pr-closeout.json");
  const json = yield* PrCloseoutReportJson.encode(report).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode yeet PR closeout report."))
  );
  yield* writeTextFile(reportPath, `${json}\n`);
  return reportPath;
});

/**
 * The read-first closeout options the merge loop runs with: the default bot
 * lineup, no gates, and never a reply, resolve, or retrigger.
 *
 * **Example** (The automatic closeout never writes to the pull request)
 *
 * ```ts
 * import { yeetAutomaticCloseoutOptions } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetAutomaticCloseoutOptions.retriggerGreptile) // false
 * console.log(yeetAutomaticCloseoutOptions.replyThread) // ""
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const yeetAutomaticCloseoutOptions: PrCloseoutOptions = PrCloseoutOptions.make({
  bots: "greptile",
  requireGreptileIssues: -1,
  requireGreptileScore: "",
  requireReviewComments: -1,
  retriggerGreptile: false,
});

/**
 * Run the read-first closeout for the current head and bind its artifact.
 *
 * **Details**
 *
 * This is the merge loop's half of ttc ruling B7-3: when the required census
 * settles for a head with no closeout artifact bound to it, the loop runs the
 * same code path as `yeet closeout` with {@link yeetAutomaticCloseoutOptions}
 * — no reply, resolve, or retrigger flag, ever — and writes the artifact so
 * the `closeout-run` criterion binds `reviewedHeadSha`. Issues found are
 * returned in the report for the gate line, never raised: an unresolved
 * thread is a merge-readiness blocker, not a loop failure.
 *
 * **Example** (Build the automatic closeout effect)
 *
 * ```ts
 * import { RepoRunContext, runYeetAutomaticCloseout } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/settle",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * console.log(Effect.isEffect(runYeetAutomaticCloseout(context))) // true
 * ```
 *
 * @param context - Yeet run context naming the branch.
 * @returns The report and the artifact path it was written to.
 * @category use-cases
 * @since 0.0.0
 */
export const runYeetAutomaticCloseout = Effect.fn("Yeet.runYeetAutomaticCloseout")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  { readonly report: PrCloseoutReport; readonly reportPath: string },
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const report = yield* runPrCloseout(context, yeetAutomaticCloseoutOptions);
  const reportPath = yield* writePrCloseoutReport(context, report);
  return { report, reportPath };
});
