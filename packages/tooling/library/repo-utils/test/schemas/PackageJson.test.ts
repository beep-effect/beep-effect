import {
  applyPackageJsonPatchEffect,
  decodePackageJson,
  decodePackageJsonExit,
  diffPackageJsonEffect,
  encodePackageJsonCanonicalPrettyEffect,
  getPackageJsonSchemaIssues,
  NpmPackageJson,
  normalizePackageJsonEffect,
  PackageJson,
  packageJsonJsonSchema,
} from "@beep/repo-utils";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { FastCheck as fc } from "effect/testing";

const objectKeys = (value: unknown): ReadonlyArray<string> => (P.isObject(value) ? Struct.keys(value) : A.empty());
const decodeJsonPointerSegment = (segment: string): string => segment.replaceAll("~1", "/").replaceAll("~0", "~");
const PackageJsonNameArbitrary = S.toArbitrary(PackageJson.fields.name);
const PackageJsonDependenciesArbitrary = S.toArbitrary(PackageJson.fields.dependencies);
const NpmPackageJsonPeerDependenciesMetaArbitrary = S.toArbitrary(NpmPackageJson.fields.peerDependenciesMeta);
// `PublishConfig`'s `exports` field is a recursive suspend()-based schema
// without a finite arbitrary generation path (pre-existing, unrelated to the
// `PublishConfigBase` field-literal conversion below); this arbitrary covers
// PublishConfigBase's non-recursive fields to exercise the StructWithRest
// composition round-trip.
const PublishConfigCoreArbitrary = S.toArbitrary(
  S.Struct({
    access: S.optionalKey(S.Literals(["public", "restricted"] as const)),
    tag: S.optionalKey(S.String),
    registry: S.optionalKey(S.String),
    provenance: S.optionalKey(S.Boolean),
  })
);

describe("PackageJson schema", () => {
  describe("valid structures", () => {
    it("derives repo package names from the production field schema arbitrary", () => {
      fc.assert(
        fc.property(PackageJsonNameArbitrary, (name) => {
          const decoded = decodePackageJson({ name });

          expect(S.is(PackageJson)(decoded)).toBe(true);
          expect(decoded.name).toBe(name);
        }),
        fcRuns(20)
      );
    });

    it("round-trips schema-derived package.json dependency maps through the encoded wire shape", () => {
      fc.assert(
        fc.property(PackageJsonDependenciesArbitrary.filter(O.isSome), (value) => {
          const encoded = S.encodeSync(PackageJson.fields.dependencies)(value);
          const decoded = S.decodeUnknownSync(PackageJson.fields.dependencies)(encoded);

          expect(decoded).toEqual(value);
        }),
        fcRuns(20)
      );
    });

    it("round-trips schema-derived npm peer dependency metadata through the encoded wire shape", () => {
      fc.assert(
        fc.property(NpmPackageJsonPeerDependenciesMetaArbitrary.filter(O.isSome), (value) => {
          const encoded = S.encodeSync(NpmPackageJson.fields.peerDependenciesMeta)(value);
          const decoded = S.decodeUnknownSync(NpmPackageJson.fields.peerDependenciesMeta)(encoded);

          expect(decoded).toEqual(value);
        }),
        fcRuns(20)
      );
    });

    it("round-trips schema-derived package.json publishConfig through the encoded wire shape", () => {
      fc.assert(
        fc.property(PublishConfigCoreArbitrary, (core) => {
          const value = O.some(core);
          const encoded = S.encodeSync(PackageJson.fields.publishConfig)(value);
          const decoded = S.decodeUnknownSync(PackageJson.fields.publishConfig)(encoded);

          expect(decoded).toEqual(value);
        }),
        { numRuns: 20 }
      );
    });

    it("decodes minimal package.json (name only)", () => {
      const result = decodePackageJson({ name: "my-package" });
      expect(result.name).toBe("my-package");
    });

    it("decodes a full npm-oriented package.json with typed fields", () => {
      const input = {
        name: "@beep/repo-utils",
        version: "1.0.0",
        description: "Monorepo utilities",
        keywords: ["monorepo", "effect"],
        license: "MIT",
        private: true,
        type: "module",
        main: "./dist/index.js",
        module: "./dist/index.mjs",
        types: "./dist/index.d.ts",
        browser: {
          "./src/server.ts": "./src/browser.ts",
          fs: false,
        },
        scripts: {
          build: "tsc -b",
          test: "vitest",
        },
        dependencies: {
          effect: "^4.0.0",
        },
        devDependencies: {
          "@types/node": "^20.0.0",
        },
        peerDependencies: {
          typescript: "^5.0.0",
        },
        peerDependenciesMeta: {
          typescript: {
            optional: true,
          },
        },
        optionalDependencies: {
          fsevents: "^2.3.0",
        },
        files: ["dist", "src"],
        engines: { node: ">=20" },
        os: ["darwin", "linux"],
        cpu: ["x64"],
        funding: [
          "https://github.com/sponsors/beep",
          { type: "github", url: "https://github.com/sponsors/beep-effect" },
        ],
        homepage: "https://github.com/example/repo",
        author: {
          name: "Beep Maintainer",
          email: "MAINTAINER@EXAMPLE.COM",
        },
        bugs: {
          email: "bugs@example.com",
        },
      };

      const result = decodePackageJson(input);
      expect(result.name).toBe("@beep/repo-utils");
      expect(result.author).toEqual(O.some({ name: "Beep Maintainer", email: "maintainer@example.com" }));
      expect(result.bugs).toEqual(O.some({ email: "bugs@example.com" }));
      expect(result.browser).toEqual(
        O.some({
          "./src/server.ts": "./src/browser.ts",
          fs: false,
        })
      );
      expect(result.peerDependenciesMeta).toEqual(
        O.some({
          typescript: {
            optional: true,
          },
        })
      );
      expect(result.funding).toEqual(
        O.some(["https://github.com/sponsors/beep", { type: "github", url: "https://github.com/sponsors/beep-effect" }])
      );
    });

    it("decodes package exports and publishConfig exports as structured data", () => {
      const input = {
        name: "pkg",
        exports: {
          "./package.json": "./package.json",
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
            require: "./dist/index.cjs",
          },
          "./internal/*": null,
          "./*": ["./dist/*.js", "./dist/*.cjs"],
        },
        publishConfig: {
          access: "public",
          provenance: true,
          bin: {
            "pkg-cli": "./dist/bin.js",
          },
          exports: {
            "./package.json": "./package.json",
            ".": "./dist/index.js",
            "./internal/*": null,
          },
        },
      };

      const result = decodePackageJson(input);
      expect(result.exports).toEqual(
        O.some({
          "./package.json": "./package.json",
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
            require: "./dist/index.cjs",
          },
          "./internal/*": null,
          "./*": ["./dist/*.js", "./dist/*.cjs"],
        })
      );
      expect(result.publishConfig).toEqual(
        O.some({
          access: "public",
          provenance: true,
          bin: {
            "pkg-cli": "./dist/bin.js",
          },
          exports: {
            "./package.json": "./package.json",
            ".": "./dist/index.js",
            "./internal/*": null,
          },
        })
      );
    });

    it("decodes imports mappings", () => {
      const result = decodePackageJson({
        name: "pkg",
        imports: {
          "#internal": "./src/internal.ts",
          "#runtime/*": {
            types: "./src/runtime/*.d.ts",
            default: "./src/runtime/*.ts",
          },
        },
      });

      expect(result.imports).toEqual(
        O.some({
          "#internal": "./src/internal.ts",
          "#runtime/*": {
            types: "./src/runtime/*.d.ts",
            default: "./src/runtime/*.ts",
          },
        })
      );
    });

    it("decodes workspaces as an array", () => {
      const result = decodePackageJson({
        name: "pkg",
        workspaces: ["packages/*", "packages/tooling/*/*"],
      });

      expect(result.workspaces).toEqual(O.some(["packages/*", "packages/tooling/*/*"]));
    });

    it("decodes workspaces as an object", () => {
      const result = decodePackageJson({
        name: "pkg",
        workspaces: {
          packages: ["packages/*"],
          nohoist: ["react"],
        },
      });

      expect(result.workspaces).toEqual(
        O.some({
          packages: ["packages/*"],
          nohoist: ["react"],
        })
      );
    });

    it("decodes sideEffects as a boolean or array", () => {
      const booleanResult = decodePackageJson({
        name: "pkg",
        sideEffects: false,
      });
      const arrayResult = decodePackageJson({
        name: "pkg",
        sideEffects: ["**/*.css"],
      });

      expect(booleanResult.sideEffects).toEqual(O.some(false));
      expect(arrayResult.sideEffects).toEqual(O.some(["**/*.css"]));
    });

    it("decodes repo-local top-level fields", () => {
      const result = decodePackageJson({
        name: "@beep/root",
        private: true,
        packageManager: "bun@1.3.10",
        repository: {
          type: "git",
          url: "git@github.com:beep-effect/beep-effect.git",
          directory: ".",
        },
        workspaces: ["packages/foundation/*/*", "packages/tooling/library/repo-utils"],
        catalog: {
          effect: "^4.0.0-beta.27",
          typescript: "^5.9.3",
        },
        "resolutions#": {
          "@beep/*": "Needed to force PNPM to install local packages",
        },
      });

      expect(result.packageManager).toEqual(O.some("bun@1.3.10"));
      expect(result.catalog).toEqual(
        O.some({
          effect: "^4.0.0-beta.27",
          typescript: "^5.9.3",
        })
      );
      expect(result["resolutions#"]).toEqual(
        O.some({
          "@beep/*": "Needed to force PNPM to install local packages",
        })
      );
    });

    it("decodes repo-local mixed-case workspace package names", () => {
      const result = decodePackageJson({
        name: "@beep/MixedCase",
        dependencies: {
          "@beep/mixed-case-helper": "workspace:^",
        },
      });

      expect(result.name).toBe("@beep/MixedCase");
      expect(result.dependencies).toEqual(
        O.some({
          "@beep/mixed-case-helper": "workspace:^",
        })
      );
    });

    it("decodes Bun trusted dependencies", () => {
      const result = decodePackageJson({
        name: "@beep/infra",
        trustedDependencies: ["@pulumi/ghaRunners"],
      });

      expect(result.trustedDependencies).toEqual(O.some(["@pulumi/ghaRunners"]));
    });

    it("decodes Sherif configuration", () => {
      const result = decodePackageJson({
        name: "@beep/root",
        sherif: { ignorePackage: ["infra/ci-runners/sdks/**"] },
      });

      expect(result.sherif).toEqual(O.some({ ignorePackage: ["infra/ci-runners/sdks/**"] }));
    });

    it("decodes repo-local beep package metadata", () => {
      const driverResult = decodePackageJson({
        name: "@beep/drizzle",
        beep: {
          family: "drivers",
        },
      });

      const foundationResult = decodePackageJson({
        name: "@beep/schema",
        beep: {
          family: "foundation",
          kind: "modeling",
        },
      });

      const toolingResult = decodePackageJson({
        name: "@beep/repo-utils",
        beep: {
          family: "tooling",
          kind: "library",
        },
      });

      expect(driverResult.beep).toEqual(O.some({ family: "drivers" }));
      expect(foundationResult.beep).toEqual(O.some({ family: "foundation", kind: "modeling" }));
      expect(toolingResult.beep).toEqual(O.some({ family: "tooling", kind: "library" }));
    });

    it("keeps npm-only schema separate from repo-only extensions", () => {
      const decodeNpmPackageJson = S.decodeUnknownExit(NpmPackageJson);
      const exit = decodeNpmPackageJson(
        {
          name: "pkg",
          catalog: {
            effect: "^4.0.0",
          },
        },
        { onExcessProperty: "error" }
      );

      expect(Exit.isFailure(exit)).toBe(true);

      const beepExit = decodeNpmPackageJson(
        {
          name: "pkg",
          beep: {
            family: "drivers",
          },
        },
        { onExcessProperty: "error" }
      );

      expect(Exit.isFailure(beepExit)).toBe(true);
    });
  });

  describe("malformed structures", () => {
    it("rejects missing name field", () => {
      expect(Exit.isFailure(decodePackageJsonExit({ version: "1.0.0" }))).toBe(true);
    });

    it("rejects empty string names", () => {
      expect(Exit.isFailure(decodePackageJsonExit({ name: "" }))).toBe(true);
    });

    it("rejects invalid package names", () => {
      expect(Exit.isFailure(decodePackageJsonExit({ name: "Invalid Name" }))).toBe(true);
    });

    it("rejects invalid package type values", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            type: "esm",
          })
        )
      ).toBe(true);
    });

    it("rejects repository objects without required type", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            repository: {
              url: "git@github.com:user/repo.git",
            },
          })
        )
      ).toBe(true);
    });

    it("rejects funding objects without a url", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            funding: {
              type: "github",
            },
          })
        )
      ).toBe(true);
    });

    it("rejects exports objects with invalid keys", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            exports: {
              "1invalid": "./dist/index.js",
            },
          })
        )
      ).toBe(true);
    });

    it("rejects imports objects with invalid keys", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            imports: {
              internal: "./src/internal.ts",
            },
          })
        )
      ).toBe(true);
    });

    it("rejects workspaces as a string", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            workspaces: "packages/*",
          })
        )
      ).toBe(true);
    });

    it("rejects unexpected top-level keys", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            unexpected: true,
          })
        )
      ).toBe(true);
    });

    it("rejects private as a string", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            private: "true",
          })
        )
      ).toBe(true);
    });

    it("rejects dependency records with invalid keys or empty values", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            dependencies: {
              "Invalid Name": "catalog:",
            },
          })
        )
      ).toBe(true);

      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            dependencies: {
              effect: "",
            },
          })
        )
      ).toBe(true);
    });

    it("rejects invalid repo-local beep package metadata", () => {
      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            beep: {
              family: "shared",
            },
          })
        )
      ).toBe(true);

      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            beep: {
              family: "drivers",
              kind: "modeling",
            },
          })
        )
      ).toBe(true);

      expect(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            beep: {
              family: "foundation",
            },
          })
        )
      ).toBe(true);
    });

    it("rejects non-object input", () => {
      expect(Exit.isFailure(decodePackageJsonExit("not-an-object"))).toBe(true);
      expect(Exit.isFailure(decodePackageJsonExit(42))).toBe(true);
      expect(Exit.isFailure(decodePackageJsonExit(null))).toBe(true);
      expect(Exit.isFailure(decodePackageJsonExit(undefined))).toBe(true);
      expect(Exit.isFailure(decodePackageJsonExit([]))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty arrays for list fields", () => {
      const result = decodePackageJson({
        name: "pkg",
        keywords: [],
        files: [],
        workspaces: [],
      });

      expect(result.keywords).toEqual(O.some([]));
      expect(result.files).toEqual(O.some([]));
      expect(result.workspaces).toEqual(O.some([]));
    });

    it("handles scoped package names", () => {
      const result = decodePackageJson({ name: "@scope/package-name" });
      expect(result.name).toBe("@scope/package-name");
    });

    it("keeps npm package names strict even when repo package names allow mixed case", () => {
      const decodeNpmPackageJson = S.decodeUnknownExit(NpmPackageJson);
      const exit = decodeNpmPackageJson(
        {
          name: "@beep/MixedCase",
          dependencies: {
            "@beep/mixed-case-helper": "workspace:^",
          },
        },
        { onExcessProperty: "error" }
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("decodes a real-world workspace package shape from this repo", () => {
      const result = decodePackageJson({
        name: "@beep/repo-utils",
        version: "0.0.0",
        type: "module",
        private: true,
        license: "MIT",
        description: "Effect-based monorepo utilities",
        homepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/tooling/library/repo-utils",
        repository: {
          type: "git",
          url: "git@github.com:beep-effect/beep-effect.git",
          directory: "packages/tooling/library/repo-utils",
        },
        sideEffects: [],
        exports: {
          "./package.json": "./package.json",
          ".": "./src/index.ts",
          "./*": "./src/*.ts",
          "./internal/*": null,
        },
        publishConfig: {
          access: "public",
          provenance: true,
          exports: {
            "./package.json": "./package.json",
            ".": "./dist/index.js",
            "./*": "./dist/*.js",
            "./internal/*": null,
          },
        },
        files: ["src/**/*.ts", "dist/**/*.js"],
        scripts: {
          build: "tsc -b tsconfig.json",
          test: "vitest",
        },
        dependencies: {
          effect: "catalog:",
          "@effect/platform-node": "catalog:",
          glob: "catalog:",
        },
        devDependencies: {
          "@types/node": "catalog:",
          "@effect/vitest": "catalog:",
        },
      });

      expect(result.repository).toEqual(
        O.some({
          type: "git",
          url: "git@github.com:beep-effect/beep-effect.git",
          directory: "packages/tooling/library/repo-utils",
        })
      );
    });

    it("decodePackageJson throws on invalid input", () => {
      expect(() => decodePackageJson({})).toThrow();
    });
  });

  describe("type inference", () => {
    it("schema Type is correctly shaped", () => {
      const encoded: PackageJson.Encoded = {
        name: "test",
        version: "1.0.0",
        dependencies: { effect: "^4.0.0" },
      };
      const check: PackageJson.Type = decodePackageJson(encoded);

      expect(check.name).toBe("test");
    });
  });

  describe("canonical helpers", () => {
    it.effect(
      "normalizes top-level ordering and nested map ordering",
      Effect.fn(function* () {
        const normalized = yield* normalizePackageJsonEffect({
          private: true,
          name: "pkg",
          scripts: {
            test: "vitest",
            build: "tsc -b",
          },
          exports: {
            "./z": "./z.js",
            ".": "./index.js",
            "./a": "./a.js",
          },
          dependencies: {
            zod: "catalog:",
            effect: "catalog:",
          },
          catalog: {
            zod: "^4.3.6",
            effect: "^4.0.0-beta.28",
          },
        });

        expect(Struct.keys(normalized)).toEqual(["name", "private", "scripts", "exports", "dependencies", "catalog"]);
        expect(Struct.keys(normalized.scripts ?? {})).toEqual(["build", "test"]);
        expect(objectKeys(normalized.exports)).toEqual([".", "./a", "./z"]);
        expect(Struct.keys(normalized.dependencies ?? {})).toEqual(["effect", "zod"]);
        expect(Struct.keys(normalized.catalog ?? {})).toEqual(["effect", "zod"]);
      })
    );

    it.effect(
      "encodes canonical pretty JSON",
      Effect.fn(function* () {
        const json = yield* encodePackageJsonCanonicalPrettyEffect({
          private: true,
          name: "pkg",
          scripts: {
            test: "vitest",
            build: "tsc -b",
          },
          exports: {
            "./z": "./z.js",
            ".": "./index.js",
            "./a": "./a.js",
          },
          dependencies: {
            zod: "catalog:",
            effect: "catalog:",
          },
          catalog: {
            zod: "^4.3.6",
            effect: "^4.0.0-beta.28",
          },
        });

        expect(json).toBe(`{
  "name": "pkg",
  "private": true,
  "scripts": {
    "build": "tsc -b",
    "test": "vitest"
  },
  "exports": {
    ".": "./index.js",
    "./a": "./a.js",
    "./z": "./z.js"
  },
  "dependencies": {
    "effect": "catalog:",
    "zod": "catalog:"
  },
  "catalog": {
    "effect": "^4.0.0-beta.28",
    "zod": "^4.3.6"
  }
}`);
      })
    );

    it.effect(
      "preserves repo-local beep metadata in canonical output",
      Effect.fn(function* () {
        const json = yield* encodePackageJsonCanonicalPrettyEffect({
          name: "@beep/schema",
          repository: {
            type: "git",
            url: "git@github.com:beep-effect/beep-effect.git",
            directory: "packages/foundation/modeling/schema",
          },
          beep: {
            family: "foundation",
            kind: "modeling",
          },
        });

        expect(json).toBe(`{
  "name": "@beep/schema",
  "repository": {
    "type": "git",
    "url": "git@github.com:beep-effect/beep-effect.git",
    "directory": "packages/foundation/modeling/schema"
  },
  "beep": {
    "family": "foundation",
    "kind": "modeling"
  }
}`);
      })
    );

    it.effect(
      "diffs and applies typed JSON Patch with escaped scoped dependency keys",
      Effect.fn(function* () {
        const patch = yield* diffPackageJsonEffect(
          {
            name: "pkg",
            dependencies: {
              "@beep/schema": "workspace:^",
            },
          },
          {
            name: "pkg",
            dependencies: {
              "@beep/schema": "catalog:",
            },
            private: true,
          }
        );

        expect(patch).toEqual([
          { op: "replace", path: "/dependencies/@beep~1schema", value: "catalog:" },
          { op: "add", path: "/private", value: true },
        ]);

        const patched = yield* applyPackageJsonPatchEffect(
          {
            name: "pkg",
            dependencies: {
              "@beep/schema": "workspace:^",
            },
          },
          patch
        );

        expect(patched.dependencies).toEqual(
          O.some({
            "@beep/schema": "catalog:",
          })
        );
        expect(patched.private).toEqual(O.some(true));
      })
    );
  });

  describe("artifacts and diagnostics", () => {
    it("exports a JSON Schema document with strict object definitions", () => {
      const packageJsonSchema = packageJsonJsonSchema.schema;
      expect(packageJsonSchema).toHaveProperty("$ref");
      if (!("$ref" in packageJsonSchema) || typeof packageJsonSchema.$ref !== "string") {
        throw new Error("expected PackageJson JSON schema document root to be a $ref");
      }

      const packageJsonDefinitionName = decodeJsonPointerSegment(packageJsonSchema.$ref.slice("#/$defs/".length));
      const packageJsonDefinition = packageJsonJsonSchema.definitions[packageJsonDefinitionName];

      expect(packageJsonSchema.$ref).toMatch(/^#\/\$defs\/.+PackageJsonEncoded$/);
      expect(packageJsonDefinition?.additionalProperties).toBe(false);
    });

    it.effect(
      "formats SchemaError issues with JSON Pointers",
      Effect.fn("PackageJson.test.formatSchemaIssues")(function* () {
        const issues = yield* S.decodeUnknownEffect(PackageJson)(
          {
            name: "",
            private: "true",
            unexpected: true,
          },
          { onExcessProperty: "error", errors: "all" }
        ).pipe(Effect.flip, Effect.map(getPackageJsonSchemaIssues));

        expect(
          pipe(
            issues,
            A.map((issue) => issue.pointer),
            A.dedupe,
            A.sort(Order.String)
          )
        ).toEqual(["/name", "/private", "/unexpected"]);
      })
    );

    it.effect(
      "formats invalid package map keys with field-specific JSON Pointers",
      Effect.fn("PackageJson.test.formatMapKeyIssues")(function* () {
        const cases = [
          {
            input: {
              name: "pkg",
              dependencies: {
                "Invalid Name": "catalog:",
              },
            },
            pointer: "/dependencies/Invalid Name",
            message: "Dependency names must be valid repo package names",
          },
          {
            input: {
              name: "pkg",
              exports: {
                "1invalid": "./dist/index.js",
              },
            },
            pointer: "/exports/1invalid",
            message: "Package exports subpath keys must be . or start with ./",
          },
          {
            input: {
              name: "pkg",
              imports: {
                internal: "./src/internal.ts",
              },
            },
            pointer: "/imports/internal",
            message: "Package imports keys must start with #",
          },
        ] as const;

        for (const testCase of cases) {
          const issues = yield* S.decodeUnknownEffect(PackageJson)(testCase.input, {
            onExcessProperty: "error",
            errors: "all",
          }).pipe(Effect.flip, Effect.map(getPackageJsonSchemaIssues));

          expect(issues).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                pointer: testCase.pointer,
                message: expect.stringContaining(testCase.message),
              }),
            ])
          );
        }
      })
    );
  });
});
