/**
 * Structured date value objects: a citation date in both ISO string and parsed
 * component form, ported from the eyecite `ParsedDate` and `StructuredDate`
 * interfaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/StructuredDate/StructuredDate.model");

/**
 * Structured date components. Month and day are optional to support year-only
 * dates.
 *
 * **Details**
 *
 * A missing `month` or `day` decodes to `None`, so a bare-year citation date is
 * modeled as `{ year, month: None, day: None }`.
 *
 * **Example** (Year-month with missing day)
 *
 * ```ts
 * import { ParsedDate } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const parsed = ParsedDate.make({
 *   year: NonNegativeInt.make(2023),
 *   month: O.some(NonNegativeInt.make(6)),
 * })
 *
 * console.log(O.isSome(parsed.month)) // true
 * console.log(O.isNone(parsed.day)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParsedDate extends S.Class<ParsedDate>($I`ParsedDate`)(
  {
    year: NonNegativeInt.annotateKey({
      description: "Four-digit calendar year.",
    }),
    month: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Calendar month (1-12); absent for year-only dates.",
      })
    ),
    day: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Calendar day of month (1-31); absent for year-only or month-only dates.",
      })
    ),
  },
  $I.annote("ParsedDate", {
    description: "Structured date components with optional month and day for year-only dates.",
  })
) {}

/**
 * Companion namespace for `ParsedDate`.
 *
 * **Example** (Encoded type alias)
 *
 * ```ts
 * import type { ParsedDate } from "@beep/law-practice-domain"
 *
 * type ParsedDateWire = ParsedDate.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ParsedDate {
  /**
   * Wire-encoded representation of a decoded {@link ParsedDate}.
   *
   * **Example** (Wire type alias)
   *
   * ```ts
   * import type { ParsedDate } from "@beep/law-practice-domain"
   *
   * type Wire = ParsedDate.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ParsedDate.Encoded;
}

/**
 * Date in both ISO string and structured format.
 *
 * **Details**
 *
 * Pairs an ISO 8601 `iso` string with its {@link ParsedDate} component
 * breakdown, so consumers can render the canonical string or branch on the
 * individual year/month/day components.
 *
 * **Example** (ISO with parsed components)
 *
 * ```ts
 * import { ParsedDate, StructuredDate } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const date = StructuredDate.make({
 *   iso: "2023-06",
 *   parsed: ParsedDate.make({
 *     year: NonNegativeInt.make(2023),
 *     month: O.some(NonNegativeInt.make(6)),
 *   }),
 * })
 *
 * console.log(date.iso) // "2023-06"
 * console.log(date.parsed.year) // 2023
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StructuredDate extends S.Class<StructuredDate>($I`StructuredDate`)(
  {
    iso: S.String.annotateKey({
      description: "ISO 8601 format: YYYY-MM-DD, YYYY-MM, or YYYY.",
    }),
    parsed: ParsedDate.annotateKey({
      description: "Structured date components.",
    }),
  },
  $I.annote("StructuredDate", {
    description: "Date in both ISO string and structured format.",
  })
) {}

/**
 * Companion namespace for `StructuredDate`.
 *
 * **Example** (Encoded type alias)
 *
 * ```ts
 * import type { StructuredDate } from "@beep/law-practice-domain"
 *
 * type StructuredDateWire = StructuredDate.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StructuredDate {
  /**
   * Wire-encoded representation of a decoded {@link StructuredDate}.
   *
   * **Example** (Wire type alias)
   *
   * ```ts
   * import type { StructuredDate } from "@beep/law-practice-domain"
   *
   * type Wire = StructuredDate.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StructuredDate.Encoded;
}
