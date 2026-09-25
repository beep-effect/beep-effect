/**
 * Signed URL payloads for precached audio files and conversation audio.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Model, optionalNull, optionalText, pg, text } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/SyncAudio");

const finite = (column: string) => S.Finite.pipe(pg.doublePrecision(), pg.columnName(column));

const optionalFinite = (column: string) =>
  optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName(column));

const optionalCount = (column: string) => optionalNull(S.Int).pipe(pg.integer(), pg.columnName(column));

/**
 * Acknowledgement that audio files were queued for precache.
 *
 * **Details**
 *
 * `status` is an open string. `message` and `audioFileCount` are present only
 * when the precache call has something extra to report.
 *
 * **Gotchas**
 *
 * `status` is not a closed set of audio states.
 *
 * **Example** (Decode a precache acknowledgement)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AudioPrecacheResponse } from "@beep/scratchpad/beep/SyncAudio"
 *
 * const response = Effect.runSync(
 *   S.decodeUnknownEffect(AudioPrecacheResponse)({ status: "queued", audioFileCount: 2 }),
 * )
 * console.log(response.status) // "queued"
 * console.log(O.isNone(response.message)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AudioPrecacheResponse extends Model<AudioPrecacheResponse>("AudioPrecacheResponse")(
  {
    status: text("status"),
    message: optionalText("message"),
    audioFileCount: optionalCount("audio_file_count"),
  },
  $I.annote("AudioPrecacheResponse", {
    description: "Acknowledgement that audio files were queued for precache.",
  }),
) {}

/**
 * Encoded precache acknowledgement before decoding.
 *
 * @see {@link AudioPrecacheResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioPrecacheResponse {
  export type Encoded = S.Codec.Encoded<typeof AudioPrecacheResponse>;
}

/**
 * Signed URL for one audio file.
 *
 * **Details**
 *
 * `status` is an open string. `signedUrl` and `contentType` are absent until
 * a URL exists. `duration` defaults to 0 at construction.
 *
 * **Gotchas**
 *
 * `status` is not a closed audio-processing enum.
 *
 * **Example** (Construct the zero duration)
 *
 * ```ts
 * import { AudioFileUrlInfo } from "@beep/scratchpad/beep/SyncAudio"
 *
 * const file = AudioFileUrlInfo.make({ id: "file-1", status: "ready" })
 * console.log(file.duration) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AudioFileUrlInfo extends Model<AudioFileUrlInfo>("AudioFileUrlInfo")(
  {
    id: text("id"),
    status: text("status"),
    signedUrl: optionalText("signed_url"),
    contentType: optionalText("content_type"),
    duration: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0)), pg.doublePrecision(), pg.columnName("duration")),
  },
  $I.annote("AudioFileUrlInfo", {
    description: "Signed URL, content type, and duration for one audio file.",
  }),
) {}

/**
 * Encoded audio-file URL before decoding.
 *
 * @see {@link AudioFileUrlInfo} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioFileUrlInfo {
  export type Encoded = S.Codec.Encoded<typeof AudioFileUrlInfo>;
}

/**
 * One span mapping a source file into the conversation audio artifact.
 *
 * **Details**
 *
 * `fileId` is the source file. `wallOffset` and `artifactOffset` are seconds.
 * `len` is the span length in seconds.
 *
 * **Gotchas**
 *
 * The property is `len` on both the decoded value and the wire. Camel-casing
 * `len` does not rename it. It is a length, not JavaScript's array `len`.
 *
 * **Example** (Decode a span)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationAudioSpanInfo } from "@beep/scratchpad/beep/SyncAudio"
 *
 * const span = Effect.runSync(
 *   S.decodeUnknownEffect(ConversationAudioSpanInfo)({
 *     fileId: "file-1",
 *     wallOffset: 1.5,
 *     artifactOffset: 0,
 *     len: 3,
 *   }),
 * )
 * console.log(span.len) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationAudioSpanInfo extends Model<ConversationAudioSpanInfo>("ConversationAudioSpanInfo")(
  {
    fileId: text("file_id"),
    wallOffset: finite("wall_offset"),
    artifactOffset: finite("artifact_offset"),
    len: finite("len"),
  },
  $I.annote("ConversationAudioSpanInfo", {
    description: "Mapping from one source audio file into the conversation audio artifact.",
  }),
) {}

/**
 * Encoded conversation-audio span before decoding.
 *
 * @see {@link ConversationAudioSpanInfo} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationAudioSpanInfo {
  export type Encoded = S.Codec.Encoded<typeof ConversationAudioSpanInfo>;
}

const emptySpans: ReadonlyArray<ConversationAudioSpanInfo> = [];

/**
 * Signed URL for the stitched conversation audio artifact.
 *
 * **Details**
 *
 * `status` is an open string. The signed URL, content type, duration, and
 * captured duration are optional. `spans` defaults to an empty list.
 *
 * **Example** (Construct an artifact with no spans)
 *
 * ```ts
 * import { ConversationAudioUrlInfo } from "@beep/scratchpad/beep/SyncAudio"
 *
 * const audio = ConversationAudioUrlInfo.make({ status: "pending" })
 * console.log(audio.spans.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationAudioUrlInfo extends Model<ConversationAudioUrlInfo>("ConversationAudioUrlInfo")(
  {
    status: text("status"),
    signedUrl: optionalText("signed_url"),
    contentType: optionalText("content_type"),
    duration: optionalFinite("duration"),
    capturedDuration: optionalFinite("captured_duration"),
    spans: S.Array(ConversationAudioSpanInfo).pipe(
      S.withConstructorDefault(Effect.succeed(emptySpans)),
      pg.jsonb(),
      pg.columnName("spans"),
    ),
  },
  $I.annote("ConversationAudioUrlInfo", {
    description: "Signed URL and span map for the stitched conversation audio artifact.",
  }),
) {}

/**
 * Encoded conversation-audio URL before decoding.
 *
 * @see {@link ConversationAudioUrlInfo} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationAudioUrlInfo {
  export type Encoded = S.Codec.Encoded<typeof ConversationAudioUrlInfo>;
}

/**
 * Audio files and optional conversation audio for one sync poll.
 *
 * **Details**
 *
 * `audioFiles` is the per-file URL list. `conversationAudio` is absent when
 * the stitched artifact is not available. `pollAfterMs` tells the client when
 * to ask again.
 *
 * **Gotchas**
 *
 * File and artifact `status` values stay open strings.
 *
 * **Example** (Decode a poll with no artifact)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AudioUrlsResponse } from "@beep/scratchpad/beep/SyncAudio"
 *
 * const urls = Effect.runSync(
 *   S.decodeUnknownEffect(AudioUrlsResponse)({
 *     audioFiles: [],
 *     pollAfterMs: 1000,
 *   }),
 * )
 * console.log(O.isNone(urls.conversationAudio)) // true
 * console.log(O.isSome(urls.pollAfterMs) && urls.pollAfterMs.value) // 1000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AudioUrlsResponse extends Model<AudioUrlsResponse>("AudioUrlsResponse")(
  {
    audioFiles: S.Array(AudioFileUrlInfo).pipe(pg.jsonb(), pg.columnName("audio_files")),
    conversationAudio: optionalNull(ConversationAudioUrlInfo).pipe(pg.jsonb(), pg.columnName("conversation_audio")),
    pollAfterMs: optionalCount("poll_after_ms"),
  },
  $I.annote("AudioUrlsResponse", {
    description: "Per-file audio URLs, optional conversation audio, and the next poll delay.",
  }),
) {}

/**
 * Encoded audio URL poll before decoding.
 *
 * @see {@link AudioUrlsResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioUrlsResponse {
  export type Encoded = S.Codec.Encoded<typeof AudioUrlsResponse>;
}
