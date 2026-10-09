// Downward glob-file descent — walker's second concept module, and the first
// with a typed error channel.
//
// `@effected/glob` is a pure matching engine (no filesystem walker), and the
// workspaces enumerator is internal and package-dir-specific, so "files
// matching a glob under a directory" lives here. The walker is semantics-free:
// dotfile behavior, case folding and every other matching option are carried
// by the COMPILED pattern the caller hands in — this module never re-derives
// options, it only reads `hasMagic` / `negated` / `enumerationPrefix` /
// `crossesSegments` and calls `matches`.

import type { GlobPattern } from "../glob/index.ts";
import type { PlatformError } from "effect";
import { Effect, FileSystem, Path, Schema } from "effect";
import { dual } from "effect/Function";

/**
 * Options for `descend`.
 *
 * @public
 */
export interface DescendOptions {
	/** Absolute directory the pattern is resolved against. Required — walker never reads `process.cwd()`. */
	readonly cwd: string;
	/** Hard cap on directory depth below the pattern's literal prefix. Defaults to 256. */
	readonly maxDepth?: number;
	/** Directory names never descended into. Defaults to `["node_modules", ".git"]`; a custom list replaces the default. */
	readonly prune?: ReadonlyArray<string>;
	/**
	 * What an unreadable directory mid-walk does. `"fail"` (the default) fails
	 * typed — downward enumeration must not silently swallow a subtree, or the
	 * answer is silently missing membership dressed as an empty one. `"skip"`
	 * absorbs the failure and continues, discarding which directory it was.
	 * To collect the offending directories instead of discarding them, pass
	 * {@link DescendRecordOptions} — `"record"` is deliberately NOT a member
	 * here, because this type is the options contract of the overload that
	 * returns a bare match array.
	 */
	readonly onUnreadable?: "fail" | "skip";
	/**
	 * Whether to descend into symlinked directories. Defaults to `false`: a
	 * symlinked directory is never entered (cycle safety). Under `true` links
	 * are followed with the cycle guard kept underneath, in `@actions/glob`'s
	 * `traversalChain` semantics: each descended directory records its real
	 * path on its own branch's ancestor chain (only the base and each link pay
	 * a `FileSystem.realPath`; a plain directory's is derived from its
	 * parent's), and a directory whose real path is already an ancestor of the
	 * current branch closes a cycle and is skipped — so link loops terminate
	 * while two sibling links resolving to the same target both enumerate. A
	 * link whose real path cannot be resolved is never entered, and the
	 * failure follows `onUnreadable` exactly as an unreadable directory does:
	 * `NotFound` is a benign race and stays silent, anything else fails typed
	 * by default, is recorded under `"record"`, and is forgotten under
	 * `"skip"`. Following links matches `@actions/glob`'s default
	 * `followSymbolicLinks: true` and Node's recursive
	 * `fs.promises.readdir` — but the cycle guard is `@actions/glob`'s
	 * alone: Node's recursive `readdir` keeps no traversal chain and recurses
	 * without bound on a link loop.
	 */
	readonly followSymlinks?: boolean;
}

/**
 * Options for `descend` under `onUnreadable: "record"`: every
 * {@link DescendOptions} field, with `onUnreadable` fixed to `"record"`.
 *
 * @remarks
 * A separate type rather than `DescendOptions & { onUnreadable: "record" }`,
 * because the two options types are the discriminator between two different
 * RETURN types. If `DescendOptions` itself admitted `"record"`, a value
 * widened to `DescendOptions` — annotated as such, or passed through a
 * function taking it — would select the array-returning overload at compile
 * time while the implementation resolved a {@link DescendResult} at runtime,
 * and every array method on that result would fail with no type error
 * anywhere. Keeping `"record"` out of `DescendOptions` makes that
 * unrepresentable.
 *
 * @public
 */
export interface DescendRecordOptions extends Omit<DescendOptions, "onUnreadable"> {
	/** Collect every unreadable directory rather than failing or discarding it. */
	readonly onUnreadable: "record";
}

/**
 * One directory `descend` could not read under `onUnreadable: "record"`: its
 * `cwd`-relative path and the `PlatformError` that `readDirectory` — or,
 * for a symlinked directory under `followSymlinks`, `realPath` — failed
 * with. The cause is the very failure the walk absorbed, so a caller that
 * must report WHY a directory was unreadable never re-reads it.
 *
 * @public
 */
export interface UnreadableDirectory {
	/**
	 * The directory's path relative to `cwd`, POSIX separators.
	 *
	 * @remarks
	 * **The walk base appears as the empty string `""`**, since its own
	 * `cwd`-relative path is empty — so an unreadable base yields
	 * `{ matches: [], unreadable: [{ path: "", cause }] }`. Code matching
	 * these entries as ordinary paths will not expect that; special-case it.
	 */
	readonly path: string;
	/** The `readDirectory` (or, for a link under `followSymlinks`, `realPath`) failure, never `NotFound` (a vanished directory is a benign race and is not recorded). */
	readonly cause: PlatformError.PlatformError;
}

/**
 * `descend`'s success value under `onUnreadable: "record"`: the matched
 * FILE paths plus an {@link UnreadableDirectory} for every mid-walk
 * directory whose `readDirectory` (or, under `followSymlinks`, a symlinked
 * directory whose `realPath`) failed for a reason other than `NotFound` (a
 * vanished directory stays a benign race in every mode and is never
 * recorded).
 *
 * @public
 */
export interface DescendResult {
	/** Matching FILE paths relative to `cwd`, POSIX separators, sorted — identical in shape to the `"fail"`/`"skip"` success value. */
	readonly matches: ReadonlyArray<string>;
	/** Directories that could not be read, each with its cause, in walk order. */
	readonly unreadable: ReadonlyArray<UnreadableDirectory>;
}

/**
 * Typed failure raised by `descend`: a directory mid-walk was unreadable
 * (under `onUnreadable: "fail"`), or the walk descended past `maxDepth`. Depth
 * exhaustion is a typed failure, never a truncation — silent truncation
 * silently changes match semantics.
 *
 * @public
 */
export class DescendError extends Schema.TaggedError<DescendError>()("DescendError", {
	/** The glob pattern's source text. */
	pattern: Schema.String,
	/** Why the walk failed: a directory could not be read, or the walk went past `maxDepth`. */
	reason: Schema.Literals(["unreadableDirectory", "depthExceeded"]),
	/** The offending directory, relative to `cwd` (`""` is the walk's base). */
	path: Schema.String,
	/** The depth cap, present when `reason` is `"depthExceeded"`. */
	limit: Schema.optionalKey(Schema.Finite),
}) {
	override get message(): string {
		const where = this.path === "" ? "the base directory" : JSON.stringify(this.path);
		return this.reason === "depthExceeded"
			? `glob descent for ${JSON.stringify(this.pattern)} descended past ${this.limit ?? "the depth cap"} levels below ${where}`
			: `glob descent for ${JSON.stringify(this.pattern)} could not read ${where}`;
	}
}

/** Directory names never descended into unless the caller overrides `prune`. */
const DEFAULT_PRUNE: ReadonlyArray<string> = ["node_modules", ".git"];

/**
 * Whether a cwd-relative pattern path lexically climbs above `cwd` via `..`
 * segments. Walked paths never contain `..`, so such a pattern can never match
 * one — the answer is zero matches, and no filesystem access outside `cwd`
 * ever happens (a pattern must not enumerate the tree above its documented
 * root).
 */
const escapesCwd = (relative: string): boolean => {
	let depth = 0;
	for (const segment of relative.split("/")) {
		if (segment === "" || segment === ".") continue;
		depth += segment === ".." ? -1 : 1;
		if (depth < 0) return true;
	}
	return false;
};

/** Shared empty ancestor chain: frames under `followSymlinks: false` never consult theirs. */
const NO_ANCESTORS: ReadonlyArray<string> = Object.freeze([]);

/**
 * A directory queued for reading: its cwd-relative POSIX path, its absolute
 * path, its depth below the base, and — only under `followSymlinks` — the
 * real paths of this branch's ancestors, inherited from the parent frame.
 * The chain is per-branch, never walk-global: it is `@actions/glob`'s
 * `traversalChain` carried on the worklist, so a link is a cycle only when it
 * resolves to an ancestor of the branch it sits on, and two sibling links to
 * one target both enumerate.
 */
interface DescendFrame {
	readonly relative: string;
	readonly absolute: string;
	readonly depth: number;
	readonly ancestors: ReadonlyArray<string>;
}

/**
 * The one options shape spanning all three modes. Not exported: the PUBLIC
 * types are deliberately split so `"record"` cannot reach the array-returning
 * overload, and this internal union is what the single implementation body
 * needs in order to still branch on all three values.
 */
type DescendAnyOptions = Omit<DescendOptions, "onUnreadable"> & {
	readonly onUnreadable?: "fail" | "skip" | "record";
};

/** Not exported — `descend`'s overloads below carry the public documentation. */
const descendImpl: (
	pattern: GlobPattern,
	options: DescendAnyOptions,
) => Effect.Effect<ReadonlyArray<string> | DescendResult, DescendError, FileSystem.FileSystem | Path.Path> = Effect.fn(
	"Walker.descend",
)(function* (pattern: GlobPattern, options: DescendAnyOptions) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;

	const maxDepth = options.maxDepth ?? 256;
	if (!Number.isInteger(maxDepth) || maxDepth < 1) {
		return yield* Effect.die(new Error(`Walker.descend: maxDepth must be a positive integer, received ${maxDepth}`));
	}
	const prune = new Set(options.prune ?? DEFAULT_PRUNE);
	const onUnreadable = options.onUnreadable ?? "fail";
	const followSymlinks = options.followSymlinks ?? false;
	// Populated only under "record"; the wrapper decides the return shape.
	const unreadable: Array<UnreadableDirectory> = [];

	/** The stat-resolved type of `absolute`, or `undefined` when it does not resolve (missing, dangling symlink, unstatable). */
	const typeOf = (absolute: string): Effect.Effect<FileSystem.File.Info["type"] | undefined> =>
		fs.stat(absolute).pipe(
			Effect.map((info) => info.type),
			Effect.orElseSucceed(() => undefined),
		);

	/** Whether `absolute` is itself a symlink. `readLink` succeeds only on links; any failure means "not one". */
	const isSymbolicLink = (absolute: string): Effect.Effect<boolean> =>
		fs.readLink(absolute).pipe(
			Effect.map(() => true),
			Effect.orElseSucceed(() => false),
		);

	/**
	 * The real path of a directory the cycle guard must identify — the walk
	 * base, or a symlinked directory — or `undefined` when the walk must not
	 * enter it. A link the resolver cannot resolve is one the guard cannot
	 * reason about: recording a stand-in (the link's own path) would make
	 * every hop around a loop look unseen, so the subtree is never queued.
	 * Whether the caller HEARS about it follows `onUnreadable` exactly as a
	 * failed `readDirectory` does: a `NotFound` is the benign vanished-target
	 * race (the subtree would have read as empty anyway) and stays silent in
	 * every mode; anything else — `EACCES` on a path component, above all —
	 * is a subtree this walk was asked to enumerate and cannot, so the
	 * default fails typed, `"record"` keeps the path and the cause, and
	 * `"skip"` forgets it. A silent skip here would hand a caller a smaller
	 * answer with nothing reporting it, which is the failure `"fail"` exists
	 * to prevent.
	 */
	const realPathOf = (absolute: string, relative: string): Effect.Effect<string | undefined, DescendError> =>
		fs.realPath(absolute).pipe(
			Effect.catch((error) => {
				if (error.reason._tag === "NotFound") return Effect.void;
				if (onUnreadable === "fail") {
					return Effect.fail(
						DescendError.make({ pattern: pattern.source, reason: "unreadableDirectory", path: relative }),
					);
				}
				if (onUnreadable === "record") unreadable.push({ path: relative, cause: error });
				return Effect.void;
			}),
			Effect.map((real): string | undefined => real ?? undefined),
		);

	/** Wrap the walk's success value per `onUnreadable`: a plain array unless "record" asked for the pair. */
	const finish = (matches: ReadonlyArray<string>): ReadonlyArray<string> | DescendResult =>
		onUnreadable === "record" ? { matches, unreadable } : matches;

	// Literal pattern: a single stat decides. Missing is zero matches, and so is
	// a literal that climbs above `cwd` — never stat outside the documented root.
	if (!pattern.hasMagic && !pattern.negated) {
		if (escapesCwd(pattern.source)) return finish([]);
		return finish((yield* typeOf(path.join(options.cwd, pattern.source))) === "File" ? [pattern.source] : []);
	}

	// Magic pattern: walk from the literal prefix. An absent base directory is
	// an EMPTY result, not an error — zero matches is a normal glob answer. A
	// NEGATED pattern matches everything its inner pattern does NOT — including
	// paths outside the inner pattern's literal prefix — so it walks from `cwd`
	// itself, never from the inner prefix (which would silently omit matches).
	// A prefix that climbs above `cwd` yields zero matches for the same reason
	// the literal fast-path refuses it.
	const base = pattern.negated ? "" : pattern.enumerationPrefix.replace(/\/+$/, "");
	if (escapesCwd(base)) return finish([]);
	const absoluteBase = base === "" ? options.cwd : path.join(options.cwd, base);
	if ((yield* typeOf(absoluteBase)) !== "Directory") return finish([]);
	// Under followSymlinks the base's real path seeds the root frame's ancestor
	// chain — the `@actions/glob` traversalChain position for the search path —
	// so a link resolving back to the base is the cycle it is, on every branch.
	let baseAncestors: ReadonlyArray<string> = NO_ANCESTORS;
	if (followSymlinks) {
		const real = yield* realPathOf(absoluteBase, base);
		if (real === undefined) return finish([]);
		baseAncestors = [real];
	}

	// Only a pattern that can match below one level earns a descent; a negated
	// pattern matches everything its inner pattern does NOT, so it can match
	// arbitrarily deep paths and always walks.
	const deep = pattern.crossesSegments || pattern.negated;

	const results: Array<string> = [];
	const frames: Array<DescendFrame> = [{ relative: base, absolute: absoluteBase, depth: 0, ancestors: baseAncestors }];
	// A head index, never Array.shift(): shift() re-indexes the whole array on
	// every dequeue, turning a large walk quadratic.
	for (let head = 0; head < frames.length; head += 1) {
		const frame = frames[head];
		if (frame === undefined) break;

		// A directory that vanished between its parent's listing and this read is
		// a benign race — treat it as empty, and never record it as unreadable:
		// `DescendResult.unreadable` documents only a non-`NotFound` failure.
		// Anything else means a subtree we were asked to enumerate is unreadable,
		// and (unlike walker's upward per-probe absorption, where the scan can
		// still succeed above) a swallowed subtree down here is silently missing
		// membership — so the default fails typed. `"record"` also absorbs and
		// continues, like `"skip"`, but keeps the offending relative path AND
		// the failure itself instead of discarding them.
		const entries = yield* fs.readDirectory(frame.absolute).pipe(
			Effect.catch((error) => {
				if (error.reason._tag === "NotFound") return Effect.succeed<Array<string>>([]);
				if (onUnreadable === "fail") {
					return Effect.fail(
						DescendError.make({ pattern: pattern.source, reason: "unreadableDirectory", path: frame.relative }),
					);
				}
				if (onUnreadable === "record") unreadable.push({ path: frame.relative, cause: error });
				return Effect.succeed<Array<string>>([]);
			}),
		);

		for (const entry of entries) {
			const relative = frame.relative === "" ? entry : `${frame.relative}/${entry}`;
			const absolute = path.join(frame.absolute, entry);

			const kind = yield* typeOf(absolute);
			if (kind === "File") {
				if (pattern.matches(relative)) results.push(relative);
				continue;
			}
			if (kind !== "Directory" || !deep) continue;
			// Prune suppresses DIRECTORIES only, per the option's contract — a
			// FILE named `.git` (a submodule or worktree gitlink) stays matchable.
			if (prune.has(entry)) continue;
			// A symlinked directory is skipped unless followSymlinks asked for
			// it; when it does, the cycle guard is `@actions/glob`'s
			// traversalChain carried per branch: every descended directory
			// records its real path on the frame's ancestor chain, and a
			// directory whose real path is already an ancestor of the current
			// branch closes a cycle and is skipped. Sibling links resolving to
			// one target sit on separate branches, so both enumerate — the
			// parity the runner's globber has, which a walk-global visited set
			// would break. Only a LINK pays a `realPath`: a plain directory's
			// real path is its parent's real path (the chain's last entry —
			// the base was resolved up front, and every link since was) plus
			// its own name, derived with no syscall and no failure mode. A
			// link whose real path cannot be resolved is never queued — the
			// guard cannot reason about it, and a stand-in (the link's own
			// path) would make every hop around a loop look unseen — and
			// `realPathOf` reports or fails that per `onUnreadable`.
			let ancestors = frame.ancestors;
			if (followSymlinks) {
				const parentReal = frame.ancestors[frame.ancestors.length - 1] ?? frame.absolute;
				const real = (yield* isSymbolicLink(absolute))
					? yield* realPathOf(absolute, relative)
					: path.join(parentReal, entry);
				if (real === undefined || frame.ancestors.includes(real)) continue;
				ancestors = [...frame.ancestors, real];
			} else if (yield* isSymbolicLink(absolute)) {
				continue;
			}
			// Depth exhaustion is a typed failure, not a truncation.
			if (frame.depth + 1 > maxDepth) {
				return yield* DescendError.make({
					pattern: pattern.source,
					reason: "depthExceeded",
					path: frame.relative,
					limit: maxDepth,
				});
			}
			frames.push({ relative, absolute, depth: frame.depth + 1, ancestors });
		}
	}

	results.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	return finish(results);
});

/**
 * Expand a compiled glob pattern against the filesystem under
 * `onUnreadable: "record"`, resolving to a {@link DescendResult} — the
 * matched FILE paths relative to `cwd` (POSIX separators, sorted) plus an
 * {@link UnreadableDirectory} — path and cause — for every mid-walk
 * directory whose `readDirectory` (or, under `followSymlinks`, a symlinked
 * directory whose `realPath`) failed for a reason other than `NotFound`.
 * The walk continues past each such directory exactly as `"skip"` does; it
 * never aborts and it never discards the offending path or its cause.
 *
 * @public
 */
export function descend(
	options: DescendRecordOptions,
): (pattern: GlobPattern) => Effect.Effect<DescendResult, DescendError, FileSystem.FileSystem | Path.Path>;
export function descend(
	pattern: GlobPattern,
	options: DescendRecordOptions,
): Effect.Effect<DescendResult, DescendError, FileSystem.FileSystem | Path.Path>;
/**
 * Expand a compiled glob pattern against the filesystem, returning matching
 * FILE paths relative to `cwd` (POSIX separators), sorted by relative path.
 *
 * @remarks
 * A literal pattern (no magic, not negated) fast-paths to a single stat: the
 * result is `[source]` when it resolves to a file, `[]` otherwise — a missing
 * path is zero matches, not an error. A magic pattern walks from its literal
 * directory prefix (`GlobPattern.enumerationPrefix`); a NEGATED pattern can
 * match paths outside that prefix, so it walks from `cwd` itself. A missing
 * base directory is likewise an empty result, because zero matches is a
 * normal glob answer — as is any pattern that lexically climbs above `cwd`
 * via `..` segments (walked paths never contain `..`). "Never reads outside
 * its documented root" holds lexically always, and physically only while
 * `followSymlinks` is off: under it, a link whose target lives outside `cwd`
 * is descended, exactly as `@actions/glob` follows links out of the tree.
 * Only an unreadable directory mid-walk
 * (under the default `onUnreadable: "fail"`) or a walk past `maxDepth` fails,
 * typed as {@link DescendError}.
 *
 * Only files match. A symlink counts when it stat-resolves to a file
 * (`FileSystem.stat` follows links, as node's does); a symlinked directory is
 * never descended into by default (cycle safety — detected by a `readLink`
 * probe), unless `followSymlinks: true` asks for it, which follows links under
 * `@actions/glob`'s `traversalChain` cycle guard: a directory is a cycle only
 * when its real path is already an ancestor of the current branch, so sibling
 * links resolving to the same target both enumerate. A link whose real path
 * cannot be resolved is never entered, and a resolution failure other than
 * `NotFound` is an unreadable directory under `onUnreadable`. A dangling
 * symlink is not a match. A
 * directory that vanishes between its parent's listing and its own read is a
 * benign race and reads as empty. A pattern that cannot match below one level
 * (no globstar, no mid-pattern magic segment) reads a single level and never
 * descends.
 *
 * The descent is a worklist, not a recursion — it cannot overflow the stack —
 * dequeued by head index, never `Array.shift()`. Like `ascend`, `maxDepth`
 * must be a positive integer: anything else is a defect, never a
 * silently-empty result.
 *
 * Passing `onUnreadable: "record"` resolves to a {@link DescendResult}
 * instead — see that overload.
 *
 * @example
 * ```ts
 * import { GlobPattern } from "../glob/index.ts";
 * import { descend } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const pattern = yield* GlobPattern.compile("src/*.ts");
 * 	// Sorted, cwd-relative POSIX paths of the matching files.
 * 	return yield* descend(pattern, { cwd: "/repo" });
 * });
 * // Requires `FileSystem` and `Path` from the platform layer.
 * ```
 *
 * @public
 */
export function descend(
	pattern: GlobPattern,
	options: DescendOptions,
): Effect.Effect<ReadonlyArray<string>, DescendError, FileSystem.FileSystem | Path.Path>;
export function descend(
	options: DescendOptions,
): (pattern: GlobPattern) => Effect.Effect<ReadonlyArray<string>, DescendError, FileSystem.FileSystem | Path.Path>;
export function descend(
	...args: [GlobPattern, DescendOptions | DescendRecordOptions] | [DescendOptions | DescendRecordOptions]
):
	| Effect.Effect<ReadonlyArray<string> | DescendResult, DescendError, FileSystem.FileSystem | Path.Path>
	| ((pattern: GlobPattern) => Effect.Effect<ReadonlyArray<string> | DescendResult, DescendError, FileSystem.FileSystem | Path.Path>) {
	const invoke = dual<
		(options: DescendOptions | DescendRecordOptions) => (pattern: GlobPattern) => ReturnType<typeof descendImpl>,
		typeof descendImpl
	>(2, descendImpl);
	return args.length === 1 ? invoke(args[0]) : invoke(args[0], args[1]);
}
