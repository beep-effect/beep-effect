import { EffectFnRulesOptions, runEffectFnRules } from "@beep/repo-cli/test/Laws";
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
const CLI_ENTRYPOINT = new URL("../src/bin.ts", import.meta.url).pathname;

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

const runCliCommand = Effect.fn("effect-fn.test.runCliCommand")(function* (...args: ReadonlyArray<string>) {
  return yield* Effect.sync(() => {
    const result = Bun.spawnSync(["bun", "run", CLI_ENTRYPOINT, "--", ...args], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = `${result.stdout.toString()}${result.stderr.toString()}`;
    return { exitCode: result.exitCode, output } as const;
  });
});

describe("effect fn laws", () => {
  it("flags direct Effect.gen returns that tsgo effectFnOpportunity can miss", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                'import { Effect } from "effect";',
                "",
                "declare const flag: boolean;",
                "declare const effects: ReadonlyArray<Effect.Effect<string>>;",
                "",
                "export const annotatedExpression = (value: string): Effect.Effect<string> => Effect.gen(function* () {",
                "  return yield* Effect.succeed(value);",
                "});",
                "",
                "export const annotatedBlock = (value: string): Effect.Effect<string> => {",
                "  const prefix = 'x';",
                "  return Effect.gen(function* () {",
                "    return `${prefix}${value}`;",
                "  });",
                "};",
                "",
                "export const conditional = (value: string): Effect.Effect<string> => {",
                "  if (flag) return Effect.succeed(value);",
                "  return Effect.gen(function* () {",
                "    return yield* Effect.succeed(value);",
                "  });",
                "};",
                "",
                "export function declared(value: string): Effect.Effect<string> {",
                "  return Effect.gen(function* () {",
                "    return yield* Effect.succeed(value);",
                "  });",
                "}",
                "",
                "export const handlers = {",
                "  method(value: string): Effect.Effect<string> {",
                "    return Effect.gen(function* () {",
                "      return yield* Effect.succeed(value);",
                "    });",
                "  },",
                "};",
                "",
                "export const mapped = effects.map((effect) => {",
                "  return Effect.gen(function* () {",
                "    return yield* effect;",
                "  });",
                "});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runEffectFnRules(
            EffectFnRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.touchedFiles).toBe(1);
          expect(summary.violationCount).toBe(6);
          expect(summary.strictFailure).toBe(true);
          expect(summary.affectedFiles).toEqual(["packages/demo/src/index.ts"]);
          expect(A.map(summary.diagnostics, (diagnostic) => diagnostic.ownerName)).toEqual([
            "annotatedExpression",
            "annotatedBlock",
            "conditional",
            "declared",
            "method",
            "callback",
          ]);
          expect(A.map(summary.diagnostics, (diagnostic) => diagnostic.recommendation)).toEqual([
            "Effect.fn",
            "Effect.fn",
            "Effect.fn",
            "Effect.fn",
            "Effect.fn",
            "Effect.fnUntraced",
          ]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("ignores one-off effects, existing Effect.fn wrappers, excluded paths, and non-direct Effect.gen composition", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                'import { Effect } from "effect";',
                "",
                "export const program = Effect.gen(function* () {",
                "  return yield* Effect.succeed(1);",
                "});",
                "",
                "export const scoped = () => Effect.scoped(Effect.gen(function* () {",
                "  return yield* Effect.succeed(1);",
                "}));",
                "",
                "export const already = Effect.fn('already')(function* (value: string) {",
                "  return yield* Effect.succeed(value);",
                "});",
                "",
                "export const alreadyUntraced = Effect.fnUntraced(function* (value: string) {",
                "  return yield* Effect.succeed(value);",
                "});",
                "",
              ],
              "\n"
            )
          );
          yield* writeProjectFile(
            "packages/demo/test/index.ts",
            A.join(
              [
                'import { Effect } from "effect";',
                "",
                "export const ignored = (value: string): Effect.Effect<string> => Effect.gen(function* () {",
                "  return yield* Effect.succeed(value);",
                "});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runEffectFnRules(
            EffectFnRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.touchedFiles).toBe(0);
          expect(summary.violationCount).toBe(0);
          expect(summary.strictFailure).toBe(false);
          expect(summary.affectedFiles).toEqual([]);
          expect(summary.diagnostics).toEqual([]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("honors explicit exclude paths", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                'import { Effect } from "effect";',
                "",
                "export const ignored = (value: string): Effect.Effect<string> => Effect.gen(function* () {",
                "  return yield* Effect.succeed(value);",
                "});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runEffectFnRules(
            EffectFnRulesOptions.make({
              strictCheck: true,
              excludePaths: ["packages/demo/src/index.ts"],
            })
          );

          expect(summary.scannedFiles).toBe(0);
          expect(summary.touchedFiles).toBe(0);
          expect(summary.violationCount).toBe(0);
          expect(summary.strictFailure).toBe(false);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it(
    "exits non-zero from the CLI command when strict check finds a violation",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeProjectScaffold;
            yield* writeProjectFile(
              "packages/demo/src/index.ts",
              A.join(
                [
                  'import { Effect } from "effect";',
                  "",
                  "export const loadDemo = (): Effect.Effect<string> => Effect.gen(function* () {",
                  '  return "demo";',
                  "});",
                  "",
                ],
                "\n"
              )
            );

            const result = yield* runCliCommand("laws", "effect-fn", "--check");

            expect(result.exitCode).not.toBe(0);
            expect(result.output).toContain("[effect-governance-effect-fn] violations=1");
            expect(result.output).toContain("packages/demo/src/index.ts");
            expect(result.output).toContain('Use named Effect.fn("loadDemo") instead');
          })
        ).pipe(provideScopedLayer(testLayer), Effect.orDie)
      ),
    30_000
  );
});
