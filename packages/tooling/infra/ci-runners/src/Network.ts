/**
 * The fleet network: a dedicated VPC with public subnets and an internet
 * gateway, a zero-ingress runner security group and VPC flow logs.
 *
 * @packageDocumentation
 * @category resources
 * @since 0.0.0
 */

import * as EC2 from "@alchemy.run/aws/EC2";
import * as IAM from "@alchemy.run/aws/IAM";
import * as Logs from "@alchemy.run/aws/Logs";
import * as Output from "alchemy/Output";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import { fleetBoundaryPolicyArnFor } from "./DeployRolePolicy.ts";
import type { NetworkSettings, SubnetSlot } from "./Config.ts";
import type { PhysicalNames } from "./Names.ts";

/**
 * Egress the runner security group allows, the live fleet's five rules:
 * HTTPS, HTTP, DNS over TCP and UDP, NTP. There is no ingress rule and no
 * all-protocol rule, so runners accept no inbound or east-west traffic.
 *
 * **Example** (Count the egress rules)
 *
 * ```ts
 * import { runnerEgressRules } from "@beep/infra-ci-runners/Network"
 *
 * console.log(runnerEgressRules.length) // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const runnerEgressRules: ReadonlyArray<EC2.SecurityGroupRuleData> = A.map(
  [
    { ipProtocol: "tcp", port: 443, description: "https" },
    { ipProtocol: "tcp", port: 80, description: "http" },
    { ipProtocol: "tcp", port: 53, description: "dns-tcp" },
    { ipProtocol: "udp", port: 53, description: "dns-udp" },
    { ipProtocol: "udp", port: 123, description: "ntp" },
  ],
  ({ ipProtocol, port, description }) => ({
    ipProtocol,
    fromPort: port,
    toPort: port,
    cidrIpv4: "0.0.0.0/0",
    description,
  })
);

/**
 * Tags on every network object: the stage's fleet name and the live
 * fleet's cost allocation keys `App` and `Project`.
 *
 * **Example** (Tag a production object)
 *
 * ```ts
 * import { networkTags } from "@beep/infra-ci-runners/Network"
 *
 * console.log(networkTags("beep-fleet-prod", "beep-fleet-prod-vpc").Name) // "beep-fleet-prod-vpc"
 * ```
 *
 * @param fleet - The stage's fleet name.
 * @param name - The object's `Name` tag.
 * @returns The tag record.
 * @category constants
 * @since 0.0.0
 */
export const networkTags: {
  (name: string): (fleet: string) => Record<string, string>;
  (fleet: string, name: string): Record<string, string>;
} = dual(
  2,
  (fleet: string, name: string): Record<string, string> => ({
    App: "ci-runners",
    Project: "beep-ci",
    "beep:fleet": fleet,
    Name: name,
  })
);

const flowLogsRole = (names: PhysicalNames, logGroupArn: Output.Output<string>) =>
  IAM.Role("FlowLogsRole", {
    roleName: names.flowLogRole,
    permissionsBoundary: fleetBoundaryPolicyArnFor(names.slug),
    assumeRolePolicyDocument: {
      Version: "2012-10-17",
      Statement: [
        { Effect: "Allow", Principal: { Service: "vpc-flow-logs.amazonaws.com" }, Action: ["sts:AssumeRole"] },
      ],
    },
    inlinePolicies: {
      "flow-logs": {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
            Resource: [Output.interpolate`${logGroupArn}:*`],
          },
          // The flow-logs service calls DescribeLogGroups, which takes no resource-level scope.
          { Effect: "Allow", Action: ["logs:DescribeLogGroups"], Resource: ["*"] },
          // CreateLogGroup is in AWS's flow-log role policy; scoped to this group, it only ever finds it existing.
          { Effect: "Allow", Action: ["logs:CreateLogGroup"], Resource: [logGroupArn] },
        ],
      },
    },
    tags: networkTags(names.fleet, names.flowLogRole),
  });

const publicSubnets = Effect.fn("CiRunners.publicSubnets")(function* (input: {
  readonly network: NetworkSettings;
  readonly names: PhysicalNames;
  readonly vpc: EC2.Vpc;
  readonly routeTable: EC2.RouteTable;
  readonly defaultRoute: EC2.Route;
}) {
  // Keyed by Availability Zone, which the config holds unique: reordering the slots keeps every subnet's identity.
  const declareSubnet = Effect.fnUntraced(function* (slot: SubnetSlot) {
    const id = `PublicSubnet-${slot.availabilityZone}`;
    const name = `${input.names.subnetPrefix}-${slot.availabilityZone}`;
    const subnet = yield* EC2.Subnet(id, {
      vpcId: input.vpc.vpcId,
      availabilityZone: slot.availabilityZone,
      cidrBlock: slot.cidrBlock,
      mapPublicIpOnLaunch: false,
      tags: networkTags(input.names.fleet, name),
    });
    const association = yield* EC2.RouteTableAssociation(`${id}Route`, {
      routeTableId: input.routeTable.routeTableId,
      subnetId: subnet.subnetId,
    });
    // The id handed to the fleet runs through the association and the default route, so the fleet depends on both:
    // destroy removes them, and the internet gateway behind the route, only after the sweep has ended the runners.
    return Output.map(
      Output.all(subnet.subnetId, association.associationId, input.defaultRoute.routeTableId),
      ([subnetId]) => subnetId
    );
  });
  const [first, ...rest] = input.network.subnets;
  // The first subnet is declared on its own so the list stays non-empty by type.
  const head = yield* declareSubnet(first);
  const tail = yield* Effect.forEach(rest, (slot) => declareSubnet(slot), { concurrency: 1 });
  return A.prepend(tail, head);
});

/**
 * Declare the fleet network.
 *
 * **Details**
 *
 * The VPC's default security group is pinned empty, so a runner launched
 * into it by mistake has no ingress and no egress. Subnets do not map public
 * IPs on launch; the runner launch template asks for one per instance.
 * Flow logs record the VPC's accepted and rejected traffic
 * (`trafficType: ALL`) to a log group with the configured retention. VPC Flow Logs do not
 * capture IMDS traffic (169.254.169.254) or queries to the Amazon DNS
 * resolver, so an empty flow log never shows that a runner did not reach
 * IMDS. The logs go through a role trusted only by the flow-logs
 * service.
 *
 * **Example** (Declare the production network)
 *
 * ```ts
 * import { decodeCiRunnersConfig, productionConfig } from "@beep/infra-ci-runners/Config"
 * import { physicalNames } from "@beep/infra-ci-runners/Names"
 * import { declareNetwork } from "@beep/infra-ci-runners/Network"
 * import * as Effect from "effect/Effect"
 *
 * const network = Effect.flatMap(decodeCiRunnersConfig(productionConfig), (config) =>
 *   declareNetwork(config.network, physicalNames("prod"))
 * )
 * console.log(typeof network) // "object"
 * ```
 *
 * @param network - The stage's network settings.
 * @param names - The stage's physical names.
 * @returns The VPC, the subnets and the runner security group.
 * @category resources
 * @since 0.0.0
 */
export const declareNetwork = Effect.fn("CiRunners.declareNetwork")(function* (
  network: NetworkSettings,
  names: PhysicalNames
) {
  const vpc = yield* EC2.Vpc("Vpc", {
    cidrBlock: network.vpcCidr,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: networkTags(names.fleet, names.vpc),
  });
  yield* EC2.DefaultSecurityGroup("DefaultSecurityGroup", { vpcId: vpc.vpcId, ingress: [], egress: [] });
  const internetGateway = yield* EC2.InternetGateway("InternetGateway", {
    vpcId: vpc.vpcId,
    tags: networkTags(names.fleet, names.internetGateway),
  });
  const routeTable = yield* EC2.RouteTable("PublicRouteTable", {
    vpcId: vpc.vpcId,
    tags: networkTags(names.fleet, names.routeTable),
  });
  const defaultRoute = yield* EC2.Route("PublicDefaultRoute", {
    routeTableId: routeTable.routeTableId,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: internetGateway.internetGatewayId,
  });
  const subnetIds = yield* publicSubnets({ network, names, vpc, routeTable, defaultRoute });

  const runnerSecurityGroup = yield* EC2.SecurityGroup("RunnerSecurityGroup", {
    vpcId: vpc.vpcId,
    groupName: names.runnerSecurityGroup,
    description: "beep CI runners: zero ingress, explicit egress allowlist only.",
    ingress: [],
    egress: A.copy(runnerEgressRules),
    tags: networkTags(names.fleet, names.runnerSecurityGroup),
  });

  const flowLogGroup = yield* Logs.LogGroup("FlowLogGroup", {
    logGroupName: names.flowLogGroup,
    retention: Duration.days(network.flowLogRetentionDays),
    tags: networkTags(names.fleet, names.flowLogGroup),
  });
  const role = yield* flowLogsRole(names, flowLogGroup.logGroupArn);
  yield* EC2.FlowLog("FlowLog", {
    resourceType: "VPC",
    resourceId: vpc.vpcId,
    trafficType: "ALL",
    logDestinationType: "cloud-watch-logs",
    logDestination: flowLogGroup.logGroupArn,
    deliverLogsPermissionArn: role.roleArn,
    tags: networkTags(names.fleet, names.flowLog),
  });

  return {
    vpcId: vpc.vpcId,
    subnetIds,
    runnerSecurityGroupId: runnerSecurityGroup.groupId,
    flowLogGroupName: flowLogGroup.logGroupName,
  };
});
