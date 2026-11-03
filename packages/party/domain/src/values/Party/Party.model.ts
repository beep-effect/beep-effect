/**
 * Canonical parties, identifiers, and accounts.
 *
 * **Details**
 * The rule this file enforces by omission: a party carries no email, phone,
 * handle, title, or employer field. Everything that changes over time or can
 * be shared lives in its own record and reaches a party only through an
 * evidence-backed claim (see `Proposition.ts`).
 *
 * ```text
 * Party ≠ Account ≠ Identifier ≠ Voice ≠ Observation ≠ Claim
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as S from "effect/Schema";
import { AccountId, ConceptIri } from "../../Ids.ts";
import { PartyKey } from "../../PartyKey.ts";

const $I = $PartyDomainId.create("values/Party/Party.model");

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------

/**
 * Kinds of collective agent that have their own identity, lifecycle, or
 * relationships (the promotion rule: a grouping becomes a party only when it
 * has a life of its own; otherwise it stays a relationship episode).
 *
 * **Example** (Decode CollectiveKind)
 * ```ts
 * import { CollectiveKind } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CollectiveKind)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CollectiveKind = LiteralKit(["household", "team", "committee", "joint-venture", "other"]).pipe(
  $I.annoteSchema("CollectiveKind", { description: "Kinds of collective agent with their own identity." })
);
/**
 * Decoded CollectiveKind type.
 * @category models
 * @since 0.0.0
 */
export type CollectiveKind = typeof CollectiveKind.Type;

/**
 * A canonical party: who we currently mean, independent of every role,
 * account, and identifier. "Client", "custodian", "target", "inventor" and
 * "defendant" are context roles (`ContextRole`), never party kinds.
 *
 * **Example** (Decode Person)
 * ```ts
 * import { Person } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Person)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Person extends S.Opaque<Person, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Person", {
    id: PartyId,
    keys: S.Array(PartyKey),
    /** Display only. Names are claims (`PartyName`), never identity. */
    label: S.NonEmptyString,
  }).pipe($I.annoteSchema("Person", { description: "Person data." }))
) {}
/**
 * Organization payload with validated role fields.
 *
 * **Example** (Decode Organization)
 * ```ts
 * import { Organization } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Organization)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Organization extends S.Opaque<Organization, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Organization", {
    id: PartyId,
    keys: S.Array(PartyKey),
    label: S.NonEmptyString,
    /** Open classification (company, department, law firm, patent office...). */
    orgKind: S.OptionFromNullOr(ConceptIri),
  }).pipe($I.annoteSchema("Organization", { description: "Organization data." }))
) {}
/**
 * CollectiveAgent payload with validated role fields.
 *
 * **Example** (Decode CollectiveAgent)
 * ```ts
 * import { CollectiveAgent } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CollectiveAgent)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CollectiveAgent extends S.Opaque<CollectiveAgent, { readonly brand: unique symbol }>()(
  S.TaggedStruct("CollectiveAgent", {
    id: PartyId,
    keys: S.Array(PartyKey),
    label: S.NonEmptyString,
    collectiveKind: CollectiveKind,
  }).pipe($I.annoteSchema("CollectiveAgent", { description: "CollectiveAgent data." }))
) {}
/**
 * Party public schema for the party model.
 *
 * **Example** (Decode Party)
 * ```ts
 * import { Party } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Party)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Party = S.Union([Person, Organization, CollectiveAgent]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Party", { description: "Canonical person, organization, or collective agent." })
);
/**
 * Decoded Party type.
 * @category models
 * @since 0.0.0
 */
export type Party = typeof Party.Type;

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/**
 * Mail system hosting a mailbox.
 *
 * **Example** (Decode MailSystem)
 * ```ts
 * import { MailSystem } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailSystem)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const MailSystem = LiteralKit(["exchange", "google-workspace", "imap", "unknown"]).pipe(
  $I.annoteSchema("MailSystem", { description: "Mail system hosting a mailbox." })
);
/**
 * Decoded MailSystem vocabulary.
 * @category models
 * @since 0.0.0
 */
export type MailSystem = typeof MailSystem.Type;

/**
 * An account: a durable thing on a system that identifiers point at and
 * people operate. Whether a mailbox is individual or shared is evidence
 * (`MailboxKind` proposition), not a field, because productions often reveal
 * it late (an Exchange permissions export arrives in a later tranche).
 *
 * **Example** (Decode Mailbox)
 * ```ts
 * import { Mailbox } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Mailbox)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Mailbox extends S.Opaque<Mailbox, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Mailbox", { id: AccountId, system: MailSystem }).pipe(
    $I.annoteSchema("Mailbox", { description: "Mailbox data." })
  )
) {}
/**
 * SocialAccount payload with validated role fields.
 *
 * **Example** (Decode SocialAccount)
 * ```ts
 * import { SocialAccount } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SocialAccount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SocialAccount extends S.Opaque<SocialAccount, { readonly brand: unique symbol }>()(
  S.TaggedStruct("SocialAccount", { id: AccountId, service: ConceptIri }).pipe(
    $I.annoteSchema("SocialAccount", { description: "SocialAccount data." })
  )
) {}
/**
 * PhoneLine payload with validated role fields.
 *
 * **Example** (Decode PhoneLine)
 * ```ts
 * import { PhoneLine } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PhoneLine)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PhoneLine extends S.Opaque<PhoneLine, { readonly brand: unique symbol }>()(
  S.TaggedStruct("PhoneLine", { id: AccountId, carrier: S.OptionFromNullOr(S.String) }).pipe(
    $I.annoteSchema("PhoneLine", { description: "PhoneLine data." })
  )
) {}
/**
 * ChatAccount payload with validated role fields.
 *
 * **Example** (Decode ChatAccount)
 * ```ts
 * import { ChatAccount } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ChatAccount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ChatAccount extends S.Opaque<ChatAccount, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ChatAccount", { id: AccountId, service: ConceptIri }).pipe(
    $I.annoteSchema("ChatAccount", { description: "ChatAccount data." })
  )
) {}
/**
 * Account public schema for the party model.
 *
 * **Example** (Decode Account)
 * ```ts
 * import { Account } from "@beep/party-domain/Party"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Account)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Account = S.Union([Mailbox, SocialAccount, PhoneLine, ChatAccount]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Account", { description: "Account on some system; never a party." })
);
/**
 * Decoded Account type.
 * @category models
 * @since 0.0.0
 */
export type Account = typeof Account.Type;
