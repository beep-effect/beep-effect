/**
 * SyncCursor repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { SyncCursorRepository } from "@beep/documents-use-cases/entities/SyncCursor/server";
import { Layer } from "effect";
import { makeDrizzleSyncCursorRepository, makeInMemorySyncCursorRepository } from "./SyncCursor.repo.ts";

/**
 * In-memory SyncCursor repository layer for deterministic sync tests.
 *
 * **Example** (Import in-memory repository layer)
 *
 * ```ts
 * import { SyncCursorRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncCursor"
 *
 * console.log(SyncCursorRepositoryInMemoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SyncCursorRepositoryInMemoryLayer = Layer.effect(SyncCursorRepository, makeInMemorySyncCursorRepository());

/**
 * Drizzle-backed SyncCursor repository layer; requires `PostgresDrizzle`.
 *
 * **Example** (Import Drizzle repository layer)
 *
 * ```ts
 * import { SyncCursorRepositoryDrizzleLayer } from "@beep/documents-server/entities/SyncCursor"
 *
 * console.log(SyncCursorRepositoryDrizzleLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SyncCursorRepositoryDrizzleLayer = Layer.effect(SyncCursorRepository, makeDrizzleSyncCursorRepository());
