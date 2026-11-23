/**
 * What a number format code is, as far as this package works out the text Excel displays for it: the General rule,
 * a date or time, zero-padding, a plain number pattern, or a format it does not render.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $XlsxId.create("XlsxFormatKind");

/**
 * A format whose number is shown by Excel's default rule.
 *
 * **Example** (Read the General code)
 *
 * ```ts import.meta.vitest name="Read the General code"
 * import { XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxGeneralFormat } from "@beep/xlsx/XlsxFormatKind.schema"
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
 * **Example** (Read a date code)
 *
 * ```ts import.meta.vitest name="Read a date code"
 * import { XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxDateFormat } from "@beep/xlsx/XlsxFormatKind.schema"
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
 * A format of zeros only: the number padded to that many digits, as a code such as 00123 is kept. A code of more
 * zeros than the width allows is {@link XlsxOtherFormat}.
 *
 * **Example** (Read a zero-padded code)
 *
 * ```ts import.meta.vitest name="Read a zero-padded code"
 * import { XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxZeroPaddedFormat } from "@beep/xlsx/XlsxFormatKind.schema"
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
 * A plain number pattern: fixed decimals, optional thousands separators and percent sign, literal text around. A
 * pattern of more than 30 decimals is {@link XlsxOtherFormat}.
 *
 * **Example** (Read a thousands pattern)
 *
 * ```ts import.meta.vitest name="Read a thousands pattern"
 * import { XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxFixedFormat } from "@beep/xlsx/XlsxFormatKind.schema"
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
 * A format this package does not render: fractions, exponents, sections, colours, conditions, and a zero-padded or
 * plain pattern past the bounds of {@link XlsxZeroPaddedFormat} or {@link XlsxFixedFormat}.
 *
 * **Example** (An exponent code is not rendered)
 *
 * ```ts import.meta.vitest name="An exponent code is not rendered"
 * import { XlsxCell, XlsxNumber, XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxOtherFormat } from "@beep/xlsx/XlsxFormatKind.schema"
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
 * ```ts import.meta.vitest name="Branch on a format's kind"
 * import { XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxFormatKind } from "@beep/xlsx/XlsxFormatKind.schema"
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
