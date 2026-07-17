/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Claim lifecycle error exports.
 *
 * @example
 * ```ts
 * import { ClaimInvalidTransition } from "@beep/epistemic-domain/values/ClaimLifecycle"
 *
 * const error = ClaimInvalidTransition.between("candidate", "admitted")
 * console.log(error._tag)
 * ```

 * @category errors
 * @since 0.0.0
 */
export * from "./ClaimLifecycle.errors.ts";
/**
 * Claim lifecycle model exports.
 *
 * @example
 * ```ts
 * import { ClaimLifecycle } from "@beep/epistemic-domain/values/ClaimLifecycle"
 *
 * console.log(ClaimLifecycle.Enum.candidate)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimLifecycle.model.ts";
