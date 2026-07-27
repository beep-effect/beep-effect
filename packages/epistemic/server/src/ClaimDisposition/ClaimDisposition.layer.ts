/**
 * Claim disposition repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { ClaimDispositionRepository } from "@beep/epistemic-use-cases/ClaimDisposition";
import { Layer } from "effect";
import {
  makeDrizzleClaimDispositionRepository,
  makeInMemoryClaimDispositionRepository,
} from "./ClaimDisposition.repo.ts";
import type { PostgresDrizzle } from "@beep/postgres";

/**
 * In-memory claim disposition repository layer for docker-free proofs.
 *
 * @example
 * ```ts
 * import { ClaimDispositionRepositoryInMemory } from "@beep/epistemic-server/ClaimDisposition"
 *
 * console.log(ClaimDispositionRepositoryInMemory)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimDispositionRepositoryInMemory: Layer.Layer<ClaimDispositionRepository> = Layer.effect(
  ClaimDispositionRepository,
  makeInMemoryClaimDispositionRepository()
);

/**
 * Drizzle-backed claim disposition repository layer.
 *
 * @example
 * ```ts
 * import { ClaimDispositionRepositoryDrizzle } from "@beep/epistemic-server/ClaimDisposition"
 *
 * console.log(ClaimDispositionRepositoryDrizzle)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimDispositionRepositoryDrizzle: Layer.Layer<ClaimDispositionRepository, never, PostgresDrizzle> =
  Layer.effect(ClaimDispositionRepository, makeDrizzleClaimDispositionRepository());
