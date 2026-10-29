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
import { CitationAuthorityId, CitationMentionId } from "./Citation.identity.ts";
import { CitationMention, CitationMentionReceipt } from "./Citation.mention.ts";
import { FullCitation } from "./Citation.models.ts";
import { CitationResolution } from "./Citation.resolution.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.document");
const sourceEquivalent = S.toEquivalence(SourceTextIdentity);
const isFull = S.is(FullCitation);

/**
 * Authority resource represented by a full mention already in the document.
 * Membership is derived from resolved edges, never duplicated here.
 * **Example** (Inspect the representative reference)
 * ```ts
 * import { CitationAuthority } from "@beep/law-practice-domain/values"
 * console.log(CitationAuthority.fields.fullMentionId !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationAuthority extends S.Opaque<CitationAuthority, { readonly brand: unique symbol }>()(
  S.Struct({ id: CitationAuthorityId, fullMentionId: CitationMentionId }).pipe(
    $I.annoteSchema("CitationAuthority", {
      description:
        "Document-local resource identity with a full-citation representative; no embedded citation copy or membership array.",
    })
  )
) {}
const Relationships = {
  source: SourceTextIdentity,
  engineArtifact: Sha256Hex,
  authorities: S.Array(CitationAuthority),
  resolutions: S.Array(CitationResolution),
};
const RuntimeShape = S.Struct({ ...Relationships, mentions: S.Array(CitationMention) });
const ReceiptShape = S.Struct({
  schemaVersion: S.tag("citation-document-receipt/v1"),
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
  if (
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
    A.every(document.authorities, (authority) =>
      O.match(HashMap.get(byMention, authority.fullMentionId), {
        onNone: () => false,
        onSome: (mention) =>
          isFull(mention.citation) &&
          O.match(HashMap.get(byResolution, mention.id), {
            onNone: () => false,
            onSome: (resolution) => resolution.status === "Resolved" && resolution.authorityId === authority.id,
          }),
      })
    )
  );
};
const graphCheck = S.makeFilter(
  coherent,
  $I.annote("DocumentRelationshipCoherence", {
    title: "Document Relationship Coherence",
    description:
      "Unique IDs, exactly one resolution per mention, closed references, coherent source/engine identity and full authority representatives.",
    message: "Citation document relationships are incoherent.",
  })
);

/**
 * Ordered runtime mentions and the sole encoded authority membership edges.
 *
 * Every mention has exactly one resolution. Authorities reference full mentions
 * resolved to that authority. Warnings/candidates/targets stay within the same
 * document; mentions share its source and engine artifact. These checks prove
 * graph coherence, not legal classification, digest authenticity or resolution
 * correctness. Parallel/string/history relationships need their separate proof.
 * Persist the explicit document receipt, never a JSON copy of runtime proofs.
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
        "Runtime proof-bearing citation document with one canonical membership edge per resolved mention and no recursive citation copies.",
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
 * Derive an authority's ordered member IDs from the document's resolved edges.
 * An absent authority has no members. Ambiguous candidates are not membership.
 * **Example** (Inspect the projection function)
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
  ): ReadonlyArray<CitationMentionId> => {
    const members = HashMap.fromIterable(
      A.map(
        A.filter(
          document.resolutions,
          (resolution) => resolution.status === "Resolved" && resolution.authorityId === authorityId
        ),
        (resolution) => Tuple.make(resolution.mentionId, true)
      )
    );
    const mentions: ReadonlyArray<CitationMention | CitationMentionReceipt> = document.mentions;
    return A.map(
      A.filter(mentions, (mention) => HashMap.has(members, mention.id)),
      (mention) => mention.id
    );
  }
);
