/**
 * Tagged errors for the Ci command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/Ci.errors");

const CiCommandErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameCiCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("CiCommandError", {
    message: CiCommandErrorFields.message,
  })
);
const sameCiCommandError = (self: CiCommandError, that: CiCommandError): boolean =>
  sameCiCommandErrorFields(self, that);

/**
 * Typed failure for CI helper commands.
 *
 * **Example** (Create typed CI error)
 *
 * ```ts
 * import { CiCommandError } from "@beep/repo-cli/commands/Ci"
 *
 * const error = CiCommandError.make({ message: "Turbo summary not found" })
 * console.log(error.message) // "Turbo summary not found"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CiCommandError extends S.TaggedError<CiCommandError>($I`CiCommandError`)(
  "CiCommandError",
  CiCommandErrorFields,
  $I.annoteClass<S.declare<CiCommandError>, readonly [S.TaggedStruct<"CiCommandError", typeof CiCommandErrorFields>]>(
    "CiCommandError",
    {
      description: "Failure raised by CI helper commands.",
      toEquivalence: () => sameCiCommandError,
    }
  )
) {
  /**
   * Construct a CI command error from an original cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): CiCommandError;
    (message: string): (cause: unknown) => CiCommandError;
  } = dual(2, (cause: unknown, message: string): CiCommandError => CiCommandError.make({ cause, message }));

  static readonly mapError = Err.mapToError(this.new);
}
