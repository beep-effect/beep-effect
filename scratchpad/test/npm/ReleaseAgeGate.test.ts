import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PartialReleaseAgeGate, ReleaseAgeGate } from "../../effected/npm/index.ts";

describe("ReleaseAgeGate.combine", () => {
	it("returns the inert zero gate when nothing is contributed", () => {
		const gate = ReleaseAgeGate.combine();
		assert.strictEqual(gate.ageMinutes, 0);
		assert.deepStrictEqual(gate.exclude, []);
	});

	it("returns the zero gate when both contributions are absent (empty)", () => {
		const gate = ReleaseAgeGate.combine({}, {});
		assert.strictEqual(gate.ageMinutes, 0);
		assert.deepStrictEqual(gate.exclude, []);
	});

	it("carries a one-sided age contribution through", () => {
		const gate = ReleaseAgeGate.combine({ ageMinutes: 1440 }, {});
		assert.strictEqual(gate.ageMinutes, 1440);
		assert.deepStrictEqual(gate.exclude, []);
	});

	it("carries a one-sided exclude contribution through", () => {
		const gate = ReleaseAgeGate.combine({}, { exclude: ["@effect/*"] });
		assert.strictEqual(gate.ageMinutes, 0);
		assert.deepStrictEqual(gate.exclude, ["@effect/*"]);
	});

	it("takes the strictest (maximum) age", () => {
		const gate = ReleaseAgeGate.combine({ ageMinutes: 720 }, { ageMinutes: 1440 });
		assert.strictEqual(gate.ageMinutes, 1440);
	});

	it("clamps a negative contribution to zero", () => {
		const gate = ReleaseAgeGate.combine({ ageMinutes: -5 });
		assert.strictEqual(gate.ageMinutes, 0);
	});

	it("ignores non-finite contributions but keeps a finite one", () => {
		const gate = ReleaseAgeGate.combine({ ageMinutes: Number.NaN }, { ageMinutes: 100 });
		assert.strictEqual(gate.ageMinutes, 100);
	});

	it("falls back to the zero gate when every age is non-finite", () => {
		const gate = ReleaseAgeGate.combine({ ageMinutes: Number.POSITIVE_INFINITY }, { ageMinutes: Number.NaN });
		assert.strictEqual(gate.ageMinutes, 0);
	});

	it("unions and deduplicates the exclude sets in sorted order", () => {
		// Insertion order (c, b, a, d) differs from sorted order so a
		// regression back to insertion-order preservation fails this test.
		const gate = ReleaseAgeGate.combine({ exclude: ["c", "b"] }, { exclude: ["b", "a", "d"] });
		assert.deepStrictEqual(gate.exclude, ["a", "b", "c", "d"]);
	});

	it("returns the same sorted union regardless of contribution order", () => {
		const forward = ReleaseAgeGate.combine({ exclude: ["zeta", "@scope/*"] }, { exclude: ["alpha"] });
		const reversed = ReleaseAgeGate.combine({ exclude: ["alpha"] }, { exclude: ["zeta", "@scope/*"] });
		assert.deepStrictEqual(forward.exclude, ["@scope/*", "alpha", "zeta"]);
		assert.deepStrictEqual(forward.exclude, reversed.exclude);
	});

	it("combines age and exclude from many sources", () => {
		const gate = ReleaseAgeGate.combine(
			{ ageMinutes: 60, exclude: ["@other/*"] },
			{ ageMinutes: 1440 },
			{ exclude: ["@my/pkg", "@other/*"] },
		);
		assert.strictEqual(gate.ageMinutes, 1440);
		assert.deepStrictEqual(gate.exclude, ["@my/pkg", "@other/*"]);
	});
});

describe("ReleaseAgeGate.matchesExclude", () => {
	it("matches an exact package name", () => {
		assert.isTrue(ReleaseAgeGate.matchesExclude("prettier", ["prettier"]));
		assert.isFalse(ReleaseAgeGate.matchesExclude("prettier", ["eslint"]));
	});

	it("returns false against an empty pattern list", () => {
		assert.isFalse(ReleaseAgeGate.matchesExclude("prettier", []));
	});

	it("lets a bare `*` cross `/` and match a scoped name (pnpm parity)", () => {
		assert.isTrue(ReleaseAgeGate.matchesExclude("@scope/pkg", ["*"]));
		assert.isTrue(ReleaseAgeGate.matchesExclude("prettier", ["*"]));
	});

	it("matches every package in a scope with `@scope/*`", () => {
		assert.isTrue(ReleaseAgeGate.matchesExclude("@effect/vitest", ["@effect/*"]));
		assert.isTrue(ReleaseAgeGate.matchesExclude("@effect/platform", ["@effect/*"]));
		assert.isFalse(ReleaseAgeGate.matchesExclude("@effected/npm", ["@effect/*"]));
	});

	it("treats a mid-name `*` as any run of characters including `/`", () => {
		assert.isTrue(ReleaseAgeGate.matchesExclude("@effect/platform-node", ["@effect/platform*"]));
		assert.isTrue(ReleaseAgeGate.matchesExclude("@scope/a/b", ["@scope/*"]));
	});

	it("does not treat other glob metacharacters as wildcards", () => {
		// A `.` in the pattern is a literal dot, not a regex any-char.
		assert.isFalse(ReleaseAgeGate.matchesExclude("aXb", ["a.b"]));
		assert.isTrue(ReleaseAgeGate.matchesExclude("a.b", ["a.b"]));
	});

	it("matches if any pattern in the list matches", () => {
		assert.isTrue(ReleaseAgeGate.matchesExclude("prettier", ["eslint", "prettier"]));
	});
});

describe("ReleaseAgeGate#isExcluded", () => {
	it("checks the package name against the gate's own exclude list", () => {
		const gate = ReleaseAgeGate.make({ ageMinutes: 1440, exclude: ["@my/*"] });
		assert.isTrue(gate.isExcluded("@my/pkg"));
		assert.isFalse(gate.isExcluded("prettier"));
	});
});

describe("ReleaseAgeGate#filterVersions", () => {
	// Fixed clock: 2026-07-21T00:00:00Z.
	const now = Date.parse("2026-07-21T00:00:00Z");
	const day = 24 * 60; // minutes in a day

	it("drops versions younger than the cutoff", () => {
		const gate = ReleaseAgeGate.make({ ageMinutes: day, exclude: [] });
		const versions = ["1.0.0", "1.0.1"];
		const times = {
			"1.0.0": "2026-07-01T00:00:00Z", // old
			"1.0.1": "2026-07-20T23:00:00Z", // 1h old, younger than 1 day
		};
		assert.deepStrictEqual(gate.filterVersions(versions, times, "prettier", now), ["1.0.0"]);
	});

	it("keeps a version published exactly at the cutoff (boundary inclusive)", () => {
		const gate = ReleaseAgeGate.make({ ageMinutes: day, exclude: [] });
		const times = { "1.0.0": "2026-07-20T00:00:00Z" }; // exactly 1 day old
		assert.deepStrictEqual(gate.filterVersions(["1.0.0"], times, "prettier", now), ["1.0.0"]);
	});

	it("drops a version one millisecond younger than the cutoff", () => {
		const gate = ReleaseAgeGate.make({ ageMinutes: day, exclude: [] });
		const times = { "1.0.0": "2026-07-20T00:00:00.001Z" }; // 1ms too young
		assert.deepStrictEqual(gate.filterVersions(["1.0.0"], times, "prettier", now), []);
	});

	it("drops versions with a missing timestamp", () => {
		const gate = ReleaseAgeGate.make({ ageMinutes: day, exclude: [] });
		const times = { "1.0.0": "2026-07-01T00:00:00Z" }; // no entry for 1.0.1
		assert.deepStrictEqual(gate.filterVersions(["1.0.0", "1.0.1"], times, "prettier", now), ["1.0.0"]);
	});

	it("drops versions with an unparseable timestamp", () => {
		const gate = ReleaseAgeGate.make({ ageMinutes: day, exclude: [] });
		const times = { "1.0.0": "not-a-date", "1.0.1": "2026-07-01T00:00:00Z" };
		assert.deepStrictEqual(gate.filterVersions(["1.0.0", "1.0.1"], times, "prettier", now), ["1.0.1"]);
	});

	it("is a no-op (returns all versions) when the package is excluded", () => {
		const gate = ReleaseAgeGate.make({ ageMinutes: day, exclude: ["@my/*"] });
		const versions = ["1.0.0", "1.0.1"];
		const times = { "1.0.0": "2026-07-20T23:00:00Z", "1.0.1": "2026-07-20T23:59:00Z" };
		assert.deepStrictEqual(gate.filterVersions(versions, times, "@my/pkg", now), versions);
	});

	it("is a no-op when the age is zero", () => {
		const gate = ReleaseAgeGate.make({ ageMinutes: 0, exclude: [] });
		const versions = ["1.0.0", "1.0.1"];
		assert.deepStrictEqual(gate.filterVersions(versions, {}, "prettier", now), versions);
	});
});

describe("ReleaseAgeGate schema", () => {
	it.effect("decodes and re-encodes a gate round-trip", () =>
		Effect.gen(function* () {
			const input = { ageMinutes: 1440, exclude: ["@effect/*", "prettier"] };
			const gate = yield* S.decodeEffect(ReleaseAgeGate)(input);
			assert.instanceOf(gate, ReleaseAgeGate);
			assert.strictEqual(gate.ageMinutes, 1440);
			assert.deepStrictEqual(gate.exclude, ["@effect/*", "prettier"]);
			const encoded = yield* S.encodeUnknownEffect(ReleaseAgeGate)(gate);
			assert.deepStrictEqual(encoded, input);
		}),
	);

	it.effect("rejects a negative age", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(S.decodeEffect(ReleaseAgeGate)({ ageMinutes: -1, exclude: [] }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects a non-finite age", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				S.decodeEffect(ReleaseAgeGate)({ ageMinutes: Number.POSITIVE_INFINITY, exclude: [] }),
			);
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});

describe("PartialReleaseAgeGate schema", () => {
	it.effect("decodes an empty contribution", () =>
		Effect.gen(function* () {
			const partial = yield* S.decodeEffect(PartialReleaseAgeGate)({});
			assert.deepStrictEqual(partial, {});
		}),
	);

	it.effect("decodes and re-encodes a full contribution round-trip", () =>
		Effect.gen(function* () {
			const input = { ageMinutes: 720, exclude: ["a", "b"] };
			const partial = yield* S.decodeEffect(PartialReleaseAgeGate)(input);
			assert.deepStrictEqual(partial, input);
			const encoded = yield* S.encodeUnknownEffect(PartialReleaseAgeGate)(partial);
			assert.deepStrictEqual(encoded, input);
		}),
	);

	it.effect("tolerates a negative age (the clamp lives in combine, not the schema)", () =>
		Effect.gen(function* () {
			const partial = yield* S.decodeEffect(PartialReleaseAgeGate)({ ageMinutes: -10 });
			assert.strictEqual(partial.ageMinutes, -10);
		}),
	);
});
