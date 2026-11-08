/**
 * Optional defect `cause` field kept out of its owning error's identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { alwaysEquivalent } from "./toEquivalence.ts";

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
 * ```ts import.meta.vitest name="Leave the cause out of error identity"
 * import { optionalDefect } from "@beep/schema/SchemaUtils/optionalDefect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const Failure = S.Struct({ cause: optionalDefect("Underlying driver defect.") })
 * O.isNone(Failure.make({}).cause) // => true
 * ```
 *
 * @param description - Field description attached to the property key.
 * @returns The optional defect field schema.
 * @category utilities
 * @since 0.0.0
 */
export const optionalDefect = (description: string) =>
  S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
    .pipe(S.overrideToEquivalence(alwaysEquivalent), S.withConstructorDefault(Effect.succeedNone))
    .annotateKey({
      description,
    });
