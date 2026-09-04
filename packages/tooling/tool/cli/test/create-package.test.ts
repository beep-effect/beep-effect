import { createPackageCommand } from "@beep/repo-cli/commands/CreatePackage";
import { FsUtilsLive, findRepoRoot, TSMorphServiceLive } from "@beep/repo-utils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import * as jsonc from "jsonc-parser";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const CommandPlatformLayer = Layer.mergeAll(NodeServices.layer);
const CommandTestLayer = Layer.mergeAll(
  CommandPlatformLayer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provideMerge(CommandPlatformLayer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(CommandPlatformLayer))
);
const runCreatePackageCommandRaw = Command.runWith(createPackageCommand, { version: "0.0.0" });
const shouldAppendSkipLockfile = (args: ReadonlyArray<string>): boolean =>
  !A.some(args, (arg) => arg === "--dry-run" || arg === "--skip-lockfile");
const runCreatePackageCommand = (args: ReadonlyArray<string>) =>
  runCreatePackageCommandRaw(shouldAppendSkipLockfile(args) ? [...args, "--skip-lockfile"] : args);
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const decodeUnknownJson = UnknownFromJsonString.decodeUnknownSync;
const CreatePackageTestTimeoutMs = 30_000;
const TestFileCwd = process.cwd();

const RootPackage = S.Struct({
  workspaces: S.Array(S.String),
});
const TsconfigReferences = S.Struct({
  references: S.Array(
    S.Struct({
      path: S.String,
    })
  ),
});
const PackageScripts = S.Struct({
  scripts: S.Record(S.String, S.String),
});
const TsconfigPaths = S.Struct({
  compilerOptions: S.Struct({
    paths: S.Record(S.String, S.Array(S.String)),
  }),
});
const TsconfigIncludes = S.Struct({
  include: S.Array(S.String),
});
const StoriesTsconfig = S.Struct({
  include: S.Array(S.String),
  compilerOptions: S.Struct({
    module: S.Literal("ESNext"),
    moduleResolution: S.Literal("Bundler"),
    rootDir: S.String,
    types: S.Array(S.String),
  }),
});
const StoriesDirectoryTsconfig = S.Struct({
  extends: S.Literal("../tsconfig.stories.json"),
});
const TypeScriptPluginsConfig = S.Struct({
  compilerOptions: S.Struct({
    plugins: S.Array(S.Record(S.String, S.Unknown)),
  }),
});
const GeneratedPackageManifest = S.Struct({
  scripts: S.Record(S.String, S.String),
  exports: S.optionalKey(S.Unknown),
  files: S.optionalKey(S.Unknown),
  publishConfig: S.optionalKey(S.Unknown),
  dependencies: S.optionalKey(S.Record(S.String, S.String)),
  devDependencies: S.optionalKey(S.Record(S.String, S.String)),
});
const FoundationPackageMetadata = S.Struct({
  beep: S.Struct({
    family: S.Literal("foundation"),
    kind: S.Literals(["primitive", "modeling", "capability", "ui-system"] as const),
  }),
  scripts: S.Record(S.String, S.String),
});
const ToolingPackageMetadata = S.Struct({
  beep: S.Struct({
    family: S.Literal("tooling"),
    kind: S.Literals(["library", "tool", "policy-pack", "test-kit"] as const),
  }),
  scripts: S.Record(S.String, S.String),
});
const DriverPackageMetadata = S.Struct({
  beep: S.Struct({
    family: S.Literal("drivers"),
  }),
  scripts: S.Record(S.String, S.String),
});
const EcosystemPackageMetadata = S.Struct({
  private: S.Literal(true),
  beep: S.Struct({
    family: S.Literal("ecosystem"),
    kind: S.optionalKey(S.String),
  }),
  sideEffects: S.Literal(false),
  exports: S.Record(S.String, S.String),
  files: S.Array(S.String),
  publishConfig: S.Struct({
    access: S.Literal("public"),
    provenance: S.Literal(true),
    exports: S.Record(S.String, S.String),
  }),
  scripts: S.Record(S.String, S.String),
  dependencies: S.optionalKey(S.Record(S.String, S.String)),
  peerDependencies: S.Record(S.String, S.String),
  optionalDependencies: S.optionalKey(S.Record(S.String, S.String)),
  bundledDependencies: S.optionalKey(S.Unknown),
  bundleDependencies: S.optionalKey(S.Unknown),
  devDependencies: S.Record(S.String, S.String),
});
const EcosystemProductionTsconfig = S.Struct({
  compilerOptions: S.Struct({
    stripInternal: S.Literal(true),
    plugins: S.Array(S.Record(S.String, S.Unknown)),
  }),
});
const EcosystemTestTsconfig = S.Struct({
  compilerOptions: S.Struct({
    plugins: S.Array(S.Record(S.String, S.Unknown)),
  }),
});

const decodeRootPackage = S.decodeUnknownSync(RootPackage);
const decodeTsconfigReferences = S.decodeUnknownSync(TsconfigReferences);
const decodeTsconfigPaths = S.decodeUnknownSync(TsconfigPaths);
const decodeTsconfigIncludes = S.decodeUnknownSync(TsconfigIncludes);
const decodeStoriesTsconfig = S.decodeUnknownSync(StoriesTsconfig);
const decodeStoriesDirectoryTsconfig = S.decodeUnknownSync(StoriesDirectoryTsconfig);
const decodeTypeScriptPluginsConfig = S.decodeUnknownEffect(TypeScriptPluginsConfig);
const decodePackageScripts = S.decodeUnknownSync(PackageScripts);
const decodeGeneratedPackageManifest = S.decodeUnknownSync(GeneratedPackageManifest);
const decodeFoundationPackageMetadata = S.decodeUnknownSync(FoundationPackageMetadata);
const decodeToolingPackageMetadata = S.decodeUnknownSync(ToolingPackageMetadata);
const decodeDriverPackageMetadata = S.decodeUnknownSync(DriverPackageMetadata);
const decodeEcosystemPackageMetadata = S.decodeUnknownSync(EcosystemPackageMetadata);
const decodeEcosystemProductionTsconfig = S.decodeUnknownSync(EcosystemProductionTsconfig);
const decodeEcosystemTestTsconfig = S.decodeUnknownSync(EcosystemTestTsconfig);
const decodeUnknownRecord = S.decodeUnknownSync(S.Record(S.String, S.Unknown));
const StoriesTsconfigArbitrary = S.toArbitrary(StoriesTsconfig)(fc);
const StoriesDirectoryTsconfigArbitrary = S.toArbitrary(StoriesDirectoryTsconfig)(fc);
const TestRootTypeScriptPlugins = [
  {
    name: "@effect/language-service",
    namespaceImportPackages: ["effect", "@effect/*", "@beep/*"],
    includeSuggestionsInTsc: true,
    importAliases: {
      Array: "A",
      Schema: "S",
    },
    diagnosticSeverity: {
      canonicalFixtureRule: "error",
      missedPipeableOpportunity: "error",
      missingPipeableSignature: "error",
    },
  },
  {
    name: "canonical-fixture-plugin",
    fixtureOption: true,
  },
];
type TypeScriptPluginConfig = (typeof TypeScriptPluginsConfig.Type)["compilerOptions"]["plugins"][number];
const withSanctionedEcosystemDiagnosticDelta = (
  plugins: ReadonlyArray<TypeScriptPluginConfig>
): ReadonlyArray<TypeScriptPluginConfig> =>
  A.map(plugins, (plugin) =>
    plugin.name === "@effect/language-service"
      ? {
          ...plugin,
          diagnosticSeverity: {
            ...decodeUnknownRecord(plugin.diagnosticSeverity),
            missedPipeableOpportunity: "off",
            missingPipeableSignature: "off",
          },
        }
      : plugin
  );
const ExpectedGeneratedQualityScripts = {
  audit: "bun run --if-present beep:audit",
  babel: "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps",
  "beep:audit":
    "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run beep:policy && bun run beep:docgen && bun run beep:lint",
  "beep:build": "tsc -p tsconfig.json && bun run babel",
  "beep:check": "tsgo -p tsconfig.check.json && bun run beep:check:tests",
  "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
  "beep:docgen": expect.any(String),
  "beep:lint": "biome check .",
  "beep:lint:fix": "biome check . --write",
  "beep:policy": expect.any(String),
  "beep:test": "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
  "beep:test:integration": "bunx --bun vitest run test/integration --passWithNoTests",
  build: "bun run beep:build",
  check: "bun run beep:check",
  coverage: "bunx vitest run --coverage --exclude=test/integration/**",
  lint: "bun run beep:lint",
  "lint:fix": "bun run beep:lint:fix",
  test: "bun run beep:test",
  "test:integration": "bun run beep:test:integration",
} as const;
const ExpectedGeneratedStoriesQualityScripts = {
  ...ExpectedGeneratedQualityScripts,
  "beep:check": "tsgo -p tsconfig.check.json && bun run beep:check:tests && bun run beep:check:stories",
  "beep:check:stories": "tsc -p tsconfig.stories.json --noEmit",
} as const;
const ExpectedNextjsAppScripts = {
  audit: "bun run --if-present beep:audit",
  codegen: "echo 'no codegen needed'",
  dev: "portless marketing-web.beep next dev --turbopack",
  "beep:audit": "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
  "beep:build": "next build --turbopack",
  "beep:check": "tsgo -p tsconfig.check.json && tsc -p tsconfig.json --noEmit",
  "beep:lint": "biome check .",
  "beep:lint:fix": "biome check . --write",
  "beep:test": "bunx --bun vitest run",
  build: "bun run beep:build",
  check: "bun run beep:check",
  coverage: "bunx vitest run --coverage",
  lint: "bun run beep:lint",
  "lint:fix": "bun run beep:lint:fix",
  start: "next start",
  test: "bun run beep:test",
} as const;
const ExpectedTauriAppScripts = {
  audit: "bun run --if-present beep:audit",
  codegen: "echo 'no codegen needed'",
  dev: "portless desktop-shell.beep sh -c 'vite --host 127.0.0.1 --port \"${PORT:-1420}\" --strictPort'",
  "dev:tauri": "tauri dev",
  "beep:audit": "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
  "beep:build": "vite build",
  "beep:check": "tsgo -p tsconfig.check.json && tsc -p tsconfig.json --noEmit",
  "beep:lint": "biome check .",
  "beep:lint:fix": "biome check . --write",
  "beep:test": "bunx --bun vitest run",
  build: "bun run beep:build",
  check: "bun run beep:check",
  coverage: "bunx vitest run --coverage",
  lint: "bun run beep:lint",
  "lint:fix": "bun run beep:lint:fix",
  test: "bun run beep:test",
} as const;

const withTempRepoCommand = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = yield* fs.makeTempDirectory();

      process.chdir(tmpDir);
      yield* fs.makeDirectory(path.join(tmpDir, ".git"), { recursive: true });

      return { fs, tmpDir } as const;
    }),
    () => use,
    ({ fs, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(TestFileCwd);
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  ).pipe(provideScopedLayer(CommandTestLayer), Effect.orDie);

const writeTextFile = Effect.fn(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const writeJsonFile = Effect.fn(function* (filePath: string, value: unknown) {
  yield* writeTextFile(filePath, `${encodeJson(value)}\n`);
});

const readJsonFile = Effect.fn(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return decodeUnknownJson(yield* fs.readFileString(filePath));
});

const readJsoncFile = Effect.fn(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return jsonc.parse(yield* fs.readFileString(filePath), undefined, {
    allowTrailingComma: true,
    disallowComments: false,
  });
});

const toFailureMessage = (error: unknown): string =>
  typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : String(error);

const writeSyncpackConfig = (filePath: string, sources: ReadonlyArray<string>) =>
  writeTextFile(
    filePath,
    `import type { RcFile } from "syncpack";

const config = {
  source: [
${A.join(
  A.map(sources, (source) => `    "${source}",`),
  "\n"
)}
  ],
  customTypes: {},
  versionGroups: [],
} satisfies RcFile;

export default config;
`
  );

const withBunShim = <A, E, R>(binDir: string, argsFilePath: string, use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previousPath = Bun.env.PATH;
      const previousArgsFilePath = Bun.env.BEEP_CREATE_PACKAGE_BUN_ARGS_FILE;
      Bun.env.PATH = previousPath === undefined ? binDir : `${binDir}:${previousPath}`;
      Bun.env.BEEP_CREATE_PACKAGE_BUN_ARGS_FILE = argsFilePath;
      return { previousArgsFilePath, previousPath } as const;
    }),
    () => use,
    ({ previousArgsFilePath, previousPath }) =>
      Effect.sync(() => {
        Bun.env.PATH = previousPath;
        Bun.env.BEEP_CREATE_PACKAGE_BUN_ARGS_FILE = previousArgsFilePath;
      })
  );

const writeBunShim = Effect.fn(function* (binDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const shimPath = path.join(binDir, "bun");
  yield* writeTextFile(
    shimPath,
    `#!/usr/bin/env bash
set -euo pipefail
: "\${BEEP_CREATE_PACKAGE_BUN_ARGS_FILE:?}"
printf '%s\\n' "$@" > "$BEEP_CREATE_PACKAGE_BUN_ARGS_FILE"
`
  );
  yield* fs.chmod(shimPath, 0o755);
});

const bootstrapIdentityWorkspace = Effect.fn(function* (
  rootDir: string,
  relativeDir = "packages/foundation/modeling/identity"
) {
  const path = yield* Path.Path;
  const identityDir = path.join(rootDir, ...Str.split("/")(relativeDir));

  yield* writeJsonFile(path.join(identityDir, "package.json"), {
    name: "@beep/identity",
    version: "0.0.0",
    exports: {
      ".": "./src/index.ts",
      "./*": "./src/*.ts",
    },
  });
  yield* writeJsonFile(path.join(identityDir, "tsconfig.json"), {
    compilerOptions: {
      outDir: "dist",
      rootDir: "src",
    },
    include: ["src/**/*.ts"],
  });
  yield* writeTextFile(path.join(identityDir, "src", "index.ts"), `export * from "./packages.ts";\n`);
  yield* writeTextFile(path.join(identityDir, "src", "Id.ts"), `export type IdentityComposer<T extends string> = T;\n`);
  yield* writeTextFile(
    path.join(identityDir, "src", "packages.ts"),
    `import * as Identity from "./Id.ts";

export const $I = {
  compose: (..._segments: ReadonlyArray<string>) => ({
    $IdentityId: "@beep/identity" as Identity.IdentityComposer<"@beep/identity">,
  }),
};

const composers = $I.compose(
  "identity",
);

export const $IdentityId: Identity.IdentityComposer<"@beep/identity"> = composers.$IdentityId;
`
  );
});

type RootConfigOptions = {
  readonly workspaces: ReadonlyArray<string>;
  readonly references: ReadonlyArray<string>;
  readonly paths: Record<string, ReadonlyArray<string>>;
  readonly syncpackSources: ReadonlyArray<string>;
};

type TempRepoCommandContext = {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly rootDir: string;
};

// See create-package-lab.test.ts: without a root biome config the fixture gets
// biome's default tab indentation, which desynchronizes generated JSON from the
// repo's canonical two-space renderer.
const TestRootBiomeConfig = {
  formatter: { enabled: true, lineWidth: 120, indentStyle: "space", indentWidth: 2 },
  json: {
    formatter: { indentStyle: "space", indentWidth: 2, trailingCommas: "none", lineWidth: 80 },
    parser: { allowComments: true },
  },
} as const;

const bootstrapRootConfig = Effect.fn(function* (rootDir: string, options: RootConfigOptions) {
  const path = yield* Path.Path;

  yield* writeJsonFile(path.join(rootDir, "package.json"), {
    name: "@beep/test-root",
    private: true,
    catalog: {
      effect: "4.0.0-beta.106",
    },
    workspaces: options.workspaces,
  });
  yield* writeJsonFile(path.join(rootDir, "tsconfig.json"), {
    compilerOptions: {
      paths: options.paths,
    },
  });
  yield* writeJsonFile(path.join(rootDir, "tsconfig.base.json"), {
    compilerOptions: {
      plugins: TestRootTypeScriptPlugins,
    },
  });
  yield* writeJsonFile(path.join(rootDir, "tsconfig.packages.json"), {
    references: A.map(options.references, (referencePath) => ({ path: referencePath })),
  });
  yield* writeJsonFile(path.join(rootDir, "biome.json"), TestRootBiomeConfig);
  yield* writeSyncpackConfig(path.join(rootDir, "syncpack.config.ts"), options.syncpackSources);
});

describe("create-package", { concurrent: false }, () => {
  const FoundationIdentityRootConfig = {
    workspaces: ["packages/foundation/*/*"],
    references: ["packages/foundation/modeling/identity"],
    paths: {
      "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
      "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
    },
    syncpackSources: ["package.json", "packages/foundation/*/*/package.json"],
  } satisfies RootConfigOptions;

  const PackageParentRootConfig = {
    workspaces: ["packages/foundation/*/*"],
    references: ["packages/foundation/modeling/identity"],
    paths: {
      "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
      "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
    },
    syncpackSources: ["package.json", "packages/foundation/*/*/package.json"],
  } satisfies RootConfigOptions;

  const IdentityOnlyRootConfig = {
    workspaces: ["packages/foundation/modeling/identity"],
    references: ["packages/foundation/modeling/identity"],
    paths: {
      "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
      "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
    },
    syncpackSources: ["package.json", "packages/foundation/modeling/identity/package.json"],
  } satisfies RootConfigOptions;

  const withBootstrappedRootConfig = <A, E, R>(
    options: RootConfigOptions,
    use: (context: TempRepoCommandContext) => Effect.Effect<A, E, R>
  ) =>
    withTempRepoCommand(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const rootDir = process.cwd();
        yield* bootstrapRootConfig(rootDir, options);
        return yield* use({ fs, path, rootDir });
      })
    );

  const expectIdentityRegistration = Effect.fn(function* (
    context: TempRepoCommandContext,
    packageName: string,
    composerName: string
  ) {
    const identityPackages = yield* context.fs.readFileString(
      context.path.join(context.rootDir, "packages", "foundation", "modeling", "identity", "src", "packages.ts")
    );
    expect(identityPackages).toContain(`"${packageName}"`);
    expect(identityPackages).toContain(`export const $${composerName}Id`);
  });

  const bootstrapFoundationIdentityRoot = Effect.fn(function* (rootDir: string) {
    yield* bootstrapRootConfig(rootDir, FoundationIdentityRootConfig);
    yield* bootstrapIdentityWorkspace(rootDir);
  });

  it("property: Storybook tsconfig schemas round-trip derived values", () => {
    fc.assert(
      fc.property(StoriesTsconfigArbitrary, StoriesDirectoryTsconfigArbitrary, (storiesTsconfig, storiesDirectory) => {
        expect(decodeStoriesTsconfig(S.encodeSync(StoriesTsconfig)(storiesTsconfig))).toEqual(storiesTsconfig);
        expect(decodeStoriesDirectoryTsconfig(S.encodeSync(StoriesDirectoryTsconfig)(storiesDirectory))).toEqual(
          storiesDirectory
        );
      }),
      fcRuns(16)
    );
  });

  it(
    "keeps the checked-in OIP plugin profile aligned with the canonical root profile",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          const rootConfig = yield* decodeTypeScriptPluginsConfig(
            yield* readJsoncFile(path.join(repoRoot, "tsconfig.base.json"))
          );
          const oipConfig = yield* decodeTypeScriptPluginsConfig(
            yield* readJsoncFile(path.join(repoRoot, "apps", "oip-web", "tsconfig.json"))
          );

          expect(oipConfig.compilerOptions.plugins).toEqual(
            A.append(rootConfig.compilerOptions.plugins, { name: "next" })
          );
        }).pipe(provideScopedLayer(CommandTestLayer), Effect.orDie)
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "refreshes bun.lock with bun install --lockfile-only by default",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(PackageParentRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            const binDir = path.join(rootDir, ".bin");
            const bunArgsPath = path.join(rootDir, "bun-args.txt");

            yield* bootstrapIdentityWorkspace(rootDir);
            yield* fs.makeDirectory(binDir, { recursive: true });
            yield* writeBunShim(binDir);

            yield* withBunShim(
              binDir,
              bunArgsPath,
              runCreatePackageCommandRaw(["box", "--family", "drivers", "--description", "Box driver package"])
            );

            expect(yield* fs.readFileString(bunArgsPath)).toBe("install\n--lockfile-only\n");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "adds top-level package workspaces, identity exports, and shared config sync outputs",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(PackageParentRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            yield* bootstrapIdentityWorkspace(rootDir);

            yield* runCreatePackageCommand([
              "example-domain",
              "--parent-dir",
              "packages",
              "--description",
              "An editor package",
            ]);

            const rootPackage = decodeRootPackage(yield* readJsonFile(path.join(rootDir, "package.json")));
            expect(rootPackage.workspaces).toEqual(["packages/foundation/*/*", "packages/example-domain"]);

            const generatedPackage = decodePackageScripts(
              yield* readJsonFile(path.join(rootDir, "packages", "example-domain", "package.json"))
            );
            expect(generatedPackage.scripts).toMatchObject(ExpectedGeneratedQualityScripts);
            expect(generatedPackage.scripts.docgen).toBe("bun run beep:docgen");
            expect(generatedPackage.scripts.codegen).toBeUndefined();
            expect(yield* fs.exists(path.join(rootDir, "packages", "example-domain", "ai-context.md"))).toBe(false);

            const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
            expect(rootTsconfig.compilerOptions.paths).toMatchObject({
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
              "@beep/example-domain": ["./packages/example-domain/src/index.ts"],
              "@beep/example-domain/*": ["./packages/example-domain/src/*"],
            });

            const packageRefs = decodeTsconfigReferences(
              yield* readJsoncFile(path.join(rootDir, "tsconfig.packages.json"))
            );
            expect(A.map(packageRefs.references, (entry) => entry.path)).toEqual([
              "packages/example-domain",
              "packages/foundation/modeling/identity",
            ]);

            const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
            expect(syncpackConfig).toContain(`"packages/example-domain/package.json"`);

            yield* expectIdentityRegistration({ fs, path, rootDir }, "example-domain", "ExampleDomain");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "requires an explicit app kind for app scaffolds",
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const result = yield* runCreatePackageCommand(["proof-app", "--type", "app"]).pipe(
              Effect.match({
                onFailure: toFailureMessage,
                onSuccess: () => "success",
              })
            );

            expect(result).toContain("--type app requires --app-kind nextjs, vite, service, tauri, or runtime-proof");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "refuses to scaffold into a directory that already exists",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(IdentityOnlyRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            yield* bootstrapIdentityWorkspace(rootDir);
            yield* runCreatePackageCommand([
              "occupied-app",
              "--type",
              "app",
              "--app-kind",
              "vite",
              "--description",
              "First scaffold",
            ]);

            const packageDir = path.join(rootDir, "apps", "occupied-app");
            const sentinel = path.join(packageDir, "src-tauri", "icons", "icon.png");
            yield* fs.makeDirectory(path.dirname(sentinel), { recursive: true });
            yield* fs.writeFileString(sentinel, "author-replaced");

            const result = yield* runCreatePackageCommand([
              "occupied-app",
              "--type",
              "app",
              "--app-kind",
              "tauri",
              "--description",
              "Second scaffold over the first",
            ]).pipe(
              Effect.match({
                onFailure: toFailureMessage,
                onSuccess: () => "success",
              })
            );

            expect(result).toContain("Directory already exists");
            // This refusal is what keeps the plan's `copy-asset` action safe to
            // write unconditionally: a generated asset can never land on top of
            // one an author edited, because a second scaffold never runs. If this
            // guard is ever relaxed, the overwrite in
            // `FileGenerationPlanService` becomes reachable and needs its own
            // skip-if-present branch.
            expect(yield* fs.readFileString(sentinel)).toBe("author-replaced");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates Next.js apps without package API boilerplate",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(IdentityOnlyRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            yield* bootstrapIdentityWorkspace(rootDir);

            yield* runCreatePackageCommand([
              "marketing-web",
              "--type",
              "app",
              "--app-kind",
              "nextjs",
              "--description",
              "A Next.js marketing app",
            ]);

            const packageDir = path.join(rootDir, "apps", "marketing-web");
            const generatedPackage = decodeGeneratedPackageManifest(
              yield* readJsonFile(path.join(packageDir, "package.json"))
            );

            expect(generatedPackage.scripts).toMatchObject(ExpectedNextjsAppScripts);
            expect(generatedPackage.scripts.docgen).toBeUndefined();
            expect(generatedPackage.exports).toBeUndefined();
            expect(generatedPackage.files).toBeUndefined();
            expect(generatedPackage.publishConfig).toBeUndefined();
            expect(generatedPackage.dependencies).toMatchObject({
              next: "catalog:",
              react: "catalog:",
              "react-dom": "catalog:",
            });

            expect(yield* fs.exists(path.join(packageDir, "src", "index.ts"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "docgen.json"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "src", "app", "page.tsx"))).toBe(true);

            const appTsconfigDocument = yield* readJsoncFile(path.join(packageDir, "tsconfig.json"));
            const appTsconfig = decodeTsconfigPaths(appTsconfigDocument);
            expect(decodeTsconfigIncludes(appTsconfigDocument).include).toContain(
              "../../vitest.aliases.generated.json"
            );
            const appPlugins = yield* decodeTypeScriptPluginsConfig(appTsconfigDocument);
            expect(appTsconfig.compilerOptions.paths).toMatchObject({
              "@/*": ["./src/*"],
            });
            expect(appPlugins.compilerOptions.plugins).toEqual(A.append(TestRootTypeScriptPlugins, { name: "next" }));

            const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
            expect(rootTsconfig.compilerOptions.paths["@beep/marketing-web"]).toBeUndefined();
            expect(rootTsconfig.compilerOptions.paths["@beep/marketing-web/*"]).toBeUndefined();

            const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
            expect(syncpackConfig).toContain(`"apps/marketing-web/package.json"`);

            yield* expectIdentityRegistration({ fs, path, rootDir }, "marketing-web", "MarketingWeb");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates Tauri apps without package API boilerplate",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(IdentityOnlyRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            yield* bootstrapIdentityWorkspace(rootDir);

            yield* runCreatePackageCommand([
              "desktop-shell",
              "--type",
              "app",
              "--app-kind",
              "tauri",
              "--description",
              "A Tauri desktop shell",
            ]);

            const packageDir = path.join(rootDir, "apps", "desktop-shell");
            const generatedPackage = decodeGeneratedPackageManifest(
              yield* readJsonFile(path.join(packageDir, "package.json"))
            );

            expect(generatedPackage.scripts).toMatchObject(ExpectedTauriAppScripts);
            expect(generatedPackage.scripts.docgen).toBeUndefined();
            expect(generatedPackage.exports).toBeUndefined();
            expect(generatedPackage.files).toBeUndefined();
            expect(generatedPackage.publishConfig).toBeUndefined();
            expect(generatedPackage.dependencies).toMatchObject({
              "@tauri-apps/api": "catalog:",
              react: "catalog:",
              "react-dom": "catalog:",
            });

            expect(yield* fs.exists(path.join(packageDir, "src", "index.ts"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "docgen.json"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "src", "App.tsx"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "src-tauri", "tauri.conf.json"))).toBe(true);

            // `tauri::generate_context!()` opens this icon while the macro expands, so
            // a Tauri crate without it does not compile. Assert the PNG signature
            // rather than mere existence: the asset path exists precisely because a
            // Handlebars string round-trip would corrupt these high bytes.
            const iconBytes = yield* fs.readFile(path.join(packageDir, "src-tauri", "icons", "icon.png"));
            expect(A.take(A.fromIterable(iconBytes), 8)).toStrictEqual([
              0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]);
            expect(iconBytes.length).toBeGreaterThan(1024);

            const tauriConf = yield* fs.readFileString(path.join(packageDir, "src-tauri", "tauri.conf.json"));
            expect(tauriConf).toContain(`"icon": ["icons/icon.png"]`);
            // The webview must load the same portless route the `dev` script serves.
            expect(tauriConf).toContain(`"devUrl": "http://desktop-shell.beep.localhost:1355"`);

            const appTsconfigDocument = yield* readJsoncFile(path.join(packageDir, "tsconfig.json"));
            const appTsconfig = decodeTsconfigPaths(appTsconfigDocument);
            expect(decodeTsconfigIncludes(appTsconfigDocument).include).toContain(
              "../../vitest.aliases.generated.json"
            );
            expect(appTsconfig.compilerOptions.paths).toMatchObject({
              "@/*": ["./src/*"],
            });

            const viteConfig = yield* fs.readFileString(path.join(packageDir, "vite.config.ts"));
            const vitestConfig = yield* fs.readFileString(path.join(packageDir, "vitest.config.ts"));
            expect(viteConfig).toContain(`"@": fileURLToPath(new URL("./src", import.meta.url))`);
            expect(vitestConfig).toContain(`"@": fileURLToPath(new URL("./src", import.meta.url))`);

            const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
            expect(rootTsconfig.compilerOptions.paths["@beep/desktop-shell"]).toBeUndefined();
            expect(rootTsconfig.compilerOptions.paths["@beep/desktop-shell/*"]).toBeUndefined();

            yield* expectIdentityRegistration({ fs, path, rootDir }, "desktop-shell", "DesktopShell");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates Vite apps without package API boilerplate and skips workspace append when apps/* covers the path",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(
          {
            workspaces: ["packages/foundation/modeling/identity", "apps/*"],
            references: ["packages/foundation/modeling/identity"],
            paths: {
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
            },
            syncpackSources: ["package.json", "packages/foundation/modeling/identity/package.json"],
          },
          ({ fs, path, rootDir }) =>
            Effect.gen(function* () {
              yield* bootstrapIdentityWorkspace(rootDir);

              yield* runCreatePackageCommand([
                "vite-shell",
                "--type",
                "app",
                "--app-kind",
                "vite",
                "--description",
                "A Vite app shell",
              ]);

              const packageDir = path.join(rootDir, "apps", "vite-shell");
              const generatedPackage = decodeGeneratedPackageManifest(
                yield* readJsonFile(path.join(packageDir, "package.json"))
              );

              expect(generatedPackage.scripts["beep:check"]).toBe(
                "tsgo -p tsconfig.check.json && tsc -p tsconfig.json --noEmit"
              );
              expect(generatedPackage.scripts.dev).toBe(
                "portless vite-shell.beep sh -c 'vite --host 127.0.0.1 --port \"${PORT:-5173}\" --strictPort'"
              );
              expect(generatedPackage.scripts.docgen).toBeUndefined();
              expect(generatedPackage.exports).toBeUndefined();
              expect(generatedPackage.files).toBeUndefined();
              expect(generatedPackage.publishConfig).toBeUndefined();
              expect(generatedPackage.dependencies).toMatchObject({
                react: "catalog:",
                "react-dom": "catalog:",
              });

              const rootPackage = decodeRootPackage(yield* readJsonFile(path.join(rootDir, "package.json")));
              expect(rootPackage.workspaces).toEqual(["packages/foundation/modeling/identity", "apps/*"]);

              expect(yield* fs.exists(path.join(packageDir, "src", "App.tsx"))).toBe(true);
              expect(yield* fs.exists(path.join(packageDir, "index.html"))).toBe(true);
              expect(yield* fs.exists(path.join(packageDir, "postcss.config.mjs"))).toBe(false);
              expect(yield* fs.exists(path.join(packageDir, "docgen.json"))).toBe(false);
              const globalsCss = yield* fs.readFileString(path.join(packageDir, "src", "styles", "globals.css"));
              expect(globalsCss).toContain(":root");
              const appTsconfig = yield* readJsoncFile(path.join(packageDir, "tsconfig.json"));
              expect(decodeTsconfigIncludes(appTsconfig).include).toContain("../../vitest.aliases.generated.json");
              expect(appTsconfig.compilerOptions.rootDir).toBe("../..");

              yield* expectIdentityRegistration({ fs, path, rootDir }, "vite-shell", "ViteShell");
            })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates service apps with canonical composite checks and JSON dependencies",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(IdentityOnlyRootConfig, ({ path, rootDir }) =>
          Effect.gen(function* () {
            yield* bootstrapIdentityWorkspace(rootDir);

            yield* runCreatePackageCommand([
              "api-service",
              "--type",
              "app",
              "--app-kind",
              "service",
              "--description",
              "An HTTP service app",
            ]);

            const packageDir = path.join(rootDir, "apps", "api-service");
            const generatedPackage = decodeGeneratedPackageManifest(
              yield* readJsonFile(path.join(packageDir, "package.json"))
            );
            expect(generatedPackage.scripts["beep:check"]).toBe(
              "tsgo -p tsconfig.check.json && tsc -p tsconfig.json --noEmit"
            );

            const appTsconfig = yield* readJsoncFile(path.join(packageDir, "tsconfig.json"));
            expect(decodeTsconfigIncludes(appTsconfig).include).toContain("../../vitest.aliases.generated.json");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "keeps runtime-proof apps package-like",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(IdentityOnlyRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            yield* bootstrapIdentityWorkspace(rootDir);

            yield* runCreatePackageCommand([
              "runtime-proof-lab",
              "--type",
              "app",
              "--app-kind",
              "runtime-proof",
              "--description",
              "A runtime proof harness",
            ]);

            const packageDir = path.join(rootDir, "apps", "runtime-proof-lab");
            const generatedPackage = decodeGeneratedPackageManifest(
              yield* readJsonFile(path.join(packageDir, "package.json"))
            );

            expect(generatedPackage.scripts).toMatchObject(ExpectedGeneratedQualityScripts);
            expect(generatedPackage.scripts.docgen).toBe("bun run beep:docgen");
            expect(generatedPackage.exports).toMatchObject({
              ".": "./src/index.ts",
              "./package.json": "./package.json",
            });
            expect(yield* fs.exists(path.join(packageDir, "src", "index.ts"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "docgen.json"))).toBe(true);

            const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
            expect(rootTsconfig.compilerOptions.paths).toMatchObject({
              "@beep/runtime-proof-lab": ["./apps/runtime-proof-lab/src/index.ts"],
              "@beep/runtime-proof-lab/*": ["./apps/runtime-proof-lab/src/*"],
            });

            yield* expectIdentityRegistration({ fs, path, rootDir }, "runtime-proof-lab", "RuntimeProofLab");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates canonical foundation packages with family metadata and workspace-resolved identity registration",
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const rootDir = process.cwd();
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;

            yield* bootstrapFoundationIdentityRoot(rootDir);

            yield* runCreatePackageCommand([
              "schema-kit",
              "--family",
              "foundation",
              "--kind",
              "modeling",
              "--description",
              "A schema helper package",
            ]);

            const rootPackage = decodeRootPackage(yield* readJsonFile(path.join(rootDir, "package.json")));
            expect(rootPackage.workspaces).toEqual(["packages/foundation/*/*"]);

            const generatedPackage = decodeFoundationPackageMetadata(
              yield* readJsonFile(
                path.join(rootDir, "packages", "foundation", "modeling", "schema-kit", "package.json")
              )
            );
            expect(generatedPackage.beep).toEqual({
              family: "foundation",
              kind: "modeling",
            });
            expect(generatedPackage.scripts).toMatchObject(ExpectedGeneratedQualityScripts);
            expect(generatedPackage.scripts.docgen).toBe("bun run beep:docgen");

            const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
            expect(rootTsconfig.compilerOptions.paths).toMatchObject({
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
              "@beep/schema-kit": ["./packages/foundation/modeling/schema-kit/src/index.ts"],
              "@beep/schema-kit/*": ["./packages/foundation/modeling/schema-kit/src/*"],
            });

            const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
            expect(syncpackConfig).toContain(`"packages/foundation/*/*/package.json"`);
            expect(syncpackConfig).not.toContain(`"packages/foundation/modeling/schema-kit/package.json"`);

            yield* expectIdentityRegistration({ fs, path, rootDir }, "schema-kit", "SchemaKit");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "generates opt-in Storybook story typecheck config for foundation ui-system packages",
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const rootDir = process.cwd();

            yield* bootstrapFoundationIdentityRoot(rootDir);

            yield* runCreatePackageCommand([
              "design-kit",
              "--family",
              "foundation",
              "--kind",
              "ui-system",
              "--description",
              "A UI system package",
              "--with-stories-tsconfig",
            ]);

            const packageDir = path.join(rootDir, "packages", "foundation", "ui-system", "design-kit");
            const generatedPackage = decodeFoundationPackageMetadata(
              yield* readJsonFile(path.join(packageDir, "package.json"))
            );
            expect(generatedPackage.beep).toEqual({
              family: "foundation",
              kind: "ui-system",
            });
            expect(generatedPackage.scripts).toMatchObject(ExpectedGeneratedStoriesQualityScripts);

            const storiesTsconfig = decodeStoriesTsconfig(
              yield* readJsoncFile(path.join(packageDir, "tsconfig.stories.json"))
            );
            expect(storiesTsconfig.include).toEqual(["src", "stories"]);
            expect(storiesTsconfig.compilerOptions).toMatchObject({
              module: "ESNext",
              moduleResolution: "Bundler",
              rootDir: "../../../../.",
              types: ["node", "vite/client"],
            });
            expect(
              decodeStoriesDirectoryTsconfig(yield* readJsoncFile(path.join(packageDir, "stories", "tsconfig.json")))
            ).toEqual({
              extends: "../tsconfig.stories.json",
            });

            yield* runCreatePackageCommand([
              "story-dry-run",
              "--family",
              "foundation",
              "--kind",
              "ui-system",
              "--description",
              "A dry-run UI system package",
              "--with-stories-tsconfig",
              "--dry-run",
            ]);
            const dryRunOutput = A.join(A.map(yield* TestConsole.logLines, String), "\n");
            expect(dryRunOutput).toContain("tsconfig.stories.json");
            expect(dryRunOutput).toContain("stories/tsconfig.json");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "rejects stories tsconfig generation outside foundation ui-system package scaffolds",
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const result = yield* runCreatePackageCommand([
              "schema-kit",
              "--family",
              "foundation",
              "--kind",
              "modeling",
              "--description",
              "A schema helper package",
              "--with-stories-tsconfig",
            ]).pipe(
              Effect.match({
                onFailure: toFailureMessage,
                onSuccess: () => "success",
              })
            );

            expect(result).toContain("--with-stories-tsconfig is only valid for --family foundation --kind ui-system");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates canonical tooling packages with family metadata",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(
          {
            workspaces: ["packages/foundation/*/*", "packages/tooling/tool/cli"],
            references: ["packages/foundation/modeling/identity", "packages/tooling/tool/cli"],
            paths: {
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
              "@beep/repo-cli": ["./packages/tooling/tool/cli/src/index.ts"],
              "@beep/repo-cli/*": ["./packages/tooling/tool/cli/src/*"],
            },
            syncpackSources: [
              "package.json",
              "packages/foundation/*/*/package.json",
              "packages/tooling/tool/cli/package.json",
            ],
          },
          ({ fs, path, rootDir }) =>
            Effect.gen(function* () {
              yield* bootstrapIdentityWorkspace(rootDir);
              yield* writeJsonFile(path.join(rootDir, "packages", "tooling", "tool", "cli", "package.json"), {
                name: "@beep/repo-cli",
                version: "0.0.0",
                exports: {
                  ".": "./src/index.ts",
                  "./*": "./src/*.ts",
                },
              });
              yield* writeJsonFile(path.join(rootDir, "packages", "tooling", "tool", "cli", "tsconfig.json"), {
                compilerOptions: {
                  outDir: "dist",
                  rootDir: "src",
                },
                include: ["src/**/*.ts"],
              });
              yield* writeTextFile(
                path.join(rootDir, "packages", "tooling", "tool", "cli", "src", "index.ts"),
                "export {};\n"
              );

              yield* runCreatePackageCommand([
                "repo-utils",
                "--family",
                "tooling",
                "--kind",
                "library",
                "--description",
                "Repo helpers",
              ]);

              const rootPackage = decodeRootPackage(yield* readJsonFile(path.join(rootDir, "package.json")));
              expect(rootPackage.workspaces).toEqual([
                "packages/foundation/*/*",
                "packages/tooling/tool/cli",
                "packages/tooling/library/repo-utils",
              ]);
              expect(rootPackage.workspaces).not.toContain("packages/tooling/*/*");

              const generatedPackage = decodeToolingPackageMetadata(
                yield* readJsonFile(path.join(rootDir, "packages", "tooling", "library", "repo-utils", "package.json"))
              );
              expect(generatedPackage.beep).toEqual({
                family: "tooling",
                kind: "library",
              });
              expect(generatedPackage.scripts.docgen).toBe("bun run beep:docgen");

              const packageRefs = decodeTsconfigReferences(
                yield* readJsoncFile(path.join(rootDir, "tsconfig.packages.json"))
              );
              expect(A.map(packageRefs.references, (entry) => entry.path)).toEqual([
                "packages/foundation/modeling/identity",
                "packages/tooling/library/repo-utils",
                "packages/tooling/tool/cli",
              ]);

              const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
              expect(syncpackConfig).toContain(`"packages/tooling/library/repo-utils/package.json"`);
              expect(syncpackConfig).not.toContain(`"packages/tooling/*/*/package.json"`);
            })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates canonical driver packages with flat family metadata",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(
          {
            workspaces: ["packages/foundation/*/*", "packages/drivers/*"],
            references: ["packages/foundation/modeling/identity"],
            paths: {
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
            },
            syncpackSources: [
              "package.json",
              "packages/foundation/*/*/package.json",
              "packages/drivers/*/package.json",
            ],
          },
          ({ fs, path, rootDir }) =>
            Effect.gen(function* () {
              yield* bootstrapIdentityWorkspace(rootDir);

              yield* runCreatePackageCommand([
                "runpod",
                "--family",
                "drivers",
                "--description",
                "Runpod API driver package",
              ]);

              const rootPackage = decodeRootPackage(yield* readJsonFile(path.join(rootDir, "package.json")));
              expect(rootPackage.workspaces).toEqual(["packages/foundation/*/*", "packages/drivers/*"]);

              const generatedPackage = decodeDriverPackageMetadata(
                yield* readJsonFile(path.join(rootDir, "packages", "drivers", "runpod", "package.json"))
              );
              expect(generatedPackage.beep).toEqual({
                family: "drivers",
              });
              expect(generatedPackage.scripts).toMatchObject(ExpectedGeneratedQualityScripts);
              expect(generatedPackage.scripts.docgen).toBe("bun run beep:docgen");

              const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
              expect(rootTsconfig.compilerOptions.paths).toMatchObject({
                "@beep/runpod": ["./packages/drivers/runpod/src/index.ts"],
                "@beep/runpod/*": ["./packages/drivers/runpod/src/*"],
              });

              const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
              expect(syncpackConfig).toContain(`"packages/drivers/*/package.json"`);
              expect(syncpackConfig).not.toContain(`"packages/drivers/runpod/package.json"`);

              yield* expectIdentityRegistration({ fs, path, rootDir }, "runpod", "Runpod");
            })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates polarity-correct ecosystem packages with flat family metadata",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(
          {
            workspaces: ["packages/foundation/*/*", "packages/ecosystem/*"],
            references: ["packages/foundation/modeling/identity"],
            paths: {
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
            },
            syncpackSources: [
              "package.json",
              "packages/foundation/*/*/package.json",
              "packages/ecosystem/*/package.json",
            ],
          },
          ({ fs, path, rootDir }) =>
            Effect.gen(function* () {
              yield* bootstrapIdentityWorkspace(rootDir);

              yield* runCreatePackageCommand([
                "portable-effect",
                "--family",
                "ecosystem",
                "--description",
                "Portable Effect library",
              ]);

              const rootPackage = decodeRootPackage(yield* readJsonFile(path.join(rootDir, "package.json")));
              expect(rootPackage.workspaces).toEqual(["packages/foundation/*/*", "packages/ecosystem/*"]);

              const generatedPackage = decodeEcosystemPackageMetadata(
                yield* readJsonFile(path.join(rootDir, "packages", "ecosystem", "portable-effect", "package.json"))
              );
              expect(generatedPackage.beep).toEqual({ family: "ecosystem" });
              expect(generatedPackage.beep.kind).toBeUndefined();
              expect(generatedPackage.sideEffects).toBe(false);
              expect(generatedPackage.exports).toEqual({
                "./package.json": "./package.json",
                ".": "./src/index.ts",
              });
              expect(generatedPackage.files).toEqual([
                "dist/**/*.js",
                "dist/**/*.js.map",
                "dist/**/*.d.ts",
                "dist/**/*.d.ts.map",
              ]);
              expect(generatedPackage.publishConfig).toEqual({
                access: "public",
                provenance: true,
                exports: {
                  "./package.json": "./package.json",
                  ".": "./dist/index.js",
                },
              });
              expect(generatedPackage.dependencies).toBeUndefined();
              expect(generatedPackage.peerDependencies).toEqual({ effect: "4.0.0-beta.106" });
              expect(generatedPackage.optionalDependencies).toBeUndefined();
              expect(generatedPackage.bundledDependencies).toBeUndefined();
              expect(generatedPackage.bundleDependencies).toBeUndefined();
              expect(generatedPackage.devDependencies.effect).toBe("catalog:");
              expect(generatedPackage.scripts).toMatchObject(ExpectedGeneratedQualityScripts);
              expect(generatedPackage.scripts.docgen).toBe("bun run beep:docgen");

              const ecosystemPackageDir = path.join(rootDir, "packages", "ecosystem", "portable-effect");
              const productionTsconfig = decodeEcosystemProductionTsconfig(
                yield* readJsoncFile(path.join(ecosystemPackageDir, "tsconfig.json"))
              );
              const testTsconfig = decodeEcosystemTestTsconfig(
                yield* readJsoncFile(path.join(ecosystemPackageDir, "tsconfig.test.json"))
              );
              const rootTypeScriptPlugins = yield* decodeTypeScriptPluginsConfig(
                yield* readJsoncFile(path.join(rootDir, "tsconfig.base.json"))
              );
              const expectedEcosystemPlugins = withSanctionedEcosystemDiagnosticDelta(
                rootTypeScriptPlugins.compilerOptions.plugins
              );
              expect(productionTsconfig.compilerOptions.stripInternal).toBe(true);
              expect(productionTsconfig.compilerOptions.plugins).toEqual(expectedEcosystemPlugins);
              expect(testTsconfig.compilerOptions.plugins).toEqual(expectedEcosystemPlugins);

              const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
              expect(syncpackConfig).toContain(`"packages/ecosystem/*/package.json"`);
              expect(syncpackConfig).not.toContain(`"packages/ecosystem/portable-effect/package.json"`);
            })
        )
      ),
    CreatePackageTestTimeoutMs
  );
});
