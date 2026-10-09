import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/walker/Walker");

/** Invalid traversal wiring, raised as a defect rather than a recoverable failure. */
class WalkerDefect extends S.TaggedError<WalkerDefect>($I`WalkerDefect`)(
	"WalkerDefect",
	{ message: S.String },
	$I.annote("WalkerDefect", { description: "Invalid upward traversal wiring." }),
) {}

const JsonString = S.fromJsonString(S.String);

/**
 * Options for {@link Walker.ascend}.
 *
 * @public
 */
export const AscendOptions = S.Struct({
	/**
	 * Stop after this directory, inclusive.
	 *
	 * **Must be absolute**, and is **normalized before comparison**. The ceiling
	 * is matched against each directory's `Path.resolve` form rather than by raw
	 * string equality, so a trailing separator, a `.` or `..` segment, or a
	 * duplicated separator all stop at the ancestor they name. Normalization is
	 * idempotent — an already-resolved absolute path is unchanged — so callers
	 * that resolve at the call site are unaffected.
	 *
	 * A **relative** ceiling is a **defect**, not a typed failure, and is never
	 * resolved against the process working directory. Two rules meet here:
	 *
	 * - Malformed *input* fails typed; bad *wiring* dies. A relative ceiling is
	 *   a caller-supplied option that is statically wrong at the call site — the
	 *   same category as a `NaN` `maxDepth` just below, not a recoverable
	 *   environmental condition — so it dies exactly as that does.
	 * - **Do not "upgrade" this to a typed error.** A typed error is only loud
	 *   if somebody handles it, and `@effected/config-file`'s resolver contract
	 *   absorbs every failure into `Option.none()`. A typed ceiling rejection
	 *   would be swallowed there and re-emerge as a clean-looking "no config
	 *   found" — the silent-wrong-answer failure this whole guard exists to
	 *   close, reappearing through a third door. `Effect.catch` does not catch
	 *   defects, so dying is what survives that absorption.
	 *
	 * Resolving a relative ceiling would be just as bad: the same `stopAt` would
	 * name different directories in a lint-staged hook, a CLI run from a package
	 * directory, and a test runner, with no way for the caller to see which they
	 * got. Rejecting costs one `path.resolve` at the site that knows the answer.
	 * It is also why `ascend` reads `process.cwd()` nowhere.
	 *
	 * Only the CEILING is constrained — a relative `start` is fine and ascends
	 * to the relative root. Absoluteness is judged by the injected `Path`
	 * service, so the win32 layer accepts `C:\repo` and posix does not.
	 *
	 * Normalization governs the comparison only: the chain `ascend` returns is
	 * still the lexical one derived from `start`, unrewritten. A ceiling naming
	 * no ancestor of `start` never matches and the ascent runs to the
	 * filesystem root.
	 *
	 * **Lexical, never physical.** A ceiling spelled with symlinks resolved —
	 * `Git.repoRoot`'s answer is one — does not match a chain reached through a
	 * symlink, and the ascent runs to the filesystem root. Use
	 * {@link Walker.ascendWithin} for a physical ceiling.
	 */
	stopAt: S.optionalKey(S.String).annotateKey({ description: "Absolute inclusive ceiling, normalized before comparison." }),
	/** Hard cap on chain length. Defaults to 256. */
	maxDepth: S.optionalKey(S.Finite).annotateKey({ description: "Hard cap on chain length; invalid supplied depths remain defects." }),
}).annotate($I.annote("AscendOptions", { description: "An optional lexical ceiling and cap for upward traversal." }));
export type AscendOptions = typeof AscendOptions.Type;

// Implementation of Walker.ascend; the public contract lives on the static.
const ascend: (start: string, options?: AscendOptions) => Effect.Effect<ReadonlyArray<string>, never, Path.Path> =
	Effect.fn("ascend")(function* (start: string, options?: AscendOptions) {
		const path = yield* Path.Path;
		const maxDepth = options?.maxDepth ?? 256;
		if (!Number.isInteger(maxDepth) || maxDepth < 1) {
			return yield* Effect.die(
				WalkerDefect.make({ message: `Walker.ascend: maxDepth must be a positive integer, received ${maxDepth}` }),
			);
		}
		// A relative CEILING dies, exactly as an invalid maxDepth does — same
		// category, same construct. `start` is deliberately unconstrained: a
		// relative start still ascends to the relative root.
		if (options?.stopAt !== undefined && !path.isAbsolute(options.stopAt)) {
			const quotedStopAt = yield* S.encodeEffect(JsonString)(options.stopAt).pipe(Effect.orDie);
			const quotedStart = yield* S.encodeEffect(JsonString)(start).pipe(Effect.orDie);
			return yield* Effect.die(
				WalkerDefect.make({
					message: `Walker.ascend: stopAt must be an absolute path, received ${quotedStopAt} (ascending from ${quotedStart})`,
				}),
			);
		}
		// Normalize the ceiling ONCE, then compare normalized forms. Both sides go
		// through `resolve`: normalizing only the ceiling would desynchronize it
		// from an unnormalized chain element (`/a/b/.` names `/a/b`). The raw
		// equality check stays as a fast path for the overwhelmingly common
		// already-resolved ceiling; it is an optimization, never the only
		// comparison.
		const ceiling = options?.stopAt === undefined ? undefined : path.resolve(options.stopAt);
		const dirs: Array<string> = [];
		let current = start;
		for (let depth = 0; depth < maxDepth; depth++) {
			dirs.push(current);
			if (ceiling !== undefined && (current === ceiling || path.resolve(current) === ceiling)) break;
			const parent = path.dirname(current);
			if (parent === current) break;
			current = parent;
		}
		return dirs;
	});

// Implementation of Walker.ascendWithin; the public contract lives on the static.
const ascendWithin: (
	start: string,
	ceiling: O.Option<string>,
	options?: Pick<AscendOptions, "maxDepth">,
) => Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> =
	Effect.fn("ascendWithin")(function* (
			start: string,
			ceiling: O.Option<string>,
			options?: Pick<AscendOptions, "maxDepth">,
		) {
		// Absence is explicit: `Option.none()` is the only way to ask for an
		// unbounded walk, so a stray `undefined` cannot become one by accident.
		if (O.isNone(ceiling)) return yield* ascend(start, options);
		return yield* ascendToPhysical(start, ceiling.value, options);
	});

// ascendWithin with a ceiling present: the lexical chain, stopped physically.
const ascendToPhysical: (
	start: string,
	ceiling: string,
	options?: Pick<AscendOptions, "maxDepth">,
) => Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> =
	Effect.fn("ascendToPhysical")(function* (
			start: string,
			ceiling: string,
			options?: Pick<AscendOptions, "maxDepth">,
		) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		if (!path.isAbsolute(ceiling)) {
			const quotedCeiling = yield* S.encodeEffect(JsonString)(ceiling).pipe(Effect.orDie);
			const quotedStart = yield* S.encodeEffect(JsonString)(start).pipe(Effect.orDie);
			return yield* Effect.die(
				WalkerDefect.make({
					message: `Walker.ascendWithin: ceiling must be an absolute path, received ${quotedCeiling} (ascending from ${quotedStart})`,
				}),
			);
		}
		// The lexical pass first: a ceiling the chain already spells needs no I/O.
		const dirs = yield* ascend(start, { ...options, stopAt: ceiling });
		const last = dirs.at(-1);
		if (last !== undefined && path.resolve(last) === path.resolve(ceiling)) return dirs;
		// A ceiling that cannot be resolved names nothing physical to match; the
		// lexical answer stands, exactly as `ascend` would give it.
		const physical = yield* Effect.option(fs.realPath(ceiling));
		if (O.isNone(physical)) return dirs;
		const hit = yield* findRoot(dirs, (dir) => Effect.map(fs.realPath(dir), (real) => real === physical.value));
		return O.isSome(hit) ? dirs.slice(0, dirs.indexOf(hit.value) + 1) : dirs;
	});

// Implementation of Walker.firstMatch; the public contract lives on the static.
const firstMatch = Effect.fn("firstMatch")(function* <E, R>(
	candidates: ReadonlyArray<string>,
	predicate: (candidate: string) => Effect.Effect<boolean, E, R>,
) {
	for (const candidate of candidates) {
		const matched = yield* Effect.orElseSucceed(predicate(candidate), () => false);
		if (matched) return O.some(candidate);
	}
	return O.none();
});

// Implementation of Walker.findUpward; the public contract lives on the static.
const findUpward: (
	dirs: ReadonlyArray<string>,
	candidatesFor: (dir: string) => ReadonlyArray<string>,
) => Effect.Effect<O.Option<string>, never, FileSystem.FileSystem> =
	Effect.fn("findUpward")(function* (
			dirs: ReadonlyArray<string>,
			candidatesFor: (dir: string) => ReadonlyArray<string>,
		) {
		const fs = yield* FileSystem.FileSystem;
		const candidates: Array<string> = [];
		for (const dir of dirs) candidates.push(...candidatesFor(dir));
		return yield* firstMatch(candidates, (candidate) => fs.exists(candidate));
	});

// Implementation of Walker.findRoot; the public contract lives on the static.
const findRoot = <E, R>(
	dirs: ReadonlyArray<string>,
	isRoot: (dir: string) => Effect.Effect<boolean, E, R>,
): Effect.Effect<O.Option<string>, never, R> => firstMatch(dirs, isRoot);

/**
 * Upward path traversal primitives: the directory chain from a start path to the
 * root, and first-match scans over it.
 *
 * @public
 */
export class Walker {
	private constructor() {}

	/**
	 * Ascend from `start` toward the filesystem root, yielding each directory,
	 * nearest first.
	 *
	 * @remarks
	 * Lexical, not physical: `Path.dirname` does not resolve symlinks, so ascending
	 * out of a symlinked directory follows the path you were given rather than the
	 * real filesystem parent. That is deliberate — config discovery wants the file
	 * nearest the path the user named.
	 *
	 * Bounded twice over: `dirname` is a fixpoint at the root, and `maxDepth` guards
	 * a pathological `Path` implementation that never reaches one.
	 *
	 * `stopAt` is compared in normalized form — see {@link AscendOptions.stopAt}.
	 * Comparing raw strings would let an unnormalized ceiling match nothing and
	 * the ascent run silently to the filesystem root, which is the unbounded walk
	 * the option exists to prevent. A relative ceiling **dies** for the same
	 * reason — resolving one against `process.cwd()` would reintroduce the
	 * silent-wrong-walk failure through a different door. See
	 * {@link AscendOptions.stopAt} for why that is a defect rather than a typed
	 * error; the error channel stays `never`.
	 *
	 * @example
	 * ```ts
	 * import { Walker } from "./index.ts";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.gen(function* () {
	 * 	// => ["/repo/packages/app", "/repo/packages", "/repo"]
	 * 	return yield* Walker.ascend("/repo/packages/app", { stopAt: "/repo" });
	 * });
	 * // Requires `Path` from the platform layer.
	 * ```
	 */
	static readonly ascend = ascend;

	/**
	 * {@link Walker.ascend} bounded by a PHYSICAL ceiling: stops at the nearest
	 * directory whose real path is the ceiling's real path, inclusive.
	 *
	 * @remarks
	 * Use this when the ceiling came from something that resolves symlinks —
	 * `Git.repoRoot` (`git rev-parse --show-toplevel`) above all. `ascend`
	 * compares `stopAt` lexically, so when `start` is reached through a symlink
	 * (every macOS tmpdir: `/var` → `/private/var`; any symlinked checkout) the
	 * chain never spells git's root, the ceiling never matches, and the walk
	 * runs silently to the filesystem root.
	 *
	 * The chain is still the lexical one derived from `start`, exactly as
	 * `ascend` yields it; only the stopping test is physical. A ceiling the
	 * chain already spells stops without touching the filesystem. Otherwise each
	 * ancestor's `realPath` is compared with the ceiling's, and a failed probe
	 * is absorbed as "not the ceiling", as {@link Walker.firstMatch} absorbs
	 * one. A ceiling that names no ancestor, or cannot itself be resolved,
	 * leaves the chain running to the filesystem root, as `ascend` does.
	 *
	 * The ceiling is an `Option` so "no ceiling" is spelled explicitly:
	 * `Option.none()` ascends to the filesystem root exactly as `ascend(start)`
	 * does, which is the natural answer outside any repository —
	 * `Walker.ascendWithin(start, yield* Effect.option(git.repoRoot(start)))`.
	 * A present ceiling must be absolute; a relative one **dies**, for the
	 * reasons {@link AscendOptions.stopAt} gives.
	 */
	static readonly ascendWithin = ascendWithin;

	/**
	 * The first candidate whose `predicate` reports true, or `Option.none()`.
	 *
	 * @remarks
	 * Each predicate is absorbed **individually**: a failure on one candidate is
	 * treated as "this candidate did not match" and the scan continues. One
	 * unreadable ancestor must never abort the walk, or a permission error deep in
	 * the tree would hide a valid root above it. Not-found and cannot-look are
	 * therefore indistinguishable to the caller; discovery is best-effort.
	 *
	 * `Effect.catch` catches failures, **not defects**. A predicate that throws is
	 * programmer error and surfaces as a defect. Do not change this to
	 * `Effect.catchCause` — the distinction is load-bearing.
	 */
	static readonly firstMatch = firstMatch;

	/**
	 * The first existing path among the candidates `candidatesFor` produces for each
	 * directory in `dirs`, scanned in order. Nearer directories win.
	 *
	 * @remarks
	 * Candidates materialize up front, bounded by `dirs.length × candidatesFor`'s
	 * output — a few hundred strings under the default `maxDepth`.
	 */
	static readonly findUpward = findUpward;

	/**
	 * The first directory in `dirs` that `isRoot` accepts.
	 *
	 * @remarks
	 * `firstMatch` over the directories themselves — the candidate expansion is the
	 * identity. `isRoot` is a caller-supplied marker test (a `.git` entry, a
	 * `pnpm-workspace.yaml`), and its failures are absorbed per directory.
	 */
	static readonly findRoot = findRoot;
}
