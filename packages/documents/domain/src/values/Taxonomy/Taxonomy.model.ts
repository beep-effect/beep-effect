/**
 * Legal document taxonomy seed schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { IRIReference } from "@beep/rdf";
import { LiteralKit, UnknownRecord } from "@beep/schema";
import { ValidWindowsPlainPathSegment } from "@beep/schema/FilePath";
import * as S from "effect/Schema";

const $I = $DocumentsDomainId.create("values/Taxonomy/Taxonomy.model");

/**
 * Stable concept identifiers in the P1 legal document taxonomy seed.
 *
 * **Example** (Decode pleadings concept id)
 *
 * ```ts
 * import { LegalDocumentConceptId } from "@beep/documents-domain/values/Taxonomy"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(LegalDocumentConceptId)("pleadings")
 * console.log(id)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LegalDocumentConceptId = LiteralKit([
  "pleadings",
  "motions-and-applications",
  "briefs-and-legal-argument",
  "court-orders-and-judgments",
  "notices-and-docket-filings",
  "correspondence",
  "email-and-messages",
  "agreements-and-contracts",
  "closing-and-transaction-records",
  "discovery-requests-and-responses",
  "productions",
  "deposition-materials",
  "subpoenas-and-third-party-process",
  "exhibits-and-evidence",
  "expert-materials",
  "memoranda-and-legal-research",
  "attorney-work-product-and-notes",
  "client-intake-and-engagement",
  "billing-and-invoices",
  "time-records",
  "settlement-and-adr",
  "regulatory-and-agency-filings",
  "ip-prosecution-and-portfolio",
  "corporate-and-governance-records",
  "client-source-materials",
]).pipe(
  $I.annoteSchema("LegalDocumentConceptId", {
    description: "Stable concept identifiers in the P1 legal document taxonomy seed.",
  })
);

/**
 * Stable concept identifiers in the P1 legal document taxonomy seed.
 *
 * **Example** (Typed concept id decode)
 *
 * ```ts
 * import { LegalDocumentConceptId } from "@beep/documents-domain/values/Taxonomy"
 * import * as S from "effect/Schema"
 *
 * const id: LegalDocumentConceptId = S.decodeUnknownSync(LegalDocumentConceptId)("pleadings")
 * console.log(id)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type LegalDocumentConceptId = typeof LegalDocumentConceptId.Type;

/**
 * FOLIO alignment confidence for a legal document taxonomy concept.
 *
 * **Example** (Decode none alignment kind)
 *
 * ```ts
 * import { FolioAlignmentKind } from "@beep/documents-domain/values/Taxonomy"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(FolioAlignmentKind)("none")
 * console.log(kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const FolioAlignmentKind = LiteralKit(["exact", "close", "none"]).pipe(
  $I.annoteSchema("FolioAlignmentKind", {
    description: "FOLIO alignment confidence for a legal document taxonomy concept.",
  })
);

/**
 * FOLIO alignment confidence for a legal document taxonomy concept.
 *
 * **Example** (Typed none alignment kind)
 *
 * ```ts
 * import { FolioAlignmentKind } from "@beep/documents-domain/values/Taxonomy"
 * import * as S from "effect/Schema"
 *
 * const kind: FolioAlignmentKind = S.decodeUnknownSync(FolioAlignmentKind)("none")
 * console.log(kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type FolioAlignmentKind = typeof FolioAlignmentKind.Type;

/**
 * FOLIO mapping metadata for a seed taxonomy concept.
 *
 * **Example** (Decode FOLIO alignment object)
 *
 * ```ts
 * import { FolioAlignment } from "@beep/documents-domain/values/Taxonomy"
 * import * as S from "effect/Schema"
 *
 * const alignment = S.decodeUnknownSync(FolioAlignment)({
 *   conceptIri: null,
 *   kind: "none",
 *   sourceIris: ["https://github.com/filipdbrskja/FOLIO"]
 * })
 * console.log(alignment.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FolioAlignment extends S.Class<FolioAlignment>($I`FolioAlignment`)(
  {
    conceptIri: S.NullOr(IRIReference).annotateKey({
      description: "FOLIO concept IRI when a concept-level mapping exists.",
    }),
    kind: FolioAlignmentKind.annotateKey({
      description: "Mapping confidence against FOLIO.",
    }),
    sourceIris: S.Array(IRIReference).annotateKey({
      description: "Research source IRIs consulted when assigning the mapping.",
    }),
  },
  $I.annote("FolioAlignment", {
    description: "FOLIO mapping metadata for a seed taxonomy concept.",
  })
) {}

/**
 * One SKOS-style legal document taxonomy concept.
 *
 * **Example** (Decode full taxonomy concept)
 *
 * ```ts
 * import { LegalDocumentTaxonomyConcept } from "@beep/documents-domain/values/Taxonomy"
 * import * as S from "effect/Schema"
 *
 * const concept = S.decodeUnknownSync(LegalDocumentTaxonomyConcept)({
 *   definition: "Documents that frame claims and defenses.",
 *   folderSegment: "pleadings",
 *   folioAlignment: { conceptIri: null, kind: "none", sourceIris: [] },
 *   heuristicTokens: ["complaint"],
 *   id: "pleadings",
 *   iri: "https://ns.beep.sh/documents/taxonomy/legal-document#pleadings",
 *   parentId: null,
 *   prefLabel: "Pleadings",
 *   sortKey: "01"
 * })
 * console.log(concept.prefLabel)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalDocumentTaxonomyConcept extends S.Class<LegalDocumentTaxonomyConcept>(
  $I`LegalDocumentTaxonomyConcept`
)(
  {
    definition: S.NonEmptyString.annotateKey({
      description: "SKOS-style definition used for deterministic document filing.",
    }),
    folderSegment: ValidWindowsPlainPathSegment.annotateKey({
      description: "Filesystem-safe preferred folder segment for this concept.",
    }),
    folioAlignment: FolioAlignment.annotateKey({
      description: "FOLIO alignment result recorded from the P1 research seed.",
    }),
    heuristicTokens: S.Array(S.NonEmptyString).annotateKey({
      description: "Lowercase filing tokens used by the deterministic P1 heuristic.",
    }),
    id: LegalDocumentConceptId.annotateKey({
      description: "Stable taxonomy concept id.",
    }),
    iri: IRIReference.annotateKey({
      description: "Repository-owned IRI for the concept.",
    }),
    parentId: S.NullOr(LegalDocumentConceptId).annotateKey({
      description: "Optional broader concept id used to project ancestor folder paths.",
    }),
    prefLabel: S.NonEmptyString.annotateKey({
      description: "Human-readable preferred label.",
    }),
    sortKey: S.NullOr(S.NonEmptyString).annotateKey({
      description: "Optional stable ordering key rendered into vault folders.",
    }),
  },
  $I.annote("LegalDocumentTaxonomyConcept", {
    description: "One SKOS-style legal document taxonomy concept.",
  })
) {}

/**
 * Repo-owned legal document taxonomy seed.
 *
 * **Example** (Make taxonomy from seed)
 *
 * ```ts
 * import { LegalDocumentTaxonomy, legalDocumentTaxonomy } from "@beep/documents-domain/values/Taxonomy"
 *
 * const taxonomy = LegalDocumentTaxonomy.make(legalDocumentTaxonomy)
 * console.log(taxonomy.concepts.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalDocumentTaxonomy extends S.Class<LegalDocumentTaxonomy>($I`LegalDocumentTaxonomy`)(
  {
    concepts: S.Array(LegalDocumentTaxonomyConcept).annotateKey({
      description: "Ordered legal document taxonomy concepts.",
    }),
    jsonLdContext: UnknownRecord.annotateKey({
      description: "JSON-LD context used to publish the taxonomy seed.",
    }),
    schemaVersion: S.NonEmptyString.annotateKey({
      description: "Schema version for deterministic projection compatibility.",
    }),
    schemeIri: IRIReference.annotateKey({
      description: "Repository-owned SKOS concept scheme IRI.",
    }),
  },
  $I.annote("LegalDocumentTaxonomy", {
    description: "Repo-owned legal document taxonomy seed.",
  })
) {}

/**
 * Client and matter context used to project filed documents into a vault.
 *
 * **Example** (Decode vault filing context)
 *
 * ```ts
 * import { VaultFilingContext } from "@beep/documents-domain/values/Taxonomy"
 * import * as S from "effect/Schema"
 *
 * const context = S.decodeUnknownSync(VaultFilingContext)({
 *   clientDisplayName: "Default Client",
 *   clientStableKey: "client-default",
 *   matterDisplayName: "General Matter",
 *   matterStableKey: "matter-general"
 * })
 * console.log(context.matterStableKey)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultFilingContext extends S.Class<VaultFilingContext>($I`VaultFilingContext`)(
  {
    clientDisplayName: S.NonEmptyString.annotateKey({
      description: "Display name captured when the client path segment is first created.",
    }),
    clientStableKey: ValidWindowsPlainPathSegment.annotateKey({
      description: "Stable client key rendered into the client folder segment.",
    }),
    matterDisplayName: S.NonEmptyString.annotateKey({
      description: "Display name captured when the matter path segment is first created.",
    }),
    matterStableKey: ValidWindowsPlainPathSegment.annotateKey({
      description: "Stable matter key rendered into the matter folder segment.",
    }),
  },
  $I.annote("VaultFilingContext", {
    description: "Vault filing context supplied by the app or matter-resolution flow.",
  })
) {}

/**
 * Default filing context used before matter resolution exists.
 *
 * **Example** (Read default client key)
 *
 * ```ts
 * import { DefaultVaultFilingContext } from "@beep/documents-domain/values/Taxonomy"
 *
 * console.log(DefaultVaultFilingContext.clientStableKey)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DefaultVaultFilingContext = S.decodeUnknownSync(VaultFilingContext)({
  clientDisplayName: "Default Client",
  clientStableKey: "client-default",
  matterDisplayName: "General Matter",
  matterStableKey: "matter-general",
});
