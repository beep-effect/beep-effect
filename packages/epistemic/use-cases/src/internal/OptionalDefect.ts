/**
 * Optional defect cause field shared by the epistemic use-case errors.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

/**
 * Optional `cause` field carrying a defect with its stack.
 *
 * **Details**
 *
 * A missing key decodes to `None`, and the defect never takes part in the
 * owning error's equivalence: `S.overrideToEquivalence` makes any two causes
 * equal, so `S.toEquivalence(ErrorClass)` compares the declared diagnostic
 * fields only.
 *
 * **Example** (Declare an optional cause field)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * // The composition `optionalDefect` produces for a field:
 * const cause = S.OptionFromOptionalKey(
 *   S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(() => () => true))
 * )
 *   .pipe(S.withConstructorDefault(Effect.succeedNone))
 *   .annotateKey({ description: "Underlying driver defect." })
 * const Failure = S.Struct({ cause })
 * console.log(O.isNone(Failure.make({}).cause)) // true
 * ```
 *
 * @param description - Field description attached to the property key.
 * @returns The optional defect field schema.
 * @category schemas
 * @since 0.0.0
 */
export const optionalDefect = (description: string) =>
  S.OptionFromOptionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(() => () => true)))
    .pipe(S.withConstructorDefault(Effect.succeedNone))
    .annotateKey({
      description,
    });
