/**
 * Pulumi orchestration surface for the beep CI ephemeral runner fleet groundwork.
 *
 * Network, worker security group, credential-free spot launch template, VPC flow
 * logs, and the AWS-side reaper ONLY. The scale-from-zero controller and GitHub
 * runner registration are deliberately out of scope (goals/speed-loop/research/
 * o6-execution-plan.md section 3, phase 3): nothing in this module may reference
 * GitHub, and workers carry no IAM identity.
 *
 * **Details**
 *
 * Security gate (restated): the worker credential gate is "no AWS credentials
 * discoverable from a guest", NOT "IMDS unreachable". IMDS stays enabled in
 * IMDSv2-only mode with a hop limit of 1 because EC2 delivers launch-template
 * user-data exclusively through IMDS and the two-minute Spot interruption
 * notice is only observable there; disabling the endpoint would make the
 * bootstrap dead code and hide interruptions from the guest. With no
 * `iamInstanceProfile` anywhere in this stack the IMDS credential endpoint
 * serves nothing, so `aws sts get-caller-identity` still fails from a guest.
 *
 * User-data secrecy law: launch-template user-data is plaintext in Pulumi
 * state, readable via `ec2:DescribeLaunchTemplateVersions`, and written to the
 * guest filesystem by cloud-init, so it must remain permanently non-secret.
 * Runner registration will use single-use JIT config delivered by the
 * controller as a RunInstances-time user-data override, never a value baked
 * into this template and never a long-lived credential or `op://` reference.
 *
 * Containment model (honest wording): assume the guest is hostile. The blast
 * radius is one short-lived VM plus whatever the egress allowlist reaches;
 * containment is the VM's lifetime. The in-guest `shutdown -P` deadline is a
 * convenience backstop the guest can cancel, so the authoritative teardown is
 * the AWS-side reaper in this stack: an EventBridge `rate(5 minutes)` rule
 * drives a Lambda that terminates every instance tagged `beep-ci=runner` whose
 * launch time exceeds `ciRunners:reaperTtlMinutes` (default 90). The reaper's
 * execution role is a Lambda service role, not an instance profile, so the
 * worker no-credentials gate is untouched. Post-job teardown within 5 minutes
 * of job completion is controller scope and remains a deferred gate.
 *
 * AMI policy: when `ciRunners:amiId` is unset the template resolves the
 * Canonical Ubuntu 24.04 amd64 gp3 image through the public SSM parameter — a
 * floating input that re-resolves on every `pulumi up`. Production stacks must
 * pin `ciRunners:amiId` so an unrelated deploy never silently changes the
 * fleet image.
 *
 * Stack bootstrap: no stack yaml is tracked for this project because the
 * passphrase `encryptionsalt` is minted by Pulumi. The operator runs
 * `pulumi login <DIY backend>` and then `pulumi stack init production` inside
 * `infra/ci-runners/`, commits the generated `Pulumi.production.yaml`, and
 * deploys with `pulumi up -s production`. Never assume Pulumi Cloud.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import { A, Bool, O, Str } from "@beep/utils";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { optionalPulumiConfigFields } from "./internal/PulumiConfigSchema.ts";

const $I = $InfraId.create("CiRunners");

const defaultAwsRegion = "us-east-1";
const defaultVpcCidr = "10.88.0.0/16";
const defaultPublicSubnetACidr = "10.88.0.0/20";
const defaultPublicSubnetBCidr = "10.88.16.0/20";
const defaultPublicSubnetCCidr = "10.88.32.0/20";
const defaultPublicSubnetDCidr = "10.88.48.0/20";
const defaultPublicSubnetECidr = "10.88.64.0/20";
// Subnet slots are positions, not zone suffixes: slot E lands in us-east-1f
// because us-east-1e offers none of the fleet's instance types.
const defaultAvailabilityZoneA = "us-east-1a";
const defaultAvailabilityZoneB = "us-east-1b";
const defaultAvailabilityZoneC = "us-east-1c";
const defaultAvailabilityZoneD = "us-east-1d";
const defaultAvailabilityZoneE = "us-east-1f";
const defaultInstanceType = "m7i.2xlarge";
const defaultRootVolumeSizeGb = 100;
const defaultMaxRunMinutes = 60;
const defaultReaperTtlMinutes = 90;
const defaultAmiSsmParameterName = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id";

/**
 * Tag key the launcher user's tag-conditioned Terminate/Stop policy and the
 * in-stack reaper both key on.
 *
 * **Example** (Read the fleet kill-tag pair)
 *
 * ```ts
 * import { ciRunnersRunnerTagKey, ciRunnersRunnerTagValue } from "@beep/infra"
 *
 * console.log(`${ciRunnersRunnerTagKey}=${ciRunnersRunnerTagValue}`)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciRunnersRunnerTagKey = "beep-ci";

/**
 * Tag value stamped on worker instances and volumes launched from the template.
 *
 * **Example** (Build the reaper's tag filter)
 *
 * ```ts
 * import { ciRunnersRunnerTagKey, ciRunnersRunnerTagValue } from "@beep/infra"
 *
 * console.log({ Name: `tag:${ciRunnersRunnerTagKey}`, Values: [ciRunnersRunnerTagValue] })
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciRunnersRunnerTagValue = "runner";

/**
 * Tag value stamped on the stack's own infrastructure resources, distinct from
 * the worker kill tag so the reaper never targets infrastructure.
 *
 * **Example** (Distinguish infra tags from the worker kill tag)
 *
 * ```ts
 * import { ciRunnersInfraTagValue, ciRunnersRunnerTagValue } from "@beep/infra"
 *
 * console.log(ciRunnersInfraTagValue) // "runner-infra" — stack resources, reaper-exempt
 * console.log(ciRunnersRunnerTagValue) // "runner" — workers, reaper kills on TTL
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciRunnersInfraTagValue = "runner-infra";

/**
 * Stable AWS-side launch template name the future controller passes to
 * RunInstances.
 *
 * **Example** (Reference the launch template by name)
 *
 * ```ts
 * import { ciRunnersLaunchTemplateName } from "@beep/infra"
 *
 * console.log(ciRunnersLaunchTemplateName)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciRunnersLaunchTemplateName = "beep-ci-runner";

/**
 * Stable AWS-side name of the zero-ingress worker security group.
 *
 * **Example** (Read the worker security group name)
 *
 * ```ts
 * import { ciRunnersWorkerSecurityGroupName } from "@beep/infra"
 *
 * console.log(ciRunnersWorkerSecurityGroupName)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciRunnersWorkerSecurityGroupName = "beep-ci-runner-workers";

/**
 * Stable AWS-side name of the reaper Lambda that enforces the fleet TTL.
 *
 * **Example** (Read the reaper function name)
 *
 * ```ts
 * import { ciRunnersReaperFunctionName } from "@beep/infra"
 *
 * console.log(ciRunnersReaperFunctionName)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciRunnersReaperFunctionName = "beep-ci-runner-reaper";

const defaultTags = {
  App: "ci-runners",
  ManagedBy: "pulumi",
  Project: "beep-ci",
  [ciRunnersRunnerTagKey]: ciRunnersInfraTagValue,
};

const ipv4CidrPattern =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/(?:3[0-2]|[12]?\d)$/u;
const awsRegionPattern = /^[a-z]{2}(?:-[a-z]+)+-\d$/u;
const availabilityZonePattern = /^[a-z]{2}(?:-[a-z]+)+-\d[a-z]$/u;
const instanceTypePattern =
  /^[a-z][a-z0-9-]*\.(?:nano|micro|small|medium|large|xlarge|\d{1,2}xlarge|metal(?:-\d+xl)?)$/u;
const amiIdPattern = /^ami-[0-9a-f]{8,17}$/u;
const ssmParameterNamePattern = /^\/[A-Za-z0-9_./-]+$/u;

const Ipv4CidrFormat = S.isPattern(ipv4CidrPattern, {
  identifier: $I`Ipv4CidrFormat`,
  title: "IPv4 CIDR Format",
  description: "An IPv4 CIDR block such as 10.88.0.0/16.",
  message: "Expected an IPv4 CIDR block like 10.88.0.0/16",
});

const Ipv4Cidr = S.String.check(Ipv4CidrFormat).pipe(
  $I.annoteSchema("Ipv4Cidr", {
    description: "An IPv4 CIDR block such as 10.88.0.0/16.",
  })
);

const AwsRegionFormat = S.isPattern(awsRegionPattern, {
  identifier: $I`AwsRegionFormat`,
  title: "AWS Region Format",
  description: "An AWS region name such as us-east-1.",
  message: "Expected an AWS region name like us-east-1",
});

const AwsRegion = S.String.check(AwsRegionFormat).pipe(
  $I.annoteSchema("AwsRegion", {
    description: "An AWS region name such as us-east-1.",
  })
);

const AwsAvailabilityZoneFormat = S.isPattern(availabilityZonePattern, {
  identifier: $I`AwsAvailabilityZoneFormat`,
  title: "AWS Availability Zone Format",
  description: "An AWS availability zone name such as us-east-1a.",
  message: "Expected an AWS availability zone name like us-east-1a",
});

const AwsAvailabilityZone = S.String.check(AwsAvailabilityZoneFormat).pipe(
  $I.annoteSchema("AwsAvailabilityZone", {
    description: "An AWS availability zone name such as us-east-1a.",
  })
);

const Ec2InstanceTypeFormat = S.isPattern(instanceTypePattern, {
  identifier: $I`Ec2InstanceTypeFormat`,
  title: "EC2 Instance Type Format",
  description: "An EC2 instance type such as m7i.2xlarge.",
  message: "Expected an EC2 instance type like m7i.2xlarge",
});

const Ec2InstanceType = S.String.check(Ec2InstanceTypeFormat).pipe(
  $I.annoteSchema("Ec2InstanceType", {
    description: "An EC2 instance type such as m7i.2xlarge.",
  })
);

const AmiIdFormat = S.isPattern(amiIdPattern, {
  identifier: $I`AmiIdFormat`,
  title: "AMI ID Format",
  description: "An EC2 machine image id such as ami-0123456789abcdef0.",
  message: "Expected an AMI id like ami-0123456789abcdef0",
});

const AmiId = S.String.check(AmiIdFormat).pipe(
  $I.annoteSchema("AmiId", {
    description: "An EC2 machine image id such as ami-0123456789abcdef0.",
  })
);

const SsmParameterNameFormat = S.isPattern(ssmParameterNamePattern, {
  identifier: $I`SsmParameterNameFormat`,
  title: "SSM Parameter Name Format",
  description:
    "An absolute SSM parameter path such as /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id.",
  message: "Expected an absolute SSM parameter path starting with /",
});

const SsmParameterName = S.String.check(SsmParameterNameFormat).pipe(
  $I.annoteSchema("SsmParameterName", {
    description: "An absolute SSM parameter path.",
  })
);

const RootVolumeSizeGbRange = S.isBetween(
  {
    minimum: 20,
    maximum: 1000,
  },
  {
    identifier: $I`RootVolumeSizeGbRange`,
    title: "Root Volume Size Range",
    description: "A gp3 root volume size in GiB between 20 and 1000.",
    message: "Expected a root volume size between 20 and 1000 GiB",
  }
);

const RootVolumeSizeGb = S.Int.check(RootVolumeSizeGbRange).pipe(
  $I.annoteSchema("RootVolumeSizeGb", {
    description: "A gp3 root volume size in GiB between 20 and 1000.",
  })
);

const MaxRunMinutesRange = S.isBetween(
  {
    minimum: 5,
    maximum: 120,
  },
  {
    identifier: $I`MaxRunMinutesRange`,
    title: "Max Run Minutes Range",
    description: "In-guest self-destruct deadline in minutes between 5 and 120.",
    message: "Expected a max run deadline between 5 and 120 minutes",
  }
);

const MaxRunMinutes = S.Int.check(MaxRunMinutesRange).pipe(
  $I.annoteSchema("MaxRunMinutes", {
    description: "In-guest self-destruct deadline in minutes between 5 and 120.",
  })
);

const ReaperTtlMinutesRange = S.isBetween(
  {
    minimum: 15,
    maximum: 1440,
  },
  {
    identifier: $I`ReaperTtlMinutesRange`,
    title: "Reaper TTL Minutes Range",
    description: "AWS-side reaper instance TTL in minutes between 15 and 1440.",
    message: "Expected a reaper TTL between 15 and 1440 minutes",
  }
);

const ReaperTtlMinutes = S.Int.check(ReaperTtlMinutesRange).pipe(
  $I.annoteSchema("ReaperTtlMinutes", {
    description: "AWS-side reaper instance TTL in minutes between 15 and 1440.",
  })
);

type CiRunnersPulumiConfigValuesFields = {
  readonly amiId?: string | undefined;
  readonly amiSsmParameterName?: string | undefined;
  readonly availabilityZoneA?: string | undefined;
  readonly availabilityZoneB?: string | undefined;
  readonly availabilityZoneC?: string | undefined;
  readonly availabilityZoneD?: string | undefined;
  readonly availabilityZoneE?: string | undefined;
  readonly awsRegion?: string | undefined;
  readonly instanceType?: string | undefined;
  readonly maxRunMinutes?: number | undefined;
  readonly publicSubnetACidr?: string | undefined;
  readonly publicSubnetBCidr?: string | undefined;
  readonly publicSubnetCCidr?: string | undefined;
  readonly publicSubnetDCidr?: string | undefined;
  readonly publicSubnetECidr?: string | undefined;
  readonly reaperTtlMinutes?: number | undefined;
  readonly rootVolumeSizeGb?: number | undefined;
  readonly vpcCidr?: string | undefined;
};

type CiRunnersPulumiConfigInputValues = CiRunnersPulumiConfigValuesFields;

/**
 * Optional Pulumi config values before CI runner groundwork defaults are
 * applied.
 *
 * **Example** (Inspect the config values schema)
 *
 * ```ts
 * import { CiRunnersPulumiConfigValues } from "@beep/infra"
 *
 * console.log(CiRunnersPulumiConfigValues)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiRunnersPulumiConfigValues = S.Class<CiRunnersPulumiConfigValuesFields>($I`CiRunnersPulumiConfigValues`)(
  {
    amiId: AmiId,
    amiSsmParameterName: SsmParameterName,
    availabilityZoneA: AwsAvailabilityZone,
    availabilityZoneB: AwsAvailabilityZone,
    availabilityZoneC: AwsAvailabilityZone,
    availabilityZoneD: AwsAvailabilityZone,
    availabilityZoneE: AwsAvailabilityZone,
    awsRegion: AwsRegion,
    instanceType: Ec2InstanceType,
    maxRunMinutes: MaxRunMinutes,
    publicSubnetACidr: Ipv4Cidr,
    publicSubnetBCidr: Ipv4Cidr,
    publicSubnetCCidr: Ipv4Cidr,
    publicSubnetDCidr: Ipv4Cidr,
    publicSubnetECidr: Ipv4Cidr,
    reaperTtlMinutes: ReaperTtlMinutes,
    rootVolumeSizeGb: RootVolumeSizeGb,
    vpcCidr: Ipv4Cidr,
  },
  $I.annote("CiRunnersPulumiConfigValues", {
    description: "Optional Pulumi config values before CI runner groundwork defaults are applied.",
  })
).mapFields(optionalPulumiConfigFields);

/**
 * Runtime type for {@link CiRunnersPulumiConfigValues}.
 *
 * **Example** (Build an empty config values record)
 *
 * ```ts
 * import type { CiRunnersPulumiConfigValues } from "@beep/infra"
 *
 * const values: CiRunnersPulumiConfigValues = {}
 * console.log(values)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiRunnersPulumiConfigValues = typeof CiRunnersPulumiConfigValues.Type;

const ciRunnersNetworkConfigStruct = S.Struct({
  availabilityZoneA: AwsAvailabilityZone.pipe(
    S.withConstructorDefault(Effect.succeed(defaultAvailabilityZoneA)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultAvailabilityZoneA))
  ),
  availabilityZoneB: AwsAvailabilityZone.pipe(
    S.withConstructorDefault(Effect.succeed(defaultAvailabilityZoneB)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultAvailabilityZoneB))
  ),
  availabilityZoneC: AwsAvailabilityZone.pipe(
    S.withConstructorDefault(Effect.succeed(defaultAvailabilityZoneC)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultAvailabilityZoneC))
  ),
  availabilityZoneD: AwsAvailabilityZone.pipe(
    S.withConstructorDefault(Effect.succeed(defaultAvailabilityZoneD)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultAvailabilityZoneD))
  ),
  availabilityZoneE: AwsAvailabilityZone.pipe(
    S.withConstructorDefault(Effect.succeed(defaultAvailabilityZoneE)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultAvailabilityZoneE))
  ),
  publicSubnetACidr: Ipv4Cidr.pipe(
    S.withConstructorDefault(Effect.succeed(defaultPublicSubnetACidr)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultPublicSubnetACidr))
  ),
  publicSubnetBCidr: Ipv4Cidr.pipe(
    S.withConstructorDefault(Effect.succeed(defaultPublicSubnetBCidr)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultPublicSubnetBCidr))
  ),
  publicSubnetCCidr: Ipv4Cidr.pipe(
    S.withConstructorDefault(Effect.succeed(defaultPublicSubnetCCidr)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultPublicSubnetCCidr))
  ),
  publicSubnetDCidr: Ipv4Cidr.pipe(
    S.withConstructorDefault(Effect.succeed(defaultPublicSubnetDCidr)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultPublicSubnetDCidr))
  ),
  publicSubnetECidr: Ipv4Cidr.pipe(
    S.withConstructorDefault(Effect.succeed(defaultPublicSubnetECidr)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultPublicSubnetECidr))
  ),
  region: AwsRegion.pipe(
    S.withConstructorDefault(Effect.succeed(defaultAwsRegion)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultAwsRegion))
  ),
  vpcCidr: Ipv4Cidr.pipe(
    S.withConstructorDefault(Effect.succeed(defaultVpcCidr)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultVpcCidr))
  ),
});

type CiRunnersNetworkGeometry = typeof ciRunnersNetworkConfigStruct.Type;

const networkAvailabilityZones = (network: CiRunnersNetworkGeometry): ReadonlyArray<string> => [
  network.availabilityZoneA,
  network.availabilityZoneB,
  network.availabilityZoneC,
  network.availabilityZoneD,
  network.availabilityZoneE,
];

const networkPublicSubnetCidrs = (network: CiRunnersNetworkGeometry): ReadonlyArray<string> => [
  network.publicSubnetACidr,
  network.publicSubnetBCidr,
  network.publicSubnetCCidr,
  network.publicSubnetDCidr,
  network.publicSubnetECidr,
];

const CiRunnersNetworkZonesWithinRegionCheck = S.makeFilter<CiRunnersNetworkGeometry>(
  (network) => A.every(networkAvailabilityZones(network), Str.startsWith(network.region)),
  {
    identifier: $I`CiRunnersNetworkZonesWithinRegionCheck`,
    title: "Availability Zones Within Region",
    description: "Every availability zone must belong to the configured AWS region.",
    message: "Expected every availability zone to start with the configured AWS region",
  }
);

const CiRunnersNetworkZonesDistinctCheck = S.makeFilter<CiRunnersNetworkGeometry>(
  (network) => {
    const zones = networkAvailabilityZones(network);
    return A.length(A.dedupe(zones)) === A.length(zones);
  },
  {
    identifier: $I`CiRunnersNetworkZonesDistinctCheck`,
    title: "Availability Zones Distinct",
    description: "Every public subnet must sit in a different availability zone.",
    message: "Expected every public subnet availability zone to be distinct",
  }
);

type CidrRange = {
  readonly start: number;
  readonly end: number;
};

// Ipv4Cidr guarantees the dotted-quad/prefix shape, so the numeric range math
// needs no re-validation. Math (not bitwise) keeps the 32-bit values unsigned.
const cidrRange = (cidr: string): CidrRange => {
  const [quadText = "", prefixText = ""] = Str.split(cidr, "/");
  const value = A.reduce(Str.split(quadText, "."), 0, (total, part) => total * 256 + Number(part));
  const size = 2 ** (32 - Number(prefixText));
  const start = Math.floor(value / size) * size;
  return { start, end: start + size - 1 };
};

const cidrRangeContains = (outer: CidrRange, inner: CidrRange): boolean =>
  Bool.and(outer.start <= inner.start, inner.end <= outer.end);

const cidrRangesDisjoint = (left: CidrRange, right: CidrRange): boolean =>
  Bool.or(left.end < right.start, right.end < left.start);

const CiRunnersSubnetsWithinVpcCheck = S.makeFilter<CiRunnersNetworkGeometry>(
  (network) => {
    const vpc = cidrRange(network.vpcCidr);
    return A.every(networkPublicSubnetCidrs(network), (cidr) => cidrRangeContains(vpc, cidrRange(cidr)));
  },
  {
    identifier: $I`CiRunnersSubnetsWithinVpcCheck`,
    title: "Subnets Within VPC",
    description: "Every public subnet CIDR block must be contained within the VPC CIDR block.",
    message: "Expected every public subnet CIDR block to be contained within the VPC CIDR block",
  }
);

const CiRunnersSubnetsDisjointCheck = S.makeFilter<CiRunnersNetworkGeometry>(
  (network) => {
    const subnets = A.map(networkPublicSubnetCidrs(network), cidrRange);
    return A.every(subnets, (subnet, index) =>
      A.every(A.drop(subnets, index + 1), (other) => cidrRangesDisjoint(subnet, other))
    );
  },
  {
    identifier: $I`CiRunnersSubnetsDisjointCheck`,
    title: "Subnets Disjoint",
    description: "The public subnet CIDR blocks must not overlap each other.",
    message: "Expected the public subnet CIDR blocks not to overlap",
  }
);

/**
 * Dedicated egress-only VPC geometry for the CI runner fleet.
 *
 * **Details**
 *
 * Five public subnets (slots A-E) spread the Spot fleet across five
 * availability zones so one reclaimed capacity pool cannot starve it. Slots
 * are positions, not zone suffixes: the default slot E is `us-east-1f`
 * because `us-east-1e` offers none of the fleet's instance types.
 *
 * Class-level checks reject availability zones outside the configured
 * region, two slots sharing one zone, subnet CIDR blocks that fall outside
 * the VPC CIDR block, and subnet CIDR blocks that overlap each other — so a partial override such
 * as `awsRegion` or `vpcCidr` alone fails fast at config-load time instead
 * of deep inside `pulumi up` after earlier resources have provisioned.
 *
 * **Example** (Apply the network defaults)
 *
 * ```ts
 * import { CiRunnersNetworkConfig } from "@beep/infra"
 *
 * console.log(CiRunnersNetworkConfig.make({}).vpcCidr)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunnersNetworkConfig extends S.Class<CiRunnersNetworkConfig>($I`CiRunnersNetworkConfig`)(
  ciRunnersNetworkConfigStruct.pipe(
    S.check(
      CiRunnersNetworkZonesWithinRegionCheck,
      CiRunnersNetworkZonesDistinctCheck,
      CiRunnersSubnetsWithinVpcCheck,
      CiRunnersSubnetsDisjointCheck
    )
  ),
  $I.annote("CiRunnersNetworkConfig", {
    description: "Dedicated egress-only VPC geometry for the CI runner fleet.",
  })
) {}

/**
 * AMI selection: Canonical Ubuntu 24.04 via public SSM parameter, overridable
 * by a pinned AMI id.
 *
 * **Details**
 *
 * `amiId` unset means a live SSM lookup at deploy time. Production stacks must
 * pin `ciRunners:amiId`; the lockfile-keyed baked-AMI follow-up enters through
 * this same override.
 *
 * **Example** (Read the default SSM parameter path)
 *
 * ```ts
 * import { CiRunnersImageConfig } from "@beep/infra"
 *
 * console.log(CiRunnersImageConfig.make({}).ssmParameterName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunnersImageConfig extends S.Class<CiRunnersImageConfig>($I`CiRunnersImageConfig`)(
  {
    amiId: S.OptionFromOptionalKey(AmiId).pipe(S.withConstructorDefault(Effect.succeedNone)),
    ssmParameterName: SsmParameterName.pipe(
      S.withConstructorDefault(Effect.succeed(defaultAmiSsmParameterName)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultAmiSsmParameterName))
    ),
  },
  $I.annote("CiRunnersImageConfig", {
    description: "AMI selection: Canonical Ubuntu 24.04 via public SSM parameter, overridable by a pinned AMI id.",
  })
) {}

/**
 * Per-worker shape: instance type, root volume, and in-guest self-destruct
 * deadline.
 *
 * **Example** (Read the default worker shape)
 *
 * ```ts
 * import { CiRunnersWorkerConfig } from "@beep/infra"
 *
 * console.log(CiRunnersWorkerConfig.make({}).instanceType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunnersWorkerConfig extends S.Class<CiRunnersWorkerConfig>($I`CiRunnersWorkerConfig`)(
  {
    instanceType: Ec2InstanceType.pipe(
      S.withConstructorDefault(Effect.succeed(defaultInstanceType)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultInstanceType))
    ),
    maxRunMinutes: MaxRunMinutes.pipe(
      S.withConstructorDefault(Effect.succeed(defaultMaxRunMinutes)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultMaxRunMinutes))
    ),
    rootVolumeSizeGb: RootVolumeSizeGb.pipe(
      S.withConstructorDefault(Effect.succeed(defaultRootVolumeSizeGb)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultRootVolumeSizeGb))
    ),
  },
  $I.annote("CiRunnersWorkerConfig", {
    description: "Per-worker shape: instance type, root volume, and in-guest self-destruct deadline.",
  })
) {}

/**
 * AWS-side reaper policy: the fleet-wide instance TTL enforced from outside
 * the guest.
 *
 * **Example** (Read the default reaper TTL)
 *
 * ```ts
 * import { CiRunnersReaperConfig } from "@beep/infra"
 *
 * console.log(CiRunnersReaperConfig.make({}).ttlMinutes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunnersReaperConfig extends S.Class<CiRunnersReaperConfig>($I`CiRunnersReaperConfig`)(
  {
    ttlMinutes: ReaperTtlMinutes.pipe(
      S.withConstructorDefault(Effect.succeed(defaultReaperTtlMinutes)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultReaperTtlMinutes))
    ),
  },
  $I.annote("CiRunnersReaperConfig", {
    description: "AWS-side reaper policy: the fleet-wide instance TTL enforced from outside the guest.",
  })
) {}

/**
 * Pulumi-facing args for the CI runner groundwork stack.
 *
 * **Example** (Construct fully defaulted stack args)
 *
 * ```ts
 * import { CiRunnersStackArgs } from "@beep/infra"
 *
 * console.log(CiRunnersStackArgs.make({}).worker.instanceType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunnersStackArgs extends S.Class<CiRunnersStackArgs>($I`CiRunnersStackArgs`)(
  {
    image: CiRunnersImageConfig.pipe(
      S.withConstructorDefault(Effect.succeed(CiRunnersImageConfig.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    network: CiRunnersNetworkConfig.pipe(
      S.withConstructorDefault(Effect.succeed(CiRunnersNetworkConfig.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    reaper: CiRunnersReaperConfig.pipe(
      S.withConstructorDefault(Effect.succeed(CiRunnersReaperConfig.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    worker: CiRunnersWorkerConfig.pipe(
      S.withConstructorDefault(Effect.succeed(CiRunnersWorkerConfig.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
  },
  $I.annote("CiRunnersStackArgs", {
    description: "Pulumi-facing args for the CI runner groundwork stack.",
  })
) {}

/**
 * Build CI runner stack args from decoded Pulumi config values.
 *
 * **Example** (Pin the AMI while keeping every other default)
 *
 * ```ts
 * import { makeCiRunnersStackArgsFromConfigValues } from "@beep/infra"
 *
 * const args = makeCiRunnersStackArgsFromConfigValues({
 *   amiId: "ami-0123456789abcdef0",
 * })
 *
 * console.log(args.worker.instanceType)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCiRunnersStackArgsFromConfigValues = ({
  amiId,
  amiSsmParameterName,
  availabilityZoneA,
  availabilityZoneB,
  availabilityZoneC,
  availabilityZoneD,
  availabilityZoneE,
  awsRegion,
  instanceType,
  maxRunMinutes,
  publicSubnetACidr,
  publicSubnetBCidr,
  publicSubnetCCidr,
  publicSubnetDCidr,
  publicSubnetECidr,
  reaperTtlMinutes,
  rootVolumeSizeGb,
  vpcCidr,
}: CiRunnersPulumiConfigInputValues = {}): CiRunnersStackArgs =>
  CiRunnersStackArgs.make({
    image: CiRunnersImageConfig.make({
      ...O.getSomesStruct({ ssmParameterName: O.fromUndefinedOr(amiSsmParameterName) }),
      amiId: O.fromUndefinedOr(amiId),
    }),
    network: CiRunnersNetworkConfig.make(
      O.getSomesStruct({
        availabilityZoneA: O.fromUndefinedOr(availabilityZoneA),
        availabilityZoneB: O.fromUndefinedOr(availabilityZoneB),
        availabilityZoneC: O.fromUndefinedOr(availabilityZoneC),
        availabilityZoneD: O.fromUndefinedOr(availabilityZoneD),
        availabilityZoneE: O.fromUndefinedOr(availabilityZoneE),
        publicSubnetACidr: O.fromUndefinedOr(publicSubnetACidr),
        publicSubnetBCidr: O.fromUndefinedOr(publicSubnetBCidr),
        publicSubnetCCidr: O.fromUndefinedOr(publicSubnetCCidr),
        publicSubnetDCidr: O.fromUndefinedOr(publicSubnetDCidr),
        publicSubnetECidr: O.fromUndefinedOr(publicSubnetECidr),
        region: O.fromUndefinedOr(awsRegion),
        vpcCidr: O.fromUndefinedOr(vpcCidr),
      })
    ),
    reaper: CiRunnersReaperConfig.make(
      O.getSomesStruct({
        ttlMinutes: O.fromUndefinedOr(reaperTtlMinutes),
      })
    ),
    worker: CiRunnersWorkerConfig.make(
      O.getSomesStruct({
        instanceType: O.fromUndefinedOr(instanceType),
        maxRunMinutes: O.fromUndefinedOr(maxRunMinutes),
        rootVolumeSizeGb: O.fromUndefinedOr(rootVolumeSizeGb),
      })
    ),
  });

/**
 * Load CI runner stack args from Pulumi config.
 *
 * **Example** (Load args inside a Pulumi program)
 *
 * ```ts
 * import { loadCiRunnersStackArgs } from "@beep/infra"
 *
 * console.log(loadCiRunnersStackArgs)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadCiRunnersStackArgs = (): CiRunnersStackArgs => {
  const config = new pulumi.Config("ciRunners");

  return makeCiRunnersStackArgsFromConfigValues({
    amiId: config.get("amiId"),
    amiSsmParameterName: config.get("amiSsmParameterName"),
    availabilityZoneA: config.get("availabilityZoneA"),
    availabilityZoneB: config.get("availabilityZoneB"),
    availabilityZoneC: config.get("availabilityZoneC"),
    availabilityZoneD: config.get("availabilityZoneD"),
    availabilityZoneE: config.get("availabilityZoneE"),
    awsRegion: config.get("awsRegion"),
    instanceType: config.get("instanceType"),
    maxRunMinutes: config.getNumber("maxRunMinutes"),
    publicSubnetACidr: config.get("publicSubnetACidr"),
    publicSubnetBCidr: config.get("publicSubnetBCidr"),
    publicSubnetCCidr: config.get("publicSubnetCCidr"),
    publicSubnetDCidr: config.get("publicSubnetDCidr"),
    publicSubnetECidr: config.get("publicSubnetECidr"),
    reaperTtlMinutes: config.getNumber("reaperTtlMinutes"),
    rootVolumeSizeGb: config.getNumber("rootVolumeSizeGb"),
    vpcCidr: config.get("vpcCidr"),
  });
};

const renderCiRunnerBootstrapUserData = (maxRunMinutes: number): string => {
  const script = A.join(
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "",
      "# beep-ci runner groundwork bootstrap stub.",
      "# GitHub registration is OUT OF SCOPE for this stack: the future controller",
      "# supplies the real per-job bootstrap via a RunInstances user-data override",
      "# carrying single-use JIT runner config, never long-lived credentials.",
      "",
      "# In-guest ephemerality backstop, armed FIRST so a later bootstrap failure can",
      "# never disarm it: with instanceInitiatedShutdownBehavior=terminate, this",
      "# power-off terminates the VM even if no controller ever exists. A hostile",
      "# guest can cancel it; the AWS-side reaper is the authority it cannot touch.",
      `shutdown -P +${maxRunMinutes}`,
      "",
      "install -d -m 0755 /opt/beep-ci",
      "printf 'groundwork\\n' > /opt/beep-ci/runner-stage",
      "",
      "# IMDSv2 round-trip: proves user-data delivery works and gives every worker a",
      "# unique hostname so per-instance log correlation survives fleet forensics.",
      "# Hostname is a nicety — tolerate IMDS hiccups rather than abort the bootstrap.",
      "if imds_token=\"$(curl -fsS -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)\" \\",
      '  && instance_id="$(curl -fsS -H "X-aws-ec2-metadata-token: ${imds_token}" http://169.254.169.254/latest/meta-data/instance-id)"; then',
      '  hostnamectl set-hostname "beep-ci-runner-${instance_id}"',
      "fi",
      "",
    ],
    "\n"
  );

  // Global Buffer, deliberately no `node:buffer` import: static node builtin
  // imports are gated in typechecked src.
  return Buffer.from(script, "utf8").toString("base64");
};

const renderCiRunnersReaperHandlerSource = (): string =>
  A.join(
    [
      'import { DescribeInstancesCommand, EC2Client, TerminateInstancesCommand } from "@aws-sdk/client-ec2";',
      "",
      "const client = new EC2Client({});",
      "const ttlMinutes = Number(process.env.BEEP_CI_REAPER_TTL_MINUTES);",
      "if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {",
      "  // Fail loud: a silent NaN cutoff would reap nothing while logging success,",
      "  // and this function is the teardown authority the guest cannot touch.",
      "  throw new Error(`BEEP_CI_REAPER_TTL_MINUTES is not a positive number: ${process.env.BEEP_CI_REAPER_TTL_MINUTES}`);",
      "}",
      "const ttlMilliseconds = ttlMinutes * 60000;",
      "",
      "export const handler = async () => {",
      "  const cutoff = Date.now() - ttlMilliseconds;",
      "  const expired = [];",
      "  let nextToken = undefined;",
      "  do {",
      "    const page = await client.send(",
      "      new DescribeInstancesCommand({",
      "        Filters: [",
      `          { Name: "tag:${ciRunnersRunnerTagKey}", Values: ["${ciRunnersRunnerTagValue}"] },`,
      '          { Name: "instance-state-name", Values: ["pending", "running", "stopping", "stopped"] },',
      "        ],",
      "        NextToken: nextToken,",
      "      })",
      "    );",
      "    for (const reservation of page.Reservations ?? []) {",
      "      for (const instance of reservation.Instances ?? []) {",
      "        if (",
      "          instance.InstanceId !== undefined &&",
      "          instance.LaunchTime !== undefined &&",
      "          instance.LaunchTime.getTime() < cutoff",
      "        ) {",
      "          expired.push(instance.InstanceId);",
      "        }",
      "      }",
      "    }",
      "    nextToken = page.NextToken;",
      "  } while (nextToken !== undefined);",
      "  if (expired.length > 0) {",
      "    await client.send(new TerminateInstancesCommand({ InstanceIds: expired }));",
      "  }",
      "  console.log(JSON.stringify({ reapedInstanceIds: expired, ttlMinutes }));",
      "  return { reapedInstanceIds: expired };",
      "};",
      "",
    ],
    "\n"
  );

const lambdaAssumeRolePolicy = JSON.stringify({
  Statement: [
    {
      Action: "sts:AssumeRole",
      Effect: "Allow",
      Principal: {
        Service: "lambda.amazonaws.com",
      },
    },
  ],
  Version: "2012-10-17",
});

const flowLogsAssumeRolePolicy = JSON.stringify({
  Statement: [
    {
      Action: "sts:AssumeRole",
      Effect: "Allow",
      Principal: {
        Service: "vpc-flow-logs.amazonaws.com",
      },
    },
  ],
  Version: "2012-10-17",
});

const reaperRolePolicyDocument = (logGroupArn: pulumi.Output<string>): pulumi.Output<string> =>
  logGroupArn.apply((arn) =>
    JSON.stringify({
      Statement: [
        {
          Action: "ec2:DescribeInstances",
          Effect: "Allow",
          Resource: "*",
          Sid: "DescribeFleet",
        },
        {
          Action: "ec2:TerminateInstances",
          Condition: {
            StringEquals: {
              [`ec2:ResourceTag/${ciRunnersRunnerTagKey}`]: ciRunnersRunnerTagValue,
            },
          },
          Effect: "Allow",
          Resource: "*",
          Sid: "TerminateTaggedRunnersOnly",
        },
        {
          Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
          Effect: "Allow",
          Resource: `${arn}:*`,
          Sid: "WriteOwnLogs",
        },
      ],
      Version: "2012-10-17",
    })
  );

const flowLogsRolePolicyDocument = (logGroupArn: pulumi.Output<string>): pulumi.Output<string> =>
  logGroupArn.apply((arn) =>
    JSON.stringify({
      Statement: [
        {
          Action: ["logs:CreateLogStream", "logs:DescribeLogGroups", "logs:DescribeLogStreams", "logs:PutLogEvents"],
          Effect: "Allow",
          Resource: [arn, `${arn}:*`],
          Sid: "DeliverFlowLogs",
        },
      ],
      Version: "2012-10-17",
    })
  );

/**
 * Import-safe Pulumi component for the beep CI ephemeral runner fleet
 * groundwork: egress-only VPC, zero-ingress worker security group,
 * credential-free spot launch template, VPC flow logs, and the AWS-side
 * reaper.
 *
 * **Example** (Reference the component and its config loader)
 *
 * ```ts
 * import { CiRunnersStack, makeCiRunnersStackArgsFromConfigValues } from "@beep/infra"
 *
 * console.log(CiRunnersStack)
 * console.log(makeCiRunnersStackArgsFromConfigValues)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export class CiRunnersStack extends pulumi.ComponentResource {
  /**
   * Dedicated fleet VPC identifier.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly vpcId: pulumi.Output<string>;

  /**
   * Dedicated fleet VPC CIDR block.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly vpcCidr: pulumi.Output<string>;

  /**
   * AWS region hosting the fleet.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly region: pulumi.Output<string>;

  /**
   * Public subnet id in the first availability zone, resolved only once the
   * subnet is routed to the internet gateway.
   *
   * **Example** (Read the routed subnet A id under Pulumi mocks)
   *
   * ```ts
   * import { CiRunnersStack } from "@beep/infra"
   * import * as pulumi from "@pulumi/pulumi"
   *
   * await pulumi.runtime.setMocks({
   *   call: () => ({}),
   *   newResource: ({ name, inputs }) => ({ id: `${name}-id`, state: inputs }),
   * })
   *
   * const stack = new CiRunnersStack("ci-runners")
   * stack.publicSubnetAId.apply((subnetId) => console.log(subnetId)) // "ci-runners-public-a-id"
   * ```
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly publicSubnetAId: pulumi.Output<string>;

  /**
   * Public subnet id in the second availability zone, resolved only once the
   * subnet is routed to the internet gateway.
   *
   * **Example** (Read the routed subnet B id under Pulumi mocks)
   *
   * ```ts
   * import { CiRunnersStack } from "@beep/infra"
   * import * as pulumi from "@pulumi/pulumi"
   *
   * await pulumi.runtime.setMocks({
   *   call: () => ({}),
   *   newResource: ({ name, inputs }) => ({ id: `${name}-id`, state: inputs }),
   * })
   *
   * const stack = new CiRunnersStack("ci-runners")
   * stack.publicSubnetBId.apply((subnetId) => console.log(subnetId)) // "ci-runners-public-b-id"
   * ```
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly publicSubnetBId: pulumi.Output<string>;

  /**
   * Public subnet id in the third availability zone, resolved only once the
   * subnet is routed to the internet gateway.
   *
   * **Example** (Read the routed subnet C id under Pulumi mocks)
   *
   * ```ts
   * import { CiRunnersStack } from "@beep/infra"
   * import * as pulumi from "@pulumi/pulumi"
   *
   * await pulumi.runtime.setMocks({
   *   call: () => ({}),
   *   newResource: ({ name, inputs }) => ({ id: `${name}-id`, state: inputs }),
   * })
   *
   * const stack = new CiRunnersStack("ci-runners")
   * stack.publicSubnetCId.apply((subnetId) => console.log(subnetId)) // "ci-runners-public-c-id"
   * ```
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly publicSubnetCId: pulumi.Output<string>;

  /**
   * Public subnet id in the fourth availability zone, resolved only once the
   * subnet is routed to the internet gateway.
   *
   * **Example** (Read the routed subnet D id under Pulumi mocks)
   *
   * ```ts
   * import { CiRunnersStack } from "@beep/infra"
   * import * as pulumi from "@pulumi/pulumi"
   *
   * await pulumi.runtime.setMocks({
   *   call: () => ({}),
   *   newResource: ({ name, inputs }) => ({ id: `${name}-id`, state: inputs }),
   * })
   *
   * const stack = new CiRunnersStack("ci-runners")
   * stack.publicSubnetDId.apply((subnetId) => console.log(subnetId)) // "ci-runners-public-d-id"
   * ```
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly publicSubnetDId: pulumi.Output<string>;

  /**
   * Public subnet id in the fifth availability zone, resolved only once the
   * subnet is routed to the internet gateway.
   *
   * **Example** (Read the routed subnet E id under Pulumi mocks)
   *
   * ```ts
   * import { CiRunnersStack } from "@beep/infra"
   * import * as pulumi from "@pulumi/pulumi"
   *
   * await pulumi.runtime.setMocks({
   *   call: () => ({}),
   *   newResource: ({ name, inputs }) => ({ id: `${name}-id`, state: inputs }),
   * })
   *
   * const stack = new CiRunnersStack("ci-runners")
   * stack.publicSubnetEId.apply((subnetId) => console.log(subnetId)) // "ci-runners-public-e-id"
   * ```
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly publicSubnetEId: pulumi.Output<string>;

  /**
   * Zero-ingress worker security group id.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly workerSecurityGroupId: pulumi.Output<string>;

  /**
   * Worker launch template id.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly launchTemplateId: pulumi.Output<string>;

  /**
   * Stable AWS-side launch template name for the future controller.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly launchTemplateName: pulumi.Output<string>;

  /**
   * Latest launch template version; the controller passes this number to
   * RunInstances because default-version promotion is deliberate.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly launchTemplateLatestVersion: pulumi.Output<number>;

  /**
   * AMI id the launch template resolved (pinned override or SSM lookup).
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly resolvedAmiId: pulumi.Output<string>;

  /**
   * Worker EC2 instance type.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly instanceType: pulumi.Output<string>;

  /**
   * Name of the reaper Lambda enforcing the fleet TTL.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly reaperFunctionName: pulumi.Output<string>;

  /**
   * CloudWatch Logs group receiving VPC flow logs.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly flowLogGroupName: pulumi.Output<string>;

  public constructor(
    name: string,
    args: CiRunnersStackArgs = CiRunnersStackArgs.make({}),
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("beep:infra:CiRunnersStack", name, {}, opts);

    const vpc = new aws.ec2.Vpc(
      `${name}-vpc`,
      {
        cidrBlock: args.network.vpcCidr,
        enableDnsHostnames: true,
        enableDnsSupport: true,
        region: args.network.region,
        tags: { ...defaultTags, Name: "beep-ci-runners-vpc" },
      },
      { parent: this }
    );

    // Pin the VPC's default security group empty: a worker that lands on it via
    // a RunInstances override still has zero ingress and zero egress.
    new aws.ec2.DefaultSecurityGroup(
      `${name}-default-sg`,
      {
        egress: [],
        ingress: [],
        region: args.network.region,
        tags: { ...defaultTags, Name: "beep-ci-runners-default-DO-NOT-USE" },
        vpcId: vpc.id,
      },
      { parent: this }
    );

    const igw = new aws.ec2.InternetGateway(
      `${name}-igw`,
      {
        region: args.network.region,
        tags: { ...defaultTags, Name: "beep-ci-runners-igw" },
        vpcId: vpc.id,
      },
      { parent: this }
    );

    const publicRouteTable = new aws.ec2.RouteTable(
      `${name}-public-rt`,
      {
        region: args.network.region,
        tags: { ...defaultTags, Name: "beep-ci-runners-public" },
        vpcId: vpc.id,
      },
      { parent: this }
    );

    const publicDefaultRoute = new aws.ec2.Route(
      `${name}-public-default-route`,
      {
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: igw.id,
        region: args.network.region,
        routeTableId: publicRouteTable.id,
      },
      { parent: this }
    );

    // Resource names keep the per-slot `public-<slot>` spelling, so slots A and
    // B stay the same Pulumi resources while the fleet widens to five zones.
    // The returned id resolves only after the subnet's route-table association
    // and the default route exist: the controller receives it as a launch
    // target, and a worker started in a subnet without that route has no
    // egress and never registers.
    const makePublicSubnet = (slot: string, availabilityZone: string, cidrBlock: string): pulumi.Output<string> => {
      const subnet = new aws.ec2.Subnet(
        `${name}-public-${slot}`,
        {
          availabilityZone,
          cidrBlock,
          mapPublicIpOnLaunch: false,
          region: args.network.region,
          tags: { ...defaultTags, Name: `beep-ci-runners-public-${slot}` },
          vpcId: vpc.id,
        },
        { parent: this }
      );

      const association = new aws.ec2.RouteTableAssociation(
        `${name}-public-${slot}-rta`,
        {
          region: args.network.region,
          routeTableId: publicRouteTable.id,
          subnetId: subnet.id,
        },
        { parent: this }
      );

      return pulumi.all([subnet.id, association.id, publicDefaultRoute.id]).apply(([subnetId]) => subnetId);
    };

    const publicSubnetAId = makePublicSubnet("a", args.network.availabilityZoneA, args.network.publicSubnetACidr);
    const publicSubnetBId = makePublicSubnet("b", args.network.availabilityZoneB, args.network.publicSubnetBCidr);
    const publicSubnetCId = makePublicSubnet("c", args.network.availabilityZoneC, args.network.publicSubnetCCidr);
    const publicSubnetDId = makePublicSubnet("d", args.network.availabilityZoneD, args.network.publicSubnetDCidr);
    const publicSubnetEId = makePublicSubnet("e", args.network.availabilityZoneE, args.network.publicSubnetECidr);

    // Worker SG: ZERO ingress rules — that single fact enforces both no-inbound
    // and no-east-west (SG-member traffic requires a receiver-side ingress
    // allow; there is none, and no self-reference rule).
    const workerSecurityGroup = new aws.ec2.SecurityGroup(
      `${name}-worker-sg`,
      {
        description: "beep CI ephemeral runner workers: zero ingress, explicit egress allowlist only.",
        name: ciRunnersWorkerSecurityGroupName,
        region: args.network.region,
        revokeRulesOnDelete: true,
        tags: { ...defaultTags, Name: ciRunnersWorkerSecurityGroupName },
        vpcId: vpc.id,
      },
      { deleteBeforeReplace: true, parent: this }
    );

    // Exactly five egress rules; NO all-protocol (-1) rule and NO ingress rule
    // resources anywhere in this stack.
    const egressRule = (suffix: string, ipProtocol: string, port: number) =>
      new aws.vpc.SecurityGroupEgressRule(
        `${name}-egress-${suffix}`,
        {
          cidrIpv4: "0.0.0.0/0",
          fromPort: port,
          ipProtocol,
          region: args.network.region,
          securityGroupId: workerSecurityGroup.id,
          tags: defaultTags,
          toPort: port,
        },
        { parent: this }
      );
    egressRule("https", "tcp", 443);
    egressRule("http", "tcp", 80);
    egressRule("dns-tcp", "tcp", 53);
    egressRule("dns-udp", "udp", 53);
    egressRule("ntp", "udp", 123);

    // VPC flow logs: the evidence stream drift and abort decisions fire on.
    const flowLogGroup = new aws.cloudwatch.LogGroup(
      `${name}-flow-logs`,
      {
        name: "/beep-ci/runners/vpc-flow-logs",
        region: args.network.region,
        retentionInDays: 14,
        tags: defaultTags,
      },
      { parent: this }
    );

    const flowLogsRole = new aws.iam.Role(
      `${name}-flow-logs-role`,
      {
        assumeRolePolicy: flowLogsAssumeRolePolicy,
        tags: defaultTags,
      },
      { parent: this }
    );

    const flowLogsRolePolicy = new aws.iam.RolePolicy(
      `${name}-flow-logs-role-policy`,
      {
        policy: flowLogsRolePolicyDocument(flowLogGroup.arn),
        role: flowLogsRole.id,
      },
      { parent: this }
    );

    new aws.ec2.FlowLog(
      `${name}-flow-log`,
      {
        iamRoleArn: flowLogsRole.arn,
        logDestination: flowLogGroup.arn,
        logDestinationType: "cloud-watch-logs",
        region: args.network.region,
        tags: { ...defaultTags, Name: "beep-ci-runners-flow-log" },
        trafficType: "ALL",
        vpcId: vpc.id,
      },
      { dependsOn: [flowLogsRolePolicy], parent: this }
    );

    const resolvedAmiId = O.match(args.image.amiId, {
      onNone: () =>
        aws.ssm.getParameterOutput(
          {
            name: args.image.ssmParameterName,
            region: args.network.region,
          },
          { parent: this }
        ).value,
      onSome: (amiId) => pulumi.output(amiId),
    });

    const launchTemplate = new aws.ec2.LaunchTemplate(
      `${name}-launch-template`,
      {
        blockDeviceMappings: [
          {
            // Canonical Ubuntu AMIs register the root device as /dev/sda1.
            deviceName: "/dev/sda1",
            ebs: {
              // GOTCHA: the provider types several booleans here as Input<string>.
              deleteOnTermination: "true",
              encrypted: "true",
              iops: 3000,
              throughput: 250,
              volumeSize: args.worker.rootVolumeSizeGb,
              volumeType: "gp3",
            },
          },
        ],
        description:
          "beep CI ephemeral one-job-one-VM spot runner groundwork: no instance profile, IMDSv2-only, egress-only.",
        ebsOptimized: "true",
        imageId: resolvedAmiId,
        // `shutdown` inside the guest terminates, not stops.
        instanceInitiatedShutdownBehavior: "terminate",
        instanceMarketOptions: {
          marketType: "spot",
          // No maxPrice: defaults to the on-demand cap, the recommended posture.
          spotOptions: {
            instanceInterruptionBehavior: "terminate",
            spotInstanceType: "one-time",
          },
        },
        instanceType: args.worker.instanceType,
        // IMDS stays ENABLED (IMDSv2-only, hop limit 1): user-data delivery and
        // the Spot interruption notice both ride IMDS, and with no instance
        // profile the credential endpoint serves nothing. The security gate is
        // "no AWS credentials discoverable", not "IMDS unreachable".
        metadataOptions: {
          httpEndpoint: "enabled",
          httpPutResponseHopLimit: 1,
          httpTokens: "required",
        },
        name: ciRunnersLaunchTemplateName,
        networkInterfaces: [
          {
            // Egress via IGW + public IP: no NAT gateway cost; SG blocks all inbound.
            associatePublicIpAddress: "true",
            deleteOnTermination: "true",
            deviceIndex: 0,
            securityGroups: [workerSecurityGroup.id],
            // subnetId deliberately omitted: the launcher picks subnet/AZ per
            // RunInstances for Spot diversification.
          },
        ],
        region: args.network.region,
        tagSpecifications: [
          {
            resourceType: "instance",
            tags: { ...defaultTags, Name: "beep-ci-runner", [ciRunnersRunnerTagKey]: ciRunnersRunnerTagValue },
          },
          {
            resourceType: "volume",
            tags: { ...defaultTags, Name: "beep-ci-runner", [ciRunnersRunnerTagKey]: ciRunnersRunnerTagValue },
          },
        ],
        tags: { ...defaultTags, Name: ciRunnersLaunchTemplateName },
        // Default-version promotion is deliberate: the controller consumes the
        // exported latest version number, not $Default.
        updateDefaultVersion: false,
        userData: renderCiRunnerBootstrapUserData(args.worker.maxRunMinutes),
        // DELIBERATELY ABSENT (hard constraints): iamInstanceProfile (no
        // instance identity at all), keyName (no SSH), monitoring (basic only).
        // Adding any of these is a security regression.
      },
      { deleteBeforeReplace: true, parent: this }
    );

    // AWS-side reaper: EventBridge rate(5 minutes) -> Lambda terminating every
    // instance tagged beep-ci=runner older than the TTL. Service role on the
    // Lambda, never an instance profile on workers.
    const reaperLogGroup = new aws.cloudwatch.LogGroup(
      `${name}-reaper-logs`,
      {
        name: `/aws/lambda/${ciRunnersReaperFunctionName}`,
        region: args.network.region,
        retentionInDays: 14,
        tags: defaultTags,
      },
      { parent: this }
    );

    const reaperRole = new aws.iam.Role(
      `${name}-reaper-role`,
      {
        assumeRolePolicy: lambdaAssumeRolePolicy,
        tags: defaultTags,
      },
      { parent: this }
    );

    const reaperRolePolicy = new aws.iam.RolePolicy(
      `${name}-reaper-role-policy`,
      {
        policy: reaperRolePolicyDocument(reaperLogGroup.arn),
        role: reaperRole.id,
      },
      { parent: this }
    );

    const reaperFunction = new aws.lambda.Function(
      `${name}-reaper`,
      {
        code: new pulumi.asset.AssetArchive({
          "index.mjs": new pulumi.asset.StringAsset(renderCiRunnersReaperHandlerSource()),
        }),
        description: "Terminates beep-ci=runner instances whose launch time exceeds the fleet TTL.",
        environment: {
          variables: {
            BEEP_CI_REAPER_TTL_MINUTES: `${args.reaper.ttlMinutes}`,
          },
        },
        handler: "index.handler",
        name: ciRunnersReaperFunctionName,
        region: args.network.region,
        role: reaperRole.arn,
        runtime: "nodejs22.x",
        tags: defaultTags,
        timeout: 60,
      },
      { dependsOn: [reaperLogGroup, reaperRolePolicy], parent: this }
    );

    const reaperSchedule = new aws.cloudwatch.EventRule(
      `${name}-reaper-schedule`,
      {
        description: "beep CI runner fleet reaper cadence.",
        region: args.network.region,
        scheduleExpression: "rate(5 minutes)",
        tags: defaultTags,
      },
      { parent: this }
    );

    new aws.cloudwatch.EventTarget(
      `${name}-reaper-target`,
      {
        arn: reaperFunction.arn,
        region: args.network.region,
        rule: reaperSchedule.name,
      },
      { parent: this }
    );

    new aws.lambda.Permission(
      `${name}-reaper-permission`,
      {
        action: "lambda:InvokeFunction",
        function: reaperFunction.name,
        principal: "events.amazonaws.com",
        region: args.network.region,
        sourceArn: reaperSchedule.arn,
      },
      { parent: this }
    );

    this.vpcId = vpc.id;
    this.vpcCidr = pulumi.output(args.network.vpcCidr);
    this.region = pulumi.output(args.network.region);
    this.publicSubnetAId = publicSubnetAId;
    this.publicSubnetBId = publicSubnetBId;
    this.publicSubnetCId = publicSubnetCId;
    this.publicSubnetDId = publicSubnetDId;
    this.publicSubnetEId = publicSubnetEId;
    this.workerSecurityGroupId = workerSecurityGroup.id;
    this.launchTemplateId = launchTemplate.id;
    this.launchTemplateName = pulumi.output(ciRunnersLaunchTemplateName);
    this.launchTemplateLatestVersion = launchTemplate.latestVersion;
    this.resolvedAmiId = resolvedAmiId;
    this.instanceType = pulumi.output(args.worker.instanceType);
    this.reaperFunctionName = reaperFunction.name;
    this.flowLogGroupName = flowLogGroup.name;

    this.registerOutputs({
      flowLogGroupName: this.flowLogGroupName,
      instanceType: this.instanceType,
      launchTemplateId: this.launchTemplateId,
      launchTemplateLatestVersion: this.launchTemplateLatestVersion,
      launchTemplateName: this.launchTemplateName,
      publicSubnetAId: this.publicSubnetAId,
      publicSubnetBId: this.publicSubnetBId,
      publicSubnetCId: this.publicSubnetCId,
      publicSubnetDId: this.publicSubnetDId,
      publicSubnetEId: this.publicSubnetEId,
      reaperFunctionName: this.reaperFunctionName,
      region: this.region,
      resolvedAmiId: this.resolvedAmiId,
      vpcCidr: this.vpcCidr,
      vpcId: this.vpcId,
      workerSecurityGroupId: this.workerSecurityGroupId,
    });
  }
}
