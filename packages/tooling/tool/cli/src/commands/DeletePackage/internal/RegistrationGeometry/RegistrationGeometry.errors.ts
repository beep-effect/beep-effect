import { $RepoCliId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { OpaqueDefect } from "../../../../internal/schema/OpaqueDefect.ts";

const $I = $RepoCliId.create("commands/DeletePackage/internal/RegistrationGeometry/errors");

/**
 * Typed failure raised when registration geometry cannot be resolved,
 * planned, inspected, or applied for a delete-package target.
 *
 * **Details**
 *
 * `newCause(message)` returns a mapper that wraps any caught defect as an
 * opaque `cause`, so service methods can pass it straight to `Effect.mapError`.
 *
 * **Example** (Wrap a caught failure)
 *
 * ```ts
 * import { RegistrationGeometryError } from "@beep/repo-cli/test/DeletePackage"
 *
 * const error = RegistrationGeometryError.newCause("Failed to inspect @beep/demo.")(new Error("EACCES"))
 *
 * console.log(error._tag) // "RegistrationGeometryError"
 * console.log(error.message) // "Failed to inspect @beep/demo."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RegistrationGeometryError extends S.TaggedError<
  RegistrationGeometryError,
  { readonly brand: unique symbol }
>()(
  "RegistrationGeometryError",
  {
    message: S.NonEmptyString,
    cause: S.OptionFromOptionalKey(OpaqueDefect),
  },
  $I.annoteError<RegistrationGeometryError>("RegistrationGeometryError", {
    description: "Typed failure to resolve, plan, inspect, or apply registration geometry.",
  })
) {
  static readonly newCause = (message: string) => (cause: unknown) =>
    RegistrationGeometryError.make({ message, cause: O.some(cause) });
}
