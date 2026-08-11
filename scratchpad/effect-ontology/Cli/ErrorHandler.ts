/**
 * CLI: Error Handler
 *
 * Provides consistent error formatting and handling for CLI commands.
 *
 * @since 2.0.0
 * @module Cli/ErrorHandler
 */

import { Cause, Console, Effect, Result } from "effect"

/**
 * Format a cause into a human-readable error message
 */
const formatCause = (cause: Cause.Cause<unknown>): string | null => {
  // Get the first failure
  const firstFailure = Cause.findError(cause)
  if (Result.isSuccess(firstFailure)) {
    const error = firstFailure.success
    if (error instanceof Error) {
      return `Error: ${error.message}`
    }
    if (typeof error === "object" && error !== null && "message" in error) {
      return `Error: ${(error as { message: string }).message}`
    }
    return `Error: ${String(error)}`
  }

  // Check for defects
  const firstDefect = Cause.findDefect(cause)
  if (Result.isSuccess(firstDefect)) {
    const defect = firstDefect.success
    if (defect instanceof Error) {
      return `Fatal: ${defect.message}`
    }
    return `Fatal: ${String(defect)}`
  }

  return Cause.pretty(cause)
}

/**
 * Wrap an effect with error handling for CLI output
 *
 * @param effect - The effect to wrap
 * @returns The effect with error handler attached
 */
export const withErrorHandler = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.tapCause((cause) =>
      Effect.gen(function*() {
        const formatted = formatCause(cause)
        if (formatted) {
          yield* Console.error(`\n${formatted}\n`)
        }
      })
    )
  )
