/**
 * ANSI color helpers inspired by `picocolors`.
 *
 * The module exports a shared default formatter set detected from the current runtime,
 * plus helpers for forcing enabled or disabled formatter instances when you need stable
 * behavior in tests, browser builds, or log pipelines.
 *
 * @example
 * ```typescript
 * import colors from "@beep/colors"
 *
 * const message = colors.bold(colors.green("ready"))
 *
 * console.log(message)
 * ```
 *
 * @example
 * ```typescript
 * import { createColors } from "@beep/colors"
 *
 * const plain = createColors(false)
 * const rendered = plain.red("warning")
 *
 * console.log(rendered) // "warning"
 * ```
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $ColorsId } from "@beep/identity";
import { A, Str, thunk } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ColorsFields, Formatter as FormatterDefinition } from "./internal/ColorsSchema.ts";
import type * as AST from "effect/SchemaAST";
import type { Formatter as FormatterType } from "./internal/ColorsSchema.ts";

const $I = $ColorsId.create("Domain");

const isParseOptions = (input: unknown): input is AST.ParseOptions =>
  P.hasProperty(input, "errors") ||
  P.hasProperty(input, "onExcessProperty") ||
  P.hasProperty(input, "propertyOrder") ||
  P.hasProperty(input, "disableChecks") ||
  P.hasProperty(input, "concurrency");

const isSchemaCodecDataFirst = (args: IArguments): boolean =>
  args.length >= 2 || (args.length === 1 && !isParseOptions(args[0]));

/**
 * Minimal stdout metadata used by ANSI color support detection.
 *
 * @example
 * ```typescript
 * import { ProcessLikeStdout } from "@beep/colors"
 *
 * const stdout = ProcessLikeStdout.make({ isTTY: true })
 * console.log(stdout.isTTY)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessLikeStdout extends S.Class<ProcessLikeStdout>($I`ProcessLikeStdout`)(
  {
    isTTY: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ProcessLikeStdout.isTTY", {
        description: "Whether the stdout stream is attached to a TTY.",
      })
    ),
  },
  $I.annote("ProcessLikeStdout", {
    description: "Minimal stdout metadata used by ANSI color support detection.",
  })
) {}

/**
 * Minimal process-like runtime metadata used by ANSI color support detection.
 *
 * @example
 * ```typescript
 * import { ProcessLike, supportsColor } from "@beep/colors"
 *
 * const processLike = ProcessLike.make({ env: { FORCE_COLOR: "1" } })
 * console.log(supportsColor(processLike))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessLike extends S.Class<ProcessLike>($I`ProcessLike`)(
  {
    argv: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("ProcessLike.argv", {
        description: "Process argument vector consulted for ANSI color override flags.",
      })
    ),
    env: S.Record(S.String, S.UndefinedOr(S.String)).pipe(
      S.optionalKey,
      $I.annoteKey("ProcessLike.env", {
        description: "Process environment variables consulted for ANSI color support detection.",
      })
    ),
    platform: S.optionalKey(S.String).pipe(
      $I.annoteKey("ProcessLike.platform", {
        description: "Runtime platform string used to detect Windows color support.",
      })
    ),
    stdout: S.optionalKey(ProcessLikeStdout).pipe(
      $I.annoteKey("ProcessLike.stdout", {
        description: "Stdout metadata used to detect terminal color support.",
      })
    ),
  },
  $I.annote("ProcessLike", {
    description: "Minimal process-like runtime metadata used by ANSI color support detection.",
  })
) {
  static readonly decodeOption: {
    (input: unknown, options?: AST.ParseOptions): O.Option<ProcessLike>;
    (options?: AST.ParseOptions): (input: unknown) => O.Option<ProcessLike>;
  } = dual(isSchemaCodecDataFirst, S.decodeUnknownOption(ProcessLike));

  static readonly supportsColor = (processLike: ProcessLike = runtimeProcessLike): boolean => {
    const argv = processLike.argv ?? A.empty();
    const env = processLike.env ?? {};

    if (env.NO_COLOR !== undefined || A.contains(argv, "--no-color")) {
      return false;
    }

    if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") {
      return true;
    }

    return (
      processLike.platform === "win32" ||
      (Boolean(processLike.stdout?.isTTY) && env.TERM !== "dumb") ||
      env.CI !== undefined
    );
  };
}

const runtimeProcess = Reflect.get(globalThis, "process");
const runtimeProcessLike: ProcessLike = pipe(
  ProcessLike.decodeOption(runtimeProcess),
  O.getOrElse(() => ProcessLike.make({}))
);
const stringIdentity: FormatterType = String;

const findCloseFrom = (text: string, close: string, cursor: number): O.Option<number> =>
  pipe(
    text,
    Str.substring(cursor),
    Str.indexOf(close),
    O.map((index) => cursor + index)
  );

const replaceClose = (text: string, close: string, replace: string, index: number): string => {
  let result = "";
  let cursor = 0;
  let nextIndex = O.some(index);

  while (O.isSome(nextIndex)) {
    result += Str.substring(cursor, nextIndex.value)(text) + replace;
    cursor = nextIndex.value + close.length;
    nextIndex = findCloseFrom(text, close, cursor);
  }

  return result + Str.substring(cursor)(text);
};

/**
 * Schema describing a unary formatter function.
 *
 * Formatter inputs are normalized with `String(...)`, matching the lightweight coercion
 * behavior expected from CLI color helpers.
 *
 * @example
 * ```typescript
 * import { createColors, type Formatter } from "@beep/colors"
 *
 * const formatter: Formatter = createColors(true).cyan
 * const rendered = formatter(42)
 *
 * console.log(rendered) // "\u001b[36m42\u001b[39m"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Formatter = FormatterDefinition;

/**
 * Runtime type for {@link Formatter}.
 *
 * @example
 * ```typescript
 * import type { Formatter } from "@beep/colors"
 *
 * const formatter: Formatter = (input) => `${input}`
 * console.log(formatter("ready"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Formatter = FormatterType;

const formatter =
  (open: string, close: string, replace = open): Formatter =>
  (input) => {
    const text = String(input);
    const index = findCloseFrom(text, close, open.length);

    return O.match(index, {
      onNone: () => open + text + close,
      onSome: (nextIndex) => open + replaceClose(text, close, replace, nextIndex) + close,
    });
  };

/**
 * Detect whether ANSI color output should be enabled for a process-like runtime.
 *
 * `NO_COLOR` and `--no-color` always disable colors, even when CI, Windows TTYs,
 * or `FORCE_COLOR` would otherwise enable them. `FORCE_COLOR="0"` is treated as disabled.
 *
 * @example
 * ```typescript
 * import { supportsColor } from "@beep/colors"
 *
 * const enabled = supportsColor({
 *   env: { FORCE_COLOR: "1" },
 * })
 *
 * console.log(enabled) // true
 * ```
 *
 * @category utilities
 * @param processLike - The process-like runtime metadata used for color capability detection.
 * @returns `true` when ANSI escape sequences should be emitted.
 * @since 0.0.0
 */
export const supportsColor = ProcessLike.supportsColor;

/**
 * Whether ANSI color output is enabled for the current runtime.
 *
 * @example
 * ```typescript
 * import { isColorSupported } from "@beep/colors"
 *
 * console.log(typeof isColorSupported) // "boolean"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isColorSupported = supportsColor();

/**
 * A configured set of ANSI color formatter functions.
 *
 * Instances are immutable and can be reused safely across loggers or render paths.
 * Use {@link createColors} to build explicitly enabled or disabled formatter sets.
 *
 * @example
 * ```typescript
 * import { Colors, createColors } from "@beep/colors"
 *
 * const colors = createColors(true)
 * const isColorsInstance = colors instanceof Colors
 *
 * console.log(isColorsInstance) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Colors extends S.Class<Colors>($I`Colors`)(
  ColorsFields,
  $I.annote("Colors", {
    description: "The Colors configuration object.",
  })
) {
  /**
   * Recreate a `Colors` formatter set with explicit color support.
   *
   * @example
   * ```typescript
   * import { createColors } from "@beep/colors"
   *
   * const colors = createColors(false)
   * const enabled = colors.createColors(true)
   * console.log(enabled.green("ready"))
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  readonly createColors = createColors;
}

/**
 * Create a formatter set with ANSI escapes either enabled or disabled.
 *
 * When disabled, every formatter falls back to `String(...)` so downstream code can keep
 * the same call sites without branching on environment support.
 *
 * @example
 * ```typescript
 * import { createColors } from "@beep/colors"
 *
 * const colors = createColors(false)
 * const rendered = colors.bold(colors.red("offline"))
 *
 * console.log(rendered) // "offline"
 * ```
 *
 * @category utilities
 * @param enabled - Whether the returned formatter set should emit ANSI escapes.
 * @returns A configured immutable formatter set.
 * @since 0.0.0
 */
export const createColors = (enabled: boolean = isColorSupported): Colors => {
  const makeFormatter: typeof formatter = enabled ? formatter : thunk(stringIdentity);

  return Colors.make({
    isColorSupported: enabled,
    reset: makeFormatter("\x1b[0m", "\x1b[0m"),
    bold: makeFormatter("\x1b[1m", "\x1b[22m", "\x1b[22m\x1b[1m"),
    dim: makeFormatter("\x1b[2m", "\x1b[22m", "\x1b[22m\x1b[2m"),
    italic: makeFormatter("\x1b[3m", "\x1b[23m"),
    underline: makeFormatter("\x1b[4m", "\x1b[24m"),
    inverse: makeFormatter("\x1b[7m", "\x1b[27m"),
    hidden: makeFormatter("\x1b[8m", "\x1b[28m"),
    strikethrough: makeFormatter("\x1b[9m", "\x1b[29m"),

    black: makeFormatter("\x1b[30m", "\x1b[39m"),
    red: makeFormatter("\x1b[31m", "\x1b[39m"),
    green: makeFormatter("\x1b[32m", "\x1b[39m"),
    yellow: makeFormatter("\x1b[33m", "\x1b[39m"),
    blue: makeFormatter("\x1b[34m", "\x1b[39m"),
    magenta: makeFormatter("\x1b[35m", "\x1b[39m"),
    cyan: makeFormatter("\x1b[36m", "\x1b[39m"),
    white: makeFormatter("\x1b[37m", "\x1b[39m"),
    gray: makeFormatter("\x1b[90m", "\x1b[39m"),

    bgBlack: makeFormatter("\x1b[40m", "\x1b[49m"),
    bgRed: makeFormatter("\x1b[41m", "\x1b[49m"),
    bgGreen: makeFormatter("\x1b[42m", "\x1b[49m"),
    bgYellow: makeFormatter("\x1b[43m", "\x1b[49m"),
    bgBlue: makeFormatter("\x1b[44m", "\x1b[49m"),
    bgMagenta: makeFormatter("\x1b[45m", "\x1b[49m"),
    bgCyan: makeFormatter("\x1b[46m", "\x1b[49m"),
    bgWhite: makeFormatter("\x1b[47m", "\x1b[49m"),

    blackBright: makeFormatter("\x1b[90m", "\x1b[39m"),
    redBright: makeFormatter("\x1b[91m", "\x1b[39m"),
    greenBright: makeFormatter("\x1b[92m", "\x1b[39m"),
    yellowBright: makeFormatter("\x1b[93m", "\x1b[39m"),
    blueBright: makeFormatter("\x1b[94m", "\x1b[39m"),
    magentaBright: makeFormatter("\x1b[95m", "\x1b[39m"),
    cyanBright: makeFormatter("\x1b[96m", "\x1b[39m"),
    whiteBright: makeFormatter("\x1b[97m", "\x1b[39m"),

    bgBlackBright: makeFormatter("\x1b[100m", "\x1b[49m"),
    bgRedBright: makeFormatter("\x1b[101m", "\x1b[49m"),
    bgGreenBright: makeFormatter("\x1b[102m", "\x1b[49m"),
    bgYellowBright: makeFormatter("\x1b[103m", "\x1b[49m"),
    bgBlueBright: makeFormatter("\x1b[104m", "\x1b[49m"),
    bgMagentaBright: makeFormatter("\x1b[105m", "\x1b[49m"),
    bgCyanBright: makeFormatter("\x1b[106m", "\x1b[49m"),
    bgWhiteBright: makeFormatter("\x1b[107m", "\x1b[49m"),
  });
};

/**
 * Default formatter set for the current runtime.
 *
 * @example
 * ```typescript
 * import colors from "@beep/colors"
 *
 * const rendered = colors.cyan("beep")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const colors = createColors();

export default colors;
