/**
 * The beep brand identity constants, decoded through the schemas in `Brand.schema.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { HexColor } from "@beep/schema/Color";
import {
  Alpha,
  Border,
  BrandIdentity,
  BrandMark,
  ColorScale,
  ColorScheme,
  FontStack,
  Foreground,
  Glow,
  GlowLayer,
  GlowStop,
  MarkPoint,
  MarkRotation,
  PixelGlasses,
  Semantic,
  SurfaceScale,
  SvgPathData,
  Typography,
} from "./Brand.schema.ts";
import type { ScaleStep } from "./Brand.schema.ts";

const hex = (value: string): HexColor => HexColor.make(value);

const stop = (step: ScaleStep, alpha: number): GlowStop => GlowStop.make({ step, alpha: Alpha.make(alpha) });

const forestGreen = ColorScale.make({
  "50": hex("#eef5ee"),
  "100": hex("#d4e8d4"),
  "200": hex("#aed1ae"),
  "300": hex("#82b582"),
  "400": hex("#5c9a5c"),
  "500": hex("#3d7d3d"),
  "600": hex("#2d632d"),
  "700": hex("#214e21"),
  "800": hex("#1a3a1a"),
  "900": hex("#122812"),
});

// The light scheme darkens the two accent steps so green text and outlines keep
// contrast on white; every other step is shared with the dark scheme.
const forestGreenOnLight = ColorScale.make({ ...forestGreen, "300": hex("#2d632d"), "400": hex("#214e21") });

const dark = ColorScheme.make({
  brand: forestGreen,
  surface: SurfaceScale.make({
    "0": hex("#09090b"),
    "50": hex("#111113"),
    "100": hex("#18181b"),
    "200": hex("#27272a"),
    "300": hex("#3f3f46"),
    "400": hex("#52525b"),
  }),
  foreground: Foreground.make({ base: hex("#fafafa"), muted: hex("#a1a1aa"), subtle: hex("#71717a") }),
  border: Border.make({ base: hex("#27272a"), hover: hex("#3f3f46") }),
  semantic: Semantic.make({ success: hex("#22c55e"), warning: hex("#eab308"), error: hex("#ef4444") }),
  glow: Glow.make({
    primary: GlowLayer.make({ start: stop("500", 0.35), mid: stop("600", 0.15) }),
    secondary: GlowLayer.make({ start: stop("400", 0.28), mid: stop("500", 0.12) }),
    tertiary: GlowLayer.make({ start: stop("700", 0.3), mid: stop("800", 0.12) }),
  }),
});

const light = ColorScheme.make({
  brand: forestGreenOnLight,
  surface: SurfaceScale.make({
    "0": hex("#ffffff"),
    "50": hex("#fafafa"),
    "100": hex("#f4f4f5"),
    "200": hex("#e4e4e7"),
    "300": hex("#d4d4d8"),
    "400": hex("#a1a1aa"),
  }),
  foreground: Foreground.make({ base: hex("#18181b"), muted: hex("#52525b"), subtle: hex("#71717a") }),
  border: Border.make({ base: hex("#d4d4d8"), hover: hex("#a1a1aa") }),
  semantic: Semantic.make({ success: hex("#16a34a"), warning: hex("#854d0e"), error: hex("#b91c1c") }),
  glow: Glow.make({
    primary: GlowLayer.make({ start: stop("500", 0.28), mid: stop("400", 0.16) }),
    secondary: GlowLayer.make({ start: stop("600", 0.22), mid: stop("500", 0.12) }),
    tertiary: GlowLayer.make({ start: stop("700", 0.18), mid: stop("400", 0.1) }),
  }),
});

const typography = Typography.make({
  sans: FontStack.make({
    family: "Inter Variable",
    fallbacks: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
  }),
  mono: FontStack.make({
    family: "JetBrains Mono Variable",
    fallbacks: ["JetBrains Mono", "ui-monospace", "monospace"],
  }),
});

// A lambda wearing tilted pixel glasses, drawn on a 24-unit grid.
const mark = BrandMark.make({
  name: "beep",
  viewBox: 24,
  strokes: [SvgPathData.make("M6 20l6.5 -9"), SvgPathData.make("M19 20c-6 0 -6 -16 -12 -16")],
  strokeWidth: 2.25,
  glasses: PixelGlasses.make({
    translate: MarkPoint.make({ x: 5.4, y: 9.5 }),
    scale: 0.52,
    rotation: MarkRotation.make({ degrees: 8, origin: MarkPoint.make({ x: 12.5, y: 2.5 }) }),
    frame: SvgPathData.make("m0,0v2h1v1h1v1h1v1h7v-1h1v-1h1v-2h2v2h1v1h1v1h6v-1h1v-1h1v-1h1v-2z"),
    lenses: [
      SvgPathData.make("m2,1v1h4v2h1v-1h-2v-2h-1v3h1v-1h-2v-2z"),
      SvgPathData.make("m15,1v1h4v2h1v-1h-2v-2h-1v3h1v-1h-2v-2z"),
    ],
  }),
});

/**
 * The beep brand identity: forest-green scales on zinc surfaces, Inter and JetBrains Mono, and the lambda mark.
 *
 * **Example** (Read the theme-color ground)
 *
 * ```ts
 * import { beep } from "@beep/brand"
 *
 * console.log(beep.dark.brand["900"])
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const beep: BrandIdentity = BrandIdentity.make({ name: "beep", light, dark, typography, mark });
