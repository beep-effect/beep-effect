/**
 * One cell of a worksheet: its column, its value as the file holds it, its formula when it has one, and the number
 * format that says how the value is displayed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import {
  builtinFormats,
  classify,
  isDateFormat,
  renderDate,
  renderGeneral,
  renderNumber,
} from "./internal/numberFormat.ts";
import { isXmlSafe } from "./internal/text.ts";
import { XlsxColumn } from "./XlsxAddress.schema.ts";
import { MAX_SERIAL, XlsxSerial } from "./XlsxSerial.schema.ts";
import type { RawFormatKind } from "./internal/numberFormat.ts";
import type { XlsxDateSystem } from "./XlsxSerial.schema.ts";

const $I = $XlsxId.create("XlsxCell");

/**
 * The most characters one cell holds.
 *
 * **Example** (Text past the cap)
 *
 * ```ts
 * import { MAX_CELL_CHARS, XlsxText } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * O.isSome(XlsxText.makeOption({ text: "x".repeat(MAX_CELL_CHARS) })) // => true
 * O.isNone(XlsxText.makeOption({ text: "x".repeat(MAX_CELL_CHARS + 1) })) // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_CELL_CHARS = 32_767;

/**
 * The most characters a formula has.
 *
 * **Example** (A formula past the cap)
 *
 * ```ts
 * import { MAX_FORMULA_CHARS, XlsxBlank, XlsxCell } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * const tooLong = O.some("1+".repeat(MAX_FORMULA_CHARS))
 * O.isNone(XlsxCell.makeOption({ column: 0, value: XlsxBlank.make({}), formula: tooLong })) // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_FORMULA_CHARS = 8192;

/**
 * The most characters a number format code has.
 *
 * **Example** (A format code past the cap)
 *
 * ```ts
 * import { MAX_FORMAT_CHARS, XlsxNumberFormat } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * O.isNone(XlsxNumberFormat.makeOption({ id: 164, code: "0".repeat(MAX_FORMAT_CHARS + 1) })) // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_FORMAT_CHARS = 255;

/**
 * An error a cell can hold in place of a value.
 *
 * **Example** (Known error codes)
 *
 * ```ts
 * import { XlsxErrorCode } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxErrorCode)("#DIV/0!") // => true
 * S.is(XlsxErrorCode)("#OOPS") // => false
 * XlsxErrorCode.literals.length // => 8
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxErrorCode = LiteralKit([
  "#NULL!",
  "#DIV/0!",
  "#VALUE!",
  "#REF!",
  "#NAME?",
  "#NUM!",
  "#N/A",
  "#GETTING_DATA",
]).pipe($I.annoteSchema("XlsxErrorCode", { description: "An error a cell holds in place of a value" }));

/**
 * One of the error codes a cell can hold, such as `"#N/A"`; the type {@link XlsxErrorCode} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxErrorCode = typeof XlsxErrorCode.Type;

const xmlSafe = S.makeFilter((text: string) => isXmlSafe(text), {
  expected: "text without control characters or lone surrogates",
});

/**
 * A format whose number is shown by Excel's default rule.
 *
 * **Example** (Read the General code)
 *
 * ```ts
 * import { XlsxGeneralFormat, XlsxNumberFormat } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxGeneralFormat)(XlsxNumberFormat.kind({ code: "General" })) // => true
 * XlsxGeneralFormat.make({}).kind // => "General"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxGeneralFormat extends S.Opaque<XlsxGeneralFormat, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("General") }).pipe(
    $I.annoteSchema("XlsxGeneralFormat", { description: "The default format: as many digits as fit" })
  )
) {}

/**
 * A format that shows its number as a date or a time.
 *
 * **Example** (Read a date code)
 *
 * ```ts
 * import { XlsxDateFormat, XlsxNumberFormat } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxDateFormat)(XlsxNumberFormat.kind({ code: "yyyy-mm-dd" })) // => true
 * S.is(XlsxDateFormat)(XlsxNumberFormat.kind({ code: "0.00" })) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxDateFormat extends S.Opaque<XlsxDateFormat, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("Date") }).pipe(
    $I.annoteSchema("XlsxDateFormat", { description: "A format that shows a date or a time" })
  )
) {}

/**
 * A format of zeros only: the number padded to that many digits, as a code such as 00123 is kept.
 *
 * **Example** (Read a zero-padded code)
 *
 * ```ts
 * import { XlsxNumberFormat, XlsxZeroPaddedFormat } from "@beep/xlsx"
 *
 * XlsxNumberFormat.kind({ code: "00000" }) // => XlsxZeroPaddedFormat.make({ width: 5 })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxZeroPaddedFormat extends S.Opaque<XlsxZeroPaddedFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("ZeroPadded"),
    width: S.Int.check(S.isBetween({ minimum: 2, maximum: 255 })).pipe(
      S.annotateKey({ description: "Digits the number is padded to" })
    ),
  }).pipe($I.annoteSchema("XlsxZeroPaddedFormat", { description: "A format of zeros: the number padded with zeros" }))
) {}

/**
 * A plain number pattern: fixed decimals, optional thousands separators and percent sign, literal text around.
 *
 * **Example** (Read a thousands pattern)
 *
 * ```ts
 * import { XlsxFixedFormat, XlsxNumberFormat } from "@beep/xlsx"
 *
 * XlsxNumberFormat.kind({ code: "#,##0.00" }) // => XlsxFixedFormat.make({ decimals: 2, thousands: true, percent: false, prefix: "", suffix: "" })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxFixedFormat extends S.Opaque<XlsxFixedFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Fixed"),
    decimals: S.Int.check(S.isBetween({ minimum: 0, maximum: 30 })).pipe(
      S.annotateKey({ description: "Digits after the decimal point" })
    ),
    thousands: S.Boolean.pipe(S.annotateKey({ description: "Whether thousands are separated by commas" })),
    percent: S.Boolean.pipe(S.annotateKey({ description: "Whether the number is shown as a percentage" })),
    prefix: S.String.pipe(S.annotateKey({ description: "Literal text before the number" })),
    suffix: S.String.pipe(S.annotateKey({ description: "Literal text after the number" })),
  }).pipe($I.annoteSchema("XlsxFixedFormat", { description: "A plain number pattern with fixed decimals" }))
) {}

/**
 * A format this package does not render: fractions, exponents, sections, colours, conditions.
 *
 * **Example** (An exponent code is not rendered)
 *
 * ```ts
 * import { XlsxCell, XlsxNumber, XlsxNumberFormat, XlsxOtherFormat } from "@beep/xlsx"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const scientific = XlsxNumberFormat.make({ id: 11, code: "0.00E+00" })
 * S.is(XlsxOtherFormat)(XlsxNumberFormat.kind(scientific)) // => true
 * XlsxCell.shown({ value: XlsxNumber.make({ value: 1200 }), format: scientific }, "1900") // => O.none()
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxOtherFormat extends S.Opaque<XlsxOtherFormat, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("Other") }).pipe(
    $I.annoteSchema("XlsxOtherFormat", { description: "A format whose displayed text is not worked out" })
  )
) {}

/**
 * What a number format is, as far as displayed text is worked out for it.
 *
 * **Example** (Branch on a format's kind)
 *
 * ```ts
 * import { XlsxFormatKind, XlsxNumberFormat } from "@beep/xlsx"
 *
 * const kind = XlsxNumberFormat.kind({ code: "0.0%" })
 * XlsxFormatKind.guards.Fixed(kind) // => true
 * XlsxFormatKind.guards.Date(kind) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxFormatKind = LiteralKit(["General", "Date", "ZeroPadded", "Fixed", "Other"])
  .mapMembers(() =>
    Tuple.make(XlsxGeneralFormat, XlsxDateFormat, XlsxZeroPaddedFormat, XlsxFixedFormat, XlsxOtherFormat)
  )
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("XlsxFormatKind", { description: "What a number format is" }));

/**
 * One of the five format kinds, told apart by `kind`; the type {@link XlsxFormatKind} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxFormatKind = typeof XlsxFormatKind.Type;

const otherFormat = (): XlsxFormatKind => XlsxOtherFormat.make({});

/** The engine's reading of a code as the schema's format kind: a width or decimals past its bounds is `Other`. */
const formatKindOf = Match.type<RawFormatKind>().pipe(
  Match.discriminatorsExhaustive("kind")({
    General: (): XlsxFormatKind => XlsxGeneralFormat.make({}),
    Date: (): XlsxFormatKind => XlsxDateFormat.make({}),
    ZeroPadded: ({ width }): XlsxFormatKind => O.getOrElse(XlsxZeroPaddedFormat.makeOption({ width }), otherFormat),
    Fixed: ({ decimals, thousands, percent, prefix, suffix }): XlsxFormatKind =>
      O.getOrElse(XlsxFixedFormat.makeOption({ decimals, thousands, percent, prefix, suffix }), otherFormat),
    Other: otherFormat,
  })
);

/**
 * A number format: its id in the workbook's styles and the code that says how a number is displayed.
 *
 * **Example** (What a code is)
 *
 * ```ts
 * import { XlsxNumberFormat } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * XlsxNumberFormat.general.code // => "General"
 * O.map(XlsxNumberFormat.builtin(14), (format) => format.code) // => O.some("m/d/yy")
 * XlsxNumberFormat.isDate({ code: "yyyy-mm-dd" }) // => true
 * XlsxNumberFormat.kind({ code: "yyyy-mm-dd" }).kind // => "Date"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxNumberFormat extends S.Opaque<XlsxNumberFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int.check(S.isBetween({ minimum: 0, maximum: 65_535 })).pipe(
      S.annotateKey({ description: "The format's id in the workbook's styles; 0 to 163 are Excel's own" }),
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0))
    ),
    code: S.String.check(S.isMaxLength(MAX_FORMAT_CHARS), xmlSafe).pipe(
      S.annotateKey({ description: "The format code, such as 0.00 or yyyy-mm-dd" }),
      S.withConstructorDefault(Effect.succeed("General")),
      S.withDecodingDefaultTypeKey(Effect.succeed("General"))
    ),
  }).pipe($I.annoteSchema("XlsxNumberFormat", { description: "How a cell's number is displayed" }))
) {
  /** The General format, which every cell has until it is given another. */
  static readonly general: XlsxNumberFormat = XlsxNumberFormat.make({});

  /** The format Excel has built in under an id, for the ids a file may leave unwritten. */
  static readonly builtin = (id: number): O.Option<XlsxNumberFormat> =>
    O.map(R.get(builtinFormats, String(id)), (code) => XlsxNumberFormat.make({ id, code }));

  /** Whether a format shows its number as a date or a time. */
  static readonly isDate = (format: Pick<XlsxNumberFormat, "code">): boolean => isDateFormat(format.code);

  /** What a format is, as far as displayed text is worked out for it. */
  static readonly kind = (format: Pick<XlsxNumberFormat, "code">): XlsxFormatKind =>
    formatKindOf(classify(format.code));
}

const cellText = S.String.check(S.isMaxLength(MAX_CELL_CHARS));

/**
 * A cell that holds nothing: only a formula with no saved result has one.
 *
 * **Example** (A cell waiting for its formula)
 *
 * ```ts
 * import { holdsSomething, XlsxBlank, XlsxCell } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * const cell = XlsxCell.blank(2)
 * S.is(XlsxBlank)(cell.value) // => true
 * holdsSomething(cell.value) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxBlank extends S.Opaque<XlsxBlank, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("Blank") }).pipe($I.annoteSchema("XlsxBlank", { description: "No value" }))
) {}

/**
 * Text, as written.
 *
 * **Example** (Text keeps its spaces)
 *
 * ```ts
 * import { XlsxText } from "@beep/xlsx"
 *
 * XlsxText.make({ text: " 007 " }).text // => " 007 "
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxText extends S.Opaque<XlsxText, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Text"),
    text: cellText.pipe(S.annotateKey({ description: "The text, never trimmed or coerced" })),
  }).pipe($I.annoteSchema("XlsxText", { description: "Text" }))
) {}

/**
 * A number that is not shown as a date.
 *
 * **Example** (A number under the General format)
 *
 * ```ts
 * import { XlsxCell, XlsxNumber } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * const cell = XlsxCell.make({ column: 0, value: XlsxNumber.make({ value: 1234.5 }) })
 * XlsxCell.shown(cell, "1900") // => O.some("1234.5")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxNumber extends S.Opaque<XlsxNumber, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Number"),
    value: S.Finite.pipe(S.annotateKey({ description: "The number as stored" })),
  }).pipe($I.annoteSchema("XlsxNumber", { description: "A number" }))
) {}

/**
 * TRUE or FALSE.
 *
 * **Example** (A boolean value)
 *
 * ```ts
 * import { XlsxBoolean, XlsxValue } from "@beep/xlsx"
 *
 * const value = XlsxBoolean.make({ value: true })
 * XlsxValue.guards.Boolean(value) // => true
 * value.value // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxBoolean extends S.Opaque<XlsxBoolean, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Boolean"),
    value: S.Boolean.pipe(S.annotateKey({ description: "TRUE or FALSE" })),
  }).pipe($I.annoteSchema("XlsxBoolean", { description: "TRUE or FALSE" }))
) {}

/**
 * An error in place of a value.
 *
 * **Example** (A division error)
 *
 * ```ts
 * import { XlsxError } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * XlsxError.make({ code: "#DIV/0!" }).code // => "#DIV/0!"
 * S.is(XlsxError)({ kind: "Error", code: "#OOPS" }) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxError extends S.Opaque<XlsxError, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Error"),
    code: XlsxErrorCode.pipe(S.annotateKey({ description: "Which error" })),
  }).pipe($I.annoteSchema("XlsxError", { description: "A spreadsheet error such as #N/A" }))
) {}

/**
 * A number whose format shows a date or a time.
 *
 * **Example** (A date shown under its format)
 *
 * ```ts
 * import { XlsxCell, XlsxDate, XlsxNumberFormat } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * const cell = XlsxCell.make({
 *   column: 0,
 *   value: XlsxDate.make({ serial: 45_000 }),
 *   format: XlsxNumberFormat.make({ id: 164, code: "yyyy-mm-dd" })
 * })
 * XlsxCell.shown(cell, "1900") // => O.some("2023-03-15")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxDate extends S.Opaque<XlsxDate, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Date"),
    serial: XlsxSerial.pipe(S.annotateKey({ description: "The date as stored, in the workbook's date system" })),
  }).pipe($I.annoteSchema("XlsxDate", { description: "A date or a time, as its serial" }))
) {}

/**
 * What a file wrote where no value can be read: a text index that points nowhere, text where a number belongs.
 *
 * **Example** (What counts as unreadable)
 *
 * ```ts
 * import { holdsSomething, XlsxUnreadable } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxUnreadable)({ kind: "Unreadable", raw: "abc" }) // => true
 * S.is(XlsxUnreadable)({ kind: "Unreadable", raw: "#N/A" }) // => false
 * holdsSomething(XlsxUnreadable.make({ raw: "abc" })) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxUnreadable extends S.Opaque<XlsxUnreadable, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Unreadable"),
    raw: cellText
      .check(S.makeFilter((raw: string) => !S.is(XlsxErrorCode)(raw), { expected: "text that is not an error code" }))
      .pipe(S.annotateKey({ description: "What the file wrote in the cell" })),
  }).pipe($I.annoteSchema("XlsxUnreadable", { description: "A cell the file itself got wrong" }))
) {}

/**
 * What a cell holds.
 *
 * **Example** (Decode and test a value)
 *
 * ```ts
 * import { XlsxValue } from "@beep/xlsx"
 * import * as S from "effect/Schema"
 *
 * const value = S.decodeUnknownSync(XlsxValue)({ kind: "Number", value: 42 })
 * XlsxValue.guards.Number(value) // => true
 * XlsxValue.guards.Text(value) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XlsxValue = LiteralKit(["Blank", "Text", "Number", "Boolean", "Error", "Date", "Unreadable"])
  .mapMembers(() => Tuple.make(XlsxBlank, XlsxText, XlsxNumber, XlsxBoolean, XlsxError, XlsxDate, XlsxUnreadable))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("XlsxValue", { description: "What a cell holds" }));

/**
 * One of the seven things a cell holds, told apart by `kind`; the type {@link XlsxValue} decodes to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type XlsxValue = typeof XlsxValue.Type;

/**
 * Whether a value is something a person would count as data: not blank, not empty text, not unreadable.
 *
 * **Example** (Zero counts, empty text does not)
 *
 * ```ts
 * import { holdsSomething, XlsxNumber, XlsxText } from "@beep/xlsx"
 *
 * holdsSomething(XlsxNumber.make({ value: 0 })) // => true
 * holdsSomething(XlsxText.make({ text: "" })) // => false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const holdsSomething = (value: XlsxValue): boolean =>
  !(value.kind === "Blank" || value.kind === "Unreadable" || (value.kind === "Text" && value.text === ""));

/**
 * One cell: where it is in its row, what it holds, its formula and its number format. A formula is kept without its
 * `=`, and the value beside it is the result the file saved. A cell read from a file holds a date exactly when its
 * number is under a date format and in the range of dates; `canonical` puts a cell built by hand in that form.
 *
 * **Example** (Displayed text)
 *
 * ```ts
 * import { XlsxCell, XlsxNumber, XlsxNumberFormat } from "@beep/xlsx"
 * import * as O from "effect/Option"
 *
 * const sku = XlsxCell.make({
 *   column: 0,
 *   value: XlsxNumber.make({ value: 123 }),
 *   format: XlsxNumberFormat.make({ id: 164, code: "00000" })
 * })
 * XlsxCell.shown(sku, "1900") // => O.some("00123")
 * ```
 *
 * **Example** (Canonical form of a hand-built date)
 *
 * ```ts
 * import { XlsxCell, XlsxDate } from "@beep/xlsx"
 *
 * const built = XlsxCell.make({ column: 0, value: XlsxDate.make({ serial: 45_000 }) })
 * XlsxCell.canonical(built).format.code // => "m/d/yy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxCell extends S.Opaque<XlsxCell, { readonly brand: unique symbol }>()(
  S.Struct({
    column: XlsxColumn.pipe(S.annotateKey({ description: "The cell's 0-based column" })),
    value: XlsxValue.pipe(S.annotateKey({ description: "What the cell holds; for a formula, its saved result" })),
    formula: S.Option(S.String.check(S.isMaxLength(MAX_FORMULA_CHARS), xmlSafe)).pipe(
      S.annotateKey({ description: "The cell's formula without its equals sign, when it has one" }),
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultTypeKey(Effect.succeedNone)
    ),
    format: XlsxNumberFormat.pipe(
      S.annotateKey({ description: "How the cell's number is displayed" }),
      S.withConstructorDefault(Effect.sync(() => XlsxNumberFormat.general)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxNumberFormat.general))
    ),
  }).pipe($I.annoteSchema("XlsxCell", { description: "One cell of a worksheet" }))
) {
  /**
   * The cell as a file gives it back: a date under a format that is not a date format gets Excel's short date
   * (`m/d/yy`), and a number in the range of dates under a date format is the date it would be read as.
   */
  static readonly canonical = <C extends Pick<XlsxCell, "column" | "value" | "formula" | "format">>(
    cell: C
  ): C | XlsxCell => {
    const dated = isDateFormat(cell.format.code);
    if (cell.value.kind === "Date" && !dated) {
      return XlsxCell.make({ ...cell, format: XlsxNumberFormat.make({ id: 14, code: "m/d/yy" }) });
    }
    if (cell.value.kind === "Number" && dated && cell.value.value >= 0 && cell.value.value <= MAX_SERIAL) {
      return XlsxCell.make({ ...cell, value: XlsxDate.make({ serial: cell.value.value }) });
    }
    return cell;
  };

  /** A cell with no value at a column, for a formula to be put in. */
  static readonly blank = (column: XlsxColumn): XlsxCell => XlsxCell.make({ column, value: XlsxBlank.make({}) });

  /**
   * The text Excel would display for the cell's number or date, when this package works it out: for the General
   * format, dates and times, zero-padding and plain number patterns. None for any other value or format.
   */
  static readonly shown = (cell: Pick<XlsxCell, "value" | "format">, system: XlsxDateSystem): O.Option<string> => {
    if (cell.value.kind === "Date") {
      return renderDate({ code: cell.format.code, serial: cell.value.serial, date1904: system === "1904" });
    }
    if (cell.value.kind !== "Number") return O.none();
    const kind = classify(cell.format.code);
    if (kind.kind === "General") return O.some(renderGeneral(cell.value.value));
    if (kind.kind === "ZeroPadded" || kind.kind === "Fixed") return renderNumber({ kind, value: cell.value.value });
    return O.none();
  };
}
