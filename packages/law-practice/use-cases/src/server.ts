/**
 * Server-only law-practice use-case exports (product service contracts).
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

/**
 * IR-to-law mapping service contract exports.
 *
 * @example
 * ```ts
 * import * as IrToLaw from "@beep/law-practice-use-cases/IrToLaw"
 *
 * console.log(Object.keys(IrToLaw).includes("makeIrToLaw")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as IrToLaw from "./IrToLaw/index.ts";
/**
 * Office-action review loop service contract exports.
 *
 * @example
 * ```ts
 * import * as OfficeActionReview from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(Object.keys(OfficeActionReview).includes("makeOfficeActionReview")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as OfficeActionReview from "./OfficeActionReview/index.ts";
/**
 * Practice knowledge-graph MCP declaration exports.
 *
 * @example
 * ```ts
 * import { PracticeKgToolkit } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(PracticeKgToolkit.tools).length) // 9
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./PracticeKg.tools.ts";
