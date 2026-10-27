/**
 * Byte-preserving `package.json` field updaters over `@beep/package-json`'s
 * `PackageJsonFormat.modifyToString`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { PackageJsonFormat } from "@beep/package-json/PackageJsonFormat";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import { VersionSyncError } from "../../VersionSync.schemas.ts";

type UpdateCatalogEntryOptions = {
  readonly versionSpecifier: string;
};

// One read, one surgical edit, and a write only when the bytes changed; every
// byte outside the edited value survives (key order, indentation, line endings).
const updateField = Effect.fn("PackageJsonUpdater.updateField")(function* (
  filePath: string,
  fieldPath: ReadonlyArray<string>,
  value: string
): Effect.fn.Return<boolean, VersionSyncError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;

  const original = yield* fs
    .readFileString(filePath)
    .pipe(VersionSyncError.mapError(`Failed to read ${filePath}`, filePath));

  const updated = yield* PackageJsonFormat.modifyToString(original, fieldPath, value).pipe(
    VersionSyncError.mapError(`Failed to update ${filePath}`, filePath)
  );

  if (updated === original) {
    return false;
  }

  yield* fs.writeFileString(filePath, updated).pipe(VersionSyncError.mapError(`Failed to write ${filePath}`, filePath));

  return true;
});

/**
 * Update the `packageManager` field in `package.json`.
 *
 * Byte-preserving: only the field value changes. Returns `true` when the file
 * was modified, `false` when already correct.
 *
 * @category utilities
 * @since 0.0.0
 */
export const updatePackageManagerField: {
  (filePath: string, version: string): Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
  (version: string): (filePath: string) => Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
} = dual(2, (filePath: string, version: string) => updateField(filePath, ["packageManager"], `bun@${version}`));

/**
 * Update a root package.json `catalog` entry.
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
} = dual(3, (filePath: string, dependencyName: string, options: UpdateCatalogEntryOptions) =>
  updateField(filePath, ["catalog", dependencyName], options.versionSpecifier)
);
