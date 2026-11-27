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
 * **Example** (Make invariant options)
 *
 * ```ts
 * import { ReactContextInvariantOptions } from "@beep/ui/lib/react-invariant"
 *
 * const options = ReactContextInvariantOptions.make({ message: "useDock must be used within DockProvider" })
 * console.log(options.message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReactContextInvariantOptions extends S.Opaque<
  ReactContextInvariantOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    message: S.NonEmptyString.pipe(
      $I.annoteKey("ReactContextInvariantOptions.message", {
        description: "Human-facing diagnostic emitted when a React context is missing.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ReactContextInvariantOptions", {
      description: "Options for a React context invariant check.",
    })
  )
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
export class ReactContextInvariantError extends S.TaggedError<
  ReactContextInvariantError,
  { readonly brand: unique symbol }
>($I`ReactContextInvariantError`)(
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

type RequiredReactContext<Value> = Value extends unknown ? Value : never;

/**
 * Require that a React context hook has been called under its provider.
 *
 * **Example** (Require context under provider)
 *
 * ```ts import.meta.vitest name="Require context under provider"
 * import { ReactContextInvariantOptions, requireReactContext } from "@beep/ui/lib/react-invariant"
 *
 * const value = requireReactContext("ok", ReactContextInvariantOptions.make({ message: "missing provider" }))
 * value // => "ok"
 * ```
 *
 * @throws ReactContextInvariantError when `context` is `null`, carrying `options.message`.
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
