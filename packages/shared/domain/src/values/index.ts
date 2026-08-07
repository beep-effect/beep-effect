/**
 * The shared domain values module - Contains modules for shared value objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ClaimLifecycle - Shared admission lifecycle vocabulary for claims.
 *
 * **Example** (Log admitted claim lifecycle)
 *
 * ```ts
 * import { ClaimLifecycle } from "@beep/shared-domain/values"
 *
 * console.log(ClaimLifecycle.ClaimLifecycle.Enum.admitted)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as ClaimLifecycle from "./ClaimLifecycle/index.ts";
/**
 * LocalDate - Value object representing a local date.
 *
 * **Example** (Print today's local date)
 *
 * ```ts
 * import { LocalDate } from "@beep/shared-domain/values"
 *
 * console.log(LocalDate.today().toISOString())
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as LocalDate from "./LocalDate/index.ts";
/**
 * OnePasswordReference - Typed reference to a 1Password item field.
 *
 * **Example** (Log OnePasswordReference value)
 *
 * ```ts
 * import { OnePasswordReference } from "@beep/shared-domain/values"
 *
 * console.log(OnePasswordReference.OnePasswordReference)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as OnePasswordReference from "./OnePasswordReference/index.ts";
/**
 * Rule effect value object exports.
 *
 * **Example** (Import Rule and log AST)
 *
 * ```ts
 * import { Rule } from "@beep/shared-domain/values/Rule/Rule.model"
 *
 * console.log(Rule.ast)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Rule/index.ts";
