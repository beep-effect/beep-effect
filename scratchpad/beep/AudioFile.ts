/**
 * Stored audio-file metadata for one conversation chunk.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Model, optionalTimestamp, pg, text, userId } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/AudioFile");

/**
 * One owned audio file and the chunk timestamps needed to merge it.
 *
 * **Details**
 *
 * `id` identifies the file. `uid` is the owning user. `conversationId` is the
 * conversation the audio belongs to. `chunkTimestamps` are the chunk offsets
 * used for on-demand merging. `provider` is the storage provider and constructs
 * as `gcp`; the string stays open. `startedAt` is the absolute start, absent
 * until known. `duration` is seconds.
 *
 * **Gotchas**
 *
 * `provider` is not a closed union. `startedAt` is `None` for both a missing
 * key and JSON null. Duration is a finite number of seconds, not a timestamp.
 *
 * **Example** (Store a GCP chunk)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AudioFile } from "@beep/scratchpad/beep/AudioFile"
 *
 * const file = AudioFile.make({
 *   id: "audio-1",
 *   uid: "user-1",
 *   conversationId: "conv-1",
 *   chunkTimestamps: [0, 1.5],
 *   duration: 30,
 * })
 * console.log(file.provider) // "gcp"
 * console.log(O.isNone(file.startedAt)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AudioFile extends Model<AudioFile>("AudioFile")(
  {
    id: text("id"),
    uid: userId("uid"),
    conversationId: text("conversation_id"),
    chunkTimestamps: S.Array(S.Finite).pipe(pg.jsonb(), pg.columnName("chunk_timestamps")),
    provider: S.String.pipe(S.withConstructorDefault(Effect.succeed("gcp")), pg.text(), pg.columnName("provider")),
    startedAt: optionalTimestamp("started_at"),
    duration: S.Finite.pipe(pg.doublePrecision(), pg.columnName("duration")),
  },
  $I.annote("AudioFile", {
    description: "Owned audio file, its storage provider, and the chunk timestamps used to merge it.",
  }),
) {}

/**
 * Encoded form of {@link AudioFile}.
 *
 * @see {@link AudioFile} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioFile {
  export type Encoded = S.Codec.Encoded<typeof AudioFile>;
}
