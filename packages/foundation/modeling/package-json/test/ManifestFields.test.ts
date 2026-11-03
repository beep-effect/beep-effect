import { identity } from "effect/Function";
// The generic npm / Node / TypeScript / bundler / Yarn / Bun fields the kit
// models since 3-A2 (the field set repo-utils `schemas/PackageJson.ts` modeled
// and the kit lacked). Each field is pinned on every tier:
//
//   - the strict `Package.schema` and a `Package.wireFor` subclass decode it
//     to a typed member (not `rest`) and encode it back byte-for-byte;
//   - the presence-lenient `PackageManifest.schema` does the same without
//     `name` / `version`;
//   - a malformed value fails the strict and presence tiers, and degrades on
//     `LenientManifest` (absent, kept verbatim in `rest`, reported on
//     `issues`);
//   - an explicit `undefined` is rejected, not read as absence (EF-40, W4-j).

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { $PackageJsonId } from "@beep/identity/packages";
import { LenientManifest } from "@beep/package-json/LenientManifest";
import {
  BooleanOrStringListField,
  BrowserField,
  ManField,
  OpenRecordField,
  OverridesField,
  OverrideValue,
  StringListField,
  StringRecordField,
  TypesVersionsField,
  WorkspacesConfig,
  WorkspacesField,
} from "@beep/package-json/ManifestFields";
import { Package } from "@beep/package-json/Package";
import { PackageJsonFormat } from "@beep/package-json/PackageJsonFormat";
import { PackageManifest } from "@beep/package-json/PackageManifest";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse, assertTrue, assertUndefined, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const base = { name: "@scope/pkg", version: "1.0.0" };

// The four dependency maps and `scripts` decode with an empty default, so the
// wire encode carries them back as `{}` (`toJsonString` strips them).
const DEFAULT_MAPS = {
  dependencies: {},
  devDependencies: {},
  peerDependencies: {},
  optionalDependencies: {},
  scripts: {},
};

const sameCatalog = S.toEquivalence(StringRecordField);
const sameOverrides = S.toEquivalence(OverridesField);

/** One added field: a valid wire value, a malformed one, and the lenient shape it degrades against. */
interface FieldCase {
  readonly expected: string;
  readonly field: string;
  readonly invalid: unknown;
  readonly valid: unknown;
}

const CASES: ReadonlyArray<FieldCase> = [
  { field: "files", valid: ["dist", "!dist/**/*.map"], invalid: "dist", expected: "an array of strings" },
  { field: "imports", valid: { "#internal/*": "./src/internal/*.js" }, invalid: "#x", expected: "an object" },
  { field: "module", valid: "./dist/index.mjs", invalid: 1, expected: "a string" },
  {
    field: "browser",
    valid: { fs: false, "./node.js": "./browser.js" },
    invalid: 1,
    expected: "a string or an object",
  },
  { field: "man", valid: ["./man/a.1", "./man/b.1"], invalid: [1], expected: "a string or an array of strings" },
  {
    field: "directories",
    valid: { bin: "./bin", man: "./man" },
    invalid: { bin: 1 },
    expected: "an object of string values",
  },
  { field: "config", valid: { port: 8080, flags: ["a"] }, invalid: "x", expected: "an object" },
  {
    field: "bundleDependencies",
    valid: ["left-pad"],
    invalid: "left-pad",
    expected: "a boolean or an array of strings",
  },
  { field: "bundledDependencies", valid: true, invalid: 1, expected: "a boolean or an array of strings" },
  {
    field: "overrides",
    valid: { foo: { ".": "1.0.0", bar: "2.0.0" }, baz: "3.0.0" },
    invalid: "x",
    expected: "an object",
  },
  { field: "engineStrict", valid: false, invalid: "yes", expected: "a boolean" },
  { field: "os", valid: ["linux", "!win32"], invalid: "linux", expected: "an array of strings" },
  { field: "cpu", valid: ["x64", "arm64"], invalid: [64], expected: "an array of strings" },
  { field: "libc", valid: ["glibc"], invalid: "glibc", expected: "an array of strings" },
  { field: "preferGlobal", valid: true, invalid: 1, expected: "a boolean" },
  {
    field: "workspaces",
    valid: ["packages/*", "apps/*"],
    invalid: "packages/*",
    expected: "an array of strings or an object",
  },
  { field: "sideEffects", valid: ["*.css"], invalid: "*.css", expected: "a boolean or an array of strings" },
  { field: "types", valid: "./dist/index.d.ts", invalid: ["x"], expected: "a string" },
  { field: "typings", valid: "./index.d.ts", invalid: false, expected: "a string" },
  { field: "typesVersions", valid: { "<4.0": { "*": ["ts3.9/*"] } }, invalid: ["x"], expected: "an object" },
  {
    field: "resolutions",
    valid: { "**/lodash": "4.17.21" },
    invalid: { lodash: 4 },
    expected: "an object of string values",
  },
  {
    field: "patchedDependencies",
    valid: { "is-even@1.0.0": "patches/is-even.patch" },
    invalid: [],
    expected: "an object of string values",
  },
  { field: "trustedDependencies", valid: ["esbuild"], invalid: "esbuild", expected: "an array of strings" },
  {
    field: "catalog",
    valid: { effect: "4.0.4", react: "^19.0.0" },
    invalid: { effect: true },
    expected: "an object of string values",
  },
  { field: "readme", valid: "# pkg\n", invalid: 1, expected: "a string" },
];

class ExtendedPackage extends Package.extend<ExtendedPackage>("ExtendedPackage")({ tool: S.optionalKey(S.String) }) {}

const typedMember = (decoded: object, field: string): unknown =>
  O.getOrUndefined(R.get(decoded as Record<string, unknown>, field));

describe("ManifestFields schemas", () => {
  it("carry their owning schema identity metadata", () => {
    const $I = $PackageJsonId.create("ManifestFields");
    for (const [name, schema] of [
      ["StringListField", StringListField],
      ["StringRecordField", StringRecordField],
      ["OpenRecordField", OpenRecordField],
      ["BrowserField", BrowserField],
      ["ManField", ManField],
      ["BooleanOrStringListField", BooleanOrStringListField],
      ["OverridesField", OverridesField],
      ["TypesVersionsField", TypesVersionsField],
      ["WorkspacesConfig", WorkspacesConfig],
      ["WorkspacesField", WorkspacesField],
    ] as const) {
      assert.include(S.resolveAnnotations(schema), $I.annote(name));
    }
  });

  it.effect("decode nested overrides and reject a non-string leaf", () =>
    Effect.gen(function* () {
      const nested = { foo: { bar: { ".": "1.0.0", baz: "2.0.0" } } };
      const argument = S.encodeEffect(OverridesField);
      const value7 = yield* S.decodeEffect(OverridesField)(nested);
      const value1 = yield* argument(value7);
      deepStrictEqual(value1, nested);
      const error = yield* Effect.flip(S.decodeUnknownEffect(OverridesField)({ foo: { bar: 1 } }));
      strictEqual(error._tag, "SchemaError");
    })
  );

  it.effect("keep every extra key of the workspaces object, Bun catalogs included", () =>
    Effect.gen(function* () {
      const wire = { packages: ["packages/*"], nohoist: ["**/react-native"], catalog: { effect: "4.0.4" } };
      const decoded = yield* S.decodeEffect(WorkspacesField)(wire);
      const value2 = yield* S.encodeEffect(WorkspacesField)(decoded);
      deepStrictEqual(value2, wire);
      const error = yield* Effect.flip(S.decodeEffect(WorkspacesField)({ packages: "packages/*" }));
      strictEqual(error._tag, "SchemaError");
    })
  );

  it.effect("keep the workspaces object's source key order, catalog before packages", () =>
    Effect.gen(function* () {
      const wire = { catalog: { effect: "4.0.4" }, packages: ["packages/*"], catalogs: { test: { vitest: "4.0.0" } } };
      const decoded = yield* S.decodeEffect(WorkspacesConfig)(wire);
      deepStrictEqual(R.keys<string, unknown>(decoded), R.keys(wire));
      const encoded = yield* S.encodeEffect(WorkspacesConfig)(decoded);
      deepStrictEqual(R.keys(encoded), R.keys(wire));
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect("keep a string record's source key order (no HashMap reordering)", () =>
    Effect.gen(function* () {
      const catalog = { zod: "4.6.6", effect: "4.0.4", "@types/node": "24.0.0" };
      const pkg = yield* S.decodeEffect(Package.schema)({ ...base, catalog });
      deepStrictEqual(R.keys(pkg.catalog ?? {}), R.keys(catalog));
    })
  );

  it("browser accepts only false as a non-string replacement", () => {
    assertTrue(S.is(BrowserField)({ fs: false }));
    assertFalse(S.is(BrowserField)({ fs: true }));
  });
});

describe("added fields on the manifest tiers", () => {
  for (const { field, valid, invalid, expected } of CASES) {
    it.effect(`${field}: round-trips through Package.schema, wireFor and PackageManifest.schema`, () =>
      Effect.gen(function* () {
        const wire = { ...base, [field]: valid };
        const strict = yield* S.decodeEffect(Package.schema)(wire);
        deepStrictEqual(typedMember(strict, field), valid);
        assertUndefined(strict.rest?.[field]);
        const value3 = yield* S.encodeUnknownEffect(Package.schema)(strict);
        deepStrictEqual(value3, { ...DEFAULT_MAPS, ...wire });

        const codec = Package.wireFor(ExtendedPackage);
        const extended = yield* S.decodeEffect(codec)({ ...wire, tool: "kept" });
        deepStrictEqual(typedMember(extended, field), valid);
        const value4 = yield* S.encodeUnknownEffect(codec)(extended);
        deepStrictEqual(value4, { ...DEFAULT_MAPS, ...wire, tool: "kept" });

        const presence = yield* S.decodeEffect(PackageManifest.schema)({ [field]: valid });
        deepStrictEqual(typedMember(presence, field), valid);
        const value5 = yield* S.encodeUnknownEffect(PackageManifest.schema)(presence);
        deepStrictEqual(value5, {
          ...DEFAULT_MAPS,
          [field]: valid,
        });
      })
    );

    it.effect(`${field}: a malformed value fails the strict and presence tiers`, () =>
      Effect.gen(function* () {
        const strictError = yield* Effect.flip(Package.decode({ ...base, [field]: invalid }));
        strictEqual(strictError._tag, "PackageDecodeError");
        const presenceError = yield* Effect.flip(PackageManifest.decode({ [field]: invalid }));
        strictEqual(presenceError._tag, "PackageDecodeError");
      })
    );

    it.effect(`${field}: an explicit undefined is rejected, not read as absence`, () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(PackageManifest.decode({ [field]: undefined }));
        strictEqual(error._tag, "PackageDecodeError");
        const strictError = yield* Effect.flip(Package.decode({ ...base, [field]: undefined }));
        strictEqual(strictError._tag, "PackageDecodeError");
        // The discovery tier degrades it like any other malformed value.
        const lenient = yield* LenientManifest.decode({ [field]: undefined });
        deepStrictEqual(
          A.map(lenient.issues, (issue) => issue.field),
          [field]
        );
      })
    );

    it(`${field}: LenientManifest keeps a valid value typed and degrades a malformed one`, () => {
      const kept = Result.getOrThrow(LenientManifest.decodeResult({ [field]: valid }));
      deepStrictEqual(typedMember(kept, field), valid);
      deepStrictEqual(kept.issues, []);

      const degraded = Result.getOrThrow(LenientManifest.decodeResult({ name: "pkg", [field]: invalid }));
      assertUndefined(typedMember(degraded, field));
      deepStrictEqual(degraded.rest?.[field], invalid);
      deepStrictEqual(
        A.map(degraded.issues, (issue) => [issue.field, issue.expected, issue.value]),
        [[field, expected, invalid]]
      );
      strictEqual(degraded.name, "pkg");
    });
  }

  it("covers every Package field LenientManifest names, and no others", () => {
    const strictKeys = A.filter(R.keys(Package.fields), (key) => key !== "rest");
    const lenientKeys = A.filter(R.keys(LenientManifest.fields), (key) => key !== "rest" && key !== "issues");
    deepStrictEqual(A.sort(lenientKeys, Order.String), A.sort(strictKeys, Order.String));
    for (const { field } of CASES) {
      assertTrue(A.contains(strictKeys, field), `Package models ${field}`);
    }
  });
});

describe("ManifestFields property", () => {
  it.effect.prop(
    "a generated string record round-trips through Package.schema with its key order",
    [StringRecordField],
    ([catalog]) =>
      Effect.gen(function* () {
        const pkg = yield* S.decodeEffect(Package.schema)({ ...base, catalog });
        deepStrictEqual(R.keys(pkg.catalog ?? {}), R.keys(catalog));
        const encoded = yield* S.encodeEffect(StringRecordField)(pkg.catalog ?? {});
        assertTrue(sameCatalog(encoded, catalog));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "a generated overrides value round-trips through PackageManifest.schema",
    [OverridesField],
    ([overrides]) =>
      Effect.gen(function* () {
        const manifest = yield* S.decodeEffect(PackageManifest.schema)({ overrides });
        const value6 = yield* S.encodeEffect(OverridesField)(manifest.overrides ?? {});
        assertTrue(sameOverrides(value6, overrides));
      }),
    { arbitrary: fcRuns(25) }
  );
});

const Json = S.fromJsonString(S.Unknown);

// Typing a field moves it out of `rest`, which changes the RAW schema-encode
// key order (`{ ...rest, ...known }`). That order is not a contract: the
// formatted output is, and `toJsonString` sorts by the canonical key order
// whatever the typing. Pin it byte-for-byte against the decode-free
// `PackageJsonFormat` text path, which never types a field.
describe("ManifestFields formatted output", () => {
  const shuffled = Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
      trustedDependencies: ["esbuild"],
      catalog: { effect: "4.0.0" },
      workspaces: ["packages/*"],
      readme: "README.md",
      overrides: { foo: { ".": "1.0.0" } },
      types: "./dist/index.d.ts",
      name: "@scope/pkg",
      patchedDependencies: { "foo@1.0.0": "patches/foo.patch" },
      libc: ["glibc"],
      os: ["linux"],
      version: "1.0.0",
      files: ["dist"],
      sideEffects: false,
      typesVersions: { "*": { "*": ["dist/*"] } },
      "x-tool": true,
    }),
    identity
  );
  const canonical = A.join(
    [
      "{",
      '  "name": "@scope/pkg",',
      '  "version": "1.0.0",',
      '  "sideEffects": false,',
      '  "types": "./dist/index.d.ts",',
      '  "typesVersions": {',
      '    "*": {',
      '      "*": [',
      '        "dist/*"',
      "      ]",
      "    }",
      "  },",
      '  "files": [',
      '    "dist"',
      "  ],",
      '  "workspaces": [',
      '    "packages/*"',
      "  ],",
      '  "overrides": {',
      '    "foo": {',
      '      ".": "1.0.0"',
      "    }",
      "  },",
      '  "os": [',
      '    "linux"',
      "  ],",
      '  "catalog": {',
      '    "effect": "4.0.0"',
      "  },",
      '  "libc": [',
      '    "glibc"',
      "  ],",
      '  "patchedDependencies": {',
      '    "foo@1.0.0": "patches/foo.patch"',
      "  },",
      '  "readme": "README.md",',
      '  "trustedDependencies": [',
      '    "esbuild"',
      "  ],",
      '  "x-tool": true',
      "}",
      "",
    ],
    "\n"
  );

  it.effect("the decode-free text path yields the canonical text", () =>
    Effect.gen(function* () {
      const fromResult7 = yield* Effect.fromResult(PackageJsonFormat.formatToString(shuffled));
      strictEqual(fromResult7, canonical);
    })
  );

  it.effect("Package.toJsonString matches the decode-free text path byte-for-byte", () =>
    Effect.gen(function* () {
      const value8 = yield* S.decodeEffect(Json)(shuffled);
      const pkg = yield* Package.decode(value8);
      strictEqual(pkg.toJsonString(), canonical);
    })
  );

  it.effect("PackageManifest.toJsonString matches the decode-free text path byte-for-byte", () =>
    Effect.gen(function* () {
      const value9 = yield* S.decodeEffect(Json)(shuffled);
      const manifest = yield* PackageManifest.decode(value9);
      strictEqual(manifest.toJsonString(), canonical);
    })
  );
});

// A struct parse emits its declared keys first, and the canonical sort orders
// top-level keys only, so a nested Bun `workspaces` object written
// catalog-before-packages is where a typed field could still drift from the
// decode-free text path.
describe("ManifestFields formatted output: nested workspaces key order", () => {
  const bunRoot = A.join(
    [
      "{",
      '  "name": "root",',
      '  "version": "0.0.0",',
      '  "private": true,',
      '  "workspaces": {',
      '    "catalog": {',
      '      "effect": "4.0.4"',
      "    },",
      '    "packages": [',
      '      "packages/*"',
      "    ]",
      "  }",
      "}",
      "",
    ],
    "\n"
  );

  it.effect("the decode-free text path keeps the Bun root byte-for-byte", () =>
    Effect.gen(function* () {
      const fromResult10 = yield* Effect.fromResult(PackageJsonFormat.formatToString(bunRoot));
      strictEqual(fromResult10, bunRoot);
    })
  );

  it.effect("Package and PackageManifest re-render the Bun root byte-for-byte", () =>
    Effect.gen(function* () {
      const raw = yield* S.decodeEffect(Json)(bunRoot);
      strictEqual((yield* Package.decode(raw)).toJsonString(), bunRoot);
      strictEqual((yield* PackageManifest.decode(raw)).toJsonString(), bunRoot);
    })
  );
});

describe("OverrideValue", () => {
  it("guards a specifier and a nested override object, and rejects a non-string leaf", () => {
    const is = S.is(OverrideValue);
    assertTrue(is("1.0.0"));
    assertTrue(is({ ".": "1.0.0", bar: { baz: "2.0.0" } }));
    assertFalse(is({ bar: 1 }));
  });
});
