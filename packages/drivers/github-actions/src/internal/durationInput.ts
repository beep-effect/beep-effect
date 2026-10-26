// The schema for an option that takes an Effect `Duration.Input`, for the
// option bags whose time budget a caller spells however Effect accepts it.

import { $GithubActionsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type * as Duration from "effect/Duration";

const $I = $GithubActionsId.create("internal/durationInput");

// Finite counts only: an unbounded budget is spelled `Duration.infinity` or
// `"Infinity"`, never a bare non-finite number.
const DurationInputShape = S.Union([
  S.Duration,
  S.Finite,
  S.BigInt,
  S.String,
  S.Tuple([S.Finite, S.Finite]),
  S.Record(S.String, S.Finite),
]);

/**
 * An Effect `Duration.Input`, kept in the representation the caller wrote:
 * a `Duration`, a millisecond count, a bigint of nanoseconds, a `"5 seconds"`
 * string, an `[seconds, nanos]` pair or a unit record.
 *
 * **Example** (Accept a duration spelled as text)
 *
 * ```ts
 * import { DurationInput } from "@beep/github-actions/internal/durationInput";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(DurationInput)("150 millis")) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const DurationInput = S.declare<Duration.Input>((input): input is Duration.Input =>
  S.is(DurationInputShape)(input)
).pipe(
  $I.annoteSchema("DurationInput", {
    description: "An Effect Duration.Input, kept in the representation the caller wrote.",
  })
);
