/**
 * Shared time, duration, and text-bounding helpers for repo-cli command
 * adapters. These reproduce the byte-copied `timestampIso` / `durationMsSince`
 * / `errorMessage` trio in the docgen quality workers and the duplicated
 * `todayYmd` / `boundedText` / `firstLine` helpers across lint and laws
 * commands.
 *
 * **Details**
 *
 * No existing `@beep/utils` or `@beep/repo-utils` export covered these: the
 * closest match is the `P.hasProperty("message")` refinement chain, which
 * {@link errorMessage} composes but does not replace (it adds the
 * caller-supplied fallback).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { P, Str } from "@beep/utils";
import { DateTime } from "effect";
import { dual } from "effect/Function";

/**
 * Current wall-clock instant formatted as an ISO-8601 string.
 *
 * **Example** (ISO string ends with Z)
 *
 * ```ts
 * import { timestampIso } from "@beep/repo-cli/internal/cli/Timing"
 *
 * console.log(timestampIso().endsWith("Z"))
 * ```
 *
 * @category time
 * @since 0.0.0
 */
export const timestampIso = (): string => DateTime.formatIso(DateTime.nowUnsafe());

/**
 * Milliseconds elapsed since a high-resolution start mark, floored at zero.
 *
 * **Example** (Non-negative elapsed milliseconds)
 *
 * ```ts
 * import { durationMsSince } from "@beep/repo-cli/internal/cli/Timing"
 *
 * console.log(durationMsSince(globalThis.performance.now()) >= 0)
 * ```
 *
 * @param startedAtMs - A prior `globalThis.performance.now()` reading.
 * @returns The non-negative rounded elapsed milliseconds.
 * @category time
 * @since 0.0.0
 */
export const durationMsSince = (startedAtMs: number): number =>
  Math.max(0, Math.round(globalThis.performance.now() - startedAtMs));

/**
 * Today's UTC date rendered as a zero-padded `YYYY-MM-DD` string.
 *
 * **Example** (YYYY-MM-DD string length)
 *
 * ```ts
 * import { todayYmd } from "@beep/repo-cli/internal/cli/Timing"
 *
 * console.log(todayYmd().length)
 * ```
 *
 * @category time
 * @since 0.0.0
 */
export const todayYmd = (): string => {
  const now = DateTime.nowUnsafe();
  const year = `${DateTime.getPartUtc(now, "year")}`;
  const month = Str.padStart(2, "0")(`${DateTime.getPartUtc(now, "month")}`);
  const day = Str.padStart(2, "0")(`${DateTime.getPartUtc(now, "day")}`);
  return `${year}-${month}-${day}`;
};

/**
 * First physical line of a multi-line value, trimmed of surrounding whitespace.
 *
 * **Example** (Trimmed first line extraction)
 *
 * ```ts
 * import { firstLine } from "@beep/repo-cli/internal/cli/Timing"
 *
 * console.log(firstLine("  export const x = 1\nconst y = 2"))
 * ```
 *
 * @param value - The text whose first line is extracted.
 * @returns The trimmed first line, or the trimmed whole value when unsplit.
 * @category text
 * @since 0.0.0
 */
export const firstLine = (value: string): string => {
  const [line] = Str.split(/\r?\n/)(value);
  return Str.trim(line ?? value);
};

/**
 * Truncate text to a maximum length, appending an ellipsis when it overflows.
 *
 * **Example** (Truncate text with ellipsis)
 *
 * ```ts
 * import { boundedText } from "@beep/repo-cli/internal/cli/Timing"
 *
 * console.log(boundedText("abcdefghij", 6))
 * console.log(boundedText(6)("abcdefghij"))
 * ```
 *
 * @param value - The text to bound.
 * @param maxLength - The inclusive maximum output length.
 * @returns The original value when within bounds, otherwise an ellipsized slice.
 * @category text
 * @since 0.0.0
 */
export const boundedText: {
  (value: string, maxLength: number): string;
  (maxLength: number): (value: string) => string;
} = dual(2, (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${Str.slice(0, maxLength - 3)(value)}...`
);

/**
 * Extract a human-readable message from an unknown error, falling back to a
 * caller-supplied default when no `message` string is present.
 *
 * **Example** (Error message with fallback)
 *
 * ```ts
 * import { errorMessage } from "@beep/repo-cli/internal/cli/Timing"
 *
 * console.log(errorMessage(new Error("boom"), "Unknown failure."))
 * console.log(errorMessage("Unknown failure.")(42))
 * ```
 *
 * @param error - The caught unknown value.
 * @param fallback - The message used when `error` has no string `message`.
 * @returns The error's `message` when available, otherwise `fallback`.
 * @category errors
 * @since 0.0.0
 */
export const errorMessage: {
  (error: unknown, fallback: string): string;
  (fallback: string): (error: unknown) => string;
} = dual(2, (error: unknown, fallback: string): string =>
  P.isObject(error) && P.hasProperty(error, "message") && P.isString(error.message) ? error.message : fallback
);
