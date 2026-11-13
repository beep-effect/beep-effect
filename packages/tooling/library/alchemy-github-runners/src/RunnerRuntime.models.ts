/**
 * What each fleet Lambda decodes from its environment at cold start.
 *
 * **Details**
 *
 * The composite writes one JSON document per Lambda into the environment
 * variable {@link runtimeConfigEnvName}; the Lambda decodes it once with the
 * matching schema. Everything the handlers need that is not a secret travels
 * this way; secrets stay in SSM and are read at runtime.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LabelMatchMode, RunnerArchitecture, RunnerPool, RunnerType } from "./RunnerPool.models.ts";
import { AppParameterNames, SsmParameterName } from "./SsmParameters.models.ts";

const $I = $AlchemyGithubRunnersId.create("RunnerRuntime.models");

/**
 * The environment variable that carries a Lambda's runtime config.
 *
 * **Example** (Read the name)
 *
 * ```ts
 * import { runtimeConfigEnvName } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * console.log(runtimeConfigEnvName) // "BEEP_RUNNER_CONFIG"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const runtimeConfigEnvName = "BEEP_RUNNER_CONFIG";

/**
 * EC2 error codes scale-up treats as retryable when `CreateFleet` returns them
 * per instance, as upstream's default `scale_errors`.
 *
 * **Example** (Is a capacity error retryable?)
 *
 * ```ts
 * import { defaultScaleErrors } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * console.log(defaultScaleErrors.includes("InsufficientInstanceCapacity")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultScaleErrors: ReadonlyArray<string> = [
  "UnfulfillableCapacity",
  "MaxSpotInstanceCountExceeded",
  "TargetCapacityLimitExceededException",
  "RequestLimitExceeded",
  "ResourceLimitExceeded",
  "MaxSpotFleetRequestCountExceeded",
  "InsufficientInstanceCapacity",
  "InsufficientCapacityOnHost",
];

/**
 * A launch template version the scale-up Lambda launches from.
 *
 * **Example** (Default version)
 *
 * ```ts
 * import { LaunchTemplateRef } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * const ref = LaunchTemplateRef.make({ launchTemplateId: "lt-0123456789abcdef0", version: "$Default" })
 * console.log(ref.version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LaunchTemplateRef extends S.Opaque<LaunchTemplateRef, { readonly brand: unique symbol }>()(
  S.Struct({
    launchTemplateId: S.String,
    version: S.String.annotateKey({ description: "A version number, $Default or $Latest." }),
  }).pipe(
    $I.annoteSchema("LaunchTemplateRef", {
      description: "A launch template version the scale-up Lambda launches from.",
    })
  )
) {}

/**
 * One pool as the webhook dispatcher sees it.
 *
 * **Example** (The heavy pool's matcher)
 *
 * ```ts
 * import { PoolMatcher } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * const matcher = PoolMatcher.make({
 *   pool: "heavy",
 *   queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789012/heavy-build",
 *   labels: ["beep-ec2-heavy"],
 *   labelMatch: "bidirectional",
 * })
 * console.log(matcher.pool)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PoolMatcher extends S.Opaque<PoolMatcher, { readonly brand: unique symbol }>()(
  S.Struct({
    pool: S.String,
    queueUrl: S.String,
    labels: S.NonEmptyArray(S.String),
    labelMatch: LabelMatchMode,
  }).pipe(
    $I.annoteSchema("PoolMatcher", {
      description: "One pool as the webhook dispatcher sees it.",
    })
  )
) {}

/**
 * Webhook Lambda runtime config.
 *
 * **Details**
 *
 * An empty `repositoryAllowList` admits every repository.
 *
 * **Example** (One pool, one repository)
 *
 * ```ts
 * import { PoolMatcher, WebhookRuntimeConfig } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * const config = WebhookRuntimeConfig.make({
 *   webhookSecretParameterName: "/beep-ci/app/github_app_webhook_secret",
 *   repositoryAllowList: ["beep-effect/beep-effect"],
 *   pools: [PoolMatcher.make({ pool: "heavy", queueUrl: "q", labels: ["beep-ec2-heavy"], labelMatch: "bidirectional" })],
 * })
 * console.log(config.pools.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebhookRuntimeConfig extends S.Opaque<WebhookRuntimeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    webhookSecretParameterName: SsmParameterName,
    repositoryAllowList: S.Array(S.String),
    pools: S.NonEmptyArray(PoolMatcher),
  }).pipe(
    $I.annoteSchema("WebhookRuntimeConfig", {
      description: "Webhook Lambda runtime config.",
    })
  )
) {}

/**
 * Runtime config shared by a pool's scale-up, job-retry and scale-down Lambdas.
 *
 * **Details**
 *
 * `environment` is the pool's `ghr:environment` tag value; inventory queries
 * filter on it so pools never see each other's instances. `amiIdParameterName`
 * overrides the launch template's image when set. `ghesApiUrl` is absent for
 * github.com.
 *
 * **Example** (Decode a pool config)
 *
 * ```ts
 * import { PoolRuntimeConfig } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(PoolRuntimeConfig)({
 *   pool: { name: "heavy", instanceTypes: ["m7i.4xlarge"], maximumCount: 2, labels: ["beep-ec2-heavy"] },
 *   environment: "beep-ci-heavy",
 *   runnerType: "Org",
 *   subnetIds: ["subnet-1"],
 *   launchTemplate: { launchTemplateId: "lt-1", version: "$Default" },
 *   tokenPath: "/beep-ci/heavy/tokens",
 *   configPath: "/beep-ci/heavy/config",
 *   buildQueueUrl: "https://sqs.us-east-1.amazonaws.com/1/heavy-build",
 *   app: { id: "/beep-ci/app/github_app_id", keyBase64: "/beep-ci/app/github_app_key_base64", webhookSecret: "/beep-ci/app/github_app_webhook_secret" },
 * })
 * console.log(config.pool.capacityType) // "spot"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PoolRuntimeConfig extends S.Opaque<PoolRuntimeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    pool: RunnerPool,
    environment: S.String,
    runnerType: RunnerType,
    subnetIds: S.NonEmptyArray(S.String),
    launchTemplate: LaunchTemplateRef,
    amiIdParameterName: S.OptionFromOptionalKey(SsmParameterName).pipe(S.withConstructorDefault(Effect.succeedNone)),
    tokenPath: SsmParameterName,
    configPath: SsmParameterName,
    buildQueueUrl: S.String,
    jobRetryQueueUrl: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    app: AppParameterNames,
    ghesApiUrl: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    scaleErrors: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(defaultScaleErrors)),
      S.withDecodingDefaultKey(Effect.succeed(defaultScaleErrors))
    ),
  }).pipe(
    $I.annoteSchema("PoolRuntimeConfig", {
      description: "Runtime config shared by a pool's scale-up, job-retry and scale-down Lambdas.",
    })
  )
) {}

/**
 * SSM housekeeper runtime config.
 *
 * **Example** (The live schedule's settings)
 *
 * ```ts
 * import { HousekeeperRuntimeConfig } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * const config = HousekeeperRuntimeConfig.make({ tokenPaths: ["/beep-ci/heavy/tokens"], minimumDaysOld: 1, dryRun: false })
 * console.log(config.minimumDaysOld)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HousekeeperRuntimeConfig extends S.Opaque<HousekeeperRuntimeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    tokenPaths: S.NonEmptyArray(SsmParameterName),
    minimumDaysOld: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    dryRun: S.Boolean,
  }).pipe(
    $I.annoteSchema("HousekeeperRuntimeConfig", {
      description: "SSM housekeeper runtime config.",
    })
  )
) {}

/**
 * Termination watcher runtime config.
 *
 * **Details**
 *
 * An instance is the watcher's only when its `ghr:environment` tag starts with
 * `environmentPrefix`, the upstream tag-filter rule. A busy runner is retried
 * through `deregisterRetryQueueUrl` after `retryDelaySeconds`.
 *
 * **Example** (The fleet watcher)
 *
 * ```ts
 * import { TerminationWatcherRuntimeConfig } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(TerminationWatcherRuntimeConfig)({
 *   environmentPrefix: "beep-ci",
 *   app: { id: "/r/app/github_app_id", keyBase64: "/r/app/github_app_key_base64", webhookSecret: "/r/app/github_app_webhook_secret" },
 *   deregisterRetryQueueUrl: "https://sqs.us-east-1.amazonaws.com/1/deregister-retry",
 * })
 * console.log(config.retryDelaySeconds) // 300
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TerminationWatcherRuntimeConfig extends S.Opaque<
  TerminationWatcherRuntimeConfig,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    environmentPrefix: S.String,
    app: AppParameterNames,
    deregisterRetryQueueUrl: S.String,
    retryDelaySeconds: S.Int.pipe(
      S.withConstructorDefault(Effect.succeed(300)),
      S.withDecodingDefaultKey(Effect.succeed(300))
    ),
    ghesApiUrl: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("TerminationWatcherRuntimeConfig", {
      description: "Termination watcher runtime config.",
    })
  )
) {}

/**
 * Runner OS; the fleet runs Linux runners only.
 *
 * **Example** (Linux)
 *
 * ```ts
 * import { RunnerOs } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * console.log(RunnerOs.is.linux("linux")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerOs = LiteralKit(["linux"]).pipe(
  $I.annoteSchema("RunnerOs", { description: "Runner OS; the fleet runs Linux runners only." })
);

/**
 * Runner-binaries syncer runtime config.
 *
 * **Example** (The fleet syncer)
 *
 * ```ts
 * import { SyncerRuntimeConfig } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * const config = SyncerRuntimeConfig.make({
 *   bucketName: "beep-ci-runner-binaries",
 *   objectKey: "actions-runner-linux.tar.gz",
 *   os: "linux",
 *   architecture: "x64",
 * })
 * console.log(config.objectKey)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncerRuntimeConfig extends S.Opaque<SyncerRuntimeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    bucketName: S.String,
    objectKey: S.String,
    os: RunnerOs,
    architecture: RunnerArchitecture,
  }).pipe(
    $I.annoteSchema("SyncerRuntimeConfig", {
      description: "Runner-binaries syncer runtime config.",
    })
  )
) {}
