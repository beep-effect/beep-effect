/**
 * Committed repository-owned SKOS vocabularies for pinned consumer lookup.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SemanticFoundationId } from "@beep/identity/packages";
import { IRIReference } from "@beep/rdf";
import { VocabularyConcept, VocabularySeed } from "./Vocabulary.models.ts";

const DocketingVocabularyScheme = $SemanticFoundationId.create("vocabulary/docketing");
/**
 * Version 1.0.0 of the docketing vocabulary, with stable concept identity.
 *
 * **Example** (Inspect the pinned scheme)
 * ```ts
 * import { DocketingVocabulary } from "@beep/ontology/Vocabulary.seed"
 * console.log(DocketingVocabulary.version)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const DocketingVocabulary = VocabularySeed.make({
  kind: "docketing",
  version: "1.0.0",
  title: "Docketing vocabulary",
  schemeIri: IRIReference.make(DocketingVocabularyScheme.iri),
  concepts: [
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri),
      notation: "Deadline",
      prefLabel: "Deadline",
      definition: "A docket target for an action associated with a matter, authority and supporting evidence.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote: "Authority periods are contextual; no date is calculated.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/DocketingEvent").iri),
      notation: "DocketingEvent",
      prefLabel: "Docketing event",
      definition: "An observed occurrence supporting creation, revision or satisfaction of a docket target.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote: "An occurrence differs from a planned deadline.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri),
      notation: "StatutoryDueDate",
      prefLabel: "Statutory due date",
      definition: "A docket target anchored in an applicable statute or rule.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote: "35 USC 133 and applicable procedural rules; jurisdiction must be supplied.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/SoftDueDate").iri),
      notation: "SoftDueDate",
      prefLabel: "Soft due date",
      definition: "An internal planning target chosen before an applicable external due date.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote: "Repository planning concept; not a statutory obligation.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/OfficeActionResponseDeadline").iri),
      notation: "OfficeActionResponseDeadline",
      prefLabel: "Patent office-action response deadline",
      definition: "A target for responding to an office action in patent prosecution.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote: "35 USC 133; 37 CFR 1.134 and 1.136.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/MaintenanceFeeDeadline").iri),
      notation: "MaintenanceFeeDeadline",
      prefLabel: "Maintenance fee deadline",
      definition: "A target for paying a fee required to maintain an eligible patent.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s2504.html"),
      sourceNote: "35 USC 41(b); 37 CFR 1.362.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/AnnuityDeadline").iri),
      notation: "AnnuityDeadline",
      prefLabel: "Annuity deadline",
      definition: "A jurisdiction-specific target for a periodic patent renewal fee.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make("https://www.wipo.int/en/web/pct-system/fees/index"),
      sourceNote: "National-phase jurisdiction and applicable national law are required; no US annual-fee inference.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/IDSDeadline").iri),
      notation: "IDSDeadline",
      prefLabel: "IDS deadline",
      definition: "A target for submitting an information disclosure statement in patent prosecution.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s609.html"),
      sourceNote: "37 CFR 1.97 and 1.98; timing depends on prosecution context.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/RCEDueDate").iri),
      notation: "RCEDueDate",
      prefLabel: "RCE due date",
      definition: "A target for requesting continued examination in a pending patent matter.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s706.html"),
      sourceNote: "37 CFR 1.114; context determines whether and when an RCE is appropriate.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/AppealDeadline").iri),
      notation: "AppealDeadline",
      prefLabel: "Appeal deadline",
      definition: "A target for initiating or progressing an appeal in a patent matter.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s1204.html"),
      sourceNote: "37 CFR 41.31; the particular appeal action is recorded by the consumer.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/ContinuationDeadline").iri),
      notation: "ContinuationDeadline",
      prefLabel: "Continuation deadline",
      definition:
        "A target for filing a continuing patent application while the relevant benefit conditions remain available.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s211.html"),
      sourceNote: "35 USC 120; 37 CFR 1.78; no pendency calculation.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/NationalStageDeadline").iri),
      notation: "NationalStageDeadline",
      prefLabel: "National-stage deadline",
      definition: "A target for completing national-stage entry requirements for an international application.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s1893.html"),
      sourceNote: "35 USC 371; jurisdiction and applicable requirements must be pinned.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/StatementOfUseDeadline").iri),
      notation: "StatementOfUseDeadline",
      prefLabel: "Statement-of-use deadline",
      definition: "A target for submitting a statement of use for an intent-to-use trademark application.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/trademarks/apply/intent-use-itu-applications"),
      sourceNote: "15 USC 1051(d); 37 CFR 2.88 and 2.89.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/Section8Deadline").iri),
      notation: "Section8Deadline",
      prefLabel: "Section 8 deadline",
      definition: "A target for a declaration of use or excusable nonuse to maintain a trademark registration.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/trademarks/basics/maintaining-registration"),
      sourceNote: "15 USC 1058; distinct from renewal and incontestability.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/Section9RenewalDeadline").iri),
      notation: "Section9RenewalDeadline",
      prefLabel: "Section 9 renewal deadline",
      definition: "A target for an application to renew a trademark registration.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/TrademarkRenewalDeadline").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/trademarks/basics/maintaining-registration"),
      sourceNote: "15 USC 1059; combined filings do not merge the obligation types.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/Section15DeclarationDeadline").iri),
      notation: "Section15DeclarationDeadline",
      prefLabel: "Section 15 declaration target",
      definition:
        "A chosen docket target for an elective declaration of incontestability when eligibility conditions apply.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make(
        "https://www.uspto.gov/trademarks/trademark-timelines/post-registration-timeline-all-registrations-except-madrid-protocol"
      ),
      sourceNote: "15 USC 1065; not a universally mandatory statutory filing deadline.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/TrademarkOfficeActionResponseDeadline").iri),
      notation: "TrademarkOfficeActionResponseDeadline",
      prefLabel: "Trademark office-action response deadline",
      definition: "A target for responding to an office action in trademark examination.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/trademarks/apply/response-time-period"),
      sourceNote: "37 CFR 2.62; the issued action and application basis determine the period.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/OppositionDeadline").iri),
      notation: "OppositionDeadline",
      prefLabel: "Trademark opposition deadline",
      definition: "A target for opposing publication of a trademark application or requesting an applicable extension.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri)],
      sourceIri: IRIReference.make(
        "https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap22-subchapI-sec1063.htm"
      ),
      sourceNote: "15 USC 1063; no opposition-period arithmetic.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/TrademarkRenewalDeadline").iri),
      notation: "TrademarkRenewalDeadline",
      prefLabel: "Trademark renewal deadline",
      definition: "A jurisdiction-specific target for renewing a trademark registration.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/StatutoryDueDate").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/trademarks/basics/maintaining-registration"),
      sourceNote: "US renewal is under 15 USC 1059; other jurisdictions require their own authority.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/TrademarkApplicationDeadline").iri),
      notation: "TrademarkApplicationDeadline",
      prefLabel: "Trademark application deadline",
      definition: "A docket target for a trademark application filing or application-stage requirement.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/Deadline").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/trademarks/basics/trademark-process"),
      sourceNote: "A specific filing basis and authority are required; no universal application deadline is asserted.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/DeadlineState").iri),
      notation: "DeadlineState",
      prefLabel: "Deadline state",
      definition: "A recorded status of a docket target, supported by a consumer-owned observation.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote:
        "Repository status vocabulary; no legal conclusion is derived. Status descriptors may overlap; no exclusive state partition is asserted.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/OpenDeadlineState").iri),
      notation: "OpenDeadlineState",
      prefLabel: "Open deadline state",
      definition: "A recorded target awaiting its specified action, whether mandatory or elective.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/DeadlineState").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote:
        "Repository state label; does not establish remaining time. Status descriptors may overlap; no exclusive state partition is asserted.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/ExtendedDeadlineState").iri),
      notation: "ExtendedDeadlineState",
      prefLabel: "Extended deadline state",
      definition: "A recorded target whose authority or evidence supports an extension.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/DeadlineState").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/trademarks/apply/response-time-period"),
      sourceNote:
        "Extension evidence is required; the vocabulary itself grants no extension. Status descriptors may overlap; no exclusive state partition is asserted.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/FinalDeadlineState").iri),
      notation: "FinalDeadlineState",
      prefLabel: "Final deadline state",
      definition: "A recorded target identified by supporting evidence as the final applicable target.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/DeadlineState").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote:
        "Deadline finality differs from a final office action; neither is inferred from this label. Status descriptors may overlap; no exclusive state partition is asserted.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(DocketingVocabularyScheme.create("concept/MissedDeadlineState").iri),
      notation: "MissedDeadlineState",
      prefLabel: "Missed deadline state",
      definition: "A recorded target whose supporting observation reports that the action was not timely completed.",
      broader: [IRIReference.make(DocketingVocabularyScheme.create("concept/DeadlineState").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s710.html"),
      sourceNote:
        "The consumer owns the observation, date and any remedial analysis. Status descriptors may overlap; no exclusive state partition is asserted.",
      alignments: [],
    }),
  ],
});
const PartyKindVocabularyScheme = $SemanticFoundationId.create("vocabulary/party-kinds");
/**
 * Version 1.0.0 of the party kind vocabulary, with stable concept identity.
 *
 * **Example** (Inspect the pinned scheme)
 * ```ts
 * import { PartyKindVocabulary } from "@beep/ontology/Vocabulary.seed"
 * console.log(PartyKindVocabulary.version)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const PartyKindVocabulary = VocabularySeed.make({
  kind: "party-kinds",
  version: "1.0.0",
  title: "Party kind vocabulary",
  schemeIri: IRIReference.make(PartyKindVocabularyScheme.iri),
  concepts: [
    VocabularyConcept.make({
      iri: IRIReference.make(PartyKindVocabularyScheme.create("concept/Party").iri),
      notation: "Party",
      prefLabel: "Party",
      definition: "A real-world person or organization identified independently of its legal roles.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s605.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(PartyKindVocabularyScheme.create("concept/NaturalPersonParty").iri),
      notation: "NaturalPersonParty",
      prefLabel: "Natural person party",
      definition: "A human party whose identity persists across matters and role changes.",
      broader: [IRIReference.make(PartyKindVocabularyScheme.create("concept/Party").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s605.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(PartyKindVocabularyScheme.create("concept/OrganizationParty").iri),
      notation: "OrganizationParty",
      prefLabel: "Organization party",
      definition: "An institutional party whose identity persists across changes of personnel and legal roles.",
      broader: [IRIReference.make(PartyKindVocabularyScheme.create("concept/Party").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s605.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(PartyKindVocabularyScheme.create("concept/LawFirm").iri),
      notation: "LawFirm",
      prefLabel: "Law firm",
      definition: "An organization identified as a provider of legal professional services.",
      broader: [IRIReference.make(PartyKindVocabularyScheme.create("concept/OrganizationParty").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s605.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(PartyKindVocabularyScheme.create("concept/PatentOffice").iri),
      notation: "PatentOffice",
      prefLabel: "Patent office",
      definition: "An institution identified as an authority administering patent procedures.",
      broader: [IRIReference.make(PartyKindVocabularyScheme.create("concept/OrganizationParty").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s605.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(PartyKindVocabularyScheme.create("concept/TrademarkOffice").iri),
      notation: "TrademarkOffice",
      prefLabel: "Trademark office",
      definition: "An institution identified as an authority administering trademark procedures.",
      broader: [IRIReference.make(PartyKindVocabularyScheme.create("concept/OrganizationParty").iri)],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s605.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
  ],
});
const LegalRoleVocabularyScheme = $SemanticFoundationId.create("vocabulary/legal-roles");
/**
 * Version 1.0.0 of the legal role vocabulary, with stable concept identity.
 *
 * **Example** (Inspect the pinned scheme)
 * ```ts
 * import { LegalRoleVocabulary } from "@beep/ontology/Vocabulary.seed"
 * console.log(LegalRoleVocabulary.version)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const LegalRoleVocabulary = VocabularySeed.make({
  kind: "legal-roles",
  version: "1.0.0",
  title: "Legal role vocabulary",
  schemeIri: IRIReference.make(LegalRoleVocabularyScheme.iri),
  concepts: [
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/InventorRole").iri),
      notation: "InventorRole",
      prefLabel: "Inventor role",
      definition:
        "A contextual role attributing conception of a specified invention to a natural person on supporting evidence.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s2109.html"),
      sourceNote: "35 USC 100(f).",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/ApplicantRole").iri),
      notation: "ApplicantRole",
      prefLabel: "Applicant role",
      definition: "A contextual role identifying the party applying in a specified patent or trademark matter.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s605.html"),
      sourceNote:
        "35 USC 118; 37 CFR 1.42. This patent source supplies patent context only; trademark applicability requires separate authority evidence.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/AssigneeRole").iri),
      notation: "AssigneeRole",
      prefLabel: "Assignee role",
      definition: "A contextual role identifying a party to which rights are transferred by an assignment.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s301.html"),
      sourceNote: "35 USC 261.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/OwnerRole").iri),
      notation: "OwnerRole",
      prefLabel: "Owner role",
      definition: "A contextual role identifying a party holding rights in a specified asset.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s301.html"),
      sourceNote:
        "35 USC 261; 15 USC 1058. This patent source supplies patent context only; trademark applicability requires separate authority evidence.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/ExaminerRole").iri),
      notation: "ExaminerRole",
      prefLabel: "Examiner role",
      definition: "A contextual role identifying the official examining a specified application or proceeding.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s707.html"),
      sourceNote: "35 USC 131.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/AttorneyOfRecordRole").iri),
      notation: "AttorneyOfRecordRole",
      prefLabel: "Attorney of record role",
      definition:
        "A contextual role identifying the practitioner recorded as representing a party in a specified matter.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s402.html"),
      sourceNote:
        "37 CFR 1.32; 37 CFR 2.17. This patent source supplies patent context only; trademark applicability requires separate authority evidence.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/CorrespondentRole").iri),
      notation: "CorrespondentRole",
      prefLabel: "Correspondent role",
      definition: "A contextual role identifying the designated recipient or sender of matter correspondence.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s403.html"),
      sourceNote: "37 CFR 1.33.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/ClientContactRole").iri),
      notation: "ClientContactRole",
      prefLabel: "Client contact role",
      definition: "A contextual role identifying a party designated as a client communication contact.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s403.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/SignerRole").iri),
      notation: "SignerRole",
      prefLabel: "Signer role",
      definition: "A contextual role identifying the party signing a specified document or submission.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s502.html"),
      sourceNote: "37 CFR 1.4(d).",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/LicenseeRole").iri),
      notation: "LicenseeRole",
      prefLabel: "Licensee role",
      definition: "A contextual role identifying a party receiving permission under a specified licence.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s301.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
    VocabularyConcept.make({
      iri: IRIReference.make(LegalRoleVocabularyScheme.create("concept/LicensorRole").iri),
      notation: "LicensorRole",
      prefLabel: "Licensor role",
      definition: "A contextual role identifying a party granting permission under a specified licence.",
      broader: [],
      sourceIri: IRIReference.make("https://www.uspto.gov/web/offices/pac/mpep/s301.html"),
      sourceNote:
        "Repository definition; this public authority provides procedural context, not a universal definition. Scope and supporting evidence are consumer-owned.",
      alignments: [],
    }),
  ],
});
