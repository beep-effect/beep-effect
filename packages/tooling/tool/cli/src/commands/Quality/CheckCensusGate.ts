/**
 * Single-checker instantiation gate of the check census: measures baselined
 * tsconfig programs with `tsc --singleThreaded --extendedDiagnostics`,
 * compares them against the committed `check-census-baseline/v1` document,
 * and re-measures that document on request.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { formatJsonc, readArtifact, writeArtifact } from "@beep/repo-cli-kit/artifacts/index";
import { runCaptured } from "@beep/repo-cli-kit/process/index";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { A, Str, thunkEmptyStr, thunkTrue } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { compilerOutputLines, isCompilerDiagnosticLine, nameFilterPredicate } from "./internal/CheckCensusOutput.ts";
import { QualityScriptCommandError } from "./Quality.errors.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Quality/CheckCensusGate");

/**
 * Repository-relative path of the committed single-checker baseline.
 *
 * **Example** (Resolve the committed baseline)
 *
 * ```ts
 * import { CHECK_CENSUS_BASELINE_PATH } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CHECK_CENSUS_BASELINE_PATH) // "standards/check-census.regression-baseline.jsonc"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_BASELINE_PATH = "standards/check-census.regression-baseline.jsonc";

/**
 * Advisory check-time tolerance, in percent of the baselined check time.
 *
 * **Details**
 *
 * Wall-clock check time moves a few percent between runs of the same tree, so
 * a change inside the band is reported as noise and a change outside it is a
 * review flag, never a failure (goal-time rulings 2026-09-16 and 2026-09-29).
 *
 * **Example** (Read the band)
 *
 * ```ts
 * import { CHECK_CENSUS_CHECK_TIME_BAND_PERCENT } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CHECK_CENSUS_CHECK_TIME_BAND_PERCENT) // 5
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_CHECK_TIME_BAND_PERCENT = 5;

/**
 * Instantiation noise floor: the largest difference between two single-checker
 * samples of the same program that still counts as unchanged.
 *
 * **Details**
 *
 * tsgo's instantiation count is not byte-deterministic, even with
 * `--singleThreaded` and a fresh build-info file. Repeated samples of one tree
 * (2026-10-27, `7.0.2+effect-tsgo.0.59.0`) measured `@beep/law-practice-domain`
 * at 819,367 to 819,375 and `@beep/git` at 110,792 to 110,801, while
 * `@beep/schema` and `@beep/repo-cli` repeated exactly. Without a floor an
 * unchanged program could fail the gate, or print a tighten hint, at random. A
 * difference of at most this many instantiations is `unchanged`; only a larger
 * one is an `increase` or a `decrease`.
 *
 * **Example** (Read the noise floor)
 *
 * ```ts
 * import { CHECK_CENSUS_INSTANTIATION_NOISE } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CHECK_CENSUS_INSTANTIATION_NOISE) // 32
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_INSTANTIATION_NOISE = 32;

/**
 * Growth tolerance of a band row, in percent of the row's baselined
 * single-checker instantiation count.
 *
 * **Details**
 *
 * A band row ({@link CheckCensusBandRow}) fails only when its instantiations
 * grow by more than this share of its baseline. Growth above
 * {@link CHECK_CENSUS_INSTANTIATION_NOISE} but within the band is reported
 * with its delta and percent and passes. `@beep/repo-cli` grew four times in
 * five hours on 2026-11-13 (+1,192, +42,855, +26,373 from a compiler bump,
 * then +49,447), so the noise floor alone would fail most of its pull requests
 * and make the baseline a merge-conflict magnet. Strict rows keep the noise
 * floor as their only tolerance.
 *
 * Band growth is cumulative against a stored baseline, so the pull request
 * that goes red is whichever one crosses the line, not the one that caused
 * the growth. At 5% that was about every six days for `@beep/repo-cli`
 * (14.6% in 17 days); 10% is about every twelve days and still catches a
 * single real step change.
 *
 * **Example** (Read the band)
 *
 * ```ts
 * import { CHECK_CENSUS_BAND_ROW_PERCENT } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CHECK_CENSUS_BAND_ROW_PERCENT) // 10
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_BAND_ROW_PERCENT = 10;

/**
 * The baseline rows judged against {@link CHECK_CENSUS_BAND_ROW_PERCENT}
 * instead of the noise floor alone.
 *
 * **Details**
 *
 * Both are large application programs whose count moves with ordinary
 * feature work. A row named nowhere here is strict, so a newly baselined row
 * fails on any growth above the noise floor until it is added to this list.
 * The class lives in code, not in the machine-written baseline.
 *
 * **Example** (Recognise a band row)
 *
 * ```ts
 * import { CheckCensusBandRow } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CheckCensusBandRow)("@beep/repo-cli")) // true
 * console.log(S.is(CheckCensusBandRow)("@beep/schema")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CheckCensusBandRow = LiteralKit(["@beep/repo-cli", "@beep/law-practice-domain"]).pipe(
  $I.annoteSchema("CheckCensusBandRow", {
    description: "A check-census baseline row whose instantiation growth fails only beyond the band percent.",
  })
);

/**
 * Runtime type of {@link CheckCensusBandRow}.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckCensusBandRow = typeof CheckCensusBandRow.Type;

/**
 * How a baseline row's instantiation growth is judged.
 *
 * **Details**
 *
 * `strict`: growth above {@link CHECK_CENSUS_INSTANTIATION_NOISE} fails.
 * `band`: growth fails only above {@link CHECK_CENSUS_BAND_ROW_PERCENT} of the
 * row's baseline; smaller growth above the noise floor is reported. Both
 * classes print the same tighten hint for a decrease.
 *
 * **Example** (Name the tolerant class)
 *
 * ```ts
 * import { CheckCensusRowClass } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CheckCensusRowClass.Enum.band) // "band"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CheckCensusRowClass = LiteralKit(["strict", "band"]).pipe(
  $I.annoteSchema("CheckCensusRowClass", {
    description:
      "strict: instantiation growth above the noise floor fails; band: growth fails only beyond the band percent.",
  })
);

/**
 * Runtime type of {@link CheckCensusRowClass}.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckCensusRowClass = typeof CheckCensusRowClass.Type;

const isBandRowName = S.is(CheckCensusBandRow);

/**
 * The class of a baseline row, by its name.
 *
 * **Example** (Class a package row and a fixture row)
 *
 * ```ts
 * import { checkCensusRowClass } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(checkCensusRowClass("@beep/law-practice-domain")) // "band"
 * console.log(checkCensusRowClass("@beep/schema#typeperf/baseline")) // "strict"
 * ```
 *
 * @param name - The baseline row's name.
 * @returns `band` for a {@link CheckCensusBandRow}, otherwise `strict`.
 * @category use-cases
 * @since 0.0.0
 */
export const checkCensusRowClass = (name: string): CheckCensusRowClass =>
  isBandRowName(name) ? CheckCensusRowClass.Enum.band : CheckCensusRowClass.Enum.strict;

/**
 * The workspace package a baseline row belongs to: its name up to the first
 * `#`.
 *
 * **Details**
 *
 * Package rows are named after their package, and typeperf fixture rows
 * after the package that owns the fixture, followed by `#` and the fixture
 * (`@beep/schema#typeperf/baseline`), as Turbo spells a task id. The check
 * lane selects rows by this owner.
 *
 * **Example** (Read a fixture row's owner)
 *
 * ```ts
 * import { checkCensusRowPackage } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(checkCensusRowPackage("@beep/schema#typeperf/baseline")) // "@beep/schema"
 * console.log(checkCensusRowPackage("@beep/repo-cli")) // "@beep/repo-cli"
 * ```
 *
 * @param name - The baseline row's name.
 * @returns The owning workspace package name.
 * @category use-cases
 * @since 0.0.0
 */
export const checkCensusRowPackage = (name: string): string => A.headNonEmpty(Str.split(name, "#"));

/**
 * The one command that re-measures every baseline row.
 *
 * **Example** (Print the remediation)
 *
 * ```ts
 * import { CHECK_CENSUS_BASELINE_WRITE_COMMAND } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CHECK_CENSUS_BASELINE_WRITE_COMMAND)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_BASELINE_WRITE_COMMAND = "bun run beep quality check-census --write-baseline";

// The measurement recipe the retirement train records by hand; the sampler
// spawns the same `node_modules/.bin/tsc` that `bun run tsc` resolves to.
const CHECK_CENSUS_SAMPLE_COMMAND =
  "bun run tsc -p <tsconfig> --noEmit --extendedDiagnostics --singleThreaded --tsBuildInfoFile <fresh>";

const baselineHeader = A.join(
  [
    "// Check-census single-checker baseline (check-census-baseline/v1). Do not edit by hand.",
    `// Re-measure every row with one command: ${CHECK_CENSUS_BASELINE_WRITE_COMMAND}`,
    "// It needs a built tree: build each row's upstream declarations first, for example",
    "// bunx turbo run build --filter='@beep/repo-cli^...' --filter='@beep/law-practice-domain^...'.",
    `// Gate: single-checker instantiations must not grow by more than ${CHECK_CENSUS_INSTANTIATION_NOISE} on a strict row, nor by more`,
    `// than ${CHECK_CENSUS_BAND_ROW_PERCENT}% since measuredAt on a band row (classes live in CheckCensusGate.ts, not here) (failure);`,
    `// check time is advisory within a ${CHECK_CENSUS_CHECK_TIME_BAND_PERCENT}% band; an instantiation decrease prints a tighten hint.`,
    "// A write refuses any sample whose compiler output reports a type error.",
    "",
  ],
  "\n"
);

const CensusMetric = S.Natural.pipe(
  $I.annoteSchema("CensusMetric", {
    description: "Non-negative count or millisecond value read from one `tsc --extendedDiagnostics` run.",
  })
);

const checkCensusSampleFields = {
  instantiations: CensusMetric,
  types: CensusMetric,
  checkTimeMs: CensusMetric,
} as const;

/**
 * One program the gate measures: a display name and the repository-relative
 * tsconfig passed to `tsc -p`.
 *
 * **Example** (Name a package program)
 *
 * ```ts
 * import { CheckCensusTarget } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const target = CheckCensusTarget.make({
 *   name: "@beep/schema",
 *   tsconfig: "packages/foundation/modeling/schema/tsconfig.json",
 * })
 * console.log(target.tsconfig)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusTarget extends S.Class<CheckCensusTarget, { readonly brand: unique symbol }>(
  $I`CheckCensusTarget`
)(
  {
    name: S.String,
    tsconfig: S.String,
  },
  $I.annote("CheckCensusTarget", {
    description: "Display name and repository-relative tsconfig of one program measured by the check-census gate.",
  })
) {}

/**
 * The programs the gate measures, in two sections: workspace packages and
 * compile-only typeperf fixtures.
 *
 * **Example** (Name one package and one fixture)
 *
 * ```ts
 * import { CheckCensusTarget, CheckCensusTargets } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const targets = CheckCensusTargets.make({
 *   packages: [CheckCensusTarget.make({ name: "@beep/schema", tsconfig: "packages/foundation/modeling/schema/tsconfig.json" })],
 *   typeperfFixtures: [
 *     CheckCensusTarget.make({
 *       name: "@beep/schema#typeperf/baseline",
 *       tsconfig: "packages/foundation/modeling/schema/test/fixtures/typeperf/tsconfig.baseline.json",
 *     }),
 *   ],
 * })
 * console.log(targets.typeperfFixtures.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusTargets extends S.Opaque<CheckCensusTargets, { readonly brand: unique symbol }>()(
  S.Struct({
    packages: S.Array(CheckCensusTarget),
    typeperfFixtures: S.Array(CheckCensusTarget),
  }).pipe(
    $I.annoteSchema("CheckCensusTargets", {
      description: "Workspace-package and typeperf-fixture programs measured by the check-census gate.",
    })
  )
) {}

/**
 * One single-checker `--extendedDiagnostics` sample: instantiations, types,
 * and check time in milliseconds.
 *
 * **Example** (Build a sample)
 *
 * ```ts
 * import { CheckCensusSample } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const sample = CheckCensusSample.make({ instantiations: 710979, types: 202571, checkTimeMs: 961 })
 * console.log(sample.instantiations) // 710979
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusSample extends S.Opaque<CheckCensusSample, { readonly brand: unique symbol }>()(
  S.Struct(checkCensusSampleFields).pipe(
    $I.annoteSchema("CheckCensusSample", {
      description: "Instantiations, types, and check time of one single-checker tsc --extendedDiagnostics run.",
    })
  )
) {}

/**
 * One baselined program with its committed single-checker sample.
 *
 * **Example** (Describe a baseline row)
 *
 * ```ts
 * import { CheckCensusBaselineRow } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const row = CheckCensusBaselineRow.make({
 *   name: "@beep/schema",
 *   tsconfig: "packages/foundation/modeling/schema/tsconfig.json",
 *   instantiations: 710979,
 *   types: 202571,
 *   checkTimeMs: 961,
 * })
 * console.log(row.name) // "@beep/schema"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusBaselineRow extends CheckCensusTarget.extend<CheckCensusBaselineRow>(
  $I`CheckCensusBaselineRow`
)(
  checkCensusSampleFields,
  $I.annote("CheckCensusBaselineRow", {
    description: "A baselined program and the single-checker sample committed for it.",
  })
) {}

/**
 * The committed `check-census-baseline/v1` document.
 *
 * **Details**
 *
 * `commit` is `HEAD` when the rows were measured and `dirtyWorktree` says
 * whether uncommitted changes were part of the measured tree. `compiler` is
 * the `tsc --version` string; a gate run on a different compiler cannot
 * compare instantiation counts and asks for a re-measure instead. Package
 * rows and compile-only typeperf fixture rows live in separate sections; the
 * gate compares both, packages first.
 *
 * **Example** (Build an empty baseline)
 *
 * ```ts
 * import { CheckCensusBaseline } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const baseline = CheckCensusBaseline.make({
 *   measuredAt: "2026-09-29T00:00:00.000Z",
 *   commit: "368998daff",
 *   dirtyWorktree: false,
 *   compiler: "7.0.2+effect-tsgo.0.45.0",
 *   command: "bun run tsc -p <tsconfig> --noEmit --extendedDiagnostics --singleThreaded",
 *   checkTimeBandPercent: 5,
 *   packages: [],
 *   typeperfFixtures: [],
 * })
 * console.log(baseline.schemaVersion) // "check-census-baseline/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusBaseline extends S.Opaque<CheckCensusBaseline, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("check-census-baseline/v1"),
    measuredAt: S.String,
    commit: S.String,
    dirtyWorktree: S.Boolean,
    compiler: S.String,
    command: S.String,
    checkTimeBandPercent: S.tag(CHECK_CENSUS_CHECK_TIME_BAND_PERCENT),
    packages: S.Array(CheckCensusBaselineRow),
    typeperfFixtures: S.Array(CheckCensusBaselineRow),
  }).pipe(
    $I.annoteSchema("CheckCensusBaseline", {
      description: "Committed single-checker instantiation, type, and check-time baseline of the check-census gate.",
    })
  )
) {}

/**
 * The `--extendedDiagnostics` labels the gate reads.
 *
 * **Example** (Guard a label)
 *
 * ```ts
 * import { CheckCensusMetricLabel } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CheckCensusMetricLabel.is["Check time"]("Check time")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CheckCensusMetricLabel = LiteralKit(["Instantiations", "Types", "Check time"]).pipe(
  $I.annoteSchema("CheckCensusMetricLabel", {
    description: "An --extendedDiagnostics line label the check-census gate parses.",
  })
);

/**
 * Runtime type of {@link CheckCensusMetricLabel}.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckCensusMetricLabel = typeof CheckCensusMetricLabel.Type;

/**
 * Hard verdict on a program's single-checker instantiation count.
 *
 * **Details**
 *
 * `increase` fails the gate: growth above the noise floor on a strict row, or
 * above the band on a band row. `within-band` is a band row's growth above
 * the noise floor but within {@link CHECK_CENSUS_BAND_ROW_PERCENT}; it is
 * reported and passes. `decrease` asks to tighten the baseline.
 *
 * **Example** (Name the failing verdict)
 *
 * ```ts
 * import { CheckCensusInstantiationVerdict } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CheckCensusInstantiationVerdict.Enum.increase) // "increase"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CheckCensusInstantiationVerdict = LiteralKit(["increase", "within-band", "unchanged", "decrease"]).pipe(
  $I.annoteSchema("CheckCensusInstantiationVerdict", {
    description:
      "Instantiation count against the baseline: an increase fails the gate, growth within a band row's band is reported, a decrease asks to tighten.",
  })
);

/**
 * Runtime type of {@link CheckCensusInstantiationVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckCensusInstantiationVerdict = typeof CheckCensusInstantiationVerdict.Type;

/**
 * Advisory verdict on a program's check time against the tolerance band.
 *
 * **Example** (Name the advisory verdict)
 *
 * ```ts
 * import { CheckCensusCheckTimeVerdict } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CheckCensusCheckTimeVerdict.Enum.slower) // "slower"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CheckCensusCheckTimeVerdict = LiteralKit(["within-band", "slower", "faster"]).pipe(
  $I.annoteSchema("CheckCensusCheckTimeVerdict", {
    description: "Check time against the baseline: within the tolerance band, slower beyond it, or faster beyond it.",
  })
);

/**
 * Runtime type of {@link CheckCensusCheckTimeVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckCensusCheckTimeVerdict = typeof CheckCensusCheckTimeVerdict.Type;

/**
 * One baselined program compared with its fresh sample.
 *
 * **Example** (Detect an instantiation regression)
 *
 * ```ts
 * import { CheckCensusComparison } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const regressed = (comparison: CheckCensusComparison) => comparison.instantiations === "increase"
 * console.log(regressed.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusComparison extends S.Opaque<CheckCensusComparison, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    rowClass: CheckCensusRowClass,
    baseline: CheckCensusSample,
    current: CheckCensusSample,
    instantiations: CheckCensusInstantiationVerdict,
    checkTime: CheckCensusCheckTimeVerdict,
  }).pipe(
    $I.annoteSchema("CheckCensusComparison", {
      description:
        "Committed and fresh single-checker samples of one program with its row class and its instantiation and check-time verdicts.",
    })
  )
) {}

/**
 * Gate section of the census report: the baseline's path and provenance, the
 * compiler the fresh samples ran on, and one comparison per selected baseline
 * row.
 *
 * **Details**
 *
 * `baselinePath` is repository-relative and defaults to
 * {@link CHECK_CENSUS_BASELINE_PATH}; the CLI stamps its `--baseline` value.
 * `baselineMeasuredAt` and `baselineCommit` are the baseline's `measuredAt`
 * and `commit`: a band row's growth is cumulative since then, so its lines
 * name both. `filter` records the `--filter` text and `rowPackages` the
 * `--row-packages` owners that selected the rows, so an empty selection can
 * name them.
 *
 * **Example** (Build an empty gate report)
 *
 * ```ts
 * import { CheckCensusGateReport } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const report = CheckCensusGateReport.make({
 *   baselineMeasuredAt: "2026-09-29T00:00:00.000Z",
 *   baselineCommit: "368998daff",
 *   baselineCompiler: "7.0.2+effect-tsgo.0.45.0",
 *   compiler: "7.0.2+effect-tsgo.0.45.0",
 *   comparisons: [],
 * })
 * console.log(report.comparisons.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusGateReport extends S.Opaque<CheckCensusGateReport, { readonly brand: unique symbol }>()(
  S.Struct({
    baselinePath: S.String.pipe(S.withConstructorDefault(Effect.succeed(CHECK_CENSUS_BASELINE_PATH))),
    baselineMeasuredAt: S.String,
    baselineCommit: S.String,
    baselineCompiler: S.String,
    compiler: S.String,
    filter: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    rowPackages: S.String.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeed(O.none<ReadonlyArray<string>>()))
    ),
    comparisons: S.Array(CheckCensusComparison),
  }).pipe(
    $I.annoteSchema("CheckCensusGateReport", {
      description: "Single-checker comparisons of every selected baseline row against fresh samples.",
    })
  )
) {}

/**
 * A sample refused because the compiler reported a type error or exited
 * non-zero; instantiation counts of a failing program are never recorded.
 *
 * **Example** (Refuse a failing program)
 *
 * ```ts
 * import { CheckCensusSampleRefused } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const error = CheckCensusSampleRefused.make({
 *   target: "@beep/schema",
 *   exitCode: 2,
 *   diagnostics: 1,
 *   message: "@beep/schema: refusing a sample with 1 type error(s)",
 * })
 * console.log(error._tag) // "CheckCensusSampleRefused"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CheckCensusSampleRefused extends S.TaggedError<
  CheckCensusSampleRefused,
  { readonly brand: unique symbol }
>($I`CheckCensusSampleRefused`)(
  "CheckCensusSampleRefused",
  {
    target: S.String,
    exitCode: S.Int,
    diagnostics: S.Natural,
    message: S.String,
  },
  $I.annoteError<CheckCensusSampleRefused>("CheckCensusSampleRefused", {
    description: "A check-census sample refused because tsc reported type errors or exited non-zero.",
  })
) {}

/**
 * A sample whose compiler output lacks one of the metrics the gate reads.
 *
 * **Example** (Report a missing metric)
 *
 * ```ts
 * import { CheckCensusMetricMissing } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const error = CheckCensusMetricMissing.make({
 *   target: "@beep/schema",
 *   metric: "Instantiations",
 *   message: "@beep/schema: tsc --extendedDiagnostics printed no Instantiations line",
 * })
 * console.log(error.metric) // "Instantiations"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CheckCensusMetricMissing extends S.TaggedError<
  CheckCensusMetricMissing,
  { readonly brand: unique symbol }
>($I`CheckCensusMetricMissing`)(
  "CheckCensusMetricMissing",
  {
    target: S.String,
    metric: CheckCensusMetricLabel,
    message: S.String,
  },
  $I.annoteError<CheckCensusMetricMissing>("CheckCensusMetricMissing", {
    description: "A check-census sample whose --extendedDiagnostics output lacks a metric line the gate reads.",
  })
) {}

/**
 * Every way one gate sample can fail.
 *
 * @category errors
 * @since 0.0.0
 */
export type CheckCensusSampleError = CheckCensusSampleRefused | CheckCensusMetricMissing | QualityScriptCommandError;

const instantiationsPattern = /^Instantiations:\s+(\d+)$/u;
const typesPattern = /^Types:\s+(\d+)$/u;
const checkTimePattern = /^Check time:\s+(\d+(?:\.\d+)?)s$/u;
const compilerVersionPattern = /^Version\s+(\S+)$/u;

const firstCapture = (lines: ReadonlyArray<string>, pattern: RegExp): O.Option<string> =>
  pipe(
    A.findFirst(lines, Str.match(pattern)),
    O.flatMap((match) => A.get(match, 1))
  );

const readMetric = (
  target: string,
  lines: ReadonlyArray<string>,
  metric: CheckCensusMetricLabel,
  pattern: RegExp,
  toValue: (parsed: number) => number
): Result.Result<number, CheckCensusMetricMissing> =>
  pipe(
    firstCapture(lines, pattern),
    O.flatMap(Num.parse),
    O.map(toValue),
    Result.fromOption(() =>
      CheckCensusMetricMissing.make({
        target,
        metric,
        message: `${target}: tsc --extendedDiagnostics printed no parsable ${metric} line`,
      })
    )
  );

const secondsToMillis = (seconds: number): number => Num.round(seconds * 1000, 0);

// The two fields of a captured compiler run the sample parser reads.
type CapturedCompilerRun = { readonly exitCode: number; readonly output: string };

/**
 * Read instantiations, types, and check time from `tsc --extendedDiagnostics`
 * output.
 *
 * **Details**
 *
 * Only the metric lines are read; diagnostics are not judged here (see
 * {@link parseCheckCensusSample} for the refusing parser the gate uses).
 * Check time is printed in seconds and recorded in whole milliseconds.
 *
 * **Example** (Read a sample)
 *
 * ```ts
 * import { readCheckCensusMetrics } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 * import * as Result from "effect/Result"
 *
 * const sample = readCheckCensusMetrics("Types: 10\nInstantiations: 42\nCheck time: 0.961s\n", "demo")
 * console.log(Result.isSuccess(sample)) // true
 * ```
 *
 * @param output - Captured compiler output.
 * @param target - Name used in the error when a metric is missing.
 * @returns The sample, or the first missing metric.
 * @category parsing
 * @since 0.0.0
 */
export const readCheckCensusMetrics: {
  (target: string): (output: string) => Result.Result<CheckCensusSample, CheckCensusMetricMissing>;
  (output: string, target: string): Result.Result<CheckCensusSample, CheckCensusMetricMissing>;
} = dual(2, (output: string, target: string): Result.Result<CheckCensusSample, CheckCensusMetricMissing> => {
  const lines = compilerOutputLines(output);

  return pipe(
    Result.all({
      instantiations: readMetric(target, lines, "Instantiations", instantiationsPattern, Num.round(0)),
      types: readMetric(target, lines, "Types", typesPattern, Num.round(0)),
      checkTimeMs: readMetric(target, lines, "Check time", checkTimePattern, secondsToMillis),
    }),
    Result.map(CheckCensusSample.make)
  );
});

const refusedSample = (
  target: string,
  exitCode: number,
  diagnostics: ReadonlyArray<string>
): CheckCensusSampleRefused =>
  CheckCensusSampleRefused.make({
    target,
    exitCode,
    diagnostics: A.length(diagnostics),
    message: O.match(A.head(diagnostics), {
      onNone: () => `${target}: refusing a sample: tsc exited ${exitCode} without reporting a type error`,
      onSome: (first) =>
        `${target}: refusing a sample with ${A.length(diagnostics)} type error(s) (tsc exit ${exitCode}); first: ${first}`,
    }),
  });

/**
 * Parse one gate sample, refusing any run that reported a type error or
 * exited non-zero.
 *
 * **Details**
 *
 * A program that does not type-check has no meaningful instantiation count,
 * so the gate never compares or records it. Both pretty and plain diagnostic
 * formats contain `error TS<code>`, which is what the refusal matches.
 *
 * **Example** (Refuse a failing run)
 *
 * ```ts
 * import { parseCheckCensusSample } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 * import * as Result from "effect/Result"
 *
 * const parsed = parseCheckCensusSample(
 *   {
 *     exitCode: 2,
 *     output: "src/a.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.\nInstantiations: 42\n",
 *   },
 *   "demo"
 * )
 * console.log(Result.isFailure(parsed)) // true
 * ```
 *
 * @param captured - Exit code and combined compiler output.
 * @param target - Name of the measured program.
 * @returns The sample, or the refusal / missing-metric error.
 * @category parsing
 * @since 0.0.0
 */
export const parseCheckCensusSample: {
  (
    target: string
  ): (
    captured: CapturedCompilerRun
  ) => Result.Result<CheckCensusSample, CheckCensusSampleRefused | CheckCensusMetricMissing>;
  (
    captured: CapturedCompilerRun,
    target: string
  ): Result.Result<CheckCensusSample, CheckCensusSampleRefused | CheckCensusMetricMissing>;
} = dual(
  2,
  (
    captured: CapturedCompilerRun,
    target: string
  ): Result.Result<CheckCensusSample, CheckCensusSampleRefused | CheckCensusMetricMissing> => {
    const diagnostics = A.filter(compilerOutputLines(captured.output), isCompilerDiagnosticLine);

    return A.isReadonlyArrayEmpty(diagnostics) && captured.exitCode === 0
      ? readCheckCensusMetrics(captured.output, target)
      : Result.fail(refusedSample(target, captured.exitCode, diagnostics));
  }
);

// Integer arithmetic keeps the band edge exact: growth of exactly the band
// percent is still within it, and a zero baseline has no band at all.
const growthVerdictOf = (
  rowClass: CheckCensusRowClass,
  baseline: number,
  delta: number
): CheckCensusInstantiationVerdict =>
  rowClass === CheckCensusRowClass.Enum.band && delta * 100 <= baseline * CHECK_CENSUS_BAND_ROW_PERCENT
    ? CheckCensusInstantiationVerdict.Enum["within-band"]
    : CheckCensusInstantiationVerdict.Enum.increase;

const instantiationVerdictOf = (
  rowClass: CheckCensusRowClass,
  baseline: number,
  current: number
): CheckCensusInstantiationVerdict =>
  Match.value(current - baseline).pipe(
    Match.when(
      (delta) => delta > CHECK_CENSUS_INSTANTIATION_NOISE,
      (delta) => growthVerdictOf(rowClass, baseline, delta)
    ),
    Match.when(
      (delta) => delta < -CHECK_CENSUS_INSTANTIATION_NOISE,
      () => CheckCensusInstantiationVerdict.Enum.decrease
    ),
    Match.orElse(() => CheckCensusInstantiationVerdict.Enum.unchanged)
  );

// Integer arithmetic keeps the band exact and defined for a zero baseline.
const checkTimeVerdictOf = (baselineMs: number, currentMs: number): CheckCensusCheckTimeVerdict =>
  Match.value(currentMs * 100).pipe(
    Match.when(
      (scaled) => scaled > baselineMs * (100 + CHECK_CENSUS_CHECK_TIME_BAND_PERCENT),
      () => CheckCensusCheckTimeVerdict.Enum.slower
    ),
    Match.when(
      (scaled) => scaled < baselineMs * (100 - CHECK_CENSUS_CHECK_TIME_BAND_PERCENT),
      () => CheckCensusCheckTimeVerdict.Enum.faster
    ),
    Match.orElse(() => CheckCensusCheckTimeVerdict.Enum["within-band"])
  );

/**
 * Compare a fresh sample against its baseline row.
 *
 * **Details**
 *
 * Instantiations are compared outside a noise floor of
 * {@link CHECK_CENSUS_INSTANTIATION_NOISE}, and a difference within it is
 * `unchanged`. The row's {@link checkCensusRowClass} decides what growth
 * beyond the floor means: on a strict row it is the hard `increase` verdict;
 * on a band row it is `within-band` up to {@link CHECK_CENSUS_BAND_ROW_PERCENT}
 * of the baseline and `increase` beyond. A decrease beyond the floor is
 * `decrease` on either class.
 * Check time is compared against a {@link CHECK_CENSUS_CHECK_TIME_BAND_PERCENT}
 * percent band around the baselined value. Types are carried for the report
 * and receive no verdict.
 *
 * **Example** (Compare an unchanged program)
 *
 * ```ts
 * import {
 *   CheckCensusBaselineRow,
 *   CheckCensusSample,
 *   compareCheckCensusSample,
 * } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const row = CheckCensusBaselineRow.make({
 *   name: "@beep/schema",
 *   tsconfig: "packages/foundation/modeling/schema/tsconfig.json",
 *   instantiations: 100,
 *   types: 10,
 *   checkTimeMs: 1000,
 * })
 * const comparison = compareCheckCensusSample(CheckCensusSample.make({ instantiations: 100, types: 10, checkTimeMs: 1030 }), row)
 * console.log(comparison.instantiations, comparison.checkTime) // "unchanged" "within-band"
 * ```
 *
 * @param current - The fresh single-checker sample of the program.
 * @param row - The committed baseline row of the same program.
 * @returns The comparison with its instantiation and check-time verdicts.
 * @category use-cases
 * @since 0.0.0
 */
export const compareCheckCensusSample: {
  (row: CheckCensusBaselineRow): (current: CheckCensusSample) => CheckCensusComparison;
  (current: CheckCensusSample, row: CheckCensusBaselineRow): CheckCensusComparison;
} = dual(2, (current: CheckCensusSample, row: CheckCensusBaselineRow): CheckCensusComparison => {
  const rowClass = checkCensusRowClass(row.name);

  return CheckCensusComparison.make({
    name: row.name,
    rowClass,
    baseline: CheckCensusSample.make({
      instantiations: row.instantiations,
      types: row.types,
      checkTimeMs: row.checkTimeMs,
    }),
    current,
    instantiations: instantiationVerdictOf(rowClass, row.instantiations, current.instantiations),
    checkTime: checkTimeVerdictOf(row.checkTimeMs, current.checkTimeMs),
  });
});

// Structural, so a gate report and a stamp-only check judge a compiler change
// the same way.
const compilerChanged = (stamps: Pick<CheckCensusGateReport, "baselineCompiler" | "compiler">): boolean =>
  stamps.compiler !== stamps.baselineCompiler;

/**
 * The compiler a committed baseline was measured with next to the installed
 * compiler, as `check-census --stamp-only` compares them without sampling any
 * program.
 *
 * **Details**
 *
 * `baselinePath` is repository-relative and defaults to
 * {@link CHECK_CENSUS_BASELINE_PATH}; the CLI stamps its `--baseline` value.
 * `baselineCompiler` is the baseline's `compiler` field and `compiler` the
 * installed `tsc --version` string (without the `Version` prefix).
 *
 * **Example** (Stamp a baseline left behind by a compiler bump)
 *
 * ```ts
 * import { CheckCensusCompilerStamp } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const stamp = CheckCensusCompilerStamp.make({
 *   baselineCompiler: "7.0.2+effect-tsgo.0.67.5",
 *   compiler: "7.0.2+effect-tsgo.0.68.1",
 * })
 * console.log(stamp.baselinePath) // "standards/check-census.regression-baseline.jsonc"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusCompilerStamp extends S.Opaque<CheckCensusCompilerStamp, { readonly brand: unique symbol }>()(
  S.Struct({
    baselinePath: S.String.pipe(S.withConstructorDefault(Effect.succeed(CHECK_CENSUS_BASELINE_PATH))),
    baselineCompiler: S.String,
    compiler: S.String,
  }).pipe(
    $I.annoteSchema("CheckCensusCompilerStamp", {
      description: "Compiler a check-census baseline was measured with, next to the installed compiler.",
    })
  )
) {}

/**
 * Whether the installed compiler is the one the baseline was measured with,
 * so the baseline's single-checker counts are comparable.
 *
 * **Details**
 *
 * This is the comparison that makes {@link checkCensusGateFailed} fail a gate
 * run on a changed compiler, answered without sampling a program.
 *
 * **Example** (A bumped compiler disagrees with the baseline)
 *
 * ```ts
 * import { CheckCensusCompilerStamp, checkCensusCompilerStampAgrees } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const stamp = CheckCensusCompilerStamp.make({
 *   baselineCompiler: "7.0.2+effect-tsgo.0.67.5",
 *   compiler: "7.0.2+effect-tsgo.0.68.1",
 * })
 * console.log(checkCensusCompilerStampAgrees(stamp)) // false
 * ```
 *
 * @param stamp - The baseline and installed compiler strings.
 * @returns `true` when both compiler strings are equal.
 * @category use-cases
 * @since 0.0.0
 */
export const checkCensusCompilerStampAgrees = (stamp: CheckCensusCompilerStamp): boolean => !compilerChanged(stamp);

/**
 * The one line `check-census --stamp-only` prints when the compilers agree,
 * or fails with when they differ.
 *
 * **Details**
 *
 * A disagreement names the baseline path, both compiler versions, and
 * {@link CHECK_CENSUS_BASELINE_WRITE_COMMAND}, which re-measures every row and
 * needs a built tree.
 *
 * **Example** (Render an agreeing stamp)
 *
 * ```ts
 * import { CheckCensusCompilerStamp, renderCheckCensusCompilerStampLine } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const line = renderCheckCensusCompilerStampLine(
 *   CheckCensusCompilerStamp.make({ baselineCompiler: "7.0.2+effect-tsgo.0.68.1", compiler: "7.0.2+effect-tsgo.0.68.1" })
 * )
 * console.log(line) // "check-census stamp: baseline and installed compiler agree (7.0.2+effect-tsgo.0.68.1)"
 * ```
 *
 * @param stamp - The baseline and installed compiler strings.
 * @returns The agreement line, or the disagreement line with its re-measure command.
 * @category formatting
 * @since 0.0.0
 */
export const renderCheckCensusCompilerStampLine = (stamp: CheckCensusCompilerStamp): string =>
  checkCensusCompilerStampAgrees(stamp)
    ? `check-census stamp: baseline and installed compiler agree (${stamp.compiler})`
    : `check-census stamp: baseline ${stamp.baselinePath} was measured with ${stamp.baselineCompiler}, but the installed compiler is ${stamp.compiler}; re-measure with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\` (the write needs a built tree).`;

/**
 * The one line a `--defer-stale-stamp` gate prints instead of sampling when
 * the baseline was measured with another compiler.
 *
 * **Details**
 *
 * The Heavy / Check lane runs the gate with `--defer-stale-stamp`: a stale
 * baseline cannot be compared, and Repo Sanity's `check-census --stamp-only`
 * step already fails the pull request for it, so the lane names the stale
 * baseline, the re-measure command, and the step that owns the red, then
 * passes without sampling.
 *
 * **Example** (Defer a stale baseline)
 *
 * ```ts
 * import {
 *   CheckCensusCompilerStamp,
 *   renderCheckCensusStaleStampDeferralLine,
 * } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const line = renderCheckCensusStaleStampDeferralLine(
 *   CheckCensusCompilerStamp.make({ baselineCompiler: "7.0.2+effect-tsgo.0.67.5", compiler: "7.0.2+effect-tsgo.0.68.1" })
 * )
 * console.log(line.startsWith("check-census gate deferred:")) // true
 * ```
 *
 * @param stamp - The baseline and installed compiler strings, which differ.
 * @returns The deferral line naming both compilers, the re-measure command and the owning step.
 * @category formatting
 * @since 0.0.0
 */
export const renderCheckCensusStaleStampDeferralLine = (stamp: CheckCensusCompilerStamp): string =>
  `check-census gate deferred: baseline ${stamp.baselinePath} was measured with ${stamp.baselineCompiler}, but the installed compiler is ${stamp.compiler}, so the baseline is stale and must be re-measured with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\` (the write needs a built tree). Repo Sanity's stamp check (\`check-census --stamp-only\`) owns that red; this run samples nothing and passes.`;

const isIncrease = (comparison: CheckCensusComparison): boolean =>
  comparison.instantiations === CheckCensusInstantiationVerdict.Enum.increase;

/**
 * Whether the gate fails: any instantiation increase, a compiler that
 * differs from the one the baseline was measured with, or no selected
 * baseline row at all.
 *
 * **Details**
 *
 * An empty selection fails because it proves nothing: a mistyped `--filter`
 * or a baseline without rows would otherwise exit 0 without measuring
 * anything. A band row's growth within its band is `within-band`, which is
 * reported and never fails.
 *
 * **Example** (An empty report fails)
 *
 * ```ts
 * import { CheckCensusGateReport, checkCensusGateFailed } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const report = CheckCensusGateReport.make({
 *   baselineMeasuredAt: "2026-09-29T00:00:00.000Z",
 *   baselineCommit: "368998daff",
 *   baselineCompiler: "7.0.2",
 *   compiler: "7.0.2",
 *   comparisons: [],
 * })
 * console.log(checkCensusGateFailed(report)) // true
 * ```
 *
 * @param report - The gate report to judge.
 * @returns `true` when the census must exit non-zero.
 * @category use-cases
 * @since 0.0.0
 */
export const checkCensusGateFailed = (report: CheckCensusGateReport): boolean =>
  compilerChanged(report) || A.isReadonlyArrayEmpty(report.comparisons) || A.some(report.comparisons, isIncrease);

const filterLabel: (filter: O.Option<string>) => string = O.match({
  onNone: () => "no --filter",
  onSome: (text) => `--filter "${text}"`,
});

const selectionLabel = (report: CheckCensusGateReport): string =>
  `${filterLabel(report.filter)}${pipe(
    report.rowPackages,
    O.map((packages) => `, --row-packages ${A.join(packages, ",")}`),
    O.getOrElse(thunkEmptyStr)
  )}`;

/**
 * The one-line summary the CLI exits with when {@link checkCensusGateFailed}
 * holds.
 *
 * **Details**
 *
 * An empty selection names the active `--filter` (and `--row-packages`, when
 * given) so a mistyped selection is visible; any other failure points at an
 * instantiation increase or a compiler change.
 *
 * **Example** (Summarize an empty selection)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { CheckCensusGateReport, checkCensusGateFailureMessage } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const report = CheckCensusGateReport.make({
 *   baselineMeasuredAt: "2026-09-29T00:00:00.000Z",
 *   baselineCommit: "368998daff",
 *   baselineCompiler: "7.0.2",
 *   compiler: "7.0.2",
 *   filter: O.some("__no_such_row__"),
 *   comparisons: [],
 * })
 * console.log(checkCensusGateFailureMessage(report).includes('--filter "__no_such_row__"')) // true
 * ```
 *
 * @param report - The failing gate report.
 * @returns The failure summary, naming the baseline path.
 * @category formatting
 * @since 0.0.0
 */
export const checkCensusGateFailureMessage = (report: CheckCensusGateReport): string =>
  A.isReadonlyArrayEmpty(report.comparisons)
    ? `check-census gate failed: no baselined program was selected (${selectionLabel(report)}, baseline ${report.baselinePath}).`
    : `check-census gate failed: single-checker instantiations increased or the compiler changed (baseline ${report.baselinePath}).`;

const signed = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

const percentChange = (base: number, current: number, precision: number): string =>
  pipe(
    O.liftPredicate(base, Num.isGreaterThan(0)),
    O.map((positive) => `${signed(Num.round(((current - positive) / positive) * 100, precision))}%`),
    O.getOrElse(() => "n/a")
  );

const checkTimeChange = (baselineMs: number, currentMs: number): string => percentChange(baselineMs, currentMs, 1);

// Two decimals keep a row near the band edge readable: +9.96% and +10.04% would both print +10% at one.
const instantiationChange = ({ baseline, current }: CheckCensusComparison): string =>
  percentChange(baseline.instantiations, current.instantiations, 2);

const instantiationDelta = ({ baseline, current }: CheckCensusComparison): number =>
  current.instantiations - baseline.instantiations;

// The calendar day of the baseline's ISO `measuredAt`.
const baselineDate = (report: CheckCensusGateReport): string => Str.takeLeft(report.baselineMeasuredAt, 10);

const isBandRow = (comparison: CheckCensusComparison): boolean => comparison.rowClass === CheckCensusRowClass.Enum.band;

// A band row's growth is cumulative since the baseline, so its failure names the baseline it is measured
// against and says the delta is not this pull request's alone; the second line is the re-baseline.
const bandFailureText = (
  report: CheckCensusGateReport,
  comparison: CheckCensusComparison
): readonly [string, string] => [
  `FAIL ${comparison.name}: cumulative single-checker growth since the baseline measured ${baselineDate(report)} at commit ${report.baselineCommit}: ${comparison.baseline.instantiations} -> ${comparison.current.instantiations} instantiations (${signed(instantiationDelta(comparison))}, ${instantiationChange(comparison)}), beyond the ${CHECK_CENSUS_BAND_ROW_PERCENT}% band of a band row. The delta is not this pull request's alone: it adds up every change merged since that baseline.`,
  `Re-baseline once the growth is reviewed: \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\` (the write needs a built tree), then commit the rewritten baseline.`,
];

const bandFailureLines = (report: CheckCensusGateReport, comparison: CheckCensusComparison): ReadonlyArray<string> => {
  const [failure, rebaseline] = bandFailureText(report, comparison);

  return [failure, `  ${rebaseline}`];
};

const increaseLines =
  (report: CheckCensusGateReport) =>
  (comparison: CheckCensusComparison): ReadonlyArray<string> =>
    CheckCensusRowClass.match(comparison.rowClass, {
      strict: () => [
        `FAIL ${comparison.name}: single-checker instantiations increased by ${instantiationDelta(comparison)}.`,
      ],
      band: () => bandFailureLines(report, comparison),
    });

const isWithinBand = (comparison: CheckCensusComparison): boolean =>
  comparison.instantiations === CheckCensusInstantiationVerdict.Enum["within-band"];

const renderComparison = (comparison: CheckCensusComparison): string => {
  const { baseline, current } = comparison;

  return `  ${Str.padEnd(52)(comparison.name)} instantiations ${baseline.instantiations} -> ${current.instantiations} (${signed(current.instantiations - baseline.instantiations)}) ${comparison.instantiations} | types ${signed(current.types - baseline.types)} | checkTimeMs ${baseline.checkTimeMs} -> ${current.checkTimeMs} (${checkTimeChange(baseline.checkTimeMs, current.checkTimeMs)}) ${comparison.checkTime}`;
};

const verdictLines = (report: CheckCensusGateReport): ReadonlyArray<string> => [
  ...(A.isReadonlyArrayEmpty(report.comparisons)
    ? [
        `FAIL no baselined program was selected (${selectionLabel(report)}): an empty gate measures nothing. Check the filter against the baseline rows.`,
      ]
    : []),
  ...(compilerChanged(report)
    ? [
        `FAIL compiler changed: baseline measured with ${report.baselineCompiler}, this run used ${report.compiler}; counts are not comparable. Re-measure with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\`.`,
      ]
    : []),
  ...A.flatMap(A.filter(report.comparisons, isIncrease), increaseLines(report)),
  ...A.map(
    A.filter(report.comparisons, isWithinBand),
    (comparison) =>
      `band ${comparison.name}: single-checker instantiations grew by ${instantiationDelta(comparison)} (${instantiationChange(comparison)}) since the baseline measured ${baselineDate(report)}, within the ${CHECK_CENSUS_BAND_ROW_PERCENT}% band (reported, not a failure).`
  ),
  ...A.map(
    A.filter(report.comparisons, (comparison) => comparison.checkTime === CheckCensusCheckTimeVerdict.Enum.slower),
    (comparison) =>
      `advisory ${comparison.name}: check time ${checkTimeChange(comparison.baseline.checkTimeMs, comparison.current.checkTimeMs)} is beyond the ${CHECK_CENSUS_CHECK_TIME_BAND_PERCENT}% band (review flag, not a failure).`
  ),
  ...A.map(
    A.filter(
      report.comparisons,
      (comparison) => comparison.instantiations === CheckCensusInstantiationVerdict.Enum.decrease
    ),
    (comparison) =>
      `tighten ${comparison.name}: single-checker instantiations dropped by ${comparison.baseline.instantiations - comparison.current.instantiations}; lock the gain in with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\`.`
  ),
];

/**
 * Render the gate section as text lines for stdout.
 *
 * **Example** (Render an empty gate)
 *
 * ```ts
 * import { CheckCensusGateReport, renderCheckCensusGateLines } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const lines = renderCheckCensusGateLines(
 *   CheckCensusGateReport.make({
 *     baselineMeasuredAt: "2026-09-29T00:00:00.000Z",
 *     baselineCommit: "368998daff",
 *     baselineCompiler: "7.0.2",
 *     compiler: "7.0.2",
 *     comparisons: [],
 *   })
 * )
 * console.log(lines.length) // 3
 * ```
 *
 * @param report - The gate report to render.
 * @returns A header, one line per comparison (or a no-selection line), then verdict lines; an
 * empty selection adds a failing verdict naming the filter.
 * @category formatting
 * @since 0.0.0
 */
export const renderCheckCensusGateLines = (report: CheckCensusGateReport): ReadonlyArray<string> => [
  `check-census gate (single-checker; baseline ${report.baselinePath} at ${report.baselineCommit}, compiler ${report.compiler})`,
  ...A.match(report.comparisons, {
    onEmpty: () => ["  no baselined program was selected"],
    onNonEmpty: A.map(renderComparison),
  }),
  ...verdictLines(report),
];

const summaryOutcome = (verdict: CheckCensusInstantiationVerdict): string =>
  CheckCensusInstantiationVerdict.match(verdict, {
    increase: () => "**fail**",
    "within-band": () => "reported (within band)",
    unchanged: () => "unchanged",
    decrease: () => "tighten",
  });

const summaryClass = (rowClass: CheckCensusRowClass): string =>
  CheckCensusRowClass.match(rowClass, {
    strict: () => `strict (+${CHECK_CENSUS_INSTANTIATION_NOISE})`,
    band: () => `band (${CHECK_CENSUS_BAND_ROW_PERCENT}%)`,
  });

const summaryRow = (comparison: CheckCensusComparison): string =>
  `| \`${comparison.name}\` | ${summaryClass(comparison.rowClass)} | ${comparison.baseline.instantiations} | ${comparison.current.instantiations} | ${signed(instantiationDelta(comparison))} | ${instantiationChange(comparison)} | ${summaryOutcome(comparison.instantiations)} |`;

// One bullet per failed band row under the table, carrying the CLI's cumulative-growth text.
const summaryBandFailures = (report: CheckCensusGateReport): ReadonlyArray<string> =>
  A.match(
    A.filter(report.comparisons, (comparison) => isIncrease(comparison) && isBandRow(comparison)),
    {
      onEmpty: A.empty<string>,
      onNonEmpty: (failed) => [
        ...A.map(failed, (comparison) => `- ${A.join(bandFailureText(report, comparison), " ")}`),
        "",
      ],
    }
  );

/**
 * Render the gate as the short Markdown table the Heavy / Check lane appends
 * to the GitHub job summary.
 *
 * **Details**
 *
 * One row per comparison: row name, class with its tolerance, baselined and
 * measured single-checker instantiations, the delta, the percent of the
 * baseline, and the outcome. The line above the table names the baseline's
 * measured-at date and commit, which every delta is measured against. Each
 * failed band row adds a bullet under the table: its growth is cumulative
 * since that baseline, the delta is not the pull request's alone, and the
 * bullet carries the re-baseline command. The closing line says whether the
 * gate passed and, when it failed, carries {@link checkCensusGateFailureMessage}.
 *
 * **Example** (Render one band row within its band)
 *
 * ```ts
 * import {
 *   CheckCensusBaselineRow,
 *   CheckCensusGateReport,
 *   CheckCensusSample,
 *   compareCheckCensusSample,
 *   renderCheckCensusGateSummary,
 * } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const row = CheckCensusBaselineRow.make({
 *   name: "@beep/repo-cli",
 *   tsconfig: "packages/tooling/tool/cli/tsconfig.json",
 *   instantiations: 1000,
 *   types: 10,
 *   checkTimeMs: 100,
 * })
 * const comparison = compareCheckCensusSample(CheckCensusSample.make({ instantiations: 1090, types: 10, checkTimeMs: 100 }), row)
 * const markdown = renderCheckCensusGateSummary(
 *   CheckCensusGateReport.make({
 *     baselineMeasuredAt: "2026-11-13T07:07:38.700Z",
 *     baselineCommit: "368998daff",
 *     baselineCompiler: "7.0.2",
 *     compiler: "7.0.2",
 *     comparisons: [comparison],
 *   })
 * )
 * console.log(markdown.includes("| +90 | +9% | reported (within band) |")) // true
 * ```
 *
 * @param report - The gate report to render.
 * @returns Markdown with a heading, the table, and a result line, ending in a newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderCheckCensusGateSummary = (report: CheckCensusGateReport): string =>
  `${A.join(
    [
      "### check-census gate",
      "",
      `Single-checker instantiations against \`${report.baselinePath}\`, measured ${baselineDate(report)} at commit \`${report.baselineCommit}\` (this run's compiler \`${report.compiler}\`); every delta is cumulative since that baseline.`,
      "",
      "| Row | Class | Baseline | Measured | Delta | Percent | Outcome |",
      "| --- | --- | ---: | ---: | ---: | ---: | --- |",
      ...A.map(report.comparisons, summaryRow),
      "",
      ...summaryBandFailures(report),
      checkCensusGateFailed(report) ? `**Result: fail.** ${checkCensusGateFailureMessage(report)}` : "Result: pass.",
    ],
    "\n"
  )}\n`;

const renderBaselineRow = (row: CheckCensusBaselineRow): string =>
  `    ${Str.padEnd(50)(row.name)} instantiations ${row.instantiations} | types ${row.types} | checkTimeMs ${row.checkTimeMs}`;

/**
 * Every row of a baseline in gate order: package rows, then typeperf fixture
 * rows.
 *
 * **Example** (Count an empty baseline's rows)
 *
 * ```ts
 * import { CheckCensusBaseline, checkCensusBaselineRows } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const baseline = CheckCensusBaseline.make({
 *   measuredAt: "2026-09-29T00:00:00.000Z",
 *   commit: "368998daff",
 *   dirtyWorktree: false,
 *   compiler: "7.0.2",
 *   command: "bun run tsc",
 *   checkTimeBandPercent: 5,
 *   packages: [],
 *   typeperfFixtures: [],
 * })
 * console.log(checkCensusBaselineRows(baseline).length) // 0
 * ```
 *
 * @param baseline - The baseline document.
 * @returns Package rows followed by typeperf fixture rows.
 * @category use-cases
 * @since 0.0.0
 */
export const checkCensusBaselineRows = (baseline: CheckCensusBaseline): ReadonlyArray<CheckCensusBaselineRow> =>
  A.appendAll(baseline.packages, baseline.typeperfFixtures);

/**
 * Render a freshly measured baseline as text lines for stdout.
 *
 * **Example** (Render an empty baseline)
 *
 * ```ts
 * import { CheckCensusBaseline, renderCheckCensusBaselineLines } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const lines = renderCheckCensusBaselineLines(
 *   CheckCensusBaseline.make({
 *     measuredAt: "2026-09-29T00:00:00.000Z",
 *     commit: "368998daff",
 *     dirtyWorktree: true,
 *     compiler: "7.0.2",
 *     command: "bun run tsc",
 *     checkTimeBandPercent: 5,
 *     packages: [],
 *     typeperfFixtures: [],
 *   })
 * )
 * console.log(lines.length) // 3
 * ```
 *
 * @param baseline - The baseline document to render.
 * @returns A header, then each section's title and one line per row.
 * @category formatting
 * @since 0.0.0
 */
export const renderCheckCensusBaselineLines = (baseline: CheckCensusBaseline): ReadonlyArray<string> => [
  `check-census baseline (${A.length(checkCensusBaselineRows(baseline))} rows, compiler ${baseline.compiler}, ${baseline.commit}${baseline.dirtyWorktree ? " + uncommitted changes" : ""})`,
  "  packages",
  ...A.map(baseline.packages, renderBaselineRow),
  "  typeperf fixtures",
  ...A.map(baseline.typeperfFixtures, renderBaselineRow),
];

const targetsOf = (entries: ReadonlyArray<readonly [string, string]>): ReadonlyArray<CheckCensusTarget> =>
  A.map(entries, ([name, tsconfig]) => CheckCensusTarget.make({ name, tsconfig }));

/**
 * Programs baselined when no committed baseline exists yet: the three P5
 * packages and the mirrored `@beep/schema` typeperf suite.
 *
 * **Details**
 *
 * Once `standards/check-census.regression-baseline.jsonc` exists its rows are
 * the gate's program list; this default only seeds the first write.
 *
 * **Example** (List the default programs)
 *
 * ```ts
 * import { CHECK_CENSUS_DEFAULT_TARGETS } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * console.log(CHECK_CENSUS_DEFAULT_TARGETS.packages.map((target) => target.name))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_DEFAULT_TARGETS: CheckCensusTargets = CheckCensusTargets.make({
  packages: targetsOf([
    ["@beep/schema", "packages/foundation/modeling/schema/tsconfig.json"],
    ["@beep/repo-cli", "packages/tooling/tool/cli/tsconfig.json"],
    ["@beep/law-practice-domain", "packages/law-practice/domain/tsconfig.json"],
  ]),
  typeperfFixtures: targetsOf([
    [
      "@beep/schema#typeperf/baseline",
      "packages/foundation/modeling/schema/test/fixtures/typeperf/tsconfig.baseline.json",
    ],
    [
      "@beep/schema#typeperf/literal-kit-tagged-union",
      "packages/foundation/modeling/schema/test/fixtures/typeperf/tsconfig.literal-kit-tagged-union.json",
    ],
    [
      "@beep/schema#typeperf/literal-kit-keyed-api",
      "packages/foundation/modeling/schema/test/fixtures/typeperf/tsconfig.literal-kit-keyed-api.json",
    ],
    [
      "@beep/schema#typeperf/literal-kit-large-untagged",
      "packages/foundation/modeling/schema/test/fixtures/typeperf/tsconfig.literal-kit-large-untagged.json",
    ],
    [
      "@beep/schema#typeperf/literal-kit-large-untagged-touched",
      "packages/foundation/modeling/schema/test/fixtures/typeperf/tsconfig.literal-kit-large-untagged-touched.json",
    ],
  ]),
});

/**
 * Inputs of the live sampler: the repository root (spawn cwd and base of
 * every target tsconfig) and the `tsc` binary.
 *
 * **Example** (Point the sampler at a checkout)
 *
 * ```ts
 * import { CheckCensusSamplerOptions } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const options = CheckCensusSamplerOptions.make({ repoRoot: "/repo", tscPath: "/repo/node_modules/.bin/tsc" })
 * console.log(options.tscPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusSamplerOptions extends S.Opaque<CheckCensusSamplerOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    repoRoot: S.String,
    tscPath: S.String,
  }).pipe(
    $I.annoteSchema("CheckCensusSamplerOptions", {
      description: "Repository root and tsc binary used by the live check-census sampler.",
    })
  )
) {}

/**
 * Operations of the {@link CheckCensusSampler} service.
 *
 * @category services
 * @since 0.0.0
 */
export interface CheckCensusSamplerShape {
  /** The `tsc --version` string (without the `Version` prefix) the samples run on. */
  readonly compilerVersion: Effect.Effect<string, QualityScriptCommandError>;
  /** Measure one program single-threaded with a fresh build-info file. */
  readonly sample: (target: CheckCensusTarget) => Effect.Effect<CheckCensusSample, CheckCensusSampleError>;
}

type CheckCensusSamplerRequirements =
  | FileSystem.FileSystem
  | Path.Path
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner;

const sampleArgs = (tsconfigPath: string, buildInfoPath: string): ReadonlyArray<string> => [
  "-p",
  tsconfigPath,
  "--noEmit",
  "--extendedDiagnostics",
  "--singleThreaded",
  "--tsBuildInfoFile",
  buildInfoPath,
];

const makeCheckCensusSampler = Effect.fnUntraced(function* (
  options: CheckCensusSamplerOptions
): Effect.fn.Return<CheckCensusSamplerShape, never, CheckCensusSamplerRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>();
  const scratchParent = path.join(options.repoRoot, ".beep", "quality");

  const compilerVersion = runCaptured({
    command: options.tscPath,
    args: ["--version"],
    cwd: options.repoRoot,
    source: "all",
    trim: true,
  }).pipe(
    QualityScriptCommandError.mapError(`Failed to run ${options.tscPath} --version.`),
    Effect.flatMap((captured) =>
      Effect.fromOption(firstCapture(compilerOutputLines(captured.output), compilerVersionPattern), () =>
        QualityScriptCommandError.make({
          message: `Unrecognised ${options.tscPath} --version output: ${captured.output}`,
        })
      )
    ),
    Effect.provideContext(context)
  );

  const sample = Effect.fn("CheckCensusSampler.sample")(
    function* (target: CheckCensusTarget) {
      yield* fs
        .makeDirectory(scratchParent, { recursive: true })
        .pipe(QualityScriptCommandError.mapError(`Failed to create ${scratchParent}.`));
      const scratch = yield* fs
        .makeTempDirectoryScoped({ directory: scratchParent, prefix: "check-census-" })
        .pipe(QualityScriptCommandError.mapError(`Failed to create a build-info directory under ${scratchParent}.`));
      const captured = yield* runCaptured({
        command: options.tscPath,
        args: sampleArgs(path.resolve(options.repoRoot, target.tsconfig), path.join(scratch, "sample.tsbuildinfo")),
        cwd: options.repoRoot,
        source: "all",
        trim: true,
      }).pipe(QualityScriptCommandError.mapError(`Failed to measure ${target.name} (${target.tsconfig}).`));

      return yield* Effect.fromResult(parseCheckCensusSample(captured, target.name));
    },
    Effect.scoped,
    Effect.provideContext(context)
  );

  return { compilerVersion, sample };
});

/**
 * Measures single-checker `--extendedDiagnostics` samples.
 *
 * **Details**
 *
 * The live service spawns `tsc -p <tsconfig> --noEmit --extendedDiagnostics`
 * with `--singleThreaded --tsBuildInfoFile <fresh>` through the platform
 * `ChildProcessSpawner`, with a build-info file in a scoped temporary
 * directory under `.beep/quality/` so no incremental state is ever reused.
 * `CheckCensusSampler.make(options)` builds the live service; tests provide
 * a fixed implementation instead.
 *
 * **Example** (Provide fixed samples in a test)
 *
 * ```ts
 * import { CheckCensusSample, CheckCensusSampler } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * const fixed = Layer.succeed(
 *   CheckCensusSampler,
 *   CheckCensusSampler.of({
 *     compilerVersion: Effect.succeed("7.0.2"),
 *     sample: () => Effect.succeed(CheckCensusSample.make({ instantiations: 1, types: 1, checkTimeMs: 1 })),
 *   })
 * )
 * console.log(Layer.isLayer(fixed)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CheckCensusSampler extends Context.Service<CheckCensusSampler, CheckCensusSamplerShape>()(
  $I`CheckCensusSampler`,
  { make: makeCheckCensusSampler }
) {}

/**
 * Measure every selected baseline row and compare it with the committed
 * sample, one program at a time.
 *
 * **Details**
 *
 * Samples run sequentially so concurrent programs never distort each
 * other's check time. A refused or unparsable sample fails the run: a gate
 * that cannot measure a baselined program cannot pass it.
 *
 * **Example** (Gate against fixed samples)
 *
 * ```ts
 * import { CheckCensusBaseline, runCheckCensusGate } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 * import * as O from "effect/Option"
 *
 * const baseline = CheckCensusBaseline.make({
 *   measuredAt: "2026-09-29T00:00:00.000Z",
 *   commit: "368998daff",
 *   dirtyWorktree: false,
 *   compiler: "7.0.2",
 *   command: "bun run tsc",
 *   checkTimeBandPercent: 5,
 *   packages: [],
 *   typeperfFixtures: [],
 * })
 * const program = runCheckCensusGate(baseline, O.none())
 * console.log(typeof program) // "object"
 * ```
 *
 * @param baseline - The committed baseline document.
 * @param filter - Optional substring every compared row name must contain.
 * @param rowPackages - Optional owning packages ({@link checkCensusRowPackage}) every compared row must belong to; `None` keeps every row.
 * @returns The gate report, comparisons in baseline row order.
 * @category use-cases
 * @since 0.0.0
 */
export const runCheckCensusGate = Effect.fn("CheckCensusGate.run")(function* (
  baseline: CheckCensusBaseline,
  filter: O.Option<string>,
  rowPackages: O.Option<ReadonlyArray<string>> = O.none()
): Effect.fn.Return<CheckCensusGateReport, CheckCensusSampleError, CheckCensusSampler> {
  const sampler = yield* CheckCensusSampler;
  const compiler = yield* sampler.compilerVersion;
  const ownedBySelection = (row: CheckCensusBaselineRow): boolean =>
    O.match(rowPackages, { onNone: thunkTrue, onSome: A.contains(checkCensusRowPackage(row.name)) });
  const comparisons = yield* Effect.forEach(
    A.filter(
      checkCensusBaselineRows(baseline),
      (row) => nameFilterPredicate(filter)(row.name) && ownedBySelection(row)
    ),
    (row) => sampler.sample(row).pipe(Effect.map(compareCheckCensusSample(row))),
    { concurrency: 1 }
  );

  return CheckCensusGateReport.make({
    baselineMeasuredAt: baseline.measuredAt,
    baselineCommit: baseline.commit,
    baselineCompiler: baseline.compiler,
    compiler,
    filter,
    rowPackages,
    comparisons,
  });
});

/**
 * Provenance stamped onto a freshly measured baseline.
 *
 * **Example** (Stamp a dirty measurement)
 *
 * ```ts
 * import { CheckCensusBaselineProvenance } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const provenance = CheckCensusBaselineProvenance.make({
 *   measuredAt: "2026-09-29T00:00:00.000Z",
 *   commit: "368998daff",
 *   dirtyWorktree: true,
 * })
 * console.log(provenance.dirtyWorktree) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusBaselineProvenance extends S.Opaque<
  CheckCensusBaselineProvenance,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    measuredAt: S.String,
    commit: S.String,
    dirtyWorktree: S.Boolean,
  }).pipe(
    $I.annoteSchema("CheckCensusBaselineProvenance", {
      description: "When, at which commit, and on how clean a tree a check-census baseline was measured.",
    })
  )
) {}

/**
 * Measure every target single-threaded and assemble a baseline document.
 *
 * **Details**
 *
 * Any refused sample (type errors or a non-zero exit) fails the whole
 * measurement, so a baseline is never written from a failing program.
 *
 * **Example** (Measure against fixed samples)
 *
 * ```ts
 * import {
 *   CHECK_CENSUS_DEFAULT_TARGETS,
 *   CheckCensusBaselineProvenance,
 *   measureCheckCensusBaseline,
 * } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const program = measureCheckCensusBaseline(
 *   CHECK_CENSUS_DEFAULT_TARGETS,
 *   CheckCensusBaselineProvenance.make({ measuredAt: "2026-09-29T00:00:00.000Z", commit: "368998daff", dirtyWorktree: false })
 * )
 * console.log(typeof program) // "object"
 * ```
 *
 * @param targets - Programs to measure, packages first, each section in row order.
 * @param provenance - Measurement time, commit, and worktree state.
 * @returns The baseline document.
 * @category use-cases
 * @since 0.0.0
 */
export const measureCheckCensusBaseline = Effect.fn("CheckCensusGate.measureBaseline")(function* (
  targets: CheckCensusTargets,
  provenance: CheckCensusBaselineProvenance
): Effect.fn.Return<CheckCensusBaseline, CheckCensusSampleError, CheckCensusSampler> {
  const sampler = yield* CheckCensusSampler;
  const compiler = yield* sampler.compilerVersion;
  const measure = (section: ReadonlyArray<CheckCensusTarget>) =>
    Effect.forEach(
      section,
      (target) =>
        sampler
          .sample(target)
          .pipe(
            Effect.map((sample) =>
              CheckCensusBaselineRow.make({ name: target.name, tsconfig: target.tsconfig, ...sample })
            )
          ),
      { concurrency: 1 }
    );
  const packages = yield* measure(targets.packages);
  const typeperfFixtures = yield* measure(targets.typeperfFixtures);

  return CheckCensusBaseline.make({
    measuredAt: provenance.measuredAt,
    commit: provenance.commit,
    dirtyWorktree: provenance.dirtyWorktree,
    compiler,
    command: CHECK_CENSUS_SAMPLE_COMMAND,
    checkTimeBandPercent: CHECK_CENSUS_CHECK_TIME_BAND_PERCENT,
    packages,
    typeperfFixtures,
  });
});

const encodeCheckCensusBaseline = S.encodeEffect(CheckCensusBaseline);

const targetOfRow = ({ name, tsconfig }: CheckCensusBaselineRow): CheckCensusTarget =>
  CheckCensusTarget.make({ name, tsconfig });

/**
 * Read and decode a committed baseline document.
 *
 * **Example** (Read the committed baseline)
 *
 * ```ts
 * import { readCheckCensusBaseline } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const program = readCheckCensusBaseline("/repo/standards/check-census.regression-baseline.jsonc")
 * console.log(typeof program) // "object"
 * ```
 *
 * @param absolutePath - Absolute path of the JSONC baseline.
 * @returns The decoded baseline.
 * @category use-cases
 * @since 0.0.0
 */
export const readCheckCensusBaseline = Effect.fn("CheckCensusGate.readBaseline")(function* (
  absolutePath: string
): Effect.fn.Return<CheckCensusBaseline, QualityScriptCommandError, FileSystem.FileSystem> {
  return yield* readArtifact({
    path: absolutePath,
    schema: CheckCensusBaseline,
    onReadError: QualityScriptCommandError.new(
      `Failed to read ${absolutePath}; create it with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\`.`
    ),
    onDecodeError: QualityScriptCommandError.new(`Failed to decode ${absolutePath} as check-census-baseline/v1.`),
  });
});

/**
 * Encode a baseline document and write it with its generated header.
 *
 * **Example** (Write a baseline)
 *
 * ```ts
 * import { CheckCensusBaseline, writeCheckCensusBaseline } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const program = writeCheckCensusBaseline(
 *   "/repo/standards/check-census.regression-baseline.jsonc",
 *   CheckCensusBaseline.make({
 *     measuredAt: "2026-09-29T00:00:00.000Z",
 *     commit: "368998daff",
 *     dirtyWorktree: false,
 *     compiler: "7.0.2",
 *     command: "bun run tsc",
 *     checkTimeBandPercent: 5,
 *     packages: [],
 *     typeperfFixtures: [],
 *   })
 * )
 * console.log(typeof program) // "object"
 * ```
 *
 * @param absolutePath - Absolute path of the JSONC baseline.
 * @param baseline - The document to write.
 * @returns Succeeds once the file is written.
 * @category use-cases
 * @since 0.0.0
 */
export const writeCheckCensusBaseline = Effect.fn("CheckCensusGate.writeBaseline")(function* (
  absolutePath: string,
  baseline: CheckCensusBaseline
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const encoded = yield* encodeCheckCensusBaseline(baseline).pipe(
    QualityScriptCommandError.mapError("Failed to encode the check-census baseline.")
  );
  const body = yield* formatJsonc(encoded).pipe(
    QualityScriptCommandError.mapError("Failed to render the check-census baseline.")
  );

  yield* writeArtifact({
    path: absolutePath,
    header: baselineHeader,
    body,
    onError: QualityScriptCommandError.new(`Failed to write ${absolutePath}.`),
  });
});

/**
 * The programs a baseline write measures: the committed rows when the
 * baseline exists, otherwise {@link CHECK_CENSUS_DEFAULT_TARGETS}.
 *
 * **Example** (Resolve the rows to re-measure)
 *
 * ```ts
 * import { resolveCheckCensusTargets } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const program = resolveCheckCensusTargets("/repo/standards/check-census.regression-baseline.jsonc")
 * console.log(typeof program) // "object"
 * ```
 *
 * @param absolutePath - Absolute path of the JSONC baseline.
 * @returns The targets, each section in row order.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveCheckCensusTargets = Effect.fn("CheckCensusGate.resolveTargets")(function* (
  absolutePath: string
): Effect.fn.Return<CheckCensusTargets, QualityScriptCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(absolutePath)
    .pipe(QualityScriptCommandError.mapError(`Failed to probe ${absolutePath}.`));
  if (!exists) {
    return CHECK_CENSUS_DEFAULT_TARGETS;
  }
  const baseline = yield* readCheckCensusBaseline(absolutePath);

  return CheckCensusTargets.make({
    packages: A.map(baseline.packages, targetOfRow),
    typeperfFixtures: A.map(baseline.typeperfFixtures, targetOfRow),
  });
});
