/**
 * Named scalar building blocks shared by the gate report schemas: counts,
 * durations, source positions and the opaque identifiers a report carries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";

const $I = $GateReportId.create("Scalars");

const isBetweenDateTime = S.makeIsBetween({ order: DateTime.Order });

/**
 * A non-negative whole count: tests collected, items failed, lines written.
 *
 * **Example** (Check a count)
 *
 * ```ts
 * import { Count } from "@beep/gate-report/Scalars";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Count)(3)); // true
 * console.log(S.is(Count)(-1)); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Count = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("Count", {
    description: "A non-negative whole count of items, units, lines or bytes.",
  })
);

/**
 * Type of {@link Count}.
 *
 * @category models
 * @since 0.0.0
 */
export type Count = typeof Count.Type;

/**
 * A non-negative, finite duration in milliseconds.
 *
 * **Example** (Check a duration)
 *
 * ```ts
 * import { DurationMs } from "@beep/gate-report/Scalars";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(DurationMs)(12.5)); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DurationMs = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("DurationMs", {
    description: "A non-negative, finite duration in milliseconds.",
  })
);

/**
 * Type of {@link DurationMs}.
 *
 * @category models
 * @since 0.0.0
 */
export type DurationMs = typeof DurationMs.Type;

/**
 * A one-based line or column number in a source file.
 *
 * **Example** (Check a line number)
 *
 * ```ts
 * import { Position } from "@beep/gate-report/Scalars";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Position)(1)); // true
 * console.log(S.is(Position)(0)); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Position = S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(
  $I.annoteSchema("Position", {
    description: "A one-based line or column number in a source file.",
  })
);

/**
 * Type of {@link Position}.
 *
 * @category models
 * @since 0.0.0
 */
export type Position = typeof Position.Type;

/**
 * A non-empty text value: a gate name, a subject, a unit id, a run id.
 *
 * **Example** (Check a non-empty text)
 *
 * ```ts
 * import { Text } from "@beep/gate-report/Scalars";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Text)("test")); // true
 * console.log(S.is(Text)("")); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Text = S.NonEmptyString.pipe(
  $I.annoteSchema("Text", {
    description: "A non-empty text value naming a gate, a subject, a unit or a run.",
  })
);

/**
 * Type of {@link Text}.
 *
 * @category models
 * @since 0.0.0
 */
export type Text = typeof Text.Type;

/**
 * An ISO-8601 instant with a `Z` or numeric offset, decoded to a UTC date-time.
 *
 * **Details**
 *
 * The encoded side must match the ISO-8601 instant pattern before the date
 * parser sees it, so a locale date string such as `Mon Jan 01 2026` is
 * rejected even though the JavaScript parser accepts it. The decoded instant
 * lies between 1970 and 9999, the range a four-digit year holds.
 *
 * **Example** (Check an instant)
 *
 * ```ts
 * import { IsoInstant } from "@beep/gate-report/Scalars";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(S.toEncoded(IsoInstant))("2026-11-19T10:00:00.000Z")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IsoInstant = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u, {
    description: "An ISO-8601 instant, the shape Date.prototype.toISOString produces.",
    message: "Expected an ISO-8601 instant, e.g. 2026-09-07T23:45:57.308Z.",
  })
).pipe(
  S.decodeTo(
    S.DateTimeUtcFromString.check(
      isBetweenDateTime(
        { minimum: DateTime.makeUnsafe(0), maximum: DateTime.makeUnsafe(253_402_300_799_999) },
        {
          identifier: "IsoInstantRange",
          title: "ISO Instant Range",
          description: "An instant between 1970-01-01 and 9999-12-31, the range a four-digit ISO year holds.",
        }
      )
    )
  ),
  $I.annoteSchema("IsoInstant", {
    description: "An ISO-8601 instant with a Z or numeric offset, decoded to a UTC date-time.",
  })
);

/**
 * Type of {@link IsoInstant}.
 *
 * @category models
 * @since 0.0.0
 */
export type IsoInstant = typeof IsoInstant.Type;
