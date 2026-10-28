/**
 * Citation value-object exports.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

/**
 * Document-local occurrence and authority identities.
 *
 * @category models
 * @since 0.0.0
 */
export { CitationAuthorityId, CitationMentionId } from "./Citation.identity.ts";
/**
 * Canonical law semantics and publication identity references.
 * @category models
 * @since 0.0.0
 */
export {
  CitationEditionRef,
  CitationLawComponents,
  CitationLawMetadata,
  CitationLawPublication,
  FullLawCitation,
} from "./Citation.law.ts";
/**
 * Citation model exports.
 *
 * **Example** (Import Citation module)
 *
 * ```ts
 * import { Citation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Citation.models.ts";
