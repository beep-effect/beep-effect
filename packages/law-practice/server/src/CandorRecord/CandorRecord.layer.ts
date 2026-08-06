/**
 * Candor record repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { CandorRecordRepository } from "@beep/law-practice-use-cases/CandorRecord";
import { Layer } from "effect";
import { makeCandorRecordRepository, makeInMemoryCandorRecordRepository } from "./CandorRecord.repo.ts";
import type { PostgresDrizzle } from "@beep/postgres";

/**
 * In-memory candor record repository layer for database-free proofs.
 *
 * **When to use**
 *
 * Use to compose the candor gate over recorded fixtures when the assertion is
 * about what the gate concludes rather than about durable rows.
 *
 * **Example** (Compose the gate's read seam without a database)
 *
 * ```ts
 * import { CandorRecordRepositoryInMemory } from "@beep/law-practice-server/CandorRecord"
 * import { CandorRecordReaderFromRepository } from "@beep/law-practice-use-cases/CandorRecord"
 * import { Layer } from "effect"
 *
 * const reader = CandorRecordReaderFromRepository.pipe(Layer.provide(CandorRecordRepositoryInMemory))
 * console.log(Layer.isLayer(reader)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CandorRecordRepositoryInMemory: Layer.Layer<CandorRecordRepository> = Layer.effect(
  CandorRecordRepository,
  makeInMemoryCandorRecordRepository()
);

/**
 * Drizzle-backed candor record repository layer.
 *
 * **Details**
 *
 * The layer requires `PostgresDrizzle` and nothing else; the tables it appends
 * to and reads from are owned by a db-admin migration, so their rows outlive
 * any single runtime that composes this layer.
 *
 * **Example** (Read the layer's declared dependency)
 *
 * ```ts
 * import { CandorRecordRepositoryLive } from "@beep/law-practice-server/CandorRecord"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(CandorRecordRepositoryLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CandorRecordRepositoryLive: Layer.Layer<CandorRecordRepository, never, PostgresDrizzle> = Layer.effect(
  CandorRecordRepository,
  makeCandorRecordRepository()
);
