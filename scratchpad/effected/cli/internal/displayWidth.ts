// A short display-width implementation checked against `string-width` by a differential test. It embeds a hand-kept East Asian Width table that will drift from Unicode, and
// `__test__/displayWidth.oracle.test.ts` is what catches the drift.

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// biome-ignore lint/suspicious/noControlCharactersInRegex: an ANSI escape starts with ESC and an OSC ends with BEL
const ANSI = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B\[[0-?]*[ -/]*[@-~]/g;
const EMOJI = /^\p{RGI_Emoji}$/v;

const WIDE2 =
	/[\p{Emoji_Presentation}\u1100-\u115E\u2329\u232A\u2630-\u2637\u268A-\u268F\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u303E\u3041-\u3096\u3099-\u30FF\u3105-\u312F\u3131-\u3163\u3165-\u318E\u3190-\u31E5\u31EF-\u321E\u3220-\u3247\u3250-\u4DBF\u4DC0-\uA48C\uA490-\uA4C6\uA960-\uA97C\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE66\uFE68-\uFE6B\uFF01-\uFF60\uFFE0-\uFFE6\u{16FE0}-\u{16FF6}\u{17000}-\u{191FF}\u{1AFF0}-\u{1AFFF}\u{1B000}-\u{1B2FF}\u{1D300}-\u{1D376}\u{1F200}-\u{1F265}\u{20000}-\u{3FFFD}]/u;
const ZERO2 = /^[\p{Mn}\p{Me}\p{Cf}\p{Cc}\u115F\u1160\u3164\uFFA0]+$/u;

/**
 * The text without its ANSI escape sequences: CSI (including SGR colour) and OSC (including OSC-8 hyperlinks).
 *
 * @internal
 */
export const stripAnsi = (input: string): string => input.replace(ANSI, "");

/**
 * The display width of `input` in terminal columns: graphemes, wide East Asian characters and emoji count two,
 * combining marks, control characters and ANSI escapes count none.
 *
 * @internal
 */
export const displayWidth = (input: string): number => {
	let width = 0;
	for (const { segment } of segmenter.segment(stripAnsi(input))) {
		if (ZERO2.test(segment)) continue;
		width += EMOJI.test(segment) || /^\p{RI}{2}/u.test(segment) || WIDE2.test(Array.from(segment)[0] ?? "") ? 2 : 1;
	}
	return width;
};

/**
 * The grapheme clusters of `input`, in order; a cluster is never split.
 *
 * @internal
 */
export const graphemes = (input: string): ReadonlyArray<string> =>
	Array.from(segmenter.segment(input), (s) => s.segment);
