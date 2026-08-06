/**
 * Coverage regression baseline support for the root quality coverage task.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str, thunkFalse, thunkTrue } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, Inspectable, MutableHashMap, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { formatJsonc, readArtifact, writeArtifact } from "../../../internal/artifacts/index.ts";
import { runCaptured } from "../../../internal/process/index.ts";
import { enforceRatchet } from "../../../internal/ratchet/index.ts";
import { QualityTaskConfigurationError, QualityTaskFailed } from "../Quality.errors.ts";
import { discoverWorkspacePackages, repoRelative } from "./QualityArtifactSupport.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { WorkspacePackageInfo } from "./QualityArtifactSupport.ts";

const $I = $RepoCliId.create("commands/Quality/internal/CoverageRegression");

/**
 * Path to the committed coverage regression baseline.
 *
 * @category constants
 * @since 0.0.0
 */
export const coverageRegressionBaselinePath = "standards/coverage.regression-baseline.jsonc";

/**
 * Exact baseline regeneration command rendered in the generated baseline.
 *
 * @category constants
 * @since 0.0.0
 */
export const coverageRegressionRegenerationCommand = "bun run coverage:baseline:write";

/**
 * Percentage-point tolerance used when comparing Vitest floating-point pct output.
 *
 * @category constants
 * @since 0.0.0
 */
export const coverageRegressionEpsilon = 0.001;

const CoverageMetricName = LiteralKit(["branches", "functions", "lines", "statements"]).pipe(
  $I.annoteSchema("CoverageMetricName", {
    description: "Coverage metric names tracked by the regression baseline.",
  })
);

type CoverageMetricName = typeof CoverageMetricName.Type;

const VitestCoveragePct = S.Union([S.Finite, S.Literal("Unknown")]).pipe(
  $I.annoteSchema("VitestCoveragePct", {
    description: "Vitest coverage percentage value; empty coverage maps render as the string Unknown.",
  })
);

type VitestCoveragePct = typeof VitestCoveragePct.Type;

/**
 * Absolute uncovered counts per metric, recorded alongside the percentages.
 *
 * **Details**
 *
 * Percentages alone cannot distinguish the two ways they fall. Deleting code
 * that tests already covered lowers the ratio arithmetically, because removing
 * one covered unit from a package below full coverage leaves a smaller ratio
 * than it started with — yet nothing regressed, because the covered subject was
 * removed rather than left untested. Adding untested code lowers the ratio too,
 * and that one is a real gap. The uncovered count separates them: it stays flat
 * when code is deleted and rises only when coverage is genuinely lost.
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageUncoveredCounts extends S.Class<CoverageUncoveredCounts>($I`CoverageUncoveredCounts`)(
  {
    lines: S.Int,
    statements: S.Int,
    branches: S.Int,
    functions: S.Int,
  },
  $I.annote("CoverageUncoveredCounts", {
    description: "Absolute uncovered counts per metric for one workspace package.",
  })
) {}

/**
 * Per-package coverage percentages stored in the committed baseline.
 *
 * **Gotchas**
 *
 * `uncovered` is optional so baselines written before it existed still decode.
 * When either side of a comparison lacks it the ratchet falls back to the
 * percentage-only rule, which is the stricter of the two.
 *
 * @category models
 * @since 0.0.0
 */
export class CoveragePackageBaseline extends S.Class<CoveragePackageBaseline>($I`CoveragePackageBaseline`)(
  {
    path: S.String,
    lines: S.Finite,
    statements: S.Finite,
    branches: S.Finite,
    functions: S.Finite,
    uncovered: CoverageUncoveredCounts.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CoveragePackageBaseline", {
    description: "Committed coverage percentages for one workspace package.",
  })
) {}

/**
 * Committed package coverage regression baseline document.
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageRegressionBaseline extends S.Class<CoverageRegressionBaseline>($I`CoverageRegressionBaseline`)(
  {
    schema_version: S.Literal(1),
    generated_at: S.String,
    git_sha: S.String,
    command: S.String,
    epsilon: S.Finite,
    packages: S.Record(S.String, CoveragePackageBaseline),
  },
  $I.annote("CoverageRegressionBaseline", {
    description: "Package coverage percentages used by the fail-on-drop ratchet.",
  })
) {}

class VitestCoverageMetric extends S.Class<VitestCoverageMetric>($I`VitestCoverageMetric`)(
  {
    total: S.Finite,
    covered: S.Finite,
    skipped: S.Finite,
    pct: VitestCoveragePct,
  },
  $I.annote("VitestCoverageMetric", {
    description: "Vitest coverage-summary metric payload.",
  })
) {}

class VitestCoverageSummaryTotal extends S.Class<VitestCoverageSummaryTotal>($I`VitestCoverageSummaryTotal`)(
  {
    lines: VitestCoverageMetric,
    statements: VitestCoverageMetric,
    branches: VitestCoverageMetric,
    functions: VitestCoverageMetric,
  },
  $I.annote("VitestCoverageSummaryTotal", {
    description: "Total coverage metrics from a Vitest coverage-summary.json file.",
  })
) {}

class VitestCoverageSummary extends S.Class<VitestCoverageSummary>($I`VitestCoverageSummary`)(
  {
    total: VitestCoverageSummaryTotal,
  },
  $I.annote("VitestCoverageSummary", {
    description: "Minimal Vitest coverage-summary.json shape consumed by the ratchet.",
  })
) {}

/**
 * Baseline entry paired with the package it covers, used when reporting
 * packages that are new since the committed baseline.
 *
 * **Example** (Reading the package a snapshot entry covers)
 *
 * ```ts
 * import type { CoverageSnapshotEntry } from "@beep/repo-cli/test/Quality"
 * declare const entry: CoverageSnapshotEntry
 * console.log(entry.packageName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageSnapshotEntry extends S.Class<CoverageSnapshotEntry>($I`CoverageSnapshotEntry`)(
  {
    baseline: CoveragePackageBaseline,
    packageName: S.String,
  },
  $I.annote("CoverageSnapshotEntry", {
    description: "Baseline entry paired with the package it covers.",
  })
) {}

/**
 * One metric that dropped below its committed baseline for one package.
 *
 * **Example** (Reporting one dropped metric)
 *
 * ```ts
 * import type { CoverageComparisonFailure } from "@beep/repo-cli/test/Quality"
 * declare const failure: CoverageComparisonFailure
 * console.log(`${failure.packageName} ${failure.metric}: ${failure.actual} < ${failure.baseline}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageComparisonFailure extends S.Class<CoverageComparisonFailure>($I`CoverageComparisonFailure`)(
  {
    actual: S.Finite,
    baseline: S.Finite,
    metric: CoverageMetricName,
    packageName: S.String,
    packagePath: S.String,
  },
  $I.annote("CoverageComparisonFailure", {
    description: "One metric that dropped below its committed baseline for one package.",
  })
) {}

/**
 * Outcome of comparing current coverage against the committed baseline:
 * metric drops (failures), packages missing a current summary, and packages
 * new since the baseline was written.
 *
 * **Example** (Deciding whether a run regressed)
 *
 * ```ts
 * import type { CoverageComparisonResult } from "@beep/repo-cli/test/Quality"
 * declare const result: CoverageComparisonResult
 * console.log(result.failures.length === 0 ? "ok" : "regression")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageComparisonResult extends S.Class<CoverageComparisonResult>($I`CoverageComparisonResult`)(
  {
    comparedCount: S.Int,
    failures: S.Array(CoverageComparisonFailure),
    missingActuals: S.Array(S.String),
    newPackages: S.Array(CoverageSnapshotEntry),
  },
  $I.annote("CoverageComparisonResult", {
    description: "Outcome of comparing current coverage against the committed baseline.",
  })
) {}

const decodeVitestCoverageSummary = S.decodeUnknownEffect(S.fromJsonString(VitestCoverageSummary));

const metricNames = CoverageMetricName.Options;

const hasCoverageScript = (info: WorkspacePackageInfo): boolean =>
  pipe(info.packageJson.scripts ?? {}, R.get("coverage"), O.isSome);

const coverageSummaryPath = (path: Path.Path, info: WorkspacePackageInfo): string =>
  path.join(info.absolutePath, "coverage", "coverage-summary.json");

const coveragePctValue = (value: VitestCoveragePct): number => (value === "Unknown" ? 0 : value);

const uncoveredCount = (metric: VitestCoverageMetric): number => metric.total - metric.covered;

const toCoveragePackageBaseline = (path: string, summary: VitestCoverageSummary): CoveragePackageBaseline =>
  CoveragePackageBaseline.make({
    path,
    lines: coveragePctValue(summary.total.lines.pct),
    statements: coveragePctValue(summary.total.statements.pct),
    branches: coveragePctValue(summary.total.branches.pct),
    functions: coveragePctValue(summary.total.functions.pct),
    uncovered: O.some(
      CoverageUncoveredCounts.make({
        lines: uncoveredCount(summary.total.lines),
        statements: uncoveredCount(summary.total.statements),
        branches: uncoveredCount(summary.total.branches),
        functions: uncoveredCount(summary.total.functions),
      })
    ),
  });

const packageByNameOrder = Order.mapInput(Order.String, (entry: CoverageSnapshotEntry) => entry.packageName);

const readGitSha = Effect.fn("CoverageRegression.readGitSha")(function* (
  repoRoot: string
): Effect.fn.Return<string, QualityTaskConfigurationError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCaptured({
    command: "git",
    args: ["rev-parse", "HEAD"],
    cwd: repoRoot,
    source: "stdout",
  }).pipe(QualityTaskConfigurationError.mapError("Failed to read git revision."));

  if (result.exitCode !== 0) {
    return yield* QualityTaskConfigurationError.new(`git rev-parse HEAD failed with exit code ${result.exitCode}.`);
  }

  return Str.trim(result.output);
});

const workspaceCoveragePackages = Effect.fn("CoverageRegression.workspaceCoveragePackages")(function* (
  repoRoot: string,
  path: Path.Path
): Effect.fn.Return<ReadonlyArray<WorkspacePackageInfo>, QualityTaskConfigurationError, FileSystem.FileSystem> {
  const packageMap = yield* discoverWorkspacePackages(repoRoot, path).pipe(
    QualityTaskConfigurationError.mapError("Failed to discover workspace packages for coverage.")
  );

  return pipe(
    A.fromIterable(MutableHashMap.values(packageMap)),
    A.filter(hasCoverageScript),
    A.sort(Order.mapInput(Order.String, (info: WorkspacePackageInfo) => info.name))
  );
});

const readCoverageSummary = Effect.fn("CoverageRegression.readCoverageSummary")(function* (
  summaryPath: string
): Effect.fn.Return<VitestCoverageSummary, QualityTaskConfigurationError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(summaryPath)
    .pipe(QualityTaskConfigurationError.mapError(`Failed to read coverage summary ${summaryPath}.`));

  return yield* decodeVitestCoverageSummary(text).pipe(
    QualityTaskConfigurationError.mapError(`Failed to parse coverage summary ${summaryPath}.`)
  );
});

const maybeSnapshotEntry = Effect.fn("CoverageRegression.maybeSnapshotEntry")(function* (
  repoRoot: string,
  path: Path.Path,
  info: WorkspacePackageInfo
): Effect.fn.Return<O.Option<CoverageSnapshotEntry>, QualityTaskConfigurationError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const summaryPath = coverageSummaryPath(path, info);
  const exists = yield* fs.exists(summaryPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return O.none();
  }

  const summary = yield* readCoverageSummary(summaryPath);
  return O.some({
    packageName: info.name,
    baseline: toCoveragePackageBaseline(repoRelative(info.absolutePath, repoRoot, path), summary),
  });
});

/**
 * Remove stale package coverage directories before a ratchet run.
 *
 * @param repoRoot - Repository root.
 * @category filesystem
 * @since 0.0.0
 */
export const cleanCoverageRegressionOutputs = Effect.fn("CoverageRegression.cleanCoverageRegressionOutputs")(function* (
  repoRoot: string
): Effect.fn.Return<void, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packages = yield* workspaceCoveragePackages(repoRoot, path);

  yield* Effect.forEach(
    packages,
    (info) => fs.remove(path.join(info.absolutePath, "coverage"), { force: true, recursive: true }),
    { concurrency: 8, discard: true }
  ).pipe(QualityTaskConfigurationError.mapError("Failed to clean stale coverage outputs."));
});

/**
 * Collect package coverage percentages from generated Vitest summaries.
 *
 * @param repoRoot - Repository root.
 * @returns Sorted snapshot entries for packages that emitted coverage summaries.
 * @category filesystem
 * @since 0.0.0
 */
export const collectCoverageSnapshot = Effect.fn("CoverageRegression.collectCoverageSnapshot")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<CoverageSnapshotEntry>,
  QualityTaskConfigurationError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const packages = yield* workspaceCoveragePackages(repoRoot, path);
  const entries = yield* Effect.forEach(packages, (info) => maybeSnapshotEntry(repoRoot, path, info), {
    concurrency: 8,
  });

  return pipe(entries, A.getSomes, A.sort(packageByNameOrder));
});

const snapshotPackages = (entries: ReadonlyArray<CoverageSnapshotEntry>): Record<string, CoveragePackageBaseline> =>
  R.fromEntries(A.map(entries, (entry) => [entry.packageName, entry.baseline] as const));

/**
 * Merge a snapshot over the packages a previous baseline recorded.
 *
 * Only packages the run actually measured are replaced; everything else is
 * carried through untouched. A scoped run measures a handful of packages, so
 * without this the written document would contain only those and silently drop
 * every other entry.
 *
 * @param previous - Packages recorded by the committed baseline.
 * @param entries - Packages this run measured.
 * @returns The committed packages with the measured ones replaced.
 * @category testing
 * @since 0.0.0
 */
export const mergeCoverageBaselinePackagesForTesting = (
  previous: Record<string, CoveragePackageBaseline>,
  entries: ReadonlyArray<CoverageSnapshotEntry>
): Record<string, CoveragePackageBaseline> => ({ ...previous, ...snapshotPackages(entries) });

/**
 * Committed entries an unscoped replacement would delete without meaning to.
 *
 * **Details**
 *
 * A replacement legitimately prunes packages that no longer exist — that is how
 * a deleted package leaves the baseline. What it must not do is drop an entry
 * for a package that is still in the workspace and simply was not measured,
 * which is what a partially failed run or an undeclared filter produces.
 *
 * Comparing names rather than counts matters: a run that drops one package and
 * gains another measures the same number while still deleting an entry, so a
 * count check waves it through.
 *
 * @param previousNames - Packages the committed baseline records.
 * @param measuredNames - Packages this run produced a summary for.
 * @param workspaceNames - Packages that currently exist and run coverage.
 * @returns Baseline entries that are still live packages but went unmeasured.
 * @category testing
 * @since 0.0.0
 */
export const baselineEntriesLostByReplacement = (
  previousNames: ReadonlyArray<string>,
  measuredNames: ReadonlyArray<string>,
  workspaceNames: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    previousNames,
    A.filter((name) => !A.contains(measuredNames, name) && A.contains(workspaceNames, name)),
    A.sort(Order.String)
  );

const baselineDocumentFromSnapshot = Effect.fn("CoverageRegression.baselineDocumentFromSnapshot")(function* (
  repoRoot: string,
  entries: ReadonlyArray<CoverageSnapshotEntry>,
  previous: O.Option<CoverageRegressionBaseline>
): Effect.fn.Return<
  CoverageRegressionBaseline,
  QualityTaskConfigurationError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const gitSha = yield* readGitSha(repoRoot);

  return CoverageRegressionBaseline.make({
    schema_version: 1,
    // A merge leaves most entries untouched, so claiming this run's timestamp
    // and revision for the whole document would attribute a provenance the
    // unmeasured entries do not have. Only a full regeneration earns fresh
    // metadata; a merge inherits the last one.
    generated_at: pipe(previous, O.match({ onNone: () => generatedAt, onSome: (document) => document.generated_at })),
    git_sha: pipe(previous, O.match({ onNone: () => gitSha, onSome: (document) => document.git_sha })),
    command: coverageRegressionRegenerationCommand,
    epsilon: coverageRegressionEpsilon,
    packages: pipe(
      previous,
      O.match({
        onNone: () => snapshotPackages(entries),
        onSome: (document) => mergeCoverageBaselinePackagesForTesting(document.packages, entries),
      })
    ),
  });
});

const readBaseline = Effect.fn("CoverageRegression.readBaseline")(function* (
  repoRoot: string
): Effect.fn.Return<CoverageRegressionBaseline, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const baselinePath = path.join(repoRoot, coverageRegressionBaselinePath);
  return yield* readArtifact({
    path: baselinePath,
    schema: CoverageRegressionBaseline,
    onReadError: (cause) =>
      QualityTaskConfigurationError.new(
        `Failed to read ${coverageRegressionBaselinePath}.: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
    onDecodeError: (cause) =>
      QualityTaskConfigurationError.new(
        `Failed to parse ${coverageRegressionBaselinePath}.: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
  });
});

/**
 * Read the committed baseline, distinguishing "not there yet" from "unreadable".
 *
 * A missing file is the legitimate first-write case and yields `None`. A file
 * that exists but fails to read or decode is an error and stays one — treating
 * it as absent would let a scoped write fall through to the snapshot-only branch
 * and overwrite a baseline whose only problem was that it did not parse.
 */
const readPreviousBaseline = Effect.fn("CoverageRegression.readPreviousBaseline")(function* (
  repoRoot: string
): Effect.fn.Return<
  O.Option<CoverageRegressionBaseline>,
  QualityTaskConfigurationError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(path.join(repoRoot, coverageRegressionBaselinePath))
    .pipe(Effect.orElseSucceed(thunkFalse));

  return exists ? O.some(yield* readBaseline(repoRoot)) : O.none();
});

const formatBaseline = Effect.fn("CoverageRegression.formatBaseline")(function* (
  baseline: CoverageRegressionBaseline
): Effect.fn.Return<string, QualityTaskConfigurationError> {
  // `formatJsonc` stringifies whatever it is handed, so the document has to be
  // encoded first. That was invisible while every field was a plain scalar and
  // the decoded value doubled as the wire value; `uncovered` is an `Option`
  // decoded and an optional key encoded, so writing the decoded shape produces
  // a baseline the reader rejects.
  const encoded = yield* S.encodeEffect(CoverageRegressionBaseline)(baseline).pipe(
    QualityTaskConfigurationError.mapError("Failed to encode coverage regression baseline.")
  );
  const jsonc = yield* formatJsonc(encoded).pipe(
    QualityTaskConfigurationError.mapError("Failed to format coverage regression baseline.")
  );
  return [
    "// Coverage regression baseline. Do not edit by hand.",
    `// Regenerate with: ${coverageRegressionRegenerationCommand}`,
    "// Epsilon: 0.001 percentage points; only smaller floating-point noise is ignored.",
    jsonc,
  ].join("\n");
});

/**
 * Write the committed coverage regression baseline from generated summaries.
 *
 * **Details**
 *
 * A scoped run measures only the packages it was filtered to, so its snapshot
 * is merged over the committed document and every unmeasured entry is carried
 * through. An unscoped run is a full regeneration and replaces the document
 * outright, which is what prunes entries for packages that no longer exist.
 *
 * **Gotchas**
 *
 * An unscoped run that measured fewer packages than the document it is about to
 * replace is refused rather than written. That shape means the coverage run did
 * not cover what it claimed to — a partial failure, a filter the caller forgot
 * to declare — and writing it would delete the missing entries silently.
 *
 * @param repoRoot - Repository root.
 * @param scoped - Whether the coverage run was intentionally filtered or affected-scoped.
 * @category use-cases
 * @since 0.0.0
 */
export const writeCoverageRegressionBaseline = Effect.fn("CoverageRegression.writeCoverageRegressionBaseline")(
  function* (
    repoRoot: string,
    scoped: boolean
  ): Effect.fn.Return<
    void,
    QualityTaskConfigurationError,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > {
    const path = yield* Path.Path;
    const entries = yield* collectCoverageSnapshot(repoRoot);
    if (A.isReadonlyArrayEmpty(entries)) {
      return yield* QualityTaskConfigurationError.new("No coverage summaries were generated; cannot write baseline.");
    }

    // Absent and unreadable are different answers. Collapsing a read or decode
    // failure into "no previous document" would take the snapshot-only branch
    // and overwrite a baseline that merely failed to parse, so only a genuinely
    // missing file yields `None`; anything else propagates.
    const previous = yield* readPreviousBaseline(repoRoot);

    if (!scoped) {
      const workspaceNames = yield* workspaceCoveragePackages(repoRoot, path).pipe(
        Effect.map(A.map((info) => info.name))
      );
      const lost = baselineEntriesLostByReplacement(
        pipe(previous, O.match({ onNone: A.empty<string>, onSome: (document) => R.keys(document.packages) })),
        A.map(entries, (entry) => entry.packageName),
        workspaceNames
      );

      if (A.isReadonlyArrayNonEmpty(lost)) {
        return yield* QualityTaskConfigurationError.new(
          `Refusing to write ${coverageRegressionBaselinePath}: an unscoped regeneration replaces the document, and ${A.length(lost)} package(s) it records are still in the workspace but produced no coverage summary in this run, so their entries would be deleted: ${A.join(lost, ", ")}. Re-run coverage across the whole workspace, or pass a turbo filter so the run is treated as scoped and merged instead. Packages that no longer exist are pruned normally and do not trigger this.`
        );
      }
    }

    const baseline = yield* baselineDocumentFromSnapshot(repoRoot, entries, scoped ? previous : O.none());
    const content = yield* formatBaseline(baseline);
    yield* writeArtifact({
      path: path.join(repoRoot, coverageRegressionBaselinePath),
      body: content,
      onError: (cause) =>
        QualityTaskConfigurationError.new(
          `Failed to write ${coverageRegressionBaselinePath}.: ${Inspectable.toStringUnknown(cause, 0)}`
        ),
    });
    yield* Console.log(
      scoped
        ? `[coverage-ratchet] merged ${A.length(entries)} measured package(s) into ${coverageRegressionBaselinePath} (${R.size(baseline.packages)} total)`
        : `[coverage-ratchet] wrote ${coverageRegressionBaselinePath} with ${A.length(entries)} package(s)`
    );
  }
);

const actualByPackageName = (actuals: ReadonlyArray<CoverageSnapshotEntry>) =>
  R.fromEntries(A.map(actuals, (entry) => [entry.packageName, entry] as const));

/**
 * Whether a metric's percentage drop reflects lost coverage rather than deleted
 * covered code.
 *
 * A percentage falls both when untested code is added and when tested code is
 * removed, and only the first is a regression. The uncovered count tells them
 * apart: deleting covered code leaves it flat, losing coverage raises it. When
 * either side predates the count the percentage rule stands alone, which keeps
 * the stricter behaviour for baselines that have not been rewritten yet.
 *
 * Known blind spot. When the total does not shrink this is exact — coverage can
 * only be lost by raising the uncovered count. When the total does shrink, a
 * real regression can hide behind an exactly offsetting deletion: losing tests
 * on five covered units while five unrelated uncovered units are deleted moves
 * 60/100 to 55/95, which is byte-identical to simply deleting five covered
 * units. Package-level totals cannot separate those two histories at all, so
 * catching it would need per-file counts, which would grow the committed
 * baseline by roughly the size of the repo. The trade is deliberate: a rare miss
 * that needs a coincidental offset, in exchange for not failing every change
 * that deletes tested code.
 *
 * @param metric - Metric being compared.
 * @param baseline - Committed entry for the package.
 * @param actual - Entry measured by this run.
 * @param epsilon - Percentage-point tolerance for floating-point noise.
 * @returns `true` when the drop reflects coverage that was actually lost.
 */
const metricRegressed = (
  metric: CoverageMetricName,
  baseline: CoveragePackageBaseline,
  actual: CoveragePackageBaseline,
  epsilon: number
): boolean =>
  actual[metric] + epsilon < baseline[metric] &&
  pipe(
    O.zipWith(baseline.uncovered, actual.uncovered, (before, after) => after[metric] > before[metric]),
    O.getOrElse(thunkTrue)
  );

const droppedMetrics = (
  packageName: string,
  baseline: CoveragePackageBaseline,
  actual: CoveragePackageBaseline,
  epsilon: number
): ReadonlyArray<CoverageComparisonFailure> =>
  pipe(
    metricNames,
    A.filter((metric) => metricRegressed(metric, baseline, actual, epsilon)),
    A.map((metric) => ({
      packageName,
      packagePath: baseline.path,
      metric,
      baseline: baseline[metric],
      actual: actual[metric],
    }))
  );

const compareCoverage = (
  baseline: CoverageRegressionBaseline,
  actuals: ReadonlyArray<CoverageSnapshotEntry>,
  scoped: boolean
): CoverageComparisonResult => {
  const actualsByName = actualByPackageName(actuals);
  const baselineEntries = A.sort(
    R.toEntries(baseline.packages),
    Order.mapInput(Order.String, (entry: readonly [string, CoveragePackageBaseline]) => entry[0])
  );
  const failures = pipe(
    baselineEntries,
    A.flatMap(([packageName, packageBaseline]) =>
      pipe(
        actualsByName,
        R.get(packageName),
        O.map((actual) => droppedMetrics(packageName, packageBaseline, actual.baseline, baseline.epsilon)),
        O.getOrElse(A.empty<CoverageComparisonFailure>)
      )
    )
  );
  const missingActuals = scoped
    ? A.empty<string>()
    : pipe(
        baselineEntries,
        A.filter(([packageName]) => pipe(actualsByName, R.get(packageName), O.isNone)),
        A.map(([packageName]) => packageName)
      );
  const newPackages = pipe(
    actuals,
    A.filter((actual) => pipe(baseline.packages, R.get(actual.packageName), O.isNone)),
    A.sort(packageByNameOrder)
  );

  return {
    comparedCount: A.length(actuals) - A.length(newPackages),
    failures,
    missingActuals,
    newPackages,
  };
};

/**
 * Pure coverage baseline comparison exposed for package-local tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const compareCoverageRegressionSnapshotsForTesting = compareCoverage;

const renderCoverageFailures = (failures: ReadonlyArray<CoverageComparisonFailure>): ReadonlyArray<string> =>
  A.map(
    failures,
    (failure) =>
      `  - ${failure.packageName} (${failure.packagePath}) ${failure.metric}: ${failure.actual} < ${failure.baseline}`
  );

const renderNewPackageWarnings = (packages: ReadonlyArray<CoverageSnapshotEntry>): ReadonlyArray<string> =>
  A.map(
    packages,
    (entry) =>
      `  - ${entry.packageName} (${entry.baseline.path}) is missing from ${coverageRegressionBaselinePath}; run ${coverageRegressionRegenerationCommand} and review the baseline diff.`
  );

const regressionLines = (result: CoverageComparisonResult): ReadonlyArray<string> => {
  const sections = [
    ...A.match(result.failures, {
      onEmpty: A.empty<string>,
      onNonEmpty: (failures) => [
        "[coverage-ratchet] coverage dropped below baseline:",
        ...renderCoverageFailures(failures),
      ],
    }),
    ...A.match(result.missingActuals, {
      onEmpty: A.empty<string>,
      onNonEmpty: (missing) => [
        "[coverage-ratchet] missing coverage summaries for baseline package(s):",
        ...A.map(missing, (packageName) => `  - ${packageName}`),
      ],
    }),
  ];
  return sections;
};

/**
 * Compare generated package coverage summaries against the committed baseline.
 *
 * @param repoRoot - Repository root.
 * @param scoped - Whether the coverage run was intentionally filtered or affected-scoped.
 * @category use-cases
 * @since 0.0.0
 */
export const compareCoverageRegressionBaseline = Effect.fn("CoverageRegression.compareCoverageRegressionBaseline")(
  function* (
    repoRoot: string,
    scoped: boolean
  ): Effect.fn.Return<void, QualityTaskConfigurationError | QualityTaskFailed, FileSystem.FileSystem | Path.Path> {
    const baseline = yield* readBaseline(repoRoot);
    const actuals = yield* collectCoverageSnapshot(repoRoot);
    const result = compareCoverage(baseline, actuals, scoped);

    if (A.isReadonlyArrayNonEmpty(result.newPackages)) {
      yield* Console.warn(
        A.join(
          [
            "[coverage-ratchet] package(s) without baseline entry (warning only):",
            ...renderNewPackageWarnings(result.newPackages),
          ],
          "\n"
        )
      );
    }

    yield* enforceRatchet({
      regressions: [
        {
          present: A.isReadonlyArrayNonEmpty(result.failures) || A.isReadonlyArrayNonEmpty(result.missingActuals),
          lines: regressionLines(result),
          error: QualityTaskFailed.new(1, "coverage:ratchet", "beep-cli coverage"),
        },
      ],
      okLine: `[coverage-ratchet] ok: compared ${result.comparedCount} package(s) with epsilon ${baseline.epsilon}`,
      tighten: O.none(),
    });
  }
);
