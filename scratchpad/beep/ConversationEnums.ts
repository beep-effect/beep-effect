/**
 * Closed conversation vocabularies.
 *
 * **Details**
 *
 * A Conversation is the persisted session record upstream of memory. It is not
 * a Memory, a ChatSession, a focus session, or an auth session. Wire values
 * stay frozen: `romance` is `romantic`, external `audio` is `audio_transcript`,
 * external `other` is `other_text`, and post-processing `canceled` keeps one l.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("beep/ConversationEnums");

/**
 * Conversation category stored on structured and shared projections.
 *
 * **Details**
 *
 * Thirty-three product categories. `music` and the members after it were added
 * on 2024-01-23. `real` is the wire string `real`, not `real_estate`.
 *
 * **Gotchas**
 *
 * The Python member `romance` encodes as `romantic`. Do not "correct" it.
 *
 * **Example** (Decode the romance wire value)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CategoryEnum } from "./ConversationEnums.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(CategoryEnum)("romantic"))
 * console.log(decoded) // "romantic"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CategoryEnum = LiteralKit([
  "personal",
  "education",
  "health",
  "finance",
  "legal",
  "philosophy",
  "spiritual",
  "science",
  "entrepreneurship",
  "parenting",
  "romantic",
  "travel",
  "inspiration",
  "technology",
  "business",
  "social",
  "work",
  "sports",
  "politics",
  "literature",
  "history",
  "architecture",
  "music",
  "weather",
  "news",
  "entertainment",
  "psychology",
  "real",
  "design",
  "family",
  "economics",
  "environment",
  "other",
]).pipe(
  $I.annoteSchema("CategoryEnum", {
    description: "Conversation category. The romance member is the frozen wire value romantic.",
  }),
);

/**
 * Decoded conversation category.
 *
 * @see {@link CategoryEnum} for the runtime schema and the romance wire value.
 * @category type-level
 * @since 0.0.0
 */
export type CategoryEnum = typeof CategoryEnum.Type;

const ConversationSourceLiterals = LiteralKit([
  "friend",
  "omi",
  "fieldy",
  "bee",
  "plaud",
  "frame",
  "friend_com",
  "apple_watch",
  "phone",
  "phone_call",
  "desktop",
  "openglass",
  "screenpipe",
  "workflow",
  "sdcard",
  "external_integration",
  "limitless",
  "rayban_meta",
  "onboarding",
  "unknown",
]);

/**
 * Where a conversation was captured.
 *
 * **Details**
 *
 * Python `ConversationSource._missing_` maps every unknown string to `unknown`
 * and rejects non-strings. Known values still encode as themselves.
 *
 * **Gotchas**
 *
 * A closed literal schema would reject source strings this enum accepts. The
 * lenient catch is the decode behavior.
 *
 * **Example** (Collapse an unknown source)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationSource } from "./ConversationEnums.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConversationSource)("pendant"))
 * console.log(decoded) // "unknown"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConversationSource = S.String.pipe(
  S.decodeTo(ConversationSourceLiterals, {
    decode: SchemaGetter.transform((value) => (S.is(ConversationSourceLiterals)(value) ? value : "unknown")),
    encode: SchemaGetter.transform((value) => value),
  }),
  $I.annoteSchema("ConversationSource", {
    description: "Conversation capture source. Unknown strings decode as unknown.",
  }),
);

/**
 * Decoded conversation source.
 *
 * @see {@link ConversationSource} for the lenient runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ConversationSource = typeof ConversationSource.Type;

/**
 * Who can read a conversation.
 *
 * **Example** (Decode a private conversation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationVisibility } from "./ConversationEnums.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConversationVisibility)("private"))
 * console.log(decoded) // "private"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConversationVisibility = LiteralKit(["private", "shared", "public"]).pipe(
  $I.annoteSchema("ConversationVisibility", {
    description: "Conversation visibility: private, shared, or public.",
  }),
);

/**
 * Decoded conversation visibility.
 *
 * @see {@link ConversationVisibility} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ConversationVisibility = typeof ConversationVisibility.Type;

/**
 * Post-processing job status.
 *
 * **Gotchas**
 *
 * The cancelled member is spelled `canceled` (one l). Do not unify it with
 * two-l spellings used by other enums.
 *
 * **Example** (Decode a canceled job)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PostProcessingStatus } from "./ConversationEnums.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(PostProcessingStatus)("canceled"))
 * console.log(decoded) // "canceled"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PostProcessingStatus = LiteralKit([
  "not_started",
  "in_progress",
  "completed",
  "canceled",
  "failed",
]).pipe(
  $I.annoteSchema("PostProcessingStatus", {
    description: "Post-processing status. The cancelled spelling is the frozen wire value canceled.",
  }),
);

/**
 * Decoded post-processing status.
 *
 * @see {@link PostProcessingStatus} for the runtime schema and canceled spelling.
 * @category type-level
 * @since 0.0.0
 */
export type PostProcessingStatus = typeof PostProcessingStatus.Type;

/**
 * User-visible conversation status.
 *
 * **Details**
 *
 * `in_progress`, `processing`, `merging`, `completed`, or `failed`. There is
 * no cancelled member.
 *
 * **Example** (Decode a completed conversation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationStatus } from "./ConversationEnums.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConversationStatus)("completed"))
 * console.log(decoded) // "completed"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConversationStatus = LiteralKit([
  "in_progress",
  "processing",
  "merging",
  "completed",
  "failed",
]).pipe(
  $I.annoteSchema("ConversationStatus", {
    description: "Conversation status from in_progress through completed or failed.",
  }),
);

/**
 * Decoded conversation status.
 *
 * @see {@link ConversationStatus} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ConversationStatus = typeof ConversationStatus.Type;

/**
 * Model that produced a post-processing pass.
 *
 * **Example** (Decode a prerecorded pass)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PostProcessingModel } from "./ConversationEnums.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(PostProcessingModel)("prerecorded"))
 * console.log(decoded) // "prerecorded"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PostProcessingModel = LiteralKit(["fal_whisperx", "prerecorded"]).pipe(
  $I.annoteSchema("PostProcessingModel", {
    description: "Post-processing model: fal_whisperx or prerecorded.",
  }),
);

/**
 * Decoded post-processing model.
 *
 * @see {@link PostProcessingModel} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type PostProcessingModel = typeof PostProcessingModel.Type;

/**
 * Text source on an external-integration create.
 *
 * **Gotchas**
 *
 * `audio` encodes as `audio_transcript`. `other` encodes as `other_text`.
 * `message` matches its member name.
 *
 * **Example** (Decode an audio transcript source)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ExternalIntegrationConversationSource } from "./ConversationEnums.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ExternalIntegrationConversationSource)("audio_transcript"))
 * console.log(decoded) // "audio_transcript"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExternalIntegrationConversationSource = LiteralKit([
  "audio_transcript",
  "message",
  "other_text",
]).pipe(
  $I.annoteSchema("ExternalIntegrationConversationSource", {
    description: "External text source. audio is audio_transcript and other is other_text.",
  }),
);

/**
 * Decoded external-integration text source.
 *
 * @see {@link ExternalIntegrationConversationSource} for the wire values.
 * @category type-level
 * @since 0.0.0
 */
export type ExternalIntegrationConversationSource = typeof ExternalIntegrationConversationSource.Type;

/**
 * Why `structured` holds the deterministic minimum instead of an enriched summary.
 *
 * **Details**
 *
 * Absent (`None` on the conversation, not an enum member) when the server
 * enriched the conversation, and also when a `client_processing` projection is
 * already present. Clients check `client_processing` first. A projection that
 * arrives after terminal persist does not rewrite this field, so a projected
 * conversation may still read `local_pending` and must render the projection.
 * `local_pending` means a capable client should deliver a projection: render a
 * spinner with a timeout, not a permanent empty state. `none` means no
 * projection is coming: render "Summary unavailable on the free plan".
 *
 * **Gotchas**
 *
 * Absence versus the two members is three states, not a shape split of
 * Conversation. This is not a memory processing state.
 *
 * **Example** (Decode the free-plan state)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationProcessingState } from "./ConversationEnums.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConversationProcessingState)("none"))
 * console.log(decoded) // "none"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConversationProcessingState = LiteralKit(["local_pending", "none"]).pipe(
  $I.annoteSchema("ConversationProcessingState", {
    description:
      "Why structured is the deterministic minimum. Absent means the server already enriched the conversation.",
  }),
);

/**
 * Decoded conversation processing state.
 *
 * @see {@link ConversationProcessingState} for absence versus the two members.
 * @category type-level
 * @since 0.0.0
 */
export type ConversationProcessingState = typeof ConversationProcessingState.Type;
