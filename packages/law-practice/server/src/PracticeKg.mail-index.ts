/**
 * Archive mail from the corpus provenance message index, attributed to matters
 * by the docket references in each subject line.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { extractPracticeKgReferences } from "@beep/law-practice-use-cases/server";
import { rfc5322DateFromOutlookTimestamp } from "@beep/libpff";
import { DateTime, Effect, MutableHashSet, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readJsonlLines } from "./internal/Jsonl.ts";
import {
  normalizePracticeKgMessageId,
  PracticeKgEmailMessage,
  parsePracticeKgHeaderParticipants,
} from "./PracticeKg.correspondents.ts";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { PracticeKgDocumentAttribution } from "./PracticeKg.families.ts";
import { matchPracticeKgMatterReferences, PracticeKgMatterTables } from "./PracticeKg.matters.ts";
import type { FileSystem } from "effect";
import type { PracticeKgEmailParticipant } from "./PracticeKg.correspondents.ts";

const $I = $LawPracticeServerId.create("PracticeKg.mail-index");

/**
 * The RFC 5322 headers of one indexed message that the build reads.
 *
 * **Details**
 *
 * A projection of the corpus provenance index's `InternetMessageHeaders`:
 * identity, addressing, date, and subject. Other fields of the index row are
 * ignored when a line is decoded.
 *
 * **Example** (Headers of a reply)
 *
 * ```ts
 * import { PracticeKgMailIndexInternetHeaders } from "@beep/law-practice-server"
 *
 * const headers = PracticeKgMailIndexInternetHeaders.make({
 *   cc: [],
 *   from: "Pat <pat@example.com>",
 *   messageId: "<1@example.com>",
 *   subject: "RE: 11111.12345US office action",
 *   to: ["counsel@practice.test"],
 * })
 * console.log(headers.to.length) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMailIndexInternetHeaders extends S.Class<PracticeKgMailIndexInternetHeaders>(
  $I`PracticeKgMailIndexInternetHeaders`
)(
  {
    cc: S.Array(S.String),
    date: S.optionalKey(S.String),
    from: S.optionalKey(S.String),
    messageId: S.optionalKey(S.String),
    subject: S.optionalKey(S.String),
    to: S.Array(S.String),
  },
  $I.annote("PracticeKgMailIndexInternetHeaders", {
    description: "RFC 5322 identity, addressing, date, and subject of one indexed archive message.",
  })
) {}

/**
 * The MAPI headers of one indexed message that the build reads.
 *
 * **Example** (Headers without an RFC 5322 counterpart)
 *
 * ```ts
 * import { PracticeKgMailIndexOutlookHeaders } from "@beep/law-practice-server"
 *
 * const headers = PracticeKgMailIndexOutlookHeaders.make({ subject: "11111.12345US" })
 * console.log(headers.subject) // "11111.12345US"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMailIndexOutlookHeaders extends S.Class<PracticeKgMailIndexOutlookHeaders>(
  $I`PracticeKgMailIndexOutlookHeaders`
)(
  {
    clientSubmitTime: S.optionalKey(S.String),
    conversationTopic: S.optionalKey(S.String),
    deliveryTime: S.optionalKey(S.String),
    senderEmailAddress: S.optionalKey(S.String),
    sentRepresentingEmailAddress: S.optionalKey(S.String),
    subject: S.optionalKey(S.String),
  },
  $I.annote("PracticeKgMailIndexOutlookHeaders", {
    description: "MAPI subject, conversation topic, sender, and times of one indexed archive message.",
  })
) {}

/**
 * One recipient of an indexed message: its kind and, when the export carried
 * one, its address.
 *
 * **Example** (A carbon-copy recipient)
 *
 * ```ts
 * import { PracticeKgMailIndexRecipient } from "@beep/law-practice-server"
 *
 * const recipient = PracticeKgMailIndexRecipient.make({ emailAddress: "sam@other.test", kind: "cc" })
 * console.log(recipient.kind) // "cc"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMailIndexRecipient extends S.Class<PracticeKgMailIndexRecipient>(
  $I`PracticeKgMailIndexRecipient`
)(
  {
    emailAddress: S.optionalKey(S.String),
    kind: S.String,
  },
  $I.annote("PracticeKgMailIndexRecipient", {
    description: "Kind (to, cc, bcc, unknown) and address of one recipient as the mail export listed it.",
  })
) {}

/**
 * One line of the corpus provenance message index, reduced to what the build
 * reads.
 *
 * **Details**
 *
 * The index row (`MailMessageIndexRecord` of the corpus tooling) carries
 * attachments, body, and folder details too; they are ignored here. `tree`
 * and `messagePath` identify the message only when it has neither a
 * `Message-ID` nor a MAPI time.
 *
 * **Example** (A row with RFC 5322 headers)
 *
 * ```ts
 * import {
 *   PracticeKgMailIndexInternetHeaders,
 *   PracticeKgMailIndexOutlookHeaders,
 *   PracticeKgMailIndexRow,
 * } from "@beep/law-practice-server"
 *
 * const row = PracticeKgMailIndexRow.make({
 *   internet: PracticeKgMailIndexInternetHeaders.make({ cc: [], from: "pat@example.com", to: [] }),
 *   messagePath: "artifact:0000.export/Top of Outlook data file/Inbox/Message00001",
 *   outlook: PracticeKgMailIndexOutlookHeaders.make({}),
 *   recipients: [],
 *   tree: "extract",
 * })
 * console.log(row.tree) // "extract"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMailIndexRow extends S.Class<PracticeKgMailIndexRow>($I`PracticeKgMailIndexRow`)(
  {
    internet: S.optionalKey(PracticeKgMailIndexInternetHeaders),
    messagePath: S.NonEmptyString,
    outlook: PracticeKgMailIndexOutlookHeaders,
    recipients: S.Array(PracticeKgMailIndexRecipient),
    tree: S.NonEmptyString,
  },
  $I.annote("PracticeKgMailIndexRow", {
    description: "The identity, headers, and recipients of one indexed archive message.",
  })
) {}

/**
 * What became of the indexed messages: how many were read, how many were
 * distinct, and how many a subject line placed on one matter.
 *
 * **Example** (An empty index)
 *
 * ```ts
 * import { PracticeKgMailIndexCounts } from "@beep/law-practice-server"
 * import * as S from "effect/Schema"
 *
 * const counts = PracticeKgMailIndexCounts.make({
 *   ambiguousMessages: S.Natural.make(0),
 *   attributedMessages: S.Natural.make(0),
 *   attributedWithoutAddress: S.Natural.make(0),
 *   distinctMessages: S.Natural.make(0),
 *   exchangeAddressesDropped: S.Natural.make(0),
 *   rows: S.Natural.make(0),
 *   unreferencedMessages: S.Natural.make(0),
 * })
 * console.log(counts.rows) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMailIndexCounts extends S.Class<PracticeKgMailIndexCounts>($I`PracticeKgMailIndexCounts`)(
  {
    ambiguousMessages: S.Natural,
    attributedMessages: S.Natural,
    attributedWithoutAddress: S.Natural,
    distinctMessages: S.Natural,
    exchangeAddressesDropped: S.Natural,
    rows: S.Natural,
    unreferencedMessages: S.Natural,
  },
  $I.annote("PracticeKgMailIndexCounts", {
    description:
      "Rows read, distinct messages, messages placed on one matter, ambiguous and unreferenced ones, attributed messages without an address, and Exchange-only addresses dropped.",
  })
) {}

/**
 * The attributed archive messages in the form the correspondent tables take,
 * with the counts of the pass.
 *
 * **Example** (Nothing attributed)
 *
 * ```ts
 * import { PracticeKgMailIndexCounts, PracticeKgMailIndexMessages } from "@beep/law-practice-server"
 * import * as S from "effect/Schema"
 *
 * const zero = S.Natural.make(0)
 * const result = PracticeKgMailIndexMessages.make({
 *   attributions: [],
 *   counts: PracticeKgMailIndexCounts.make({
 *     ambiguousMessages: zero,
 *     attributedMessages: zero,
 *     attributedWithoutAddress: zero,
 *     distinctMessages: zero,
 *     exchangeAddressesDropped: zero,
 *     rows: zero,
 *     unreferencedMessages: zero,
 *   }),
 *   messages: [],
 * })
 * console.log(result.messages.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMailIndexMessages extends S.Class<PracticeKgMailIndexMessages>($I`PracticeKgMailIndexMessages`)(
  {
    attributions: S.Array(PracticeKgDocumentAttribution),
    counts: PracticeKgMailIndexCounts,
    messages: S.Array(PracticeKgEmailMessage),
  },
  $I.annote("PracticeKgMailIndexMessages", {
    description: "Attributed archive messages, their subject-reference attributions, and the counts of the pass.",
  })
) {}

/**
 * The index files to read and the matter tables to resolve subjects against.
 *
 * **Example** (No index files)
 *
 * ```ts
 * import { PracticeKgMailIndexInput, PracticeKgMatterTables } from "@beep/law-practice-server"
 *
 * const input = PracticeKgMailIndexInput.make({
 *   paths: [],
 *   tables: PracticeKgMatterTables.make({ dockets: [], matters: [] }),
 * })
 * console.log(input.paths.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMailIndexInput extends S.Class<PracticeKgMailIndexInput>($I`PracticeKgMailIndexInput`)(
  {
    paths: S.Array(S.NonEmptyString),
    tables: PracticeKgMatterTables,
  },
  $I.annote("PracticeKgMailIndexInput", {
    description: "Message index files, in the order their duplicates are resolved, and the bundle's matter tables.",
  })
) {}

const nonEmpty = (value: string | undefined): O.Option<string> =>
  pipe(O.fromUndefinedOr(value), O.map(Str.trim), O.filter(Str.isNonEmpty));

// The RFC 5322 subject first; the MAPI subject and conversation topic only stand in for it.
const subjectOf = (row: PracticeKgMailIndexRow): string =>
  pipe(
    nonEmpty(row.internet?.subject),
    O.orElse(() => nonEmpty(row.outlook.subject)),
    O.orElse(() => nonEmpty(row.outlook.conversationTopic)),
    O.getOrElse(() => "")
  );

const messageIdOf = (row: PracticeKgMailIndexRow): O.Option<string> =>
  O.flatMap(nonEmpty(row.internet?.messageId), normalizePracticeKgMessageId);

const outlookSenderOf = (row: PracticeKgMailIndexRow): O.Option<string> =>
  pipe(
    nonEmpty(row.outlook.senderEmailAddress),
    O.orElse(() => nonEmpty(row.outlook.sentRepresentingEmailAddress))
  );

const outlookTimeOf = (row: PracticeKgMailIndexRow): O.Option<string> =>
  pipe(
    nonEmpty(row.outlook.clientSubmitTime),
    O.orElse(() => nonEmpty(row.outlook.deliveryTime))
  );

const internetParticipants = (headers: PracticeKgMailIndexInternetHeaders): ReadonlyArray<PracticeKgEmailParticipant> =>
  A.appendAll(
    parsePracticeKgHeaderParticipants("from")(headers.from ?? ""),
    A.appendAll(
      parsePracticeKgHeaderParticipants("to")(A.join(headers.to, ", ")),
      parsePracticeKgHeaderParticipants("cc")(A.join(headers.cc, ", "))
    )
  );

const rfcParticipantsOf = (row: PracticeKgMailIndexRow): ReadonlyArray<PracticeKgEmailParticipant> =>
  pipe(O.fromUndefinedOr(row.internet), O.map(internetParticipants), O.getOrElse(A.empty<PracticeKgEmailParticipant>));

const fieldSeparator = "\u0000";

// A message without a Message-ID is its MAPI submit (else delivery) time, sender,
// subject and recipients, then its RFC 5322 From, To and Cc addresses: the same
// item exported twice carries the same values, whatever the export tree and
// artifact, and two items that differ in any participant stay apart. Only an
// item with no time at all falls back to its place in one export.
const mapiKeyOf = (row: PracticeKgMailIndexRow): O.Option<string> =>
  O.map(outlookTimeOf(row), (time) =>
    A.join(
      [
        time,
        Str.toLowerCase(O.getOrElse(outlookSenderOf(row), () => "")),
        subjectOf(row),
        ...A.sort(
          A.getSomes(A.map(row.recipients, (recipient) => O.map(nonEmpty(recipient.emailAddress), Str.toLowerCase))),
          Order.String
        ),
        "rfc",
        ...A.sort(
          A.map(rfcParticipantsOf(row), (participant) => `${participant.role}:${participant.address}`),
          Order.String
        ),
      ],
      fieldSeparator
    )
  );

const messageKeyOf = (row: PracticeKgMailIndexRow): string =>
  pipe(
    O.map(messageIdOf(row), (messageId) => `mail:${messageId}`),
    O.orElse(() => O.map(mapiKeyOf(row), (key) => `mail:mapi:${key}`)),
    O.getOrElse(() => `mail:${row.tree}/${row.messagePath}`)
  );

const isoOf = (value: string): O.Option<string> => pipe(DateTime.make(value), O.map(DateTime.formatIso));

const outlookIsoOf = (value: string): O.Option<string> =>
  pipe(rfc5322DateFromOutlookTimestamp(value), O.flatMap(DateTime.make), O.map(DateTime.formatIso));

const createdAtOf = (row: PracticeKgMailIndexRow): string | null =>
  pipe(
    O.flatMap(nonEmpty(row.internet?.date), isoOf),
    O.orElse(() => O.flatMap(nonEmpty(row.outlook.clientSubmitTime), outlookIsoOf)),
    O.orElse(() => O.flatMap(nonEmpty(row.outlook.deliveryTime), outlookIsoOf)),
    O.getOrNull
  );

type ParsedParticipants = {
  readonly dropped: number;
  readonly participants: ReadonlyArray<PracticeKgEmailParticipant>;
};

const hasAddress = Str.includes("@");

const recipientRole = (kind: string): "cc" | "to" => (kind === "cc" || kind === "bcc" ? "cc" : "to");

// Without RFC 5322 headers, the MAPI sender and the export's recipients stand in;
// an Exchange legacy address carries no mailbox and is dropped, counted.
const outlookParticipants = (row: PracticeKgMailIndexRow): ParsedParticipants => {
  const sender = O.map(outlookSenderOf(row), (address) => [address, "from"] as const);
  const recipients = A.getSomes(
    A.map(row.recipients, (recipient) =>
      O.map(nonEmpty(recipient.emailAddress), (address) => [address, recipientRole(recipient.kind)] as const)
    )
  );
  const entries = A.appendAll(O.toArray(sender), recipients);
  const smtp = A.filter(entries, ([address]) => hasAddress(address));
  return {
    dropped: A.length(entries) - A.length(smtp),
    participants: A.flatMap(smtp, ([address, role]) => parsePracticeKgHeaderParticipants(role)(address)),
  };
};

const participantsOfRow = (row: PracticeKgMailIndexRow): ParsedParticipants =>
  pipe(
    O.fromUndefinedOr(row.internet),
    O.filter(
      (headers) =>
        O.isSome(nonEmpty(headers.from)) ||
        A.isReadonlyArrayNonEmpty(headers.to) ||
        A.isReadonlyArrayNonEmpty(headers.cc)
    ),
    O.match({
      onNone: () => outlookParticipants(row),
      onSome: (headers) => ({ dropped: 0, participants: internetParticipants(headers) }),
    })
  );

const participantKey = (participant: PracticeKgEmailParticipant): string =>
  `${participant.role}\u0000${participant.address}`;

const attributionOf = (digest: string, familyKey: string): PracticeKgDocumentAttribution => {
  const parts = Str.split(familyKey, ".");
  const family = A.get(parts, 1);
  return PracticeKgDocumentAttribution.make({
    attributionSource: "subject-reference",
    client: O.isSome(family) ? O.getOrNull(A.get(parts, 0)) : null,
    digest,
    docket: null,
    docketKey: null,
    family: O.getOrElse(family, () => familyKey),
    familyKey,
    recycled: false,
  });
};

type Placed = {
  readonly createdAt: string | null;
  readonly familyKeys: ReadonlyArray<string>;
  readonly key: string;
  readonly messageId: O.Option<string>;
  readonly parsed: ParsedParticipants;
  readonly referenced: boolean;
};

type Attributed = Placed & { readonly familyKey: string };

const byKey = Order.mapInput(Order.String, (placed: Attributed) => placed.key);

// Only a subject naming exactly one matter places a message.
const attributedOf = (placed: Placed): O.Option<Attributed> =>
  A.length(placed.familyKeys) === 1
    ? O.map(A.head(placed.familyKeys), (familyKey) => ({ ...placed, familyKey }))
    : O.none();

const natural = (value: number): number => S.Natural.make(value);

/**
 * Places the distinct messages of an index on matters by their subject lines
 * and turns the placed ones into correspondent evidence.
 *
 * **Details**
 *
 * A message is one `Message-ID` (angle brackets removed); without one it is
 * its MAPI submit (else delivery) time, sender, subject and recipients plus
 * its RFC 5322 From, To and Cc addresses, so an item exported in two trees
 * counts once (the first row wins) and two items that differ in a participant
 * stay apart; an item with neither a `Message-ID` nor a time is its tree and
 * path. The subject
 * (RFC 5322, else the MAPI subject, else the conversation topic) is scanned
 * for docket, application, and patent references and resolved with
 * `matchPracticeKgMatterReferences`; only a subject naming exactly one matter
 * places the message, and a subject naming several leaves it out as
 * ambiguous. Participants come from the RFC 5322 From, To, and Cc headers,
 * else from the MAPI sender and the export's recipients, where an Exchange
 * legacy address (no mailbox) is dropped and counted. Each placed message
 * yields one `subject-reference` attribution and one message row for the
 * correspondent tables.
 *
 * **Example** (Nothing to place)
 *
 * ```ts
 * import { attributePracticeKgMailIndexRows, PracticeKgMatterTables } from "@beep/law-practice-server"
 *
 * const result = attributePracticeKgMailIndexRows(PracticeKgMatterTables.make({ dockets: [], matters: [] }))([])
 * console.log(result.counts.rows) // 0
 * ```
 *
 * @param tables - The bundle's matters and dockets.
 * @returns A function from index rows, first file first, to the placed messages, their attributions, and the counts.
 * @category use-cases
 * @since 0.0.0
 */
export const attributePracticeKgMailIndexRows = (
  tables: PracticeKgMatterTables
): ((rows: ReadonlyArray<PracticeKgMailIndexRow>) => PracticeKgMailIndexMessages) => {
  const match = matchPracticeKgMatterReferences(tables);
  return (rows) => {
    const seen = MutableHashSet.empty<string>();
    const distinct = A.filter(rows, (row) => {
      const key = messageKeyOf(row);
      const fresh = !MutableHashSet.has(seen, key);
      MutableHashSet.add(seen, key);
      return fresh;
    });
    const placed = A.map(distinct, (row): Placed => {
      const references = extractPracticeKgReferences(subjectOf(row));
      return {
        createdAt: createdAtOf(row),
        familyKeys: A.dedupe(A.map(match(references), (hit) => hit.familyKey)),
        key: messageKeyOf(row),
        messageId: messageIdOf(row),
        parsed: participantsOfRow(row),
        referenced: A.isReadonlyArrayNonEmpty(references),
      };
    });
    const attributed = A.sort(A.getSomes(A.map(placed, attributedOf)), byKey);
    const messages = A.map(attributed, (message) =>
      PracticeKgEmailMessage.make({
        createdAt: message.createdAt,
        digest: message.key,
        ...O.match(message.messageId, { onNone: () => ({}), onSome: (messageId) => ({ messageId }) }),
        participants: A.dedupeWith(
          message.parsed.participants,
          (left, right) => participantKey(left) === participantKey(right)
        ),
      })
    );
    return PracticeKgMailIndexMessages.make({
      attributions: A.map(attributed, (message) => attributionOf(message.key, message.familyKey)),
      counts: PracticeKgMailIndexCounts.make({
        ambiguousMessages: natural(A.length(A.filter(placed, (message) => A.length(message.familyKeys) > 1))),
        attributedMessages: natural(A.length(attributed)),
        attributedWithoutAddress: natural(
          A.length(A.filter(attributed, (message) => !A.isReadonlyArrayNonEmpty(message.parsed.participants)))
        ),
        distinctMessages: natural(A.length(distinct)),
        exchangeAddressesDropped: natural(A.reduce(attributed, 0, (total, message) => total + message.parsed.dropped)),
        rows: natural(A.length(rows)),
        unreferencedMessages: natural(A.length(A.filter(placed, (message) => !message.referenced))),
      }),
      messages,
    });
  };
};

const decodeRow = S.decodeUnknownEffect(S.fromJsonString(PracticeKgMailIndexRow));

const readIndexFile = (path: string) =>
  readJsonlLines(
    path,
    (cause) => PracticeKgProjectionError.make({ cause, message: `Failed reading mail index "${path}".` }),
    (content, lineNumber) =>
      decodeRow(content).pipe(
        Effect.mapError((cause) =>
          PracticeKgProjectionError.make({
            cause,
            message: `Mail index "${path}" line ${lineNumber} is not a message row.`,
          })
        )
      )
  );

/**
 * Reads the corpus provenance message index files and places their messages
 * on matters by subject line.
 *
 * **Details**
 *
 * Files are read in the given order, which decides which copy of a message
 * exported twice counts. A line that is not a message row fails the read and
 * names the file and line. No index files means no messages, with zero
 * counts.
 *
 * **Example** (Read no files)
 *
 * ```ts
 * import { PracticeKgMailIndexInput, PracticeKgMatterTables, readPracticeKgMailIndex } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * const read = readPracticeKgMailIndex(
 *   PracticeKgMailIndexInput.make({ paths: [], tables: PracticeKgMatterTables.make({ dockets: [], matters: [] }) })
 * )
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @param input - Index files and the matter tables to resolve against.
 * @returns The placed messages, their attributions, and the counts.
 * @category use-cases
 * @since 0.0.0
 */
export const readPracticeKgMailIndex = Effect.fn("PracticeKg.readMailIndex")(function* (
  input: PracticeKgMailIndexInput
): Effect.fn.Return<PracticeKgMailIndexMessages, PracticeKgProjectionError, FileSystem.FileSystem> {
  const rows = yield* Effect.forEach(input.paths, readIndexFile);
  return attributePracticeKgMailIndexRows(input.tables)(A.flatten(rows));
});
