/**
 * Shared discovery and materialization for package-owned tsgo test programs.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { jsonStringifyPretty } from "@beep/repo-utils";
import { thunkFalse } from "@beep/utils";
import { Walker } from "@beep/walker/Walker";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { checkScriptTestTypecheckCoverage } from "../../../internal/quality/TestTypecheckCoverage.ts";
import { QualityScriptCommandError } from "../Quality.errors.ts";
import { collectFiles } from "./QualityArtifactSupport.ts";
import { testTsgoSyntheticConfigTemplate } from "./TestTsgoSyntheticConfig.ts";

const $I = $RepoCliId.create("commands/Quality/internal/TestTsgoPrograms");
const testTsgoPackageTaskName = "package-test-typecheck";
const pathContainsSegment = (file: string, segments: ReadonlyArray<string>) =>
  A.some(segments, (segment) => Str.includes(segment)(file));
const ignoredTestDirectoryNames = ["node_modules", "dist", "coverage", "tmp"] as const;
// infra/lambda/**: self-contained esbuild-bundled Lambda packages typecheck
// their own tests via tsc in build.sh; they are not workspace test surface.
const ignoredTestPathSegments = ["/test/fixtures/", "/infra/lambda/"] as const;
// No `tooling` root: tooling workspaces live under `packages/tooling/*`, which
// the `packages` root already walks. A top-level `tooling/` directory has never
// existed in this repo, so the entry only cost a wasted existence probe.
const testSearchRoots = ["apps", "packages", "infra"] as const;
class TestTsgoPackageManifest extends S.Opaque<TestTsgoPackageManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    scripts: S.optionalKey(S.Record(S.String, S.String)),
  }).pipe(
    $I.annoteSchema("TestTsgoPackageManifest", {
      description: "Package identity needed to address one package-owned Turbo task.",
    })
  )
) {}

class TestTsgoProgram extends S.Opaque<TestTsgoProgram, { readonly brand: unique symbol }>()(
  S.Struct({
    packageName: S.String,
    packageDir: S.String,
    tsconfigPath: S.String,
    files: S.Array(S.String),
    scripts: S.Record(S.String, S.String),
    hasTaskScript: S.Boolean,
  }).pipe(
    $I.annoteSchema("TestTsgoProgram", {
      description:
        "The package owner, inherited config and exact test-file set shared by typechecking and Effect diagnostics.",
    })
  )
) {}
const decodeTestTsgoPackageManifest = S.decodeUnknownEffect(S.fromJsonString(TestTsgoPackageManifest));
const isTestTsgoFile = (normalizedPath: string, name: string): boolean =>
  Str.includes("/test/")(normalizedPath) &&
  !pathContainsSegment(normalizedPath, ignoredTestPathSegments) &&
  /\.(?:cts|mts|ts|tsx)$/u.test(name);

const isIgnoredTestTsgoDirectory = (normalizedPath: string, name: string): boolean =>
  A.contains(ignoredTestDirectoryNames as ReadonlyArray<string>, name) ||
  pathContainsSegment(normalizedPath, ignoredTestPathSegments);

const collectTestTsgoFilesUnder = (searchRoot: string) =>
  collectFiles(searchRoot, isTestTsgoFile, isIgnoredTestTsgoDirectory);

const tsgoTestPackageLabel = (repoRoot: string, packageDir: string): string =>
  pipe(packageDir, Str.replace(`${repoRoot}/`, ""), Str.replaceAll("/", "-"), Str.replaceAll("@", ""));

const findOwningPackageDir = Effect.fn("QualityScriptCommands.findOwningPackageDir")(function* (
  repoRoot: string,
  filePath: string
): Effect.fn.Return<string, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  // Segment-aware containment: a bare prefix test would let `/repo` claim `/repo-worktrees/...`.
  const isInsideRepo = (dir: string) => dir === repoRoot || Str.startsWith(`${repoRoot}${path.sep}`)(dir);
  const ascend1 = yield* Walker.ascend(path.dirname(filePath), { stopAt: repoRoot });
  const dirs = A.takeWhile(ascend1, isInsideRepo);
  const manifest = yield* Walker.findUpward(dirs, (dir) => [path.join(dir, "package.json")]);

  return O.match(manifest, { onNone: () => repoRoot, onSome: path.dirname });
});

const collectOwnedTestTsgoFiles = Effect.fn("QualityScriptCommands.collectOwnedTestTsgoFiles")(function* (
  repoRoot: string,
  packageDir: string
): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const candidates = yield* collectTestTsgoFilesUnder(packageDir);
  const ownership = yield* Effect.forEach(
    candidates,
    Effect.fnUntraced(function* (filePath) {
      const owner = yield* findOwningPackageDir(repoRoot, filePath);
      return owner === packageDir ? O.some(filePath) : O.none<string>();
    }),
    { concurrency: 1 }
  );

  return A.getSomes(ownership);
});

const resolveTestTsconfigPath = Effect.fn("QualityScriptCommands.resolveTestTsconfigPath")(function* (
  packageDir: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidates = [
    path.join(packageDir, "tsconfig.test.json"),
    path.join(packageDir, "test", "tsconfig.json"),
    path.join(packageDir, "tsconfig.json"),
  ];

  for (const candidate of candidates) {
    const exists = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(thunkFalse));

    if (exists) {
      return candidate;
    }
  }

  return path.join(packageDir, "tsconfig.json");
});

const collectTestTsgoPackageGroups = Effect.fn("QualityScriptCommands.collectTestTsgoPackageGroups")(function* (
  repoRoot: string,
  discoveredFiles: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<TestTsgoProgram>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fileEntries = yield* Effect.forEach(
    discoveredFiles,
    Effect.fnUntraced(function* (filePath) {
      const packageDir = yield* findOwningPackageDir(repoRoot, filePath);
      return [packageDir, filePath] as const;
    }),
    { concurrency: 1 }
  );
  const packageDirs = pipe(
    fileEntries,
    A.map(([packageDir]) => packageDir),
    A.dedupe,
    A.sort(Order.String)
  );

  return yield* Effect.forEach(
    packageDirs,
    Effect.fnUntraced(function* (packageDir) {
      const pipe2 = yield* fs
        .readFileString(path.join(packageDir, "package.json"))
        .pipe(QualityScriptCommandError.mapError(`Failed to read ${path.join(packageDir, "package.json")}.`));
      const packageManifest = yield* decodeTestTsgoPackageManifest(pipe2).pipe(
        QualityScriptCommandError.mapError(`Failed to decode ${path.join(packageDir, "package.json")}.`)
      );
      const tsconfigPath = yield* resolveTestTsconfigPath(packageDir);
      const files = pipe(
        fileEntries,
        A.filter(([entryPackageDir]) => entryPackageDir === packageDir),
        A.map(([, filePath]) => filePath),
        A.sort(Order.String)
      );
      const scripts = packageManifest.scripts ?? R.empty<string, string>();
      return TestTsgoProgram.make({
        packageName: packageManifest.name,
        packageDir,
        tsconfigPath,
        files,
        scripts,
        hasTaskScript: R.has(scripts, testTsgoPackageTaskName),
      });
    }),
    { concurrency: 1 }
  );
});

const discover = Effect.fn("TestTsgoPrograms.discover")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const files = yield* Effect.forEach(testSearchRoots, (root) => collectTestTsgoFilesUnder(path.join(repoRoot, root)), {
    concurrency: 1,
  }).pipe(Effect.map(A.flatten));
  return yield* collectTestTsgoPackageGroups(repoRoot, files);
});
const uncovered = Effect.fn("TestTsgoPrograms.uncovered")(function* (repoRoot: string) {
  const discover3 = yield* discover(repoRoot);
  return yield* Effect.filter(
    discover3,
    (group) =>
      checkScriptTestTypecheckCoverage(group.packageDir, group.scripts, group.files).pipe(
        Effect.map((result) => !result.covered)
      ),
    { concurrency: 1 }
  );
});
const writeConfig = Effect.fn("TestTsgoPrograms.writeConfig")(function* (
  repoRoot: string,
  tempDir: string,
  group: typeof TestTsgoProgram.Encoded
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const label = tsgoTestPackageLabel(repoRoot, group.packageDir);
  const target = path.join(tempDir, `${label}.tsconfig.json`);
  const text = yield* jsonStringifyPretty({
    ...testTsgoSyntheticConfigTemplate,
    extends: group.tsconfigPath,
    include: group.files,
    compilerOptions: {
      ...testTsgoSyntheticConfigTemplate.compilerOptions,
      rootDir: repoRoot,
      tsBuildInfoFile: path.join(tempDir, `${label}.tsbuildinfo`),
    },
  }).pipe(QualityScriptCommandError.mapError(`Failed to encode ${label} test tsconfig.`));
  yield* fs.writeFileString(target, `${text}\n`).pipe(QualityScriptCommandError.mapError(`Failed to write ${target}.`));
  return target;
});
/**
 * Discover the same package-owned programs and render the same test overlays for both gates.
 *
 * **Details**
 * Covered groups need no second diagnostics program because canonical checks already include
 * every discovered test file. The package task and standalone lane share discovery and rendering.
 *
 * **Example** (Discover the fallback test programs)
 * ```ts
 * import { testTsgoPrograms } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(testTsgoPrograms.uncovered("."))) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const testTsgoPrograms = {
  taskName: testTsgoPackageTaskName,
  discover,
  uncovered,
  writeConfig,
  collectGroups: collectTestTsgoPackageGroups,
  collectOwnedFiles: collectOwnedTestTsgoFiles,
  isTestFile: isTestTsgoFile,
  isIgnoredDirectory: isIgnoredTestTsgoDirectory,
  packageLabel: tsgoTestPackageLabel,
};
