/**
 * What a read found: the problems that stop it and the oddities it reads past. Each finding carries exactly what it
 * knows, a cell its sheet and address, a part its path, so none has a field that may be missing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { XlsxAddress, XlsxRange, XlsxRowNumber } from "./XlsxAddress.schema.ts";

const $I = $XlsxId.create("XlsxDiagnostic");

const path = S.String.check(S.isMaxLength(1024)).pipe(S.annotateKey({ description: "The part's path in the archive" }));
const sheet = S.String.check(S.isMaxLength(255)).pipe(S.annotateKey({ description: "The sheet's name" }));
// decision: opaque-fields-take-no-key-annotation
const address = XlsxAddress;
const short = (description: string) => S.String.check(S.isMaxLength(255)).pipe(S.annotateKey({ description }));
const whole = (description: string) =>
  S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })).pipe(S.annotateKey({ description }));

/**
 * **Example** (Sniff a file before reading it)
 *
 * ```ts import.meta.vitest name="Sniff a file before reading it"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import { XlsxContainer } from "@beep/xlsx/XlsxDiagnostic.schema"
 * import * as S from "effect/Schema"
 *
 * Xlsx.container(new Uint8Array([1, 2, 3])) // => "notAnArchive"
 * S.is(XlsxContainer)("legacyXls") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxContainer = LiteralKit([
  "workbook",
  "macroWorkbook",
  "encrypted",
  "legacyXls",
  "binaryWorkbook",
  "openDocument",
  "word",
  "otherZip",
  "otherOle",
  "notAnArchive",
]).pipe($I.annoteSchema("XlsxContainer", { description: "What a file is, from its first bytes and the names inside" }));

/**
 * What a file is, such as `"workbook"` or `"encrypted"`; the type {@link XlsxContainer} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxContainer = typeof XlsxContainer.Type;

/**
 * The file is not a workbook this package reads.
 *
 * **Example** (A legacy .xls file)
 *
 * ```ts import.meta.vitest name="A legacy .xls file"
 * import { describeFinding, NotAWorkbook } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * describeFinding(NotAWorkbook.make({ container: "legacyXls" })) // => "the file is not an .xlsx workbook (legacyXls)"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class NotAWorkbook extends S.Opaque<NotAWorkbook, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("NotAWorkbook"),
    container: XlsxContainer.pipe(S.annotateKey({ description: "What the file is instead" })),
  }).pipe($I.annoteSchema("NotAWorkbook", { description: "The file is not an .xlsx workbook" }))
) {}

/**
 * A part a workbook must have is not in the archive.
 *
 * **Example** (A missing workbook part)
 *
 * ```ts import.meta.vitest name="A missing workbook part"
 * import { describeFinding, MissingPart } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * describeFinding(MissingPart.make({ path: "xl/workbook.xml" })) // => "the part xl/workbook.xml is missing"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class MissingPart extends S.Opaque<MissingPart, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("MissingPart"), path }).pipe(
    $I.annoteSchema("MissingPart", { description: "A part the workbook names is not in the archive" })
  )
) {}

/**
 * The archive holds one path twice, so two readers could be shown two different workbooks.
 *
 * **Example** (A path held twice)
 *
 * ```ts import.meta.vitest name="A path held twice"
 * import { describeFinding, DuplicatePart } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * describeFinding(DuplicatePart.make({ path: "xl/workbook.xml" })) // => "the archive holds xl/workbook.xml twice"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class DuplicatePart extends S.Opaque<DuplicatePart, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("DuplicatePart"), path }).pipe(
    $I.annoteSchema("DuplicatePart", { description: "The archive holds one path twice" })
  )
) {}

/**
 * The archive's central directory, which Excel opens the file by, names other entries than the ones the archive
 * holds from its first byte, as an archive updated by appending does. Two readers could be shown two workbooks, so
 * the read stops.
 *
 * **Example** (An archive updated by appending)
 *
 * ```ts import.meta.vitest name="An archive updated by appending"
 * import { describeFinding, DirectoryMismatch } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = DirectoryMismatch.make({ reason: "the directory starts at byte 2048, the entries end at 1024" })
 * describeFinding(finding) // => "the archive's directory names other entries: the directory starts at byte 2048, the entries end at 1024"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class DirectoryMismatch extends S.Opaque<DirectoryMismatch, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("DirectoryMismatch"), reason: short("Where the directory and the entries part") }).pipe(
    $I.annoteSchema("DirectoryMismatch", {
      description: "The archive's central directory names other entries than the archive holds in order",
    })
  )
) {}

/**
 * How an archive is damaged, in the words of Effect's zip reader.
 *
 * **Example** (Known kinds of damage)
 *
 * ```ts import.meta.vitest name="Known kinds of damage"
 * import { XlsxArchiveDamage } from "@beep/xlsx/XlsxDiagnostic.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxArchiveDamage)("Truncated") // => true
 * S.is(XlsxArchiveDamage)("Corrupt") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxArchiveDamage = LiteralKit([
  "InvalidHeader",
  "InvalidData",
  "Truncated",
  "Checksum",
  "SizeMismatch",
  "Unsupported",
  "BodyConsumed",
]).pipe($I.annoteSchema("XlsxArchiveDamage", { description: "How the archive is damaged" }));

/**
 * How an archive is damaged, such as `"Truncated"`; the type {@link XlsxArchiveDamage} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxArchiveDamage = typeof XlsxArchiveDamage.Type;

/**
 * The archive itself is damaged, cut short, or uses something this package does not read, such as encryption.
 *
 * **Example** (A truncated archive)
 *
 * ```ts import.meta.vitest name="A truncated archive"
 * import { DamagedArchive, describeFinding } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = DamagedArchive.make({ damage: "Truncated", reason: "unexpected end of data" })
 * describeFinding(finding) // => "the archive is damaged (Truncated): unexpected end of data"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class DamagedArchive extends S.Opaque<DamagedArchive, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("DamagedArchive"),
    damage: XlsxArchiveDamage.pipe(S.annotateKey({ description: "How it is damaged" })),
    reason: short("What the zip reader said"),
  }).pipe($I.annoteSchema("DamagedArchive", { description: "The archive is damaged or cut short" }))
) {}

/**
 * **Example** (Malformed sheet XML)
 *
 * ```ts import.meta.vitest name="Malformed sheet XML"
 * import { DamagedXml, describeFinding } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = DamagedXml.make({ path: "xl/worksheets/sheet1.xml", line: 3, column: 14, reason: "unclosed tag" })
 * describeFinding(finding) // => "xl/worksheets/sheet1.xml is not well-formed at 3:14: unclosed tag"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class DamagedXml extends S.Opaque<DamagedXml, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("DamagedXml"),
    path,
    line: whole("1-based line of the problem, 0 when unknown"),
    column: whole("1-based column of the problem, 0 when unknown"),
    reason: short("What the XML reader said"),
  }).pipe($I.annoteSchema("DamagedXml", { description: "A part is not well-formed XML" }))
) {}

/**
 * **Example** (Known caps)
 *
 * ```ts import.meta.vitest name="Known caps"
 * import { XlsxLimit } from "@beep/xlsx/XlsxDiagnostic.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxLimit)("inflatedBytes") // => true
 * S.is(XlsxLimit)("time") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxLimit = LiteralKit([
  "inputBytes",
  "inflatedBytes",
  "partBytes",
  "parts",
  "sheets",
  "sharedStrings",
  "rows",
  "columns",
  "cellChars",
  "sharedFormulaChars",
  "xml",
]).pipe($I.annoteSchema("XlsxLimit", { description: "Which cap a read ran into" }));

/**
 * The name of one cap, such as `"inflatedBytes"`; the type {@link XlsxLimit} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxLimit = typeof XlsxLimit.Type;

/**
 * **Example** (A file over its byte cap)
 *
 * ```ts import.meta.vitest name="A file over its byte cap"
 * import { describeFinding, LimitExceeded } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = LimitExceeded.make({ limit: "inputBytes", path: "the file" })
 * describeFinding(finding) // => "the file went past its cap on inputBytes in the file"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class LimitExceeded extends S.Opaque<LimitExceeded, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("LimitExceeded"),
    limit: XlsxLimit.pipe(S.annotateKey({ description: "Which cap" })),
    path,
  }).pipe($I.annoteSchema("LimitExceeded", { description: "The file went past one of its caps" }))
) {}

/**
 * **Example** (A workbook with no sheet)
 *
 * ```ts import.meta.vitest name="A workbook with no sheet"
 * import { describeFinding, NoSheets } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * describeFinding(NoSheets.make({})) // => "the workbook has no sheet"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class NoSheets extends S.Opaque<NoSheets, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("NoSheets") }).pipe($I.annoteSchema("NoSheets", { description: "The workbook has no sheet" }))
) {}

/**
 * Why a cell could not be read.
 *
 * **Example** (Known reasons)
 *
 * ```ts import.meta.vitest name="Known reasons"
 * import { XlsxUnreadableReason } from "@beep/xlsx/XlsxDiagnostic.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxUnreadableReason)("sharedString") // => true
 * S.is(XlsxUnreadableReason)("formula") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxUnreadableReason = LiteralKit(["sharedString", "number", "boolean", "errorCode", "date"]).pipe(
  $I.annoteSchema("XlsxUnreadableReason", { description: "What kind of value the cell failed to be" })
);

/**
 * What kind of value a cell failed to be, such as `"number"`; the type {@link XlsxUnreadableReason} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxUnreadableReason = typeof XlsxUnreadableReason.Type;

/**
 * A cell the file itself gets wrong: a text index that points nowhere, text where a number belongs.
 *
 * **Example** (A shared text index that points nowhere)
 *
 * ```ts import.meta.vitest name="A shared text index that points nowhere"
 * import { XlsxAddress } from "@beep/xlsx/XlsxAddress.schema"
 * import { describeFinding, UnreadableCell } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = UnreadableCell.make({
 *   sheet: "Items",
 *   address: XlsxAddress.make({ column: 2, row: 5 }),
 *   reason: "sharedString"
 * })
 * describeFinding(finding) // => 'C5 on "Items" could not be read as a sharedString'
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class UnreadableCell extends S.Opaque<UnreadableCell, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("UnreadableCell"),
    sheet,
    address,
    reason: XlsxUnreadableReason.pipe(S.annotateKey({ description: "What the cell failed to be" })),
  }).pipe($I.annoteSchema("UnreadableCell", { description: "A cell the file itself gets wrong" }))
) {}

/**
 * A cell or a row whose reference cannot be read, or that repeats one; it was placed after the one before it.
 *
 * **Example** (An unreadable reference)
 *
 * ```ts import.meta.vitest name="An unreadable reference"
 * import { BadAddress, describeFinding } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * describeFinding(BadAddress.make({ sheet: "Items", row: 4, raw: "ZZZZ4" })) // => 'a reference in row 4 of "Items" cannot be used: ZZZZ4'
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class BadAddress extends S.Opaque<BadAddress, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("BadAddress"),
    sheet,
    row: XlsxRowNumber.pipe(S.annotateKey({ description: "The row it was read in" })),
    raw: short("The reference as written"),
  }).pipe($I.annoteSchema("BadAddress", { description: "A reference that cannot be read or repeats another" }))
) {}

/**
 * A row numbered lower than the one before it; it was put in its place.
 *
 * **Example** (A row written late)
 *
 * ```ts import.meta.vitest name="A row written late"
 * import { describeFinding, RowOutOfOrder } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * describeFinding(RowOutOfOrder.make({ sheet: "Items", row: 2 })) // => 'row 2 of "Items" was written after a later row'
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class RowOutOfOrder extends S.Opaque<RowOutOfOrder, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("RowOutOfOrder"),
    sheet,
    row: XlsxRowNumber.pipe(S.annotateKey({ description: "The row that came late" })),
  }).pipe($I.annoteSchema("RowOutOfOrder", { description: "A row written after a later one" }))
) {}

/**
 * A cell names a style the workbook does not have, or writes a style index that is not a whole number; it was read
 * as General. The index is kept as the cell writes it.
 *
 * **Example** (A style index past the table)
 *
 * ```ts import.meta.vitest name="A style index past the table"
 * import { XlsxAddress } from "@beep/xlsx/XlsxAddress.schema"
 * import { describeFinding, UnknownStyle } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = UnknownStyle.make({ sheet: "Items", address: XlsxAddress.make({ column: 0, row: 1 }), style: "99" })
 * describeFinding(finding) // => 'A1 on "Items" names style 99, which the workbook does not have'
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class UnknownStyle extends S.Opaque<UnknownStyle, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("UnknownStyle"), sheet, address, style: short("The style index as the cell writes it") }).pipe(
    $I.annoteSchema("UnknownStyle", { description: "A cell names a style the workbook does not have" })
  )
) {}

/**
 * A number format whose displayed text is not worked out, and how many cells of a sheet have it.
 *
 * **Example** (Cells under an unrendered format)
 *
 * ```ts import.meta.vitest name="Cells under an unrendered format"
 * import { describeFinding, FormatNotShown } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = FormatNotShown.make({ sheet: "Items", code: "0.00E+00", cells: 12 })
 * describeFinding(finding) // => '12 cells of "Items" have the format 0.00E+00, which is not rendered'
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class FormatNotShown extends S.Opaque<FormatNotShown, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("FormatNotShown"),
    sheet,
    code: short("The format code"),
    cells: whole("Cells with a number or a date under the format"),
  }).pipe($I.annoteSchema("FormatNotShown", { description: "A format whose displayed text is not worked out" }))
) {}

/**
 * A formula with no saved result: the cell reads as blank.
 *
 * **Example** (A formula never calculated)
 *
 * ```ts import.meta.vitest name="A formula never calculated"
 * import { XlsxAddress } from "@beep/xlsx/XlsxAddress.schema"
 * import { describeFinding, FormulaWithoutResult } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = FormulaWithoutResult.make({ sheet: "Items", address: XlsxAddress.make({ column: 3, row: 2 }) })
 * describeFinding(finding) // => 'the formula in D2 on "Items" has no saved result'
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class FormulaWithoutResult extends S.Opaque<FormulaWithoutResult, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("FormulaWithoutResult"), sheet, address }).pipe(
    $I.annoteSchema("FormulaWithoutResult", { description: "A formula the file saved no result for" })
  )
) {}

/**
 * A date cell holds serial 60 of the 1900 system: 29 February 1900, a day that never was.
 *
 * **Example** (The leap day that never was)
 *
 * ```ts import.meta.vitest name="The leap day that never was"
 * import { XlsxAddress } from "@beep/xlsx/XlsxAddress.schema"
 * import { describeFinding, FictitiousLeapDay } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = FictitiousLeapDay.make({ sheet: "Items", address: XlsxAddress.make({ column: 1, row: 4 }) })
 * describeFinding(finding) // => 'B4 on "Items" holds 29 February 1900, a day that never was'
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class FictitiousLeapDay extends S.Opaque<FictitiousLeapDay, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("FictitiousLeapDay"), sheet, address }).pipe(
    $I.annoteSchema("FictitiousLeapDay", { description: "A date cell holds 29 February 1900" })
  )
) {}

/**
 * The extent a sheet declares is not the extent of its cells.
 *
 * **Example** (A declared extent larger than the data)
 *
 * ```ts import.meta.vitest name="A declared extent larger than the data"
 * import { XlsxRange } from "@beep/xlsx/XlsxAddress.schema"
 * import { DeclaredExtentWrong, describeFinding } from "@beep/xlsx/XlsxDiagnostic.schema"
 * import * as O from "effect/Option"
 *
 * const finding = DeclaredExtentWrong.make({
 *   sheet: "Items",
 *   declared: O.getOrThrow(XlsxRange.parse("A1:Z100")),
 *   found: XlsxRange.parse("A1:B2")
 * })
 * describeFinding(finding) // => '"Items" declares A1:Z100 and holds A1:B2'
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class DeclaredExtentWrong extends S.Opaque<DeclaredExtentWrong, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("DeclaredExtentWrong"),
    sheet,
    declared: XlsxRange,
    found: S.Option(XlsxRange).pipe(S.annotateKey({ description: "The extent of the cells that hold something" })),
  }).pipe($I.annoteSchema("DeclaredExtentWrong", { description: "A sheet's declared extent misses its cells" }))
) {}

/**
 * A list a read keeps beside the rows, which a file could otherwise grow without end: the warnings, the merged
 * ranges, the hidden `<col>` spans, the hidden columns they expand to, and the shared formulas.
 *
 * **Example** (Known lists)
 *
 * ```ts import.meta.vitest name="Known lists"
 * import { XlsxKeptList } from "@beep/xlsx/XlsxDiagnostic.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxKeptList)("merges") // => true
 * S.is(XlsxKeptList)("rows") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxKeptList = LiteralKit(["warnings", "merges", "hiddenSpans", "hiddenColumns", "sharedFormulas"]).pipe(
  $I.annoteSchema("XlsxKeptList", { description: "A list a read keeps beside the rows, under a cap" })
);

/**
 * The name of a list a read caps, such as `"merges"`; the type {@link XlsxKeptList} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxKeptList = typeof XlsxKeptList.Type;

/**
 * A list went past its cap for the whole read (`XlsxLimits`), and this many of its items were dropped. It comes
 * after every other warning, and is not itself counted against the cap on warnings.
 *
 * **Example** (Warnings past their cap)
 *
 * ```ts import.meta.vitest name="Warnings past their cap"
 * import { describeFinding, ListTruncated } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * describeFinding(ListTruncated.make({ list: "warnings", dropped: 12 })) // => "12 warnings went past the read's cap and were dropped"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class ListTruncated extends S.Opaque<ListTruncated, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("ListTruncated"),
    list: XlsxKeptList.pipe(S.annotateKey({ description: "Which list" })),
    dropped: whole("How many of its items were dropped"),
  }).pipe($I.annoteSchema("ListTruncated", { description: "A list went past its cap and some items were dropped" }))
) {}

/**
 * **Example** (Branch on a warning finding)
 *
 * ```ts import.meta.vitest name="Branch on a warning finding"
 * import { RowOutOfOrder, XlsxWarningFinding } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = RowOutOfOrder.make({ sheet: "Items", row: 2 })
 * XlsxWarningFinding.guards.RowOutOfOrder(finding) // => true
 * XlsxWarningFinding.guards.BadAddress(finding) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxWarningFinding = LiteralKit([
  "UnreadableCell",
  "BadAddress",
  "RowOutOfOrder",
  "UnknownStyle",
  "FormatNotShown",
  "FormulaWithoutResult",
  "FictitiousLeapDay",
  "DeclaredExtentWrong",
  "ListTruncated",
])
  .mapMembers(() =>
    Tuple.make(
      UnreadableCell,
      BadAddress,
      RowOutOfOrder,
      UnknownStyle,
      FormatNotShown,
      FormulaWithoutResult,
      FictitiousLeapDay,
      DeclaredExtentWrong,
      ListTruncated
    )
  )
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("XlsxWarningFinding", { description: "What a read goes past" }));

/**
 * One of the oddities a read goes past, told apart by `kind`; the type {@link XlsxWarningFinding} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxWarningFinding = typeof XlsxWarningFinding.Type;

/**
 * **Example** (Branch on a fatal finding)
 *
 * ```ts import.meta.vitest name="Branch on a fatal finding"
 * import { NoSheets, XlsxFatalFinding } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const finding = NoSheets.make({})
 * XlsxFatalFinding.guards.NoSheets(finding) // => true
 * XlsxFatalFinding.guards.MissingPart(finding) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxFatalFinding = LiteralKit([
  "NotAWorkbook",
  "MissingPart",
  "DuplicatePart",
  "DirectoryMismatch",
  "DamagedArchive",
  "DamagedXml",
  "LimitExceeded",
  "NoSheets",
])
  .mapMembers(() =>
    Tuple.make(
      NotAWorkbook,
      MissingPart,
      DuplicatePart,
      DirectoryMismatch,
      DamagedArchive,
      DamagedXml,
      LimitExceeded,
      NoSheets
    )
  )
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("XlsxFatalFinding", { description: "What stops a read" }));

/**
 * One of the problems that stop a read, told apart by `kind`; the type {@link XlsxFatalFinding} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxFatalFinding = typeof XlsxFatalFinding.Type;

/**
 * **Example** (Wrap a finding as a warning)
 *
 * ```ts import.meta.vitest name="Wrap a finding as a warning"
 * import { RowOutOfOrder, XlsxWarning } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const warning = XlsxWarning.make({ finding: RowOutOfOrder.make({ sheet: "Items", row: 2 }) })
 * warning.severity // => "warning"
 * warning.finding.kind // => "RowOutOfOrder"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class XlsxWarning extends S.Opaque<XlsxWarning, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("warning"),
    finding: XlsxWarningFinding.pipe(S.annotateKey({ description: "What was read past" })),
  }).pipe($I.annoteSchema("XlsxWarning", { description: "An oddity the read went past" }))
) {}

/**
 * **Example** (The fatal finding of a failed read)
 *
 * ```ts import.meta.vitest name="The fatal finding of a failed read"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import * as Effect from "effect/Effect"
 *
 * const program = Xlsx.parse(new Uint8Array([1, 2, 3])).pipe(
 *   Effect.match({
 *     onSuccess: () => "read",
 *     onFailure: (error) => `${error.fatal.severity}: ${error.fatal.finding.kind}`
 *   })
 * )
 *
 * const fatal = await Effect.runPromise(program)
 * fatal // => "fatal: NotAWorkbook"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class XlsxFatal extends S.Opaque<XlsxFatal, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("fatal"),
    finding: XlsxFatalFinding.pipe(S.annotateKey({ description: "What stopped the read" })),
  }).pipe($I.annoteSchema("XlsxFatal", { description: "A problem that stopped the read" }))
) {}

/**
 * **Example** (Tell warnings from fatal problems)
 *
 * ```ts import.meta.vitest name="Tell warnings from fatal problems"
 * import { NoSheets, RowOutOfOrder, XlsxDiagnostic, XlsxFatal, XlsxWarning } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * const findings = [
 *   XlsxWarning.make({ finding: RowOutOfOrder.make({ sheet: "Items", row: 2 }) }),
 *   XlsxFatal.make({ finding: NoSheets.make({}) })
 * ]
 * findings.filter(XlsxDiagnostic.guards.fatal).length // => 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxDiagnostic = LiteralKit(["warning", "fatal"])
  .mapMembers(() => Tuple.make(XlsxWarning, XlsxFatal))
  .pipe(S.toTaggedUnion("severity"), $I.annoteSchema("XlsxDiagnostic", { description: "One finding and how serious" }));

/**
 * A warning or a fatal finding, told apart by `severity`; the type {@link XlsxDiagnostic} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxDiagnostic = typeof XlsxDiagnostic.Type;

const at = (finding: { readonly sheet: string; readonly address: Pick<XlsxAddress, "column" | "row"> }): string =>
  `${XlsxAddress.format(finding.address)} on "${finding.sheet}"`;

/**
 * A finding in one sentence that names the part or the cell. For logs and tests: an app writes its own sentences for
 * the person.
 *
 * **Example** (Log a finding)
 *
 * ```ts import.meta.vitest name="Log a finding"
 * import { describeFinding, MissingPart } from "@beep/xlsx/XlsxDiagnostic.schema"
 *
 * describeFinding(MissingPart.make({ path: "xl/styles.xml" })) // => "the part xl/styles.xml is missing"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const describeFinding: (finding: XlsxWarningFinding | XlsxFatalFinding) => string = Match.type<
  XlsxWarningFinding | XlsxFatalFinding
>().pipe(
  Match.discriminatorsExhaustive("kind")({
    NotAWorkbook: (f) => `the file is not an .xlsx workbook (${f.container})`,
    MissingPart: (f) => `the part ${f.path} is missing`,
    DuplicatePart: (f) => `the archive holds ${f.path} twice`,
    DirectoryMismatch: (f) => `the archive's directory names other entries: ${f.reason}`,
    DamagedArchive: (f) => `the archive is damaged (${f.damage}): ${f.reason}`,
    DamagedXml: (f) => `${f.path} is not well-formed at ${f.line}:${f.column}: ${f.reason}`,
    LimitExceeded: (f) => `the file went past its cap on ${f.limit} in ${f.path}`,
    NoSheets: () => "the workbook has no sheet",
    UnreadableCell: (f) => `${at(f)} could not be read as a ${f.reason}`,
    BadAddress: (f) => `a reference in row ${f.row} of "${f.sheet}" cannot be used: ${f.raw}`,
    RowOutOfOrder: (f) => `row ${f.row} of "${f.sheet}" was written after a later row`,
    UnknownStyle: (f) => `${at(f)} names style ${f.style}, which the workbook does not have`,
    FormatNotShown: (f) => `${f.cells} cells of "${f.sheet}" have the format ${f.code}, which is not rendered`,
    FormulaWithoutResult: (f) => `the formula in ${at(f)} has no saved result`,
    FictitiousLeapDay: (f) => `${at(f)} holds 29 February 1900, a day that never was`,
    ListTruncated: (f) => `${f.dropped} ${f.list} went past the read's cap and were dropped`,
    DeclaredExtentWrong: (f) =>
      `"${f.sheet}" declares ${XlsxRange.format(f.declared)} and holds ${O.match(f.found, {
        onNone: () => "nothing",
        onSome: XlsxRange.format,
      })}`,
  })
);
