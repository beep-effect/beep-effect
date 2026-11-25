/**
 * SemVer ranges as unions of comparator sets, with satisfaction, intersection
 * and their typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SemverId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { Comparator } from "./Comparator.ts";
import { formatRange, parseRange } from "./internal/grammar.ts";
import { normalizeSets } from "./internal/normalize.ts";
import { SemVer } from "./SemVer.ts";

const $I = $SemverId.create("Range");

/**
 * **Details**
 *
 * Raised by {@link Range.parse} and `VersionCache.resolveString` (which
 * parses through it). The decode direction of {@link Range.FromString}
 * reports the same failure through a generic `Schema` parse error instead of
 * this class, carrying the same message.
 *
 * **Example** (Report a parse failure)
 *
 * ```ts
 * import { InvalidRangeError } from "@beep/semver/Range";
 *
 * const error = InvalidRangeError.make({ input: "bad", position: 0 });
 * console.log(error.message); // Invalid range expression: "bad" at position 0
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidRangeError extends S.TaggedError<
  InvalidRangeError,
  {
    readonly brand: unique symbol;
  }
>($I`InvalidRangeError`)(
  "InvalidRangeError",
  {
    /** The raw input string that failed to parse. */
    input: S.String.pipe(
      $I.annoteKey("InvalidRangeError.input", { description: "The raw input string that failed to parse." })
    ),
    /** The character position where parsing failed, if available. */
    position: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("InvalidRangeError.position", {
        description: "The character position where parsing failed, if available.",
      })
    ),
  },
  $I.annoteError<InvalidRangeError>("InvalidRangeError", {
    description: "Indicates that a string could not be parsed as a range expression.",
  })
) {
  /**
   * Builds a readable failure message from the structured error fields.
   *
   * **Details**
   *
   * The optional position is included when provided.
   *
   * **Example** (Report a parse failure)
   *
   * ```ts
   * import { InvalidRangeError } from "@beep/semver/Range";
   *
   * const error = InvalidRangeError.make({ input: "bad", position: 0 });
   * console.log(error.message); // Invalid range expression: "bad" at position 0
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const base = `Invalid range expression: "${this.input}"`;
    return this.position !== undefined ? `${base} at position ${this.position}` : base;
  }
}

/**
 * A comparator set: comparators combined with AND semantics. A version must
 * satisfy every comparator in the set to match.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ComparatorSet = ReadonlyArray<Comparator>;

const pickSatisfying =
  (replaces: (candidate: SemVer, best: SemVer) => boolean) =>
  (versions: ReadonlyArray<SemVer>, range: Range): O.Option<SemVer> => {
    let best: SemVer | undefined;
    for (const v of versions) {
      if (range.test(v) && (best === undefined || replaces(v, best))) best = v;
    }
    return O.fromUndefinedOr(best);
  };

/**
 * **Details**
 *
 * Supports node-semver syntax — hyphen ranges (`1.0.0 - 2.0.0`), X-ranges
 * (`1.x`, `*`), tilde (`~1.2.3`), caret (`^1.2.3`) and `||` unions — which
 * parsing desugars into primitive comparators and normalizes.
 *
 * **Example** (Test a version against a caret range)
 *
 * ```ts
 * import { Range } from "@beep/semver/Range";
 * import { SemVer } from "@beep/semver/SemVer";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const range = yield* Range.parse("^1.0.0");
 *   const version = yield* SemVer.parse("1.5.0");
 *   return range.test(version);
 * });
 *
 * console.log(Effect.runSync(program)); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Range extends S.Class<
  Range,
  {
    readonly brand: unique symbol;
  }
>($I`Range`)(
  {
    /** Comparator sets combined with OR semantics; a version matches when it satisfies any set. */
    sets: Comparator.pipe(
      S.Array,
      S.Array,
      $I.annoteKey("Range.sets", {
        description: "Comparator sets combined with OR semantics; a version matches when it satisfies any set.",
      })
    ),
  },
  $I.annote("Range", {
    description:
      "A SemVer range expression: a union (OR) of ComparatorSets. Supports node-semver syntax — hyphen ranges (`1.0.0 - 2.0.0`), X-ranges (`1.x`, `*`), tilde (`~1.2.3`), caret (`^1.2.3`) and `||` unions — which parsing desugars into primitive comparators and normalizes.",
  })
) {
  /**
   * Schema transformation between the range expression string and
   * {@link Range}: decoding parses, desugars and normalizes; encoding
   * prints `a b || c d`.
   *
   * **Example** (Decode a constraint string)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as S from "effect/Schema";
   *
   * const value = S.decodeUnknownSync(Range.FromString)("^1.0.0");
   * console.log(value.toString()); // >=1.0.0 <2.0.0-0
   * ```
   *
   * @category schemas
   * @since 0.0.0
   */
  static readonly FromString: S.Codec<Range, string> = S.String.pipe(
    S.decodeTo(
      Range,
      SchemaTransformation.transformEffect<typeof Range.Encoded, string>({
        decode: (input: string) => {
          const result = parseRange(input);
          return result.ok
            ? Effect.succeed({ sets: normalizeSets(result.value) })
            : Effect.fail(
                new SchemaIssue.InvalidValue(
                  { message: `Invalid range expression: "${result.input}" at position ${result.position}` },
                  input
                )
              );
        },
        encode: (parts) => {
          if (A.isReadonlyArrayEmpty(parts.sets)) return Effect.succeed("<0.0.0-0");
          if (A.some(parts.sets, A.isReadonlyArrayEmpty)) {
            return Effect.fail(
              new SchemaIssue.InvalidValue(
                { message: "An unrestricted empty comparator set cannot be represented by the range string grammar" },
                parts
              )
            );
          }
          return Effect.succeed(formatRange(parts.sets));
        },
      })
    )
  );

  /**
   * Parse a range expression and normalize its comparator sets,
   * synchronously, returning a `Result` instead of an `Effect`.
   *
   * **Details**
   *
   * {@link Range.parse} is defined in terms of this function; the two never
   * diverge. Reach for the `Effect` variant inside Effect code — it carries
   * the `Range.parse` tracing span — and for this one at synchronous
   * boundaries.
   *
   * **Example** (Normalize a caret range synchronously)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as Result from "effect/Result";
   *
   * const ok = Result.getOrThrow(Range.parseResult("^1.0.0"));
   * console.log(ok.toString()); // >=1.0.0 <2.0.0-0
   * ```
   *
   * @param input - the range expression to parse
   * @returns a `Result` succeeding with the parsed {@link Range}, or failing
   * with {@link InvalidRangeError}.
   * @category parsing
   * @since 0.0.0
   */
  static parseResult(input: string): Result.Result<Range, InvalidRangeError> {
    const result = parseRange(input);
    if (!result.ok) {
      return Result.fail(
        InvalidRangeError.make({
          input: result.input,
          position: result.position,
        })
      );
    }
    return S.decodeResult(Range)({ sets: normalizeSets(result.value) }).pipe(
      Result.mapError(() => InvalidRangeError.make({ input }))
    );
  }

  /**
   * Parse a range expression and normalize its comparator sets. Defined in
   * terms of {@link Range.parseResult} — synchronous callers can use that
   * variant directly.
   *
   * **Example** (Parse a constraint in Effect)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as Effect from "effect/Effect";
   *
   * const value = Effect.runSync(Range.parse("^1.0.0"));
   * console.log(value.toString()); // >=1.0.0 <2.0.0-0
   * ```
   *
   * @param input - the range expression to parse
   * @returns the parsed {@link Range}. Fails with {@link InvalidRangeError}.
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse = Effect.fn("Range.parse")((input: string) => Effect.fromResult(Range.parseResult(input)));

  /**
   * Test whether a version satisfies a range; see {@link Range.test} for the
   * prerelease matching rule. Dual API.
   *
   * **Gotchas**
   *
   * **Data-first order is `(version, range)`** — the version being tested
   * comes first, the range it is tested against second. The data-last form
   * takes the range: `Range.satisfies(range)` applied to a version.
   *
   * The two parameters are distinct classes and the order is not recoverable
   * from the call site. TypeScript rejects a flipped call outright, so this
   * only bites callers without type checking (untyped scripts, REPL probes).
   * There, `Range.satisfies(range, version)` dispatches data-first, binds the
   * `Range` to `version`, and dies with
   * `TypeError: range.test is not a function` — a message that reads as a
   * defect inside this package rather than a caller error.
   *
   * The same order and the same hazard apply to `Range.filter`,
   * {@link Range.maxSatisfying} and {@link Range.minSatisfying}: subject
   * first, range second.
   *
   * **Example** (Match a stable version)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import { SemVer } from "@beep/semver/SemVer";
   * import * as Effect from "effect/Effect";
   *
   * const range = Effect.runSync(Range.parse("^1.0.0"));
   * console.log(Range.satisfies(SemVer.of(1, 5, 0), range)); // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly satisfies: {
    (range: Range): (version: SemVer) => boolean;
    (version: SemVer, range: Range): boolean;
  } = Fn.dual(2, (version: SemVer, range: Range): boolean => range.test(version));

  /**
   * Filter versions that satisfy a range, preserving order. Dual API.
   *
   * **Details**
   *
   * Data-first order is `(versions, range)` — see {@link Range.satisfies}
   * for why the order is spelled out.
   *
   * **Example** (Select matching versions)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import { SemVer } from "@beep/semver/SemVer";
   * import * as Effect from "effect/Effect";
   *
   * const range = Effect.runSync(Range.parse("^1.0.0"));
   * const versions = [SemVer.of(1, 2, 0), SemVer.of(1, 6, 0), SemVer.of(2, 0, 0)];
   * console.log(Range.filter(versions, range).length); // 2
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly filter: {
    (range: Range): (versions: ReadonlyArray<SemVer>) => ReadonlyArray<SemVer>;
    (versions: ReadonlyArray<SemVer>, range: Range): ReadonlyArray<SemVer>;
  } = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): ReadonlyArray<SemVer> => range.filter(versions));

  /**
   * Highest satisfying version, or `Option.none()`. Dual API.
   *
   * **Details**
   *
   * Data-first order is `(versions, range)` — see {@link Range.satisfies}
   * for why the order is spelled out.
   *
   * **Example** (Select matching versions)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import { SemVer } from "@beep/semver/SemVer";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const range = Effect.runSync(Range.parse("^1.0.0"));
   * const versions = [SemVer.of(1, 2, 0), SemVer.of(1, 6, 0), SemVer.of(2, 0, 0)];
   * const selected = Range.maxSatisfying(versions, range);
   * console.log(O.map(selected, (version) => version.toString()).pipe(O.getOrElse(() => "none"))); // 1.6.0
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly maxSatisfying: {
    (range: Range): (versions: ReadonlyArray<SemVer>) => O.Option<SemVer>;
    (versions: ReadonlyArray<SemVer>, range: Range): O.Option<SemVer>;
  } = Fn.dual(
    2,
    pickSatisfying((candidate, best) => candidate.gt(best))
  );

  /**
   * Lowest satisfying version, or `Option.none()`. Dual API.
   *
   * **Details**
   *
   * Data-first order is `(versions, range)` — see {@link Range.satisfies}
   * for why the order is spelled out.
   *
   * **Example** (Select matching versions)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import { SemVer } from "@beep/semver/SemVer";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const range = Effect.runSync(Range.parse("^1.0.0"));
   * const versions = [SemVer.of(1, 2, 0), SemVer.of(1, 6, 0), SemVer.of(2, 0, 0)];
   * const selected = Range.minSatisfying(versions, range);
   * console.log(O.map(selected, (version) => version.toString()).pipe(O.getOrElse(() => "none"))); // 1.2.0
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly minSatisfying: {
    (range: Range): (versions: ReadonlyArray<SemVer>) => O.Option<SemVer>;
    (versions: ReadonlyArray<SemVer>, range: Range): O.Option<SemVer>;
  } = Fn.dual(
    2,
    pickSatisfying((candidate, best) => candidate.lt(best))
  );

  /**
   * Combine two ranges with OR semantics: the union of their comparator
   * sets. Dual API.
   *
   * **Example** (Compare overlapping constraints)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import { SemVer } from "@beep/semver/SemVer";
   * import * as Effect from "effect/Effect";
   *
   * const a = Effect.runSync(Range.parse("^1.0.0"));
   * const b = Effect.runSync(Range.parse("^1.5.0"));
   * console.log(Range.union(a, b).test(SemVer.of(1, 2, 0))); // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly union: {
    (that: Range): (self: Range) => Range;
    (self: Range, that: Range): Range;
  } = Fn.dual(2, (self: Range, that: Range): Range => Range.make({ sets: [...self.sets, ...that.sets] }));

  /**
   * Intersect two ranges via a cross-product of their comparator sets,
   * keeping only satisfiable combinations, synchronously, returning a
   * `Result` instead of an `Effect`. Fails with
   * {@link UnsatisfiableConstraintError} when no satisfiable set remains —
   * an honest typed failure instead of an unsatisfiable range. Dual API.
   *
   * **Details**
   *
   * {@link Range.intersect} is defined in terms of this function; the two
   * never diverge. Reach for the `Effect` variant inside Effect code — it
   * carries the `Range.intersect` tracing span — and for this one at
   * synchronous boundaries.
   *
   * **Example** (Intersect two ranges synchronously)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as Result from "effect/Result";
   *
   * const a = Result.getOrThrow(Range.parseResult("^1.0.0"));
   * const b = Result.getOrThrow(Range.parseResult(">=1.5.0"));
   * const merged = Result.getOrThrow(Range.intersectResult(a, b));
   * console.log(merged.toString()); // >=1.0.0 <2.0.0-0 >=1.5.0
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly intersectResult: {
    (that: Range): (self: Range) => Result.Result<Range, UnsatisfiableConstraintError>;
    (self: Range, that: Range): Result.Result<Range, UnsatisfiableConstraintError>;
  } = Fn.dual(2, (self: Range, that: Range): Result.Result<Range, UnsatisfiableConstraintError> => {
    const candidates = A.flatMap(self.sets, (setA) =>
      A.flatMap(that.sets, (setB) => A.filter(intersectSets(setA, setB), isSetSatisfiable))
    );

    if (A.isReadonlyArrayEmpty(candidates)) {
      return Result.fail(UnsatisfiableConstraintError.make({ constraints: [self, that] }));
    }

    return Result.succeed(Range.make({ sets: candidates }));
  });

  /**
   * Intersect two ranges via a cross-product of their comparator sets,
   * keeping only satisfiable combinations. Fails with
   * {@link UnsatisfiableConstraintError} when no satisfiable set remains —
   * an honest typed failure instead of an unsatisfiable range. Dual API.
   *
   * **Details**
   *
   * Defined in terms of {@link Range.intersectResult} — synchronous callers
   * can use that variant directly.
   *
   * **Example** (Compare overlapping constraints)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import { SemVer } from "@beep/semver/SemVer";
   * import * as Effect from "effect/Effect";
   *
   * const a = Effect.runSync(Range.parse("^1.0.0"));
   * const b = Effect.runSync(Range.parse("^1.5.0"));
   * console.log(Effect.runSync(Range.intersect(a, b)).test(SemVer.of(1, 6, 0))); // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly intersect: {
    (that: Range): (self: Range) => Effect.Effect<Range, UnsatisfiableConstraintError>;
    (self: Range, that: Range): Effect.Effect<Range, UnsatisfiableConstraintError>;
  } = Fn.dual(
    2,
    Effect.fn("Range.intersect")((self: Range, that: Range) => Effect.fromResult(Range.intersectResult(self, that)))
  );

  /**
   * Check whether every version matched by `sub` is also matched by `sup`.
   * Dual API.
   *
   * **Gotchas**
   *
   * This check is a conservative approximation: it may return `false` for
   * ranges that are technically subsets when the sub-range straddles
   * comparator-set boundaries in the sup-range. For example,
   * `>=1.0.0 <3.0.0` is a subset of `>=1.0.0 <2.0.0 || >=2.0.0 <3.0.0`,
   * but `isSubset` returns `false` because no single sup-set fully implies
   * the sub-set. This is a known limitation; false negatives are safe
   * (they prevent incorrect simplification).
   *
   * **Example** (Compare overlapping constraints)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as Effect from "effect/Effect";
   *
   * const a = Effect.runSync(Range.parse("^1.0.0"));
   * const b = Effect.runSync(Range.parse("^1.5.0"));
   * console.log(Range.isSubset(b, a)); // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly isSubset: {
    (sup: Range): (sub: Range) => boolean;
    (sub: Range, sup: Range): boolean;
  } = Fn.dual(2, (sub: Range, sup: Range): boolean => {
    for (const subSet of sub.sets) {
      const contained = A.some(sup.sets, (supSet) => isComparatorSetSubset(subSet, supSet));
      if (!contained) return false;
    }
    return true;
  });

  /**
   * Test whether two ranges are semantically equivalent: each is a
   * {@link Range.isSubset | subset} of the other. Dual API.
   *
   * **Example** (Compare overlapping constraints)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as Effect from "effect/Effect";
   *
   * const a = Effect.runSync(Range.parse("^1.0.0"));
   * const b = Effect.runSync(Range.parse("^1.5.0"));
   * console.log(Range.equivalent(a, b)); // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly equivalent: {
    (that: Range): (self: Range) => boolean;
    (self: Range, that: Range): boolean;
  } = Fn.dual(2, (self: Range, that: Range): boolean => Range.isSubset(self, that) && Range.isSubset(that, self));

  /**
   * Remove redundant comparator sets: a set is redundant when it is a
   * subset of another set in the range (every version it matches already
   * matches that broader set, so the union gains nothing by keeping it).
   *
   * **Example** (Compare overlapping constraints)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as Effect from "effect/Effect";
   *
   * const a = Effect.runSync(Range.parse("^1.0.0"));
   * const b = Effect.runSync(Range.parse("^1.5.0"));
   * console.log(Range.simplify(Range.union(a, b)).sets.length); // 1
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static simplify(range: Range): Range {
    const sets = A.filter(
      range.sets,
      (set, i) =>
        !A.some(
          range.sets,
          (other, j) => i !== j && isComparatorSetSubset(set, other) && (j < i || !isComparatorSetSubset(other, set))
        )
    );

    if (A.isReadonlyArrayEmpty(sets)) return range;
    return Range.make({ sets });
  }

  /**
   * Test whether a version satisfies this range.
   *
   * **Details**
   *
   * Matches node-semver's prerelease restriction: a prerelease version only
   * satisfies the range when at least one comparator in the matching set
   * carries a prerelease on the same `major.minor.patch` tuple. This keeps
   * `^1.2.3` from unexpectedly matching `1.2.4-alpha`.
   *
   * **Example** (Match a stable version)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import { SemVer } from "@beep/semver/SemVer";
   * import * as Effect from "effect/Effect";
   *
   * const range = Effect.runSync(Range.parse("^1.0.0"));
   * console.log(range.test(SemVer.of(1, 5, 0))); // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  test(version: SemVer): boolean {
    return A.some(this.sets, (set) => satisfiesSet(version, set));
  }

  /**
   * Filter versions that satisfy this range, preserving order.
   *
   * **Example** (Select matching versions)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import { SemVer } from "@beep/semver/SemVer";
   * import * as Effect from "effect/Effect";
   *
   * const range = Effect.runSync(Range.parse("^1.0.0"));
   * const versions = [SemVer.of(1, 2, 0), SemVer.of(1, 6, 0), SemVer.of(2, 0, 0)];
   * console.log(range.filter(versions).length); // 2
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  filter(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> {
    return A.filter(versions, (v) => this.test(v));
  }

  /**
   * The range expression string, `a b || c d`.
   *
   * **Example** (Format a constraint)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as Effect from "effect/Effect";
   *
   * const value = Effect.runSync(Range.parse("^1.0.0"));
   * console.log(value.toString()); // >=1.0.0 <2.0.0-0
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override toString(): string {
    return formatRange(this.sets);
  }

  /**
   * Formats this constraint for Node.js custom inspection.
   *
   * **Example** (Format a constraint)
   *
   * ```ts
   * import { Range } from "@beep/semver/Range";
   * import * as Effect from "effect/Effect";
   *
   * const value = Effect.runSync(Range.parse("^1.0.0"));
   * console.log(value.toString()); // >=1.0.0 <2.0.0-0
   * ```
   *
   * @internal
   * @category formatting
   * @since 0.0.0
   */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}

/**
 * **Details**
 *
 * Raised by {@link Range.intersect} when the constraints are mutually
 * exclusive. Carries the conflicting ranges.
 *
 * **Example** (Report conflicting ranges)
 *
 * ```ts
 * import { Range, UnsatisfiableConstraintError } from "@beep/semver/Range";
 * import * as Effect from "effect/Effect";
 *
 * const a = Effect.runSync(Range.parse("^1.0.0"));
 * const b = Effect.runSync(Range.parse("^2.0.0"));
 * const error = UnsatisfiableConstraintError.make({ constraints: [a, b] });
 * console.log(error.message); // No version satisfies all 2 constraints
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class UnsatisfiableConstraintError extends S.TaggedError<
  UnsatisfiableConstraintError,
  { readonly brand: unique symbol }
>($I`UnsatisfiableConstraintError`)(
  "UnsatisfiableConstraintError",
  {
    /** The ranges whose intersection is empty. */
    constraints: S.Array(Range).pipe(
      $I.annoteKey("UnsatisfiableConstraintError.constraints", {
        description: "The ranges whose intersection is empty.",
      })
    ),
  },
  $I.annoteError<UnsatisfiableConstraintError>("UnsatisfiableConstraintError", {
    description: "Indicates that intersecting ranges produced no satisfiable comparator set.",
  })
) {
  /**
   * Builds a readable failure message from the structured error fields.
   *
   * **Details**
   *
   * The constraint count selects the singular or plural wording.
   *
   * **Example** (Report conflicting ranges)
   *
   * ```ts
   * import { Range, UnsatisfiableConstraintError } from "@beep/semver/Range";
   * import * as Effect from "effect/Effect";
   *
   * const a = Effect.runSync(Range.parse("^1.0.0"));
   * const b = Effect.runSync(Range.parse("^2.0.0"));
   * const error = UnsatisfiableConstraintError.make({ constraints: [a, b] });
   * console.log(error.message); // No version satisfies all 2 constraints
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const count = this.constraints.length;
    return `No version satisfies all ${count} constraint${count === 1 ? "" : "s"}`;
  }
}

const satisfiesSet: {
  (version: SemVer, set: ComparatorSet): boolean;
  (set: ComparatorSet): (version: SemVer) => boolean;
} = Fn.dual(2, (version: SemVer, set: ComparatorSet): boolean => {
  if (A.isReadonlyArrayEmpty(set)) return true;

  if (A.isReadonlyArrayNonEmpty(version.prerelease)) {
    const hasTupleMatch = A.some(
      set,
      (c) =>
        c.version.prerelease.length > 0 &&
        c.version.major === version.major &&
        c.version.minor === version.minor &&
        c.version.patch === version.patch
    );
    if (!hasTupleMatch) return false;
  }

  return A.every(set, (c) => c.test(version));
});

const sameTuple: {
  (a: SemVer, b: SemVer): boolean;
  (b: SemVer): (a: SemVer) => boolean;
} = Fn.dual(2, (a: SemVer, b: SemVer): boolean => a.major === b.major && a.minor === b.minor && a.patch === b.patch);

const admitsTuple: {
  (set: ComparatorSet, tuple: SemVer): boolean;
  (tuple: SemVer): (set: ComparatorSet) => boolean;
} = Fn.dual(2, (set: ComparatorSet, tuple: SemVer): boolean =>
  A.some(set, (c) => c.version.isPrerelease && sameTuple(c.version, tuple))
);

const prereleaseTuples = (set: ComparatorSet): Array<SemVer> =>
  A.dedupeWith(
    A.map(
      A.filter(set, (c) => c.version.isPrerelease),
      (c) => c.version
    ),
    sameTuple
  );

const nextStable = (v: SemVer): O.Option<SemVer> => {
  if (v.patch < Number.MAX_SAFE_INTEGER) return O.some(SemVer.of(v.major, v.minor, v.patch + 1));
  if (v.minor < Number.MAX_SAFE_INTEGER) return O.some(SemVer.of(v.major, v.minor + 1, 0));
  if (v.major < Number.MAX_SAFE_INTEGER) return O.some(SemVer.of(v.major + 1, 0, 0));
  return O.none();
};

const isLowerBound = (c: Comparator): boolean => c.operator === ">" || c.operator === ">=" || c.operator === "=";

const maxVersion = (a: SemVer, b: SemVer): SemVer => (b.gt(a) ? b : a);

const stableLowerBound = (c: Comparator): O.Option<SemVer> =>
  c.operator === ">" && c.version.isStable
    ? nextStable(c.version)
    : O.some(SemVer.of(c.version.major, c.version.minor, c.version.patch));

const stableWitness = (set: ComparatorSet): O.Option<SemVer> => {
  let candidate = SemVer.of(0, 0, 0);
  for (const c of A.filter(set, isLowerBound)) {
    const lower = stableLowerBound(c);
    if (O.isNone(lower)) return O.none();
    candidate = maxVersion(candidate, lower.value);
  }
  return satisfiesSet(candidate, set) ? O.some(candidate) : O.none();
};

const leastPrereleaseAboveSkippingNone = (prerelease: ReadonlyArray<string | number>): Array<string | number> => [
  ...prerelease,
  0,
];

const prereleaseLowerBound = (c: Comparator, tuple: SemVer): SemVer =>
  c.operator === ">"
    ? SemVer.of(tuple.major, tuple.minor, tuple.patch, leastPrereleaseAboveSkippingNone(c.version.prerelease))
    : c.version;

const prereleaseWitness: {
  (set: ComparatorSet, tuple: SemVer): O.Option<SemVer>;
  (tuple: SemVer): (set: ComparatorSet) => O.Option<SemVer>;
} = Fn.dual(2, (set: ComparatorSet, tuple: SemVer): O.Option<SemVer> => {
  let candidate = SemVer.of(tuple.major, tuple.minor, tuple.patch, [0]);
  for (const c of A.filter(set, (c) => isLowerBound(c) && sameTuple(c.version, tuple))) {
    if (c.version.isStable) return O.none();
    candidate = maxVersion(candidate, prereleaseLowerBound(c, tuple));
  }
  return satisfiesSet(candidate, set) ? O.some(candidate) : O.none();
});

const isSetSatisfiable = (set: ComparatorSet): boolean => {
  const equality = A.findFirst(set, (c) => c.operator === "=");
  if (O.isSome(equality)) return satisfiesSet(equality.value.version, set);
  return (
    O.isSome(stableWitness(set)) || A.some(prereleaseTuples(set), (tuple) => O.isSome(prereleaseWitness(set, tuple)))
  );
};

const projectPrereleaseBoundsOntoStableDomain = (set: ComparatorSet): O.Option<ComparatorSet> => {
  const projected: Array<Comparator> = [];
  for (const c of set) {
    if (c.version.isStable) {
      projected.push(c);
      continue;
    }
    if (c.operator === "=") return O.none();
    projected.push(
      Comparator.make({
        operator: c.operator === ">" || c.operator === ">=" ? ">=" : "<",
        version: SemVer.of(c.version.major, c.version.minor, c.version.patch),
      })
    );
  }
  return O.some(projected);
};

const intersectSets: {
  (a: ComparatorSet, b: ComparatorSet): ReadonlyArray<ComparatorSet>;
  (b: ComparatorSet): (a: ComparatorSet) => ReadonlyArray<ComparatorSet>;
} = Fn.dual(2, (a: ComparatorSet, b: ComparatorSet): ReadonlyArray<ComparatorSet> => {
  if (A.isReadonlyArrayEmpty(a)) return [b];
  if (A.isReadonlyArrayEmpty(b)) return [a];
  const merged = [...a, ...b];
  const tuples = prereleaseTuples(merged);
  if (
    A.every(
      tuples,
      (tuple) => (admitsTuple(a, tuple) && admitsTuple(b, tuple)) || O.isNone(prereleaseWitness(merged, tuple))
    )
  )
    return [merged];
  const permitted = A.filter(tuples, (tuple) => admitsTuple(a, tuple) && admitsTuple(b, tuple));
  const stable = projectPrereleaseBoundsOntoStableDomain(merged);
  return [
    ...O.getOrElse(O.map(stable, A.of), () => []),
    ...A.map(permitted, (tuple) => [
      ...merged,
      Comparator.make({
        operator: ">=",
        version: SemVer.of(tuple.major, tuple.minor, tuple.patch, [0]),
      }),
      Comparator.make({
        operator: "<",
        version: SemVer.of(tuple.major, tuple.minor, tuple.patch),
      }),
    ]),
  ];
});

const isComparatorImplied: {
  (set: ComparatorSet, comp: Comparator): boolean;
  (comp: Comparator): (set: ComparatorSet) => boolean;
} = Fn.dual(2, (set: ComparatorSet, comp: Comparator): boolean => {
  for (const s of set) {
    const cmp = s.version.compare(comp.version);
    const implied = Match.value(comp.operator).pipe(
      Match.when(">=", () => (s.operator === ">=" || s.operator === ">" || s.operator === "=") && cmp >= 0),
      Match.when(
        ">",
        () => (s.operator === ">" && cmp >= 0) || ((s.operator === ">=" || s.operator === "=") && cmp > 0)
      ),
      Match.when("<=", () => (s.operator === "<=" || s.operator === "<" || s.operator === "=") && cmp <= 0),
      Match.when(
        "<",
        () => (s.operator === "<" && cmp <= 0) || ((s.operator === "<=" || s.operator === "=") && cmp < 0)
      ),
      Match.when("=", () => s.operator === "=" && cmp === 0),
      Match.exhaustive
    );
    if (implied) return true;
  }
  return false;
});

const coversPrereleaseTuples = (sub: ComparatorSet, sup: ComparatorSet): boolean =>
  A.every(prereleaseTuples(sub), (tuple) => admitsTuple(sup, tuple) || O.isNone(prereleaseWitness(sub, tuple)));

const isComparatorSetSubset: {
  (sub: ComparatorSet, sup: ComparatorSet): boolean;
  (sup: ComparatorSet): (sub: ComparatorSet) => boolean;
} = Fn.dual(2, (sub: ComparatorSet, sup: ComparatorSet): boolean => {
  if (A.isReadonlyArrayEmpty(sup) || !isSetSatisfiable(sub)) return true;
  const subAdmitsEveryPrereleaseTuple = A.isReadonlyArrayEmpty(sub);
  if (subAdmitsEveryPrereleaseTuple) return false;
  return coversPrereleaseTuples(sub, sup) && A.every(sup, (supComp) => isComparatorImplied(sub, supComp));
});
