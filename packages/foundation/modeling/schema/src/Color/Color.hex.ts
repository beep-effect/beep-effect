/**
 * Hex color schemas and helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { flow, identity, Number as Num, pipe, Result, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { $I, schemaIssueToError } from "./Color.shared.ts";
import type { RgbEncoded } from "./Color.shared.ts";

const hexColorInputPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const hexColorPattern = /^#[0-9a-f]{6}$/;

const HexColorInputChecks = S.makeFilterGroup(
  [
    S.isPattern(hexColorInputPattern, {
      identifier: $I`HexColorInputPatternCheck`,
      title: "Hex Color Input Pattern",
      description: "A hex color string in #rgb or #rrggbb format.",
      message: "Hex colors must look like #rgb or #rrggbb",
    }),
  ],
  {
    identifier: $I`HexColorInputChecks`,
    title: "Hex Color Input",
    description: "Checks for shorthand and canonical hex color inputs.",
  }
);

const HexColorChecks = S.makeFilterGroup(
  [
    S.isPattern(hexColorPattern, {
      identifier: $I`HexColorPatternCheck`,
      title: "Canonical Hex Color Pattern",
      description: "A lowercase six-digit hex color string in #rrggbb format.",
      message: "Hex colors must be canonical lowercase #rrggbb strings",
    }),
  ],
  {
    identifier: $I`HexColorChecks`,
    title: "Hex Color",
    description: "Checks for canonical lowercase six-digit hex colors.",
  }
);

const expandShortHex = (value: string): string =>
  value.length === 3 ? pipe(Str.split("")(value), A.map(Str.repeat(2)), A.join("")) : value;

const normalizeHexColorValue = flow(Str.substring(1), expandShortHex, Str.toLowerCase, (value) => `#${value}`);

const parseHexChannel = (hexBody: string, start: number): number =>
  globalThis.Number.parseInt(pipe(hexBody, Str.substring(start, start + 2)), 16) / 255;

/**
 * Decode a boundary hex color into normalized RGB channel values.
 *
 * **Example** (Decode hex to RGB)
 *
 * ```ts
 * import { hexToRgbValue } from "../../src/Color/Color.hex.ts"
 *
 * const rgb = hexToRgbValue("#3366ff")
 * console.log(rgb.r)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const hexToRgbValue = (hex: string): RgbEncoded => {
  const canonical = normalizeHexColorValue(hex);
  const body = pipe(canonical, Str.substring(1));

  return {
    r: parseHexChannel(body, 0),
    g: parseHexChannel(body, 2),
    b: parseHexChannel(body, 4),
  };
};

const toHexChannel = (value: number): string =>
  pipe(
    Num.clamp(value, {
      minimum: 0,
      maximum: 1,
    }),
    (channel) => Math.round(channel * 255).toString(16),
    Str.padStart(2, "0"),
    Str.toLowerCase
  );

/**
 * Encode RGB channel values into a canonical hex color.
 *
 * **Example** (Encode RGB to hex)
 *
 * ```ts
 * import { rgbToHexValue } from "../../src/Color/Color.hex.ts"
 *
 * const hex = rgbToHexValue({ r: 0.2, g: 0.4, b: 1 })
 * console.log(hex)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const rgbToHexValue = ({ r, g, b }: RgbEncoded): HexColor =>
  Result.getOrThrowWith(
    HexColor.decodeResult(`#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`),
    schemaIssueToError
  );

/**
 * Boundary schema for hex color input strings.
 *
 * **Example** (Decode short hex input)
 *
 * ```ts import.meta.vitest name="Decode short hex input"
 * import { HexColorInput } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(HexColorInput)("#3bf")
 * console.log(input)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HexColorInput = S.String.check(HexColorInputChecks).pipe(
  $I.annoteSchema("HexColorInput", {
    description: "A hex color string accepted at boundaries in #rgb or #rrggbb form.",
  })
);

/**
 * Type for {@link HexColorInput}.
 *
 * **Example** (Type annotated hex input)
 *
 * ```ts import.meta.vitest name="Type annotated hex input"
 * import * as S from "effect/Schema"
 * import { HexColorInput } from "@beep/schema/Color"
 *
 * const value: HexColorInput = S.decodeUnknownSync(HexColorInput)("#3bf")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HexColorInput = typeof HexColorInput.Type;

/**
 * Canonical lowercase six-digit hex color schema.
 *
 * **Example** (Decode canonical hex color)
 *
 * ```ts import.meta.vitest name="Decode canonical hex color"
 * import { HexColor } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const color = S.decodeUnknownSync(HexColor)("#33bbff")
 * console.log(color)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HexColor = S.String.check(HexColorChecks).pipe(
  S.brand("HexColor"),
  $I.annoteSchema("HexColor", {
    description: "A canonical lowercase six-digit hex color string.",
  }),
  SchemaUtils.withStatics((self) => ({
    decodeResult: S.decodeUnknownResult(self),
  }))
);

/**
 * Type for {@link HexColor}.
 *
 * **Example** (Type annotated hex color)
 *
 * ```ts import.meta.vitest name="Type annotated hex color"
 * import * as S from "effect/Schema"
 * import { HexColor } from "@beep/schema/Color"
 *
 * const value: HexColor = S.decodeUnknownSync(HexColor)("#33bbff")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HexColor = typeof HexColor.Type;

/**
 * Canonicalization schema from boundary hex input to canonical hex output.
 *
 * **Example** (Normalize short hex input)
 *
 * ```ts import.meta.vitest name="Normalize short hex input"
 * import { NormalizeHexColor } from "@beep/schema/Color"
 * import * as S from "effect/Schema"
 *
 * const color = S.decodeUnknownSync(NormalizeHexColor)("#3bf")
 * console.log(color)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NormalizeHexColor = HexColorInput.pipe(
  S.decodeTo(
    HexColor,
    SchemaTransformation.transform({
      decode: normalizeHexColorValue,
      encode: identity,
    })
  ),
  $I.annoteSchema("NormalizeHexColor", {
    description: "Normalizes #rgb or #rrggbb input into canonical lowercase #rrggbb hex.",
  })
);

/**
 * Type for {@link NormalizeHexColor}.
 *
 * **Example** (Type annotated normalized hex)
 *
 * ```ts import.meta.vitest name="Type annotated normalized hex"
 * import * as S from "effect/Schema"
 * import { NormalizeHexColor } from "@beep/schema/Color"
 *
 * const value: NormalizeHexColor = S.decodeUnknownSync(NormalizeHexColor)("#3bf")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NormalizeHexColor = typeof NormalizeHexColor.Type;
