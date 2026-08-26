/**
 * OKLCH color schemas and helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { $I } from "./Color.shared.ts";
import type { OklchEncoded, RgbEncoded } from "./Color.shared.ts";

const OklchLightnessRangeCheck = S.isBetween(
  {
    minimum: 0,
    maximum: 1,
  },
  {
    identifier: $I`OklchLightnessRangeCheck`,
    title: "OKLCH Lightness Range",
    description: "OKLCH lightness normalized to the range 0 through 1.",
    message: "OKLCH lightness must be between 0 and 1",
  }
);

const OklchChromaCheck = S.makeFilter((value: number) => value >= 0, {
  identifier: $I`OklchChromaCheck`,
  title: "OKLCH Chroma Non-Negative",
  description: "OKLCH chroma expressed as a non-negative finite number.",
  message: "OKLCH chroma must be greater than or equal to 0",
});

const OklchHueRangeCheck = S.isBetween(
  {
    minimum: 0,
    maximum: 360,
  },
  {
    identifier: $I`OklchHueRangeCheck`,
    title: "OKLCH Hue Range",
    description: "OKLCH hue in degrees from 0 through 360.",
    message: "OKLCH hue must be between 0 and 360",
  }
);

const linearToSrgb = (value: number): number => {
  if (value <= 0.0031308) {
    return value * 12.92;
  }

  return 1.055 * value ** (1 / 2.4) - 0.055;
};

const srgbToLinear = (value: number): number => {
  if (value <= 0.04045) {
    return value / 12.92;
  }

  return ((value + 0.055) / 1.055) ** 2.4;
};

/**
 * Convert normalized RGB channel values into OKLCH coordinates.
 *
 * **Example** (Convert RGB to OKLCH)
 *
 * ```ts
 * import { rgbToOklchValue } from "../../src/Color/Color.oklch.ts"
 *
 * const oklch = rgbToOklchValue({ r: 0.2, g: 0.4, b: 1 })
 * console.log(oklch.l)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const rgbToOklchValue = ({ r, g, b }: RgbEncoded): OklchEncoded => {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const lInput = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const mInput = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const sInput = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l = Math.cbrt(lInput);
  const m = Math.cbrt(mInput);
  const s = Math.cbrt(sInput);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bValue = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.sqrt(a * a + bValue * bValue);
  const rawHue = Math.atan2(bValue, a) * (180 / Math.PI);
  const hue = rawHue < 0 ? rawHue + 360 : rawHue;

  return {
    l: lightness,
    c: chroma,
    h: hue,
  };
};

/**
 * Convert OKLCH coordinates into RGB channel values.
 *
 * **Example** (Convert OKLCH to RGB)
 *
 * ```ts
 * import { oklchToRgbValue } from "../../src/Color/Color.oklch.ts"
 *
 * const rgb = oklchToRgbValue({ l: 0.72, c: 0.12, h: 240 })
 * console.log(rgb.r)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const oklchToRgbValue = ({ l: lightness, c: chroma, h: hue }: OklchEncoded): RgbEncoded => {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const bValue = chroma * Math.sin((hue * Math.PI) / 180);

  const l = lightness + 0.3963377774 * a + 0.2158037573 * bValue;
  const m = lightness - 0.1055613458 * a - 0.0638541728 * bValue;
  const s = lightness - 0.0894841775 * a - 1.291485548 * bValue;

  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;

  const lr = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const lg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const lb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
  };
};

/**
 * Branded finite OKLCH coordinate.
 *
 * **Example** (Decode OKLCH coordinate)
 *
 * ```ts import.meta.vitest name="Decode OKLCH coordinate"
 * import { OklchCoordinate } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const coordinate = S.decodeUnknownSync(OklchCoordinate)(0.42)
 * console.log(coordinate)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const OklchCoordinate = S.Finite.pipe(
  S.brand("OklchCoordinate"),
  $I.annoteSchema("OklchCoordinate", {
    description: "A finite OKLCH coordinate component.",
  })
);

/**
 * Type for {@link OklchCoordinate}.
 *
 * **Example** (Type annotated coordinate)
 *
 * ```ts import.meta.vitest name="Type annotated coordinate"
 * import * as S from "effect/Schema"
 * import { OklchCoordinate } from "@beep/schema/Color"
 *
 * const value: OklchCoordinate = S.decodeUnknownSync(OklchCoordinate)(0.42)
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OklchCoordinate = typeof OklchCoordinate.Type;

/**
 * Canonical OKLCH lightness component.
 *
 * **Example** (Decode OKLCH lightness)
 *
 * ```ts import.meta.vitest name="Decode OKLCH lightness"
 * import { OklchLightness } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const lightness = S.decodeUnknownSync(OklchLightness)(0.72)
 * console.log(lightness)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const OklchLightness = OklchCoordinate.pipe(
  S.check(OklchLightnessRangeCheck),
  S.brand("OklchLightness"),
  $I.annoteSchema("OklchLightness", {
    description: "OKLCH lightness normalized to the range 0 through 1.",
  })
);

/**
 * Type for {@link OklchLightness}.
 *
 * **Example** (Type annotated lightness)
 *
 * ```ts import.meta.vitest name="Type annotated lightness"
 * import * as S from "effect/Schema"
 * import { OklchLightness } from "@beep/schema/Color"
 *
 * const value: OklchLightness = S.decodeUnknownSync(OklchLightness)(0.72)
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OklchLightness = typeof OklchLightness.Type;

/**
 * Canonical OKLCH chroma component.
 *
 * **Example** (Decode OKLCH chroma)
 *
 * ```ts import.meta.vitest name="Decode OKLCH chroma"
 * import { OklchChroma } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const chroma = S.decodeUnknownSync(OklchChroma)(0.12)
 * console.log(chroma)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const OklchChroma = OklchCoordinate.pipe(
  S.check(OklchChromaCheck),
  S.brand("OklchChroma"),
  $I.annoteSchema("OklchChroma", {
    description: "A non-negative OKLCH chroma value.",
  })
);

/**
 * Type for {@link OklchChroma}.
 *
 * **Example** (Type annotated chroma)
 *
 * ```ts import.meta.vitest name="Type annotated chroma"
 * import * as S from "effect/Schema"
 * import { OklchChroma } from "@beep/schema/Color"
 *
 * const value: OklchChroma = S.decodeUnknownSync(OklchChroma)(0.12)
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OklchChroma = typeof OklchChroma.Type;

/**
 * Canonical OKLCH hue component.
 *
 * **Example** (Decode OKLCH hue)
 *
 * ```ts import.meta.vitest name="Decode OKLCH hue"
 * import { OklchHue } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const hue = S.decodeUnknownSync(OklchHue)(240)
 * console.log(hue)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const OklchHue = OklchCoordinate.pipe(
  S.check(OklchHueRangeCheck),
  S.brand("OklchHue"),
  $I.annoteSchema("OklchHue", {
    description: "An OKLCH hue angle in degrees from 0 through 360.",
  })
);

/**
 * Type for {@link OklchHue}.
 *
 * **Example** (Type annotated hue)
 *
 * ```ts import.meta.vitest name="Type annotated hue"
 * import * as S from "effect/Schema"
 * import { OklchHue } from "@beep/schema/Color"
 *
 * const value: OklchHue = S.decodeUnknownSync(OklchHue)(240)
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OklchHue = typeof OklchHue.Type;

/**
 * OKLCH object with finite coordinates.
 *
 * **Example** (Decode OKLCH input object)
 *
 * ```ts import.meta.vitest name="Decode OKLCH input object"
 * import { OklchInput } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const color = S.decodeUnknownSync(OklchInput)({ l: 0.72, c: 0.12, h: 240 })
 * console.log(color.h)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class OklchInput extends S.Class<OklchInput>($I`OklchInput`)(
  {
    l: OklchCoordinate.annotateKey({ description: "Input lightness coordinate." }),
    c: OklchCoordinate.annotateKey({ description: "Input chroma coordinate." }),
    h: OklchCoordinate.annotateKey({ description: "Input hue coordinate." }),
  },
  $I.annote("OklchInput", {
    description: "An OKLCH color object with finite coordinates used by transformation helpers.",
  })
) {}

/**
 * Canonical OKLCH color object.
 *
 * **Example** (Decode OKLCH color object)
 *
 * ```ts import.meta.vitest name="Decode OKLCH color object"
 * import { OklchColor } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const color = S.decodeUnknownSync(OklchColor)({ l: 0.72, c: 0.12, h: 240 })
 * console.log(color.l)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class OklchColor extends S.Class<OklchColor>($I`OklchColor`)(
  {
    l: OklchLightness.annotateKey({ description: "Lightness in the range 0 through 1." }),
    c: OklchChroma.annotateKey({ description: "Non-negative chroma." }),
    h: OklchHue.annotateKey({ description: "Hue in degrees from 0 through 360." }),
  },
  $I.annote("OklchColor", {
    description: "A canonical color in OKLCH space.",
  })
) {}
