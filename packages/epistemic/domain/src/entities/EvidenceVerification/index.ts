/**
 * Evidence-verification entity exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Evidence-verification behavior exports.
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./EvidenceVerification.behavior.ts";
/**
 * Immutable evidence-verification sidecar model.
 *
 * **Example** (Log entity type from definition)
 *
 * ```ts
 * import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification"
 *
 * console.log(EvidenceVerification.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./EvidenceVerification.model.ts";
