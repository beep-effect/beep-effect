/**
 * The proposition algebra: what a claim can say.
 *
 * **Details**
 * Every variant names its roles (`member`, `organization`, `subordinate`,
 * `superior`...) instead of `{ source, target, edgeType, direction }`, so the
 * schema itself rejects type-confused relations. Party endpoints use the shared
 * integer identity; account and voice endpoints carry distinct string brands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { thunkEmptyArray } from "@beep/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { AccountId, ConceptIri, ContextRef, IdentifierId, VoiceId } from "../../Ids.ts";
import { PartyKey } from "../../PartyKey.ts";

const $I = $PartyDomainId.create("values/Proposition/Proposition.model");

/**
 * How an identifier relates to a party. `used-by` is weaker than
 * `controlled-by`; `represents` is what a role mailbox does for a department.
 *
 * **Example** (IdentifierRelation public surface)
 *
 * ```ts
 * import { IdentifierRelation } from "@beep/party-domain/Proposition"
 * IdentifierRelation.make("used-by")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdentifierRelation = LiteralKit([
  "used-by",
  "controlled-by",
  "owned-by",
  "operated-by",
  "represents",
]).pipe($I.annoteSchema("IdentifierRelation", { description: "How an identifier or account relates to a party." }));
/**
 * Decoded IdentifierRelation type.
 * @category models
 * @since 0.0.0
 */
export type IdentifierRelation = typeof IdentifierRelation.Type;

/**
 * Name kinds. A name is a dated claim, not a party field.
 *
 * **Example** (NameKind public surface)
 *
 * ```ts
 * import { NameKind } from "@beep/party-domain/Proposition"
 * NameKind.make("legal")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NameKind = LiteralKit([
  "legal",
  "preferred",
  "former",
  "nickname",
  "observed-display",
  "transliteration",
]).pipe($I.annoteSchema("NameKind", { description: "Kind of name a party is known by." }));

/**
 * Runtime name-kind vocabulary.
 * @category models
 * @since 0.0.0
 */
export type NameKind = typeof NameKind.Type;

const distinctPair = <L extends string, R extends string>(tag: string, left: L, right: R) =>
  S.makeFilter(
    (value: Record<L | R, unknown>) => value[left] !== value[right],
    $I.annote(`${tag}DistinctRolesCheck`, {
      description: `The ${left} and ${right} roles identify distinct parties.`,
      message: `Expected ${left} and ${right} to be different parties.`,
    })
  );

/**
 * SameParty assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { SameParty } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SameParty)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SameParty extends S.Opaque<SameParty, { readonly brand: unique symbol }>()(
  S.TaggedStruct("SameParty", { left: PartyId, right: PartyId }).pipe(
    $I.annoteSchema("SameParty", { description: "SameParty proposition with explicit role endpoints." })
  )
) {}

/**
 * DistinctParty assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { DistinctParty } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DistinctParty)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DistinctParty extends S.Opaque<DistinctParty, { readonly brand: unique symbol }>()(
  S.TaggedStruct("DistinctParty", { left: PartyId, right: PartyId }).pipe(
    $I.annoteSchema("DistinctParty", { description: "DistinctParty proposition with explicit role endpoints." })
  )
) {}

/**
 * ReportsTo assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { ReportsTo } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ReportsTo)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReportsTo extends S.Opaque<ReportsTo, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ReportsTo", {
    subordinate: PartyId,
    superior: PartyId,
    organization: S.OptionFromNullOr(PartyId),
  }).pipe($I.annoteSchema("ReportsTo", { description: "ReportsTo proposition with explicit role endpoints." }))
) {}

/**
 * DelegateOf assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { DelegateOf } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DelegateOf)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DelegateOf extends S.Opaque<DelegateOf, { readonly brand: unique symbol }>()(
  S.TaggedStruct("DelegateOf", {
    delegate: PartyId,
    principal: PartyId,
    account: S.OptionFromNullOr(AccountId),
  }).pipe($I.annoteSchema("DelegateOf", { description: "DelegateOf proposition with explicit role endpoints." }))
) {}

/**
 * KeyAssignment assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { KeyAssignment } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(KeyAssignment)
 * ```
 * @category models
 * @since 0.0.0
 */
export class KeyAssignment extends S.Opaque<KeyAssignment, { readonly brand: unique symbol }>()(
  S.TaggedStruct("KeyAssignment", { key: PartyKey, party: PartyId }).pipe(
    $I.annoteSchema("KeyAssignment", { description: "KeyAssignment proposition with explicit role endpoints." })
  )
) {}

/**
 * IdentifierOf assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { IdentifierOf } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(IdentifierOf)
 * ```
 * @category models
 * @since 0.0.0
 */
export class IdentifierOf extends S.Opaque<IdentifierOf, { readonly brand: unique symbol }>()(
  S.TaggedStruct("IdentifierOf", { identifier: IdentifierId, party: PartyId, relation: IdentifierRelation }).pipe(
    $I.annoteSchema("IdentifierOf", { description: "IdentifierOf proposition with explicit role endpoints." })
  )
) {}

/**
 * AccountIdentifier assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { AccountIdentifier } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AccountIdentifier)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AccountIdentifier extends S.Opaque<AccountIdentifier, { readonly brand: unique symbol }>()(
  S.TaggedStruct("AccountIdentifier", { account: AccountId, identifier: IdentifierId }).pipe(
    $I.annoteSchema("AccountIdentifier", { description: "AccountIdentifier proposition with explicit role endpoints." })
  )
) {}

/**
 * MailboxKind assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { MailboxKind } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailboxKind)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailboxKind extends S.Opaque<MailboxKind, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MailboxKind", {
    account: AccountId,
    kind: LiteralKit(["individual", "shared", "role", "distribution-list", "system"]),
  }).pipe($I.annoteSchema("MailboxKind", { description: "MailboxKind proposition with explicit role endpoints." }))
) {}

/**
 * AccountControl assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { AccountControl } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AccountControl)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AccountControl extends S.Opaque<AccountControl, { readonly brand: unique symbol }>()(
  S.TaggedStruct("AccountControl", { account: AccountId, controller: PartyId, relation: IdentifierRelation }).pipe(
    $I.annoteSchema("AccountControl", { description: "AccountControl proposition with explicit role endpoints." })
  )
) {}

/**
 * VoiceAuthor assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { VoiceAuthor } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(VoiceAuthor)
 * ```
 * @category models
 * @since 0.0.0
 */
export class VoiceAuthor extends S.Opaque<VoiceAuthor, { readonly brand: unique symbol }>()(
  S.TaggedStruct("VoiceAuthor", { voice: VoiceId, author: PartyId }).pipe(
    $I.annoteSchema("VoiceAuthor", { description: "VoiceAuthor proposition with explicit role endpoints." })
  )
) {}

/**
 * PartyName assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { PartyName } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PartyName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PartyName extends S.Opaque<PartyName, { readonly brand: unique symbol }>()(
  S.TaggedStruct("PartyName", { party: PartyId, nameKind: NameKind, value: S.NonEmptyString }).pipe(
    $I.annoteSchema("PartyName", { description: "PartyName proposition with explicit role endpoints." })
  )
) {}

/**
 * Membership assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { Membership } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Membership)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Membership extends S.Opaque<Membership, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Membership", {
    member: PartyId,
    organization: PartyId,
    role: S.OptionFromNullOr(ConceptIri),
    title: S.OptionFromNullOr(S.String),
  }).pipe($I.annoteSchema("Membership", { description: "Membership proposition with explicit role endpoints." }))
) {}

/**
 * ContextRole assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { ContextRole } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ContextRole)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContextRole extends S.Opaque<ContextRole, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ContextRole", { party: PartyId, context: ContextRef, role: ConceptIri }).pipe(
    $I.annoteSchema("ContextRole", { description: "ContextRole proposition with explicit role endpoints." })
  )
) {}

/**
 * External assertion payload with explicit role fields.
 *
 * **Example** (Decode an assertion payload)
 * ```ts
 * import { External } from "@beep/party-domain/Proposition"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(External)
 * ```
 * @category models
 * @since 0.0.0
 */
export class External extends S.Opaque<External, { readonly brand: unique symbol }>()(
  S.TaggedStruct("External", { subject: PartyId, object: PartyId, predicate: ConceptIri }).pipe(
    $I.annoteSchema("External", { description: "External proposition with explicit role endpoints." })
  )
) {}

/**
 * The closed set of propositions the party model admits. `External` is the
 * explicit, recognizable extension case for SKOS/AgRelOn relationship kinds;
 * there is no stringly-typed fallback.
 *
 * **Example** (Proposition public surface)
 *
 * ```ts
 * import { Proposition } from "@beep/party-domain/Proposition"
 * Proposition.isAnyOf(["SameParty"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Proposition = S.Union([
  KeyAssignment,
  // identity
  IdentifierOf,
  AccountIdentifier,
  MailboxKind,
  AccountControl,
  VoiceAuthor,
  SameParty.check(distinctPair("SameParty", "left", "right")),
  DistinctParty.check(distinctPair("DistinctParty", "left", "right")),
  PartyName,
  // organization
  Membership,
  ReportsTo.check(distinctPair("ReportsTo", "subordinate", "superior")),
  DelegateOf.check(distinctPair("DelegateOf", "delegate", "principal")),
  // context: client, custodian, witness, inventor, opposing counsel, target...
  ContextRole,
  // extension
  External,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Proposition", { description: "Closed, role-named proposition algebra." })
);
/**
 * Decoded Proposition type.
 * @category models
 * @since 0.0.0
 */
export type Proposition = typeof Proposition.Type;

/**
 * Deterministic logical key: the "same fact" across assertions and versions.
 * Symmetric propositions order their endpoints so `Same(a,b) ≡ Same(b,a)`.
 *
 * @category schemas
 * @since 0.0.0
 */
const keyParts = Proposition.match({
  KeyAssignment: (p) => ["KeyAssignment", p.key],
  IdentifierOf: (p) => ["IdentifierOf", p.identifier, `${p.party}`, p.relation],
  AccountIdentifier: (p) => ["AccountIdentifier", p.account, p.identifier],
  MailboxKind: (p) => ["MailboxKind", p.account],
  AccountControl: (p) => ["AccountControl", p.account, `${p.controller}`, p.relation],
  VoiceAuthor: (p) => ["VoiceAuthor", p.voice, `${p.author}`],
  SameParty: (p) => ["SameParty", ...A.map(A.sort([p.left, p.right], Order.Number), (id) => `${id}`)],
  DistinctParty: (p) => ["DistinctParty", ...A.map(A.sort([p.left, p.right], Order.Number), (id) => `${id}`)],
  PartyName: (p) => ["PartyName", `${p.party}`, p.nameKind, p.value],
  Membership: (p) => ["Membership", `${p.member}`, `${p.organization}`],
  ReportsTo: (p) => ["ReportsTo", `${p.subordinate}`, `${p.superior}`],
  DelegateOf: (p) => ["DelegateOf", `${p.delegate}`, `${p.principal}`],
  ContextRole: (p) => ["ContextRole", `${p.party}`, p.context, p.role],
  External: (p) => ["External", `${p.subject}`, p.predicate, `${p.object}`],
});

/**
 * Length-framed proposition identity, including symmetric numeric endpoint ordering.
 *
 * **Example** (No delimiter collision)
 *
 * ```ts
 * import { logicalKey, Proposition } from "@beep/party-domain/Proposition"
 * import { PartyId } from "@beep/shared-domain/identity/Party"
 * logicalKey(Proposition.cases.SameParty.make({ left: PartyId.make(1), right: PartyId.make(2) }))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const logicalKey = (proposition: Proposition): string =>
  pipe(
    keyParts(proposition),
    A.map((part) => `${part.length}:${part}`),
    A.join("")
  );

/**
 * Parties a proposition mentions, by role. Exhaustive: a new variant fails to
 * compile until it states its participants.
 *
 * **Example** (partiesOf public surface)
 *
 * ```ts
 * import { partiesOf } from "@beep/party-domain/Proposition"
 * const participants = partiesOf
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const partiesOf = Proposition.match({
  KeyAssignment: (p) => [p.party],
  IdentifierOf: (p) => [p.party],
  AccountIdentifier: thunkEmptyArray<PartyId>(),
  MailboxKind: thunkEmptyArray<PartyId>(),
  AccountControl: (p) => [p.controller],
  VoiceAuthor: (p) => [p.author],
  SameParty: (p) => [p.left, p.right],
  DistinctParty: (p) => [p.left, p.right],
  PartyName: (p) => [p.party],
  Membership: (p) => [p.member, p.organization],
  ReportsTo: (p) => [p.subordinate, p.superior],
  DelegateOf: (p) => [p.delegate, p.principal],
  ContextRole: (p) => [p.party],
  External: (p) => [p.subject, p.object],
});
