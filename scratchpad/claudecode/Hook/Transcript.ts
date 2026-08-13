/**
 * Transcript reader.
 *
 * Claude Code stores the conversation transcript as a JSON-lines file
 * at the `transcript_path` field of every hook envelope. `readTranscript`
 * reads that file via the Effect `FileSystem` service and parses each
 * line as an unknown JSON value, returning a read-only array.
 *
 * This module requires a platform `FileSystem` layer to be provided by
 * the caller (e.g. `NodeFileSystem.layer` from
 * `@effect/platform-node-shared/NodeFileSystem`).
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

import { TranscriptReadError } from "../Errors.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("claudecode/Hook/Transcript");

const JsonValue = S.fromJsonString(S.Unknown).pipe(
  $I.annoteSchema("JsonValue", {
    description: "One JSON value encoded as a transcript JSONL line.",
  })
);

/**
 * Read a Claude Code transcript file and return each JSONL line as a
 * parsed unknown value.
 *
 * Requires `FileSystem.FileSystem` in the environment.
 *
 * **Example** (Count transcript events)
 *
 * ```ts
 * import * as NodeFileSystem from "@effect/platform-node-shared/NodeFileSystem"
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const program = Hook.readTranscript("./transcript.jsonl").pipe(
 *   Effect.map((events) => events.length),
 *   Effect.provide(NodeFileSystem.layer)
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const readTranscript = (
  path: string
): Effect.Effect<ReadonlyArray<unknown>, TranscriptReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const content = yield* fs
      .readFileString(path)
      .pipe(Effect.mapError((cause) => TranscriptReadError.make({ path, cause })));
    const lines = pipe(content, Str.split("\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));
    return yield* Effect.forEach(lines, (line) =>
      S.decodeUnknownEffect(JsonValue)(line).pipe(Effect.mapError((cause) => TranscriptReadError.make({ path, cause })))
    );
  });
