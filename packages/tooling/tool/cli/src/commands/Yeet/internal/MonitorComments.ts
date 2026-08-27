/**
 * Pull request comment streaming for Yeet monitor sessions.
 *
 * **Details**
 *
 * The stream is durable across runs and independent of the check watcher it is
 * raced against. Durable: the per-collection watermarks are persisted to a
 * branch-scoped artifact after every poll that advances them, so a comment
 * posted while no monitor was attached is printed by the next run instead of
 * falling into the gap between a process exit and the next process start.
 * Independent: a poll that fails degrades this stream alone — the surrounding
 * race can never be decided by a GitHub read error, because the poller's error
 * channel is `never` by construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Console, DateTime, Duration, Effect, FileSystem, Match, Order, pipe, Ref, Result } from "effect";
import * as A from "effect/Array";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhActor } from "../../../internal/github/index.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { writeTextFile } from "./IssueArtifacts.ts";
import type { Path } from "effect";
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
 * The pair of cursors one monitor session advances.
 *
 * **Details**
 *
 * GitHub exposes inline review comments and conversation comments as two
 * collections with independent id spaces and independent `since` filters, so
 * one shared cursor would let a busy collection drag the quiet one forward and
 * silently skip its comments. They are carried together because they are
 * advanced and persisted together — one poll, one write.
 *
 * **Example** (Start both cursors at the same instant)
 *
 * ```ts
 * import { YeetMonitorCommentCursor, YeetMonitorCommentWatermark } from "@beep/repo-cli/test/Yeet"
 *
 * const cursor = YeetMonitorCommentCursor.make({ createdAt: "2026-08-16T12:00:00.000Z", id: 0 })
 * const watermark = YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor })
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
  },
  $I.annote("YeetMonitorCommentWatermark", {
    description: "Per-collection comment cursors for one pull request monitor session.",
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
 *   schemaVersion: "yeet-monitor-comments/v1",
 *   prNumber: 558,
 *   updatedAt: "2026-08-16T12:00:05.000Z",
 *   watermark: YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor }),
 * })
 * console.log(state.prNumber) // 558
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorCommentState extends S.Class<YeetMonitorCommentState>($I`YeetMonitorCommentState`)(
  {
    schemaVersion: S.Literal("yeet-monitor-comments/v1"),
    prNumber: S.Int.check(S.isGreaterThan(0)),
    updatedAt: S.String,
    watermark: YeetMonitorCommentWatermark,
  },
  $I.annote("YeetMonitorCommentState", {
    description: "Branch-scoped comment stream position carried between Yeet monitor runs.",
  })
) {}

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
 *   schemaVersion: "yeet-monitor-comments/v1",
 *   prNumber: 558,
 *   updatedAt: "2026-08-16T12:00:05.000Z",
 *   watermark: YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor }),
 * })
 * console.log(Effect.runSync(YeetMonitorCommentStateJson.encode(state)).includes("yeet-monitor-comments/v1"))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetMonitorCommentStateJson = JsonStringCodec(YeetMonitorCommentState);

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
 * Resolve the branch-scoped comment stream position artifact path.
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
 * @returns Absolute path to the branch-scoped `monitor-comments.json`.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorCommentStatePath = (context: RepoRunContext): Effect.Effect<string, never, Path.Path> =>
  runArtifactPathForContext(context, YEET_MONITOR_COMMENT_STATE_FILE_NAME);

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

const excerpt = (body: string): string => yeetCommentExcerpt(body, commentExcerptLength);

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
        `[yeet] new PR review comment: ${stripTerminalControlSequences(review.author)} @ ${stripTerminalControlSequences(review.path)}:${reviewLine(review.line)}\n  ${excerpt(review.body)}\n  ${stripTerminalControlSequences(review.url)}`,
      issue: (issue) =>
        `[yeet] new PR issue comment: ${stripTerminalControlSequences(issue.author)}\n  ${excerpt(issue.body)}\n  ${stripTerminalControlSequences(issue.url)}`,
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
      // The reason travels with the failure: a degraded poll is reported to the
      // operator by message alone, and "the poll failed" without gh's own words
      // cannot distinguish a rate limit from a revoked token.
      message: `Failed to poll pull request comments during yeet monitor: ${excerpt(result.output)}`,
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

const writeCommentState = Effect.fn("YeetMonitor.writeCommentState")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermark: YeetMonitorCommentWatermark
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const statePath = yield* yeetMonitorCommentStatePath(context);
  const updatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const json = yield* YeetMonitorCommentStateJson.encode(
    YeetMonitorCommentState.make({
      schemaVersion: "yeet-monitor-comments/v1",
      prNumber: pullRequestNumber,
      updatedAt,
      watermark,
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
  watermark: YeetMonitorCommentWatermark
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  writeCommentState(context, pullRequestNumber, watermark).pipe(
    Effect.catch((error) => Console.warn(renderYeetMonitorCommentStateWarning(error.message)))
  );

/**
 * Read the persisted comment stream position for one pull request.
 *
 * **Details**
 *
 * Every way the read can go wrong — no artifact yet, an unreadable file, a
 * shape from an older schema version, a position recorded against a different
 * pull request — yields `None`, which the caller reads as "start from now".
 * A monitor session must not be blocked by its own resumption optimisation.
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
 * @returns The persisted watermark, or `None` when there is no usable one.
 * @category utilities
 * @since 0.0.0
 */
export const loadYeetMonitorCommentWatermark = Effect.fn("YeetMonitor.loadCommentWatermark")(function* (
  context: RepoRunContext,
  pullRequestNumber: number
): Effect.fn.Return<O.Option<YeetMonitorCommentWatermark>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const statePath = yield* yeetMonitorCommentStatePath(context);
  const text = yield* Effect.option(fs.readFileString(statePath));
  return pipe(
    text,
    O.flatMap(YeetMonitorCommentStateJson.decodeOption),
    O.filter((state) => state.prNumber === pullRequestNumber),
    O.map((state) => state.watermark)
  );
});

/**
 * Poll both comment collections once and return the comments past the watermark.
 *
 * **Details**
 *
 * This is the shared core of every comment-observing monitor surface: one poll
 * fetches both REST collections concurrently, filters each against its own
 * cursor, and — when anything new arrived — advances the in-memory watermark
 * and persists it through the branch-scoped artifact before returning. The
 * classic monitor's forever-poller prints what this returns; the watch stream
 * turns it into typed event rows. Persisting inside the collector is what makes
 * relaunch loops lossless: by the time a caller has acted on a comment, the
 * next session's resume point already excludes it.
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
 * @param watermarkRef - The session's watermark; advanced when comments arrive.
 * @returns The new comments in `(createdAt, id)` order, possibly empty.
 * @category execution
 * @since 0.0.0
 */
export const collectNewYeetMonitorComments = Effect.fn("YeetMonitor.collectNewComments")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermarkRef: Ref.Ref<YeetMonitorCommentWatermark>
): Effect.fn.Return<
  ReadonlyArray<YeetMonitorComment>,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
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
  if (A.isReadonlyArrayEmpty(newComments)) {
    return newComments;
  }
  const advanced = YeetMonitorCommentWatermark.make({
    issue: nextCursor(watermark.issue, newIssueComments),
    review: nextCursor(watermark.review, newReviewComments),
  });
  yield* Ref.set(watermarkRef, advanced);
  yield* persistCommentState(context, pullRequestNumber, advanced);
  return newComments;
});

const pollComments = Effect.fn("YeetMonitor.pollComments")(function* (
  context: RepoRunContext,
  pullRequestNumber: number,
  watermarkRef: Ref.Ref<YeetMonitorCommentWatermark>
): Effect.fn.Return<
  void,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const newComments = yield* collectNewYeetMonitorComments(context, pullRequestNumber, watermarkRef);
  yield* Effect.forEach(newComments, (comment) => Console.log(renderYeetMonitorComment(comment)), { concurrency: 1 });
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
): Effect.fn.Return<void, never, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path> {
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
export const renderYeetMonitorCommentStreamStart = (resumedFrom: O.Option<string>): string =>
  pipe(
    resumedFrom,
    O.match({
      onNone: () => "[yeet] streaming new PR comments from now (no saved position for this branch)",
      onSome: (createdAt) => `[yeet] resuming the PR comment stream from ${createdAt}`,
    })
  );

/**
 * Open a comment-stream session against the branch's persisted position.
 *
 * **Details**
 *
 * Loads the branch-scoped watermark artifact and falls back to "start from
 * now" when there is none. A first session on this branch writes its starting
 * position immediately rather than only when it observes something — otherwise
 * a quiet session leaves no position at all, and the next run starts from
 * *its* own clock, which is precisely the gap a comment posted between the two
 * runs falls into. The watermark comes back as a `Ref` because
 * {@link collectNewYeetMonitorComments} advances it in place on every poll
 * that saw comments.
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
 * @returns The live watermark feeding {@link collectNewYeetMonitorComments}.
 * @category constructors
 * @since 0.0.0
 */
export const openYeetMonitorCommentStream = Effect.fn("YeetMonitor.openCommentStream")(function* (
  context: RepoRunContext,
  pullRequestNumber: number
): Effect.fn.Return<Ref.Ref<YeetMonitorCommentWatermark>, never, FileSystem.FileSystem | Path.Path> {
  const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const initialCursor = YeetMonitorCommentCursor.make({ createdAt: startedAt, id: 0 });
  const persisted = yield* loadYeetMonitorCommentWatermark(context, pullRequestNumber);
  const watermark = O.getOrElse(persisted, () =>
    YeetMonitorCommentWatermark.make({ issue: initialCursor, review: initialCursor })
  );
  const watermarkRef = yield* Ref.make(watermark);
  if (O.isNone(persisted)) {
    yield* persistCommentState(context, pullRequestNumber, watermark);
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
): Effect.fn.Return<never, never, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path> {
  // The earlier of the two persisted cursors is where the stream genuinely
  // resumes: the collections advance independently, so quoting one of them
  // would understate how far back the other still reaches.
  const persisted = yield* loadYeetMonitorCommentWatermark(context, pullRequestNumber);
  yield* Console.log(
    renderYeetMonitorCommentStreamStart(
      O.map(persisted, (watermark) => Order.min(commentCursorOrder)(watermark.issue, watermark.review).createdAt)
    )
  );
  const watermarkRef = yield* openYeetMonitorCommentStream(context, pullRequestNumber);
  const failuresRef = yield* Ref.make(0);
  return yield* Effect.forever(
    pollTick(context, pullRequestNumber, watermarkRef, failuresRef, budget).pipe(
      Effect.andThen(Effect.sleep(monitorPollInterval))
    )
  );
});
