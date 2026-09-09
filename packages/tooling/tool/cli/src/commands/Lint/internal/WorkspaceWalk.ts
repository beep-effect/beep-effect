/**
 * Workspace directory walks shared by the Lint commands.
 *
 * **Details**
 * The package test-typecheck lint and the check-overlay lint enumerate the
 * same workspace trees (`apps`, `infra`, `packages`) and must prune the same
 * build and vendor directories, or the two gates would judge different file
 * sets. The filesystem probes, the pruned child listing, and the depth-first
 * collector live here once so each lint states only what a directory owns.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, HashSet, Path } from "effect";
import { dual } from "effect/Function";

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
 * Whether `filePath` exists, treating an unreadable path as absent.
 *
 * **Example** (Probe a path)
 *
 * ```ts
 * import { exists } from "@beep/repo-cli/commands/Lint/internal/WorkspaceWalk"
 * import * as Effect from "effect/Effect"
 * import * as FileSystem from "effect/FileSystem"
 *
 * const program = Effect.flatMap(FileSystem.FileSystem, (fs) => exists(fs, "/repo/package.json"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param fs - File system service to probe with.
 * @param filePath - Absolute path to test.
 * @returns `true` only when the path is present and readable.
 * @category utils
 * @since 0.0.0
 */
export const exists: {
  (filePath: string): (fs: FileSystem.FileSystem) => Effect.Effect<boolean>;
  (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<boolean>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<boolean> =>
    fs.exists(filePath).pipe(Effect.orElseSucceed(thunkFalse))
);

/**
 * Classify a path as `File`, `Directory`, or none when it is missing or
 * unreadable.
 *
 * **Details**
 * Every tree walk classifies through this so none repeats the stat-and-unwrap
 * dance, and a vanished entry mid-walk reads as absent rather than failing.
 *
 * **Example** (Classify a path)
 *
 * ```ts
 * import { pathTypeOf } from "@beep/repo-cli/commands/Lint/internal/WorkspaceWalk"
 * import * as Effect from "effect/Effect"
 * import * as FileSystem from "effect/FileSystem"
 *
 * const program = Effect.flatMap(FileSystem.FileSystem, (fs) => pathTypeOf(fs, "/repo/packages"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param fs - File system service to stat with.
 * @param currentPath - Absolute path to classify.
 * @returns The entry type, or none when the path cannot be stat'ed.
 * @category utils
 * @since 0.0.0
 */
export const pathTypeOf: {
  (currentPath: string): (fs: FileSystem.FileSystem) => Effect.Effect<O.Option<FileSystem.File.Type>>;
  (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<O.Option<FileSystem.File.Type>>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<O.Option<FileSystem.File.Type>> =>
    fs.stat(currentPath).pipe(Effect.option, Effect.map(O.map((info) => info.type)))
);

/**
 * Whether `currentPath` is a readable directory.
 *
 * **Example** (Probe a directory)
 *
 * ```ts
 * import { isDirectoryPath } from "@beep/repo-cli/commands/Lint/internal/WorkspaceWalk"
 * import * as Effect from "effect/Effect"
 * import * as FileSystem from "effect/FileSystem"
 *
 * const program = Effect.flatMap(FileSystem.FileSystem, (fs) => isDirectoryPath(fs, "/repo/packages"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param fs - File system service to stat with.
 * @param currentPath - Absolute path to test.
 * @returns `true` only for a directory the walk may enter.
 * @category utils
 * @since 0.0.0
 */
export const isDirectoryPath: {
  (currentPath: string): (fs: FileSystem.FileSystem) => Effect.Effect<boolean>;
  (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<boolean>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<boolean> =>
    pathTypeOf(fs, currentPath).pipe(
      Effect.map(O.match({ onNone: thunkFalse, onSome: (type) => type === "Directory" }))
    )
);

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
