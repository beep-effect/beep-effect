/**
 * The Test Unit shard overflow pool: its Pulumi switch and its controller configuration.
 *
 * **Details**
 *
 * The pool is a second `CiFleetController` beside the heavy one, built from
 * {@link ciShardOverflowRunnerPool}. It is created only when the stack config
 * `ciShardOverflow:enabled` is `true`; absent or `false`, the program declares
 * no overflow resource, so merging this code changes nothing in AWS.
 *
 * The overflow controller reuses the fleet's GitHub App id and private key
 * (the scale-up Lambda resolves the App's organization installation when a
 * delivery carries none) and verifies deliveries with its own webhook secret,
 * which a repository webhook for `workflow_job` events signs. Its runners
 * register in the `beep-shard-overflow` organization runner group, which
 * admits only `shard-overflow.yml` at `refs/heads/main`.
 *
 * {@link makeCiShardOverflowControllerConfig} refuses, and the Pulumi program
 * stops before declaring the pool, when the worst-case Spot vCPU of the
 * overflow pool plus the heavy pool at its burst cap would exceed the
 * account's 512-vCPU quota.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import { O } from "@beep/utils";
import * as pulumi from "@pulumi/pulumi";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CiFleetController, CiFleetControllerConfig } from "./CiFleetController.ts";
import {
  ciHeavyRunnerBurstCap,
  ciShardOverflowRunnerLabel,
  ciShardOverflowRunnerPool,
  ciSpotVcpuBudget,
} from "./CiRunnerPool.ts";

const $I = $InfraId.create("CiShardOverflowPool");

/**
 * Why the overflow controller cannot be configured.
 *
 * **Example** (Describe a refused budget)
 *
 * ```ts
 * import { CiShardOverflowPoolConfigError } from "@beep/infra"
 *
 * const error = CiShardOverflowPoolConfigError.make({ message: "over the Spot quota" })
 * console.log(error._tag) // "CiShardOverflowPoolConfigError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CiShardOverflowPoolConfigError extends S.TaggedError<
  CiShardOverflowPoolConfigError,
  { readonly brand: unique symbol }
>($I`CiShardOverflowPoolConfigError`)(
  "CiShardOverflowPoolConfigError",
  { message: S.String },
  $I.annoteError<CiShardOverflowPoolConfigError>("CiShardOverflowPoolConfigError", {
    description: "The shard overflow pool's configuration is incomplete or over the Spot vCPU quota.",
  })
) {}

const SsmParameterArn = S.String.check(S.isPattern(/^arn:aws[a-z-]*:ssm:[a-z0-9-]+:[0-9]*:parameter\/.+$/u));

/**
 * The overflow pool's stack configuration.
 *
 * **Details**
 *
 * `enabled` is `ciShardOverflow:enabled` (default `false`).
 * `githubAppWebhookSecretSsmParameterArn` is the SecureString the repository
 * webhook signs with; it is required once the pool is enabled. `heavyBurstCap`
 * is the largest heavy-pool cap the Spot budget must still fit (default 8).
 *
 * **Example** (A disabled pool)
 *
 * ```ts
 * import { CiShardOverflowPoolConfig } from "@beep/infra"
 * import * as O from "effect/Option"
 *
 * const config = CiShardOverflowPoolConfig.make({ enabled: false, githubAppWebhookSecretSsmParameterArn: O.none() })
 * console.log(config.heavyBurstCap) // 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiShardOverflowPoolConfig extends S.Opaque<CiShardOverflowPoolConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    enabled: S.Boolean,
    githubAppWebhookSecretSsmParameterArn: S.Option(SsmParameterArn),
    heavyBurstCap: S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(
      S.withConstructorDefault(Effect.succeed(ciHeavyRunnerBurstCap))
    ),
  }).pipe(
    $I.annoteSchema("CiShardOverflowPoolConfig", {
      description: "Switch, webhook secret parameter and assumed heavy burst cap of the shard overflow pool.",
    })
  )
) {}

/**
 * Load `ciShardOverflow:*` from the Pulumi stack config.
 *
 * **Example** (Read the switch inside a Pulumi program)
 *
 * ```ts
 * import { loadCiShardOverflowPoolConfig } from "@beep/infra"
 *
 * const overflow = loadCiShardOverflowPoolConfig()
 * console.log(overflow.enabled)
 * ```
 *
 * @returns The overflow pool's configuration.
 * @category constructors
 * @since 0.0.0
 */
export const loadCiShardOverflowPoolConfig = (): CiShardOverflowPoolConfig => {
  const config = new pulumi.Config("ciShardOverflow");
  return CiShardOverflowPoolConfig.make({
    enabled: config.getBoolean("enabled") ?? false,
    githubAppWebhookSecretSsmParameterArn: O.fromUndefinedOr(config.get("githubAppWebhookSecretSsmParameterArn")),
    ...O.getSomesStruct({ heavyBurstCap: O.fromUndefinedOr(config.getNumber("heavyBurstCap")) }),
  });
};

/**
 * The overflow controller's configuration, derived from the heavy controller's.
 *
 * **Details**
 *
 * Every value but the runner label and the webhook secret is the heavy
 * controller's: the same App credentials, KMS key, permissions boundary, AMI
 * and Lambda artifacts. Fails when the pool is enabled without a webhook
 * secret parameter, or when the worst-case Spot vCPU (48 overflow VMs at 8
 * vCPU plus the heavy pool's burst cap at 16) exceeds the quota.
 *
 * **Example** (Refuse a budget over the quota)
 *
 * ```ts
 * import {
 *   CiFleetControllerPulumiConfigValues,
 *   CiShardOverflowPoolConfig,
 *   makeCiFleetControllerConfig,
 *   makeCiShardOverflowControllerConfig,
 * } from "@beep/infra"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const heavy = makeCiFleetControllerConfig(
 *   CiFleetControllerPulumiConfigValues.make({
 *     githubAppIdSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/id",
 *     githubAppKeyBase64SsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/key",
 *     githubAppKmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
 *     githubAppWebhookSecretSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/webhook-secret",
 *     runnerBinariesSyncerLambdaZip: "/artifacts/runner-binaries-syncer.zip",
 *     runnerRolePermissionsBoundaryArn: "arn:aws:iam::123456789012:policy/beep-ci-fleet-boundary",
 *     runnersLambdaZip: "/artifacts/runners.zip",
 *     terminationWatcherLambdaZip: "/artifacts/termination-watcher.zip",
 *     webhookLambdaZip: "/artifacts/webhook.zip",
 *   })
 * )
 * const overflow = CiShardOverflowPoolConfig.make({
 *   enabled: true,
 *   githubAppWebhookSecretSsmParameterArn: O.some("arn:aws:ssm:us-east-1:123456789012:parameter/overflow/secret"),
 *   heavyBurstCap: 9,
 * })
 * // 48 x 8 + 9 x 16 = 528 vCPU, over the 512-vCPU quota.
 * console.log(Result.isFailure(makeCiShardOverflowControllerConfig(heavy, overflow))) // true
 * ```
 *
 * @param heavy - The heavy controller's configuration.
 * @param overflow - The overflow pool's stack configuration.
 * @returns The overflow controller's configuration, or why it cannot be built.
 * @category constructors
 * @since 0.0.0
 */
export const makeCiShardOverflowControllerConfig: {
  (
    overflow: CiShardOverflowPoolConfig
  ): (heavy: CiFleetControllerConfig) => Result.Result<CiFleetControllerConfig, CiShardOverflowPoolConfigError>;
  (
    heavy: CiFleetControllerConfig,
    overflow: CiShardOverflowPoolConfig
  ): Result.Result<CiFleetControllerConfig, CiShardOverflowPoolConfigError>;
} = dual(
  2,
  (
    heavy: CiFleetControllerConfig,
    overflow: CiShardOverflowPoolConfig
  ): Result.Result<CiFleetControllerConfig, CiShardOverflowPoolConfigError> => {
    const budget = ciSpotVcpuBudget({
      heavyBurstCap: overflow.heavyBurstCap,
      overflowCap: ciShardOverflowRunnerPool.maximumCount,
    });
    if (!budget.fits) {
      return Result.fail(
        CiShardOverflowPoolConfigError.make({
          message: `ciShardOverflow: ${budget.overflowVcpu} overflow vCPU plus ${budget.heavyVcpu} heavy vCPU at a burst cap of ${overflow.heavyBurstCap} is ${budget.totalVcpu}, over the ${budget.quotaVcpu}-vCPU Spot quota`,
        })
      );
    }
    return O.match(overflow.githubAppWebhookSecretSsmParameterArn, {
      onNone: () =>
        Result.fail(
          CiShardOverflowPoolConfigError.make({
            message: "ciShardOverflow:githubAppWebhookSecretSsmParameterArn is required when the pool is enabled",
          })
        ),
      onSome: (webhookSecret) =>
        Result.succeed(
          CiFleetControllerConfig.make({
            ...heavy,
            githubAppWebhookSecretSsmParameterArn: webhookSecret,
            runnerLabel: ciShardOverflowRunnerLabel,
          })
        ),
    });
  }
);

/**
 * The network a fleet controller attaches to: the region, subnets, VPC and worker security group the heavy
 * controller already uses.
 *
 * @category models
 * @since 0.0.0
 */
export type CiFleetNetwork = Omit<ConstructorParameters<typeof CiFleetController>[1], "config" | "pool">;

/**
 * Declare the overflow controller when the stack enables the pool, and nothing otherwise.
 *
 * **Details**
 *
 * The controller is named `ci-shard-overflow-controller` and attaches to the heavy controller's network.
 * A configuration that {@link makeCiShardOverflowControllerConfig} refuses stops the Pulumi program with
 * its {@link CiShardOverflowPoolConfigError} before any overflow resource is declared.
 *
 * **Example** (A disabled pool declares nothing)
 *
 * ```ts
 * import { CiShardOverflowPoolConfig, declareCiShardOverflowController } from "@beep/infra"
 * import * as O from "effect/Option"
 *
 * // Inside a Pulumi program, with `heavy` the heavy controller's configuration:
 * // declareCiShardOverflowController({ heavy, overflow, network }) is `None` while `enabled` is false.
 * console.log(CiShardOverflowPoolConfig.make({ enabled: false, githubAppWebhookSecretSsmParameterArn: O.none() }).enabled)
 * ```
 *
 * @param pool - The heavy controller's configuration, the overflow pool's stack configuration and the network.
 * @returns The overflow controller, or `None` while the pool is disabled.
 * @category constructors
 * @since 0.0.0
 */
export const declareCiShardOverflowController = (pool: {
  readonly heavy: CiFleetControllerConfig;
  readonly overflow: CiShardOverflowPoolConfig;
  readonly network: CiFleetNetwork;
}): O.Option<CiFleetController> =>
  pool.overflow.enabled
    ? O.some(
        new CiFleetController("ci-shard-overflow-controller", {
          config: Result.getOrThrow(makeCiShardOverflowControllerConfig(pool.heavy, pool.overflow)),
          pool: ciShardOverflowRunnerPool,
          ...pool.network,
        })
      )
    : O.none();

/**
 * The overflow controller's webhook output, for the stack output the repository webhook reads.
 *
 * **Example** (No controller, no output)
 *
 * ```ts
 * import { ciShardOverflowWebhook } from "@beep/infra"
 * import * as O from "effect/Option"
 *
 * console.log(ciShardOverflowWebhook(O.none())) // undefined
 * ```
 *
 * @param controller - The overflow controller, if the pool is enabled.
 * @returns Its webhook output, or `undefined` while the pool is disabled.
 * @category getters
 * @since 0.0.0
 */
export const ciShardOverflowWebhook = (controller: O.Option<CiFleetController>): pulumi.Output<unknown> | undefined =>
  O.getOrUndefined(O.map(controller, (overflow) => overflow.webhook));
