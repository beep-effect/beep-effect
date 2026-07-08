/**
 * Plain text file updater for `.bun-version` and similar single-value files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";
import { Effect, FileSystem } from "effect";
import { dual } from "effect/Function";
import { VersionSyncError } from "../../VersionSync.schemas.js";

/**
 * Update a plain text version file (e.g. `.bun-version`).
 *
 * Returns `true` when the file was modified, `false` when already correct.
 *
 * @category utilities
 * @since 0.0.0
 */
export const updatePlainTextFile: {
  (filePath: string, version: string): Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
  (version: string): (filePath: string) => Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
} = dual(
  2,
  Effect.fn(function* (filePath: string, version: string) {
    const fs = yield* FileSystem.FileSystem;

    const original = yield* fs
      .readFileString(filePath)
      .pipe(VersionSyncError.mapError(`Failed to read ${filePath}`, filePath));

    const currentValue = Str.trim(original);
    if (currentValue === version) {
      return false;
    }

    yield* fs
      .writeFileString(filePath, `${version}\n`)
      .pipe(VersionSyncError.mapError(`Failed to write ${filePath}`, filePath));

    return true;
  })
);
