/**
 * Conversation session records and the requests that mutate them.
 *
 * **Details**
 *
 * A Conversation is the persisted session record at `users/{uid}/conversations`.
 * It is upstream of memory. It is not a Memory, a ChatSession, a focus session,
 * or an auth session. Capture sessions are the ephemeral listen window; this
 * model is the persisted record.
 *
 * **Gotchas**
 *
 * {@link initializeConversation} rewrites `pluginsResults` from `appsResults`
 * and `processingMemoryId` from `processingConversationId`. Unknown source
 * strings decode as `unknown`.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as P from "effect/Predicate";
import { AudioFile } from "./AudioFile.ts";
import { CalendarMeetingContext } from "./CalendarContext.ts";
import { Message } from "./Chat.ts";
import { ClientProcessing } from "./ClientProcessing.ts";
import {
  ConversationProcessingState,
  ConversationSource,
  ConversationStatus,
  ConversationVisibility,
  ExternalIntegrationConversationSource,
  PostProcessingModel,
  PostProcessingStatus,
} from "./ConversationEnums.ts";
import { ConversationPhoto, photosAsString } from "./ConversationPhoto.ts";
import { Geolocation } from "./Geolocation.ts";
import { bool, optionalText, optionalTimestamp, text, textBoundsCheck, timestamp } from "./Kit.ts";
import { Person } from "./Other.ts";
import {
  boolDefault,
  finiteDefault,
  intDefault,
  isRecord,
  jsonList,
  Model,
  optionDefault,
  optionalNull,
  pg,
  textDefault,
} from "./Port.ts";
import { ActionItem, Event, Structured } from "./Structured.ts";
import { legacyConversationSegmentId, segmentsAsString, TranscriptSegment } from "./TranscriptSegment.ts";

const $I = $ScratchpadId.create("beep/Conversation");

const sourceDefault = (fallback: ConversationSource) =>
  ConversationSource.pipe(S.withConstructorDefault(Effect.succeed(fallback)), pg.text(), pg.columnName("source"));

/**
 * Title and overview patch.
 *
 * **Example** (Omit both fields)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { UpdateConversation } from "./Conversation.ts"
 *
 * console.log(O.isNone(UpdateConversation.make({}).title)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UpdateConversation extends Model<UpdateConversation>("UpdateConversation")(
  { title: optionalText("title"), overview: optionalText("overview") },
  $I.annote("UpdateConversation", { description: "Patch a conversation title or overview." }),
) {}

/**
 * Encoded shape of {@link UpdateConversation}.
 *
 * @see {@link UpdateConversation} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UpdateConversation {
  export type Encoded = S.Codec.Encoded<typeof UpdateConversation>;
}

/**
 * One earlier chat turn replayed as context when someone asks about a shared conversation.
 *
 * **Details**
 *
 * The 1 to 2000 character bound on `content` is a SQL table check.
 * Decoding and `make` do not enforce it.
 *
 * **Example** (Record an assistant turn)
 *
 * ```ts
 * import { SharedConversationChatHistoryMessage } from "./Conversation.ts"
 *
 * const turn = SharedConversationChatHistoryMessage.make({
 *   role: "assistant",
 *   content: "The team agreed to ship on Friday.",
 * })
 * console.log(turn.role) // "assistant"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SharedConversationChatHistoryMessage extends Model<SharedConversationChatHistoryMessage>(
  "SharedConversationChatHistoryMessage",
)(
  {
    role: LiteralKit(["user", "assistant"]).pipe(pg.text(), pg.columnName("role")),
    content: text("content"),
  },
  $I.annote("SharedConversationChatHistoryMessage", { description: "One turn of shared-conversation chat history." }),
  (columns) => [textBoundsCheck("content", { minLength: 1, maxLength: 2000 })(columns.content)],
) {}

/**
 * Encoded shape of {@link SharedConversationChatHistoryMessage}.
 *
 * @see {@link SharedConversationChatHistoryMessage} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedConversationChatHistoryMessage {
  export type Encoded = S.Codec.Encoded<typeof SharedConversationChatHistoryMessage>;
}

/**
 * Question a viewer asks about a shared conversation, with optional prior turns.
 *
 * **Details**
 *
 * `history` holds at most 12 turns, and decoding rejects a longer list.
 * `make` fills a missing `history` with an empty list.
 *
 * **Example** (Decode a first question)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SharedConversationChatRequest } from "./Conversation.ts"
 *
 * const request = Effect.runSync(
 *   S.decodeEffect(SharedConversationChatRequest)({
 *     conversationId: "conv-123",
 *     question: "What did we decide about the launch?",
 *     history: [],
 *   }),
 * )
 * console.log(request.history.length) // 0
 * ```
 *
 * @see {@link SharedConversationChatHistoryMessage} for one history turn.
 * @category models
 * @since 0.0.0
 */
export class SharedConversationChatRequest extends Model<SharedConversationChatRequest>("SharedConversationChatRequest")(
  {
    conversationId: text("conversation_id"),
    question: text("question"),
    history: S.Array(SharedConversationChatHistoryMessage)
      .check(S.isMaxLength(12))
      .pipe(S.withConstructorDefault(Effect.sync(() => [])), pg.jsonb(), pg.columnName("history")),
  },
  $I.annote("SharedConversationChatRequest", { description: "Question asked about a shared conversation." }),
  (columns) => [
    textBoundsCheck("question", { minLength: 1, maxLength: 2000 })(columns.question),
    textBoundsCheck("conversation_id", { minLength: 1, maxLength: 128 })(columns.conversationId),
  ],
) {}

/**
 * Encoded shape of {@link SharedConversationChatRequest}.
 *
 * @see {@link SharedConversationChatRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedConversationChatRequest {
  export type Encoded = S.Codec.Encoded<typeof SharedConversationChatRequest>;
}

/**
 * Assistant answer returned for a question about a shared conversation.
 *
 * **Example** (Wrap an answer)
 *
 * ```ts
 * import { SharedConversationChatResponse } from "./Conversation.ts"
 *
 * const response = SharedConversationChatResponse.make({ message: "Launch moved to Friday." })
 * console.log(response.message) // "Launch moved to Friday."
 * ```
 *
 * @see {@link SharedConversationChatRequest} for the question it answers.
 * @category models
 * @since 0.0.0
 */
export class SharedConversationChatResponse extends Model<SharedConversationChatResponse>(
  "SharedConversationChatResponse",
)(
  { message: text("message") },
  $I.annote("SharedConversationChatResponse", { description: "Answer about a shared conversation." }),
) {}

/**
 * Encoded shape of {@link SharedConversationChatResponse}.
 *
 * @see {@link SharedConversationChatResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedConversationChatResponse {
  export type Encoded = S.Codec.Encoded<typeof SharedConversationChatResponse>;
}

/**
 * Action item as shown on the public view of a shared conversation.
 *
 * **Example** (Default to not completed)
 *
 * ```ts
 * import { SharedActionItem } from "./Conversation.ts"
 *
 * const item = SharedActionItem.make({ description: "Send the launch checklist" })
 * console.log(item.completed) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SharedActionItem extends Model<SharedActionItem>("SharedActionItem")(
  { description: text("description"), completed: boolDefault("completed", false) },
  $I.annote("SharedActionItem", { description: "Action item shown on a shared conversation." }),
) {}

/**
 * Encoded shape of {@link SharedActionItem}.
 *
 * @see {@link SharedActionItem} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedActionItem {
  export type Encoded = S.Codec.Encoded<typeof SharedActionItem>;
}

/**
 * Calendar event as shown on the public view of a shared conversation.
 *
 * **Details**
 *
 * `make` fills `description` with the empty string, `duration` with 30 and
 * `created` with `false`. Decoding requires every key.
 *
 * **Example** (Fill the defaults)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { SharedEvent } from "./Conversation.ts"
 *
 * const event = SharedEvent.make({ title: "Launch review", start: DateTime.makeUnsafe("2024-05-01T09:00:00.000Z") })
 * console.log(event.duration) // 30
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SharedEvent extends Model<SharedEvent>("SharedEvent")(
  {
    title: text("title"),
    description: textDefault("description", ""),
    start: timestamp("start"),
    duration: intDefault("duration", 30),
    created: boolDefault("created", false),
  },
  $I.annote("SharedEvent", { description: "Event shown on a shared conversation." }),
) {}

/**
 * Encoded shape of {@link SharedEvent}.
 *
 * @see {@link SharedEvent} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedEvent {
  export type Encoded = S.Codec.Encoded<typeof SharedEvent>;
}

/**
 * Summary block of a shared conversation: title, overview, emoji, category, action items and events.
 *
 * **Details**
 *
 * Every field has a default. `category` is free text here, not the
 * conversation category literal.
 *
 * **Example** (Fill the default emoji)
 *
 * ```ts
 * import { SharedStructured } from "./Conversation.ts"
 *
 * const structured = SharedStructured.make({ title: "Launch sync" })
 * console.log(structured.emoji) // "🧠"
 * ```
 *
 * @see {@link projectSharedConversation} for the projection that builds it.
 * @category models
 * @since 0.0.0
 */
export class SharedStructured extends Model<SharedStructured>("SharedStructured")(
  {
    title: textDefault("title", ""),
    overview: textDefault("overview", ""),
    emoji: textDefault("emoji", "🧠"),
    category: textDefault("category", "other"),
    actionItems: jsonList(SharedActionItem, "action_items"),
    events: jsonList(SharedEvent, "events"),
  },
  $I.annote("SharedStructured", { description: "Shared projection of a conversation summary." }),
) {}

/**
 * Encoded shape of {@link SharedStructured}.
 *
 * @see {@link SharedStructured} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedStructured {
  export type Encoded = S.Codec.Encoded<typeof SharedStructured>;
}

/**
 * Transcript segment as shown on the public view of a shared conversation.
 *
 * **Details**
 *
 * A missing `speaker` decodes as `SPEAKER_00`, while an explicit null decodes
 * as `None`.
 *
 * **Example** (Fill the default speaker label)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SharedTranscriptSegment } from "./Conversation.ts"
 *
 * const segment = Effect.runSync(
 *   S.decodeEffect(SharedTranscriptSegment)({
 *     id: "seg-1",
 *     text: "Let's ship it.",
 *     speakerId: 0,
 *     isUser: true,
 *     start: 0,
 *     end: 1.5,
 *   }),
 * )
 * console.log(O.getOrElse(segment.speaker, () => "")) // "SPEAKER_00"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SharedTranscriptSegment extends Model<SharedTranscriptSegment>("SharedTranscriptSegment")(
  {
    text: text("text"),
    speaker: optionDefault(S.String, () => "SPEAKER_00").pipe(pg.text(), pg.columnName("speaker")),
    speakerId: S.Int.pipe(pg.integer(), pg.columnName("speaker_id")),
    isUser: bool("is_user"),
    personId: optionalText("person_id"),
    start: finiteDefault("start", 0),
    end: finiteDefault("end", 0),
    id: textDefault("id", ""),
  },
  $I.annote("SharedTranscriptSegment", { description: "Transcript segment on a shared conversation." }),
) {}

/**
 * Encoded shape of {@link SharedTranscriptSegment}.
 *
 * @see {@link SharedTranscriptSegment} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedTranscriptSegment {
  export type Encoded = S.Codec.Encoded<typeof SharedTranscriptSegment>;
}

/**
 * Output of an app on the public view of a shared conversation.
 *
 * **Example** (Attach app output)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { SharedAppResult } from "./Conversation.ts"
 *
 * const result = SharedAppResult.make({ appId: O.some("meeting-notes"), content: "Three decisions recorded." })
 * console.log(result.content) // "Three decisions recorded."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SharedAppResult extends Model<SharedAppResult>("SharedAppResult")(
  { appId: optionalText("app_id"), content: text("content") },
  $I.annote("SharedAppResult", { description: "App result on a shared conversation." }),
) {}

/**
 * Encoded shape of {@link SharedAppResult}.
 *
 * @see {@link SharedAppResult} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedAppResult {
  export type Encoded = S.Codec.Encoded<typeof SharedAppResult>;
}

/**
 * Output of a plugin on the public view of a shared conversation.
 *
 * **Details**
 *
 * This is the legacy plugin mirror of {@link SharedAppResult}.
 *
 * **Example** (Attach plugin output without an id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { SharedPluginResult } from "./Conversation.ts"
 *
 * const result = SharedPluginResult.make({ content: "Follow-up email drafted." })
 * console.log(O.isNone(result.pluginId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SharedPluginResult extends Model<SharedPluginResult>("SharedPluginResult")(
  { pluginId: optionalText("plugin_id"), content: text("content") },
  $I.annote("SharedPluginResult", { description: "Plugin result on a shared conversation." }),
) {}

/**
 * Encoded shape of {@link SharedPluginResult}.
 *
 * @see {@link SharedPluginResult} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedPluginResult {
  export type Encoded = S.Codec.Encoded<typeof SharedPluginResult>;
}

/**
 * Person named on a shared conversation, reduced to id and display name.
 *
 * **Example** (Name a speaker)
 *
 * ```ts
 * import { SharedPerson } from "./Conversation.ts"
 *
 * const person = SharedPerson.make({ id: "person-7", name: "Ada" })
 * console.log(person.name) // "Ada"
 * ```
 *
 * @see {@link projectSharedConversation} for how full people are reduced to this shape.
 * @category models
 * @since 0.0.0
 */
export class SharedPerson extends Model<SharedPerson>("SharedPerson")(
  { id: text("id"), name: text("name") },
  $I.annote("SharedPerson", { description: "Person shown on a shared conversation." }),
) {}

/**
 * Encoded shape of {@link SharedPerson}.
 *
 * @see {@link SharedPerson} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedPerson {
  export type Encoded = S.Codec.Encoded<typeof SharedPerson>;
}

/**
 * Legacy plugin output stored on a conversation, mirrored from its app results.
 *
 * **Details**
 *
 * {@link initializeConversation} discards stored plugin results and rebuilds
 * them from `appsResults`, so do not write this list directly.
 *
 * **Example** (Mirror an app result)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AppResult, PluginResult } from "./Conversation.ts"
 *
 * const app = AppResult.make({ appId: O.some("meeting-notes"), content: "Three decisions recorded." })
 * const plugin = PluginResult.make({ pluginId: app.appId, content: app.content })
 * console.log(O.getOrElse(plugin.pluginId, () => "")) // "meeting-notes"
 * ```
 *
 * @see {@link AppResult} for the source record.
 * @category models
 * @since 0.0.0
 */
export class PluginResult extends Model<PluginResult>("PluginResult")(
  { pluginId: optionalText("plugin_id"), content: text("content") },
  $I.annote("PluginResult", { description: "Plugin result stored on a conversation. Rewritten from apps_results." }),
) {}

/**
 * Encoded shape of {@link PluginResult}.
 *
 * @see {@link PluginResult} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginResult {
  export type Encoded = S.Codec.Encoded<typeof PluginResult>;
}

/**
 * Output an app produced for a conversation.
 *
 * **Example** (Record app output)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AppResult } from "./Conversation.ts"
 *
 * const result = AppResult.make({ appId: O.some("meeting-notes"), content: "Three decisions recorded." })
 * console.log(result.content) // "Three decisions recorded."
 * ```
 *
 * @see {@link PluginResult} for the legacy mirror built from it.
 * @category models
 * @since 0.0.0
 */
export class AppResult extends Model<AppResult>("AppResult")(
  { appId: optionalText("app_id"), content: text("content") },
  $I.annote("AppResult", { description: "App result stored on a conversation." }),
) {}

/**
 * Encoded shape of {@link AppResult}.
 *
 * @see {@link AppResult} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AppResult {
  export type Encoded = S.Codec.Encoded<typeof AppResult>;
}

/**
 * Calendar event linked to a conversation when it is created.
 *
 * **Details**
 *
 * Only `id` is required. Missing times, calendar id and link decode as `None`.
 *
 * **Example** (Decode a linked event)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CalendarEventLink } from "./Conversation.ts"
 *
 * const link = Effect.runSync(
 *   S.decodeEffect(CalendarEventLink)({
 *     id: "evt-42",
 *     title: "Launch review",
 *     start: "2024-05-01T09:00:00.000Z",
 *     attendees: ["ada@example.com", "grace@example.com"],
 *   }),
 * )
 * console.log(link.attendees.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CalendarEventLink extends Model<CalendarEventLink>("CalendarEventLink")(
  {
    id: text("id"),
    title: textDefault("title", ""),
    start: optionalTimestamp("start"),
    end: optionalTimestamp("end"),
    calendarId: optionalText("calendar_id"),
    htmlLink: optionalText("html_link"),
    attendees: jsonList(S.String, "attendees"),
  },
  $I.annote("CalendarEventLink", { description: "Calendar event linked from a conversation." }),
) {}

/**
 * Encoded shape of {@link CalendarEventLink}.
 *
 * @see {@link CalendarEventLink} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CalendarEventLink {
  export type Encoded = S.Codec.Encoded<typeof CalendarEventLink>;
}

/**
 * Status and model of the post-processing job run on a conversation's audio.
 *
 * **Example** (Track a running job)
 *
 * ```ts
 * import { ConversationPostProcessing } from "./Conversation.ts"
 *
 * const job = ConversationPostProcessing.make({ status: "in_progress", model: "fal_whisperx" })
 * console.log(job.status) // "in_progress"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationPostProcessing extends Model<ConversationPostProcessing>("ConversationPostProcessing")(
  {
    status: PostProcessingStatus.pipe(pg.text(), pg.columnName("status")),
    model: PostProcessingModel.pipe(pg.text(), pg.columnName("model")),
  },
  $I.annote("ConversationPostProcessing", { description: "Post-processing job on a conversation." }),
) {}

/**
 * Encoded shape of {@link ConversationPostProcessing}.
 *
 * @see {@link ConversationPostProcessing} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationPostProcessing {
  export type Encoded = S.Codec.Encoded<typeof ConversationPostProcessing>;
}

/**
 * One timed, speaker-attributed span of a conversation's audio.
 *
 * **Example** (Measure a span)
 *
 * ```ts
 * import { ConversationAudioSpan } from "./Conversation.ts"
 *
 * const span = ConversationAudioSpan.make({ start: 1.5, end: 4, speaker: "SPEAKER_01", text: "Ship it." })
 * console.log(span.end - span.start) // 2.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationAudioSpan extends Model<ConversationAudioSpan>("ConversationAudioSpan")(
  {
    start: finiteDefault("start", 0),
    end: finiteDefault("end", 0),
    speaker: textDefault("speaker", ""),
    text: textDefault("text", ""),
  },
  $I.annote("ConversationAudioSpan", { description: "One timed span of conversation audio." }),
) {}

/**
 * Encoded shape of {@link ConversationAudioSpan}.
 *
 * @see {@link ConversationAudioSpan} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationAudioSpan {
  export type Encoded = S.Codec.Encoded<typeof ConversationAudioSpan>;
}

/**
 * Audio summary of a conversation: total duration and its timed spans.
 *
 * **Example** (Summarize one span)
 *
 * ```ts
 * import { ConversationAudio, ConversationAudioSpan } from "./Conversation.ts"
 *
 * const audio = ConversationAudio.make({
 *   duration: 4,
 *   spans: [ConversationAudioSpan.make({ start: 0, end: 4, speaker: "SPEAKER_00", text: "Ship it." })],
 * })
 * console.log(audio.spans.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationAudio extends Model<ConversationAudio>("ConversationAudio")(
  {
    duration: finiteDefault("duration", 0),
    spans: jsonList(ConversationAudioSpan, "spans"),
  },
  $I.annote("ConversationAudio", { description: "Audio summary attached to a conversation." }),
) {}

/**
 * Encoded shape of {@link ConversationAudio}.
 *
 * @see {@link ConversationAudio} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationAudio {
  export type Encoded = S.Codec.Encoded<typeof ConversationAudio>;
}

/**
 * Transcript excerpt that matched a conversation search, with its start offset.
 *
 * **Example** (Record a match)
 *
 * ```ts
 * import { TranscriptMatchSnippet } from "./Conversation.ts"
 *
 * const snippet = TranscriptMatchSnippet.make({ text: "launch checklist", start: 12.5 })
 * console.log(snippet.start) // 12.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptMatchSnippet extends Model<TranscriptMatchSnippet>("TranscriptMatchSnippet")(
  { text: text("text"), start: finiteDefault("start", 0) },
  $I.annote("TranscriptMatchSnippet", { description: "Transcript snippet that matched a search." }),
) {}

/**
 * Encoded shape of {@link TranscriptMatchSnippet}.
 *
 * @see {@link TranscriptMatchSnippet} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TranscriptMatchSnippet {
  export type Encoded = S.Codec.Encoded<typeof TranscriptMatchSnippet>;
}

const SyncRelevance = LiteralKit(["keep", "review"]).pipe(
  $I.annoteSchema("SyncRelevance", { description: "Whether a synced conversation should be kept or reviewed." }),
);

/**
 * Persisted conversation session.
 *
 * **Details**
 *
 * Decode a stored row with {@link initializeConversation} so plugin results and
 * the processing memory id match the Python constructor.
 *
 * **Example** (Read the id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Conversation } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 *
 * const conversation = Conversation.make({
 *   id: "c1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   structured: Structured.make({ title: "Standup" }),
 * })
 * console.log(conversation.id) // "c1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Conversation extends Model<Conversation>("Conversation")(
  {
    id: text("id"),
    createdAt: timestamp("created_at"),
    startedAt: optionalTimestamp("started_at"),
    finishedAt: optionalTimestamp("finished_at"),
    source: sourceDefault("omi"),
    language: optionalText("language"),
    structured: Structured.pipe(pg.jsonb(), pg.columnName("structured")),
    transcriptSegments: jsonList(TranscriptSegment, "transcript_segments"),
    transcriptSegmentsCompressed: optionDefault(S.Boolean, () => false).pipe(
      pg.boolean(),
      pg.columnName("transcript_segments_compressed"),
    ),
    geolocation: optionalNull(Geolocation).pipe(pg.jsonb(), pg.columnName("geolocation")),
    photos: jsonList(ConversationPhoto, "photos"),
    audioFiles: jsonList(AudioFile, "audio_files"),
    privateCloudSyncEnabled: boolDefault("private_cloud_sync_enabled", false),
    audioFilesDuration: finiteDefault("audio_files_duration", 0),
    calendarEvents: jsonList(CalendarMeetingContext, "calendar_events"),
    processingMemoryId: optionalText("processing_memory_id"),
    processingConversationId: optionalText("processing_conversation_id"),
    processingState: optionalNull(ConversationProcessingState).pipe(pg.text(), pg.columnName("processing_state")),
    status: optionDefault(ConversationStatus, (): ConversationStatus => "completed").pipe(
      pg.text(),
      pg.columnName("status"),
    ),
    discarded: boolDefault("discarded", false),
    visibility: ConversationVisibility.pipe(
      S.withConstructorDefault(Effect.succeed<ConversationVisibility>("private")),
      pg.text(),
      pg.columnName("visibility"),
    ),
    starred: boolDefault("starred", false),
    folderId: optionalText("folder_id"),
    lastMutationAt: optionalTimestamp("last_mutation_at"),
    dataProtectionLevel: optionalText("data_protection_level"),
    isLocked: boolDefault("is_locked", false),
    appResults: jsonList(AppResult, "app_results"),
    pluginsResults: jsonList(PluginResult, "plugins_results"),
    externalData: optionalNull(S.JsonObject).pipe(pg.jsonb(), pg.columnName("external_data")),
    appsResults: jsonList(AppResult, "apps_results"),
    suggestedSummarizationApps: jsonList(S.String, "suggested_summarization_apps"),
    postprocessing: optionalNull(ConversationPostProcessing).pipe(pg.jsonb(), pg.columnName("postprocessing")),
    audio: optionalNull(ConversationAudio).pipe(pg.jsonb(), pg.columnName("audio")),
    transcriptMatch: optionalNull(TranscriptMatchSnippet).pipe(pg.jsonb(), pg.columnName("transcript_match")),
    syncRelevance: optionalNull(SyncRelevance).pipe(pg.text(), pg.columnName("sync_relevance")),
    clientProcessing: optionalNull(ClientProcessing).pipe(pg.jsonb(), pg.columnName("client_processing")),
  },
  $I.annote("Conversation", {
    description: "Persisted conversation session. Not a memory and not a chat session.",
  }),
) {}

/**
 * Encoded shape of {@link Conversation}.
 *
 * @see {@link Conversation} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Conversation {
  export type Encoded = S.Codec.Encoded<typeof Conversation>;
}

const decodeUnknownEffectConversation = S.decodeUnknownEffect(Conversation);

const decodeConversation = S.decodeUnknownEffect(Conversation);

const backfillSegmentIds = (conversationId: string, segments: ReadonlyArray<unknown>): ReadonlyArray<unknown> =>
  segments.map((segment, index) => {
    if (!isRecord(segment)) return segment;
    const id = segment.id;
    if (P.isString(id) && id.length > 0) return segment;
    return { ...segment, id: legacyConversationSegmentId(conversationId, index) };
  });

/**
 * Fills missing transcript ids and rewrites the plugin and memory mirrors.
 *
 * **Details**
 *
 * Incoming `pluginsResults` are discarded. Each app result becomes a plugin
 * result. `processingMemoryId` becomes `processingConversationId`.
 *
 * **Example** (Copy the processing id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Conversation, initializeConversation } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 *
 * const stored = S.encodeSync(Conversation)(
 *   Conversation.make({
 *     id: "c1",
 *     createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *     structured: Structured.make({ title: "Standup" }),
 *     processingConversationId: O.some("mem-1"),
 *   }),
 * )
 * const conversation = Effect.runSync(initializeConversation(stored))
 * console.log(O.getOrElse(conversation.processingMemoryId, () => "")) // "mem-1"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const initializeConversation = (input: unknown) => {
  if (!isRecord(input)) return decodeConversation(input);
  const prepared: { [key: string]: unknown } = { ...input };
  if (P.isString(prepared.id) && Arr.isArray(prepared.transcriptSegments)) {
    prepared.transcriptSegments = backfillSegmentIds(prepared.id, prepared.transcriptSegments);
  }
  return decodeUnknownEffectConversation(prepared).pipe(
    Effect.map((decoded) =>
      Conversation.make({
        ...decoded,
        pluginsResults: decoded.appsResults.map((app) =>
          PluginResult.make({ pluginId: app.appId, content: app.content }),
        ),
        processingMemoryId: decoded.processingConversationId,
      }),
    ),
  );
};

/**
 * Renders the transcript. Person order is not part of the result.
 *
 * **Example** (Render one user segment)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Conversation, getTranscript } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 * import { TranscriptSegment } from "./TranscriptSegment.ts"
 *
 * const conversation = Conversation.make({
 *   id: "c1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   structured: Structured.make({}),
 *   transcriptSegments: [TranscriptSegment.make({ id: "s", text: " Hello ", isUser: true, speakerId: 0, start: 0, end: 1 })],
 * })
 * console.log(getTranscript(conversation, false)) // "User: Hello"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Conversation and formatting flags are co-primary inputs, and neither is a pipeable value.
export const getTranscript = (
  conversation: Conversation,
  includeTimestamps = false,
  people?: ReadonlyArray<Person>,
  userName?: string,
): string =>
  segmentsAsString(
    conversation.transcriptSegments,
    includeTimestamps,
    userName,
    people?.map((person) => ({ id: person.id, name: person.name })),
  );

/**
 * Photo descriptions, or `None`.
 *
 * **Example** (No photos)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Conversation, getPhotosDescription } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 *
 * const conversation = Conversation.make({
 *   id: "c1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   structured: Structured.make({}),
 * })
 * console.log(getPhotosDescription(conversation, false)) // "None"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Conversation and the timestamp flag are co-primary inputs, and neither is a pipeable value.
export const getPhotosDescription = (conversation: Conversation, includeTimestamps = false): string =>
  photosAsString(conversation.photos, includeTimestamps);

/**
 * Distinct non-blank person ids. Order is not stable.
 *
 * **Example** (One person)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as DateTime from "effect/DateTime"
 * import { Conversation, getPersonIds } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 * import { TranscriptSegment } from "./TranscriptSegment.ts"
 *
 * const conversation = Conversation.make({
 *   id: "c1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   structured: Structured.make({}),
 *   transcriptSegments: [
 *     TranscriptSegment.make({ id: "s", text: "Hi", isUser: false, speakerId: 1, personId: O.some("p1"), start: 0, end: 1 }),
 *   ],
 * })
 * console.log(getPersonIds(conversation).includes("p1")) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getPersonIds = (conversation: Conversation): ReadonlyArray<string> => {
  const ids = HashSet.fromIterable(
    conversation.transcriptSegments.flatMap((segment) =>
      O.isSome(segment.personId) && segment.personId.value.length > 0 ? [segment.personId.value] : [],
    ),
  );
  return Arr.fromIterable(ids);
};

/**
 * Public projection of a conversation served to people it was shared with.
 *
 * **Details**
 *
 * Decoding ignores fields that are not part of the projection, so a full
 * conversation row decodes without leaking private fields.
 *
 * **Example** (Build a minimal shared view)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { SharedConversationResponse, SharedStructured } from "./Conversation.ts"
 *
 * const shared = SharedConversationResponse.make({
 *   id: "conv-123",
 *   createdAt: DateTime.makeUnsafe("2024-05-01T09:00:00.000Z"),
 *   structured: SharedStructured.make({ title: "Launch sync" }),
 * })
 * console.log(shared.people.length) // 0
 * ```
 *
 * @see {@link projectSharedConversation} for the projection from {@link Conversation}.
 * @category models
 * @since 0.0.0
 */
export class SharedConversationResponse extends Model<SharedConversationResponse>("SharedConversationResponse")(
  {
    id: text("id"),
    createdAt: timestamp("created_at"),
    startedAt: optionalTimestamp("started_at"),
    finishedAt: optionalTimestamp("finished_at"),
    structured: SharedStructured.pipe(pg.jsonb(), pg.columnName("structured")),
    transcriptSegments: jsonList(SharedTranscriptSegment, "transcript_segments"),
    geolocation: optionalNull(Geolocation).pipe(pg.jsonb(), pg.columnName("geolocation")),
    photos: jsonList(ConversationPhoto, "photos"),
    audioFiles: jsonList(AudioFile, "audio_files"),
    appResults: jsonList(SharedAppResult, "app_results"),
    pluginsResults: jsonList(SharedPluginResult, "plugins_results"),
    calendarEvents: jsonList(CalendarMeetingContext, "calendar_events"),
    people: jsonList(SharedPerson, "people"),
  },
  $I.annote("SharedConversationResponse", { description: "Public projection of a conversation. Unknown fields are ignored." }),
) {}

/**
 * Encoded shape of {@link SharedConversationResponse}.
 *
 * @see {@link SharedConversationResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SharedConversationResponse {
  export type Encoded = S.Codec.Encoded<typeof SharedConversationResponse>;
}

/**
 * Projects a conversation to the shared response, keeping only id and name for people.
 *
 * **Example** (Keep the title)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Conversation, projectSharedConversation } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 *
 * const shared = projectSharedConversation(
 *   Conversation.make({ id: "c1", createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"), structured: Structured.make({ title: "Standup" }) }),
 *   [],
 * )
 * console.log(shared.structured.title) // "Standup"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Conversation and people are co-primary inputs, and neither is a pipeable value.
export const projectSharedConversation = (
  conversation: Conversation,
  people: ReadonlyArray<Person>,
): SharedConversationResponse =>
  SharedConversationResponse.make({
    id: conversation.id,
    createdAt: conversation.createdAt,
    startedAt: conversation.startedAt,
    finishedAt: conversation.finishedAt,
    structured: SharedStructured.make({
      title: conversation.structured.title,
      overview: conversation.structured.overview,
      emoji: conversation.structured.emoji,
      category: conversation.structured.category,
      actionItems: conversation.structured.actionItems.map((item) =>
        SharedActionItem.make({ description: item.description, completed: item.completed }),
      ),
      events: conversation.structured.events.map((event) =>
        SharedEvent.make({
          title: event.title,
          description: event.description,
          start: event.start,
          duration: event.duration,
          created: event.created,
        }),
      ),
    }),
    geolocation: conversation.geolocation,
    photos: conversation.photos,
    audioFiles: conversation.audioFiles,
    appResults: conversation.appsResults.map((app) => SharedAppResult.make({ appId: app.appId, content: app.content })),
    pluginsResults: conversation.pluginsResults.map((plugin) =>
      SharedPluginResult.make({ pluginId: plugin.pluginId, content: plugin.content }),
    ),
    calendarEvents: conversation.calendarEvents,
    people: people.map((person) => SharedPerson.make({ id: person.id, name: person.name })),
  });

/**
 * Encoded conversation with datetimes already ISO strings.
 *
 * **Example** (Read the id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Conversation, asDictCleanedDates } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 *
 * const encoded = asDictCleanedDates(
 *   Conversation.make({ id: "c1", createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"), structured: Structured.make({}) }),
 * )
 * console.log(encoded.id) // "c1"
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const asDictCleanedDates = (conversation: Conversation) => ({
  id: conversation.id,
  createdAt: DateTime.formatIso(conversation.createdAt),
  startedAt: O.map(conversation.startedAt, DateTime.formatIso),
  finishedAt: O.map(conversation.finishedAt, DateTime.formatIso),
  title: conversation.structured.title,
});

/**
 * Conversation as it stands after a mutation, returned to the caller.
 *
 * **Example** (Return the updated conversation)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Conversation, ConversationMutationResponse } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 *
 * const response = ConversationMutationResponse.make({
 *   conversation: Conversation.make({
 *     id: "conv-123",
 *     createdAt: DateTime.makeUnsafe("2024-05-01T09:00:00.000Z"),
 *     structured: Structured.make({ title: "Launch sync" }),
 *   }),
 * })
 * console.log(response.conversation.structured.title) // "Launch sync"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationMutationResponse extends Model<ConversationMutationResponse>("ConversationMutationResponse")(
  { conversation: Conversation.pipe(pg.jsonb(), pg.columnName("conversation")) },
  $I.annote("ConversationMutationResponse", { description: "Conversation after a mutation." }),
) {}

/**
 * Encoded shape of {@link ConversationMutationResponse}.
 *
 * @see {@link ConversationMutationResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationMutationResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationMutationResponse>;
}

/**
 * Offline sync operation that renames a conversation.
 *
 * **Example** (Rename offline)
 *
 * ```ts
 * import { SetConversationTitleOperation } from "./Conversation.ts"
 *
 * const operation = SetConversationTitleOperation.make({ title: "Launch sync" })
 * console.log(operation.type) // "setTitle"
 * ```
 *
 * @see {@link ConversationSyncOperation} for the tagged union it belongs to.
 * @category models
 * @since 0.0.0
 */
export class SetConversationTitleOperation extends Model<SetConversationTitleOperation>("SetConversationTitleOperation")(
  {
    type: S.tag("setTitle").pipe(pg.text(), pg.columnName("type")),
    title: text("title"),
  },
  $I.annote("SetConversationTitleOperation", { description: "Sync operation that sets the title." }),
) {}

/**
 * Encoded shape of {@link SetConversationTitleOperation}.
 *
 * @see {@link SetConversationTitleOperation} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SetConversationTitleOperation {
  export type Encoded = S.Codec.Encoded<typeof SetConversationTitleOperation>;
}

/**
 * Offline sync operation that stars or unstars a conversation.
 *
 * **Example** (Star offline)
 *
 * ```ts
 * import { SetConversationStarredOperation } from "./Conversation.ts"
 *
 * const operation = SetConversationStarredOperation.make({ starred: true })
 * console.log(operation.type) // "setStarred"
 * ```
 *
 * @see {@link ConversationSyncOperation} for the tagged union it belongs to.
 * @category models
 * @since 0.0.0
 */
export class SetConversationStarredOperation extends Model<SetConversationStarredOperation>(
  "SetConversationStarredOperation",
)(
  {
    type: S.tag("setStarred").pipe(pg.text(), pg.columnName("type")),
    starred: bool("starred"),
  },
  $I.annote("SetConversationStarredOperation", { description: "Sync operation that sets the starred flag." }),
) {}

/**
 * Encoded shape of {@link SetConversationStarredOperation}.
 *
 * @see {@link SetConversationStarredOperation} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SetConversationStarredOperation {
  export type Encoded = S.Codec.Encoded<typeof SetConversationStarredOperation>;
}

/**
 * Discriminant values for offline conversation sync operations.
 *
 * **Example** (Check an operation kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ConversationSyncOperationKind } from "./Conversation.ts"
 *
 * const isKind = S.is(ConversationSyncOperationKind)
 * console.log(isKind("setStarred")) // true
 * console.log(isKind("delete")) // false
 * ```
 *
 * @see {@link ConversationSyncOperation} for the union keyed by these values.
 * @category schemas
 * @since 0.0.0
 */
export const ConversationSyncOperationKind = LiteralKit(["setTitle", "setStarred"]).pipe(
  $I.annoteSchema("ConversationSyncOperationKind", { description: "Kind of an offline conversation sync operation." }),
);

/**
 * Decoded type of {@link ConversationSyncOperationKind}.
 *
 * @see {@link ConversationSyncOperationKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ConversationSyncOperationKind = typeof ConversationSyncOperationKind.Type;

/**
 * Offline sync operation. `type` selects the title or starred arm.
 *
 * **Example** (Decode a starred operation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationSyncOperation } from "./Conversation.ts"
 *
 * const decoded = Effect.runSync(S.decodeEffect(ConversationSyncOperation)({ type: "setStarred", starred: true }))
 * console.log(decoded.type) // "setStarred"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConversationSyncOperation = ConversationSyncOperationKind.mapMembers(
  Tuple.evolve([() => SetConversationTitleOperation, () => SetConversationStarredOperation]),
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ConversationSyncOperation", { description: "Offline conversation sync operation." }),
);

/**
 * One queued offline mutation that a client replays against a conversation.
 *
 * **Example** (Decode a queued rename)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationSyncMutationRequest } from "./Conversation.ts"
 *
 * const request = Effect.runSync(
 *   S.decodeEffect(ConversationSyncMutationRequest)({
 *     clientMutationId: "mut-1",
 *     conversationId: "conv-123",
 *     operation: { type: "setTitle", title: "Launch sync" },
 *   }),
 * )
 * console.log(request.operation.type) // "setTitle"
 * ```
 *
 * @see {@link ConversationSyncOperation} for the operation arms.
 * @category models
 * @since 0.0.0
 */
export class ConversationSyncMutationRequest extends Model<ConversationSyncMutationRequest>(
  "ConversationSyncMutationRequest",
)(
  {
    clientMutationId: text("client_mutation_id"),
    conversationId: text("conversation_id"),
    operation: ConversationSyncOperation.pipe(pg.jsonb(), pg.columnName("operation")),
  },
  $I.annote("ConversationSyncMutationRequest", { description: "One offline mutation to apply." }),
) {}

/**
 * Encoded shape of {@link ConversationSyncMutationRequest}.
 *
 * @see {@link ConversationSyncMutationRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationSyncMutationRequest {
  export type Encoded = S.Codec.Encoded<typeof ConversationSyncMutationRequest>;
}

/**
 * Server sync cursor for one conversation: when it was last mutated.
 *
 * **Example** (Decode a cursor)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ConversationSyncState } from "./Conversation.ts"
 *
 * const state = Effect.runSync(
 *   S.decodeEffect(ConversationSyncState)({
 *     conversationId: "conv-123",
 *     lastMutationAt: "2024-05-01T09:00:00.000Z",
 *   }),
 * )
 * console.log(O.isSome(state.lastMutationAt)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationSyncState extends Model<ConversationSyncState>("ConversationSyncState")(
  {
    conversationId: text("conversation_id"),
    lastMutationAt: optionalTimestamp("last_mutation_at"),
  },
  $I.annote("ConversationSyncState", { description: "Server sync cursor for one conversation." }),
) {}

/**
 * Encoded shape of {@link ConversationSyncState}.
 *
 * @see {@link ConversationSyncState} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationSyncState {
  export type Encoded = S.Codec.Encoded<typeof ConversationSyncState>;
}

/**
 * Response to an offline mutation that the server applied.
 *
 * **Example** (Acknowledge a mutation)
 *
 * ```ts
 * import { ConversationSyncMutationResponse, ConversationSyncState } from "./Conversation.ts"
 *
 * const response = ConversationSyncMutationResponse.make({
 *   status: "ok",
 *   state: ConversationSyncState.make({ conversationId: "conv-123" }),
 * })
 * console.log(response.status) // "ok"
 * ```
 *
 * @see {@link ConversationSyncConflictResponse} for the rejected case.
 * @category models
 * @since 0.0.0
 */
export class ConversationSyncMutationResponse extends Model<ConversationSyncMutationResponse>(
  "ConversationSyncMutationResponse",
)(
  {
    status: S.Literal("ok").pipe(pg.text(), pg.columnName("status")),
    state: ConversationSyncState.pipe(pg.jsonb(), pg.columnName("state")),
  },
  $I.annote("ConversationSyncMutationResponse", { description: "Successful sync mutation. Not a conflict." }),
) {}

/**
 * Encoded shape of {@link ConversationSyncMutationResponse}.
 *
 * @see {@link ConversationSyncMutationResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationSyncMutationResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationSyncMutationResponse>;
}

/**
 * Response to an offline mutation that lost a conflict, carrying the server's sync state.
 *
 * **Example** (Report a conflict)
 *
 * ```ts
 * import { ConversationSyncConflictResponse, ConversationSyncState } from "./Conversation.ts"
 *
 * const response = ConversationSyncConflictResponse.make({
 *   status: "conflict",
 *   state: ConversationSyncState.make({ conversationId: "conv-123" }),
 * })
 * console.log(response.status) // "conflict"
 * ```
 *
 * @see {@link ConversationSyncMutationResponse} for the applied case.
 * @category models
 * @since 0.0.0
 */
export class ConversationSyncConflictResponse extends Model<ConversationSyncConflictResponse>(
  "ConversationSyncConflictResponse",
)(
  {
    status: S.Literal("conflict").pipe(pg.text(), pg.columnName("status")),
    state: ConversationSyncState.pipe(pg.jsonb(), pg.columnName("state")),
  },
  $I.annote("ConversationSyncConflictResponse", { description: "Sync mutation that lost a conflict. Not an ok response." }),
) {}

/**
 * Encoded shape of {@link ConversationSyncConflictResponse}.
 *
 * @see {@link ConversationSyncConflictResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationSyncConflictResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationSyncConflictResponse>;
}

/**
 * Request to create a conversation from already transcribed text.
 *
 * **Details**
 *
 * `make` fills `textSource` with `audio_transcript` and `source` with `omi`.
 * Decoding requires both.
 *
 * **Example** (Create from a transcript)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { CreateConversation } from "./Conversation.ts"
 *
 * const request = CreateConversation.make({
 *   text: "Let's ship on Friday.",
 *   startedAt: DateTime.makeUnsafe("2024-05-01T09:00:00.000Z"),
 *   finishedAt: DateTime.makeUnsafe("2024-05-01T09:30:00.000Z"),
 * })
 * console.log(request.textSource) // "audio_transcript"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateConversation extends Model<CreateConversation>("CreateConversation")(
  {
    text: text("text"),
    textSource: ExternalIntegrationConversationSource.pipe(
      S.withConstructorDefault(Effect.succeed<ExternalIntegrationConversationSource>("audio_transcript")),
      pg.text(),
      pg.columnName("text_source"),
    ),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    language: optionalText("language"),
    geolocation: optionalNull(Geolocation).pipe(pg.jsonb(), pg.columnName("geolocation")),
    recordingFilePath: optionalText("recording_file_path"),
    recordingFileSize: optionalNull(S.Int).pipe(pg.integer(), pg.columnName("recording_file_size")),
    recordingFileDuration: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("recording_file_duration")),
    source: sourceDefault("omi"),
    photos: jsonList(ConversationPhoto, "photos"),
    calendarEvents: jsonList(CalendarEventLink, "calendar_events"),
    processingConversationId: optionalText("processing_conversation_id"),
    privateCloudSyncEnabled: boolDefault("private_cloud_sync_enabled", false),
  },
  $I.annote("CreateConversation", { description: "Request to create a conversation from text." }),
) {}

/**
 * Encoded shape of {@link CreateConversation}.
 *
 * @see {@link CreateConversation} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreateConversation {
  export type Encoded = S.Codec.Encoded<typeof CreateConversation>;
}

/**
 * Payload an external integration sends to create a conversation from text.
 *
 * **Details**
 *
 * Unlike {@link CreateConversation}, the timestamps are optional and
 * `textSource` has no default.
 *
 * **Example** (Create from a chat message)
 *
 * ```ts
 * import { ExternalIntegrationCreateConversation } from "./Conversation.ts"
 *
 * const created = ExternalIntegrationCreateConversation.make({ text: "Remind me to call Ada.", textSource: "message" })
 * console.log(created.source) // "external_integration"
 * ```
 *
 * @see {@link externalGetTranscript} for the transcript it yields.
 * @category models
 * @since 0.0.0
 */
export class ExternalIntegrationCreateConversation extends Model<ExternalIntegrationCreateConversation>(
  "ExternalIntegrationCreateConversation",
)(
  {
    text: text("text"),
    textSource: ExternalIntegrationConversationSource.pipe(pg.text(), pg.columnName("text_source")),
    startedAt: optionalTimestamp("started_at"),
    finishedAt: optionalTimestamp("finished_at"),
    language: optionalText("language"),
    geolocation: optionalNull(Geolocation).pipe(pg.jsonb(), pg.columnName("geolocation")),
    source: sourceDefault("external_integration"),
    appId: optionalText("app_id"),
  },
  $I.annote("ExternalIntegrationCreateConversation", { description: "External integration create payload." }),
) {}

/**
 * Encoded shape of {@link ExternalIntegrationCreateConversation}.
 *
 * @see {@link ExternalIntegrationCreateConversation} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExternalIntegrationCreateConversation {
  export type Encoded = S.Codec.Encoded<typeof ExternalIntegrationCreateConversation>;
}

/**
 * Transcript text for an external create. Timestamps are ignored.
 *
 * **Example** (Return the text)
 *
 * ```ts
 * import { ExternalIntegrationCreateConversation, externalGetTranscript } from "./Conversation.ts"
 *
 * const created = ExternalIntegrationCreateConversation.make({ text: " Hello ", textSource: "message" })
 * console.log(externalGetTranscript(created, true)) // "Hello"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Payload and the timestamp flag are co-primary inputs, and neither is a pipeable value.
export const externalGetTranscript = (created: ExternalIntegrationCreateConversation, _includeTimestamps = false): string => {
  void _includeTimestamps;
  return Str.trim(created.text);
};

/**
 * External creates have no person ids.
 *
 * **Example** (Empty list)
 *
 * ```ts
 * import { ExternalIntegrationCreateConversation, externalGetPersonIds } from "./Conversation.ts"
 *
 * const created = ExternalIntegrationCreateConversation.make({ text: "Hello", textSource: "other_text" })
 * console.log(externalGetPersonIds(created).length) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const externalGetPersonIds = (_created: ExternalIntegrationCreateConversation): ReadonlyArray<string> => [];

/**
 * Created conversation together with the chat messages opened for it.
 *
 * **Example** (Return a new conversation)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Conversation, CreateConversationResponse } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 *
 * const response = CreateConversationResponse.make({
 *   conversation: Conversation.make({
 *     id: "conv-123",
 *     createdAt: DateTime.makeUnsafe("2024-05-01T09:00:00.000Z"),
 *     structured: Structured.make({ title: "Launch sync" }),
 *   }),
 * })
 * console.log(response.messages.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateConversationResponse extends Model<CreateConversationResponse>("CreateConversationResponse")(
  {
    conversation: Conversation.pipe(pg.jsonb(), pg.columnName("conversation")),
    messages: jsonList(Message, "messages"),
  },
  $I.annote("CreateConversationResponse", { description: "Created conversation and its opening messages." }),
) {}

/**
 * Encoded shape of {@link CreateConversationResponse}.
 *
 * @see {@link CreateConversationResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreateConversationResponse {
  export type Encoded = S.Codec.Encoded<typeof CreateConversationResponse>;
}

/**
 * Finalization status of one conversation, polled while it is processed.
 *
 * **Example** (Report a conversation still processing)
 *
 * ```ts
 * import { ConversationFinalizationStatusResponse } from "./Conversation.ts"
 * import { Structured } from "./Structured.ts"
 *
 * const status = ConversationFinalizationStatusResponse.make({
 *   conversationId: "conv-123",
 *   status: "processing",
 *   hasClientProcessing: false,
 *   structured: Structured.make({ title: "Launch sync" }),
 * })
 * console.log(status.status) // "processing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationFinalizationStatusResponse extends Model<ConversationFinalizationStatusResponse>(
  "ConversationFinalizationStatusResponse",
)(
  {
    conversationId: text("conversation_id"),
    status: ConversationStatus.pipe(pg.text(), pg.columnName("status")),
    processingState: optionalNull(ConversationProcessingState).pipe(pg.text(), pg.columnName("processing_state")),
    hasClientProcessing: bool("has_client_processing"),
    structured: Structured.pipe(pg.jsonb(), pg.columnName("structured")),
  },
  $I.annote("ConversationFinalizationStatusResponse", { description: "Finalization status of one conversation." }),
) {}

/**
 * Encoded shape of {@link ConversationFinalizationStatusResponse}.
 *
 * @see {@link ConversationFinalizationStatusResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationFinalizationStatusResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationFinalizationStatusResponse>;
}

/**
 * Id of the memory created from a conversation.
 *
 * **Example** (Return the new memory id)
 *
 * ```ts
 * import { CreateMemoryResponse } from "./Conversation.ts"
 *
 * const response = CreateMemoryResponse.make({ memoryId: "mem-9" })
 * console.log(response.memoryId) // "mem-9"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateMemoryResponse extends Model<CreateMemoryResponse>("CreateMemoryResponse")(
  { memoryId: text("memory_id") },
  $I.annote("CreateMemoryResponse", { description: "Id of a memory created from a conversation." }),
) {}

/**
 * Encoded shape of {@link CreateMemoryResponse}.
 *
 * @see {@link CreateMemoryResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreateMemoryResponse {
  export type Encoded = S.Codec.Encoded<typeof CreateMemoryResponse>;
}

/**
 * Request that replaces a conversation's whole event list, tagged with the client's events hash.
 *
 * **Example** (Replace the events)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { SetConversationEventsStateRequest } from "./Conversation.ts"
 * import { Event } from "./Structured.ts"
 *
 * const request = SetConversationEventsStateRequest.make({
 *   eventsHash: "a1b2c3",
 *   events: [Event.make({ title: "Launch review", start: DateTime.makeUnsafe("2024-05-03T15:00:00.000Z") })],
 * })
 * console.log(request.events.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetConversationEventsStateRequest extends Model<SetConversationEventsStateRequest>(
  "SetConversationEventsStateRequest",
)(
  {
    eventsHash: text("events_hash"),
    events: jsonList(Event, "events"),
  },
  $I.annote("SetConversationEventsStateRequest", { description: "Replace the conversation event list." }),
) {}

/**
 * Encoded shape of {@link SetConversationEventsStateRequest}.
 *
 * @see {@link SetConversationEventsStateRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SetConversationEventsStateRequest {
  export type Encoded = S.Codec.Encoded<typeof SetConversationEventsStateRequest>;
}

/**
 * Request that replaces a conversation's whole action-item list, tagged with the client's list hash.
 *
 * **Example** (Replace the action items)
 *
 * ```ts
 * import { SetConversationActionItemsStateRequest } from "./Conversation.ts"
 * import { ActionItem } from "./Structured.ts"
 *
 * const request = SetConversationActionItemsStateRequest.make({
 *   actionItemsHash: "d4e5f6",
 *   actionItems: [ActionItem.make({ description: "Send the launch checklist" })],
 * })
 * console.log(request.actionItems[0]?.description) // "Send the launch checklist"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetConversationActionItemsStateRequest extends Model<SetConversationActionItemsStateRequest>(
  "SetConversationActionItemsStateRequest",
)(
  {
    actionItemsHash: text("action_items_hash"),
    actionItems: jsonList(ActionItem, "action_items"),
  },
  $I.annote("SetConversationActionItemsStateRequest", { description: "Replace the conversation action-item list." }),
) {}

/**
 * Encoded shape of {@link SetConversationActionItemsStateRequest}.
 *
 * @see {@link SetConversationActionItemsStateRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SetConversationActionItemsStateRequest {
  export type Encoded = S.Codec.Encoded<typeof SetConversationActionItemsStateRequest>;
}

/**
 * Request that assigns a person to, or clears the person on, several transcript segments.
 *
 * **Example** (Assign two segments)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BulkAssignSegmentsRequest } from "./Conversation.ts"
 *
 * const request = Effect.runSync(
 *   S.decodeEffect(BulkAssignSegmentsRequest)({
 *     segmentIds: ["seg-1", "seg-2"],
 *     personId: "person-7",
 *     assignType: "assign",
 *   }),
 * )
 * console.log(request.segmentIds.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BulkAssignSegmentsRequest extends Model<BulkAssignSegmentsRequest>("BulkAssignSegmentsRequest")(
  {
    segmentIds: jsonList(S.String, "segment_ids"),
    personId: optionalText("person_id"),
    assignType: LiteralKit(["assign", "unassign"]).pipe(pg.text(), pg.columnName("assign_type")),
  },
  $I.annote("BulkAssignSegmentsRequest", { description: "Assign or unassign a person on transcript segments." }),
) {}

/**
 * Encoded shape of {@link BulkAssignSegmentsRequest}.
 *
 * @see {@link BulkAssignSegmentsRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BulkAssignSegmentsRequest {
  export type Encoded = S.Codec.Encoded<typeof BulkAssignSegmentsRequest>;
}

/**
 * Request that replaces the text of one transcript segment.
 *
 * **Example** (Correct a segment)
 *
 * ```ts
 * import { UpdateSegmentTextRequest } from "./Conversation.ts"
 *
 * const request = UpdateSegmentTextRequest.make({ id: "seg-1", text: "Let's ship on Friday." })
 * console.log(request.text) // "Let's ship on Friday."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UpdateSegmentTextRequest extends Model<UpdateSegmentTextRequest>("UpdateSegmentTextRequest")(
  { id: text("id"), text: text("text") },
  $I.annote("UpdateSegmentTextRequest", { description: "Replace one transcript segment's text." }),
) {}

/**
 * Encoded shape of {@link UpdateSegmentTextRequest}.
 *
 * @see {@link UpdateSegmentTextRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UpdateSegmentTextRequest {
  export type Encoded = S.Codec.Encoded<typeof UpdateSegmentTextRequest>;
}

/**
 * Patch for a conversation summary's title, overview and category.
 *
 * **Details**
 *
 * A `None` field leaves that part of the summary unchanged.
 *
 * **Example** (Change only the title)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { UpdateSummaryRequest } from "./Conversation.ts"
 *
 * const patch = UpdateSummaryRequest.make({ title: O.some("Launch sync") })
 * console.log(O.isNone(patch.overview)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UpdateSummaryRequest extends Model<UpdateSummaryRequest>("UpdateSummaryRequest")(
  { title: optionalText("title"), overview: optionalText("overview"), category: optionalText("category") },
  $I.annote("UpdateSummaryRequest", { description: "Patch the structured summary." }),
) {}

/**
 * Encoded shape of {@link UpdateSummaryRequest}.
 *
 * @see {@link UpdateSummaryRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UpdateSummaryRequest {
  export type Encoded = S.Codec.Encoded<typeof UpdateSummaryRequest>;
}

/**
 * Request that deletes an action item, identified by its description and completion flag.
 *
 * **Example** (Delete an open item)
 *
 * ```ts
 * import { DeleteActionItemRequest } from "./Conversation.ts"
 *
 * const request = DeleteActionItemRequest.make({ description: "Send the launch checklist" })
 * console.log(request.completed) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeleteActionItemRequest extends Model<DeleteActionItemRequest>("DeleteActionItemRequest")(
  { description: text("description"), completed: boolDefault("completed", false) },
  $I.annote("DeleteActionItemRequest", { description: "Identify an action item to delete." }),
) {}

/**
 * Encoded shape of {@link DeleteActionItemRequest}.
 *
 * @see {@link DeleteActionItemRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DeleteActionItemRequest {
  export type Encoded = S.Codec.Encoded<typeof DeleteActionItemRequest>;
}

/**
 * Request that renames an action item, found by its current description.
 *
 * **Example** (Rename an item)
 *
 * ```ts
 * import { UpdateActionItemDescriptionRequest } from "./Conversation.ts"
 *
 * const request = UpdateActionItemDescriptionRequest.make({
 *   oldDescription: "Send checklist",
 *   description: "Send the launch checklist",
 * })
 * console.log(request.description) // "Send the launch checklist"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UpdateActionItemDescriptionRequest extends Model<UpdateActionItemDescriptionRequest>(
  "UpdateActionItemDescriptionRequest",
)(
  { oldDescription: text("old_description"), description: text("description") },
  $I.annote("UpdateActionItemDescriptionRequest", { description: "Rename an action item." }),
) {}

/**
 * Encoded shape of {@link UpdateActionItemDescriptionRequest}.
 *
 * @see {@link UpdateActionItemDescriptionRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UpdateActionItemDescriptionRequest {
  export type Encoded = S.Codec.Encoded<typeof UpdateActionItemDescriptionRequest>;
}

/**
 * Paged conversation search with an optional text query and status filter.
 *
 * **Details**
 *
 * `page` is 1 to 1000 and `perPage` is 1 to 100. `make` fills them with 1
 * and 10. A missing `includeDiscarded` decodes as `true`.
 *
 * **Example** (Search the first page)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { SearchRequest } from "./Conversation.ts"
 *
 * const request = SearchRequest.make({ search: O.some("launch"), includeDiscarded: O.some(false) })
 * console.log(request.page, request.perPage) // 1 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchRequest extends Model<SearchRequest>("SearchRequest")(
  {
    page: S.Int.check(S.isBetween({ minimum: 1, maximum: 1000 })).pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      pg.integer(),
      pg.columnName("page"),
    ),
    perPage: S.Int.check(S.isBetween({ minimum: 1, maximum: 100 })).pipe(
      S.withConstructorDefault(Effect.succeed(10)),
      pg.integer(),
      pg.columnName("per_page"),
    ),
    includeDiscarded: optionDefault(S.Boolean, () => true).pipe(pg.boolean(), pg.columnName("include_discarded")),
    search: optionalText("search"),
    statuses: optionalNull(ConversationStatus.pipe(S.Array)).pipe(pg.jsonb(), pg.columnName("statuses")),
  },
  $I.annote("SearchRequest", { description: "Conversation search page." }),
) {}

/**
 * Encoded shape of {@link SearchRequest}.
 *
 * @see {@link SearchRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SearchRequest {
  export type Encoded = S.Codec.Encoded<typeof SearchRequest>;
}

/**
 * Prompt submitted to trial conversation summarization.
 *
 * **Example** (Submit a prompt)
 *
 * ```ts
 * import { TestPromptRequest } from "./Conversation.ts"
 *
 * const request = TestPromptRequest.make({ prompt: "Summarize the decisions in three bullets." })
 * console.log(request.prompt.length > 0) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TestPromptRequest extends Model<TestPromptRequest>("TestPromptRequest")(
  { prompt: text("prompt") },
  $I.annote("TestPromptRequest", { description: "Prompt used to test conversation summarization." }),
) {}

/**
 * Encoded shape of {@link TestPromptRequest}.
 *
 * @see {@link TestPromptRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TestPromptRequest {
  export type Encoded = S.Codec.Encoded<typeof TestPromptRequest>;
}

/**
 * Request that merges two or more conversations into one.
 *
 * **Example** (Reject a single id)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { MergeConversationsRequest } from "./Conversation.ts"
 *
 * const decode = S.decodeUnknownExit(MergeConversationsRequest)
 * console.log(Exit.isSuccess(decode({ conversationIds: ["conv-1", "conv-2"] }))) // true
 * console.log(Exit.isFailure(decode({ conversationIds: ["conv-1"] }))) // true
 * ```
 *
 * @see {@link MergeConversationsResponse} for the result.
 * @category models
 * @since 0.0.0
 */
export class MergeConversationsRequest extends Model<MergeConversationsRequest>("MergeConversationsRequest")(
  {
    conversationIds: S.Array(S.String).check(S.isMinLength(2)).pipe(pg.jsonb(), pg.columnName("conversation_ids")),
  },
  $I.annote("MergeConversationsRequest", { description: "Merge at least two conversations." }),
  (columns) => [textBoundsCheck("conversation_ids", { minLength: 2 })(columns.conversationIds)],
) {}

/**
 * Encoded shape of {@link MergeConversationsRequest}.
 *
 * @see {@link MergeConversationsRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MergeConversationsRequest {
  export type Encoded = S.Codec.Encoded<typeof MergeConversationsRequest>;
}

/**
 * Result of a merge: its status, the merged ids and the new conversation id.
 *
 * **Example** (Report a merge)
 *
 * ```ts
 * import { MergeConversationsResponse } from "./Conversation.ts"
 *
 * const response = MergeConversationsResponse.make({
 *   status: "merging",
 *   conversationIds: ["conv-1", "conv-2"],
 *   newConversationId: "conv-3",
 * })
 * console.log(response.newConversationId) // "conv-3"
 * ```
 *
 * @see {@link MergeConversationsRequest} for the request.
 * @category models
 * @since 0.0.0
 */
export class MergeConversationsResponse extends Model<MergeConversationsResponse>("MergeConversationsResponse")(
  {
    status: text("status"),
    conversationIds: jsonList(S.String, "conversation_ids"),
    newConversationId: text("new_conversation_id"),
  },
  $I.annote("MergeConversationsResponse", { description: "Result of merging conversations." }),
) {}

/**
 * Encoded shape of {@link MergeConversationsResponse}.
 *
 * @see {@link MergeConversationsResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MergeConversationsResponse {
  export type Encoded = S.Codec.Encoded<typeof MergeConversationsResponse>;
}

/**
 * Total talk time of one speaker in a conversation.
 *
 * **Example** (Record talk time)
 *
 * ```ts
 * import { SpeakerAnalytics } from "./Conversation.ts"
 *
 * const speaker = SpeakerAnalytics.make({ speakerId: 1, duration: 42.5 })
 * console.log(speaker.duration) // 42.5
 * ```
 *
 * @see {@link ConversationAnalytics} for the per-conversation roll-up.
 * @category models
 * @since 0.0.0
 */
export class SpeakerAnalytics extends Model<SpeakerAnalytics>("SpeakerAnalytics")(
  { speakerId: S.Int.pipe(pg.integer(), pg.columnName("speaker_id")), duration: finiteDefault("duration", 0) },
  $I.annote("SpeakerAnalytics", { description: "How long one speaker talked." }),
) {}

/**
 * Encoded shape of {@link SpeakerAnalytics}.
 *
 * @see {@link SpeakerAnalytics} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SpeakerAnalytics {
  export type Encoded = S.Codec.Encoded<typeof SpeakerAnalytics>;
}

/**
 * Duration analytics for a conversation: total length and talk time per speaker.
 *
 * **Example** (Roll up two speakers)
 *
 * ```ts
 * import { ConversationAnalytics, SpeakerAnalytics } from "./Conversation.ts"
 *
 * const analytics = ConversationAnalytics.make({
 *   totalDuration: 60,
 *   speakers: [SpeakerAnalytics.make({ speakerId: 0, duration: 35 }), SpeakerAnalytics.make({ speakerId: 1, duration: 25 })],
 * })
 * console.log(analytics.speakers.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationAnalytics extends Model<ConversationAnalytics>("ConversationAnalytics")(
  {
    totalDuration: finiteDefault("total_duration", 0),
    speakers: jsonList(SpeakerAnalytics, "speakers"),
  },
  $I.annote("ConversationAnalytics", { description: "Duration analytics for a conversation." }),
) {}

/**
 * Encoded shape of {@link ConversationAnalytics}.
 *
 * @see {@link ConversationAnalytics} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationAnalytics {
  export type Encoded = S.Codec.Encoded<typeof ConversationAnalytics>;
}

void bool;
