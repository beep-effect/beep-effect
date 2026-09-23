/**
 * API response shapes for a reviewed day.
 *
 * The LLM payload in the sibling module counts conversations by number and
 * requires its strings. These responses use ids, leave almost every field
 * nullable, and keep unknown keys on {@link DailySummaryResponse}.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  Model,
  optionalBool,
  optionalNull,
  optionalText,
  optionalTimestamp,
  pg,
  text,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/DailySummary");

const noJsonRecord = (): { readonly [key: string]: S.Json } => ({});

const knownDailySummaryKeys = HashSet.fromIterable([
  "id",
  "date",
  "created_at",
  "headline",
  "overview",
  "day_emoji",
  "stats",
  "highlights",
  "action_items",
  "unresolved_questions",
  "decisions_made",
  "knowledge_nuggets",
  "memories_learned",
  "locations",
  "rest",
]);

const stringList = (column: string) =>
  S.Array(S.String).pipe(optionalNull, pg.jsonb(), pg.columnName(column));

const optionalInt = (column: string) => S.Int.pipe(optionalNull, pg.integer(), pg.columnName(column));

// @effect-diagnostics-next-line schemaNumber:off -- Location pins do not set allow_inf_nan, so non-finite coordinates stay valid.
const optionalNumber = (column: string) => S.Number.pipe(optionalNull, pg.doublePrecision(), pg.columnName(column));

/**
 * One thing the day asked the user to do.
 *
 * **Details**
 *
 * There is no payload counterpart. `completed` null is distinct from false:
 * the summary did not say whether the item was done.
 *
 * **Example** (Decode a description and a null priority)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryActionItemWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryActionItemWire)({ description: "Ship", priority: null }),
 * )
 * console.log(O.getOrElse(decoded.description, () => "")) // "Ship"
 * console.log(O.isNone(decoded.priority)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryActionItem extends Model<DailySummaryActionItem>("DailySummaryActionItem")(
  {
    description: optionalText("description"),
    priority: optionalText("priority"),
    sourceConversationId: optionalText("source_conversation_id"),
    completed: optionalBool("completed"),
  },
  $I.annote("DailySummaryActionItem", {
    description: "Daily summary action item addressed by conversation id, with every field nullable.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryActionItem} before snake_case renaming.
 *
 * @see {@link DailySummaryActionItemWire} for the Python JSON keys.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryActionItem {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryActionItem>;
}

/**
 * Snake_case codec for {@link DailySummaryActionItem}.
 *
 * **Example** (Round-trip the conversation id key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DailySummaryActionItemWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryActionItemWire)({ source_conversation_id: "c1" }),
 * )
 * const encoded = Effect.runSync(S.encodeEffect(DailySummaryActionItemWire)(decoded))
 * console.log(encoded.source_conversation_id) // "c1"
 * ```
 *
 * @see {@link DailySummaryActionItem} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DailySummaryActionItemWire = DailySummaryActionItem.pipe(
  S.encodeKeys({ sourceConversationId: "source_conversation_id" }),
);

/**
 * Topic highlight on the API response.
 *
 * **Details**
 *
 * `conversation_ids` is a nullable list of ids. The payload highlight instead
 * requires `topic` and `summary` and stores `conversation_numbers`.
 *
 * **Example** (Decode a missing highlight as all none)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryTopicHighlightWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(DailySummaryTopicHighlightWire)({}))
 * console.log(O.isNone(decoded.topic)) // true
 * console.log(O.isNone(decoded.conversationIds)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryTopicHighlight extends Model<DailySummaryTopicHighlight>("DailySummaryTopicHighlight")(
  {
    topic: optionalText("topic"),
    emoji: optionalText("emoji"),
    summary: optionalText("summary"),
    conversationIds: stringList("conversation_ids"),
  },
  $I.annote("DailySummaryTopicHighlight", {
    description: "Response topic highlight. Conversation ids are nullable and are not payload numbers.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryTopicHighlight}.
 *
 * @see {@link DailySummaryTopicHighlightWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryTopicHighlight {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryTopicHighlight>;
}

/**
 * Snake_case codec for {@link DailySummaryTopicHighlight}.
 *
 * **Example** (Keep a null id list)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryTopicHighlightWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryTopicHighlightWire)({ conversation_ids: null }),
 * )
 * console.log(O.isNone(decoded.conversationIds)) // true
 * ```
 *
 * @see {@link DailySummaryTopicHighlight} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DailySummaryTopicHighlightWire = DailySummaryTopicHighlight.pipe(
  S.encodeKeys({ conversationIds: "conversation_ids" }),
);

/**
 * Question the day left open, on the API response.
 *
 * **Details**
 *
 * The payload question requires `question` and uses `conversation_number`.
 * Both response fields are nullable.
 *
 * **Example** (Decode a question without a conversation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryUnresolvedQuestionWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryUnresolvedQuestionWire)({ question: "When?" }),
 * )
 * console.log(O.getOrElse(decoded.question, () => "")) // "When?"
 * console.log(O.isNone(decoded.conversationId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryUnresolvedQuestion extends Model<DailySummaryUnresolvedQuestion>(
  "DailySummaryUnresolvedQuestion",
)(
  {
    question: optionalText("question"),
    conversationId: optionalText("conversation_id"),
  },
  $I.annote("DailySummaryUnresolvedQuestion", {
    description: "Response unresolved question keyed by nullable conversation id.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryUnresolvedQuestion}.
 *
 * @see {@link DailySummaryUnresolvedQuestionWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryUnresolvedQuestion {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryUnresolvedQuestion>;
}

/**
 * Snake_case codec for {@link DailySummaryUnresolvedQuestion}.
 *
 * **Example** (Decode a null question)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryUnresolvedQuestionWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryUnresolvedQuestionWire)({ question: null }),
 * )
 * console.log(O.isNone(decoded.question)) // true
 * ```
 *
 * @see {@link DailySummaryUnresolvedQuestion} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DailySummaryUnresolvedQuestionWire = DailySummaryUnresolvedQuestion.pipe(
  S.encodeKeys({ conversationId: "conversation_id" }),
);

/**
 * Decision recorded on the API response.
 *
 * **Details**
 *
 * The payload decision requires `decision` and uses `conversation_number`.
 *
 * **Example** (Decode a decision id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryDecisionMadeWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryDecisionMadeWire)({ decision: "Ship", conversation_id: "c1" }),
 * )
 * console.log(O.getOrElse(decoded.conversationId, () => "")) // "c1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryDecisionMade extends Model<DailySummaryDecisionMade>("DailySummaryDecisionMade")(
  {
    decision: optionalText("decision"),
    conversationId: optionalText("conversation_id"),
  },
  $I.annote("DailySummaryDecisionMade", {
    description: "Response decision keyed by nullable conversation id.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryDecisionMade}.
 *
 * @see {@link DailySummaryDecisionMadeWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryDecisionMade {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryDecisionMade>;
}

/**
 * Snake_case codec for {@link DailySummaryDecisionMade}.
 *
 * **Example** (Decode a missing decision)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryDecisionMadeWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(DailySummaryDecisionMadeWire)({}))
 * console.log(O.isNone(decoded.decision)) // true
 * ```
 *
 * @see {@link DailySummaryDecisionMade} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DailySummaryDecisionMadeWire = DailySummaryDecisionMade.pipe(
  S.encodeKeys({ conversationId: "conversation_id" }),
);

/**
 * Knowledge nugget on the API response.
 *
 * **Details**
 *
 * Same class name as the payload nugget, different wire. Response `insight`
 * is nullable and the link is `conversation_id`. The payload requires
 * `insight` and stores `conversation_number`.
 *
 * **Gotchas**
 *
 * Do not decode a payload nugget with this schema. A missing insight there is
 * invalid, and a conversation number is not an id.
 *
 * **Example** (Decode a null insight)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryKnowledgeNuggetWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryKnowledgeNuggetWire)({ insight: null, conversation_id: "c1" }),
 * )
 * console.log(O.isNone(decoded.insight)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryKnowledgeNugget extends Model<DailySummaryKnowledgeNugget>("DailySummaryKnowledgeNugget")(
  {
    insight: optionalText("insight"),
    conversationId: optionalText("conversation_id"),
  },
  $I.annote("DailySummaryKnowledgeNugget", {
    description: "Response knowledge nugget. Insight is nullable and the link is a conversation id.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryKnowledgeNugget}.
 *
 * @see {@link DailySummaryKnowledgeNuggetWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryKnowledgeNugget {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryKnowledgeNugget>;
}

/**
 * Snake_case codec for {@link DailySummaryKnowledgeNugget}.
 *
 * **Example** (Encode the conversation id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DailySummaryKnowledgeNugget, DailySummaryKnowledgeNuggetWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const encoded = Effect.runSync(
 *   S.encodeEffect(DailySummaryKnowledgeNuggetWire)(DailySummaryKnowledgeNugget.make({})),
 * )
 * console.log(encoded.conversation_id) // null
 * ```
 *
 * @see {@link DailySummaryKnowledgeNugget} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DailySummaryKnowledgeNuggetWire = DailySummaryKnowledgeNugget.pipe(
  S.encodeKeys({ conversationId: "conversation_id" }),
);

/**
 * Day counters on the API response.
 *
 * **Details**
 *
 * The seven names match the payload stats. There they default to 0. Here each
 * one is nullable, so an older summary can omit a counter without pretending
 * the count was zero.
 *
 * **Example** (Decode a null conversation count)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryDayStatsWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryDayStatsWire)({ total_conversations: null }),
 * )
 * console.log(O.isNone(decoded.totalConversations)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryDayStats extends Model<DailySummaryDayStats>("DailySummaryDayStats")(
  {
    totalConversations: optionalInt("total_conversations"),
    totalDurationMinutes: optionalInt("total_duration_minutes"),
    actionItemsCount: optionalInt("action_items_count"),
    memoriesCreated: optionalInt("memories_created"),
    actionItemsCreated: optionalInt("action_items_created"),
    watchingMinutes: optionalInt("watching_minutes"),
    proactiveMoments: optionalInt("proactive_moments"),
  },
  $I.annote("DailySummaryDayStats", {
    description: "Nullable response day counters. Zero is not implied by a missing key.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryDayStats}.
 *
 * @see {@link DailySummaryDayStatsWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryDayStats {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryDayStats>;
}

/**
 * Snake_case codec for {@link DailySummaryDayStats}.
 *
 * **Example** (Decode one present counter)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryDayStatsWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryDayStatsWire)({ proactive_moments: 2 }),
 * )
 * console.log(O.getOrElse(decoded.proactiveMoments, () => 0)) // 2
 * ```
 *
 * @see {@link DailySummaryDayStats} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DailySummaryDayStatsWire = DailySummaryDayStats.pipe(
  S.encodeKeys({
    totalConversations: "total_conversations",
    totalDurationMinutes: "total_duration_minutes",
    actionItemsCount: "action_items_count",
    memoriesCreated: "memories_created",
    actionItemsCreated: "action_items_created",
    watchingMinutes: "watching_minutes",
    proactiveMoments: "proactive_moments",
  }),
);

/**
 * Map pin attached to a daily summary response.
 *
 * **Details**
 *
 * Not present on the payload. `time` is a string, not a datetime, and latitude
 * and longitude have no range check here. Bounded coordinates live on geolocation.
 *
 * **Example** (Decode a string time)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryLocationPinWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryLocationPinWire)({ time: "morning", latitude: null }),
 * )
 * console.log(O.getOrElse(decoded.time, () => "")) // "morning"
 * console.log(O.isNone(decoded.latitude)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryLocationPin extends Model<DailySummaryLocationPin>("DailySummaryLocationPin")(
  {
    latitude: optionalNumber("latitude"),
    longitude: optionalNumber("longitude"),
    address: optionalText("address"),
    conversationId: optionalText("conversation_id"),
    time: optionalText("time"),
  },
  $I.annote("DailySummaryLocationPin", {
    description: "Response location pin. Time is a string and coordinates are unbounded.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryLocationPin}.
 *
 * @see {@link DailySummaryLocationPinWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryLocationPin {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryLocationPin>;
}

/**
 * Snake_case codec for {@link DailySummaryLocationPin}.
 *
 * **Example** (Encode a null address)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DailySummaryLocationPin, DailySummaryLocationPinWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const encoded = Effect.runSync(
 *   S.encodeEffect(DailySummaryLocationPinWire)(DailySummaryLocationPin.make({})),
 * )
 * console.log(encoded.address) // null
 * ```
 *
 * @see {@link DailySummaryLocationPin} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DailySummaryLocationPinWire = DailySummaryLocationPin.pipe(
  S.encodeKeys({ conversationId: "conversation_id" }),
);

/**
 * One memory the day produced, addressed by canonical id.
 *
 * **Details**
 *
 * This is the identity `knowledge_nuggets` never had. A client can render a
 * native review card and vote or correct through the existing memory
 * endpoints. Review state (`user_review`, `edited`) is deliberately absent.
 * Clients read it live from the memory so a vote on one device shows on the
 * other. `category` is an open string, not a closed category enum.
 *
 * **Gotchas**
 *
 * The payload module owns this wire and the response embeds it. The class is
 * repeated here so the response does not import an unported payload file.
 * `category` defaults to an empty string only when the value is constructed,
 * not when a decoded row omits the key.
 *
 * **Example** (Construct the empty category default)
 *
 * ```ts
 * import { LearnedMemoryRef } from "@beep/scratchpad/beep/DailySummary"
 *
 * const memory = LearnedMemoryRef.make({ memoryId: "m1", content: "Ada ships" })
 * console.log(memory.category) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LearnedMemoryRef extends Model<LearnedMemoryRef>("LearnedMemoryRef")(
  {
    memoryId: text("memory_id"),
    content: text("content"),
    category: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), pg.text(), pg.columnName("category")),
    capturedAt: optionalTimestamp("captured_at"),
  },
  $I.annote("LearnedMemoryRef", {
    description: "Canonical memory id produced on a reviewed day, without stored review state.",
  }),
) {}

/**
 * Encoded form of {@link LearnedMemoryRef}.
 *
 * @see {@link LearnedMemoryRefWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LearnedMemoryRef {
  export type Encoded = S.Codec.Encoded<typeof LearnedMemoryRef>;
}

/**
 * Snake_case codec for {@link LearnedMemoryRef}.
 *
 * **Example** (Decode a null capture time)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LearnedMemoryRefWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(LearnedMemoryRefWire)({
 *     memory_id: "m1",
 *     content: "Ada ships",
 *     category: "work",
 *     captured_at: null,
 *   }),
 * )
 * console.log(decoded.memoryId) // "m1"
 * console.log(O.isNone(decoded.capturedAt)) // true
 * ```
 *
 * @see {@link LearnedMemoryRef} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const LearnedMemoryRefWire = LearnedMemoryRef.pipe(
  S.encodeKeys({ memoryId: "memory_id", capturedAt: "captured_at" }),
);

const noMemories = (): ReadonlyArray<LearnedMemoryRef> => [];

const modelList = <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, column: string) =>
  S.Array(schema).pipe(optionalNull, pg.jsonb(), pg.columnName(column));

/**
 * One stored daily summary returned by the API.
 *
 * **Details**
 *
 * Python `extra='allow'` is the only open object in this batch. Unknown keys
 * are parked on `rest` by {@link absorbDailySummaryRest} and put back at the
 * top level by {@link flattenDailySummaryRest}. `memories_learned` defaults to
 * an empty list and is not nullable. Clients prefer it over
 * `knowledge_nuggets` when it is non-empty. Older summaries have no field.
 *
 * **Gotchas**
 *
 * Decoding the class or {@link DailySummaryResponseWire} directly still drops
 * unknown keys, because a struct has no index signature. Use
 * {@link decodeDailySummaryResponse} to keep them. A key literally named
 * `rest` is the bag, not an extra attribute. Constructor defaults do not fill
 * a missing `memories_learned` during decode. There is no default headline;
 * the payload's `'Your Day in Review'` does not apply here.
 *
 * **Example** (Keep an unknown key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeDailySummaryResponse } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   decodeDailySummaryResponse({ memories_learned: [], bonus: "kept" }),
 * )
 * console.log(decoded.rest.bonus) // "kept"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryResponse extends Model<DailySummaryResponse>("DailySummaryResponse")(
  {
    id: optionalText("id"),
    date: optionalText("date"),
    createdAt: optionalTimestamp("created_at"),
    headline: optionalText("headline"),
    overview: optionalText("overview"),
    dayEmoji: optionalText("day_emoji"),
    stats: DailySummaryDayStatsWire.pipe(optionalNull, pg.jsonb(), pg.columnName("stats")),
    highlights: modelList(DailySummaryTopicHighlightWire, "highlights"),
    actionItems: modelList(DailySummaryActionItemWire, "action_items"),
    unresolvedQuestions: modelList(DailySummaryUnresolvedQuestionWire, "unresolved_questions"),
    decisionsMade: modelList(DailySummaryDecisionMadeWire, "decisions_made"),
    knowledgeNuggets: modelList(DailySummaryKnowledgeNuggetWire, "knowledge_nuggets"),
    memoriesLearned: S.Array(LearnedMemoryRefWire).pipe(
      S.withConstructorDefault(Effect.sync(noMemories)),
      pg.jsonb(),
      pg.columnName("memories_learned"),
    ),
    locations: modelList(DailySummaryLocationPinWire, "locations"),
    rest: S.Record(S.String, S.Json).pipe(
      S.withConstructorDefault(Effect.sync(noJsonRecord)),
      pg.jsonb(),
      pg.columnName("rest"),
    ),
  },
  $I.annote("DailySummaryResponse", {
    description: "Open daily summary response. Unknown keys survive on rest; memories_learned is a list.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryResponse}.
 *
 * @see {@link DailySummaryResponseWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryResponse {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryResponse>;
}

/**
 * Snake_case codec for {@link DailySummaryResponse}.
 *
 * **Example** (Decode a null stats object)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryResponseWire } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryResponseWire)({ stats: null, memories_learned: [] }),
 * )
 * console.log(O.isNone(decoded.stats)) // true
 * ```
 *
 * @see {@link decodeDailySummaryResponse} to keep unknown keys.
 * @category codecs
 * @since 0.0.0
 */
export const DailySummaryResponseWire = DailySummaryResponse.pipe(
  S.encodeKeys({
    createdAt: "created_at",
    dayEmoji: "day_emoji",
    actionItems: "action_items",
    unresolvedQuestions: "unresolved_questions",
    decisionsMade: "decisions_made",
    knowledgeNuggets: "knowledge_nuggets",
    memoriesLearned: "memories_learned",
  }),
);

const decodeDailySummaryResponseWire = S.decodeUnknownEffect(DailySummaryResponseWire);
const encodeDailySummaryResponseWire = S.encodeEffect(DailySummaryResponseWire);

const UnknownRecord = S.Record(S.String, S.Unknown);

const decodeUnknownOptionUnknownRecord = S.decodeUnknownOption(UnknownRecord);

const recordOf = (value: unknown): O.Option<{ readonly [key: string]: unknown }> =>
  decodeUnknownOptionUnknownRecord(value);

/**
 * Moves unknown daily-summary keys into `rest` before decoding.
 *
 * **Details**
 *
 * Known Python keys stay on the object. Any other own key is copied into
 * `rest`. An existing object `rest` is kept, and unknown keys fill holes
 * without replacing keys already in that object. Non-objects pass through.
 *
 * **Example** (Park a bonus key)
 *
 * ```ts
 * import { absorbDailySummaryRest } from "@beep/scratchpad/beep/DailySummary"
 *
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { absorbDailySummaryRest } from "@beep/scratchpad/beep/DailySummary"
 *
 * const prepared = absorbDailySummaryRest({ id: "s1", bonus: 1 })
 * const decoded = Effect.runSync(S.decodeUnknownEffect(S.Record(S.String, S.Unknown))(prepared))
 * console.log(decoded.id) // "s1"
 * console.log("bonus" in decoded) // false
 * ```
 *
 * @see {@link flattenDailySummaryRest} for the reverse wire step.
 * @category decoding
 * @since 0.0.0
 */
export const absorbDailySummaryRest = (input: unknown): unknown => {
  const record = recordOf(input);
  if (O.isNone(record)) return input;
  const entries = R.toEntries(record.value);
  const extra = A.filter(entries, ([key]) => !HashSet.has(knownDailySummaryKeys, key));
  const known = A.filter(entries, ([key]) => HashSet.has(knownDailySummaryKeys, key));
  const body = R.fromEntries(known);
  if (extra.length === 0) return body;
  const current = R.get(body, "rest");
  const base = O.flatMap(current, (value) => (P.isObject(value) && !A.isArray(value) ? recordOf(value) : O.none()));
  const merged = R.fromEntries(O.match(base, { onNone: () => extra, onSome: (value) => [...R.toEntries(value), ...extra] }));
  return R.set("rest", merged)(body);
};

/**
 * Decodes a daily summary and keeps unknown keys.
 *
 * **Details**
 *
 * This is the `extra='allow'` entry point. Null and missing optional fields
 * still become `None`. `memories_learned` must be present because its empty
 * list is only a constructor default.
 *
 * **Example** (Decode a missing optional headline)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { decodeDailySummaryResponse } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(decodeDailySummaryResponse({ memories_learned: [] }))
 * console.log(O.isNone(decoded.headline)) // true
 * ```
 *
 * @see {@link absorbDailySummaryRest} for the key split.
 * @category decoding
 * @since 0.0.0
 */
export const decodeDailySummaryResponse = Effect.fn("DailySummaryResponse.decode")(function* (input: unknown) {
  return yield* decodeDailySummaryResponseWire(absorbDailySummaryRest(input));
});

/**
 * Encodes a daily summary and lifts `rest` back to top-level keys.
 *
 * **Details**
 *
 * Known keys on the encoded object win when `rest` repeats them. The stored
 * `rest` key itself is removed from the wire object.
 *
 * **Example** (Lift a parked key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeDailySummaryResponse, flattenDailySummaryRest } from "@beep/scratchpad/beep/DailySummary"
 *
 * const decoded = Effect.runSync(decodeDailySummaryResponse({ memories_learned: [], bonus: "kept" }))
 * const wire = Effect.runSync(flattenDailySummaryRest(decoded))
 * console.log(wire.bonus) // "kept"
 * ```
 *
 * @see {@link absorbDailySummaryRest} for the decode split.
 * @category encoding
 * @since 0.0.0
 */
export const flattenDailySummaryRest = Effect.fn("DailySummaryResponse.flattenRest")(function* (
  summary: DailySummaryResponse,
) {
  const encoded = yield* encodeDailySummaryResponseWire(summary);
  const { rest, ...body } = encoded;
  return { ...body, ...rest };
});

const noSummaries = (): ReadonlyArray<DailySummaryResponse> => [];

/**
 * Page of daily summary responses.
 *
 * **Details**
 *
 * Unlike each child summary, this object ignores unknown keys. `summaries`
 * defaults to an empty list only at construction.
 *
 * **Gotchas**
 *
 * A missing `summaries` key fails decode. Call `make` to take the empty default.
 *
 * **Example** (Construct an empty page)
 *
 * ```ts
 * import { DailySummariesResponse } from "@beep/scratchpad/beep/DailySummary"
 *
 * console.log(DailySummariesResponse.make({}).summaries.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummariesResponse extends Model<DailySummariesResponse>("DailySummariesResponse")(
  {
    summaries: S.Array(DailySummaryResponseWire).pipe(
      S.withConstructorDefault(Effect.sync(noSummaries)),
      pg.jsonb(),
      pg.columnName("summaries"),
    ),
  },
  $I.annote("DailySummariesResponse", {
    description: "Closed list of daily summary responses. Unknown keys are ignored.",
  }),
) {}

/**
 * Encoded form of {@link DailySummariesResponse}.
 *
 * @see {@link DailySummariesResponse} for the runtime class.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummariesResponse {
  export type Encoded = S.Codec.Encoded<typeof DailySummariesResponse>;
}
