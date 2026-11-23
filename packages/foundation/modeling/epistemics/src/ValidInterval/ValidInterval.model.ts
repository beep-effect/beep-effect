/**
 * Half-open valid-time interval `[validFrom, validTo)`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import * as DateTime from "effect/DateTime";
import { constTrue } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $EpistemicsId.create("ValidInterval/ValidInterval.model");

/**
 * Field set of {@link ValidInterval}, for entities that store the interval as
 * flat columns.
 *
 * **Details**
 *
 * Both bounds encode as epoch milliseconds. The open upper bound is
 * `Option.none`, encoded as `null`; there is no sentinel date. Spread or pipe
 * the fields into an entity to keep its encoded columns flat.
 *
 * **Example** (Compose valid-time fields into a struct)
 *
 * ```ts
 * import { ValidIntervalFields } from "@beep/epistemics/ValidInterval"
 * import * as S from "effect/Schema"
 *
 * const Row = S.Struct({ ...ValidIntervalFields, name: S.String })
 * const row = S.decodeUnknownSync(Row)({ name: "fact", validFrom: 1_000, validTo: null })
 * console.log(row.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidIntervalFields = {
  validFrom: S.DateTimeUtcFromMillis.annotateKey({
    description: "Inclusive valid-time lower bound: when the fact started being true.",
  }),
  validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr).annotateKey({
    description: "Exclusive valid-time upper bound; absent while the fact is still held true.",
  }),
};

/**
 * Rejects an empty or inverted interval: when `validTo` is present it must be
 * later than `validFrom`. A flat entity spreading the field set does not get this
 * check, so its encoded columns are unchanged.
 *
 * **Example** (Reject an inverted interval)
 *
 * ```ts
 * import { ValidInterval } from "@beep/epistemics/ValidInterval"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(ValidInterval)({ validFrom: 200, validTo: 100 })
 * console.log(Result.isFailure(decoded)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ValidIntervalOrderCheck = S.makeFilter(
  ({ validFrom, validTo }: { readonly validFrom: DateTime.Utc; readonly validTo: O.Option<DateTime.Utc> }) =>
    O.match(validTo, { onNone: constTrue, onSome: (upper) => DateTime.isLessThan(validFrom, upper) }),
  $I.annote("ValidIntervalOrderCheck", {
    description: "Valid-time order: validTo, when present, is later than validFrom.",
    message: "Expected validFrom to be earlier than validTo when validTo is present.",
  })
);

/**
 * Half-open valid-time interval `[validFrom, validTo)`: when a fact holds in
 * the world, independent of when it was recorded.
 *
 * **Example** (Decode an open valid-time interval)
 *
 * ```ts
 * import { ValidInterval } from "@beep/epistemics/ValidInterval"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const interval = S.decodeUnknownSync(ValidInterval)({ validFrom: 1_000, validTo: null })
 * console.log(O.isNone(interval.validTo)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidInterval = S.Struct(ValidIntervalFields)
  .check(ValidIntervalOrderCheck)
  .pipe(
    $I.annoteSchema("ValidInterval", {
      description: "Half-open valid-time interval [validFrom, validTo) with an optional open upper bound.",
    })
  );

/**
 * **Example** (Type a valid-time interval)
 *
 * ```ts
 * import type { ValidInterval } from "@beep/epistemics/ValidInterval"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const interval: ValidInterval = {
 *   validFrom: DateTime.makeUnsafe(1_000),
 *   validTo: O.none()
 * }
 * console.log(interval.validFrom)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ValidInterval = typeof ValidInterval.Type;
