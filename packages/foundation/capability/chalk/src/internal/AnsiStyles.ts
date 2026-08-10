/**
 * Internal ANSI style tables and color model conversion helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ChalkId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { flow, Match, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { AnsiRenderLevel, ColorModelName, ForegroundColorName, ModifierName } from "./ChalkSchema.ts";
import type { BackgroundColorName, StyleChannel, StyleName } from "./ChalkSchema.ts";

type AnsiCodePair = readonly [open: number, close: number];
const $I = $ChalkId.create("Domain");

/**
 * Modifier style names accepted by the Chalk runtime.
 *
 * **Example** (Assign bold modifier name)
 *
 * ```ts
 * import type { ModifierStyleName } from "./AnsiStyles.ts"
 *
 * const styleName: ModifierStyleName = "bold"
 * console.log(styleName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ModifierStyleName = ModifierName;

/**
 * Foreground color style names accepted by the Chalk runtime.
 *
 * **Example** (Assign cyan foreground name)
 *
 * ```ts
 * import type { ForegroundStyleName } from "./AnsiStyles.ts"
 *
 * const styleName: ForegroundStyleName = "cyan"
 * console.log(styleName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ForegroundStyleName = ForegroundColorName;

/**
 * Background color style names accepted by the Chalk runtime.
 *
 * **Example** (Assign bgBlue background name)
 *
 * ```ts
 * import type { BackgroundStyleName } from "./AnsiStyles.ts"
 *
 * const styleName: BackgroundStyleName = "bgBlue"
 * console.log(styleName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BackgroundStyleName = BackgroundColorName;

export type { StyleName } from "./ChalkSchema.ts";

/**
 * Open and close ANSI escape sequences for a style.
 *
 * **Example** (Create open close styler entry)
 *
 * ```ts
 * import { StylerEntry } from "./AnsiStyles.ts"
 *
 * const entry = StylerEntry.make({ open: "\u001B[31m", close: "\u001B[39m" })
 * console.log(entry.open)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StylerEntry extends S.Class<StylerEntry>($I`StylerEntry`)(
  {
    open: S.NonEmptyString,
    close: S.NonEmptyString,
  },
  $I.annote("StylerEntry", {
    description: "Open and close ANSI escape sequences for a single chalk style.",
  })
) {}

const ANSI_BACKGROUND_OFFSET = 10;

const wrapAnsi16 =
  (offset = 0) =>
  (code: number): string =>
    `\u001B[${code + offset}m`;

const wrapAnsi256 =
  (offset = 0) =>
  (code: number): string =>
    `\u001B[${38 + offset};5;${code}m`;

const wrapAnsi16m =
  (offset = 0) =>
  (red: number, green: number, blue: number): string =>
    `\u001B[${38 + offset};2;${red};${green};${blue}m`;

const modifierCodes: Record<ModifierStyleName, AnsiCodePair> = {
  reset: [0, 0],
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  overline: [53, 55],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],
};

const foregroundCodes: Record<ForegroundStyleName, AnsiCodePair> = {
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],
  grey: [90, 39],
  blackBright: [90, 39],
  redBright: [91, 39],
  greenBright: [92, 39],
  yellowBright: [93, 39],
  blueBright: [94, 39],
  magentaBright: [95, 39],
  cyanBright: [96, 39],
  whiteBright: [97, 39],
};

const backgroundCodes: Record<BackgroundStyleName, AnsiCodePair> = {
  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],
  bgGray: [100, 49],
  bgGrey: [100, 49],
  bgBlackBright: [100, 49],
  bgRedBright: [101, 49],
  bgGreenBright: [102, 49],
  bgYellowBright: [103, 49],
  bgBlueBright: [104, 49],
  bgMagentaBright: [105, 49],
  bgCyanBright: [106, 49],
  bgWhiteBright: [107, 49],
};

const toStyleEntry = ([open, close]: AnsiCodePair): StylerEntry =>
  StylerEntry.make({
    open: `\u001B[${open}m`,
    close: `\u001B[${close}m`,
  });

const modifierStyles: Record<ModifierStyleName, StylerEntry> = R.map(modifierCodes, toStyleEntry);

const foregroundStyles: Record<ForegroundStyleName, StylerEntry> = R.map(foregroundCodes, toStyleEntry);

const backgroundStyles: Record<BackgroundStyleName, StylerEntry> = R.map(backgroundCodes, toStyleEntry);

/**
 * ANSI escape builders grouped by modifier, foreground color, and background color.
 *
 * **Example** (Access red color open code)
 *
 * ```ts
 * import { ansiStyles } from "./AnsiStyles.ts"
 *
 * const redOpen = ansiStyles.color.red.open
 * console.log(redOpen)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ansiStyles = {
  modifier: modifierStyles,
  color: {
    ...foregroundStyles,
    close: "\u001B[39m",
    ansi: wrapAnsi16(),
    ansi16m: wrapAnsi16m(),
    ansi256: wrapAnsi256(),
  },
  bgColor: {
    ...backgroundStyles,
    close: "\u001B[49m",
    ansi: wrapAnsi16(ANSI_BACKGROUND_OFFSET),
    ansi16m: wrapAnsi16m(ANSI_BACKGROUND_OFFSET),
    ansi256: wrapAnsi256(ANSI_BACKGROUND_OFFSET),
  },
};

/**
 * Look up the ANSI style entry for a known Chalk style name.
 *
 * **Example** (Look up bold style entry)
 *
 * ```ts
 * import { getStyleEntry } from "./AnsiStyles.ts"
 *
 * const style = getStyleEntry("bold")
 * console.log(style.close)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getStyleEntry = Match.type<StyleName>().pipe(
  Match.withReturnType<StylerEntry>(),
  Match.when(ModifierName.is, (value) => modifierStyles[value]),
  Match.when(ForegroundColorName.is, (value) => foregroundStyles[value]),
  Match.orElse((value) => backgroundStyles[value])
);

const parseHexMatch = (hex: string): O.Option<string> =>
  pipe(
    /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex),
    O.fromNullishOr,
    O.map((match) => match[0])
  );

const expandShortHex = flow(Str.split(""), A.map(Str.repeat(2)), A.join(""));

const canonicalizeHex = (matched: string): string => (matched.length === 3 ? expandShortHex(matched) : matched);

const toRgbTuple = (canonical: string): readonly [red: number, green: number, blue: number] => {
  const integer = Number.parseInt(canonical, 16);

  return [(integer >> 16) & 0xff, (integer >> 8) & 0xff, integer & 0xff];
};

const renderExtendedMonochromeAnsi256 = (red: number): number =>
  red > 248 ? 231 : Math.round(((red - 8) / 247) * 24) + 232;

const renderMonochromeAnsi256 = (red: number): number => (red < 8 ? 16 : renderExtendedMonochromeAnsi256(red));

/**
 * Convert RGB channel values to an ANSI 256 color index.
 *
 * **Example** (Convert RGB to ANSI 256)
 *
 * ```ts
 * import { rgbToAnsi256 } from "./AnsiStyles.ts"
 *
 * const index = rgbToAnsi256(255, 0, 0)
 * console.log(index)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
class BlueChannelOptionsModel extends S.Class<BlueChannelOptionsModel>($I`BlueChannelOptions`)(
  {
    blue: S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(255)),
  },
  $I.annote("BlueChannelOptions", {
    description: "Blue channel companion value for dual RGB conversion helpers.",
  })
) {}

type BlueChannelOptions = typeof BlueChannelOptionsModel.Encoded;

export const rgbToAnsi256: {
  (red: number, green: number, options: BlueChannelOptions): number;
  (green: number, options: BlueChannelOptions): (red: number) => number;
} = dual(3, (red: number, green: number, options: BlueChannelOptions): number => {
  const blue = options.blue;
  return red === green && green === blue
    ? renderMonochromeAnsi256(red)
    : 16 + 36 * Math.round((red / 255) * 5) + 6 * Math.round((green / 255) * 5) + Math.round((blue / 255) * 5);
});

/**
 * Convert a hexadecimal color string to an RGB tuple.
 *
 * **Example** (Convert hex color to RGB)
 *
 * ```ts
 * import { hexToRgb } from "./AnsiStyles.ts"
 *
 * const [red, green, blue] = hexToRgb("#336699")
 * console.log(red, green, blue)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const hexToRgb = (hex: string): readonly [red: number, green: number, blue: number] =>
  pipe(
    parseHexMatch(hex),
    O.match({
      onNone: () => [0, 0, 0],
      onSome: flow(canonicalizeHex, toRgbTuple),
    })
  );

const renderAnsiCodeBrightness = (value: number, result: number): number => (value === 2 ? result + 60 : result);

const ansi256ToAnsiGray = (code: number): number => {
  const gray = ((code - 232) * 10 + 8) / 255;
  const value = gray * 2;
  const result = 30 + ((Math.round(gray) << 2) | (Math.round(gray) << 1) | Math.round(gray));

  return value === 0 ? 30 : renderAnsiCodeBrightness(value, result);
};

const ansi256ToAnsiColorCube = (code: number): number => {
  const relativeCode = code - 16;
  const remainder = relativeCode % 36;
  const red = Math.floor(relativeCode / 36) / 5;
  const green = Math.floor(remainder / 6) / 5;
  const blue = (remainder % 6) / 5;
  const value = Math.max(red, green, blue) * 2;
  const result = 30 + ((Math.round(blue) << 2) | (Math.round(green) << 1) | Math.round(red));

  return value === 0 ? 30 : renderAnsiCodeBrightness(value, result);
};

/**
 * Convert an ANSI 256 color index to a basic ANSI color code.
 *
 * **Example** (Convert ANSI 256 to basic)
 *
 * ```ts
 * import { ansi256ToAnsi } from "./AnsiStyles.ts"
 *
 * const code = ansi256ToAnsi(196)
 * console.log(code)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ansi256ToAnsi = (code: number): number =>
  Match.type<number>().pipe(
    Match.when(
      (value) => value < 8,
      (value) => 30 + value
    ),
    Match.when(
      (value) => value < 16,
      (value) => 90 + (value - 8)
    ),
    Match.when((value) => value >= 232, ansi256ToAnsiGray),
    Match.orElse(ansi256ToAnsiColorCube)
  )(code);

/**
 * Convert RGB values to a basic ANSI color code.
 *
 * **Example** (Convert RGB to basic ANSI)
 *
 * ```ts
 * import { rgbToAnsi } from "./AnsiStyles.ts"
 *
 * const code = rgbToAnsi(255, 0, 0)
 * console.log(code)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rgbToAnsi: {
  (red: number, green: number, options: BlueChannelOptions): number;
  (green: number, options: BlueChannelOptions): (red: number) => number;
} = dual(3, (red: number, green: number, options: BlueChannelOptions): number =>
  ansi256ToAnsi(rgbToAnsi256(red, green, options))
);

/**
 * Convert a hexadecimal color string to an ANSI 256 color index.
 *
 * **Example** (Convert hex to ANSI 256)
 *
 * ```ts
 * import { hexToAnsi256 } from "./AnsiStyles.ts"
 *
 * const index = hexToAnsi256("#ff0000")
 * console.log(index)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const hexToAnsi256 = (hex: string): number => {
  const [red, green, blue] = hexToRgb(hex);
  return rgbToAnsi256(red, green, { blue });
};

/**
 * Convert a hexadecimal color string to a basic ANSI color code.
 *
 * **Example** (Convert hex to basic ANSI)
 *
 * ```ts
 * import { hexToAnsi } from "./AnsiStyles.ts"
 *
 * const code = hexToAnsi("#ff0000")
 * console.log(code)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const hexToAnsi = (hex: string): number => ansi256ToAnsi(hexToAnsi256(hex));

const renderRgbModel = (
  level: AnsiRenderLevel,
  type: StyleChannel,
  arguments_: ReadonlyArray<number | string>
): string => {
  const [red = 0, green = 0, blue = 0] = arguments_;

  return AnsiRenderLevel.$match(level, {
    ansi: () => ansiStyles[type].ansi(rgbToAnsi(Number(red), Number(green), { blue: Number(blue) })),
    ansi16m: () => ansiStyles[type].ansi16m(Number(red), Number(green), Number(blue)),
    ansi256: () => ansiStyles[type].ansi256(rgbToAnsi256(Number(red), Number(green), { blue: Number(blue) })),
  });
};

const renderHexModel = (
  level: AnsiRenderLevel,
  type: StyleChannel,
  arguments_: ReadonlyArray<number | string>
): string => {
  const [color = ""] = arguments_;

  return getModelAnsi("rgb", level, type, ...hexToRgb(`${color}`));
};

const renderAnsi256Model = (type: StyleChannel, arguments_: ReadonlyArray<number | string>): string => {
  const [index = 0] = arguments_;

  return ansiStyles[type].ansi256(Number(index));
};

/**
 * Render an ANSI opening escape for an RGB, hexadecimal, or ANSI 256 color model.
 *
 * **Example** (Render RGB model open escape)
 *
 * ```ts
 * import { getModelAnsi } from "./AnsiStyles.ts"
 *
 * const open = getModelAnsi("rgb", "ansi16m", "color", 255, 128, 0)
 * console.log(open)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const getModelAnsi = (
  model: ColorModelName,
  level: AnsiRenderLevel,
  type: StyleChannel,
  ...arguments_: ReadonlyArray<number | string>
): string =>
  ColorModelName.$match(model, {
    ansi256: () => renderAnsi256Model(type, arguments_),
    hex: () => renderHexModel(level, type, arguments_),
    rgb: () => renderRgbModel(level, type, arguments_),
  });
