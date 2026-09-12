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
  CoverageSelfJudgeExclusion,
  CoverageSelfJudgeScope,
  changedCoverageOwners,
  coverageSelfJudgeExclusion,
  planCoverageAffectedScope,
  planCoverageSelfJudgeScope,
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
const encodeCoverageRegressionBaseline = S.encodeEffect(CoverageRegressionBaseline);

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
 * `dependentPackageNames` is the sorted set of measurable workspace dependents
 * of those owners, kept separate because only a scoped write adopts them: the
 * 2026-08-24 rule that an unscoped write adopts direct owners alone is still
 * active, and a foundation edit closes over most of the workspace.
 * `fullReasons` comes from the affected-run planner but does not expand either
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
    dependentPackageNames: S.Array(S.String).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<string>>([])),
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
 * `carriedUnmeasured` names the packages a scoped write would have adopted but
 * never measured, so the report can say their committed rows were kept rather
 * than let the carry pass unmentioned; it is empty for an unscoped write, which
 * prunes unmeasured rows instead of carrying them.
 *
 * **Gotchas**
 *
 * A `replaced` disposition is driven by a changed owner or `--replace-all`,
 * never merely by a non-empty full-reason list. A `carriedUnmeasured` name has
 * no entry in `dispositions` on purpose: the write did nothing to that row.
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
 * console.log(plan.carriedUnmeasured) // []
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
    carriedUnmeasured: S.Array(S.String).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<string>>([])),
  },
  $I.annote("CoverageBaselineWritePlan", {
    description:
      "Coverage baseline package rows to write, the disposition of every measured or removed package, and the adoption-set packages a scoped run never measured.",
  })
) {}

/**
 * One coverage comparison failure, distinguished by whether an existing
 * baseline dropped, a new file introduced uncovered units without a prior
 * file identity to compare, or a pull request raised a row beyond what the
 * lane measured.
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
    // Present only when this pull request lowered the row and the package was
    // not allowed to judge itself: the diagnostic then names both the value the
    // branch proposed and the witness that withheld it.
    loweredTo: Percentage.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    loweredExclusion: CoverageSelfJudgeExclusion.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
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

class CoverageRaisedRowFailure extends S.TaggedClass<CoverageRaisedRowFailure>($I`CoverageRaisedRowFailure`)(
  "row-raised-beyond-reach",
  {
    ...CoverageComparisonFailureFields,
    base: Percentage,
    proposed: Percentage,
    // A row can be stricter by count alone (same percentage, fewer uncovered
    // units), so the counts travel with the percentages for the diagnostic.
    baseUncovered: NonNegativeInt,
    proposedUncovered: NonNegativeInt,
    actualUncovered: NonNegativeInt,
  },
  $I.annote("CoverageRaisedRowFailure", {
    description:
      "A baseline row this pull request raised above the base revision's row and beyond what the lane measured.",
  })
) {}

/**
 * A baseline package row the pull request deleted while the lane still measures
 * the package.
 *
 * **Details**
 *
 * The only sanctioned delete path is
 * {@link subtractPackageFromCoverageRegressionBaseline}, which runs when a
 * workspace leaves the repository. A row that disappears while its package is
 * still measured silently drops every floor that package carried.
 *
 * **Example** (Decode a removed row)
 *
 * ```ts
 * import { CoveragePackageRowRemovedFailure } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * const removal = S.decodeUnknownSync(CoveragePackageRowRemovedFailure)({
 *   _tag: "package-row-removed",
 *   packageName: "@beep/example",
 *   packagePath: "packages/example"
 * })
 * console.log(removal.packageName) // "@beep/example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoveragePackageRowRemovedFailure extends S.TaggedClass<CoveragePackageRowRemovedFailure>(
  $I`CoveragePackageRowRemovedFailure`
)(
  "package-row-removed",
  {
    packageName: S.String,
    packagePath: CoverageRepoRelativePackagePath,
  },
  $I.annote("CoveragePackageRowRemovedFailure", {
    description: "A measured package whose baseline row the pull request removed without deleting the package.",
  })
) {}

/**
 * One metric floor this pull request lowered on a package it could not have
 * moved, judged at the lowered value.
 *
 * **Details**
 *
 * `tighten` marks a floor the lane measured strictly above the proposed value:
 * the row can be adopted at the measured figure instead, which is the advisory
 * the ratchet prints on a green run.
 *
 * **Example** (Describe one lowered floor)
 *
 * ```ts
 * import { CoverageLoweredFloor } from "@beep/repo-cli/test/Quality"
 * import { Percentage } from "@beep/schema/Percentage"
 * import * as O from "effect/Option"
 *
 * const floor = CoverageLoweredFloor.make({
 *   packageName: "@beep/example",
 *   packagePath: "packages/example",
 *   filePath: O.none(),
 *   metric: "lines",
 *   base: Percentage.make(80),
 *   lowered: Percentage.make(75),
 *   actual: Percentage.make(75),
 *   tighten: false
 * })
 * console.log(floor.lowered) // 75
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageLoweredFloor extends S.Class<CoverageLoweredFloor>($I`CoverageLoweredFloor`)(
  {
    packageName: S.String,
    packagePath: CoverageRepoRelativePackagePath,
    filePath: CoverageRepoRelativeFilePath.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    metric: CoverageMetricName,
    base: Percentage,
    lowered: Percentage,
    actual: Percentage,
    tighten: S.Boolean,
  },
  $I.annote("CoverageLoweredFloor", {
    description: "A floor the pull request lowered on a package it could not have moved, with the measured value.",
  })
) {}

/**
 * The row this run measured for a reported path, ready to paste into the
 * committed baseline.
 *
 * **Details**
 *
 * Package totals and file rows carry the same five fields, so both render
 * through {@link CoverageFileBaseline} and stay byte-compatible with the
 * committed document.
 *
 * **Example** (Propose a measured package total)
 *
 * ```ts
 * import { CoverageFileBaseline, CoverageMeasuredRowProposal, CoverageUncoveredCounts } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const proposal = CoverageMeasuredRowProposal.make({
 *   packageName: "@beep/example",
 *   filePath: O.none(),
 *   row: CoverageFileBaseline.make({
 *     lines: 90,
 *     statements: 90,
 *     branches: 90,
 *     functions: 90,
 *     uncovered: CoverageUncoveredCounts.make({ branches: 1, functions: 1, lines: 1, statements: 1 })
 *   })
 * })
 * console.log(proposal.row.lines) // 90
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageMeasuredRowProposal extends S.Class<CoverageMeasuredRowProposal>($I`CoverageMeasuredRowProposal`)(
  {
    packageName: S.String,
    filePath: CoverageRepoRelativeFilePath.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    row: CoverageFileBaseline,
  },
  $I.annote("CoverageMeasuredRowProposal", {
    description: "A coverage row this run measured for a path some failure reported.",
  })
) {}

/**
 * Runtime schema for a tagged coverage regression caused by a baseline drop,
 * a newly uncovered file, or a row a pull request raised beyond reach.
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
export const CoverageComparisonFailure = S.Union([
  CoverageBaselineDropFailure,
  CoverageNewUncoveredFileFailure,
  CoverageRaisedRowFailure,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CoverageComparisonFailure", {
    description:
      "Tagged coverage regression reason for a baseline drop, a newly uncovered file, or a row raised beyond reach.",
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
 * metric drops (failures), rows a pull request raised beyond what the run
 * measured (raisedRowFailures, with the count of raised row metrics judged),
 * packages missing a current summary, and packages new since the baseline
 * was written.
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
    raisedRowFailures: S.Array(CoverageComparisonFailure),
    raisedRowsJudged: S.Int,
    minimumFailures: S.Array(CoverageComparisonFailure),
    missingActuals: S.Array(S.String),
    newPackages: S.Array(CoverageSnapshotEntry),
    followUpDebt: S.Array(CoverageSnapshotEntry),
    loweredFloors: S.Array(CoverageLoweredFloor).pipe(
      SchemaUtils.withConstantDefault<ReadonlyArray<CoverageLoweredFloor>>([])
    ),
    measuredProposals: S.Array(CoverageMeasuredRowProposal).pipe(
      SchemaUtils.withConstantDefault<ReadonlyArray<CoverageMeasuredRowProposal>>([])
    ),
    packageRowRemovals: S.Array(CoveragePackageRowRemovedFailure).pipe(
      SchemaUtils.withConstantDefault<ReadonlyArray<CoveragePackageRowRemovedFailure>>([])
    ),
    selfJudgeEligiblePackageNames: S.Array(S.String).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<string>>([])),
    basePinned: S.Boolean.pipe(SchemaUtils.withConstantDefault<boolean>(false)),
  },
  $I.annote("CoverageComparisonResult", {
    description: "Outcome of comparing current coverage against the committed baseline.",
  })
) {}

/**
 * The documents one coverage comparison reads: the floors the measurement is
 * judged against and, on a base-pinned pull-request run, the branch's own
 * baseline so rows it raised can be judged against their proposed values.
 *
 * **Details**
 *
 * `baseline` is the base revision's document with the workspace's file
 * identity (base floors for surviving files, branch rows for new files).
 * `proposed` is the branch's committed document when `TURBO_SCM_BASE` pins a
 * base, and `None` on main pushes and local runs, where the workspace
 * document is the only floor and nothing is re-judged.
 *
 * **Example** (Base-only comparison input)
 *
 * ```ts
 * import { CoverageComparisonBaselines, CoverageRegressionBaseline } from "@beep/repo-cli/test/Quality"
 * import { Percentage } from "@beep/schema/Percentage"
 * import * as O from "effect/Option"
 *
 * const zero = Percentage.make(0)
 * const baseline = CoverageRegressionBaseline.make({
 *   schema_version: 2,
 *   generated_at: "2026-09-11T00:00:00.000Z",
 *   git_sha: "example",
 *   command: "bun run coverage:baseline:write",
 *   epsilon: 0.001,
 *   minimum: { lines: zero, statements: zero, branches: zero, functions: zero },
 *   exemptions: {},
 *   follow_ups: {},
 *   packages: {},
 * })
 * const baselines = CoverageComparisonBaselines.make({ baseline, proposed: O.none() })
 * console.log(O.isNone(baselines.proposed)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageComparisonBaselines extends S.Class<CoverageComparisonBaselines>($I`CoverageComparisonBaselines`)(
  {
    baseline: CoverageRegressionBaseline,
    proposed: S.Option(CoverageRegressionBaseline),
    // The merge-base document decides authorship: a row that differs from it is
    // one this branch wrote. Reading the base tip instead would attribute every
    // row `main` moved after the branch diverged to the branch.
    mergeBase: CoverageRegressionBaseline.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    selfJudge: CoverageSelfJudgeScope.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CoverageComparisonBaselines", {
    description: "Base-pinned comparison floors plus the branch's own baseline rows when a base is pinned.",
  })
) {}

const baseOnlyComparison = (baseline: CoverageRegressionBaseline): CoverageComparisonBaselines =>
  CoverageComparisonBaselines.make({ baseline, proposed: O.none() });

const decodeVitestCoverageSummary = S.decodeUnknownEffect(S.fromJsonString(VitestCoverageSummary));

const metricNames = CoverageMetricName.Options;

/**
 * Whether the pull request's row is a stricter floor than the base revision's
 * for one metric: a higher percentage (beyond epsilon) or fewer uncovered
 * units. Only such rows can turn main red after a merge, because main judges
 * its first push against the merged document while the pull request was judged
 * against the base rows. Lowered and unchanged rows stay governed by the base
 * comparison, so a floor-lowering fix proposes nothing this check can reject.
 *
 * @param metric - Metric being compared.
 * @param base - Row from the base revision's document.
 * @param proposed - Row from the pull request's own document.
 * @param epsilon - Percentage-point tolerance for floating-point noise.
 * @returns `true` when the proposed row is the stricter floor for the metric.
 */
const rowRaised = (
  metric: CoverageMetricName,
  base: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  proposed: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  epsilon: number
): boolean => proposed[metric] > base[metric] + epsilon || proposed.uncovered[metric] < base.uncovered[metric];

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

const coveragePackageRowByNameOrder = Order.mapInput(
  Order.String,
  (entry: readonly [string, CoveragePackageBaseline]) => entry[0]
);

const coverageDispositionByNameOrder = Order.mapInput(
  Order.String,
  (entry: readonly [string, CoverageBaselineRowDisposition]) => entry[0]
);

// Only a scoped write (`carryUnmeasured`) adopts dependents; an unscoped
// regeneration stays on the changed files' direct owners.
const coverageAdoptedPackageNames = (
  changeSet: CoverageBaselineChangeSet,
  carryUnmeasured: boolean
): ReadonlyArray<string> =>
  Bool.match(carryUnmeasured, {
    onTrue: () => A.union(changeSet.packageNames, changeSet.dependentPackageNames),
    onFalse: () => changeSet.packageNames,
  });

// A `--filter=@beep/changed` run adopts the whole change set on paper but only
// measures what the filter selected, so the rest of the adoption set keeps its
// committed rows. Holding is the fail-safe direction — the hosted pull-request
// run still judges those packages at the base floors — but it must not be
// silent, so the names travel on the plan for the report to print.
const coverageCarriedUnmeasuredNames = (
  changeSet: CoverageBaselineChangeSet,
  entries: ReadonlyArray<CoverageSnapshotEntry>,
  carryUnmeasured: boolean
): ReadonlyArray<string> =>
  Bool.match(carryUnmeasured, {
    onTrue: () =>
      pipe(
        HashSet.difference(
          HashSet.fromIterable(coverageAdoptedPackageNames(changeSet, true)),
          HashSet.fromIterable(A.map(entries, (entry) => entry.packageName))
        ),
        A.fromIterable,
        A.sort(Order.String)
      ),
    onFalse: A.empty<string>,
  });

// A measured package is adopted at the run's own row when the write replaces
// it, added when the committed document has no row for it, and otherwise held
// at the committed row this run must not move.
const coverageMeasuredWriteRow = (
  previousPackages: Record<string, CoveragePackageBaseline>,
  entry: CoverageSnapshotEntry,
  replace: boolean
): readonly [CoveragePackageBaseline, CoverageBaselineRowDisposition] =>
  Bool.match(replace, {
    onTrue: () => Tuple.make(entry.baseline, CoverageBaselineRowDisposition.Enum.replaced),
    onFalse: () =>
      O.match(R.get(previousPackages, entry.packageName), {
        onNone: () => Tuple.make(entry.baseline, CoverageBaselineRowDisposition.Enum.added),
        onSome: (committed) => Tuple.make(committed, CoverageBaselineRowDisposition.Enum.held),
      }),
  });

// Committed rows this run produced no summary for, in package-name order so a
// write that prunes two packages produces a two-package diff.
const coverageUnmeasuredPackageNames = (
  previousPackages: Record<string, CoveragePackageBaseline>,
  entries: ReadonlyArray<CoverageSnapshotEntry>
): ReadonlyArray<string> => {
  const measuredNames = HashSet.fromIterable(A.map(entries, (entry) => entry.packageName));
  return pipe(
    A.sort(R.keys(previousPackages), Order.String),
    A.filter((packageName) => !HashSet.has(measuredNames, packageName))
  );
};

/**
 * How one coverage baseline write treats measured and unmeasured rows.
 *
 * **Details**
 *
 * `replaceAll` adopts every package the run measured. `carryUnmeasured` marks a
 * scoped run, where committed rows the run never measured are carried through
 * instead of pruned; it defaults to `false`, so an unscoped write need not name
 * it.
 *
 * **Example** (A scoped write that adopts only changed owners)
 *
 * ```ts
 * import { CoverageBaselineWriteOptions } from "@beep/repo-cli/test/Quality"
 *
 * const options = CoverageBaselineWriteOptions.make({ replaceAll: false, carryUnmeasured: true })
 * console.log(options.carryUnmeasured) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageBaselineWriteOptions extends S.Class<CoverageBaselineWriteOptions>(
  $I`CoverageBaselineWriteOptions`
)(
  {
    carryUnmeasured: S.Boolean.pipe(SchemaUtils.withConstantDefault<boolean>(false)),
    replaceAll: S.Boolean,
  },
  $I.annote("CoverageBaselineWriteOptions", {
    description: "How one coverage baseline write treats measured rows and committed rows it never measured.",
  })
) {}

/**
 * Plan a coverage baseline write without reading files or running Git.
 *
 * **Details**
 *
 * Measured rows owned by changed files are adopted. Other measured packages
 * hold committed rows when present and are added when absent. Committed rows
 * absent from the validated full-workspace snapshot are pruned, unless
 * `carryUnmeasured` marks the run as scoped, where an unmeasured committed row
 * is carried through untouched because the run never looked at it.
 *
 * **Gotchas**
 *
 * `carryUnmeasured` also widens adoption to the change set's dependents: a
 * scoped write measured them on purpose, so holding their rows would commit
 * floors the next hosted run cannot reach. An unscoped write ignores
 * `dependentPackageNames` and adopts direct owners alone, because one
 * foundation edit closes over most of the workspace.
 * Full-run reasons describe measurement breadth only and never widen adoption.
 * `replaceAll` is the sole whole-document replacement path and overrides the
 * changed-owner set. Rows are emitted in package-name order so a write that
 * touches two packages produces a two-package diff.
 *
 * A `--filter` run narrows measurement without narrowing the adoption set, so
 * an adopted package the run never measured keeps its committed row. Those
 * names land on `carriedUnmeasured` for the report to print, because a carry
 * nobody mentions reads as an adoption that happened.
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
 * @param options - Whether to replace every measured row, and whether unmeasured committed rows are carried instead of pruned.
 * @returns Rows to write, one disposition for every measured or pruned package, and the adoption-set packages this run never measured.
 * @category utilities
 * @since 0.0.0
 */
export const planCoverageBaselineWrite: {
  (
    entries: ReadonlyArray<CoverageSnapshotEntry>,
    changeSet: CoverageBaselineChangeSet,
    options: CoverageBaselineWriteOptions
  ): (previousPackages: Record<string, CoveragePackageBaseline>) => CoverageBaselineWritePlan;
  (
    previousPackages: Record<string, CoveragePackageBaseline>,
    entries: ReadonlyArray<CoverageSnapshotEntry>,
    changeSet: CoverageBaselineChangeSet,
    options: CoverageBaselineWriteOptions
  ): CoverageBaselineWritePlan;
} = dual(
  4,
  (
    previousPackages: Record<string, CoveragePackageBaseline>,
    entries: ReadonlyArray<CoverageSnapshotEntry>,
    changeSet: CoverageBaselineChangeSet,
    options: CoverageBaselineWriteOptions
  ): CoverageBaselineWritePlan => {
    const shouldReplace = replaceMeasuredPackage(
      coverageAdoptedPackageNames(changeSet, options.carryUnmeasured),
      options.replaceAll
    );
    const packages = R.empty<string, CoveragePackageBaseline>();
    const dispositions = R.empty<string, CoverageBaselineRowDisposition>();

    for (const entry of A.sort(entries, packageByNameOrder)) {
      const [row, disposition] = coverageMeasuredWriteRow(previousPackages, entry, shouldReplace(entry.packageName));
      R.assignProperty(packages, entry.packageName, row);
      R.assignProperty(dispositions, entry.packageName, disposition);
    }

    for (const packageName of coverageUnmeasuredPackageNames(previousPackages, entries)) {
      // A scoped run measured a handful of packages; every other committed row
      // is carried through untouched rather than pruned, because "not measured"
      // and "no longer exists" are different answers.
      if (options.carryUnmeasured) {
        pipe(
          R.get(previousPackages, packageName),
          O.map((committed) => R.assignProperty(packages, packageName, committed))
        );
        continue;
      }
      R.assignProperty(dispositions, packageName, CoverageBaselineRowDisposition.Enum.pruned);
    }

    return CoverageBaselineWritePlan.make({
      carriedUnmeasured: coverageCarriedUnmeasuredNames(changeSet, entries, options.carryUnmeasured),
      changeSet,
      dispositions,
      packages: R.fromEntries(A.sort(R.toEntries(packages), coveragePackageRowByNameOrder)),
    });
  }
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
    Match.discriminator("_tag")("full", ({ reasons }) => reasons),
    Match.discriminator("_tag")("selected", A.empty<string>),
    Match.discriminator("_tag")("noop", A.empty<string>),
    Match.exhaustive
  );
  // A dependent's measured rows move when the package it imports changes, so a
  // scoped write adopts dependents alongside direct owners: holding them would
  // commit floors the next hosted run cannot reach. An unscoped write keeps the
  // 2026-08-24 direct-owners rule, because one foundation edit closes over most
  // of the workspace and a dependent's drop must stay a visible decision.
  const dependentPackageNames = Match.value(scope).pipe(
    Match.discriminator("_tag")("selected", ({ dependentPackageNames: names }) => names),
    Match.discriminator("_tag")("full", A.empty<string>),
    Match.discriminator("_tag")("noop", A.empty<string>),
    Match.exhaustive
  );
  const packageNames = A.sort(changedCoverageOwners(owners, writerChangedFiles), Order.String);

  return CoverageBaselineChangeSet.make({
    baseDescription,
    packageNames,
    dependentPackageNames: pipe(
      dependentPackageNames,
      A.filter((packageName) => !A.contains(packageNames, packageName)),
      A.sort(Order.String)
    ),
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
    // Every write that has a committed schema-v2 document to work from is
    // planned; the snapshot-only branch is the first write of a new document.
    packages: pipe(
      writePlan,
      O.map((plan) => plan.packages),
      O.getOrElse(() => snapshotPackages(entries))
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
  CoverageComparisonBaselines,
  CoverageRegressionError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const configuredBase = yield* configStringOption("TURBO_SCM_BASE");
  return yield* O.match(configuredBase, {
    onNone: () => readBaseline(repoRoot).pipe(Effect.map(baseOnlyComparison)),
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
      const baseline = CoverageRegressionBaseline.make({
        ...baseBaseline,
        packages: R.map(baseBaseline.packages, (basePackage, packageName) =>
          pipe(
            R.get(workspaceBaseline.packages, packageName),
            O.map((workspacePackage) =>
              CoveragePackageBaseline.make({
                ...basePackage,
                // Base floors remain authoritative for surviving files; the
                // reviewed workspace baseline determines file identity.
                files: R.map(workspacePackage.files, (workspaceFile, filePath) =>
                  pipe(
                    R.get(basePackage.files, filePath),
                    O.getOrElse(() => workspaceFile)
                  )
                ),
              })
            ),
            O.getOrElse(() => basePackage)
          )
        ),
      });
      // The branch's own document rides along: rows it raised above the base
      // are judged against their proposed values, which is what main will
      // apply on its first push after the merge.
      //
      // The merge-base document and the change set ride along for the opposite
      // direction: a row lowered relative to the merge base was authored here,
      // and a package that owns no changed file could not have moved it. Both
      // reads fail closed — an unreadable merge base or an unresolvable change
      // set leaves every row at the base floor, exactly as before.
      const mergeBase = yield* resolveGitMergeBase(repoRoot, base, "HEAD", coverageBaselineGitAdapter).pipe(
        Effect.flatMap((mergeBaseCommit) =>
          runGitRawOutput(
            repoRoot,
            ["show", `${mergeBaseCommit}:${coverageRegressionBaselinePath}`],
            coverageBaselineGitAdapter
          )
        ),
        Effect.flatMap(decodeJsoncTextAs(CoverageRegressionBaseline)),
        Effect.option
      );
      const selfJudge = yield* collectChangedFiles(repoRoot, base, "HEAD").pipe(
        Effect.flatMap((changedFiles) =>
          Effect.map(workspaceCoverageScopeOwners(repoRoot), (owners) =>
            planCoverageSelfJudgeScope(owners, changedFiles)
          )
        ),
        Effect.option
      );
      return CoverageComparisonBaselines.make({
        baseline,
        proposed: O.some(workspaceBaseline),
        mergeBase,
        selfJudge,
      });
    }),
  });
});

/**
 * Read the base-pinned floors a coverage comparison judges against and, when a
 * base is pinned, the branch's own baseline rows.
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
  const encoded = yield* encodeCoverageRegressionBaseline(baseline).pipe(
    QualityTaskConfigurationError.mapError("Failed to encode coverage regression baseline.")
  );
  const jsonc = yield* formatJsonc(encoded).pipe(
    QualityTaskConfigurationError.mapError("Failed to format coverage regression baseline.")
  );
  return [
    "// Coverage regression baseline. Do not edit by hand.",
    `// Regenerate the rows you changed with: ${coverageScopedBaselineWriteCommand(["<package>"])}`,
    "// A write adopts only packages that own a changed file (dependents included);",
    "// every other measured package is held at its committed row. Add --replace-all",
    "// to adopt every package the run measured instead.",
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

const coverageRowRaiseLines = (
  packageName: string,
  committed: CoveragePackageBaseline,
  written: CoveragePackageBaseline
): ReadonlyArray<string> => {
  const raises = (
    location: string,
    before: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
    after: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">
  ): ReadonlyArray<string> =>
    pipe(
      metricNames,
      A.filter((metric) => rowRaised(metric, before, after, coverageRegressionEpsilon)),
      A.map(
        (metric) =>
          `  - ${coverageDiagnosticFragment(packageName)} ${coverageDiagnosticFragment(location)} ${metric}: ${before[metric]} -> ${after[metric]} (${before.uncovered[metric]} -> ${after.uncovered[metric]} uncovered)`
      )
    );

  return A.appendAll(
    raises("totals", committed, written),
    pipe(
      R.toEntries(written.files),
      A.sort(coverageFileByPathOrder),
      A.flatMap(([filePath, writtenFile]) =>
        pipe(
          R.get(committed.files, filePath),
          O.map((committedFile) => raises(filePath, committedFile, writtenFile)),
          O.getOrElse(A.empty<string>)
        )
      )
    )
  );
};

const coverageDispositionLine = (packageName: string, disposition: CoverageBaselineRowDisposition): string =>
  `[coverage-ratchet] ${coverageDiagnosticFragment(packageName)}: ${Match.value(disposition).pipe(
    Match.when("replaced", () => "adopted"),
    Match.when("added", () => "added (no committed row)"),
    Match.when("held", () => "held (owns no changed file; pass --replace-all to re-measure it)"),
    Match.when("pruned", () => "pruned (no longer a workspace package)"),
    Match.exhaustive
  )}`;

// Name every adopted package the scoped run never measured. Holding is the
// fail-safe direction, but an operator reading only disposition lines would
// conclude the whole change set was adopted.
const coverageCarriedUnmeasuredLines = (carriedUnmeasured: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.match(carriedUnmeasured, {
    onEmpty: A.empty<string>,
    onNonEmpty: (names) =>
      A.of(
        `[coverage-ratchet] ${names.length} package(s) in this change set were not measured by this scoped run and keep their committed rows: ${A.join(A.map(names, coverageDiagnosticFragment), ", ")}. The hosted pull-request run still judges them at the base floors; pass --filter=<package> for each one, or run --affected, to re-measure them.`
      ),
  });

/**
 * Render what a baseline write did to every package it measured, and which
 * committed values it raised.
 *
 * **Details**
 *
 * Adoption is per package and never silent: a run that held every package it
 * measured says so, because the operator's next move is `--replace-all` rather
 * than a second identical run. A scoped run that adopted packages it never
 * measured names them too, so a `--filter` write cannot read as a full-change-set
 * adoption. Every raised value is named because the hosted pull-request run
 * judges exactly those rows.
 *
 * **Example** (An empty plan reports nothing to adopt)
 *
 * ```ts
 * import { CoverageBaselineWritePlan, coverageBaselineWriteReport } from "@beep/repo-cli/test/Quality"
 *
 * const plan = CoverageBaselineWritePlan.make({
 *   changeSet: { baseDescription: "dirty worktree only", packageNames: [], fullReasons: [] },
 *   packages: {},
 *   dispositions: {}
 * })
 * console.log(coverageBaselineWriteReport(plan, {})) // []
 * ```
 *
 * @param plan - The plan the write applied.
 * @param previousPackages - Package rows the committed document carried before the write.
 * @returns One disposition line per measured package, any carried-unmeasured notice, then the raised-value report.
 * @category formatting
 * @since 0.0.0
 */
export const coverageBaselineWriteReport: {
  (
    previousPackages: Record<string, CoveragePackageBaseline>
  ): (plan: CoverageBaselineWritePlan) => ReadonlyArray<string>;
  (plan: CoverageBaselineWritePlan, previousPackages: Record<string, CoveragePackageBaseline>): ReadonlyArray<string>;
} = dual(
  2,
  (
    plan: CoverageBaselineWritePlan,
    previousPackages: Record<string, CoveragePackageBaseline>
  ): ReadonlyArray<string> => {
    const dispositions = A.sort(R.toEntries(plan.dispositions), coverageDispositionByNameOrder);
    const measured = A.filter(dispositions, ([, disposition]) => disposition !== "pruned");
    const heldEverything =
      A.isReadonlyArrayNonEmpty(measured) && A.every(measured, ([, disposition]) => disposition === "held");
    const raises = pipe(
      A.sort(R.toEntries(plan.packages), coveragePackageRowByNameOrder),
      A.flatMap(([packageName, written]) =>
        pipe(
          R.get(previousPackages, packageName),
          O.map((committed) => coverageRowRaiseLines(packageName, committed, written)),
          O.getOrElse(A.empty<string>)
        )
      )
    );

    return A.appendAll(
      A.appendAll(
        A.appendAll(
          A.map(dispositions, ([packageName, disposition]) => coverageDispositionLine(packageName, disposition)),
          heldEverything
            ? A.of(
                "[coverage-ratchet] every measured package was held; this run changed no row. Pass --replace-all to re-measure them."
              )
            : A.empty<string>()
        ),
        coverageCarriedUnmeasuredLines(plan.carriedUnmeasured)
      ),
      A.match(raises, {
        onEmpty: A.empty<string>,
        onNonEmpty: (lines) => [
          "[coverage-ratchet] value(s) this write raised above the committed rows (the hosted pull-request run judges each one):",
          ...lines,
        ],
      })
    );
  }
);

/**
 * Write the committed coverage regression baseline from generated summaries.
 *
 * **Details**
 *
 * Scoped and unscoped writes share one plan: measured rows are adopted only for
 * workspace owners of changed files and their dependents, every other measured
 * package holds its committed row, new packages are added, and deleted packages
 * are pruned. A scoped run additionally carries every committed row it never
 * measured. The affected planner still determines measurement breadth, while
 * `replaceAll` is the only path that adopts the whole measured document.
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
    // Scoped and unscoped writes share one plan. A scoped write used to spread
    // its whole measured block over the committed document, so one workstation
    // run replaced every row of every package it touched — including files the
    // change set never went near.
    const writePlan = O.isSome(currentPrevious)
      ? O.some(
          planCoverageBaselineWrite(
            currentPrevious.value.packages,
            entries,
            yield* collectCoverageBaselineChangeSet(repoRoot),
            CoverageBaselineWriteOptions.make({ replaceAll, carryUnmeasured: scoped })
          )
        )
      : O.none<CoverageBaselineWritePlan>();
    const baseline = yield* baselineDocumentFromSnapshot(repoRoot, entries, previous, scoped, writePlan);
    yield* writeBaselineDocument(repoRoot, baseline);
    yield* Console.log(
      pipe(
        writePlan,
        O.map((plan) => coverageBaselineWriteSummary(plan, replaceAll)),
        O.getOrElse(
          () => `[coverage-ratchet] wrote ${coverageRegressionBaselinePath} with ${A.length(entries)} package(s)`
        )
      )
    );
    yield* pipe(
      writePlan,
      O.match({
        onNone: () => Effect.void,
        onSome: (plan) =>
          Console.log(
            A.join(
              coverageBaselineWriteReport(
                plan,
                pipe(
                  currentPrevious,
                  O.map((document) => document.packages),
                  O.getOrElse(() => R.empty<string, CoveragePackageBaseline>())
                )
              ),
              "\n"
            )
          ),
      })
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

const packageEntryByNameOrder = Order.mapInput(
  Order.String,
  (entry: readonly [string, CoveragePackageBaseline]) => entry[0]
);

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

// One entry per raised metric: `Some` when the measurement does not reach the
// proposed row under the same drop rule main applies after the merge.
const raisedFileRowJudgements = (
  packageName: string,
  packagePath: string,
  filePath: string,
  base: CoverageFileBaseline,
  proposed: CoverageFileBaseline,
  actual: CoverageFileBaseline,
  epsilon: number
): ReadonlyArray<O.Option<CoverageComparisonFailure>> =>
  pipe(
    metricNames,
    A.filter((metric) => rowRaised(metric, base, proposed, epsilon)),
    A.map((metric) =>
      fileMetricRegressed(metric, proposed, actual, epsilon)
        ? O.some(
            CoverageRaisedRowFailure.make({
              packageName,
              packagePath,
              filePath: O.some(filePath),
              metric,
              base: base[metric],
              proposed: proposed[metric],
              actual: actual[metric],
              baseUncovered: base.uncovered[metric],
              proposedUncovered: proposed.uncovered[metric],
              actualUncovered: actual.uncovered[metric],
            })
          )
        : O.none()
    )
  );

const raisedPackageRowJudgements = (
  packageName: string,
  base: CoveragePackageBaseline,
  proposed: CoveragePackageBaseline,
  actual: CoveragePackageBaseline,
  epsilon: number
): ReadonlyArray<O.Option<CoverageComparisonFailure>> =>
  pipe(
    metricNames,
    A.filter((metric) => rowRaised(metric, base, proposed, epsilon)),
    A.map((metric) =>
      metricRegressed(metric, proposed, actual, epsilon)
        ? O.some(
            CoverageRaisedRowFailure.make({
              packageName,
              packagePath: proposed.path,
              filePath: O.none(),
              metric,
              base: base[metric],
              proposed: proposed[metric],
              actual: actual[metric],
              baseUncovered: base.uncovered[metric],
              proposedUncovered: proposed.uncovered[metric],
              actualUncovered: actual.uncovered[metric],
            })
          )
        : O.none()
    )
  );

// A raised file row the run did not measure at all: main applies the vanished-
// path rule to the merged document, so every raised metric with a positive
// proposed percentage fails there. The base comparison only reports vanished
// metrics whose base value is positive, so a row raised from zero would
// otherwise slip through. Absent measurements read as zero, like that rule.
const raisedVanishedFileRowJudgements = (
  packageName: string,
  packagePath: string,
  filePath: string,
  base: CoverageFileBaseline,
  proposed: CoverageFileBaseline,
  epsilon: number
): ReadonlyArray<O.Option<CoverageComparisonFailure>> =>
  pipe(
    metricNames,
    A.filter((metric) => rowRaised(metric, base, proposed, epsilon)),
    A.map((metric) =>
      proposed[metric] > ZERO_PERCENTAGE
        ? O.some(
            CoverageRaisedRowFailure.make({
              packageName,
              packagePath,
              filePath: O.some(filePath),
              metric,
              base: base[metric],
              proposed: proposed[metric],
              actual: ZERO_PERCENTAGE,
              baseUncovered: base.uncovered[metric],
              proposedUncovered: proposed.uncovered[metric],
              actualUncovered: NonNegativeInt.make(0),
            })
          )
        : O.none()
    )
  );

// Judge every row the branch raised above the base floors against the branch's
// own value. Only rows with a base row in a measured package are candidates:
// new files already carry the branch row in `baseline`, so they are never
// stricter than it, and unmeasured packages have nothing to judge. A raised
// file row missing from the package measurement is judged as vanished.
const judgeRaisedRows = (
  baseline: CoverageRegressionBaseline,
  proposed: CoverageRegressionBaseline,
  actualsByName: Record<string, CoverageSnapshotEntry>
): ReadonlyArray<O.Option<CoverageComparisonFailure>> =>
  pipe(
    R.toEntries(proposed.packages),
    A.sort(packageEntryByNameOrder),
    A.flatMap(([packageName, proposedPackage]) =>
      pipe(
        O.all([R.get(baseline.packages, packageName), R.get(actualsByName, packageName)]),
        O.map(([basePackage, actual]) =>
          A.appendAll(
            pipe(
              R.toEntries(proposedPackage.files),
              A.sort(coverageFileByPathOrder),
              A.flatMap(([filePath, proposedFile]) =>
                pipe(
                  R.get(basePackage.files, filePath),
                  O.map((baseFile) =>
                    O.match(R.get(actual.baseline.files, filePath), {
                      onNone: () =>
                        raisedVanishedFileRowJudgements(
                          packageName,
                          proposedPackage.path,
                          filePath,
                          baseFile,
                          proposedFile,
                          baseline.epsilon
                        ),
                      onSome: (actualFile) =>
                        raisedFileRowJudgements(
                          packageName,
                          proposedPackage.path,
                          filePath,
                          baseFile,
                          proposedFile,
                          actualFile,
                          baseline.epsilon
                        ),
                    })
                  ),
                  O.getOrElse(A.empty<O.Option<CoverageComparisonFailure>>)
                )
              )
            ),
            raisedPackageRowJudgements(packageName, basePackage, proposedPackage, actual.baseline, baseline.epsilon)
          )
        ),
        O.getOrElse(A.empty<O.Option<CoverageComparisonFailure>>)
      )
    )
  );

type CoverageWithheldLowering = {
  readonly exclusion: CoverageSelfJudgeExclusion;
  readonly lowered: Percentage;
};

type CoverageFloorPlan = {
  readonly eligiblePackageNames: ReadonlyArray<string>;
  readonly lowered: ReadonlyArray<CoverageLoweredFloor>;
  readonly packageRowRemovals: ReadonlyArray<CoveragePackageRowRemovedFailure>;
  readonly packages: Record<string, CoveragePackageBaseline>;
  readonly withheld: MutableHashMap.MutableHashMap<string, CoverageWithheldLowering>;
};

const coverageRowKey = (packageName: string, filePath: O.Option<string>, metric: CoverageMetricName): string =>
  `${packageName}\u0000${O.getOrElse(filePath, () => "")}\u0000${metric}`;

/**
 * Whether the pull request's row is a looser floor than the merge base's for
 * one metric. Authorship, not direction against the base tip, is what this
 * asks: `main` raising a row after the branch diverged must not read as the
 * branch lowering it.
 *
 * @param metric - Metric being compared.
 * @param mergeBase - Row from the commit this branch diverged at.
 * @param proposed - Row from the pull request's own document.
 * @param epsilon - Percentage-point tolerance for floating-point noise.
 * @returns `true` when this pull request authored a looser floor for the metric.
 */
const rowLowered = (
  metric: CoverageMetricName,
  mergeBase: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  proposed: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  epsilon: number
): boolean =>
  proposed[metric] + epsilon < mergeBase[metric] || proposed.uncovered[metric] > mergeBase.uncovered[metric];

// Metrics this pull request lowered and that are not simultaneously stricter
// than the base floor: a stricter row is judged by the raised-row rule, so the
// two verdicts never claim the same metric.
const loweredRowMetrics = (
  base: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  mergeBase: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  proposed: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  epsilon: number
): ReadonlyArray<CoverageMetricName> =>
  A.filter(
    metricNames,
    (metric) => rowLowered(metric, mergeBase, proposed, epsilon) && !rowRaised(metric, base, proposed, epsilon)
  );

const loweredMetricPercentage = (
  metric: CoverageMetricName,
  base: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  proposed: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  metrics: ReadonlyArray<CoverageMetricName>
): Percentage => (A.contains(metrics, metric) ? proposed[metric] : base[metric]);

const loweredMetricUncovered = (
  metric: CoverageMetricName,
  base: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  proposed: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  metrics: ReadonlyArray<CoverageMetricName>
): NonNegativeInt => (A.contains(metrics, metric) ? proposed.uncovered[metric] : base.uncovered[metric]);

// Per-metric selection: a package can have one metric lowered here and another
// still governed by the base floor, and the uncovered counts must travel with
// their own metric or the drop rule compares mismatched pairs.
const loweredRowFields = (
  base: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  proposed: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  metrics: ReadonlyArray<CoverageMetricName>
) => ({
  lines: loweredMetricPercentage("lines", base, proposed, metrics),
  statements: loweredMetricPercentage("statements", base, proposed, metrics),
  branches: loweredMetricPercentage("branches", base, proposed, metrics),
  functions: loweredMetricPercentage("functions", base, proposed, metrics),
  uncovered: CoverageUncoveredCounts.make({
    lines: loweredMetricUncovered("lines", base, proposed, metrics),
    statements: loweredMetricUncovered("statements", base, proposed, metrics),
    branches: loweredMetricUncovered("branches", base, proposed, metrics),
    functions: loweredMetricUncovered("functions", base, proposed, metrics),
  }),
});

// Everything one floor pass accumulates across packages: the documents it
// judges against, and the two sinks a per-package judgement writes into.
type CoverageFloorSession = {
  readonly baselines: CoverageComparisonBaselines;
  readonly epsilon: number;
  readonly lowered: Array<CoverageLoweredFloor>;
  readonly withheld: MutableHashMap.MutableHashMap<string, CoverageWithheldLowering>;
};

// The session narrowed to one package, so a row-level helper never re-derives
// the package's self-judge verdict.
type CoverageLoweringContext = CoverageFloorSession & {
  readonly basePath: CoveragePackageBaseline["path"];
  readonly exclusion: O.Option<CoverageSelfJudgeExclusion>;
  readonly packageName: string;
  readonly selfJudgeable: boolean;
};

type CoveragePackageJudgement = {
  readonly exclusion: O.Option<CoverageSelfJudgeExclusion>;
  readonly selfJudgeable: boolean;
};

type CoveragePackageFloorPlan = {
  readonly eligible: boolean;
  readonly removal: O.Option<CoveragePackageRowRemovedFailure>;
  readonly row: CoveragePackageBaseline;
};

// Self-judging is on only when a scope exists and does not exclude this
// package. The exclusion witness travels with the verdict so a lowering the
// scope withheld can name what withheld it.
const coveragePackageJudgement = (
  selfJudge: O.Option<CoverageSelfJudgeScope>,
  packageName: string
): CoveragePackageJudgement => {
  const exclusion = O.flatMap(selfJudge, (scope) => coverageSelfJudgeExclusion(scope, packageName));
  return { exclusion, selfJudgeable: O.isSome(selfJudge) && O.isNone(exclusion) };
};

// A measured package whose own document no longer carries the row: the pull
// request removed a baseline row without deleting the package.
const coveragePackageRowRemoval = (
  context: CoverageLoweringContext,
  measured: O.Option<CoverageSnapshotEntry>,
  proposedPackage: O.Option<CoveragePackageBaseline>
): O.Option<CoveragePackageRowRemovedFailure> =>
  O.isSome(context.baselines.proposed) && O.isSome(measured) && O.isNone(proposedPackage)
    ? O.some(CoveragePackageRowRemovedFailure.make({ packageName: context.packageName, packagePath: context.basePath }))
    : O.none();

// A lowered metric is either a floor this run judges — the package judges
// itself — or a withheld lowering that decorates the failure with the exclusion
// which withheld it.
const recordLoweredMetrics = (
  context: CoverageLoweringContext,
  filePath: O.Option<string>,
  baseRow: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  proposedRow: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  actualRow: Pick<CoverageFileBaseline, CoverageMetricName | "uncovered">,
  metrics: ReadonlyArray<CoverageMetricName>
): void => {
  for (const metric of metrics) {
    if (context.selfJudgeable) {
      context.lowered.push(
        CoverageLoweredFloor.make({
          packageName: context.packageName,
          packagePath: context.basePath,
          filePath,
          metric,
          base: baseRow[metric],
          lowered: proposedRow[metric],
          actual: actualRow[metric],
          tighten: actualRow[metric] > proposedRow[metric] + context.epsilon,
        })
      );
      continue;
    }
    pipe(
      context.exclusion,
      O.map((witness) =>
        MutableHashMap.set(context.withheld, coverageRowKey(context.packageName, filePath, metric), {
          exclusion: witness,
          lowered: proposedRow[metric],
        })
      )
    );
  }
};

// The floor one file keeps, recording every metric this pull request lowered on
// the way: the base row when the run did not measure the path or the pull
// request lowered nothing, and the lowered row only when the package judges
// itself.
const judgeFileFloor = (
  context: CoverageLoweringContext,
  filePath: string,
  baseFile: CoverageFileBaseline,
  proposedRow: CoveragePackageBaseline,
  mergeBaseRow: CoveragePackageBaseline,
  actualPackage: CoveragePackageBaseline
): CoverageFileBaseline => {
  // A path the run did not measure stays governed by the vanished-file rule at
  // the base floor: lowering a row cannot make a disappearance benign.
  const fileRows = O.all([
    R.get(proposedRow.files, filePath),
    R.get(mergeBaseRow.files, filePath),
    R.get(actualPackage.files, filePath),
  ]);
  if (O.isNone(fileRows)) {
    return baseFile;
  }
  const [proposedFile, mergeBaseFile, actualFile] = fileRows.value;
  const metrics = loweredRowMetrics(baseFile, mergeBaseFile, proposedFile, context.epsilon);
  if (A.isReadonlyArrayEmpty(metrics)) {
    return baseFile;
  }
  recordLoweredMetrics(context, O.some(filePath), baseFile, proposedFile, actualFile, metrics);
  return context.selfJudgeable
    ? CoverageFileBaseline.make(loweredRowFields(baseFile, proposedFile, metrics))
    : baseFile;
};

// The package row this run writes: every base file row replaced by its judged
// floor, and the package total lowered only when the package judges itself and
// the pull request lowered at least one package metric.
const judgePackageFloorRow = (
  context: CoverageLoweringContext,
  basePackage: CoveragePackageBaseline,
  proposedRow: CoveragePackageBaseline,
  mergeBaseRow: CoveragePackageBaseline,
  actualPackage: CoveragePackageBaseline
): CoveragePackageBaseline => {
  const files = R.empty<string, CoverageFileBaseline>();
  for (const [filePath, baseFile] of A.sort(R.toEntries(basePackage.files), coverageFileByPathOrder)) {
    R.assignProperty(
      files,
      filePath,
      judgeFileFloor(context, filePath, baseFile, proposedRow, mergeBaseRow, actualPackage)
    );
  }

  const packageMetrics = loweredRowMetrics(basePackage, mergeBaseRow, proposedRow, context.epsilon);
  recordLoweredMetrics(context, O.none(), basePackage, proposedRow, actualPackage, packageMetrics);
  return CoveragePackageBaseline.make({
    ...basePackage,
    ...(context.selfJudgeable && A.isReadonlyArrayNonEmpty(packageMetrics)
      ? loweredRowFields(basePackage, proposedRow, packageMetrics)
      : {}),
    files,
  });
};

// One package's three answers: the row to write, whether the package may judge
// itself, and whether the pull request removed its row. A package the pull
// request, the merge base, or the run has no row for keeps its base floor.
const judgePackageFloor = (
  session: CoverageFloorSession,
  packageName: string,
  basePackage: CoveragePackageBaseline,
  measured: O.Option<CoverageSnapshotEntry>
): CoveragePackageFloorPlan => {
  const baselines = session.baselines;
  const proposedPackage = O.flatMap(baselines.proposed, (document) => R.get(document.packages, packageName));
  const mergeBasePackage = O.flatMap(baselines.mergeBase, (document) => R.get(document.packages, packageName));
  const context: CoverageLoweringContext = {
    ...session,
    ...coveragePackageJudgement(baselines.selfJudge, packageName),
    basePath: basePackage.path,
    packageName,
  };
  const removal = coveragePackageRowRemoval(context, measured, proposedPackage);
  const eligible = context.selfJudgeable && O.isSome(measured);

  return O.match(O.all([proposedPackage, mergeBasePackage, measured]), {
    onNone: () => ({ eligible, removal, row: basePackage }),
    onSome: ([proposedRow, mergeBaseRow, actualEntry]) => ({
      eligible,
      removal,
      row: judgePackageFloorRow(context, basePackage, proposedRow, mergeBaseRow, actualEntry.baseline),
    }),
  });
};

// One pass over the base floors that answers three questions at once: which
// rows this pull request lowered on packages it could not have moved (those
// become the floors), which lowered rows were withheld and why (those decorate
// the failure), and which measured packages lost their row entirely.
const planCoverageFloors = (
  baselines: CoverageComparisonBaselines,
  actualsByName: Record<string, CoverageSnapshotEntry>
): CoverageFloorPlan => {
  const session: CoverageFloorSession = {
    baselines,
    epsilon: baselines.baseline.epsilon,
    lowered: [],
    withheld: MutableHashMap.empty<string, CoverageWithheldLowering>(),
  };
  const packages = R.empty<string, CoveragePackageBaseline>();
  const eligiblePackageNames: Array<string> = [];
  const packageRowRemovals: Array<CoveragePackageRowRemovedFailure> = [];

  for (const [packageName, basePackage] of A.sort(R.toEntries(baselines.baseline.packages), packageEntryByNameOrder)) {
    const plan = judgePackageFloor(session, packageName, basePackage, R.get(actualsByName, packageName));
    R.assignProperty(packages, packageName, plan.row);
    if (plan.eligible) {
      eligiblePackageNames.push(packageName);
    }
    pipe(
      plan.removal,
      O.map((removal) => packageRowRemovals.push(removal))
    );
  }

  return {
    eligiblePackageNames: A.sort(eligiblePackageNames, Order.String),
    lowered: session.lowered,
    packageRowRemovals,
    packages,
    withheld: session.withheld,
  };
};

const withheldLowering = (
  withheld: MutableHashMap.MutableHashMap<string, CoverageWithheldLowering>,
  failure: CoverageComparisonFailure
): CoverageComparisonFailure =>
  Match.value(failure).pipe(
    Match.tag("baseline-drop", (drop) =>
      O.match(MutableHashMap.get(withheld, coverageRowKey(drop.packageName, drop.filePath, drop.metric)), {
        onNone: () => failure,
        onSome: (lowering) =>
          CoverageBaselineDropFailure.make({
            actual: drop.actual,
            baseline: drop.baseline,
            filePath: drop.filePath,
            loweredExclusion: O.some(lowering.exclusion),
            loweredTo: O.some(lowering.lowered),
            metric: drop.metric,
            packageName: drop.packageName,
            packagePath: drop.packagePath,
          }),
      })
    ),
    Match.orElse(() => failure)
  );

const packageRowAsFileBaseline = (row: CoveragePackageBaseline): CoverageFileBaseline =>
  CoverageFileBaseline.make({
    lines: row.lines,
    statements: row.statements,
    branches: row.branches,
    functions: row.functions,
    uncovered: row.uncovered,
  });

const measuredRowProposalKey = (proposal: CoverageMeasuredRowProposal): string =>
  `${proposal.packageName}\u0000${O.getOrElse(proposal.filePath, () => "")}`;

const measuredRowProposalOrder = Order.mapInput(Order.String, measuredRowProposalKey);

// Hosted evidence for every path a failure named: the package total plus the
// file row, in the exact field order the committed document uses.
const measuredRowProposals = (
  failures: ReadonlyArray<CoverageComparisonFailure>,
  actualsByName: Record<string, CoverageSnapshotEntry>
): ReadonlyArray<CoverageMeasuredRowProposal> =>
  pipe(
    failures,
    A.flatMap((failure) =>
      pipe(
        R.get(actualsByName, failure.packageName),
        O.map((entry) =>
          A.appendAll(
            A.of(
              CoverageMeasuredRowProposal.make({
                packageName: failure.packageName,
                filePath: O.none(),
                row: packageRowAsFileBaseline(entry.baseline),
              })
            ),
            pipe(
              failure.filePath,
              O.flatMap((filePath) =>
                O.map(R.get(entry.baseline.files, filePath), (row) =>
                  CoverageMeasuredRowProposal.make({
                    packageName: failure.packageName,
                    filePath: O.some(filePath),
                    row,
                  })
                )
              ),
              O.match({ onNone: A.empty<CoverageMeasuredRowProposal>, onSome: A.of })
            )
          )
        ),
        O.getOrElse(A.empty<CoverageMeasuredRowProposal>)
      )
    ),
    A.dedupeWith((left, right) => measuredRowProposalKey(left) === measuredRowProposalKey(right)),
    A.sort(measuredRowProposalOrder)
  );

const compareCoverage = (
  baselines: CoverageComparisonBaselines,
  actuals: ReadonlyArray<CoverageSnapshotEntry>,
  scoped: boolean,
  expectedPackageNames: ReadonlyArray<string> = A.empty<string>()
): CoverageComparisonResult => {
  const baseline = baselines.baseline;
  // A base-pinned run is the only one with a pull request behind it: it read the
  // branch's own document. Unpinned runs (main pushes, local runs) keep the
  // pre-existing output byte for byte.
  const basePinned = O.isSome(baselines.proposed);
  const actualsByName = actualByPackageName(actuals);
  // Floors first: rows this pull request lowered on packages it could not have
  // moved are judged at the lowered value, everything else at the base floor.
  const floors = planCoverageFloors(baselines, actualsByName);
  const baselineEntries = A.sort(R.toEntries(floors.packages), packageEntryByNameOrder);
  const failures = pipe(
    baselineEntries,
    A.flatMap(([packageName, packageBaseline]) =>
      pipe(
        actualsByName,
        R.get(packageName),
        O.map((actual) => droppedCoverageMetrics(packageName, packageBaseline, actual.baseline, baseline.epsilon)),
        O.getOrElse(A.empty<CoverageComparisonFailure>)
      )
    ),
    A.map((failure) => withheldLowering(floors.withheld, failure))
  );
  const raisedRowJudgements = pipe(
    baselines.proposed,
    O.map((proposed) => judgeRaisedRows(baseline, proposed, actualsByName)),
    O.getOrElse(A.empty<O.Option<CoverageComparisonFailure>>)
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

  const raisedRowFailures = A.getSomes(raisedRowJudgements);

  return {
    comparedCount: A.length(actuals) - A.length(newPackages),
    failures,
    raisedRowFailures,
    raisedRowsJudged: A.length(raisedRowJudgements),
    minimumFailures,
    missingActuals,
    newPackages,
    followUpDebt,
    loweredFloors: floors.lowered,
    measuredProposals: basePinned
      ? measuredRowProposals(A.appendAll(A.appendAll(failures, raisedRowFailures), minimumFailures), actualsByName)
      : A.empty<CoverageMeasuredRowProposal>(),
    packageRowRemovals: floors.packageRowRemovals,
    selfJudgeEligiblePackageNames: floors.eligiblePackageNames,
    basePinned,
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
} = dual(
  3,
  (
    baseline: CoverageRegressionBaseline,
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    scoped: boolean
  ): CoverageComparisonResult => compareCoverage(baseOnlyComparison(baseline), actuals, scoped)
);

/**
 * Pure comparison that also judges the rows a pull request raised against its
 * own proposed values, exposed for package-local tests.
 *
 * **Example** (Judge a branch that proposes the base document unchanged)
 *
 * ```ts
 * import {
 *   CoverageComparisonBaselines,
 *   CoverageRegressionBaseline,
 *   compareCoverageRegressionSnapshotsWithProposedForTesting
 * } from "@beep/repo-cli/test/Quality"
 * import { Percentage } from "@beep/schema/Percentage"
 * import * as O from "effect/Option"
 *
 * const zero = Percentage.make(0)
 * const baseline = CoverageRegressionBaseline.make({
 *   schema_version: 2,
 *   generated_at: "2026-09-11T00:00:00.000Z",
 *   git_sha: "example",
 *   command: "bun run coverage:baseline:write",
 *   epsilon: 0.001,
 *   minimum: { lines: zero, statements: zero, branches: zero, functions: zero },
 *   exemptions: {},
 *   follow_ups: {},
 *   packages: {},
 * })
 * const result = compareCoverageRegressionSnapshotsWithProposedForTesting(
 *   CoverageComparisonBaselines.make({ baseline, proposed: O.some(baseline) }),
 *   [],
 *   false
 * )
 * console.log(result.raisedRowsJudged) // 0
 * ```
 *
 * @param baselines - Base floors plus the branch's own document.
 * @param actuals - Coverage summaries produced by the run.
 * @param scoped - Whether the run was intentionally filtered or affected-scoped.
 * @returns Regression findings including raised rows the run did not reach.
 * @category testing
 * @since 0.0.0
 */
export const compareCoverageRegressionSnapshotsWithProposedForTesting: {
  (
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    scoped: boolean
  ): (baselines: CoverageComparisonBaselines) => CoverageComparisonResult;
  (
    baselines: CoverageComparisonBaselines,
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    scoped: boolean
  ): CoverageComparisonResult;
} = dual(
  3,
  (
    baselines: CoverageComparisonBaselines,
    actuals: ReadonlyArray<CoverageSnapshotEntry>,
    scoped: boolean
  ): CoverageComparisonResult => compareCoverage(baselines, actuals, scoped)
);

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
  ): CoverageComparisonResult => compareCoverage(baseOnlyComparison(baseline), actuals, true, expectedPackageNames)
);

const coverageFailureLocation = (failure: CoverageComparisonFailure): string =>
  pipe(
    failure.filePath,
    O.getOrElse(() => failure.packagePath),
    coverageDiagnosticFragment
  );

const renderSelfJudgeExclusion = (exclusion: CoverageSelfJudgeExclusion): string =>
  Match.value(exclusion).pipe(
    Match.tag(
      "owns-changed-file",
      (owned) => `package owns changed file ${coverageDiagnosticFragment(owned.filePath)}`
    ),
    Match.tag(
      "dependent-of-changed-package",
      (dependent) => `dependent of ${coverageDiagnosticFragment(dependent.packageName)}`
    ),
    Match.tag(
      "global-input-changed",
      (global) => `global input ${coverageDiagnosticFragment(global.filePath)} changed`
    ),
    Match.exhaustive
  );

const renderWithheldLowering = (drop: CoverageBaselineDropFailure): string =>
  O.match(O.all([drop.loweredTo, drop.loweredExclusion]), {
    onNone: () => "",
    onSome: ([lowered, exclusion]) =>
      ` [row lowered by this pull request to ${lowered}; judged at the base floor because ${renderSelfJudgeExclusion(exclusion)}]`,
  });

const renderCoverageFailure = (failure: CoverageComparisonFailure): string =>
  Match.value(failure).pipe(
    Match.tag(
      "baseline-drop",
      (drop) =>
        `  - ${coverageDiagnosticFragment(drop.packageName)} (${coverageFailureLocation(drop)}) ${drop.metric}: ${drop.actual} < ${drop.baseline}${renderWithheldLowering(drop)}`
    ),
    Match.tag(
      "new-uncovered-file",
      (newFile) =>
        `  - ${coverageDiagnosticFragment(newFile.packageName)} (${coverageFailureLocation(newFile)}) ${newFile.metric}: new file has ${newFile.uncovered} uncovered unit(s) at ${newFile.actual}% (no baseline file identity)`
    ),
    Match.tag(
      "row-raised-beyond-reach",
      (raised) =>
        `  - ${coverageDiagnosticFragment(raised.packageName)} (${coverageFailureLocation(raised)}) ${raised.metric}: row raised beyond hosted reach: this pull request raised the row from ${raised.base} (${raised.baseUncovered} uncovered) to ${raised.proposed} (${raised.proposedUncovered} uncovered) but the lane measured ${raised.actual} (${raised.actualUncovered} uncovered)`
    ),
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

const encodeCoverageFileBaselineSync = S.encodeSync(CoverageFileBaseline);

const renderLoweredFloor = (floor: CoverageLoweredFloor): string =>
  `  - ${coverageDiagnosticFragment(floor.packageName)} (${coverageDiagnosticFragment(O.getOrElse(floor.filePath, () => floor.packagePath))}) ${floor.metric}: ${floor.base} -> ${floor.lowered}; lane measured ${floor.actual}${floor.tighten ? " (tighten: adopt the measured row)" : ""}`;

/**
 * Render the floors this pull request lowered on packages it could not have
 * moved.
 *
 * **Details**
 *
 * The block is the evidence for a green run and the context for a red one, so
 * it is printed in both directions: through the ratchet's tighten slot when the
 * run passes, and inside the regression block when it fails.
 *
 * **Example** (Nothing was lowered)
 *
 * ```ts
 * import { CoverageComparisonResult, renderCoverageLoweredFloors } from "@beep/repo-cli/test/Quality"
 *
 * const clean = CoverageComparisonResult.make({
 *   comparedCount: 0,
 *   failures: [],
 *   raisedRowFailures: [],
 *   raisedRowsJudged: 0,
 *   minimumFailures: [],
 *   missingActuals: [],
 *   newPackages: [],
 *   followUpDebt: []
 * })
 * console.log(renderCoverageLoweredFloors(clean)) // []
 * ```
 *
 * @param result - Comparison result the ratchet is about to report.
 * @returns The lowered-floor block, empty when no floor was lowered.
 * @category formatting
 * @since 0.0.0
 */
export const renderCoverageLoweredFloors = (result: CoverageComparisonResult): ReadonlyArray<string> =>
  A.match(result.loweredFloors, {
    onEmpty: A.empty<string>,
    onNonEmpty: (floors) => [
      `[coverage-ratchet] ${A.length(floors)} floor(s) lowered by this pull request on packages it could not have moved (judged at the lowered value):`,
      ...A.map(floors, renderLoweredFloor),
    ],
  });

/**
 * Render the rows this run measured for every path a failure reported.
 *
 * **Details**
 *
 * Each line is a committed-document fragment: the package total and the file
 * row for a reported path, encoded through {@link CoverageFileBaseline} so the
 * field order matches the baseline writer's own output.
 *
 * **Example** (Nothing failed, so nothing is proposed)
 *
 * ```ts
 * import { CoverageComparisonResult, renderCoverageMeasuredRowProposals } from "@beep/repo-cli/test/Quality"
 *
 * const clean = CoverageComparisonResult.make({
 *   comparedCount: 0,
 *   failures: [],
 *   raisedRowFailures: [],
 *   raisedRowsJudged: 0,
 *   minimumFailures: [],
 *   missingActuals: [],
 *   newPackages: [],
 *   followUpDebt: []
 * })
 * console.log(renderCoverageMeasuredRowProposals(clean)) // []
 * ```
 *
 * @param result - Comparison result the ratchet is about to report.
 * @returns The measured-row block, empty when no failure named a path.
 * @category formatting
 * @since 0.0.0
 */
export const renderCoverageMeasuredRowProposals = (result: CoverageComparisonResult): ReadonlyArray<string> =>
  A.match(result.measuredProposals, {
    onEmpty: A.empty<string>,
    onNonEmpty: (proposals) => [
      `[coverage-ratchet] measured rows for the reported paths (hosted evidence; paste into ${coverageRegressionBaselinePath}):`,
      ...A.map(
        proposals,
        (proposal) =>
          `  ${JSON.stringify(proposal.packageName)} ${O.match(proposal.filePath, {
            onNone: () => "totals",
            onSome: (filePath) => `files[${JSON.stringify(filePath)}]`,
          })}: ${JSON.stringify(encodeCoverageFileBaselineSync(proposal.row))}`
      ),
    ],
  });

const renderPackageRowRemovals = (removals: ReadonlyArray<CoveragePackageRowRemovedFailure>): ReadonlyArray<string> =>
  A.match(removals, {
    onEmpty: A.empty<string>,
    onNonEmpty: (present) => [
      "[coverage-ratchet] baseline package row(s) removed while the lane still measures the package:",
      ...A.map(
        present,
        (removal) =>
          `  - ${coverageDiagnosticFragment(removal.packageName)} (${coverageDiagnosticFragment(removal.packagePath)}) has no row in this pull request's document; only a deleted workspace may lose its rows`
      ),
    ],
  });

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
    ...A.match(result.raisedRowFailures, {
      onEmpty: A.empty<string>,
      onNonEmpty: (failures) => [
        "[coverage-ratchet] baseline row(s) raised beyond hosted reach (judged against this pull request's own rows, not the base floors):",
        ...renderCoverageFailuresForTesting(failures),
      ],
    }),
    ...renderPackageRowRemovals(result.packageRowRemovals),
    ...renderCoverageLoweredFloors(result),
    ...renderCoverageMeasuredRowProposals(result),
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

const failuresWithTag = (
  failures: ReadonlyArray<CoverageComparisonFailure>,
  tag: CoverageComparisonFailure["_tag"]
): ReadonlyArray<CoverageComparisonFailure> => A.filter(failures, (failure) => failure._tag === tag);

const failureLocations = (failures: ReadonlyArray<CoverageComparisonFailure>): ReadonlyArray<string> =>
  pipe(A.map(failures, coverageFailureLocation), A.dedupe, A.sort(Order.String));

const droppedRowRemediation = (result: CoverageComparisonResult): ReadonlyArray<string> =>
  result.basePinned
    ? [
        ...A.match(
          failurePackageNames(
            A.filter(
              failuresWithTag(result.failures, "baseline-drop"),
              (failure) => !A.contains(result.selfJudgeEligiblePackageNames, failure.packageName)
            )
          ),
          {
            onEmpty: A.empty<string>,
            onNonEmpty: (packageNames) => [
              `[coverage-ratchet] remediation: ${sanitizeCoverageDiagnostic(A.join(packageNames, ", "))} lost coverage on rows judged at the base floors; restore it with tests. Rows for packages this pull request changed (or could have changed through a dependency or a global input) are judged at the base floor; lowering such a row in this pull request does not pass.`,
            ],
          }
        ),
        ...A.match(
          failureLocations(
            A.filter(failuresWithTag(result.failures, "baseline-drop"), (failure) =>
              A.contains(result.selfJudgeEligiblePackageNames, failure.packageName)
            )
          ),
          {
            onEmpty: A.empty<string>,
            onNonEmpty: (locations) => [
              `[coverage-ratchet] remediation: this pull request changed nothing that runs under ${sanitizeCoverageDiagnostic(A.join(locations, ", "))}. If main's latest run reports the same row, set the row to the measured value printed above (it is judged at that value on this pull request). Otherwise restore the coverage.`,
            ],
          }
        ),
      ]
    : A.match(failurePackageNames(failuresWithTag(result.failures, "baseline-drop")), {
        onEmpty: A.empty<string>,
        onNonEmpty: (packageNames) => [
          `[coverage-ratchet] remediation: ${sanitizeCoverageDiagnostic(A.join(packageNames, ", "))} lost coverage on rows judged at the committed floors; restore it with tests. If the rows are right and this run measures lower, open a pull request that lowers only those rows to the values printed above; a pull request that changes nothing under a row is judged at its own value for that row.`,
        ],
      });

/**
 * Render the remediation block the ratchet prints after a regression.
 *
 * **Details**
 *
 * A drop on an existing row never names the writer: the row is judged at a
 * floor the writer cannot move here, so the only outcomes are restoring the
 * coverage or — on a package this pull request could not have moved — adopting
 * the measured value printed above. Rows a pull request raised beyond what the
 * lane measured get a lower-the-row hint for the same reason. A newly uncovered
 * file has no row to judge, so it is the one drop the scoped writer can
 * legitimately record. Tier-minimum breaches get a restore-only hint: the
 * writer records floors, it cannot lift a package above the repository tier.
 * Missing summaries and disposition gaps get no command because they are
 * configuration problems, not floors.
 *
 * **Gotchas**
 *
 * Pull-request framing only applies to a base-pinned run, which is the only one
 * that read a branch document. An unpinned run — a push to `main`, a local run
 * without `TURBO_SCM_BASE` — has no pull request and no self-judge exit, so it
 * gets the restore-or-open-a-restore-pull-request paragraph instead, naming no
 * command: the scoped writer holds packages the push did not change.
 *
 * **Example** (Nothing regressed)
 *
 * ```ts
 * import { CoverageComparisonResult, renderCoverageRemediation } from "@beep/repo-cli/test/Quality"
 *
 * const clean = CoverageComparisonResult.make({
 *   comparedCount: 0,
 *   failures: [],
 *   raisedRowFailures: [],
 *   raisedRowsJudged: 0,
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
 * @category formatting
 * @since 0.0.0
 */
export const renderCoverageRemediation = (result: CoverageComparisonResult): ReadonlyArray<string> => [
  ...droppedRowRemediation(result),
  ...A.match(failurePackageNames(failuresWithTag(result.failures, "new-uncovered-file")), {
    onEmpty: A.empty<string>,
    onNonEmpty: (packageNames) => [
      "[coverage-ratchet] remediation: cover the new file(s) with tests, or, once a reviewer accepts the new rows, record them:",
      `  ${sanitizeCoverageDiagnostic(coverageScopedBaselineWriteCommand(packageNames))}`,
      result.basePinned
        ? "  (packages that own no changed file are held; rows it raises are judged on this pull request)"
        : "  (packages that own no changed file are held; pass --replace-all to re-measure them)",
    ],
  }),
  ...A.match(failurePackageNames(result.raisedRowFailures), {
    onEmpty: A.empty<string>,
    onNonEmpty: (packageNames) => [
      `[coverage-ratchet] remediation: ${sanitizeCoverageDiagnostic(A.join(packageNames, ", "))} carry row(s) this pull request raised above what the hosted lane measures; set each named row in ${coverageRegressionBaselinePath} to the measured value or lower. A local regeneration minted these floors and cannot prove them; merged as-is they turn main red on its first push.`,
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
    const baselines = yield* readComparisonBaseline(repoRoot);
    const baseline = baselines.baseline;
    const actuals = yield* collectCoverageSnapshot(repoRoot);
    const result = compareCoverage(baselines, actuals, scoped, expectedPackageNames);
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
            A.isReadonlyArrayNonEmpty(result.raisedRowFailures) ||
            A.isReadonlyArrayNonEmpty(result.packageRowRemovals) ||
            A.isReadonlyArrayNonEmpty(result.minimumFailures) ||
            A.isReadonlyArrayNonEmpty(result.missingActuals) ||
            A.isReadonlyArrayNonEmpty(dispositionGaps),
          lines: regressionLines(result, dispositionGaps),
          error: QualityTaskFailed.new(1, "coverage:ratchet", "beep-cli coverage"),
        },
      ],
      okLine: A.join(
        [
          `[coverage-ratchet] ok: compared ${result.comparedCount} package(s) with epsilon ${baseline.epsilon}`,
          ...O.match(baselines.proposed, {
            onNone: A.empty<string>,
            onSome: () => [
              `${result.raisedRowsJudged} raised row metric(s) judged against this pull request's own rows`,
              `${A.length(result.loweredFloors)} floor(s) lowered on packages it could not have moved`,
            ],
          }),
        ],
        "; "
      ),
      // A green run still owes the operator the floors it accepted and the
      // measured values that would tighten them again.
      tighten: A.match(renderCoverageLoweredFloors(result), {
        onEmpty: () => O.none<ReadonlyArray<string>>(),
        onNonEmpty: O.some<ReadonlyArray<string>>,
      }),
    });
  }
);
