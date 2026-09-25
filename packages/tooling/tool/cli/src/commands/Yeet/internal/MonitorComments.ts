/**
 * Pull request comment streaming for Yeet monitor sessions.
 *
 * **Details**
 *
 * The stream is durable across runs and independent of the check watcher it is
 * raced against. Durable: the per-collection watermarks are persisted to a
 * branch-scoped artifact after every emitted batch, so a comment posted while
 * no monitor was attached is printed by the next run instead of falling into
 * the gap between a process exit and the next process start. The merge loop's
 * two modes keep their own artifacts ({@link YeetMonitorCommentConsumer}), so a
 * `--watch` and a detached `--until-ready` on one branch never advance each
 * other's position.
 * Independent: a poll that fails degrades this stream alone — the surrounding
 * race can never be decided by a GitHub read error, because the poller's error
 * channel is `never` by construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Console, DateTime, Duration, Effect, FileSystem, Match, Order, pipe, Ref, Result } from "effect";
import * as A from "effect/Array";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhActor } from "../../../internal/github/index.ts";
import { repoRunOutputBound } from "../../../internal/process/StepExec.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { writeTextFile } from "./IssueArtifacts.ts";
import { parseYeetReviewBodySignal, YeetReviewBodySignal, YeetReviewBodySignalInput } from "./ReviewBodySignal.ts";
import type { Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/MonitorComments");
const monitorPollInterval = Duration.seconds(10);

/**
 * How many characters of a comment body an operator line or an inbox row keeps.
 *
 * **Details**
 *
 * Shared by the stdout rendering and the `pr-comment` row excerpt, so a row
 * carries the same bounded text a monitor prints.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { YEET_MONITOR_COMMENT_EXCERPT_LENGTH } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MONITOR_COMMENT_EXCERPT_LENGTH) // 200
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_MONITOR_COMMENT_EXCERPT_LENGTH = 200;

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
 * **Details**
 *
 * `authorType` is the REST account type of the author (`"User"`, `"Bot"`),
 * when the payload carried one; the two other comment variants carry it too.
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
    authorType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
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
    authorType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetMonitorIssueComment", {
    description: "Normalized GitHub pull request conversation comment streamed during Yeet monitoring.",
  })
) {}

/**
 * Normalized pull request review *body* emitted by Yeet monitor.
 *
 * **Details**
 *
 * The prose a reviewer submits alongside their inline comments. It is carried
 * in the same stream as the two comment collections because it is the same
 * kind of event to an operator — a reviewer said something — and because its
 * structural signal (`signal`) is where a CodeRabbit round's nitpick tally and
 * a Greptile-format round's new findings live. It is stamped `submittedAt`
 * rather than `createdAt` because that is the field GitHub advances when the
 * review leaves the pending state, and a review drafted hours earlier must not
 * appear to predate the watermark that was written while it was still pending.
 *
 * **Example** (Describe a submitted review)
 *
 * ```ts
 * import { YeetMonitorReviewBody, ReviewBodyPlain } from "@beep/repo-cli/test/Yeet"
 *
 * const body = YeetMonitorReviewBody.make({
 *   author: "coderabbitai[bot]",
 *   body: "**Actionable comments posted: 0**",
 *   id: 5275652920,
 *   signal: ReviewBodyPlain.make({ signal: "plain" }),
 *   state: "COMMENTED",
 *   submittedAt: "2026-09-22T12:00:01.000Z",
 *   url: "https://github.com/o/r/pull/1#pullrequestreview-5275652920",
 * })
 * console.log(body.state) // COMMENTED
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorReviewBody extends S.TaggedClass<YeetMonitorReviewBody>($I`YeetMonitorReviewBody`)(
  "review-body",
  {
    author: S.String,
    body: S.String,
    id: S.Finite,
    signal: YeetReviewBodySignal,
    state: S.String,
    submittedAt: S.String,
    url: S.String,
    authorType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetMonitorReviewBody", {
    description: "Normalized GitHub pull request review body streamed during Yeet monitoring.",
  })
) {}

const isYeetMonitorReviewComment = S.is(YeetMonitorReviewComment);
const isYeetMonitorIssueComment = S.is(YeetMonitorIssueComment);
const isYeetMonitorReviewBody = S.is(YeetMonitorReviewBody);

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
export const YeetMonitorComment = S.Union([
  YeetMonitorReviewComment,
  YeetMonitorIssueComment,
  YeetMonitorReviewBody,
]).pipe(
  $I.annoteSchema("YeetMonitorComment", {
    description: "Review comment, conversation comment and review body variants surfaced by Yeet monitor.",
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

/**
 * The two stream members that belong to a review *thread* rather than a review.
 *
 * **Details**
 *
 * Surfaces keyed on a comment's path and id — the watch stream's
 * `comment-posted` rows above all — accept only these two. A review body has
 * no thread, no path and no line, so widening those rows to carry one would
 * mean inventing values for all three.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorThreadComment = YeetMonitorReviewComment | YeetMonitorIssueComment;

/**
 * Test whether a streamed row is an inline or conversation comment.
 *
 * **Example** (Keep only thread comments)
 *
 * ```ts
 * import { isYeetMonitorThreadComment, YeetMonitorIssueComment } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = YeetMonitorIssueComment.make({
 *   author: "octocat",
 *   body: "Ready for review.",
 *   createdAt: "2026-08-04T12:00:01.000Z",
 *   id: 44,
 *   url: "https://github.com/o/r/pull/1#issuecomment-44",
 * })
 * console.log(isYeetMonitorThreadComment(comment)) // true
 * ```
 *
 * @param comment - One row from the monitor comment stream.
 * @returns Whether the row is a review or conversation comment.
 * @category predicates
 * @since 0.0.0
 */
export const isYeetMonitorThreadComment = (comment: YeetMonitorComment): comment is YeetMonitorThreadComment =>
  !isYeetMonitorReviewBody(comment);

/**
 * Whether a streamed comment was written by a bot rather than a person.
 *
 * **Details**
 *
 * Three rules the stream already knows. GitHub's REST API types a GitHub App
 * actor `Bot` (`authorType`), which is the only signal for an App posting
 * under a plain login, such as Copilot's reviewer as `Copilot`. It also names
 * most App actors with a `[bot]` login suffix. A review bot posting under
 * another login is caught by the review-body signal rules: a CodeRabbit
 * login, or a Greptile login or Greptile-format body, reads as a non-`plain`
 * signal. Every other author is read as a person.
 *
 * **Example** (A GitHub App is a bot)
 *
 * ```ts
 * import { YeetMonitorIssueComment, yeetMonitorCommentFromBot } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = YeetMonitorIssueComment.make({
 *   author: "github-actions[bot]",
 *   body: "Deployment ready.",
 *   createdAt: "2026-09-25T00:00:00Z",
 *   id: 44,
 *   url: "https://github.com/o/r/pull/1#issuecomment-44",
 * })
 * console.log(yeetMonitorCommentFromBot(comment)) // true
 * ```
 *
 * @param comment - One row from the monitor comment stream.
 * @returns Whether the author is a bot by REST account type, login suffix, or review-body signal.
 * @category predicates
 * @since 0.0.0
 */
export const yeetMonitorCommentFromBot = (comment: YeetMonitorComment): boolean =>
  O.contains(comment.authorType, "Bot") ||
  Str.endsWith("[bot]")(Str.toLowerCase(comment.author)) ||
  Match.value(comment).pipe(
    Match.tag("review-body", (body) => body.signal.signal !== "plain"),
    Match.orElse(
      (other) =>
        parseYeetReviewBodySignal(YeetReviewBodySignalInput.make({ authorLogin: other.author, body: other.body }))
          .signal !== "plain"
    )
  );

/**
 * GitHub REST inline review payload used by monitor normalization tests.
 *
 * @category models
 * @since 0.0.0
 */
export class GhRestReviewComment extends S.Class<GhRestReviewComment>($I`GhRestReviewComment`)(
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

/**
 * GitHub REST issue-comment payload used by monitor normalization tests.
 *
 * @category models
 * @since 0.0.0
 */
export class GhRestIssueComment extends S.Class<GhRestIssueComment>($I`GhRestIssueComment`)(
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

/**
 * GitHub REST submitted-review payload used by monitor normalization tests.
 *
 * @category models
 * @since 0.0.0
 */
export class GhRestReview extends S.Class<GhRestReview>($I`GhRestReview`)(
  {
    body: S.NullOr(S.String),
    html_url: S.String,
    id: S.Finite,
    state: S.String,
    submitted_at: S.NullOr(S.String),
    user: S.NullOr(GhActor),
  },
  $I.annote("GhRestReview", {
    description: "GitHub REST submitted pull request review payload used by Yeet monitor.",
  })
) {}

/**
 * The three cursors one monitor session advances.
 *
 * **Details**
 *
 * GitHub exposes inline review comments, conversation comments and submitted
 * review bodies as three collections with independent id spaces, so one shared
 * cursor would let a busy collection drag the quiet ones forward and silently
 * skip their rows. They are carried together because they are advanced and
 * persisted together — one poll, one write.
 *
 * **Example** (Start every cursor at the same instant)
 *
 * ```ts
 * import { YeetMonitorCommentCursor, YeetMonitorCommentWatermark } from "@beep/repo-cli/test/Yeet"
 *
 * const cursor = YeetMonitorCommentCursor.make({ createdAt: "2026-08-16T12:00:00.000Z", id: 0 })
 * const watermark = YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor, reviewBody: cursor })
 * console.log(watermark.review.id) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorCommentWatermark extends S.Class<YeetMonitorCommentWatermark>($I`YeetMonitorCommentWatermark`)(
  {
    issue: YeetMonitorCommentCursor,
    review: YeetMonitorCommentCursor,
    reviewBody: YeetMonitorCommentCursor,
  },
  $I.annote("YeetMonitorCommentWatermark", {
    description: "Per-collection comment and review-body cursors for one pull request monitor session.",
  })
) {}

// The v1 watermark, kept only so a position written before review bodies were
// streamed still resumes. It is never written again.
class YeetMonitorCommentWatermarkV1 extends S.Class<YeetMonitorCommentWatermarkV1>($I`YeetMonitorCommentWatermarkV1`)(
  {
    issue: YeetMonitorCommentCursor,
    review: YeetMonitorCommentCursor,
  },
  $I.annote("YeetMonitorCommentWatermarkV1", {
    description: "The pre-review-body comment cursors carried by a v1 monitor comment artifact.",
  })
) {}

/**
 * The persisted comment watermark for one branch's pull request.
 *
 * **Details**
 *
 * Written next to the other branch-scoped Yeet run artifacts and versioned like
 * them, so a future shape change is a decode miss — which restarts the stream
 * from now — rather than a crash inside a monitor session. `prNumber` is part
 * of the record because the file is keyed by branch: a branch whose pull
 * request was closed and reopened as a new number must not inherit the old
 * one's cursors, and comparing the recorded number is what detects that.
 *
 * **Example** (Describe a resumable stream position)
 *
 * ```ts
 * import { YeetMonitorCommentCursor, YeetMonitorCommentState, YeetMonitorCommentWatermark } from "@beep/repo-cli/test/Yeet"
 *
 * const cursor = YeetMonitorCommentCursor.make({ createdAt: "2026-08-16T12:00:00.000Z", id: 44 })
 * const state = YeetMonitorCommentState.make({
 *   schemaVersion: "yeet-monitor-comments/v2",
 *   prNumber: 558,
 *   updatedAt: "2026-08-16T12:00:05.000Z",
 *   watermark: YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor, reviewBody: cursor }),
 * })
 * console.log(state.prNumber) // 558
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorCommentState extends S.Class<YeetMonitorCommentState>($I`YeetMonitorCommentState`)(
  {
    schemaVersion: S.Literal("yeet-monitor-comments/v2"),
    prNumber: S.Int.check(S.isGreaterThan(0)),
    updatedAt: S.String,
    watermark: YeetMonitorCommentWatermark,
  },
  $I.annote("YeetMonitorCommentState", {
    description: "Branch-scoped comment stream position carried between Yeet monitor runs.",
  })
) {}

// The v1 artifact. Accepted on read and upgraded in place on the next write,
// because the alternative — treating it as a decode miss — restarts the stream
// from now and drops exactly the comments a resumed session exists to print.
class YeetMonitorCommentStateV1 extends S.Class<YeetMonitorCommentStateV1>($I`YeetMonitorCommentStateV1`)(
  {
    schemaVersion: S.Literal("yeet-monitor-comments/v1"),
    prNumber: S.Int.check(S.isGreaterThan(0)),
    updatedAt: S.String,
    watermark: YeetMonitorCommentWatermarkV1,
  },
  $I.annote("YeetMonitorCommentStateV1", {
    description: "The pre-review-body branch-scoped comment stream position.",
  })
) {}

const YeetMonitorCommentStateStored = S.Union([YeetMonitorCommentState, YeetMonitorCommentStateV1]);
const isYeetMonitorCommentStateV1 = S.is(YeetMonitorCommentStateV1);

/**
 * JSON-string codec for the persisted comment stream position.
 *
 * **Example** (Encode a stream position)
 *
 * ```ts
 * import { YeetMonitorCommentCursor, YeetMonitorCommentState, YeetMonitorCommentStateJson, YeetMonitorCommentWatermark } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const cursor = YeetMonitorCommentCursor.make({ createdAt: "2026-08-16T12:00:00.000Z", id: 44 })
 * const state = YeetMonitorCommentState.make({
 *   schemaVersion: "yeet-monitor-comments/v2",
 *   prNumber: 558,
 *   updatedAt: "2026-08-16T12:00:05.000Z",
 *   watermark: YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor, reviewBody: cursor }),
 * })
 * console.log(Effect.runSync(YeetMonitorCommentStateJson.encode(state)).includes("yeet-monitor-comments/v2"))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetMonitorCommentStateJson = JsonStringCodec(YeetMonitorCommentState);

// Reads accept both versions; writes only ever go through the v2 codec above.
const YeetMonitorCommentStateStoredJson = JsonStringCodec(YeetMonitorCommentStateStored);

/**
 * File name of the persisted comment stream position inside a Yeet run
 * directory.
 *
 * **Example** (Name the artifact)
 *
 * ```ts
 * import { YEET_MONITOR_COMMENT_STATE_FILE_NAME } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MONITOR_COMMENT_STATE_FILE_NAME)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_MONITOR_COMMENT_STATE_FILE_NAME = "monitor-comments.json";

/**
 * The comment consumers that keep their own position on one branch.
 *
 * **Details**
 *
 * The artifact directory is keyed by branch alone, so one shared position let
 * a `--watch` and a detached `--until-ready` steal each other's comments
 * (pr-event-awareness D21). `shared` is the original `monitor-comments.json`,
 * kept by every surface that printed comments before the split: `--watch`, the
 * classic `yeet monitor` stream, `yeet status --remote` and `yeet closeout`.
 * They resume exactly as before, and `--watch` is otherwise unchanged. The
 * merge loop's two modes each get their own file: `until-ready` turns comments
 * into inbox rows, and `until-merged` replays its first-cycle backlog to its
 * own log.
 *
 * **Example** (Check a consumer)
 *
 * ```ts
 * import { YeetMonitorCommentConsumer } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetMonitorCommentConsumer.is["until-ready"]("until-ready")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMonitorCommentConsumer = LiteralKit(["shared", "until-ready", "until-merged"]).pipe(
  $I.annoteSchema("YeetMonitorCommentConsumer", {
    title: "Yeet Monitor Comment Consumer",
    description: "A comment consumer mode that keeps its own comment stream position on one branch.",
  })
);

/**
 * The comment consumers that keep their own position on one branch.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorCommentConsumer = typeof YeetMonitorCommentConsumer.Type;

/**
 * Name one consumer's comment stream position artifact.
 *
 * **Example** (Name the until-ready artifact)
 *
 * ```ts
 * import { yeetMonitorCommentStateFileName } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetMonitorCommentStateFileName("shared")) // "monitor-comments.json"
 * console.log(yeetMonitorCommentStateFileName("until-ready")) // "monitor-comments.until-ready.json"
 * ```
 *
 * @param consumer - The consumer mode that owns the position.
 * @returns The artifact file name inside the branch's run directory.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorCommentStateFileName = (consumer: YeetMonitorCommentConsumer): string =>
  YeetMonitorCommentConsumer.is.shared(consumer)
    ? YEET_MONITOR_COMMENT_STATE_FILE_NAME
    : `monitor-comments.${consumer}.json`;

/**
 * Resolve one consumer's branch-scoped comment stream position artifact path.
 *
 * **Example** (Resolve the artifact path)
 *
 * ```ts
 * import { yeetMonitorCommentStatePath } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(yeetMonitorCommentStatePath))) // true
 * ```
 *
 * @param context - Repo run context carrying the artifact directory and branch.
 * @param consumer - The consumer mode whose position is resolved; the shared position by default.
 * @returns Absolute path to the consumer's position artifact on this branch.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorCommentStatePath = Effect.fn("YeetMonitor.commentStatePath")(function* (
  context: RepoRunContext,
  consumer: YeetMonitorCommentConsumer = YeetMonitorCommentConsumer.Enum.shared
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto | Path.Path> {
  return yield* runArtifactPathForContext(context, yeetMonitorCommentStateFileName(consumer));
});

const commentCursorOrder: Order.Order<YeetMonitorCommentCursor> = Order.combine(
  Order.mapInput(Order.String, (cursor: YeetMonitorCommentCursor) => cursor.createdAt),
  Order.mapInput(Order.Number, (cursor: YeetMonitorCommentCursor) => cursor.id)
);
const earlierCursor = Order.min(commentCursorOrder);
const laterCursor = Order.max(commentCursorOrder);

// The earliest of the cursors is where a resumed stream genuinely reaches
// back to: the collections advance independently, so quoting any single one of
// them would understate how far back the others still reach.
const earliestWatermarkAt = (watermark: YeetMonitorCommentWatermark): string =>
  earlierCursor(earlierCursor(watermark.issue, watermark.review), watermark.reviewBody).createdAt;

// A review body is stamped with its submission instant, the two comment kinds
// with their creation instant; the stream orders all three on one axis.
const commentPosition = (comment: YeetMonitorComment): YeetMonitorCommentCursor =>
  YeetMonitorCommentCursor.make({
    createdAt: Match.value(comment).pipe(
      Match.tag("review-body", (body) => body.submittedAt),
      Match.orElse((other) => other.createdAt)
    ),
    id: comment.id,
  });

// A v1 artifact knew nothing about review bodies, so the only honest seed is
// the earlier of the two cursors it did carry: starting the new collection at
// the later one would skip every review body submitted in between.
const upgradeStoredWatermark = (state: typeof YeetMonitorCommentStateStored.Type): YeetMonitorCommentWatermark =>
  isYeetMonitorCommentStateV1(state)
    ? YeetMonitorCommentWatermark.make({
        issue: state.watermark.issue,
        review: state.watermark.review,
        reviewBody: earlierCursor(state.watermark.issue, state.watermark.review),
      })
    : state.watermark;

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
  (cursor: YeetMonitorCommentCursor, comment: YeetMonitorComment): boolean =>
    commentCursorOrder(commentPosition(comment), cursor) > 0
);

const commentOrder: Order.Order<YeetMonitorComment> = Order.mapInput(commentCursorOrder, commentPosition);

const authorLogin = (user: GhActor | null): string =>
  pipe(
    O.fromNullishOr(user),
    O.map((actor) => actor.login),
    O.getOrElse(() => "unknown")
  );
const authorType = (user: GhActor | null): O.Option<string> =>
  O.flatMap(O.fromNullishOr(user), (actor) => O.fromUndefinedOr(actor.type));
const commentBody = (body: string | null): string => O.getOrElse(O.fromNullishOr(body), () => Str.empty);

// GitHub comment fields are attacker-controlled terminal input. Strip OSC,
// CSI, other ESC sequences, and remaining C0/C1 controls before rendering so
// a comment cannot spoof output, write the clipboard, or create hyperlinks.
const stripTerminalControlSequences: (value: string) => string = flow(
  Str.replace(/\u001B\][\s\S]*?(?:\u0007|\u001B\\)/gu, ""),
  Str.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, ""),
  Str.replace(/\u001B[@-Z\\-_]/gu, ""),
  Str.replace(/[\u0000-\u001F\u007F-\u009F]/gu, "")
);
const reviewLine: (line: O.Option<number>) => string = flow(
  O.map((value) => `${value}`),
  O.getOrElse(() => "?")
);

const normalizeReviewComment = (comment: GhRestReviewComment): YeetMonitorReviewComment =>
  YeetMonitorReviewComment.make({
    author: authorLogin(comment.user),
    authorType: authorType(comment.user),
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
    authorType: authorType(comment.user),
    body: commentBody(comment.body),
    createdAt: comment.created_at,
    id: comment.id,
    url: comment.html_url,
  });

// A review with no body is the "approved, nothing to say" case and carries no
// signal; a pending review has no submission instant and is not an event yet.
const normalizeReviewBody = (review: GhRestReview): O.Option<YeetMonitorReviewBody> =>
  pipe(
    O.fromNullishOr(review.submitted_at),
    O.flatMap((submittedAt) =>
      pipe(
        O.fromNullishOr(review.body),
        O.map(Str.trim),
        O.filter(Str.isNonEmpty),
        O.map((body) =>
          YeetMonitorReviewBody.make({
            author: authorLogin(review.user),
            authorType: authorType(review.user),
            body,
            id: review.id,
            signal: parseYeetReviewBodySignal(
              YeetReviewBodySignalInput.make({ authorLogin: authorLogin(review.user), body })
            ),
            state: review.state,
            submittedAt,
            url: review.html_url,
          })
        )
      )
    )
  );

/**
 * Review-body normalizer exposed through the source-only Yeet test kit.
 *
 * @category testing
 * @since 0.0.0
 */
export const normalizeYeetMonitorReviewBodyForTesting = normalizeReviewBody;

/**
 * Review-comment normalizer exposed through the source-only Yeet test kit.
 *
 * @category testing
 * @since 0.0.0
 */
export const normalizeYeetMonitorReviewCommentForTesting = normalizeReviewComment;

/**
 * Issue-comment normalizer exposed through the source-only Yeet test kit.
 *
 * @category testing
 * @since 0.0.0
 */
export const normalizeYeetMonitorIssueCommentForTesting = normalizeIssueComment;

/**
 * Collapse whitespace in a comment body and bound its length for one line.
 *
 * **Details**
 *
 * Terminal control sequences are stripped before the whitespace collapse, so a
 * hostile comment body cannot smuggle escape codes into operator terminals.
 * Shared with `yeet status` thread triage, which strips bot badge markup first
 * and then bounds the surviving first line here — so both operator surfaces
 * sanitize and truncate identically instead of drifting apart.
 *
 * **Example** (Bound a long body)
 *
 * ```ts
 * import { yeetCommentExcerpt } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetCommentExcerpt("please  add\na regression test", 12))
 * ```
 *
 * @param body - Raw comment text.
 * @param maxLength - Maximum characters before an ellipsis is appended.
 * @returns The single-line, bounded, control-sequence-free excerpt.
 * @category formatting
 * @since 0.0.0
 */
export const yeetCommentExcerpt: {
  (maxLength: number): (body: string) => string;
  (body: string, maxLength: number): string;
} = dual(2, (body: string, maxLength: number): string => {
  const normalized = pipe(body, stripTerminalControlSequences, Str.replace(/\s+/gu, " "), Str.trim);
  return Str.length(normalized) <= maxLength ? normalized : `${pipe(normalized, Str.takeLeft(maxLength))}…`;
});

const excerpt = (body: string): string => yeetCommentExcerpt(body, YEET_MONITOR_COMMENT_EXCERPT_LENGTH);

/**
 * Summarize what a review body reports, when it reports anything structural.
 *
 * **Details**
 *
 * `None` for a body with no recognised markers: an operator reading the stream
 * should see the excerpt and nothing else rather than a row of zeroes that
 * looks like a measurement. Every number here is advisory — it names what a
 * reviewer said, never what blocks the merge.
 *
 * **Example** (Summarize a CodeRabbit round)
 *
 * ```ts
 * import { renderYeetMonitorReviewBodySignal, ReviewBodyCoderabbit } from "@beep/repo-cli/test/Yeet"
 *
 * const summary = renderYeetMonitorReviewBodySignal(
 *   ReviewBodyCoderabbit.make({ signal: "coderabbit", actionable: 2, items: [], nitpicks: 11, outsideDiff: 0 })
 * )
 * console.log(summary)
 * ```
 *
 * @param signal - The parsed structural signal of one review body.
 * @returns The one-line advisory summary, or `None` for an unreadable body.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorReviewBodySignal = (signal: YeetReviewBodySignal): O.Option<string> =>
  Match.value(signal).pipe(
    Match.discriminator("signal")("coderabbit", (coderabbit) =>
      O.some(
        `coderabbit: ${coderabbit.actionable} actionable, ${coderabbit.nitpicks} nitpick(s), ${coderabbit.outsideDiff} outside diff (advisory)`
      )
    ),
    Match.discriminator("signal")("greptile", (greptile) =>
      O.some(
        `greptile: confidence ${O.getOrElse(greptile.confidence, () => "unknown")}, new P0:${greptile.newFindings.p0} P1:${greptile.newFindings.p1} P2:${greptile.newFindings.p2} (advisory)`
      )
    ),
    Match.discriminator("signal")("plain", O.none<string>),
    Match.exhaustive
  );

const reviewBodySignalLine: (signal: YeetReviewBodySignal) => string = flow(
  renderYeetMonitorReviewBodySignal,
  O.match({ onNone: () => Str.empty, onSome: (summary) => `\n  ${summary}` })
);

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
 * @param comment - The normalized review comment, issue comment or review body.
 * @returns The compact multi-line operator string for the comment.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorComment = (comment: YeetMonitorComment): string =>
  Match.value(comment).pipe(
    Match.tag(
      "review",
      (review) =>
        `[yeet] new PR review comment: ${stripTerminalControlSequences(review.author)} @ ${stripTerminalControlSequences(review.path)}:${reviewLine(review.line)}\n  ${excerpt(review.body)}\n  ${stripTerminalControlSequences(review.url)}`
    ),
    Match.tag(
      "issue",
      (issue) =>
        `[yeet] new PR issue comment: ${stripTerminalControlSequences(issue.author)}\n  ${excerpt(issue.body)}\n  ${stripTerminalControlSequences(issue.url)}`
    ),
    Match.tag(
      "review-body",
      (body) =>
        `[yeet] new PR review: ${stripTerminalControlSequences(body.author)} (${stripTerminalControlSequences(body.state)})\n  ${excerpt(body.body)}${reviewBodySignalLine(body.signal)}\n  ${stripTerminalControlSequences(body.url)}`
    ),
    Match.exhaustive
  );

const decodeReviewCommentPages = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.Array(GhRestReviewComment))));
const decodeIssueCommentPages = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.Array(GhRestIssueComment))));
const decodeReviewPages = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.Array(GhRestReview))));

const decodePages =
  <Payload>(decode: (text: string) => Effect.Effect<ReadonlyArray<ReadonlyArray<Payload>>, S.SchemaError>) =>
  (text: string): Effect.Effect<ReadonlyArray<Payload>, S.SchemaError> =>
    Effect.map(decode(text), A.flatten);

/**
 * Warn that a comment page was cut off before it could be read in full.
 *
 * **Example** (Render the truncation warning)
 *
 * ```ts
 * import { renderYeetMonitorCommentTruncation } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetMonitorCommentTruncation("repos/{owner}/{repo}/issues/1/comments"))
 * ```
 *
 * @param endpoint - The REST endpoint whose capture was clipped.
 * @returns The operator warning naming what was kept and what repeats.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorCommentTruncation = (endpoint: string): string =>
  `[yeet] the PR comment read of ${endpoint} was clipped by the capture bound; the rows that were read in full are streamed and the cursor stops at the last of them, so the rest repeat on the next read.`;

// Recover the complete elements of a clipped top-level JSON array. `gh api
// --paginate --slurp` emits one array of pages, so a capture cut mid-object is
// invalid JSON as a whole while every element before the cut is intact: this
// scanner keeps those and closes the containers they were in, and the cursor
// then advances only as far as they reach. The capture's own truncation notice
// is removed first — it carries brackets of its own, and a scanner that read
// them would balance the document against text GitHub never sent.
class ClipScan extends S.Class<ClipScan>($I`ClipScan`)(
  {
    depth: S.Finite,
    inString: S.Boolean,
    escaped: S.Boolean,
    // Offset just past the last container that closed, and the depth it left.
    lastComplete: S.Finite,
    closeDepth: S.Finite,
  },
  $I.annote("ClipScan", { description: "The scanner state after one character of a clipped JSON capture." })
) {}

const clipScanStart = ClipScan.make({ depth: 0, inString: false, escaped: false, lastComplete: 0, closeDepth: 0 });

const scanStringChar = (scan: ClipScan, char: string): ClipScan =>
  ClipScan.make({ ...scan, inString: scan.escaped || char !== '"', escaped: !scan.escaped && char === "\\" });

const scanStructuralChar = (scan: ClipScan, char: string, index: number): ClipScan => {
  if (char === '"') return ClipScan.make({ ...scan, inString: true });
  if (char === "[" || char === "{") return ClipScan.make({ ...scan, depth: scan.depth + 1 });
  if (char === "]" || char === "}") {
    const depth = scan.depth - 1;
    return ClipScan.make({ ...scan, depth, lastComplete: index + 1, closeDepth: depth });
  }
  return scan;
};

const salvageClippedJsonArray = (text: string): string => {
  const scanned = pipe(text, Str.replace(repoRunOutputBound.truncatedNotice, Str.empty));
  let scan = clipScanStart;
  for (let index = 0; index < scanned.length; index = index + 1) {
    const char = scanned[index] ?? Str.empty;
    scan = scan.inString ? scanStringChar(scan, char) : scanStructuralChar(scan, char, index);
    // The outermost array closed: the document is whole up to here.
    if (scan.depth === 0 && scan.lastComplete === index + 1) return scanned.slice(0, index + 1);
  }
  return scan.lastComplete === 0 ? "[]" : `${scanned.slice(0, scan.lastComplete)}${Str.repeat(scan.closeDepth)("]")}`;
};

/**
 * Salvage the intact prefix of a clipped `gh api --paginate --slurp` capture.
 *
 * **Example** (Keep the page that was read in full)
 *
 * ```ts
 * import { salvageYeetMonitorClippedJson } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(salvageYeetMonitorClippedJson('[[{"id":1}],[{"id":2'))
 * ```
 *
 * @param text - The captured, possibly clipped, JSON text.
 * @returns JSON text holding every element that was read in full.
 * @category utilities
 * @since 0.0.0
 */
export const salvageYeetMonitorClippedJson = salvageClippedJsonArray;

/**
 * Read the GitHub login this process acts as.
 *
 * **Details**
 *
 * One `gh api user` read. The merge loop compares comment authors against it
 * so the monitor's own comments (a Greptile retrigger, a `yeet reply`) never
 * become inbox rows. Every failure, a non-zero exit, clipped output or a value
 * that is not a single login, reads as `None`; the caller waits for a later
 * read rather than guessing.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readYeetMonitorActingLogin } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readYeetMonitorActingLogin({ repoRoot: "/repo" }))) // true
 * ```
 *
 * @param context - The checkout gh runs in.
 * @param capture - The command capture boundary; the live runner by default.
 * @returns The acting login, or `None` when gh cannot name it; never fails.
 * @category processes
 * @since 0.0.0
 */
export const readYeetMonitorActingLogin = Effect.fn("YeetMonitor.readActingLogin")(function* (
  context: Pick<RepoRunContext, "repoRoot">,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture
): Effect.fn.Return<O.Option<string>, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  return yield* capture("gh", ["api", "user", "--jq", ".login"], context.repoRoot).pipe(
    Effect.map((result) =>
      result.exitCode === 0 && !result.truncated
        ? pipe(
            Str.trim(result.output),
            O.liftPredicate((login) => Str.isNonEmpty(login) && !/\s/u.test(login))
          )
        : O.none<string>()
    ),
    Effect.orElseSucceed(O.none<string>)
  );
});

const fetchComments = Effect.fn("YeetMonitor.fetchComments")(function* <Comment>(
  context: RepoRunContext,
  endpoint: string,
  since: O.Option<string>,
  decode: (text: string) => Effect.Effect<ReadonlyArray<Comment>, S.SchemaError>
): Effect.fn.Return<ReadonlyArray<Comment>, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture(
    "gh",
    [
      "api",
      "--method",
      "GET",
      endpoint,
      "--paginate",
      "--slurp",
      "-f",
      "per_page=100",
      ...O.match(since, { onNone: A.empty<string>, onSome: (at) => ["-f", `since=${at}`] }),
    ],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to poll pull request comments during yeet monitor.")));
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      command: `gh api --method GET ${endpoint}`,
      exitCode: result.exitCode,
      // The reason travels with the failure: a degraded poll is reported to the
      // operator by message alone, and "the poll failed" without gh's own words
      // cannot distinguish a rate limit from a revoked token.
      message: `Failed to poll pull request comments during yeet monitor: ${excerpt(result.output)}`,
    });
  }
  // A clipped read is no longer a failed read. Losing the whole poll over a
  // loud pull request means the operator sees nothing at all, while keeping the
  // intact prefix shows what was read and leaves the rest behind the cursor.
  if (result.truncated) {
    yield* Console.error(renderYeetMonitorCommentTruncation(endpoint));
    return yield* decode(salvageClippedJsonArray(result.output)).pipe(Effect.orElseSucceed(A.empty<Comment>));
  }
  return yield* decode(result.output).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode pull request comments during yeet monitor."))
  );
});

const nextCursor = (cursor: YeetMonitorCommentCursor, comments: ReadonlyArray<YeetMonitorComment>) =>
  A.reduce(comments, cursor, (latest, comment) =>
    isYeetMonitorCommentAfter(latest, comment) ? commentPosition(comment) : latest
  );

/**
 * Read the persisted comment stream position for one pull request.
 *
 * **Details**
 *
 * Every way the read can go wrong — no artifact yet, an unreadable file, a
 * shape from an unknown schema version, a position recorded against a
 * different pull request — yields `None`, which the caller reads as "start
 * from now". A monitor session must not be blocked by its own resumption
 * optimisation. A `v1` position is *not* one of those ways: it decodes, and
 * its missing review-body cursor is seeded from the earlier of the two cursors
 * it does carry.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { loadYeetMonitorCommentWatermark } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(loadYeetMonitorCommentWatermark))) // true
 * ```
 *
 * @param context - Repo run context carrying the artifact directory and branch.
 * @param pullRequestNumber - The pull request the position must belong to.
 * @param consumer - The consumer mode whose position is read; the shared position by default.
 * @returns The persisted watermark, or `None` when there is no usable one.
 * @category utilities
 * @since 0.0.0
 */
export const loadYeetMonitorCommentWatermark = Effect.fn("YeetMonitor.loadCommentWatermark")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  consumer: YeetMonitorCommentConsumer = YeetMonitorCommentConsumer.Enum.shared
): Effect.fn.Return<O.Option<YeetMonitorCommentWatermark>, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const statePath = yield* yeetMonitorCommentStatePath(context, consumer).pipe(Effect.option);
  if (O.isNone(statePath)) return O.none();
  const text = yield* Effect.option(fs.readFileString(statePath.value));
  return pipe(
    text,
    O.flatMap(YeetMonitorCommentStateStoredJson.decodeOption),
    O.filter((state) => state.prNumber === pullRequestNumber),
    O.map(upgradeStoredWatermark)
  );
});

// Merge rather than overwrite: two surfaces can hold this branch's pull request
// open at once — a monitor loop and an operator's `yeet status --remote` — and
// the second one to finish must not drag a cursor backwards over rows the first
// one already printed. Per-cursor max is the only merge that cannot lose a row.
const mergeWatermarks = (
  current: O.Option<YeetMonitorCommentWatermark>,
  next: YeetMonitorCommentWatermark
): YeetMonitorCommentWatermark =>
  O.match(current, {
    onNone: () => next,
    onSome: (persisted) =>
      YeetMonitorCommentWatermark.make({
        issue: laterCursor(persisted.issue, next.issue),
        review: laterCursor(persisted.review, next.review),
        reviewBody: laterCursor(persisted.reviewBody, next.reviewBody),
      }),
  });

const writeCommentState = Effect.fn("YeetMonitor.writeCommentState")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermark: YeetMonitorCommentWatermark,
  consumer: YeetMonitorCommentConsumer
): Effect.fn.Return<void, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const statePath = yield* yeetMonitorCommentStatePath(context, consumer);
  const updatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const persisted = yield* loadYeetMonitorCommentWatermark(context, pullRequestNumber, consumer);
  const json = yield* YeetMonitorCommentStateJson.encode(
    YeetMonitorCommentState.make({
      schemaVersion: "yeet-monitor-comments/v2",
      prNumber: pullRequestNumber,
      updatedAt,
      watermark: mergeWatermarks(persisted, watermark),
    })
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to encode the yeet monitor comment cursor artifact.")));
  yield* writeTextFile(statePath, `${json}\n`);
});

/**
 * Warn that the comment cursor could not be persisted, naming the consequence.
 *
 * **Example** (Render the warning)
 *
 * ```ts
 * import { renderYeetMonitorCommentStateWarning } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetMonitorCommentStateWarning("disk is full"))
 * ```
 *
 * @param reason - Why the write failed.
 * @returns The operator warning line.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorCommentStateWarning = (reason: string): string =>
  `[yeet] could not persist the PR comment cursor (${reason}); this session still streams, but the next monitor run will start from its own clock and may miss comments posted before it.`;

// Persisting is best effort by design: the position is an optimisation over
// "start from now", and losing it costs one run's worth of resumption, while
// failing the poll over it would cost the whole comment stream.
const persistCommentState = (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermark: YeetMonitorCommentWatermark,
  consumer: YeetMonitorCommentConsumer
): Effect.Effect<void, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> =>
  writeCommentState(context, pullRequestNumber, watermark, consumer).pipe(
    Effect.catch((error) => Console.warn(renderYeetMonitorCommentStateWarning(error.message)))
  );

/**
 * Poll every comment collection once and return the rows past the watermark.
 *
 * **Details**
 *
 * This is the shared core of every comment-observing monitor surface: one poll
 * fetches both REST collections concurrently, filters each against its own
 * cursor, then returns the unseen rows without advancing the watermark. The
 * caller emits those rows and acknowledges them with
 * {@link acknowledgeYeetMonitorComments}; keeping that order prevents a
 * cancellation or encoding failure from persisting past a comment that was
 * never actually surfaced.
 *
 * **Example** (Build the collector effect)
 *
 * ```ts
 * import { collectNewYeetMonitorComments } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(collectNewYeetMonitorComments))) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root and artifact directory.
 * @param pullRequestNumber - The pull request whose comments are polled.
 * @param watermarkRef - The session's last acknowledged watermark.
 * @returns The new comments in `(createdAt, id)` order, possibly empty.
 * @category processes
 * @since 0.0.0
 */
export const collectNewYeetMonitorComments = Effect.fn("YeetMonitor.collectNewComments")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermarkRef: Ref.Ref<YeetMonitorCommentWatermark>
): Effect.fn.Return<
  ReadonlyArray<YeetMonitorComment>,
  YeetCommandError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const watermark = yield* Ref.get(watermarkRef);
  const [reviewPayload, issuePayload, reviewBodyPayload] = yield* Effect.all(
    [
      fetchComments(
        context,
        `repos/{owner}/{repo}/pulls/${pullRequestNumber}/comments`,
        O.some(watermark.review.createdAt),
        decodePages(decodeReviewCommentPages)
      ),
      fetchComments(
        context,
        `repos/{owner}/{repo}/issues/${pullRequestNumber}/comments`,
        O.some(watermark.issue.createdAt),
        decodePages(decodeIssueCommentPages)
      ),
      // The reviews endpoint takes no `since`, so the whole list comes back and
      // the cursor filter below is the only thing standing between the operator
      // and every review the pull request ever received.
      fetchComments(
        context,
        `repos/{owner}/{repo}/pulls/${pullRequestNumber}/reviews`,
        O.none(),
        decodePages(decodeReviewPages)
      ),
    ],
    { concurrency: 3 }
  );
  const reviewComments = pipe(reviewPayload, A.map(normalizeReviewComment));
  const issueComments = pipe(issuePayload, A.map(normalizeIssueComment));
  const reviewBodies = pipe(reviewBodyPayload, A.map(normalizeReviewBody), A.getSomes);
  const newReviewComments = A.filter(reviewComments, (comment) => isYeetMonitorCommentAfter(watermark.review, comment));
  const newIssueComments = A.filter(issueComments, (comment) => isYeetMonitorCommentAfter(watermark.issue, comment));
  const newReviewBodies = A.filter(reviewBodies, (body) => isYeetMonitorCommentAfter(watermark.reviewBody, body));
  return A.sort([...newReviewComments, ...newIssueComments, ...newReviewBodies], commentOrder);
});

/**
 * Advance and persist the comment watermark after a batch has been emitted.
 *
 * **Details**
 *
 * Acknowledgment is deliberately separate from collection. Callers first
 * render or encode every row, then acknowledge the batch. If emission is
 * interrupted, the old cursor remains durable and the next session repeats
 * the unseen row instead of losing it.
 *
 * **Example** (Build an acknowledgment effect)
 *
 * ```ts
 * import { acknowledgeYeetMonitorComments } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(acknowledgeYeetMonitorComments))) // true
 * ```
 *
 * @param context - Repo run context carrying the artifact directory.
 * @param pullRequestNumber - The pull request whose rows were emitted.
 * @param watermarkRef - The session watermark to advance.
 * @param comments - The successfully emitted comments to acknowledge.
 * @param consumer - The consumer mode whose position is persisted; the shared position by default.
 * @returns Nothing after the in-memory and durable cursors are advanced.
 * @category processes
 * @since 0.0.0
 */
export const acknowledgeYeetMonitorComments = Effect.fn("YeetMonitor.acknowledgeComments")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermarkRef: Ref.Ref<YeetMonitorCommentWatermark>,
  comments: ReadonlyArray<YeetMonitorComment>,
  consumer: YeetMonitorCommentConsumer = YeetMonitorCommentConsumer.Enum.shared
): Effect.fn.Return<void, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  if (A.isReadonlyArrayEmpty(comments)) {
    return;
  }
  const watermark = yield* Ref.get(watermarkRef);
  const reviewComments = A.filter(comments, isYeetMonitorReviewComment);
  const issueComments = A.filter(comments, isYeetMonitorIssueComment);
  const reviewBodies = A.filter(comments, isYeetMonitorReviewBody);
  const advanced = YeetMonitorCommentWatermark.make({
    issue: nextCursor(watermark.issue, issueComments),
    review: nextCursor(watermark.review, reviewComments),
    reviewBody: nextCursor(watermark.reviewBody, reviewBodies),
  });
  yield* Ref.set(watermarkRef, advanced);
  yield* persistCommentState(context, pullRequestNumber, advanced, consumer);
});

const pollComments = Effect.fn("YeetMonitor.pollComments")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermarkRef: Ref.Ref<YeetMonitorCommentWatermark>
): Effect.fn.Return<
  void,
  YeetCommandError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const newComments = yield* collectNewYeetMonitorComments(context, pullRequestNumber, watermarkRef);
  yield* Effect.forEach(newComments, (comment) => Console.log(renderYeetMonitorComment(comment)), {
    concurrency: 1,
    discard: true,
  });
  yield* acknowledgeYeetMonitorComments(context, pullRequestNumber, watermarkRef, newComments);
});

/**
 * How many consecutive failed polls end the comment stream.
 *
 * **Details**
 *
 * A bound, not a retry budget: each failure is reported as it happens and the
 * next poll still runs, so a rate limit or a dropped connection costs one tick.
 * The bound exists for the failure that is not transient — a revoked token, a
 * deleted pull request — where continuing to print the same error every ten
 * seconds for the length of a CI run is noise, not signal.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { YEET_MONITOR_COMMENT_FAILURE_BUDGET } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MONITOR_COMMENT_FAILURE_BUDGET)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_MONITOR_COMMENT_FAILURE_BUDGET = 5;

// Printed by the tick below rather than exported: the line is proven where it
// is emitted, and a three-parameter renderer has no meaningful data-last
// partner to satisfy the pipeable-signature rule with.
const renderCommentPollFailure = (reason: string, failures: number, budget: number): string =>
  `[yeet] PR comment poll failed (${failures}/${budget}): ${reason} Check watching is unaffected.`;

/**
 * Report that comment streaming stopped while the session continues.
 *
 * **Example** (Render the degraded notice)
 *
 * ```ts
 * import { renderYeetMonitorCommentStreamStopped } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetMonitorCommentStreamStopped(5))
 * ```
 *
 * @param budget - The consecutive-failure bound that was reached.
 * @returns The operator line naming the degradation and how to see comments.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorCommentStreamStopped = (budget: number): string =>
  `[yeet] PR comment streaming stopped after ${budget} consecutive failed polls; this session keeps watching checks. Read comments with \`bun run beep yeet status --remote\` or on the pull request.`;

const pollTick = Effect.fn("YeetMonitor.pollTick")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermarkRef: Ref.Ref<YeetMonitorCommentWatermark>,
  failuresRef: Ref.Ref<number>,
  budget: number
): Effect.fn.Return<
  void,
  never,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const polled = yield* Effect.result(pollComments(context, pullRequestNumber, watermarkRef));
  if (Result.isSuccess(polled)) {
    return yield* Ref.set(failuresRef, 0);
  }
  const failures = yield* Ref.updateAndGet(failuresRef, (count) => count + 1);
  yield* Console.error(renderCommentPollFailure(polled.failure.message, failures, budget));
  if (failures < budget) {
    return;
  }
  yield* Console.error(renderYeetMonitorCommentStreamStopped(budget));
  // Parking instead of returning is the whole point: this poller is raced
  // against the check watcher, so *completing* here — success or failure —
  // would cancel the checks. A stream that has given up must become a fiber
  // that never decides the race.
  return yield* Effect.never;
});

/**
 * Report where this session's comment stream starts.
 *
 * **Example** (Render a resumed start)
 *
 * ```ts
 * import { renderYeetMonitorCommentStreamStart } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(renderYeetMonitorCommentStreamStart(O.some("2026-08-16T12:00:00.000Z")))
 * ```
 *
 * @param resumedFrom - The persisted position's timestamp, when one was found.
 * @returns The operator line naming the stream's starting position.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorCommentStreamStart: (resumedFrom: O.Option<string>) => string = flow(
  O.match({
    onNone: () => "[yeet] streaming new PR comments from now (no saved position for this branch)",
    onSome: (createdAt) => `[yeet] resuming the PR comment stream from ${createdAt}`,
  })
);

// Where a consumer with no position of its own starts. The shared position
// starts at the window as it always has; a namespaced consumer also reads the
// shared position and takes the later cursor per collection, so its first run
// cannot replay what that file already covered.
const seedCommentWatermark = Effect.fnUntraced(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  consumer: YeetMonitorCommentConsumer,
  windowStart: string
): Effect.fn.Return<YeetMonitorCommentWatermark, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const cursor = YeetMonitorCommentCursor.make({ createdAt: windowStart, id: 0 });
  const start = YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor, reviewBody: cursor });
  if (YeetMonitorCommentConsumer.is.shared(consumer)) return start;
  return mergeWatermarks(yield* loadYeetMonitorCommentWatermark(context, pullRequestNumber), start);
});

/**
 * Open a comment-stream session against one consumer's persisted position.
 *
 * **Details**
 *
 * Loads the consumer's branch-scoped watermark artifact and falls back to
 * "start from now" when there is none. A first session on this branch writes
 * its starting position immediately rather than only when it observes
 * something — otherwise a quiet session leaves no position at all, and the
 * next run starts from *its* own clock, which is precisely the gap a comment
 * posted between the two runs falls into. The watermark comes back as a `Ref`
 * so {@link acknowledgeYeetMonitorComments} can advance it after every batch
 * has been emitted successfully.
 *
 * A namespaced consumer (not `shared`) with no position of its own is seeded
 * from `windowStart` (now, when absent) or the shared position in the original
 * `monitor-comments.json`, whichever is later, per collection. The first
 * namespaced run therefore replays none of the history the shared file already
 * covered, as lines or as rows, and nothing from before its window.
 *
 * **Example** (Build the opener effect)
 *
 * ```ts
 * import { openYeetMonitorCommentStream } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(openYeetMonitorCommentStream))) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root and artifact directory.
 * @param pullRequestNumber - The pull request the session belongs to.
 * @param consumer - The consumer mode whose position is opened; the shared position by default.
 * @param windowStart - Where a first namespaced position may start at the earliest; now when absent.
 * @returns The live watermark feeding {@link collectNewYeetMonitorComments}.
 * @category constructors
 * @since 0.0.0
 */
export const openYeetMonitorCommentStream = Effect.fn("YeetMonitor.openCommentStream")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  consumer: YeetMonitorCommentConsumer = YeetMonitorCommentConsumer.Enum.shared,
  windowStart: O.Option<string> = O.none()
): Effect.fn.Return<Ref.Ref<YeetMonitorCommentWatermark>, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const persisted = yield* loadYeetMonitorCommentWatermark(context, pullRequestNumber, consumer);
  const watermark = O.isSome(persisted)
    ? persisted.value
    : yield* seedCommentWatermark(
        context,
        pullRequestNumber,
        consumer,
        O.getOrElse(windowStart, () => startedAt)
      );
  const watermarkRef = yield* Ref.make(watermark);
  if (O.isNone(persisted)) {
    yield* persistCommentState(context, pullRequestNumber, watermark, consumer);
  }
  return watermarkRef;
});

/**
 * Poll and stream pull request comments until the surrounding monitor interrupts it.
 *
 * **When to use**
 *
 * Use with the existing hosted-check watcher so comments and pipeline state are
 * visible during the same Yeet monitor session.
 *
 * **Details**
 *
 * The session resumes from the branch-scoped position written by the previous
 * run, so a comment posted between two monitor runs is printed by the second
 * one. With no usable saved position the stream starts from now — the old
 * behaviour and the only safe fallback — and writes that starting position
 * straight away, so even a session that prints nothing leaves the next one a
 * position to resume from.
 *
 * **Gotchas**
 *
 * This effect cannot fail. That is a contract, not an accident: it is raced
 * against the check watcher, and an error channel here would let one failed
 * GitHub read cancel the checks the operator is actually waiting on.
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
 * @param context - Repo run context carrying the repo root and artifact directory.
 * @param pullRequestNumber - The pull request whose comments are streamed.
 * @param budget - Consecutive failed polls that stop the stream; tests pass a
 * small one to reach the degraded state without waiting.
 * @returns A fiber that streams until interrupted and never completes.
 * @category streams
 * @since 0.0.0
 */
export const runYeetPullRequestCommentMonitor = Effect.fn("Yeet.runPullRequestCommentMonitor")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  budget: number = YEET_MONITOR_COMMENT_FAILURE_BUDGET
): Effect.fn.Return<
  never,
  never,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  // The earlier of the two persisted cursors is where the stream genuinely
  // resumes: the collections advance independently, so quoting one of them
  // would understate how far back the other still reaches.
  const persisted = yield* loadYeetMonitorCommentWatermark(context, pullRequestNumber);
  yield* Console.log(renderYeetMonitorCommentStreamStart(O.map(persisted, earliestWatermarkAt)));
  const watermarkRef = yield* openYeetMonitorCommentStream(context, pullRequestNumber);
  const failuresRef = yield* Ref.make(0);
  return yield* Effect.forever(
    pollTick(context, pullRequestNumber, watermarkRef, failuresRef, budget).pipe(
      Effect.andThen(Effect.sleep(monitorPollInterval))
    )
  );
});

/**
 * Report how much of the comment stream one replay is about to print.
 *
 * **Example** (Announce two missed comments)
 *
 * ```ts
 * import { renderYeetMonitorCommentReplay } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetMonitorCommentReplay(2, "2026-09-22T12:00:00.000Z"))
 * ```
 *
 * @param count - How many rows the replay found past the watermark.
 * @param since - The watermark instant the replay read from.
 * @returns The one-line replay header.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorCommentReplay: {
  (count: number, since: string): string;
  (since: string): (count: number) => string;
} = dual(2, (count: number, since: string): string =>
  count === 0
    ? `[yeet] comment replay: nothing new since ${since}`
    : `[yeet] comment replay: ${count} comment(s) since ${since}`
);

/**
 * Report that this branch had no saved position, so the replay starts here.
 *
 * **Details**
 *
 * The honest first-open line. There is nothing to replay because nothing was
 * ever recorded, and saying so — with the instant the new watermark starts at
 * — is what tells the operator that the *next* read is the one that resumes.
 *
 * **Example** (Announce a first open)
 *
 * ```ts
 * import { renderYeetMonitorCommentReplayStart } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetMonitorCommentReplayStart(1184, "2026-09-22T12:00:00.000Z"))
 * ```
 *
 * @param pullRequestNumber - The pull request that had no recorded position.
 * @param startedAt - The instant the new watermark starts from.
 * @returns The one-line first-open notice.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorCommentReplayStart: {
  (pullRequestNumber: number, startedAt: string): string;
  (startedAt: string): (pullRequestNumber: number) => string;
} = dual(
  2,
  (pullRequestNumber: number, startedAt: string): string =>
    `[yeet] comment replay: no watermark for #${pullRequestNumber}; starting at ${startedAt}`
);

/**
 * Report that the replay could not read GitHub, without failing the command.
 *
 * **Example** (Render the degraded replay notice)
 *
 * ```ts
 * import { renderYeetMonitorCommentReplayFailure } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetMonitorCommentReplayFailure("gh: API rate limit exceeded"))
 * ```
 *
 * @param reason - Why the read failed, in gh's own words.
 * @returns The operator warning naming the consequence.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorCommentReplayFailure = (reason: string): string =>
  `[yeet] comment replay unavailable: ${reason} The saved position is unchanged, so nothing was skipped.`;

/**
 * Print every comment posted since this branch's saved position, once.
 *
 * **When to use**
 *
 * At the head of a read-first surface — `yeet status --remote`, `yeet closeout`,
 * the first cycle of the merge loop — where the operator is about to be told
 * whether the pull request is mergeable and should first see what was said
 * while nothing was attached.
 *
 * **Details**
 *
 * One pass, not a loop: collect past the watermark, print each row, then
 * acknowledge, in that order, so an interrupted print repeats rather than
 * disappears. A branch with no saved position replays nothing — there is no
 * "since" to read from — and records its starting position instead, which is
 * what makes the *next* open a resumption.
 *
 * **Gotchas**
 *
 * This effect cannot fail. A closeout that exits non-zero because GitHub was
 * briefly unreachable while it tried to print old comments would be reporting
 * the wrong thing entirely, so a failed read degrades to one warning line and
 * leaves the cursor exactly where it was.
 *
 * **Example** (Build the replay effect)
 *
 * ```ts
 * import { replayYeetMonitorComments } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(replayYeetMonitorComments))) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root and artifact directory.
 * @param pullRequestNumber - The pull request whose stream is replayed.
 * @param consumer - The consumer mode whose position is replayed; the shared position by default.
 * @returns Nothing once the missed rows have been printed and acknowledged.
 * @category processes
 * @since 0.0.0
 */
export const replayYeetMonitorComments = Effect.fn("Yeet.replayMonitorComments")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  consumer: YeetMonitorCommentConsumer = YeetMonitorCommentConsumer.Enum.shared
): Effect.fn.Return<
  void,
  never,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const persisted = yield* loadYeetMonitorCommentWatermark(context, pullRequestNumber, consumer);
  const watermarkRef = yield* openYeetMonitorCommentStream(context, pullRequestNumber, consumer);
  const since = earliestWatermarkAt(yield* Ref.get(watermarkRef));
  if (O.isNone(persisted)) {
    return yield* Console.log(renderYeetMonitorCommentReplayStart(pullRequestNumber, since));
  }
  const collected = yield* Effect.result(collectNewYeetMonitorComments(context, pullRequestNumber, watermarkRef));
  if (Result.isFailure(collected)) {
    return yield* Console.error(renderYeetMonitorCommentReplayFailure(collected.failure.message));
  }
  yield* Console.log(renderYeetMonitorCommentReplay(A.length(collected.success), since));
  yield* Effect.forEach(collected.success, (comment) => Console.log(renderYeetMonitorComment(comment)), {
    concurrency: 1,
    discard: true,
  });
  yield* acknowledgeYeetMonitorComments(context, pullRequestNumber, watermarkRef, collected.success, consumer);
});
