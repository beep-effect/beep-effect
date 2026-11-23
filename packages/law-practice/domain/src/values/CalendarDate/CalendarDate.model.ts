/**
 * Calendar date value object: a day that exists in its month, encoded as an
 * ISO date string.
 *
 * **Details**
 *
 * `@beep/schema/LocalDate`'s `LocalDateFromString` encodes a `LocalDate` as
 * its ISO date string, the way docket-intake writes calendar dates. Its
 * decoder rejects a day the month does not have, but `LocalDate` itself only
 * range-checks the day, so a constructed or generated `LocalDate` can name
 * February 31. This composition adds that check on the decoded side too, so
 * every value it accepts encodes and decodes back to itself.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { daysInMonth, LocalDateFromString } from "@beep/schema/LocalDate";
import * as S from "effect/Schema";
import type { LocalDate } from "@beep/schema/LocalDate";

const $I = $LawPracticeDomainId.create("values/CalendarDate/CalendarDate.model");

/**
 * **Details**
 *
 * The decoded value is a `LocalDate`. Decoding and construction both reject a
 * day past the end of its month, such as `2026-02-30`, so values generated
 * from this schema round-trip through its encoding.
 *
 * **Example** (Decode a calendar date)
 *
 * ```ts
 * import { CalendarDate } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownExit(CalendarDate)("2026-11-02")._tag) // "Success"
 * console.log(S.decodeUnknownExit(CalendarDate)("2026-02-30")._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CalendarDate = LocalDateFromString.check(
  S.makeFilter(
    (date: LocalDate) => date.day <= daysInMonth(date.year, date.month),
    $I.annote("CalendarDateDayInMonthCheck", {
      title: "Day exists in its month",
      description: "The day of the month exists in that month and year, so February 30 is rejected.",
      message: "Expected a calendar date whose day exists in its month.",
    })
  )
).pipe(
  $I.annoteSchema("CalendarDate", {
    description: "A day that exists in its month, encoded as an ISO date string (YYYY-MM-DD).",
  })
);

/**
 * Decoded type of {@link CalendarDate}: a `LocalDate`.
 *
 * @category models
 * @since 0.0.0
 */
export type CalendarDate = typeof CalendarDate.Type;
