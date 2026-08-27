/**
 * Range expressions as an OR of AND comparator sets. Node-semver sugar
 * (caret, tilde, X-range, hyphen, `||`) is desugared at parse time into
 * primitive comparators and then normalized.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Effect, Function as Fn, Match, Option, Result, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { Comparator } from "./Comparator.ts";
import { formatRange, parseRange } from "./internal/grammar.ts";
import { normalizeSets } from "./internal/normalize.ts";
import { SemVer } from "./SemVer.ts";

const $I = $ScratchpadId.create("semver/Range");

/**
 * Indicates that a string could not be parsed as a range expression.
 *
 * Raised by {@link Range.parse} and `VersionCache.resolveString` (which
 * parses through it). The decode direction of {@link Range.FromString}
 * reports the same failure through a generic `Schema` parse error instead of
 * this class, carrying the same message.
 *
 * **Example** (Read the tag from a failed range parse)
 *
 * ```ts
 * import { Range } from "@beep/scratchpad/semver";
 * import { Result } from "effect";
 *
 * const parsed = Range.parseResult("not a range");
 * if (Result.isFailure(parsed)) {
 *   console.log(parsed.failure._tag);
 *   // => "InvalidRangeError"
 * }
 * ```
 *
 * @see {@link Range.FromString} when the same failure should surface as a SchemaIssue.InvalidValue instead of this tagged error.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidRangeError extends Schema.TaggedError<InvalidRangeError>($I`InvalidRangeError`)(
  "InvalidRangeError",
  {
    /** The raw input string that failed to parse. */
    input: Schema.String,
    /** The character position where parsing failed, if available. */
    position: Schema.optionalKey(Schema.Finite),
  },
  $I.annote("InvalidRangeError", {
    description: "Raised when input cannot be parsed as a supported SemVer range expression.",
  })
) {
  /**
   * Human-readable parse failure, including the raw input and the grammar
   * position when the parser recorded one.
   *
   * **Example** (Read the message from an unparseable range)
   *
   * ```ts
   * import { Range } from "@beep/scratchpad/semver";
   * import { Result } from "effect";
   *
   * const parsed = Range.parseResult("not a range");
   * if (Result.isFailure(parsed)) {
   *   console.log(parsed.failure.message);
   *   // => Invalid range expression: "not a range" at position 0
   * }
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    const base = `Invalid range expression: "${this.input}"`;
    return this.position !== undefined ? `${base} at position ${this.position}` : base;
  }
}

/**
 * A comparator set: comparators combined with AND semantics. A version must
 * satisfy every comparator in the set to match. A {@link Range} is an OR of
 * these sets.
 *
 * **Example** (Construct an empty match-all comparator set)
 *
 * ```ts
 * import { ComparatorSet } from "@beep/scratchpad/semver"
 *
 * const set = ComparatorSet.make([])
 * console.log(set.length) // 0
 * ```
 *
 * @see {@link Range} for the union type that owns these sets.
 * @category schemas
 * @since 0.0.0
 */
export const ComparatorSet = Schema.Array(Comparator).pipe(
  $I.annoteSchema("ComparatorSet", {
    description: "Comparators combined with AND semantics inside a SemVer range.",
  })
);

/**
 * Decoded comparator set.
 *
 * @see {@link ComparatorSet} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ComparatorSet = typeof ComparatorSet.Type;

/**
 * A SemVer range expression: a union (OR) of {@link ComparatorSet}s.
 * Supports node-semver syntax — hyphen ranges (`1.0.0 - 2.0.0`), X-ranges
 * (`1.x`, `*`), tilde (`~1.2.3`), caret (`^1.2.3`) and `||` unions — which
 * parsing desugars into primitive comparators and normalizes.
 *
 * **Gotchas**
 *
 * Dual data-first order is `(version, range)` / `(versions, range)`.
 * `Range.satisfies(range, version)` at an untyped probe throws
 * `TypeError: range.test is not a function`. The same order applies to
 * {@link Range.filter}, {@link Range.maxSatisfying}, and
 * {@link Range.minSatisfying}.
 *
 * Prerelease versions match only when some comparator in the matching set
 * carries a prerelease on the same `major.minor.patch` tuple, so `^1.2.3`
 * does not match `1.2.4-alpha`.
 *
 * {@link Range.isSubset} is conservative: `>=1.0.0 <3.0.0` versus
 * `>=1.0.0 <2.0.0 || >=2.0.0 <3.0.0` returns `false` even though the first
 * is a subset. False negatives are safe.
 *
 * `Range.parse("")` is match-all (`>=0.0.0`); an empty string is not a
 * valid {@link SemVer}.
 *
 * **Example** (Parse a caret range and test)
 *
 * ```ts
 * import { Range, SemVer } from "@beep/scratchpad/semver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const range = yield* Range.parse("^1.0.0");
 *   const version = yield* SemVer.parse("1.5.0");
 *   return Range.satisfies(version, range);
 * });
 *
 * console.log(Effect.runSync(program));
 * // => true
 * ```
 *
 * @see {@link Range.satisfies} for the dual static whose data-first order is `(version, range)`.
 * @see {@link Range.isSubset} for the conservative subset check.
 * @see {@link SemVer.parse} for strict versions; empty string is not a version.
 * @see {@link Comparator} for a single operator plus a complete version, with no range sugar.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class Range extends Schema.Class<Range>($I`Range`)(
  {
    /** Comparator sets combined with OR semantics; a version matches when it satisfies any set. */
    sets: Schema.Array(ComparatorSet),
  },
  $I.annote("Range", {
    description: "A normalized SemVer range represented as OR-combined comparator sets.",
  })
) {
  // ── Schema ──────────────────────────────────────────────────────────

  /**
   * Schema transformation between the range expression string and
   * {@link Range}: decoding parses, desugars and normalizes; encoding
   * prints `a b || c d`.
   */
  static readonly FromString: Schema.Codec<Range, string> = Schema.String.pipe(
    Schema.decodeTo(
      Range,
      SchemaTransformation.transformOrFail({
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
        encode: (parts) => Effect.succeed(formatRange(parts.sets)),
      })
    )
  );

  // ── Construction ────────────────────────────────────────────────────

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
   * **Example** (Inspect the desugared caret window)
   *
   * ```ts
   * import { Range } from "@beep/scratchpad/semver";
   * import { Result } from "effect";
   *
   * const ok = Range.parseResult("^1.0.0");
   * if (Result.isSuccess(ok)) {
   *   console.log(ok.success.toString()); // => ">=1.0.0 <2.0.0-0"
   * }
   * ```
   *
   * @param input - the range expression to parse
   * @returns a `Result` succeeding with the parsed {@link Range}, or failing
   * with {@link InvalidRangeError}.
   * @see {@link Range.parse} for the Effect variant with a tracing span.
   * @since 0.0.0
   */
  static parseResult(input: string): Result.Result<Range, InvalidRangeError> {
    const result = parseRange(input);
    if (!result.ok) {
      return Result.fail(InvalidRangeError.make({ input: result.input, position: result.position }));
    }
    return Result.succeed(
      Range.make({
        sets: normalizeSets(result.value).map((set) =>
          set.map((c) => Comparator.make({ operator: c.operator, version: SemVer.make(c.version) }))
        ),
      })
    );
  }

  /**
   * Parse a range expression and normalize its comparator sets. Defined in
   * terms of {@link Range.parseResult} — synchronous callers can use that
   * variant directly.
   *
   * @param input - the range expression to parse
   * @returns the parsed {@link Range}. Fails with {@link InvalidRangeError}.
   */
  static readonly parse = Effect.fn("Range.parse")((input: string) => Effect.fromResult(Range.parseResult(input)));

  // ── Matching statics (dual) ─────────────────────────────────────────

  /**
   * Test whether a version satisfies a range; see {@link Range.test} for the
   * prerelease matching rule. Dual API.
   *
   * **Gotchas**
   *
   * Data-first order is `(version, range)` — the version being tested comes
   * first, the range it is tested against second. The data-last form takes
   * the range: `Range.satisfies(range)` applied to a version.
   *
   * The two parameters are distinct classes and the order is not recoverable
   * from the call site. TypeScript rejects a flipped call outright, so this
   * only bites callers without type checking. There,
   * `Range.satisfies(range, version)` dispatches data-first, binds the
   * `Range` to `version`, and dies with
   * `TypeError: range.test is not a function` — a message naming the
   * parameter that received the version, so it reads as a defect inside this
   * package rather than a caller error.
   *
   * The same order and the same hazard apply to {@link Range.filter},
   * {@link Range.maxSatisfying} and {@link Range.minSatisfying}: subject
   * first, range second.
   */
  static readonly satisfies: {
    (range: Range): (version: SemVer) => boolean;
    (version: SemVer, range: Range): boolean;
  } = Fn.dual(2, (version: SemVer, range: Range): boolean => range.test(version));

  /**
   * Filter versions that satisfy a range, preserving order. Dual API.
   *
   * **Gotchas**
   *
   * Data-first order is `(versions, range)` — see {@link Range.satisfies}
   * for why the order is spelled out.
   */
  static readonly filter: {
    (range: Range): (versions: ReadonlyArray<SemVer>) => ReadonlyArray<SemVer>;
    (versions: ReadonlyArray<SemVer>, range: Range): ReadonlyArray<SemVer>;
  } = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): ReadonlyArray<SemVer> => range.filter(versions));

  /**
   * Highest satisfying version, or `Option.none()`. Dual API.
   *
   * **Gotchas**
   *
   * Data-first order is `(versions, range)` — see {@link Range.satisfies}
   * for why the order is spelled out.
   */
  static readonly maxSatisfying: {
    (range: Range): (versions: ReadonlyArray<SemVer>) => Option.Option<SemVer>;
    (versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer>;
  } = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer> => {
    let best: SemVer | undefined;
    for (const v of versions) {
      if (range.test(v) && (best === undefined || v.gt(best))) best = v;
    }
    return best === undefined ? Option.none() : Option.some(best);
  });

  /**
   * Lowest satisfying version, or `Option.none()`. Dual API.
   *
   * **Gotchas**
   *
   * Data-first order is `(versions, range)` — see {@link Range.satisfies}
   * for why the order is spelled out.
   */
  static readonly minSatisfying: {
    (range: Range): (versions: ReadonlyArray<SemVer>) => Option.Option<SemVer>;
    (versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer>;
  } = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer> => {
    let best: SemVer | undefined;
    for (const v of versions) {
      if (range.test(v) && (best === undefined || v.lt(best))) best = v;
    }
    return best === undefined ? Option.none() : Option.some(best);
  });

  // ── Algebra statics ─────────────────────────────────────────────────

  /**
   * Combine two ranges with OR semantics: the union of their comparator
   * sets. Dual API.
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
   * **Example** (Intersect overlapping caret and lower-bound ranges)
   *
   * ```ts
   * import { Range } from "@beep/scratchpad/semver";
   * import { Result } from "effect";
   *
   * const a = Result.getOrThrow(Range.parseResult("^1.0.0"));
   * const b = Result.getOrThrow(Range.parseResult(">=1.5.0"));
   * const merged = Range.intersectResult(a, b);
   * if (Result.isSuccess(merged)) {
   *   console.log(merged.success.toString()); // => ">=1.0.0 <2.0.0-0 >=1.5.0"
   * }
   * ```
   *
   * @see {@link Range.intersect} for the Effect variant with a tracing span.
   */
  static readonly intersectResult: {
    (that: Range): (self: Range) => Result.Result<Range, UnsatisfiableConstraintError>;
    (self: Range, that: Range): Result.Result<Range, UnsatisfiableConstraintError>;
  } = Fn.dual(2, (self: Range, that: Range): Result.Result<Range, UnsatisfiableConstraintError> => {
    const candidates: Array<ComparatorSet> = [];

    for (const setA of self.sets) {
      for (const setB of that.sets) {
        const merged = [...setA, ...setB];
        if (isSetSatisfiable(merged)) {
          candidates.push(merged);
        }
      }
    }

    if (candidates.length === 0) {
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
   * Defined in terms of {@link Range.intersectResult} — synchronous callers
   * can use that variant directly.
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
   * the sub-set. False negatives are safe (they prevent incorrect
   * simplification).
   */
  static readonly isSubset: {
    (sup: Range): (sub: Range) => boolean;
    (sub: Range, sup: Range): boolean;
  } = Fn.dual(2, (sub: Range, sup: Range): boolean => {
    for (const subSet of sub.sets) {
      const contained = sup.sets.some((supSet) => isComparatorSetSubset(subSet, supSet));
      if (!contained) return false;
    }
    return true;
  });

  /**
   * Test whether two ranges are semantically equivalent: each is a
   * {@link Range.isSubset | subset} of the other. Dual API.
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
   * **Example** (Drop a union arm already covered by a broader caret)
   *
   * ```ts
   * import { Range } from "@beep/scratchpad/semver";
   * import { Result } from "effect";
   *
   * const range = Result.getOrThrow(Range.parseResult("^1.0.0 || ^1.5.0"));
   * console.log(range.toString());
   * // => ">=1.0.0 <2.0.0-0 || >=1.5.0 <2.0.0-0"
   * console.log(Range.simplify(range).toString());
   * // => ">=1.0.0 <2.0.0-0"
   * ```
   *
   * @since 0.0.0
   */
  static simplify(range: Range): Range {
    const sets = range.sets.filter(
      (set, i) => !range.sets.some((other, j) => i !== j && isComparatorSetSubset(set, other))
    );

    if (sets.length === 0) return range;
    return Range.make({ sets });
  }

  // ── Instance ────────────────────────────────────────────────────────

  /**
   * Test whether a version satisfies this range.
   *
   * **Gotchas**
   *
   * Matches node-semver's prerelease restriction: a prerelease version only
   * satisfies the range when at least one comparator in the matching set
   * carries a prerelease on the same `major.minor.patch` tuple. This keeps
   * `^1.2.3` from unexpectedly matching `1.2.4-alpha`.
   *
   * **Example** (Caret matches a compatible release, not the next prerelease)
   *
   * ```ts
   * import { Range, SemVer } from "@beep/scratchpad/semver";
   * import { Result } from "effect";
   *
   * const range = Result.getOrThrow(Range.parseResult("^1.2.3"));
   * console.log(range.test(SemVer.of(1, 5, 0))); // => true
   * console.log(range.test(SemVer.of(1, 2, 4, ["alpha"]))); // => false
   * console.log(range.test(SemVer.of(2, 0, 0))); // => false
   * ```
   *
   * @since 0.0.0
   */
  test(version: SemVer): boolean {
    return this.sets.some((set) => satisfiesSet(version, set));
  }

  /**
   * Filter versions that satisfy this range, preserving order.
   *
   * **Example** (Keep matching versions in input order)
   *
   * ```ts
   * import { Range, SemVer } from "@beep/scratchpad/semver";
   * import { Result } from "effect";
   *
   * const range = Result.getOrThrow(Range.parseResult("^1.0.0"));
   * const versions = [SemVer.of(1, 5, 0), SemVer.of(2, 0, 0), SemVer.of(1, 0, 0)];
   * console.log(range.filter(versions).map((version) => version.toString()));
   * // => ["1.5.0", "1.0.0"]
   * ```
   *
   * @since 0.0.0
   */
  filter(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> {
    return versions.filter((v) => this.test(v));
  }

  /**
   * The range expression string, `a b || c d`.
   *
   * **Example** (Print a parsed caret as its primitive window)
   *
   * ```ts
   * import { Range } from "@beep/scratchpad/semver";
   * import { Result } from "effect";
   *
   * console.log(Result.getOrThrow(Range.parseResult("^1.0.0")).toString());
   * // => ">=1.0.0 <2.0.0-0"
   * ```
   *
   * @since 0.0.0
   */
  override toString(): string {
    return formatRange(this.sets);
  }

  /** @internal */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}

/**
 * Indicates that intersecting ranges produced no satisfiable comparator set.
 *
 * Raised by {@link Range.intersect} when the constraints are mutually
 * exclusive. Carries the conflicting ranges.
 *
 * **Example** (Intersect disjoint ranges)
 *
 * ```ts
 * import { Range } from "@beep/scratchpad/semver";
 * import { Result } from "effect";
 *
 * const lower = Result.getOrThrow(Range.parseResult(">=2.0.0"));
 * const upper = Result.getOrThrow(Range.parseResult("<1.0.0"));
 * const merged = Range.intersectResult(lower, upper);
 * if (Result.isFailure(merged)) {
 *   console.log(merged.failure._tag);
 *   // => "UnsatisfiableConstraintError"
 * }
 * ```
 *
 * @see {@link Range.intersectResult} for the synchronous intersection that raises this error.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class UnsatisfiableConstraintError extends Schema.TaggedError<UnsatisfiableConstraintError>(
  $I`UnsatisfiableConstraintError`
)(
  "UnsatisfiableConstraintError",
  {
    /** The ranges whose intersection is empty. */
    constraints: Schema.Array(Range),
  },
  $I.annote("UnsatisfiableConstraintError", {
    description: "Raised when a set of SemVer range constraints has an empty intersection.",
  })
) {
  /**
   * Human-readable intersection failure, including how many ranges were
   * involved.
   *
   * **Example** (Read the message from disjoint range intersection)
   *
   * ```ts
   * import { Range } from "@beep/scratchpad/semver";
   * import { Result } from "effect";
   *
   * const lower = Result.getOrThrow(Range.parseResult(">=2.0.0"));
   * const upper = Result.getOrThrow(Range.parseResult("<1.0.0"));
   * const merged = Range.intersectResult(lower, upper);
   * if (Result.isFailure(merged)) {
   *   console.log(merged.failure.message);
   *   // => "No version satisfies all 2 constraints"
   * }
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    const count = this.constraints.length;
    return `No version satisfies all ${count} constraint${count === 1 ? "" : "s"}`;
  }
}

// ── Matching internals ───────────────────────────────────────────────────

// Prerelease tuple restriction (node-semver semantics): a prerelease version
// only matches a set when some comparator in the set carries a prerelease on
// the same major.minor.patch tuple.
const satisfiesSet = (version: SemVer, set: ComparatorSet): boolean => {
  if (set.length === 0) return true;

  if (version.prerelease.length > 0) {
    const hasTupleMatch = set.some(
      (c) =>
        c.version.prerelease.length > 0 &&
        c.version.major === version.major &&
        c.version.minor === version.minor &&
        c.version.patch === version.patch
    );
    if (!hasTupleMatch) return false;
  }

  return set.every((c) => c.test(version));
};

// ── Algebra internals ────────────────────────────────────────────────────

const isSetSatisfiable = (set: ComparatorSet): boolean => {
  const lowers: Array<Comparator> = [];
  const uppers: Array<Comparator> = [];
  const equals: Array<Comparator> = [];

  for (const c of set) {
    if (c.operator === "=") equals.push(c);
    else if (c.operator === ">" || c.operator === ">=") lowers.push(c);
    else uppers.push(c);
  }

  for (const eq of equals) {
    for (const c of set) {
      if (c === eq) continue;
      const cmp = eq.version.compare(c.version);
      const violates = Match.value(c.operator).pipe(
        Match.when(">", () => cmp <= 0),
        Match.when(">=", () => cmp < 0),
        Match.when("<", () => cmp >= 0),
        Match.when("<=", () => cmp > 0),
        Match.when("=", () => cmp !== 0),
        Match.exhaustive
      );
      if (violates) return false;
    }
  }

  for (const lo of lowers) {
    for (const hi of uppers) {
      const cmp = lo.version.compare(hi.version);
      if (lo.operator === ">=" && hi.operator === "<") {
        if (cmp >= 0) return false;
      } else if (lo.operator === ">=" && hi.operator === "<=") {
        if (cmp > 0) return false;
      } else if (lo.operator === ">" && hi.operator === "<") {
        if (cmp >= 0) return false;
      } else if (lo.operator === ">" && hi.operator === "<=") {
        if (cmp >= 0) return false;
      }
    }
  }

  return true;
};

const isComparatorImplied = (set: ComparatorSet, comp: Comparator): boolean => {
  for (const s of set) {
    const cmp = s.version.compare(comp.version);
    const implied = Match.value(comp.operator).pipe(
      Match.when(
        ">=",
        () => ((s.operator === ">=" || s.operator === ">") && cmp >= 0) || (s.operator === "=" && cmp >= 0)
      ),
      Match.when(
        ">",
        () => (s.operator === ">" && cmp >= 0) || ((s.operator === ">=" || s.operator === "=") && cmp > 0)
      ),
      Match.when(
        "<=",
        () => ((s.operator === "<=" || s.operator === "<") && cmp <= 0) || (s.operator === "=" && cmp <= 0)
      ),
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
};

const isComparatorSetSubset = (sub: ComparatorSet, sup: ComparatorSet): boolean => {
  for (const supComp of sup) {
    if (!isComparatorImplied(sub, supComp)) return false;
  }
  return true;
};
