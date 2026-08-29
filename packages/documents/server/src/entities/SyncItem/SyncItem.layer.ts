/**
 * SyncItem repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { SyncItemRepository } from "@beep/documents-use-cases/entities/SyncItem/server";
import { Layer } from "effect";
import { makeDrizzleSyncItemRepository, makeInMemorySyncItemRepository } from "./SyncItem.repo.ts";

/**
 * In-memory SyncItem repository layer for deterministic sync tests.
 *
 * **Example** (Import in-memory SyncItem layer)
 *
 * ```ts
 * import { SyncItemRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncItem"
 *
 * console.log(SyncItemRepositoryInMemoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SyncItemRepositoryInMemoryLayer = Layer.effect(SyncItemRepository, makeInMemorySyncItemRepository());

/**
 * Drizzle-backed SyncItem repository layer; requires `PostgresDrizzle`.
 *
 * **Example** (Import Drizzle SyncItem layer)
 *
 * ```ts
 * import { SyncItemRepositoryDrizzleLayer } from "@beep/documents-server/entities/SyncItem"
 *
 * console.log(SyncItemRepositoryDrizzleLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SyncItemRepositoryDrizzleLayer = Layer.effect(SyncItemRepository, makeDrizzleSyncItemRepository());
