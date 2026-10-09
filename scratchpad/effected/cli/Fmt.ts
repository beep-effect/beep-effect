import { displayWidth, graphemes, stripAnsi } from "./internal/displayWidth.ts";

/**
 * Options for {@link Fmt.truncate}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface TruncateOptions {
	/** Marks the cut; `…` by default. Counted by display width. */
	readonly ellipsis?: string | undefined;
}

/**
 * Options for {@link Fmt.percent}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface PercentOptions {
	/** Decimal places to round to; `1` by default. A trailing zero decimal is dropped. */
	readonly digits?: number | undefined;
	/**
	 * What the input is scaled to: `1` (the default) is a ratio from 0 to 1, `100` is already a percentage from 0
	 * to 100, as istanbul's coverage numbers are.
	 */
	readonly scale?: 1 | 100 | undefined;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to match control characters
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
 * import { sanitize } from "@beep/scratchpad/effected/cli/Fmt"
 *
 * console.log(sanitize("hello\tworld")) // hello world
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const sanitize = (input: string): string => stripAnsi(input).replace(/\t/g, " ").replace(CONTROL, "");

/**
 * Small, pure formatting primitives for terminal output.
 *
 * **Example** (Format a test count)
 *
 * ```ts
 * import { Fmt } from "@beep/scratchpad/effected/cli/Fmt"
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
	 * import { Fmt } from "@beep/scratchpad/effected/cli/Fmt"
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
	 * The display width of `text` in terminal columns: wide East Asian characters and emoji count two,
	 * combining marks and ANSI escapes count none.
	 *
	 * **Example** (Measure wide characters)
	 *
	 * ```ts
	 * import { Fmt } from "@beep/scratchpad/effected/cli/Fmt"
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
	 * import { Fmt } from "@beep/scratchpad/effected/cli/Fmt"
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
	static readonly truncate = (text: string, width: number, options?: TruncateOptions): string => {
		const limit = Number.isFinite(width) ? Math.floor(width) : width === Number.POSITIVE_INFINITY ? Infinity : 0;
		if (limit <= 0) return "";
		if (displayWidth(text) <= limit) return text;

		const plain = stripAnsi(text);
		const ellipsis = options?.ellipsis ?? "…";
		const ellipsisWidth = displayWidth(ellipsis);
		const useEllipsis = ellipsisWidth <= limit && ellipsis !== "";
		const budget = useEllipsis ? limit - ellipsisWidth : limit;

		let out = "";
		let used = 0;
		for (const grapheme of graphemes(plain)) {
			const w = displayWidth(grapheme);
			if (used + w > budget) break;
			out += grapheme;
			used += w;
		}
		return useEllipsis ? `${out}${ellipsis}` : out;
	};

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
	 * import { Fmt } from "@beep/scratchpad/effected/cli/Fmt"
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
	 * import { Fmt } from "@beep/scratchpad/effected/cli/Fmt"
	 *
	 * console.log(Fmt.percent(0.833)) // 83.3%
	 * ```
	 *
	 * @param n - the ratio, 0 to 1 (0 to 100 with `scale: 100`)
	 * @param options - the decimal places and the scale
	 * @category formatting
	 * @since 0.0.0
	 */
	static readonly percent = (n: number, options?: PercentOptions): string => {
		const digits = Math.min(10, Math.max(0, Math.floor(options?.digits ?? 1)));
		const percent = options?.scale === 100 ? n : n * 100;
		return `${Number(percent.toFixed(digits))}%`;
	};

	/**
	 * A count with its noun: `1 test`, `2 tests`, `0 tests`.
	 *
	 * **Example** (Choose an irregular plural)
	 *
	 * ```ts
	 * import { Fmt } from "@beep/scratchpad/effected/cli/Fmt"
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
	static readonly plural = (n: number, singular: string, plural?: string): string =>
		`${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}
