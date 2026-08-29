/**
 * SyncOperation repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { SyncOperationRepository } from "@beep/documents-use-cases/entities/SyncOperation/server";
import { Layer } from "effect";
import { makeDrizzleSyncOperationRepository, makeInMemorySyncOperationRepository } from "./SyncOperation.repo.ts";

/**
 * In-memory SyncOperation repository layer for deterministic sync tests.
 *
 * **Example** (In-memory layer import)
 *
 * ```ts
 * import { SyncOperationRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncOperation"
 *
 * console.log(SyncOperationRepositoryInMemoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SyncOperationRepositoryInMemoryLayer = Layer.effect(
  SyncOperationRepository,
  makeInMemorySyncOperationRepository()
);

/**
 * Drizzle-backed SyncOperation repository layer; requires `PostgresDrizzle`.
 *
 * **Example** (Drizzle layer import)
 *
 * ```ts
 * import { SyncOperationRepositoryDrizzleLayer } from "@beep/documents-server/entities/SyncOperation"
 *
 * console.log(SyncOperationRepositoryDrizzleLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SyncOperationRepositoryDrizzleLayer = Layer.effect(
  SyncOperationRepository,
  makeDrizzleSyncOperationRepository()
);
