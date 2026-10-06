/**
 * Which day the service owes a digest for.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { addDays, isBefore } from "@beep/schema/LocalDate";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import type { LocalDate } from "@beep/schema/LocalDate";

/**
 * The day to write a digest for, if one is owed: yesterday, unless a digest
 * has already been written for yesterday or a later day.
 *
 * **Example** (Yesterday is due when nothing is digested)
 *
 * ```ts
 * import { digestDayDue } from "../../src/Digest.ts"
 * import { LocalDate } from "@beep/schema/LocalDate"
 * import * as O from "effect/Option"
 *
 * console.log(digestDayDue(LocalDate.make({ year: 2030, month: 1, day: 10 }), O.none()))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const digestDayDue: {
  (digestedThrough: O.Option<LocalDate>): (today: LocalDate) => O.Option<LocalDate>;
  (today: LocalDate, digestedThrough: O.Option<LocalDate>): O.Option<LocalDate>;
} = dual(2, (today: LocalDate, digestedThrough: O.Option<LocalDate>): O.Option<LocalDate> => {
  const yesterday = addDays(today, -1);
  return O.exists(digestedThrough, (day) => !isBefore(day, yesterday)) ? O.none() : O.some(yesterday);
});
