/**
 * External integration payloads and API response rows.
 *
 * **Details**
 *
 * Conversation items are upstream session records, not memories. The local
 * action item is nested conversation structure, not a workflow action item.
 * {@link IntegrationMemoryItem} is the integration response form of a stored
 * memory, not the product memory item.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Rec from "effect/Record";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as P from "effect/Predicate";
import { memoryDbFields } from "./Memories.ts";
import {
  Model,
  optionalNull,
  optionalText,
  optionalTimestamp,
  pg,
  text,
  timestamp,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Integrations");

const optionMissingDefault = <Schema extends S.Top>(schema: Schema, missing: Schema["Type"]) =>
  schema.pipe(
    S.NullOr,
    S.optionalKey,
    S.decodeTo(S.Option(schema), {
      decode: SchemaGetter.transformOptional((present) =>
        O.some(
          O.match(present, {
            onNone: () => O.some(missing),
            onSome: (value) => (value === null ? O.none() : O.some(value)),
          }),
        ),
      ),
      encode: SchemaGetter.transformOptional((present) =>
        present.pipe(
          O.flatten,
          O.match({ onNone: () => null, onSome: (value) => value }),
          O.some,
        ),
      ),
    }),
    S.withConstructorDefault(Effect.succeedSome(missing)),
  );

/**
 * External memory source.
 *
 * **Details**
 *
 * The member named `post` in Python encodes as `social_post`.
 *
 * **Example** (Decode a social post)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ExternalIntegrationMemorySource } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ExternalIntegrationMemorySource)("social_post"))
 * console.log(decoded) // "social_post"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExternalIntegrationMemorySource = LiteralKit(["email", "social_post", "other"]).pipe(
  $I.annoteSchema("ExternalIntegrationMemorySource", {
    description: "External integration memory source. social_post is the wire value for a post.",
  }),
);

/**
 * Decoded external memory source.
 *
 * @see {@link ExternalIntegrationMemorySource} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type ExternalIntegrationMemorySource = typeof ExternalIntegrationMemorySource.Type;

const otherSource: ExternalIntegrationMemorySource = "other";

/**
 * Inclusive timestamp range in epoch units.
 *
 * **Example** (Decode a range)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationTimestampRange } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConversationTimestampRange)({ start: 1, end: 2 }))
 * console.log(decoded.end) // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConversationTimestampRange extends Model<ConversationTimestampRange>("ConversationTimestampRange")(
  {
    start: S.Int.pipe(pg.integer(), pg.columnName("start")),
    end: S.Int.pipe(pg.integer(), pg.columnName("end")),
  },
  $I.annote("ConversationTimestampRange", { description: "Inclusive epoch range for a screen-pipe conversation." }),
) {}

/**
 * Encoded timestamp range.
 *
 * @see {@link ConversationTimestampRange} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationTimestampRange {
  export type Encoded = S.Codec.Encoded<typeof ConversationTimestampRange>;
}

/**
 * Screen-pipe request that creates a conversation.
 *
 * **Example** (Decode a request)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenPipeCreateConversation } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenPipeCreateConversation)({
 *     requestId: "req-1",
 *     source: "screen",
 *     text: "hello",
 *     timestampRange: { start: 1, end: 2 },
 *   }),
 * )
 * console.log(decoded.requestId) // "req-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ScreenPipeCreateConversation extends Model<ScreenPipeCreateConversation>("ScreenPipeCreateConversation")(
  {
    requestId: text("request_id"),
    source: text("source"),
    text: text("text"),
    timestampRange: ConversationTimestampRange.pipe(pg.jsonb(), pg.columnName("timestamp_range")),
  },
  $I.annote("ScreenPipeCreateConversation", { description: "Screen-pipe request that creates an upstream conversation." }),
) {}

/**
 * Encoded screen-pipe request.
 *
 * @see {@link ScreenPipeCreateConversation} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenPipeCreateConversation {
  export type Encoded = S.Codec.Encoded<typeof ScreenPipeCreateConversation>;
}

/**
 * One explicit fact from an external integration.
 *
 * **Example** (Decode a fact)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ExternalIntegrationMemory } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ExternalIntegrationMemory)({ content: "Ada" }))
 * console.log(O.isNone(decoded.tags)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExternalIntegrationMemory extends Model<ExternalIntegrationMemory>("ExternalIntegrationMemory")(
  {
    content: text("content"),
    tags: optionalNull(S.String.pipe(S.Array)).pipe(pg.jsonb(), pg.columnName("tags")),
    sourceId: optionalText("source_id"),
    sourceUrl: optionalText("source_url"),
    artifactRef: optionalNull(S.Record(S.String, S.Json)).pipe(pg.jsonb(), pg.columnName("artifact_ref")),
  },
  $I.annote("ExternalIntegrationMemory", { description: "Explicit fact supplied by an external integration." }),
) {}

/**
 * Encoded external fact.
 *
 * @see {@link ExternalIntegrationMemory} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExternalIntegrationMemory {
  export type Encoded = S.Codec.Encoded<typeof ExternalIntegrationMemory>;
}

/**
 * Request that creates external facts.
 *
 * **Details**
 *
 * `textSource` defaults to `other` at construction. The other provenance
 * fields are missing-or-null.
 *
 * **Example** (Construct the other-source default)
 *
 * ```ts
 * import { ExternalIntegrationCreateMemory } from "@beep/scratchpad/beep/Integrations"
 *
 * const created = ExternalIntegrationCreateMemory.make({})
 * console.log(created.textSource) // "other"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExternalIntegrationCreateMemory extends Model<ExternalIntegrationCreateMemory>(
  "ExternalIntegrationCreateMemory",
)(
  {
    text: optionalText("text"),
    textSource: ExternalIntegrationMemorySource.pipe(
      S.withConstructorDefault(Effect.succeed(otherSource)),
      pg.text(),
      pg.columnName("text_source"),
    ),
    textSourceSpec: optionalText("text_source_spec"),
    sourceId: optionalText("source_id"),
    sourceUrl: optionalText("source_url"),
    artifactRef: optionalNull(S.Record(S.String, S.Json)).pipe(pg.jsonb(), pg.columnName("artifact_ref")),
    appId: optionalText("app_id"),
    memories: ExternalIntegrationMemory.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("memories")),
  },
  $I.annote("ExternalIntegrationCreateMemory", {
    description: "External request that creates facts. textSource defaults to other.",
  }),
) {}

/**
 * Encoded external create request.
 *
 * @see {@link ExternalIntegrationCreateMemory} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExternalIntegrationCreateMemory {
  export type Encoded = S.Codec.Encoded<typeof ExternalIntegrationCreateMemory>;
}

/**
 * Status string returned by an integration notification.
 *
 * **Example** (Decode ok)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { IntegrationNotificationResponse } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(IntegrationNotificationResponse)({ status: "ok" }))
 * console.log(decoded.status) // "ok"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IntegrationNotificationResponse extends Model<IntegrationNotificationResponse>(
  "IntegrationNotificationResponse",
)(
  { status: text("status") },
  $I.annote("IntegrationNotificationResponse", { description: "Free-form status from an integration notification." }),
) {}

/**
 * Encoded notification response.
 *
 * @see {@link IntegrationNotificationResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntegrationNotificationResponse {
  export type Encoded = S.Codec.Encoded<typeof IntegrationNotificationResponse>;
}

/**
 * Response after creating an upstream conversation.
 *
 * **Example** (Decode an id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationCreateResponse } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ConversationCreateResponse)({ status: "ok", conversationId: "conv-1" }),
 * )
 * console.log(decoded.conversationId) // "conv-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConversationCreateResponse extends Model<ConversationCreateResponse>("ConversationCreateResponse")(
  { status: text("status"), conversationId: text("conversation_id") },
  $I.annote("ConversationCreateResponse", { description: "Status and id after creating an upstream conversation." }),
) {}

/**
 * Encoded conversation-create response.
 *
 * @see {@link ConversationCreateResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationCreateResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationCreateResponse>;
}

/**
 * Integration response form of a stored memory.
 *
 * **Details**
 *
 * Python named this `MemoryItem` and subclassed `MemoryDB` with
 * `exclude_none`. The class name here avoids the product memory item. Nulls
 * are dropped by {@link encodeIntegrationMemoryItem}.
 *
 * **Example** (Construct from a content string)
 *
 * ```ts
 * import { IntegrationMemoryItem } from "@beep/scratchpad/beep/Integrations"
 *
 * const item = IntegrationMemoryItem.make({
 *   id: "mem-1",
 *   uid: "user-1",
 *   content: "Ada",
 *   createdAt: IntegrationMemoryItem.make({ id: "mem-1", uid: "user-1", content: "Ada" }).createdAt,
 *   updatedAt: IntegrationMemoryItem.make({ id: "mem-1", uid: "user-1", content: "Ada" }).updatedAt,
 * })
 * console.log(item.id) // "mem-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IntegrationMemoryItem extends Model<IntegrationMemoryItem>("IntegrationMemoryItem")(
  memoryDbFields(),
  $I.annote("IntegrationMemoryItem", {
    description: "Integration response memory. Python called this MemoryItem and dropped nulls on encode.",
  }),
) {}

/**
 * Encoded integration memory item.
 *
 * @see {@link IntegrationMemoryItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntegrationMemoryItem {
  export type Encoded = S.Codec.Encoded<typeof IntegrationMemoryItem>;
}

const encodeEffectIntegrationMemoryItem = S.encodeEffect(IntegrationMemoryItem);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value);

const omitNulls = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, omitNulls);
  if (!isRecord(value)) return value;
  return A.reduce(Rec.toEntries(value), Rec.empty<string, unknown>(), (acc, [key, inner]) =>
    inner === null ? acc : Rec.set(acc, key, omitNulls(inner)),
  );
};

/**
 * Encodes an integration memory and drops nulls.
 *
 * **Example** (Drop a null headline)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { IntegrationMemoryItem, encodeIntegrationMemoryItem } from "@beep/scratchpad/beep/Integrations"
 *
 * const item = IntegrationMemoryItem.make({ id: "mem-1", uid: "user-1", content: "Ada" })
 * const encoded = Effect.runSync(encodeIntegrationMemoryItem(item))
 * console.log("headline" in encoded) // false
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeIntegrationMemoryItem = Effect.fn("IntegrationMemoryItem.encode")(function* (
  item: IntegrationMemoryItem,
) {
  const encoded = yield* encodeEffectIntegrationMemoryItem(item);
  const omitted = omitNulls(encoded);
  return isRecord(omitted) ? omitted : Rec.empty<string, unknown>();
});

/**
 * List of integration memories.
 *
 * **Example** (Decode an empty list)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoriesResponse } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoriesResponse)({ memories: [] }))
 * console.log(decoded.memories.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class MemoriesResponse extends Model<MemoriesResponse>("MemoriesResponse")(
  { memories: S.Array(IntegrationMemoryItem).pipe(pg.jsonb(), pg.columnName("memories")) },
  $I.annote("MemoriesResponse", { description: "List of integration memory responses." }),
) {}

/**
 * Encoded memories response.
 *
 * @see {@link MemoriesResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoriesResponse {
  export type Encoded = S.Codec.Encoded<typeof MemoriesResponse>;
}

/**
 * Nested action item on a conversation summary. This is not a workflow action item.
 *
 * **Example** (Construct an open item)
 *
 * ```ts
 * import { IntegrationActionItem } from "@beep/scratchpad/beep/Integrations"
 *
 * const item = IntegrationActionItem.make({ description: "Call Ada" })
 * console.log(item.completed) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IntegrationActionItem extends Model<IntegrationActionItem>("IntegrationActionItem")(
  {
    description: text("description"),
    completed: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("completed")),
    exported: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("exported")),
    exportDate: optionalTimestamp("export_date"),
    exportPlatform: optionalText("export_platform"),
  },
  $I.annote("IntegrationActionItem", {
    description: "Action item nested in conversation structure. It is not a workflow action-item row.",
  }),
) {}

/**
 * Encoded nested action item.
 *
 * @see {@link IntegrationActionItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntegrationActionItem {
  export type Encoded = S.Codec.Encoded<typeof IntegrationActionItem>;
}

/**
 * Formats a UTC instant with a trailing Z.
 *
 * **Details**
 *
 * Aware values replace `+00:00` with `Z`. A string with no zone gets `Z`
 * appended, which is the naive branch of the Python helper.
 *
 * **Example** (Append Z to a naive string)
 *
 * ```ts
 * import { serializeDateTime } from "@beep/scratchpad/beep/Integrations"
 *
 * console.log(serializeDateTime("2020-01-02T03:04:05")) // "2020-01-02T03:04:05Z"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const serializeDateTime = (value: DateTime.Utc | string): string => {
  if (P.isString(value)) {
    if (Str.endsWith("Z")(value)) return value;
    if (Str.includes("+00:00")(value)) return Str.replace("+00:00", "Z")(value);
    if (/[+-][0-9]{2}:[0-9]{2}$/.test(value)) return value;
    return `${value}Z`;
  }
  return value.pipe(DateTime.formatIso, Str.replace("+00:00", "Z"));
};

/**
 * Calendar event nested in a conversation summary.
 *
 * **Example** (Construct a 30 minute event)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { IntegrationEvent } from "@beep/scratchpad/beep/Integrations"
 *
 * const event = IntegrationEvent.make({
 *   title: "Standup",
 *   start: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(event.duration) // 30
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IntegrationEvent extends Model<IntegrationEvent>("IntegrationEvent")(
  {
    title: text("title"),
    description: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), pg.text(), pg.columnName("description")),
    start: timestamp("start"),
    duration: S.Int.pipe(S.withConstructorDefault(Effect.succeed(30)), pg.integer(), pg.columnName("duration")),
    created: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("created")),
  },
  $I.annote("IntegrationEvent", { description: "Event nested in a conversation summary. Duration defaults to 30 minutes." }),
) {}

/**
 * Encoded nested event.
 *
 * @see {@link IntegrationEvent} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntegrationEvent {
  export type Encoded = S.Codec.Encoded<typeof IntegrationEvent>;
}

const encodeIntegrationEvent = S.encodeEffect(IntegrationEvent);

/**
 * Encodes an event and rewrites `start` to a Z-suffixed UTC string.
 *
 * **Example** (Clean the start)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { IntegrationEvent, eventAsDictCleanedDates } from "@beep/scratchpad/beep/Integrations"
 *
 * const encoded = Effect.runSync(
 *   eventAsDictCleanedDates(
 *     IntegrationEvent.make({ title: "Standup", start: DateTime.unsafeMake("2020-01-02T03:04:05.000Z") }),
 *   ),
 * )
 * console.log(encoded.start.endsWith("Z")) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const eventAsDictCleanedDates = Effect.fn("IntegrationEvent.asDictCleanedDates")(function* (
  event: IntegrationEvent,
) {
  const encoded = yield* encodeIntegrationEvent(event);
  return { ...encoded, start: serializeDateTime(event.start) };
});

/**
 * Structured summary stored on a conversation item.
 *
 * **Example** (Construct the emoji default)
 *
 * ```ts
 * import { ConversationItemStructured } from "@beep/scratchpad/beep/Integrations"
 *
 * const structured = ConversationItemStructured.make({ title: "Notes", overview: "A call" })
 * console.log(structured.emoji) // "🧠"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConversationItemStructured extends Model<ConversationItemStructured>("ConversationItemStructured")(
  {
    title: text("title"),
    overview: text("overview"),
    emoji: S.String.pipe(S.withConstructorDefault(Effect.succeed("🧠")), pg.text(), pg.columnName("emoji")),
    category: S.String.pipe(S.withConstructorDefault(Effect.succeed("other")), pg.text(), pg.columnName("category")),
    actionItems: S.Array(IntegrationActionItem).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<IntegrationActionItem>())),
      pg.jsonb(),
      pg.columnName("action_items"),
    ),
    events: S.Array(IntegrationEvent).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<IntegrationEvent>())),
      pg.jsonb(),
      pg.columnName("events"),
    ),
  },
  $I.annote("ConversationItemStructured", {
    description: "Derived conversation summary. Its action items are not workflow rows.",
  }),
) {}

/**
 * Encoded conversation summary.
 *
 * @see {@link ConversationItemStructured} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationItemStructured {
  export type Encoded = S.Codec.Encoded<typeof ConversationItemStructured>;
}

/**
 * Geolocation attached to a conversation item.
 *
 * **Example** (Decode a point)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ConversationItemGeolocation } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConversationItemGeolocation)({ latitude: 1, longitude: 2 }))
 * console.log(O.isNone(decoded.address)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConversationItemGeolocation extends Model<ConversationItemGeolocation>("ConversationItemGeolocation")(
  {
    googlePlaceId: optionalText("google_place_id"),
    latitude: S.Finite.pipe(pg.doublePrecision(), pg.columnName("latitude")),
    longitude: S.Finite.pipe(pg.doublePrecision(), pg.columnName("longitude")),
    address: optionalText("address"),
    locationType: optionalText("location_type"),
  },
  $I.annote("ConversationItemGeolocation", { description: "Point attached to an upstream conversation item." }),
) {}

/**
 * Encoded conversation geolocation.
 *
 * @see {@link ConversationItemGeolocation} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationItemGeolocation {
  export type Encoded = S.Codec.Encoded<typeof ConversationItemGeolocation>;
}

/**
 * Transcript segment on a conversation item.
 *
 * **Example** (Construct zero offsets)
 *
 * ```ts
 * import { ConversationItemTranscriptSegment } from "@beep/scratchpad/beep/Integrations"
 *
 * const segment = ConversationItemTranscriptSegment.make({ text: "hello" })
 * console.log(segment.start) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConversationItemTranscriptSegment extends Model<ConversationItemTranscriptSegment>(
  "ConversationItemTranscriptSegment",
)(
  {
    text: text("text"),
    speaker: optionalText("speaker"),
    isUser: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("is_user")),
    personId: optionalText("person_id"),
    start: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0)), pg.doublePrecision(), pg.columnName("start")),
    end: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0)), pg.doublePrecision(), pg.columnName("end")),
  },
  $I.annote("ConversationItemTranscriptSegment", { description: "Transcript segment on an upstream conversation item." }),
) {}

/**
 * Encoded transcript segment.
 *
 * @see {@link ConversationItemTranscriptSegment} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationItemTranscriptSegment {
  export type Encoded = S.Codec.Encoded<typeof ConversationItemTranscriptSegment>;
}

/**
 * One upstream conversation returned by an integration.
 *
 * **Details**
 *
 * `discarded` is a nullish boolean: missing becomes false, and a present null
 * stays `None`. This row is a conversation, not a memory.
 *
 * **Example** (Decode a missing discarded flag as false)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ConversationItem } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ConversationItem)({
 *     id: "conv-1",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     source: "omi",
 *   }),
 * )
 * console.log(O.getOrNull(decoded.discarded)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConversationItem extends Model<ConversationItem>("ConversationItem")(
  {
    id: text("id"),
    createdAt: timestamp("created_at"),
    startedAt: optionalTimestamp("started_at"),
    finishedAt: optionalTimestamp("finished_at"),
    source: text("source"),
    structured: optionalNull(ConversationItemStructured).pipe(pg.jsonb(), pg.columnName("structured")),
    transcriptSegments: ConversationItemTranscriptSegment.pipe(
      S.Array,
      optionalNull,
      pg.jsonb(),
      pg.columnName("transcript_segments"),
    ),
    discarded: optionMissingDefault(S.Boolean, false).pipe(pg.boolean(), pg.columnName("discarded")),
    appId: optionalText("app_id"),
    language: optionalText("language"),
    externalData: optionalNull(S.Record(S.String, S.Json)).pipe(pg.jsonb(), pg.columnName("external_data")),
    geolocation: optionalNull(ConversationItemGeolocation).pipe(pg.jsonb(), pg.columnName("geolocation")),
    status: optionalText("status"),
  },
  $I.annote("ConversationItem", {
    description: "Upstream conversation returned by an integration. It is not a memory.",
  }),
) {}

/**
 * Encoded conversation item.
 *
 * @see {@link ConversationItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationItem {
  export type Encoded = S.Codec.Encoded<typeof ConversationItem>;
}

/**
 * Page of upstream conversations.
 *
 * **Example** (Decode an empty page)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationsResponse } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConversationsResponse)({ conversations: [] }))
 * console.log(decoded.conversations.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConversationsResponse extends Model<ConversationsResponse>("ConversationsResponse")(
  { conversations: S.Array(ConversationItem).pipe(pg.jsonb(), pg.columnName("conversations")) },
  $I.annote("ConversationsResponse", { description: "List of upstream conversations." }),
) {}

/**
 * Encoded conversations response.
 *
 * @see {@link ConversationsResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationsResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationsResponse>;
}

/**
 * Paged search of upstream conversations.
 *
 * **Example** (Decode the first page)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SearchConversationsResponse } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(SearchConversationsResponse)({
 *     conversations: [],
 *     totalPages: 1,
 *     currentPage: 1,
 *     perPage: 20,
 *   }),
 * )
 * console.log(decoded.perPage) // 20
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SearchConversationsResponse extends Model<SearchConversationsResponse>("SearchConversationsResponse")(
  {
    conversations: S.Array(ConversationItem).pipe(pg.jsonb(), pg.columnName("conversations")),
    totalPages: S.Int.pipe(pg.integer(), pg.columnName("total_pages")),
    currentPage: S.Int.pipe(pg.integer(), pg.columnName("current_page")),
    perPage: S.Int.pipe(pg.integer(), pg.columnName("per_page")),
  },
  $I.annote("SearchConversationsResponse", { description: "Paged list of upstream conversations." }),
) {}

/**
 * Encoded conversation search response.
 *
 * @see {@link SearchConversationsResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SearchConversationsResponse {
  export type Encoded = S.Codec.Encoded<typeof SearchConversationsResponse>;
}

/**
 * Workflow task returned by an integration. It is not a memory layer.
 *
 * **Example** (Decode an open task)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { TaskItem } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(TaskItem)({ id: "task-1", description: "Call", completed: false }),
 * )
 * console.log(O.isNone(decoded.dueAt)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TaskItem extends Model<TaskItem>("TaskItem")(
  {
    id: text("id"),
    description: text("description"),
    completed: S.Boolean.pipe(pg.boolean(), pg.columnName("completed")),
    createdAt: optionalTimestamp("created_at"),
    updatedAt: optionalTimestamp("updated_at"),
    dueAt: optionalTimestamp("due_at"),
    completedAt: optionalTimestamp("completed_at"),
    conversationId: optionalText("conversation_id"),
  },
  $I.annote("TaskItem", { description: "Workflow task in an integration response. It is not a memory." }),
) {}

/**
 * Encoded task item.
 *
 * @see {@link TaskItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskItem {
  export type Encoded = S.Codec.Encoded<typeof TaskItem>;
}

/**
 * List of workflow tasks.
 *
 * **Example** (Decode an empty task list)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TasksResponse } from "@beep/scratchpad/beep/Integrations"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TasksResponse)({ tasks: [] }))
 * console.log(decoded.tasks.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TasksResponse extends Model<TasksResponse>("TasksResponse")(
  { tasks: S.Array(TaskItem).pipe(pg.jsonb(), pg.columnName("tasks")) },
  $I.annote("TasksResponse", { description: "List of workflow tasks returned by an integration." }),
) {}

/**
 * Encoded tasks response.
 *
 * @see {@link TasksResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TasksResponse {
  export type Encoded = S.Codec.Encoded<typeof TasksResponse>;
}
