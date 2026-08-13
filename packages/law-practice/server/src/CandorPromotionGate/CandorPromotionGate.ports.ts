/**
 * Server-owned resolution seam from an opaque promotion subject to candor
 * filing scope.
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { CandorFilingScope } from "@beep/law-practice-use-cases/CandorPolicy";
import type { Effect } from "effect";

const $I = $LawPracticeServerId.create("CandorPromotionGate/CandorPromotionGate.ports");

/**
 * Failure to resolve an opaque shared subject to this slice's filing scope.
 *
 * @category errors
 * @since 0.0.0
 */
export class CandorPromotionSubjectResolutionError extends TaggedErrorClass<CandorPromotionSubjectResolutionError>(
  $I`CandorPromotionSubjectResolutionError`
)(
  "CandorPromotionSubjectResolutionError",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Sanitized reason the subject could not be resolved to a candor filing scope.",
    }),
    subject: PromotionSubjectRef.annotateKey({
      description: "Opaque subject that could not be resolved.",
    }),
  },
  $I.annote("CandorPromotionSubjectResolutionError", {
    description: "The law-practice adapter could not resolve an opaque promotion subject to a filing scope.",
  })
) {}

/**
 * Server adapter shape resolving shared subject identity to law-owned scope.
 *
 * @category services
 * @since 0.0.0
 */
export interface CandorPromotionSubjectResolverShape {
  readonly resolve: (
    subject: PromotionSubjectRef
  ) => Effect.Effect<CandorFilingScope, CandorPromotionSubjectResolutionError>;
}

/**
 * Server-owned resolver tag supplied by the application composition root.
 *
 * @category services
 * @since 0.0.0
 */
export class CandorPromotionSubjectResolver extends Context.Service<
  CandorPromotionSubjectResolver,
  CandorPromotionSubjectResolverShape
>()($I`CandorPromotionSubjectResolver`) {}
