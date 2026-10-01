import { FrozenGrantSetRulesOptions, runFrozenGrantSetRules } from "@beep/repo-cli/test/Laws";
import { TSMorphServiceLive } from "@beep/repo-utils/TSMorph/index";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Console, Effect, FileSystem, Layer, Path } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { temporaryWorkingDirectory } from "./support/CommandTest.ts";

const testLayer = Layer.mergeAll(NodeServices.layer, TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer)));
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

it.layer(testLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
  describe("frozen grant set laws", () => {
    it.effect("flags FrozenGrantSet.make calls outside the defining module", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("exempts the defining module", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("flags a nested copy of the canonical defining-module suffix", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("flags make calls through an import alias", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("flags make calls through a variable alias", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("flags calls of a destructured make binding", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("flags calls of an extracted make reference", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("flags direct new FrozenGrantSet expressions", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("flags new expressions on a tainted alias", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("ignores unrelated make calls", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
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
      ).pipe(Effect.orDie, Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
