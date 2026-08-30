/**
 * Coverage regression baseline support for the root quality coverage task.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError } from "@beep/repo-utils";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { NonNegativeInt } from "@beep/schema/Number";
import { HUNDRED as HUNDRED_PERCENTAGE, Percentage, ZERO as ZERO_PERCENTAGE } from "@beep/schema/Percentage";
import { A, Str, thunkFalse, thunkTrue } from "@beep/utils";
import {
  Console,
  DateTime,
  Effect,
  FileSystem,
  flow,
  HashSet,
  Inspectable,
  Match,
  MutableHashMap,
  Order,
  Path,
  pipe,
  Tuple,
} from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { formatJsonc, readArtifact, writeArtifact } from "../../../internal/artifacts/index.ts";
import { configStringOption } from "../../../internal/cli/EnvConfig.ts";
import { isLabsWorkspacePath } from "../../../internal/cli/Labs/index.ts";
import { runCaptured } from "../../../internal/process/index.ts";
import { enforceRatchet } from "../../../internal/ratchet/index.ts";
import { collectChangedFiles, collectDirtyWorktreeFiles } from "../../../internal/repo-run/ChangedFiles.ts";
import { resolveGitCommit, resolveGitMergeBase, runGitRawOutput } from "../../../internal/repo-run/GitExec.ts";
import { QualityTaskConfigurationError, QualityTaskFailed } from "../Quality.errors.ts";
import {
  CoverageBaselineRowDelta,
  changedCoverageOwners,
  planCoverageAffectedScope,
  workspaceCoverageScopeOwners,
} from "./CoverageScope.ts";
import { discoverWorkspacePackages, repoRelative } from "./QualityArtifactSupport.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GitCommandErrorAdapter } from "../../../internal/repo-run/GitExec.ts";
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
 * Scoped baseline regeneration command for exactly the named packages.
 *
 * **Details**
 *
 * A filtered `--write-baseline` run measures only the named packages and
 * merges their rows into the committed document, leaving every other row
 * untouched. It is the remediation the ratchet prints for a regression, and
 * the only regeneration form that does not spend the full workspace run.
 *
 * **Example** (Two packages)
 *
 * ```ts
 * import { coverageScopedBaselineWriteCommand } from "@beep/repo-cli/test/Quality"
 *
 * console.log(coverageScopedBaselineWriteCommand(["@beep/md", "@beep/pandoc-ast"]))
 * // "bun run coverage -- --filter=@beep/md --filter=@beep/pandoc-ast --write-baseline"
 * ```
 *
 * @param packageNames - Coverage owners whose rows should be re-measured and merged.
 * @returns The exact command line to run from the repository root.
 * @category constants
 * @since 0.0.0
 */
export const coverageScopedBaselineWriteCommand = (packageNames: ReadonlyArray<string>): string =>
  `bun run coverage -- ${A.join(
    A.map(packageNames, (packageName) => `--filter=${packageName}`),
    " "
  )} --write-baseline`;

/**
 * Percentage-point tolerance used when comparing Vitest floating-point pct output.
 *
 * @category constants
 * @since 0.0.0
 */
export const coverageRegressionEpsilon = 0.001;

const COVERAGE_DIAGNOSTIC_MAX_CHARS = 4096;
const COVERAGE_DIAGNOSTIC_CONTENT_MAX_CHARS = COVERAGE_DIAGNOSTIC_MAX_CHARS - 3;
const COVERAGE_PATH_FRAGMENT_MAX_CHARS = 512;
const DISALLOWED_COVERAGE_CONTROL_PATTERN = /[\u0000-\u001F\u007F-\u009F]/gu;

const SupportedCoverageRegressionEpsilon = S.Literal(coverageRegressionEpsilon).pipe(
  $I.annoteSchema("SupportedCoverageRegressionEpsilon", {
    description: "Exact percentage-point tolerance supported by the coverage regression comparator.",
  })
);

const CoverageMetricName = LiteralKit(["branches", "functions", "lines", "statements"]).pipe(
  $I.annoteSchema("CoverageMetricName", {
    description: "Coverage metric names tracked by the regression baseline.",
  })
);

type CoverageMetricName = typeof CoverageMetricName.Type;

const VitestCoveragePct = S.Union([Percentage, S.Literal("Unknown")]).pipe(
  $I.annoteSchema("VitestCoveragePct", {
    description: "Vitest coverage percentage value; empty coverage maps render as the string Unknown.",
  })
);

type VitestCoveragePct = typeof VitestCoveragePct.Type;

const CoverageRepoRelativeFilePath = S.NonEmptyString.check(
  S.isPattern(
    /^(?!.*[\u0000-\u001F\u007F-\u009F])(?!\/)(?![A-Za-z]:)(?!.*\\)(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))(?!.*\/\/)(?!.*\/$).+$/u,
    {
      identifier: $I`CoverageRepoRelativeFilePathCheck`,
      title: "Normalized repository-relative coverage file path",
      description:
        "A non-empty repository-relative file path with POSIX separators, normalized segments, no control characters, and no trailing slash.",
      message: "Expected a normalized repository-relative coverage file path without control characters",
    }
  )
).pipe(
  $I.annoteSchema("CoverageRepoRelativeFilePath", {
    description: "Normalized repository-relative file key stored in a schema-v2 coverage baseline.",
  })
);

const isCoverageRepoRelativeFilePath = S.is(CoverageRepoRelativeFilePath);

const CoverageRepoRelativePackagePath = S.Union([S.Literal("."), CoverageRepoRelativeFilePath]).pipe(
  $I.annoteSchema("CoverageRepoRelativePackagePath", {
    description: "Normalized repository-relative workspace path, including the repository root package.",
  })
);

const CoverageSummaryRawFilePath = S.NonEmptyString.check(
  S.isPattern(/^[^\u0000-\u001F\u007F-\u009F]+$/u, {
    identifier: $I`CoverageSummaryRawFilePathCheck`,
    title: "Render-safe coverage summary file path",
    description: "A non-empty raw coverage-summary path without C0 or C1 control characters.",
    message: "Expected a coverage summary file path without control characters",
  })
).pipe(
  $I.annoteSchema("CoverageSummaryRawFilePath", {
    description: "Raw absolute or package-relative Vitest coverage file path safe for normalization and diagnostics.",
  })
);

const isCoverageSummaryRawFilePath = S.is(CoverageSummaryRawFilePath);

const sanitizeCoverageDiagnostic = flow(
  Str.replace(DISALLOWED_COVERAGE_CONTROL_PATTERN, "�"),
  Str.truncate(COVERAGE_DIAGNOSTIC_CONTENT_MAX_CHARS)
);

const coverageDiagnosticFragment = flow(
  Str.replace(DISALLOWED_COVERAGE_CONTROL_PATTERN, "�"),
  Str.truncate(COVERAGE_PATH_FRAGMENT_MAX_CHARS)
);

type CoverageRegressionError = QualityTaskConfigurationError | DomainError;

const coverageConfigurationError = (message: string, cause: unknown): DomainError =>
  DomainError.make({
    message: sanitizeCoverageDiagnostic(`${message}: ${Inspectable.toStringUnknown(cause, 0)}`),
    cause,
  });

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
 * and that one is a real gap. The uncovered count distinguishes the ordinary
 * cases, while schema-v2 file provenance catches offsetting changes that leave
 * the package count flat.
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageUncoveredCounts extends S.Class<CoverageUncoveredCounts>($I`CoverageUncoveredCounts`)(
  {
    lines: NonNegativeInt,
    statements: NonNegativeInt,
    branches: NonNegativeInt,
    functions: NonNegativeInt,
  },
  $I.annote("CoverageUncoveredCounts", {
    description: "Absolute uncovered counts per metric for one workspace package.",
  })
) {}

/**
 * Coverage percentages and uncovered counts for one repository file.
 *
 * **Example** (Record a fully covered file)
 *
 * ```ts
 * import { CoverageFileBaseline, CoverageUncoveredCounts } from "@beep/repo-cli/test/Quality"
 *
 * const file = CoverageFileBaseline.make({
 *   branches: 100,
 *   functions: 100,
 *   lines: 100,
 *   statements: 100,
 *   uncovered: CoverageUncoveredCounts.make({ branches: 0, functions: 0, lines: 0, statements: 0 }),
 * })
 *
 * console.log(file.lines) // 100
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageFileBaseline extends S.Class<CoverageFileBaseline>($I`CoverageFileBaseline`)(
  {
    lines: Percentage,
    statements: Percentage,
    branches: Percentage,
    functions: Percentage,
    uncovered: CoverageUncoveredCounts,
  },
  $I.annote("CoverageFileBaseline", {
    description: "Coverage metrics for one repo-relative source file in a workspace package.",
  })
) {}

const CoverageRepoRelativeFiles = S.Record(S.String, CoverageFileBaseline)
  .check(
    S.makeFilter<S.Record.Type<typeof S.String, typeof CoverageFileBaseline>>(
      (files) =>
        pipe(
          R.keys(files),
          A.findFirst((filePath) => !isCoverageRepoRelativeFilePath(filePath)),
          O.match({
            onNone: () => undefined,
            onSome: (filePath) => ({
              path: [filePath],
              issue: "Expected a normalized repository-relative coverage file path",
            }),
          })
        ),
      {
        identifier: $I`CoverageRepoRelativeFilesCheck`,
        title: "Normalized repository-relative coverage file keys",
        description: "Every coverage file key must be a normalized repository-relative path.",
      }
    )
  )
  .pipe(
    $I.annoteSchema("CoverageRepoRelativeFiles", {
      description: "Per-file coverage baselines keyed by normalized repository-relative paths.",
    })
  );

/**
 * Per-package coverage percentages stored in the committed baseline.
 *
 * **Gotchas**
 *
 * Schema version 2 requires both uncovered counts and per-file provenance.
 * Surviving files fail when a percentage drop is accompanied by more uncovered
 * units, while a baseline path that carried covered units fails closed if it
 * disappears. Package drops accompanied by any other file-set change also fail
 * closed, and a newly uncovered path fails when package totals would otherwise
 * hide it: without source-control provenance, a true deletion and a move of
 * newly untested code into another file produce the same summary.
 *
 * @category models
 * @since 0.0.0
 */
export class CoveragePackageBaseline extends S.Class<CoveragePackageBaseline>($I`CoveragePackageBaseline`)(
  {
    path: CoverageRepoRelativePackagePath,
    lines: Percentage,
    statements: Percentage,
    branches: Percentage,
    functions: Percentage,
    uncovered: CoverageUncoveredCounts,
    files: CoverageRepoRelativeFiles,
  },
  $I.annote("CoveragePackageBaseline", {
    description: "Committed package coverage totals with required per-file provenance.",
  })
) {}

class CoverageTieredMinimum extends S.Class<CoverageTieredMinimum>($I`CoverageTieredMinimum`)(
  {
    lines: Percentage,
    statements: Percentage,
    branches: Percentage,
    functions: Percentage,
  },
  $I.annote("CoverageTieredMinimum", {
    description: "Repository-wide minimum coverage percentages by metric.",
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
    schema_version: S.Literal(2),
    generated_at: S.String,
    git_sha: S.String,
    command: S.String,
    epsilon: SupportedCoverageRegressionEpsilon,
    minimum: CoverageTieredMinimum,
    exemptions: S.Record(S.String, S.NonEmptyString),
    follow_ups: S.Record(S.String, S.NonEmptyString),
    packages: S.Record(S.String, CoveragePackageBaseline),
  },
  $I.annote("CoverageRegressionBaseline", {
    description: "Package coverage percentages used by the fail-on-drop ratchet.",
  })
) {}

const defaultCoverageTieredMinimum = CoverageTieredMinimum.make({
  lines: Percentage.make(70),
  statements: Percentage.make(70),
  branches: Percentage.make(50),
  functions: Percentage.make(60),
});

const defaultCoverageExemptions: Record<string, string> = {
  "@beep/scratchpad": "User-excluded aggregate workspace with multiple experimental Vitest boundaries.",
  "@beep/storybook": "User-excluded Storybook runner whose self-coverage would be self-fulfilling.",
  "@beep/tsgo-shim": "Plain JavaScript launcher shim with no TypeScript source surface.",
};

const defaultCoverageFollowUps: Record<string, string> = {};

const LegacyCoveragePackageBaselineForMigration = S.Struct({
  path: S.String,
}).pipe(
  $I.annoteSchema("LegacyCoveragePackageBaselineForMigration", {
    description: "Minimal schema-v1 package entry needed to preserve package identity during full baseline migration.",
  })
);

const LegacyCoverageRegressionBaselineForMigration = S.Struct({
  schema_version: S.Literal(1),
  generated_at: S.String,
  git_sha: S.String,
  command: S.String,
  epsilon: S.Finite,
  minimum: CoverageTieredMinimum.pipe(S.withDecodingDefaultKey(Effect.succeed(defaultCoverageTieredMinimum))),
  exemptions: S.Record(S.String, S.NonEmptyString).pipe(
    S.withDecodingDefaultKey(Effect.succeed(defaultCoverageExemptions))
  ),
  follow_ups: S.Record(S.String, S.NonEmptyString).pipe(
    S.withDecodingDefaultKey(Effect.succeed(defaultCoverageFollowUps))
  ),
  packages: S.Record(S.String, LegacyCoveragePackageBaselineForMigration),
}).pipe(
  $I.annoteSchema("LegacyCoverageRegressionBaselineForMigration", {
    description:
      "Legacy schema-v1 coverage document accepted only to require or perform a full migration to schema v2.",
  })
);

const CoverageRegressionBaselineDocument = S.Union([
  CoverageRegressionBaseline,
  LegacyCoverageRegressionBaselineForMigration,
]).pipe(
  $I.annoteSchema("CoverageRegressionBaselineDocument", {
    description: "Coverage baseline read boundary spanning current schema v2 and the one-way legacy migration input.",
  })
);

type CoverageRegressionBaselineDocument = typeof CoverageRegressionBaselineDocument.Type;

const isCurrentCoverageRegressionBaseline = S.is(CoverageRegressionBaseline);

const baselineReadError = (cause: unknown): DomainError =>
  coverageConfigurationError(`Failed to read ${coverageRegressionBaselinePath}.`, cause);

const baselineDecodeError = (cause: unknown): DomainError =>
  coverageConfigurationError(`Failed to parse ${coverageRegressionBaselinePath}.`, cause);

class VitestCoverageMetric extends S.Class<VitestCoverageMetric>($I`VitestCoverageMetric`)(
  {
    total: NonNegativeInt,
    covered: NonNegativeInt,
    skipped: NonNegativeInt,
    pct: VitestCoveragePct,
  },
  $I.annote("VitestCoverageMetric", {
    description: "Vitest coverage-summary metric payload.",
  })
) {}

const ValidVitestCoverageMetric = VitestCoverageMetric.check(
  S.makeFilter<VitestCoverageMetric>(
    (metric) =>
      (metric.covered <= metric.total && metric.skipped <= metric.total) || {
        path: [],
        issue: "Expected covered and skipped counts not to exceed the total count",
      },
    {
      identifier: $I`ValidVitestCoverageMetricCheck`,
      title: "Consistent Vitest coverage metric counts",
      description: "Covered and skipped counts must not exceed the corresponding total count.",
    }
  )
).pipe(
  $I.annoteSchema("ValidVitestCoverageMetric", {
    description: "Vitest coverage metric with internally consistent nonnegative counts.",
  })
);

class VitestCoverageSummaryTotal extends S.Class<VitestCoverageSummaryTotal>($I`VitestCoverageSummaryTotal`)(
  {
    lines: ValidVitestCoverageMetric,
    statements: ValidVitestCoverageMetric,
    branches: ValidVitestCoverageMetric,
    functions: ValidVitestCoverageMetric,
  },
  $I.annote("VitestCoverageSummaryTotal", {
    description: "Total coverage metrics from a Vitest coverage-summary.json file.",
  })
) {}

const VitestCoverageSummary = S.StructWithRest(S.Struct({ total: VitestCoverageSummaryTotal }), [
  S.Record(S.String, VitestCoverageSummaryTotal),
]).pipe(
  $I.annoteSchema("VitestCoverageSummary", {
    description: "Minimal Vitest coverage-summary.json shape consumed by the ratchet.",
  })
);

type VitestCoverageSummary = typeof VitestCoverageSummary.Type;

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
 * Disposition applied to one package row during a baseline write.
 *
 * **Example** (Recognize a held row)
 *
 * ```ts
 * import { CoverageBaselineRowDisposition } from "@beep/repo-cli/test/Quality"
 *
 * console.log(CoverageBaselineRowDisposition.is("held")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoverageBaselineRowDisposition = LiteralKit(["replaced", "held", "added", "pruned"]).pipe(
  $I.annoteSchema("CoverageBaselineRowDisposition", {
    description: "Outcome for one package row while planning a coverage baseline write.",
  })
);

/**
 * Disposition applied to one package row during a baseline write.
 *
 * @see {@link CoverageBaselineRowDisposition} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CoverageBaselineRowDisposition = typeof CoverageBaselineRowDisposition.Type;

/**
 * Changed-package adoption set, full-run diagnostics, and comparison-base
 * label for an unscoped baseline write.
 *
 * **Details**
 *
 * `packageNames` is the sorted set of coverage owners for every changed file.
 * `fullReasons` comes from the affected-run planner but does not expand that
 * adoption set.
 *
 * **Gotchas**
 *
 * A non-empty `fullReasons` array means the run measured the full workspace;
 * it does not authorize whole-document replacement. Only `--replace-all`
 * grants that behavior.
 *
 * **Example** (Describe a dirty-only change set)
 *
 * ```ts
 * import { CoverageBaselineChangeSet } from "@beep/repo-cli/test/Quality"
 *
 * const changeSet = CoverageBaselineChangeSet.make({
 *   baseDescription: "dirty worktree only",
 *   packageNames: [],
 *   fullReasons: []
 * })
 * console.log(changeSet.baseDescription)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageBaselineChangeSet extends S.Class<CoverageBaselineChangeSet>($I`CoverageBaselineChangeSet`)(
  {
    baseDescription: S.NonEmptyString,
    packageNames: S.Array(S.String),
    fullReasons: S.Array(S.String),
  },
  $I.annote("CoverageBaselineChangeSet", {
    description: "Coverage-row adoption owners, full-run diagnostics, and the Git comparison base used to derive them.",
  })
) {}

/**
 * Complete package rows and per-package outcomes for one baseline write.
 *
 * **Details**
 *
 * The nested change set records the exact changed-owner adoption set and any
 * independent reasons the measurement planner selected the full workspace.
 *
 * **Gotchas**
 *
 * A `replaced` disposition is driven by a changed owner or `--replace-all`,
 * never merely by a non-empty full-reason list.
 *
 * **Example** (Represent an empty first-write plan)
 *
 * ```ts
 * import { CoverageBaselineWritePlan } from "@beep/repo-cli/test/Quality"
 *
 * const plan = CoverageBaselineWritePlan.make({
 *   changeSet: { baseDescription: "dirty worktree only", packageNames: [], fullReasons: [] },
 *   packages: {},
 *   dispositions: {}
 * })
 * console.log(plan.packages) // {}
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageBaselineWritePlan extends S.Class<CoverageBaselineWritePlan>($I`CoverageBaselineWritePlan`)(
  {
    changeSet: CoverageBaselineChangeSet,
    packages: S.Record(S.String, CoveragePackageBaseline),
    dispositions: S.Record(S.String, CoverageBaselineRowDisposition),
  },
  $I.annote("CoverageBaselineWritePlan", {
    description: "Coverage baseline package rows to write plus the disposition of every measured or removed package.",
  })
) {}

/**
 * One coverage comparison failure, distinguished by whether an existing
 * baseline dropped or a new file introduced uncovered units without a prior
 * file identity to compare.
 *
 * **Example** (Reporting one dropped metric)
 *
 * ```ts
 * import type { CoverageComparisonFailure } from "@beep/repo-cli/test/Quality"
 * declare const failure: CoverageComparisonFailure
 * console.log(failure._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const CoverageComparisonFailureFields = {
  actual: Percentage,
  filePath: CoverageRepoRelativeFilePath.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  metric: CoverageMetricName,
  packageName: S.String,
  packagePath: CoverageRepoRelativePackagePath,
};

class CoverageBaselineDropFailure extends S.TaggedClass<CoverageBaselineDropFailure>($I`CoverageBaselineDropFailure`)(
  "baseline-drop",
  {
    ...CoverageComparisonFailureFields,
    baseline: Percentage,
  },
  $I.annote("CoverageBaselineDropFailure", {
    description: "One package or existing-file metric that dropped below its committed baseline.",
  })
) {}

class CoverageNewUncoveredFileFailure extends S.TaggedClass<CoverageNewUncoveredFileFailure>(
  $I`CoverageNewUncoveredFileFailure`
)(
  "new-uncovered-file",
  {
    ...CoverageComparisonFailureFields,
    uncovered: NonNegativeInt,
  },
  $I.annote("CoverageNewUncoveredFileFailure", {
    description: "A newly observed file with uncovered units and no prior file baseline identity.",
  })
) {}

/**
 * Runtime schema for a tagged coverage regression caused by either a baseline
 * drop or a newly uncovered file.
 *
 * **Example** (Decode a baseline drop)
 *
 * ```ts
 * import { CoverageComparisonFailure } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(CoverageComparisonFailure)({
 *   _tag: "baseline-drop",
 *   actual: 90,
 *   baseline: 95,
 *   filePath: "packages/example/src/index.ts",
 *   metric: "lines",
 *   packageName: "@beep/example",
 *   packagePath: "packages/example",
 * })
 *
 * console.log(O.isSome(decoded)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoverageComparisonFailure = S.Union([CoverageBaselineDropFailure, CoverageNewUncoveredFileFailure]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CoverageComparisonFailure", {
    description: "Tagged coverage regression reason for a baseline drop or newly uncovered file.",
  })
);

/**
 * Decoded tagged coverage regression produced by {@link CoverageComparisonFailure}.
 *
 * @see {@link CoverageComparisonFailure} for runtime decoding and tag discrimination.
 * @category type-level
 * @since 0.0.0
 */
export type CoverageComparisonFailure = typeof CoverageComparisonFailure.Type;

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
    minimumFailures: S.Array(CoverageComparisonFailure),
    missingActuals: S.Array(S.String),
    newPackages: S.Array(CoverageSnapshotEntry),
    followUpDebt: S.Array(CoverageSnapshotEntry),
  },
  $I.annote("CoverageComparisonResult", {
    description: "Outcome of comparing current coverage against the committed baseline.",
  })
) {}

const decodeVitestCoverageSummary = S.decodeUnknownEffect(S.fromJsonString(VitestCoverageSummary));

const metricNames = CoverageMetricName.Options;

const hasCoverageScript = (info: WorkspacePackageInfo): boolean =>
  pipe(info.packageJson.scripts ?? {}, R.get("coverage"), O.isSome);

/**
 * Find workspace packages that have neither a coverage script nor a named exemption.
 *
 * @category testing
 * @since 0.0.0
 */
export const coverageDispositionGapsForTesting: {
  (
    coveragePackageNames: ReadonlyArray<string>,
    exemptionNames: ReadonlyArray<string>
  ): (workspacePackageNames: ReadonlyArray<string>) => ReadonlyArray<string>;
  (
    workspacePackageNames: ReadonlyArray<string>,
    coveragePackageNames: ReadonlyArray<string>,
    exemptionNames: ReadonlyArray<string>
  ): ReadonlyArray<string>;
} = dual(
  3,
  (
    workspacePackageNames: ReadonlyArray<string>,
    coveragePackageNames: ReadonlyArray<string>,
    exemptionNames: ReadonlyArray<string>
  ): ReadonlyArray<string> =>
    pipe(
      workspacePackageNames,
      A.filter((name) => !A.contains(coveragePackageNames, name) && !A.contains(exemptionNames, name)),
      A.sort(Order.String)
    )
);

const workspaceCoverageDispositionGaps = Effect.fn("CoverageRegression.workspaceCoverageDispositionGaps")(function* (
  repoRoot: string,
  path: Path.Path,
  exemptions: Record<string, string>
): Effect.fn.Return<ReadonlyArray<string>, QualityTaskConfigurationError, FileSystem.FileSystem> {
  const packageMap = yield* discoverWorkspacePackages(repoRoot, path).pipe(
    QualityTaskConfigurationError.mapError("Failed to discover workspace packages for coverage policy.")
  );
  const workspacePackages = pipe(
    A.fromIterable(MutableHashMap.values(packageMap)),
    // Labs never owe a coverage disposition: they are ceremony-exempt
    // (goals/lab-apps-lifecycle D2) and appear as neither gaps nor exemptions.
    A.filter((info) => info.path !== "." && !isLabsWorkspacePath(info.path))
  );

  return coverageDispositionGapsForTesting(
    A.map(workspacePackages, (info) => info.name),
    A.map(A.filter(workspacePackages, hasCoverageScript), (info) => info.name),
    R.keys(exemptions)
  );
});

const coverageSummaryPath = (path: Path.Path, info: WorkspacePackageInfo): string =>
  path.join(info.absolutePath, "coverage", "coverage-summary.json");

const coveragePercentageFromCounts = (metric: VitestCoverageMetric): Percentage =>
  metric.total === 0
    ? HUNDRED_PERCENTAGE
    : Percentage.make(Math.floor((1_000 * 100 * metric.covered) / metric.total / 10) / 100);

const uncoveredCount = (metric: VitestCoverageMetric): NonNegativeInt =>
  NonNegativeInt.make(metric.total - metric.covered);

const toCoverageUncoveredCounts = (summary: VitestCoverageSummaryTotal): CoverageUncoveredCounts =>
  CoverageUncoveredCounts.make({
    lines: uncoveredCount(summary.lines),
    statements: uncoveredCount(summary.statements),
    branches: uncoveredCount(summary.branches),
    functions: uncoveredCount(summary.functions),
  });

const toCoverageFileBaseline = (summary: VitestCoverageSummaryTotal): CoverageFileBaseline =>
  CoverageFileBaseline.make({
    lines: coveragePercentageFromCounts(summary.lines),
    statements: coveragePercentageFromCounts(summary.statements),
    branches: coveragePercentageFromCounts(summary.branches),
    functions: coveragePercentageFromCounts(summary.functions),
    uncovered: toCoverageUncoveredCounts(summary),
  });

const coverageFileByPathOrder = Order.mapInput(
  Order.String,
  (entry: readonly [string, CoverageFileBaseline]) => entry[0]
);

const normalizedCoverageFilePath = (filePath: string, repoRoot: string, packageRoot: string, path: Path.Path): string =>
  repoRelative(path.isAbsolute(filePath) ? filePath : path.resolve(packageRoot, filePath), repoRoot, path);

const coverageSummaryFileByRawPathOrder = Order.mapInput(
  Order.String,
  (entry: readonly [string, VitestCoverageSummaryTotal]) => entry[0]
);

const invalidCoverageFilePathError = (): QualityTaskConfigurationError =>
  QualityTaskConfigurationError.make({
    message:
      "Coverage summary contains a file path that cannot be represented as a normalized repository-relative path without control characters. Regenerate the summary with the repository coverage command.",
  });

const duplicateCoverageFilePathError = (
  normalizedPath: string,
  firstRawPath: string,
  secondRawPath: string
): QualityTaskConfigurationError =>
  QualityTaskConfigurationError.make({
    message: sanitizeCoverageDiagnostic(
      `Coverage summary paths "${coverageDiagnosticFragment(firstRawPath)}" and "${coverageDiagnosticFragment(secondRawPath)}" both normalize to "${coverageDiagnosticFragment(normalizedPath)}". Remove the duplicate absolute/relative entry and regenerate the summary with the repository coverage command.`
    ),
  });

const coverageFiles = Effect.fn("CoverageRegression.coverageFiles")(function* (
  repoRoot: string,
  packageRoot: string,
  path: Path.Path,
  summary: VitestCoverageSummary
): Effect.fn.Return<Record<string, CoverageFileBaseline>, QualityTaskConfigurationError> {
  const seenNormalizedPaths = MutableHashMap.empty<string, string>();
  const files = yield* pipe(
    summary,
    R.remove("total"),
    R.toEntries,
    A.sort(coverageSummaryFileByRawPathOrder),
    Effect.forEach(
      Effect.fnUntraced(function* ([rawPath, metrics]) {
        if (!isCoverageSummaryRawFilePath(rawPath)) {
          return yield* invalidCoverageFilePathError();
        }

        const normalizedPath = normalizedCoverageFilePath(rawPath, repoRoot, packageRoot, path);
        if (!isCoverageRepoRelativeFilePath(normalizedPath)) {
          return yield* invalidCoverageFilePathError();
        }

        const firstRawPath = MutableHashMap.get(seenNormalizedPaths, normalizedPath);
        if (O.isSome(firstRawPath)) {
          return yield* duplicateCoverageFilePathError(normalizedPath, firstRawPath.value, rawPath);
        }

        yield* Effect.sync(() => MutableHashMap.set(seenNormalizedPaths, normalizedPath, rawPath));
        return Tuple.make(normalizedPath, toCoverageFileBaseline(metrics));
      })
    )
  );

  return pipe(files, A.sort(coverageFileByPathOrder), R.fromEntries);
});

const toCoveragePackageBaseline = Effect.fn("CoverageRegression.toCoveragePackageBaseline")(function* (
  repoRoot: string,
  packageRoot: string,
  path: Path.Path,
  summary: VitestCoverageSummary
): Effect.fn.Return<CoveragePackageBaseline, QualityTaskConfigurationError> {
  const files = yield* coverageFiles(repoRoot, packageRoot, path, summary);
  return CoveragePackageBaseline.make({
    path: repoRelative(packageRoot, repoRoot, path),
    lines: coveragePercentageFromCounts(summary.total.lines),
    statements: coveragePercentageFromCounts(summary.total.statements),
    branches: coveragePercentageFromCounts(summary.total.branches),
    functions: coveragePercentageFromCounts(summary.total.functions),
    uncovered: toCoverageUncoveredCounts(summary.total),
    files,
  });
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
    // A lab that illegally defines a coverage script must never enter the
    // snapshot/replacement universe (goals/lab-apps-lifecycle D2).
    A.filter((info) => hasCoverageScript(info) && !isLabsWorkspacePath(info.path)),
    A.sort(Order.mapInput(Order.String, (info: WorkspacePackageInfo) => info.name))
  );
});

const readCoverageSummary = Effect.fn("CoverageRegression.readCoverageSummary")(function* (
  summaryPath: string
): Effect.fn.Return<VitestCoverageSummary, CoverageRegressionError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(summaryPath)
    .pipe(QualityTaskConfigurationError.mapError(`Failed to read coverage summary ${summaryPath}.`));

  return yield* decodeVitestCoverageSummary(text).pipe(
    Effect.mapError((cause) => coverageConfigurationError(`Failed to parse coverage summary ${summaryPath}.`, cause))
  );
});

/**
 * Decode a Vitest coverage summary into the package baseline shape.
 *
 * **Details**
 *
 * This test seam exercises the same JSON boundary and repo-relative file-path
 * normalization used by snapshot collection without requiring a workspace
 * discovery fixture.
 *
 * **Example** (Decode one file summary)
 *
 * ```ts
 * import { coveragePackageBaselineFromSummaryForTesting } from "@beep/repo-cli/test/Quality"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import { Effect } from "effect"
 *
 * const covered = { covered: 1, pct: 100, skipped: 0, total: 1 }
 * const summaryText = JSON.stringify({
 *   total: { branches: covered, functions: covered, lines: covered, statements: covered },
 *   "src/index.ts": { branches: covered, functions: covered, lines: covered, statements: covered },
 * })
 * const program = coveragePackageBaselineFromSummaryForTesting(
 *   "/repo",
 *   "/repo/packages/example",
 *   summaryText
 * ).pipe(
 *   Effect.provide(NodePath.layer),
 *   Effect.map((baseline) => baseline.files["packages/example/src/index.ts"]?.lines)
 * )
 *
 * Effect.runPromise(program).then(console.log) // 100
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param packageRoot - Absolute workspace package root used for relative summary keys.
 * @param summaryText - JSON text emitted by Vitest's coverage-summary reporter.
 * @returns Package coverage totals and per-file provenance.
 * @category testing
 * @since 0.0.0
 */
export const coveragePackageBaselineFromSummaryForTesting = Effect.fn(
  "CoverageRegression.coveragePackageBaselineFromSummaryForTesting"
)(function* (
  repoRoot: string,
  packageRoot: string,
  summaryText: string
): Effect.fn.Return<CoveragePackageBaseline, CoverageRegressionError, Path.Path> {
  const path = yield* Path.Path;
  const summary = yield* decodeVitestCoverageSummary(summaryText).pipe(
    Effect.mapError((cause) => coverageConfigurationError("Failed to parse coverage summary fixture.", cause))
  );
  return yield* toCoveragePackageBaseline(repoRoot, packageRoot, path, summary);
});

const maybeSnapshotEntry = Effect.fn("CoverageRegression.maybeSnapshotEntry")(function* (
  repoRoot: string,
  path: Path.Path,
  info: WorkspacePackageInfo
): Effect.fn.Return<O.Option<CoverageSnapshotEntry>, CoverageRegressionError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const summaryPath = coverageSummaryPath(path, info);
  const exists = yield* fs.exists(summaryPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return O.none();
  }

  const summary = yield* readCoverageSummary(summaryPath);
  return O.some({
    packageName: info.name,
    baseline: yield* toCoveragePackageBaseline(repoRoot, info.absolutePath, path, summary),
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
): Effect.fn.Return<ReadonlyArray<CoverageSnapshotEntry>, CoverageRegressionError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const packages = yield* workspaceCoveragePackages(repoRoot, path);
  const entries = yield* Effect.forEach(packages, (info) => maybeSnapshotEntry(repoRoot, path, info), {
    concurrency: 8,
  });

  return pipe(entries, A.getSomes, A.sort(packageByNameOrder));
});

const snapshotPackages = (entries: ReadonlyArray<CoverageSnapshotEntry>): Record<string, CoveragePackageBaseline> =>
  R.fromEntries(A.map(entries, (entry) => [entry.packageName, entry.baseline] as const));

const replaceMeasuredPackage = (
  packageNames: ReadonlyArray<string>,
  replaceAll: boolean
): ((packageName: string) => boolean) => {
  const changedNames = HashSet.fromIterable(packageNames);
  return Bool.match(replaceAll, {
    onTrue: () => thunkTrue,
    onFalse:
      () =>
      (packageName: string): boolean =>
        HashSet.has(changedNames, packageName),
  });
};

/**
 * Plan an unscoped coverage baseline write without reading files or running Git.
 *
 * **Details**
 *
 * Measured rows owned by changed files are adopted. Other measured packages
 * hold committed rows when present and are added when absent. Committed rows
 * absent from the validated full-workspace snapshot are pruned.
 *
 * **Gotchas**
 *
 * Full-run reasons describe measurement breadth only and never widen adoption.
 * `replaceAll` is the sole whole-document replacement path and overrides the
 * changed-owner set.
 *
 * **Example** (Hold an unchanged measured package)
 *
 * ```ts
 * import {
 *   CoverageBaselineChangeSet,
 *   CoveragePackageBaseline,
 *   CoverageSnapshotEntry,
 *   CoverageUncoveredCounts,
 *   planCoverageBaselineWrite
 * } from "@beep/repo-cli/test/Quality"
 *
 * const uncovered = CoverageUncoveredCounts.make({ branches: 0, functions: 0, lines: 0, statements: 0 })
 * const committed = CoveragePackageBaseline.make({
 *   path: "packages/example", branches: 80, functions: 80, lines: 80, statements: 80,
 *   uncovered, files: {}
 * })
 * const measured = CoveragePackageBaseline.make({ ...committed, lines: 90 })
 * const changeSet = CoverageBaselineChangeSet.make({
 *   baseDescription: "dirty worktree only",
 *   packageNames: [],
 *   fullReasons: []
 * })
 * const plan = planCoverageBaselineWrite(
 *   { "@beep/example": committed },
 *   [CoverageSnapshotEntry.make({ packageName: "@beep/example", baseline: measured })],
 *   changeSet,
 *   { replaceAll: false }
 * )
 * console.log(plan.packages["@beep/example"]?.lines) // 80
 * ```
 *
 * @param previousPackages - Package rows from the committed schema-v2 baseline.
 * @param entries - Full-workspace package rows measured by the current run.
 * @param changeSet - Changed-owner adoption set, full-run reasons, and comparison-base provenance.
 * @param options - Whether to replace every measured row regardless of changed ownership.
 * @returns Rows to write and one disposition for every measured or pruned package.
 * @category utilities
 * @since 0.0.0
 */
export const planCoverageBaselineWrite: {
  (
    entries: ReadonlyArray<CoverageSnapshotEntry>,
    changeSet: CoverageBaselineChangeSet,
    options: { readonly replaceAll: boolean }
  ): (previousPackages: Record<string, CoveragePackageBaseline>) => CoverageBaselineWritePlan;
  (
    previousPackages: Record<string, CoveragePackageBaseline>,
    entries: ReadonlyArray<CoverageSnapshotEntry>,
    changeSet: CoverageBaselineChangeSet,
    options: { readonly replaceAll: boolean }
  ): CoverageBaselineWritePlan;
} = dual(
  4,
  (
    previousPackages: Record<string, CoveragePackageBaseline>,
    entries: ReadonlyArray<CoverageSnapshotEntry>,
    changeSet: CoverageBaselineChangeSet,
    options: { readonly replaceAll: boolean }
  ): CoverageBaselineWritePlan => {
    const measuredNames = HashSet.fromIterable(A.map(entries, (entry) => entry.packageName));
    const shouldReplace = replaceMeasuredPackage(changeSet.packageNames, options.replaceAll);
    const packages = R.empty<string, CoveragePackageBaseline>();
    const dispositions = R.empty<string, CoverageBaselineRowDisposition>();

    for (const entry of A.sort(entries, packageByNameOrder)) {
      if (shouldReplace(entry.packageName)) {
        R.assignProperty(packages, entry.packageName, entry.baseline);
        R.assignProperty(dispositions, entry.packageName, CoverageBaselineRowDisposition.Enum.replaced);
        continue;
      }

      pipe(
        R.get(previousPackages, entry.packageName),
        O.match({
          onNone: () => {
            R.assignProperty(packages, entry.packageName, entry.baseline);
            R.assignProperty(dispositions, entry.packageName, CoverageBaselineRowDisposition.Enum.added);
          },
          onSome: (committed) => {
            R.assignProperty(packages, entry.packageName, committed);
            R.assignProperty(dispositions, entry.packageName, CoverageBaselineRowDisposition.Enum.held);
          },
        })
      );
    }

    for (const packageName of A.sort(R.keys(previousPackages), Order.String)) {
      if (!HashSet.has(measuredNames, packageName)) {
        R.assignProperty(dispositions, packageName, CoverageBaselineRowDisposition.Enum.pruned);
      }
    }

    return CoverageBaselineWritePlan.make({ changeSet, dispositions, packages });
  }
);

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
export const mergeCoverageBaselinePackagesForTesting: {
  (
    entries: ReadonlyArray<CoverageSnapshotEntry>
  ): (previous: Record<string, CoveragePackageBaseline>) => Record<string, CoveragePackageBaseline>;
  (
    previous: Record<string, CoveragePackageBaseline>,
    entries: ReadonlyArray<CoverageSnapshotEntry>
  ): Record<string, CoveragePackageBaseline>;
} = dual(
  2,
  (
    previous: Record<string, CoveragePackageBaseline>,
    entries: ReadonlyArray<CoverageSnapshotEntry>
  ): Record<string, CoveragePackageBaseline> => ({ ...previous, ...snapshotPackages(entries) })
);

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
export const baselineEntriesLostByReplacement: {
  (
    measuredNames: ReadonlyArray<string>,
    workspaceNames: ReadonlyArray<string>
  ): (previousNames: ReadonlyArray<string>) => ReadonlyArray<string>;
  (
    previousNames: ReadonlyArray<string>,
    measuredNames: ReadonlyArray<string>,
    workspaceNames: ReadonlyArray<string>
  ): ReadonlyArray<string>;
} = dual(
  3,
  (
    previousNames: ReadonlyArray<string>,
    measuredNames: ReadonlyArray<string>,
    workspaceNames: ReadonlyArray<string>
  ): ReadonlyArray<string> =>
    pipe(
      previousNames,
      A.filter((name) => !A.contains(measuredNames, name) && A.contains(workspaceNames, name)),
      A.sort(Order.String)
    )
);

const coverageBaselineGitAdapter: GitCommandErrorAdapter<QualityTaskConfigurationError> = {
  onSpawnFailure: (commandLine) => (cause) =>
    QualityTaskConfigurationError.new(`Failed to run ${commandLine}: ${Inspectable.toStringUnknown(cause, 0)}`),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    QualityTaskConfigurationError.new(`${commandLine} failed with exit code ${exitCode}.`),
  onTruncated: O.none(),
};

const packageBaselineEquivalence = S.toEquivalence(CoveragePackageBaseline);
const tieredMinimumEquivalence = S.toEquivalence(CoverageTieredMinimum);
const rationaleRecordEquivalence = S.toEquivalence(S.Record(S.String, S.NonEmptyString));

/**
 * Name the packages whose baseline rows differ between two baseline documents,
 * when nothing else in the document differs.
 *
 * **Details**
 *
 * A baseline edit that only touches `packages` rows can be validated by
 * measuring exactly those packages, so the pull-request planner keeps such a
 * change scoped instead of falling back to the full workspace run. Any change
 * to `epsilon`, `minimum`, `exemptions`, or `follow_ups` alters how every row
 * is judged and yields `None`, which the planner treats as a global input.
 * Provenance fields (`generated_at`, `git_sha`, `command`) never affect the
 * verdict and are ignored.
 *
 * **Example** (One changed row)
 *
 * ```ts
 * import {
 *   coverageBaselineRowDelta,
 *   CoveragePackageBaseline,
 *   CoverageRegressionBaseline,
 *   CoverageUncoveredCounts
 * } from "@beep/repo-cli/test/Quality"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * import { Percentage } from "@beep/schema/Percentage"
 *
 * const pct = (value: number) => ({
 *   lines: Percentage.make(value),
 *   statements: Percentage.make(value),
 *   branches: Percentage.make(value),
 *   functions: Percentage.make(value)
 * })
 * const row = (value: number) =>
 *   CoveragePackageBaseline.make({
 *     path: "packages/example",
 *     ...pct(value),
 *     uncovered: CoverageUncoveredCounts.make({
 *       lines: NonNegativeInt.make(0),
 *       statements: NonNegativeInt.make(0),
 *       branches: NonNegativeInt.make(0),
 *       functions: NonNegativeInt.make(0)
 *     }),
 *     files: {}
 *   })
 * const document = (value: number) =>
 *   CoverageRegressionBaseline.make({
 *     schema_version: 2,
 *     generated_at: "2026-08-25T00:00:00.000Z",
 *     git_sha: "example",
 *     command: "bun run coverage:baseline:write",
 *     epsilon: 0.001,
 *     minimum: pct(0),
 *     exemptions: {},
 *     follow_ups: {},
 *     packages: { "@beep/example": row(value) }
 *   })
 *
 * console.log(coverageBaselineRowDelta(document(50), document(60))) // Some({ present: ["@beep/example"], removed: [] })
 * ```
 *
 * @param previous - Baseline document at the comparison base.
 * @param current - Baseline document under test.
 * @returns Sorted present (added or changed) and removed row package names; `None` when a non-row field changed.
 * @category utilities
 * @since 0.0.0
 */
export const coverageBaselineRowDelta: {
  (current: CoverageRegressionBaseline): (previous: CoverageRegressionBaseline) => O.Option<CoverageBaselineRowDelta>;
  (previous: CoverageRegressionBaseline, current: CoverageRegressionBaseline): O.Option<CoverageBaselineRowDelta>;
} = dual(
  2,
  (previous: CoverageRegressionBaseline, current: CoverageRegressionBaseline): O.Option<CoverageBaselineRowDelta> => {
    if (
      previous.epsilon !== current.epsilon ||
      !tieredMinimumEquivalence(previous.minimum, current.minimum) ||
      !rationaleRecordEquivalence(previous.exemptions, current.exemptions) ||
      !rationaleRecordEquivalence(previous.follow_ups, current.follow_ups)
    ) {
      return O.none();
    }

    // A present row is added or changed relative to the base; a removed row
    // exists only at the base.
    const presentDiffers = ([packageName, after]: readonly [string, CoveragePackageBaseline]): boolean =>
      O.match(R.get(previous.packages, packageName), {
        onNone: thunkTrue,
        onSome: (before) => !packageBaselineEquivalence(before, after),
      });

    return O.some(
      CoverageBaselineRowDelta.make({
        present: pipe(
          R.toEntries(current.packages),
          A.filter(presentDiffers),
          A.map(([packageName]) => packageName),
          A.sort(Order.String)
        ),
        removed: pipe(
          R.keys(previous.packages),
          A.filter((packageName) => !R.has(current.packages, packageName)),
          A.sort(Order.String)
        ),
      })
    );
  }
);

/**
 * Compute {@link coverageBaselineRowDelta} between the committed base revision
 * and the baseline currently on disk.
 *
 * **Details**
 *
 * Any failure to obtain or decode either side — the file is absent at the base,
 * the base is a legacy schema-v1 document, the working copy does not parse —
 * yields `None`, so the caller's only safe interpretation is "treat the
 * baseline as a global coverage input".
 *
 * **Example** (Build the delta effect)
 *
 * ```ts
 * import { coverageBaselineRowDeltaFromBase } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(coverageBaselineRowDeltaFromBase(process.cwd(), "origin/main"))) // true
 * ```
 *
 * @param repoRoot - Repository root.
 * @param base - Git revision the pull request is compared against.
 * @returns Package names whose rows changed, or `None` when the change is not row-only.
 * @category utilities
 * @since 0.0.0
 */
export const coverageBaselineRowDeltaFromBase = Effect.fn("CoverageRegression.coverageBaselineRowDeltaFromBase")(
  function* (
    repoRoot: string,
    base: string
  ): Effect.fn.Return<
    O.Option<CoverageBaselineRowDelta>,
    never,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > {
    // Changed-file discovery diffs `base...HEAD`, i.e. from the merge base, so
    // the document must come from that same commit: reading the ref's tip would
    // compare against rows main changed after this branch diverged.
    const previous = yield* resolveGitMergeBase(repoRoot, base, "HEAD", coverageBaselineGitAdapter).pipe(
      Effect.flatMap((mergeBase) =>
        runGitRawOutput(
          repoRoot,
          ["show", `${mergeBase}:${coverageRegressionBaselinePath}`],
          coverageBaselineGitAdapter
        )
      ),
      Effect.flatMap(decodeJsoncTextAs(CoverageRegressionBaseline)),
      Effect.option
    );
    const current = yield* Effect.option(readBaseline(repoRoot));
    return O.flatMap(O.all([previous, current]), ([before, after]) => coverageBaselineRowDelta(before, after));
  }
);

/**
 * Remove the generated baseline artifact from the writer's changed-file input.
 *
 * **Details**
 *
 * The baseline remains a global input for ordinary affected coverage planning.
 * Only regeneration planning ignores it, so rerunning the writer does not make
 * its own prior output authorize package-row adoption or a full-reason notice.
 *
 * **Example** (Ignore the writer's own output)
 *
 * ```ts
 * import { coverageBaselineWriterChangedFiles } from "@beep/repo-cli/test/Quality"
 *
 * console.log(
 *   coverageBaselineWriterChangedFiles([
 *     "standards/coverage.regression-baseline.jsonc",
 *     "packages/example/src/Index.ts"
 *   ])
 * ) // ["packages/example/src/Index.ts"]
 * ```
 *
 * @param changedFiles - Repository-relative changed paths collected for regeneration planning.
 * @returns Changed paths excluding the coverage baseline artifact.
 * @category filtering
 * @since 0.0.0
 */
export const coverageBaselineWriterChangedFiles: (changedFiles: ReadonlyArray<string>) => ReadonlyArray<string> =
  A.filter((filePath) => !Str.equivalence(filePath, coverageRegressionBaselinePath));

const coverageBaselineChangeSetFromChangedFiles = Effect.fn(
  "CoverageRegression.coverageBaselineChangeSetFromChangedFiles"
)(function* (
  repoRoot: string,
  changedFiles: ReadonlyArray<string>,
  baseDescription: string
): Effect.fn.Return<CoverageBaselineChangeSet, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const writerChangedFiles = coverageBaselineWriterChangedFiles(changedFiles);
  const owners = yield* workspaceCoverageScopeOwners(repoRoot);
  const scope = planCoverageAffectedScope(owners, writerChangedFiles);
  const fullReasons = Match.value(scope).pipe(
    Match.discriminatorsExhaustive("_tag")({
      full: ({ reasons }) => reasons,
      selected: A.empty<string>,
      noop: A.empty<string>,
    })
  );

  return CoverageBaselineChangeSet.make({
    baseDescription,
    packageNames: changedCoverageOwners(owners, writerChangedFiles),
    fullReasons,
  });
});

const coverageBaselineChangeSetFromBase = Effect.fn("CoverageRegression.coverageBaselineChangeSetFromBase")(function* (
  repoRoot: string,
  base: string,
  baseDescription: string
): Effect.fn.Return<
  CoverageBaselineChangeSet,
  QualityTaskConfigurationError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const changedFiles = yield* collectChangedFiles(repoRoot, base, "HEAD").pipe(
    QualityTaskConfigurationError.mapError(`Failed to collect coverage baseline files from ${base}...HEAD.`)
  );
  return yield* coverageBaselineChangeSetFromChangedFiles(repoRoot, changedFiles, baseDescription);
});

const originMainMergeBase = Effect.fn("CoverageRegression.originMainMergeBase")(function* (
  repoRoot: string
): Effect.fn.Return<O.Option<string>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const originMain = yield* Effect.option(resolveGitCommit(repoRoot, "origin/main", coverageBaselineGitAdapter));
  return yield* O.match(originMain, {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: () => Effect.option(resolveGitMergeBase(repoRoot, "origin/main", "HEAD", coverageBaselineGitAdapter)),
  });
});

const collectCoverageBaselineChangeSet = Effect.fn("CoverageRegression.collectCoverageBaselineChangeSet")(function* (
  repoRoot: string
): Effect.fn.Return<
  CoverageBaselineChangeSet,
  QualityTaskConfigurationError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const configuredBase = yield* configStringOption("TURBO_SCM_BASE");
  if (O.isSome(configuredBase)) {
    const configuredCommit = yield* Effect.option(
      resolveGitCommit(repoRoot, configuredBase.value, coverageBaselineGitAdapter)
    );
    if (O.isSome(configuredCommit)) {
      return yield* coverageBaselineChangeSetFromBase(
        repoRoot,
        configuredBase.value,
        `TURBO_SCM_BASE ${configuredBase.value}`
      );
    }

    yield* Console.log(
      `[coverage-ratchet] TURBO_SCM_BASE ${configuredBase.value} does not resolve here; falling back to origin/main merge-base or dirty-worktree files only`
    );
  }

  const mergeBase = yield* originMainMergeBase(repoRoot);
  if (O.isSome(mergeBase)) {
    return yield* coverageBaselineChangeSetFromBase(
      repoRoot,
      mergeBase.value,
      `origin/main merge-base ${Str.slice(0, 7)(mergeBase.value)}`
    );
  }

  yield* Console.log("[coverage-ratchet] no comparison base resolved; using dirty-worktree files only");
  const changedFiles = yield* collectDirtyWorktreeFiles(repoRoot, {
    diffArgs: ["--no-renames"],
    pathspecs: A.empty(),
    onProbeFailure: "fail",
  }).pipe(
    Effect.map(flow(A.dedupe, A.sort(Order.String))),
    QualityTaskConfigurationError.mapError("Failed to collect dirty-worktree files for coverage baseline planning.")
  );
  return yield* coverageBaselineChangeSetFromChangedFiles(repoRoot, changedFiles, "dirty worktree only");
});

const baselineDocumentFromSnapshot = Effect.fn("CoverageRegression.baselineDocumentFromSnapshot")(function* (
  repoRoot: string,
  entries: ReadonlyArray<CoverageSnapshotEntry>,
  previous: O.Option<CoverageRegressionBaselineDocument>,
  scoped: boolean,
  writePlan: O.Option<CoverageBaselineWritePlan> = O.none()
): Effect.fn.Return<
  CoverageRegressionBaseline,
  QualityTaskConfigurationError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const currentPrevious = pipe(previous, O.filter(isCurrentCoverageRegressionBaseline));
  const heldRow = pipe(
    writePlan,
    O.exists((plan) => A.some(R.values(plan.dispositions), (disposition) => disposition === "held"))
  );
  const inheritedMetadata = scoped || heldRow ? currentPrevious : O.none<CoverageRegressionBaseline>();
  const generatedAt = O.isSome(inheritedMetadata)
    ? inheritedMetadata.value.generated_at
    : yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const gitSha = O.isSome(inheritedMetadata) ? inheritedMetadata.value.git_sha : yield* readGitSha(repoRoot);

  return CoverageRegressionBaseline.make({
    schema_version: 2,
    // Holding any committed row means this run did not measure the provenance
    // of the whole document. Only a write that holds no row earns fresh
    // metadata; scoped merges and held-row plans inherit the last one.
    generated_at: generatedAt,
    git_sha: gitSha,
    command: coverageRegressionRegenerationCommand,
    epsilon: coverageRegressionEpsilon,
    minimum: pipe(
      previous,
      O.map((document) => document.minimum),
      O.getOrElse(() => defaultCoverageTieredMinimum)
    ),
    exemptions: pipe(
      previous,
      O.map((document) => document.exemptions),
      O.getOrElse(() => defaultCoverageExemptions)
    ),
    follow_ups: pipe(
      previous,
      O.map((document) => document.follow_ups),
      O.getOrElse(() => ({}))
    ),
    packages: pipe(
      writePlan,
      O.map((plan) => plan.packages),
      O.getOrElse(() =>
        scoped && O.isSome(currentPrevious)
          ? mergeCoverageBaselinePackagesForTesting(currentPrevious.value.packages, entries)
          : snapshotPackages(entries)
      )
    ),
  });
});

const readBaseline = Effect.fn("CoverageRegression.readBaseline")(function* (
  repoRoot: string
): Effect.fn.Return<CoverageRegressionBaseline, CoverageRegressionError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const baselinePath = path.join(repoRoot, coverageRegressionBaselinePath);
  return yield* readArtifact({
    path: baselinePath,
    schema: CoverageRegressionBaseline,
    onReadError: baselineReadError,
    onDecodeError: baselineDecodeError,
  });
});

const readComparisonBaseline = Effect.fn("CoverageRegression.readComparisonBaseline")(function* (
  repoRoot: string
): Effect.fn.Return<
  CoverageRegressionBaseline,
  CoverageRegressionError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const configuredBase = yield* configStringOption("TURBO_SCM_BASE");
  return yield* O.match(configuredBase, {
    onNone: () => readBaseline(repoRoot),
    onSome: Effect.fn("CoverageRegression.readBaseComparisonBaseline")(function* (base) {
      const baseBaseline = yield* runGitRawOutput(
        repoRoot,
        ["show", `${base}:${coverageRegressionBaselinePath}`],
        coverageBaselineGitAdapter
      ).pipe(
        Effect.flatMap(decodeJsoncTextAs(CoverageRegressionBaseline)),
        Effect.mapError((cause) =>
          coverageConfigurationError(`Failed to read the coverage comparison baseline from ${base}`, cause)
        )
      );
      const workspaceBaseline = yield* readBaseline(repoRoot);
      return CoverageRegressionBaseline.make({
        ...baseBaseline,
        packages: R.map(baseBaseline.packages, (basePackage, packageName) =>
          pipe(
            R.get(workspaceBaseline.packages, packageName),
            O.map((workspacePackage) =>
              CoveragePackageBaseline.make({
                ...basePackage,
                // Base floors remain authoritative; the reviewed workspace
                // baseline contributes identity only for newly added files
                // and removes identities for source files deleted since the
                // comparison base.
                files: {
                  ...workspacePackage.files,
                  ...R.filter(basePackage.files, (_, filePath) => R.has(workspacePackage.files, filePath)),
                },
              })
            ),
            O.getOrElse(() => basePackage)
          )
        ),
      });
    }),
  });
});

/**
 * Read the base-pinned baseline used by a coverage comparison.
 *
 * **Example** (Build the comparison read)
 *
 * ```ts
 * import { readCoverageComparisonBaselineForTesting } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readCoverageComparisonBaselineForTesting("/repo"))) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const readCoverageComparisonBaselineForTesting = readComparisonBaseline;

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
  O.Option<CoverageRegressionBaselineDocument>,
  CoverageRegressionError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const baselinePath = path.join(repoRoot, coverageRegressionBaselinePath);
  const exists = yield* fs.exists(baselinePath).pipe(Effect.orElseSucceed(thunkFalse));

  if (!exists) {
    return O.none();
  }

  return O.some(
    yield* readArtifact({
      path: baselinePath,
      schema: CoverageRegressionBaselineDocument,
      onReadError: baselineReadError,
      onDecodeError: baselineDecodeError,
    })
  );
});

const formatBaseline = Effect.fn("CoverageRegression.formatBaseline")(function* (
  baseline: CoverageRegressionBaseline
): Effect.fn.Return<string, QualityTaskConfigurationError> {
  // `formatJsonc` stringifies whatever it is handed, so the document has to be
  // encoded first. The v2 domain uses branded percentages, counts, and path
  // keys whose wire representation remains plain JSON scalars and records.
  const encoded = yield* S.encodeEffect(CoverageRegressionBaseline)(baseline).pipe(
    QualityTaskConfigurationError.mapError("Failed to encode coverage regression baseline.")
  );
  const jsonc = yield* formatJsonc(encoded).pipe(
    QualityTaskConfigurationError.mapError("Failed to format coverage regression baseline.")
  );
  return [
    "// Coverage regression baseline. Do not edit by hand.",
    `// Regenerate the rows you changed with: ${coverageScopedBaselineWriteCommand(["<package>"])}`,
    `// Regenerate the whole document with: ${coverageRegressionRegenerationCommand}`,
    "// Epsilon: 0.001 percentage points; only smaller floating-point noise is ignored.",
    jsonc,
  ].join("\n");
});

const writeBaselineDocument = Effect.fn("CoverageRegression.writeBaselineDocument")(function* (
  repoRoot: string,
  baseline: CoverageRegressionBaseline
): Effect.fn.Return<void, CoverageRegressionError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const content = yield* formatBaseline(baseline);
  yield* writeArtifact({
    path: path.join(repoRoot, coverageRegressionBaselinePath),
    body: content,
    onError: (cause) =>
      QualityTaskConfigurationError.new(
        `Failed to write ${coverageRegressionBaselinePath}.: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
  });
});

const missingCoverageSnapshotPackages = (
  entries: ReadonlyArray<CoverageSnapshotEntry>,
  expectedPackageNames: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    expectedPackageNames,
    A.filter((packageName) => !A.some(entries, (entry) => entry.packageName === packageName)),
    A.dedupe,
    A.sort(Order.String)
  );

const validateCoverageSnapshotCompleteness = Effect.fn("CoverageRegression.validateCoverageSnapshotCompleteness")(
  function* (entries: ReadonlyArray<CoverageSnapshotEntry>, expectedPackageNames: ReadonlyArray<string>) {
    if (A.isReadonlyArrayEmpty(entries)) {
      return yield* QualityTaskConfigurationError.new("No coverage summaries were generated; cannot write baseline.");
    }

    const missingExpected = missingCoverageSnapshotPackages(entries, expectedPackageNames);
    if (A.isReadonlyArrayNonEmpty(missingExpected)) {
      return yield* QualityTaskConfigurationError.new(
        `Refusing to write ${coverageRegressionBaselinePath}: ${A.length(missingExpected)} selected package(s) produced no coverage summary: ${A.join(missingExpected, ", ")}. Re-run the scoped coverage command and fix every missing summary before regenerating the baseline.`
      );
    }
  }
);

const coverageBaselineDispositionCount = (
  plan: CoverageBaselineWritePlan,
  disposition: CoverageBaselineRowDisposition
): number => A.length(A.filter(R.values(plan.dispositions), (candidate) => candidate === disposition));

/**
 * Render the operator-facing disposition summary for an unscoped baseline write.
 *
 * **Details**
 *
 * Ordinary writes always report the replaced, added, held, and pruned split.
 * Planner full-run reasons are appended as measurement context without
 * changing the disposition wording.
 *
 * **Gotchas**
 *
 * The `--replace-all` form has its own whole-document summary. Full-run reasons
 * alone retain the changed-owner summary and recommend that explicit escape
 * hatch when every floor truly should be re-measured.
 *
 * **Example** (Summarize a held-row plan)
 *
 * ```ts
 * import {
 *   CoverageBaselineChangeSet,
 *   CoverageBaselineWritePlan,
 *   coverageBaselineWriteSummary
 * } from "@beep/repo-cli/test/Quality"
 *
 * const plan = CoverageBaselineWritePlan.make({
 *   changeSet: CoverageBaselineChangeSet.make({
 *     baseDescription: "dirty worktree only",
 *     packageNames: [],
 *     fullReasons: []
 *   }),
 *   packages: {},
 *   dispositions: {}
 * })
 * console.log(coverageBaselineWriteSummary(plan, false))
 * ```
 *
 * @param plan - Planned package rows, dispositions, and change-set context.
 * @param replaceAll - Whether the operator explicitly requested whole-document replacement.
 * @returns One complete coverage-ratchet console line.
 * @category utilities
 * @since 0.0.0
 */
export const coverageBaselineWriteSummary: {
  (replaceAll: boolean): (plan: CoverageBaselineWritePlan) => string;
  (plan: CoverageBaselineWritePlan, replaceAll: boolean): string;
} = dual(2, (plan: CoverageBaselineWritePlan, replaceAll: boolean): string => {
  const replaced = coverageBaselineDispositionCount(plan, CoverageBaselineRowDisposition.Enum.replaced);
  const added = coverageBaselineDispositionCount(plan, CoverageBaselineRowDisposition.Enum.added);
  const held = coverageBaselineDispositionCount(plan, CoverageBaselineRowDisposition.Enum.held);
  const pruned = coverageBaselineDispositionCount(plan, CoverageBaselineRowDisposition.Enum.pruned);
  const changedOwnerSummary =
    `[coverage-ratchet] wrote ${coverageRegressionBaselinePath}: replaced ${replaced} changed package(s), ` +
    `added ${added}, held ${held} unchanged package(s) at committed rows, pruned ${pruned} ` +
    `(base: ${plan.changeSet.baseDescription})`;
  const fullReasonNotice = A.match(plan.changeSet.fullReasons, {
    onEmpty: () => "",
    onNonEmpty: (reasons) =>
      ` — global coverage inputs changed (${A.join(reasons, "; ")}); pass --replace-all if every floor should be re-measured`,
  });

  return Bool.match(replaceAll, {
    onTrue: () =>
      `[coverage-ratchet] wrote ${coverageRegressionBaselinePath}: replaced all ${replaced} package(s), pruned ${pruned} (--replace-all; base: ${plan.changeSet.baseDescription})`,
    onFalse: () => `${changedOwnerSummary}${fullReasonNotice}`,
  });
});

/**
 * Write the committed coverage regression baseline from generated summaries.
 *
 * **Details**
 *
 * A scoped run measures only the packages it was filtered to, so its snapshot
 * is merged over the committed document and every unmeasured entry is carried
 * through. An unscoped schema-v2 write adopts measured rows only for workspace
 * owners of changed files, holds committed rows for every other measured
 * package, adds new packages, and prunes deleted packages. The affected planner
 * still determines measurement breadth, while `replaceAll` is the only path
 * that adopts the whole measured document.
 *
 * **Gotchas**
 *
 * An unscoped run that measured fewer live packages than the committed document
 * is refused rather than planned. A full-run planner verdict never expands the
 * adoption set. Within a changed package the whole measured row is adopted, so
 * environment-dependent file rows there may still need manual pinning to the
 * hosted figure.
 *
 * **Example** (Build an unscoped write effect)
 *
 * ```ts
 * import { writeCoverageRegressionBaseline } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const write = writeCoverageRegressionBaseline("/repo", false)
 * console.log(Effect.isEffect(write)) // true
 * ```
 *
 * @param repoRoot - Repository root.
 * @param scoped - Whether the coverage run was intentionally filtered or affected-scoped.
 * @param expectedPackageNames - Exact scoped package names that must emit summaries before the baseline is written.
 * @param options - Optional escape hatch for replacing every measured package row.
 * @category use-cases
 * @since 0.0.0
 */
export const writeCoverageRegressionBaseline = Effect.fn("CoverageRegression.writeCoverageRegressionBaseline")(
  function* (
    repoRoot: string,
    scoped: boolean,
    expectedPackageNames: ReadonlyArray<string> = A.empty<string>(),
    options: { readonly replaceAll?: boolean } = {}
  ): Effect.fn.Return<
    void,
    CoverageRegressionError,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > {
    const path = yield* Path.Path;
    const entries = yield* collectCoverageSnapshot(repoRoot);
    yield* validateCoverageSnapshotCompleteness(entries, expectedPackageNames);

    // Absent and unreadable are different answers. Collapsing a read or decode
    // failure into "no previous document" would take the snapshot-only branch
    // and overwrite a baseline that merely failed to parse, so only a genuinely
    // missing file yields `None`; anything else propagates.
    const previous = yield* readPreviousBaseline(repoRoot);
    const replaceAll = options.replaceAll === true;

    if (
      scoped &&
      pipe(
        previous,
        O.exists((document) => !isCurrentCoverageRegressionBaseline(document))
      )
    ) {
      return yield* QualityTaskConfigurationError.new(
        `Refusing to write ${coverageRegressionBaselinePath}: schema version 1 requires a full ${coverageRegressionRegenerationCommand} run before scoped baseline updates can be merged.`
      );
    }

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
          `Refusing to write ${coverageRegressionBaselinePath}: an unscoped regeneration requires a complete workspace snapshot, and ${A.length(lost)} package(s) recorded in the baseline are still in the workspace but produced no coverage summary in this run: ${A.join(lost, ", ")}. Re-run coverage across the whole workspace, or pass a turbo filter so the run is treated as scoped and merged instead. Packages that no longer exist are pruned normally and do not trigger this.`
        );
      }
    }

    const currentPrevious = pipe(previous, O.filter(isCurrentCoverageRegressionBaseline));
    const writePlan =
      !scoped && O.isSome(currentPrevious)
        ? O.some(
            planCoverageBaselineWrite(
              currentPrevious.value.packages,
              entries,
              yield* collectCoverageBaselineChangeSet(repoRoot),
              { replaceAll }
            )
          )
        : O.none<CoverageBaselineWritePlan>();
    const baseline = yield* baselineDocumentFromSnapshot(repoRoot, entries, previous, scoped, writePlan);
    yield* writeBaselineDocument(repoRoot, baseline);
    yield* Console.log(
      scoped
        ? `[coverage-ratchet] merged ${A.length(entries)} measured package(s) into ${coverageRegressionBaselinePath} (${R.size(baseline.packages)} total)`
        : pipe(
            writePlan,
            O.map((plan) => coverageBaselineWriteSummary(plan, replaceAll)),
            O.getOrElse(
              () => `[coverage-ratchet] wrote ${coverageRegressionBaselinePath} with ${A.length(entries)} package(s)`
            )
          )
    );
  }
);

/**
 * Remove one workspace's rows from the committed coverage regression baseline
 * without re-measuring coverage.
 *
 * **Details**
 *
 * Deleting a leaf workspace cannot change any other package's coverage — the
 * delete path only admits targets with an empty dependents cascade — so the
 * correct baseline update is exactly the removal of that workspace's
 * `packages`, `exemptions`, and `follow_ups` rows, which is what an unscoped
 * regeneration would produce for those rows without the repo-wide coverage
 * run it costs. The edit is strictly delete-only: every surviving row and the
 * document's provenance fields (`generated_at`, `git_sha`) are carried through
 * byte-identically, matching how scoped merges inherit provenance.
 *
 * **Gotchas**
 *
 * A missing baseline and a baseline with no rows for the package are both
 * successful no-ops — lab workspaces never enter the baseline at all, so the
 * lab delete path lands here by construction. A schema-version-1 document is
 * refused the same way scoped writes refuse it: v1 must be regenerated in
 * full before any row-level edit is meaningful.
 *
 * **Example** (Subtract a deleted workspace's rows)
 *
 * ```ts
 * import { subtractPackageFromCoverageRegressionBaseline } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = subtractPackageFromCoverageRegressionBaseline("/repo", "@beep/retired-driver")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Repository root.
 * @param packageName - Workspace package name (`@beep/...`) whose rows are removed.
 * @category use-cases
 * @since 0.0.0
 */
export const subtractPackageFromCoverageRegressionBaseline = Effect.fn(
  "CoverageRegression.subtractPackageFromCoverageRegressionBaseline"
)(function* (
  repoRoot: string,
  packageName: string
): Effect.fn.Return<void, CoverageRegressionError, FileSystem.FileSystem | Path.Path> {
  const previous = yield* readPreviousBaseline(repoRoot);

  if (O.isNone(previous)) {
    yield* Console.log(`[coverage-ratchet] no committed baseline exists; nothing to subtract for ${packageName}`);
    return;
  }

  const document = previous.value;
  if (!isCurrentCoverageRegressionBaseline(document)) {
    return yield* QualityTaskConfigurationError.new(
      `Refusing to edit ${coverageRegressionBaselinePath}: schema version 1 requires a full ${coverageRegressionRegenerationCommand} run before package rows can be subtracted.`
    );
  }

  const mentioned =
    R.has(document.packages, packageName) ||
    R.has(document.exemptions, packageName) ||
    R.has(document.follow_ups, packageName);
  if (!mentioned) {
    yield* Console.log(
      `[coverage-ratchet] ${coverageRegressionBaselinePath} carries no rows for ${packageName}; nothing to subtract`
    );
    return;
  }

  const next = CoverageRegressionBaseline.make({
    schema_version: document.schema_version,
    generated_at: document.generated_at,
    git_sha: document.git_sha,
    command: document.command,
    epsilon: document.epsilon,
    minimum: document.minimum,
    exemptions: R.remove(document.exemptions, packageName),
    follow_ups: R.remove(document.follow_ups, packageName),
    packages: R.remove(document.packages, packageName),
  });
  yield* writeBaselineDocument(repoRoot, next);
  yield* Console.log(
    `[coverage-ratchet] subtracted ${packageName} from ${coverageRegressionBaselinePath} (${R.size(next.packages)} package(s) remain)`
  );
});

const actualByPackageName = (actuals: ReadonlyArray<CoverageSnapshotEntry>) =>
  R.fromEntries(A.map(actuals, (entry) => [entry.packageName, entry] as const));

/**
 * Whether a metric's percentage drop reflects lost coverage rather than
 * deleted covered code.
 *
 * A percentage falls both when untested code is added and when tested code is
 * removed, and only the first is a regression. The uncovered count tells them
 * apart: deleting covered code leaves it flat, while genuine loss raises it. A
 * changed file set also makes a package drop fail closed; otherwise a rename,
 * removal, or move into a surviving file could hide lost coverage behind an
 * offsetting deletion.
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
  (actual.uncovered[metric] > baseline.uncovered[metric] ||
    A.some(R.keys(baseline.files), (filePath) => !R.has(actual.files, filePath)) ||
    A.some(R.keys(actual.files), (filePath) => !R.has(baseline.files, filePath)));

const droppedMetrics = (
  packageName: string,
  baseline: CoveragePackageBaseline,
  actual: CoveragePackageBaseline,
  epsilon: number
): ReadonlyArray<CoverageComparisonFailure> =>
  pipe(
    metricNames,
    A.filter((metric) => metricRegressed(metric, baseline, actual, epsilon)),
    A.map((metric) =>
      CoverageBaselineDropFailure.make({
        packageName,
        packagePath: baseline.path,
        filePath: O.none(),
        metric,
        baseline: baseline[metric],
        actual: actual[metric],
      })
    )
  );

const fileMetricRegressed = (
  metric: CoverageMetricName,
  baseline: CoverageFileBaseline,
  actual: CoverageFileBaseline,
  epsilon: number
): boolean => actual[metric] + epsilon < baseline[metric] && actual.uncovered[metric] > baseline.uncovered[metric];

const droppedFileMetrics = (
  packageName: string,
  packagePath: string,
  filePath: string,
  baseline: CoverageFileBaseline,
  actual: CoverageFileBaseline,
  epsilon: number
): ReadonlyArray<CoverageComparisonFailure> =>
  pipe(
    metricNames,
    A.filter((metric) => fileMetricRegressed(metric, baseline, actual, epsilon)),
    A.map((metric) =>
      CoverageBaselineDropFailure.make({
        packageName,
        packagePath,
        filePath: O.some(filePath),
        metric,
        baseline: baseline[metric],
        actual: actual[metric],
      })
    )
  );

const droppedDisappearedFileMetrics = (
  packageName: string,
  packagePath: string,
  filePath: string,
  baseline: CoverageFileBaseline
): ReadonlyArray<CoverageComparisonFailure> =>
  pipe(
    metricNames,
    A.filter((metric) => baseline[metric] > ZERO_PERCENTAGE),
    A.map((metric) =>
      CoverageBaselineDropFailure.make({
        packageName,
        packagePath,
        filePath: O.some(filePath),
        metric,
        baseline: baseline[metric],
        actual: ZERO_PERCENTAGE,
      })
    )
  );

const perFileDroppedMetrics = (
  packageName: string,
  baseline: CoveragePackageBaseline,
  actual: CoveragePackageBaseline,
  epsilon: number
): ReadonlyArray<CoverageComparisonFailure> =>
  pipe(
    R.toEntries(baseline.files),
    A.sort(coverageFileByPathOrder),
    A.flatMap(([filePath, fileBaseline]) =>
      pipe(
        actual.files,
        R.get(filePath),
        O.map((fileActual) =>
          droppedFileMetrics(packageName, baseline.path, filePath, fileBaseline, fileActual, epsilon)
        ),
        // A vanished path that carried covered units is identity-ambiguous: it
        // may be a deletion, rename, or move whose tests were lost. Fail closed
        // independently of the package aggregate's direction. Fully uncovered
        // vanished paths remain governed by the package comparison.
        O.getOrElse(() => droppedDisappearedFileMetrics(packageName, baseline.path, filePath, fileBaseline))
      )
    )
  );

const newFileUncoveredMetrics = (
  packageName: string,
  baseline: CoveragePackageBaseline,
  actual: CoveragePackageBaseline,
  epsilon: number
): ReadonlyArray<CoverageComparisonFailure> =>
  pipe(
    R.toEntries(actual.files),
    A.sort(coverageFileByPathOrder),
    A.filter(([filePath]) => !R.has(baseline.files, filePath)),
    A.flatMap(([filePath, fileActual]) =>
      pipe(
        metricNames,
        // When the package comparator already sees the regression, its real
        // package baseline is the truthful witness. A new-path witness is only
        // needed for the offset case where package totals would otherwise pass.
        A.filter((metric) => fileActual.uncovered[metric] > 0 && !metricRegressed(metric, baseline, actual, epsilon)),
        A.map((metric) =>
          CoverageNewUncoveredFileFailure.make({
            packageName,
            packagePath: baseline.path,
            filePath: O.some(filePath),
            metric,
            actual: fileActual[metric],
            uncovered: fileActual.uncovered[metric],
          })
        )
      )
    )
  );

const droppedCoverageMetrics = (
  packageName: string,
  baseline: CoveragePackageBaseline,
  actual: CoveragePackageBaseline,
  epsilon: number
): ReadonlyArray<CoverageComparisonFailure> => {
  const baselineFileFailures = perFileDroppedMetrics(packageName, baseline, actual, epsilon);
  const baselineFileFailureMetrics = A.map(baselineFileFailures, (failure) => failure.metric);
  const offsetNewFileFailures = pipe(
    newFileUncoveredMetrics(packageName, baseline, actual, epsilon),
    A.filter((failure) => !A.contains(baselineFileFailureMetrics, failure.metric))
  );
  const fileFailures = A.appendAll(baselineFileFailures, offsetNewFileFailures);
  const fileFailureMetrics = A.map(fileFailures, (failure) => failure.metric);
  const packageOnlyFailures = pipe(
    droppedMetrics(packageName, baseline, actual, epsilon),
    A.filter((failure) => !A.contains(fileFailureMetrics, failure.metric))
  );

  // Package totals still catch uncovered code in newly added files. Prefer the
  // file-level witness when both levels detect the same metric so diagnostics
  // are precise without being duplicated.
  return A.appendAll(fileFailures, packageOnlyFailures);
};

const isNamedFollowUp = (baseline: CoverageRegressionBaseline, packageName: string): boolean =>
  pipe(baseline.follow_ups, R.get(packageName), O.isSome);

const belowMinimumMetrics = (
  packageName: string,
  actual: CoveragePackageBaseline,
  minimum: CoverageTieredMinimum,
  epsilon: number
): ReadonlyArray<CoverageComparisonFailure> =>
  pipe(
    metricNames,
    A.filter((metric) => actual[metric] + epsilon < minimum[metric]),
    A.map((metric) =>
      CoverageBaselineDropFailure.make({
        packageName,
        packagePath: actual.path,
        filePath: O.none(),
        metric,
        baseline: minimum[metric],
        actual: actual[metric],
      })
    )
  );

const compareCoverage = (
  baseline: CoverageRegressionBaseline,
  actuals: ReadonlyArray<CoverageSnapshotEntry>,
  scoped: boolean,
  expectedPackageNames: ReadonlyArray<string> = A.empty<string>()
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
        O.map((actual) => droppedCoverageMetrics(packageName, packageBaseline, actual.baseline, baseline.epsilon)),
        O.getOrElse(A.empty<CoverageComparisonFailure>)
      )
    )
  );
  const minimumFailures = pipe(
    actuals,
    A.filter((actual) => !isNamedFollowUp(baseline, actual.packageName)),
    A.flatMap((actual) => belowMinimumMetrics(actual.packageName, actual.baseline, baseline.minimum, baseline.epsilon))
  );
  const missingActuals = missingCoverageSnapshotPackages(
    actuals,
    scoped ? expectedPackageNames : A.map(baselineEntries, ([packageName]) => packageName)
  );
  const newPackages = pipe(
    actuals,
    A.filter((actual) => pipe(baseline.packages, R.get(actual.packageName), O.isNone)),
    A.sort(packageByNameOrder)
  );
  const followUpDebt = pipe(
    actuals,
    A.filter((actual) => isNamedFollowUp(baseline, actual.packageName)),
    A.sort(packageByNameOrder)
  );

  return {
    comparedCount: A.length(actuals) - A.length(newPackages),
    failures,
    minimumFailures,
    missingActuals,
    newPackages,
    followUpDebt,
  };
};

/**
 * Pure coverage baseline comparison exposed for package-local tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const compareCoverageRegressionSnapshotsForTesting: {
  (
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    scoped: boolean
  ): (baseline: CoverageRegressionBaseline) => CoverageComparisonResult;
  (
    baseline: CoverageRegressionBaseline,
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    scoped: boolean
  ): CoverageComparisonResult;
} = dual(3, compareCoverage);

/**
 * Compare a scoped snapshot while requiring every explicitly selected package
 * to have emitted a coverage summary.
 *
 * **Example** (Require a selected package summary)
 *
 * ```ts
 * import {
 *   compareCoverageRegressionSnapshotsForExpectedPackagesForTesting,
 *   type CoverageRegressionBaseline,
 *   type CoverageSnapshotEntry
 * } from "@beep/repo-cli/test/Quality"
 *
 * declare const baseline: CoverageRegressionBaseline
 * declare const actuals: ReadonlyArray<CoverageSnapshotEntry>
 * const result = compareCoverageRegressionSnapshotsForExpectedPackagesForTesting(
 *   baseline,
 *   actuals,
 *   ["@beep/schema"]
 * )
 * console.log(result.missingActuals)
 * ```
 *
 * @param baseline - Committed coverage baseline.
 * @param actuals - Coverage summaries produced by the scoped run.
 * @param expectedPackageNames - Exact selected coverage owners.
 * @returns Regression, missing-summary, and new-package findings.
 * @category testing
 * @since 0.0.0
 */
export const compareCoverageRegressionSnapshotsForExpectedPackagesForTesting: {
  (
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    expectedPackageNames: ReadonlyArray<string>
  ): (baseline: CoverageRegressionBaseline) => CoverageComparisonResult;
  (
    baseline: CoverageRegressionBaseline,
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    expectedPackageNames: ReadonlyArray<string>
  ): CoverageComparisonResult;
} = dual(
  3,
  (
    baseline: CoverageRegressionBaseline,
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    expectedPackageNames: ReadonlyArray<string>
  ): CoverageComparisonResult => compareCoverage(baseline, actuals, true, expectedPackageNames)
);

const coverageFailureLocation = (failure: CoverageComparisonFailure): string =>
  pipe(
    failure.filePath,
    O.getOrElse(() => failure.packagePath),
    coverageDiagnosticFragment
  );

const renderCoverageFailure = (failure: CoverageComparisonFailure): string =>
  Match.value(failure).pipe(
    Match.tags({
      "baseline-drop": (drop) =>
        `  - ${coverageDiagnosticFragment(drop.packageName)} (${coverageFailureLocation(drop)}) ${drop.metric}: ${drop.actual} < ${drop.baseline}`,
      "new-uncovered-file": (newFile) =>
        `  - ${coverageDiagnosticFragment(newFile.packageName)} (${coverageFailureLocation(newFile)}) ${newFile.metric}: new file has ${newFile.uncovered} uncovered unit(s) at ${newFile.actual}% (no baseline file identity)`,
    }),
    Match.exhaustive
  );

/**
 * Render coverage comparison failures with bounded, control-free paths.
 *
 * **Example** (Render a baseline drop)
 *
 * ```ts
 * import { CoverageComparisonFailure, renderCoverageFailuresForTesting } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * const failure = S.decodeUnknownSync(CoverageComparisonFailure)({
 *   _tag: "baseline-drop",
 *   actual: 90,
 *   baseline: 95,
 *   filePath: "packages/example/src/index.ts",
 *   metric: "lines",
 *   packageName: "@beep/example",
 *   packagePath: "packages/example",
 * })
 *
 * console.log(renderCoverageFailuresForTesting([failure])[0])
 * ```
 *
 * @param failures - Typed coverage comparison failures.
 * @returns Operator-facing diagnostic lines.
 * @category testing
 * @since 0.0.0
 */
export const renderCoverageFailuresForTesting = (
  failures: ReadonlyArray<CoverageComparisonFailure>
): ReadonlyArray<string> => A.map(failures, renderCoverageFailure);

const renderNewPackageWarnings = (packages: ReadonlyArray<CoverageSnapshotEntry>): ReadonlyArray<string> =>
  A.map(
    packages,
    (entry) =>
      `  - ${coverageDiagnosticFragment(entry.packageName)} (${coverageDiagnosticFragment(entry.baseline.path)}) is missing from ${coverageRegressionBaselinePath}; run ${coverageRegressionRegenerationCommand} and review the baseline diff.`
  );

const renderFollowUpDebt = (
  baseline: CoverageRegressionBaseline,
  packages: ReadonlyArray<CoverageSnapshotEntry>
): ReadonlyArray<string> =>
  A.map(packages, (entry) => {
    const metrics = entry.baseline;
    const rationale = pipe(
      baseline.follow_ups,
      R.get(entry.packageName),
      O.getOrElse(() => "Named coverage debt follow-up.")
    );
    return sanitizeCoverageDiagnostic(
      `  - ${coverageDiagnosticFragment(entry.packageName)} (${coverageDiagnosticFragment(metrics.path)}) L/S/B/F ${metrics.lines}/${metrics.statements}/${metrics.branches}/${metrics.functions}: ${coverageDiagnosticFragment(rationale)}`
    );
  });

const renderCoverageExemptions = (exemptions: Record<string, string>): string =>
  sanitizeCoverageDiagnostic(
    `[coverage-minimum] named exemptions: ${A.join(
      A.map(
        R.toEntries(exemptions),
        ([name, rationale]) => `${coverageDiagnosticFragment(name)} (${coverageDiagnosticFragment(rationale)})`
      ),
      "; "
    )}`
  );

const regressionLines = (
  result: CoverageComparisonResult,
  dispositionGaps: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const sections = [
    ...A.match(result.failures, {
      onEmpty: A.empty<string>,
      onNonEmpty: (failures) => [
        "[coverage-ratchet] coverage regression(s) detected:",
        ...renderCoverageFailuresForTesting(failures),
      ],
    }),
    ...A.match(result.minimumFailures, {
      onEmpty: A.empty<string>,
      onNonEmpty: (failures) => [
        "[coverage-minimum] coverage is below the repository tiered minimum:",
        ...renderCoverageFailuresForTesting(failures),
      ],
    }),
    ...A.match(result.missingActuals, {
      onEmpty: A.empty<string>,
      onNonEmpty: (missing) => [
        "[coverage-ratchet] missing coverage summaries for required package(s):",
        ...A.map(missing, (packageName) => `  - ${coverageDiagnosticFragment(packageName)}`),
      ],
    }),
    ...A.match(dispositionGaps, {
      onEmpty: A.empty<string>,
      onNonEmpty: (gaps) => [
        "[coverage-minimum] workspace package(s) without coverage or a named exemption:",
        ...A.map(gaps, (packageName) => `  - ${coverageDiagnosticFragment(packageName)}`),
      ],
    }),
    ...renderCoverageRemediation(result),
  ];
  return sections;
};

const failurePackageNames = (failures: ReadonlyArray<CoverageComparisonFailure>): ReadonlyArray<string> =>
  pipe(
    A.map(failures, (failure) => failure.packageName),
    A.dedupe,
    A.sort(Order.String)
  );

/**
 * Render the remediation block the ratchet prints after a regression.
 *
 * **Details**
 *
 * Baseline regressions get the exact scoped regeneration command for the
 * regressed packages so an agent never reaches for the repo-wide writer, with
 * the two legitimate outcomes stated: restore the coverage, or accept the new
 * floors after review. Tier-minimum breaches get a restore-only hint: the
 * writer records floors, it cannot lift a package above the repository tier.
 * Missing summaries and disposition gaps get no command because they are
 * configuration problems, not floors.
 *
 * **Example** (Nothing regressed)
 *
 * ```ts
 * import { CoverageComparisonResult, renderCoverageRemediation } from "@beep/repo-cli/test/Quality"
 *
 * const clean = CoverageComparisonResult.make({
 *   comparedCount: 0,
 *   failures: [],
 *   minimumFailures: [],
 *   missingActuals: [],
 *   newPackages: [],
 *   followUpDebt: []
 * })
 * console.log(renderCoverageRemediation(clean)) // []
 * ```
 *
 * @param result - Comparison result the ratchet is about to enforce.
 * @returns Remediation lines, empty when no package floor regressed.
 * @category rendering
 * @since 0.0.0
 */
export const renderCoverageRemediation = (result: CoverageComparisonResult): ReadonlyArray<string> => [
  ...A.match(failurePackageNames(result.failures), {
    onEmpty: A.empty<string>,
    onNonEmpty: (packageNames) => [
      "[coverage-ratchet] remediation: restore the lost coverage with tests, or, once a reviewer accepts the new floors, regenerate only the regressed rows:",
      `  ${sanitizeCoverageDiagnostic(coverageScopedBaselineWriteCommand(packageNames))}`,
      `  (the scoped run measures only those packages and merges their rows; never run ${coverageRegressionRegenerationCommand} for a per-package drop)`,
    ],
  }),
  ...A.match(failurePackageNames(result.minimumFailures), {
    onEmpty: A.empty<string>,
    onNonEmpty: (packageNames) => [
      `[coverage-minimum] remediation: ${sanitizeCoverageDiagnostic(A.join(packageNames, ", "))} sit below the repository tier; only added coverage fixes this — the baseline writer records floors and cannot lift a package above the tier.`,
    ],
  }),
];

/**
 * Compare generated package coverage summaries against the committed baseline.
 *
 * @param repoRoot - Repository root.
 * @param scoped - Whether the coverage run was intentionally filtered or affected-scoped.
 * @param expectedPackageNames - Exact scoped package names that must emit summaries.
 * @category use-cases
 * @since 0.0.0
 */
export const compareCoverageRegressionBaseline = Effect.fn("CoverageRegression.compareCoverageRegressionBaseline")(
  function* (
    repoRoot: string,
    scoped: boolean,
    expectedPackageNames: ReadonlyArray<string> = A.empty<string>()
  ): Effect.fn.Return<
    void,
    CoverageRegressionError | QualityTaskFailed,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > {
    const baseline = yield* readComparisonBaseline(repoRoot);
    const actuals = yield* collectCoverageSnapshot(repoRoot);
    const result = compareCoverage(baseline, actuals, scoped, expectedPackageNames);
    const path = yield* Path.Path;
    const dispositionGaps = yield* workspaceCoverageDispositionGaps(repoRoot, path, baseline.exemptions);

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

    if (A.isReadonlyArrayNonEmpty(result.followUpDebt)) {
      yield* Console.warn(
        A.join(
          [
            "[coverage-minimum] named follow-up debt (non-blocking; committed monotonic floors still apply):",
            ...renderFollowUpDebt(baseline, result.followUpDebt),
          ],
          "\n"
        )
      );
    }

    yield* Console.log(renderCoverageExemptions(baseline.exemptions));

    yield* enforceRatchet({
      regressions: [
        {
          present:
            A.isReadonlyArrayNonEmpty(result.failures) ||
            A.isReadonlyArrayNonEmpty(result.minimumFailures) ||
            A.isReadonlyArrayNonEmpty(result.missingActuals) ||
            A.isReadonlyArrayNonEmpty(dispositionGaps),
          lines: regressionLines(result, dispositionGaps),
          error: QualityTaskFailed.new(1, "coverage:ratchet", "beep-cli coverage"),
        },
      ],
      okLine: `[coverage-ratchet] ok: compared ${result.comparedCount} package(s) with epsilon ${baseline.epsilon}`,
      tighten: O.none(),
    });
  }
);
