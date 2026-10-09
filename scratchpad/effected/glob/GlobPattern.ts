// The GlobPattern facade: single-pattern compilation, total matching, the
// enumerator metadata getters, the schema-validated options surface, the
// FromString codec and the escape statics — plus GlobPatternError, the
// package's typed failure vocabulary (errors-near-domain rule).
//
// Cycle firewall: this module imports the engine; the engine never imports
// it. The engine throws raw GuardExceeded records at compile time; ONLY this
// facade materializes them into the typed GlobPatternError.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { EXPANSION_MAX, isGuardExceeded } from "./internal/limits.ts";
import type { EngineOptions } from "./internal/minimatch.ts";
import { GLOBSTAR, Minimatch, escape as engineEscape, unescape as engineUnescape } from "./internal/minimatch.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/glob/GlobPattern");

/**
 * Typed failure raised when a glob pattern trips a compile-time guard:
 * over-length, brace-expansion budget exhaustion, or nesting past the depth
 * cap. Malformed input is never a defect — this is the only failure the
 * package's fallible boundaries ({@link GlobPattern.compile} and
 * `GlobSet.compile`) can produce.
 *
 * @public
 */
export class GlobPatternError extends S.TaggedError<GlobPatternError>($I`GlobPatternError`)("GlobPatternError", {
	/** The pattern source that was rejected. */
	pattern: S.String.annotateKey({ description: "The pattern source that was rejected." }),
	/** Which guard tripped: pattern length, brace-expansion budget, or nesting depth. */
	reason: S.Literals(["PatternTooLong", "ExpansionBudgetExceeded", "NestingDepthExceeded"]).annotateKey({ description: "Which guard tripped: pattern length, brace-expansion budget, or nesting depth." }),
	/** The cap the pattern exceeded. */
	limit: S.Finite.annotateKey({ description: "The cap the pattern exceeded." }),
	/** The measured value that exceeded `limit`. */
	actual: S.Finite.annotateKey({ description: "The measured value that exceeded `limit`." }),
}, $I.annote("GlobPatternError", { description: "Typed failure raised when a glob pattern trips a compile-time guard: over-length, brace-expansion budget exhaustion, or nesting past the depth cap. Malformed input is never a defect — this is the only failure the package's fallible boundaries (GlobPattern.compile and `GlobSet.compile`) can produce." })) {
	override get message(): string {
		const shown = this.pattern.length > 64 ? `${this.pattern.slice(0, 64)}…` : this.pattern;
		return `glob pattern ${JSON.stringify(shown)} rejected: ${this.reason} (limit ${this.limit}, actual ${this.actual})`;
	}
}

/**
 * Matching options for a glob pattern: the full minimatch options surface,
 * schema-validated. Invalid options are a
 * developer wiring error and throw at `make` — a defect at construction; the
 * typed channel stays reserved for malformed patterns.
 *
 * `platform` is explicit and defaults to `"posix"`: the engine never reads
 * ambient process state. `braceExpandMax` is bounded above by the stock
 * budget (100,000) — caps tighten, never raise — which is what keeps a
 * GlobPattern value always defaults-compilable (see {@link GlobPattern}).
 *
 * @public
 */
export class GlobPatternOptions extends S.Class<GlobPatternOptions>($I`GlobPatternOptions`)({
	/** Do not expand `{x,y}` style braces. */
	nobrace: S.optionalKey(S.Boolean).annotateKey({ description: "Do not expand `{x,y}` style braces." }),
	/** Do not treat a pattern starting with `#` as a comment. */
	nocomment: S.optionalKey(S.Boolean).annotateKey({ description: "Do not treat a pattern starting with `#` as a comment." }),
	/** Do not treat a pattern starting with `!` as a negation. */
	nonegate: S.optionalKey(S.Boolean).annotateKey({ description: "Do not treat a pattern starting with `!` as a negation." }),
	/** Treat `**` the same as `*`. */
	noglobstar: S.optionalKey(S.Boolean).annotateKey({ description: "Treat `**` the same as `*`." }),
	/** Do not expand extglobs like `+(a|b)`. */
	noext: S.optionalKey(S.Boolean).annotateKey({ description: "Do not expand extglobs like `+(a|b)`." }),
	/** Allow matches that start with `.` even if the pattern does not. */
	dot: S.optionalKey(S.Boolean).annotateKey({ description: "Allow matches that start with `.` even if the pattern does not." }),
	/** Match case-insensitively. */
	nocase: S.optionalKey(S.Boolean).annotateKey({ description: "Match case-insensitively." }),
	/** Ignore case only in wildcard portions of the pattern. */
	nocaseMagicOnly: S.optionalKey(S.Boolean).annotateKey({ description: "Ignore case only in wildcard portions of the pattern." }),
	/** Consider braces to be "magic" for the purpose of `hasMagic`. */
	magicalBraces: S.optionalKey(S.Boolean).annotateKey({ description: "Consider braces to be \"magic\" for the purpose of `hasMagic`." }),
	/** Match a pattern without slashes against the basename of a path that contains slashes. */
	matchBase: S.optionalKey(S.Boolean).annotateKey({ description: "Match a pattern without slashes against the basename of a path that contains slashes." }),
	/** Invert the results of negated matches. */
	flipNegate: S.optionalKey(S.Boolean).annotateKey({ description: "Invert the results of negated matches." }),
	/** Compare a partial path to the pattern: a path is a match as long as the parts present are not contradicted by the pattern. */
	partial: S.optionalKey(S.Boolean).annotateKey({ description: "Compare a partial path to the pattern: a path is a match as long as the parts present are not contradicted by the pattern." }),
	/** Do not collapse multiple `/` into a single `/`. */
	preserveMultipleSlashes: S.optionalKey(S.Boolean).annotateKey({ description: "Do not collapse multiple `/` into a single `/`." }),
	/** Treat `\\` as a path separator, not an escape character. */
	windowsPathsNoEscape: S.optionalKey(S.Boolean).annotateKey({ description: "Treat `\\\\` as a path separator, not an escape character." }),
	/** For a pattern starting with a UNC path or drive letter in `nocase` mode, keep the root portions as strings instead of case-insensitive regular expressions. */
	windowsNoMagicRoot: S.optionalKey(S.Boolean).annotateKey({ description: "For a pattern starting with a UNC path or drive letter in `nocase` mode, keep the root portions as strings instead of case-insensitive regular expressions." }),
	/** The level of pre-parse pattern optimization: `0`, `1` or `2`. */
	optimizationLevel: S.optionalKey(
		S.Finite.check(S.isInt(), S.isBetween({ minimum: 0, maximum: 2 })),
	).annotateKey({ description: "The level of pre-parse pattern optimization: `0`, `1` or `2`." }),
	/** The operating system the pattern is interpreted for. Defaults to `"posix"`; only `"win32"` changes behavior, and it is never read from the ambient process. */
	platform: S.optionalKey(
		S.Literals([
			"posix",
			"aix",
			"android",
			"darwin",
			"freebsd",
			"haiku",
			"linux",
			"openbsd",
			"sunos",
			"win32",
			"cygwin",
			"netbsd",
		]),
	).annotateKey({ description: "The operating system the pattern is interpreted for. Defaults to `\"posix\"`; only `\"win32\"` changes behavior, and it is never read from the ambient process." }),
	/** Maximum number of `{...}` expansions, from `1` to `100000` (the default and ceiling). */
	braceExpandMax: S.optionalKey(
		S.Finite.check(S.isInt(), S.isBetween({ minimum: 1, maximum: EXPANSION_MAX })),
	).annotateKey({ description: "Maximum number of `{...}` expansions, from `1` to `100000` (the default and ceiling)." }),
	/** Maximum number of non-adjacent `**` segments the matcher recursively walks down. */
	maxGlobstarRecursion: S.optionalKey(S.Finite.check(S.isInt(), S.isGreaterThan(0))).annotateKey({ description: "Maximum number of non-adjacent `**` segments the matcher recursively walks down." }),
	/** Maximum depth to traverse for nested extglobs like `*(a|b|c)`. */
	maxExtglobRecursion: S.optionalKey(S.Finite.check(S.isInt(), S.isGreaterThan(0))).annotateKey({ description: "Maximum depth to traverse for nested extglobs like `*(a|b|c)`." }),
}, $I.annote("GlobPatternOptions", { description: "Matching options for a glob pattern: the full minimatch options surface, schema-validated. Invalid options are a developer wiring error and throw at `make` — a defect at construction; the typed channel stays reserved for malformed patterns." })) {}

// Conditional-spread bridge: a present-but-undefined optionalKey never happens
// through the schema, but the engine bag must not carry explicit undefined
// either (exactOptionalPropertyTypes).
const toEngineOptions = (o?: GlobPatternOptions): EngineOptions => ({
	...(o?.nobrace !== undefined && { nobrace: o.nobrace }),
	...(o?.nocomment !== undefined && { nocomment: o.nocomment }),
	...(o?.nonegate !== undefined && { nonegate: o.nonegate }),
	...(o?.noglobstar !== undefined && { noglobstar: o.noglobstar }),
	...(o?.noext !== undefined && { noext: o.noext }),
	...(o?.dot !== undefined && { dot: o.dot }),
	...(o?.nocase !== undefined && { nocase: o.nocase }),
	...(o?.nocaseMagicOnly !== undefined && { nocaseMagicOnly: o.nocaseMagicOnly }),
	...(o?.magicalBraces !== undefined && { magicalBraces: o.magicalBraces }),
	...(o?.matchBase !== undefined && { matchBase: o.matchBase }),
	...(o?.flipNegate !== undefined && { flipNegate: o.flipNegate }),
	...(o?.partial !== undefined && { partial: o.partial }),
	...(o?.preserveMultipleSlashes !== undefined && { preserveMultipleSlashes: o.preserveMultipleSlashes }),
	...(o?.windowsPathsNoEscape !== undefined && { windowsPathsNoEscape: o.windowsPathsNoEscape }),
	...(o?.windowsNoMagicRoot !== undefined && { windowsNoMagicRoot: o.windowsNoMagicRoot }),
	...(o?.optimizationLevel !== undefined && { optimizationLevel: o.optimizationLevel }),
	...(o?.platform !== undefined && { platform: o.platform }),
	...(o?.braceExpandMax !== undefined && { braceExpandMax: o.braceExpandMax }),
	...(o?.maxGlobstarRecursion !== undefined && { maxGlobstarRecursion: o.maxGlobstarRecursion }),
	...(o?.maxExtglobRecursion !== undefined && { maxExtglobRecursion: o.maxExtglobRecursion }),
});

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
 * A compiled glob pattern with a total `matches(candidate)` predicate, plus the
 * metadata a directory walker needs.
 *
 * @remarks
 * The schema IS the domain class. One encoded field, `source`; the compiled
 * matcher lives in a private field the schema never encodes, built lazily for
 * `make`/decode-constructed instances and pre-warmed by
 * {@link GlobPattern.compile}.
 *
 * A GlobPattern value is ALWAYS a pattern that compiles under default options
 * — the schema check enforces it on every construction path. Options refine
 * matching; they do not admit patterns that defaults reject.
 *
 * @public
 */
export class GlobPattern extends S.Class<GlobPattern>($I`GlobPattern`)(
	S.Struct({ source: S.String }).check(
		S.makeFilter((v) => compilesUnderDefaults(v.source), { title: "compilable glob pattern" }),
	), $I.annote("GlobPattern", { description: "A compiled glob pattern with a total `matches(candidate)` predicate, plus the metadata a directory walker needs." }),
) {
	#engine: Minimatch | undefined;
	#engineOptions: EngineOptions = {};

	// Lazy for make/decode-built instances. The schema check guarantees this
	// cannot throw for them (defaults are the stored options); a throw here is
	// an invariant violation and correctly dies as a defect.
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
	 * @remarks
	 * For synchronous call sites that cannot host an Effect — a lint-staged
	 * handler, a config predicate — this removes the
	 * `Effect.runSync(Effect.result(...))` escape hatch: pair it with
	 * `Result.isSuccess` and read `.success` directly. Effect call sites should
	 * prefer {@link GlobPattern.compile}, which carries the tracing span.
	 *
	 * @example
	 * ```ts
	 * import { GlobPattern } from "./index.ts";
	 * import * as Result from "effect/Result";
	 *
	 * const compiled = GlobPattern.compileResult("src/*.ts");
	 * if (Result.isSuccess(compiled)) {
	 * 	compiled.success.matches("src/index.ts"); // => true
	 * }
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
	 */
	static readonly compile = Effect.fn("GlobPattern.compile")(function* (source: string, options?: GlobPatternOptions) {
		return yield* Effect.fromResult(GlobPattern.compileResult(source, options));
	});

	/**
	 * Whether `candidate` matches this pattern. Total: never throws, never
	 * hangs. The globstar backtracking cap is a documented false negative
	 * (upstream's deliberate correctness-for-security trade), never an error.
	 */
	matches(candidate: string): boolean {
		return this.#engineOf().match(candidate);
	}

	/** Whether the pattern contains any magic (wildcards, classes, extglobs). */
	get hasMagic(): boolean {
		return this.#engineOf().hasMagic();
	}

	/** Whether the pattern is a leading-bang whole-pattern negation. */
	get negated(): boolean {
		return this.#engineOf().negate;
	}

	/**
	 * The longest literal directory prefix: the common run of leading literal
	 * segments across every brace alternative, joined and slash-terminated;
	 * `""` when the first segment carries magic. Designed for directory
	 * enumerators; well-defined for default-options patterns.
	 *
	 * @remarks
	 * Meaningful for **non-negated** patterns only. For a negated pattern
	 * ({@link GlobPattern.negated}), the prefix is still computed from the inner
	 * pattern, but {@link GlobPattern.matches} inverts the result — so the
	 * pattern can match paths *outside* this prefix. A consumer that bounds
	 * traversal to `enumerationPrefix` (e.g. a walker's descent) will
	 * under-enumerate against a negated pattern; guard on `negated` and do not
	 * use `enumerationPrefix` as the traversal root there — enumerate from `cwd`
	 * or another encompassing root instead. The inversion is not the getter's
	 * semantics to express — check `negated` at the call site.
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
	 * descent.
	 *
	 * @remarks
	 * Like {@link GlobPattern.enumerationPrefix}, this reads the inner pattern
	 * and does not account for whole-pattern negation; guard on
	 * {@link GlobPattern.negated} at the call site.
	 */
	get crossesSegments(): boolean {
		return this.#engineOf().set.some((row) => {
			if (row.includes(GLOBSTAR)) return true;
			const firstMagic = row.findIndex((part) => !P.isString(part));
			return firstMagic !== -1 && firstMagic < row.length - 1;
		});
	}

	/** Escape every magic character in `literal` so it matches only itself. */
	static escape(literal: string, options?: GlobPatternOptions): string {
		return engineEscape(literal, toEngineOptions(options));
	}

	/** Undo {@link GlobPattern.escape}. */
	static unescape(pattern: string, options?: GlobPatternOptions): string {
		return engineUnescape(pattern, toEngineOptions(options));
	}

	/**
	 * `Schema.Codec<GlobPattern, string>` — decode a bare pattern string into
	 * a compiled default-options GlobPattern; encode back to its source. The
	 * house FromString-static idiom for embedding patterns in config schemas;
	 * decode failures surface as `SchemaError` for the embedding boundary to
	 * normalize.
	 */
	static readonly FromString: S.Codec<GlobPattern, string> = S.String.pipe(
		S.decodeTo(
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
