/**
 * Document-owned citation resources and resolution relationships.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationAuthorityId } from "./Citation.identity.ts";
import {
  CitationDetached,
  CitationGroupMember,
  CitationMemberList,
  CitationResourceGroup,
} from "./Citation.membership.ts";
import { CitationMention, CitationMentionReceipt } from "./Citation.mention.ts";
import { CitationResolution } from "./Citation.resolution.ts";
import type { CitationMentionId } from "./Citation.identity.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.document");
const sourceEquivalent = S.toEquivalence(SourceTextIdentity);

/**
 * Authority catalog entry with an optional example reference. The example is
 * not an assertion of resolution or group membership. Empty listed groups and
 * detached-only groups do not require a fabricated physical occurrence.
 * **Example** (Inspect the representative reference)
 * ```ts
 * import { CitationAuthority } from "@beep/law-practice-domain/values"
 * console.log(CitationAuthority.fields.representative !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationAuthority extends S.Opaque<CitationAuthority, { readonly brand: unique symbol }>()(
  S.Struct({ id: CitationAuthorityId, representative: S.OptionFromNullOr(CitationGroupMember) }).pipe(
    $I.annoteSchema("CitationAuthority", {
      description:
        "Document-local resource identity and optional example reference; no embedded citation copy or membership array.",
    })
  )
) {}
const Relationships = {
  source: SourceTextIdentity,
  engineArtifact: Sha256Hex,
  authorities: S.Array(CitationAuthority),
  resolutions: S.Array(CitationResolution),
  groups: S.Array(CitationResourceGroup),
  memberLists: S.Array(CitationMemberList),
  detachedCitations: S.Array(CitationDetached),
};
const RuntimeShape = S.Struct({ ...Relationships, mentions: S.Array(CitationMention) });
const ReceiptShape = S.Struct({
  schemaVersion: S.tag("citation-document-receipt/v2"),
  ...Relationships,
  mentions: S.Array(CitationMentionReceipt),
});
const coherent = (document: typeof RuntimeShape.Type | typeof ReceiptShape.Type): boolean => {
  const mentions: ReadonlyArray<CitationMention | CitationMentionReceipt> = document.mentions;
  const byMention = HashMap.fromIterable(A.map(mentions, (mention) => Tuple.make(mention.id, mention)));
  const byAuthority = HashMap.fromIterable(
    A.map(document.authorities, (authority) => Tuple.make(authority.id, authority))
  );
  const byResolution = HashMap.fromIterable(
    A.map(document.resolutions, (resolution) => Tuple.make(resolution.mentionId, resolution))
  );
  const byList = HashMap.fromIterable(A.map(document.memberLists, (list) => Tuple.make(list.id, list)));
  const byDetached = HashMap.fromIterable(
    A.map(document.detachedCitations, (citation) => Tuple.make(citation.id, citation))
  );
  const byGroup = HashMap.fromIterable(A.map(document.groups, (group) => Tuple.make(group.authorityId, group)));
  const referenceExists = (reference: CitationGroupMember) =>
    CitationGroupMember.match(reference, {
      Mention: (value) => HashMap.has(byMention, value.mentionId),
      Detached: (value) => HashMap.has(byDetached, value.detachedId),
    });
  if (
    HashMap.size(byList) !== A.length(document.memberLists) ||
    HashMap.size(byDetached) !== A.length(document.detachedCitations) ||
    HashMap.size(byGroup) !== A.length(document.groups) ||
    HashMap.size(byMention) !== A.length(mentions) ||
    HashMap.size(byAuthority) !== A.length(document.authorities) ||
    HashMap.size(byResolution) !== A.length(document.resolutions) ||
    HashMap.size(byResolution) !== HashMap.size(byMention)
  )
    return false;
  return (
    A.every(
      mentions,
      (mention) =>
        sourceEquivalent(document.source, mention.anchor.source) &&
        mention.engineArtifact === document.engineArtifact &&
        HashMap.has(byResolution, mention.id) &&
        A.every(
          mention.warnings,
          (warning) => warning.previousMentionId !== mention.id && HashMap.has(byMention, warning.previousMentionId)
        )
    ) &&
    A.every(
      document.resolutions,
      (resolution) =>
        HashMap.has(byMention, resolution.mentionId) &&
        CitationResolution.match(resolution, {
          Resolved: (value) => HashMap.has(byAuthority, value.authorityId),
          Ambiguous: (value) => A.every(value.candidateAuthorityIds, (id) => HashMap.has(byAuthority, id)),
          Unresolved: () => true,
        })
    ) &&
    A.every(
      document.groups,
      (group) => HashMap.has(byAuthority, group.authorityId) && HashMap.has(byList, group.memberListId)
    ) &&
    A.every(document.memberLists, (list) => A.every(list.members, referenceExists)) &&
    A.every(
      document.authorities,
      (authority) => O.isNone(authority.representative) || referenceExists(authority.representative.value)
    )
  );
};
const graphCheck = S.makeFilter(
  coherent,
  $I.annote("DocumentRelationshipCoherence", {
    title: "Document Relationship Coherence",
    description:
      "Unique IDs, exactly one resolution per mention, closed references, coherent source/engine identity and closed example/group/list/object references.",
    message: "Citation document relationships are incoherent.",
  })
);

/**
 * Runtime mentions, resource catalog, decisions and exact group/list data.
 *
 * Every verified mention has one resolution decision. Group membership is
 * owned only by member-list nodes, preserving independent order, repetitions,
 * empty presence and shared-list identity. A decision is not an assignment.
 * Detached semantic objects have no source capability and remain distinct from
 * verified occurrences. Reference closure and source/engine coherence do not
 * attest classification, resource-key authenticity or alias correctness.
 * Persist the explicit receipt instead of JSON-copying runtime capabilities.
 * **Example** (Inspect relationship ownership)
 * ```ts
 * import { CitationDocument } from "@beep/law-practice-domain/values"
 * console.log(CitationDocument.fields.resolutions !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationDocument extends S.Opaque<CitationDocument, { readonly brand: unique symbol }>()(
  RuntimeShape.check(graphCheck).pipe(
    $I.annoteSchema("CitationDocument", {
      description:
        "Runtime proof-bearing mentions with separate decisions and ordered, identity-bearing group lists; detached semantics never issue evidence.",
    })
  )
) {}

/**
 * Structural document receipt with the same relationship coherence checks.
 *
 * Each mention receipt still needs canonical-source restoration; this schema
 * cannot issue runtime anchor proof or validate authority digest inputs.
 * **Example** (Inspect structural mention ownership)
 * ```ts
 * import { CitationDocumentReceipt } from "@beep/law-practice-domain/values"
 * console.log(CitationDocumentReceipt.fields.mentions !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationDocumentReceipt extends S.Opaque<CitationDocumentReceipt, { readonly brand: unique symbol }>()(
  ReceiptShape.check(graphCheck).pipe(
    $I.annoteSchema("CitationDocumentReceipt", {
      description:
        "Versioned structural persistence of document relationships and mention receipts; no runtime proof authority.",
    })
  )
) {}

/**
 * Read the exact listed member sequence, preserving order and repetitions.
 * Catalog presence alone does not create a group; an absent group has no
 * members. Detached references remain explicit rather than being dropped.
 * **Example** (Inspect the projection)
 * ```ts
 * import { citationAuthorityMembers } from "@beep/law-practice-domain/values"
 * console.log(citationAuthorityMembers !== undefined) // true
 * ```
 * @category getters
 * @since 0.0.0
 */
export const citationAuthorityMembers: {
  (
    authorityId: CitationAuthorityId
  ): (document: CitationDocument | CitationDocumentReceipt) => ReadonlyArray<CitationGroupMember>;
  (
    document: CitationDocument | CitationDocumentReceipt,
    authorityId: CitationAuthorityId
  ): ReadonlyArray<CitationGroupMember>;
} = dual(
  2,
  (
    document: CitationDocument | CitationDocumentReceipt,
    authorityId: CitationAuthorityId
  ): ReadonlyArray<CitationGroupMember> =>
    O.getOrElse(
      O.flatMap(
        A.findFirst(document.groups, (group) => group.authorityId === authorityId),
        (group) =>
          O.map(
            A.findFirst(document.memberLists, (list) => list.id === group.memberListId),
            (list) => list.members
          )
      ),
      A.empty<CitationGroupMember>
    )
);
/**
 * Project only verified mention IDs from a listed sequence. This explicitly
 * named view preserves their order/repetitions and excludes detached objects;
 * use citationAuthorityMembers when every reference is required.
 * **Example** (Inspect the physical-occurrence view)
 * ```ts
 * import { citationAuthorityMentionIds } from "@beep/law-practice-domain/values"
 * console.log(citationAuthorityMentionIds !== undefined) // true
 * ```
 * @category getters
 * @since 0.0.0
 */
export const citationAuthorityMentionIds: {
  (
    authorityId: CitationAuthorityId
  ): (document: CitationDocument | CitationDocumentReceipt) => ReadonlyArray<CitationMentionId>;
  (
    document: CitationDocument | CitationDocumentReceipt,
    authorityId: CitationAuthorityId
  ): ReadonlyArray<CitationMentionId>;
} = dual(
  2,
  (
    document: CitationDocument | CitationDocumentReceipt,
    authorityId: CitationAuthorityId
  ): ReadonlyArray<CitationMentionId> =>
    A.map(
      A.filter(citationAuthorityMembers(document, authorityId), CitationGroupMember.guards.Mention),
      (member) => member.mentionId
    )
);
