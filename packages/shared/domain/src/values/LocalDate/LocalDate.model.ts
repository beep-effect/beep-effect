/**
 * LocalDate value object model.
 *
 * Defines the schema-backed class used by the LocalDate behavior module. A
 * LocalDate stores only UTC calendar fields and deliberately carries no time
 * zone or clock-time component.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SharedDomainId } from "@beep/identity";
import { Str } from "@beep/utils";
import { DateTime, Hash } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { CalendarParts, isValidGregorianDate } from "./LocalDate.calendar.ts";

const $I = $SharedDomainId.create("values/LocalDate/LocalDate.model");

const LocalDateFields = S.Struct(CalendarParts.fields).check(
  S.makeFilter(isValidGregorianDate, {
    description: "LocalDate calendar fields must represent a real day in the selected month and year.",
    identifier: "LocalDateCalendarDay",
    message: "Invalid calendar date",
    title: "LocalDate calendar day",
  })
);

/**
 * Schema class representing a calendar date without time or timezone.
 *
 * **Details**
 *
 * Stores year, month, and day as integer fields and validates that the
 * selected day exists in the selected month and year.
 *
 * **Example** (Create and format date)
 *
 * ```ts
 * import { Model } from "@beep/shared-domain/values/LocalDate"
 *
 * const date = Model.make({ year: 2024, month: 6, day: 15 })
 *
 * console.log(date.toISOString()) // "2024-06-15"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Model extends S.Class<Model>($I`LocalDateModel`)(
  LocalDateFields,
  $I.annote("LocalDateModel", {
    description: "Schema class representing a calendar date without time or timezone.",
    documentation:
      "Stores year, month, and day as integer fields, validates real calendar days, and formats them as YYYY-MM-DD.",
  })
) {
  static readonly is = S.is(Model);

  /**
   * Format the date as an ISO 8601 local-date string.
   *
   * **Example** (Padded year ISO format)
   *
   * ```ts
   * import { Model } from "@beep/shared-domain/values/LocalDate"
   *
   * const date = Model.make({ year: 99, month: 2, day: 5 })
   *
   * console.log(date.toISOString()) // "0099-02-05"
   * ```
   *
   * @returns ISO 8601 local-date text in `YYYY-MM-DD` format.
   * @category utilities
   * @since 0.0.0
   */
  toISOString(): string {
    const year = Str.padStart(4, "0")(`${this.year}`);
    const month = Str.padStart(2, "0")(`${this.month}`);
    const day = Str.padStart(2, "0")(`${this.day}`);
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert the date to its canonical string representation.
   *
   * **Example** (Canonical string output)
   *
   * ```ts
   * import { Model } from "@beep/shared-domain/values/LocalDate"
   *
   * const date = Model.make({ year: 2024, month: 6, day: 15 })
   *
   * console.log(date.toString()) // "2024-06-15"
   * ```
   *
   * @returns ISO 8601 local-date text in `YYYY-MM-DD` format.
   * @category utilities
   * @since 0.0.0
   */
  override readonly toString = (): string => this.toISOString();

  /**
   * Compare two LocalDate values by calendar fields.
   *
   * **Example** (Compare equal LocalDates)
   *
   * ```ts
   * import { Equal } from "effect"
   * import { Model } from "@beep/shared-domain/values/LocalDate"
   *
   * const left = Model.make({ year: 2024, month: 6, day: 15 })
   * const right = Model.make({ year: 2024, month: 6, day: 15 })
   *
   * console.log(Equal.equals(left, right)) // true
   * ```
   *
   * @param that - Value to compare with this LocalDate.
   * @returns `true` when both dates have the same year, month, and day.
   * @category utilities
   * @since 0.0.0
   */
  [Eq.symbol](that: Eq.Equal): boolean {
    return Model.is(that) && ModelEquivalence(this, that);
  }

  /**
   * Compute a stable hash from the canonical ISO date string.
   *
   * **Example** (Hash matches ISO string)
   *
   * ```ts
   * import { Hash } from "effect"
   * import { Model } from "@beep/shared-domain/values/LocalDate"
   *
   * const date = Model.make({ year: 2024, month: 6, day: 15 })
   *
   * console.log(Hash.hash(date) === Hash.string("2024-06-15")) // true
   * ```
   *
   * @returns Stable hash code for the LocalDate.
   * @category utilities
   * @since 0.0.0
   */
  [Hash.symbol](): number {
    return Hash.string(this.toISOString());
  }

  /**
   * Convert the date to an Effect `DateTime.Utc` at midnight UTC.
   *
   * **Example** (Midnight UTC DateTime)
   *
   * ```ts
   * import * as DateTime from "effect/DateTime"
   * import { Model } from "@beep/shared-domain/values/LocalDate"
   *
   * const date = Model.make({ year: 2024, month: 6, day: 15 })
   * const parts = DateTime.toPartsUtc(date.toDateTime())
   *
   * console.log(parts.hour) // 0
   * ```
   *
   * @returns Effect `DateTime.Utc` for midnight at the start of the date.
   * @category utilities
   * @since 0.0.0
   */
  toDateTime(): DateTime.Utc {
    return DateTime.makeUnsafe({
      year: this.year,
      month: this.month,
      day: this.day,
    });
  }

  /**
   * Convert the date to a JavaScript `Date` at midnight UTC.
   *
   * **Example** (Midnight UTC JavaScript Date)
   *
   * ```ts
   * import { Model } from "@beep/shared-domain/values/LocalDate"
   *
   * const date = Model.make({ year: 2024, month: 6, day: 15 })
   *
   * console.log(date.toDate().toISOString()) // "2024-06-15T00:00:00.000Z"
   * ```
   *
   * @returns JavaScript `Date` for midnight at the start of the LocalDate.
   * @category utilities
   * @since 0.0.0
   */
  readonly toDate = (): Date => DateTime.toDateUtc(this.toDateTime());
}

const ModelEquivalence = S.toEquivalence(Model);
