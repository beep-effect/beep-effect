/**
 * Epistemic domain models for claims, evidence, activities, and usage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Epistemic entity model exports.
 *
 * @example
 * ```ts
 * import { Activity } from "@beep/epistemic-domain"
 *
 * console.log(Activity.definition.entityId.tableName)
 * ```

 * @category entities
 * @since 0.0.0
 */
export * from "./entities/index.ts";
/**
 * Epistemic slice-local identity exports.
 *
 * @example
 * ```ts
 * import { Identity } from "@beep/epistemic-domain"
 *
 * console.log(Identity.Epistemic.ContradictionCandidateId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as Identity from "./identity/index.ts";
/**
 * Epistemic value model exports.
 *
 * @example
 * ```ts
 * import { ClaimGateSeverity } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const severity = S.decodeUnknownSync(ClaimGateSeverity)("warning")
 * console.log(severity)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./values/index.ts";
