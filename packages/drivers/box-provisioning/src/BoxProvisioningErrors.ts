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
  { stage: LiteralKit(["desired-state", "observed-state", "plan", "receipt", "journal"]) },
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
 * Authenticated Box subject did not match the service identity pinned by intent.
 *
 * **Example** (Create a subject mismatch error)
 *
 * ```ts
 * import { BoxProvisioningSubjectMismatchError } from "@beep/box-provisioning/BoxProvisioningErrors"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const error = BoxProvisioningSubjectMismatchError.make({
 *   actualSubjectId: BoxProviderId.make("actual"),
 *   expectedSubjectId: BoxProviderId.make("expected")
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxProvisioningSubjectMismatchError extends S.TaggedError<BoxProvisioningSubjectMismatchError>(
  $I`BoxProvisioningSubjectMismatchError`
)(
  "BoxProvisioningSubjectMismatchError",
  {
    expectedSubjectId: BoxProviderId,
    actualSubjectId: BoxProviderId,
  },
  $I.annoteError<BoxProvisioningSubjectMismatchError>("BoxProvisioningSubjectMismatchError", {
    description: "Authenticated Box subject differs from the desired service-identity fingerprint.",
  })
) {
  override get message(): string {
    return "Authenticated Box subject does not match the desired service identity.";
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
      "invalid-plan-digest",
      "desired-state-digest-mismatch",
      "action-after-digest-mismatch",
      "action-precondition-mismatch",
      "missing-before-digest",
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
 * Apply rejected a plan that violates the reviewed entitlement-blocker contract.
 *
 * **Example** (Reject an unexpected policy blocker)
 *
 * ```ts
 * import { BoxProvisioningBlockerContractError } from "@beep/box-provisioning/BoxProvisioningErrors"
 *
 * const error = BoxProvisioningBlockerContractError.make({
 *   code: "non-entitlement-blocker",
 *   phase: "pre-apply"
 * })
 * console.log(error.code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxProvisioningBlockerContractError extends S.TaggedError<BoxProvisioningBlockerContractError>(
  $I`BoxProvisioningBlockerContractError`
)(
  "BoxProvisioningBlockerContractError",
  {
    phase: LiteralKit(["pre-apply", "post-apply"]),
    code: LiteralKit([
      "non-entitlement-blocker",
      "entitlement-blocker-mismatch",
      "invalid-entitlement-dependency",
      "post-apply-non-noop-action",
    ]),
  },
  $I.annoteError<BoxProvisioningBlockerContractError>("BoxProvisioningBlockerContractError", {
    description: "Sanitized failure when a reviewed or post-apply plan violates its strict blocker contract.",
  })
) {
  override get message(): string {
    return `Box provisioning ${this.phase} blocker contract failed: ${this.code}.`;
  }
}

/**
 * Durable apply-journal persistence failed at the mutation boundary.
 *
 * **Example** (Create an append failure)
 *
 * ```ts
 * import { BoxProvisioningApplyJournalError } from "@beep/box-provisioning/BoxProvisioningErrors"
 *
 * const error = BoxProvisioningApplyJournalError.make({ operation: "append" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxProvisioningApplyJournalError extends S.TaggedError<BoxProvisioningApplyJournalError>(
  $I`BoxProvisioningApplyJournalError`
)(
  "BoxProvisioningApplyJournalError",
  { operation: LiteralKit(["append", "encode"]) },
  $I.annoteError<BoxProvisioningApplyJournalError>("BoxProvisioningApplyJournalError", {
    description: "Sanitized failure to encode or append Box apply-journal evidence.",
  })
) {
  override get message(): string {
    return `Box provisioning apply journal failed to ${this.operation}.`;
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
  | BoxProvisioningSubjectMismatchError
  | BoxProvisioningDriftError
  | BoxProvisioningInvariantError
  | BoxProvisioningBlockerContractError
  | BoxProvisioningApplyJournalError;
