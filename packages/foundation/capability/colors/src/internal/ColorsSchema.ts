/**
 * Internal schemas for ANSI color formatter objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ColorsId } from "@beep/identity";
import { Fn } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ColorsId.create("Domain");

/**
 * Input accepted by a color formatter.
 *
 * **Example** (Decode ready string input)
 *
 * ```typescript
 * import { FormatterInput } from "./ColorsSchema.ts"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(FormatterInput)
 * console.log(decode("ready"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FormatterInput = S.Union([S.String, S.Finite]).pipe(
  S.UndefinedOr,
  $I.annoteSchema("FormatterInput", {
    description: "Input accepted by a color formatter.",
  })
);

/**
 * Runtime type for {@link FormatterInput}.
 *
 * **Example** (Annotate numeric formatter input)
 *
 * ```typescript
 * import type { FormatterInput } from "./ColorsSchema.ts"
 *
 * const input: FormatterInput = 42
 * console.log(input)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FormatterInput = typeof FormatterInput.Type;

/**
 * Schema for a formatter that renders one value to a string.
 *
 * **Example** (Format number as string)
 *
 * ```typescript
 * import type { Formatter } from "./ColorsSchema.ts"
 *
 * const formatter: Formatter = (input) => `${input}`
 * console.log(formatter(42))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Formatter = Fn({
  input: FormatterInput,
  output: S.String,
}).pipe(
  $I.annoteSchema("Formatter", {
    description: "A unary formatter that wraps string output with ANSI escape sequences.",
  })
);

/**
 * Runtime type for {@link Formatter}.
 *
 * **Example** (Format ready string value)
 *
 * ```typescript
 * import type { Formatter } from "@beep/colors/Colors"
 *
 * const formatter: Formatter = (input) => `${input}`
 * console.log(formatter("ready"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Formatter = typeof Formatter.Type;

/**
 * Schema fields used to construct a `Colors` formatter set.
 *
 * **Example** (Check bold field exists)
 *
 * ```typescript
 * import { ColorsFields } from "./ColorsSchema.ts"
 *
 * const hasBold = "bold" in ColorsFields
 * console.log(hasBold)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ColorsFields = {
  isColorSupported: S.Boolean.pipe(
    $I.annoteKey("Colors.isColorSupported", {
      description: "Whether the formatter set emits ANSI escape sequences.",
    })
  ),

  reset: Formatter.pipe($I.annoteKey("Colors.reset", { description: "ANSI reset formatter." })),
  bold: Formatter.pipe($I.annoteKey("Colors.bold", { description: "ANSI bold style formatter." })),
  dim: Formatter.pipe($I.annoteKey("Colors.dim", { description: "ANSI dim style formatter." })),
  italic: Formatter.pipe($I.annoteKey("Colors.italic", { description: "ANSI italic style formatter." })),
  underline: Formatter.pipe($I.annoteKey("Colors.underline", { description: "ANSI underline style formatter." })),
  inverse: Formatter.pipe($I.annoteKey("Colors.inverse", { description: "ANSI inverse style formatter." })),
  hidden: Formatter.pipe($I.annoteKey("Colors.hidden", { description: "ANSI hidden style formatter." })),
  strikethrough: Formatter.pipe(
    $I.annoteKey("Colors.strikethrough", { description: "ANSI strikethrough style formatter." })
  ),

  black: Formatter.pipe($I.annoteKey("Colors.black", { description: "ANSI black foreground formatter." })),
  red: Formatter.pipe($I.annoteKey("Colors.red", { description: "ANSI red foreground formatter." })),
  green: Formatter.pipe($I.annoteKey("Colors.green", { description: "ANSI green foreground formatter." })),
  yellow: Formatter.pipe($I.annoteKey("Colors.yellow", { description: "ANSI yellow foreground formatter." })),
  blue: Formatter.pipe($I.annoteKey("Colors.blue", { description: "ANSI blue foreground formatter." })),
  magenta: Formatter.pipe($I.annoteKey("Colors.magenta", { description: "ANSI magenta foreground formatter." })),
  cyan: Formatter.pipe($I.annoteKey("Colors.cyan", { description: "ANSI cyan foreground formatter." })),
  white: Formatter.pipe($I.annoteKey("Colors.white", { description: "ANSI white foreground formatter." })),
  gray: Formatter.pipe($I.annoteKey("Colors.gray", { description: "ANSI gray foreground formatter." })),

  bgBlack: Formatter.pipe($I.annoteKey("Colors.bgBlack", { description: "ANSI black background formatter." })),
  bgRed: Formatter.pipe($I.annoteKey("Colors.bgRed", { description: "ANSI red background formatter." })),
  bgGreen: Formatter.pipe($I.annoteKey("Colors.bgGreen", { description: "ANSI green background formatter." })),
  bgYellow: Formatter.pipe($I.annoteKey("Colors.bgYellow", { description: "ANSI yellow background formatter." })),
  bgBlue: Formatter.pipe($I.annoteKey("Colors.bgBlue", { description: "ANSI blue background formatter." })),
  bgMagenta: Formatter.pipe($I.annoteKey("Colors.bgMagenta", { description: "ANSI magenta background formatter." })),
  bgCyan: Formatter.pipe($I.annoteKey("Colors.bgCyan", { description: "ANSI cyan background formatter." })),
  bgWhite: Formatter.pipe($I.annoteKey("Colors.bgWhite", { description: "ANSI white background formatter." })),

  blackBright: Formatter.pipe(
    $I.annoteKey("Colors.blackBright", { description: "ANSI bright black foreground formatter." })
  ),
  redBright: Formatter.pipe($I.annoteKey("Colors.redBright", { description: "ANSI bright red foreground formatter." })),
  greenBright: Formatter.pipe(
    $I.annoteKey("Colors.greenBright", { description: "ANSI bright green foreground formatter." })
  ),
  yellowBright: Formatter.pipe(
    $I.annoteKey("Colors.yellowBright", { description: "ANSI bright yellow foreground formatter." })
  ),
  blueBright: Formatter.pipe(
    $I.annoteKey("Colors.blueBright", { description: "ANSI bright blue foreground formatter." })
  ),
  magentaBright: Formatter.pipe(
    $I.annoteKey("Colors.magentaBright", { description: "ANSI bright magenta foreground formatter." })
  ),
  cyanBright: Formatter.pipe(
    $I.annoteKey("Colors.cyanBright", { description: "ANSI bright cyan foreground formatter." })
  ),
  whiteBright: Formatter.pipe(
    $I.annoteKey("Colors.whiteBright", { description: "ANSI bright white foreground formatter." })
  ),

  bgBlackBright: Formatter.pipe(
    $I.annoteKey("Colors.bgBlackBright", { description: "ANSI bright black background formatter." })
  ),
  bgRedBright: Formatter.pipe(
    $I.annoteKey("Colors.bgRedBright", { description: "ANSI bright red background formatter." })
  ),
  bgGreenBright: Formatter.pipe(
    $I.annoteKey("Colors.bgGreenBright", { description: "ANSI bright green background formatter." })
  ),
  bgYellowBright: Formatter.pipe(
    $I.annoteKey("Colors.bgYellowBright", { description: "ANSI bright yellow background formatter." })
  ),
  bgBlueBright: Formatter.pipe(
    $I.annoteKey("Colors.bgBlueBright", { description: "ANSI bright blue background formatter." })
  ),
  bgMagentaBright: Formatter.pipe(
    $I.annoteKey("Colors.bgMagentaBright", { description: "ANSI bright magenta background formatter." })
  ),
  bgCyanBright: Formatter.pipe(
    $I.annoteKey("Colors.bgCyanBright", { description: "ANSI bright cyan background formatter." })
  ),
  bgWhiteBright: Formatter.pipe(
    $I.annoteKey("Colors.bgWhiteBright", { description: "ANSI bright white background formatter." })
  ),
};
