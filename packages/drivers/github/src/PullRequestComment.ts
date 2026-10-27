/**
 * Pull request and issue comments through GitHub's REST API.
 *
 * **Details**
 *
 * Posts, finds, updates and deletes comments, including a sticky comment that
 * an HTML-comment `CommentMarker` makes findable again.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubId } from "@beep/identity/packages";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { numericId } from "./internal/ids.ts";
import { Repo } from "./Repo.ts";
import type { PageOptions } from "./Rest.ts";

const $I = $GithubId.create("PullRequestComment");

/**
 * The hidden marker that makes a comment findable again.
 *
 * **Details**
 *
 * The marker is `<!-- namespace:key -->`, an HTML comment appended to the body.
 * The namespace is the caller's, so the library has no opinion about whose
 * comments these are, and a marker is testable without a client.
 *
 * **Example** (Build a searchable report marker)
 *
 * ```ts
 * import { CommentMarker } from "@beep/github/PullRequestComment";
 *
 * const marker = CommentMarker.make({ namespace: "ci", key: "report" });
 * console.log(marker.html) // <!-- ci:report -->
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommentMarker extends S.Class<CommentMarker, { readonly brand: unique symbol }>($I`CommentMarker`)(
  {
    /**
     * Whose comments these are, e.g. your action's name.
     *
     * @since 0.0.0
     */
    namespace: S.NonEmptyString.pipe(
      $I.annoteKey("CommentMarker.namespace", { description: "Whose comments these are, e.g. your action's name." })
    ),
    /**
     * Which comment, within that namespace.
     *
     * @since 0.0.0
     */
    key: S.NonEmptyString.pipe(
      $I.annoteKey("CommentMarker.key", { description: "Which comment, within that namespace." })
    ),
  },
  $I.annote("CommentMarker", { description: "The hidden marker that makes a comment findable again." })
) {
  /**
   * The HTML comment appended to a body so the comment can be found again.
   *
   * **Example** (Render a hidden marker)
   *
   * ```ts
   * import { CommentMarker } from "@beep/github/PullRequestComment";
   *
   * const marker = CommentMarker.make({ namespace: "ci", key: "report" });
   * console.log(marker.html) // <!-- ci:report -->
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get html(): string {
    return `<!-- ${this.namespace}:${this.key} -->`;
  }

  /**
   * Checks whether a comment body contains this hidden marker.
   *
   * **Example** (Recognize a marked comment)
   *
   * ```ts
   * import { CommentMarker } from "@beep/github/PullRequestComment";
   *
   * const marker = CommentMarker.make({ namespace: "ci", key: "report" });
   * console.log(marker.matches("Build passed\n\n<!-- ci:report -->")) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  matches(body: string): boolean {
    return Str.includes(this.html)(body);
  }
}

/**
 * A comment this package wrote or found: its id, body and web URL.
 *
 * **Example** (Construct a returned comment)
 *
 * ```ts
 * import { CommentRecord } from "@beep/github/PullRequestComment";
 *
 * const comment = CommentRecord.make({ id: 42, body: "Build passed", url: "https://github.com/acme/app/issues/1#issuecomment-42" });
 * console.log(comment.body) // Build passed
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommentRecord extends S.Opaque<CommentRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int.pipe(
      $I.annoteKey("CommentRecord.id", {
        description: "GitHub-assigned comment identifier used to update or delete the comment",
      })
    ),
    body: S.String.pipe(
      $I.annoteKey("CommentRecord.body", {
        description: "Comment text returned by GitHub, including any hidden marker, or empty when GitHub supplies none",
      })
    ),
    url: S.String.pipe($I.annoteKey("CommentRecord.url", { description: "Web URL for viewing the comment on GitHub" })),
  }).pipe(
    $I.annoteSchema("CommentRecord", {
      description: "A comment this package wrote or found: its id, body and web URL.",
    })
  )
) {}

/**
 * Post, update, find and delete comments on a pull request or issue, including
 * a "sticky" comment kept current through a marker.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface PullRequestCommentShape {
  /**
   * Post a new comment.
   *
   * @since 0.0.0
   */
  readonly create: {
    (issueNumber: number, body: string): Effect.Effect<CommentRecord, GitHubError, Repo>;
    (body: string): (issueNumber: number) => Effect.Effect<CommentRecord, GitHubError, Repo>;
  };
  /**
   * Delete a comment by id.
   *
   * @since 0.0.0
   */
  readonly delete: (commentId: number) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * Find the marked comment.
   *
   * **Details**
   *
   * **Paginates**, so the marker is found on a busy pull request too; pass
   * `page` to bound the walk.
   *
   * @since 0.0.0
   */
  readonly find: {
    (
      issueNumber: number,
      marker: CommentMarker,
      options?: { readonly page?: PageOptions | undefined }
    ): Effect.Effect<O.Option<CommentRecord>, GitHubError, Repo>;
    (
      marker: CommentMarker,
      options?: { readonly page?: PageOptions | undefined }
    ): (issueNumber: number) => Effect.Effect<O.Option<CommentRecord>, GitHubError, Repo>;
  };
  /**
   * Update the marked comment if there is one, or post it.
   *
   * **Details**
   *
   * The marker is appended to the body, so a comment written by `upsert` is
   * always findable by the same marker afterwards.
   *
   * @since 0.0.0
   */
  readonly upsert: {
    (issueNumber: number, marker: CommentMarker, body: string): Effect.Effect<CommentRecord, GitHubError, Repo>;
    (marker: CommentMarker, body: string): (issueNumber: number) => Effect.Effect<CommentRecord, GitHubError, Repo>;
  };
}

/**
 * Post, update, find and delete comments on a pull request or issue, including
 * a "sticky" comment kept current through a `CommentMarker`.
 *
 * **Details**
 *
 * Provide it with {@link PullRequestComment.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`.
 *
 * **Example** (Upsert a report comment with a hidden marker)
 *
 * ```ts
 * import { CommentMarker, PullRequestComment } from "@beep/github/PullRequestComment";
 * import * as Effect from "effect/Effect";
 *
 * const marker = CommentMarker.make({ namespace: "my-action", key: "report" });
 *
 * const report = (pullNumber: number, body: string) =>
 *   Effect.gen(function* () {
 *     const comments = yield* PullRequestComment;
 *     return yield* comments.upsert(pullNumber, marker, body); // edits the marked comment in place
 *   });
 * console.log(Effect.isEffect(report(1, "Build passed"))) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class PullRequestComment extends Context.Service<PullRequestComment, PullRequestCommentShape>()(
  $I`PullRequestComment`
) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Construct the live service layer)
   *
   * ```ts
   * import { PullRequestComment } from "@beep/github/PullRequestComment";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(PullRequestComment.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<PullRequestComment, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub one service operation)
   *
   * ```ts
   * import { PullRequestComment } from "@beep/github/PullRequestComment";
   * import * as Effect from "effect/Effect";
   *
   * const service = PullRequestComment.makeTest({ delete: () => Effect.void });
   * console.log(Effect.isEffect(service.delete(42))) // true
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<PullRequestCommentShape> = {}): PullRequestCommentShape => ({
    create: overrides.create ?? (() => unstubbed("create")),
    upsert: overrides.upsert ?? (() => unstubbed("upsert")),
    find: overrides.find ?? (() => unstubbed("find")),
    delete: overrides.delete ?? (() => unstubbed("delete")),
  });

  /**
   * {@link PullRequestComment.makeTest} behind a `Layer`.
   *
   * **Example** (Construct a test service layer)
   *
   * ```ts
   * import { PullRequestComment } from "@beep/github/PullRequestComment";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(PullRequestComment.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<PullRequestCommentShape> = {}): Layer.Layer<PullRequestComment> =>
    Layer.succeed(PullRequestComment, PullRequestComment.makeTest(overrides));
}

const unstubbed = unstubbedFor({ service: "PullRequestComment" });

const recordOf: {
  (
    raw: { id: number | bigint; body?: string | null; html_url: string },
    operation: string
  ): Effect.Effect<CommentRecord, GitHubError>;
  (
    operation: string
  ): (raw: {
    id: number | bigint;
    body?: string | null;
    html_url: string;
  }) => Effect.Effect<CommentRecord, GitHubError>;
} = dual(
  2,
  Effect.fn("PullRequestComment.recordOf")(function* (
    raw: { id: number | bigint; body?: string | null; html_url: string },
    operation: string
  ) {
    return yield* S.decodeEffect(CommentRecord)({
      id: numericId(raw.id),
      body: raw.body ?? "",
      url: raw.html_url,
    }).pipe(Effect.mapError((error) => GitHubError.decode(operation, "GitHub returned an unexpected comment", error)));
  })
);

const make = (client: GitHubClient["Service"]): PullRequestCommentShape => {
  const create: PullRequestCommentShape["create"] = dual(
    2,
    Effect.fn("PullRequestComment.create")(function* (issueNumber: number, body: string) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, issueNumber });
      const created = yield* client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
      return yield* recordOf(created, "PullRequestComment.create");
    })
  );

  const find: PullRequestCommentShape["find"] = dual(
    (args) => P.isNumber(args[0]),
    Effect.fn("PullRequestComment.find")(function* (
      issueNumber: number,
      marker: CommentMarker,
      options?: { readonly page?: PageOptions | undefined }
    ) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, issueNumber, marker: marker.key });
      const comments = yield* client.paginate(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        { owner, repo, issue_number: issueNumber },
        options?.page
      );
      const records = yield* Effect.forEach(comments, recordOf("PullRequestComment.find"));
      return A.findFirst(records, (comment) => marker.matches(comment.body));
    })
  );

  return {
    create,
    find,

    upsert: dual(
      3,
      Effect.fn("PullRequestComment.upsert")(function* (issueNumber: number, marker: CommentMarker, body: string) {
        const { owner, repo } = yield* Repo;
        const marked = `${body}\n\n${marker.html}`;
        const existing = yield* find(issueNumber, marker);
        if (O.isNone(existing)) {
          return yield* create(issueNumber, marked);
        }
        const updated = yield* client.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
          owner,
          repo,
          comment_id: existing.value.id,
          body: marked,
        });
        return yield* recordOf(updated, "PullRequestComment.upsert");
      })
    ),

    delete: Effect.fn("PullRequestComment.delete")(function* (commentId: number) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, commentId });
      yield* client.request("DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}", {
        owner,
        repo,
        comment_id: commentId,
      });
    }),
  };
};
