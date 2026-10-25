import { PackageManifest } from "@beep/package-json/PackageManifest";
import {
  applyPackageJsonPatchEffect,
  decodePackageJson,
  decodePackageJsonExit,
  diffPackageJsonEffect,
  encodePackageJsonCanonicalPrettyEffect,
  encodePackageJsonEffect,
  getPackageJsonSchemaIssues,
  normalizePackageJsonEffect,
  PackageJson,
  packageJsonJsonSchema,
} from "@beep/repo-utils";
import { PublishConfig } from "@beep/repo-utils/schemas/PackageJson";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue, assertUndefined } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";

const decodePackageJson2 = S.decodeEffect(PackageJson);
const DependenciesHolder = S.Struct({ dependencies: PackageJson.fields.dependencies });
const decodePackageJsonFieldsDependencies = S.decodeEffect(DependenciesHolder);
const decodePackageJsonFieldsPublishConfig = S.decodeEffect(PublishConfig);
const decodeUnknownPackageJson = S.decodeUnknownEffect(PackageJson);
const encodePackageJsonFieldsDependencies = S.encodeEffect(DependenciesHolder);
const encodePackageJsonFieldsPublishConfig = S.encodeEffect(PublishConfig);
const isPackageJson = S.is(PackageJson);

const objectKeys = (value: unknown): ReadonlyArray<string> => (P.isObject(value) ? Struct.keys(value) : A.empty());
const decodeJsonPointerSegment = (segment: string): string =>
  pipe(segment, Str.replaceAll("~1", "/"), Str.replaceAll("~0", "~"));
const PackageJsonNameArbitrary = Arbitrary.schema(PackageJson.fields.name);
const PackageJsonDependenciesArbitrary = Arbitrary.schema(PackageJson.fields.dependencies);
const entriesOf = (map: HashMap.HashMap<string, string>): ReadonlyArray<readonly [string, string]> =>
  A.sort(
    A.fromIterable(map),
    Order.mapInput(Order.String, ([key]: readonly [string, string]) => key)
  );
// Retain the original non-recursive core law alongside the full production
// schema law, which also generates bin, recursive exports and JSON-valued extras.
const PublishConfigCoreArbitrary = Arbitrary.schema(
  S.Struct({
    access: S.optionalKey(S.Literals(["public", "restricted"] as const)),
    tag: S.optionalKey(S.String),
    registry: S.optionalKey(S.String),
    provenance: S.optionalKey(S.Boolean),
  })
);

const PublishConfigArbitrary = Arbitrary.schema(PublishConfig);

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
      [PackageJsonDependenciesArbitrary],
      ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* encodePackageJsonFieldsDependencies({ dependencies: value });
          const decoded = yield* decodePackageJsonFieldsDependencies(encoded);

          expect(entriesOf(decoded.dependencies)).toEqual(entriesOf(value));

          return true;
        }),
      { arbitrary: fcRuns(20) }
    );

    it.effect.prop(
      "round-trips schema-derived package.json publishConfig through the encoded wire shape",
      [PublishConfigCoreArbitrary],
      ([core]) =>
        Effect.gen(function* () {
          const value = core;
          const encoded = yield* encodePackageJsonFieldsPublishConfig(value);
          const decoded = yield* decodePackageJsonFieldsPublishConfig(encoded);

          expect(decoded).toEqual(value);

          return true;
        }),
      { arbitrary: fcRuns(20) }
    );

    it.effect.prop(
      "round-trips the full production PublishConfig domain through the encoded wire shape",
      [PublishConfigArbitrary],
      ([config]) =>
        Effect.gen(function* () {
          const value = config;
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
      expect(`${result.version}`).toBe("1.0.0");
      expect(result.license).toBe("MIT");
      // The kit Person keeps the email as written; the retired repo model lowercased it.
      expect(result.author?.name).toBe("Beep Maintainer");
      expect(result.author?.email).toBe("MAINTAINER@EXAMPLE.COM");
      expect(result.bugs?.email).toBe("bugs@example.com");
      expect(result.browser).toEqual({
        "./src/server.ts": "./src/browser.ts",
        fs: false,
      });
      expect(result.peerDependenciesMeta?.typescript?.optional).toBe(true);
      expect(entriesOf(result.scripts)).toEqual([
        ["build", "tsc -b"],
        ["test", "vitest"],
      ]);
      expect(entriesOf(result.dependencies)).toEqual([["effect", "^4.0.0"]]);
      expect(entriesOf(result.engines ?? HashMap.empty())).toEqual([["node", ">=20"]]);
      expect(A.map(result.funding ?? [], (entry) => entry.url)).toEqual([
        "https://github.com/sponsors/beep",
        "https://github.com/sponsors/beep-effect",
      ]);
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
      expect(result.exports).toEqual({
        "./package.json": "./package.json",
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
          require: "./dist/index.cjs",
        },
        "./internal/*": null,
        "./*": ["./dist/*.js", "./dist/*.cjs"],
      });
      expect(result.publishConfig).toEqual({
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

      expect(result.imports).toEqual({
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

      expect(result.workspaces).toEqual(["packages/*", "packages/tooling/*/*"]);
    });

    it("decodes workspaces as an object", () => {
      const result = decodePackageJson({
        name: "pkg",
        workspaces: {
          packages: ["packages/*"],
          nohoist: ["react"],
        },
      });

      expect(result.workspaces).toEqual({
        packages: ["packages/*"],
        nohoist: ["react"],
      });
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

      expect(booleanResult.sideEffects).toBe(false);
      expect(arrayResult.sideEffects).toEqual(["**/*.css"]);
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

      expect(result.packageManager?.name).toBe("bun");
      expect(result.packageManager?.range).toBe("1.3.10");
      expect(result.catalog).toEqual({
        effect: "^4.0.0-beta.27",
        typescript: "^5.9.3",
      });
      expect(result["resolutions#"]).toEqual({
        "@beep/*": "Needed to force PNPM to install local packages",
      });
    });

    it("keeps mixed-case dependency keys while the package name follows the kit's npm rules", () => {
      const result = decodePackageJson({
        name: "@beep/mixed-case",
        dependencies: {
          "@beep/MixedCaseHelper": "workspace:^",
        },
      });

      expect(result.name).toBe("@beep/mixed-case");
      assertSome(HashMap.get(result.dependencies, "@beep/MixedCaseHelper"), "workspace:^");
      // The kit PackageName rejects new mixed-case names; no tracked manifest has one (3-A3 parity).
      decodePackageJsonExit({ name: "@beep/MixedCase" }).pipe(Exit.isFailure, assertTrue);
    });

    it("decodes Bun trusted dependencies", () => {
      const result = decodePackageJson({
        name: "@beep/infra",
        trustedDependencies: ["@pulumi/ghaRunners"],
      });

      expect(result.trustedDependencies).toEqual(["@pulumi/ghaRunners"]);
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

      expect(driverResult.beep).toEqual({ family: "drivers" });
      expect(foundationResult.beep).toEqual({ family: "foundation", kind: "modeling" });
      expect(toolingResult.beep).toEqual({ family: "tooling", kind: "library" });
      expect(ecosystemResult.beep).toEqual({ family: "ecosystem" });
    });

    it("defaults absent dependency maps and scripts to empty HashMaps and leaves other fields absent", () => {
      const result = decodePackageJson({ name: "pkg" });

      result.dependencies.pipe(HashMap.isEmpty, assertTrue);
      result.devDependencies.pipe(HashMap.isEmpty, assertTrue);
      result.peerDependencies.pipe(HashMap.isEmpty, assertTrue);
      result.optionalDependencies.pipe(HashMap.isEmpty, assertTrue);
      result.scripts.pipe(HashMap.isEmpty, assertTrue);
      assertUndefined(result.engines);
      assertUndefined(result.beep);
      assertUndefined(result.version);
      assertUndefined(result.workspaces);
    });

    it.effect(
      "encodes an empty dependency map back to an absent key",
      Effect.fn(function* () {
        const encoded = yield* encodePackageJsonEffect({ name: "pkg", dependencies: {}, scripts: {} });

        expect(encoded).toEqual({ name: "pkg" });
      })
    );

    it("rejects an explicit undefined for the repo-only optional keys (EF-40)", () => {
      decodePackageJsonExit({ name: "pkg", beep: undefined }).pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit({ name: "pkg", "resolutions#": undefined }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects a literal rest key, because the repo model has a closed rest", () => {
      decodePackageJsonExit({ name: "pkg", rest: { smuggled: true } }).pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit({ name: "pkg", rest: {} }).pipe(Exit.isFailure, assertTrue);
    });

    it("accepts a repository object without a type (kit Repository)", () => {
      const result = decodePackageJson({ name: "pkg", repository: { url: "git@github.com:user/repo.git" } });

      expect(result.repository?.url).toBe("git@github.com:user/repo.git");
      assertUndefined(result.repository?.type);
    });

    it("applies the kit's strict generic fields", () => {
      decodePackageJsonExit({ name: "pkg", version: "1.0" }).pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit({ name: "pkg", license: "Not A License" }).pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit({ name: "pkg", packageManager: "bun" }).pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit({ name: "pkg", packageManager: "bun@^1.3.0" }).pipe(Exit.isSuccess, assertTrue);
    });

    it("accepts unknown keys inside the object form of workspaces (kit WorkspacesField)", () => {
      const result = decodePackageJson({ name: "pkg", workspaces: { packages: ["packages/*"], catalog: {} } });

      expect(result.workspaces).toEqual({ packages: ["packages/*"], catalog: {} });
    });
  });

  describe("inherited PackageManifest members", () => {
    it.effect(
      "PackageJson.decode runs the strict repo model, not the inherited open wire",
      Effect.fn(function* () {
        const manifest = yield* PackageJson.decode({ name: "pkg", beep: { family: "ecosystem" } });

        assertTrue(S.is(PackageJson)(manifest));
        expect(manifest.beep).toEqual({ family: "ecosystem" });

        const failure = yield* PackageJson.decode({ name: "pkg", unexpected: true }).pipe(Effect.flip);
        expect(failure._tag).toBe("PackageDecodeError");
      })
    );

    it("toJsonString keeps beep and resolutions#", () => {
      const manifest = decodePackageJson({
        name: "pkg",
        beep: { family: "ecosystem" },
        "resolutions#": { effect: "pinned for the kit" },
      });
      const text = manifest.toJsonString();

      expect(text).toContain('"beep"');
      expect(text).toContain('"resolutions#"');
      expect(decodePackageJson(JSON.parse(text)).beep).toEqual({ family: "ecosystem" });
    });

    it.effect(
      "the inherited schema static is the kit's open wire and decodes to a plain PackageManifest",
      Effect.fn(function* () {
        expect(Reflect.get(PackageJson, "schema")).toBe(PackageManifest.schema);
        const decoded = yield* S.decodeEffect(PackageManifest.schema)({
          name: "pkg",
          beep: { family: "ecosystem" },
        });

        assertTrue(S.is(PackageManifest)(decoded));
        assertFalse(S.is(PackageJson)(decoded));
        expect(decoded.rest).toEqual({ beep: { family: "ecosystem" } });
      })
    );
  });

  describe("malformed structures", () => {
    it("rejects missing name field", () => {
      decodePackageJsonExit({ version: "1.0.0" }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects empty string names", () => {
      decodePackageJsonExit({ name: "" }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects invalid package names", () => {
      decodePackageJsonExit({ name: "Invalid Name" }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects invalid package type values", () => {
      decodePackageJsonExit({
        name: "pkg",
        type: "esm",
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects repository objects without a url", () => {
      decodePackageJsonExit({
        name: "pkg",
        repository: {
          type: "git",
        },
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects funding objects without a url", () => {
      decodePackageJsonExit({
        name: "pkg",
        funding: {
          type: "github",
        },
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects exports objects with invalid keys", () => {
      decodePackageJsonExit({
        name: "pkg",
        exports: {
          "1invalid": "./dist/index.js",
        },
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects imports objects with invalid keys", () => {
      decodePackageJsonExit({
        name: "pkg",
        imports: {
          internal: "./src/internal.ts",
        },
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects workspaces as a string", () => {
      decodePackageJsonExit({
        name: "pkg",
        workspaces: "packages/*",
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects unexpected top-level keys", () => {
      decodePackageJsonExit({
        name: "pkg",
        unexpected: true,
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects private as a string", () => {
      decodePackageJsonExit({
        name: "pkg",
        private: "true",
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects dependency records with invalid keys or empty values", () => {
      decodePackageJsonExit({
        name: "pkg",
        dependencies: {
          "Invalid Name": "catalog:",
        },
      }).pipe(Exit.isFailure, assertTrue);

      decodePackageJsonExit({
        name: "pkg",
        beep: {
          family: "ecosystem",
          kind: "modeling",
        },
      }).pipe(Exit.isFailure, assertTrue);

      decodePackageJsonExit({
        name: "pkg",
        dependencies: {
          effect: "",
        },
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects invalid repo-local beep package metadata", () => {
      decodePackageJsonExit({
        name: "pkg",
        beep: {
          family: "shared",
        },
      }).pipe(Exit.isFailure, assertTrue);

      decodePackageJsonExit({
        name: "pkg",
        beep: {
          family: "drivers",
          kind: "modeling",
        },
      }).pipe(Exit.isFailure, assertTrue);

      decodePackageJsonExit({
        name: "pkg",
        beep: {
          family: "foundation",
        },
      }).pipe(Exit.isFailure, assertTrue);
    });

    it("rejects non-object input", () => {
      decodePackageJsonExit("not-an-object").pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit(42).pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit(null).pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit(undefined).pipe(Exit.isFailure, assertTrue);
      decodePackageJsonExit([]).pipe(Exit.isFailure, assertTrue);
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

      expect(result.keywords).toEqual([]);
      expect(result.files).toEqual([]);
      expect(result.workspaces).toEqual([]);
    });

    it("handles scoped package names", () => {
      const result = decodePackageJson({ name: "@scope/package-name" });
      expect(result.name).toBe("@scope/package-name");
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

      expect(result.repository?.type).toBe("git");
      expect(result.repository?.url).toBe("git@github.com:beep-effect/beep-effect.git");
      expect(result.repository?.directory).toBe("packages/tooling/library/repo-utils");
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
      "sorts a bin map and orders repository keys in canonical output",
      Effect.fn(function* () {
        const json = yield* encodePackageJsonCanonicalPrettyEffect({
          name: "pkg",
          repository: {
            directory: ".",
            url: "git@github.com:beep-effect/beep-effect.git",
            type: "git",
          },
          bin: {
            "pkg-verify": "./src/verify.ts",
            "pkg-build": "./src/build.ts",
          },
        });

        expect(json).toBe(`{
  "name": "pkg",
  "repository": {
    "type": "git",
    "url": "git@github.com:beep-effect/beep-effect.git",
    "directory": "."
  },
  "bin": {
    "pkg-build": "./src/build.ts",
    "pkg-verify": "./src/verify.ts"
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

        expect(entriesOf(patched.dependencies)).toEqual([["@beep/schema", "catalog:"]]);
        expect(patched.private).toBe(true);
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

      const packageJsonDefinitionName = decodeJsonPointerSegment(Str.slice("#/$defs/".length)(packageJsonSchema.$ref));
      const packageJsonDefinition = packageJsonJsonSchema.definitions[packageJsonDefinitionName];

      // `Class.extend` annotates the encoding with the class identifier, so the root definition is
      // `.../schemas/PackageJson/PackageJson` rather than the retired model's `.../PackageJsonEncoded`.
      expect(packageJsonDefinitionName).toBe("@beep/repo-utils/schemas/PackageJson/PackageJson");
      expect(packageJsonDefinition?.additionalProperties).toBe(false);
      expect(packageJsonDefinition?.required).toEqual(["name"]);

      // The kit's transformation codecs emit their encoded side.
      expect(packageJsonDefinition?.properties).toMatchObject({
        version: { $ref: "#/$defs/@beep~1semver~1SemVer~1SemVerEncoded" },
        packageManager: { type: "string" },
        author: { anyOf: [{ type: "object" }, { type: "string" }] },
        repository: { anyOf: [{ type: "object" }, { type: "string" }] },
        dependencies: { $ref: "#/$defs/@beep~1repo-utils~1schemas~1PackageJson~1RepoDependencyRecord" },
        scripts: { $ref: "#/$defs/@beep~1repo-utils~1schemas~1PackageJson~1NonEmptyStringRecord" },
      });
      expect(packageJsonDefinition?.properties).toHaveProperty("rest");
      expect(packageJsonDefinition?.properties).toHaveProperty("beep");
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
