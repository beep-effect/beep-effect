/**
 * Schemas for rebalancing the hosted Test Unit partitions from measured green-main timings.
 *
 * **Details**
 *
 * Two kinds of Test Unit partition exist. A *sharded* partition runs one Vitest `--shard` slice
 * of a single package; its assignment is a committed `vitest.shards.json` plan the package's
 * sequencer applies, and its weight is that shard's planned file time. A *bin* partition runs
 * whole packages two at a time; its weight is the serial sum of its packages' measured walls.
 * `beep ci partitions rebalance` recomputes both from one green `main` run and judges them
 * against the budgets below, which encode the operator's ten-minute job target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { CiLanePartitionId } from "./CiLanePartitions.ts";

const $I = $RepoCliId.create("commands/Ci/CiPartitions.schemas");

/**
 * File-time budget of one sharded Test Unit partition, in seconds.
 *
 * **Details**
 *
 * Hosted coverage producers run one worker, so a shard's wall is its file-time sum plus about
 * 110 s of job overhead (checkout, install, discovery, artifact upload; law-practice-1..3 on run
 * 42554761567 measured 101-120 s). 480 s of file time keeps a shard under the ten-minute target.
 *
 * **Example** (Judge a shard estimate)
 *
 * ```ts
 * import { CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(388 <= CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS = 480;

/**
 * Serial package-wall budget of one Test Unit bin, in seconds.
 *
 * **Details**
 *
 * A bin runs its packages two at a time, so its body is about half the serial sum stretched by
 * imperfect packing (run 42554761567: unit-c summed 1,175 s and its body took 662 s), on top of
 * about 180 s of setup, prerequisite builds and artifact upload. 720 s of serial sum keeps the
 * job under ten minutes.
 *
 * **Example** (Judge a bin weight)
 *
 * ```ts
 * import { CI_UNIT_BIN_SERIAL_BUDGET_SECONDS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(596 <= CI_UNIT_BIN_SERIAL_BUDGET_SECONDS) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_UNIT_BIN_SERIAL_BUDGET_SECONDS = 720;

/**
 * Measured wall from which a Test Unit bin package is listed in its bin's `startFirst`, in seconds.
 *
 * **Details**
 *
 * A bin starts its `startFirst` packages before the rest, heaviest first, so none of them runs
 * alone at the end of the two-at-a-time schedule. Below 30 s the order no longer moves a body by
 * more than a package's own start-up, and a short list keeps the table readable.
 *
 * **Example** (Decide whether a package leads its bin)
 *
 * ```ts
 * import { CI_UNIT_BIN_START_FIRST_SECONDS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(309 >= CI_UNIT_BIN_START_FIRST_SECONDS) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_UNIT_BIN_START_FIRST_SECONDS = 30;

const FileMilliseconds = S.Record(S.String, S.Finite);
const ShardFiles = S.Array(S.String);

/**
 * A package's committed Vitest shard plan, read and written as `vitest.shards.json`.
 *
 * **Details**
 *
 * `shards[i]` holds the package-relative test files hosted shard `i + 1` runs and
 * `estimatedMilliseconds[i]` their measured file time. `fileMilliseconds` keeps the per-file
 * measurements the plan was packed from so `--check` can re-add the bins offline. The sequencer in the
 * root `vitest.shared.ts` reads `shards` only.
 *
 * **Example** (Describe a two-shard plan)
 *
 * ```ts
 * import { VitestShardPlan } from "@beep/repo-cli/commands/Ci"
 *
 * const plan = VitestShardPlan.make({
 *   sourceRun: 42554761567,
 *   sourceCommit: "b80e11050714191c6d0ff58e8371e9d4c3f17880",
 *   estimatedMilliseconds: [1200, 800],
 *   shards: [["test/a.test.ts"], ["test/b.test.ts"]],
 *   fileMilliseconds: { "test/a.test.ts": 1200, "test/b.test.ts": 800 },
 * })
 * console.log(plan.shards.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VitestShardPlan extends S.Opaque<VitestShardPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceRun: S.Finite,
    sourceCommit: S.String,
    estimatedMilliseconds: S.Array(S.Finite),
    shards: S.Array(ShardFiles),
    fileMilliseconds: S.optionalKey(FileMilliseconds),
  })
    .check(
      S.makeFilter(
        (plan: { readonly estimatedMilliseconds: ReadonlyArray<number>; readonly shards: ReadonlyArray<unknown> }) =>
          plan.estimatedMilliseconds.length === plan.shards.length,
        $I.annote("VitestShardPlanEstimateLengthCheck", {
          title: "Vitest Shard Plan Estimate Length",
          description: "Checks that every shard carries exactly one estimate.",
          message: "estimatedMilliseconds must have one entry per shard.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("VitestShardPlan", {
        description: "Committed LPT assignment of a package's test files to its hosted Vitest shards.",
      })
    )
) {}

/**
 * Stable names of the two sharded Test Unit families.
 *
 * **Example** (Recognize a family)
 *
 * ```ts
 * import { CiShardedPartitionFamily } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiShardedPartitionFamily.is["repo-cli"]("repo-cli")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiShardedPartitionFamily = LiteralKit(["repo-cli", "law-practice"]).pipe(
  $I.annoteSchema("CiShardedPartitionFamily", {
    description: "Partition id prefix of one sharded Test Unit package.",
  })
);

/**
 * Stable name of one sharded Test Unit family.
 *
 * **Example** (Type a family)
 *
 * ```ts
 * import type { CiShardedPartitionFamily } from "@beep/repo-cli/commands/Ci"
 *
 * const family: CiShardedPartitionFamily = "law-practice"
 * console.log(family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiShardedPartitionFamily = typeof CiShardedPartitionFamily.Type;

/**
 * Where one sharded family's package and committed plan live.
 *
 * **Example** (Describe the repo-cli family)
 *
 * ```ts
 * import { CiShardedPartitionSource } from "@beep/repo-cli/commands/Ci"
 *
 * const source = CiShardedPartitionSource.make({
 *   family: "repo-cli",
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   planPath: "packages/tooling/tool/cli/vitest.shards.json",
 * })
 * console.log(source.planPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiShardedPartitionSource extends S.Opaque<CiShardedPartitionSource, { readonly brand: unique symbol }>()(
  S.Struct({
    family: CiShardedPartitionFamily,
    packageName: S.String,
    packagePath: S.String,
    planPath: S.String,
  }).pipe(
    $I.annoteSchema("CiShardedPartitionSource", {
      description: "Package and committed shard-plan path of one sharded Test Unit family.",
    })
  )
) {}

/**
 * The sharded Test Unit families and their committed plan files.
 *
 * **Example** (List the plan files)
 *
 * ```ts
 * import { CI_SHARDED_PARTITION_SOURCES } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * console.log(A.map(CI_SHARDED_PARTITION_SOURCES, (source) => source.planPath))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_SHARDED_PARTITION_SOURCES: ReadonlyArray<CiShardedPartitionSource> = [
  CiShardedPartitionSource.make({
    family: "repo-cli",
    packageName: "@beep/repo-cli",
    packagePath: "packages/tooling/tool/cli",
    planPath: "packages/tooling/tool/cli/vitest.shards.json",
  }),
  CiShardedPartitionSource.make({
    family: "law-practice",
    packageName: "@beep/law-practice-server",
    packagePath: "packages/law-practice/server",
    planPath: "packages/law-practice/server/vitest.shards.json",
  }),
];

/**
 * One test file's measured duration inside a hosted Test Unit shard.
 *
 * **Example** (Record a file timing)
 *
 * ```ts
 * import { CiPartitionFileTiming } from "@beep/repo-cli/commands/Ci"
 *
 * const timing = CiPartitionFileTiming.make({
 *   partitionId: "repo-cli-4",
 *   file: "test/coverage-artifacts.test.ts",
 *   milliseconds: 234039,
 * })
 * console.log(timing.milliseconds)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiPartitionFileTiming extends S.Opaque<CiPartitionFileTiming, { readonly brand: unique symbol }>()(
  S.Struct({
    partitionId: CiLanePartitionId,
    file: S.String,
    milliseconds: S.Finite,
  }).pipe(
    $I.annoteSchema("CiPartitionFileTiming", {
      description: "Measured duration of one test file in one hosted Test Unit shard.",
    })
  )
) {}

/**
 * One package's measured Vitest wall inside a hosted Test Unit bin.
 *
 * **Example** (Record a package timing)
 *
 * ```ts
 * import { CiPartitionPackageTiming } from "@beep/repo-cli/commands/Ci"
 *
 * const timing = CiPartitionPackageTiming.make({
 *   partitionId: "unit-c",
 *   packagePath: "packages/law-practice/domain",
 *   seconds: 252.72,
 * })
 * console.log(timing.seconds)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiPartitionPackageTiming extends S.Opaque<CiPartitionPackageTiming, { readonly brand: unique symbol }>()(
  S.Struct({
    partitionId: CiLanePartitionId,
    packagePath: S.String,
    seconds: S.Finite,
  }).pipe(
    $I.annoteSchema("CiPartitionPackageTiming", {
      description: "Measured Vitest wall of one package in one hosted Test Unit bin.",
    })
  )
) {}

/**
 * Every Test Unit measurement collected from one green hosted run.
 *
 * **Example** (Describe an empty collection)
 *
 * ```ts
 * import { CiPartitionRunTimings } from "@beep/repo-cli/commands/Ci"
 *
 * const timings = CiPartitionRunTimings.make({ runId: 1, headSha: "abc", files: [], packages: [] })
 * console.log(timings.files.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiPartitionRunTimings extends S.Opaque<CiPartitionRunTimings, { readonly brand: unique symbol }>()(
  S.Struct({
    runId: S.Finite,
    headSha: S.String,
    files: S.Array(CiPartitionFileTiming),
    packages: S.Array(CiPartitionPackageTiming),
  }).pipe(
    $I.annoteSchema("CiPartitionRunTimings", {
      description: "Per-file and per-package Test Unit measurements of one green hosted run.",
    })
  )
) {}

/**
 * File and package timings read from one hosted Test Unit job log.
 *
 * **Example** (An empty parse)
 *
 * ```ts
 * import { ParsedHostedTestUnitLog } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ParsedHostedTestUnitLog.make({ files: [], packages: [] }).files.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParsedHostedTestUnitLog extends S.Opaque<ParsedHostedTestUnitLog, { readonly brand: unique symbol }>()(
  S.Struct({
    files: S.Array(CiPartitionFileTiming),
    packages: S.Array(CiPartitionPackageTiming),
  }).pipe(
    $I.annoteSchema("ParsedHostedTestUnitLog", {
      description: "File and package timings parsed from one hosted Test Unit job log.",
    })
  )
) {}

/**
 * Inputs of a shard-plan build: measured timings, the table's shard count and the run's provenance.
 *
 * **Example** (Describe a two-shard build)
 *
 * ```ts
 * import { BuildVitestShardPlanOptions } from "@beep/repo-cli/commands/Ci"
 *
 * const options = BuildVitestShardPlanOptions.make({
 *   files: [],
 *   total: 2,
 *   sourceRun: 42554761567,
 *   sourceCommit: "b80e11050714191c6d0ff58e8371e9d4c3f17880",
 * })
 * console.log(options.total) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildVitestShardPlanOptions extends S.Opaque<
  BuildVitestShardPlanOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    files: S.Array(CiPartitionFileTiming),
    total: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    sourceRun: S.Finite,
    sourceCommit: S.String,
  }).pipe(
    $I.annoteSchema("BuildVitestShardPlanOptions", {
      description: "Measured file timings, target shard count and run provenance of one shard-plan build.",
    })
  )
) {}

/**
 * How one partition stands against its budget and the committed table.
 *
 * **Details**
 *
 * `within` passes. `over` exceeds its budget. `stale-weight` means the table's `weightSeconds`
 * no longer matches the committed plan's estimate. `stale-plan` means the committed plan has a
 * different shard count than the table.
 *
 * **Example** (Recognize a passing status)
 *
 * ```ts
 * import { CiPartitionBudgetStatus } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiPartitionBudgetStatus.is.within("within")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiPartitionBudgetStatus = LiteralKit(["within", "over", "stale-weight", "stale-plan"]).pipe(
  $I.annoteSchema("CiPartitionBudgetStatus", {
    description: "Budget verdict of one hosted Test Unit partition.",
  })
);

/**
 * Budget verdict of one hosted Test Unit partition.
 *
 * **Example** (Type a verdict)
 *
 * ```ts
 * import type { CiPartitionBudgetStatus } from "@beep/repo-cli/commands/Ci"
 *
 * const status: CiPartitionBudgetStatus = "within"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiPartitionBudgetStatus = typeof CiPartitionBudgetStatus.Type;

/**
 * One partition's row in a rebalance report.
 *
 * **Example** (Build a passing row)
 *
 * ```ts
 * import { CiPartitionBudgetRow } from "@beep/repo-cli/commands/Ci"
 *
 * const row = CiPartitionBudgetRow.make({
 *   partitionId: "law-practice-1",
 *   estimatedSeconds: 388.3,
 *   weightSeconds: 388,
 *   budgetSeconds: 480,
 *   status: "within",
 * })
 * console.log(row.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiPartitionBudgetRow extends S.Opaque<CiPartitionBudgetRow, { readonly brand: unique symbol }>()(
  S.Struct({
    partitionId: CiLanePartitionId,
    estimatedSeconds: S.Finite,
    weightSeconds: S.Finite,
    budgetSeconds: S.Finite,
    status: CiPartitionBudgetStatus,
  }).pipe(
    $I.annoteSchema("CiPartitionBudgetRow", {
      description: "Estimate, table weight, budget and verdict of one hosted Test Unit partition.",
    })
  )
) {}

/**
 * The outcome of a rebalance check: one row per Test Unit partition plus advisory warnings.
 *
 * **Example** (Describe an empty report)
 *
 * ```ts
 * import { CiPartitionRebalanceReport } from "@beep/repo-cli/commands/Ci"
 *
 * const report = CiPartitionRebalanceReport.make({ rows: [], warnings: [] })
 * console.log(report.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiPartitionRebalanceReport extends S.Opaque<
  CiPartitionRebalanceReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    rows: S.Array(CiPartitionBudgetRow),
    warnings: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("CiPartitionRebalanceReport", {
      description: "Budget rows and advisory warnings of one Test Unit partition check.",
    })
  )
) {}
