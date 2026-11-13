/**
 * Runner pool configuration: what one pool of ephemeral EC2 runners launches,
 * which jobs it accepts and how it scales.
 *
 * Option names and defaults follow the `runners` module variables of
 * github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the package
 * README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AlchemyGithubRunnersId.create("RunnerPool.models");

/**
 * Where a runner registers: an organization or a single repository.
 *
 * **Example** (Check the registration scope)
 *
 * ```ts
 * import { RunnerType } from "@beep/alchemy-github-runners/RunnerPool.models"
 *
 * console.log(RunnerType.is.Org("Org")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerType = LiteralKit(["Org", "Repo"]).pipe(
  $I.annoteSchema("RunnerType", { description: "Where a runner registers: an organization or a repository." })
);

/**
 * Runtime type for {@link RunnerType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunnerType = typeof RunnerType.Type;

/**
 * EC2 capacity a pool launches.
 *
 * **Example** (Spot capacity)
 *
 * ```ts
 * import { CapacityType } from "@beep/alchemy-github-runners/RunnerPool.models"
 *
 * console.log(CapacityType.is.spot("spot")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CapacityType = LiteralKit(["spot", "on-demand"]).pipe(
  $I.annoteSchema("CapacityType", { description: "EC2 capacity a pool launches." })
);

/**
 * Runtime type for {@link CapacityType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CapacityType = typeof CapacityType.Type;

/**
 * `CreateFleet` allocation strategy, Spot and on-demand values together.
 *
 * **Details**
 *
 * Scale-up sanitizes the value against the capacity type: a Spot-only value
 * used for on-demand (or the reverse) falls back to `lowest-price`, as
 * upstream does.
 *
 * **Example** (The live fleet's strategy)
 *
 * ```ts
 * import { AllocationStrategy } from "@beep/alchemy-github-runners/RunnerPool.models"
 *
 * console.log(AllocationStrategy.is["capacity-optimized"]("capacity-optimized")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AllocationStrategy = LiteralKit([
  "lowest-price",
  "diversified",
  "capacity-optimized",
  "capacity-optimized-prioritized",
  "price-capacity-optimized",
  "prioritized",
]).pipe($I.annoteSchema("AllocationStrategy", { description: "CreateFleet allocation strategy." }));

/**
 * Runtime type for {@link AllocationStrategy}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AllocationStrategy = typeof AllocationStrategy.Type;

/**
 * How a job's labels must relate to a pool's labels for the pool to take it.
 *
 * **Details**
 *
 * `bidirectional`: the two label sets are equal (case-insensitive). `all`:
 * every job label is a pool label. `any`: at least one job label is a pool
 * label. A job with no labels matches only a pool that no `all`/`any` check
 * accepts, as upstream's `canRunJob` does.
 *
 * **Example** (The live fleet's mode)
 *
 * ```ts
 * import { LabelMatchMode } from "@beep/alchemy-github-runners/RunnerPool.models"
 *
 * console.log(LabelMatchMode.is.bidirectional("bidirectional")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LabelMatchMode = LiteralKit(["bidirectional", "all", "any"]).pipe(
  $I.annoteSchema("LabelMatchMode", { description: "How job labels must relate to pool labels." })
);

/**
 * Runtime type for {@link LabelMatchMode}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LabelMatchMode = typeof LabelMatchMode.Type;

/**
 * Order in which scale-down considers an owner's runners for removal.
 *
 * **Example** (Default strategy)
 *
 * ```ts
 * import { EvictionStrategy } from "@beep/alchemy-github-runners/RunnerPool.models"
 *
 * console.log(EvictionStrategy.is.oldest_first("oldest_first")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EvictionStrategy = LiteralKit(["oldest_first", "newest_first"]).pipe(
  $I.annoteSchema("EvictionStrategy", { description: "Order scale-down considers runners for removal." })
);

/**
 * Runtime type for {@link EvictionStrategy}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EvictionStrategy = typeof EvictionStrategy.Type;

/**
 * Runner CPU architecture; selects the `actions/runner` release asset.
 *
 * **Example** (x64 runners)
 *
 * ```ts
 * import { RunnerArchitecture } from "@beep/alchemy-github-runners/RunnerPool.models"
 *
 * console.log(RunnerArchitecture.is.x64("x64")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerArchitecture = LiteralKit(["x64", "arm64"]).pipe(
  $I.annoteSchema("RunnerArchitecture", { description: "Runner CPU architecture." })
);

/**
 * Runtime type for {@link RunnerArchitecture}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunnerArchitecture = typeof RunnerArchitecture.Type;

/**
 * Re-check policy for jobs scale-up could not serve right away.
 *
 * **Details**
 *
 * After scale-up handles a message it publishes a copy to the job-retry queue
 * with delay `delaySeconds * delayBackoff ^ retryCounter`, capped at 900 s
 * (the SQS maximum). The job-retry Lambda re-sends the job to the build queue
 * while GitHub still reports it queued, at most `maxAttempts` times. The live
 * fleet uses 2 attempts, 120 s, backoff 2.
 *
 * **Example** (The live fleet's policy)
 *
 * ```ts
 * import { JobRetryPolicy } from "@beep/alchemy-github-runners/RunnerPool.models"
 *
 * const policy = JobRetryPolicy.make({ maxAttempts: 2, delaySeconds: 120, delayBackoff: 2 })
 * console.log(policy.maxAttempts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JobRetryPolicy extends S.Opaque<JobRetryPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    maxAttempts: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    delaySeconds: S.Int.check(S.isBetween({ minimum: 0, maximum: 900 })),
    delayBackoff: S.Finite.check(S.isGreaterThanOrEqualTo(1)),
  }).pipe(
    $I.annoteSchema("JobRetryPolicy", {
      description: "Re-check policy for jobs scale-up could not serve right away.",
    })
  )
) {}

/**
 * One pool of identical ephemeral runners.
 *
 * **Details**
 *
 * `name` keys the pool's resources and its `ghr:environment` tag, so two pools
 * never count or remove each other's instances. `maximumCount` `-1` means no
 * cap. `labels` is the full label set the runner registers with and the set
 * the webhook matches jobs against. Defaults reproduce the live heavy pool:
 * Spot, `capacity-optimized`, no on-demand failover, bidirectional label
 * match, 5-minute minimum running time, ephemeral JIT runners.
 *
 * **Example** (The live shard-overflow pool)
 *
 * ```ts
 * import { RunnerPool } from "@beep/alchemy-github-runners/RunnerPool.models"
 *
 * const pool = RunnerPool.make({
 *   name: "overflow",
 *   instanceTypes: ["r7a.2xlarge", "r7i.2xlarge", "r6i.2xlarge"],
 *   maximumCount: 48,
 *   labels: ["beep-shard-overflow"],
 *   runnerGroup: "beep-shard-overflow",
 *   runnerNamePrefix: "beep-ovf-",
 * })
 * console.log(pool.capacityType) // "spot"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerPool extends S.Opaque<RunnerPool, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.check(S.isPattern(/^[a-z][a-z0-9-]{0,23}$/u)).annotateKey({
      description: "Pool name: resource ids, queue names and the ghr:environment suffix.",
    }),
    instanceTypes: S.NonEmptyArray(S.String).annotateKey({
      description: "Interchangeable instance types; every type is crossed with every subnet.",
    }),
    capacityType: CapacityType.pipe(
      S.withConstructorDefault(Effect.succeed<CapacityType>("spot")),
      S.withDecodingDefaultKey(Effect.succeed<CapacityType>("spot"))
    ),
    allocationStrategy: AllocationStrategy.pipe(
      S.withConstructorDefault(Effect.succeed<AllocationStrategy>("capacity-optimized")),
      S.withDecodingDefaultKey(Effect.succeed<AllocationStrategy>("capacity-optimized"))
    ),
    onDemandFailoverErrors: S.Array(S.String)
      .pipe(
        S.withConstructorDefault(Effect.succeed<ReadonlyArray<string>>([])),
        S.withDecodingDefaultKey(Effect.succeed<ReadonlyArray<string>>([]))
      )
      .annotateKey({ description: "CreateFleet error codes that trigger an on-demand launch of the shortfall." }),
    maximumCount: S.Int.check(S.isGreaterThanOrEqualTo(-1)).annotateKey({
      description: "VM cap per owner; -1 for no cap.",
    }),
    labels: S.NonEmptyArray(S.String).annotateKey({ description: "Labels the runner registers with." }),
    labelMatch: LabelMatchMode.pipe(
      S.withConstructorDefault(Effect.succeed<LabelMatchMode>("bidirectional")),
      S.withDecodingDefaultKey(Effect.succeed<LabelMatchMode>("bidirectional"))
    ),
    runnerGroup: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("Default")),
      S.withDecodingDefaultKey(Effect.succeed("Default"))
    ).annotateKey({ description: "Org runner group name." }),
    runnerNamePrefix: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ).annotateKey({ description: "Prefix of every runner name." }),
    minimumRunningTimeMinutes: S.Int.pipe(
      S.withConstructorDefault(Effect.succeed(5)),
      S.withDecodingDefaultKey(Effect.succeed(5))
    ),
    bootTimeMinutes: S.Int.pipe(
      S.withConstructorDefault(Effect.succeed(5)),
      S.withDecodingDefaultKey(Effect.succeed(5))
    ).annotateKey({
      description: "Minutes after launch before an unregistered instance counts as an orphan.",
    }),
    idleCount: S.Int.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ).annotateKey({ description: "Idle runners scale-down keeps per owner." }),
    evictionStrategy: EvictionStrategy.pipe(
      S.withConstructorDefault(Effect.succeed<EvictionStrategy>("oldest_first")),
      S.withDecodingDefaultKey(Effect.succeed<EvictionStrategy>("oldest_first"))
    ),
    ephemeral: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
    jitConfig: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
    jobQueuedCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ).annotateKey({
      description: "Ask GitHub whether the job is still queued before launching (the live fleet disables it).",
    }),
    jobRetry: S.OptionFromOptionalKey(JobRetryPolicy).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("RunnerPool", {
      description: "One pool of identical ephemeral runners.",
    })
  )
) {}
