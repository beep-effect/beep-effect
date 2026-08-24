/**
 * Typed errors for research knowledge-vault commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Research/Research.errors");

const ResearchCommandErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameResearchCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("ResearchCommandError", {
    message: ResearchCommandErrorFields.message,
  })
);
const sameResearchCommandError = (self: ResearchCommandError, that: ResearchCommandError): boolean =>
  sameResearchCommandErrorFields(self, that);

/**
 * Error raised by research knowledge-vault commands.
 *
 * **Example** (Create research command error)
 *
 * ```ts
 * import { ResearchCommandError } from "@beep/repo-cli/commands/Research/index"
 *
 * const error = ResearchCommandError.make({ message: "Invalid vault root" })
 * console.log(error.message)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class ResearchCommandError extends S.TaggedError<ResearchCommandError>($I`ResearchCommandError`)(
  "ResearchCommandError",
  ResearchCommandErrorFields,
  $I.annoteClass<
    S.declare<ResearchCommandError>,
    readonly [S.TaggedStruct<"ResearchCommandError", typeof ResearchCommandErrorFields>]
  >("ResearchCommandError", {
    description: "A failure raised while preparing or applying a research knowledge-vault operation.",
    toEquivalence: () => sameResearchCommandError,
  })
) {
  /**
   * Construct a research command error from an original cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): ResearchCommandError;
    (message: string): (cause: unknown) => ResearchCommandError;
  } = dual(2, (cause: unknown, message: string): ResearchCommandError => ResearchCommandError.make({ cause, message }));

  static readonly mapError = Err.mapToError(this.new);
}
