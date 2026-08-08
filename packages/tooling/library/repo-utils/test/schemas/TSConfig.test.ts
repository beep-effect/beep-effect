import {
  decodeTSConfig,
  decodeTSConfigExit,
  decodeTSConfigFromJsoncTextEffect,
  encodeTSConfigEffect,
  encodeTSConfigPrettyEffect,
  encodeTSConfigToJsonEffect,
  jsonParse,
  TSConfig,
} from "@beep/repo-utils";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const renderSchemaFailure = (exit: Exit.Exit<unknown, S.SchemaError>): string =>
  Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";
const TSConfigCompilerOptionsArbitrary = S.toArbitrary(TSConfig.fields.compilerOptions);

describe("TSConfig schema", () => {
  describe("valid structures", () => {
    it("decodes a minimal tsconfig", () => {
      const result = decodeTSConfig({});

      expect(result).toBeInstanceOf(TSConfig);
      expect(result.compilerOptions).toEqual(O.none());
      expect(result.extends).toEqual(O.none());
      expect(result.references).toEqual(O.none());
    });

    it("round-trips schema-derived compiler options through the encoded wire shape", () => {
      fc.assert(
        fc.property(TSConfigCompilerOptionsArbitrary.filter(O.isSome), (value) => {
          const encoded = S.encodeSync(TSConfig.fields.compilerOptions)(value);
          const decoded = S.decodeSync(TSConfig.fields.compilerOptions)(encoded);

          expect(decoded).toEqual(value);
        }),
        fcRuns(20)
      );
    });

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

      expect(result.include).toEqual(O.none());
      expect(result.references).toEqual(O.some([{ path: "./packages/repo-utils" }]));
      expect(result.typeAcquisition).toEqual(O.none());
      expect(O.isSome(result.compilerOptions)).toBe(true);
      if (O.isSome(result.compilerOptions)) {
        expect(result.compilerOptions.value.module).toEqual(O.some("nodenext"));
        expect(result.compilerOptions.value.outDir).toEqual(O.none());
        expect(result.compilerOptions.value.types).toEqual(O.none());
      }
      expect(O.isSome(result["ts-node"])).toBe(true);
      if (O.isSome(result["ts-node"])) {
        expect(result["ts-node"].value.compiler).toEqual(O.none());
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
        expect(result.extends).toEqual(O.some("./tsconfig.base.json"));
        expect(result.files).toEqual(O.some(["src/index.ts"]));

        expect(O.isSome(result.compilerOptions)).toBe(true);
        if (O.isSome(result.compilerOptions)) {
          const compilerOptions = result.compilerOptions.value;

          expect(compilerOptions.module).toEqual(O.some("nodenext"));
          expect(compilerOptions.moduleResolution).toEqual(O.some("bundler"));
          expect(compilerOptions.target).toEqual(O.some("es2022"));
          expect(compilerOptions.noEmit).toEqual(O.some(true));
          expect(compilerOptions.paths).toEqual(
            O.some({
              "@app/*": ["src/*"],
              "@generated/*": null,
            })
          );
          expect(compilerOptions.types).toEqual(O.some(["node", "vitest"]));
          expect(compilerOptions.jsx).toEqual(O.some("react-jsx"));
          expect(compilerOptions.rewriteRelativeImportExtensions).toEqual(O.some(true));
          expect(compilerOptions.verbatimModuleSyntax).toEqual(O.some(true));
          expect(O.isSome(compilerOptions.plugins)).toBe(true);
          if (O.isSome(compilerOptions.plugins)) {
            const firstPlugin = compilerOptions.plugins.value[0] as {
              readonly name: string;
              readonly tags?: ReadonlyArray<string>;
            };
            expect(firstPlugin.name).toBe("typescript-styled-plugin");
            expect(firstPlugin.tags).toEqual(["styled", "css"]);
          }
        }

        expect(O.isSome(result.watchOptions)).toBe(true);
        if (O.isSome(result.watchOptions)) {
          expect(result.watchOptions.value.watchFile).toEqual(O.some("useFsEvents"));
        }

        expect(O.isSome(result.buildOptions)).toBe(true);
        if (O.isSome(result.buildOptions)) {
          expect(result.buildOptions.value.verbose).toEqual(O.some(true));
        }

        expect(O.isSome(result.typeAcquisition)).toBe(true);
        if (O.isSome(result.typeAcquisition)) {
          expect(result.typeAcquisition.value.enable).toEqual(O.some(true));
          expect(result.typeAcquisition.value.include).toEqual(O.some(["vitest"]));
        }

        expect(O.isSome(result["ts-node"])).toBe(true);
        if (O.isSome(result["ts-node"])) {
          const tsNode = result["ts-node"].value;

          expect(tsNode.transpiler).toEqual(O.some(["tsx", { esm: true }]));
          expect(tsNode.moduleTypes).toEqual(O.some({ "**/*.cts": "cjs" }));
          expect(O.isSome(tsNode.compilerOptions)).toBe(true);
          if (O.isSome(tsNode.compilerOptions)) {
            const tsNodeCompilerOptions = tsNode.compilerOptions.value as {
              readonly module: O.Option<string>;
              readonly customFlag?: { readonly mode: string };
            };
            expect(tsNodeCompilerOptions.module).toEqual(O.some("nodenext"));
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

      expect(O.isSome(result.compilerOptions)).toBe(true);
      if (O.isSome(result.compilerOptions) && O.isSome(result.compilerOptions.value.plugins)) {
        const firstPlugin = result.compilerOptions.value.plugins.value[0] as {
          readonly customSetting?: { readonly namespace: string };
        };
        expect(firstPlugin.customSetting).toEqual({ namespace: "styled" });
      }

      expect(O.isSome(result["ts-node"])).toBe(true);
      if (O.isSome(result["ts-node"]) && O.isSome(result["ts-node"].value.compilerOptions)) {
        const compilerOptions = result["ts-node"].value.compilerOptions.value as {
          readonly customOption?: { readonly jsxRuntime: string };
        };
        expect(compilerOptions.customOption).toEqual({
          jsxRuntime: "automatic",
        });
      }
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

      expect(Exit.isFailure(topLevel)).toBe(true);
      expect(renderSchemaFailure(topLevel)).toContain("Expected no excess property");
      expect(renderSchemaFailure(topLevel)).toContain('["unexpected"]');
      expect(Exit.isFailure(nested)).toBe(true);
      expect(renderSchemaFailure(nested)).toContain("Expected no excess property");
      expect(renderSchemaFailure(nested)).toContain('["compilerOptions"]["unexpected"]');
    });

    it("drops prototype-polluting keys instead of carrying them into the model", () => {
      // JSON parsing creates `__proto__` as an own data property, but effect's
      // record decode cannot carry it, so it never reaches the Type domain.
      // The TSConfigJsonKey check mirrors that boundary on the Type side so
      // schema-derived arbitraries only generate round-trippable records.
      const parsed = Effect.runSync(jsonParse('{"compilerOptions":{"paths":{"__proto__":["./src"],"@x":["./x"]}}}'));
      const result = decodeTSConfig(parsed);

      const paths = O.getOrThrow(result.compilerOptions).paths;
      expect(O.map(paths, R.keys)).toEqual(O.some(["@x"]));
    });

    it("rejects duplicate uniqueItems arrays", () => {
      const exit = decodeTSConfigExit({
        files: ["src/index.ts", "src/index.ts"],
      });

      expect(Exit.isFailure(exit)).toBe(true);
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

      expect(Exit.isFailure(exit)).toBe(true);
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

      expect(Exit.isFailure(exit)).toBe(true);
      expect(renderSchemaFailure(exit)).toContain("reactNamespace");
      expect(renderSchemaFailure(exit)).toContain("jsx");
    });

    it("enforces maxNodeModuleJsDepth to require allowJs", () => {
      const exit = decodeTSConfigExit({
        compilerOptions: {
          maxNodeModuleJsDepth: 2,
        },
      });

      expect(Exit.isFailure(exit)).toBe(true);
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

      expect(Exit.isFailure(negative)).toBe(true);
      expect(renderSchemaFailure(negative)).toContain("maxNodeModuleJsDepth");
      expect(Exit.isFailure(fractional)).toBe(true);
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

      expect(Exit.isFailure(exit)).toBe(true);
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
