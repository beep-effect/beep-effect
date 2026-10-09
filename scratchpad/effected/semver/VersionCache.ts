import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import type { InvalidRangeError } from "./Range.ts";
import { Range } from "./Range.ts";
import { SemVer } from "./SemVer.ts";
import { VersionDiff } from "./VersionDiff.ts";

const $I = $ScratchpadId.create("effected/semver/VersionCache");

/**
 * Indicates that an extremum (`latest`/`oldest`) was requested from an empty
 * cache.
 *
 * @public
 */
export class EmptyCacheError extends S.TaggedError<EmptyCacheError>($I`EmptyCacheError`)("EmptyCacheError", {}, $I.annote("EmptyCacheError", { description: "Indicates that an extremum (`latest`/`oldest`) was requested from an empty cache." })) {
	override get message(): string {
		return "Version cache is empty";
	}
}

/**
 * Indicates that a navigation operation (`diff`/`next`/`prev`) referenced a
 * version that is not in the cache.
 *
 * @public
 */
export class VersionNotFoundError extends S.TaggedError<VersionNotFoundError>($I`VersionNotFoundError`)("VersionNotFoundError", {
	/** The version that was not found. */
	version: SemVer.annotateKey({ description: "The version that was not found." }),
}, $I.annote("VersionNotFoundError", { description: "Indicates that a navigation operation (`diff`/`next`/`prev`) referenced a version that is not in the cache." })) {
	override get message(): string {
		return `Version not found in cache: ${this.version.toString()}`;
	}
}

/**
 * Indicates that the cache contains versions but none satisfies the
 * requested range. Carries the range and the versions that were available,
 * and is fully serializable — both payload fields are schema classes.
 *
 * @public
 */
export class UnsatisfiedRangeError extends S.TaggedError<UnsatisfiedRangeError>($I`UnsatisfiedRangeError`)("UnsatisfiedRangeError", {
	/** The range that could not be satisfied. */
	range: Range.annotateKey({ description: "The range that could not be satisfied." }),
	/** The versions that were available for matching. */
	available: S.Array(SemVer).annotateKey({ description: "The versions that were available for matching." }),
}, $I.annote("UnsatisfiedRangeError", { description: "Indicates that the cache contains versions but none satisfies the requested range. Carries the range and the versions that were available, and is fully serializable — both payload fields are schema classes." })) {
	override get message(): string {
		const count = this.available.length;
		return `No version satisfies range ${this.range.toString()} (${count} version${count === 1 ? "" : "s"} available)`;
	}
}

/**
 * Operations of the {@link VersionCache} service.
 *
 * Queries read the current state on execution; whole-cache queries (`versions`,
 * `filter`) never fail and return `[]` when nothing matches, while
 * extremum and navigation operations fail typed. `next`/`prev` layer two
 * different absences deliberately: the error channel means "the pivot
 * version is not cached", `Option.none()` means "the pivot is at the
 * boundary".
 *
 * @public
 */
export interface VersionCacheShape {
	/** Replace all cached versions with the given array. */
	readonly load: (versions: ReadonlyArray<SemVer>) => Effect.Effect<void>;
	/** Add a single version to the cache. */
	readonly add: (version: SemVer) => Effect.Effect<void>;
	/** Remove a single version from the cache. */
	readonly remove: (version: SemVer) => Effect.Effect<void>;
	/** All cached versions in ascending order; `[]` when empty. */
	readonly versions: Effect.Effect<ReadonlyArray<SemVer>>;
	/** The highest cached version. Fails with {@link EmptyCacheError} when empty. */
	readonly latest: Effect.Effect<SemVer, EmptyCacheError>;
	/** The lowest cached version. Fails with {@link EmptyCacheError} when empty. */
	readonly oldest: Effect.Effect<SemVer, EmptyCacheError>;
	/** The highest cached version satisfying a range. Fails with {@link UnsatisfiedRangeError} when none match. */
	readonly resolve: (range: Range) => Effect.Effect<SemVer, UnsatisfiedRangeError>;
	/**
	 * Parse a range expression and resolve it. Fails with
	 * {@link InvalidRangeError} when `input` does not parse, or
	 * {@link UnsatisfiedRangeError} when it parses but nothing matches.
	 */
	readonly resolveString: (input: string) => Effect.Effect<SemVer, InvalidRangeError | UnsatisfiedRangeError>;
	/** All cached versions satisfying a range; `[]` when empty or none match. */
	readonly filter: (range: Range) => Effect.Effect<ReadonlyArray<SemVer>>;
	/** Diff two cached versions. Fails with {@link VersionNotFoundError} when either is missing. */
	readonly diff: (a: SemVer, b: SemVer) => Effect.Effect<VersionDiff, VersionNotFoundError>;
	/** The next higher cached version, `Option.none()` at the upper boundary. */
	readonly next: (version: SemVer) => Effect.Effect<O.Option<SemVer>, VersionNotFoundError>;
	/** The next lower cached version, `Option.none()` at the lower boundary. */
	readonly prev: (version: SemVer) => Effect.Effect<O.Option<SemVer>, VersionNotFoundError>;
}

// Membership and ordering follow SemVer precedence (build metadata ignored):
// versions differing only in build metadata occupy one slot.

const search = (arr: ReadonlyArray<SemVer>, target: SemVer): { readonly found: boolean; readonly index: number } => {
	let lo = 0;
	let hi = arr.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >>> 1;
		const cmp = A.getUnsafe(arr, mid).compare(target);
		if (cmp === 0) return { found: true, index: mid };
		if (cmp < 0) lo = mid + 1;
		else hi = mid - 1;
	}
	return { found: false, index: lo };
};

const dedupeSorted = (versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> => {
	const sorted = SemVer.sort(versions);
	return sorted.filter((v, i) => i === 0 || v.neq(A.getUnsafe(sorted, i - 1)));
};

/**
 * An in-memory sorted version cache: mutation, query, resolution and
 * navigation over a set of {@link SemVer} versions ordered by SemVer
 * precedence. Pure state (a `Ref` of a sorted array) — no IO. Versions that
 * differ only in build metadata occupy one slot.
 *
 * **Details**
 *
 * Provide {@link VersionCache.layer} to construct the live implementation.
 *
 * **Example** (Load cached versions and retrieve the latest)
 *
 * ```ts
 * import { SemVer, VersionCache } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* VersionCache;
 *   yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(2, 0, 0)]);
 *   const latest = yield* cache.latest;
 *   return latest.toString();
 * }).pipe(Effect.provide(VersionCache.layer));
 *
 * console.log(Effect.runSync(program));
 * // => "2.0.0"
 * ```
 *
 * @public
 */
export class VersionCache extends Context.Service<VersionCache, VersionCacheShape>()($I`VersionCache`) {
	/**
	 * Live implementation backed by a `Ref` of a sorted, deduplicated array.
	 * Requires nothing: range strings are parsed with {@link Range.parse}
	 * directly.
	 */
	static readonly layer: Layer.Layer<VersionCache> = Layer.effect(
		VersionCache,
		Effect.gen(function* () {
			const ref = yield* Ref.make<ReadonlyArray<SemVer>>([]);

			const requireNonEmpty = Effect.gen(function* () {
				const arr = yield* Ref.get(ref);
				if (!A.isReadonlyArrayNonEmpty(arr)) {
					return yield* EmptyCacheError.make();
				}
				return arr;
			});

			const resolve = Effect.fn("VersionCache.resolve")(function* (range: Range) {
				const arr = yield* Ref.get(ref);
				for (let i = arr.length - 1; i >= 0; i--) {
					const version = A.getUnsafe(arr, i);
					if (range.test(version)) {
						return version;
					}
				}
				return yield* UnsatisfiedRangeError.make({ range, available: arr });
			});

			const locate = (arr: ReadonlyArray<SemVer>, version: SemVer) => {
				const result = search(arr, version);
				return result.found ? O.some(result.index) : O.none();
			};

			return {
				load: (versions) => Ref.set(ref, dedupeSorted(versions)),

				add: (version) =>
					Ref.update(ref, (arr) => {
						const result = search(arr, version);
						if (result.found) return arr;
						return [...arr.slice(0, result.index), version, ...arr.slice(result.index)];
					}),

				remove: (version) =>
					Ref.update(ref, (arr) => {
						const result = search(arr, version);
						if (!result.found) return arr;
						return [...arr.slice(0, result.index), ...arr.slice(result.index + 1)];
					}),

				versions: Ref.get(ref),

				latest: Effect.map(requireNonEmpty, A.lastNonEmpty).pipe(Effect.withSpan("VersionCache.latest")),

				oldest: Effect.map(requireNonEmpty, A.headNonEmpty).pipe(Effect.withSpan("VersionCache.oldest")),

				resolve,

				resolveString: Effect.fn("VersionCache.resolveString")(function* (input: string) {
					const range = yield* Range.parse(input);
					return yield* resolve(range);
				}),

				filter: (range) => Effect.map(Ref.get(ref), (arr) => arr.filter((v) => range.test(v))),

				diff: Effect.fn("VersionCache.diff")(function* (a: SemVer, b: SemVer) {
					const arr = yield* Ref.get(ref);
					if (O.isNone(locate(arr, a))) {
						return yield* VersionNotFoundError.make({ version: a });
					}
					if (O.isNone(locate(arr, b))) {
						return yield* VersionNotFoundError.make({ version: b });
					}
					return VersionDiff.between(a, b);
				}),

				next: Effect.fn("VersionCache.next")(function* (version: SemVer) {
					const arr = yield* Ref.get(ref);
					const index = locate(arr, version);
					if (O.isNone(index)) {
						return yield* VersionNotFoundError.make({ version });
					}
					return A.get(arr, index.value + 1);
				}),

				prev: Effect.fn("VersionCache.prev")(function* (version: SemVer) {
					const arr = yield* Ref.get(ref);
					const index = locate(arr, version);
					if (O.isNone(index)) {
						return yield* VersionNotFoundError.make({ version });
					}
					return A.get(arr, index.value - 1);
				}),
			} satisfies VersionCacheShape;
		}),
	);
}
