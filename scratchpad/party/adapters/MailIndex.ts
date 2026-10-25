/**
 * Adapter: `MailMessageIndexRecord` (corpus provenance index) → party model.
 *
 * Pure and deterministic. One index row becomes:
 *
 * - an `ArtifactOccurrence` (the exported message path inside its PST tree),
 * - header-participant observations with their raw display names,
 * - identifiers (SMTP addresses and Exchange X.500 DNs, never merged here),
 * - a `CommunicationEvent` when exactly one `from` can be read,
 * - **alias pairings**: within one message, an X.500 DN and an SMTP address
 *   carrying the identical display name in the same role are proposed as two
 *   identifiers of one Exchange mailbox (`AccountIdentifier`). That is a
 *   proposal with a header anchor, not a merge,
 * - data-quality issues as data (missing `from`, address-type anomalies).
 *
 * Nothing here attributes a person. Persons arrive later through claims.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { MailMessageIndexRecord } from "@beep/repo-cli/commands/Corpus";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Data from "effect/Data";
import type {
  CommunicationEvent,
  Observation,
  Participant,
  ParticipantRole,
} from "../Communication.ts";
import {
  AccountId,
  ActivityId,
  EventId,
  IdentifierId,
  ObservationId,
  OccurrenceId,
} from "../Ids.ts";
import { Identifier } from "../Party.ts";
import { normalizeEmail, normalizeExchangeDn } from "../Party.ts";
import type { CollectionSide, ArtifactOccurrence } from "../Provenance.ts";
import { ContentId } from "../Ids.ts";
import { UtcInstant } from "../Time.ts";
import { thunkEmptyArray } from "@beep/utils";

/**
 * An address string parsed out of a header.
 *
 * @category adapter
 * @since 0.0.0
 */
export interface ParsedMailbox {
  readonly displayName: O.Option<string>;
  readonly identifier: O.Option<Identifier>;
  readonly raw: string;
}

const ANGLE = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/;

const unquote = (s: string) => Str.trim(s);

/**
 * Classify one raw address value as SMTP or Exchange DN. Anything else is
 * unparsed and surfaces as an issue rather than a guessed identifier.
 *
 * @category adapter
 * @since 0.0.0
 */
export const identifierOfAddress = (raw: string): O.Option<Identifier> => {
  const value = Str.trim(raw);
  if (/^\/o=/i.test(value)) {
    const normalized = normalizeExchangeDn(value);
    return Identifier.cases.ExchangeDn.makeOption({
      id: IdentifierId.make(`ident:x500:${encodeURIComponent(normalized)}`),
      normalized,
      raw: value,
    });
  }
  const smtp = Str.startsWith("mailto:")(Str.toLowerCase(value)) ? Str.slice(7)(value) : value;
  if (/^[^\s@<>]+@[^\s@<>]+$/.test(smtp)) {
    const normalized = normalizeEmail(smtp);
    return Identifier.cases.EmailAddress.makeOption({
      id: IdentifierId.make(`ident:email:${normalized}`),
      normalized,
      raw: value,
    });
  }
  return O.none();
};

/**
 * Parse `"Doe, John" <john@x.example>`, `john@x.example`, or a bare X.500 DN.
 *
 * @category adapter
 * @since 0.0.0
 */
export const parseMailbox = (raw: string): ParsedMailbox => {
  const m = ANGLE.exec(raw);
  return m === null
    ? { displayName: O.none(), identifier: identifierOfAddress(raw), raw }
    : {
      displayName: O.filter(O.some(unquote(m[1] ?? "")), Str.isNonEmpty),
      identifier: identifierOfAddress(m[2] ?? ""),
      raw,
    };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PFF_TIME = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)? UTC$/;
const pad2 = (s: string) => Str.padStart(2, "0")(s);

/**
 * Parse a mail-export timestamp. pffexport writes
 * `Mar 12, 2025 16:42:08.000000000 UTC`; ISO-8601 UTC passes through.
 * Anything else is `None`: an unparseable time is unknown, not invented.
 *
 * @category adapter
 * @since 0.0.0
 */
export const parseExportTime = (raw: string): O.Option<UtcInstant> => {
  const iso = S.decodeOption(UtcInstant)(Str.trim(raw));
  if (O.isSome(iso)) return iso;
  const m = PFF_TIME.exec(Str.trim(raw));
  if (m === null) return O.none();
  const [, mon = "", day = "", year = "", hh = "", mm = "", ss = ""] = m;
  return O.flatMap(A.findFirstIndex(MONTHS, (x) => x === mon), (i) =>
    S.decodeOption(UtcInstant)(`${year}-${pad2(String(i + 1))}-${pad2(day)}T${hh}:${mm}:${ss}Z`),
  );
};

/**
 * A data-quality issue found while adapting one row.
 *
 * @category adapter
 * @since 0.0.0
 */
export type MailIssue = Data.TaggedEnum<{
  NoFromParticipant: {},
  AddressTypeHoldsAddress: {},
  UnparsedAddress: { readonly role: ParticipantRole }
}>
/**
 * A data-quality issue found while adapting one row.
 *
 * @category adapter
 * @since 0.0.0
 */
export const MailIssue = Data.taggedEnum<MailIssue>();

/**
 * Two identifiers proposed as names of one Exchange mailbox, because they
 * appeared in the same message, same role, with the identical display name.
 *
 * @category adapter
 * @since 0.0.0
 */
export interface AliasPairing {
  readonly mailbox: AccountId;
  readonly exchangeDn: IdentifierId;
  readonly smtp: IdentifierId;
  readonly displayName: string;
  readonly event: EventId;
  readonly role: ParticipantRole;
}

/**
 * Everything one index row contributes.
 *
 * @category adapter
 * @since 0.0.0
 */
export interface MailIngest {
  readonly occurrence: ArtifactOccurrence;
  readonly event: O.Option<CommunicationEvent>;
  readonly identifiers: ReadonlyArray<Identifier>;
  readonly observations: ReadonlyArray<Observation>;
  readonly pairings: ReadonlyArray<AliasPairing>;
  readonly issues: ReadonlyArray<MailIssue>;
}

interface Slot {
  readonly role: ParticipantRole;
  readonly field: string;
  readonly namespace: "rfc5322" | "mapi";
  readonly parsed: ParsedMailbox;
}

const slug = (s: string) => encodeURIComponent(s);

/**
 * Adapt one index row.
 *
 * @category adapter
 * @since 0.0.0
 */
export const adaptMailRecord = (
  {
    record,
    side,
    producedBy,
    observedAt,
  }: {
    readonly record: MailMessageIndexRecord;
    readonly side: CollectionSide;
    readonly producedBy: ActivityId;
    readonly observedAt: UtcInstant;
  }): MailIngest => {
  const key = slug(`${record.tree}/${record.messagePath}`);
  const occurrenceId = OccurrenceId.make(`occ:mail:${key}`);
  const eventId = EventId.make(`evt:mail:${key}`);
  const outlook = record.outlook;
  const internet = O.fromNullishOr(record.internet);

  const withName = (address: string | undefined, name: string | undefined): O.Option<ParsedMailbox> =>
    O.map(O.filter(O.fromNullishOr(address), Str.isNonEmpty), (a) => {
      const parsed = parseMailbox(a);
      return O.isSome(parsed.displayName)
        ? parsed
        : {
          ...parsed,
          displayName: O.filter(O.fromNullishOr(name), Str.isNonEmpty),
        };
    });

  const internetFrom = O.flatMap(internet, (h) => O.map(O.filter(O.fromNullishOr(h.from), Str.isNonEmpty), parseMailbox));
  const sender = withName(outlook.senderEmailAddress, outlook.senderName);
  const representing = withName(outlook.sentRepresentingEmailAddress, outlook.sentRepresentingName);

  const fromSlot: O.Option<Slot> = O.orElse(
    O.map(internetFrom, (parsed): Slot => ({
      role: "from",
      field: "From",
      namespace: "rfc5322",
      parsed,
    })),
    () =>
      O.orElse(
        O.map(
          representing,
          (parsed): Slot => ({
            role: "from",
            field: "PR_SENT_REPRESENTING_EMAIL_ADDRESS",
            namespace: "mapi",
            parsed,
          }),
        ),
        () => O.map(sender, (parsed): Slot => ({
          role: "from",
          field: "PR_SENDER_EMAIL_ADDRESS",
          namespace: "mapi",
          parsed,
        })),
      ),
  );

  const recipientSlots = A.flatMap(record.recipients, (r): ReadonlyArray<Slot> => {
    if (r.kind === "unknown") return [];
    // Known export flaw: the address lands in `addressType` and the type ("SMTP") in `emailAddress`.
    const swapped = Str.includes("@")(r.addressType ?? "") && /^[A-Z]{2,8}$/.test(Str.trim(r.emailAddress ?? ""));
    const raw = swapped ? (r.addressType ?? "") : (r.emailAddress ?? "");
    if (!Str.isNonEmpty(raw)) return [];
    const parsed = parseMailbox(raw);
    return [
      {
        role: r.kind,
        field: "Recipients",
        namespace: "mapi",
        parsed: O.isSome(parsed.displayName)
          ? parsed
          : {
            ...parsed,
            displayName: O.filter(O.fromNullishOr(r.displayName), Str.isNonEmpty),
          },
      },
    ];
  });

  const internetSlots = O.match(internet, {
    onNone: (): ReadonlyArray<Slot> => [],
    onSome: (h) => [
      ...A.map(h.to, (raw): Slot => ({
        role: "to",
        field: "To",
        namespace: "rfc5322",
        parsed: parseMailbox(raw),
      })),
      ...A.map(h.cc, (raw): Slot => ({
        role: "cc",
        field: "Cc",
        namespace: "rfc5322",
        parsed: parseMailbox(raw),
      })),
    ],
  });

  const slots: ReadonlyArray<Slot> = [
    ...O.toArray(fromSlot),
    ...O.toArray(O.map(sender, (parsed): Slot => ({
      role: "sender",
      field: "PR_SENDER_EMAIL_ADDRESS",
      namespace: "mapi",
      parsed,
    }))),
    ...O.toArray(
      O.map(
        representing,
        (parsed): Slot => ({
          role: "sent-representing",
          field: "PR_SENT_REPRESENTING_EMAIL_ADDRESS",
          namespace: "mapi",
          parsed,
        }),
      ),
    ),
    ...recipientSlots,
    ...internetSlots,
  ];

  const headerObservations = A.flatMap(slots, (slot, i) =>
    O.match(slot.parsed.identifier, {
      onNone: thunkEmptyArray(),
      onSome: (identifier) => [
        {
          slot,
          identifier,
          observation: {
            _tag: "HeaderParticipant" as const,
            id: ObservationId.make(`obs:hdr:${key}:${i}`),
            producedBy,
            observedAt,
            event: eventId,
            role: slot.role,
            identifier: identifier.id,
            displayName: slot.parsed.displayName,
            anchor: {
              _tag: "HeaderField" as const,
              occurrence: occurrenceId,
              namespace: slot.namespace,
              field: slot.field,
            },
          },
        },
      ],
    }),
  );
  const observations: ReadonlyArray<Observation> = A.map(headerObservations, (h) => h.observation);

  // MAPI recipients and RFC 5322 To/Cc describe the same people: one participant per (role, identifier)
  const participants: ReadonlyArray<Participant> = A.dedupeWith(
    A.map(headerObservations, (h) => ({
      role: h.slot.role,
      identifier: h.identifier.id,
      observation: h.observation.id,
    })),
    (x: Participant, y: Participant) => x.role === y.role && x.identifier === y.identifier,
  );

  const issues: ReadonlyArray<MailIssue> = [
    ...(O.isNone(fromSlot) ? [{ _tag: "NoFromParticipant" as const }] : []),
    ...(A.some(record.recipients, (r) => Str.includes("@")(r.addressType ?? ""))
      ? [{ _tag: "AddressTypeHoldsAddress" as const }]
      : []),
    ...A.flatMap(slots, (slot) =>
      O.isNone(slot.parsed.identifier) ? [{
        _tag: "UnparsedAddress" as const,
        role: slot.role,
      }] : [],
    ),
  ];

  const identifiers = A.dedupeWith(
    A.flatMap(slots, (s) => O.toArray(s.parsed.identifier)),
    (a: Identifier, b: Identifier) => a.id === b.id,
  );

  // same message + same role + identical display name + one X.500 and one SMTP
  const named = A.flatMap(slots, (s) =>
    O.match(O.all({ name: s.parsed.displayName, id: s.parsed.identifier }), {
      onNone: thunkEmptyArray(),
      onSome: ({ name, id }) => [{ role: s.role, name, id }],
    }),
  );
  const pairings = A.dedupeWith(
    A.flatMap(named, (x): ReadonlyArray<AliasPairing> => {
      const dn = x.id;
      return dn._tag !== "ExchangeDn"
        ? []
        : A.flatMap(named, (y): ReadonlyArray<AliasPairing> =>
          y.id._tag === "EmailAddress" &&
          y.name === x.name &&
          (y.role === x.role || (y.role === "from" && (x.role === "sender" || x.role === "sent-representing")))
            ? [
              {
                mailbox: AccountId.make(`acct:exchange:${slug(dn.normalized)}`),
                exchangeDn: dn.id,
                smtp: y.id.id,
                displayName: x.name,
                event: eventId,
                role: x.role,
              },
            ]
            : [],
        );
    }),
    (a: AliasPairing, b: AliasPairing) => a.exchangeDn === b.exchangeDn && a.smtp === b.smtp,
  );

  const sentAt = O.flatMap(O.fromNullishOr(outlook.clientSubmitTime ?? outlook.deliveryTime), parseExportTime);

  const event: O.Option<CommunicationEvent> =
    A.length(A.filter(participants, (p) => p.role === "from")) === 1 && A.isReadonlyArrayNonEmpty(participants)
      ? O.some({
        id: eventId,
        occurrence: occurrenceId,
        channel: "email",
        sentAt,
        messageId: O.flatMap(internet, (h) => O.fromNullishOr(h.messageId)),
        conversationKey: O.fromNullishOr(record.conversationIndexHex),
        participants,
      })
      : O.none();

  return {
    occurrence: {
      id: occurrenceId,
      content: ContentId.make(`sha256:${slug(record.sourceArtifactId)}`),
      locator: {
        _tag: "ContainerChild",
        parent: OccurrenceId.make(`occ:${slug(record.sourceArtifactId)}`),
        path: record.messagePath,
      },
      side,
      custodianLabel: O.none(),
      acquiredBy: producedBy,
    },
    event,
    identifiers,
    observations,
    pairings,
    issues,
  };
};
