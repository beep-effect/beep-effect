/**
 * Error-boundary helpers for the Docgen command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect } from "effect";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";

/**
 * Reports a Docgen command error using the historical terminal prefix.
 *
 * **Example** (Report invalid package error)
 *
 * ```ts
 * import { reportDocgenCommandError } from "@beep/repo-cli/commands/Docgen/Docgen.errors"
 *
 * const program = reportDocgenCommandError({ message: "invalid package" })
 * console.log(program) // example value
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const reportDocgenCommandError = Effect.fn(function* (error: { readonly message: string }) {
  yield* Console.error(`docgen: ${error.message}`);
  return yield* failWithReportedExit(`docgen: ${error.message}`);
});
