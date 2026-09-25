/**
 * Payload half of the daily summary.
 *
 * **Details**
 *
 * These shapes are not the response models. The payload nugget requires
 * `insight` and uses `conversation_number`. The response makes `insight`
 * nullable and uses `conversation_id`. {@link LearnedMemoryRef} is a third
 * shape, defined here and embedded only on the response.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { optionalTimestamp, text } from "./Kit.ts";
import { intDefault, jsonList, Model, optionalNull, pg, textDefault } from "./Port.ts";

const $I = $ScratchpadId.create("beep/DailySummaryPayload");

const optionalInt = (column: string) => optionalNull(S.Int).pipe(pg.integer(), pg.columnName(column));

/**
 * One highlight in a daily-summary payload.
 *
 * **Example** (Construct a highlight)
 *
 * ```ts
 * import { DailySummaryHighlight } from "./DailySummaryPayload.ts"
 *
 * const highlight = DailySummaryHighlight.make({ topic: "Shipping", summary: "Left on time" })
 * console.log(highlight.emoji) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryHighlight extends Model<DailySummaryHighlight>("DailySummaryHighlight")(
  {
    topic: text("topic"),
    emoji: textDefault("emoji", ""),
    summary: text("summary"),
    conversationNumbers: jsonList(S.Int, "conversation_numbers"),
  },
  $I.annote("DailySummaryHighlight", {
    description: "Payload highlight. Conversation references are numbers, not ids.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryHighlight}.
 *
 * @see {@link DailySummaryHighlight} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryHighlight {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryHighlight>;
}

/**
 * Unresolved question in a daily-summary payload.
 *
 * **Example** (Decode a null conversation number)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DailySummaryQuestion } from "./DailySummaryPayload.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DailySummaryQuestion)({ question: "When?", conversationNumber: null }),
 * )
 * console.log(O.isNone(decoded.conversationNumber)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryQuestion extends Model<DailySummaryQuestion>("DailySummaryQuestion")(
  {
    question: text("question"),
    conversationNumber: optionalInt("conversation_number"),
  },
  $I.annote("DailySummaryQuestion", {
    description: "Payload question. conversation_number is optional.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryQuestion}.
 *
 * @see {@link DailySummaryQuestion} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryQuestion {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryQuestion>;
}

/**
 * Decision recorded in a daily-summary payload.
 *
 * **Example** (Omit the conversation number)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { DailySummaryDecision } from "./DailySummaryPayload.ts"
 *
 * console.log(O.isNone(DailySummaryDecision.make({ decision: "Ship it" }).conversationNumber)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryDecision extends Model<DailySummaryDecision>("DailySummaryDecision")(
  {
    decision: text("decision"),
    conversationNumber: optionalInt("conversation_number"),
  },
  $I.annote("DailySummaryDecision", {
    description: "Payload decision. conversation_number is optional.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryDecision}.
 *
 * @see {@link DailySummaryDecision} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryDecision {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryDecision>;
}

/**
 * Knowledge nugget in a daily-summary payload.
 *
 * **Details**
 *
 * `insight` is required. The response model of the same name is a different
 * wire: nullable insight and `conversation_id`.
 *
 * **Example** (Require an insight)
 *
 * ```ts
 * import { DailySummaryKnowledgeNugget } from "./DailySummaryPayload.ts"
 *
 * console.log(DailySummaryKnowledgeNugget.make({ insight: "Names stick" }).insight) // "Names stick"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryKnowledgeNugget extends Model<DailySummaryKnowledgeNugget>(
  "DailySummaryKnowledgeNugget",
)(
  {
    insight: text("insight"),
    conversationNumber: optionalInt("conversation_number"),
  },
  $I.annote("DailySummaryKnowledgeNugget", {
    description: "Payload knowledge nugget. insight is required and the conversation reference is a number.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryKnowledgeNugget}.
 *
 * @see {@link DailySummaryKnowledgeNugget} for the payload wire, not the response wire.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryKnowledgeNugget {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryKnowledgeNugget>;
}

/**
 * Day counters inside a daily-summary payload.
 *
 * **Example** (Construct zero stats)
 *
 * ```ts
 * import { DailySummaryDayStatsPayload } from "./DailySummaryPayload.ts"
 *
 * console.log(DailySummaryDayStatsPayload.make({}).totalConversations) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryDayStatsPayload extends Model<DailySummaryDayStatsPayload>(
  "DailySummaryDayStatsPayload",
)(
  {
    totalConversations: intDefault("total_conversations", 0),
    totalDurationMinutes: intDefault("total_duration_minutes", 0),
    actionItemsCount: intDefault("action_items_count", 0),
    memoriesCreated: intDefault("memories_created", 0),
    actionItemsCreated: intDefault("action_items_created", 0),
    watchingMinutes: intDefault("watching_minutes", 0),
    proactiveMoments: intDefault("proactive_moments", 0),
  },
  $I.annote("DailySummaryDayStatsPayload", {
    description: "Payload day counters. Every counter constructs as 0.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryDayStatsPayload}.
 *
 * @see {@link DailySummaryDayStatsPayload} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryDayStatsPayload {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryDayStatsPayload>;
}

/**
 * Full daily-summary payload sent for rendering.
 *
 * **Example** (Construct the headline default)
 *
 * ```ts
 * import { DailySummaryPayload } from "./DailySummaryPayload.ts"
 *
 * console.log(DailySummaryPayload.make({}).headline) // "Your Day in Review"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailySummaryPayload extends Model<DailySummaryPayload>("DailySummaryPayload")(
  {
    dayEmoji: textDefault("day_emoji", "📅"),
    decisionsMade: jsonList(DailySummaryDecision, "decisions_made"),
    headline: textDefault("headline", "Your Day in Review"),
    highlights: jsonList(DailySummaryHighlight, "highlights"),
    knowledgeNuggets: jsonList(DailySummaryKnowledgeNugget, "knowledge_nuggets"),
    overview: textDefault("overview", ""),
    stats: optionalNull(DailySummaryDayStatsPayload).pipe(pg.jsonb(), pg.columnName("stats")),
    unresolvedQuestions: jsonList(DailySummaryQuestion, "unresolved_questions"),
  },
  $I.annote("DailySummaryPayload", {
    description: "Daily summary payload. Stats may be missing. This is not the response model.",
  }),
) {}

/**
 * Encoded form of {@link DailySummaryPayload}.
 *
 * @see {@link DailySummaryPayload} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailySummaryPayload {
  export type Encoded = S.Codec.Encoded<typeof DailySummaryPayload>;
}

/**
 * One memory a day produced, addressed by its canonical id.
 *
 * **Details**
 *
 * This is the identity `knowledge_nuggets` never had: a client can render a
 * native review card and vote or correct through the existing memory endpoints.
 * Review state (`user_review`, `edited`) is deliberately absent — clients read
 * it live from the memory so a vote on one device shows on the other.
 *
 * **Gotchas**
 *
 * `category` is an open string, not a category enum. The memory id is not a
 * StableId check in the Python model.
 *
 * **Example** (Omit the capture time)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { LearnedMemoryRef } from "./DailySummaryPayload.ts"
 *
 * const ref = LearnedMemoryRef.make({ memoryId: "mem-1", content: "Lives in Seattle" })
 * console.log(O.isNone(ref.capturedAt)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LearnedMemoryRef extends Model<LearnedMemoryRef>("LearnedMemoryRef")(
  {
    memoryId: text("memory_id"),
    content: text("content"),
    category: textDefault("category", ""),
    capturedAt: optionalTimestamp("captured_at"),
  },
  $I.annote("LearnedMemoryRef", {
    description:
      "Canonical memory produced by a day. Review state is read live from the memory and is not stored here.",
  }),
) {}

/**
 * Encoded form of {@link LearnedMemoryRef}.
 *
 * @see {@link LearnedMemoryRef} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LearnedMemoryRef {
  export type Encoded = S.Codec.Encoded<typeof LearnedMemoryRef>;
}
