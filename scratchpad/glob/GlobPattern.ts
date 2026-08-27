/**
 * Single-pattern glob compilation, total matching, enumerator metadata,
 * schema-validated options, the FromString codec, and escape statics — plus
 * GlobPatternError, the package's typed compile-time failure vocabulary.
 *
 * Cycle firewall: this module imports the engine; the engine never imports
 * it. The engine throws raw GuardExceeded records at compile time; only this
 * facade materializes them into the typed GlobPatternError.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { Effect, Formatter, Result, Schema, SchemaTransformation } from "effect";
import * as P from "effect/Predicate";
import { EXPANSION_MAX, GuardReason, isGuardExceeded } from "./internal/limits.ts";
import { GLOBSTAR, Minimatch, escape as engineEscape, unescape as engineUnescape } from "./internal/minimatch.ts";
import { type EngineOptions, Platform } from "./internal/types.ts";

const $I = $ScratchpadId.create("glob/GlobPattern");

const GuardMagnitude = Schema.Natural.pipe(
	$I.annoteSchema("GuardMagnitude", {
		description: "Non-negative safe integer reported by a defensive glob guard.",
	}),
);

const OptimizationLevel = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2 })).pipe(
	$I.annoteSchema("OptimizationLevel", {
		description: "Pre-parse glob optimization level from zero through two.",
	}),
);

const BraceExpansionMax = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: EXPANSION_MAX })).pipe(
	$I.annoteSchema("BraceExpansionMax", {
		description: "Positive brace-expansion cap bounded by the stock engine budget.",
	}),
);

const PositiveRecursionCap = Schema.Int.check(Schema.isGreaterThan(0)).pipe(
	$I.annoteSchema("PositiveRecursionCap", {
		description: "Positive safe integer bounding a recursive glob-engine operation.",
	}),
);

/**
 * Typed failure raised when a glob pattern trips a compile-time guard:
 * over-length, brace-expansion budget exhaustion, or nesting past the depth
 * cap. Malformed input is never a defect — this is the only failure the
 * package's fallible boundaries ({@link GlobPattern.compile} and
 * {@link GlobSet.compile}) can produce.
 *
 * **Gotchas**
 *
 * Compile-time only: {@link GlobPattern.matches} never raises this. The three
 * reasons are `PatternTooLong`, `ExpansionBudgetExceeded`, and
 * `NestingDepthExceeded`. Invalid *options* and invalid numeric caps are
 * defects at construction (`GlobPatternOptions.make` / internal `assertCap`),
 * not this error. Globstar over-cap is a silent `false` from `matches`, not a
 * `GlobPatternError`. Nested extglobs past the default extglob recursion cap
 * of 2 degrade to literals instead of throwing.
 *
 * **Example** (Handle a compile-time guard trip)
 *
 * ```ts
 * import { GlobPattern } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobPattern.compileResult("x".repeat(64 * 1024 + 1))
 * console.log(Result.isFailure(compiled) && compiled.failure.reason === "PatternTooLong") // true
 * if (Result.isFailure(compiled)) {
 *   console.log(compiled.failure.message.includes("PatternTooLong")) // true
 * }
 * ```
 *
 * @see {@link GlobPattern.compileResult} for the synchronous compile boundary that materializes this error.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GlobPatternError extends Schema.TaggedError<GlobPatternError>($I`GlobPatternError`)(
	"GlobPatternError",
	{
		pattern: Schema.String,
		reason: GuardReason,
		limit: GuardMagnitude,
		actual: GuardMagnitude,
	},
	$I.annote("GlobPatternError", {
		description:
			"Typed compile-time glob failure for over-length, brace-budget, or nesting-depth guard trips.",
	}),
) {
	/**
	 * Human-readable compile failure, truncating the pattern after 64 characters.
	 *
	 * **Example** (Read the truncated message)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobPattern.compileResult("x".repeat(64 * 1024 + 1))
	 * if (Result.isFailure(compiled)) {
	 *   console.log(compiled.failure.message.includes("PatternTooLong")) // true
	 * }
	 * ```
	 */
	override get message(): string {
		const shown = this.pattern.length > 64 ? `${this.pattern.slice(0, 64)}…` : this.pattern;
		return `glob pattern ${Formatter.format(shown)} rejected: ${this.reason} (limit ${this.limit}, actual ${this.actual})`;
	}
}

/**
 * The full minimatch options surface, schema-validated. Invalid options are a
 * developer wiring error and throw at `make` — a defect at construction; the
 * typed channel stays reserved for malformed patterns.
 *
 * `platform` is explicit and defaults to `"posix"`: the engine never reads
 * ambient process state. `braceExpandMax` is bounded above by the stock
 * budget (100,000) — caps tighten, never raise — which is what keeps a
 * GlobPattern value always defaults-compilable (see {@link GlobPattern}).
 *
 * **Gotchas**
 *
 * `nonegate`, `noglobstar`, and `flipNegate` change the engine dialect only.
 * They do not change GlobSet's leading-bang exclusion strip. `noglobstar`
 * rewrites `**` to `*` instead of throwing. `windowsPathsNoEscape` treats `\\`
 * as a separator and wraps magic in `[]`; slashes are never escaped.
 * `magicalBraces` defaults to false on {@link GlobPattern.escape} and true on
 * {@link GlobPattern.unescape} — pass the same options bag both ways.
 *
 * **Example** (Pin posix and disable globstar)
 *
 * ```ts
 * import { GlobPattern, GlobPatternOptions } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const options = GlobPatternOptions.make({ platform: "posix", noglobstar: true })
 * console.log(options.platform) // "posix"
 * const compiled = GlobPattern.compileResult("**\/*.ts", options)
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("src/lib/index.ts")) // false
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("src/index.ts")) // true
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class GlobPatternOptions extends Schema.Class<GlobPatternOptions>($I`GlobPatternOptions`)(
	{
	/** Do not expand `{x,y}` style braces. */
	nobrace: Schema.optionalKey(Schema.Boolean),
	/** Do not treat patterns starting with `#` as a comment. */
	nocomment: Schema.optionalKey(Schema.Boolean),
	/** Do not treat patterns starting with `!` as whole-pattern negation. Does not affect GlobSet exclusion bangs. */
	nonegate: Schema.optionalKey(Schema.Boolean),
	/** Treat `**` the same as `*` instead of walking nested directories. */
	noglobstar: Schema.optionalKey(Schema.Boolean),
	/** Do not expand extglobs like `+(a|b)`. */
	noext: Schema.optionalKey(Schema.Boolean),
	/** Allow matches that start with `.` even if the pattern does not. */
	dot: Schema.optionalKey(Schema.Boolean),
	/** Ignore case. */
	nocase: Schema.optionalKey(Schema.Boolean),
	/** Ignore case only in wildcard patterns. */
	nocaseMagicOnly: Schema.optionalKey(Schema.Boolean),
	/** Treat braces as magic for `hasMagic` and for escape/unescape symmetry. */
	magicalBraces: Schema.optionalKey(Schema.Boolean),
	/** Match slash-free patterns against the basename of a slashed path. */
	matchBase: Schema.optionalKey(Schema.Boolean),
	/** Invert the results of negated matches. Engine-only; GlobSet still strips one leading `!`. */
	flipNegate: Schema.optionalKey(Schema.Boolean),
	/** Compare a partial path to a pattern as long as present segments are not contradicted. */
	partial: Schema.optionalKey(Schema.Boolean),
	/** Do not collapse multiple `/` into a single `/`. */
	preserveMultipleSlashes: Schema.optionalKey(Schema.Boolean),
	/** Treat `\\` as a path separator and wrap magic in `[]` instead of backslash-escaping. */
	windowsPathsNoEscape: Schema.optionalKey(Schema.Boolean),
	/** Leave UNC/drive-letter roots as strings in `nocase` mode instead of case-insensitive regexps. */
	windowsNoMagicRoot: Schema.optionalKey(Schema.Boolean),
	/** Pre-parse pattern optimization level (0, 1, or 2). */
	optimizationLevel: Schema.optionalKey(OptimizationLevel),
	/** Operating system platform; defaults to `"posix"` and is never read from the ambient process. */
	platform: Schema.optionalKey(Platform),
	/** Brace-expansion output budget. Caps tighten toward the stock 100,000 maximum; they never raise it. */
	braceExpandMax: Schema.optionalKey(BraceExpansionMax),
	/** Bound on non-adjacent globstar backtracking. Over-cap matching returns `false` and never throws. */
	maxGlobstarRecursion: Schema.optionalKey(PositiveRecursionCap),
	/** Nested-extglob parse depth. Over-nesting degrades to a literal instead of throwing. */
	maxExtglobRecursion: Schema.optionalKey(PositiveRecursionCap),
	},
	$I.annote("GlobPatternOptions", {
		description:
			"Schema-validated minimatch options with an explicit posix platform default and tighten-only brace caps.",
	}),
) {}

// The public options class is structurally the engine bag; no guard/decode
// bridge is needed after schema construction.
const toEngineOptions = (options?: GlobPatternOptions): EngineOptions => options ?? {};

// The schema check: compilability under DEFAULT options. Returning the guard
// message string makes it the thrown validation message (a bare false would
// render as "Expected <filter>"). A non-guard throw is programmer error and
// stays a defect.
const compilesUnderDefaults = (source: string): true | string => {
	try {
		new Minimatch(source, {});
		return true;
	} catch (e) {
		if (isGuardExceeded(e)) return e.message;
		throw e;
	}
};

/**
 * A compiled glob pattern: the schema IS the domain class. One encoded field,
 * `source`; the compiled matcher lives in a private field the schema never
 * encodes, built lazily for `make`/decode-constructed instances and pre-warmed
 * by {@link GlobPattern.compile}.
 *
 * A GlobPattern value is ALWAYS a pattern that compiles under default options
 * — the schema check enforces it on every construction path. Options refine
 * matching; they do not admit patterns that defaults reject.
 *
 * **Gotchas**
 *
 * Compile is the only fallible boundary: over-length, brace-budget, and
 * nesting-depth guards become {@link GlobPatternError}. `matches` is total and
 * never hangs; exceeding the globstar backtracking cap returns `false` (a
 * documented false negative), never an error. A leading `!` on this class is
 * whole-pattern negation (`negated === true`); GlobSet's leading `!` is an
 * exclusion filter instead. Do not use {@link GlobPattern.enumerationPrefix}
 * as a walk root when `negated` is true — the inverted matcher can accept
 * paths outside that prefix.
 *
 * **Example** (Compile, match, and inspect a brace-bomb failure)
 *
 * ```ts
 * import { GlobPattern } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobPattern.compileResult("**\/*.ts")
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("src/index.ts")) // true
 *
 * const negated = GlobPattern.compileResult("!*.ts")
 * console.log(Result.isSuccess(negated) && negated.success.negated) // true
 *
 * const bomb = GlobPattern.compileResult("{0..100000}")
 * console.log(Result.isFailure(bomb) && bomb.failure.reason === "ExpansionBudgetExceeded") // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class GlobPattern extends Schema.Class<GlobPattern>($I`GlobPattern`)(
	Schema.Struct({ source: Schema.String }).check(
		Schema.makeFilter((v) => compilesUnderDefaults(v.source), { title: "compilable glob pattern" }),
	),
	$I.annote("GlobPattern", {
		description:
			"A compiled glob pattern whose encoded source always compiles under default options.",
	}),
) {
	/**
	 * Lazily initialized minimatch engine for this schema value.
	 *
	 * **Example** (Initialize through matching)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 *
	 * const pattern = GlobPattern.make({ source: "*.ts" })
	 * console.log(pattern.matches("index.ts")) // true
	 * ```
	 */
	#engine: Minimatch | undefined;

	/**
	 * Engine options captured by {@link GlobPattern.compileResult}; empty for
	 * values constructed or decoded directly through the schema.
	 *
	 * **Example** (Use default options after schema construction)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 *
	 * const pattern = GlobPattern.make({ source: "*.TS" })
	 * console.log(pattern.matches("index.ts")) // false
	 * ```
	 */
	#engineOptions: EngineOptions = {};

	/**
	 * Return the cached engine, compiling once on first use for schema-built
	 * values. The class invariant guarantees default compilation succeeds.
	 *
	 * **Example** (Reuse a compiled engine through repeated matches)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobPattern.compileResult("*.ts")
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("a.ts")) // true
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("b.ts")) // true
	 * ```
	 */
	#engineOf(): Minimatch {
		if (this.#engine === undefined) {
			this.#engine = new Minimatch(this.source, this.#engineOptions);
		}
		return this.#engine;
	}

	/**
	 * Compile a pattern under the given options, synchronously — the package's
	 * fallible boundary in its primitive form. Compilation is pure
	 * string→predicate work with no IO, no services and no async step, so the
	 * sync form is the real primitive and {@link GlobPattern.compile} is
	 * derived from it.
	 *
	 * Total: never throws for pattern input. Guard trips (over-length,
	 * expansion budget, nesting depth) come back as a `Result` failure holding
	 * {@link GlobPatternError}; invalid *options* never reach here (they throw
	 * at `GlobPatternOptions.make`, a wiring defect).
	 *
	 * The pattern must also compile under DEFAULT options, whatever the
	 * effective options are — permissive options (say `nobrace` over a brace
	 * bomb) do not admit a defaults-rejected pattern; the same typed error
	 * surfaces instead.
	 *
	 * **When to use**
	 *
	 * Use when the call site cannot host an Effect — a lint-staged handler or a
	 * config predicate — so `Result.isSuccess` can read `.success` without
	 * `Effect.runSync(Effect.result(...))`.
	 *
	 * **Gotchas**
	 *
	 * This is compile-time only. Match-time globstar over-cap is a silent
	 * `false`, not a {@link GlobPatternError}. Effect call sites should prefer
	 * {@link GlobPattern.compile}, which carries the tracing span.
	 *
	 * **Example** (Compile a matcher and a brace bomb)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const ok = GlobPattern.compileResult("**\/*.ts")
	 * console.log(Result.isSuccess(ok) && ok.success.matches("src/index.ts")) // true
	 *
	 * const bomb = GlobPattern.compileResult("{0..100000}")
	 * console.log(Result.isFailure(bomb) && bomb.failure.reason === "ExpansionBudgetExceeded") // true
	 * ```
	 */
	static compileResult(source: string, options?: GlobPatternOptions): Result.Result<GlobPattern, GlobPatternError> {
		const engineOptions = toEngineOptions(options);
		try {
			// Defaults first (the value invariant), then the effective engine.
			new Minimatch(source, {});
			const engine = new Minimatch(source, engineOptions);
			const pattern = GlobPattern.make({ source });
			pattern.#engine = engine;
			pattern.#engineOptions = engineOptions;
			return Result.succeed(pattern);
		} catch (e) {
			if (isGuardExceeded(e)) {
				return Result.fail(
					GlobPatternError.make({ pattern: source, reason: e.reason, limit: e.limit, actual: e.actual }),
				);
			}
			throw e;
		}
	}

	/**
	 * Compile a pattern under the given options — the package's fallible
	 * boundary, and the form Effect call sites should reach for. Guard trips
	 * (over-length, expansion budget, nesting depth) fail typed with
	 * {@link GlobPatternError}; invalid options never reach here (they throw at
	 * `GlobPatternOptions.make`, a wiring defect).
	 *
	 * Defined in terms of {@link GlobPattern.compileResult} — synchronous
	 * callers can use that variant directly. Same semantics, same errors; this
	 * form adds only the `GlobPattern.compile` tracing span.
	 *
	 * **Example** (Compile inside Effect)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Effect } from "effect"
	 *
	 * const pattern = Effect.runSync(GlobPattern.compile("**\/*.ts"))
	 * console.log(pattern.matches("src/index.ts")) // true
	 * ```
	 */
	static readonly compile = Effect.fn("GlobPattern.compile")(function* (source: string, options?: GlobPatternOptions) {
		return yield* Effect.fromResult(GlobPattern.compileResult(source, options));
	});

	/**
	 * Whether `candidate` matches this pattern. Total: never throws, never
	 * hangs. The globstar backtracking cap is a documented false negative
	 * (upstream's deliberate correctness-for-security trade), never an error.
	 *
	 * **Gotchas**
	 *
	 * Exceeding `maxGlobstarRecursion` (default 200) returns `false` and never
	 * `GlobPatternError`. `noglobstar` rewrites `**` to `*` instead of walking
	 * nested directories. A leading `!` here inverts the result (`negated`);
	 * do not confuse that with GlobSet exclusion.
	 *
	 * **Example** (Match a TypeScript path)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobPattern.compileResult("**\/*.ts")
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("src/index.ts")) // true
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("src/index.js")) // false
	 * ```
	 */
	matches(candidate: string): boolean {
		return this.#engineOf().match(candidate);
	}

	/**
	 * Whether the pattern contains any magic (wildcards, classes, extglobs).
	 *
	 * **Example** (Distinguish literals from wildcards)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const wildcard = GlobPattern.compileResult("**\/*.ts")
	 * const literal = GlobPattern.compileResult("packages/cli")
	 * console.log(Result.isSuccess(wildcard) && wildcard.success.hasMagic) // true
	 * console.log(Result.isSuccess(literal) && literal.success.hasMagic) // false
	 * ```
	 */
	get hasMagic(): boolean {
		return this.#engineOf().hasMagic();
	}

	/**
	 * Whether the pattern is a leading-bang whole-pattern negation.
	 *
	 * **Gotchas**
	 *
	 * This is minimatch whole-pattern negation, not GlobSet exclusion. A set
	 * member `"!foo"` excludes `foo` after positive matching; compiling `"!foo"`
	 * here inverts `matches` instead. `nonegate` / `flipNegate` only affect this
	 * engine flag.
	 *
	 * **Example** (Detect a negated matcher)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobPattern.compileResult("!*.ts")
	 * console.log(Result.isSuccess(compiled) && compiled.success.negated) // true
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("a.ts")) // false
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("a.js")) // true
	 * ```
	 */
	get negated(): boolean {
		return this.#engineOf().negate;
	}

	/**
	 * The longest literal directory prefix: the common run of leading literal
	 * segments across every brace alternative, joined and slash-terminated;
	 * `""` when the first segment carries magic. New API with no upstream
	 * analogue, designed for the workspaces enumerator; well-defined for
	 * default-options patterns.
	 *
	 * **Gotchas**
	 *
	 * Meaningful for **non-negated** patterns only. For a negated pattern
	 * ({@link GlobPattern.negated}), the prefix is still computed from the inner
	 * pattern, but {@link GlobPattern.matches} inverts the result — so the
	 * pattern can match paths *outside* this prefix. A consumer that bounds
	 * traversal to `enumerationPrefix` (e.g. a walker's descent) will
	 * under-enumerate against a negated pattern; guard on `negated` and do not
	 * use `enumerationPrefix` as the traversal root there — enumerate from `cwd`
	 * or another encompassing root instead.
	 *
	 * **Example** (Read a walk root)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobPattern.compileResult("packages/**\/*.ts")
	 * console.log(Result.isSuccess(compiled) && compiled.success.enumerationPrefix) // "packages/"
	 * ```
	 */
	get enumerationPrefix(): string {
		const set = this.#engineOf().set;
		if (set.length === 0) return "";
		let common: Array<string> | undefined;
		for (const row of set) {
			const literals: Array<string> = [];
			for (const part of row) {
				if (!P.isString(part)) break;
				literals.push(part);
			}
			if (common === undefined) {
				common = literals;
			} else {
				let i = 0;
				while (i < common.length && i < literals.length && common[i] === literals[i]) i++;
				common = common.slice(0, i);
			}
		}
		if (common === undefined || common.length === 0) return "";
		return `${common.join("/")}/`;
	}

	/**
	 * Whether the pattern can match more than one level below
	 * {@link GlobPattern.enumerationPrefix}: true iff any alternative contains
	 * a globstar, or a magic segment followed by more segments. The enumerator
	 * uses this to decide between a single-level read and a bounded recursive
	 * descent (the issue-#62 fix, end to end).
	 *
	 * **Gotchas**
	 *
	 * Like {@link GlobPattern.enumerationPrefix}, this reads the inner pattern
	 * and does not account for whole-pattern negation; guard on
	 * {@link GlobPattern.negated} at the call site.
	 *
	 * **Example** (Decide between a single-level read and descent)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const nested = GlobPattern.compileResult("packages/**\/*.ts")
	 * const oneLevel = GlobPattern.compileResult("packages/*.ts")
	 * console.log(Result.isSuccess(nested) && nested.success.crossesSegments) // true
	 * console.log(Result.isSuccess(oneLevel) && oneLevel.success.crossesSegments) // false
	 * ```
	 */
	get crossesSegments(): boolean {
		return this.#engineOf().set.some((row) => {
			if (row.includes(GLOBSTAR)) return true;
			const firstMagic = row.findIndex((part) => !P.isString(part));
			return firstMagic !== -1 && firstMagic < row.length - 1;
		});
	}

	/**
	 * Escape every magic character in `literal` so it matches only itself.
	 *
	 * **Gotchas**
	 *
	 * Default `magicalBraces` is false here and true on
	 * {@link GlobPattern.unescape}. Pass the same options bag both ways or
	 * `{` / `}` will not round-trip. With `windowsPathsNoEscape`, magic is
	 * wrapped in `[]` and `\\` is a separator — slashes are never escaped.
	 *
	 * **Example** (Escape stars and braces)
	 *
	 * ```ts
	 * import { GlobPattern, GlobPatternOptions } from "@beep/scratchpad/glob"
	 *
	 * console.log(GlobPattern.escape("foo*.ts")) // "foo\\*.ts"
	 * console.log(GlobPattern.escape("foo*.ts", GlobPatternOptions.make({ windowsPathsNoEscape: true }))) // "foo[*].ts"
	 * console.log(GlobPattern.escape("foo{bar}").includes("{")) // true
	 * console.log(GlobPattern.escape("foo{bar}", GlobPatternOptions.make({ magicalBraces: true })).includes("{")) // false
	 * ```
	 */
	static escape(literal: string, options?: GlobPatternOptions): string {
		return engineEscape(literal, toEngineOptions(options));
	}

	/**
	 * Undo {@link GlobPattern.escape}.
	 *
	 * **Gotchas**
	 *
	 * Default `magicalBraces` is true here and false on
	 * {@link GlobPattern.escape}. Unescaping engine-escaped braces with public
	 * defaults strips brace escapes that `escape` did not add unless both
	 * calls share one options bag. `windowsPathsNoEscape` unwraps `[]` but
	 * leaves backslash escapes; slashes never unescape.
	 *
	 * **Example** (Round-trip a star and a brace)
	 *
	 * ```ts
	 * import { GlobPattern, GlobPatternOptions } from "@beep/scratchpad/glob"
	 *
	 * console.log(GlobPattern.unescape(GlobPattern.escape("foo*.ts"))) // "foo*.ts"
	 * const braces = GlobPatternOptions.make({ magicalBraces: true })
	 * console.log(GlobPattern.unescape(GlobPattern.escape("foo{bar}", braces), braces)) // "foo{bar}"
	 * console.log(GlobPattern.unescape(GlobPattern.escape("foo{bar}", braces)).includes("{")) // true
	 * ```
	 */
	static unescape(pattern: string, options?: GlobPatternOptions): string {
		return engineUnescape(pattern, toEngineOptions(options));
	}

	/**
	 * `Schema.Codec<GlobPattern, string>` — decode a bare pattern string into
	 * a compiled default-options GlobPattern; encode back to its source. The
	 * house FromString-static idiom for embedding patterns in config schemas;
	 * decode failures surface as `SchemaError` for the embedding boundary to
	 * normalize.
	 *
	 * **Example** (Decode a config pattern string)
	 *
	 * ```ts
	 * import { GlobPattern } from "@beep/scratchpad/glob"
	 * import * as S from "effect/Schema"
	 *
	 * const pattern = S.decodeUnknownSync(GlobPattern.FromString)("**\/*.ts")
	 * console.log(pattern.matches("src/index.ts")) // true
	 * console.log(S.encodeSync(GlobPattern.FromString)(pattern)) // "**\/*.ts"
	 * ```
	 */
	static readonly FromString: Schema.Codec<GlobPattern, string> = Schema.String.pipe(
		Schema.decodeTo(
			GlobPattern,
			// The transformation bridges string <-> GlobPattern's ENCODED side;
			// the class decode then runs the compilability check and constructs
			// the instance, so uncompilable input fails as SchemaError there.
			SchemaTransformation.transform({
				decode: (input: string) => ({ source: input }),
				encode: (encoded: { readonly source: string }) => encoded.source,
			}),
		),
	);
}
