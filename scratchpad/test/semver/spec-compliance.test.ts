import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { Range, SemVer } from "../../effected/semver/index.ts";
import {
	comparisonPairs,
	incrementTests,
	invalidVersions,
	rangeTests,
	validVersions,
} from "./spec-compliance.fixtures.ts";

describe("SemVer 2.0.0 spec compliance", () => {
	describe("valid versions", () => {
		it.effect.each(validVersions)("parses and round-trips %s", (input) =>
			Effect.gen(function* () {
				const version = yield* SemVer.parse(input);
				const roundtripped = yield* SemVer.parse(version.toString());
				assert.strictEqual(version.compare(roundtripped), 0);
				assert.deepStrictEqual([...roundtripped.build], [...version.build]);
			}),
		);
	});

	describe("invalid versions", () => {
		it.effect.each([...invalidVersions])("rejects $input ($reason)", (candidate) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(SemVer.parse(candidate.input));
				assert.strictEqual(error._tag, "InvalidVersionError");
			}),
		);
	});

	describe("precedence (§11)", () => {
		it.effect.each([...comparisonPairs])("%s < %s", ([lower, higher]) =>
			Effect.gen(function* () {
				const a = yield* SemVer.parse(lower);
				const b = yield* SemVer.parse(higher);
				assert.strictEqual(a.compare(b), -1);
				assert.strictEqual(b.compare(a), 1);
			}),
		);
	});
});

describe("range satisfaction", () => {
	it.effect.each([...rangeTests])("test(%s, %s) === %s", ([rangeStr, versionStr, expected]) =>
		Effect.gen(function* () {
			const range = yield* Range.parse(rangeStr);
			const version = yield* SemVer.parse(versionStr);
			assert.strictEqual(range.test(version), expected);
		}),
	);
});

describe("increment operations", () => {
	it.effect.each([...incrementTests])("%s bump %s => %s", ([initial, operation, expected]) =>
		Effect.gen(function* () {
			const version = yield* SemVer.parse(initial);
			assert.strictEqual(version.bump[operation]().toString(), expected);
		}),
	);
});

describe("build metadata (§10)", () => {
	it.effect("does not affect precedence", () =>
		Effect.gen(function* () {
			const a = yield* SemVer.parse("1.0.0+a");
			const b = yield* SemVer.parse("1.0.0+b");
			assert.strictEqual(a.compare(b), 0);
		}),
	);

	it.effect("does not affect range matching", () =>
		Effect.gen(function* () {
			const range = yield* Range.parse(">=1.0.0+different");
			assert.isTrue(range.test(yield* SemVer.parse("1.0.0+build")));
		}),
	);
});
