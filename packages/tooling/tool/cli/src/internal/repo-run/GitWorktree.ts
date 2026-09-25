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

import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { runRepoCommandCapture, runRepoCommandCaptureRaw } from "./RepoRun.executor.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";

const WORKTREE_RECORD_PREFIX = "worktree ";

const worktreeRecordPath = (record: string): O.Option<string> =>
  Str.startsWith(WORKTREE_RECORD_PREFIX)(record)
    ? O.some(Str.slice(Str.length(WORKTREE_RECORD_PREFIX))(record))
    : O.none();

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
 * Reads `git worktree list --porcelain -z` from `repoRoot` and compares every
 * listed path with `worktreePath` after resolving both through `realPath`, so a
 * symlinked checkout still matches. A failed, non-zero, or truncated listing is
 * `None`: callers must treat an unknown registration as a reason to keep the
 * directory rather than as "not registered".
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
export const isRegisteredWorktree = Effect.fn("GitWorktree.isRegisteredWorktree")(function* (
  repoRoot: string,
  worktreePath: string
): Effect.fn.Return<
  O.Option<boolean>,
  never,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const capture = yield* runRepoCommandCaptureRaw("git", ["worktree", "list", "--porcelain", "-z"], repoRoot).pipe(
    Effect.option
  );
  if (O.isNone(capture) || capture.value.exitCode !== 0 || capture.value.truncated) {
    return O.none();
  }
  const target = yield* resolvedPath(worktreePath);
  const listed = yield* Effect.forEach(
    A.getSomes(A.map(Str.split(capture.value.output, "\0"), worktreeRecordPath)),
    resolvedPath
  );
  return O.some(A.contains(listed, target));
});

/**
 * Remove a linked worktree with `git worktree remove --force`, then prune.
 *
 * **Details**
 *
 * `--force` is the designed teardown for synthetic preview worktrees: their
 * commit exists only to be checked out, so local changes inside them are never
 * work to preserve. `worktree prune` always runs afterwards so a registration
 * whose directory already vanished is dropped too. Spawn failures are absorbed.
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
export const removeGitWorktree = Effect.fn("GitWorktree.removeGitWorktree")(function* (
  repoRoot: string,
  worktreePath: string
): Effect.fn.Return<boolean, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const removed = yield* runRepoCommandCapture("git", ["worktree", "remove", "--force", worktreePath], repoRoot).pipe(
    Effect.option
  );
  yield* runRepoCommandCapture("git", ["worktree", "prune"], repoRoot).pipe(Effect.ignore);
  return O.exists(removed, (capture) => capture.exitCode === 0);
});
