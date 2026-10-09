import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
// The ONE workspace traversal.
//
// Both entry points drive this state machine: the Effect enumerator
// (`internal/enumerate.ts`) and the synchronous escape hatch (`WorkspacesSync.ts`).
// They differ ONLY in how they do IO and in what they do with a `TraversalStop` —
// the Effect path fails typed, the sync path is total and truncates. The
// dequeue discipline, the depth rule, the visit budget and the prune list live
// here, once.
//
// Two hand-written copies of one traversal is exactly how the two APIs came to
// disagree: the sync copy accepted a child *before* checking its depth, so it
// returned packages one level beyond the cap while the Effect copy failed with
// `depthExceeded` on the very same tree. A shared state machine makes that class
// of drift unrepresentable rather than merely fixed.

import { MAX_ENUMERATION_ENTRIES, PRUNED_DIRECTORIES } from "./limits.ts";

/** A directory queued for reading: its root-relative POSIX path, its absolute path, and its depth below the base. */
export interface TraversalFrame {
	readonly relative: string;
	readonly absolute: string;
	readonly depth: number;
}

/** Why a traversal stopped early. Both bounds are caller-visible conditions, never defects. */
export interface TraversalStop {
	readonly kind: "depthExceeded" | "budgetExceeded";
	readonly detail: string;
}

/** Directory names never descended into. */
export const isPruned = (entry: string): boolean => HashSet.has(PRUNED_DIRECTORIES, entry);

/** Join root-relative POSIX segments; `""` is the root itself. */
export const joinRelative: {
	(entry: string): (base: string) => string;
	(base: string, entry: string): string;
} = dual(2, (base: string, entry: string): string => (base === "" ? entry : `${base}/${entry}`));

/**
 * Whether `maxDepth` is a usable bound.
 *
 * `NaN < 1` is `false` and so is `2.5 < 1` — a bare relational guard admits both,
 * and a `NaN` bound then runs the loop zero times and returns an empty result
 * indistinguishable from a legitimate one. Integrality first. A bad bound is a
 * PROGRAMMER error, not a data condition, so both entry points treat it as a
 * defect (an `Effect.die` / a thrown `RangeError`) rather than a typed failure.
 */
export const isValidMaxDepth = (maxDepth: number): boolean => Number.isInteger(maxDepth) && maxDepth >= 1;

/** The message both entry points use when `maxDepth` is not a positive integer. */
export const badMaxDepthMessage = (maxDepth: number): string =>
	`maxDepth must be a positive integer, received ${String(maxDepth)}`;

/**
 * The shared worklist for one wildcard's descent.
 *
 * A worklist, not a recursion: it cannot overflow the stack, so there is no cap
 * to get wrong.
 */
export class Traversal {
	readonly #frames: Array<TraversalFrame> = [];
	#head = 0;
	#visited = 0;
	readonly #base: string;
	readonly #maxDepth: number;
	readonly #maxEntries: number;

	constructor(base: string, absoluteBase: string, maxDepth: number, maxEntries: number = MAX_ENUMERATION_ENTRIES) {
		this.#base = base;
		this.#maxDepth = maxDepth;
		this.#maxEntries = maxEntries;
		this.#frames.push({ relative: base, absolute: absoluteBase, depth: 0 });
	}

	/**
	 * The next directory to read, or `undefined` when the worklist is drained.
	 *
	 * A head index, never `Array.shift()`. `shift()` re-indexes the whole array on
	 * every dequeue, so draining a worklist anywhere near `MAX_ENUMERATION_ENTRIES`
	 * (100,000) is quadratic — the very budget that bounds the walk would become
	 * the slow path.
	 */
	next(): TraversalFrame | undefined {
		if (this.#head >= this.#frames.length) return undefined;
		const frame = this.#frames[this.#head];
		this.#head += 1;
		return frame;
	}

	/** Charge one directory read against the visit budget. */
	charge(): TraversalStop | undefined {
		this.#visited += 1;
		if (this.#visited > this.#maxEntries) {
			return { kind: "budgetExceeded", detail: `visited more than ${this.#maxEntries} directories` };
		}
		return undefined;
	}

	/**
	 * Whether a child of `parent` lies within the depth cap.
	 *
	 * Callers must consult this BEFORE accepting a child as a package, not merely
	 * before descending into it. The cap bounds what the traversal *enumerates*;
	 * a directory beyond it is out of scope entirely, and gating only the descent
	 * is what let a package one level past the cap slip into the sync results.
	 */
	admits(parent: TraversalFrame): boolean {
		return parent.depth + 1 <= this.#maxDepth;
	}

	/** The stop a child beyond the depth cap produces. */
	depthStop(): TraversalStop {
		return { kind: "depthExceeded", detail: `descended past ${this.#maxDepth} levels below "${this.#base}"` };
	}

	/** Queue a child of `parent` for descent. Only call when {@link Traversal.admits} holds. */
	push(parent: TraversalFrame, relative: string, absolute: string): void {
		this.#frames.push({ relative, absolute, depth: parent.depth + 1 });
	}
}
