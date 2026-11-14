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
import type { NetworkSettings } from "./Config.ts";
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
    path: names.iamPath,
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
}) {
  return yield* Effect.forEach(
    input.network.subnets,
    Effect.fnUntraced(function* (slot, index) {
      const id = `PublicSubnet${index + 1}`;
      const name = `${input.names.subnetPrefix}-${slot.availabilityZone}`;
      const subnet = yield* EC2.Subnet(id, {
        vpcId: input.vpc.vpcId,
        availabilityZone: slot.availabilityZone,
        cidrBlock: slot.cidrBlock,
        mapPublicIpOnLaunch: false,
        tags: networkTags(input.names.fleet, name),
      });
      yield* EC2.RouteTableAssociation(`${id}Route`, {
        routeTableId: input.routeTable.routeTableId,
        subnetId: subnet.subnetId,
      });
      return subnet;
    })
  );
});

/**
 * Declare the fleet network.
 *
 * **Details**
 *
 * The VPC's default security group is pinned empty, so a runner launched
 * into it by mistake has no ingress and no egress. Subnets do not map public
 * IPs on launch; the runner launch template asks for one per instance.
 * Flow logs record all traffic of the VPC to a log group with the
 * configured retention, through a role trusted only by the flow-logs
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
  yield* EC2.Route("PublicDefaultRoute", {
    routeTableId: routeTable.routeTableId,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: internetGateway.internetGatewayId,
  });
  const subnets = yield* publicSubnets({ network, names, vpc, routeTable });

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
    subnetIds: A.map(subnets, (subnet) => subnet.subnetId),
    runnerSecurityGroupId: runnerSecurityGroup.groupId,
    flowLogGroupName: flowLogGroup.logGroupName,
  };
});
