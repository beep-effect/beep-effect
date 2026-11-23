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

import { $GlobId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $GlobId.create("internal/types");

/**
 * Defines the platforms the engine distinguishes; only "win32" changes behavior.
 *
 * **Example** (Validate target platforms)
 *
 * ```ts
 * import { Platform } from "@beep/glob/internal/types"
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
]).pipe(
  $I.annoteSchema("Platform", {
    description: "The twelve accepted glob platforms; only win32 changes matching behavior, and posix is the default.",
  })
);
/**
 * @see {@link Platform} for the runtime schema of accepted platform names.
 * @category type-level
 * @since 0.0.0
 */
export type Platform = typeof Platform.Type;

const optionalFlag = (key: string, description: string) =>
  S.optionalKey(S.Boolean).pipe($I.annoteKey(`EngineOptions.${key}`, { description }));

// A cap is a positive safe integer: the domain assertCap enforces at runtime.
const optionalCap = (key: string, description: string) =>
  S.optionalKey(S.Finite.check(S.isInt(), S.isGreaterThan(0))).pipe(
    $I.annoteKey(`EngineOptions.${key}`, { description })
  );

/**
 * **Details**
 *
 * The schema states the option domain. Engine entry points take the plain
 * encoded bag ({@link EngineOptionsInput}) without decoding it: validation
 * lives in the facade's GlobPatternOptions schema, and the engine only
 * hard-validates the numeric caps (assertCap) because a bad cap is a wiring
 * bug wherever it comes from — a NaN or fractional cap still dies as
 * InvalidCap at the engine rather than as a schema error.
 *
 * **Example** (Configure partial matching on POSIX paths)
 *
 * ```ts
 * import { EngineOptions } from "@beep/glob/internal/types"
 *
 * const options = EngineOptions.make({ platform: "posix", partial: true })
 * console.log(options.platform) // posix
 * console.log(options.partial) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class EngineOptions extends S.Opaque<EngineOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    braceExpandMax: optionalCap(
      "braceExpandMax",
      "Max number of `{...}` patterns to expand (default and ceiling 100_000)."
    ),
    dot: optionalFlag("dot", "Allow matches that start with `.` even if the pattern does not."),
    flipNegate: optionalFlag("flipNegate", "Invert the results of negated matches."),
    magicalBraces: optionalFlag("magicalBraces", 'Consider braces to be "magic" for the purpose of hasMagic.'),
    matchBase: optionalFlag(
      "matchBase",
      "Match patterns without slashes against the basename of a path that contains slashes."
    ),
    maxExtglobRecursion: optionalCap(
      "maxExtglobRecursion",
      "Max depth to traverse for nested extglobs like `*(a|b|c)`."
    ),
    maxGlobstarRecursion: optionalCap(
      "maxGlobstarRecursion",
      "Max number of non-adjacent `**` patterns to recursively walk down."
    ),
    nobrace: optionalFlag("nobrace", "Do not expand `{x,y}` style braces."),
    nocase: optionalFlag("nocase", "Ignore case."),
    nocaseMagicOnly: optionalFlag("nocaseMagicOnly", "Ignore case only in wildcard patterns."),
    nocomment: optionalFlag("nocomment", "Do not treat patterns starting with `#` as a comment."),
    noext: optionalFlag("noext", "Do not expand extglobs like `+(a|b)`."),
    noglobstar: optionalFlag("noglobstar", "Treat `**` the same as `*`."),
    nonegate: optionalFlag("nonegate", "Do not treat patterns starting with `!` as a negation."),
    optimizationLevel: S.optionalKey(S.Finite.check(S.isInt(), S.isBetween({ minimum: 0, maximum: 2 }))).pipe(
      $I.annoteKey("EngineOptions.optimizationLevel", {
        description: "The level of pre-parse pattern optimization (0, 1 or 2).",
      })
    ),
    partial: optionalFlag(
      "partial",
      "Compare a partial path to a pattern; present parts not contradicted by the pattern match."
    ),
    platform: S.optionalKey(Platform).pipe(
      $I.annoteKey("EngineOptions.platform", {
        description: 'Operating system platform; defaults to "posix", never read ambiently.',
      })
    ),
    preserveMultipleSlashes: optionalFlag("preserveMultipleSlashes", "Do not collapse multiple `/` into a single `/`."),
    windowsNoMagicRoot: optionalFlag(
      "windowsNoMagicRoot",
      "In nocase mode, keep UNC or drive-letter pattern roots as strings instead of case-insensitive regular expressions."
    ),
    windowsPathsNoEscape: optionalFlag(
      "windowsPathsNoEscape",
      "Treat a backslash as a path separator, not an escape character."
    ),
  }).pipe(
    $I.annoteSchema("EngineOptions", {
      description:
        "The engine option bag: upstream MinimatchOptions minus the dropped fields, caps as positive integers.",
    })
  )
) {}

/**
 * The plain option bag accepted by the engine entry points before
 * {@link EngineOptions.make} canonicalizes it.
 *
 * **Example** (Pass plain options to the engine)
 *
 * ```ts
 * import type { EngineOptionsInput } from "@beep/glob/internal/types"
 *
 * const input: EngineOptionsInput = { dot: true }
 * console.log(input.dot) // true
 * ```
 *
 * @see {@link EngineOptions} for the schema that owns these fields.
 * @category type-level
 * @since 0.0.0
 */
export type EngineOptionsInput = typeof EngineOptions.Encoded;

/**
 * A compiled part regexp carrying its source and original glob text.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MMRegExp = RegExp & {
  _src?: string;
  _glob?: string;
  /** Owner-local non-backtracking evaluator for repeated extglobs. */
  _matchSegment?: (candidate: string) => boolean;
};

/**
 * Identifies a globstar segment in a compiled pattern set.
 *
 * **Example** (Inspect the globstar marker)
 *
 * ```ts
 * import { GLOBSTAR } from "@beep/glob/internal/types"
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
