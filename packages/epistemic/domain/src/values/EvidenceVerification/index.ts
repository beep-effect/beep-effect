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
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EvidenceVerificationManifestationKey)("a".repeat(64)))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./EvidenceVerification.model.ts";
