import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { MAX_ENUMERATION_ENTRIES, PRUNED_DIRECTORIES } from "./limits.ts";
import type { GlobSet } from "@beep/glob";

const $I = $RepoWorkspacesId.create("internal/traverse");

const MaxDepth = S.Finite.check(
  S.makeFilter(
    Number.isInteger,
    $I.annote("IntegerDepth", {
      description: "An integer depth bound, with the same accepted range as Number.isInteger.",
    })
  ),
  S.isGreaterThanOrEqualTo(
    1,
    $I.annote("MinimumDepth", {
      message: "Minimum workspace traversal depth",
      description: "A workspace traversal depth bound greater than or equal to one.",
    })
  )
).pipe($I.annoteSchema("MaxDepth", { description: "A positive integer workspace traversal depth bound." }));

/**
 * A directory queued for reading: its root-relative POSIX path, its absolute path, and its depth below the base.
 *
 * **Example** (Recognize a queued directory frame)
 *
 * ```ts
 * import { TraversalFrame } from "@beep/repo-workspaces/internal/traverse";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TraversalFrame)({ relative: "packages", absolute: "/repo/packages", depth: 0 })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TraversalFrame extends S.Opaque<TraversalFrame, { readonly brand: unique symbol }>()(
  S.Struct({
    relative: S.String.pipe(
      $I.annoteKey("TraversalFrame.relative", { description: "The root-relative POSIX directory path." })
    ),
    absolute: S.String.pipe(
      $I.annoteKey("TraversalFrame.absolute", { description: "The absolute directory path passed to IO." })
    ),
    depth: S.declare(P.isNumber).pipe(
      $I.annoteKey("TraversalFrame.depth", { description: "The directory depth below the traversal base." })
    ),
  }).pipe($I.annoteSchema("TraversalFrame", { description: "A plain directory frame queued by workspace traversal." }))
) {}
/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TraversalFrame {
  /**
   * The plain, unbranded encoded shape of a {@link TraversalFrame}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TraversalFrame.Encoded;
}

/**
 * **Example** (Describe a depth stop)
 *
 * ```ts
 * import { DepthStop } from "@beep/repo-workspaces/internal/traverse";
 *
 * console.log(DepthStop.make({ detail: "descended past 1 levels" }).kind); // depthExceeded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DepthStop extends S.Opaque<DepthStop, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("depthExceeded").pipe(
      $I.annoteKey("TraversalStop.depthExceeded", { description: "The traversal exhausted its depth bound." })
    ),
    detail: S.String.pipe(
      $I.annoteKey("TraversalStop.depthDetail", { description: "The caller-visible depth-limit diagnostic." })
    ),
  }).pipe($I.annoteSchema("DepthStop", { description: "A traversal stopped at its depth bound." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DepthStop {
  /**
   * The plain, unbranded encoded shape of a {@link DepthStop}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DepthStop.Encoded;
}

/**
 * **Example** (Describe a budget stop)
 *
 * ```ts
 * import { BudgetStop } from "@beep/repo-workspaces/internal/traverse";
 *
 * console.log(BudgetStop.make({ detail: "visited more than 1 directories" }).kind); // budgetExceeded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BudgetStop extends S.Opaque<BudgetStop, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("budgetExceeded").pipe(
      $I.annoteKey("TraversalStop.budgetExceeded", {
        description: "The traversal exhausted its directory-read budget.",
      })
    ),
    detail: S.String.pipe(
      $I.annoteKey("TraversalStop.budgetDetail", { description: "The caller-visible visit-budget diagnostic." })
    ),
  }).pipe($I.annoteSchema("BudgetStop", { description: "A traversal stopped at its directory-read budget." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BudgetStop {
  /**
   * The plain, unbranded encoded shape of a {@link BudgetStop}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof BudgetStop.Encoded;
}

/**
 * Describes why a traversal stopped early.
 *
 * **Details**
 *
 * Both bounds are caller-visible conditions, never defects.
 *
 * **Example** (Recognize an existing traversal stop)
 *
 * ```ts
 * import { TraversalStop } from "@beep/repo-workspaces/internal/traverse";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TraversalStop)({ kind: "budgetExceeded", detail: "visited more than 1 directories" })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TraversalStop = S.Union([DepthStop, BudgetStop]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("TraversalStop", {
    description: "The existing plain-record reasons a workspace traversal stops early.",
  })
);
/**
 * The readonly bound failure described by {@link TraversalStop}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TraversalStop = typeof TraversalStop.Type;

/**
 * Identifies directory names never descended into.
 *
 * **Example** (Check a pruned directory name)
 *
 * ```ts
 * import { isPruned } from "@beep/repo-workspaces/internal/traverse";
 *
 * console.log(isPruned("node_modules")); // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPruned = (entry: string): boolean => HashSet.has(PRUNED_DIRECTORIES, entry);

/**
 * Builds the predicate a compiled set's excludes make: whether any of them
 * rejects a workspace-relative path.
 *
 * **Details**
 *
 * Both enumeration entry points share it, so an empty exclude list is the
 * constant `false` in each rather than a per-path scan of nothing.
 *
 * **Example** (Reject the paths an exclude names)
 *
 * ```ts
 * import { GlobSet } from "@beep/glob/GlobSet";
 * import { excludedBy } from "@beep/repo-workspaces/internal/traverse";
 * import * as Effect from "effect/Effect";
 *
 * const globs = Effect.runSync(GlobSet.compile(["packages/*", "!packages/legacy"]));
 * const isExcluded = excludedBy(globs.excludes);
 * console.log(isExcluded("packages/legacy")); // true
 * console.log(isExcluded("packages/core")); // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const excludedBy = (excludes: GlobSet["excludes"]): ((relative: string) => boolean) =>
  A.isReadonlyArrayNonEmpty(excludes)
    ? (relative) => A.some(excludes, (exclude) => exclude.matches(relative))
    : () => false;

/**
 * Joins root-relative POSIX segments; `""` is the root itself.
 *
 * **Example** (Join paths from the root and a package directory)
 *
 * ```ts
 * import { joinRelative } from "@beep/repo-workspaces/internal/traverse";
 *
 * console.log(joinRelative("", "packages")); // packages
 * console.log(joinRelative("core")("packages")); // packages/core
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const joinRelative: {
  (entry: string): (base: string) => string;
  (base: string, entry: string): string;
} = dual(2, (base: string, entry: string): string => (base === "" ? entry : `${base}/${entry}`));

/**
 * Validates that `maxDepth` is a usable positive integer bound.
 *
 * **Gotchas**
 *
 * `NaN < 1` is `false` and so is `2.5 < 1` — a bare relational guard admits both,
 * and a `NaN` bound then runs the loop zero times and returns an empty result
 * indistinguishable from a legitimate one. Integrality first. A bad bound is a
 * PROGRAMMER error, not a data condition, so both entry points treat it as a
 * defect (an `Effect.die` / a thrown `RangeError`) rather than a typed failure.
 *
 * **Example** (Reject nonintegral and nonfinite depth bounds)
 *
 * ```ts
 * import { isValidMaxDepth } from "@beep/repo-workspaces/internal/traverse";
 *
 * console.log(isValidMaxDepth(2)); // true
 * console.log(isValidMaxDepth(2.5)); // false
 * console.log(isValidMaxDepth(NaN)); // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isValidMaxDepth = S.is(MaxDepth);

/**
 * Produces the message both entry points use when `maxDepth` is not a positive integer.
 *
 * **Example** (Explain an invalid depth bound)
 *
 * ```ts
 * import { badMaxDepthMessage } from "@beep/repo-workspaces/internal/traverse";
 *
 * console.log(badMaxDepthMessage(0)); // maxDepth must be a positive integer, received 0
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const badMaxDepthMessage = (maxDepth: number): string =>
  `maxDepth must be a positive integer, received ${String(maxDepth)}`;

/**
 * Manages the shared worklist for one wildcard's descent.
 *
 * **Details**
 *
 * A worklist, not a recursion: it cannot overflow the stack, so there is no cap
 * to get wrong.
 *
 * **Example** (Start a traversal at the base directory)
 *
 * ```ts
 * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
 *
 * const traversal = new Traversal("packages", "/repo/packages", 2);
 * console.log(traversal.next()?.depth); // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Traversal {
  /**
   * Stores the queued directory frames for this traversal.
   *
   * **Example** (Read the initial queued frame)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("packages", "/repo/packages", 1);
   * console.log(traversal.next()?.relative); // packages
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  readonly #frames: Array<TraversalFrame> = [];
  /**
   * Tracks the next unread frame without reindexing the worklist.
   *
   * **Example** (Advance past the only queued frame)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("", "/repo", 1);
   * traversal.next();
   * console.log(traversal.next()); // undefined
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  #head = 0;
  /**
   * Counts directory reads charged against the visit budget.
   *
   * **Example** (Count reads until the budget is exceeded)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("", "/repo", 1, 1);
   * traversal.charge();
   * console.log(traversal.charge()?.kind); // budgetExceeded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  #visited = 0;
  /**
   * Retains the root-relative base path used in depth-limit diagnostics.
   *
   * **Example** (Include the base path in a depth diagnostic)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("packages", "/repo/packages", 1);
   * console.log(traversal.depthStop().detail); // descended past 1 levels below "packages"
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  readonly #base: string;
  /**
   * Stores the depth cap used to decide whether child directories are in scope.
   *
   * **Example** (Reject a child beyond the configured depth)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("", "/repo", 1);
   * console.log(traversal.admits({ relative: "packages", absolute: "/repo/packages", depth: 1 })); // false
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  readonly #maxDepth: number;
  /**
   * Stores the maximum number of directory reads permitted by the visit budget.
   *
   * **Example** (Report the configured directory budget)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("", "/repo", 1, 1);
   * traversal.charge();
   * console.log(traversal.charge()?.detail); // visited more than 1 directories
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  readonly #maxEntries: number;

  constructor(base: string, absoluteBase: string, maxDepth: number, maxEntries: number = MAX_ENUMERATION_ENTRIES) {
    this.#base = base;
    this.#maxDepth = maxDepth;
    this.#maxEntries = maxEntries;
    this.#frames.push(TraversalFrame.make({ relative: base, absolute: absoluteBase, depth: 0 }));
  }

  /**
   * The next directory to read, or `undefined` when the worklist is drained.
   *
   * **Details**
   *
   * A head index, never `Array.shift()`. `shift()` re-indexes the whole array on
   * every dequeue, so draining a worklist anywhere near `MAX_ENUMERATION_ENTRIES`
   * (100,000) is quadratic — the very budget that bounds the walk would become
   * the slow path.
   *
   * **Example** (Drain the initial worklist)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("", "/repo", 1);
   * console.log(traversal.next()?.absolute); // /repo
   * console.log(traversal.next()); // undefined
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  next(): TraversalFrame | undefined {
    if (this.#head >= this.#frames.length) return undefined;
    const frame = this.#frames[this.#head];
    this.#head += 1;
    return frame;
  }

  /**
   * Charges one directory read against the visit budget.
   *
   * **Example** (Exhaust a one-directory visit budget)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("", "/repo", 1, 1);
   * console.log(traversal.charge()); // undefined
   * console.log(traversal.charge()?.kind); // budgetExceeded
   * ```
   *
   * @category resource-management
   * @since 0.0.0
   */
  charge(): TraversalStop | undefined {
    this.#visited += 1;
    if (this.#visited > this.#maxEntries) {
      return BudgetStop.make({ detail: `visited more than ${this.#maxEntries} directories` });
    }
    return undefined;
  }

  /**
   * Checks whether a child of `parent` lies within the depth cap.
   *
   * **Gotchas**
   *
   * Callers must consult this BEFORE accepting a child as a package, not merely
   * before descending into it. The cap bounds what the traversal *enumerates*;
   * a directory beyond it is out of scope entirely, and gating only the descent
   * is what let a package one level past the cap slip into the sync results.
   *
   * **Example** (Check the child depth before accepting a package)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("", "/repo", 1);
   * console.log(traversal.admits({ relative: "", absolute: "/repo", depth: 0 })); // true
   * console.log(traversal.admits({ relative: "packages", absolute: "/repo/packages", depth: 1 })); // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  admits(parent: TraversalFrame.Encoded): boolean {
    return parent.depth + 1 <= this.#maxDepth;
  }

  /**
   * Produces the stop condition for a child beyond the depth cap.
   *
   * **Example** (Describe the exceeded depth cap)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("packages", "/repo/packages", 1);
   * console.log(traversal.depthStop().detail); // descended past 1 levels below "packages"
   * ```
   *
   * @category diagnostics
   * @since 0.0.0
   */
  depthStop(): TraversalStop {
    return DepthStop.make({ detail: `descended past ${this.#maxDepth} levels below "${this.#base}"` });
  }

  /**
   * Queues a child of `parent` for descent.
   *
   * **Gotchas**
   *
   * Only call when {@link Traversal.admits} holds.
   *
   * **Example** (Queue an admitted child directory)
   *
   * ```ts
   * import { Traversal } from "@beep/repo-workspaces/internal/traverse";
   *
   * const traversal = new Traversal("", "/repo", 1);
   * const parent = traversal.next();
   * if (parent !== undefined && traversal.admits(parent)) {
   *   traversal.push(parent, "packages", "/repo/packages");
   * }
   * console.log(traversal.next()?.relative); // packages
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  push(parent: TraversalFrame.Encoded, relative: string, absolute: string): void {
    this.#frames.push(TraversalFrame.make({ relative, absolute, depth: parent.depth + 1 }));
  }
}
