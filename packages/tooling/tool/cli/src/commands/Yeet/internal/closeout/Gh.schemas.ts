/**
 * GitHub GraphQL schemas and decoders for Yeet closeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { GhActor, GhComment, GhPageInfo, GhPrView } from "../../../../internal/github/index.ts";
import type * as SchemaAST from "effect/SchemaAST";

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
export class GhRepoOwner extends S.Opaque<GhRepoOwner, { readonly brand: unique symbol }>()(
  S.Struct({
    login: S.String,
  }).pipe(
    $I.annoteSchema("GhRepoOwner", {
      description: "GitHub repository owner.",
    })
  )
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
export class GhRepoView extends S.Opaque<GhRepoView, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    owner: GhRepoOwner,
  }).pipe(
    $I.annoteSchema("GhRepoView", {
      description: "GitHub repository metadata for GraphQL queries.",
    })
  )
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
export class GhInlineReviewComment extends S.Opaque<GhInlineReviewComment, { readonly brand: unique symbol }>()(
  S.Struct({
    author: S.NullOr(GhActor),
    body: S.String,
    id: S.String,
    line: S.NullOr(S.Finite),
    path: S.NullOr(S.String),
    url: S.String,
  }).pipe(
    $I.annoteSchema("GhInlineReviewComment", {
      description: "Inline review comment returned by GitHub GraphQL.",
    })
  )
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
export class GhInlineReviewCommentConnection extends S.Opaque<
  GhInlineReviewCommentConnection,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    nodes: S.Array(GhInlineReviewComment),
    pageInfo: GhPageInfo,
  }).pipe(
    $I.annoteSchema("GhInlineReviewCommentConnection", {
      description: "Inline review comment connection.",
    })
  )
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
export class GhReviewThreadCommentConnection extends S.Opaque<
  GhReviewThreadCommentConnection,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    nodes: S.Array(GhComment),
    pageInfo: GhPageInfo,
  }).pipe(
    $I.annoteSchema("GhReviewThreadCommentConnection", {
      description: "Review thread comment connection.",
    })
  )
) {}

/**
 * One review-thread comment reduced to its author and timestamp.
 *
 * **Details**
 *
 * What a `comments(last: 1)` selection returns: the two structural facts the
 * thread-state rule reads about whoever spoke last, plus the body and url the
 * closeout issue quotes as evidence. Every field is optional because GitHub
 * omits an author it no longer knows, and because a payload captured before
 * the selection (or before it carried a body) must keep decoding.
 *
 * **Example** (Name the last speaker)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThreadLatestComment } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = GhReviewThreadLatestComment.make({
 *   author: { __typename: "Bot", login: "coderabbitai" },
 *   createdAt: "2026-09-22T06:11:28Z"
 * })
 *
 * strictEqual(comment.createdAt, "2026-09-22T06:11:28Z")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThreadLatestComment extends S.Opaque<
  GhReviewThreadLatestComment,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    author: GhActor.pipe(S.NullOr, S.optionalKey),
    body: S.optionalKey(S.String),
    createdAt: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("GhReviewThreadLatestComment", {
      description:
        "One review-thread comment reduced to the author and timestamp the thread-state rule reads, plus the body and url quoted as evidence.",
    })
  )
) {}

const ghReviewThreadLatestConnectionNodesDefault = A.empty<GhReviewThreadLatestComment>();
/**
 * The newest-comment connection of one review thread.
 *
 * **Example** (Empty newest-comment connection)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { GhReviewThreadLatestConnection } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(GhReviewThreadLatestConnection.make({ nodes: [] }).nodes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhReviewThreadLatestConnection extends S.Opaque<
  GhReviewThreadLatestConnection,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    nodes: S.Array(GhReviewThreadLatestComment).pipe(
      S.withConstructorDefault(Effect.succeed(ghReviewThreadLatestConnectionNodesDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(ghReviewThreadLatestConnectionNodesDefault))
    ),
  }).pipe(
    $I.annoteSchema("GhReviewThreadLatestConnection", {
      description: "The `comments(last: 1)` connection naming a review thread's newest comment.",
    })
  )
) {}

/**
 * Pull request review thread returned by GitHub GraphQL.
 *
 * **Details**
 *
 * `resolvedBy` is optional because only the queries that classify thread state
 * ask for it. It is the login the pull request author is compared against: a
 * thread the author resolved with a reviewer speaking after them owes a reply,
 * and a thread a reviewer closed themselves owes nothing.
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
export class GhReviewThread extends S.Opaque<GhReviewThread, { readonly brand: unique symbol }>()(
  S.Struct({
    comments: GhReviewThreadCommentConnection,
    id: S.String,
    isOutdated: S.Boolean,
    isResolved: S.Boolean,
    // The thread's newest comment whatever page it sits on, selected as
    // `comments(last: 1)`. Optional so a payload recorded before the selection
    // existed keeps decoding; the first page is the fallback.
    latest: S.optionalKey(GhReviewThreadLatestConnection),
    line: S.NullOr(S.Finite),
    path: S.NullOr(S.String),
    resolvedBy: GhActor.pipe(S.NullOr, S.optionalKey),
  }).pipe(
    $I.annoteSchema("GhReviewThread", {
      description: "Pull request review thread returned by GitHub GraphQL, optionally naming who resolved it.",
    })
  )
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
export class GhReviewThreadConnection extends S.Opaque<GhReviewThreadConnection, { readonly brand: unique symbol }>()(
  S.Struct({
    nodes: S.Array(GhReviewThread),
    pageInfo: GhPageInfo,
  }).pipe(
    $I.annoteSchema("GhReviewThreadConnection", {
      description: "Review thread connection.",
    })
  )
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
export class GhPullRequestCommentConnection extends S.Opaque<
  GhPullRequestCommentConnection,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    nodes: S.Array(GhComment),
    pageInfo: GhPageInfo,
  }).pipe(
    $I.annoteSchema("GhPullRequestCommentConnection", {
      description: "Pull request top-level comment connection.",
    })
  )
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
export class GhReview extends S.Opaque<GhReview, { readonly brand: unique symbol }>()(
  S.Struct({
    author: S.NullOr(GhActor),
    body: S.String,
    comments: GhInlineReviewCommentConnection,
    id: S.String,
    state: S.String,
    submittedAt: S.String.pipe(S.NullOr, S.optionalKey),
  }).pipe(
    $I.annoteSchema("GhReview", {
      description: "Pull request review returned by GitHub GraphQL.",
    })
  )
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
export class GhReviewConnection extends S.Opaque<GhReviewConnection, { readonly brand: unique symbol }>()(
  S.Struct({
    nodes: S.Array(GhReview),
    pageInfo: GhPageInfo,
  }).pipe(
    $I.annoteSchema("GhReviewConnection", {
      description: "Pull request review connection.",
    })
  )
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
export class GhCommentsPullRequest extends S.Opaque<GhCommentsPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    comments: GhPullRequestCommentConnection,
  }).pipe(
    $I.annoteSchema("GhCommentsPullRequest", {
      description: "Pull request top-level comment page payload.",
    })
  )
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
export class GhReviewsPullRequest extends S.Opaque<GhReviewsPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    reviews: GhReviewConnection,
  }).pipe(
    $I.annoteSchema("GhReviewsPullRequest", {
      description: "Pull request review page payload.",
    })
  )
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
export class GhCloseoutPullRequest extends S.Opaque<GhCloseoutPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    comments: GhPullRequestCommentConnection,
    reviewThreads: GhReviewThreadConnection,
    reviews: GhReviewConnection,
  }).pipe(
    $I.annoteSchema("GhCloseoutPullRequest", {
      description: "Pull request GraphQL payload used by Yeet closeout.",
    })
  )
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
export class GhCommentsRepository extends S.Opaque<GhCommentsRepository, { readonly brand: unique symbol }>()(
  S.Struct({
    pullRequest: GhCommentsPullRequest,
  }).pipe(
    $I.annoteSchema("GhCommentsRepository", {
      description: "Repository wrapper for pull request comment page payload.",
    })
  )
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
export class GhReviewsRepository extends S.Opaque<GhReviewsRepository, { readonly brand: unique symbol }>()(
  S.Struct({
    pullRequest: GhReviewsPullRequest,
  }).pipe(
    $I.annoteSchema("GhReviewsRepository", {
      description: "Repository wrapper for pull request review page payload.",
    })
  )
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
export class GhCommentsData extends S.Opaque<GhCommentsData, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: GhCommentsRepository,
  }).pipe(
    $I.annoteSchema("GhCommentsData", {
      description: "GraphQL data wrapper for pull request comment pages.",
    })
  )
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
export class GhReviewsData extends S.Opaque<GhReviewsData, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: GhReviewsRepository,
  }).pipe(
    $I.annoteSchema("GhReviewsData", {
      description: "GraphQL data wrapper for pull request review pages.",
    })
  )
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
export class GhCommentsDocument extends S.Opaque<GhCommentsDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    data: GhCommentsData,
  }).pipe(
    $I.annoteSchema("GhCommentsDocument", {
      description: "GitHub GraphQL response document for pull request comment pages.",
    })
  )
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
export class GhReviewsDocument extends S.Opaque<GhReviewsDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    data: GhReviewsData,
  }).pipe(
    $I.annoteSchema("GhReviewsDocument", {
      description: "GitHub GraphQL response document for pull request review pages.",
    })
  )
) {}

/**
 * Decode `gh pr view` JSON into the shared GitHub pull request schema.
 *
 * **Example** (Decode gh pr view JSON)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
export const decodeGhPrView: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<GhPrView, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<GhPrView, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(GhPrView)));

/**
 * Decode `gh repo view` JSON into repository metadata for GraphQL variables.
 *
 * **Example** (Decode gh repo view JSON)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
export const decodeGhRepoView: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<GhRepoView, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<GhRepoView, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(GhRepoView)));

/**
 * Decode the closeout comments GraphQL document.
 *
 * **Example** (Decode comments GraphQL document)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
export const decodeGhCommentsDocument: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<GhCommentsDocument, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<GhCommentsDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(GhCommentsDocument)));

/**
 * Decode the closeout reviews GraphQL document.
 *
 * **Example** (Decode reviews GraphQL document)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
export const decodeGhReviewsDocument: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<GhReviewsDocument, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<GhReviewsDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(GhReviewsDocument)));

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
