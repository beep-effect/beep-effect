/**
 * Photo attached to a conversation.
 *
 * **Details**
 *
 * Legacy captures carry inline pixels in `base64`. Conversation-lifetime frame
 * evidence carries an opaque storage id instead. Ambient pixels never enter
 * this model. `base64` is still a required string.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { optionalText, text, textBoundsCheck, timestampDefaultNow } from "./Kit.ts";
import { boolDefault, Model, optionalNull, pg, Table } from "./Port.ts";

const $I = $ScratchpadId.create("beep/ConversationPhoto");

const pad2 = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const clockUtc = (instant: DateTime.Utc): string => {
  const parts = DateTime.toPartsUtc(instant);
  return `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
};

/**
 * Strips a storage id and rejects empty, slashed, or URL values.
 *
 * **Details**
 *
 * Null stays `None`. A present value is stripped. Empty text, `/`, `\`, and
 * an `http:` or `https:` prefix are invalid.
 *
 * **Example** (Reject a URL)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { readStorageId } from "./ConversationPhoto.ts"
 *
 * console.log(O.isNone(readStorageId("https://cdn.example/a"))) // true
 * console.log(O.getOrElse(readStorageId(" frame-1 "), () => "")) // "frame-1"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const readStorageId = (value: string): O.Option<string> => {
  const stripped = Str.trim(value);
  if (
    stripped.length === 0 ||
    Str.includes("/")(stripped) ||
    Str.includes("\\")(stripped) ||
    Str.startsWith("http:")(stripped) ||
    Str.startsWith("https:")(stripped)
  ) {
    return O.none();
  }
  return O.some(stripped);
};

const OpaqueStorageId = S.String.pipe(
  S.decodeTo(S.String.check(S.isMinLength(1)), {
    decode: SchemaGetter.transformEffect((value, options) =>
      Effect.fromOption(readStorageId(value), () => new SchemaIssue.InvalidValue({ message: "storage_id must be an opaque owner-scoped identifier" }, value, options)),
    ),
    encode: SchemaGetter.transform((value) => value),
  }),
);

/**
 * Strips and lowercases a content type, requiring an `image/` media type.
 *
 * **Details**
 *
 * Null stays `None`. A present value is stripped and lowercased, then must
 * start with `image/` and be at most 100 characters.
 *
 * **Example** (Normalize an image type)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { readContentType } from "./ConversationPhoto.ts"
 *
 * console.log(O.getOrElse(readContentType(" Image/PNG "), () => "")) // "image/png"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const readContentType = (value: string): O.Option<string> => {
  const stripped = Str.toLowerCase(Str.trim(value));
  if (!Str.startsWith("image/")(stripped) || stripped.length > 100) return O.none();
  return O.some(stripped);
};

const ImageContentType = S.String.pipe(
  S.decodeTo(S.String.check(S.isMaxLength(100), S.isPattern(/^image\/.+/)), {
    decode: SchemaGetter.transformEffect((value, options) =>
      Effect.fromOption(readContentType(value), () => new SchemaIssue.InvalidValue({ message: "content_type must be an image media type" }, value, options)),
    ),
    encode: SchemaGetter.transform((value) => value),
  }),
);

/**
 * One conversation photo, either inline pixels or an opaque storage reference.
 *
 * **Details**
 *
 * `base64` is required even when `storageId` carries the newer GCS reference.
 * `storageId` and `contentType` are checked only when present.
 *
 * **Gotchas**
 *
 * The clock printed by {@link photosAsString} is UTC. Python `strftime` uses
 * the datetime's own offset; this port stores `DateTime.Utc`.
 *
 * **Example** (Decode a null storage id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ConversationPhoto } from "./ConversationPhoto.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ConversationPhoto)({ base64: "pixels", storageId: null }),
 * )
 * console.log(O.isNone(decoded.storageId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationPhoto extends Model<ConversationPhoto>("ConversationPhoto")(
  {
    id: optionalText("id"),
    base64: text("base64"),
    storageId: optionalNull(OpaqueStorageId).pipe(pg.text(), pg.columnName("storage_id")),
    contentType: optionalNull(ImageContentType).pipe(pg.text(), pg.columnName("content_type")),
    description: optionalText("description"),
    createdAt: timestampDefaultNow("created_at"),
    discarded: boolDefault("discarded", false),
    dataProtectionLevel: optionalText("data_protection_level"),
  },
  $I.annote("ConversationPhoto", {
    description:
      "Conversation photo. Legacy rows carry inline base64; newer frame evidence carries an opaque storage id.",
  }),
  (columns) => [
    textBoundsCheck("content_type", { maxLength: 100, pattern: "^image/.+" })(columns.contentType),
    Table.check("storage_id_opaque")(
      sql<boolean>`char_length(${columns.storageId}) >= 1 and position('/' in ${columns.storageId}) = 0 and position(chr(92) in ${columns.storageId}) = 0 and left(${columns.storageId}, 5) <> 'http:' and left(${columns.storageId}, 6) <> 'https:'`,
    ),
  ],
) {}

/**
 * Encoded form of {@link ConversationPhoto}.
 *
 * @see {@link ConversationPhoto} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationPhoto {
  export type Encoded = S.Codec.Encoded<typeof ConversationPhoto>;
}

/**
 * Renders photo descriptions, or `None` when nothing is worth showing.
 *
 * **Details**
 *
 * Blank descriptions are skipped. With timestamps, each line is
 * `- [HH:MM:SS] "description"`. Without them, the clock is omitted. The clock
 * is UTC.
 *
 * **Example** (Skip a blank description)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ConversationPhoto, photosAsString } from "./ConversationPhoto.ts"
 *
 * const photo = ConversationPhoto.make({ base64: "pixels", description: O.some("   ") })
 * console.log(photosAsString([photo], false)) // "None"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Photos and the timestamp flag are co-primary inputs, and neither is a pipeable value.
export const photosAsString = (photos: ReadonlyArray<ConversationPhoto>, includeTimestamps = false): string => {
  if (photos.length === 0) return "None";
  const lines: Array<string> = [];
  for (const photo of photos) {
    const description = O.getOrElse(photo.description, () => "");
    if (Str.trim(description).length === 0) continue;
    const timestamp = includeTimestamps ? `[${clockUtc(photo.createdAt)}] ` : "";
    lines.push(`- ${timestamp}"${description}"`);
  }
  if (lines.length === 0) return "None";
  return lines.join("\n");
};
