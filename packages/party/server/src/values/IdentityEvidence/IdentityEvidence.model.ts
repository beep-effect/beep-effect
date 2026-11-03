/**
 * Schema-owned mailbox evidence and identity review inputs.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyServerId } from "@beep/identity/packages";
import { AccountId, AssertionId, EventId, IdentifierId } from "@beep/party-domain/Ids";
import { LiteralKit } from "@beep/schema";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AliasPairing } from "../MailIndex/MailIndex.model.ts";

const $I = $PartyServerId.create("values/IdentityEvidence/IdentityEvidence.model");

/**
 * Aggregated same-message support for one DN/SMTP mailbox pairing.
 * **Example** (Decode PairingSupport)
 * ```ts
 * import { PairingSupport } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PairingSupport)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PairingSupport extends S.Opaque<PairingSupport, { readonly brand: unique symbol }>()(
  S.Struct({
    mailbox: AccountId,
    exchangeDn: IdentifierId,
    smtp: IdentifierId,
    messages: S.Natural,
    firstSeen: S.OptionFromNullOr(S.DateTimeUtcFromMillis),
    lastSeen: S.OptionFromNullOr(S.DateTimeUtcFromMillis),
    sample: S.Array(EventId),
    assertions: S.Array(AssertionId),
  })
    .check(
      S.makeFilter(
        (support) =>
          O.match(O.all([support.firstSeen, support.lastSeen]), {
            onNone: () => O.isNone(support.firstSeen) && O.isNone(support.lastSeen),
            onSome: ([first, last]) => DateTime.toEpochMillis(first) <= DateTime.toEpochMillis(last),
          }),
        $I.annote("OrderedPairingBounds", {
          message: "Pairing bounds must both be absent or ordered first through last.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("PairingSupport", {
        description: "Aggregated same-message support for one DN/SMTP mailbox pairing.",
      })
    )
) {}

/**
 * Identifiers and pairing edges for a review-only mailbox graph.
 * **Example** (Decode MailboxClusterInput)
 * ```ts
 * import { MailboxClusterInput } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailboxClusterInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailboxClusterInput extends S.Opaque<MailboxClusterInput, { readonly brand: unique symbol }>()(
  S.Struct({ identifiers: S.Array(IdentifierId), supports: S.Array(PairingSupport) }).pipe(
    $I.annoteSchema("MailboxClusterInput", {
      description: "Identifiers and pairing edges for a review-only mailbox graph.",
    })
  )
) {}

/**
 * One name’s identifiers and their mailbox cluster map.
 * **Example** (Decode MailboxGroupInput)
 * ```ts
 * import { MailboxGroupInput } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailboxGroupInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailboxGroupInput extends S.Opaque<MailboxGroupInput, { readonly brand: unique symbol }>()(
  S.Struct({ identifiers: S.Array(IdentifierId), clusters: S.HashMap(IdentifierId, S.Natural) }).pipe(
    $I.annoteSchema("MailboxGroupInput", { description: "One name’s identifiers and their mailbox cluster map." })
  )
) {}

/**
 * The identifiers observed under one display-name spelling.
 * **Example** (Decode NamedIdentifiers)
 * ```ts
 * import { NamedIdentifiers } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(NamedIdentifiers)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NamedIdentifiers extends S.Opaque<NamedIdentifiers, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.String, identifiers: S.Array(IdentifierId) }).pipe(
    $I.annoteSchema("NamedIdentifiers", { description: "The identifiers observed under one display-name spelling." })
  )
) {}

/**
 * Name collisions compared with contact-card evidence.
 * **Example** (Decode CollisionInput)
 * ```ts
 * import { CollisionInput } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CollisionInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CollisionInput extends S.Opaque<CollisionInput, { readonly brand: unique symbol }>()(
  S.Struct({
    identifiersByName: S.Array(NamedIdentifiers),
    clusters: S.HashMap(IdentifierId, S.Natural),
    contactsOf: S.HashMap(IdentifierId, S.HashSet(PartyId)),
  }).pipe($I.annoteSchema("CollisionInput", { description: "Name collisions compared with contact-card evidence." }))
) {}

/**
 * Contact evidence outcome for review, not canonical identity.
 * **Example** (Validate a collision outcome)
 * ```ts
 * import { CollisionOutcome } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const accepts = S.is(CollisionOutcome)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CollisionOutcome = LiteralKit([
  "same-person",
  "distinct-people",
  "conflicting-contacts",
  "partially-resolved",
  "unresolved",
]).pipe($I.annoteSchema("CollisionOutcome", { description: "Contact-evidence review classification." }));
/**
 * Decoded collision outcome.
 * @category models
 * @since 0.0.0
 */
export type CollisionOutcome = typeof CollisionOutcome.Type;

/**
 * One name spanning multiple mailbox groups and its review outcome.
 * **Example** (Decode Collision)
 * ```ts
 * import { Collision } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Collision)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Collision extends S.Opaque<Collision, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.String, mailboxes: IdentifierId.pipe(S.NonEmptyArray, S.Array), outcome: CollisionOutcome }).pipe(
    $I.annoteSchema("Collision", { description: "One name spanning multiple mailbox groups and its review outcome." })
  )
) {}

/**
 * One source card’s personal identifier; shared addresses must be excluded by the caller.
 * **Example** (Decode CardIdentifier)
 * ```ts
 * import { CardIdentifier } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CardIdentifier)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CardIdentifier extends S.Opaque<CardIdentifier, { readonly brand: unique symbol }>()(
  S.Struct({
    identifier: IdentifierId,
    kind: S.Literals(["EmailAddress", "PhoneNumber", "other"]),
    card: PartyId,
    source: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CardIdentifier", {
      description: "One source card’s personal identifier; shared addresses must be excluded by the caller.",
    })
  )
) {}

/**
 * A conservative cross-source candidate requiring human identity review.
 * **Example** (Decode CardMergeProposal)
 * ```ts
 * import { CardMergeProposal } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CardMergeProposal)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CardMergeProposal extends S.Opaque<CardMergeProposal, { readonly brand: unique symbol }>()(
  S.Struct({ identifier: IdentifierId, left: PartyId, right: PartyId }).pipe(
    $I.annoteSchema("CardMergeProposal", {
      description: "A conservative cross-source candidate requiring human identity review.",
    })
  )
) {}

/**
 * Temporal review lead for one SMTP identifier paired with multiple DNs.
 * **Example** (Validate a drift kind)
 * ```ts
 * import { DriftKind } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const accepts = S.is(DriftKind)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const DriftKind = LiteralKit(["sequential-migration", "concurrent-aliases", "undated"]).pipe(
  $I.annoteSchema("DriftKind", { description: "Observed mailbox drift, not an accepted identity claim." })
);
/**
 * Decoded drift kind.
 * @category models
 * @since 0.0.0
 */
export type DriftKind = typeof DriftKind.Type;

/**
 * An SMTP identifier's distinct DN count and temporal review lead.
 * **Example** (Decode DriftEvidence)
 * ```ts
 * import { DriftEvidence } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DriftEvidence)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DriftEvidence extends S.Opaque<DriftEvidence, { readonly brand: unique symbol }>()(
  S.Struct({ smtp: IdentifierId, kind: DriftKind, dns: S.Natural }).pipe(
    $I.annoteSchema("DriftEvidence", { description: "Review-only temporal relationship across distinct mailbox DNs." })
  )
) {}

/**
 * One source-backed alias pairing with its optional message time.
 * **Example** (Decode PairingObservation)
 * ```ts
 * import { PairingObservation } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PairingObservation)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PairingObservation extends S.Opaque<PairingObservation, { readonly brand: unique symbol }>()(
  S.Struct({ pairing: AliasPairing, sentAt: S.OptionFromNullOr(S.DateTimeUtcFromMillis) }).pipe(
    $I.annoteSchema("PairingObservation", {
      description: "Source-backed alias pairing and optional observed message time.",
    })
  )
) {}

/**
 * Alias observations and the maximum number of distinct sampled messages.
 * **Example** (Decode PairingAggregationInput)
 * ```ts
 * import { PairingAggregationInput } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PairingAggregationInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PairingAggregationInput extends S.Opaque<PairingAggregationInput, { readonly brand: unique symbol }>()(
  S.Struct({ observations: S.Array(PairingObservation), sampleSize: S.Natural }).pipe(
    $I.annoteSchema("PairingAggregationInput", { description: "Deterministic alias support aggregation input." })
  )
) {}

/**
 * Aggregated pairing evidence and the knowledge time of its proposed claims.
 * **Example** (Decode PairingClaimsInput)
 * ```ts
 * import { PairingClaimsInput } from "@beep/party-server/IdentityEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PairingClaimsInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PairingClaimsInput extends S.Opaque<PairingClaimsInput, { readonly brand: unique symbol }>()(
  S.Struct({ supports: S.Array(PairingSupport), recordedAt: S.DateTimeUtcFromMillis }).pipe(
    $I.annoteSchema("PairingClaimsInput", { description: "Source-backed pairing support and proposal knowledge time." })
  )
) {}
