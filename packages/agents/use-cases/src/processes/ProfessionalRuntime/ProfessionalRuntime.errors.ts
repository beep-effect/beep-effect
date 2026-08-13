/**
 * SDK errors for the Agentic Professional Runtime proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("processes/ProfessionalRuntime/ProfessionalRuntime.errors");

/**
 * Validation failure for runtime SDK requests and candidate proposals.
 *
 * **Example** (Creating a validation error)
 *
 * ```ts
 * import { ProfessionalRuntimeValidationError } from "@beep/agents-use-cases/public"
 *
 * console.log(ProfessionalRuntimeValidationError.make({ message: "invalid runtime proposal" }))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProfessionalRuntimeValidationError extends S.TaggedError<ProfessionalRuntimeValidationError>(
  $I`ProfessionalRuntimeValidationError`
)(
  "ProfessionalRuntimeValidationError",
  {
    message: S.String,
  },
  $I.annote("ProfessionalRuntimeValidationError", {
    description: "Raised when runtime request or proposal data violates SDK validation rules.",
  })
) {
  static readonly new = (message: string) => ProfessionalRuntimeValidationError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);

  static readonly throwError = flow(this.new, (e) => {
    throw e;
  });

  static readonly failEffectThunk = flow(this.failEffect, (effect) => () => effect);
}
