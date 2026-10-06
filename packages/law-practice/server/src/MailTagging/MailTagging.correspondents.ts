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
  readonly matterKeys: HashSet.HashSet<string>;
};

const addressOf = (row: { readonly address: string }): string => row.address;

const rowsAt = <Row>(byAddress: Record<string, ReadonlyArray<Row>>, address: string): ReadonlyArray<Row> =>
  O.getOrElse(R.get(byAddress, address), (): ReadonlyArray<Row> => []);

// Message-count candidates only separate `ambiguous` from `none`; a unique answer never reads them.
const evidenceAt = (tables: AddressTables, address: string): PracticeKgCorrespondentEvidence => {
  const links = A.map(rowsAt(tables.links, address), (row) => PracticeKgCorrespondentLink.make(row));
  return PracticeKgCorrespondentEvidence.make({
    candidates: [],
    contacts: A.map(rowsAt(tables.contacts, address), (row) => PracticeKgCorrespondentContact.make(row)),
    links,
    matterFamilyKeys: A.dedupe(
      A.filter(A.getSomes(A.map(links, (link) => O.fromNullishOr(link.familyKey))), (familyKey) =>
        HashSet.has(tables.matterKeys, familyKey)
      )
    ),
    practiceAddress: HashSet.has(tables.practiceAddresses, address),
  });
};

const uniqueMatterOf =
  (tables: AddressTables) =>
  (address: string): O.Option<readonly [string, EmailString]> =>
    O.all([
      O.fromNullishOr(resolvePracticeKgCorrespondent(evidenceAt(tables, address)).familyKey),
      mailAddressOf(address),
    ]);

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
 * whether it is a practice address. Only a `unique` answer counts, so a
 * candidate, a role mailbox, a practice address, and an address shared by two
 * contacts are never evidence. An address that is not then a usable mail
 * address is dropped.
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
  const tables: AddressTables = {
    contacts: A.groupBy(contacts, addressOf),
    links: A.groupBy(yield* read(linksSql, decodeLinkRows), addressOf),
    practiceAddresses: HashSet.fromIterable(A.map(yield* read(practiceAddressesSql, decodePracticeRows), addressOf)),
    matterKeys: HashSet.fromIterable(matterKeys),
  };
  return pipe(A.dedupe(A.map(contacts, addressOf)), A.map(uniqueMatterOf(tables)), A.getSomes, groupedByMatter);
});
