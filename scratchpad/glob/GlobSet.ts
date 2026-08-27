/**
 * Multi-pattern include/exclude sets with glob-core SET semantics: a leading
 * bang marks an exclusion filter applied after positive matching. This is
 * deliberately distinct from minimatch's whole-pattern negation — both exist,
 * at different levels, on purpose.
 *
 * GlobSet pins default options internally: it is the drift-free workspaces
 * contract and takes no options surface of its own. Braced patterns classify
 * per expanded alternative, so `{tools/cli,packages/*}` contributes a literal
 * AND a wildcard.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { Effect, Result, Schema } from "effect";
import { GlobPattern, GlobPatternError } from "./GlobPattern.ts";
import { isGuardExceeded } from "./internal/limits.ts";
import { Minimatch, braceExpand } from "./internal/minimatch.ts";

const $I = $ScratchpadId.create("glob/GlobSet");

// Strip exactly ONE leading bang: the set-level exclusion marker. A remaining
// bang is then ordinary minimatch whole-pattern negation inside the exclude —
// degenerate, permitted, not specially cased.
const exclusionTarget = (pattern: string): string | undefined =>
	pattern.startsWith("!") ? pattern.slice(1) : undefined;

// The schema check: every member (exclusion bang stripped) must compile under
// default options. Returning the guard message string makes it the thrown
// validation message.
const allCompileUnderDefaults = (patterns: ReadonlyArray<string>): true | string => {
	for (const pattern of patterns) {
		const target = exclusionTarget(pattern) ?? pattern;
		try {
			new Minimatch(target, {});
		} catch (e) {
			if (isGuardExceeded(e)) return `pattern ${JSON.stringify(pattern.slice(0, 64))}: ${e.message}`;
			throw e;
		}
	}
	return true;
};

interface Classified {
	readonly literals: ReadonlyArray<string>;
	readonly wildcards: ReadonlyArray<GlobPattern>;
	readonly excludes: ReadonlyArray<GlobPattern>;
}

/**
 * A compiled multi-pattern include/exclude set: `matches(candidate)` is true
 * when some include accepts it and no exclude does. One encoded field,
 * `patterns` — the source text of every member, preserved verbatim; the
 * classified indexes live in a private field the schema never encodes.
 *
 * The structural accessors ({@link GlobSet.literals},
 * {@link GlobSet.wildcards}, {@link GlobSet.excludes}) serve the workspaces
 * enumerator: literals fast-path an exact lookup, wildcards drive directory
 * reads from their `enumerationPrefix`, and `crossesSegments` triggers the
 * bounded recursive descent — the issue-#62 fix end to end.
 *
 * **Details**
 *
 * Classification is per expanded alternative: `{tools/cli,packages/*}` is a
 * literal AND a wildcard. Literal keys use the engine's unescaped single row
 * so `foo\*bar` still matches `foo*bar`. Comments contribute nothing; leftover
 * negate/non-string rows go to `wildcards`.
 *
 * **Gotchas**
 *
 * A leading `!` here is an exclusion filter applied after positive matching,
 * not minimatch whole-pattern negation. `GlobSet.compile(["!foo"])` excludes
 * `foo`; `GlobPattern.compile("!foo")` inverts `matches`. `nonegate` /
 * `flipNegate` only affect the engine, not this leading-bang strip. A remaining
 * bang after stripping exactly one `!` is inner minimatch negate.
 *
 * **Example** (Include packages and exclude docs)
 *
 * ```ts
 * import { GlobSet } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobSet.compileResult(["packages/*", "!packages/docs"])
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("packages/cli")) // true
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("packages/docs")) // false
 * ```
 *
 * **Example** (Classify braces, escaped literals, and comments)
 *
 * ```ts
 * import { GlobSet } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobSet.compileResult(["{tools/cli,packages/*}", "foo\\*bar", "# comment"])
 * if (Result.isSuccess(compiled)) {
 *   console.log(compiled.success.literals) // ["tools/cli", "foo*bar"]
 *   console.log(compiled.success.wildcards.map((pattern) => pattern.source)) // ["packages/*"]
 *   console.log(compiled.success.excludes.length) // 0
 * }
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class GlobSet extends Schema.Class<GlobSet>($I`GlobSet`)(
	Schema.Struct({ patterns: Schema.Array(Schema.String) }).check(
		Schema.makeFilter((v) => allCompileUnderDefaults(v.patterns), { title: "compilable glob pattern set" }),
	),
	$I.annote("GlobSet", {
		description:
			"A compiled include/exclude glob set whose leading bang is an exclusion filter, not whole-pattern negation.",
	}),
) {
	#classified: Classified | undefined;
	#literalSet: ReadonlySet<string> | undefined;

	// Lazy: the schema check guarantees every member is defaults-compilable, so
	// classification cannot fail for constructed instances. Classification is
	// per expanded alternative: brace-expand each include under default options
	// and route each alternative by its own magic.
	//
	// The literal bucket keys on the engine's UNESCAPED single row, never the
	// raw alternative source — the engine matches candidates in unescaped form,
	// so keying on an escaped-magic source (foo\*bar) would silently drop every
	// match its member pattern accepts. Comments match nothing and contribute
	// nothing; anything else an exact-string key cannot represent (negation, a
	// row the engine did not reduce to plain strings) is engine-matched instead.
	#classify(): Classified {
		if (this.#classified !== undefined) return this.#classified;
		const literals: Array<string> = [];
		const seenLiterals = new Set<string>();
		const wildcards: Array<GlobPattern> = [];
		const excludes: Array<GlobPattern> = [];
		for (const pattern of this.patterns) {
			const target = exclusionTarget(pattern);
			if (target !== undefined) {
				excludes.push(GlobPattern.make({ source: target }));
				continue;
			}
			for (const alternative of braceExpand(pattern, {})) {
				const engine = new Minimatch(alternative, {});
				if (engine.hasMagic()) {
					wildcards.push(GlobPattern.make({ source: alternative }));
					continue;
				}
				if (engine.comment) continue;
				const row = engine.set.length === 1 ? engine.set[0] : undefined;
				if (engine.negate || row === undefined || !row.every((part) => typeof part === "string")) {
					wildcards.push(GlobPattern.make({ source: alternative }));
					continue;
				}
				const key = row.join("/");
				if (!seenLiterals.has(key)) {
					seenLiterals.add(key);
					literals.push(key);
				}
			}
		}
		this.#classified = { literals, wildcards, excludes };
		this.#literalSet = seenLiterals;
		return this.#classified;
	}

	#literals(): ReadonlySet<string> {
		if (this.#literalSet === undefined) this.#classify();
		return this.#literalSet as ReadonlySet<string>;
	}

	/**
	 * Compile a pattern set, synchronously — the primitive form, mirroring
	 * {@link GlobPattern.compileResult}. Set compilation is pure
	 * string→predicate work with no IO and no async step, so the sync form is
	 * the real primitive and {@link GlobSet.compile} is derived from it.
	 *
	 * Total: never throws for pattern input. Fails on the FIRST uncompilable
	 * member, coming back as a `Result` failure whose {@link GlobPatternError}
	 * names the offending source pattern in `pattern` (bang included for
	 * exclusions).
	 *
	 * **When to use**
	 *
	 * Use when the call site cannot host an Effect — a lint-staged handler or a
	 * config predicate — so `Result.isSuccess` can read `.success` without
	 * `Effect.runSync(Effect.result(...))`.
	 *
	 * **Example** (Compile includes and an exclusion)
	 *
	 * ```ts
	 * import { GlobSet } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobSet.compileResult(["packages/*", "!packages/docs"])
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("packages/cli")) // true
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("packages/docs")) // false
	 * ```
	 */
	static compileResult(patterns: ReadonlyArray<string>): Result.Result<GlobSet, GlobPatternError> {
		for (const pattern of patterns) {
			const target = exclusionTarget(pattern) ?? pattern;
			try {
				new Minimatch(target, {});
			} catch (e) {
				if (isGuardExceeded(e)) {
					return Result.fail(new GlobPatternError({ pattern, reason: e.reason, limit: e.limit, actual: e.actual }));
				}
				throw e;
			}
		}
		return Result.succeed(new GlobSet({ patterns }));
	}

	/**
	 * Compile a pattern set — with {@link GlobPattern.compile}, the package's
	 * only other fallible boundary, and the form Effect call sites should reach
	 * for. Fails typed on the FIRST uncompilable member, with the error's
	 * `pattern` field naming the offending source pattern (bang included for
	 * exclusions).
	 *
	 * Defined in terms of {@link GlobSet.compileResult} — synchronous callers
	 * can use that variant directly. Same semantics, same errors; this form
	 * adds only the `GlobSet.compile` tracing span.
	 *
	 * **Example** (Compile a set inside Effect)
	 *
	 * ```ts
	 * import { GlobSet } from "@beep/scratchpad/glob"
	 * import { Effect } from "effect"
	 *
	 * const compiled = Effect.runSync(GlobSet.compile(["*.ts", "!skip.ts"]))
	 * console.log(compiled.matches("keep.ts")) // true
	 * console.log(compiled.matches("skip.ts")) // false
	 * ```
	 */
	static readonly compile = Effect.fn("GlobSet.compile")(function* (patterns: ReadonlyArray<string>) {
		return yield* Effect.fromResult(GlobSet.compileResult(patterns));
	});

	/**
	 * Whether `candidate` matches the set: some include accepts it (literal
	 * exact-match fast path, then wildcards) and no exclude does. Total.
	 *
	 * **Gotchas**
	 *
	 * Exclusion is SET-level: a member `"!foo"` never becomes a negated
	 * {@link GlobPattern} matcher. A set that is only exclusions matches
	 * nothing because no include accepted the candidate.
	 *
	 * **Example** (Match after exclusion)
	 *
	 * ```ts
	 * import { GlobSet } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobSet.compileResult(["packages/*", "!packages/docs"])
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("packages/cli")) // true
	 * console.log(Result.isSuccess(compiled) && compiled.success.matches("packages/docs")) // false
	 * ```
	 */
	matches(candidate: string): boolean {
		const { wildcards, excludes } = this.#classify();
		const included = this.#literals().has(candidate) || wildcards.some((w) => w.matches(candidate));
		if (!included) return false;
		return !excludes.some((e) => e.matches(candidate));
	}

	/**
	 * Whether `candidate` is caught by the exclusion filter, independently of inclusion.
	 *
	 * **Example** (Inspect exclusion without inclusion)
	 *
	 * ```ts
	 * import { GlobSet } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobSet.compileResult(["packages/*", "!packages/docs"])
	 * console.log(Result.isSuccess(compiled) && compiled.success.isExcluded("packages/docs")) // true
	 * console.log(Result.isSuccess(compiled) && compiled.success.isExcluded("packages/cli")) // false
	 * ```
	 */
	isExcluded(candidate: string): boolean {
		return this.#classify().excludes.some((e) => e.matches(candidate));
	}

	/**
	 * The deduped effective literal include paths (unescaped), in first-seen order.
	 *
	 * **Gotchas**
	 *
	 * Keys are the engine's unescaped single row, never the raw source, so
	 * `foo\*bar` lands as `foo*bar`. Brace alternatives classify independently —
	 * a mixed brace set is not one wildcard.
	 *
	 * **Example** (Read unescaped literals)
	 *
	 * ```ts
	 * import { GlobSet } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobSet.compileResult(["tools/cli", "foo\\*bar"])
	 * console.log(Result.isSuccess(compiled) && compiled.success.literals) // ["tools/cli", "foo*bar"]
	 * ```
	 */
	get literals(): ReadonlyArray<string> {
		return this.#classify().literals;
	}

	/**
	 * The include alternatives the engine must match, compiled: every magic
	 * alternative, plus the rare non-magic shapes an exact-string key cannot
	 * represent (whole-pattern negation from a brace alternative).
	 *
	 * **Example** (Collect wildcard members)
	 *
	 * ```ts
	 * import { GlobSet } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobSet.compileResult(["{tools/cli,packages/*}"])
	 * console.log(
	 *   Result.isSuccess(compiled) && compiled.success.wildcards.map((pattern) => pattern.source),
	 * ) // ["packages/*"]
	 * ```
	 */
	get wildcards(): ReadonlyArray<GlobPattern> {
		return this.#classify().wildcards;
	}

	/**
	 * The exclusion patterns (leading bang stripped), compiled.
	 *
	 * **Example** (Read stripped exclusions)
	 *
	 * ```ts
	 * import { GlobSet } from "@beep/scratchpad/glob"
	 * import { Result } from "effect"
	 *
	 * const compiled = GlobSet.compileResult(["packages/*", "!packages/docs"])
	 * console.log(
	 *   Result.isSuccess(compiled) && compiled.success.excludes.map((pattern) => pattern.source),
	 * ) // ["packages/docs"]
	 * ```
	 */
	get excludes(): ReadonlyArray<GlobPattern> {
		return this.#classify().excludes;
	}
}
