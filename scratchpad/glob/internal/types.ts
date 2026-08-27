// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
// Port notes: the shared option/type declarations extracted from upstream's
// index.ts into a leaf module. Upstream let ast.ts and index.ts import each
// other's types circularly; the house noImportCycles lint (error-level)
// forbids that, so the types both sides need live here. Changes from the
// upstream shapes: `platform` gains "posix" and is the DEFAULT (no ambient
// process.platform detection anywhere); the deprecated allowWindowsEscape,
// the debug flag and the nonull flag (match-list only) are dropped.

/** The platforms the engine distinguishes; only "win32" changes behavior. */
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

/** A compiled part regexp carrying its source and original glob text. */
export type MMRegExp = RegExp & {
	_src?: string;
	_glob?: string;
};

/** The globstar marker in a compiled pattern set. */
export const GLOBSTAR: unique symbol = Symbol("globstar **");

export type ParseReturnFiltered = string | MMRegExp | typeof GLOBSTAR;
export type ParseReturn = ParseReturnFiltered | false;
