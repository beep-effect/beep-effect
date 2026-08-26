/**
 * Whole-text CSV formatting helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { csvError } from "../CsvError/index.ts";
import type { CsvCodecOptions } from "../CsvCodecOptions/index.ts";
import type { CsvError } from "../CsvError/index.ts";

const rowDelimiter = "\n";

const stripNullBytes = Str.replaceAll("\0", "");

const getEscapedQuote = (options: CsvCodecOptions): O.Option<string> =>
  pipe(
    O.all({
      escape: options.escapeChar,
      quote: options.quote,
    }),
    O.map(({ escape, quote }) => `${escape}${quote}`)
  );

const requiresQuoting = (value: string, options: CsvCodecOptions, fieldIndex: number): boolean =>
  P.some<string>([
    Str.includes(options.delimiter),
    Str.includes("\r"),
    Str.includes("\n"),
    (field) =>
      pipe(
        options.quote,
        O.exists((quote) => Str.includes(quote)(field))
      ),
    (field) =>
      pipe(
        options.comment,
        O.filter(() => fieldIndex === 0),
        O.exists((comment) => Str.startsWith(comment)(field))
      ),
  ])(value);

const escapeField = (value: string, options: CsvCodecOptions): string =>
  pipe(
    options.quote,
    O.map((quote) => {
      const escapedEscapeChars = pipe(
        options.escapeChar,
        O.filter((escapeChar) => escapeChar !== quote),
        O.map((escapeChar) => Str.replaceAll(escapeChar, `${escapeChar}${escapeChar}`)(value)),
        O.getOrElse(() => value)
      );

      return pipe(
        getEscapedQuote(options),
        O.map((escapedQuote) => Str.replaceAll(quote, escapedQuote)(escapedEscapeChars)),
        O.getOrElse(() => escapedEscapeChars)
      );
    }),
    O.getOrElse(() => value)
  );

const formatField = (value: string, fieldIndex: number, options: CsvCodecOptions): Effect.Effect<string, CsvError> => {
  const prepared = stripNullBytes(value);

  return pipe(
    prepared,
    O.liftPredicate((field) => !requiresQuoting(field, options, fieldIndex)),
    O.map(Effect.succeed),
    O.orElse(() =>
      pipe(
        options.quote,
        O.map((quote) => Effect.succeed(`${quote}${escapeField(prepared, options)}${quote}`))
      )
    ),
    O.getOrElse(() =>
      Effect.fail(csvError(`Unable to encode field '${prepared}' without a configured quote character.`, fieldIndex))
    )
  );
};

const formatCsvHeaderRowEffect = Effect.fn("CsvFormatter.formatCsvHeaderRowEffect")(function* (
  headers: ReadonlyArray<string>,
  options: CsvCodecOptions
): Effect.fn.Return<string, CsvError> {
  const fields = yield* Effect.forEach(headers, (header, index) => formatField(header, index, options));
  return A.join(fields, options.delimiter);
});

/**
 * Format a CSV header row.
 *
 * **Example** (Format header row)
 *
 * ```ts import.meta.vitest name="Format header row"
 * import { Effect } from "effect"
 * import { CsvCodecOptions } from "@beep/schema/CsvCodecOptions"
 * import { formatCsvHeaderRow } from "@beep/schema/CsvFormatter"
 *
 * const header = Effect.runSync(formatCsvHeaderRow(["name", "age"], CsvCodecOptions.make({})))
 * console.log(header)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatCsvHeaderRow: {
  (headers: ReadonlyArray<string>, options: CsvCodecOptions): Effect.Effect<string, CsvError>;
  (options: CsvCodecOptions): (headers: ReadonlyArray<string>) => Effect.Effect<string, CsvError>;
} = dual(2, formatCsvHeaderRowEffect);

/**
 * Format a CSV data row.
 *
 * @category utilities
 * @since 0.0.0
 */
const formatCsvDataRowEffect = Effect.fn("CsvFormatter.formatCsvDataRowEffect")(function* (
  fields: ReadonlyArray<string>,
  options: CsvCodecOptions
): Effect.fn.Return<string, CsvError> {
  const encodedFields = yield* Effect.forEach(fields, (field, index) => formatField(field, index, options));
  return A.join(encodedFields, options.delimiter);
});

/**
 * Format a CSV data row.
 *
 * **Example** (Format data row)
 *
 * ```ts import.meta.vitest name="Format data row"
 * import { Effect } from "effect"
 * import { CsvCodecOptions } from "@beep/schema/CsvCodecOptions"
 * import { formatCsvDataRow } from "@beep/schema/CsvFormatter"
 *
 * const row = Effect.runSync(formatCsvDataRow(["Ada", "36"], CsvCodecOptions.make({})))
 * console.log(row)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatCsvDataRow: {
  (fields: ReadonlyArray<string>, options: CsvCodecOptions): Effect.Effect<string, CsvError>;
  (options: CsvCodecOptions): (fields: ReadonlyArray<string>) => Effect.Effect<string, CsvError>;
} = dual(2, formatCsvDataRowEffect);

/**
 * Format a whole CSV document.
 *
 * @category utilities
 * @since 0.0.0
 */
const formatCsvDocumentEffect = Effect.fn("CsvFormatter.formatCsvDocumentEffect")(function* (
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
  options: CsvCodecOptions
): Effect.fn.Return<string, CsvError> {
  const header = yield* formatCsvHeaderRow(headers, options);
  const dataRows = yield* Effect.forEach(rows, (row) => formatCsvDataRow(row, options));
  return pipe([header, ...dataRows], A.join(rowDelimiter));
});

/**
 * Format a whole CSV document.
 *
 * **Example** (Format full CSV document)
 *
 * ```ts import.meta.vitest name="Format full CSV document"
 * import { Effect } from "effect"
 * import { CsvCodecOptions } from "@beep/schema/CsvCodecOptions"
 * import { formatCsvDocument } from "@beep/schema/CsvFormatter"
 *
 * const csv = Effect.runSync(formatCsvDocument(["name"], [["Ada"]], CsvCodecOptions.make({})))
 * console.log(csv)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatCsvDocument: {
  (
    headers: ReadonlyArray<string>,
    rows: ReadonlyArray<ReadonlyArray<string>>,
    options: CsvCodecOptions
  ): Effect.Effect<string, CsvError>;
  (
    rows: ReadonlyArray<ReadonlyArray<string>>,
    options: CsvCodecOptions
  ): (headers: ReadonlyArray<string>) => Effect.Effect<string, CsvError>;
} = dual(3, formatCsvDocumentEffect);

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { formatCsvDocument as format };
