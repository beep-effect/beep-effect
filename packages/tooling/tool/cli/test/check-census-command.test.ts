import {
  CHECK_CENSUS_BASELINE_PATH,
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
import { encodeJsonString } from "@beep/schema/Json";
import { expect, it } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import { Command } from "effect/cli";
import * as O from "effect/Option";
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

const TestLayer = Layer.mergeAll(FsUtilsLive, TestConsole.layer).pipe(Layer.provideMerge(NodeTestLayer));

const runCheckCensusCommand = Command.runWith(checkCensusCommand, { version: "0.0.0" });
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(CheckCensusReport));

const FIXTURE_COMPILER = "7.0.2+fixture";
const REPORT_PATH = "out/check-census.json";

// One shim answers for both `tsgo` (census) and `tsc` (gate sampler): `--version`
// prints the fixture compiler, `--listFilesOnly` prints the program's one source
// file, and every other run prints the `--extendedDiagnostics` metric lines. A
// `sample.txt` next to the tsconfig overrides the metrics; a `no-metrics` marker
// makes the run print nothing, like a compiler that dropped `--extendedDiagnostics`.
const compilerShim = `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "Version ${FIXTURE_COMPILER}"
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
  yield* writeProjectFile(
    "package.json",
    yield* encodeJsonString({ name: "check-census-command-fixture", private: true, workspaces: ["packages/*"] })
  );
  yield* writeProjectFile(
    "packages/consumer/package.json",
    yield* encodeJsonString({ name: "@fixture/consumer", private: true })
  );
  yield* writeProjectFile("packages/consumer/tsconfig.json", yield* encodeJsonString({ include: ["src"] }));
  yield* writeProjectFile(
    "packages/consumer/tsconfig.check.json",
    yield* encodeJsonString({ extends: "./tsconfig.json", references: [] })
  );
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
        assertTrue(O.isSome(report.gate));
        const gate = report.gate.value;
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
      assertTrue(O.isSome(report.gate));
      expect(A.map(report.gate.value.comparisons, (comparison) => comparison.instantiations)).toStrictEqual([
        "increase",
      ]);
      expect(yield* loggedSince(mark)).toContain(
        "FAIL @fixture/consumer: single-checker instantiations increased by 200."
      );
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
      assertTrue(O.isSome(report.gate));
      assertSome(report.gate.value.filter, "consumer");
      expect(yield* loggedSince(mark)).toContain("@fixture/consumer");
    })
  );

  it.effect("fails the census when the compiler prints no --extendedDiagnostics metrics", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fixtureRepo;
      yield* writeProjectFile("packages/consumer/no-metrics", "");

      const exit = yield* Effect.exit(runCheckCensusCommand(["--output-json", REPORT_PATH]));

      assertTrue(Exit.isFailure(exit));
      const error = Cause.findErrorOption(exit.cause);
      assertTrue(O.isSome(error));
      expect(error.value._tag).toBe("QualityScriptCommandError");
      expect(error.value.message).toContain("Instantiations");
      expect(yield* fs.exists(REPORT_PATH)).toBe(false);
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
      expect(yield* fs.exists(REPORT_PATH)).toBe(false);
      expect(yield* loggedSince(mark)).toContain(`wrote ${CHECK_CENSUS_BASELINE_PATH}`);
    })
  );
});
