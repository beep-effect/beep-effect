/**
 * Internal schema definitions and literal domains for Chalk.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ChalkId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import type { LiteralKit as LiteralKitSchema } from "@beep/schema";
import type { SchemaAST } from "effect";

const $I = $ChalkId.create("Domain");

type LiteralValues = readonly [SchemaAST.LiteralValue, ...Array<SchemaAST.LiteralValue>];

const withLiteralKitHelpers =
  <const L extends LiteralValues>(kit: LiteralKitSchema<L>) =>
  <const Schema extends object>(schema: Schema) =>
    SchemaUtils.withStatics(schema, () => ({
      $match: kit.$match,
      Enum: kit.Enum,
      omitOptions: kit.omitOptions,
      Options: kit.Options,
      pickOptions: kit.pickOptions,
      thunk: kit.thunk,
      toTaggedUnion: kit.toTaggedUnion,
    }));

/**
 * Supported numeric color support levels.
 *
 * **Example** (Access truecolor level value)
 *
 * ```ts
 * import { colorSupportLevelValues } from "@beep/chalk/Chalk"
 *
 * const truecolorLevel = colorSupportLevelValues[3]
 * console.log(truecolorLevel)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const colorSupportLevelValues = [0, 1, 2, 3] as const;

/**
 * Supported modifier style names.
 *
 * **Example** (Access bold modifier name)
 *
 * ```ts
 * import { modifierNameValues } from "@beep/chalk/Chalk"
 *
 * const bold = modifierNameValues[1]
 * console.log(bold)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const modifierNameValues = [
  "reset",
  "bold",
  "dim",
  "italic",
  "underline",
  "overline",
  "inverse",
  "hidden",
  "strikethrough",
] as const;

/**
 * Supported foreground color names.
 *
 * **Example** (Access red foreground name)
 *
 * ```ts
 * import { foregroundColorNameValues } from "@beep/chalk/Chalk"
 *
 * const red = foregroundColorNameValues[1]
 * console.log(red)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const foregroundColorNameValues = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "gray",
  "grey",
  "blackBright",
  "redBright",
  "greenBright",
  "yellowBright",
  "blueBright",
  "magentaBright",
  "cyanBright",
  "whiteBright",
] as const;

/**
 * Supported background color names.
 *
 * **Example** (Access red background name)
 *
 * ```ts
 * import { backgroundColorNameValues } from "@beep/chalk/Chalk"
 *
 * const red = backgroundColorNameValues[1]
 * console.log(red)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const backgroundColorNameValues = [
  "bgBlack",
  "bgRed",
  "bgGreen",
  "bgYellow",
  "bgBlue",
  "bgMagenta",
  "bgCyan",
  "bgWhite",
  "bgGray",
  "bgGrey",
  "bgBlackBright",
  "bgRedBright",
  "bgGreenBright",
  "bgYellowBright",
  "bgBlueBright",
  "bgMagentaBright",
  "bgCyanBright",
  "bgWhiteBright",
] as const;

/**
 * Supported foreground and background color names.
 *
 * **Example** (Read first color name)
 *
 * ```ts
 * import { colorNameValues } from "@beep/chalk/Chalk"
 *
 * const colorName = colorNameValues[0]
 * console.log(colorName)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const colorNameValues = [...foregroundColorNameValues, ...backgroundColorNameValues] as const;

/**
 * Supported Chalk style names.
 *
 * **Example** (Read first style name)
 *
 * ```ts
 * import { styleNameValues } from "@beep/chalk/internal/ChalkSchema"
 *
 * const firstStyle = styleNameValues[0]
 * console.log(firstStyle)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const styleNameValues = [...modifierNameValues, ...colorNameValues] as const;

/**
 * ANSI color model names used by dynamic Chalk builders.
 *
 * @category constants
 * @since 0.0.0
 */
export const colorModelNameValues = ["rgb", "hex", "ansi256"] as const;

/**
 * ANSI render levels used by terminal capability detection.
 *
 * @category constants
 * @since 0.0.0
 */
export const ansiRenderLevelValues = ["ansi", "ansi256", "ansi16m"] as const;

/**
 * ANSI style channels for foreground and background color tables.
 *
 * @category constants
 * @since 0.0.0
 */
export const styleChannelValues = ["color", "bgColor"] as const;

/**
 * Supported Chalk color support levels.
 *
 * **Example** (Decode color support level)
 *
 * ```ts
 * import { ColorSupportLevel } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ColorSupportLevel)
 * console.log(decode(3))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const ColorSupportLevelKit = LiteralKit(colorSupportLevelValues);

export const ColorSupportLevel = S.Literals(colorSupportLevelValues).pipe(
  $I.annoteSchema("ColorSupportLevel", {
    description:
      "Supported terminal color support levels: 0 disables colors, 1 enables ANSI colors, 2 enables ANSI256, and 3 enables truecolor.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"]),
  withLiteralKitHelpers(ColorSupportLevelKit)
);

/**
 * Runtime type for {@link ColorSupportLevel}.
 *
 * **Example** (Annotate color support level)
 *
 * ```ts
 * import type { ColorSupportLevel } from "@beep/chalk"
 *
 * const level: ColorSupportLevel = 2
 * console.log(level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ColorSupportLevel = typeof ColorSupportLevel.Type;

/**
 * Color support metadata for an enabled Chalk output stream.
 *
 * **Example** (Create color support metadata)
 *
 * ```ts
 * import { ColorSupport } from "@beep/chalk"
 *
 * const support = ColorSupport.make({ has16m: true, has256: true, hasBasic: true, level: 3 })
 * console.log(support.level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ColorSupport extends S.Class<ColorSupport>($I`ColorSupport`)(
  {
    level: ColorSupportLevel,
    hasBasic: S.Boolean,
    has256: S.Boolean,
    has16m: S.Boolean,
  },
  $I.annote("ColorSupport", {
    description: "Detected terminal color support metadata for a Chalk output stream.",
  })
) {}

/**
 * Schema for exported Chalk color support info values.
 *
 * **Example** (Decode disabled color info)
 *
 * ```ts
 * import { ColorInfo } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ColorInfo)
 * console.log(decode(false))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ColorInfo = S.Union([ColorSupport, S.Literal(false)]).pipe(
  $I.annoteSchema("ColorInfo", {
    description: "Detected terminal color support information, or `false` when color output is disabled.",
  })
);

/**
 * Runtime type for {@link ColorInfo}.
 *
 * **Example** (Annotate disabled color info)
 *
 * ```ts
 * import type { ColorInfo } from "@beep/chalk"
 *
 * const info: ColorInfo = false
 * console.log(info)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ColorInfo = typeof ColorInfo.Type;

/**
 * Constructor options for isolated Chalk instances.
 *
 * **Example** (Create chalk options)
 *
 * ```ts
 * import { ChalkOptions } from "@beep/chalk"
 *
 * const options = ChalkOptions.make({ level: 3 })
 * console.log(options.level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChalkOptions extends S.Class<ChalkOptions>($I`ChalkOptions`)(
  {
    level: S.optionalKey(ColorSupportLevel),
  },
  $I.annote("ChalkOptions", {
    description: "Configuration for constructing an isolated Chalk instance with an explicit color support level.",
  })
) {}

/**
 * Supported Chalk modifier names.
 *
 * **Example** (Decode bold modifier name)
 *
 * ```ts
 * import { ModifierName } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ModifierName)
 * console.log(decode("bold"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const ModifierNameKit = LiteralKit(modifierNameValues);

export const ModifierName = S.Literals(modifierNameValues).pipe(
  $I.annoteSchema("ModifierName", {
    description: "Supported Chalk modifier names.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  withLiteralKitHelpers(ModifierNameKit)
);

/**
 * Runtime type for {@link ModifierName}.
 *
 * **Example** (Annotate italic modifier name)
 *
 * ```ts
 * import type { ModifierName } from "@beep/chalk"
 *
 * const name: ModifierName = "italic"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ModifierName = typeof ModifierName.Type;

/**
 * Supported Chalk foreground color names.
 *
 * **Example** (Decode green foreground name)
 *
 * ```ts
 * import { ForegroundColorName } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ForegroundColorName)
 * console.log(decode("green"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const ForegroundColorNameKit = LiteralKit(foregroundColorNameValues);

export const ForegroundColorName = S.Literals(foregroundColorNameValues).pipe(
  $I.annoteSchema("ForegroundColorName", {
    description: "Supported Chalk foreground color names.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  withLiteralKitHelpers(ForegroundColorNameKit)
);

/**
 * Runtime type for {@link ForegroundColorName}.
 *
 * **Example** (Annotate cyan foreground name)
 *
 * ```ts
 * import type { ForegroundColorName } from "@beep/chalk"
 *
 * const name: ForegroundColorName = "cyan"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ForegroundColorName = typeof ForegroundColorName.Type;

/**
 * Supported Chalk background color names.
 *
 * **Example** (Decode blue background name)
 *
 * ```ts
 * import { BackgroundColorName } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(BackgroundColorName)
 * console.log(decode("bgBlue"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const BackgroundColorNameKit = LiteralKit(backgroundColorNameValues);

export const BackgroundColorName = S.Literals(backgroundColorNameValues).pipe(
  $I.annoteSchema("BackgroundColorName", {
    description: "Supported Chalk background color names.",
  }),
  withLiteralKitHelpers(BackgroundColorNameKit)
);

/**
 * Runtime type for {@link BackgroundColorName}.
 *
 * **Example** (Annotate magenta background name)
 *
 * ```ts
 * import type { BackgroundColorName } from "@beep/chalk"
 *
 * const name: BackgroundColorName = "bgMagenta"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BackgroundColorName = typeof BackgroundColorName.Type;

/**
 * Supported Chalk color names.
 *
 * **Example** (Decode red color name)
 *
 * ```ts
 * import { ColorName } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ColorName)
 * console.log(decode("red"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const ColorNameKit = LiteralKit(colorNameValues);

export const ColorName = S.Literals(colorNameValues).pipe(
  $I.annoteSchema("ColorName", {
    description: "Supported Chalk foreground and background color names.",
  }),
  withLiteralKitHelpers(ColorNameKit)
);

/**
 * Runtime type for {@link ColorName}.
 *
 * **Example** (Annotate yellow background name)
 *
 * ```ts
 * import type { ColorName } from "@beep/chalk"
 *
 * const name: ColorName = "bgYellow"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ColorName = typeof ColorName.Type;

/**
 * Schema for all supported Chalk style names.
 *
 * @category models
 * @since 0.0.0
 */
const StyleNameKit = LiteralKit(styleNameValues);

export const StyleName = S.Literals(styleNameValues).pipe(
  $I.annoteSchema("StyleName", {
    description: "Supported Chalk modifier, foreground color, and background color style names.",
  }),
  withLiteralKitHelpers(StyleNameKit)
);

/**
 * Runtime type for {@link StyleName}.
 *
 * @category models
 * @since 0.0.0
 */
export type StyleName = typeof StyleName.Type;

/**
 * Color model names accepted by dynamic color builders.
 *
 * @category models
 * @since 0.0.0
 */
const ColorModelNameKit = LiteralKit(colorModelNameValues);

export const ColorModelName = S.Literals(colorModelNameValues).pipe(
  $I.annoteSchema("ColorModelName", {
    description: "ANSI color model names accepted by Chalk dynamic color builders.",
  }),
  withLiteralKitHelpers(ColorModelNameKit)
);

/**
 * Runtime type for {@link ColorModelName}.
 *
 * @category models
 * @since 0.0.0
 */
export type ColorModelName = typeof ColorModelName.Type;

/**
 * ANSI render levels selected from color-support detection.
 *
 * @category models
 * @since 0.0.0
 */
const AnsiRenderLevelKit = LiteralKit(ansiRenderLevelValues);

export const AnsiRenderLevel = S.Literals(ansiRenderLevelValues).pipe(
  $I.annoteSchema("AnsiRenderLevel", {
    description: "ANSI rendering level used by Chalk color model builders.",
  }),
  withLiteralKitHelpers(AnsiRenderLevelKit)
);

/**
 * Runtime type for {@link AnsiRenderLevel}.
 *
 * @category models
 * @since 0.0.0
 */
export type AnsiRenderLevel = typeof AnsiRenderLevel.Type;

/**
 * Foreground/background style channel selector.
 *
 * @category models
 * @since 0.0.0
 */
const StyleChannelKit = LiteralKit(styleChannelValues);

export const StyleChannel = S.Literals(styleChannelValues).pipe(
  $I.annoteSchema("StyleChannel", {
    description: "Foreground or background ANSI style channel.",
  }),
  withLiteralKitHelpers(StyleChannelKit)
);

/**
 * Runtime type for {@link StyleChannel}.
 *
 * @category models
 * @since 0.0.0
 */
export type StyleChannel = typeof StyleChannel.Type;
