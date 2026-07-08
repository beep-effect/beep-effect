/**
 * Closeout gate and issue derivation for Yeet PR closeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O } from "@beep/utils";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as Str from "effect/String";
import { normalizedTokens } from "../../../../internal/cli/Flags.js";
import { GhActor, GhComment } from "../../../../internal/github/index.js";
import { QualityIssue, QualityIssueRouting } from "../../Yeet.schemas.js";
import { PrCloseoutGateState } from "./Closeout.schemas.js";
import { authorLogin, botAuthoredReviewThreadCount, botCommentCount } from "./GreptileSignal.js";
import type { GreptileSummary, PrCloseoutOptions } from "./Closeout.schemas.js";
import type { GhReviewThread } from "./Gh.schemas.js";

type GreptileSummaryCommentInput = {
  readonly authorLogin: string;
  readonly body: string;
  readonly url: string;
};

type CloseoutGateStatesInput = {
  readonly actionableReviewThreadCount: number;
  readonly botComments: ReadonlyArray<GhComment>;
  readonly greptile: GreptileSummary;
  readonly options: PrCloseoutOptions;
  readonly reviewThreads: ReadonlyArray<GhReviewThread>;
};

const issueRouting = (reason: string): ReadonlyArray<QualityIssueRouting> => [
  QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason }),
];

const closeoutIssue = (
  id: string,
  category: QualityIssue["category"],
  message: string,
  evidence: ReadonlyArray<string>
): QualityIssue =>
  QualityIssue.make({
    blocking: true,
    category,
    confidence: "structured",
    evidence: [...evidence],
    id,
    message,
    packageName: "@beep/root",
    parser: "yeet/pr-closeout/v1",
    routing: [...issueRouting(message)],
    severity: "error",
    tool: "github",
  });

/**
 * Convert an unresolved GitHub review thread into a normalized Yeet issue.
 *
 * @param thread - Review thread whose latest comment and location become issue
 * evidence.
 * @returns A blocking `pr-review` quality issue for closeout packets.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThread, GhReviewThreadCommentConnection, reviewThreadIssue } from "@beep/repo-cli/test/Yeet"
 *
 * const thread = GhReviewThread.make({
 *   comments: GhReviewThreadCommentConnection.make({
 *     nodes: [{
 *       author: { login: "reviewer" },
 *       body: "Please cover this branch.",
 *       id: "comment-1",
 *       url: "https://github.com/o/r/pull/1#discussion_r1"
 *     }],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   }),
 *   id: "PRRT_1",
 *   isOutdated: false,
 *   isResolved: false,
 *   line: 42,
 *   path: "src/file.ts"
 * })
 *
 * strictEqual(reviewThreadIssue(thread).category, "pr-review")
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const reviewThreadIssue = (thread: GhReviewThread): QualityIssue => {
  const latestComment = pipe(thread.comments.nodes, A.reverse, A.head);
  const location = `${thread.path ?? "unknown-path"}:${thread.line ?? 0}`;
  const evidence = pipe(
    latestComment,
    O.map((comment) => [comment.url, `${authorLogin(comment.author)}: ${Str.slice(0, 240)(Str.trim(comment.body))}`]),
    O.getOrElse(() => [location])
  );
  return closeoutIssue(
    `pr-review:${thread.id}`,
    "pr-review",
    `Unresolved actionable PR review thread at ${location}.`,
    evidence
  );
};

const greptileIssueLimitExceeded = (issueCount: number | undefined, limit: number): boolean =>
  limit >= 0 && (issueCount === undefined || issueCount > limit);

/**
 * Determine whether the Greptile issue-count gate should block closeout.
 *
 * @param issueCount - Parsed Greptile issue count, if present.
 * @param limit - Maximum accepted issue count. Negative values disable the gate.
 * @returns Whether the issue-count gate should fail.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { greptileIssueLimitExceededForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(greptileIssueLimitExceededForTesting(1, 0), true)
 * strictEqual(greptileIssueLimitExceededForTesting(1, -1), false)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const greptileIssueLimitExceededForTesting = greptileIssueLimitExceeded;

/**
 * Derive blocking closeout issues from review-thread and Greptile gate inputs.
 *
 * @param options - Required gate thresholds configured for closeout.
 * @param actionableReviewThreadCount - Count of unresolved human review
 * threads.
 * @param greptile - Parsed Greptile score and issue count.
 * @returns Structured issues for every closeout requirement that failed.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { gateIssues, GreptileSummary, PrCloseoutOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const options = PrCloseoutOptions.make({
 *   bots: "greptile",
 *   requireGreptileIssues: 0,
 *   requireGreptileScore: "5/5",
 *   requireReviewComments: 0,
 *   retriggerGreptile: false
 * })
 * const issues = gateIssues(options, 1, GreptileSummary.make({ issueCount: 0, score: "5/5" }))
 *
 * strictEqual(issues[0]?.category, "pr-review")
 * ```
 * @category validation
 * @since 0.0.0
 */
export const gateIssues: {
  (
    options: PrCloseoutOptions,
    actionableReviewThreadCount: number,
    greptile: GreptileSummary
  ): ReadonlyArray<QualityIssue>;
  (
    actionableReviewThreadCount: number,
    greptile: GreptileSummary
  ): (options: PrCloseoutOptions) => ReadonlyArray<QualityIssue>;
} = dual(
  3,
  (
    options: PrCloseoutOptions,
    actionableReviewThreadCount: number,
    greptile: GreptileSummary
  ): ReadonlyArray<QualityIssue> => [
    ...(options.requireReviewComments >= 0 && actionableReviewThreadCount > options.requireReviewComments
      ? [
          closeoutIssue(
            "pr-review:required-count",
            "pr-review",
            `Expected at most ${options.requireReviewComments} unresolved actionable PR review threads; found ${actionableReviewThreadCount}.`,
            []
          ),
        ]
      : []),
    ...(Str.isNonEmpty(Str.trim(options.requireGreptileScore)) && greptile.score !== options.requireGreptileScore
      ? [
          closeoutIssue(
            "greptile:score",
            "greptile-review",
            `Expected Greptile score ${options.requireGreptileScore}; found ${greptile.score ?? "unknown"}.`,
            [...(greptile.url === undefined ? [] : [greptile.url])]
          ),
        ]
      : []),
    ...(greptileIssueLimitExceeded(greptile.issueCount, options.requireGreptileIssues)
      ? [
          closeoutIssue(
            "greptile:issues",
            "greptile-review",
            `Expected at most ${options.requireGreptileIssues} Greptile issues; found ${greptile.issueCount ?? "unknown"}.`,
            [...(greptile.url === undefined ? [] : [greptile.url])]
          ),
        ]
      : []),
  ]
);

const greptileGateState = (options: PrCloseoutOptions, greptile: GreptileSummary): PrCloseoutGateState => {
  const blocked =
    (Str.isNonEmpty(Str.trim(options.requireGreptileScore)) && greptile.score !== options.requireGreptileScore) ||
    greptileIssueLimitExceeded(greptile.issueCount, options.requireGreptileIssues);
  return PrCloseoutGateState.make({
    name: "greptile",
    status: blocked ? "blocked" : options.retriggerGreptile ? "written" : "passed",
    detail: options.retriggerGreptile
      ? "Greptile retrigger comment was posted explicitly."
      : `Greptile score=${greptile.score ?? "unknown"} issues=${greptile.issueCount ?? "unknown"}.`,
    count: greptile.issueCount,
    url: greptile.url,
  });
};

const threadBotGateState = (
  name: "coderabbit" | "chatgpt",
  displayName: string,
  botComments: ReadonlyArray<GhComment>,
  reviewThreads: ReadonlyArray<GhReviewThread>
): PrCloseoutGateState => {
  const activeThreads = botAuthoredReviewThreadCount(reviewThreads, name);
  const comments = botCommentCount(botComments, name);
  return PrCloseoutGateState.make({
    name,
    status: activeThreads > 0 ? "blocked" : comments > 0 ? "passed" : "unknown",
    detail:
      activeThreads > 0
        ? `${activeThreads} unresolved ${displayName}-authored review thread(s).`
        : comments > 0
          ? `${displayName} comments are present and no active ${displayName}-authored thread remains.`
          : `No ${displayName} signal was found in fetched bot comments.`,
    count: activeThreads,
  });
};

const closeoutGateStatesFromParts = (
  options: PrCloseoutOptions,
  actionableReviewThreadCount: number,
  greptile: GreptileSummary,
  botComments: ReadonlyArray<GhComment>,
  reviewThreads: ReadonlyArray<GhReviewThread>
): ReadonlyArray<PrCloseoutGateState> => {
  const enabledBots = normalizedTokens(options.bots);

  return [
    PrCloseoutGateState.make({
      name: "review-threads",
      status: actionableReviewThreadCount > 0 ? "blocked" : "passed",
      detail:
        actionableReviewThreadCount > 0
          ? `${actionableReviewThreadCount} unresolved actionable review thread(s).`
          : "No unresolved actionable review threads.",
      count: actionableReviewThreadCount,
    }),
    ...(A.contains(enabledBots, "greptile") ? [greptileGateState(options, greptile)] : []),
    ...(A.contains(enabledBots, "coderabbit")
      ? [threadBotGateState("coderabbit", "CodeRabbit", botComments, reviewThreads)]
      : []),
    ...(A.contains(enabledBots, "chatgpt")
      ? [threadBotGateState("chatgpt", "ChatGPT", botComments, reviewThreads)]
      : []),
    PrCloseoutGateState.make({
      name: "hosted-checks",
      status: "unknown",
      detail: "Hosted check state is owned by yeet monitor and gh pr checks.",
    }),
  ];
};

/**
 * Build durable closeout gate states for the current PR evidence snapshot.
 *
 * @param input - Full closeout evidence and option bundle collected from
 * GitHub.
 * @returns Gate states for review threads, enabled bot signals, and hosted
 * checks.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { closeoutGateStates, GreptileSummary, PrCloseoutOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const states = closeoutGateStates({
 *   actionableReviewThreadCount: 0,
 *   botComments: [],
 *   greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
 *   options: PrCloseoutOptions.make({
 *     bots: "greptile",
 *     requireGreptileIssues: 0,
 *     requireGreptileScore: "5/5",
 *     requireReviewComments: 0,
 *     retriggerGreptile: false
 *   }),
 *   reviewThreads: []
 * })
 *
 * strictEqual(states[0]?.name, "review-threads")
 * ```
 * @category validation
 * @since 0.0.0
 */
export const closeoutGateStates = (input: CloseoutGateStatesInput): ReadonlyArray<PrCloseoutGateState> =>
  closeoutGateStatesFromParts(
    input.options,
    input.actionableReviewThreadCount,
    input.greptile,
    input.botComments,
    input.reviewThreads
  );

/**
 * Build durable PR closeout gate states from simplified test inputs.
 *
 * @param input - Closeout test inputs controlling gate requirements.
 * @returns Durable PR closeout gate states for tests.
 * @example
 * ```ts
 * import { closeoutGateStatesForTesting, GreptileSummary, PrCloseoutOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const states = closeoutGateStatesForTesting({
 *   options: PrCloseoutOptions.make({
 *     bots: "coderabbit,chatgpt,greptile",
 *     requireGreptileIssues: 0,
 *     requireGreptileScore: "5/5",
 *     requireReviewComments: 0,
 *     retriggerGreptile: false
 *   }),
 *   actionableReviewThreadCount: 0,
 *   greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
 *   botComments: []
 * })
 * console.log(states.length)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const closeoutGateStatesForTesting = (input: {
  readonly options: PrCloseoutOptions;
  readonly actionableReviewThreadCount: number;
  readonly greptile: GreptileSummary;
  readonly botComments: ReadonlyArray<GreptileSummaryCommentInput>;
}): ReadonlyArray<PrCloseoutGateState> =>
  closeoutGateStates({
    options: input.options,
    actionableReviewThreadCount: input.actionableReviewThreadCount,
    greptile: input.greptile,
    botComments: A.map(input.botComments, (comment, index) =>
      GhComment.make({
        author: GhActor.make({ login: comment.authorLogin }),
        body: comment.body,
        id: `comment-${index}`,
        url: comment.url,
      })
    ),
    reviewThreads: [],
  });
