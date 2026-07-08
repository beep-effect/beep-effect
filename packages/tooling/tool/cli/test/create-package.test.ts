import { createPackageCommand } from "@beep/repo-cli/commands/CreatePackage";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeChildProcessSpawner, NodeServices } from "@effect/platform-node";
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
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(CommandPlatformLayer)),
  FsUtilsLive.pipe(Layer.provideMerge(CommandPlatformLayer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(CommandPlatformLayer))
);
const runCreatePackageCommandRaw = Command.runWith(createPackageCommand, { version: "0.0.0" });
const shouldAppendSkipLockfile = (args: ReadonlyArray<string>): boolean =>
  !A.some(args, (arg) => arg === "--dry-run" || arg === "--skip-lockfile");
const runCreatePackageCommand = (args: ReadonlyArray<string>) =>
  runCreatePackageCommandRaw(shouldAppendSkipLockfile(args) ? [...args, "--skip-lockfile"] : args);
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);
const decodeUnknownJson = S.decodeUnknownSync(S.fromJsonString(S.Unknown));
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
const TstycheConfig = S.Struct({
  testFileMatch: S.Array(S.String),
  tsconfig: S.String,
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

const decodeRootPackage = S.decodeUnknownSync(RootPackage);
const decodeTsconfigReferences = S.decodeUnknownSync(TsconfigReferences);
const decodeTsconfigPaths = S.decodeUnknownSync(TsconfigPaths);
const decodeTstycheConfig = S.decodeUnknownSync(TstycheConfig);
const decodeStoriesTsconfig = S.decodeUnknownSync(StoriesTsconfig);
const decodeStoriesDirectoryTsconfig = S.decodeUnknownSync(StoriesDirectoryTsconfig);
const decodePackageScripts = S.decodeUnknownSync(PackageScripts);
const decodeGeneratedPackageManifest = S.decodeUnknownSync(GeneratedPackageManifest);
const decodeFoundationPackageMetadata = S.decodeUnknownSync(FoundationPackageMetadata);
const decodeToolingPackageMetadata = S.decodeUnknownSync(ToolingPackageMetadata);
const decodeDriverPackageMetadata = S.decodeUnknownSync(DriverPackageMetadata);
const StoriesTsconfigArbitrary = S.toArbitrary(StoriesTsconfig);
const StoriesDirectoryTsconfigArbitrary = S.toArbitrary(StoriesDirectoryTsconfig);
const ExpectedGeneratedQualityScripts = {
  audit: "bun run --if-present beep:audit",
  babel: "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps",
  "beep:audit":
    "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run beep:lint",
  "beep:build": "tsc -b tsconfig.json && bun run babel",
  "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests",
  "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
  "beep:lint": "biome check .",
  "beep:lint:fix": "biome check . --write",
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
  "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests && bun run beep:check:stories",
  "beep:check:stories": "tsc -p tsconfig.stories.json --noEmit",
} as const;
const ExpectedNextjsAppScripts = {
  audit: "bun run --if-present beep:audit",
  codegen: "echo 'no codegen needed'",
  dev: "next dev --turbopack",
  "beep:audit": "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
  "beep:build": "next build --turbopack",
  "beep:check": "tsgo -b tsconfig.json",
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
  dev: "vite --host 127.0.0.1",
  "dev:tauri": "tauri dev",
  "beep:audit": "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
  "beep:build": "vite build",
  "beep:check": "tsgo -b tsconfig.json",
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
  yield* writeTextFile(path.join(identityDir, "dtslint", ".gitkeep"), "");
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
  readonly testFileMatch: ReadonlyArray<string>;
  readonly syncpackSources: ReadonlyArray<string>;
};

type TempRepoCommandContext = {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly rootDir: string;
};

const bootstrapRootConfig = Effect.fn(function* (rootDir: string, options: RootConfigOptions) {
  const path = yield* Path.Path;

  yield* writeJsonFile(path.join(rootDir, "package.json"), {
    name: "@beep/test-root",
    private: true,
    workspaces: options.workspaces,
  });
  yield* writeJsonFile(path.join(rootDir, "tsconfig.json"), {
    compilerOptions: {
      paths: options.paths,
    },
  });
  yield* writeJsonFile(path.join(rootDir, "tsconfig.packages.json"), {
    references: A.map(options.references, (referencePath) => ({ path: referencePath })),
  });
  yield* writeJsonFile(path.join(rootDir, "tstyche.json"), {
    testFileMatch: options.testFileMatch,
    tsconfig: "./tsconfig.dtslint.json",
  });
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
    testFileMatch: [
      "packages/foundation/*/*/dtslint/**/*.tst.*",
      "packages/foundation/modeling/identity/dtslint/**/*.tst.*",
    ],
    syncpackSources: ["package.json", "packages/foundation/*/*/package.json"],
  } satisfies RootConfigOptions;

  const PackageParentRootConfig = {
    workspaces: ["packages/foundation/*/*"],
    references: ["packages/foundation/modeling/identity"],
    paths: {
      "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
      "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
    },
    testFileMatch: ["packages/*/dtslint/**/*.tst.*", "packages/foundation/modeling/identity/dtslint/**/*.tst.*"],
    syncpackSources: ["package.json", "packages/foundation/*/*/package.json"],
  } satisfies RootConfigOptions;

  const AppOnlyRootConfig = {
    workspaces: [],
    references: [],
    paths: {},
    testFileMatch: [],
    syncpackSources: ["package.json"],
  } satisfies RootConfigOptions;

  const IdentityOnlyRootConfig = {
    workspaces: ["packages/foundation/modeling/identity"],
    references: ["packages/foundation/modeling/identity"],
    paths: {
      "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
      "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
    },
    testFileMatch: ["packages/foundation/modeling/identity/dtslint/**/*.tst.*"],
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
            expect(generatedPackage.scripts.docgen).toBe("bun run ../../packages/tooling/tool/docgen/src/bin.ts");
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

            const tstycheConfig = decodeTstycheConfig(yield* readJsonFile(path.join(rootDir, "tstyche.json")));
            expect(tstycheConfig.testFileMatch).toEqual([
              "packages/foundation/*/*/dtslint/**/*.tst.*",
              "packages/example-domain/dtslint/**/*.tst.*",
            ]);
            expect(tstycheConfig.tsconfig).toBe("./tsconfig.dtslint.json");
            expect(yield* fs.exists(path.join(rootDir, "packages", "example-domain", "dtslint", "tsconfig.json"))).toBe(
              false
            );

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

            expect(result).toContain("--type app requires --app-kind nextjs, tauri, or runtime-proof");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates Next.js apps without package API boilerplate",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(AppOnlyRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
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
            expect(generatedPackage.scripts.dtslint).toBeUndefined();
            expect(generatedPackage.scripts["type-test"]).toBeUndefined();
            expect(generatedPackage.exports).toBeUndefined();
            expect(generatedPackage.files).toBeUndefined();
            expect(generatedPackage.publishConfig).toBeUndefined();
            expect(generatedPackage.dependencies).toMatchObject({
              next: "catalog:",
              react: "catalog:",
              "react-dom": "catalog:",
            });

            expect(yield* fs.exists(path.join(packageDir, "src", "index.ts"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "dtslint"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "docgen.json"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "src", "app", "page.tsx"))).toBe(true);

            const appTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(packageDir, "tsconfig.json")));
            expect(appTsconfig.compilerOptions.paths).toMatchObject({
              "@/*": ["./src/*"],
            });

            const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
            expect(rootTsconfig.compilerOptions.paths["@beep/marketing-web"]).toBeUndefined();
            expect(rootTsconfig.compilerOptions.paths["@beep/marketing-web/*"]).toBeUndefined();

            const tstycheConfig = decodeTstycheConfig(yield* readJsonFile(path.join(rootDir, "tstyche.json")));
            expect(tstycheConfig.testFileMatch).toEqual([]);

            const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
            expect(syncpackConfig).toContain(`"apps/marketing-web/package.json"`);
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "creates Tauri apps without package API boilerplate",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(AppOnlyRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
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
            expect(generatedPackage.scripts.dtslint).toBeUndefined();
            expect(generatedPackage.scripts["type-test"]).toBeUndefined();
            expect(generatedPackage.exports).toBeUndefined();
            expect(generatedPackage.files).toBeUndefined();
            expect(generatedPackage.publishConfig).toBeUndefined();
            expect(generatedPackage.dependencies).toMatchObject({
              "@tauri-apps/api": "catalog:",
              react: "catalog:",
              "react-dom": "catalog:",
            });

            expect(yield* fs.exists(path.join(packageDir, "src", "index.ts"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "dtslint"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "docgen.json"))).toBe(false);
            expect(yield* fs.exists(path.join(packageDir, "src", "App.tsx"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "src-tauri", "tauri.conf.json"))).toBe(true);

            const appTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(packageDir, "tsconfig.json")));
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

            const tstycheConfig = decodeTstycheConfig(yield* readJsonFile(path.join(rootDir, "tstyche.json")));
            expect(tstycheConfig.testFileMatch).toEqual([]);
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
            expect(generatedPackage.scripts.docgen).toBe("bun run ../../packages/tooling/tool/docgen/src/bin.ts");
            expect(generatedPackage.exports).toMatchObject({
              ".": "./src/index.ts",
              "./package.json": "./package.json",
            });
            expect(yield* fs.exists(path.join(packageDir, "src", "index.ts"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "dtslint"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "docgen.json"))).toBe(true);

            const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
            expect(rootTsconfig.compilerOptions.paths).toMatchObject({
              "@beep/runtime-proof-lab": ["./apps/runtime-proof-lab/src/index.ts"],
              "@beep/runtime-proof-lab/*": ["./apps/runtime-proof-lab/src/*"],
            });

            const tstycheConfig = decodeTstycheConfig(yield* readJsonFile(path.join(rootDir, "tstyche.json")));
            expect(tstycheConfig.testFileMatch).toContain("apps/runtime-proof-lab/dtslint/**/*.tst.*");

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
            expect(generatedPackage.scripts.docgen).toBe("bun run ../../../../packages/tooling/tool/docgen/src/bin.ts");

            const rootTsconfig = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
            expect(rootTsconfig.compilerOptions.paths).toMatchObject({
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
              "@beep/schema-kit": ["./packages/foundation/modeling/schema-kit/src/index.ts"],
              "@beep/schema-kit/*": ["./packages/foundation/modeling/schema-kit/src/*"],
            });

            const tstycheConfig = decodeTstycheConfig(yield* readJsonFile(path.join(rootDir, "tstyche.json")));
            expect(tstycheConfig.testFileMatch).toEqual(["packages/foundation/*/*/dtslint/**/*.tst.*"]);

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
    "adds tstyche coverage for uncovered nested package paths",
    () =>
      Effect.runPromise(
        withBootstrappedRootConfig(IdentityOnlyRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            yield* bootstrapIdentityWorkspace(rootDir);

            yield* runCreatePackageCommand([
              "telemetry",
              "--parent-dir",
              "packages/foundation/modeling",
              "--description",
              "A telemetry package",
            ]);

            const rootPackage = decodeRootPackage(yield* readJsonFile(path.join(rootDir, "package.json")));
            expect(rootPackage.workspaces).toEqual([
              "packages/foundation/modeling/identity",
              "packages/foundation/modeling/telemetry",
            ]);

            const packageRefs = decodeTsconfigReferences(
              yield* readJsoncFile(path.join(rootDir, "tsconfig.packages.json"))
            );
            expect(A.map(packageRefs.references, (entry) => entry.path)).toEqual([
              "packages/foundation/modeling/identity",
              "packages/foundation/modeling/telemetry",
            ]);

            const tstycheConfig = decodeTstycheConfig(yield* readJsonFile(path.join(rootDir, "tstyche.json")));
            expect(tstycheConfig.testFileMatch).toContain("packages/foundation/modeling/telemetry/dtslint/**/*.tst.*");
            expect(tstycheConfig.tsconfig).toBe("./tsconfig.dtslint.json");
            expect(
              yield* fs.exists(
                path.join(rootDir, "packages", "foundation", "modeling", "telemetry", "dtslint", "tsconfig.json")
              )
            ).toBe(false);

            const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
            expect(syncpackConfig).toContain(`"packages/foundation/modeling/telemetry/package.json"`);

            yield* expectIdentityRegistration({ fs, path, rootDir }, "telemetry", "Telemetry");
          })
        )
      ),
    CreatePackageTestTimeoutMs
  );

  it(
    "does not duplicate tstyche entries when a covered parent dtslint glob already exists",
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const rootDir = process.cwd();

            yield* bootstrapFoundationIdentityRoot(rootDir);

            yield* runCreatePackageCommand([
              "audit-log",
              "--parent-dir",
              "packages/foundation/modeling",
              "--description",
              "An audit log package",
            ]);

            const tstycheConfig = decodeTstycheConfig(yield* readJsonFile(path.join(rootDir, "tstyche.json")));
            expect(tstycheConfig.testFileMatch).toEqual(["packages/foundation/*/*/dtslint/**/*.tst.*"]);
            expect(tstycheConfig.testFileMatch).not.toContain(
              "packages/foundation/modeling/audit-log/dtslint/**/*.tst.*"
            );
            expect(
              yield* fs.exists(
                path.join(rootDir, "packages", "foundation", "modeling", "audit-log", "dtslint", "tsconfig.json")
              )
            ).toBe(false);
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
            testFileMatch: [
              "packages/*/dtslint/**/*.tst.*",
              "packages/foundation/modeling/identity/dtslint/**/*.tst.*",
              "packages/tooling/tool/cli/dtslint/**/*.tst.*",
            ],
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
              expect(generatedPackage.scripts.docgen).toBe(
                "bun run ../../../../packages/tooling/tool/docgen/src/bin.ts"
              );

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
            testFileMatch: [
              "packages/drivers/*/dtslint/**/*.tst.*",
              "packages/foundation/modeling/identity/dtslint/**/*.tst.*",
            ],
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
              expect(generatedPackage.scripts.docgen).toBe("bun run ../../../packages/tooling/tool/docgen/src/bin.ts");

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
});
