/**
 * Pluggable NLP backend interface, capabilities, and failures.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * The abstract NLP backend contract (interface, capabilities, failures, helpers).
 *
 * **Example** (Import NLPBackend and log key)
 *
 * ```typescript
 * import { NLPBackend } from "@beep/nlp-processing/Backend"
 *
 * console.log(NLPBackend.NLPBackend.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as NLPBackend from "./NLPBackend.ts";
