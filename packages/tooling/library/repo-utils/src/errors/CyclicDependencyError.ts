/**
 * Error raised when a cyclic dependency is detected in the workspace
 * dependency graph.
 *
 * Contains the list of cycles found, where each cycle is an ordered
 * array of package names forming the loop.
 *
 * @category error-handling
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("errors/CyclicDependencyError");

const CyclicDependencyErrorFields = {
  message: S.String,
  cycles: S.String.pipe(S.Array, S.Array),
} satisfies S.Struct.Fields;
const sameCyclicDependencyErrorFields = S.toEquivalence(
  S.TaggedStruct("CyclicDependencyError", CyclicDependencyErrorFields)
);
const sameCyclicDependencyError = (self: CyclicDependencyError, that: CyclicDependencyError): boolean =>
  sameCyclicDependencyErrorFields(self, that);

/**
 * Raised when topological sorting or cycle detection finds circular
 * dependencies in the workspace dependency graph.
 *
 * **Example** (Construct cyclic dependency error)
 *
 * ```ts
 * import { CyclicDependencyError } from "@beep/repo-utils/errors/CyclicDependencyError"
 * const error = CyclicDependencyError.make({
 *   cycles: [["a", "b", "a"]],
 *   message: "Cyclic dependencies detected"
 * })
 * console.log(error.cycles)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class CyclicDependencyError extends S.TaggedError<CyclicDependencyError>($I`CyclicDependencyError`)(
  "CyclicDependencyError",
  CyclicDependencyErrorFields,
  $I.annoteClass<
    S.declare<CyclicDependencyError>,
    readonly [S.TaggedStruct<"CyclicDependencyError", typeof CyclicDependencyErrorFields>]
  >("CyclicDependencyError", {
    title: "Cyclic Dependency Error",
    description:
      "Raised when topological sorting or cycle detection finds circular\ndependencies in the workspace dependency graph.",
    toEquivalence: () => sameCyclicDependencyError,
  })
) {}
