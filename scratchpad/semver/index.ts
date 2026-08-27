/**
 * Strict SemVer 2.0.0 versions, ranges and comparators as Effect schemas.
 *
 * Domain classes carry their own behavior — instance methods are the
 * canonical API, cross-cutting operations are dual statics on the owning
 * class, and each class doubles as its schema (`SemVer.FromString`,
 * `Range.FromString`, `Comparator.FromString` transform to and from the
 * canonical strings).
 *
 * **Example** (Parse, bump, and test a range)
 *
 * ```ts
 * import { Range, SemVer } from "@beep/scratchpad/semver";
 * import { Effect } from "effect";
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
 * @see {@link https://semver.org} for the SemVer 2.0.0 grammar this parser implements strictly (no loose coercion).
 * @see {@link https://effect.website} for Effect's Schema, Result, and Context.Service APIs this kit is built on.
 * @packageDocumentation
 * @since 0.0.0
 */

export { Comparator, InvalidComparatorError } from "./Comparator.ts";
export {
  ComparatorSet,
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
