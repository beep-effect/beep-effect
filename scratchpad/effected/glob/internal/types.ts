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

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $ScratchpadId.create("effected/glob/internal/types");

/**
 * Defines the platforms the engine distinguishes; only "win32" changes behavior.
 *
 * **Example** (Validate target platforms)
 *
 * ```ts
 * import { Platform } from "@beep/scratchpad/effected/glob/internal/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Platform)("posix")) // true
 * console.log(S.is(Platform)("win32")) // true
 * console.log(S.is(Platform)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Platform = LiteralKit([
	"posix", "aix", "android", "darwin", "freebsd", "haiku",
	"linux", "openbsd", "sunos", "win32", "cygwin", "netbsd",
]).annotate($I.annote("Platform", {
	title: "Glob target platform",
	description: "The twelve accepted glob platforms; only win32 changes matching behavior, and posix is the default.",
}));
/**
 * Describes an accepted target platform for glob matching.
 *
 * @see {@link Platform} for the runtime schema of accepted platform names.
 * @category type-level
 * @since 0.0.0
 */
export type Platform = typeof Platform.Type;

/**
 * The engine option bag — upstream MinimatchOptions minus the dropped fields.
 *
 * **Details**
 *
 * Validation lives in the facade's GlobPatternOptions schema; the engine only
 * hard-validates the numeric caps (assertCap) because a bad cap is a wiring
 * bug wherever it comes from.
 *
 * **Example** (Configure partial matching on POSIX paths)
 *
 * ```ts
 * import type { EngineOptions } from "@beep/scratchpad/effected/glob/internal/types"
 *
 * const options: EngineOptions = { platform: "posix", partial: true }
 * console.log(options.platform) // posix
 * console.log(options.partial) // true
 * ```
 *
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
 * @category type-level
 * @since 0.0.0
 */
export type MMRegExp = RegExp & {
	_src?: string;
	_glob?: string;
};

/**
 * Identifies a globstar segment in a compiled pattern set.
 *
 * **Example** (Inspect the globstar marker)
 *
 * ```ts
 * import { GLOBSTAR } from "@beep/scratchpad/effected/glob/internal/types"
 *
 * console.log(typeof GLOBSTAR) // symbol
 * console.log(GLOBSTAR.description) // globstar **
 * ```
 *
 * @category symbols
 * @since 0.0.0
 */
export const GLOBSTAR: unique symbol = Symbol("globstar **");

/**
 * Describes a successfully parsed segment: literal text, a compiled regexp,
 * or the globstar marker.
 *
 * @see {@link ParseReturn} for the result type that also represents parsing failure.
 * @category type-level
 * @since 0.0.0
 */
export type ParseReturnFiltered = string | MMRegExp | typeof GLOBSTAR;
/**
 * Describes a parsed pattern segment, with `false` indicating parsing failure.
 *
 * @see {@link ParseReturnFiltered} for the successful segment representations.
 * @category type-level
 * @since 0.0.0
 */
export type ParseReturn = ParseReturnFiltered | false;
