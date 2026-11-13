/**
 * EventBridge events the termination watcher consumes.
 *
 * Ported from `lambdas/functions/termination-watcher` of
 * github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the package
 * README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $AlchemyGithubRunnersId.create("Ec2Events.models");

/**
 * `detail-type` of the Spot two-minute interruption warning.
 *
 * **Example** (Match the warning)
 *
 * ```ts
 * import { spotInterruptionWarningDetailType } from "@beep/alchemy-github-runners/Ec2Events.models"
 *
 * console.log(spotInterruptionWarningDetailType)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const spotInterruptionWarningDetailType = "EC2 Spot Instance Interruption Warning";

/**
 * `detail-type` of an EC2 instance state change.
 *
 * **Example** (Match the state change)
 *
 * ```ts
 * import { instanceStateChangeDetailType } from "@beep/alchemy-github-runners/Ec2Events.models"
 *
 * console.log(instanceStateChangeDetailType)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const instanceStateChangeDetailType = "EC2 Instance State-change Notification";

/**
 * A Spot interruption warning for one instance.
 *
 * **Example** (Decode a warning)
 *
 * ```ts
 * import { SpotInterruptionWarning } from "@beep/alchemy-github-runners/Ec2Events.models"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(SpotInterruptionWarning)({
 *   "detail-type": "EC2 Spot Instance Interruption Warning",
 *   detail: { "instance-id": "i-0123456789abcdef0", "instance-action": "terminate" },
 * })
 * console.log(event.detail["instance-id"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpotInterruptionWarning extends S.Opaque<SpotInterruptionWarning, { readonly brand: unique symbol }>()(
  S.Struct({
    "detail-type": S.Literal(spotInterruptionWarningDetailType),
    detail: S.Struct({
      "instance-id": S.String,
      "instance-action": S.String,
    }),
  }).pipe(
    $I.annoteSchema("SpotInterruptionWarning", {
      description: "A Spot interruption warning for one instance.",
    })
  )
) {}

/**
 * An EC2 instance state change.
 *
 * **Details**
 *
 * The EventBridge rule the fleet declares passes only `shutting-down` and
 * `terminated`; the watcher deregisters the runner on either. This replaces
 * upstream's CloudTrail `BidEvictedEvent` path, which needs a trail.
 *
 * **Example** (Decode a state change)
 *
 * ```ts
 * import { InstanceStateChange } from "@beep/alchemy-github-runners/Ec2Events.models"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(InstanceStateChange)({
 *   "detail-type": "EC2 Instance State-change Notification",
 *   detail: { "instance-id": "i-0123456789abcdef0", state: "shutting-down" },
 * })
 * console.log(event.detail.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InstanceStateChange extends S.Opaque<InstanceStateChange, { readonly brand: unique symbol }>()(
  S.Struct({
    "detail-type": S.Literal(instanceStateChangeDetailType),
    detail: S.Struct({
      "instance-id": S.String,
      state: S.String,
    }),
  }).pipe(
    $I.annoteSchema("InstanceStateChange", {
      description: "An EC2 instance state change.",
    })
  )
) {}

/**
 * Either event the termination watcher handles.
 *
 * **Example** (Decode either event)
 *
 * ```ts
 * import { TerminationEvent } from "@beep/alchemy-github-runners/Ec2Events.models"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(TerminationEvent)({
 *   "detail-type": "EC2 Instance State-change Notification",
 *   detail: { "instance-id": "i-0123456789abcdef0", state: "terminated" },
 * })
 * console.log(event["detail-type"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TerminationEvent = S.Union([SpotInterruptionWarning, InstanceStateChange]).pipe(
  $I.annoteSchema("TerminationEvent", { description: "Either event the termination watcher handles." })
);

/**
 * Runtime type for {@link TerminationEvent}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TerminationEvent = typeof TerminationEvent.Type;
