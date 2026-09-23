/**
 * Chat session response shapes for v2 desktop chat.
 *
 * **Details**
 *
 * Chat sessions (v2) carry title, preview, message count, starred, and
 * updated-at. This is distinct from the legacy v1 `models.chat.ChatSession`
 * (`message_ids` / `file_ids`). `save_message` returns a small ack, not a
 * full message. Collection: `users/{uid}/chat_sessions` and `users/{uid}/messages`.
 * A chat session is not a Conversation and not a memory.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as R from "effect/Record";
import * as A from "effect/Array";
import { bool, optionalText, text, timestamp } from "./Kit.ts";
import { boolDefault, isRecord, Model, optionalNull, pg, toWire } from "./Port.ts";

const $I = $ScratchpadId.create("beep/ChatSession");

const copyRecord = (value: { readonly [key: string]: unknown }): { [key: string]: unknown } => ({ ...value });

/**
 * Repairs a legacy session dict before it is decoded.
 *
 * **Details**
 *
 * A present `app_id` overwrites `plugin_id`. Otherwise a present `plugin_id`
 * fills `app_id`. An empty title becomes `New Chat`. A missing preview becomes
 * null. A missing `updated_at` copies `created_at`. A missing message count
 * is the length of `message_ids`, or 0. A missing starred flag becomes false.
 *
 * **Example** (Fill a legacy session)
 *
 * ```ts
 * import { repairChatSessionResponseRecord } from "./ChatSession.ts"
 *
 * const repaired = repairChatSessionResponseRecord({ id: "s1", created_at: "2020-01-02T03:04:05.000Z" })
 * console.log(repaired && typeof repaired === "object" && "title" in repaired && repaired.title) // "New Chat"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const repairChatSessionResponseRecord = (input: unknown): unknown => {
  if (!isRecord(input)) return input;
  const data = copyRecord(input);
  const appId = data.app_id;
  const pluginId = data.plugin_id;
  if (appId !== undefined && appId !== null) data.plugin_id = appId;
  else if (pluginId !== undefined && pluginId !== null) data.app_id = pluginId;
  const title = data.title;
  if (title === undefined || title === null || title === "") data.title = "New Chat";
  if (!R.has(data, "preview")) data.preview = null;
  if ((data.updated_at === undefined || data.updated_at === null) && data.created_at != null) {
    data.updated_at = data.created_at;
  }
  if (data.message_count == null) {
    const ids = data.message_ids;
    data.message_count = A.isArray(ids) ? ids.length : 0;
  }
  if (data.starred == null) data.starred = false;
  return data;
};

/**
 * A v2 chat session: multi-session chat with title, preview, and starring.
 *
 * **Details**
 *
 * `pluginId` mirrors `appId` for cross-platform query compatibility. Null
 * `appId` means main chat. Decode legacy rows through
 * {@link decodeChatSessionResponse}, which runs the repair first.
 *
 * **Example** (Decode a repaired title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeChatSessionResponse } from "./ChatSession.ts"
 *
 * const decoded = Effect.runSync(
 *   decodeChatSessionResponse({ id: "s1", created_at: "2020-01-02T03:04:05.000Z", updated_at: "2020-01-02T03:04:05.000Z" }),
 * )
 * console.log(decoded.title) // "New Chat"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatSessionResponse extends Model<ChatSessionResponse>("ChatSessionResponse")(
  {
    id: text("id"),
    title: text("title"),
    preview: optionalText("preview"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    appId: optionalText("app_id"),
    pluginId: optionalText("plugin_id"),
    messageCount: S.Int.pipe(pg.integer(), pg.columnName("message_count")),
    starred: bool("starred"),
  },
  $I.annote("ChatSessionResponse", {
    description: "V2 chat session response. Not the legacy v1 ChatSession and not a Conversation.",
  }),
) {}

/**
 * Encoded form of {@link ChatSessionResponse}.
 *
 * @see {@link ChatSessionResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatSessionResponse {
  export type Encoded = S.Codec.Encoded<typeof ChatSessionResponse>;
}

const ChatSessionResponseWire = toWire(ChatSessionResponse);

const decodeChatSessionResponseWire = S.decodeUnknownEffect(ChatSessionResponseWire);

/**
 * Decodes a v2 session, repairing legacy app/plugin ids and missing counters.
 *
 * **Example** (Copy created_at into updated_at)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { decodeChatSessionResponse } from "./ChatSession.ts"
 *
 * const decoded = Effect.runSync(
 *   decodeChatSessionResponse({
 *     id: "s1",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     message_ids: ["m1", "m2"],
 *   }),
 * )
 * console.log(DateTime.formatIso(decoded.updatedAt)) // "2020-01-02T03:04:05.000Z"
 * console.log(decoded.messageCount) // 2
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeChatSessionResponse = Effect.fn("ChatSessionResponse.decode")(function* (input: unknown) {
  return yield* decodeChatSessionResponseWire(repairChatSessionResponseRecord(input));
});

/**
 * Ack for `POST /v2/desktop/messages`.
 *
 * **Details**
 *
 * `createdAt` is an ISO-8601 string, not a datetime. The persistence layer
 * calls `datetime.isoformat()`. `created` is false for an idempotent retry of
 * an existing `client_message_id`. `updated` is true when a newer canonical
 * journal revision replaced the payload.
 *
 * **Example** (Decode an idempotent retry)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SaveMessageResponse } from "./ChatSession.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(SaveMessageResponse)({
 *     id: "m1",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     sessionId: null,
 *     created: false,
 *     updated: false,
 *   }),
 * )
 * console.log(decoded.created) // false
 * console.log(O.isNone(decoded.sessionId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SaveMessageResponse extends Model<SaveMessageResponse>("SaveMessageResponse")(
  {
    id: text("id"),
    createdAt: text("created_at"),
    sessionId: optionalText("session_id"),
    created: bool("created"),
    updated: boolDefault("updated", false),
    journalRevision: optionalNull(S.Int).pipe(pg.integer(), pg.columnName("journal_revision")),
  },
  $I.annote("SaveMessageResponse", {
    description: "Ack for saving a desktop message. created_at stays a string.",
  }),
) {}

/**
 * Encoded form of {@link SaveMessageResponse}.
 *
 * @see {@link SaveMessageResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SaveMessageResponse {
  export type Encoded = S.Codec.Encoded<typeof SaveMessageResponse>;
}

/**
 * Ack for `DELETE /v2/desktop/messages`.
 *
 * **Example** (Read the deleted count)
 *
 * ```ts
 * import { DeleteMessagesResponse } from "./ChatSession.ts"
 *
 * console.log(DeleteMessagesResponse.make({ status: "ok", deletedCount: 2 }).deletedCount) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeleteMessagesResponse extends Model<DeleteMessagesResponse>("DeleteMessagesResponse")(
  {
    status: text("status"),
    deletedCount: S.Int.pipe(pg.integer(), pg.columnName("deleted_count")),
  },
  $I.annote("DeleteMessagesResponse", {
    description: "Ack for deleting desktop messages.",
  }),
) {}

/**
 * Encoded form of {@link DeleteMessagesResponse}.
 *
 * @see {@link DeleteMessagesResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DeleteMessagesResponse {
  export type Encoded = S.Codec.Encoded<typeof DeleteMessagesResponse>;
}

/**
 * Response for `POST /v2/chat/initial-message`.
 *
 * **Example** (Read the greeting)
 *
 * ```ts
 * import { InitialMessageResponse } from "./ChatSession.ts"
 *
 * console.log(InitialMessageResponse.make({ message: "Hello", messageId: "m1" }).message) // "Hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InitialMessageResponse extends Model<InitialMessageResponse>("InitialMessageResponse")(
  {
    message: text("message"),
    messageId: text("message_id"),
  },
  $I.annote("InitialMessageResponse", {
    description: "Generated greeting for a new v2 chat.",
  }),
) {}

/**
 * Encoded form of {@link InitialMessageResponse}.
 *
 * @see {@link InitialMessageResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace InitialMessageResponse {
  export type Encoded = S.Codec.Encoded<typeof InitialMessageResponse>;
}

/**
 * Response for `POST /v2/chat/generate-title`.
 *
 * **Example** (Read the title)
 *
 * ```ts
 * import { GenerateTitleResponse } from "./ChatSession.ts"
 *
 * console.log(GenerateTitleResponse.make({ title: "Standup" }).title) // "Standup"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GenerateTitleResponse extends Model<GenerateTitleResponse>("GenerateTitleResponse")(
  {
    title: text("title"),
  },
  $I.annote("GenerateTitleResponse", {
    description: "Generated title for a v2 chat session.",
  }),
) {}

/**
 * Encoded form of {@link GenerateTitleResponse}.
 *
 * @see {@link GenerateTitleResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GenerateTitleResponse {
  export type Encoded = S.Codec.Encoded<typeof GenerateTitleResponse>;
}
