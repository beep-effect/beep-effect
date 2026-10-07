/**
 * Identification values and private pipeline boundary codecs.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { practiceKgDocketCountryCodes } from "../PracticeKg.matter-lookup.ts";

const $I = $LawPracticeUseCasesId.create("DocumentIdentification/Identification.schemas");
const optional = <T extends S.Top>(schema: T) => S.OptionFromNullOr(schema);
/**
 * Origin format of a contact card.
 *
 * **Example** (Inspect ContactSource)
 *
 * ```ts
 * import { ContactSource } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ContactSource)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContactSource = LiteralKit(["outlook-csv", "vcard"]).pipe(
  $I.annoteSchema("ContactSource", { description: "Origin format of a contact card." })
);
/**
 * Runtime type of {@link ContactSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type ContactSource = typeof ContactSource.Type;
/**
 * Provenance of a contact link.
 *
 * **Example** (Inspect ContactLinkSource)
 *
 * ```ts
 * import { ContactLinkSource } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ContactLinkSource)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContactLinkSource = LiteralKit([
  "attorney-answer",
  "attorney-pc-folder",
  "attorney-docket-sheet",
  "attorney-filed-email",
  "org-name-match",
  "email-subject-ref",
]).pipe($I.annoteSchema("ContactLinkSource", { description: "Provenance of a contact link." }));
/**
 * Runtime type of {@link ContactLinkSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type ContactLinkSource = typeof ContactLinkSource.Type;
/**
 * Provenance of a client index assertion.
 *
 * **Example** (Inspect IndexSource)
 *
 * ```ts
 * import { IndexSource } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(IndexSource)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IndexSource = LiteralKit([
  "attorney-answer",
  "attorney-pc-folder",
  "attorney-docket-sheet",
  "attorney-filed-email",
  "kg-register",
  "org-name-match",
  "email-subject-ref",
]).pipe($I.annoteSchema("IndexSource", { description: "Provenance of a client index assertion." }));
/**
 * Runtime type of {@link IndexSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type IndexSource = typeof IndexSource.Type;
/**
 * Five-digit practice client number.
 *
 * **Example** (Inspect ClientNumber)
 *
 * ```ts
 * import { ClientNumber } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ClientNumber)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClientNumber = S.String.check(S.isPattern(/^[0-9]{5}$/u)).pipe(
  S.brand("ClientNumber"),
  $I.annoteSchema("ClientNumber", { description: "Five-digit practice client number." })
);
/**
 * Runtime type of {@link ClientNumber}.
 *
 * @category models
 * @since 0.0.0
 */
export type ClientNumber = typeof ClientNumber.Type;
/**
 * Client-relative docket identifier using KG country stages.
 *
 * **Example** (Inspect DocketId)
 *
 * ```ts
 * import { DocketId } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(DocketId)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocketId = S.String.check(
  S.isPattern(
    new RegExp(`^[0-9]{5,6}(?:${A.join(practiceKgDocketCountryCodes, "|")})[0-9]{0,3}(?:-[A-Z]{2}[0-9]+)?$`, "u")
  )
).pipe(
  S.brand("DocketId"),
  $I.annoteSchema("DocketId", { description: "Client-relative docket identifier using KG country stages." })
);
/**
 * Runtime type of {@link DocketId}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocketId = typeof DocketId.Type;
/**
 * Numbered client or input-supplied named pseudo-client key.
 *
 * **Example** (Inspect ClientKey)
 *
 * ```ts
 * import { ClientKey } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ClientKey)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClientKey = S.Union([ClientNumber, S.String.check(S.isPattern(/^new:[^\s].*$/u))]).pipe(
  $I.annoteSchema("ClientKey", { description: "Numbered client or input-supplied named pseudo-client key." })
);
/**
 * Runtime type of {@link ClientKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type ClientKey = typeof ClientKey.Type;
/**
 * Lowercase SHA-256 content digest.
 *
 * **Example** (Inspect ContentHash)
 *
 * ```ts
 * import { ContentHash } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ContentHash)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentHash = S.String.check(S.isPattern(/^[0-9a-f]{64}$/u)).pipe(
  S.brand("IdentificationContentHash"),
  $I.annoteSchema("ContentHash", { description: "Lowercase SHA-256 content digest." })
);
/**
 * Runtime type of {@link ContentHash}.
 *
 * @category models
 * @since 0.0.0
 */
export type ContentHash = typeof ContentHash.Type;
/**
 * Normalised email address with shared mailbox status.
 *
 * **Example** (Inspect ContactEmail)
 *
 * ```ts
 * import { ContactEmail } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ContactEmail)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ContactEmail extends S.Class<ContactEmail>($I`ContactEmail`)(
  {
    address: S.String.check(S.isTrimmed(), S.isLowercased(), S.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u)),
    role: S.Boolean,
  },
  $I.annote("ContactEmail", { description: "Normalised email address with shared mailbox status." })
) {}
/**
 * E.164 telephone number and optional NANP area code.
 *
 * **Example** (Inspect PhoneNumber)
 *
 * ```ts
 * import { PhoneNumber } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(PhoneNumber)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PhoneNumber extends S.Class<PhoneNumber>($I`PhoneNumber`)(
  {
    e164: S.String.check(S.isPattern(/^\+[1-9][0-9]{7,14}$/u)),
    areaCode: optional(S.String.check(S.isPattern(/^[2-9][0-9]{2}$/u))),
  },
  $I.annote("PhoneNumber", { description: "E.164 telephone number and optional NANP area code." })
) {}
/**
 * Contact attribution with source and log-safe evidence description.
 *
 * **Example** (Inspect ContactLink)
 *
 * ```ts
 * import { ContactLink } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ContactLink)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ContactLink extends S.Class<ContactLink>($I`ContactLink`)(
  {
    clientNumber: ClientNumber,
    familyKey: optional(S.NonEmptyString),
    source: ContactLinkSource,
    evidence: S.NonEmptyString,
  },
  $I.annote("ContactLink", { description: "Contact attribution with source and log-safe evidence description." })
) {}
/**
 * Unnormalised card read from a private contact source.
 *
 * **Example** (Inspect RawContactCard)
 *
 * ```ts
 * import { RawContactCard } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(RawContactCard)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RawContactCard extends S.Class<RawContactCard>($I`RawContactCard`)(
  {
    displayName: S.String,
    organization: optional(S.NonEmptyString),
    titles: S.Array(S.String),
    emails: S.Array(S.String),
    phones: S.Array(S.String),
    addresses: S.Array(S.String),
    source: ContactSource,
  },
  $I.annote("RawContactCard", { description: "Unnormalised card read from a private contact source." })
) {}
/**
 * Deduplicated person or organisation with stable identifier.
 *
 * **Example** (Inspect Contact)
 *
 * ```ts
 * import { Contact } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(Contact)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Contact extends S.Class<Contact>($I`Contact`)(
  {
    contactId: ContentHash,
    displayName: S.String,
    organization: optional(S.NonEmptyString),
    titles: S.Array(S.String),
    emails: S.Array(ContactEmail),
    domains: S.Array(S.String),
    phones: S.Array(PhoneNumber),
    addresses: S.Array(S.String),
    sources: S.Array(ContactSource),
    links: S.Array(ContactLink),
  },
  $I.annote("Contact", { description: "Deduplicated person or organisation with stable identifier." })
) {}
/**
 * Contact projection excluding telephone and postal address data.
 *
 * **Example** (Inspect ContactProjection)
 *
 * ```ts
 * import { ContactProjection } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ContactProjection)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ContactProjection extends S.Class<ContactProjection>($I`ContactProjection`)(
  {
    contactId: ContentHash,
    displayName: S.String,
    organization: optional(S.NonEmptyString),
    emails: S.Array(ContactEmail),
    sources: S.Array(ContactSource),
    links: S.Array(ContactLink),
  },
  $I.annote("ContactProjection", { description: "Contact projection excluding telephone and postal address data." })
) {}
/**
 * Count of assertions from one provenance source.
 *
 * **Example** (Inspect SourceCount)
 *
 * ```ts
 * import { SourceCount } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(SourceCount)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SourceCount extends S.Class<SourceCount>($I`SourceCount`)(
  {
    source: IndexSource,
    count: S.Natural,
  },
  $I.annote("SourceCount", { description: "Count of assertions from one provenance source." })
) {}
/**
 * Known client and docket pair; docket alone never identifies a client.
 *
 * **Example** (Inspect ClientDocketPair)
 *
 * ```ts
 * import { ClientDocketPair } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ClientDocketPair)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClientDocketPair extends S.Class<ClientDocketPair>($I`ClientDocketPair`)(
  {
    clientNumber: ClientNumber,
    docket: DocketId,
    sources: S.Array(SourceCount),
  },
  $I.annote("ClientDocketPair", {
    description: "Known client and docket pair; docket alone never identifies a client.",
  })
) {}
/**
 * Client name with provenance.
 *
 * **Example** (Inspect ClientName)
 *
 * ```ts
 * import { ClientName } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ClientName)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClientName extends S.Class<ClientName>($I`ClientName`)(
  {
    name: S.NonEmptyString,
    source: IndexSource,
  },
  $I.annote("ClientName", { description: "Client name with provenance." })
) {}
/**
 * Known names and input folder names for a numbered client.
 *
 * **Example** (Inspect ClientIndexEntry)
 *
 * ```ts
 * import { ClientIndexEntry } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ClientIndexEntry)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClientIndexEntry extends S.Class<ClientIndexEntry>($I`ClientIndexEntry`)(
  {
    clientNumber: ClientNumber,
    names: S.Array(ClientName),
    folders: S.Array(S.String),
  },
  $I.annote("ClientIndexEntry", { description: "Known names and input folder names for a numbered client." })
) {}
/**
 * Input assertion from answers, folders, docket sheet, KG or email subjects.
 *
 * **Example** (Inspect IndexEvidence)
 *
 * ```ts
 * import { IndexEvidence } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(IndexEvidence)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IndexEvidence extends S.Class<IndexEvidence>($I`IndexEvidence`)(
  {
    clientNumber: optional(ClientNumber),
    names: S.Array(S.String),
    references: S.Array(S.String),
    folders: S.Array(S.String),
    emails: S.Array(S.String),
    contactIds: S.Array(ContentHash),
    source: IndexSource,
  },
  $I.annote("IndexEvidence", {
    description: "Input assertion from answers, folders, docket sheet, KG or email subjects.",
  })
) {}
/**
 * Private index output consumed by resolution and evaluation.
 *
 * **Example** (Inspect IdentificationIndex)
 *
 * ```ts
 * import { IdentificationIndex } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(IdentificationIndex)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IdentificationIndex extends S.Class<IdentificationIndex>($I`IdentificationIndex`)(
  {
    clients: S.Array(ClientIndexEntry),
    pairs: S.Array(ClientDocketPair),
    contacts: S.Array(Contact),
  },
  $I.annote("IdentificationIndex", { description: "Private index output consumed by resolution and evaluation." })
) {}
/**
 * Kind of extracted party.
 *
 * **Example** (Inspect PartyKind)
 *
 * ```ts
 * import { PartyKind } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(PartyKind)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PartyKind = LiteralKit(["person", "organization"]).pipe(
  $I.annoteSchema("PartyKind", { description: "Kind of extracted party." })
);
/**
 * Runtime type of {@link PartyKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type PartyKind = typeof PartyKind.Type;
/**
 * Document role of a quoted party.
 *
 * **Example** (Inspect PartyRole)
 *
 * ```ts
 * import { PartyRole } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(PartyRole)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PartyRole = LiteralKit([
  "applicant",
  "inventor",
  "assignee",
  "assignor",
  "client",
  "counterparty",
  "addressee",
  "signatory",
  "author",
  "recipient",
  "other",
]).pipe($I.annoteSchema("PartyRole", { description: "Document role of a quoted party." }));
/**
 * Runtime type of {@link PartyRole}.
 *
 * @category models
 * @since 0.0.0
 */
export type PartyRole = typeof PartyRole.Type;
/**
 * Extractor and critic document classification.
 *
 * **Example** (Inspect DocumentType)
 *
 * ```ts
 * import { DocumentType } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(DocumentType)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentType = LiteralKit([
  "agreement",
  "assignment",
  "declaration-or-power",
  "correspondence-letter",
  "email",
  "office-action",
  "response-or-amendment",
  "application-or-specification",
  "claims",
  "drawings",
  "invoice-or-billing",
  "search-or-opinion",
  "filing-receipt-or-notice",
  "form",
  "note-or-memo",
  "other",
]).pipe($I.annoteSchema("DocumentType", { description: "Extractor and critic document classification." }));
/**
 * Runtime type of {@link DocumentType}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentType = typeof DocumentType.Type;
/**
 * Quoted party claim subject to independent critic confirmation.
 *
 * **Example** (Inspect ExtractedParty)
 *
 * ```ts
 * import { ExtractedParty } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ExtractedParty)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExtractedParty extends S.Class<ExtractedParty>($I`ExtractedParty`)(
  {
    name: S.NonEmptyString,
    kind: PartyKind,
    role: PartyRole,
    quote: S.NonEmptyString,
  },
  $I.annote("ExtractedParty", { description: "Quoted party claim subject to independent critic confirmation." })
) {}
/**
 * Verbatim docket string with its source quote.
 *
 * **Example** (Inspect ExtractedDocket)
 *
 * ```ts
 * import { ExtractedDocket } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ExtractedDocket)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExtractedDocket extends S.Class<ExtractedDocket>($I`ExtractedDocket`)(
  {
    text: S.NonEmptyString,
    quote: S.NonEmptyString,
  },
  $I.annote("ExtractedDocket", { description: "Verbatim docket string with its source quote." })
) {}
/**
 * Extractor facts kept private; quotes never appear in resolution outputs.
 *
 * **Example** (Inspect DocumentExtraction)
 *
 * ```ts
 * import { DocumentExtraction } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(DocumentExtraction)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DocumentExtraction extends S.Class<DocumentExtraction>($I`DocumentExtraction`)(
  {
    docType: DocumentType,
    title: optional(S.String),
    parties: S.Array(ExtractedParty),
    dockets: S.Array(ExtractedDocket),
    applicationNumbers: S.Array(S.String),
    patentNumbers: S.Array(S.String),
    emails: S.Array(S.String),
    dates: S.Array(S.String),
  },
  $I.annote("DocumentExtraction", {
    description: "Extractor facts kept private; quotes never appear in resolution outputs.",
  })
) {}
/**
 * Independent critic accepted indexes and corrected document type.
 *
 * **Example** (Inspect CriticVerdict)
 *
 * ```ts
 * import { CriticVerdict } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(CriticVerdict)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CriticVerdict extends S.Class<CriticVerdict>($I`CriticVerdict`)(
  {
    keepParties: S.Array(S.Natural),
    keepDockets: S.Array(S.Natural),
    docType: DocumentType,
    problems: S.Array(S.String),
  },
  $I.annote("CriticVerdict", { description: "Independent critic accepted indexes and corrected document type." })
) {}
/**
 * Paired extractor and critic output for one document.
 *
 * **Example** (Inspect ConfirmedExtraction)
 *
 * ```ts
 * import { ConfirmedExtraction } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ConfirmedExtraction)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConfirmedExtraction extends S.Class<ConfirmedExtraction>($I`ConfirmedExtraction`)(
  {
    extraction: DocumentExtraction,
    verdict: CriticVerdict,
  },
  $I.annote("ConfirmedExtraction", { description: "Paired extractor and critic output for one document." })
) {}
/**
 * Canonical nested extractor JSONL record.
 *
 * **Example** (Inspect ExtractionRecord)
 *
 * ```ts
 * import { ExtractionRecord } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ExtractionRecord)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExtractionRecord extends S.Class<ExtractionRecord>($I`ExtractionRecord`)(
  {
    id: S.NonEmptyString,
    extraction: DocumentExtraction,
  },
  $I.annote("ExtractionRecord", { description: "Canonical nested extractor JSONL record." })
) {}
/**
 * Canonical nested critic JSONL record.
 *
 * **Example** (Inspect CriticRecord)
 *
 * ```ts
 * import { CriticRecord } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(CriticRecord)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CriticRecord extends S.Class<CriticRecord>($I`CriticRecord`)(
  {
    id: S.NonEmptyString,
    verdict: CriticVerdict,
  },
  $I.annote("CriticRecord", { description: "Canonical nested critic JSONL record." })
) {}
/**
 * Log-safe identification signal kind.
 *
 * **Example** (Inspect EvidenceKind)
 *
 * ```ts
 * import { EvidenceKind } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(EvidenceKind)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceKind = LiteralKit([
  "identical-copy",
  "full-reference",
  "uspto-docket",
  "uspto-applicant",
  "contact-address",
  "contact-domain",
  "contact-phone",
  "contact-name",
  "client-name",
  "learned-name",
  "known-pair",
  "attorney-answer",
  "organisation-form",
  "organisation-firm",
]).pipe($I.annoteSchema("EvidenceKind", { description: "Log-safe identification signal kind." }));
/**
 * Runtime type of {@link EvidenceKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type EvidenceKind = typeof EvidenceKind.Type;
/**
 * One reason containing identifiers or counts, never document text.
 *
 * **Example** (Inspect EvidenceLine)
 *
 * ```ts
 * import { EvidenceLine } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(EvidenceLine)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EvidenceLine extends S.Class<EvidenceLine>($I`EvidenceLine`)(
  {
    kind: EvidenceKind,
    detail: S.NonEmptyString,
  },
  $I.annote("EvidenceLine", { description: "One reason containing identifiers or counts, never document text." })
) {}
/**
 * Measured confidence tier of a document attribution.
 *
 * **Example** (Inspect ConfidenceTier)
 *
 * ```ts
 * import { ConfidenceTier } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ConfidenceTier)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConfidenceTier = LiteralKit([
  "identified",
  "identified-content",
  "candidate",
  "ambiguous",
  "unknown",
]).pipe($I.annoteSchema("ConfidenceTier", { description: "Measured confidence tier of a document attribution." }));
/**
 * Runtime type of {@link ConfidenceTier}.
 *
 * @category models
 * @since 0.0.0
 */
export type ConfidenceTier = typeof ConfidenceTier.Type;
/**
 * Resolution retaining ambiguity rather than guessing a client or docket.
 *
 * **Example** (Inspect Resolution)
 *
 * ```ts
 * import { Resolution } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(Resolution)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Resolution extends S.Class<Resolution>($I`Resolution`)(
  {
    clientNumber: optional(ClientKey),
    docket: optional(DocketId),
    tier: ConfidenceTier,
    evidence: S.Array(EvidenceLine),
  },
  $I.annote("Resolution", { description: "Resolution retaining ambiguity rather than guessing a client or docket." })
) {}
/**
 * Measured precision and coverage for one outcome tier.
 *
 * **Example** (Inspect TierEvaluation)
 *
 * ```ts
 * import { TierEvaluation } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(TierEvaluation)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TierEvaluation extends S.Class<TierEvaluation>($I`TierEvaluation`)(
  {
    tier: ConfidenceTier,
    resolved: S.Natural,
    right: S.Natural,
    wrong: S.Natural,
    precision: optional(S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }))),
    coverage: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
  },
  $I.annote("TierEvaluation", { description: "Measured precision and coverage for one outcome tier." })
) {}
/**
 * Counts-only evaluation report for a deterministic hold-out.
 *
 * **Example** (Inspect EvaluationReport)
 *
 * ```ts
 * import { EvaluationReport } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(EvaluationReport)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EvaluationReport extends S.Class<EvaluationReport>($I`EvaluationReport`)(
  {
    trainSize: S.Natural,
    testSize: S.Natural,
    tiers: S.Array(TierEvaluation),
  },
  $I.annote("EvaluationReport", { description: "Counts-only evaluation report for a deterministic hold-out." })
) {}
/**
 * Public record facts used for numeric application or patent queries.
 *
 * **Example** (Inspect UsptoRecordFacts)
 *
 * ```ts
 * import { UsptoRecordFacts } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(UsptoRecordFacts)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UsptoRecordFacts extends S.Class<UsptoRecordFacts>($I`UsptoRecordFacts`)(
  {
    docketNumber: optional(S.NonEmptyString),
    firstApplicant: optional(S.NonEmptyString),
  },
  $I.annote("UsptoRecordFacts", { description: "Public record facts used for numeric application or patent queries." })
) {}
/**
 * Public USPTO numeric lookup kind.
 *
 * **Example** (Inspect LookupKind)
 *
 * ```ts
 * import { LookupKind } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(LookupKind)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LookupKind = LiteralKit(["application", "patent"]).pipe(
  $I.annoteSchema("LookupKind", { description: "Public USPTO numeric lookup kind." })
);
/**
 * Runtime type of {@link LookupKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type LookupKind = typeof LookupKind.Type;
/**
 * Numeric-only public lookup request.
 *
 * **Example** (Inspect UsptoQuery)
 *
 * ```ts
 * import { UsptoQuery } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(UsptoQuery)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UsptoQuery extends S.Class<UsptoQuery>($I`UsptoQuery`)(
  {
    kind: LookupKind,
    number: S.String.check(S.isPattern(/^[0-9]+$/u)),
  },
  $I.annote("UsptoQuery", { description: "Numeric-only public lookup request." })
) {}
/**
 * Public facts bound to the exact cited number.
 *
 * **Example** (Inspect UsptoEvidence)
 *
 * ```ts
 * import { UsptoEvidence } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(UsptoEvidence)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UsptoEvidence extends S.Class<UsptoEvidence>($I`UsptoEvidence`)(
  {
    query: UsptoQuery,
    facts: UsptoRecordFacts,
  },
  $I.annote("UsptoEvidence", { description: "Public facts bound to the exact cited number." })
) {}
/**
 * Private lookup result including explicit missing records.
 *
 * **Example** (Inspect UsptoLookupResult)
 *
 * ```ts
 * import { UsptoLookupResult } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(UsptoLookupResult)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UsptoLookupResult extends S.Class<UsptoLookupResult>($I`UsptoLookupResult`)(
  {
    query: UsptoQuery,
    facts: optional(UsptoRecordFacts),
  },
  $I.annote("UsptoLookupResult", { description: "Private lookup result including explicit missing records." })
) {}
/**
 * Operator supplied alias; no aliases are embedded in the resolver.
 *
 * **Example** (Inspect ClientAlias)
 *
 * ```ts
 * import { ClientAlias } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ClientAlias)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClientAlias extends S.Class<ClientAlias>($I`ClientAlias`)(
  {
    from: ClientKey,
    to: ClientKey,
  },
  $I.annote("ClientAlias", { description: "Operator supplied alias; no aliases are embedded in the resolver." })
) {}
/**
 * Input-supplied unnumbered client and its names.
 *
 * **Example** (Inspect PseudoClient)
 *
 * ```ts
 * import { PseudoClient } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(PseudoClient)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PseudoClient extends S.Class<PseudoClient>($I`PseudoClient`)(
  {
    key: S.String.check(S.isPattern(/^new:[^\s].*$/u)),
    names: S.Array(S.NonEmptyString),
  },
  $I.annote("PseudoClient", { description: "Input-supplied unnumbered client and its names." })
) {}
/**
 * Private attribution index and explicit operator policy inputs.
 *
 * **Example** (Inspect ResolverContext)
 *
 * ```ts
 * import { ResolverContext } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ResolverContext)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ResolverContext extends S.Class<ResolverContext>($I`ResolverContext`)(
  {
    clients: S.Array(ClientIndexEntry),
    pairs: S.Array(ClientDocketPair),
    contacts: S.Array(Contact),
    aliases: S.Array(ClientAlias),
    pseudoClients: S.Array(PseudoClient),
    excludedDomains: S.Array(S.String),
  },
  $I.annote("ResolverContext", { description: "Private attribution index and explicit operator policy inputs." })
) {}
/**
 * Content identity from an attorney-filed client folder.
 *
 * **Example** (Inspect IdenticalCopy)
 *
 * ```ts
 * import { IdenticalCopy } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(IdenticalCopy)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IdenticalCopy extends S.Class<IdenticalCopy>($I`IdenticalCopy`)(
  {
    contentHash: ContentHash,
    clientNumber: ClientNumber,
    docket: optional(DocketId),
  },
  $I.annote("IdenticalCopy", { description: "Content identity from an attorney-filed client folder." })
) {}
/**
 * Typed private evidence bundle for a single document.
 *
 * **Example** (Inspect IdentificationDocument)
 *
 * ```ts
 * import { IdentificationDocument } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(IdentificationDocument)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IdentificationDocument extends S.Class<IdentificationDocument>($I`IdentificationDocument`)(
  {
    documentId: S.NonEmptyString,
    contentHash: ContentHash,
    text: S.String,
    sourcePath: S.String,
    extraction: optional(ConfirmedExtraction),
    uspto: S.Array(UsptoEvidence),
    copies: S.Array(IdenticalCopy),
  },
  $I.annote("IdentificationDocument", { description: "Typed private evidence bundle for a single document." })
) {}
/**
 * Attorney-filed ground truth document used for training or hold-out.
 *
 * **Example** (Inspect TrainingDocument)
 *
 * ```ts
 * import { TrainingDocument } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(TrainingDocument)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TrainingDocument extends S.Class<TrainingDocument>($I`TrainingDocument`)(
  {
    document: IdentificationDocument,
    clientNumber: ClientNumber,
    docket: optional(DocketId),
  },
  $I.annote("TrainingDocument", { description: "Attorney-filed ground truth document used for training or hold-out." })
) {}
/**
 * Deterministic partition that keeps duplicate content together.
 *
 * **Example** (Inspect HoldOutSplit)
 *
 * ```ts
 * import { HoldOutSplit } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(HoldOutSplit)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HoldOutSplit extends S.Class<HoldOutSplit>($I`HoldOutSplit`)(
  {
    train: S.Array(TrainingDocument),
    test: S.Array(TrainingDocument),
  },
  $I.annote("HoldOutSplit", { description: "Deterministic partition that keeps duplicate content together." })
) {}
/**
 * Training-only client ownership of an evidence token.
 *
 * **Example** (Inspect TokenOwnership)
 *
 * ```ts
 * import { TokenOwnership } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(TokenOwnership)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TokenOwnership extends S.Class<TokenOwnership>($I`TokenOwnership`)(
  {
    token: S.NonEmptyString,
    clients: S.Array(ClientNumber),
  },
  $I.annote("TokenOwnership", { description: "Training-only client ownership of an evidence token." })
) {}
/**
 * Normalised text of one training document, kept for name learning.
 *
 * **Example** (Inspect LearningText)
 *
 * ```ts
 * import { LearningText } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(LearningText)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LearningText extends S.Class<LearningText>($I`LearningText`)(
  {
    clientNumber: ClientNumber,
    contentHash: ContentHash,
    text: S.String,
  },
  $I.annote("LearningText", { description: "Normalised text of one training document, kept for name learning." })
) {}
/**
 * Fitted token ownership and private training documents for name learning.
 *
 * **Example** (Inspect TokenFilter)
 *
 * ```ts
 * import { TokenFilter } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(TokenFilter)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TokenFilter extends S.Class<TokenFilter>($I`TokenFilter`)(
  {
    ownership: S.Array(TokenOwnership),
    training: S.Array(LearningText),
  },
  $I.annote("TokenFilter", { description: "Fitted token ownership and private training documents for name learning." })
) {}
/**
 * Log-safe JSONL output for a resolved document.
 *
 * **Example** (Inspect ResolutionRecord)
 *
 * ```ts
 * import { ResolutionRecord } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(ResolutionRecord)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ResolutionRecord extends S.Class<ResolutionRecord>($I`ResolutionRecord`)(
  {
    documentId: S.NonEmptyString,
    contentHash: ContentHash,
    resolution: Resolution,
  },
  $I.annote("ResolutionRecord", { description: "Log-safe JSONL output for a resolved document." })
) {}
/**
 * A held-out prediction paired with attorney-filed ground truth.
 *
 * **Example** (Inspect EvaluationCase)
 *
 * ```ts
 * import { EvaluationCase } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(EvaluationCase)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EvaluationCase extends S.Class<EvaluationCase>($I`EvaluationCase`)(
  {
    truth: TrainingDocument,
    resolution: Resolution,
  },
  $I.annote("EvaluationCase", { description: "A held-out prediction paired with attorney-filed ground truth." })
) {}
/**
 * Input-only folder policy for organising unresolved administration files.
 *
 * **Example** (Inspect OrganisationRules)
 *
 * ```ts
 * import { OrganisationRules } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(OrganisationRules)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OrganisationRules extends S.Class<OrganisationRules>($I`OrganisationRules`)(
  {
    firmFolders: S.Array(S.String),
    formFolders: S.Array(S.String),
  },
  $I.annote("OrganisationRules", {
    description: "Input-only folder policy for organising unresolved administration files.",
  })
) {}
/**
 * Non-client administrative organisation decision.
 *
 * **Example** (Inspect OrganisationKind)
 *
 * ```ts
 * import { OrganisationKind } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(OrganisationKind)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganisationKind = LiteralKit(["form", "firm", "unresolved"]).pipe(
  $I.annoteSchema("OrganisationKind", { description: "Non-client administrative organisation decision." })
);
/**
 * Runtime type of {@link OrganisationKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type OrganisationKind = typeof OrganisationKind.Type;
/**
 * Administrative organisation without inventing a client.
 *
 * **Example** (Inspect OrganisationDecision)
 *
 * ```ts
 * import { OrganisationDecision } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as S from "effect/Schema"
 * console.log(S.is(OrganisationDecision)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OrganisationDecision extends S.Class<OrganisationDecision>($I`OrganisationDecision`)(
  {
    kind: OrganisationKind,
  },
  $I.annote("OrganisationDecision", { description: "Administrative organisation without inventing a client." })
) {}
