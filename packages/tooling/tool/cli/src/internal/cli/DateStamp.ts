/**
 * Shared date-stamp helpers for repo-cli command adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DateTime } from "effect";
import * as Str from "effect/String";

/**
 * Today's date in the local timezone as a `YYYY-MM-DD` string.
 *
 * @returns Today's date formatted as `YYYY-MM-DD`.
 * @example
 * ```ts
 * import { todayYmd } from "@beep/repo-cli/internal/cli/DateStamp"
 *
 * console.log(/^\d{4}-\d{2}-\d{2}$/.test(todayYmd()))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const todayYmd = (): string => {
  const now = DateTime.nowUnsafe();
  const year = `${DateTime.getPartUtc(now, "year")}`;
  const month = Str.padStart(2, "0")(`${DateTime.getPartUtc(now, "month")}`);
  const day = Str.padStart(2, "0")(`${DateTime.getPartUtc(now, "day")}`);
  return `${year}-${month}-${day}`;
};
