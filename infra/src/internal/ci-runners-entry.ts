/**
 * Pulumi entrypoint for the beep CI runner fleet groundwork.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CiRunnersStack, loadCiRunnersStackArgs } from "../CiRunners.ts";

const stack = new CiRunnersStack("ci-runners", loadCiRunnersStackArgs());

/**
 * Dedicated fleet VPC identifier.
 *
 * @category outputs
 * @since 0.0.0
 */
export const vpcId = stack.vpcId;

/**
 * Dedicated fleet VPC CIDR block.
 *
 * @category outputs
 * @since 0.0.0
 */
export const vpcCidr = stack.vpcCidr;

/**
 * AWS region hosting the fleet.
 *
 * @category outputs
 * @since 0.0.0
 */
export const region = stack.region;

/**
 * Public subnet id in the first availability zone.
 *
 * @category outputs
 * @since 0.0.0
 */
export const publicSubnetAId = stack.publicSubnetAId;

/**
 * Public subnet id in the second availability zone.
 *
 * @category outputs
 * @since 0.0.0
 */
export const publicSubnetBId = stack.publicSubnetBId;

/**
 * Zero-ingress worker security group id.
 *
 * @category outputs
 * @since 0.0.0
 */
export const workerSecurityGroupId = stack.workerSecurityGroupId;

/**
 * Worker launch template id.
 *
 * @category outputs
 * @since 0.0.0
 */
export const launchTemplateId = stack.launchTemplateId;

/**
 * Stable AWS-side launch template name for the future controller.
 *
 * @category outputs
 * @since 0.0.0
 */
export const launchTemplateName = stack.launchTemplateName;

/**
 * Latest launch template version for controller RunInstances calls.
 *
 * @category outputs
 * @since 0.0.0
 */
export const launchTemplateLatestVersion = stack.launchTemplateLatestVersion;

/**
 * AMI id the launch template resolved (pinned override or SSM lookup).
 *
 * @category outputs
 * @since 0.0.0
 */
export const resolvedAmiId = stack.resolvedAmiId;

/**
 * Worker EC2 instance type.
 *
 * @category outputs
 * @since 0.0.0
 */
export const instanceType = stack.instanceType;

/**
 * Name of the reaper Lambda enforcing the fleet TTL.
 *
 * @category outputs
 * @since 0.0.0
 */
export const reaperFunctionName = stack.reaperFunctionName;

/**
 * CloudWatch Logs group receiving VPC flow logs.
 *
 * @category outputs
 * @since 0.0.0
 */
export const flowLogGroupName = stack.flowLogGroupName;
