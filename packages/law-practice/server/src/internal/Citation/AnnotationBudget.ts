/** Shared annotation allocation authority; no caller-context substitution.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationSafetyLimitExceeded, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationPythonUnicodeFailure } from "./PythonUnicode.ts";
/** Capture the required enclosing budget and translate its refusal once.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationAnnotationReservation = Effect.gen(function* () {
  const budget = yield* CitationTextBudget;
  return (units: number) => budget.reserve(units).pipe(Effect.mapError(citationAnnotationSafety));
});

/** Identify the same enclosing/stage minimum used by native Unicode timers.
 * @internal @category operations @since 0.0.0
 */
const citationAnnotationDeadlineLimit = (limits: CitationEngineLimits): CitationSafetyLimitExceeded["limit"] =>
  Duration.isLessThanOrEqualTo(limits.operationDeadline, limits.annotateDeadline)
    ? "operationDeadline"
    : "annotateDeadline";

/** Preserve a closed native failure while identifying the actual limiting clock.
 * @internal @category operations @since 0.0.0
 */
export const failCitationAnnotationUnicode = Effect.fn("Citation.failAnnotationUnicode")(function* <E>(
  limits: CitationEngineLimits,
  invalid: () => E,
  error: CitationPythonUnicodeFailure
) {
  return yield* Effect.fail(
    error.reason === "invalid-input"
      ? invalid()
      : CitationSafetyLimitExceeded.make({
          operation: "annotate",
          limit: error.reason === "deadline-exceeded" ? citationAnnotationDeadlineLimit(limits) : "producedTextUtf16",
        })
  );
});

/** Translate a shared producer/budget refusal to its enclosing annotation.
 * @internal @category errors @since 0.0.0
 */
export const citationAnnotationSafety = (error: CitationSafetyLimitExceeded): CitationSafetyLimitExceeded =>
  CitationSafetyLimitExceeded.make({ operation: "annotate", limit: error.limit });
