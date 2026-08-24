/**
 * SDK errors for the Agentic Professional Runtime proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { PromotionBlockReason, PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("processes/ProfessionalRuntime/ProfessionalRuntime.errors");

const ProfessionalRuntimeValidationErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameProfessionalRuntimeValidationErrorFields = S.toEquivalence(
  S.TaggedStruct("ProfessionalRuntimeValidationError", ProfessionalRuntimeValidationErrorFields)
);
const sameProfessionalRuntimeValidationError = (
  self: ProfessionalRuntimeValidationError,
  that: ProfessionalRuntimeValidationError
): boolean => sameProfessionalRuntimeValidationErrorFields(self, that);

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
  ProfessionalRuntimeValidationErrorFields,
  $I.annoteClass<
    S.declare<ProfessionalRuntimeValidationError>,
    readonly [S.TaggedStruct<"ProfessionalRuntimeValidationError", typeof ProfessionalRuntimeValidationErrorFields>]
  >("ProfessionalRuntimeValidationError", {
    description: "Raised when runtime request or proposal data violates SDK validation rules.",

    toEquivalence: () => sameProfessionalRuntimeValidationError,
  })
) {
  static readonly new = (message: string) => ProfessionalRuntimeValidationError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);

  static readonly throwError = flow(this.new, (e) => {
    throw e;
  });

  static readonly failEffectThunk = flow(this.failEffect, (effect) => () => effect);
}

const ProfessionalRuntimePromotionBlockedFields = {
  reason: PromotionBlockReason.annotateKey({
    description: "Opaque sanitized reason returned by the consulted vertical policy.",
  }),
  subject: PromotionSubjectRef.annotateKey({
    description: "Opaque subject whose candidate promotion was refused.",
  }),
} satisfies S.Struct.Fields;
const sameProfessionalRuntimePromotionBlockedFields = S.toEquivalence(
  S.TaggedStruct("ProfessionalRuntimePromotionBlocked", ProfessionalRuntimePromotionBlockedFields)
);
const sameProfessionalRuntimePromotionBlocked = (
  self: ProfessionalRuntimePromotionBlocked,
  that: ProfessionalRuntimePromotionBlocked
): boolean => sameProfessionalRuntimePromotionBlockedFields(self, that);

/**
 * Fail-closed refusal returned when a vertical policy blocks candidate output
 * promotion for one opaque subject.
 *
 * **Example** (Inspect a promotion refusal)
 *
 * ```ts
 * import { ProfessionalRuntimePromotionBlocked } from "@beep/agents-use-cases/public"
 * import { PromotionBlockReason, PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate"
 *
 * const error = ProfessionalRuntimePromotionBlocked.make({
 *   reason: PromotionBlockReason.make("vertical-policy-blocked"),
 *   subject: PromotionSubjectRef.make({ id: "subject-1", kind: "matter" })
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProfessionalRuntimePromotionBlocked extends S.TaggedError<ProfessionalRuntimePromotionBlocked>(
  $I`ProfessionalRuntimePromotionBlocked`
)(
  "ProfessionalRuntimePromotionBlocked",
  ProfessionalRuntimePromotionBlockedFields,
  $I.annoteClass<
    S.declare<ProfessionalRuntimePromotionBlocked>,
    readonly [S.TaggedStruct<"ProfessionalRuntimePromotionBlocked", typeof ProfessionalRuntimePromotionBlockedFields>]
  >("ProfessionalRuntimePromotionBlocked", {
    description: "A consulted vertical policy refused candidate output promotion for the subject.",

    toEquivalence: () => sameProfessionalRuntimePromotionBlocked,
  })
) {
  static readonly failEffect = (subject: PromotionSubjectRef, reason: PromotionBlockReason) =>
    Effect.fail(ProfessionalRuntimePromotionBlocked.make({ reason, subject }));
}
