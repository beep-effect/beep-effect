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

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("glob/internal/types");

const PlatformBase = LiteralKit([
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
]);

/**
 * Platforms the engine distinguishes; only `"win32"` changes behavior.
 *
 * **Example** (Recognize an engine platform)
 *
 * ```ts
 * import { Platform } from "../../glob/internal/types.ts"
 *
 * console.log(Platform.is.posix("posix")) // true
 * console.log(Platform.is.posix("plan9")) // false
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const Platform = PlatformBase.pipe(
	$I.annoteSchema("Platform", {
		description: "Operating-system dialect recognized by the deterministic glob engine.",
	}),
	SchemaUtils.withLiteralKitStatics(PlatformBase),
);

/**
 * Decoded platform produced by {@link Platform}.
 *
 * **Example** (Declare an engine platform)
 *
 * ```ts
 * import type { Platform } from "../../glob/internal/types.ts"
 *
 * const platform = "posix" satisfies Platform
 * console.log(platform) // "posix"
 * ```
 *
 * @see {@link Platform} for the runtime schema and literal helpers.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type Platform = typeof Platform.Type;

const OptimizationLevel = S.Int.check(S.isBetween({ minimum: 0, maximum: 2 })).pipe(
	$I.annoteSchema("OptimizationLevel", {
		description: "Pre-parse glob optimization level from zero through two.",
	}),
);

const PositiveSafeInteger = S.Int.check(S.isGreaterThan(0)).pipe(
	$I.annoteSchema("PositiveSafeInteger", {
		description: "Positive safe integer used by defensive glob engine caps.",
	}),
);

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
 * **Example** (Describe a deterministic engine configuration)
 *
 * ```ts
 * import { EngineOptions } from "../../glob/internal/types.ts"
 * import * as S from "effect/Schema"
 *
 * const options = S.decodeUnknownSync(EngineOptions)({ platform: "posix", dot: true })
 * console.log(options.platform) // "posix"
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const EngineOptions = S.Struct({
	nobrace: S.optionalKey(S.Boolean),
	nocomment: S.optionalKey(S.Boolean),
	nonegate: S.optionalKey(S.Boolean),
	noglobstar: S.optionalKey(S.Boolean),
	noext: S.optionalKey(S.Boolean),
	windowsPathsNoEscape: S.optionalKey(S.Boolean),
	partial: S.optionalKey(S.Boolean),
	dot: S.optionalKey(S.Boolean),
	nocase: S.optionalKey(S.Boolean),
	nocaseMagicOnly: S.optionalKey(S.Boolean),
	magicalBraces: S.optionalKey(S.Boolean),
	matchBase: S.optionalKey(S.Boolean),
	flipNegate: S.optionalKey(S.Boolean),
	preserveMultipleSlashes: S.optionalKey(S.Boolean),
	optimizationLevel: S.optionalKey(OptimizationLevel),
	platform: S.optionalKey(Platform),
	windowsNoMagicRoot: S.optionalKey(S.Boolean),
	braceExpandMax: S.optionalKey(PositiveSafeInteger),
	maxGlobstarRecursion: S.optionalKey(PositiveSafeInteger),
	maxExtglobRecursion: S.optionalKey(PositiveSafeInteger),
}).pipe(
	$I.annoteSchema("EngineOptions", {
		description: "Deterministic, ambient-state-free option bag consumed by the internal glob engine.",
	}),
);

/**
 * Decoded engine option bag produced by {@link EngineOptions}.
 *
 * **Example** (Declare engine options)
 *
 * ```ts
 * import type { EngineOptions } from "../../glob/internal/types.ts"
 *
 * const options = { platform: "posix", dot: true } satisfies EngineOptions
 * console.log(options.dot) // true
 * ```
 *
 * @see {@link EngineOptions} for the runtime schema and validation contract.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type EngineOptions = typeof EngineOptions.Type;

/**
 * A compiled part regexp carrying its source and original glob text.
 *
 * **Example** (Construct a compiled segment)
 *
 * ```ts
 * import { MMRegExp } from "../../glob/internal/types.ts"
 *
 * const segment = new MMRegExp("[^/]*?\\.ts", "", "*.ts")
 * console.log(segment.test("index.ts")) // true
 * console.log(segment._glob) // "*.ts"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class MMRegExp extends RegExp {
	/** Unanchored regular-expression source used when composing the whole matcher. */
	readonly _src: string;
	/** Original glob segment from which this regular expression was compiled. */
	readonly _glob: string;

	/**
	 * Construct an anchored compiled-segment expression.
	 *
	 * @param source - Unanchored regular-expression source.
	 * @param flags - Native regular-expression flags.
	 * @param glob - Original glob segment.
	 */
	constructor(source: string, flags: string, glob: string) {
		super(`^${source}$`, flags);
		this._src = source;
		this._glob = glob;
	}
}

/**
 * The globstar marker in a compiled pattern set.
 *
 * **Example** (Detect a recursive walk)
 *
 * ```ts
 * import { Minimatch } from "../../glob/internal/minimatch.ts"
 * import { GLOBSTAR } from "../../glob/internal/types.ts"
 *
 * const recursive = new Minimatch("**\/*.ts", {})
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
 * **Example** (Declare a compiled segment)
 *
 * ```ts
 * import { GLOBSTAR, type ParseReturnFiltered } from "../../glob/internal/types.ts"
 *
 * const segment = GLOBSTAR satisfies ParseReturnFiltered
 * console.log(segment === GLOBSTAR) // true
 * ```
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
 * **Example** (Declare a failed parse)
 *
 * ```ts
 * import type { ParseReturn } from "../../glob/internal/types.ts"
 *
 * const result = false satisfies ParseReturn
 * console.log(result) // false
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseReturn = ParseReturnFiltered | false;
