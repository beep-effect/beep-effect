// Line arithmetic shared by the formatter and the formatted modifier.
// Private implementation.

import { dual } from "effect/Function";
import * as Str from "effect/String";

const isLineBreakAt = (text: string, offset: number): boolean => {
  const ch = Str.substring(offset, offset + 1)(text);
  return ch === "\r" || ch === "\n";
};

/**
 * Widen `[start, end)` to whole lines: back to the start of the line holding
 * `start`, forward to the end of the line holding `end`.
 *
 * **Details**
 *
 * A line ends before a `\r` or `\n`; the returned end never includes the
 * line break. This is `jsonc-parser`'s reading of a format range and of the
 * span `withFormatting` reformats after an insertion or a removal.
 *
 * **Example** (Widen a span to its lines)
 *
 * ```ts
 * import { lineSpan } from "@beep/jsonc/internal/lines"
 *
 * console.log(lineSpan("a\nbcd\ne", 3, 4)) // [2, 5]
 * ```
 *
 * @param text - The source text.
 * @param start - The first offset of the span.
 * @param end - The offset just after the span.
 * @returns The widened `[start, end)` pair.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const lineSpan: {
  (text: string, start: number, end: number): readonly [number, number];
  (start: number, end: number): (text: string) => readonly [number, number];
} = dual(3, (text: string, start: number, end: number): readonly [number, number] => {
  let from = start;
  while (from > 0 && !isLineBreakAt(text, from - 1)) {
    from--;
  }
  let to = end;
  while (to < text.length && !isLineBreakAt(text, to)) {
    to++;
  }
  return [from, to];
});
