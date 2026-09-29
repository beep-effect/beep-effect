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
import { LiteralKit } from "@beep/schema/LiteralKit";
import { A, Str } from "@beep/utils";
import { Context, Effect, FileSystem, Match, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { formatJsonc, readArtifact, writeArtifact } from "../../internal/artifacts/index.ts";
import { runCaptured } from "../../internal/process/index.ts";
import { compilerOutputLines, isCompilerDiagnosticLine, nameFilterPredicate } from "./internal/CheckCensusOutput.ts";
import { QualityScriptCommandError } from "./Quality.errors.ts";
import type * as Crypto from "effect/Crypto";
import type { Ordering } from "effect/Ordering";
import type { ChildProcessSpawner } from "effect/process";

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
    "// Gate: single-checker instantiations must not increase on any row (failure); check time is",
    `// advisory within a ${CHECK_CENSUS_CHECK_TIME_BAND_PERCENT}% band; an instantiation decrease prints a tighten hint.`,
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
export class CheckCensusTarget extends S.Class<CheckCensusTarget>($I`CheckCensusTarget`)(
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
export class CheckCensusTargets extends S.Class<CheckCensusTargets>($I`CheckCensusTargets`)(
  {
    packages: S.Array(CheckCensusTarget),
    typeperfFixtures: S.Array(CheckCensusTarget),
  },
  $I.annote("CheckCensusTargets", {
    description: "Workspace-package and typeperf-fixture programs measured by the check-census gate.",
  })
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
export class CheckCensusSample extends S.Class<CheckCensusSample>($I`CheckCensusSample`)(
  checkCensusSampleFields,
  $I.annote("CheckCensusSample", {
    description: "Instantiations, types, and check time of one single-checker tsc --extendedDiagnostics run.",
  })
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
export class CheckCensusBaseline extends S.Class<CheckCensusBaseline>($I`CheckCensusBaseline`)(
  {
    schemaVersion: S.tag("check-census-baseline/v1"),
    measuredAt: S.String,
    commit: S.String,
    dirtyWorktree: S.Boolean,
    compiler: S.String,
    command: S.String,
    checkTimeBandPercent: S.Literal(CHECK_CENSUS_CHECK_TIME_BAND_PERCENT),
    packages: S.Array(CheckCensusBaselineRow),
    typeperfFixtures: S.Array(CheckCensusBaselineRow),
  },
  $I.annote("CheckCensusBaseline", {
    description: "Committed single-checker instantiation, type, and check-time baseline of the check-census gate.",
  })
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
export const CheckCensusInstantiationVerdict = LiteralKit(["increase", "unchanged", "decrease"]).pipe(
  $I.annoteSchema("CheckCensusInstantiationVerdict", {
    description: "Instantiation count against the baseline: an increase fails the gate, a decrease asks to tighten.",
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
export class CheckCensusComparison extends S.Class<CheckCensusComparison>($I`CheckCensusComparison`)(
  {
    name: S.String,
    baseline: CheckCensusSample,
    current: CheckCensusSample,
    instantiations: CheckCensusInstantiationVerdict,
    checkTime: CheckCensusCheckTimeVerdict,
  },
  $I.annote("CheckCensusComparison", {
    description:
      "Committed and fresh single-checker samples of one program with their instantiation and check-time verdicts.",
  })
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
 *
 * **Example** (Build an empty gate report)
 *
 * ```ts
 * import { CheckCensusGateReport } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const report = CheckCensusGateReport.make({
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
export class CheckCensusGateReport extends S.Class<CheckCensusGateReport>($I`CheckCensusGateReport`)(
  {
    baselinePath: S.String.pipe(S.withConstructorDefault(Effect.succeed(CHECK_CENSUS_BASELINE_PATH))),
    baselineCommit: S.String,
    baselineCompiler: S.String,
    compiler: S.String,
    comparisons: S.Array(CheckCensusComparison),
  },
  $I.annote("CheckCensusGateReport", {
    description: "Single-checker comparisons of every selected baseline row against fresh samples.",
  })
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
export class CheckCensusSampleRefused extends S.TaggedError<CheckCensusSampleRefused>($I`CheckCensusSampleRefused`)(
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
export class CheckCensusMetricMissing extends S.TaggedError<CheckCensusMetricMissing>($I`CheckCensusMetricMissing`)(
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

const instantiationVerdictOf: (ordering: Ordering) => CheckCensusInstantiationVerdict = Match.type<Ordering>().pipe(
  Match.when(1, () => CheckCensusInstantiationVerdict.Enum.increase),
  Match.when(-1, () => CheckCensusInstantiationVerdict.Enum.decrease),
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
 * Instantiations are compared exactly: any increase is the hard verdict.
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
} = dual(
  2,
  (current: CheckCensusSample, row: CheckCensusBaselineRow): CheckCensusComparison =>
    CheckCensusComparison.make({
      name: row.name,
      baseline: CheckCensusSample.make({
        instantiations: row.instantiations,
        types: row.types,
        checkTimeMs: row.checkTimeMs,
      }),
      current,
      instantiations: instantiationVerdictOf(Order.Number(current.instantiations, row.instantiations)),
      checkTime: checkTimeVerdictOf(row.checkTimeMs, current.checkTimeMs),
    })
);

const compilerChanged = (report: CheckCensusGateReport): boolean => report.compiler !== report.baselineCompiler;

const isIncrease = (comparison: CheckCensusComparison): boolean =>
  comparison.instantiations === CheckCensusInstantiationVerdict.Enum.increase;

/**
 * Whether the gate fails: any instantiation increase, or a compiler that
 * differs from the one the baseline was measured with.
 *
 * **Example** (An empty report passes)
 *
 * ```ts
 * import { CheckCensusGateReport, checkCensusGateFailed } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 *
 * const report = CheckCensusGateReport.make({
 *   baselineCommit: "368998daff",
 *   baselineCompiler: "7.0.2",
 *   compiler: "7.0.2",
 *   comparisons: [],
 * })
 * console.log(checkCensusGateFailed(report)) // false
 * ```
 *
 * @param report - The gate report to judge.
 * @returns `true` when the census must exit non-zero.
 * @category use-cases
 * @since 0.0.0
 */
export const checkCensusGateFailed = (report: CheckCensusGateReport): boolean =>
  compilerChanged(report) || A.some(report.comparisons, isIncrease);

const signed = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

const checkTimeChange = (baselineMs: number, currentMs: number): string =>
  pipe(
    O.liftPredicate(baselineMs, Num.isGreaterThan(0)),
    O.map((base) => `${signed(Num.round(((currentMs - base) / base) * 100, 1))}%`),
    O.getOrElse(() => "n/a")
  );

const renderComparison = (comparison: CheckCensusComparison): string => {
  const { baseline, current } = comparison;

  return `  ${Str.padEnd(52)(comparison.name)} instantiations ${baseline.instantiations} -> ${current.instantiations} (${signed(current.instantiations - baseline.instantiations)}) ${comparison.instantiations} | types ${signed(current.types - baseline.types)} | checkTimeMs ${baseline.checkTimeMs} -> ${current.checkTimeMs} (${checkTimeChange(baseline.checkTimeMs, current.checkTimeMs)}) ${comparison.checkTime}`;
};

const verdictLines = (report: CheckCensusGateReport): ReadonlyArray<string> => [
  ...(compilerChanged(report)
    ? [
        `FAIL compiler changed: baseline measured with ${report.baselineCompiler}, this run used ${report.compiler}; counts are not comparable. Re-measure with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\`.`,
      ]
    : []),
  ...A.map(
    A.filter(report.comparisons, isIncrease),
    (comparison) =>
      `FAIL ${comparison.name}: single-checker instantiations increased by ${comparison.current.instantiations - comparison.baseline.instantiations}.`
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
 *   CheckCensusGateReport.make({ baselineCommit: "368998daff", baselineCompiler: "7.0.2", compiler: "7.0.2", comparisons: [] })
 * )
 * console.log(lines.length) // 2
 * ```
 *
 * @param report - The gate report to render.
 * @returns A header, one line per comparison (or a no-selection line), then verdict lines.
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
export class CheckCensusSamplerOptions extends S.Class<CheckCensusSamplerOptions>($I`CheckCensusSamplerOptions`)(
  {
    repoRoot: S.String,
    tscPath: S.String,
  },
  $I.annote("CheckCensusSamplerOptions", {
    description: "Repository root and tsc binary used by the live check-census sampler.",
  })
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
  | Crypto.Crypto
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
  const context = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
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
 * The live service spawns `tsc -p <tsconfig> --noEmit --extendedDiagnostics
 * --singleThreaded --tsBuildInfoFile <fresh>` through the platform
 * `ChildProcessSpawner`, with a build-info file in a scoped temporary
 * directory under `.beep/quality/` so no incremental state is ever reused.
 * `CheckCensusSampler.make(options)` builds the live service; tests provide
 * a fixed implementation instead.
 *
 * **Example** (Provide fixed samples in a test)
 *
 * ```ts
 * import { CheckCensusSample, CheckCensusSampler } from "@beep/repo-cli/commands/Quality/CheckCensusGate"
 * import { Effect, Layer } from "effect"
 *
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
 * @returns The gate report, comparisons in baseline row order.
 * @category use-cases
 * @since 0.0.0
 */
export const runCheckCensusGate = Effect.fn("CheckCensusGate.run")(function* (
  baseline: CheckCensusBaseline,
  filter: O.Option<string>
): Effect.fn.Return<CheckCensusGateReport, CheckCensusSampleError, CheckCensusSampler> {
  const sampler = yield* CheckCensusSampler;
  const compiler = yield* sampler.compilerVersion;
  const comparisons = yield* Effect.forEach(
    A.filter(checkCensusBaselineRows(baseline), (row) => nameFilterPredicate(filter)(row.name)),
    (row) => sampler.sample(row).pipe(Effect.map(compareCheckCensusSample(row))),
    { concurrency: 1 }
  );

  return CheckCensusGateReport.make({
    baselineCommit: baseline.commit,
    baselineCompiler: baseline.compiler,
    compiler,
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
export class CheckCensusBaselineProvenance extends S.Class<CheckCensusBaselineProvenance>(
  $I`CheckCensusBaselineProvenance`
)(
  {
    measuredAt: S.String,
    commit: S.String,
    dirtyWorktree: S.Boolean,
  },
  $I.annote("CheckCensusBaselineProvenance", {
    description: "When, at which commit, and on how clean a tree a check-census baseline was measured.",
  })
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
