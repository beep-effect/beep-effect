/**
 * Line-numbered JSONL reading shared by the practice knowledge-graph build
 * inputs (the docket register and the contacts table) and the review hub's
 * append-only logs.
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

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Str from "effect/String";

const lineBreakPattern = /\r?\n/u;

// Decode every non-blank line with its one-based number, counting every line, in order.
const decodeNumberedLines = <Row, E>(
  lines: ReadonlyArray<string>,
  decodeLine: (content: string, lineNumber: number) => Effect.Effect<Row, E>
): Effect.Effect<ReadonlyArray<Row>, E> =>
  Effect.forEach(
    A.filter(
      A.map(lines, (content, index) => ({ content, lineNumber: index + 1 })),
      ({ content }) => Str.isNonEmpty(Str.trim(content))
    ),
    ({ content, lineNumber }) => decodeLine(content, lineNumber),
    { concurrency: 1 }
  );

/**
 * Read a JSONL file, decoding each non-blank line with its line number.
 *
 * **Example** (Read lines as strings)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
      Effect.flatMap((text) => decodeNumberedLines(Str.split(text, lineBreakPattern), decodeLine))
    )
);

/**
 * Decode the complete lines of a JSONL text that may still be appended to.
 *
 * **Details**
 *
 * The segment after the last line break is a write still in progress, so it
 * is left out; every line before it must decode. Blank lines are skipped, and
 * line numbers are one-based and count every line.
 *
 * **Example** (Leave out a line still being written)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { decodeCompleteJsonlLines } from "./Jsonl.ts"
 *
 * const rows = decodeCompleteJsonlLines('{"a":1}\n{"a":', (content: string) => Effect.succeed(content))
 * Effect.runPromise(rows).then(console.log) // ['{"a":1}']
 * ```
 *
 * @internal
 * @param text - JSONL text, possibly ending in a line without a line break.
 * @param decodeLine - Decoder for one complete line, given its one-based line number.
 * @returns Decoded rows of the complete lines, in file order.
 * @category utilities
 * @since 0.0.0
 */
export const decodeCompleteJsonlLines: {
  <Row, E>(
    decodeLine: (content: string, lineNumber: number) => Effect.Effect<Row, E>
  ): (text: string) => Effect.Effect<ReadonlyArray<Row>, E>;
  <Row, E>(
    text: string,
    decodeLine: (content: string, lineNumber: number) => Effect.Effect<Row, E>
  ): Effect.Effect<ReadonlyArray<Row>, E>;
} = dual(
  2,
  <Row, E>(
    text: string,
    decodeLine: (content: string, lineNumber: number) => Effect.Effect<Row, E>
  ): Effect.Effect<ReadonlyArray<Row>, E> =>
    decodeNumberedLines(A.dropRight(Str.split(text, lineBreakPattern), 1), decodeLine)
);
