/**
 * Adapter: client-file contact cards → provisional parties + identity
 * assertions.
 *
 * A contact card is a **source record**, not a canonical party. Each card
 * yields one provisional party (mention-level) and source assertions:
 *
 * - `IdentifierOf(email → card party, used-by)`; a role-flagged address
 *   (`info@`, `docketing@`) is `represents`, which personal attribution ignores,
 * - `IdentifierOf(phone → card party, used-by)` for E.164-normalizable numbers,
 * - `ContextRole(card party, client:<number>, client-contact)` when the card is
 *   linked to a client number.
 *
 * Cards from two sources describing one human stay two provisional parties
 * until a `SameParty` claim joins them. Contact books undate everything, so
 * valid time is `Unknown`.
 *
 * Reuses the shipped schemas: `GraphContact` (`@beep/m365`) and the
 * deduplicated `Contact` (`@beep/law-practice-use-cases/DocumentIdentification`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type {
  Contact,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import {
  ClientNumber,
  ContactEmail,
  ContactLinkSource,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import type { GraphContact } from "@beep/m365/M365.schemas";
import * as A from "@beep/utils/Array";
import { pipe } from "effect/Function";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as Str from "@beep/utils/Str";
import type { SourceAssertion } from "../Claim.ts";
import {
  ActivityId,
  AssertionId,
  ConceptIri,
  ContextRef,
  IdentifierId,
  OccurrenceId,
  PartyId,
} from "../Ids.ts";
import { Identifier, Party } from "../Party.ts";
import { normalizeEmail } from "../Party.ts";
import { Proposition } from "../Proposition.ts";
import type { IdentifierRelation } from "../Proposition.ts";
import { TemporalExtent, type UtcInstant } from "../Time.ts";
import { EvidenceAnchor } from "../Provenance.ts";

/**
 * What one contact card contributes.
 *
 * @category contact-evidence
 * @since 0.0.0
 */
export interface ContactIngest {
  readonly party: Party;
  readonly identifiers: ReadonlyArray<Identifier>;
  readonly assertions: ReadonlyArray<SourceAssertion>;
}

const $I = $ScratchpadId.create("party/adapters/ContactEvidence");

const clientContactRole = ConceptIri.make("urn:beep:party-role:client-contact");

/**
 * Normalize a phone string to E.164 for North American and already-E.164
 * numbers; anything else is left out rather than guessed.
 *
 * @category contact-evidence
 * @since 0.0.0
 */
export const toE164 = (raw: string): O.Option<string> => {
  const plus = Str.startsWith("+")(Str.trim(raw));
  const digits = Str.replace(/\D/g, "")(raw);
  return pipe(
    digits,
    Str.match(/^[1-9]\d{7,14}$/),
    O.filter(() => plus),
    O.map(() => `+${digits}`),
    O.orElse(() => pipe(digits, Str.match(/^\d{10}$/), O.map(() => `+1${digits}`))),
    O.orElse(() => pipe(digits, Str.match(/^1\d{10}$/), O.map(() => `+${digits}`))),
  );
};

const emailIdentifier = (raw: string): O.Option<Identifier> => {
  const normalized = normalizeEmail(raw);
  return /^[^\s@<>]+@[^\s@<>]+$/.test(normalized)
    ? Identifier.cases.EmailAddress.makeOption({
      id: IdentifierId.make(`ident:email:${normalized}`),
      normalized,
      raw,
    })
    : O.none();
};

const phoneIdentifier = (raw: string): O.Option<Identifier> =>
  O.flatMap(toE164(raw), (e164) => Identifier.cases.PhoneNumber.makeOption({
    id: IdentifierId.make(`ident:tel:${e164}`),
    e164,
    raw,
  }));

interface CardFacts {
  readonly source: string;
  readonly cardId: string;
  readonly party: Party;
  readonly emails: ReadonlyArray<{
    readonly identifier: Identifier;
    readonly role: boolean
  }>;
  readonly phones: ReadonlyArray<Identifier>;
  readonly clientNumbers: ReadonlyArray<string>;
}

const assemble = (
  {
    facts,
    producedBy,
    recordedAt,
  }: {
    readonly facts: CardFacts;
    readonly producedBy: ActivityId;
    readonly recordedAt: UtcInstant;
  }): ContactIngest => {
  const occurrence = OccurrenceId.make(`occ:contacts:${facts.source}`);
  const anchor = {
    _tag: "RecordRow" as const,
    occurrence,
    rowKey: facts.cardId,
  };
  const assertion = (n: string, proposition: Proposition): SourceAssertion => ({
    id: AssertionId.make(`asrt:contact:${facts.source}:${encodeURIComponent(facts.cardId)}:${n}`),
    proposition,
    stance: "asserts",
    anchors: [anchor],
    producedBy,
    validTime: TemporalExtent.cases.Unknown.make({}),
    recordedAt,
  });
  const identifierOf = (identifier: Identifier, relation: IdentifierRelation): Proposition => Proposition.cases.IdentifierOf.make({
    identifier: identifier.id,
    party: facts.party.id,
    relation,
  });
  return {
    party: facts.party,
    identifiers: [...A.map(facts.emails, (e) => e.identifier), ...facts.phones],
    assertions: [
      ...A.map(facts.emails, (e, i) => assertion(`email${i}`, identifierOf(e.identifier, e.role ? "represents" : "used-by"))),
      ...A.map(facts.phones, (p, i) => assertion(`phone${i}`, identifierOf(p, "used-by"))),
      ...A.map(facts.clientNumbers, (c, i) =>
        assertion(`client${i}`, Proposition.cases.ContextRole.make({
          party: facts.party.id,
          context: ContextRef.make(`ctx:client:${encodeURIComponent(c)}`),
          role: clientContactRole,
        })),
      ),
    ],
  };
};

const nonEmpty = (o: O.Option<string>) => O.filter(O.map(o, Str.trim), Str.isNonEmpty);

/**
 * A Microsoft Graph contact card. Person when given name or surname is
 * present; organization when only a company name is; the basis is the card's
 * own structure, never a guess from the label.
 *
 * @category contact-evidence
 * @since 0.0.0
 */
export const adaptGraphContact = (
  {
    contact,
    source,
    producedBy,
    recordedAt,
  }: {
    readonly contact: GraphContact;
    readonly source: string;
    readonly producedBy: ActivityId;
    readonly recordedAt: UtcInstant;
  }): ContactIngest => {
  const id = PartyId.make(`party:card:${source}:${encodeURIComponent(contact.id)}`);
  const personal = pipe(contact.givenName, nonEmpty, O.isSome) || pipe(contact.surname, nonEmpty, O.isSome);
  const company = nonEmpty(contact.companyName);
  const label = pipe(
    nonEmpty(contact.displayName),
    O.orElse(() => company),
    O.getOrElse(() => contact.id),
  );
  const party: Party =
    !personal && O.isSome(company)
      ? Party.cases.Organization.make({ id, label, orgKind: O.none() })
      : Party.cases.Person.make({ _tag: "Person", id, label });
  return assemble({
    producedBy,
    recordedAt,
    facts: {
      source,
      cardId: contact.id,
      party,
      emails: A.flatMap(O.getOrElse(contact.emailAddresses, () => A.empty()), (e) =>
        O.toArray(O.map(O.flatMap(e.address, emailIdentifier), (identifier) => ({
          identifier,
          role: false,
        }))),
      ),
      phones: A.flatMap(
        A.appendAll(
          A.appendAll(
            O.getOrElse(contact.businessPhones, A.empty<string>),
            O.getOrElse(contact.homePhones, A.empty<string>),
          ),
          O.toArray(contact.mobilePhone),
        ),
        (p: string) => O.toArray(phoneIdentifier(p)),
      ),
      clientNumbers: [],
    },
  });
};

/**
 * A deduplicated practice contact (with role-mailbox flags and client links).
 * Organization when the display name equals the organization field.
 *
 * @category contact-evidence
 * @since 0.0.0
 */
export const adaptPracticeContact = (
  {
    contact,
    source,
    producedBy,
    recordedAt,
  }: {
    readonly contact: Contact;
    readonly source: string;
    readonly producedBy: ActivityId;
    readonly recordedAt: UtcInstant;
  }): ContactIngest => {
  const id = PartyId.make(`party:card:${source}:${encodeURIComponent(contact.contactId)}`);
  const label = O.getOrElse(O.filter(O.some(Str.trim(contact.displayName)), Str.isNonEmpty), () => contact.contactId);
  const isOrg = O.match(contact.organization, {
    onNone: () => false,
    onSome: (org) => org === contact.displayName,
  });
  const party: Party = isOrg ? Party.cases.Organization.make({
    id,
    label,
    orgKind: O.none(),
  }) : Party.cases.Person.make({ id, label });
  return assemble({
    producedBy,
    recordedAt,
    facts: {
      source,
      cardId: contact.contactId,
      party,
      emails: A.flatMap(contact.emails, (e) =>
        O.toArray(O.map(emailIdentifier(e.address), (identifier) => ({
          identifier,
          role: e.role,
        }))),
      ),
      phones: A.flatMap(contact.phones, (p) => O.toArray(phoneIdentifier(p.e164))),
      clientNumbers: A.dedupe(A.map(contact.links, (l) => l.clientNumber)),
    },
  });
};

/**
 * The legacy contacts-kg row format (an earlier export than the shipped
 * `Contact` schema accepts: free-form ids and `csv`/`vcf` sources). Decoded
 * here at the boundary rather than coerced into the newer schema; the shipped
 * value schemas are reused where the formats agree.
 *
 * @category contact-evidence
 * @since 0.0.0
 */
export const LegacyContactKgRow = S.Struct({
  contactId: S.NonEmptyString,
  displayName: S.String,
  organization: S.OptionFromNullOr(S.String),
  emails: S.Array(ContactEmail),
  sources: S.Array(LiteralKit(["csv", "vcf"])),
  links: S.Array(
    S.Struct({
      clientNumber: ClientNumber,
      familyKey: S.OptionFromNullOr(S.String),
      source: ContactLinkSource,
      evidence: S.String,
    }),
  ),
}).pipe($I.annoteSchema("LegacyContactKgRow", { description: "Legacy contacts-kg export row." }));
export type LegacyContactKgRow = typeof LegacyContactKgRow.Type;

/**
 * A legacy contacts-kg card: a provisional party, its email assertions, and
 * one client-contact role per linked client number. The link's own source
 * (`attorney-filed-email`, `org-name-match`, ...) is kept in the anchor so a
 * name-match link is never mistaken for an attorney-confirmed one.
 *
 * @category contact-evidence
 * @since 0.0.0
 */
export const adaptLegacyContactKg = (
  {
    row,
    source,
    producedBy,
    recordedAt,
  }: {
    readonly row: LegacyContactKgRow;
    readonly source: string;
    readonly producedBy: ActivityId;
    readonly recordedAt: UtcInstant;
  }): ContactIngest => {
  const id = PartyId.make(`party:card:${source}:${encodeURIComponent(row.contactId)}`);
  const label = O.getOrElse(O.filter(O.some(Str.trim(row.displayName)), Str.isNonEmpty), () => row.contactId);
  const isOrg = O.match(row.organization, {
    onNone: () => false,
    onSome: (org) => org === row.displayName,
  });
  const party: Party = isOrg ? Party.cases.Organization.make({
    _tag: "Organization",
    id,
    label,
    orgKind: O.none(),
  }) : Party.cases.Person.make({ _tag: "Person", id, label });
  const base = assemble({
    producedBy,
    recordedAt,
    facts: {
      source,
      cardId: row.contactId,
      party,
      emails: A.flatMap(row.emails, (e) =>
        O.toArray(O.map(emailIdentifier(e.address), (identifier) => ({
          identifier,
          role: e.role,
        }))),
      ),
      phones: [],
      clientNumbers: [],
    },
  });
  const occurrence = OccurrenceId.make(`occ:contacts:${source}`);
  const links = A.map(A.dedupeWith(row.links, (a, b) => a.clientNumber === b.clientNumber && a.source === b.source), (l, i): SourceAssertion => ({
    id: AssertionId.make(`asrt:contact:${source}:${encodeURIComponent(row.contactId)}:link${i}`),
    proposition: Proposition.cases.ContextRole.make({
      party: id,
      context: ContextRef.make(`ctx:client:${encodeURIComponent(l.clientNumber)}`),
      role: clientContactRole,
    }),
    stance: "asserts" as const,
    anchors: [EvidenceAnchor.cases.RecordRow.make({
      occurrence,
      rowKey: `${row.contactId}#link:${l.source}`,
    })],
    producedBy,
    validTime: TemporalExtent.cases.Unknown.make({}),
    recordedAt,
  }));
  return { ...base, assertions: [...base.assertions, ...links] };
};
