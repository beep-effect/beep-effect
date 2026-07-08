/**
 * Color scale schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, thunk0, thunk1 } from "@beep/utils";
import { Number as Num, Result, SchemaGetter } from "effect";
import * as Bool from "effect/Boolean";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { HexColor, hexToRgbValue, NormalizeHexColor, rgbToHexValue } from "./Color.hex.ts";
import { $I, schemaIssueToError } from "./Color.shared.ts";
import { hexToOklchValue, oklchToHexValue } from "./Color.transforms.ts";

const HexColorScale12Checks = S.makeFilterGroup(
  [
    S.isLengthBetween(12, 12, {
      identifier: $I`HexColorScale12LengthCheck`,
      title: "Hex Color Scale Length",
      description: "A hex color scale containing exactly 12 entries.",
      message: "Hex color scales must contain exactly 12 colors",
    }),
  ],
  {
    identifier: $I`HexColorScale12Checks`,
    title: "Hex Color Scale",
    description: "Checks for fixed-size 12-step hex color scales.",
  }
);

const darkScaleLightSteps = [0.15, 0.18, 0.22, 0.26, 0.32, 0.38, 0.46, 0.56] as const;
const darkScaleChromaMultipliers = () => [0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1, 1, 0.9, 0.6] as const;
const lightScaleLightSteps = [0.99, 0.97, 0.94, 0.9, 0.85, 0.79, 0.72, 0.64] as const;
const lightScaleChromaMultipliers = () => [0.1, 0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1, 1, 0.95, 0.85] as const;

const darkNeutralScaleLightSteps = () =>
  [0.13, 0.16, 0.2, 0.24, 0.28, 0.33, 0.4, 0.52, 0.58, 0.66, 0.82, 0.96] as const;
const lightNeutralScaleLightSteps = () =>
  [0.995, 0.98, 0.96, 0.94, 0.91, 0.88, 0.84, 0.78, 0.62, 0.56, 0.46, 0.2] as const;

const darkAlphaSteps = () => [0.02, 0.04, 0.08, 0.12, 0.16, 0.2, 0.26, 0.36, 0.44, 0.52, 0.76, 0.96] as const;
const lightAlphaSteps = () => [0.01, 0.03, 0.06, 0.09, 0.12, 0.15, 0.2, 0.28, 0.48, 0.56, 0.64, 0.88] as const;

const generateScaleValues = ({ seed, isDark }: GenerateScaleInput): HexColorScale12 => {
  const base = hexToOklchValue(seed);
  const lightSteps = Bool.match(isDark, {
    onTrue: () => [...darkScaleLightSteps, base.l, base.l - 0.05, 0.75, 0.93],
    onFalse: () => [...lightScaleLightSteps, base.l, base.l + 0.05, 0.45, 0.25],
  });
  const chromaMultipliers = Bool.match(isDark, {
    onTrue: darkScaleChromaMultipliers,
    onFalse: lightScaleChromaMultipliers,
  });

  return Result.getOrThrowWith(
    HexColorScale12.decodeResult(
      A.zipWith(lightSteps, chromaMultipliers, (lightness, multiplier) =>
        oklchToHexValue({
          l: lightness,
          c: base.c * multiplier,
          h: base.h,
        })
      )
    ),
    schemaIssueToError
  );
};

const generateNeutralScaleValues = ({ seed, isDark }: GenerateNeutralScaleInput): HexColorScale12 => {
  const base = hexToOklchValue(seed);
  const neutralChroma = Num.min(base.c, 0.02);
  const lightSteps = Bool.match(isDark, {
    onTrue: darkNeutralScaleLightSteps,
    onFalse: lightNeutralScaleLightSteps,
  });

  return Result.getOrThrowWith(
    HexColorScale12.decodeResult(
      A.map(lightSteps, (lightness) =>
        oklchToHexValue({
          l: lightness,
          c: neutralChroma,
          h: base.h,
        })
      )
    ),
    schemaIssueToError
  );
};

const generateAlphaScaleValues = ({ scale, isDark }: GenerateAlphaScaleInput): HexColorScale12 => {
  const alphas = Bool.match(isDark, {
    onTrue: darkAlphaSteps,
    onFalse: lightAlphaSteps,
  });
  const background = Bool.match(isDark, {
    onTrue: thunk0,
    onFalse: thunk1,
  });

  return Result.getOrThrowWith(
    HexColorScale12.decodeResult(
      A.zipWith(scale, alphas, (hex, alpha) => {
        const { r, g, b } = hexToRgbValue(hex);

        return rgbToHexValue({
          r: r * alpha + background * (1 - alpha),
          g: g * alpha + background * (1 - alpha),
          b: b * alpha + background * (1 - alpha),
        });
      })
    ),
    schemaIssueToError
  );
};

/**
 * Fixed-size 12-step canonical hex color scale.
 *
 * @example
 * ```ts
 * import { HexColorScale12 } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const scale = S.decodeUnknownSync(HexColorScale12)([
 *   "#020617", "#0f172a", "#1e293b", "#334155",
 *   "#475569", "#64748b", "#94a3b8", "#cbd5e1",
 *   "#e2e8f0", "#f1f5f9", "#f8fafc", "#ffffff"
 * ])
 *
 * console.log(scale.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const HexColorScale12 = S.Array(HexColor)
  .check(HexColorScale12Checks)
  .pipe(
    S.brand("HexColorScale12"),
    $I.annoteSchema("HexColorScale12", {
      description: "A fixed-size 12-step scale of canonical hex colors.",
    }),
    SchemaUtils.withStatics((self) => ({
      decodeResult: S.decodeUnknownResult(self),
    }))
  );

/**
 * Type for {@link HexColorScale12}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HexColorScale12 } from "@beep/schema/Color"
 *
 * const value: HexColorScale12 = S.decodeUnknownSync(HexColorScale12)([
 *   "#020617", "#0f172a", "#1e293b", "#334155",
 *   "#475569", "#64748b", "#94a3b8", "#cbd5e1",
 *   "#e2e8f0", "#f1f5f9", "#f8fafc", "#ffffff"
 * ])
 *
 * console.log(value.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type HexColorScale12 = typeof HexColorScale12.Type;

const HexColorScale12Input = S.Array(NormalizeHexColor)
  .check(HexColorScale12Checks)
  .pipe(
    $I.annoteSchema("HexColorScale12Input", {
      description: "A 12-step hex color scale accepted at boundaries before canonical normalization.",
    })
  );

/**
 * Request schema for generating a chromatic 12-step scale.
 *
 * @example
 * ```ts
 * import { GenerateScaleInput } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(GenerateScaleInput)({ seed: "#3b82f6", isDark: true })
 * console.log(input.seed)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export class GenerateScaleInput extends S.Class<GenerateScaleInput>($I`GenerateScaleInput`)(
  {
    seed: NormalizeHexColor.annotateKey({ description: "Seed color for the generated scale." }),
    isDark: S.Boolean.annotateKey({ description: "Whether to generate the dark variant scale." }),
  },
  $I.annote("GenerateScaleInput", {
    description: "Input payload for generating a 12-step chromatic color scale.",
  })
) {}

/**
 * One-way schema for generating a chromatic 12-step scale.
 *
 * @example
 * ```ts
 * import { GenerateScale } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const scale = S.decodeUnknownSync(GenerateScale)({ seed: "#3b82f6", isDark: false })
 * console.log(scale.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const GenerateScale = GenerateScaleInput.pipe(
  S.decodeTo(HexColorScale12, {
    decode: SchemaGetter.transform(generateScaleValues),
    encode: SchemaGetter.forbidden(
      () => "Encoding GenerateScale results back to the original request is not supported"
    ),
  }),
  $I.annoteSchema("GenerateScale", {
    description: "Generates a 12-step chromatic scale from a seed hex color.",
  })
);

/**
 * Type for {@link GenerateScale}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { GenerateScale } from "@beep/schema/Color"
 *
 * const value: GenerateScale = S.decodeUnknownSync(GenerateScale)({ seed: "#3b82f6", isDark: false })
 * console.log(value.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type GenerateScale = typeof GenerateScale.Type;

/**
 * Request schema for generating a neutral 12-step scale.
 *
 * @example
 * ```ts
 * import { GenerateNeutralScaleInput } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(GenerateNeutralScaleInput)({ seed: "#64748b", isDark: false })
 * console.log(input.isDark)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export class GenerateNeutralScaleInput extends S.Class<GenerateNeutralScaleInput>($I`GenerateNeutralScaleInput`)(
  {
    seed: NormalizeHexColor.annotateKey({ description: "Seed color for the neutral scale." }),
    isDark: S.Boolean.annotateKey({ description: "Whether to generate the dark neutral variant." }),
  },
  $I.annote("GenerateNeutralScaleInput", {
    description: "Input payload for generating a 12-step neutral color scale.",
  })
) {}

/**
 * One-way schema for generating a neutral 12-step scale.
 *
 * @example
 * ```ts
 * import { GenerateNeutralScale } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const scale = S.decodeUnknownSync(GenerateNeutralScale)({ seed: "#64748b", isDark: true })
 * console.log(scale.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const GenerateNeutralScale = GenerateNeutralScaleInput.pipe(
  S.decodeTo(HexColorScale12, {
    decode: SchemaGetter.transform(generateNeutralScaleValues),
    encode: SchemaGetter.forbidden(
      () => "Encoding GenerateNeutralScale results back to the original request is not supported"
    ),
  }),
  $I.annoteSchema("GenerateNeutralScale", {
    description: "Generates a 12-step neutral scale from a seed hex color.",
  })
);

/**
 * Type for {@link GenerateNeutralScale}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { GenerateNeutralScale } from "@beep/schema/Color"
 *
 * const value: GenerateNeutralScale = S.decodeUnknownSync(GenerateNeutralScale)({ seed: "#64748b", isDark: true })
 * console.log(value.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type GenerateNeutralScale = typeof GenerateNeutralScale.Type;

/**
 * Request schema for generating an alpha-blended 12-step scale.
 *
 * @example
 * ```ts
 * import { GenerateAlphaScaleInput } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(GenerateAlphaScaleInput)({
 *   scale: [
 *     "#020617", "#0f172a", "#1e293b", "#334155",
 *     "#475569", "#64748b", "#94a3b8", "#cbd5e1",
 *     "#e2e8f0", "#f1f5f9", "#f8fafc", "#ffffff"
 *   ],
 *   isDark: true
 * })
 *
 * console.log(input.scale.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export class GenerateAlphaScaleInput extends S.Class<GenerateAlphaScaleInput>($I`GenerateAlphaScaleInput`)(
  {
    scale: HexColorScale12Input.annotateKey({ description: "Base 12-step scale used for alpha blending." }),
    isDark: S.Boolean.annotateKey({ description: "Whether to blend against a dark background." }),
  },
  $I.annote("GenerateAlphaScaleInput", {
    description: "Input payload for generating a 12-step alpha-blended color scale.",
  })
) {}

/**
 * One-way schema for generating an alpha-blended 12-step scale.
 *
 * @example
 * ```ts
 * import { GenerateAlphaScale } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const alphaScale = S.decodeUnknownSync(GenerateAlphaScale)({
 *   scale: [
 *     "#020617", "#0f172a", "#1e293b", "#334155",
 *     "#475569", "#64748b", "#94a3b8", "#cbd5e1",
 *     "#e2e8f0", "#f1f5f9", "#f8fafc", "#ffffff"
 *   ],
 *   isDark: true
 * })
 *
 * console.log(alphaScale.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const GenerateAlphaScale = GenerateAlphaScaleInput.pipe(
  S.decodeTo(HexColorScale12, {
    decode: SchemaGetter.transform(generateAlphaScaleValues),
    encode: SchemaGetter.forbidden(
      () => "Encoding GenerateAlphaScale results back to the original request is not supported"
    ),
  }),
  $I.annoteSchema("GenerateAlphaScale", {
    description: "Generates a 12-step alpha-blended scale from a canonical 12-step base scale.",
  })
);

/**
 * Type for {@link GenerateAlphaScale}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { GenerateAlphaScale } from "@beep/schema/Color"
 *
 * const value: GenerateAlphaScale = S.decodeUnknownSync(GenerateAlphaScale)({
 *   scale: [
 *     "#020617", "#0f172a", "#1e293b", "#334155",
 *     "#475569", "#64748b", "#94a3b8", "#cbd5e1",
 *     "#e2e8f0", "#f1f5f9", "#f8fafc", "#ffffff"
 *   ],
 *   isDark: true
 * })
 *
 * console.log(value.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type GenerateAlphaScale = typeof GenerateAlphaScale.Type;
