/**
 * Contradiction-triage server adapter exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Contradiction-triage repository and application-service Layers.
 *
 * @category layers
 * @since 0.0.0
 */
export {
  ContradictionTriageRepositoryDrizzle,
  ContradictionTriageRepositoryFixture,
  ContradictionTriageServiceLive,
} from "./ContradictionTriage.layer.ts";
/**
 * Drizzle contradiction-triage repository constructor.
 *
 * @category repositories
 * @since 0.0.0
 */
export { makeDrizzleContradictionTriageRepository } from "./ContradictionTriage.repo.ts";
/**
 * Contradiction-triage RPC handler Layer.
 *
 * @category layers
 * @since 0.0.0
 */
export { ContradictionHandlersLive } from "./ContradictionTriage.rpc-handlers.ts";
