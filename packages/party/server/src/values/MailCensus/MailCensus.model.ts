/**
 * Mail census evidence state and count-only public summaries.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyServerId } from "@beep/identity/packages";
import { AssertionId, IdentifierId, VoiceId } from "@beep/party-domain/Ids";
import * as S from "effect/Schema";
import { PairingObservation } from "../IdentityEvidence/IdentityEvidence.model.ts";
import { ObservedSpan } from "../OrgEvidence/OrgEvidence.model.ts";

const $I = $PartyServerId.create("values/MailCensus/MailCensus.model");

/**
 * Immutable census evidence state; contains private identifiers and names.
 * **Example** (Decode MailCensus)
 * ```ts
 * import { MailCensus } from "@beep/party-server/MailCensus"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailCensus)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailCensus extends S.Opaque<MailCensus, { readonly brand: unique symbol }>()(
  S.Struct({
    rows: S.Natural,
    decodeFailures: S.Natural,
    events: S.Natural,
    delegatedEvents: S.Natural,
    issues: S.HashMap(S.String, S.Natural),
    identifierKinds: S.HashMap(IdentifierId, S.String),
    namesByIdentifier: S.HashMap(IdentifierId, S.HashSet(S.String)),
    identifiersByName: S.HashMap(S.String, S.HashSet(IdentifierId)),
    smtpByDn: S.HashMap(IdentifierId, S.HashSet(IdentifierId)),
    dnBySmtp: S.HashMap(IdentifierId, S.HashSet(IdentifierId)),
    delegatedVoices: S.HashSet(VoiceId),
    pairingObservations: S.HashMap(AssertionId, PairingObservation),
    identifierSpans: S.HashMap(IdentifierId, ObservedSpan),
  }).pipe(
    $I.annoteSchema("MailCensus", {
      description: "Immutable census evidence state; contains private identifiers and names.",
    })
  )
) {}

/**
 * Count distribution with fixed buckets and a maximum.
 * **Example** (Decode CensusHistogram)
 * ```ts
 * import { CensusHistogram } from "@beep/party-server/MailCensus"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CensusHistogram)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CensusHistogram extends S.Opaque<CensusHistogram, { readonly brand: unique symbol }>()(
  S.Struct({ "1": S.Natural, "2": S.Natural, "3-5": S.Natural, "6+": S.Natural, max: S.Natural }).pipe(
    $I.annoteSchema("CensusHistogram", { description: "Count distribution with fixed buckets and a maximum." })
  )
) {}

/**
 * Distinct identifier counts by the mail identifier families.
 * **Example** (Decode IdentifierCounts)
 * ```ts
 * import { IdentifierCounts } from "@beep/party-server/MailCensus"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(IdentifierCounts)
 * ```
 * @category models
 * @since 0.0.0
 */
export class IdentifierCounts extends S.Opaque<IdentifierCounts, { readonly brand: unique symbol }>()(
  S.Struct({ total: S.Natural, email: S.Natural, exchangeDn: S.Natural }).pipe(
    $I.annoteSchema("IdentifierCounts", { description: "Distinct identifier counts by the mail identifier families." })
  )
) {}

/**
 * Counts of observed DN and SMTP pairing coverage.
 * **Example** (Decode ExchangeUnificationCounts)
 * ```ts
 * import { ExchangeUnificationCounts } from "@beep/party-server/MailCensus"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ExchangeUnificationCounts)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExchangeUnificationCounts extends S.Opaque<ExchangeUnificationCounts, { readonly brand: unique symbol }>()(
  S.Struct({
    dnsWithSmtpPairing: S.Natural,
    dnsWithoutPairing: S.Natural,
    dnsPairedToMultipleSmtp: S.Natural,
    smtpPairedToMultipleDns: S.Natural,
  }).pipe(
    $I.annoteSchema("ExchangeUnificationCounts", { description: "Counts of observed DN and SMTP pairing coverage." })
  )
) {}

/**
 * Message and distinct voice counts for delegated mail.
 * **Example** (Decode DelegationCounts)
 * ```ts
 * import { DelegationCounts } from "@beep/party-server/MailCensus"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DelegationCounts)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DelegationCounts extends S.Opaque<DelegationCounts, { readonly brand: unique symbol }>()(
  S.Struct({ delegatedEvents: S.Natural, distinctDelegatedVoices: S.Natural }).pipe(
    $I.annoteSchema("DelegationCounts", { description: "Message and distinct voice counts for delegated mail." })
  )
) {}

/**
 * Count-only mail summary without source names, addresses or identifier values.
 * **Example** (Decode CensusSummary)
 * ```ts
 * import { CensusSummary } from "@beep/party-server/MailCensus"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CensusSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CensusSummary extends S.Opaque<CensusSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    rows: S.Natural,
    decodeFailures: S.Natural,
    events: S.Natural,
    issues: S.Record(S.String, S.Natural),
    identifiers: IdentifierCounts,
    displayNames: S.Natural,
    displayNamesPerIdentifier: CensusHistogram,
    identifiersPerDisplayName: CensusHistogram,
    exchangeUnification: ExchangeUnificationCounts,
    delegation: DelegationCounts,
    nameEqualityCollisionRisk: S.Natural,
  }).pipe(
    $I.annoteSchema("CensusSummary", {
      description: "Count-only mail summary without source names, addresses or identifier values.",
    })
  )
) {}
