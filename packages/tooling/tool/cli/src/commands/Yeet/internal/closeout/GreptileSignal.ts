/**
 * Greptile and bot signal parsing for Yeet closeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O } from "@beep/utils";
import * as A from "effect/Array";
import { dual, flow, pipe } from "effect/Function";
import * as Str from "effect/String";
import { GhActor, GhComment } from "../../../../internal/github/index.js";
import { GreptileSummary } from "./Closeout.schemas.js";
import type { GhReviewThread } from "./Gh.schemas.js";

/**
 * Return a GitHub actor login with a stable fallback for missing authors.
 *
 * @param author - GitHub actor from a comment or review payload.
 * @returns The actor login, or `"unknown"` when GitHub omits the author.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { authorLogin } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(authorLogin({ login: "greptile-ai" }), "greptile-ai")
 * strictEqual(authorLogin(null), "unknown")
 * ```
 * @category getters
 * @since 0.0.0
 */
export const authorLogin = (author: GhActor | null): string => author?.login ?? "unknown";

const textMatchesAnyToken = (tokens: ReadonlyArray<string>, value: string): boolean => {
  const lower = Str.toLowerCase(value);
  return A.some(tokens, (token) => Str.includes(token)(lower));
};

/**
 * Check whether an actor login contains one of the configured bot tokens.
 *
 * @param tokens - Lowercase bot-name tokens such as `greptile` or
 * `coderabbit`.
 * @param author - GitHub actor to classify.
 * @returns Whether the author login contains any configured token.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { isBotComment } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(isBotComment(["coderabbit"], { login: "coderabbitai" }), true)
 * strictEqual(isBotComment({ login: "reviewer" })(["coderabbit"]), false)
 * ```
 * @category guards
 * @since 0.0.0
 */
export const isBotComment: {
  (tokens: ReadonlyArray<string>, author: GhActor | null): boolean;
  (author: GhActor | null): (tokens: ReadonlyArray<string>) => boolean;
} = dual(2, (tokens: ReadonlyArray<string>, author: GhActor | null): boolean =>
  textMatchesAnyToken(tokens, authorLogin(author))
);

/**
 * Check whether an actor is Greptile-authored.
 *
 * @param author - GitHub actor to classify.
 * @returns Whether the login contains the Greptile token.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { isGreptileComment } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(isGreptileComment({ login: "greptile-ai" }), true)
 * strictEqual(isGreptileComment({ login: "coderabbitai" }), false)
 * ```
 * @category guards
 * @since 0.0.0
 */
export const isGreptileComment = (author: GhActor | null): boolean =>
  Str.includes("greptile")(Str.toLowerCase(authorLogin(author)));

const scorePattern = /(?:confidence\s+)?score\s*[:=-]\s*(?<score>\d+(?:\.\d+)?)\s*\/\s*5/iu;
const leadingIssueCountPattern = /^\s*(?<count>\d+)\s+(?:open\s+)?issues?\b/imu;
const labeledIssueCountPattern = /^\s*(?:open\s+)?issues?\s*[:=-]\s*(?<count>\d+)\b/imu;

const parseScore = (body: string): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(scorePattern.exec(body)?.groups?.score),
    O.map((score) => `${score}/5`)
  );

const parseIssueCount = (body: string): O.Option<number> => {
  if (/^\s*no\s+(?:open\s+)?issues?\b/imu.test(body)) {
    return O.some(0);
  }

  const count =
    leadingIssueCountPattern.exec(body)?.groups?.count ?? labeledIssueCountPattern.exec(body)?.groups?.count;
  return pipe(
    O.fromUndefinedOr(count),
    O.flatMap((value) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? O.none<number>() : O.some(parsed);
    })
  );
};

/**
 * Parse the latest Greptile score and issue-count signal from PR comments.
 *
 * @param comments - Pull request comments ordered from oldest to newest.
 * @returns Parsed Greptile summary from the latest comment carrying Greptile
 * signal, or an empty summary when none is present.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { latestGreptileSummary } from "@beep/repo-cli/test/Yeet"
 *
 * const summary = latestGreptileSummary([
 *   {
 *     author: { login: "greptile-ai" },
 *     body: "Score: 5/5\nIssues: 0",
 *     id: "comment-1",
 *     url: "https://github.com/o/r/pull/1#issuecomment-1"
 *   }
 * ])
 *
 * strictEqual(summary.score, "5/5")
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const latestGreptileSummary: (comments: ReadonlyArray<GhComment>) => GreptileSummary = flow(
  A.filter((comment) => isGreptileComment(comment.author)),
  A.map((comment) =>
    GreptileSummary.make({
      ...O.getSomesStruct({ issueCount: parseIssueCount(comment.body), score: parseScore(comment.body) }),
      url: comment.url,
    })
  ),
  A.filter((summary) => summary.score !== undefined || summary.issueCount !== undefined),
  A.reverse,
  A.head,
  O.getOrElse(() => GreptileSummary.make({}))
);

/**
 * Count unresolved, non-outdated review threads authored by Greptile.
 *
 * @param threads - Review threads fetched from the pull request.
 * @returns Active Greptile-authored thread count.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThread, GhReviewThreadCommentConnection, greptileAuthoredReviewThreadCount } from "@beep/repo-cli/test/Yeet"
 *
 * const thread = GhReviewThread.make({
 *   comments: GhReviewThreadCommentConnection.make({
 *     nodes: [{ author: { login: "greptile-ai" }, body: "Issue", id: "c1", url: "https://github.com/o/r/pull/1#discussion_r1" }],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   }),
 *   id: "PRRT_1",
 *   isOutdated: false,
 *   isResolved: false,
 *   line: 1,
 *   path: "src/file.ts"
 * })
 *
 * strictEqual(greptileAuthoredReviewThreadCount([thread]), 1)
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const greptileAuthoredReviewThreadCount: (threads: ReadonlyArray<GhReviewThread>) => number = flow(
  A.filter(
    (thread) =>
      !thread.isResolved &&
      !thread.isOutdated &&
      A.some(thread.comments.nodes, (comment) => isGreptileComment(comment.author))
  ),
  A.length
);

/**
 * Count unresolved, non-outdated review threads authored by a named bot.
 *
 * @param threads - Review threads fetched from the pull request.
 * @param token - Bot-login token to match against nested thread comments.
 * @returns Active review-thread count for the matching bot token.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { botAuthoredReviewThreadCount, GhReviewThread, GhReviewThreadCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const thread = GhReviewThread.make({
 *   comments: GhReviewThreadCommentConnection.make({
 *     nodes: [{ author: { login: "coderabbitai" }, body: "Nit", id: "c1", url: "https://github.com/o/r/pull/1#discussion_r1" }],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   }),
 *   id: "PRRT_1",
 *   isOutdated: false,
 *   isResolved: false,
 *   line: 1,
 *   path: "src/file.ts"
 * })
 *
 * strictEqual(botAuthoredReviewThreadCount([thread], "coderabbit"), 1)
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const botAuthoredReviewThreadCount: {
  (threads: ReadonlyArray<GhReviewThread>, token: string): number;
  (token: string): (threads: ReadonlyArray<GhReviewThread>) => number;
} = dual(2, (threads: ReadonlyArray<GhReviewThread>, token: string): number =>
  pipe(
    threads,
    A.filter(
      (thread) =>
        !thread.isResolved &&
        !thread.isOutdated &&
        A.some(thread.comments.nodes, (comment) => textMatchesAnyToken([token], authorLogin(comment.author)))
    ),
    A.length
  )
);

/**
 * Count top-level pull request comments authored by a named bot.
 *
 * @param comments - Top-level pull request comments.
 * @param token - Bot-login token to match against comment authors.
 * @returns Count of comments whose author login contains the token.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { botCommentCount } from "@beep/repo-cli/test/Yeet"
 *
 * const comments = [
 *   { author: { login: "chatgpt-codex-connector" }, body: "Reviewed", id: "c1", url: "https://github.com/o/r/pull/1#issuecomment-1" }
 * ]
 *
 * strictEqual(botCommentCount(comments, "chatgpt"), 1)
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const botCommentCount: {
  (comments: ReadonlyArray<GhComment>, token: string): number;
  (token: string): (comments: ReadonlyArray<GhComment>) => number;
} = dual(2, (comments: ReadonlyArray<GhComment>, token: string): number =>
  pipe(
    comments,
    A.filter((comment) => textMatchesAnyToken([token], authorLogin(comment.author))),
    A.length
  )
);

const hasGreptileEvidence = (summary: GreptileSummary, activeThreadCount: number): boolean =>
  summary.issueCount !== undefined || summary.score !== undefined || summary.url !== undefined || activeThreadCount > 0;

/**
 * Fill a missing Greptile issue count from active Greptile-authored threads.
 *
 * @param summary - Parsed Greptile summary from comments.
 * @param activeThreadCount - Count of unresolved Greptile-authored review
 * threads.
 * @returns Summary with inferred `issueCount` only when Greptile evidence is
 * present.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GreptileSummary, inferGreptileIssueCount } from "@beep/repo-cli/test/Yeet"
 *
 * const summary = inferGreptileIssueCount(GreptileSummary.make({ score: "5/5" }), 2)
 *
 * strictEqual(summary.issueCount, 2)
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const inferGreptileIssueCount: {
  (summary: GreptileSummary, activeThreadCount: number): GreptileSummary;
  (activeThreadCount: number): (summary: GreptileSummary) => GreptileSummary;
} = dual(
  2,
  (summary: GreptileSummary, activeThreadCount: number): GreptileSummary =>
    summary.issueCount === undefined && hasGreptileEvidence(summary, activeThreadCount)
      ? GreptileSummary.make({ ...summary, issueCount: activeThreadCount })
      : summary
);

type GreptileSummaryCommentInput = {
  readonly authorLogin: string;
  readonly body: string;
  readonly url: string;
};

/**
 * Parse the latest Greptile summary from simplified comment inputs.
 *
 * @param comments - Simplified comment inputs ordered from oldest to newest.
 * @returns Parsed Greptile summary from the latest bot-authored summary comment.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { latestGreptileSummaryForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const summary = latestGreptileSummaryForTesting([
 *   {
 *     authorLogin: "greptile-ai",
 *     body: "Score: 5/5\nNo open issues",
 *     url: "https://github.com/o/r/pull/1#issuecomment-1"
 *   }
 * ])
 *
 * strictEqual(summary.issueCount, 0)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const latestGreptileSummaryForTesting = (
  comments: ReadonlyArray<GreptileSummaryCommentInput>
): GreptileSummary =>
  latestGreptileSummary(
    pipe(
      comments,
      A.map((comment) =>
        GhComment.make({
          author: GhActor.make({ login: comment.authorLogin }),
          body: comment.body,
          id: comment.url,
          url: comment.url,
        })
      )
    )
  );

/**
 * Fill a missing Greptile issue count from active Greptile-authored thread count.
 *
 * Inference is only applied when there is positive evidence that Greptile ran:
 * a parsed summary score/url/issue count, or at least one active Greptile-authored
 * review thread. When no Greptile evidence exists the issue count is left
 * undefined so the closeout gate stays fail-closed instead of treating a missing
 * Greptile result as zero issues.
 *
 * @param summary - Parsed Greptile summary.
 * @param activeThreadCount - Unresolved, non-outdated Greptile-authored thread count.
 * @returns Summary with an inferred issue count only when Greptile evidence is present.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GreptileSummary, inferGreptileIssueCountForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const summary = inferGreptileIssueCountForTesting(GreptileSummary.make({ url: "https://github.com/o/r/pull/1" }), 3)
 *
 * strictEqual(summary.issueCount, 3)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const inferGreptileIssueCountForTesting = inferGreptileIssueCount;
