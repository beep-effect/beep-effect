/**
 * Structured date value objects: a citation date in both ISO string and parsed
 * component form, ported from the eyecite `ParsedDate` and `StructuredDate`
 * interfaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/StructuredDate/StructuredDate.model");

/**
 * **Details**
 *
 * A missing `month` or `day` decodes to `None`, so a bare-year citation date is
 * modeled as `{ year, month: None, day: None }`.
 *
 * **Example** (Year-month with missing day)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ParsedDate } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const parsed = ParsedDate.make({
 *   year: S.Natural.make(2023),
 *   month: S.Natural.makeOption(6),
 * })
 *
 * console.log(O.isSome(parsed.month)) // true
 * console.log(O.isNone(parsed.day)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParsedDate extends S.Opaque<ParsedDate, { readonly brand: unique symbol }>()(
  S.Struct({
    year: S.Natural.annotateKey({
      description: "Four-digit calendar year.",
    }),
    month: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Calendar month (1-12); absent for year-only dates.",
      })
    ),
    day: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Calendar day of month (1-31); absent for year-only or month-only dates.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ParsedDate", {
      description: "Structured date components with optional month and day for year-only dates.",
    })
  )
) {}

/**
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
 * **Details**
 *
 * Pairs an ISO 8601 `iso` string with its {@link ParsedDate} component
 * breakdown, so consumers can render the canonical string or branch on the
 * individual year/month/day components.
 *
 * **Example** (ISO with parsed components)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ParsedDate, StructuredDate } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const date = StructuredDate.make({
 *   iso: "2023-06",
 *   parsed: ParsedDate.make({
 *     year: S.Natural.make(2023),
 *     month: S.Natural.makeOption(6),
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
export class StructuredDate extends S.Opaque<StructuredDate, { readonly brand: unique symbol }>()(
  S.Struct({
    iso: S.String.annotateKey({
      description: "ISO 8601 format: YYYY-MM-DD, YYYY-MM, or YYYY.",
    }),
    parsed: ParsedDate.annotateKey({
      description: "Structured date components.",
    }),
  }).pipe(
    $I.annoteSchema("StructuredDate", {
      description: "Date in both ISO string and structured format.",
    })
  )
) {}

/**
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
