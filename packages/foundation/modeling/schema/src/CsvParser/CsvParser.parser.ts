/**
 * Whole-text CSV parsing helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { A, Str, thunkFalse } from "@beep/utils";
import { Effect, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { csvError } from "../CsvError/index.ts";
import { isNonNegative } from "../Number.ts";
import type { CsvError } from "../CsvError/index.ts";
import type { ParserOptions } from "../ParserOptions/index.ts";

const $I = $SchemaId.create("CsvParser");

const BOM = "\ufeff";

const charAt = (input: string, index: number): string | undefined => pipe(input, Str.at(index), O.getOrUndefined);

const removeBom = (input: string): string => (charAt(input, 0) === BOM ? Str.slice(1)(input) : input);

const getRowDelimiterLength = (input: string, cursor: number): number => {
  const current = charAt(input, cursor);
  const next = charAt(input, cursor + 1);

  if (current === "\r" && next === "\n") {
    return 2;
  }

  if (current === "\r" || current === "\n") {
    return 1;
  }

  return 0;
};

const isInlineWhitespace = (character: string): boolean =>
  /\s/.test(character) && character !== "\r" && character !== "\n";

const normalizeColumn = (value: string, parserOptions: ParserOptions): string => {
  if (parserOptions.trim) {
    return Str.trim(value);
  }

  if (parserOptions.ltrim) {
    return Str.trimStart(value);
  }

  if (parserOptions.rtrim) {
    return Str.trimEnd(value);
  }

  return value;
};

const isEmptyRow = (row: ReadonlyArray<string>): boolean => pipe(row, A.join(""), Str.replace(/\s+/g, "")) === "";

const getQuotedFieldStart = (input: string, cursor: number, parserOptions: ParserOptions): O.Option<number> => {
  if (O.isNone(parserOptions.quote)) {
    return O.none();
  }

  const quote = parserOptions.quote.value;
  let currentCursor = cursor;

  while (currentCursor < input.length) {
    const rowDelimiterLength = getRowDelimiterLength(input, currentCursor);

    if (rowDelimiterLength > 0 || charAt(input, currentCursor) === parserOptions.delimiter) {
      return O.none();
    }

    const character = charAt(input, currentCursor);

    if (!P.isString(character)) {
      return O.none();
    }

    if (isInlineWhitespace(character)) {
      currentCursor += 1;
      continue;
    }

    return character === quote ? O.some(currentCursor) : O.none();
  }

  return O.none();
};

/**
 * Parsed CSV field with the cursor position after the field and normalized
 * string value.
 *
 * @example
 * ```ts
 * import { ParsedField } from "@beep/schema/CsvParser"
 *
 * const field = ParsedField.make({ cursor: 4, value: "Ada" })
 * console.log(field.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParsedField extends S.Class<ParsedField>($I`ParsedField`)(
  {
    cursor: S.Int.check(isNonNegative),
    value: S.String,
  },
  $I.annote("ParsedField", {
    description: "A Parsed CSV Field",
  })
) {}

const parseQuotedField = (
  input: string,
  quoteStart: number,
  parserOptions: ParserOptions
): Effect.Effect<ParsedField, CsvError, never> => {
  if (O.isNone(parserOptions.quote)) {
    return Effect.fail(csvError("Quoted field parsing requires a configured quote character.", quoteStart));
  }

  const quote = parserOptions.quote.value;
  const escapeChar = O.getOrElse(() => quote)(parserOptions.escapeChar);
  let cursor = quoteStart + 1;
  let value = "";
  let foundClosingQuote = false;

  while (cursor < input.length) {
    const character = charAt(input, cursor);

    if (!P.isString(character)) {
      break;
    }

    if (character === escapeChar) {
      const next = charAt(input, cursor + 1);

      if (next === quote || next === escapeChar) {
        value = `${value}${next}`;
        cursor += 2;
        continue;
      }

      if (character === quote) {
        foundClosingQuote = true;
        cursor += 1;
        break;
      }

      value = `${value}${character}`;
      cursor += 1;
      continue;
    }

    if (character === quote) {
      foundClosingQuote = true;
      cursor += 1;
      break;
    }

    value = `${value}${character}`;
    cursor += 1;
  }

  if (!foundClosingQuote) {
    return Effect.fail(csvError(`Parse Error: missing closing quote '${quote}'.`, quoteStart));
  }

  while (cursor < input.length) {
    const rowDelimiterLength = getRowDelimiterLength(input, cursor);

    if (rowDelimiterLength > 0 || charAt(input, cursor) === parserOptions.delimiter) {
      break;
    }

    const character = charAt(input, cursor);

    if (P.isString(character) && isInlineWhitespace(character)) {
      cursor += 1;
      continue;
    }

    return Effect.fail(
      csvError(`Parse Error: expected delimiter or newline after closing quote, received '${character ?? ""}'.`, cursor)
    );
  }

  return Effect.succeed({
    cursor,
    value: normalizeColumn(value, parserOptions),
  });
};

const parseUnquotedField = (input: string, cursor: number, parserOptions: ParserOptions): ParsedField => {
  let currentCursor = cursor;
  let value = "";

  while (currentCursor < input.length) {
    const rowDelimiterLength = getRowDelimiterLength(input, currentCursor);

    if (rowDelimiterLength > 0 || charAt(input, currentCursor) === parserOptions.delimiter) {
      break;
    }

    const character = charAt(input, currentCursor);

    if (!P.isString(character)) {
      break;
    }

    value = `${value}${character}`;
    currentCursor += 1;
  }

  return {
    cursor: currentCursor,
    value: normalizeColumn(value, parserOptions),
  };
};

const parseField = (
  input: string,
  cursor: number,
  parserOptions: ParserOptions
): Effect.Effect<ParsedField, CsvError, never> => {
  const rowDelimiterLength = getRowDelimiterLength(input, cursor);

  if (rowDelimiterLength > 0 || charAt(input, cursor) === parserOptions.delimiter || cursor >= input.length) {
    return Effect.succeed({
      cursor,
      value: "",
    });
  }

  return pipe(
    getQuotedFieldStart(input, cursor, parserOptions),
    O.match({
      onNone: () => Effect.succeed(parseUnquotedField(input, cursor, parserOptions)),
      onSome: (quoteStart) => parseQuotedField(input, quoteStart, parserOptions),
    })
  );
};

/**
 * Parsed CSV row with the cursor position after the row and raw field values.
 *
 * @example
 * ```ts
 * import { ParsedRow } from "@beep/schema/CsvParser"
 *
 * const row = ParsedRow.make({ cursor: 8, row: ["Ada", "36"] })
 * console.log(row.row.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParsedRow extends S.Class<ParsedRow>($I`ParsedRow`)(
  {
    cursor: S.Int.check(isNonNegative),
    row: S.Array(S.String),
  },
  $I.annote("ParsedRow", {
    description: "A parsed row",
  })
) {}

const parseRowAt = Effect.fn("CsvParser.parseRowAt")(function* (
  input: string,
  cursor: number,
  parserOptions: ParserOptions
): Effect.fn.Return<ParsedRow, CsvError> {
  let currentCursor = cursor;
  let row = A.empty<string>();

  while (true) {
    const rowDelimiterLength = getRowDelimiterLength(input, currentCursor);

    if (rowDelimiterLength > 0) {
      return {
        cursor: currentCursor + rowDelimiterLength,
        row,
      };
    }

    if (currentCursor >= input.length) {
      return {
        cursor: currentCursor,
        row,
      };
    }

    const field = yield* parseField(input, currentCursor, parserOptions);
    row = A.append(row, field.value);
    currentCursor = field.cursor;

    const nextRowDelimiterLength = getRowDelimiterLength(input, currentCursor);

    if (nextRowDelimiterLength > 0) {
      return {
        cursor: currentCursor + nextRowDelimiterLength,
        row,
      };
    }

    if (currentCursor >= input.length) {
      return {
        cursor: currentCursor,
        row,
      };
    }

    if (charAt(input, currentCursor) === parserOptions.delimiter) {
      currentCursor += 1;

      if (currentCursor >= input.length) {
        row = A.append(row, "");
        return {
          cursor: currentCursor,
          row,
        };
      }

      const trailingDelimiterLength = getRowDelimiterLength(input, currentCursor);

      if (trailingDelimiterLength > 0) {
        row = A.append(row, "");
        return {
          cursor: currentCursor + trailingDelimiterLength,
          row,
        };
      }

      continue;
    }

    return yield* csvError("Parse Error: parser cursor did not terminate on a delimiter or newline.", currentCursor);
  }
});

const advancePastComment = (input: string, cursor: number): number => {
  let currentCursor = cursor;

  while (currentCursor < input.length) {
    const rowDelimiterLength = getRowDelimiterLength(input, currentCursor);

    if (rowDelimiterLength > 0) {
      return currentCursor + rowDelimiterLength;
    }

    currentCursor += 1;
  }

  return currentCursor;
};

const isCommentStart = (input: string, cursor: number, parserOptions: ParserOptions): boolean =>
  O.match(parserOptions.comment, {
    onNone: thunkFalse,
    onSome: (comment) => charAt(input, cursor) === comment,
  });

const parseCsvRowsEffect = Effect.fn("CsvParser.parseCsvRowsEffect")(function* (
  input: string,
  parserOptions: ParserOptions
): Effect.fn.Return<ReadonlyArray<ReadonlyArray<string>>, CsvError> {
  const source = removeBom(input);
  let cursor = 0;
  let rows = A.empty<ReadonlyArray<string>>();

  while (cursor < source.length) {
    if (isCommentStart(source, cursor, parserOptions)) {
      cursor = advancePastComment(source, cursor);
      continue;
    }

    const parsedRow = yield* parseRowAt(source, cursor, parserOptions);
    cursor = parsedRow.cursor;

    if (!(parserOptions.ignoreEmpty && isEmptyRow(parsedRow.row))) {
      rows = A.append(rows, parsedRow.row);
    }
  }

  return rows;
});

/**
 * Parse full CSV text into raw row arrays using low-level parser options.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { parseCsvRows } from "@beep/schema/CsvParser"
 * import { ParserOptions } from "@beep/schema/ParserOptions"
 *
 * const rows = Effect.runSync(parseCsvRows("name,age\nAda,36", ParserOptions.new()))
 * console.log(rows.length)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const parseCsvRows: {
  (input: string, parserOptions: ParserOptions): Effect.Effect<ReadonlyArray<ReadonlyArray<string>>, CsvError, never>;
  (
    parserOptions: ParserOptions
  ): (input: string) => Effect.Effect<ReadonlyArray<ReadonlyArray<string>>, CsvError, never>;
} = dual(2, parseCsvRowsEffect);

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { parseCsvRows as parse };
