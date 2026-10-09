/**
 * The append-only JSON Lines store every workstation state file shares: one
 * file per partition key, rows appended with private modes, corrupt lines
 * skipped and counted on read, a missing file read as empty history.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { emptyWhenNotFound } from "./WorkstationState.ts";
import type * as PlatformError from "effect/PlatformError";

/**
 * Rows that decoded from a JSON Lines file, and how many non-empty lines did not.
 *
 * **Example** (A read with one corrupt line)
 *
 * ```ts
 * import { type JsonLinesRead } from "@beep/repo-cli/test/SharedInternals"
 *
 * const read: JsonLinesRead<string> = { rows: ["ok"], corruptLineCount: 1 }
 * console.log(read.corruptLineCount) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface JsonLinesRead<Row> {
  readonly corruptLineCount: number;
  readonly rows: ReadonlyArray<Row>;
}

/**
 * Split JSON Lines content into the rows that decode and a count of the
 * non-empty lines that do not, so one bad line never hides the history.
 *
 * **Example** (Count a corrupt line)
 *
 * ```ts
 * import { partitionJsonLines } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const read = partitionJsonLines((line: string) => (line === "ok" ? O.some(line) : O.none()))("ok\nbad\n")
 * console.log(read.rows.length, read.corruptLineCount) // 1 1
 * ```
 *
 * @param decodeOption - Decodes one line, or none when the line is corrupt.
 * @returns A reader from file content to rows and the corrupt-line count.
 * @category parsing
 * @since 0.0.0
 */
export const partitionJsonLines =
  <Row>(decodeOption: (line: string) => O.Option<Row>) =>
  (content: string): JsonLinesRead<Row> => {
    const lines = A.filter(A.map(Str.split(content, "\n"), Str.trim), Str.isNonEmpty);
    const rows = A.getSomes(A.map(lines, decodeOption));
    return { rows, corruptLineCount: A.length(lines) - A.length(rows) };
  };

/**
 * How an append-only log is reduced to its current state.
 *
 * **Example** (Key rows by name)
 *
 * ```ts
 * import { type NewestPerKeyOptions } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime";
 * const options: NewestPerKeyOptions<{ name: string; at: number }> = {
 *   key: (row) => row.name,
 *   at: (row) => DateTime.makeUnsafe(row.at),
 * }
 * console.log(options.key({ name: "a", at: 0 })) // "a"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface NewestPerKeyOptions<Row> {
  /** When the row was recorded. */
  readonly at: (row: Row) => DateTime.DateTime;
  /** What the row is about; the newest row per key wins. */
  readonly key: (row: Row) => string;
}

/**
 * Reduce append-only rows to the newest row per key, newest first.
 *
 * **Details**
 *
 * A later row with the same instant replaces an earlier one, so two appends
 * in the same millisecond resolve in file order.
 *
 * **Example** (Keep the newest row per key)
 *
 * ```ts
 * import { newestPerKey } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime";
 * const current = newestPerKey<{ k: string; t: number }>({
 *   key: (row) => row.k,
 *   at: (row) => DateTime.makeUnsafe(row.t),
 * })([{ k: "a", t: 1 }, { k: "a", t: 2 }])
 * console.log(current) // [{ k: "a", t: 2 }]
 * ```
 *
 * @param options - The key and the instant of a row.
 * @returns A reducer from the log to its current rows, newest first.
 * @category utilities
 * @since 0.0.0
 */
export const newestPerKey =
  <Row>(options: NewestPerKeyOptions<Row>) =>
  (rows: ReadonlyArray<Row>): ReadonlyArray<Row> => {
    const epoch = (row: Row): number => DateTime.toEpochMillis(options.at(row));
    const newest = MutableHashMap.empty<string, Row>();
    for (const row of rows) {
      const current = MutableHashMap.get(newest, options.key(row));
      if (O.isNone(current) || epoch(row) >= epoch(current.value)) {
        MutableHashMap.set(newest, options.key(row), row);
      }
    }
    // Negate the epoch so the plain Number order sorts newest first.
    return newest.pipe(
      MutableHashMap.values,
      A.fromIterable,
      A.sort(Order.mapInput(Order.Number, (row: Row) => -epoch(row)))
    );
  };

/**
 * What a JSON Lines store needs to know about its rows and its files.
 *
 * **Example** (Name the label)
 *
 * ```ts
 * import { type JsonLinesStoreOptions } from "@beep/repo-cli/test/SharedInternals"
 *
 * const label: JsonLinesStoreOptions<string, string, never>["label"] = { scope: "session", noun: "ledger" }
 * console.log(label.noun) // "ledger"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface JsonLinesStoreOptions<Row, Partition, E> {
  /** Decodes one stored line, or none when it is corrupt. */
  readonly decodeOption: (line: string) => O.Option<Row>;
  /** The directory the partition files live in. */
  readonly directory: string;
  /** Encodes one row as a single JSON line. */
  readonly encode: (row: Row) => Effect.Effect<string, E>;
  /** The file name for a partition. */
  readonly fileName: (partition: Partition) => string;
  /** The store's label in the corrupt-line warning, e.g. `[session] ... ledger line(s)`. */
  readonly label: { readonly scope: string; readonly noun: string };
  /** Maps a filesystem failure other than a missing file to the store's error. */
  readonly onPlatformError: (error: PlatformError.PlatformError) => E;
  /** The partition a row belongs to. */
  readonly partitionOf: (row: Row) => Partition;
}

/**
 * The two operations of an append-only store.
 *
 * **Example** (Name the operations)
 *
 * ```ts
 * import { type JsonLinesStore } from "@beep/repo-cli/test/SharedInternals"
 *
 * const operations: ReadonlyArray<keyof JsonLinesStore<string, string, never>> = ["append", "list"]
 * console.log(operations.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface JsonLinesStore<Row, Partition, E> {
  readonly append: (row: Row) => Effect.Effect<void, E>;
  readonly list: (partition: Partition) => Effect.Effect<ReadonlyArray<Row>, E>;
}

/**
 * Build a filesystem-backed append-only JSON Lines store.
 *
 * **Details**
 *
 * The directory is created `0700` and files `0600` on first append: these
 * files name sessions, checkouts and people, and belong to one user. A
 * missing file lists as empty; a corrupt line is skipped with one warning.
 *
 * **Example** (Describe a store)
 *
 * ```ts
 * import { makeJsonLinesStore } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(typeof makeJsonLinesStore) // "function"
 * ```
 *
 * @param options - Row codec, partitioning, directory and error mapping.
 * @returns The store's `append` and `list`.
 * @category services
 * @since 0.0.0
 */
export const makeJsonLinesStore = Effect.fn("JsonLinesStore.make")(function* <Row, Partition, E>(
  options: JsonLinesStoreOptions<Row, Partition, E>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fileFor = (partition: Partition): string => path.join(options.directory, options.fileName(partition));
  const read = partitionJsonLines(options.decodeOption);
  const store: JsonLinesStore<Row, Partition, E> = {
    append: (row) =>
      options
        .encode(row)
        .pipe(
          Effect.flatMap((encoded) =>
            fs
              .makeDirectory(options.directory, { recursive: true, mode: 0o700 })
              .pipe(
                Effect.andThen(
                  fs.writeFileString(fileFor(options.partitionOf(row)), `${encoded}\n`, { flag: "a", mode: 0o600 })
                ),
                Effect.mapError(options.onPlatformError)
              )
          )
        ),
    list: (partition) =>
      fs.readFileString(fileFor(partition)).pipe(
        Effect.map(read),
        Effect.tap((result) =>
          result.corruptLineCount > 0
            ? Console.warn(
                `[${options.label.scope}] skipped ${result.corruptLineCount} corrupt ${options.label.noun} line(s)`
              )
            : Effect.void
        ),
        Effect.map((result) => result.rows),
        emptyWhenNotFound(options.onPlatformError)
      ),
  };
  return store;
});
