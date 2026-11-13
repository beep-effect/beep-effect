import {
  BuildEquivalenceOptions,
  BuildEquivalencePackage,
  BuildEquivalenceReport,
  CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH,
  CHECK_CENSUS_PROBE_FILE_NAME,
  CHECK_CENSUS_PROBE_SOURCE,
  checkCensusCommand,
  renderBuildEquivalenceLines,
  runCheckCensusBuildEquivalence,
  selectBuildEquivalencePackages,
} from "@beep/repo-cli/test/Quality";
import { DECLARATION_ONLY_BUILD_COMMAND } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import {
  expectReportedExit,
  NodeTestLayer,
  readProjectFile,
  temporaryWorkingDirectory,
} from "./support/CommandTest.ts";

const TestLayer = Layer.mergeAll(FsUtilsLive, TestConsole.layer).pipe(Layer.provideMerge(NodeTestLayer));

const runCheckCensusCommand = Command.runWith(checkCensusCommand, { version: "0.0.0" });
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(BuildEquivalenceReport));
const encodeJsonString = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const FIXTURE_COMPILER = "Version 7.1.0-beta+fixture (tsrs fixture)";
const EMITTING_BUILD = DECLARATION_ONLY_BUILD_COMMAND;
const CHECK_CALL = "-p tsconfig.check.json --pretty false";
const LIST_CALLS = ["-p tsconfig.check.json --listFilesOnly", "-p tsconfig.json --listFilesOnly"];
const SERVED_CHECK = `${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`;
const BUILD_CALL = "-p tsconfig.json --emitDeclarationOnly --pretty false";
const PROBE_LINES = [
  "src/__census_probe.ts(3,14): error TS2322: Type 'string' is not assignable to type 'number'.",
  "src/__census_probe.ts(5,1): error TS377001: This Effect value is neither yielded nor used in an assignment. effect(floatingEffect)",
];
const BUILD_ONLY_LINE = "src/index.ts(1,1): error TS6133: 'unused' is declared but its value is never read.";

// A fake `tsrs`, run from the package directory as `tsrs -p <config> [flags]
// --pretty false`. A `--listFilesOnly` call is logged to `lists.log` and prints
// the absolute `src/*.ts` paths; the check config also lists a file outside the
// package and, with a `check-lists-scripts` marker, `scripts/generate.ts`.
// Any other call appends its arguments to `calls.log` and copies a present
// probe to `probe-seen.ts`; the build emits one `dist/<name>.d.ts` per source file; both
// programs print the probe's two diagnostics, unsorted, with exit 2 while
// `src/__census_probe.ts` exists. Markers in the package directory bend it:
// `build-extra-line` makes the build report a line the check does not,
// `probe-blind` makes both programs ignore the probe, `hang-on-seeded-output`
// makes a build hang once probe output exists, and `vanish-after-check`
// deletes the compiler after the first check, so the next spawn fails. A
// `silent-version` marker at the root silences `--version`.
const fakeCompiler = `#!/bin/sh
if [ "$1" = "--version" ]; then
  if [ ! -f silent-version ]; then
    echo "${FIXTURE_COMPILER}"
  fi
  exit 0
fi
config="$2"
if [ "$3" = "--listFilesOnly" ]; then
  echo "$*" >> lists.log
  here=$(pwd -P)
  for source in src/*.ts; do
    echo "$here/$source"
  done
  if [ "$config" = "tsconfig.check.json" ]; then
    echo "$(dirname "$here")/shared/upstream.d.ts"
    if [ -f check-lists-scripts ]; then
      echo "$here/scripts/generate.ts"
    fi
  fi
  exit 0
fi
echo "$*" >> calls.log
if [ -f src/__census_probe.ts ]; then
  cp src/__census_probe.ts probe-seen.ts
fi
if [ "$config" = "tsconfig.json" ]; then
  if [ -f hang-on-seeded-output ] && [ -f dist/__census_probe.d.ts ]; then
    exec sleep 30
  fi
  mkdir -p dist
  for source in src/*.ts; do
    name=$(basename "$source" .ts)
    echo "export {};" > "dist/$name.d.ts"
  done
  if [ -f build-extra-line ]; then
    echo "${BUILD_ONLY_LINE}"
    exit 2
  fi
elif [ -f vanish-after-check ]; then
  rm -f "$0"
fi
if [ -f src/__census_probe.ts ] && [ ! -f probe-blind ]; then
  echo "${PROBE_LINES[1]}"
  echo "${PROBE_LINES[0]}"
  exit 2
fi
exit 0
`;

const writeFixtureFile = Effect.fn("CheckCensusBuildEquivalenceTest.writeFixtureFile")(function* (
  root: string,
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(root, relativePath);

  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const writeFixtureJson = Effect.fn("CheckCensusBuildEquivalenceTest.writeFixtureJson")(function* (
  root: string,
  relativePath: string,
  document: unknown
) {
  yield* writeFixtureFile(root, relativePath, `${yield* encodeJsonString(document)}\n`);
});

// One workspace package: a manifest with the given `beep:build` (and
// `beep:check` when given), a build config, a check overlay unless `check` is
// false, and `src/index.ts` unless `src` is false.
const writeFixturePackage = Effect.fn("CheckCensusBuildEquivalenceTest.writeFixturePackage")(function* (
  root: string,
  dir: string,
  name: string,
  build: O.Option<string>,
  layout: { readonly check: boolean; readonly src: boolean } = { check: true, src: true },
  beepCheck: O.Option<string> = O.none()
) {
  const checkScript = O.match(beepCheck, { onNone: () => ({}), onSome: (script) => ({ "beep:check": script }) });
  yield* writeFixtureJson(root, `packages/${dir}/package.json`, {
    name,
    private: true,
    ...O.match(build, {
      onNone: () => ({}),
      onSome: (script) => ({ scripts: { "beep:build": script, ...checkScript } }),
    }),
  });
  yield* writeFixtureJson(root, `packages/${dir}/tsconfig.json`, { include: ["src"] });
  if (layout.check) {
    yield* writeFixtureJson(root, `packages/${dir}/tsconfig.check.json`, { extends: "./tsconfig.json" });
  }
  if (layout.src) {
    yield* writeFixtureFile(root, `packages/${dir}/src/index.ts`, "export const value: number = 1;\n");
  }
});

// A workspace root with the fake compiler at `node_modules/.bin/tsrs` and one
// emitting package, `@fixture/emitting` under `packages/emitting`, whose
// `beep:check` leads with the build when `served` is true.
const writeFixtureRepo = Effect.fn("CheckCensusBuildEquivalenceTest.writeFixtureRepo")(function* (
  root: string,
  served?: boolean
) {
  const isServed = served === true;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tsrsPath = path.join(root, "node_modules", ".bin", "tsrs");

  yield* writeFixtureFile(root, "bun.lock", "");
  yield* writeFixtureJson(root, "package.json", {
    name: "check-census-build-equivalence-fixture",
    private: true,
    workspaces: ["packages/*"],
  });
  yield* writeFixtureFile(root, "node_modules/.bin/tsrs", fakeCompiler);
  yield* fs.chmod(tsrsPath, 0o755);
  yield* writeFixturePackage(
    root,
    "emitting",
    "@fixture/emitting",
    O.some(EMITTING_BUILD),
    { check: true, src: true },
    isServed ? O.some(SERVED_CHECK) : O.none()
  );

  return {
    tsrsPath,
    pkg: BuildEquivalencePackage.make({
      name: "@fixture/emitting",
      dir: path.join(root, "packages", "emitting"),
      servedByBuild: isServed,
    }),
  };
});

const fixtureRoot = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "check-census-build-equivalence-" });
}).pipe(Effect.withSpan("CheckCensusBuildEquivalenceTest.fixtureRoot"));

const withTsrsFast = (value: O.Option<string>) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown(O.match(value, { onNone: () => ({}), onSome: (tsrsFast) => ({ TSRS_FAST: tsrsFast }) }))
  );

const readCalls = Effect.fn("CheckCensusBuildEquivalenceTest.readCalls")(function* (
  packageDir: string,
  logFile = "calls.log"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const log = yield* fs.readFileString(path.join(packageDir, logFile));
  return A.filter(Str.split(log, "\n"), Str.isNonEmpty);
});

const distEntries = Effect.fn("CheckCensusBuildEquivalenceTest.distEntries")(function* (packageDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(path.join(packageDir, "dist"));
  return A.sort(entries, Str.Order);
});

const exists = Effect.fn("CheckCensusBuildEquivalenceTest.exists")(function* (...segments: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.exists(path.join(...segments));
});

const firstRow = (report: BuildEquivalenceReport) => Effect.fromOption(A.head(report.rows));

const stateSeeds = (report: BuildEquivalenceReport): ReadonlyArray<string> =>
  A.flatMap(report.rows, (row) => A.map(row.comparisons, (comparison) => `${comparison.state}/${comparison.seed}`));

// The shared TestConsole accumulates across the suite; read only this run's lines.
const logMark = Effect.map(TestConsole.logLines, A.length);
const loggedSince = (mark: number) =>
  Effect.map(TestConsole.logLines, (lines) => A.join(A.map(A.drop(lines, mark), String), "\n"));

it.layer(TestLayer, { timeout: "60 seconds" })("check-census build equivalence", (it) => {
  it.effect("selects only emitting packages that own both configs and a src directory", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRoot;
      yield* writeFixtureRepo(root);
      yield* writeFixturePackage(
        root,
        "codegen",
        "@fixture/codegen",
        O.some(`bun run codegen && ${DECLARATION_ONLY_BUILD_COMMAND}`),
        { check: true, src: true },
        // The build program with flags of its own still serves the check.
        O.some(
          `${DECLARATION_ONLY_BUILD_COMMAND} --checkerCostCache source.tsrs-cost-cache && bun run beep:check:tests`
        )
      );
      // A JavaScript-emitting build (the retired default, or a reviewed override) runs another program.
      yield* writeFixturePackage(root, "javascript", "@fixture/javascript", O.some("tsrs -p tsconfig.json"));
      yield* writeFixturePackage(root, "babel", "@fixture/babel", O.some("tsrs -p tsconfig.json && bun run babel"));
      yield* writeFixturePackage(root, "noemit", "@fixture/noemit", O.some("tsrs -p tsconfig.check.json"));
      yield* writeFixturePackage(root, "nocheck", "@fixture/nocheck", O.some(EMITTING_BUILD), {
        check: false,
        src: true,
      });
      yield* writeFixturePackage(root, "nosrc", "@fixture/nosrc", O.some(EMITTING_BUILD), { check: true, src: false });
      yield* writeFixturePackage(root, "noscript", "@fixture/noscript", O.none());

      const all = yield* selectBuildEquivalencePackages(root, O.none());
      const filtered = yield* selectBuildEquivalencePackages(root, O.some("codegen"));

      expect(A.map(all, (pkg) => [pkg.name, pkg.servedByBuild])).toStrictEqual([
        ["@fixture/codegen", true],
        ["@fixture/emitting", false],
      ]);
      expect(A.map(filtered, (pkg) => pkg.name)).toStrictEqual(["@fixture/codegen"]);
    })
  );

  it.effect("compares a restored, a warm, and a cold clean build with one check run", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRoot;
      const { tsrsPath, pkg } = yield* writeFixtureRepo(root);

      const report = yield* runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({ repoRoot: root, tsrsPath, packages: [pkg], initialState: "restored" })
      ).pipe(withTsrsFast(O.some("1")));

      expect(report.schemaVersion).toBe("check-census-build-equivalence/v2");
      expect(report.compiler).toBe(FIXTURE_COMPILER);
      expect(report.tsrsFast).toBe("1");
      expect(report.mode).toBe("clean");
      expect(stateSeeds(report)).toStrictEqual(["restored/clean", "warm/clean", "cold/clean"]);
      const row = yield* firstRow(report);
      expect(A.every(row.comparisons, (comparison) => comparison.identical)).toBe(true);
      assertNone(row.probeEffective);
      // The file outside the package that only the check lists does not count.
      expect(row.checkOnlyFiles).toStrictEqual([]);
      expect(report.summary).toMatchObject({
        packages: 1,
        comparisons: 3,
        identical: 3,
        different: 0,
        widerChecks: 0,
        servedWiderChecks: 0,
      });
      // The check is stateless and runs once; the cold build rebuilt the outDir.
      const calls = yield* readCalls(pkg.dir);
      expect(calls).toStrictEqual([CHECK_CALL, BUILD_CALL, BUILD_CALL, BUILD_CALL]);
      const lists = yield* readCalls(pkg.dir, "lists.log");
      expect(lists).toStrictEqual(LIST_CALLS);
      const entries = yield* distEntries(pkg.dir);
      expect(entries).toStrictEqual(["index.d.ts"]);
      const lines = renderBuildEquivalenceLines(report);
      expect(lines[1]).toContain("restored/clean=  warm/clean=  cold/clean=");
      expect(lines[2]).toBe(
        "summary: 1 package(s), 3 comparison(s), 3 identical, 0 different, 0 ineffective probe(s), 0 wider check program(s) (0 of them served by the build)"
      );
    })
  );

  it.effect("skips the redundant warm build when the initial state is warm and records an unset TSRS_FAST", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRoot;
      const { tsrsPath, pkg } = yield* writeFixtureRepo(root);

      const report = yield* runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({ repoRoot: root, tsrsPath, packages: [pkg] })
      ).pipe(withTsrsFast(O.none()));

      expect(report.tsrsFast).toBe("unset");
      expect(report.initialState).toBe("warm");
      expect(stateSeeds(report)).toStrictEqual(["warm/clean", "cold/clean"]);
      expect(report.summary.different).toBe(0);
    })
  );

  it.effect("proves the real tsrs build and check agree on a seeded probe and leaves no probe output", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const root = yield* fixtureRoot;
      const packageDir = path.join(root, "pkg");
      const compilerOptions = {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        skipLibCheck: true,
        types: [],
        declaration: true,
        declarationMap: true,
        outDir: "dist",
        rootDir: "src",
        incremental: true,
        tsBuildInfoFile: "dist/tsconfig.tsbuildinfo",
      };
      yield* writeFixtureJson(packageDir, "tsconfig.json", { compilerOptions, include: ["src"] });
      yield* writeFixtureJson(packageDir, "tsconfig.check.json", {
        extends: "./tsconfig.json",
        compilerOptions: { noEmit: true, incremental: false, declaration: false, declarationMap: false },
      });
      yield* writeFixtureFile(packageDir, "src/index.ts", "export const value: number = 1;\n");
      const options = {
        repoRoot: root,
        tsrsPath: path.join(repoRoot, "node_modules", ".bin", "tsrs"),
        packages: [BuildEquivalencePackage.make({ name: "@fixture/real", dir: packageDir, servedByBuild: true })],
      };

      const clean = yield* runCheckCensusBuildEquivalence(BuildEquivalenceOptions.make(options));
      const seeded = yield* runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({ ...options, mode: "seeded", initialState: "restored" })
      );

      expect(clean.summary).toMatchObject({ comparisons: 2, identical: 2, different: 0 });
      expect(stateSeeds(seeded)).toStrictEqual([
        "restored/seeded",
        "warm/seeded",
        "cold/seeded",
        "warm/recovered",
        "cold/clean",
      ]);
      expect(seeded.summary).toMatchObject({ comparisons: 5, identical: 5, different: 0, ineffectiveProbes: 0 });
      const row = yield* firstRow(seeded);
      assertSome(row.probeEffective, true);
      // The overlay adds no file, and the probe written after the listing never takes part.
      expect(row.checkOnlyFiles).toStrictEqual([]);
      const [seededComparison] = row.comparisons;
      expect(seededComparison?.check.exitCode).not.toBe(0);
      expect(A.some(seededComparison?.check.lines ?? [], Str.includes("error TS2322"))).toBe(true);
      expect(A.map(A.drop(row.comparisons, 3), (comparison) => comparison.check)).toMatchObject([
        { exitCode: 0, lines: [] },
        { exitCode: 0, lines: [] },
      ]);
      const probeExists = yield* exists(packageDir, "src", CHECK_CENSUS_PROBE_FILE_NAME);
      expect(probeExists).toBe(false);
      const entries = yield* distEntries(packageDir);
      expect(entries).toContain("index.d.ts");
      expect(entries).toContain("index.d.ts.map");
      expect(A.some(entries, Str.endsWith(".js"))).toBe(false);
      expect(A.some(entries, Str.startsWith("__census_probe"))).toBe(false);
    })
  );

  it.effect("records the package files only the check program lists and passes when the check is not served", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRoot;
      const { tsrsPath, pkg } = yield* writeFixtureRepo(root);
      yield* writeFixtureFile(pkg.dir, "check-lists-scripts", "");

      const report = yield* runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({ repoRoot: root, tsrsPath, packages: [pkg] })
      );

      const row = yield* firstRow(report);
      expect(row.checkOnlyFiles).toStrictEqual(["scripts/generate.ts"]);
      expect(row.servedByBuild).toBe(false);
      expect(report.summary).toMatchObject({ widerChecks: 1, servedWiderChecks: 0, different: 0 });
      const lines = renderBuildEquivalenceLines(report);
      expect(lines[1]).toContain("+1 check-only file(s)");
      expect(lines).toContain("+ @fixture/emitting: check program lists 1 package file(s) the build program does not");
      expect(lines).toContain("  - scripts/generate.ts");
    })
  );

  it.effect("fails the command when a check the build serves lists package files the build does not", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const { pkg } = yield* writeFixtureRepo(root, true);
      yield* writeFixtureFile(pkg.dir, "check-lists-scripts", "");
      const mark = yield* logMark;

      const exit = yield* Effect.exit(runCheckCensusCommand(["--build-equivalence"]));

      expectReportedExit(exit);
      const report = yield* readProjectFile(CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH).pipe(
        Effect.flatMap(decodeReport)
      );
      expect(report.summary).toMatchObject({ different: 0, widerChecks: 1, servedWiderChecks: 1 });
      const row = yield* firstRow(report);
      expect([row.servedByBuild, row.checkOnlyFiles]).toStrictEqual([true, ["scripts/generate.ts"]]);
      const logged = yield* loggedSince(mark);
      expect(logged).toContain(
        "+ @fixture/emitting: check program lists 1 package file(s) the build program does not, but beep:check leads with the build"
      );
    })
  );

  it.effect("lists the files a wider real tsrs check program adds", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const root = yield* fixtureRoot;
      const packageDir = path.join(root, "pkg");
      const compilerOptions = {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        skipLibCheck: true,
        types: [],
        outDir: "dist",
        rootDir: "src",
      };
      yield* writeFixtureJson(packageDir, "tsconfig.json", { compilerOptions, include: ["src"] });
      yield* writeFixtureJson(packageDir, "tsconfig.check.json", {
        extends: "./tsconfig.json",
        include: ["src", "scripts"],
        compilerOptions: { noEmit: true, rootDir: "." },
      });
      yield* writeFixtureFile(packageDir, "src/index.ts", "export const value: number = 1;\n");
      yield* writeFixtureFile(packageDir, "scripts/generate.ts", 'export const generated: string = "x";\n');

      const report = yield* runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({
          repoRoot: root,
          tsrsPath: path.join(repoRoot, "node_modules", ".bin", "tsrs"),
          packages: [BuildEquivalencePackage.make({ name: "@fixture/wide", dir: packageDir, servedByBuild: false })],
        })
      );

      const row = yield* firstRow(report);
      expect(row.checkOnlyFiles).toStrictEqual(["scripts/generate.ts"]);
      expect(report.summary).toMatchObject({ widerChecks: 1, servedWiderChecks: 0 });
    })
  );

  it.effect("passes the clean command and writes the report to --equivalence-output-json", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      yield* writeFixtureRepo(root);
      const mark = yield* logMark;

      yield* runCheckCensusCommand([
        "--build-equivalence",
        "--initial-state",
        "restored",
        "--equivalence-output-json",
        "out/equivalence.json",
      ]);

      const report = yield* readProjectFile("out/equivalence.json").pipe(Effect.flatMap(decodeReport));
      expect(report.initialState).toBe("restored");
      expect(A.map(report.rows, (row) => row.package)).toStrictEqual(["@fixture/emitting"]);
      expect(report.summary.different).toBe(0);
      const logged = yield* loggedSince(mark);
      expect(logged).toContain("check census build equivalence (clean pass, initial state restored");
      expect(logged).toContain("wrote out/equivalence.json");
    })
  );

  it.effect("fails the command after writing the report when the build reports a line the check does not", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const { pkg } = yield* writeFixtureRepo(root);
      yield* writeFixtureFile(pkg.dir, "build-extra-line", "");
      const mark = yield* logMark;

      const exit = yield* Effect.exit(runCheckCensusCommand(["--build-equivalence", "--filter", "emitting"]));

      expectReportedExit(exit);
      const report = yield* readProjectFile(CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH).pipe(
        Effect.flatMap(decodeReport)
      );
      expect(report.summary).toMatchObject({ comparisons: 2, identical: 0, different: 2 });
      const row = yield* firstRow(report);
      expect(A.map(row.comparisons, (comparison) => [comparison.build, comparison.check])).toMatchObject([
        [
          { exitCode: 2, lines: [BUILD_ONLY_LINE] },
          { exitCode: 0, lines: [] },
        ],
        [
          { exitCode: 2, lines: [BUILD_ONLY_LINE] },
          { exitCode: 0, lines: [] },
        ],
      ]);
      const logged = yield* loggedSince(mark);
      expect(logged).toContain("warm/clean≠  cold/clean≠");
      expect(logged).toContain("≠ @fixture/emitting warm/clean");
      expect(logged).toContain("  build: exit 2, 1 line(s)");
      expect(logged).toContain(`  - ${BUILD_ONLY_LINE}`);
      expect(logged).toContain("  check: exit 0, 0 line(s)");
      expect(logged).toContain(`wrote ${CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH}`);
    })
  );

  it.effect("fails the seeded command when the probe does not bite, then leaves the tree clean", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const { pkg } = yield* writeFixtureRepo(root);
      yield* writeFixtureFile(pkg.dir, "probe-blind", "");
      const mark = yield* logMark;

      const exit = yield* Effect.exit(runCheckCensusCommand(["--build-equivalence", "--seed"]));

      expectReportedExit(exit);
      const report = yield* readProjectFile(CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH).pipe(
        Effect.flatMap(decodeReport)
      );
      expect(report.mode).toBe("seeded");
      const row = yield* firstRow(report);
      assertSome(row.probeEffective, false);
      expect(report.summary).toMatchObject({ comparisons: 5, different: 0, ineffectiveProbes: 1 });
      const logged = yield* loggedSince(mark);
      expect(logged).toContain("probe did not bite");
      const probeExists = yield* exists(pkg.dir, "src", CHECK_CENSUS_PROBE_FILE_NAME);
      expect(probeExists).toBe(false);
      const entries = yield* distEntries(pkg.dir);
      expect(entries).toStrictEqual(["index.d.ts"]);
    })
  );

  it.effect("writes the exact probe while the seeded pass runs and every seeded comparison bites", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fixtureRoot;
      const { tsrsPath, pkg } = yield* writeFixtureRepo(root);

      const report = yield* runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({ repoRoot: root, tsrsPath, packages: [pkg], mode: "seeded" })
      );

      const seen = yield* fs.readFileString(path.join(pkg.dir, "probe-seen.ts"));
      expect(seen).toBe(CHECK_CENSUS_PROBE_SOURCE);
      const row = yield* firstRow(report);
      // Every seeded comparison saw the probe's diagnostics, sorted.
      const seededChecks = A.map(A.take(row.comparisons, 3), (comparison) => comparison.check.lines);
      expect(seededChecks).toStrictEqual([PROBE_LINES, PROBE_LINES, PROBE_LINES]);
      assertSome(row.probeEffective, true);
      expect(report.summary).toMatchObject({ comparisons: 5, identical: 5 });
      const probeExists = yield* exists(pkg.dir, "src", CHECK_CENSUS_PROBE_FILE_NAME);
      expect(probeExists).toBe(false);
    })
  );

  it.effect("removes the probe and the outDir when a seeded pass is interrupted", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRoot;
      const { tsrsPath, pkg } = yield* writeFixtureRepo(root);
      yield* writeFixtureFile(pkg.dir, "hang-on-seeded-output", "");

      const result = yield* TestClock.withLive(
        runCheckCensusBuildEquivalence(
          BuildEquivalenceOptions.make({ repoRoot: root, tsrsPath, packages: [pkg], mode: "seeded" })
        ).pipe(Effect.timeoutOption("2 seconds"))
      );

      assertNone(result);
      // The as-found seeded build emitted probe output before the retry hung.
      const calls = yield* readCalls(pkg.dir);
      expect(calls).toStrictEqual([CHECK_CALL, BUILD_CALL, BUILD_CALL]);
      const probeExists = yield* exists(pkg.dir, "src", CHECK_CENSUS_PROBE_FILE_NAME);
      expect(probeExists).toBe(false);
      const distExists = yield* exists(pkg.dir, "dist");
      expect(distExists).toBe(false);
    })
  );

  it.effect("removes the probe and the outDir when a compiler spawn fails mid-pass", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRoot;
      const { tsrsPath, pkg } = yield* writeFixtureRepo(root);
      yield* writeFixtureFile(pkg.dir, "dist/index.d.ts", "export {};\n");
      yield* writeFixtureFile(pkg.dir, "vanish-after-check", "");

      const error = yield* runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({ repoRoot: root, tsrsPath, packages: [pkg], mode: "seeded" })
      ).pipe(Effect.flip);

      expect(error._tag).toBe("QualityScriptCommandError");
      expect(error.message).toContain(
        `Failed to run ${tsrsPath} -p tsconfig.json --emitDeclarationOnly for @fixture/emitting.`
      );
      const probeExists = yield* exists(pkg.dir, "src", CHECK_CENSUS_PROBE_FILE_NAME);
      expect(probeExists).toBe(false);
      const distExists = yield* exists(pkg.dir, "dist");
      expect(distExists).toBe(false);
    })
  );

  it.effect("refuses an outDir that is not strictly inside the package before any program runs", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRoot;
      const { tsrsPath, pkg } = yield* writeFixtureRepo(root);
      yield* writeFixtureFile(root, "packages/shared/keep.txt", "keep\n");
      const run = runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({ repoRoot: root, tsrsPath, packages: [pkg] })
      );

      yield* writeFixtureJson(pkg.dir, "tsconfig.json", { compilerOptions: { outDir: "../shared" }, include: ["src"] });
      const outside = yield* Effect.flip(run);
      yield* writeFixtureJson(pkg.dir, "tsconfig.json", { compilerOptions: { outDir: "." }, include: ["src"] });
      const itself = yield* Effect.flip(run);

      expect(outside.message).toContain("@fixture/emitting: refusing to delete outDir");
      expect(outside.message).toContain("which is not strictly inside");
      expect(itself.message).toContain(`refusing to delete outDir ${pkg.dir},`);
      const keepExists = yield* exists(root, "packages", "shared", "keep.txt");
      expect(keepExists).toBe(true);
      const callsExist = yield* exists(pkg.dir, "calls.log");
      expect(callsExist).toBe(false);
    })
  );

  it.effect("fails when tsrs --version prints nothing", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRoot;
      const { tsrsPath, pkg } = yield* writeFixtureRepo(root);
      yield* writeFixtureFile(root, "silent-version", "");

      const error = yield* runCheckCensusBuildEquivalence(
        BuildEquivalenceOptions.make({ repoRoot: root, tsrsPath, packages: [pkg] })
      ).pipe(Effect.flip);

      expect(error.message).toBe(`${tsrsPath} --version printed nothing.`);
    })
  );

  it.effect("fails up front when no emitting package is selected", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* temporaryWorkingDirectory;
      yield* writeFixtureRepo(root);

      const filtered = yield* Effect.flip(runCheckCensusCommand(["--build-equivalence", "--filter", "missing"]));
      yield* fs.remove("packages/emitting", { recursive: true });
      const empty = yield* Effect.flip(runCheckCensusCommand(["--build-equivalence"]));

      expect(filtered.message).toBe(
        "check-census --build-equivalence selected no emitting package matching --filter missing."
      );
      expect(empty.message).toBe("check-census --build-equivalence selected no emitting package.");
      const reportExists = yield* fs.exists(CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH);
      expect(reportExists).toBe(false);
    })
  );

  it.effect("rejects build-equivalence flags outside --build-equivalence and other modes inside it", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      yield* writeFixtureRepo(root);

      const failures = yield* Effect.forEach(
        [
          ["--seed"],
          ["--initial-state", "restored"],
          ["--equivalence-output-json", "out.json"],
          ["--build-equivalence", "--gate-only"],
          ["--build-equivalence", "--write-baseline"],
        ],
        (args) => Effect.flip(runCheckCensusCommand(args))
      );

      expect(A.map(failures, (error) => error.message)).toStrictEqual(
        A.replicate(
          "--seed, --initial-state and --equivalence-output-json need --build-equivalence, which runs alone (not with --write-baseline or --gate-only).",
          5
        )
      );
    })
  );
});
