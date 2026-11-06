/** Shared annotation allocation authority; no caller-context substitution.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationSafetyLimitExceeded, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
/** Capture the required enclosing budget and translate its refusal once.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationAnnotationReservation = Effect.gen(function* () {
  const budget = yield* CitationTextBudget;
  return (units: number) =>
    budget
      .reserve(units)
      .pipe(
        Effect.mapError((error) => CitationSafetyLimitExceeded.make({ operation: "annotate", limit: error.limit }))
      );
});
