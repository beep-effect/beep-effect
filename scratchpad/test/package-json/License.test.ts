import { assert, describe, it } from "@effect/vitest";
import type { SpdxExpression } from "../../effected/spdx/index.ts";
import { Effect, Option, Schema } from "effect";
import { InvalidSpdxLicenseError, SpdxLicense, isValidSpdx, licenseExpressionOf } from "../../effected/package-json/License.ts";

describe("isValidSpdx", () => {
	it("accepts identifiers, expressions and npm special cases", () => {
		for (const value of ["MIT", "Apache-2.0", "(MIT OR Apache-2.0)", "UNLICENSED", "SEE LICENSE IN LICENSE.txt"]) {
			assert.isTrue(isValidSpdx(value), value);
		}
	});

	it("rejects nonsense and bare SEE LICENSE IN", () => {
		for (const value of ["NOT-A-LICENSE", "totally made up", "SEE LICENSE IN "]) {
			assert.isFalse(isValidSpdx(value), value);
		}
	});
});

describe("SpdxLicense schema", () => {
	it.effect("decodes a valid license and rejects an invalid one", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* Schema.decodeUnknownEffect(SpdxLicense)("MIT"), "MIT");
			const error = yield* Effect.flip(Schema.decodeUnknownEffect(SpdxLicense)("NOT-A-LICENSE"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});

describe("InvalidSpdxLicenseError", () => {
	it("renders a message", () => {
		const error = new InvalidSpdxLicenseError({ input: "NOT-A-LICENSE" });
		assert.strictEqual(error._tag, "InvalidSpdxLicenseError");
		assert.include(error.message, "NOT-A-LICENSE");
	});
});

describe("licenseExpressionOf — the brand/grammar seam", () => {
	const brand = (value: string) => value as SpdxLicense;

	it("parses an ordinary identifier", () => {
		const expr = licenseExpressionOf(brand("MIT"));
		assert.isTrue(Option.isSome(expr));
		assert.strictEqual(String((expr as Option.Some<SpdxExpression>).value), "MIT");
	});

	it("parses a compound expression", () => {
		const expr = licenseExpressionOf(brand("MIT OR Apache-2.0"));
		assert.isTrue(Option.isSome(expr));
		// SpdxExpression round-trips fully parenthesized; that is canonical here.
		assert.strictEqual(String((expr as Option.Some<SpdxExpression>).value), "(MIT OR Apache-2.0)");
	});

	it("UNLICENSED is a legal manifest value and not an expression", () => {
		// The whole reason this accessor exists: the brand admits it, the
		// grammar does not, and every consumer was hand-rolling this screen.
		assert.isTrue(Option.isNone(licenseExpressionOf(brand("UNLICENSED"))));
	});

	it("SEE LICENSE IN <file> is likewise legal and not an expression", () => {
		assert.isTrue(Option.isNone(licenseExpressionOf(brand("SEE LICENSE IN LICENSE.txt"))));
		assert.isTrue(Option.isNone(licenseExpressionOf(brand("SEE LICENSE IN vendor/terms.md"))));
	});

	it("agrees with the brand: everything isValidSpdx admits either parses or is one of the two", () => {
		// Pins the seam itself rather than a sample. If npm gains a third
		// special case and `isValidSpdx` is widened without widening this
		// accessor, the two drift and this test is what notices.
		for (const value of [
			"MIT",
			"Apache-2.0",
			"(MIT OR Apache-2.0)",
			"GPL-2.0-only WITH Bison-exception-2.2",
			"LicenseRef-Acme",
			"UNLICENSED",
			"SEE LICENSE IN LICENSE.txt",
		]) {
			assert.isTrue(isValidSpdx(value), `isValidSpdx should admit ${value}`);
			const expr = licenseExpressionOf(brand(value));
			const isSpecial = value === "UNLICENSED" || value.startsWith("SEE LICENSE IN ");
			assert.strictEqual(Option.isNone(expr), isSpecial, `${value}: none iff a non-SPDX spelling`);
		}
	});

	it("a LicenseRef parses — it is grammatical, unlike the two npm spellings", () => {
		const expr = licenseExpressionOf(brand("LicenseRef-Acme"));
		assert.isTrue(Option.isSome(expr));
	});

	it("an unparseable string the brand would reject yields none rather than throwing", () => {
		// Total by construction: a caller holding an unbranded cast still gets
		// an answer instead of a defect.
		assert.isTrue(Option.isNone(licenseExpressionOf(brand("MIT AND"))));
	});
});
