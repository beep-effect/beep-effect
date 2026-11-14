/**
 * Shared enrollment status literal for the account-enrollment resources.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */

import { $AlchemyAwsExtrasId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $AlchemyAwsExtrasId.create("EnrollmentStatus");

/**
 * Requested enrollment of an account in an AWS cost-optimization service.
 *
 * **Example** (Read the active literal)
 *
 * ```ts
 * import { EnrollmentStatus } from "@beep/alchemy-aws-extras/EnrollmentStatus"
 *
 * console.log(EnrollmentStatus.Enum.Inactive) // "Inactive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EnrollmentStatus = LiteralKit(["Active", "Inactive"]).pipe(
  $I.annoteSchema("EnrollmentStatus", {
    description: "Requested enrollment of the account in Compute Optimizer or Cost Optimization Hub.",
  })
);

/**
 * Decoded {@link EnrollmentStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type EnrollmentStatus = typeof EnrollmentStatus.Type;
