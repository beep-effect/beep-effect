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
 * @category models
 * @since 0.0.0
 */
export type ContactSource = typeof ContactSource.Type;
/**
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
 * @category models
 * @since 0.0.0
 */
export type ContactLinkSource = typeof ContactLinkSource.Type;
/**
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
 * @category models
 * @since 0.0.0
 */
export type IndexSource = typeof IndexSource.Type;
/**
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
 * @category models
 * @since 0.0.0
 */
export type ClientNumber = typeof ClientNumber.Type;
/**
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
 * @category models
 * @since 0.0.0
 */
export type DocketId = typeof DocketId.Type;
/**
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
 * @category models
 * @since 0.0.0
 */
export type ClientKey = typeof ClientKey.Type;
/**
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
 * @category models
 * @since 0.0.0
 */
export type ContentHash = typeof ContentHash.Type;
/**
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
export class ContactEmail extends S.Opaque<ContactEmail, { readonly brand: unique symbol }>()(
  S.Struct({
    address: S.String.check(S.isTrimmed(), S.isLowercased(), S.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u)),
    role: S.Boolean,
  }).pipe($I.annoteSchema("ContactEmail", { description: "Normalised email address with shared mailbox status." }))
) {}
/**
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
export class PhoneNumber extends S.Opaque<PhoneNumber, { readonly brand: unique symbol }>()(
  S.Struct({
    e164: S.String.check(S.isPattern(/^\+[1-9][0-9]{7,14}$/u)),
    areaCode: optional(S.String.check(S.isPattern(/^[2-9][0-9]{2}$/u))),
  }).pipe($I.annoteSchema("PhoneNumber", { description: "E.164 telephone number and optional NANP area code." }))
) {}
/**
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
export class ContactLink extends S.Opaque<ContactLink, { readonly brand: unique symbol }>()(
  S.Struct({
    clientNumber: ClientNumber,
    familyKey: optional(S.NonEmptyString),
    source: ContactLinkSource,
    evidence: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ContactLink", {
      description: "Contact attribution with source and log-safe evidence description.",
    })
  )
) {}
/**
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
export class RawContactCard extends S.Opaque<RawContactCard, { readonly brand: unique symbol }>()(
  S.Struct({
    displayName: S.String,
    organization: optional(S.NonEmptyString),
    titles: S.Array(S.String),
    emails: S.Array(S.String),
    phones: S.Array(S.String),
    addresses: S.Array(S.String),
    source: ContactSource,
  }).pipe($I.annoteSchema("RawContactCard", { description: "Unnormalised card read from a private contact source." }))
) {}
/**
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
export class Contact extends S.Opaque<Contact, { readonly brand: unique symbol }>()(
  S.Struct({
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
  }).pipe($I.annoteSchema("Contact", { description: "Deduplicated person or organisation with stable identifier." }))
) {}
/**
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
export class ContactProjection extends S.Opaque<ContactProjection, { readonly brand: unique symbol }>()(
  S.Struct({
    contactId: ContentHash,
    displayName: S.String,
    organization: optional(S.NonEmptyString),
    emails: S.Array(ContactEmail),
    sources: S.Array(ContactSource),
    links: S.Array(ContactLink),
  }).pipe(
    $I.annoteSchema("ContactProjection", {
      description: "Contact projection excluding telephone and postal address data.",
    })
  )
) {}
/**
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
export class SourceCount extends S.Opaque<SourceCount, { readonly brand: unique symbol }>()(
  S.Struct({
    source: IndexSource,
    count: S.Natural,
  }).pipe($I.annoteSchema("SourceCount", { description: "Count of assertions from one provenance source." }))
) {}
/**
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
export class ClientDocketPair extends S.Opaque<ClientDocketPair, { readonly brand: unique symbol }>()(
  S.Struct({
    clientNumber: ClientNumber,
    docket: DocketId,
    sources: S.Array(SourceCount),
  }).pipe(
    $I.annoteSchema("ClientDocketPair", {
      description: "Known client and docket pair; docket alone never identifies a client.",
    })
  )
) {}
/**
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
export class ClientName extends S.Opaque<ClientName, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    source: IndexSource,
  }).pipe($I.annoteSchema("ClientName", { description: "Client name with provenance." }))
) {}
/**
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
export class ClientIndexEntry extends S.Opaque<ClientIndexEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    clientNumber: ClientNumber,
    names: S.Array(ClientName),
    folders: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ClientIndexEntry", { description: "Known names and input folder names for a numbered client." })
  )
) {}
/**
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
export class IndexEvidence extends S.Opaque<IndexEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    clientNumber: optional(ClientNumber),
    names: S.Array(S.String),
    references: S.Array(S.String),
    folders: S.Array(S.String),
    emails: S.Array(S.String),
    contactIds: S.Array(ContentHash),
    source: IndexSource,
  }).pipe(
    $I.annoteSchema("IndexEvidence", {
      description: "Input assertion from answers, folders, docket sheet, KG or email subjects.",
    })
  )
) {}
/**
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
export class IdentificationIndex extends S.Opaque<IdentificationIndex, { readonly brand: unique symbol }>()(
  S.Struct({
    clients: S.Array(ClientIndexEntry),
    pairs: S.Array(ClientDocketPair),
    contacts: S.Array(Contact),
  }).pipe(
    $I.annoteSchema("IdentificationIndex", {
      description: "Private index output consumed by resolution and evaluation.",
    })
  )
) {}
/**
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
 * @category models
 * @since 0.0.0
 */
export type PartyKind = typeof PartyKind.Type;
/**
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
 * @category models
 * @since 0.0.0
 */
export type PartyRole = typeof PartyRole.Type;
/**
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
 * @category models
 * @since 0.0.0
 */
export type DocumentType = typeof DocumentType.Type;
/**
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
export class ExtractedParty extends S.Opaque<ExtractedParty, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    kind: PartyKind,
    role: PartyRole,
    quote: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ExtractedParty", { description: "Quoted party claim subject to independent critic confirmation." })
  )
) {}
/**
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
export class ExtractedDocket extends S.Opaque<ExtractedDocket, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.NonEmptyString,
    quote: S.NonEmptyString,
  }).pipe($I.annoteSchema("ExtractedDocket", { description: "Verbatim docket string with its source quote." }))
) {}
/**
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
export class DocumentExtraction extends S.Opaque<DocumentExtraction, { readonly brand: unique symbol }>()(
  S.Struct({
    docType: DocumentType,
    title: optional(S.String),
    parties: S.Array(ExtractedParty),
    dockets: S.Array(ExtractedDocket),
    applicationNumbers: S.Array(S.String),
    patentNumbers: S.Array(S.String),
    emails: S.Array(S.String),
    dates: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("DocumentExtraction", {
      description: "Extractor facts kept private; quotes never appear in resolution outputs.",
    })
  )
) {}
/**
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
export class CriticVerdict extends S.Opaque<CriticVerdict, { readonly brand: unique symbol }>()(
  S.Struct({
    keepParties: S.Array(S.Natural),
    keepDockets: S.Array(S.Natural),
    docType: DocumentType,
    problems: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("CriticVerdict", {
      description: "Independent critic accepted indexes and corrected document type.",
    })
  )
) {}
/**
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
export class ConfirmedExtraction extends S.Opaque<ConfirmedExtraction, { readonly brand: unique symbol }>()(
  S.Struct({
    extraction: DocumentExtraction,
    verdict: CriticVerdict,
  }).pipe(
    $I.annoteSchema("ConfirmedExtraction", { description: "Paired extractor and critic output for one document." })
  )
) {}
/**
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
export class ExtractionRecord extends S.Opaque<ExtractionRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    extraction: DocumentExtraction,
  }).pipe($I.annoteSchema("ExtractionRecord", { description: "Canonical nested extractor JSONL record." }))
) {}
/**
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
export class CriticRecord extends S.Opaque<CriticRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    verdict: CriticVerdict,
  }).pipe($I.annoteSchema("CriticRecord", { description: "Canonical nested critic JSONL record." }))
) {}
/**
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
 * @category models
 * @since 0.0.0
 */
export type EvidenceKind = typeof EvidenceKind.Type;
/**
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
export class EvidenceLine extends S.Opaque<EvidenceLine, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: EvidenceKind,
    detail: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("EvidenceLine", {
      description: "One reason containing identifiers or counts, never document text.",
    })
  )
) {}
/**
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
 * @category models
 * @since 0.0.0
 */
export type ConfidenceTier = typeof ConfidenceTier.Type;
/**
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
export class Resolution extends S.Opaque<Resolution, { readonly brand: unique symbol }>()(
  S.Struct({
    clientNumber: optional(ClientKey),
    docket: optional(DocketId),
    tier: ConfidenceTier,
    evidence: S.Array(EvidenceLine),
  }).pipe(
    $I.annoteSchema("Resolution", {
      description: "Resolution retaining ambiguity rather than guessing a client or docket.",
    })
  )
) {}
/**
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
export class TierEvaluation extends S.Opaque<TierEvaluation, { readonly brand: unique symbol }>()(
  S.Struct({
    tier: ConfidenceTier,
    resolved: S.Natural,
    right: S.Natural,
    wrong: S.Natural,
    precision: optional(S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }))),
    coverage: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
  }).pipe($I.annoteSchema("TierEvaluation", { description: "Measured precision and coverage for one outcome tier." }))
) {}
/**
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
export class EvaluationReport extends S.Opaque<EvaluationReport, { readonly brand: unique symbol }>()(
  S.Struct({
    trainSize: S.Natural,
    testSize: S.Natural,
    tiers: S.Array(TierEvaluation),
  }).pipe(
    $I.annoteSchema("EvaluationReport", { description: "Counts-only evaluation report for a deterministic hold-out." })
  )
) {}
/**
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
export class UsptoRecordFacts extends S.Opaque<UsptoRecordFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    docketNumber: optional(S.NonEmptyString),
    firstApplicant: optional(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("UsptoRecordFacts", {
      description: "Public record facts used for numeric application or patent queries.",
    })
  )
) {}
/**
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
 * @category models
 * @since 0.0.0
 */
export type LookupKind = typeof LookupKind.Type;
/**
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
export class UsptoQuery extends S.Opaque<UsptoQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: LookupKind,
    number: S.String.check(S.isPattern(/^[0-9]+$/u)),
  }).pipe($I.annoteSchema("UsptoQuery", { description: "Numeric-only public lookup request." }))
) {}
/**
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
export class UsptoEvidence extends S.Opaque<UsptoEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    query: UsptoQuery,
    facts: UsptoRecordFacts,
  }).pipe($I.annoteSchema("UsptoEvidence", { description: "Public facts bound to the exact cited number." }))
) {}
/**
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
export class UsptoLookupResult extends S.Opaque<UsptoLookupResult, { readonly brand: unique symbol }>()(
  S.Struct({
    query: UsptoQuery,
    facts: optional(UsptoRecordFacts),
  }).pipe(
    $I.annoteSchema("UsptoLookupResult", { description: "Private lookup result including explicit missing records." })
  )
) {}
/**
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
export class ClientAlias extends S.Opaque<ClientAlias, { readonly brand: unique symbol }>()(
  S.Struct({
    from: ClientKey,
    to: ClientKey,
  }).pipe(
    $I.annoteSchema("ClientAlias", { description: "Operator supplied alias; no aliases are embedded in the resolver." })
  )
) {}
/**
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
export class PseudoClient extends S.Opaque<PseudoClient, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.String.check(S.isPattern(/^new:[^\s].*$/u)),
    names: S.Array(S.NonEmptyString),
  }).pipe($I.annoteSchema("PseudoClient", { description: "Input-supplied unnumbered client and its names." }))
) {}
/**
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
export class ResolverContext extends S.Opaque<ResolverContext, { readonly brand: unique symbol }>()(
  S.Struct({
    clients: S.Array(ClientIndexEntry),
    pairs: S.Array(ClientDocketPair),
    contacts: S.Array(Contact),
    aliases: S.Array(ClientAlias),
    pseudoClients: S.Array(PseudoClient),
    excludedDomains: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ResolverContext", {
      description: "Private attribution index and explicit operator policy inputs.",
    })
  )
) {}
/**
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
export class IdenticalCopy extends S.Opaque<IdenticalCopy, { readonly brand: unique symbol }>()(
  S.Struct({
    contentHash: ContentHash,
    clientNumber: ClientNumber,
    docket: optional(DocketId),
  }).pipe($I.annoteSchema("IdenticalCopy", { description: "Content identity from an attorney-filed client folder." }))
) {}
/**
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
export class IdentificationDocument extends S.Opaque<IdentificationDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    documentId: S.NonEmptyString,
    contentHash: ContentHash,
    text: S.String,
    sourcePath: S.String,
    extraction: optional(ConfirmedExtraction),
    uspto: S.Array(UsptoEvidence),
    copies: S.Array(IdenticalCopy),
  }).pipe(
    $I.annoteSchema("IdentificationDocument", { description: "Typed private evidence bundle for a single document." })
  )
) {}
/**
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
export class TrainingDocument extends S.Opaque<TrainingDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    document: IdentificationDocument,
    clientNumber: ClientNumber,
    docket: optional(DocketId),
  }).pipe(
    $I.annoteSchema("TrainingDocument", {
      description: "Attorney-filed ground truth document used for training or hold-out.",
    })
  )
) {}
/**
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
export class HoldOutSplit extends S.Opaque<HoldOutSplit, { readonly brand: unique symbol }>()(
  S.Struct({
    train: S.Array(TrainingDocument),
    test: S.Array(TrainingDocument),
  }).pipe(
    $I.annoteSchema("HoldOutSplit", { description: "Deterministic partition that keeps duplicate content together." })
  )
) {}
/**
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
export class TokenOwnership extends S.Opaque<TokenOwnership, { readonly brand: unique symbol }>()(
  S.Struct({
    token: S.NonEmptyString,
    clients: S.Array(ClientNumber),
  }).pipe($I.annoteSchema("TokenOwnership", { description: "Training-only client ownership of an evidence token." }))
) {}
/**
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
export class LearningText extends S.Opaque<LearningText, { readonly brand: unique symbol }>()(
  S.Struct({
    clientNumber: ClientNumber,
    contentHash: ContentHash,
    text: S.String,
  }).pipe(
    $I.annoteSchema("LearningText", {
      description: "Normalised text of one training document, kept for name learning.",
    })
  )
) {}
/**
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
export class TokenFilter extends S.Opaque<TokenFilter, { readonly brand: unique symbol }>()(
  S.Struct({
    ownership: S.Array(TokenOwnership),
    training: S.Array(LearningText),
  }).pipe(
    $I.annoteSchema("TokenFilter", {
      description: "Fitted token ownership and private training documents for name learning.",
    })
  )
) {}
/**
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
export class ResolutionRecord extends S.Opaque<ResolutionRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    documentId: S.NonEmptyString,
    contentHash: ContentHash,
    resolution: Resolution,
  }).pipe($I.annoteSchema("ResolutionRecord", { description: "Log-safe JSONL output for a resolved document." }))
) {}
/**
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
export class EvaluationCase extends S.Opaque<EvaluationCase, { readonly brand: unique symbol }>()(
  S.Struct({
    truth: TrainingDocument,
    resolution: Resolution,
  }).pipe(
    $I.annoteSchema("EvaluationCase", { description: "A held-out prediction paired with attorney-filed ground truth." })
  )
) {}
/**
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
export class OrganisationRules extends S.Opaque<OrganisationRules, { readonly brand: unique symbol }>()(
  S.Struct({
    firmFolders: S.Array(S.String),
    formFolders: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("OrganisationRules", {
      description: "Input-only folder policy for organising unresolved administration files.",
    })
  )
) {}
/**
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
 * @category models
 * @since 0.0.0
 */
export type OrganisationKind = typeof OrganisationKind.Type;
/**
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
export class OrganisationDecision extends S.Opaque<OrganisationDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: OrganisationKind,
  }).pipe(
    $I.annoteSchema("OrganisationDecision", { description: "Administrative organisation without inventing a client." })
  )
) {}
