/**
 * Inbox convergence shared by `yeet monitor --watch` and `yeet monitor --until-ready`.
 *
 * **Details**
 *
 * One observation of a pull request becomes inbox rows. Each failing check
 * dispatches through `Remediation`, which writes the capsule, the
 * `check-failed` row and the wave record. Each outstanding review thread
 * holds one unacknowledged `review-thread` row, and a `BEHIND` merge state
 * appends one `base-drift` row. Row ids are deterministic and the wave record
 * drops capsule ids it already holds, so running this on every poll is
 * idempotent.
 * The next poll is also how a row whose append failed gets retried, as long as
 * its red is still there.
 *
 * Both loops call it. The watch passes its own snapshot and the merge loop
 * passes the status snapshot, whose checks carry the same record. The input is
 * narrowed to the fields convergence reads, so neither loop's snapshot type
 * leaks into the other.
 *
 * **Gotchas**
 *
 * Convergence moves the wave record to a new head only as a side effect of a
 * red: a head whose polls show no red leaves the previous head's wave in
 * place, and the previous head's rows keep reading as live. Pinning a newly
 * observed head is therefore the caller's job, done before converging, because
 * the two loops notice a head change in different places.
 *
 * Pull request comments converge only under `--until-ready`
 * ({@link pollYeetPrCommentRows}); `--watch` keeps printing them. Comment rows
 * are wave-exempt, so they never enter the per-head wave record and a push
 * never supersedes them. They still wake `yeet job wait`: its wave is read from
 * the inbox, not from the wave record, as every unacknowledged, not superseded
 * wake-set row (any P0 row, or a P1 `review-thread` or `pr-comment` row) on the
 * job's pull request that no earlier wait on the job returned, and a new P1
 * `pr-comment` row is one.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Console, DateTime, Effect, Match, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readYeetAckState } from "./Ack.ts";
import { YeetCheckOutcome } from "./CheckOutcome.ts";
import {
  appendYeetInboxRowOnce,
  YeetBaseDriftCapsule,
  YeetBaseDriftRow,
  YeetPrCommentCapsule,
  YeetPrCommentRow,
  YeetPrCommentSource,
  YeetReviewThreadCapsule,
  YeetReviewThreadRow,
  yeetBaseDriftRowId,
  yeetInboxReviewThreadRowIds,
  yeetPrCommentRowId,
  yeetReviewThreadRowId,
} from "./Inbox.ts";
import {
  acknowledgeYeetMonitorComments,
  collectNewYeetMonitorComments,
  openYeetMonitorCommentStream,
  YEET_MONITOR_COMMENT_EXCERPT_LENGTH,
  YeetMonitorCommentConsumer,
  yeetCommentExcerpt,
  yeetMonitorCommentFromBot,
} from "./MonitorComments.ts";
import { dispatchYeetCheckFailure } from "./Remediation.ts";
import { YeetWatchCheck, YeetWatchThread, yeetWatchThreadOutstanding } from "./WatchStream.ts";
import type { FileSystem, Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetCommandError } from "../Yeet.errors.ts";
import type { YeetMonitorComment } from "./MonitorComments.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Converge");

/**
 * The part of one pull-request observation that inbox convergence reads.
 *
 * **Details**
 *
 * `checks` are whole check records, never names to re-resolve, because a
 * rollup can carry two checks with the same name. `threads` carry the
 * classified state, and only outstanding ones (`unresolved`,
 * `resolved-follow-up`) become rows. `mergeStateStatus` is GitHub's raw
 * vocabulary; only `BEHIND` writes a row.
 *
 * **Example** (Build an observation)
 *
 * ```ts
 * import { YeetConvergeObservation, YeetWatchCheck } from "@beep/repo-cli/test/Yeet"
 *
 * const observation = YeetConvergeObservation.make({
 *   checks: [YeetWatchCheck.make({ name: "Check", outcome: "fail" })],
 *   headSha: "abc123",
 *   mergeStateStatus: "CLEAN",
 *   prNumber: 751,
 *   threads: []
 * })
 *
 * console.log(observation.checks.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetConvergeObservation extends S.Class<YeetConvergeObservation>($I`YeetConvergeObservation`)(
  {
    checks: S.Array(YeetWatchCheck),
    headSha: S.NonEmptyString,
    mergeStateStatus: S.String,
    prNumber: S.Finite,
    threads: S.Array(YeetWatchThread),
  },
  $I.annote("YeetConvergeObservation", {
    description:
      "One pull-request observation narrowed to what inbox convergence reads: head, number, checks, threads and merge state.",
  })
) {}

// Review threads are wave-exempt: a push does not resolve them, so their rows
// stay live across heads. A thread still outstanding on a new head keeps the
// unacknowledged row an earlier head wrote instead of gaining one live row per
// push; once that row is acknowledged, the next head appends a fresh one.
const threadRowOpen = Effect.fn("Yeet.convergeThreadRowOpen")(function* (
  repoRoot: string,
  observation: YeetConvergeObservation,
  thread: YeetWatchThread
) {
  const ids = yield* yeetInboxReviewThreadRowIds(repoRoot, observation.prNumber, thread.id);
  const acks = yield* Effect.forEach(ids, (id) => readYeetAckState(repoRoot, id));
  return A.some(acks, (ack) => !ack.acked);
});

const appendOutstandingThreadRow = Effect.fn("Yeet.convergeReviewThread")(function* (
  repoRoot: string,
  observation: YeetConvergeObservation,
  thread: YeetWatchThread,
  at: string
) {
  if (yield* threadRowOpen(repoRoot, observation, thread)) return;
  const capsule = YeetReviewThreadCapsule.make({
    headSha: observation.headSha,
    link: null,
    prNumber: observation.prNumber,
    threadId: thread.id,
  });
  const id = yield* yeetReviewThreadRowId(capsule);
  yield* appendYeetInboxRowOnce(
    repoRoot,
    YeetReviewThreadRow.make({ capsule, checkout: repoRoot, id, severity: "P1", ts: at })
  );
});

const appendBaseDriftRow = Effect.fn("Yeet.convergeBaseDrift")(function* (
  context: Pick<RepoRunContext, "base" | "repoRoot">,
  observation: YeetConvergeObservation,
  at: string
) {
  const capsule = YeetBaseDriftCapsule.make({
    base: context.base,
    headSha: observation.headSha,
    prNumber: observation.prNumber,
  });
  const id = yield* yeetBaseDriftRowId(capsule);
  yield* appendYeetInboxRowOnce(
    context.repoRoot,
    YeetBaseDriftRow.make({ capsule, checkout: context.repoRoot, id, severity: "P2", ts: at })
  );
});

/**
 * Converge the checkout's inbox to one pull-request observation.
 *
 * **Details**
 *
 * Every failing check is dispatched with its own record, so the capsule a
 * `--until-ready` row carries is the one a `--watch` row carries. Every
 * outstanding thread appends a P1 `review-thread` row once; because thread rows
 * stay live across a push, a thread whose earlier row is still unacknowledged
 * gets no second row on a new head. A `BEHIND` merge state appends a P2
 * `base-drift` row once. Nothing here fails the caller: a failed append is
 * reported on stderr and retried by the next call.
 *
 * **Example** (Build the convergence effect)
 *
 * ```ts
 * import { convergeYeetInbox, YeetConvergeObservation } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const observation = YeetConvergeObservation.make({
 *   checks: [],
 *   headSha: "abc123",
 *   mergeStateStatus: "BEHIND",
 *   prNumber: 751,
 *   threads: []
 * })
 *
 * console.log(Effect.isEffect(convergeYeetInbox({ base: "origin/main", repoRoot: "/repo" }, observation, "2026-09-25T00:00:00Z"))) // true
 * ```
 *
 * @param context - The checkout whose inbox receives the rows, and the base a drift row names.
 * @param observation - The observed head, number, checks, threads and merge state.
 * @param at - The observation timestamp stamped on every row written.
 * @returns Nothing; every failure path degrades to a stderr line.
 * @category services
 * @since 0.0.0
 */
export const convergeYeetInbox = Effect.fn("Yeet.convergeInbox")(function* (
  context: Pick<RepoRunContext, "base" | "repoRoot">,
  observation: YeetConvergeObservation,
  at: string
): Effect.fn.Return<void, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  yield* Effect.forEach(
    A.filter(observation.checks, (check) => YeetCheckOutcome.is.fail(check.outcome)),
    (check) => dispatchYeetCheckFailure(context.repoRoot, observation, check, at),
    { discard: true }
  );
  yield* Effect.forEach(
    A.filter(observation.threads, yeetWatchThreadOutstanding),
    (thread) =>
      appendOutstandingThreadRow(context.repoRoot, observation, thread, at).pipe(
        Effect.catch((error) =>
          Console.error(`[yeet] failed to append review-thread inbox row ${thread.id}: ${error.message}`)
        )
      ),
    { discard: true }
  );
  if (Str.toUpperCase(observation.mergeStateStatus) === "BEHIND") {
    yield* appendBaseDriftRow(context, observation, at).pipe(
      Effect.catch((error) => Console.error(`[yeet] failed to append base-drift inbox row: ${error.message}`))
    );
  }
});

/**
 * The pull request a comment poll turns into rows, and the bounds on which comments qualify.
 *
 * **Details**
 *
 * `since` is the start of the comment window: the monitor job's submit time,
 * or the loop's first poll for an attended run (pr-event-awareness D32). Only
 * comments created after it become rows; older ones only advance the
 * watermark, and a comment posted between a previous monitor's exit and this
 * submit is the accepted miss. `actingLogin` is the GitHub login the monitor
 * acts as, whose comments never become rows. `headSha` is the head observed
 * on the poll, stamped on each capsule as evidence.
 *
 * **Example** (Build a window)
 *
 * ```ts
 * import { YeetPrCommentWindow } from "@beep/repo-cli/test/Yeet"
 *
 * const window = YeetPrCommentWindow.make({
 *   actingLogin: "operator",
 *   headSha: "abc123",
 *   prNumber: 900,
 *   since: "2026-09-25T00:00:00.000Z"
 * })
 * console.log(window.prNumber) // 900
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrCommentWindow extends S.Class<YeetPrCommentWindow>($I`YeetPrCommentWindow`)(
  {
    actingLogin: S.NonEmptyString,
    headSha: S.NonEmptyString,
    prNumber: S.Finite,
    since: S.String,
  },
  $I.annote("YeetPrCommentWindow", {
    description:
      "The pull request, observed head, acting login and window start one until-ready comment poll converges into rows.",
  })
) {}

// The two top-level kinds, with the instant the stream orders them by. An
// inline review comment, opening a thread or replying in one, belongs to a
// review thread, which already has its own row, so it is never a comment row.
const topLevelCommentSource = (comment: YeetMonitorComment): O.Option<readonly [YeetPrCommentSource, string]> =>
  Match.value(comment).pipe(
    Match.tag("issue", (issue) => O.some([YeetPrCommentSource.Enum.issue, issue.createdAt] as const)),
    Match.tag("review-body", (body) => O.some([YeetPrCommentSource.Enum["review-body"], body.submittedAt] as const)),
    Match.tag("review", () => O.none()),
    Match.exhaustive
  );

// A person other than the acting login: not a bot, not a deleted account
// GitHub no longer names, and not this monitor's own identity.
const writtenByAnotherPerson = (comment: YeetMonitorComment, window: YeetPrCommentWindow): boolean =>
  Str.isNonEmpty(comment.author) &&
  comment.author !== "unknown" &&
  !yeetMonitorCommentFromBot(comment) &&
  Str.toLowerCase(comment.author) !== Str.toLowerCase(window.actingLogin);

// Instants, not strings: GitHub stamps whole seconds and the window start
// carries milliseconds, so a string comparison would misorder one second.
const createdAfter = (createdAt: string, since: string): boolean =>
  pipe(
    O.all([DateTime.make(createdAt), DateTime.make(since)]),
    O.exists(([created, start]) => DateTime.isGreaterThan(created, start))
  );

// The shared excerpt strips control characters before it collapses whitespace,
// so a line break between two words would join them; a row's excerpt turns
// every whitespace run, line breaks included, into one space first.
const rowExcerpt = (body: string): string =>
  yeetCommentExcerpt(Str.replace(/\s+/gu, " ")(body), YEET_MONITOR_COMMENT_EXCERPT_LENGTH);

/**
 * Turn one streamed comment into a pull request comment capsule, when it qualifies.
 *
 * **Details**
 *
 * A comment qualifies when it is top-level (a conversation comment or a
 * review body), was written by a person other than the acting login, and was
 * created after the window start. The excerpt is the body with whitespace
 * (line breaks included) collapsed to single spaces and control sequences
 * stripped, bounded to about 200 characters with an ellipsis.
 *
 * **Example** (A person's comment inside the window)
 *
 * ```ts
 * import { YeetMonitorIssueComment, YeetPrCommentWindow, yeetPrCommentCapsule } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const window = YeetPrCommentWindow.make({
 *   actingLogin: "operator", headSha: "abc123", prNumber: 900, since: "2026-09-25T00:00:00.000Z"
 * })
 * const comment = YeetMonitorIssueComment.make({
 *   author: "reviewer",
 *   body: "Please rebase onto main.",
 *   createdAt: "2026-09-25T00:01:00Z",
 *   id: 44,
 *   url: "https://github.com/o/r/pull/900#issuecomment-44",
 * })
 * console.log(O.isSome(yeetPrCommentCapsule(comment, window))) // true
 * ```
 *
 * @param comment - One row from the monitor comment stream.
 * @param window - The pull request, head, acting login and window start.
 * @returns The capsule, or `None` for a comment that does not become a row.
 * @category utilities
 * @since 0.0.0
 */
export const yeetPrCommentCapsule: {
  (window: YeetPrCommentWindow): (comment: YeetMonitorComment) => O.Option<YeetPrCommentCapsule>;
  (comment: YeetMonitorComment, window: YeetPrCommentWindow): O.Option<YeetPrCommentCapsule>;
} = dual(
  2,
  (comment: YeetMonitorComment, window: YeetPrCommentWindow): O.Option<YeetPrCommentCapsule> =>
    pipe(
      topLevelCommentSource(comment),
      O.filter(([, createdAt]) => writtenByAnotherPerson(comment, window) && createdAfter(createdAt, window.since)),
      O.map(([source, createdAt]) =>
        YeetPrCommentCapsule.make({
          author: comment.author,
          commentId: comment.id,
          createdAt,
          excerpt: rowExcerpt(comment.body),
          headSha: window.headSha,
          link: comment.url,
          prNumber: window.prNumber,
          source,
        })
      )
    )
);

/**
 * Append one P1 `pr-comment` row per qualifying comment, once per comment.
 *
 * **Details**
 *
 * Row ids are keyed on the PR number, source and GitHub comment id, so seeing
 * the same comment again, on this poll or after a push, appends nothing. A
 * failed append fails the call, so the caller leaves the watermark where it
 * was and the next poll retries; rows already appended are deduplicated then.
 *
 * **Example** (Build the convergence effect)
 *
 * ```ts
 * import { convergeYeetPrComments, YeetPrCommentWindow } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const window = YeetPrCommentWindow.make({
 *   actingLogin: "operator", headSha: "abc123", prNumber: 900, since: "2026-09-25T00:00:00.000Z"
 * })
 * console.log(Effect.isEffect(convergeYeetPrComments("/repo", window, [], "2026-09-25T00:01:00Z"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox receives the rows.
 * @param window - The pull request, head, acting login and window start.
 * @param comments - The comments one poll collected past the watermark.
 * @param at - The observation timestamp stamped on every row written.
 * @returns The rows this call appended; a comment whose row already exists is not among them.
 * @category services
 * @since 0.0.0
 */
export const convergeYeetPrComments = Effect.fn("Yeet.convergePrComments")(function* (
  repoRoot: string,
  window: YeetPrCommentWindow,
  comments: ReadonlyArray<YeetMonitorComment>,
  at: string
): Effect.fn.Return<
  ReadonlyArray<YeetPrCommentRow>,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path
> {
  const appended = yield* Effect.forEach(
    A.getSomes(A.map(comments, yeetPrCommentCapsule(window))),
    Effect.fnUntraced(function* (capsule) {
      const row = YeetPrCommentRow.make({
        capsule,
        checkout: repoRoot,
        id: yield* yeetPrCommentRowId(capsule),
        severity: "P1",
        ts: at,
      });
      return (yield* appendYeetInboxRowOnce(repoRoot, row)) ? O.some(row) : O.none<YeetPrCommentRow>();
    })
  );
  return A.getSomes(appended);
});

/**
 * Poll the pull request's comments once and turn the new ones into inbox rows.
 *
 * **Details**
 *
 * The `--until-ready` comment consumer (pr-event-awareness D13/D21/D32). It
 * reads its own `until-ready` watermark, seeded on a first run from the window
 * start or the shared `monitor-comments.json` position, whichever is later;
 * collects every comment past it; appends the qualifying ones as rows; and only
 * then advances the watermark over everything it read, so a comment before the
 * window, a bot's comment or an inline review comment is read once and never
 * again. A failed read or append leaves the watermark where it was and fails
 * the call, so the next poll retries without losing a comment.
 *
 * **Example** (Build the poll)
 *
 * ```ts
 * import { pollYeetPrCommentRows, RepoRunContext, YeetPrCommentWindow } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
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
 * const window = YeetPrCommentWindow.make({
 *   actingLogin: "operator", headSha: "abc123", prNumber: 900, since: "2026-09-25T00:00:00.000Z"
 * })
 * console.log(Effect.isEffect(pollYeetPrCommentRows(context, window, "2026-09-25T00:01:00Z"))) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root and artifact directory.
 * @param window - The pull request, head, acting login and window start.
 * @param at - The observation timestamp stamped on every row written.
 * @returns The rows this poll appended.
 * @category services
 * @since 0.0.0
 */
export const pollYeetPrCommentRows = Effect.fn("Yeet.pollPrCommentRows")(function* (
  context: RepoRunContext,
  window: YeetPrCommentWindow,
  at: string
): Effect.fn.Return<
  ReadonlyArray<YeetPrCommentRow>,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const consumer = YeetMonitorCommentConsumer.Enum["until-ready"];
  const watermarkRef = yield* openYeetMonitorCommentStream(context, window.prNumber, consumer, O.some(window.since));
  const comments = yield* collectNewYeetMonitorComments(context, window.prNumber, watermarkRef);
  const appended = yield* convergeYeetPrComments(context.repoRoot, window, comments, at);
  yield* acknowledgeYeetMonitorComments(context, window.prNumber, watermarkRef, comments, consumer);
  return appended;
});
