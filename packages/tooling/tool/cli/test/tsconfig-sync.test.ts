import { syncTsconfigAtRoot, tsconfigSyncCommand } from "@beep/repo-cli/commands/TsconfigSync";
import { FsUtilsLive } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer, Order, Path } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { Command } from "effect/unstable/cli";
import * as jsonc from "jsonc-parser";
import { describe, expect, it } from "vitest";

const runTsconfigSyncCommand = Command.runWith(tsconfigSyncCommand, { version: "0.0.0" });
const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeServices.layer);
const TestLayer = Layer.mergeAll(PlatformLayer, FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer)));
const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));
const decodeUnknownJson = S.decodeUnknownSync(S.fromJsonString(S.Unknown));

const TsconfigReferences = S.Struct({
  references: S.Array(
    S.Struct({
      path: S.String,
    })
  ),
});
const TsconfigPaths = S.Struct({
  compilerOptions: S.Struct({
    paths: S.Record(S.String, S.Array(S.String)),
  }),
});
const decodeTsconfigReferences = S.decodeUnknownSync(TsconfigReferences);
const decodeTsconfigPaths = S.decodeUnknownSync(TsconfigPaths);

const expectTsconfigReferencesRoundTrip = (value: typeof TsconfigReferences.Type): void => {
  const encoded = S.encodeUnknownSync(TsconfigReferences)(value);
  expect(decodeTsconfigReferences(encoded)).toEqual(value);
};

const withTempRepo = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();

      yield* fs.makeDirectory(path.join(tmpDir, ".git"), { recursive: true });
      process.chdir(tmpDir);
      return { fs, previousCwd, tmpDir } as const;
    }),
    () => use,
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  ).pipe(provideScopedLayer(TestLayer));

const writeTextFile = Effect.fn(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const writeJsonFile = Effect.fn(function* (filePath: string, value: unknown) {
  const encoded = encodeJson(value);
  const edits = jsonc.format(encoded, undefined, {
    tabSize: 2,
    insertSpaces: true,
  });
  yield* writeTextFile(filePath, `${jsonc.applyEdits(encoded, edits)}\n`);
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

const bootstrapRootConfig = Effect.fn(function* (
  rootDir: string,
  options: {
    readonly workspaces: ReadonlyArray<string>;
    readonly references: ReadonlyArray<string>;
    readonly paths: Record<string, ReadonlyArray<string>>;
    readonly syncpackSources: ReadonlyArray<string>;
  }
) {
  const path = yield* Path.Path;

  yield* writeJsonFile(path.join(rootDir, "package.json"), {
    name: "@beep/test-root",
    private: true,
    workspaces: options.workspaces,
  });
  yield* writeJsonFile(path.join(rootDir, "tsconfig.packages.json"), {
    references: A.map(options.references, (referencePath) => ({ path: referencePath })),
  });
  yield* writeJsonFile(path.join(rootDir, "tsconfig.json"), {
    compilerOptions: {
      paths: options.paths,
    },
  });
  yield* writeSyncpackConfig(path.join(rootDir, "syncpack.config.ts"), options.syncpackSources);
});

const bootstrapWorkspace = Effect.fn(function* (
  rootDir: string,
  options: {
    readonly relativeDir: string;
    readonly packageName: string;
    readonly dependencies?: Record<string, string>;
    readonly references?: ReadonlyArray<string>;
    readonly docgenConfig?: unknown;
    readonly exports?: unknown;
  }
) {
  const path = yield* Path.Path;
  const workspaceDir = path.join(rootDir, options.relativeDir);

  yield* writeJsonFile(path.join(workspaceDir, "package.json"), {
    name: options.packageName,
    version: "0.0.0",
    ...O.getSomesStruct({ dependencies: O.fromUndefinedOr(options.dependencies) }),
    exports: options.exports ?? {
      ".": "./src/index.ts",
      "./*": "./src/*.ts",
    },
  });
  yield* writeJsonFile(path.join(workspaceDir, "tsconfig.json"), {
    ...O.getSomesStruct({
      references: O.map(O.fromUndefinedOr(options.references), (references) =>
        A.map(references, (referencePath) => ({ path: referencePath }))
      ),
    }),
    compilerOptions: {
      outDir: "dist",
      rootDir: "src",
    },
  });
  yield* writeTextFile(
    path.join(workspaceDir, "src", "index.ts"),
    `export const workspaceName = "${options.packageName}";\n`
  );
  if (options.docgenConfig !== undefined) {
    yield* writeJsonFile(path.join(workspaceDir, "docgen.json"), options.docgenConfig);
  }
});

describe("tsconfig-sync", () => {
  it("round-trips arbitrary tsconfig reference documents", () => {
    fc.assert(
      fc.property(S.toArbitrary(TsconfigReferences)(fc), (value) => expectTsconfigReferencesRoundTrip(value)),
      { numRuns: 25 }
    );
  });

  it(
    "accepts --write as explicit sync mode",
    () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const rootDir = process.cwd();

            yield* bootstrapRootConfig(rootDir, {
              workspaces: ["packages/example-domain"],
              references: [],
              paths: {},
              syncpackSources: ["package.json"],
            });
            yield* bootstrapWorkspace(rootDir, {
              relativeDir: "packages/example-domain",
              packageName: "@beep/example-domain",
            });

            yield* runTsconfigSyncCommand(["--write", "--filter", "@beep/example-domain"]);

            const refs = decodeTsconfigReferences(yield* readJsoncFile(path.join(rootDir, "tsconfig.packages.json")));
            expect(A.map(refs.references, (entry) => entry.path)).toEqual(["packages/example-domain"]);
          })
        )
      ),
    20_000
  );

  it("synchronizes root references, aliases, and syncpack from workspace discovery", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = process.cwd();

          yield* bootstrapRootConfig(rootDir, {
            workspaces: ["packages/foundation/*/*", "packages/example-domain"],
            references: ["packages/foundation/modeling/identity"],
            paths: {
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
            },
            syncpackSources: ["package.json", "packages/foundation/*/*/package.json"],
          });
          yield* bootstrapWorkspace(rootDir, {
            relativeDir: "packages/foundation/modeling/identity",
            packageName: "@beep/identity",
          });
          yield* bootstrapWorkspace(rootDir, {
            relativeDir: "packages/example-domain",
            packageName: "@beep/example-domain",
          });

          const result = yield* syncTsconfigAtRoot(rootDir, {
            mode: "sync",
            filter: "@beep/example-domain",
            verbose: false,
          });

          expect(A.map(result.changes, (change) => change.section)).toEqual([
            "root-syncpack",
            "root-aliases",
            "root-references",
          ]);

          const refs = decodeTsconfigReferences(yield* readJsoncFile(path.join(rootDir, "tsconfig.packages.json")));
          expect(A.map(refs.references, (entry) => entry.path)).toEqual([
            "packages/example-domain",
            "packages/foundation/modeling/identity",
          ]);

          const paths = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
          expect(paths.compilerOptions.paths).toMatchObject({
            "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
            "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
            "@beep/example-domain": ["./packages/example-domain/src/index.ts"],
            "@beep/example-domain/*": ["./packages/example-domain/src/*"],
          });

          const syncpackConfig = yield* fs.readFileString(path.join(rootDir, "syncpack.config.ts"));
          expect(syncpackConfig).toContain(`"packages/example-domain/package.json"`);
        })
      )
    ));

  it("does not synthesize wildcard aliases for packages without wildcard exports", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const rootDir = process.cwd();

          yield* bootstrapRootConfig(rootDir, {
            workspaces: ["packages/example-use-cases"],
            references: ["packages/example-use-cases"],
            paths: {
              "@beep/example-use-cases": ["./packages/example-use-cases/src/index.ts"],
              "@beep/example-use-cases/*": ["./packages/example-use-cases/src/*"],
            },
            syncpackSources: ["package.json", "packages/example-use-cases/package.json"],
          });
          yield* bootstrapWorkspace(rootDir, {
            relativeDir: "packages/example-use-cases",
            packageName: "@beep/example-use-cases",
            exports: {
              ".": "./src/index.ts",
              "./public": "./src/public.ts",
              "./server": "./src/server.ts",
              "./test": "./src/test.ts",
              "./package.json": "./package.json",
            },
            docgenConfig: {
              $schema: "../../../packages/tooling/tool/docgen/schema.json",
              srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example-use-cases/src/",
            },
          });

          const result = yield* syncTsconfigAtRoot(rootDir, {
            mode: "sync",
            filter: "@beep/example-use-cases",
            verbose: false,
          });

          expect(
            A.sort(
              A.map(result.changes, (change) => change.section),
              Order.String
            )
          ).toEqual(["package-docgen", "root-aliases"]);

          const paths = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
          expect(paths.compilerOptions.paths).toMatchObject({
            "@beep/example-use-cases": ["./packages/example-use-cases/src/index.ts"],
            "@beep/example-use-cases/public": ["./packages/example-use-cases/src/public.ts"],
            "@beep/example-use-cases/server": ["./packages/example-use-cases/src/server.ts"],
            "@beep/example-use-cases/test": ["./packages/example-use-cases/src/test.ts"],
          });
          expect(paths.compilerOptions.paths).not.toHaveProperty("@beep/example-use-cases/*");

          const syncedDocgen = yield* readJsonFile(path.join(rootDir, "packages", "example-use-cases", "docgen.json"));
          expect(syncedDocgen).toMatchObject({
            exclude: ["src/internal/**/*.ts"],
            examplesCompilerOptions: {
              moduleResolution: "bundler",
            },
          });
          expect(
            (syncedDocgen as { readonly examplesCompilerOptions?: Record<string, unknown> }).examplesCompilerOptions
          ).not.toHaveProperty("paths");
        })
      )
    ));

  it("emits scoped aliases only for file-stem scoped wildcard exports", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const rootDir = process.cwd();

          yield* bootstrapRootConfig(rootDir, {
            workspaces: ["packages/example-slices"],
            references: ["packages/example-slices"],
            paths: {
              "@beep/example-slices": ["./packages/example-slices/src/index.ts"],
            },
            syncpackSources: ["package.json", "packages/example-slices/package.json"],
          });
          yield* bootstrapWorkspace(rootDir, {
            relativeDir: "packages/example-slices",
            packageName: "@beep/example-slices",
            exports: {
              ".": "./src/index.ts",
              "./flat/*": "./src/flat/*.ts",
              "./aggregates/*": "./src/aggregates/*/index.ts",
              "./aggregates/*/server": "./src/aggregates/*/server.ts",
              "./internal/*": null,
              "./package.json": "./package.json",
            },
          });

          yield* syncTsconfigAtRoot(rootDir, {
            mode: "sync",
            filter: undefined,
            verbose: false,
          });

          const paths = decodeTsconfigPaths(yield* readJsoncFile(path.join(rootDir, "tsconfig.json")));
          expect(paths.compilerOptions.paths).toMatchObject({
            "@beep/example-slices/flat/*": ["./packages/example-slices/src/flat/*"],
          });
          // Directory-shaped scoped wildcards must not become aliases: an
          // unconditional alias rewrite would shadow the mid-star
          // `./aggregates/*/server` export that only package-exports
          // resolution can serve.
          expect(paths.compilerOptions.paths).not.toHaveProperty("@beep/example-slices/aggregates/*");
          expect(paths.compilerOptions.paths).not.toHaveProperty("@beep/example-slices/aggregates/*/server");
          expect(paths.compilerOptions.paths).not.toHaveProperty("@beep/example-slices/internal/*");
        })
      )
    ));

  it("syncs managed docgen fields, preserves extras, and respects filter", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const rootDir = process.cwd();

          yield* bootstrapRootConfig(rootDir, {
            workspaces: ["packages/foundation/*/*"],
            references: ["packages/foundation/modeling/identity", "packages/foundation/modeling/schema"],
            paths: {
              "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
              "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"],
              "@beep/schema": ["./packages/foundation/modeling/schema/src/index.ts"],
              "@beep/schema/*": ["./packages/foundation/modeling/schema/src/*"],
              "@beep/schema/test/Markdown": [
                "./packages/foundation/modeling/schema/src/internal/test/Markdown.test-kit.ts",
              ],
              "@beep/schema/test/Yaml": ["./packages/foundation/modeling/schema/src/internal/test/Yaml.test-kit.ts"],
            },
            syncpackSources: ["package.json", "packages/foundation/*/*/package.json"],
          });

          yield* bootstrapWorkspace(rootDir, {
            relativeDir: "packages/foundation/modeling/schema",
            packageName: "@beep/schema",
            docgenConfig: {
              $schema: "../../../../packages/tooling/tool/docgen/schema.json",
              srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema/src/",
            },
          });
          yield* bootstrapWorkspace(rootDir, {
            relativeDir: "packages/foundation/modeling/identity",
            packageName: "@beep/identity",
            dependencies: {
              "@beep/schema": "workspace:*",
            },
            references: ["../schema/tsconfig.json"],
            docgenConfig: {
              $schema: "../../../../packages/tooling/tool/docgen/schema.json",
              exclude: ["src/**/*.spec.ts"],
              enforceDescriptions: true,
              srcDir: "claudecode",
              srcLink:
                "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/identity/claudecode/",
              examplesCompilerOptions: {
                noEmit: true,
                strict: true,
                skipLibCheck: true,
                moduleResolution: "bundler",
                module: "esnext",
                target: "es2022",
                lib: ["ESNext", "DOM", "DOM.Iterable"],
                rewriteRelativeImportExtensions: true,
                allowImportingTsExtensions: true,
                paths: {
                  "@beep/identity": ["../../../../packages/foundation/modeling/identity/src/index.ts"],
                  "effect-claudecode": ["../../claudecode/index.ts"],
                },
              },
            },
          });

          const result = yield* syncTsconfigAtRoot(rootDir, {
            mode: "sync",
            filter: "@beep/identity",
            verbose: false,
          });

          expect(result.changes).toHaveLength(1);
          expect(result.changes[0]?.section).toBe("package-docgen");

          const syncedIdentityDocgen = yield* readJsonFile(
            path.join(rootDir, "packages", "foundation", "modeling", "identity", "docgen.json")
          );
          expect(syncedIdentityDocgen).toMatchObject({
            exclude: ["src/**/*.spec.ts"],
            enforceDescriptions: true,
            srcDir: "claudecode",
            srcLink:
              "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/identity/claudecode/",
            examplesCompilerOptions: {
              module: "esnext",
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
              paths: {
                "effect-claudecode": ["../../claudecode/index.ts"],
              },
            },
          });
          expect(
            (
              syncedIdentityDocgen as {
                readonly examplesCompilerOptions?: { readonly paths?: Record<string, unknown> };
              }
            ).examplesCompilerOptions?.paths
          ).not.toHaveProperty("@beep/identity");
        })
      )
    ));

  it(
    "reports docgen drift in check mode and backfills missing managed fields in sync mode",
    () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const rootDir = process.cwd();

            yield* bootstrapRootConfig(rootDir, {
              workspaces: ["packages/foundation/*/*", "packages/example/*"],
              references: ["packages/example/protocol", "packages/foundation/modeling/schema"],
              paths: {
                "@beep/schema": ["./packages/foundation/modeling/schema/src/index.ts"],
                "@beep/schema/*": ["./packages/foundation/modeling/schema/src/*"],
                "@beep/schema/test/Markdown": [
                  "./packages/foundation/modeling/schema/src/internal/test/Markdown.test-kit.ts",
                ],
                "@beep/schema/test/Yaml": ["./packages/foundation/modeling/schema/src/internal/test/Yaml.test-kit.ts"],
                "@beep/example-protocol": ["./packages/example/protocol/src/index.ts"],
                "@beep/example-protocol/*": ["./packages/example/protocol/src/*"],
              },
              syncpackSources: [
                "package.json",
                "packages/foundation/*/*/package.json",
                "packages/example/*/package.json",
              ],
            });

            yield* bootstrapWorkspace(rootDir, {
              relativeDir: "packages/foundation/modeling/schema",
              packageName: "@beep/schema",
              docgenConfig: {
                $schema: "../../../../packages/tooling/tool/docgen/schema.json",
                exclude: ["src/internal/**/*.ts"],
                srcLink:
                  "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema/src/",
                examplesCompilerOptions: {
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
                  paths: {
                    "@beep/schema": ["../../../../packages/foundation/modeling/schema/src/index.ts"],
                    "@beep/schema/*": ["../../../../packages/foundation/modeling/schema/src/*.ts"],
                  },
                },
              },
            });
            yield* bootstrapWorkspace(rootDir, {
              relativeDir: "packages/example/protocol",
              packageName: "@beep/example-protocol",
              dependencies: {
                "@beep/schema": "workspace:*",
              },
              references: ["../../foundation/modeling/schema/tsconfig.json"],
              docgenConfig: {
                $schema: "../../../packages/tooling/tool/docgen/schema.json",
                srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/protocol/src/",
              },
            });

            const drift = yield* syncTsconfigAtRoot(rootDir, {
              mode: "check",
              filter: "@beep/example-protocol",
              verbose: false,
            }).pipe(
              Effect.match({
                onFailure: (error) => error,
                onSuccess: () => undefined,
              })
            );

            expect(drift?._tag).toBe("TsconfigSyncDriftError");
            if (drift?._tag !== "TsconfigSyncDriftError") {
              return;
            }
            expect(drift.fileCount).toBe(1);

            const syncResult = yield* syncTsconfigAtRoot(rootDir, {
              mode: "sync",
              filter: "@beep/example-protocol",
              verbose: false,
            });

            expect(syncResult.changes).toHaveLength(1);
            expect(syncResult.changes[0]?.section).toBe("package-docgen");

            const syncedProtocolDocgen = yield* readJsonFile(
              path.join(rootDir, "packages", "example", "protocol", "docgen.json")
            );
            expect(syncedProtocolDocgen).toMatchObject({
              exclude: ["src/internal/**/*.ts"],
              examplesCompilerOptions: {
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
              },
            });
            expect(
              (syncedProtocolDocgen as { readonly examplesCompilerOptions?: Record<string, unknown> })
                .examplesCompilerOptions
            ).not.toHaveProperty("paths");
          })
        )
      ),
    20_000
  );

  it(
    "treats lint-only docgen formatting drift as sync drift",
    () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const rootDir = process.cwd();

            yield* bootstrapRootConfig(rootDir, {
              workspaces: ["packages/foundation/*/*"],
              references: ["packages/foundation/modeling/example-docgen"],
              paths: {
                "@beep/example-docgen": ["./packages/foundation/modeling/example-docgen/src/index.ts"],
                "@beep/example-docgen/*": ["./packages/foundation/modeling/example-docgen/src/*"],
              },
              syncpackSources: ["package.json", "packages/foundation/*/*/package.json"],
            });

            yield* bootstrapWorkspace(rootDir, {
              relativeDir: "packages/foundation/modeling/example-docgen",
              packageName: "@beep/example-docgen",
            });

            const docgenPath = path.join(
              rootDir,
              "packages",
              "foundation",
              "modeling",
              "example-docgen",
              "docgen.json"
            );
            yield* writeTextFile(
              docgenPath,
              `{
  "$schema": "../../../../packages/tooling/tool/docgen/schema.json",
  "exclude": [
    "src/internal/**/*.ts"
  ],
  "srcLink": "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/example-docgen/src/",
  "examplesCompilerOptions": {
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "module": "es2022",
    "target": "es2022",
    "lib": [
      "ESNext",
      "DOM",
      "DOM.Iterable"
    ],
    "rewriteRelativeImportExtensions": true,
    "allowImportingTsExtensions": true,
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "allowJs": false,
    "erasableSyntaxOnly": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "stripInternal": false,
    "noErrorTruncation": true,
    "types": [],
    "jsx": "react-jsx",
    "paths": {
      "@beep/example-docgen": [
        "../../../../packages/foundation/modeling/example-docgen/src/index.ts"
      ],
      "@beep/example-docgen/*": [
        "../../../../packages/foundation/modeling/example-docgen/src/*.ts"
      ]
    }
  }
}
`
            );

            const drift = yield* syncTsconfigAtRoot(rootDir, {
              mode: "check",
              filter: "@beep/example-docgen",
              verbose: false,
            }).pipe(
              Effect.match({
                onFailure: (error) => error,
                onSuccess: () => undefined,
              })
            );

            expect(drift?._tag).toBe("TsconfigSyncDriftError");

            const syncResult = yield* syncTsconfigAtRoot(rootDir, {
              mode: "sync",
              filter: "@beep/example-docgen",
              verbose: false,
            });

            expect(syncResult.changes).toHaveLength(1);
            expect(syncResult.changes[0]?.section).toBe("package-docgen");

            const syncedText = yield* fs.readFileString(docgenPath);
            const syncedDocgen = decodeUnknownJson(syncedText) as {
              readonly examplesCompilerOptions?: Record<string, unknown>;
            };

            expect(syncedText).toContain('"exclude": ["src/internal/**/*.ts"],');
            expect(syncedText).toContain('"lib": ["ESNext", "DOM", "DOM.Iterable"],');
            expect(syncedDocgen.examplesCompilerOptions).not.toHaveProperty("paths");
          })
        )
      ),
    20_000
  );
});
