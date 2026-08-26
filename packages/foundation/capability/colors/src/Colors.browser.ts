/**
 * Browser-safe entrypoint for `@beep/colors`.
 *
 * Browser consoles do not interpret ANSI escape sequences, so this entrypoint always
 * returns plain string formatters while preserving the same API shape as the default module.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $ColorsId } from "@beep/identity";
import { thunkFalse } from "@beep/utils";
import * as S from "effect/Schema";
import { ColorsFields, Formatter as FormatterDefinition } from "./internal/ColorsSchema.ts";
import type { Formatter as FormatterType } from "./internal/ColorsSchema.ts";

const $I = $ColorsId.create("Domain");
const identity: FormatterType = String;

/**
 * Browser-safe formatter model.
 *
 * **Details**
 *
 * Browser builds keep the same API shape as the Node entrypoint, but never emit ANSI
 * escape sequences and keep `createColors` bound to the browser implementation.
 *
 * **Example** (Browser-safe bold formatting)
 *
 * ```ts import.meta.vitest name="Browser-safe bold formatting"
 * import { Colors, createColors } from "@beep/colors"
 *
 * const colors = createColors(false)
 * const rendered = colors.bold("hello")
 * rendered // => "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Colors extends S.Class<Colors>($I`Colors`)(
  ColorsFields,
  $I.annote("Colors", {
    description: "The browser-safe Colors configuration object.",
  })
) {
  readonly createColors = createColors;
}

/**
 * Browser builds never emit ANSI escape sequences.
 *
 * **Example** (Check isColorSupported type)
 *
 * ```ts import.meta.vitest name="Check isColorSupported type"
 * import { isColorSupported } from "@beep/colors"
 *
 * typeof isColorSupported // => "boolean"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isColorSupported = false;

/**
 * Browser builds always disable ANSI escape sequences.
 *
 * **Example** (supportsColor always false)
 *
 * ```ts import.meta.vitest name="supportsColor always false"
 * import { supportsColor } from "@beep/colors"
 *
 * supportsColor() // => false
 * ```
 *
 * @returns Always `false` in browser-safe builds.
 * @category utilities
 * @since 0.0.0
 */
export const supportsColor = thunkFalse;

/**
 * Create a browser-safe formatter set that never emits ANSI escape sequences.
 *
 * **Details**
 *
 * The optional flag is accepted for API parity with the Node entrypoint, but ignored.
 *
 * **Example** (Create formatters without ANSI)
 *
 * ```typescript
 * import { createColors } from "@beep/colors"
 *
 * const colors = createColors(true)
 * const rendered = colors.red("error")
 * console.log(rendered) // "error" (no ANSI in browser builds)
 * ```
 *
 * @param _enabled - Ignored in browser-safe builds.
 * @returns A formatter set whose members coerce input with `String(...)`.
 * @category utilities
 * @since 0.0.0
 */
export const createColors = (_enabled?: undefined | boolean): Colors =>
  Colors.make({
    isColorSupported: false,
    reset: identity,
    bold: identity,
    dim: identity,
    italic: identity,
    underline: identity,
    inverse: identity,
    hidden: identity,
    strikethrough: identity,
    black: identity,
    red: identity,
    green: identity,
    yellow: identity,
    blue: identity,
    magenta: identity,
    cyan: identity,
    white: identity,
    gray: identity,
    bgBlack: identity,
    bgRed: identity,
    bgGreen: identity,
    bgYellow: identity,
    bgBlue: identity,
    bgMagenta: identity,
    bgCyan: identity,
    bgWhite: identity,
    blackBright: identity,
    redBright: identity,
    greenBright: identity,
    yellowBright: identity,
    blueBright: identity,
    magentaBright: identity,
    cyanBright: identity,
    whiteBright: identity,
    bgBlackBright: identity,
    bgRedBright: identity,
    bgGreenBright: identity,
    bgYellowBright: identity,
    bgBlueBright: identity,
    bgMagentaBright: identity,
    bgCyanBright: identity,
    bgWhiteBright: identity,
  });

/**
 * Default browser-safe formatter set.
 *
 * **Example** (Default green string output)
 *
 * ```ts import.meta.vitest name="Default green string output"
 * import colors from "@beep/colors"
 *
 * const rendered = colors.green("ok")
 * typeof rendered // => "string"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const colors = createColors();

/**
 * Schema describing a unary formatter function.
 *
 * **Example** (Use String as Formatter)
 *
 * ```ts import.meta.vitest name="Use String as Formatter"
 * import { type Formatter } from "@beep/colors"
 *
 * const fmt: Formatter = String
 * fmt(42) // => "42"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Formatter = FormatterDefinition;

/**
 * Runtime type for {@link Formatter}.
 *
 * **Example** (Annotate Formatter type)
 *
 * ```typescript
 * import type { Formatter } from "@beep/colors"
 *
 * const formatter: Formatter = String
 * console.log(formatter("ready"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Formatter = FormatterType;

export default colors;
