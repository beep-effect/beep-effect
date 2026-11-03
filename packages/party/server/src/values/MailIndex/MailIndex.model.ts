/**
 * Validated mail-index boundary and extraction results.
 *
 * **Details**
 * This deliberately selects the header fields consumed by party ingestion.
 * Repository CLI records can be decoded here without a production dependency
 * on tooling or on corpus-specific paths and attachment metadata.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyServerId } from "@beep/identity/packages";
import { SourceAssertion } from "@beep/party-domain/Claim";
import { CommunicationEvent, Observation, ParticipantRole } from "@beep/party-domain/Communication";
import { AccountId, ActivityId, AssertionId, ContentId, EventId, IdentifierId } from "@beep/party-domain/Ids";
import { ArtifactOccurrence, CollectionSide } from "@beep/party-domain/Provenance";
import * as S from "effect/Schema";
import { IngestIdentifier } from "../ContactEvidence/ContactEvidence.model.ts";

const $I = $PartyServerId.create("values/MailIndex/MailIndex.model");

/**
 * One exported recipient, including explicit unknown role and address-type anomalies.
 * **Example** (Decode MailRecipient)
 * ```ts
 * import { MailRecipient } from "@beep/party-server/MailIndex"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailRecipient)
 * ```
 * @category models
 * @since 0.0.0
 */
// fallow-ignore-next-line code-duplication -- Header-only wire boundary deliberately repeats recipient fields without importing corpus tooling; review when a neutral driver owns this contract.
export class MailRecipient extends S.Opaque<MailRecipient, { readonly brand: unique symbol }>()(
  S.Struct({
    addressType: S.optionalKey(S.String),
    displayName: S.optionalKey(S.String),
    emailAddress: S.optionalKey(S.String),
    kind: S.Literals(["to", "cc", "bcc", "unknown"]),
  }).pipe(
    $I.annoteSchema("MailRecipient", {
      description: "One exported recipient, including explicit unknown role and address-type anomalies.",
    })
  )
) {}

/**
 * Verbatim MAPI fields consumed by party ingestion.
 * **Example** (Decode OutlookHeaders)
 * ```ts
 * import { OutlookHeaders } from "@beep/party-server/MailIndex"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(OutlookHeaders)
 * ```
 * @category models
 * @since 0.0.0
 */
export class OutlookHeaders extends S.Opaque<OutlookHeaders, { readonly brand: unique symbol }>()(
  S.Struct({
    clientSubmitTime: S.optionalKey(S.String),
    deliveryTime: S.optionalKey(S.String),
    senderEmailAddress: S.optionalKey(S.String),
    senderName: S.optionalKey(S.String),
    sentRepresentingEmailAddress: S.optionalKey(S.String),
    sentRepresentingName: S.optionalKey(S.String),
  }).pipe($I.annoteSchema("OutlookHeaders", { description: "Verbatim MAPI fields consumed by party ingestion." }))
) {}

/**
 * Parsed RFC 5322 addressing fields; sender roles remain distinct from MAPI fields.
 * **Example** (Decode InternetHeaders)
 * ```ts
 * import { InternetHeaders } from "@beep/party-server/MailIndex"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(InternetHeaders)
 * ```
 * @category models
 * @since 0.0.0
 */
export class InternetHeaders extends S.Opaque<InternetHeaders, { readonly brand: unique symbol }>()(
  S.Struct({
    from: S.optionalKey(S.String),
    messageId: S.optionalKey(S.String),
    to: S.Array(S.String),
    cc: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("InternetHeaders", {
      description: "Parsed RFC 5322 addressing fields; sender roles remain distinct from MAPI fields.",
    })
  )
) {}

/**
 * The header projection of a mail index record; no filesystem access is implied.
 * **Example** (Decode MailIndexRecord)
 * ```ts
 * import { MailIndexRecord } from "@beep/party-server/MailIndex"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailIndexRecord)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailIndexRecord extends S.Opaque<MailIndexRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    tree: S.NonEmptyString,
    messagePath: S.NonEmptyString,
    sourceArtifactId: S.NonEmptyString,
    outlook: OutlookHeaders,
    internet: S.optionalKey(InternetHeaders),
    recipients: S.Array(MailRecipient),
    conversationIndexHex: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("MailIndexRecord", {
      description: "The header projection of a mail index record; no filesystem access is implied.",
    })
  )
) {}

/**
 * One indexed message, its caller-supplied immutable content id, and extraction provenance.
 * The parent source artifact id never substitutes for the child message content.
 * **Example** (Decode MailIndexInput)
 * ```ts
 * import { MailIndexInput } from "@beep/party-server/MailIndex"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailIndexInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailIndexInput extends S.Opaque<MailIndexInput, { readonly brand: unique symbol }>()(
  S.Struct({
    record: MailIndexRecord,
    content: ContentId,
    side: CollectionSide,
    producedBy: ActivityId,
    observedAt: S.DateTimeUtcFromMillis,
  }).pipe(
    $I.annoteSchema("MailIndexInput", { description: "One indexed message and the provenance of its extraction." })
  )
) {}

/**
 * A parsed mailbox with its raw source spelling and optional display name.
 * **Example** (Decode ParsedMailbox)
 * ```ts
 * import { ParsedMailbox } from "@beep/party-server/MailIndex"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ParsedMailbox)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ParsedMailbox extends S.Opaque<ParsedMailbox, { readonly brand: unique symbol }>()(
  S.Struct({
    displayName: S.OptionFromNullOr(S.String),
    identifier: S.OptionFromNullOr(IngestIdentifier),
    raw: S.String,
  }).pipe(
    $I.annoteSchema("ParsedMailbox", {
      description: "A parsed mailbox with its raw source spelling and optional display name.",
    })
  )
) {}

/**
 * Same-message evidence for an Exchange mailbox alias, never a person merge.
 * **Example** (Decode AliasPairing)
 * ```ts
 * import { AliasPairing } from "@beep/party-server/MailIndex"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AliasPairing)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AliasPairing extends S.Opaque<AliasPairing, { readonly brand: unique symbol }>()(
  S.Struct({
    assertion: AssertionId,
    mailbox: AccountId,
    exchangeDn: IdentifierId,
    smtp: IdentifierId,
    displayName: S.String,
    event: EventId,
    role: ParticipantRole,
  }).pipe(
    $I.annoteSchema("AliasPairing", {
      description: "Same-message evidence for an Exchange mailbox alias, never a person merge.",
    })
  )
) {}

/**
 * Log-safe issues found while adapting a mail record.
 * **Example** (Report missing sender evidence)
 * ```ts
 * import { MailIssue } from "@beep/party-server/MailIndex"
 * MailIssue.cases.NoFromParticipant.make({})
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const MailIssue = S.TaggedUnion({
  NoFromParticipant: {},
  AddressTypeHoldsAddress: {},
  UnparsedAddress: { role: ParticipantRole },
}).pipe($I.annoteSchema("MailIssue", { description: "Mail extraction issues without raw private values." }));
/**
 * Decoded mail issue.
 * @category models
 * @since 0.0.0
 */
export type MailIssue = typeof MailIssue.Type;

/**
 * Extracted header evidence, event and alias proposals; no person attribution is inferred.
 * **Example** (Decode MailIngest)
 * ```ts
 * import { MailIngest } from "@beep/party-server/MailIndex"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailIngest)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailIngest extends S.Opaque<MailIngest, { readonly brand: unique symbol }>()(
  S.Struct({
    occurrence: ArtifactOccurrence,
    event: S.OptionFromNullOr(CommunicationEvent),
    identifiers: S.Array(IngestIdentifier),
    observations: S.Array(Observation),
    assertions: S.Array(SourceAssertion),
    pairings: S.Array(AliasPairing),
    issues: S.Array(MailIssue),
  }).pipe(
    $I.annoteSchema("MailIngest", {
      description: "Extracted header evidence, event and alias proposals; no person attribution is inferred.",
    })
  )
) {}
