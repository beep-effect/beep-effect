/**
 * The scale-up Lambda's program: turn a batch of build-queue messages into
 * Spot runners, within the pool's VM cap.
 *
 * **Details**
 *
 * Ported from `lambdas/functions/control-plane/src/scale-runners/{scale-up,ec2,github-runner,job-retry}.ts`
 * and `src/aws/ec2-runners.ts` of github-aws-runners/terraform-aws-github-runner
 * v7.10.1 (MIT); see the package README for the license notice. Not ported:
 * dynamic `ghr-*` labels, dedicated hosts (`RunInstances`), the warm pool and
 * GitHub Enterprise Server base URLs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { FleetLaunchRequest, FleetOverride } from "./Ec2Fleet.models.ts";
import { Ec2Fleet } from "./Ec2Fleet.service.ts";
import { GitHubRunners } from "./GitHubApp.service.ts";
import { JitConfigRequest, RunnerOwner } from "./GitHubRunners.models.ts";
import { installationTokenFor, ownerOf } from "./internal/Installation.ts";
import { MessageQueue } from "./MessageQueue.service.ts";
import { RunnerFilter, RunnerTag, runnerApplicationTagValue } from "./RunnerInstance.models.ts";
import { ActionRequestMessage } from "./RunnerMessages.models.ts";
import { CapacityType } from "./RunnerPool.models.ts";
import { PoolRuntimeConfig } from "./RunnerRuntime.models.ts";
import { runnerGroupCacheName } from "./SsmParameters.models.ts";
import { SsmStore } from "./SsmStore.service.ts";
import type { FleetLaunchResult } from "./Ec2Fleet.models.ts";
import type { InstallationToken } from "./GitHubRunners.models.ts";
import type { QueuedActionRequest } from "./RunnerMessages.models.ts";
import type { AllocationStrategy } from "./RunnerPool.models.ts";

const $I = $AlchemyGithubRunnersId.create("ScaleUp.program");

const encodeActionRequest = S.encodeEffect(S.fromJsonString(ActionRequestMessage));

const spotStrategies: ReadonlyArray<AllocationStrategy> = [
  "lowest-price",
  "diversified",
  "capacity-optimized",
  "capacity-optimized-prioritized",
  "price-capacity-optimized",
];
const onDemandStrategies: ReadonlyArray<AllocationStrategy> = ["lowest-price", "prioritized"];

/**
 * The allocation strategy `CreateFleet` accepts for a capacity type; an
 * incompatible choice falls back to `lowest-price`.
 *
 * **Example** (Spot strategy reused for on-demand failover)
 *
 * ```ts
 * import { sanitizeAllocationStrategy } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(sanitizeAllocationStrategy("capacity-optimized", "on-demand")) // "lowest-price"
 * ```
 *
 * @param strategy - The configured strategy.
 * @param capacityType - The capacity type being launched.
 * @returns A strategy valid for that capacity type.
 * @category use-cases
 * @since 0.0.0
 */
export const sanitizeAllocationStrategy: {
  (capacityType: CapacityType): (strategy: AllocationStrategy) => AllocationStrategy;
  (strategy: AllocationStrategy, capacityType: CapacityType): AllocationStrategy;
} = dual(
  2,
  (strategy: AllocationStrategy, capacityType: CapacityType): AllocationStrategy =>
    A.contains(capacityType === "spot" ? spotStrategies : onDemandStrategies, strategy) ? strategy : "lowest-price"
);

/**
 * What one launch attempt asks for.
 *
 * **Example** (One Spot runner for an org)
 *
 * ```ts
 * import { FleetLaunchInput } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(FleetLaunchInput)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetLaunchInput extends S.Opaque<FleetLaunchInput, { readonly brand: unique symbol }>()(
  S.Struct({
    config: PoolRuntimeConfig,
    owner: RunnerOwner,
    count: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    capacityType: CapacityType,
    imageId: S.Option(S.String),
  }).pipe($I.annoteSchema("FleetLaunchInput", { description: "What one launch attempt asks for." }))
) {}

/**
 * The instant `CreateFleet` request for `count` runners of a pool and owner.
 *
 * **Details**
 *
 * Every instance type is crossed with every subnet, so the fleet can choose
 * among `types x subnets` capacity pools. Priorities are set only for the
 * prioritized strategies, from the type's position. Tags carry the
 * application marker, the pool environment, the registration scope, and the
 * token path and name prefix the runner's user data reads.
 *
 * **Example** (One Spot runner)
 *
 * ```ts
 * import { fleetLaunchRequest } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(typeof fleetLaunchRequest)
 * ```
 *
 * @param input - Pool config, owner, runner count, capacity type and optional AMI override.
 * @returns An instant, tagged request for `count` instances across every type and subnet.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetLaunchRequest = (input: FleetLaunchInput): FleetLaunchRequest => {
  const { config } = input;
  const allocationStrategy = sanitizeAllocationStrategy(config.pool.allocationStrategy, input.capacityType);
  const prioritized = allocationStrategy === "prioritized" || allocationStrategy === "capacity-optimized-prioritized";
  const overrides = A.flatMap(config.subnetIds, (subnetId) =>
    A.map(config.pool.instanceTypes, (instanceType, index) =>
      FleetOverride.make({
        subnetId,
        instanceType,
        imageId: input.imageId,
        priority: prioritized ? O.some(index) : O.none(),
      })
    )
  );
  return FleetLaunchRequest.make({
    launchTemplate: config.launchTemplate,
    overrides: A.isReadonlyArrayNonEmpty(overrides)
      ? overrides
      : [
          FleetOverride.make({
            subnetId: config.subnetIds[0],
            instanceType: config.pool.instanceTypes[0],
            imageId: input.imageId,
            priority: O.none(),
          }),
        ],
    capacityType: input.capacityType,
    allocationStrategy,
    targetCapacity: input.count,
    tags: {
      [RunnerTag.application]: runnerApplicationTagValue,
      [RunnerTag.createdBy]: "scale-up-lambda",
      [RunnerTag.environment]: config.environment,
      [RunnerTag.type]: input.owner.type,
      [RunnerTag.owner]: input.owner.owner,
      [RunnerTag.tokenPath]: config.tokenPath,
      [RunnerTag.runnerNamePrefix]: config.pool.runnerNamePrefix,
    },
  });
};

/**
 * Outcome of one launch attempt: what started and how much of the shortfall
 * is worth retrying.
 *
 * **Example** (One of two launched, one retryable)
 *
 * ```ts
 * import { LaunchOutcome } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(LaunchOutcome.make({ instanceIds: ["i-1"], retryable: 1, nonRetryable: 0 }).retryable)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LaunchOutcome extends S.Opaque<LaunchOutcome, { readonly brand: unique symbol }>()(
  S.Struct({
    instanceIds: S.Array(S.String),
    retryable: S.Int,
    nonRetryable: S.Int,
  }).pipe($I.annoteSchema("LaunchOutcome", { description: "Outcome of one launch attempt." }))
) {}

const failedLaunch = (count: number, retryable: boolean): LaunchOutcome =>
  LaunchOutcome.make({ instanceIds: [], retryable: retryable ? count : 0, nonRetryable: retryable ? 0 : count });

/**
 * Launches `count` runners, failing over the shortfall to on-demand when a
 * Spot launch reports one of the pool's failover error codes.
 *
 * **Details**
 *
 * A thrown `CreateFleet` counts every runner as failed, retryable when the
 * error is. A partial launch counts the shortfall as retryable when any
 * reported error code is in `scaleErrors`, otherwise as not retryable.
 *
 * **Example** (Wire the launcher)
 *
 * ```ts
 * import { launchRunners } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(typeof launchRunners)
 * ```
 *
 * @param input - Pool config, owner, count, capacity type and AMI override.
 * @returns Launched instance ids and the retryable and non-retryable shortfall.
 * @category use-cases
 * @since 0.0.0
 */
export const launchRunners: (input: FleetLaunchInput) => Effect.Effect<LaunchOutcome, never, Ec2Fleet> = Effect.fn(
  "ScaleUp.launchRunners"
)(function* (input) {
  const ec2 = yield* Ec2Fleet;
  const attempt = yield* ec2.createFleet(fleetLaunchRequest(input)).pipe(Effect.result);
  if (attempt._tag === "Failure") {
    return failedLaunch(input.count, attempt.failure.retryable);
  }
  const fleet: FleetLaunchResult = attempt.success;
  const missing = input.count - fleet.instanceIds.length;
  if (missing <= 0) {
    return LaunchOutcome.make({ instanceIds: fleet.instanceIds, retryable: 0, nonRetryable: 0 });
  }
  const failover =
    input.capacityType === "spot" &&
    A.some(fleet.errorCodes, (code) => A.contains(input.config.pool.onDemandFailoverErrors, code));
  if (failover) {
    const onDemand = yield* launchRunners(
      FleetLaunchInput.make({ ...input, count: missing, capacityType: "on-demand" })
    );
    return LaunchOutcome.make({ ...onDemand, instanceIds: A.appendAll(fleet.instanceIds, onDemand.instanceIds) });
  }
  const retryable = A.some(fleet.errorCodes, (code) => A.contains(input.config.scaleErrors, code));
  return LaunchOutcome.make({
    instanceIds: fleet.instanceIds,
    retryable: retryable ? missing : 0,
    nonRetryable: retryable ? 0 : missing,
  });
});

const resolveRunnerGroupId = Effect.fn("ScaleUp.resolveRunnerGroupId")(function* (
  config: PoolRuntimeConfig,
  token: InstallationToken,
  owner: RunnerOwner
) {
  if (owner.type !== "Org") {
    return 1;
  }
  const ssm = yield* SsmStore;
  const cacheName = runnerGroupCacheName(config.configPath, config.pool.runnerGroup);
  const cached = yield* ssm.get(cacheName).pipe(Effect.orElseSucceed(O.none));
  const parsed = O.flatMap(cached, (value) => O.liftThrowable(() => Number.parseInt(Redacted.value(value), 10))());
  if (O.isSome(parsed) && Number.isInteger(parsed.value)) {
    return parsed.value;
  }
  const github = yield* GitHubRunners;
  const groupId = yield* github.runnerGroupId(token, owner.owner, config.pool.runnerGroup);
  yield* ssm.put({ name: cacheName, value: Redacted.make(String(groupId)), secure: false, tags: {} });
  return groupId;
});

/**
 * Writes the start configuration of each launched instance into SSM and
 * returns the instances that could not be configured.
 *
 * **Details**
 *
 * Ephemeral JIT pools get one JIT config per instance (runner name
 * `<prefix><instance-id>`), stored as a SecureString at
 * `<tokenPath>/<instance-id>` tagged `InstanceId`, and the instance is tagged
 * `ghr:github_runner_id`. Other pools share one registration token rendered
 * as `config.sh` arguments. A failure for one instance does not stop the
 * others.
 *
 * **Example** (Wire the configurer)
 *
 * ```ts
 * import { configureRunners } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(typeof configureRunners)
 * ```
 *
 * @param input - Pool config, installation token, owner and launched instance ids.
 * @returns The instance ids that failed configuration.
 * @category use-cases
 * @since 0.0.0
 */
export const configureRunners = Effect.fn("ScaleUp.configureRunners")(function* (input: {
  readonly config: PoolRuntimeConfig;
  readonly token: InstallationToken;
  readonly owner: RunnerOwner;
  readonly instanceIds: ReadonlyArray<string>;
}) {
  const { config, owner, token } = input;
  const ssm = yield* SsmStore;
  const ec2 = yield* Ec2Fleet;
  const github = yield* GitHubRunners;
  const putToken = (instanceId: string, value: Redacted.Redacted<string>) =>
    ssm.put({ name: `${config.tokenPath}/${instanceId}`, value, secure: true, tags: { InstanceId: instanceId } });

  if (config.pool.ephemeral && config.pool.jitConfig) {
    const groupId = yield* resolveRunnerGroupId(config, token, owner).pipe(Effect.result);
    if (groupId._tag === "Failure") {
      return input.instanceIds;
    }
    const configured = yield* Effect.forEach(input.instanceIds, (instanceId) =>
      Effect.gen(function* () {
        const jit = yield* github.generateJitConfig(
          token,
          JitConfigRequest.make({
            owner,
            name: `${config.pool.runnerNamePrefix}${instanceId}`,
            runnerGroupId: groupId.success,
            labels: config.pool.labels,
          })
        );
        yield* ec2.tag(instanceId, { [RunnerTag.githubRunnerId]: String(jit.runnerId) }).pipe(Effect.ignore);
        yield* putToken(instanceId, jit.encodedJitConfig);
      }).pipe(
        Effect.as(O.none<string>()),
        Effect.orElseSucceed(() => O.some(instanceId))
      )
    );
    return A.getSomes(configured);
  }

  const registration = yield* github.registrationToken(token, owner).pipe(Effect.result);
  if (registration._tag === "Failure") {
    return input.instanceIds;
  }
  const args = A.join(
    A.getSomes([
      O.some(`--url https://github.com/${owner.owner}`),
      O.some(`--token ${Redacted.value(registration.success)}`),
      O.some(`--labels ${A.join(config.pool.labels, ",")}`),
      owner.type === "Org" ? O.some(`--runnergroup ${config.pool.runnerGroup}`) : O.none(),
      config.pool.ephemeral ? O.some("--ephemeral") : O.none(),
    ]),
    " "
  );
  const configured = yield* Effect.forEach(input.instanceIds, (instanceId) =>
    putToken(instanceId, Redacted.make(args)).pipe(
      Effect.as(O.none<string>()),
      Effect.orElseSucceed(() => O.some(instanceId))
    )
  );
  return A.getSomes(configured);
});

/**
 * Publishes a handled message to the job-retry queue when the pool has a
 * retry policy and attempts remain.
 *
 * **Details**
 *
 * The counter starts at 0 on the first publish; the delay is
 * `delaySeconds * delayBackoff ^ counter`, capped at 900 seconds.
 *
 * **Example** (Wire the publisher)
 *
 * ```ts
 * import { publishJobRetry } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(typeof publishJobRetry)
 * ```
 *
 * @param input - Pool config and the message to re-check later.
 * @returns Nothing; a disabled policy or exhausted attempts publish nothing.
 * @category use-cases
 * @since 0.0.0
 */
export const publishJobRetry = Effect.fn("ScaleUp.publishJobRetry")(function* (input: {
  readonly config: PoolRuntimeConfig;
  readonly message: ActionRequestMessage;
}) {
  const policy = input.config.pool.jobRetry;
  const queueUrl = input.config.jobRetryQueueUrl;
  if (O.isNone(policy) || O.isNone(queueUrl)) {
    return;
  }
  const counter = O.match(O.fromUndefinedOr(input.message.retryCounter), {
    onNone: () => 0,
    onSome: (current) => current + 1,
  });
  if (counter >= policy.value.maxAttempts) {
    return;
  }
  const delay = Math.min(policy.value.delaySeconds * policy.value.delayBackoff ** counter, 900);
  const queue = yield* MessageQueue;
  const body = yield* encodeActionRequest(ActionRequestMessage.make({ ...input.message, retryCounter: counter })).pipe(
    Effect.orDie
  );
  yield* queue.send({ queueUrl: queueUrl.value, body, delaySeconds: O.some(Math.floor(delay)) });
});

const byRetryCounter = Order.mapInput(
  Order.Number,
  (request: QueuedActionRequest) => request.message.retryCounter ?? 0
);

const scaleUpGroup = Effect.fn("ScaleUp.group")(function* (
  config: PoolRuntimeConfig,
  owner: RunnerOwner,
  messages: A.NonEmptyReadonlyArray<QueuedActionRequest>
) {
  const ec2 = yield* Ec2Fleet;
  const github = yield* GitHubRunners;
  const ssm = yield* SsmStore;
  const token = yield* installationTokenFor(owner, messages[0].message.installationId);

  const stillQueued = yield* Effect.filter(messages, ({ message }) =>
    config.pool.jobQueuedCheck
      ? github
          .isJobQueued(token, { owner: message.repositoryOwner, repo: message.repositoryName, jobId: message.id })
          .pipe(Effect.orElseSucceed(() => true))
      : Effect.succeed(true)
  );
  if (A.isReadonlyArrayEmpty(stillQueued)) {
    return [];
  }

  const current =
    config.pool.maximumCount === -1
      ? 0
      : (yield* ec2.listRunners(
          RunnerFilter.make({
            environment: O.some(config.environment),
            type: O.some(owner.type),
            owner: O.some(owner.owner),
          })
        )).length;
  const wanted = stillQueued.length;
  const allowed =
    config.pool.maximumCount === -1 ? wanted : Math.max(0, Math.min(wanted, config.pool.maximumCount - current));
  const skipped = wanted - allowed;
  const overCap = config.pool.ephemeral ? A.map(A.take(messages, skipped), ({ messageId }) => messageId) : [];
  const publishRetries = (retrying: ReadonlyArray<string>) =>
    Effect.forEach(
      A.filter(stillQueued, ({ messageId }) => !A.contains(retrying, messageId)),
      ({ message }) => publishJobRetry({ config, message }).pipe(Effect.ignore),
      { discard: true }
    );

  if (allowed <= 0) {
    yield* publishRetries(overCap);
    return overCap;
  }

  const imageId = yield* O.match(config.amiIdParameterName, {
    onNone: () => Effect.succeedNone,
    onSome: (name) => ssm.get(name).pipe(Effect.map(O.map(Redacted.value))),
  }).pipe(Effect.result);
  const launched: LaunchOutcome =
    imageId._tag === "Failure"
      ? failedLaunch(allowed, imageId.failure.retryable)
      : yield* launchRunners(
          FleetLaunchInput.make({
            config,
            owner,
            count: allowed,
            capacityType: config.pool.capacityType,
            imageId: imageId.success,
          })
        );

  const failedConfig = A.isReadonlyArrayNonEmpty(launched.instanceIds)
    ? yield* configureRunners({ config, token, owner, instanceIds: launched.instanceIds })
    : [];
  yield* Effect.forEach(failedConfig, (instanceId) => ec2.terminate(instanceId).pipe(Effect.ignore), {
    discard: true,
  });

  const retryCount = launched.retryable + failedConfig.length;
  const retrying = A.appendAll(
    overCap,
    A.map(A.take(A.drop(messages, skipped), retryCount), ({ messageId }) => messageId)
  );
  yield* publishRetries(retrying);
  return retrying;
});

/**
 * Handles one build-queue batch and returns the SQS message ids to report as
 * batch item failures (they come back after the visibility timeout).
 *
 * **Details**
 *
 * Messages are sorted by retry counter and grouped by owner. Per group:
 * optional "still queued" check (fail-open), live runner count against the
 * VM cap, launch, configure, terminate what failed configuration. With
 * ephemeral runners, messages over the cap and retryable launch failures are
 * returned for redelivery; everything else handled is published to the
 * job-retry queue. Non-`workflow_job` events with ephemeral runners are
 * returned (upstream behaviour); a repository owned by a user while the pool
 * registers org runners is dropped. A group whose GitHub auth fails returns
 * all its messages.
 *
 * **Example** (Wire the program)
 *
 * ```ts
 * import { handleScaleUp } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(typeof handleScaleUp)
 * ```
 *
 * @param input - Pool runtime config and the decoded batch.
 * @returns Message ids to retry.
 * @category use-cases
 * @since 0.0.0
 */
export const handleScaleUp = Effect.fn("ScaleUp.handle")(function* (input: {
  readonly config: PoolRuntimeConfig;
  readonly batch: ReadonlyArray<QueuedActionRequest>;
}) {
  const { config } = input;
  const sorted = A.sort(input.batch, byRetryCounter);
  const unsupported = A.filter(sorted, ({ message }) => config.pool.ephemeral && message.eventType !== "workflow_job");
  const eligible = A.filter(
    sorted,
    ({ message }) =>
      !(config.pool.ephemeral && message.eventType !== "workflow_job") &&
      !(config.runnerType === "Org" && message.repoOwnerType !== "Organization")
  );
  const groups = A.groupBy(
    eligible,
    ({ message }) => ownerOf({ runnerType: config.runnerType, message: message }).owner
  );
  const retried = yield* Effect.forEach(R.values(groups), (group) =>
    scaleUpGroup(config, ownerOf({ runnerType: config.runnerType, message: group[0].message }), group).pipe(
      Effect.orElseSucceed(() => A.map(group, ({ messageId }) => messageId))
    )
  );
  return A.dedupe(
    A.appendAll(
      A.map(unsupported, ({ messageId }) => messageId),
      A.flatten(retried)
    )
  );
});
