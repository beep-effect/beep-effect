/**
 * GitHub GraphQL schemas and decoders for Yeet closeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { GhActor, GhComment, GhPageInfo, GhPrView } from "../../../../internal/github/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/closeout/Gh.schemas");

/**
 * Repository owner metadata needed for closeout GraphQL calls.
 *
 * **Example** (Make owner from login)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhRepoOwner } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(GhRepoOwner.make({ login: "beep-effect" }).login, "beep-effect")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhRepoOwner extends S.Class<GhRepoOwner>($I`GhRepoOwner`)(
  {
    login: S.String,
  },
  $I.annote("GhRepoOwner", {
    description: "GitHub repository owner.",
  })
) {}

/**
 * Repository metadata returned by `gh repo view`.
 *
 * **Example** (Make repo with owner)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhRepoOwner, GhRepoView } from "@beep/repo-cli/test/Yeet"
 *
 * const repo = GhRepoView.make({ name: "beep-effect", owner: GhRepoOwner.make({ login: "beep-effect" }) })
 *
 * strictEqual(repo.owner.login, "beep-effect")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhRepoView extends S.Class<GhRepoView>($I`GhRepoView`)(
  {
    name: S.String,
    owner: GhRepoOwner,
  },
  $I.annote("GhRepoView", {
    description: "GitHub repository metadata for GraphQL queries.",
  })
) {}

/**
 * Inline review comment returned from a pull request review node.
 *
 * **Example** (Make inline review comment)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhInlineReviewComment } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = GhInlineReviewComment.make({
 *   author: { login: "reviewer" },
 *   body: "Please add a regression test.",
 *   id: "PRRC_1",
 *   line: 42,
 *   path: "src/file.ts",
 *   url: "https://github.com/o/r/pull/1#discussion_r1"
 * })
 *
 * strictEqual(comment.path, "src/file.ts")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhInlineReviewComment extends S.Class<GhInlineReviewComment>($I`GhInlineReviewComment`)(
  {
    author: S.NullOr(GhActor),
    body: S.String,
    id: S.String,
    line: S.NullOr(S.Finite),
    path: S.NullOr(S.String),
    url: S.String,
  },
  $I.annote("GhInlineReviewComment", {
    description: "Inline review comment returned by GitHub GraphQL.",
  })
) {}

/**
 * Paginated inline review comments nested under a pull request review.
 *
 * **Example** (Empty comment connection page)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhInlineReviewCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const connection = GhInlineReviewCommentConnection.make({
 *   nodes: [],
 *   pageInfo: { endCursor: null, hasNextPage: false }
 * })
 *
 * strictEqual(connection.pageInfo.hasNextPage, false)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhInlineReviewCommentConnection extends S.Class<GhInlineReviewCommentConnection>(
  $I`GhInlineReviewCommentConnection`
)(
  {
    nodes: S.Array(GhInlineReviewComment),
    pageInfo: GhPageInfo,
  },
  $I.annote("GhInlineReviewCommentConnection", {
    description: "Inline review comment connection.",
  })
) {}

/**
 * Paginated comments nested under a pull request review thread.
 *
 * **Example** (Empty thread comments page)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThreadCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const connection = GhReviewThreadCommentConnection.make({
 *   nodes: [],
 *   pageInfo: { endCursor: null, hasNextPage: false }
 * })
 *
 * strictEqual(connection.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThreadCommentConnection extends S.Class<GhReviewThreadCommentConnection>(
  $I`GhReviewThreadCommentConnection`
)(
  {
    nodes: S.Array(GhComment),
    pageInfo: GhPageInfo,
  },
  $I.annote("GhReviewThreadCommentConnection", {
    description: "Review thread comment connection.",
  })
) {}

/**
 * Pull request review thread returned by GitHub GraphQL.
 *
 * **Example** (Make unresolved review thread)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThread, GhReviewThreadCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const thread = GhReviewThread.make({
 *   comments: GhReviewThreadCommentConnection.make({
 *     nodes: [],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   }),
 *   id: "PRRT_1",
 *   isOutdated: false,
 *   isResolved: false,
 *   line: 42,
 *   path: "src/file.ts"
 * })
 *
 * strictEqual(thread.isResolved, false)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThread extends S.Class<GhReviewThread>($I`GhReviewThread`)(
  {
    comments: GhReviewThreadCommentConnection,
    id: S.String,
    isOutdated: S.Boolean,
    isResolved: S.Boolean,
    line: S.NullOr(S.Finite),
    path: S.NullOr(S.String),
  },
  $I.annote("GhReviewThread", {
    description: "Pull request review thread returned by GitHub GraphQL.",
  })
) {}

/**
 * Paginated review-thread connection for a pull request.
 *
 * **Example** (Empty review threads page)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThreadConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const connection = GhReviewThreadConnection.make({
 *   nodes: [],
 *   pageInfo: { endCursor: null, hasNextPage: false }
 * })
 *
 * strictEqual(connection.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThreadConnection extends S.Class<GhReviewThreadConnection>($I`GhReviewThreadConnection`)(
  {
    nodes: S.Array(GhReviewThread),
    pageInfo: GhPageInfo,
  },
  $I.annote("GhReviewThreadConnection", {
    description: "Review thread connection.",
  })
) {}

/**
 * Paginated top-level pull request comments.
 *
 * **Example** (Empty PR comments page)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhPullRequestCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const connection = GhPullRequestCommentConnection.make({
 *   nodes: [],
 *   pageInfo: { endCursor: null, hasNextPage: false }
 * })
 *
 * strictEqual(connection.pageInfo.hasNextPage, false)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhPullRequestCommentConnection extends S.Class<GhPullRequestCommentConnection>(
  $I`GhPullRequestCommentConnection`
)(
  {
    nodes: S.Array(GhComment),
    pageInfo: GhPageInfo,
  },
  $I.annote("GhPullRequestCommentConnection", {
    description: "Pull request top-level comment connection.",
  })
) {}

/**
 * Pull request review returned by GitHub GraphQL.
 *
 * **Example** (Make changes-requested review)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhInlineReviewCommentConnection, GhReview } from "@beep/repo-cli/test/Yeet"
 *
 * const review = GhReview.make({
 *   author: { login: "reviewer" },
 *   body: "Changes requested",
 *   comments: GhInlineReviewCommentConnection.make({
 *     nodes: [],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   }),
 *   id: "PRR_1",
 *   state: "CHANGES_REQUESTED",
 *   submittedAt: "2026-07-08T00:00:00Z"
 * })
 *
 * strictEqual(review.state, "CHANGES_REQUESTED")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReview extends S.Class<GhReview>($I`GhReview`)(
  {
    author: S.NullOr(GhActor),
    body: S.String,
    comments: GhInlineReviewCommentConnection,
    id: S.String,
    state: S.String,
    submittedAt: S.String.pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("GhReview", {
    description: "Pull request review returned by GitHub GraphQL.",
  })
) {}

/**
 * Paginated pull request reviews.
 *
 * **Example** (Empty reviews connection page)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const connection = GhReviewConnection.make({
 *   nodes: [],
 *   pageInfo: { endCursor: null, hasNextPage: false }
 * })
 *
 * strictEqual(connection.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewConnection extends S.Class<GhReviewConnection>($I`GhReviewConnection`)(
  {
    nodes: S.Array(GhReview),
    pageInfo: GhPageInfo,
  },
  $I.annote("GhReviewConnection", {
    description: "Pull request review connection.",
  })
) {}

/**
 * Pull request payload containing one page of top-level comments.
 *
 * **Example** (PR with empty comments)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhCommentsPullRequest, GhPullRequestCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const pullRequest = GhCommentsPullRequest.make({
 *   comments: GhPullRequestCommentConnection.make({
 *     nodes: [],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   })
 * })
 *
 * strictEqual(pullRequest.comments.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhCommentsPullRequest extends S.Class<GhCommentsPullRequest>($I`GhCommentsPullRequest`)(
  {
    comments: GhPullRequestCommentConnection,
  },
  $I.annote("GhCommentsPullRequest", {
    description: "Pull request top-level comment page payload.",
  })
) {}

/**
 * Pull request payload containing one page of review threads.
 *
 * **Example** (PR with empty review threads)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThreadConnection, GhReviewThreadsPullRequest } from "@beep/repo-cli/test/Yeet"
 *
 * const pullRequest = GhReviewThreadsPullRequest.make({
 *   reviewThreads: GhReviewThreadConnection.make({
 *     nodes: [],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   })
 * })
 *
 * strictEqual(pullRequest.reviewThreads.pageInfo.hasNextPage, false)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThreadsPullRequest extends S.Class<GhReviewThreadsPullRequest>($I`GhReviewThreadsPullRequest`)(
  {
    reviewThreads: GhReviewThreadConnection,
  },
  $I.annote("GhReviewThreadsPullRequest", {
    description: "Pull request review thread page payload.",
  })
) {}

/**
 * Pull request payload containing one page of reviews.
 *
 * **Example** (PR with empty reviews)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewConnection, GhReviewsPullRequest } from "@beep/repo-cli/test/Yeet"
 *
 * const pullRequest = GhReviewsPullRequest.make({
 *   reviews: GhReviewConnection.make({
 *     nodes: [],
 *     pageInfo: { endCursor: null, hasNextPage: false }
 *   })
 * })
 *
 * strictEqual(pullRequest.reviews.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewsPullRequest extends S.Class<GhReviewsPullRequest>($I`GhReviewsPullRequest`)(
  {
    reviews: GhReviewConnection,
  },
  $I.annote("GhReviewsPullRequest", {
    description: "Pull request review page payload.",
  })
) {}

/**
 * Combined pull request payload used after closeout pagination finishes.
 *
 * **Example** (Combined empty closeout payload)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import {
 *   GhCloseoutPullRequest,
 *   GhPullRequestCommentConnection,
 *   GhReviewConnection,
 *   GhReviewThreadConnection
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const pageInfo = { endCursor: null, hasNextPage: false }
 * const pullRequest = GhCloseoutPullRequest.make({
 *   comments: GhPullRequestCommentConnection.make({ nodes: [], pageInfo }),
 *   reviewThreads: GhReviewThreadConnection.make({ nodes: [], pageInfo }),
 *   reviews: GhReviewConnection.make({ nodes: [], pageInfo })
 * })
 *
 * strictEqual(pullRequest.reviews.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhCloseoutPullRequest extends S.Class<GhCloseoutPullRequest>($I`GhCloseoutPullRequest`)(
  {
    comments: GhPullRequestCommentConnection,
    reviewThreads: GhReviewThreadConnection,
    reviews: GhReviewConnection,
  },
  $I.annote("GhCloseoutPullRequest", {
    description: "Pull request GraphQL payload used by Yeet closeout.",
  })
) {}

/**
 * Repository wrapper for pull request comment page GraphQL responses.
 *
 * **Example** (Repo wrapper for comments)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhCommentsPullRequest, GhCommentsRepository, GhPullRequestCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const repository = GhCommentsRepository.make({
 *   pullRequest: GhCommentsPullRequest.make({
 *     comments: GhPullRequestCommentConnection.make({
 *       nodes: [],
 *       pageInfo: { endCursor: null, hasNextPage: false }
 *     })
 *   })
 * })
 *
 * strictEqual(repository.pullRequest.comments.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhCommentsRepository extends S.Class<GhCommentsRepository>($I`GhCommentsRepository`)(
  {
    pullRequest: GhCommentsPullRequest,
  },
  $I.annote("GhCommentsRepository", {
    description: "Repository wrapper for pull request comment page payload.",
  })
) {}

/**
 * Repository wrapper for pull request review-thread page GraphQL responses.
 *
 * **Example** (Repo wrapper for threads)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThreadConnection, GhReviewThreadsPullRequest, GhReviewThreadsRepository } from "@beep/repo-cli/test/Yeet"
 *
 * const repository = GhReviewThreadsRepository.make({
 *   pullRequest: GhReviewThreadsPullRequest.make({
 *     reviewThreads: GhReviewThreadConnection.make({
 *       nodes: [],
 *       pageInfo: { endCursor: null, hasNextPage: false }
 *     })
 *   })
 * })
 *
 * strictEqual(repository.pullRequest.reviewThreads.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThreadsRepository extends S.Class<GhReviewThreadsRepository>($I`GhReviewThreadsRepository`)(
  {
    pullRequest: GhReviewThreadsPullRequest,
  },
  $I.annote("GhReviewThreadsRepository", {
    description: "Repository wrapper for pull request review thread page payload.",
  })
) {}

/**
 * Repository wrapper for pull request review page GraphQL responses.
 *
 * **Example** (Repo wrapper for reviews)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewConnection, GhReviewsPullRequest, GhReviewsRepository } from "@beep/repo-cli/test/Yeet"
 *
 * const repository = GhReviewsRepository.make({
 *   pullRequest: GhReviewsPullRequest.make({
 *     reviews: GhReviewConnection.make({
 *       nodes: [],
 *       pageInfo: { endCursor: null, hasNextPage: false }
 *     })
 *   })
 * })
 *
 * strictEqual(repository.pullRequest.reviews.pageInfo.hasNextPage, false)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewsRepository extends S.Class<GhReviewsRepository>($I`GhReviewsRepository`)(
  {
    pullRequest: GhReviewsPullRequest,
  },
  $I.annote("GhReviewsRepository", {
    description: "Repository wrapper for pull request review page payload.",
  })
) {}

/**
 * GraphQL `data` wrapper for pull request comment pages.
 *
 * **Example** (Comments GraphQL data wrapper)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhCommentsData, GhCommentsPullRequest, GhCommentsRepository, GhPullRequestCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const data = GhCommentsData.make({
 *   repository: GhCommentsRepository.make({
 *     pullRequest: GhCommentsPullRequest.make({
 *       comments: GhPullRequestCommentConnection.make({
 *         nodes: [],
 *         pageInfo: { endCursor: null, hasNextPage: false }
 *       })
 *     })
 *   })
 * })
 *
 * strictEqual(data.repository.pullRequest.comments.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhCommentsData extends S.Class<GhCommentsData>($I`GhCommentsData`)(
  {
    repository: GhCommentsRepository,
  },
  $I.annote("GhCommentsData", {
    description: "GraphQL data wrapper for pull request comment pages.",
  })
) {}

/**
 * GraphQL `data` wrapper for pull request review-thread pages.
 *
 * **Example** (Threads GraphQL data wrapper)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import {
 *   GhReviewThreadConnection,
 *   GhReviewThreadsData,
 *   GhReviewThreadsPullRequest,
 *   GhReviewThreadsRepository
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const data = GhReviewThreadsData.make({
 *   repository: GhReviewThreadsRepository.make({
 *     pullRequest: GhReviewThreadsPullRequest.make({
 *       reviewThreads: GhReviewThreadConnection.make({
 *         nodes: [],
 *         pageInfo: { endCursor: null, hasNextPage: false }
 *       })
 *     })
 *   })
 * })
 *
 * strictEqual(data.repository.pullRequest.reviewThreads.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThreadsData extends S.Class<GhReviewThreadsData>($I`GhReviewThreadsData`)(
  {
    repository: GhReviewThreadsRepository,
  },
  $I.annote("GhReviewThreadsData", {
    description: "GraphQL data wrapper for pull request review thread pages.",
  })
) {}

/**
 * GraphQL `data` wrapper for pull request review pages.
 *
 * **Example** (Reviews GraphQL data wrapper)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewConnection, GhReviewsData, GhReviewsPullRequest, GhReviewsRepository } from "@beep/repo-cli/test/Yeet"
 *
 * const data = GhReviewsData.make({
 *   repository: GhReviewsRepository.make({
 *     pullRequest: GhReviewsPullRequest.make({
 *       reviews: GhReviewConnection.make({
 *         nodes: [],
 *         pageInfo: { endCursor: null, hasNextPage: false }
 *       })
 *     })
 *   })
 * })
 *
 * strictEqual(data.repository.pullRequest.reviews.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewsData extends S.Class<GhReviewsData>($I`GhReviewsData`)(
  {
    repository: GhReviewsRepository,
  },
  $I.annote("GhReviewsData", {
    description: "GraphQL data wrapper for pull request review pages.",
  })
) {}

/**
 * Complete GraphQL response document for pull request comment pages.
 *
 * **Example** (Full comments response document)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import {
 *   GhCommentsData,
 *   GhCommentsDocument,
 *   GhCommentsPullRequest,
 *   GhCommentsRepository,
 *   GhPullRequestCommentConnection
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const document = GhCommentsDocument.make({
 *   data: GhCommentsData.make({
 *     repository: GhCommentsRepository.make({
 *       pullRequest: GhCommentsPullRequest.make({
 *         comments: GhPullRequestCommentConnection.make({
 *           nodes: [],
 *           pageInfo: { endCursor: null, hasNextPage: false }
 *         })
 *       })
 *     })
 *   })
 * })
 *
 * strictEqual(document.data.repository.pullRequest.comments.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhCommentsDocument extends S.Class<GhCommentsDocument>($I`GhCommentsDocument`)(
  {
    data: GhCommentsData,
  },
  $I.annote("GhCommentsDocument", {
    description: "GitHub GraphQL response document for pull request comment pages.",
  })
) {}

/**
 * Complete GraphQL response document for pull request review-thread pages.
 *
 * **Example** (Full threads response document)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import {
 *   GhReviewThreadConnection,
 *   GhReviewThreadsData,
 *   GhReviewThreadsDocument,
 *   GhReviewThreadsPullRequest,
 *   GhReviewThreadsRepository
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const document = GhReviewThreadsDocument.make({
 *   data: GhReviewThreadsData.make({
 *     repository: GhReviewThreadsRepository.make({
 *       pullRequest: GhReviewThreadsPullRequest.make({
 *         reviewThreads: GhReviewThreadConnection.make({
 *           nodes: [],
 *           pageInfo: { endCursor: null, hasNextPage: false }
 *         })
 *       })
 *     })
 *   })
 * })
 *
 * strictEqual(document.data.repository.pullRequest.reviewThreads.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThreadsDocument extends S.Class<GhReviewThreadsDocument>($I`GhReviewThreadsDocument`)(
  {
    data: GhReviewThreadsData,
  },
  $I.annote("GhReviewThreadsDocument", {
    description: "GitHub GraphQL response document for pull request review thread pages.",
  })
) {}

/**
 * Complete GraphQL response document for pull request review pages.
 *
 * **Example** (Full reviews response document)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import {
 *   GhReviewConnection,
 *   GhReviewsData,
 *   GhReviewsDocument,
 *   GhReviewsPullRequest,
 *   GhReviewsRepository
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const document = GhReviewsDocument.make({
 *   data: GhReviewsData.make({
 *     repository: GhReviewsRepository.make({
 *       pullRequest: GhReviewsPullRequest.make({
 *         reviews: GhReviewConnection.make({
 *           nodes: [],
 *           pageInfo: { endCursor: null, hasNextPage: false }
 *         })
 *       })
 *     })
 *   })
 * })
 *
 * strictEqual(document.data.repository.pullRequest.reviews.nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewsDocument extends S.Class<GhReviewsDocument>($I`GhReviewsDocument`)(
  {
    data: GhReviewsData,
  },
  $I.annote("GhReviewsDocument", {
    description: "GitHub GraphQL response document for pull request review pages.",
  })
) {}

/**
 * Decode `gh pr view` JSON into the shared GitHub pull request schema.
 *
 * **Example** (Decode gh pr view JSON)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeGhPrView } from "@beep/repo-cli/test/Yeet"
 *
 * const number = decodeGhPrView(JSON.stringify({ headRefName: "feature", number: 1, state: "OPEN" })).pipe(
 *   Effect.map((view) => view.number)
 * )
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeGhPrView = S.decodeUnknownEffect(S.fromJsonString(GhPrView));

/**
 * Decode `gh repo view` JSON into repository metadata for GraphQL variables.
 *
 * **Example** (Decode gh repo view JSON)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeGhRepoView } from "@beep/repo-cli/test/Yeet"
 *
 * const owner = decodeGhRepoView(JSON.stringify({ name: "repo", owner: { login: "org" } })).pipe(
 *   Effect.map((repo) => repo.owner.login)
 * )
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeGhRepoView = S.decodeUnknownEffect(S.fromJsonString(GhRepoView));

/**
 * Decode the closeout comments GraphQL document.
 *
 * **Example** (Decode comments GraphQL document)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeGhCommentsDocument } from "@beep/repo-cli/test/Yeet"
 *
 * const documentJson = JSON.stringify({
 *   data: {
 *     repository: {
 *       pullRequest: {
 *         comments: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } }
 *       }
 *     }
 *   }
 * })
 * const commentCount = decodeGhCommentsDocument(documentJson).pipe(
 *   Effect.map((document) => document.data.repository.pullRequest.comments.nodes.length)
 * )
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeGhCommentsDocument = S.decodeUnknownEffect(S.fromJsonString(GhCommentsDocument));

/**
 * Decode the closeout review-thread GraphQL document.
 *
 * **Example** (Decode threads GraphQL document)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeGhReviewThreadsDocument } from "@beep/repo-cli/test/Yeet"
 *
 * const documentJson = JSON.stringify({
 *   data: {
 *     repository: {
 *       pullRequest: {
 *         reviewThreads: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } }
 *       }
 *     }
 *   }
 * })
 * const threadCount = decodeGhReviewThreadsDocument(documentJson).pipe(
 *   Effect.map((document) => document.data.repository.pullRequest.reviewThreads.nodes.length)
 * )
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeGhReviewThreadsDocument = S.decodeUnknownEffect(S.fromJsonString(GhReviewThreadsDocument));

/**
 * Decode the closeout reviews GraphQL document.
 *
 * **Example** (Decode reviews GraphQL document)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeGhReviewsDocument } from "@beep/repo-cli/test/Yeet"
 *
 * const documentJson = JSON.stringify({
 *   data: {
 *     repository: {
 *       pullRequest: {
 *         reviews: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } }
 *       }
 *     }
 *   }
 * })
 * const reviewCount = decodeGhReviewsDocument(documentJson).pipe(
 *   Effect.map((document) => document.data.repository.pullRequest.reviews.nodes.length)
 * )
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeGhReviewsDocument = S.decodeUnknownEffect(S.fromJsonString(GhReviewsDocument));

/**
 * GraphQL query for paginating top-level pull request comments.
 *
 * **Example** (Comments page query string)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { commentsPageQuery } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(commentsPageQuery.includes("comments(first: 100"), true)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const commentsPageQuery = `
query YeetPrCloseoutComments($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id body url createdAt author { login } }
      }
    }
  }
}
`;

/**
 * GraphQL query for paginating pull request review threads.
 *
 * **Example** (Review threads page query)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { reviewThreadsPageQuery } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(reviewThreadsPageQuery.includes("reviewThreads(first: 100"), true)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const reviewThreadsPageQuery = `
query YeetPrCloseoutReviewThreads($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { id body url createdAt author { login } }
          }
        }
      }
    }
  }
}
`;

/**
 * GraphQL query for paginating pull request reviews and inline comments.
 *
 * **Example** (Reviews page query string)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { reviewsPageQuery } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(reviewsPageQuery.includes("reviews(first: 100"), true)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const reviewsPageQuery = `
query YeetPrCloseoutReviews($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviews(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          body
          state
          submittedAt
          author { login }
          comments(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { id body url path line author { login } }
          }
        }
      }
    }
  }
}
`;
