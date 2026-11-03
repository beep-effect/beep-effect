/**
 * Law-practice contact vocabulary translated through the party use-case port.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  ClientNumber,
  Contact,
  ContactEmail,
  ContactLinkSource,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import {
  ConceptIri,
  ContactCard,
  ContactContextRole,
  ContactEmailInput,
  ContactSource,
  ContactSourceError,
  ContextRef,
  PhoneNumberInput,
} from "@beep/party-use-cases/ContactSource";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type { ContactLink, IdentificationError } from "@beep/law-practice-use-cases/DocumentIdentification";

const $I = $LawPracticeServerId.create("PartyContactSource/PartyContactSource.layer");

/**
 * A legacy link retains the owning practice's client and source vocabulary.
 * **Example** (Decode a legacy link)
 * ```ts
 * import { LegacyContactLink } from "@beep/law-practice-server/PartyContactSource"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(LegacyContactLink)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LegacyContactLink extends S.Opaque<LegacyContactLink, { readonly brand: unique symbol }>()(
  S.Struct({
    clientNumber: ClientNumber,
    familyKey: S.OptionFromNullOr(S.String),
    source: ContactLinkSource,
    evidence: S.String,
  }).pipe($I.annoteSchema("LegacyContactLink", { description: "Legacy client-link provenance." }))
) {}

/**
 * Earlier contacts-kg exports, decoded without pretending they are current contacts.
 * **Example** (Decode an export row)
 * ```ts
 * import { LegacyContactKgRow } from "@beep/law-practice-server/PartyContactSource"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(LegacyContactKgRow)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LegacyContactKgRow extends S.Opaque<LegacyContactKgRow, { readonly brand: unique symbol }>()(
  S.Struct({
    contactId: S.NonEmptyString,
    displayName: S.String,
    organization: S.OptionFromNullOr(S.String),
    emails: S.Array(ContactEmail),
    sources: S.Array(S.Literals(["csv", "vcf"])),
    links: S.Array(LegacyContactLink),
  }).pipe($I.annoteSchema("LegacyContactKgRow", { description: "Legacy contacts-kg row owned by law-practice." }))
) {}

/**
 * Supported practice records at the adapter boundary.
 * **Example** (Validate a contact record)
 * ```ts
 * import { PracticeContactRecord } from "@beep/law-practice-server/PartyContactSource"
 * import * as S from "effect/Schema"
 * const accepts = S.is(PracticeContactRecord)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const PracticeContactRecord = S.Union([Contact, LegacyContactKgRow]).pipe(
  $I.annoteSchema("PracticeContactRecord", { description: "Current or legacy practice contact." })
);
/**
 * Decoded practice contact record.
 * @category models
 * @since 0.0.0
 */
export type PracticeContactRecord = typeof PracticeContactRecord.Type;

/**
 * One source record with a stable namespace supplied by the source owner.
 * **Example** (Decode adapter input)
 * ```ts
 * import { PracticeContactInput } from "@beep/law-practice-server/PartyContactSource"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PracticeContactInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PracticeContactInput extends S.Opaque<PracticeContactInput, { readonly brand: unique symbol }>()(
  S.Struct({ sourceNamespace: S.NonEmptyString, contact: PracticeContactRecord }).pipe(
    $I.annoteSchema("PracticeContactInput", { description: "Practice-owned contact adapter input." })
  )
) {}

const isCurrent = S.is(Contact);
const clientContactRole = ConceptIri.make("urn:beep:party-role:client-contact");

/**
 * Translate practice-specific client links into opaque contextual role assertions.
 * **Details**
 * Shared-address flags survive unchanged. Phone inputs are already E.164 and
 * carry no guessed country. Source-specific link anchors stay distinct so an
 * organisation-name match cannot be confused with an attorney-confirmed link.
 * **Example** (Use the contact translation)
 * ```ts
 * import { adaptPracticeContact } from "@beep/law-practice-server/PartyContactSource"
 * const translate = adaptPracticeContact
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const adaptPracticeContact = (input: PracticeContactInput): ContactCard => {
  const contact = input.contact;
  const links: ReadonlyArray<ContactLink | LegacyContactLink> = contact.links;
  const organization = O.contains(contact.organization, contact.displayName);
  return ContactCard.make({
    sourceNamespace: input.sourceNamespace,
    sourceRecordId: contact.contactId,
    label: contact.displayName,
    kind: organization ? "Organization" : "Person",
    emails: A.map(contact.emails, (email) => ContactEmailInput.make({ raw: email.address, represents: email.role })),
    phones: isCurrent(contact)
      ? A.map(contact.phones, (phone) => PhoneNumberInput.make({ raw: phone.e164, country: O.none() }))
      : [],
    identifiers: [],
    roles: A.map(
      A.dedupeWith(links, (left, right) => left.clientNumber === right.clientNumber && left.source === right.source),
      (link) =>
        ContactContextRole.make({
          context: ContextRef.make(`party-ctx:client:${encodeURIComponent(link.clientNumber)}`),
          role: clientContactRole,
          anchor: `${contact.contactId}#link:${link.source}`,
        })
    ),
  });
};

/**
 * The practice owner supplies a lazy stream from its current or legacy store.
 * @category ports
 * @since 0.0.0
 */
export interface PracticeContactRecordsShape {
  readonly records: Stream.Stream<PracticeContactRecord, IdentificationError>;
  readonly sourceNamespace: string;
}

/**
 * Source-owned contact records; the party implementation never reads practice stores.
 * **Example** (Supply synthetic records)
 * ```ts
 * import { PracticeContactRecords } from "@beep/law-practice-server/PartyContactSource"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 * const source = Layer.succeed(PracticeContactRecords, { sourceNamespace: "urn:test:contacts", records: Stream.empty })
 * ```
 * @category services
 * @since 0.0.0
 */
export class PracticeContactRecords extends Context.Service<PracticeContactRecords, PracticeContactRecordsShape>()(
  $I`PracticeContactRecords`
) {}

const decodePracticeContactInput = S.decodeUnknownEffect(S.toType(PracticeContactInput));

/**
 * Implements the party ContactSource port using practice-owned records.
 * **Example** (Compose the adapter)
 * ```ts
 * import { PartyContactSourceLive, PracticeContactRecords } from "@beep/law-practice-server/PartyContactSource"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 * const source = PartyContactSourceLive.pipe(Layer.provide(Layer.succeed(PracticeContactRecords, { sourceNamespace: "urn:test:contacts", records: Stream.empty })))
 * ```
 * @category layers
 * @since 0.0.0
 */
export const PartyContactSourceLive = Layer.effect(
  ContactSource,
  Effect.gen(function* () {
    const source = yield* PracticeContactRecords;
    return ContactSource.of({
      cards: source.records.pipe(
        Stream.mapEffect((contact) => decodePracticeContactInput({ sourceNamespace: source.sourceNamespace, contact })),
        Stream.map(adaptPracticeContact),
        Stream.mapError(() => ContactSourceError.make({ reason: "practice-contact-source-failed" }))
      ),
    });
  })
);
