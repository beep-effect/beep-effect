import {
  decodeTSConfig,
  decodeTSConfigExit,
  decodeTSConfigFromJsoncTextEffect,
  encodeTSConfigEffect,
  encodeTSConfigPrettyEffect,
  encodeTSConfigToJsonEffect,
  jsonParse,
  TSConfig,
  TSConfigCompilerOptions,
} from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeTSConfigFieldsCompilerOptions = S.decodeEffect(TSConfig.fields.compilerOptions);
const encodeTSConfigFieldsCompilerOptions = S.encodeEffect(TSConfig.fields.compilerOptions);

const renderSchemaFailure = (exit: Exit.Exit<unknown, S.SchemaError>): string =>
  Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";
const TSConfigCompilerOptionsArbitrary = Arbitrary.map(Arbitrary.schema(TSConfigCompilerOptions), O.some);

describe("TSConfig schema", () => {
  describe("valid structures", () => {
    it("decodes a minimal tsconfig", () => {
      const result = decodeTSConfig({});

      expect(result).toBeInstanceOf(TSConfig);
      assertNone(result.compilerOptions);
      assertNone(result.extends);
      assertNone(result.references);
    });

    it.effect.prop(
      "round-trips schema-derived compiler options through the encoded wire shape",
      [TSConfigCompilerOptionsArbitrary],
      ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* encodeTSConfigFieldsCompilerOptions(value);
          const decoded = yield* decodeTSConfigFieldsCompilerOptions(encoded);

          expect(decoded).toEqual(value);

          return true;
        }),
      // The compiler-options arbitrary filters heavily; a larger discard budget keeps a
      // random seed from exhausting before 20 accepted samples.
      { arbitrary: { ...fcRuns(20), maxDiscards: fcRuns(20).runs * 100 } }
    );

    it("decodes references and collapses nullable fields to Option.none", () => {
      const result = decodeTSConfig({
        include: null,
        references: [{ path: "./packages/repo-utils" }],
        compilerOptions: {
          module: "NodeNext",
          outDir: null,
          types: null,
        },
        typeAcquisition: null,
        "ts-node": {
          compiler: null,
        },
      });

      assertNone(result.include);
      expect(result.references).toEqual(O.some([{ path: "./packages/repo-utils" }]));
      assertNone(result.typeAcquisition);
      result.compilerOptions.pipe(O.isSome, assertTrue);
      if (O.isSome(result.compilerOptions)) {
        assertSome(result.compilerOptions.value.module, "nodenext");
        assertNone(result.compilerOptions.value.outDir);
        assertNone(result.compilerOptions.value.types);
      }
      result["ts-node"].pipe(O.isSome, assertTrue);
      if (O.isSome(result["ts-node"])) {
        assertNone(result["ts-node"].value.compiler);
      }
    });

    it.effect(
      "decodes JSONC text with comments and trailing commas",
      Effect.fnUntraced(function* () {
        const result = yield* decodeTSConfigFromJsoncTextEffect(`{
          // shared base config
          "extends": "./tsconfig.base.json",
          "files": ["src/index.ts",],
          "compilerOptions": {
            "module": "NodeNext",
            "moduleResolution": "Bundler",
            "target": "ES2022",
            "allowImportingTsExtensions": true,
            "noEmit": true,
            "paths": {
              "@app/*": ["src/*"],
              "@generated/*": null,
            },
            "plugins": [
              {
                "name": "typescript-styled-plugin",
                "tags": ["styled", "css"],
              },
            ],
            "types": ["node", "vitest"],
            "jsx": "react-jsx",
            "rewriteRelativeImportExtensions": true,
            "verbatimModuleSyntax": true,
          },
          "watchOptions": {
            "watchFile": "UseFsEvents",
          },
          "buildOptions": {
            "verbose": true,
          },
          "typeAcquisition": {
            "enable": true,
            "include": ["vitest"],
          },
          "ts-node": {
            "compilerOptions": {
              "module": "NodeNext",
              "customFlag": { "mode": "safe" },
            },
            "transpiler": ["tsx", { "esm": true }],
            "moduleTypes": {
              "**/*.cts": "cjs",
            },
          },
        }`);

        expect(result).toBeInstanceOf(TSConfig);
        assertSome(result.extends, "./tsconfig.base.json");
        assertSome(result.files, ["src/index.ts"]);

        result.compilerOptions.pipe(O.isSome, assertTrue);
        if (O.isSome(result.compilerOptions)) {
          const compilerOptions = result.compilerOptions.value;

          assertSome(compilerOptions.module, "nodenext");
          assertSome(compilerOptions.moduleResolution, "bundler");
          assertSome(compilerOptions.target, "es2022");
          assertSome(compilerOptions.noEmit, true);
          assertSome(compilerOptions.paths, {
            "@app/*": ["src/*"],
            "@generated/*": null,
          });
          assertSome(compilerOptions.types, ["node", "vitest"]);
          assertSome(compilerOptions.jsx, "react-jsx");
          assertSome(compilerOptions.rewriteRelativeImportExtensions, true);
          assertSome(compilerOptions.verbatimModuleSyntax, true);
          compilerOptions.plugins.pipe(O.isSome, assertTrue);
          if (O.isSome(compilerOptions.plugins)) {
            const firstPlugin = compilerOptions.plugins.value[0] as {
              readonly name: string;
              readonly tags?: ReadonlyArray<string>;
            };
            expect(firstPlugin.name).toBe("typescript-styled-plugin");
            expect(firstPlugin.tags).toEqual(["styled", "css"]);
          }
        }

        result.watchOptions.pipe(O.isSome, assertTrue);
        if (O.isSome(result.watchOptions)) {
          assertSome(result.watchOptions.value.watchFile, "useFsEvents");
        }

        result.buildOptions.pipe(O.isSome, assertTrue);
        if (O.isSome(result.buildOptions)) {
          assertSome(result.buildOptions.value.verbose, true);
        }

        result.typeAcquisition.pipe(O.isSome, assertTrue);
        if (O.isSome(result.typeAcquisition)) {
          assertSome(result.typeAcquisition.value.enable, true);
          assertSome(result.typeAcquisition.value.include, ["vitest"]);
        }

        result["ts-node"].pipe(O.isSome, assertTrue);
        if (O.isSome(result["ts-node"])) {
          const tsNode = result["ts-node"].value;

          assertSome(tsNode.transpiler, ["tsx", { esm: true }]);
          assertSome(tsNode.moduleTypes, { "**/*.cts": "cjs" });
          tsNode.compilerOptions.pipe(O.isSome, assertTrue);
          if (O.isSome(tsNode.compilerOptions)) {
            const tsNodeCompilerOptions = tsNode.compilerOptions.value as {
              readonly module: O.Option<string>;
              readonly customFlag?: { readonly mode: string };
            };
            assertSome(tsNodeCompilerOptions.module, "nodenext");
            expect(tsNodeCompilerOptions.customFlag).toEqual({ mode: "safe" });
          }
        }
      })
    );

    it("allows open JSON-valued extras inside plugins and ts-node compilerOptions", () => {
      const result = decodeTSConfig({
        compilerOptions: {
          plugins: [
            {
              name: "typescript-styled-plugin",
              customSetting: {
                namespace: "styled",
              },
            },
          ],
        },
        "ts-node": {
          compilerOptions: {
            module: "NodeNext",
            customOption: {
              jsxRuntime: "automatic",
            },
          },
        },
      });

      result.compilerOptions.pipe(O.isSome, assertTrue);
      if (O.isSome(result.compilerOptions)) {
        result.compilerOptions.value.plugins.pipe(O.isSome, assertTrue);
      }
      if (O.isSome(result.compilerOptions) && O.isSome(result.compilerOptions.value.plugins)) {
        const firstPlugin = result.compilerOptions.value.plugins.value[0] as {
          readonly customSetting?: { readonly namespace: string };
        };
        expect(firstPlugin.customSetting).toEqual({ namespace: "styled" });
      }

      result["ts-node"].pipe(O.isSome, assertTrue);
      if (O.isSome(result["ts-node"])) {
        result["ts-node"].value.compilerOptions.pipe(O.isSome, assertTrue);
      }
      if (O.isSome(result["ts-node"]) && O.isSome(result["ts-node"].value.compilerOptions)) {
        const compilerOptions = result["ts-node"].value.compilerOptions.value as {
          readonly customOption?: { readonly jsxRuntime: string };
        };
        expect(compilerOptions.customOption).toEqual({
          jsxRuntime: "automatic",
        });
      }
    });

    it("decodes the TypeScript 7 target and library additions through ES2025", () => {
      const libraries = [
        "ES2016.Intl",
        "ES2023.Intl",
        "ES2025",
        "ES2025.Collection",
        "ES2025.Float16",
        "ES2025.Intl",
        "ES2025.Iterator",
        "ES2025.Promise",
        "ES2025.RegExp",
        "ESNext.Date",
        "ESNext.Float16",
        "ESNext.Temporal",
        "ESNext.TypedArrays",
      ];
      const result = decodeTSConfig({
        compilerOptions: {
          lib: libraries,
          target: "ES2025",
        },
      });
      const compilerOptions = O.getOrThrow(result.compilerOptions);

      assertSome(compilerOptions.target, "es2025");
      assertSome<unknown>(compilerOptions.lib, libraries);
    });
  });

  describe("validation", () => {
    it("rejects unexpected keys outside open sections", () => {
      const topLevel = decodeTSConfigExit({
        unexpected: true,
      });
      const nested = decodeTSConfigExit({
        compilerOptions: {
          unexpected: true,
        },
      });

      assertTrue(Exit.isFailure(topLevel));
      expect(renderSchemaFailure(topLevel)).toContain("Expected no excess property");
      expect(renderSchemaFailure(topLevel)).toContain('["unexpected"]');
      assertTrue(Exit.isFailure(nested));
      expect(renderSchemaFailure(nested)).toContain("Expected no excess property");
      expect(renderSchemaFailure(nested)).toContain('["compilerOptions"]["unexpected"]');
    });

    it.effect("rejects prototype-polluting keys at the strict record boundary", () =>
      Effect.gen(function* () {
        const parsed = yield* jsonParse('{"compilerOptions":{"paths":{"__proto__":["./src"],"@x":["./x"]}}}');
        const result = decodeTSConfigExit(parsed);
        assertTrue(Exit.isFailure(result));
        expect(renderSchemaFailure(result)).toContain('["__proto__"]');
      })
    );

    it("rejects duplicate uniqueItems arrays", () => {
      const exit = decodeTSConfigExit({
        files: ["src/index.ts", "src/index.ts"],
      });

      assertTrue(Exit.isFailure(exit));
      expect(renderSchemaFailure(exit)).toContain("Array items must be unique");
    });

    it("enforces allowImportingTsExtensions semantic requirements", () => {
      const exit = decodeTSConfigExit({
        compilerOptions: {
          allowImportingTsExtensions: true,
          moduleResolution: "NodeNext",
          noEmit: true,
        },
      });

      assertTrue(Exit.isFailure(exit));
      expect(renderSchemaFailure(exit)).toContain("allowImportingTsExtensions");
      expect(renderSchemaFailure(exit)).toContain("moduleResolution");
    });

    it("enforces reactNamespace to only be used with jsx=react", () => {
      const exit = decodeTSConfigExit({
        compilerOptions: {
          jsx: "react-jsx",
          reactNamespace: "React",
        },
      });

      assertTrue(Exit.isFailure(exit));
      expect(renderSchemaFailure(exit)).toContain("reactNamespace");
      expect(renderSchemaFailure(exit)).toContain("jsx");
    });

    it("enforces maxNodeModuleJsDepth to require allowJs", () => {
      const exit = decodeTSConfigExit({
        compilerOptions: {
          maxNodeModuleJsDepth: 2,
        },
      });

      assertTrue(Exit.isFailure(exit));
      expect(renderSchemaFailure(exit)).toContain("maxNodeModuleJsDepth");
      expect(renderSchemaFailure(exit)).toContain("allowJs");
    });

    it("rejects negative and fractional maxNodeModuleJsDepth values", () => {
      const negative = decodeTSConfigExit({
        compilerOptions: {
          allowJs: true,
          maxNodeModuleJsDepth: -1,
        },
      });
      const fractional = decodeTSConfigExit({
        compilerOptions: {
          allowJs: true,
          maxNodeModuleJsDepth: 1.5,
        },
      });

      assertTrue(Exit.isFailure(negative));
      expect(renderSchemaFailure(negative)).toContain("maxNodeModuleJsDepth");
      assertTrue(Exit.isFailure(fractional));
      expect(renderSchemaFailure(fractional)).toContain("maxNodeModuleJsDepth");
    });

    it("enforces ts-node experimentalReplAwait to require target >= ES2018", () => {
      const exit = decodeTSConfigExit({
        compilerOptions: {
          target: "ES2017",
        },
        "ts-node": {
          experimentalReplAwait: true,
        },
      });

      assertTrue(Exit.isFailure(exit));
      expect(renderSchemaFailure(exit)).toContain("experimentalReplAwait");
      expect(renderSchemaFailure(exit)).toContain("ES2018");
    });
  });

  describe("encoding", () => {
    it.effect(
      "encodes compact and pretty JSON output",
      Effect.fnUntraced(function* () {
        const input = {
          extends: "./tsconfig.base.json",
          include: ["src"],
          compilerOptions: {
            module: "NodeNext",
            target: "ES2022",
            noEmit: true,
          },
        };

        const encoded = yield* encodeTSConfigEffect(input);
        const compact = yield* encodeTSConfigToJsonEffect(input);
        const pretty = yield* encodeTSConfigPrettyEffect(input);
        const decodedCompact = yield* jsonParse(compact);

        expect(encoded).toEqual({
          extends: "./tsconfig.base.json",
          include: ["src"],
          compilerOptions: {
            module: "nodenext",
            target: "es2022",
            noEmit: true,
          },
        });
        expect(decodedCompact).toEqual(encoded);
        expect(pretty).toContain('\n  "compilerOptions"');
        expect(pretty).toContain('"module": "nodenext"');
      })
    );

    it.effect(
      "preserves open JSON extras inside plugin and ts-node compiler option sections",
      Effect.fnUntraced(function* () {
        const encoded = yield* encodeTSConfigEffect({
          compilerOptions: {
            plugins: [
              {
                name: "typescript-styled-plugin",
                customSetting: {
                  namespace: "styled",
                },
              },
            ],
          },
          "ts-node": {
            compilerOptions: {
              module: "NodeNext",
              customOption: {
                jsxRuntime: "automatic",
              },
            },
          },
        });

        expect(encoded).toEqual({
          compilerOptions: {
            plugins: [
              {
                name: "typescript-styled-plugin",
                customSetting: {
                  namespace: "styled",
                },
              },
            ],
          },
          "ts-node": {
            compilerOptions: {
              module: "nodenext",
              customOption: {
                jsxRuntime: "automatic",
              },
            },
          },
        });
      })
    );
  });
});
