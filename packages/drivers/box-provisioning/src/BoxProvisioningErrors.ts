/**
 * Sanitized typed failures for Box desired-state reconciliation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { BoxProviderId } from "./BoxProvisioningObserved.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningErrors");

/**
 * Sanitized failure decoding a reconciliation boundary schema.
 *
 * **Gotchas**
 *
 * The underlying schema issue is deliberately excluded because it may quote a
 * confidential folder name, principal, or callback address.
 *
 * **Example** (Create a desired-state decoding error)
 *
 * ```ts
 * import { BoxProvisioningSchemaError } from "@beep/box-provisioning/BoxProvisioningErrors"
 *
 * const error = BoxProvisioningSchemaError.make({ stage: "desired-state" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxProvisioningSchemaError extends S.TaggedError<BoxProvisioningSchemaError>(
  $I`BoxProvisioningSchemaError`
)(
  "BoxProvisioningSchemaError",
  { stage: LiteralKit(["desired-state", "observed-state", "plan", "receipt"]) },
  $I.annoteError<BoxProvisioningSchemaError>("BoxProvisioningSchemaError", {
    description: "Sanitized failure decoding a Box provisioning boundary schema.",
  })
) {
  override get message(): string {
    return `Box provisioning ${this.stage} failed schema validation.`;
  }
}

/**
 * Live Box enterprise did not match the tenant fingerprint pinned by intent.
 *
 * **Example** (Create a tenant mismatch error)
 *
 * ```ts
 * import { BoxProvisioningTenantMismatchError } from "@beep/box-provisioning/BoxProvisioningErrors"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const error = BoxProvisioningTenantMismatchError.make({
 *   actualEnterpriseId: BoxProviderId.make("actual"),
 *   expectedEnterpriseId: BoxProviderId.make("expected")
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxProvisioningTenantMismatchError extends S.TaggedError<BoxProvisioningTenantMismatchError>(
  $I`BoxProvisioningTenantMismatchError`
)(
  "BoxProvisioningTenantMismatchError",
  {
    expectedEnterpriseId: BoxProviderId,
    actualEnterpriseId: BoxProviderId,
  },
  $I.annoteError<BoxProvisioningTenantMismatchError>("BoxProvisioningTenantMismatchError", {
    description: "Live Box enterprise fingerprint differs from the desired-state fingerprint.",
  })
) {
  override get message(): string {
    return "Box enterprise fingerprint does not match the desired state.";
  }
}

/**
 * Apply rejected a plan because fresh inventory produced a different digest.
 *
 * **Example** (Create a stale-plan error)
 *
 * ```ts
 * import { BoxProvisioningDriftError } from "@beep/box-provisioning/BoxProvisioningErrors"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const error = BoxProvisioningDriftError.make({
 *   actualPlanDigest: Sha256Hex.make("a".repeat(64)),
 *   expectedPlanDigest: Sha256Hex.make("b".repeat(64))
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxProvisioningDriftError extends S.TaggedError<BoxProvisioningDriftError>($I`BoxProvisioningDriftError`)(
  "BoxProvisioningDriftError",
  {
    expectedPlanDigest: Sha256Hex,
    actualPlanDigest: Sha256Hex,
  },
  $I.annoteError<BoxProvisioningDriftError>("BoxProvisioningDriftError", {
    description: "Fresh inventory no longer produces the reviewed Box provisioning plan digest.",
  })
) {
  override get message(): string {
    return "Box provisioning plan is stale and must be regenerated.";
  }
}

/**
 * Planner or applier reached a state forbidden by reconciler invariants.
 *
 * **Example** (Create an unresolved dependency error)
 *
 * ```ts
 * import { BoxProvisioningInvariantError } from "@beep/box-provisioning/BoxProvisioningErrors"
 *
 * const error = BoxProvisioningInvariantError.make({ code: "unresolved-dependency" })
 * console.log(error.code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxProvisioningInvariantError extends S.TaggedError<BoxProvisioningInvariantError>(
  $I`BoxProvisioningInvariantError`
)(
  "BoxProvisioningInvariantError",
  {
    code: LiteralKit([
      "missing-enterprise-id",
      "missing-provider-id",
      "unresolved-dependency",
      "unsupported-action",
      "unreadable-sdk-response",
    ]),
  },
  $I.annoteError<BoxProvisioningInvariantError>("BoxProvisioningInvariantError", {
    description: "Sanitized internal invariant failure in Box provisioning.",
  })
) {
  override get message(): string {
    return `Box provisioning invariant failed: ${this.code}.`;
  }
}

/**
 * Technical errors produced directly by the Box reconciliation engine.
 *
 * @category errors
 * @since 0.0.0
 */
export type BoxProvisioningError =
  | BoxProvisioningSchemaError
  | BoxProvisioningTenantMismatchError
  | BoxProvisioningDriftError
  | BoxProvisioningInvariantError;
