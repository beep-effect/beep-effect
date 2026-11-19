/**
 * A workbook as this package holds it: its date system, its sheets with their rows of cells, merged ranges and
 * hidden rows and columns, and the names of the parts it saw and does not model.
 *
 * @packageDocumentation
 */

import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { builtinFormats } from "./internal/numberFormat.ts";
import { isXmlSafe } from "./internal/text.ts";
import { MAX_COLUMN, MAX_ROW, XlsxAddress, XlsxColumn, XlsxRange, XlsxRowNumber } from "./XlsxAddress.schema.ts";
import { holdsSomething, XlsxCell, XlsxNumberFormat } from "./XlsxCell.schema.ts";
import { XlsxDateSystem } from "./XlsxSerial.schema.ts";

const $I = $XlsxId.create("XlsxWorkbook");

/**
 * Whether a sheet is shown, hidden, or hidden so that only a macro can show it.
 *
 * @category schemas
 */
export const XlsxSheetState = LiteralKit(["visible", "hidden", "veryHidden"]).pipe(
  $I.annoteSchema("XlsxSheetState", { description: "Whether a sheet is shown, hidden, or hidden from the menus too" })
);

/**
 * Runtime type of {@link XlsxSheetState}.
 *
 * @category models
 */
export type XlsxSheetState = typeof XlsxSheetState.Type;

const uniqueBy = <T>(key: (value: T) => unknown, expected: string) =>
  S.makeFilter<ReadonlyArray<T>>(
    (values) => A.dedupeWith(values, (a, b) => key(a) === key(b)).length === values.length,
    {
      expected,
      arbitraryConstraint: { uniqueBy: key },
    }
  );

/**
 * One row of a sheet: its number, whether it is hidden, and the cells that hold something, no column twice. The
 * reader hands the cells in rising column order.
 *
 * @category models
 */
export class XlsxRow extends S.Opaque<XlsxRow, { readonly brand: unique symbol }>()(
  S.Struct({
    number: XlsxRowNumber.pipe(S.annotateKey({ description: "The row's number, from 1" })),
    hidden: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the row is hidden" }),
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    cells: S.Array(XlsxCell.annotateKey({ description: "One cell" }))
      .check(
        S.isMaxLength(MAX_COLUMN + 1),
        uniqueBy((cell: { readonly column: number }) => cell.column, "cells with no column twice")
      )
      .pipe(S.annotateKey({ description: "The row's cells, no column twice" })),
  }).pipe($I.annoteSchema("XlsxRow", { description: "One row of a sheet" }))
) {
  /** Whether no cell of the row holds a value a person would count as data. */
  static readonly isBlank = (row: Pick<XlsxRow, "cells">): boolean =>
    A.every(row.cells, (cell) => !holdsSomething(cell.value));

  /** The cell at a column, when the row has one there. */
  static readonly cellAt = (row: Pick<XlsxRow, "cells">, column: XlsxColumn): O.Option<XlsxRow["cells"][number]> =>
    A.findFirst(row.cells, (cell) => cell.column === column);
}

/**
 * A sheet's name. Excel allows 1 to 31 characters and none of `: \ / ? * [ ]`; other programs write longer names and
 * a file's sheet is still read, so the schema asks only for a name XML can carry. `fitsExcel` says whether Excel
 * would take it.
 *
 * @category schemas
 */
export const XlsxSheetName = S.String.check(
  S.isMinLength(1),
  S.isMaxLength(255),
  S.makeFilter((name: string) => isXmlSafe(name), { expected: "a name without control characters" })
).pipe($I.annoteSchema("XlsxSheetName", { description: "A sheet's name" }));

const forbiddenInName = /[:\\/?*[\]]/;

/**
 * Whether Excel itself would accept a sheet name: at most 31 characters and none of `: \ / ? * [ ]`.
 *
 * @category utilities
 */
export const fitsExcel = (name: XlsxSheetName): boolean => name.length <= 31 && !forbiddenInName.test(name);

/**
 * Runtime type of {@link XlsxSheetName}.
 *
 * @category models
 */
export type XlsxSheetName = typeof XlsxSheetName.Type;

/**
 * What the workbook part alone says of a sheet. `declared` is the extent the file claims for it, kept as a claim and
 * never used to decide where the data ends.
 *
 * @category models
 */
export class XlsxSheetInfo extends S.Opaque<XlsxSheetInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    name: XlsxSheetName.pipe(S.annotateKey({ description: "The sheet's name" })),
    state: XlsxSheetState.pipe(
      S.annotateKey({ description: "Whether the sheet is shown" }),
      S.withConstructorDefault(Effect.succeed("visible" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("visible" as const))
    ),
    declared: S.Option(XlsxRange).pipe(
      S.annotateKey({ description: "The extent the file claims for the sheet, when it claims one" }),
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultTypeKey(Effect.succeedNone)
    ),
  }).pipe($I.annoteSchema("XlsxSheetInfo", { description: "A sheet's name, state and declared extent" }))
) {}

const count = (maximum: number, description: string) =>
  S.Int.check(S.isBetween({ minimum: 0, maximum })).pipe(S.annotateKey({ description }));

/**
 * What one pass over a sheet learns without keeping it: how many rows it writes, how many of them and how many
 * cells hold something, and its last such row.
 *
 * @category models
 */
export class XlsxSheetCount extends S.Opaque<XlsxSheetCount, { readonly brand: unique symbol }>()(
  S.Struct({
    info: XlsxSheetInfo.pipe(S.annotateKey({ description: "The sheet" })),
    rows: count(MAX_ROW, "Rows the sheet writes, empty ones included"),
    rowsWithValues: count(MAX_ROW, "Rows with at least one cell that holds something"),
    cellsWithValues: count(MAX_ROW * (MAX_COLUMN + 1), "Cells that hold something"),
    lastRow: S.Option(XlsxRowNumber).pipe(
      S.annotateKey({ description: "The last row with a cell that holds something, when there is one" })
    ),
  }).pipe($I.annoteSchema("XlsxSheetCount", { description: "How much a sheet holds" }))
) {}

/**
 * The first id a workbook's own number formats take; lower ids are Excel's.
 *
 * @category constants
 */
export const FIRST_CUSTOM_FORMAT = 164;

/** Excel's own id for each built-in code, the lowest where a code has two. */
const builtinIds: { readonly [code: string]: number } = R.fromEntries(
  A.map(A.reverse(R.toEntries(builtinFormats)), ([id, code]) => [code, Number(id)] as const)
);

const byRowNumber = Order.mapInput(Order.Number, (row: { readonly number: number }) => row.number);
const byColumn = Order.mapInput(Order.Number, (cell: { readonly column: number }) => cell.column);

/**
 * One sheet with its rows. No row number is used twice; the reader hands rows in rising order.
 *
 * @category models
 */
export class XlsxWorksheet extends S.Opaque<XlsxWorksheet, { readonly brand: unique symbol }>()(
  S.Struct({
    info: XlsxSheetInfo.pipe(S.annotateKey({ description: "The sheet's name, state and declared extent" })),
    rows: S.Array(XlsxRow.annotateKey({ description: "One row" }))
      .check(uniqueBy((row: { readonly number: number }) => row.number, "rows with no number twice"))
      .pipe(
        S.annotateKey({ description: "The rows the sheet writes, no number twice" }),
        S.withConstructorDefault(Effect.succeed([])),
        S.withDecodingDefaultTypeKey(Effect.succeed([]))
      ),
    merges: S.Array(XlsxRange.annotateKey({ description: "One merged range" })).pipe(
      S.annotateKey({ description: "The merged ranges" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    hiddenColumns: S.Array(XlsxColumn.annotateKey({ description: "One hidden column" }))
      .check(S.isUnique())
      .pipe(
        S.annotateKey({ description: "The hidden columns" }),
        S.withConstructorDefault(Effect.succeed([])),
        S.withDecodingDefaultTypeKey(Effect.succeed([]))
      ),
  }).pipe($I.annoteSchema("XlsxWorksheet", { description: "One sheet of a workbook" }))
) {
  /** The smallest range that holds every cell with something in it, when the sheet has one. */
  static readonly extent = (sheet: Pick<XlsxWorksheet, "rows">): O.Option<XlsxRange> => {
    let firstRow = MAX_ROW + 1;
    let lastRow = 0;
    let firstColumn = MAX_COLUMN + 1;
    let lastColumn = -1;
    for (const row of sheet.rows) {
      for (const cell of row.cells) {
        if (!holdsSomething(cell.value)) continue;
        firstRow = Math.min(firstRow, row.number);
        lastRow = Math.max(lastRow, row.number);
        firstColumn = Math.min(firstColumn, cell.column);
        lastColumn = Math.max(lastColumn, cell.column);
      }
    }
    return lastRow === 0
      ? O.none()
      : XlsxRange.makeOption({
          first: XlsxAddress.make({ column: firstColumn, row: firstRow }),
          last: XlsxAddress.make({ column: lastColumn, row: lastRow }),
        });
  };

  /** How much a sheet holds, counted from its rows. */
  static readonly count = (sheet: Pick<XlsxWorksheet, "info" | "rows">): XlsxSheetCount => {
    let rowsWithValues = 0;
    let cellsWithValues = 0;
    let lastRow = 0;
    for (const row of sheet.rows) {
      const held = A.reduce(row.cells, 0, (n, cell) => (holdsSomething(cell.value) ? n + 1 : n));
      if (held === 0) continue;
      rowsWithValues += 1;
      cellsWithValues += held;
      lastRow = Math.max(lastRow, row.number);
    }
    return XlsxSheetCount.make({
      info: sheet.info,
      rows: sheet.rows.length,
      rowsWithValues,
      cellsWithValues,
      lastRow: lastRow === 0 ? O.none() : O.some(lastRow),
    });
  };

  /** The smallest range that holds every cell the sheet writes, formulas without a result included. */
  static readonly written = (sheet: Pick<XlsxWorksheet, "rows">): O.Option<XlsxRange> => {
    let firstRow = MAX_ROW + 1;
    let lastRow = 0;
    let firstColumn = MAX_COLUMN + 1;
    let lastColumn = -1;
    for (const row of sheet.rows) {
      for (const cell of row.cells) {
        if (cell.value.kind === "Blank" && O.isNone(cell.formula)) continue;
        firstRow = Math.min(firstRow, row.number);
        lastRow = Math.max(lastRow, row.number);
        firstColumn = Math.min(firstColumn, cell.column);
        lastColumn = Math.max(lastColumn, cell.column);
      }
    }
    return lastRow === 0
      ? O.none()
      : XlsxRange.makeOption({
          first: XlsxAddress.make({ column: firstColumn, row: firstRow }),
          last: XlsxAddress.make({ column: lastColumn, row: lastRow }),
        });
  };
}

/**
 * What kind of part a workbook held that this package does not model.
 *
 * @category schemas
 */
export const XlsxDroppedKind = LiteralKit([
  "theme",
  "styles",
  "drawing",
  "chart",
  "comments",
  "table",
  "pivot",
  "macros",
  "externalLink",
  "properties",
  "other",
]).pipe($I.annoteSchema("XlsxDroppedKind", { description: "What kind of part was read past" }));

/**
 * Runtime type of {@link XlsxDroppedKind}.
 *
 * @category models
 */
export type XlsxDroppedKind = typeof XlsxDroppedKind.Type;

/**
 * A part the workbook held that this package does not model, and so does not write back.
 *
 * @category models
 */
export class XlsxDroppedPart extends S.Opaque<XlsxDroppedPart, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String.check(S.isMaxLength(1024)).pipe(S.annotateKey({ description: "The part's path in the archive" })),
    kind: XlsxDroppedKind.pipe(S.annotateKey({ description: "What kind of part it is" })),
  }).pipe($I.annoteSchema("XlsxDroppedPart", { description: "A part that was read past and is not written back" }))
) {}

/**
 * A workbook: the decoded side of every codec of this package. Sheet names are unique without regard to case.
 *
 * @category models
 */
export class XlsxWorkbook extends S.Opaque<XlsxWorkbook, { readonly brand: unique symbol }>()(
  S.Struct({
    dateSystem: XlsxDateSystem.pipe(
      S.annotateKey({ description: "The day the workbook's date serials count from" }),
      S.withConstructorDefault(Effect.succeed("1900" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("1900" as const))
    ),
    sheets: S.NonEmptyArray(XlsxWorksheet.annotateKey({ description: "One sheet" }))
      .check(
        uniqueBy(
          (sheet: { readonly info: { readonly name: string } }) => Str.toLowerCase(sheet.info.name),
          "sheets with no name twice, whatever the case"
        )
      )
      .pipe(S.annotateKey({ description: "The sheets, in the workbook's order" })),
    dropped: S.Array(XlsxDroppedPart.annotateKey({ description: "One part" })).pipe(
      S.annotateKey({ description: "Parts the file held that are not modelled and not written back" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
  }).pipe($I.annoteSchema("XlsxWorkbook", { description: "A workbook's values, sheet by sheet" }))
) {
  /**
   * The workbook as a file gives it back, which is what a write followed by a read returns: rows in rising order,
   * each row's cells in rising column order and in their canonical form, no cell that holds nothing and has no
   * formula, merged ranges with their top-left corner first, hidden columns in rising order, each sheet's declared
   * extent the extent of what it writes, number format ids as a written file numbers them (Excel's own id for a
   * built-in code, 164 and up for the others in the order they are met), and no dropped part.
   */
  static readonly canonical = (workbook: Pick<XlsxWorkbook, "dateSystem" | "sheets">): XlsxWorkbook => {
    const ids = MutableHashMap.empty<string, number>();
    let next = FIRST_CUSTOM_FORMAT;
    const idOf = (code: string): number => {
      const known = O.orElse(MutableHashMap.get(ids, code), () => R.get(builtinIds, code));
      if (O.isSome(known)) return known.value;
      const id = next;
      next += 1;
      MutableHashMap.set(ids, code, id);
      return id;
    };
    const sheets = A.map(workbook.sheets, (sheet) => {
      const rows = A.map(A.sort(sheet.rows, byRowNumber), (row) =>
        XlsxRow.make({
          number: row.number,
          hidden: row.hidden,
          cells: A.map(
            A.sort(
              A.filter(row.cells, (cell) => cell.value.kind !== "Blank" || O.isSome(cell.formula)),
              byColumn
            ),
            (cell) => {
              const canonical = XlsxCell.canonical(cell);
              return XlsxCell.make({
                column: canonical.column,
                value: canonical.value,
                formula: canonical.formula,
                format: XlsxNumberFormat.make({ id: idOf(canonical.format.code), code: canonical.format.code }),
              });
            }
          ),
        })
      );
      return XlsxWorksheet.make({
        info: XlsxSheetInfo.make({
          name: sheet.info.name,
          state: sheet.info.state,
          declared: XlsxWorksheet.written({ rows }),
        }),
        rows,
        merges: A.map(sheet.merges, XlsxRange.ordered),
        hiddenColumns: A.sort(sheet.hiddenColumns, Order.Number),
      });
    });
    return XlsxWorkbook.make({ dateSystem: workbook.dateSystem, sheets, dropped: [] });
  };

  /** The sheet of a name, whatever the case, when the workbook has it. */
  static readonly sheet = (
    workbook: Pick<XlsxWorkbook, "sheets">,
    name: string
  ): O.Option<XlsxWorkbook["sheets"][number]> =>
    A.findFirst(workbook.sheets, (sheet) => Str.toLowerCase(sheet.info.name) === Str.toLowerCase(name));

  /** The sheets a person sees in Excel's tabs. */
  static readonly visible = (workbook: Pick<XlsxWorkbook, "sheets">): ReadonlyArray<XlsxWorkbook["sheets"][number]> =>
    A.filter(workbook.sheets, (sheet) => sheet.info.state === "visible");
}
