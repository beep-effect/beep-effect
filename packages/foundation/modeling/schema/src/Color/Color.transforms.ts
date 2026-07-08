/**
 * Color conversion schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { flow, SchemaGetter, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import { HexColor, hexToRgbValue, NormalizeHexColor, rgbToHexValue } from "./Color.hex.ts";
import { OklchColor, OklchInput, oklchToRgbValue, rgbToOklchValue } from "./Color.oklch.ts";
import { Rgb, RgbInput } from "./Color.rgb.ts";
import { $I } from "./Color.shared.ts";

/**
 * Convert OKLCH coordinates into a canonical hex color.
 *
 * @example
 * ```ts
 * import { oklchToHexValue } from "../../src/Color/Color.transforms.ts"
 *
 * const hex = oklchToHexValue({ l: 0.72, c: 0.12, h: 240 })
 * console.log(hex)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const oklchToHexValue = flow(oklchToRgbValue, rgbToHexValue);
/**
 * Convert a boundary hex color into OKLCH coordinates.
 *
 * @example
 * ```ts
 * import { hexToOklchValue } from "../../src/Color/Color.transforms.ts"
 *
 * const oklch = hexToOklchValue("#3b82f6")
 * console.log(oklch.h)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const hexToOklchValue = flow(hexToRgbValue, rgbToOklchValue);

/**
 * Transformation schema for decoding boundary hex input into normalized RGB.
 *
 * @example
 * ```ts
 * import { HexToRgb } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const rgb = S.decodeUnknownSync(HexToRgb)("#3b82f6")
 * console.log(rgb.b)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const HexToRgb = NormalizeHexColor.pipe(
  S.decodeTo(
    Rgb,
    SchemaTransformation.transform({
      decode: hexToRgbValue,
      encode: rgbToHexValue,
    })
  ),
  $I.annoteSchema("HexToRgb", {
    description: "Decodes canonical or shorthand hex colors into normalized RGB values.",
  })
);

/**
 * Type for {@link HexToRgb}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HexToRgb } from "@beep/schema/Color"
 *
 * const value: HexToRgb = S.decodeUnknownSync(HexToRgb)("#3b82f6")
 * console.log(value.b)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type HexToRgb = typeof HexToRgb.Type;

/**
 * Transformation schema for encoding RGB input into canonical hex.
 *
 * @example
 * ```ts
 * import { RgbToHex } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const hex = S.decodeUnknownSync(RgbToHex)({ r: 0.23, g: 0.51, b: 0.96 })
 * console.log(hex)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const RgbToHex = RgbInput.pipe(
  S.decodeTo(HexColor, {
    decode: SchemaGetter.transform(rgbToHexValue),
    encode: SchemaGetter.forbidden(() => "Encoding RgbToHex results back to RGB is not supported"),
  }),
  $I.annoteSchema("RgbToHex", {
    description: "Encodes finite RGB input channels into canonical hex by clamping and rounding.",
  })
);

/**
 * Type for {@link RgbToHex}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RgbToHex } from "@beep/schema/Color"
 *
 * const value: RgbToHex = S.decodeUnknownSync(RgbToHex)({ r: 0.23, g: 0.51, b: 0.96 })
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type RgbToHex = typeof RgbToHex.Type;

/**
 * Transformation schema for decoding normalized RGB into canonical OKLCH.
 *
 * @example
 * ```ts
 * import { RgbToOklch } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const oklch = S.decodeUnknownSync(RgbToOklch)({ r: 0.23, g: 0.51, b: 0.96 })
 * console.log(oklch.h)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const RgbToOklch = Rgb.pipe(
  S.decodeTo(OklchColor, {
    decode: SchemaGetter.transform(rgbToOklchValue),
    encode: SchemaGetter.forbidden(() => "Encoding RgbToOklch results back to RGB is not supported"),
  }),
  $I.annoteSchema("RgbToOklch", {
    description: "Decodes normalized RGB values into canonical OKLCH coordinates.",
  })
);

/**
 * Type for {@link RgbToOklch}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RgbToOklch } from "@beep/schema/Color"
 *
 * const value: RgbToOklch = S.decodeUnknownSync(RgbToOklch)({ r: 0.23, g: 0.51, b: 0.96 })
 * console.log(value.h)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type RgbToOklch = typeof RgbToOklch.Type;

/**
 * Transformation schema for encoding OKLCH coordinates into RGB input values.
 *
 * @example
 * ```ts
 * import { OklchToRgb } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const rgb = S.decodeUnknownSync(OklchToRgb)({ l: 0.72, c: 0.12, h: 240 })
 * console.log(rgb.r)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const OklchToRgb = OklchInput.pipe(
  S.decodeTo(RgbInput, {
    decode: SchemaGetter.transform(oklchToRgbValue),
    encode: SchemaGetter.forbidden(() => "Encoding OklchToRgb results back to OKLCH is not supported"),
  }),
  $I.annoteSchema("OklchToRgb", {
    description: "Encodes finite OKLCH coordinates into finite RGB channel values.",
  })
);

/**
 * Type for {@link OklchToRgb}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { OklchToRgb } from "@beep/schema/Color"
 *
 * const value: OklchToRgb = S.decodeUnknownSync(OklchToRgb)({ l: 0.72, c: 0.12, h: 240 })
 * console.log(value.r)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type OklchToRgb = typeof OklchToRgb.Type;

/**
 * Transformation schema for decoding boundary hex input into canonical OKLCH.
 *
 * @example
 * ```ts
 * import { HexToOklch } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const color = S.decodeUnknownSync(HexToOklch)("#3b82f6")
 * console.log(color.c)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const HexToOklch = NormalizeHexColor.pipe(
  S.decodeTo(
    OklchColor,
    SchemaTransformation.transform({
      decode: hexToOklchValue,
      encode: oklchToHexValue,
    })
  ),
  $I.annoteSchema("HexToOklch", {
    description: "Decodes shorthand or canonical hex colors into canonical OKLCH coordinates.",
  })
);

/**
 * Type for {@link HexToOklch}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HexToOklch } from "@beep/schema/Color"
 *
 * const value: HexToOklch = S.decodeUnknownSync(HexToOklch)("#3b82f6")
 * console.log(value.c)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type HexToOklch = typeof HexToOklch.Type;

/**
 * Transformation schema for encoding OKLCH coordinates into canonical hex.
 *
 * @example
 * ```ts
 * import { OklchToHex } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const hex = S.decodeUnknownSync(OklchToHex)({ l: 0.72, c: 0.12, h: 240 })
 * console.log(hex)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const OklchToHex = OklchInput.pipe(
  S.decodeTo(HexColor, {
    decode: SchemaGetter.transform(oklchToHexValue),
    encode: SchemaGetter.forbidden(() => "Encoding OklchToHex results back to OKLCH is not supported"),
  }),
  $I.annoteSchema("OklchToHex", {
    description: "Encodes finite OKLCH coordinates into canonical hex colors.",
  })
);

/**
 * Type for {@link OklchToHex}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { OklchToHex } from "@beep/schema/Color"
 *
 * const value: OklchToHex = S.decodeUnknownSync(OklchToHex)({ l: 0.72, c: 0.12, h: 240 })
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type OklchToHex = typeof OklchToHex.Type;
