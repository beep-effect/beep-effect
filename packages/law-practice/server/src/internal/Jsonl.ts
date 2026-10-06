/**
 * Line-numbered JSONL reading shared by the practice knowledge-graph build
 * inputs (the docket register and the contacts table).
 *
 * **Details**
 *
 * Each input keeps its own row schema and its own typed error; this module
 * owns only the line handling: blank lines are skipped, line numbers are
 * one-based and count every line of the file, and rows come back in file
 * order. It is private to `@beep/law-practice-server`.
 *
 * @packageDocumentation
 * @internal
 * @category utilities
 * @since 0.0.0
 */

import { Effect, FileSystem } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Str from "effect/String";

const lineBreakPattern = /\r?\n/u;

/**
 * Read a JSONL file, decoding each non-blank line with its line number.
 *
 * **Example** (Read lines as strings)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { readJsonlLines } from "./Jsonl.ts"
 *
 * const lines = readJsonlLines("/input.jsonl", (cause: unknown) => cause, (content: string) => Effect.succeed(content))
 * console.log(Effect.isEffect(lines)) // true
 * ```
 *
 * @internal
 * @param path - JSONL file.
 * @param readFailure - Error for a file that cannot be read.
 * @param decodeLine - Decoder for one line, given its one-based line number.
 * @returns Decoded rows in file order.
 * @category utilities
 * @since 0.0.0
 */
export const readJsonlLines: {
  <Row, E>(
    readFailure: (cause: unknown) => E,
    decodeLine: (content: string, lineNumber: number) => Effect.Effect<Row, E>
  ): (path: string) => Effect.Effect<ReadonlyArray<Row>, E, FileSystem.FileSystem>;
  <Row, E>(
    path: string,
    readFailure: (cause: unknown) => E,
    decodeLine: (content: string, lineNumber: number) => Effect.Effect<Row, E>
  ): Effect.Effect<ReadonlyArray<Row>, E, FileSystem.FileSystem>;
} = dual(
  3,
  <Row, E>(
    path: string,
    readFailure: (cause: unknown) => E,
    decodeLine: (content: string, lineNumber: number) => Effect.Effect<Row, E>
  ): Effect.Effect<ReadonlyArray<Row>, E, FileSystem.FileSystem> =>
    FileSystem.FileSystem.pipe(
      Effect.flatMap((fs) => fs.readFileString(path)),
      Effect.mapError(readFailure),
      Effect.flatMap((text) =>
        Effect.forEach(
          A.filter(
            A.map(Str.split(text, lineBreakPattern), (content, index) => ({ content, lineNumber: index + 1 })),
            ({ content }) => Str.isNonEmpty(Str.trim(content))
          ),
          ({ content, lineNumber }) => decodeLine(content, lineNumber)
        )
      )
    )
);
