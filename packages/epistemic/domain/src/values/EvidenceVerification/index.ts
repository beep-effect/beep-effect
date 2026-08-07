/**
 * Evidence-verification value exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Evidence-verification manifestation schemas and helpers.
 *
 * **Example** (Validate manifestation key)
 *
 * ```ts
 * import { EvidenceVerificationManifestationKey } from "@beep/epistemic-domain/values/EvidenceVerification"
 *
 * console.log(EvidenceVerificationManifestationKey.is("a".repeat(64)))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./EvidenceVerification.model.ts";
