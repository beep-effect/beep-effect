import {
  CHECK_CENSUS_BASELINE_PATH,
  CHECK_CENSUS_DEFAULT_TARGETS,
  CheckCensusBaseline,
  CheckCensusBaselineProvenance,
  CheckCensusBaselineRow,
  CheckCensusGateReport,
  CheckCensusMetricMissing,
  CheckCensusSample,
  CheckCensusSampleRefused,
  CheckCensusSampler,
  checkCensusBaselineRows,
  checkCensusGateFailed,
  checkCensusGateFailureMessage,
  compareCheckCensusSample,
  compilerOutputLines,
  isCompilerDiagnosticLine,
  measureCheckCensusBaseline,
  nameFilterPredicate,
  parseCheckCensusSample,
  readCheckCensusBaseline,
  readCheckCensusMetrics,
  renderCheckCensusGateLines,
  resolveCheckCensusTargets,
  runCheckCensusGate,
  writeCheckCensusBaseline,
} from "@beep/repo-cli/test/Quality";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, HashMap, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { CheckCensusTargets } from "@beep/repo-cli/test/Quality";

// Tail of a real `tsc -p packages/foundation/modeling/schema/tsconfig.json --noEmit
// --extendedDiagnostics --singleThreaded` run (tsgo 7.0.2+effect-tsgo.0.45.0).
const cleanRun = `Files:                   1038
Lines:                 504395
Identifiers:           335619
Symbols:               679643
Types:                 202571
Instantiations:        710979
Memory used:          491463K
Memory allocs:        3784171
Config time:           0.001s
BuildInfo read time:   0.000s
Parse time:            0.155s
Bind time:             0.000s
Check time:            0.961s
Emit time:             0.014s
Changes compute time:  0.053s
Total time:            1.464s`;

const failingRun = `packages/foundation/modeling/schema/test/fixtures/typeperf/literal-kit-tagged-union.ts(11,37): error TS377098: This Schema number API accepts \`NaN\`, \`Infinity\`, and \`-Infinity\`. effect(schemaNumber)
Types:                  28686
Instantiations:         66135
Check time:             0.092s`;

const sample = (instantiations: number, checkTimeMs: number, types = 100) =>
  CheckCensusSample.make({ instantiations, types, checkTimeMs });

const row = (name: string, instantiations: number, checkTimeMs: number, types = 100) =>
  CheckCensusBaselineRow.make({ name, tsconfig: `packages/${name}/tsconfig.json`, instantiations, types, checkTimeMs });

const baselineOf = (
  packages: ReadonlyArray<CheckCensusBaselineRow>,
  typeperfFixtures: ReadonlyArray<CheckCensusBaselineRow> = []
) =>
  CheckCensusBaseline.make({
    measuredAt: "2026-09-29T12:00:00.000Z",
    commit: "368998daff4b5d6c0e2f1a3b7c9d8e6f5a4b3c2d",
    dirtyWorktree: true,
    compiler: "7.0.2+effect-tsgo.0.45.0",
    command: "bun run tsc -p <tsconfig> --noEmit --extendedDiagnostics --singleThreaded --tsBuildInfoFile <fresh>",
    checkTimeBandPercent: 5,
    packages,
    typeperfFixtures,
  });

const targetNames = (targets: CheckCensusTargets) =>
  A.map(A.appendAll(targets.packages, targets.typeperfFixtures), (target) => target.name);

const defaultTargetNames = targetNames(CHECK_CENSUS_DEFAULT_TARGETS);

// A sampler that answers from a fixed table and records which programs it measured.
const fixedSampler = (samples: HashMap.HashMap<string, CheckCensusSample>, measured: Array<string>) =>
  CheckCensusSampler.of({
    compilerVersion: Effect.succeed("7.0.2+effect-tsgo.0.45.0"),
    sample: Effect.fn("FixedCheckCensusSampler.sample")(function* (target) {
      measured.push(target.name);
      return yield* Effect.fromOption(HashMap.get(samples, target.name), () =>
        CheckCensusSampleRefused.make({
          target: target.name,
          exitCode: 2,
          diagnostics: 1,
          message: `${target.name}: refusing a sample with 1 type error(s)`,
        })
      );
    }),
  });

describe("check-census gate parser", () => {
  it.effect("reads instantiations, types, and check time from single-checker output", () =>
    Effect.gen(function* () {
      const parsed = yield* Effect.fromResult(
        parseCheckCensusSample({ exitCode: 0, output: cleanRun }, "@beep/schema")
      );

      expect(parsed).toStrictEqual(sample(710979, 961, 202571));
    })
  );

  it.effect("reads the same metrics through the pipeable form", () =>
    Effect.gen(function* () {
      const parsed = yield* Effect.fromResult(readCheckCensusMetrics("@beep/schema")(cleanRun));

      expect(parsed.checkTimeMs).toBe(961);
    })
  );

  it.effect("refuses a sample whose output contains an error TS diagnostic", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Effect.fromResult(parseCheckCensusSample({ exitCode: 2, output: failingRun }, "typeperf"))
      );

      assertInstanceOf(error, CheckCensusSampleRefused);
      expect(error.diagnostics).toBe(1);
      expect(error.exitCode).toBe(2);
      expect(error.message).toContain("refusing a sample with 1 type error(s) (tsc exit 2)");
      expect(error.message).toContain("error TS377098");
    })
  );

  it.effect("refuses a non-zero exit even when no diagnostic line was printed", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Effect.fromResult(parseCheckCensusSample({ exitCode: 1, output: cleanRun }, "@beep/schema"))
      );

      assertInstanceOf(error, CheckCensusSampleRefused);
      expect(error.diagnostics).toBe(0);
      expect(error.message).toBe("@beep/schema: refusing a sample: tsc exited 1 without reporting a type error");
    })
  );

  it.effect("names the metric a truncated run did not print", () =>
    Effect.gen(function* () {
      const truncated = A.join(
        A.filter(Str.split(cleanRun, "\n"), (line) => !Str.startsWith("Check time")(line)),
        "\n"
      );
      const error = yield* Effect.flip(
        Effect.fromResult(parseCheckCensusSample({ exitCode: 0, output: truncated }, "@beep/schema"))
      );

      assertInstanceOf(error, CheckCensusMetricMissing);
      expect(error.metric).toBe("Check time");
    })
  );
});

describe("check-census gate comparison", () => {
  const baselineRow = row("@beep/schema", 1000, 1000);

  it("fails an instantiation increase", () => {
    const comparison = compareCheckCensusSample(sample(1001, 1000), baselineRow);

    expect(comparison.instantiations).toBe("increase");
    expect(comparison.checkTime).toBe("within-band");
  });

  it("keeps an unchanged count and a check time inside the 5% band", () => {
    const comparison = compareCheckCensusSample(sample(1000, 1050), baselineRow);

    expect(comparison.instantiations).toBe("unchanged");
    expect(comparison.checkTime).toBe("within-band");
  });

  it("flags a check time beyond the band as slower without an instantiation verdict", () => {
    const comparison = compareCheckCensusSample(sample(1000, 1051), baselineRow);

    expect(comparison.instantiations).toBe("unchanged");
    expect(comparison.checkTime).toBe("slower");
  });

  it("reports decreases for the tighten hint", () => {
    const comparison = compareCheckCensusSample(baselineRow)(sample(900, 900));

    expect(comparison.instantiations).toBe("decrease");
    expect(comparison.checkTime).toBe("faster");
  });

  it("keeps a zero-millisecond baseline defined", () => {
    expect(compareCheckCensusSample(sample(10, 0), row("tiny", 10, 0)).checkTime).toBe("within-band");
    expect(compareCheckCensusSample(sample(10, 3), row("tiny", 10, 0)).checkTime).toBe("slower");
  });

  it("fails the gate on an increase or a compiler change, and renders every verdict line", () => {
    const report = (compiler: string, comparisons: ReadonlyArray<ReturnType<typeof compareCheckCensusSample>>) =>
      CheckCensusGateReport.make({
        baselineCommit: "368998daff",
        baselineCompiler: "7.0.2+effect-tsgo.0.45.0",
        compiler,
        comparisons,
      });
    const increased = compareCheckCensusSample(sample(1200, 1100), baselineRow);
    const decreased = compareCheckCensusSample(sample(900, 1000), row("@beep/repo-cli", 1000, 1000));

    expect(checkCensusGateFailed(report("7.0.2+effect-tsgo.0.45.0", [decreased]))).toBe(false);
    expect(checkCensusGateFailed(report("7.0.2+effect-tsgo.0.45.0", [increased, decreased]))).toBe(true);
    expect(checkCensusGateFailed(report("7.0.3+effect-tsgo.0.46.0", [decreased]))).toBe(true);

    const lines = renderCheckCensusGateLines(report("7.0.2+effect-tsgo.0.45.0", [increased, decreased]));
    expect(A.some(lines, Str.startsWith("FAIL @beep/schema: single-checker instantiations increased by 200."))).toBe(
      true
    );
    expect(A.some(lines, Str.startsWith("advisory @beep/schema: check time +10%"))).toBe(true);
    expect(A.some(lines, Str.startsWith("tighten @beep/repo-cli: single-checker instantiations dropped by 100;"))).toBe(
      true
    );
    // A faster check time alone is noise, not a gain worth re-baselining.
    expect(A.some(lines, Str.startsWith("tighten @beep/schema"))).toBe(false);
    expect(A.some(lines, Str.includes("instantiations 1000 -> 900 (-100) decrease"))).toBe(true);
  });
});

const FileSystemLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

it.layer(FileSystemLayer, { timeout: "30 seconds" })("check-census baseline document", (it) => {
  it.effect("round-trips the baseline through the committed JSONC codec with its header", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "check-census-gate-" });
      const file = path.join(root, "standards", "check-census.regression-baseline.jsonc");
      const baseline = baselineOf(
        [row("@beep/schema", 710979, 961, 202571), row("@beep/repo-cli", 4153241, 11756)],
        [row("@beep/schema#typeperf/baseline", 62827, 87, 27962)]
      );

      yield* writeCheckCensusBaseline(file, baseline);
      const text = yield* fs.readFileString(file);
      const decoded = yield* readCheckCensusBaseline(file);

      expect(decoded).toStrictEqual(baseline);
      expect(text).toContain(
        "// Check-census single-checker baseline (check-census-baseline/v1). Do not edit by hand."
      );
      expect(text).toContain("bun run beep quality check-census --write-baseline");
      expect(text).toContain('"schemaVersion": "check-census-baseline/v1"');
    })
  );

  it.effect("seeds the default programs until a baseline exists, then reads the committed rows", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "check-census-gate-" });
      const file = path.join(root, "baseline.jsonc");

      const seeded = yield* resolveCheckCensusTargets(file);
      expect(targetNames(seeded)).toStrictEqual(defaultTargetNames);
      expect(A.map(seeded.packages, (target) => target.name)).toContain("@beep/law-practice-domain");

      yield* writeCheckCensusBaseline(file, baselineOf([row("@beep/schema", 1, 1)], [row("fixture", 1, 1)]));
      const committed = yield* resolveCheckCensusTargets(file);
      expect(A.map(committed.packages, (target) => target.tsconfig)).toStrictEqual([
        "packages/@beep/schema/tsconfig.json",
      ]);
      expect(A.map(committed.typeperfFixtures, (target) => target.tsconfig)).toStrictEqual([
        "packages/fixture/tsconfig.json",
      ]);
    })
  );
});

describe("check-census gate orchestration", () => {
  it.effect("measures the filtered rows one by one and compares them in baseline order", () =>
    Effect.gen(function* () {
      const measured: Array<string> = [];
      const samples = HashMap.make(
        ["@beep/schema", sample(700000, 950)],
        ["@beep/schema#typeperf/baseline", sample(62900, 80)]
      );
      const baseline = baselineOf(
        [row("@beep/schema", 710979, 961), row("@beep/repo-cli", 4153241, 11756)],
        [row("@beep/schema#typeperf/baseline", 62827, 82)]
      );

      const report = yield* runCheckCensusGate(baseline, O.some("@beep/schema")).pipe(
        Effect.provideService(CheckCensusSampler, fixedSampler(samples, measured))
      );

      expect(measured).toStrictEqual(["@beep/schema", "@beep/schema#typeperf/baseline"]);
      expect(A.map(report.comparisons, (comparison) => comparison.instantiations)).toStrictEqual([
        "decrease",
        "increase",
      ]);
      expect(checkCensusGateFailed(report)).toBe(true);
    })
  );

  // `--gate-only --filter __no_such_row__`: a filter that selects no baseline row must not pass.
  it.effect("fails a filter that selects no baseline row and names the filter", () =>
    Effect.gen(function* () {
      const measured: Array<string> = [];
      const baseline = baselineOf(
        [row("@beep/schema", 710979, 961)],
        [row("@beep/schema#typeperf/baseline", 62827, 82)]
      );

      const report = yield* runCheckCensusGate(baseline, O.some("__no_such_row__")).pipe(
        Effect.provideService(CheckCensusSampler, fixedSampler(HashMap.empty(), measured))
      );

      expect(measured).toStrictEqual([]);
      expect(report.comparisons).toStrictEqual([]);
      assertSome(report.filter, "__no_such_row__");
      expect(checkCensusGateFailed(report)).toBe(true);
      expect(checkCensusGateFailureMessage(report)).toBe(
        `check-census gate failed: no baselined program was selected (--filter "__no_such_row__", baseline ${CHECK_CENSUS_BASELINE_PATH}).`
      );
      expect(
        A.some(
          renderCheckCensusGateLines(report),
          Str.startsWith('FAIL no baselined program was selected (--filter "__no_such_row__")')
        )
      ).toBe(true);
    })
  );

  it.effect("refuses to assemble a baseline when any program fails to type-check", () =>
    Effect.gen(function* () {
      const measured: Array<string> = [];
      const samples = HashMap.make(["@beep/schema", sample(710979, 961)]);
      const provenance = CheckCensusBaselineProvenance.make({
        measuredAt: "2026-09-29T12:00:00.000Z",
        commit: "368998daff",
        dirtyWorktree: false,
      });

      const error = yield* measureCheckCensusBaseline(CHECK_CENSUS_DEFAULT_TARGETS, provenance).pipe(
        Effect.provideService(CheckCensusSampler, fixedSampler(samples, measured)),
        Effect.flip
      );

      assertInstanceOf(error, CheckCensusSampleRefused);
      expect(error.target).toBe("@beep/repo-cli");
      expect(measured).toStrictEqual(["@beep/schema", "@beep/repo-cli"]);
    })
  );

  it.effect("stamps the compiler, command, and band onto a measured baseline", () =>
    Effect.gen(function* () {
      const samples = HashMap.fromIterable(
        A.map(defaultTargetNames, (name, index) => [name, sample(1000 + index, 100)] as const)
      );
      const provenance = CheckCensusBaselineProvenance.make({
        measuredAt: "2026-09-29T12:00:00.000Z",
        commit: "368998daff",
        dirtyWorktree: true,
      });

      const baseline = yield* measureCheckCensusBaseline(CHECK_CENSUS_DEFAULT_TARGETS, provenance).pipe(
        Effect.provideService(CheckCensusSampler, fixedSampler(samples, []))
      );

      expect(baseline.schemaVersion).toBe("check-census-baseline/v1");
      expect(baseline.compiler).toBe("7.0.2+effect-tsgo.0.45.0");
      expect(baseline.checkTimeBandPercent).toBe(5);
      expect(baseline.dirtyWorktree).toBe(true);
      expect(A.map(checkCensusBaselineRows(baseline), (baselineRow) => baselineRow.instantiations)).toStrictEqual(
        A.map(defaultTargetNames, (_, index) => 1000 + index)
      );
      expect(A.map(baseline.typeperfFixtures, (baselineRow) => baselineRow.name)).toStrictEqual(
        A.map(CHECK_CENSUS_DEFAULT_TARGETS.typeperfFixtures, (target) => target.name)
      );
    })
  );
});

describe("check-census compiler output helpers", () => {
  it("splits output into trimmed lines and recognises diagnostics", () => {
    const lines = compilerOutputLines(failingRun);

    expect(A.length(lines)).toBe(4);
    expect(A.filter(lines, isCompilerDiagnosticLine)).toHaveLength(1);
  });

  it("passes every name without a filter and only matching names with one", () => {
    expect(nameFilterPredicate(O.none())("@beep/repo-cli")).toBe(true);
    expect(nameFilterPredicate(O.some("typeperf"))("@beep/schema#typeperf/baseline")).toBe(true);
    expect(nameFilterPredicate(O.some("typeperf"))("@beep/schema")).toBe(false);
  });
});
