/**
 * Epistemic domain models for claims, evidence, activities, and usage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Epistemic entity model exports.
 *
 * **Example** (Import Activity table name)
 *
 * ```ts
 * import { Activity } from "@beep/epistemic-domain"
 *
 * console.log(Activity.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./entities/index.ts";
/**
 * Epistemic value model exports.
 *
 * **Example** (Decode ClaimGateSeverity warning value)
 *
 * ```ts
 * import { ClaimGateSeverity } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const severity = S.decodeUnknownSync(ClaimGateSeverity)("warning")
 * console.log(severity)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./values/index.ts";
