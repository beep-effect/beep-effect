import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { dual } from "effect/Function";
import { $ScratchpadId } from "@beep/identity/packages";
import * as MutableHashMap from "effect/MutableHashMap";
import * as S from "effect/Schema";
// The `packages:` enumerator. `@effected/glob` classifies the pattern set and
// tells us, per wildcard, whether it can cross a segment boundary; when it can,
// a trailing `/**` earns a real descent rather than a one-level read.
//
// The descent is a WORKLIST, not a recursion: it cannot overflow the stack, so
// there is no cap to get wrong. It is bounded by depth, by a visited-directory
// budget, and by an unconditional node_modules / .git prune.

import type { GlobPattern, GlobSet } from "../../glob/index.ts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { MAX_ENUMERATION_DEPTH } from "./limits.ts";
import { Traversal, badMaxDepthMessage, isPruned, isValidMaxDepth, joinRelative } from "./traverse.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/workspaces/internal/enumerate");

class EnumerationOptionsError extends S.TaggedError<EnumerationOptionsError>($I`EnumerationOptionsError`)("EnumerationOptionsError", {
	message: S.String,
}, $I.annote("EnumerationOptionsError", { description: "An invalid workspace enumeration depth bound." })) {}

/** A directory the enumerator accepted: its root-relative POSIX path and its absolute path. */
export interface EnumeratedDirectory {
	readonly relativePath: string;
	readonly path: string;
}

/** Why an enumeration failed. Every member is a caller-visible condition, never a defect. */
export const EnumerationFailureKind = LiteralKit(["missingBaseDir", "depthExceeded", "budgetExceeded", "unreadableDirectory"]).annotate(
	$I.annote("EnumerationFailureKind", { description: "The caller-visible reasons workspace enumeration can fail." }),
);
export type EnumerationFailureKind = typeof EnumerationFailureKind.Type;

/** The enumerator's raw failure record; the facade materializes the typed error. */
export interface EnumerationFailure {
	readonly kind: EnumerationFailureKind;
	readonly pattern: string;
	readonly detail: string;
}

/** Options for {@link enumerate}. */
export interface EnumerateOptions {
	/** Descent cap below a wildcard's enumeration prefix. Defaults to 32. */
	readonly maxDepth?: number;
}

/** Strip a trailing slash from `GlobPattern.enumerationPrefix` to get a relative directory. */
const baseOf = (pattern: GlobPattern): string => pattern.enumerationPrefix.replace(/\/$/, "");

/**
 * Enumerate the workspace directories a compiled `packages:` set selects.
 *
 * Every returned directory holds a `package.json`, matches at least one include
 * (literal or wildcard), and is rejected by no exclude. Results are sorted by
 * relative path.
 */
export const enumerate: {
	(globs: GlobSet, options?: EnumerateOptions): (root: string) => Effect.Effect<ReadonlyArray<EnumeratedDirectory>, EnumerationFailure, FileSystem.FileSystem | Path.Path>;
	(root: string, globs: GlobSet, options?: EnumerateOptions): Effect.Effect<ReadonlyArray<EnumeratedDirectory>, EnumerationFailure, FileSystem.FileSystem | Path.Path>;
} = dual((args) => P.isString(args[0]) && args.length >= 2, Effect.fnUntraced(function* (
	root: string,
	globs: GlobSet,
	options?: EnumerateOptions,
): Effect.fn.Return<ReadonlyArray<EnumeratedDirectory>, EnumerationFailure, FileSystem.FileSystem | Path.Path> {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;

	const maxDepth = options?.maxDepth ?? MAX_ENUMERATION_DEPTH;
	// A bad bound is a PROGRAMMER error, not a data condition — a defect, not a
	// typed failure. The predicate is shared with the sync hatch so the two
	// entry points cannot disagree about what a valid bound is.
	if (!isValidMaxDepth(maxDepth)) {
		return yield* Effect.die(EnumerationOptionsError.make({ message: `enumerate: ${badMaxDepthMessage(maxDepth)}` }));
	}

	const isPackage = (absolute: string): Effect.Effect<boolean> =>
		fs.exists(path.join(absolute, "package.json")).pipe(Effect.orElseSucceed(() => false));

	const isDirectory = (absolute: string): Effect.Effect<boolean> =>
		fs.stat(absolute).pipe(
			Effect.map((info) => info.type === "Directory"),
			Effect.orElseSucceed(() => false),
		);

	const excludes = globs.excludes;
	const isExcluded =
		excludes.length === 0
			? (_: string): boolean => false
			: (relative: string): boolean => excludes.some((exclude) => exclude.matches(relative));

	const included = MutableHashMap.empty<string, string>();

	/** A shared-traversal stop, materialized as this module's failure record. */
	const failureOf = (stop: { readonly kind: EnumerationFailureKind; readonly detail: string }, pattern: string): EnumerationFailure =>
		({ kind: stop.kind, pattern, detail: stop.detail });

	// Literals: an exact lookup, no directory read at all.
	//
	// `Effect.forEach` defaults to concurrency 1, so the explicit bound is what
	// lets independent `package.json` existence probes overlap.
	const literalHits = yield* Effect.forEach(
		globs.literals,
		Effect.fnUntraced(function* (literal) {
			if (isExcluded(literal)) return undefined;
			const absolute = path.join(root, literal);
			return (yield* isPackage(absolute)) ? ([literal, absolute] as const) : undefined;
		}),
		{ concurrency: 10 },
	);
	for (const hit of literalHits) {
		if (hit === undefined) continue;
		MutableHashMap.set(included, hit[0], hit[1]);
	}

	for (const wildcard of globs.wildcards) {
		const base = baseOf(wildcard);
		const absoluteBase = path.join(root, base);

		const exists = yield* isDirectory(absoluteBase);
		if (!exists) {
			// Failing here is what catches a typo in `packages:` instead of
			// silently discovering nothing.
			return yield* Effect.fail<EnumerationFailure>({
				kind: "missingBaseDir",
				pattern: wildcard.source,
				detail: base === "" ? root : base,
			});
		}

		// THE shared traversal — the same state machine `WorkspacesSync` drives.
		const traversal = new Traversal(base, absoluteBase, maxDepth);

		for (let current = traversal.next(); current !== undefined; current = traversal.next()) {
			const spent = traversal.charge();
			if (spent !== undefined) return yield* Effect.fail(failureOf(spent, wildcard.source));

			// A directory that vanished between the parent's listing and this read
			// is a benign race — treat it as empty. Anything else (permission
			// denied, an IO error) means a subtree we were asked to enumerate is
			// unreadable, and answering with "no packages there" would be a WRONG
			// ANSWER dressed as an empty one.
			//
			// This is deliberately NOT `@effected/walker`'s per-probe absorption.
			// Walker absorbs because one unreadable ANCESTOR must not hide a valid
			// root above it — the walk continues upward and can still succeed. This
			// is DOWNWARD enumeration: a swallowed subtree is silently missing
			// membership, which is the same silent-degradation shape as the
			// trailing-`/**` bug this module exists to fix.
			const frame = current;
			const entries = yield* fs.readDirectory(frame.absolute).pipe(
				Effect.catch((error) =>
					error.reason._tag === "NotFound"
						? Effect.succeed<ReadonlyArray<string>>([])
						: Effect.fail<EnumerationFailure>({
								kind: "unreadableDirectory",
								pattern: wildcard.source,
								detail: frame.relative === "" ? root : frame.relative,
							}),
				),
			);

			for (const entry of entries) {
				if (isPruned(entry)) continue;

				const relative = joinRelative(frame.relative, entry);
				const absolute = path.join(frame.absolute, entry);
				if (!(yield* isDirectory(absolute))) continue;

				// Depth is checked BEFORE acceptance, not merely before descent. The
				// cap bounds what the traversal ENUMERATES; a directory past it is out
				// of scope entirely. Gating only the descent is what let the sync copy
				// return a package one level beyond the cap that this path rejected.
				if (wildcard.crossesSegments && !traversal.admits(frame)) {
					return yield* Effect.fail(failureOf(traversal.depthStop(), wildcard.source));
				}

				if (wildcard.matches(relative) && !isExcluded(relative) && (yield* isPackage(absolute))) {
					MutableHashMap.set(included, relative, absolute);
				}

				// Only a segment-crossing pattern earns a descent. `packages/*`
				// reads one level, correctly for that pattern.
				if (!wildcard.crossesSegments) continue;

				traversal.push(frame, relative, absolute);
			}
		}
	}

	const results: Array<EnumeratedDirectory> = [];
	for (const [relativePath, absolute] of included) {
		results.push({ relativePath, path: absolute });
	}
	return A.sort(results, Order.mapInput(Str.Order, (entry: EnumeratedDirectory) => entry.relativePath));
}));
