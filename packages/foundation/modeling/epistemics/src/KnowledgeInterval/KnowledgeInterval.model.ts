/**
 * Half-open transaction-time interval `[recordedAt, expiredAt)`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import * as DateTime from "effect/DateTime";
import { constTrue } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $EpistemicsId.create("KnowledgeInterval/KnowledgeInterval.model");

/**
 * Field set of {@link KnowledgeInterval}, for entities that store the interval
 * as flat columns.
 *
 * **Details**
 *
 * Both bounds encode as epoch milliseconds. The open upper bound is
 * `Option.none`, encoded as `null`; there is no sentinel date. Spread or pipe
 * the fields into an entity to keep its encoded columns flat.
 *
 * **Example** (Compose transaction-time fields into a struct)
 *
 * ```ts
 * import { KnowledgeIntervalFields } from "@beep/epistemics/KnowledgeInterval"
 * import * as S from "effect/Schema"
 *
 * const Row = S.Struct({ ...KnowledgeIntervalFields, name: S.String })
 * const row = S.decodeUnknownSync(Row)({ expiredAt: null, name: "fact", recordedAt: 1_000 })
 * console.log(row.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KnowledgeIntervalFields = {
  expiredAt: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr).annotateKey({
    description: "Exclusive transaction-time upper bound; absent while the row is the current record.",
  }),
  recordedAt: S.DateTimeUtcFromMillis.annotateKey({
    description: "Inclusive transaction-time lower bound: when this row became known.",
  }),
};

/**
 * Rejects an empty or inverted interval: when `expiredAt` is present it must be
 * later than `recordedAt`. A flat entity spreading the field set does not get this
 * check, so its encoded columns are unchanged.
 *
 * **Example** (Reject an inverted interval)
 *
 * ```ts
 * import { KnowledgeInterval } from "@beep/epistemics/KnowledgeInterval"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(KnowledgeInterval)({ recordedAt: 200, expiredAt: 100 })
 * console.log(Result.isFailure(decoded)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const KnowledgeIntervalOrderCheck = S.makeFilter(
  ({ recordedAt, expiredAt }: { readonly recordedAt: DateTime.Utc; readonly expiredAt: O.Option<DateTime.Utc> }) =>
    O.match(expiredAt, { onNone: constTrue, onSome: (upper) => DateTime.isLessThan(recordedAt, upper) }),
  $I.annote("KnowledgeIntervalOrderCheck", {
    description: "Knowledge-time order: expiredAt, when present, is later than recordedAt.",
    message: "Expected recordedAt to be earlier than expiredAt when expiredAt is present.",
  })
);

/**
 * Half-open transaction-time interval `[recordedAt, expiredAt)`: when a record
 * was the system's current belief, independent of when its fact held.
 *
 * **Example** (Decode a current knowledge interval)
 *
 * ```ts
 * import { KnowledgeInterval } from "@beep/epistemics/KnowledgeInterval"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const interval = S.decodeUnknownSync(KnowledgeInterval)({ expiredAt: null, recordedAt: 1_000 })
 * console.log(O.isNone(interval.expiredAt)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KnowledgeInterval = S.Struct(KnowledgeIntervalFields)
  .check(KnowledgeIntervalOrderCheck)
  .pipe(
    $I.annoteSchema("KnowledgeInterval", {
      description: "Half-open transaction-time interval [recordedAt, expiredAt) with an optional open upper bound.",
    })
  );

/**
 * **Example** (Type a knowledge interval)
 *
 * ```ts
 * import type { KnowledgeInterval } from "@beep/epistemics/KnowledgeInterval"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const interval: KnowledgeInterval = {
 *   expiredAt: O.none(),
 *   recordedAt: DateTime.makeUnsafe(1_000)
 * }
 * console.log(interval.recordedAt)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeInterval = typeof KnowledgeInterval.Type;
