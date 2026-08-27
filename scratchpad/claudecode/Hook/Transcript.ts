/**
 * Reads the JSON-lines conversation transcript stored at the
 * `transcript_path` field of every hook envelope. `readTranscript`
 * uses the Effect `FileSystem` service and parses each line as an
 * unknown JSON value, returning a read-only array.
 *
 * This module requires a platform `FileSystem` layer to be provided by
 * the caller (e.g. `NodeFileSystem.layer` from
 * `@effect/platform-node-shared/NodeFileSystem`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { Unknown } from "@beep/schema/Unknown";
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

const JsonValue = S.fromJsonString(Unknown).pipe(
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
 * **Gotchas**
 *
 * Empty and whitespace-only lines are dropped. Each remaining line is
 * JSON-decoded. Both filesystem read failures and JSONL parse failures
 * surface as {@link TranscriptReadError}, not as a raw thrown parse error.
 *
 * **Example** (Count transcript events)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook, Testing } from "effect-claudecode"
 *
 * const fileSystem = Testing.makeMockFileSystem({
 *   "/transcript.jsonl": '{"type":"user"}\n{"type":"assistant"}\n'
 * })
 * const count = await Effect.runPromise(
 *   Hook.readTranscript("/transcript.jsonl").pipe(
 *     Effect.map((events) => events.length),
 *     Effect.provide(fileSystem.layer)
 *   )
 * )
 * console.log(count) // 2
 * ```
 *
 * @see {@link TranscriptReadError} for the tagged failure raised on read or JSONL decode errors.
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
      S.decodeEffect(JsonValue)(line).pipe(Effect.mapError((cause) => TranscriptReadError.make({ path, cause })))
    );
  });
