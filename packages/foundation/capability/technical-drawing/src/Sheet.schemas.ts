/**
 * Sheet rules: page formats, 37 CFR 1.84 margins, line weight, lettering.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import { O, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { HatchAxis, ShadingStyle } from "./Geometry.schemas.ts";
import { SANS_FACE, SERIF_FACE } from "./internal/LabelGlyphs.ts";
import { LabelFace } from "./internal/LabelOutline.ts";

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
 * @category models
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
 * @category models
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
 * @category constants
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
 * @category constants
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
 * @category models
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
 * @category utilities
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
 * @category constants
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
 * @category constants
 * @since 0.0.0
 */
export const MIN_LETTER_HEIGHT_CM = 0.32;

const INCH_MARGINS_CM = { top: 2.54, left: 2.54, right: 0.625 * 2.54, bottom: 0.375 * 2.54 } as const;

const MarginStandardBase = LiteralKit(["cfr-cm", "cfr-strict"]);

/**
 * Margin standard a sheet is laid out to.
 *
 * **Details**
 *
 * 37 CFR 1.84(g) states each minimum margin twice, in centimetres and in
 * inches, and the two figures differ slightly. `cfr-cm` is the centimetre
 * column ({@link MARGINS_CM}: 2.5 / 2.5 / 1.5 / 1.0 cm). `cfr-strict` takes,
 * per side, the larger of the two (2.54 / 2.54 / 1.5875 / 1.0 cm), so a strict
 * sheet satisfies both columns and still passes the validator's centimetre
 * floor.
 *
 * **Example** (Read the standards)
 *
 * ```ts
 * import { MarginStandard } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(MarginStandard.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MarginStandard = MarginStandardBase.pipe(
  $I.annoteSchema("MarginStandard", {
    description:
      "`cfr-cm` (the 1.84(g) centimetre minimums) or `cfr-strict` (per side, the larger of the centimetre and inch minimums).",
  }),
  SchemaUtils.withLiteralKitStatics(MarginStandardBase)
);

/**
 * Type for {@link MarginStandard}.
 *
 * **Example** (Annotate a standard)
 *
 * ```ts
 * import type { MarginStandard } from "@beep/technical-drawing/Sheet.schemas"
 *
 * const standard: MarginStandard = "cfr-strict"
 * console.log(standard)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MarginStandard = typeof MarginStandard.Type;

/**
 * Page margins of a sheet, in centimetres.
 *
 * **Example** (The centimetre minimums)
 *
 * ```ts
 * import { SheetMargins } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(SheetMargins.make({ top: 2.5, left: 2.5, right: 1.5, bottom: 1 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SheetMargins extends S.Class<SheetMargins>($I`SheetMargins`)(
  {
    top: PositiveFinite.annotateKey({ description: "Top margin in cm." }),
    left: PositiveFinite.annotateKey({ description: "Left margin in cm." }),
    right: PositiveFinite.annotateKey({ description: "Right margin in cm." }),
    bottom: PositiveFinite.annotateKey({ description: "Bottom margin in cm." }),
  },
  $I.annote("SheetMargins", {
    description: "Top, left, right, and bottom page margins of a sheet in centimetres.",
  })
) {}

const MarginsCm = Fn({ input: MarginStandard, output: SheetMargins }).pipe(
  $I.annoteSchema("MarginsCm", {
    description: "Schema-backed page margins of a margin standard in centimetres.",
  })
);

/**
 * Page margins of a margin standard, in centimetres.
 *
 * **Details**
 *
 * `cfr-cm` returns {@link MARGINS_CM}. `cfr-strict` returns, per side, the
 * larger of {@link MARGINS_CM} and the 1.84(g) inch figures (1 in, 1 in,
 * 5/8 in, 3/8 in). {@link MARGINS_CM} stays the validator's floor.
 *
 * **Example** (Strict margins)
 *
 * ```ts
 * import { marginsCm } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(marginsCm("cfr-strict").right) // 1.5875
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const marginsCm: (standard: MarginStandard) => SheetMargins = MarginsCm.implementSync((standard) =>
  MarginStandard.$match(standard, {
    "cfr-cm": () => SheetMargins.make(MARGINS_CM),
    "cfr-strict": () =>
      SheetMargins.make({
        top: Math.max(MARGINS_CM.top, INCH_MARGINS_CM.top),
        left: Math.max(MARGINS_CM.left, INCH_MARGINS_CM.left),
        right: Math.max(MARGINS_CM.right, INCH_MARGINS_CM.right),
        bottom: Math.max(MARGINS_CM.bottom, INCH_MARGINS_CM.bottom),
      }),
  })
);

const LabelTypefaceBase = LiteralKit(["stroke", "sans", "serif"]);

/**
 * Typeface of a sheet label.
 *
 * **Details**
 *
 * `stroke` is the single-stroke glyph set the sheets were first lettered
 * with. `sans` and `serif` are filled outlines with the character widths of
 * Arial and Times New Roman: a vendored subset of the label characters,
 * licensed OFL-1.1 (see the package's `licenses/OFL-1.1.txt`). On the default
 * `outline` route labels stay outlines either way, so a sheet PDF embeds no
 * font; the `text` route (see {@link LabelRender}) sets them in a real font.
 *
 * **Example** (Read the typefaces)
 *
 * ```ts
 * import { LabelTypeface } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(LabelTypeface.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LabelTypeface = LabelTypefaceBase.pipe(
  $I.annoteSchema("LabelTypeface", {
    description:
      "`stroke` (single-stroke glyphs), `sans` (Arial-metric outlines), or `serif` (Times New Roman-metric outlines).",
  }),
  SchemaUtils.withLiteralKitStatics(LabelTypefaceBase)
);

/**
 * Type for {@link LabelTypeface}.
 *
 * **Example** (Annotate a typeface)
 *
 * ```ts
 * import type { LabelTypeface } from "@beep/technical-drawing/Sheet.schemas"
 *
 * const typeface: LabelTypeface = "serif"
 * console.log(typeface)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LabelTypeface = typeof LabelTypeface.Type;

// The stroke glyphs borrow the sans cap height, so one size reads alike in both.
const capPerEm = (typeface: LabelTypeface): number =>
  LabelTypeface.$match(typeface, {
    stroke: () => SANS_FACE.capHeight / SANS_FACE.unitsPerEm,
    sans: () => SANS_FACE.capHeight / SANS_FACE.unitsPerEm,
    serif: () => SERIF_FACE.capHeight / SERIF_FACE.unitsPerEm,
  });

const LabelCapHeightCm = Fn({
  input: S.Struct({
    typeface: LabelTypeface.annotateKey({ description: "Typeface of the label." }),
    sizePt: PositiveFinite.annotateKey({ description: "Font size in points." }),
  }),
  output: S.Finite,
}).pipe(
  $I.annoteSchema("LabelCapHeightCm", {
    description: "Schema-backed cap height in centimetres of a label typeface at a point size.",
  })
);

/**
 * Cap height in centimetres of a typeface at a point size, from the vendored
 * face's metrics.
 *
 * **Example** (Sans at 18 pt)
 *
 * ```ts
 * import { labelCapHeightCm } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(labelCapHeightCm({ typeface: "sans", sizePt: 18 }).toFixed(3)) // about 0.437
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const labelCapHeightCm: (style: typeof LabelCapHeightCm.inputSchema.Type) => number =
  LabelCapHeightCm.implementSync((style) => (style.sizePt * capPerEm(style.typeface)) / PT_PER_CM);

const LabelRenderBase = LiteralKit(["outline", "text"]);

/**
 * How a sheet label reaches the PDF.
 *
 * **Details**
 *
 * `outline` (the default) draws the label as filled outlines or strokes, so a
 * sheet embeds no font. `text` writes an SVG `<text>` element in a named font
 * family; `rsvg-convert` then embeds a subset of that font, so the PDF
 * carries real, searchable text. A `text` label needs an outlined typeface
 * (`sans` or `serif`) and a font directory on the sheet options.
 *
 * **Example** (Read the routes)
 *
 * ```ts
 * import { LabelRender } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(LabelRender.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LabelRender = LabelRenderBase.pipe(
  $I.annoteSchema("LabelRender", {
    description: "`outline` (filled outlines or strokes, no font) or `text` (embedded font text).",
  }),
  SchemaUtils.withLiteralKitStatics(LabelRenderBase)
);

/**
 * Type for {@link LabelRender}.
 *
 * **Example** (Annotate a route)
 *
 * ```ts
 * import type { LabelRender } from "@beep/technical-drawing/Sheet.schemas"
 *
 * const render: LabelRender = "text"
 * console.log(render)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LabelRender = typeof LabelRender.Type;

const AbsolutePath = S.NonEmptyString.check(
  S.makeFilter(Str.startsWith("/"), {
    identifier: $I`AbsolutePathCheck`,
    title: "Absolute Path",
    description: "A font location is an absolute path, so a render does not depend on its working directory.",
    message: "Expected an absolute path",
  })
);

const AbsoluteFontFile = S.NonEmptyString.check(
  S.makeFilter(Str.startsWith("/"), {
    identifier: $I`LabelFontFileAbsoluteCheck`,
    title: "Label Font File",
    description:
      "A label font file is named by an absolute path, so a render does not depend on its working directory.",
    message: "Expected an absolute font file path",
  })
);

/**
 * Typeface and size of one sheet label, with an optional operator font file.
 *
 * **Details**
 *
 * `sizePt` is the font size in points. Its cap height (from the vendored
 * face of `typeface`) must reach 37 CFR 1.84(p)(3)'s 0.32 cm. `fontFile`
 * names a TrueType file (for example a licensed Arial) outlined at render
 * time instead of the vendored face; the render records its sha256 and checks
 * its own cap height. A `stroke` label takes no font file. `render: "text"`
 * writes the label as embedded text in `fontFamily` (default: the typeface's
 * metric family), resolved from the sheet's `fontDirectory`.
 *
 * **Example** (The sheet number at 18 pt sans)
 *
 * ```ts
 * import { LabelStyle } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(LabelStyle.make({ typeface: "sans", sizePt: 18 }).sizePt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LabelStyle extends S.Class<LabelStyle>($I`LabelStyle`)(
  S.Struct({
    typeface: LabelTypeface.annotateKey({ description: "Typeface of the label." }),
    sizePt: PositiveFinite.annotateKey({ description: "Font size in points." }),
    fontFile: S.OptionFromOptionalKey(AbsoluteFontFile).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Absolute path of a TrueType file outlined instead of the vendored face. Never committed; its sha256 goes in the manifest.",
      })
    ),
    render: LabelRender.pipe(
      S.withConstructorDefault(Effect.succeed("outline" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("outline" as const)),
      S.annotateKey({ description: "How the label reaches the PDF: outlines or embedded text. Defaults to `outline`." })
    ),
    fontFamily: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Font family a `text` label requests, for example `Arial`. Absent, the typeface's metric family: `Arial` for sans, `Times New Roman` for serif.",
      })
    ),
  }).check(
    S.makeFilter((style) => labelCapHeightCm(style) >= MIN_LETTER_HEIGHT_CM, {
      identifier: $I`LabelStyleCapHeightCheck`,
      title: "Label Cap Height",
      description: "37 CFR 1.84(p)(3) requires lettering at least 0.32 cm high.",
      message: "Expected a label size whose cap height is at least 0.32 cm",
    }),
    S.makeFilter((style) => style.typeface !== "stroke" || O.isNone(style.fontFile), {
      identifier: $I`LabelStyleFontFileCheck`,
      title: "Label Font File Typeface",
      description: "Only outlined typefaces read a font file.",
      message: "Expected no font file on a stroke label",
    }),
    S.makeFilter((style) => style.render === "outline" || style.typeface !== "stroke", {
      identifier: $I`LabelStyleTextTypefaceCheck`,
      title: "Label Text Typeface",
      description: "A text label is set in a font, so it needs the sans or serif typeface.",
      message: "Expected the sans or serif typeface on a text label",
    }),
    S.makeFilter((style) => style.render === "outline" || O.isNone(style.fontFile), {
      identifier: $I`LabelStyleTextFontFileCheck`,
      title: "Label Text Font File",
      description: "A text label takes its font from the sheet's font directory, not from a font file.",
      message: "Expected no font file on a text label",
    }),
    S.makeFilter((style) => style.render === "text" || O.isNone(style.fontFamily), {
      identifier: $I`LabelStyleFontFamilyCheck`,
      title: "Label Font Family",
      description: "Only a text label requests a font family.",
      message: "Expected no font family on an outline label",
    })
  ),
  $I.annote("LabelStyle", {
    description:
      "Typeface, point size, optional operator font file, render route, and requested font family of one sheet label.",
  })
) {}

/**
 * Font family a label requests when it is rendered as text.
 *
 * **Details**
 *
 * The style's `fontFamily`, else the typeface's metric family: `Arial` for
 * `sans`, `Times New Roman` for `serif` (and `stroke`, which a text label
 * never uses).
 *
 * **Example** (The default sans family)
 *
 * ```ts
 * import { LabelStyle, labelFontFamily } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(labelFontFamily(LabelStyle.make({ typeface: "sans", sizePt: 18, render: "text" }))) // "Arial"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const labelFontFamily = (style: LabelStyle): string =>
  O.getOrElse(style.fontFamily, () =>
    LabelTypeface.$match(style.typeface, {
      stroke: () => "Times New Roman",
      sans: () => "Arial",
      serif: () => "Times New Roman",
    })
  );

/**
 * Label faces resolved by the caller for `fontFile` label styles.
 *
 * **Details**
 *
 * A style whose `fontFile` is set needs its outlines loaded first (the
 * figure-set renderer does this); an entry here replaces the vendored face of
 * that label's typeface. Without an entry the vendored face is used.
 *
 * **Example** (No overrides)
 *
 * ```ts
 * import { SheetLabelFaces } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(SheetLabelFaces.make({}).figure._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SheetLabelFaces extends S.Class<SheetLabelFaces>($I`SheetLabelFaces`)(
  {
    figure: S.OptionFromOptionalKey(LabelFace).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Face replacing the vendored one for the FIG. n label." })
    ),
    sheetNumber: S.OptionFromOptionalKey(LabelFace).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Face replacing the vendored one for the n/N sheet number." })
    ),
  },
  $I.annote("SheetLabelFaces", {
    description: "Label faces loaded by the caller from fontFile label styles, per label.",
  })
) {}

/**
 * One family a PDF converter must bind: the family a label requests and the
 * family name of the font file it resolved to.
 *
 * **Example** (Arial resolved to itself)
 *
 * ```ts
 * import { LabelFontAlias } from "@beep/technical-drawing/Sheet.schemas"
 *
 * console.log(LabelFontAlias.make({ requested: "Arial", family: "Arial" }).family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LabelFontAlias extends S.Class<LabelFontAlias>($I`LabelFontAlias`)(
  {
    requested: S.NonEmptyString.annotateKey({ description: "Family name the SVG `<text>` element requests." }),
    family: S.NonEmptyString.annotateKey({ description: "Family name recorded in the resolved font file." }),
  },
  $I.annote("LabelFontAlias", {
    description: "A requested label font family and the family name of the font file it resolved to.",
  })
) {}

/**
 * Fonts a PDF converter may use for text labels: one directory and the
 * families bound inside it.
 *
 * **Details**
 *
 * The converter sees no font outside `directory` and binds each requested
 * family to its resolved family, so the embedded font is a function of the
 * directory's files alone.
 *
 * **Example** (One family)
 *
 * ```ts
 * import { LabelFontAlias, SheetFonts } from "@beep/technical-drawing/Sheet.schemas"
 *
 * const fonts = SheetFonts.make({
 *   directory: "/fonts",
 *   families: [LabelFontAlias.make({ requested: "Arial", family: "Arial" })]
 * })
 * console.log(fonts.directory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SheetFonts extends S.Class<SheetFonts>($I`SheetFonts`)(
  {
    directory: AbsolutePath.annotateKey({ description: "The only directory the converter reads fonts from." }),
    families: S.Array(LabelFontAlias).annotateKey({ description: "Requested families and their resolved names." }),
  },
  $I.annote("SheetFonts", {
    description: "Font directory and family bindings a PDF converter uses for text labels.",
  })
) {}

/**
 * Sheet options of a render: format, margin standard, line weight, lettering,
 * label gap and label styles, inner safety gap, shading pitches, and the
 * broken-line dash pattern.
 *
 * **Gotchas**
 *
 * Round caps eat half the line weight from each end of a dash. When
 * `brokenGapMm - lineWeightMm` falls under 0.4 mm the broken layer is drawn
 * with a gap of `lineWeightMm + 0.4` instead (see `drawnBrokenGapMm` in the composer),
 * so a broken (unclaimed) outline never prints as a solid line and a heavy
 * line weight stays usable on a sheet without broken lines.
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
 * @category models
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
    margins: MarginStandard.pipe(
      S.withConstructorDefault(Effect.succeed("cfr-cm" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("cfr-cm" as const)),
      S.annotateKey({ description: "Margin standard the sheet is laid out to. Defaults to `cfr-cm`." })
    ),
    labelGapMm: S.OptionFromOptionalKey(
      S.Finite.check(
        S.isGreaterThanOrEqualTo(0, {
          identifier: $I`LabelGapCheck`,
          title: "Label Gap",
          description: "Gap between a page margin and the nearest label ink.",
          message: "Expected a non-negative label gap",
        })
      )
    ).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Gap in mm between the top margin and the sheet number's ink top, and between the bottom margin and the `FIG. n` ink bottom. Absent, the labels sit at the safety gap, as before the option existed.",
      })
    ),
    sheetNumberLabel: S.OptionFromOptionalKey(LabelStyle).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Style of the `n/N` sheet number. Absent, it is stroked at `letterHeightCm`, as before the option existed.",
      })
    ),
    figureLabel: S.OptionFromOptionalKey(LabelStyle).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Style of the `FIG. n` label. Absent, it is stroked at `letterHeightCm`, as before the option existed.",
      })
    ),
    fontDirectory: S.OptionFromOptionalKey(AbsolutePath).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Absolute directory holding the TrueType/OpenType files `text` labels are set in. The PDF converter sees only this directory. Supplied by the operator, never committed.",
      })
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
      S.withConstructorDefault(Effect.succeed(1.2)),
      S.withDecodingDefaultTypeKey(Effect.succeed(1.2)),
      S.annotateKey({
        description:
          "Line pitch on the darkest faces, in mm on the sheet. Defaults to 1.2, which stays open at two-thirds reduction (judge round 1, R1-02).",
      })
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
          "Exposure above which a face stays unshaded under the uniform style. Defaults to 0.55, just below a face seen square-on (1/√3 under the 45° light), so plans and elevations stay line drawings and only oblique faces are shaded. Graded shading ignores it.",
      })
    ),
    shadingStyle: ShadingStyle.pipe(
      S.withConstructorDefault(Effect.succeed("uniform" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("uniform" as const)),
      S.annotateKey({
        description:
          "Shading line spacing: `uniform` (the default, evenly spaced, lit faces blank) or `graded` (every visible planar face, lines from the shadow edge).",
      })
    ),
    shadingAxis: HatchAxis.pipe(
      S.withConstructorDefault(Effect.succeed("longest-edge" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("longest-edge" as const)),
      S.annotateKey({
        description:
          "Shading line direction: `longest-edge` (the default) or `surface-class` (walls vertical; inclined and level faces along their darkest major edge).",
      })
    ),
    shadingMinFaceSpanMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`ShadingMinFaceSpanMmCheck`,
        title: "Shading Minimum Face Span",
        description: "A face narrower than this on the sheet is a sliver and gets no shading lines.",
        message: "Expected a non-negative minimum face span",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Width in mm on the sheet below which a face (a thin board edge, a tab root) gets no shading lines. Defaults to 0 (no slivers).",
      })
    ),
    shadingMinStrokeMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`ShadingMinStrokeMmCheck`,
        title: "Shading Minimum Stroke",
        description: "A shading stroke shorter than this on the sheet is not drawn.",
        message: "Expected a non-negative minimum stroke length",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Length in mm on the sheet below which a shading stroke (a chord near a face's pointed corner) is dropped. Defaults to 0 (every chord is drawn).",
      })
    ),
    brokenDashMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`BrokenDashCheck`,
        title: "Broken-Line Dash",
        description: "Dashes shorter than 1 mm read as dots once the sheet is reduced to two-thirds.",
        message: "Expected a broken-line dash of at least 1 mm",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(3)),
      S.withDecodingDefaultTypeKey(Effect.succeed(3)),
      S.annotateKey({ description: "Dash length of broken (unclaimed) lines, in mm on the sheet. Defaults to 3." })
    ),
    brokenGapMm: S.Finite.check(
      S.isGreaterThanOrEqualTo(0.75, {
        identifier: $I`BrokenGapCheck`,
        title: "Broken-Line Gap",
        description: "Gaps narrower than 0.75 mm close up once round line caps and two-thirds reduction are applied.",
        message: "Expected a broken-line gap of at least 0.75 mm",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(1.5)),
      S.withDecodingDefaultTypeKey(Effect.succeed(1.5)),
      S.annotateKey({
        description:
          "Gap between dashes of broken (unclaimed) lines, in mm on the sheet, measured before the round caps. Defaults to 1.5.",
      })
    ),
  },
  $I.annote("SheetOptions", {
    description:
      "Page format, margin standard, stroke and shading widths, shading pitch range, style, axis, sliver width and minimum stroke, broken-line dash pattern, lettering height, label gap and styles, label font directory, and margin safety gap of a render.",
  })
) {}
