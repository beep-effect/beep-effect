import * as NodeURL from "node:url";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { docgenCommand } from "@beep/repo-cli/commands/Docgen";
import {
  aggregateDocgenPackagesForTesting,
  aggregateGeneratedDocs,
  analyzeDocgenQuality,
  analyzePackageDocumentation,
  analyzePackageQuality,
  buildDocgenLocalPlan,
  createDocgenConfigDocument,
  DocgenAnalysisSummary,
  DocgenConfigDocument,
  DocgenExportAnalysis,
  DocgenLocalSelectedPackage,
  DocgenPackageAnalysis,
  DoctestReport,
  discoverDocgenWorkspacePackages,
  discoverOrphanDocgenConfigPaths,
  docgenLocalFullReasonsForTesting,
  docgenLocalTurboArgsForTesting,
  filterDocgenMetadataCheckPackagesForTesting,
  generateAnalysisReport,
  generateQualityJson,
  generateQualityReport,
  getDeclaredJsDocs,
  isCanonicalDocgenAggregateConfigForTesting,
  loadDocgenConfigDocument,
  runDocgenLocal,
  selectDirectDocgenPackagesForTesting,
  selectDocgenLocalPackagesForTesting,
} from "@beep/repo-cli/test/Docgen";
import {
  isCiSync,
  readTurboCacheEnvironment,
  resolveTurboCachePlan,
  turboCachePlanArgs,
} from "@beep/repo-cli/test/SharedInternals";
import {
  Configuration,
  ConfigurationShape,
  DEFAULT_THEME,
  defaultCompilerOptions,
} from "@beep/repo-docgen/Configuration";
import { Process } from "@beep/repo-docgen/Domain";
import { verifyDocgenProofManifest, writeDocgenProofManifest } from "@beep/repo-docgen/ProofManifest";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { fcRuns } from "@beep/test-utils";
import { A, currentHostPlatform, HostProcessPlatform, O, Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Project, SyntaxKind } from "ts-morph";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { DocgenQualityPackageReport, DocgenQualityReview, DocgenQualitySubject } from "@beep/repo-cli/test/Docgen";

const UnknownJson = S.fromJsonString(S.Unknown);

// `Git` rides beside the platform services: the local plan's changed-file reads take it from the context (W2).
const CommandPlatformLayer = Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer));
const CommandTestLayer = Layer.mergeAll(
  CommandPlatformLayer,
  FsUtilsLive.pipe(Layer.provideMerge(CommandPlatformLayer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(CommandPlatformLayer)),
  FetchHttpClient.layer
);
const runDocgenCommand = Command.runWith(docgenCommand, { version: "0.0.0" });
const encodeJson = S.encodeUnknownEffect(UnknownJson);
const decodeUnknownJson = S.decodeUnknownEffect(UnknownJson);
const encodeDocgenConfigDocument = S.encodeEffect(DocgenConfigDocument);
const decodeDocgenConfigDocument = S.decodeUnknownEffect(DocgenConfigDocument);
const isString = (value: unknown): value is string => typeof value === "string";
const DOCGEN_COMMAND_TEST_TIMEOUT = 30_000;
const DOCTEST_FIXTURE_DIR = NodeURL.fileURLToPath(new URL("./fixtures/doctest/", import.meta.url));
const DOCTEST_FIXTURE_PACKAGE = "packages/doctest-fixture";
const decodeDoctestReport = S.decodeUnknownEffect(S.fromJsonString(DoctestReport));

const expectedTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironment(Bun.env), { args, ci: isCiSync() }));

const recordingSpawner = () => ScriptedSpawner.make(() => ({}));

// The base-range git query cannot spawn; every other command succeeds silently.
const rangeRejectingSpawner = () =>
  ScriptedSpawner.make((command, args) =>
    command === "git" && A.some(args, Str.includes("origin/main...HEAD"))
      ? ScriptedSpawner.permissionDenied(command)
      : {}
  );

const spawnedLines = (spawner: ScriptedSpawner) =>
  A.map(spawner.spawns, (spawn) => A.join([spawn.command, ...spawn.args], " "));

const expectReportedExit = (exit: Exit.Exit<unknown, unknown>, exitCode = 1) => {
  assertTrue(exit._tag === "Failure");
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(Runtime.getErrorExitCode(error)).toBe(exitCode);
    expect(Runtime.getErrorReported(error)).toBe(false);
  }
};

const runCommand = Effect.fn("DocgenTest.runCommand")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make(command, [...args], { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" })
  );
  expect(exitCode).toBe(0);
});

const temporaryRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmpDir = yield* fs.makeTempDirectoryScoped();
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      const previousCwd = process.cwd();
      process.chdir(tmpDir);
      return previousCwd;
    }),
    (previousCwd) => Effect.sync(() => process.chdir(previousCwd))
  );
  yield* fs.makeDirectory(path.join(tmpDir, ".git"), { recursive: true });
  return tmpDir;
});
const documentedCheckSource = `/**
 * Package docs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Documented fixture.
 *
 * @category constants
 * @since 0.0.0
 */
export const DocumentedFixture = 1;
`;
const undocumentedCheckSource = `export const MissingMetadata = "nope";\n`;
const seedCheckWorkspace = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const argument = path.join(process.cwd(), "package.json");
  const encodedJson1 = yield* encodeJson({
    name: "@beep/test-root",
    private: true,
    workspaces: ["packages/foundation/*/*"],
  });
  yield* fs.writeFileString(argument, encodedJson1);
});
const seedCheckPackage = Effect.fn("DocgenTest.seedCheckPackage")(function* (
  directory: string,
  name: string,
  source: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageDir = path.join(process.cwd(), "packages", "foundation", "modeling", directory);
  yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
  const argument1 = path.join(packageDir, "package.json");
  const encodedJson2 = yield* encodeJson({ name, version: "0.0.0" });
  yield* fs.writeFileString(argument1, encodedJson2);
  const argument2 = path.join(packageDir, "docgen.json");
  const encodedJson3 = yield* encodeJson({ srcDir: "src" });
  yield* fs.writeFileString(argument2, encodedJson3);
  yield* fs.writeFileString(path.join(packageDir, "src", "index.ts"), source);
});
const seedUnconfiguredCheckPackage = Effect.fn("DocgenTest.seedUnconfiguredCheckPackage")(function* (
  directory: string,
  name: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageDir = path.join(process.cwd(), "packages", "foundation", "modeling", directory);
  yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
  const argument3 = path.join(packageDir, "package.json");
  const encodedJson4 = yield* encodeJson({ name, version: "0.0.0" });
  yield* fs.writeFileString(argument3, encodedJson4);
});
const withConfigEnv = <A, E, R>(
  env: { readonly [key: string]: string },
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))(use);

const seedDocgenPackage = Effect.fn("DocgenTest.seedDocgenPackage")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmpDir = process.cwd();
  const argument4 = path.join(tmpDir, "package.json");
  const encodedJson5 = yield* encodeJson({
    name: "@beep/test-root",
    private: true,
    workspaces: ["packages/foundation/*/*"],
  });
  yield* fs.writeFileString(argument4, encodedJson5);

  const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
  yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
  const argument5 = path.join(packageDir, "package.json");
  const encodedJson6 = yield* encodeJson({ name: "@beep/schema", version: "0.0.0" });
  yield* fs.writeFileString(argument5, encodedJson6);
  const argument6 = path.join(packageDir, "docgen.json");
  const encodedJson7 = yield* encodeJson({ srcDir: "src" });
  yield* fs.writeFileString(argument6, encodedJson7);
});

const schemaPackageSourcePath = (path: Path.Path): string =>
  path.join(process.cwd(), "packages", "foundation", "modeling", "schema", "src", "index.ts");

const invalidCategorySource = `/**
 * Probe module carrying an unknown category tag.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Renders probe lines.
 *
 * **Example** (Render probe lines)
 *
 * \`\`\`ts
 * import { renderProbeLines } from "@beep/schema"
 *
 * console.log(renderProbeLines())
 * \`\`\`
 *
 * @category rendering
 * @since 0.0.0
 */
export const renderProbeLines = (): ReadonlyArray<string> => [];
`;

const writeSchemaTsconfig = Effect.fn("DocgenTest.writeSchemaTsconfig")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const argument7 = path.join(process.cwd(), "tsconfig.json");
  const encodedJson8 = yield* encodeJson({
    compilerOptions: {
      module: "es2022",
      target: "es2022",
      moduleResolution: "bundler",
      strict: true,
      noEmit: true,
    },
    include: ["packages/**/*.ts"],
  });
  yield* fs.writeFileString(argument7, encodedJson8);
});

const analyzeSchemaPackageQuality = Effect.fn("DocgenTest.analyzeSchemaPackageQuality")(function* (source: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* seedDocgenPackage();
  yield* fs.writeFileString(schemaPackageSourcePath(path), source);
  const packages = yield* discoverDocgenWorkspacePackages(process.cwd());
  return yield* pipe(
    A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"),
    O.match({
      onNone: () => Effect.die(new Error("Expected the seeded @beep/schema package to be discoverable")),
      onSome: analyzePackageQuality,
    })
  );
});

const qualitySubject = (
  report: DocgenQualityPackageReport,
  exportName: string,
  declarationKind?: string
): O.Option<DocgenQualitySubject> =>
  A.findFirst(
    report.subjects,
    (entry) =>
      entry.exportName === exportName && (declarationKind === undefined || entry.declarationKind === declarationKind)
  );

const qualityReview = (
  report: DocgenQualityPackageReport,
  subject: O.Option<DocgenQualitySubject>
): O.Option<DocgenQualityReview> =>
  pipe(
    subject,
    O.flatMap((entry) => A.findFirst(report.reviews, (review) => review.subjectId === entry.stableIdentity))
  );

const qualityFindingCodes = (review: O.Option<DocgenQualityReview>): ReadonlyArray<string> =>
  pipe(
    review,
    O.map((entry) => A.map(entry.findings, (finding) => finding.code)),
    O.getOrElse(A.empty)
  );

const deterministicMissingTags = (subject: O.Option<DocgenQualitySubject>): ReadonlyArray<string> =>
  pipe(
    subject,
    O.map((entry) => entry.deterministicMissingTags),
    O.getOrElse(A.empty)
  );

const richQualitySubjectSource = `/**
 * Package docs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Parses a value into the normalized schema fixture.
 *
 * @example
 * \`\`\`ts
 * import { parseValue } from "@beep/schema"
 * const result = parseValue(" hello ")
 * void result
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`;

const companionAliasQualitySource = `import * as Schema from "effect/Schema";

/**
 * Validated account status schema.
 *
 * @example
 * \`\`\`ts
 * import { AccountStatus } from "@beep/schema"
 *
 * console.log(AccountStatus)
 * \`\`\`
 * @category schemas
 * @since 0.0.0
 */
export const AccountStatus = {
  Type: "active" as const,
};

/**
 * {@inheritDoc AccountStatus}
 *
 * @category schemas
 * @since 0.0.0
 */
export type AccountStatus = typeof AccountStatus.Type;

/**
 * Account access mode schema.
 *
 * @example
 * \`\`\`ts
 * import { AccountMode } from "@beep/schema"
 *
 * console.log(AccountMode)
 * \`\`\`
 * @category schemas
 * @since 0.0.0
 */
export const AccountMode = {
  Type: "read" as const,
};

/**
 * Account feature flag schema.
 *
 * @example
 * \`\`\`ts
 * import { AccountFlag } from "@beep/schema"
 *
 * console.log(AccountFlag)
 * \`\`\`
 * @category schemas
 * @since 0.0.0
 */
export const AccountFlag = {
  Type: true as const,
};

/**
 * Type for {@link AccountMode}.
 *
 * @category schemas
 * @since 0.0.0
 */
export type AccountMode = typeof AccountMode.Type;

/**
 * @category schemas
 * @since 0.0.0
 */
export type AccountFlag = typeof AccountFlag.Type;

/**
 * Account flag collection schema.
 *
 * @example
 * \`\`\`ts
 * import { AccountFlags } from "@beep/schema"
 *
 * console.log(AccountFlags)
 * \`\`\`
 * @category schemas
 * @since 0.0.0
 */
export const AccountFlags = {
  Type: ["read"] as const,
};

/**
 * @category schemas
 * @since 0.0.0
 */
export type AccountFlags = typeof AccountFlags.Type;

/**
 * Account graph schema.
 *
 * @example
 * \`\`\`ts
 * import { AccountGraph } from "@beep/schema"
 *
 * console.log(AccountGraph)
 * \`\`\`
 * @category schemas
 * @since 0.0.0
 */
export const AccountGraph = {
  Type: "graph" as const,
};

/**
 * Schema companion interface for {@link AccountGraph}.
 *
 * @category schemas
 * @since 0.0.0
 */
export interface AccountGraph<Node extends Schema.Schema.Any> extends Schema.Schema<Node> {}

/**
 * A namespace for {@link AccountMode} companion types.
 *
 * @category schemas
 * @since 0.0.0
 */
export declare namespace AccountMode {
  /**
   * Encoded account mode.
   *
   * @category schemas
   * @since 0.0.0
   */
  export type Encoded = typeof AccountMode.Type;
}

/**
 * @category schemas
 * @since 0.0.0
 */
export type AccountAccess = typeof AccountMode.Type;
`;

const writeDoctestCommandFixtureRepo = Effect.fn("DocgenTest.writeDoctestCommandFixtureRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = process.cwd();
  const packageDir = path.join(repoRoot, DOCTEST_FIXTURE_PACKAGE);
  const srcDir = path.join(packageDir, "src");

  const argument8 = path.join(repoRoot, "package.json");
  const encodedJson9 = yield* encodeJson({
    name: "@beep/doctest-test-root",
    private: true,
    workspaces: ["packages/*"],
  });
  yield* fs.writeFileString(argument8, encodedJson9);
  yield* fs.makeDirectory(srcDir, { recursive: true });
  const argument9 = path.join(packageDir, "package.json");
  const encodedJson10 = yield* encodeJson({ name: "@beep/doctest-fixture", version: "0.0.0" });
  yield* fs.writeFileString(argument9, encodedJson10);
  yield* Effect.forEach(
    ["assertions", "console-rewrites", "markers", "purity"],
    Effect.fnUntraced(function* (fixtureName) {
      const fixture = yield* fs.readFileString(path.join(DOCTEST_FIXTURE_DIR, `${fixtureName}.ts.txt`));
      const fixtureLines = Str.split(fixture, "\n");
      const selectedLines =
        fixtureName === "console-rewrites"
          ? A.map(A.take(fixtureLines, 1), Str.replace('console.log("ok") // "ok"', "console.log(1 + 1) // 2"))
          : fixtureLines;
      const commentBody = A.join(
        A.map(selectedLines, (line) => ` * ${line}`),
        "\n"
      );
      const source = pipe(
        Match.value(fixtureName),
        Match.when(
          "console-rewrites",
          () => `/**
 * **Example** (Console rewrites)
 *
 * \`\`\`ts
${commentBody}
 * \`\`\`
 */
export const consoleRewriteFixture = true;
`
        ),
        Match.when(
          "assertions",
          () => `/**
 * **Example** (Assertion validation)
 *
 * \`\`\`ts
${commentBody}
 * \`\`\`
 */
export const assertionFixture = true;
`
        ),
        Match.when(
          "markers",
          () => `/**
 * **Example** (Marker fixtures)
 *
${commentBody}
 */
export const markerFixture = true;
`
        ),
        Match.orElse(() => fixture)
      );
      yield* fs.writeFileString(path.join(srcDir, `${fixtureName}.ts`), source);
    }),
    { discard: true }
  );

  return { packageDir, repoRoot, srcDir };
});

it.layer(CommandTestLayer, { concurrent: false, timeout: "5 seconds" })("Docgen operations", (it) => {
  it.effect("defaults docgen config source fields in the schema without changing explicit wire shape", () =>
    Effect.gen(function* () {
      const explicitConfig = DocgenConfigDocument.make({
        srcDir: "custom-src",
        exclude: ["dist", "coverage"],
      });
      const encodedDocgenConfigDocument = yield* encodeDocgenConfigDocument(explicitConfig);
      expect(encodedDocgenConfigDocument).toEqual({
        srcDir: "custom-src",
        exclude: ["dist", "coverage"],
      });

      const decoded = yield* decodeDocgenConfigDocument({});
      expect(decoded.srcDir).toBe("src");
      expect(decoded.exclude).toEqual([]);
    })
  );

  {
    const arbitrary = Arbitrary.schema(DocgenConfigDocument);
    const sameConfig = S.toEquivalence(DocgenConfigDocument);
    it.effect.prop(
      "round-trips schema-derived docgen configuration",
      [arbitrary],
      Effect.fnUntraced(function* ([config]) {
        const encodedDocgenConfigDocument49 = yield* encodeDocgenConfigDocument(config);
        const decodedDocgenConfigDocument = yield* decodeDocgenConfigDocument(encodedDocgenConfigDocument49);
        expect(sameConfig(config, decodedDocgenConfigDocument)).toBe(true);
      }),
      { arbitrary: fcRuns(16) }
    );
  }

  it("aggregates only canonical Docgen output configurations during scoped runs", () => {
    expect(isCanonicalDocgenAggregateConfigForTesting(DocgenConfigDocument.make({ srcDir: "src" }))).toBe(true);
    expect(
      isCanonicalDocgenAggregateConfigForTesting(DocgenConfigDocument.make({ srcDir: "src", outDir: "docs" }))
    ).toBe(true);
    expect(
      isCanonicalDocgenAggregateConfigForTesting(
        DocgenConfigDocument.make({ srcDir: ".", outDir: ".jsdoc-loop/generated-docs" })
      )
    ).toBe(false);
  });

  it.effect("skips non-canonical outputs while aggregating canonical scoped packages", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument10 = path.join(tmpDir, "package.json");
      const encodedJson11 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument10, encodedJson11);

      const canonicalDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      const focusedDir = path.join(tmpDir, "packages", "foundation", "modeling", "types");
      yield* fs.makeDirectory(path.join(canonicalDir, "docs", "modules"), { recursive: true });
      yield* fs.makeDirectory(focusedDir, { recursive: true });
      const argument11 = path.join(canonicalDir, "package.json");
      const encodedJson13 = yield* encodeJson({ name: "@beep/schema", version: "0.0.0" });
      yield* fs.writeFileString(argument11, encodedJson13);
      const argument12 = path.join(canonicalDir, "docgen.json");
      const encodedJson14 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument12, encodedJson14);
      yield* fs.writeFileString(
        path.join(canonicalDir, "docs", "modules", "Schema.md"),
        `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
      );
      const argument13 = path.join(focusedDir, "package.json");
      const encodedJson15 = yield* encodeJson({ name: "@beep/types", version: "0.0.0" });
      yield* fs.writeFileString(argument13, encodedJson15);
      const argument14 = path.join(focusedDir, "docgen.json");
      const encodedJson16 = yield* encodeJson({ srcDir: ".", outDir: ".jsdoc-loop/generated-docs" });
      yield* fs.writeFileString(argument14, encodedJson16);

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const aggregateCount = yield* aggregateDocgenPackagesForTesting(packages);
      const aggregateExists = yield* fs.exists(
        path.join(tmpDir, "docs", "generated", "foundation", "modeling", "schema", "Schema.md")
      );
      const focusedAggregateExists = yield* fs.exists(
        path.join(tmpDir, "docs", "generated", "foundation", "modeling", "types")
      );

      expect(aggregateCount).toBe(1);
      expect(aggregateExists).toBe(true);
      expect(focusedAggregateExists).toBe(false);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("selects package-local inputs for the bounded local docgen lane", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument15 = path.join(tmpDir, "package.json");
      const encodedJson17 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument15, encodedJson17);

      const schemaDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      const utilsDir = path.join(tmpDir, "packages", "foundation", "modeling", "utils");
      yield* fs.makeDirectory(path.join(schemaDir, "src"), { recursive: true });
      yield* fs.makeDirectory(path.join(utilsDir, "src"), { recursive: true });
      const argument16 = path.join(schemaDir, "package.json");
      const encodedJson18 = yield* encodeJson({ name: "@beep/schema", version: "0.0.0" });
      yield* fs.writeFileString(argument16, encodedJson18);
      const argument17 = path.join(schemaDir, "docgen.json");
      const encodedJson19 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument17, encodedJson19);
      const argument18 = path.join(utilsDir, "package.json");
      const encodedJson20 = yield* encodeJson({ name: "@beep/utils", version: "0.0.0" });
      yield* fs.writeFileString(argument18, encodedJson20);
      const argument19 = path.join(utilsDir, "docgen.json");
      const encodedJson21 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument19, encodedJson21);

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const selected = selectDocgenLocalPackagesForTesting(packages, [
        "packages/foundation/modeling/schema/src/index.ts",
        "packages/foundation/modeling/schema/src/fields/RatingField.tsx",
        "packages/foundation/modeling/schema/test/schema.test.ts",
        "packages/foundation/modeling/utils/README.md",
        "turbo.json",
      ]);

      expect(A.map(selected, (pkg) => pkg.name)).toEqual(["@beep/schema", "@beep/utils"]);
      expect(selected[0]?.reasons).toEqual([
        "packages/foundation/modeling/schema/src/fields/RatingField.tsx",
        "packages/foundation/modeling/schema/src/index.ts",
      ]);
      expect(selected[1]?.reasons).toEqual(["packages/foundation/modeling/utils/README.md"]);
      expect(A.map(selectDirectDocgenPackagesForTesting(packages, [selected[0]!]), (pkg) => pkg.name)).toEqual([
        "@beep/schema",
      ]);
      expect(A.map(selectDirectDocgenPackagesForTesting([selected[0]!])(packages), (pkg) => pkg.name)).toEqual([
        "@beep/schema",
      ]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it("identifies global docgen inputs that require the full proof", () => {
    const reasons = docgenLocalFullReasonsForTesting([
      "packages/tooling/tool/docgen/src/bin.ts",
      "packages/foundation/modeling/schema/src/index.ts",
      "turbo.json",
    ]);

    expect(A.map(reasons, (reason) => reason.filePath)).toEqual([
      "packages/tooling/tool/docgen/src/bin.ts",
      "turbo.json",
    ]);
  });

  const schemaSelection = [
    DocgenLocalSelectedPackage.make({
      name: "@beep/schema",
      path: "packages/foundation/modeling/schema",
      reasons: ["packages/foundation/modeling/schema/src/index.ts"],
    }),
  ];

  it.effect("builds changed-plus-dependent Turbo filters for local docgen without run summaries outside CI", () =>
    withConfigEnv(
      {},
      Effect.gen(function* () {
        const args = yield* docgenLocalTurboArgsForTesting(schemaSelection, 0);
        const expected = ["--filter=...@beep/schema", "--concurrency=1", "--ui=stream", "--no-daemon"];
        const cacheArgs = turboCachePlanArgs(
          resolveTurboCachePlan(readTurboCacheEnvironment(Bun.env), { args: expected, ci: false })
        );

        expect(args).toEqual(["turbo", "run", "docgen", ...cacheArgs, ...expected]);
        expect(args).not.toContain("--summarize");
      })
    )
  );

  it.effect("keeps Turbo run summaries for local docgen under CI", () =>
    withConfigEnv(
      { CI: "true" },
      Effect.gen(function* () {
        const args = yield* docgenLocalTurboArgsForTesting(schemaSelection, 0);

        expect(args).toContain("--summarize");
        expect(A.filter(args, (arg) => arg === "--summarize")).toHaveLength(1);
      })
    )
  );

  const turboCacheEnvName = "TURBO_CACHE";

  it.effect("pins direct docgen Turbo invocations to a requested local-only cache", () =>
    withConfigEnv(
      {},
      Effect.acquireUseRelease(
        Effect.sync(() => {
          const previous = Bun.env[turboCacheEnvName];
          Bun.env[turboCacheEnvName] = "local:rw";
          return previous;
        }),
        () =>
          Effect.gen(function* () {
            const args = yield* docgenLocalTurboArgsForTesting(schemaSelection, 1);

            expect(args).toContain("--cache=local:rw");
            expect(args).not.toContain("--cache=local:rw,remote:r");
          }),
        (previous) =>
          Effect.sync(() => {
            if (previous === undefined) {
              delete Bun.env[turboCacheEnvName];
            } else {
              Bun.env[turboCacheEnvName] = previous;
            }
          })
      )
    )
  );

  it.effect("writes and verifies package-level docgen proof manifests", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      const srcPath = path.join(packageDir, "src", "index.ts");
      const docsPath = path.join(packageDir, "docs", "modules", "Schema.md");

      yield* fs.makeDirectory(path.dirname(srcPath), { recursive: true });
      yield* fs.makeDirectory(path.dirname(docsPath), { recursive: true });
      const argument20 = path.join(packageDir, "package.json");
      const encodedJson22 = yield* encodeJson({
        name: "@beep/schema",
        homepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema",
      });
      yield* fs.writeFileString(argument20, encodedJson22);
      const argument21 = path.join(packageDir, "docgen.json");
      const encodedJson23 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument21, encodedJson23);
      yield* fs.writeFileString(
        srcPath,
        `/**
 * Package docs.
 *
 * @packageDocumentation
 * @category schemas
 * @since 0.0.0
 */

/**
 * Current proof fixture.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProofFixture = 1;
`
      );
      yield* fs.writeFileString(docsPath, "---\ntitle: Schema\n---\n\n# Schema\n");
      const argument22 = Effect.succeed([]);
      const argument23 = Effect.succeed(packageDir);
      const HostProcessPlatform24 = yield* HostProcessPlatform;
      const packageProcess = Process.of({
        argv: argument22,
        cwd: argument23,
        platform: Effect.succeed(HostProcessPlatform24),
      });
      const packageConfiguration = Configuration.of(
        ConfigurationShape.make({
          enableSearch: true,
          enforceDescriptions: false,
          enforceExamples: false,
          enforceVersion: true,
          examplesCompilerOptions: defaultCompilerOptions,
          include: [],
          exclude: [],
          outDir: "docs",
          parseCompilerOptions: defaultCompilerOptions,
          projectHomepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema",
          projectName: "@beep/schema",
          srcDir: "src",
          srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema/src/",
          theme: DEFAULT_THEME,
          tscExecutable: "tsc",
        })
      );
      const manifest = yield* writeDocgenProofManifest().pipe(
        Effect.provideService(Configuration, packageConfiguration),
        Effect.provideService(Process, packageProcess)
      );
      const current = yield* verifyDocgenProofManifest(packageDir, "@beep/schema");

      yield* fs.writeFileString(srcPath, `${yield* fs.readFileString(srcPath)}\nexport const Changed = 2;\n`);
      const stale = yield* verifyDocgenProofManifest(packageDir, "@beep/schema");

      expect(manifest.packageName).toBe("@beep/schema");
      expect(manifest.fingerprint.inputFileCount).toBeGreaterThan(0);
      expect(manifest.fingerprint.outputFileCount).toBeGreaterThan(0);
      expect(current.status).toBe("current");
      expect(stale.status).toBe("stale");
      expect(stale.reason).toBe("package docgen inputs changed");
    }).pipe(
      Effect.provideService(HostProcessPlatform, currentHostPlatform),
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    )
  );

  it.effect("builds a package-selected local docgen plan without git discovery", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument24 = path.join(tmpDir, "package.json");
      const encodedJson25 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument24, encodedJson25);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument25 = path.join(packageDir, "package.json");
      const encodedJson26 = yield* encodeJson({ name: "@beep/schema", version: "0.0.0" });
      yield* fs.writeFileString(argument25, encodedJson26);
      const argument26 = path.join(packageDir, "docgen.json");
      const encodedJson27 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument26, encodedJson27);

      const plan = yield* buildDocgenLocalPlan({
        allowFull: false,
        base: "origin/main",
        full: false,
        head: "HEAD",
        json: false,
        packageSelector: O.some("@beep/schema"),
        parallel: 1,
        plan: true,
      });

      expect(plan.mode).toBe("scoped");
      expect(A.map(plan.selectedPackages, (pkg) => pkg.name)).toEqual(["@beep/schema"]);
      expect(plan.turboArgs).toContain("--filter=...@beep/schema");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("builds a full plan without querying the configured git range", () => {
    const spawner = rangeRejectingSpawner();
    return Effect.gen(function* () {
      yield* temporaryRepository;
      const plan = yield* buildDocgenLocalPlan({
        allowFull: false,
        base: "origin/main",
        full: true,
        head: "HEAD",
        json: false,
        packageSelector: O.none(),
        parallel: 1,
        plan: true,
      }).pipe(provideSpawner(spawner));

      expect(plan.mode).toBe("full");
      expect(spawnedLines(spawner)).toEqual([]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
  });

  it.effect("queries the configured git range when building an affected plan", () => {
    const spawner = rangeRejectingSpawner();
    return Effect.gen(function* () {
      yield* temporaryRepository;
      const exit = yield* Effect.exit(
        buildDocgenLocalPlan({
          allowFull: false,
          base: "origin/main",
          full: false,
          head: "HEAD",
          json: false,
          packageSelector: O.none(),
          parallel: 1,
          plan: true,
        }).pipe(
          // `Git` is built over the stub spawner, so the kit's range read reaches the rejecting stub (W2).
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(spawner)
        )
      );

      assertTrue(exit._tag === "Failure");
      expect(
        A.some(
          spawnedLines(spawner),
          Str.includes("git diff --name-only -z --no-relative --no-renames origin/main...HEAD")
        )
      ).toBe(true);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
  });

  it.effect(
    "prints a local docgen package plan from the command surface",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument27 = path.join(tmpDir, "package.json");
        const encodedJson28 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument27, encodedJson28);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument28 = path.join(packageDir, "package.json");
        const encodedJson29 = yield* encodeJson({ name: "@beep/schema", version: "0.0.0" });
        yield* fs.writeFileString(argument28, encodedJson29);
        const argument29 = path.join(packageDir, "docgen.json");
        const encodedJson30 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument29, encodedJson30);

        yield* runDocgenCommand(["local", "--plan", "-p", "@beep/schema"]);

        const logLines1 = yield* TestConsole.logLines;
        const output = A.join(A.filter(logLines1, isString), "\n");
        expect(output).toContain("docgen:local plan");
        expect(output).toContain("- mode: scoped");
        expect(output).toContain("--filter=...@beep/schema");
        expect(process.exitCode ?? 0).toBe(0);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect("plans full docgen with configured concurrency and both execution steps", () =>
    withConfigEnv(
      { BEEP_DOCGEN_CONCURRENCY: "6" },
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedDocgenPackage();
        yield* runDocgenCommand(["local", "--full", "--plan", "--package", "@beep/schema"]);

        const logLines2 = yield* TestConsole.logLines;
        const output = A.join(A.filter(logLines2, isString), "\n");
        expect(output).toContain("- mode: full");
        expect(output).toContain("- package concurrency: 6");
        expect(output).toContain(
          A.join(
            [
              "- full turbo command: node_modules/.bin/turbo run docgen",
              ...expectedTurboCacheArgs(["--concurrency=6"]),
              "--concurrency=6",
            ],
            " "
          )
        );
        expect(output).toContain("- full aggregate command: bun run docs:aggregate");
        expect(output).toContain("- full JSDoc metadata check: every package with a canonical docgen.json outDir");
      })
    ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("prefers the local --parallel flag over configured concurrency", () =>
    withConfigEnv(
      { BEEP_DOCGEN_CONCURRENCY: "6" },
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedDocgenPackage();
        yield* runDocgenCommand(["local", "--full", "--plan", "--package", "@beep/schema", "--parallel", "8"]);

        const logLines3 = yield* TestConsole.logLines;
        const output = A.join(A.filter(logLines3, isString), "\n");
        expect(output).toContain("- package concurrency: 8");
        expect(output).toContain("--concurrency=8");
        expect(output).not.toContain("--concurrency=6");
      })
    ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("defaults local docgen concurrency to three", () =>
    withConfigEnv(
      {},
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedDocgenPackage();
        yield* runDocgenCommand(["local", "--full", "--plan", "--package", "@beep/schema"]);

        const logLines4 = yield* TestConsole.logLines;
        const output = A.join(A.filter(logLines4, isString), "\n");
        expect(output).toContain("- package concurrency: 3");
        expect(output).toContain("--concurrency=3");
      })
    ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("discovers scoped docgen through native Turbo and stops when its task graph is empty", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      yield* seedDocgenPackage();
      const repoRoot = process.cwd();
      const output = yield* encodeJson({ tasks: [] });
      const spawner = ScriptedSpawner.make(() => ({ stdout: output }));
      const plan = yield* runDocgenLocal({
        allowFull: false,
        base: "origin/main",
        full: false,
        head: "HEAD",
        json: false,
        packageSelector: O.some("@beep/schema"),
        parallel: 6,
        plan: false,
      }).pipe(provideSpawner(spawner));

      expect(plan.mode).toBe("scoped");
      expect(spawnedLines(spawner)).toEqual([
        A.join([`${repoRoot}/node_modules/.bin/turbo`, ...A.drop(plan.turboArgs, 1), "--dry-run=json"], " "),
      ]);
      const logLines5 = yield* TestConsole.logLines;
      expect(A.join(A.filter(logLines5, isString), "\n")).toContain("docgen:local: no Turbo docgen tasks selected");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("executes full docgen through direct Turbo and aggregate steps", () => {
    const spawner = recordingSpawner();
    return Effect.gen(function* () {
      yield* temporaryRepository;
      yield* seedDocgenPackage();
      const repoRoot = process.cwd();
      const plan = yield* runDocgenLocal({
        allowFull: false,
        base: "origin/main",
        full: true,
        head: "HEAD",
        json: false,
        packageSelector: O.some("@beep/schema"),
        parallel: 6,
        plan: false,
      }).pipe(provideSpawner(spawner));

      expect(plan.mode).toBe("full");
      expect(spawnedLines(spawner)).toEqual([
        A.join(
          [
            `${repoRoot}/node_modules/.bin/turbo run docgen`,
            ...expectedTurboCacheArgs(["--concurrency=6"]),
            "--concurrency=6",
          ],
          " "
        ),
        "bun run docs:aggregate",
      ]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
  });

  it.effect("fails full docgen on invalid JSDoc metadata before spawning Turbo", () => {
    const spawner = recordingSpawner();
    return Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* seedDocgenPackage();
      yield* fs.writeFileString(schemaPackageSourcePath(path), invalidCategorySource);

      const exit = yield* Effect.exit(
        runDocgenLocal({
          allowFull: false,
          base: "origin/main",
          full: true,
          head: "HEAD",
          json: false,
          packageSelector: O.some("@beep/schema"),
          parallel: 6,
          plan: false,
        }).pipe(provideSpawner(spawner))
      );

      assertTrue(exit._tag === "Failure");
      if (Exit.isFailure(exit)) {
        expect(Cause.squash(exit.cause)).toMatchObject({
          _tag: "DomainError",
          message: "docgen:local JSDoc check failed for 1 package(s).",
        });
      }
      expect(spawnedLines(spawner)).toEqual([]);
      const errorLines6 = yield* TestConsole.errorLines;
      const errors = A.join(A.filter(errorLines6, isString), "\n");
      expect(errors).toContain(
        "docgen:local: packages/foundation/modeling/schema has 1 export(s) missing docgen metadata"
      );
      expect(errors).toContain("renderProbeLines invalid category: Unknown @category value rendering.");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
  });

  it.effect("skips the full JSDoc metadata check for packages with a non-canonical docgen outDir", () => {
    const spawner = recordingSpawner();
    return Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* seedDocgenPackage();
      const probeDir = path.join(process.cwd(), "packages", "foundation", "modeling", "probe");
      yield* fs.makeDirectory(path.join(probeDir, "src"), { recursive: true });
      const argument30 = path.join(probeDir, "package.json");
      const encodedJson31 = yield* encodeJson({ name: "@beep/probe", version: "0.0.0" });
      yield* fs.writeFileString(argument30, encodedJson31);
      const argument31 = path.join(probeDir, "docgen.json");
      const encodedJson32 = yield* encodeJson({ srcDir: "src", outDir: ".jsdoc-loop/generated-docs" });
      yield* fs.writeFileString(argument31, encodedJson32);
      yield* fs.writeFileString(path.join(probeDir, "src", "index.ts"), invalidCategorySource);

      const plan = yield* runDocgenLocal({
        allowFull: false,
        base: "origin/main",
        full: true,
        head: "HEAD",
        json: false,
        packageSelector: O.some("@beep/schema"),
        parallel: 6,
        plan: false,
      }).pipe(provideSpawner(spawner));

      expect(plan.mode).toBe("full");
      expect(A.length(spawner.spawns)).toBe(2);
      const logLines7 = yield* TestConsole.logLines;
      const logs = A.join(A.filter(logLines7, isString), "\n");
      expect(logs).toContain(
        "docgen:local: skipped JSDoc metadata check for @beep/probe (non-canonical outDir: .jsdoc-loop/generated-docs)"
      );
      expect(logs).toContain("docgen:local: checking JSDoc metadata for 1 package(s)");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
  });

  it.effect("skips the scoped JSDoc metadata check for packages with a non-canonical docgen outDir", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* seedDocgenPackage();
      const probeDir = path.join(process.cwd(), "packages", "foundation", "modeling", "probe");
      yield* fs.makeDirectory(path.join(probeDir, "src"), { recursive: true });
      const argument32 = path.join(probeDir, "package.json");
      const encodedJson33 = yield* encodeJson({ name: "@beep/probe", version: "0.0.0" });
      yield* fs.writeFileString(argument32, encodedJson33);
      const argument33 = path.join(probeDir, "docgen.json");
      const encodedJson34 = yield* encodeJson({ srcDir: "src", outDir: ".jsdoc-loop/generated-docs" });
      yield* fs.writeFileString(argument33, encodedJson34);
      yield* fs.writeFileString(path.join(probeDir, "src", "index.ts"), invalidCategorySource);

      const packages = yield* discoverDocgenWorkspacePackages(process.cwd());
      const selected = selectDocgenLocalPackagesForTesting(packages, [
        "packages/foundation/modeling/schema/docgen.json",
        "packages/foundation/modeling/probe/docgen.json",
      ]);
      const directPackages = selectDirectDocgenPackagesForTesting(packages, selected);
      expect(A.map(directPackages, (pkg) => pkg.name)).toEqual(["@beep/probe", "@beep/schema"]);

      const checked = yield* filterDocgenMetadataCheckPackagesForTesting(directPackages, 2);
      expect(A.map(checked, (pkg) => pkg.name)).toEqual(["@beep/schema"]);
      const logLines8 = yield* TestConsole.logLines;
      const logs = A.join(A.filter(logLines8, isString), "\n");
      expect(logs).toContain(
        "docgen:local: skipped JSDoc metadata check for @beep/probe (non-canonical outDir: .jsdoc-loop/generated-docs)"
      );
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect(
    "rejects local docgen JSON output without plan mode",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const exit = yield* Effect.exit(runDocgenCommand(["local", "--json"]));

        const logLines9 = yield* TestConsole.logLines;
        expect(logLines9).toEqual([]);
        const errorLines10 = yield* TestConsole.errorLines;
        expect(A.join(A.filter(errorLines10, isString), "\n")).toContain(
          "--json requires --plan for docgen:local so stdout remains machine-readable."
        );
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect("parses current schema flags and classifies a configured package that has not generated docs", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument34 = path.join(tmpDir, "package.json");
      const encodedJson35 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument34, encodedJson35);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument35 = path.join(packageDir, "package.json");
      const encodedJson36 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument35, encodedJson36);
      const argument36 = path.join(packageDir, "docgen.json");
      const encodedJson37 = yield* encodeJson({
        $schema: "../../../../packages/tooling/tool/docgen/schema.json",
        enforceDescriptions: true,
        enforceExamples: true,
        enforceVersion: true,
        srcDir: "src",
      });
      yield* fs.writeFileString(argument36, encodedJson37);

      const config = yield* loadDocgenConfigDocument(packageDir);
      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(config.enforceDescriptions).toBe(true);
      expect(config.enforceExamples).toBe(true);
      expect(config.enforceVersion).toBe(true);
      expect(target?.status).toBe("configured-not-generated");
      expect(target?.docsOutputPath).toBe("foundation/modeling/schema");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("reports aggregate docs paths under the ignored docs/generated layout", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument37 = path.join(tmpDir, "package.json");
      const encodedJson38 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument37, encodedJson38);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      const docsModulesDir = path.join(packageDir, "docs", "modules");
      yield* fs.makeDirectory(docsModulesDir, { recursive: true });
      const argument38 = path.join(packageDir, "package.json");
      const encodedJson39 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument38, encodedJson39);
      const argument39 = path.join(packageDir, "docgen.json");
      const encodedJson40 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument39, encodedJson40);
      yield* fs.writeFileString(
        path.join(docsModulesDir, "Schema.md"),
        `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
      );

      yield* runDocgenCommand(["status", "--verbose"]);

      const logLines11 = yield* TestConsole.logLines;
      const output = A.join(A.filter(logLines11, isString), "\n");
      expect(output).toContain("aggregate: docs/generated/foundation/modeling/schema");
      expect(output).not.toContain("docs: docs/foundation/modeling/schema");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("builds repo-standard init config without example path mappings", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument40 = path.join(tmpDir, "package.json");
      const encodedJson41 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument40, encodedJson41);

      const schemaDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(schemaDir, "src"), { recursive: true });
      const argument41 = path.join(schemaDir, "package.json");
      const encodedJson42 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
        exports: {
          ".": "./src/index.ts",
          "./*": "./src/*.ts",
        },
      });
      yield* fs.writeFileString(argument41, encodedJson42);

      const identityDir = path.join(tmpDir, "packages", "foundation", "modeling", "identity");
      yield* fs.makeDirectory(path.join(identityDir, "src"), { recursive: true });
      const argument42 = path.join(identityDir, "package.json");
      const encodedJson43 = yield* encodeJson({
        name: "@beep/identity",
        version: "0.0.0",
        dependencies: {
          "@beep/schema": "workspace:*",
        },
        exports: {
          ".": "./src/index.ts",
          "./*": "./src/*.ts",
        },
      });
      yield* fs.writeFileString(argument42, encodedJson43);

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/identity"));

      expect(target).toBeDefined();

      const config = yield* createDocgenConfigDocument(target!, tmpDir);
      const compilerOptions = config.examplesCompilerOptions;

      expect(config.$schema).toBe("../../../../packages/tooling/tool/docgen/schema.json");
      expect(config.exclude).toEqual(["src/internal/**/*.ts"]);
      expect(config.srcLink).toBe(
        "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/identity/src/"
      );
      expect(compilerOptions).toEqual({
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        moduleResolution: "bundler",
        module: "es2022",
        target: "es2022",
        lib: ["ESNext", "DOM", "DOM.Iterable"],
        rewriteRelativeImportExtensions: true,
        allowImportingTsExtensions: true,
        moduleDetection: "force",
        verbatimModuleSyntax: true,
        allowJs: false,
        erasableSyntaxOnly: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        exactOptionalPropertyTypes: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitOverride: true,
        noFallthroughCasesInSwitch: true,
        stripInternal: false,
        noErrorTruncation: true,
        types: [],
        jsx: "react-jsx",
      });
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("builds paths-free init config regardless of source export shape", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument43 = path.join(tmpDir, "package.json");
      const encodedJson44 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*", "packages/example/*"],
      });
      yield* fs.writeFileString(argument43, encodedJson44);

      const schemaDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(schemaDir, "src"), { recursive: true });
      const argument44 = path.join(schemaDir, "package.json");
      const encodedJson45 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
        exports: {
          ".": "./src/index.ts",
          "./*": "./src/*.ts",
        },
      });
      yield* fs.writeFileString(argument44, encodedJson45);

      const runtimeDir = path.join(tmpDir, "packages", "example", "server");
      yield* fs.makeDirectory(path.join(runtimeDir, "src", "internal"), { recursive: true });
      const argument45 = path.join(runtimeDir, "package.json");
      const encodedJson46 = yield* encodeJson({
        name: "@beep/example-server",
        version: "0.0.0",
        dependencies: {
          "@beep/schema": "workspace:*",
        },
        exports: {
          ".": "./src/internal/index.ts",
          "./*": "./src/internal/*.ts",
        },
      });
      yield* fs.writeFileString(argument45, encodedJson46);

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/example-server"));

      expect(target).toBeDefined();

      const config = yield* createDocgenConfigDocument(target!, tmpDir);

      expect(config.$schema).toBe("../../../packages/tooling/tool/docgen/schema.json");
      expect(config.examplesCompilerOptions).toMatchObject({
        moduleResolution: "bundler",
      });
      expect(config.examplesCompilerOptions).not.toHaveProperty("paths");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("ignores vendored docgen trees that are outside workspace patterns", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument46 = path.join(tmpDir, "package.json");
      const encodedJson47 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument46, encodedJson47);

      const workspacePackageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(workspacePackageDir, "src"), { recursive: true });
      const argument47 = path.join(workspacePackageDir, "package.json");
      const encodedJson48 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument47, encodedJson48);
      const argument48 = path.join(workspacePackageDir, "docgen.json");
      const encodedJson49 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument48, encodedJson49);

      const vendoredPackageDir = path.join(tmpDir, ".repos", "effect-v4", "packages", "effect");
      yield* fs.makeDirectory(path.join(vendoredPackageDir, "src"), { recursive: true });
      const argument49 = path.join(vendoredPackageDir, "package.json");
      const encodedJson50 = yield* encodeJson({
        name: "effect",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument49, encodedJson50);
      const argument50 = path.join(vendoredPackageDir, "docgen.json");
      const encodedJson51 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument50, encodedJson51);

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);

      expect(A.map(packages, (pkg) => pkg.relativePath)).toEqual(["packages/foundation/modeling/schema"]);
      expect(A.map(packages, (pkg) => pkg.name)).toEqual(["@beep/schema"]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("preserves the nested docs layout and rewrites module parents", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument51 = path.join(tmpDir, "package.json");
      const encodedJson52 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument51, encodedJson52);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      const docsModulesDir = path.join(packageDir, "docs", "modules");
      yield* fs.makeDirectory(docsModulesDir, { recursive: true });
      const argument52 = path.join(packageDir, "package.json");
      const encodedJson53 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument52, encodedJson53);
      const argument53 = path.join(packageDir, "docgen.json");
      const encodedJson54 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument53, encodedJson54);
      yield* fs.writeFileString(
        path.join(docsModulesDir, "Schema.md"),
        `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
      );

      const results = yield* aggregateGeneratedDocs();
      const aggregatedPath = path.join(tmpDir, "docs", "generated", "foundation", "modeling", "schema", "Schema.md");
      const aggregatedIndexPath = path.join(
        tmpDir,
        "docs",
        "generated",
        "foundation",
        "modeling",
        "schema",
        "index.md"
      );
      const aggregated = yield* fs.readFileString(aggregatedPath);
      const aggregatedIndex = yield* fs.readFileString(aggregatedIndexPath);

      expect(results).toHaveLength(1);
      expect(results[0]?.docsOutputPath).toBe("foundation/modeling/schema");
      expect(aggregated).toContain('parent: "@beep/schema"');
      expect(aggregatedIndex).toContain("permalink: /docs/foundation/modeling/schema");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("aggregates private JSDoc loop output when a package emits it", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument54 = path.join(tmpDir, "package.json");
      const encodedJson55 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["scratchpad"],
      });
      yield* fs.writeFileString(argument54, encodedJson55);

      const packageDir = path.join(tmpDir, "scratchpad");
      const privateModulesDir = path.join(packageDir, ".jsdoc-loop", "generated-docs", "modules");
      yield* fs.makeDirectory(privateModulesDir, { recursive: true });
      const argument55 = path.join(packageDir, "package.json");
      const encodedJson56 = yield* encodeJson({ name: "@beep/scratchpad", version: "0.0.0" });
      yield* fs.writeFileString(argument55, encodedJson56);
      const argument56 = path.join(packageDir, "docgen.json");
      const encodedJson57 = yield* encodeJson({ srcDir: ".", outDir: ".jsdoc-loop/generated-docs" });
      yield* fs.writeFileString(argument56, encodedJson57);
      yield* fs.writeFileString(
        path.join(privateModulesDir, "Scratchpad.md"),
        `---\nparent: Modules\ntitle: Scratchpad\n---\n\ncontent\n`
      );

      const results = yield* aggregateGeneratedDocs();
      const aggregatedPath = path.join(tmpDir, "docs", "generated", "scratchpad", "Scratchpad.md");
      const aggregated = yield* fs.readFileString(aggregatedPath);

      expect(results).toHaveLength(1);
      expect(aggregated).toContain('parent: "@beep/scratchpad"');
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("skips symlinked docs entries during aggregation", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument57 = path.join(tmpDir, "package.json");
      const encodedJson58 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument57, encodedJson58);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      const docsModulesDir = path.join(packageDir, "docs", "modules");
      const outsideFilePath = path.join(tmpDir, "outside.md");
      yield* fs.makeDirectory(docsModulesDir, { recursive: true });
      const argument58 = path.join(packageDir, "package.json");
      const encodedJson59 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument58, encodedJson59);
      const argument59 = path.join(packageDir, "docgen.json");
      const encodedJson60 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument59, encodedJson60);
      yield* fs.writeFileString(
        path.join(docsModulesDir, "Schema.md"),
        `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
      );
      yield* fs.writeFileString(outsideFilePath, "top-secret\n");
      yield* fs.symlink(outsideFilePath, path.join(docsModulesDir, "Leak.md"));

      const results = yield* aggregateGeneratedDocs();
      const aggregatedPath = path.join(tmpDir, "docs", "generated", "foundation", "modeling", "schema", "Schema.md");
      const leakedPath = path.join(tmpDir, "docs", "generated", "foundation", "modeling", "schema", "Leak.md");
      const aggregated = yield* fs.readFileString(aggregatedPath);
      const leakedExists = yield* fs.exists(leakedPath);

      expect(results).toHaveLength(1);
      expect(results[0]?.fileCount).toBe(1);
      expect(aggregated).toContain('parent: "@beep/schema"');
      expect(leakedExists).toBe(false);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("rejects symlinked docs roots during aggregation", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument60 = path.join(tmpDir, "package.json");
      const encodedJson61 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument60, encodedJson61);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      const packageDocsDir = path.join(packageDir, "docs");
      const docsModulesDir = path.join(packageDocsDir, "modules");
      const externalDocsModulesDir = path.join(tmpDir, "external-docs", "modules");
      yield* fs.makeDirectory(packageDocsDir, { recursive: true });
      yield* fs.makeDirectory(externalDocsModulesDir, { recursive: true });
      const argument61 = path.join(packageDir, "package.json");
      const encodedJson62 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument61, encodedJson62);
      const argument62 = path.join(packageDir, "docgen.json");
      const encodedJson63 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument62, encodedJson63);
      yield* fs.writeFileString(
        path.join(externalDocsModulesDir, "Schema.md"),
        `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
      );
      yield* fs.symlink(externalDocsModulesDir, docsModulesDir);

      const exit = yield* aggregateGeneratedDocs().pipe(Effect.exit);
      const aggregatedPath = path.join(tmpDir, "docs", "generated", "foundation", "modeling", "schema");
      const aggregatedExists = yield* fs.exists(aggregatedPath);

      assertTrue(exit._tag === "Failure");
      expect(aggregatedExists).toBe(false);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("rejects stale docgen configs outside current workspaces during aggregation", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument63 = path.join(tmpDir, "package.json");
      const encodedJson64 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument63, encodedJson64);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument64 = path.join(packageDir, "package.json");
      const encodedJson65 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument64, encodedJson65);

      const staleDocgenPath = path.join(tmpDir, "packages", "retired", "runtime", "docgen.json");
      yield* fs.makeDirectory(path.dirname(staleDocgenPath), { recursive: true });
      const encodedJson = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(staleDocgenPath, encodedJson);

      // A stray docgen.json below the ceremony-exempt labs root must stay
      // invisible to the orphan scan (goals/lab-apps-lifecycle D2).
      const labsDocgenPath = path.join(tmpDir, "apps", "labs", "demo", "docgen.json");
      yield* fs.makeDirectory(path.dirname(labsDocgenPath), { recursive: true });
      const encodedJson12 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(labsDocgenPath, encodedJson12);

      const orphaned = yield* discoverOrphanDocgenConfigPaths(tmpDir);
      const error = yield* aggregateGeneratedDocs().pipe(Effect.flip);

      expect(orphaned).toEqual(["packages/retired/runtime/docgen.json"]);
      expect(error.message).toContain("packages/retired/runtime/docgen.json");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("keeps ceremony-exempt labs workspaces out of docgen discovery and aggregation", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument65 = path.join(tmpDir, "package.json");
      const encodedJson66 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*", "apps/labs/*"],
      });
      yield* fs.writeFileString(argument65, encodedJson66);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      const packageDocsModulesDir = path.join(packageDir, "docs", "modules");
      yield* fs.makeDirectory(packageDocsModulesDir, { recursive: true });
      const argument66 = path.join(packageDir, "package.json");
      const encodedJson67 = yield* encodeJson({ name: "@beep/schema", version: "0.0.0" });
      yield* fs.writeFileString(argument66, encodedJson67);
      const argument67 = path.join(packageDir, "docgen.json");
      const encodedJson68 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument67, encodedJson68);
      yield* fs.writeFileString(
        path.join(packageDocsModulesDir, "Schema.md"),
        `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
      );

      // A stray docgen.json below the ceremony-exempt labs root must never
      // turn a lab workspace into a docgen target (goals/lab-apps-lifecycle
      // D2): the Heavy / Docgen lane failed on exactly this shape when
      // apps/labs/api-docs carried one.
      const labsAppDir = path.join(tmpDir, "apps", "labs", "api-docs");
      const labsDocsModulesDir = path.join(labsAppDir, "docs", "modules");
      yield* fs.makeDirectory(labsDocsModulesDir, { recursive: true });
      const argument68 = path.join(labsAppDir, "package.json");
      const encodedJson69 = yield* encodeJson({ name: "@beep/api-docs", version: "0.0.0" });
      yield* fs.writeFileString(argument68, encodedJson69);
      const argument69 = path.join(labsAppDir, "docgen.json");
      const encodedJson70 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument69, encodedJson70);
      yield* fs.writeFileString(
        path.join(labsDocsModulesDir, "ApiDocs.md"),
        `---\nparent: Modules\ntitle: ApiDocs\n---\n\ncontent\n`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const results = yield* aggregateGeneratedDocs();
      const labsAggregateExists = yield* fs.exists(path.join(tmpDir, "docs", "generated", "labs", "api-docs"));

      expect(A.map(packages, (pkg) => pkg.name)).toEqual(["@beep/schema"]);
      expect(A.map(results, (result) => result.packageName)).toEqual(["@beep/schema"]);
      expect(labsAggregateExists).toBe(false);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("supports clean aggregation when stale docs paths conflict with nested package docs", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument70 = path.join(tmpDir, "package.json");
      const encodedJson71 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/example/*"],
      });
      yield* fs.writeFileString(argument70, encodedJson71);

      const packageDir = path.join(tmpDir, "packages", "example", "store");
      const docsModulesDir = path.join(packageDir, "docs", "modules");
      yield* fs.makeDirectory(docsModulesDir, { recursive: true });
      const argument71 = path.join(packageDir, "package.json");
      const encodedJson72 = yield* encodeJson({
        name: "@beep/example-store",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument71, encodedJson72);
      const argument72 = path.join(packageDir, "docgen.json");
      const encodedJson73 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument72, encodedJson73);
      yield* fs.writeFileString(
        path.join(docsModulesDir, "Store.md"),
        `---\nparent: Modules\ntitle: Store\n---\n\ncontent\n`
      );

      yield* fs.makeDirectory(path.join(tmpDir, "docs", "generated"), { recursive: true });
      yield* fs.writeFileString(path.join(tmpDir, "docs", "generated", "example"), "stale-path-conflict");

      const results = yield* aggregateGeneratedDocs({ clean: true });
      const aggregatedPath = path.join(tmpDir, "docs", "generated", "example", "store", "Store.md");
      const aggregated = yield* fs.readFileString(aggregatedPath);

      expect(results).toHaveLength(1);
      expect(results[0]?.docsOutputPath).toBe("example/store");
      expect(aggregated).toContain('parent: "@beep/example-store"');
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it("renders human-first report content without agent instructions", () => {
    const analysis = DocgenPackageAnalysis.make({
      packageName: "@beep/schema",
      packagePath: "packages/foundation/modeling/schema",
      timestamp: "2026-03-08T00:00:00.000Z",
      exports: [
        DocgenExportAnalysis.make({
          name: "Schema",
          kind: "class",
          filePath: "src/index.ts",
          line: 12,
          presentTags: ["@category"],
          missingTags: ["@example", "@since"],
          categoryValues: ["schemas"],
          categoryIssues: [],
          hasJsDoc: true,
          priority: "medium",
          declarationSource: "export class Schema {}",
          context: "Primary schema export.",
        }),
      ],
      summary: DocgenAnalysisSummary.make({
        totalExports: 1,
        fullyDocumented: 0,
        missingDocumentation: 1,
        missingCategory: 0,
        invalidCategory: 0,
        missingExample: 1,
        missingSince: 1,
      }),
    });

    const report = generateAnalysisReport(analysis, true);
    const findingsReport = generateAnalysisReport(analysis, false);

    expect(report).toContain("# JSDoc Analysis Report: @beep/schema");
    expect(report).toContain("bun run beep docgen analyze -p packages/foundation/modeling/schema");
    expect(report).toContain("## Fix Checklist");
    expect(findingsReport).toContain("## Findings");
    expect(findingsReport).toContain("### Schema");
    expect(findingsReport).toContain("- Context: Primary schema export.");
    expect(report).not.toContain("Instructions for Agent");
    expect(report).not.toContain("You are tasked");
  });

  it.effect("builds rich JSDoc quality subjects and advisory findings", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      yield* writeSchemaTsconfig();
      const report = yield* analyzeSchemaPackageQuality(richQualitySubjectSource);
      const subject = qualitySubject(report, "parseValue");
      const review = qualityReview(report, subject);
      const subjectValue = O.getOrUndefined(subject);
      const reviewValue = O.getOrUndefined(review);

      expect(subjectValue?.description).toContain("Parses a value");
      expect(subjectValue?.parsedExamples).toHaveLength(1);
      expect(subjectValue?.sourceAnchor).toContain("packages/foundation/modeling/schema/src/index.ts:");
      expect(subjectValue?.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(subjectValue?.declarationKind).toBe("const");
      expect(reviewValue?.tier).toBe("warn");
      expect(qualityFindingCodes(review)).toContain("example-only-voids-result");
      expect(qualityFindingCodes(review)).toContain("example-discards-result");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("flags empty and over-padded code examples during quality analysis", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument73 = path.join(tmpDir, "package.json");
      const encodedJson74 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument73, encodedJson74);
      const argument74 = path.join(tmpDir, "tsconfig.json");
      const encodedJson75 = yield* encodeJson({
        compilerOptions: {
          module: "es2022",
          target: "es2022",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
        },
        include: ["packages/**/*.ts"],
      });
      yield* fs.writeFileString(argument74, encodedJson75);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument75 = path.join(packageDir, "package.json");
      const encodedJson76 = yield* encodeJson({ name: "@beep/schema" });
      yield* fs.writeFileString(argument75, encodedJson76);
      const argument76 = path.join(packageDir, "docgen.json");
      const encodedJson77 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument76, encodedJson77);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Over-padded example fixture.
 *
 * @example
 * \`\`\`ts
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *
 *
 *
 * })
 * console.log(program)
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = yield* pipe(
        A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"),
        O.match({
          onNone: () => Effect.die(new Error("Expected the seeded @beep/schema package to be discoverable")),
          onSome: Effect.succeed,
        })
      );
      const report = yield* analyzePackageQuality(target);
      const subject = O.getOrUndefined(A.findFirst(report.subjects, (entry) => entry.exportName === "parseValue"));
      const review = O.getOrUndefined(
        A.findFirst(report.reviews, (entry) => entry.subjectId === subject?.stableIdentity)
      );
      const codes = A.map(review?.findings ?? [], (finding) => finding.code);

      expect(codes).toContain("example-empty-effect-gen");
      expect(codes).toContain("example-too-many-blank-lines");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("collects local export-list symbols and treats lowercase console output as observable", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument77 = path.join(tmpDir, "package.json");
      const encodedJson78 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument77, encodedJson78);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument78 = path.join(packageDir, "package.json");
      const encodedJson79 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument78, encodedJson79);
      const argument79 = path.join(packageDir, "docgen.json");
      const encodedJson80 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument79, encodedJson80);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `const parseValue = (value: string): string => value.trim();

/**
 * Parses a value into the normalized schema fixture.
 *
 * @example
 * \`\`\`ts
 * import { parseValue } from "@beep/schema"
 * const result = parseValue(" hello ")
 * console.log(result)
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export { parseValue };
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const exportNames = A.map(report.subjects, (subject) => subject.exportName);
      const subject = O.getOrUndefined(A.findFirst(report.subjects, (entry) => entry.exportName === "parseValue"));
      const review = O.getOrUndefined(
        A.findFirst(report.reviews, (entry) => entry.subjectId === subject?.stableIdentity)
      );
      const findingCodes = A.map(review?.findings ?? [], (finding) => finding.code);

      expect(exportNames).toEqual(["parseValue"]);
      expect(subject?.description).toContain("Parses a value");
      expect(subject?.rawJsDoc).toContain("@example");
      expect(subject?.stableIdentity).toMatch(
        /^@beep\/schema:packages\/foundation\/modeling\/schema\/src\/index\.ts:const:parseValue:[a-f0-9]{12}$/
      );
      expect(subject?.sourceAnchor).toContain("packages/foundation/modeling/schema/src/index.ts:");
      expect(findingCodes).not.toContain("missing-example");
      expect(findingCodes).not.toContain("example-lacks-observable-result");
      expect(findingCodes).not.toContain("example-logs-export-symbol");
      expect(findingCodes).not.toContain("example-only-voids-result");
      expect(findingCodes).not.toContain("example-too-trivial");
      expect(review?.tier).toBe("pass");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("warns when examples log exported symbol handles instead of behavior", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument80 = path.join(tmpDir, "package.json");
      const encodedJson81 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument80, encodedJson81);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument81 = path.join(packageDir, "package.json");
      const encodedJson82 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument81, encodedJson82);
      const argument82 = path.join(packageDir, "docgen.json");
      const encodedJson83 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument82, encodedJson83);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Runtime client used by chat examples.
 *
 * @example
 * \`\`\`ts
 * import { ChatClient } from "@beep/schema"
 * console.log(ChatClient)
 * \`\`\`
 * @category clients
 * @since 0.0.0
 */
export class ChatClient {}

/**
 * Schema fixture used by the quality rule.
 *
 * @example
 * \`\`\`ts
 * import { ChatSchema } from "@beep/schema"
 * console.log(ChatSchema.fields)
 * \`\`\`
 * @category schemas
 * @since 0.0.0
 */
export const ChatSchema = { fields: { id: "string" } };
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const findingCodesFor = (exportName: string) => {
        const subject = O.getOrUndefined(A.findFirst(report.subjects, (entry) => entry.exportName === exportName));
        const review = O.getOrUndefined(
          A.findFirst(report.reviews, (entry) => entry.subjectId === subject?.stableIdentity)
        );
        return A.map(review?.findings ?? [], (finding) => finding.code);
      };

      expect(findingCodesFor("ChatClient")).toContain("example-logs-export-symbol");
      expect(findingCodesFor("ChatSchema")).toContain("example-logs-export-symbol");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("aligns observable example and Effect signature heuristics", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument83 = path.join(tmpDir, "package.json");
      const encodedJson84 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument83, encodedJson84);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument84 = path.join(packageDir, "package.json");
      const encodedJson85 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument84, encodedJson85);
      const argument85 = path.join(packageDir, "docgen.json");
      const encodedJson86 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument85, encodedJson86);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Parses a value into the normalized schema fixture.
 *
 * @example
 * \`\`\`ts
 * import * as Equal from "effect/Equal"
 * import { parseValue } from "@beep/schema"
 * const result = parseValue(" hello ")
 * void result
 * Equal.equals(result, "hello")
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();

/**
 * Formats a value while mentioning Effect.Exit only in documentation prose.
 *
 * @returns Text for displaying an Effect.Exit label.
 * @example
 * \`\`\`ts
 * import { formatValue } from "@beep/schema"
 * const result = formatValue("hello")
 * console.log(result)
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const formatValue = (value: string): string => \`value: \${value}\`;
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const reviewFor = (exportName: string) => {
        const subject = O.getOrUndefined(A.findFirst(report.subjects, (entry) => entry.exportName === exportName));
        return O.getOrUndefined(A.findFirst(report.reviews, (entry) => entry.subjectId === subject?.stableIdentity));
      };

      for (const exportName of ["parseValue", "formatValue"]) {
        const subject = qualitySubject(report, exportName);
        assertSome(subject, O.getOrThrow(subject));
        const review = qualityReview(report, subject);
        assertSome(review, O.getOrThrow(review));
      }

      const parseFindingCodes = A.map(reviewFor("parseValue")?.findings ?? [], (finding) => finding.code);
      const formatFindingCodes = A.map(reviewFor("formatValue")?.findings ?? [], (finding) => finding.code);

      expect(parseFindingCodes).not.toContain("example-only-voids-result");
      expect(parseFindingCodes).not.toContain("example-lacks-observable-result");
      expect(formatFindingCodes).not.toContain("missing-effects-for-effectful-symbol");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("accepts type-level evidence as a useful type-only example", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument86 = path.join(tmpDir, "package.json");
      const encodedJson87 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument86, encodedJson87);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument87 = path.join(packageDir, "package.json");
      const encodedJson88 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument87, encodedJson88);
      const argument88 = path.join(packageDir, "docgen.json");
      const encodedJson89 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument88, encodedJson89);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Extracts the element type from an array or tuple.
 *
 * @example
 * \`\`\`ts
 * import type { Elem } from "@beep/schema"
 *
 * type TupleElement = Elem<readonly [1, 2, 3]>
 * type Expected = 1 | 2 | 3
 * type Matches = TupleElement extends Expected ? true : false
 * \`\`\`
 * @category type-level
 * @since 0.0.0
 */
export type Elem<T> = T extends readonly (infer U)[] ? U : never;
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const subject = O.getOrUndefined(A.findFirst(report.subjects, (entry) => entry.exportName === "Elem"));
      const review = O.getOrUndefined(
        A.findFirst(report.reviews, (entry) => entry.subjectId === subject?.stableIdentity)
      );
      const findingCodes = A.map(review?.findings ?? [], (finding) => finding.code);

      expect(subject?.declarationKind).toBe("type");
      expect(findingCodes).not.toContain("example-only-voids-result");
      expect(findingCodes).not.toContain("example-lacks-observable-result");
      expect(review?.tier).toBe("pass");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("treats inheritDoc companion aliases as inheriting required examples", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const report = yield* analyzeSchemaPackageQuality(companionAliasQualitySource);
      const typeSubject = qualitySubject(report, "AccountStatus", "type");
      const linkedTypeSubject = qualitySubject(report, "AccountMode", "type");
      const bareTypeSubject = qualitySubject(report, "AccountAccess", "type");
      const bareCompanionTypeSubject = qualitySubject(report, "AccountFlag", "type");
      const schemaTypeCompanionSubject = qualitySubject(report, "AccountFlags", "type");
      const companionNamespaceSubject = qualitySubject(report, "AccountMode", "namespace");
      const companionInterfaceSubject = qualitySubject(report, "AccountGraph", "interface");

      expect(deterministicMissingTags(typeSubject)).not.toContain("@example");
      expect(deterministicMissingTags(linkedTypeSubject)).not.toContain("@example");
      expect(deterministicMissingTags(bareCompanionTypeSubject)).not.toContain("@example");
      expect(deterministicMissingTags(schemaTypeCompanionSubject)).not.toContain("@example");
      expect(deterministicMissingTags(companionNamespaceSubject)).not.toContain("@example");
      expect(deterministicMissingTags(companionInterfaceSubject)).not.toContain("@example");
      expect(deterministicMissingTags(bareTypeSubject)).toContain("@example");
      expect(qualityFindingCodes(qualityReview(report, typeSubject))).not.toContain("missing-example");
      expect(qualityFindingCodes(qualityReview(report, linkedTypeSubject))).not.toContain("missing-example");
      expect(qualityFindingCodes(qualityReview(report, bareCompanionTypeSubject))).not.toContain("missing-example");
      expect(qualityFindingCodes(qualityReview(report, schemaTypeCompanionSubject))).not.toContain("missing-example");
      expect(qualityFindingCodes(qualityReview(report, companionNamespaceSubject))).not.toContain("missing-example");
      expect(qualityFindingCodes(qualityReview(report, companionInterfaceSubject))).not.toContain("missing-example");
      expect(qualityFindingCodes(qualityReview(report, bareTypeSubject))).toContain("missing-example");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("skips exported declarations marked internal", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument89 = path.join(tmpDir, "package.json");
      const encodedJson90 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument89, encodedJson90);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument90 = path.join(packageDir, "package.json");
      const encodedJson91 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument90, encodedJson91);
      const argument91 = path.join(packageDir, "docgen.json");
      const encodedJson92 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument91, encodedJson92);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/** @internal */
/**
 * Helper intentionally exported for package internals.
 *
 * @category utilities
 * @since 0.0.0
 */
export const internalHelper = "hidden";

/**
 * Public helper.
 *
 * @example
 * \`\`\`ts
 * import { publicHelper } from "@beep/schema"
 *
 * console.log(publicHelper)
 * \`\`\`
 *
 * @category utilities
 * @since 0.0.0
 */
export const publicHelper = "shown";
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      expect(A.some(report.subjects, (entry) => entry.exportName === "internalHelper")).toBe(false);
      expect(A.some(report.subjects, (entry) => entry.exportName === "publicHelper")).toBe(true);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("does not score undocumented overload signatures separately from the documented overload", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument92 = path.join(tmpDir, "package.json");
      const encodedJson93 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument92, encodedJson93);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument93 = path.join(packageDir, "package.json");
      const encodedJson94 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument93, encodedJson94);
      const argument94 = path.join(packageDir, "docgen.json");
      const encodedJson95 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument94, encodedJson95);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Converts values to display text.
 *
 * @example
 * \`\`\`ts
 * import { display } from "@beep/schema"
 *
 * console.log(display("ready"))
 * \`\`\`
 *
 * @category utilities
 * @since 0.0.0
 */
export function display(value: string): string;
export function display(value: number): string;
export function display(value: string | number): string {
  return String(value);
}
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const displaySubjects = A.filter(report.subjects, (entry) => entry.exportName === "display");
      const analysis = yield* analyzePackageDocumentation(target!);
      expect(displaySubjects).toHaveLength(1);
      expect(displaySubjects[0]?.rawJsDoc).toContain("@example");
      expect(analysis.summary.missingDocumentation).toBe(0);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("does not require documentation for static component member assignments", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument95 = path.join(tmpDir, "package.json");
      const encodedJson96 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument95, encodedJson96);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument96 = path.join(packageDir, "package.json");
      const encodedJson97 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument96, encodedJson97);
      const argument97 = path.join(packageDir, "docgen.json");
      const encodedJson98 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument97, encodedJson98);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Renders an alert component.
 *
 * @example
 * \`\`\`ts
 * import { Alert } from "@beep/schema"
 *
 * console.log(Alert.Title)
 * \`\`\`
 *
 * @category components
 * @since 0.0.0
 */
export function Alert() {
  return null;
}

/**
 * Renders an alert title component.
 *
 * @example
 * \`\`\`ts
 * import { AlertTitle } from "@beep/schema"
 *
 * console.log(AlertTitle)
 * \`\`\`
 *
 * @category components
 * @since 0.0.0
 */
function AlertTitle() {
  return null;
}

Alert.Title = AlertTitle;
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const analysis = yield* analyzePackageDocumentation(target!);
      expect(analysis.summary.missingDocumentation).toBe(0);
      expect(A.some(analysis.exports, (entry) => entry.name === "Alert" && entry.line === 31)).toBe(false);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("reads the leading JSDoc of export default expression statements", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument98 = path.join(tmpDir, "package.json");
      const encodedJson99 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument98, encodedJson99);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument99 = path.join(packageDir, "package.json");
      const encodedJson100 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument99, encodedJson100);
      const argument100 = path.join(packageDir, "docgen.json");
      const encodedJson101 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument100, encodedJson101);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "Documented.ts"),
        `/**
 * Documented default export.
 *
 * @since 0.0.0
 */

const defineRule = <A>(value: A): A => value;

/**
 * Defines the documented rule.
 *
 * @category tools
 * @since 0.0.0
 */
export default defineRule({ name: "documented" });
`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "Undocumented.ts"),
        `/**
 * Undocumented default export.
 *
 * @since 0.0.0
 */

const defineRule = <A>(value: A): A => value;

export default defineRule({ name: "undocumented" });
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const analysis = yield* analyzePackageDocumentation(target!);
      const defaultExports = A.filter(analysis.exports, (entry) => entry.name === "default");

      const missingTagsFor = (filePath: string) =>
        A.map(
          A.filter(defaultExports, (entry) => entry.filePath === filePath),
          (entry) => entry.missingTags
        );

      expect(missingTagsFor("src/Documented.ts")).toEqual([[]]);
      expect(missingTagsFor("src/Undocumented.ts")).toEqual([["@category", "@since"]]);
      expect(analysis.summary.missingDocumentation).toBe(1);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("uses owning declaration JSDoc for same-file export specifier subjects", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument101 = path.join(tmpDir, "package.json");
      const encodedJson102 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument101, encodedJson102);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument102 = path.join(packageDir, "package.json");
      const encodedJson103 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument102, encodedJson103);
      const argument103 = path.join(packageDir, "docgen.json");
      const encodedJson104 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument103, encodedJson104);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Displays a value.
 *
 * @example
 * \`\`\`ts
 * import { Display } from "@beep/schema"
 *
 * console.log(Display("ready"))
 * \`\`\`
 * @category utilities
 * @since 0.0.0
 */
function Display(value: string): string {
  return value;
}

/**
 * Public component exports.
 *
 * @category utilities
 * @since 0.0.0
 */
export { Display };
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const subject = O.getOrUndefined(A.findFirst(report.subjects, (entry) => entry.exportName === "Display"));
      const review = O.getOrUndefined(
        A.findFirst(report.reviews, (entry) => entry.subjectId === subject?.stableIdentity)
      );
      const findingCodes = A.map(review?.findings ?? [], (finding) => finding.code);

      expect(subject?.rawJsDoc).toContain("Displays a value.");
      expect(subject?.rawJsDoc).toContain("@example");
      expect(findingCodes).not.toContain("missing-description");
      expect(findingCodes).not.toContain("missing-example");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("uses schema annotation descriptions when JSDoc only carries tags", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument104 = path.join(tmpDir, "package.json");
      const encodedJson105 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument104, encodedJson105);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument105 = path.join(packageDir, "package.json");
      const encodedJson106 = yield* encodeJson({ name: "@beep/schema" });
      yield* fs.writeFileString(argument105, encodedJson106);
      const argument106 = path.join(packageDir, "docgen.json");
      const encodedJson107 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument106, encodedJson107);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `import * as S from "effect/Schema";

const $I = {
  annote: (_name: string, options: { readonly description: string }) => options
};

/**
 * @example
 * \`\`\`ts
 * import { TaggedValue } from "@beep/schema"
 *
 * console.log(TaggedValue)
 * \`\`\`
 * @category models
 * @since 0.0.0
 */
export class TaggedValue extends S.TaggedClass<TaggedValue>("TaggedValue")(
  "tagged",
  {},
  $I.annote("TaggedValue", {
    description: "Tagged value schema annotation description."
  })
) {}
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const subject = O.getOrUndefined(A.findFirst(report.subjects, (entry) => entry.exportName === "TaggedValue"));
      const review = O.getOrUndefined(
        A.findFirst(report.reviews, (entry) => entry.subjectId === subject?.stableIdentity)
      );
      const findingCodes = A.map(review?.findings ?? [], (finding) => finding.code);

      expect(subject?.description).toBe("Tagged value schema annotation description.");
      expect(findingCodes).not.toContain("missing-description");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("does not score aliased local export specifiers as separate quality subjects", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument107 = path.join(tmpDir, "package.json");
      const encodedJson108 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument107, encodedJson108);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument108 = path.join(packageDir, "package.json");
      const encodedJson109 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument108, encodedJson109);
      const argument109 = path.join(packageDir, "docgen.json");
      const encodedJson110 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument109, encodedJson110);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Canonical schema value.
 *
 * @example
 * \`\`\`ts
 * import { Canonical } from "@beep/schema"
 *
 * console.log(Canonical)
 * \`\`\`
 * @category schemas
 * @since 0.0.0
 */
export const Canonical = "canonical";

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { Canonical as Schema };
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const exportNames = A.map(report.subjects, (subject) => subject.exportName);

      expect(exportNames).toContain("Canonical");
      expect(exportNames).not.toContain("Schema");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("preserves default-export subjects in quality analysis", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument110 = path.join(tmpDir, "package.json");
      const encodedJson111 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument110, encodedJson111);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument111 = path.join(packageDir, "package.json");
      const encodedJson112 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument111, encodedJson112);
      const argument112 = path.join(packageDir, "docgen.json");
      const encodedJson113 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument112, encodedJson113);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "DefaultFunction.ts"),
        `/**
 * Normalizes a default-exported function value.
 *
 * @example
 * \`\`\`ts
 * import normalizeDefault from "@beep/schema/DefaultFunction"
 *
 * console.log(normalizeDefault(" hello "))
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export default function (value: string): string {
  return value.trim();
}
`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "DefaultClass.ts"),
        `/**
 * Default-exported value holder fixture.
 *
 * @example
 * \`\`\`ts
 * import DefaultValueHolder from "@beep/schema/DefaultClass"
 *
 * console.log(DefaultValueHolder.make().value)
 * \`\`\`
 * @category models
 * @since 0.0.0
 */
export default class {
  readonly value = "class-default";
}
`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "AssignedDefault.ts"),
        `/**
 * Trims a value before exporting it as the module default.
 *
 * @example
 * \`\`\`ts
 * import trimDefault from "@beep/schema/AssignedDefault"
 *
 * console.log(trimDefault(" hello "))
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
const trimDefault = (value: string): string => value.trim();

/**
 * Default export assignment for the trim helper.
 *
 * @category parsing
 * @since 0.0.0
 */
export default trimDefault;
`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "LiteralDefault.ts"),
        `/**
 * Literal default export fixture.
 *
 * **Example** (Read the literal default)
 * \`\`\`ts
 * import value from "@beep/schema/LiteralDefault"
 *
 * console.log(value)
 * \`\`\`
 * @category constants
 * @since 0.0.0
 */
export default "literal-default";
`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "ExportEquals.ts"),
        `const value = "export-equals";

export = value;
`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "ExportedAssignedDefault.ts"),
        `/**
 * Trims a named export before assigning the same value as the module default.
 *
 * @example
 * \`\`\`ts
 * import { trimNamedDefault } from "@beep/schema/ExportedAssignedDefault"
 *
 * console.log(trimNamedDefault(" hello "))
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const trimNamedDefault = (value: string): string => value.trim();

export default trimNamedDefault;
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const defaultSubjects = pipe(
        report.subjects,
        A.filter((subject) => subject.exportName === "default")
      );

      expect(defaultSubjects).toHaveLength(4);
      expect(A.map(report.subjects, (subject) => subject.exportName)).toContain("trimNamedDefault");
      expect(
        pipe(
          defaultSubjects,
          A.map((subject) => subject.declarationKind)
        )
      ).toEqual(expect.arrayContaining(["class", "const", "function"]));
      expect(
        pipe(
          defaultSubjects,
          A.map((subject) => subject.repoPath)
        )
      ).toEqual(
        expect.arrayContaining([
          "packages/foundation/modeling/schema/src/AssignedDefault.ts",
          "packages/foundation/modeling/schema/src/DefaultClass.ts",
          "packages/foundation/modeling/schema/src/DefaultFunction.ts",
          "packages/foundation/modeling/schema/src/LiteralDefault.ts",
        ])
      );
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("treats module re-exports as graph edges instead of quality subjects", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument113 = path.join(tmpDir, "package.json");
      const encodedJson114 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument113, encodedJson114);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument114 = path.join(packageDir, "package.json");
      const encodedJson115 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument114, encodedJson115);
      const argument115 = path.join(packageDir, "docgen.json");
      const encodedJson116 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument115, encodedJson116);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "Value.ts"),
        `/**
 * Parses a value into the normalized schema fixture.
 *
 * @example
 * \`\`\`ts
 * import { parseValue } from "@beep/schema/Value"
 * const result = parseValue(" hello ")
 * console.log(result)
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `export * as Value from "./Value.ts";
export { parseValue as parseAlias } from "./Value.ts";
export * from "./Value.ts";
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const exportNames = A.map(report.subjects, (subject) => subject.exportName);
      const findingCodes = pipe(
        report.reviews,
        A.flatMap((review) => A.map(review.findings, (finding) => finding.code))
      );

      expect(exportNames).toEqual(["parseValue"]);
      expect(exportNames).not.toContain("export * as Value");
      expect(findingCodes).not.toContain("missing-example");
      expect(findingCodes).not.toContain("missing-description");
      const metadata = yield* analyzePackageDocumentation(target!);
      expect(metadata.summary.missingDocumentation).toBe(1);
      expect(A.map(metadata.exports, (entry) => entry.name)).toEqual(["<module fileoverview>", "parseValue"]);
      expect(metadata.exports[0]?.missingTags).toEqual(["@since"]);
      expect(A.some(metadata.exports, (entry) => entry.kind === "re-export")).toBe(false);

      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        '/** @packageDocumentation @since 0.0.0 */\nexport * from "./Value.ts";\n'
      );
      const documentedBarrel = yield* analyzePackageDocumentation(target!);
      expect(documentedBarrel.summary.missingDocumentation).toBe(0);

      yield* fs.writeFileString(
        path.join(packageDir, "src", "Value.ts"),
        "/**\n * @packageDocumentation\n * @since 0.0.0\n */\n\nexport const parseValue = 1;\n"
      );
      const undocumented = yield* analyzePackageDocumentation(target!);
      expect(undocumented.summary.missingDocumentation).toBe(1);
      expect(A.map(undocumented.exports, (entry) => entry.name)).toEqual(["parseValue"]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("emits schema v2 partial package reports when the package budget is exhausted", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument116 = path.join(tmpDir, "package.json");
      const encodedJson117 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument116, encodedJson117);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument117 = path.join(packageDir, "package.json");
      const encodedJson118 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument117, encodedJson118);
      const argument118 = path.join(packageDir, "docgen.json");
      const encodedJson119 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument118, encodedJson119);
      yield* fs.writeFileString(path.join(packageDir, "src", "index.ts"), `export const parseValue = "skip";\n`);

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzeDocgenQuality({
        packageTimeout: Duration.millis(0),
        scope: "package",
        scoreMode: "rubric",
        targets: [target!],
      });
      const json = yield* generateQualityJson(report);
      const decoded = (yield* decodeUnknownJson(json)) as {
        readonly schemaVersion?: unknown;
        readonly packages?: ReadonlyArray<{
          readonly durationMs?: unknown;
          readonly error?: unknown;
          readonly status?: unknown;
          readonly timedOut?: unknown;
        }>;
      };

      expect(decoded.schemaVersion).toBe(2);
      expect(decoded.packages?.[0]?.status).toBe("partial");
      expect(decoded.packages?.[0]?.timedOut).toBe(true);
      expect(decoded.packages?.[0]?.durationMs).toEqual(expect.any(Number));
      expect(decoded.packages?.[0]?.error).toContain("Timed out");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("honors docgen exclude globs during quality subject collection", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument119 = path.join(tmpDir, "package.json");
      const encodedJson120 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument119, encodedJson120);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src", "internal"), { recursive: true });
      const argument120 = path.join(packageDir, "package.json");
      const encodedJson121 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument120, encodedJson121);
      const argument121 = path.join(packageDir, "docgen.json");
      const encodedJson122 = yield* encodeJson({
        srcDir: "src",
        exclude: ["src/internal/**/*.ts", "src/*.generated.ts"],
      });
      yield* fs.writeFileString(argument121, encodedJson122);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Package docs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Parses a value into the normalized schema fixture.
 *
 * @example
 * \`\`\`ts
 * import { parseValue } from "@beep/schema"
 * const result = parseValue(" hello ")
 * expect(result).toBe("hello")
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "internal", "Hidden.ts"),
        `export const HiddenInternal = "skip me";\n`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "schema.generated.ts"),
        `export const GeneratedExport = "skip me too";\n`
      );
      yield* fs.writeFileString(
        path.join(packageDir, "src", "Button.stories.tsx"),
        `export const StoryVariant = { args: { children: "skip me too" } };\n`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzePackageQuality(target!);
      const exportNames = A.map(report.subjects, (subject) => subject.exportName);

      expect(exportNames).toContain("parseValue");
      expect(exportNames).not.toContain("HiddenInternal");
      expect(exportNames).not.toContain("GeneratedExport");
      expect(exportNames).not.toContain("StoryVariant");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect(
    "selects packages from changed-files git output",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        yield* runCommand("git", ["init"], tmpDir);
        const argument122 = path.join(tmpDir, "package.json");
        const encodedJson123 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument122, encodedJson123);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument123 = path.join(packageDir, "package.json");
        const encodedJson124 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
        });
        yield* fs.writeFileString(argument123, encodedJson124);
        const argument124 = path.join(packageDir, "docgen.json");
        const encodedJson125 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument124, encodedJson125);
        yield* fs.writeFileString(
          path.join(packageDir, "src", "index.ts"),
          `/**
 * Parses a value into the normalized schema fixture.
 *
 * @example
 * \`\`\`ts
 * import { parseValue } from "@beep/schema"
 * const result = parseValue(" hello ")
 * console.log(result)
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
        );

        yield* runDocgenCommand(["quality", "--changed-files", "--json"]);

        const logLines13 = yield* TestConsole.logLines;
        const output = A.join(A.filter(logLines13, isString), "\n");
        const decoded = (yield* decodeUnknownJson(output)) as {
          readonly scope?: string;
          readonly packages?: ReadonlyArray<{
            readonly packageName?: string;
            readonly subjects?: ReadonlyArray<{ readonly exportName?: string }>;
          }>;
        };

        expect(decoded.scope).toBe("changed-files");
        expect(decoded.packages?.[0]?.packageName).toBe("@beep/schema");
        expect(A.map(decoded.packages?.[0]?.subjects ?? [], (subject) => subject.exportName)).toContain("parseValue");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect("renders consolidated quality reports and Codex remediation packets", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument125 = path.join(tmpDir, "package.json");
      const encodedJson126 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument125, encodedJson126);
      const argument126 = path.join(tmpDir, "tsconfig.json");
      const encodedJson127 = yield* encodeJson({
        compilerOptions: {
          module: "es2022",
          target: "es2022",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
        },
        include: ["packages/**/*.ts"],
      });
      yield* fs.writeFileString(argument126, encodedJson127);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument127 = path.join(packageDir, "package.json");
      const encodedJson128 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument127, encodedJson128);
      const argument128 = path.join(packageDir, "docgen.json");
      const encodedJson129 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument128, encodedJson129);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Missing example fixture.
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const report = yield* analyzeDocgenQuality({
        scope: "package",
        scoreMode: "codex",
        targets: [target!],
      });
      const deterministicReport = yield* analyzeDocgenQuality({
        scope: "package",
        scoreMode: "none",
        targets: [target!],
      });
      const markdown = generateQualityReport(report);
      const json = yield* generateQualityJson(report);
      const decoded = (yield* decodeUnknownJson(json)) as Record<string, unknown>;

      expect(report.scorer).toBe("codex-advisory-packet-v1");
      expect(report.summary.failures).toBeGreaterThan(0);
      expect(report.packages[0]?.summary.remediationPackets).toBeGreaterThan(0);
      expect(report.remediationPackets[0]?.prompt).toContain("Keep @example mandatory");
      expect(report.remediationPackets[0]?.verificationArgv).toEqual([
        "bun",
        "run",
        "beep",
        "docgen",
        "quality",
        "-p",
        "packages/foundation/modeling/schema",
        "--json",
      ]);
      expect(deterministicReport.scorer).toBe("deterministic-rubric-v1");
      expect(deterministicReport.summary.remediationPackets).toBe(0);
      expect(deterministicReport.remediationPackets).toHaveLength(0);
      expect(markdown).toContain("# JSDoc Quality Report");
      expect(markdown).toContain("## @beep/schema");
      expect(markdown).toContain("Improve the JSDoc block for this exported symbol");
      expect(decoded.schemaVersion).toBe(2);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("caps and ranks Codex remediation packets for broad quality reports", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument129 = path.join(tmpDir, "package.json");
      const encodedJson130 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument129, encodedJson130);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument130 = path.join(packageDir, "package.json");
      const encodedJson131 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument130, encodedJson131);
      const argument131 = path.join(packageDir, "docgen.json");
      const encodedJson132 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument131, encodedJson132);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        A.join(
          A.map(
            A.range(1, 30),
            (index) => `/**
 * Missing example fixture ${index}.
 *
 * @category parsing
 * @since 0.0.0
 */
export const value${index} = ${index};
`
          ),
          "\n"
        )
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const defaultReport = yield* analyzeDocgenQuality({
        scope: "package",
        scoreMode: "codex",
        targets: [target!],
      });
      const limitedReport = yield* analyzeDocgenQuality({
        packetLimit: 2,
        scope: "package",
        scoreMode: "codex",
        targets: [target!],
      });
      const suppressedReport = yield* analyzeDocgenQuality({
        packetLimit: 0,
        scope: "package",
        scoreMode: "codex",
        targets: [target!],
      });

      expect(defaultReport.remediationPackets).toHaveLength(25);
      expect(defaultReport.packages[0]?.omittedPacketCount).toBe(5);
      expect(limitedReport.remediationPackets).toHaveLength(2);
      expect(limitedReport.packages[0]?.summary.remediationPackets).toBe(2);
      expect(limitedReport.packages[0]?.omittedPacketCount).toBe(28);
      expect(suppressedReport.remediationPackets).toHaveLength(0);
      expect(suppressedReport.packages[0]?.omittedPacketCount).toBe(30);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect(
    "wires --packet-limit through the quality CLI",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument132 = path.join(tmpDir, "package.json");
        const encodedJson133 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument132, encodedJson133);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        const outputPath = path.join(tmpDir, "quality.json");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument133 = path.join(packageDir, "package.json");
        const encodedJson134 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
        });
        yield* fs.writeFileString(argument133, encodedJson134);
        const argument134 = path.join(packageDir, "docgen.json");
        const encodedJson135 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument134, encodedJson135);
        yield* fs.writeFileString(
          path.join(packageDir, "src", "index.ts"),
          A.join(
            A.map(
              A.range(1, 5),
              (index) => `/**
 * Missing example CLI fixture ${index}.
 *
 * @category parsing
 * @since 0.0.0
 */
export const cliValue${index} = ${index};
`
            ),
            "\n"
          )
        );

        yield* runDocgenCommand([
          "quality",
          "-p",
          "packages/foundation/modeling/schema",
          "--json",
          "--score",
          "codex",
          "--packet-limit",
          "2",
          "--output",
          outputPath,
        ]);

        const readFileString14 = yield* fs.readFileString(outputPath);
        const decoded = (yield* decodeUnknownJson(readFileString14)) as {
          readonly packages?: ReadonlyArray<{
            readonly omittedPacketCount?: unknown;
            readonly summary?: { readonly remediationPackets?: unknown };
          }>;
          readonly remediationPackets?: ReadonlyArray<unknown>;
        };

        expect(decoded.remediationPackets).toHaveLength(2);
        expect(decoded.packages?.[0]?.summary?.remediationPackets).toBe(2);
        expect(decoded.packages?.[0]?.omittedPacketCount).toBe(3);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "rejects negative --packet-limit values",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument135 = path.join(tmpDir, "package.json");
        const encodedJson136 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument135, encodedJson136);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument136 = path.join(packageDir, "package.json");
        const encodedJson137 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
        });
        yield* fs.writeFileString(argument136, encodedJson137);
        const argument137 = path.join(packageDir, "docgen.json");
        const encodedJson138 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument137, encodedJson138);
        yield* fs.writeFileString(
          path.join(packageDir, "src", "index.ts"),
          `/**
 * Parses a value into the normalized schema fixture.
 *
 * @example
 * \`\`\`ts
 * import { parseValue } from "@beep/schema"
 *
 * console.log(parseValue(" hello "))
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
        );

        const exit = yield* Effect.exit(
          runDocgenCommand(["quality", "-p", "packages/foundation/modeling/schema", "--packet-limit=-1"])
        );

        const errorLines15 = yield* TestConsole.errorLines;
        expect(A.join(A.filter(errorLines15, isString), "\n")).toContain("--packet-limit must be zero or greater");
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect("fails analysis when a package-local docgen.json is malformed", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument138 = path.join(tmpDir, "package.json");
      const encodedJson139 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument138, encodedJson139);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument139 = path.join(packageDir, "package.json");
      const encodedJson140 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument139, encodedJson140);
      yield* fs.writeFileString(path.join(packageDir, "docgen.json"), "{ invalid");

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const exit = yield* analyzePackageDocumentation(target!).pipe(Effect.exit);

      assertTrue(exit._tag === "Failure");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect(
    "checks docgen metadata without writing analysis files",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument140 = path.join(tmpDir, "package.json");
        const encodedJson141 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument140, encodedJson141);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument141 = path.join(packageDir, "package.json");
        const encodedJson142 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
        });
        yield* fs.writeFileString(argument141, encodedJson142);
        const argument142 = path.join(packageDir, "docgen.json");
        const encodedJson143 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument142, encodedJson143);
        yield* fs.writeFileString(path.join(packageDir, "src", "index.ts"), `export const MissingMetadata = "nope";\n`);

        const exit = yield* Effect.exit(runDocgenCommand(["check", "-p", "packages/foundation/modeling/schema"]));

        const errorLines16 = yield* TestConsole.errorLines;
        const errorLines = A.filter(errorLines16, isString);
        const wroteMarkdown = yield* fs.exists(path.join(packageDir, "JSDOC_ANALYSIS.md"));
        const wroteJson = yield* fs.exists(path.join(packageDir, "JSDOC_ANALYSIS.json"));

        expect(A.join(errorLines, "\n")).toContain("packages/foundation/modeling/schema has");
        expect(A.join(errorLines, "\n")).toContain("<module fileoverview> missing @since");
        expect(A.join(errorLines, "\n")).toContain("MissingMetadata missing @category, @since");
        expect(wroteMarkdown).toBe(false);
        expect(wroteJson).toBe(false);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "checks every package named by repeated --package flags in the given order",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("identity", "@beep/identity", documentedCheckSource);
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        yield* runDocgenCommand([
          "check",
          "-p",
          "packages/foundation/modeling/schema",
          "--package",
          "packages/foundation/modeling/identity",
        ]);

        const logLines17 = yield* TestConsole.logLines;
        expect(A.filter(logLines17, isString)).toEqual([
          "docgen: OK packages/foundation/modeling/schema",
          "docgen: OK packages/foundation/modeling/identity",
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "fails docgen check when a later repeated --package target is missing metadata",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("identity", "@beep/identity", undocumentedCheckSource);
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        const exit = yield* Effect.exit(
          runDocgenCommand(["check", "--package", "@beep/schema", "--package", "@beep/identity"])
        );

        const errorLines18 = yield* TestConsole.errorLines;
        const errorText = A.join(A.filter(errorLines18, isString), "\n");
        const logLines19 = yield* TestConsole.logLines;
        expect(A.filter(logLines19, isString)).toEqual(["docgen: OK packages/foundation/modeling/schema"]);
        expect(errorText).toContain("packages/foundation/modeling/identity has 2 export(s) missing docgen metadata");
        expect(errorText).toContain("MissingMetadata missing @category, @since");
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "checks a single --package target",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("identity", "@beep/identity", undocumentedCheckSource);
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        yield* runDocgenCommand(["check", "--package", "@beep/schema"]);

        const logLines20 = yield* TestConsole.logLines;
        expect(A.filter(logLines20, isString)).toEqual(["docgen: OK packages/foundation/modeling/schema"]);
        const errorLines21 = yield* TestConsole.errorLines;
        expect(errorLines21).toEqual([]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "rejects repeated --package flags on single-package docgen subcommands",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("identity", "@beep/identity", documentedCheckSource);
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        const exit = yield* Effect.exit(
          runDocgenCommand(["analyze", "--package", "@beep/schema", "--package", "@beep/identity", "--json"])
        );

        assertTrue(exit._tag === "Failure");
        const errorLines22 = yield* TestConsole.errorLines;
        expect(A.join(A.filter(errorLines22, isString), "\n")).toContain(
          'Invalid value for flag --package: "2 occurrences". Expected: at most 1 value'
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "rejects repeated --package flags on docgen init",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("identity", "@beep/identity", documentedCheckSource);
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        const exit = yield* Effect.exit(
          runDocgenCommand(["init", "--package", "@beep/schema", "--package", "@beep/identity", "--dry-run"])
        );

        assertTrue(exit._tag === "Failure");
        const errorLines23 = yield* TestConsole.errorLines;
        expect(A.join(A.filter(errorLines23, isString), "\n")).toContain(
          'Invalid value for flag --package: "2 occurrences". Expected: at most 1 value'
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "checks every configured package when docgen check has no --package flag",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("identity", "@beep/identity", documentedCheckSource);
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);
        yield* seedUnconfiguredCheckPackage("utils", "@beep/utils");

        yield* runDocgenCommand(["check"]);

        const logLines24 = yield* TestConsole.logLines;
        expect(A.filter(logLines24, isString)).toEqual([
          "docgen: OK packages/foundation/modeling/identity",
          "docgen: OK packages/foundation/modeling/schema",
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "checks a package once when repeated --package flags name it twice",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        yield* runDocgenCommand(["check", "-p", "@beep/schema", "-p", "packages/foundation/modeling/schema"]);

        const logLines25 = yield* TestConsole.logLines;
        expect(A.filter(logLines25, isString)).toEqual(["docgen: OK packages/foundation/modeling/schema"]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "fails docgen check when a repeated --package selector names no workspace package",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        const exit = yield* Effect.exit(runDocgenCommand(["check", "-p", "@beep/schema", "-p", "@beep/missing"]));

        const logLines26 = yield* TestConsole.logLines;
        expect(logLines26).toEqual([]);
        const errorLines27 = yield* TestConsole.errorLines;
        expect(errorLines27).toEqual([
          'docgen: Could not resolve workspace package "@beep/missing". Use a package name like "@beep/schema" or a repo-relative path like "packages/foundation/modeling/schema".',
        ]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "generates every package named by repeated --package flags in the given order",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("identity", "@beep/identity", documentedCheckSource);
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        const exit = yield* Effect.exit(
          runDocgenCommand(["generate", "-p", "@beep/schema", "-p", "@beep/identity", "--json"])
        );

        const logLines28 = yield* TestConsole.logLines;
        const decoded = (yield* decodeUnknownJson(A.join(A.filter(logLines28, isString), "\n"))) as ReadonlyArray<{
          readonly packagePath?: string;
          readonly success?: boolean;
        }>;

        expect(A.map(decoded, (result) => result.packagePath)).toEqual([
          "packages/foundation/modeling/schema",
          "packages/foundation/modeling/identity",
        ]);
        expect(A.map(decoded, (result) => result.success)).toEqual([false, false]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "fails generate when a later repeated --package target is missing docgen.json",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);
        yield* seedUnconfiguredCheckPackage("utils", "@beep/utils");

        const exit = yield* Effect.exit(runDocgenCommand(["generate", "-p", "@beep/schema", "-p", "@beep/utils"]));

        const errorLines29 = yield* TestConsole.errorLines;
        expect(errorLines29).toEqual([
          'docgen: packages/foundation/modeling/utils is missing docgen.json. Run "bun run beep docgen init -p packages/foundation/modeling/utils" first.',
        ]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "reports no configured packages when generate has no selector",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedUnconfiguredCheckPackage("utils", "@beep/utils");

        yield* runDocgenCommand(["generate"]);

        const logLines30 = yield* TestConsole.logLines;
        expect(logLines30).toEqual(["docgen: no configured packages found"]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "rejects a --filter that conflicts with a later repeated --package flag on generate",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;

        const exit = yield* Effect.exit(
          runDocgenCommand(["generate", "-p", "@beep/schema", "-p", "@beep/identity", "--filter", "@beep/schema"])
        );

        const errorLines31 = yield* TestConsole.errorLines;
        expect(errorLines31).toEqual([
          "docgen: Received conflicting selectors --package=@beep/identity and --filter=@beep/schema.",
        ]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "rejects conflicting selector flags for run",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;

        const exit = yield* Effect.exit(
          runDocgenCommand(["run", "--package", "@beep/schema", "--filter", "@beep/utils"])
        );

        const errorLines32 = yield* TestConsole.errorLines;
        expect(errorLines32).toEqual([
          "docgen: Received conflicting selectors --package=@beep/schema and --filter=@beep/utils.",
        ]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "aggregates the --filter selector when it matches --package",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        const exit = yield* Effect.exit(
          runDocgenCommand(["aggregate", "--package", "@beep/schema", "--filter", "@beep/schema"])
        );

        const errorLines33 = yield* TestConsole.errorLines;
        expect(errorLines33).toEqual([
          'docgen: Package "@beep/schema" does not have generated docs. Run "bun run beep docgen generate -p packages/foundation/modeling/schema" first.',
        ]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "aggregates every package when aggregate has no selector",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* seedCheckWorkspace;
        yield* seedCheckPackage("schema", "@beep/schema", documentedCheckSource);

        yield* runDocgenCommand(["aggregate"]);

        const logLines34 = yield* TestConsole.logLines;
        expect(logLines34).toEqual(["docgen: no generated package docs found to aggregate"]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "skips current proof manifests during docgen check",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument143 = path.join(tmpDir, "package.json");
        const encodedJson144 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument143, encodedJson144);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        const srcPath = path.join(packageDir, "src", "index.ts");
        const docsPath = path.join(packageDir, "docs", "modules", "Schema.md");
        yield* fs.makeDirectory(path.dirname(srcPath), { recursive: true });
        yield* fs.makeDirectory(path.dirname(docsPath), { recursive: true });
        const argument144 = path.join(packageDir, "package.json");
        const encodedJson145 = yield* encodeJson({ name: "@beep/schema" });
        yield* fs.writeFileString(argument144, encodedJson145);
        const argument145 = path.join(packageDir, "docgen.json");
        const encodedJson146 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument145, encodedJson146);
        yield* fs.writeFileString(
          srcPath,
          `/**
 * Package docs.
 *
 * @packageDocumentation
 * @category schemas
 * @since 0.0.0
 */

/**
 * Current proof fixture.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProofFixture = 1;
`
        );
        yield* fs.writeFileString(docsPath, "---\ntitle: Schema\n---\n\n# Schema\n");
        const argument146 = Effect.succeed([]);
        const argument147 = Effect.succeed(packageDir);
        const HostProcessPlatform147 = yield* HostProcessPlatform;
        const packageProcess = Process.of({
          argv: argument146,
          cwd: argument147,
          platform: Effect.succeed(HostProcessPlatform147),
        });
        const packageConfiguration = Configuration.of(
          ConfigurationShape.make({
            enableSearch: true,
            enforceDescriptions: false,
            enforceExamples: false,
            enforceVersion: true,
            examplesCompilerOptions: defaultCompilerOptions,
            include: [],
            exclude: [],
            outDir: "docs",
            parseCompilerOptions: defaultCompilerOptions,
            projectHomepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema",
            projectName: "@beep/schema",
            srcDir: "src",
            srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema/src/",
            theme: DEFAULT_THEME,
            tscExecutable: "tsc",
          })
        );

        yield* writeDocgenProofManifest().pipe(
          Effect.provideService(Configuration, packageConfiguration),
          Effect.provideService(Process, packageProcess)
        );
        yield* runDocgenCommand([
          "check",
          "-p",
          "packages/foundation/modeling/schema",
          "--reuse-proof-manifest",
          "--json",
        ]);

        const logLines35 = yield* TestConsole.logLines;
        const output = A.join(A.filter(logLines35, isString), "\n");
        const decoded = (yield* decodeUnknownJson(output)) as {
          readonly analyses?: ReadonlyArray<unknown>;
          readonly proofManifests?: ReadonlyArray<{ readonly status?: string }>;
          readonly summary?: {
            readonly analyzedPackages?: number;
            readonly failingPackages?: number;
            readonly packages?: number;
            readonly skippedByProofManifest?: number;
          };
        };

        expect(decoded.analyses).toHaveLength(0);
        expect(decoded.proofManifests?.[0]?.status).toBe("current");
        expect(decoded.summary).toMatchObject({
          analyzedPackages: 0,
          failingPackages: 0,
          packages: 1,
          skippedByProofManifest: 1,
        });
      }).pipe(
        Effect.provideService(HostProcessPlatform, currentHostPlatform),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      ),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "checks rejected category values without writing analysis files",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument148 = path.join(tmpDir, "package.json");
        const encodedJson148 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument148, encodedJson148);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument149 = path.join(packageDir, "package.json");
        const encodedJson149 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
        });
        yield* fs.writeFileString(argument149, encodedJson149);
        const argument150 = path.join(packageDir, "docgen.json");
        const encodedJson150 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument150, encodedJson150);
        yield* fs.writeFileString(
          path.join(packageDir, "src", "index.ts"),
          `/**
 * Package docs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Rejected category fixture.
 *
 * @category exports
 * @since 0.0.0
 */
export const RejectedCategory = "nope";
`
        );

        const exit = yield* Effect.exit(runDocgenCommand(["check", "-p", "packages/foundation/modeling/schema"]));

        const errorLines36 = yield* TestConsole.errorLines;
        const errorText = A.join(A.filter(errorLines36, isString), "\n");
        const wroteMarkdown = yield* fs.exists(path.join(packageDir, "JSDOC_ANALYSIS.md"));
        const wroteJson = yield* fs.exists(path.join(packageDir, "JSDOC_ANALYSIS.json"));

        expect(errorText).toContain("packages/foundation/modeling/schema has");
        expect(errorText).toContain("RejectedCategory invalid category: Re-exports are graph edges");
        expect(errorText).not.toContain("RejectedCategory missing");
        expect(wroteMarkdown).toBe(false);
        expect(wroteJson).toBe(false);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect(
    "checks required tags on the owning JSDoc block instead of adjacent blocks",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument151 = path.join(tmpDir, "package.json");
        const encodedJson151 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument151, encodedJson151);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument152 = path.join(packageDir, "package.json");
        const encodedJson152 = yield* encodeJson({ name: "@beep/schema" });
        yield* fs.writeFileString(argument152, encodedJson152);
        const argument153 = path.join(packageDir, "docgen.json");
        const encodedJson153 = yield* encodeJson({ srcDir: "src", enforceExamples: true });
        yield* fs.writeFileString(argument153, encodedJson153);
        yield* fs.writeFileString(
          path.join(packageDir, "src", "index.ts"),
          `/**
 * Stale adjacent docs with an example.
 *
 * @example
 * \`\`\`ts
 * import { parseValue } from "@beep/schema"
 * console.log(parseValue("hello"))
 * \`\`\`
 * @category parsing
 * @since 0.0.0
 */
/**
 * Owning docs without an example.
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
        );

        const exit = yield* Effect.exit(runDocgenCommand(["check", "-p", "packages/foundation/modeling/schema"]));
        const errorLines37 = yield* TestConsole.errorLines;
        const errorText = A.join(A.filter(errorLines37, isString), "\n");

        expect(errorText).toContain("parseValue missing @example");
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect(
    "writes report-only quality JSON without failing the command",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument154 = path.join(tmpDir, "package.json");
        const encodedJson154 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument154, encodedJson154);
        const argument155 = path.join(tmpDir, "tsconfig.json");
        const encodedJson155 = yield* encodeJson({
          compilerOptions: {
            module: "es2022",
            target: "es2022",
            moduleResolution: "bundler",
            strict: true,
            noEmit: true,
          },
          include: ["packages/**/*.ts"],
        });
        yield* fs.writeFileString(argument155, encodedJson155);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        const outputPath = path.join(tmpDir, "quality.json");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument156 = path.join(packageDir, "package.json");
        const encodedJson156 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
        });
        yield* fs.writeFileString(argument156, encodedJson156);
        const argument157 = path.join(packageDir, "docgen.json");
        const encodedJson157 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument157, encodedJson157);
        yield* fs.writeFileString(
          path.join(packageDir, "src", "index.ts"),
          `/**
 * Missing example fixture.
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
        );

        yield* runDocgenCommand([
          "quality",
          "-p",
          "packages/foundation/modeling/schema",
          "--json",
          "--score",
          "codex",
          "-o",
          outputPath,
        ]);

        const output = yield* fs.readFileString(outputPath);
        const decoded = (yield* decodeUnknownJson(output)) as {
          readonly schemaVersion?: unknown;
          readonly scorer?: unknown;
          readonly remediationPackets?: ReadonlyArray<{ readonly prompt?: string }>;
        };
        const logLines38 = yield* TestConsole.logLines;
        const logText = A.join(A.filter(logLines38, isString), "\n");

        expect(decoded.schemaVersion).toBe(2);
        expect(decoded.scorer).toBe("codex-advisory-packet-v1");
        expect(decoded.remediationPackets?.[0]?.prompt).toContain("Keep @example mandatory");
        expect(logText).toContain("docgen: wrote");
        expect(process.exitCode ?? 0).toBe(0);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect(
    "fails quality check mode when findings are present",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument158 = path.join(tmpDir, "package.json");
        const encodedJson158 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument158, encodedJson158);
        const argument159 = path.join(tmpDir, "tsconfig.json");
        const encodedJson159 = yield* encodeJson({
          compilerOptions: {
            module: "es2022",
            target: "es2022",
            moduleResolution: "bundler",
            strict: true,
            noEmit: true,
          },
          include: ["packages/**/*.ts"],
        });
        yield* fs.writeFileString(argument159, encodedJson159);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        const outputPath = path.join(tmpDir, "quality.json");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument160 = path.join(packageDir, "package.json");
        const encodedJson160 = yield* encodeJson({ name: "@beep/schema" });
        yield* fs.writeFileString(argument160, encodedJson160);
        const argument161 = path.join(packageDir, "docgen.json");
        const encodedJson161 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument161, encodedJson161);
        yield* fs.writeFileString(
          path.join(packageDir, "src", "index.ts"),
          `/**
 * Missing example fixture.
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
        );

        const exit = yield* Effect.exit(
          runDocgenCommand([
            "quality",
            "-p",
            "packages/foundation/modeling/schema",
            "--json",
            "--check",
            "--packet-limit",
            "0",
            "-o",
            outputPath,
          ])
        );
        const outputExists = yield* fs.exists(outputPath);

        expect(outputExists).toBe(true);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect(
    "fails quality check mode when only warnings are present",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument162 = path.join(tmpDir, "package.json");
        const encodedJson162 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument162, encodedJson162);
        const argument163 = path.join(tmpDir, "tsconfig.json");
        const encodedJson163 = yield* encodeJson({
          compilerOptions: {
            module: "es2022",
            target: "es2022",
            moduleResolution: "bundler",
            strict: true,
            noEmit: true,
          },
          include: ["packages/**/*.ts"],
        });
        yield* fs.writeFileString(argument163, encodedJson163);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        const outputPath = path.join(tmpDir, "quality.json");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument164 = path.join(packageDir, "package.json");
        const encodedJson164 = yield* encodeJson({ name: "@beep/schema" });
        yield* fs.writeFileString(argument164, encodedJson164);
        const argument165 = path.join(packageDir, "docgen.json");
        const encodedJson165 = yield* encodeJson({ srcDir: "src" });
        yield* fs.writeFileString(argument165, encodedJson165);
        yield* fs.writeFileString(
          path.join(packageDir, "src", "index.ts"),
          `/**
 * Warning-only fixture.
 *
 * @example
 * \`\`\`ts
 * console.log("parseValue")
 * \`\`\`
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
        );

        const exit = yield* Effect.exit(
          runDocgenCommand([
            "quality",
            "-p",
            "packages/foundation/modeling/schema",
            "--json",
            "--check",
            "--packet-limit",
            "0",
            "-o",
            outputPath,
          ])
        );
        const readFileString39 = yield* fs.readFileString(outputPath);
        const output = (yield* decodeUnknownJson(readFileString39)) as {
          readonly summary?: { readonly warnings?: number; readonly failures?: number };
        };

        expect(output.summary?.warnings).toBeGreaterThan(0);
        expect(output.summary?.failures).toBe(0);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect("flags rejected category values during analysis", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument166 = path.join(tmpDir, "package.json");
      const encodedJson166 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument166, encodedJson166);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument167 = path.join(packageDir, "package.json");
      const encodedJson167 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument167, encodedJson167);
      const argument168 = path.join(packageDir, "docgen.json");
      const encodedJson168 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument168, encodedJson168);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Package docs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Rejected category fixture.
 *
 * @category exports
 * @since 0.0.0
 */
export const RejectedCategory = "nope";
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const analysis = yield* analyzePackageDocumentation(target!);
      const rejected = O.getOrUndefined(A.findFirst(analysis.exports, (entry) => entry.name === "RejectedCategory"));

      expect(rejected?.missingTags).toEqual([]);
      expect(rejected?.categoryValues).toEqual(["exports"]);
      expect(A.join(rejected?.categoryIssues ?? [], "\n")).toContain("Re-exports are graph edges");
      expect(analysis.summary.invalidCategory).toBe(1);
      expect(analysis.summary.missingDocumentation).toBe(1);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("flags rejected category values on module fileoverview during analysis", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const argument169 = path.join(tmpDir, "package.json");
      const encodedJson169 = yield* encodeJson({
        name: "@beep/test-root",
        private: true,
        workspaces: ["packages/foundation/*/*"],
      });
      yield* fs.writeFileString(argument169, encodedJson169);

      const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
      yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
      const argument170 = path.join(packageDir, "package.json");
      const encodedJson170 = yield* encodeJson({
        name: "@beep/schema",
        version: "0.0.0",
      });
      yield* fs.writeFileString(argument170, encodedJson170);
      const argument171 = path.join(packageDir, "docgen.json");
      const encodedJson171 = yield* encodeJson({ srcDir: "src" });
      yield* fs.writeFileString(argument171, encodedJson171);
      yield* fs.writeFileString(
        path.join(packageDir, "src", "index.ts"),
        `/**
 * Package docs.
 *
 * @packageDocumentation
 * @category exports
 * @since 0.0.0
 */

const packageDocAnchor = true;

/**
 * Valid export fixture.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidExport = packageDocAnchor;
`
      );

      const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
      const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

      expect(target).toBeDefined();

      const analysis = yield* analyzePackageDocumentation(target!);
      const fileoverview = O.getOrUndefined(
        A.findFirst(analysis.exports, (entry) => entry.name === "<module fileoverview>")
      );

      expect(fileoverview?.missingTags).toEqual([]);
      expect(fileoverview?.categoryValues).toEqual(["exports"]);
      expect(A.join(fileoverview?.categoryIssues ?? [], "\n")).toContain("Re-exports are graph edges");
      expect(analysis.summary.invalidCategory).toBe(1);
      expect(analysis.summary.missingDocumentation).toBe(1);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect(
    "returns a non-zero exit code when generate targets an unconfigured package",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument172 = path.join(tmpDir, "package.json");
        const encodedJson172 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument172, encodedJson172);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument173 = path.join(packageDir, "package.json");
        const encodedJson173 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
        });
        yield* fs.writeFileString(argument173, encodedJson173);

        const exit = yield* Effect.exit(runDocgenCommand(["generate", "-p", "packages/foundation/modeling/schema"]));

        const errorLines = yield* TestConsole.errorLines;

        expect(errorLines).toEqual([
          'docgen: packages/foundation/modeling/schema is missing docgen.json. Run "bun run beep docgen init -p packages/foundation/modeling/schema" first.',
        ]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect(
    "accepts --filter for generate and resolves it like --package",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument174 = path.join(tmpDir, "package.json");
        const encodedJson174 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument174, encodedJson174);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument175 = path.join(packageDir, "package.json");
        const encodedJson175 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
        });
        yield* fs.writeFileString(argument175, encodedJson175);

        const exit = yield* Effect.exit(
          runDocgenCommand(["generate", "--filter", "packages/foundation/modeling/schema"])
        );

        const errorLines = yield* TestConsole.errorLines;

        expect(errorLines).toEqual([
          'docgen: packages/foundation/modeling/schema is missing docgen.json. Run "bun run beep docgen init -p packages/foundation/modeling/schema" first.',
        ]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    }
  );

  it.effect(
    "rejects conflicting selector flags for generate",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();
        const argument176 = path.join(tmpDir, "package.json");
        const encodedJson176 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument176, encodedJson176);

        const exit = yield* Effect.exit(
          runDocgenCommand(["generate", "--package", "packages/foundation/modeling/schema", "--filter", "@beep/schema"])
        );

        const errorLines = yield* TestConsole.errorLines;

        expect(errorLines).toEqual([
          "docgen: Received conflicting selectors --package=packages/foundation/modeling/schema and --filter=@beep/schema.",
        ]);
        expectReportedExit(exit);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect(
    "writes lint-clean docgen.json during init",
    () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = process.cwd();

        const argument177 = path.join(tmpDir, "package.json");
        const encodedJson177 = yield* encodeJson({
          name: "@beep/test-root",
          private: true,
          workspaces: ["packages/foundation/*/*"],
        });
        yield* fs.writeFileString(argument177, encodedJson177);

        const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
        const docgenPath = path.join(packageDir, "docgen.json");
        yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
        const argument178 = path.join(packageDir, "package.json");
        const encodedJson178 = yield* encodeJson({
          name: "@beep/schema",
          version: "0.0.0",
          exports: {
            ".": "./src/index.ts",
            "./*": "./src/*.ts",
          },
        });
        yield* fs.writeFileString(argument178, encodedJson178);

        yield* runDocgenCommand(["init", "-p", "packages/foundation/modeling/schema"]);

        const docgenText = yield* fs.readFileString(docgenPath);
        const docgenConfig = (yield* decodeUnknownJson(docgenText)) as {
          readonly examplesCompilerOptions?: Record<string, unknown>;
        };

        expect(docgenText).toContain('"exclude": ["src/internal/**/*.ts"],');
        expect(docgenText).toContain('"lib": ["ESNext", "DOM", "DOM.Iterable"],');
        expect(docgenConfig.examplesCompilerOptions).not.toHaveProperty("paths");
        expect(process.exitCode ?? 0).toBe(0);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
    { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }
  );

  it.effect("previews selected doctest rewrites as a schema-valid JSON report without writing", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { srcDir } = yield* writeDoctestCommandFixtureRepo();
      const sourcePath = path.join(srcDir, "console-rewrites.ts");
      const before = yield* fs.readFileString(sourcePath);

      yield* runDocgenCommand([
        "doctest",
        "mark",
        "--filter",
        "@beep/doctest-fixture",
        "--include",
        `${DOCTEST_FIXTURE_PACKAGE}/src/console-rewrites.ts`,
        "--json",
      ]);

      const logLines40 = yield* TestConsole.logLines;
      const output = A.join(A.filter(logLines40, isString), "\n");
      const report = yield* decodeDoctestReport(output);
      expect(report.config).toMatchObject({
        filter: "@beep/doctest-fixture",
        include: [`${DOCTEST_FIXTURE_PACKAGE}/src/console-rewrites.ts`],
        json: true,
        write: false,
      });
      expect(report.counts.files).toBe(1);
      expect(report.counts.plannedConsoleRewrites).toBe(1);
      expect(report.changedFiles).toEqual([`${DOCTEST_FIXTURE_PACKAGE}/src/console-rewrites.ts`]);
      const readFileString41 = yield* fs.readFileString(sourcePath);
      expect(readFileString41).toBe(before);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("resolves a filtered Doctest include relative to the selected package src directory", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      yield* writeDoctestCommandFixtureRepo();

      yield* runDocgenCommand([
        "doctest",
        "mark",
        "--filter",
        "@beep/doctest-fixture",
        "--include",
        "console-rewrites.ts",
        "--json",
      ]);

      const logLines42 = yield* TestConsole.logLines;
      const output = A.join(A.filter(logLines42, isString), "\n");
      const report = yield* decodeDoctestReport(output);
      expect(report.config.include).toEqual(["console-rewrites.ts"]);
      expect(report.counts.files).toBe(1);
      expect(report.changedFiles).toEqual([`${DOCTEST_FIXTURE_PACKAGE}/src/console-rewrites.ts`]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("writes canonical doctest markers and renders the human summary", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { srcDir } = yield* writeDoctestCommandFixtureRepo();
      const sourcePath = path.join(srcDir, "markers.ts");

      yield* runDocgenCommand([
        "doctest",
        "mark",
        "--write",
        "--filter",
        "@beep/doctest-fixture",
        "--include",
        `${DOCTEST_FIXTURE_PACKAGE}/src/markers.ts`,
      ]);

      const rewritten = yield* fs.readFileString(sourcePath);
      const logLines43 = yield* TestConsole.logLines;
      const output = A.join(A.filter(logLines43, isString), "\n");
      expect(rewritten).toContain('```ts import.meta.vitest name="Marker fixtures"');
      expect(output).toContain("doctest: 1 file(s), 3 fence(s)");
      expect(output).toContain("missing-example-title");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("keeps pure-unmarked doctest findings warning-only", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      yield* writeDoctestCommandFixtureRepo();
      yield* runDocgenCommand(["doctest", "verify", "--include", `${DOCTEST_FIXTURE_PACKAGE}/src/purity.ts`]);

      const logLines44 = yield* TestConsole.logLines;
      const output = A.join(A.filter(logLines44, isString), "\n");
      expect(output).toContain("pure-unmarked");
      const errorLines45 = yield* TestConsole.errorLines;
      expect(errorLines45).toEqual([]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("returns a reported error exit for blocking doctest findings after rendering JSON", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      yield* writeDoctestCommandFixtureRepo();
      const exit = yield* Effect.exit(
        runDocgenCommand([
          "doctest",
          "verify",
          "--filter",
          "@beep/doctest-fixture",
          "--include",
          `${DOCTEST_FIXTURE_PACKAGE}/src/markers.ts`,
          "--json",
        ])
      );

      const logLines46 = yield* TestConsole.logLines;
      const output = A.join(A.filter(logLines46, isString), "\n");
      const report = yield* decodeDoctestReport(output);
      expect(A.map(report.findings, (finding) => finding.kind)).toContain("missing-example-title");
      const errorLines47 = yield* TestConsole.errorLines;
      expect(A.join(A.filter(errorLines47, isString), "\n")).toContain(
        "Doctest verification found 2 blocking finding(s)."
      );
      expectReportedExit(exit);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("reports an invalid doctest mark preview through the rewrite error boundary", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      yield* writeDoctestCommandFixtureRepo();
      const exit = yield* Effect.exit(
        runDocgenCommand(["doctest", "mark", "--include", `${DOCTEST_FIXTURE_PACKAGE}/src/assertions.ts`])
      );

      const errorLines48 = yield* TestConsole.errorLines;
      expect(A.join(A.filter(errorLines48, isString), "\n")).toContain(
        "Rewritten fence failed upstream doctest transform validation."
      );
      expectReportedExit(exit);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
});

describe("getDeclaredJsDocs", () => {
  it("reads a JSDoc-able node's own blocks, a variable's statement blocks, and none elsewhere", () => {
    const file = new Project({ useInMemoryFileSystem: true }).createSourceFile(
      "a.ts",
      A.join(
        [
          "/** A function. */",
          "export function run() {}",
          "/** A value. */",
          "export const answer = 42",
          "export const items: ReadonlyArray<number> = []",
          "for (const item of items) { void item }",
        ],
        "\n"
      )
    );
    expect(A.map(getDeclaredJsDocs(file.getFunctionOrThrow("run")), (doc) => Str.trim(doc.getDescription()))).toEqual([
      "A function.",
    ]);
    expect(
      A.map(getDeclaredJsDocs(file.getVariableDeclarationOrThrow("answer")), (doc) => Str.trim(doc.getDescription()))
    ).toEqual(["A value."]);
    // A `for (const item of ...)` declaration sits in a declaration list without a statement: no blocks.
    const forOf = file.getStatements()[3];
    expect(forOf?.getKindName()).toBe("ForOfStatement");
    const declaration = forOf?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)[0];
    expect(declaration).toBeDefined();
    if (declaration !== undefined) expect(getDeclaredJsDocs(declaration)).toEqual([]);
  });
});
