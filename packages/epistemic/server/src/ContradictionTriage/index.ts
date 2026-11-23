/**
 * Contradiction-triage server adapter exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @category layers
 * @since 0.0.0
 */
export {
  ContradictionTriageRepositoryDrizzle,
  ContradictionTriageRepositoryFixture,
  ContradictionTriageServiceLive,
} from "./ContradictionTriage.layer.ts";
/**
 * @category repositories
 * @since 0.0.0
 */
export { makeDrizzleContradictionTriageRepository } from "./ContradictionTriage.repo.ts";
/**
 * @category layers
 * @since 0.0.0
 */
export { ContradictionHandlersLive } from "./ContradictionTriage.rpc-handlers.ts";
