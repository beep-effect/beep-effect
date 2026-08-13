/**
 * Driver-neutral candidate-promotion gate schemas.
 *
 * @packageDocumentation
 * @category schemas
 * @since 0.0.0
 */

import { $SharedUseCasesId } from "@beep/identity/packages";
import { KebabCaseStr, LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SharedUseCasesId.create("PromotionGate/PromotionGate.schema");

/**
 * Opaque product subject presented to a promotion policy.
 *
 * **Details**
 *
 * The shared contract knows only a stable kind/id pair. A vertical adapter
 * resolves that pair to its own policy scope; the pair never carries legal,
 * financial, or other vertical-specific fields.
 *
 * **Example** (Identify an application candidate)
 *
 * ```ts
 * import { PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate"
 *
 * const subject = PromotionSubjectRef.make({ id: "application-16138242", kind: "patent-application" })
 * console.log(subject.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PromotionSubjectRef extends S.Class<PromotionSubjectRef>($I`PromotionSubjectRef`)(
  {
    id: S.NonEmptyString.annotateKey({ description: "Stable identifier interpreted only by the vertical adapter." }),
    kind: S.NonEmptyString.annotateKey({ description: "Opaque subject kind used to route vertical policy." }),
  },
  $I.annote("PromotionSubjectRef", {
    description: "Opaque kind/id reference consulted before candidate output promotion.",
  })
) {}

/**
 * Opaque refusal reason safe to return across the shared boundary.
 *
 * **Gotchas**
 *
 * This is a policy identifier or bounded refusal code, not the vertical's raw
 * evidence, legal analysis, or internal error payload.
 *
 * **Example** (Create a sanitized refusal code)
 *
 * ```ts
 * import { PromotionBlockReason } from "@beep/shared-use-cases/PromotionGate"
 *
 * console.log(PromotionBlockReason.make("vertical-policy-blocked"))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PromotionBlockReason = KebabCaseStr.check(S.isMaxLength(80)).pipe(
  S.brand("PromotionBlockReason"),
  $I.annoteSchema("PromotionBlockReason", {
    description: "Opaque sanitized reason code for a blocked candidate promotion.",
  })
);

/**
 * Type-level value produced by {@link PromotionBlockReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PromotionBlockReason = typeof PromotionBlockReason.Type;

/**
 * Opaque tenant identifier attached by the trusted acceptance boundary.
 *
 * **Example** (Identify a tenant without exposing vertical vocabulary)
 *
 * ```ts
 * import { PromotionTenantRef } from "@beep/shared-use-cases/PromotionGate"
 *
 * console.log(PromotionTenantRef.make("org-law-fixture"))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PromotionTenantRef = S.NonEmptyString.pipe(
  S.brand("PromotionTenantRef"),
  $I.annoteSchema("PromotionTenantRef", {
    description: "Opaque tenant reference used to prevent cross-tenant promotion decisions.",
  })
);

/**
 * Type-level value produced by {@link PromotionTenantRef}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PromotionTenantRef = typeof PromotionTenantRef.Type;

/**
 * Tenant-bound request evaluated by a vertical promotion policy.
 *
 * **Details**
 *
 * The acceptance boundary derives the subject from trusted candidate context
 * and the tenant from the already-validated runtime scope. Vertical resolvers
 * must bind both values to their own policy scope.
 *
 * **Example** (Bind a subject to its tenant)
 *
 * ```ts
 * import { PromotionGateRequest, PromotionSubjectRef, PromotionTenantRef } from "@beep/shared-use-cases/PromotionGate"
 *
 * const request = PromotionGateRequest.make({
 *   subject: PromotionSubjectRef.make({ id: "application-16138242", kind: "patent-application" }),
 *   tenantRef: PromotionTenantRef.make("org-law-fixture")
 * })
 * console.log(request.tenantRef)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PromotionGateRequest extends S.Class<PromotionGateRequest>($I`PromotionGateRequest`)(
  {
    subject: PromotionSubjectRef,
    tenantRef: PromotionTenantRef,
  },
  $I.annote("PromotionGateRequest", {
    description: "Trusted candidate-promotion subject bound to the tenant whose policy must clear.",
  })
) {}

const PromotionGateOutcome = LiteralKit(["clear", "blocked"]);

/**
 * Total clear/blocked verdict returned by a promotion gate.
 *
 * **Example** (Construct a clear verdict)
 *
 * ```ts
 * import { PromotionGateVerdict } from "@beep/shared-use-cases/PromotionGate"
 *
 * const verdict = PromotionGateVerdict.cases.clear.make({})
 * console.log(verdict.outcome)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PromotionGateVerdict = PromotionGateOutcome.toTaggedUnion("outcome")({
  clear: {},
  blocked: { reason: PromotionBlockReason },
}).pipe(
  $I.annoteSchema("PromotionGateVerdict", {
    description: "Total candidate-promotion verdict: clear or blocked with an opaque sanitized reason.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PromotionGateVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type PromotionGateVerdict = typeof PromotionGateVerdict.Type;
