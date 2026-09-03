import { createPackageCommand } from "@beep/repo-cli/commands/CreatePackage";
import {
  LAB_COMPOSERS_END_MARKER,
  LAB_COMPOSERS_START_MARKER,
  LAB_EXPORTS_END_MARKER,
  LAB_EXPORTS_START_MARKER,
} from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment";
import * as RetiredNameRegistry from "@beep/repo-cli/commands/CreatePackage/internal/RetiredNameRegistry";
import {
  decodeLabManifestJson,
  LAB_MANIFEST_FILENAME,
  LABS_WORKSPACE_ROOT,
  LabManifest,
  LabManifestFromJsonString,
  RETIRED_REGISTRY_PATH,
} from "@beep/repo-cli/test/Labs";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { today } from "@beep/schema/LocalDate";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import * as jsonc from "jsonc-parser";
import { describe, expect, it } from "vitest";

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
const CreatePackageLabTestTimeoutMs = 30_000;
const TestFileCwd = process.cwd();

const RootPackage = S.Struct({
  workspaces: S.Array(S.String),
});
const GeneratedPackageManifest = S.Struct({
  scripts: S.Record(S.String, S.String),
  exports: S.optionalKey(S.Unknown),
  files: S.optionalKey(S.Unknown),
  publishConfig: S.optionalKey(S.Unknown),
  dependencies: S.optionalKey(S.Record(S.String, S.String)),
  devDependencies: S.optionalKey(S.Record(S.String, S.String)),
});
const AppTsconfig = S.Struct({
  extends: S.optionalKey(S.String),
  compilerOptions: S.Struct({
    rootDir: S.String,
  }),
});
const LabCheckTsconfig = S.Struct({
  extends: S.String,
  references: S.Array(S.Unknown),
  compilerOptions: S.Struct({
    composite: S.Boolean,
    noEmit: S.Boolean,
    rootDir: S.String,
  }),
});
const decodeRootPackage = S.decodeUnknownSync(RootPackage);
const decodeGeneratedPackageManifest = S.decodeUnknownSync(GeneratedPackageManifest);
const decodeAppTsconfig = S.decodeUnknownSync(AppTsconfig);
const decodeLabCheckTsconfig = S.decodeUnknownSync(LabCheckTsconfig);
const LabTsconfigArbitrary = S.toArbitrary(AppTsconfig)(fc);
const LabCheckTsconfigArbitrary = S.toArbitrary(LabCheckTsconfig)(fc);

const withTempRepoCommand = <A2, E, R>(use: Effect.Effect<A2, E, R>) =>
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

const markerIndex =
  (marker: string) =>
  (content: string): number =>
    O.getOrThrow(Str.indexOf(marker)(content));

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

type RootConfigOptions = {
  readonly workspaces: ReadonlyArray<string>;
  readonly references: ReadonlyArray<string>;
  readonly paths: Record<string, ReadonlyArray<string>>;
  readonly syncpackSources: ReadonlyArray<string>;
};

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
];

// create-package runs `biome check --write` over the generated tree. Without a
// root biome config the fixture falls back to biome's defaults — notably
// indentStyle "tab" — so generated JSON lands tab-indented while the repo's
// canonical renderer emits two spaces, and every tsconfig-sync comparison then
// reports drift. Mirror the real root's formatter settings so the fixture
// exercises the same formatting the repo does.
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

const markedIdentityRegistry = A.join(
  [
    'import * as Identity from "./Id.ts";',
    "",
    "export const $I = {",
    "  compose: (..._segments: ReadonlyArray<string>) => ({",
    '    $IdentityId: "@beep/identity" as Identity.IdentityComposer<"@beep/identity">,',
    "  }),",
    "};",
    "",
    "const generatedComposers = $I.compose(",
    '  "identity",',
    ");",
    "",
    LAB_COMPOSERS_START_MARKER,
    "const generatedLabComposers = {};",
    LAB_COMPOSERS_END_MARKER,
    "",
    "const composers = {",
    "  ...generatedComposers,",
    "  ...generatedLabComposers,",
    "};",
    "",
    'export const $IdentityId: Identity.IdentityComposer<"@beep/identity"> = composers.$IdentityId;',
    "",
    LAB_EXPORTS_START_MARKER,
    LAB_EXPORTS_END_MARKER,
    "",
  ],
  "\n"
);

const bootstrapMarkedIdentityWorkspace = Effect.fn(function* (rootDir: string) {
  const path = yield* Path.Path;
  const identityDir = path.join(rootDir, "packages", "foundation", "modeling", "identity");

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
  yield* writeTextFile(path.join(identityDir, "src", "packages.ts"), markedIdentityRegistry);
});

const identityPaths = {
  "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
  "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
};

const LabsRootConfig = {
  workspaces: ["packages/foundation/*/*", "apps/labs/*"],
  references: ["packages/foundation/modeling/identity"],
  paths: identityPaths,
  syncpackSources: ["package.json", "packages/foundation/*/*/package.json", "apps/labs/*/package.json"],
} satisfies RootConfigOptions;

const NoLabsGlobRootConfig = {
  workspaces: ["packages/foundation/*/*"],
  references: ["packages/foundation/modeling/identity"],
  paths: identityPaths,
  syncpackSources: ["package.json", "packages/foundation/*/*/package.json"],
} satisfies RootConfigOptions;

type TempRepoCommandContext = {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly rootDir: string;
};

const withLabsFixture = <A2, E, R>(
  options: RootConfigOptions,
  use: (context: TempRepoCommandContext) => Effect.Effect<A2, E, R>
) =>
  withTempRepoCommand(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const rootDir = process.cwd();
      yield* bootstrapRootConfig(rootDir, options);
      yield* bootstrapMarkedIdentityWorkspace(rootDir);
      return yield* use({ fs, path, rootDir });
    })
  );

const readIdentityRegistry = Effect.fn(function* (context: TempRepoCommandContext) {
  return yield* context.fs.readFileString(
    context.path.join(context.rootDir, "packages", "foundation", "modeling", "identity", "src", "packages.ts")
  );
});

const decodeManifestAt = Effect.fn(function* (context: TempRepoCommandContext, labName: string) {
  const content = yield* context.fs.readFileString(
    context.path.join(context.rootDir, "apps", "labs", labName, LAB_MANIFEST_FILENAME)
  );
  return yield* decodeLabManifestJson(content);
});

const expectNoPackageCeremony = (manifest: {
  readonly exports?: unknown;
  readonly files?: unknown;
  readonly publishConfig?: unknown;
  readonly scripts: Readonly<Record<string, string>>;
}) => {
  expect(manifest.exports).toBeUndefined();
  expect(manifest.files).toBeUndefined();
  expect(manifest.publishConfig).toBeUndefined();
  expect(manifest.scripts.docgen).toBeUndefined();
  // Ratified row 7 omits the coverage script from lab templates outright, on top
  // of the coverage discovery/disposition exclusions ("Never give labs a
  // `coverage` script" — research/04-governance-gates.md).
  expect(manifest.scripts.coverage).toBeUndefined();
};

describe("create-package --lab", { concurrent: false }, () => {
  it("property: lab tsconfig schemas round-trip derived values", () => {
    fc.assert(
      fc.property(LabTsconfigArbitrary, LabCheckTsconfigArbitrary, (labTsconfig, labCheckTsconfig) => {
        expect(decodeAppTsconfig(S.encodeSync(AppTsconfig)(labTsconfig))).toEqual(labTsconfig);
        expect(decodeLabCheckTsconfig(S.encodeSync(LabCheckTsconfig)(labCheckTsconfig))).toEqual(labCheckTsconfig);
      }),
      fcRuns(16)
    );
  });

  it("property: lab manifests round-trip the lab.manifest.json codec from valid encoded dates", () => {
    const decodeManifest = S.decodeUnknownSync(LabManifestFromJsonString);
    const encodeManifest = S.encodeSync(LabManifestFromJsonString);
    const manifestEquivalence = S.toEquivalence(LabManifest);
    const isoDate = fc
      .tuple(fc.integer({ min: 1970, max: 2100 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }))
      .map(
        ([year, month, day]) =>
          `${Str.padStart(4, "0")(String(year))}-${Str.padStart(2, "0")(String(month))}-${Str.padStart(2, "0")(String(day))}`
      );
    const encodedManifest = fc.record({
      schemaVersion: fc.constant("lab-manifest/v1" as const),
      purpose: fc.string({ minLength: 1 }),
      created: isoDate,
      disposition: fc.constantFrom("active", "promote", "expired"),
      postgresSchema: fc.option(fc.constant("lab_a"), { nil: undefined }),
    });
    fc.assert(
      fc.property(encodedManifest, (encoded) => {
        const json = JSON.stringify(encoded, null, 2);
        const decoded = decodeManifest(json);
        expect(manifestEquivalence(decodeManifest(encodeManifest(decoded)), decoded)).toBe(true);
      }),
      fcRuns(16)
    );
  });

  it(
    "scaffolds a nextjs lab with manifest, labs portless label, @beep/ui wiring, and the labs identity segment",
    () =>
      Effect.runPromise(
        withLabsFixture(LabsRootConfig, (context) =>
          Effect.gen(function* () {
            const { fs, path, rootDir } = context;

            yield* runCreatePackageCommand([
              "web-lab",
              "--type",
              "app",
              "--app-kind",
              "nextjs",
              "--lab",
              "--description",
              "Next.js lab probe",
            ]);

            const packageDir = path.join(rootDir, "apps", "labs", "web-lab");
            const manifest = decodeGeneratedPackageManifest(yield* readJsonFile(path.join(packageDir, "package.json")));
            expect(manifest.scripts.dev).toBe("portless web-lab.labs.beep next dev --turbopack");
            expectNoPackageCeremony(manifest);
            // Exactly what the emitted templates import: @beep/repo-configs in
            // next.config.ts, @beep/ui via postcss.config.mjs + globals.css.
            // Anything further fails the required Knip context on a real lab.
            expect(manifest.dependencies).toMatchObject({
              next: "catalog:",
              react: "catalog:",
              "@beep/repo-configs": "workspace:^",
              "@beep/ui": "workspace:^",
            });
            expect(manifest.dependencies?.["@beep/identity"]).toBeUndefined();
            expect(manifest.dependencies?.["@beep/schema"]).toBeUndefined();
            expect(manifest.dependencies?.["@beep/utils"]).toBeUndefined();
            expect(manifest.dependencies?.effect).toBeUndefined();

            const labManifest = yield* decodeManifestAt(context, "web-lab");
            expect(labManifest.schemaVersion).toBe("lab-manifest/v1");
            expect(labManifest.purpose).toBe("Next.js lab probe");
            expect(labManifest.disposition).toBe("active");
            expect(labManifest.created.toISOString()).toBe(today().toISOString());

            expect(yield* fs.exists(path.join(packageDir, "tsconfig.next.json"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "tsconfig.check.json"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "postcss.config.mjs"))).toBe(true);
            const labCheckTsconfig = decodeLabCheckTsconfig(
              yield* readJsoncFile(path.join(packageDir, "tsconfig.check.json"))
            );
            expect(labCheckTsconfig.extends).toBe("./tsconfig.json");
            expect(labCheckTsconfig.compilerOptions.noEmit).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "docgen.json"))).toBe(false);
            const nextConfig = yield* fs.readFileString(path.join(packageDir, "next.config.ts"));
            expect(nextConfig).toContain("defineBeepNextConfig");
            expect(nextConfig).toContain("web-lab.labs.beep.localhost");
            const globalsCss = yield* fs.readFileString(path.join(packageDir, "src", "app", "globals.css"));
            expect(globalsCss).toContain('@import "@beep/ui/styles/globals.css";');
            const appTsconfig = decodeAppTsconfig(yield* readJsoncFile(path.join(packageDir, "tsconfig.json")));
            expect(appTsconfig.compilerOptions.rootDir).toBe("../../..");

            const rootPackage = decodeRootPackage(yield* readJsonFile(path.join(rootDir, "package.json")));
            expect(rootPackage.workspaces).toEqual(["packages/foundation/*/*", "apps/labs/*"]);

            const registry = yield* readIdentityRegistry(context);
            expect(registry).toContain('const generatedLabComposers = $I.compose("web-lab");');
            expect(registry).toContain("export const $WebLabId");
            expect(markerIndex("export const $WebLabId")(registry)).toBeGreaterThan(
              markerIndex(LAB_EXPORTS_START_MARKER)(registry)
            );
            expect(markerIndex("export const $WebLabId")(registry)).toBeLessThan(
              markerIndex(LAB_EXPORTS_END_MARKER)(registry)
            );
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "scaffolds a vite lab with the @beep/ui style chain and lab-only postcss config",
    () =>
      Effect.runPromise(
        withLabsFixture(LabsRootConfig, (context) =>
          Effect.gen(function* () {
            const { fs, path, rootDir } = context;

            yield* runCreatePackageCommand([
              "graph-lab",
              "--type",
              "app",
              "--app-kind",
              "vite",
              "--lab",
              "--description",
              "Vite lab probe",
            ]);

            const packageDir = path.join(rootDir, "apps", "labs", "graph-lab");
            const manifest = decodeGeneratedPackageManifest(yield* readJsonFile(path.join(packageDir, "package.json")));
            expect(manifest.scripts.dev).toBe(
              "portless graph-lab.labs.beep sh -c 'vite --host 127.0.0.1 --port \"${PORT:-5173}\" --strictPort'"
            );
            expectNoPackageCeremony(manifest);
            expect(manifest.dependencies).toMatchObject({
              react: "catalog:",
              "react-dom": "catalog:",
              "@beep/ui": "workspace:^",
            });
            expect(manifest.dependencies?.next).toBeUndefined();
            expect(manifest.dependencies?.effect).toBeUndefined();
            expect(manifest.dependencies?.["@beep/identity"]).toBeUndefined();

            const labManifest = yield* decodeManifestAt(context, "graph-lab");
            expect(labManifest.purpose).toBe("Vite lab probe");

            expect(yield* fs.exists(path.join(packageDir, "index.html"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "postcss.config.mjs"))).toBe(true);
            const globalsCss = yield* fs.readFileString(path.join(packageDir, "src", "styles", "globals.css"));
            expect(globalsCss).toContain('@import "@beep/ui/styles/globals.css";');
            expect(globalsCss).not.toContain(":root");
            const appTsconfig = decodeAppTsconfig(yield* readJsoncFile(path.join(packageDir, "tsconfig.json")));
            expect(appTsconfig.compilerOptions.rootDir).toBe("../../..");

            const registry = yield* readIdentityRegistry(context);
            expect(registry).toContain('const generatedLabComposers = $I.compose("graph-lab");');
            expect(registry).toContain("export const $GraphLabId");
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "scaffolds a service lab with the HttpApi stack and no frontend dependencies",
    () =>
      Effect.runPromise(
        withLabsFixture(LabsRootConfig, (context) =>
          Effect.gen(function* () {
            const { fs, path, rootDir } = context;

            yield* runCreatePackageCommand([
              "probe-svc",
              "--type",
              "app",
              "--app-kind",
              "service",
              "--lab",
              "--description",
              "Service lab probe",
            ]);

            const packageDir = path.join(rootDir, "apps", "labs", "probe-svc");
            const manifest = decodeGeneratedPackageManifest(yield* readJsonFile(path.join(packageDir, "package.json")));
            expect(manifest.scripts.dev).toBe("portless probe-svc.labs.beep sh -c 'bun --watch src/main.ts'");
            expectNoPackageCeremony(manifest);
            // src/Api.ts imports the identity accessor; main.ts imports
            // platform-bun and effect. Nothing emitted imports @beep/schema or
            // @beep/utils (the template `S` is `effect/Schema`).
            expect(manifest.dependencies).toMatchObject({
              "@beep/identity": "workspace:^",
              "@effect/platform-bun": "catalog:",
              effect: "catalog:",
            });
            expect(manifest.dependencies?.["@beep/schema"]).toBeUndefined();
            expect(manifest.dependencies?.["@beep/utils"]).toBeUndefined();
            expect(manifest.dependencies?.react).toBeUndefined();
            expect(manifest.devDependencies?.vite).toBeUndefined();

            const labManifest = yield* decodeManifestAt(context, "probe-svc");
            expect(labManifest.disposition).toBe("active");

            expect(yield* fs.exists(path.join(packageDir, "src", "Api.ts"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "src", "main.ts"))).toBe(true);
            expect(yield* fs.exists(path.join(packageDir, "src", "runtime", "Layer.ts"))).toBe(true);
            const api = yield* fs.readFileString(path.join(packageDir, "src", "Api.ts"));
            expect(api).toContain('import { $ProbeSvcId } from "@beep/identity/packages";');
            expect(api).toContain('$ProbeSvcId.create("Api")');
            const main = yield* fs.readFileString(path.join(packageDir, "src", "main.ts"));
            expect(main).toContain("BunHttpServer.layer");
            expect(main).toContain('import * as Config from "effect/Config";');
            expect(main).toContain('import * as Effect from "effect/Effect";');
            expect(main).toContain('import * as Layer from "effect/Layer";');
            expect(main).not.toContain('from "effect"');
            expect(main).not.toContain("node:http");

            const runtimeLayer = yield* fs.readFileString(path.join(packageDir, "src", "runtime", "Layer.ts"));
            expect(runtimeLayer).toContain('import * as Effect from "effect/Effect";');
            expect(runtimeLayer).toContain('import * as Layer from "effect/Layer";');
            expect(runtimeLayer).not.toContain('from "effect"');

            const healthTest = yield* fs.readFileString(path.join(packageDir, "test", "health.test.ts"));
            expect(healthTest).toContain('import * as Context from "effect/Context";');
            expect(healthTest).toContain('import * as Effect from "effect/Effect";');
            expect(healthTest).toContain('import * as Layer from "effect/Layer";');
            expect(healthTest).toContain('import * as Match from "effect/Match";');
            expect(healthTest).not.toContain('from "effect"');

            const registry = yield* readIdentityRegistry(context);
            expect(registry).toContain('const generatedLabComposers = $I.compose("probe-svc");');
            expect(registry).toContain("export const $ProbeSvcId");
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "scaffolds a tauri lab with a compilable crate icon and the labs portless devUrl",
    () =>
      Effect.runPromise(
        withLabsFixture(LabsRootConfig, (context) =>
          Effect.gen(function* () {
            const { fs, path, rootDir } = context;

            yield* runCreatePackageCommand([
              "probe-tauri",
              "--type",
              "app",
              "--app-kind",
              "tauri",
              "--lab",
              "--description",
              "Tauri lab probe",
            ]);

            const packageDir = path.join(rootDir, "apps", "labs", "probe-tauri");
            const manifest = decodeGeneratedPackageManifest(yield* readJsonFile(path.join(packageDir, "package.json")));
            expect(manifest.scripts.dev).toBe(
              "portless probe-tauri.labs.beep sh -c 'vite --host 127.0.0.1 --port \"${PORT:-1420}\" --strictPort'"
            );
            expect(manifest.scripts["dev:tauri"]).toBe("tauri dev");
            expectNoPackageCeremony(manifest);

            // The icon is a generated file, not an optional extra:
            // `tauri::generate_context!()` opens `src-tauri/icons/icon.png` while
            // the macro expands, and no `bundle.icon` value avoids that — `[]` and
            // `bundle.active: false` both still fail. Assert the PNG signature, since
            // a Handlebars string round-trip would corrupt these high bytes.
            const iconBytes = yield* fs.readFile(path.join(packageDir, "src-tauri", "icons", "icon.png"));
            expect(A.take(A.fromIterable(iconBytes), 8)).toStrictEqual([
              0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]);
            expect(iconBytes.length).toBeGreaterThan(1024);

            const tauriConf = yield* fs.readFileString(path.join(packageDir, "src-tauri", "tauri.conf.json"));
            expect(tauriConf).toContain(`"icon": ["icons/icon.png"]`);
            // Labs serve on the `.labs.beep` route; a `<name>.beep` devUrl would
            // point the webview at a host the lab's dev script never serves.
            expect(tauriConf).toContain(`"devUrl": "http://probe-tauri.labs.beep.localhost:1355"`);
            expect(tauriConf).not.toContain("probe-tauri.beep.localhost");

            const labManifest = yield* decodeManifestAt(context, "probe-tauri");
            expect(labManifest.disposition).toBe("active");

            const registry = yield* readIdentityRegistry(context);
            expect(registry).toContain('const generatedLabComposers = $I.compose("probe-tauri");');
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "rebuilds the labs identity segment sorted when a second lab is created",
    () =>
      Effect.runPromise(
        withLabsFixture(LabsRootConfig, (context) =>
          Effect.gen(function* () {
            yield* runCreatePackageCommand([
              "zeta-lab",
              "--type",
              "app",
              "--app-kind",
              "vite",
              "--lab",
              "--description",
              "Zeta lab",
            ]);
            yield* runCreatePackageCommand([
              "alpha-lab",
              "--type",
              "app",
              "--app-kind",
              "vite",
              "--lab",
              "--description",
              "Alpha lab",
            ]);

            const registry = yield* readIdentityRegistry(context);
            expect(registry).toContain('const generatedLabComposers = $I.compose("alpha-lab", "zeta-lab");');
            expect(registry).toContain("export const $AlphaLabId");
            expect(registry).toContain("export const $ZetaLabId");
            expect(markerIndex("export const $AlphaLabId")(registry)).toBeLessThan(
              markerIndex("export const $ZetaLabId")(registry)
            );
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "refuses --lab flag misuse before touching the filesystem",
    () =>
      Effect.runPromise(
        withTempRepoCommand(
          Effect.gen(function* () {
            const runRefusal = (args: ReadonlyArray<string>) =>
              runCreatePackageCommand(args).pipe(
                Effect.match({
                  onFailure: toFailureMessage,
                  onSuccess: () => "success",
                })
              );

            expect(yield* runRefusal(["probe-lab", "--lab", "--description", "x"])).toContain(
              "--lab is only valid with --type app"
            );
            expect(
              yield* runRefusal([
                "probe-lab",
                "--type",
                "app",
                "--app-kind",
                "runtime-proof",
                "--lab",
                "--description",
                "x",
              ])
            ).toContain("--lab --app-kind runtime-proof is not supported");
            expect(
              yield* runRefusal([
                "probe-lab",
                "--type",
                "app",
                "--app-kind",
                "vite",
                "--lab",
                "--parent-dir",
                "apps",
                "--description",
                "x",
              ])
            ).toContain("omit --parent-dir");
            expect(yield* runRefusal(["probe-lab", "--type", "app", "--app-kind", "vite", "--lab"])).toContain(
              "non-empty --description"
            );
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "refuses lab scaffolding when the root workspaces lack the apps/labs/* glob (D5)",
    () =>
      Effect.runPromise(
        withLabsFixture(NoLabsGlobRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            const result = yield* runCreatePackageCommand([
              "probe-lab",
              "--type",
              "app",
              "--app-kind",
              "vite",
              "--lab",
              "--description",
              "Lab without membership",
            ]).pipe(
              Effect.match({
                onFailure: toFailureMessage,
                onSuccess: () => "success",
              })
            );

            expect(result).toContain('missing the "apps/labs/*" glob');
            expect(yield* fs.exists(path.join(rootDir, "apps", "labs", "probe-lab"))).toBe(false);
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "refuses a non-lab package targeted into the labs root via --parent-dir",
    () =>
      Effect.runPromise(
        withLabsFixture(LabsRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            // The inverse of the D5 guard: landing inside apps/labs without
            // --lab would skip every lab construction rule (manifest, labs
            // portless label, generated identity segment, ceremony exemptions)
            // and leave a workspace the identity-registry lint calls misplaced.
            const result = yield* runCreatePackageCommand([
              "sneaky-lab",
              "--type",
              "app",
              "--app-kind",
              "vite",
              "--parent-dir",
              LABS_WORKSPACE_ROOT,
              "--description",
              "Lab root without --lab",
            ]).pipe(
              Effect.match({
                onFailure: toFailureMessage,
                onSuccess: () => "success",
              })
            );

            expect(result).toContain(`is inside the ${LABS_WORKSPACE_ROOT} root`);
            expect(result).toContain("--lab");
            expect(yield* fs.exists(path.join(rootDir, "apps", "labs", "sneaky-lab"))).toBe(false);
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "gates every create on the retired-packages registry, dry-run included",
    () =>
      Effect.runPromise(
        withLabsFixture(LabsRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            yield* writeJsonFile(path.join(rootDir, RETIRED_REGISTRY_PATH), {
              packages: [{ name: "@beep/probe", rationale: "Retired to keep historical changesets resolvable." }],
            });

            const refusal = yield* runCreatePackageCommand(["probe", "--description", "Recreated probe"]).pipe(
              Effect.match({
                onFailure: toFailureMessage,
                onSuccess: () => "success",
              })
            );
            expect(refusal).toContain("retired package name");
            expect(refusal).toContain("--reuse-retired-name");

            const dryRunRefusal = yield* runCreatePackageCommand([
              "probe",
              "--description",
              "Recreated probe",
              "--dry-run",
            ]).pipe(
              Effect.match({
                onFailure: toFailureMessage,
                onSuccess: () => "success",
              })
            );
            expect(dryRunRefusal).toContain("retired package name");

            yield* runCreatePackageCommand([
              "probe",
              "--description",
              "Recreated probe",
              "--dry-run",
              "--reuse-retired-name",
            ]);
            const dryRunOutput = A.join(A.map(yield* TestConsole.logLines, String), "\n");
            expect(dryRunOutput).toContain('[dry-run] Retired name: reusing "@beep/probe" (--reuse-retired-name)');

            // A dry run must not mutate the registry.
            const afterDryRun = yield* fs.readFileString(path.join(rootDir, RETIRED_REGISTRY_PATH));
            expect(afterDryRun).toContain("@beep/probe");

            yield* runCreatePackageCommand(["probe", "--description", "Recreated probe", "--reuse-retired-name"]);
            expect(
              yield* fs.exists(path.join(rootDir, "packages", "tooling", "library", "probe", "package.json"))
            ).toBe(true);

            // Sanctioned reuse restores the name's provenance: leaving the entry
            // would leave the registry claiming a live package is retired, and
            // would wedge the later delete-package retirement of that name.
            const registryAfterCreate = yield* fs.readFileString(path.join(rootDir, RETIRED_REGISTRY_PATH));
            expect(registryAfterCreate).not.toContain("@beep/probe");
            const createOutput = A.join(A.map(yield* TestConsole.logLines, String), "\n");
            expect(createOutput).toContain(`${RETIRED_REGISTRY_PATH}: removed the retired entry for "@beep/probe"`);
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );

  it(
    "leaves the retired registry untouched when the name is absent",
    () =>
      Effect.runPromise(
        withLabsFixture(LabsRootConfig, ({ fs, path, rootDir }) =>
          Effect.gen(function* () {
            // The no-op path is unreachable through the command surface —
            // create-package only calls the writer once it has established the
            // name IS retired — so it is exercised directly. Absent names must
            // not rewrite the file, or every sanctioned reuse would churn the
            // registry's formatting for unrelated entries.
            const registryPath = path.join(rootDir, RETIRED_REGISTRY_PATH);
            yield* writeJsonFile(registryPath, {
              packages: [{ name: "@beep/other", rationale: "Retired to keep historical changesets resolvable." }],
            });
            const before = yield* fs.readFileString(registryPath);

            const removed = yield* RetiredNameRegistry.removeRetiredPackageName(rootDir, "@beep/absent");

            expect(removed).toBe(false);
            expect(yield* fs.readFileString(registryPath)).toBe(before);
          })
        )
      ),
    CreatePackageLabTestTimeoutMs
  );
});
