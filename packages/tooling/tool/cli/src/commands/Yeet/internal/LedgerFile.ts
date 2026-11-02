/**
 * Append-only NDJSON ledger files in the owning clone, shared by the proof
 * ledger and the review lane ledger: one tolerant read, one healing append.
 *
 * **Details**
 *
 * Both ledgers are appended without a lock (rulings 63 and 71). The file is
 * opened `O_APPEND`, so each `write(2)` lands atomically at end-of-file, and the
 * only tear possible is one append split across syscalls with another landing
 * between the pieces. The reader therefore treats an unterminated last line as
 * an append still in flight, never as a row, and counts a terminated line that
 * does not decode as malformed; the writer starts on a fresh line when the file
 * does not end with one.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { appendContainedFileString, readContainedFileStringNoFollow } from "../../../internal/cli/FsGuards.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";

const unreadableLedger = (label: string, ledgerPath: string): YeetCommandError =>
  YeetCommandError.make({
    message: `${Str.capitalize(label)} "${ledgerPath}" exists but is not a readable regular file.`,
    file: ledgerPath,
  });

/**
 * Read and decode every terminated row of an append-only ledger file.
 *
 * **Details**
 *
 * A missing file reads as empty. Terminated lines are decoded one by one; a
 * line that does not decode is counted in `malformedRows` and skipped, and an
 * unterminated tail is an append still in flight and is ignored.
 *
 * **Example** (Read a ledger of numbers)
 *
 * ```ts
 * import { readLedgerRows } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const read = readLedgerRows("/repo", "/repo/.beep/yeet/numbers.ndjson", "number ledger", (line) =>
 *   O.liftPredicate(Number(line), Number.isFinite)
 * )
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @param ledgerRoot - Directory the ledger must stay inside.
 * @param ledgerPath - The ledger file.
 * @param label - How the ledger is named in errors, lower case (`proof ledger`).
 * @param decodeRow - Decode one terminated line; `None` counts the line as malformed.
 * @returns The decoded rows and the count of malformed terminated rows.
 * @category utilities
 * @since 0.0.0
 */
export const readLedgerRows = Effect.fn("Yeet.LedgerFile.readRows")(function* <Row>(
  ledgerRoot: string,
  ledgerPath: string,
  label: string,
  decodeRow: (line: string) => O.Option<Row>
): Effect.fn.Return<
  { readonly rows: ReadonlyArray<Row>; readonly malformedRows: number },
  YeetCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const read = yield* readContainedFileStringNoFollow(ledgerRoot, ledgerPath).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to read ${label} "${ledgerPath}".`))
  );
  if (!read.exists) {
    return { rows: A.empty<Row>(), malformedRows: 0 };
  }
  if (O.isNone(read.contents)) {
    return yield* unreadableLedger(label, ledgerPath);
  }
  const contents = read.contents.value;
  const splitLines = Str.split(contents, "\n");
  // An unterminated last line is an append still in flight, never a row.
  const completeLines = Str.endsWith("\n")(contents) ? splitLines : A.dropRight(splitLines, 1);
  const lines = A.filter(completeLines, Str.isNonEmpty);
  const rows = A.getSomes(A.map(lines, decodeRow));
  return { rows, malformedRows: A.length(lines) - A.length(rows) };
});

/**
 * Encode rows and append them to an append-only ledger file in one write.
 *
 * **Details**
 *
 * An empty batch writes nothing. The file is inspected first so an
 * unreadable regular file fails before anything is written, and a torn tail
 * (a file not ending in a newline) is healed by starting the append on a fresh
 * line. Every row is encoded before the single `O_APPEND` write, so an encode
 * failure writes nothing.
 *
 * **Example** (Append two numbers)
 *
 * ```ts
 * import { appendLedgerRows } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const append = appendLedgerRows("/repo", "/repo/.beep/yeet/numbers.ndjson", "number ledger", [1, 2], (row) =>
 *   Effect.succeed(`${row}`)
 * )
 * console.log(Effect.isEffect(append)) // true
 * ```
 *
 * @param ledgerRoot - Directory the ledger must stay inside.
 * @param ledgerPath - The ledger file.
 * @param label - How the ledger is named in errors, lower case (`proof ledger`).
 * @param rows - The rows to append, in order.
 * @param encodeRow - Encode one row as one line without its terminator.
 * @returns Nothing once the rows are appended.
 * @category utilities
 * @since 0.0.0
 */
export const appendLedgerRows = Effect.fn("Yeet.LedgerFile.appendRows")(function* <Row>(
  ledgerRoot: string,
  ledgerPath: string,
  label: string,
  rows: ReadonlyArray<Row>,
  encodeRow: (row: Row) => Effect.Effect<string, YeetCommandError>
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  if (A.isReadonlyArrayEmpty(rows)) {
    return;
  }
  const read = yield* readContainedFileStringNoFollow(ledgerRoot, ledgerPath).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to inspect ${label} "${ledgerPath}" before appending.`))
  );
  if (read.exists && O.isNone(read.contents)) {
    return yield* unreadableLedger(label, ledgerPath);
  }
  // A torn tail is healed by starting the append on a fresh line.
  const recoveryPrefix = O.match(read.contents, {
    onNone: () => Str.empty,
    onSome: (contents) => (Str.isNonEmpty(contents) && !Str.endsWith("\n")(contents) ? "\n" : Str.empty),
  });
  const lines = yield* Effect.forEach(rows, encodeRow);
  const text = A.join(
    A.map(lines, (line) => `${line}\n`),
    Str.empty
  );
  yield* appendContainedFileString(ledgerRoot, ledgerPath, `${recoveryPrefix}${text}`).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to append ${label} "${ledgerPath}".`))
  );
});
