import { CommandJsonOutput } from "@beep/repo-cli/test/Cli";
import { EffectImportRulesOptions, lawsCommand, runEffectImportRules } from "@beep/repo-cli/test/Laws";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TestConsole.layer
);
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const runLawsCommand = Command.runWith(lawsCommand, { version: "0.0.0" });

const withTempWorkingDirectory = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();
      process.chdir(tmpDir);
      return { fs, previousCwd, tmpDir } as const;
    }),
    () => use,
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true });
      })
  );

const writeProjectFile = Effect.fn(function* (relativePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(process.cwd(), relativePath);
  const directoryPath = path.dirname(absolutePath);

  yield* fs.makeDirectory(directoryPath, { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const readProjectFile = Effect.fn(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(process.cwd(), relativePath));
});

const writeTsconfig = writeProjectFile(
  "tsconfig.json",
  A.join(["{", '  "compilerOptions": {', '    "target": "ES2022",', '    "module": "ESNext"', "  }", "}"], "\n")
);

const writeDemoFoundationPackage = Effect.fn(function* (
  publishModelsLeaf: boolean,
  ambiguousHelperLeaf = false,
  includePublishConfig = true
) {
  const workspaceExports = {
    ".": "./src/index.ts",
    "./Demo": "./src/Demo.ts",
    "./Helper": "./src/Helper.ts",
    ...(ambiguousHelperLeaf === true ? { "./HelperAlias": "./src/Helper.ts" } : {}),
    "./Models": "./src/Models.ts",
    "./Nested": "./src/Nested.ts",
  };
  const publishExports = {
    ".": "./dist/index.js",
    "./Demo": "./dist/Demo.js",
    "./Helper": "./dist/Helper.js",
    ...(ambiguousHelperLeaf === true ? { "./HelperAlias": "./dist/Helper.js" } : {}),
    ...(publishModelsLeaf === true ? { "./Models": "./dist/Models.js" } : {}),
    "./Nested": "./dist/Nested.js",
  };

  yield* writeProjectFile(
    "packages/foundation/modeling/demo/package.json",
    `${encodeJson({
      name: "@beep/demo",
      version: "0.0.0",
      private: true,
      type: "module",
      exports: workspaceExports,
      ...(includePublishConfig === true ? { publishConfig: { exports: publishExports } } : {}),
    })}\n`
  );
  yield* writeProjectFile(
    "packages/foundation/modeling/demo/src/index.ts",
    A.join(
      [
        'export * as Demo from "./Demo.ts";',
        'export { default } from "./Demo.ts";',
        'export { helper as renamedHelper } from "./Helper.ts";',
        'export * from "./Models.ts";',
        'export const VERSION = "0.0.0";',
        "",
      ],
      "\n"
    )
  );
  yield* writeProjectFile(
    "packages/foundation/modeling/demo/src/Demo.ts",
    "export const value = 1;\nexport default { value } as const;\n"
  );
  yield* writeProjectFile(
    "packages/foundation/modeling/demo/src/Helper.ts",
    "export const helper = 2;\nexport const another = 3;\n"
  );
  yield* writeProjectFile(
    "packages/foundation/modeling/demo/src/Models.ts",
    'export * as Nested from "./Nested.ts";\nexport interface Model { value: number }\n'
  );
  yield* writeProjectFile("packages/foundation/modeling/demo/src/Nested.ts", "export const value = 4;\n");
});

const demoSource = A.join(
  [
    'import { Effect as Fx, MutableList, pipe as p, type Scope } from "effect";',
    'import * as Command from "effect/unstable/cli";',
    "",
    "export const program: Fx.Effect<void> = Fx.void;",
    "export const items = MutableList.make<number>();",
    "export const scoped: Scope.Scope | undefined = undefined;",
    "export const piped = p(1, (value) => value + 1);",
    "export const command = Command.run;",
    "",
  ],
  "\n"
);

describe("effect import laws", () => {
  it("validates candidate CLI flags and renders text and JSON summaries", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            'import { Effect } from "effect";\nexport const program = Effect.void;\n'
          );

          const candidateWrite = yield* Effect.exit(
            runLawsCommand(["effect-imports", "--candidate", "--write", "--include", "packages/demo/src/index.ts"])
          );
          const unscopedCandidate = yield* Effect.exit(runLawsCommand(["effect-imports", "--candidate"]));

          expect(candidateWrite._tag).toBe("Failure");
          expect(unscopedCandidate._tag).toBe("Failure");

          yield* runLawsCommand([
            "effect-imports",
            "--candidate",
            "--include-prefix",
            "packages/demo",
            "--exclude",
            "packages/demo/src/ignored.ts",
          ]);
          expect(yield* TestConsole.logLines).toContain("[effect-governance-imports] operation=dry-run");
          expect(yield* TestConsole.logLines).toContain("[effect-governance-imports] candidate=true");

          const jsonChunks: Array<string> = [];
          const strictJson = yield* Effect.exit(
            runLawsCommand([
              "effect-imports",
              "--candidate",
              "--check",
              "--include",
              "packages/demo/src/index.ts",
              "--mode",
              "code",
              "--enforce-documentation",
              "--json",
            ]).pipe(
              Effect.provideService(CommandJsonOutput, (text) =>
                Effect.sync(() => {
                  jsonChunks.push(text);
                })
              )
            )
          );

          expect(strictJson._tag).toBe("Failure");
          expect(JSON.parse(A.join(jsonChunks, ""))).toMatchObject({
            candidate: true,
            mode: "code",
            strictFailure: true,
          });
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("is a no-op before a family is promoted", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile("packages/demo/src/index.ts", demoSource);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({ write: false, strictCheck: true, excludePaths: [] })
          );

          expect(summary.scannedFiles).toBe(0);
          expect(summary.touchedFiles).toBe(0);
          expect(summary.rootImportsRewritten).toBe(0);
          expect(summary.strictFailure).toBe(false);
          expect(yield* readProjectFile("packages/demo/src/index.ts")).toBe(demoSource);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("plans aliases, Function bindings, and type-only namespaces in candidate mode without writing", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile("packages/ecosystem/member/test/index.test.ts", demoSource);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: false,
              strictCheck: true,
              candidate: true,
              excludePaths: [],
              includePrefixes: ["packages/ecosystem/member"],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.touchedFiles).toBe(1);
          expect(summary.rootImportsRewritten).toBe(1);
          expect(summary.emittedImports).toBe(4);
          expect(summary.rootSpecifierCounts).toEqual({ effect: 1 });
          expect(summary.manualReviews).toEqual([]);
          expect(summary.strictFailure).toBe(true);
          expect(yield* readProjectFile("packages/ecosystem/member/test/index.test.ts")).toBe(demoSource);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("rejects candidate writes at the exported runner boundary", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile("apps/demo/src/index.ts", demoSource);

          const failure = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              candidate: true,
              excludePaths: [],
              includePrefixes: ["apps/demo"],
            })
          ).pipe(Effect.flip);

          expect(failure._tag).toBe("EffectImportRulesConfigurationError");
          expect(failure.message).toContain("dry-run only");
          expect(yield* readProjectFile("apps/demo/src/index.ts")).toBe(demoSource);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("scans the union of explicit files and include prefixes", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile("apps/explicit.ts", demoSource);
          yield* writeProjectFile("packages/demo/src/prefix.ts", demoSource);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: false,
              strictCheck: true,
              candidate: true,
              excludePaths: [],
              includePaths: ["apps/explicit.ts"],
              includePrefixes: ["packages/demo"],
            })
          );

          expect(summary.scannedFiles).toBe(2);
          expect(summary.touchedFiles).toBe(2);
          expect(summary.rootImportsRewritten).toBe(2);
          expect(summary.changedFiles).toEqual(["apps/explicit.ts", "packages/demo/src/prefix.ts"]);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("leaves generated source files to their owning generators", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile("packages/demo/src/index.ts", demoSource);
          yield* writeProjectFile("packages/demo/src/_generated/schema.ts", demoSource);
          yield* writeProjectFile("packages/demo/src/generated/client.ts", demoSource);
          yield* writeProjectFile("packages/demo/src/schema.gen.ts", demoSource);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["packages/demo"],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.rootImportsRewritten).toBe(1);
          expect(yield* readProjectFile("packages/demo/src/index.ts")).not.toContain('from "effect"');
          expect(yield* readProjectFile("packages/demo/src/_generated/schema.ts")).toBe(demoSource);
          expect(yield* readProjectFile("packages/demo/src/generated/client.ts")).toBe(demoSource);
          expect(yield* readProjectFile("packages/demo/src/schema.gen.ts")).toBe(demoSource);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("rewrites promoted roots to per-module imports and never reverses stable submodules", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile("packages/demo/src/index.ts", demoSource);

          const first = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["packages/demo"],
            })
          );
          const source = yield* readProjectFile("packages/demo/src/index.ts");

          expect(first.touchedFiles).toBe(1);
          expect(first.rootImportsRewritten).toBe(1);
          expect(first.emittedImports).toBe(4);
          expect(first.strictFailure).toBe(true);
          expect(source).toContain('import * as Fx from "effect/Effect";');
          expect(source).toContain('import * as MutableList from "effect/MutableList";');
          expect(source).toContain('import type * as Scope from "effect/Scope";');
          expect(source).toContain('import { pipe as p } from "effect/Function";');
          expect(source).toContain('import * as Command from "effect/unstable/cli";');
          expect(source).not.toContain('from "effect"');

          const second = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["packages/demo"],
            })
          );

          expect(second.touchedFiles).toBe(0);
          expect(second.rootImportsRewritten).toBe(0);
          expect(second.emittedImports).toBe(0);
          expect(second.strictFailure).toBe(false);
          expect(yield* readProjectFile("packages/demo/src/index.ts")).toBe(source);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("keeps executable shebangs ahead of newly emitted imports", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = A.join(
            [
              "#!/usr/bin/env bun",
              "",
              "/**",
              " * Executable package entrypoint.",
              " *",
              " * @packageDocumentation",
              " */",
              'import { Config, Effect, Layer } from "effect";',
              "",
              "export const program = Effect.succeed([Config.string, Layer.empty]);",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("apps/demo/src/bin.ts", source);

          const first = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["apps/demo"],
            })
          );
          const rewritten = yield* readProjectFile("apps/demo/src/bin.ts");

          expect(first.rootImportsRewritten).toBe(1);
          expect(rewritten).toMatch(/^#!\/usr\/bin\/env bun\n\n\/\*\*/);
          expect(Str.split("#!")(rewritten)).toHaveLength(2);
          expect(rewritten).toContain('import * as Config from "effect/Config";');
          expect(rewritten).toContain('import * as Effect from "effect/Effect";');
          expect(rewritten).toContain('import * as Layer from "effect/Layer";');

          const second = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["apps/demo"],
            })
          );
          expect(second.touchedFiles).toBe(0);
          expect(yield* readProjectFile("apps/demo/src/bin.ts")).toBe(rewritten);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("routes side-effect-only root imports to manual review", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = 'import "effect";\nexport const value = 1;\n';
          yield* writeProjectFile("apps/demo/src/index.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: false,
              strictCheck: true,
              candidate: true,
              excludePaths: [],
              includePrefixes: ["apps/demo"],
            })
          );

          expect(summary.touchedFiles).toBe(1);
          expect(summary.rootImportsRewritten).toBe(0);
          expect(summary.manualReviews).toHaveLength(1);
          expect(summary.manualReviews[0]?.kind).toBe("side-effect");
          expect(summary.manualReviews[0]?.binding).toBe("side-effect import");
          expect(summary.strictFailure).toBe(true);
          expect(yield* readProjectFile("apps/demo/src/index.ts")).toBe(source);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("keeps manual-review line numbers anchored after a shebang prefix", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = A.join(
            [
              "#!/usr/bin/env bun",
              "",
              'import { FutureModule } from "effect";',
              "export const value = FutureModule;",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("apps/demo/src/bin.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: false,
              strictCheck: true,
              candidate: true,
              excludePaths: [],
              includePrefixes: ["apps/demo"],
            })
          );

          expect(summary.manualReviews).toHaveLength(1);
          expect(summary.manualReviews[0]?.binding).toBe("FutureModule");
          expect(summary.manualReviews[0]?.line).toBe(3);
          expect(yield* readProjectFile("apps/demo/src/bin.ts")).toBe(source);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("leaves an entire declaration unchanged when any binding is unmapped", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = 'import { Effect, FutureModule } from "effect";\nexport const value = Effect.void;\n';
          yield* writeProjectFile("infra/example.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["infra"],
            })
          );

          expect(summary.touchedFiles).toBe(1);
          expect(summary.rootImportsRewritten).toBe(0);
          expect(summary.manualReviews).toHaveLength(1);
          expect(summary.manualReviews[0]?.binding).toBe("FutureModule");
          expect(summary.strictFailure).toBe(true);
          expect(yield* readProjectFile("infra/example.ts")).toBe(source);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("derives foundation mappings from source barrels and both export maps", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeDemoFoundationPackage(true);
          const source = A.join(
            [
              'import { another } from "@beep/demo/Helper";',
              'import DemoDefault, { Demo as D, Nested, renamedHelper, type Model } from "@beep/demo";',
              "",
              "export const result = DemoDefault.value + D.value + Nested.value + renamedHelper + another;",
              "export const model: Model = { value: result };",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("apps/demo/src/index.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["apps/demo"],
            })
          );
          const rewritten = yield* readProjectFile("apps/demo/src/index.ts");

          expect(summary.rootImportsRewritten).toBe(1);
          expect(summary.emittedImports).toBe(5);
          expect(summary.manualReviews).toEqual([]);
          expect(rewritten).toContain('import DemoDefault, * as D from "@beep/demo/Demo";');
          expect(rewritten).toContain('import * as Nested from "@beep/demo/Nested";');
          expect(rewritten).toContain('import { another, helper as renamedHelper } from "@beep/demo/Helper";');
          expect(rewritten).toContain('import type { Model } from "@beep/demo/Models";');
          expect(rewritten).not.toContain('from "@beep/demo"');
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("refuses a foundation target missing from the published export map", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeDemoFoundationPackage(false);
          const source = 'import { type Model } from "@beep/demo";\nexport type Example = Model;\n';
          yield* writeProjectFile("apps/demo/src/index.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["apps/demo"],
            })
          );

          expect(summary.rootImportsRewritten).toBe(0);
          expect(summary.manualReviews).toHaveLength(1);
          expect(summary.manualReviews[0]?.binding).toBe("Model");
          expect(yield* readProjectFile("apps/demo/src/index.ts")).toBe(source);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("refuses foundation targets when a private package has no published export map", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeDemoFoundationPackage(true, false, false);
          const source = 'import { Demo } from "@beep/demo";\nexport const value = Demo.value;\n';
          yield* writeProjectFile("apps/demo/src/index.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["apps/demo"],
            })
          );

          expect(summary.rootImportsRewritten).toBe(0);
          expect(summary.manualReviews).toHaveLength(1);
          expect(summary.manualReviews[0]?.kind).toBe("missing-mapping");
          expect(summary.manualReviews[0]?.binding).toBe("Demo");
          expect(yield* readProjectFile("apps/demo/src/index.ts")).toBe(source);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("queues an ambiguous review when two public leaves expose the same source module", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeDemoFoundationPackage(true, true);
          const source = 'import { renamedHelper } from "@beep/demo";\nexport const value = renamedHelper;\n';
          yield* writeProjectFile("apps/demo/src/index.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["apps/demo"],
            })
          );

          expect(summary.rootImportsRewritten).toBe(0);
          expect(summary.manualReviews).toHaveLength(1);
          expect(summary.manualReviews[0]?.kind).toBe("ambiguous");
          expect(summary.manualReviews[0]?.binding).toBe("renamedHelper");
          expect(yield* readProjectFile("apps/demo/src/index.ts")).toBe(source);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("merges compatible destination imports and preserves declaration comments", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = A.join(
            [
              "/** Root import rationale. */",
              'import { Effect, pipe } from "effect"; // trailing-root-comment',
              'import { flow } from "effect/Function";',
              "",
              "export const value = pipe(Effect.void, flow((item) => item));",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("packages/demo/src/index.ts", source);

          yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["packages/demo"],
            })
          );
          const rewritten = yield* readProjectFile("packages/demo/src/index.ts");

          expect(rewritten).toContain('import * as Effect from "effect/Effect";');
          expect(rewritten).toContain('import { flow, pipe } from "effect/Function";');
          expect(rewritten).toContain("Root import rationale.");
          expect(rewritten).toContain("trailing-root-comment");
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("merges a comment-bearing declaration without deleting unrelated unused imports", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = A.join(
            [
              'import { unused } from "./unused.ts";',
              'import { flow } from "effect/Function";',
              "/** Keep this rationale with the merged destination. */",
              'import { pipe } from "effect"; // keep-this-trailing-comment',
              "",
              "export const value = pipe(1, flow((item) => item));",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("packages/demo/src/index.ts", source);

          yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["packages/demo"],
            })
          );
          const rewritten = yield* readProjectFile("packages/demo/src/index.ts");

          expect(rewritten).toContain('import { unused } from "./unused.ts";');
          expect(rewritten).toContain('import { flow, pipe } from "effect/Function";');
          expect(rewritten).toContain("Keep this rationale with the merged destination.");
          expect(rewritten).toContain("keep-this-trailing-comment");
          expect(rewritten.match(/effect\/Function/g)).toHaveLength(1);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("preserves aliases instead of inventing collision-prone canonical names", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = A.join(
            [
              'import { Option as Maybe } from "effect";',
              "const O = { sentinel: true };",
              "export const value = [Maybe.some(1), O.sentinel] as const;",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("apps/demo/src/index.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["apps/demo"],
            })
          );
          const rewritten = yield* readProjectFile("apps/demo/src/index.ts");

          expect(summary.manualReviews).toEqual([]);
          expect(rewritten).toContain('import * as Maybe from "effect/Option";');
          expect(rewritten).toContain("const O = { sentinel: true };");
          expect(rewritten).not.toContain("import * as O");
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("rewrites named root re-exports and preserves their exported aliases", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeDemoFoundationPackage(true);
          const source = A.join(
            [
              'export { renamedHelper as publicHelper } from "@beep/demo";',
              'export { Effect as Fx, pipe as p } from "effect";',
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("packages/demo-consumer/src/index.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["packages/demo-consumer"],
            })
          );
          const rewritten = yield* readProjectFile("packages/demo-consumer/src/index.ts");

          expect(summary.rootExportsRewritten).toBe(2);
          expect(summary.emittedExports).toBe(3);
          expect(summary.manualReviews).toEqual([]);
          expect(rewritten).toContain('export { helper as publicHelper } from "@beep/demo/Helper";');
          expect(rewritten).toContain('export * as Fx from "effect/Effect";');
          expect(rewritten).toContain('export { pipe as p } from "effect/Function";');
          expect(rewritten).not.toContain('from "@beep/demo"');
          expect(rewritten).not.toContain('from "effect"');
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("routes dynamic, import-type, and import-equals roots to structured manual review", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = A.join(
            [
              'const load = () => import("effect");',
              'type Program = import("effect").Effect.Effect<void>;',
              'import EffectRoot = require("effect");',
              "export type { Program };",
              "export { load, EffectRoot };",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("infra/manual.ts", source);

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              excludePaths: [],
              promotedFamilyPrefixes: ["infra"],
            })
          );

          expect(A.map(summary.manualReviews, (review) => review.kind)).toEqual([
            "dynamic-import",
            "import-type",
            "import-equals",
          ]);
          expect(A.map(summary.manualReviews, (review) => review.line)).toEqual([1, 2, 3]);
          expect(summary.rootSpecifierCounts).toEqual({ effect: 3 });
          expect(summary.strictFailure).toBe(true);
          expect(yield* readProjectFile("infra/manual.ts")).toBe(source);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("rewrites imports inside JSDoc TypeScript fences without touching executable imports", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = A.join(
            [
              "/**",
              " * Demonstrates a fenced program.",
              " *",
              " * **Example** (Run a program)",
              " *",
              " * ```ts",
              ' * import { Effect, pipe } from "effect"',
              " * console.log(pipe(Effect.void, Effect.as(1)))",
              " * ```",
              " *",
              " * @since 0.0.0",
              " */",
              "export const value = 1;",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("packages/demo/src/index.ts", source);

          const first = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              mode: "jsdoc",
              excludePaths: [],
              promotedFamilyPrefixes: ["packages/demo"],
            })
          );
          const rewritten = yield* readProjectFile("packages/demo/src/index.ts");

          expect(first.scannedFiles).toBe(1);
          expect(first.scannedFences).toBe(1);
          expect(first.rootImportsRewritten).toBe(1);
          expect(rewritten).toContain(' * import * as Effect from "effect/Effect";');
          expect(rewritten).toContain(' * import { pipe } from "effect/Function";');
          expect(rewritten).toContain(" * @since 0.0.0");
          expect(rewritten).toContain("export const value = 1;");

          const second = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              mode: "jsdoc",
              excludePaths: [],
              promotedFamilyPrefixes: ["packages/demo"],
            })
          );
          expect(second.touchedFiles).toBe(0);
          expect(yield* readProjectFile("packages/demo/src/index.ts")).toBe(rewritten);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("keeps the Markdown gate advisory until explicitly enforced and supports promoted writes", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const markdown = A.join(
            [
              "# Guide",
              "",
              "```ts",
              'import { Effect, flow } from "effect"',
              "console.log(flow(() => Effect.void)())",
              "```",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("docs/guide.md", markdown);

          const advisory = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: false,
              strictCheck: true,
              mode: "markdown",
              excludePaths: [],
            })
          );
          expect(advisory.scannedFiles).toBe(1);
          expect(advisory.scannedFences).toBe(1);
          expect(advisory.touchedFiles).toBe(1);
          expect(advisory.strictFailure).toBe(false);
          expect(yield* readProjectFile("docs/guide.md")).toBe(markdown);

          const written = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: true,
              mode: "markdown",
              excludePaths: [],
              promotedFamilyPrefixes: ["docs"],
            })
          );
          const rewritten = yield* readProjectFile("docs/guide.md");
          expect(written.rootImportsRewritten).toBe(1);
          expect(rewritten).toContain('import * as Effect from "effect/Effect";');
          expect(rewritten).toContain('import { flow } from "effect/Function";');

          const enforced = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: false,
              strictCheck: true,
              mode: "markdown",
              enforceDocumentation: true,
              excludePaths: [],
            })
          );
          expect(enforced.touchedFiles).toBe(0);
          expect(enforced.strictFailure).toBe(false);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));
});
