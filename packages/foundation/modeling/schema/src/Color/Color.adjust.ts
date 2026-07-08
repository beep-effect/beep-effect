/**
 * Color adjustment schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Number as Num, Result, SchemaGetter } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { HexColor, hexToRgbValue, NormalizeHexColor } from "./Color.hex.ts";
import { $I, schemaIssueToError } from "./Color.shared.ts";
import { hexToOklchValue, oklchToHexValue } from "./Color.transforms.ts";

const rgbaNumberPatternSource = "-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:e[+-]?\\d+)?";
const rgbaColorPattern = new RegExp(
  `^rgba\\((?:\\d|[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]), (?:\\d|[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]), (?:\\d|[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]), ${rgbaNumberPatternSource}\\)$`
);

const RgbaColorStringChecks = S.makeFilterGroup(
  [
    S.isPattern(rgbaColorPattern, {
      identifier: $I`RgbaColorStringPatternCheck`,
      title: "RGBA Color String Pattern",
      description: "A CSS rgba color string in the form rgba(r, g, b, a).",
      message: "RGBA colors must look like rgba(255, 255, 255, 1)",
    }),
  ],
  {
    identifier: $I`RgbaColorStringChecks`,
    title: "RGBA Color String",
    description: "Checks for CSS rgba color strings produced by with-alpha transformations.",
  }
);

const mixColorsValue = ({ color1, color2, amount }: MixColorsInput): HexColor => {
  const start = hexToOklchValue(color1);
  const end = hexToOklchValue(color2);

  return oklchToHexValue({
    l: start.l + (end.l - start.l) * amount,
    c: start.c + (end.c - start.c) * amount,
    h: start.h + (end.h - start.h) * amount,
  });
};

const lightenValue = ({ color, amount }: LightenInput): HexColor => {
  const value = hexToOklchValue(color);

  return oklchToHexValue({
    l: Num.min(value.l + amount, 1),
    c: value.c,
    h: value.h,
  });
};

const darkenValue = ({ color, amount }: DarkenInput): HexColor => {
  const value = hexToOklchValue(color);

  return oklchToHexValue({
    l: Num.max(value.l - amount, 0),
    c: value.c,
    h: value.h,
  });
};

const withAlphaValue = ({ color, alpha }: WithAlphaInput): RgbaColorString => {
  const { r, g, b } = hexToRgbValue(color);

  return Result.getOrThrowWith(
    RgbaColorString.decodeResult(
      `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
    ),
    schemaIssueToError
  );
};

/**
 * CSS rgba color string produced by with-alpha helpers.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RgbaColorString } from "@beep/schema/Color"
 *
 * console.log(S.decodeUnknownSync(RgbaColorString)("rgba(255, 255, 255, 1)"))
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const RgbaColorString = S.String.check(RgbaColorStringChecks).pipe(
  S.brand("RgbaColorString"),
  $I.annoteSchema("RgbaColorString", {
    description: "A CSS rgba color string in the form rgba(r, g, b, a).",
  }),
  SchemaUtils.withStatics((self) => ({
    decodeResult: S.decodeUnknownResult(self),
  }))
);

/**
 * Type for {@link RgbaColorString}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RgbaColorString } from "@beep/schema/Color"
 *
 * const value: RgbaColorString = S.decodeUnknownSync(RgbaColorString)("rgba(255, 255, 255, 1)")
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type RgbaColorString = typeof RgbaColorString.Type;

/**
 * Shared finite amount used by color helper request schemas.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ColorAmount } from "@beep/schema/Color"
 *
 * console.log(S.decodeUnknownSync(ColorAmount)(0.25))
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const ColorAmount = S.Finite.check(
  S.isBetween(
    { minimum: 0, maximum: 1 },
    {
      identifier: $I`ColorAmountRangeCheck`,
      title: "Color Amount Range",
      description: "A normalized color transformation amount from 0 through 1.",
      message: "Color amounts must be between 0 and 1",
    }
  )
).pipe(
  S.brand("ColorAmount"),
  $I.annoteSchema("ColorAmount", {
    description: "A normalized finite amount from 0 through 1 used by color transformation helpers.",
  })
);

/**
 * Type for {@link ColorAmount}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ColorAmount } from "@beep/schema/Color"
 *
 * const value: ColorAmount = S.decodeUnknownSync(ColorAmount)(0.25)
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ColorAmount = typeof ColorAmount.Type;

/**
 * Request schema for mixing two colors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { MixColorsInput } from "@beep/schema/Color"
 *
 * const input = S.decodeUnknownSync(MixColorsInput)({ color1: "#000000", color2: "#ffffff", amount: 0.5 })
 * console.log(input.amount)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export class MixColorsInput extends S.Class<MixColorsInput>($I`MixColorsInput`)(
  {
    color1: NormalizeHexColor.annotateKey({ description: "Start color." }),
    color2: NormalizeHexColor.annotateKey({ description: "End color." }),
    amount: ColorAmount.annotateKey({ description: "Interpolation amount." }),
  },
  $I.annote("MixColorsInput", {
    description: "Input payload for mixing two colors in OKLCH space.",
  })
) {}

/**
 * One-way schema for mixing two colors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { MixColors } from "@beep/schema/Color"
 *
 * const color = S.decodeUnknownSync(MixColors)({ color1: "#000000", color2: "#ffffff", amount: 0.5 })
 * console.log(color)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const MixColors = MixColorsInput.pipe(
  S.decodeTo(HexColor, {
    decode: SchemaGetter.transform(mixColorsValue),
    encode: SchemaGetter.forbidden(() => "Encoding MixColors results back to the original request is not supported"),
  }),
  $I.annoteSchema("MixColors", {
    description: "Mixes two hex colors in OKLCH space and returns a canonical hex color.",
  })
);

/**
 * Type for {@link MixColors}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { MixColors } from "@beep/schema/Color"
 *
 * const value: MixColors = S.decodeUnknownSync(MixColors)({ color1: "#000000", color2: "#ffffff", amount: 0.5 })
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type MixColors = typeof MixColors.Type;

/**
 * Request schema for lightening a color.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { LightenInput } from "@beep/schema/Color"
 *
 * const input = S.decodeUnknownSync(LightenInput)({ color: "#336699", amount: 0.1 })
 * console.log(input.color)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export class LightenInput extends S.Class<LightenInput>($I`LightenInput`)(
  {
    color: NormalizeHexColor.annotateKey({ description: "Source color." }),
    amount: ColorAmount.annotateKey({ description: "Lightness adjustment amount." }),
  },
  $I.annote("LightenInput", {
    description: "Input payload for lightening a color in OKLCH space.",
  })
) {}

/**
 * One-way schema for lightening a color.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Lighten } from "@beep/schema/Color"
 *
 * const color = S.decodeUnknownSync(Lighten)({ color: "#336699", amount: 0.1 })
 * console.log(color)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Lighten = LightenInput.pipe(
  S.decodeTo(HexColor, {
    decode: SchemaGetter.transform(lightenValue),
    encode: SchemaGetter.forbidden(() => "Encoding Lighten results back to the original request is not supported"),
  }),
  $I.annoteSchema("Lighten", {
    description: "Lightens a hex color in OKLCH space and returns a canonical hex color.",
  })
);

/**
 * Type for {@link Lighten}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Lighten } from "@beep/schema/Color"
 *
 * const value: Lighten = S.decodeUnknownSync(Lighten)({ color: "#336699", amount: 0.1 })
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Lighten = typeof Lighten.Type;

/**
 * Request schema for darkening a color.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DarkenInput } from "@beep/schema/Color"
 *
 * const input = S.decodeUnknownSync(DarkenInput)({ color: "#336699", amount: 0.1 })
 * console.log(input.amount)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export class DarkenInput extends S.Class<DarkenInput>($I`DarkenInput`)(
  {
    color: NormalizeHexColor.annotateKey({ description: "Source color." }),
    amount: ColorAmount.annotateKey({ description: "Lightness reduction amount." }),
  },
  $I.annote("DarkenInput", {
    description: "Input payload for darkening a color in OKLCH space.",
  })
) {}

/**
 * One-way schema for darkening a color.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Darken } from "@beep/schema/Color"
 *
 * const color = S.decodeUnknownSync(Darken)({ color: "#336699", amount: 0.1 })
 * console.log(color)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Darken = DarkenInput.pipe(
  S.decodeTo(HexColor, {
    decode: SchemaGetter.transform(darkenValue),
    encode: SchemaGetter.forbidden(() => "Encoding Darken results back to the original request is not supported"),
  }),
  $I.annoteSchema("Darken", {
    description: "Darkens a hex color in OKLCH space and returns a canonical hex color.",
  })
);

/**
 * Type for {@link Darken}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Darken } from "@beep/schema/Color"
 *
 * const value: Darken = S.decodeUnknownSync(Darken)({ color: "#336699", amount: 0.1 })
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Darken = typeof Darken.Type;

/**
 * Request schema for converting a color plus alpha to an rgba string.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WithAlphaInput } from "@beep/schema/Color"
 *
 * const input = S.decodeUnknownSync(WithAlphaInput)({ color: "#336699", alpha: 0.5 })
 * console.log(input.alpha)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export class WithAlphaInput extends S.Class<WithAlphaInput>($I`WithAlphaInput`)(
  {
    color: NormalizeHexColor.annotateKey({ description: "Source color." }),
    alpha: ColorAmount.annotateKey({ description: "Finite alpha value rendered into the rgba string." }),
  },
  $I.annote("WithAlphaInput", {
    description: "Input payload for rendering a hex color plus alpha as a CSS rgba string.",
  })
) {}

/**
 * One-way schema for rendering an rgba string.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WithAlpha } from "@beep/schema/Color"
 *
 * const rgba = S.decodeUnknownSync(WithAlpha)({ color: "#336699", alpha: 0.5 })
 * console.log(rgba)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const WithAlpha = WithAlphaInput.pipe(
  S.decodeTo(RgbaColorString, {
    decode: SchemaGetter.transform(withAlphaValue),
    encode: SchemaGetter.forbidden(() => "Encoding WithAlpha results back to the original request is not supported"),
  }),
  $I.annoteSchema("WithAlpha", {
    description: "Renders a canonical hex color plus alpha as a CSS rgba string.",
  })
);

/**
 * Type for {@link WithAlpha}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { WithAlpha } from "@beep/schema/Color"
 *
 * const value: WithAlpha = S.decodeUnknownSync(WithAlpha)({ color: "#336699", alpha: 0.5 })
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type WithAlpha = typeof WithAlpha.Type;
