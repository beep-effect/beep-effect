/**
 * What a read found: the problems that stop it and the oddities it reads past. Each finding carries exactly what it
 * knows, a cell its sheet and address, a part its path, so none has a field that may be missing.
 *
 * @packageDocumentation
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
const address = XlsxAddress.pipe(S.annotateKey({ description: "The cell" }));
const short = (description: string) => S.String.check(S.isMaxLength(255)).pipe(S.annotateKey({ description }));
const whole = (description: string) =>
  S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })).pipe(S.annotateKey({ description }));

/**
 * What the first bytes and the names inside say a file is.
 *
 * @category schemas
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
 * Runtime type of {@link XlsxContainer}.
 *
 * @category models
 */
export type XlsxContainer = typeof XlsxContainer.Type;

/** The file is not a workbook this package reads. */
export class NotAWorkbook extends S.Opaque<NotAWorkbook, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("NotAWorkbook"),
    container: XlsxContainer.pipe(S.annotateKey({ description: "What the file is instead" })),
  }).pipe($I.annoteSchema("NotAWorkbook", { description: "The file is not an .xlsx workbook" }))
) {}

/** A part a workbook must have is not in the archive. */
export class MissingPart extends S.Opaque<MissingPart, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("MissingPart"), path }).pipe(
    $I.annoteSchema("MissingPart", { description: "A part the workbook names is not in the archive" })
  )
) {}

/** The archive holds one path twice, so two readers could be shown two different workbooks. */
export class DuplicatePart extends S.Opaque<DuplicatePart, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("DuplicatePart"), path }).pipe(
    $I.annoteSchema("DuplicatePart", { description: "The archive holds one path twice" })
  )
) {}

/**
 * How an archive is damaged, in the words of Effect's zip reader.
 *
 * @category schemas
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

/** The archive itself is damaged, cut short, or uses something this package does not read, such as encryption. */
export class DamagedArchive extends S.Opaque<DamagedArchive, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("DamagedArchive"),
    damage: XlsxArchiveDamage.pipe(S.annotateKey({ description: "How it is damaged" })),
    reason: short("What the zip reader said"),
  }).pipe($I.annoteSchema("DamagedArchive", { description: "The archive is damaged or cut short" }))
) {}

/** A part is not well-formed XML. */
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
 * Which cap a read ran into.
 *
 * @category schemas
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
  "xml",
]).pipe($I.annoteSchema("XlsxLimit", { description: "Which cap a read ran into" }));

/**
 * Runtime type of {@link XlsxLimit}.
 *
 * @category models
 */
export type XlsxLimit = typeof XlsxLimit.Type;

/** The file went past one of its caps. */
export class LimitExceeded extends S.Opaque<LimitExceeded, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("LimitExceeded"),
    limit: XlsxLimit.pipe(S.annotateKey({ description: "Which cap" })),
    path,
  }).pipe($I.annoteSchema("LimitExceeded", { description: "The file went past one of its caps" }))
) {}

/** The workbook names no sheet. */
export class NoSheets extends S.Opaque<NoSheets, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("NoSheets") }).pipe($I.annoteSchema("NoSheets", { description: "The workbook has no sheet" }))
) {}

/**
 * Why a cell could not be read.
 *
 * @category schemas
 */
export const XlsxUnreadableReason = LiteralKit(["sharedString", "number", "boolean", "errorCode", "date"]).pipe(
  $I.annoteSchema("XlsxUnreadableReason", { description: "What kind of value the cell failed to be" })
);

/** A cell the file itself gets wrong: a text index that points nowhere, text where a number belongs. */
export class UnreadableCell extends S.Opaque<UnreadableCell, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("UnreadableCell"),
    sheet,
    address,
    reason: XlsxUnreadableReason.pipe(S.annotateKey({ description: "What the cell failed to be" })),
  }).pipe($I.annoteSchema("UnreadableCell", { description: "A cell the file itself gets wrong" }))
) {}

/** A cell or a row whose reference cannot be read, or that repeats one; it was placed after the one before it. */
export class BadAddress extends S.Opaque<BadAddress, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("BadAddress"),
    sheet,
    row: XlsxRowNumber.pipe(S.annotateKey({ description: "The row it was read in" })),
    raw: short("The reference as written"),
  }).pipe($I.annoteSchema("BadAddress", { description: "A reference that cannot be read or repeats another" }))
) {}

/** A row numbered lower than the one before it; it was put in its place. */
export class RowOutOfOrder extends S.Opaque<RowOutOfOrder, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("RowOutOfOrder"),
    sheet,
    row: XlsxRowNumber.pipe(S.annotateKey({ description: "The row that came late" })),
  }).pipe($I.annoteSchema("RowOutOfOrder", { description: "A row written after a later one" }))
) {}

/** A cell names a style the workbook does not have; it was read as General. */
export class UnknownStyle extends S.Opaque<UnknownStyle, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("UnknownStyle"), sheet, address, style: whole("The style index the cell names") }).pipe(
    $I.annoteSchema("UnknownStyle", { description: "A cell names a style the workbook does not have" })
  )
) {}

/** A number format whose displayed text is not worked out, and how many cells of a sheet have it. */
export class FormatNotShown extends S.Opaque<FormatNotShown, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("FormatNotShown"),
    sheet,
    code: short("The format code"),
    cells: whole("Cells with a number or a date under the format"),
  }).pipe($I.annoteSchema("FormatNotShown", { description: "A format whose displayed text is not worked out" }))
) {}

/** A formula with no saved result: the cell reads as blank. */
export class FormulaWithoutResult extends S.Opaque<FormulaWithoutResult, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("FormulaWithoutResult"), sheet, address }).pipe(
    $I.annoteSchema("FormulaWithoutResult", { description: "A formula the file saved no result for" })
  )
) {}

/** A date cell holds serial 60 of the 1900 system: 29 February 1900, a day that never was. */
export class FictitiousLeapDay extends S.Opaque<FictitiousLeapDay, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("FictitiousLeapDay"), sheet, address }).pipe(
    $I.annoteSchema("FictitiousLeapDay", { description: "A date cell holds 29 February 1900" })
  )
) {}

/** The extent a sheet declares is not the extent of its cells. */
export class DeclaredExtentWrong extends S.Opaque<DeclaredExtentWrong, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("DeclaredExtentWrong"),
    sheet,
    declared: XlsxRange.pipe(S.annotateKey({ description: "The extent the file claims" })),
    found: S.Option(XlsxRange).pipe(S.annotateKey({ description: "The extent of the cells that hold something" })),
  }).pipe($I.annoteSchema("DeclaredExtentWrong", { description: "A sheet's declared extent misses its cells" }))
) {}

/**
 * What a read goes past.
 *
 * @category schemas
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
      DeclaredExtentWrong
    )
  )
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("XlsxWarningFinding", { description: "What a read goes past" }));

/**
 * Runtime type of {@link XlsxWarningFinding}.
 *
 * @category models
 */
export type XlsxWarningFinding = typeof XlsxWarningFinding.Type;

/**
 * What stops a read.
 *
 * @category schemas
 */
export const XlsxFatalFinding = LiteralKit([
  "NotAWorkbook",
  "MissingPart",
  "DuplicatePart",
  "DamagedArchive",
  "DamagedXml",
  "LimitExceeded",
  "NoSheets",
])
  .mapMembers(() =>
    Tuple.make(NotAWorkbook, MissingPart, DuplicatePart, DamagedArchive, DamagedXml, LimitExceeded, NoSheets)
  )
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("XlsxFatalFinding", { description: "What stops a read" }));

/**
 * Runtime type of {@link XlsxFatalFinding}.
 *
 * @category models
 */
export type XlsxFatalFinding = typeof XlsxFatalFinding.Type;

/** An oddity the read went past. */
export class XlsxWarning extends S.Opaque<XlsxWarning, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("warning"),
    finding: XlsxWarningFinding.pipe(S.annotateKey({ description: "What was read past" })),
  }).pipe($I.annoteSchema("XlsxWarning", { description: "An oddity the read went past" }))
) {}

/** A problem that stopped the read. */
export class XlsxFatal extends S.Opaque<XlsxFatal, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("fatal"),
    finding: XlsxFatalFinding.pipe(S.annotateKey({ description: "What stopped the read" })),
  }).pipe($I.annoteSchema("XlsxFatal", { description: "A problem that stopped the read" }))
) {}

/**
 * One finding and how serious it is.
 *
 * @category schemas
 */
export const XlsxDiagnostic = LiteralKit(["warning", "fatal"])
  .mapMembers(() => Tuple.make(XlsxWarning, XlsxFatal))
  .pipe(S.toTaggedUnion("severity"), $I.annoteSchema("XlsxDiagnostic", { description: "One finding and how serious" }));

/**
 * Runtime type of {@link XlsxDiagnostic}.
 *
 * @category models
 */
export type XlsxDiagnostic = typeof XlsxDiagnostic.Type;

const at = (finding: { readonly sheet: string; readonly address: Pick<XlsxAddress, "column" | "row"> }): string =>
  `${XlsxAddress.format(finding.address)} on "${finding.sheet}"`;

/**
 * A finding in one sentence that names the part or the cell. For logs and tests: an app writes its own sentences for
 * the person.
 *
 * @category utilities
 */
export const describeFinding: (finding: XlsxWarningFinding | XlsxFatalFinding) => string = Match.type<
  XlsxWarningFinding | XlsxFatalFinding
>().pipe(
  Match.discriminatorsExhaustive("kind")({
    NotAWorkbook: (f) => `the file is not an .xlsx workbook (${f.container})`,
    MissingPart: (f) => `the part ${f.path} is missing`,
    DuplicatePart: (f) => `the archive holds ${f.path} twice`,
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
    DeclaredExtentWrong: (f) =>
      `"${f.sheet}" declares ${XlsxRange.format(f.declared)} and holds ${O.match(f.found, {
        onNone: () => "nothing",
        onSome: XlsxRange.format,
      })}`,
  })
);
