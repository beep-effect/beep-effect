/**
 * RGB color schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { $I } from "./Color.shared.ts";

const RgbChannelRangeCheck = S.isBetween(
  {
    minimum: 0,
    maximum: 1,
  },
  {
    identifier: $I`RgbChannelRangeCheck`,
    title: "RGB Channel Range",
    description: "An RGB color channel normalized to the range 0 through 1.",
    message: "RGB channels must be between 0 and 1",
  }
);

/**
 * Branded finite RGB input channel.
 *
 * **Example** (Decode finite channel value)
 *
 * ```ts
 * import { RgbInputChannel } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const channel = S.decodeUnknownSync(RgbInputChannel)(1.25)
 * console.log(channel)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const RgbInputChannel = S.Finite.pipe(
  S.brand("RgbInputChannel"),
  $I.annoteSchema("RgbInputChannel", {
    description: "A finite RGB channel value before clamping or normalization.",
  })
);

/**
 * Type for {@link RgbInputChannel}.
 *
 * **Example** (Type decoded channel value)
 *
 * ```ts
 * import { RgbInputChannel } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const value: RgbInputChannel = S.decodeUnknownSync(RgbInputChannel)(1.25)
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RgbInputChannel = typeof RgbInputChannel.Type;

/**
 * Branded normalized RGB channel in the range 0 through 1.
 *
 * **Example** (Decode normalized channel value)
 *
 * ```ts
 * import { RgbChannel } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const channel = S.decodeUnknownSync(RgbChannel)(0.5)
 * console.log(channel)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const RgbChannel = RgbInputChannel.pipe(
  S.check(RgbChannelRangeCheck),
  S.brand("RgbChannel"),
  $I.annoteSchema("RgbChannel", {
    description: "A normalized RGB channel value in the range 0 through 1.",
  })
);

/**
 * Type for {@link RgbChannel}.
 *
 * **Example** (Type normalized channel value)
 *
 * ```ts
 * import { RgbChannel } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const value: RgbChannel = S.decodeUnknownSync(RgbChannel)(0.5)
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RgbChannel = typeof RgbChannel.Type;

/**
 * RGB object with finite channel inputs.
 *
 * **Example** (Decode RGB input object)
 *
 * ```ts
 * import { RgbInput } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const color = S.decodeUnknownSync(RgbInput)({ r: 1.2, g: 0.5, b: -0.1 })
 * console.log(color.r)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class RgbInput extends S.Class<RgbInput>($I`RgbInput`)(
  {
    r: RgbInputChannel.annotateKey({ description: "Red input channel." }),
    g: RgbInputChannel.annotateKey({ description: "Green input channel." }),
    b: RgbInputChannel.annotateKey({ description: "Blue input channel." }),
  },
  $I.annote("RgbInput", {
    description: "An RGB color object with finite input channels.",
  })
) {}

/**
 * RGB object with normalized channels.
 *
 * **Example** (Decode normalized RGB object)
 *
 * ```ts
 * import { Rgb } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const color = S.decodeUnknownSync(Rgb)({ r: 0.23, g: 0.51, b: 0.96 })
 * console.log(color.g)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class Rgb extends S.Class<Rgb>($I`Rgb`)(
  {
    r: RgbChannel.annotateKey({ description: "Normalized red channel." }),
    g: RgbChannel.annotateKey({ description: "Normalized green channel." }),
    b: RgbChannel.annotateKey({ description: "Normalized blue channel." }),
  },
  $I.annote("Rgb", {
    description: "A normalized RGB color object.",
  })
) {}
