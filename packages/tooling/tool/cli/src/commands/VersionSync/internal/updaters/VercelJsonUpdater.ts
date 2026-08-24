/**
 * Vercel Bun command updater.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Str } from "@beep/utils";
import { Effect, FileSystem, Match } from "effect";
import { dual } from "effect/Function";
import { applyJsoncModification } from "../../../../internal/cli/Jsonc.ts";
import { VersionSyncError } from "../../VersionSync.schemas.ts";
import { BunVercelDocument } from "../resolvers/BunResolver.ts";

/**
 * Vercel command fields whose explicit Bun pins are managed by version-sync.
 *
 * @category models
 * @since 0.0.0
 */
export type VercelBunCommandField = "installCommand" | "buildCommand";

/**
 * Update one explicit Bun pin in a Vercel command field.
 *
 * @category utilities
 * @since 0.0.0
 */
export const updateVercelBunVersion: {
  (
    filePath: string,
    field: VercelBunCommandField,
    version: string
  ): Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
  (
    field: VercelBunCommandField,
    version: string
  ): (filePath: string) => Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
} = dual(
  3,
  Effect.fn(function* (filePath: string, field: VercelBunCommandField, version: string) {
    const fs = yield* FileSystem.FileSystem;
    const original = yield* fs
      .readFileString(filePath)
      .pipe(VersionSyncError.mapError(`Failed to read ${filePath}`, filePath));
    const document = yield* decodeJsoncTextAs(BunVercelDocument)(original).pipe(
      VersionSyncError.mapError(`Failed to parse ${filePath}`, filePath)
    );
    const command = Match.value(field).pipe(
      Match.when("installCommand", () => document.installCommand),
      Match.when("buildCommand", () => document.buildCommand),
      Match.exhaustive
    );
    const updatedCommand = Str.replace(/\bbun@[^\s]+/g, `bun@${version}`)(command);
    const updated = applyJsoncModification({ content: original, path: [field], value: updatedCommand });

    if (updated === original) {
      return false;
    }

    yield* fs
      .writeFileString(filePath, updated)
      .pipe(VersionSyncError.mapError(`Failed to write ${filePath}`, filePath));
    return true;
  })
);
