/**
 * Sheet rules: page formats, 37 CFR 1.84 margins, line weight, lettering.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $TechnicalDrawingId.create("Sheet.schemas");

const SheetFormatBase = LiteralKit(["letter", "a4"]);

/**
 * Permitted sheet formats (37 CFR 1.84(f)).
 *
 * **Example** (Read the formats)
 *
 * ```ts
 * import { SheetFormat } from "@beep/technical-drawing"
 *
 * console.log(SheetFormat.literals)
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export const SheetFormat = SheetFormatBase.pipe(
  $I.annoteSchema("SheetFormat", {
    description: "US Letter (8.5 × 11 in) or A4 (21.0 × 29.7 cm), portrait.",
  }),
  SchemaUtils.withLiteralKitStatics(SheetFormatBase)
);

/**
 * Type for {@link SheetFormat}.
 *
 * **Example** (Annotate a format)
 *
 * ```ts
 * import type { SheetFormat } from "@beep/technical-drawing"
 *
 * const format: SheetFormat = "letter"
 * console.log(format)
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export type SheetFormat = typeof SheetFormat.Type;

const PositiveFinite = S.Finite.check(
  S.isGreaterThan(0, {
    identifier: $I`PositiveFiniteCheck`,
    title: "Positive Finite",
    description: "Page dimensions are strictly positive.",
    message: "Expected a strictly positive number",
  })
);

/**
 * Points per centimetre.
 *
 * **Example** (Use PT_PER_CM)
 *
 * ```ts
 * import { PT_PER_CM } from "@beep/technical-drawing"
 *
 * console.log(PT_PER_CM * 2.5) // top margin in points
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export const PT_PER_CM = 72 / 2.54;

/**
 * Points per millimetre.
 *
 * **Example** (Use PT_PER_MM)
 *
 * ```ts
 * import { PT_PER_MM } from "@beep/technical-drawing"
 *
 * console.log(PT_PER_MM * 0.35) // 0.35 mm line in points
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export const PT_PER_MM = PT_PER_CM / 10;

/**
 * Page size in points.
 *
 * **Example** (Letter)
 *
 * ```ts
 * import { PagePoints } from "@beep/technical-drawing"
 *
 * console.log(PagePoints.make({ width: 612, height: 792 }))
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export class PagePoints extends S.Class<PagePoints>($I`PagePoints`)(
  {
    width: PositiveFinite.annotateKey({ description: "Page width in points." }),
    height: PositiveFinite.annotateKey({ description: "Page height in points." }),
  },
  $I.annote("PagePoints", {
    description: "Page width and height in points.",
  })
) {}

const PageSizePt = Fn({ input: SheetFormat, output: PagePoints }).pipe(
  $I.annoteSchema("PageSizePt", {
    description: "Schema-backed page size of a sheet format in points.",
  })
);

/**
 * Page size of a format in points.
 *
 * **Example** (Letter in points)
 *
 * ```ts
 * import { pageSizePt } from "@beep/technical-drawing"
 *
 * console.log(pageSizePt("letter"))
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export const pageSizePt: (format: SheetFormat) => PagePoints = PageSizePt.implementSync((format) =>
  SheetFormat.$match(format, {
    letter: () => PagePoints.make({ width: 612, height: 792 }),
    a4: () => PagePoints.make({ width: 21 * PT_PER_CM, height: 29.7 * PT_PER_CM }),
  })
);

/**
 * Minimum margins of 37 CFR 1.84(g), in centimetres.
 *
 * **Example** (Use MARGINS_CM)
 *
 * ```ts
 * import { MARGINS_CM } from "@beep/technical-drawing"
 *
 * console.log(MARGINS_CM.top, MARGINS_CM.bottom)
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export const MARGINS_CM = { top: 2.5, left: 2.5, right: 1.5, bottom: 1.0 } as const;

/**
 * Minimum lettering height of 37 CFR 1.84(p)(3), in centimetres.
 *
 * **Example** (Use MIN_LETTER_HEIGHT_CM)
 *
 * ```ts
 * import { MIN_LETTER_HEIGHT_CM } from "@beep/technical-drawing"
 *
 * console.log(MIN_LETTER_HEIGHT_CM)
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export const MIN_LETTER_HEIGHT_CM = 0.32;

/**
 * Sheet options of a render: format, line weight, lettering, inner safety gap.
 *
 * **Example** (Defaults)
 *
 * ```ts
 * import { SheetOptions } from "@beep/technical-drawing"
 *
 * const options = SheetOptions.make({})
 * console.log(options.format, options.lineWeightMm, options.letterHeightCm)
 * ```
 *
 * @category sheets
 * @since 0.0.0
 */
export class SheetOptions extends S.Class<SheetOptions>($I`SheetOptions`)(
  {
    format: SheetFormat.pipe(
      S.withConstructorDefault(Effect.succeed("letter" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("letter" as const)),
      S.annotateKey({ description: "Page format. Defaults to letter." })
    ),
    lineWeightMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(0.2, {
        identifier: $I`LineWeightCheck`,
        title: "Line Weight",
        description: "Strokes thinner than 0.2 mm fade when the sheet is reduced to two-thirds.",
        message: "Expected a line weight of at least 0.2 mm",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0.35)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.35)),
      S.annotateKey({ description: "Uniform stroke width in mm. Defaults to 0.35." })
    ),
    letterHeightCm: S.Finite.check(
      S.isGreaterThanOrEqualTo(MIN_LETTER_HEIGHT_CM, {
        identifier: $I`LetterHeightCheck`,
        title: "Letter Height",
        description: "37 CFR 1.84(p)(3) requires lettering at least 0.32 cm high.",
        message: "Expected lettering at least 0.32 cm high",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0.45)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.45)),
      S.annotateKey({ description: "Cap height of `FIG. n` and `n/N` lettering in cm. Defaults to 0.45." })
    ),
    safetyMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`SafetyCheck`,
        title: "Safety Gap",
        description: "Extra clearance kept inside the legal margins.",
        message: "Expected a non-negative safety gap",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(3)),
      S.withDecodingDefaultTypeKey(Effect.succeed(3)),
      S.annotateKey({ description: "Clearance kept inside the 1.84 margins, in mm. Defaults to 3." })
    ),
    shadingWeightMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(0.15, {
        identifier: $I`ShadingWeightCheck`,
        title: "Shading Weight",
        description: "Shading strokes thinner than 0.15 mm break up when the sheet is reduced to two-thirds.",
        message: "Expected a shading weight of at least 0.15 mm",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0.2)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.2)),
      S.annotateKey({ description: "Stroke width of surface-shading lines in mm. Defaults to 0.2." })
    ),
    shadingMinPitchMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(0.5, {
        identifier: $I`ShadingMinPitchCheck`,
        title: "Shading Minimum Pitch",
        description: "Shading lines closer than 0.5 mm read as a solid black area.",
        message: "Expected a minimum shading pitch of at least 0.5 mm",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0.8)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.8)),
      S.annotateKey({ description: "Line pitch on the darkest faces, in mm on the sheet. Defaults to 0.8." })
    ),
    shadingMaxPitchMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(0.5, {
        identifier: $I`ShadingMaxPitchCheck`,
        title: "Shading Maximum Pitch",
        description: "Shading lines closer than 0.5 mm read as a solid black area.",
        message: "Expected a maximum shading pitch of at least 0.5 mm",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(2.5)),
      S.withDecodingDefaultTypeKey(Effect.succeed(2.5)),
      S.annotateKey({ description: "Line pitch on the faintest shaded faces, in mm on the sheet. Defaults to 2.5." })
    ),
    shadingLitThreshold: S.Finite.check(
      S.isGreaterThanOrEqualTo(-1, {
        identifier: $I`ShadingLitThresholdMinCheck`,
        title: "Shading Lit Threshold Minimum",
        description: "Exposure is a cosine; a threshold below -1 has no effect.",
        message: "Expected a lit threshold of at least -1",
      }),
      S.isLessThanOrEqualTo(1, {
        identifier: $I`ShadingLitThresholdMaxCheck`,
        title: "Shading Lit Threshold Maximum",
        description: "Exposure is a cosine; a threshold above 1 shades every face.",
        message: "Expected a lit threshold of at most 1",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0.55)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.55)),
      S.annotateKey({
        description:
          "Exposure above which a face stays unshaded. Defaults to 0.55, just below a face seen square-on (1/√3 under the 45° light), so plans and elevations stay line drawings and only oblique faces are shaded.",
      })
    ),
  },
  $I.annote("SheetOptions", {
    description:
      "Page format, stroke and shading widths, shading pitch range, lettering height, and margin safety gap of a render.",
  })
) {}
