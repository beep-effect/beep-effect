/**
 * Test-only access to Corpus restoration internals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Crash-recoverable writer claim used by subprocess lifecycle proofs.
 *
 * @category testing
 * @since 0.0.0
 */
export { restorationArchiveTesting, withRestorationWriterClaim } from "../commands/Corpus/internal/Restoration.ts";
export { restorationTransformationTesting } from "../commands/Corpus/internal/RestorationTransformations.ts";
