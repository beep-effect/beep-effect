/**
 * Listen and chat events delivered to the client.
 *
 * The Python field is `event_type`. `to_json` renames it to the wire key `type`.
 * Dart-only events that are absent from this module are not added.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Tuple from "effect/Tuple";
import { Model, optionalNull, pg } from "./Kit.ts";

const decodeJsonObject = S.decodeUnknownEffect(S.JsonObject);

const $I = $ScratchpadId.create("beep/MessageEvent");

const emptyStrings: ReadonlyArray<string> = [];
const emptyObjects: ReadonlyArray<{ readonly [key: string]: S.Json }> = [];

/**
 * Client action that asks the device to set up on-device speech to text.
 *
 * **Example** (Read the action)
 *
 * ```ts
 * import { FREEMIUM_ACTION_SETUP_ON_DEVICE_STT } from "./MessageEvent.ts"
 *
 * console.log(FREEMIUM_ACTION_SETUP_ON_DEVICE_STT) // "setup_on_device_stt"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FREEMIUM_ACTION_SETUP_ON_DEVICE_STT = "setup_on_device_stt";

/**
 * Client action that asks for no freemium follow-up.
 *
 * **Example** (Read the action)
 *
 * ```ts
 * import { FREEMIUM_ACTION_NONE } from "./MessageEvent.ts"
 *
 * console.log(FREEMIUM_ACTION_NONE) // "none"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FREEMIUM_ACTION_NONE = "none";

const optionNullOrMissingDefault = <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, missing: Sch["Type"]) =>
  S.NullOr(schema).pipe(
    S.optionalKey,
    S.decodeTo(S.Option(schema), {
      decode: SchemaGetter.transformOptional((present) =>
        present.pipe(
          O.match({
            onNone: () => O.some(missing),
            onSome: (value) => (P.isNull(value) ? O.none() : O.some(value)),
          }),
          O.some,
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


const openType = S.String.check(S.isMinLength(1))
  .annotateKey({ description: "Caller-supplied event type. Serialized as type." })
  .pipe(pg.text(), pg.columnName("event_type"));

const optionalString = (column: string, description: string) =>
  optionalNull(S.String).annotateKey({ description }).pipe(pg.text(), pg.columnName(column));

const optionalInt = (column: string, description: string) =>
  optionalNull(S.Int).annotateKey({ description }).pipe(pg.integer(), pg.columnName(column));

const document = (column: string, description: string) =>
  S.JsonObject.annotateKey({ description }).pipe(pg.jsonb(), pg.columnName(column));

const optionalDocuments = (column: string, description: string) =>
  optionNullOrMissingDefault(S.Array(S.JsonObject), emptyObjects)
    .annotateKey({ description })
    .pipe(pg.jsonb(), pg.columnName(column));

const optionalStrings = (column: string, description: string) =>
  optionNullOrMissingDefault(S.Array(S.String), emptyStrings)
    .annotateKey({ description })
    .pipe(pg.jsonb(), pg.columnName(column));

/**
 * Base listen event. Subclasses with a fixed type form {@link FixedMessageEvent}.
 *
 * **Gotchas**
 *
 * Classes without a default type stay outside the tagged union because the
 * caller supplies `eventType`. `ConversationEvent` is one shape for both
 * `memory_created` and `memory_processing_started`.
 *
 * **Example** (Rename the wire key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { MessageEvent, messageEventToJson } from "./MessageEvent.ts"
 *
 * const json = Effect.runSync(messageEventToJson(MessageEvent.make({ eventType: "custom" })))
 * console.log(json.type) // "custom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MessageEvent extends Model<MessageEvent>("MessageEvent")(
  {
    eventType: openType,
  },
  $I.annote("MessageEvent", { description: "Base listen event whose wire key is type." }),
) {}

/**
 * Encoded form of {@link MessageEvent}.
 *
 * @see {@link MessageEvent} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MessageEvent {
  export type Encoded = S.Codec.Encoded<typeof MessageEvent>;
}

const encodeMessageEvent = S.encodeEffect(MessageEvent);

/**
 * Conversation lifecycle event.
 *
 * **Details**
 *
 * The recording identity is optional for older producers. Identified listen
 * sessions must propagate it so clients never infer ownership from the socket.
 * The lifecycle envelope is additive. `messages` missing becomes an empty list;
 * null stays absent. Completed listen passes an empty list, and processing
 * passes null.
 *
 * **Example** (Keep a null message list)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ConversationEvent } from "./MessageEvent.ts"
 *
 * const event = ConversationEvent.make({
 *   eventType: "memory_processing_started",
 *   memory: { id: "conversation-1" },
 *   messages: O.none(),
 * })
 * console.log(O.isNone(event.messages)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationEvent extends Model<ConversationEvent>("ConversationEvent")(
  {
    eventType: openType,
    memory: document("memory", "Conversation document carried by the lifecycle event."),
    messages: optionalDocuments("messages", "Chat messages. Missing becomes an empty list; null stays absent."),
    recordingSessionId: optionalString("recording_session_id", "Recording identity that caused the event."),
    conversationId: optionalString("conversation_id", "Conversation id on the lifecycle envelope."),
    lifecycleVersion: optionalInt("lifecycle_version", "Lifecycle envelope version."),
    lifecyclePhase: optionalString("lifecycle_phase", "Lifecycle phase."),
    lifecycleSequence: optionalInt("lifecycle_sequence", "Lifecycle sequence."),
  },
  $I.annote("ConversationEvent", { description: "Conversation lifecycle event for created or processing memory." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace ConversationEvent {
  /** Encoded form of {@link ConversationEvent}. */
  export type Encoded = S.Codec.Encoded<typeof ConversationEvent>;
}

const encodeConversationEvent = S.encodeEffect(ConversationEvent);

/**
 * Newly created conversation event.
 *
 * **Example** (Omit the optional ids)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NewConversationCreated } from "./MessageEvent.ts"
 *
 * const event = NewConversationCreated.make({ eventType: "new_conversation", memory: { id: "conversation-1" } })
 * console.log(O.isNone(event.memoryId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NewConversationCreated extends Model<NewConversationCreated>("NewConversationCreated")(
  {
    eventType: openType,
    processingMemoryId: optionalString("processing_memory_id", "In-flight processing id."),
    memoryId: optionalString("memory_id", "Durable conversation id when already known."),
    messageIds: optionalStrings("message_ids", "Message ids. Missing becomes an empty list; null stays absent."),
    memory: document("memory", "Conversation document."),
    messages: optionalDocuments("messages", "Chat messages. Missing becomes an empty list; null stays absent."),
  },
  $I.annote("NewConversationCreated", { description: "Event announcing a newly created conversation." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace NewConversationCreated {
  /** Encoded form of {@link NewConversationCreated}. */
  export type Encoded = S.Codec.Encoded<typeof NewConversationCreated>;
}

const encodeNewConversationCreated = S.encodeEffect(NewConversationCreated);

/**
 * Event announcing a processing conversation before it is durable.
 *
 * **Example** (Leave both ids absent)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NewProcessingConversationCreated } from "./MessageEvent.ts"
 *
 * const event = NewProcessingConversationCreated.make({ eventType: "processing" })
 * console.log(O.isNone(event.processingMemoryId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NewProcessingConversationCreated extends Model<NewProcessingConversationCreated>(
  "NewProcessingConversationCreated",
)(
  {
    eventType: openType,
    processingMemoryId: optionalString("processing_memory_id", "In-flight processing id."),
    memoryId: optionalString("memory_id", "Durable conversation id when already known."),
  },
  $I.annote("NewProcessingConversationCreated", {
    description: "Event announcing a processing conversation before it is durable.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace NewProcessingConversationCreated {
  /** Encoded form of {@link NewProcessingConversationCreated}. */
  export type Encoded = S.Codec.Encoded<typeof NewProcessingConversationCreated>;
}

const encodeNewProcessingConversationCreated = S.encodeEffect(NewProcessingConversationCreated);

/**
 * Processing-status change for a conversation.
 *
 * **Example** (Carry a status)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ProcessingConversationStatusChanged } from "./MessageEvent.ts"
 *
 * const event = ProcessingConversationStatusChanged.make({
 *   eventType: "processing_status",
 *   processingMemoryStatus: O.some("completed"),
 * })
 * console.log(O.isSome(event.processingMemoryStatus)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessingConversationStatusChanged extends Model<ProcessingConversationStatusChanged>(
  "ProcessingConversationStatusChanged",
)(
  {
    eventType: openType,
    processingMemoryId: optionalString("processing_memory_id", "In-flight processing id."),
    processingMemoryStatus: optionalString("processing_memory_status", "Processing status text."),
    memoryId: optionalString("memory_id", "Durable conversation id when already known."),
  },
  $I.annote("ProcessingConversationStatusChanged", { description: "Processing-status change for a conversation." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace ProcessingConversationStatusChanged {
  /** Encoded form of {@link ProcessingConversationStatusChanged}. */
  export type Encoded = S.Codec.Encoded<typeof ProcessingConversationStatusChanged>;
}

const encodeProcessingConversationStatusChanged = S.encodeEffect(ProcessingConversationStatusChanged);

/**
 * Backward-sync event. The class name keeps the Python `Sycned` typo.
 *
 * **Gotchas**
 *
 * `MemoryBackwardSycnedEvent` is the frozen class name. Do not correct the spelling.
 *
 * **Example** (Keep the typo class)
 *
 * ```ts
 * import { MemoryBackwardSycnedEvent } from "./MessageEvent.ts"
 *
 * const event = MemoryBackwardSycnedEvent.make({ eventType: "backward_sync", name: O.none() })
 * console.log(event.eventType) // "backward_sync"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryBackwardSycnedEvent extends Model<MemoryBackwardSycnedEvent>("MemoryBackwardSycnedEvent")(
  {
    eventType: openType,
    name: optionalString("name", "Backward-sync name. The class spelling Sycned is the contract."),
  },
  $I.annote("MemoryBackwardSycnedEvent", { description: "Backward-sync event. The Sycned spelling is frozen." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace MemoryBackwardSycnedEvent {
  /** Encoded form of {@link MemoryBackwardSycnedEvent}. */
  export type Encoded = S.Codec.Encoded<typeof MemoryBackwardSycnedEvent>;
}

const encodeMemoryBackwardSycnedEvent = S.encodeEffect(MemoryBackwardSycnedEvent);

/**
 * Service status event. Null outcome fields are omitted from JSON.
 *
 * **Details**
 *
 * The outcome fields are an additive terminal-failure contract, not nullable
 * noise on legacy ready and initiating status events.
 *
 * **Example** (Default the type)
 *
 * ```ts
 * import { MessageServiceStatusEvent } from "./MessageEvent.ts"
 *
 * console.log(MessageServiceStatusEvent.make({ status: "ready" }).eventType) // "service_status"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MessageServiceStatusEvent extends Model<MessageServiceStatusEvent>("MessageServiceStatusEvent")(
  {
    eventType: S.Literal("service_status").pipe(
      S.withConstructorDefault(Effect.succeed<"service_status">("service_status")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    status: S.String.annotateKey({ description: "Service status." }).pipe(pg.text(), pg.columnName("status")),
    statusText: optionalString("status_text", "Human status text."),
    outcome: optionalString("outcome", "Terminal outcome. Omitted from JSON when absent."),
    provider: optionalString("provider", "Status provider. Omitted from JSON when absent."),
    retryable: optionalNull(S.Boolean)
      .annotateKey({ description: "Whether the failure can be retried." })
      .pipe(pg.boolean(), pg.columnName("retryable")),
    reason: optionalString("reason", "Failure reason. Omitted from JSON when absent."),
  },
  $I.annote("MessageServiceStatusEvent", { description: "Service status event that drops nulls from JSON." }),
) {
  static readonly thunkThis = () => MessageServiceStatusEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace MessageServiceStatusEvent {
  /** Encoded form of {@link MessageServiceStatusEvent}. */
  export type Encoded = S.Codec.Encoded<typeof MessageServiceStatusEvent>;
}

const encodeMessageServiceStatusEvent = S.encodeEffect(MessageServiceStatusEvent);
const isMessageServiceStatusEvent = S.is(MessageServiceStatusEvent);

/**
 * Recording-session lifecycle event. Not part of the older Dart switch.
 *
 * **Example** (Default the session status)
 *
 * ```ts
 * import { ConversationSessionEvent } from "./MessageEvent.ts"
 *
 * console.log(ConversationSessionEvent.make({ conversationId: "conversation-1" }).status) // "in_progress"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationSessionEvent extends Model<ConversationSessionEvent>("ConversationSessionEvent")(
  {
    eventType: S.Literal("conversation_session").pipe(
      S.withConstructorDefault(Effect.succeed<"conversation_session">("conversation_session")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    conversationId: S.String.annotateKey({ description: "Conversation id." }).pipe(
      pg.text(),
      pg.columnName("conversation_id"),
    ),
    status: S.String.annotateKey({ description: "Session status. Construction defaults to in_progress." }).pipe(
      S.withConstructorDefault(Effect.succeed("in_progress")),
      pg.text(),
      pg.columnName("status"),
    ),
    recordingSessionId: optionalString("recording_session_id", "Recording identity."),
    lifecycleVersion: optionalInt("lifecycle_version", "Lifecycle envelope version."),
    lifecyclePhase: optionalString("lifecycle_phase", "Lifecycle phase."),
    lifecycleSequence: optionalInt("lifecycle_sequence", "Lifecycle sequence."),
  },
  $I.annote("ConversationSessionEvent", { description: "Recording-session lifecycle event." }),
) {
  static readonly thunkThis = () => ConversationSessionEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace ConversationSessionEvent {
  /** Encoded form of {@link ConversationSessionEvent}. */
  export type Encoded = S.Codec.Encoded<typeof ConversationSessionEvent>;
}

const encodeConversationSessionEvent = S.encodeEffect(ConversationSessionEvent);
const isConversationSessionEvent = S.is(ConversationSessionEvent);

/**
 * Keepalive event.
 *
 * **Example** (Make a ping)
 *
 * ```ts
 * import { PingEvent } from "./MessageEvent.ts"
 *
 * console.log(PingEvent.make({}).eventType) // "ping"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PingEvent extends Model<PingEvent>("PingEvent")(
  { eventType: S.Literal("ping").pipe(
      S.withConstructorDefault(Effect.succeed<"ping">("ping")),
      pg.text(),
      pg.columnName("event_type"),
    ) },
  $I.annote("PingEvent", { description: "Keepalive event." }),
) {
  static readonly thunkThis = () => PingEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace PingEvent {
  /** Encoded form of {@link PingEvent}. */
  export type Encoded = S.Codec.Encoded<typeof PingEvent>;
}

const encodePingEvent = S.encodeEffect(PingEvent);
const isPingEvent = S.is(PingEvent);

/**
 * Pointer to the latest conversation.
 *
 * **Gotchas**
 *
 * The wire type is `last_memory`. The class name says conversation. Both stay frozen.
 *
 * **Example** (Read the wire type)
 *
 * ```ts
 * import { LastConversationEvent } from "./MessageEvent.ts"
 *
 * console.log(LastConversationEvent.make({ memoryId: "conversation-1" }).eventType) // "last_memory"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LastConversationEvent extends Model<LastConversationEvent>("LastConversationEvent")(
  {
    eventType: S.Literal("last_memory").pipe(
      S.withConstructorDefault(Effect.succeed<"last_memory">("last_memory")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    memoryId: S.String.annotateKey({ description: "Latest conversation id." }).pipe(pg.text(), pg.columnName("memory_id")),
  },
  $I.annote("LastConversationEvent", { description: "Pointer to the latest conversation. Wire type is last_memory." }),
) {
  static readonly thunkThis = () => LastConversationEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace LastConversationEvent {
  /** Encoded form of {@link LastConversationEvent}. */
  export type Encoded = S.Codec.Encoded<typeof LastConversationEvent>;
}

const encodeLastConversationEvent = S.encodeEffect(LastConversationEvent);
const isLastConversationEvent = S.is(LastConversationEvent);

/**
 * Partial translation segments.
 *
 * **Example** (Start with no segments)
 *
 * ```ts
 * import { TranslationEvent } from "./MessageEvent.ts"
 *
 * console.log(TranslationEvent.make({}).segments.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranslationEvent extends Model<TranslationEvent>("TranslationEvent")(
  {
    eventType: S.Literal("translating").pipe(
      S.withConstructorDefault(Effect.succeed<"translating">("translating")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    segments: S.Array(S.JsonObject)
      .annotateKey({ description: "Untyped translation segment documents." })
      .pipe(S.withConstructorDefault(Effect.succeed(emptyObjects)), pg.jsonb(), pg.columnName("segments")),
  },
  $I.annote("TranslationEvent", { description: "Partial translation segments." }),
) {
  static readonly thunkThis = () => TranslationEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace TranslationEvent {
  /** Encoded form of {@link TranslationEvent}. */
  export type Encoded = S.Codec.Encoded<typeof TranslationEvent>;
}

const encodeTranslationEvent = S.encodeEffect(TranslationEvent);
const isTranslationEvent = S.is(TranslationEvent);

/**
 * Photo that is still being processed.
 *
 * **Example** (Name the temp id)
 *
 * ```ts
 * import { PhotoProcessingEvent } from "./MessageEvent.ts"
 *
 * console.log(PhotoProcessingEvent.make({ tempId: "tmp", photoId: "photo-1" }).tempId) // "tmp"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhotoProcessingEvent extends Model<PhotoProcessingEvent>("PhotoProcessingEvent")(
  {
    eventType: S.Literal("photo_processing").pipe(
      S.withConstructorDefault(Effect.succeed<"photo_processing">("photo_processing")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    tempId: S.String.annotateKey({ description: "Temporary photo id." }).pipe(pg.text(), pg.columnName("temp_id")),
    photoId: S.String.annotateKey({ description: "Durable photo id." }).pipe(pg.text(), pg.columnName("photo_id")),
  },
  $I.annote("PhotoProcessingEvent", { description: "Photo that is still being processed." }),
) {
  static readonly thunkThis = () => PhotoProcessingEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace PhotoProcessingEvent {
  /** Encoded form of {@link PhotoProcessingEvent}. */
  export type Encoded = S.Codec.Encoded<typeof PhotoProcessingEvent>;
}

const encodePhotoProcessingEvent = S.encodeEffect(PhotoProcessingEvent);
const isPhotoProcessingEvent = S.is(PhotoProcessingEvent);

/**
 * Photo description result.
 *
 * **Example** (Mark a discarded photo)
 *
 * ```ts
 * import { PhotoDescribedEvent } from "./MessageEvent.ts"
 *
 * console.log(PhotoDescribedEvent.make({ photoId: "photo-1", description: "A desk", discarded: true }).discarded) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhotoDescribedEvent extends Model<PhotoDescribedEvent>("PhotoDescribedEvent")(
  {
    eventType: S.Literal("photo_described").pipe(
      S.withConstructorDefault(Effect.succeed<"photo_described">("photo_described")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    photoId: S.String.annotateKey({ description: "Durable photo id." }).pipe(pg.text(), pg.columnName("photo_id")),
    description: S.String.annotateKey({ description: "Model description." }).pipe(pg.text(), pg.columnName("description")),
    discarded: S.Boolean.annotateKey({ description: "Whether the photo was discarded." }).pipe(
      pg.boolean(),
      pg.columnName("discarded"),
    ),
  },
  $I.annote("PhotoDescribedEvent", { description: "Photo description result." }),
) {
  static readonly thunkThis = () => PhotoDescribedEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace PhotoDescribedEvent {
  /** Encoded form of {@link PhotoDescribedEvent}. */
  export type Encoded = S.Codec.Encoded<typeof PhotoDescribedEvent>;
}

const encodePhotoDescribedEvent = S.encodeEffect(PhotoDescribedEvent);
const isPhotoDescribedEvent = S.is(PhotoDescribedEvent);

/**
 * Suggested speaker label for one transcript segment.
 *
 * **Example** (Name the person)
 *
 * ```ts
 * import { SpeakerLabelSuggestionEvent } from "./MessageEvent.ts"
 *
 * const event = SpeakerLabelSuggestionEvent.make({
 *   speakerId: 1,
 *   personId: "person-1",
 *   personName: "Ada",
 *   segmentId: "segment-1",
 * })
 * console.log(event.personName) // "Ada"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpeakerLabelSuggestionEvent extends Model<SpeakerLabelSuggestionEvent>("SpeakerLabelSuggestionEvent")(
  {
    eventType: S.Literal("speaker_label_suggestion").pipe(
      S.withConstructorDefault(Effect.succeed<"speaker_label_suggestion">("speaker_label_suggestion")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    speakerId: S.Int.annotateKey({ description: "Transcript speaker id." }).pipe(pg.integer(), pg.columnName("speaker_id")),
    personId: S.String.annotateKey({ description: "Suggested person id." }).pipe(pg.text(), pg.columnName("person_id")),
    personName: S.String.annotateKey({ description: "Suggested person name." }).pipe(
      pg.text(),
      pg.columnName("person_name"),
    ),
    segmentId: S.String.annotateKey({ description: "Transcript segment id." }).pipe(pg.text(), pg.columnName("segment_id")),
  },
  $I.annote("SpeakerLabelSuggestionEvent", { description: "Suggested speaker label for one transcript segment." }),
) {
  static readonly thunkThis = () => SpeakerLabelSuggestionEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace SpeakerLabelSuggestionEvent {
  /** Encoded form of {@link SpeakerLabelSuggestionEvent}. */
  export type Encoded = S.Codec.Encoded<typeof SpeakerLabelSuggestionEvent>;
}

const encodeSpeakerLabelSuggestionEvent = S.encodeEffect(SpeakerLabelSuggestionEvent);
const isSpeakerLabelSuggestionEvent = S.is(SpeakerLabelSuggestionEvent);

/**
 * Freemium threshold event.
 *
 * **Gotchas**
 *
 * `action` stays an open string. {@link FREEMIUM_ACTION_SETUP_ON_DEVICE_STT} and
 * {@link FREEMIUM_ACTION_NONE} are known values, not a closed schema.
 *
 * **Example** (Use the none action)
 *
 * ```ts
 * import { FREEMIUM_ACTION_NONE, FreemiumThresholdReachedEvent } from "./MessageEvent.ts"
 *
 * const event = FreemiumThresholdReachedEvent.make({ remainingSeconds: 0, action: FREEMIUM_ACTION_NONE })
 * console.log(event.action) // "none"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreemiumThresholdReachedEvent extends Model<FreemiumThresholdReachedEvent>(
  "FreemiumThresholdReachedEvent",
)(
  {
    eventType: S.Literal("freemium_threshold_reached").pipe(
      S.withConstructorDefault(Effect.succeed<"freemium_threshold_reached">("freemium_threshold_reached")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    remainingSeconds: S.Int.annotateKey({ description: "Seconds remaining on the freemium budget." }).pipe(
      pg.integer(),
      pg.columnName("remaining_seconds"),
    ),
    action: S.String.annotateKey({ description: "Open client action. Known constants are not a closed set." }).pipe(
      pg.text(),
      pg.columnName("action"),
    ),
  },
  $I.annote("FreemiumThresholdReachedEvent", { description: "Freemium threshold event with an open action." }),
) {
  static readonly thunkThis = () => FreemiumThresholdReachedEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace FreemiumThresholdReachedEvent {
  /** Encoded form of {@link FreemiumThresholdReachedEvent}. */
  export type Encoded = S.Codec.Encoded<typeof FreemiumThresholdReachedEvent>;
}

const encodeFreemiumThresholdReachedEvent = S.encodeEffect(FreemiumThresholdReachedEvent);
const isFreemiumThresholdReachedEvent = S.is(FreemiumThresholdReachedEvent);

/**
 * Deleted transcript segments.
 *
 * **Example** (List one segment)
 *
 * ```ts
 * import { SegmentsDeletedEvent } from "./MessageEvent.ts"
 *
 * console.log(SegmentsDeletedEvent.make({ segmentIds: ["segment-1"] }).segmentIds.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SegmentsDeletedEvent extends Model<SegmentsDeletedEvent>("SegmentsDeletedEvent")(
  {
    eventType: S.Literal("segments_deleted").pipe(
      S.withConstructorDefault(Effect.succeed<"segments_deleted">("segments_deleted")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    segmentIds: S.Array(S.String)
      .annotateKey({ description: "Deleted transcript segment ids." })
      .pipe(pg.jsonb(), pg.columnName("segment_ids")),
  },
  $I.annote("SegmentsDeletedEvent", { description: "Deleted transcript segments." }),
) {
  static readonly thunkThis = () => SegmentsDeletedEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace SegmentsDeletedEvent {
  /** Encoded form of {@link SegmentsDeletedEvent}. */
  export type Encoded = S.Codec.Encoded<typeof SegmentsDeletedEvent>;
}

const encodeSegmentsDeletedEvent = S.encodeEffect(SegmentsDeletedEvent);
const isSegmentsDeletedEvent = S.is(SegmentsDeletedEvent);

/**
 * Proactive chat message. A null conversation id is omitted from JSON.
 *
 * **Example** (Omit the conversation)
 *
 * ```ts
 * import { ProactiveMessageEvent } from "./MessageEvent.ts"
 *
 * const event = ProactiveMessageEvent.make({ appId: "app-1", title: "Hi", message: "There" })
 * console.log(event.eventType) // "proactive_message"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProactiveMessageEvent extends Model<ProactiveMessageEvent>("ProactiveMessageEvent")(
  {
    eventType: S.Literal("proactive_message").pipe(
      S.withConstructorDefault(Effect.succeed<"proactive_message">("proactive_message")),
      pg.text(),
      pg.columnName("event_type"),
    ),
    appId: S.String.annotateKey({ description: "Sending app id." }).pipe(pg.text(), pg.columnName("app_id")),
    title: S.String.annotateKey({ description: "Proactive title." }).pipe(pg.text(), pg.columnName("title")),
    message: S.String.annotateKey({ description: "Proactive body." }).pipe(pg.text(), pg.columnName("message")),
    conversationId: optionalString("conversation_id", "Conversation id. Omitted from JSON when absent."),
  },
  $I.annote("ProactiveMessageEvent", { description: "Proactive chat message that drops nulls from JSON." }),
) {
  static readonly thunkThis = () => ProactiveMessageEvent;
}

/** @category type-level @since 0.0.0 */
export declare namespace ProactiveMessageEvent {
  /** Encoded form of {@link ProactiveMessageEvent}. */
  export type Encoded = S.Codec.Encoded<typeof ProactiveMessageEvent>;
}

const encodeProactiveMessageEvent = S.encodeEffect(ProactiveMessageEvent);

/**
 * Fixed-type listen events, discriminated on `eventType`.
 *
 * **Details**
 *
 * The wire key is `type`, applied by {@link messageEventToJson} through
 * `Schema.encodeKeys`. Open-type classes are not members.
 *
 * **Example** (Decode a ping)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FixedMessageEvent } from "./MessageEvent.ts"
 *
 * const event = Effect.runSync(S.decodeUnknownEffect(FixedMessageEvent)({ eventType: "ping" }))
 * console.log(event.eventType) // "ping"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FixedMessageEvent = LiteralKit([
  "service_status",
  "conversation_session",
  "ping",
  "last_memory",
  "translating",
  "photo_processing",
  "photo_described",
  "speaker_label_suggestion",
  "freemium_threshold_reached",
  "segments_deleted",
  "proactive_message",
])
  .mapMembers(
    Tuple.evolve([
      MessageServiceStatusEvent.thunkThis,
      ConversationSessionEvent.thunkThis,
      PingEvent.thunkThis,
      LastConversationEvent.thunkThis,
      TranslationEvent.thunkThis,
      PhotoProcessingEvent.thunkThis,
      PhotoDescribedEvent.thunkThis,
      SpeakerLabelSuggestionEvent.thunkThis,
      FreemiumThresholdReachedEvent.thunkThis,
      SegmentsDeletedEvent.thunkThis,
      ProactiveMessageEvent.thunkThis,
    ]),
  )
  .pipe(
    S.toTaggedUnion("eventType"),
    $I.annoteSchema("FixedMessageEvent", {
      description: "Listen events whose event type partitions the payload.",
    }),
  );

/**
 * Decoded fixed-type listen event.
 *
 * @see {@link FixedMessageEvent} for the runtime union.
 * @category type-level
 * @since 0.0.0
 */
export type FixedMessageEvent = typeof FixedMessageEvent.Type;

const renameType = (record: { readonly [key: string]: S.Json }): { readonly [key: string]: S.Json } => {
  const typeValue = record.eventType;
  const rest = Rec.remove(record, "eventType");
  return P.isString(typeValue) ? { ...rest, type: typeValue } : rest;
};

const jsonFrom =
  <A>(name: string, omitNull: boolean) =>
  (encode: (event: A) => Effect.Effect<unknown, S.SchemaError, never>) =>
    Effect.fn(name)(function* (event: A) {
      const encoded = yield* encode(event);
      const record = yield* decodeJsonObject(encoded);
      const renamed = renameType(record);
      return omitNull ? Rec.filter(renamed, (value) => value !== null) : renamed;
    });

/**
 * Encode a base event, renaming `eventType` to `type`.
 *
 * **Example** (Rename the key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { MessageEvent, messageEventToJson } from "./MessageEvent.ts"
 *
 * const json = Effect.runSync(messageEventToJson(MessageEvent.make({ eventType: "custom" })))
 * console.log(json.type) // "custom"
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const messageEventToJson = jsonFrom<MessageEvent>("MessageEvent.toJson", false)((event) =>
  encodeMessageEvent(event),
);

/** @category serialization @since 0.0.0 */
export const conversationEventToJson = jsonFrom<ConversationEvent>("ConversationEvent.toJson", false)((event) =>
  encodeConversationEvent(event),
);

/** @category serialization @since 0.0.0 */
export const newConversationCreatedToJson = jsonFrom<NewConversationCreated>("NewConversationCreated.toJson", false)(
  (event) => encodeNewConversationCreated(event),
);

/** @category serialization @since 0.0.0 */
export const newProcessingConversationCreatedToJson = jsonFrom<NewProcessingConversationCreated>(
  "NewProcessingConversationCreated.toJson",
  false,
)((event) => encodeNewProcessingConversationCreated(event));

/** @category serialization @since 0.0.0 */
export const processingConversationStatusChangedToJson = jsonFrom<ProcessingConversationStatusChanged>(
  "ProcessingConversationStatusChanged.toJson",
  false,
)((event) => encodeProcessingConversationStatusChanged(event));

/** @category serialization @since 0.0.0 */
export const memoryBackwardSycnedEventToJson = jsonFrom<MemoryBackwardSycnedEvent>(
  "MemoryBackwardSycnedEvent.toJson",
  false,
)((event) => encodeMemoryBackwardSycnedEvent(event));

/** @category serialization @since 0.0.0 */
export const messageServiceStatusEventToJson = jsonFrom<MessageServiceStatusEvent>(
  "MessageServiceStatusEvent.toJson",
  true,
)((event) => encodeMessageServiceStatusEvent(event));

/** @category serialization @since 0.0.0 */
export const conversationSessionEventToJson = jsonFrom<ConversationSessionEvent>("ConversationSessionEvent.toJson", false)(
  (event) => encodeConversationSessionEvent(event),
);

/** @category serialization @since 0.0.0 */
export const pingEventToJson = jsonFrom<PingEvent>("PingEvent.toJson", false)((event) => encodePingEvent(event));

/** @category serialization @since 0.0.0 */
export const lastConversationEventToJson = jsonFrom<LastConversationEvent>("LastConversationEvent.toJson", false)(
  (event) => encodeLastConversationEvent(event),
);

/** @category serialization @since 0.0.0 */
export const translationEventToJson = jsonFrom<TranslationEvent>("TranslationEvent.toJson", false)((event) =>
  encodeTranslationEvent(event),
);

/** @category serialization @since 0.0.0 */
export const photoProcessingEventToJson = jsonFrom<PhotoProcessingEvent>("PhotoProcessingEvent.toJson", false)(
  (event) => encodePhotoProcessingEvent(event),
);

/** @category serialization @since 0.0.0 */
export const photoDescribedEventToJson = jsonFrom<PhotoDescribedEvent>("PhotoDescribedEvent.toJson", false)((event) =>
  encodePhotoDescribedEvent(event),
);

/** @category serialization @since 0.0.0 */
export const speakerLabelSuggestionEventToJson = jsonFrom<SpeakerLabelSuggestionEvent>(
  "SpeakerLabelSuggestionEvent.toJson",
  false,
)((event) => encodeSpeakerLabelSuggestionEvent(event));

/** @category serialization @since 0.0.0 */
export const freemiumThresholdReachedEventToJson = jsonFrom<FreemiumThresholdReachedEvent>(
  "FreemiumThresholdReachedEvent.toJson",
  false,
)((event) => encodeFreemiumThresholdReachedEvent(event));

/** @category serialization @since 0.0.0 */
export const segmentsDeletedEventToJson = jsonFrom<SegmentsDeletedEvent>("SegmentsDeletedEvent.toJson", false)(
  (event) => encodeSegmentsDeletedEvent(event),
);

/** @category serialization @since 0.0.0 */
export const proactiveMessageEventToJson = jsonFrom<ProactiveMessageEvent>("ProactiveMessageEvent.toJson", true)(
  (event) => encodeProactiveMessageEvent(event),
);

/**
 * Encode a fixed-type event, dropping nulls only for service status and proactive messages.
 *
 * **Example** (Encode a ping)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { PingEvent, fixedMessageEventToJson } from "./MessageEvent.ts"
 *
 * const json = Effect.runSync(fixedMessageEventToJson(PingEvent.make({})))
 * console.log(json.type) // "ping"
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const fixedMessageEventToJson = Effect.fn("FixedMessageEvent.toJson")(function* (event: FixedMessageEvent) {
  if (isMessageServiceStatusEvent(event)) return yield* messageServiceStatusEventToJson(event);
  if (isConversationSessionEvent(event)) return yield* conversationSessionEventToJson(event);
  if (isPingEvent(event)) return yield* pingEventToJson(event);
  if (isLastConversationEvent(event)) return yield* lastConversationEventToJson(event);
  if (isTranslationEvent(event)) return yield* translationEventToJson(event);
  if (isPhotoProcessingEvent(event)) return yield* photoProcessingEventToJson(event);
  if (isPhotoDescribedEvent(event)) return yield* photoDescribedEventToJson(event);
  if (isSpeakerLabelSuggestionEvent(event)) return yield* speakerLabelSuggestionEventToJson(event);
  if (isFreemiumThresholdReachedEvent(event)) return yield* freemiumThresholdReachedEventToJson(event);
  if (isSegmentsDeletedEvent(event)) return yield* segmentsDeletedEventToJson(event);
  return yield* proactiveMessageEventToJson(event);
});
