import { identity } from "effect/Function";
/**
 * The GlobSet facade: multi-pattern include/exclude sets with glob-core's set
 * semantics, where a leading bang marks an exclusion filter applied after
 * positive matching.
 *
 * **Details**
 *
 * This is deliberately distinct from minimatch's whole-pattern negation: both
 * exist, at different levels, on purpose.
 *
 * GlobSet pins default options internally and takes no options surface of its
 * own, so a set means the same thing everywhere. Braced patterns classify per
 * expanded alternative, so `{tools/cli,packages/*}` contributes a literal and
 * a wildcard.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GlobId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GlobPattern, GlobPatternError } from "./GlobPattern.ts";
import { isGuardExceeded } from "./internal/limits.ts";
import { braceExpand, Minimatch } from "./internal/minimatch.ts";
import type { GuardExceeded } from "./internal/limits.ts";

const $I = $GlobId.create("GlobSet");

// Strip exactly ONE leading bang: the set-level exclusion marker. A remaining
// bang is then ordinary minimatch whole-pattern negation inside the exclude —
// degenerate, permitted, not specially cased.
const exclusionTarget = (pattern: string): string | undefined =>
  Str.startsWith("!")(pattern) ? Str.slice(1)(pattern) : undefined;

// Compiles every member (exclusion bang stripped) under default options and
// maps the FIRST guard trip. A non-guard throw is programmer error and stays a
// defect.
const firstGuardTrip = <E>(
  patterns: ReadonlyArray<string>,
  onGuard: (pattern: string, guard: GuardExceeded) => E
): O.Option<E> => {
  for (const pattern of patterns) {
    const target = exclusionTarget(pattern) ?? pattern;
    const compiled = Result.try({
      try: () => new Minimatch(target, {}),
      catch: (e) => {
        if (isGuardExceeded(e)) return onGuard(pattern, e);
        throw e;
      },
    });
    if (Result.isFailure(compiled)) return O.some(compiled.failure);
  }
  return O.none();
};

// The schema check: every member must compile under default options.
// Returning the guard message string makes it the thrown validation message.
const allCompileUnderDefaults = (patterns: ReadonlyArray<string>): true | string =>
  O.getOrElse(
    firstGuardTrip(
      patterns,
      (pattern, guard) =>
        `pattern ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(Str.slice(0, 64)(pattern)), identity)}: ${guard.message}`
    ),
    (): true | string => true
  );

interface Classified {
  readonly excludes: ReadonlyArray<GlobPattern>;
  readonly literalSet: MutableHashSet.MutableHashSet<string>;
  readonly literals: ReadonlyArray<string>;
  readonly wildcards: ReadonlyArray<GlobPattern>;
}

interface ClassifiedBuilder {
  readonly excludes: Array<GlobPattern>;
  readonly literalSet: MutableHashSet.MutableHashSet<string>;
  readonly literals: Array<string>;
  readonly wildcards: Array<GlobPattern>;
}

// The engine's UNESCAPED single plain-string row joined as an exact-match key,
// or undefined when an exact-string key cannot represent the alternative
// (negation, several rows, or a row the engine did not reduce to strings).
const literalRowKey = (engine: Minimatch): string | undefined => {
  if (engine.negate || engine.set.length !== 1) return undefined;
  const row = engine.set[0];
  return row !== undefined && A.every(row, P.isString) ? A.join(row, "/") : undefined;
};

const addLiteral = (builder: ClassifiedBuilder, key: string): void => {
  if (MutableHashSet.has(builder.literalSet, key)) return;
  MutableHashSet.add(builder.literalSet, key);
  builder.literals.push(key);
};

// Routes one expanded include alternative by its own magic. Comments match
// nothing and contribute nothing.
const classifyAlternative = (builder: ClassifiedBuilder, alternative: string): void => {
  const engine = new Minimatch(alternative, {});
  const magic = engine.hasMagic();
  if (!magic && engine.comment) return;
  const key = magic ? undefined : literalRowKey(engine);
  if (key === undefined) {
    builder.wildcards.push(GlobPattern.make({ source: alternative }));
    return;
  }
  addLiteral(builder, key);
};

const classifyPattern = (builder: ClassifiedBuilder, pattern: string): void => {
  const target = exclusionTarget(pattern);
  if (target !== undefined) {
    builder.excludes.push(GlobPattern.make({ source: target }));
    return;
  }
  for (const alternative of braceExpand(pattern, {})) classifyAlternative(builder, alternative);
};

/**
 * A compiled multi-pattern include/exclude set: `matches(candidate)` is true
 * when some include accepts it and no exclude does.
 *
 * **Details**
 *
 * One encoded field, `patterns` — the source text of every member, preserved
 * verbatim; the classified indexes live in a private field the schema never
 * encodes.
 *
 * A member starting with `!` is an exclusion, applied after positive matching.
 * This is set-level exclusion, distinct from a single {@link GlobPattern}'s
 * whole-pattern negation.
 *
 * The structural accessors ({@link GlobSet.literals},
 * {@link GlobSet.wildcards}, {@link GlobSet.excludes}) serve directory
 * enumerators: literals fast-path an exact lookup, wildcards drive directory
 * reads from their `enumerationPrefix`, and `crossesSegments` triggers a
 * bounded recursive descent.
 *
 * **Example** (Match packages while excluding a legacy package)
 *
 * ```ts
 * import { GlobSet } from "@beep/glob/GlobSet";
 * import * as Result from "effect/Result";
 *
 * const compiled = GlobSet.compileResult(["packages/*", "!packages/legacy"]);
 * if (Result.isSuccess(compiled)) {
 * 	console.log(compiled.success.matches("packages/app")); // true
 * 	console.log(compiled.success.matches("packages/legacy")); // false
 * }
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GlobSet extends S.Class<GlobSet, { readonly brand: unique symbol }>($I`GlobSet`)(
  S.Struct({
    patterns: S.Array(S.String).pipe(
      $I.annoteKey("GlobSet.patterns", {
        description: "The ordered include and exclusion pattern sources, preserved verbatim.",
      })
    ),
  }).check(
    S.makeFilter(
      (v) => allCompileUnderDefaults(v.patterns),
      $I.annote("AllCompileUnderDefaults", {
        message: "compilable glob pattern set",
        description:
          "Requires every member, after stripping its set-level exclusion bang, to compile within the default caps.",
      })
    )
  ),
  $I.annote("GlobSet", {
    description:
      "A compiled multi-pattern include/exclude set: `matches(candidate)` is true when some include accepts it and no exclude does. One encoded field, `patterns` — the source text of every member, preserved verbatim; the classified indexes live in a private field the schema never encodes.",
  })
) {
  /**
   * Caches the classified include and exclusion indexes after their first use.
   *
   * **Example** (Observe stable classification through repeated access)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   *
   * const set = GlobSet.make({ patterns: ["tools/cli", "packages/*"] });
   * console.log(set.literals === set.literals); // true
   * ```
   *
   * @since 0.0.0
   */
  #classified: Classified | undefined;

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
  /**
   * Lazily classifies expanded include alternatives and exclusion patterns into cached indexes.
   *
   * **Example** (Observe literal and wildcard classification)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   *
   * const set = GlobSet.make({ patterns: ["{tools/cli,packages/*}"] });
   * console.log(set.literals[0]); // tools/cli
   * console.log(set.wildcards.length); // 1
   * ```
   *
   * @since 0.0.0
   */
  #classify(): Classified {
    if (this.#classified !== undefined) return this.#classified;
    const builder: ClassifiedBuilder = {
      literals: [],
      literalSet: MutableHashSet.empty<string>(),
      wildcards: [],
      excludes: [],
    };
    for (const pattern of this.patterns) classifyPattern(builder, pattern);
    this.#classified = builder;
    return this.#classified;
  }

  /**
   * Retrieves the cached literal hash set used for exact-match lookups.
   *
   * **Example** (Match a literal through the cached lookup)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   *
   * const set = GlobSet.make({ patterns: ["tools/cli"] });
   * console.log(set.matches("tools/cli")); // true
   * ```
   *
   * @since 0.0.0
   */
  #literals(): MutableHashSet.MutableHashSet<string> {
    return this.#classify().literalSet;
  }

  /**
   * Compile a pattern set, synchronously — the primitive form, mirroring
   * {@link GlobPattern.compileResult}. Set compilation is pure
   * string→predicate work with no IO and no async step, so the sync form is
   * the real primitive and {@link GlobSet.compile} is derived from it.
   *
   * **Details**
   *
   * Total: never throws for pattern input. Fails on the FIRST uncompilable
   * member, coming back as a `Result` failure whose {@link GlobPatternError}
   * names the offending source pattern in `pattern` (bang included for
   * exclusions).
   *
   * For synchronous call sites that cannot host an Effect — a lint-staged
   * handler, a config predicate — this removes the
   * `Effect.runSync(Effect.result(...))` escape hatch: pair it with
   * `Result.isSuccess` and read `.success` directly. Effect call sites should
   * prefer {@link GlobSet.compile}, which carries the tracing span.
   *
   * **Example** (Compile a set without running an Effect)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   * import * as Result from "effect/Result";
   *
   * const compiled = GlobSet.compileResult(["packages/*", "!packages/legacy"]);
   * console.log(Result.isSuccess(compiled)); // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static compileResult(patterns: ReadonlyArray<string>): Result.Result<GlobSet, GlobPatternError> {
    return O.match(
      firstGuardTrip(patterns, (pattern, guard) =>
        GlobPatternError.make({ pattern, reason: guard.reason, limit: guard.limit, actual: guard.actual })
      ),
      {
        onNone: () => Result.succeed(GlobSet.make({ patterns })),
        onSome: Result.fail,
      }
    );
  }

  /**
   * Compile a pattern set — with {@link GlobPattern.compile}, the package's
   * only other fallible boundary, and the form Effect call sites should reach
   * for. Fails typed on the FIRST uncompilable member, with the error's
   * `pattern` field naming the offending source pattern (bang included for
   * exclusions).
   *
   * **Details**
   *
   * Defined in terms of {@link GlobSet.compileResult} — synchronous callers
   * can use that variant directly. Same semantics, same errors; this form
   * adds only the `GlobSet.compile` tracing span.
   *
   * **Example** (Compile and match a set in an Effect)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   * import * as Effect from "effect/Effect";
   *
   * const set = Effect.runSync(GlobSet.compile(["packages/*"]));
   * console.log(set.matches("packages/app")); // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly compile = Effect.fn("GlobSet.compile")(function* (patterns: ReadonlyArray<string>) {
    return yield* Effect.fromResult(GlobSet.compileResult(patterns));
  });

  /**
   * Whether `candidate` matches the set: some include accepts it (literal
   * exact-match fast path, then wildcards) and no exclude does. Total.
   *
   * **Example** (Apply include and exclusion filters)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   *
   * const set = GlobSet.make({ patterns: ["packages/*", "!packages/legacy"] });
   * console.log(set.matches("packages/app")); // true
   * console.log(set.matches("packages/legacy")); // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  matches(candidate: string): boolean {
    const { wildcards, excludes } = this.#classify();
    const included = MutableHashSet.has(this.#literals(), candidate) || A.some(wildcards, (w) => w.matches(candidate));
    if (!included) return false;
    return !A.some(excludes, (e) => e.matches(candidate));
  }

  /**
   * Whether `candidate` is caught by the exclusion filter, independently of inclusion.
   *
   * **Example** (Check exclusion independently of inclusion)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   *
   * const set = GlobSet.make({ patterns: ["!packages/legacy"] });
   * console.log(set.isExcluded("packages/legacy")); // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  isExcluded(candidate: string): boolean {
    return A.some(this.#classify().excludes, (e) => e.matches(candidate));
  }

  /**
   * The deduped effective literal include paths (unescaped), in first-seen order.
   *
   * **Example** (Inspect deduplicated literal includes)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   *
   * const set = GlobSet.make({ patterns: ["tools/cli", "tools/cli", "packages/*"] });
   * console.log(set.literals.length); // 1
   * console.log(set.literals[0]); // tools/cli
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get literals(): ReadonlyArray<string> {
    return this.#classify().literals;
  }

  /**
   * The include alternatives the engine must match, compiled: every magic
   * alternative, plus the rare non-magic shapes an exact-string key cannot
   * represent (whole-pattern negation from a brace alternative).
   *
   * **Example** (Inspect compiled wildcard alternatives)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   *
   * const set = GlobSet.make({ patterns: ["{tools/cli,packages/*}"] });
   * console.log(set.wildcards.length); // 1
   * console.log(set.wildcards[0]?.matches("packages/app")); // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get wildcards(): ReadonlyArray<GlobPattern> {
    return this.#classify().wildcards;
  }

  /**
   * The exclusion patterns (leading bang stripped), compiled.
   *
   * **Example** (Inspect exclusion patterns without the set marker)
   *
   * ```ts
   * import { GlobSet } from "@beep/glob/GlobSet";
   *
   * const set = GlobSet.make({ patterns: ["packages/*", "!packages/legacy"] });
   * console.log(set.excludes.length); // 1
   * console.log(set.excludes[0]?.source); // packages/legacy
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get excludes(): ReadonlyArray<GlobPattern> {
    return this.#classify().excludes;
  }
}
