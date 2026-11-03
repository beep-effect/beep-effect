/**
 * Shared-normalizer mailbox parsing and deterministic export-time decoding.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ValidTime } from "@beep/epistemics/Claim";
import { $PartyServerId } from "@beep/identity/packages";
import { SourceAssertion } from "@beep/party-domain/Claim";
import { CommunicationEvent, HeaderParticipant, Participant, ParticipantRole } from "@beep/party-domain/Communication";
import { EmailAddress, ExchangeDn, emailAddress, exchangeDn } from "@beep/party-domain/Identifier";
import { AccountId, AssertionId, EventId, IdentifierId, ObservationId, OccurrenceId } from "@beep/party-domain/Ids";
import { partyKeyOf } from "@beep/party-domain/PartyKey";
import { Proposition } from "@beep/party-domain/Proposition";
import { ArtifactOccurrence, ContainerChild, HeaderField, HeaderNamespace } from "@beep/party-domain/Provenance";
import { LedgerSnapshot, PartyLedger } from "@beep/party-use-cases/Ledger";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { IngestIdentifier } from "../ContactEvidence/ContactEvidence.model.ts";
import { AliasPairing, MailIngest, MailIssue, ParsedMailbox } from "./MailIndex.model.ts";
import type { Identifier, IdentifierIssue } from "@beep/party-domain/Identifier";
import type { MailIndexInput, MailRecipient } from "./MailIndex.model.ts";

/**
 * Graduate SMTP or Exchange DN input through the shared identifier normalizers.
 * **Details**
 * Failure is represented as None for the caller's UnparsedAddress issue.
 * Keys and identifier references use exactly the contact-ingestion derivation.
 * **Example** (Parse a mailbox identifier)
 * ```ts
 * import { identifierOfAddress } from "@beep/party-server/MailIndex"
 * const parsed = identifierOfAddress("Dana@EXAMPLE.test")
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const identifierOfAddress = Effect.fn("PartyMail.identifierOfAddress")(function* (raw: string) {
  const trimmed = Str.trim(raw);
  const address = Str.startsWith("mailto:")(Str.toLowerCase(trimmed)) ? Str.slice(7)(trimmed) : trimmed;
  const normalized: Effect.Effect<Identifier, IdentifierIssue> = /^\/o=/iu.test(address)
    ? exchangeDn(address)
    : emailAddress(address);
  const value = yield* Effect.option(normalized);
  if (O.isNone(value)) return O.none<IngestIdentifier>();
  const key = yield* partyKeyOf(value.value);
  return O.some(
    IngestIdentifier.make({ id: IdentifierId.make(`party-ident:${key}`), value: value.value, key, represents: false })
  );
});

/**
 * Parse a display-name wrapper while preserving the raw source spelling.
 * **Example** (Parse a header mailbox)
 * ```ts
 * import { parseMailbox } from "@beep/party-server/MailIndex"
 * const parsed = parseMailbox('"Doe, Dana" <Dana@EXAMPLE.test>')
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const parseMailbox = Effect.fn("PartyMail.parseMailbox")(function* (raw: string) {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/u.exec(raw);
  const name = O.filter(O.map(O.fromNullishOr(match?.[1]), Str.trim), Str.isNonEmpty);
  const identifier = yield* identifierOfAddress(match?.[2] ?? raw);
  return ParsedMailbox.make({ displayName: name, identifier, raw });
});

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = Str.padStart(2, "0");
const checkedIso = (iso: string): O.Option<DateTime.Utc> =>
  DateTime.make(iso).pipe(O.filter((time) => DateTime.formatIso(time) === iso));

/**
 * Decode ISO UTC or pffexport timestamps, rejecting invalid calendar dates.
 * **Details**
 * Milliseconds are retained; sub-millisecond export precision is truncated to
 * the foundation's millisecond time axis. Missing timezone, rollover dates and
 * unparseable input remain unknown instead of receiving a guessed timestamp.
 * **Example** (Decode export time)
 * ```ts
 * import { parseExportTime } from "@beep/party-server/MailIndex"
 * const time = parseExportTime("Mar 12, 2025 16:42:08.123456789 UTC")
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const parseExportTime = (raw: string): O.Option<DateTime.Utc> => {
  const text = Str.trim(raw);
  const iso = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/u.exec(text);
  if (iso !== null) return checkedIso(`${iso[1]}.${Str.padEnd(3, "0")(Str.slice(0, 3)(iso[2] ?? ""))}Z`);
  const pff = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))? UTC$/u.exec(text);
  if (pff === null) return O.none();
  const [, month = "", day = "", year = "", hour = "", minute = "", second = "", fraction = ""] = pff;
  return O.flatMap(
    A.findFirstIndex(months, (value) => value === month),
    (index) =>
      checkedIso(
        `${year}-${pad2(String(index + 1))}-${pad2(day)}T${hour}:${minute}:${second}.${Str.padEnd(3, "0")(Str.slice(0, 3)(fraction))}Z`
      )
  );
};

const $I = $PartyServerId.create("values/MailIndex/MailIndex.behavior");
class HeaderSlot extends S.Opaque<HeaderSlot, { readonly brand: unique symbol }>()(
  S.Struct({ role: ParticipantRole, field: S.NonEmptyString, namespace: HeaderNamespace, parsed: ParsedMailbox }).pipe(
    $I.annoteSchema("HeaderSlot", { description: "One source header role and parsed value." })
  )
) {}

const mailIdentity = (input: MailIndexInput) => {
  const { record } = input;
  const key = encodeURIComponent(
    `${Str.length(input.content)}:${input.content}${Str.length(record.tree)}:${record.tree}${Str.length(record.messagePath)}:${record.messagePath}`
  );
  return Tuple.make(key, OccurrenceId.make(`party-occ:mail:${key}`), EventId.make(`party-evt:mail:${key}`));
};

const withName = Effect.fn("PartyMail.withName")(function* (address: string | undefined, name: string | undefined) {
  if (address === undefined || !Str.isNonEmpty(Str.trim(address))) return O.none<ParsedMailbox>();
  const parsed = yield* parseMailbox(address);
  const displayName = O.orElse(parsed.displayName, () => O.filter(O.fromNullishOr(name), Str.isNonEmpty));
  return O.some(ParsedMailbox.make({ ...parsed, displayName }));
});

const selectFrom = (
  from: O.Option<ParsedMailbox>,
  representing: O.Option<ParsedMailbox>,
  sender: O.Option<ParsedMailbox>
) => {
  if (O.isSome(from))
    return O.some(HeaderSlot.make({ role: "from", field: "From", namespace: "rfc5322", parsed: from.value }));
  if (O.isSome(representing))
    return O.some(
      HeaderSlot.make({
        role: "from",
        field: "PR_SENT_REPRESENTING_EMAIL_ADDRESS",
        namespace: "mapi",
        parsed: representing.value,
      })
    );
  return O.map(sender, (parsed) =>
    HeaderSlot.make({ role: "from", field: "PR_SENDER_EMAIL_ADDRESS", namespace: "mapi", parsed })
  );
};
const recipientSlot = Effect.fn("PartyMail.recipientSlot")(function* (recipient: MailRecipient) {
  const issues: Array<MailIssue> = [];
  if (recipient.kind === "unknown") return Tuple.make(O.none<HeaderSlot>(), issues);
  const role = recipient.kind;
  const addressTypeHoldsAddress = Str.includes("@")(recipient.addressType ?? "");
  const swapped = addressTypeHoldsAddress && /^[A-Z]{2,8}$/u.test(Str.trim(recipient.emailAddress ?? ""));
  if (addressTypeHoldsAddress) issues.push(MailIssue.cases.AddressTypeHoldsAddress.make({}));
  const parsed = yield* withName(swapped ? recipient.addressType : recipient.emailAddress, recipient.displayName);
  return Tuple.make(
    O.map(parsed, (parsed) => HeaderSlot.make({ role, field: "Recipients", namespace: "mapi", parsed })),
    issues
  );
});
const internetRecipients = Effect.fn("PartyMail.internetRecipients")(function* (record: MailIndexInput["record"]) {
  const slots: Array<HeaderSlot> = [];
  for (const raw of record.internet?.to ?? [])
    slots.push(HeaderSlot.make({ role: "to", field: "To", namespace: "rfc5322", parsed: yield* parseMailbox(raw) }));
  for (const raw of record.internet?.cc ?? [])
    slots.push(HeaderSlot.make({ role: "cc", field: "Cc", namespace: "rfc5322", parsed: yield* parseMailbox(raw) }));
  return slots;
});
const collectHeaders = Effect.fn("PartyMail.collectHeaders")(function* (input: MailIndexInput) {
  const { record } = input;
  const slots: Array<HeaderSlot> = [];
  const issues: Array<MailIssue> = [];
  const sender = yield* withName(record.outlook.senderEmailAddress, record.outlook.senderName);
  const representing = yield* withName(
    record.outlook.sentRepresentingEmailAddress,
    record.outlook.sentRepresentingName
  );
  const from = yield* withName(record.internet?.from, undefined);
  const add = (role: ParticipantRole, field: string, namespace: HeaderNamespace, parsed: ParsedMailbox) =>
    slots.push(HeaderSlot.make({ role, field, namespace, parsed }));
  const fromSlot = selectFrom(from, representing, sender);
  slots.push(...O.toArray(fromSlot));
  for (const parsed of O.toArray(sender)) add("sender", "PR_SENDER_EMAIL_ADDRESS", "mapi", parsed);
  for (const parsed of O.toArray(representing))
    add("sent-representing", "PR_SENT_REPRESENTING_EMAIL_ADDRESS", "mapi", parsed);
  for (const recipient of record.recipients) {
    const parsed = yield* recipientSlot(recipient);
    issues.push(...parsed[1]);
    slots.push(...O.toArray(parsed[0]));
  }
  slots.push(...(yield* internetRecipients(record)));

  return Tuple.make(slots, issues);
});
const observeHeaders = (input: MailIndexInput, slots: ReadonlyArray<HeaderSlot>) => {
  const { producedBy, observedAt } = input;
  const [key, occurrenceId, eventId] = mailIdentity(input);
  const issues: Array<MailIssue> = [];
  const observations: Array<HeaderParticipant> = [];
  for (const [index, slot] of A.map(slots, (slot, index) => Tuple.make(index, slot))) {
    if (O.isNone(slot.parsed.identifier)) {
      issues.push(MailIssue.cases.UnparsedAddress.make({ role: slot.role }));
      continue;
    }
    observations.push(
      HeaderParticipant.make({
        id: ObservationId.make(`party-obs:hdr:${key}:${encodeURIComponent(producedBy)}:${index}`),
        producedBy,
        observedAt,
        event: eventId,
        role: slot.role,
        identifier: slot.parsed.identifier.value.id,
        displayName: slot.parsed.displayName,
        anchor: HeaderField.make({ occurrence: occurrenceId, namespace: slot.namespace, field: slot.field }),
      })
    );
  }

  return Tuple.make(observations, issues);
};
class PairedHeaders extends S.Opaque<PairedHeaders, { readonly brand: unique symbol }>()(
  S.Struct({
    left: HeaderSlot,
    right: HeaderSlot,
    dn: IngestIdentifier,
    smtp: IngestIdentifier,
    displayName: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("PairedHeaders", { description: "Matching directory and SMTP headers with both source locations." })
  )
) {}
const matchHeaders = (left: HeaderSlot, right: HeaderSlot): O.Option<PairedHeaders> => {
  if (O.isNone(left.parsed.identifier) || O.isNone(left.parsed.displayName)) return O.none();
  if (O.isNone(right.parsed.identifier) || O.isNone(right.parsed.displayName)) return O.none();
  const dn = left.parsed.identifier.value;
  const smtp = right.parsed.identifier.value;
  if (!S.is(ExchangeDn)(dn.value) || !S.is(EmailAddress)(smtp.value)) return O.none();
  if (left.parsed.displayName.value !== right.parsed.displayName.value) return O.none();
  if (!compatibleRoles(left.role, right.role)) return O.none();
  return O.some(PairedHeaders.make({ left, right, dn, smtp, displayName: left.parsed.displayName.value }));
};
const compatibleRoles = (left: ParticipantRole, right: ParticipantRole) =>
  left === right || (right === "from" && (left === "sender" || left === "sent-representing"));
const pairingEvidence = (input: MailIndexInput, match: PairedHeaders) => {
  const { left, right, dn, smtp, displayName } = match;
  const { producedBy, observedAt } = input;
  const [, occurrenceId, eventId] = mailIdentity(input);
  const mailbox = AccountId.make(`party-acct:exchange:${dn.key}`);
  const assertion = AssertionId.make(
    `party-asrt:pairing:${encodeURIComponent(
      `${producedBy.length}:${producedBy}${eventId.length}:${eventId}${dn.id.length}:${dn.id}${smtp.id.length}:${smtp.id}`
    )}`
  );
  const sourceAssertion = SourceAssertion.make({
    id: assertion,
    proposition: Proposition.cases.AccountIdentifier.make({ account: mailbox, identifier: smtp.id }),
    stance: "asserts",
    anchors: [
      HeaderField.make({ occurrence: occurrenceId, namespace: left.namespace, field: left.field }),
      HeaderField.make({ occurrence: occurrenceId, namespace: right.namespace, field: right.field }),
    ],
    producedBy,
    validTime: ValidTime.cases.Unknown.make({}),
    recordedAt: observedAt,
  });
  const pairing = AliasPairing.make({
    assertion,
    mailbox,
    exchangeDn: dn.id,
    smtp: smtp.id,
    displayName: displayName,
    event: eventId,
    role: left.role,
  });
  return Tuple.make(sourceAssertion, pairing);
};
const collectPairings = (input: MailIndexInput, slots: ReadonlyArray<HeaderSlot>) => {
  const pairings: Array<AliasPairing> = [];
  const assertions: Array<SourceAssertion> = [];
  const matches = A.flatMap(slots, (left) => A.flatMap(slots, (right) => O.toArray(matchHeaders(left, right))));
  for (const match of matches) {
    const [assertion, pairing] = pairingEvidence(input, match);
    if (A.some(pairings, (existing) => existing.exchangeDn === pairing.exchangeDn && existing.smtp === pairing.smtp))
      continue;
    assertions.push(assertion);
    pairings.push(pairing);
  }
  return Tuple.make(assertions, pairings);
};

/**
 * Adapt indexed mail headers into immutable observations and mailbox-alias proposals.
 * **Details**
 * RFC From, MAPI sender and represented mailbox remain separate roles. Matching
 * display names only propose DN/SMTP mailbox aliases within the same message;
 * they never merge people. The known swapped recipient export fields produce
 * an explicit issue. A malformed From does not become a guessed event.
 * **Example** (Use the index adapter)
 * ```ts
 * import { adaptMailRecord } from "@beep/party-server/MailIndex"
 * const adapt = adaptMailRecord
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const adaptMailRecord = Effect.fn("PartyMail.adaptMailRecord")(function* (input: MailIndexInput) {
  const { record, producedBy, side } = input;
  const [, occurrenceId, eventId] = mailIdentity(input);
  const [slots, headerIssues] = yield* collectHeaders(input);
  const [observations, observationIssues] = observeHeaders(input, slots);
  const issues = [...headerIssues, ...observationIssues];
  const participants = A.dedupeWith(
    A.map(observations, (observation) =>
      Participant.make({ role: observation.role, identifier: observation.identifier, observation: observation.id })
    ),
    (left: Participant, right: Participant) => left.role === right.role && left.identifier === right.identifier
  );
  const hasFrom = A.length(A.filter(participants, (participant) => participant.role === "from")) === 1;
  if (!hasFrom) issues.push(MailIssue.cases.NoFromParticipant.make({}));
  const identifiers = A.dedupeWith(
    A.flatMap(slots, (slot) => O.toArray(slot.parsed.identifier)),
    (left: IngestIdentifier, right: IngestIdentifier) => left.id === right.id
  );
  const [assertions, pairings] = collectPairings(input, slots);
  const sentAt = O.flatMap(
    O.fromNullishOr(record.outlook.clientSubmitTime ?? record.outlook.deliveryTime),
    parseExportTime
  );
  const event =
    hasFrom && A.isArrayNonEmpty(participants)
      ? O.some(
          CommunicationEvent.make({
            id: eventId,
            occurrence: occurrenceId,
            channel: "email",
            sentAt,
            messageId: O.fromNullishOr(record.internet?.messageId),
            conversationKey: O.fromNullishOr(record.conversationIndexHex),
            participants,
          })
        )
      : O.none();
  return MailIngest.make({
    occurrence: ArtifactOccurrence.make({
      id: occurrenceId,
      content: input.content,
      locator: ContainerChild.make({
        parent: OccurrenceId.make(`party-occ:${encodeURIComponent(record.sourceArtifactId)}`),
        path: record.messagePath,
      }),
      side,
      custodianLabel: O.none(),
      acquiredBy: producedBy,
    }),
    event,
    identifiers,
    observations,
    assertions,
    pairings: A.dedupeWith(pairings, (left, right) => left.exchangeDn === right.exchangeDn && left.smtp === right.smtp),
    issues: A.dedupeWith(issues, S.toEquivalence(MailIssue)),
  });
});

/**
 * Adapt one mail index record and atomically append its anchored observations and alias assertions.
 * **Example** (Use the ledger ingestion workflow)
 * ```ts
 * import { ingestMailRecord } from "@beep/party-server/MailIndex"
 * const ingest = ingestMailRecord
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const ingestMailRecord = Effect.fn("PartyMail.ingestMailRecord")(function* (input: MailIndexInput) {
  const ledger = yield* PartyLedger;
  const result = yield* adaptMailRecord(input);
  yield* ledger.appendEvidence(
    LedgerSnapshot.make({ observations: result.observations, assertions: result.assertions, versions: [] })
  );
  return result;
});
