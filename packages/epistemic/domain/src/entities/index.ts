/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Activity entity exports.
 *
 * **Example** (Log Activity table name)
 *
 * ```ts
 * import { Activity } from "@beep/epistemic-domain/entities"
 *
 * console.log(Activity.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./Activity/index.ts";
/**
 * Candidate claim entity exports.
 *
 * **Example** (Log CandidateClaim table name)
 *
 * ```ts
 * import { CandidateClaim } from "@beep/epistemic-domain/entities"
 *
 * console.log(CandidateClaim.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./CandidateClaim/index.ts";
/**
 * Claim disposition entity exports.
 *
 * **Example** (Log ClaimDisposition table name)
 *
 * ```ts
 * import { ClaimDisposition } from "@beep/epistemic-domain/entities"
 *
 * console.log(ClaimDisposition.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./ClaimDisposition/index.ts";
/**
 * Contradiction candidate, receipt, and disposition entity exports.
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./Contradiction/index.ts";
/**
 * Bitemporal edge version entity exports.
 *
 * **Example** (Log EdgeVersion table name)
 *
 * ```ts
 * import { EdgeVersion } from "@beep/epistemic-domain/entities"
 *
 * console.log(EdgeVersion.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./EdgeVersion/index.ts";
/**
 * Evidence entity exports.
 *
 * **Example** (Log Evidence table name)
 *
 * ```ts
 * import { Evidence } from "@beep/epistemic-domain/entities"
 *
 * console.log(Evidence.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./Evidence/index.ts";
/**
 * Evidence-verification sidecar entity exports.
 *
 * **Example** (Log EvidenceVerification table name)
 *
 * ```ts
 * import { EvidenceVerification } from "@beep/epistemic-domain/entities"
 *
 * console.log(EvidenceVerification.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./EvidenceVerification/index.ts";
/**
 * Usage record entity exports.
 *
 * **Example** (Log UsageRecord table name)
 *
 * ```ts
 * import { UsageRecord } from "@beep/epistemic-domain/entities"
 *
 * console.log(UsageRecord.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./UsageRecord/index.ts";
