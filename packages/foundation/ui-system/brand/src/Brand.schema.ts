/**
 * Schema-first model of the beep brand identity: color schemes, typography stacks, the mark geometry, and the render requests that encode them into CSS and SVG.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BrandId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { HexColor } from "@beep/schema/Color";
import * as S from "effect/Schema";

const $I = $BrandId.create("Brand.schema");

const svgPathDataPattern = /^[Mm]/;

/**
 * Tint step of a ten-stop brand color scale, lightest first.
 *
 * **Example** (Enumerate scale steps)
 *
 * ```ts
 * import { ScaleStep } from "@beep/brand"
 *
 * console.log(ScaleStep.Options.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ScaleStep = LiteralKit(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]).annotate(
  $I.annote("ScaleStep", { description: "Tint step of a ten-stop brand color scale, lightest first." })
);

/**
 * Decoded {@link ScaleStep} literal.
 *
 * **Example** (Annotate a scale step)
 *
 * ```ts
 * import type { ScaleStep } from "@beep/brand"
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
 * import { SurfaceStep } from "@beep/brand"
 *
 * console.log(SurfaceStep.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SurfaceStep = LiteralKit(["0", "50", "100", "200", "300", "400"]).annotate(
  $I.annote("SurfaceStep", { description: "Elevation step of a six-stop surface scale, base first." })
);

/**
 * Decoded {@link SurfaceStep} literal.
 *
 * **Example** (Annotate a surface step)
 *
 * ```ts
 * import type { SurfaceStep } from "@beep/brand"
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
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.dark.brand["400"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ColorScale extends S.Class<ColorScale>($I`ColorScale`)(
  {
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
  },
  $I.annote("ColorScale", { description: "Ten-stop hex color scale keyed by ScaleStep." })
) {}

/**
 * Six-stop surface (background) scale keyed by {@link SurfaceStep}.
 *
 * **Example** (Read the page background)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.dark.surface["0"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SurfaceScale extends S.Class<SurfaceScale>($I`SurfaceScale`)(
  {
    "0": HexColor.annotateKey({ description: "Page background." }),
    "50": HexColor.annotateKey({ description: "Raised surface one step above the page." }),
    "100": HexColor.annotateKey({ description: "Card and panel surface." }),
    "200": HexColor.annotateKey({ description: "Muted control surface." }),
    "300": HexColor.annotateKey({ description: "Hover and separator surface." }),
    "400": HexColor.annotateKey({ description: "Strongest surface; scrollbar thumb hover." }),
  },
  $I.annote("SurfaceScale", { description: "Six-stop surface scale keyed by SurfaceStep." })
) {}

/**
 * Foreground text colors at three emphasis levels.
 *
 * **Example** (Read muted text color)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.dark.foreground.muted)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Foreground extends S.Class<Foreground>($I`Foreground`)(
  {
    base: HexColor.annotateKey({ description: "Primary text color." }),
    muted: HexColor.annotateKey({ description: "Secondary text color." }),
    subtle: HexColor.annotateKey({ description: "Tertiary text color for hints and metadata." }),
  },
  $I.annote("Foreground", { description: "Foreground text colors at three emphasis levels." })
) {}

/**
 * Border colors at rest and on hover.
 *
 * **Example** (Read the resting border)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.dark.border.base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Border extends S.Class<Border>($I`Border`)(
  {
    base: HexColor.annotateKey({ description: "Resting border color." }),
    hover: HexColor.annotateKey({ description: "Border color on hover." }),
  },
  $I.annote("Border", { description: "Border colors at rest and on hover." })
) {}

/**
 * Semantic status colors.
 *
 * **Example** (Read the error color)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.dark.semantic.error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Semantic extends S.Class<Semantic>($I`Semantic`)(
  {
    success: HexColor.annotateKey({ description: "Success status color." }),
    warning: HexColor.annotateKey({ description: "Warning status color." }),
    error: HexColor.annotateKey({ description: "Error status color." }),
  },
  $I.annote("Semantic", { description: "Semantic status colors." })
) {}

/**
 * Opacity in the closed unit interval.
 *
 * **Example** (Construct an alpha)
 *
 * ```ts
 * import { Alpha } from "@beep/brand"
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
 * import { Alpha } from "@beep/brand"
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
 * import { Alpha, GlowStop } from "@beep/brand"
 *
 * console.log(GlowStop.make({ step: "500", alpha: Alpha.make(0.35) }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GlowStop extends S.Class<GlowStop>($I`GlowStop`)(
  {
    step: ScaleStep.annotateKey({ description: "Brand scale step the glow samples." }),
    alpha: Alpha.annotateKey({ description: "Opacity of the sampled step." }),
  },
  $I.annote("GlowStop", { description: "A brand scale step at an opacity." })
) {}

/**
 * Radial glow layer with a bright start stop and a dimmer mid stop.
 *
 * **Example** (Read the primary glow start)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.dark.glow.primary.start.step)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GlowLayer extends S.Class<GlowLayer>($I`GlowLayer`)(
  {
    start: GlowStop.annotateKey({ description: "Center stop of the radial glow." }),
    mid: GlowStop.annotateKey({ description: "Mid-radius stop before the glow fades to transparent." }),
  },
  $I.annote("GlowLayer", { description: "Radial glow layer with start and mid stops." })
) {}

/**
 * The three ambient glow layers used behind graph and orb visuals.
 *
 * **Example** (Read the tertiary glow)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.dark.glow.tertiary.mid.alpha)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Glow extends S.Class<Glow>($I`Glow`)(
  {
    primary: GlowLayer.annotateKey({ description: "Dominant glow layer." }),
    secondary: GlowLayer.annotateKey({ description: "Second glow layer, drifting against the primary." }),
    tertiary: GlowLayer.annotateKey({ description: "Deep background glow layer." }),
  },
  $I.annote("Glow", { description: "The three ambient glow layers." })
) {}

/**
 * A complete color scheme for one appearance (light or dark).
 *
 * **Example** (Read the light scheme border)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.light.border.hover)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ColorScheme extends S.Class<ColorScheme>($I`ColorScheme`)(
  {
    brand: ColorScale.annotateKey({ description: "Brand hue scale for this scheme." }),
    surface: SurfaceScale.annotateKey({ description: "Background surfaces for this scheme." }),
    foreground: Foreground.annotateKey({ description: "Text colors for this scheme." }),
    border: Border.annotateKey({ description: "Border colors for this scheme." }),
    semantic: Semantic.annotateKey({ description: "Status colors for this scheme." }),
    glow: Glow.annotateKey({ description: "Ambient glow layers for this scheme." }),
  },
  $I.annote("ColorScheme", { description: "A complete color scheme for one appearance." })
) {}

/**
 * Appearance name of a color scheme.
 *
 * **Example** (Guard a scheme name)
 *
 * ```ts
 * import { SchemeName } from "@beep/brand"
 *
 * console.log(SchemeName.is.dark("dark"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemeName = LiteralKit(["light", "dark"]).annotate(
  $I.annote("SchemeName", { description: "Appearance name of a color scheme." })
);

/**
 * Decoded {@link SchemeName} literal.
 *
 * **Example** (Annotate a scheme name)
 *
 * ```ts
 * import type { SchemeName } from "@beep/brand"
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
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.typography.sans.family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FontStack extends S.Class<FontStack>($I`FontStack`)(
  {
    family: S.NonEmptyString.annotateKey({ description: "Preferred font family name." }),
    fallbacks: S.Array(S.NonEmptyString).annotateKey({
      description: "Ordered fallback families and generic keywords.",
    }),
  },
  $I.annote("FontStack", { description: "A font family with its ordered fallbacks." })
) {}

/**
 * Brand typography: the sans and mono stacks.
 *
 * **Example** (Read the mono family)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.typography.mono.family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Typography extends S.Class<Typography>($I`Typography`)(
  {
    sans: FontStack.annotateKey({ description: "Body and UI text stack." }),
    mono: FontStack.annotateKey({ description: "Code and data stack." }),
  },
  $I.annote("Typography", { description: "Brand typography: sans and mono stacks." })
) {}

/**
 * SVG path data beginning with a move-to command.
 *
 * **Example** (Construct path data)
 *
 * ```ts
 * import { SvgPathData } from "@beep/brand"
 *
 * console.log(SvgPathData.make("M6 20l6.5 -9"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SvgPathData = S.String.check(
  S.isPattern(svgPathDataPattern, {
    identifier: $I`SvgPathDataPatternCheck`,
    title: "SVG Path Data",
    description: "SVG path data beginning with a move-to command.",
    message: "SVG path data must begin with M or m",
  })
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
 * import { SvgPathData } from "@beep/brand"
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
 * import { MarkPoint } from "@beep/brand"
 *
 * console.log(MarkPoint.make({ x: 5.4, y: 9.5 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkPoint extends S.Class<MarkPoint>($I`MarkPoint`)(
  {
    x: S.Finite.annotateKey({ description: "Horizontal coordinate in mark user units." }),
    y: S.Finite.annotateKey({ description: "Vertical coordinate in mark user units." }),
  },
  $I.annote("MarkPoint", { description: "A point in mark user units." })
) {}

/**
 * A rotation in degrees about an origin.
 *
 * **Example** (Construct a rotation)
 *
 * ```ts
 * import { MarkPoint, MarkRotation } from "@beep/brand"
 *
 * console.log(MarkRotation.make({ degrees: 8, origin: MarkPoint.make({ x: 12.5, y: 2.5 }) }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkRotation extends S.Class<MarkRotation>($I`MarkRotation`)(
  {
    degrees: S.Finite.annotateKey({ description: "Clockwise rotation in degrees." }),
    origin: MarkPoint.annotateKey({ description: "Rotation origin in the rotated group's own units." }),
  },
  $I.annote("MarkRotation", { description: "A rotation in degrees about an origin." })
) {}

/**
 * The tilted pixel glasses worn by the lambda: placement transform plus frame and lens paths.
 *
 * **Example** (Count the lenses)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.mark.glasses.lenses.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PixelGlasses extends S.Class<PixelGlasses>($I`PixelGlasses`)(
  {
    translate: MarkPoint.annotateKey({ description: "Placement offset in mark user units." }),
    scale: S.Finite.annotateKey({ description: "Uniform scale from glasses pixels to mark user units." }),
    rotation: MarkRotation.annotateKey({ description: "Tilt applied after scaling." }),
    frame: SvgPathData.annotateKey({ description: "Filled frame outline path in glasses pixels." }),
    lenses: S.Array(SvgPathData).annotateKey({ description: "Filled lens paths in glasses pixels." }),
  },
  $I.annote("PixelGlasses", { description: "Tilted pixel glasses: placement transform plus frame and lens paths." })
) {}

/**
 * Geometry of the beep mark: stroked lambda paths plus the pixel glasses, on a square view box.
 *
 * **Example** (Read the view box size)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.mark.viewBox)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BrandMark extends S.Class<BrandMark>($I`BrandMark`)(
  {
    name: S.NonEmptyString.annotateKey({ description: "Accessible name of the mark." }),
    viewBox: S.Finite.check(S.isGreaterThan(0)).annotateKey({
      description: "Side length of the square view box in user units.",
    }),
    strokes: S.Array(SvgPathData).annotateKey({ description: "Stroked lambda paths." }),
    strokeWidth: S.Finite.check(S.isGreaterThan(0)).annotateKey({
      description: "Stroke width of the lambda paths in user units.",
    }),
    glasses: PixelGlasses.annotateKey({ description: "The pixel glasses overlay." }),
  },
  $I.annote("BrandMark", { description: "Geometry of the beep mark on a square view box." })
) {}

/**
 * The whole brand identity: both color schemes, typography, and the mark.
 *
 * **Example** (Read the brand name)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BrandIdentity extends S.Class<BrandIdentity>($I`BrandIdentity`)(
  {
    name: S.NonEmptyString.annotateKey({ description: "Brand name as rendered in wordmarks." }),
    light: ColorScheme.annotateKey({ description: "Light appearance scheme." }),
    dark: ColorScheme.annotateKey({ description: "Dark appearance scheme." }),
    typography: Typography.annotateKey({ description: "Font stacks." }),
    mark: BrandMark.annotateKey({ description: "Mark geometry." }),
  },
  $I.annote("BrandIdentity", { description: "The whole brand identity: color schemes, typography, and the mark." })
) {}

/**
 * SVG paint for a stroke: a hex color or the inherited `currentColor`.
 *
 * **Example** (Inherit the text color)
 *
 * ```ts
 * import { SvgPaint } from "@beep/brand"
 *
 * console.log(SvgPaint.is("currentColor"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SvgPaint = S.Union([HexColor, S.Literal("currentColor")]).pipe(
  $I.annoteSchema("SvgPaint", { description: "A hex color or the inherited currentColor keyword." }),
  SchemaUtils.withStatics((self) => ({ is: S.is(self) }))
);

/**
 * Decoded {@link SvgPaint} value.
 *
 * **Example** (Annotate a paint)
 *
 * ```ts
 * import type { SvgPaint } from "@beep/brand"
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
 * import { beep, MarkPaint } from "@beep/brand"
 *
 * const paint = MarkPaint.make({ stroke: "currentColor", frame: beep.dark.foreground.base, lens: beep.dark.surface["0"] })
 * console.log(paint.frame)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkPaint extends S.Class<MarkPaint>($I`MarkPaint`)(
  {
    stroke: SvgPaint.annotateKey({ description: "Lambda stroke paint." }),
    frame: HexColor.annotateKey({ description: "Glasses frame fill." }),
    lens: HexColor.annotateKey({ description: "Glasses lens fill." }),
  },
  $I.annote("MarkPaint", { description: "Colors for the mark's stroke, frame, and lenses." })
) {}

/**
 * Optional rounded ground rectangle behind the mark (favicons and app icons).
 *
 * **Example** (Ground the mark on brand-900)
 *
 * ```ts
 * import { beep, MarkGround } from "@beep/brand"
 *
 * console.log(MarkGround.make({ fill: beep.dark.brand["900"], radius: 6 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkGround extends S.Class<MarkGround>($I`MarkGround`)(
  {
    fill: HexColor.annotateKey({ description: "Ground rectangle fill." }),
    radius: S.Finite.check(S.isGreaterThanOrEqualTo(0)).annotateKey({
      description: "Corner radius in output user units.",
    }),
  },
  $I.annote("MarkGround", { description: "Rounded ground rectangle behind the mark." })
) {}

/**
 * Request to render the mark as a standalone SVG document.
 *
 * **Example** (Render request for the 24-unit mark)
 *
 * ```ts
 * import { beep, MarkPaint, MarkSvgRequest } from "@beep/brand"
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
export class MarkSvgRequest extends S.Class<MarkSvgRequest>($I`MarkSvgRequest`)(
  {
    mark: BrandMark.annotateKey({ description: "Mark geometry to render." }),
    size: S.Finite.check(S.isGreaterThan(0)).annotateKey({
      description: "Output view box side length; the mark scales to fill it.",
    }),
    paint: MarkPaint.annotateKey({ description: "Colors for the mark." }),
    ground: S.OptionFromOptionalKey(MarkGround)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Optional ground rectangle behind the mark." }),
  },
  $I.annote("MarkSvgRequest", { description: "Request to render the mark as a standalone SVG document." })
) {}

/**
 * Request to render the mark beside the brand name as a wordmark SVG.
 *
 * **Example** (Wordmark request for dark surfaces)
 *
 * ```ts
 * import { beep, MarkPaint, WordmarkSvgRequest } from "@beep/brand"
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
export class WordmarkSvgRequest extends S.Class<WordmarkSvgRequest>($I`WordmarkSvgRequest`)(
  {
    identity: BrandIdentity.annotateKey({ description: "Identity supplying the mark, name, and sans stack." }),
    paint: MarkPaint.annotateKey({ description: "Colors for the mark." }),
    textFill: HexColor.annotateKey({ description: "Fill for the brand name text." }),
  },
  $I.annote("WordmarkSvgRequest", { description: "Request to render the mark beside the brand name." })
) {}
