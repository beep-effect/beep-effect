import {
	Effect,
	Equal,
	Function as Fn,
	Hash,
	Option,
	Order,
	Result,
	Schema,
	SchemaIssue,
	SchemaTransformation,
} from "effect";
import { formatVersion, parseVersion } from "./internal/grammar.ts";
import { compareBuild, comparePrereleaseIdentifier } from "./internal/order.ts";

/**
 * Indicates that a string could not be parsed as a valid SemVer 2.0.0 version.
 *
 * Raised by {@link SemVer.parse}. The decode direction of
 * {@link SemVer.FromString} reports the same failure through a generic
 * `Schema` parse error instead of this class, carrying the same message.
 * Unlike node-semver, no loose parsing or `v`-prefix coercion is performed.
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 * @public
 */
export class InvalidVersionError extends Schema.TaggedError<InvalidVersionError>()("InvalidVersionError", {
	/** The raw input string that failed to parse. */
	input: Schema.String,
	/** The character position where parsing failed, if available. */
	position: Schema.optionalKey(Schema.Number),
}) {
	override get message(): string {
		const base = `Invalid version string: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}

// Non-negative safe integer schema shared by the `major`/`minor`/`patch`
// fields.
const nonNegativeInteger = Schema.Number.check(
	Schema.isInt(),
	Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
);

// String prerelease identifiers must contain at least one non-digit:
// all-numeric identifiers are numbers (the grammar parses them as such), so
// requiring a non-digit keeps decode/encode round-trips canonical. Written
// without lookahead so `Schema.toArbitrary` can derive a generator.
const prereleaseIdentifier = Schema.Union([
	Schema.String.check(Schema.isPattern(/^[0-9]*[A-Za-z-][0-9A-Za-z-]*$/)),
	nonNegativeInteger,
]);

// Build identifiers allow leading zeros and all-digit tokens (SemVer §10).
const buildIdentifier = Schema.String.check(Schema.isPattern(/^[0-9A-Za-z-]+$/));

/**
 * A parsed SemVer 2.0.0 version: an Effect `Schema.Class` whose fields are
 * validated in-schema (non-negative integer components, well-formed
 * identifiers), so `SemVer.make` only produces valid versions.
 *
 * Instance methods are the canonical API; cross-cutting operations exist as
 * dual statics on the class. The string representation is the schema's
 * encoded form via {@link SemVer.FromString}.
 *
 * @example
 * ```ts
 * import { SemVer } from "@effected/semver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.parse("1.2.3");
 *   const next = v.bump.minor();
 *   return [next.toString(), v.gt(next), next.isStable] as const;
 * });
 *
 * console.log(Effect.runSync(program));
 * // => ["1.3.0", false, true]
 * ```
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 * @public
 */
export class SemVer extends Schema.Class<SemVer>("SemVer")({
	/** The major version component; incompatible API changes. */
	major: nonNegativeInteger,
	/** The minor version component; backward-compatible functionality. */
	minor: nonNegativeInteger,
	/** The patch version component; backward-compatible fixes. */
	patch: nonNegativeInteger,
	/** Prerelease identifiers, most-significant first; `[]` for a stable version. */
	prerelease: Schema.Array(prereleaseIdentifier),
	/** Build metadata identifiers; ignored by precedence comparisons (§10). */
	build: Schema.Array(buildIdentifier),
}) {
	// ── Schema ──────────────────────────────────────────────────────────

	/**
	 * Schema transformation between the canonical version string and
	 * {@link SemVer}: decoding parses with the strict grammar, encoding
	 * prints `major.minor.patch[-prerelease][+build]`.
	 */
	static readonly FromString: Schema.Codec<SemVer, string> = Schema.String.pipe(
		Schema.decodeTo(
			SemVer,
			SchemaTransformation.transformOrFail({
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
	 * @remarks
	 * For consumer structs whose field must remain a plain string — a manifest
	 * model, an action input — while still refusing everything that is not
	 * exactly one version: ranges, partial versions, dist-tags, and padded
	 * input (see {@link SemVer.isValid} for the whitespace posture). Build
	 * metadata is valid grammar and passes; reach for
	 * {@link SemVer.PinnableVersionString} when the `+` position is spoken for.
	 * Decode to a {@link SemVer} instance with {@link SemVer.FromString}
	 * instead when the parsed components are wanted.
	 */
	static readonly ExactVersionString: Schema.String = Schema.String.pipe(
		Schema.check(
			Schema.makeFilter((value) =>
				SemVer.isValid(value)
					? undefined
					: "Expected an exact SemVer 2.0.0 version string (ranges, partial versions, dist-tags and surrounding whitespace are not valid)",
			),
		),
	);

	/**
	 * `Schema.String` refined by {@link SemVer.isPinnable}: an exact,
	 * build-metadata-free SemVer 2.0.0 version string whose type stays
	 * `string`.
	 *
	 * @remarks
	 * The corepack-pinnable notion: what the `<name>@<version>[+<integrity>]`
	 * pin grammar can express in its version position, where the first `+`
	 * always begins the integrity component. `@effected/package-json`'s
	 * `PackageManager` field model consumes this schema directly; suites that
	 * must prove they share it rather than carrying a copy can assert object
	 * identity against this export.
	 */
	static readonly PinnableVersionString: Schema.String = Schema.String.pipe(
		Schema.check(
			Schema.makeFilter((value) =>
				SemVer.isPinnable(value)
					? undefined
					: "Expected an exact SemVer version with no build metadata (ranges, partial versions, dist-tags and surrounding whitespace are not pinnable)",
			),
		),
	);

	// ── Construction ────────────────────────────────────────────────────

	/**
	 * Parse a strict SemVer 2.0.0 version string, synchronously, returning a
	 * `Result` instead of an `Effect`.
	 *
	 * Rejects `v`/`V` prefixes, `=` prefixes, leading zeros on numeric
	 * identifiers and partially consumed input.
	 *
	 * @remarks
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
	 * @example
	 * ```ts
	 * import { SemVer } from "@effected/semver";
	 * import { Result } from "effect";
	 *
	 * const ok = SemVer.parseResult("1.2.3");
	 * if (Result.isSuccess(ok)) {
	 *   console.log(ok.success.major); // => 1
	 * }
	 *
	 * const bad = SemVer.parseResult("v1.2.3");
	 * if (Result.isFailure(bad)) {
	 *   console.log(bad.failure._tag); // => "InvalidVersionError"
	 * }
	 * ```
	 *
	 * @param input - the version string to parse
	 * @returns a `Result` succeeding with the parsed {@link SemVer}, or failing
	 * with {@link InvalidVersionError} when `input` is not a valid version
	 * string.
	 */
	static parseResult(input: string): Result.Result<SemVer, InvalidVersionError> {
		const result = parseVersion(input);
		if (!result.ok) {
			return Result.fail(new InvalidVersionError({ input: result.input, position: result.position }));
		}
		return Result.succeed(SemVer.make(result.value));
	}

	/**
	 * Parse a strict SemVer 2.0.0 version string. Defined in terms of
	 * {@link SemVer.parseResult} — synchronous callers can use that variant
	 * directly.
	 *
	 * @param input - the version string to parse
	 * @returns the parsed {@link SemVer}. Fails with {@link InvalidVersionError}
	 * when `input` is not a valid version string.
	 */
	static readonly parse = Effect.fn("SemVer.parse")((input: string) => Effect.fromResult(SemVer.parseResult(input)));

	// ── Validation ──────────────────────────────────────────────────────

	/**
	 * Whether `input` is a valid SemVer 2.0.0 version string, exactly as
	 * given.
	 *
	 * @remarks
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
	 * @param input - the candidate version string
	 * @returns `true` when `input` is a valid version string with no
	 * surrounding whitespace.
	 */
	static isValid(input: string): boolean {
		return input === input.trim() && Result.isSuccess(SemVer.parseResult(input));
	}

	/**
	 * Whether `input` is a corepack-pinnable version string: valid by
	 * {@link SemVer.isValid} **and** carrying no build metadata.
	 *
	 * @remarks
	 * The notion the `<name>@<version>[+<integrity>]` pin grammar needs: there
	 * the first `+` after the version always begins the integrity component,
	 * so a version carrying build identifiers would encode to a string that
	 * re-parses differently. Prerelease versions are pinnable; the whitespace
	 * posture is {@link SemVer.isValid}'s.
	 *
	 * @param input - the candidate version string
	 * @returns `true` when `input` is a valid version string with no
	 * surrounding whitespace (the string equals its own trim) and whose
	 * build metadata is empty.
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
	 * @param major - the major version component
	 * @param minor - the minor version component
	 * @param patch - the patch version component
	 * @param prerelease - prerelease identifiers, most-significant first; defaults to none
	 * @param build - build metadata identifiers; defaults to none
	 * @returns the constructed {@link SemVer}
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
	 */
	static readonly Order: Order.Order<SemVer> = Order.make((a, b) => a.compare(b));

	/**
	 * `Order` instance that additionally compares build metadata lexically
	 * when versions are otherwise equal, producing a total order over
	 * distinct version strings. Not spec precedence — use {@link SemVer.Order}
	 * unless a deterministic tiebreak across build metadata is required.
	 */
	static readonly OrderWithBuild: Order.Order<SemVer> = Order.make((a, b) => {
		const base = a.compare(b);
		return base !== 0 ? base : compareBuild(a.build, b.build);
	});

	// ── Comparison statics (dual) ───────────────────────────────────────

	/** Compare two versions. Returns `-1`, `0`, or `1`. Dual API. */
	static readonly compare: {
		(that: SemVer): (self: SemVer) => -1 | 0 | 1;
		(self: SemVer, that: SemVer): -1 | 0 | 1;
	} = Fn.dual(2, (self: SemVer, that: SemVer): -1 | 0 | 1 => self.compare(that));

	/** Test whether `self > that`. Dual API. */
	static readonly gt: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.gt(that));

	/** Test whether `self >= that`. Dual API. */
	static readonly gte: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.gte(that));

	/** Test whether `self < that`. Dual API. */
	static readonly lt: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.lt(that));

	/** Test whether `self <= that`. Dual API. */
	static readonly lte: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.lte(that));

	/** Test whether two versions are equal (ignores build metadata). Dual API. */
	static readonly equal: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.equal(that));

	/** Test whether two versions are not equal (ignores build metadata). Dual API. */
	static readonly neq: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => self.neq(that));

	/**
	 * Strip components below the given level: `"prerelease"` keeps only
	 * `major.minor.patch`, `"build"` keeps the prerelease but drops build
	 * metadata. Dual API.
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

	/** Sort versions ascending by SemVer precedence. Returns a new array. */
	static sort(versions: ReadonlyArray<SemVer>): Array<SemVer> {
		return [...versions].sort(SemVer.Order);
	}

	/** Sort versions descending by SemVer precedence. Returns a new array. */
	static rsort(versions: ReadonlyArray<SemVer>): Array<SemVer> {
		return [...versions].sort((a, b) => b.compare(a));
	}

	/** Highest version, or `Option.none()` if the array is empty. */
	static max(versions: ReadonlyArray<SemVer>): Option.Option<SemVer> {
		let best: SemVer | undefined;
		for (const v of versions) {
			if (best === undefined || v.gt(best)) best = v;
		}
		return best === undefined ? Option.none() : Option.some(best);
	}

	/** Lowest version, or `Option.none()` if the array is empty. */
	static min(versions: ReadonlyArray<SemVer>): Option.Option<SemVer> {
		let best: SemVer | undefined;
		for (const v of versions) {
			if (best === undefined || v.lt(best)) best = v;
		}
		return best === undefined ? Option.none() : Option.some(best);
	}

	/**
	 * Group versions by major (`"1"`), major.minor (`"1.2"`) or
	 * major.minor.patch (`"1.2.3"`) key. Groups and their members are in
	 * ascending precedence order. Pure derivation — an immutable record, not
	 * a service operation.
	 */
	static groupBy(
		versions: ReadonlyArray<SemVer>,
		strategy: "major" | "minor" | "patch",
	): Record<string, ReadonlyArray<SemVer>> {
		const grouped: Record<string, Array<SemVer>> = {};
		for (const version of SemVer.sort(versions)) {
			let key: string;
			switch (strategy) {
				case "major":
					key = `${version.major}`;
					break;
				case "minor":
					key = `${version.major}.${version.minor}`;
					break;
				case "patch":
					key = `${version.major}.${version.minor}.${version.patch}`;
					break;
			}
			const group = grouped[key] ?? [];
			group.push(version);
			grouped[key] = group;
		}
		return grouped;
	}

	/** The highest version for each distinct major version, ascending. */
	static latestByMajor(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> {
		const latest = new Map<number, SemVer>();
		for (const version of SemVer.sort(versions)) {
			latest.set(version.major, version);
		}
		return Array.from(latest.values());
	}

	/** The highest version for each distinct major.minor pair, ascending. */
	static latestByMinor(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> {
		const latest = new Map<string, SemVer>();
		for (const version of SemVer.sort(versions)) {
			latest.set(`${version.major}.${version.minor}`, version);
		}
		return Array.from(latest.values());
	}

	// ── Instance: comparison ────────────────────────────────────────────

	/** Compare `this` to `that` per SemVer 2.0.0 precedence. Returns `-1`, `0`, or `1`. */
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
			const cmp = comparePrereleaseIdentifier(aPre[i], bPre[i]);
			if (cmp !== 0) return cmp < 0 ? -1 : 1;
		}

		if (aPre.length !== bPre.length) return aPre.length > bPre.length ? 1 : -1;
		return 0;
	}

	/** Test whether `this > that`. */
	gt(that: SemVer): boolean {
		return this.compare(that) === 1;
	}

	/** Test whether `this >= that`. */
	gte(that: SemVer): boolean {
		return this.compare(that) >= 0;
	}

	/** Test whether `this < that`. */
	lt(that: SemVer): boolean {
		return this.compare(that) === -1;
	}

	/** Test whether `this <= that`. */
	lte(that: SemVer): boolean {
		return this.compare(that) <= 0;
	}

	/** Test whether `this` equals `that` (ignores build metadata). */
	equal(that: SemVer): boolean {
		return this.compare(that) === 0;
	}

	/** Test whether `this` does not equal `that` (ignores build metadata). */
	neq(that: SemVer): boolean {
		return this.compare(that) !== 0;
	}

	// ── Instance: predicates ────────────────────────────────────────────

	/** Whether this is a prerelease version. */
	get isPrerelease(): boolean {
		return this.prerelease.length > 0;
	}

	/** Whether this is a stable (non-prerelease) version. */
	get isStable(): boolean {
		return this.prerelease.length === 0;
	}

	// ── Instance: bump ──────────────────────────────────────────────────

	/** Version bumping operations, grouped for discoverability. */
	get bump(): SemVerBump {
		return new SemVerBump(this);
	}

	// ── Equality & hashing ──────────────────────────────────────────────

	// Structural equality deliberately ignores build metadata (SemVer §10)
	// while including exact prerelease identifiers (§11). Hash must agree:
	// Equal.equals short-circuits on hash mismatch.

	[Equal.symbol](that: unknown): boolean {
		if (!(that instanceof SemVer)) return false;
		return (
			this.major === that.major &&
			this.minor === that.minor &&
			this.patch === that.patch &&
			this.prerelease.length === that.prerelease.length &&
			this.prerelease.every((v, i) => v === that.prerelease[i])
		);
	}

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

	/** The canonical `major.minor.patch[-prerelease][+build]` string. */
	override toString(): string {
		return formatVersion(this);
	}

	/** @internal */
	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}

/**
 * Grouped bump operations returned by the {@link SemVer.bump} accessor.
 * Every operation returns a new {@link SemVer}; build metadata never
 * survives a bump.
 *
 * @public
 */
export class SemVerBump {
  readonly v: SemVer
	constructor(v: SemVer) {
    this.v = v;
  }

	/** Bump major (resets minor, patch, prerelease, build). */
	major(): SemVer {
		return SemVer.make({ major: this.v.major + 1, minor: 0, patch: 0, prerelease: [], build: [] });
	}

	/** Bump minor (resets patch, prerelease, build). */
	minor(): SemVer {
		return SemVer.make({ major: this.v.major, minor: this.v.minor + 1, patch: 0, prerelease: [], build: [] });
	}

	/** Bump patch (resets prerelease, build). */
	patch(): SemVer {
		return SemVer.make({
			major: this.v.major,
			minor: this.v.minor,
			patch: this.v.patch + 1,
			prerelease: [],
			build: [],
		});
	}

	/**
	 * Bump prerelease, optionally with a named identifier. Node-semver
	 * compatible: a stable version starts a prerelease of the next patch
	 * (`1.0.0` → `1.0.1-0`), switching identifiers resets the counter, and a
	 * trailing numeric identifier increments.
	 *
	 * @param id - the prerelease identifier prefix (e.g. `"rc"`); when omitted, only the trailing numeric counter is bumped
	 * @returns the bumped {@link SemVer}
	 */
	prerelease(id?: string): SemVer {
		const { major, minor, patch } = this.v;
		const pre = this.v.prerelease;

		if (pre.length === 0) {
			return SemVer.make({
				major,
				minor,
				patch: patch + 1,
				prerelease: id !== undefined ? [id, 0] : [0],
				build: [],
			});
		}

		if (id !== undefined) {
			const currentPrefix = typeof pre[0] === "string" ? pre[0] : null;
			if (currentPrefix !== id) {
				return SemVer.make({ major, minor, patch, prerelease: [id, 0], build: [] });
			}
		}

		const last = pre[pre.length - 1];
		if (typeof last === "number") {
			const next: Array<string | number> = [...pre];
			next[next.length - 1] = last + 1;
			return SemVer.make({ major, minor, patch, prerelease: next, build: [] });
		}

		return SemVer.make({ major, minor, patch, prerelease: [...pre, 0], build: [] });
	}

	/** Strip prerelease and build, keeping major.minor.patch. */
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
