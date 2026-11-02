/**
 * Frozen pre-W4 declarations for `ops/review-thread-differential-w4.ts`: the closeout review-thread page
 * document and query W4 deleted from `packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Gh.schemas.ts`,
 * verbatim from main 930758e06b except for import paths and the identity namespace.
 */
import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { GhReviewThreadConnection } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Gh.schemas.ts";
import type * as Effect from "effect/Effect";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $RepoCliId.create("goals/repo-cli-gh-git-consolidation/ops/frozen-w4/GhSchemas.old");

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
export class GhReviewThreadsPullRequest extends S.Opaque<
  GhReviewThreadsPullRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    reviewThreads: GhReviewThreadConnection,
  }).pipe(
    $I.annoteSchema("GhReviewThreadsPullRequest", {
      description: "Pull request review thread page payload.",
    })
  )
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
export class GhReviewThreadsRepository extends S.Opaque<GhReviewThreadsRepository, { readonly brand: unique symbol }>()(
  S.Struct({
    pullRequest: GhReviewThreadsPullRequest,
  }).pipe(
    $I.annoteSchema("GhReviewThreadsRepository", {
      description: "Repository wrapper for pull request review thread page payload.",
    })
  )
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
export class GhReviewThreadsData extends S.Opaque<GhReviewThreadsData, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: GhReviewThreadsRepository,
  }).pipe(
    $I.annoteSchema("GhReviewThreadsData", {
      description: "GraphQL data wrapper for pull request review thread pages.",
    })
  )
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
export class GhReviewThreadsDocument extends S.Opaque<GhReviewThreadsDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    data: GhReviewThreadsData,
  }).pipe(
    $I.annoteSchema("GhReviewThreadsDocument", {
      description: "GitHub GraphQL response document for pull request review thread pages.",
    })
  )
) {}

/**
 * Decode the closeout review-thread GraphQL document.
 *
 * **Example** (Decode threads GraphQL document)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
export const decodeGhReviewThreadsDocument: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<GhReviewThreadsDocument, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<GhReviewThreadsDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(GhReviewThreadsDocument)));

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
          resolvedBy { login }
          comments(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { id body url createdAt author { __typename login } }
          }
          latest: comments(last: 1) { nodes { author { __typename login } body createdAt url } }
        }
      }
    }
  }
}
`;
