/**
 * The GlobPattern facade: single-pattern compilation, total matching, the
 * enumerator metadata getters, the schema-validated options surface, the
 * FromString codec and the escape statics, plus GlobPatternError, the
 * package's typed failure vocabulary.
 *
 * **Details**
 *
 * Cycle firewall: this module imports the engine; the engine never imports
 * it. The engine throws raw GuardExceeded records at compile time; only this
 * facade materializes them into the typed GlobPatternError.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GlobId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { EXPANSION_MAX, GuardMeasurement, GuardReason, isGuardExceeded } from "./internal/limits.ts";
import { escape as engineEscape, unescape as engineUnescape, GLOBSTAR, Minimatch } from "./internal/minimatch.ts";
import { Platform } from "./internal/types.ts";
import type { EngineOptionsInput, ParseReturnFiltered } from "./internal/types.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const $I = $GlobId.create("GlobPattern");

/**
 * Typed failure raised when a glob pattern trips a compile-time guard:
 * over-length, brace-expansion budget exhaustion, or nesting past the depth
 * cap.
 *
 * **Details**
 *
 * Malformed input is never a defect — this is the only failure the
 * package's fallible boundaries ({@link GlobPattern.compile} and
 * `GlobSet.compile`) can produce.
 *
 * **Example** (Inspect a rejected pattern)
 *
 * ```ts
 * import { GlobPatternError } from "@beep/glob/GlobPattern";
 *
 * const error = GlobPatternError.make({
 *   pattern: "abc", reason: "PatternTooLong", limit: 2, actual: 3,
 * });
 * console.log(error.reason) // PatternTooLong
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GlobPatternError extends S.TaggedError<GlobPatternError, { readonly brand: unique symbol }>(
  $I`GlobPatternError`
)(
  "GlobPatternError",
  {
    /**
     * The pattern source that was rejected.
     *
     * @since 0.0.0
     */
    pattern: S.String.pipe(
      $I.annoteKey("GlobPatternError.pattern", { description: "The pattern source that was rejected." })
    ),
    /**
     * Which guard tripped: pattern length, brace-expansion budget, or nesting depth.
     *
     * @since 0.0.0
     */
    reason: GuardReason.pipe(
      $I.annoteKey("GlobPatternError.reason", {
        description: "Which guard tripped: pattern length, brace-expansion budget, or nesting depth.",
      })
    ),
    /**
     * The cap the pattern exceeded.
     *
     * @since 0.0.0
     */
    limit: S.Finite.pipe($I.annoteKey("GlobPatternError.limit", { description: "The cap the pattern exceeded." })),
    /**
     * The measured value that exceeded `limit`.
     *
     * @since 0.0.0
     */
    // Expansion arithmetic intentionally overflows to Infinity; preserve the typed failure boundary.
    actual: GuardMeasurement.pipe(
      $I.annoteKey("GlobPatternError.actual", {
        description: "The measured value that exceeded `limit`, including Infinity for an overflowing expansion count.",
      })
    ),
  },
  $I.annoteError<GlobPatternError>("GlobPatternError", {
    description:
      "Typed failure raised when a glob pattern trips a compile-time guard: over-length, brace-expansion budget exhaustion, or nesting past the depth cap. Malformed input is never a defect — this is the only failure the package's fallible boundaries (GlobPattern.compile and `GlobSet.compile`) can produce.",
  })
) {
  /**
   * Reports the rejected pattern, guard reason, cap and measurement in a diagnostic message.
   *
   * **Details**
   *
   * Pattern sources longer than 64 characters are truncated to that prefix and an ellipsis.
   *
   * **Example** (Read a guard diagnostic)
   *
   * ```ts
   * import { GlobPatternError } from "@beep/glob/GlobPattern";
   *
   * const error = GlobPatternError.make({
   *   pattern: "abc", reason: "PatternTooLong", limit: 2, actual: 3,
   * });
   * console.log(error.message) // glob pattern "abc" rejected: PatternTooLong (limit 2, actual 3)
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const shown = this.pattern.length > 64 ? `${Str.slice(0, 64)(this.pattern)}…` : this.pattern;
    return `glob pattern ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(shown), identity)} rejected: ${this.reason} (limit ${this.limit}, actual ${this.actual})`;
  }
}

/**
 * Matching options for a glob pattern: the full minimatch options surface,
 * schema-validated.
 *
 * **Details**
 *
 * `platform` is explicit and defaults to `"posix"`: the engine never reads
 * ambient process state. `braceExpandMax` is bounded above by the stock
 * budget (100,000) — caps tighten, never raise — which is what keeps a
 * GlobPattern value always defaults-compilable (see {@link GlobPattern}).
 *
 * **Gotchas**
 *
 * Invalid options are a developer wiring error and throw at `make` — a defect at
 * construction; the typed channel stays reserved for malformed patterns.
 *
 * **Example** (Match hidden paths with explicit options)
 *
 * ```ts
 * import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
 * import * as Effect from "effect/Effect";
 *
 * const options = GlobPatternOptions.make({ dot: true });
 * const pattern = Effect.runSync(GlobPattern.compile("*", options));
 * console.log(pattern.matches(".env")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class GlobPatternOptions extends S.Opaque<GlobPatternOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Do not expand `{x,y}` style braces.
     *
     * @since 0.0.0
     */
    nobrace: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.nobrace", { description: "Do not expand `{x,y}` style braces." })
    ),
    /**
     * Do not treat a pattern starting with `#` as a comment.
     *
     * @since 0.0.0
     */
    nocomment: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.nocomment", {
        description: "Do not treat a pattern starting with `#` as a comment.",
      })
    ),
    /**
     * Do not treat a pattern starting with `!` as a negation.
     *
     * @since 0.0.0
     */
    nonegate: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.nonegate", {
        description: "Do not treat a pattern starting with `!` as a negation.",
      })
    ),
    /**
     * Treat `**` the same as `*`.
     *
     * @since 0.0.0
     */
    noglobstar: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.noglobstar", { description: "Treat `**` the same as `*`." })
    ),
    /**
     * Do not expand extglobs like `+(a|b)`.
     *
     * @since 0.0.0
     */
    noext: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.noext", { description: "Do not expand extglobs like `+(a|b)`." })
    ),
    /**
     * Allow matches that start with `.` even if the pattern does not.
     *
     * @since 0.0.0
     */
    dot: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.dot", {
        description: "Allow matches that start with `.` even if the pattern does not.",
      })
    ),
    /**
     * Match case-insensitively.
     *
     * @since 0.0.0
     */
    nocase: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.nocase", { description: "Match case-insensitively." })
    ),
    /**
     * Ignore case only in wildcard portions of the pattern.
     *
     * @since 0.0.0
     */
    nocaseMagicOnly: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.nocaseMagicOnly", {
        description: "Ignore case only in wildcard portions of the pattern.",
      })
    ),
    /**
     * Consider braces to be "magic" for the purpose of `hasMagic`.
     *
     * @since 0.0.0
     */
    magicalBraces: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.magicalBraces", {
        description: 'Consider braces to be "magic" for the purpose of `hasMagic`.',
      })
    ),
    /**
     * Match a pattern without slashes against the basename of a path that contains slashes.
     *
     * @since 0.0.0
     */
    matchBase: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.matchBase", {
        description: "Match a pattern without slashes against the basename of a path that contains slashes.",
      })
    ),
    /**
     * Invert the results of negated matches.
     *
     * @since 0.0.0
     */
    flipNegate: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.flipNegate", { description: "Invert the results of negated matches." })
    ),
    /**
     * Compare a partial path to the pattern: a path is a match as long as the parts present are not contradicted by the pattern.
     *
     * @since 0.0.0
     */
    partial: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.partial", {
        description:
          "Compare a partial path to the pattern: a path is a match as long as the parts present are not contradicted by the pattern.",
      })
    ),
    /**
     * Do not collapse multiple `/` into a single `/`.
     *
     * @since 0.0.0
     */
    preserveMultipleSlashes: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.preserveMultipleSlashes", {
        description: "Do not collapse multiple `/` into a single `/`.",
      })
    ),
    /**
     * Treat `\\` as a path separator, not an escape character.
     *
     * @since 0.0.0
     */
    windowsPathsNoEscape: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.windowsPathsNoEscape", {
        description: "Treat `\\\\` as a path separator, not an escape character.",
      })
    ),
    /**
     * For a pattern starting with a UNC path or drive letter in `nocase` mode, keep the root portions as strings instead of case-insensitive regular expressions.
     *
     * @since 0.0.0
     */
    windowsNoMagicRoot: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GlobPatternOptions.windowsNoMagicRoot", {
        description:
          "For a pattern starting with a UNC path or drive letter in `nocase` mode, keep the root portions as strings instead of case-insensitive regular expressions.",
      })
    ),
    /**
     * The level of pre-parse pattern optimization: `0`, `1` or `2`.
     *
     * @since 0.0.0
     */
    optimizationLevel: S.optionalKey(S.Finite.check(S.isInt(), S.isBetween({ minimum: 0, maximum: 2 }))).pipe(
      $I.annoteKey("GlobPatternOptions.optimizationLevel", {
        description: "The level of pre-parse pattern optimization: `0`, `1` or `2`.",
      })
    ),
    /**
     * The operating system the pattern is interpreted for. Defaults to `"posix"`; only `"win32"` changes behavior, and it is never read from the ambient process.
     *
     * @since 0.0.0
     */
    platform: S.optionalKey(Platform).pipe(
      $I.annoteKey("GlobPatternOptions.platform", {
        description:
          'The operating system the pattern is interpreted for. Defaults to `"posix"`; only `"win32"` changes behavior, and it is never read from the ambient process.',
      })
    ),
    /**
     * Maximum number of `{...}` expansions, from `1` to `100000` (the default and ceiling).
     *
     * @since 0.0.0
     */
    braceExpandMax: S.optionalKey(S.Finite.check(S.isInt(), S.isBetween({ minimum: 1, maximum: EXPANSION_MAX }))).pipe(
      $I.annoteKey("GlobPatternOptions.braceExpandMax", {
        description: "Maximum number of `{...}` expansions, from `1` to `100000` (the default and ceiling).",
      })
    ),
    /**
     * Maximum number of non-adjacent `**` segments the matcher recursively walks down.
     *
     * @since 0.0.0
     */
    maxGlobstarRecursion: S.optionalKey(S.Finite.check(S.isInt(), S.isGreaterThan(0))).pipe(
      $I.annoteKey("GlobPatternOptions.maxGlobstarRecursion", {
        description: "Maximum number of non-adjacent `**` segments the matcher recursively walks down.",
      })
    ),
    /**
     * Maximum depth to traverse for nested extglobs like `*(a|b|c)`.
     *
     * @since 0.0.0
     */
    maxExtglobRecursion: S.optionalKey(S.Finite.check(S.isInt(), S.isGreaterThan(0))).pipe(
      $I.annoteKey("GlobPatternOptions.maxExtglobRecursion", {
        description: "Maximum depth to traverse for nested extglobs like `*(a|b|c)`.",
      })
    ),
  }).pipe(
    $I.annoteSchema("GlobPatternOptions", {
      description:
        "Matching options for a glob pattern: the full minimatch options surface, schema-validated. Invalid options are a developer wiring error and throw at `make` — a defect at construction; the typed channel stays reserved for malformed patterns.",
    })
  )
) {}

// Defined-only bridge: a present-but-undefined optionalKey never happens
// through the schema, but the engine bag must not carry explicit undefined
// either (exactOptionalPropertyTypes), so only defined options are copied.
type EngineOptionKey = keyof GlobPatternOptions & keyof EngineOptionsInput;

const ENGINE_OPTION_KEYS: ReadonlyArray<EngineOptionKey> = [
  "nobrace",
  "nocomment",
  "nonegate",
  "noglobstar",
  "noext",
  "dot",
  "nocase",
  "nocaseMagicOnly",
  "magicalBraces",
  "matchBase",
  "flipNegate",
  "partial",
  "preserveMultipleSlashes",
  "windowsPathsNoEscape",
  "windowsNoMagicRoot",
  "optimizationLevel",
  "platform",
  "braceExpandMax",
  "maxGlobstarRecursion",
  "maxExtglobRecursion",
];

const toEngineOptions = (o?: GlobPatternOptions): EngineOptionsInput => {
  const engineOptions: { -readonly [K in EngineOptionKey]?: EngineOptionsInput[K] } = {};
  if (o === undefined) return engineOptions;
  for (const key of ENGINE_OPTION_KEYS) copyDefinedOption(engineOptions, o, key);
  return engineOptions;
};

const copyDefinedOption = <K extends EngineOptionKey>(
  target: { -readonly [P in K]?: EngineOptionsInput[P] },
  source: GlobPatternOptions,
  key: K
): void => {
  const value = source[key];
  if (value !== undefined) target[key] = value;
};

// The literal (plain-string) segments of a row before its first magic part.
const leadingLiterals = (row: ReadonlyArray<ParseReturnFiltered>): Array<string> => {
  const literals: Array<string> = [];
  for (const part of row) {
    if (!P.isString(part)) break;
    literals.push(part);
  }
  return literals;
};

// The longest common leading run of two literal segment lists.
const sharedPrefix = (common: Array<string>, literals: Array<string>): Array<string> => {
  let i = 0;
  while (i < common.length && i < literals.length && common[i] === literals[i]) i++;
  return common.slice(0, i);
};

// The schema check: compilability under DEFAULT options. Returning the guard
// message string makes it the thrown validation message (a bare false would
// render as "Expected <filter>"). A non-guard throw is programmer error and
// stays a defect.
const compilesUnderDefaults = (source: string): true | string =>
  Result.match(
    Result.try({
      try: () => new Minimatch(source, {}),
      catch: (e) => {
        if (isGuardExceeded(e)) return e.message;
        throw e;
      },
    }),
    { onSuccess: (): true => true, onFailure: (message) => message }
  );

/**
 * A compiled glob pattern with a total `matches(candidate)` predicate, plus the
 * metadata a directory walker needs.
 *
 * **Details**
 *
 * The schema IS the domain class. One encoded field, `source`; the compiled
 * matcher lives in a private field the schema never encodes, built lazily for
 * `make`/decode-constructed instances and pre-warmed by
 * {@link GlobPattern.compile}.
 *
 * A GlobPattern value is ALWAYS a pattern that compiles under default options
 * — the schema check enforces it on every construction path. Options refine
 * matching; they do not admit patterns that defaults reject.
 *
 * **Example** (Construct a default-options pattern)
 *
 * ```ts
 * import { GlobPattern } from "@beep/glob/GlobPattern";
 *
 * const pattern = GlobPattern.make({ source: "src/*.ts" });
 * console.log(pattern.matches("src/index.ts")) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GlobPattern extends S.Class<GlobPattern, { readonly brand: unique symbol }>($I`GlobPattern`)(
  S.Struct({
    source: S.String.pipe(
      $I.annoteKey("GlobPattern.source", { description: "The glob pattern source, preserved verbatim." })
    ),
  }).check(
    S.makeFilter(
      (v) => compilesUnderDefaults(v.source),
      $I.annote("CompilesUnderDefaults", {
        message: "compilable glob pattern",
        description: "Requires the pattern source to compile within the default length, expansion and nesting caps.",
      })
    )
  ),
  $I.annote("GlobPattern", {
    description:
      "A compiled glob pattern with a total `matches(candidate)` predicate, plus the metadata a directory walker needs.",
  })
) {
  /**
   * Caches the compiled matcher after the first use or explicit compilation.
   *
   * **Example** (Observe repeated matches through the cached matcher)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   * const pattern = GlobPattern.make({ source: "src/*.ts" });
   * console.log(pattern.matches("src/index.ts")) // true
   * console.log(pattern.matches("src/api.ts")) // true
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  #engine: Minimatch | undefined;
  /**
   * Retains the engine options used when this pattern was compiled.
   *
   * **Example** (Retain explicit matching options)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   * import { GlobPatternOptions } from "@beep/glob/GlobPattern";
   * import * as Effect from "effect/Effect";
   *
   * const options = GlobPatternOptions.make({ dot: true });
   * const pattern = Effect.runSync(GlobPattern.compile("*", options));
   * console.log(pattern.matches(".env")) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  #engineOptions: EngineOptionsInput = {};

  // Lazy for make/decode-built instances. The schema check guarantees this
  // cannot throw for them (defaults are the stored options); a throw here is
  // an invariant violation and correctly dies as a defect.
  /**
   * Returns the cached matcher, compiling it lazily for schema-constructed instances.
   *
   * **Example** (Initialize the matcher through a public predicate)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   * const pattern = GlobPattern.make({ source: "src/*.ts" });
   * console.log(pattern.matches("src/index.ts")) // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
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
   * **Details**
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
   * For synchronous call sites that cannot host an Effect — a lint-staged
   * handler, a config predicate — this removes the
   * `Effect.runSync(Effect.result(...))` escape hatch: pair it with
   * `Result.isSuccess` and read `.success` directly. Effect call sites should
   * prefer {@link GlobPattern.compile}, which carries the tracing span.
   *
   * **Example** (Compile and match a glob synchronously)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   * import * as Result from "effect/Result";
   *
   * const compiled = GlobPattern.compileResult("src/*.ts");
   * if (Result.isSuccess(compiled)) {
   *   console.log(compiled.success.matches("src/index.ts")) // true
   * }
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly compileResult: {
    (source: string, options?: GlobPatternOptions): Result.Result<GlobPattern, GlobPatternError>;
    (options?: GlobPatternOptions): (source: string) => Result.Result<GlobPattern, GlobPatternError>;
  } = dual(
    (args) => P.isString(args[0]),
    (source: string, options?: GlobPatternOptions): Result.Result<GlobPattern, GlobPatternError> => {
      const engineOptions = toEngineOptions(options);
      return Result.try({
        try: () => {
          // Defaults first (the value invariant), then the effective engine.
          new Minimatch(source, {});
          const engine = new Minimatch(source, engineOptions);
          const pattern = GlobPattern.make({ source });
          pattern.#engine = engine;
          pattern.#engineOptions = engineOptions;
          return pattern;
        },
        catch: (e) => {
          if (isGuardExceeded(e)) {
            return GlobPatternError.make({ pattern: source, reason: e.reason, limit: e.limit, actual: e.actual });
          }
          throw e;
        },
      });
    }
  );

  /**
   * Compile a pattern under the given options — the package's fallible
   * boundary, and the form Effect call sites should reach for. Guard trips
   * (over-length, expansion budget, nesting depth) fail typed with
   * {@link GlobPatternError}; invalid options never reach here (they throw at
   * `GlobPatternOptions.make`, a wiring defect).
   *
   * **Details**
   *
   * Defined in terms of {@link GlobPattern.compileResult} — synchronous
   * callers can use that variant directly. Same semantics, same errors; this
   * form adds only the `GlobPattern.compile` tracing span.
   *
   * **Example** (Compile a pattern in an Effect)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   * import * as Effect from "effect/Effect";
   *
   * const pattern = Effect.runSync(GlobPattern.compile("src/*.ts"));
   * console.log(pattern.matches("src/index.ts")) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly compile: {
    (source: string, options?: GlobPatternOptions): Effect.Effect<GlobPattern, GlobPatternError>;
    (options?: GlobPatternOptions): (source: string) => Effect.Effect<GlobPattern, GlobPatternError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("GlobPattern.compile")(function* (source: string, options?: GlobPatternOptions) {
      return yield* Effect.fromResult(GlobPattern.compileResult(source, options));
    })
  );

  /**
   * Whether `candidate` matches this pattern. Total: never throws, never
   * hangs. The globstar backtracking cap is a documented false negative
   * (upstream's deliberate correctness-for-security trade), never an error.
   *
   * **Example** (Match candidates across path segments)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   *
   * const pattern = GlobPattern.make({ source: "src/**" });
   * console.log(pattern.matches("src/lib/index.ts")) // true
   * console.log(pattern.matches("test/index.ts")) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  matches(candidate: string): boolean {
    return this.#engineOf().match(candidate);
  }

  /**
   * Whether some path below `directory` could still match: the directory's
   * segments do not contradict any alternative of the pattern.
   *
   * **Details**
   *
   * This is minimatch's partial match, so a directory walker can prune a
   * subtree the pattern can never reach. It honors the compiled options: under
   * the default `dot: false` a dot-directory is not admitted by a wildcard or a
   * globstar. A negated pattern can match outside its inner pattern, and a
   * `matchBase` pattern matches by basename at any depth, so both admit every
   * directory.
   *
   * **Example** (Prune directories a pattern cannot reach)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   *
   * const pattern = GlobPattern.make({ source: "packages/glob/test/**" });
   * console.log(pattern.mayMatchBelow("packages/glob")) // true
   * console.log(pattern.mayMatchBelow("packages/walker")) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  mayMatchBelow(directory: string): boolean {
    const engine = this.#engineOf();
    if (engine.negate || engine.options.matchBase === true) return true;
    return engine.match(directory, true);
  }

  /**
   * Whether the pattern contains any magic (wildcards, classes, extglobs).
   *
   * **Example** (Distinguish wildcards from literals)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   *
   * console.log(GlobPattern.make({ source: "src/*.ts" }).hasMagic) // true
   * console.log(GlobPattern.make({ source: "src/index.ts" }).hasMagic) // false
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get hasMagic(): boolean {
    return this.#engineOf().hasMagic();
  }

  /**
   * Whether the pattern is a leading-bang whole-pattern negation.
   *
   * **Example** (Detect whole-pattern negation)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   *
   * console.log(GlobPattern.make({ source: "!src/**" }).negated) // true
   * console.log(GlobPattern.make({ source: "src/**" }).negated) // false
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get negated(): boolean {
    return this.#engineOf().negate;
  }

  /**
   * The single literal path the pattern names, or None when it can match more
   * than one path.
   *
   * **Details**
   *
   * Some only when the pattern is not negated, not `matchBase`, expands to one
   * brace alternative, and every segment of that alternative is literal. The
   * path is the compiled alternative, not the source text: escapes are
   * resolved, so `GlobPattern.escape("a*b.ts")` names `a*b.ts`. A brace
   * pattern such as `src/{a,b}.ts` is not literal even though `hasMagic` is
   * false, because it names two paths.
   *
   * **Example** (Find the one path a literal pattern names)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   * import * as O from "effect/Option";
   *
   * console.log(O.getOrNull(GlobPattern.make({ source: "src/index.ts" }).literalPath)) // src/index.ts
   * console.log(O.isNone(GlobPattern.make({ source: "src/{a,b}.ts" }).literalPath)) // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get literalPath(): O.Option<string> {
    const engine = this.#engineOf();
    if (engine.negate || engine.options.matchBase === true || engine.set.length !== 1) return O.none();
    return pipe(
      A.head(engine.set),
      O.filter((row): row is Array<string> => A.every(row, P.isString)),
      O.map(A.join("/"))
    );
  }

  /**
   * The longest literal directory prefix: the common run of leading literal
   * segments across every brace alternative, joined and slash-terminated;
   * `""` when the first segment carries magic. Designed for directory
   * enumerators; well-defined for default-options patterns.
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
   * or another encompassing root instead. The inversion is not the getter's
   * semantics to express — check `negated` at the call site.
   *
   * **Example** (Find the shared directory prefix)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   *
   * const pattern = GlobPattern.make({ source: "src/{api,lib}/*.ts" });
   * console.log(pattern.enumerationPrefix) // src/
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get enumerationPrefix(): string {
    const set = this.#engineOf().set;
    let common: Array<string> | undefined;
    for (const row of set) {
      const literals = leadingLiterals(row);
      common = common === undefined ? literals : sharedPrefix(common, literals);
    }
    if (common === undefined || common.length === 0) return "";
    return `${A.join(common, "/")}/`;
  }

  /**
   * Whether the pattern can match more than one level below
   * {@link GlobPattern.enumerationPrefix}: true iff any alternative contains
   * a globstar, or a magic segment followed by more segments. It reads each
   * alternative on its own, so brace alternatives with different literal
   * leaders (`{src,dist}/*.ts`) answer false; a walker deciding which
   * directories to enter uses {@link GlobPattern.mayMatchBelow} instead.
   *
   * **Gotchas**
   *
   * Like {@link GlobPattern.enumerationPrefix}, this reads the inner pattern
   * and does not account for whole-pattern negation; guard on
   * {@link GlobPattern.negated} at the call site.
   *
   * **Example** (Choose recursive or single-level traversal)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   *
   * console.log(GlobPattern.make({ source: "src/**" }).crossesSegments) // true
   * console.log(GlobPattern.make({ source: "src/*.ts" }).crossesSegments) // false
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get crossesSegments(): boolean {
    return A.some(this.#engineOf().set, (row) => {
      if (row.includes(GLOBSTAR)) return true;
      return O.exists(A.findFirstIndex(row, P.not(P.isString)), (firstMagic) => firstMagic < row.length - 1);
    });
  }

  /**
   * Escape every magic character in `literal` so it matches only itself.
   *
   * **Example** (Match a literal wildcard character)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   *
   * const source = GlobPattern.escape("file*.ts");
   * const pattern = GlobPattern.make({ source });
   * console.log(pattern.matches("file*.ts")) // true
   * console.log(pattern.matches("file1.ts")) // false
   * ```
   *
   * @category encoding
   * @since 0.0.0
   */
  static readonly escape: {
    (literal: string, options?: GlobPatternOptions): string;
    (options?: GlobPatternOptions): (literal: string) => string;
  } = dual(
    (args) => P.isString(args[0]),
    (literal: string, options?: GlobPatternOptions): string => engineEscape(literal, toEngineOptions(options))
  );

  /**
   * Undo {@link GlobPattern.escape}.
   *
   * **Example** (Recover an escaped literal)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   *
   * const escaped = GlobPattern.escape("file*.ts");
   * console.log(GlobPattern.unescape(escaped)) // file*.ts
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly unescape: {
    (pattern: string, options?: GlobPatternOptions): string;
    (options?: GlobPatternOptions): (pattern: string) => string;
  } = dual(
    (args) => P.isString(args[0]),
    (pattern: string, options?: GlobPatternOptions): string => engineUnescape(pattern, toEngineOptions(options))
  );

  /**
   * `Schema.Codec<GlobPattern, string>` — decode a bare pattern string into
   * a compiled default-options GlobPattern; encode back to its source. The
   * house FromString-static idiom for embedding patterns in config schemas;
   * decode failures surface as `SchemaError` for the embedding boundary to
   * normalize.
   *
   * **Example** (Decode and encode a config pattern)
   *
   * ```ts
   * import { GlobPattern } from "@beep/glob/GlobPattern";
   * import * as S from "effect/Schema";
   *
   * const pattern = S.decodeUnknownSync(GlobPattern.FromString)("src/*.ts");
   * console.log(pattern.matches("src/index.ts")) // true
   * console.log(S.encodeSync(GlobPattern.FromString)(pattern)) // src/*.ts
   * ```
   *
   * @category codecs
   * @since 0.0.0
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
      })
    )
  );
}
