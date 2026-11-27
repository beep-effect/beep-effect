/**
 * A workbook as this package holds it: its date system, its sheets with their rows of cells, merged ranges and
 * hidden rows and columns, and the names of the parts it saw and does not model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { builtinIds } from "./internal/numberFormat.ts";
import { XmlSafeText } from "./internal/text.ts";
import { MAX_COLUMN, MAX_ROW, XlsxAddress, XlsxColumn, XlsxRange, XlsxRowNumber } from "./XlsxAddress.schema.ts";
import { holdsSomething, MAX_CELL_CHARS, XlsxCell, XlsxNumberFormat, XlsxValue } from "./XlsxCell.schema.ts";
import { XlsxDateSystem } from "./XlsxSerial.schema.ts";

const $I = $XlsxId.create("XlsxWorkbook");

/**
 * Whether a sheet is shown, hidden, or hidden so that only a macro can show it.
 *
 * **Example** (Hide a sheet from Excel's tabs)
 *
 * ```ts import.meta.vitest name="Hide a sheet from Excel's tabs"
 * import { XlsxSheetInfo, XlsxSheetState, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as S from "effect/Schema"
 *
 * const workbook = XlsxWorkbook.make({
 *   sheets: [
 *     XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Report" }) }),
 *     XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Lookup", state: "veryHidden" }) })
 *   ]
 * })
 * XlsxWorkbook.visible(workbook).map((sheet) => sheet.info.name) // => ["Report"]
 * S.is(XlsxSheetState)("collapsed") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxSheetState = LiteralKit(["visible", "hidden", "veryHidden"]).pipe(
  $I.annoteSchema("XlsxSheetState", { description: "Whether a sheet is shown, hidden, or hidden from the menus too" })
);

/**
 * `"visible"`, `"hidden"` or `"veryHidden"`; the type {@link XlsxSheetState} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxSheetState = typeof XlsxSheetState.Type;

const uniqueBy = <T>(
  key: (value: T) => number | string,
  name: string,
  annotations: { readonly title: string; readonly description: string; readonly expected: string }
) =>
  S.makeFilter<ReadonlyArray<T>>(
    (values) => A.dedupe(A.map(values, key)).length === values.length,
    $I.annote(name, { ...annotations, arbitraryConstraint: { uniqueBy: key } })
  );

/**
 * A sheet's merged ranges, no range twice. Excel repairs a sheet that merges one range twice, so the reader keeps
 * each once and the writer never writes a repeat.
 *
 * **Example** (A range merged twice)
 *
 * ```ts import.meta.vitest name="A range merged twice"
 * import { XlsxRange } from "@beep/xlsx/XlsxAddress.schema"
 * import { XlsxMerges } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const range = O.getOrThrow(XlsxRange.parse("A1:B2"))
 * S.is(XlsxMerges)([range]) // => true
 * S.is(XlsxMerges)([range, range]) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxMerges = S.Array(XlsxRange)
  .check(
    uniqueBy(XlsxRange.format, "UniqueMerges", {
      title: "Unique merged ranges",
      description: "A sheet merges each range at most once",
      expected: "merged ranges with no range twice",
    })
  )
  .pipe($I.annoteSchema("XlsxMerges", { description: "A sheet's merged ranges, no range twice" }));

/**
 * A sheet's merged ranges, each once; the type {@link XlsxMerges} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxMerges = typeof XlsxMerges.Type;

/**
 * A sheet's hidden columns, each once. The reader gives them in rising order and `XlsxWorkbook.canonical` puts a
 * hand-built list in that order, as it does a sheet's rows and a row's cells, which their schemas likewise hold to
 * no repeat and leave in any order.
 *
 * **Example** (A column hidden twice)
 *
 * ```ts import.meta.vitest name="A column hidden twice"
 * import { XlsxHiddenColumns } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxHiddenColumns)([1, 2, 5]) // => true
 * S.is(XlsxHiddenColumns)([5, 2]) // => true
 * S.is(XlsxHiddenColumns)([2, 2]) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxHiddenColumns = S.Array(XlsxColumn)
  .check(
    uniqueBy(identity<number>, "UniqueHiddenColumns", {
      title: "Unique hidden columns",
      description: "A sheet hides each column at most once",
      expected: "hidden columns with no column twice",
    })
  )
  .pipe($I.annoteSchema("XlsxHiddenColumns", { description: "A sheet's hidden columns, each once" }));

/**
 * @category type-level
 * @since 0.0.0
 */
export type XlsxHiddenColumns = typeof XlsxHiddenColumns.Type;

/**
 * One row of a sheet: its number, whether it is hidden, and the cells that hold something, no column twice. The
 * reader hands the cells in rising column order.
 *
 * **Example** (Find a cell in a row)
 *
 * ```ts import.meta.vitest name="Find a cell in a row"
 * import { XlsxCell, XlsxText } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxRow } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as O from "effect/Option"
 *
 * const row = XlsxRow.make({
 *   number: 2,
 *   cells: [
 *     XlsxCell.make({ column: 0, value: XlsxText.make({ text: "A-1" }) }),
 *     XlsxCell.make({ column: 2, value: XlsxText.make({ text: "" }) })
 *   ]
 * })
 * O.isSome(XlsxRow.cellAt(row, 0)) // => true
 * O.isNone(XlsxRow.cellAt(row, 1)) // => true
 * XlsxRow.isBlank(row) // => false
 * row.hidden // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxRow extends S.Opaque<XlsxRow, { readonly brand: unique symbol }>()(
  S.Struct({
    number: XlsxRowNumber.pipe(S.annotateKey({ description: "The row's number, from 1" })),
    hidden: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the row is hidden" }),
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    cells: S.Array(XlsxCell)
      .check(
        S.isMaxLength(MAX_COLUMN + 1),
        uniqueBy((cell: XlsxCell) => cell.column, "UniqueCellColumns", {
          title: "Unique cell columns",
          description: "A row holds at most one cell in each column",
          expected: "cells with no column twice",
        })
      )
      .pipe(S.annotateKey({ description: "The row's cells, no column twice" })),
  }).pipe($I.annoteSchema("XlsxRow", { description: "One row of a sheet" }))
) {
  /** Whether no cell of the row holds a value a person would count as data. */
  static readonly isBlank = (row: Pick<XlsxRow, "cells">): boolean =>
    A.every(row.cells, (cell) => !holdsSomething(cell.value));

  /** The cell at a column, when the row has one there. */
  static readonly cellAt = (row: Pick<XlsxRow, "cells">, column: XlsxColumn): O.Option<XlsxCell> =>
    A.findFirst(row.cells, (cell) => cell.column === column);
}

/**
 * A sheet's name. Excel allows 1 to 31 characters and none of `: \ / ? * [ ]`; other programs write longer names and
 * a file's sheet is still read, so the schema asks only for a name XML can carry. `fitsExcel` says whether Excel
 * would take it.
 *
 * **Example** (Names a file may carry)
 *
 * ```ts import.meta.vitest name="Names a file may carry"
 * import { XlsxSheetName } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxSheetName)("Q1/Q2 sales") // => true
 * S.is(XlsxSheetName)("") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxSheetName = S.String.check(S.isMinLength(1), S.isMaxLength(255), XmlSafeText).pipe(
  $I.annoteSchema("XlsxSheetName", { description: "A sheet's name" })
);

const forbiddenInName = /[:\\/?*[\]]/;

/**
 * Whether Excel itself would accept a sheet name: at most 31 characters, none of `: \ / ? * [ ]`, no apostrophe at
 * either end, and not `History`, in any case, which Excel keeps for its change history.
 *
 * **Gotchas**
 *
 * `Xlsx.stringify` writes a name as the schema holds it and does not ask this; a workbook meant for Excel should
 * pass it for every sheet before it is written. Two names that differ only in case are already refused by the
 * `XlsxWorkbook` schema.
 *
 * **Example** (Names Excel takes)
 *
 * ```ts import.meta.vitest name="Names Excel takes"
 * import { fitsExcel } from "@beep/xlsx/XlsxWorkbook.schema"
 *
 * fitsExcel("Q1 sales") // => true
 * fitsExcel("Q1's sales") // => true
 * fitsExcel("Q1/Q2 sales") // => false
 * fitsExcel("A name that runs past thirty-one characters") // => false
 * fitsExcel("'quoted'") // => false
 * fitsExcel("history") // => false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const fitsExcel = (name: XlsxSheetName): boolean =>
  name.length <= 31 &&
  !forbiddenInName.test(name) &&
  !Str.startsWith("'")(name) &&
  !Str.endsWith("'")(name) &&
  Str.toLowerCase(name) !== "history";

/**
 * A sheet's name as a file may carry it, not always one Excel would take; the type {@link XlsxSheetName} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxSheetName = typeof XlsxSheetName.Type;

/**
 * What the workbook part alone says of a sheet. `declared` is the extent the file claims for it, kept as a claim and
 * never used to decide where the data ends.
 *
 * **Example** (A sheet's starting info)
 *
 * ```ts import.meta.vitest name="A sheet's starting info"
 * import { XlsxSheetInfo } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as O from "effect/Option"
 *
 * const info = XlsxSheetInfo.make({ name: "Items" })
 * info.state // => "visible"
 * O.isNone(info.declared) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Count a sheet built by hand)
 *
 * ```ts import.meta.vitest name="Count a sheet built by hand"
 * import { XlsxCell, XlsxNumber, XlsxText } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxRow, XlsxSheetInfo, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as O from "effect/Option"
 *
 * const count = XlsxWorksheet.count({
 *   info: XlsxSheetInfo.make({ name: "Items" }),
 *   rows: [
 *     XlsxRow.make({ number: 1, cells: [XlsxCell.make({ column: 0, value: XlsxText.make({ text: "qty" }) })] }),
 *     XlsxRow.make({ number: 2, cells: [XlsxCell.make({ column: 0, value: XlsxText.make({ text: "" }) })] }),
 *     XlsxRow.make({ number: 3, cells: [XlsxCell.make({ column: 0, value: XlsxNumber.make({ value: 4 }) })] })
 *   ]
 * })
 * count.rows // => 3
 * count.rowsWithValues // => 2
 * count.lastRow // => O.some(3)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxSheetCount extends S.Opaque<XlsxSheetCount, { readonly brand: unique symbol }>()(
  S.Struct({
    info: XlsxSheetInfo,
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
 * **Example** (A custom code gets the first free id)
 *
 * ```ts import.meta.vitest name="A custom code gets the first free id"
 * import { XlsxCell, XlsxNumber, XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
 * import { FIRST_CUSTOM_FORMAT, XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 *
 * const cell = XlsxCell.make({
 *   column: 0,
 *   value: XlsxNumber.make({ value: 7 }),
 *   format: XlsxNumberFormat.make({ id: 900, code: "000" })
 * })
 * const workbook = XlsxWorkbook.canonical({
 *   dateSystem: "1900",
 *   sheets: [XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Items" }), rows: [XlsxRow.make({ number: 1, cells: [cell] })] })]
 * })
 * workbook.sheets[0].rows[0]?.cells[0]?.format.id // => FIRST_CUSTOM_FORMAT
 * FIRST_CUSTOM_FORMAT // => 164
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FIRST_CUSTOM_FORMAT = 164;

const byRowNumber = Order.mapInput(Order.Number, (row: XlsxRow) => row.number);
const byColumn = Order.mapInput(Order.Number, (cell: XlsxCell) => cell.column);

// decision: hot-paths-are-mutable-loops
const boundsOf = (rows: ReadonlyArray<XlsxRow>, holds: (cell: XlsxCell) => boolean): O.Option<XlsxRange> => {
  let firstRow = MAX_ROW + 1;
  let lastRow = 0;
  let firstColumn = MAX_COLUMN + 1;
  let lastColumn = -1;
  for (const row of rows) {
    for (const cell of row.cells) {
      if (!holds(cell)) continue;
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

const holdsValue = (cell: XlsxCell): boolean => holdsSomething(cell.value);
const isWritten = (cell: XlsxCell): boolean => cell.value.kind !== "Blank" || O.isSome(cell.formula);

/**
 * One sheet with its rows. No row number is used twice; the reader hands rows in rising order.
 *
 * **Example** (Where a sheet's data lies)
 *
 * ```ts import.meta.vitest name="Where a sheet's data lies"
 * import { XlsxRange } from "@beep/xlsx/XlsxAddress.schema"
 * import { XlsxCell, XlsxNumber } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxRow, XlsxSheetInfo, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as O from "effect/Option"
 *
 * const sheet = XlsxWorksheet.make({
 *   info: XlsxSheetInfo.make({ name: "Items" }),
 *   rows: [
 *     XlsxRow.make({ number: 2, cells: [XlsxCell.make({ column: 1, value: XlsxNumber.make({ value: 1 }) })] }),
 *     XlsxRow.make({ number: 5, cells: [XlsxCell.make({ column: 3, value: XlsxNumber.make({ value: 2 }) })] })
 *   ]
 * })
 * O.map(XlsxWorksheet.extent(sheet), XlsxRange.format) // => O.some("B2:D5")
 * sheet.merges.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxWorksheet extends S.Opaque<XlsxWorksheet, { readonly brand: unique symbol }>()(
  S.Struct({
    info: XlsxSheetInfo,
    rows: S.Array(XlsxRow)
      .check(
        uniqueBy((row: XlsxRow) => row.number, "UniqueRowNumbers", {
          title: "Unique row numbers",
          description: "A sheet writes each row number at most once",
          expected: "rows with no number twice",
        })
      )
      .pipe(
        S.annotateKey({ description: "The rows the sheet writes, no number twice" }),
        S.withConstructorDefault(Effect.succeed([])),
        S.withDecodingDefaultTypeKey(Effect.succeed([]))
      ),
    merges: XlsxMerges.pipe(
      S.annotateKey({ description: "The merged ranges, each once" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    hiddenColumns: XlsxHiddenColumns.pipe(
      S.annotateKey({ description: "The hidden columns, each once" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
  }).pipe($I.annoteSchema("XlsxWorksheet", { description: "One sheet of a workbook" }))
) {
  /** The smallest range that holds every cell with something in it, when the sheet has one. */
  static readonly extent = (sheet: Pick<XlsxWorksheet, "rows">): O.Option<XlsxRange> =>
    boundsOf(sheet.rows, holdsValue);

  /** How much a sheet holds, counted from its rows. */
  static readonly count = (sheet: Pick<XlsxWorksheet, "info" | "rows">): XlsxSheetCount => {
    // decision: hot-paths-are-mutable-loops
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
  static readonly written = (sheet: Pick<XlsxWorksheet, "rows">): O.Option<XlsxRange> =>
    boundsOf(sheet.rows, isWritten);
}

/**
 * What kind of part a workbook held that this package does not model.
 *
 * **Example** (Known kinds of part)
 *
 * ```ts import.meta.vitest name="Known kinds of part"
 * import { XlsxDroppedKind } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxDroppedKind)("pivot") // => true
 * S.is(XlsxDroppedKind)("sheet") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
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
 * The kind of a part read past, such as `"chart"`; the type {@link XlsxDroppedKind} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxDroppedKind = typeof XlsxDroppedKind.Type;

/**
 * A part the workbook held that this package does not model, and so does not write back.
 *
 * **Example** (A chart read past)
 *
 * ```ts import.meta.vitest name="A chart read past"
 * import { XlsxDroppedPart } from "@beep/xlsx/XlsxWorkbook.schema"
 *
 * const part = XlsxDroppedPart.make({ path: "xl/charts/chart1.xml", kind: "chart" })
 * part.kind // => "chart"
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Build a workbook and look up a sheet)
 *
 * ```ts import.meta.vitest name="Build a workbook and look up a sheet"
 * import { XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as O from "effect/Option"
 *
 * const workbook = XlsxWorkbook.make({
 *   sheets: [XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Items" }) })]
 * })
 * workbook.dateSystem // => "1900"
 * O.map(XlsxWorkbook.sheet(workbook, "ITEMS"), (sheet) => sheet.info.name) // => O.some("Items")
 * O.isNone(XlsxWorkbook.sheet(workbook, "Notes")) // => true
 * ```
 *
 * **Example** (Sheet names clash whatever the case)
 *
 * ```ts import.meta.vitest name="Sheet names clash whatever the case"
 * import { XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as O from "effect/Option"
 *
 * const sheet = (name: string) => XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name }) })
 * O.isNone(XlsxWorkbook.makeOption({ sheets: [sheet("Items"), sheet("items")] })) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxWorkbook extends S.Opaque<XlsxWorkbook, { readonly brand: unique symbol }>()(
  S.Struct({
    dateSystem: XlsxDateSystem.pipe(
      S.annotateKey({ description: "The day the workbook's date serials count from" }),
      S.withConstructorDefault(Effect.succeed("1900" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("1900" as const))
    ),
    sheets: S.NonEmptyArray(XlsxWorksheet)
      .check(
        uniqueBy((sheet: XlsxWorksheet) => Str.toLowerCase(sheet.info.name), "UniqueSheetNames", {
          title: "Unique sheet names",
          description: "No two sheets of a workbook share a name, compared without regard to case",
          expected: "sheets with no name twice, whatever the case",
        })
      )
      .pipe(S.annotateKey({ description: "The sheets, in the workbook's order" })),
    dropped: S.Array(XlsxDroppedPart).pipe(
      S.annotateKey({ description: "Parts the file held that are not modelled and not written back" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
  }).pipe($I.annoteSchema("XlsxWorkbook", { description: "A workbook's values, sheet by sheet" }))
) {
  /**
   * The workbook as a file gives it back, which is what a write followed by a read returns: rows in rising order,
   * each row's cells in rising column order and in their canonical form, no cell that holds nothing and has no
   * formula, each sheet's declared extent the extent of what it writes, number format ids as a written file numbers
   * them (Excel's own id for a built-in code, 164 and up for the others in the order they are met), and no dropped
   * part, merged ranges with their top-left corner first and hidden columns in rising order.
   */
  static readonly canonical = (workbook: Pick<XlsxWorkbook, "dateSystem" | "sheets">): XlsxWorkbook => {
    const ids = MutableHashMap.empty<string, number>();
    let next = FIRST_CUSTOM_FORMAT;
    // decision: hot-paths-are-mutable-loops
    const idOf = (code: string): number => {
      const known = O.orElse(MutableHashMap.get(ids, code), () => HashMap.get(builtinIds, code));
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
          cells: pipe(
            row.cells,
            A.map((cell) => XlsxCell.canonical(cell, workbook.dateSystem)),
            A.filter(isWritten),
            A.sort(byColumn),
            A.map((canonical) =>
              XlsxCell.make({
                column: canonical.column,
                value: canonical.value,
                formula: canonical.formula,
                format: XlsxNumberFormat.make({ id: idOf(canonical.format.code), code: canonical.format.code }),
              })
            )
          ),
        })
      );
      return XlsxWorksheet.make({
        info: XlsxSheetInfo.make({
          name: sheet.info.name,
          state: sheet.info.state,
          declared: boundsOf(rows, isWritten),
        }),
        rows,
        merges: A.map(sheet.merges, XlsxRange.ordered),
        hiddenColumns: A.sort(sheet.hiddenColumns, Order.Number),
      });
    });
    return XlsxWorkbook.make({ dateSystem: workbook.dateSystem, sheets, dropped: [] });
  };

  /** The sheet of a name, whatever the case, when the workbook has it. */
  static readonly sheet = (workbook: Pick<XlsxWorkbook, "sheets">, name: string): O.Option<XlsxWorksheet> => {
    const wanted = Str.toLowerCase(name);
    return A.findFirst(workbook.sheets, (sheet) => Str.toLowerCase(sheet.info.name) === wanted);
  };

  /** The sheets a person sees in Excel's tabs. */
  static readonly visible = (workbook: Pick<XlsxWorkbook, "sheets">): ReadonlyArray<XlsxWorksheet> =>
    A.filter(workbook.sheets, (sheet) => sheet.info.state === "visible");
}

/**
 * A heading of a sheet read as records: text a cell can hold, and never empty, since an empty heading names no
 * column.
 *
 * **Example** (Headings a header row can have)
 *
 * ```ts import.meta.vitest name="Headings a header row can have"
 * import { MAX_CELL_CHARS } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxHeading } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxHeading)("SKU") // => true
 * S.is(XlsxHeading)("") // => false
 * S.is(XlsxHeading)("x".repeat(MAX_CELL_CHARS + 1)) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxHeading = S.String.check(S.isMinLength(1), S.isMaxLength(MAX_CELL_CHARS)).pipe(
  $I.annoteSchema("XlsxHeading", { description: "A heading of a header row: text a cell holds, never empty" })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type XlsxHeading = typeof XlsxHeading.Type;

/**
 * One row of a sheet under its first row's headings: each heading an own property, each value what the cell holds.
 * The decoded side of `Xlsx.recordsFromBytes`.
 *
 * **Details**
 *
 * A heading that would be a property of every object, such as `constructor`, is still an own property. A cell the
 * row lacks under a heading reads as `XlsxBlank`.
 *
 * **Gotchas**
 *
 * As with any `S.Record`, decoding passes over a key the key schema refuses. Encoding refuses it, so a record
 * written through `Xlsx.recordsFromBytes` never loses a key, empty or too long, without a schema issue.
 *
 * **Example** (A record and a heading it cannot have)
 *
 * ```ts import.meta.vitest name="A record and a heading it cannot have"
 * import { XlsxNumber } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxRecord } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 *
 * const quantity = XlsxNumber.make({ value: 120 })
 * S.is(XlsxRecord)({ Quantity: quantity }) // => true
 * Exit.isFailure(S.encodeUnknownExit(XlsxRecord)({ "": quantity })) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxRecord = S.Record(XlsxHeading, XlsxValue)
  .check(
    S.makeFilter<{ readonly [heading: string]: unknown }>(
      (record) => A.every(R.keys(record), S.is(XlsxHeading)),
      $I.annote("EveryKeyAHeading", {
        title: "Every key a heading",
        description: "Each property of a record is named by a heading a header row can have",
        expected: "a record whose every key is a non-empty text a cell holds",
      })
    )
  )
  .pipe($I.annoteSchema("XlsxRecord", { description: "One row of a sheet under its first row's headings" }));

/**
 * @category type-level
 * @since 0.0.0
 */
export type XlsxRecord = typeof XlsxRecord.Type;
