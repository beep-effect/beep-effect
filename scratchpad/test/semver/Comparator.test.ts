import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Comparator, InvalidComparatorError, SemVer } from "../../effected/semver/index.ts";

describe("Comparator", () => {
	describe("parse", () => {
		it.effect("parses operator and version", () =>
			Effect.gen(function* () {
				const c = yield* Comparator.parse(">=1.2.3");
				assert.strictEqual(c.operator, ">=");
				assert.strictEqual(c.version.toString(), "1.2.3");
			}),
		);

		it.effect("defaults to = when no operator is given", () =>
			Effect.gen(function* () {
				const c = yield* Comparator.parse("1.2.3");
				assert.strictEqual(c.operator, "=");
			}),
		);

		it.effect("rejects wildcards and range sugar", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Comparator.parse(">=1.x"));
				assert.instanceOf(error, InvalidComparatorError);
				assert.strictEqual(error._tag, "InvalidComparatorError");
				assert.strictEqual(error.input, ">=1.x");
			}),
		);

		it.effect("rejects doubled operators", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Comparator.parse(">>1.0.0"));
				assert.strictEqual(error._tag, "InvalidComparatorError");
			}),
		);
	});

	describe("FromString", () => {
		it.effect("decodes and encodes canonically", () =>
			Effect.gen(function* () {
				const c = yield* S.decodeEffect(Comparator.FromString)("<=2.0.0");
				assert.instanceOf(c, Comparator);
				const encoded = yield* S.encodeUnknownEffect(Comparator.FromString)(c);
				assert.strictEqual(encoded, "<=2.0.0");
			}),
		);

		it.effect.prop("round-trips decode(encode(c))", [Comparator], ([c]) =>
			Effect.gen(function* () {
				const encoded = yield* S.encodeUnknownEffect(Comparator.FromString)(c);
				const decoded = yield* S.decodeEffect(Comparator.FromString)(encoded);
				assert.isTrue(Equal.equals(decoded, c), `expected ${decoded.toString()} to equal ${c.toString()}`);
				assert.deepStrictEqual([...decoded.version.build], [...c.version.build]);
			}),
		);
	});

	describe("test", () => {
		it.effect("evaluates every operator against SemVer precedence", () =>
			Effect.gen(function* () {
				const v = yield* SemVer.parse("1.5.0");
				assert.isTrue((yield* Comparator.parse(">=1.0.0")).test(v));
				assert.isTrue((yield* Comparator.parse(">1.0.0")).test(v));
				assert.isTrue((yield* Comparator.parse("<2.0.0")).test(v));
				assert.isTrue((yield* Comparator.parse("<=1.5.0")).test(v));
				assert.isTrue((yield* Comparator.parse("1.5.0")).test(v));
				assert.isFalse((yield* Comparator.parse(">2.0.0")).test(v));
				assert.isFalse((yield* Comparator.parse("=1.0.0")).test(v));
			}),
		);

		it.effect("ignores build metadata when matching", () =>
			Effect.gen(function* () {
				const c = yield* Comparator.parse("1.5.0+abc");
				assert.isTrue(c.test(yield* SemVer.parse("1.5.0+xyz")));
			}),
		);
	});

	describe("toString", () => {
		it.effect("prints the operator with = implicit", () =>
			Effect.gen(function* () {
				assert.strictEqual((yield* Comparator.parse(">=1.2.3")).toString(), ">=1.2.3");
				assert.strictEqual((yield* Comparator.parse("=1.2.3")).toString(), "1.2.3");
				assert.strictEqual((yield* Comparator.parse("1.2.3")).toString(), "1.2.3");
			}),
		);
	});

	// `parseResult` is the primitive; `parse` derives from it via
	// `Effect.fromResult` and adds only the tracing span. Both directions are
	// asserted per row so the two forms cannot drift.
	describe("Result parity", () => {
		const rows: ReadonlyArray<readonly [label: string, input: string]> = [
			["an implicit equals", "1.2.3"],
			["an explicit equals", "=1.2.3"],
			["greater-or-equal", ">=1.2.3"],
			["strictly less", "<1.2.3"],
			["a prerelease operand", ">=1.2.3-rc.1"],
			["an unknown operator", "~>1.2.3"],
			["a missing operand", ">="],
			["the empty string", ""],
		];

		for (const [label, input] of rows) {
			it.effect(`parse and parseResult agree on ${label}`, () =>
				Effect.gen(function* () {
					const viaEffect = yield* Effect.result(Comparator.parse(input));
					assert.deepStrictEqual(Comparator.parseResult(input), viaEffect);
				}),
			);
		}

		it("parseResult succeeds with a real Comparator", () => {
			const result = Comparator.parseResult(">=1.2.3");
			if (Result.isFailure(result)) {
				return assert.fail("expected a successful parse");
			}
			assert.instanceOf(result.success, Comparator);
			assert.strictEqual(result.success.operator, ">=");
			assert.strictEqual(result.success.version.toString(), "1.2.3");
		});

		it("parseResult carries the typed failure, not a throw", () => {
			const result = Comparator.parseResult("~>1.2.3");
			if (Result.isSuccess(result)) {
				return assert.fail("expected a typed parse failure");
			}
			assert.instanceOf(result.failure, InvalidComparatorError);
			assert.strictEqual(result.failure.input, "~>1.2.3");
		});
	});
});
