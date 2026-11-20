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

import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FleetLaunchRequest, FleetOverride } from "./Ec2Fleet.models.ts";
import { Ec2Fleet } from "./Ec2Fleet.service.ts";
import { GitHubRunners } from "./GitHubApp.service.ts";
import { JitConfigRequest, RunnerOwner } from "./GitHubRunners.models.ts";
import { $AlchemyGithubRunnersId } from "./internal/AlchemyGithubRunnersId.ts";
import { installationTokenFor, ownerOf } from "./internal/Installation.ts";
import { MessageQueue } from "./MessageQueue.service.ts";
import { RunnerFilter, RunnerTag, runnerApplicationTagValue } from "./RunnerInstance.models.ts";
import { ActionRequestMessage } from "./RunnerMessages.models.ts";
import { CapacityType } from "./RunnerPool.models.ts";
import { PoolRuntimeConfig } from "./RunnerRuntime.models.ts";
import { runnerGroupCacheName } from "./SsmParameters.models.ts";
import { ParameterWrite, SsmStore } from "./SsmStore.service.ts";
import type { FleetLaunchResult } from "./Ec2Fleet.models.ts";
import type { InstallationToken } from "./GitHubRunners.models.ts";
import type { AwsApiError, GitHubApiError } from "./RunnerFleet.errors.ts";
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
 * error is (throttling, 5xx, network) or when its code is in `scaleErrors`,
 * the same quota and capacity codes as a per-instance error. A partial launch
 * counts the shortfall as retryable when any reported error code is in
 * `scaleErrors`, otherwise as not retryable. Retryable messages go back to the
 * build queue as batch item failures and are never also published to the
 * job-retry queue.
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
    // A request-level quota or capacity error (`MaxSpotInstanceCountExceeded`, `InsufficientInstanceCapacity`, ...) is
    // retryable exactly as the same code is per instance: the group's messages return as batch item failures only.
    const scaleError = O.exists(attempt.failure.code, (code) => A.contains(input.config.scaleErrors, code));
    return failedLaunch(input.count, attempt.failure.retryable || scaleError);
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
  yield* ssm.put(
    ParameterWrite.make({
      name: cacheName,
      value: Redacted.make(String(groupId)),
      secure: false,
      tier: "Standard",
      tags: {},
    })
  );
  return groupId;
});

/**
 * A step of configuring one launched runner, or of cleaning one up.
 *
 * **Example** (The JIT token write)
 *
 * ```ts
 * import { ConfigureOperation } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(ConfigureOperation.is.putToken("putToken")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ConfigureOperation = LiteralKit([
  "resolveRunnerGroup",
  "generateJitConfig",
  "tagInstance",
  "registrationToken",
  "putToken",
  "deleteRunner",
  "terminate",
]).pipe($I.annoteSchema("ConfigureOperation", { description: "A step of configuring or cleaning up one runner." }));

/**
 * Runtime type for {@link ConfigureOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConfigureOperation = typeof ConfigureOperation.Type;

/**
 * Whether sending a failed request again can succeed.
 *
 * **Details**
 *
 * `deterministic`: an HTTP 4xx other than 429, or an AWS error the live layer
 * reads as the client's fault (validation, authorization, quota). A resend
 * fails the same way. `transient`: a 5xx, a 429, throttling, a timeout, or a
 * failure with no status and no client-fault reading.
 *
 * **Example** (A refused SSM write)
 *
 * ```ts
 * import { FailureClass } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(FailureClass.is.deterministic("deterministic")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FailureClass = LiteralKit(["deterministic", "transient"]).pipe(
  $I.annoteSchema("FailureClass", { description: "Whether sending a failed request again can succeed." })
);

/**
 * Runtime type for {@link FailureClass}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FailureClass = typeof FailureClass.Type;

const statusClass = (status: number): O.Option<FailureClass> =>
  status === 429 || status >= 500
    ? O.some("transient")
    : status >= 400 && status < 500
      ? O.some("deterministic")
      : O.none();

/**
 * Classifies a failed AWS or GitHub call by whether a resend can succeed.
 *
 * **Details**
 *
 * The HTTP status decides when the error carries one. Otherwise an AWS error
 * the live layer read as the client's fault is deterministic, and anything
 * else is transient, so an unreadable failure keeps the bounded retry path.
 *
 * **Example** (An SSM value over the tier limit)
 *
 * ```ts
 * import { classifyFailure } from "@beep/alchemy-github-runners/ScaleUp.program"
 * import { AwsApiError } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 * import * as O from "effect/Option"
 *
 * const error = AwsApiError.make({
 *   service: "ssm", operation: "putParameter", code: O.some("ValidationException"), fault: "client", message: "too long",
 * })
 * console.log(classifyFailure(error)) // "deterministic"
 * ```
 *
 * @param error - The failed call's typed error.
 * @returns `deterministic` or `transient`.
 * @category use-cases
 * @since 0.0.0
 */
export const classifyFailure = (error: AwsApiError | GitHubApiError): FailureClass =>
  O.getOrElse(O.flatMap(error.status, statusClass), () =>
    error._tag === "AwsApiError" && error.fault === "client" ? "deterministic" : "transient"
  );

/**
 * One launched runner whose configuration failed: the step, its
 * classification and the provider's status, code and (scrubbed) message.
 *
 * **Example** (A refused JIT token write)
 *
 * ```ts
 * import { ConfigureFailure } from "@beep/alchemy-github-runners/ScaleUp.program"
 * import * as O from "effect/Option"
 *
 * const failure = ConfigureFailure.make({
 *   instanceId: "i-1",
 *   operation: "putToken",
 *   failureClass: "deterministic",
 *   status: O.none(),
 *   code: O.some("ValidationException"),
 *   message: "value too long",
 * })
 * console.log(failure.failureClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConfigureFailure extends S.Opaque<ConfigureFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    instanceId: S.String,
    operation: ConfigureOperation,
    failureClass: FailureClass,
    status: S.Option(S.Int),
    code: S.Option(S.String),
    message: S.String.annotateKey({
      description: "The provider's message, with known secrets and long tokens masked.",
    }),
  }).pipe($I.annoteSchema("ConfigureFailure", { description: "One launched runner whose configuration failed." }))
) {}

const maxLoggedMessage = 512;
// JIT configs and registration tokens are long base64 or base62 runs; mask any such run a provider echoes back.
const tokenLike = /[A-Za-z0-9+/=_-]{40,}/gu;

// Masks every known secret value and any token-like run, then bounds the length; never logs a value verbatim.
const scrubMessage = (message: string, secrets: ReadonlyArray<Redacted.Redacted<string>>): string =>
  pipe(
    A.reduce(secrets, message, (text, secret) => {
      const value = Redacted.value(secret);
      return Str.isNonEmpty(value) ? Str.replaceAll(value, "<redacted>")(text) : text;
    }),
    Str.replaceAll(tokenLike, "<redacted>"),
    Str.slice(0, maxLoggedMessage)
  );

const failureOf = (
  instanceId: string,
  operation: ConfigureOperation,
  error: AwsApiError | GitHubApiError,
  secrets: ReadonlyArray<Redacted.Redacted<string>> = []
): ConfigureFailure =>
  ConfigureFailure.make({
    instanceId,
    operation,
    failureClass: classifyFailure(error),
    status: error.status,
    code: error.code,
    message: scrubMessage(error.message, secrets),
  });

const failureAnnotations = (failure: ConfigureFailure) => ({
  instanceId: failure.instanceId,
  operation: failure.operation,
  failureClass: failure.failureClass,
  status: O.getOrNull(failure.status),
  code: O.getOrNull(failure.code),
  providerMessage: failure.message,
});

const logConfigureFailure = (failure: ConfigureFailure) =>
  Effect.logWarning("scale-up: runner configuration step failed").pipe(
    Effect.annotateLogs(failureAnnotations(failure))
  );

// Configures each instance in order and returns its failures, each logged once; one failure never stops the others.
const collectFailures = <R>(
  instanceIds: ReadonlyArray<string>,
  configure: (instanceId: string) => Effect.Effect<unknown, ConfigureFailure, R>
): Effect.Effect<ReadonlyArray<ConfigureFailure>, never, R> =>
  Effect.map(
    Effect.forEach(
      instanceIds,
      (instanceId) =>
        configure(instanceId).pipe(
          Effect.as(O.none<ConfigureFailure>()),
          Effect.catch((failure) => logConfigureFailure(failure).pipe(Effect.as(O.some(failure))))
        ),
      { concurrency: 1 }
    ),
    A.getSomes
  );

// A step that failed for the whole group fails every instance of it, each logged once.
const failEvery = (
  instanceIds: ReadonlyArray<string>,
  operation: ConfigureOperation,
  error: AwsApiError | GitHubApiError
): Effect.Effect<ReadonlyArray<ConfigureFailure>> =>
  collectFailures(instanceIds, (instanceId) => Effect.fail(failureOf(instanceId, operation, error)));

/**
 * Writes the start configuration of each launched instance into SSM and
 * returns the instances that could not be configured.
 *
 * **Details**
 *
 * Ephemeral JIT pools get one JIT config per instance (runner name
 * `<prefix><instance-id>`), stored as an Advanced-tier SecureString at
 * `<tokenPath>/<instance-id>` tagged `InstanceId` (a JIT config exceeds the
 * Standard tier's 4 KB), and the instance is tagged `ghr:github_runner_id`.
 * Other pools share one registration token rendered as `config.sh`
 * arguments, written the same way. A failure for one instance does not stop
 * the others. Every failure is logged once as a warning naming the step, the
 * HTTP status, the provider code and the provider message with secrets
 * masked; a failed instance tag is logged and otherwise ignored. When the
 * token write fails after GitHub created the JIT runner, the runner is
 * deleted again (a failed deletion is logged). Terminating the instance is
 * the caller's job.
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
 * @returns One classified failure per instance that could not be configured.
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
    ssm.put(
      ParameterWrite.make({
        name: `${config.tokenPath}/${instanceId}`,
        value,
        secure: true,
        tier: "Advanced",
        tags: { InstanceId: instanceId },
      })
    );
  const deleteJitRunner = (instanceId: string, runnerId: number) =>
    github
      .deleteRunner(token, owner, runnerId)
      .pipe(
        Effect.catch((error) =>
          Effect.logWarning("scale-up: deleting the JIT runner of a failed instance failed").pipe(
            Effect.annotateLogs({ ...failureAnnotations(failureOf(instanceId, "deleteRunner", error)), runnerId })
          )
        )
      );

  if (config.pool.ephemeral && config.pool.jitConfig) {
    const groupId = yield* resolveRunnerGroupId(config, token, owner).pipe(Effect.result);
    if (groupId._tag === "Failure") {
      return yield* failEvery(input.instanceIds, "resolveRunnerGroup", groupId.failure);
    }
    return yield* collectFailures(
      input.instanceIds,
      Effect.fnUntraced(function* (instanceId: string) {
        const jit = yield* github
          .generateJitConfig(
            token,
            JitConfigRequest.make({
              owner,
              name: `${config.pool.runnerNamePrefix}${instanceId}`,
              runnerGroupId: groupId.success,
              labels: config.pool.labels,
            })
          )
          .pipe(Effect.mapError((error) => failureOf(instanceId, "generateJitConfig", error)));
        // Scale-down reads the tag to deregister the runner; without it the runner is still usable, so only log it.
        yield* ec2
          .tag(instanceId, { [RunnerTag.githubRunnerId]: String(jit.runnerId) })
          .pipe(Effect.catch((error) => logConfigureFailure(failureOf(instanceId, "tagInstance", error))));
        yield* putToken(instanceId, jit.encodedJitConfig).pipe(
          Effect.mapError((error) => failureOf(instanceId, "putToken", error, [jit.encodedJitConfig])),
          Effect.tapError(() => deleteJitRunner(instanceId, jit.runnerId))
        );
      })
    );
  }

  const registration = yield* github.registrationToken(token, owner).pipe(Effect.result);
  if (registration._tag === "Failure") {
    return yield* failEvery(input.instanceIds, "registrationToken", registration.failure);
  }
  const args = Redacted.make(
    A.join(
      A.getSomes([
        O.some(`--url https://github.com/${owner.owner}`),
        O.some(`--token ${Redacted.value(registration.success)}`),
        O.some(`--labels ${A.join(config.pool.labels, ",")}`),
        owner.type === "Org" ? O.some(`--runnergroup ${config.pool.runnerGroup}`) : O.none(),
        config.pool.ephemeral ? O.some("--ephemeral") : O.none(),
      ]),
      " "
    )
  );
  return yield* collectFailures(input.instanceIds, (instanceId) =>
    putToken(instanceId, args).pipe(
      Effect.mapError((error) => failureOf(instanceId, "putToken", error, [args, registration.success]))
    )
  );
});

/**
 * Publishes a handled message to the job-retry queue when the pool has a
 * retry policy and attempts remain.
 *
 * **Details**
 *
 * The counter starts at 0 on the first publish and grows by one per publish
 * (job-retry carries it back to the build queue); the delay is
 * `delaySeconds * delayBackoff ^ counter`, capped at SQS's 900 seconds. The
 * live policy (120 s, backoff 2) waits 120 s, then 240 s.
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
 * @returns Whether a retry was published; a disabled policy or exhausted attempts publish nothing.
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
    return false;
  }
  const counter = O.match(O.fromUndefinedOr(input.message.retryCounter), {
    onNone: () => 0,
    onSome: (current) => current + 1,
  });
  if (counter >= policy.value.maxAttempts) {
    return false;
  }
  const delay = Math.min(policy.value.delaySeconds * policy.value.delayBackoff ** counter, 900);
  const queue = yield* MessageQueue;
  const body = yield* encodeActionRequest(ActionRequestMessage.make({ ...input.message, retryCounter: counter })).pipe(
    Effect.orDie
  );
  yield* queue.send({ queueUrl: queueUrl.value, body, delaySeconds: O.some(Math.floor(delay)) });
  return true;
});

/**
 * What happened to a message dropped after a deterministic configure failure.
 *
 * **Example** (Sent to the build DLQ)
 *
 * ```ts
 * import { DeadLetterOutcome } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(DeadLetterOutcome.is.sent("sent")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeadLetterOutcome = LiteralKit(["sent", "no-dlq", "send-failed"]).pipe(
  $I.annoteSchema("DeadLetterOutcome", {
    description: "What happened to a message dropped after a deterministic configure failure.",
  })
);

/**
 * Runtime type for {@link DeadLetterOutcome}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeadLetterOutcome = typeof DeadLetterOutcome.Type;

// Acknowledges a message whose runner configuration failed deterministically: a resend would relaunch an instance
// only to fail the same way, so the message goes to the build DLQ instead of back to a queue, logged as an error.
const deadLetter = Effect.fn("ScaleUp.deadLetter")(function* (
  config: PoolRuntimeConfig,
  request: QueuedActionRequest,
  failure: ConfigureFailure
) {
  const queue = yield* MessageQueue;
  const body = yield* encodeActionRequest(request.message).pipe(Effect.orDie);
  const outcome = yield* O.match(config.buildDlqUrl, {
    onNone: () => Effect.succeed<DeadLetterOutcome>("no-dlq"),
    onSome: (queueUrl) =>
      queue.send({ queueUrl, body, delaySeconds: O.none() }).pipe(
        Effect.as<DeadLetterOutcome>("sent"),
        Effect.catch((error) =>
          Effect.logWarning("scale-up: sending a dropped message to the build DLQ failed").pipe(
            Effect.annotateLogs({
              messageId: request.messageId,
              code: O.getOrNull(error.code),
              status: O.getOrNull(error.status),
            }),
            Effect.as<DeadLetterOutcome>("send-failed")
          )
        )
      ),
  });
  yield* Effect.logError(
    "scale-up: dropping the message; its runner configuration failed deterministically and a resend would relaunch an instance to fail again"
  ).pipe(
    Effect.annotateLogs({
      ...failureAnnotations(failure),
      messageId: request.messageId,
      jobId: request.message.id,
      deadLetter: outcome,
    })
  );
});

const byRetryCounter = Order.mapInput(
  Order.Number,
  (request: QueuedActionRequest) => request.message.retryCounter ?? 0
);

const messageIdsOf = (requests: ReadonlyArray<QueuedActionRequest>) =>
  HashSet.fromIterable(A.map(requests, ({ messageId }) => messageId));

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

  const ownerFilter = RunnerFilter.make({
    environment: O.some(config.environment),
    type: O.some(owner.type),
    owner: O.some(owner.owner),
  });
  const current = config.pool.maximumCount === -1 ? 0 : yield* countRunners(config, ownerFilter);
  const wanted = stillQueued.length;
  const allowed =
    config.pool.maximumCount === -1 ? wanted : Math.max(0, Math.min(wanted, config.pool.maximumCount - current));
  const skipped = wanted - allowed;
  const overCap = config.pool.ephemeral ? A.take(stillQueued, skipped) : [];
  const publishRetries = (requests: ReadonlyArray<QueuedActionRequest>) =>
    Effect.forEach(requests, ({ message }) => publishJobRetry({ config, message }).pipe(Effect.ignore), {
      concurrency: 1,
      discard: true,
    });
  const handledExcept = (excluded: ReadonlyArray<QueuedActionRequest>) => {
    const ids = messageIdsOf(excluded);
    return A.filter(stillQueued, ({ messageId }) => !HashSet.has(ids, messageId));
  };

  if (allowed <= 0) {
    yield* publishRetries(handledExcept(overCap));
    return A.map(overCap, ({ messageId }) => messageId);
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

  const failures = A.isReadonlyArrayNonEmpty(launched.instanceIds)
    ? yield* configureRunners({ config, token, owner, instanceIds: launched.instanceIds })
    : [];
  yield* Effect.forEach(
    failures,
    (failure) =>
      ec2
        .terminate(failure.instanceId)
        .pipe(
          Effect.catch((error) =>
            Effect.logWarning("scale-up: terminating an instance whose configuration failed failed").pipe(
              Effect.annotateLogs(failureAnnotations(failureOf(failure.instanceId, "terminate", error)))
            )
          )
        ),
    { concurrency: 1, discard: true }
  );

  // The launch's messages, in order: a retryable shortfall first, then one per deterministic failure, then one per
  // transient failure; the rest (launched runners and a non-retryable shortfall) keep the job-retry re-check.
  const launchable = A.drop(stillQueued, skipped);
  const launchRetry = A.take(launchable, launched.retryable);
  const afterRetry = A.drop(launchable, launched.retryable);
  const deterministic = A.filter(failures, (failure) => failure.failureClass === "deterministic");
  const transientCount = failures.length - deterministic.length;
  const dropped = A.zip(A.take(afterRetry, deterministic.length), deterministic);
  const transient = A.take(A.drop(afterRetry, deterministic.length), transientCount);

  yield* Effect.forEach(dropped, ([request, failure]) => deadLetter(config, request, failure), {
    concurrency: 1,
    discard: true,
  });
  // A transient failure retries through job-retry, which re-checks the job and backs off with the retry counter;
  // only when no retry can be published does the message come back as a batch item failure.
  const unpublished = yield* Effect.filter(transient, ({ message }) =>
    publishJobRetry({ config, message }).pipe(
      Effect.map((published) => !published),
      Effect.orElseSucceed(() => true)
    )
  );
  yield* publishRetries(
    handledExcept(
      A.appendAll(
        A.appendAll(overCap, launchRetry),
        A.appendAll(
          A.map(dropped, ([request]) => request),
          transient
        )
      )
    )
  );
  return A.map(A.appendAll(A.appendAll(overCap, launchRetry), unpublished), ({ messageId }) => messageId);
});

// A runner's JIT config parameter lives from its configuration until the runner reads and deletes it at boot, and
// Parameter Store reads are consistent where EC2's tag-filtered DescribeInstances lags a fresh launch. So a pool's
// launched runners are those EC2 shows plus those with a recent unconsumed JIT config EC2 does not show yet. Older
// parameters are left to the housekeeper: a runner that never booted within the window is not in flight.
const inFlightWindowMillis = 15 * 60 * 1000;

const instanceIdOf = (parameterName: string): string => A.lastNonEmpty(Str.split("/")(parameterName));

// Either read failing fails the group, so no launch happens and every message of the group goes back for retry.
// Parameter Store is read FIRST, EC2 second. A runner whose JIT config is gone at the first read has already booted,
// and a boot normally outlasts EC2's tag-filter lag (seconds), so the second read normally sees it. Reading EC2 first
// would let a runner fall between the reads: unseen by EC2, then its config deleted before Parameter Store is read. A
// runner seen by both is counted once, by instance id. An EC2 lag longer than a boot can still undercount. An invocation
// then launches at most min(runners missed, cap) beyond the true cap, since it requests at most `cap - counted`; across
// invocations the overshoot accumulates, ceilinged by the account's Spot vCPU quota. The CI runners cutover decision
// records the residual and its tripwire.
const countRunners = Effect.fnUntraced(function* (config: PoolRuntimeConfig, filter: RunnerFilter) {
  const ec2 = yield* Ec2Fleet;
  const ssm = yield* SsmStore;
  const tokens = yield* ssm.listByPath(config.tokenPath);
  const visible = yield* ec2.listRunners(filter);
  const now = yield* Clock.currentTimeMillis;
  const seen = HashSet.fromIterable(A.map(visible, (runner) => runner.instanceId));
  const inFlight = A.filter(
    tokens,
    (token) =>
      O.exists(token.lastModified, (modified) => now - modified <= inFlightWindowMillis) &&
      !HashSet.has(seen, instanceIdOf(token.name))
  );
  return A.length(visible) + A.length(inFlight);
});

/**
 * Handles one build-queue batch and returns the SQS message ids to report as
 * batch item failures (they come back after the visibility timeout).
 *
 * **Details**
 *
 * Messages are sorted by retry counter and grouped by owner. Per group:
 * optional "still queued" check (fail-open), runner count against the VM
 * cap, launch, configure, terminate what failed configuration. The count is
 * the runners EC2 shows plus those launched but not yet shown, read from
 * their unconsumed JIT config parameters. Parameter Store is read first, so a
 * runner that deleted its config before that read has booted, and EC2
 * normally shows a booted runner. An EC2 read lag longer than a boot can
 * still undercount. An invocation then launches at most min(runners missed,
 * cap) beyond the true cap, because it requests at most `cap - counted`;
 * across invocations the overshoot accumulates, ceilinged by the account's
 * Spot vCPU quota. The residual and its tripwire are in the CI runners
 * cutover decision. When either read fails, the group launches nothing
 * and every one of its messages is returned for retry. With
 * ephemeral runners, messages over the cap and retryable launch failures are
 * returned for redelivery. An instance whose configuration failed is
 * terminated once. When the failure is deterministic ({@link classifyFailure})
 * its message goes to the build DLQ and is acknowledged: no job-retry, no
 * redelivery, so a resend cannot relaunch an instance to fail again. When it
 * is transient its message is published to job-retry, which re-checks the job
 * and backs off with the retry counter, and comes back as a batch item failure
 * only when no retry can be published. Everything else handled is published
 * to the job-retry queue. Non-`workflow_job` events with ephemeral runners are
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
  const retried = yield* Effect.forEach(
    R.values(groups),
    (group) =>
      scaleUpGroup(config, ownerOf({ runnerType: config.runnerType, message: group[0].message }), group).pipe(
        Effect.orElseSucceed(() => A.map(group, ({ messageId }) => messageId))
      ),
    { concurrency: 1 }
  );
  return A.dedupe(
    A.appendAll(
      A.map(unsupported, ({ messageId }) => messageId),
      A.flatten(retried)
    )
  );
});
