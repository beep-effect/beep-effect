/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Activity entity exports.
 *
 * @example
 * ```ts
 * import { Activity } from "@beep/epistemic-domain/entities"
 *
 * console.log(Activity.definition.entityId.tableName)
 * ```

 * @category entities
 * @since 0.0.0
 */
export * from "./Activity/index.ts";
/**
 * Candidate claim entity exports.
 *
 * @example
 * ```ts
 * import { CandidateClaim } from "@beep/epistemic-domain/entities"
 *
 * console.log(CandidateClaim.definition.entityId.tableName)
 * ```

 * @category entities
 * @since 0.0.0
 */
export * from "./CandidateClaim/index.ts";
/**
 * Evidence entity exports.
 *
 * @example
 * ```ts
 * import { Evidence } from "@beep/epistemic-domain/entities"
 *
 * console.log(Evidence.definition.entityId.tableName)
 * ```

 * @category entities
 * @since 0.0.0
 */
export * from "./Evidence/index.ts";
/**
 * Usage record entity exports.
 *
 * @example
 * ```ts
 * import { UsageRecord } from "@beep/epistemic-domain/entities"
 *
 * console.log(UsageRecord.definition.entityId.tableName)
 * ```

 * @category entities
 * @since 0.0.0
 */
export * from "./UsageRecord/index.ts";
