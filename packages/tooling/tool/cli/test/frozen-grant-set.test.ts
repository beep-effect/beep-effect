import { FrozenGrantSetRulesOptions, runFrozenGrantSetRules } from "@beep/repo-cli/test/Laws";
import { TSMorphServiceLive } from "@beep/repo-utils/TSMorph/index";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer)));

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

const writeProjectScaffold = Effect.gen(function* () {
  yield* writeProjectFile("bun.lock", "");
  yield* writeProjectFile(
    "tsconfig.json",
    A.join(
      [
        "{",
        '  "compilerOptions": {',
        '    "target": "ES2022",',
        '    "module": "ESNext",',
        '    "moduleResolution": "Bundler",',
        '    "strict": true,',
        '    "skipLibCheck": true',
        "  },",
        '  "include": ["apps/**/*.ts", "apps/**/*.tsx", "packages/**/*.ts", "packages/**/*.tsx", "infra/**/*.ts"]',
        "}",
        "",
      ],
      "\n"
    )
  );
});

describe("frozen grant set laws", () => {
  it("flags FrozenGrantSet.make calls outside the defining module", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "declare const FrozenGrantSet: { make: (input: object) => unknown };",
                "",
                "export const grants = FrozenGrantSet.make({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.touchedFiles).toBe(1);
          expect(summary.violationCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
          expect(summary.affectedFiles).toEqual(["packages/demo/src/index.ts"]);
          expect(A.map(summary.diagnostics, (diagnostic) => diagnostic.ruleId)).toEqual([
            "effect-governance-frozen-grant-set",
          ]);
          expect(A.map(summary.diagnostics, (diagnostic) => diagnostic.severity)).toEqual(["error"]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("exempts the defining module", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts",
            A.join(
              [
                "declare const FrozenGrantSet: { make: (input: object) => unknown };",
                "",
                "export const grants = FrozenGrantSet.make({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.touchedFiles).toBe(0);
          expect(summary.violationCount).toBe(0);
          expect(summary.strictFailure).toBe(false);
          expect(summary.affectedFiles).toEqual([]);
          expect(summary.diagnostics).toEqual([]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("flags a nested copy of the canonical defining-module suffix", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/evil/src/values/GrantSet/GrantSet.model.ts",
            A.join(
              [
                "declare const FrozenGrantSet: { make: (input: object) => unknown };",
                "",
                "export const grants = FrozenGrantSet.make({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.violationCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
          expect(summary.affectedFiles).toEqual(["packages/evil/src/values/GrantSet/GrantSet.model.ts"]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("flags make calls through an import alias", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                'import { FrozenGrantSet as F } from "@beep/epistemic-domain";',
                "",
                "export const grants = F.make({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.violationCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
          expect(summary.affectedFiles).toEqual(["packages/demo/src/index.ts"]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("flags make calls through a variable alias", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "declare const FrozenGrantSet: { make: (input: object) => unknown };",
                "",
                "const X = FrozenGrantSet;",
                "",
                "export const grants = X.make({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.violationCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("flags calls of a destructured make binding", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "declare const FrozenGrantSet: { make: (input: object) => unknown };",
                "",
                "const { make } = FrozenGrantSet;",
                "",
                "export const grants = make({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.violationCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("flags calls of an extracted make reference", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "declare const FrozenGrantSet: { make: (input: object) => unknown };",
                "",
                "const m = FrozenGrantSet.make;",
                "",
                "export const grants = m({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.violationCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("flags direct new FrozenGrantSet expressions", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "declare const FrozenGrantSet: new (input: object) => unknown;",
                "",
                "export const grants = new FrozenGrantSet({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.violationCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("flags new expressions on a tainted alias", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "declare const FrozenGrantSet: new (input: object) => unknown;",
                "",
                "const F = FrozenGrantSet;",
                "",
                "export const grants = new F({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.violationCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("ignores unrelated make calls", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "declare const Foo: { make: (input: object) => unknown };",
                "",
                "export const value = Foo.make({});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runFrozenGrantSetRules(
            FrozenGrantSetRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.touchedFiles).toBe(0);
          expect(summary.violationCount).toBe(0);
          expect(summary.strictFailure).toBe(false);
          expect(summary.diagnostics).toEqual([]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));
});
