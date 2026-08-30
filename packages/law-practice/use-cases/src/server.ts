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
 * **Example** (Verify IrToLaw factory export)
 *
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
 * **Example** (Verify review factory export)
 *
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
 * Typed patent-claim candidate mapping exports.
 *
 * @category mappings
 * @since 0.0.0
 */
export * from "./PatentClaimCandidate/index.ts";
/**
 * Practice knowledge-graph MCP declaration exports.
 *
 * **Example** (Count practice KG tools)
 *
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
/**
 * Canonical toolkit composers.
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./Tools.ts";
