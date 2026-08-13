/**
 * Server-owned resolution seam from an opaque promotion subject to candor
 * filing scope.
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { PromotionGateRequest } from "@beep/shared-use-cases/PromotionGate";
import { Context } from "effect";
import type { CandorFilingScope } from "@beep/law-practice-use-cases/CandorPolicy";
import type { Effect } from "effect";

const $I = $LawPracticeServerId.create("CandorPromotionGate/CandorPromotionGate.ports");
const CandorPromotionSubjectResolutionReasonBase = LiteralKit([
  "mapping-unavailable",
  "subject-not-found",
  "tenant-mismatch",
  "unsupported-subject-kind",
]);

/**
 * Bounded reason a tenant-bound promotion subject could not be resolved.
 *
 * **Example** (Classify a tenant mismatch)
 *
 * ```ts
 * import { CandorPromotionSubjectResolutionReason } from "@beep/law-practice-server/CandorPromotionGate"
 *
 * console.log(CandorPromotionSubjectResolutionReason.is["tenant-mismatch"]("tenant-mismatch"))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const CandorPromotionSubjectResolutionReason = CandorPromotionSubjectResolutionReasonBase.pipe(
  $I.annoteSchema("CandorPromotionSubjectResolutionReason", {
    description: "Bounded operational reason a promotion subject could not map to a candor filing scope.",
  }),
  SchemaUtils.withLiteralKitStatics(CandorPromotionSubjectResolutionReasonBase)
);

/**
 * Runtime type for {@link CandorPromotionSubjectResolutionReason}.
 *
 * @category errors
 * @since 0.0.0
 */
export type CandorPromotionSubjectResolutionReason = typeof CandorPromotionSubjectResolutionReason.Type;

/**
 * Failure to resolve an opaque shared subject to this slice's filing scope.
 *
 * **Example** (Report an unavailable mapping)
 *
 * ```ts
 * import { CandorPromotionSubjectResolutionError } from "@beep/law-practice-server/CandorPromotionGate"
 * import {
 *   PromotionGateRequest,
 *   PromotionSubjectRef,
 *   PromotionTenantRef
 * } from "@beep/shared-use-cases/PromotionGate"
 *
 * const error = CandorPromotionSubjectResolutionError.make({
 *   reason: "mapping-unavailable",
 *   request: PromotionGateRequest.make({
 *     subject: PromotionSubjectRef.make({ id: "application-1", kind: "patent-application" }),
 *     tenantRef: PromotionTenantRef.make("org-1")
 *   })
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CandorPromotionSubjectResolutionError extends TaggedErrorClass<CandorPromotionSubjectResolutionError>(
  $I`CandorPromotionSubjectResolutionError`
)(
  "CandorPromotionSubjectResolutionError",
  {
    reason: CandorPromotionSubjectResolutionReason.annotateKey({
      description: "Bounded reason the subject could not be resolved to a candor filing scope.",
    }),
    request: PromotionGateRequest.annotateKey({
      description: "Tenant-bound opaque subject that could not be resolved.",
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
    request: PromotionGateRequest
  ) => Effect.Effect<CandorFilingScope, CandorPromotionSubjectResolutionError>;
}

/**
 * Server-owned resolver tag supplied by the application composition root.
 * Its adapter must resolve both the subject and tenant reference together;
 * resolving the subject alone would permit a cross-tenant promotion decision.
 *
 * **Example** (Provide a fail-closed resolver)
 *
 * ```ts
 * import {
 *   CandorPromotionSubjectResolutionError,
 *   CandorPromotionSubjectResolver
 * } from "@beep/law-practice-server/CandorPromotionGate"
 * import { Effect } from "effect"
 *
 * const resolver = CandorPromotionSubjectResolver.of({
 *   resolve: (request) => Effect.fail(CandorPromotionSubjectResolutionError.make({
 *     reason: "mapping-unavailable",
 *     request
 *   }))
 * })
 * console.log(typeof resolver.resolve)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CandorPromotionSubjectResolver extends Context.Service<
  CandorPromotionSubjectResolver,
  CandorPromotionSubjectResolverShape
>()($I`CandorPromotionSubjectResolver`) {}
