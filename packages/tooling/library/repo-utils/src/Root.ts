/**
 * Repository root discovery.
 *
 * Walks upward from a starting directory looking for repository markers
 * (`.git` directory or `bun.lock` file) to locate the monorepo root.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, Str, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, pipe } from "effect";
import * as O from "effect/Option";
import { NoSuchFileError } from "./errors/index.ts";

/**
 * Markers that indicate a repository root directory.
 *
 * @category configuration
 * @since 0.0.0
 */
const ROOT_MARKERS: ReadonlyArray<string> = [".git", "bun.lock"];

/**
 * Find the repository root by walking upward from the given directory
 * (or the current working directory) until a root marker is found.
 *
 * **Details**
 *
 * Root markers are `.git` (directory) and `bun.lock` (file).
 *
 * **Example** (Find root from cwd)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { findRepoRoot } from "@beep/repo-utils/Root"
 *
 * const program = findRepoRoot()
 * console.log(program)
 * ```
 *
 * @param startFrom - Optional starting directory. Defaults to `process.cwd()`.
 * @returns An Effect that succeeds with the absolute path of the repo root.
 * @category utilities
 * @since 0.0.0
 */
export const findRepoRoot: (
  startFrom?: undefined | string
) => Effect.Effect<string, NoSuchFileError, FileSystem.FileSystem> = Effect.fn(function* (startFrom) {
  const fs = yield* FileSystem.FileSystem;
  const start = startFrom ?? process.cwd();

  let current = start;

  while (true) {
    for (const marker of ROOT_MARKERS) {
      const markerPath = Str.endsWith("/")(current) ? current + marker : `${current}/${marker}`;
      const exists = yield* fs.exists(markerPath).pipe(Effect.orElseSucceed(thunkFalse));
      if (exists) {
        return current;
      }
    }

    // Move to parent directory
    const parent = parentDir(current);
    if (parent === current) {
      // Reached filesystem root without finding a marker
      return yield* NoSuchFileError.make({
        path: start,
        message: `Could not find repository root (looked for ${A.join(", ")(ROOT_MARKERS)}) starting from "${start}"`,
      });
    }
    current = parent;
  }
});

/**
 * Get the parent directory of a path (pure string operation).
 *
 * @param p - Absolute or relative path string.
 * @returns Parent directory path.
 */
const parentDir = (p: string): string =>
  pipe(
    Str.lastIndexOf("/")(p),
    O.map((lastSlash) => (lastSlash === 0 ? "/" : Str.substring(0, lastSlash)(p))),
    O.getOrElse(() => "/")
  );
