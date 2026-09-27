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
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, Order, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";

const decodePackageJson2 = S.decodeEffect(PackageJson);
const decodeNpmPackageJsonFieldsPeerDependenciesMeta = S.decodeEffect(NpmPackageJson.fields.peerDependenciesMeta);
const decodePackageJsonFieldsDependencies = S.decodeEffect(PackageJson.fields.dependencies);
const decodePackageJsonFieldsPublishConfig = S.decodeEffect(PackageJson.fields.publishConfig);
const decodeUnknownPackageJson = S.decodeUnknownEffect(PackageJson);
const decodeUnknownNpmPackageJsonExit = S.decodeUnknownExit(NpmPackageJson);
const encodeNpmPackageJsonFieldsPeerDependenciesMeta = S.encodeEffect(NpmPackageJson.fields.peerDependenciesMeta);
const encodePackageJsonFieldsDependencies = S.encodeEffect(PackageJson.fields.dependencies);
const encodePackageJsonFieldsPublishConfig = S.encodeEffect(PackageJson.fields.publishConfig);
const isPackageJson = S.is(PackageJson);

const objectKeys = (value: unknown): ReadonlyArray<string> => (P.isObject(value) ? Struct.keys(value) : A.empty());
const decodeJsonPointerSegment = (segment: string): string => segment.replaceAll("~1", "/").replaceAll("~0", "~");
const PackageJsonNameArbitrary = Arbitrary.schema(PackageJson.fields.name);
const PackageJsonDependenciesArbitrary = Arbitrary.schema(PackageJson.fields.dependencies);
const NpmPackageJsonPeerDependenciesMetaArbitrary = Arbitrary.schema(NpmPackageJson.fields.peerDependenciesMeta);
// `PublishConfig`'s `exports` field is a recursive suspend()-based schema
// without a finite arbitrary generation path (pre-existing, unrelated to the
// `PublishConfigBase` field-literal conversion below); this arbitrary covers
// PublishConfigBase's non-recursive fields to exercise the StructWithRest
// composition round-trip.
const PublishConfigCoreArbitrary = Arbitrary.schema(
  S.Struct({
    access: S.optionalKey(S.Literals(["public", "restricted"] as const)),
    tag: S.optionalKey(S.String),
    registry: S.optionalKey(S.String),
    provenance: S.optionalKey(S.Boolean),
  })
);

describe("PackageJson schema", () => {
  describe("valid structures", () => {
    it.prop(
      "derives repo package names from the production field schema arbitrary",
      [PackageJsonNameArbitrary],
      ([name]) => {
        const decoded = decodePackageJson({ name });

        expect(isPackageJson(decoded)).toBe(true);
        expect(decoded.name).toBe(name);

        return true;
      },
      { arbitrary: fcRuns(20) }
    );

    it.effect.prop(
      "round-trips schema-derived package.json dependency maps through the encoded wire shape",
      [Arbitrary.filter(PackageJsonDependenciesArbitrary, O.isSome)],
      ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* encodePackageJsonFieldsDependencies(value);
          const decoded = yield* decodePackageJsonFieldsDependencies(encoded);

          expect(decoded).toEqual(value);

          return true;
        }),
      { arbitrary: fcRuns(20) }
    );

    it.effect.prop(
      "round-trips schema-derived npm peer dependency metadata through the encoded wire shape",
      [Arbitrary.filter(NpmPackageJsonPeerDependenciesMetaArbitrary, O.isSome)],
      ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* encodeNpmPackageJsonFieldsPeerDependenciesMeta(value);
          const decoded = yield* decodeNpmPackageJsonFieldsPeerDependenciesMeta(encoded);

          expect(decoded).toEqual(value);

          return true;
        }),
      { arbitrary: fcRuns(20) }
    );

    it.effect.prop(
      "round-trips schema-derived package.json publishConfig through the encoded wire shape",
      [PublishConfigCoreArbitrary],
      ([core]) =>
        Effect.gen(function* () {
          const value = O.some(core);
          const encoded = yield* encodePackageJsonFieldsPublishConfig(value);
          const decoded = yield* decodePackageJsonFieldsPublishConfig(encoded);

          expect(decoded).toEqual(value);

          return true;
        }),
      { arbitrary: fcRuns(20) }
    );

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
      assertSome(result.browser, {
        "./src/server.ts": "./src/browser.ts",
        fs: false,
      });
      assertSome(result.peerDependenciesMeta, {
        typescript: {
          optional: true,
        },
      });
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
      assertSome(result.exports, {
        "./package.json": "./package.json",
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
          require: "./dist/index.cjs",
        },
        "./internal/*": null,
        "./*": ["./dist/*.js", "./dist/*.cjs"],
      });
      assertSome(result.publishConfig, {
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
      });
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

      assertSome(result.imports, {
        "#internal": "./src/internal.ts",
        "#runtime/*": {
          types: "./src/runtime/*.d.ts",
          default: "./src/runtime/*.ts",
        },
      });
    });

    it("decodes workspaces as an array", () => {
      const result = decodePackageJson({
        name: "pkg",
        workspaces: ["packages/*", "packages/tooling/*/*"],
      });

      assertSome(result.workspaces, ["packages/*", "packages/tooling/*/*"]);
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

      assertSome(booleanResult.sideEffects, false);
      assertSome(arrayResult.sideEffects, ["**/*.css"]);
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

      assertSome(result.packageManager, "bun@1.3.10");
      assertSome(result.catalog, {
        effect: "^4.0.0-beta.27",
        typescript: "^5.9.3",
      });
      assertSome(result["resolutions#"], {
        "@beep/*": "Needed to force PNPM to install local packages",
      });
    });

    it("decodes repo-local mixed-case workspace package names", () => {
      const result = decodePackageJson({
        name: "@beep/MixedCase",
        dependencies: {
          "@beep/mixed-case-helper": "workspace:^",
        },
      });

      expect(result.name).toBe("@beep/MixedCase");
      assertSome(result.dependencies, {
        "@beep/mixed-case-helper": "workspace:^",
      });
    });

    it("decodes Bun trusted dependencies", () => {
      const result = decodePackageJson({
        name: "@beep/infra",
        trustedDependencies: ["@pulumi/ghaRunners"],
      });

      assertSome(result.trustedDependencies, ["@pulumi/ghaRunners"]);
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

      const ecosystemResult = decodePackageJson({
        name: "@beep/effect-drizzle",
        beep: {
          family: "ecosystem",
        },
      });

      expect(driverResult.beep).toEqual(O.some({ family: "drivers" }));
      expect(foundationResult.beep).toEqual(O.some({ family: "foundation", kind: "modeling" }));
      expect(toolingResult.beep).toEqual(O.some({ family: "tooling", kind: "library" }));
      expect(ecosystemResult.beep).toEqual(O.some({ family: "ecosystem" }));
    });

    it("keeps npm-only schema separate from repo-only extensions", () => {
      const exit = decodeUnknownNpmPackageJsonExit(
        {
          name: "pkg",
          catalog: {
            effect: "^4.0.0",
          },
        },
        { onExcessProperty: "error" }
      );

      assertTrue(Exit.isFailure(exit));

      const beepExit = decodeUnknownNpmPackageJsonExit(
        {
          name: "pkg",
          beep: {
            family: "drivers",
          },
        },
        { onExcessProperty: "error" }
      );

      assertTrue(Exit.isFailure(beepExit));
    });
  });

  describe("malformed structures", () => {
    it("rejects missing name field", () => {
      assertTrue(Exit.isFailure(decodePackageJsonExit({ version: "1.0.0" })));
    });

    it("rejects empty string names", () => {
      assertTrue(Exit.isFailure(decodePackageJsonExit({ name: "" })));
    });

    it("rejects invalid package names", () => {
      assertTrue(Exit.isFailure(decodePackageJsonExit({ name: "Invalid Name" })));
    });

    it("rejects invalid package type values", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            type: "esm",
          })
        )
      );
    });

    it("rejects repository objects without required type", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            repository: {
              url: "git@github.com:user/repo.git",
            },
          })
        )
      );
    });

    it("rejects funding objects without a url", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            funding: {
              type: "github",
            },
          })
        )
      );
    });

    it("rejects exports objects with invalid keys", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            exports: {
              "1invalid": "./dist/index.js",
            },
          })
        )
      );
    });

    it("rejects imports objects with invalid keys", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            imports: {
              internal: "./src/internal.ts",
            },
          })
        )
      );
    });

    it("rejects workspaces as a string", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            workspaces: "packages/*",
          })
        )
      );
    });

    it("rejects unexpected top-level keys", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            unexpected: true,
          })
        )
      );
    });

    it("rejects private as a string", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            private: "true",
          })
        )
      );
    });

    it("rejects dependency records with invalid keys or empty values", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            dependencies: {
              "Invalid Name": "catalog:",
            },
          })
        )
      );

      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            beep: {
              family: "ecosystem",
              kind: "modeling",
            },
          })
        )
      );

      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            dependencies: {
              effect: "",
            },
          })
        )
      );
    });

    it("rejects invalid repo-local beep package metadata", () => {
      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            beep: {
              family: "shared",
            },
          })
        )
      );

      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            beep: {
              family: "drivers",
              kind: "modeling",
            },
          })
        )
      );

      assertTrue(
        Exit.isFailure(
          decodePackageJsonExit({
            name: "pkg",
            beep: {
              family: "foundation",
            },
          })
        )
      );
    });

    it("rejects non-object input", () => {
      assertTrue(Exit.isFailure(decodePackageJsonExit("not-an-object")));
      assertTrue(Exit.isFailure(decodePackageJsonExit(42)));
      assertTrue(Exit.isFailure(decodePackageJsonExit(null)));
      assertTrue(Exit.isFailure(decodePackageJsonExit(undefined)));
      assertTrue(Exit.isFailure(decodePackageJsonExit([])));
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

      assertSome(result.keywords, []);
      assertSome(result.files, []);
      assertSome(result.workspaces, []);
    });

    it("handles scoped package names", () => {
      const result = decodePackageJson({ name: "@scope/package-name" });
      expect(result.name).toBe("@scope/package-name");
    });

    it("keeps npm package names strict even when repo package names allow mixed case", () => {
      const exit = decodeUnknownNpmPackageJsonExit(
        {
          name: "@beep/MixedCase",
          dependencies: {
            "@beep/mixed-case-helper": "workspace:^",
          },
        },
        { onExcessProperty: "error" }
      );

      assertTrue(Exit.isFailure(exit));
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

        assertSome(patched.dependencies, {
          "@beep/schema": "catalog:",
        });
        assertSome(patched.private, true);
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
        const issues = yield* decodeUnknownPackageJson(
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
          const issues = yield* decodePackageJson2(testCase.input, {
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
