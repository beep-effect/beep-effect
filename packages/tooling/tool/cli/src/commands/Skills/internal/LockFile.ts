/**
 * Reading `skills-lock.json` from a repository root.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { SkillsCommandError } from "../Skills.errors.ts";

/**
 * Repo-relative path of the skills lock.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const SKILLS_LOCK_PATH = "skills-lock.json";

/**
 * Reads the lock's text, failing typed when it cannot be read.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readSkillsLockText = Effect.fn("SkillsLock.readSkillsLockText")(function* (
  repoRoot: string
): Effect.fn.Return<
  { readonly lockPath: string; readonly text: string },
  SkillsCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lockPath = path.join(repoRoot, SKILLS_LOCK_PATH);
  const text = yield* fs
    .readFileString(lockPath)
    .pipe(SkillsCommandError.mapError(`Failed to read ${SKILLS_LOCK_PATH}.`, lockPath));
  return { lockPath, text };
});
