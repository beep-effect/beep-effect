/**
 * Chalk-compatible terminal string styling with schema-backed public models.
 *
 * **Details**
 *
 * Provides a chainable builder API for applying ANSI colors, background colors,
 * and text modifiers to terminal output. All color and modifier names are
 * validated by Effect Schemas, and isolated instances can be created with
 * explicit color support levels.
 *
 * **Example** (Shared and isolated instances)
 *
 * ```ts
 * import chalk, { Chalk, chalkStderr } from "@beep/chalk"
 *
 * // Default shared instance (stdout)
 * console.log(chalk.red.bold("Error!"))
 *
 * // Isolated instance with explicit color level
 * const c = new Chalk({ level: 3 })
 * console.log(c.hex("#FF8800").underline("Warning"))
 *
 * // stderr instance
 * console.log(chalkStderr.yellow("stderr warning"))
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeCreateChalk } from "./internal/ChalkRuntime.ts";
import {
  BackgroundColorName as BackgroundColorNameDefinition,
  backgroundColorNameValues,
  ChalkOptions as ChalkOptionsDefinition,
  ColorInfo as ColorInfoDefinition,
  ColorName as ColorNameDefinition,
  ColorSupport as ColorSupportDefinition,
  ColorSupportLevel as ColorSupportLevelDefinition,
  colorNameValues,
  ForegroundColorName as ForegroundColorNameDefinition,
  foregroundColorNameValues,
  ModifierName as ModifierNameDefinition,
  modifierNameValues,
} from "./internal/ChalkSchema.ts";
import {
  ChalkConstructorOptions as ChalkConstructorOptionsDefinition,
  ColorSupportLevelInput as ColorSupportLevelInputDefinition,
  makeChalkConstructor,
} from "./internal/PublicSurface.ts";
import { detectedSupportsColor } from "./internal/SupportsColor.ts";
import type {
  ChalkConstructorOptions as ChalkConstructorOptionsType,
  ChalkInstanceSurface,
} from "./internal/PublicSurface.ts";

// oxlint-disable typescript-eslint/no-unsafe-declaration-merging

const createChalk = makeCreateChalk(detectedSupportsColor.stdout);
const createChalkStderr = makeCreateChalk(detectedSupportsColor.stderr);

/**
 * Recursive callable Chalk builder surface.
 *
 * **Details**
 *
 * A `ChalkInstance` is both a callable function and a chainable style builder.
 * Accessing style properties (e.g. `.red`, `.bold`) returns a new builder with
 * the style stacked, and calling it as a function applies all stacked styles to
 * the given text.
 *
 * **Example** (Chaining and color methods)
 *
 * ```ts
 * import chalk, { type ChalkInstance } from "@beep/chalk"
 *
 * // Chain styles, then call to apply
 * const warning: ChalkInstance = chalk.yellow.bold
 * console.log(warning("Caution!"))
 *
 * // Inline chaining
 * console.log(chalk.red.bgWhite.underline("Error"))
 *
 * // Hex, RGB, and ANSI256
 * console.log(chalk.hex("#FF8800")("orange text"))
 * console.log(chalk.rgb(255, 136, 0)("orange text"))
 * console.log(chalk.ansi256(208)("orange text"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ChalkInstance extends ChalkInstanceSurface {
  (...text: ReadonlyArray<unknown>): string;
}

/**
 * Runtime type for isolated Chalk instances created by {@link Chalk}.
 *
 * @since 0.0.0
 * @category models
 */
class ChalkValue {}

interface ChalkValue extends ChalkInstance {}

/**
 * An isolated Chalk instance with its own color support level.
 *
 * **Details**
 *
 * Construct via `new Chalk()` or `new Chalk({ level })` to get an instance
 * whose `level` is independent from the shared default.
 *
 * **Example** (Isolated truecolor instance)
 *
 * ```ts
 * import { Chalk } from "@beep/chalk"
 *
 * const c: Chalk = new Chalk({ level: 3 })
 * console.log(c.green.bold("Success"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Chalk = ChalkValue;

/**
 * Constructor for creating isolated Chalk instances.
 *
 * **Details**
 *
 * Each instance maintains its own `level` so color output can be controlled
 * independently of the shared default. Pass `{ level: 0 }` to disable colors,
 * or `{ level: 3 }` for full truecolor support.
 *
 * **Example** (Truecolor and disabled levels)
 *
 * ```ts
 * import { Chalk } from "@beep/chalk"
 *
 * // Truecolor instance
 * const truecolor = new Chalk({ level: 3 })
 * console.log(truecolor.hex("#FF0000")("red text"))
 *
 * // Disabled instance (no ANSI output)
 * const plain = new Chalk({ level: 0 })
 * console.log(plain.red("no color")) // "no color"
 *
 * // Default detection
 * console.log(new Chalk().level)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Chalk = makeChalkConstructor(ChalkValue, createChalk);

/**
 * Schema for supported Chalk background color names.
 *
 * **Details**
 *
 * A `LiteralKit` schema accepting values like `"bgRed"`, `"bgBlue"`,
 * `"bgGreenBright"`, etc.
 *
 * **Example** (Decode background color name)
 *
 * ```ts
 * import { BackgroundColorName } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(BackgroundColorName)
 * console.log(decode("bgRed"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BackgroundColorName = BackgroundColorNameDefinition;

/**
 * A supported Chalk background color name literal.
 *
 * **Example** (Assign background color literal)
 *
 * ```ts
 * import type { BackgroundColorName } from "@beep/chalk"
 *
 * const bg: BackgroundColorName = "bgRed"
 * console.log(bg)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BackgroundColorName = BackgroundColorNameDefinition;

/**
 * Schema for constructor options accepted by {@link Chalk}.
 *
 * **Details**
 *
 * This schema keeps constructor input plain-object compatible while validating
 * that `level`, when provided, is an integer from `0` through `3`.
 *
 * **Example** (Decode constructor options)
 *
 * ```ts
 * import { ChalkConstructorOptions } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ChalkConstructorOptions)
 * console.log(decode({ level: 3 }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChalkConstructorOptions = ChalkConstructorOptionsDefinition;

/**
 * Constructor options accepted by {@link Chalk}.
 *
 * **Details**
 *
 * Derived from the encoded side of {@link ChalkConstructorOptions}, so object
 * literals and broad numeric inputs remain compatible with `new Chalk(...)`.
 *
 * **Example** (Pass options to constructor)
 *
 * ```ts
 * import { Chalk, type ChalkConstructorOptions } from "@beep/chalk"
 *
 * const options: ChalkConstructorOptions = { level: 3 }
 * console.log(new Chalk(options).level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ChalkConstructorOptions = ChalkConstructorOptionsType;

/**
 * Schema for constructor options accepted by {@link Chalk}.
 *
 * **Details**
 *
 * Contains an optional `level` field that sets the color support level
 * (`0` through `3`).
 *
 * **Example** (Decode Chalk options)
 *
 * ```ts
 * import { ChalkOptions } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ChalkOptions)
 * console.log(decode({ level: 2 }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChalkOptions = ChalkOptionsDefinition;

/**
 * Constructor options for creating an isolated Chalk instance.
 *
 * **Example** (Typed options object)
 *
 * ```ts
 * import type { ChalkOptions } from "@beep/chalk"
 *
 * const opts: ChalkOptions = { level: 3 }
 * console.log(opts.level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ChalkOptions = ChalkOptionsDefinition;

/**
 * Schema for detected color support information.
 *
 * **Details**
 *
 * Decodes to either a {@link ColorSupport} object when color output is
 * available, or `false` when it is disabled.
 *
 * **Example** (Render color support info)
 *
 * ```ts
 * import { ColorInfo, supportsColor } from "@beep/chalk"
 *
 * const info: ColorInfo = supportsColor
 * const rendered = info === false ? "disabled" : `level:${info.level}`
 * console.log(rendered)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ColorInfo = ColorInfoDefinition;

/**
 * Detected color support information, or `false` when color output is disabled.
 *
 * **Example** (Disabled color info)
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
export type ColorInfo = ColorInfoDefinition;

/**
 * Schema for all supported Chalk color names (foreground and background).
 *
 * **Details**
 *
 * Union of {@link ForegroundColorName} and {@link BackgroundColorName} values.
 *
 * **Example** (Decode foreground and background)
 *
 * ```ts
 * import { ColorName } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ColorName)
 * console.log(decode("red"))
 * console.log(decode("bgBlue"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ColorName = ColorNameDefinition;

/**
 * A supported Chalk color name literal (foreground or background).
 *
 * **Example** (Assign color name literal)
 *
 * ```ts
 * import type { ColorName } from "@beep/chalk"
 *
 * const name: ColorName = "red"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ColorName = ColorNameDefinition;

/**
 * Schema for terminal color support metadata.
 *
 * **Details**
 *
 * Describes the detected capabilities of an output stream: whether it supports
 * basic ANSI, 256-color, and truecolor (16 million) modes.
 *
 * **Example** (Decode color support object)
 *
 * ```ts
 * import { ColorSupport } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ColorSupport)
 * console.log(decode({
 *   level: 3,
 *   hasBasic: true,
 *   has256: true,
 *   has16m: true
 * }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ColorSupport = ColorSupportDefinition;

/**
 * Detected terminal color support capabilities for an output stream.
 *
 * **Example** (Truecolor support object)
 *
 * ```ts
 * import type { ColorSupport } from "@beep/chalk"
 *
 * const support: ColorSupport = { level: 3, hasBasic: true, has256: true, has16m: true }
 * console.log(support.level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ColorSupport = ColorSupportDefinition;

/**
 * Schema for Chalk color support levels.
 *
 * **Details**
 *
 * Accepts `0` (disabled), `1` (basic ANSI), `2` (ANSI 256), or `3` (truecolor).
 *
 * **Example** (Decode support level)
 *
 * ```ts
 * import { ColorSupportLevel } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ColorSupportLevel)
 * console.log(decode(3))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ColorSupportLevel = ColorSupportLevelDefinition;

/**
 * A Chalk color support level: `0` | `1` | `2` | `3`.
 *
 * **Example** (Assign support level)
 *
 * ```ts
 * import type { ColorSupportLevel } from "@beep/chalk"
 *
 * const level: ColorSupportLevel = 3
 * console.log(level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ColorSupportLevel = ColorSupportLevelDefinition;

/**
 * Schema for broad numeric color support level input at constructor boundaries.
 *
 * **Details**
 *
 * This accepts `number` at the type level and validates that runtime values are
 * integer levels from `0` through `3`.
 *
 * **Example** (Decode level input)
 *
 * ```ts
 * import { ColorSupportLevelInput } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ColorSupportLevelInput)
 * console.log(decode(2))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ColorSupportLevelInput = ColorSupportLevelInputDefinition;

/**
 * Broad numeric color support level input accepted by constructor boundaries.
 *
 * **Example** (Assign level input)
 *
 * ```ts
 * import type { ColorSupportLevelInput } from "@beep/chalk"
 *
 * const level: ColorSupportLevelInput = 3
 * console.log(level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ColorSupportLevelInput = typeof ColorSupportLevelInputDefinition.Type;

/**
 * Schema for supported Chalk foreground color names.
 *
 * **Details**
 *
 * A `LiteralKit` schema accepting values like `"red"`, `"blue"`,
 * `"greenBright"`, etc.
 *
 * **Example** (Decode foreground color name)
 *
 * ```ts
 * import { ForegroundColorName } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ForegroundColorName)
 * console.log(decode("cyanBright"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ForegroundColorName = ForegroundColorNameDefinition;

/**
 * A supported Chalk foreground color name literal.
 *
 * **Example** (Assign foreground color literal)
 *
 * ```ts
 * import type { ForegroundColorName } from "@beep/chalk"
 *
 * const fg: ForegroundColorName = "cyanBright"
 * console.log(fg)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ForegroundColorName = ForegroundColorNameDefinition;

/**
 * Schema for supported Chalk text modifier names.
 *
 * **Details**
 *
 * A `LiteralKit` schema accepting values like `"bold"`, `"italic"`,
 * `"underline"`, `"strikethrough"`, etc.
 *
 * **Example** (Decode modifier name)
 *
 * ```ts
 * import { ModifierName } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ModifierName)
 * console.log(decode("bold"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ModifierName = ModifierNameDefinition;

/**
 * A supported Chalk text modifier name literal.
 *
 * **Example** (Assign modifier name literal)
 *
 * ```ts
 * import type { ModifierName } from "@beep/chalk"
 *
 * const mod: ModifierName = "bold"
 * console.log(mod)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ModifierName = ModifierNameDefinition;

/**
 * Readonly tuple of all supported modifier name strings.
 *
 * **Example** (Check underline modifier)
 *
 * ```ts
 * import { modifierNames } from "@beep/chalk"
 *
 * const hasUnderline = modifierNames.includes("underline")
 * console.log(hasUnderline)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modifierNames = modifierNameValues;

/**
 * Readonly tuple of all supported foreground color name strings.
 *
 * **Example** (Check cyan foreground)
 *
 * ```ts
 * import { foregroundColorNames } from "@beep/chalk"
 *
 * const hasCyan = foregroundColorNames.includes("cyan")
 * console.log(hasCyan)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const foregroundColorNames = foregroundColorNameValues;

/**
 * Readonly tuple of all supported background color name strings.
 *
 * **Example** (Check bgBlue background)
 *
 * ```ts
 * import { backgroundColorNames } from "@beep/chalk"
 *
 * const hasBgBlue = backgroundColorNames.includes("bgBlue")
 * console.log(hasBgBlue)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const backgroundColorNames = backgroundColorNameValues;

/**
 * Readonly tuple of all supported color name strings (foreground and background).
 *
 * **Example** (Read first color name)
 *
 * ```ts
 * import { colorNames } from "@beep/chalk"
 *
 * const firstColorName = colorNames[0]
 * console.log(firstColorName)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const colorNames = colorNameValues;

/**
 * Alias for {@link modifierNames} preserved for Chalk API compatibility.
 *
 * **Example** (Check bold modifier alias)
 *
 * ```ts
 * import { modifiers } from "@beep/chalk"
 *
 * const hasBold = modifiers.includes("bold")
 * console.log(hasBold)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modifiers = modifierNames;

/**
 * Alias for {@link foregroundColorNames} preserved for Chalk API compatibility.
 *
 * **Example** (Check red foreground alias)
 *
 * ```ts
 * import { foregroundColors } from "@beep/chalk"
 *
 * const hasRed = foregroundColors.includes("red")
 * console.log(hasRed)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const foregroundColors = foregroundColorNames;

/**
 * Alias for {@link backgroundColorNames} preserved for Chalk API compatibility.
 *
 * **Example** (Check bgRed background alias)
 *
 * ```ts
 * import { backgroundColors } from "@beep/chalk"
 *
 * const hasBgRed = backgroundColors.includes("bgRed")
 * console.log(hasBgRed)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const backgroundColors = backgroundColorNames;

/**
 * Alias for {@link colorNames} preserved for Chalk API compatibility.
 *
 * **Example** (Check bgYellow color alias)
 *
 * ```ts
 * import { colors } from "@beep/chalk"
 *
 * const hasBgYellow = colors.includes("bgYellow")
 * console.log(hasBgYellow)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const colors = colorNames;

/**
 * Color support detected for stdout in the current Node.js runtime.
 *
 * **Details**
 *
 * Returns a {@link ColorSupport} object when the terminal supports color, or
 * `false` when color output is not available.
 *
 * **Example** (Read stdout support level)
 *
 * ```ts
 * import { supportsColor } from "@beep/chalk"
 *
 * const level = supportsColor === false ? 0 : supportsColor.level
 * console.log(level)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const supportsColor = detectedSupportsColor.stdout;

/**
 * Color support detected for stderr in the current Node.js runtime.
 *
 * **Details**
 *
 * Returns a {@link ColorSupport} object when the terminal supports color on
 * stderr, or `false` when color output is not available.
 *
 * **Example** (Read stderr support level)
 *
 * ```ts
 * import { supportsColorStderr } from "@beep/chalk"
 *
 * const level = supportsColorStderr === false ? 0 : supportsColorStderr.level
 * console.log(level)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const supportsColorStderr = detectedSupportsColor.stderr;

class ChalkStderrValue {}

interface ChalkStderrValue extends ChalkInstance {}

const ChalkStderr = makeChalkConstructor(ChalkStderrValue, createChalkStderr);

/**
 * Shared Chalk instance configured from stderr color support detection.
 *
 * **Details**
 *
 * Use this when writing styled output to `process.stderr`.
 *
 * **Example** (Style stderr error text)
 *
 * ```ts
 * import { chalkStderr } from "@beep/chalk"
 *
 * const rendered = chalkStderr.red.bold("Error!")
 * console.log(rendered.length > 0)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const chalkStderr: ChalkInstance = new ChalkStderr();

/**
 * Shared Chalk instance configured from stdout color support detection.
 *
 * **Details**
 *
 * This is the default export and the primary entry point for styling terminal
 * strings. Style methods can be chained and the result called as a function.
 *
 * **Example** (Chain styles and colors)
 *
 * ```ts
 * import chalk from "@beep/chalk"
 *
 * // Simple styling
 * console.log(chalk.green("Success"))
 *
 * // Chained styles
 * console.log(chalk.red.bgWhite.bold("Alert"))
 *
 * // Nested styles via template interpolation
 * console.log(chalk.red(`Error: ${chalk.bold.underline("file not found")}`))
 *
 * // Hex and RGB colors (requires level >= 2 or 3)
 * console.log(chalk.hex("#FF8800")("orange"))
 * console.log(chalk.rgb(255, 136, 0)("also orange"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const chalk: ChalkInstance = new Chalk();

export default chalk;
