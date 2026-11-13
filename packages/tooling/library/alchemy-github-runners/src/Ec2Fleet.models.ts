/**
 * The runner-launch request and result the scale-up program exchanges with
 * the `Ec2Fleet` service, independent of the EC2 SDK.
 *
 * Request shape ported from `createInstances` in
 * `lambdas/functions/control-plane/src/aws/ec2-runners.ts` of
 * github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the
 * package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { AllocationStrategy, CapacityType } from "./RunnerPool.models.ts";
import { LaunchTemplateRef } from "./RunnerRuntime.models.ts";

const $I = $AlchemyGithubRunnersId.create("Ec2Fleet.models");

/**
 * One capacity pool `CreateFleet` may draw from: an instance type in a subnet.
 *
 * **Example** (One override)
 *
 * ```ts
 * import { FleetOverride } from "@beep/alchemy-github-runners/Ec2Fleet.models"
 * import * as O from "effect/Option"
 *
 * const override = FleetOverride.make({ subnetId: "subnet-1", instanceType: "m7i.4xlarge", imageId: O.none(), priority: O.none() })
 * console.log(override.instanceType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetOverride extends S.Opaque<FleetOverride, { readonly brand: unique symbol }>()(
  S.Struct({
    subnetId: S.String,
    instanceType: S.String,
    imageId: S.Option(S.String),
    priority: S.Option(S.Int),
  }).pipe(
    $I.annoteSchema("FleetOverride", {
      description: "One capacity pool CreateFleet may draw from: an instance type in a subnet.",
    })
  )
) {}

/**
 * An instant `CreateFleet` request for a number of runners.
 *
 * **Details**
 *
 * `tags` go on the instance, its volumes and the fleet record. The live layer
 * maps `capacityType` to `SpotOptions` or `OnDemandOptions`.
 *
 * **Example** (Two Spot runners)
 *
 * ```ts
 * import { FleetLaunchRequest, FleetOverride } from "@beep/alchemy-github-runners/Ec2Fleet.models"
 * import { LaunchTemplateRef } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 * import * as O from "effect/Option"
 *
 * const request = FleetLaunchRequest.make({
 *   launchTemplate: LaunchTemplateRef.make({ launchTemplateId: "lt-1", version: "$Default" }),
 *   overrides: [FleetOverride.make({ subnetId: "subnet-1", instanceType: "m7i.4xlarge", imageId: O.none(), priority: O.none() })],
 *   capacityType: "spot",
 *   allocationStrategy: "capacity-optimized",
 *   targetCapacity: 2,
 *   tags: { "ghr:Application": "github-action-runner" },
 * })
 * console.log(request.targetCapacity)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetLaunchRequest extends S.Opaque<FleetLaunchRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    launchTemplate: LaunchTemplateRef,
    overrides: S.NonEmptyArray(FleetOverride),
    capacityType: CapacityType,
    allocationStrategy: AllocationStrategy,
    targetCapacity: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    tags: S.Record(S.String, S.String),
  }).pipe(
    $I.annoteSchema("FleetLaunchRequest", {
      description: "An instant CreateFleet request for a number of runners.",
    })
  )
) {}

/**
 * What an instant `CreateFleet` launched and the per-pool errors it reported.
 *
 * **Example** (A partial launch)
 *
 * ```ts
 * import { FleetLaunchResult } from "@beep/alchemy-github-runners/Ec2Fleet.models"
 *
 * const result = FleetLaunchResult.make({ instanceIds: ["i-1"], errorCodes: ["InsufficientInstanceCapacity"] })
 * console.log(result.instanceIds.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetLaunchResult extends S.Opaque<FleetLaunchResult, { readonly brand: unique symbol }>()(
  S.Struct({
    instanceIds: S.Array(S.String),
    errorCodes: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("FleetLaunchResult", {
      description: "What an instant CreateFleet launched and the errors it reported.",
    })
  )
) {}

/**
 * An instance id with all its tags, as `DescribeInstances` returns it.
 *
 * **Example** (A tagged instance)
 *
 * ```ts
 * import { TaggedInstance } from "@beep/alchemy-github-runners/Ec2Fleet.models"
 *
 * const instance = TaggedInstance.make({ instanceId: "i-1", tags: { "ghr:Owner": "beep-effect" } })
 * console.log(instance.tags["ghr:Owner"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaggedInstance extends S.Opaque<TaggedInstance, { readonly brand: unique symbol }>()(
  S.Struct({
    instanceId: S.String,
    tags: S.Record(S.String, S.String),
  }).pipe(
    $I.annoteSchema("TaggedInstance", {
      description: "An instance id with all its tags.",
    })
  )
) {}
