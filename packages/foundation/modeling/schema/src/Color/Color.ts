/**
 * Branded color domains and transformation schemas for hex, RGB, and OKLCH.
 *
 * **Details**
 *
 * Prefer the canonical namespace import from `@beep/schema/Color`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Color adjustment schemas.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  ColorAmount,
  Darken,
  DarkenInput,
  Lighten,
  LightenInput,
  MixColors,
  MixColorsInput,
  RgbaColorString,
  WithAlpha,
  WithAlphaInput,
} from "./Color.adjust.ts";
/**
 * Hex color schemas.
 *
 * @category validation
 * @since 0.0.0
 */
export { HexColor, HexColorInput, NormalizeHexColor } from "./Color.hex.ts";
/**
 * OKLCH color schemas.
 *
 * @category validation
 * @since 0.0.0
 */
export { OklchChroma, OklchColor, OklchCoordinate, OklchHue, OklchInput, OklchLightness } from "./Color.oklch.ts";
/**
 * RGB color schemas.
 *
 * @category validation
 * @since 0.0.0
 */
export { Rgb, RgbChannel, RgbInput, RgbInputChannel } from "./Color.rgb.ts";
/**
 * Color scale schemas.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  GenerateAlphaScale,
  GenerateAlphaScaleInput,
  GenerateNeutralScale,
  GenerateNeutralScaleInput,
  GenerateScale,
  GenerateScaleInput,
  HexColorScale12,
} from "./Color.scale.ts";
/**
 * Color conversion schemas.
 *
 * @category validation
 * @since 0.0.0
 */
export { HexToOklch, HexToRgb, OklchToHex, OklchToRgb, RgbToHex, RgbToOklch } from "./Color.transforms.ts";
