/**
 * React invariant helpers for UI composition boundaries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UiId } from "@beep/identity";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $UiId.create("lib/react-invariant");

/**
 * React context invariant options class.
 *
 * **Example** (Import invariant options class)
 *
 * ```ts
 * import { ReactContextInvariantOptions } from "@beep/ui/lib/react-invariant"
 *
 * console.log(ReactContextInvariantOptions)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReactContextInvariantOptions extends S.Class<ReactContextInvariantOptions>(
  $I`ReactContextInvariantOptions`
)(
  {
    message: S.NonEmptyString.pipe(
      $I.annoteKey("ReactContextInvariantOptions.message", {
        description: "Human-facing diagnostic emitted when a React context is missing.",
      })
    ),
  },
  $I.annote("ReactContextInvariantOptions", {
    description: "Options for a React context invariant check.",
  })
) {}

/**
 * Error thrown when a React context hook is used outside its provider.
 *
 * **Example** (Create missing provider error)
 *
 * ```ts
 * import { ReactContextInvariantError } from "@beep/ui/lib/react-invariant"
 *
 * const error = ReactContextInvariantError.make({ message: "missing provider" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReactContextInvariantError extends S.TaggedError<ReactContextInvariantError>(
  $I`ReactContextInvariantError`
)(
  "ReactContextInvariantError",
  {
    message: S.NonEmptyString.pipe(
      $I.annoteKey("ReactContextInvariantError.message", {
        description: "Human-facing diagnostic emitted when a React context is missing.",
      })
    ),
  },
  $I.annoteError<ReactContextInvariantError>("ReactContextInvariantError", {
    description: "Synchronous React context invariant failure.",
  })
) {}

// `missingPipeableSignature` relates the data-first return to the data-last
// inner return, and a naked type parameter resolves away before that comparison
// can succeed. This distributive conditional stays deferred while being the
// identity for every instantiation, so both overloads keep the caller's exact
// context type and the two returns still relate.
type RequiredReactContext<Value> = Value extends unknown ? Value : never;

/**
 * Require that a React context hook has been called under its provider.
 *
 * **Example** (Require context under provider)
 *
 * ```ts
 * import { requireReactContext } from "@beep/ui/lib/react-invariant"
 *
 * const value = requireReactContext("ok", { message: "missing provider" })
 * console.log(value) // "ok"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const requireReactContext: {
  <Value>(context: Value | null, options: ReactContextInvariantOptions): RequiredReactContext<Value>;
  (options: ReactContextInvariantOptions): <Value>(context: Value | null) => RequiredReactContext<Value>;
} = dual(2, <Value>(context: Value | null, options: ReactContextInvariantOptions): Value => {
  if (context === null) {
    throw ReactContextInvariantError.make({ message: options.message });
  }

  return context;
});
