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

import { $ScratchpadId } from "@beep/identity/packages";
import { GlobPattern, GlobPatternError, GlobPatternOptions } from "../glob/index.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { dual, identity } from "effect/Function";
import type { DescendOptions } from "./Descend.ts";
import { DescendError, descend } from "./Descend.ts";

const $I = $ScratchpadId.create("effected/walker/Expand");

const JsonString = S.fromJsonString(S.String);
const encodeJsonString = S.encodeResult(JsonString);

/**
 * Options for {@link compileAndExpand}: every {@link DescendOptions} field,
 * plus the glob options the pattern compiles under.
 *
 * @public
 */
export const CompileAndExpandOptions = S.Struct({
	cwd: S.String.annotateKey({ description: "Absolute directory the pattern is resolved against." }),
	maxDepth: S.optionalKey(S.Finite).annotateKey({ description: "Hard cap on directory depth below the literal prefix." }),
	prune: S.Array(S.String).pipe(S.optionalKey).annotateKey({ description: "Directory names never descended into." }),
	onUnreadable: S.optionalKey(S.Literals(["fail", "skip"])).annotateKey({ description: "Whether unreadable directories fail or are skipped; record mode is excluded." }),
	followSymlinks: S.optionalKey(S.Boolean).annotateKey({ description: "Whether symlinked directories are followed with per-branch cycle safety." }),
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
	glob: GlobPatternOptions.annotateKey({ description: "The explicitly supplied matching dialect." }),
}).annotate($I.annote("CompileAndExpandOptions", { description: "Downward traversal options and the required glob matching dialect." }));
export type CompileAndExpandOptions = typeof CompileAndExpandOptions.Type;

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
export class GlobExpansionError extends S.TaggedError<GlobExpansionError>($I`GlobExpansionError`)("GlobExpansionError", {
	/** The glob pattern's source text, as handed to {@link compileAndExpand}. */
	pattern: S.String.annotateKey({ description: "The glob pattern's source text, as handed to compileAndExpand." }),
	/** The underlying typed failure, intact: a compile guard trip or a descent failure. */
	cause: S.Union([GlobPatternError, DescendError]).annotateKey({ description: "The underlying typed failure, intact: a compile guard trip or a descent failure." }),
}, $I.annote("GlobExpansionError", { description: "Typed failure raised by compileAndExpand: the single error the compile+expand recipe fails with, so a caller catches one tag rather than folding two error channels by hand." })) {
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
		const quoted = Result.getOrThrowWith(encodeJsonString(shown), identity);
		return `glob expansion of ${quoted} failed during ${this.stage}: ${this.cause.message}`;
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
 * import * as Effect from "effect/Effect";
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
export const compileAndExpand: {
	(options: CompileAndExpandOptions): (pattern: string) => Effect.Effect<ReadonlyArray<string>, GlobExpansionError, FileSystem.FileSystem | Path.Path>;
	(pattern: string, options: CompileAndExpandOptions): Effect.Effect<ReadonlyArray<string>, GlobExpansionError, FileSystem.FileSystem | Path.Path>;
} = dual(2, Effect.fn("Walker.compileAndExpand")(function* (pattern: string, options: CompileAndExpandOptions) {
	// compileResult is the pure primitive; there is no reason to cross an Effect
	// boundary twice just to reach it.
	const compiled = GlobPattern.compileResult(pattern, options.glob);
	if (Result.isFailure(compiled)) {
		return yield* GlobExpansionError.make({ pattern, cause: compiled.failure });
	}
	return yield* descend(compiled.success, options).pipe(
		Effect.mapError((cause) => GlobExpansionError.make({ pattern, cause })),
	);
}));
