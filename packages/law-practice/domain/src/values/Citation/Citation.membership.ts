/**
 * Ordered resource membership and detached semantic references.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import {
  CitationAuthorityId,
  CitationDetachedId,
  CitationMemberListId,
  CitationMentionId,
} from "./Citation.identity.ts";
import { Citation } from "./Citation.models.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.membership");
/**
 * A detached semantic object has no source evidence and is not a mention.
 * Its document-local object identity preserves references independently of
 * semantic equality; matching fields do not make two object IDs identical.
 * **Example** (Inspect semantic ownership)
 * ```ts
 * import { CitationDetached } from "@beep/law-practice-domain/values"
 * console.log(CitationDetached.fields.citation !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationDetached extends S.Opaque<CitationDetached, { readonly brand: unique symbol }>()(
  S.Struct({ id: CitationDetachedId, citation: Citation }).pipe(
    $I.annoteSchema("CitationDetached", {
      description:
        "Detached semantic citation object; contains no anchor, source claim or runtime evidence capability.",
    })
  )
) {}
/**
 * A reference explicitly distinguishes verified occurrences from detached
 * semantic objects. Neither reference embeds another citation copy.
 * **Example** (Inspect reference variants)
 * ```ts
 * import { CitationGroupMember } from "@beep/law-practice-domain/values"
 * console.log(CitationGroupMember.cases.Mention !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationGroupMember = S.TaggedUnion({
  Mention: { mentionId: CitationMentionId },
  Detached: { detachedId: CitationDetachedId },
}).pipe(
  $I.annoteSchema("CitationGroupMember", {
    description: "Closed document reference with explicit evidence-versus-semantic-object distinction.",
  })
);
/**
 * Schema-derived group member reference.
 * @category models
 * @since 0.0.0
 */
export type CitationGroupMember = typeof CitationGroupMember.Type;
/**
 * The sole encoded owner of an ordered member sequence. Repeated references
 * and empty sequences are intentional. Different lists may have equal values;
 * groups sharing one list ID retain an explicit alias relation.
 * **Example** (Inspect list identity)
 * ```ts
 * import { CitationMemberList } from "@beep/law-practice-domain/values"
 * console.log(CitationMemberList.fields.members !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationMemberList extends S.Opaque<CitationMemberList, { readonly brand: unique symbol }>()(
  S.Struct({ id: CitationMemberListId, members: S.Array(CitationGroupMember) }).pipe(
    $I.annoteSchema("CitationMemberList", {
      description:
        "Document-local list identity and exact ordered multiplicity; no evidence is issued by an object/list token.",
    })
  )
) {}
/**
 * One listed resource group. Presence is explicit even when its list is empty.
 * The authority catalog may also contain resources referenced only by decisions.
 * **Example** (Inspect the group/list link)
 * ```ts
 * import { CitationResourceGroup } from "@beep/law-practice-domain/values"
 * console.log(CitationResourceGroup.fields.memberListId !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationResourceGroup extends S.Opaque<CitationResourceGroup, { readonly brand: unique symbol }>()(
  S.Struct({ authorityId: CitationAuthorityId, memberListId: CitationMemberListId }).pipe(
    $I.annoteSchema("CitationResourceGroup", {
      description: "Ordered listed group referencing one authority and one shared member-list node.",
    })
  )
) {}
