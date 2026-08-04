/**
 * Pull request comment streaming for Yeet monitor sessions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Console, DateTime, Duration, Effect, Match, Order, pipe, Ref } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhActor } from "../../../internal/github/index.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/MonitorComments");
const monitorPollInterval = Duration.seconds(10);
const commentExcerptLength = 200;

/**
 * Position of the latest comment seen by a Yeet monitor poller.
 *
 * **Example** (Create a session cursor)
 *
 * ```ts
 * import { YeetMonitorCommentCursor } from "@beep/repo-cli/test/Yeet"
 *
 * const cursor = YeetMonitorCommentCursor.make({ createdAt: "2026-08-04T12:00:00.000Z", id: 42 })
 * console.log(cursor.id) // 42
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorCommentCursor extends S.Class<YeetMonitorCommentCursor>($I`YeetMonitorCommentCursor`)(
  {
    createdAt: S.String,
    id: S.Finite,
  },
  $I.annote("YeetMonitorCommentCursor", {
    description: "Timestamp and numeric id watermark for one GitHub pull request comment collection.",
  })
) {}

/**
 * Normalized pull request review comment emitted by Yeet monitor.
 *
 * **Example** (Describe an inline review)
 *
 * ```ts
 * import { YeetMonitorReviewComment } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const comment = YeetMonitorReviewComment.make({
 *   author: "greptile-apps[bot]",
 *   body: "Please preserve the existing polling interval.",
 *   createdAt: "2026-08-04T12:00:01.000Z",
 *   id: 43,
 *   line: O.some(88),
 *   path: "src/Monitor.ts",
 *   url: "https://github.com/o/r/pull/1#discussion_r43",
 * })
 * console.log(comment.path) // src/Monitor.ts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorReviewComment extends S.TaggedClass<YeetMonitorReviewComment>($I`YeetMonitorReviewComment`)(
  "review",
  {
    author: S.String,
    body: S.String,
    createdAt: S.String,
    id: S.Finite,
    line: S.OptionFromNullOr(S.Finite),
    path: S.String,
    url: S.String,
  },
  $I.annote("YeetMonitorReviewComment", {
    description: "Normalized GitHub inline review comment streamed during Yeet monitoring.",
  })
) {}

/**
 * Normalized pull request conversation comment emitted by Yeet monitor.
 *
 * **Example** (Describe a conversation comment)
 *
 * ```ts
 * import { YeetMonitorIssueComment } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = YeetMonitorIssueComment.make({
 *   author: "octocat",
 *   body: "The hosted checks are green.",
 *   createdAt: "2026-08-04T12:00:01.000Z",
 *   id: 44,
 *   url: "https://github.com/o/r/pull/1#issuecomment-44",
 * })
 * console.log(comment.author) // octocat
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorIssueComment extends S.TaggedClass<YeetMonitorIssueComment>($I`YeetMonitorIssueComment`)(
  "issue",
  {
    author: S.String,
    body: S.String,
    createdAt: S.String,
    id: S.Finite,
    url: S.String,
  },
  $I.annote("YeetMonitorIssueComment", {
    description: "Normalized GitHub pull request conversation comment streamed during Yeet monitoring.",
  })
) {}

/**
 * Comment variants surfaced by a Yeet monitor session.
 *
 * **Example** (Decode a conversation comment)
 *
 * ```ts
 * import { YeetMonitorComment } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(YeetMonitorComment)({
 *   author: "octocat",
 *   body: "Ready for review.",
 *   createdAt: "2026-08-04T12:00:01.000Z",
 *   id: 44,
 *   _tag: "issue",
 *   url: "https://github.com/o/r/pull/1#issuecomment-44",
 * })
 * console.log(decoded)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const YeetMonitorComment = S.Union([YeetMonitorReviewComment, YeetMonitorIssueComment]).pipe(
  $I.annoteSchema("YeetMonitorComment", {
    description: "Review and conversation comment variants surfaced by Yeet monitor.",
  })
);

/**
 * Decoded comment surfaced by a Yeet monitor session.
 *
 * @see {@link YeetMonitorComment} for the runtime schema and variant definitions.
 * @category models
 * @since 0.0.0
 */
export type YeetMonitorComment = typeof YeetMonitorComment.Type;

class GhRestReviewComment extends S.Class<GhRestReviewComment>($I`GhRestReviewComment`)(
  {
    body: S.NullOr(S.String),
    created_at: S.String,
    html_url: S.String,
    id: S.Finite,
    line: S.NullOr(S.Finite),
    original_line: S.NullOr(S.Finite),
    path: S.String,
    user: S.NullOr(GhActor),
  },
  $I.annote("GhRestReviewComment", {
    description: "GitHub REST inline review comment payload used by Yeet monitor.",
  })
) {}

class GhRestIssueComment extends S.Class<GhRestIssueComment>($I`GhRestIssueComment`)(
  {
    body: S.NullOr(S.String),
    created_at: S.String,
    html_url: S.String,
    id: S.Finite,
    user: S.NullOr(GhActor),
  },
  $I.annote("GhRestIssueComment", {
    description: "GitHub REST issue comment payload used by Yeet monitor.",
  })
) {}

class YeetMonitorCommentWatermark extends S.Class<YeetMonitorCommentWatermark>($I`YeetMonitorCommentWatermark`)(
  {
    issue: YeetMonitorCommentCursor,
    review: YeetMonitorCommentCursor,
  },
  $I.annote("YeetMonitorCommentWatermark", {
    description: "In-memory per-collection comment cursors for one pull request monitor session.",
  })
) {}

const commentCursorOrder: Order.Order<YeetMonitorCommentCursor> = Order.combine(
  Order.mapInput(Order.String, (cursor: YeetMonitorCommentCursor) => cursor.createdAt),
  Order.mapInput(Order.Number, (cursor: YeetMonitorCommentCursor) => cursor.id)
);

/**
 * Test whether a monitor comment is later than a stored cursor.
 *
 * **Example** (Reject an already-seen comment)
 *
 * ```ts
 * import { isYeetMonitorCommentAfter, YeetMonitorCommentCursor, YeetMonitorIssueComment } from "@beep/repo-cli/test/Yeet"
 *
 * const cursor = YeetMonitorCommentCursor.make({ createdAt: "2026-08-04T12:00:01.000Z", id: 44 })
 * const comment = YeetMonitorIssueComment.make({
 *   author: "octocat",
 *   body: "Ready for review.",
 *   createdAt: "2026-08-04T12:00:01.000Z",
 *   id: 44,
 *   url: "https://github.com/o/r/pull/1#issuecomment-44",
 * })
 * console.log(isYeetMonitorCommentAfter(cursor, comment)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isYeetMonitorCommentAfter: {
  (cursor: YeetMonitorCommentCursor, comment: YeetMonitorComment): boolean;
  (comment: YeetMonitorComment): (cursor: YeetMonitorCommentCursor) => boolean;
} = dual(
  2,
  (cursor: YeetMonitorCommentCursor, comment: YeetMonitorComment): boolean => commentCursorOrder(comment, cursor) > 0
);

const commentOrder: Order.Order<YeetMonitorComment> = Order.combine(
  Order.mapInput(Order.String, (comment: YeetMonitorComment) => comment.createdAt),
  Order.mapInput(Order.Number, (comment: YeetMonitorComment) => comment.id)
);

const authorLogin = (user: GhActor | null): string =>
  pipe(
    O.fromNullishOr(user),
    O.map((actor) => actor.login),
    O.getOrElse(() => "unknown")
  );
const commentBody = (body: string | null): string => O.getOrElse(O.fromNullishOr(body), () => Str.empty);
const reviewLine = (line: O.Option<number>): string =>
  pipe(
    line,
    O.map((value) => `${value}`),
    O.getOrElse(() => "?")
  );

const normalizeReviewComment = (comment: GhRestReviewComment): YeetMonitorReviewComment =>
  YeetMonitorReviewComment.make({
    author: authorLogin(comment.user),
    body: commentBody(comment.body),
    createdAt: comment.created_at,
    id: comment.id,
    line: pipe(
      O.fromNullishOr(comment.line),
      O.orElse(() => O.fromNullishOr(comment.original_line))
    ),
    path: comment.path,
    url: comment.html_url,
  });

const normalizeIssueComment = (comment: GhRestIssueComment): YeetMonitorIssueComment =>
  YeetMonitorIssueComment.make({
    author: authorLogin(comment.user),
    body: commentBody(comment.body),
    createdAt: comment.created_at,
    id: comment.id,
    url: comment.html_url,
  });

const excerpt = (body: string): string => {
  const normalized = pipe(body, Str.replace(/\s+/gu, " "), Str.trim);
  return Str.length(normalized) <= commentExcerptLength
    ? normalized
    : `${pipe(normalized, Str.takeLeft(commentExcerptLength))}…`;
};

/**
 * Render a new pull request comment in Yeet monitor's compact operator format.
 *
 * **Example** (Render an inline review)
 *
 * ```ts
 * import { renderYeetMonitorComment, YeetMonitorReviewComment } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const output = renderYeetMonitorComment(YeetMonitorReviewComment.make({
 *   author: "greptile-apps[bot]",
 *   body: "Please add a regression test.",
 *   createdAt: "2026-08-04T12:00:01.000Z",
 *   id: 43,
 *   line: O.some(88),
 *   path: "src/Monitor.ts",
 *   url: "https://github.com/o/r/pull/1#discussion_r43",
 * }))
 * console.log(output)
 * ```
 *
 * @param comment - The normalized review or issue comment to render.
 * @returns The compact multi-line operator string for the comment.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorComment = (comment: YeetMonitorComment): string =>
  Match.value(comment).pipe(
    Match.tags({
      review: (review) =>
        `[yeet] new PR review comment: ${review.author} @ ${review.path}:${reviewLine(review.line)}\n  ${excerpt(review.body)}\n  ${review.url}`,
      issue: (issue) => `[yeet] new PR issue comment: ${issue.author}\n  ${excerpt(issue.body)}\n  ${issue.url}`,
    }),
    Match.exhaustive
  );

const decodeReviewComments = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhRestReviewComment)));
const decodeIssueComments = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhRestIssueComment)));

const fetchComments = Effect.fn("YeetMonitor.fetchComments")(function* <Comment>(
  context: RepoRunContext,
  endpoint: string,
  since: string,
  decode: (text: string) => Effect.Effect<ReadonlyArray<Comment>, S.SchemaError>
): Effect.fn.Return<ReadonlyArray<Comment>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture(
    "gh",
    ["api", "--method", "GET", endpoint, "-f", "per_page=100", "-f", `since=${since}`],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to poll pull request comments during yeet monitor.")));
  if (result.exitCode !== 0 || result.truncated) {
    return yield* YeetCommandError.make({
      command: `gh api --method GET ${endpoint}`,
      exitCode: result.exitCode === 0 ? 1 : result.exitCode,
      message: "Failed to poll pull request comments during yeet monitor.",
    });
  }
  return yield* decode(result.output).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode pull request comments during yeet monitor."))
  );
});

const nextCursor = (cursor: YeetMonitorCommentCursor, comments: ReadonlyArray<YeetMonitorComment>) =>
  A.reduce(comments, cursor, (latest, comment) =>
    isYeetMonitorCommentAfter(latest, comment)
      ? YeetMonitorCommentCursor.make({ createdAt: comment.createdAt, id: comment.id })
      : latest
  );

const pollComments = Effect.fn("YeetMonitor.pollComments")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermarkRef: Ref.Ref<YeetMonitorCommentWatermark>
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const watermark = yield* Ref.get(watermarkRef);
  const [reviewPayload, issuePayload] = yield* Effect.all(
    [
      fetchComments(
        context,
        `repos/{owner}/{repo}/pulls/${pullRequestNumber}/comments`,
        watermark.review.createdAt,
        decodeReviewComments
      ),
      fetchComments(
        context,
        `repos/{owner}/{repo}/issues/${pullRequestNumber}/comments`,
        watermark.issue.createdAt,
        decodeIssueComments
      ),
    ],
    { concurrency: 2 }
  );
  const reviewComments = pipe(reviewPayload, A.map(normalizeReviewComment));
  const issueComments = pipe(issuePayload, A.map(normalizeIssueComment));
  const newReviewComments = A.filter(reviewComments, (comment) => isYeetMonitorCommentAfter(watermark.review, comment));
  const newIssueComments = A.filter(issueComments, (comment) => isYeetMonitorCommentAfter(watermark.issue, comment));
  const newComments = A.sort([...newReviewComments, ...newIssueComments], commentOrder);
  yield* Effect.forEach(newComments, (comment) => Console.log(renderYeetMonitorComment(comment)), { concurrency: 1 });
  yield* Ref.set(
    watermarkRef,
    YeetMonitorCommentWatermark.make({
      issue: nextCursor(watermark.issue, newIssueComments),
      review: nextCursor(watermark.review, newReviewComments),
    })
  );
});

/**
 * Poll and stream pull request comments until the surrounding monitor interrupts it.
 *
 * **When to use**
 *
 * Use with the existing hosted-check watcher so comments and pipeline state are
 * visible during the same Yeet monitor session.
 *
 * **Example** (Create the long-lived monitor effect)
 *
 * ```ts
 * import { runYeetPullRequestCommentMonitor, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/comments",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * console.log(Effect.isEffect(runYeetPullRequestCommentMonitor(context, 42))) // true
 * ```
 *
 * @category streams
 * @since 0.0.0
 */
export const runYeetPullRequestCommentMonitor = Effect.fn("Yeet.runPullRequestCommentMonitor")(function* (
  context: RepoRunContext,
  pullRequestNumber: number
): Effect.fn.Return<never, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const initialCursor = YeetMonitorCommentCursor.make({ createdAt: startedAt, id: 0 });
  const watermarkRef = yield* Ref.make(
    YeetMonitorCommentWatermark.make({ issue: initialCursor, review: initialCursor })
  );
  return yield* Effect.forever(
    pollComments(context, pullRequestNumber, watermarkRef).pipe(Effect.andThen(Effect.sleep(monitorPollInterval)))
  );
});
