/**
 * Legal position record repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { LegalPositionRecordRepository } from "@beep/law-practice-use-cases/LegalPositionRecord";
import { Layer } from "effect";
import {
  makeInMemoryLegalPositionRecordRepository,
  makeLegalPositionRecordRepository,
} from "./LegalPositionRecord.repo.ts";
import type { PostgresDrizzle } from "@beep/postgres";

/**
 * In-memory legal position record repository layer for database-free proofs.
 *
 * **When to use**
 *
 * Use to compose a reader of the legal position runtime over recorded fixtures
 * when the assertion is about what is read back rather than about durable rows.
 *
 * **Example** (Compose the repository without a database)
 *
 * ```ts
 * import { LegalPositionRecordRepositoryInMemory } from "@beep/law-practice-server/LegalPositionRecord"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(LegalPositionRecordRepositoryInMemory)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LegalPositionRecordRepositoryInMemory: Layer.Layer<LegalPositionRecordRepository> = Layer.effect(
  LegalPositionRecordRepository,
  makeInMemoryLegalPositionRecordRepository()
);

/**
 * Drizzle-backed legal position record repository layer.
 *
 * **Details**
 *
 * The layer requires `PostgresDrizzle` and nothing else; the tables it appends
 * to and reads from are owned by a db-admin migration, so their rows outlive
 * any single runtime that composes this layer.
 *
 * **Gotchas**
 *
 * This layer is deliberately not merged into `LawPracticeServerLive`, following
 * the candor record layers: a durable store is composed by whoever needs it,
 * so that booting the slice's service surface never opens a database
 * connection nobody asked for.
 *
 * **Example** (Read the layer's declared dependency)
 *
 * ```ts
 * import { LegalPositionRecordRepositoryLive } from "@beep/law-practice-server/LegalPositionRecord"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(LegalPositionRecordRepositoryLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LegalPositionRecordRepositoryLive: Layer.Layer<LegalPositionRecordRepository, never, PostgresDrizzle> =
  Layer.effect(LegalPositionRecordRepository, makeLegalPositionRecordRepository());
