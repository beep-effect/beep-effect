import { Effect, Function as Fn, Option, Result, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { Comparator } from "./Comparator.ts";
import { formatRange, parseRange } from "./internal/grammar.ts";
import { normalizeSets } from "./internal/normalize.ts";
import { SemVer } from "./SemVer.ts";

/**
 * Indicates that a string could not be parsed as a range expression.
 *
 * Raised by {@link Range.parse} and `VersionCache.resolveString` (which
 * parses through it). The decode direction of {@link Range.FromString}
 * reports the same failure through a generic `Schema` parse error instead of
 * this class, carrying the same message.
 *
 * @public
 */
export class InvalidRangeError extends Schema.TaggedError<InvalidRangeError>()("InvalidRangeError", {
	/** The raw input string that failed to parse. */
	input: Schema.String,
	/** The character position where parsing failed, if available. */
	position: Schema.optionalKey(Schema.Number),
}) {
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
 */
export type ComparatorSet = ReadonlyArray<Comparator>;

/**
 * A SemVer range expression: a union (OR) of {@link ComparatorSet}s.
 * Supports node-semver syntax — hyphen ranges (`1.0.0 - 2.0.0`), X-ranges
 * (`1.x`, `*`), tilde (`~1.2.3`), caret (`^1.2.3`) and `||` unions — which
 * parsing desugars into primitive comparators and normalizes.
 *
 * @example
 * ```ts
 * import { Range, SemVer } from "@effected/semver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const range = yield* Range.parse("^1.0.0");
 *   const version = yield* SemVer.parse("1.5.0");
 *   return range.test(version);
 * });
 *
 * console.log(Effect.runSync(program));
 * // => true
 * ```
 *
 * @public
 */
export class Range extends Schema.Class<Range>("Range")({
	/** Comparator sets combined with OR semantics; a version matches when it satisfies any set. */
	sets: Schema.Array(Schema.Array(Comparator)),
}) {
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
									input,
								),
							);
				},
				encode: (parts) => Effect.succeed(formatRange(parts.sets)),
			}),
		),
	);

	// ── Construction ────────────────────────────────────────────────────

	/**
	 * Parse a range expression and normalize its comparator sets,
	 * synchronously, returning a `Result` instead of an `Effect`.
	 *
	 * @remarks
	 * {@link Range.parse} is defined in terms of this function; the two never
	 * diverge. Reach for the `Effect` variant inside Effect code — it carries
	 * the `Range.parse` tracing span — and for this one at synchronous
	 * boundaries.
	 *
	 * @example
	 * ```ts
	 * import { Range } from "@effected/semver";
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
	 */
	static parseResult(input: string): Result.Result<Range, InvalidRangeError> {
		const result = parseRange(input);
		if (!result.ok) {
			return Result.fail(new InvalidRangeError({ input: result.input, position: result.position }));
		}
		return Result.succeed(
			Range.make({
				sets: normalizeSets(result.value).map((set) =>
					set.map((c) => Comparator.make({ operator: c.operator, version: SemVer.make(c.version) })),
				),
			}),
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
	 * @remarks
	 * **Data-first order is `(version, range)`** — the version being tested
	 * comes first, the range it is tested against second. The data-last form
	 * takes the range: `Range.satisfies(range)` applied to a version.
	 *
	 * Worth stating because the two parameters are distinct classes and the
	 * order is not recoverable from the call site. TypeScript rejects a flipped
	 * call outright, so this only bites callers without type checking — which
	 * includes the untyped `node --input-type=module` probes this repo's own
	 * evidence ladder calls for. There, `Range.satisfies(range, version)`
	 * dispatches data-first, binds the `Range` to `version`, and dies with
	 * `TypeError: range.test is not a function` — a message naming the
	 * parameter that received the *version*, so it reads as a defect inside
	 * this package rather than a caller error.
	 *
	 * The same order and the same hazard apply to `Range.filter`,
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
	 * @remarks
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
	 * @remarks
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
	 * @remarks
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
	 * @remarks
	 * {@link Range.intersect} is defined in terms of this function; the two
	 * never diverge. Reach for the `Effect` variant inside Effect code — it
	 * carries the `Range.intersect` tracing span — and for this one at
	 * synchronous boundaries.
	 *
	 * @example
	 * ```ts
	 * import { Range } from "@effected/semver";
	 * import { Result } from "effect";
	 *
	 * const a = Result.getOrThrow(Range.parseResult("^1.0.0"));
	 * const b = Result.getOrThrow(Range.parseResult(">=1.5.0"));
	 * const merged = Range.intersectResult(a, b);
	 * if (Result.isSuccess(merged)) {
	 *   console.log(merged.success.toString()); // => ">=1.0.0 <2.0.0-0 >=1.5.0"
	 * }
	 * ```
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
			return Result.fail(new UnsatisfiableConstraintError({ constraints: [self, that] }));
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
		Effect.fn("Range.intersect")((self: Range, that: Range) => Effect.fromResult(Range.intersectResult(self, that))),
	);

	/**
	 * Check whether every version matched by `sub` is also matched by `sup`.
	 * Dual API.
	 *
	 * @remarks
	 * This check is a conservative approximation: it may return `false` for
	 * ranges that are technically subsets when the sub-range straddles
	 * comparator-set boundaries in the sup-range. For example,
	 * `>=1.0.0 <3.0.0` is a subset of `>=1.0.0 <2.0.0 || >=2.0.0 <3.0.0`,
	 * but `isSubset` returns `false` because no single sup-set fully implies
	 * the sub-set. This is a known limitation; false negatives are safe
	 * (they prevent incorrect simplification).
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
	 */
	static simplify(range: Range): Range {
		const sets = range.sets.filter((set, i) => {
			return !range.sets.some((other, j) => i !== j && isComparatorSetSubset(set, other));
		});

		if (sets.length === 0) return range;
		return Range.make({ sets });
	}

	// ── Instance ────────────────────────────────────────────────────────

	/**
	 * Test whether a version satisfies this range.
	 *
	 * @remarks
	 * Matches node-semver's prerelease restriction: a prerelease version only
	 * satisfies the range when at least one comparator in the matching set
	 * carries a prerelease on the same `major.minor.patch` tuple. This keeps
	 * `^1.2.3` from unexpectedly matching `1.2.4-alpha`.
	 */
	test(version: SemVer): boolean {
		return this.sets.some((set) => satisfiesSet(version, set));
	}

	/** Filter versions that satisfy this range, preserving order. */
	filter(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> {
		return versions.filter((v) => this.test(v));
	}

	/** The range expression string, `a b || c d`. */
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
 * @public
 */
export class UnsatisfiableConstraintError extends Schema.TaggedError<UnsatisfiableConstraintError>()(
	"UnsatisfiableConstraintError",
	{
		/** The ranges whose intersection is empty. */
		constraints: Schema.Array(Range),
	},
) {
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
				c.version.patch === version.patch,
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
			switch (c.operator) {
				case ">":
					if (cmp <= 0) return false;
					break;
				case ">=":
					if (cmp < 0) return false;
					break;
				case "<":
					if (cmp >= 0) return false;
					break;
				case "<=":
					if (cmp > 0) return false;
					break;
				case "=":
					if (cmp !== 0) return false;
					break;
			}
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
		switch (comp.operator) {
			case ">=":
				if ((s.operator === ">=" && cmp >= 0) || (s.operator === ">" && cmp >= 0)) return true;
				if (s.operator === "=" && cmp >= 0) return true;
				break;
			case ">":
				if (s.operator === ">" && cmp >= 0) return true;
				if (s.operator === ">=" && cmp > 0) return true;
				if (s.operator === "=" && cmp > 0) return true;
				break;
			case "<=":
				if ((s.operator === "<=" && cmp <= 0) || (s.operator === "<" && cmp <= 0)) return true;
				if (s.operator === "=" && cmp <= 0) return true;
				break;
			case "<":
				if (s.operator === "<" && cmp <= 0) return true;
				if (s.operator === "<=" && cmp < 0) return true;
				if (s.operator === "=" && cmp < 0) return true;
				break;
			case "=":
				if (s.operator === "=" && cmp === 0) return true;
				break;
		}
	}
	return false;
};

const isComparatorSetSubset = (sub: ComparatorSet, sup: ComparatorSet): boolean => {
	for (const supComp of sup) {
		if (!isComparatorImplied(sub, supComp)) return false;
	}
	return true;
};
