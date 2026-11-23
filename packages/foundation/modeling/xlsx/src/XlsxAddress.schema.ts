/**
 * Where a cell is on a sheet: a 0-based column, a 1-based row as Excel numbers them, an address such as `B7` and a
 * range such as `A1:C3`. Every position is bounded by what a worksheet can hold, so a generated one is real.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $XlsxId.create("XlsxAddress");

/**
 * The last column a worksheet has, 0-based: `XFD`.
 *
 * **Example** (The last column's letters)
 *
 * ```ts import.meta.vitest name="The last column's letters"
 * import { columnLetters, MAX_COLUMN } from "@beep/xlsx/XlsxAddress.schema"
 *
 * MAX_COLUMN // => 16383
 * columnLetters(MAX_COLUMN) // => "XFD"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_COLUMN = 16_383;

/**
 * The last row a worksheet has.
 *
 * **Example** (A row past the last one)
 *
 * ```ts import.meta.vitest name="A row past the last one"
 * import { MAX_ROW, XlsxRowNumber } from "@beep/xlsx/XlsxAddress.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxRowNumber)(MAX_ROW) // => true
 * S.is(XlsxRowNumber)(MAX_ROW + 1) // => false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_ROW = 1_048_576;

/**
 * **Example** (Check a column)
 *
 * ```ts import.meta.vitest name="Check a column"
 * import { XlsxColumn } from "@beep/xlsx/XlsxAddress.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxColumn)(0) // => true
 * S.is(XlsxColumn)(16_384) // => false
 * S.is(XlsxColumn)(1.5) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxColumn = S.Int.check(S.isBetween({ minimum: 0, maximum: MAX_COLUMN })).pipe(
  $I.annoteSchema("XlsxColumn", { description: "A 0-based worksheet column, A being 0 and XFD 16,383" })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type XlsxColumn = typeof XlsxColumn.Type;

/**
 * **Example** (Rows start at 1)
 *
 * ```ts import.meta.vitest name="Rows start at 1"
 * import { XlsxRowNumber } from "@beep/xlsx/XlsxAddress.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxRowNumber)(1) // => true
 * S.is(XlsxRowNumber)(0) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxRowNumber = S.Int.check(S.isBetween({ minimum: 1, maximum: MAX_ROW })).pipe(
  $I.annoteSchema("XlsxRowNumber", { description: "A worksheet row as Excel numbers it, from 1 to 1,048,576" })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type XlsxRowNumber = typeof XlsxRowNumber.Type;

/**
 * The letters Excel shows for a column.
 *
 * **Example** (Letters of a column)
 *
 * ```ts import.meta.vitest name="Letters of a column"
 * import { columnLetters } from "@beep/xlsx/XlsxAddress.schema"
 *
 * columnLetters(0) // => "A"
 * columnLetters(25) // => "Z"
 * columnLetters(27) // => "AB"
 * ```
 *
 * @see {@link columnFromLetters} for the reverse direction.
 * @category formatting
 * @since 0.0.0
 */
export const columnLetters = (column: XlsxColumn): string => {
  let n = column + 1;
  let letters = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
};

/**
 * The column a run of letters names, when it is one a worksheet has. Lower case is accepted.
 *
 * **Example** (Column of letters)
 *
 * ```ts import.meta.vitest name="Column of letters"
 * import { columnFromLetters } from "@beep/xlsx/XlsxAddress.schema"
 * import * as O from "effect/Option"
 *
 * columnFromLetters("AB") // => O.some(27)
 * columnFromLetters("ab") // => O.some(27)
 * columnFromLetters("XFE") // => O.none()
 * ```
 *
 * @see {@link columnLetters} for the reverse direction.
 * @category parsing
 * @since 0.0.0
 */
export const columnFromLetters = (letters: string): O.Option<XlsxColumn> => {
  if (letters.length === 0 || letters.length > 3) return O.none();
  let n = 0;
  for (const letter of Str.toUpperCase(letters)) {
    const place = Str.indexOf(letter)(ALPHABET);
    if (O.isNone(place)) return O.none();
    n = n * 26 + place.value + 1;
  }
  return n - 1 > MAX_COLUMN ? O.none() : O.some(n - 1);
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const addressPattern = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]{0,6})$/;
const rangePattern = /^([^:]+)(?::([^:]+))?$/;

/**
 * One cell's place: its column and its row.
 *
 * **Example** (Parse and format)
 *
 * ```ts import.meta.vitest name="Parse and format"
 * import { XlsxAddress } from "@beep/xlsx/XlsxAddress.schema"
 * import * as O from "effect/Option"
 *
 * const address = XlsxAddress.make({ column: 1, row: 7 })
 * XlsxAddress.format(address) // => "B7"
 * O.map(XlsxAddress.parse("$B$7"), XlsxAddress.format) // => O.some("B7")
 * O.isNone(XlsxAddress.parse("B0")) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxAddress extends S.Opaque<XlsxAddress, { readonly brand: unique symbol }>()(
  S.Struct({
    column: XlsxColumn.pipe(S.annotateKey({ description: "The cell's 0-based column" })),
    row: XlsxRowNumber.pipe(S.annotateKey({ description: "The cell's row, from 1" })),
  }).pipe($I.annoteSchema("XlsxAddress", { description: "One cell's place on a sheet" }))
) {
  /** The address a reference such as `B7` or `$B$7` names, when it is on the sheet. */
  static readonly parse = (reference: string): O.Option<XlsxAddress> => {
    const found = addressPattern.exec(reference);
    if (found === null) return O.none();
    const row = Number(found[2]);
    if (row > MAX_ROW) return O.none();
    return O.map(columnFromLetters(found[1] ?? ""), (column) => XlsxAddress.make({ column, row }));
  };

  /** The reference Excel writes for an address: `B7`. */
  static readonly format = (address: Pick<XlsxAddress, "column" | "row">): string =>
    `${columnLetters(address.column)}${address.row}`;
}

/**
 * A rectangle of cells, named by two opposite corners. A range read from a file or parsed from a reference has its
 * top-left corner first; one built by hand may have its corners either way round, and `ordered` puts them right.
 *
 * **Example** (Parse a range)
 *
 * ```ts import.meta.vitest name="Parse a range"
 * import { XlsxAddress, XlsxRange } from "@beep/xlsx/XlsxAddress.schema"
 * import * as O from "effect/Option"
 *
 * O.map(XlsxRange.parse("C3:A1"), XlsxRange.format) // => O.some("A1:C3")
 * O.map(XlsxRange.parse("B2"), XlsxRange.format) // => O.some("B2:B2")
 * O.exists(XlsxRange.parse("A1:C3"), (range) =>
 *   XlsxRange.contains(range, XlsxAddress.make({ column: 1, row: 2 }))
 * ) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxRange extends S.Opaque<XlsxRange, { readonly brand: unique symbol }>()(
  S.Struct({
    first: XlsxAddress,
    last: XlsxAddress,
  }).pipe(
    $I.annoteSchema("XlsxRange", {
      description:
        "A rectangle of cells, by two opposite corners: `first`, the top-left one once ordered, and `last`, the bottom-right one",
    })
  )
) {
  /** The same rectangle with its top-left corner first and its bottom-right corner last. */
  static readonly ordered = (range: Pick<XlsxRange, "first" | "last">): XlsxRange =>
    XlsxRange.make({
      first: XlsxAddress.make({
        column: Math.min(range.first.column, range.last.column),
        row: Math.min(range.first.row, range.last.row),
      }),
      last: XlsxAddress.make({
        column: Math.max(range.first.column, range.last.column),
        row: Math.max(range.first.row, range.last.row),
      }),
    });

  /** The range a reference such as `A1:C3` names, ordered; one cell alone is the range of that cell. */
  static readonly parse = (reference: string): O.Option<XlsxRange> => {
    const found = rangePattern.exec(reference);
    if (found === null) return O.none();
    const first = XlsxAddress.parse(found[1] ?? "");
    const last = found[2] === undefined ? first : XlsxAddress.parse(found[2]);
    return O.flatMap(first, (a) => O.map(last, (b) => XlsxRange.ordered({ first: a, last: b })));
  };

  /** The reference Excel writes for a range, top-left corner first: `A1:C3`. */
  static readonly format = (range: Pick<XlsxRange, "first" | "last">): string => {
    const ordered = XlsxRange.ordered(range);
    return `${XlsxAddress.format(ordered.first)}:${XlsxAddress.format(ordered.last)}`;
  };

  /** Whether an address lies inside a range. */
  static readonly contains = (
    range: Pick<XlsxRange, "first" | "last">,
    address: Pick<XlsxAddress, "column" | "row">
  ): boolean => {
    const ordered = XlsxRange.ordered(range);
    return (
      address.column >= ordered.first.column &&
      address.column <= ordered.last.column &&
      address.row >= ordered.first.row &&
      address.row <= ordered.last.row
    );
  };
}
