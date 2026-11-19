/**
 * What a read returns: the workbook and what was read past on the way.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { XlsxColumn, XlsxRange } from "./XlsxAddress.schema.ts";
import { XlsxWarning } from "./XlsxDiagnostic.schema.ts";
import { XlsxDateSystem } from "./XlsxSerial.schema.ts";
import { XlsxSheetCount, XlsxWorkbook } from "./XlsxWorkbook.schema.ts";
import type { XlsxDroppedKind } from "./XlsxWorkbook.schema.ts";

const $I = $XlsxId.create("XlsxRead");

/**
 * A workbook that was read, with the oddities the read went past.
 *
 * **Example** (Read a workbook and its warnings)
 *
 * ```ts import.meta.vitest name="Read a workbook and its warnings"
 * import { Xlsx, XlsxCell, XlsxRow, XlsxSheetInfo, XlsxText, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx"
 * import * as Effect from "effect/Effect"
 *
 * const workbook = XlsxWorkbook.make({
 *   sheets: [
 *     XlsxWorksheet.make({
 *       info: XlsxSheetInfo.make({ name: "Items" }),
 *       rows: [XlsxRow.make({ number: 1, cells: [XlsxCell.make({ column: 0, value: XlsxText.make({ text: "sku" }) })] })]
 *     })
 *   ]
 * })
 *
 * const program = Effect.gen(function* () {
 *   const read = yield* Xlsx.parse(yield* Xlsx.stringify(workbook))
 *   return { sheets: read.workbook.sheets.length, warnings: read.warnings.length }
 * })
 *
 * const summary = await Effect.runPromise(program)
 * summary // => { sheets: 1, warnings: 0 }
 * ```
 *
 * **Example** (List the kinds of part read past)
 *
 * ```ts import.meta.vitest name="List the kinds of part read past"
 * import { XlsxDroppedPart, XlsxRead } from "@beep/xlsx"
 *
 * const dropped = [
 *   XlsxDroppedPart.make({ path: "xl/theme/theme1.xml", kind: "theme" }),
 *   XlsxDroppedPart.make({ path: "xl/theme/theme2.xml", kind: "theme" }),
 *   XlsxDroppedPart.make({ path: "xl/comments1.xml", kind: "comments" })
 * ]
 * XlsxRead.droppedKinds({ workbook: { dropped } }) // => ["theme", "comments"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxRead extends S.Opaque<XlsxRead, { readonly brand: unique symbol }>()(
  S.Struct({
    workbook: XlsxWorkbook,
    warnings: S.Array(XlsxWarning).pipe(
      S.annotateKey({ description: "What the read went past, in the order it was found" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
  }).pipe($I.annoteSchema("XlsxRead", { description: "A workbook and what was read past" }))
) {
  /** The kinds of part the file held that are not modelled, each once. */
  static readonly droppedKinds = (read: {
    readonly workbook: Pick<XlsxWorkbook, "dropped">;
  }): ReadonlyArray<XlsxDroppedKind> => A.dedupe(A.map(read.workbook.dropped, (part) => part.kind));
}

/**
 * One sheet in a workbook's outline: how much it holds, and what its XML says beside its rows.
 *
 * **Example** (Describe a sheet for a chooser)
 *
 * ```ts import.meta.vitest name="Describe a sheet for a chooser"
 * import { XlsxRange, XlsxSheetCount, XlsxSheetInfo, XlsxSheetOutline } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * const outline = XlsxSheetOutline.make({
 *   count: XlsxSheetCount.make({
 *     info: XlsxSheetInfo.make({ name: "Items" }),
 *     rows: 10,
 *     rowsWithValues: 9,
 *     cellsWithValues: 27,
 *     lastRow: O.some(10)
 *   }),
 *   merges: [O.getOrThrow(XlsxRange.parse("A1:C1"))],
 *   hiddenColumns: [3]
 * })
 * const label = `${outline.count.info.name}: ${outline.count.rowsWithValues} rows, ${outline.merges.length} merged`
 * label // => "Items: 9 rows, 1 merged"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxSheetOutline extends S.Opaque<XlsxSheetOutline, { readonly brand: unique symbol }>()(
  S.Struct({
    count: XlsxSheetCount,
    merges: S.Array(XlsxRange).pipe(S.annotateKey({ description: "The merged ranges" })),
    hiddenColumns: S.Array(XlsxColumn.annotateKey({ description: "One hidden column" })).pipe(
      S.annotateKey({ description: "The hidden columns" })
    ),
  }).pipe($I.annoteSchema("XlsxSheetOutline", { description: "One sheet, counted and not kept" }))
) {}

/**
 * A workbook without its rows: its date system and every sheet counted. What a sheet chooser needs, and what says
 * which sheet to read.
 *
 * **Example** (Outline a workbook without keeping its rows)
 *
 * ```ts import.meta.vitest name="Outline a workbook without keeping its rows"
 * import { Xlsx, XlsxCell, XlsxNumber, XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx"
 * import * as Effect from "effect/Effect"
 *
 * const row = (number: number) =>
 *   XlsxRow.make({ number, cells: [XlsxCell.make({ column: 0, value: XlsxNumber.make({ value: number }) })] })
 * const workbook = XlsxWorkbook.make({
 *   sheets: [
 *     XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Small" }), rows: [row(1)] }),
 *     XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Large" }), rows: [row(1), row(2), row(3)] })
 *   ]
 * })
 *
 * const program = Effect.gen(function* () {
 *   const outline = yield* Xlsx.outline(yield* Xlsx.stringify(workbook))
 *   return outline.sheets.map((sheet) => `${sheet.count.info.name}=${sheet.count.cellsWithValues}`)
 * })
 *
 * const counts = await Effect.runPromise(program)
 * counts // => ["Small=1", "Large=3"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxOutline extends S.Opaque<XlsxOutline, { readonly brand: unique symbol }>()(
  S.Struct({
    dateSystem: XlsxDateSystem.pipe(S.annotateKey({ description: "The day the workbook's date serials count from" })),
    sheets: S.Array(XlsxSheetOutline).pipe(S.annotateKey({ description: "The sheets, in the workbook's order" })),
  }).pipe($I.annoteSchema("XlsxOutline", { description: "A workbook's date system and its sheets, counted" }))
) {}
