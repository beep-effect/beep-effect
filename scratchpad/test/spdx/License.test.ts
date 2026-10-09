import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { InvalidSpdxExpressionError, License } from "../../effected/spdx/License.ts";

describe("License", () => {
	it.effect("makes a known license id", () =>
		Effect.gen(function* () {
			const mit = yield* License.parse("MIT");
			assert.strictEqual(mit.id, "MIT");
			assert.isFalse(mit.deprecated);
		}),
	);
	it.effect("marks a deprecated id", () =>
		Effect.gen(function* () {
			const gpl = yield* License.parse("GPL-3.0");
			assert.isTrue(gpl.deprecated);
		}),
	);
	it.effect("accepts a LicenseRef", () =>
		Effect.gen(function* () {
			const ref = yield* License.parse("LicenseRef-MyProprietary");
			assert.strictEqual(ref.id, "LicenseRef-MyProprietary");
			assert.isFalse(ref.deprecated);
		}),
	);
	it.effect("accepts a DocumentRef-scoped LicenseRef", () =>
		Effect.gen(function* () {
			const ref = yield* License.parse("DocumentRef-spdx-tool:LicenseRef-MyProprietary");
			assert.strictEqual(ref.id, "DocumentRef-spdx-tool:LicenseRef-MyProprietary");
			assert.isFalse(ref.deprecated);
		}),
	);
	it.effect("fails typed on an unknown id", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(License.parse("NOT-A-LICENSE"));
			assert.isTrue(Exit.isFailure(exit));
			// the failure is the typed error, never a defect
			const error = yield* Effect.flip(License.parse("NOT-A-LICENSE"));
			assert.instanceOf(error, InvalidSpdxExpressionError);
			assert.strictEqual(error._tag, "InvalidSpdxExpressionError");
			assert.strictEqual(error.input, "NOT-A-LICENSE");
		}),
	);
	it.effect("rejects a malformed LicenseRef as a typed failure, never a defect", () =>
		Effect.gen(function* () {
			// spaces are not valid idstring characters
			const result = yield* Effect.result(License.parse("LicenseRef-has spaces"));
			assert.strictEqual(result._tag, "Failure");
		}),
	);
	it("predicates read the catalog synchronously", () => {
		assert.isTrue(License.isKnownId("Apache-2.0"));
		assert.isTrue(License.isDeprecatedId("GPL-3.0"));
		assert.isFalse(License.isKnownId("NOT-A-LICENSE"));
		// a grammatically valid LicenseRef is not a catalog member
		assert.isFalse(License.isKnownId("LicenseRef-MyProprietary"));
		assert.isFalse(License.isDeprecatedId("MIT"));
	});
	it("exposes the LicenseRef grammar predicate", () => {
		assert.isTrue(License.isLicenseRef("LicenseRef-MyProprietary"));
		assert.isTrue(License.isLicenseRef("DocumentRef-x:LicenseRef-y"));
		assert.isFalse(License.isLicenseRef("MIT"));
		assert.isFalse(License.isLicenseRef("LicenseRef-has spaces"));
	});
	it("parseResult is the sync primitive", () => {
		const ok = License.parseResult("MIT");
		assert.isTrue(Result.isSuccess(ok));
		const bad = License.parseResult("NOT-A-LICENSE");
		assert.isTrue(Result.isFailure(bad));
	});
	it("of constructs from typed parts", () => {
		const mit = License.of("MIT");
		assert.strictEqual(mit.id, "MIT");
		assert.isFalse(mit.deprecated);
		const gpl = License.of("GPL-3.0", true);
		assert.strictEqual(gpl.id, "GPL-3.0");
		assert.isTrue(gpl.deprecated);
	});
	it("catalog holds resolved license domain objects", () => {
		const mit = O.getOrUndefined(HashMap.get(License.catalog, "MIT"));
		assert.isDefined(mit);
		assert.strictEqual(mit?.id, "MIT");
		assert.strictEqual(O.getOrUndefined(HashMap.get(License.catalog, "GPL-3.0"))?.deprecated, true);
	});
});
