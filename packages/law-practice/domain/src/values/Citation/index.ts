/**
 * Citation value-object exports.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

/**
 * Canonical case and reference semantic models.
 * @category models
 * @since 0.0.0
 */
export * from "./Citation.case.ts";
export * from "./Citation.document.ts";
/**
 * Document-local occurrence and authority identities.
 *
 * @category models
 * @since 0.0.0
 */
export {
  CitationAuthorityId,
  CitationDetachedId,
  CitationMemberListId,
  CitationMentionId,
  CitationResourceGroupId,
} from "./Citation.identity.ts";
/**
 * Canonical journal semantics.
 * @category models
 * @since 0.0.0
 */
export { FullJournalCitation } from "./Citation.journal.ts";
/**
 * Canonical law semantics.
 * @category models
 * @since 0.0.0
 */
export { CitationLawMetadata, FullLawCitation } from "./Citation.law.ts";
/**
 * Ordered group membership, list alias identities and detached semantic objects.
 * @category models
 * @since 0.0.0
 */
export * from "./Citation.membership.ts";
/**
 * Runtime verified occurrences and their structural persistence receipts.
 * @category models
 * @since 0.0.0
 */
export * from "./Citation.mention.ts";
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
/**
 * Stable-ID resolution outcomes and document-owned relationships.
 * @category models
 * @since 0.0.0
 */
export * from "./Citation.resolution.ts";
/**
 * Shared canonical semantic components, publication refs and locator metadata.
 * @category models
 * @since 0.0.0
 */
export * from "./Citation.resource.ts";
