/**
 * Contact evidence from the practice knowledge graph: the addresses the
 * correspondent rule resolves `unique` to one matter, and the switch that
 * turns contact evidence on.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { MailTaggingPortError } from "@beep/law-practice-use-cases/MailTagging";
import {
  PracticeKgCorrespondentContact,
  PracticeKgCorrespondentEvidence,
  PracticeKgCorrespondentLink,
  resolvePracticeKgCorrespondent,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import { Context, Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { mailAddressOf } from "../internal/MailAddress.ts";
import type { EmailString } from "@beep/schema/Email";

const $I = $LawPracticeServerId.create("MailTagging/MailTagging.correspondents");

/**
 * Where the matter directory takes contact addresses from.
 *
 * **Details**
 *
 * `off` attaches no contact address and no contact domain to any matter, so
 * only identifiers in the mail tie it to a matter. `kg` attaches the
 * addresses the practice knowledge graph resolves `unique` to a matter, then
 * the contacts of the optional `matter-contacts.json` overlay.
 *
 * **Example** (Guard a setting)
 *
 * ```ts
 * import { MatterContactEvidence } from "@beep/law-practice-server/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterContactEvidence)("kg")) // true
 * console.log(S.is(MatterContactEvidence)("overlay")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MatterContactEvidence = LiteralKit(["off", "kg"]).pipe(
  $I.annoteSchema("MatterContactEvidence", {
    description: "Whether matter contacts come from nowhere or from the practice knowledge graph and its overlay.",
  })
);

/**
 * Runtime type for {@link MatterContactEvidence}.
 *
 * @category models
 * @since 0.0.0
 */
export type MatterContactEvidence = typeof MatterContactEvidence.Type;

/**
 * The contact-evidence setting the matter directory reads; `off` unless a
 * layer provides another value.
 *
 * **Example** (Turn contact evidence on)
 *
 * ```ts
 * import { MatterContactEvidenceSetting } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const ContactEvidence = Layer.succeed(MatterContactEvidenceSetting, "kg")
 * console.log(Layer.isLayer(ContactEvidence)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const MatterContactEvidenceSetting: Context.Reference<MatterContactEvidence> =
  Context.Reference<MatterContactEvidence>($I`MatterContactEvidenceSetting`, {
    defaultValue: () => MatterContactEvidence.Enum.off,
  });

class AddressContactRow extends S.Class<AddressContactRow>($I`AddressContactRow`)(
  {
    address: S.String,
    ...PracticeKgCorrespondentContact.fields,
  },
  $I.annote("AddressContactRow", {
    description: "One contact that owns one address, as contact_addresses lists it.",
  })
) {}

class AddressLinkRow extends S.Class<AddressLinkRow>($I`AddressLinkRow`)(
  {
    address: S.String,
    ...PracticeKgCorrespondentLink.fields,
  },
  $I.annote("AddressLinkRow", {
    description: "One link of a contact that owns one address, from contact_client_links.",
  })
) {}

class PracticeAddressRow extends S.Class<PracticeAddressRow>($I`PracticeAddressRow`)(
  {
    address: S.String,
  },
  $I.annote("PracticeAddressRow", {
    description: "An address on one of the practice's own domains.",
  })
) {}

// The same columns the correspondent lookup reads for one address, for every address at once.
const contactsSql = `
SELECT address, contact_id AS "contactId", display_name AS "displayName", organization, role_address AS "roleAddress"
FROM contact_addresses ORDER BY address, contact_id`;

const linksSql = `
SELECT a.address, l.contact_id AS "contactId", l.client_number AS "clientNumber", l.family_key AS "familyKey",
  l.source, l.evidence
FROM contact_client_links l JOIN contact_addresses a ON a.contact_id = l.contact_id
ORDER BY a.address, l.contact_id, l.family_key NULLS LAST, l.client_number, l.source, l.evidence`;

const practiceAddressesSql = `
SELECT address FROM matter_correspondents WHERE is_practice_address
UNION SELECT address FROM contact_addresses WHERE is_practice_address`;

const decodeContactRows = S.decodeUnknownEffect(S.Array(AddressContactRow));
const decodeLinkRows = S.decodeUnknownEffect(S.Array(AddressLinkRow));
const decodePracticeRows = S.decodeUnknownEffect(S.Array(PracticeAddressRow));

type AddressTables = {
  readonly contacts: Record<string, ReadonlyArray<AddressContactRow>>;
  readonly links: Record<string, ReadonlyArray<AddressLinkRow>>;
  readonly practiceAddresses: HashSet.HashSet<string>;
  readonly practiceDomains: HashSet.HashSet<string>;
  readonly matterKeys: HashSet.HashSet<string>;
};

// Every table is keyed by the normalized address, as the bundle lookup normalizes a queried address before it
// reads the rows: a differently cased or quoted copy of one address is one address, and a row whose address
// is not a mail address is no address at all.
const keyedRow = <Row extends { readonly address: string }>(row: Row): O.Option<readonly [EmailString, Row]> =>
  O.map(mailAddressOf(row.address), (address) => [address, row] as const);

const byNormalizedAddress = <Row extends { readonly address: string }>(
  rows: ReadonlyArray<Row>
): Record<string, ReadonlyArray<Row>> =>
  R.map(
    A.groupBy(A.getSomes(A.map(rows, keyedRow)), ([address]) => address),
    (group) => A.map(group, ([, row]) => row)
  );

const normalizedAddresses = (rows: ReadonlyArray<{ readonly address: string }>): ReadonlyArray<EmailString> =>
  A.getSomes(A.map(rows, (row) => mailAddressOf(row.address)));

// One contact that lists two spellings of an address is one owner, and its links are one set of links: the
// bundle builder trims and lowercases a contact's addresses but keeps their quotes, so the same contact can
// hold two `contact_addresses` rows that normalize to one address.
const oneOwnerEach = (rows: ReadonlyArray<AddressContactRow>): ReadonlyArray<AddressContactRow> =>
  A.dedupeWith(rows, (left, right) => left.contactId === right.contactId);

const oneLinkEach = (rows: ReadonlyArray<AddressLinkRow>): ReadonlyArray<AddressLinkRow> =>
  A.dedupeWith(
    rows,
    (left, right) =>
      left.contactId === right.contactId &&
      left.clientNumber === right.clientNumber &&
      left.familyKey === right.familyKey &&
      left.source === right.source &&
      left.evidence === right.evidence
  );

const domainOf = (address: EmailString): string => O.getOrElse(A.last(Str.split("@")(address)), () => "");

// The builder marks an address as the practice's own by its domain, after trimming and lowercasing only, so
// a quoted spelling of a practice address can reach the bundle unflagged. The guard therefore also holds the
// domains of the flagged addresses and applies the builder's rule to the normalized address.
const isPracticeAddress = (tables: AddressTables, address: EmailString): boolean =>
  HashSet.has(tables.practiceAddresses, address) || HashSet.has(tables.practiceDomains, domainOf(address));

const rowsAt = <Row>(byAddress: Record<string, ReadonlyArray<Row>>, address: string): ReadonlyArray<Row> =>
  O.getOrElse(R.get(byAddress, address), (): ReadonlyArray<Row> => []);

// Message-count candidates only separate `ambiguous` from `none`; a unique answer never reads them.
const evidenceAt = (tables: AddressTables, address: EmailString): PracticeKgCorrespondentEvidence => {
  const links = A.map(oneLinkEach(rowsAt(tables.links, address)), (row) => PracticeKgCorrespondentLink.make(row));
  return PracticeKgCorrespondentEvidence.make({
    candidates: [],
    contacts: A.map(oneOwnerEach(rowsAt(tables.contacts, address)), (row) => PracticeKgCorrespondentContact.make(row)),
    links,
    matterFamilyKeys: A.dedupe(
      A.filter(A.getSomes(A.map(links, (link) => O.fromNullishOr(link.familyKey))), (familyKey) =>
        HashSet.has(tables.matterKeys, familyKey)
      )
    ),
    practiceAddress: isPracticeAddress(tables, address),
  });
};

const uniqueMatterOf =
  (tables: AddressTables) =>
  (address: EmailString): O.Option<readonly [string, EmailString]> =>
    O.map(
      O.fromNullishOr(resolvePracticeKgCorrespondent(evidenceAt(tables, address)).familyKey),
      (familyKey) => [familyKey, address] as const
    );

const groupedByMatter = (
  pairs: ReadonlyArray<readonly [string, EmailString]>
): Record<string, ReadonlyArray<EmailString>> =>
  R.map(
    A.groupBy(pairs, ([familyKey]) => familyKey),
    (group) => A.dedupe(A.map(group, ([, address]) => address))
  );

const unreadable = () => MailTaggingPortError.during("MatterDirectory", "snapshot", "correspondent tables unreadable");

/**
 * Reads, for every matter, the addresses the practice knowledge graph
 * resolves `unique` to it.
 *
 * **Details**
 *
 * Every address of `contact_addresses` is resolved with the correspondent
 * lookup's own rule, `resolvePracticeKgCorrespondent`, over the same rows the
 * lookup reads for one address: the contacts that own it, their links, and
 * whether it is a practice address. Addresses are normalized before the rows
 * are grouped and looked up, as the lookup itself normalizes a queried
 * address, so two spellings of one address are one address. Only a `unique`
 * answer counts, so a candidate, a role mailbox, a practice address, and an
 * address shared by two contacts are never evidence. A row whose address is
 * not a mail address is dropped. One contact listing two spellings of an
 * address is one owner, and an address on the domain of any flagged practice
 * address is a practice address, as the builder flags by domain.
 *
 * **Example** (Read the correspondents of a bundle)
 *
 * ```ts
 * import { uniqueMatterCorrespondents } from "@beep/law-practice-server/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const correspondents = uniqueMatterCorrespondents(["1234.10001"])
 * console.log(Effect.isEffect(correspondents)) // true
 * ```
 *
 * @param matterKeys - Family keys of the bundle's matters.
 * @returns The unique addresses of each matter, keyed by family key.
 * @category use-cases
 * @since 0.0.0
 */
export const uniqueMatterCorrespondents = Effect.fn("MatterDirectoryPracticeKg.uniqueCorrespondents")(function* (
  matterKeys: ReadonlyArray<string>
): Effect.fn.Return<Record<string, ReadonlyArray<EmailString>>, MailTaggingPortError, DuckDb> {
  const db = yield* DuckDb;
  const read = <Row>(statement: string, decode: (rows: unknown) => Effect.Effect<Row, S.SchemaError>) =>
    db.query(statement).pipe(Effect.flatMap(decode), Effect.mapError(unreadable));
  const contacts = yield* read(contactsSql, decodeContactRows);
  const practiceAddresses = normalizedAddresses(yield* read(practiceAddressesSql, decodePracticeRows));
  const tables: AddressTables = {
    contacts: byNormalizedAddress(contacts),
    links: byNormalizedAddress(yield* read(linksSql, decodeLinkRows)),
    practiceAddresses: HashSet.fromIterable(practiceAddresses),
    practiceDomains: HashSet.fromIterable(A.map(practiceAddresses, domainOf)),
    matterKeys: HashSet.fromIterable(matterKeys),
  };
  return pipe(A.dedupe(normalizedAddresses(contacts)), A.map(uniqueMatterOf(tables)), A.getSomes, groupedByMatter);
});
