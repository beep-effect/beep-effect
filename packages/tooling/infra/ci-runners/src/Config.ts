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
import { $InfraCiRunnersId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $InfraCiRunnersId.create("Config");

/**
 * The region the fleet runs in.
 *
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
 * Decoded region.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetRegion = typeof FleetRegion.Type;

/**
 * The 64 GiB x86_64 instance types the live pools launch.
 *
 * **Details**
 *
 * The heavy pool uses all seven (35 Spot capacity pools across five
 * subnets); the shard-overflow pool uses the three 8-vCPU types. Carried
 * over from the Pulumi `CiRunnerPool` profiles.
 *
 * **Example** (List the instance types)
 *
 * ```ts
 * import { RunnerInstanceType } from "@beep/infra-ci-runners/Config"
 *
 * console.log(RunnerInstanceType.literals.length) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerInstanceType = LiteralKit([
  "r7a.2xlarge",
  "r7i.2xlarge",
  "r6i.2xlarge",
  "m7a.4xlarge",
  "m7i.4xlarge",
  "m6a.4xlarge",
  "m6i.4xlarge",
]).pipe($I.annoteSchema("RunnerInstanceType", { description: "An EC2 instance type a runner pool may launch." }));

/**
 * Decoded instance type.
 *
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
 * console.log(instanceVcpus("r7a.2xlarge")) // 8
 * ```
 *
 * @param type - One of the seven 64 GiB x86_64 types.
 * @returns Its vCPU count.
 * @category models
 * @since 0.0.0
 */
export const instanceVcpus = (type: RunnerInstanceType): number =>
  RunnerInstanceType.match(type, {
    "r7a.2xlarge": () => 8,
    "r7i.2xlarge": () => 8,
    "r6i.2xlarge": () => 8,
    "m7a.4xlarge": () => 16,
    "m7i.4xlarge": () => 16,
    "m6a.4xlarge": () => 16,
    "m6i.4xlarge": () => 16,
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
 * Decoded phase.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetPhase = typeof FleetPhase.Type;

/**
 * The two pools of the fleet.
 *
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
 * Decoded pool name.
 *
 * @category models
 * @since 0.0.0
 */
export type PoolName = typeof PoolName.Type;

const Ipv4Cidr = S.String.check(
  S.isPattern(
    /^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/u,
    $I.annote("Ipv4CidrFormat", { description: "An IPv4 CIDR block.", message: "Expected an IPv4 CIDR block" })
  )
).pipe($I.annoteSchema("Ipv4Cidr", { description: "An IPv4 CIDR block." }));

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
    flowLogRetentionDays: S.Int.check(S.isBetween({ minimum: 1, maximum: 3653 })),
  }).pipe($I.annoteSchema("NetworkSettings", { description: "VPC, public subnets and flow-log retention." }))
) {}

/**
 * The runner image and its root disk.
 *
 * **Details**
 *
 * `amiId` is the baked Amazon Linux 2023 image `beep runners bake` last
 * recorded in `infra/ci-runners/runner-image.json` and pinned in
 * `infra/ci-runners/Pulumi.production.yaml` (`ciFleetController:amiId`).
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
    runAs: S.String.check(S.isPattern(/^[a-z_][a-z0-9_-]{0,31}$/u)),
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
 * org groups.
 *
 * **Example** (Decode a pool)
 *
 * ```ts
 * import { PoolSettings } from "@beep/infra-ci-runners/Config"
 * import * as S from "effect/Schema"
 *
 * const pool = S.decodeUnknownSync(PoolSettings)({
 *   name: "overflow",
 *   instanceTypes: ["r7a.2xlarge"],
 *   maximumCount: 48,
 *   overlapMaximumCount: 2,
 *   label: "beep-fleet-overflow",
 *   runnerGroup: "beep-shard-overflow",
 *   runnerNamePrefix: "beep-fleet-ovf-",
 *   jobRetry: false,
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
});

/**
 * The Spot vCPU a stage commits: both pools' worst case plus, in the
 * `overlap` phase, the live fleet's reserve.
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
 * @param config - The stage's phase, quota, reserve and pools.
 * @returns The committed vCPU.
 * @category configuration
 * @since 0.0.0
 */
export const spotVcpuCommitted = (config: typeof SpotBudgetFields.Type): number =>
  poolWorstCaseVcpu(config.heavy, config.phase) +
  poolWorstCaseVcpu(config.overflow, config.phase) +
  FleetPhase.match(config.phase, { overlap: () => config.liveFleetReserveVcpu, primary: () => 0 });

/**
 * Configuration of one stage of the `CiRunners` stack.
 *
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
 * console.log(config.phase) // "overlap"
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
      })
    ),
    $I.annoteSchema("CiRunnersConfig", {
      description: "Account guard, network, image, pools and Spot budget of one stack stage.",
    })
  )
) {}

/**
 * Companion types for {@link CiRunnersConfig}.
 *
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
 * `overlap` phase.
 *
 * **Details**
 *
 * Instance types, caps, groups, the AMI and the root disk come from
 * `infra/src/CiRunnerPool.ts`, `infra/src/CiFleetController.ts` and
 * `infra/ci-runners/Pulumi.production.yaml`; the Spot quota (512, "All
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
  phase: "overlap",
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
  },
  overflow: {
    name: "overflow",
    instanceTypes: ["r7a.2xlarge", "r7i.2xlarge", "r6i.2xlarge"],
    maximumCount: 48,
    overlapMaximumCount: 2,
    label: "beep-fleet-overflow",
    runnerGroup: "beep-shard-overflow",
    runnerNamePrefix: "beep-fleet-ovf-",
    jobRetry: true,
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
