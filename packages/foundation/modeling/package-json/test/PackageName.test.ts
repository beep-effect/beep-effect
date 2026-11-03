import { $PackageJsonId } from "@beep/identity/packages";
import {
  InvalidPackageNameError,
  PackageName,
  ScopedPackageName,
  UnscopedPackageName,
} from "@beep/package-json/PackageName";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PackageJsonId.create("PackageName");

describe("PackageName.isValid", () => {
  it("accepts simple, scoped, and punctuated names", () => {
    for (const name of ["my-package", "lodash", "a", "@scope/name", "@my-org/my-pkg", "my.package", "my_package"]) {
      assert.isTrue(PackageName.isValid(name), name);
    }
  });

  it("rejects leading dot/underscore, uppercase, spaces, specials, over-length and empty", () => {
    for (const name of [
      ".hidden",
      "_private",
      "MyPackage",
      "my package",
      "my~package",
      "my!package",
      Str.repeat(215)("a"),
      "",
    ]) {
      assert.isFalse(PackageName.isValid(name), name);
    }
  });
});

// W3-f conformance shift, pinned inverted: these three names were accepted
// before promotion and are rejected now, matching validate-npm-package-name's
// validForOldPackages (see PackageName.differential.test.ts).
describe("PackageName follows npm's validForOldPackages", () => {
  it("rejects a leading hyphen and the two reserved names it accepted before promotion", () => {
    for (const name of ["-leading-hyphen", "-", "node_modules", "favicon.ico"]) {
      assert.isFalse(PackageName.isValid(name), name);
      assert.isFalse(S.is(UnscopedPackageName)(name), name);
    }
  });

  it("still accepts a hyphen after the first character and inside a scope", () => {
    for (const name of ["a-", "a-b", "@-scope/pkg", "@scope/-pkg", "@scope/node_modules", "node_modules-x"]) {
      assert.isTrue(PackageName.isValid(name), name);
    }
  });
});

describe("PackageName classification statics", () => {
  it("scope/unscoped/isScoped", () => {
    assert.deepStrictEqual(PackageName.scope("@scope/pkg"), O.some("scope"));
    assert.deepStrictEqual(PackageName.scope("lodash"), O.none());
    assert.strictEqual(PackageName.unscoped("@scope/pkg"), "pkg");
    assert.strictEqual(PackageName.unscoped("lodash"), "lodash");
    assert.isTrue(PackageName.isScoped("@scope/pkg"));
    assert.isFalse(PackageName.isScoped("lodash"));
  });
});

describe("PackageName schema", () => {
  it("preserves owning identity metadata and class statics", () => {
    assert.isFunction(PackageName);
    for (const [name, schema] of [
      ["ScopedPackageName", ScopedPackageName],
      ["UnscopedPackageName", UnscopedPackageName],
      ["PackageName", PackageName],
    ] as const) {
      assert.include(S.resolveAnnotations(schema), $I.annote(name));
    }
  });
  it.effect("encodes decoded scoped and unscoped names without changing bytes", () =>
    Effect.gen(function* () {
      for (const name of ["lodash", "@scope/pkg"]) {
        const decoded = yield* S.decodeEffect(PackageName)(name);
        const value = yield* S.encodeEffect(PackageName)(decoded);
        assert.strictEqual(value, name);
      }
    })
  );

  it.effect("decodes valid scoped and unscoped names", () =>
    Effect.gen(function* () {
      const value1 = yield* S.decodeEffect(PackageName)("lodash");
      assert.strictEqual(value1, "lodash");
      const value2 = yield* S.decodeEffect(PackageName)("@scope/pkg");
      assert.strictEqual(value2, "@scope/pkg");
    })
  );

  it.effect("rejects an invalid name with a SchemaError", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(S.decodeEffect(PackageName)("BAD"));
      assert.strictEqual(error._tag, "SchemaError");
    })
  );

  it.effect("ScopedPackageName rejects unscoped, UnscopedPackageName rejects scoped", () =>
    Effect.gen(function* () {
      const value3 = yield* S.decodeEffect(ScopedPackageName)("@scope/pkg");
      assert.strictEqual(value3, "@scope/pkg");
      assert.isTrue((yield* Effect.flip(S.decodeEffect(ScopedPackageName)("lodash")))._tag === "SchemaError");
      const value4 = yield* S.decodeEffect(UnscopedPackageName)("lodash");
      assert.strictEqual(value4, "lodash");
      assert.isTrue((yield* Effect.flip(S.decodeEffect(UnscopedPackageName)("@scope/pkg")))._tag === "SchemaError");
    })
  );

  it.effect.prop("every generated unscoped name passes isValid", [UnscopedPackageName], ([name]) =>
    Effect.sync(() => {
      assert.isTrue(PackageName.isValid(name));
    })
  );

  it.effect.prop("every generated scoped name passes isValid and is scoped", [ScopedPackageName], ([name]) =>
    Effect.sync(() => {
      assert.isTrue(PackageName.isValid(name));
      assert.isTrue(PackageName.isScoped(name));
    })
  );
});

describe("InvalidPackageNameError", () => {
  it("renders a message", () => {
    const error = InvalidPackageNameError.make({ input: "BAD" });
    assert.strictEqual(error._tag, "InvalidPackageNameError");
    assert.include(error.message, "BAD");
  });
});

describe("PackageName JSON Schema export", () => {
  it("scoped and unscoped names export their patterns", () => {
    const scopedId = $I`ScopedPackageName`;
    const unscopedId = $I`UnscopedPackageName`;
    const unionId = $I`PackageName`;
    const scoped = String.raw`^@[a-z0-9-][a-z0-9._-]*\/[a-z0-9-][a-z0-9._-]*$`;
    // W3-f: no leading `-` for an unscoped name (validForOldPackages).
    const unscoped = "^[a-z0-9][a-z0-9._-]*$";
    assert.propertyVal(S.toJsonSchemaDocument(ScopedPackageName).definitions[scopedId], "pattern", scoped);
    assert.propertyVal(S.toJsonSchemaDocument(UnscopedPackageName).definitions[unscopedId], "pattern", unscoped);
    const union = S.toJsonSchemaDocument(PackageName);
    assert.propertyVal(union.definitions[scopedId], "pattern", scoped);
    assert.propertyVal(union.definitions[unscopedId], "pattern", unscoped);
    assert.deepPropertyVal(union.definitions[unionId], "anyOf", [
      { $ref: "#/$defs/@beep~1package-json~1PackageName~1ScopedPackageName" },
      { $ref: "#/$defs/@beep~1package-json~1PackageName~1UnscopedPackageName" },
    ]);
  });
});
