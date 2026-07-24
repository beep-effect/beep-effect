/**
 * Comment-preserving `package.json` `packageManager` updater via `jsonc-parser`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, FileSystem } from "effect";
import { dual } from "effect/Function";
import { applyJsoncModification } from "../../../../internal/cli/Jsonc.ts";
import { VersionSyncError } from "../../VersionSync.schemas.ts";

type UpdateCatalogEntryOptions = {
  readonly versionSpecifier: string;
};

/**
 * Update the `packageManager` field in `package.json` using `jsonc-parser`.
 *
 * Comment-preserving: uses `modify()` + `applyEdits()` pattern.
 * Returns `true` when the file was modified, `false` when already correct.
 *
 * @category utilities
 * @since 0.0.0
 */
export const updatePackageManagerField: {
  (filePath: string, version: string): Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
  (version: string): (filePath: string) => Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
} = dual(
  2,
  Effect.fn(function* (filePath: string, version: string) {
    const fs = yield* FileSystem.FileSystem;

    const original = yield* fs
      .readFileString(filePath)
      .pipe(VersionSyncError.mapError(`Failed to read ${filePath}`, filePath));

    const newValue = `bun@${version}`;

    const updated = applyJsoncModification({ content: original, path: ["packageManager"], value: newValue });

    if (updated === original) {
      return false;
    }

    yield* fs
      .writeFileString(filePath, updated)
      .pipe(VersionSyncError.mapError(`Failed to write ${filePath}`, filePath));

    return true;
  })
);

/**
 * Update a root package.json `catalog` entry using `jsonc-parser`.
 *
 * Returns `true` when the file was modified, `false` when already correct.
 *
 * @category utilities
 * @since 0.0.0
 */
export const updateCatalogEntry: {
  (
    filePath: string,
    dependencyName: string,
    options: UpdateCatalogEntryOptions
  ): Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
  (
    dependencyName: string,
    options: UpdateCatalogEntryOptions
  ): (filePath: string) => Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
} = dual(
  3,
  Effect.fn(function* (filePath: string, dependencyName: string, options: UpdateCatalogEntryOptions) {
    const fs = yield* FileSystem.FileSystem;

    const original = yield* fs
      .readFileString(filePath)
      .pipe(VersionSyncError.mapError(`Failed to read ${filePath}`, filePath));

    const updated = applyJsoncModification({
      content: original,
      path: ["catalog", dependencyName],
      value: options.versionSpecifier,
    });

    if (updated === original) {
      return false;
    }

    yield* fs
      .writeFileString(filePath, updated)
      .pipe(VersionSyncError.mapError(`Failed to write ${filePath}`, filePath));

    return true;
  })
);
