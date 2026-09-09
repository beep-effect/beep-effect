/**
 * Workspace directory walks shared by the Lint commands.
 *
 * **Details**
 * The package test-typecheck lint and the check-overlay lint enumerate the
 * same workspace trees (`apps`, `infra`, `packages`) and must prune the same
 * build and vendor directories, or the two gates would judge different file
 * sets. The pruned child listing and the depth-first collector live here once
 * so each lint states only what a directory owns; the filesystem probes they
 * share come from `internal/quality/TestTypecheckCoverage`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, pipe } from "@beep/utils";
import { Effect, FileSystem, HashSet, Path } from "effect";
import { isDirectoryPath } from "../../../internal/quality/TestTypecheckCoverage.ts";

/**
 * Directory names no workspace walk descends into.
 *
 * **Details**
 * Build outputs, vendored dependencies, coverage, and Turbo caches never hold
 * workspace-owned sources. Pruning them here keeps every Lint walk in
 * agreement with the repo-wide `beep quality test-tsgo` lane.
 *
 * **Example** (Check a pruned directory name)
 *
 * ```ts
 * import { ignoredDirectoryNames } from "@beep/repo-cli/commands/Lint/internal/WorkspaceWalk"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(HashSet.has(ignoredDirectoryNames, "node_modules")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ignoredDirectoryNames: HashSet.HashSet<string> = HashSet.fromIterable([
  "node_modules",
  "dist",
  "dist-test",
  "coverage",
  "tmp",
  ".turbo",
]);

/**
 * Path segment that marks a fixture tree no walk may report.
 *
 * **Details**
 * Fixture trees hold deliberately broken packages and configs for the lints'
 * own tests; a walk that reported them would fail the gate on its evidence.
 *
 * **Example** (Recognise a fixture path)
 *
 * ```ts
 * import { testFixtureSegment } from "@beep/repo-cli/commands/Lint/internal/WorkspaceWalk"
 * import * as String from "effect/String"
 *
 * console.log(String.includes(testFixtureSegment)("/repo/pkg/test/fixtures/broken/")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const testFixtureSegment = "/test/fixtures/";

/**
 * Child paths of a directory worth descending into.
 *
 * **Details**
 * Entries named in {@link ignoredDirectoryNames} are pruned and an unreadable
 * directory lists as empty, so every walk agrees on traversal scope without
 * repeating the ignore rule.
 *
 * **Example** (List walkable children)
 *
 * ```ts
 * import { walkableChildPaths } from "@beep/repo-cli/commands/Lint/internal/WorkspaceWalk"
 * import * as Effect from "effect/Effect"
 *
 * const program = walkableChildPaths("/repo/packages")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param currentPath - Absolute directory to list.
 * @returns Absolute child paths in `readDirectory` order, ignored names removed.
 * @category utils
 * @since 0.0.0
 */
export const walkableChildPaths = Effect.fn("WorkspaceWalk.walkableChildPaths")(function* (
  currentPath: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));

  return pipe(
    entries,
    A.filter((entry) => !HashSet.has(ignoredDirectoryNames, entry)),
    A.map((entry) => path.join(currentPath, entry))
  );
});

/**
 * Walk `searchRoot` depth-first and collect what each directory owns.
 *
 * **Details**
 * `ownedIn` is asked once per directory reached and answers the paths that
 * directory contributes: a manifest-bearing package directory, an overlay
 * file, or nothing. A directory's own paths precede its children's, children
 * follow {@link walkableChildPaths} order, and a missing or non-directory
 * root yields an empty array rather than failing.
 *
 * **Example** (Collect every directory under a root)
 *
 * ```ts
 * import { collectOwnedPaths } from "@beep/repo-cli/commands/Lint/internal/WorkspaceWalk"
 * import * as Effect from "effect/Effect"
 *
 * const program = collectOwnedPaths("/repo/packages", (directory) => Effect.succeed([directory]))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param searchRoot - Absolute directory to walk; anything else yields no paths.
 * @param ownedIn - Paths a reached directory contributes to the result.
 * @returns Owned paths in depth-first directory order.
 * @category use-cases
 * @since 0.0.0
 */
export const collectOwnedPaths = Effect.fn("WorkspaceWalk.collectOwnedPaths")(function* (
  searchRoot: string,
  ownedIn: (directory: string) => Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path>
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;

  const walk = Effect.fn("WorkspaceWalk.collectOwnedPaths.walk")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    if (!(yield* isDirectoryPath(fs, currentPath))) {
      return A.empty<string>();
    }
    const own = yield* ownedIn(currentPath);
    const children = yield* walkableChildPaths(currentPath);
    const nested = yield* Effect.forEach(children, walk, { concurrency: 1 });

    return A.appendAll(own, A.flatten(nested));
  });

  return yield* walk(searchRoot);
});
