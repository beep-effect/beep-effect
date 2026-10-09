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
 * Raised by {@link Comparator.parse}. The decode direction of
 * {@link Comparator.FromString} reports the same failure through a generic
 * `Schema` parse error instead of this class, carrying the same message.
 *
 * @public
 */
export class InvalidComparatorError extends S.TaggedError<InvalidComparatorError>($I`InvalidComparatorError`)("InvalidComparatorError", {
	/** The raw input string that failed to parse. */
	input: S.String.annotateKey({ description: "The raw input string that failed to parse." }),
	/** The character position where parsing failed, if available. */
	position: S.optionalKey(S.Finite).annotateKey({ description: "The character position where parsing failed, if available." }),
}, $I.annote("InvalidComparatorError", { description: "Indicates that a string could not be parsed as a single comparator." })) {
	override get message(): string {
		const base = `Invalid comparator: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}

/**
 * A single version constraint: a comparison operator applied to a version.
 * Comparator strings accept an optional operator prefix (`=`, `>`, `>=`,
 * `<`, `<=`) followed by a complete version; a missing operator means `=`.
 * Wildcards and range sugar are not allowed — those belong to `Range`.
 *
 * **Example** (Test a version against a comparator)
 *
 * ```ts
 * import { Comparator, SemVer } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const comparator = yield* Comparator.parse(">=1.2.3");
 *   const version = yield* SemVer.parse("2.0.0");
 *   return comparator.test(version);
 * });
 *
 * console.log(Effect.runSync(program));
 * // => true
 * ```
 *
 * @public
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
  * import { Comparator } from "./index.ts";
  * import * as Result from "effect/Result";
  *
  * const ok = Comparator.parseResult(">=1.2.3");
  * if (Result.isSuccess(ok)) {
  *   console.log(ok.success.operator); // => ">="
  * }
  * ```
  *
  * @param input - the comparator string to parse
  * @returns a `Result` succeeding with the parsed {@link Comparator}, or
  * failing with {@link InvalidComparatorError}.
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
	 * @param input - the comparator string to parse
	 * @returns the parsed {@link Comparator}. Fails with
	 * {@link InvalidComparatorError}.
	 */
	static readonly parse = Effect.fn("Comparator.parse")((input: string) =>
		Effect.fromResult(Comparator.parseResult(input)),
	);

	// ── Instance ────────────────────────────────────────────────────────

	/** Test whether a version satisfies this comparator. */
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

	/** The comparator string; the `=` operator is implicit. */
	override toString(): string {
		return formatComparator(this);
	}

	/** @internal */
	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}
