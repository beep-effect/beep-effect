/**
 * Stable court/reporter vocabulary artifacts, lookups, and compatibility law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Court/reporter lifecycle compatibility exports.
 *
 * **Example** (Import the compatibility classifier)
 *
 * ```ts
 * import { classifyCourtReporterArtifactCompatibility } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export * from "./CourtReporterVocabulary.compatibility.ts";
/**
 * Decoded court/reporter artifacts and lookup exports.
 *
 * **Example** (Import the current artifact)
 *
 * ```ts
 * import { CourtReporterArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./CourtReporterVocabulary.data.ts";
/**
 * Court/reporter schema and model exports.
 *
 * **Example** (Import the stable identifiers)
 *
 * ```ts
 * import { CourtId, ReporterId } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./CourtReporterVocabulary.model.ts";
