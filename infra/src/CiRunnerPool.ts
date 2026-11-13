/**
 * Runner pool profiles for the ephemeral EC2 fleet: the heavy-lane pool and the
 * Test Unit shard overflow pool, and the Spot vCPU budget they share.
 *
 * **Details**
 *
 * Both pools are instances of `CiFleetController` (one terraform-module
 * controller each) with identical rails: organization registration in one
 * named runner group, exact label match, ephemeral one-job-one-VM runners on
 * Spot `capacity-optimized` with no On-Demand fallback, the IMDS workload
 * boundary in post-install, the per-job IMDS hook and the self-poweroff
 * teardown. A profile carries only what differs between them: the resource
 * prefix, the runner group, the runner name prefix, the instance types, the VM
 * cap and the name of the webhook secret parameter.
 *
 * The heavy profile reproduces the controller's former literals exactly, so
 * the heavy pool's inputs do not change. The overflow profile is the operator
 * decision of 2026-11-13 (goals/ci-lane-economics): at most 48 VMs of the
 * 8-vCPU `.2xlarge` types only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $InfraId.create("CiRunnerPool");

/**
 * The instance types the fleet may launch: 64 GiB x86_64 shapes, 8 or 16 vCPU.
 *
 * **Example** (Check an instance type)
 *
 * ```ts
 * import { CiRunnerInstanceType } from "@beep/infra"
 *
 * console.log(CiRunnerInstanceType.is["r7a.2xlarge"]("r7a.2xlarge")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiRunnerInstanceType = LiteralKit([
  "r7a.2xlarge",
  "r7i.2xlarge",
  "r6i.2xlarge",
  "m7a.4xlarge",
  "m7i.4xlarge",
  "m6a.4xlarge",
  "m6i.4xlarge",
]).pipe(
  $I.annoteSchema("CiRunnerInstanceType", {
    description: "A 64 GiB x86_64 EC2 instance type the CI fleet may launch.",
  })
);

/**
 * A 64 GiB x86_64 EC2 instance type the CI fleet may launch.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiRunnerInstanceType = typeof CiRunnerInstanceType.Type;

/**
 * vCPUs of each fleet instance type: the unit the Spot quota counts.
 *
 * **Example** (Read a type's vCPUs)
 *
 * ```ts
 * import { ciRunnerInstanceVcpus } from "@beep/infra"
 *
 * console.log(ciRunnerInstanceVcpus["m7i.4xlarge"]) // 16
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciRunnerInstanceVcpus: { readonly [Type in CiRunnerInstanceType]: number } = {
  "r7a.2xlarge": 8,
  "r7i.2xlarge": 8,
  "r6i.2xlarge": 8,
  "m7a.4xlarge": 16,
  "m7i.4xlarge": 16,
  "m6a.4xlarge": 16,
  "m6i.4xlarge": 16,
};

/**
 * What distinguishes one fleet pool from another.
 *
 * **Details**
 *
 * `prefix` names every module resource (Lambdas `<prefix>-scale-up`,
 * `<prefix>-spot-termination-*`, queues, roles) and the controller's own AMI
 * parameter and IMDS policy. `runnerGroupName` is the organization runner group
 * the runners register in, which decides which workflows may use them.
 * `maximumCount` is the module's `runners_maximum_count`.
 * `webhookSecretSsmParameterName` is the externally managed secret the pool's
 * webhook verifies deliveries with.
 *
 * **Example** (Read the overflow pool's cap)
 *
 * ```ts
 * import { ciShardOverflowRunnerPool } from "@beep/infra"
 *
 * console.log(ciShardOverflowRunnerPool.maximumCount) // 48
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunnerPool extends S.Opaque<CiRunnerPool, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: S.String.check(S.isPattern(/^[a-z][a-z0-9-]{1,30}$/u)),
    runnerGroupName: S.String.check(S.isPattern(/^[A-Za-z0-9_-]{1,64}$/u)),
    runnerNamePrefix: S.String.check(S.isPattern(/^beep-[a-z0-9-]{1,20}$/u)),
    instanceTypes: S.NonEmptyArray(CiRunnerInstanceType),
    maximumCount: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    webhookSecretSsmParameterName: S.String.check(S.isPattern(/^\/[A-Za-z0-9_./-]+$/u)),
  }).pipe(
    $I.annoteSchema("CiRunnerPool", {
      description: "Prefix, runner group, runner name prefix, instance types, VM cap and webhook secret of one pool.",
    })
  )
) {}

/**
 * The heavy-lane pool (`beep-ec2-heavy`): the controller's values before pools existed.
 *
 * **Details**
 *
 * Seven interchangeable 64 GiB shapes, cap 2 (the September 15 cost policy;
 * bursts raise it as a live Lambda edit, never here).
 *
 * **Example** (Read the heavy pool's cap)
 *
 * ```ts
 * import { ciHeavyRunnerPool } from "@beep/infra"
 *
 * console.log(ciHeavyRunnerPool.maximumCount) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciHeavyRunnerPool = CiRunnerPool.make({
  prefix: "beep-ci",
  runnerGroupName: "beep-ec2-heavy",
  runnerNamePrefix: "beep-ci-",
  instanceTypes: [
    "r7a.2xlarge",
    "r7i.2xlarge",
    "r6i.2xlarge",
    "m7a.4xlarge",
    "m7i.4xlarge",
    "m6a.4xlarge",
    "m6i.4xlarge",
  ],
  maximumCount: 2,
  webhookSecretSsmParameterName: "/github-action-runners/app/github_app_webhook_secret",
});

/**
 * The runner label of the shard overflow pool.
 *
 * **Example** (Print the overflow label)
 *
 * ```ts
 * import { ciShardOverflowRunnerLabel } from "@beep/infra"
 *
 * console.log(ciShardOverflowRunnerLabel) // "beep-shard-overflow"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciShardOverflowRunnerLabel = "beep-shard-overflow";

/**
 * The Test Unit shard overflow pool (`beep-shard-overflow`).
 *
 * **Details**
 *
 * At most 48 VMs of the 8-vCPU `.2xlarge` types only, 384 vCPU. Runner names
 * start `beep-ovf-`, which the setup action's `beep-` test still recognises as
 * an owned runner, and which keeps overflow jobs apart from heavy ones in the
 * Actions jobs API.
 *
 * **Example** (List the overflow instance types)
 *
 * ```ts
 * import { ciShardOverflowRunnerPool } from "@beep/infra"
 *
 * console.log(ciShardOverflowRunnerPool.instanceTypes) // ["r7a.2xlarge", "r7i.2xlarge", "r6i.2xlarge"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciShardOverflowRunnerPool = CiRunnerPool.make({
  prefix: "beep-ci-ovf",
  runnerGroupName: "beep-shard-overflow",
  runnerNamePrefix: "beep-ovf-",
  instanceTypes: ["r7a.2xlarge", "r7i.2xlarge", "r6i.2xlarge"],
  maximumCount: 48,
  webhookSecretSsmParameterName: "/github-action-runners/shard-overflow/github_app_webhook_secret",
});

/**
 * The account's standard Spot quota in us-east-1, in vCPU (quota L-34B43A08).
 *
 * **Example** (Print the quota)
 *
 * ```ts
 * import { ciSpotVcpuQuota } from "@beep/infra"
 *
 * console.log(ciSpotVcpuQuota) // 512
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciSpotVcpuQuota = 512;

/**
 * The heavy pool's largest burst cap the overflow budget assumes.
 *
 * **Details**
 *
 * Bursts have raised the heavy cap to 8 (2026-09-16, 2026-10-06). While the
 * overflow pool is enabled the operator keeps every heavy burst at or under
 * this cap, or lowers the overflow cap so {@link ciSpotVcpuBudget} still fits.
 *
 * **Example** (Print the assumed burst cap)
 *
 * ```ts
 * import { ciHeavyRunnerBurstCap } from "@beep/infra"
 *
 * console.log(ciHeavyRunnerBurstCap) // 8
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciHeavyRunnerBurstCap = 8;

/**
 * The most vCPU a pool can hold at a VM cap: every VM of its largest type.
 *
 * **Example** (The overflow pool's worst case)
 *
 * ```ts
 * import { ciRunnerPoolWorstCaseVcpu, ciShardOverflowRunnerPool } from "@beep/infra"
 *
 * console.log(ciRunnerPoolWorstCaseVcpu(ciShardOverflowRunnerPool, 48)) // 384
 * ```
 *
 * @param pool - The pool.
 * @param cap - The VM cap to evaluate, the pool's own unless a burst raises it.
 * @returns The worst-case vCPU.
 * @category utilities
 * @since 0.0.0
 */
export const ciRunnerPoolWorstCaseVcpu: {
  (cap: number): (pool: CiRunnerPool) => number;
  (pool: CiRunnerPool, cap: number): number;
} = dual(
  2,
  (pool: CiRunnerPool, cap: number): number =>
    cap * Math.max(...A.map(pool.instanceTypes, (type) => ciRunnerInstanceVcpus[type]))
);

/**
 * The worst-case Spot vCPU of the overflow pool plus the heavy pool at its burst cap.
 *
 * **Example** (The decided budget)
 *
 * ```ts
 * import { ciSpotVcpuBudget } from "@beep/infra"
 *
 * const budget = ciSpotVcpuBudget({ heavyBurstCap: 8, overflowCap: 48 })
 * console.log(budget.totalVcpu, budget.fits) // 512 true
 * ```
 *
 * @param caps - The heavy burst cap and the overflow VM cap.
 * @returns Each pool's worst case, their sum, the quota, and whether the sum fits.
 * @category utilities
 * @since 0.0.0
 */
export const ciSpotVcpuBudget = (caps: { readonly heavyBurstCap: number; readonly overflowCap: number }) => {
  const heavyVcpu = ciRunnerPoolWorstCaseVcpu(ciHeavyRunnerPool, caps.heavyBurstCap);
  const overflowVcpu = ciRunnerPoolWorstCaseVcpu(ciShardOverflowRunnerPool, caps.overflowCap);
  const totalVcpu = heavyVcpu + overflowVcpu;
  return { heavyVcpu, overflowVcpu, totalVcpu, quotaVcpu: ciSpotVcpuQuota, fits: totalVcpu <= ciSpotVcpuQuota };
};
