import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { InvalidSpdxLicenseError, SpdxLicense, isValidSpdx, licenseExpressionOf } from "../../effected/package-json/License.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

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
	it("preserves schema identity and the reusable SPDX check annotations", () => {
		const $I = $ScratchpadId.create("effected/package-json/License");
		assert.include(S.resolveAnnotations(SpdxLicense), $I.annote("SpdxLicense"));
		const group = SpdxLicense.ast.checks?.[0];
		assertTrue(group?._tag === "FilterGroup");
		assert.deepStrictEqual(group.checks[0].annotations, {
			identifier: $I`SpdxLicenseCheck`,
			title: "Manifest SPDX License",
			description: "A valid SPDX license identifier or expression, UNLICENSED, or SEE LICENSE IN followed by a filename.",
		});
	});
	it.effect("keeps accepted spellings, encoded bytes and the SPDX failure message", () =>
		Effect.gen(function* () {
			for (const value of ["MIT", "(MIT OR Apache-2.0)", "UNLICENSED", "SEE LICENSE IN LICENSE.txt"]) {
				const decoded = yield* S.decodeEffect(SpdxLicense)(value);
				assert.strictEqual(yield* S.encodeEffect(SpdxLicense)(decoded), value);
			}
			for (const value of ["NOT-A-LICENSE", "SEE LICENSE IN ", ""]) {
				const error = yield* Effect.flip(S.decodeEffect(SpdxLicense)(value));
				assert.include(error.message, "Expected a valid SPDX license expression");
			}
		}),
	);

	it.effect("decodes a valid license and rejects an invalid one", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* S.decodeEffect(SpdxLicense)("MIT"), "MIT");
			const error = yield* Effect.flip(S.decodeEffect(SpdxLicense)("NOT-A-LICENSE"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});

describe("InvalidSpdxLicenseError", () => {
	it("renders a message", () => {
		const error = InvalidSpdxLicenseError.make({ input: "NOT-A-LICENSE" });
		assert.strictEqual(error._tag, "InvalidSpdxLicenseError");
		assert.include(error.message, "NOT-A-LICENSE");
	});
});

describe("licenseExpressionOf — the brand/grammar seam", () => {
	const brand = (value: string): SpdxLicense => {
		assertTrue(S.is(SpdxLicense)(value));
		return value;
	};

	it("parses an ordinary identifier", () => {
		const expr = licenseExpressionOf(brand("MIT"));
		const present = O.isSome(expr);
		assertTrue(present);
		assert.strictEqual(String(expr.value), "MIT");
	});

	it("parses a compound expression", () => {
		const expr = licenseExpressionOf(brand("MIT OR Apache-2.0"));
		const present = O.isSome(expr);
		assertTrue(present);
		// SpdxExpression round-trips fully parenthesized; that is canonical here.
		assert.strictEqual(String(expr.value), "(MIT OR Apache-2.0)");
	});

	it("UNLICENSED is a legal manifest value and not an expression", () => {
		// The whole reason this accessor exists: the brand admits it, the
		// grammar does not, and every consumer was hand-rolling this screen.
		assertNone(licenseExpressionOf(brand("UNLICENSED")));
	});

	it("SEE LICENSE IN <file> is likewise legal and not an expression", () => {
		assertNone(licenseExpressionOf(brand("SEE LICENSE IN LICENSE.txt")));
		assertNone(licenseExpressionOf(brand("SEE LICENSE IN vendor/terms.md")));
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
			assert.strictEqual(O.isNone(expr), isSpecial, `${value}: none iff a non-SPDX spelling`);
		}
	});

	it("a LicenseRef parses — it is grammatical, unlike the two npm spellings", () => {
		const expr = licenseExpressionOf(brand("LicenseRef-Acme"));
		const present = O.isSome(expr);
		assertTrue(present);
	});

	it("an unparseable string the brand would reject yields none rather than throwing", () => {
		// Total by construction: a caller holding an unbranded cast still gets
		// an answer instead of a defect.
		assertNone(licenseExpressionOf(deliberatelyInvalid<SpdxLicense>("MIT AND")));
	});
});
import { $ScratchpadId } from "@beep/identity/packages";
