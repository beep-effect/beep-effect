import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import { InvalidSpdxExpressionError, License } from "../../effected/spdx/License.ts";
import { LicenseException } from "../../effected/spdx/LicenseException.ts";

describe("LicenseException", () => {
	it.effect("makes a known exception id", () =>
		Effect.gen(function* () {
			const e = yield* LicenseException.parse("Classpath-exception-2.0");
			assert.strictEqual(e.id, "Classpath-exception-2.0");
			assert.isFalse(e.deprecated);
		}),
	);
	it.effect("fails typed on an unknown exception", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(LicenseException.parse("Not-An-Exception"));
			assert.isTrue(Exit.isFailure(exit));
			// the failure is the shared typed error, never a defect
			const error = yield* Effect.flip(LicenseException.parse("Not-An-Exception"));
			assert.instanceOf(error, InvalidSpdxExpressionError);
			assert.strictEqual(error._tag, "InvalidSpdxExpressionError");
			assert.strictEqual(error.input, "Not-An-Exception");
		}),
	);
	it.effect("rejects a LicenseRef-shaped id (exceptions require catalog membership)", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(LicenseException.parse("LicenseRef-Foo"));
			assert.strictEqual(result._tag, "Failure");
		}),
	);
	it("predicate reads the catalog", () => {
		assert.isTrue(LicenseException.isKnownId("Bison-exception-2.2"));
		assert.isFalse(LicenseException.isKnownId("Not-An-Exception"));
		assert.isFalse(LicenseException.isDeprecatedId("Classpath-exception-2.0"));
	});
	it("parseResult is the sync primitive", () => {
		assert.isTrue(Result.isSuccess(LicenseException.parseResult("Classpath-exception-2.0")));
		assert.isTrue(Result.isFailure(LicenseException.parseResult("Not-An-Exception")));
	});
	it("of constructs from typed parts", () => {
		const e = LicenseException.of("Classpath-exception-2.0");
		assert.strictEqual(e.id, "Classpath-exception-2.0");
		assert.isFalse(e.deprecated);
		const dep = LicenseException.of("Nokia-Qt-exception-1.1", true);
		assert.strictEqual(dep.id, "Nokia-Qt-exception-1.1");
		assert.isTrue(dep.deprecated);
	});
	it("reuses the shared error from License", () => {
		// same error class as License, not a parallel type
		const licErr = License.parseResult("NOT-A-LICENSE");
		const excErr = LicenseException.parseResult("Not-An-Exception");
		assert.isTrue(Result.isFailure(licErr));
		assert.isTrue(Result.isFailure(excErr));
		if (Result.isFailure(licErr) && Result.isFailure(excErr)) {
			assert.strictEqual(licErr.failure._tag, excErr.failure._tag);
		}
	});
});
