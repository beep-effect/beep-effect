import { assert, describe, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { CurrentDistribution, Distribution, DistributionField, distributionSuffix } from "../../effected/engine/index.ts";

describe("Distribution", () => {
	it("round-trips a plain { name, version } object", () => {
		const value = { name: "@okfit/plugin", version: "0.5.1" };
		const decoded = Schema.decodeSync(Distribution)(value);
		assert.deepStrictEqual(Schema.encodeSync(Distribution)(decoded), value);
	});

	it("DistributionField encodes a direct install as null", () => {
		assert.strictEqual(Schema.encodeSync(DistributionField)(null), null);
		assert.isNull(Schema.decodeSync(DistributionField)(null));
	});

	it("rejects a distribution missing its version", () => {
		assert.throws(() => Schema.decodeUnknownSync(Distribution)({ name: "@okfit/plugin" }));
	});
});

describe("CurrentDistribution", () => {
	it.effect("defaults to none when nothing provides it", () =>
		Effect.gen(function* () {
			const current = yield* CurrentDistribution;
			assert.isTrue(Option.isNone(current));
		}),
	);

	it.effect("reads back what main provided", () =>
		Effect.gen(function* () {
			const current = yield* CurrentDistribution;
			assert.deepStrictEqual(current, Option.some({ name: "@okfit/plugin", version: "0.5.1" }));
		}).pipe(Effect.provideService(CurrentDistribution, Option.some({ name: "@okfit/plugin", version: "0.5.1" }))),
	);
});

describe("distributionSuffix", () => {
	it("is empty for a direct install", () => {
		assert.strictEqual(distributionSuffix(Option.none()), "");
	});

	it("names the carrier when installed through one", () => {
		assert.strictEqual(
			distributionSuffix(Option.some({ name: "@okfit/plugin", version: "0.5.1" })),
			" via @okfit/plugin 0.5.1",
		);
	});
});
