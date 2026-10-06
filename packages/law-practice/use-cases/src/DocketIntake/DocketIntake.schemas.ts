/**
 * Schema models of the docket intake pipeline: what a mailbox message looks
 * like to the pipeline, what each of the two agents returns, what a matter
 * lookup answers, and the typed outcome every processed message ends in.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { DocketCategory, DocketDueDate, DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
import { LiteralKit } from "@beep/schema";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketIntake.schemas");

const opt = <Sch extends S.Top>(schema: Sch, description: string) =>
  schema.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }));

const emptyStrings: ReadonlyArray<string> = [];

const stringList = (description: string) =>
  S.Array(S.String)
    .pipe(
      S.withConstructorDefault(Effect.succeed(emptyStrings)),
      S.withDecodingDefaultTypeKey(Effect.succeed(emptyStrings))
    )
    .annotateKey({ description });

/**
 * Reference to one attachment of a mailbox message (metadata only).
 *
 * **Example** (Make an attachment reference)
 *
 * ```ts
 * import { DocketAttachmentRef } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketAttachmentRef.make({ attachmentId: "attachment-1" }).attachmentId);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketAttachmentRef extends S.Class<DocketAttachmentRef>($I`DocketAttachmentRef`)(
  {
    attachmentId: S.NonEmptyString.annotateKey({ description: "Provider id of the attachment." }),
    contentType: opt(S.String, "MIME type reported by the mailbox."),
    name: opt(S.String, "File name reported by the mailbox."),
    sizeBytes: opt(S.Natural, "Size in bytes reported by the mailbox."),
  },
  $I.annote("DocketAttachmentRef", { description: "Metadata reference to one message attachment." })
) {}

/**
 * A mailbox message as the docket intake pipeline sees it.
 *
 * **Example** (Make a message)
 *
 * ```ts
 * import { DocketMessage } from "@beep/law-practice-use-cases/DocketIntake";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const message = DocketMessage.make({
 *   bodyText: "Fixture body.",
 *   messageId: "message-1",
 *   receivedAt: "2030-01-02T10:00:00Z",
 *   receivedDate: LocalDate.make({ year: 2030, month: 1, day: 2 })
 * });
 * console.log(message.messageId);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketMessage extends S.Class<DocketMessage>($I`DocketMessage`)(
  {
    attachments: S.Array(DocketAttachmentRef)
      .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([])))
      .annotateKey({ description: "Attachment references, without bytes." }),
    bodyText: S.String.annotateKey({ description: "Plain-text body (never logged)." }),
    internetMessageId: opt(S.NonEmptyString, "RFC 5322 message id; stable across folders."),
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
    receivedAt: S.NonEmptyString.annotateKey({ description: "UTC receipt timestamp in ISO-8601 form." }),
    receivedDate: LocalDateFromString.annotateKey({
      description: "Calendar day of receipt in the practice time zone.",
    }),
    sender: opt(S.String, "Sender address (never logged)."),
    subject: opt(S.String, "Subject line (never logged)."),
    webLink: opt(S.String, "Link that opens the message in Outlook."),
  },
  $I.annote("DocketMessage", { description: "A mailbox message as the docket intake pipeline sees it." })
) {}

/**
 * Bytes of a source document attached to a message, handed to the reviewer.
 *
 * **Example** (Make a source document)
 *
 * ```ts
 * import { DocketSourceDocument } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const document = DocketSourceDocument.make({ bytes: new Uint8Array([1]), contentType: "application/pdf" });
 * console.log(document.bytes.byteLength);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketSourceDocument extends S.Class<DocketSourceDocument>($I`DocketSourceDocument`)(
  {
    bytes: S.Uint8Array.annotateKey({ description: "Document bytes (never logged)." }),
    contentType: S.String.annotateKey({ description: "MIME type of the document." }),
    name: opt(S.String, "File name (never logged)."),
  },
  $I.annote("DocketSourceDocument", { description: "A source document attached to a message." })
) {}

/**
 * Agent 1 (paralegal role) found no deadline or required action in the message.
 *
 * **Example** (Make a not-a-docket-item entry)
 *
 * ```ts
 * import { ParalegalNotDocketItem } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ParalegalNotDocketItem.make({ rationale: "Newsletter." })._tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParalegalNotDocketItem extends S.TaggedClass<ParalegalNotDocketItem>($I`ParalegalNotDocketItem`)(
  "ParalegalNotDocketItem",
  {
    rationale: S.String.annotateKey({ description: "One sentence on why nothing needs docketing." }),
  },
  $I.annote("ParalegalNotDocketItem", { description: "Agent 1 found nothing to docket." })
) {}

/**
 * Agent 1 (paralegal role) entered the message as a docket item.
 *
 * **Details**
 *
 * Every date field is optional and is filled only with what the message
 * itself says. `statedDueDate` is a due date the message states outright;
 * `mailDate` and `responsePeriod` are the trigger date and period it states.
 *
 * **Example** (Make a docket entry)
 *
 * ```ts
 * import { ParalegalDocketEntry } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const entry = ParalegalDocketEntry.make({ rationale: "States a response period.", title: "Response due" });
 * console.log(entry.title);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParalegalDocketEntry extends S.TaggedClass<ParalegalDocketEntry>($I`ParalegalDocketEntry`)(
  "ParalegalDocketEntry",
  {
    mailDate: opt(LocalDateFromString, "Trigger (mailing or notification) date the message states."),
    matterReferences: stringList("Docket, application, patent or matter numbers the message mentions, verbatim."),
    rationale: S.String.annotateKey({ description: "One sentence on why this is a docket item." }),
    responsePeriod: opt(DocketResponsePeriod, "Response period the message states."),
    statedDueDate: opt(LocalDateFromString, "Due date the message states outright."),
    title: S.NonEmptyString.annotateKey({ description: "Short calendar title for the item." }),
  },
  $I.annote("ParalegalDocketEntry", { description: "Agent 1 entered the message as a docket item." })
) {}

/**
 * What agent 1 (paralegal role) returns for one message.
 *
 * **Example** (Read the entry tag)
 *
 * ```ts
 * import type { ParalegalEntry } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const tag = (entry: ParalegalEntry) => entry._tag;
 * console.log(tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ParalegalEntry = S.Union([ParalegalNotDocketItem, ParalegalDocketEntry]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ParalegalEntry", { description: "Agent 1 result for one message." })
);

/**
 * Type for {@link ParalegalEntry}.
 *
 * **Example** (Type an entry)
 *
 * ```ts
 * import type { ParalegalEntry } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const isEntry = (entry: ParalegalEntry) => entry._tag === "ParalegalDocketEntry";
 * console.log(isEntry);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ParalegalEntry = typeof ParalegalEntry.Type;

/**
 * What agent 2 (secretary role) returns after reviewing agent 1's entry
 * against the message and its source documents.
 *
 * **Details**
 *
 * The reviewer does not return a due date. It returns the mail date and the
 * response period it read for itself, and the pipeline does the arithmetic.
 * `readFromSourceDocument` says whether those came from an attached document
 * rather than from the message text.
 *
 * **Example** (Make a review)
 *
 * ```ts
 * import { SecretaryReview } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const review = SecretaryReview.make({ isDocketItem: true, notes: "Read from the attached action." });
 * console.log(review.isDocketItem);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecretaryReview extends S.Class<SecretaryReview>($I`SecretaryReview`)(
  {
    isDocketItem: S.Boolean.annotateKey({ description: "Whether the reviewer finds a deadline or required action." }),
    mailDate: opt(LocalDateFromString, "Trigger date the reviewer read for itself."),
    matterReferences: stringList("Matter references the reviewer read for itself, verbatim."),
    notes: S.String.annotateKey({ description: "One or two sentences on what the reviewer checked." }),
    readFromSourceDocument: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ).annotateKey({ description: "Whether the date and period came from an attached document." }),
    responsePeriod: opt(DocketResponsePeriod, "Response period the reviewer read for itself."),
  },
  $I.annote("SecretaryReview", { description: "Agent 2 review of one entry." })
) {}

/**
 * The practice KG resolved a reference to exactly one matter.
 *
 * **Example** (Make a unique match)
 *
 * ```ts
 * import { MatterUnique } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(MatterUnique.make({ familyKey: "0000.0001", verified: true }).familyKey);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterUnique extends S.TaggedClass<MatterUnique>($I`MatterUnique`)(
  "MatterUnique",
  {
    applications: stringList("Application numbers of the matter."),
    client: opt(S.String, "Client number, when the matter is attributed."),
    dockets: stringList("Docket numbers of the matter."),
    familyKey: S.NonEmptyString.annotateKey({ description: "Client-keyed family key of the matter." }),
    patents: stringList("Patent numbers of the matter."),
    verified: S.Boolean.annotateKey({
      description: "False when the match is unattributed or its family number is recycled and unverified.",
    }),
  },
  $I.annote("MatterUnique", { description: "A reference resolved to exactly one matter." })
) {}

/**
 * The practice KG resolved a reference to more than one matter.
 *
 * **Example** (Make an ambiguous match)
 *
 * ```ts
 * import { MatterAmbiguous } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(MatterAmbiguous.make({ familyKeys: ["0000.0001", "0001.0001"] }).familyKeys.length);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterAmbiguous extends S.TaggedClass<MatterAmbiguous>($I`MatterAmbiguous`)(
  "MatterAmbiguous",
  {
    familyKeys: stringList("Family keys of the candidate matters."),
  },
  $I.annote("MatterAmbiguous", { description: "A reference resolved to several matters." })
) {}

/**
 * The practice KG found no matter for any reference (or there was none to
 * look up).
 *
 * **Example** (Make a not-found result)
 *
 * ```ts
 * import { MatterNotFound } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(MatterNotFound.make({})._tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterNotFound extends S.TaggedClass<MatterNotFound>($I`MatterNotFound`)(
  "MatterNotFound",
  {},
  $I.annote("MatterNotFound", { description: "No matter was found." })
) {}

/**
 * Answer of a practice-KG matter lookup.
 *
 * **Example** (Read the lookup tag)
 *
 * ```ts
 * import type { MatterLookupResult } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const tag = (result: MatterLookupResult) => result._tag;
 * console.log(tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MatterLookupResult = S.Union([MatterUnique, MatterAmbiguous, MatterNotFound]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MatterLookupResult", { description: "Answer of a practice-KG matter lookup." })
);

/**
 * Type for {@link MatterLookupResult}.
 *
 * **Example** (Type a lookup result)
 *
 * ```ts
 * import type { MatterLookupResult } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const isUnique = (result: MatterLookupResult) => result._tag === "MatterUnique";
 * console.log(isUnique);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MatterLookupResult = typeof MatterLookupResult.Type;

/**
 * Things the attorney should look at on a tentative entry.
 *
 * **Example** (Guard a flag)
 *
 * ```ts
 * import { DocketEntryFlag } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketEntryFlag.is["dates-differ"]("dates-differ")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketEntryFlag = LiteralKit([
  "dates-differ",
  "matter-ambiguous",
  "matter-not-found",
  "matter-unverified",
  "matter-lookup-failed",
  "ladder-truncated",
  "source-document-missing",
  "due-date-past",
]).pipe($I.annoteSchema("DocketEntryFlag", { description: "A reason the attorney should check a tentative entry." }));

/**
 * Type for {@link DocketEntryFlag}.
 *
 * **Example** (Type a flag)
 *
 * ```ts
 * import type { DocketEntryFlag } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const flag: DocketEntryFlag = "dates-differ";
 * console.log(flag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketEntryFlag = typeof DocketEntryFlag.Type;

/**
 * Kinds of calendar entry the pipeline writes.
 *
 * **Example** (Guard an entry kind)
 *
 * ```ts
 * import { DocketEntryKind } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketEntryKind.is.due("due")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketEntryKind = LiteralKit(["due", "reminder", "needs-review", "digest"]).pipe(
  $I.annoteSchema("DocketEntryKind", { description: "Kind of calendar entry the docket intake pipeline writes." })
);

/**
 * Type for {@link DocketEntryKind}.
 *
 * **Example** (Type an entry kind)
 *
 * ```ts
 * import type { DocketEntryKind } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const kind: DocketEntryKind = "due";
 * console.log(kind);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketEntryKind = typeof DocketEntryKind.Type;

/**
 * One all-day calendar entry the pipeline wants to exist.
 *
 * **Example** (Make a calendar entry)
 *
 * ```ts
 * import { DocketCalendarEntry } from "@beep/law-practice-use-cases/DocketIntake";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const entry = DocketCalendarEntry.make({
 *   bodyText: "Fixture body.",
 *   category: "Docket - unverified",
 *   date: LocalDate.make({ year: 2030, month: 4, day: 15 }),
 *   key: "docket:0123456789abcdef",
 *   kind: "due",
 *   subject: "[UNVERIFIED] Response due",
 *   tentative: true
 * });
 * console.log(entry.kind);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketCalendarEntry extends S.Class<DocketCalendarEntry>($I`DocketCalendarEntry`)(
  {
    bodyText: S.String.annotateKey({ description: "Plain-text body of the entry (never logged)." }),
    category: DocketCategory.annotateKey({ description: "The one docket category the entry carries." }),
    date: LocalDateFromString.annotateKey({ description: "The day the all-day entry falls on." }),
    key: S.NonEmptyString.annotateKey({ description: "Idempotency key stored on the entry." }),
    kind: DocketEntryKind.annotateKey({ description: "Kind of entry." }),
    subject: S.NonEmptyString.annotateKey({ description: "Subject of the entry (never logged)." }),
    tentative: S.Boolean.annotateKey({ description: "Shown as tentative when true, as free otherwise." }),
  },
  $I.annote("DocketCalendarEntry", { description: "One all-day calendar entry the pipeline wants to exist." })
) {}

/**
 * A calendar entry that exists in the mailbox.
 *
 * **Example** (Make a written entry)
 *
 * ```ts
 * import { DocketWrittenEntry } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketWrittenEntry.make({ eventId: "event-1" }).eventId);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketWrittenEntry extends S.Class<DocketWrittenEntry>($I`DocketWrittenEntry`)(
  {
    eventId: S.NonEmptyString.annotateKey({ description: "Provider id of the calendar event." }),
    webLink: opt(S.String, "Link that opens the event in Outlook."),
  },
  $I.annote("DocketWrittenEntry", { description: "A calendar entry that exists in the mailbox." })
) {}

/**
 * Why a docket item got a needs-review entry instead of a dated one.
 *
 * **Example** (Guard a reason)
 *
 * ```ts
 * import { DocketNeedsReviewReason } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketNeedsReviewReason.is["no-usable-date"]("no-usable-date")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketNeedsReviewReason = LiteralKit(["no-usable-date", "agents-disagree", "processing-failed"]).pipe(
  $I.annoteSchema("DocketNeedsReviewReason", { description: "Why a docket item needs the attorney's review." })
);

/**
 * Type for {@link DocketNeedsReviewReason}.
 *
 * **Example** (Type a reason)
 *
 * ```ts
 * import type { DocketNeedsReviewReason } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const reason: DocketNeedsReviewReason = "agents-disagree";
 * console.log(reason);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketNeedsReviewReason = typeof DocketNeedsReviewReason.Type;

/**
 * Pipeline stages a failure can be attributed to.
 *
 * **Example** (Guard a stage)
 *
 * ```ts
 * import { DocketIntakeStage } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketIntakeStage.is.review("review")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketIntakeStage = LiteralKit(["mailbox", "enter", "review", "lookup", "calendar", "store"]).pipe(
  $I.annoteSchema("DocketIntakeStage", { description: "Docket intake pipeline stage." })
);

/**
 * Type for {@link DocketIntakeStage}.
 *
 * **Example** (Type a stage)
 *
 * ```ts
 * import type { DocketIntakeStage } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const stage: DocketIntakeStage = "calendar";
 * console.log(stage);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketIntakeStage = typeof DocketIntakeStage.Type;

/**
 * Outcome: both agents agree the message needs no docket entry.
 *
 * **Example** (Make the outcome)
 *
 * ```ts
 * import { NotDocketItem } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(NotDocketItem.make({ messageId: "message-1" })._tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NotDocketItem extends S.TaggedClass<NotDocketItem>($I`NotDocketItem`)(
  "NotDocketItem",
  {
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
  },
  $I.annote("NotDocketItem", { description: "The message needs no docket entry." })
) {}

/**
 * Outcome: a dated tentative entry and its reminder ladder exist.
 *
 * **Example** (Read the outcome tag)
 *
 * ```ts
 * import type { DocketEntered } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const tag = (outcome: DocketEntered) => outcome._tag;
 * console.log(tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketEntered extends S.TaggedClass<DocketEntered>($I`DocketEntered`)(
  "DocketEntered",
  {
    dueDate: DocketDueDate.annotateKey({ description: "The date the entry is on, with both candidates." }),
    entry: DocketWrittenEntry.annotateKey({ description: "The due-date entry." }),
    flags: S.Array(DocketEntryFlag).annotateKey({ description: "Things the attorney should check." }),
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
    reminders: S.Array(DocketWrittenEntry).annotateKey({ description: "The reminder entries." }),
  },
  $I.annote("DocketEntered", { description: "A dated tentative docket entry exists." })
) {}

/**
 * Outcome: a docket item without a usable date, or one the agents disagree
 * on, has a needs-review entry.
 *
 * **Example** (Read the outcome tag)
 *
 * ```ts
 * import type { DocketNeedsReview } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const tag = (outcome: DocketNeedsReview) => outcome._tag;
 * console.log(tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketNeedsReview extends S.TaggedClass<DocketNeedsReview>($I`DocketNeedsReview`)(
  "DocketNeedsReview",
  {
    entry: DocketWrittenEntry.annotateKey({ description: "The needs-review entry." }),
    flags: S.Array(DocketEntryFlag).annotateKey({ description: "Things the attorney should check." }),
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
    reason: DocketNeedsReviewReason.annotateKey({ description: "Why no dated entry was written." }),
  },
  $I.annote("DocketNeedsReview", { description: "A docket item needs the attorney's review." })
) {}

/**
 * Outcome: a step failed. Nothing is assumed about the message; it is retried
 * on a later poll until the retry budget is spent.
 *
 * **Example** (Make the outcome)
 *
 * ```ts
 * import { IntakeFailed } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(IntakeFailed.make({ messageId: "message-1", stage: "review" }).stage);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeFailed extends S.TaggedClass<IntakeFailed>($I`IntakeFailed`)(
  "IntakeFailed",
  {
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
    stage: DocketIntakeStage.annotateKey({ description: "Stage that failed." }),
  },
  $I.annote("IntakeFailed", { description: "A pipeline step failed for the message." })
) {}

/**
 * The typed outcome every processed message ends in.
 *
 * **Example** (Read the outcome tag)
 *
 * ```ts
 * import type { DocketIntakeOutcome } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const tag = (outcome: DocketIntakeOutcome) => outcome._tag;
 * console.log(tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketIntakeOutcome = S.Union([NotDocketItem, DocketEntered, DocketNeedsReview, IntakeFailed]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DocketIntakeOutcome", { description: "Typed outcome of processing one message." })
);

/**
 * Type for {@link DocketIntakeOutcome}.
 *
 * **Example** (Type an outcome)
 *
 * ```ts
 * import type { DocketIntakeOutcome } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const failed = (outcome: DocketIntakeOutcome) => outcome._tag === "IntakeFailed";
 * console.log(failed);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketIntakeOutcome = typeof DocketIntakeOutcome.Type;

/**
 * Ledger record of one processed message: its latest outcome and how many
 * times it has been attempted. It holds ids, dates and flags only.
 *
 * **Example** (Make a ledger record)
 *
 * ```ts
 * import { DocketLedgerRecord, NotDocketItem } from "@beep/law-practice-use-cases/DocketIntake";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const record = DocketLedgerRecord.make({
 *   attempts: 1,
 *   outcome: NotDocketItem.make({ messageId: "message-1" }),
 *   processedOn: LocalDate.make({ year: 2030, month: 1, day: 2 }),
 *   receivedAt: "2030-01-02T10:00:00Z"
 * });
 * console.log(record.attempts);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketLedgerRecord extends S.Class<DocketLedgerRecord>($I`DocketLedgerRecord`)(
  {
    attempts: S.Natural.annotateKey({ description: "How many times the message has been processed." }),
    outcome: DocketIntakeOutcome.annotateKey({ description: "Latest outcome." }),
    processedOn: LocalDateFromString.annotateKey({ description: "Day of the latest attempt." }),
    receivedAt: S.NonEmptyString.annotateKey({ description: "UTC receipt timestamp of the message." }),
  },
  $I.annote("DocketLedgerRecord", { description: "Ledger record of one processed message." })
) {}

/**
 * Durable state of the intake service: the receipt-time watermark and the
 * ledger of processed messages.
 *
 * **Example** (Make empty state)
 *
 * ```ts
 * import { DocketIntakeState } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketIntakeState.make({}).ledger);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketIntakeState extends S.Class<DocketIntakeState>($I`DocketIntakeState`)(
  {
    cursor: opt(S.NonEmptyString, "UTC receipt timestamp up to which every message is settled."),
    digestedThrough: opt(LocalDateFromString, "Last day a digest was written for."),
    ledger: S.Record(S.String, DocketLedgerRecord)
      .pipe(S.withConstructorDefault(Effect.succeed({})), S.withDecodingDefaultTypeKey(Effect.succeed({})))
      .annotateKey({ description: "Ledger records keyed by message id." }),
  },
  $I.annote("DocketIntakeState", { description: "Durable state of the docket intake service." })
) {}
