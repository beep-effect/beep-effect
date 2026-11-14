/**
 * Typed failures raised by the `@beep/alchemy-aws-extras` providers.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $AlchemyAwsExtrasId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $AlchemyAwsExtrasId.create("Errors");

/**
 * Resource props that failed schema validation before any AWS call.
 *
 * **Example** (Report an invalid tag key)
 *
 * ```ts
 * import { InvalidResourceProps } from "@beep/alchemy-aws-extras/Errors"
 *
 * const error = new InvalidResourceProps({
 *   resourceType: "BeepAWS.CostExplorer.CostAllocationTag",
 *   message: "tagKey must not be empty"
 * })
 * console.log(error._tag) // "InvalidResourceProps"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class InvalidResourceProps extends S.TaggedError<InvalidResourceProps, { readonly brand: unique symbol }>(
  $I`InvalidResourceProps`
)(
  "InvalidResourceProps",
  {
    resourceType: S.String,
    message: S.String,
  },
  $I.annoteError<InvalidResourceProps>("InvalidResourceProps", {
    title: "Invalid resource props",
    description: "Resource props failed schema validation before any AWS call was made.",
  })
) {}

/**
 * Cost Explorer rejected a cost-allocation-tag status update for one tag key.
 *
 * **Example** (Report a tag key billing has not seen yet)
 *
 * ```ts
 * import { CostAllocationTagUpdateFailed } from "@beep/alchemy-aws-extras/Errors"
 *
 * const error = new CostAllocationTagUpdateFailed({
 *   tagKey: "Project",
 *   code: "TagKeysNotFoundException",
 *   message: "tag key not found"
 * })
 * console.log(error.tagKey) // "Project"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CostAllocationTagUpdateFailed extends S.TaggedError<
  CostAllocationTagUpdateFailed,
  { readonly brand: unique symbol }
>($I`CostAllocationTagUpdateFailed`)(
  "CostAllocationTagUpdateFailed",
  {
    tagKey: S.String,
    code: S.String,
    message: S.String,
  },
  $I.annoteError<CostAllocationTagUpdateFailed>("CostAllocationTagUpdateFailed", {
    title: "Cost allocation tag update failed",
    description:
      "UpdateCostAllocationTagsStatus returned a per-key error; billing must have seen a tag key before it can be activated.",
  })
) {}

/**
 * An account enrollment did not reach the requested status in time.
 *
 * **Example** (Report a stuck Compute Optimizer enrollment)
 *
 * ```ts
 * import { EnrollmentNotSettled } from "@beep/alchemy-aws-extras/Errors"
 *
 * const error = new EnrollmentNotSettled({
 *   service: "compute-optimizer",
 *   desired: "Active",
 *   observed: "Pending"
 * })
 * console.log(error.observed) // "Pending"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EnrollmentNotSettled extends S.TaggedError<EnrollmentNotSettled, { readonly brand: unique symbol }>(
  $I`EnrollmentNotSettled`
)(
  "EnrollmentNotSettled",
  {
    service: S.String,
    desired: S.String,
    observed: S.String,
  },
  $I.annoteError<EnrollmentNotSettled>("EnrollmentNotSettled", {
    title: "Enrollment not settled",
    description: "An account enrollment update did not converge to the requested status within the wait budget.",
  })
) {}

/**
 * EC2 returned a launch-template response without the fields the provider needs.
 *
 * **Example** (Report a create call that returned no template id)
 *
 * ```ts
 * import { LaunchTemplateUnexpectedResponse } from "@beep/alchemy-aws-extras/Errors"
 *
 * const error = new LaunchTemplateUnexpectedResponse({
 *   message: "createLaunchTemplate returned no launch template"
 * })
 * console.log(error._tag) // "LaunchTemplateUnexpectedResponse"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LaunchTemplateUnexpectedResponse extends S.TaggedError<
  LaunchTemplateUnexpectedResponse,
  { readonly brand: unique symbol }
>($I`LaunchTemplateUnexpectedResponse`)(
  "LaunchTemplateUnexpectedResponse",
  {
    message: S.String,
  },
  $I.annoteError<LaunchTemplateUnexpectedResponse>("LaunchTemplateUnexpectedResponse", {
    title: "Unexpected launch template response",
    description: "An EC2 launch-template call succeeded but omitted an identifier or version the provider requires.",
  })
) {}
