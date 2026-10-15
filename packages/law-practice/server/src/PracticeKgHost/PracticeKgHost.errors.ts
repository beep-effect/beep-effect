/**
 * Typed failures for opening a portable practice KG bundle in a host process.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("PracticeKgHost/PracticeKgHost.errors");

/**
 * Sanitized startup failure while resolving a portable practice KG bundle.
 *
 * **Details**
 *
 * `message` is the stable operator-facing sentence every host prints; `cause`
 * keeps the underlying driver or filesystem error and is ignored by the
 * declared equivalence.
 *
 * **Example** (Recover the operator message)
 *
 * ```ts
 * import { PracticeKgHostError } from "@beep/law-practice-server/PracticeKgHost"
 * import * as Effect from "effect/Effect"
 *
 * const recovered = PracticeKgHostError.make({ message: "Bundle directory is required." }).pipe(
 *   Effect.catchTag("PracticeKgHostError", (error) => Effect.succeed(error.message))
 * )
 *
 * Effect.runPromise(recovered).then(console.log)
 * // "Bundle directory is required."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgHostError extends S.TaggedError<PracticeKgHostError, { readonly brand: unique symbol }>(
  $I`PracticeKgHostError`
)(
  "PracticeKgHostError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString,
  },
  $I.annoteError<PracticeKgHostError>("PracticeKgHostError", {
    description: "Sanitized startup failure while resolving a portable practice KG bundle.",
  })
) {}
