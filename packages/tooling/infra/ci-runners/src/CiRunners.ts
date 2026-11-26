/**
 * The `CiRunners` stack program: the fleet network, the runner IAM
 * policies, the heavy and shard-overflow pools through `RunnerFleet`, and
 * the reaper.
 *
 * @packageDocumentation
 * @category resources
 * @since 0.0.0
 */

import * as IAM from "@alchemy.run/aws/IAM";
import { RunnerFleet, RunnerFleetProps } from "@beep/alchemy-github-runners/RunnerFleet";
import { JobRetryPolicy, RunnerPool } from "@beep/alchemy-github-runners/RunnerPool.models";
import * as Alchemy from "alchemy";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { effectiveCap, PoolName, productionStage, resolveStageConfig } from "./Config.ts";
import { stageCredentials } from "./Credentials.ts";
import { fleetBoundaryPolicyArnFor } from "./DeployRolePolicy.ts";
import { requireCiForProduction, requireConfiguredTarget, requireDistinctStage, requireFencedNames } from "./Guards.ts";
import { physicalNames } from "./Names.ts";
import { declareNetwork, networkTags } from "./Network.ts";
import { declareReaper, ReaperRuntimeConfig } from "./Reaper.ts";
import { imdsDisablePolicyDocument, packPostInstall, runnerPostInstall } from "./RunnerBootstrap.ts";
import type { CiRunnersConfig, FleetPhase, PoolSettings } from "./Config.ts";
import type { AppCredentials } from "./Credentials.ts";
import type { PhysicalNames } from "./Names.ts";

/**
 * The live pools' job-retry policy: two re-checks, two minutes apart, with
 * backoff 2, ported from the retired Pulumi controller's `job_retry`.
 *
 * **Example** (Read the attempts)
 *
 * ```ts
 * import { liveJobRetry } from "@beep/infra-ci-runners/CiRunners"
 *
 * console.log(liveJobRetry.maxAttempts) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const liveJobRetry = JobRetryPolicy.make({ maxAttempts: 2, delaySeconds: 120, delayBackoff: 2 });

/**
 * The composite pool of one configured pool in the stage's phase.
 *
 * **Details**
 *
 * Spot only, `capacity-optimized`, bidirectional label match and ephemeral
 * JIT runners: the live module's settings (`RunnerPool`'s defaults already
 * equal them). The job-queued check follows the pool's `jobQueuedCheck`.
 * Scale-up then drops a message only for a job GitHub reports
 * `in_progress` or `completed`, so a lagging read that shows an earlier
 * state still launches, and a served job's redelivered message does not.
 *
 * **Example** (The production overflow pool in each phase)
 *
 * ```ts
 * import { toRunnerPool } from "@beep/infra-ci-runners/CiRunners"
 * import { decodeCiRunnersConfig, productionConfig } from "@beep/infra-ci-runners/Config"
 * import * as Effect from "effect/Effect"
 *
 * const config = Effect.runSync(decodeCiRunnersConfig(productionConfig))
 * console.log(toRunnerPool(config.overflow, "overlap").maximumCount) // 2
 * console.log(toRunnerPool(config.overflow, config.phase).maximumCount) // 48
 * ```
 *
 * @param pool - The configured pool.
 * @param phase - The stage's phase.
 * @returns The `RunnerPool` the fleet composite takes.
 * @category resources
 * @since 0.0.0
 */
export const toRunnerPool: {
  (phase: FleetPhase): (pool: PoolSettings) => RunnerPool;
  (pool: PoolSettings, phase: FleetPhase): RunnerPool;
} = dual(
  2,
  (pool: PoolSettings, phase: FleetPhase): RunnerPool =>
    RunnerPool.make({
      name: pool.name,
      instanceTypes: pool.instanceTypes,
      maximumCount: effectiveCap(pool, phase),
      labels: [pool.label],
      runnerGroup: pool.runnerGroup,
      runnerNamePrefix: pool.runnerNamePrefix,
      jobQueuedCheck: pool.jobQueuedCheck,
      jobRetry: pool.jobRetry ? O.some(liveJobRetry) : O.none(),
    })
);

const runnerPolicies = Effect.fn("CiRunners.runnerPolicies")(function* (names: PhysicalNames) {
  const imdsDisable = yield* IAM.Policy("ImdsDisablePolicy", {
    policyName: names.imdsDisablePolicy,
    path: names.iamPath,
    description: "Allow a CI runner to disable IMDS on only its own instance.",
    policyDocument: imdsDisablePolicyDocument,
    tags: networkTags(names.fleet, names.imdsDisablePolicy),
  });
  return { imdsDisableArn: imdsDisable.policyArn };
});

/**
 * Declare the stack's resources for one stage.
 *
 * **Details**
 *
 * Every stage declares the same graph under its own names
 * ({@link physicalNames}); stages differ only in configuration and
 * credentials. Runners launch into the fleet's public subnets with the
 * zero-ingress security group, a public IP, the 100 GB gp3 root volume and
 * the live post-install. The fleet's single webhook serves both pools.
 *
 * **Example** (Declare a personal stage)
 *
 * ```ts
 * import { declareCiRunners } from "@beep/infra-ci-runners/CiRunners"
 * import { resolveStageConfig } from "@beep/infra-ci-runners/Config"
 * import { placeholderCredentials } from "@beep/infra-ci-runners/Credentials"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.flatMap(resolveStageConfig("dev-alice"), (config) =>
 *   declareCiRunners({ config, stage: "dev-alice", credentials: placeholderCredentials })
 * )
 * console.log(typeof program) // "object"
 * ```
 *
 * @param input - The stage configuration, the stage and its App credentials.
 * @returns The stack output: names, ids and the webhook URL, never a secret.
 * @category resources
 * @since 0.0.0
 */
export const declareCiRunners = Effect.fn("CiRunners.declare")(function* (input: {
  readonly config: CiRunnersConfig;
  readonly stage: string;
  readonly credentials: AppCredentials;
}) {
  const { config, credentials } = input;
  const names = physicalNames(input.stage);
  const production = input.stage === productionStage;
  const network = yield* declareNetwork(config.network, names);
  const policies = yield* runnerPolicies(names);

  const fleet = yield* RunnerFleet(
    RunnerFleetProps.make({
      id: "Runners",
      name: names.fleet,
      // prod pins every composite name (a lost or moved state must not mint a second fleet); personal stages keep generated names.
      ...(production ? { namePrefix: names.fleet } : {}),
      ssmRoot: names.ssmRoot,
      runnerType: config.runnerType,
      repositoryAllowList: config.repositoryAllowList,
      subnetIds: network.subnetIds,
      app: { id: credentials.id, keyBase64: credentials.keyBase64, webhookSecret: credentials.webhookSecret },
      pools: [toRunnerPool(config.heavy, config.phase), toRunnerPool(config.overflow, config.phase)],
      runAs: config.image.runAs,
      postInstall: yield* packPostInstall(runnerPostInstall),
      runnerManagedPolicyArns: [policies.imdsDisableArn],
      // Every role the fleet creates carries the stage's bootstrap fleet boundary (deploy-role decision).
      permissionsBoundaryArn: fleetBoundaryPolicyArnFor(names.slug),
      launchTemplate: {
        imageId: config.image.amiId,
        securityGroupIds: [network.runnerSecurityGroupId],
        associatePublicIpAddress: true,
        ebsOptimized: true,
        blockDeviceMappings: [
          {
            deviceName: config.image.rootDeviceName,
            ebs: {
              volumeType: "gp3",
              volumeSize: config.image.rootVolumeGb,
              iops: 3000,
              throughput: 250,
              encrypted: true,
              deleteOnTermination: true,
            },
          },
        ],
        tags: networkTags(names.fleet, `${names.fleet}-runner`),
      },
    })
  );

  yield* declareReaper({
    functionName: names.reaperFunction,
    permissionsBoundary: fleetBoundaryPolicyArnFor(names.slug),
    scheduleName: production ? O.some(names.reaperSchedule) : O.none(),
    config: ReaperRuntimeConfig.make({
      environments: [`${names.fleet}-${PoolName.Enum.heavy}`, `${names.fleet}-${PoolName.Enum.overflow}`],
      ttlMinutes: config.reaperTtlMinutes,
    }),
  });

  return {
    fleet: names.fleet,
    phase: config.phase,
    vpcId: network.vpcId,
    subnetIds: network.subnetIds,
    runnerSecurityGroupId: network.runnerSecurityGroupId,
    flowLogGroupName: network.flowLogGroupName,
    webhookUrl: fleet.webhookUrl,
    pools: A.map(fleet.pools, (pool) => ({ name: pool.name, environment: pool.environment })),
  };
});

/**
 * The stack program: the `CI` guard on `prod`, the account and live-name
 * guards on every stage, then {@link declareCiRunners} with the stage's
 * configuration and credentials.
 *
 * **Example** (Reference the program)
 *
 * ```ts
 * import { program } from "@beep/infra-ci-runners/CiRunners"
 *
 * console.log(typeof program) // "object"
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const program = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  yield* requireCiForProduction(stack.stage);
  yield* requireDistinctStage(stack.stage);
  yield* requireFencedNames(physicalNames(stack.stage));
  const config = yield* resolveStageConfig(stack.stage);
  yield* requireConfiguredTarget(config);
  const credentials = yield* stageCredentials(stack.stage);
  return yield* declareCiRunners({ config, stage: stack.stage, credentials });
});
