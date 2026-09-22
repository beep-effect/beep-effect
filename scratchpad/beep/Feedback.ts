/**
 * Unified product-feedback ledger.
 *
 * **Details**
 *
 * Every thumbs-up or thumbs-down lands in one append-only `feedback_events`
 * collection. The ledger stores pointers, not message text. Chat text stays
 * encrypted per user, and the daily report decrypts it on demand. A focus
 * session and a chat session are different records; `chat_session_id` here is
 * only a pointer.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { optionalBoundedText, optionalText, optionalTimestamp, text, timestamp, userId } from "./Kit.ts";
import { boolDefault, intDefault, Model, optionalNull, pg } from "./Port.ts";

const $I = $ScratchpadId.create("beep/Feedback");

/**
 * Maximum comment length on a mobile feedback request.
 *
 * **Example** (Read the cap)
 *
 * ```ts
 * import { MaxCommentLength } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(MaxCommentLength) // 1000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MaxCommentLength = 1000;

/**
 * Where the rating was given. Distinct from `platform`.
 *
 * **Details**
 *
 * `chat_text` is the main window or the mobile chat page. `chat_voice` is
 * the floating bar. `conversation_summary` is the written summary.
 * `chat_notification` is a proactive card, not an answer. `memory` is one
 * extracted memory. `recording_quality` is feedback about a recording session.
 *
 * **Example** (Decode a notification surface)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FeedbackSurface } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(FeedbackSurface)("chat_notification"))) // "chat_notification"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FeedbackSurface = LiteralKit([
  "chat_text",
  "chat_voice",
  "conversation_summary",
  "chat_notification",
  "memory",
  "recording_quality",
]).pipe($I.annoteSchema("FeedbackSurface", { description: "Where the rating was given. Distinct from platform." }));

/** @category type-level @since 0.0.0 */
export type FeedbackSurface = typeof FeedbackSurface.Type;

/**
 * Collection `target_id` points into.
 *
 * **Example** (Decode a recording target)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FeedbackTargetKind } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(FeedbackTargetKind)("recording"))) // "recording"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FeedbackTargetKind = LiteralKit(["chat_message", "conversation", "memory", "recording"]).pipe(
  $I.annoteSchema("FeedbackTargetKind", { description: "Which collection target_id points into." }),
);

/** @category type-level @since 0.0.0 */
export type FeedbackTargetKind = typeof FeedbackTargetKind.Type;

/**
 * Structured thumbs-down reason, including desktop notification chips.
 *
 * **Details**
 *
 * The first five match the mobile analytics values. The remaining five are
 * desktop chips for proactive cards. They stay one uniform string union.
 *
 * **Example** (Decode a desktop chip)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FeedbackReason } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(FeedbackReason)("bad_timing"))) // "bad_timing"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FeedbackReason = LiteralKit([
  "too_verbose",
  "incorrect_or_hallucination",
  "not_helpful_or_irrelevant",
  "didnt_follow_instructions",
  "other",
  "not_about_me",
  "already_done",
  "wrong_facts",
  "bad_timing",
  "not_useful",
]).pipe($I.annoteSchema("FeedbackReason", { description: "Structured reason for a thumbs-down." }));

/** @category type-level @since 0.0.0 */
export type FeedbackReason = typeof FeedbackReason.Type;

/**
 * Explicit mobile feedback surface.
 *
 * **Example** (Decode summary helpfulness)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MobileFeedbackKind } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(MobileFeedbackKind)("summary_helpfulness")))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MobileFeedbackKind = LiteralKit(["summary_helpfulness", "recording_quality"]).pipe(
  $I.annoteSchema("MobileFeedbackKind", { description: "Explicit mobile feedback surfaces." }),
);

/** @category type-level @since 0.0.0 */
export type MobileFeedbackKind = typeof MobileFeedbackKind.Type;

/**
 * Closed mobile reason. Positive feedback may omit it.
 *
 * **Example** (Decode a recording reason)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MobileFeedbackReason } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(MobileFeedbackReason)("recording_other"))) // "recording_other"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MobileFeedbackReason = LiteralKit([
  "summary_inaccurate",
  "summary_incomplete",
  "summary_irrelevant",
  "summary_wrong_context",
  "summary_other",
  "recording_missing_audio",
  "recording_poor_transcription",
  "recording_wrong_speaker",
  "recording_delayed_or_stuck",
  "recording_fragmented_or_duplicated",
  "recording_other",
]).pipe($I.annoteSchema("MobileFeedbackReason", { description: "Closed reasons for explicit mobile output feedback." }));

/** @category type-level @since 0.0.0 */
export type MobileFeedbackReason = typeof MobileFeedbackReason.Type;

/**
 * Either ledger reason or mobile reason.
 *
 * **Details**
 *
 * `FeedbackEvent.reason` accepts both families. The field does not split the
 * rest of the event.
 *
 * **Example** (Decode a mobile reason on a ledger event)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AnyFeedbackReason } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(AnyFeedbackReason)("summary_other"))) // "summary_other"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AnyFeedbackReason = LiteralKit([
  "too_verbose",
  "incorrect_or_hallucination",
  "not_helpful_or_irrelevant",
  "didnt_follow_instructions",
  "other",
  "not_about_me",
  "already_done",
  "wrong_facts",
  "bad_timing",
  "not_useful",
  "summary_inaccurate",
  "summary_incomplete",
  "summary_irrelevant",
  "summary_wrong_context",
  "summary_other",
  "recording_missing_audio",
  "recording_poor_transcription",
  "recording_wrong_speaker",
  "recording_delayed_or_stuck",
  "recording_fragmented_or_duplicated",
  "recording_other",
]).pipe($I.annoteSchema("AnyFeedbackReason", { description: "Ledger or mobile feedback reason." }));

/** @category type-level @since 0.0.0 */
export type AnyFeedbackReason = typeof AnyFeedbackReason.Type;

/**
 * Summary reasons that may be attached to summary helpfulness.
 *
 * **Example** (Contains the inaccurate chip)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { SummaryFeedbackReasons } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(HashSet.has(SummaryFeedbackReasons, "summary_inaccurate")) // true
 * ```
 *
 * @category sets
 * @since 0.0.0
 */
export const SummaryFeedbackReasons = HashSet.fromIterable([
  "summary_inaccurate",
  "summary_incomplete",
  "summary_irrelevant",
  "summary_wrong_context",
  "summary_other",
]);

/**
 * Recording reasons that may be attached to recording quality.
 *
 * **Example** (Rejects a summary chip)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { RecordingFeedbackReasons } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(HashSet.has(RecordingFeedbackReasons, "summary_other")) // false
 * ```
 *
 * @category sets
 * @since 0.0.0
 */
export const RecordingFeedbackReasons = HashSet.fromIterable([
  "recording_missing_audio",
  "recording_poor_transcription",
  "recording_wrong_speaker",
  "recording_delayed_or_stuck",
  "recording_fragmented_or_duplicated",
  "recording_other",
]);

const MobileTargetKind = LiteralKit(["conversation", "recording"]);
const MobileValue = LiteralKit([-1, 1]);
const MemoryUseAction = LiteralKit(["suppress", "allow", "useful"]);
const MobileVersion = LiteralKit(["mobile_feedback.v1"]);
const ReceiptVersion = LiteralKit(["mobile_feedback_receipt.v1"]);
const MemoryUseVersion = LiteralKit(["memory_use_feedback.v1"]);
const PersistedTrue = LiteralKit([true]);

const mobileVersionValue = "mobile_feedback.v1";
const receiptVersionValue = "mobile_feedback_receipt.v1";
const memoryUseVersionValue = "memory_use_feedback.v1";

const emptyInts = (): { readonly [key: string]: number } => ({});

const intMap = (column: string) =>
  S.Record(S.String, S.Int).pipe(S.withConstructorDefault(Effect.sync(emptyInts)), pg.jsonb(), pg.columnName(column));

/**
 * Feedback identifier was blank after trimming.
 *
 * **Example** (Build the identifier error)
 *
 * ```ts
 * import { FeedbackContractError } from "@beep/scratchpad/beep/Feedback"
 *
 * const error = FeedbackContractError.make({ message: "feedback identifiers must not be blank" })
 * console.log(error.message) // "feedback identifiers must not be blank"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FeedbackContractError extends S.TaggedError<FeedbackContractError>()(
  "FeedbackContractError",
  { message: S.String },
  $I.annoteError<FeedbackContractError>("FeedbackContractError", {
    description: "A feedback identifier or reason/surface pair was rejected.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackContractError {
  export type Encoded = S.Codec.Encoded<typeof FeedbackContractError>;
}

/**
 * Trims a mobile feedback identifier and rejects a blank result.
 *
 * **Example** (Trim surrounding spaces)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { trimFeedbackIdentifier } from "@beep/scratchpad/beep/Feedback"
 *
 * console.log(Effect.runSync(trimFeedbackIdentifier("  id  "))) // "id"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const trimFeedbackIdentifier = Effect.fn("MobileFeedbackRequest.trimIdentifiers")(function* (value: string) {
  const trimmed = Str.trim(value);
  if (Str.isEmpty(trimmed)) {
    return yield* FeedbackContractError.make({ message: "feedback identifiers must not be blank" });
  }
  return trimmed;
});

/**
 * Trims a memory-use identifier and rejects a blank result.
 *
 * **Example** (Reject spaces)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { trimMemoryUseIdentifier } from "@beep/scratchpad/beep/Feedback"
 *
 * const failed = Effect.runSyncExit(trimMemoryUseIdentifier("   "))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const trimMemoryUseIdentifier = Effect.fn("MemoryUseFeedback.validateNonblank")(function* (value: string) {
  const trimmed = Str.trim(value);
  if (Str.isEmpty(trimmed)) {
    return yield* FeedbackContractError.make({ message: "memory-use feedback identifiers must not be blank" });
  }
  return trimmed;
});

/**
 * One rating action, as stored.
 *
 * **Details**
 *
 * Append-only: flipping a rating writes a second event. `value` is an open
 * integer. The description is 1 for up, -1 for down, and 0 for cleared.
 * `reason` may be a ledger reason or a mobile reason. Provenance stays missing
 * rather than becoming a guess. No message text is stored.
 *
 * **Gotchas**
 *
 * Do not close `value` to those three numbers. A later client can send another
 * integer without changing this shape.
 *
 * **Example** (Decode a null reason)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FeedbackEventWire } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FeedbackEventWire)({
 *     id: "e1",
 *     uid: "user-1",
 *     surface: "chat_text",
 *     target_kind: "chat_message",
 *     target_id: "m1",
 *     value: 1,
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     reason: null,
 *   }),
 * )
 * console.log(O.isNone(decoded.reason)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackEvent extends Model<FeedbackEvent>("FeedbackEvent")(
  {
    id: text("id"),
    uid: userId("uid"),
    surface: FeedbackSurface.pipe(pg.text(), pg.columnName("surface")),
    targetKind: FeedbackTargetKind.pipe(pg.text(), pg.columnName("target_kind")),
    targetId: text("target_id"),
    value: S.Int.pipe(pg.integer(), pg.columnName("value")),
    createdAt: timestamp("created_at"),
    reason: AnyFeedbackReason.pipe(optionalNull, pg.text(), pg.columnName("reason")),
    comment: optionalText("comment"),
    platform: optionalText("platform"),
    appVersion: optionalText("app_version"),
    appId: optionalText("app_id"),
    chatSessionId: optionalText("chat_session_id"),
    targetCreatedAt: optionalTimestamp("target_created_at"),
    langsmithRunId: optionalText("langsmith_run_id"),
    promptName: optionalText("prompt_name"),
    promptCommit: optionalText("prompt_commit"),
    feedbackId: optionalText("feedback_id"),
    feedbackKind: MobileFeedbackKind.pipe(optionalNull, pg.text(), pg.columnName("feedback_kind")),
    appBuild: optionalText("app_build"),
    clientAppNamespace: optionalText("client_app_namespace"),
    clientAppProfile: optionalText("client_app_profile"),
    backendRelease: optionalText("backend_release"),
    modelName: optionalText("model_name"),
    modelVersion: optionalText("model_version"),
    traceId: optionalText("trace_id"),
    correlationId: optionalText("correlation_id"),
    relatedConversationId: optionalText("related_conversation_id"),
  },
  $I.annote("FeedbackEvent", {
    description: "One append-only rating. Value stays an open integer and no message text is stored.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackEvent {
  export type Encoded = S.Codec.Encoded<typeof FeedbackEvent>;
}

/**
 * Snake_case codec for {@link FeedbackEvent}.
 *
 * **Example** (Encode the target kind)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FeedbackEventWire } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FeedbackEventWire)({
 *     id: "e1",
 *     uid: "user-1",
 *     surface: "memory",
 *     target_kind: "memory",
 *     target_id: "mem-1",
 *     value: -1,
 *     created_at: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * const encoded = Effect.runSync(S.encodeEffect(FeedbackEventWire)(decoded))
 * console.log(encoded.target_kind) // "memory"
 * ```
 *
 * @see {@link FeedbackEvent} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const FeedbackEventWire = FeedbackEvent.pipe(
  S.encodeKeys({
    targetKind: "target_kind",
    targetId: "target_id",
    createdAt: "created_at",
    appVersion: "app_version",
    appId: "app_id",
    chatSessionId: "chat_session_id",
    targetCreatedAt: "target_created_at",
    langsmithRunId: "langsmith_run_id",
    promptName: "prompt_name",
    promptCommit: "prompt_commit",
    feedbackId: "feedback_id",
    feedbackKind: "feedback_kind",
    appBuild: "app_build",
    clientAppNamespace: "client_app_namespace",
    clientAppProfile: "client_app_profile",
    backendRelease: "backend_release",
    modelName: "model_name",
    modelVersion: "model_version",
    traceId: "trace_id",
    correlationId: "correlation_id",
    relatedConversationId: "related_conversation_id",
  }),
);

/**
 * Authenticated mobile summary or recording feedback write.
 *
 * **Details**
 *
 * `feedback_id` is 1 to 128 characters and `target_id` is 1 to 256, both
 * trimmed by {@link trimFeedbackIdentifier}. `value` is -1 or 1. `target_kind`
 * null keeps the legacy recording-session meaning. Summary feedback may only
 * target a conversation when the discriminator is present.
 * {@link validateReasonSurface} checks the reason family.
 *
 * **Gotchas**
 *
 * A whitespace identifier passes the length check and fails the trim. Decode
 * through {@link decodeMobileFeedbackRequest} to apply both.
 *
 * **Example** (Decode a null reason)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { decodeMobileFeedbackRequest } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   decodeMobileFeedbackRequest({
 *     feedback_id: "f1",
 *     kind: "recording_quality",
 *     target_id: "t1",
 *     value: 1,
 *     reason: null,
 *     comment: null,
 *   }),
 * )
 * console.log(O.isNone(decoded.reason)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MobileFeedbackRequest extends Model<MobileFeedbackRequest>("MobileFeedbackRequest")(
  {
    schemaVersion: MobileVersion.pipe(
      S.withConstructorDefault(Effect.succeed(mobileVersionValue)),
      pg.text(),
      pg.columnName("schema_version"),
    ),
    feedbackId: S.String.check(S.isMinLength(1), S.isMaxLength(128)).pipe(pg.text(), pg.columnName("feedback_id")),
    kind: MobileFeedbackKind.pipe(pg.text(), pg.columnName("kind")),
    targetKind: MobileTargetKind.pipe(optionalNull, pg.text(), pg.columnName("target_kind")),
    targetId: S.String.check(S.isMinLength(1), S.isMaxLength(256)).pipe(pg.text(), pg.columnName("target_id")),
    value: MobileValue.pipe(pg.integer(), pg.columnName("value")),
    reason: MobileFeedbackReason.pipe(optionalNull, pg.text(), pg.columnName("reason")),
    comment: optionalBoundedText("comment", { maxLength: MaxCommentLength }),
    appVersion: optionalBoundedText("app_version", { maxLength: 64 }),
    appBuild: optionalBoundedText("app_build", { maxLength: 64 }),
    platform: optionalBoundedText("platform", { maxLength: 32 }),
    clientAppNamespace: optionalBoundedText("client_app_namespace", { maxLength: 128 }),
    clientAppProfile: optionalBoundedText("client_app_profile", { maxLength: 32 }),
    correlationId: optionalBoundedText("correlation_id", { maxLength: 128 }),
  },
  $I.annote("MobileFeedbackRequest", {
    description: "Authenticated mobile summary or recording feedback write.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace MobileFeedbackRequest {
  export type Encoded = S.Codec.Encoded<typeof MobileFeedbackRequest>;
}

/**
 * Snake_case codec for {@link MobileFeedbackRequest}.
 *
 * **Example** (Keep a missing target kind)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MobileFeedbackRequestWire } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(MobileFeedbackRequestWire)({
 *     schema_version: "mobile_feedback.v1",
 *     feedback_id: "f1",
 *     kind: "recording_quality",
 *     target_id: "t1",
 *     value: -1,
 *   }),
 * )
 * console.log(O.isNone(decoded.targetKind)) // true
 * ```
 *
 * @see {@link decodeMobileFeedbackRequest} for trim and reason checks.
 * @category codecs
 * @since 0.0.0
 */
export const MobileFeedbackRequestWire = MobileFeedbackRequest.pipe(
  S.encodeKeys({
    schemaVersion: "schema_version",
    feedbackId: "feedback_id",
    targetKind: "target_kind",
    targetId: "target_id",
    appVersion: "app_version",
    appBuild: "app_build",
    clientAppNamespace: "client_app_namespace",
    clientAppProfile: "client_app_profile",
    correlationId: "correlation_id",
  }),
);

/**
 * Rejects a reason from the other mobile surface, and a summary aimed at a recording.
 *
 * **Example** (Reject a recording reason on a summary)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { MobileFeedbackRequest, validateReasonSurface } from "@beep/scratchpad/beep/Feedback"
 *
 * const request = MobileFeedbackRequest.make({
 *   feedbackId: "f1",
 *   kind: "summary_helpfulness",
 *   targetKind: O.some("conversation"),
 *   targetId: "c1",
 *   value: -1,
 *   reason: O.some("recording_other"),
 * })
 * const failed = Effect.runSyncExit(validateReasonSurface(request))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const validateReasonSurface = Effect.fn("MobileFeedbackRequest.validateReasonSurface")(function* (
  request: MobileFeedbackRequest,
) {
  if (request.kind === "summary_helpfulness") {
    const wrongTarget = O.isSome(request.targetKind) && request.targetKind.value !== "conversation";
    if (wrongTarget) {
      return yield* FeedbackContractError.make({ message: "summary feedback must target a conversation" });
    }
  }
  if (O.isNone(request.reason)) return request;
  const allowed = request.kind === "summary_helpfulness" ? SummaryFeedbackReasons : RecordingFeedbackReasons;
  if (!HashSet.has(allowed, request.reason.value)) {
    return yield* FeedbackContractError.make({
      message: `reason ${request.reason.value} does not belong to ${request.kind}`,
    });
  }
  return request;
});

/**
 * Decodes a mobile request, trims identifiers, and checks the reason family.
 *
 * **Example** (Trim the feedback id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeMobileFeedbackRequest } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   decodeMobileFeedbackRequest({
 *     feedback_id: "  f1  ",
 *     kind: "summary_helpfulness",
 *     target_kind: "conversation",
 *     target_id: "c1",
 *     value: 1,
 *   }),
 * )
 * console.log(decoded.feedbackId) // "f1"
 * ```
 *
 * @see {@link trimFeedbackIdentifier} and {@link validateReasonSurface}.
 * @category decoding
 * @since 0.0.0
 */
export const decodeMobileFeedbackRequest = Effect.fn("MobileFeedbackRequest.decode")(function* (input: unknown) {
  const decoded = yield* S.decodeUnknownEffect(MobileFeedbackRequestWire)(input);
  const feedbackId = yield* trimFeedbackIdentifier(decoded.feedbackId);
  const targetId = yield* trimFeedbackIdentifier(decoded.targetId);
  return yield* validateReasonSurface(MobileFeedbackRequest.make({ ...decoded, feedbackId, targetId }));
});

/**
 * Receipt for a stored mobile feedback write.
 *
 * **Details**
 *
 * `persisted` is always true. `created` says whether this call inserted the row.
 *
 * **Example** (Construct a persisted receipt)
 *
 * ```ts
 * import { MobileFeedbackReceipt } from "@beep/scratchpad/beep/Feedback"
 *
 * const receipt = MobileFeedbackReceipt.make({ feedbackId: "f1", eventId: "e1", created: true })
 * console.log(receipt.persisted) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MobileFeedbackReceipt extends Model<MobileFeedbackReceipt>("MobileFeedbackReceipt")(
  {
    schemaVersion: ReceiptVersion.pipe(
      S.withConstructorDefault(Effect.succeed(receiptVersionValue)),
      pg.text(),
      pg.columnName("schema_version"),
    ),
    feedbackId: text("feedback_id"),
    eventId: text("event_id"),
    created: S.Boolean.pipe(pg.boolean(), pg.columnName("created")),
    persisted: PersistedTrue.pipe(S.withConstructorDefault(Effect.succeed(true)), pg.boolean(), pg.columnName("persisted")),
  },
  $I.annote("MobileFeedbackReceipt", {
    description: "Receipt for one mobile feedback write. persisted is always true.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace MobileFeedbackReceipt {
  export type Encoded = S.Codec.Encoded<typeof MobileFeedbackReceipt>;
}

/**
 * Snake_case codec for {@link MobileFeedbackReceipt}.
 *
 * **Example** (Decode created false)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MobileFeedbackReceiptWire } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(MobileFeedbackReceiptWire)({
 *     schema_version: "mobile_feedback_receipt.v1",
 *     feedback_id: "f1",
 *     event_id: "e1",
 *     created: false,
 *     persisted: true,
 *   }),
 * )
 * console.log(decoded.created) // false
 * ```
 *
 * @see {@link MobileFeedbackReceipt} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const MobileFeedbackReceiptWire = MobileFeedbackReceipt.pipe(
  S.encodeKeys({
    schemaVersion: "schema_version",
    feedbackId: "feedback_id",
    eventId: "event_id",
  }),
);

/**
 * Content-free envelope for canonical memory-use feedback.
 *
 * **Details**
 *
 * The apply transaction turns this into one {@link FeedbackEvent}. Identifiers
 * are trimmed by {@link trimMemoryUseIdentifier}. `feedback_id` is 1 to 128
 * characters. `action` is suppress, allow, or useful.
 *
 * **Example** (Decode a useful action)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeMemoryUseFeedback } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   decodeMemoryUseFeedback({
 *     uid: " user-1 ",
 *     feedback_id: "f1",
 *     target_memory_id: "mem-1",
 *     action: "useful",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(decoded.uid) // "user-1"
 * console.log(decoded.action) // "useful"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryUseFeedback extends Model<MemoryUseFeedback>("MemoryUseFeedback")(
  {
    schemaVersion: MemoryUseVersion.pipe(
      S.withConstructorDefault(Effect.succeed(memoryUseVersionValue)),
      pg.text(),
      pg.columnName("schema_version"),
    ),
    uid: text("uid"),
    feedbackId: S.String.check(S.isMinLength(1), S.isMaxLength(128)).pipe(pg.text(), pg.columnName("feedback_id")),
    targetMemoryId: text("target_memory_id"),
    action: MemoryUseAction.pipe(pg.text(), pg.columnName("action")),
    createdAt: timestamp("created_at"),
  },
  $I.annote("MemoryUseFeedback", {
    description: "Content-free memory-use feedback envelope that becomes one ledger event.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace MemoryUseFeedback {
  export type Encoded = S.Codec.Encoded<typeof MemoryUseFeedback>;
}

/**
 * Snake_case codec for {@link MemoryUseFeedback}.
 *
 * **Example** (Decode suppress)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryUseFeedbackWire } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(MemoryUseFeedbackWire)({
 *     schema_version: "memory_use_feedback.v1",
 *     uid: "user-1",
 *     feedback_id: "f1",
 *     target_memory_id: "mem-1",
 *     action: "suppress",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(decoded.action) // "suppress"
 * ```
 *
 * @see {@link decodeMemoryUseFeedback} for trimming.
 * @category codecs
 * @since 0.0.0
 */
export const MemoryUseFeedbackWire = MemoryUseFeedback.pipe(
  S.encodeKeys({
    schemaVersion: "schema_version",
    feedbackId: "feedback_id",
    targetMemoryId: "target_memory_id",
    createdAt: "created_at",
  }),
);

/**
 * Decodes memory-use feedback and trims its three identifiers.
 *
 * **Example** (Reject a blank memory id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeMemoryUseFeedback } from "@beep/scratchpad/beep/Feedback"
 *
 * const failed = Effect.runSyncExit(
 *   decodeMemoryUseFeedback({
 *     uid: "user-1",
 *     feedback_id: "f1",
 *     target_memory_id: "  ",
 *     action: "allow",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @see {@link trimMemoryUseIdentifier} for one identifier.
 * @category decoding
 * @since 0.0.0
 */
export const decodeMemoryUseFeedback = Effect.fn("MemoryUseFeedback.decode")(function* (input: unknown) {
  const decoded = yield* S.decodeUnknownEffect(MemoryUseFeedbackWire)(input);
  const uid = yield* trimMemoryUseIdentifier(decoded.uid);
  const feedbackId = yield* trimMemoryUseIdentifier(decoded.feedbackId);
  const targetMemoryId = yield* trimMemoryUseIdentifier(decoded.targetMemoryId);
  return MemoryUseFeedback.make({ ...decoded, uid, feedbackId, targetMemoryId });
});

/**
 * Pointer to one turn near the rated turn. Carries no text.
 *
 * **Details**
 *
 * `position` is an open string. The description mentions before, rated, and
 * after, and those words are not a closed union. `seconds_from_rated` is a
 * signed integer.
 *
 * **Gotchas**
 *
 * Closing `position` would not change the other fields, so it stays open.
 *
 * **Example** (Decode a negative offset)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FeedbackContextTurnWire } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FeedbackContextTurnWire)({
 *     message_id: "m1",
 *     sender: "user",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     position: "before",
 *     seconds_from_rated: -3,
 *   }),
 * )
 * console.log(decoded.secondsFromRated) // -3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackContextTurn extends Model<FeedbackContextTurn>("FeedbackContextTurn")(
  {
    messageId: text("message_id"),
    sender: text("sender"),
    createdAt: timestamp("created_at"),
    chatSessionId: optionalText("chat_session_id"),
    position: text("position"),
    secondsFromRated: S.Int.pipe(pg.integer(), pg.columnName("seconds_from_rated")),
  },
  $I.annote("FeedbackContextTurn", {
    description: "Pointer to one turn near the rated turn. Position stays an open string.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackContextTurn {
  export type Encoded = S.Codec.Encoded<typeof FeedbackContextTurn>;
}

/** @category codecs @since 0.0.0 */
export const FeedbackContextTurnWire = FeedbackContextTurn.pipe(
  S.encodeKeys({
    messageId: "message_id",
    createdAt: "created_at",
    chatSessionId: "chat_session_id",
    secondsFromRated: "seconds_from_rated",
  }),
);

const noTurns = (): ReadonlyArray<FeedbackContextTurn> => [];

/**
 * Ids-only context window for one negative event.
 *
 * **Details**
 *
 * `truncated_before` means the session had more preceding turns than the cap.
 * `truncated_after` means more follow-ups fell inside the window than the cap.
 * The window promises every follow-up within five minutes. `resolution_error`
 * is set when the window could not be built.
 *
 * **Example** (Construct empty turns)
 *
 * ```ts
 * import { FeedbackContextPointer } from "@beep/scratchpad/beep/Feedback"
 *
 * const pointer = FeedbackContextPointer.make({
 *   eventId: "e1",
 *   uid: "user-1",
 *   targetKind: "chat_message",
 *   targetId: "m1",
 * })
 * console.log(pointer.turns.length) // 0
 * console.log(pointer.truncatedAfter) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackContextPointer extends Model<FeedbackContextPointer>("FeedbackContextPointer")(
  {
    eventId: text("event_id"),
    uid: userId("uid"),
    targetKind: FeedbackTargetKind.pipe(pg.text(), pg.columnName("target_kind")),
    targetId: text("target_id"),
    turns: S.Array(FeedbackContextTurnWire).pipe(
      S.withConstructorDefault(Effect.sync(noTurns)),
      pg.jsonb(),
      pg.columnName("turns"),
    ),
    followUpCount: intDefault("follow_up_count", 0),
    followUpWindowSeconds: intDefault("follow_up_window_seconds", 0),
    truncatedBefore: boolDefault("truncated_before", false),
    truncatedAfter: boolDefault("truncated_after", false),
    resolutionError: optionalText("resolution_error"),
  },
  $I.annote("FeedbackContextPointer", {
    description: "Ids-only context window for one negative feedback event.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackContextPointer {
  export type Encoded = S.Codec.Encoded<typeof FeedbackContextPointer>;
}

/** @category codecs @since 0.0.0 */
export const FeedbackContextPointerWire = FeedbackContextPointer.pipe(
  S.encodeKeys({
    eventId: "event_id",
    targetKind: "target_kind",
    targetId: "target_id",
    followUpCount: "follow_up_count",
    followUpWindowSeconds: "follow_up_window_seconds",
    truncatedBefore: "truncated_before",
    truncatedAfter: "truncated_after",
    resolutionError: "resolution_error",
  }),
);

/**
 * One thumbs-down row in a daily report.
 *
 * **Example** (Read the nested event id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FeedbackReportEntryWire } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FeedbackReportEntryWire)({
 *     event: {
 *       id: "e1",
 *       uid: "user-1",
 *       surface: "chat_text",
 *       target_kind: "chat_message",
 *       target_id: "m1",
 *       value: -1,
 *       created_at: "2020-01-02T03:04:05.000Z",
 *     },
 *     context: {
 *       event_id: "e1",
 *       uid: "user-1",
 *       target_kind: "chat_message",
 *       target_id: "m1",
 *       turns: [],
 *       follow_up_count: 0,
 *       follow_up_window_seconds: 0,
 *       truncated_before: false,
 *       truncated_after: false,
 *     },
 *   }),
 * )
 * console.log(decoded.event.id) // "e1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackReportEntry extends Model<FeedbackReportEntry>("FeedbackReportEntry")(
  {
    event: FeedbackEventWire.pipe(pg.jsonb(), pg.columnName("event")),
    context: FeedbackContextPointerWire.pipe(pg.jsonb(), pg.columnName("context")),
  },
  $I.annote("FeedbackReportEntry", { description: "One thumbs-down in a daily report, event plus pointer." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackReportEntry {
  export type Encoded = S.Codec.Encoded<typeof FeedbackReportEntry>;
}

/** @category codecs @since 0.0.0 */
export const FeedbackReportEntryWire = FeedbackReportEntry;

const noEntries = (): ReadonlyArray<FeedbackReportEntry> => [];

/**
 * Materialized daily report. Pointers only.
 *
 * **Details**
 *
 * `date` is a YYYY-MM-DD string. `truncated` is true when the entry cap, the
 * raw-row bound, or the document size cut the report short. `total_negative`
 * still counts the whole day. Count maps are open string-to-int records.
 *
 * **Example** (Construct an empty report)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { FeedbackReport } from "@beep/scratchpad/beep/Feedback"
 *
 * const report = FeedbackReport.make({
 *   date: "2020-01-02",
 *   generatedAt: DateTime.makeUnsafe("2020-01-03T00:00:00.000Z"),
 *   totalNegative: 0,
 * })
 * console.log(report.entries.length) // 0
 * console.log(report.truncated) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackReport extends Model<FeedbackReport>("FeedbackReport")(
  {
    date: text("date"),
    generatedAt: timestamp("generated_at"),
    totalNegative: S.Int.pipe(pg.integer(), pg.columnName("total_negative")),
    countsBySurface: intMap("counts_by_surface"),
    countsByReason: intMap("counts_by_reason"),
    countsByPlatform: intMap("counts_by_platform"),
    entries: S.Array(FeedbackReportEntryWire).pipe(
      S.withConstructorDefault(Effect.sync(noEntries)),
      pg.jsonb(),
      pg.columnName("entries"),
    ),
    truncated: boolDefault("truncated", false),
  },
  $I.annote("FeedbackReport", {
    description: "Materialized daily feedback report. Pointers only, no conversation text.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackReport {
  export type Encoded = S.Codec.Encoded<typeof FeedbackReport>;
}

/** @category codecs @since 0.0.0 */
export const FeedbackReportWire = FeedbackReport.pipe(
  S.encodeKeys({
    generatedAt: "generated_at",
    totalNegative: "total_negative",
    countsBySurface: "counts_by_surface",
    countsByReason: "counts_by_reason",
    countsByPlatform: "counts_by_platform",
  }),
);

/**
 * Hydrated turn: pointer plus decrypted text. Never persisted as the ledger row.
 *
 * **Gotchas**
 *
 * The model still has a table projection because every class here is a row
 * schema. Callers must not write this row into `feedback_events`.
 *
 * **Example** (Decode the decrypted text)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FeedbackContextTurnTextWire } from "@beep/scratchpad/beep/Feedback"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FeedbackContextTurnTextWire)({
 *     message_id: "m1",
 *     sender: "human",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     position: "rated",
 *     seconds_from_rated: 0,
 *     text: "hello",
 *   }),
 * )
 * console.log(decoded.text) // "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackContextTurnText extends Model<FeedbackContextTurnText>("FeedbackContextTurnText")(
  {
    messageId: text("message_id"),
    sender: text("sender"),
    createdAt: timestamp("created_at"),
    position: text("position"),
    secondsFromRated: S.Int.pipe(pg.integer(), pg.columnName("seconds_from_rated")),
    text: text("text"),
  },
  $I.annote("FeedbackContextTurnText", {
    description: "Hydrated turn. Never written into the append-only feedback ledger.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackContextTurnText {
  export type Encoded = S.Codec.Encoded<typeof FeedbackContextTurnText>;
}

/** @category codecs @since 0.0.0 */
export const FeedbackContextTurnTextWire = FeedbackContextTurnText.pipe(
  S.encodeKeys({
    messageId: "message_id",
    createdAt: "created_at",
    secondsFromRated: "seconds_from_rated",
  }),
);

const noTurnText = (): ReadonlyArray<FeedbackContextTurnText> => [];
const noIds = (): ReadonlyArray<string> => [];

/**
 * On-demand decryption result for one event.
 *
 * **Details**
 *
 * `unavailable` lists message ids that were deleted or still encrypted.
 * Listing the id is the honest answer. A ciphertext blob is not the user's words.
 *
 * **Gotchas**
 *
 * This result is not the ledger document.
 *
 * **Example** (Construct an empty hydration)
 *
 * ```ts
 * import { FeedbackContextHydrated } from "@beep/scratchpad/beep/Feedback"
 *
 * const hydrated = FeedbackContextHydrated.make({
 *   eventId: "e1",
 *   targetKind: "chat_message",
 *   targetId: "m1",
 * })
 * console.log(hydrated.unavailable.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackContextHydrated extends Model<FeedbackContextHydrated>("FeedbackContextHydrated")(
  {
    eventId: text("event_id"),
    targetKind: FeedbackTargetKind.pipe(pg.text(), pg.columnName("target_kind")),
    targetId: text("target_id"),
    turns: S.Array(FeedbackContextTurnTextWire).pipe(
      S.withConstructorDefault(Effect.sync(noTurnText)),
      pg.jsonb(),
      pg.columnName("turns"),
    ),
    unavailable: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.sync(noIds)),
      pg.jsonb(),
      pg.columnName("unavailable"),
    ),
  },
  $I.annote("FeedbackContextHydrated", {
    description: "On-demand decryption result. Unavailable ids are listed instead of ciphertext.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackContextHydrated {
  export type Encoded = S.Codec.Encoded<typeof FeedbackContextHydrated>;
}

/** @category codecs @since 0.0.0 */
export const FeedbackContextHydratedWire = FeedbackContextHydrated.pipe(
  S.encodeKeys({
    eventId: "event_id",
    targetKind: "target_kind",
    targetId: "target_id",
  }),
);
