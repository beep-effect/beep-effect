import { assert, describe, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
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
layer(VersionCache.layer, { timeout: "30 seconds" })("VersionCache", (it) => {
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
				const versions = yield* cache.versions;
				assert.deepStrictEqual(versions.map(String), ["1.0.0", "1.5.0", "2.0.0"]);
			}),
		);

		it.effect("add inserts in order and ignores build-metadata duplicates", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(2, 0, 0)]);
				yield* cache.add(SemVer.of(1, 5, 0));
				yield* cache.add(SemVer.of(1, 5, 0, [], ["other"]));
				assert.deepStrictEqual((yield* cache.versions).map(String), ["1.0.0", "1.5.0", "2.0.0"]);
			}),
		);

		it.effect("remove drops the precedence-equal version", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(1, 5, 0)]);
				yield* cache.remove(SemVer.of(1, 5, 0, [], ["build"]));
				assert.deepStrictEqual((yield* cache.versions).map(String), ["1.0.0"]);
			}),
		);

		it.effect("versions returns [] on an empty cache without failing", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([]);
				assert.deepStrictEqual(yield* cache.versions, []);
			}),
		);

		it.effect("latest and oldest fail EmptyCacheError on an empty cache", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([]);
				const error = yield* Effect.flip(cache.latest);
				assert.instanceOf(error, EmptyCacheError);
				assert.strictEqual(error.message, "Version cache is empty");
				const error2 = yield* Effect.flip(cache.oldest);
				assert.strictEqual(error2._tag, "EmptyCacheError");
			}),
		);

		it.effect("latest and oldest return the extremes", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(3, 0, 0), SemVer.of(2, 0, 0)]);
				assert.strictEqual(String(yield* cache.latest), "3.0.0");
				assert.strictEqual(String(yield* cache.oldest), "1.0.0");
			}),
		);

		it.effect("query effects read current state on every execution", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				const { versions, latest, oldest } = cache;
				yield* cache.load([SemVer.of(2, 0, 0)]);
				assert.deepStrictEqual((yield* versions).map(String), ["2.0.0"]);
				assert.strictEqual(String(yield* latest), "2.0.0");
				assert.strictEqual(String(yield* oldest), "2.0.0");
				yield* cache.add(SemVer.of(1, 0, 0));
				yield* cache.add(SemVer.of(3, 0, 0));
				assert.deepStrictEqual((yield* versions).map(String), ["1.0.0", "2.0.0", "3.0.0"]);
				assert.strictEqual(String(yield* latest), "3.0.0");
				assert.strictEqual(String(yield* oldest), "1.0.0");
				yield* cache.remove(SemVer.of(1, 0, 0));
				yield* cache.remove(SemVer.of(3, 0, 0));
				assert.deepStrictEqual((yield* versions).map(String), ["2.0.0"]);
				assert.strictEqual(String(yield* latest), "2.0.0");
				assert.strictEqual(String(yield* oldest), "2.0.0");
				yield* cache.load([]);
				assert.deepStrictEqual(yield* versions, []);
				assert.strictEqual((yield* Effect.flip(latest))._tag, "EmptyCacheError");
				assert.strictEqual((yield* Effect.flip(oldest))._tag, "EmptyCacheError");
			}),
		);
	});

	describe("resolution", () => {
		it.effect("resolveString rejects partial upper boundary prereleases despite lower tuple permission", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				for (const [upper, tuple] of [["1.x", "1.0.0"], ["1", "1.0.0"], ["1.2.x", "1.2.0"], ["1.2", "1.2.0"]] as const) {
					const versions = yield* Effect.forEach(["0.9.9", `${tuple}-0`, `${tuple}-alpha`, `${tuple}-beta`, tuple, "2.0.0"], SemVer.parse);
					yield* cache.load(versions);
					const error = yield* Effect.flip(cache.resolveString(`>=${tuple}-alpha <${upper}`));
					assert.instanceOf(error, UnsatisfiedRangeError);
					assert.strictEqual(error.range.toString(), `>=${tuple}-alpha <${tuple}-0`);
					assert.deepStrictEqual(error.available, versions);
					assert.strictEqual((yield* cache.resolveString(`>=${tuple}-alpha <${tuple}`)).toString(), `${tuple}-beta`);
				}
			}),
		);

		it.effect("resolveString treats wildcard-major tilde and caret as stable wildcards", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([
					SemVer.of(0, 5, 0), SemVer.of(1, 0, 0), SemVer.of(2, 0, 0), SemVer.of(9, 0, 0),
					SemVer.of(10, 0, 0, ["beta"]),
				]);
				for (const input of ["~*", "~x", "^*", "^x"]) {
					assert.strictEqual((yield* cache.resolveString(input)).toString(), "9.0.0");
				}
				yield* cache.load([SemVer.of(0, 0, 0, [0]), SemVer.of(10, 0, 0, ["beta"])]);
				for (const input of ["~*", "~x", "^*", "^x"]) {
					const error = yield* Effect.flip(cache.resolveString(input));
					assert.instanceOf(error, UnsatisfiedRangeError);
					assert.strictEqual(error._tag, "UnsatisfiedRangeError");
					assert.strictEqual(error.range.toString(), ">=0.0.0");
				}
			}),
		);

		it.effect("resolveString rejects strict comparisons against full wildcards", () =>
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				const versions = [SemVer.of(0, 0, 0, [0]), SemVer.of(0, 0, 0), SemVer.of(1, 0, 0, ["beta"]), SemVer.of(2, 0, 0)];
				yield* cache.load(versions);
				for (const input of [">*", ">x", "<*", "<x"]) {
					const error = yield* Effect.flip(cache.resolveString(input));
					assert.instanceOf(error, UnsatisfiedRangeError);
					assert.strictEqual(error._tag, "UnsatisfiedRangeError");
					assert.strictEqual(error.range.toString(), "<0.0.0-0");
					assert.deepStrictEqual(error.available, versions);
				}
			}),
		);

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
				assertSome((yield* cache.next(SemVer.of(2, 0, 0))).pipe(O.map(String)), "3.0.0");
				assertSome((yield* cache.prev(SemVer.of(2, 0, 0))).pipe(O.map(String)), "1.0.0");
				assertNone(yield* cache.next(SemVer.of(3, 0, 0)));
				assertNone(yield* cache.prev(SemVer.of(1, 0, 0)));
				const error = yield* Effect.flip(cache.next(SemVer.of(9, 9, 9)));
				assert.strictEqual(error._tag, "VersionNotFoundError");
			}),
		);
	});
});
