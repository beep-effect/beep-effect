/**
 * Shared filesystem walk helpers for discovering AI metrics transcript sources.
 *
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";

/**
 * Stat a path, returning `O.none` when the path is missing or unreadable.
 *
 * @category utilities
 * @since 0.0.0
 */
export const statOption = Effect.fn("AiMetrics.statOption")(function* (pathName: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stat(pathName).pipe(Effect.option);
});

const collectFilesEndingWith = Effect.fn("AiMetrics.collectFilesEndingWith")(function* (
  root: string,
  suffix: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const info = yield* statOption(root);

  if (O.isNone(info) || info.value.type !== "Directory") {
    return A.empty<string>();
  }

  const walk = Effect.fnUntraced(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const currentInfo = yield* statOption(currentPath);
    if (O.isNone(currentInfo)) {
      return A.empty<string>();
    }

    if (currentInfo.value.type === "File") {
      return Str.endsWith(suffix)(currentPath) ? A.of(currentPath) : A.empty<string>();
    }

    if (currentInfo.value.type !== "Directory") {
      return A.empty<string>();
    }

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));
    return A.flatten(yield* Effect.forEach(entries, (entry) => walk(pathApi.join(currentPath, entry))));
  });

  return yield* walk(root);
});

/**
 * Recursively collect every `.jsonl` file beneath a root directory.
 *
 * Returns an empty array when the root is missing or is not a directory, and
 * skips entries that cannot be read rather than failing the walk.
 *
 * @category utilities
 * @since 0.0.0
 */
export const collectJsonlFiles = (root: string) => collectFilesEndingWith(root, ".jsonl");

/**
 * Recursively collect every `.ndjson` file beneath a root directory.
 *
 * Returns an empty array when the root is missing or is not a directory, and
 * skips entries that cannot be read rather than failing the walk.
 *
 * @category utilities
 * @since 0.0.0
 */
export const collectNdjsonFiles = (root: string) => collectFilesEndingWith(root, ".ndjson");
