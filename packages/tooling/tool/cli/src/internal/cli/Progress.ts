/**
 * Shared TTY-gated single-line progress-bar primitives for repo-cli command
 * adapters.
 *
 * **Details**
 *
 * The Files and Image command groups each carry a parallel progress
 * implementation whose formats diverge (bracket glyphs, colouring, and whether
 * the fill fraction comes from a completed/total count or an FFmpeg percent).
 * {@link renderProgressBar} renders the shared fill/empty segment core and
 * parameterises the divergences; each adapter keeps its own surrounding
 * template ({@link https://en.wikipedia.org/wiki/ANSI_escape_code ANSI}
 * prefix, brackets, count, and percent text) so current output is reproduced
 * exactly. {@link progressFraction} reproduces the Files count-based fill and
 * {@link progressPercent} its percent text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { identity, Str } from "@beep/utils";
import { dual } from "effect/Function";

/**
 * ANSI sequence that returns the cursor to column zero and clears the line.
 *
 * **Example** (Clear line string length)
 *
 * ```ts
 * import { clearLine } from "@beep/repo-cli/internal/cli/Progress"
 *
 * console.log(clearLine.length)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const clearLine = "\r\x1b[2K";

/**
 * True when live progress should render: caller opt-in and an attached TTY.
 *
 * **Example** (Disabled progress opt-in)
 *
 * ```ts
 * import { isProgressEnabled } from "@beep/repo-cli/internal/cli/Progress"
 *
 * console.log(isProgressEnabled(false))
 * ```
 *
 * @param enabled - Explicit caller opt-in; defaults to `true`.
 * @returns `true` when progress is enabled and stdout is a TTY.
 * @category predicates
 * @since 0.0.0
 */
export const isProgressEnabled = (enabled = true): boolean => enabled && process.stdout.isTTY === true;

/**
 * Fill fraction (`0`–`1`) for a completed/total count, treating a zero total as
 * complete.
 *
 * **Example** (Fraction from completed count)
 *
 * ```ts
 * import { progressFraction } from "@beep/repo-cli/internal/cli/Progress"
 *
 * console.log(progressFraction(1, 4))
 * console.log(progressFraction(4)(1))
 * ```
 *
 * @param completed - Completed unit count.
 * @param total - Total unit count.
 * @returns The clamped completion fraction.
 * @category math
 * @since 0.0.0
 */
export const progressFraction: {
  (completed: number, total: number): number;
  (total: number): (completed: number) => number;
} = dual(2, (completed: number, total: number): number => {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeCompleted = Math.min(Math.max(0, Math.floor(completed)), safeTotal);
  return safeTotal === 0 ? 1 : safeCompleted / safeTotal;
});

/**
 * Percent text for a completed/total count, fixed to one decimal place.
 *
 * **Example** (Percent from completed count)
 *
 * ```ts
 * import { progressPercent } from "@beep/repo-cli/internal/cli/Progress"
 *
 * console.log(progressPercent(1, 4))
 * console.log(progressPercent(4)(1))
 * ```
 *
 * @param completed - Completed unit count.
 * @param total - Total unit count.
 * @returns The percent string, treating a zero total as `"100.0"`.
 * @category math
 * @since 0.0.0
 */
export const progressPercent: {
  (completed: number, total: number): string;
  (total: number): (completed: number) => string;
} = dual(2, (completed: number, total: number): string =>
  total <= 0 ? "100.0" : ((completed / total) * 100).toFixed(1)
);

/**
 * Rendering options for {@link renderProgressBar}.
 *
 * @category models
 * @since 0.0.0
 */
export interface ProgressBarOptions {
  readonly colorEmpty?: (segment: string) => string;
  readonly colorFilled?: (segment: string) => string;
  readonly emptyChar?: string;
  readonly filledChar?: string;
  readonly fraction: number;
  readonly width: number;
}

/**
 * Render the fill/empty segment core of a single-line progress bar.
 *
 * **Details**
 *
 * `fraction` is clamped to the `[0, width]` fill range after rounding, so
 * callers pass their own fraction (count-based via {@link progressFraction},
 * or an FFmpeg percent divided by `100`). Segment colourisers default to the
 * identity function for uncoloured bars.
 *
 * **Example** (Half-filled bar segments)
 *
 * ```ts
 * import { renderProgressBar } from "@beep/repo-cli/internal/cli/Progress"
 *
 * console.log(renderProgressBar({ fraction: 0.5, width: 4 }))
 * ```
 *
 * @param options - The fill fraction, width, glyphs, and optional colourisers.
 * @returns The concatenated coloured fill and empty segments.
 * @category formatting
 * @since 0.0.0
 */
export const renderProgressBar = (options: ProgressBarOptions): string => {
  const { fraction, width, filledChar = "#", emptyChar = "-", colorFilled = identity, colorEmpty = identity } = options;
  const safeWidth = Math.max(1, Math.floor(width));
  const filled = Math.max(0, Math.min(safeWidth, Math.round(fraction * safeWidth)));
  const empty = safeWidth - filled;
  return `${colorFilled(Str.repeat(filled)(filledChar))}${colorEmpty(Str.repeat(empty)(emptyChar))}`;
};
