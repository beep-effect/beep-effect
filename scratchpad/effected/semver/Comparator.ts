import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { formatComparator, parseComparator } from "./internal/grammar.ts";
import { ComparatorOperator } from "./internal/order.ts";
import { SemVer } from "./SemVer.ts";

const $I = $ScratchpadId.create("effected/semver/Comparator");

/**
 * Indicates that a string could not be parsed as a single comparator.
 *
 * **Details**
 *
 * Raised by {@link Comparator.parse}. The decode direction of
 * {@link Comparator.FromString} reports the same failure through a generic
 * `Schema` parse error instead of this class, carrying the same message.
 *
 * **Example** (Report a parse failure)
 *
 * ```ts
 * import { InvalidComparatorError } from "@beep/scratchpad/effected/semver/Comparator";
 *
 * const error = InvalidComparatorError.make({ input: "bad", position: 0 });
 * console.log(error.message); // Invalid comparator: "bad" at position 0
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidComparatorError extends S.TaggedError<InvalidComparatorError>($I`InvalidComparatorError`)("InvalidComparatorError", {
	/** The raw input string that failed to parse. */
	input: S.String.annotateKey({ description: "The raw input string that failed to parse." }),
	/** The character position where parsing failed, if available. */
	position: S.optionalKey(S.Finite).annotateKey({ description: "The character position where parsing failed, if available." }),
}, $I.annote("InvalidComparatorError", { description: "Indicates that a string could not be parsed as a single comparator." })) {
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
	 * import { InvalidComparatorError } from "@beep/scratchpad/effected/semver/Comparator";
	 *
	 * const error = InvalidComparatorError.make({ input: "bad", position: 0 });
	 * console.log(error.message); // Invalid comparator: "bad" at position 0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		const base = `Invalid comparator: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}

/**
 * A single version constraint: a comparison operator applied to a version.
 *
 * **Details**
 *
 * Comparator strings accept an optional operator prefix (`=`, `>`, `>=`,
 * `<`, `<=`) followed by a complete version; a missing operator means `=`.
 * Wildcards and range sugar are not allowed — those belong to `Range`.
 *
 * **Example** (Test a version against a comparator)
 *
 * ```ts
 * import { Comparator } from "@beep/scratchpad/effected/semver/Comparator";
 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const comparator = yield* Comparator.parse(">=1.2.3");
 *   const version = yield* SemVer.parse("2.0.0");
 *   return comparator.test(version);
 * });
 *
 * console.log(Effect.runSync(program)); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Comparator extends S.Class<Comparator>($I`Comparator`)({
	/** The relational operator applied to `version`; a missing prefix in the source string means `=`. */
	operator: ComparatorOperator.annotateKey({ description: "The relational operator applied to `version`; a missing prefix in the source string means `=`." }),
	/** The version the operator is applied against. */
	version: SemVer.annotateKey({ description: "The version the operator is applied against." }),
}, $I.annote("Comparator", { description: "A single version constraint: a comparison operator applied to a version. Comparator strings accept an optional operator prefix (`=`, `>`, `>=`, `<`, `<=`) followed by a complete version; a missing operator means `=`. Wildcards and range sugar are not allowed — those belong to `Range`." })) {
	// ── Schema ──────────────────────────────────────────────────────────

	/**
	 * Schema transformation between the comparator string (e.g. `">=1.2.3"`)
	 * and {@link Comparator}.
	 *
	 * **Example** (Decode a constraint string)
	 *
	 * ```ts
	 * import { Comparator } from "@beep/scratchpad/effected/semver/Comparator";
	 * import * as S from "effect/Schema";
	 *
	 * const value = S.decodeUnknownSync(Comparator.FromString)(">=1.2.3");
	 * console.log(value.toString()); // >=1.2.3
	 * ```
	 *
	 * @category schemas
	 * @since 0.0.0
	 */
	static readonly FromString: S.Codec<Comparator, string> = S.String.pipe(
		S.decodeTo(
			Comparator,
			SchemaTransformation.transformEffect({
				decode: (input: string) => {
					const result = parseComparator(input);
					return result.ok
						? Effect.succeed(result.value)
						: Effect.fail(
								new SchemaIssue.InvalidValue(
									{ message: `Invalid comparator: "${result.input}" at position ${result.position}` },
									input,
								),
							);
				},
				encode: (parts) => Effect.succeed(formatComparator(parts)),
			}),
		),
	);

	// ── Construction ────────────────────────────────────────────────────

	/**
	 * Parse a comparator string (e.g. `">=1.2.3"`), synchronously, returning a
	 * `Result` instead of an `Effect`.
	 *
	 * **Details**
	 *
	 * {@link Comparator.parse} is defined in terms of this function; the two
	 * never diverge. Reach for the `Effect` variant inside Effect code — it
	 * carries the `Comparator.parse` tracing span — and for this one at
	 * synchronous boundaries.
	 *
	 * **Example** (Parse a comparator synchronously)
	 *
	 * ```ts
	 * import { Comparator } from "@beep/scratchpad/effected/semver/Comparator";
	 * import * as Result from "effect/Result";
	 *
	 * const ok = Result.getOrThrow(Comparator.parseResult(">=1.2.3"));
	 * console.log(ok.operator); // >=
	 * ```
	 *
	 * @param input - the comparator string to parse
	 * @returns a `Result` succeeding with the parsed {@link Comparator}, or
	 * failing with {@link InvalidComparatorError}.
	 * @category parsing
	 * @since 0.0.0
	 */
	static parseResult(input: string): Result.Result<Comparator, InvalidComparatorError> {
		const result = parseComparator(input);
		if (!result.ok) {
			return Result.fail(InvalidComparatorError.make({ input: result.input, position: result.position }));
		}
		return Result.succeed(
			Comparator.make({ operator: result.value.operator, version: SemVer.make(result.value.version) }),
		);
	}

	/**
	 * Parse a comparator string (e.g. `">=1.2.3"`). Defined in terms of
	 * {@link Comparator.parseResult} — synchronous callers can use that variant
	 * directly.
	 *
	 * **Example** (Parse a constraint in Effect)
	 *
	 * ```ts
	 * import { Comparator } from "@beep/scratchpad/effected/semver/Comparator";
	 * import * as Effect from "effect/Effect";
	 *
	 * const value = Effect.runSync(Comparator.parse(">=1.2.3"));
	 * console.log(value.toString()); // >=1.2.3
	 * ```
	 *
	 * @param input - the comparator string to parse
	 * @returns the parsed {@link Comparator}. Fails with
	 * {@link InvalidComparatorError}.
	 * @category parsing
	 * @since 0.0.0
	 */
	static readonly parse = Effect.fn("Comparator.parse")((input: string) =>
		Effect.fromResult(Comparator.parseResult(input)),
	);

	// ── Instance ────────────────────────────────────────────────────────

	/**
	 * Test whether a version satisfies this comparator.
	 *
	 * **Example** (Match a version)
	 *
	 * ```ts
	 * import { Comparator } from "@beep/scratchpad/effected/semver/Comparator";
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as Effect from "effect/Effect";
	 *
	 * const comparator = Effect.runSync(Comparator.parse(">=1.2.3"));
	 * console.log(comparator.test(SemVer.of(2, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	test(version: SemVer): boolean {
		const cmp = version.compare(this.version);
		return Match.value(this.operator).pipe(
			Match.when("=", () => cmp === 0),
			Match.when(">", () => cmp > 0),
			Match.when(">=", () => cmp >= 0),
			Match.when("<", () => cmp < 0),
			Match.when("<=", () => cmp <= 0),
			Match.exhaustive,
		);
	}

	/**
	 * The comparator string; the `=` operator is implicit.
	 *
	 * **Example** (Format a constraint)
	 *
	 * ```ts
	 * import { Comparator } from "@beep/scratchpad/effected/semver/Comparator";
	 * import * as Effect from "effect/Effect";
	 *
	 * const value = Effect.runSync(Comparator.parse(">=1.2.3"));
	 * console.log(value.toString()); // >=1.2.3
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	override toString(): string {
		return formatComparator(this);
	}

	/**
	 * Formats this constraint for Node.js custom inspection.
	 *
	 * **Example** (Format a constraint)
	 *
	 * ```ts
	 * import { Comparator } from "@beep/scratchpad/effected/semver/Comparator";
	 * import * as Effect from "effect/Effect";
	 *
	 * const value = Effect.runSync(Comparator.parse(">=1.2.3"));
	 * console.log(value.toString()); // >=1.2.3
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
