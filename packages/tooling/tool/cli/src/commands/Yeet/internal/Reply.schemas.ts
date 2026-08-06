/**
 * Schema-first draft and report documents for auditable PR review-thread replies.
 *
 * Agents verify review findings but cannot post the reply that closes the
 * thread, so fixes end as paste-these-drafts handoffs and the "comments
 * resolved" merge criterion stays open by hand. These schemas make the handoff
 * a document: {@link ReplyDrafts} is written by whoever did the work, validated
 * against the live threads, then posted and resolved through the operator's own
 * `gh` auth, producing a {@link ReplyReport}.
 *
 * **Details**
 *
 * A draft names its target either way GitHub exposes one — the GraphQL review
 * thread id (`PRRT_…`) or the numeric REST comment id — because the two live on
 * different surfaces: `yeet status` lists thread ids, while a review comment
 * URL and the REST API speak comment ids. Requiring the caller to translate is
 * what forced the hand-mapping pass this schema exists to remove, so
 * {@link ReplyDraft} accepts either and the resolver does the mapping.
 *
 * Both artifacts are written through their `S.encode`-backed JSON codecs
 * ({@link ReplyDraftsJson}, {@link ReplyReportJson}); a decoded instance must
 * never reach `JSON.stringify`, which would leak `Option` runtime objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Reply.schemas");

const REVIEW_THREAD_ID_PREFIX = "PRRT_";

/**
 * A GitHub GraphQL pull request review thread id.
 *
 * **Details**
 *
 * GraphQL node ids for review threads are prefixed `PRRT_`; the prefix check is
 * what lets a draft that pasted a review *comment* id (`PRRC_…`) or a bare
 * number into the wrong field fail at decode instead of at the mutation.
 *
 * **Example** (Decode a thread id)
 *
 * ```ts
 * import { ReplyThreadId } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownOption(ReplyThreadId)("PRRT_kwDOA"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReplyThreadId = S.NonEmptyString.check(S.isStartsWith(REVIEW_THREAD_ID_PREFIX)).pipe(
  $I.annoteSchema("ReplyThreadId", {
    title: "Reply Thread Id",
    description: "GitHub GraphQL pull request review thread id.",
  })
);

/**
 * A GitHub GraphQL pull request review thread id.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReplyThreadId = typeof ReplyThreadId.Type;

/**
 * A GitHub REST pull request review comment id.
 *
 * @category models
 * @since 0.0.0
 */
export const ReplyCommentId = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("ReplyCommentId", {
    title: "Reply Comment Id",
    description: "GitHub REST pull request review comment id.",
  })
);

/**
 * A GitHub REST pull request review comment id.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReplyCommentId = typeof ReplyCommentId.Type;

/**
 * A GitHub pull request number.
 *
 * @category models
 * @since 0.0.0
 */
export const ReplyPullRequestNumber = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("ReplyPullRequestNumber", {
    title: "Reply Pull Request Number",
    description: "Pull request the reply drafts and report belong to.",
  })
);

/**
 * A GitHub pull request number.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReplyPullRequestNumber = typeof ReplyPullRequestNumber.Type;

const replyTargetFields = {
  threadId: ReplyThreadId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  commentId: ReplyCommentId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
} satisfies S.Struct.Fields;

/**
 * Cross-field requirement that a reply target names at least one live handle.
 *
 * Both id fields are optional because either alone identifies the thread, but a
 * record carrying neither is not a reply to anything — it would decode cleanly
 * and then fail at the API with no way to attribute the mistake back to the
 * draft that caused it. Making the empty target undecodable pushes the failure
 * to the file the human wrote, and reports it at the `threadId` path since that
 * is the handle `yeet status` prints.
 */
const ReplyTargetPresenceCheck = S.makeFilter(
  (target: { readonly threadId: O.Option<ReplyThreadId>; readonly commentId: O.Option<ReplyCommentId> }) =>
    O.isSome(target.threadId) || O.isSome(target.commentId)
      ? undefined
      : {
          path: ["threadId"],
          issue: "A reply target must carry a GraphQL thread id (PRRT_...) or a numeric REST comment id.",
        },
  {
    identifier: $I`ReplyTargetPresenceCheck`,
    title: "Reply target presence",
    description: "A reply target must carry a GraphQL thread id or a numeric REST comment id.",
  }
);

/**
 * One drafted reply to a pull request review thread.
 *
 * **Details**
 *
 * `resolve` defaults to `true` on both construction and decoding: the reason to
 * post a reply on a review thread is to close it, so a hand-written drafts file
 * that omits the key gets the intended behaviour, and opting out is explicit.
 *
 * **Example** (Draft a reply against a thread id)
 *
 * ```ts
 * import { ReplyDraft } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const draft = ReplyDraft.make({
 *   threadId: O.some("PRRT_kwDOA"),
 *   body: "Fixed in 0123456: the writer now encodes through the schema codec.",
 * })
 * console.log(draft.resolve)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplyDraft extends S.Class<ReplyDraft>($I`ReplyDraft`)(
  S.Struct({
    ...replyTargetFields,
    body: S.NonEmptyString,
    resolve: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefault(Effect.succeed(true))
    ),
  }).pipe(S.check(ReplyTargetPresenceCheck)),
  $I.annote("ReplyDraft", {
    description: "One drafted reply to a pull request review thread, targeted by thread id or comment id.",
  })
) {}

/**
 * The drafted replies for one pull request.
 *
 * **Example** (Construct an empty drafts artifact)
 *
 * ```ts
 * import { ReplyDrafts } from "@beep/repo-cli/test/Yeet"
 *
 * const drafts = ReplyDrafts.make({
 *   schemaVersion: "yeet-reply-drafts/v1",
 *   prNumber: 558,
 *   drafts: [],
 * })
 * console.log(drafts.prNumber)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplyDrafts extends S.Class<ReplyDrafts>($I`ReplyDrafts`)(
  {
    schemaVersion: S.Literal("yeet-reply-drafts/v1"),
    prNumber: ReplyPullRequestNumber,
    drafts: S.Array(ReplyDraft),
  },
  $I.annote("ReplyDrafts", {
    description: "Drafted review-thread replies for one pull request, pending post and resolve.",
  })
) {}

/**
 * What became of one drafted reply.
 *
 * **Details**
 *
 * `posted` means the reply landed but the thread was left open (either the
 * draft opted out of resolving, or resolution is not available on that thread);
 * `resolved` means it landed and the thread was closed; `stale` means the live
 * thread was already resolved upstream, so nothing was written; `failed` means
 * the attempt was rejected or could not be made at all.
 *
 * **Gotchas**
 *
 * `stale` is narrower than "the thread moved on". An `isOutdated` thread is not
 * stale: its diff hunk moved, but the thread is still open and still counts
 * against the "threads resolved" merge criterion, so it is written like any
 * other. A handle matching no live thread is `failed`, not `stale` — the draft
 * names something that does not exist, which is an operator mistake worth
 * surfacing rather than a no-op worth accepting.
 *
 * **Example** (List the reply outcome statuses)
 *
 * ```ts
 * import { ReplyOutcomeStatus } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ReplyOutcomeStatus.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReplyOutcomeStatus = LiteralKit(["posted", "resolved", "stale", "failed"]).pipe(
  $I.annoteSchema("ReplyOutcomeStatus", {
    title: "Reply Outcome Status",
    description: "What became of one drafted reply.",
  })
);

/**
 * What became of one drafted reply.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReplyOutcomeStatus = typeof ReplyOutcomeStatus.Type;

/**
 * One drafted reply paired with what the run did about it.
 *
 * **Example** (Record a stale draft)
 *
 * ```ts
 * import { ReplyDraftOutcome } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const outcome = ReplyDraftOutcome.make({
 *   threadId: O.some("PRRT_kwDOA"),
 *   status: "stale",
 *   detail: "thread was already resolved upstream",
 * })
 * console.log(outcome.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplyDraftOutcome extends S.Class<ReplyDraftOutcome>($I`ReplyDraftOutcome`)(
  S.Struct({
    ...replyTargetFields,
    status: ReplyOutcomeStatus,
    detail: S.NonEmptyString,
  }).pipe(S.check(ReplyTargetPresenceCheck)),
  $I.annote("ReplyDraftOutcome", {
    description: "One drafted reply paired with what the reply run did about it.",
  })
) {}

/**
 * The result document for one reply run.
 *
 * **Example** (Construct an empty reply report)
 *
 * ```ts
 * import { ReplyReport } from "@beep/repo-cli/test/Yeet"
 *
 * const report = ReplyReport.make({
 *   schemaVersion: "yeet-reply-report/v1",
 *   prNumber: 558,
 *   createdAt: "2026-08-04T00:00:00.000Z",
 *   outcomes: [],
 * })
 * console.log(report.outcomes.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplyReport extends S.Class<ReplyReport>($I`ReplyReport`)(
  {
    schemaVersion: S.Literal("yeet-reply-report/v1"),
    prNumber: ReplyPullRequestNumber,
    createdAt: S.String,
    outcomes: S.Array(ReplyDraftOutcome),
  },
  $I.annote("ReplyReport", {
    description: "Result document for one reply run: every drafted reply paired with its outcome.",
  })
) {}

/**
 * JSON-string codec for the reply drafts artifact.
 *
 * **Example** (Encode an empty drafts artifact)
 *
 * ```ts
 * import { ReplyDrafts, ReplyDraftsJson } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const drafts = ReplyDrafts.make({ schemaVersion: "yeet-reply-drafts/v1", prNumber: 558, drafts: [] })
 * console.log(Effect.runSync(ReplyDraftsJson.encode(drafts)))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ReplyDraftsJson = JsonStringCodec(ReplyDrafts);

/**
 * JSON-string codec for the reply report artifact.
 *
 * **Example** (Encode an empty reply report)
 *
 * ```ts
 * import { ReplyReport, ReplyReportJson } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const report = ReplyReport.make({
 *   schemaVersion: "yeet-reply-report/v1",
 *   prNumber: 558,
 *   createdAt: "2026-08-04T00:00:00.000Z",
 *   outcomes: [],
 * })
 * console.log(Effect.runSync(ReplyReportJson.encode(report)))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ReplyReportJson = JsonStringCodec(ReplyReport);
