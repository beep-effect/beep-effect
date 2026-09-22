/**
 * Chat messages, sessions, and the document types a chat file may carry.
 *
 * **Details**
 *
 * A chat session is not a Conversation and not a memory. The legacy session
 * in this module stores message and file ids. The v2 response shape lives in
 * ChatSession.ts.
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
import * as Order from "effect/Order";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { boundedText, optionalBoundedText, optionalText, text, textBoundsCheck, timestamp } from "./Kit.ts";
import { atLeastCheck, boolDefault, isRecord, jsonList, Model, optionDefault, optionalNull, pg } from "./Port.ts";

const $I = $ScratchpadId.create("beep/Chat");

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const formatChatStamp = (instant: DateTime.Utc): string => {
  const parts = DateTime.toPartsUtc(instant);
  const month = months[parts.month - 1] ?? "Jan";
  return `${pad2(parts.day)} ${month} ${parts.year} at ${pad2(parts.hour)}:${pad2(parts.minute)} UTC`;
};

/**
 * Extensions accepted as chat documents, including PDF.
 *
 * **Example** (PDF is a document extension)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { CHAT_FILE_DOCUMENT_EXTENSIONS } from "./Chat.ts"
 *
 * console.log(HashSet.has(CHAT_FILE_DOCUMENT_EXTENSIONS, "pdf")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CHAT_FILE_DOCUMENT_EXTENSIONS = HashSet.fromIterable([
  "pdf",
  "xla",
  "xlb",
  "xlc",
  "xlm",
  "xls",
  "xlsx",
  "xlt",
  "xlw",
  "csv",
  "tsv",
  "iif",
  "doc",
  "docx",
  "dot",
  "odt",
  "rtf",
  "pot",
  "ppa",
  "pps",
  "ppt",
  "pptx",
  "pwz",
  "wiz",
  "asm",
  "bat",
  "c",
  "cc",
  "conf",
  "cpp",
  "css",
  "cxx",
  "def",
  "dic",
  "eml",
  "h",
  "hh",
  "htm",
  "html",
  "ics",
  "ifb",
  "in",
  "js",
  "json",
  "ksh",
  "list",
  "log",
  "markdown",
  "md",
  "mht",
  "mhtml",
  "mime",
  "mjs",
  "nws",
  "pl",
  "py",
  "rst",
  "s",
  "sql",
  "srt",
  "text",
  "txt",
  "vcf",
  "vtt",
  "xml",
  "astro",
  "awk",
  "c++",
  "clj",
  "cmake",
  "cs",
  "dart",
  "diff",
  "dockerfile",
  "ejs",
  "elixir",
  "erb",
  "erlang",
  "go",
  "gradle",
  "graphql",
  "groovy",
  "hbs",
  "hcl",
  "hs",
  "ini",
  "j2",
  "jade",
  "java",
  "jl",
  "json5",
  "jsx",
  "kt",
  "lisp",
  "liquid",
  "lua",
  "m",
  "mk",
  "mustache",
  "ndjson",
  "patch",
  "php",
  "ps1",
  "proto",
  "pug",
  "r",
  "rb",
  "rs",
  "sass",
  "scala",
  "scss",
  "sh",
  "swift",
  "terraform",
  "tf",
  "tex",
  "tmpl",
  "toml",
  "ts",
  "tsx",
  "vbs",
  "yaml",
  "yml",
  "zsh",
]);

/**
 * MIME types accepted as chat documents when the name has no extension.
 *
 * **Example** (PDF MIME is accepted)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { CHAT_FILE_DOCUMENT_MIME_TYPES } from "./Chat.ts"
 *
 * console.log(HashSet.has(CHAT_FILE_DOCUMENT_MIME_TYPES, "application/pdf")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CHAT_FILE_DOCUMENT_MIME_TYPES = HashSet.fromIterable([
  "application/csv",
  "application/graphql",
  "application/javascript",
  "application/json",
  "application/json5",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/toml",
  "application/typescript",
  "application/vnd.apple.iwork",
  "application/vnd.apple.keynote",
  "application/vnd.apple.pages",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-awk",
  "application/x-bash",
  "application/x-graphql",
  "application/x-httpd-php",
  "application/x-httpd-php-source",
  "application/x-iif",
  "application/x-json5",
  "application/x-ndjson",
  "application/x-patch",
  "application/x-php",
  "application/x-powershell",
  "application/x-protobuf",
  "application/x-rust",
  "application/x-scala",
  "application/x-sql",
  "application/x-subrip",
  "application/x-terraform",
  "application/x-toml",
  "application/x-yaml",
  "application/yaml",
  "message/rfc822",
  "text/calendar",
  "text/css",
  "text/csv",
  "text/html",
  "text/javascript",
  "text/jsx",
  "text/markdown",
  "text/plain",
  "text/rtf",
  "text/srt",
  "text/tsv",
  "text/tsx",
  "text/vbscript",
  "text/vtt",
  "text/x-R",
  "text/x-asm",
  "text/x-astro",
  "text/x-awk",
  "text/x-bash",
  "text/x-c",
  "text/x-c++",
  "text/x-clojure",
  "text/x-cmake",
  "text/x-csharp",
  "text/x-dart",
  "text/x-diff",
  "text/x-dockerfile",
  "text/x-ejs",
  "text/x-elixir",
  "text/x-erb",
  "text/x-erlang",
  "text/x-go",
  "text/x-golang",
  "text/x-gradle",
  "text/x-graphql",
  "text/x-groovy",
  "text/x-handlebars",
  "text/x-haskell",
  "text/x-hcl",
  "text/x-iif",
  "text/x-ini",
  "text/x-jade",
  "text/x-java",
  "text/x-jinja2",
  "text/x-julia",
  "text/x-kotlin",
  "text/x-less",
  "text/x-lisp",
  "text/x-liquid",
  "text/x-lua",
  "text/x-makefile",
  "text/x-mustache",
  "text/x-objectivec",
  "text/x-objectivec++",
  "text/x-patch",
  "text/x-perl",
  "text/x-php",
  "text/x-properties",
  "text/x-protobuf",
  "text/x-pug",
  "text/x-python",
  "text/x-r",
  "text/x-rst",
  "text/x-ruby",
  "text/x-rust",
  "text/x-sass",
  "text/x-scala",
  "text/x-script.python",
  "text/x-scss",
  "text/x-sh",
  "text/x-shellscript",
  "text/x-sql",
  "text/x-subrip",
  "text/x-swift",
  "text/x-terraform",
  "text/x-tex",
  "text/x-tmpl",
  "text/x-toml",
  "text/x-twig",
  "text/x-typescript",
  "text/x-vcard",
  "text/x-yaml",
  "text/x-zsh",
  "text/xml",
]);

const fileExtension = (name: string): string => {
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const file = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = file.lastIndexOf(".");
  if (dot <= 0) return "";
  return Str.toLowerCase(file.slice(dot + 1));
};

/**
 * Lowercases a MIME type. Missing values and the strings `none` and `null` are empty.
 *
 * **Example** (Treat the string None as missing)
 *
 * ```ts
 * import { chatFileNormalizedMime } from "./Chat.ts"
 *
 * console.log(chatFileNormalizedMime("None")) // ""
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const chatFileNormalizedMime = (mimeType: string | null): string => {
  if (mimeType === null) return "";
  const mime = Str.toLowerCase(Str.trim(mimeType));
  if (mime === "" || mime === "none" || mime === "null") return "";
  return mime;
};

/**
 * True when a chat file is an allowlisted document, including PDF.
 *
 * **Details**
 *
 * Images are not in the allowlist. A present extension wins. MIME is the
 * fallback, so a missing MIME neither admits nor rejects by itself.
 *
 * **Example** (Prefer the extension)
 *
 * ```ts
 * import { chatFileIsDocument } from "./Chat.ts"
 *
 * console.log(chatFileIsDocument("notes.pdf", null)) // true
 * console.log(chatFileIsDocument("photo.png", "image/png")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Name and MIME type are co-primary inputs, and neither is a pipeable value.
export const chatFileIsDocument = (name: string, mimeType: string | null): boolean => {
  const ext = fileExtension(name);
  if (ext.length > 0) return HashSet.has(CHAT_FILE_DOCUMENT_EXTENSIONS, ext);
  const mime = chatFileNormalizedMime(mimeType);
  return mime.length > 0 && HashSet.has(CHAT_FILE_DOCUMENT_MIME_TYPES, mime);
};

/**
 * Who sent a chat message.
 *
 * **Example** (Decode a human sender)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MessageSender } from "./Chat.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(MessageSender)("human"))) // "human"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MessageSender = LiteralKit(["ai", "human"]).pipe(
  $I.annoteSchema("MessageSender", { description: "Chat message sender: ai or human." }),
);

export type MessageSender = typeof MessageSender.Type;

/**
 * Chat message body kind.
 *
 * **Example** (Decode a day summary)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MessageType } from "./Chat.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(MessageType)("day_summary"))) // "day_summary"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MessageType = LiteralKit(["text", "day_summary"]).pipe(
  $I.annoteSchema("MessageType", { description: "Chat message type: text or day_summary." }),
);

export type MessageType = typeof MessageType.Type;

const FeedbackReason = LiteralKit([
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
]);

/**
 * Title and emoji shown for a conversation linked from chat.
 *
 * **Example** (Read the title)
 *
 * ```ts
 * import { MessageConversationStructured } from "./Chat.ts"
 *
 * console.log(MessageConversationStructured.make({ title: "Standup", emoji: "🧠" }).title) // "Standup"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MessageConversationStructured extends Model<MessageConversationStructured>(
  "MessageConversationStructured",
)(
  { title: text("title"), emoji: text("emoji") },
  $I.annote("MessageConversationStructured", { description: "Title and emoji of a conversation linked from chat." }),
) {}

export declare namespace MessageConversationStructured {
  export type Encoded = S.Codec.Encoded<typeof MessageConversationStructured>;
}

/**
 * Conversation card embedded in a chat message.
 *
 * **Example** (Read the id)
 *
 * ```ts
 * import { MessageConversation, MessageConversationStructured } from "./Chat.ts"
 *
 * const card = MessageConversation.make({
 *   id: "c1",
 *   structured: MessageConversationStructured.make({ title: "Standup", emoji: "🧠" }),
 *   createdAt: "2020-01-02T03:04:05.000Z",
 * })
 * console.log(card.id) // "c1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MessageConversation extends Model<MessageConversation>("MessageConversation")(
  {
    id: text("id"),
    structured: MessageConversationStructured.pipe(pg.jsonb(), pg.columnName("structured")),
    createdAt: timestamp("created_at"),
  },
  $I.annote("MessageConversation", { description: "Conversation card embedded in a chat message." }),
) {}

export declare namespace MessageConversation {
  export type Encoded = S.Codec.Encoded<typeof MessageConversation>;
}

/**
 * File attached to a chat message.
 *
 * **Example** (Treat a PDF as a document)
 *
 * ```ts
 * import { FileChat, fileChatIsDocumentMessage } from "./Chat.ts"
 *
 * const file = FileChat.make({
 *   id: "f1",
 *   name: "notes.pdf",
 *   mimeType: "application/pdf",
 *   openaiFileId: "file-1",
 *   createdAt: "2020-01-02T03:04:05.000Z",
 * })
 * console.log(fileChatIsDocumentMessage(file)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileChat extends Model<FileChat>("FileChat")(
  {
    id: text("id"),
    name: text("name"),
    thumbnail: optionDefault(S.String, () => ""),
    mimeType: text("mime_type"),
    openaiFileId: text("openai_file_id"),
    createdAt: timestamp("created_at"),
    thumbName: optionDefault(S.String, () => ""),
  },
  $I.annote("FileChat", { description: "File attached to a chat message. thumb_name is omitted from the dump." }),
) {}

export declare namespace FileChat {
  export type Encoded = S.Codec.Encoded<typeof FileChat>;
}

/**
 * True when the file MIME starts with `image`.
 *
 * **Example** (Detect an image)
 *
 * ```ts
 * import { FileChat, fileChatIsImage } from "./Chat.ts"
 *
 * const file = FileChat.make({
 *   id: "f1",
 *   name: "a.png",
 *   mimeType: "image/png",
 *   openaiFileId: "file-1",
 *   createdAt: "2020-01-02T03:04:05.000Z",
 * })
 * console.log(fileChatIsImage(file)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const fileChatIsImage = (file: FileChat): boolean => Str.startsWith("image")(file.mimeType);

/**
 * True when the file is an allowlisted document.
 *
 * **Example** (Reject an image)
 *
 * ```ts
 * import { FileChat, fileChatIsDocumentMessage } from "./Chat.ts"
 *
 * const file = FileChat.make({
 *   id: "f1",
 *   name: "a.png",
 *   mimeType: "image/png",
 *   openaiFileId: "file-1",
 *   createdAt: "2020-01-02T03:04:05.000Z",
 * })
 * console.log(fileChatIsDocumentMessage(file)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const fileChatIsDocumentMessage = (file: FileChat): boolean => chatFileIsDocument(file.name, file.mimeType);

/**
 * Encoded file payload without `thumb_name`.
 *
 * **Details**
 *
 * Python `model_dump` always excludes `thumb_name`.
 *
 * **Example** (Omit the thumb name)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { FileChat, fileChatPayload } from "./Chat.ts"
 *
 * const payload = Effect.runSync(
 *   fileChatPayload(
 *     FileChat.make({
 *       id: "f1",
 *       name: "notes.pdf",
 *       mimeType: "application/pdf",
 *       openaiFileId: "file-1",
 *       createdAt: "2020-01-02T03:04:05.000Z",
 *       thumbName: O.some("thumb"),
 *     }),
 *   ),
 * )
 * console.log("thumb_name" in payload) // false
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const fileChatPayload = (file: FileChat) => ({
  id: file.id,
  name: file.name,
  thumbnail: O.getOrNull(file.thumbnail),
  mime_type: file.mimeType,
  openai_file_id: file.openaiFileId,
  created_at: DateTime.formatIso(file.createdAt),
});

export class ChartDataPoint extends Model<ChartDataPoint>("ChartDataPoint")(
  { label: text("label"), value: S.Finite.pipe(pg.doublePrecision(), pg.columnName("value")) },
  $I.annote("ChartDataPoint", { description: "One point on a chat chart." }),
) {}

export declare namespace ChartDataPoint {
  export type Encoded = S.Codec.Encoded<typeof ChartDataPoint>;
}

export class ChartDataset extends Model<ChartDataset>("ChartDataset")(
  {
    label: text("label"),
    dataPoints: jsonList(ChartDataPoint, "data_points"),
    color: optionalText("color"),
  },
  $I.annote("ChartDataset", { description: "Named series on a chat chart." }),
) {}

export declare namespace ChartDataset {
  export type Encoded = S.Codec.Encoded<typeof ChartDataset>;
}

/**
 * Inline chart on a chat answer.
 *
 * **Example** (Read the chart type)
 *
 * ```ts
 * import { ChartData, ChartDataset, ChartDataPoint } from "./Chat.ts"
 *
 * const chart = ChartData.make({
 *   chartType: "bar",
 *   title: "Hours",
 *   datasets: [ChartDataset.make({ label: "Focus", dataPoints: [ChartDataPoint.make({ label: "Mon", value: 1 })] })],
 * })
 * console.log(chart.chartType) // "bar"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChartData extends Model<ChartData>("ChartData")(
  {
    chartType: LiteralKit(["line", "bar"]).pipe(pg.text(), pg.columnName("chart_type")),
    title: text("title"),
    xLabel: optionalText("x_label"),
    yLabel: optionalText("y_label"),
    datasets: jsonList(ChartDataset, "datasets"),
  },
  $I.annote("ChartData", { description: "Inline line or bar chart attached to a chat answer." }),
) {}

export declare namespace ChartData {
  export type Encoded = S.Codec.Encoded<typeof ChartData>;
}

const evidenceKinds = HashSet.fromIterable([
  "conversation_summary",
  "conversation_segment",
  "screen",
  "keyframe",
  "request",
]);
const evidenceStates = HashSet.fromIterable(["available", "loading", "offline", "pruned", "failed"]);

/**
 * Normalizes an evidence id. Blank text is invalid.
 *
 * **Example** (Strip an id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { readEvidenceId } from "./Chat.ts"
 *
 * console.log(O.getOrElse(readEvidenceId("  ev-1  "), () => "")) // "ev-1"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const readEvidenceId = (value: string): O.Option<string> => {
  const stripped = Str.trim(value);
  return stripped.length === 0 ? O.none() : O.some(stripped);
};

/**
 * Maps an unknown evidence kind to `unknown`.
 *
 * **Example** (Collapse a future kind)
 *
 * ```ts
 * import { readEvidenceKind } from "./Chat.ts"
 *
 * console.log(readEvidenceKind(" future ")) // "unknown"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const readEvidenceKind = (value: string): string => {
  const normalized = Str.toLowerCase(Str.trim(value));
  return HashSet.has(evidenceKinds, normalized) ? normalized : "unknown";
};

/**
 * Maps an unknown evidence state to `unknown`.
 *
 * **Example** (Keep available)
 *
 * ```ts
 * import { readEvidenceState } from "./Chat.ts"
 *
 * console.log(readEvidenceState(" Available ")) // "available"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const readEvidenceState = (value: string): string => {
  const normalized = Str.toLowerCase(Str.trim(value));
  return HashSet.has(evidenceStates, normalized) ? normalized : "unknown";
};

const normalizedToken = (fallback: (value: string) => string) =>
  S.String.pipe(
    S.decodeTo(S.String, {
      decode: SchemaGetter.transform((value) => fallback(value)),
      encode: SchemaGetter.transform((value) => value),
    }),
  );

const optionalStrippedField = (column: string, maxLength: number) =>
  optionalNull(S.String.check(S.isMaxLength(maxLength))).pipe(pg.text(), pg.columnName(column));

/**
 * One optional source reference on a chat answer.
 *
 * **Details**
 *
 * The answer text stays authoritative. An unknown kind or state becomes
 * `unknown`. Blank optional strings become `None`. Identity rules are on
 * {@link ChatEvidenceReferenceChecked}.
 *
 * **Example** (Collapse an unknown kind)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatEvidenceReference } from "./Chat.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ChatEvidenceReference)({ id: " ev ", kind: "future", state: "nope" }),
 * )
 * console.log(decoded.kind) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatEvidenceReference extends Model<ChatEvidenceReference>("ChatEvidenceReference")(
  {
    id: normalizedToken((value) => O.getOrElse(readEvidenceId(value), () => value)).pipe(
      pg.text(),
      pg.columnName("id"),
    ),
    kind: normalizedToken(readEvidenceKind).pipe(pg.text(), pg.columnName("kind")),
    state: normalizedToken(readEvidenceState).pipe(pg.text(), pg.columnName("state")),
    title: optionalStrippedField("title", 160),
    summary: optionalStrippedField("summary", 600),
    conversationId: optionalStrippedField("conversation_id", 256),
    segmentId: optionalStrippedField("segment_id", 256),
    frameId: optionalStrippedField("frame_id", 256),
    requestId: optionalStrippedField("request_id", 256),
    startMs: optionalNull(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(pg.integer(), pg.columnName("start_ms")),
    endMs: optionalNull(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(pg.integer(), pg.columnName("end_ms")),
    capturedAtMs: optionalNull(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(
      pg.integer(),
      pg.columnName("captured_at_ms"),
    ),
    errorCode: optionalStrippedField("error_code", 128),
    errorMessage: optionalStrippedField("error_message", 600),
    metadata: S.JsonObject.pipe(
      S.withConstructorDefault(Effect.sync(() => ({}))),
      pg.jsonb(),
      pg.columnName("metadata"),
    ),
  },
  $I.annote("ChatEvidenceReference", {
    description: "Optional source reference on a chat answer. Unknown kind and state become unknown.",
  }),
  (columns) => [
    textBoundsCheck("id", { minLength: 1, maxLength: 256 })(columns.id),
    textBoundsCheck("title", { maxLength: 160 })(columns.title),
    textBoundsCheck("summary", { maxLength: 600 })(columns.summary),
    atLeastCheck("start_ms", 0)(columns.startMs),
    atLeastCheck("end_ms", 0)(columns.endMs),
    atLeastCheck("captured_at_ms", 0)(columns.capturedAtMs),
  ],
) {}

export declare namespace ChatEvidenceReference {
  export type Encoded = S.Codec.Encoded<typeof ChatEvidenceReference>;
}

const jsonSize = (value: S.JsonObject): number => JSON.stringify(value).length;

/**
 * Identity rules for one evidence reference.
 *
 * **Example** (Require a frame id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ChatEvidenceReference, evidenceReferenceIssue } from "./Chat.ts"
 *
 * const issue = evidenceReferenceIssue(
 *   ChatEvidenceReference.make({ id: "ev", kind: "screen", state: "available" }),
 * )
 * console.log(O.isSome(issue)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const evidenceReferenceIssue = (reference: ChatEvidenceReference): O.Option<string> => {
  if (O.isNone(readEvidenceId(reference.id))) return O.some("evidence id must not be blank");
  if (HashSet.size(HashSet.fromIterable(Object.keys(reference.metadata))) > 16 || jsonSize(reference.metadata) > 2000) {
    return O.some("evidence metadata exceeds the bounded transport limit");
  }
  if (O.isSome(reference.endMs) && O.isSome(reference.startMs) && reference.endMs.value < reference.startMs.value) {
    return O.some("end_ms must be greater than or equal to start_ms");
  }
  if (reference.kind === "conversation_summary" && O.isNone(reference.conversationId)) {
    return O.some("conversation_summary requires conversation_id");
  }
  if (reference.kind === "conversation_segment" && (O.isNone(reference.conversationId) || O.isNone(reference.segmentId))) {
    return O.some("conversation_segment requires conversation_id and segment_id");
  }
  if ((reference.kind === "screen" || reference.kind === "keyframe") && O.isNone(reference.frameId)) {
    return O.some(`${reference.kind} requires frame_id`);
  }
  if (reference.kind === "request" && O.isNone(reference.requestId)) return O.some("request requires request_id");
  return O.none();
};

export const ChatEvidenceReferenceChecked = ChatEvidenceReference.check(
  S.makeFilter((reference: ChatEvidenceReference) => {
    const issue = evidenceReferenceIssue(reference);
    return O.isSome(issue) ? issue.value : undefined;
  }),
);

/**
 * Versioned envelope of evidence references.
 *
 * **Details**
 *
 * `schemaVersion` is 1 through 2147483647 and constructs as 1. Duplicate
 * reference ids fail {@link ChatEvidenceEnvelopeChecked}. A version other than
 * 1 rewrites every reference kind and state to `unknown`.
 *
 * **Example** (Construct version 1)
 *
 * ```ts
 * import { ChatEvidenceEnvelope } from "./Chat.ts"
 *
 * console.log(ChatEvidenceEnvelope.make({}).schemaVersion) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatEvidenceEnvelope extends Model<ChatEvidenceEnvelope>("ChatEvidenceEnvelope")(
  {
    schemaVersion: S.Int.check(S.isBetween({ minimum: 1, maximum: 2147483647 })).pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      pg.integer(),
      pg.columnName("schema_version"),
    ),
    requestId: optionalStrippedField("request_id", 256),
    references: S.Array(ChatEvidenceReference)
      .check(S.isMaxLength(24))
      .pipe(S.withConstructorDefault(Effect.sync(() => [])), pg.jsonb(), pg.columnName("references")),
  },
  $I.annote("ChatEvidenceEnvelope", { description: "Versioned transport envelope for chat evidence references." }),
) {}

export declare namespace ChatEvidenceEnvelope {
  export type Encoded = S.Codec.Encoded<typeof ChatEvidenceEnvelope>;
}

/**
 * Rewrites references when the envelope version is not 1, and rejects duplicate ids.
 *
 * **Example** (Reject a duplicate id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ChatEvidenceEnvelope, ChatEvidenceReference, evidenceEnvelopeIssue } from "./Chat.ts"
 *
 * const reference = ChatEvidenceReference.make({ id: "ev", kind: "unknown", state: "unknown" })
 * const issue = evidenceEnvelopeIssue(ChatEvidenceEnvelope.make({ references: [reference, reference] }))
 * console.log(O.isSome(issue)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const evidenceEnvelopeIssue = (envelope: ChatEvidenceEnvelope): O.Option<string> => {
  const ids = envelope.references.map((reference) => reference.id);
  if (HashSet.size(HashSet.fromIterable(ids)) !== ids.length) return O.some("evidence reference ids must be unique");
  return O.none();
};

/**
 * Applies the non-v1 kind/state rewrite and returns the issue for duplicate ids.
 *
 * **Example** (Rewrite a future version)
 *
 * ```ts
 * import { ChatEvidenceEnvelope, ChatEvidenceReference, settleEvidenceEnvelope } from "./Chat.ts"
 *
 * const settled = settleEvidenceEnvelope(
 *   ChatEvidenceEnvelope.make({
 *     schemaVersion: 2,
 *     references: [ChatEvidenceReference.make({ id: "ev", kind: "screen", state: "available" })],
 *   }),
 * )
 * console.log(settled.references[0]?.kind) // "unknown"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const settleEvidenceEnvelope = (envelope: ChatEvidenceEnvelope): ChatEvidenceEnvelope => {
  if (envelope.schemaVersion === 1) return envelope;
  return ChatEvidenceEnvelope.make({
    ...envelope,
    references: envelope.references.map((reference) =>
      ChatEvidenceReference.make({ ...reference, kind: "unknown", state: "unknown" }),
    ),
  });
};

export const ChatEvidenceEnvelopeChecked = ChatEvidenceEnvelope.check(
  S.makeFilter((envelope: ChatEvidenceEnvelope) => {
    const issue = evidenceEnvelopeIssue(envelope);
    return O.isSome(issue) ? issue.value : undefined;
  }),
);

const ChartOrObject = S.Union([ChartData, S.JsonObject]);

/**
 * One chat message.
 *
 * **Details**
 *
 * `appId` wins over `pluginId` when both are present. Legacy
 * `metadata.content_blocks` fills `contentBlocks` when that key is absent.
 * Decode those repairs with {@link decodeMessage}.
 *
 * **Example** (Read the text)
 *
 * ```ts
 * import { Message } from "./Chat.ts"
 *
 * const message = Message.make({
 *   id: "m1",
 *   text: "Hello",
 *   createdAt: "2020-01-02T03:04:05.000Z",
 *   sender: "human",
 *   type: "text",
 * })
 * console.log(message.text) // "Hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Message extends Model<Message>("Message")(
  {
    id: text("id"),
    text: text("text"),
    createdAt: timestamp("created_at"),
    sender: MessageSender.pipe(pg.text(), pg.columnName("sender")),
    appId: optionalText("app_id"),
    pluginId: optionalText("plugin_id"),
    fromExternalIntegration: boolDefault("from_external_integration", false),
    type: MessageType.pipe(pg.text(), pg.columnName("type")),
    memoriesId: jsonList(S.String, "memories_id"),
    memories: jsonList(MessageConversation, "memories"),
    reported: boolDefault("reported", false),
    reportReason: optionalText("report_reason"),
    filesId: jsonList(S.String, "files_id"),
    files: jsonList(FileChat, "files"),
    chatSessionId: optionalText("chat_session_id"),
    sessionId: optionalText("session_id"),
    dataProtectionLevel: optionalText("data_protection_level"),
    langsmithRunId: optionalText("langsmith_run_id"),
    promptName: optionalText("prompt_name"),
    promptCommit: optionalText("prompt_commit"),
    rating: optionalNull(S.Int).pipe(pg.integer(), pg.columnName("rating")),
    metadata: optionalText("metadata"),
    contentBlocks: S.Array(S.JsonObject).pipe(
      S.withConstructorDefault(Effect.sync(() => [])),
      pg.jsonb(),
      pg.columnName("content_blocks"),
    ),
    evidence: optionalNull(ChatEvidenceEnvelope).pipe(pg.jsonb(), pg.columnName("evidence")),
    clientMessageId: optionalText("client_message_id"),
    messageSource: optionalText("message_source"),
    journalRevision: optionalNull(S.Int).pipe(pg.integer(), pg.columnName("journal_revision")),
    chartData: optionalNull(ChartOrObject).pipe(pg.jsonb(), pg.columnName("chart_data")),
  },
  $I.annote("Message", {
    description: "Chat message. app_id and plugin_id mirror each other. Not a Conversation.",
  }),
) {}

export declare namespace Message {
  export type Encoded = S.Codec.Encoded<typeof Message>;
}

/**
 * Copies app and plugin ids and lifts legacy content blocks before decode.
 *
 * **Example** (Mirror a plugin id)
 *
 * ```ts
 * import { repairMessageRecord } from "./Chat.ts"
 *
 * const repaired = repairMessageRecord({ plugin_id: "app-1" })
 * console.log(repaired && typeof repaired === "object" && "app_id" in repaired && repaired.app_id) // "app-1"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
const camelKey = (key: string): string =>
  key.replace(/_([a-z])/g, (_all, letter: string) => letter.toUpperCase());

const camelizeTop = (input: unknown): unknown => {
  if (!isRecord(input)) return input;
  const out: { [key: string]: unknown } = {};
  for (const key of Object.keys(input)) out[camelKey(key)] = input[key];
  return out;
};

export const repairMessageRecord = (input: unknown): unknown => {
  if (!isRecord(input)) return input;
  const data: { [key: string]: unknown } = { ...input };
  const appId = data.app_id ?? data.appId;
  const pluginId = data.plugin_id ?? data.pluginId;
  if (appId != null) {
    data.plugin_id = appId;
    data.pluginId = appId;
  } else if (pluginId != null) {
    data.app_id = pluginId;
    data.appId = pluginId;
  }
  const hasBlocks = Object.hasOwn(data, "content_blocks") || Object.hasOwn(data, "contentBlocks");
  if (!hasBlocks) {
    const metadata = data.metadata;
    if (typeof metadata === "string") {
      try {
        const parsed: unknown = JSON.parse(metadata);
        if (isRecord(parsed) && Array.isArray(parsed.content_blocks)) data.contentBlocks = parsed.content_blocks;
      } catch {
        // Legacy metadata that is not JSON stays a string.
      }
    }
  }
  return data;
};

/**
 * Decodes a message after the legacy app/plugin and content-block repair.
 *
 * **Example** (Lift legacy content blocks)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeMessage } from "./Chat.ts"
 *
 * const decoded = Effect.runSync(
 *   decodeMessage({
 *     id: "m1",
 *     text: "Hello",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     sender: "ai",
 *     type: "text",
 *     metadata: "{\"content_blocks\":[{\"type\":\"text\"}]}",
 *   }),
 * )
 * console.log(decoded.contentBlocks.length) // 1
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeMessage = (input: unknown) =>
  S.decodeUnknownEffect(Message)(repairMessageRecord(camelizeTop(input)));

/**
 * Builds messages from stored records, skipping records that fail.
 *
 * **Details**
 *
 * One malformed record must not fail the whole history. `onError` is called
 * for each skip when supplied.
 *
 * **Example** (Skip a broken record)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { deserializeManySafe } from "./Chat.ts"
 *
 * const messages = Effect.runSync(deserializeManySafe([{ id: "bad" }, {
 *   id: "m1",
 *   text: "Hello",
 *   created_at: "2020-01-02T03:04:05.000Z",
 *   sender: "human",
 *   type: "text",
 * }]))
 * console.log(messages.length) // 1
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Records and the error callback are co-primary inputs, and neither is a pipeable value.
export const deserializeManySafe = (
  records: ReadonlyArray<unknown>,
  onError?: (record: unknown) => void,
): ReadonlyArray<Message> => {
  const parsed: Array<Message> = [];
  for (const record of records) {
    const exit = Effect.runSyncExit(decodeMessage(record));
    if (exit._tag === "Success") parsed.push(exit.value);
    else if (onError !== undefined) onError(record);
  }
  return parsed;
};

/**
 * Resolves an app display name. The resolver is supplied by the caller.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AppNameResolver = (appId: string) => O.Option<string>;

const resolveSenderName = (
  message: Message,
  usePluginName: boolean,
  names: { [key: string]: string | null },
  resolver: AppNameResolver | undefined,
): string => {
  if (message.sender === "human") return "User";
  const appId = O.match(message.appId, { onNone: () => "", onSome: Str.trim });
  if (usePluginName && resolver !== undefined && appId.length > 0) {
    const cached = Object.hasOwn(names, appId) ? names[appId] : undefined;
    const resolved =
      cached !== undefined
        ? cached
        : O.match(resolver(appId), {
            onNone: () => null,
            onSome: (name) => {
              const trimmed = Str.trim(name);
              return trimmed.length === 0 ? null : trimmed;
            },
          });
    names[appId] = resolved;
    if (resolved !== null) return resolved;
  }
  return Str.toUpperCase(message.sender);
};

/**
 * Renders messages oldest-first as one transcript string.
 *
 * **Details**
 *
 * `useUserNameIfAvailable` is accepted and ignored, matching the Python
 * parameter that does not change the sender label. Human senders are `User`.
 * AI senders are `AI` unless a plugin name resolves.
 *
 * **Example** (Render a human turn)
 *
 * ```ts
 * import { Message, messagesAsString } from "./Chat.ts"
 *
 * const text = messagesAsString([
 *   Message.make({
 *     id: "m1",
 *     text: "Hello",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     sender: "human",
 *     type: "text",
 *   }),
 * ])
 * console.log(text.includes("User: Hello")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Messages and formatting flags are co-primary inputs, and neither is a pipeable value.
export const messagesAsString = (
  messages: ReadonlyArray<Message>,
  useUserNameIfAvailable = false,
  usePluginName = false,
  includeFileInfo = false,
  resolver?: AppNameResolver,
): string => {
  void useUserNameIfAvailable;
  const names: { [key: string]: string | null } = {};
  const sorted = Arr.sort(messages, Order.mapInput(DateTime.Order, (message: Message) => message.createdAt));
  return sorted
    .map((message) => {
      const sender = resolveSenderName(message, usePluginName, names, resolver);
      let line = `(${formatChatStamp(message.createdAt)}) ${sender}: ${message.text}`;
      if (includeFileInfo && message.filesId.length > 0) {
        line = `${line} [Files attached: ${message.filesId.length} file(s), IDs: ${message.filesId.join(", ")}]`;
      }
      return line;
    })
    .join("\n");
};

/**
 * Renders messages as XML history for a model prompt.
 *
 * **Details**
 *
 * Only the surrounding whitespace of each message block is stripped. Message
 * text is not unindented.
 *
 * **Example** (Include the sender)
 *
 * ```ts
 * import { Message, messagesAsXml } from "./Chat.ts"
 *
 * const xml = messagesAsXml([
 *   Message.make({
 *     id: "m1",
 *     text: "Hello",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     sender: "ai",
 *     type: "text",
 *   }),
 * ])
 * console.log(xml.includes("<sender>AI</sender>")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Messages and formatting flags are co-primary inputs, and neither is a pipeable value.
export const messagesAsXml = (
  messages: ReadonlyArray<Message>,
  useUserNameIfAvailable = false,
  usePluginName = false,
  includeFileInfo = false,
  resolver?: AppNameResolver,
): string => {
  void useUserNameIfAvailable;
  const names: { [key: string]: string | null } = {};
  const sorted = Arr.sort(messages, Order.mapInput(DateTime.Order, (message: Message) => message.createdAt));
  return sorted
    .map((message) => {
      let fileSection = "";
      if (includeFileInfo && message.files.length > 0) {
        const rows = message.files.map((file) => `  <file id="${file.id}" name="${file.name}" type="${file.mimeType}"/>`);
        fileSection = `<attachments>\n${rows.join("\n")}\n</attachments>`;
      } else if (includeFileInfo && message.filesId.length > 0) {
        fileSection = `<attachments>\n${message.filesId.map((id) => `  <file id="${id}"/>`).join("\n")}\n</attachments>`;
      } else if (message.files.length > 0) {
        fileSection = `<attachments>${message.files.map((file) => `<file>${file.name}</file>`).join("")}</attachments>`;
      }
      return `<message>
<created_at>${formatChatStamp(message.createdAt)}</created_at>
<sender>${resolveSenderName(message, usePluginName, names, resolver)}</sender>
<content>${message.text}</content>
${fileSection}
</message>`.trim();
    })
    .join("\n");
};

/**
 * Message plus the optional NPS prompt flag.
 *
 * **Example** (Default the flag to false)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ResponseMessage } from "./Chat.ts"
 *
 * const message = ResponseMessage.make({
 *   id: "m1",
 *   text: "Hello",
 *   createdAt: "2020-01-02T03:04:05.000Z",
 *   sender: "ai",
 *   type: "text",
 * })
 * console.log(O.getOrElse(message.askForNps, () => true)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResponseMessage extends Model<ResponseMessage>("ResponseMessage")(
  {
    ...Message.fields,
    askForNps: optionDefault(S.Boolean, () => false).pipe(pg.boolean(), pg.columnName("ask_for_nps")),
  },
  $I.annote("ResponseMessage", { description: "Chat message response that may ask for an NPS rating." }),
) {}

export declare namespace ResponseMessage {
  export type Encoded = S.Codec.Encoded<typeof ResponseMessage>;
}

const awareScopeDate = S.NullOr(S.String).pipe(
  S.decodeTo(S.Option(S.String), {
    decode: SchemaGetter.transformOptional((present) =>
      present.pipe(
        O.match({
          onNone: () => O.some(O.none()),
          onSome: (value) => {
            if (value === null) return O.some(O.none());
            const stripped = Str.trim(value);
            if (stripped.length === 0) return O.some(O.none());
            const parsed = DateTime.make(stripped.split("Z").join("+00:00"));
            if (O.isNone(parsed) || !Str.includes("T")(stripped) || (!Str.includes("Z")(stripped) && !Str.includes("+")(stripped) && !Str.includes("-")(stripped.slice(10)))) {
              return O.none();
            }
            return O.some(O.some(stripped));
          },
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
  S.withConstructorDefault(Effect.sync(() => O.none<string>())),
);

/**
 * What the user is looking at while chatting.
 *
 * **Details**
 *
 * `conversation` with an id, or a start/end date, hard-scopes retrieval.
 * Dates must include a timezone offset. A blank date becomes `None`.
 *
 * **Example** (Decode a conversation page)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PageContext } from "./Chat.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(PageContext)({ type: "conversation", id: "c1" }))
 * console.log(decoded.type) // "conversation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageContext extends Model<PageContext>("PageContext")(
  {
    type: LiteralKit(["conversation", "task", "memory", "recap"]).pipe(pg.text(), pg.columnName("type")),
    id: optionalText("id"),
    title: optionalText("title"),
    startDate: awareScopeDate.pipe(pg.text(), pg.columnName("start_date")),
    endDate: awareScopeDate.pipe(pg.text(), pg.columnName("end_date")),
  },
  $I.annote("PageContext", { description: "Page the user is viewing. Scope dates must include a timezone offset." }),
) {}

export declare namespace PageContext {
  export type Encoded = S.Codec.Encoded<typeof PageContext>;
}

/**
 * Request to send one chat message.
 *
 * **Example** (Send text)
 *
 * ```ts
 * import { SendMessageRequest } from "./Chat.ts"
 *
 * console.log(SendMessageRequest.make({ text: "Hello" }).text) // "Hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SendMessageRequest extends Model<SendMessageRequest>("SendMessageRequest")(
  {
    text: text("text"),
    fileIds: jsonList(S.String, "file_ids"),
    context: optionalNull(PageContext).pipe(pg.jsonb(), pg.columnName("context")),
    timeZone: optionalNull(
      S.String.pipe(
        S.decodeTo(S.String, {
          decode: SchemaGetter.transformEffect((value, options) => {
            const stripped = Str.trim(value);
            if (stripped.length === 0) {
              return Effect.fail(new SchemaIssue.InvalidValue({ message: "time_zone must be a valid IANA timezone" }, value, options));
            }
            if (O.isNone(DateTime.zoneFromString(stripped))) {
              return Effect.fail(new SchemaIssue.InvalidValue({ message: "time_zone must be a valid IANA timezone" }, value, options));
            }
            return Effect.succeed(stripped);
          }),
          encode: SchemaGetter.transform((value) => value),
        }),
      ),
    ).pipe(pg.text(), pg.columnName("time_zone")),
  },
  $I.annote("SendMessageRequest", { description: "Request to send one chat message." }),
) {}

export declare namespace SendMessageRequest {
  export type Encoded = S.Codec.Encoded<typeof SendMessageRequest>;
}

export class GenerateReplyTurn extends Model<GenerateReplyTurn>("GenerateReplyTurn")(
  {
    text: boundedText("text", { minLength: 1, maxLength: 100000 }),
    sender: MessageSender.pipe(pg.text(), pg.columnName("sender")),
  },
  $I.annote("GenerateReplyTurn", { description: "Prior turn supplied as generation context." }),
  (columns) => [textBoundsCheck("text", { minLength: 1, maxLength: 100000 })(columns.text)],
) {}

export declare namespace GenerateReplyTurn {
  export type Encoded = S.Codec.Encoded<typeof GenerateReplyTurn>;
}

export class GenerateReplyRequest extends Model<GenerateReplyRequest>("GenerateReplyRequest")(
  {
    text: boundedText("text", { minLength: 1, maxLength: 100000 }),
    history: S.Array(GenerateReplyTurn)
      .check(S.isMaxLength(50))
      .pipe(S.withConstructorDefault(Effect.sync(() => [])), pg.jsonb(), pg.columnName("history")),
    appId: optionalBoundedText("app_id", { maxLength: 200 }),
  },
  $I.annote("GenerateReplyRequest", { description: "Request to generate a reply from text and prior turns." }),
  (columns) => [textBoundsCheck("text", { minLength: 1, maxLength: 100000 })(columns.text)],
) {}

export declare namespace GenerateReplyRequest {
  export type Encoded = S.Codec.Encoded<typeof GenerateReplyRequest>;
}

export class GenerateReplyResponse extends Model<GenerateReplyResponse>("GenerateReplyResponse")(
  { text: text("text"), appId: optionalText("app_id") },
  $I.annote("GenerateReplyResponse", { description: "Generated chat reply." }),
) {}

export declare namespace GenerateReplyResponse {
  export type Encoded = S.Codec.Encoded<typeof GenerateReplyResponse>;
}

/**
 * Thumbs rating for a message. A missing reason means the reason was not captured.
 *
 * **Example** (Omit the reason)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { RateMessageRequest } from "./Chat.ts"
 *
 * console.log(O.isNone(RateMessageRequest.make({}).reason)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RateMessageRequest extends Model<RateMessageRequest>("RateMessageRequest")(
  {
    rating: optionalNull(S.Int).pipe(pg.integer(), pg.columnName("rating")),
    reason: optionalNull(FeedbackReason).pipe(pg.text(), pg.columnName("reason")),
    comment: optionalBoundedText("comment", { maxLength: 1000 }),
  },
  $I.annote("RateMessageRequest", {
    description: "Message rating. A missing thumbs-down reason means the reason was not captured.",
  }),
  (columns) => [textBoundsCheck("comment", { maxLength: 1000 })(columns.comment)],
) {}

export declare namespace RateMessageRequest {
  export type Encoded = S.Codec.Encoded<typeof RateMessageRequest>;
}

export class ShareChatMessagesRequest extends Model<ShareChatMessagesRequest>("ShareChatMessagesRequest")(
  { messageIds: jsonList(S.String, "message_ids") },
  $I.annote("ShareChatMessagesRequest", { description: "Ids of chat messages to share." }),
) {}

export declare namespace ShareChatMessagesRequest {
  export type Encoded = S.Codec.Encoded<typeof ShareChatMessagesRequest>;
}

/**
 * Legacy v1 chat session: message ids and file ids, not the v2 title/preview shape.
 *
 * **Example** (Add a file id once)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ChatSession, addFileIds } from "./Chat.ts"
 *
 * const session = addFileIds(
 *   ChatSession.make({ id: "s1", createdAt: "2020-01-02T03:04:05.000Z" }),
 *   ["f1", "f1"],
 * )
 * console.log(session.fileIds.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatSession extends Model<ChatSession>("ChatSession")(
  {
    id: text("id"),
    messageIds: jsonList(S.String, "message_ids"),
    fileIds: jsonList(S.String, "file_ids"),
    appId: optionalText("app_id"),
    pluginId: optionalText("plugin_id"),
    createdAt: timestamp("created_at"),
    openaiThreadId: optionalText("openai_thread_id"),
    openaiAssistantId: optionalText("openai_assistant_id"),
  },
  $I.annote("ChatSession", {
    description: "Legacy v1 chat session. Not the v2 ChatSessionResponse and not a Conversation.",
  }),
) {}

export declare namespace ChatSession {
  export type Encoded = S.Codec.Encoded<typeof ChatSession>;
}

/**
 * Mirrors app and plugin ids on a legacy session before decode.
 *
 * **Example** (Copy app_id)
 *
 * ```ts
 * import { repairLegacyChatSessionRecord } from "./Chat.ts"
 *
 * const repaired = repairLegacyChatSessionRecord({ app_id: "app-1" })
 * console.log(repaired && typeof repaired === "object" && "plugin_id" in repaired && repaired.plugin_id) // "app-1"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const repairLegacyChatSessionRecord = (input: unknown): unknown => {
  if (!isRecord(input)) return input;
  const data: { [key: string]: unknown } = { ...input };
  if (data.app_id != null) data.plugin_id = data.app_id;
  else if (data.plugin_id != null) data.app_id = data.plugin_id;
  return data;
};

export const decodeLegacyChatSession = (input: unknown) =>
  S.decodeUnknownEffect(ChatSession)(repairLegacyChatSessionRecord(input));

/**
 * Appends file ids that are not already on the session.
 *
 * **Example** (Skip an id that is already present)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ChatSession, addFileIds } from "./Chat.ts"
 *
 * const once = addFileIds(ChatSession.make({ id: "s1", createdAt: "2020-01-02T03:04:05.000Z", fileIds: ["f1"] }), ["f1", "f2"])
 * console.log(once.fileIds.join(",")) // "f1,f2"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Session and file ids are co-primary inputs, and neither is a pipeable value.
export const addFileIds = (session: ChatSession, newFileIds: ReadonlyArray<string>): ChatSession => {
  const next = [...session.fileIds];
  for (const fileId of newFileIds) {
    if (!next.includes(fileId)) next.push(fileId);
  }
  return ChatSession.make({ ...session, fileIds: next });
};

/**
 * File ids in the request that the session does not already have.
 *
 * **Details**
 *
 * The result order is not stable. Python used a set difference.
 *
 * **Example** (Drop an existing id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ChatSession, retrieveNewFile } from "./Chat.ts"
 *
 * const fresh = retrieveNewFile(
 *   ChatSession.make({ id: "s1", createdAt: "2020-01-02T03:04:05.000Z", fileIds: ["f1"] }),
 *   ["f1", "f2"],
 * )
 * console.log(fresh.includes("f2")) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Session and file ids are co-primary inputs, and neither is a pipeable value.
export const retrieveNewFile = (session: ChatSession, fileIds: ReadonlyArray<string>): ReadonlyArray<string> => {
  const existing = HashSet.fromIterable(session.fileIds);
  return Arr.filter(fileIds, (fileId) => !HashSet.has(existing, fileId));
};


