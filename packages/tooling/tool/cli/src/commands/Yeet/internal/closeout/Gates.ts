/**
 * Closeout gate and issue derivation for Yeet PR closeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { normalizedTokens } from "../../../../internal/cli/Flags.ts";
import { GhActor, GhComment } from "../../../../internal/github/index.ts";
import { QualityIssue, QualityIssueRouting } from "../../Yeet.schemas.ts";
import {
  parseYeetReviewBodySignal,
  YeetReviewBodySignalInput,
  YeetReviewBodyThreadLocation,
  yeetReviewBodyAdvisoryCount,
} from "../ReviewBodySignal.ts";
import {
  deriveYeetReviewThreadState,
  summarizeYeetReviewThreadStates,
  YeetReviewThreadNewestComment,
  YeetReviewThreadStateCounts,
  YeetReviewThreadStateInput,
  yeetReviewCommentAuthorKind,
} from "../ReviewThreadState.ts";
import { GreptileSummary, PrCloseoutGateState, PrCloseoutOptions } from "./Closeout.schemas.ts";
import { GhReviewThread } from "./Gh.schemas.ts";
import { authorLogin, botAuthoredReviewThreadCount, botCommentCount } from "./GreptileSignal.ts";
import type { GhReview } from "./Gh.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/closeout/Gates");

type CloseoutGateStatesInput = {
  readonly actionableReviewThreadCount: number;
  readonly advisories: CloseoutReviewAdvisories;
  readonly botComments: ReadonlyArray<GhComment>;
  readonly followUpThreadCount: number;
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

const reviewThreadLocation = (thread: GhReviewThread): string => `${thread.path ?? "unknown-path"}:${thread.line ?? 0}`;

// The thread's newest comment quoted as evidence, falling back to its location
// when the thread carries no readable comment at all.
const reviewThreadEvidence = (thread: GhReviewThread): ReadonlyArray<string> =>
  pipe(
    thread.comments.nodes,
    A.last,
    O.map((comment) => [comment.url, `${authorLogin(comment.author)}: ${Str.slice(0, 240)(Str.trim(comment.body))}`]),
    O.getOrElse(() => [reviewThreadLocation(thread)])
  );

/**
 * Convert an unresolved GitHub review thread into a normalized Yeet issue.
 *
 * **Example** (Convert thread to issue)
 *
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
 *
 * @param thread - Review thread whose latest comment and location become issue
 * evidence.
 * @returns A blocking `pr-review` quality issue for closeout packets.
 * @category diagnostics
 * @since 0.0.0
 */
export const reviewThreadIssue = (thread: GhReviewThread): QualityIssue =>
  closeoutIssue(
    `pr-review:${thread.id}`,
    "pr-review",
    `Unresolved actionable PR review thread at ${reviewThreadLocation(thread)}.`,
    reviewThreadEvidence(thread)
  );

/**
 * Convert an unanswered reviewer follow-up into a normalized Yeet issue.
 *
 * **Details**
 *
 * A follow-up thread is *resolved* on GitHub, so no unresolved-thread count
 * reaches it, yet a named human wrote the last word on it after the pull
 * request author closed it. It blocks closeout exactly as an unresolved
 * actionable thread does, and the issue's evidence quotes that last word so
 * the operator sees who is waiting without opening the pull request.
 *
 * **Example** (Convert a follow-up thread to an issue)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import {
 *   GhReviewThread,
 *   GhReviewThreadCommentConnection,
 *   reviewFollowUpThreadIssue,
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const thread = GhReviewThread.make({
 *   comments: GhReviewThreadCommentConnection.make({
 *     nodes: [{
 *       author: { login: "reviewer" },
 *       body: "Still not covered.",
 *       id: "comment-2",
 *       url: "https://github.com/o/r/pull/1#discussion_r2"
 *     }],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   }),
 *   id: "PRRT_1",
 *   isOutdated: false,
 *   isResolved: true,
 *   line: 42,
 *   path: "src/file.ts"
 * })
 *
 * strictEqual(reviewFollowUpThreadIssue(thread).blocking, true)
 * ```
 *
 * @param thread - Review thread the author resolved and a reviewer has since commented on.
 * @returns A blocking `pr-review` quality issue for closeout packets.
 * @category diagnostics
 * @since 0.0.0
 */
export const reviewFollowUpThreadIssue = (thread: GhReviewThread): QualityIssue =>
  closeoutIssue(
    `pr-review-follow-up:${thread.id}`,
    "pr-review",
    `Unanswered reviewer follow-up on a resolved PR review thread at ${reviewThreadLocation(thread)}.`,
    reviewThreadEvidence(thread)
  );

const newestCommentFacts = (
  author: GhActor | null | undefined,
  createdAt: string | undefined
): O.Option<YeetReviewThreadNewestComment> =>
  pipe(
    O.fromNullishOr(author),
    O.map((actor) =>
      YeetReviewThreadNewestComment.make({
        authorLogin: actor.login,
        authorKind: yeetReviewCommentAuthorKind(O.fromUndefinedOr(actor.__typename)),
        createdAt: O.fromUndefinedOr(createdAt),
      })
    )
  );

// The newest comment reduced to the two structural facts the thread-state rule
// reads. The `latest: comments(last: 1)` selection answers it outright however
// many pages the chain spans, so it is read first; the last node of the first
// page is the fallback, and only while GitHub said that page is the whole
// chain. A thread that is neither — an unpaged payload recorded before the
// selection existed whose comments overflow one page — has an unknowable last
// speaker, as does a comment whose author GitHub no longer names: both yield
// None, because unknown never gates.
const closeoutNewestComment = (thread: GhReviewThread): O.Option<YeetReviewThreadNewestComment> =>
  pipe(
    O.fromUndefinedOr(thread.latest),
    O.flatMap((latest) => A.last(latest.nodes)),
    O.flatMap((comment) => newestCommentFacts(comment.author, comment.createdAt)),
    O.orElse(() =>
      thread.comments.pageInfo.hasNextPage
        ? O.none()
        : pipe(
            A.last(thread.comments.nodes),
            O.flatMap((comment) => newestCommentFacts(comment.author, comment.createdAt))
          )
    )
  );

const closeoutThreadStateInput = (
  thread: GhReviewThread,
  pullRequestAuthor: O.Option<string>
): YeetReviewThreadStateInput =>
  YeetReviewThreadStateInput.make({
    threadId: thread.id,
    isResolved: thread.isResolved,
    isOutdated: thread.isOutdated,
    path: O.fromNullishOr(thread.path),
    line: O.fromNullishOr(thread.line),
    pullRequestAuthor,
    resolvedBy: pipe(
      O.fromUndefinedOr(thread.resolvedBy),
      O.flatMap(O.fromNullishOr),
      O.map((actor) => actor.login)
    ),
    newestComment: closeoutNewestComment(thread),
  });

/**
 * One pull request's closeout review threads, partitioned by what each owes.
 *
 * **Example** (An empty pull request owes nothing)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { CloseoutReviewThreadTriage, YeetReviewThreadStateCounts } from "@beep/repo-cli/test/Yeet"
 *
 * const triage = CloseoutReviewThreadTriage.make({
 *   counts: YeetReviewThreadStateCounts.make({ unresolved: 0, followUp: 0, acknowledged: 0, answered: 0 }),
 *   unresolvedThreads: [],
 *   followUpThreads: []
 * })
 *
 * strictEqual(triage.counts.followUp, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CloseoutReviewThreadTriage extends S.Class<CloseoutReviewThreadTriage>($I`CloseoutReviewThreadTriage`)(
  {
    counts: YeetReviewThreadStateCounts,
    unresolvedThreads: S.Array(GhReviewThread),
    followUpThreads: S.Array(GhReviewThread),
  },
  $I.annote("CloseoutReviewThreadTriage", {
    description: "A pull request's closeout review threads partitioned by classified state, with per-state tallies.",
  })
) {}

const closeoutReviewThreadTriageImpl = (
  threads: ReadonlyArray<GhReviewThread>,
  pullRequestAuthor: O.Option<string>
): CloseoutReviewThreadTriage => {
  const classified = A.map(
    threads,
    (thread) => [thread, deriveYeetReviewThreadState(closeoutThreadStateInput(thread, pullRequestAuthor))] as const
  );
  const inState = (tag: string): ReadonlyArray<GhReviewThread> =>
    pipe(
      classified,
      A.filter(([, state]) => Str.Equivalence(state.state, tag)),
      A.map(([thread]) => thread)
    );
  return CloseoutReviewThreadTriage.make({
    counts: summarizeYeetReviewThreadStates(A.map(classified, ([, state]) => state)),
    unresolvedThreads: inState("unresolved"),
    followUpThreads: inState("resolved-follow-up"),
  });
};

/**
 * Classify every closeout review thread through the shared thread-state rule.
 *
 * **Details**
 *
 * Closeout reads each thread's whole comment chain, so the newest comment is
 * the last node of that chain — unless GitHub said there is another page, in
 * which case the last speaker is unknown and the thread classifies as
 * answered. The two returned partitions are the two that raise issues;
 * `counts` tallies all four states for the report and the advisory gate row.
 *
 * **Example** (An empty pull request owes nothing)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { closeoutReviewThreadTriage } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * strictEqual(closeoutReviewThreadTriage([], O.none()).counts.followUp, 0)
 * ```
 *
 * @param threads - Every review thread collected for the pull request.
 * @param pullRequestAuthor - The pull request author's login, when `gh pr view` named one.
 * @returns The unresolved and follow-up partitions plus per-state tallies.
 * @category validation
 * @since 0.0.0
 */
export const closeoutReviewThreadTriage: {
  (threads: ReadonlyArray<GhReviewThread>, pullRequestAuthor: O.Option<string>): CloseoutReviewThreadTriage;
  (pullRequestAuthor: O.Option<string>): (threads: ReadonlyArray<GhReviewThread>) => CloseoutReviewThreadTriage;
} = dual(2, closeoutReviewThreadTriageImpl);

/**
 * How many advisory findings the pull request's review bodies raise.
 *
 * **Example** (No bodies raise nothing)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { CloseoutReviewAdvisories } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(CloseoutReviewAdvisories.make({ count: 0, sources: [] }).count, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CloseoutReviewAdvisories extends S.Class<CloseoutReviewAdvisories>($I`CloseoutReviewAdvisories`)(
  {
    count: S.Finite,
    sources: S.Array(S.String),
  },
  $I.annote("CloseoutReviewAdvisories", {
    description: "The advisory total a pull request's review bodies raise, with one source per contributing author.",
  })
) {}

const reviewAuthorLogin = (review: GhReview): O.Option<string> =>
  pipe(
    O.fromNullishOr(review.author),
    O.map((author) => author.login),
    O.filter((login) => Str.isNonEmpty(Str.trim(login)))
  );

const reviewSubmittedAt = (review: GhReview): string =>
  pipe(
    O.fromUndefinedOr(review.submittedAt),
    O.flatMap(O.fromNullishOr),
    O.getOrElse(() => "")
  );

// The newest body an author submitted. A review with no submission timestamp
// sorts before every timestamped one, and equal timestamps keep the later
// element, so the fallback is the order GitHub returned the reviews in.
const newestReviewByAuthor = (reviews: ReadonlyArray<GhReview>, login: string): O.Option<GhReview> =>
  pipe(
    reviews,
    A.filter((review) => O.exists(reviewAuthorLogin(review), (candidate) => Str.Equivalence(candidate, login))),
    A.reduce(O.none<GhReview>(), (newest, review) =>
      O.match(newest, {
        onNone: () => O.some(review),
        onSome: (best) =>
          Order.String(reviewSubmittedAt(review), reviewSubmittedAt(best)) === -1 ? O.some(best) : O.some(review),
      })
    )
  );

const closeoutReviewAdvisoriesImpl = (
  reviews: ReadonlyArray<GhReview>,
  reviewThreads: ReadonlyArray<GhReviewThread>
): CloseoutReviewAdvisories => {
  const locations = pipe(
    reviewThreads,
    A.flatMap((thread) =>
      pipe(
        O.fromNullishOr(thread.path),
        O.map((path) => YeetReviewBodyThreadLocation.make({ path, line: O.fromNullishOr(thread.line) })),
        O.toArray
      )
    )
  );
  const bodied = A.filter(reviews, (review) => Str.isNonEmpty(Str.trim(review.body)));
  const logins = pipe(
    bodied,
    A.flatMap((review) => O.toArray(reviewAuthorLogin(review))),
    A.dedupe,
    A.sort(Order.String)
  );
  const counted = pipe(
    logins,
    A.flatMap((login) =>
      pipe(
        newestReviewByAuthor(bodied, login),
        O.map((review) =>
          yeetReviewBodyAdvisoryCount(
            parseYeetReviewBodySignal(YeetReviewBodySignalInput.make({ authorLogin: login, body: review.body })),
            locations
          )
        ),
        O.filter((count) => count > 0),
        O.map((count) => [login, count] as const),
        O.toArray
      )
    )
  );
  return CloseoutReviewAdvisories.make({
    count: pipe(
      counted,
      A.map(([, count]) => count),
      A.reduce(0, (total, count) => total + count)
    ),
    sources: A.map(counted, ([login, count]) => `${login}=${count}`),
  });
};

/**
 * Count the advisory findings the newest review body per author still raises.
 *
 * **Details**
 *
 * One body per author — the newest — because a review tool restates its whole
 * standing tally every round, so summing rounds would report the same nitpick
 * several times. A finding that also opened an inline review thread is already
 * on the worklist and is not counted again.
 *
 * **Gotchas**
 *
 * Advisories never block. They are reported on a gate row that is always
 * `passed`, because a body finding has no named human waiting on an answer.
 *
 * **Example** (No reviews raise no advisories)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { closeoutReviewAdvisories } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(closeoutReviewAdvisories([], []).count, 0)
 * ```
 *
 * @param reviews - Every review submitted on the pull request.
 * @param reviewThreads - Every review thread, used to drop findings a thread already carries.
 * @returns The advisory total and one `login=count` source per contributing author.
 * @category validation
 * @since 0.0.0
 */
export const closeoutReviewAdvisories: {
  (reviews: ReadonlyArray<GhReview>, reviewThreads: ReadonlyArray<GhReviewThread>): CloseoutReviewAdvisories;
  (reviewThreads: ReadonlyArray<GhReviewThread>): (reviews: ReadonlyArray<GhReview>) => CloseoutReviewAdvisories;
} = dual(2, closeoutReviewAdvisoriesImpl);

const greptileIssueLimitExceeded = (issueCount: number | undefined, limit: number): boolean =>
  limit >= 0 && (issueCount === undefined || issueCount > limit);

/**
 * Determine whether the Greptile issue-count gate should block closeout.
 *
 * **Example** (Limit exceeded and disabled)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { greptileIssueLimitExceededForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(greptileIssueLimitExceededForTesting(1, 0), true)
 * strictEqual(greptileIssueLimitExceededForTesting(1, -1), false)
 * ```
 *
 * @param issueCount - Parsed Greptile issue count, if present.
 * @param limit - Maximum accepted issue count. Negative values disable the gate.
 * @returns Whether the issue-count gate should fail.
 * @category testing
 * @since 0.0.0
 */
export const greptileIssueLimitExceededForTesting: {
  (limit: number): (issueCount: number | undefined) => boolean;
  (issueCount: number | undefined, limit: number): boolean;
} = dual(2, greptileIssueLimitExceeded);

const reviewThreadGateIssues = (
  options: PrCloseoutOptions,
  actionableReviewThreadCount: number
): ReadonlyArray<QualityIssue> =>
  options.requireReviewComments >= 0 && actionableReviewThreadCount > options.requireReviewComments
    ? [
        closeoutIssue(
          "pr-review:required-count",
          "pr-review",
          `Expected at most ${options.requireReviewComments} unresolved actionable PR review threads; found ${actionableReviewThreadCount}.`,
          []
        ),
      ]
    : [];

const greptileIssueUrls = (greptile: GreptileSummary): ReadonlyArray<string> =>
  pipe(O.fromUndefinedOr(greptile.url), O.toArray);

const greptileScoreGateIssues = (options: PrCloseoutOptions, greptile: GreptileSummary): ReadonlyArray<QualityIssue> =>
  Str.isNonEmpty(Str.trim(options.requireGreptileScore)) && greptile.score !== options.requireGreptileScore
    ? [
        closeoutIssue(
          "greptile:score",
          "greptile-review",
          `Expected Greptile score ${options.requireGreptileScore}; found ${greptile.score ?? "unknown"}.`,
          greptileIssueUrls(greptile)
        ),
      ]
    : [];

const greptileCountGateIssues = (options: PrCloseoutOptions, greptile: GreptileSummary): ReadonlyArray<QualityIssue> =>
  greptileIssueLimitExceeded(greptile.issueCount, options.requireGreptileIssues)
    ? [
        closeoutIssue(
          "greptile:issues",
          "greptile-review",
          `Expected at most ${options.requireGreptileIssues} Greptile issues; found ${greptile.issueCount ?? "unknown"}.`,
          greptileIssueUrls(greptile)
        ),
      ]
    : [];

/**
 * Derive blocking closeout issues from review-thread and Greptile gate inputs.
 *
 * **Example** (Failed review gate issues)
 *
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
 *
 * @param options - Required gate thresholds configured for closeout.
 * @param actionableReviewThreadCount - Count of unresolved human review
 * threads.
 * @param greptile - Parsed Greptile score and issue count.
 * @returns Structured issues for every closeout requirement that failed.
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
    ...reviewThreadGateIssues(options, actionableReviewThreadCount),
    ...greptileScoreGateIssues(options, greptile),
    ...greptileCountGateIssues(options, greptile),
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
    ...O.getSomesStruct({
      count: O.fromUndefinedOr(greptile.issueCount),
      url: O.fromUndefinedOr(greptile.url),
    }),
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

const reviewFollowUpGateState = (followUpThreadCount: number): PrCloseoutGateState =>
  PrCloseoutGateState.make({
    name: "review-follow-ups",
    status: followUpThreadCount > 0 ? "blocked" : "passed",
    detail:
      followUpThreadCount > 0
        ? `${followUpThreadCount} resolved review thread(s) carry an unanswered reviewer follow-up; bun run beep yeet reply answers them.`
        : "No resolved review thread carries an unanswered reviewer follow-up.",
    count: followUpThreadCount,
  });

// Always "passed": an advisory is a number the operator reads before deciding
// to go and look, never a condition the merge waits on.
const reviewAdvisoryGateState = (advisories: CloseoutReviewAdvisories): PrCloseoutGateState =>
  PrCloseoutGateState.make({
    name: "review-advisories",
    status: "passed",
    detail: A.isReadonlyArrayNonEmpty(advisories.sources)
      ? `${advisories.count} advisory review-body finding(s) from ${A.join(advisories.sources, ", ")}; advisories never block.`
      : "No advisory findings in the pull request's review bodies.",
    count: advisories.count,
  });

/**
 * Build durable closeout gate states for the current PR evidence snapshot.
 *
 * **Example** (Build review-threads gate state)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { closeoutGateStates, CloseoutReviewAdvisories, GreptileSummary, PrCloseoutOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const states = closeoutGateStates({
 *   actionableReviewThreadCount: 0,
 *   advisories: CloseoutReviewAdvisories.make({ count: 0, sources: [] }),
 *   botComments: [],
 *   followUpThreadCount: 0,
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
 *
 * @param input - Full closeout evidence and option bundle collected from
 * GitHub.
 * @returns Gate states for review threads, follow-ups, enabled bot signals,
 * review-body advisories, and hosted checks.
 * @category validation
 * @since 0.0.0
 */
export const closeoutGateStates = (input: CloseoutGateStatesInput): ReadonlyArray<PrCloseoutGateState> => {
  const enabledBots = normalizedTokens(input.options.bots);

  return [
    PrCloseoutGateState.make({
      name: "review-threads",
      status: input.actionableReviewThreadCount > 0 ? "blocked" : "passed",
      detail:
        input.actionableReviewThreadCount > 0
          ? `${input.actionableReviewThreadCount} unresolved actionable review thread(s).`
          : "No unresolved actionable review threads.",
      count: input.actionableReviewThreadCount,
    }),
    reviewFollowUpGateState(input.followUpThreadCount),
    ...(A.contains(enabledBots, "greptile") ? [greptileGateState(input.options, input.greptile)] : []),
    ...(A.contains(enabledBots, "coderabbit")
      ? [threadBotGateState("coderabbit", "CodeRabbit", input.botComments, input.reviewThreads)]
      : []),
    ...(A.contains(enabledBots, "chatgpt")
      ? [threadBotGateState("chatgpt", "ChatGPT", input.botComments, input.reviewThreads)]
      : []),
    reviewAdvisoryGateState(input.advisories),
    PrCloseoutGateState.make({
      name: "hosted-checks",
      status: "unknown",
      detail: "Hosted check state is owned by yeet monitor and gh pr checks.",
    }),
  ];
};

/**
 * Simplified bot comment shape tests hand to {@link closeoutGateStatesForTesting}.
 *
 * **Example** (A Greptile summary comment)
 *
 * ```ts
 * import { CloseoutGateStatesTestComment } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = CloseoutGateStatesTestComment.make({ authorLogin: "greptile", body: "Score: 5/5", url: "https://example.test/c1" })
 * console.log(comment.authorLogin) // "greptile"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CloseoutGateStatesTestComment extends S.Class<CloseoutGateStatesTestComment>(
  $I`CloseoutGateStatesTestComment`
)(
  { authorLogin: S.String, body: S.String, url: S.String },
  $I.annote("CloseoutGateStatesTestComment", {
    description: "Minimal bot comment a closeout gate-state test feeds without a full GitHub payload.",
  })
) {}

/**
 * Inputs a test hands to {@link closeoutGateStatesForTesting}.
 *
 * **Example** (No threads, no advisories)
 *
 * ```ts
 * import { CloseoutGateStatesTestInput, CloseoutReviewAdvisories, GreptileSummary, PrCloseoutOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const input = CloseoutGateStatesTestInput.make({
 *   options: PrCloseoutOptions.make({
 *     bots: "greptile",
 *     requireGreptileIssues: 0,
 *     requireGreptileScore: "5/5",
 *     requireReviewComments: 0,
 *     retriggerGreptile: false
 *   }),
 *   actionableReviewThreadCount: 0,
 *   advisories: CloseoutReviewAdvisories.make({ count: 0, sources: [] }),
 *   followUpThreadCount: 0,
 *   greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
 *   botComments: []
 * })
 * console.log(input.followUpThreadCount) // 0
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CloseoutGateStatesTestInput extends S.Class<CloseoutGateStatesTestInput>($I`CloseoutGateStatesTestInput`)(
  {
    options: PrCloseoutOptions,
    actionableReviewThreadCount: S.Finite,
    advisories: CloseoutReviewAdvisories,
    followUpThreadCount: S.Finite,
    greptile: GreptileSummary,
    botComments: S.Array(CloseoutGateStatesTestComment),
  },
  $I.annote("CloseoutGateStatesTestInput", {
    description: "Closeout gate-state test inputs controlling gate requirements without GitHub payloads.",
  })
) {}

/**
 * Build durable PR closeout gate states from simplified test inputs.
 *
 * **Example** (Simplified test gate states)
 *
 * ```ts
 * import {
 *   closeoutGateStatesForTesting,
 *   CloseoutGateStatesTestInput,
 *   CloseoutReviewAdvisories,
 *   GreptileSummary,
 *   PrCloseoutOptions,
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const states = closeoutGateStatesForTesting(CloseoutGateStatesTestInput.make({
 *   options: PrCloseoutOptions.make({
 *     bots: "coderabbit,chatgpt,greptile",
 *     requireGreptileIssues: 0,
 *     requireGreptileScore: "5/5",
 *     requireReviewComments: 0,
 *     retriggerGreptile: false
 *   }),
 *   actionableReviewThreadCount: 0,
 *   advisories: CloseoutReviewAdvisories.make({ count: 0, sources: [] }),
 *   followUpThreadCount: 0,
 *   greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
 *   botComments: []
 * }))
 * console.log(states.length)
 * ```
 *
 * @param input - Closeout test inputs controlling gate requirements.
 * @returns Durable PR closeout gate states for tests.
 * @category testing
 * @since 0.0.0
 */
export const closeoutGateStatesForTesting = (input: CloseoutGateStatesTestInput): ReadonlyArray<PrCloseoutGateState> =>
  closeoutGateStates({
    options: input.options,
    actionableReviewThreadCount: input.actionableReviewThreadCount,
    advisories: input.advisories,
    followUpThreadCount: input.followUpThreadCount,
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
