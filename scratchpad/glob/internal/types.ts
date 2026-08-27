/**
 * Shared option and parse-return types for the glob engine.
 *
 * Extracted from upstream minimatch so ast.ts and the engine can share
 * declarations without an import cycle. `platform` includes `"posix"` and is
 * the default — the engine never reads ambient `process.platform`.
 *
 * Ported from minimatch@10.2.5. Copyright Isaac Z. Schlueter and Contributors.
 * License: BlueOak-1.0.0.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * The platforms the engine distinguishes; only `"win32"` changes behavior.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type Platform =
	| "posix"
	| "aix"
	| "android"
	| "darwin"
	| "freebsd"
	| "haiku"
	| "linux"
	| "openbsd"
	| "sunos"
	| "win32"
	| "cygwin"
	| "netbsd";

/**
 * The engine option bag — upstream MinimatchOptions minus the dropped fields.
 * Validation lives in the facade's GlobPatternOptions schema; the engine only
 * hard-validates the numeric caps (assertCap) because a bad cap is a wiring
 * bug wherever it comes from.
 *
 * **Gotchas**
 *
 * There is no ambient platform: omitted `platform` is `"posix"`.
 * `maxGlobstarRecursion` over-cap is a silent `false` at match time.
 * `nonegate` / `flipNegate` do not change GlobSet's leading-bang exclusion.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export interface EngineOptions {
	/** do not expand `{x,y}` style braces */
	readonly nobrace?: boolean;
	/** do not treat patterns starting with `#` as a comment */
	readonly nocomment?: boolean;
	/** do not treat patterns starting with `!` as a negation */
	readonly nonegate?: boolean;
	/** treat `**` the same as `*` */
	readonly noglobstar?: boolean;
	/** do not expand extglobs like `+(a|b)` */
	readonly noext?: boolean;
	/** treat `\\` as a path separator, not an escape character */
	readonly windowsPathsNoEscape?: boolean;
	/**
	 * Compare a partial path to a pattern. As long as the parts of the path that
	 * are present are not contradicted by the pattern, it will be treated as a
	 * match.
	 */
	readonly partial?: boolean;
	/** allow matches that start with `.` even if the pattern does not */
	readonly dot?: boolean;
	/** ignore case */
	readonly nocase?: boolean;
	/** ignore case only in wildcard patterns */
	readonly nocaseMagicOnly?: boolean;
	/** consider braces to be "magic" for the purpose of hasMagic */
	readonly magicalBraces?: boolean;
	/**
	 * If set, then patterns without slashes will be matched against the basename
	 * of the path if it contains slashes.
	 */
	readonly matchBase?: boolean;
	/** invert the results of negated matches */
	readonly flipNegate?: boolean;
	/** do not collapse multiple `/` into a single `/` */
	readonly preserveMultipleSlashes?: boolean;
	/** the level of pre-parse pattern optimization (0, 1 or 2) */
	readonly optimizationLevel?: number;
	/** operating system platform; defaults to "posix", never read ambiently */
	readonly platform?: Platform;
	/**
	 * When a pattern starts with a UNC path or drive letter, and in
	 * `nocase:true` mode, do not convert the root portions of the pattern into a
	 * case-insensitive regular expression, and instead leave them as strings.
	 */
	readonly windowsNoMagicRoot?: boolean;
	/** max number of `{...}` patterns to expand (default and ceiling 100_000) */
	readonly braceExpandMax?: number;
	/** max number of non-adjacent `**` patterns to recursively walk down */
	readonly maxGlobstarRecursion?: number;
	/** max depth to traverse for nested extglobs like `*(a|b|c)` */
	readonly maxExtglobRecursion?: number;
}

/**
 * A compiled part regexp carrying its source and original glob text.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type MMRegExp = RegExp & {
	_src?: string;
	_glob?: string;
};

/**
 * The globstar marker in a compiled pattern set.
 *
 * **Example** (Detect a recursive walk)
 *
 * ```ts
 * import { Minimatch } from "../../glob/internal/minimatch.ts"
 * import { GLOBSTAR } from "../../glob/internal/types.ts"
 *
 * const recursive = new Minimatch("**/*.ts", {})
 * console.log(recursive.set.some((parts) => parts.includes(GLOBSTAR))) // true
 * const oneLevel = new Minimatch("src/*.ts", {})
 * console.log(oneLevel.set.some((parts) => parts.includes(GLOBSTAR))) // false
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const GLOBSTAR: unique symbol = Symbol("globstar **");

/**
 * One compiled path segment: a literal string, a part regexp, or the
 * {@link GLOBSTAR} marker.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseReturnFiltered = string | MMRegExp | typeof GLOBSTAR;

/**
 * Segment parse result: {@link ParseReturnFiltered} or `false` when the
 * segment is not a matchable part.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseReturn = ParseReturnFiltered | false;
