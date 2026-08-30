import { docgenCommand } from "@beep/repo-cli/commands/Docgen";
import {
  aggregateGeneratedDocs,
  analyzeDocgenQuality,
  analyzeDocgenQualityWorkerEval,
  analyzePackageDocumentation,
  analyzePackageQuality,
  buildDocgenLocalPlan,
  createDocgenConfigDocument,
  DocgenAnalysisSummary,
  DocgenConfigDocument,
  DocgenExportAnalysis,
  DocgenLocalSelectedPackage,
  DocgenPackageAnalysis,
  DocgenQualityWorkerEvalReport,
  DoctestReport,
  discoverDocgenWorkspacePackages,
  discoverOrphanDocgenConfigPaths,
  docgenLocalFullReasonsForTesting,
  docgenLocalTurboArgsForTesting,
  generateAnalysisReport,
  generateQualityJson,
  generateQualityReport,
  generateQualityWorkerEvalJson,
  loadDocgenConfigDocument,
  makeQualityWorkerRunpodEvalPodCreateInput,
  requiredQualityWorkerRunpodEvalModel,
  runDocgenLocal,
  runDocgenQualityWorkerRunpodEval,
  selectDirectDocgenPackagesForTesting,
  selectDocgenLocalPackagesForTesting,
  selectQualityWorkerRunpodTemplate,
} from "@beep/repo-cli/test/Docgen";
import {
  readTurboCacheEnvironment,
  resolveTurboCachePlan,
  turboCachePlanArgs,
} from "@beep/repo-cli/test/SharedInternals";
import { Configuration, DEFAULT_THEME, defaultCompilerOptions } from "@beep/repo-docgen/Configuration";
import { Process } from "@beep/repo-docgen/Domain";
import { verifyDocgenProofManifest, writeDocgenProofManifest } from "@beep/repo-docgen/ProofManifest";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { Pod, Runpod, Template } from "@beep/runpod";
import { Unknown } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { A, O, Str } from "@beep/utils";
import { NodeChildProcessSpawner, NodeCrypto, NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import {
  Cause,
  ConfigProvider,
  Duration,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Match,
  Path,
  pipe,
  Ref,
  Runtime,
  Sink,
  Stream,
} from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type {
  DocgenQualityPackageReport,
  DocgenQualityReview,
  DocgenQualitySubject,
  DocgenQualityWorkerEvalRunner,
} from "@beep/repo-cli/test/Docgen";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer);
const TestLayer = Layer.mergeAll(
  PlatformLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(PlatformLayer)),
  FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(PlatformLayer))
);
const CommandPlatformLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const CommandTestLayer = Layer.mergeAll(
  CommandPlatformLayer,
  FsUtilsLive.pipe(Layer.provideMerge(CommandPlatformLayer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(CommandPlatformLayer)),
  FetchHttpClient.layer,
  TestConsole.layer
);
const runDocgenCommand = Command.runWith(docgenCommand, { version: "0.0.0" });
const encodeJson = Unknown.encodeUnknownSyncFromJsonString;
const decodeUnknownJson = Unknown.decodeUnknownSyncFromJsonString;
const encodeDocgenConfigDocument = S.encodeSync(DocgenConfigDocument);
const decodeDocgenConfigDocument = S.decodeUnknownSync(DocgenConfigDocument);
const decodeWorkerEvalReportJson = S.decodeUnknownSync(S.fromJsonString(DocgenQualityWorkerEvalReport));
const isString = (value: unknown): value is string => typeof value === "string";
const DOCGEN_COMMAND_TEST_TIMEOUT = 30_000;
const DOCTEST_FIXTURE_DIR = new URL("./fixtures/doctest/", import.meta.url).pathname;
const DOCTEST_FIXTURE_PACKAGE = "packages/doctest-fixture";
const decodeDoctestReport = S.decodeUnknownEffect(S.fromJsonString(DoctestReport));

const withEnvVar = <A>(name: string, value: string | undefined, use: () => A): A => {
  const previousValue = Bun.env[name];
  if (value === undefined) {
    delete Bun.env[name];
  } else {
    Bun.env[name] = value;
  }

  try {
    return use();
  } finally {
    if (previousValue === undefined) {
      delete Bun.env[name];
    } else {
      Bun.env[name] = previousValue;
    }
  }
};

const expectedTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironment(Bun.env), { args, ci: Bun.env.CI === "true" }));

const stubHandle = ChildProcessSpawner.makeHandle({
  all: Stream.empty,
  exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
  getInputFd: () => Sink.drain,
  getOutputFd: () => Stream.empty,
  isRunning: Effect.succeed(false),
  kill: () => Effect.void,
  pid: ChildProcessSpawner.ProcessId(1),
  stderr: Stream.empty,
  stdin: Sink.drain,
  stdout: Stream.empty,
  unref: Effect.succeed(Effect.void),
});

const recordingSpawnerLayer = (spawned: Array<string>) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      Effect.sync(() => {
        if (ChildProcess.isStandardCommand(command)) {
          A.appendInPlace(spawned, A.join([command.command, ...command.args], " "));
        }
        return stubHandle;
      })
    )
  );

const rangeRejectingSpawnerLayer = (spawned: Array<string>) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      Effect.gen(function* () {
        if (ChildProcess.isStandardCommand(command)) {
          const commandText = A.join([command.command, ...command.args], " ");
          A.appendInPlace(spawned, commandText);
          if (command.command === "git" && Str.includes("origin/main...HEAD")(commandText)) {
            return yield* Effect.die(new Error("range query rejected by test stub"));
          }
        }
        return stubHandle;
      })
    )
  );

const expectReportedExit = (exit: Exit.Exit<unknown, unknown>, exitCode = 1) => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(Runtime.getErrorExitCode(error)).toBe(exitCode);
    expect(Runtime.getErrorReported(error)).toBe(false);
  }
};

const runCommand = (command: string, args: ReadonlyArray<string>, cwd: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(command, [...args], {
        cwd,
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
      const exitCode = yield* handle.exitCode;
      expect(exitCode).toBe(0);
    })
  );

const withTempRepo = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();

      process.chdir(tmpDir);
      yield* fs.makeDirectory(path.join(tmpDir, ".git"), { recursive: true });

      return { fs, path, previousCwd, tmpDir } as const;
    }),
    () => use,
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(TestLayer));

const withTempRepoCommand = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();

      process.chdir(tmpDir);
      yield* fs.makeDirectory(path.join(tmpDir, ".git"), { recursive: true });

      return { fs, previousCwd, tmpDir } as const;
    }),
    () => use,
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(CommandTestLayer));

const withConfigEnv = <A, E, R>(
  env: { readonly [key: string]: string },
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))(use);

const seedDocgenPackage = Effect.fn("DocgenTest.seedDocgenPackage")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmpDir = process.cwd();
  yield* fs.writeFileString(
    path.join(tmpDir, "package.json"),
    encodeJson({
      name: "@beep/test-root",
      private: true,
      workspaces: ["packages/foundation/*/*"],
    })
  );

  const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
  yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
  yield* fs.writeFileString(
    path.join(packageDir, "package.json"),
    encodeJson({ name: "@beep/schema", version: "0.0.0" })
  );
  yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
});

const schemaPackageSourcePath = (path: Path.Path): string =>
  path.join(process.cwd(), "packages", "foundation", "modeling", "schema", "src", "index.ts");

const writeSchemaTsconfig = Effect.fn("DocgenTest.writeSchemaTsconfig")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(
    path.join(process.cwd(), "tsconfig.json"),
    encodeJson({
      compilerOptions: {
        module: "es2022",
        target: "es2022",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
      },
      include: ["packages/**/*.ts"],
    })
  );
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

  yield* fs.writeFileString(
    path.join(repoRoot, "package.json"),
    encodeJson({ name: "@beep/doctest-test-root", private: true, workspaces: ["packages/*"] })
  );
  yield* fs.makeDirectory(srcDir, { recursive: true });
  yield* fs.writeFileString(
    path.join(packageDir, "package.json"),
    encodeJson({ name: "@beep/doctest-fixture", version: "0.0.0" })
  );
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

describe("Docgen operations", () => {
  it("defaults docgen config source fields in the schema without changing explicit wire shape", () => {
    const explicitConfig = DocgenConfigDocument.make({
      srcDir: "custom-src",
      exclude: ["dist", "coverage"],
    });
    expect(encodeDocgenConfigDocument(explicitConfig)).toEqual({
      srcDir: "custom-src",
      exclude: ["dist", "coverage"],
    });

    const decoded = decodeDocgenConfigDocument({});
    expect(decoded.srcDir).toBe("src");
    expect(decoded.exclude).toEqual([]);

    const arbitrary = S.toArbitrary(DocgenConfigDocument)(fc);
    const sameConfig = S.toEquivalence(DocgenConfigDocument);
    fc.assert(
      fc.property(arbitrary, (config) =>
        sameConfig(config, decodeDocgenConfigDocument(encodeDocgenConfigDocument(config)))
      ),
      fcRuns(16)
    );
  });

  it("selects package-local inputs for the bounded local docgen lane", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const schemaDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const utilsDir = path.join(tmpDir, "packages", "foundation", "modeling", "utils");
          yield* fs.makeDirectory(path.join(schemaDir, "src"), { recursive: true });
          yield* fs.makeDirectory(path.join(utilsDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(schemaDir, "package.json"),
            encodeJson({ name: "@beep/schema", version: "0.0.0" })
          );
          yield* fs.writeFileString(path.join(schemaDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(utilsDir, "package.json"),
            encodeJson({ name: "@beep/utils", version: "0.0.0" })
          );
          yield* fs.writeFileString(path.join(utilsDir, "docgen.json"), encodeJson({ srcDir: "src" }));

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
        })
      )
    ));

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

  it("builds changed-plus-dependent Turbo filters for local docgen", () => {
    const args = docgenLocalTurboArgsForTesting(
      [
        DocgenLocalSelectedPackage.make({
          name: "@beep/schema",
          path: "packages/foundation/modeling/schema",
          reasons: ["packages/foundation/modeling/schema/src/index.ts"],
        }),
      ],
      0
    );

    expect(args).toEqual([
      "turbo",
      "run",
      "docgen",
      ...expectedTurboCacheArgs([
        "--filter=...@beep/schema",
        "--concurrency=1",
        "--summarize",
        "--ui=stream",
        "--no-daemon",
      ]),
      "--filter=...@beep/schema",
      "--concurrency=1",
      "--summarize",
      "--ui=stream",
      "--no-daemon",
    ]);
  });

  it("pins direct docgen Turbo invocations to a requested local-only cache", () =>
    withEnvVar("CI", undefined, () =>
      withEnvVar("TURBO_CACHE", "local:rw", () => {
        const args = docgenLocalTurboArgsForTesting(
          [
            DocgenLocalSelectedPackage.make({
              name: "@beep/schema",
              path: "packages/foundation/modeling/schema",
              reasons: ["packages/foundation/modeling/schema/src/index.ts"],
            }),
          ],
          1
        );

        expect(args).toContain("--cache=local:rw");
        expect(args).not.toContain("--cache=local:rw,remote:r");
      })
    ));

  it("writes and verifies package-level docgen proof manifests", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const srcPath = path.join(packageDir, "src", "index.ts");
          const docsPath = path.join(packageDir, "docs", "modules", "Schema.md");

          yield* fs.makeDirectory(path.dirname(srcPath), { recursive: true });
          yield* fs.makeDirectory(path.dirname(docsPath), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              homepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
          const packageProcessLayer = Layer.succeed(
            Process,
            Process.of({
              argv: Effect.succeed([]),
              cwd: Effect.succeed(packageDir),
              platform: Effect.succeed(process.platform),
            })
          );
          const packageConfigurationLayer = Configuration.layer({
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
          });
          const packageDocgenLayer = Layer.mergeAll(packageConfigurationLayer, packageProcessLayer);

          const manifest = yield* writeDocgenProofManifest().pipe(provideScopedLayer(packageDocgenLayer));
          const current = yield* verifyDocgenProofManifest(packageDir, "@beep/schema");

          yield* fs.writeFileString(srcPath, `${yield* fs.readFileString(srcPath)}\nexport const Changed = 2;\n`);
          const stale = yield* verifyDocgenProofManifest(packageDir, "@beep/schema");

          expect(manifest.packageName).toBe("@beep/schema");
          expect(manifest.fingerprint.inputFileCount).toBeGreaterThan(0);
          expect(manifest.fingerprint.outputFileCount).toBeGreaterThan(0);
          expect(current.status).toBe("current");
          expect(stale.status).toBe("stale");
          expect(stale.reason).toBe("package docgen inputs changed");
        })
      )
    ));

  it("builds a package-selected local docgen plan without git discovery", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({ name: "@beep/schema", version: "0.0.0" })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));

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
        })
      )
    ));

  it.effect("builds a full plan without querying the configured git range", () => {
    const spawned = A.empty<string>();
    return withTempRepo(
      Effect.gen(function* () {
        const plan = yield* buildDocgenLocalPlan({
          allowFull: false,
          base: "origin/main",
          full: true,
          head: "HEAD",
          json: false,
          packageSelector: O.none(),
          parallel: 1,
          plan: true,
        }).pipe(provideScopedLayer(rangeRejectingSpawnerLayer(spawned)));

        expect(plan.mode).toBe("full");
        expect(spawned).toEqual([]);
      })
    );
  });

  it.effect("queries the configured git range when building an affected plan", () => {
    const spawned = A.empty<string>();
    return withTempRepo(
      Effect.gen(function* () {
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
          }).pipe(provideScopedLayer(rangeRejectingSpawnerLayer(spawned)))
        );

        expect(Exit.isFailure(exit)).toBe(true);
        expect(A.some(spawned, Str.includes("git diff --no-renames --name-only origin/main...HEAD"))).toBe(true);
      })
    );
  });

  it(
    "prints a local docgen package plan from the command surface",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "package.json"),
              encodeJson({ name: "@beep/schema", version: "0.0.0" })
            );
            yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));

            yield* runDocgenCommand(["local", "--plan", "-p", "@beep/schema"]);

            const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
            expect(output).toContain("docgen:local plan");
            expect(output).toContain("- mode: scoped");
            expect(output).toContain("--filter=...@beep/schema");
            expect(process.exitCode ?? 0).toBe(0);
          })
        )
      )
  );

  it.effect("plans full docgen with configured concurrency and both execution steps", () =>
    withTempRepoCommand(
      withConfigEnv(
        { BEEP_DOCGEN_CONCURRENCY: "6" },
        Effect.gen(function* () {
          yield* seedDocgenPackage();
          yield* runDocgenCommand(["local", "--full", "--plan", "--package", "@beep/schema"]);

          const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
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
        })
      )
    )
  );

  it.effect("prefers the local --parallel flag over configured concurrency", () =>
    withTempRepoCommand(
      withConfigEnv(
        { BEEP_DOCGEN_CONCURRENCY: "6" },
        Effect.gen(function* () {
          yield* seedDocgenPackage();
          yield* runDocgenCommand(["local", "--full", "--plan", "--package", "@beep/schema", "--parallel", "8"]);

          const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(output).toContain("- package concurrency: 8");
          expect(output).toContain("--concurrency=8");
          expect(output).not.toContain("--concurrency=6");
        })
      )
    )
  );

  it.effect("defaults local docgen concurrency to three", () =>
    withTempRepoCommand(
      withConfigEnv(
        {},
        Effect.gen(function* () {
          yield* seedDocgenPackage();
          yield* runDocgenCommand(["local", "--full", "--plan", "--package", "@beep/schema"]);

          const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(output).toContain("- package concurrency: 3");
          expect(output).toContain("--concurrency=3");
        })
      )
    )
  );

  it.effect("executes full docgen through direct Turbo and aggregate steps", () => {
    const spawned = A.empty<string>();
    return withTempRepo(
      Effect.gen(function* () {
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
        }).pipe(provideScopedLayer(recordingSpawnerLayer(spawned)));

        expect(plan.mode).toBe("full");
        expect(spawned).toEqual([
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
      })
    );
  });

  it(
    "rejects local docgen JSON output without plan mode",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const exit = yield* Effect.exit(runDocgenCommand(["local", "--json"]));

            expect(yield* TestConsole.logLines).toEqual([]);
            expect(A.join(A.filter(yield* TestConsole.errorLines, isString), "\n")).toContain(
              "--json requires --plan for docgen:local so stdout remains machine-readable."
            );
            expectReportedExit(exit);
          })
        )
      )
  );

  it("parses current schema flags and classifies a configured package that has not generated docs", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(
            path.join(packageDir, "docgen.json"),
            encodeJson({
              $schema: "../../../../packages/tooling/tool/docgen/schema.json",
              enforceDescriptions: true,
              enforceExamples: true,
              enforceVersion: true,
              srcDir: "src",
            })
          );

          const config = yield* loadDocgenConfigDocument(packageDir);
          const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
          const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

          expect(config.enforceDescriptions).toBe(true);
          expect(config.enforceExamples).toBe(true);
          expect(config.enforceVersion).toBe(true);
          expect(target?.status).toBe("configured-not-generated");
          expect(target?.docsOutputPath).toBe("foundation/modeling/schema");
        })
      )
    ));

  it("reports aggregate docs paths under the ignored docs/generated layout", () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const docsModulesDir = path.join(packageDir, "docs", "modules");
          yield* fs.makeDirectory(docsModulesDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(docsModulesDir, "Schema.md"),
            `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
          );

          yield* runDocgenCommand(["status", "--verbose"]);

          const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(output).toContain("aggregate: docs/generated/foundation/modeling/schema");
          expect(output).not.toContain("docs: docs/foundation/modeling/schema");
        })
      )
    ));

  it("builds repo-standard init config without example path mappings", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const schemaDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(schemaDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(schemaDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
              exports: {
                ".": "./src/index.ts",
                "./*": "./src/*.ts",
              },
            })
          );

          const identityDir = path.join(tmpDir, "packages", "foundation", "modeling", "identity");
          yield* fs.makeDirectory(path.join(identityDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(identityDir, "package.json"),
            encodeJson({
              name: "@beep/identity",
              version: "0.0.0",
              dependencies: {
                "@beep/schema": "workspace:*",
              },
              exports: {
                ".": "./src/index.ts",
                "./*": "./src/*.ts",
              },
            })
          );

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
        })
      )
    ));

  it("builds paths-free init config regardless of source export shape", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*", "packages/example/*"],
            })
          );

          const schemaDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(schemaDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(schemaDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
              exports: {
                ".": "./src/index.ts",
                "./*": "./src/*.ts",
              },
            })
          );

          const runtimeDir = path.join(tmpDir, "packages", "example", "server");
          yield* fs.makeDirectory(path.join(runtimeDir, "src", "internal"), { recursive: true });
          yield* fs.writeFileString(
            path.join(runtimeDir, "package.json"),
            encodeJson({
              name: "@beep/example-server",
              version: "0.0.0",
              dependencies: {
                "@beep/schema": "workspace:*",
              },
              exports: {
                ".": "./src/internal/index.ts",
                "./*": "./src/internal/*.ts",
              },
            })
          );

          const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
          const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/example-server"));

          expect(target).toBeDefined();

          const config = yield* createDocgenConfigDocument(target!, tmpDir);

          expect(config.$schema).toBe("../../../packages/tooling/tool/docgen/schema.json");
          expect(config.examplesCompilerOptions).toMatchObject({
            moduleResolution: "bundler",
          });
          expect(config.examplesCompilerOptions).not.toHaveProperty("paths");
        })
      )
    ));

  it("ignores vendored docgen trees that are outside workspace patterns", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const workspacePackageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(workspacePackageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(workspacePackageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(workspacePackageDir, "docgen.json"), encodeJson({ srcDir: "src" }));

          const vendoredPackageDir = path.join(tmpDir, ".repos", "effect-v4", "packages", "effect");
          yield* fs.makeDirectory(path.join(vendoredPackageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(vendoredPackageDir, "package.json"),
            encodeJson({
              name: "effect",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(vendoredPackageDir, "docgen.json"), encodeJson({ srcDir: "src" }));

          const packages = yield* discoverDocgenWorkspacePackages(tmpDir);

          expect(A.map(packages, (pkg) => pkg.relativePath)).toEqual(["packages/foundation/modeling/schema"]);
          expect(A.map(packages, (pkg) => pkg.name)).toEqual(["@beep/schema"]);
        })
      )
    ));

  it("preserves the nested docs layout and rewrites module parents", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const docsModulesDir = path.join(packageDir, "docs", "modules");
          yield* fs.makeDirectory(docsModulesDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(docsModulesDir, "Schema.md"),
            `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
          );

          const results = yield* aggregateGeneratedDocs();
          const aggregatedPath = path.join(
            tmpDir,
            "docs",
            "generated",
            "foundation",
            "modeling",
            "schema",
            "Schema.md"
          );
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
        })
      )
    ));

  it("skips symlinked docs entries during aggregation", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const docsModulesDir = path.join(packageDir, "docs", "modules");
          const outsideFilePath = path.join(tmpDir, "outside.md");
          yield* fs.makeDirectory(docsModulesDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(docsModulesDir, "Schema.md"),
            `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
          );
          yield* fs.writeFileString(outsideFilePath, "top-secret\n");
          yield* fs.symlink(outsideFilePath, path.join(docsModulesDir, "Leak.md"));

          const results = yield* aggregateGeneratedDocs();
          const aggregatedPath = path.join(
            tmpDir,
            "docs",
            "generated",
            "foundation",
            "modeling",
            "schema",
            "Schema.md"
          );
          const leakedPath = path.join(tmpDir, "docs", "generated", "foundation", "modeling", "schema", "Leak.md");
          const aggregated = yield* fs.readFileString(aggregatedPath);
          const leakedExists = yield* fs.exists(leakedPath);

          expect(results).toHaveLength(1);
          expect(results[0]?.fileCount).toBe(1);
          expect(aggregated).toContain('parent: "@beep/schema"');
          expect(leakedExists).toBe(false);
        })
      )
    ));

  it("rejects symlinked docs roots during aggregation", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const packageDocsDir = path.join(packageDir, "docs");
          const docsModulesDir = path.join(packageDocsDir, "modules");
          const externalDocsModulesDir = path.join(tmpDir, "external-docs", "modules");
          yield* fs.makeDirectory(packageDocsDir, { recursive: true });
          yield* fs.makeDirectory(externalDocsModulesDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(externalDocsModulesDir, "Schema.md"),
            `---\nparent: Modules\ntitle: Schema\n---\n\ncontent\n`
          );
          yield* fs.symlink(externalDocsModulesDir, docsModulesDir);

          const exit = yield* aggregateGeneratedDocs().pipe(Effect.exit);
          const aggregatedPath = path.join(tmpDir, "docs", "generated", "foundation", "modeling", "schema");
          const aggregatedExists = yield* fs.exists(aggregatedPath);

          expect(Exit.isFailure(exit)).toBe(true);
          expect(aggregatedExists).toBe(false);
        })
      )
    ));

  it("rejects stale docgen configs outside current workspaces during aggregation", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );

          const staleDocgenPath = path.join(tmpDir, "packages", "retired", "runtime", "docgen.json");
          yield* fs.makeDirectory(path.dirname(staleDocgenPath), { recursive: true });
          yield* fs.writeFileString(staleDocgenPath, encodeJson({ srcDir: "src" }));

          // A stray docgen.json below the ceremony-exempt labs root must stay
          // invisible to the orphan scan (goals/lab-apps-lifecycle D2).
          const labsDocgenPath = path.join(tmpDir, "apps", "labs", "demo", "docgen.json");
          yield* fs.makeDirectory(path.dirname(labsDocgenPath), { recursive: true });
          yield* fs.writeFileString(labsDocgenPath, encodeJson({ srcDir: "src" }));

          const orphaned = yield* discoverOrphanDocgenConfigPaths(tmpDir);
          const error = yield* aggregateGeneratedDocs().pipe(Effect.flip);

          expect(orphaned).toEqual(["packages/retired/runtime/docgen.json"]);
          expect(error.message).toContain("packages/retired/runtime/docgen.json");
        })
      )
    ));

  it("supports clean aggregation when stale docs paths conflict with nested package docs", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/example/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "example", "store");
          const docsModulesDir = path.join(packageDir, "docs", "modules");
          yield* fs.makeDirectory(docsModulesDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/example-store",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

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

    expect(report).toContain("# JSDoc Analysis Report: @beep/schema");
    expect(report).toContain("bun run beep docgen analyze -p packages/foundation/modeling/schema");
    expect(report).toContain("## Fix Checklist");
    expect(report).not.toContain("Instructions for Agent");
    expect(report).not.toContain("You are tasked");
  });

  it("builds rich JSDoc quality subjects and advisory findings", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
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
        })
      )
    ));

  it("flags empty and over-padded code examples during quality analysis", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );
          yield* fs.writeFileString(
            path.join(tmpDir, "tsconfig.json"),
            encodeJson({
              compilerOptions: {
                module: "es2022",
                target: "es2022",
                moduleResolution: "bundler",
                strict: true,
                noEmit: true,
              },
              include: ["packages/**/*.ts"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(path.join(packageDir, "package.json"), encodeJson({ name: "@beep/schema" }));
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(packageDir, "src", "index.ts"),
            `/**
 * Over-padded example fixture.
 *
 * @example
 * \`\`\`ts
 * import { Effect } from "effect"
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
        })
      )
    ));

  it("collects local export-list symbols and treats lowercase console output as observable", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("warns when examples log exported symbol handles instead of behavior", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("aligns observable example and Effect signature heuristics", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(packageDir, "src", "index.ts"),
            `/**
 * Parses a value into the normalized schema fixture.
 *
 * @example
 * \`\`\`ts
 * import { Equal } from "effect"
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
            return O.getOrUndefined(
              A.findFirst(report.reviews, (entry) => entry.subjectId === subject?.stableIdentity)
            );
          };

          const parseFindingCodes = A.map(reviewFor("parseValue")?.findings ?? [], (finding) => finding.code);
          const formatFindingCodes = A.map(reviewFor("formatValue")?.findings ?? [], (finding) => finding.code);

          expect(parseFindingCodes).not.toContain("example-only-voids-result");
          expect(parseFindingCodes).not.toContain("example-lacks-observable-result");
          expect(formatFindingCodes).not.toContain("missing-effects-for-effectful-symbol");
        })
      )
    ));

  it("accepts type-level evidence as a useful type-only example", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("treats inheritDoc companion aliases as inheriting required examples", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
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
          expect(qualityFindingCodes(qualityReview(report, schemaTypeCompanionSubject))).not.toContain(
            "missing-example"
          );
          expect(qualityFindingCodes(qualityReview(report, companionNamespaceSubject))).not.toContain(
            "missing-example"
          );
          expect(qualityFindingCodes(qualityReview(report, companionInterfaceSubject))).not.toContain(
            "missing-example"
          );
          expect(qualityFindingCodes(qualityReview(report, bareTypeSubject))).toContain("missing-example");
        })
      )
    ));

  it("skips exported declarations marked internal", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("does not score undocumented overload signatures separately from the documented overload", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("does not require documentation for static component member assignments", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("uses owning declaration JSDoc for same-file export specifier subjects", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("uses schema annotation descriptions when JSDoc only carries tags", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(path.join(packageDir, "package.json"), encodeJson({ name: "@beep/schema" }));
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("does not score aliased local export specifiers as separate quality subjects", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("preserves default-export subjects in quality analysis", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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

export default trimDefault;
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

          expect(defaultSubjects).toHaveLength(3);
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
            ])
          );
        })
      )
    ));

  it("treats module re-exports as graph edges instead of quality subjects", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
            `/**
 * @since 0.0.0
 * @category parsing
 */
export * as Value from "./Value.ts";
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
        })
      )
    ));

  it("emits schema v2 partial package reports when the package budget is exhausted", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
          const decoded = decodeUnknownJson(json) as {
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
        })
      )
    ));

  it("honors docgen exclude globs during quality subject collection", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src", "internal"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(
            path.join(packageDir, "docgen.json"),
            encodeJson({
              srcDir: "src",
              exclude: ["src/internal/**/*.ts", "src/*.generated.ts"],
            })
          );
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
        })
      )
    ));

  it("selects packages from changed-files git output", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* runCommand("git", ["init"], tmpDir);
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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

          const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          const decoded = decodeUnknownJson(output) as {
            readonly scope?: string;
            readonly packages?: ReadonlyArray<{
              readonly packageName?: string;
              readonly subjects?: ReadonlyArray<{ readonly exportName?: string }>;
            }>;
          };

          expect(decoded.scope).toBe("changed-files");
          expect(decoded.packages?.[0]?.packageName).toBe("@beep/schema");
          expect(A.map(decoded.packages?.[0]?.subjects ?? [], (subject) => subject.exportName)).toContain("parseValue");
        })
      )
    )
  );

  it("renders consolidated quality reports and Codex remediation packets", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );
          yield* fs.writeFileString(
            path.join(tmpDir, "tsconfig.json"),
            encodeJson({
              compilerOptions: {
                module: "es2022",
                target: "es2022",
                moduleResolution: "bundler",
                strict: true,
                noEmit: true,
              },
              include: ["packages/**/*.ts"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
          const decoded = decodeUnknownJson(json) as Record<string, unknown>;

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
        })
      )
    ));

  it("caps and ranks Codex remediation packets for broad quality reports", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it("evaluates worker packets with a fake Codex runner", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const schemaDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const typesDir = path.join(tmpDir, "packages", "foundation", "primitive", "types");
          yield* fs.makeDirectory(path.join(schemaDir, "src"), { recursive: true });
          yield* fs.makeDirectory(path.join(typesDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(schemaDir, "package.json"),
            encodeJson({ name: "@beep/schema", version: "0.0.0" })
          );
          yield* fs.writeFileString(
            path.join(typesDir, "package.json"),
            encodeJson({ name: "@beep/types", version: "0.0.0" })
          );
          yield* fs.writeFileString(path.join(schemaDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(path.join(typesDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(schemaDir, "src", "index.ts"),
            `/**
 * Schema fixture without a useful example.
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
          );
          yield* fs.writeFileString(
            path.join(typesDir, "src", "index.ts"),
            `/**
 * Type fixture without a useful example.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TypeValue = string;
`
          );

          const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
          const targets = A.filter(packages, (pkg) => pkg.name === "@beep/schema" || pkg.name === "@beep/types");
          const report = yield* analyzeDocgenQuality({
            scope: "all",
            scoreMode: "codex",
            targets,
          });
          let observedWorkingDirectories = A.empty<string>();
          const runner: DocgenQualityWorkerEvalRunner = (input) => {
            observedWorkingDirectories = A.append(observedWorkingDirectories, input.workingDirectory);
            return Effect.succeed({
              finalResponse: encodeJson({
                localScore: 8,
                rationale: "The draft adds an observable example and keeps required tags.",
                draftJsDoc: "/**\\n * Demonstrates the exported symbol.\\n */",
                policyViolationCodes: [],
                reviewDisposition: "candidate",
              }),
            });
          };

          const workerReport = yield* analyzeDocgenQualityWorkerEval({
            codexSdkVersion: "test-sdk",
            model: "gpt-5.4-mini",
            packetLimit: 2,
            provider: "codex",
            reasoningEffort: "low",
            report,
            runner,
            scope: "input",
            sourceQualityReport: "quality.json",
          });
          const json = yield* generateQualityWorkerEvalJson(workerReport);
          const decoded = decodeWorkerEvalReportJson(json);
          const packetPackages = pipe(
            decoded.packets,
            A.map((packet) => packet.packageName),
            A.dedupe
          );

          expect(decoded.schemaVersion).toBe(1);
          expect(decoded.provider).toBe("codex");
          expect(decoded.model).toBe("gpt-5.4-mini");
          expect(decoded.reasoningEffort).toBe("low");
          expect(decoded.codexSdkVersion).toBe("test-sdk");
          expect(decoded.summary.sourcePackets).toBeGreaterThanOrEqual(2);
          expect(decoded.summary.selectedPackets).toBe(2);
          expect(decoded.summary.completed).toBe(2);
          expect(decoded.summary.candidates).toBe(2);
          expect(packetPackages).toEqual(["@beep/schema", "@beep/types"]);
          expect(A.every(observedWorkingDirectories, (directory) => directory !== tmpDir)).toBe(true);

          const localProviderReport = yield* analyzeDocgenQualityWorkerEval({
            codexSdkVersion: "test-sdk",
            model: "qwen-test",
            packetLimit: 0,
            provider: "ollama",
            report,
            runner,
            scope: "input",
            sourceQualityReport: "quality.json",
          });

          expect(localProviderReport.reasoningEffort).toBeNull();

          let observedBaseUrl = O.none<string>();
          const baseUrlRunner: DocgenQualityWorkerEvalRunner = (input) => {
            observedBaseUrl = O.fromUndefinedOr(input.baseUrl);
            return Effect.succeed({
              finalResponse: encodeJson({
                localScore: 8,
                rationale: "The draft adds an observable example and keeps required tags.",
                draftJsDoc: "/**\\n * Demonstrates the exported symbol.\\n */",
                policyViolationCodes: [],
                reviewDisposition: "candidate",
              }),
            });
          };
          const baseUrlReport = yield* analyzeDocgenQualityWorkerEval({
            baseUrl: "  https://pod-11434.proxy.runpod.net/v1  ",
            codexSdkVersion: "test-sdk",
            model: "qwen3-coder:30b",
            packetLimit: 1,
            provider: "ollama",
            report,
            runner: baseUrlRunner,
            scope: "input",
            sourceQualityReport: "quality.json",
          });

          expect(baseUrlReport.summary.completed).toBe(1);
          expect(O.getOrNull(observedBaseUrl)).toBe("https://pod-11434.proxy.runpod.net/v1");

          const outOfRangeScoreRunner: DocgenQualityWorkerEvalRunner = () =>
            Effect.succeed({
              finalResponse: encodeJson({
                localScore: 11,
                rationale: "The worker returned an out-of-range score.",
                draftJsDoc: "/**\\n * Demonstrates the exported symbol.\\n */",
                policyViolationCodes: [],
                reviewDisposition: "candidate",
              }),
            });
          const outOfRangeScoreReport = yield* analyzeDocgenQualityWorkerEval({
            codexSdkVersion: "test-sdk",
            model: "gpt-5.4-mini",
            packetLimit: 1,
            provider: "codex",
            reasoningEffort: "low",
            report,
            runner: outOfRangeScoreRunner,
            scope: "input",
            sourceQualityReport: "quality.json",
          });
          const failedPacket = outOfRangeScoreReport.packets[0];

          expect(outOfRangeScoreReport.summary.failed).toBe(1);
          expect(failedPacket?.status).toBe("failed");
          expect(failedPacket?.localScore).toBeNull();
          expect(failedPacket?.error).toContain("Worker returned invalid eval JSON");
        })
      )
    ));

  it("wires --packet-limit through the quality CLI", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const outputPath = path.join(tmpDir, "quality.json");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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

          const decoded = decodeUnknownJson(yield* fs.readFileString(outputPath)) as {
            readonly packages?: ReadonlyArray<{
              readonly omittedPacketCount?: unknown;
              readonly summary?: { readonly remediationPackets?: unknown };
            }>;
            readonly remediationPackets?: ReadonlyArray<unknown>;
          };

          expect(decoded.remediationPackets).toHaveLength(2);
          expect(decoded.packages?.[0]?.summary?.remediationPackets).toBe(2);
          expect(decoded.packages?.[0]?.omittedPacketCount).toBe(3);
        })
      )
    )
  );

  it(
    "writes worker eval JSON from a saved quality report without requiring a live provider",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            const qualityPath = path.join(tmpDir, "quality.json");
            const evalPath = path.join(tmpDir, "worker-eval.json");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "package.json"),
              encodeJson({
                name: "@beep/schema",
                version: "0.0.0",
              })
            );
            yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
            yield* fs.writeFileString(
              path.join(packageDir, "src", "index.ts"),
              `/**
 * Missing example worker eval fixture.
 *
 * @category parsing
 * @since 0.0.0
 */
export const workerEvalValue = 1;
`
            );

            const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
            const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

            expect(target).toBeDefined();

            const qualityReport = yield* analyzeDocgenQuality({
              scope: "package",
              scoreMode: "codex",
              targets: [target!],
            });
            yield* fs.writeFileString(qualityPath, yield* generateQualityJson(qualityReport));

            yield* runDocgenCommand([
              "quality-worker-eval",
              "--input",
              qualityPath,
              "--provider",
              "codex",
              "--model",
              "gpt-5.4-mini",
              "--packet-limit",
              "0",
              "--output",
              evalPath,
            ]);

            const decoded = decodeWorkerEvalReportJson(yield* fs.readFileString(evalPath));
            const logLines = A.filter(yield* TestConsole.logLines, isString);

            expect(decoded.schemaVersion).toBe(1);
            expect(decoded.scope).toBe("input");
            expect(decoded.sourceQualityReport).toBe(qualityPath);
            expect(decoded.provider).toBe("codex");
            expect(decoded.model).toBe("gpt-5.4-mini");
            expect(decoded.reasoningEffort).toBe("low");
            expect(decoded.codexSdkVersion).toMatch(/^\d+\.\d+\.\d+/);
            expect(decoded.summary.sourcePackets).toBeGreaterThan(0);
            expect(decoded.summary.selectedPackets).toBe(0);
            expect(decoded.packets).toHaveLength(0);
            expect(A.join(logLines, "\n")).toContain(`docgen: wrote ${evalPath}`);
          })
        )
      )
  );

  it("builds Runpod Ollama pod inputs without secrets", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const selected = selectQualityWorkerRunpodTemplate([
          Template.make({
            id: "template-z",
            imageName: "runpod/pytorch:latest",
            name: "Plain PyTorch",
          }),
          Template.make({
            id: "template-a",
            imageName: "ollama/ollama:latest",
            name: "Ollama CUDA",
          }),
        ]);

        expect(O.isSome(selected)).toBe(true);
        if (O.isNone(selected)) {
          return;
        }

        expect(selected.value.id).toBe("template-a");

        const body = makeQualityWorkerRunpodEvalPodCreateInput({
          gpuTypeIds: ["NVIDIA RTX A6000"],
          minRamPerGpuGb: 48,
          model: requiredQualityWorkerRunpodEvalModel(),
          podName: "beep-jsdoc-worker-eval-test",
        });
        const bootstrap = A.join(body.dockerStartCmd ?? [], "\n");

        expect(body.computeType).toBe("GPU");
        expect(body.globalNetworking).toBe(true);
        expect(body.gpuTypeIds).toEqual(["NVIDIA RTX A6000"]);
        expect(body.minRAMPerGPU).toBe(48);
        expect(body.ports).toEqual(["11434/http"]);
        expect(bootstrap).toContain("apt-get install -y curl ca-certificates zstd");
        expect(bootstrap).toContain("sha256sum -c -");
        expect(bootstrap).toContain("sh /tmp/ollama-install.sh");
        expect(bootstrap).not.toMatch(/curl.*\|\s*sh/);
        expect(bootstrap).toContain("http://127.0.0.1:11434/api/pull");
        expect(bootstrap).toContain('-d \'{"name":"qwen3-coder:30b"}\'');
        expect(bootstrap).not.toContain("RUNPOD_API_KEY");
      })
    ));

  it("cleans up Runpod pods after recovering a missing createPod id", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({ name: "@beep/schema", version: "0.0.0" })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(packageDir, "src", "index.ts"),
            `/**
 * Schema fixture without a useful example.
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseValue = (value: string): string => value.trim();
`
          );

          const [target] = yield* discoverDocgenWorkspacePackages(tmpDir);
          const report = yield* analyzeDocgenQuality({
            scope: "package",
            scoreMode: "codex",
            targets: [target!],
          });
          const stoppedPodIds = yield* Ref.make<ReadonlyArray<string>>([]);
          const deletedPodIds = yield* Ref.make<ReadonlyArray<string>>([]);
          const RunpodTestLayer = Layer.succeed(
            Runpod,
            Runpod.of({
              createPod: () => Effect.succeed(Pod.make({ name: "created-without-id" })),
              deletePod: (request: { readonly podId: string }) => Ref.update(deletedPodIds, A.append(request.podId)),
              getPod: (request: { readonly podId: string }) =>
                Effect.succeed(Pod.make({ id: request.podId, name: "recovered-pod" })),
              listTemplates: () => Effect.die("unexpected public template search"),
              listPods: (request?: { readonly name?: string }) =>
                Effect.succeed([
                  Pod.make(
                    request?.name === undefined ? { id: "pod-recovered" } : { id: "pod-recovered", name: request.name }
                  ),
                ]),
              stopPod: (request: { readonly podId: string }) => Ref.update(stoppedPodIds, A.append(request.podId)),
            } as never)
          ).pipe(
            Layer.provideMerge(
              Layer.succeed(
                HttpClient.HttpClient,
                HttpClient.make(() => Effect.die("unexpected docgen quality worker HTTP request"))
              )
            )
          );

          const exit = yield* runDocgenQualityWorkerRunpodEval({
            confirmRunpodEval: true,
            model: requiredQualityWorkerRunpodEvalModel(),
            provider: "ollama",
            readinessTimeoutMs: 1,
            report,
            scope: "package",
            sourceQualityReport: "quality.json",
          }).pipe(provideScopedLayer(RunpodTestLayer), Effect.exit);

          expect(Exit.isFailure(exit)).toBe(true);
          expect(yield* Ref.get(stoppedPodIds)).toEqual(["pod-recovered"]);
          expect(yield* Ref.get(deletedPodIds)).toEqual(["pod-recovered"]);
        })
      )
    ));

  it("guards Runpod worker eval behind explicit confirmation", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const exit = yield* Effect.exit(
            runDocgenCommand([
              "quality-worker-eval-runpod",
              "--all",
              "--provider",
              "ollama",
              "--model",
              requiredQualityWorkerRunpodEvalModel(),
              "--gpu-type",
              "NVIDIA RTX A6000",
              "--readiness-timeout-ms",
              "1",
            ])
          );

          expect((yield* TestConsole.errorLines).join("\n")).toContain("--confirm-runpod-eval");
          expectReportedExit(exit);
        })
      )
    )
  );

  it("rejects nonpositive Runpod readiness timeout values", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const exit = yield* Effect.exit(
            runDocgenCommand([
              "quality-worker-eval-runpod",
              "--all",
              "--provider",
              "ollama",
              "--model",
              requiredQualityWorkerRunpodEvalModel(),
              "--readiness-timeout-ms",
              "0",
              "--confirm-runpod-eval",
            ])
          );

          expect((yield* TestConsole.errorLines).join("\n")).toContain("--readiness-timeout-ms");
          expectReportedExit(exit);
        })
      )
    )
  );

  it("rejects negative --packet-limit values", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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

          expect(A.join(A.filter(yield* TestConsole.errorLines, isString), "\n")).toContain(
            "--packet-limit must be zero or greater"
          );
          expectReportedExit(exit);
        })
      )
    )
  );

  it("fails analysis when a package-local docgen.json is malformed", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), "{ invalid");

          const packages = yield* discoverDocgenWorkspacePackages(tmpDir);
          const target = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@beep/schema"));

          expect(target).toBeDefined();

          const exit = yield* analyzePackageDocumentation(target!).pipe(Effect.exit);

          expect(Exit.isFailure(exit)).toBe(true);
        })
      )
    ));

  it("checks docgen metadata without writing analysis files", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
          yield* fs.writeFileString(
            path.join(packageDir, "src", "index.ts"),
            `export const MissingMetadata = "nope";\n`
          );

          const exit = yield* Effect.exit(runDocgenCommand(["check", "-p", "packages/foundation/modeling/schema"]));

          const errorLines = A.filter(yield* TestConsole.errorLines, isString);
          const wroteMarkdown = yield* fs.exists(path.join(packageDir, "JSDOC_ANALYSIS.md"));
          const wroteJson = yield* fs.exists(path.join(packageDir, "JSDOC_ANALYSIS.json"));

          expect(A.join(errorLines, "\n")).toContain("packages/foundation/modeling/schema has");
          expect(A.join(errorLines, "\n")).toContain("<module fileoverview> missing @since");
          expect(A.join(errorLines, "\n")).toContain("MissingMetadata missing @category, @since");
          expect(wroteMarkdown).toBe(false);
          expect(wroteJson).toBe(false);
          expectReportedExit(exit);
        })
      )
    )
  );

  it("skips current proof manifests during docgen check", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const srcPath = path.join(packageDir, "src", "index.ts");
          const docsPath = path.join(packageDir, "docs", "modules", "Schema.md");
          yield* fs.makeDirectory(path.dirname(srcPath), { recursive: true });
          yield* fs.makeDirectory(path.dirname(docsPath), { recursive: true });
          yield* fs.writeFileString(path.join(packageDir, "package.json"), encodeJson({ name: "@beep/schema" }));
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
          const packageProcessLayer = Layer.succeed(
            Process,
            Process.of({
              argv: Effect.succeed([]),
              cwd: Effect.succeed(packageDir),
              platform: Effect.succeed(process.platform),
            })
          );
          const packageConfigurationLayer = Configuration.layer({
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
          });

          yield* writeDocgenProofManifest().pipe(
            provideScopedLayer(Layer.mergeAll(packageConfigurationLayer, packageProcessLayer))
          );
          yield* runDocgenCommand([
            "check",
            "-p",
            "packages/foundation/modeling/schema",
            "--reuse-proof-manifest",
            "--json",
          ]);

          const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          const decoded = decodeUnknownJson(output) as {
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
        })
      )
    )
  );

  it(
    "checks rejected category values without writing analysis files",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "package.json"),
              encodeJson({
                name: "@beep/schema",
                version: "0.0.0",
              })
            );
            yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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

            const errorText = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");
            const wroteMarkdown = yield* fs.exists(path.join(packageDir, "JSDOC_ANALYSIS.md"));
            const wroteJson = yield* fs.exists(path.join(packageDir, "JSDOC_ANALYSIS.json"));

            expect(errorText).toContain("packages/foundation/modeling/schema has");
            expect(errorText).toContain("RejectedCategory invalid category: Re-exports are graph edges");
            expect(errorText).not.toContain("RejectedCategory missing");
            expect(wroteMarkdown).toBe(false);
            expect(wroteJson).toBe(false);
            expectReportedExit(exit);
          })
        )
      )
  );

  it(
    "checks required tags on the owning JSDoc block instead of adjacent blocks",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(path.join(packageDir, "package.json"), encodeJson({ name: "@beep/schema" }));
            yield* fs.writeFileString(
              path.join(packageDir, "docgen.json"),
              encodeJson({ srcDir: "src", enforceExamples: true })
            );
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
            const errorText = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");

            expect(errorText).toContain("parseValue missing @example");
            expectReportedExit(exit);
          })
        )
      )
  );

  it(
    "writes report-only quality JSON without failing the command",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );
            yield* fs.writeFileString(
              path.join(tmpDir, "tsconfig.json"),
              encodeJson({
                compilerOptions: {
                  module: "es2022",
                  target: "es2022",
                  moduleResolution: "bundler",
                  strict: true,
                  noEmit: true,
                },
                include: ["packages/**/*.ts"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            const outputPath = path.join(tmpDir, "quality.json");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "package.json"),
              encodeJson({
                name: "@beep/schema",
                version: "0.0.0",
              })
            );
            yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
            const decoded = decodeUnknownJson(output) as {
              readonly schemaVersion?: unknown;
              readonly scorer?: unknown;
              readonly remediationPackets?: ReadonlyArray<{ readonly prompt?: string }>;
            };
            const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");

            expect(decoded.schemaVersion).toBe(2);
            expect(decoded.scorer).toBe("codex-advisory-packet-v1");
            expect(decoded.remediationPackets?.[0]?.prompt).toContain("Keep @example mandatory");
            expect(logText).toContain("docgen: wrote");
            expect(process.exitCode ?? 0).toBe(0);
          })
        )
      )
  );

  it(
    "fails quality check mode when findings are present",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );
            yield* fs.writeFileString(
              path.join(tmpDir, "tsconfig.json"),
              encodeJson({
                compilerOptions: {
                  module: "es2022",
                  target: "es2022",
                  moduleResolution: "bundler",
                  strict: true,
                  noEmit: true,
                },
                include: ["packages/**/*.ts"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            const outputPath = path.join(tmpDir, "quality.json");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(path.join(packageDir, "package.json"), encodeJson({ name: "@beep/schema" }));
            yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
          })
        )
      )
  );

  it(
    "fails quality check mode when only warnings are present",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );
            yield* fs.writeFileString(
              path.join(tmpDir, "tsconfig.json"),
              encodeJson({
                compilerOptions: {
                  module: "es2022",
                  target: "es2022",
                  moduleResolution: "bundler",
                  strict: true,
                  noEmit: true,
                },
                include: ["packages/**/*.ts"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            const outputPath = path.join(tmpDir, "quality.json");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(path.join(packageDir, "package.json"), encodeJson({ name: "@beep/schema" }));
            yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
            const output = decodeUnknownJson(yield* fs.readFileString(outputPath)) as {
              readonly summary?: { readonly warnings?: number; readonly failures?: number };
            };

            expect(output.summary?.warnings).toBeGreaterThan(0);
            expect(output.summary?.failures).toBe(0);
            expectReportedExit(exit);
          })
        )
      )
  );

  it("flags rejected category values during analysis", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
          const rejected = O.getOrUndefined(
            A.findFirst(analysis.exports, (entry) => entry.name === "RejectedCategory")
          );

          expect(rejected?.missingTags).toEqual([]);
          expect(rejected?.categoryValues).toEqual(["exports"]);
          expect(A.join(rejected?.categoryIssues ?? [], "\n")).toContain("Re-exports are graph edges");
          expect(analysis.summary.invalidCategory).toBe(1);
          expect(analysis.summary.missingDocumentation).toBe(1);
        })
      )
    ));

  it("flags rejected category values on module fileoverview during analysis", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
            })
          );
          yield* fs.writeFileString(path.join(packageDir, "docgen.json"), encodeJson({ srcDir: "src" }));
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
        })
      )
    ));

  it(
    "returns a non-zero exit code when generate targets an unconfigured package",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "package.json"),
              encodeJson({
                name: "@beep/schema",
                version: "0.0.0",
              })
            );

            const exit = yield* Effect.exit(
              runDocgenCommand(["generate", "-p", "packages/foundation/modeling/schema"])
            );

            const errorLines = yield* TestConsole.errorLines;

            expect(errorLines).toEqual([
              'docgen: packages/foundation/modeling/schema is missing docgen.json. Run "bun run beep docgen init -p packages/foundation/modeling/schema" first.',
            ]);
            expectReportedExit(exit);
          })
        )
      )
  );

  it(
    "accepts --filter for generate and resolves it like --package",
    {
      timeout: DOCGEN_COMMAND_TEST_TIMEOUT,
    },
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tmpDir = process.cwd();
            yield* fs.writeFileString(
              path.join(tmpDir, "package.json"),
              encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/foundation/*/*"],
              })
            );

            const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
            yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "package.json"),
              encodeJson({
                name: "@beep/schema",
                version: "0.0.0",
              })
            );

            const exit = yield* Effect.exit(
              runDocgenCommand(["generate", "--filter", "packages/foundation/modeling/schema"])
            );

            const errorLines = yield* TestConsole.errorLines;

            expect(errorLines).toEqual([
              'docgen: packages/foundation/modeling/schema is missing docgen.json. Run "bun run beep docgen init -p packages/foundation/modeling/schema" first.',
            ]);
            expectReportedExit(exit);
          })
        )
      )
  );

  it("rejects conflicting selector flags for generate", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const exit = yield* Effect.exit(
            runDocgenCommand([
              "generate",
              "--package",
              "packages/foundation/modeling/schema",
              "--filter",
              "@beep/schema",
            ])
          );

          const errorLines = yield* TestConsole.errorLines;

          expect(errorLines).toEqual([
            "docgen: Received conflicting selectors --package=packages/foundation/modeling/schema and --filter=@beep/schema.",
          ]);
          expectReportedExit(exit);
        })
      )
    )
  );

  it("writes lint-clean docgen.json during init", { timeout: DOCGEN_COMMAND_TEST_TIMEOUT }, () =>
    Effect.runPromise(
      withTempRepoCommand(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();

          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/foundation/*/*"],
            })
          );

          const packageDir = path.join(tmpDir, "packages", "foundation", "modeling", "schema");
          const docgenPath = path.join(packageDir, "docgen.json");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/schema",
              version: "0.0.0",
              exports: {
                ".": "./src/index.ts",
                "./*": "./src/*.ts",
              },
            })
          );

          yield* runDocgenCommand(["init", "-p", "packages/foundation/modeling/schema"]);

          const docgenText = yield* fs.readFileString(docgenPath);
          const docgenConfig = decodeUnknownJson(docgenText) as {
            readonly examplesCompilerOptions?: Record<string, unknown>;
          };

          expect(docgenText).toContain('"exclude": ["src/internal/**/*.ts"],');
          expect(docgenText).toContain('"lib": ["ESNext", "DOM", "DOM.Iterable"],');
          expect(docgenConfig.examplesCompilerOptions).not.toHaveProperty("paths");
          expect(process.exitCode ?? 0).toBe(0);
        })
      )
    )
  );

  it.effect("previews selected doctest rewrites as a schema-valid JSON report without writing", () =>
    withTempRepoCommand(
      Effect.gen(function* () {
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

        const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
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
        expect(yield* fs.readFileString(sourcePath)).toBe(before);
      })
    )
  );

  it.effect("resolves a filtered Doctest include relative to the selected package src directory", () =>
    withTempRepoCommand(
      Effect.gen(function* () {
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

        const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
        const report = yield* decodeDoctestReport(output);
        expect(report.config.include).toEqual(["console-rewrites.ts"]);
        expect(report.counts.files).toBe(1);
        expect(report.changedFiles).toEqual([`${DOCTEST_FIXTURE_PACKAGE}/src/console-rewrites.ts`]);
      })
    )
  );

  it.effect("writes canonical doctest markers and renders the human summary", () =>
    withTempRepoCommand(
      Effect.gen(function* () {
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
        const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
        expect(rewritten).toContain('```ts import.meta.vitest name="Marker fixtures"');
        expect(output).toContain("doctest: 1 file(s), 3 fence(s)");
        expect(output).toContain("missing-example-title");
      })
    )
  );

  it.effect("keeps pure-unmarked doctest findings warning-only", () =>
    withTempRepoCommand(
      Effect.gen(function* () {
        yield* writeDoctestCommandFixtureRepo();
        yield* runDocgenCommand(["doctest", "verify", "--include", `${DOCTEST_FIXTURE_PACKAGE}/src/purity.ts`]);

        const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
        expect(output).toContain("pure-unmarked");
        expect(yield* TestConsole.errorLines).toEqual([]);
      })
    )
  );

  it.effect("returns a reported error exit for blocking doctest findings after rendering JSON", () =>
    withTempRepoCommand(
      Effect.gen(function* () {
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

        const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
        const report = yield* decodeDoctestReport(output);
        expect(A.map(report.findings, (finding) => finding.kind)).toContain("missing-example-title");
        expect(A.join(A.filter(yield* TestConsole.errorLines, isString), "\n")).toContain(
          "Doctest verification found 2 blocking finding(s)."
        );
        expectReportedExit(exit);
      })
    )
  );

  it.effect("reports an invalid doctest mark preview through the rewrite error boundary", () =>
    withTempRepoCommand(
      Effect.gen(function* () {
        yield* writeDoctestCommandFixtureRepo();
        const exit = yield* Effect.exit(
          runDocgenCommand(["doctest", "mark", "--include", `${DOCTEST_FIXTURE_PACKAGE}/src/assertions.ts`])
        );

        expect(A.join(A.filter(yield* TestConsole.errorLines, isString), "\n")).toContain(
          "Rewritten fence failed upstream doctest transform validation."
        );
        expectReportedExit(exit);
      })
    )
  );
});

describe("DocgenQualityWorkerEvalReport schema", () => {
  it("every schema-derived report round-trips through its JSON codec", () => {
    const arbitrary = S.toArbitrary(DocgenQualityWorkerEvalReport)(fc);
    const encodeReportJson = S.encodeSync(S.fromJsonString(DocgenQualityWorkerEvalReport));
    const sameReport = S.toEquivalence(DocgenQualityWorkerEvalReport);

    fc.assert(
      fc.property(arbitrary, (report) => sameReport(report, decodeWorkerEvalReportJson(encodeReportJson(report)))),
      fcRuns(16)
    );
  });
});
