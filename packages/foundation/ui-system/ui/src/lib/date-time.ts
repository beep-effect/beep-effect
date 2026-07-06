/**
 * Date-time presentation helpers for UI components.
 *
 * @example
 * ```ts
 * import { formatShortDate, toUtcDateTime } from "@beep/ui/lib/date-time"
 *
 * const dateTime = toUtcDateTime("2024-01-02T00:00:00.000Z")
 * console.log(formatShortDate(dateTime))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 * @packageDocumentation
 */

import { DateTime, flow } from "effect";

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/**
 * Parse a date-like UI value into a UTC `DateTime`.
 *
 * @example
 * ```ts
 * import { toUtcDateTime } from "@beep/ui/lib/date-time"
 *
 * console.log(toUtcDateTime("2024-01-02T00:00:00.000Z")._tag)
 * ```
 *
 * @category utilities
 * @param value - JavaScript date or date string accepted by Effect `DateTime`.
 * @returns The value normalized to UTC.
 * @since 0.0.0
 */
export const toUtcDateTime: (value: Date | string) => DateTime.Utc = flow(DateTime.makeUnsafe, DateTime.toUtc);

/**
 * Format a UTC date-time as a short month/day label.
 *
 * @example
 * ```ts
 * import { formatShortDate, toUtcDateTime } from "@beep/ui/lib/date-time"
 *
 * console.log(formatShortDate(toUtcDateTime("2024-01-02T00:00:00.000Z")))
 * ```
 *
 * @category utilities
 * @param dateTime - UTC date-time to format.
 * @returns Short month/day display text.
 * @since 0.0.0
 */
export const formatShortDate = (dateTime: DateTime.Utc): string =>
  shortDateFormatter.format(DateTime.toEpochMillis(dateTime));
