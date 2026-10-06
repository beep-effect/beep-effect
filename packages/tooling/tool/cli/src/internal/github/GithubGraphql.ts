/**
 * The GraphQL-only pull-request operations, as typed `@effected/github`
 * documents.
 *
 * **Details**
 *
 * Two things have no REST equivalent: flipping a draft to ready
 * (`markPullRequestReadyForReview`) and a review thread's resolution state
 * (REST review comments carry no `isResolved`). Both are spent through
 * `GraphqlBudget.guard`; everything else goes through `GithubRest`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { GitHubClient, GitHubError, GraphQLDocument, Repo } from "@effected/github";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { GitHubGraphQLError } from "@effected/github";

const $I = $RepoCliId.create("internal/github/GithubGraphql");

/**
 * Fold a GraphQL failure into the one `GitHubError` taxonomy (same `kind`
 * literals), so callers handle a single error type.
 *
 * **Example** (Fold a rate-limit failure)
 *
 * ```ts
 * import { graphqlErrorToGitHubError } from "@beep/repo-cli/test/SharedInternals"
 * import { GitHubGraphQLError } from "@effected/github"
 *
 * const error = graphqlErrorToGitHubError(GitHubGraphQLError.decode("q", "bad"))
 * console.log(error.kind) // "decode"
 * ```
 *
 * @param error - The GraphQL failure.
 * @returns The equivalent `GitHubError`.
 * @category errors
 * @since 0.0.0
 */
export const graphqlErrorToGitHubError = (error: GitHubGraphQLError): GitHubError =>
  GitHubError.make({
    kind: error.kind,
    operation: error.operation,
    reason: error.reason,
    ...(error.retryAfterMillis === undefined ? {} : { retryAfterMillis: error.retryAfterMillis }),
  });

const MarkReadyData = S.Struct({
  markPullRequestReadyForReview: S.Struct({ pullRequest: S.Struct({ isDraft: S.Boolean }) }),
});

/**
 * The draft-to-ready mutation, keyed by the pull request's node id.
 *
 * @category documents
 * @since 0.0.0
 */
export const markPullRequestReadyDocument = GraphQLDocument.make({
  name: "markPullRequestReadyForReview",
  document:
    "mutation($pullRequestId: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) { pullRequest { isDraft } } }",
  response: MarkReadyData,
})<{ readonly pullRequestId: string }>();

/**
 * The newest comment on a review thread, as GraphQL reports it.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubThreadComment extends S.Class<GithubThreadComment>($I`GithubThreadComment`)(
  {
    author: S.NullOr(S.Struct({ __typename: S.optionalKey(S.String), login: S.String })),
    createdAt: S.optionalKey(S.String),
  },
  $I.annote("GithubThreadComment", { description: "The newest comment on a review thread." })
) {}

/**
 * One review thread with its resolution state.
 *
 * **Example** (An unresolved thread)
 *
 * ```ts
 * import { GithubReviewThreadNode } from "@beep/repo-cli/test/SharedInternals"
 *
 * const thread = GithubReviewThreadNode.make({
 *   id: "PRRT_1",
 *   isResolved: false,
 *   isOutdated: false,
 *   path: "a.ts",
 *   line: 3,
 *   resolvedBy: null,
 *   comments: { nodes: [] }
 * })
 * console.log(thread.isResolved) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubReviewThreadNode extends S.Class<GithubReviewThreadNode>($I`GithubReviewThreadNode`)(
  {
    id: S.String,
    isResolved: S.Boolean,
    isOutdated: S.Boolean,
    path: S.NullOr(S.String),
    line: S.NullOr(S.Finite),
    resolvedBy: S.NullOr(S.Struct({ login: S.String })),
    comments: S.Struct({ nodes: S.Array(GithubThreadComment) }),
  },
  $I.annote("GithubReviewThreadNode", { description: "One review thread with its resolution state." })
) {}

const ReviewThreadsData = S.Struct({
  repository: S.Struct({
    pullRequest: S.Struct({
      author: S.NullOr(S.Struct({ login: S.String })),
      reviewThreads: S.Struct({
        totalCount: S.Int,
        pageInfo: S.Struct({ hasNextPage: S.Boolean, endCursor: S.NullOr(S.String) }),
        nodes: S.Array(GithubReviewThreadNode),
      }),
    }),
  }),
});

/**
 * One page of a pull request's review threads.
 *
 * @category documents
 * @since 0.0.0
 */
export const reviewThreadsPageDocument = GraphQLDocument.make({
  name: "pullRequestReviewThreads",
  document:
    "query($owner: String!, $name: String!, $number: Int!, $cursor: String) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { author { login } reviewThreads(first: 100, after: $cursor) { totalCount pageInfo { hasNextPage endCursor } nodes { id isResolved isOutdated path line resolvedBy { login } comments(last: 1) { nodes { author { __typename login } createdAt } } } } } } }",
  response: ReviewThreadsData,
})<{ readonly owner: string; readonly name: string; readonly number: number; readonly cursor: string | null }>();

/**
 * Every review thread on a pull request plus the pull request's author.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubReviewThreads extends S.Class<GithubReviewThreads>($I`GithubReviewThreads`)(
  { author: S.Option(S.String), threads: S.Array(GithubReviewThreadNode) },
  $I.annote("GithubReviewThreads", { description: "Every review thread on a pull request." })
) {}

const MAX_THREAD_PAGES = 20;

/**
 * Read every review thread of a pull request over GraphQL, failing (never
 * returning a short list) when a page is missing its cursor or the page cap
 * is reached. Callers guard this with `GraphqlBudget`.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readGithubReviewThreads } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readGithubReviewThreads(1))) // true
 * ```
 *
 * @param number - The pull request number.
 * @returns The threads and the pull request author.
 * @category reads
 * @since 0.0.0
 */
export const readGithubReviewThreads = Effect.fn("GithubGraphql.readReviewThreads")(function* (number: number) {
  const client = yield* GitHubClient;
  const repo = yield* Repo;
  let cursor: string | null = null;
  let threads = A.empty<GithubReviewThreadNode>();
  let author = O.none<string>();
  for (let page = 0; page < MAX_THREAD_PAGES; page++) {
    const data: typeof ReviewThreadsData.Type = yield* client
      .graphql(reviewThreadsPageDocument, { owner: repo.owner, name: repo.repo, number, cursor })
      .pipe(Effect.mapError(graphqlErrorToGitHubError));
    const pullRequest = data.repository.pullRequest;
    author = O.map(O.fromNullishOr(pullRequest.author), (actor) => actor.login);
    threads = A.appendAll(threads, pullRequest.reviewThreads.nodes);
    const info = pullRequest.reviewThreads.pageInfo;
    if (!info.hasNextPage) return GithubReviewThreads.make({ author, threads });
    if (info.endCursor === null) {
      return yield* GitHubError.decode("pullRequestReviewThreads", "another page was reported without an end cursor");
    }
    cursor = info.endCursor;
  }
  return yield* GitHubError.decode("pullRequestReviewThreads", `more than ${MAX_THREAD_PAGES} pages of review threads`);
});
