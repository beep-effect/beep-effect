/**
 * The choices a read or a write takes: which sheets, the caps on what a file may hold or inflate to, and how the
 * written archive is compressed. Every choice has its starting value on its schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { MAX_COLUMN, MAX_ROW } from "./XlsxAddress.schema.ts";
import { MAX_CELL_CHARS } from "./XlsxCell.schema.ts";
import { XlsxSheetName } from "./XlsxWorkbook.schema.ts";

const $I = $XlsxId.create("XlsxOptions");

/**
 * Read every sheet.
 *
 * **Example** (The starting sheet choice)
 *
 * ```ts import.meta.vitest name="The starting sheet choice"
 * import { XlsxAllSheets, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxAllSheets)(XlsxReadOptions.default.sheets) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxAllSheets extends S.Opaque<XlsxAllSheets, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("All") }).pipe($I.annoteSchema("XlsxAllSheets", { description: "Read every sheet" }))
) {}

/**
 * Read the sheets of these names, whatever the case; a name the workbook lacks is passed over.
 *
 * **Example** (Read one sheet by name)
 *
 * ```ts import.meta.vitest name="Read one sheet by name"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import { XlsxCell, XlsxText } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxNamedSheets, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema"
 * import { XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as Effect from "effect/Effect"
 *
 * const note = XlsxRow.make({ number: 1, cells: [XlsxCell.make({ column: 0, value: XlsxText.make({ text: "draft" }) })] })
 * const workbook = XlsxWorkbook.make({
 *   sheets: [
 *     XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Items" }), rows: [note] }),
 *     XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Notes" }), rows: [note] })
 *   ]
 * })
 *
 * const program = Effect.gen(function* () {
 *   const bytes = yield* Xlsx.stringify(workbook)
 *   const options = XlsxReadOptions.make({ sheets: XlsxNamedSheets.make({ names: ["notes", "Missing"] }) })
 *   const read = yield* Xlsx.parse(bytes, options)
 *   return read.workbook.sheets.map((sheet) => sheet.rows.length)
 * })
 *
 * const rowCounts = await Effect.runPromise(program)
 * rowCounts // => [0, 1]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxNamedSheets extends S.Opaque<XlsxNamedSheets, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Named"),
    names: S.NonEmptyArray(XlsxSheetName.annotateKey({ description: "A sheet to read" })).pipe(
      S.annotateKey({ description: "The sheets to read" })
    ),
  }).pipe($I.annoteSchema("XlsxNamedSheets", { description: "Read the sheets of these names" }))
) {}

/**
 * Read the first sheet only.
 *
 * **Example** (Choose the first sheet)
 *
 * ```ts import.meta.vitest name="Choose the first sheet"
 * import { XlsxFirstSheet, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema"
 *
 * const options = XlsxReadOptions.make({ sheets: XlsxFirstSheet.make({}) })
 * options.sheets.kind // => "First"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxFirstSheet extends S.Opaque<XlsxFirstSheet, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("First") }).pipe($I.annoteSchema("XlsxFirstSheet", { description: "Read the first sheet" }))
) {}

/**
 * Which sheets a read keeps. The others are still named, with no rows.
 *
 * **Example** (Describe a choice)
 *
 * ```ts import.meta.vitest name="Describe a choice"
 * import { XlsxNamedSheets, XlsxSheetChoice } from "@beep/xlsx/XlsxOptions.schema"
 *
 * const describe = (choice: XlsxSheetChoice): string =>
 *   XlsxSheetChoice.match(choice, {
 *     All: () => "every sheet",
 *     First: () => "the first sheet",
 *     Named: (named) => named.names.join(", ")
 *   })
 *
 * describe(XlsxNamedSheets.make({ names: ["Items", "Notes"] })) // => "Items, Notes"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxSheetChoice = LiteralKit(["All", "Named", "First"])
  .mapMembers(() => Tuple.make(XlsxAllSheets, XlsxNamedSheets, XlsxFirstSheet))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("XlsxSheetChoice", { description: "Which sheets a read keeps" }));

/**
 * Every sheet, the first, or the sheets of some names, told apart by `kind`; the type {@link XlsxSheetChoice} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxSheetChoice = typeof XlsxSheetChoice.Type;

const count = (maximum: number, fallback: number, description: string) =>
  S.Int.check(S.isBetween({ minimum: 1, maximum })).pipe(
    S.annotateKey({ description }),
    S.withConstructorDefault(Effect.succeed(fallback)),
    S.withDecodingDefaultTypeKey(Effect.succeed(fallback))
  );

const size = (fallback: () => ByteSize.ByteSize, description: string) =>
  S.ByteSize.pipe(
    S.annotateKey({ description }),
    S.withConstructorDefault(Effect.sync(fallback)),
    S.withDecodingDefaultTypeKey(Effect.sync(fallback))
  );

/**
 * The caps a read holds a file to. They are counted as bytes are inflated, never taken from the sizes a file
 * declares, so a small file built to inflate without end stops at `maxInflatedBytes`.
 *
 * **Details**
 *
 * The caps on bytes, parts, sheets, shared text, rows, columns and characters stop the read with `LimitExceeded`,
 * as does `maxSharedFormulaChars`, the text that cells sharing a formula are handed between them. The caps on lists
 * the read keeps beside the rows (`maxWarnings`, `maxMerges`, `maxHiddenSpans`, `maxHiddenColumns` and
 * `maxSharedFormulas`) are each counted once across the whole read: what goes past one is dropped and counted, and
 * the read ends with one `ListTruncated` warning per such list saying how many.
 *
 * **Gotchas**
 *
 * - The `ListTruncated` warnings come after the `maxWarnings` kept, so a read may return up to five warnings more
 *   than that cap (one per list).
 * - `dropped` counts occurrences: a merged range written again after it was dropped is counted again, while a range
 *   that was kept is kept, and counted, once per sheet.
 *
 * **Example** (Tighten one cap)
 *
 * ```ts import.meta.vitest name="Tighten one cap"
 * import { XlsxLimits, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema"
 * import * as ByteSize from "effect/ByteSize"
 *
 * const limits = XlsxLimits.make({ maxInputBytes: ByteSize.kibibytes(512) })
 * limits.maxSheets // => 1000
 * const options = XlsxReadOptions.make({ limits })
 * options.limits.maxInputBytes // => ByteSize.kibibytes(512)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxLimits extends S.Opaque<XlsxLimits, { readonly brand: unique symbol }>()(
  S.Struct({
    maxInputBytes: size(() => ByteSize.mebibytes(3), "Most bytes the file itself may have"),
    maxInflatedBytes: size(() => ByteSize.mebibytes(64), "Most bytes all the file's parts may inflate to"),
    maxPartBytes: size(() => ByteSize.mebibytes(64), "Most bytes one part may inflate to"),
    maxParts: count(1_000_000, 10_000, "Most parts in the archive"),
    maxSheets: count(100_000, 1000, "Most sheets in the workbook"),
    maxSharedStrings: count(100_000_000, 2_000_000, "Most entries in the shared text table"),
    maxRows: count(MAX_ROW, MAX_ROW, "Most rows read from one sheet"),
    maxColumns: count(MAX_COLUMN + 1, MAX_COLUMN + 1, "Most columns a cell may be at"),
    maxCellChars: count(MAX_CELL_CHARS, MAX_CELL_CHARS, "Most characters in one cell"),
    maxSharedFormulaChars: count(
      1_073_741_824,
      16_777_216,
      "Most characters of formula text that cells sharing a formula are handed, over the whole read"
    ),
    maxWarnings: count(
      10_000_000,
      10_000,
      "Most warnings kept over the whole read, before the one ListTruncated per list that dropped items"
    ),
    maxMerges: count(10_000_000, 100_000, "Most merged ranges kept over the whole read, each sheet's repeats once"),
    maxHiddenSpans: count(10_000_000, 100_000, "Most hidden `<col>` spans kept over the whole read"),
    maxHiddenColumns: count(
      100_000_000,
      1_048_576,
      "Most hidden columns the spans expand to over the whole read, each sheet's columns once"
    ),
    maxSharedFormulas: count(10_000_000, 100_000, "Most shared formulas kept over the whole read"),
  }).pipe($I.annoteSchema("XlsxLimits", { description: "The caps a read holds a file to" }))
) {
  /** The starting caps: 3 MiB of file, 64 MiB inflated, a worksheet's own bounds. */
  static readonly default: XlsxLimits = XlsxLimits.make({});
}

/**
 * How a workbook is read.
 *
 * **Example** (Read with the starting options)
 *
 * ```ts import.meta.vitest name="Read with the starting options"
 * import { XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema"
 *
 * XlsxReadOptions.default.sheets.kind // => "All"
 * XlsxReadOptions.default.limits.maxRows // => 1048576
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxReadOptions extends S.Opaque<XlsxReadOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    sheets: XlsxSheetChoice.pipe(
      S.annotateKey({ description: "Which sheets are read" }),
      S.withConstructorDefault(Effect.sync(() => XlsxAllSheets.make({}))),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxAllSheets.make({})))
    ),
    limits: XlsxLimits.pipe(
      S.withConstructorDefault(Effect.sync(() => XlsxLimits.default)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxLimits.default))
    ),
  }).pipe($I.annoteSchema("XlsxReadOptions", { description: "How a workbook is read" }))
) {
  /** Every sheet, under the starting caps. */
  static readonly default: XlsxReadOptions = XlsxReadOptions.make({});
}

/**
 * Whether the written archive's parts are deflated or stored as they are.
 *
 * **Example** (Accepted values)
 *
 * ```ts import.meta.vitest name="Accepted values"
 * import { XlsxCompression } from "@beep/xlsx/XlsxOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxCompression)("store") // => true
 * S.is(XlsxCompression)("zstd") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxCompression = LiteralKit(["deflate", "store"]).pipe(
  $I.annoteSchema("XlsxCompression", { description: "Whether the written parts are deflated or stored" })
);

/**
 * `"deflate"` or `"store"`; the type {@link XlsxCompression} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxCompression = typeof XlsxCompression.Type;

/**
 * How a workbook is written.
 *
 * **Example** (Store parts without deflating)
 *
 * ```ts import.meta.vitest name="Store parts without deflating"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import { XlsxWriteOptions } from "@beep/xlsx/XlsxOptions.schema"
 * import { XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as Effect from "effect/Effect"
 *
 * const workbook = XlsxWorkbook.make({ sheets: [XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Items" }) })] })
 *
 * const program = Effect.gen(function* () {
 *   const bytes = yield* Xlsx.stringify(workbook, XlsxWriteOptions.make({ compression: "store" }))
 *   return Xlsx.container(bytes)
 * })
 *
 * const container = await Effect.runPromise(program)
 * container // => "workbook"
 * XlsxWriteOptions.default.compression // => "deflate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxWriteOptions extends S.Opaque<XlsxWriteOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    compression: XlsxCompression.pipe(
      S.annotateKey({ description: "Whether the parts are deflated or stored" }),
      S.withConstructorDefault(Effect.succeed("deflate" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("deflate" as const))
    ),
  }).pipe($I.annoteSchema("XlsxWriteOptions", { description: "How a workbook is written" }))
) {
  /** Deflated parts. */
  static readonly default: XlsxWriteOptions = XlsxWriteOptions.make({});
}

/**
 * The options of a codec: how it reads and how it writes.
 *
 * **Example** (A codec that reads only the first sheet)
 *
 * ```ts import.meta.vitest name="A codec that reads only the first sheet"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import { XlsxCell, XlsxText } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxCodecOptions, XlsxFirstSheet, XlsxReadOptions } from "@beep/xlsx/XlsxOptions.schema"
 * import { XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const note = XlsxRow.make({ number: 1, cells: [XlsxCell.make({ column: 0, value: XlsxText.make({ text: "draft" }) })] })
 * const workbook = XlsxWorkbook.make({
 *   sheets: [
 *     XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Items" }), rows: [note] }),
 *     XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Notes" }), rows: [note] })
 *   ]
 * })
 * const options = XlsxCodecOptions.make({ read: XlsxReadOptions.make({ sheets: XlsxFirstSheet.make({}) }) })
 * const codec = Xlsx.fromBytes(options)
 *
 * const program = Effect.gen(function* () {
 *   const bytes = yield* S.encodeEffect(codec)(workbook)
 *   const decoded = yield* S.decodeEffect(codec)(bytes)
 *   return decoded.sheets.map((sheet) => sheet.rows.length)
 * })
 *
 * const rowCounts = await Effect.runPromise(program)
 * rowCounts // => [1, 0]
 * options.write.compression // => "deflate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxCodecOptions extends S.Opaque<XlsxCodecOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    read: XlsxReadOptions.pipe(
      S.withConstructorDefault(Effect.sync(() => XlsxReadOptions.default)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxReadOptions.default))
    ),
    write: XlsxWriteOptions.pipe(
      S.withConstructorDefault(Effect.sync(() => XlsxWriteOptions.default)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxWriteOptions.default))
    ),
  }).pipe($I.annoteSchema("XlsxCodecOptions", { description: "How a codec reads and writes" }))
) {
  /** The starting options of both directions. */
  static readonly default: XlsxCodecOptions = XlsxCodecOptions.make({});
}
