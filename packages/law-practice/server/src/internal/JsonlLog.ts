/**
 * One append-only JSONL file of schema rows, shared by the review stores.
 *
 * **Details**
 *
 * A missing file reads as no rows, and every complete line must decode, so a
 * corrupt line fails the read instead of being skipped. A last line without
 * a line break is an append still in progress and is left out. Appends
 * create the directory, write and sync to disk; `serialized` runs an effect
 * under the file's one permit, so read-then-append sequences do not
 * interleave. Failures name the file and the line number, never the content.
 * It is private to `@beep/law-practice-server`.
 *
 * @packageDocumentation
 * @internal
 * @category utilities
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { decodeCompleteJsonlLines } from "./Jsonl.ts";

const textEncoder = new TextEncoder();

/**
 * Open one JSONL log file.
 *
 * **Example** (Open a log of strings)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { makeJsonlLog } from "./JsonlLog.ts"
 *
 * const log = makeJsonlLog({
 *   file: "/var/lib/hub/rows.jsonl",
 *   schema: S.String,
 *   readFailure: (reason: string) => reason,
 *   appendFailure: (reason: string) => reason
 * })
 * console.log(Effect.isEffect(log)) // true
 * ```
 *
 * @internal
 * @param options - The file, its row schema, and the failure for a read or an append given a diagnostic and a cause.
 * @returns The file's rows, an append, and a runner that serializes an effect with the appends.
 * @category constructors
 * @since 0.0.0
 */
export const makeJsonlLog = Effect.fnUntraced(function* <
  Row extends S.Top & { readonly DecodingServices: never; readonly EncodingServices: never },
  E,
>(options: {
  readonly file: string;
  readonly schema: Row;
  readonly readFailure: (reason: string, cause: unknown) => E;
  readonly appendFailure: (reason: string, cause: unknown) => E;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const permit = yield* Semaphore.make(1);
  const decodeLine: (line: string) => Effect.Effect<Row["Type"], S.SchemaError> = S.decodeEffect(
    S.fromJsonString(options.schema)
  );
  const encodeLine: (row: Row["Type"]) => Effect.Effect<string, S.SchemaError> = S.encodeEffect(
    S.fromJsonString(options.schema)
  );
  const name = path.basename(options.file);
  const unreadable = (cause: unknown) => options.readFailure(`${name} cannot be read`, cause);

  // A last line without a line break is an append still in progress, so it is left for the next read.
  const rows: Effect.Effect<ReadonlyArray<Row["Type"]>, E> = Effect.flatMap(
    Effect.mapError(fs.exists(options.file), unreadable),
    (exists) =>
      exists
        ? fs
            .readFileString(options.file)
            .pipe(
              Effect.mapError(unreadable),
              Effect.flatMap(
                decodeCompleteJsonlLines((content, lineNumber) =>
                  Effect.mapError(decodeLine(content), (cause) =>
                    options.readFailure(`${name} line ${lineNumber} does not decode`, cause)
                  )
                )
              )
            )
        : Effect.succeed([])
  );

  const append = (values: ReadonlyArray<Row["Type"]>): Effect.Effect<void, E> =>
    A.isReadonlyArrayEmpty(values)
      ? Effect.void
      : Effect.scoped(
          Effect.gen(function* () {
            const forEach1 = yield* Effect.forEach(values, encodeLine);
            const text = A.join(forEach1, "\n");
            yield* fs.makeDirectory(path.dirname(options.file), { recursive: true, mode: 0o700 });
            const handle = yield* fs.open(options.file, { flag: "a", mode: 0o600 });
            yield* handle.writeAll(textEncoder.encode(`${text}\n`));
            yield* handle.sync;
          })
        ).pipe(
          Effect.mapError((cause) => options.appendFailure(`${name} append of ${A.length(values)} rows failed`, cause))
        );

  return { append, rows, serialized: permit.withPermits(1) };
});
