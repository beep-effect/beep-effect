import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { InvalidPackageNameError, PackageName, ScopedPackageName, UnscopedPackageName } from "../../effected/package-json/PackageName.ts";

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
			"a".repeat(215),
			"",
		]) {
			assert.isFalse(PackageName.isValid(name), name);
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
	it.effect("decodes valid scoped and unscoped names", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* S.decodeEffect(PackageName)("lodash"), "lodash");
			assert.strictEqual(yield* S.decodeEffect(PackageName)("@scope/pkg"), "@scope/pkg");
		}),
	);

	it.effect("rejects an invalid name with a SchemaError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(S.decodeEffect(PackageName)("BAD"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("ScopedPackageName rejects unscoped, UnscopedPackageName rejects scoped", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* S.decodeEffect(ScopedPackageName)("@scope/pkg"), "@scope/pkg");
			assert.isTrue(
				(yield* Effect.flip(S.decodeEffect(ScopedPackageName)("lodash")))._tag === "SchemaError",
			);
			assert.strictEqual(yield* S.decodeEffect(UnscopedPackageName)("lodash"), "lodash");
			assert.isTrue(
				(yield* Effect.flip(S.decodeEffect(UnscopedPackageName)("@scope/pkg")))._tag === "SchemaError",
			);
		}),
	);

	it.effect.prop("every generated unscoped name passes isValid", [UnscopedPackageName], ([name]) =>
		Effect.sync(() => {
			assert.isTrue(PackageName.isValid(name));
		}),
	);

	it.effect.prop("every generated scoped name passes isValid and is scoped", [ScopedPackageName], ([name]) =>
		Effect.sync(() => {
			assert.isTrue(PackageName.isValid(name));
			assert.isTrue(PackageName.isScoped(name));
		}),
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
		const scoped = String.raw`^@[a-z0-9-][a-z0-9._-]*\/[a-z0-9-][a-z0-9._-]*$`;
		const unscoped = "^[a-z0-9-][a-z0-9._-]*$";
		assert.nestedPropertyVal(S.toJsonSchemaDocument(ScopedPackageName), "schema.pattern", scoped);
		assert.nestedPropertyVal(S.toJsonSchemaDocument(UnscopedPackageName), "schema.pattern", unscoped);
		const union = S.toJsonSchemaDocument(PackageName);
		assert.nestedPropertyVal(union, "schema.anyOf[0].pattern", scoped);
		assert.nestedPropertyVal(union, "schema.anyOf[1].pattern", unscoped);
	});
});
