import * as A from "effect/Array";
import * as Str from "effect/String";

// A short display-width implementation checked against `string-width` by a differential test. It embeds a hand-kept East Asian Width table that will drift from Unicode, and
// `__test__/displayWidth.oracle.test.ts` is what catches the drift.

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const ANSI = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B\[[0-?]*[ -/]*[@-~]/g;
// RGI_Emoji is a property of strings, which only the `v` flag (ES2024) reads; the runtime target, ES2025, has it.
// The repo's docgen compiles examples at ES2022, and TypeScript rejects a `v` flag it can see below ES2024, in a
// literal or a literal constructor argument, so the flag is a `string` and every package whose examples reach this
// module through its source still compiles.
const UNICODE_SETS: string = "v";
const EMOJI = new RegExp("^\\p{RGI_Emoji}$", UNICODE_SETS);

const WIDE2 =
  /^[\p{Emoji_Presentation}\u1100-\u115E\u2329\u232A\u2630-\u2637\u268A-\u268F\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u303E\u3041-\u3096\u3099-\u30FF\u3105-\u312F\u3131-\u3163\u3165-\u318E\u3190-\u31E5\u31EF-\u321E\u3220-\u3247\u3250-\u4DBF\u4DC0-\uA48C\uA490-\uA4C6\uA960-\uA97C\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE66\uFE68-\uFE6B\uFF01-\uFF60\uFFE0-\uFFE6\u{16FE0}-\u{16FF6}\u{17000}-\u{191FF}\u{1AFF0}-\u{1AFFF}\u{1B000}-\u{1B2FF}\u{1D300}-\u{1D376}\u{1F200}-\u{1F265}\u{20000}-\u{3FFFD}]/u;
const ZERO2 = /^[\p{Mn}\p{Me}\p{Cf}\p{Cc}\u115F\u1160\u3164\uFFA0]+$/u;
// Spacing prepended concatenation marks (ARABIC NUMBER SIGN and kin) are visible signs that lead the next glyph's
// grapheme: one column each, unless that glyph is wide and takes them into its own cell. The zero-width U+070F
// SYRIAC ABBREVIATION MARK is not one of them. Matches string-width 9.
const PREPENDED_MARKS = /^[\u0600-\u0605\u06DD\u0890\u0891\u08E2\u{110BD}\u{110CD}]+/u;

const glyphWidth = (glyph: string): number =>
  Str.isEmpty(glyph) || ZERO2.test(glyph)
    ? 0
    : EMOJI.test(glyph) || /^\p{RI}{2}/u.test(glyph) || WIDE2.test(glyph)
      ? 2
      : 1;

/**
 * The text without its ANSI escape sequences: CSI (including SGR colour) and OSC (including OSC-8 hyperlinks).
 *
 * **Example** (Remove a painted foreground)
 *
 * ```ts
 * import { stripAnsi } from "@beep/cli-kit/internal/displayWidth"
 *
 * console.log(stripAnsi("\u001b[31mready\u001b[39m")) // ready
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const stripAnsi = (input: string): string => Str.replace(ANSI, "")(input);

/**
 * The display width of `input` in terminal columns: graphemes, wide East Asian characters and emoji count two,
 * combining marks, control characters and ANSI escapes count none, and a prepended concatenation mark such as
 * ARABIC NUMBER SIGN counts one unless a wide glyph follows it.
 *
 * **Example** (Measure wide and combining characters)
 *
 * ```ts
 * import { displayWidth } from "@beep/cli-kit/internal/displayWidth"
 *
 * console.log(displayWidth("界e\u0301")) // 3
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const displayWidth = (input: string): number => {
  let width = 0;
  for (const { segment } of segmenter.segment(stripAnsi(input))) {
    const marks = PREPENDED_MARKS.exec(segment)?.[0] ?? "";
    const glyph = glyphWidth(Str.slice(marks.length)(segment));
    width += glyph === 2 ? 2 : A.length(A.fromIterable(marks)) + glyph;
  }
  return width;
};

/**
 * The grapheme clusters of `input`, in order; a cluster is never split.
 *
 * **Example** (Keep a combining sequence together)
 *
 * ```ts
 * import { graphemes } from "@beep/cli-kit/internal/displayWidth"
 *
 * console.log(JSON.stringify(graphemes("e\u0301x"))) // ["é","x"]
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const graphemes = (input: string): ReadonlyArray<string> =>
  A.map(A.fromIterable(segmenter.segment(input)), (s) => s.segment);
