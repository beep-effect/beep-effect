// Pattern source -> matching files, in one call with one typed error: the
// compile+expand recipe.
//
// `Descend.ts` answers "which files match this COMPILED pattern"; this module
// answers "which files match this pattern SOURCE". The seam between them —
// compile, fold the compile error, expand, fold the descend error — is small
// enough that every consumer wrote it themselves, and differently each time.
// That is what this module removes: one spelling, one error to catch.
//
// This is the module that takes a VALUE import from `@effected/glob`
// (`compileResult`); every other reference in the package is type-and-property
// only.

import type { GlobPatternOptions } from "../glob/index.ts";
import { GlobPattern, GlobPatternError } from "../glob/index.ts";
import type { FileSystem, Path } from "effect";
import { Effect, Result, Schema } from "effect";
import type { DescendOptions } from "./Descend.ts";
import { DescendError, descend } from "./Descend.ts";

/**
 * Options for {@link compileAndExpand}: every {@link DescendOptions} field,
 * plus the glob options the pattern compiles under.
 *
 * @public
 */
export interface CompileAndExpandOptions extends DescendOptions {
	/**
	 * The options the pattern compiles under — **required, deliberately**.
	 *
	 * @remarks
	 * Matching semantics (`dot` above all) are the thing two call sites most
	 * easily disagree about, and an optional field invites exactly that: one
	 * site passes `{ dot: true }`, another omits it, and the same package now
	 * has two glob dialects that nothing makes visible. Required means every
	 * call site states its dialect in its own source, so a divergence is a
	 * visible difference between two spellings rather than the absence of one.
	 * Pass `GlobPatternOptions.make({})` to mean "the defaults" — that is a
	 * deliberate choice being written down, not boilerplate.
	 */
	readonly glob: GlobPatternOptions;
}

/**
 * Typed failure raised by {@link compileAndExpand}: the single error the
 * compile+expand recipe fails with, so a caller catches one tag rather than
 * folding two error channels by hand.
 *
 * @remarks
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
 * @public
 */
export class GlobExpansionError extends Schema.TaggedError<GlobExpansionError>()("GlobExpansionError", {
	/** The glob pattern's source text, as handed to {@link compileAndExpand}. */
	pattern: Schema.String,
	/** The underlying typed failure, intact: a compile guard trip or a descent failure. */
	cause: Schema.Union([GlobPatternError, DescendError]),
}) {
	/**
	 * Which phase failed — `"compile"` when the pattern itself was rejected,
	 * `"descend"` when the filesystem walk failed. A convenience over
	 * `cause._tag` for callers that only need the phase.
	 */
	get stage(): "compile" | "descend" {
		return this.cause._tag === "GlobPatternError" ? "compile" : "descend";
	}

	override get message(): string {
		const shown = this.pattern.length > 64 ? `${this.pattern.slice(0, 64)}…` : this.pattern;
		return `glob expansion of ${JSON.stringify(shown)} failed during ${this.stage}: ${this.cause.message}`;
	}
}

/**
 * Compile a glob pattern and expand it against the filesystem in one call:
 * matching FILE paths relative to `options.cwd`, POSIX separators, sorted.
 *
 * @remarks
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
 * @example
 * ```ts
 * import { GlobPatternOptions } from "../glob/index.ts";
 * import { compileAndExpand } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	// Sorted, cwd-relative POSIX paths; fails with `GlobExpansionError`.
 * 	return yield* compileAndExpand("src/*.ts", {
 * 		cwd: "/repo",
 * 		glob: GlobPatternOptions.make({ dot: true }),
 * 	});
 * });
 * // Requires `FileSystem` and `Path` from the platform layer.
 * ```
 *
 * @public
 */
export const compileAndExpand: (
	pattern: string,
	options: CompileAndExpandOptions,
) => Effect.Effect<ReadonlyArray<string>, GlobExpansionError, FileSystem.FileSystem | Path.Path> = Effect.fn(
	"Walker.compileAndExpand",
)(function* (pattern: string, options: CompileAndExpandOptions) {
	// compileResult is the pure primitive; there is no reason to cross an Effect
	// boundary twice just to reach it.
	const compiled = GlobPattern.compileResult(pattern, options.glob);
	if (Result.isFailure(compiled)) {
		return yield* GlobExpansionError.make({ pattern, cause: compiled.failure });
	}
	return yield* descend(compiled.success, options).pipe(
		Effect.mapError((cause) => GlobExpansionError.make({ pattern, cause })),
	);
});
