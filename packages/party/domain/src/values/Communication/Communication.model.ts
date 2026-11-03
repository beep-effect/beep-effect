/**
 * Observations, communication events, and voices.
 *
 * **Details**
 * Events are canonical; any "Alice ↔ Bob, 247 messages" edge is a projection.
 * Event participants point at **identifiers** (what the header says), never at
 * parties. A `Voice` sits between the channel and any person: who composed and
 * sent under this channel configuration. Sender ≠ sent-representing is the
 * classic assistant / delegate case and is preserved, not collapsed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { thunkFalse } from "@beep/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  AccountId,
  ActivityId,
  ContextRef,
  EventId,
  IdentifierId,
  ObservationId,
  OccurrenceId,
  VoiceId,
} from "../../Ids.ts";
import { EvidenceAnchor } from "../../Provenance.ts";

const $I = $PartyDomainId.create("values/Communication/Communication.model");

/**
 * Header roles. `sender` (MAPI PR_SENDER) and `sent-representing`
 * (PR_SENT_REPRESENTING) are distinct from RFC 5322 `from`.
 *
 * **Example** (Decode ParticipantRole)
 * ```ts
 * import { ParticipantRole } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ParticipantRole)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ParticipantRole = LiteralKit(["from", "sender", "sent-representing", "to", "cc", "bcc", "reply-to"]).pipe(
  $I.annoteSchema("ParticipantRole", { description: "Header role of a communication participant." })
);
/**
 * Decoded ParticipantRole type.
 * @category models
 * @since 0.0.0
 */
export type ParticipantRole = typeof ParticipantRole.Type;

/**
 * How easily a piece of evidence is shared or forged. Template and bulk
 * evidence may corroborate an identity claim; it can never found one.
 *
 * **Example** (Decode EvidenceKind)
 * ```ts
 * import { EvidenceKind } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(EvidenceKind)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceKind = LiteralKit(["distinctive-behavior", "shared-template", "bulk-distribution"]).pipe(
  $I.annoteSchema("EvidenceKind", { description: "How shareable or forgeable a piece of evidence is." })
);
/**
 * Decoded EvidenceKind type.
 * @category models
 * @since 0.0.0
 */
export type EvidenceKind = typeof EvidenceKind.Type;

/**
 * Speech acts a narrow classifier (or reviewer) labels on a message. These are
 * the raw material for operational-hierarchy assessments.
 *
 * **Example** (Decode SpeechAct)
 * ```ts
 * import { SpeechAct } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SpeechAct)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const SpeechAct = LiteralKit([
  "requests-approval",
  "grants-approval",
  "escalates",
  "instructs",
  "reports-status",
]).pipe($I.annoteSchema("SpeechAct", { description: "Speech act labelled on a message." }));
/**
 * Decoded SpeechAct type.
 * @category models
 * @since 0.0.0
 */
export type SpeechAct = typeof SpeechAct.Type;

const base = { id: ObservationId, producedBy: ActivityId, observedAt: S.DateTimeUtcFromMillis };

/**
 * An observation: what a deterministic extractor, classifier, or tool actually
 * saw, bound to an exact anchor. Observations are immutable and never
 * "corrected"; a better extractor produces a new observation.
 *
 * **Example** (Decode HeaderParticipant)
 * ```ts
 * import { HeaderParticipant } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(HeaderParticipant)
 * ```
 * @category models
 * @since 0.0.0
 */
export class HeaderParticipant extends S.Opaque<HeaderParticipant, { readonly brand: unique symbol }>()(
  S.TaggedStruct("HeaderParticipant", {
    ...base,
    event: EventId,
    role: ParticipantRole,
    identifier: IdentifierId,
    displayName: S.OptionFromNullOr(S.String),
    anchor: EvidenceAnchor,
  }).pipe($I.annoteSchema("HeaderParticipant", { description: "HeaderParticipant data." }))
) {}
/**
 * MetadataTag payload with validated role fields.
 *
 * **Example** (Decode MetadataTag)
 * ```ts
 * import { MetadataTag } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MetadataTag)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MetadataTag extends S.Opaque<MetadataTag, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MetadataTag", {
    ...base,
    occurrence: OccurrenceId,
    namespace: S.NonEmptyString,
    tag: S.NonEmptyString,
    rawValue: S.String,
    anchor: EvidenceAnchor,
  }).pipe($I.annoteSchema("MetadataTag", { description: "MetadataTag data." }))
) {}
/**
 * SignatureBlock payload with validated role fields.
 *
 * **Example** (Decode SignatureBlock)
 * ```ts
 * import { SignatureBlock } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SignatureBlock)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SignatureBlock extends S.Opaque<SignatureBlock, { readonly brand: unique symbol }>()(
  S.TaggedStruct("SignatureBlock", {
    ...base,
    event: EventId,
    nameText: S.NonEmptyString,
    titleText: S.OptionFromNullOr(S.String),
    organizationText: S.OptionFromNullOr(S.String),
    identifiers: S.Array(IdentifierId),
    anchor: EvidenceAnchor,
  }).pipe($I.annoteSchema("SignatureBlock", { description: "SignatureBlock data." }))
) {}
/**
 * DirectoryRow payload with validated role fields.
 *
 * **Example** (Decode DirectoryRow)
 * ```ts
 * import { DirectoryRow } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DirectoryRow)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DirectoryRow extends S.Opaque<DirectoryRow, { readonly brand: unique symbol }>()(
  S.TaggedStruct("DirectoryRow", {
    ...base,
    occurrence: OccurrenceId,
    fields: S.Record(S.String, S.String),
    anchor: EvidenceAnchor,
  }).pipe($I.annoteSchema("DirectoryRow", { description: "DirectoryRow data." }))
) {}
/**
 * MailboxPermission payload with validated role fields.
 *
 * **Example** (Decode MailboxPermission)
 * ```ts
 * import { MailboxPermission } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailboxPermission)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailboxPermission extends S.Opaque<MailboxPermission, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MailboxPermission", {
    ...base,
    account: AccountId,
    grantee: IdentifierId,
    permission: LiteralKit(["full-access", "send-as", "send-on-behalf"]),
    anchor: EvidenceAnchor,
  }).pipe($I.annoteSchema("MailboxPermission", { description: "MailboxPermission data." }))
) {}
/**
 * SpeechActLabel payload with validated role fields.
 *
 * **Example** (Decode SpeechActLabel)
 * ```ts
 * import { SpeechActLabel } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SpeechActLabel)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SpeechActLabel extends S.Opaque<SpeechActLabel, { readonly brand: unique symbol }>()(
  S.TaggedStruct("SpeechActLabel", {
    ...base,
    event: EventId,
    act: SpeechAct,
    anchor: EvidenceAnchor,
  }).pipe($I.annoteSchema("SpeechActLabel", { description: "SpeechActLabel data." }))
) {}
/**
 * Absence payload with validated role fields.
 *
 * **Example** (Decode Absence)
 * ```ts
 * import { Absence } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Absence)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Absence extends S.Opaque<Absence, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Absence", {
    ...base,
    scope: ContextRef,
    expected: S.NonEmptyString,
  }).pipe($I.annoteSchema("Absence", { description: "Absence data." }))
) {}
/**
 * Observation public schema for the communication model.
 *
 * **Example** (Decode Observation)
 * ```ts
 * import { Observation } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Observation)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Observation = S.Union([
  HeaderParticipant,
  MetadataTag,
  SignatureBlock,
  DirectoryRow,
  MailboxPermission,
  SpeechActLabel,
  Absence,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Observation", { description: "Immutable extractor/tool/classifier output." })
);
/**
 * Decoded Observation type.
 * @category models
 * @since 0.0.0
 */
export type Observation = typeof Observation.Type;

/**
 * The revisable classification of one observation's evidence kind. A signature
 * block seen under many voices gets reclassified to `shared-template`; claims
 * that leaned on it re-open.
 *
 * **Example** (Decode EvidenceKindAssessment)
 * ```ts
 * import { EvidenceKindAssessment } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(EvidenceKindAssessment)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class EvidenceKindAssessment extends S.Opaque<EvidenceKindAssessment, { readonly brand: unique symbol }>()(
  S.Struct({
    observation: ObservationId,
    kind: EvidenceKind,
    producedBy: ActivityId,
    recordedAt: S.DateTimeUtcFromMillis,
  }).pipe($I.annoteSchema("EvidenceKindAssessment", { description: "Revisable evidence-kind classification." }))
) {}

/**
 * One participant slot of a communication event.
 *
 * **Example** (Decode Participant)
 * ```ts
 * import { Participant } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Participant)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class Participant extends S.Opaque<Participant, { readonly brand: unique symbol }>()(
  S.Struct({
    role: ParticipantRole,
    identifier: IdentifierId,
    observation: ObservationId,
  }).pipe($I.annoteSchema("Participant", { description: "Participant data." }))
) {}

/**
 * A canonical communication event. Participant lists must contain exactly one
 * `from`; at most one `sender` and one `sent-representing`.
 *
 * **Example** (Decode CommunicationEvent)
 * ```ts
 * import { CommunicationEvent } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CommunicationEvent)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class CommunicationEvent extends S.Opaque<CommunicationEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    id: EventId,
    occurrence: OccurrenceId,
    channel: LiteralKit(["email", "meeting", "call", "chat"]),
    sentAt: S.OptionFromNullOr(S.DateTimeUtcFromMillis),
    messageId: S.OptionFromNullOr(S.String),
    conversationKey: S.OptionFromNullOr(S.String),
    participants: S.NonEmptyArray(Participant),
  })
    .check(
      S.makeFilter(
        ({ participants }) => A.length(A.filter(participants, (p) => p.role === "from")) === 1,
        $I.annote("ExactlyOneFromCheck", { message: "Expected exactly one from participant." })
      ),
      S.makeFilter(
        ({ participants }) =>
          A.length(A.filter(participants, (p) => p.role === "sender")) <= 1 &&
          A.length(A.filter(participants, (p) => p.role === "sent-representing")) <= 1,
        $I.annote("SingleSenderCheck", { message: "Expected at most one sender and one sent-representing." })
      )
    )
    .pipe($I.annoteSchema("CommunicationEvent", { description: "Canonical communication event." }))
) {}

/**
 * A voice: the channel configuration a message was composed under. Its
 * candidate authors are claims (`VoiceAuthor`), never fields.
 *
 * **Example** (Decode Voice)
 * ```ts
 * import { Voice } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Voice)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class Voice extends S.Opaque<Voice, { readonly brand: unique symbol }>()(
  S.Struct({
    id: VoiceId,
    from: IdentifierId,
    sender: S.OptionFromNullOr(IdentifierId),
    representing: S.OptionFromNullOr(IdentifierId),
  }).pipe($I.annoteSchema("Voice", { description: "Who composed under one channel configuration." }))
) {}

const roleIdentifier = (event: CommunicationEvent, role: ParticipantRole) =>
  O.map(
    A.findFirst(event.participants, (p) => p.role === role),
    (p) => p.identifier
  );

/**
 * Deterministic voice key for an event: `from | sender | representing`.
 * Identical channel configurations share one voice across messages.
 *
 * **Example** (Use voiceOf)
 * ```ts
 * import { voiceOf } from "@beep/party-domain/Communication"
 * const inspect = voiceOf
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const voiceOf = (event: CommunicationEvent): Voice => {
  const from = O.getOrThrow(roleIdentifier(event, "from"));
  const sender = roleIdentifier(event, "sender");
  const representing = roleIdentifier(event, "sent-representing");
  const key = A.join(
    A.map(
      [from, O.getOrElse(sender, () => "-"), O.getOrElse(representing, () => "-")],
      (part) => `${part.length}:${part}`
    ),
    ""
  );
  return Voice.make({ id: VoiceId.make(`party-voice:${key}`), from, sender, representing });
};

/**
 * True when the composing sender differs from the identity the message was
 * sent as: the delegate / assistant / shared-mailbox signal.
 *
 * **Example** (Use isDelegated)
 * ```ts
 * import { isDelegated } from "@beep/party-domain/Communication"
 * const inspect = isDelegated
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const isDelegated = (voice: Voice): boolean =>
  O.match(voice.sender, {
    onNone: thunkFalse,
    onSome: (sender) => sender !== O.getOrElse(voice.representing, () => voice.from),
  });

/**
 * A party slot that is known to exist but whose identity is withheld
 * (redaction, privilege log). Resolving it later is an ordinary `SameParty`
 * claim against a real party.
 *
 * **Example** (Decode RedactedPartySlot)
 * ```ts
 * import { RedactedPartySlot } from "@beep/party-domain/Communication"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(RedactedPartySlot)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class RedactedPartySlot extends S.Opaque<RedactedPartySlot, { readonly brand: unique symbol }>()(
  S.Struct({
    placeholder: PartyId,
    occurrence: OccurrenceId,
    redactionReason: S.NonEmptyString,
  }).pipe($I.annoteSchema("RedactedPartySlot", { description: "Withheld party known to exist." }))
) {}
