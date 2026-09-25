/**
 * Append-only IO for `harness-ledger/rows/YYYY-MM.jsonl`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { HarnessLedgerRow } from "@beep/repo-ai-metrics";
import { A, pipe, Str } from "@beep/utils";
import { DateTime, Effect, FileSystem, Path } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { HarnessLedgerIoError } from "../HarnessLedger.errors.ts";
import { listDirectorySorted } from "./Fs.ts";
import type { O } from "@beep/utils";

const encodeRowJsonValue = S.encodeUnknownEffect(S.toCodecJson(HarnessLedgerRow));

/**
 * Month key `YYYY-MM` of a row's creation instant (UTC).
 *
 * @internal
 * @param createdAt - Row creation instant; the month is taken in UTC, not local time.
 * @returns The `YYYY-MM` key that names the month file (`<key>.jsonl`) the row is appended to.
 * @category formatting
 * @since 0.0.0
 */
export const ledgerMonthOf = (createdAt: DateTime.Utc): string =>
  pipe(DateTime.formatIsoDateUtc(createdAt), Str.slice(0, 7));

/**
 * Absolute path of the ledger rows directory under a repo root.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const ledgerRowsDir = Effect.fn("HarnessLedger.ledgerRowsDir")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  return path.join(repoRoot, "harness-ledger", "rows");
});

/**
 * Encode a row as its JSON-safe value (for `--json` output).
 *
 * @internal
 * @param row - Decoded ledger row to render.
 * @returns An effect yielding the row's JSON-codec encoding (plain objects, ISO date strings), failing with `HarnessLedgerIoError` when encoding fails.
 * @category formatting
 * @since 0.0.0
 */
export const encodeLedgerRowValue = (row: HarnessLedgerRow) =>
  encodeRowJsonValue(row).pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to encode ledger row ${row.rowId}.`)));

const isRowsFile = (name: string): boolean => /^\d{4}-\d{2}\.jsonl$/.test(name);

/**
 * Read and decode every row of every month file, oldest file first and in
 * file order.
 *
 * **Details**
 *
 * A missing rows directory is an empty ledger. An undecodable line fails the
 * read: the ledger is single-writer, so a bad line is corruption, not noise.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const readLedgerRows = Effect.fn("HarnessLedger.readLedgerRows")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* ledgerRowsDir(repoRoot);
  const files = pipe(yield* listDirectorySorted(dir), A.filter(isRowsFile));
  const perFile = yield* Effect.forEach(files, (name) =>
    Effect.gen(function* () {
      const file = path.join(dir, name);
      const text = yield* fs
        .readFileString(file)
        .pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to read ${file}.`)));
      const lines = pipe(text, Str.split("\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));
      return yield* Effect.forEach(lines, (line, index) =>
        HarnessLedgerRow.decodeJsonEffect(line).pipe(
          Effect.mapError(
            HarnessLedgerIoError.wrap(`harness-ledger/rows/${name}:${index + 1} is not a HarnessLedgerRow.`)
          )
        )
      );
    })
  );
  return A.flatten(perFile);
});

/**
 * Append rows to their month files, creating a month file on first write.
 *
 * **Details**
 *
 * Opens each file with the append flag; existing lines are never rewritten.
 * Yields the repo-relative paths of the month files written.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const appendLedgerRows = Effect.fn("HarnessLedger.appendLedgerRows")(function* (
  repoRoot: string,
  rows: ReadonlyArray<HarnessLedgerRow>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* ledgerRowsDir(repoRoot);
  yield* fs
    .makeDirectory(dir, { recursive: true })
    .pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to create ${dir}.`)));
  const encoded = yield* Effect.forEach(rows, (row) =>
    HarnessLedgerRow.encodeJsonEffect(row).pipe(
      Effect.map((line) => [ledgerMonthOf(row.createdAt), line] as const),
      Effect.mapError(HarnessLedgerIoError.wrap(`Failed to encode ledger row ${row.rowId}.`))
    )
  );
  const months = pipe(
    encoded,
    A.map(([month]) => month),
    A.dedupe
  );
  const written = yield* Effect.forEach(months, (month) => {
    const file = path.join(dir, `${month}.jsonl`);
    const text = pipe(
      encoded,
      A.filter(([rowMonth]) => rowMonth === month),
      A.map(([, line]) => `${line}\n`),
      A.join("")
    );
    return fs
      .writeFileString(file, text, { flag: "a" })
      .pipe(
        Effect.as(`harness-ledger/rows/${month}.jsonl`),
        Effect.mapError(HarnessLedgerIoError.wrap(`Failed to append ${file}.`))
      );
  });
  return written;
});

/**
 * Find a row by id.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const findLedgerRow: {
  (rowId: string): (rows: ReadonlyArray<HarnessLedgerRow>) => O.Option<HarnessLedgerRow>;
  (rows: ReadonlyArray<HarnessLedgerRow>, rowId: string): O.Option<HarnessLedgerRow>;
} = dual(
  2,
  (rows: ReadonlyArray<HarnessLedgerRow>, rowId: string): O.Option<HarnessLedgerRow> =>
    A.findFirst(rows, (row) => row.rowId === rowId)
);
