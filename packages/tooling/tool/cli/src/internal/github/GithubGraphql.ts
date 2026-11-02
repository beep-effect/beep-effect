/**
 * The GraphQL-only pull-request operations, as typed `@beep/github`
 * documents.
 *
 * **Details**
 *
 * Flipping a draft to ready (`markPullRequestReadyForReview`) has no REST
 * equivalent and no `@beep/github` member, so its document lives here and is
 * spent through `GraphqlBudget.guard`. Review threads moved to the kit's
 * `ReviewThread` resource (W4); everything else goes through `GithubRest`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitHubError } from "@beep/github/GitHubError";
import { GraphQLDocument } from "@beep/github/GraphQL";
import * as OptionUtils from "@beep/utils/Option";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { GitHubGraphQLError } from "@beep/github/GraphQL";

/**
 * Fold a GraphQL failure into the one `GitHubError` taxonomy (same `kind`
 * literals), so callers handle a single error type.
 *
 * **Example** (Fold a rate-limit failure)
 *
 * ```ts
 * import { graphqlErrorToGitHubError } from "@beep/repo-cli/test/SharedInternals"
 * import { GitHubGraphQLError } from "@beep/github/GraphQL"
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
    ...OptionUtils.getSomesStruct({ retryAfterMillis: O.fromUndefinedOr(error.retryAfterMillis) }),
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
