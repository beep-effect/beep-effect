/**
 * Strict SemVer 2.0.0 versions, ranges and comparators as Effect schemas.
 *
 * **Details**
 *
 * Domain classes carry their own behavior — instance methods are the
 * canonical API, cross-cutting operations are dual statics on the owning
 * class, and each class doubles as its schema (`SemVer.FromString`,
 * `Range.FromString`, `Comparator.FromString` transform to and from the
 * canonical strings).
 *
 * **Example** (Bump a version and test range membership)
 *
 * ```ts
 * import { Range, SemVer } from "@beep/scratchpad/effected/semver/index";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const version = yield* SemVer.parse("1.2.3");
 *   const next = version.bump.minor();
 *   const range = yield* Range.parse("^1.0.0");
 *   return [next.toString(), range.test(version), version.gt(next)] as const;
 * });
 *
 * console.log(Effect.runSync(program));
 * // => ["1.3.0", true, false]
 * ```
 *
 * @packageDocumentation
 * @see {@link https://semver.org | SemVer 2.0.0 Specification} for the version grammar
 * @see {@link https://effect.website | Effect} for the Effect framework
 */

export { Comparator, InvalidComparatorError } from "./Comparator.ts";
export {
	type ComparatorSet,
	InvalidRangeError,
	Range,
	UnsatisfiableConstraintError,
} from "./Range.ts";
export { InvalidVersionError, SemVer, SemVerBump } from "./SemVer.ts";
export {
	EmptyCacheError,
	UnsatisfiedRangeError,
	VersionCache,
	type VersionCacheShape,
	VersionNotFoundError,
} from "./VersionCache.ts";
export { VersionDiff } from "./VersionDiff.ts";
