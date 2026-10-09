import { runTestTsgoChecksAt, testTsgoPlanningForTesting } from "@beep/repo-cli/test/Quality";
import { checkScriptTestTypecheckCoverage } from "@beep/repo-cli/test/SharedInternals";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(BunCrypto.layer, FileSystemLayer, TestConsole.layer);

const isString = (value: unknown): value is string => typeof value === "string";
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

// A package whose `check` script delegates to a project that includes `test`
// (the shape `beep create-package` scaffolds) next to one whose project only
// includes `src` (a blind-spot baseline entry).
const coveredScripts = {
  check: "bun run beep:check",
  "beep:check": "tsgo -p tsconfig.check.json",
  "package-test-typecheck": "beep-cli quality test-tsgo-package",
} as const;
const blindScripts = {
  check: "tsgo -p tsconfig.check.json",
  "package-test-typecheck": "beep-cli quality test-tsgo-package",
} as const;

const writeFixturePackage = Effect.fn("TestTypecheckCoverageTest.writeFixturePackage")(function* (
  root: string,
  name: string,
  scripts: Readonly<Record<string, string>>,
  include: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageDir = path.join(root, "packages", name);
  yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
  yield* fs.makeDirectory(path.join(packageDir, "test"), { recursive: true });
  yield* fs.writeFileString(
    path.join(packageDir, "package.json"),
    `${encodeJson({ name: `@fixture/${name}`, scripts })}\n`
  );
  yield* fs.writeFileString(
    path.join(packageDir, "tsconfig.check.json"),
    `${encodeJson({ compilerOptions: {}, include })}\n`
  );
  yield* fs.writeFileString(path.join(packageDir, "src", "index.ts"), "export const value = 1;\n");
  yield* fs.writeFileString(path.join(packageDir, "test", "index.test.ts"), "export const expected = 1;\n");
  return { packageDir, testFile: path.join(packageDir, "test", "index.test.ts") };
});

describe("test-typecheck coverage", () => {
  it.layer(PlatformLayer, { timeout: "5 seconds" })((it) => {
    it.effect(
      "judges a package covered only when its check script's projects select every test source",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "test-typecheck-coverage-" });
        const covered = yield* writeFixturePackage(root, "covered", coveredScripts, ["src", "test"]);
        const blind = yield* writeFixturePackage(root, "blind", blindScripts, ["src"]);

        const coveredVerdict = yield* checkScriptTestTypecheckCoverage(covered.packageDir, coveredScripts, [
          covered.testFile,
        ]);
        const blindVerdict = yield* checkScriptTestTypecheckCoverage(blind.packageDir, blindScripts, [blind.testFile]);

        expect(coveredVerdict.covered).toBe(true);
        expect(coveredVerdict.uncoveredSources).toEqual([]);
        expect(A.map(coveredVerdict.projectConfigs, (config) => Str.replace(`${root}/`, "")(config))).toEqual([
          "packages/covered/tsconfig.check.json",
        ]);
        expect(blindVerdict.covered).toBe(false);
        expect(blindVerdict.uncoveredSources).toEqual([blind.testFile]);
      }, Effect.scoped)
    );
  });

  it.layer(PlatformLayer, { timeout: "5 seconds" })((it) => {
    it.effect(
      "excludes covered package groups from the lane and keeps baseline groups",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "test-typecheck-coverage-" });
        const covered = yield* writeFixturePackage(root, "covered", coveredScripts, ["src", "test"]);
        const blind = yield* writeFixturePackage(root, "blind", blindScripts, ["src"]);
        const group = (packageDir: string, scripts: Readonly<Record<string, string>>, testFile: string) => ({
          packageName: `@fixture/${path.basename(packageDir)}`,
          packageDir,
          tsconfigPath: path.join(packageDir, "tsconfig.check.json"),
          files: [testFile],
          scripts,
          hasTaskScript: true,
        });

        const partition = yield* testTsgoPlanningForTesting.partitionByCoverage([
          group(covered.packageDir, coveredScripts, covered.testFile),
          group(blind.packageDir, blindScripts, blind.testFile),
        ]);

        expect(A.map(partition.covered, (entry) => entry.packageName)).toEqual(["@fixture/covered"]);
        expect(A.map(partition.uncovered, (entry) => entry.packageName)).toEqual(["@fixture/blind"]);
      }, Effect.scoped)
    );
  });

  it.layer(PlatformLayer, { timeout: "5 seconds" })((it) => {
    it.effect(
      "reports the skip and exits clean without Turbo when every package is covered",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "test-typecheck-coverage-" });
        yield* writeFixturePackage(root, "covered", coveredScripts, ["src", "test"]);
        yield* writeFixturePackage(root, "also-covered", coveredScripts, ["test", "src"]);

        const spawned: Array<unknown> = [];
        const spawner = ChildProcessSpawner.make((command) =>
          Effect.sync(() => spawned.push(command)).pipe(
            Effect.andThen(Effect.die("Unexpected test-tsgo child process"))
          )
        );
        yield* runTestTsgoChecksAt(root, undefined).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        expect(spawned).toEqual([]);

        const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
        expect(logText).toContain("[quality:test-tsgo] skipped 2 package(s) already covered by their check script");
        expect(logText).toContain("[quality:test-tsgo] every package's check script already typechecks its test files");
        expect(logText).not.toContain("checking");
      }, Effect.scoped)
    );
  });
});
