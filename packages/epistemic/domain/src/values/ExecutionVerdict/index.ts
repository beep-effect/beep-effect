/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Execution verdict model exports.
 *
 * **Example** (Import DenialReason enum value)
 *
 * ```ts
 * import { DenialReason } from "@beep/epistemic-domain/values/ExecutionVerdict"
 *
 * console.log(DenialReason.Enum["grant-expired"])
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ExecutionVerdict.model.ts";
