/**
 * Shared `$schema` URL updater for JSON/JSONC configuration files.
 *
 * Biome (`biome.jsonc`) and Turborepo (`turbo.json`) both pin a versioned
 * `$schema` URL; this updater rewrites that one key while preserving comments
 * and unrelated formatting.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";
import { Effect, FileSystem } from "effect";
import { applyJsoncModification } from "../../../../internal/cli/Jsonc.ts";
import { VersionSyncError } from "../../VersionSync.schemas.ts";

/**
 * Rewrite the top-level `$schema` key of a JSON/JSONC file.
 *
 * **Example** (Point a config at a new schema URL)
 *
 * ```ts
 * import { updateJsoncSchemaUrl } from "@beep/repo-cli/commands/VersionSync/internal/updaters/JsoncSchemaUpdater"
 * import { Effect } from "effect"
 *
 * const program = updateJsoncSchemaUrl("/repo/turbo.json", "https://v2-10-13.turborepo.dev/schema.json")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param filePath - Absolute path of the configuration file.
 * @param schemaUrl - The `$schema` URL to write.
 * @returns Whether the file content changed.
 * @category utilities
 * @since 0.0.0
 */
export const updateJsoncSchemaUrl = Effect.fn("updateJsoncSchemaUrl")(function* (
  filePath: string,
  schemaUrl: string
): Effect.fn.Return<boolean, VersionSyncError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;

  const original = yield* fs
    .readFileString(filePath)
    .pipe(VersionSyncError.mapError(`Failed to read ${filePath}`, filePath));

  const updated = applyJsoncModification({ content: original, path: ["$schema"], value: schemaUrl });

  if (Str.equivalence(updated, original)) {
    return false;
  }

  yield* fs.writeFileString(filePath, updated).pipe(VersionSyncError.mapError(`Failed to write ${filePath}`, filePath));

  return true;
});
