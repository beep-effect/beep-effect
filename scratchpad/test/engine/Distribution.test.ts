import { $ScratchpadId } from "@beep/identity/packages";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CurrentDistribution, Distribution, DistributionField, distributionSuffix } from "../../effected/engine/index.ts";

describe("Distribution", () => {
	it("round-trips a plain { name, version } object", () => {
		const value = { name: "@okfit/plugin", version: "0.5.1" };
		const decoded = Result.getOrThrowWith(S.decodeResult(Distribution)(value), (error) => error);
		assert.deepStrictEqual(Result.getOrThrowWith(S.encodeResult(Distribution)(decoded), (error) => error), value);
	});

	it("DistributionField encodes a direct install as null", () => {
		assert.strictEqual(Result.getOrThrowWith(S.encodeResult(DistributionField)(null), (error) => error), null);
		assert.isNull(Result.getOrThrowWith(S.decodeResult(DistributionField)(null), (error) => error));
	});

	it("DistributionField carries its own composed identity", () => {
		const $I = $ScratchpadId.create("effected/engine/Distribution");
		assert.deepStrictEqual(
			DistributionField.ast.annotations,
			$I.annote("DistributionField", {
				description:
					"The distribution field of a machine-readable envelope: null when the front end was installed directly rather than through a carrier.",
			}),
		);
		assert.notStrictEqual(DistributionField.ast.annotations?.identifier, Distribution.ast.annotations?.identifier);
	});

	it("DistributionField round-trips a carrier without changing its wire shape", () => {
		const value: DistributionField = { name: "@okfit/plugin", version: "0.5.1" };
		const decoded = Result.getOrThrowWith(S.decodeResult(DistributionField)(value), (error) => error);
		assert.deepStrictEqual(decoded, value);
		assert.deepStrictEqual(Result.getOrThrowWith(S.encodeResult(DistributionField)(decoded), (error) => error), value);
	});

	it("rejects a distribution missing its version", () => {
		assert.throws(() =>
			Result.getOrThrowWith(S.decodeUnknownResult(Distribution)({ name: "@okfit/plugin" }), (error) => error),
		);
	});
});

describe("CurrentDistribution", () => {
	it.effect("defaults to none when nothing provides it", () =>
		Effect.gen(function* () {
			const current = yield* CurrentDistribution;
			assertNone(current);
		}),
	);

	it.effect("reads back what main provided", () =>
		Effect.gen(function* () {
			const current = yield* CurrentDistribution;
			assertSome(current, { name: "@okfit/plugin", version: "0.5.1" });
		}).pipe(Effect.provideService(CurrentDistribution, O.some({ name: "@okfit/plugin", version: "0.5.1" }))),
	);
});

describe("distributionSuffix", () => {
	it("is empty for a direct install", () => {
		assert.strictEqual(distributionSuffix(O.none()), "");
	});

	it("names the carrier when installed through one", () => {
		assert.strictEqual(
			distributionSuffix(O.some({ name: "@okfit/plugin", version: "0.5.1" })),
			" via @okfit/plugin 0.5.1",
		);
	});
});
