/**
 * Schema-first model of the beep brand identity: color schemes, typography stacks, the mark geometry, and the render requests that encode them into CSS and SVG.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BrandId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { HexColor } from "@beep/schema/Color";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $BrandId.create("Brand.schema");

const svgPathDataPattern = /^[Mm]/;
const printableTextPattern = /^[^\u0000-\u001f\u007f-\u009f\p{Cs}\p{Noncharacter_Code_Point}]+$/u;

/**
 * Non-empty text with no control characters, lone surrogates, or Unicode noncharacters, safe to embed in CSS strings and XML 1.0.
 *
 * **Example** (Construct printable text)
 *
 * ```ts
 * import { PrintableText } from "@beep/brand/Brand.schema"
 *
 * console.log(PrintableText.make("Inter Variable"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrintableText = S.NonEmptyString.check(
  S.isPattern(
    printableTextPattern,
    $I.annote("PrintableTextPatternCheck", {
      title: "Printable Text",
      description: "Non-empty text with no control characters, lone surrogates, or noncharacters.",
      message: "Text must not contain control characters, lone surrogates, or noncharacters",
    })
  )
).pipe(
  $I.annoteSchema("PrintableText", {
    description: "Non-empty text with no control characters, lone surrogates, or noncharacters.",
  })
);

/**
 * Decoded {@link PrintableText} value.
 *
 * **Example** (Annotate printable text)
 *
 * ```ts
 * import { PrintableText } from "@beep/brand/Brand.schema"
 *
 * const family: PrintableText = PrintableText.make("Inter")
 * console.log(family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PrintableText = typeof PrintableText.Type;

/**
 * Tint step of a ten-stop brand color scale, lightest first.
 *
 * **Example** (Enumerate scale steps)
 *
 * ```ts
 * import { ScaleStep } from "@beep/brand/Brand.schema"
 *
 * console.log(ScaleStep.literals.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ScaleStep = LiteralKit(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]).pipe(
  $I.annoteSchema("ScaleStep", { description: "Tint step of a ten-stop brand color scale, lightest first." })
);

/**
 * Decoded {@link ScaleStep} literal.
 *
 * **Example** (Annotate a scale step)
 *
 * ```ts
 * import type { ScaleStep } from "@beep/brand/Brand.schema"
 *
 * const accent: ScaleStep = "400"
 * console.log(accent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ScaleStep = typeof ScaleStep.Type;

/**
 * Elevation step of a surface scale, base first.
 *
 * **Example** (Enumerate surface steps)
 *
 * ```ts
 * import { SurfaceStep } from "@beep/brand/Brand.schema"
 *
 * console.log(SurfaceStep.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SurfaceStep = LiteralKit(["0", "50", "100", "200", "300", "400"]).pipe(
  $I.annoteSchema("SurfaceStep", { description: "Elevation step of a six-stop surface scale, base first." })
);

/**
 * Decoded {@link SurfaceStep} literal.
 *
 * **Example** (Annotate a surface step)
 *
 * ```ts
 * import type { SurfaceStep } from "@beep/brand/Brand.schema"
 *
 * const base: SurfaceStep = "0"
 * console.log(base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SurfaceStep = typeof SurfaceStep.Type;

/**
 * Ten-stop hex color scale keyed by {@link ScaleStep}.
 *
 * **Example** (Read the accent step)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.dark.brand["400"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ColorScale extends S.Opaque<ColorScale, { readonly brand: unique symbol }>()(
  S.Struct({
    "50": HexColor.annotateKey({ description: "Lightest tint." }),
    "100": HexColor.annotateKey({ description: "Tint step 100." }),
    "200": HexColor.annotateKey({ description: "Tint step 200." }),
    "300": HexColor.annotateKey({ description: "Tint step 300; light-scheme accent text." }),
    "400": HexColor.annotateKey({ description: "Tint step 400; the accent step in both schemes." }),
    "500": HexColor.annotateKey({ description: "Tint step 500; the anchor hue." }),
    "600": HexColor.annotateKey({ description: "Tint step 600." }),
    "700": HexColor.annotateKey({ description: "Tint step 700." }),
    "800": HexColor.annotateKey({ description: "Tint step 800." }),
    "900": HexColor.annotateKey({ description: "Darkest shade; favicon and theme-color ground." }),
  }).pipe($I.annoteSchema("ColorScale", { description: "Ten-stop hex color scale keyed by ScaleStep." }))
) {}

/**
 * Six-stop surface (background) scale keyed by {@link SurfaceStep}.
 *
 * **Example** (Read the page background)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.dark.surface["0"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SurfaceScale extends S.Opaque<SurfaceScale, { readonly brand: unique symbol }>()(
  S.Struct({
    "0": HexColor.annotateKey({ description: "Page background." }),
    "50": HexColor.annotateKey({ description: "Raised surface one step above the page." }),
    "100": HexColor.annotateKey({ description: "Card and panel surface." }),
    "200": HexColor.annotateKey({ description: "Muted control surface." }),
    "300": HexColor.annotateKey({ description: "Hover and separator surface." }),
    "400": HexColor.annotateKey({ description: "Strongest surface; scrollbar thumb hover." }),
  }).pipe($I.annoteSchema("SurfaceScale", { description: "Six-stop surface scale keyed by SurfaceStep." }))
) {}

/**
 * Foreground text colors at three emphasis levels.
 *
 * **Example** (Read muted text color)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.dark.foreground.muted)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Foreground extends S.Opaque<Foreground, { readonly brand: unique symbol }>()(
  S.Struct({
    base: HexColor.annotateKey({ description: "Primary text color." }),
    muted: HexColor.annotateKey({ description: "Secondary text color." }),
    subtle: HexColor.annotateKey({ description: "Tertiary text color for hints and metadata." }),
  }).pipe($I.annoteSchema("Foreground", { description: "Foreground text colors at three emphasis levels." }))
) {}

/**
 * Border colors at rest and on hover.
 *
 * **Example** (Read the resting border)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.dark.border.base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Border extends S.Opaque<Border, { readonly brand: unique symbol }>()(
  S.Struct({
    base: HexColor.annotateKey({ description: "Resting border color." }),
    hover: HexColor.annotateKey({ description: "Border color on hover." }),
  }).pipe($I.annoteSchema("Border", { description: "Border colors at rest and on hover." }))
) {}

/**
 * Semantic status colors.
 *
 * **Example** (Read the error color)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.dark.semantic.error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Semantic extends S.Opaque<Semantic, { readonly brand: unique symbol }>()(
  S.Struct({
    success: HexColor.annotateKey({ description: "Success status color." }),
    warning: HexColor.annotateKey({ description: "Warning status color." }),
    error: HexColor.annotateKey({ description: "Error status color." }),
  }).pipe($I.annoteSchema("Semantic", { description: "Semantic status colors." }))
) {}

/**
 * Opacity in the closed unit interval.
 *
 * **Example** (Construct an alpha)
 *
 * ```ts
 * import { Alpha } from "@beep/brand/Brand.schema"
 *
 * console.log(Alpha.make(0.35))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Alpha = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(
  S.brand("Alpha"),
  $I.annoteSchema("Alpha", { description: "Opacity in the closed unit interval." })
);

/**
 * Decoded {@link Alpha} value.
 *
 * **Example** (Annotate an alpha)
 *
 * ```ts
 * import { Alpha } from "@beep/brand/Brand.schema"
 *
 * const half: Alpha = Alpha.make(0.5)
 * console.log(half)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Alpha = typeof Alpha.Type;

/**
 * One color stop of an ambient glow: a brand scale step at an opacity.
 *
 * **Example** (Construct a glow stop)
 *
 * ```ts
 * import { Alpha, GlowStop } from "@beep/brand/Brand.schema"
 *
 * console.log(GlowStop.make({ step: "500", alpha: Alpha.make(0.35) }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GlowStop extends S.Opaque<GlowStop, { readonly brand: unique symbol }>()(
  S.Struct({
    step: ScaleStep.annotateKey({ description: "Brand scale step the glow samples." }),
    alpha: Alpha.annotateKey({ description: "Opacity of the sampled step." }),
  }).pipe($I.annoteSchema("GlowStop", { description: "A brand scale step at an opacity." }))
) {}

/**
 * Radial glow layer with a bright start stop and a dimmer mid stop.
 *
 * **Example** (Read the primary glow start)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.dark.glow.primary.start.step)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GlowLayer extends S.Opaque<GlowLayer, { readonly brand: unique symbol }>()(
  S.Struct({
    start: GlowStop.annotateKey({ description: "Center stop of the radial glow." }),
    mid: GlowStop.annotateKey({ description: "Mid-radius stop before the glow fades to transparent." }),
  }).pipe($I.annoteSchema("GlowLayer", { description: "Radial glow layer with start and mid stops." }))
) {}

/**
 * The three ambient glow layers used behind graph and orb visuals.
 *
 * **Example** (Read the tertiary glow)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.dark.glow.tertiary.mid.alpha)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Glow extends S.Opaque<Glow, { readonly brand: unique symbol }>()(
  S.Struct({
    primary: GlowLayer.annotateKey({ description: "Dominant glow layer." }),
    secondary: GlowLayer.annotateKey({ description: "Second glow layer, drifting against the primary." }),
    tertiary: GlowLayer.annotateKey({ description: "Deep background glow layer." }),
  }).pipe($I.annoteSchema("Glow", { description: "The three ambient glow layers." }))
) {}

/**
 * A complete color scheme for one appearance (light or dark).
 *
 * **Example** (Read the light scheme border)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.light.border.hover)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ColorScheme extends S.Opaque<ColorScheme, { readonly nominal: unique symbol }>()(
  S.Struct({
    brand: ColorScale.annotateKey({ description: "Brand hue scale for this scheme." }),
    surface: SurfaceScale.annotateKey({ description: "Background surfaces for this scheme." }),
    foreground: Foreground.annotateKey({ description: "Text colors for this scheme." }),
    border: Border.annotateKey({ description: "Border colors for this scheme." }),
    semantic: Semantic.annotateKey({ description: "Status colors for this scheme." }),
    glow: Glow.annotateKey({ description: "Ambient glow layers for this scheme." }),
  }).pipe($I.annoteSchema("ColorScheme", { description: "A complete color scheme for one appearance." }))
) {}

/**
 * Appearance name of a color scheme.
 *
 * **Example** (Guard a scheme name)
 *
 * ```ts
 * import { SchemeName } from "@beep/brand/Brand.schema"
 *
 * console.log(SchemeName.is.dark("dark"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemeName = LiteralKit(["light", "dark"]).pipe(
  $I.annoteSchema("SchemeName", { description: "Appearance name of a color scheme." })
);

/**
 * Decoded {@link SchemeName} literal.
 *
 * **Example** (Annotate a scheme name)
 *
 * ```ts
 * import type { SchemeName } from "@beep/brand/Brand.schema"
 *
 * const scheme: SchemeName = "dark"
 * console.log(scheme)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SchemeName = typeof SchemeName.Type;

/**
 * A font family with its ordered fallbacks.
 *
 * **Example** (Read the sans family)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.typography.sans.family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FontStack extends S.Opaque<FontStack, { readonly brand: unique symbol }>()(
  S.Struct({
    family: PrintableText.annotateKey({ description: "Preferred font family name." }),
    fallbacks: S.Array(PrintableText).annotateKey({
      description: "Ordered fallback families and generic keywords.",
    }),
  }).pipe($I.annoteSchema("FontStack", { description: "A font family with its ordered fallbacks." }))
) {}

/**
 * Brand typography: the sans and mono stacks.
 *
 * **Example** (Read the mono family)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.typography.mono.family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Typography extends S.Opaque<Typography, { readonly brand: unique symbol }>()(
  S.Struct({
    sans: FontStack.annotateKey({ description: "Body and UI text stack." }),
    mono: FontStack.annotateKey({ description: "Code and data stack." }),
  }).pipe($I.annoteSchema("Typography", { description: "Brand typography: sans and mono stacks." }))
) {}

/**
 * SVG path data beginning with a move-to command.
 *
 * **Example** (Construct path data)
 *
 * ```ts
 * import { SvgPathData } from "@beep/brand/Brand.schema"
 *
 * console.log(SvgPathData.make("M6 20l6.5 -9"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SvgPathData = S.String.check(
  S.isPattern(
    svgPathDataPattern,
    $I.annote("SvgPathDataPatternCheck", {
      title: "SVG Path Data",
      description: "SVG path data beginning with a move-to command.",
      message: "SVG path data must begin with M or m",
    })
  ),
  S.isPattern(
    printableTextPattern,
    $I.annote("SvgPathDataPrintableCheck", {
      title: "Printable SVG Path Data",
      description: "SVG path data with no control characters, lone surrogates, or noncharacters.",
      message: "SVG path data must not contain control characters",
    })
  )
).pipe(
  S.brand("SvgPathData"),
  $I.annoteSchema("SvgPathData", { description: "SVG path data beginning with a move-to command." })
);

/**
 * Decoded {@link SvgPathData} value.
 *
 * **Example** (Annotate path data)
 *
 * ```ts
 * import { SvgPathData } from "@beep/brand/Brand.schema"
 *
 * const stroke: SvgPathData = SvgPathData.make("M0 0h1")
 * console.log(stroke)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SvgPathData = typeof SvgPathData.Type;

/**
 * A point in mark user units.
 *
 * **Example** (Construct a point)
 *
 * ```ts
 * import { MarkPoint } from "@beep/brand/Brand.schema"
 *
 * console.log(MarkPoint.make({ x: 5.4, y: 9.5 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkPoint extends S.Opaque<MarkPoint, { readonly brand: unique symbol }>()(
  S.Struct({
    x: S.Finite.annotateKey({ description: "Horizontal coordinate in mark user units." }),
    y: S.Finite.annotateKey({ description: "Vertical coordinate in mark user units." }),
  }).pipe($I.annoteSchema("MarkPoint", { description: "A point in mark user units." }))
) {}

/**
 * A rotation in degrees about an origin.
 *
 * **Example** (Construct a rotation)
 *
 * ```ts
 * import { MarkPoint, MarkRotation } from "@beep/brand/Brand.schema"
 *
 * console.log(MarkRotation.make({ degrees: 8, origin: MarkPoint.make({ x: 12.5, y: 2.5 }) }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkRotation extends S.Opaque<MarkRotation, { readonly brand: unique symbol }>()(
  S.Struct({
    degrees: S.Finite.annotateKey({ description: "Clockwise rotation in degrees." }),
    origin: MarkPoint.annotateKey({ description: "Rotation origin in the rotated group's own units." }),
  }).pipe($I.annoteSchema("MarkRotation", { description: "A rotation in degrees about an origin." }))
) {}

/**
 * The tilted pixel glasses worn by the lambda: placement transform plus frame and lens paths.
 *
 * **Example** (Count the lenses)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.mark.glasses.lenses.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PixelGlasses extends S.Opaque<PixelGlasses, { readonly brand: unique symbol }>()(
  S.Struct({
    translate: MarkPoint.annotateKey({ description: "Placement offset in mark user units." }),
    scale: S.Finite.annotateKey({ description: "Uniform scale from glasses pixels to mark user units." }),
    rotation: MarkRotation.annotateKey({ description: "Tilt applied after scaling." }),
    frame: SvgPathData.annotateKey({ description: "Filled frame outline path in glasses pixels." }),
    lenses: S.Array(SvgPathData).annotateKey({ description: "Filled lens paths in glasses pixels." }),
  }).pipe(
    $I.annoteSchema("PixelGlasses", {
      description: "Tilted pixel glasses: placement transform plus frame and lens paths.",
    })
  )
) {}

/**
 * Geometry of the beep mark: stroked lambda paths plus the pixel glasses, on a square view box.
 *
 * **Example** (Read the view box size)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.mark.viewBox)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BrandMark extends S.Opaque<BrandMark, { readonly brand: unique symbol }>()(
  S.Struct({
    name: PrintableText.annotateKey({ description: "Accessible name of the mark." }),
    viewBox: S.Finite.check(S.isGreaterThan(0)).annotateKey({
      description: "Side length of the square view box in user units.",
    }),
    strokes: S.Array(SvgPathData).annotateKey({ description: "Stroked lambda paths." }),
    strokeWidth: S.Finite.check(S.isGreaterThan(0)).annotateKey({
      description: "Stroke width of the lambda paths in user units.",
    }),
    glasses: PixelGlasses.annotateKey({ description: "The pixel glasses overlay." }),
  }).pipe($I.annoteSchema("BrandMark", { description: "Geometry of the beep mark on a square view box." }))
) {}

/**
 * The whole brand identity: both color schemes, typography, and the mark.
 *
 * **Example** (Read the brand name)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 *
 * console.log(beep.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BrandIdentity extends S.Opaque<BrandIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    name: PrintableText.annotateKey({ description: "Brand name as rendered in wordmarks." }),
    light: ColorScheme.annotateKey({ description: "Light appearance scheme." }),
    dark: ColorScheme.annotateKey({ description: "Dark appearance scheme." }),
    typography: Typography.annotateKey({ description: "Font stacks." }),
    mark: BrandMark.annotateKey({ description: "Mark geometry." }),
  }).pipe(
    $I.annoteSchema("BrandIdentity", {
      description: "The whole brand identity: color schemes, typography, and the mark.",
    })
  )
) {}

/**
 * SVG paint for a stroke: a hex color or the inherited `currentColor`.
 *
 * **Example** (Inherit the text color)
 *
 * ```ts
 * import { SvgPaint } from "@beep/brand/Brand.schema"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SvgPaint)("currentColor"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SvgPaint = S.Union([HexColor, S.Literal("currentColor")]).pipe(
  $I.annoteSchema("SvgPaint", { description: "A hex color or the inherited currentColor keyword." })
);

/**
 * Decoded {@link SvgPaint} value.
 *
 * **Example** (Annotate a paint)
 *
 * ```ts
 * import type { SvgPaint } from "@beep/brand/Brand.schema"
 *
 * const paint: SvgPaint = "currentColor"
 * console.log(paint)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SvgPaint = typeof SvgPaint.Type;

/**
 * Colors applied to the mark's lambda stroke, glasses frame, and lenses.
 *
 * **Example** (Paint the mark for dark surfaces)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 * import { MarkPaint } from "@beep/brand/Brand.schema"
 *
 * const paint = MarkPaint.make({ stroke: "currentColor", frame: beep.dark.foreground.base, lens: beep.dark.surface["0"] })
 * console.log(paint.frame)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkPaint extends S.Opaque<MarkPaint, { readonly brand: unique symbol }>()(
  S.Struct({
    stroke: SvgPaint.annotateKey({ description: "Lambda stroke paint." }),
    frame: HexColor.annotateKey({ description: "Glasses frame fill." }),
    lens: HexColor.annotateKey({ description: "Glasses lens fill." }),
  }).pipe($I.annoteSchema("MarkPaint", { description: "Colors for the mark's stroke, frame, and lenses." }))
) {}

/**
 * Optional rounded ground rectangle behind the mark (favicons and app icons).
 *
 * **Example** (Ground the mark on brand-900)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 * import { MarkGround } from "@beep/brand/Brand.schema"
 *
 * console.log(MarkGround.make({ fill: beep.dark.brand["900"], radius: 6 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkGround extends S.Opaque<MarkGround, { readonly brand: unique symbol }>()(
  S.Struct({
    fill: HexColor.annotateKey({ description: "Ground rectangle fill." }),
    radius: S.Finite.check(S.isGreaterThanOrEqualTo(0)).annotateKey({
      description: "Corner radius in output user units.",
    }),
  }).pipe($I.annoteSchema("MarkGround", { description: "Rounded ground rectangle behind the mark." }))
) {}

/**
 * Request to render the mark as a standalone SVG document.
 *
 * **Example** (Render request for the 24-unit mark)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 * import { MarkPaint, MarkSvgRequest } from "@beep/brand/Brand.schema"
 *
 * const request = MarkSvgRequest.make({
 *   mark: beep.mark,
 *   size: 24,
 *   paint: MarkPaint.make({ stroke: "currentColor", frame: beep.dark.foreground.base, lens: beep.dark.surface["0"] }),
 * })
 * console.log(request.size)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkSvgRequest extends S.Opaque<MarkSvgRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    mark: BrandMark.annotateKey({ description: "Mark geometry to render." }),
    size: S.Finite.check(S.isGreaterThan(0)).annotateKey({
      description: "Output view box side length; the mark scales to fill it.",
    }),
    paint: MarkPaint.annotateKey({ description: "Colors for the mark." }),
    ground: S.OptionFromOptionalKey(MarkGround)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional ground rectangle behind the mark." }),
  }).pipe(
    $I.annoteSchema("MarkSvgRequest", { description: "Request to render the mark as a standalone SVG document." })
  )
) {}

/**
 * Request to render the mark beside the brand name as a wordmark SVG.
 *
 * **Example** (Wordmark request for dark surfaces)
 *
 * ```ts
 * import { beep } from "@beep/brand/Brand.tokens"
 * import { MarkPaint, WordmarkSvgRequest } from "@beep/brand/Brand.schema"
 *
 * const request = WordmarkSvgRequest.make({
 *   identity: beep,
 *   paint: MarkPaint.make({ stroke: beep.dark.brand["400"], frame: beep.dark.foreground.base, lens: beep.dark.surface["0"] }),
 *   textFill: beep.dark.foreground.base,
 * })
 * console.log(request.identity.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WordmarkSvgRequest extends S.Opaque<WordmarkSvgRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    identity: BrandIdentity.annotateKey({ description: "Identity supplying the mark, name, and sans stack." }),
    paint: MarkPaint.annotateKey({ description: "Colors for the mark." }),
    textFill: HexColor.annotateKey({ description: "Fill for the brand name text." }),
  }).pipe($I.annoteSchema("WordmarkSvgRequest", { description: "Request to render the mark beside the brand name." }))
) {}
