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
import { PrCloseoutReport } from "./closeout/Closeout.schemas.ts";
import { closeoutGateStates, gateIssues, reviewThreadIssue } from "./closeout/Gates.ts";
import { closeoutGhOutput, collectPrCloseoutPayload, performCloseoutWriteActions } from "./closeout/GhCollect.ts";
import {
  greptileAuthoredReviewThreadCount,
  inferGreptileIssueCount,
  isBotComment,
  latestGreptileSummary,
} from "./closeout/GreptileSignal.ts";
import { closeoutWritePlan } from "./closeout/WritePlan.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { PrCloseoutOptions, PrCloseoutWriteAction } from "./closeout/Closeout.schemas.ts";

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
  PrCloseoutWriteAction,
} from "./closeout/Closeout.schemas.ts";
export { closeoutGateStatesForTesting, greptileIssueLimitExceededForTesting } from "./closeout/Gates.ts";
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
  const actionableThreads = pipe(
    pullRequest.reviewThreads.nodes,
    A.filter((thread) => !thread.isResolved && !thread.isOutdated)
  );
  const threadIssues = pipe(actionableThreads, A.map(reviewThreadIssue));
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
  const issues = [...threadIssues, ...gateIssues(options, actionableThreads.length, greptile)];
  const states = closeoutGateStates({
    actionableReviewThreadCount: actionableThreads.length,
    botComments,
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
    actionableReviewThreadCount: actionableThreads.length,
    botCommentCount: botComments.length,
    greptile,
    issueCount: issues.length,
    issues,
    prNumber: pr.number,
    prUrl: pr.url ?? "",
    retriggeredGreptile: options.retriggerGreptile,
    schemaVersion: "yeet-pr-closeout/v1",
    states,
    writeActions,
  });
});
