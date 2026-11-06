/**
 * Versioned document-local citation identities, separate from persisted entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.identity");

/**
 * Opaque identity of one citation occurrence within a source version.
 *
 * **Details**
 *
 * Validates the versioned token, not source evidence or the producer's digest
 * inputs. The engine producer must bind the source version, engine artifact,
 * verified anchor and semantic discriminant. Consumers compare tokens without
 * parsing them. Persisted citation entities use the shared LawPractice ID.
 *
 * **Example** (Construct a mention token)
 *
 * ```ts
 * import { CitationMentionId } from "@beep/law-practice-domain/values"
 *
 * const id = CitationMentionId.make("cm1:0000000000000000000000000000000000000000000000000000000000000000")
 * console.log(id.length) // 68
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationMentionId = S.TemplateLiteral(["cm1:", Sha256Hex]).pipe(
  S.brand("CitationMentionId"),
  $I.annoteSchema("CitationMentionId", {
    description:
      "Version-one document-local occurrence token; its digest producer must bind source, engine, verified anchor and semantic kind.",
  })
);

/**
 * Schema-derived citation occurrence identity.
 *
 * @category models
 * @since 0.0.0
 */
export type CitationMentionId = typeof CitationMentionId.Type;

/**
 * Opaque identity of an authority group within one citation document.
 *
 * **Details**
 *
 * The producer must hash the versioned semantic authority key, preserving
 * frozen authority distinctions even when vocabulary aliases share a current
 * public reporter identity. This schema validates the token only. It does not
 * identify a persisted citation entity or prove authority resolution.
 *
 * **Example** (Construct an authority token)
 *
 * ```ts
 * import { CitationAuthorityId } from "@beep/law-practice-domain/values"
 *
 * const id = CitationAuthorityId.make("ca1:0000000000000000000000000000000000000000000000000000000000000000")
 * console.log(id.length) // 68
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationAuthorityId = S.TemplateLiteral(["ca1:", Sha256Hex]).pipe(
  S.brand("CitationAuthorityId"),
  $I.annoteSchema("CitationAuthorityId", {
    description:
      "Version-one document-local authority token; separate from occurrence tokens and persisted citation entity identity.",
  })
);

/**
 * Schema-derived document-local authority identity.
 *
 * @category models
 * @since 0.0.0
 */
export type CitationAuthorityId = typeof CitationAuthorityId.Type;

/**
 * Document-local detached object identity, distinct from source occurrences.
 * This validates a token only and can never stand in for a verified anchor.
 * **Example** (Inspect the schema)
 * ```ts
 * import { CitationDetachedId } from "@beep/law-practice-domain/values"
 * console.log(CitationDetachedId !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationDetachedId = S.TemplateLiteral(["cd1:", Sha256Hex]).pipe(
  S.brand("CitationDetachedId"),
  $I.annoteSchema("CitationDetachedId", {
    description:
      "Document-local semantic object token; not a physical occurrence, persisted entity or evidence capability.",
  })
);
/**
 * Schema-derived detached object identity.
 * @category models
 * @since 0.0.0
 */
export type CitationDetachedId = typeof CitationDetachedId.Type;
/**
 * Document-local member-list identity. Equal contents do not imply equal IDs.
 * The producing adapter must preserve alias relations rather than content-hash
 * equal-but-distinct lists into one node.
 * **Example** (Inspect the schema)
 * ```ts
 * import { CitationMemberListId } from "@beep/law-practice-domain/values"
 * console.log(CitationMemberListId !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationMemberListId = S.TemplateLiteral(["cl1:", Sha256Hex]).pipe(
  S.brand("CitationMemberListId"),
  $I.annoteSchema("CitationMemberListId", {
    description:
      "Document-local list identity preserving shared versus merely equal member sequences; token validation alone does not attest aliases.",
  })
);
/**
 * Schema-derived member-list identity.
 * @category models
 * @since 0.0.0
 */
export type CitationMemberListId = typeof CitationMemberListId.Type;

/**
 * Identity of one dictionary insertion entry, separate from its authority and
 * shared member list. Repeated resource objects may occupy distinct entries.
 * **Example** (Inspect the entry token)
 * ```ts
 * import { CitationResourceGroupId } from "@beep/law-practice-domain/values"
 * console.log(CitationResourceGroupId !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationResourceGroupId = S.TemplateLiteral(["cg1:", Sha256Hex]).pipe(
  S.brand("CitationResourceGroupId"),
  $I.annoteSchema("CitationResourceGroupId", {
    description:
      "Document-local insertion-entry token; distinct from authority equality and member-list alias identity.",
  })
);
/**
 * Schema-derived insertion-entry identity.
 * @category models
 * @since 0.0.0
 */
export type CitationResourceGroupId = typeof CitationResourceGroupId.Type;
