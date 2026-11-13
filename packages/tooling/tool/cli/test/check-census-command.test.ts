import {
  CHECK_CENSUS_BASELINE_PATH,
  CHECK_CENSUS_BASELINE_WRITE_COMMAND,
  CHECK_CENSUS_DEFAULT_TARGETS,
  CheckCensusBaseline,
  CheckCensusBaselineRow,
  CheckCensusReport,
  checkCensusBaselineRows,
  checkCensusCommand,
  readCheckCensusBaseline,
  writeCheckCensusBaseline,
} from "@beep/repo-cli/test/Quality";
import { FsUtilsLive } from "@beep/repo-utils";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import {
  expectReportedExit,
  NodeTestLayer,
  readProjectFile,
  temporaryWorkingDirectory,
  writeProjectFile,
} from "./support/CommandTest.ts";

// Hosted runners export `GITHUB_STEP_SUMMARY` to every process, test workers included, and the
// gate appends to it; the suite runs off-runner unless a test names its own summary file.
const TestLayer = Layer.mergeAll(
  FsUtilsLive,
  TestConsole.layer,
  ConfigProvider.layer(ConfigProvider.fromUnknown({}))
).pipe(Layer.provideMerge(NodeTestLayer));

const runCheckCensusCommand = Command.runWith(checkCensusCommand, { version: "0.0.0" });

// One run on a runner whose job summary is `summary.md` in the fixture root.
const onRunner = Effect.fn("CheckCensusCommandTest.onRunner")(function* (root: string) {
  const path = yield* Path.Path;
  const summaryPath = path.join(root, "summary.md");
  return {
    summaryPath,
    run: (args: ReadonlyArray<string>) =>
      runCheckCensusCommand(args).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ GITHUB_STEP_SUMMARY: summaryPath })
        )
      ),
  };
});
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(CheckCensusReport));
const encodeJsonString = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const FIXTURE_COMPILER = "7.0.2+fixture";
const REPORT_PATH = "out/check-census.json";

// One shim answers for both `tsgo` (census) and `tsc` (gate sampler): `--version`
// prints the fixture compiler, `--listFilesOnly` prints the program's one source
// file, and every other run prints the `--extendedDiagnostics` metric lines. A
// `sample.txt` next to the tsconfig overrides the metrics; a `no-metrics` marker
// makes the run print nothing, like a compiler that dropped `--extendedDiagnostics`;
// an `unrecognised-version` marker at the root garbles `--version`.
const compilerShim = `#!/bin/sh
if [ "$1" = "--version" ]; then
  if [ -f unrecognised-version ]; then
    echo "tsc development build"
  else
    echo "Version ${FIXTURE_COMPILER}"
  fi
  exit 0
fi
dir=$(dirname "$2")
for arg in "$@"; do
  if [ "$arg" = "--listFilesOnly" ]; then
    echo "$dir/src/index.ts"
    exit 0
  fi
done
if [ -f "$dir/no-metrics" ]; then
  exit 0
fi
if [ -f "$dir/sample.txt" ]; then
  cat "$dir/sample.txt"
  exit 0
fi
printf 'Types:          100\\nInstantiations: 1000\\nCheck time:     0.010s\\n'
`;

const metricLines = (instantiations: number) =>
  `Types:          100\nInstantiations: ${instantiations}\nCheck time:     0.010s\n`;

const baselineRow = CheckCensusBaselineRow.make({
  name: "@fixture/consumer",
  tsconfig: "packages/consumer/tsconfig.json",
  instantiations: 1000,
  types: 100,
  checkTimeMs: 10,
});

const fixtureBaseline = CheckCensusBaseline.make({
  measuredAt: "2026-09-29T12:00:00.000Z",
  commit: "368998daff4b5d6c0e2f1a3b7c9d8e6f5a4b3c2d",
  dirtyWorktree: false,
  compiler: FIXTURE_COMPILER,
  command: "bun run tsc -p <tsconfig> --noEmit --extendedDiagnostics --singleThreaded --tsBuildInfoFile <fresh>",
  checkTimeBandPercent: 5,
  packages: [baselineRow],
  typeperfFixtures: [],
});

// A one-package workspace with a check overlay, shimmed compilers, and a
// committed baseline whose only row is that package, entered as the working
// directory for the rest of the test's scope.
const fixtureRepo = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* temporaryWorkingDirectory;

  yield* writeProjectFile("bun.lock", "");
  const encodedJsonString = yield* encodeJsonString({
    name: "check-census-command-fixture",
    private: true,
    workspaces: ["packages/*"],
  });
  yield* writeProjectFile("package.json", encodedJsonString);
  const encodedJsonString1 = yield* encodeJsonString({ name: "@fixture/consumer", private: true });
  yield* writeProjectFile("packages/consumer/package.json", encodedJsonString1);
  const encodedJsonString2 = yield* encodeJsonString({ include: ["src"] });
  yield* writeProjectFile("packages/consumer/tsconfig.json", encodedJsonString2);
  const encodedJsonString3 = yield* encodeJsonString({ extends: "./tsconfig.json", references: [] });
  yield* writeProjectFile("packages/consumer/tsconfig.check.json", encodedJsonString3);
  yield* writeProjectFile("packages/consumer/src/index.ts", "export const consumerValue = 1;\n");
  yield* Effect.forEach(["tsc", "tsgo"], (compiler) =>
    writeProjectFile(`node_modules/.bin/${compiler}`, compilerShim).pipe(
      Effect.andThen(fs.chmod(`node_modules/.bin/${compiler}`, 0o755))
    )
  );
  yield* writeCheckCensusBaseline(CHECK_CENSUS_BASELINE_PATH, fixtureBaseline);
  return root;
}).pipe(Effect.withSpan("CheckCensusCommandTest.fixtureRepo"));

const readReport = readProjectFile(REPORT_PATH).pipe(Effect.flatMap(decodeReport));

// The shared TestConsole accumulates across the suite; read only this run's lines.
const logMark = Effect.map(TestConsole.logLines, A.length);
const loggedSince = (mark: number) =>
  Effect.map(TestConsole.logLines, (lines) => A.join(A.map(A.drop(lines, mark), String), "\n"));

const runGit = (root: string, args: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd: root, stderr: "pipe", stdout: "pipe" }
  );
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return Str.trim(result.stdout.toString());
};

it.layer(TestLayer, { timeout: "60 seconds" })("check-census command", (it) => {
  it.effect(
    "gates the committed baseline without the census under --gate-only and writes the gate into the report",
    () =>
      Effect.gen(function* () {
        yield* fixtureRepo;
        const mark = yield* logMark;

        yield* runCheckCensusCommand(["--gate-only", "--output-json", REPORT_PATH]);

        const report = yield* readReport;
        expect(report.rows).toStrictEqual([]);
        const gate = yield* Effect.fromOption(report.gate);
        expect(gate.compiler).toBe(FIXTURE_COMPILER);
        expect(gate.baselinePath).toBe(CHECK_CENSUS_BASELINE_PATH);
        expect(A.map(gate.comparisons, (comparison) => comparison.instantiations)).toStrictEqual(["unchanged"]);

        const logged = yield* loggedSince(mark);
        expect(logged).toContain(`wrote ${REPORT_PATH}`);
        expect(logged).not.toContain("FAIL");
      })
  );

  it.effect("fails the run when a baselined program's instantiations increase, after writing the report", () =>
    Effect.gen(function* () {
      yield* fixtureRepo;
      yield* writeProjectFile("packages/consumer/sample.txt", metricLines(1200));
      const mark = yield* logMark;

      const exit = yield* Effect.exit(runCheckCensusCommand(["--gate-only", "--output-json", REPORT_PATH]));

      expectReportedExit(exit);
      const report = yield* readReport;
      const gate = yield* Effect.fromOption(report.gate);
      expect(A.map(gate.comparisons, (comparison) => comparison.instantiations)).toStrictEqual(["increase"]);
      const loggedSince4 = yield* loggedSince(mark);
      expect(loggedSince4).toContain("FAIL @fixture/consumer: single-checker instantiations increased by 200.");
    })
  );

  it.effect("runs the overlay census before the gate when --gate-only is absent", () =>
    Effect.gen(function* () {
      yield* fixtureRepo;
      const mark = yield* logMark;

      yield* runCheckCensusCommand(["--filter", "consumer", "--output-json", REPORT_PATH]);

      const report = yield* readReport;
      expect(A.map(report.rows, (row) => row.package)).toStrictEqual(["@fixture/consumer"]);
      const row = report.rows[0];
      expect(row?.overlay.instantiations).toBe(1000);
      expect(row?.delta.instantiations).toBe(0);
      expect(row?.buildOverlapFiles).toBe(1);
      const gate = yield* Effect.fromOption(report.gate);
      assertSome(gate.filter, "consumer");
      const loggedSince5 = yield* loggedSince(mark);
      expect(loggedSince5).toContain("@fixture/consumer");
    })
  );

  it.effect("fails the census when the compiler prints no --extendedDiagnostics metrics", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fixtureRepo;
      yield* writeProjectFile("packages/consumer/no-metrics", "");

      const exit = yield* Effect.exit(runCheckCensusCommand(["--output-json", REPORT_PATH]));

      if (!Exit.isFailure(exit)) throw new Error("Expected a failure exit");
      const error = yield* exit.cause.pipe(Cause.findErrorOption, Effect.fromOption);
      expect(error._tag).toBe("QualityScriptCommandError");
      expect(error.message).toContain("Instantiations");
      const exists6 = yield* fs.exists(REPORT_PATH);
      expect(exists6).toBe(false);
    })
  );

  it.effect("refuses to gate when tsc --version prints no recognisable version", () =>
    Effect.gen(function* () {
      yield* fixtureRepo;
      yield* writeProjectFile("unrecognised-version", "");

      const exit = yield* Effect.exit(runCheckCensusCommand(["--gate-only", "--output-json", REPORT_PATH]));

      if (!Exit.isFailure(exit)) throw new Error("Expected a failure exit");
      const error = yield* exit.cause.pipe(Cause.findErrorOption, Effect.fromOption);
      expect(error._tag).toBe("QualityScriptCommandError");
      expect(error.message).toContain("--version output: tsc development build");
    })
  );

  // No `tsgo` and a metric-less sample: an overlay census or a sampled program would fail the run.
  it.effect("checks only the compiler stamp under --stamp-only, ignoring --filter and writing no report", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fixtureRepo;
      yield* fs.remove("node_modules/.bin/tsgo");
      yield* writeProjectFile("packages/consumer/no-metrics", "");
      const mark = yield* logMark;

      yield* runCheckCensusCommand(["--stamp-only", "--filter", "__no_such_row__", "--output-json", REPORT_PATH]);

      const logged = yield* loggedSince(mark);
      expect(logged).toBe(`check-census stamp: baseline and installed compiler agree (${FIXTURE_COMPILER})`);
      const reportExists = yield* fs.exists(REPORT_PATH);
      expect(reportExists).toBe(false);
    })
  );

  it.effect("fails --stamp-only naming both compilers and the re-measure command when the baseline is stale", () =>
    Effect.gen(function* () {
      yield* fixtureRepo;
      const stalePath = "custom/stale-baseline.jsonc";
      yield* writeCheckCensusBaseline(
        stalePath,
        CheckCensusBaseline.make({ ...fixtureBaseline, compiler: "7.0.1+fixture" })
      );

      const error = yield* runCheckCensusCommand(["--stamp-only", "--baseline", stalePath]).pipe(Effect.flip);

      expect(error._tag).toBe("QualityScriptCommandError");
      expect(error.message).toBe(
        `check-census stamp: baseline ${stalePath} was measured with 7.0.1+fixture, but the installed compiler is ${FIXTURE_COMPILER}; re-measure with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\` (the write needs a built tree).`
      );
    })
  );

  it.effect("fails --stamp-only on a missing or undecodable baseline exactly as the gate does", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fixtureRepo;
      const failureMessage = (args: ReadonlyArray<string>) =>
        runCheckCensusCommand(args).pipe(
          Effect.flip,
          Effect.map((error) => error.message)
        );

      yield* fs.remove(CHECK_CENSUS_BASELINE_PATH);
      const missing = yield* failureMessage(["--stamp-only"]);
      const gateMissing = yield* failureMessage(["--gate-only", "--output-json", REPORT_PATH]);
      expect(missing).toContain(`; create it with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\`.`);
      expect(missing).toBe(gateMissing);

      yield* writeProjectFile(CHECK_CENSUS_BASELINE_PATH, "{}\n");
      const undecodable = yield* failureMessage(["--stamp-only"]);
      const gateUndecodable = yield* failureMessage(["--gate-only", "--output-json", REPORT_PATH]);
      expect(undecodable).toContain("as check-census-baseline/v1.");
      expect(undecodable).toBe(gateUndecodable);
    })
  );

  it.effect("rejects --stamp-only combined with any other mode flag before measuring anything", () =>
    Effect.gen(function* () {
      yield* fixtureRepo;
      const others: ReadonlyArray<ReadonlyArray<string>> = [
        ["--write-baseline"],
        ["--gate-only"],
        ["--build-equivalence"],
        ["--seed"],
        ["--initial-state", "restored"],
        ["--equivalence-output-json", "out/equivalence.json"],
      ];

      const errors = yield* Effect.forEach(others, (flags) =>
        runCheckCensusCommand(["--stamp-only", ...flags]).pipe(Effect.flip)
      );

      expect(A.map(errors, (error) => error._tag)).toStrictEqual(A.map(others, () => "QualityScriptCommandError"));
      expect(A.dedupe(A.map(errors, (error) => error.message))).toStrictEqual([
        "--stamp-only runs alone (not with --write-baseline, --gate-only, --build-equivalence, --seed, --initial-state or --equivalence-output-json).",
      ]);
    })
  );

  // The Heavy / Check lane's step: a stale stamp is Repo Sanity's red, so the gate defers it.
  it.effect("defers a stale baseline under --defer-stale-stamp without sampling and names it in the job summary", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fixtureRepo;
      yield* writeCheckCensusBaseline(
        CHECK_CENSUS_BASELINE_PATH,
        CheckCensusBaseline.make({ ...fixtureBaseline, compiler: "7.0.1+fixture" })
      );
      // A sampled program would fail the run: the shim prints no metrics for it.
      yield* writeProjectFile("packages/consumer/no-metrics", "");
      const runner = yield* onRunner(root);
      const mark = yield* logMark;

      yield* runner.run(["--gate-only", "--defer-stale-stamp", "--output-json", REPORT_PATH]);

      const deferral = `check-census gate deferred: baseline ${CHECK_CENSUS_BASELINE_PATH} was measured with 7.0.1+fixture, but the installed compiler is ${FIXTURE_COMPILER}, so the baseline is stale and must be re-measured with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\` (the write needs a built tree). Repo Sanity's stamp check (\`check-census --stamp-only\`) owns that red; this run samples nothing and passes.`;
      const logged = yield* loggedSince(mark);
      expect(logged).toContain(deferral);
      expect(logged).not.toContain("FAIL");
      const summary = yield* fs.readFileString(runner.summaryPath);
      expect(summary).toBe(`### check-census gate\n\n${deferral}\n`);
      const report = yield* readReport;
      assertNone(report.gate);
    })
  );

  it.effect("still fails a stale baseline when --defer-stale-stamp is absent", () =>
    Effect.gen(function* () {
      yield* fixtureRepo;
      yield* writeCheckCensusBaseline(
        CHECK_CENSUS_BASELINE_PATH,
        CheckCensusBaseline.make({ ...fixtureBaseline, compiler: "7.0.1+fixture" })
      );
      const mark = yield* logMark;

      const exit = yield* Effect.exit(runCheckCensusCommand(["--gate-only", "--output-json", REPORT_PATH]));

      expectReportedExit(exit);
      const logged = yield* loggedSince(mark);
      expect(logged).toContain("FAIL compiler changed: baseline measured with 7.0.1+fixture");
      expect(logged).not.toContain("check-census gate deferred");
    })
  );

  it.effect("gates the owned rows normally under --defer-stale-stamp and appends the table to the job summary", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fixtureRepo;
      const runner = yield* onRunner(root);

      yield* runner.run([
        "--gate-only",
        "--defer-stale-stamp",
        "--row-packages",
        " @fixture/consumer , @fixture/absent",
        "--output-json",
        REPORT_PATH,
      ]);

      const gate = yield* readReport.pipe(Effect.flatMap((report) => Effect.fromOption(report.gate)));
      assertSome(gate.rowPackages, ["@fixture/consumer", "@fixture/absent"]);
      expect(A.map(gate.comparisons, (comparison) => comparison.name)).toStrictEqual(["@fixture/consumer"]);
      const summary = yield* fs.readFileString(runner.summaryPath);
      expect(summary).toContain("| `@fixture/consumer` | strict (+32) | 1000 | 1000 | 0 | 0% | unchanged |");
      expect(summary).toContain("Result: pass.");
    })
  );

  it.effect("fails a --row-packages selection that owns no baseline row and names it", () =>
    Effect.gen(function* () {
      yield* fixtureRepo;
      const mark = yield* logMark;

      const exit = yield* Effect.exit(
        runCheckCensusCommand(["--gate-only", "--row-packages", "@fixture/absent", "--output-json", REPORT_PATH])
      );

      expectReportedExit(exit);
      const logged = yield* loggedSince(mark);
      expect(logged).toContain("FAIL no baselined program was selected (no --filter, --row-packages @fixture/absent)");
    })
  );

  it.effect("rejects the gate-shaping flags beside a mode that runs no gate", () =>
    Effect.gen(function* () {
      yield* fixtureRepo;
      const combinations: ReadonlyArray<ReadonlyArray<string>> = A.flatMap(
        [["--write-baseline"], ["--stamp-only"], ["--build-equivalence"]],
        (mode) => [
          [...mode, "--defer-stale-stamp"],
          [...mode, "--row-packages", "@fixture/consumer"],
        ]
      );

      const errors = yield* Effect.forEach(combinations, (flags) => runCheckCensusCommand(flags).pipe(Effect.flip));

      expect(A.dedupe(A.map(errors, (error) => error.message))).toStrictEqual([
        "--defer-stale-stamp and --row-packages shape the gate (not --write-baseline, --stamp-only or --build-equivalence).",
      ]);
    })
  );

  it.effect("seeds the default programs on the first --write-baseline and stamps the git provenance", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fixtureRepo;
      yield* fs.remove(CHECK_CENSUS_BASELINE_PATH);
      runGit(root, ["init", "--quiet"]);
      runGit(root, ["commit", "--allow-empty", "--no-verify", "--quiet", "-m", "fixture"]);
      const head = runGit(root, ["rev-parse", "HEAD"]);
      const mark = yield* logMark;

      yield* runCheckCensusCommand(["--write-baseline"]);

      const baseline = yield* readCheckCensusBaseline(CHECK_CENSUS_BASELINE_PATH);
      expect(baseline.commit).toBe(head);
      expect(baseline.compiler).toBe(FIXTURE_COMPILER);
      // The fixture's untracked files make the worktree dirty.
      expect(baseline.dirtyWorktree).toBe(true);
      expect(A.map(checkCensusBaselineRows(baseline), (row) => row.name)).toStrictEqual(
        A.map(
          A.appendAll(CHECK_CENSUS_DEFAULT_TARGETS.packages, CHECK_CENSUS_DEFAULT_TARGETS.typeperfFixtures),
          (target) => target.name
        )
      );
      expect(A.every(checkCensusBaselineRows(baseline), (row) => row.instantiations === 1000)).toBe(true);
      // --write-baseline skips the census and the gate, so no report is written.
      const exists7 = yield* fs.exists(REPORT_PATH);
      expect(exists7).toBe(false);
      const loggedSince8 = yield* loggedSince(mark);
      expect(loggedSince8).toContain(`wrote ${CHECK_CENSUS_BASELINE_PATH}`);
    })
  );
});
