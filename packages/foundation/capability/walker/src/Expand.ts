/**
 * Pattern source to matching files in one call with one typed error: the compile-and-expand recipe.
 *
 * **Details**
 *
 * `Descend` answers "which files match this COMPILED pattern"; this module
 * answers "which files match this pattern SOURCE". The seam between them —
 * compile, fold the compile error, expand, fold the descend error — is small
 * enough that every consumer wrote it themselves, and differently each time.
 * This module is that seam once: one spelling, one error to catch. It is the
 * only walker module that takes a VALUE import from `@beep/glob`
 * (`compileResult`); every other reference is type-and-property only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GlobPattern, GlobPatternError, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { $WalkerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DescendError, DescendOptions, descend } from "./Descend.ts";
import { quoteJson } from "./internal/quote.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";

const $I = $WalkerId.create("Expand");

const ExpansionStage = LiteralKit(["compile", "descend"]).pipe(
  $I.annoteSchema("ExpansionStage", { description: "The phase in which glob expansion failed." })
);
type ExpansionStage = typeof ExpansionStage.Type;
const expansionStage = Match.type<GlobPatternError | DescendError>().pipe(
  Match.tagsExhaustive({
    GlobPatternError: () => ExpansionStage.Enum.compile,
    DescendError: () => ExpansionStage.Enum.descend,
  })
);

/**
 * Options for {@link compileAndExpand}: every {@link DescendOptions} field,
 * plus the glob options the pattern compiles under.
 *
 * **Example** (Choose an explicit glob dialect)
 *
 * ```ts
 * import { CompileAndExpandOptions } from "@beep/walker/Expand";
 * import { GlobPatternOptions } from "@beep/glob/GlobPattern";
 *
 * const options = CompileAndExpandOptions.make({ cwd: "/repo", glob: GlobPatternOptions.make({ dot: true }) });
 * console.log(options.glob.dot) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class CompileAndExpandOptions extends S.Opaque<CompileAndExpandOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...DescendOptions.fields,
    /**
     * The options the pattern compiles under — **required, deliberately**.
     *
     * **Details**
     *
     * Matching semantics (`dot` above all) are the thing two call sites most
     * easily disagree about, and an optional field invites exactly that: one
     * site passes `{ dot: true }`, another omits it, and the same package now
     * has two glob dialects that nothing makes visible. Required means every
     * call site states its dialect in its own source, so a divergence is a
     * visible difference between two spellings rather than the absence of one.
     * Pass `GlobPatternOptions.make({})` to mean "the defaults" — that is a
     * deliberate choice being written down, not boilerplate.
     */
    glob: GlobPatternOptions.pipe(
      $I.annoteKey("CompileAndExpandOptions.glob", { description: "The explicitly supplied matching dialect." })
    ),
  }).pipe(
    $I.annoteSchema("CompileAndExpandOptions", {
      description: "Downward traversal options and the required glob matching dialect.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CompileAndExpandOptions {
  /**
   * The plain, unbranded options shape `compileAndExpand` accepts, so a caller can pass an object literal.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CompileAndExpandOptions.Encoded;
}

/**
 * **Details**
 *
 * One tag, two genuinely different causes — "your pattern is malformed" and
 * "that directory is unreadable" are different problems with different fixes,
 * so `cause` keeps the underlying typed error intact
 * rather than flattening it into a string. Discriminate on `cause._tag`
 * (`"GlobPatternError"` vs `"DescendError"`), or read
 * {@link GlobExpansionError.stage} when only the phase matters; either way the
 * original payload — a guard's `limit`/`actual`, a descent's `path` — is still
 * there. `cause` is also the native `Error` cause, so error chaining and
 * stack-printing work without extra wiring.
 *
 * **Example** (Retain the descent failure phase)
 *
 * ```ts
 * import { GlobExpansionError } from "@beep/walker/Expand";
 * import { DescendError } from "@beep/walker/Descend";
 *
 * const cause = DescendError.make({ pattern: "src/*.ts", reason: "unreadableDirectory", path: "src" });
 * const error = GlobExpansionError.make({ pattern: "src/*.ts", cause });
 * console.log(error.stage) // descend
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GlobExpansionError extends S.TaggedError<GlobExpansionError, { readonly brand: unique symbol }>(
  $I`GlobExpansionError`
)(
  "GlobExpansionError",
  {
    /** The glob pattern's source text, as handed to {@link compileAndExpand}. */
    pattern: S.String.pipe(
      $I.annoteKey("GlobExpansionError.pattern", {
        description: "The glob pattern's source text, as handed to compileAndExpand.",
      })
    ),
    /** The underlying typed failure, intact: a compile guard trip or a descent failure. */
    cause: S.Union([GlobPatternError, DescendError]).pipe(
      $I.annoteKey("GlobExpansionError.cause", {
        description: "The underlying typed failure, intact: a compile guard trip or a descent failure.",
      })
    ),
  },
  $I.annoteError<GlobExpansionError>("GlobExpansionError", {
    description:
      "Typed failure raised by compileAndExpand: the single error the compile+expand recipe fails with, so a caller catches one tag rather than folding two error channels by hand.",
  })
) {
  /**
   * Which phase failed — `"compile"` when the pattern itself was rejected,
   * `"descend"` when the filesystem walk failed. A convenience over
   * `cause._tag` for callers that only need the phase.
   *
   * **Example** (Inspect the failed expansion stage)
   *
   * ```ts
   * import { GlobExpansionError } from "@beep/walker/Expand";
   * import { DescendError } from "@beep/walker/Descend";
   *
   * const cause = DescendError.make({ pattern: "src/*.ts", reason: "unreadableDirectory", path: "src" });
   * const error = GlobExpansionError.make({ pattern: "src/*.ts", cause });
   * console.log(error.stage) // descend
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get stage(): ExpansionStage {
    return expansionStage(this.cause);
  }

  /**
   * Formats the pattern, failed phase and original cause into one expansion failure message.
   *
   * **Details**
   *
   * Pattern text longer than 64 characters is truncated with an ellipsis before being quoted.
   *
   * **Example** (Read an expansion failure message)
   *
   * ```ts
   * import { GlobExpansionError } from "@beep/walker/Expand";
   * import { DescendError } from "@beep/walker/Descend";
   *
   * const cause = DescendError.make({ pattern: "src/*.ts", reason: "unreadableDirectory", path: "src" });
   * const error = GlobExpansionError.make({ pattern: "src/*.ts", cause });
   * console.log(error.message) // glob expansion of "src/*.ts" failed during descend: glob descent for "src/*.ts" could not read "src"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const shown = this.pattern.length > 64 ? `${Str.slice(0, 64)(this.pattern)}…` : this.pattern;
    return `glob expansion of ${quoteJson(shown)} failed during ${this.stage}: ${this.cause.message}`;
  }
}

/**
 * Compile a glob pattern and expand it against the filesystem in one call:
 * matching FILE paths relative to `options.cwd`, POSIX separators, sorted.
 *
 * **Details**
 *
 * The recipe form of `descend`. Everything `descend` documents about
 * traversal holds unchanged — the literal fast-path, the negated-pattern walk
 * from `cwd`, files-only matching, symlink and prune handling, `maxDepth`,
 * `onUnreadable` — because this delegates to it. What this adds is the seam:
 * the pattern arrives as a string, and both failure modes arrive as one
 * {@link GlobExpansionError} with the underlying error preserved in `cause`.
 *
 * A missing base directory, a pattern that climbs above `cwd`, and a pattern
 * that simply matches nothing are all an EMPTY result, not a failure — zero
 * matches is a normal glob answer. Only a rejected pattern or a failed walk
 * produces an error.
 *
 * `FileSystem` and `Path` stay in the `R` channel and are **deliberately not
 * provided here**, even though hand-providing them is the friction this
 * recipe otherwise removes. `FileSystem` cannot be provided — a library that
 * picks its own filesystem cannot be tested against a fixture tree. Given
 * that, providing `Path` internally would not save the caller a layer (they
 * still supply `FileSystem`), and it would actively break win32: the walk
 * would join paths POSIX-style against a caller's win32 filesystem. The
 * consumer's platform layer stays the single place that choice is made.
 * Provide both once at the application boundary, not per call site.
 *
 * **Example** (Compile and expand a TypeScript glob)
 *
 * ```ts
 * import { GlobPatternOptions } from "@beep/glob/GlobPattern";
 * import { compileAndExpand } from "@beep/walker/Expand";
 * import * as Effect from "effect/Effect";
 *
 * const program = compileAndExpand("src/*.ts", { cwd: "/repo", glob: GlobPatternOptions.make({ dot: true }) });
 * // Sorted, cwd-relative POSIX paths; fails with `GlobExpansionError`.
 * // Requires `FileSystem` and `Path` from the platform layer.
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export const compileAndExpand: {
  (
    options: CompileAndExpandOptions.Encoded
  ): (pattern: string) => Effect.Effect<ReadonlyArray<string>, GlobExpansionError, FileSystem.FileSystem | Path.Path>;
  (
    pattern: string,
    options: CompileAndExpandOptions.Encoded
  ): Effect.Effect<ReadonlyArray<string>, GlobExpansionError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn("Walker.compileAndExpand")(function* (pattern: string, options: CompileAndExpandOptions.Encoded) {
    return yield* Effect.fromResult(GlobPattern.compileResult(pattern, GlobPatternOptions.make(options.glob))).pipe(
      Effect.flatMap((compiled) => descend(compiled, options)),
      Effect.mapError((cause) => GlobExpansionError.make({ pattern, cause }))
    );
  })
);
