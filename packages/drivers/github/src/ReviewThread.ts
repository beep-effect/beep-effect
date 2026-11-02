/**
 * Pull request review threads through GitHub's GraphQL API: every thread with
 * its comments, resolution state and a truncation flag, plus the reply,
 * resolve and unresolve mutations.
 *
 * **Details**
 *
 * REST review comments carry no `isResolved`, so this resource is GraphQL
 * only. `list` walks every page of `reviewThreads(first: 100)` and reads one
 * `comments(first: 100)` page per thread: a thread with more comments comes
 * back with `commentsTruncated` set and is named in one warning per page. The
 * thread's newest comment is read separately (`comments(last: 1)`), so the
 * merge-gate rule in {@link outstanding} sees it even on a truncated thread.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubGraphQLError, GraphQLDocument } from "./GraphQL.ts";
import { Repo } from "./Repo.ts";

const $I = $GithubId.create("ReviewThread");

/**
 * Which side of the diff a review thread is anchored to.
 *
 * **Example** (Validate a diff side)
 *
 * ```ts
 * import { DiffSide } from "@beep/github/ReviewThread";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(DiffSide)("RIGHT")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const DiffSide = LiteralKit(["LEFT", "RIGHT"]).pipe(
  $I.annoteSchema("DiffSide", { description: "Which side of the diff a review thread is anchored to." })
);

/**
 * The values accepted by {@link DiffSide}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type DiffSide = typeof DiffSide.Type;

/**
 * Who wrote a review thread comment, and whether that account is a bot.
 *
 * **Details**
 *
 * GraphQL reports the actor's `__typename`; `isBot` is `true` exactly when it is
 * `"Bot"`. The merge-gate rule needs the distinction: a bot acknowledging a
 * resolved thread owes the author nothing, a human following up does.
 *
 * **Example** (Describe a bot reviewer)
 *
 * ```ts
 * import { ReviewThreadActor } from "@beep/github/ReviewThread";
 *
 * const actor = ReviewThreadActor.make({ login: "greptile-apps", isBot: true });
 * console.log(actor.isBot) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReviewThreadActor extends S.Opaque<ReviewThreadActor, { readonly brand: unique symbol }>()(
  S.Struct({
    login: S.String.pipe($I.annoteKey("ReviewThreadActor.login", { description: "The account's login." })),
    isBot: S.Boolean.pipe(
      $I.annoteKey("ReviewThreadActor.isBot", { description: "Whether GraphQL typed the actor as a `Bot`." })
    ),
  }).pipe(
    $I.annoteSchema("ReviewThreadActor", {
      description: "Who wrote a review thread comment, and whether that account is a bot.",
    })
  )
) {}

/**
 * One comment inside a review thread, carrying both id surfaces.
 *
 * **Details**
 *
 * `id` is the GraphQL node id (`PRRC_...`); `databaseId` is the numeric REST
 * comment id, the only field that joins the two id surfaces. `createdAt` is
 * GitHub's ISO-8601 instant, kept as the string GraphQL returns.
 *
 * **Example** (Construct a thread comment)
 *
 * ```ts
 * import { ReviewThreadComment } from "@beep/github/ReviewThread";
 * import * as O from "effect/Option";
 *
 * const comment = ReviewThreadComment.make({
 *   id: "PRRC_1",
 *   databaseId: O.some(42),
 *   author: O.none(),
 *   body: "nit: rename",
 *   path: "src/a.ts",
 *   line: O.some(3),
 *   originalLine: O.none(),
 *   createdAt: "2026-11-02T00:00:00Z",
 *   url: "https://github.com/acme/app/pull/1#discussion_r42",
 * });
 * console.log(comment.body) // nit: rename
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReviewThreadComment extends S.Opaque<ReviewThreadComment, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe($I.annoteKey("ReviewThreadComment.id", { description: "The GraphQL node id (`PRRC_...`)." })),
    databaseId: S.Option(S.Int).pipe(
      $I.annoteKey("ReviewThreadComment.databaseId", {
        description: "The numeric REST comment id, when GitHub has one.",
      })
    ),
    author: S.Option(ReviewThreadActor).pipe(
      $I.annoteKey("ReviewThreadComment.author", { description: "The author, absent for a deleted account." })
    ),
    body: S.String.pipe($I.annoteKey("ReviewThreadComment.body", { description: "The comment's Markdown body." })),
    path: S.String.pipe($I.annoteKey("ReviewThreadComment.path", { description: "The file the comment is on." })),
    line: S.Option(S.Int).pipe(
      $I.annoteKey("ReviewThreadComment.line", { description: "The line in the current diff, absent when outdated." })
    ),
    originalLine: S.Option(S.Int).pipe(
      $I.annoteKey("ReviewThreadComment.originalLine", { description: "The line in the diff the comment was made on." })
    ),
    createdAt: S.String.pipe(
      $I.annoteKey("ReviewThreadComment.createdAt", { description: "When the comment was created, ISO-8601." })
    ),
    url: S.String.pipe($I.annoteKey("ReviewThreadComment.url", { description: "The comment's web URL." })),
  }).pipe(
    $I.annoteSchema("ReviewThreadComment", {
      description: "One comment inside a review thread, carrying both the GraphQL node id and the REST database id.",
    })
  )
) {}

/**
 * One review thread: its anchor, resolution state, the first page of its
 * comments and whether that page was the whole conversation.
 *
 * **Details**
 *
 * `comments` is the first `comments(first: 100)` page; `commentsTruncated` is
 * that connection's `hasNextPage`. `newestComment` is read separately with
 * `comments(last: 1)`, so it is correct even when the thread is truncated.
 * `resolvedBy` is the login of whoever resolved the thread.
 *
 * **Example** (Construct an unresolved thread)
 *
 * ```ts
 * import { ReviewThreadNode } from "@beep/github/ReviewThread";
 * import * as O from "effect/Option";
 *
 * const thread = ReviewThreadNode.make({
 *   id: "PRRT_1",
 *   isResolved: false,
 *   isOutdated: false,
 *   isCollapsed: false,
 *   path: "src/a.ts",
 *   line: O.some(3),
 *   startLine: O.none(),
 *   diffSide: "RIGHT",
 *   resolvedBy: O.none(),
 *   comments: [],
 *   commentsTruncated: false,
 *   newestComment: O.none(),
 * });
 * console.log(thread.isResolved) // false
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReviewThreadNode extends S.Opaque<ReviewThreadNode, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe($I.annoteKey("ReviewThreadNode.id", { description: "The GraphQL node id (`PRRT_...`)." })),
    isResolved: S.Boolean.pipe(
      $I.annoteKey("ReviewThreadNode.isResolved", { description: "Whether the thread has been resolved." })
    ),
    isOutdated: S.Boolean.pipe(
      $I.annoteKey("ReviewThreadNode.isOutdated", { description: "Whether a later push moved the anchored lines." })
    ),
    isCollapsed: S.Boolean.pipe(
      $I.annoteKey("ReviewThreadNode.isCollapsed", { description: "Whether GitHub shows the thread collapsed." })
    ),
    path: S.String.pipe($I.annoteKey("ReviewThreadNode.path", { description: "The file the thread is on." })),
    line: S.Option(S.Int).pipe(
      $I.annoteKey("ReviewThreadNode.line", {
        description: "The anchored line in the current diff, absent when outdated.",
      })
    ),
    startLine: S.Option(S.Int).pipe(
      $I.annoteKey("ReviewThreadNode.startLine", { description: "The first line of a multi-line anchor." })
    ),
    diffSide: DiffSide.pipe(
      $I.annoteKey("ReviewThreadNode.diffSide", { description: "Which side of the diff the thread is anchored to." })
    ),
    resolvedBy: S.Option(S.String).pipe(
      $I.annoteKey("ReviewThreadNode.resolvedBy", { description: "The login of whoever resolved the thread." })
    ),
    comments: S.Array(ReviewThreadComment).pipe(
      $I.annoteKey("ReviewThreadNode.comments", { description: "The first page (100) of the thread's comments." })
    ),
    commentsTruncated: S.Boolean.pipe(
      $I.annoteKey("ReviewThreadNode.commentsTruncated", {
        description: "Whether the thread has more comments than `comments` holds.",
      })
    ),
    newestComment: S.Option(ReviewThreadComment).pipe(
      $I.annoteKey("ReviewThreadNode.newestComment", {
        description: "The thread's newest comment, read separately so truncation cannot hide it.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ReviewThreadNode", {
      description: "One review thread: anchor, resolution state, first comment page and truncation flag.",
    })
  )
) {}

/**
 * Cursor metadata for one page of review threads.
 *
 * **Example** (The last page)
 *
 * ```ts
 * import { ReviewThreadPageInfo } from "@beep/github/ReviewThread";
 * import * as O from "effect/Option";
 *
 * const info = ReviewThreadPageInfo.make({ hasNextPage: false, endCursor: O.none() });
 * console.log(info.hasNextPage) // false
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReviewThreadPageInfo extends S.Opaque<ReviewThreadPageInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    hasNextPage: S.Boolean.pipe(
      $I.annoteKey("ReviewThreadPageInfo.hasNextPage", { description: "Whether another page follows." })
    ),
    endCursor: S.Option(S.String).pipe(
      $I.annoteKey("ReviewThreadPageInfo.endCursor", { description: "The cursor the next page starts after." })
    ),
  }).pipe($I.annoteSchema("ReviewThreadPageInfo", { description: "Cursor metadata for one page of review threads." }))
) {}

/**
 * One decoded page of a pull request's review threads.
 *
 * **Example** (An empty page)
 *
 * ```ts
 * import { ReviewThreadPage, ReviewThreadPageInfo } from "@beep/github/ReviewThread";
 * import * as O from "effect/Option";
 *
 * const page = ReviewThreadPage.make({
 *   pullRequestAuthor: O.some("octocat"),
 *   threads: [],
 *   pageInfo: ReviewThreadPageInfo.make({ hasNextPage: false, endCursor: O.none() }),
 * });
 * console.log(page.threads.length) // 0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReviewThreadPage extends S.Opaque<ReviewThreadPage, { readonly brand: unique symbol }>()(
  S.Struct({
    pullRequestAuthor: S.Option(S.String).pipe(
      $I.annoteKey("ReviewThreadPage.pullRequestAuthor", { description: "The pull request author's login." })
    ),
    threads: S.Array(ReviewThreadNode).pipe(
      $I.annoteKey("ReviewThreadPage.threads", { description: "The threads on this page, in GitHub's order." })
    ),
    pageInfo: ReviewThreadPageInfo.pipe(
      $I.annoteKey("ReviewThreadPage.pageInfo", { description: "Where this page ends and whether another follows." })
    ),
  }).pipe($I.annoteSchema("ReviewThreadPage", { description: "One decoded page of a pull request's review threads." }))
) {}

/**
 * Every review thread on a pull request, plus the pull request's author.
 *
 * **Details**
 *
 * The author rides along because the merge-gate rule ({@link outstanding})
 * compares it against who resolved each thread and who spoke last.
 *
 * **Example** (A pull request with no threads)
 *
 * ```ts
 * import { ReviewThreads } from "@beep/github/ReviewThread";
 * import * as O from "effect/Option";
 *
 * const read = ReviewThreads.make({ pullRequestAuthor: O.some("octocat"), threads: [] });
 * console.log(read.threads.length) // 0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReviewThreads extends S.Opaque<ReviewThreads, { readonly brand: unique symbol }>()(
  S.Struct({
    pullRequestAuthor: S.Option(S.String).pipe(
      $I.annoteKey("ReviewThreads.pullRequestAuthor", { description: "The pull request author's login." })
    ),
    threads: S.Array(ReviewThreadNode).pipe(
      $I.annoteKey("ReviewThreads.threads", { description: "Every thread, in page order." })
    ),
  }).pipe(
    $I.annoteSchema("ReviewThreads", {
      description: "Every review thread on a pull request, plus the pull request's author.",
    })
  )
) {}

// --- GraphQL wire shapes -----------------------------------------------------
//
// Decoded once per response and projected onto the models above. `null`
// becomes `Option` at this boundary so nothing nullish reaches a caller.

const WireLogin = S.Struct({ login: S.String });

const WireActor = S.Struct({ __typename: S.optionalKey(S.String), login: S.String });

const WireComment = S.Struct({
  id: S.String,
  databaseId: S.OptionFromNullOr(S.Int),
  author: S.OptionFromNullOr(WireActor),
  body: S.String,
  path: S.String,
  line: S.OptionFromNullOr(S.Int),
  originalLine: S.OptionFromNullOr(S.Int),
  createdAt: S.String,
  url: S.String,
});

const WirePageInfo = S.Struct({ hasNextPage: S.Boolean, endCursor: S.OptionFromNullOr(S.String) });

const WireThread = S.Struct({
  id: S.String,
  isResolved: S.Boolean,
  isOutdated: S.Boolean,
  isCollapsed: S.Boolean,
  path: S.String,
  line: S.OptionFromNullOr(S.Int),
  startLine: S.OptionFromNullOr(S.Int),
  diffSide: DiffSide,
  resolvedBy: S.OptionFromNullOr(WireLogin),
  comments: S.Struct({ pageInfo: WirePageInfo, nodes: S.Array(WireComment) }),
  latest: S.Struct({ nodes: S.Array(WireComment) }),
});

const WireConnection = S.Struct({ pageInfo: WirePageInfo, nodes: S.Array(WireThread) });

const ListResponse = S.Struct({
  repository: S.Struct({
    pullRequest: S.Struct({ author: S.OptionFromNullOr(WireLogin), reviewThreads: WireConnection }),
  }),
});

// `node(id:)` answers `{ __typename }` alone when the id is not a pull request,
// so the pull-request fields are optional keys here and absent means "wrong kind".
const NodeResponse = S.Struct({
  node: S.OptionFromNullOr(
    S.Struct({
      __typename: S.String,
      author: WireLogin.pipe(S.NullOr, S.optionalKey),
      reviewThreads: S.optionalKey(WireConnection),
    })
  ),
});

const COMMENT_FIELDS = "id databaseId author { __typename login } body path line originalLine createdAt url";

/** The `reviewThreads` connection selection both list documents share. */
const THREAD_CONNECTION = `pageInfo { hasNextPage endCursor }
      nodes {
        id isResolved isOutdated isCollapsed path line startLine diffSide
        resolvedBy { login }
        comments(first: 100) { pageInfo { hasNextPage endCursor } nodes { ${COMMENT_FIELDS} } }
        latest: comments(last: 1) { nodes { ${COMMENT_FIELDS} } }
      }`;

const ListDocument = GraphQLDocument.make({
  name: "pullRequestReviewThreads",
  document: `query ($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      author { login }
      reviewThreads(first: 100, after: $after) { ${THREAD_CONNECTION} }
    }
  }
}`,
  response: ListResponse,
})<{ readonly owner: string; readonly name: string; readonly number: number; readonly after?: string }>();

const NodeDocument = GraphQLDocument.make({
  name: "pullRequestReviewThreadsByNodeId",
  document: `query ($id: ID!, $after: String) {
  node(id: $id) {
    __typename
    ... on PullRequest {
      author { login }
      reviewThreads(first: 100, after: $after) { ${THREAD_CONNECTION} }
    }
  }
}`,
  response: NodeResponse,
})<{ readonly id: string; readonly after?: string }>();

const ReplyDocument = GraphQLDocument.make({
  name: "addPullRequestReviewThreadReply",
  document: `mutation ($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
    comment { ${COMMENT_FIELDS} }
  }
}`,
  response: S.Struct({ addPullRequestReviewThreadReply: S.Struct({ comment: S.OptionFromNullOr(WireComment) }) }),
})<{ readonly threadId: string; readonly body: string }>();

const ResolutionResponse = S.Struct({
  result: S.Struct({ thread: S.OptionFromNullOr(S.Struct({ id: S.String, isResolved: S.Boolean })) }),
});

/** `resolveReviewThread` and `unresolveReviewThread` differ only in the field name; the alias keeps one response schema. */
const resolutionDocument = (field: "resolveReviewThread" | "unresolveReviewThread") =>
  GraphQLDocument.make({
    name: field,
    document: `mutation ($threadId: ID!) {
  result: ${field}(input: { threadId: $threadId }) { thread { id isResolved } }
}`,
    response: ResolutionResponse,
  })<{ readonly threadId: string }>();

const ResolveDocument = resolutionDocument("resolveReviewThread");
const UnresolveDocument = resolutionDocument("unresolveReviewThread");

// --- Projections -------------------------------------------------------------

const actorOf = (actor: typeof WireActor.Type): ReviewThreadActor =>
  ReviewThreadActor.make({ login: actor.login, isBot: actor.__typename === "Bot" });

const commentOf = (wire: typeof WireComment.Type): ReviewThreadComment =>
  ReviewThreadComment.make({ ...wire, author: O.map(wire.author, actorOf) });

const threadOf = (wire: typeof WireThread.Type): ReviewThreadNode =>
  ReviewThreadNode.make({
    id: wire.id,
    isResolved: wire.isResolved,
    isOutdated: wire.isOutdated,
    isCollapsed: wire.isCollapsed,
    path: wire.path,
    line: wire.line,
    startLine: wire.startLine,
    diffSide: wire.diffSide,
    resolvedBy: O.map(wire.resolvedBy, loginOf),
    comments: A.map(wire.comments.nodes, commentOf),
    commentsTruncated: wire.comments.pageInfo.hasNextPage,
    newestComment: O.map(A.last(wire.latest.nodes), commentOf),
  });

const pageOf = (pullRequestAuthor: O.Option<string>, connection: typeof WireConnection.Type): ReviewThreadPage =>
  ReviewThreadPage.make({
    pullRequestAuthor,
    threads: A.map(connection.nodes, threadOf),
    pageInfo: ReviewThreadPageInfo.make(connection.pageInfo),
  });

const loginOf = (actor: typeof WireLogin.Type): string => actor.login;

/** The warning `list` logs once per page naming every thread whose comments were cut at 100. */
const truncationWarning = (threadIds: A.NonEmptyReadonlyArray<string>): string =>
  `Review thread(s) ${A.join(threadIds, ", ")} have more than 100 comments; ReviewThread reads only the first 100 comments per thread, so those threads are returned with commentsTruncated set.`;

const warnTruncated = (page: ReviewThreadPage): Effect.Effect<void> =>
  pipe(
    page.threads,
    A.filter((thread) => thread.commentsTruncated),
    A.map((thread) => thread.id),
    A.match({
      onEmpty: () => Effect.void,
      onNonEmpty: (threadIds) =>
        Effect.logWarning(truncationWarning(threadIds)).pipe(Effect.annotateLogs({ truncatedThreadIds: threadIds })),
    })
  );

/**
 * Walk every page, warning per page about truncated threads, until GitHub
 * reports no next page. A next page without a (non-empty) cursor, or one naming
 * the cursor the page was read from, is a malformed answer.
 */
const collectPages = Effect.fn("ReviewThread.collectPages")(function* <E>(
  operation: string,
  fetchPage: (after: O.Option<string>) => Effect.Effect<ReviewThreadPage, E>
) {
  let after = O.none<string>();
  let threads = A.empty<ReviewThreadNode>();
  while (true) {
    const page = yield* fetchPage(after);
    yield* warnTruncated(page);
    threads = A.appendAll(threads, page.threads);
    if (!page.pageInfo.hasNextPage) {
      return ReviewThreads.make({ pullRequestAuthor: page.pullRequestAuthor, threads });
    }
    // An empty cursor names no position, so it is as missing as a null one.
    const endCursor = O.filter(page.pageInfo.endCursor, Str.isNonEmpty);
    if (O.isNone(endCursor)) {
      return yield* GitHubGraphQLError.decode(operation, "another page was reported without an end cursor");
    }
    // A page naming its own cursor as the next one would re-read the same
    // hundred threads forever and count each of them once per lap.
    if (O.contains(after, endCursor.value)) {
      return yield* GitHubGraphQLError.decode(operation, "the same end cursor was reported twice");
    }
    after = endCursor;
  }
});

// --- The outstanding rule ----------------------------------------------------

/**
 * The follow-up on a resolved thread: the newest comment's author when the
 * pull request author resolved the thread and someone else spoke last.
 */
const followUp: {
  (thread: ReviewThreadNode, pullRequestAuthor: O.Option<string>): O.Option<ReviewThreadActor>;
  (pullRequestAuthor: O.Option<string>): (thread: ReviewThreadNode) => O.Option<ReviewThreadActor>;
} = dual(
  2,
  (thread: ReviewThreadNode, pullRequestAuthor: O.Option<string>): O.Option<ReviewThreadActor> =>
    pipe(
      O.all({ author: pullRequestAuthor, resolvedBy: thread.resolvedBy }),
      O.filter(({ author, resolvedBy }) => Str.Equivalence(author, resolvedBy)),
      O.flatMap(({ author }) =>
        pipe(
          thread.newestComment,
          O.flatMap((comment) => comment.author),
          O.filter((actor) => !Str.Equivalence(actor.login, author))
        )
      )
    )
);

/**
 * Whether a thread still owes the pull request work before a merge.
 *
 * **Details**
 *
 * The rule the Yeet merge gate and readiness monitor apply (`countOutstandingThreads`):
 *
 * - an unresolved thread is outstanding, outdated or not;
 * - a resolved thread is outstanding only when the pull request author
 *   resolved it and the newest comment is a later **human** follow-up by someone
 *   else (`resolved-follow-up`);
 * - a bot's later comment is an acknowledgement, never outstanding; a thread
 *   resolved by a reviewer, or whose last word is the author's, owes nothing;
 * - with no known pull request author the resolution stands.
 *
 * **Example** (An unresolved thread is outstanding)
 *
 * ```ts
 * import { isOutstanding, ReviewThreadNode } from "@beep/github/ReviewThread";
 * import * as O from "effect/Option";
 *
 * const thread = ReviewThreadNode.make({
 *   id: "PRRT_1",
 *   isResolved: false,
 *   isOutdated: true,
 *   isCollapsed: false,
 *   path: "src/a.ts",
 *   line: O.none(),
 *   startLine: O.none(),
 *   diffSide: "RIGHT",
 *   resolvedBy: O.none(),
 *   comments: [],
 *   commentsTruncated: false,
 *   newestComment: O.none(),
 * });
 * console.log(isOutstanding(thread, O.some("octocat"))) // true
 * ```
 *
 * @param thread - The thread to classify.
 * @param pullRequestAuthor - The pull request author's login, when known.
 * @returns `true` when the thread blocks a merge.
 * @public
 * @category predicates
 * @since 0.0.0
 */
export const isOutstanding: {
  (thread: ReviewThreadNode, pullRequestAuthor: O.Option<string>): boolean;
  (pullRequestAuthor: O.Option<string>): (thread: ReviewThreadNode) => boolean;
} = dual(
  2,
  (thread: ReviewThreadNode, pullRequestAuthor: O.Option<string>): boolean =>
    !thread.isResolved || O.exists(followUp(thread, pullRequestAuthor), (actor) => !actor.isBot)
);

/**
 * Count the threads that block a merge, by the {@link isOutstanding} rule.
 *
 * **Example** (No threads, nothing outstanding)
 *
 * ```ts
 * import { outstanding, ReviewThreads } from "@beep/github/ReviewThread";
 * import * as O from "effect/Option";
 *
 * console.log(outstanding(ReviewThreads.make({ pullRequestAuthor: O.none(), threads: [] }))) // 0
 * ```
 *
 * @param read - The threads and the pull request author, as `list` returns them.
 * @returns How many threads are outstanding.
 * @public
 * @category utilities
 * @since 0.0.0
 */
export const outstanding = (read: ReviewThreads): number =>
  A.length(A.filter(read.threads, isOutstanding(read.pullRequestAuthor)));

// --- The service -------------------------------------------------------------

/**
 * List a pull request's review threads and reply to, resolve or unresolve one.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ReviewThreadShape {
  /**
   * Every review thread on the pull request, by number.
   *
   * **Details**
   *
   * Walks every page of `reviewThreads(first: 100)`. Each thread carries its
   * first 100 comments; a thread with more is returned with
   * `commentsTruncated` and named in one warning per page.
   *
   * @since 0.0.0
   */
  readonly list: (pullNumber: number) => Effect.Effect<ReviewThreads, GitHubGraphQLError, Repo>;
  /**
   * Every review thread on the pull request, by its GraphQL node id.
   *
   * **Details**
   *
   * The `node(id:)` form for callers that already hold the pull request's
   * node id (`PullRequestInfo.nodeId`); it needs no `Repo`. Same walk and
   * truncation contract as `list`. A node that is not a pull request fails
   * with `kind: "notFound"`.
   *
   * @since 0.0.0
   */
  readonly listByNodeId: (pullRequestNodeId: string) => Effect.Effect<ReviewThreads, GitHubGraphQLError>;
  /**
   * Reply to a thread; answers with the new comment.
   *
   * **Details**
   *
   * A blank body (empty or whitespace only) is refused before any request is
   * made, as `kind: "rejected"`.
   *
   * @since 0.0.0
   */
  readonly reply: {
    (threadId: string, body: string): Effect.Effect<ReviewThreadComment, GitHubGraphQLError>;
    (body: string): (threadId: string) => Effect.Effect<ReviewThreadComment, GitHubGraphQLError>;
  };
  /**
   * Resolve a thread; answers with its new `isResolved`.
   *
   * @since 0.0.0
   */
  readonly resolve: (threadId: string) => Effect.Effect<boolean, GitHubGraphQLError>;
  /**
   * Unresolve a thread; answers with its new `isResolved`.
   *
   * @since 0.0.0
   */
  readonly unresolve: (threadId: string) => Effect.Effect<boolean, GitHubGraphQLError>;
}

/**
 * Pull request review threads: list them with their comments and resolution
 * state, reply, resolve and unresolve.
 *
 * **Details**
 *
 * Provide it with {@link ReviewThread.layer}, which needs a `GitHubClient`;
 * `list` also needs a `Repo` in `R`. Every failure is a `GitHubGraphQLError`.
 *
 * **Example** (Count the threads that hold a merge)
 *
 * ```ts
 * import { outstanding, ReviewThread } from "@beep/github/ReviewThread";
 * import * as Effect from "effect/Effect";
 *
 * const gate = (pullNumber: number) =>
 *   Effect.gen(function* () {
 *     const threads = yield* ReviewThread;
 *     return outstanding(yield* threads.list(pullNumber));
 *   });
 * console.log(Effect.isEffect(gate(1))) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class ReviewThread extends Context.Service<ReviewThread, ReviewThreadShape>()($I`ReviewThread`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Construct the live service layer)
   *
   * ```ts
   * import { ReviewThread } from "@beep/github/ReviewThread";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(ReviewThread.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<ReviewThread, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub one service operation)
   *
   * ```ts
   * import { ReviewThread } from "@beep/github/ReviewThread";
   * import * as Effect from "effect/Effect";
   *
   * const service = ReviewThread.makeTest({ resolve: () => Effect.succeed(true) });
   * console.log(Effect.isEffect(service.resolve("PRRT_1"))) // true
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<ReviewThreadShape> = {}): ReviewThreadShape => ({
    list: overrides.list ?? (() => unstubbed("list")),
    listByNodeId: overrides.listByNodeId ?? (() => unstubbed("listByNodeId")),
    reply: overrides.reply ?? (() => unstubbed("reply")),
    resolve: overrides.resolve ?? (() => unstubbed("resolve")),
    unresolve: overrides.unresolve ?? (() => unstubbed("unresolve")),
  });

  /**
   * {@link ReviewThread.makeTest} behind a `Layer`.
   *
   * **Example** (Construct a test service layer)
   *
   * ```ts
   * import { ReviewThread } from "@beep/github/ReviewThread";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(ReviewThread.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<ReviewThreadShape> = {}): Layer.Layer<ReviewThread> =>
    Layer.succeed(ReviewThread, ReviewThread.makeTest(overrides));
}

const unstubbed = unstubbedFor({ service: "ReviewThread" });

const isBlank = (body: string): boolean => Str.isEmpty(Str.trim(body));

const make = (client: GitHubClient["Service"]): ReviewThreadShape => {
  const resolution = (document: typeof ResolveDocument, threadId: string) =>
    client.graphql(document, { threadId }).pipe(
      Effect.flatMap((data) =>
        Effect.fromOption(
          O.map(data.result.thread, (thread) => thread.isResolved),
          () => GitHubGraphQLError.decode(document.name, "GitHub returned no thread for the mutation")
        )
      )
    );

  return {
    list: Effect.fn("ReviewThread.list")(function* (pullNumber: number) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, pullNumber });
      return yield* collectPages(ListDocument.name, (after) =>
        client
          .graphql(ListDocument, { owner, name: repo, number: pullNumber, ...O.getSomesStruct({ after }) })
          .pipe(
            Effect.map(({ repository: { pullRequest } }) =>
              pageOf(O.map(pullRequest.author, loginOf), pullRequest.reviewThreads)
            )
          )
      );
    }),

    listByNodeId: Effect.fn("ReviewThread.listByNodeId")(function* (pullRequestNodeId: string) {
      yield* Effect.annotateCurrentSpan({ pullRequestNodeId });
      return yield* collectPages(NodeDocument.name, (after) =>
        client.graphql(NodeDocument, { id: pullRequestNodeId, ...O.getSomesStruct({ after }) }).pipe(
          Effect.flatMap((data) =>
            Effect.fromOption(
              pipe(
                data.node,
                O.flatMap((node) =>
                  O.map(O.fromUndefinedOr(node.reviewThreads), (connection) =>
                    pageOf(O.map(O.fromNullishOr(node.author), loginOf), connection)
                  )
                )
              ),
              () =>
                GitHubGraphQLError.make({
                  kind: "notFound",
                  operation: NodeDocument.name,
                  reason: `node ${pullRequestNodeId} is not a pull request`,
                  errors: [],
                })
            )
          )
        )
      );
    }),

    reply: dual(
      2,
      Effect.fn("ReviewThread.reply")(function* (threadId: string, body: string) {
        yield* Effect.annotateCurrentSpan({ threadId });
        if (isBlank(body)) {
          return yield* GitHubGraphQLError.make({
            kind: "rejected",
            operation: ReplyDocument.name,
            reason: "reply body is blank",
            errors: [],
          });
        }
        const data = yield* client.graphql(ReplyDocument, { threadId, body });
        return yield* Effect.fromOption(O.map(data.addPullRequestReviewThreadReply.comment, commentOf), () =>
          GitHubGraphQLError.decode(ReplyDocument.name, "GitHub returned no comment for the reply")
        );
      })
    ),

    resolve: Effect.fn("ReviewThread.resolve")(function* (threadId: string) {
      yield* Effect.annotateCurrentSpan({ threadId });
      return yield* resolution(ResolveDocument, threadId);
    }),

    unresolve: Effect.fn("ReviewThread.unresolve")(function* (threadId: string) {
      yield* Effect.annotateCurrentSpan({ threadId });
      return yield* resolution(UnresolveDocument, threadId);
    }),
  };
};
