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
import { AwsFault, AwsThrottlingCode } from "./RunnerFleet.errors.ts";
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
  "deleteToken",
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
 * Classifies a failed runner-configuration step by whether a resend can
 * succeed.
 *
 * **Details**
 *
 * The token put (`putToken`) and `generateJitConfig` create something named
 * after one instance. The clients resend a call whose response was lost, so a
 * conflict there (SSM `ParameterAlreadyExists` or a 409, GitHub a 409) reads as
 * the first attempt having landed: it is transient, because the retried job
 * launches a new instance with new names. A conflict in any other step stays
 * deterministic. Otherwise, AWS: a throttling code is transient whatever the status (AWS throttles
 * with HTTP 400); otherwise the live layer's fault reading decides, and only
 * an unread fault falls back to the status. GitHub: a rate limit is transient
 * even on a 403; otherwise the status decides. A failure with neither is
 * transient, so an unreadable failure keeps the bounded retry path.
 *
 * **Gotchas**
 *
 * A 409 from `generateJitConfig` carries no runner id, so the cleanup cannot
 * delete that registration. What is left is an offline JIT registration on
 * GitHub, not a running machine.
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
 * console.log(classifyFailure("putToken")(error)) // "deterministic"
 * ```
 *
 * @param operation - The step that failed.
 * @returns A classifier of that step's typed error: `deterministic` or `transient`.
 * @category use-cases
 * @since 0.0.0
 */
export const classifyFailure =
  (operation: ConfigureOperation) =>
  (error: AwsApiError | GitHubApiError): FailureClass =>
    isLandedCreate(operation, error)
      ? FailureClass.Enum.transient
      : error._tag === "AwsApiError"
        ? classifyAws(error)
        : classifyGitHub(error);

const isConflictStatus = (status: O.Option<number>): boolean => O.exists(status, (value) => value === 409);

// A create resent after a lost response conflicts with its own first attempt. Only these two steps create under a name
// that is unique to the instance, so only their conflicts mean "it landed".
const isLandedCreate = (operation: ConfigureOperation, error: AwsApiError | GitHubApiError): boolean =>
  error._tag === "AwsApiError"
    ? ConfigureOperation.is.putToken(operation) &&
      (O.exists(error.code, (code) => code === "ParameterAlreadyExists") || isConflictStatus(error.status))
    : ConfigureOperation.is.generateJitConfig(operation) && isConflictStatus(error.status);

const byStatus = (status: O.Option<number>): FailureClass =>
  O.getOrElse(O.flatMap(status, statusClass), () => FailureClass.Enum.transient);

const isThrottlingCode = S.is(AwsThrottlingCode);

// A throttling code wins over everything (AWS throttles with HTTP 400); then the layer's fault reading, which already
// weighed the status; only an unread fault falls back to the bare status.
const classifyAws = (error: AwsApiError): FailureClass =>
  O.exists(error.code, isThrottlingCode)
    ? FailureClass.Enum.transient
    : AwsFault.match(error.fault, {
        client: () => FailureClass.Enum.deterministic,
        transient: () => FailureClass.Enum.transient,
        unknown: () => byStatus(error.status),
      });

// A primary or secondary rate limit is throttling even when GitHub answers 403.
const classifyGitHub = (error: GitHubApiError): FailureClass =>
  error.rateLimited ? FailureClass.Enum.transient : byStatus(error.status);

/**
 * One launched runner whose configuration failed: the step, its
 * classification and the provider's status, code and (scrubbed) message.
 *
 * **Details**
 *
 * `runnerId` is the GitHub runner JIT created before the failure, and
 * `tokenParameter` the token parameter that may exist (a token write that
 * failed client-side can still have landed); cleanup removes both.
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
 *   runnerId: O.some(1001),
 *   tokenParameter: O.some("/beep-ci/heavy/tokens/i-1"),
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
    runnerId: S.Option(S.Int).annotateKey({ description: "The GitHub runner JIT created before the failure." }),
    tokenParameter: S.Option(S.String).annotateKey({
      description: "The token parameter that may have been written before the failure.",
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
  created: {
    readonly secrets?: ReadonlyArray<Redacted.Redacted<string>>;
    readonly runnerId?: number;
    readonly tokenParameter?: string;
  } = {}
): ConfigureFailure =>
  ConfigureFailure.make({
    instanceId,
    operation,
    failureClass: classifyFailure(operation)(error),
    status: error.status,
    code: error.code,
    message: scrubMessage(error.message, created.secrets ?? []),
    runnerId: O.fromUndefinedOr(created.runnerId),
    tokenParameter: O.fromUndefinedOr(created.tokenParameter),
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
 * masked; a failed instance tag is logged and otherwise ignored. Each
 * failure records the JIT runner and the token parameter it may leave
 * behind; removing them and terminating the instance is
 * {@link cleanUpFailedRunner}'s job.
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
  const tokenParameterOf = (instanceId: string) => `${config.tokenPath}/${instanceId}`;
  const putToken = (instanceId: string, value: Redacted.Redacted<string>) =>
    ssm.put(
      ParameterWrite.make({
        name: tokenParameterOf(instanceId),
        value,
        secure: true,
        tier: "Advanced",
        tags: { InstanceId: instanceId },
      })
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
          Effect.mapError((error) =>
            failureOf(instanceId, "putToken", error, {
              secrets: [jit.encodedJitConfig],
              runnerId: jit.runnerId,
              tokenParameter: tokenParameterOf(instanceId),
            })
          )
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
      Effect.mapError((error) =>
        failureOf(instanceId, "putToken", error, {
          secrets: [args, registration.success],
          tokenParameter: tokenParameterOf(instanceId),
        })
      )
    )
  );
});

/**
 * Removes what a failed runner configuration left behind, in order: the
 * token parameter, the GitHub JIT runner, then the instance.
 *
 * **Details**
 *
 * A token parameter left behind counts as a launched runner for the
 * in-flight window and holds a slot under the pool's cap; a JIT runner left
 * behind is an offline registration. Each step that fails is logged as a
 * warning naming the step, and the next step still runs.
 *
 * **Example** (Wire the cleanup)
 *
 * ```ts
 * import { cleanUpFailedRunner } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(typeof cleanUpFailedRunner)
 * ```
 *
 * @param input - Installation token, owner and the configure failure.
 * @returns Nothing; every failed step is logged.
 * @category use-cases
 * @since 0.0.0
 */
export const cleanUpFailedRunner = Effect.fn("ScaleUp.cleanUpFailedRunner")(function* (input: {
  readonly token: InstallationToken;
  readonly owner: RunnerOwner;
  readonly failure: ConfigureFailure;
}) {
  const { failure } = input;
  const ssm = yield* SsmStore;
  const github = yield* GitHubRunners;
  const ec2 = yield* Ec2Fleet;
  const logCleanupFailure =
    (operation: ConfigureOperation, extra: Readonly<Record<string, unknown>>) =>
    (error: AwsApiError | GitHubApiError) =>
      Effect.logWarning("scale-up: cleaning up a runner whose configuration failed failed").pipe(
        Effect.annotateLogs({ ...failureAnnotations(failureOf(failure.instanceId, operation, error)), ...extra })
      );
  yield* O.match(failure.tokenParameter, {
    onNone: () => Effect.void,
    onSome: (name) => ssm.delete(name).pipe(Effect.catch(logCleanupFailure("deleteToken", { tokenParameter: name }))),
  });
  yield* O.match(failure.runnerId, {
    onNone: () => Effect.void,
    onSome: (runnerId) =>
      github
        .deleteRunner(input.token, input.owner, runnerId)
        .pipe(Effect.catch(logCleanupFailure("deleteRunner", { runnerId }))),
  });
  yield* ec2.terminate(failure.instanceId).pipe(Effect.catch(logCleanupFailure("terminate", {})));
});

/**
 * What one job-retry publish did.
 *
 * **Example** (The second attempt of a two-attempt policy)
 *
 * ```ts
 * import { JobRetryOutcome } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(JobRetryOutcome.is["retries-exhausted"]("retries-exhausted")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JobRetryOutcome = LiteralKit(["published", "no-retry-policy", "retries-exhausted"]).pipe(
  $I.annoteSchema("JobRetryOutcome", { description: "What one job-retry publish did." })
);

/**
 * Runtime type for {@link JobRetryOutcome}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JobRetryOutcome = typeof JobRetryOutcome.Type;

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
 * @returns `published`, or why nothing was: no retry policy or queue, or the attempts are used up.
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
    return JobRetryOutcome.Enum["no-retry-policy"];
  }
  const counter = O.match(O.fromUndefinedOr(input.message.retryCounter), {
    onNone: () => 0,
    onSome: (current) => current + 1,
  });
  if (counter >= policy.value.maxAttempts) {
    return JobRetryOutcome.Enum["retries-exhausted"];
  }
  const delay = Math.min(policy.value.delaySeconds * policy.value.delayBackoff ** counter, 900);
  const queue = yield* MessageQueue;
  const body = yield* encodeActionRequest(ActionRequestMessage.make({ ...input.message, retryCounter: counter })).pipe(
    Effect.orDie
  );
  yield* queue.send({ queueUrl: queueUrl.value, body, delaySeconds: O.some(Math.floor(delay)) });
  return JobRetryOutcome.Enum.published;
});

/**
 * What happened to a message scale-up dead-lettered after a failed runner
 * configuration.
 *
 * **Details**
 *
 * Every outcome acknowledges the message. `send-failed` logs one more error
 * line naming the failed send: a returned message would relaunch an instance
 * once per visibility timeout, and the build queue has no redrive to stop it.
 * `no-dlq` (a runtime config without the build DLQ) acknowledges it with only
 * the error log.
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
    description: "What happened to a message scale-up dead-lettered after a failed runner configuration.",
  })
);

/**
 * Runtime type for {@link DeadLetterOutcome}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeadLetterOutcome = typeof DeadLetterOutcome.Type;

/**
 * Why scale-up dead-lettered a message instead of retrying it.
 *
 * **Details**
 *
 * `deterministic`: a resend fails the same way. The others are a transient
 * failure with no job-retry left: the pool has no retry policy, its attempts
 * are used up, or publishing the retry failed. Redelivering such a message
 * would relaunch an instance on SQS's fixed visibility timeout, with no
 * backoff and no re-check of the job.
 *
 * **Example** (Attempts used up)
 *
 * ```ts
 * import { DeadLetterReason } from "@beep/alchemy-github-runners/ScaleUp.program"
 *
 * console.log(DeadLetterReason.is["retries-exhausted"]("retries-exhausted")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeadLetterReason = LiteralKit([
  "deterministic",
  "no-retry-policy",
  "retries-exhausted",
  "retry-publish-failed",
]).pipe($I.annoteSchema("DeadLetterReason", { description: "Why scale-up dead-lettered a message." }));

/**
 * Runtime type for {@link DeadLetterReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeadLetterReason = typeof DeadLetterReason.Type;

// Acknowledges a message whose runner configuration failed with no retry worth making: the message goes to the
// build DLQ instead of back to a queue, logged as an error. A failed DLQ send is logged and the message dropped.
const deadLetter = Effect.fn("ScaleUp.deadLetter")(function* (
  config: PoolRuntimeConfig,
  request: QueuedActionRequest,
  failure: ConfigureFailure,
  reason: DeadLetterReason
) {
  const queue = yield* MessageQueue;
  const body = yield* encodeActionRequest(request.message).pipe(Effect.orDie);
  const outcome = yield* O.match(config.buildDlqUrl, {
    onNone: () => Effect.succeed(DeadLetterOutcome.Enum["no-dlq"]),
    onSome: (queueUrl) =>
      queue.send({ queueUrl, body, delaySeconds: O.none() }).pipe(
        Effect.as(DeadLetterOutcome.Enum.sent),
        Effect.catch((error) =>
          Effect.logError("scale-up: build DLQ send failed; the message is dropped").pipe(
            Effect.annotateLogs({
              messageId: request.messageId,
              jobId: request.message.id,
              repository: `${request.message.repositoryOwner}/${request.message.repositoryName}`,
              reason,
              code: O.getOrNull(error.code),
              status: O.getOrNull(error.status),
            }),
            Effect.as(DeadLetterOutcome.Enum["send-failed"])
          )
        )
      ),
  });
  yield* Effect.logError(
    "scale-up: dead-lettering the message; a redelivery would relaunch an instance with no backoff"
  ).pipe(
    Effect.annotateLogs({
      ...failureAnnotations(failure),
      messageId: request.messageId,
      jobId: request.message.id,
      reason,
      deadLetter: outcome,
    })
  );
  return outcome;
});

const byRetryCounter = Order.mapInput(
  Order.Number,
  (request: QueuedActionRequest) => request.message.retryCounter ?? 0
);

const messageIdsOf = (requests: ReadonlyArray<QueuedActionRequest>) =>
  HashSet.fromIterable(A.map(requests, ({ messageId }) => messageId));

// Publishes a job-retry re-check; a failed publish is logged and never fails the batch.
const publishRetryLogged = (config: PoolRuntimeConfig, request: QueuedActionRequest) =>
  publishJobRetry({ config, message: request.message }).pipe(
    Effect.asSome,
    Effect.catch((error) =>
      Effect.logWarning("scale-up: publishing a job-retry re-check failed").pipe(
        Effect.annotateLogs({
          messageId: request.messageId,
          jobId: request.message.id,
          code: O.getOrNull(error.code),
          status: O.getOrNull(error.status),
          providerMessage: scrubMessage(error.message, []),
        }),
        Effect.as(O.none<JobRetryOutcome>())
      )
    )
  );

const scaleUpGroup = Effect.fn("ScaleUp.group")(function* (
  config: PoolRuntimeConfig,
  owner: RunnerOwner,
  messages: A.NonEmptyReadonlyArray<QueuedActionRequest>
) {
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
    Effect.forEach(requests, (request) => publishRetryLogged(config, request), { concurrency: 1, discard: true });
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
  yield* Effect.forEach(failures, (failure) => cleanUpFailedRunner({ token, owner, failure }), {
    concurrency: 1,
    discard: true,
  });

  // The launch's messages, in order: a retryable shortfall first, then one per deterministic failure, then one per
  // transient failure; the rest (launched runners and a non-retryable shortfall) keep the job-retry re-check.
  const launchable = A.drop(stillQueued, skipped);
  const launchRetry = A.take(launchable, launched.retryable);
  const afterRetry = A.drop(launchable, launched.retryable);
  const deterministicFailures = A.filter(failures, (failure) => FailureClass.is.deterministic(failure.failureClass));
  const transientFailures = A.filter(failures, (failure) => FailureClass.is.transient(failure.failureClass));
  const deterministic = A.zip(A.take(afterRetry, deterministicFailures.length), deterministicFailures);
  const transient = A.zip(
    A.take(A.drop(afterRetry, deterministicFailures.length), transientFailures.length),
    transientFailures
  );

  // A transient failure retries through job-retry, which re-checks the job and backs off with the retry counter.
  // With no retry left it is dead-lettered like a deterministic one: a redelivery would relaunch on SQS's fixed
  // visibility timeout.
  const unretried = yield* Effect.forEach(
    transient,
    ([request, failure]) =>
      publishRetryLogged(config, request).pipe(
        Effect.map((outcome) =>
          O.match(outcome, {
            onNone: () => O.some([request, failure, DeadLetterReason.Enum["retry-publish-failed"]] as const),
            onSome: (published) =>
              JobRetryOutcome.match(published, {
                published: () => O.none(),
                "no-retry-policy": () => O.some([request, failure, DeadLetterReason.Enum["no-retry-policy"]] as const),
                "retries-exhausted": () =>
                  O.some([request, failure, DeadLetterReason.Enum["retries-exhausted"]] as const),
              }),
          })
        )
      ),
    { concurrency: 1 }
  );
  yield* Effect.forEach(
    A.appendAll(
      A.map(deterministic, ([request, failure]) => [request, failure, DeadLetterReason.Enum.deterministic] as const),
      A.getSomes(unretried)
    ),
    ([request, failure, reason]) => deadLetter(config, request, failure, reason),
    { concurrency: 1, discard: true }
  );
  yield* publishRetries(
    handledExcept(
      A.appendAll(
        A.appendAll(overCap, launchRetry),
        A.appendAll(
          A.map(deterministic, ([request]) => request),
          A.map(transient, ([request]) => request)
        )
      )
    )
  );
  return A.map(A.appendAll(overCap, launchRetry), ({ messageId }) => messageId);
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
 * and backs off with the retry counter; when no retry can be published (no
 * retry policy, attempts used up, or a failed publish) it is dead-lettered
 * too. A dead-lettered message is always acknowledged; a failed DLQ send is
 * logged as an error and the message dropped. Nothing redrives the build DLQ, so a
 * dead-lettered job waits until GitHub times it out. Everything else handled
 * is published to the job-retry queue. Non-`workflow_job` events with ephemeral runners are
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
