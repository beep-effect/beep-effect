/**
 * Push notification that can materialize a chat message on the client.
 *
 * FCM rejects a data payload over 4KB, so an oversized content card is dropped
 * instead of taking the whole message down with it.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { Model, optionalNull, pg } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/NotificationMessage");

/**
 * Byte budget for `contentBlocks` inside an FCM data payload.
 *
 * **Details**
 *
 * The rest of the payload stays under about 1KB. Losing the card costs a
 * render; losing the message costs the recap.
 *
 * **Example** (Read the budget)
 *
 * ```ts
 * import { MAX_CONTENT_BLOCKS_BYTES } from "./NotificationMessage.ts"
 *
 * console.log(MAX_CONTENT_BLOCKS_BYTES) // 3000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_CONTENT_BLOCKS_BYTES = 3000;

const notificationCrypto = Crypto.make({
  randomBytes: (size) => {
    const bytes = new Uint8Array(size);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  },
  digest: (_algorithm, data) => Effect.succeed(data),
});

const optionalTextDefault = (missing: string) =>
  S.String.pipe(
    S.NullOr,
    S.optionalKey,
    S.decodeTo(S.Option(S.String), {
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

/**
 * Notification that the client can turn into a chat message.
 *
 * **Details**
 *
 * `text` is optional and defaults to an empty string when the key is missing.
 * A present null stays `None`. `contentBlocks` uses the same block vocabulary
 * as chat message content blocks. `id` and `createdAt` are filled at construction.
 *
 * **Gotchas**
 *
 * {@link getMessageAsDict} keeps the Python FCM key names. Null `pluginId` and
 * `navigateTo` are omitted. Empty or oversized content blocks are omitted, and
 * a fitting card is sent as a JSON string.
 *
 * **Example** (Default the text)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NotificationMessage } from "./NotificationMessage.ts"
 *
 * const message = NotificationMessage.make({
 *   fromIntegration: "daily-summary",
 *   type: "summary",
 *   notificationType: "daily",
 * })
 * console.log(O.isSome(message.text) && message.text.value) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NotificationMessage extends Model<NotificationMessage>("NotificationMessage")(
  {
    id: S.String.annotateKey({ description: "Notification id. Construction defaults to a random UUID." }).pipe(
      S.withConstructorDefault(notificationCrypto.randomUUIDv4.pipe(Effect.orDie)),
      pg.text(),
      pg.columnName("id"),
    ),
    createdAt: S.String.annotateKey({ description: "ISO UTC creation time. Construction defaults to now." }).pipe(
      S.withConstructorDefault(Effect.sync(() => DateTime.formatIso(DateTime.nowUnsafe()))),
      pg.text(),
      pg.columnName("created_at"),
    ),
    sender: S.String.annotateKey({ description: "Sender label. Construction defaults to ai." }).pipe(
      S.withConstructorDefault(Effect.succeed("ai")),
      pg.text(),
      pg.columnName("sender"),
    ),
    pluginId: optionalNull(S.String)
      .annotateKey({ description: "Plugin id. Omitted from the FCM dict when absent." })
      .pipe(pg.text(), pg.columnName("plugin_id")),
    fromIntegration: S.String.annotateKey({ description: "Integration that produced the push." }).pipe(
      pg.text(),
      pg.columnName("from_integration"),
    ),
    type: S.String.annotateKey({ description: "Open notification type." }).pipe(pg.text(), pg.columnName("type")),
    notificationType: S.String.annotateKey({ description: "Open notification category." }).pipe(
      pg.text(),
      pg.columnName("notification_type"),
    ),
    text: optionalTextDefault("")
      .annotateKey({ description: "Body text. Missing becomes an empty string; null stays absent." })
      .pipe(pg.text(), pg.columnName("text")),
    navigateTo: optionalNull(S.String)
      .annotateKey({ description: "Deep link. Omitted from the FCM dict when absent." })
      .pipe(pg.text(), pg.columnName("navigate_to")),
    contentBlocks: S.JsonObject.pipe(S.Array, optionalNull)
      .annotateKey({ description: "Structured chat blocks. JSON-encoded for FCM or dropped." })
      .pipe(pg.jsonb(), pg.columnName("content_blocks")),
  },
  $I.annote("NotificationMessage", {
    description: "Push notification that can materialize a chat message.",
  }),
) {}

/**
 * Encoded form of {@link NotificationMessage}.
 *
 * @see {@link NotificationMessage} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NotificationMessage {
  export type Encoded = S.Codec.Encoded<typeof NotificationMessage>;
}

const utf8Size = (value: string): number => new TextEncoder().encode(value).byteLength;

/**
 * Render a notification as an FCM data dictionary.
 *
 * **Details**
 *
 * FCM data values are strings, except that this port keeps `text` as a string
 * or null. `plugin_id` and `navigate_to` are deleted when absent. Content
 * blocks are JSON text when they fit in {@link MAX_CONTENT_BLOCKS_BYTES};
 * otherwise the card is logged and dropped. An empty block list is dropped.
 *
 * **Example** (Omit a null plugin)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { NotificationMessage, getMessageAsDict } from "./NotificationMessage.ts"
 *
 * const payload = Effect.runSync(
 *   getMessageAsDict(
 *     NotificationMessage.make({
 *       fromIntegration: "daily-summary",
 *       type: "summary",
 *       notificationType: "daily",
 *       text: O.some("Hello"),
 *     }),
 *   ),
 * )
 * console.log(payload.plugin_id) // undefined
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const getMessageAsDict = Effect.fn("NotificationMessage.getMessageAsDict")(function* (
  message: NotificationMessage,
) {
  const text = O.match(message.text, { onNone: () => null, onSome: (value) => value });
  let payload: { [key: string]: S.Json } = {
    id: message.id,
    created_at: message.createdAt,
    sender: message.sender,
    from_integration: message.fromIntegration,
    type: message.type,
    notification_type: message.notificationType,
    text,
  };
  if (O.isSome(message.pluginId)) payload = { ...payload, plugin_id: message.pluginId.value };
  if (O.isSome(message.navigateTo)) payload = { ...payload, navigate_to: message.navigateTo.value };
  if (O.isNone(message.contentBlocks) || message.contentBlocks.value.length === 0) return payload;
  const blocks: Array<{ readonly [key: string]: S.Json }> = [];
  for (const block of message.contentBlocks.value) blocks.push(block);
  const encoded = yield* S.encodeEffect(S.JsonObject.pipe(S.Array, S.fromJsonString))(blocks);
  const bytes = utf8Size(encoded);
  if (bytes > MAX_CONTENT_BLOCKS_BYTES) {
    yield* Effect.logWarning(
      `notification_content_blocks_dropped type=${message.type} bytes=${bytes} limit=${MAX_CONTENT_BLOCKS_BYTES}`,
    );
    return payload;
  }
  return { ...payload, content_blocks: encoded };
});
