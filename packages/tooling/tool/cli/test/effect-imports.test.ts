import { EffectImportRulesOptions, runEffectImportRules } from "@beep/repo-cli/test/Laws";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer);

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

describe("effect import laws", () => {
  it("flags stable submodule namespace imports in dry-run mode while ignoring unstable ones", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                'import * as Duration from "effect/Duration";',
                'import * as Command from "effect/unstable/cli";',
                "",
                "export const duration = Duration.seconds(1);",
                "export const command = Command.run;",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: false,
              strictCheck: true,
              excludePaths: [],
            })
          );
          const source = yield* readProjectFile("packages/demo/src/index.ts");

          expect(summary.touchedFiles).toBe(1);
          expect(summary.aliasRenamed).toBe(0);
          expect(summary.stableConverted).toBe(1);
          expect(summary.strictFailure).toBe(true);
          expect(summary.changedFiles).toEqual(["packages/demo/src/index.ts"]);
          expect(source).toContain('import * as Duration from "effect/Duration";');
          expect(source).toContain('import * as Command from "effect/unstable/cli";');
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("rewrites stable submodule namespace imports to root effect imports in write mode", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                'import * as Duration from "effect/Duration";',
                'import * as Command from "effect/unstable/cli";',
                "",
                "export const duration = Duration.seconds(1);",
                "export const command = Command.run;",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: true,
              strictCheck: false,
              excludePaths: [],
            })
          );
          const source = yield* readProjectFile("packages/demo/src/index.ts");

          expect(summary.touchedFiles).toBe(1);
          expect(summary.stableConverted).toBe(1);
          expect(summary.strictFailure).toBe(false);
          expect(source).toContain('import { Duration } from "effect";');
          expect(source).toContain('import * as Command from "effect/unstable/cli";');
          expect(source).not.toContain('import * as Duration from "effect/Duration";');
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("exempts ecosystem members in full and explicit include scans", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeTsconfig;
          const source = 'import * as Duration from "effect/Duration";\nexport const value = Duration.seconds(1);\n';
          yield* writeProjectFile("packages/ecosystem/member/src/index.ts", source);
          yield* writeProjectFile("packages/demo/src/index.ts", source);

          const fullSummary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({ write: false, strictCheck: true, excludePaths: [] })
          );
          expect(fullSummary.changedFiles).toEqual(["packages/demo/src/index.ts"]);
          expect(fullSummary.strictFailure).toBe(true);

          const explicitSummary = yield* runEffectImportRules(
            EffectImportRulesOptions.make({
              write: false,
              strictCheck: true,
              excludePaths: [],
              includePaths: ["packages/ecosystem/member/src/index.ts"],
            })
          );
          expect(explicitSummary.changedFiles).toEqual([]);
          expect(explicitSummary.strictFailure).toBe(false);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));
});
