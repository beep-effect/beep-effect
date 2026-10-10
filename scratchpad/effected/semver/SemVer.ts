import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Fn from "effect/Function";
import * as Hash from "effect/Hash";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { formatVersion, parseVersion } from "./internal/grammar.ts";
import { compareBuild, comparePrereleaseIdentifier } from "./internal/order.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/semver/SemVer");

/**
 * Indicates that a string could not be parsed as a valid SemVer 2.0.0 version.
 *
 * **Details**
 *
 * Raised by {@link SemVer.parse}. The decode direction of
 * {@link SemVer.FromString} reports the same failure through a generic
 * `Schema` parse error instead of this class, carrying the same message.
 * Unlike node-semver, no loose parsing or `v`-prefix coercion is performed.
 *
 * **Example** (Inspect a strict parsing error)
 *
 * ```ts
 * import { InvalidVersionError } from "@beep/scratchpad/effected/semver/SemVer";
 *
 * const error = InvalidVersionError.make({ input: "v1.2.3", position: 0 });
 * console.log(error.message); // Invalid version string: "v1.2.3" at position 0
 * ```
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification} for the version grammar
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidVersionError extends S.TaggedError<InvalidVersionError>($I`InvalidVersionError`)("InvalidVersionError", {
	/** The raw input string that failed to parse. */
	input: S.String.annotateKey({ description: "The raw input string that failed to parse." }),
	/** The character position where parsing failed, if available. */
	position: S.optionalKey(S.Finite).annotateKey({ description: "The character position where parsing failed, if available." }),
}, $I.annote("InvalidVersionError", { description: "Indicates that a string could not be parsed as a valid SemVer 2.0.0 version." })) {
	/**
	 * Describes the rejected version string and includes its failure position when available.
	 *
	 * **Example** (Read a parsing failure message)
	 *
	 * ```ts
	 * import { InvalidVersionError } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(InvalidVersionError.make({ input: "bad" }).message); // Invalid version string: "bad"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		const base = `Invalid version string: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}

// Non-negative safe integer schema shared by the `major`/`minor`/`patch`
// fields.
const nonNegativeInteger = S.Finite.check(
	S.isInt(),
	S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
);

// String prerelease identifiers must contain at least one non-digit:
// all-numeric identifiers are numbers (the grammar parses them as such), so
// requiring a non-digit keeps decode/encode round-trips canonical. Written
// without lookahead so `Arbitrary.schema` can derive a generator.
const prereleaseIdentifier = S.Union([
	S.String.check(S.isPattern(/^[0-9]*[A-Za-z-][0-9A-Za-z-]*$/u)),
	nonNegativeInteger,
]);

// Build identifiers allow leading zeros and all-digit tokens (SemVer §10).
const buildIdentifier = S.String.check(S.isPattern(/^[0-9A-Za-z-]+$/u));

/**
 * A parsed SemVer 2.0.0 version: an Effect `Schema.Class` whose fields are
 * validated in-schema (non-negative integer components, well-formed
 * identifiers), so `SemVer.make` only produces valid versions.
 *
 * **Details**
 *
 * Instance methods are the canonical API; cross-cutting operations exist as
 * dual statics on the class. The string representation is the schema's
 * encoded form via {@link SemVer.FromString}.
 *
 * **Example** (Bump a minor version and compare stability)
 *
 * ```ts
 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.parse("1.2.3");
 *   const next = v.bump.minor();
 *   return `${next.toString()}, ${v.gt(next)}, ${next.isStable}`;
 * });
 *
 * console.log(Effect.runSync(program)); // 1.3.0, false, true
 * ```
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification} for the version grammar
 * @public
 * @category models
 * @since 0.0.0
 */
export class SemVer extends S.Class<SemVer>($I`SemVer`)({
	/** The major version component; incompatible API changes. */
	major: nonNegativeInteger.annotateKey({ description: "The major version component; incompatible API changes." }),
	/** The minor version component; backward-compatible functionality. */
	minor: nonNegativeInteger.annotateKey({ description: "The minor version component; backward-compatible functionality." }),
	/** The patch version component; backward-compatible fixes. */
	patch: nonNegativeInteger.annotateKey({ description: "The patch version component; backward-compatible fixes." }),
	/** Prerelease identifiers, most-significant first; `[]` for a stable version. */
	prerelease: S.Array(prereleaseIdentifier).annotateKey({ description: "Prerelease identifiers, most-significant first; `[]` for a stable version." }),
	/** Build metadata identifiers; ignored by precedence comparisons (§10). */
	build: S.Array(buildIdentifier).annotateKey({ description: "Build metadata identifiers; ignored by precedence comparisons (§10)." }),
}, $I.annote("SemVer", { description: "A parsed SemVer 2.0.0 version: an Effect `Schema.Class` whose fields are validated in-schema (non-negative integer components, well-formed identifiers), so `SemVer.make` only produces valid versions." })) {
	// ── Schema ──────────────────────────────────────────────────────────

	/**
	 * Schema transformation between the canonical version string and
	 * {@link SemVer}: decoding parses with the strict grammar, encoding
	 * prints `major.minor.patch[-prerelease][+build]`.
	 *
	 * **Example** (Decode and encode a canonical version)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as S from "effect/Schema";
	 *
	 * const version = S.decodeUnknownSync(SemVer.FromString)("1.2.3-rc.1+build");
	 * console.log(S.encodeSync(SemVer.FromString)(version)); // 1.2.3-rc.1+build
	 * ```
	 *
	 * @category schemas
	 * @since 0.0.0
	 */
	static readonly FromString: S.Codec<SemVer, string> = S.String.pipe(
		S.decodeTo(
			SemVer,
			SchemaTransformation.transformEffect({
				decode: (input: string) => {
					const result = parseVersion(input);
					return result.ok
						? Effect.succeed(result.value)
						: Effect.fail(
								new SchemaIssue.InvalidValue(
									{ message: `Invalid version string: "${result.input}" at position ${result.position}` },
									input,
								),
							);
				},
				encode: (parts) => Effect.succeed(formatVersion(parts)),
			}),
		),
	);

	/**
	 * `Schema.String` refined by {@link SemVer.isValid}: an exact SemVer 2.0.0
	 * version string whose type stays `string`.
	 *
	 * **Details**
	 *
	 * For consumer structs whose field must remain a plain string — a manifest
	 * model, an action input — while still refusing everything that is not
	 * exactly one version: ranges, partial versions, dist-tags, and padded
	 * input (see {@link SemVer.isValid} for the whitespace posture). Build
	 * metadata is valid grammar and passes; reach for
	 * {@link SemVer.PinnableVersionString} when the `+` position is spoken for.
	 * Decode to a {@link SemVer} instance with {@link SemVer.FromString}
	 * instead when the parsed components are wanted.
	 *
	 * **Example** (Validate a plain version string)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as S from "effect/Schema";
	 *
	 * console.log(S.decodeUnknownSync(SemVer.ExactVersionString)("1.2.3+build")); // 1.2.3+build
	 * ```
	 *
	 * @category schemas
	 * @since 0.0.0
	 */
	static readonly ExactVersionString: S.String = S.String.pipe(
		S.check(
			S.makeFilterGroup([
				S.makeFilter((value) =>
					SemVer.isValid(value)
						? undefined
						: "Expected an exact SemVer 2.0.0 version string (ranges, partial versions, dist-tags and surrounding whitespace are not valid)",
					$I.annote("ExactVersionStringCheck", { description: "An exact SemVer 2.0.0 version string without surrounding whitespace." }),
				),
			]),
		),
		$I.annoteSchema("ExactVersionString", { description: "An exact SemVer 2.0.0 version string without surrounding whitespace." }),
	);

	/**
	 * `Schema.String` refined by {@link SemVer.isPinnable}: an exact,
	 * build-metadata-free SemVer 2.0.0 version string whose type stays
	 * `string`.
	 *
	 * **Details**
	 *
	 * The corepack-pinnable notion: what the `<name>@<version>[+<integrity>]`
	 * pin grammar can express in its version position, where the first `+`
	 * always begins the integrity component. `@effected/package-json`'s
	 * `PackageManager` field model uses this schema directly.
	 *
	 * **Example** (Validate a prerelease pin)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as S from "effect/Schema";
	 *
	 * console.log(S.decodeUnknownSync(SemVer.PinnableVersionString)("1.2.3-rc.1")); // 1.2.3-rc.1
	 * ```
	 *
	 * @category schemas
	 * @since 0.0.0
	 */
	static readonly PinnableVersionString: S.String = S.String.pipe(
		S.check(
			S.makeFilterGroup([
				S.makeFilter((value) =>
					SemVer.isPinnable(value)
						? undefined
						: "Expected an exact SemVer version with no build metadata (ranges, partial versions, dist-tags and surrounding whitespace are not pinnable)",
					$I.annote("PinnableVersionStringCheck", { description: "An exact SemVer version string without build metadata or surrounding whitespace." }),
				),
			]),
		),
		$I.annoteSchema("PinnableVersionString", { description: "An exact SemVer version string without build metadata or surrounding whitespace." }),
	);

	// ── Construction ────────────────────────────────────────────────────

	/**
	 * Parse a strict SemVer 2.0.0 version string, synchronously, returning a
	 * `Result` instead of an `Effect`.
	 *
	 * **Details**
	 *
	 * Rejects `v`/`V` prefixes, `=` prefixes, leading zeros on numeric
	 * identifiers and partially consumed input.
	 *
	 * **Gotchas**
	 *
	 * **Surrounding whitespace is TRIMMED before parsing**, matching
	 * node-semver's constructor: `" 1.2.3"` parses successfully. When padded
	 * input should be the caller's error rather than silently canonicalized,
	 * reach for {@link SemVer.isValid} / {@link SemVer.ExactVersionString}
	 * (or their pinnable twins), which deliberately reject it.
	 *
	 * {@link SemVer.parse} is defined in terms of this function; the two never
	 * diverge. Reach for the `Effect` variant inside Effect code — it carries
	 * the `SemVer.parse` tracing span — and for this one at synchronous
	 * boundaries.
	 *
	 * **Example** (Parse a version and reject a prefixed version)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as Result from "effect/Result";
	 *
	 * const ok = SemVer.parseResult("1.2.3");
	 * if (Result.isSuccess(ok)) {
	 *   console.log(ok.success.major); // 1
	 * }
	 * const bad = SemVer.parseResult("v1.2.3");
	 * if (Result.isFailure(bad)) {
	 *   console.log(bad.failure._tag); // InvalidVersionError
	 * }
	 * ```
	 *
	 * @param input - the version string to parse
	 * @returns a `Result` succeeding with the parsed {@link SemVer}, or failing
	 * with {@link InvalidVersionError} when `input` is not a valid version
	 * string.
	 * @category parsing
	 * @since 0.0.0
	 */
	static parseResult(input: string): Result.Result<SemVer, InvalidVersionError> {
		const result = parseVersion(input);
		if (!result.ok) {
			return Result.fail(InvalidVersionError.make({ input: result.input, position: result.position }));
		}
		return Result.succeed(SemVer.make(result.value));
	}

	/**
	 * Parse a strict SemVer 2.0.0 version string. Defined in terms of
	 * {@link SemVer.parseResult} — synchronous callers can use that variant
	 * directly.
	 *
	 * **Example** (Run strict version parsing)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as Effect from "effect/Effect";
	 *
	 * console.log(Effect.runSync(SemVer.parse("1.2.3")).toString()); // 1.2.3
	 * ```
	 *
	 * @param input - the version string to parse
	 * @returns the parsed {@link SemVer}. Fails with {@link InvalidVersionError}
	 * when `input` is not a valid version string.
	 * @category parsing
	 * @since 0.0.0
	 */
	static readonly parse = Effect.fn("SemVer.parse")((input: string) => Effect.fromResult(SemVer.parseResult(input)));

	// ── Validation ──────────────────────────────────────────────────────

	/**
	 * Whether `input` is a valid SemVer 2.0.0 version string, exactly as
	 * given.
	 *
	 * **Details**
	 *
	 * Strict grammar validity — the same grammar as {@link SemVer.parseResult}
	 * — with one deliberate divergence: surrounding whitespace is **rejected**.
	 * `parseResult` trims its input (matching node-semver, whose `SemVer`
	 * constructor trims), so `" 1.2.3"` parses; this predicate answers a
	 * different question — "is this string, byte for byte, a version?" — and a
	 * padded input is the caller's bug to surface, not this package's to hide.
	 * Build metadata is valid grammar (`isValid("1.2.3+build")` is `true`);
	 * reach for {@link SemVer.isPinnable} when the `+` position must stay
	 * free.
	 *
	 * **Example** (Reject padded input without coercion)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.isValid("1.2.3+build")); // true
	 * console.log(SemVer.isValid(" 1.2.3")); // false
	 * ```
	 *
	 * @param input - the candidate version string
	 * @returns `true` when `input` is a valid version string with no
	 * surrounding whitespace.
	 * @category predicates
	 * @since 0.0.0
	 */
	static isValid(input: string): boolean {
		return input === input.trim() && Result.isSuccess(SemVer.parseResult(input));
	}

	/**
	 * Whether `input` is a corepack-pinnable version string: valid by
	 * {@link SemVer.isValid} **and** carrying no build metadata.
	 *
	 * **Details**
	 *
	 * The notion the `<name>@<version>[+<integrity>]` pin grammar needs: there
	 * the first `+` after the version always begins the integrity component,
	 * so a version carrying build identifiers would encode to a string that
	 * re-parses differently. Prerelease versions are pinnable; the whitespace
	 * posture is {@link SemVer.isValid}'s.
	 *
	 * **Example** (Keep the integrity separator available)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.isPinnable("1.2.3-rc.1")); // true
	 * console.log(SemVer.isPinnable("1.2.3+build")); // false
	 * ```
	 *
	 * @param input - the candidate version string
	 * @returns `true` when `input` is a valid version string with no
	 * surrounding whitespace (the string equals its own trim) and whose
	 * build metadata is empty.
	 * @category predicates
	 * @since 0.0.0
	 */
	static isPinnable(input: string): boolean {
		if (input !== input.trim()) {
			return false;
		}
		const parsed = SemVer.parseResult(input);
		return Result.isSuccess(parsed) && parsed.success.build.length === 0;
	}

	/**
	 * Positional convenience constructor: `SemVer.of(1, 2, 3)`.
	 *
	 * **Example** (Construct a version from ordered components)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3, ["rc", 1], ["build"]).toString()); // 1.2.3-rc.1+build
	 * ```
	 *
	 * @param major - the major version component
	 * @param minor - the minor version component
	 * @param patch - the patch version component
	 * @param prerelease - prerelease identifiers, most-significant first; defaults to none
	 * @param build - build metadata identifiers; defaults to none
	 * @returns the constructed {@link SemVer}
	 * @category constructors
	 * @since 0.0.0
	 */
	static of(
		major: number,
		minor: number,
		patch: number,
		prerelease: ReadonlyArray<string | number> = [],
		build: ReadonlyArray<string> = [],
	): SemVer {
		return SemVer.make({ major, minor, patch, prerelease, build });
	}

	// ── Ordering ────────────────────────────────────────────────────────

	/**
	 * `Order` instance following SemVer 2.0.0 precedence (§11); build
	 * metadata is ignored (§10).
	 *
	 * **Example** (Compare precedence without build metadata)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.Order(SemVer.of(1, 2, 3, [], ["a"]), SemVer.of(1, 2, 3, [], ["b"]))); // 0
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static readonly Order: Order.Order<SemVer> = Order.make((a, b) => a.compare(b));

	/**
	 * `Order` instance that additionally compares build metadata lexically
	 * when versions are otherwise equal, producing a total order over
	 * distinct version strings. Not spec precedence — use {@link SemVer.Order}
	 * unless a deterministic tiebreak across build metadata is required.
	 *
	 * **Example** (Break a precedence tie by build metadata)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.OrderWithBuild(SemVer.of(1, 2, 3, [], ["a"]), SemVer.of(1, 2, 3, [], ["b"]))); // -1
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static readonly OrderWithBuild: Order.Order<SemVer> = Order.make((a, b) => {
		const base = a.compare(b);
		return base !== 0 ? base : compareBuild(a.build, b.build);
	});

	// ── Comparison statics (dual) ───────────────────────────────────────

	/**
	 * Compare two versions. Returns `-1`, `0`, or `1`. Dual API.
	 *
	 * **Example** (Compare two versions)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.compare(SemVer.of(1, 0, 0), SemVer.of(2, 0, 0))); // -1
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static readonly compare: {
		(that: SemVer): (self: SemVer) => -1 | 0 | 1;
		(self: SemVer, that: SemVer): -1 | 0 | 1;
	} = Fn.dual(2, (self: SemVer, that: SemVer): -1 | 0 | 1 => self.compare(that));

	/**
	 * Test whether `self > that`. Dual API.
	 *
	 * **Example** (Test greater precedence)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.gt(SemVer.of(2, 0, 0))(SemVer.of(3, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static readonly gt: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.gt(that));

	/**
	 * Test whether `self >= that`. Dual API.
	 *
	 * **Example** (Include equal precedence)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.gte(SemVer.of(1, 0, 0), SemVer.of(1, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static readonly gte: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.gte(that));

	/**
	 * Test whether `self < that`. Dual API.
	 *
	 * **Example** (Test lower precedence)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.lt(SemVer.of(1, 0, 0), SemVer.of(2, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static readonly lt: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.lt(that));

	/**
	 * Test whether `self <= that`. Dual API.
	 *
	 * **Example** (Include equal lower precedence)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.lte(SemVer.of(1, 0, 0), SemVer.of(1, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static readonly lte: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.lte(that));

	/**
	 * Test whether two versions are equal (ignores build metadata). Dual API.
	 *
	 * **Example** (Ignore build metadata in equality)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.equal(SemVer.of(1, 0, 0, [], ["a"]), SemVer.of(1, 0, 0, [], ["b"]))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static readonly equal: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.equal(that));

	/**
	 * Test whether two versions are not equal (ignores build metadata). Dual API.
	 *
	 * **Example** (Detect different precedence)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.neq(SemVer.of(1, 0, 0), SemVer.of(2, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static readonly neq: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.neq(that));

	/**
	 * Strip components below the given level: `"prerelease"` keeps only
	 * `major.minor.patch`, `"build"` keeps the prerelease but drops build
	 * metadata. Dual API.
	 *
	 * **Example** (Drop prerelease and build components)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * const version = SemVer.of(1, 2, 3, ["rc", 1], ["build"]);
	 * console.log(SemVer.truncate(version, "prerelease").toString()); // 1.2.3
	 * console.log(SemVer.truncate("build")(version).toString()); // 1.2.3-rc.1
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static readonly truncate: {
		(level: "prerelease" | "build"): (self: SemVer) => SemVer;
		(self: SemVer, level: "prerelease" | "build"): SemVer;
	} = Fn.dual(
		2,
		(self: SemVer, level: "prerelease" | "build"): SemVer =>
			level === "prerelease"
				? SemVer.make({ major: self.major, minor: self.minor, patch: self.patch, prerelease: [], build: [] })
				: SemVer.make({
						major: self.major,
						minor: self.minor,
						patch: self.patch,
						prerelease: self.prerelease,
						build: [],
					}),
	);

	// ── Collection statics ──────────────────────────────────────────────

	/**
	 * Sort versions ascending by SemVer precedence. Returns a new array.
	 *
	 * **Example** (Collect versions with sort)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * const versions = [SemVer.of(2, 0, 0), SemVer.of(1, 0, 0), SemVer.of(1, 0, 1)];
	 * console.log(SemVer.sort(versions).map((version) => version.toString()).join(", ")); // 1.0.0, 1.0.1, 2.0.0
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static sort(versions: ReadonlyArray<SemVer>): Array<SemVer> {
		return A.sort(versions, SemVer.Order);
	}

	/**
	 * Sort versions descending by SemVer precedence. Returns a new array.
	 *
	 * **Example** (Collect versions with rsort)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * const versions = [SemVer.of(2, 0, 0), SemVer.of(1, 0, 0), SemVer.of(1, 0, 1)];
	 * console.log(SemVer.rsort(versions).map((version) => version.toString()).join(", ")); // 2.0.0, 1.0.1, 1.0.0
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static rsort(versions: ReadonlyArray<SemVer>): Array<SemVer> {
		return A.sort(versions, Order.flip(SemVer.Order));
	}

	/**
	 * Highest version, or `Option.none()` if the array is empty.
	 *
	 * **Example** (Find the maximum version and handle an empty collection)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as O from "effect/Option";
	 *
	 * const versions = [SemVer.of(1, 0, 0), SemVer.of(2, 0, 0)];
	 * console.log(O.getOrThrow(SemVer.max(versions)).toString()); // 2.0.0
	 * console.log(O.isNone(SemVer.max([]))); // true
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static max(versions: ReadonlyArray<SemVer>): O.Option<SemVer> {
		let best: SemVer | undefined;
		for (const v of versions) {
			if (best === undefined || v.gt(best)) best = v;
		}
		return best === undefined ? O.none() : O.some(best);
	}

	/**
	 * Lowest version, or `Option.none()` if the array is empty.
	 *
	 * **Example** (Find the minimum version and handle an empty collection)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as O from "effect/Option";
	 *
	 * const versions = [SemVer.of(1, 0, 0), SemVer.of(2, 0, 0)];
	 * console.log(O.getOrThrow(SemVer.min(versions)).toString()); // 1.0.0
	 * console.log(O.isNone(SemVer.min([]))); // true
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static min(versions: ReadonlyArray<SemVer>): O.Option<SemVer> {
		let best: SemVer | undefined;
		for (const v of versions) {
			if (best === undefined || v.lt(best)) best = v;
		}
		return best === undefined ? O.none() : O.some(best);
	}

	/**
	 * Group versions by major (`"1"`), major.minor (`"1.2"`) or
	 * major.minor.patch (`"1.2.3"`) key. Groups and their members are in
	 * ascending precedence order. Pure derivation — an immutable record, not
	 * a service operation.
	 *
	 * **Example** (Read versions grouped by minor)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as O from "effect/Option";
	 * import * as R from "effect/Record";
	 *
	 * const groups = SemVer.groupBy([SemVer.of(1, 2, 4), SemVer.of(1, 2, 3)], "minor");
	 * const group = O.getOrThrow(R.get(groups, "1.2"));
	 * console.log(group.map((version) => version.toString()).join(", ")); // 1.2.3, 1.2.4
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static groupBy(
		versions: ReadonlyArray<SemVer>,
		strategy: "major" | "minor" | "patch",
	): Record<string, ReadonlyArray<SemVer>> {
		return A.groupBy(SemVer.sort(versions), (version) =>
			Match.value(strategy).pipe(
				Match.when("major", () => `${version.major}`),
				Match.when("minor", () => `${version.major}.${version.minor}`),
				Match.when("patch", () => `${version.major}.${version.minor}.${version.patch}`),
				Match.exhaustive,
			),
		);
	}

	/**
	 * The highest version for each distinct major version, ascending.
	 *
	 * **Example** (Collect versions with latestByMajor)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * const versions = [SemVer.of(2, 0, 0), SemVer.of(1, 0, 0), SemVer.of(1, 0, 1)];
	 * console.log(SemVer.latestByMajor(versions).map((version) => version.toString()).join(", ")); // 1.0.1, 2.0.0
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static latestByMajor(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> {
		const latest = MutableHashMap.empty<number, SemVer>();
		for (const version of SemVer.sort(versions)) {
			MutableHashMap.set(latest, version.major, version);
		}
		return latest.pipe(MutableHashMap.values, A.fromIterable);
	}

	/**
	 * The highest version for each distinct major.minor pair, ascending.
	 *
	 * **Example** (Collect versions with latestByMinor)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * const versions = [SemVer.of(2, 0, 0), SemVer.of(1, 0, 0), SemVer.of(1, 0, 1)];
	 * console.log(SemVer.latestByMinor(versions).map((version) => version.toString()).join(", ")); // 1.0.1, 2.0.0
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	static latestByMinor(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> {
		const latest = MutableHashMap.empty<string, SemVer>();
		for (const version of SemVer.sort(versions)) {
			MutableHashMap.set(latest, `${version.major}.${version.minor}`, version);
		}
		return latest.pipe(MutableHashMap.values, A.fromIterable);
	}

	// ── Instance: comparison ────────────────────────────────────────────

	/**
	 * Compare `this` to `that` per SemVer 2.0.0 precedence. Returns `-1`, `0`, or `1`.
	 *
	 * **Example** (Compare instance precedence)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 0, 0).compare(SemVer.of(2, 0, 0))); // -1
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	compare(that: SemVer): -1 | 0 | 1 {
		if (this.major !== that.major) return this.major > that.major ? 1 : -1;
		if (this.minor !== that.minor) return this.minor > that.minor ? 1 : -1;
		if (this.patch !== that.patch) return this.patch > that.patch ? 1 : -1;

		const aPre = this.prerelease;
		const bPre = that.prerelease;
		if (aPre.length === 0 && bPre.length === 0) return 0;
		if (aPre.length === 0) return 1;
		if (bPre.length === 0) return -1;

		const len = Math.min(aPre.length, bPre.length);
		for (let i = 0; i < len; i++) {
			const cmp = comparePrereleaseIdentifier(A.getUnsafe(aPre, i), A.getUnsafe(bPre, i));
			if (cmp !== 0) return cmp < 0 ? -1 : 1;
		}

		if (aPre.length !== bPre.length) return aPre.length > bPre.length ? 1 : -1;
		return 0;
	}

	/**
	 * Test whether `this > that`.
	 *
	 * **Example** (Test greater precedence through an instance)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(3, 0, 0).gt(SemVer.of(2, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	gt(that: SemVer): boolean {
		return this.compare(that) === 1;
	}

	/**
	 * Test whether `this >= that`.
	 *
	 * **Example** (Include equal precedence through an instance)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 0, 0).gte(SemVer.of(1, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	gte(that: SemVer): boolean {
		return this.compare(that) >= 0;
	}

	/**
	 * Test whether `this < that`.
	 *
	 * **Example** (Test lower precedence through an instance)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 0, 0).lt(SemVer.of(2, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	lt(that: SemVer): boolean {
		return this.compare(that) === -1;
	}

	/**
	 * Test whether `this <= that`.
	 *
	 * **Example** (Include equal lower precedence through an instance)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 0, 0).lte(SemVer.of(1, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	lte(that: SemVer): boolean {
		return this.compare(that) <= 0;
	}

	/**
	 * Test whether `this` equals `that` (ignores build metadata).
	 *
	 * **Example** (Ignore build metadata in equality through an instance)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 0, 0, [], ["a"]).equal(SemVer.of(1, 0, 0, [], ["b"]))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	equal(that: SemVer): boolean {
		return this.compare(that) === 0;
	}

	/**
	 * Test whether `this` does not equal `that` (ignores build metadata).
	 *
	 * **Example** (Detect different precedence through an instance)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 0, 0).neq(SemVer.of(2, 0, 0))); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	neq(that: SemVer): boolean {
		return this.compare(that) !== 0;
	}

	// ── Instance: predicates ────────────────────────────────────────────

	/**
	 * Whether this is a prerelease version.
	 *
	 * **Example** (Identify a prerelease)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3, ["rc", 1]).isPrerelease); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isPrerelease(): boolean {
		return this.prerelease.length > 0;
	}

	/**
	 * Whether this is a stable (non-prerelease) version.
	 *
	 * **Example** (Identify a stable version)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3).isStable); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isStable(): boolean {
		return this.prerelease.length === 0;
	}

	// ── Instance: bump ──────────────────────────────────────────────────

	/**
	 * Version bumping operations, grouped for discoverability.
	 *
	 * **Example** (Access grouped bump operations)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3).bump.minor().toString()); // 1.3.0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get bump(): SemVerBump {
		return new SemVerBump(this);
	}

	// ── Equality & hashing ──────────────────────────────────────────────

	// Structural equality deliberately ignores build metadata (SemVer §10)
	// while including exact prerelease identifiers (§11). Hash must agree:
	// Equal.equals short-circuits on hash mismatch.

	/**
	 * Supports Effect structural equality using exact prerelease identifiers while ignoring build metadata.
	 *
	 * **Example** (Compare structural equality across builds)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as Equal from "effect/Equal";
	 *
	 * const left = SemVer.of(1, 2, 3, ["rc", 1], ["a"]);
	 * const right = SemVer.of(1, 2, 3, ["rc", 1], ["b"]);
	 * console.log(Equal.equals(left, right)); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	[Equal.symbol](that: unknown): boolean {
		if (!(S.is(SemVer)(that))) return false;
		return (
			this.major === that.major &&
			this.minor === that.minor &&
			this.patch === that.patch &&
			this.prerelease.length === that.prerelease.length &&
			this.prerelease.every((v, i) => v === that.prerelease[i])
		);
	}

	/**
	 * Hashes the canonical version without build metadata so structurally equal versions share a hash.
	 *
	 * **Example** (Hash equal versions across builds)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import * as Hash from "effect/Hash";
	 *
	 * const left = SemVer.of(1, 2, 3, [], ["a"]);
	 * const right = SemVer.of(1, 2, 3, [], ["b"]);
	 * console.log(Hash.hash(left) === Hash.hash(right)); // true
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	[Hash.symbol](): number {
		return Hash.string(
			formatVersion({
				major: this.major,
				minor: this.minor,
				patch: this.patch,
				prerelease: this.prerelease,
				build: [],
			}),
		);
	}

	// ── Display ─────────────────────────────────────────────────────────

	/**
	 * The canonical `major.minor.patch[-prerelease][+build]` string.
	 *
	 * **Example** (Format prerelease and build metadata)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3, ["rc", 1], ["build"]).toString()); // 1.2.3-rc.1+build
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	override toString(): string {
		return formatVersion(this);
	}

	/**
	 * Returns the canonical version string for Node.js custom inspection.
	 *
	 * **Example** (Inspect the canonical version string)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 * import { inspect } from "node:util";
	 *
	 * console.log(inspect(SemVer.of(1, 2, 3))); // 1.2.3
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

// Raised in place of `SemVer.make`'s raw schema failure when a bump would
// increment a component past `Number.MAX_SAFE_INTEGER`. This is an arithmetic
// invariant, not malformed input — `SemVerBump` only ever increments
// components already validated on the receiver — so it stays a thrown defect
// rather than a typed `Effect` failure, matching every other
// `SemVer`/`SemVerBump` method's synchronous, non-`Effect` signature. The
// original `SemVer.make` schema failure rides as `cause`.
/**
 * The component whose bump exceeded the safe-integer cap.
 *
 * **Example** (Validate an overflow component)
 *
 * ```ts
 * import { SemVerBumpComponent } from "@beep/scratchpad/effected/semver/SemVer";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(SemVerBumpComponent)("prerelease")); // prerelease
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SemVerBumpComponent = LiteralKit(["major", "minor", "patch", "prerelease"]).annotate(
	$I.annote("SemVerBumpComponent", { description: "The component whose bump exceeded the safe-integer cap." }),
);
/**
 * Identifies the version component whose bump exceeded the safe-integer cap.
 *
 * @see {@link SemVerBumpComponent} for the runtime component schema.
 * @category type-level
 * @since 0.0.0
 */
export type SemVerBumpComponent = typeof SemVerBumpComponent.Type;

/**
 * A synchronous bump exceeded the safe-integer cap. Retains the underlying
 * schema failure as its cause.
 *
 * **Example** (Inspect a bump overflow)
 *
 * ```ts
 * import { SemVerBumpOverflowError } from "@beep/scratchpad/effected/semver/SemVer";
 *
 * const error = SemVerBumpOverflowError.make({ component: "major", cause: undefined });
 * console.log(error.component); // major
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SemVerBumpOverflowError extends S.TaggedError<SemVerBumpOverflowError>($I`SemVerBumpOverflowError`)(
	"SemVerBumpOverflowError",
	{
		component: SemVerBumpComponent.annotateKey({ description: "The component that overflowed." }),
		cause: S.Defect({ includeStack: true }).annotateKey({ description: "The underlying schema validation failure." }),
	},
	$I.annote("SemVerBumpOverflowError", { description: "A SemVer bump exceeded the safe-integer cap." }),
) {
	/**
	 * Explains which component would exceed the safe-integer cap during a bump.
	 *
	 * **Example** (Read an overflow invariant message)
	 *
	 * ```ts
	 * import { SemVerBumpOverflowError } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * const error = SemVerBumpOverflowError.make({ component: "patch", cause: undefined });
	 * console.log(error.message); // SemVerBump invariant violated: bumping "patch" would exceed Number.MAX_SAFE_INTEGER (9007199254740991)
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return `SemVerBump invariant violated: bumping "${this.component}" would exceed Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER})`;
	}
}

function overflow(component: SemVerBumpComponent, cause: unknown): never {
	throw SemVerBumpOverflowError.make({
		component,
		cause,
	});
}

/**
 * Grouped bump operations returned by the {@link SemVer.bump} accessor
 * (`v.bump.minor()`) — `bump` is an instance **getter**, not a static, so it
 * is always reached through a `SemVer` instance. Every operation returns a
 * new {@link SemVer}; build metadata never survives a bump.
 *
 * **Details**
 *
 * `major`/`minor`/`patch` always increment the requested component, whether
 * or not the receiver is a prerelease — this deliberately diverges from
 * node-semver, where `inc("2.0.0-beta.1", "major")` answers `"2.0.0"` (the
 * release target of an in-progress prerelease, not a further increment). Here
 * the same call answers `"3.0.0"`.
 *
 * **Example** (Bump patch, minor and prerelease versions)
 *
 * ```ts
 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
 *
 * const v = SemVer.of(1, 2, 3);
 * console.log(v.bump.patch().toString()); // 1.2.4
 * console.log(v.bump.minor().toString()); // 1.3.0
 * console.log(v.bump.prerelease("rc").toString()); // 1.2.4-rc.0
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class SemVerBump {
	private readonly v: SemVer;

	constructor(v: SemVer) {
		this.v = v;
	}

	/**
	 * Bump major (resets minor, patch, prerelease, build).
	 *
	 * **Example** (Increment the major component)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3, ["rc", 1], ["build"]).bump.major().toString()); // 2.0.0
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	major(): SemVer {
		try {
			return SemVer.make({ major: this.v.major + 1, minor: 0, patch: 0, prerelease: [], build: [] });
		} catch (cause) {
			overflow("major", cause);
		}
	}

	/**
	 * Bump minor (resets patch, prerelease, build).
	 *
	 * **Example** (Increment the minor component)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3, ["rc", 1], ["build"]).bump.minor().toString()); // 1.3.0
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	minor(): SemVer {
		try {
			return SemVer.make({ major: this.v.major, minor: this.v.minor + 1, patch: 0, prerelease: [], build: [] });
		} catch (cause) {
			overflow("minor", cause);
		}
	}

	/**
	 * Bump patch (resets prerelease, build).
	 *
	 * **Example** (Increment the patch component)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3, ["rc", 1], ["build"]).bump.patch().toString()); // 1.2.4
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	patch(): SemVer {
		try {
			return SemVer.make({
				major: this.v.major,
				minor: this.v.minor,
				patch: this.v.patch + 1,
				prerelease: [],
				build: [],
			});
		} catch (cause) {
			overflow("patch", cause);
		}
	}

	/**
	 * Bump prerelease, optionally with a named identifier. Node-semver
	 * compatible: a stable version starts a prerelease of the next patch
	 * (`1.0.0` → `1.0.1-0`), switching identifiers resets the counter, and a
	 * trailing numeric identifier increments.
	 *
	 * **Example** (Advance and switch prerelease identifiers)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * const v = SemVer.of(1, 0, 0);
	 * const rc = v.bump.prerelease("rc");
	 * console.log(v.bump.prerelease().toString()); // 1.0.1-0
	 * console.log(rc.bump.prerelease().toString()); // 1.0.1-rc.1
	 * console.log(rc.bump.prerelease("beta").toString()); // 1.0.1-beta.0
	 * ```
	 *
	 * @param id - the prerelease identifier prefix (e.g. `"rc"`); when omitted, only the trailing numeric counter is bumped
	 * @returns the bumped {@link SemVer}
	 * @category utilities
	 * @since 0.0.0
	 */
	prerelease(id?: string): SemVer {
		const { major, minor, patch } = this.v;
		const pre = this.v.prerelease;

		if (pre.length === 0) {
			try {
				return SemVer.make({
					major,
					minor,
					patch: patch + 1,
					prerelease: id !== undefined ? [id, 0] : [0],
					build: [],
				});
			} catch (cause) {
				overflow("patch", cause);
			}
		}

		if (id !== undefined) {
			const currentPrefix = P.isString(pre[0]) ? pre[0] : null;
			if (currentPrefix !== id) {
				return SemVer.make({ major, minor, patch, prerelease: [id, 0], build: [] });
			}
		}

		const last = pre[pre.length - 1];
		if (P.isNumber(last)) {
			const next: Array<string | number> = [...pre];
			next[next.length - 1] = last + 1;
			try {
				return SemVer.make({ major, minor, patch, prerelease: next, build: [] });
			} catch (cause) {
				overflow("prerelease", cause);
			}
		}

		return SemVer.make({ major, minor, patch, prerelease: [...pre, 0], build: [] });
	}

	/**
	 * Strip prerelease and build, keeping major.minor.patch.
	 *
	 * **Example** (Remove prerelease and build metadata)
	 *
	 * ```ts
	 * import { SemVer } from "@beep/scratchpad/effected/semver/SemVer";
	 *
	 * console.log(SemVer.of(1, 2, 3, ["rc", 1], ["build"]).bump.release().toString()); // 1.2.3
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	release(): SemVer {
		return SemVer.make({
			major: this.v.major,
			minor: this.v.minor,
			patch: this.v.patch,
			prerelease: [],
			build: [],
		});
	}
}
