/**
 * Pulumi entrypoint for the beep CI runner fleet groundwork.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CiFleetController, loadCiFleetControllerConfig } from "../CiFleetController.ts";
import { CiRunnersStack, loadCiRunnersStackArgs } from "../CiRunners.ts";
import { CiTurboCache, loadCiTurboCacheConfig } from "../CiTurboCache.ts";

const stack = new CiRunnersStack("ci-runners", loadCiRunnersStackArgs());
const controller = new CiFleetController("ci-fleet-controller", {
  config: loadCiFleetControllerConfig(),
  region: stack.region,
  subnetIds: [stack.publicSubnetAId, stack.publicSubnetBId],
  vpcId: stack.vpcId,
  workerSecurityGroupId: stack.workerSecurityGroupId,
});
const turboCache = new CiTurboCache("ci-turbo-cache", { config: loadCiTurboCacheConfig() });

/**
 * Dedicated fleet VPC identifier.
 *
 * @category resources
 * @since 0.0.0
 */
export const vpcId = stack.vpcId;

/**
 * Dedicated fleet VPC CIDR block.
 *
 * @category resources
 * @since 0.0.0
 */
export const vpcCidr = stack.vpcCidr;

/**
 * AWS region hosting the fleet.
 *
 * @category resources
 * @since 0.0.0
 */
export const region = stack.region;

/**
 * Public subnet id in the first availability zone.
 *
 * @category resources
 * @since 0.0.0
 */
export const publicSubnetAId = stack.publicSubnetAId;

/**
 * Public subnet id in the second availability zone.
 *
 * @category resources
 * @since 0.0.0
 */
export const publicSubnetBId = stack.publicSubnetBId;

/**
 * Zero-ingress worker security group id.
 *
 * @category resources
 * @since 0.0.0
 */
export const workerSecurityGroupId = stack.workerSecurityGroupId;

/**
 * Worker launch template id.
 *
 * @category resources
 * @since 0.0.0
 */
export const launchTemplateId = stack.launchTemplateId;

/**
 * Stable AWS-side launch template name for the future controller.
 *
 * @category resources
 * @since 0.0.0
 */
export const launchTemplateName = stack.launchTemplateName;

/**
 * Latest launch template version for controller RunInstances calls.
 *
 * @category resources
 * @since 0.0.0
 */
export const launchTemplateLatestVersion = stack.launchTemplateLatestVersion;

/**
 * AMI id the launch template resolved (pinned override or SSM lookup).
 *
 * @category resources
 * @since 0.0.0
 */
export const resolvedAmiId = stack.resolvedAmiId;

/**
 * Worker EC2 instance type.
 *
 * @category resources
 * @since 0.0.0
 */
export const instanceType = stack.instanceType;

/**
 * Name of the reaper Lambda enforcing the fleet TTL.
 *
 * @category resources
 * @since 0.0.0
 */
export const reaperFunctionName = stack.reaperFunctionName;

/**
 * CloudWatch Logs group receiving VPC flow logs.
 *
 * @category resources
 * @since 0.0.0
 */
export const flowLogGroupName = stack.flowLogGroupName;

/**
 * Terraform-module controller webhook output containing the API Gateway endpoint.
 *
 * @category resources
 * @since 0.0.0
 */
export const controllerWebhook = controller.webhook;

/**
 * Base URL CI jobs supply as `TURBO_API` for the asymmetric Turbo remote cache.
 *
 * @category resources
 * @since 0.0.0
 */
export const turboCacheApiEndpoint = turboCache.apiEndpoint;

/**
 * S3 bucket holding Turbo remote-cache artifacts.
 *
 * @category resources
 * @since 0.0.0
 */
export const turboCacheBucketName = turboCache.bucketName;
