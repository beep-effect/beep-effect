/**
 * Epistemic domain models for claims, evidence, activities, and usage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * **Example** (Import Activity table name)
 *
 * ```ts
 * import { Activity } from "@beep/epistemic-domain"
 *
 * console.log(Activity.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./entities/index.ts";
/**
 * **Example** (Log admitted lifecycle status)
 *
 * ```ts
 * import { ClaimLifecycle } from "@beep/epistemic-domain"
 *
 * console.log(ClaimLifecycle.Enum.admitted)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./values/index.ts";
