/**
 * Repo-owned P1 legal document taxonomy seed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRIReference } from "@beep/rdf";
import { ValidWindowsPlainPathSegment } from "@beep/schema/FilePath";
import { FolioAlignment, LegalDocumentTaxonomy, LegalDocumentTaxonomyConcept } from "./Taxonomy.model.ts";

const SCHEME_IRI = IRIReference.make("https://ns.beep.sh/documents/taxonomy/legal-document");
const FOLIO_SOURCE_IRIS = [
  IRIReference.make("https://github.com/filipdbrskja/FOLIO"),
  IRIReference.make("https://raw.githubusercontent.com/filipdbrskja/FOLIO/master/FOLIO.owl"),
];

const noFolioConcept = FolioAlignment.make({
  conceptIri: null,
  kind: "none",
  sourceIris: FOLIO_SOURCE_IRIS,
});

/**
 * JSON-LD context for the repo-owned legal document taxonomy seed.
 *
 * **Example** (Log SKOS context value)
 *
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
 * **Example** (Log first concept id)
 *
 * ```ts
 * import { legalDocumentTaxonomy } from "@beep/documents-domain/values/Taxonomy"
 *
 * console.log(legalDocumentTaxonomy.concepts[0]?.id)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalDocumentTaxonomy = LegalDocumentTaxonomy.make({
  concepts: [
    LegalDocumentTaxonomyConcept.make({
      definition: "Documents that initiate, answer, amend, or otherwise frame claims and defenses in a matter.",
      folderSegment: ValidWindowsPlainPathSegment.make("pleadings"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["complaint", "answer", "petition", "pleading", "counterclaim", "crossclaim"],
      id: "pleadings",
      iri: IRIReference.make(`${SCHEME_IRI}#pleadings`),
      parentId: null,
      prefLabel: "Pleadings",
      sortKey: "01",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Requests for court or tribunal action, including motions, applications, and supporting papers.",
      folderSegment: ValidWindowsPlainPathSegment.make("motions-and-applications"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["motion", "application", "petition-for", "move", "movant"],
      id: "motions-and-applications",
      iri: IRIReference.make(`${SCHEME_IRI}#motions-and-applications`),
      parentId: null,
      prefLabel: "Motions and Applications",
      sortKey: "02",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Legal argument submitted to a tribunal, including briefs and memoranda of points and authorities.",
      folderSegment: ValidWindowsPlainPathSegment.make("briefs-and-legal-argument"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["brief", "argument", "points-and-authorities", "memorandum-of-law"],
      id: "briefs-and-legal-argument",
      iri: IRIReference.make(`${SCHEME_IRI}#briefs-and-legal-argument`),
      parentId: null,
      prefLabel: "Briefs and Legal Argument",
      sortKey: "03",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Orders, judgments, decrees, and other dispositive or directive tribunal records.",
      folderSegment: ValidWindowsPlainPathSegment.make("court-orders-and-judgments"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["order", "judgment", "decree", "ruling", "minute-order"],
      id: "court-orders-and-judgments",
      iri: IRIReference.make(`${SCHEME_IRI}#court-orders-and-judgments`),
      parentId: null,
      prefLabel: "Court Orders and Judgments",
      sortKey: "04",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Notices, docket entries, certificates, and ministerial filings used to track procedural status.",
      folderSegment: ValidWindowsPlainPathSegment.make("notices-and-docket-filings"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["notice", "docket", "certificate-of-service", "summons", "proof-of-service"],
      id: "notices-and-docket-filings",
      iri: IRIReference.make(`${SCHEME_IRI}#notices-and-docket-filings`),
      parentId: null,
      prefLabel: "Notices and Docket Filings",
      sortKey: "05",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Letters and correspondence exchanged outside chat or email message exports.",
      folderSegment: ValidWindowsPlainPathSegment.make("correspondence"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["letter", "correspondence", "transmittal", "demand-letter"],
      id: "correspondence",
      iri: IRIReference.make(`${SCHEME_IRI}#correspondence`),
      parentId: null,
      prefLabel: "Correspondence",
      sortKey: "06",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Email, message, and chat exports preserved as matter records.",
      folderSegment: ValidWindowsPlainPathSegment.make("email-and-messages"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["email", "message", "chat", "sms", "conversation"],
      id: "email-and-messages",
      iri: IRIReference.make(`${SCHEME_IRI}#email-and-messages`),
      parentId: null,
      prefLabel: "Email and Messages",
      sortKey: "07",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Contracts, agreements, amendments, schedules, and related contractual records.",
      folderSegment: ValidWindowsPlainPathSegment.make("agreements-and-contracts"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["agreement", "contract", "amendment", "nda", "msa", "sow"],
      id: "agreements-and-contracts",
      iri: IRIReference.make(`${SCHEME_IRI}#agreements-and-contracts`),
      parentId: null,
      prefLabel: "Agreements and Contracts",
      sortKey: "08",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Closing binders, transaction deliverables, signature packets, and closing records.",
      folderSegment: ValidWindowsPlainPathSegment.make("closing-and-transaction-records"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["closing", "transaction", "signature-packet", "binder", "deliverables"],
      id: "closing-and-transaction-records",
      iri: IRIReference.make(`${SCHEME_IRI}#closing-and-transaction-records`),
      parentId: null,
      prefLabel: "Closing and Transaction Records",
      sortKey: "09",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Discovery requests, responses, objections, interrogatories, and admission requests.",
      folderSegment: ValidWindowsPlainPathSegment.make("discovery-requests-and-responses"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["discovery", "interrogatories", "request-for-production", "requests-for-admission", "rfa"],
      id: "discovery-requests-and-responses",
      iri: IRIReference.make(`${SCHEME_IRI}#discovery-requests-and-responses`),
      parentId: null,
      prefLabel: "Discovery Requests and Responses",
      sortKey: "10",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Produced documents, production logs, and production-volume artifacts.",
      folderSegment: ValidWindowsPlainPathSegment.make("productions"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["production", "produced", "bates", "load-file", "production-log"],
      id: "productions",
      iri: IRIReference.make(`${SCHEME_IRI}#productions`),
      parentId: null,
      prefLabel: "Productions",
      sortKey: "11",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Deposition notices, transcripts, exhibits, errata, and related materials.",
      folderSegment: ValidWindowsPlainPathSegment.make("deposition-materials"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["deposition", "transcript", "errata", "deponent"],
      id: "deposition-materials",
      iri: IRIReference.make(`${SCHEME_IRI}#deposition-materials`),
      parentId: null,
      prefLabel: "Deposition Materials",
      sortKey: "12",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Subpoenas, third-party requests, process returns, and related non-party records.",
      folderSegment: ValidWindowsPlainPathSegment.make("subpoenas-and-third-party-process"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["subpoena", "third-party", "non-party", "process", "return-of-service"],
      id: "subpoenas-and-third-party-process",
      iri: IRIReference.make(`${SCHEME_IRI}#subpoenas-and-third-party-process`),
      parentId: null,
      prefLabel: "Subpoenas and Third-Party Process",
      sortKey: "13",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Exhibits, evidentiary materials, demonstratives, and authenticated evidence packets.",
      folderSegment: ValidWindowsPlainPathSegment.make("exhibits-and-evidence"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["exhibit", "evidence", "demonstrative", "authenticated", "trial-exhibit"],
      id: "exhibits-and-evidence",
      iri: IRIReference.make(`${SCHEME_IRI}#exhibits-and-evidence`),
      parentId: null,
      prefLabel: "Exhibits and Evidence",
      sortKey: "14",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Expert reports, reliance materials, expert disclosures, and related expert work.",
      folderSegment: ValidWindowsPlainPathSegment.make("expert-materials"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["expert", "expert-report", "reliance", "disclosure", "rebuttal"],
      id: "expert-materials",
      iri: IRIReference.make(`${SCHEME_IRI}#expert-materials`),
      parentId: null,
      prefLabel: "Expert Materials",
      sortKey: "15",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Legal research, analysis, and attorney memoranda not intended as filed briefs.",
      folderSegment: ValidWindowsPlainPathSegment.make("memoranda-and-legal-research"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["research", "memo", "memorandum", "case-law", "legal-analysis"],
      id: "memoranda-and-legal-research",
      iri: IRIReference.make(`${SCHEME_IRI}#memoranda-and-legal-research`),
      parentId: null,
      prefLabel: "Memoranda and Legal Research",
      sortKey: "16",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Attorney notes, work product, strategy records, and internal matter analysis.",
      folderSegment: ValidWindowsPlainPathSegment.make("attorney-work-product-and-notes"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["work-product", "notes", "strategy", "internal-analysis", "attorney-notes"],
      id: "attorney-work-product-and-notes",
      iri: IRIReference.make(`${SCHEME_IRI}#attorney-work-product-and-notes`),
      parentId: null,
      prefLabel: "Attorney Work Product and Notes",
      sortKey: "17",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Engagement letters, intake questionnaires, conflict records, and client onboarding files.",
      folderSegment: ValidWindowsPlainPathSegment.make("client-intake-and-engagement"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["intake", "engagement", "conflict", "onboarding", "retainer"],
      id: "client-intake-and-engagement",
      iri: IRIReference.make(`${SCHEME_IRI}#client-intake-and-engagement`),
      parentId: null,
      prefLabel: "Client Intake and Engagement",
      sortKey: "18",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Invoices, billing records, fee records, and payment-related matter documents.",
      folderSegment: ValidWindowsPlainPathSegment.make("billing-and-invoices"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["invoice", "billing", "bill", "fee", "payment"],
      id: "billing-and-invoices",
      iri: IRIReference.make(`${SCHEME_IRI}#billing-and-invoices`),
      parentId: null,
      prefLabel: "Billing and Invoices",
      sortKey: "19",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Time entries, time reports, and timekeeping records.",
      folderSegment: ValidWindowsPlainPathSegment.make("time-records"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["time-entry", "timesheet", "time-record", "timekeeping"],
      id: "time-records",
      iri: IRIReference.make(`${SCHEME_IRI}#time-records`),
      parentId: null,
      prefLabel: "Time Records",
      sortKey: "20",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Settlement offers, mediation records, arbitration records, and ADR materials.",
      folderSegment: ValidWindowsPlainPathSegment.make("settlement-and-adr"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["settlement", "mediation", "arbitration", "adr", "term-sheet"],
      id: "settlement-and-adr",
      iri: IRIReference.make(`${SCHEME_IRI}#settlement-and-adr`),
      parentId: null,
      prefLabel: "Settlement and ADR",
      sortKey: "21",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Regulatory submissions, agency filings, permits, responses, and administrative records.",
      folderSegment: ValidWindowsPlainPathSegment.make("regulatory-and-agency-filings"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["regulatory", "agency", "administrative", "permit", "filing"],
      id: "regulatory-and-agency-filings",
      iri: IRIReference.make(`${SCHEME_IRI}#regulatory-and-agency-filings`),
      parentId: null,
      prefLabel: "Regulatory and Agency Filings",
      sortKey: "22",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Patent, trademark, copyright, and portfolio prosecution records.",
      folderSegment: ValidWindowsPlainPathSegment.make("ip-prosecution-and-portfolio"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["patent", "trademark", "copyright", "office-action", "portfolio", "prosecution"],
      id: "ip-prosecution-and-portfolio",
      iri: IRIReference.make(`${SCHEME_IRI}#ip-prosecution-and-portfolio`),
      parentId: null,
      prefLabel: "IP Prosecution and Portfolio",
      sortKey: "23",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Corporate records, governance documents, consents, minutes, and board materials.",
      folderSegment: ValidWindowsPlainPathSegment.make("corporate-and-governance-records"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["corporate", "governance", "consent", "minutes", "board"],
      id: "corporate-and-governance-records",
      iri: IRIReference.make(`${SCHEME_IRI}#corporate-and-governance-records`),
      parentId: null,
      prefLabel: "Corporate and Governance Records",
      sortKey: "24",
    }),
    LegalDocumentTaxonomyConcept.make({
      definition: "Client-provided source materials that are not yet classified as a more specific legal record.",
      folderSegment: ValidWindowsPlainPathSegment.make("client-source-materials"),
      folioAlignment: noFolioConcept,
      heuristicTokens: ["client-source", "source-material", "document", "file"],
      id: "client-source-materials",
      iri: IRIReference.make(`${SCHEME_IRI}#client-source-materials`),
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
 * **Example** (Log JSON-LD type)
 *
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
