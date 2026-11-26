/**
 * Typed configuration of the `CiRunners` stack: the guarded account, the
 * fleet network, the runner image, the two pools and the Spot vCPU budget
 * they must fit.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { AwsAccountId } from "@beep/alchemy-aws-extras/DeployTarget";
import { RunnerType } from "@beep/alchemy-github-runners/RunnerPool.models";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { $InfraCiRunnersId } from "./internal/InfraCiRunnersId.ts";

const $I = $InfraCiRunnersId.create("Config");

/**
 * **Example** (Read the pinned region)
 *
 * ```ts
 * import { FleetRegion } from "@beep/infra-ci-runners/Config"
 *
 * console.log(FleetRegion.Enum["us-east-1"]) // "us-east-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetRegion = LiteralKit(["us-east-1"]).pipe(
  $I.annoteSchema("FleetRegion", { description: "The region the runner fleet runs in." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type FleetRegion = typeof FleetRegion.Type;

/**
 * The 64 GiB x86_64 instance types the pools launch.
 *
 * **Details**
 *
 * The heavy pool uses all five (25 Spot capacity pools across five
 * subnets); the shard-overflow pool uses the two 8-vCPU types. Carried
 * over from the Pulumi `CiRunnerPool` profiles, less two types the live
 * fleet's Spot evictions ruled out: `r7a.2xlarge` (2026-11-19, decision
 * `2026-11-19-drop-r7a-2xlarge-from-the-new-fleet`) and `m6i.4xlarge`
 * (2026-11-20, decision `2026-11-20-drop-m6i-4xlarge-from-the-new-heavy-pool`),
 * both in `goals/infra-alchemy-rebuild`.
 *
 * **Example** (List the instance types)
 *
 * ```ts
 * import { RunnerInstanceType } from "@beep/infra-ci-runners/Config"
 *
 * console.log(RunnerInstanceType.literals.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerInstanceType = LiteralKit([
  "r7i.2xlarge",
  "r6i.2xlarge",
  "m7a.4xlarge",
  "m7i.4xlarge",
  "m6a.4xlarge",
]).pipe($I.annoteSchema("RunnerInstanceType", { description: "An EC2 instance type a runner pool may launch." }));

/**
 * @category models
 * @since 0.0.0
 */
export type RunnerInstanceType = typeof RunnerInstanceType.Type;

/**
 * vCPUs of one instance of a type, as the Spot vCPU quota counts them.
 *
 * **Example** (Count an overflow runner)
 *
 * ```ts
 * import { instanceVcpus } from "@beep/infra-ci-runners/Config"
 *
 * console.log(instanceVcpus("r7i.2xlarge")) // 8
 * ```
 *
 * @param type - One of the five 64 GiB x86_64 types.
 * @returns Its vCPU count.
 * @category models
 * @since 0.0.0
 */
export const instanceVcpus = (type: RunnerInstanceType): number =>
  RunnerInstanceType.match(type, {
    "r7i.2xlarge": () => 8,
    "r6i.2xlarge": () => 8,
    "m7a.4xlarge": () => 16,
    "m7i.4xlarge": () => 16,
    "m6a.4xlarge": () => 16,
  });

/**
 * Which caps the pools run at.
 *
 * **Details**
 *
 * `overlap` is the phase beside the live Pulumi fleet: each pool runs at its
 * small `overlapMaximumCount` and the budget reserves the live fleet's
 * worst case. `primary` follows the move of `heavy.yml`, `check.yml` and
 * `shard-overflow.yml` onto this fleet: each pool runs at its live
 * `maximumCount` and nothing is reserved, because no workflow targets the
 * live fleet's labels any more.
 *
 * **Example** (Read the phases)
 *
 * ```ts
 * import { FleetPhase } from "@beep/infra-ci-runners/Config"
 *
 * console.log(FleetPhase.Enum.overlap) // "overlap"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetPhase = LiteralKit(["overlap", "primary"]).pipe(
  $I.annoteSchema("FleetPhase", { description: "Whether the fleet runs beside the live fleet or replaces it." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type FleetPhase = typeof FleetPhase.Type;

/**
 * **Example** (Read the pool names)
 *
 * ```ts
 * import { PoolName } from "@beep/infra-ci-runners/Config"
 *
 * console.log(PoolName.literals) // ["heavy", "overflow"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PoolName = LiteralKit(["heavy", "overflow"]).pipe(
  $I.annoteSchema("PoolName", { description: "A pool of the runner fleet." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type PoolName = typeof PoolName.Type;

// An IPv4 CIDR read as its first address (an unsigned 32-bit integer) and its address count.
const cidrPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/u;

const readCidr = (cidr: string): O.Option<{ readonly first: number; readonly size: number; readonly prefix: number }> =>
  O.flatMap(O.fromNullishOr(cidrPattern.exec(cidr)), (match) => {
    const octets = A.map(A.take(A.drop(match, 1), 4), Number);
    const prefix = Number(match[5]);
    const first = A.reduce(octets, 0, (address, octet) => address * 256 + octet);
    return A.every(octets, (octet) => octet <= 255) ? O.some({ first, size: 2 ** (32 - prefix), prefix }) : O.none();
  });

// AWS accepts VPC and subnet blocks from /16 to /28; the block must start on its own boundary.
const isAwsCidr = (cidr: string): boolean =>
  O.exists(readCidr(cidr), (block) => block.prefix >= 16 && block.prefix <= 28 && block.first % block.size === 0);

const Ipv4Cidr = S.String.check(
  S.makeFilter(isAwsCidr, {
    message: "Expected an IPv4 CIDR block from /16 to /28 whose address is the block's first address",
  })
).pipe($I.annoteSchema("Ipv4Cidr", { description: "An IPv4 CIDR block AWS accepts for a VPC or subnet." }));

const contains =
  (outer: string) =>
  (inner: string): boolean =>
    O.exists(
      O.all([readCidr(outer), readCidr(inner)]),
      ([o, i]) => i.first >= o.first && i.first + i.size <= o.first + o.size
    );

const apart = (left: string, right: string): boolean =>
  O.exists(
    O.all([readCidr(left), readCidr(right)]),
    ([a, b]) => a.first + a.size <= b.first || b.first + b.size <= a.first
  );

// The private ranges of RFC 1918. AWS reserves or refuses parts of the rest for a VPC (169.254.0.0/16 link-local,
// 224.0.0.0/4 multicast, 0.0.0.0/8, 127.0.0.0/8), and the fleet needs no public block, so a VPC block must lie in one.
const privateRanges = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];

const isPrivateBlock = (cidr: string): boolean => A.some(privateRanges, (range) => contains(range)(cidr));

const disjoint = (blocks: ReadonlyArray<string>): boolean =>
  A.every(blocks, (cidr, index) => A.every(A.drop(blocks, index + 1), (other) => apart(cidr, other)));

// The retention periods CloudWatch Logs PutRetentionPolicy accepts.
const FlowLogRetentionDays = S.Literals([
  1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653,
]);

const AvailabilityZone = S.String.check(
  S.isPattern(
    /^[a-z]{2}(?:-[a-z]+)+-\d[a-z]$/u,
    $I.annote("AvailabilityZoneFormat", {
      description: "An AWS availability zone name.",
      message: "Expected an availability zone such as us-east-1a",
    })
  )
).pipe($I.annoteSchema("AvailabilityZone", { description: "An AWS availability zone name." }));

const NonNegativeInt = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativeInt", { description: "An integer of zero or more." })
);

/**
 * One public subnet of the fleet VPC.
 *
 * **Example** (Decode a subnet slot)
 *
 * ```ts
 * import { SubnetSlot } from "@beep/infra-ci-runners/Config"
 * import * as S from "effect/Schema"
 *
 * const slot = S.decodeUnknownSync(SubnetSlot)({ availabilityZone: "us-east-1a", cidrBlock: "10.89.0.0/20" })
 * console.log(slot.cidrBlock) // "10.89.0.0/20"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SubnetSlot extends S.Opaque<SubnetSlot, { readonly brand: unique symbol }>()(
  S.Struct({ availabilityZone: AvailabilityZone, cidrBlock: Ipv4Cidr }).pipe(
    $I.annoteSchema("SubnetSlot", { description: "Zone and CIDR block of one public subnet." })
  )
) {}

/**
 * The fleet network: one VPC, public subnets routed to an internet gateway,
 * no NAT gateway.
 *
 * **Details**
 *
 * Runners reach the internet through a public IP and the internet gateway;
 * their security group has no ingress rule. The live VPC uses
 * `10.88.0.0/16`; the new one takes `10.89.0.0/16` so flow logs of the two
 * fleets never show the same addresses during the overlap. Zones are the
 * live five (`us-east-1e` has no capacity for the live types and is skipped).
 *
 * **Example** (Decode the network)
 *
 * ```ts
 * import { NetworkSettings } from "@beep/infra-ci-runners/Config"
 * import * as S from "effect/Schema"
 *
 * const network = S.decodeUnknownSync(NetworkSettings)({
 *   vpcCidr: "10.89.0.0/16",
 *   subnets: [{ availabilityZone: "us-east-1a", cidrBlock: "10.89.0.0/20" }],
 *   flowLogRetentionDays: 14,
 * })
 * console.log(network.subnets.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NetworkSettings extends S.Opaque<NetworkSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    vpcCidr: Ipv4Cidr,
    subnets: S.NonEmptyArray(SubnetSlot),
    flowLogRetentionDays: FlowLogRetentionDays,
  }).pipe(
    S.check(
      S.makeFilter((network) => A.every(network.subnets, (subnet) => contains(network.vpcCidr)(subnet.cidrBlock)), {
        message: "Every subnet block must lie inside the VPC block",
      }),
      S.makeFilter((network) => disjoint(A.map(network.subnets, (subnet) => subnet.cidrBlock)), {
        message: "Subnet blocks must not overlap",
      }),
      S.makeFilter((network) => isPrivateBlock(network.vpcCidr), {
        message: "The VPC block must lie in an RFC 1918 private range (10/8, 172.16/12 or 192.168/16)",
      }),
      // One CreateFleet request takes at most one subnet per Availability Zone, and scale-up passes every subnet.
      S.makeFilter(
        (network) =>
          A.length(A.dedupe(A.map(network.subnets, (subnet) => subnet.availabilityZone))) === A.length(network.subnets),
        { message: "Each Availability Zone may hold only one runner subnet" }
      )
    ),
    $I.annoteSchema("NetworkSettings", { description: "VPC, public subnets and flow-log retention." })
  )
) {}

/**
 * **Details**
 *
 * `amiId` is the baked Amazon Linux 2023 image `beep runners bake` last
 * recorded in this package's `runner-image.json` and wrote into
 * `productionConfig.image.amiId` below.
 * Pinning the id, not an SSM parameter, keeps an unrelated deploy from
 * changing the image. AL2023 registers its root device as `/dev/xvda`;
 * runners run as `ec2-user`.
 *
 * **Example** (Decode the image settings)
 *
 * ```ts
 * import { ImageSettings } from "@beep/infra-ci-runners/Config"
 * import * as S from "effect/Schema"
 *
 * const image = S.decodeUnknownSync(ImageSettings)({
 *   amiId: "ami-0123456789abcdef0",
 *   rootDeviceName: "/dev/xvda",
 *   rootVolumeGb: 100,
 *   runAs: "ec2-user",
 * })
 * console.log(image.rootVolumeGb) // 100
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImageSettings extends S.Opaque<ImageSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    amiId: S.String.check(S.isPattern(/^ami-[0-9a-f]{8,17}$/u)),
    rootDeviceName: S.String.check(S.isPattern(/^\/dev\/[a-z0-9]+$/u)),
    rootVolumeGb: S.Int.check(S.isBetween({ minimum: 30, maximum: 1000 })),
    // The post-install grants its IMDS helper to `ec2-user` only (RunnerBootstrap), so no other run-as user is accepted.
    runAs: S.tag("ec2-user"),
  }).pipe($I.annoteSchema("ImageSettings", { description: "AMI, root device and run-as user of every runner." }))
) {}

/**
 * One pool's live profile plus its overlap cap.
 *
 * **Details**
 *
 * `maximumCount` is the live pool's VM cap (heavy 2, shard overflow 48);
 * `overlapMaximumCount` is the cap while the live fleet still runs. Labels
 * are new (`beep-fleet-heavy`, `beep-fleet-overflow`) so a job reaches this
 * fleet only once its workflow asks for it; the runner groups are the live
 * org groups. `jobQueuedCheck` makes scale-up ask GitHub before it launches
 * and drop a message whose job is already `in_progress` or `completed`;
 * production turns it on so a served job's redelivered message launches no
 * idle runner.
 *
 * **Example** (Decode a pool)
 *
 * ```ts
 * import { PoolSettings } from "@beep/infra-ci-runners/Config"
 * import * as S from "effect/Schema"
 *
 * const pool = S.decodeUnknownSync(PoolSettings)({
 *   name: "overflow",
 *   instanceTypes: ["r7i.2xlarge"],
 *   maximumCount: 48,
 *   overlapMaximumCount: 2,
 *   label: "beep-fleet-overflow",
 *   runnerGroup: "beep-shard-overflow",
 *   runnerNamePrefix: "beep-fleet-ovf-",
 *   jobRetry: false,
 *   jobQueuedCheck: true,
 * })
 * console.log(pool.maximumCount) // 48
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PoolSettings extends S.Opaque<PoolSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    name: PoolName,
    instanceTypes: S.NonEmptyArray(RunnerInstanceType),
    maximumCount: NonNegativeInt,
    overlapMaximumCount: NonNegativeInt,
    label: S.String.check(S.isPattern(/^[A-Za-z0-9_-]{1,64}$/u)),
    runnerGroup: S.String.check(S.isPattern(/^[A-Za-z0-9_-]{1,64}$/u)),
    runnerNamePrefix: S.String.check(S.isPattern(/^[a-z0-9-]{1,32}$/u)),
    jobRetry: S.Boolean,
    jobQueuedCheck: S.Boolean,
  }).pipe($I.annoteSchema("PoolSettings", { description: "Instance types, caps, label and group of one pool." }))
) {}

/**
 * The cap a pool runs at in a phase.
 *
 * **Example** (Overlap cap)
 *
 * ```ts
 * import { effectiveCap, productionConfig } from "@beep/infra-ci-runners/Config"
 * import { PoolSettings } from "@beep/infra-ci-runners/Config"
 *
 * console.log(effectiveCap(PoolSettings.make(productionConfig.overflow), "overlap")) // 2
 * ```
 *
 * @param pool - Settings carrying both the live and the overlap cap.
 * @param phase - `overlap` beside the live fleet, `primary` after the move.
 * @returns Its VM cap in that phase.
 * @category configuration
 * @since 0.0.0
 */
export const effectiveCap: {
  (phase: FleetPhase): (pool: PoolSettings) => number;
  (pool: PoolSettings, phase: FleetPhase): number;
} = dual(2, (pool: PoolSettings, phase: FleetPhase): number =>
  FleetPhase.match(phase, { overlap: () => pool.overlapMaximumCount, primary: () => pool.maximumCount })
);

/**
 * The most vCPU a pool can hold in a phase: every VM of its largest type.
 *
 * **Example** (Worst case of the live overflow cap)
 *
 * ```ts
 * import { PoolSettings, poolWorstCaseVcpu, productionConfig } from "@beep/infra-ci-runners/Config"
 *
 * console.log(poolWorstCaseVcpu(PoolSettings.make(productionConfig.overflow), "primary")) // 384
 * ```
 *
 * @param pool - Settings whose largest instance type sets the per-VM vCPU.
 * @param phase - `overlap` beside the live fleet, `primary` after the move.
 * @returns Its worst-case vCPU.
 * @category configuration
 * @since 0.0.0
 */
export const poolWorstCaseVcpu: {
  (phase: FleetPhase): (pool: PoolSettings) => number;
  (pool: PoolSettings, phase: FleetPhase): number;
} = dual(
  2,
  (pool: PoolSettings, phase: FleetPhase): number =>
    effectiveCap(pool, phase) * Math.max(...A.map(pool.instanceTypes, instanceVcpus))
);

const SpotBudgetFields = S.Struct({
  phase: FleetPhase,
  spotQuotaVcpu: S.Int.check(S.isGreaterThan(0)),
  liveFleetReserveVcpu: NonNegativeInt,
  heavy: PoolSettings,
  overflow: PoolSettings,
  runnerType: RunnerType,
  repositoryAllowList: S.Array(S.String),
});

// Scale-up caps each pool per runner owner (`ScaleUp.program` counts runners by environment and owner), and it
// derives the owner as `ownerOf` does: the organization for Org runners, `owner/repo` for Repo runners, compared
// exactly. The worst case is the pools' caps times the distinct owners the allow list admits (at least one).
const ownerOf = (runnerType: RunnerType, repository: string): string =>
  runnerType === "Org" ? A.headNonEmpty(Str.split("/")(repository)) : repository;

const ownerCount = (runnerType: RunnerType, allowList: ReadonlyArray<string>): number =>
  Math.max(1, A.dedupe(A.map(allowList, (repository) => ownerOf(runnerType, repository))).length);

/**
 * The Spot vCPU a stage commits: both pools' worst case, once per runner
 * owner the allow list admits, plus, in the `overlap` phase, the live
 * fleet's reserve.
 *
 * **Example** (Production overlap budget)
 *
 * ```ts
 * import { decodeCiRunnersConfig, productionConfig, spotVcpuCommitted } from "@beep/infra-ci-runners/Config"
 * import * as Effect from "effect/Effect"
 *
 * const config = Effect.runSync(decodeCiRunnersConfig(productionConfig))
 * console.log(spotVcpuCommitted(config)) // 512
 * ```
 *
 * @param config - The stage's phase, quota, reserve, pools and allow list.
 * @returns The committed vCPU.
 * @category configuration
 * @since 0.0.0
 */
export const spotVcpuCommitted = (config: typeof SpotBudgetFields.Type): number =>
  (poolWorstCaseVcpu(config.heavy, config.phase) + poolWorstCaseVcpu(config.overflow, config.phase)) *
    ownerCount(config.runnerType, config.repositoryAllowList) +
  FleetPhase.match(config.phase, { overlap: () => config.liveFleetReserveVcpu, primary: () => 0 });

/**
 * **Details**
 *
 * Every field is tracked source. App credentials are not here; see
 * {@link AppCredentials}. The schema refuses a stage whose committed Spot
 * vCPU ({@link spotVcpuCommitted}) exceeds the account's Spot quota, so no
 * cap change can push the two fleets together past the quota and stall
 * live job pickup.
 *
 * **Example** (Decode the production configuration)
 *
 * ```ts
 * import { decodeCiRunnersConfig, productionConfig } from "@beep/infra-ci-runners/Config"
 * import * as Effect from "effect/Effect"
 *
 * const config = Effect.runSync(decodeCiRunnersConfig(productionConfig))
 * console.log(config.phase) // "primary"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class CiRunnersConfig extends S.Opaque<CiRunnersConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    expectedAccountId: AwsAccountId,
    region: FleetRegion,
    phase: FleetPhase,
    spotQuotaVcpu: S.Int.check(S.isGreaterThan(0)),
    liveFleetReserveVcpu: NonNegativeInt,
    network: NetworkSettings,
    image: ImageSettings,
    heavy: PoolSettings,
    overflow: PoolSettings,
    reaperTtlMinutes: S.Int.check(S.isBetween({ minimum: 10, maximum: 720 })),
    runnerType: RunnerType,
    repositoryAllowList: S.Array(S.String.check(S.isPattern(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u))),
  }).pipe(
    S.check(
      S.makeFilter((config) => spotVcpuCommitted(config) <= config.spotQuotaVcpu, {
        message: "The pools' worst-case Spot vCPU plus the live-fleet reserve exceeds the Spot vCPU quota",
      }),
      // Each slot names its own pool: two pools under one name would share resource ids and ghr:environment.
      S.makeFilter(
        (config) => config.heavy.name === PoolName.Enum.heavy && config.overflow.name === PoolName.Enum.overflow,
        { message: "The heavy slot must hold the heavy pool and the overflow slot the overflow pool" }
      )
    ),
    $I.annoteSchema("CiRunnersConfig", {
      description: "Account guard, network, image, pools and Spot budget of one stack stage.",
    })
  )
) {}

/**
 * @category configuration
 * @since 0.0.0
 */
export declare namespace CiRunnersConfig {
  /**
   * The plain shape a stage configuration is written in.
   *
   * @category configuration
   * @since 0.0.0
   */
  export type Encoded = typeof CiRunnersConfig.Encoded;
}

/**
 * The stage that owns the production fleet.
 *
 * **Example** (Read the production stage)
 *
 * ```ts
 * import { productionStage } from "@beep/infra-ci-runners/Config"
 *
 * console.log(productionStage) // "prod"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const productionStage = "prod";

/**
 * The repository the production fleet serves; no personal stage may name it.
 *
 * **Example** (Read the production repository)
 *
 * ```ts
 * import { productionRepository } from "@beep/infra-ci-runners/Config"
 *
 * console.log(productionRepository) // "beep-effect/beep-effect"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const productionRepository = "beep-effect/beep-effect";

/**
 * Configuration input of the `prod` stage: the live fleet's values, in the
 * `primary` phase (cutover step 4b; the `overlap` caps stay declared for the
 * step 4 rollback, which reverts the phase).
 *
 * **Details**
 *
 * Instance types, caps, groups, the AMI and the root disk were ported from
 * the retired Pulumi program (`infra/src/CiRunnerPool.ts`,
 * `infra/src/CiFleetController.ts` and its production stack); the Spot quota (512, "All
 * Standard Spot Instance Requests") was read on 2026-11-14. The live
 * reserve, 480 vCPU, is the live fleet at the overlap's agreed burst cap:
 * the heavy pool at 6 × 16 plus the overflow pool at 48 × 8. With this
 * stage's overlap caps (1 × 16 + 2 × 8) the two fleets commit exactly the
 * 512 quota, so the budget check refuses any larger overlap cap, and a live
 * heavy burst cap above 6 is outside the budget.
 *
 * **Example** (Read the production overlap cap)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-ci-runners/Config"
 *
 * console.log(productionConfig.heavy.overlapMaximumCount) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const productionConfig: CiRunnersConfig.Encoded = {
  expectedAccountId: "832907639880",
  region: "us-east-1",
  phase: "primary",
  spotQuotaVcpu: 512,
  liveFleetReserveVcpu: 480,
  network: {
    vpcCidr: "10.89.0.0/16",
    subnets: [
      { availabilityZone: "us-east-1a", cidrBlock: "10.89.0.0/20" },
      { availabilityZone: "us-east-1b", cidrBlock: "10.89.16.0/20" },
      { availabilityZone: "us-east-1c", cidrBlock: "10.89.32.0/20" },
      { availabilityZone: "us-east-1d", cidrBlock: "10.89.48.0/20" },
      { availabilityZone: "us-east-1f", cidrBlock: "10.89.64.0/20" },
    ],
    flowLogRetentionDays: 14,
  },
  image: { amiId: "ami-07af50c345b5ba065", rootDeviceName: "/dev/xvda", rootVolumeGb: 100, runAs: "ec2-user" },
  heavy: {
    name: "heavy",
    instanceTypes: RunnerInstanceType.literals,
    maximumCount: 2,
    overlapMaximumCount: 1,
    label: "beep-fleet-heavy",
    runnerGroup: "beep-ec2-heavy",
    runnerNamePrefix: "beep-fleet-heavy-",
    jobRetry: true,
    jobQueuedCheck: true,
  },
  overflow: {
    name: "overflow",
    instanceTypes: ["r7i.2xlarge", "r6i.2xlarge"],
    maximumCount: 48,
    overlapMaximumCount: 2,
    label: "beep-fleet-overflow",
    runnerGroup: "beep-shard-overflow",
    runnerNamePrefix: "beep-fleet-ovf-",
    jobRetry: true,
    jobQueuedCheck: true,
  },
  reaperTtlMinutes: 90,
  runnerType: "Org",
  repositoryAllowList: [productionRepository],
};

/**
 * A repository a personal-stage rehearsal registers its runners to.
 *
 * **Details**
 *
 * `owner/name`, and never {@link productionRepository}: a personal stage
 * registers repository runners only, so a rehearsal cannot place a runner
 * where production jobs would pick it up.
 *
 * **Example** (Refuse the production repository)
 *
 * ```ts
 * import { RehearsalRepository } from "@beep/infra-ci-runners/Config"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RehearsalRepository)("beep-effect/beep-effect")) // false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const RehearsalRepository = S.String.check(
  S.isPattern(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u),
  S.makeFilter((repository: string) => Str.toLowerCase(repository) !== productionRepository, {
    message: `A personal stage may not register runners to ${productionRepository}`,
  })
).pipe($I.annoteSchema("RehearsalRepository", { description: "The repository a personal rehearsal serves." }));

/**
 * Environment variable naming a personal stage's rehearsal repository.
 *
 * **Example** (Read the variable name)
 *
 * ```ts
 * import { rehearsalRepositoryVariable } from "@beep/infra-ci-runners/Config"
 *
 * console.log(rehearsalRepositoryVariable) // "CI_RUNNERS_REHEARSAL_REPOSITORY"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const rehearsalRepositoryVariable = "CI_RUNNERS_REHEARSAL_REPOSITORY";

/**
 * Configuration input of a personal stage (`dev-$USER`).
 *
 * **Details**
 *
 * Without a rehearsal repository every cap is 0 and the webhook's allow list
 * is empty: the stage deploys the whole graph, but the webhook drops every
 * event and scale-up never launches. With one, each pool may launch one
 * repository runner for that repository alone. The reserve is the live
 * fleet's plus the production overlap (480 + 32 = 512 vCPU, the whole
 * quota), so the budget check refuses a rehearsal that launches anything
 * while the overlap lasts; a launching rehearsal needs `primary` or a
 * drained live fleet.
 *
 * **Example** (A personal stage launches nothing by default)
 *
 * ```ts
 * import { personalConfig } from "@beep/infra-ci-runners/Config"
 * import * as O from "effect/Option"
 *
 * console.log(personalConfig(O.none()).heavy.overlapMaximumCount) // 0
 * ```
 *
 * @param rehearsal - The rehearsal repository, if any.
 * @returns The stage's configuration input.
 * @category configuration
 * @since 0.0.0
 */
export const personalConfig = (rehearsal: O.Option<string>): CiRunnersConfig.Encoded => {
  const cap = O.isSome(rehearsal) ? 1 : 0;
  return {
    ...productionConfig,
    phase: "overlap",
    liveFleetReserveVcpu: productionConfig.liveFleetReserveVcpu + 32,
    heavy: { ...productionConfig.heavy, maximumCount: cap, overlapMaximumCount: cap, jobRetry: false },
    overflow: { ...productionConfig.overflow, maximumCount: cap, overlapMaximumCount: cap, jobRetry: false },
    runnerType: "Repo",
    repositoryAllowList: O.toArray(rehearsal),
  };
};

/**
 * Decode a stage configuration from unknown input, failing with a
 * `SchemaError`.
 *
 * **Example** (Reject a cap past the Spot quota)
 *
 * ```ts
 * import { decodeCiRunnersConfig, productionConfig } from "@beep/infra-ci-runners/Config"
 * import * as Effect from "effect/Effect"
 *
 * const tooBig = { ...productionConfig, overflow: { ...productionConfig.overflow, overlapMaximumCount: 48 } }
 * console.log(Effect.runSyncExit(decodeCiRunnersConfig(tooBig))._tag) // "Failure"
 * ```
 *
 * @param input - Untrusted stage configuration.
 * @returns The decoded configuration, or a `SchemaError`.
 * @category configuration
 * @since 0.0.0
 */
export const decodeCiRunnersConfig = (input: unknown): Effect.Effect<CiRunnersConfig, S.SchemaError> =>
  S.decodeUnknownEffect(CiRunnersConfig)(input);

/**
 * The optional rehearsal repository of a personal stage, read from
 * {@link rehearsalRepositoryVariable}.
 *
 * **Example** (Reference the config)
 *
 * ```ts
 * import { rehearsalRepository } from "@beep/infra-ci-runners/Config"
 *
 * console.log(typeof rehearsalRepository) // "object"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const rehearsalRepository = Config.schema(RehearsalRepository, rehearsalRepositoryVariable).pipe(Config.option);

/**
 * Decode the configuration of a stage: `prod` gets {@link productionConfig},
 * every other stage {@link personalConfig}. The rehearsal variable is the only
 * untrusted input. Both a bad rehearsal repository and a configuration that
 * fails its schema (a rehearsal during the overlap exceeds the Spot budget)
 * fail with a `ConfigError` before any resource is read.
 *
 * **Example** (Resolve a personal stage)
 *
 * ```ts
 * import { resolveStageConfig } from "@beep/infra-ci-runners/Config"
 * import * as Effect from "effect/Effect"
 *
 * const config = Effect.runSync(resolveStageConfig("dev-alice"))
 * console.log(config.runnerType) // "Repo"
 * ```
 *
 * @param stage - The Alchemy stage being planned or deployed.
 * @returns The stage's validated configuration, or a `ConfigError` for a bad rehearsal repository or a budget past the Spot quota.
 * @category configuration
 * @since 0.0.0
 */
export const resolveStageConfig = Effect.fn("CiRunners.resolveStageConfig")(function* (stage: string) {
  const input = stage === productionStage ? productionConfig : yield* Config.map(rehearsalRepository, personalConfig);
  return yield* decodeCiRunnersConfig(input).pipe(
    Effect.mapError(
      (error) =>
        new Config.ConfigError(new ConfigProvider.SourceError({ message: `Stage "${stage}": ${error.message}` }))
    )
  );
});
