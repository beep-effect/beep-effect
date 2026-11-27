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
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  builtinFormats,
  classify,
  isDateFormat,
  renderDate,
  renderGeneral,
  renderNumber,
} from "./internal/numberFormat.ts";
import { XmlSafeText } from "./internal/text.ts";
import { XlsxColumn } from "./XlsxAddress.schema.ts";
import { XlsxFormatKind } from "./XlsxFormatKind.schema.ts";
import { maxSerial, XlsxSerial } from "./XlsxSerial.schema.ts";
import type { XlsxDateSystem } from "./XlsxSerial.schema.ts";

const $I = $XlsxId.create("XlsxCell");

/**
 * The most characters one cell holds.
 *
 * **Example** (Text past the cap)
 *
 * ```ts import.meta.vitest name="Text past the cap"
 * import { MAX_CELL_CHARS, XlsxText } from "@beep/xlsx/XlsxCell.schema"
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
 * ```ts import.meta.vitest name="A formula past the cap"
 * import { MAX_FORMULA_CHARS, XlsxBlank, XlsxCell } from "@beep/xlsx/XlsxCell.schema"
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
 * ```ts import.meta.vitest name="A format code past the cap"
 * import { MAX_FORMAT_CHARS, XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
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
 * **Example** (Known error codes)
 *
 * ```ts import.meta.vitest name="Known error codes"
 * import { XlsxErrorCode } from "@beep/xlsx/XlsxCell.schema"
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

/**
 * A number format: its id in the workbook's styles and the code that says how a number is displayed.
 *
 * **Example** (What a code is)
 *
 * ```ts import.meta.vitest name="What a code is"
 * import { XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
 * import * as O from "effect/Option"
 *
 * XlsxNumberFormat.general.code // => "General"
 * XlsxNumberFormat.shortDate.code // => "m/d/yy"
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
    code: S.String.check(S.isMaxLength(MAX_FORMAT_CHARS), XmlSafeText).pipe(
      S.annotateKey({ description: "The format code, such as 0.00 or yyyy-mm-dd" }),
      S.withConstructorDefault(Effect.succeed("General")),
      S.withDecodingDefaultTypeKey(Effect.succeed("General"))
    ),
  }).pipe($I.annoteSchema("XlsxNumberFormat", { description: "How a cell's number is displayed" }))
) {
  /** The General format, which every cell has until it is given another. */
  static readonly general: XlsxNumberFormat = XlsxNumberFormat.make({});

  /** Excel's short date, id 14: what a date gets when its format is not a date format. */
  static readonly shortDate: XlsxNumberFormat = XlsxNumberFormat.make({ id: 14, code: "m/d/yy" });

  /** The format Excel has built in under an id, for the ids a file may leave unwritten. */
  static readonly builtin = (id: number): O.Option<XlsxNumberFormat> =>
    O.map(HashMap.get(builtinFormats, id), (code) => XlsxNumberFormat.make({ id, code }));

  /** Whether a format shows its number as a date or a time. */
  static readonly isDate = (format: Pick<XlsxNumberFormat, "code">): boolean => isDateFormat(format.code);

  /** What a format is, as far as displayed text is worked out for it. */
  static readonly kind = (format: Pick<XlsxNumberFormat, "code">): XlsxFormatKind => classify(format.code);
}

const cellText = S.String.check(
  S.isMaxLength(
    MAX_CELL_CHARS,
    $I.annote("CellTextLength", {
      title: "Cell text length",
      description: "Text no longer than the 32,767 characters one cell holds",
    })
  )
);

/**
 * A cell that holds nothing: only a formula with no saved result has one.
 *
 * **Example** (A cell waiting for its formula)
 *
 * ```ts import.meta.vitest name="A cell waiting for its formula"
 * import { holdsSomething, XlsxBlank, XlsxCell } from "@beep/xlsx/XlsxCell.schema"
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
 * **Example** (Text keeps its spaces)
 *
 * ```ts import.meta.vitest name="Text keeps its spaces"
 * import { XlsxText } from "@beep/xlsx/XlsxCell.schema"
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
 * ```ts import.meta.vitest name="A number under the General format"
 * import { XlsxCell, XlsxNumber } from "@beep/xlsx/XlsxCell.schema"
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
 * **Example** (A boolean value)
 *
 * ```ts import.meta.vitest name="A boolean value"
 * import { XlsxBoolean, XlsxValue } from "@beep/xlsx/XlsxCell.schema"
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
 * **Example** (A division error)
 *
 * ```ts import.meta.vitest name="A division error"
 * import { XlsxError } from "@beep/xlsx/XlsxCell.schema"
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
 * ```ts import.meta.vitest name="A date shown under its format"
 * import { XlsxCell, XlsxDate, XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
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
 * **Details**
 *
 * `raw` is the text exactly as the file wrote it, its `_xHHHH_` escapes read. An error code's text is kept as it is:
 * `#N/A` in a number cell is not an error cell, and its canonical form is the text `#N/A`.
 *
 * **Example** (What counts as unreadable)
 *
 * ```ts import.meta.vitest name="What counts as unreadable"
 * import { holdsSomething, XlsxUnreadable } from "@beep/xlsx/XlsxCell.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(XlsxUnreadable)({ kind: "Unreadable", raw: "abc" }) // => true
 * S.is(XlsxUnreadable)({ kind: "Unreadable", raw: "#N/A" }) // => true
 * holdsSomething(XlsxUnreadable.make({ raw: "abc" })) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxUnreadable extends S.Opaque<XlsxUnreadable, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Unreadable"),
    raw: cellText.pipe(S.annotateKey({ description: "What the file wrote in the cell" })),
  }).pipe($I.annoteSchema("XlsxUnreadable", { description: "A cell the file itself got wrong" }))
) {}

/**
 * **Example** (Decode and test a value)
 *
 * ```ts import.meta.vitest name="Decode and test a value"
 * import { XlsxValue } from "@beep/xlsx/XlsxCell.schema"
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
 * ```ts import.meta.vitest name="Zero counts, empty text does not"
 * import { holdsSomething, XlsxNumber, XlsxText } from "@beep/xlsx/XlsxCell.schema"
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
 * ```ts import.meta.vitest name="Displayed text"
 * import { XlsxCell, XlsxNumber, XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
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
 * ```ts import.meta.vitest name="Canonical form of a hand-built date"
 * import { XlsxCell, XlsxDate } from "@beep/xlsx/XlsxCell.schema"
 *
 * const built = XlsxCell.make({ column: 0, value: XlsxDate.make({ serial: 45_000 }) })
 * XlsxCell.canonical(built, "1900").format.code // => "m/d/yy"
 * const late = XlsxCell.make({ column: 0, value: XlsxDate.make({ serial: 2_958_000 }) })
 * XlsxCell.canonical(late, "1904").value.kind // => "Number"
 * ```
 *
 * **Example** (Canonical form of an unreadable value)
 *
 * ```ts import.meta.vitest name="Canonical form of an unreadable value"
 * import { XlsxCell, XlsxUnreadable } from "@beep/xlsx/XlsxCell.schema"
 *
 * const wrong = XlsxCell.make({ column: 0, value: XlsxUnreadable.make({ raw: "twelve" }) })
 * XlsxCell.canonical(wrong, "1900").value.kind // => "Text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XlsxCell extends S.Opaque<XlsxCell, { readonly brand: unique symbol }>()(
  S.Struct({
    column: XlsxColumn.pipe(S.annotateKey({ description: "The cell's 0-based column" })),
    value: XlsxValue.pipe(S.annotateKey({ description: "What the cell holds; for a formula, its saved result" })),
    formula: S.Option(S.String.check(S.isMaxLength(MAX_FORMULA_CHARS), XmlSafeText)).pipe(
      S.annotateKey({ description: "The cell's formula without its equals sign, when it has one" }),
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultTypeKey(Effect.succeedNone)
    ),
    // decision: opaque-fields-take-no-key-annotation
    format: XlsxNumberFormat.pipe(
      S.withConstructorDefault(Effect.sync(() => XlsxNumberFormat.general)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxNumberFormat.general))
    ),
  }).pipe($I.annoteSchema("XlsxCell", { description: "One cell of a worksheet" }))
) {
  /**
   * The cell as a file in a date system gives it back: a date past the system's last serial is the number it is
   * written as, a date under a format that is not a date format gets Excel's short date (`m/d/yy`), and a number in
   * the system's range of dates under a date format is the date it would be read as. An empty formula, which a read
   * gives the cells of a shared formula it dropped, is no formula: it is not written, so it does not come back. An
   * `Unreadable` value is the text the file wrote there: Excel has no cell for a value it cannot read, so it is
   * written, and read back, as that text.
   */
  static readonly canonical = (written: XlsxCell, system: XlsxDateSystem): XlsxCell => {
    const cell = O.exists(written.formula, Str.isEmpty) ? XlsxCell.make({ ...written, formula: O.none() }) : written;
    const value = cell.value;
    if (value.kind === "Date") return canonicalDate(cell, value.serial, system);
    if (value.kind === "Number") return canonicalNumber(cell, value.value, system);
    if (value.kind === "Unreadable") return XlsxCell.make({ ...cell, value: XlsxText.make({ text: value.raw }) });
    return cell;
  };

  /** A cell with no value at a column, for a formula to be put in. */
  static readonly blank = (column: XlsxColumn): XlsxCell => XlsxCell.make({ column, value: XlsxBlank.make({}) });

  /**
   * The text Excel would display for the cell's number or date, when this package works it out: for the General
   * format, dates and times, zero-padding and plain number patterns. None for any other value or format, and none
   * for a date past the last serial of the date system, which Excel shows as `#####`.
   */
  static readonly shown = (cell: Pick<XlsxCell, "value" | "format">, system: XlsxDateSystem): O.Option<string> => {
    if (cell.value.kind === "Date") return renderDate(cell.format.code, cell.value.serial, system);
    if (cell.value.kind !== "Number") return O.none();
    const value = cell.value.value;
    return XlsxFormatKind.match(classify(cell.format.code), {
      General: () => O.some(renderGeneral(value)),
      ZeroPadded: (kind) => renderNumber(kind, value),
      Fixed: (kind) => renderNumber(kind, value),
      Date: () => O.none(),
      Other: () => O.none(),
    });
  };
}

const canonicalDate = (cell: XlsxCell, serial: number, system: XlsxDateSystem): XlsxCell => {
  if (serial > maxSerial(system)) return XlsxCell.make({ ...cell, value: XlsxNumber.make({ value: serial }) });
  return isDateFormat(cell.format.code) ? cell : XlsxCell.make({ ...cell, format: XlsxNumberFormat.shortDate });
};

const canonicalNumber = (cell: XlsxCell, value: number, system: XlsxDateSystem): XlsxCell =>
  isDateFormat(cell.format.code) && value >= 0 && value <= maxSerial(system)
    ? XlsxCell.make({ ...cell, value: XlsxDate.make({ serial: value }) })
    : cell;
