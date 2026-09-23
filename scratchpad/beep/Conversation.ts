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

export declare namespace UpdateConversation {
  export type Encoded = S.Codec.Encoded<typeof UpdateConversation>;
}

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

export declare namespace SharedConversationChatHistoryMessage {
  export type Encoded = S.Codec.Encoded<typeof SharedConversationChatHistoryMessage>;
}

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

export declare namespace SharedConversationChatRequest {
  export type Encoded = S.Codec.Encoded<typeof SharedConversationChatRequest>;
}

export class SharedConversationChatResponse extends Model<SharedConversationChatResponse>(
  "SharedConversationChatResponse",
)(
  { message: text("message") },
  $I.annote("SharedConversationChatResponse", { description: "Answer about a shared conversation." }),
) {}

export declare namespace SharedConversationChatResponse {
  export type Encoded = S.Codec.Encoded<typeof SharedConversationChatResponse>;
}

export class SharedActionItem extends Model<SharedActionItem>("SharedActionItem")(
  { description: text("description"), completed: boolDefault("completed", false) },
  $I.annote("SharedActionItem", { description: "Action item shown on a shared conversation." }),
) {}

export declare namespace SharedActionItem {
  export type Encoded = S.Codec.Encoded<typeof SharedActionItem>;
}

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

export declare namespace SharedEvent {
  export type Encoded = S.Codec.Encoded<typeof SharedEvent>;
}

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

export declare namespace SharedStructured {
  export type Encoded = S.Codec.Encoded<typeof SharedStructured>;
}

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

export declare namespace SharedTranscriptSegment {
  export type Encoded = S.Codec.Encoded<typeof SharedTranscriptSegment>;
}

export class SharedAppResult extends Model<SharedAppResult>("SharedAppResult")(
  { appId: optionalText("app_id"), content: text("content") },
  $I.annote("SharedAppResult", { description: "App result on a shared conversation." }),
) {}

export declare namespace SharedAppResult {
  export type Encoded = S.Codec.Encoded<typeof SharedAppResult>;
}

export class SharedPluginResult extends Model<SharedPluginResult>("SharedPluginResult")(
  { pluginId: optionalText("plugin_id"), content: text("content") },
  $I.annote("SharedPluginResult", { description: "Plugin result on a shared conversation." }),
) {}

export declare namespace SharedPluginResult {
  export type Encoded = S.Codec.Encoded<typeof SharedPluginResult>;
}

export class SharedPerson extends Model<SharedPerson>("SharedPerson")(
  { id: text("id"), name: text("name") },
  $I.annote("SharedPerson", { description: "Person shown on a shared conversation." }),
) {}

export declare namespace SharedPerson {
  export type Encoded = S.Codec.Encoded<typeof SharedPerson>;
}

export class PluginResult extends Model<PluginResult>("PluginResult")(
  { pluginId: optionalText("plugin_id"), content: text("content") },
  $I.annote("PluginResult", { description: "Plugin result stored on a conversation. Rewritten from apps_results." }),
) {}

export declare namespace PluginResult {
  export type Encoded = S.Codec.Encoded<typeof PluginResult>;
}

export class AppResult extends Model<AppResult>("AppResult")(
  { appId: optionalText("app_id"), content: text("content") },
  $I.annote("AppResult", { description: "App result stored on a conversation." }),
) {}

export declare namespace AppResult {
  export type Encoded = S.Codec.Encoded<typeof AppResult>;
}

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

export declare namespace CalendarEventLink {
  export type Encoded = S.Codec.Encoded<typeof CalendarEventLink>;
}

export class ConversationPostProcessing extends Model<ConversationPostProcessing>("ConversationPostProcessing")(
  {
    status: PostProcessingStatus.pipe(pg.text(), pg.columnName("status")),
    model: PostProcessingModel.pipe(pg.text(), pg.columnName("model")),
  },
  $I.annote("ConversationPostProcessing", { description: "Post-processing job on a conversation." }),
) {}

export declare namespace ConversationPostProcessing {
  export type Encoded = S.Codec.Encoded<typeof ConversationPostProcessing>;
}

export class ConversationAudioSpan extends Model<ConversationAudioSpan>("ConversationAudioSpan")(
  {
    start: finiteDefault("start", 0),
    end: finiteDefault("end", 0),
    speaker: textDefault("speaker", ""),
    text: textDefault("text", ""),
  },
  $I.annote("ConversationAudioSpan", { description: "One timed span of conversation audio." }),
) {}

export declare namespace ConversationAudioSpan {
  export type Encoded = S.Codec.Encoded<typeof ConversationAudioSpan>;
}

export class ConversationAudio extends Model<ConversationAudio>("ConversationAudio")(
  {
    duration: finiteDefault("duration", 0),
    spans: jsonList(ConversationAudioSpan, "spans"),
  },
  $I.annote("ConversationAudio", { description: "Audio summary attached to a conversation." }),
) {}

export declare namespace ConversationAudio {
  export type Encoded = S.Codec.Encoded<typeof ConversationAudio>;
}

export class TranscriptMatchSnippet extends Model<TranscriptMatchSnippet>("TranscriptMatchSnippet")(
  { text: text("text"), start: finiteDefault("start", 0) },
  $I.annote("TranscriptMatchSnippet", { description: "Transcript snippet that matched a search." }),
) {}

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
 * import { Conversation, Structured } from "./Conversation.ts"
 *
 * const conversation = Conversation.make({
 *   id: "c1",
 *   createdAt: "2020-01-02T03:04:05.000Z",
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
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { Structured, initializeConversation } from "./Conversation.ts"
 *
 * const conversation = Effect.runSync(
 *   initializeConversation({
 *     id: "c1",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     structured: Structured.make({ title: "Standup" }),
 *     processingConversationId: O.some("mem-1"),
 *     transcriptSegments: [],
 *     photos: [],
 *     audioFiles: [],
 *     calendarEvents: [],
 *     appResults: [],
 *     pluginsResults: [],
 *     appsResults: [],
 *     suggestedSummarizationApps: [],
 *   }),
 * )
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
 * import * as O from "effect/Option"
 * import { Conversation, Structured, getTranscript } from "./Conversation.ts"
 * import { TranscriptSegment } from "./TranscriptSegment.ts"
 *
 * const conversation = Conversation.make({
 *   id: "c1",
 *   createdAt: "2020-01-02T03:04:05.000Z",
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
 * import { Conversation, Structured, getPhotosDescription } from "./Conversation.ts"
 *
 * const conversation = Conversation.make({
 *   id: "c1",
 *   createdAt: "2020-01-02T03:04:05.000Z",
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
 * import { Conversation, Structured, getPersonIds } from "./Conversation.ts"
 * import { TranscriptSegment } from "./TranscriptSegment.ts"
 *
 * const conversation = Conversation.make({
 *   id: "c1",
 *   createdAt: "2020-01-02T03:04:05.000Z",
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

export declare namespace SharedConversationResponse {
  export type Encoded = S.Codec.Encoded<typeof SharedConversationResponse>;
}

/**
 * Projects a conversation to the shared response, keeping only id and name for people.
 *
 * **Example** (Keep the title)
 *
 * ```ts
 * import { Conversation, Structured, projectSharedConversation } from "./Conversation.ts"
 *
 * const shared = projectSharedConversation(
 *   Conversation.make({ id: "c1", createdAt: "2020-01-02T03:04:05.000Z", structured: Structured.make({ title: "Standup" }) }),
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
 * import { Conversation, Structured, asDictCleanedDates } from "./Conversation.ts"
 *
 * const encoded = asDictCleanedDates(
 *   Conversation.make({ id: "c1", createdAt: "2020-01-02T03:04:05.000Z", structured: Structured.make({}) }),
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

export class ConversationMutationResponse extends Model<ConversationMutationResponse>("ConversationMutationResponse")(
  { conversation: Conversation.pipe(pg.jsonb(), pg.columnName("conversation")) },
  $I.annote("ConversationMutationResponse", { description: "Conversation after a mutation." }),
) {}

export declare namespace ConversationMutationResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationMutationResponse>;
}

export class SetConversationTitleOperation extends Model<SetConversationTitleOperation>("SetConversationTitleOperation")(
  {
    type: S.tag("setTitle").pipe(pg.text(), pg.columnName("type")),
    title: text("title"),
  },
  $I.annote("SetConversationTitleOperation", { description: "Sync operation that sets the title." }),
) {}

export declare namespace SetConversationTitleOperation {
  export type Encoded = S.Codec.Encoded<typeof SetConversationTitleOperation>;
}

export class SetConversationStarredOperation extends Model<SetConversationStarredOperation>(
  "SetConversationStarredOperation",
)(
  {
    type: S.tag("setStarred").pipe(pg.text(), pg.columnName("type")),
    starred: bool("starred"),
  },
  $I.annote("SetConversationStarredOperation", { description: "Sync operation that sets the starred flag." }),
) {}

export declare namespace SetConversationStarredOperation {
  export type Encoded = S.Codec.Encoded<typeof SetConversationStarredOperation>;
}

export const ConversationSyncOperationKind = LiteralKit(["setTitle", "setStarred"]).pipe(
  $I.annoteSchema("ConversationSyncOperationKind", { description: "Kind of an offline conversation sync operation." }),
);

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
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConversationSyncOperation)({ type: "setStarred", starred: true }))
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

export declare namespace ConversationSyncMutationRequest {
  export type Encoded = S.Codec.Encoded<typeof ConversationSyncMutationRequest>;
}

export class ConversationSyncState extends Model<ConversationSyncState>("ConversationSyncState")(
  {
    conversationId: text("conversation_id"),
    lastMutationAt: optionalTimestamp("last_mutation_at"),
  },
  $I.annote("ConversationSyncState", { description: "Server sync cursor for one conversation." }),
) {}

export declare namespace ConversationSyncState {
  export type Encoded = S.Codec.Encoded<typeof ConversationSyncState>;
}

export class ConversationSyncMutationResponse extends Model<ConversationSyncMutationResponse>(
  "ConversationSyncMutationResponse",
)(
  {
    status: S.Literal("ok").pipe(pg.text(), pg.columnName("status")),
    state: ConversationSyncState.pipe(pg.jsonb(), pg.columnName("state")),
  },
  $I.annote("ConversationSyncMutationResponse", { description: "Successful sync mutation. Not a conflict." }),
) {}

export declare namespace ConversationSyncMutationResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationSyncMutationResponse>;
}

export class ConversationSyncConflictResponse extends Model<ConversationSyncConflictResponse>(
  "ConversationSyncConflictResponse",
)(
  {
    status: S.Literal("conflict").pipe(pg.text(), pg.columnName("status")),
    state: ConversationSyncState.pipe(pg.jsonb(), pg.columnName("state")),
  },
  $I.annote("ConversationSyncConflictResponse", { description: "Sync mutation that lost a conflict. Not an ok response." }),
) {}

export declare namespace ConversationSyncConflictResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationSyncConflictResponse>;
}

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

export declare namespace CreateConversation {
  export type Encoded = S.Codec.Encoded<typeof CreateConversation>;
}

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

export class CreateConversationResponse extends Model<CreateConversationResponse>("CreateConversationResponse")(
  {
    conversation: Conversation.pipe(pg.jsonb(), pg.columnName("conversation")),
    messages: jsonList(Message, "messages"),
  },
  $I.annote("CreateConversationResponse", { description: "Created conversation and its opening messages." }),
) {}

export declare namespace CreateConversationResponse {
  export type Encoded = S.Codec.Encoded<typeof CreateConversationResponse>;
}

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

export declare namespace ConversationFinalizationStatusResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationFinalizationStatusResponse>;
}

export class CreateMemoryResponse extends Model<CreateMemoryResponse>("CreateMemoryResponse")(
  { memoryId: text("memory_id") },
  $I.annote("CreateMemoryResponse", { description: "Id of a memory created from a conversation." }),
) {}

export declare namespace CreateMemoryResponse {
  export type Encoded = S.Codec.Encoded<typeof CreateMemoryResponse>;
}

export class SetConversationEventsStateRequest extends Model<SetConversationEventsStateRequest>(
  "SetConversationEventsStateRequest",
)(
  {
    eventsHash: text("events_hash"),
    events: jsonList(Event, "events"),
  },
  $I.annote("SetConversationEventsStateRequest", { description: "Replace the conversation event list." }),
) {}

export declare namespace SetConversationEventsStateRequest {
  export type Encoded = S.Codec.Encoded<typeof SetConversationEventsStateRequest>;
}

export class SetConversationActionItemsStateRequest extends Model<SetConversationActionItemsStateRequest>(
  "SetConversationActionItemsStateRequest",
)(
  {
    actionItemsHash: text("action_items_hash"),
    actionItems: jsonList(ActionItem, "action_items"),
  },
  $I.annote("SetConversationActionItemsStateRequest", { description: "Replace the conversation action-item list." }),
) {}

export declare namespace SetConversationActionItemsStateRequest {
  export type Encoded = S.Codec.Encoded<typeof SetConversationActionItemsStateRequest>;
}

export class BulkAssignSegmentsRequest extends Model<BulkAssignSegmentsRequest>("BulkAssignSegmentsRequest")(
  {
    segmentIds: jsonList(S.String, "segment_ids"),
    personId: optionalText("person_id"),
    assignType: LiteralKit(["assign", "unassign"]).pipe(pg.text(), pg.columnName("assign_type")),
  },
  $I.annote("BulkAssignSegmentsRequest", { description: "Assign or unassign a person on transcript segments." }),
) {}

export declare namespace BulkAssignSegmentsRequest {
  export type Encoded = S.Codec.Encoded<typeof BulkAssignSegmentsRequest>;
}

export class UpdateSegmentTextRequest extends Model<UpdateSegmentTextRequest>("UpdateSegmentTextRequest")(
  { id: text("id"), text: text("text") },
  $I.annote("UpdateSegmentTextRequest", { description: "Replace one transcript segment's text." }),
) {}

export declare namespace UpdateSegmentTextRequest {
  export type Encoded = S.Codec.Encoded<typeof UpdateSegmentTextRequest>;
}

export class UpdateSummaryRequest extends Model<UpdateSummaryRequest>("UpdateSummaryRequest")(
  { title: optionalText("title"), overview: optionalText("overview"), category: optionalText("category") },
  $I.annote("UpdateSummaryRequest", { description: "Patch the structured summary." }),
) {}

export declare namespace UpdateSummaryRequest {
  export type Encoded = S.Codec.Encoded<typeof UpdateSummaryRequest>;
}

export class DeleteActionItemRequest extends Model<DeleteActionItemRequest>("DeleteActionItemRequest")(
  { description: text("description"), completed: boolDefault("completed", false) },
  $I.annote("DeleteActionItemRequest", { description: "Identify an action item to delete." }),
) {}

export declare namespace DeleteActionItemRequest {
  export type Encoded = S.Codec.Encoded<typeof DeleteActionItemRequest>;
}

export class UpdateActionItemDescriptionRequest extends Model<UpdateActionItemDescriptionRequest>(
  "UpdateActionItemDescriptionRequest",
)(
  { oldDescription: text("old_description"), description: text("description") },
  $I.annote("UpdateActionItemDescriptionRequest", { description: "Rename an action item." }),
) {}

export declare namespace UpdateActionItemDescriptionRequest {
  export type Encoded = S.Codec.Encoded<typeof UpdateActionItemDescriptionRequest>;
}

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

export declare namespace SearchRequest {
  export type Encoded = S.Codec.Encoded<typeof SearchRequest>;
}

export class TestPromptRequest extends Model<TestPromptRequest>("TestPromptRequest")(
  { prompt: text("prompt") },
  $I.annote("TestPromptRequest", { description: "Prompt used to test conversation summarization." }),
) {}

export declare namespace TestPromptRequest {
  export type Encoded = S.Codec.Encoded<typeof TestPromptRequest>;
}

export class MergeConversationsRequest extends Model<MergeConversationsRequest>("MergeConversationsRequest")(
  {
    conversationIds: S.Array(S.String).check(S.isMinLength(2)).pipe(pg.jsonb(), pg.columnName("conversation_ids")),
  },
  $I.annote("MergeConversationsRequest", { description: "Merge at least two conversations." }),
  (columns) => [textBoundsCheck("conversation_ids", { minLength: 2 })(columns.conversationIds)],
) {}

export declare namespace MergeConversationsRequest {
  export type Encoded = S.Codec.Encoded<typeof MergeConversationsRequest>;
}

export class MergeConversationsResponse extends Model<MergeConversationsResponse>("MergeConversationsResponse")(
  {
    status: text("status"),
    conversationIds: jsonList(S.String, "conversation_ids"),
    newConversationId: text("new_conversation_id"),
  },
  $I.annote("MergeConversationsResponse", { description: "Result of merging conversations." }),
) {}

export declare namespace MergeConversationsResponse {
  export type Encoded = S.Codec.Encoded<typeof MergeConversationsResponse>;
}

export class SpeakerAnalytics extends Model<SpeakerAnalytics>("SpeakerAnalytics")(
  { speakerId: S.Int.pipe(pg.integer(), pg.columnName("speaker_id")), duration: finiteDefault("duration", 0) },
  $I.annote("SpeakerAnalytics", { description: "How long one speaker talked." }),
) {}

export declare namespace SpeakerAnalytics {
  export type Encoded = S.Codec.Encoded<typeof SpeakerAnalytics>;
}

export class ConversationAnalytics extends Model<ConversationAnalytics>("ConversationAnalytics")(
  {
    totalDuration: finiteDefault("total_duration", 0),
    speakers: jsonList(SpeakerAnalytics, "speakers"),
  },
  $I.annote("ConversationAnalytics", { description: "Duration analytics for a conversation." }),
) {}

export declare namespace ConversationAnalytics {
  export type Encoded = S.Codec.Encoded<typeof ConversationAnalytics>;
}

void bool;
