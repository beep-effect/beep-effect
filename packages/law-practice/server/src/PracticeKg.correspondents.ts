/**
 * Matter correspondents: who writes about which matter, read from the email
 * documents the bundle holds, joined to the practice's contacts table, plus the
 * correspondent lookup over the resulting bundle tables.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import {
  PracticeKgContactLinkSource,
  PracticeKgCorrespondentAddressError,
  PracticeKgCorrespondentCandidate,
  PracticeKgCorrespondentContact,
  PracticeKgCorrespondentEvidence,
  PracticeKgCorrespondentLink,
  PracticeKgCorrespondentLookupResult,
  PracticeKgMatterLookupError,
  resolvePracticeKgCorrespondent,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import { Effect, FileSystem, flow, HashSet, MutableHashMap, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sqlStringLiteral } from "./internal/Sql.ts";
import { PracticeKgContact } from "./PracticeKg.contacts.ts";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { PracticeKgDocumentAttribution } from "./PracticeKg.families.ts";
import { GraphTextSourceSpec } from "./PracticeKg.fts.ts";
import { PracticeKgBundle } from "./PracticeKg.host.ts";
import { withDuckDb } from "./PracticeKg.rows.ts";
import type { PracticeKgCorrespondentLookupRequest } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("PracticeKg.correspondents");

/**
 * Header an address appeared in.
 *
 * **Example** (Decode a participant role)
 *
 * ```ts
 * import { PracticeKgEmailParticipantRole } from "@beep/law-practice-server"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(PracticeKgEmailParticipantRole)("cc")) // "cc"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgEmailParticipantRole = LiteralKit(["from", "to", "cc"]).pipe(
  $I.annoteSchema("PracticeKgEmailParticipantRole", { description: "Email header an address appeared in." })
);

/**
 * Runtime type for {@link PracticeKgEmailParticipantRole}.
 *
 * **Example** (Type a participant role)
 *
 * ```ts
 * import type { PracticeKgEmailParticipantRole } from "@beep/law-practice-server"
 *
 * const role: PracticeKgEmailParticipantRole = "from"
 * console.log(role) // "from"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgEmailParticipantRole = typeof PracticeKgEmailParticipantRole.Type;

/**
 * One address in one header of one email document.
 *
 * **Example** (Make a participant)
 *
 * ```ts
 * import { PracticeKgEmailParticipant } from "@beep/law-practice-server"
 *
 * const participant = PracticeKgEmailParticipant.make({ address: "pat@example.com", name: "Pat", role: "from" })
 * console.log(participant.role) // "from"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgEmailParticipant extends S.Class<PracticeKgEmailParticipant>($I`PracticeKgEmailParticipant`)(
  {
    address: S.NonEmptyString,
    name: S.NullOr(S.String),
    role: PracticeKgEmailParticipantRole,
  },
  $I.annote("PracticeKgEmailParticipant", { description: "Lower-cased address, header name, and header role." })
) {}

/**
 * The headers of one email document the bundle holds.
 *
 * **Details**
 *
 * `digest` ties the message to its attribution. `messageId` is the RFC 5322
 * `Message-ID` when the source carried one: two copies of one message (a file
 * the attorney saved and the same message in a mail archive) have different
 * digests and the same `messageId`, and are counted once per matter.
 *
 * **Example** (Make an email message)
 *
 * ```ts
 * import { PracticeKgEmailMessage } from "@beep/law-practice-server"
 *
 * const message = PracticeKgEmailMessage.make({ createdAt: null, digest: "sha256:9f2c", participants: [] })
 * console.log(message.participants.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgEmailMessage extends S.Class<PracticeKgEmailMessage>($I`PracticeKgEmailMessage`)(
  {
    createdAt: S.NullOr(S.String),
    digest: S.NonEmptyString,
    messageId: S.optionalKey(S.NonEmptyString),
    participants: S.Array(PracticeKgEmailParticipant),
  },
  $I.annote("PracticeKgEmailMessage", {
    description: "Digest, creation time, participants, and, when known, the Message-ID of one email.",
  })
) {}

const messageIdBracketsPattern = /^<|>$/gu;

/**
 * Normalises an RFC 5322 `Message-ID` so copies of one message compare equal.
 *
 * **Details**
 *
 * Surrounding whitespace and the angle brackets are removed; the rest is kept
 * as written, because the left part of a `Message-ID` is case-sensitive. A
 * value that is then empty is none.
 *
 * **Example** (Normalise a bracketed id)
 *
 * ```ts
 * import { normalizePracticeKgMessageId } from "@beep/law-practice-server"
 *
 * console.log(normalizePracticeKgMessageId(" <1@example.com> ")) // Option.some("1@example.com")
 * ```
 *
 * @param raw - The header value as a source wrote it.
 * @returns The normalised id, when the value holds one.
 * @category parsers
 * @since 0.0.0
 */
export const normalizePracticeKgMessageId = (raw: string): O.Option<string> =>
  pipe(Str.trim(raw), Str.replace(messageIdBracketsPattern, ""), Str.trim, O.liftPredicate(Str.isNonEmpty));

// One message is its Message-ID when it has one, else the digest of the copy at hand.
const identityOf = (message: PracticeKgEmailMessage): string =>
  pipe(
    O.fromUndefinedOr(message.messageId),
    O.flatMap(normalizePracticeKgMessageId),
    O.match({ onNone: () => message.digest, onSome: (messageId) => `mail:${messageId}` })
  );

/**
 * One row of the bundle's `matter_correspondents` table.
 *
 * **Example** (Make a correspondent row)
 *
 * ```ts
 * import { PracticeKgCorrespondentRow } from "@beep/law-practice-server"
 *
 * const row = PracticeKgCorrespondentRow.make({
 *   address: "pat@example.com",
 *   ccCount: 0,
 *   contactId: null,
 *   displayName: "Pat",
 *   epistemicStatus: "mention-derived",
 *   familyKey: "12345.10008",
 *   firstAt: null,
 *   fromCount: 1,
 *   isPracticeAddress: false,
 *   lastAt: null,
 *   messageCount: 1,
 *   roleAddress: false,
 *   toCount: 0
 * })
 * console.log(row.messageCount) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgCorrespondentRow extends S.Class<PracticeKgCorrespondentRow>($I`PracticeKgCorrespondentRow`)(
  {
    address: S.NonEmptyString,
    ccCount: S.Finite,
    contactId: S.NullOr(S.String),
    displayName: S.NullOr(S.String),
    epistemicStatus: PracticeKgEpistemicStatus,
    familyKey: S.NonEmptyString,
    firstAt: S.NullOr(S.String),
    fromCount: S.Finite,
    isPracticeAddress: S.Boolean,
    lastAt: S.NullOr(S.String),
    messageCount: S.Finite,
    roleAddress: S.Boolean,
    toCount: S.Finite,
  },
  $I.annote("PracticeKgCorrespondentRow", {
    description: "Message counts for one address on one matter, as persisted in matter_correspondents.",
  })
) {}

/**
 * One row of the bundle's `contact_client_links` table.
 *
 * **Example** (Make a link row)
 *
 * ```ts
 * import { PracticeKgContactClientLinkRow } from "@beep/law-practice-server"
 *
 * const row = PracticeKgContactClientLinkRow.make({
 *   clientNumber: "12345",
 *   contactId: "c_0123456789ab",
 *   evidence: "answered",
 *   familyKey: null,
 *   source: "attorney-answer"
 * })
 * console.log(row.familyKey) // null
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgContactClientLinkRow extends S.Class<PracticeKgContactClientLinkRow>(
  $I`PracticeKgContactClientLinkRow`
)(
  {
    clientNumber: S.NonEmptyString,
    contactId: S.NonEmptyString,
    evidence: S.String,
    familyKey: S.NullOr(S.String),
    source: PracticeKgContactLinkSource,
  },
  $I.annote("PracticeKgContactClientLinkRow", {
    description: "Contact link to a client and optional matter, as persisted in contact_client_links.",
  })
) {}

/**
 * One row of the bundle's `contact_addresses` table: which contact owns an address.
 *
 * **Example** (Make an address row)
 *
 * ```ts
 * import { PracticeKgContactAddressRow } from "@beep/law-practice-server"
 *
 * const row = PracticeKgContactAddressRow.make({
 *   address: "pat@example.com",
 *   contactId: "c_0123456789ab",
 *   displayName: "Pat Example",
 *   isPracticeAddress: false,
 *   organization: null,
 *   roleAddress: false
 * })
 * console.log(row.contactId) // "c_0123456789ab"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgContactAddressRow extends S.Class<PracticeKgContactAddressRow>($I`PracticeKgContactAddressRow`)(
  {
    address: S.NonEmptyString,
    contactId: S.NonEmptyString,
    displayName: S.String,
    isPracticeAddress: S.Boolean,
    organization: S.NullOr(S.String),
    roleAddress: S.Boolean,
  },
  $I.annote("PracticeKgContactAddressRow", {
    description: "Contact that owns an email address, as persisted in contact_addresses.",
  })
) {}

/**
 * Rows for the three correspondent tables of one bundle.
 *
 * **Example** (Make empty correspondent tables)
 *
 * ```ts
 * import { PracticeKgCorrespondentTables } from "@beep/law-practice-server"
 *
 * const tables = PracticeKgCorrespondentTables.make({ addresses: [], correspondents: [], links: [] })
 * console.log(tables.correspondents.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgCorrespondentTables extends S.Class<PracticeKgCorrespondentTables>(
  $I`PracticeKgCorrespondentTables`
)(
  {
    addresses: S.Array(PracticeKgContactAddressRow),
    correspondents: S.Array(PracticeKgCorrespondentRow),
    links: S.Array(PracticeKgContactClientLinkRow),
  },
  $I.annote("PracticeKgCorrespondentTables", {
    description: "Rows for matter_correspondents, contact_client_links, and contact_addresses.",
  })
) {}

/**
 * Input to {@link buildPracticeKgCorrespondentTables}.
 *
 * **Example** (Make an empty input)
 *
 * ```ts
 * import { PracticeKgCorrespondentTablesInput } from "@beep/law-practice-server"
 *
 * const input = PracticeKgCorrespondentTablesInput.make({
 *   attributions: [],
 *   contacts: [],
 *   messages: [],
 *   practiceDomains: ["example-law.test"]
 * })
 * console.log(input.practiceDomains) // ["example-law.test"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgCorrespondentTablesInput extends S.Class<PracticeKgCorrespondentTablesInput>(
  $I`PracticeKgCorrespondentTablesInput`
)(
  {
    attributions: S.Array(PracticeKgDocumentAttribution),
    contacts: S.Array(PracticeKgContact),
    messages: S.Array(PracticeKgEmailMessage),
    practiceDomains: S.Array(S.String),
  },
  $I.annote("PracticeKgCorrespondentTablesInput", {
    description: "Document attributions, email headers, contacts, and the practice's own mail domains.",
  })
) {}

/**
 * Input to {@link readPracticeKgEmailMessages}.
 *
 * **Example** (Make a read input)
 *
 * ```ts
 * import { PracticeKgEmailMessagesInput } from "@beep/law-practice-server"
 *
 * const input = PracticeKgEmailMessagesInput.make({ databasePath: "/bundle/practice.duckdb", sourceSpecs: [] })
 * console.log(input.sourceSpecs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgEmailMessagesInput extends S.Class<PracticeKgEmailMessagesInput>(
  $I`PracticeKgEmailMessagesInput`
)(
  {
    databasePath: S.String,
    sourceSpecs: S.Array(GraphTextSourceSpec),
  },
  $I.annote("PracticeKgEmailMessagesInput", {
    description: "Bundle DuckDB and the extraction sources whose metadata holds the email headers.",
  })
) {}

const normalizeAddress = (address: string): string => Str.toLowerCase(Str.trim(address));

const domainOf = (address: string): string => pipe(Str.split(address, "@"), A.lastNonEmpty);

/**
 * Whether an address is on one of the practice's own domains (or a subdomain).
 *
 * **Example** (Check a practice address)
 *
 * ```ts
 * import { isPracticeKgPracticeAddress } from "@beep/law-practice-server"
 *
 * console.log(isPracticeKgPracticeAddress(["example-law.test"])("ann@mail.Example-Law.test")) // true
 * console.log(isPracticeKgPracticeAddress(["example-law.test"])("pat@example.com")) // false
 * ```
 *
 * @param practiceDomains - The practice's own mail domains.
 * @returns A predicate over email addresses.
 * @category predicates
 * @since 0.0.0
 */
export const isPracticeKgPracticeAddress =
  (practiceDomains: ReadonlyArray<string>) =>
  (address: string): boolean => {
    const domain = domainOf(normalizeAddress(address));
    return A.some(practiceDomains, (configured) => {
      const practice = Str.replace(/^@/u, "")(normalizeAddress(configured));
      return domain === practice || Str.endsWith(`.${practice}`)(domain);
    });
  };

const addressEntryPattern = /(?:"([^"]*)"|([^,<"]*?))\s*<([^<>\s]+@[^<>\s]+)>|([^\s,<>";]+@[^\s,<>"';]+)/gu;
const surroundingQuotesPattern = /^['"\s]+|['"\s]+$/gu;
// A bare address wrapped in single quotes: the pattern keeps the opening quote and stops at the closing one.
const bareAddressQuotePattern = /^'|'$/gu;

const cleanName = (raw: string | null | undefined): string | null =>
  pipe(O.fromNullishOr(raw), O.map(Str.replace(surroundingQuotesPattern, "")), O.filter(Str.isNonEmpty), O.getOrNull);

const participantsOf = (
  header: string,
  role: PracticeKgEmailParticipantRole
): ReadonlyArray<PracticeKgEmailParticipant> =>
  A.getSomes(
    A.map(A.fromIterable(header.matchAll(addressEntryPattern)), (match) =>
      pipe(
        O.orElse(O.fromNullishOr(match[3]), () =>
          O.map(O.fromNullishOr(match[4]), Str.replace(bareAddressQuotePattern, ""))
        ),
        O.map((address) =>
          PracticeKgEmailParticipant.make({
            address: normalizeAddress(address),
            name: cleanName(match[1] ?? match[2]),
            role,
          })
        )
      )
    )
  );

/**
 * Reads the participants named by one address header value.
 *
 * **Details**
 *
 * Accepts the header forms the build meets: bare addresses, `Name <address>`
 * entries, quoted display names, and comma-separated lists of them. Addresses
 * come back lower-cased and trimmed, a surrounding single quote stripped, and
 * every participant carries the given role.
 *
 * **Example** (Read a To header)
 *
 * ```ts
 * import { parsePracticeKgHeaderParticipants } from "@beep/law-practice-server"
 *
 * const participants = parsePracticeKgHeaderParticipants("to")("Pat <Pat@Example.com>, sam@other.test")
 * console.log(participants.map((participant) => participant.address)) // ["pat@example.com", "sam@other.test"]
 * ```
 *
 * @param role - The role every participant gets.
 * @returns A parser from one header value, possibly listing several entries, to its participants in order.
 * @category parsers
 * @since 0.0.0
 */
export const parsePracticeKgHeaderParticipants =
  (role: PracticeKgEmailParticipantRole) =>
  (header: string): ReadonlyArray<PracticeKgEmailParticipant> =>
    participantsOf(header, role);

const TikaValue = S.Union([S.String, S.Array(S.String)]);

class TikaEmailFields extends S.Class<TikaEmailFields>($I`TikaEmailFields`)({
  "dcterms:created": S.optionalKey(TikaValue),
  "Message-Cc": S.optionalKey(TikaValue),
  "Message-From": S.optionalKey(TikaValue),
  "Message-To": S.optionalKey(TikaValue),
  "Message:From-Email": S.optionalKey(TikaValue),
  "Message:Raw-Header:Message-ID": S.optionalKey(TikaValue),
}) {}

const isTikaEmailFieldList = S.is(S.NonEmptyArray(TikaEmailFields));

// Tika writes a single object, or with recursive parsing an array whose first object is the container.
const decodeTikaFields = S.decodeUnknownEffect(
  S.fromJsonString(S.Union([TikaEmailFields, S.NonEmptyArray(TikaEmailFields)]))
);

const asList = (value: typeof TikaValue.Type): ReadonlyArray<string> => (P.isString(value) ? [value] : value);

const joined = (value: typeof TikaValue.Type | undefined): string =>
  pipe(O.fromNullishOr(value), O.map(asList), O.getOrElse(A.empty<string>), A.join(", "));

const firstValue = (value: typeof TikaValue.Type | undefined): string | null =>
  pipe(O.fromNullishOr(value), O.flatMap(flow(asList, A.head)), O.map(Str.trim), O.filter(Str.isNonEmpty), O.getOrNull);

// `Message-From` usually carries `Name <address>`; when it carries a name only,
// the address comes from `Message:From-Email` and the name from `Message-From`.
const senderOf = (fields: TikaEmailFields): ReadonlyArray<PracticeKgEmailParticipant> => {
  const parsed = participantsOf(joined(fields["Message-From"]), "from");
  return A.isReadonlyArrayNonEmpty(parsed)
    ? parsed
    : A.map(participantsOf(joined(fields["Message:From-Email"]), "from"), (participant) =>
        PracticeKgEmailParticipant.make({ ...participant, name: cleanName(firstValue(fields["Message-From"])) })
      );
};

const messageFrom = (digest: string, fields: TikaEmailFields): PracticeKgEmailMessage =>
  PracticeKgEmailMessage.make({
    createdAt: firstValue(fields["dcterms:created"]),
    digest,
    ...O.match(
      O.flatMap(O.fromNullishOr(firstValue(fields["Message:Raw-Header:Message-ID"])), normalizePracticeKgMessageId),
      { onNone: () => ({}), onSome: (messageId) => ({ messageId }) }
    ),
    participants: [
      ...senderOf(fields),
      ...participantsOf(joined(fields["Message-To"]), "to"),
      ...participantsOf(joined(fields["Message-Cc"]), "cc"),
    ],
  });

class EmailSourceRow extends S.Class<EmailSourceRow>($I`EmailSourceRow`)({
  digest: S.NonEmptyString,
  metadataDir: S.String,
  operationId: S.NonEmptyString,
}) {}

const decodeEmailSourceRows = S.decodeUnknownEffect(S.Array(EmailSourceRow));

// The extension decides what is an email; the sources manifest names the
// operation whose metadata JSON carries its headers.
const emailSourcesSql = (sources: ReadonlyArray<{ readonly metadataDir: string; readonly sourcesPath: string }>) => `
WITH sources AS (
  ${A.join(
    A.map(
      sources,
      ({ metadataDir, sourcesPath }, ordinal) =>
        `SELECT digest, operationId, ${sqlStringLiteral(metadataDir)} AS metadata_dir, ${ordinal} AS ordinal
  FROM read_json(${sqlStringLiteral(sourcesPath)}, format='newline_delimited')`
    ),
    "\n  UNION ALL\n  "
  )}
)
SELECT d.digest, s.operationId AS "operationId", s.metadata_dir AS "metadataDir"
FROM documents d
JOIN sources s ON d.digest = s.digest OR d.digest = 'sha256:' || s.digest
WHERE lower(d.effective_name) LIKE '%.eml' OR lower(d.effective_name) LIKE '%.msg'
QUALIFY ROW_NUMBER() OVER (PARTITION BY d.digest ORDER BY s.ordinal, s.operationId) = 1
ORDER BY d.digest`;

const containerOf = (decoded: TikaEmailFields | A.NonEmptyReadonlyArray<TikaEmailFields>): TikaEmailFields =>
  isTikaEmailFieldList(decoded) ? A.headNonEmpty(decoded) : decoded;

const readMessage = Effect.fn("PracticeKg.readEmailMessage")(function* (source: EmailSourceRow) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const metadataPath = path.join(source.metadataDir, `${source.operationId}.json`);
  return yield* fs.readFileString(metadataPath).pipe(
    Effect.flatMap(decodeTikaFields),
    Effect.map((decoded) => messageFrom(source.digest, containerOf(decoded))),
    Effect.option
  );
});

/**
 * Read the headers of every email document in a built bundle from its
 * extraction metadata.
 *
 * **Details**
 *
 * An email document is a `documents` row whose name ends in `.eml` or `.msg`.
 * Its headers come from the Tika metadata JSON beside the text it was
 * extracted to (`<extract root>/metadata/<operationId>.json`): `Message-From`
 * (with `Message:From-Email` when the name carries no address),
 * `Message-To`, `Message-Cc`, and `dcterms:created`. A document whose
 * metadata is missing or unreadable is skipped and counted in a warning.
 * Messages come back ordered by digest.
 *
 * **Example** (Read email headers)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PracticeKgEmailMessagesInput, readPracticeKgEmailMessages } from "@beep/law-practice-server"
 *
 * const messages = readPracticeKgEmailMessages(
 *   PracticeKgEmailMessagesInput.make({ databasePath: "/bundle/practice.duckdb", sourceSpecs: [] })
 * )
 * console.log(Effect.isEffect(messages)) // true
 * ```
 *
 * @param input - Bundle DuckDB and extraction sources.
 * @returns Email headers, one message per email document with readable metadata.
 * @effects Opens the bundle DuckDB read-only and reads metadata files.
 * @category use-cases
 * @since 0.0.0
 */
export const readPracticeKgEmailMessages = Effect.fn("PracticeKg.readEmailMessages")(function* (
  input: PracticeKgEmailMessagesInput
): Effect.fn.Return<
  ReadonlyArray<PracticeKgEmailMessage>,
  PracticeKgProjectionError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  if (!A.isReadonlyArrayNonEmpty(input.sourceSpecs)) {
    return A.empty<PracticeKgEmailMessage>();
  }
  const sources = A.map(input.sourceSpecs, ({ sourcesPath }) => ({
    metadataDir: path.join(path.dirname(sourcesPath), "metadata"),
    sourcesPath,
  }));
  const emailSources = yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    return yield* db.query(emailSourcesSql(sources)).pipe(Effect.flatMap(decodeEmailSourceRows));
  }).pipe(
    withDuckDb(
      DuckDbConnectionOptions.make({ databaseOptions: { access_mode: "READ_ONLY" }, databasePath: input.databasePath })
    ),
    PracticeKgProjectionError.mapError(`Failed listing email documents in "${input.databasePath}".`)
  );
  const read = yield* Effect.forEach(emailSources, readMessage);
  const missing = A.length(read) - A.length(A.getSomes(read));
  if (missing > 0) {
    yield* Effect.logWarning(`${missing} email document(s) had no readable header metadata and were skipped.`);
  }
  return A.getSomes(read);
});

type Tally = {
  readonly cc: HashSet.HashSet<string>;
  readonly firstAt: O.Option<string>;
  readonly from: HashSet.HashSet<string>;
  readonly headerName: O.Option<string>;
  readonly lastAt: O.Option<string>;
  readonly messages: HashSet.HashSet<string>;
  readonly to: HashSet.HashSet<string>;
};

const emptyTally: Tally = {
  cc: HashSet.empty(),
  firstAt: O.none(),
  from: HashSet.empty(),
  headerName: O.none(),
  lastAt: O.none(),
  messages: HashSet.empty(),
  to: HashSet.empty(),
};

const extremeOf =
  (pick: (values: readonly [string, ...Array<string>]) => string) =>
  (current: O.Option<string>, next: string | null): O.Option<string> =>
    pipe(A.getSomes([current, O.fromNullishOr(next)]), (values) =>
      A.isReadonlyArrayNonEmpty(values) ? O.some(pick(values)) : O.none()
    );

const earliest = extremeOf((values) => A.min(values, Order.String));
const latest = extremeOf((values) => A.max(values, Order.String));

const tallied = (tally: Tally, message: PracticeKgEmailMessage, participant: PracticeKgEmailParticipant): Tally => ({
  ...tally,
  ...PracticeKgEmailParticipantRole.$match(participant.role, {
    cc: () => ({ cc: HashSet.add(tally.cc, identityOf(message)) }),
    from: () => ({ from: HashSet.add(tally.from, identityOf(message)) }),
    to: () => ({ to: HashSet.add(tally.to, identityOf(message)) }),
  }),
  firstAt: earliest(tally.firstAt, message.createdAt),
  headerName: O.orElse(tally.headerName, () => O.fromNullishOr(participant.name)),
  lastAt: latest(tally.lastAt, message.createdAt),
  messages: HashSet.add(tally.messages, identityOf(message)),
});

const tallyKey = (familyKey: string, address: string): string => `${familyKey}\u0000${address}`;

type AddressContact = { readonly contact: PracticeKgContact; readonly role: boolean };

const contactsByAddress = (
  contacts: ReadonlyArray<PracticeKgContact>
): MutableHashMap.MutableHashMap<string, ReadonlyArray<AddressContact>> => {
  const index = MutableHashMap.empty<string, ReadonlyArray<AddressContact>>();
  const sorted = A.sort(
    contacts,
    Order.mapInput(Order.String, (contact: PracticeKgContact) => contact.contactId)
  );
  // One owner per contact: a contact listing an address twice (case variants)
  // is one owner, a role mailbox if either listing says so.
  A.forEach(sorted, (contact) =>
    A.forEach(contact.emails, (email) => {
      const address = normalizeAddress(email.address);
      const owners = pipe(MutableHashMap.get(index, address), O.getOrElse(A.empty<AddressContact>));
      const isSame = (owner: AddressContact) => owner.contact.contactId === contact.contactId;
      MutableHashMap.set(
        index,
        address,
        A.append(
          A.filter(owners, (owner) => !isSame(owner)),
          {
            contact,
            role: email.role || A.some(owners, (owner) => isSame(owner) && owner.role),
          }
        )
      );
    })
  );
  return index;
};

const tallyMessages = (
  input: PracticeKgCorrespondentTablesInput
): MutableHashMap.MutableHashMap<
  string,
  { readonly address: string; readonly familyKey: string; readonly tally: Tally }
> => {
  const familyOf = MutableHashMap.fromIterable(
    A.getSomes(
      A.map(
        A.filter(input.attributions, (attribution) => !attribution.recycled),
        (attribution) =>
          O.map(O.fromNullishOr(attribution.familyKey), (familyKey) => [attribution.digest, familyKey] as const)
      )
    )
  );
  const tallies = MutableHashMap.empty<
    string,
    { readonly address: string; readonly familyKey: string; readonly tally: Tally }
  >();
  const messages = A.sort(
    input.messages,
    Order.mapInput(Order.String, (message: PracticeKgEmailMessage) => message.digest)
  );
  A.forEach(messages, (message) =>
    O.map(MutableHashMap.get(familyOf, message.digest), (familyKey) =>
      A.forEach(message.participants, (participant) => {
        const key = tallyKey(familyKey, participant.address);
        const current = pipe(
          MutableHashMap.get(tallies, key),
          O.map((entry) => entry.tally),
          O.getOrElse(() => emptyTally)
        );
        MutableHashMap.set(tallies, key, {
          address: participant.address,
          familyKey,
          tally: tallied(current, message, participant),
        });
      })
    )
  );
  return tallies;
};

const soleContactOf = (contacts: ReadonlyArray<AddressContact>): O.Option<AddressContact> =>
  A.length(contacts) === 1 ? A.head(contacts) : O.none();

/**
 * Derive the correspondent tables from attributed email documents and contacts.
 *
 * **Details**
 *
 * `matter_correspondents` has one row per matter and address: every email
 * document attributed to a family (recycle stubs excluded) counts once per
 * address, and once per header the address appears in. The contact columns
 * come from the contacts table when exactly one contact owns the address;
 * otherwise the display name is the first name the headers give, in digest
 * order. Every row is `mention-derived`: appearing on a matter's mail is
 * evidence, not membership. `contact_client_links` mirrors the contacts'
 * links and `contact_addresses` the contacts' addresses. Rows are ordered by
 * key so a rebuild is stable.
 *
 * **Example** (Derive from nothing)
 *
 * ```ts
 * import { buildPracticeKgCorrespondentTables, PracticeKgCorrespondentTablesInput } from "@beep/law-practice-server"
 *
 * const tables = buildPracticeKgCorrespondentTables(
 *   PracticeKgCorrespondentTablesInput.make({ attributions: [], contacts: [], messages: [], practiceDomains: [] })
 * )
 * console.log(tables.links.length) // 0
 * ```
 *
 * @param input - Attributions, email headers, contacts, and practice domains.
 * @returns Ordered rows for the three tables.
 * @category use-cases
 * @since 0.0.0
 */
export const buildPracticeKgCorrespondentTables = (
  input: PracticeKgCorrespondentTablesInput
): PracticeKgCorrespondentTables => {
  const isPractice = isPracticeKgPracticeAddress(input.practiceDomains);
  const byAddress = contactsByAddress(input.contacts);
  const correspondents = A.map(
    A.fromIterable(MutableHashMap.values(tallyMessages(input))),
    ({ address, familyKey, tally }) => {
      const contact = pipe(MutableHashMap.get(byAddress, address), O.flatMap(soleContactOf));
      return PracticeKgCorrespondentRow.make({
        address,
        ccCount: HashSet.size(tally.cc),
        contactId: O.getOrNull(O.map(contact, ({ contact: owner }) => owner.contactId)),
        displayName: pipe(
          O.map(contact, ({ contact: owner }) => owner.displayName),
          O.orElse(() => tally.headerName),
          O.getOrNull
        ),
        epistemicStatus: "mention-derived",
        familyKey,
        firstAt: O.getOrNull(tally.firstAt),
        fromCount: HashSet.size(tally.from),
        isPracticeAddress: isPractice(address),
        lastAt: O.getOrNull(tally.lastAt),
        messageCount: HashSet.size(tally.messages),
        roleAddress: O.exists(contact, ({ role }) => role),
        toCount: HashSet.size(tally.to),
      });
    }
  );
  const links = A.flatMap(input.contacts, (contact) =>
    A.map(contact.links, (link) => PracticeKgContactClientLinkRow.make({ ...link, contactId: contact.contactId }))
  );
  const addresses = A.flatMap(A.fromIterable(byAddress), ([address, owners]) =>
    A.map(owners, ({ contact, role }) =>
      PracticeKgContactAddressRow.make({
        address,
        contactId: contact.contactId,
        displayName: contact.displayName,
        isPracticeAddress: isPractice(address),
        organization: contact.organization,
        roleAddress: role,
      })
    )
  );
  return PracticeKgCorrespondentTables.make({
    addresses: A.sort(
      addresses,
      Order.mapInput(Order.String, (row: PracticeKgContactAddressRow) => `${row.address}\u0000${row.contactId}`)
    ),
    correspondents: A.sort(
      correspondents,
      Order.mapInput(Order.String, (row: PracticeKgCorrespondentRow) => tallyKey(row.familyKey, row.address))
    ),
    links: A.sort(
      links,
      Order.mapInput(
        Order.String,
        (row: PracticeKgContactClientLinkRow) =>
          `${row.contactId}\u0000${row.clientNumber}\u0000${row.familyKey ?? ""}\u0000${row.source}\u0000${row.evidence}`
      )
    ),
  });
};

const createCorrespondentTables = [
  `CREATE TABLE matter_correspondents (
  family_key VARCHAR NOT NULL,
  address VARCHAR NOT NULL,
  contact_id VARCHAR,
  display_name VARCHAR,
  role_address BOOLEAN NOT NULL,
  is_practice_address BOOLEAN NOT NULL,
  message_count BIGINT NOT NULL,
  from_count BIGINT NOT NULL,
  to_count BIGINT NOT NULL,
  cc_count BIGINT NOT NULL,
  first_at VARCHAR,
  last_at VARCHAR,
  epistemic_status VARCHAR NOT NULL,
  PRIMARY KEY (family_key, address)
)`,
  `CREATE TABLE contact_client_links (
  contact_id VARCHAR NOT NULL,
  client_number VARCHAR NOT NULL,
  family_key VARCHAR,
  source VARCHAR NOT NULL,
  evidence VARCHAR NOT NULL
)`,
  `CREATE TABLE contact_addresses (
  address VARCHAR NOT NULL,
  contact_id VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  organization VARCHAR,
  role_address BOOLEAN NOT NULL,
  is_practice_address BOOLEAN NOT NULL,
  PRIMARY KEY (address, contact_id)
)`,
];

const insertCorrespondent =
  "INSERT INTO matter_correspondents VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)";
const insertLink = "INSERT INTO contact_client_links VALUES ($1, $2, $3, $4, $5)";
const insertAddress = "INSERT INTO contact_addresses VALUES ($1, $2, $3, $4, $5, $6)";

/**
 * Write the three correspondent tables into a bundle DuckDB.
 *
 * **Details**
 *
 * The tables are always created, empty when there were no email documents
 * and no contacts, so every store format 4 bundle has the same shape.
 *
 * **Example** (Write empty tables)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PracticeKgCorrespondentTables, writePracticeKgCorrespondentTables } from "@beep/law-practice-server"
 *
 * const write = writePracticeKgCorrespondentTables("/bundle/practice.duckdb")(
 *   PracticeKgCorrespondentTables.make({ addresses: [], correspondents: [], links: [] })
 * )
 * console.log(Effect.isEffect(write)) // true
 * ```
 *
 * @param databasePath - Bundle DuckDB written earlier in the same build.
 * @returns A function from the tables to the write effect.
 * @effects Creates and fills three tables in the bundle DuckDB.
 * @category use-cases
 * @since 0.0.0
 */
export const writePracticeKgCorrespondentTables = (databasePath: string) =>
  Effect.fn("PracticeKg.writeCorrespondentTables")(function* (tables: PracticeKgCorrespondentTables) {
    return yield* Effect.gen(function* () {
      const db = yield* DuckDb;
      yield* Effect.forEach(createCorrespondentTables, (statement) => db.run(statement), { discard: true });
      yield* Effect.forEach(
        tables.correspondents,
        (row) =>
          db.run(insertCorrespondent, [
            row.familyKey,
            row.address,
            row.contactId,
            row.displayName,
            row.roleAddress,
            row.isPracticeAddress,
            row.messageCount,
            row.fromCount,
            row.toCount,
            row.ccCount,
            row.firstAt,
            row.lastAt,
            row.epistemicStatus,
          ]),
        { discard: true }
      );
      yield* Effect.forEach(
        tables.links,
        (row) => db.run(insertLink, [row.contactId, row.clientNumber, row.familyKey, row.source, row.evidence]),
        { discard: true }
      );
      yield* Effect.forEach(
        tables.addresses,
        (row) =>
          db.run(insertAddress, [
            row.address,
            row.contactId,
            row.displayName,
            row.organization,
            row.roleAddress,
            row.isPracticeAddress,
          ]),
        { discard: true }
      );
    }).pipe(
      withDuckDb(DuckDbConnectionOptions.make({ databasePath })),
      PracticeKgProjectionError.mapError(`Failed writing correspondent tables to "${databasePath}".`)
    );
  });

const contactsSql = `
SELECT contact_id AS "contactId", display_name AS "displayName", organization, role_address AS "roleAddress"
FROM contact_addresses WHERE address = $1 ORDER BY contact_id`;

const linksSql = `
SELECT l.contact_id AS "contactId", l.client_number AS "clientNumber", l.family_key AS "familyKey", l.source, l.evidence
FROM contact_client_links l
WHERE l.contact_id IN (SELECT contact_id FROM contact_addresses WHERE address = $1)
ORDER BY l.contact_id, l.family_key NULLS LAST, l.client_number, l.source, l.evidence`;

const candidatesSql = `
SELECT c.family_key AS "familyKey", m.client, m.client_name AS "clientName",
  CAST(c.message_count AS DOUBLE) AS "messageCount", CAST(c.from_count AS DOUBLE) AS "fromCount",
  CAST(c.to_count AS DOUBLE) AS "toCount", CAST(c.cc_count AS DOUBLE) AS "ccCount",
  c.first_at AS "firstAt", c.last_at AS "lastAt"
FROM matter_correspondents c LEFT JOIN matters m USING (family_key)
WHERE c.address = $1
ORDER BY c.message_count DESC, c.last_at DESC NULLS LAST, c.family_key`;

const practiceAddressSql = `
SELECT EXISTS (SELECT 1 FROM matter_correspondents WHERE address = $1 AND is_practice_address)
  OR EXISTS (SELECT 1 FROM contact_addresses WHERE address = $1 AND is_practice_address) AS "practiceAddress"`;

// Family keys the address's contacts link to that are matters of this bundle.
const linkedMattersSql = `
SELECT DISTINCT m.family_key AS "familyKey"
FROM contact_client_links l JOIN matters m ON m.family_key = l.family_key
WHERE l.contact_id IN (SELECT contact_id FROM contact_addresses WHERE address = $1)
ORDER BY 1`;

const decodeFamilyKeys = S.decodeUnknownEffect(S.Array(S.Struct({ familyKey: S.NonEmptyString })));
const decodeContacts = S.decodeUnknownEffect(S.Array(PracticeKgCorrespondentContact));
const decodeLinks = S.decodeUnknownEffect(S.Array(PracticeKgCorrespondentLink));
const decodeCandidates = S.decodeUnknownEffect(S.Array(PracticeKgCorrespondentCandidate));
const decodePracticeAddress = S.decodeUnknownEffect(S.NonEmptyArray(S.Struct({ practiceAddress: S.Boolean })));

/**
 * Read the one email address a correspondent lookup input holds.
 *
 * **Details**
 *
 * The input may be a bare address or one header entry
 * (`Pat Example <pat@example.com>`), read with the same parser the build uses
 * for From, To, and Cc headers. The address comes back lower-cased. Input
 * holding no address, or several (a whole header), fails with
 * `PracticeKgCorrespondentAddressError`.
 *
 * **Example** (Read a header entry)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { parsePracticeKgCorrespondentAddress } from "@beep/law-practice-server"
 *
 * Effect.runPromise(parsePracticeKgCorrespondentAddress("Pat Example <Pat@Example.com>")).then(console.log)
 * // "pat@example.com"
 * ```
 *
 * @param input - A bare address or one header entry.
 * @returns The lower-cased address.
 * @category parsers
 * @since 0.0.0
 */
export const parsePracticeKgCorrespondentAddress = (
  input: string
): Effect.Effect<string, PracticeKgCorrespondentAddressError> => {
  const addresses = A.dedupe(A.map(participantsOf(input, "to"), (participant) => participant.address));
  return pipe(
    A.head(addresses),
    O.filter(() => A.length(addresses) === 1),
    Effect.fromOption,
    Effect.mapError(() =>
      PracticeKgCorrespondentAddressError.make({
        addressCount: A.length(addresses),
        message: `Expected one email address; the input holds ${A.length(addresses)}.`,
      })
    )
  );
};

/**
 * Resolve one email address to the matters it corresponds about, against the
 * ambient bundle DuckDB.
 *
 * **Details**
 *
 * The address may be given bare or as one header entry; see
 * {@link parsePracticeKgCorrespondentAddress}. Reads the contacts that own the
 * address and their links, the matters the
 * address appears on in filed email (ranked by message count, then most
 * recent message), and whether it is a practice address. The resolution is
 * decided by `resolvePracticeKgCorrespondent`: `unique` only from the
 * attorney's own links, never from message counts.
 *
 * **Example** (Look up an address)
 *
 * ```ts
 * import { PracticeKgCorrespondentLookupRequest } from "@beep/law-practice-use-cases/server"
 * import { Effect } from "effect"
 * import { lookupPracticeKgCorrespondents } from "@beep/law-practice-server"
 *
 * const lookup = lookupPracticeKgCorrespondents(PracticeKgCorrespondentLookupRequest.make({ address: "pat@example.com" }))
 * console.log(Effect.isEffect(lookup)) // true
 * ```
 *
 * @param request - The address to resolve.
 * @returns Contacts, links, candidate matters, and the resolution.
 * @category use-cases
 * @since 0.0.0
 */
export const lookupPracticeKgCorrespondents = Effect.fn("PracticeKg.lookupCorrespondents")(function* (
  request: PracticeKgCorrespondentLookupRequest
): Effect.fn.Return<
  PracticeKgCorrespondentLookupResult,
  PracticeKgCorrespondentAddressError | PracticeKgMatterLookupError,
  DuckDb | PracticeKgBundle
> {
  const db = yield* DuckDb;
  const bundle = yield* PracticeKgBundle;
  const address = yield* parsePracticeKgCorrespondentAddress(request.address);
  const read = <Row>(statement: string, decode: (rows: unknown) => Effect.Effect<Row, S.SchemaError>) =>
    db.query(statement, [address]).pipe(
      Effect.flatMap(decode),
      Effect.mapError((cause) =>
        PracticeKgMatterLookupError.make({
          cause,
          message: "Practice KG correspondent lookup could not read the correspondent tables.",
        })
      )
    );
  const evidence = PracticeKgCorrespondentEvidence.make({
    candidates: yield* read(candidatesSql, decodeCandidates),
    contacts: yield* read(contactsSql, decodeContacts),
    links: yield* read(linksSql, decodeLinks),
    matterFamilyKeys: A.map(yield* read(linkedMattersSql, decodeFamilyKeys), (row) => row.familyKey),
    practiceAddress: A.headNonEmpty(yield* read(practiceAddressSql, decodePracticeAddress)).practiceAddress,
  });
  return PracticeKgCorrespondentLookupResult.make({
    ...evidence,
    ...resolvePracticeKgCorrespondent(evidence),
    address,
    bundleVersion: bundle.manifest.bundleVersion,
  });
});
