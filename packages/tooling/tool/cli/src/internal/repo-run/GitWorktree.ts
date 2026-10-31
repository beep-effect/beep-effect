/**
 * Shared linked-worktree probes and teardown for repository-run internals.
 *
 * Both the Yeet merged-preview lifecycle and the residue janitor tear down
 * detached preview worktrees. The teardown lives here so internal code never
 * imports from a command module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { runRepoCommandCapture } from "./RepoRun.executor.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const resolvedPath = Effect.fnUntraced(function* (
  candidate: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return O.getOrElse(yield* fs.realPath(candidate).pipe(Effect.option), () => path.resolve(candidate));
});

/**
 * Probe whether a directory is a linked worktree registered with a repository.
 *
 * **Details**
 *
 * Reads the worktree list through `@beep/git`'s `Git.worktreeList` from
 * `repoRoot` and compares every listed path with `worktreePath` after
 * resolving both through `realPath`, so a symlinked checkout still matches. A
 * listing that fails for any reason (spawn failure, non-zero exit, not a
 * repository) is `None`: callers must treat an unknown registration as a
 * reason to keep the directory rather than as "not registered".
 *
 * **Example** (Probe a preview worktree)
 *
 * ```ts
 * import { isRegisteredWorktree } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const probe = isRegisteredWorktree("/repo", "/repo/.beep/yeet/merged-preview-1234")
 * console.log(Effect.isEffect(probe)) // true
 * ```
 *
 * @param repoRoot - Checkout whose worktree list is read.
 * @param worktreePath - Directory to look for in that list.
 * @returns `Some(true)` when listed, `Some(false)` when absent, `None` when the probe failed.
 * @category probes
 * @since 0.0.0
 */
export const isRegisteredWorktree = Effect.fn("GitWorktree.isRegisteredWorktree")(
  function* (
    repoRoot: string,
    worktreePath: string
  ): Effect.fn.Return<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path | Git> {
    const git = yield* Git;
    const entries = yield* git.worktreeList(repoRoot).pipe(Effect.option);
    if (O.isNone(entries)) {
      return O.none();
    }
    const target = yield* resolvedPath(worktreePath);
    const listed = yield* Effect.forEach(entries.value, (entry) => resolvedPath(entry.path));
    return O.some(A.contains(listed, target));
  },
  Effect.provideServiceEffect(Git, Git.make)
);

/**
 * Remove a linked worktree with `git worktree remove --force`, then prune.
 *
 * **Details**
 *
 * `--force` is the designed teardown for synthetic preview worktrees: their
 * commit exists only to be checked out, so local changes inside them are never
 * work to preserve. The removal goes through `@beep/git`'s `Git.worktreeRemove`,
 * which refuses an option-like path before spawning. `worktree prune` always
 * runs afterwards so a registration whose directory already vanished is
 * dropped too; it stays a single repo-run capture because `Git` has no prune
 * member. Every failure, spawn failures included, is absorbed.
 *
 * **Example** (Tear down a preview worktree)
 *
 * ```ts
 * import { removeGitWorktree } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const removal = removeGitWorktree("/repo", "/repo/.beep/yeet/merged-preview-1234")
 * console.log(Effect.isEffect(removal)) // true
 * ```
 *
 * @param repoRoot - Checkout that owns the worktree registration.
 * @param worktreePath - Linked worktree directory to remove.
 * @returns Whether `git worktree remove --force` exited 0.
 * @category mutations
 * @since 0.0.0
 */
export const removeGitWorktree = Effect.fn("GitWorktree.removeGitWorktree")(
  function* (
    repoRoot: string,
    worktreePath: string
  ): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner | Git | SecureRandom.SecureRandom> {
    const git = yield* Git;
    const removed = yield* git.worktreeRemove(repoRoot, worktreePath, { force: true }).pipe(Effect.isSuccess);
    yield* runRepoCommandCapture("git", ["worktree", "prune"], repoRoot).pipe(Effect.ignore);
    return removed;
  },
  Effect.provideServiceEffect(Git, Git.make)
);
