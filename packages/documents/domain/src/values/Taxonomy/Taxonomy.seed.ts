/**
 * Repo-owned P1 legal document taxonomy seed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { LegalDocumentTaxonomy } from "./Taxonomy.model.ts";

const SCHEME_IRI = "https://ns.beep.sh/documents/taxonomy/legal-document";
const FOLIO_SOURCE_IRIS = [
  "https://github.com/filipdbrskja/FOLIO",
  "https://raw.githubusercontent.com/filipdbrskja/FOLIO/master/FOLIO.owl",
];

const concept = <A extends Record<string, unknown>>(input: A): A => input;

const noFolioConcept = {
  conceptIri: null,
  kind: "none",
  sourceIris: FOLIO_SOURCE_IRIS,
} as const;

/**
 * JSON-LD context for the repo-owned legal document taxonomy seed.
 *
 * @example
 * ```ts
 * import { legalDocumentTaxonomyJsonLdContext } from "@beep/documents-domain/values/Taxonomy"
 *
 * console.log(legalDocumentTaxonomyJsonLdContext.skos)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalDocumentTaxonomyJsonLdContext = {
  beep: "https://ns.beep.sh/documents/taxonomy/legal-document#",
  dc: "http://purl.org/dc/terms/",
  folio: "https://github.com/filipdbrskja/FOLIO#",
  skos: "http://www.w3.org/2004/02/skos/core#",
} as const;

/**
 * Repo-owned deterministic legal document taxonomy seed.
 *
 * @example
 * ```ts
 * import { legalDocumentTaxonomy } from "@beep/documents-domain/values/Taxonomy"
 *
 * console.log(legalDocumentTaxonomy.concepts[0]?.id)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalDocumentTaxonomy = S.decodeUnknownSync(LegalDocumentTaxonomy)({
  concepts: [
    concept({
      definition: "Documents that initiate, answer, amend, or otherwise frame claims and defenses in a matter.",
      folderSegment: "pleadings",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["complaint", "answer", "petition", "pleading", "counterclaim", "crossclaim"],
      id: "pleadings",
      iri: `${SCHEME_IRI}#pleadings`,
      parentId: null,
      prefLabel: "Pleadings",
      sortKey: "01",
    }),
    concept({
      definition: "Requests for court or tribunal action, including motions, applications, and supporting papers.",
      folderSegment: "motions-and-applications",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["motion", "application", "petition-for", "move", "movant"],
      id: "motions-and-applications",
      iri: `${SCHEME_IRI}#motions-and-applications`,
      parentId: null,
      prefLabel: "Motions and Applications",
      sortKey: "02",
    }),
    concept({
      definition: "Legal argument submitted to a tribunal, including briefs and memoranda of points and authorities.",
      folderSegment: "briefs-and-legal-argument",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["brief", "argument", "points-and-authorities", "memorandum-of-law"],
      id: "briefs-and-legal-argument",
      iri: `${SCHEME_IRI}#briefs-and-legal-argument`,
      parentId: null,
      prefLabel: "Briefs and Legal Argument",
      sortKey: "03",
    }),
    concept({
      definition: "Orders, judgments, decrees, and other dispositive or directive tribunal records.",
      folderSegment: "court-orders-and-judgments",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["order", "judgment", "decree", "ruling", "minute-order"],
      id: "court-orders-and-judgments",
      iri: `${SCHEME_IRI}#court-orders-and-judgments`,
      parentId: null,
      prefLabel: "Court Orders and Judgments",
      sortKey: "04",
    }),
    concept({
      definition: "Notices, docket entries, certificates, and ministerial filings used to track procedural status.",
      folderSegment: "notices-and-docket-filings",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["notice", "docket", "certificate-of-service", "summons", "proof-of-service"],
      id: "notices-and-docket-filings",
      iri: `${SCHEME_IRI}#notices-and-docket-filings`,
      parentId: null,
      prefLabel: "Notices and Docket Filings",
      sortKey: "05",
    }),
    concept({
      definition: "Letters and correspondence exchanged outside chat or email message exports.",
      folderSegment: "correspondence",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["letter", "correspondence", "transmittal", "demand-letter"],
      id: "correspondence",
      iri: `${SCHEME_IRI}#correspondence`,
      parentId: null,
      prefLabel: "Correspondence",
      sortKey: "06",
    }),
    concept({
      definition: "Email, message, and chat exports preserved as matter records.",
      folderSegment: "email-and-messages",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["email", "message", "chat", "sms", "conversation"],
      id: "email-and-messages",
      iri: `${SCHEME_IRI}#email-and-messages`,
      parentId: null,
      prefLabel: "Email and Messages",
      sortKey: "07",
    }),
    concept({
      definition: "Contracts, agreements, amendments, schedules, and related contractual records.",
      folderSegment: "agreements-and-contracts",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["agreement", "contract", "amendment", "nda", "msa", "sow"],
      id: "agreements-and-contracts",
      iri: `${SCHEME_IRI}#agreements-and-contracts`,
      parentId: null,
      prefLabel: "Agreements and Contracts",
      sortKey: "08",
    }),
    concept({
      definition: "Closing binders, transaction deliverables, signature packets, and closing records.",
      folderSegment: "closing-and-transaction-records",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["closing", "transaction", "signature-packet", "binder", "deliverables"],
      id: "closing-and-transaction-records",
      iri: `${SCHEME_IRI}#closing-and-transaction-records`,
      parentId: null,
      prefLabel: "Closing and Transaction Records",
      sortKey: "09",
    }),
    concept({
      definition: "Discovery requests, responses, objections, interrogatories, and admission requests.",
      folderSegment: "discovery-requests-and-responses",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["discovery", "interrogatories", "request-for-production", "requests-for-admission", "rfa"],
      id: "discovery-requests-and-responses",
      iri: `${SCHEME_IRI}#discovery-requests-and-responses`,
      parentId: null,
      prefLabel: "Discovery Requests and Responses",
      sortKey: "10",
    }),
    concept({
      definition: "Produced documents, production logs, and production-volume artifacts.",
      folderSegment: "productions",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["production", "produced", "bates", "load-file", "production-log"],
      id: "productions",
      iri: `${SCHEME_IRI}#productions`,
      parentId: null,
      prefLabel: "Productions",
      sortKey: "11",
    }),
    concept({
      definition: "Deposition notices, transcripts, exhibits, errata, and related materials.",
      folderSegment: "deposition-materials",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["deposition", "transcript", "errata", "deponent"],
      id: "deposition-materials",
      iri: `${SCHEME_IRI}#deposition-materials`,
      parentId: null,
      prefLabel: "Deposition Materials",
      sortKey: "12",
    }),
    concept({
      definition: "Subpoenas, third-party requests, process returns, and related non-party records.",
      folderSegment: "subpoenas-and-third-party-process",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["subpoena", "third-party", "non-party", "process", "return-of-service"],
      id: "subpoenas-and-third-party-process",
      iri: `${SCHEME_IRI}#subpoenas-and-third-party-process`,
      parentId: null,
      prefLabel: "Subpoenas and Third-Party Process",
      sortKey: "13",
    }),
    concept({
      definition: "Exhibits, evidentiary materials, demonstratives, and authenticated evidence packets.",
      folderSegment: "exhibits-and-evidence",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["exhibit", "evidence", "demonstrative", "authenticated", "trial-exhibit"],
      id: "exhibits-and-evidence",
      iri: `${SCHEME_IRI}#exhibits-and-evidence`,
      parentId: null,
      prefLabel: "Exhibits and Evidence",
      sortKey: "14",
    }),
    concept({
      definition: "Expert reports, reliance materials, expert disclosures, and related expert work.",
      folderSegment: "expert-materials",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["expert", "expert-report", "reliance", "disclosure", "rebuttal"],
      id: "expert-materials",
      iri: `${SCHEME_IRI}#expert-materials`,
      parentId: null,
      prefLabel: "Expert Materials",
      sortKey: "15",
    }),
    concept({
      definition: "Legal research, analysis, and attorney memoranda not intended as filed briefs.",
      folderSegment: "memoranda-and-legal-research",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["research", "memo", "memorandum", "case-law", "legal-analysis"],
      id: "memoranda-and-legal-research",
      iri: `${SCHEME_IRI}#memoranda-and-legal-research`,
      parentId: null,
      prefLabel: "Memoranda and Legal Research",
      sortKey: "16",
    }),
    concept({
      definition: "Attorney notes, work product, strategy records, and internal matter analysis.",
      folderSegment: "attorney-work-product-and-notes",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["work-product", "notes", "strategy", "internal-analysis", "attorney-notes"],
      id: "attorney-work-product-and-notes",
      iri: `${SCHEME_IRI}#attorney-work-product-and-notes`,
      parentId: null,
      prefLabel: "Attorney Work Product and Notes",
      sortKey: "17",
    }),
    concept({
      definition: "Engagement letters, intake questionnaires, conflict records, and client onboarding files.",
      folderSegment: "client-intake-and-engagement",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["intake", "engagement", "conflict", "onboarding", "retainer"],
      id: "client-intake-and-engagement",
      iri: `${SCHEME_IRI}#client-intake-and-engagement`,
      parentId: null,
      prefLabel: "Client Intake and Engagement",
      sortKey: "18",
    }),
    concept({
      definition: "Invoices, billing records, fee records, and payment-related matter documents.",
      folderSegment: "billing-and-invoices",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["invoice", "billing", "bill", "fee", "payment"],
      id: "billing-and-invoices",
      iri: `${SCHEME_IRI}#billing-and-invoices`,
      parentId: null,
      prefLabel: "Billing and Invoices",
      sortKey: "19",
    }),
    concept({
      definition: "Time entries, time reports, and timekeeping records.",
      folderSegment: "time-records",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["time-entry", "timesheet", "time-record", "timekeeping"],
      id: "time-records",
      iri: `${SCHEME_IRI}#time-records`,
      parentId: null,
      prefLabel: "Time Records",
      sortKey: "20",
    }),
    concept({
      definition: "Settlement offers, mediation records, arbitration records, and ADR materials.",
      folderSegment: "settlement-and-adr",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["settlement", "mediation", "arbitration", "adr", "term-sheet"],
      id: "settlement-and-adr",
      iri: `${SCHEME_IRI}#settlement-and-adr`,
      parentId: null,
      prefLabel: "Settlement and ADR",
      sortKey: "21",
    }),
    concept({
      definition: "Regulatory submissions, agency filings, permits, responses, and administrative records.",
      folderSegment: "regulatory-and-agency-filings",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["regulatory", "agency", "administrative", "permit", "filing"],
      id: "regulatory-and-agency-filings",
      iri: `${SCHEME_IRI}#regulatory-and-agency-filings`,
      parentId: null,
      prefLabel: "Regulatory and Agency Filings",
      sortKey: "22",
    }),
    concept({
      definition: "Patent, trademark, copyright, and portfolio prosecution records.",
      folderSegment: "ip-prosecution-and-portfolio",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["patent", "trademark", "copyright", "office-action", "portfolio", "prosecution"],
      id: "ip-prosecution-and-portfolio",
      iri: `${SCHEME_IRI}#ip-prosecution-and-portfolio`,
      parentId: null,
      prefLabel: "IP Prosecution and Portfolio",
      sortKey: "23",
    }),
    concept({
      definition: "Corporate records, governance documents, consents, minutes, and board materials.",
      folderSegment: "corporate-and-governance-records",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["corporate", "governance", "consent", "minutes", "board"],
      id: "corporate-and-governance-records",
      iri: `${SCHEME_IRI}#corporate-and-governance-records`,
      parentId: null,
      prefLabel: "Corporate and Governance Records",
      sortKey: "24",
    }),
    concept({
      definition: "Client-provided source materials that are not yet classified as a more specific legal record.",
      folderSegment: "client-source-materials",
      folioAlignment: noFolioConcept,
      heuristicTokens: ["client-source", "source-material", "document", "file"],
      id: "client-source-materials",
      iri: `${SCHEME_IRI}#client-source-materials`,
      parentId: null,
      prefLabel: "Client Source Materials",
      sortKey: "25",
    }),
  ],
  jsonLdContext: legalDocumentTaxonomyJsonLdContext,
  schemaVersion: "0.0.0",
  schemeIri: SCHEME_IRI,
});

/**
 * JSON-LD projection of the deterministic legal document taxonomy seed.
 *
 * @example
 * ```ts
 * import { legalDocumentTaxonomyJsonLd } from "@beep/documents-domain/values/Taxonomy"
 *
 * console.log(legalDocumentTaxonomyJsonLd["@type"])
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalDocumentTaxonomyJsonLd = {
  "@context": legalDocumentTaxonomyJsonLdContext,
  "@graph": legalDocumentTaxonomy.concepts.map((item) => ({
    "@id": item.iri,
    "@type": "skos:Concept",
    "beep:folderSegment": item.folderSegment,
    "beep:heuristicToken": item.heuristicTokens,
    "beep:sortKey": item.sortKey,
    "folio:alignmentKind": item.folioAlignment.kind,
    "skos:broader": item.parentId === null ? undefined : `${SCHEME_IRI}#${item.parentId}`,
    "skos:definition": item.definition,
    "skos:inScheme": SCHEME_IRI,
    "skos:prefLabel": item.prefLabel,
  })),
  "@id": SCHEME_IRI,
  "@type": "skos:ConceptScheme",
} as const;
