/**
 * The practice's contacts table as a knowledge-graph build input: row schema
 * and the JSONL reader.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { PracticeKgContactLinkSource } from "@beep/law-practice-use-cases/server";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readJsonlLines } from "./internal/Jsonl.ts";
import type * as FileSystem from "effect/FileSystem";

const $I = $LawPracticeServerId.create("PracticeKg.contacts");

/**
 * One email address of a contact.
 *
 * **Example** (Make a contact address)
 *
 * ```ts
 * import { PracticeKgContactEmail } from "@beep/law-practice-server"
 *
 * const email = PracticeKgContactEmail.make({ address: "pat@example.com", role: false })
 * console.log(email.role) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgContactEmail extends S.Class<PracticeKgContactEmail>($I`PracticeKgContactEmail`)(
  {
    address: S.NonEmptyString,
    role: S.Boolean.annotateKey({ description: "True for a shared role mailbox such as docketing@ or info@." }),
  },
  $I.annote("PracticeKgContactEmail", { description: "One email address of a contact and its role-mailbox flag." })
) {}

/**
 * One link from a contact to a client and, when known, a matter.
 *
 * **Details**
 *
 * `evidence` is a short opaque note from the contacts producer (for example
 * `"12 message(s)"`); the build stores it and never parses it.
 *
 * **Example** (Make a contact link)
 *
 * ```ts
 * import { PracticeKgContactLink } from "@beep/law-practice-server"
 *
 * const link = PracticeKgContactLink.make({
 *   clientNumber: "12345",
 *   evidence: "answered",
 *   familyKey: "12345.10008",
 *   source: "attorney-answer"
 * })
 * console.log(link.familyKey) // "12345.10008"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgContactLink extends S.Class<PracticeKgContactLink>($I`PracticeKgContactLink`)(
  {
    clientNumber: S.String.check(S.isPattern(/^[0-9]{5}$/u, { message: "Expected a five-digit client number" })),
    evidence: S.String,
    familyKey: S.NullOr(S.String),
    source: PracticeKgContactLinkSource,
  },
  $I.annote("PracticeKgContactLink", { description: "Contact link to a client number and an optional matter key." })
) {}

/**
 * Where a contact row was read from.
 *
 * **Example** (Decode a contact origin)
 *
 * ```ts
 * import { PracticeKgContactOrigin } from "@beep/law-practice-server"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(PracticeKgContactOrigin)("vcf")) // "vcf"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgContactOrigin = LiteralKit(["csv", "vcf"]).pipe(
  $I.annoteSchema("PracticeKgContactOrigin", { description: "File format a contact row was read from." })
);

/**
 * Runtime type of {@link PracticeKgContactOrigin}.
 *
 * **Example** (Type a contact origin)
 *
 * ```ts
 * import type { PracticeKgContactOrigin } from "@beep/law-practice-server"
 *
 * const origin: PracticeKgContactOrigin = "vcf"
 * console.log(origin) // "vcf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgContactOrigin = typeof PracticeKgContactOrigin.Type;

/**
 * One row of the contacts table the Box workstream produces.
 *
 * **Details**
 *
 * The table is client material: it is produced and kept outside the repo, and
 * the build reads it with `--contacts <file>`, one JSON object per line.
 *
 * **Example** (Decode a contact)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PracticeKgContact } from "@beep/law-practice-server"
 *
 * const contact = S.decodeUnknownSync(PracticeKgContact)({
 *   contactId: "c_0123456789ab",
 *   displayName: "Pat Example",
 *   emails: [{ address: "pat@example.com", role: false }],
 *   links: [],
 *   organization: "Example Client",
 *   sources: ["csv"]
 * })
 * console.log(contact.emails.length) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgContact extends S.Class<PracticeKgContact>($I`PracticeKgContact`)(
  {
    contactId: S.String.check(S.isPattern(/^c_[0-9a-f]{12}$/u, { message: "Expected c_ and twelve hex digits" })),
    displayName: S.String,
    emails: S.Array(PracticeKgContactEmail),
    links: S.Array(PracticeKgContactLink),
    organization: S.NullOr(S.String),
    sources: S.Array(PracticeKgContactOrigin),
  },
  $I.annote("PracticeKgContact", {
    description: "Contact with its email addresses and its links to clients and matters.",
  })
) {}

/**
 * Failure reading the contacts file.
 *
 * **Details**
 *
 * `lineNumber` is the one-based line that failed and is absent when the file
 * could not be read. `unknownSource` names a link source the build does not
 * know, so a value a newer producer adds is refused instead of being trusted.
 * The message never quotes the line itself: contacts are client material.
 *
 * **Example** (Make a contacts error)
 *
 * ```ts
 * import { PracticeKgContactsError } from "@beep/law-practice-server"
 *
 * const error = PracticeKgContactsError.make({
 *   lineNumber: 4,
 *   message: 'Contacts "/corpus/contacts.jsonl" line 4 has unknown link source "phone-book".',
 *   path: "/corpus/contacts.jsonl",
 *   unknownSource: "phone-book"
 * })
 * console.log(error._tag) // "PracticeKgContactsError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgContactsError extends S.TaggedError<PracticeKgContactsError>($I`PracticeKgContactsError`)(
  "PracticeKgContactsError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    lineNumber: S.optionalKey(S.Finite),
    message: S.NonEmptyString,
    path: S.String,
    unknownSource: S.optionalKey(S.String),
  },
  $I.annoteError<PracticeKgContactsError>("PracticeKgContactsError", {
    description: "Failure while reading or decoding the contacts JSONL file.",
  })
) {}

const decodeContactLine = S.decodeUnknownEffect(S.fromJsonString(PracticeKgContact));
const decodeLinkSources = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ links: S.Array(S.Struct({ source: S.String })) }))
);
const isLinkSource = S.is(PracticeKgContactLinkSource);

const unknownSourceOf = (content: string): Effect.Effect<O.Option<string>> =>
  decodeLinkSources(content).pipe(
    Effect.map(({ links }) =>
      pipe(
        A.findFirst(links, ({ source }) => !isLinkSource(source)),
        O.map(({ source }) => source)
      )
    ),
    Effect.orElseSucceed(O.none<string>)
  );

const lineFailure = (path: string, lineNumber: number, cause: unknown) => (unknownSource: O.Option<string>) =>
  O.match(unknownSource, {
    onNone: () =>
      PracticeKgContactsError.make({
        cause,
        lineNumber,
        message: `Contacts "${path}" line ${lineNumber} is not a valid contact row.`,
        path,
      }),
    onSome: (source) =>
      PracticeKgContactsError.make({
        cause,
        lineNumber,
        message: `Contacts "${path}" line ${lineNumber} has unknown link source "${source}".`,
        path,
        unknownSource: source,
      }),
  });

/**
 * Read the contacts JSONL file.
 *
 * **Details**
 *
 * Blank lines are skipped. Every other line must decode as a
 * {@link PracticeKgContact}; the first that does not fails the read with its
 * line number, and with the offending value when the failure is an unknown
 * link source. Rows come back in file order.
 *
 * **Example** (Read a contacts file)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { readPracticeKgContacts } from "@beep/law-practice-server"
 *
 * const contacts = readPracticeKgContacts("/corpus/incoming/contacts.jsonl")
 * console.log(Effect.isEffect(contacts)) // true
 * ```
 *
 * @param path - JSONL file with one contact per line.
 * @returns Decoded contacts in file order.
 * @effects Reads the file through the ambient filesystem.
 * @category use-cases
 * @since 0.0.0
 */
export const readPracticeKgContacts = Effect.fn("PracticeKg.readContacts")(function* (
  path: string
): Effect.fn.Return<ReadonlyArray<PracticeKgContact>, PracticeKgContactsError, FileSystem.FileSystem> {
  return yield* readJsonlLines(
    path,
    (cause) => PracticeKgContactsError.make({ cause, message: `Failed reading contacts "${path}".`, path }),
    (content, lineNumber) =>
      decodeContactLine(content).pipe(
        Effect.catch((cause) =>
          unknownSourceOf(content).pipe(Effect.map(lineFailure(path, lineNumber, cause)), Effect.flatMap(Effect.fail))
        )
      )
  );
});
