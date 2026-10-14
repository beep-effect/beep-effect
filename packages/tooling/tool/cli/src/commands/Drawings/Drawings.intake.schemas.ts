/**
 * Schemas of `beep drawings intake`: the request, the per-attachment outcome,
 * the message facts, and the `drawing-intake/v1` record written next to the
 * pulled files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { GraphPathSegment, OutlookItemRef } from "@beep/m365";
import { EmailString, LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Str from "effect/String";

const $I = $RepoCliId.create("commands/Drawings/Drawings.intake.schemas");

const PositiveInt = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("IntakePositiveInt", { description: "An integer greater than zero." })
);

/**
 * Largest attachment, in bytes, an intake downloads by default (Graph's
 * 150 MiB file-attachment ceiling).
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { DEFAULT_INTAKE_MAX_BYTES } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DEFAULT_INTAKE_MAX_BYTES) // 157286400
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_INTAKE_MAX_BYTES = 150 * 1024 * 1024;

/**
 * What happened to one attachment of the pulled message.
 *
 * **Details**
 *
 * `saved` wrote a new file; `unchanged` found the same bytes already under the
 * same name; `duplicate` found the same bytes under another name and wrote
 * nothing; the `skipped-*` outcomes downloaded nothing.
 *
 * **Example** (Check an outcome)
 *
 * ```ts
 * import { IntakeAttachmentOutcome } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(IntakeAttachmentOutcome.is.duplicate("duplicate")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IntakeAttachmentOutcome = LiteralKit([
  "saved",
  "unchanged",
  "duplicate",
  "skipped-inline",
  "skipped-item",
  "skipped-oversize",
]).pipe(
  $I.annoteSchema("IntakeAttachmentOutcome", {
    description: "What a drawing intake did with one message attachment.",
  })
);

/**
 * Type for {@link IntakeAttachmentOutcome}.
 *
 * **Example** (Type an outcome)
 *
 * ```ts
 * import type { IntakeAttachmentOutcome } from "@beep/repo-cli/commands/Drawings"
 *
 * const outcome: IntakeAttachmentOutcome = "saved"
 * console.log(outcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IntakeAttachmentOutcome = typeof IntakeAttachmentOutcome.Type;

/**
 * Which message of a conversation to pull: the newest, or the n-th newest.
 *
 * **Example** (Pick the second newest)
 *
 * ```ts
 * import { IntakePickFromString } from "@beep/repo-cli/commands/Drawings"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(IntakePickFromString)("2")) // 2
 * console.log(S.decodeUnknownSync(IntakePickFromString)("latest")) // "latest"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IntakePick = S.Union([S.Literal("latest"), PositiveInt]).pipe(
  $I.annoteSchema("IntakePick", {
    description: "`latest`, or a one-based position counted from the newest message of a conversation.",
  })
);

/**
 * Type for {@link IntakePick}.
 *
 * **Example** (Type a pick)
 *
 * ```ts
 * import type { IntakePick } from "@beep/repo-cli/commands/Drawings"
 *
 * const pick: IntakePick = "latest"
 * console.log(pick)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IntakePick = typeof IntakePick.Type;

const decodePick = (text: string): Effect.Effect<IntakePick, SchemaIssue.Issue> => {
  const trimmed = Str.trim(text);
  return trimmed === "latest"
    ? Effect.succeed("latest")
    : /^[1-9]\d*$/.test(trimmed)
      ? Effect.succeed(Number(trimmed))
      : Effect.fail(new SchemaIssue.InvalidValue({ message: "Expected `latest` or a positive whole number." }));
};

/**
 * Codec from the `--pick` flag text to an {@link IntakePick}.
 *
 * **Example** (Decode the default)
 *
 * ```ts
 * import { IntakePickFromString } from "@beep/repo-cli/commands/Drawings"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(IntakePickFromString)(" latest ")) // "latest"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IntakePickFromString = S.String.pipe(
  S.decodeTo(IntakePick, {
    decode: SchemaGetter.transformEffect(decodePick),
    encode: SchemaGetter.transform(String),
  }),
  $I.annoteSchema("IntakePickFromString", { description: "Codec from `--pick` text to an intake pick." })
);

/**
 * Type for {@link IntakePickFromString}.
 *
 * **Example** (Annotate a decoded pick)
 *
 * ```ts
 * import type { IntakePickFromString } from "@beep/repo-cli/commands/Drawings"
 *
 * const value: IntakePickFromString | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IntakePickFromString = typeof IntakePickFromString.Type;

/**
 * Request to pull one message's attachments into a directory under the corpus root.
 *
 * **Example** (Pull the newest message of a conversation)
 *
 * ```ts
 * import { OutlookItemRef } from "@beep/m365"
 * import { IntakeRequest } from "@beep/repo-cli/commands/Drawings"
 *
 * const request = IntakeRequest.make({
 *   ref: OutlookItemRef.cases.conversation.make({ id: "AAQkAGI2" }),
 *   mailbox: "mailbox@example.test",
 *   outDir: "/corpus/matter/inputs/round-2",
 *   corpusRoot: "/corpus"
 * })
 * console.log(request.pick) // "latest"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeRequest extends S.Class<IntakeRequest>($I`IntakeRequest`)(
  {
    ref: OutlookItemRef.annotateKey({ description: "Message or conversation named by the pasted link or id." }),
    mailbox: GraphPathSegment.annotateKey({ description: "Mailbox (address or user id) the item lives in." }),
    outDir: S.NonEmptyString.annotateKey({ description: "Directory the attachments go to; under `corpusRoot`." }),
    corpusRoot: S.NonEmptyString.annotateKey({ description: "Corpus root every written path must lie under." }),
    pick: IntakePick.pipe(S.withConstructorDefault(Effect.succeed("latest" as const))).annotateKey({
      description: "Which message of a conversation to pull; ignored for a message id.",
    }),
    maxBytes: PositiveInt.pipe(S.withConstructorDefault(Effect.succeed(DEFAULT_INTAKE_MAX_BYTES))).annotateKey({
      description: "Largest attachment to download; larger ones are skipped.",
    }),
    includeOwn: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))).annotateKey({
      description: "Let --pick choose the mailbox's own messages of a conversation; drafts are never chosen.",
    }),
  },
  $I.annote("IntakeRequest", {
    description: "Request to pull one message's file attachments into a directory under the corpus root.",
  })
) {}

/**
 * One attachment of the pulled message and what the intake did with it.
 *
 * **Example** (A saved attachment)
 *
 * ```ts
 * import { IntakeAttachment } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const row = IntakeAttachment.make({
 *   attachmentId: "AAMkAtt1",
 *   name: "Fig1.pdf",
 *   savedAs: O.some("Fig1.pdf"),
 *   contentType: O.some("application/pdf"),
 *   bytes: 4,
 *   sha256: O.none(),
 *   outcome: "saved",
 *   duplicateOf: O.none()
 * })
 * console.log(row.outcome) // "saved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeAttachment extends S.Class<IntakeAttachment>($I`IntakeAttachment`)(
  {
    attachmentId: S.String.annotateKey({ description: "Graph attachment id." }),
    name: S.String.annotateKey({ description: "Attachment name as the message carries it." }),
    savedAs: S.OptionFromNullOr(S.String).annotateKey({
      description: "File name under the intake directory that holds these bytes; null when nothing holds them.",
    }),
    contentType: S.OptionFromNullOr(S.String).annotateKey({ description: "MIME type the message declares." }),
    bytes: S.Natural.annotateKey({ description: "Size in bytes (downloaded size, or the declared size if skipped)." }),
    sha256: S.OptionFromNullOr(Sha256Hex).annotateKey({
      description: "SHA-256 of the downloaded bytes; null when the attachment was skipped.",
    }),
    outcome: IntakeAttachmentOutcome.annotateKey({ description: "What the intake did with the attachment." }),
    duplicateOf: S.OptionFromNullOr(S.String).annotateKey({
      description: "Existing file with the same bytes, for a `duplicate`.",
    }),
  },
  $I.annote("IntakeAttachment", { description: "One message attachment and what a drawing intake did with it." })
) {}

/**
 * Provenance facts of the pulled message.
 *
 * **Details**
 *
 * Every field Graph may leave out is optional and written as `null`, so a
 * message with an Exchange X500 sender address, or with no internet message
 * id, still has its attachments pulled. `from` keeps the address as Graph
 * reports it; `fromEmail` holds it normalised when it is an SMTP address.
 *
 * **Example** (Message facts)
 *
 * ```ts
 * import { EmailString } from "@beep/schema"
 * import { MessageFacts } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const facts = MessageFacts.make({
 *   messageId: "AAMkAGI2",
 *   internetMessageId: O.some("<id@mail.example.test>"),
 *   conversationId: O.some("AAQkAGI2"),
 *   from: O.some("Sender@example.test"),
 *   fromEmail: O.some(EmailString.make("sender@example.test")),
 *   receivedAt: O.some("2026-10-10T12:00:00Z"),
 *   subject: "Sheets"
 * })
 * console.log(facts.fromEmail)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MessageFacts extends S.Class<MessageFacts>($I`MessageFacts`)(
  {
    messageId: S.String.annotateKey({ description: "Graph message id." }),
    internetMessageId: S.OptionFromNullOr(S.String).annotateKey({ description: "RFC 5322 Message-ID, if reported." }),
    conversationId: S.OptionFromNullOr(S.String).annotateKey({ description: "Graph conversation id, if reported." }),
    from: S.OptionFromNullOr(S.String).annotateKey({
      description: "Sender address as Graph reports it (SMTP or Exchange X500): `from`, else `sender`.",
    }),
    fromEmail: S.OptionFromNullOr(EmailString).annotateKey({
      description: "The sender address normalised, when it is an SMTP address.",
    }),
    receivedAt: S.OptionFromNullOr(S.String).annotateKey({
      description: "Receipt timestamp as Graph reports it, if reported.",
    }),
    subject: S.String.annotateKey({ description: "Subject line; empty when the message has none." }),
  },
  $I.annote("MessageFacts", { description: "Provenance facts of the message a drawing intake pulled." })
) {}

/**
 * The `drawing-intake/v1` record written next to the pulled files.
 *
 * **Example** (An empty record)
 *
 * ```ts
 * import { EmailString } from "@beep/schema"
 * import { IntakeRecord, MessageFacts } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const record = IntakeRecord.make({
 *   schemaVersion: "drawing-intake/v1",
 *   mailbox: "mailbox@example.test",
 *   message: MessageFacts.make({
 *     messageId: "AAMkAGI2",
 *     internetMessageId: O.some("<id@mail.example.test>"),
 *     conversationId: O.none(),
 *     from: O.some("Sender@example.test"),
 *     fromEmail: O.some(EmailString.make("sender@example.test")),
 *     receivedAt: O.some("2026-10-10T12:00:00Z"),
 *     subject: ""
 *   }),
 *   outDir: "/corpus/matter/inputs/round-2",
 *   attachments: [],
 *   pulledAt: "2026-10-13T00:00:00.000Z"
 * })
 * console.log(record.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeRecord extends S.Class<IntakeRecord>($I`IntakeRecord`)(
  {
    schemaVersion: S.Literal("drawing-intake/v1").annotateKey({ description: "Record schema version." }),
    mailbox: S.String.annotateKey({ description: "Mailbox the message was read from." }),
    message: MessageFacts.annotateKey({ description: "Provenance facts of the pulled message." }),
    outDir: S.String.annotateKey({ description: "Absolute intake directory." }),
    attachments: S.Array(IntakeAttachment).annotateKey({ description: "Every attachment, in message order." }),
    pulledAt: S.String.annotateKey({ description: "When the intake ran (ISO-8601 UTC)." }),
  },
  $I.annote("IntakeRecord", {
    description: "Provenance record of one drawing intake: the message, and the hash and outcome of each attachment.",
  })
) {}

/**
 * What `DrawingIntake.pull` returns: the record and the file it was written to.
 *
 * **Example** (A result)
 *
 * ```ts
 * import { EmailString } from "@beep/schema"
 * import { IntakeRecord, IntakeResult, MessageFacts } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const result = IntakeResult.make({
 *   record: IntakeRecord.make({
 *     schemaVersion: "drawing-intake/v1",
 *     mailbox: "mailbox@example.test",
 *     message: MessageFacts.make({
 *       messageId: "AAMkAGI2",
 *       internetMessageId: O.some("<id@mail.example.test>"),
 *       conversationId: O.none(),
 *       from: O.some("Sender@example.test"),
 *       fromEmail: O.some(EmailString.make("sender@example.test")),
 *       receivedAt: O.some("2026-10-10T12:00:00Z"),
 *       subject: ""
 *     }),
 *     outDir: "/corpus/in",
 *     attachments: [],
 *     pulledAt: "2026-10-13T00:00:00.000Z"
 *   }),
 *   recordPath: "/corpus/in/intake.json",
 *   conversationSize: O.none()
 * })
 * console.log(result.setAside) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeResult extends S.Class<IntakeResult>($I`IntakeResult`)(
  {
    record: IntakeRecord.annotateKey({ description: "The record that was written." }),
    recordPath: S.String.annotateKey({ description: "Absolute path of the record file." }),
    conversationSize: S.Option(S.Natural).annotateKey({
      description: "Conversation messages --pick chose among when the item resolved as one; none for a message id.",
    }),
    setAside: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(0))).annotateKey({
      description: "Conversation messages --pick never considered: drafts, and the mailbox's own mail unless included.",
    }),
  },
  $I.annote("IntakeResult", { description: "The intake record and where it was written." })
) {}
