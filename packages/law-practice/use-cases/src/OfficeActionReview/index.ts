/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Office-action extraction label exports.
 *
 * **Example** (Check extraction label export)
 *
 * ```ts
 * import * as Module from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(Object.keys(Module).includes("OfficeActionExtractionLabel")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./OfficeActionExtractionLabel.ts";
/**
 * Office-action review port exports.
 *
 * **Example** (Check review port export)
 *
 * ```ts
 * import * as Module from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(Object.keys(Module).includes("OfficeActionReview")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./OfficeActionReview.ports.ts";
/**
 * Office-action review implementation exports.
 *
 * **Example** (Check review implementation export)
 *
 * ```ts
 * import * as Module from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(Object.keys(Module).includes("makeOfficeActionReview")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./OfficeActionReview.service.ts";
