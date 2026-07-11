/**
 * SyncConflict repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { SyncConflictRepository } from "@beep/documents-use-cases/entities/SyncConflict/server";
import { Layer } from "effect";
import { makeDrizzleSyncConflictRepository, makeInMemorySyncConflictRepository } from "./SyncConflict.repo.js";

/**
 * In-memory SyncConflict repository layer for deterministic sync tests.
 *
 * @example
 * ```ts
 * import { SyncConflictRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncConflict"
 *
 * console.log(SyncConflictRepositoryInMemoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SyncConflictRepositoryInMemoryLayer = Layer.effect(
  SyncConflictRepository,
  makeInMemorySyncConflictRepository()
);

/**
 * Drizzle-backed SyncConflict repository layer; requires `PostgresDrizzle`.
 *
 * @example
 * ```ts
 * import { SyncConflictRepositoryDrizzleLayer } from "@beep/documents-server/entities/SyncConflict"
 *
 * console.log(SyncConflictRepositoryDrizzleLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SyncConflictRepositoryDrizzleLayer = Layer.effect(
  SyncConflictRepository,
  makeDrizzleSyncConflictRepository()
);
