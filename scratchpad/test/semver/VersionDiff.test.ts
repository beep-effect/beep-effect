import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SemVer, VersionDiff } from "../../effected/semver/index.ts";

describe("VersionDiff", () => {
	describe("between", () => {
		it("classifies by the highest-precedence differing field", () => {
			assert.strictEqual(VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(2, 0, 0)).type, "major");
			assert.strictEqual(VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(1, 3, 0)).type, "minor");
			assert.strictEqual(VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(1, 2, 4)).type, "patch");
			assert.strictEqual(
				VersionDiff.between(SemVer.of(1, 2, 3, ["alpha"]), SemVer.of(1, 2, 3, ["beta"])).type,
				"prerelease",
			);
			assert.strictEqual(
				VersionDiff.between(SemVer.of(1, 2, 3, [], ["a"]), SemVer.of(1, 2, 3, [], ["b"])).type,
				"build",
			);
			assert.strictEqual(VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(1, 2, 3)).type, "none");
		});

		it("carries signed numeric deltas and the original versions", () => {
			const diff = VersionDiff.between(SemVer.of(2, 5, 1), SemVer.of(1, 0, 0));
			assert.strictEqual(diff.major, -1);
			assert.strictEqual(diff.minor, -5);
			assert.strictEqual(diff.patch, -1);
			assert.strictEqual(diff.from.toString(), "2.5.1");
			assert.strictEqual(diff.to.toString(), "1.0.0");
		});
	});

	describe("schema", () => {
		it.effect("round-trips through its encoded form with the tag preserved", () =>
			Effect.gen(function* () {
				const diff = VersionDiff.between(SemVer.of(1, 0, 0), SemVer.of(2, 0, 0));
				const encoded = yield* S.encodeUnknownEffect(VersionDiff)(diff);
				const decoded = yield* S.decodeEffect(VersionDiff)(encoded);
				assert.strictEqual(decoded._tag, "VersionDiff");
				assert.strictEqual(decoded.type, "major");
				assert.instanceOf(decoded.from, SemVer);
			}),
		);
	});

	describe("toString", () => {
		it("prints a readable summary", () => {
			assert.strictEqual(
				VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(2, 0, 0)).toString(),
				"major (1.2.3 → 2.0.0)",
			);
		});
	});
});
