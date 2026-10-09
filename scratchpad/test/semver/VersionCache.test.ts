import { assert, describe, layer } from "@effect/vitest";
import { Effect, Equal, Option } from "effect";
import {
	EmptyCacheError,
	Range,
	SemVer,
	UnsatisfiedRangeError,
	VersionCache,
	VersionNotFoundError,
} from "../../effected/semver/index.ts";

// One memoized layer for the whole group; each test loads its own state
// (load replaces the cache contents) instead of re-providing per test.
layer(VersionCache.layer)("VersionCache", (it) => {
	describe("mutation and query", () => {
		it.effect("load replaces contents, sorted and deduplicated by precedence", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([
					SemVer.of(2, 0, 0),
					SemVer.of(1, 0, 0),
					SemVer.of(1, 5, 0),
					SemVer.of(1, 5, 0, [], ["build"]),
				]);
				const versions = yield* cache.versions();
				assert.deepStrictEqual(versions.map(String), ["1.0.0", "1.5.0", "2.0.0"]);
			}),
		);

		it.effect("add inserts in order and ignores build-metadata duplicates", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(2, 0, 0)]);
				yield* cache.add(SemVer.of(1, 5, 0));
				yield* cache.add(SemVer.of(1, 5, 0, [], ["other"]));
				assert.deepStrictEqual((yield* cache.versions()).map(String), ["1.0.0", "1.5.0", "2.0.0"]);
			}),
		);

		it.effect("remove drops the precedence-equal version", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(1, 5, 0)]);
				yield* cache.remove(SemVer.of(1, 5, 0, [], ["build"]));
				assert.deepStrictEqual((yield* cache.versions()).map(String), ["1.0.0"]);
			}),
		);

		it.effect("versions returns [] on an empty cache without failing", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([]);
				assert.deepStrictEqual(yield* cache.versions(), []);
			}),
		);

		it.effect("latest and oldest fail EmptyCacheError on an empty cache", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([]);
				const error = yield* Effect.flip(cache.latest());
				assert.instanceOf(error, EmptyCacheError);
				assert.strictEqual(error.message, "Version cache is empty");
				const error2 = yield* Effect.flip(cache.oldest());
				assert.strictEqual(error2._tag, "EmptyCacheError");
			}),
		);

		it.effect("latest and oldest return the extremes", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(3, 0, 0), SemVer.of(2, 0, 0)]);
				assert.strictEqual(String(yield* cache.latest()), "3.0.0");
				assert.strictEqual(String(yield* cache.oldest()), "1.0.0");
			}),
		);
	});

	describe("resolution", () => {
		it.effect("resolve returns the highest satisfying version", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(1, 5, 0), SemVer.of(1, 9, 0), SemVer.of(2, 0, 0)]);
				const range = yield* Range.parse("^1.0.0");
				assert.strictEqual(String(yield* cache.resolve(range)), "1.9.0");
			}),
		);

		it.effect("resolve fails UnsatisfiedRangeError with range and available versions", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0)]);
				const range = yield* Range.parse(">=2.0.0");
				const error = yield* Effect.flip(cache.resolve(range));
				assert.instanceOf(error, UnsatisfiedRangeError);
				assert.strictEqual(error.range.toString(), ">=2.0.0");
				assert.deepStrictEqual(error.available.map(String), ["1.0.0"]);
				assert.strictEqual(error.message, "No version satisfies range >=2.0.0 (1 version available)");
			}),
		);

		it.effect("resolveString parses then resolves, surfacing both failure modes", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 2, 0)]);
				assert.strictEqual(String(yield* cache.resolveString("^1.0.0")), "1.2.0");
				const parseError = yield* Effect.flip(cache.resolveString("not a range!"));
				assert.strictEqual(parseError._tag, "InvalidRangeError");
				const matchError = yield* Effect.flip(cache.resolveString("^9.0.0"));
				assert.strictEqual(matchError._tag, "UnsatisfiedRangeError");
			}),
		);

		it.effect("filter returns [] uniformly for empty cache and no matches", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				const range = yield* Range.parse("^1.0.0");
				yield* cache.load([]);
				assert.deepStrictEqual(yield* cache.filter(range), []);
				yield* cache.load([SemVer.of(2, 0, 0)]);
				assert.deepStrictEqual(yield* cache.filter(range), []);
				yield* cache.add(SemVer.of(1, 1, 0));
				assert.deepStrictEqual((yield* cache.filter(range)).map(String), ["1.1.0"]);
			}),
		);
	});

	describe("navigation", () => {
		it.effect("diff computes between cached versions", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(2, 0, 0)]);
				const diff = yield* cache.diff(SemVer.of(1, 0, 0), SemVer.of(2, 0, 0));
				assert.strictEqual(diff.type, "major");
			}),
		);

		it.effect("diff fails VersionNotFoundError for uncached versions", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0)]);
				const error = yield* Effect.flip(cache.diff(SemVer.of(1, 0, 0), SemVer.of(9, 9, 9)));
				assert.instanceOf(error, VersionNotFoundError);
				assert.strictEqual(error.message, "Version not found in cache: 9.9.9");
				assert.isTrue(Equal.equals(error.version, SemVer.of(9, 9, 9)));
			}),
		);

		it.effect("next/prev return Option neighbours and fail for uncached pivots", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(2, 0, 0), SemVer.of(3, 0, 0)]);
				assert.deepStrictEqual((yield* cache.next(SemVer.of(2, 0, 0))).pipe(Option.map(String)), Option.some("3.0.0"));
				assert.deepStrictEqual((yield* cache.prev(SemVer.of(2, 0, 0))).pipe(Option.map(String)), Option.some("1.0.0"));
				assert.isTrue(Option.isNone(yield* cache.next(SemVer.of(3, 0, 0))));
				assert.isTrue(Option.isNone(yield* cache.prev(SemVer.of(1, 0, 0))));
				const error = yield* Effect.flip(cache.next(SemVer.of(9, 9, 9)));
				assert.strictEqual(error._tag, "VersionNotFoundError");
			}),
		);
	});
});
