/**
 * Browser-targeted Chalk entry point.
 *
 * **Details**
 *
 * Provides the same API surface as `@beep/chalk/Chalk` but detects color
 * support via the browser navigator instead of Node.js TTY introspection.
 * In non-browser runtimes (e.g. Node test runners) color detection returns
 * `false` and all styling becomes a no-op passthrough.
 *
 * **Example** (Check browser color support)
 *
 * ```ts import.meta.vitest name="Check browser color support"
 * import chalk, { Chalk, supportsColor } from "@beep/chalk/Chalk.browser"
 *
 * if (supportsColor !== false) {
 *
 * } else {
 *
 * }
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
import { detectedSupportsColorBrowser } from "./internal/SupportsColor.browser.ts";
import type {
  ChalkConstructorOptions as ChalkConstructorOptionsType,
  ChalkInstanceSurface,
} from "./internal/PublicSurface.ts";

// oxlint-disable typescript-eslint/no-unsafe-declaration-merging

const createChalk = makeCreateChalk(detectedSupportsColorBrowser.stdout);
const createChalkStderr = makeCreateChalk(detectedSupportsColorBrowser.stderr);

// fallow-ignore-next-line code-duplication -- browser/node chalk dual surfaces intentionally share the public model re-export block; jsdoc-carrier migration only rewrote comment carriers and Fallow attributes the pre-existing twin as introduced
/**
 * Recursive callable Chalk builder surface for browser-targeted bundles.
 *
 * **Example** (Type a styled chalk chain)
 *
 * ```ts
 * import chalk, { type ChalkInstance } from "@beep/chalk/Chalk.browser"
 *
 * const warning: ChalkInstance = chalk.yellow.bold
 * console.log(warning("Caution!"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ChalkInstance extends ChalkInstanceSurface {
  (...text: ReadonlyArray<unknown>): string;
}

class ChalkValue {}

interface ChalkValue extends ChalkInstance {}

/**
 * Runtime type for isolated browser Chalk instances created by {@link Chalk}.
 *
 * @since 0.0.0
 * @category models
 */
export type Chalk = ChalkValue;

/**
 * Constructor for creating isolated browser Chalk instances.
 *
 * **Example** (Construct Chalk with level)
 *
 * ```ts
 * import { Chalk } from "@beep/chalk/Chalk.browser"
 *
 * const chalk = new Chalk({ level: 3 })
 * console.log(chalk.green("Success"))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Chalk = makeChalkConstructor(ChalkValue, createChalk);

/**
 * Schema for supported Chalk background color names.
 *
 * @since 0.0.0
 * @category schemas
 */
export const BackgroundColorName = BackgroundColorNameDefinition;

/**
 * A supported Chalk background color name literal.
 *
 * @since 0.0.0
 * @category models
 */
export type BackgroundColorName = BackgroundColorNameDefinition;

/**
 * Schema for constructor options accepted by {@link Chalk}.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ChalkConstructorOptions = ChalkConstructorOptionsDefinition;

/**
 * Constructor options accepted by {@link Chalk}.
 *
 * @since 0.0.0
 * @category models
 */
export type ChalkConstructorOptions = ChalkConstructorOptionsType;

/**
 * Schema for strict Chalk option models.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ChalkOptions = ChalkOptionsDefinition;

/**
 * Strict Chalk option model type.
 *
 * @since 0.0.0
 * @category models
 */
export type ChalkOptions = ChalkOptionsDefinition;

/**
 * Schema for detected color support information.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ColorInfo = ColorInfoDefinition;

/**
 * Detected color support information, or `false` when disabled.
 *
 * @since 0.0.0
 * @category models
 */
export type ColorInfo = ColorInfoDefinition;

/**
 * Schema for all supported Chalk color names.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ColorName = ColorNameDefinition;

/**
 * Supported Chalk color name literal.
 *
 * @since 0.0.0
 * @category models
 */
export type ColorName = ColorNameDefinition;

/**
 * Schema for terminal color support metadata.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ColorSupport = ColorSupportDefinition;

/**
 * Terminal color support metadata.
 *
 * @since 0.0.0
 * @category models
 */
export type ColorSupport = ColorSupportDefinition;

/**
 * Schema for Chalk color support levels.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ColorSupportLevel = ColorSupportLevelDefinition;

/**
 * A Chalk color support level: `0` | `1` | `2` | `3`.
 *
 * @since 0.0.0
 * @category models
 */
export type ColorSupportLevel = ColorSupportLevelDefinition;

/**
 * Schema for broad numeric color support level input.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ColorSupportLevelInput = ColorSupportLevelInputDefinition;

/**
 * Broad numeric color support level input.
 *
 * @since 0.0.0
 * @category models
 */
export type ColorSupportLevelInput = typeof ColorSupportLevelInputDefinition.Type;

/**
 * Schema for supported Chalk foreground color names.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ForegroundColorName = ForegroundColorNameDefinition;

/**
 * Supported Chalk foreground color name literal.
 *
 * @since 0.0.0
 * @category models
 */
export type ForegroundColorName = ForegroundColorNameDefinition;

/**
 * Schema for supported Chalk text modifier names.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ModifierName = ModifierNameDefinition;

/**
 * Supported Chalk text modifier name literal.
 *
 * @since 0.0.0
 * @category models
 */
export type ModifierName = ModifierNameDefinition;

/**
 * Readonly tuple of all supported modifier name strings.
 *
 * @since 0.0.0
 * @category utilities
 */
export const modifierNames = modifierNameValues;

/**
 * Readonly tuple of all supported foreground color name strings.
 *
 * @since 0.0.0
 * @category utilities
 */
export const foregroundColorNames = foregroundColorNameValues;

/**
 * Readonly tuple of all supported background color name strings.
 *
 * @since 0.0.0
 * @category utilities
 */
export const backgroundColorNames = backgroundColorNameValues;

/**
 * Readonly tuple of all supported color name strings.
 *
 * @since 0.0.0
 * @category utilities
 */
export const colorNames = colorNameValues;

/**
 * Alias for {@link modifierNames} preserved for Chalk API compatibility.
 *
 * @since 0.0.0
 * @category utilities
 */
export const modifiers = modifierNames;

/**
 * Alias for {@link foregroundColorNames} preserved for Chalk API compatibility.
 *
 * @since 0.0.0
 * @category utilities
 */
export const foregroundColors = foregroundColorNames;

/**
 * Alias for {@link backgroundColorNames} preserved for Chalk API compatibility.
 *
 * @since 0.0.0
 * @category utilities
 */
export const backgroundColors = backgroundColorNames;

/**
 * Alias for {@link colorNames} preserved for Chalk API compatibility.
 *
 * @since 0.0.0
 * @category utilities
 */
export const colors = colorNames;

/**
 * Color support detected for stdout in browser-compatible runtimes.
 *
 * @since 0.0.0
 * @category utilities
 */
export const supportsColor = detectedSupportsColorBrowser.stdout;

/**
 * Color support detected for stderr in browser-compatible runtimes.
 *
 * @since 0.0.0
 * @category utilities
 */
export const supportsColorStderr = detectedSupportsColorBrowser.stderr;

class ChalkStderrValue {}

interface ChalkStderrValue extends ChalkInstance {}

const ChalkStderr = makeChalkConstructor(ChalkStderrValue, createChalkStderr);

/**
 * Shared browser Chalk instance configured from stderr color support detection.
 *
 * @since 0.0.0
 * @category utilities
 */
export const chalkStderr: ChalkInstance = new ChalkStderr();

/**
 * Shared browser Chalk instance configured from stdout color support detection.
 *
 * @since 0.0.0
 * @category utilities
 */
const chalk: ChalkInstance = new Chalk();

export default chalk;
