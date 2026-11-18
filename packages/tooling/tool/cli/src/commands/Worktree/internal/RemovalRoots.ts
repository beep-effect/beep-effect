/**
 * The worktree roots the removal fence admits for a clone.
 *
 * A clone's lanes live in four kinds of place: the sibling `-worktrees`
 * directory, the worktrees Claude Code nests inside the clone, the directory
 * T3 Code keeps for the clone under `<home>/.t3/worktrees`, and any root the
 * repository's fleet roots registry (`BEEP_FLEET_ROOTS` or `roots.json`)
 * lists. A root only names where a lane may sit: the fence still requires an
 * exact registered worktree of the same Git common directory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import {
  CLAUDE_WORKTREES_RELATIVE_ROOT,
  T3_WORKTREES_RELATIVE_ROOT,
  WORKTREES_ROOT_SUFFIX,
} from "../Worktree.constants.ts";
import { readCloneFleetRepository, readConfiguredFleetRoots } from "./FleetRoots.ts";
import { WorktreeRemovalRoot } from "./RemovalRoots.schemas.ts";
import type * as FileSystem from "effect/FileSystem";
import type { ConfiguredFleetRoots } from "./FleetRoots.schemas.ts";

/**
 * List a clone's removal roots from already-resolved inputs.
 *
 * **Details**
 *
 * The order is managed, nested, T3 (only with a home directory), then each
 * configured fleet root with its `namePrefix`. Paths are resolved, and a root
 * listed twice keeps its first kind.
 *
 * **Example** (A clone with a T3 root)
 *
 * ```ts
 * import { worktreeRemovalRoots } from "@beep/repo-cli/test/Worktree"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Path from "effect/Path"
 *
 * const kinds = Effect.map(Path.Path.asEffect(), (path) =>
 *   A.map(
 *     worktreeRemovalRoots({ path, mainCheckout: "/p/beep-effect", home: O.some("/home/u"), configured: O.none() }),
 *     (root) => root.kind
 *   )
 * )
 * console.log(Effect.runSync(Effect.provide(kinds, Path.layer))) // ["managed", "nested", "t3"]
 * ```
 *
 * @param input - The Path service, the clone that owns the lanes, the home
 *   directory when known, and the repository's configured fleet roots when any.
 * @returns The removal roots, deduplicated by path.
 * @category utilities
 * @since 0.0.0
 */
export const worktreeRemovalRoots = ({
  path,
  mainCheckout,
  home,
  configured,
}: {
  readonly path: Path.Path;
  readonly mainCheckout: string;
  readonly home: O.Option<string>;
  readonly configured: O.Option<ConfiguredFleetRoots>;
}): ReadonlyArray<WorktreeRemovalRoot> => {
  const clone = path.resolve(mainCheckout);
  const cloneName = path.basename(clone);
  const builtIn = [
    WorktreeRemovalRoot.make({
      kind: "managed",
      path: path.join(path.dirname(clone), `${cloneName}${WORKTREES_ROOT_SUFFIX}`),
    }),
    WorktreeRemovalRoot.make({ kind: "nested", path: path.join(clone, CLAUDE_WORKTREES_RELATIVE_ROOT) }),
  ];
  const t3 = pipe(
    home,
    O.filter((value) => path.isAbsolute(value)),
    O.map((value) =>
      WorktreeRemovalRoot.make({
        kind: "t3",
        path: path.join(path.resolve(value), T3_WORKTREES_RELATIVE_ROOT, cloneName),
      })
    ),
    A.fromOption
  );
  const fleet = pipe(
    configured,
    O.map((list) =>
      A.map(list.roots, (entry) =>
        WorktreeRemovalRoot.make({
          kind: "fleet",
          path: path.resolve(entry.path),
          ...(entry.namePrefix === undefined ? {} : { namePrefix: entry.namePrefix }),
        })
      )
    ),
    O.getOrElse(A.empty<WorktreeRemovalRoot>)
  );
  return A.dedupeWith([...builtIn, ...t3, ...fleet], (left, right) => Str.Equivalence(left.path, right.path));
};

// A fleet root with a `namePrefix` admits only children whose name starts with it.
const worktreeRemovalRootAdmits = (root: WorktreeRemovalRoot, name: string): boolean =>
  root.namePrefix === undefined || Str.startsWith(root.namePrefix)(name);

/**
 * The paths a lane name may resolve to, one per admitting root, deduplicated.
 *
 * **Example** (Candidates for one lane)
 *
 * ```ts
 * import { worktreeRemovalCandidates, worktreeRemovalRoots } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Path from "effect/Path"
 *
 * const count = Effect.map(Path.Path.asEffect(), (path) =>
 *   worktreeRemovalCandidates({
 *     path,
 *     roots: worktreeRemovalRoots({ path, mainCheckout: "/p/beep-effect", home: O.some("/home/u"), configured: O.none() }),
 *     name: "lane",
 *   }).length
 * )
 * console.log(Effect.runSync(Effect.provide(count, Path.layer))) // 3
 * ```
 *
 * @param input - The Path service, the clone's removal roots, and the lane's directory name.
 * @returns Each admitting root with the lane path it names.
 * @category utilities
 * @since 0.0.0
 */
export const worktreeRemovalCandidates = ({
  path,
  roots,
  name,
}: {
  readonly path: Path.Path;
  readonly roots: ReadonlyArray<WorktreeRemovalRoot>;
  readonly name: string;
}): ReadonlyArray<{ readonly root: WorktreeRemovalRoot; readonly target: string }> =>
  pipe(
    A.filter(roots, (root) => worktreeRemovalRootAdmits(root, name)),
    A.map((root) => ({ root, target: path.join(root.path, name) })),
    A.dedupeWith((left, right) => Str.Equivalence(left.target, right.target))
  );

/**
 * Resolve a clone's removal roots from the environment and its fleet registry.
 *
 * **Details**
 *
 * `HOME` locates the T3 root. The fleet roots come from `BEEP_FLEET_ROOTS`,
 * then the repository's `roots.json`. Either input failing only drops the
 * roots it would add: a missing or broken registry narrows the fence and
 * never widens it.
 *
 * **Example** (Build the resolution)
 *
 * ```ts
 * import { resolveWorktreeRemovalRoots } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveWorktreeRemovalRoots("/p/beep-effect"))) // true
 * ```
 *
 * @param mainCheckout - The clone that owns the lanes.
 * @returns The clone's removal roots.
 * @category utilities
 * @since 0.0.0
 */
export const resolveWorktreeRemovalRoots = Effect.fn("RemovalRoots.resolve")(function* (
  mainCheckout: string
): Effect.fn.Return<ReadonlyArray<WorktreeRemovalRoot>, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const home = yield* Config.option(Config.String("HOME")).pipe(
    Effect.map(O.filter(Str.isNonEmpty)),
    Effect.orElseSucceed(O.none)
  );
  const repository = yield* readCloneFleetRepository(mainCheckout);
  const configured = yield* readConfiguredFleetRoots(repository).pipe(Effect.orElseSucceed(O.none));
  return worktreeRemovalRoots({ path, mainCheckout, home, configured });
});
