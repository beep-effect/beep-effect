/**
 * Dublin Core Metadata Terms vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * DCMI Metadata Terms namespace IRI.
 *
 * @example
 * ```ts
 * import { DCTERMS_NAMESPACE } from "@beep/rdf/Vocab/Dcterms"
 *
 * const titleIri = `${DCTERMS_NAMESPACE}title`
 * console.log(titleIri) // "http://purl.org/dc/terms/title"
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const DCTERMS_NAMESPACE = "http://purl.org/dc/terms/" as const;

/**
 * Complete dcterms local-name inventory mirrored by `@beep/identity`.
 *
 * @example
 * ```ts
 * import { DCTERMS_TERMS } from "@beep/rdf/Vocab/Dcterms"
 *
 * console.log(DCTERMS_TERMS.includes("creator")) // true
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const DCTERMS_TERMS = [
  "Agent",
  "AgentClass",
  "BibliographicResource",
  "Box",
  "DCMIType",
  "DDC",
  "FileFormat",
  "Frequency",
  "IMT",
  "ISO3166",
  "ISO639-2",
  "ISO639-3",
  "Jurisdiction",
  "LCC",
  "LCSH",
  "LicenseDocument",
  "LinguisticSystem",
  "Location",
  "LocationPeriodOrJurisdiction",
  "MESH",
  "MediaType",
  "MediaTypeOrExtent",
  "MethodOfAccrual",
  "MethodOfInstruction",
  "NLM",
  "Period",
  "PeriodOfTime",
  "PhysicalMedium",
  "PhysicalResource",
  "Point",
  "Policy",
  "ProvenanceStatement",
  "RFC1766",
  "RFC3066",
  "RFC4646",
  "RFC5646",
  "RightsStatement",
  "SizeOrDuration",
  "Standard",
  "TGN",
  "UDC",
  "URI",
  "W3CDTF",
  "abstract",
  "accessRights",
  "accrualMethod",
  "accrualPeriodicity",
  "accrualPolicy",
  "alternative",
  "audience",
  "available",
  "bibliographicCitation",
  "conformsTo",
  "contributor",
  "coverage",
  "created",
  "creator",
  "date",
  "dateAccepted",
  "dateCopyrighted",
  "dateSubmitted",
  "description",
  "educationLevel",
  "extent",
  "format",
  "hasFormat",
  "hasPart",
  "hasVersion",
  "identifier",
  "instructionalMethod",
  "isFormatOf",
  "isPartOf",
  "isReferencedBy",
  "isReplacedBy",
  "isRequiredBy",
  "isVersionOf",
  "issued",
  "language",
  "license",
  "mediator",
  "medium",
  "modified",
  "provenance",
  "publisher",
  "references",
  "relation",
  "replaces",
  "requires",
  "rights",
  "rightsHolder",
  "source",
  "spatial",
  "subject",
  "tableOfContents",
  "temporal",
  "title",
  "type",
  "valid",
] as const;
