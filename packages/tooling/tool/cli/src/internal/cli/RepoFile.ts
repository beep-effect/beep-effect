/**
 * Shared repo-relative file resolution helpers for repo-cli command
 * adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { thunkFalse } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";

const resolveExistingRepoPath = Effect.fn(function* (
  relativePath: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const exists = yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(thunkFalse));
  return exists ? O.some(absolutePath) : O.none();
});

/**
 * Read a repo-relative file's contents, resolved against the current
 * working directory.
 *
 * @param relativePath - Repo-relative path to resolve and read.
 * @returns `O.some(content)` when the resolved file exists, `O.none` otherwise.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { readExistingRepoFile } from "@beep/repo-cli/internal/cli/RepoFile"
 *
 * const program = readExistingRepoFile("package.json")
 *
 * console.log(Effect.isEffect(program))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const readExistingRepoFile = Effect.fn("RepoCli.RepoFile.readExistingRepoFile")(function* (
  relativePath: string
) {
  const absolutePath = yield* resolveExistingRepoPath(relativePath);
  if (O.isNone(absolutePath)) {
    return O.none<string>();
  }

  const fs = yield* FileSystem.FileSystem;
  return O.some(yield* fs.readFileString(absolutePath.value));
});
