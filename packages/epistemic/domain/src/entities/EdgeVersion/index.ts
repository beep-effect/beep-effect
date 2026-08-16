/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Bitemporal edge-version behavior exports.
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./EdgeVersion.behavior.ts";
/**
 * Bitemporal edge version entity exports.
 *
 * **Example** (Import EdgeVersion entity)
 *
 * ```ts
 * import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion"
 *
 * console.log(EdgeVersion.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./EdgeVersion.model.ts";
