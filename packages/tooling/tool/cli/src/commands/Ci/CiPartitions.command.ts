/**
 * `beep ci partitions rebalance`: keep the hosted Test Unit partitions honest against measured timings.
 *
 * **Details**
 *
 * `--check` (the default) reads the committed `vitest.shards.json` plans and the partition table
 * offline and fails when a sharded partition's planned file time or a bin's serial weight exceeds
 * its budget, when a table weight no longer matches its plan, or when a plan's shard count differs
 * from the table. `--write --run <id>` reads one green `main` run's Test Unit job logs, repacks
 * every sharded family by LPT into the table's shard count, rewrites the plan files, and prints
 * the bin repack the table should adopt. The table itself stays hand-curated: ids and the
 * `check.yml` matrix change together, so the command reports what to paste rather than editing
 * TypeScript.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import { runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";
import { CI_LANE_PARTITIONS } from "./CiLanePartitions.ts";
import {
  BuildVitestShardPlanOptions,
  CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS,
  CI_SHARDED_PARTITION_SOURCES,
  CI_UNIT_BIN_SERIAL_BUDGET_SECONDS,
  CiPartitionBudgetRow,
  CiPartitionRebalanceReport,
  VitestShardPlan,
} from "./CiPartitions.schemas.ts";
import { CiPartitionTimingSource, CiPartitionTimingSourceLive } from "./CiPartitions.service.ts";
import { withCiGithub } from "./LaneTimings.ts";
import type { CiLanePartition } from "./CiLanePartitions.ts";
import type { CiPartitionRunTimings, CiShardedPartitionSource } from "./CiPartitions.schemas.ts";

/**
 * One weighted item for {@link lptAssign}.
 *
 * @category models
 * @since 0.0.0
 */
export interface LptItem<A> {
  /** Stable tie-break key; items of equal weight are placed in ascending key order. */
  readonly key: string;
  readonly value: A;
  /** Non-negative cost. */
  readonly weight: number;
}

/**
 * One bin produced by {@link lptAssign}.
 *
 * @category models
 * @since 0.0.0
 */
export interface LptBin<A> {
  readonly items: ReadonlyArray<A>;
  readonly load: number;
}

/**
 * Longest-processing-time-first assignment into a fixed number of bins.
 *
 * **Details**
 *
 * Items are sorted by descending weight, ties broken by ascending key, and each goes to the
 * currently lightest bin, ties broken by the lowest bin index. The result is deterministic for a
 * given input, which is what a committed plan needs; it is the same rule the 2026-11-06 repo-cli
 * plan was built with (`docs/reports/ci-test-scheduling-2026-11-06.md`).
 *
 * **Example** (Pack four files into two bins)
 *
 * ```ts
 * import { lptAssign } from "@beep/repo-cli/commands/Ci"
 *
 * const bins = lptAssign(
 *   [
 *     { key: "a", weight: 4, value: "a" },
 *     { key: "b", weight: 3, value: "b" },
 *     { key: "c", weight: 2, value: "c" },
 *     { key: "d", weight: 1, value: "d" },
 *   ],
 *   2
 * )
 * console.log(bins.map((bin) => bin.load)) // [5, 5]
 * ```
 *
 * @param items - The weighted items.
 * @param binCount - How many bins to fill (at least one).
 * @returns `binCount` bins with their loads and items in assignment order.
 * @category utilities
 * @since 0.0.0
 */
export const lptAssign: {
  <A>(items: ReadonlyArray<LptItem<A>>, binCount: number): ReadonlyArray<LptBin<A>>;
  (binCount: number): <A>(items: ReadonlyArray<LptItem<A>>) => ReadonlyArray<LptBin<A>>;
} = dual(2, <A>(items: ReadonlyArray<LptItem<A>>, binCount: number): ReadonlyArray<LptBin<A>> => {
  const ordered = A.sort(
    items,
    Order.combine(
      Order.mapInput(Order.flip(Order.Number), (item: LptItem<A>) => item.weight),
      Order.mapInput(Order.String, (item: LptItem<A>) => item.key)
    )
  );
  const bins: Array<{ load: number; items: Array<A> }> = A.makeBy(Math.max(1, binCount), () => ({
    load: 0,
    items: [],
  }));
  for (const item of ordered) {
    const lightest = A.reduce(bins, 0, (best, bin, index) => (bin.load < (bins[best]?.load ?? 0) ? index : best));
    const bin = bins[lightest];
    if (bin !== undefined) {
      bin.load += item.weight;
      bin.items.push(item.value);
    }
  }
  return A.map(bins, (bin) => ({ load: bin.load, items: bin.items }));
});

/**
 * Pack measured file timings of one package into a committed shard plan.
 *
 * **Details**
 *
 * A file measured in more than one shard (a rerun, or a run that spans two layouts) keeps its
 * largest duration. Files inside each shard are listed in ascending path order so the plan diff
 * stays readable; the sequencer never depends on that order.
 *
 * **Example** (Pack two files into two shards)
 *
 * ```ts
 * import { buildVitestShardPlan, BuildVitestShardPlanOptions, CiPartitionFileTiming } from "@beep/repo-cli/commands/Ci"
 *
 * const plan = buildVitestShardPlan(
 *   BuildVitestShardPlanOptions.make({
 *     files: [
 *       CiPartitionFileTiming.make({ partitionId: "repo-cli-1", file: "test/a.test.ts", milliseconds: 1200 }),
 *       CiPartitionFileTiming.make({ partitionId: "repo-cli-1", file: "test/b.test.ts", milliseconds: 800 }),
 *     ],
 *     total: 2,
 *     sourceRun: 42554761567,
 *     sourceCommit: "b80e11050714191c6d0ff58e8371e9d4c3f17880",
 *   })
 * )
 * console.log(plan.estimatedMilliseconds) // [1200, 800]
 * ```
 *
 * @param options - The timings, shard count and provenance.
 * @returns The plan to commit as the package's `vitest.shards.json`.
 * @category utilities
 * @since 0.0.0
 */
export const buildVitestShardPlan = ({
  files,
  sourceCommit,
  sourceRun,
  total,
}: BuildVitestShardPlanOptions): VitestShardPlan => {
  const byFile = A.reduce(files, HashMap.empty<string, number>(), (acc, timing) =>
    HashMap.set(
      acc,
      timing.file,
      Math.max(
        timing.milliseconds,
        O.getOrElse(HashMap.get(acc, timing.file), () => 0)
      )
    )
  );
  const entries = pipe(byFile, HashMap.entries, A.fromIterable);
  const bins = lptAssign(
    A.map(entries, ([file, milliseconds]) => ({ key: file, weight: milliseconds, value: file })),
    total
  );
  return VitestShardPlan.make({
    sourceRun,
    sourceCommit,
    estimatedMilliseconds: A.map(bins, (bin) => Math.round(bin.load)),
    shards: A.map(bins, (bin) => A.sort(bin.items, Order.String)),
    fileMilliseconds: R.fromEntries(
      A.sort(
        entries,
        Order.mapInput(Order.String, ([file]: readonly [string, number]) => file)
      )
    ),
  });
};

const decodePlan = S.decodeUnknownEffect(S.fromJsonString(VitestShardPlan));
const encodePlan = S.encodeEffect(S.fromJsonString(VitestShardPlan, { space: 2 }));

const readShardPlan = Effect.fn("CiPartitions.readShardPlan")(function* (
  repoRoot: string,
  source: CiShardedPartitionSource
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .readFileString(path.join(repoRoot, source.planPath))
    .pipe(Effect.flatMap(decodePlan), CiCommandError.mapError(`Cannot read ${source.planPath}.`));
});

const writeShardPlan = Effect.fn("CiPartitions.writeShardPlan")(function* (
  repoRoot: string,
  source: CiShardedPartitionSource,
  plan: VitestShardPlan
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* encodePlan(plan).pipe(CiCommandError.mapError(`Cannot encode ${source.planPath}.`));
  yield* fs
    .writeFileString(path.join(repoRoot, source.planPath), `${text}\n`)
    .pipe(CiCommandError.mapError(`Cannot write ${source.planPath}.`));
  // The package lint runs Biome over the plan, and Biome's JSON layout (inline numeric arrays
  // wrapped at the line width) is not JSON.stringify's; format the file the way lint expects.
  const formatted = yield* runCaptured({
    command: "bunx",
    args: ["biome", "format", "--write", source.planPath],
    cwd: repoRoot,
    source: "all",
  }).pipe(CiCommandError.mapError(`Cannot format ${source.planPath}.`));
  if (formatted.exitCode !== 0) {
    return yield* CiCommandError.make({ message: `Biome could not format ${source.planPath}: ${formatted.output}` });
  }
});

const testUnitPartitions = (table: ReadonlyArray<CiLanePartition>) =>
  A.filter(table, (partition) => partition.lane === "test-unit");

const shardedPartitionsOf = (table: ReadonlyArray<CiLanePartition>, source: CiShardedPartitionSource) =>
  pipe(
    testUnitPartitions(table),
    A.filter((partition) => P.isNotUndefined(partition.shard) && A.contains(partition.packages, source.packageName)),
    A.sort(Order.mapInput(Order.Number, (partition: CiLanePartition) => partition.shard?.index ?? 0))
  );

const binPartitions = (table: ReadonlyArray<CiLanePartition>) =>
  A.filter(testUnitPartitions(table), (partition) => P.isUndefined(partition.shard));

const roundSeconds = (milliseconds: number) => Math.round(milliseconds / 1000);
const formatSeconds = (seconds: number) => (Math.round(seconds * 10) / 10).toFixed(1);

const shardedSourceRows = (
  plan: VitestShardPlan,
  partitions: ReadonlyArray<CiLanePartition>
): ReadonlyArray<CiPartitionBudgetRow> => {
  const stalePlan = A.length(plan.shards) !== A.length(partitions);
  return A.map(partitions, (partition, index) => {
    const milliseconds = plan.estimatedMilliseconds[index] ?? 0;
    const estimatedSeconds = milliseconds / 1000;
    const status = stalePlan
      ? "stale-plan"
      : estimatedSeconds > CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS
        ? "over"
        : roundSeconds(milliseconds) !== partition.weightSeconds
          ? "stale-weight"
          : "within";
    return CiPartitionBudgetRow.make({
      partitionId: partition.id,
      estimatedSeconds,
      weightSeconds: partition.weightSeconds,
      budgetSeconds: CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS,
      status,
    });
  });
};

const shardedSourceReport = Effect.fn("CiPartitions.shardedSourceReport")(function* (
  repoRoot: string,
  table: ReadonlyArray<CiLanePartition>,
  source: CiShardedPartitionSource
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const plan = yield* readShardPlan(repoRoot, source);
  const partitions = shardedPartitionsOf(table, source);
  const rows = shardedSourceRows(plan, partitions);
  const missing = yield* Effect.filter(A.flatten(plan.shards), (file) =>
    fs.exists(path.join(repoRoot, source.packagePath, file)).pipe(
      Effect.map((exists) => !exists),
      Effect.orElseSucceed(() => true)
    )
  );
  const warnings = [
    ...(A.length(plan.shards) !== A.length(partitions)
      ? [
          `${source.planPath} plans ${A.length(plan.shards)} shards but the table runs ${A.length(partitions)}; run rebalance --write.`,
        ]
      : []),
    ...(A.isReadonlyArrayNonEmpty(missing)
      ? [
          `${source.planPath} names ${A.length(missing)} file(s) no longer in ${source.packagePath}: ${A.join(missing, ", ")} (they are simply not collected; refresh the plan when a green main run is available).`,
        ]
      : []),
  ];
  return { rows, warnings };
});

const binRows = (table: ReadonlyArray<CiLanePartition>): ReadonlyArray<CiPartitionBudgetRow> =>
  A.map(binPartitions(table), (partition) =>
    CiPartitionBudgetRow.make({
      partitionId: partition.id,
      estimatedSeconds: partition.weightSeconds,
      weightSeconds: partition.weightSeconds,
      budgetSeconds: CI_UNIT_BIN_SERIAL_BUDGET_SECONDS,
      status: partition.weightSeconds > CI_UNIT_BIN_SERIAL_BUDGET_SECONDS ? "over" : "within",
    })
  );

/**
 * Judge the committed plans and the partition table against their budgets, offline.
 *
 * **Example** (Check the committed table)
 *
 * ```ts
 * import { checkCiPartitions } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(checkCiPartitions("/repo")))
 * ```
 *
 * @param repoRoot - The checkout holding the plan files.
 * @param table - The partition table to judge (the committed one by default).
 * @returns One row per Test Unit partition plus advisory warnings about stale plan entries.
 * @category use-cases
 * @since 0.0.0
 */
export const checkCiPartitions = Effect.fn("CiPartitions.check")(function* (
  repoRoot: string,
  table: ReadonlyArray<CiLanePartition> = CI_LANE_PARTITIONS
) {
  const sharded = yield* Effect.forEach(CI_SHARDED_PARTITION_SOURCES, (source) =>
    shardedSourceReport(repoRoot, table, source)
  );
  return CiPartitionRebalanceReport.make({
    rows: A.appendAll(
      A.flatMap(sharded, (entry) => entry.rows),
      binRows(table)
    ),
    warnings: A.flatMap(sharded, (entry) => entry.warnings),
  });
});

/**
 * Render a rebalance report as aligned text lines.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { CiPartitionRebalanceReport, renderCiPartitionReport } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(renderCiPartitionReport(CiPartitionRebalanceReport.make({ rows: [], warnings: [] }))[0])
 * ```
 *
 * @param report - The report to render.
 * @returns Header, one line per row, then warnings.
 * @category utilities
 * @since 0.0.0
 */
export const renderCiPartitionReport = (report: CiPartitionRebalanceReport): ReadonlyArray<string> => [
  "partition          estimate_s  weight_s  budget_s  status",
  ...A.map(
    report.rows,
    (row) =>
      `${Str.padEnd(18)(row.partitionId)} ${Str.padStart(10)(formatSeconds(row.estimatedSeconds))}  ${Str.padStart(8)(
        String(row.weightSeconds)
      )}  ${Str.padStart(8)(String(row.budgetSeconds))}  ${row.status}`
  ),
  ...A.map(report.warnings, (warning) => `warning: ${warning}`),
];

const sharedFamilyFiles = (timings: CiPartitionRunTimings, source: CiShardedPartitionSource) =>
  A.filter(timings.files, (timing) => Str.startsWith(`${source.family}-`)(timing.partitionId));

const writeFamilyPlan = Effect.fn("CiPartitions.writeFamilyPlan")(function* (
  repoRoot: string,
  table: ReadonlyArray<CiLanePartition>,
  timings: CiPartitionRunTimings,
  shardSource: CiShardedPartitionSource
) {
  const partitions = shardedPartitionsOf(table, shardSource);
  const files = sharedFamilyFiles(timings, shardSource);
  if (A.isReadonlyArrayEmpty(files)) {
    return yield* CiCommandError.make({
      message: `Run ${timings.runId} has no ${shardSource.family} file timings; is it a green run of the current layout?`,
    });
  }
  const plan = buildVitestShardPlan(
    BuildVitestShardPlanOptions.make({
      files,
      total: A.length(partitions),
      sourceRun: timings.runId,
      sourceCommit: timings.headSha,
    })
  );
  yield* writeShardPlan(repoRoot, shardSource, plan);
  return [
    `${shardSource.planPath}: ${A.length(A.flatten(plan.shards))} files over ${A.length(plan.shards)} shards from run ${timings.runId} (${timings.headSha})`,
    ...A.map(
      A.zip(partitions, plan.estimatedMilliseconds),
      ([partition, milliseconds]) =>
        `  ${partition.id}: ${formatSeconds(milliseconds / 1000)} s planned; table weightSeconds ${partition.weightSeconds}${
          roundSeconds(milliseconds) === partition.weightSeconds ? "" : ` -> set ${roundSeconds(milliseconds)}`
        }`
    ),
  ];
});

// Package name by repository-relative directory, for mapping measured package paths back to names.
const workspaceNamesByPath = Effect.fn("CiPartitions.workspaceNamesByPath")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const workspaces = yield* workspaceManifests(repoRoot).pipe(
    CiCommandError.mapError("Cannot read the workspace inventory for the bin proposal.")
  );
  return pipe(
    workspaces,
    HashMap.entries,
    A.fromIterable,
    A.reduce(HashMap.empty<string, string>(), (acc, [name, entry]) =>
      HashMap.set(acc, Str.replaceAll("\\", "/")(path.relative(repoRoot, entry.dir)), name)
    )
  );
});

// The largest measured wall of every bin package, keyed by package name.
const measuredBinPackages = (
  timings: CiPartitionRunTimings,
  bins: ReadonlyArray<CiLanePartition>,
  nameByPath: HashMap.HashMap<string, string>
): ReadonlyArray<readonly [string, number]> =>
  pipe(
    timings.packages,
    A.filter((timing) => A.some(bins, (bin) => bin.id === timing.partitionId)),
    A.reduce(HashMap.empty<string, number>(), (acc, timing) =>
      O.match(HashMap.get(nameByPath, timing.packagePath), {
        onNone: () => acc,
        onSome: (name) =>
          HashMap.set(
            acc,
            name,
            Math.max(
              timing.seconds,
              O.getOrElse(HashMap.get(acc, name), () => 0)
            )
          ),
      })
    ),
    HashMap.entries,
    A.fromIterable
  );

const binProposalLines = Effect.fn("CiPartitions.binProposalLines")(function* (
  repoRoot: string,
  table: ReadonlyArray<CiLanePartition>,
  timings: CiPartitionRunTimings
) {
  const bins = binPartitions(table);
  const nameByPath = yield* workspaceNamesByPath(repoRoot);
  const measured = measuredBinPackages(timings, bins, nameByPath);
  const measuredNames = A.map(measured, ([name]) => name);
  const unmeasured = A.filter(
    A.flatMap(bins, (bin) => bin.packages),
    (name) => !A.contains(measuredNames, name)
  );
  const proposal = lptAssign(
    A.map(measured, ([name, seconds]) => ({ key: name, weight: seconds, value: name })),
    A.length(bins)
  );
  return [
    `bin proposal: ${A.length(measured)} measured packages over ${A.length(bins)} bins (serial sums; budget ${CI_UNIT_BIN_SERIAL_BUDGET_SECONDS} s)`,
    ...A.flatMap(A.zip(bins, proposal), ([bin, packed]) => [
      `  ${bin.id}: weightSeconds ${Math.round(packed.load)} (table ${bin.weightSeconds})`,
      ...A.map(A.sort(packed.items, Order.String), (name) => `    "${name}",`),
    ]),
    ...(A.isReadonlyArrayNonEmpty(unmeasured)
      ? [
          `  table packages without a measurement in run ${timings.runId}: ${A.join(A.sort(unmeasured, Order.String), ", ")}`,
        ]
      : []),
  ];
});

/**
 * Repack every sharded family from one green run and write the plan files; propose the bin repack.
 *
 * **Example** (Inspect the rebalance effect)
 *
 * ```ts
 * import { rebalanceCiPartitions } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(rebalanceCiPartitions("/repo", 42554761567)))
 * ```
 *
 * @param repoRoot - The checkout to write plans into.
 * @param runId - The green `main` run to measure.
 * @param table - The partition table whose shard and bin counts are the targets.
 * @returns Lines describing the new plans and the proposed bin table.
 * @category use-cases
 * @since 0.0.0
 */
export const rebalanceCiPartitions = Effect.fn("CiPartitions.rebalance")(function* (
  repoRoot: string,
  runId: number,
  table: ReadonlyArray<CiLanePartition> = CI_LANE_PARTITIONS
) {
  const source = yield* CiPartitionTimingSource;
  const timings = yield* source.collect(runId);
  const planLines = yield* Effect.forEach(CI_SHARDED_PARTITION_SOURCES, (shardSource) =>
    writeFamilyPlan(repoRoot, table, timings, shardSource)
  );
  const binLines = yield* binProposalLines(repoRoot, table, timings);
  return A.appendAll(A.flatten(planLines), binLines);
});

const rebalanceCommand = Command.make(
  "rebalance",
  {
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Judge the committed plans and table weights against their budgets (default)")
    ),
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Rewrite every vitest.shards.json from the --run timings and print the bin proposal")
    ),
    run: Flag.Int("run").pipe(Flag.withDescription("Green main run id whose Test Unit logs to measure"), Flag.optional),
  },
  Effect.fnUntraced(function* ({ check, run, write }) {
    const repoRoot = yield* findRepoRoot().pipe(Effect.orElseSucceed(() => process.cwd()));
    if (write) {
      const runId = yield* O.match(run, {
        onNone: () => CiCommandError.make({ message: "--write needs --run <id> naming a green main run." }),
        onSome: Effect.succeed,
      });
      // Build the timing source for this command's scope and hand its context to the program; the
      // GitHub client and repository come from the same scope through `withCiGithub`.
      const lines = yield* Layer.build(CiPartitionTimingSourceLive).pipe(
        Effect.flatMap((context) => Effect.provideContext(rebalanceCiPartitions(repoRoot, runId), context)),
        Effect.scoped,
        withCiGithub(repoRoot)
      );
      yield* printLines(lines);
    }
    if (check || !write) {
      const report = yield* checkCiPartitions(repoRoot);
      yield* printLines(renderCiPartitionReport(report));
      const failing = A.filter(report.rows, (row) => row.status !== "within");
      if (A.isReadonlyArrayNonEmpty(failing)) {
        return yield* CiCommandError.make({
          message: `${A.length(failing)} Test Unit partition(s) fail the budget check: ${A.join(
            A.map(failing, (row) => `${row.partitionId} (${row.status})`),
            ", "
          )}.`,
        });
      }
      yield* Console.log("[ci] every Test Unit partition is within budget and matches its plan.");
    }
  })
).pipe(Command.withDescription("Recompute Test Unit shard plans and weights from a green main run, or check them"));

/**
 * `beep ci partitions` command group.
 *
 * **Example** (Inspect the command)
 *
 * ```ts
 * import { ciPartitionsCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof ciPartitionsCommand) // object
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciPartitionsCommand = Command.make("partitions", {}, () =>
  printLines([
    "Test Unit partition commands:",
    "- bun run beep ci partitions rebalance [--check] (offline budget check of the committed plans and table)",
    "- bun run beep ci partitions rebalance --write --run <id> (repack from a green main run, then check)",
  ])
).pipe(
  Command.withDescription("Hosted Test Unit partition plans and budgets"),
  Command.withSubcommands([rebalanceCommand])
);
