/**
 * Error raised when a data-derived child-process argument is shaped like a
 * command-line option/flag and would otherwise be reinterpreted by the spawned
 * program instead of being consumed as a literal positional value.
 *
 * This is the rejection path of the CLI option-injection guard: callers that
 * cannot tolerate option-like data values use it to fail closed rather than
 * forwarding an attacker- or data-controlled `-`/`--`-prefixed token into a
 * subprocess argument vector.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("errors/OptionInjectionError");

/**
 * Raised when a guarded child-process argument value is option-like (for
 * example begins with `-`) and would be reinterpreted as a flag by the spawned
 * process instead of being treated as a literal positional argument.
 *
 * **Example** (Construct option injection error)
 *
 * ```ts
 * import { OptionInjectionError } from "@beep/repo-utils/errors/OptionInjectionError"
 * const error = OptionInjectionError.make({
 *   value: "--privileged",
 *   message: "Refusing to forward option-like argument \"--privileged\"."
 * })
 * console.log(error.value)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class OptionInjectionError extends S.TaggedError<OptionInjectionError>($I`OptionInjectionError`)(
  "OptionInjectionError",
  {
    message: S.String,
    value: S.String,
  },
  $I.annoteError<OptionInjectionError>("OptionInjectionError", {
    title: "Option Injection Error",
    description:
      "Raised when a data-derived child-process argument is shaped like a\ncommand-line option and would be reinterpreted as a flag by the spawned\nprocess instead of being treated as a literal positional argument.",
  })
) {}
