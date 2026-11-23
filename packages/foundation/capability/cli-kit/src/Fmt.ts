/**
 * Text formatting for terminal output: sanitising untrusted text (`sanitize`, `stripControls`), display width,
 * grapheme-safe truncation, durations, percentages and plurals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import { dual, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AnyNumber } from "./internal/declared.ts";
import { displayWidth, graphemes, stripAnsi } from "./internal/displayWidth.ts";

const $I = $CliKitId.create("Fmt");

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { TruncateOptions } from "@beep/cli-kit/Fmt"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TruncateOptions)({ ellipsis: "..." })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class TruncateOptions extends S.Opaque<TruncateOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Marks the cut; `…` by default. Counted by display width. */
    ellipsis: S.optionalKey(S.String).pipe(
      $I.annoteKey("TruncateOptions.ellipsis", { description: "The ellipsis field of TruncateOptions." })
    ),
  }).pipe($I.annoteSchema("TruncateOptions", { description: "Plain TruncateOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { TruncateOptions } from "@beep/cli-kit/Fmt"
 * import * as S from "effect/Schema"
 *
 * const plain: TruncateOptions.Encoded = { ellipsis: "..." }
 * console.log(S.is(TruncateOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TruncateOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TruncateOptions.Encoded;
}

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { PercentOptions } from "@beep/cli-kit/Fmt"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PercentOptions)({ digits: 1, scale: 100 })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class PercentOptions extends S.Opaque<PercentOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Decimal places to round to; `1` by default. A trailing zero decimal is dropped. */
    digits: S.optionalKey(AnyNumber).pipe(
      $I.annoteKey("PercentOptions.digits", { description: "The digits field of PercentOptions." })
    ),
    /**
     * What the input is scaled to: `1` (the default) is a ratio from 0 to 1, `100` is already a percentage from 0
     * to 100, as istanbul's coverage numbers are.
     */
    scale: S.optionalKey(S.Union([S.Literal(1), S.Literal(100)])).pipe(
      $I.annoteKey("PercentOptions.scale", { description: "The scale field of PercentOptions." })
    ),
  }).pipe($I.annoteSchema("PercentOptions", { description: "Plain PercentOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { PercentOptions } from "@beep/cli-kit/Fmt"
 * import * as S from "effect/Schema"
 *
 * const plain: PercentOptions.Encoded = { digits: 1, scale: 100 }
 * console.log(S.is(PercentOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PercentOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PercentOptions.Encoded;
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Text made safe to lay out and print: complete ANSI and OSC sequences removed, every remaining control character
 * removed (a stray ESC, BEL, BS, DEL, the C1 range) except line feed and carriage return, and a tab turned into a
 * space.
 *
 * **Details**
 *
 * Stripping complete sequences is not enough on its own: a lone ESC survives it, and so does whatever would
 * complete a sequence once two adjacent pieces of text are joined (`ESC` in one node, `[31m` in the next). With
 * every ESC and C0 or C1 control gone after the strip, nothing can reassemble, so the width of the text equals what
 * a terminal shows. A tab counts as no columns but draws up to eight, hence the space.
 *
 * **Example** (Remove terminal controls)
 *
 * ```ts
 * import { sanitize } from "@beep/cli-kit/Fmt"
 *
 * console.log(sanitize("hello\tworld")) // hello world
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const sanitize = (input: string): string =>
  pipe(stripAnsi(input), Str.replace(/\t/g, " "), Str.replace(CONTROL, ""));

const truncationLimit = (width: number): number =>
  Number.isFinite(width) ? Math.floor(width) : width === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : 0;

const takeGraphemes = (plain: string, budget: number): string => {
  let out = "";
  let used = 0;
  for (const grapheme of graphemes(plain)) {
    const w = displayWidth(grapheme);
    if (used + w > budget) break;
    out += grapheme;
    used += w;
  }
  return out;
};

// The single-line strict pass, in this order: OSC (ESC ] to BEL or ST), CSI (ESC [ parameters, intermediates and a
// final byte), any other ESC and the one byte after it, then every remaining C0 control (line breaks and tab
// included), DEL and C1 control.
const OSC_SEQUENCE = /\u001B\][\s\S]*?(?:\u0007|\u001B\\)/gu;
const CSI_SEQUENCE = /\u001B\[[0-?]*[ -/]*[@-~]/gu;
const ESC_PAIR = /\u001B[@-Z\\-_]/gu;
const ANY_CONTROL = /[\u0000-\u001F\u007F-\u009F]/gu;

/**
 * Text made safe to interpolate into one line of output: OSC, CSI and two-byte ESC sequences removed, then every
 * remaining C0 control, DEL and C1 control removed, line feed, carriage return and tab included.
 *
 * **Details**
 *
 * The strict sibling of {@link sanitize}, for a single-line field built from data an attacker controls (a comment's
 * author, a path, a URL, a policy code). `sanitize` keeps line breaks for documents, and a kept CR or LF there would
 * let the data start a new line of its own or overwrite the current one. A tab is removed, not turned into a space.
 *
 * **Example** (Strip a hyperlink and a line break)
 *
 * ```ts
 * import { stripControls } from "@beep/cli-kit/Fmt"
 *
 * console.log(stripControls("a\u001B]8;;https://x.test\u0007b\u001B]8;;\u0007\nc")) // abc
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const stripControls = (input: string): string =>
  pipe(
    input,
    Str.replace(OSC_SEQUENCE, ""),
    Str.replace(CSI_SEQUENCE, ""),
    Str.replace(ESC_PAIR, ""),
    Str.replace(ANY_CONTROL, "")
  );

/**
 * Small, pure formatting primitives for terminal output.
 *
 * **Example** (Format a test count)
 *
 * ```ts
 * import { Fmt } from "@beep/cli-kit/Fmt"
 *
 * console.log(Fmt.plural(2, "test")) // 2 tests
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export abstract class Fmt {
  /**
   * Text made safe to lay out and print, exactly as the renderers make it: complete ANSI and OSC sequences removed,
   * every other control character removed (a stray ESC, BEL, BS, DEL, the C1 range) except line feed and carriage
   * return, and a tab turned into a space.
   *
   * **Details**
   *
   * For a `render` or any other text a program builds by hand from data it does not control: an error message, a
   * file name, a value from the environment. Line breaks are kept, so split on them if the text must be one line.
   *
   * **Example** (Sanitize untrusted output)
   *
   * ```ts
   * import { Fmt } from "@beep/cli-kit/Fmt"
   *
   * console.log(Fmt.sanitize("hello\tworld")) // hello world
   * ```
   *
   * @param text - the text
   * @category formatting
   * @since 0.0.0
   */
  static readonly sanitize: (text: string) => string = sanitize;

  /**
   * Text made safe to interpolate into one line: OSC, CSI and two-byte ESC sequences removed, then every remaining
   * C0 control, DEL and C1 control removed, line feed, carriage return and tab included.
   *
   * **Details**
   *
   * For a single-line field built from data an attacker controls, such as a comment's author, a file path, a URL or
   * a policy code from an artifact. {@link Fmt.sanitize} keeps line breaks, which there would let the data start a
   * line of its own (`[yeet] …`, `::error::…`) or overwrite the current one with a carriage return.
   *
   * **Example** (Keep a hostile author on one line)
   *
   * ```ts
   * import { Fmt } from "@beep/cli-kit/Fmt"
   *
   * console.log(Fmt.stripControls("mallory\r\n[yeet] approved")) // mallory[yeet] approved
   * ```
   *
   * @param text - the text
   * @category formatting
   * @since 0.0.0
   */
  static readonly stripControls: (text: string) => string = stripControls;

  /**
   * The display width of `text` in terminal columns: wide East Asian characters and emoji count two,
   * combining marks and ANSI escapes count none.
   *
   * **Example** (Measure wide characters)
   *
   * ```ts
   * import { Fmt } from "@beep/cli-kit/Fmt"
   *
   * console.log(Fmt.width("界")) // 2
   * ```
   *
   * @param text - the text to measure
   * @category formatting
   * @since 0.0.0
   */
  static readonly width = (text: string): number => displayWidth(text);

  /**
   * Cut `text` to at most `width` columns, ending in `ellipsis` when it was cut.
   *
   * **Details**
   *
   * Grapheme-safe: a grapheme, such as a wide character or an emoji ZWJ family, is kept whole or dropped
   * whole, so the result is never wider than `width`. Text that already fits is returned unchanged, colour
   * escapes included. Text that must be cut is cut as plain text: its ANSI escapes are dropped rather than cut
   * in half. When the ellipsis cannot fit, it is omitted and the text is cut to `width`; a `width` of 0 or
   * less gives `""`.
   *
   * **Example** (Fit text to three columns)
   *
   * ```ts
   * import { Fmt } from "@beep/cli-kit/Fmt"
   *
   * console.log(Fmt.truncate("hello", 3)) // he…
   * ```
   *
   * @param text - the text to truncate
   * @param width - the most columns the result may take
   * @param options - the ellipsis
   * @category formatting
   * @since 0.0.0
   */
  static readonly truncate: {
    (text: string, width: number, options?: TruncateOptions.Encoded): string;
    (width: number, options?: TruncateOptions.Encoded): (text: string) => string;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, width: number, options?: TruncateOptions.Encoded): string => {
      const limit = truncationLimit(width);
      if (limit <= 0) return "";
      if (displayWidth(text) <= limit) return text;

      const plain = stripAnsi(text);
      const ellipsis = options?.ellipsis ?? "…";
      const ellipsisWidth = displayWidth(ellipsis);
      const useEllipsis = ellipsisWidth <= limit && ellipsis !== "";
      const budget = useEllipsis ? limit - ellipsisWidth : limit;

      const out = takeGraphemes(plain, budget);
      return useEllipsis ? `${out}${ellipsis}` : out;
    }
  );

  /**
   * A duration in milliseconds as short human text: `250ms`, `1.2s`, `2s`, `1m 3s`, `2m`, `1h 2m`, `2h`.
   *
   * **Details**
   *
   * Under a second it is whole milliseconds; under a minute, seconds to one decimal with a trailing `.0`
   * dropped; under an hour, minutes and whole seconds, with the seconds dropped when zero; from an hour, hours and
   * whole minutes, the seconds dropped. A value that rounds up to the next unit (`999.6` to a second, `59999` to a
   * minute, `3599999` to an hour) is written in that unit, so `1000ms`, `60s` and `60m` never appear. There is no
   * days unit. A negative or non-finite input is `0ms`.
   *
   * **Example** (Format minutes and seconds)
   *
   * ```ts
   * import { Fmt } from "@beep/cli-kit/Fmt"
   *
   * console.log(Fmt.duration(63000)) // 1m 3s
   * ```
   *
   * @param ms - the duration in milliseconds
   * @category formatting
   * @since 0.0.0
   */
  static readonly duration = (ms: number): string => {
    const value = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    const whole = Math.round(value);
    if (whole < 1000) return `${whole}ms`;
    const tenths = Math.round(value / 100);
    if (tenths < 600) return `${Number((tenths / 10).toFixed(1))}s`;
    const seconds = Math.round(value / 1000);
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const remaining = Math.floor((seconds % 3600) / 60);
      return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
    }
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  };

  /**
   * A ratio from 0 to 1 as a percentage, or a number already from 0 to 100 with `scale: 100`: `83.3%`, `50%`,
   * `100%`.
   *
   * **Details**
   *
   * Rounded to `digits` decimal places (one by default) with trailing zeros dropped, so whole values print
   * without a decimal. A value that rounds to zero prints `0%`, never `-0%`. The input is not validated.
   *
   * **Example** (Format a ratio)
   *
   * ```ts
   * import { Fmt } from "@beep/cli-kit/Fmt"
   *
   * console.log(Fmt.percent(0.833)) // 83.3%
   * ```
   *
   * @param n - the ratio, 0 to 1 (0 to 100 with `scale: 100`)
   * @param options - the decimal places and the scale
   * @category formatting
   * @since 0.0.0
   */
  static readonly percent: {
    (n: number, options?: PercentOptions.Encoded): string;
    (options?: PercentOptions.Encoded): (n: number) => string;
  } = dual(
    (args) => P.isNumber(args[0]),
    (n: number, options?: PercentOptions.Encoded): string => {
      const digits = Math.min(10, Math.max(0, Math.floor(options?.digits ?? 1)));
      const percent = options?.scale === 100 ? n : n * 100;
      return `${Number(percent.toFixed(digits))}%`;
    }
  );

  /**
   * A count with its noun: `1 test`, `2 tests`, `0 tests`.
   *
   * **Example** (Choose an irregular plural)
   *
   * ```ts
   * import { Fmt } from "@beep/cli-kit/Fmt"
   *
   * console.log(Fmt.plural(2, "child", "children")) // 2 children
   * ```
   *
   * @param n - the count
   * @param singular - the noun for exactly one
   * @param plural - the noun otherwise; `singular` with an `s` appended by default
   * @category formatting
   * @since 0.0.0
   */
  static readonly plural: {
    (n: number, singular: string, plural?: string): string;
    (singular: string, plural?: string): (n: number) => string;
  } = dual(
    (args) => P.isNumber(args[0]),
    (n: number, singular: string, plural?: string): string => `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`
  );
}
