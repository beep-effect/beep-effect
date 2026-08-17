/**
 * Formats Effect causes and reports CLI failures consistently.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Cause, Console, Effect, Inspectable, Result } from "effect";
import * as P from "effect/Predicate";

/**
 * Format a cause into a human-readable error message
 */
const formatCause = (cause: Cause.Cause<unknown>): string => {
  // Get the first failure
  const firstFailure = Cause.findError(cause);
  if (Result.isSuccess(firstFailure)) {
    const error = firstFailure.success;
    if (P.hasProperty(error, "message") && P.isString(error.message)) {
      return `Error: ${error.message}`;
    }
    return `Error: ${Inspectable.toStringUnknown(error)}`;
  }

  // Check for defects
  const firstDefect = Cause.findDefect(cause);
  if (Result.isSuccess(firstDefect)) {
    const defect = firstDefect.success;
    if (P.hasProperty(defect, "message") && P.isString(defect.message)) {
      return `Fatal: ${defect.message}`;
    }
    return `Fatal: ${Inspectable.toStringUnknown(defect)}`;
  }

  return Cause.pretty(cause);
};

/**
 * Wrap an effect with error handling for CLI output
 *
 * **Example** (Inspect with error handler)
 *
 * ```ts
 * import { withErrorHandler } from "@effect-ontology/Cli/ErrorHandler"
 *
 * console.log(withErrorHandler)
 * ```
 *
 * @param effect - The effect to wrap
 * @returns The effect with error handler attached
 * @category errors
 * @since 0.0.0
 */
export const withErrorHandler = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.tapCause(
      Effect.fn(function* (cause) {
        const formatted = formatCause(cause);
        yield* Console.error(`\n${formatted}\n`);
      })
    )
  );
