/**
 * Schema models of the docket intake pipeline: what a mailbox message looks
 * like to the pipeline, what each of the two agents returns, what a matter
 * lookup answers, and the typed outcome every processed message ends in.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { CalendarDate } from "@beep/law-practice-domain";
import { DocketCategory, DocketDueDate, DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
import { LiteralKit } from "@beep/schema";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  ExtractorFieldResponse,
  FieldAgreement,
  ReviewFinding,
  ReviewVerdict,
  StoredDeterministicCheck,
} from "./DocketReview.schemas.ts";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketIntake.schemas");

const opt = <Sch extends S.Top>(schema: Sch, description: string) =>
  schema.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }));

const emptyStrings: ReadonlyArray<string> = [];

const stringList = (description: string) =>
  S.Array(S.String).pipe(
    S.withConstructorDefault(Effect.succeed(emptyStrings)),
    S.annotateKey({ description }),
    S.withDecodingDefaultTypeKey(Effect.succeed(emptyStrings))
  );

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
export class DocketAttachmentRef extends S.Opaque<DocketAttachmentRef, { readonly brand: unique symbol }>()(
  S.Struct({
    attachmentId: S.NonEmptyString.annotateKey({ description: "Provider id of the attachment." }),
    contentType: opt(S.String, "MIME type reported by the mailbox."),
    name: opt(S.String, "File name reported by the mailbox."),
    sizeBytes: opt(S.Natural, "Size in bytes reported by the mailbox."),
  }).pipe($I.annoteSchema("DocketAttachmentRef", { description: "Metadata reference to one message attachment." }))
) {}

/**
 * **Details**
 *
 * `mailbox` is anywhere a message normally sits. `junk` and `deleted` are the
 * Junk Email and Deleted Items folders: mail there is still processed, because
 * a deadline that a filter or a stray click put away is still a deadline, and
 * every entry written for it says where it was found.
 *
 * **Example** (Guard a source folder)
 *
 * ```ts
 * import { DocketSourceFolder } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketSourceFolder.is.junk("junk")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketSourceFolder = LiteralKit(["mailbox", "junk", "deleted"]).pipe(
  $I.annoteSchema("DocketSourceFolder", { description: "Where in the mailbox a message was found." })
);

/**
 * **Example** (Type a source folder)
 *
 * ```ts
 * import type { DocketSourceFolder } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const folder: DocketSourceFolder = "deleted";
 * console.log(folder);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketSourceFolder = typeof DocketSourceFolder.Type;

const docketMessageSourceFolderDefault: DocketSourceFolder = "mailbox";

/**
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
export class DocketMessage extends S.Opaque<DocketMessage, { readonly brand: unique symbol }>()(
  S.Struct({
    attachments: S.Array(DocketAttachmentRef).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({ description: "Attachment references, without bytes." }),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    bodyText: S.String.annotateKey({ description: "Plain-text body (never logged)." }),
    conversationId: opt(S.NonEmptyString, "Provider thread id; dated entries share one identity per thread and date."),
    internetMessageId: opt(S.NonEmptyString, "RFC 5322 message id; stable across folders."),
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
    receivedAt: S.NonEmptyString.annotateKey({ description: "UTC receipt timestamp in ISO-8601 form." }),
    receivedDate: LocalDateFromString.annotateKey({
      description: "Calendar day of receipt in the practice time zone.",
    }),
    sender: opt(S.String, "Sender address (never logged)."),
    sourceFolder: DocketSourceFolder.pipe(
      S.withConstructorDefault(Effect.succeed(docketMessageSourceFolderDefault)),
      S.annotateKey({ description: "Where in the mailbox the message was found; `mailbox` unless stated." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketMessageSourceFolderDefault))
    ),
    subject: opt(S.String, "Subject line (never logged)."),
    webLink: opt(S.String, "Link that opens the message in Outlook."),
  }).pipe($I.annoteSchema("DocketMessage", { description: "A mailbox message as the docket intake pipeline sees it." }))
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
export class DocketSourceDocument extends S.Opaque<DocketSourceDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    bytes: S.Uint8Array.annotateKey({ description: "Document bytes (never logged)." }),
    contentType: S.String.annotateKey({ description: "MIME type of the document." }),
    name: opt(S.String, "File name (never logged)."),
    text: opt(S.String, "Text of the document, when the adapter can supply it (never logged)."),
  }).pipe($I.annoteSchema("DocketSourceDocument", { description: "A source document attached to a message." }))
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
export class ParalegalNotDocketItem extends S.Opaque<ParalegalNotDocketItem, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ParalegalNotDocketItem", {
    rationale: S.String.annotateKey({ description: "One sentence on why nothing needs docketing." }),
  }).pipe($I.annoteSchema("ParalegalNotDocketItem", { description: "Agent 1 found nothing to docket." }))
) {}

/**
 * **Details**
 *
 * Every date field is optional and is filled only with what the message
 * itself says. `statedDueDate` is a due date the message states outright;
 * `mailDate` and `responsePeriod` are the trigger date and period it states.
 * `citedText` is the exact source text those values were copied from; the
 * review checks every reported date and period against it.
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
export class ParalegalDocketEntry extends S.Opaque<ParalegalDocketEntry, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ParalegalDocketEntry", {
    citedText: opt(S.String, "Exact source text the dates and the period were copied from (never logged)."),
    mailDate: opt(LocalDateFromString, "Trigger (mailing or notification) date the message states."),
    matterReferences: stringList("Docket, application, patent or matter numbers the message mentions, verbatim."),
    rationale: S.String.annotateKey({ description: "One sentence on why this is a docket item." }),
    responsePeriod: opt(DocketResponsePeriod, "Response period the message states."),
    statedDueDate: opt(LocalDateFromString, "Due date the message states outright."),
    title: S.NonEmptyString.annotateKey({ description: "Short calendar title for the item." }),
  }).pipe($I.annoteSchema("ParalegalDocketEntry", { description: "Agent 1 entered the message as a docket item." }))
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
 * The reviewer never works a due date out. It returns the mail date and the
 * response period it read for itself, and the pipeline does the arithmetic.
 * `statedDueDate` is a due date the source states outright, read
 * independently of the paralegal's. `citedText` is the source text the
 * reviewer read its dates and period from; when it is given, the review
 * checks those values against it. `readFromSourceDocument` says whether they
 * came from an attached document rather than from the message text.
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
export class SecretaryReview extends S.Opaque<SecretaryReview, { readonly brand: unique symbol }>()(
  S.Struct({
    citedText: opt(S.String, "Exact source text the reviewer read its dates and period from (never logged)."),
    isDocketItem: S.Boolean.annotateKey({ description: "Whether the reviewer finds a deadline or required action." }),
    mailDate: opt(LocalDateFromString, "Trigger date the reviewer read for itself."),
    matterReferences: stringList("Matter references the reviewer read for itself, verbatim."),
    notes: S.String.annotateKey({ description: "One or two sentences on what the reviewer checked." }),
    readFromSourceDocument: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.annotateKey({ description: "Whether the date and period came from an attached document." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    responsePeriod: opt(DocketResponsePeriod, "Response period the reviewer read for itself."),
    statedDueDate: opt(LocalDateFromString, "Due date the source states outright, read by the reviewer for itself."),
  }).pipe($I.annoteSchema("SecretaryReview", { description: "Agent 2 review of one entry." }))
) {}

/**
 * What agent 1 (paralegal role) returns when it is asked to revise or defend
 * disputed fields of its entry.
 *
 * **Details**
 *
 * `selfReportedConfidence` is the model's own statement of confidence. It is
 * recorded for the attorney and is never part of the review score.
 *
 * **Example** (Make a revision)
 *
 * ```ts
 * import { ParalegalNotDocketItem, ParalegalRevision } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const revision = ParalegalRevision.make({ entry: ParalegalNotDocketItem.make({ rationale: "Newsletter." }) });
 * console.log(revision.responses.length);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParalegalRevision extends S.Opaque<ParalegalRevision, { readonly brand: unique symbol }>()(
  S.Struct({
    entry: ParalegalEntry.annotateKey({ description: "The entry after the revision." }),
    responses: S.Array(ExtractorFieldResponse).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({ description: "What the extractor did with each disputed field." }),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    selfReportedConfidence: opt(UnitInterval, "The model's own confidence; recorded, never scored."),
  }).pipe($I.annoteSchema("ParalegalRevision", { description: "Agent 1 answer to a set of disputed fields." }))
) {}

/**
 * **Details**
 *
 * `entry` is the extractor's entry for the round and `reading` the critic's
 * own reading. `extractorResponse` is empty in the first round, where nothing
 * was disputed yet. `score` is computed from `findings` and `agreement` only.
 *
 * **Example** (Read a round's index)
 *
 * ```ts
 * import type { ReviewRound } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const index = (round: ReviewRound) => round.index;
 * console.log(index);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewRound extends S.Opaque<ReviewRound, { readonly brand: unique symbol }>()(
  S.Struct({
    agreement: S.Array(FieldAgreement).annotateKey({ description: "Agreement per compared field." }),
    checks: S.Array(StoredDeterministicCheck).annotateKey({
      description: "Results of the deterministic checks; a stored docket-check/v1 Boolean reads as history.",
    }),
    entry: ParalegalEntry.annotateKey({ description: "The extractor's entry for this round." }),
    extractorConfidence: opt(UnitInterval, "The extractor's own confidence; recorded, never scored."),
    extractorResponse: S.Array(ExtractorFieldResponse).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({ description: "What the extractor did with each field disputed after the previous round." }),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    findings: S.Array(ReviewFinding).annotateKey({ description: "The critic's findings on the entry." }),
    index: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "1-based number of the round." }),
    reading: SecretaryReview.annotateKey({ description: "The critic's own reading for this round." }),
    score: UnitInterval.annotateKey({ description: "Confidence score of the round." }),
  }).pipe($I.annoteSchema("ReviewRound", { description: "One completed round of the docket review loop." }))
) {}

/**
 * **Example** (Make empty progress)
 *
 * ```ts
 * import { DocketReviewProgress } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketReviewProgress.make({ rounds: [] }).rounds.length);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketReviewProgress extends S.Opaque<DocketReviewProgress, { readonly brand: unique symbol }>()(
  S.Struct({
    rounds: S.Array(ReviewRound).annotateKey({ description: "Completed rounds, oldest first." }),
  }).pipe(
    $I.annoteSchema("DocketReviewProgress", { description: "The rounds of a docket review that has not settled yet." })
  )
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
export class MatterUnique extends S.Opaque<MatterUnique, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MatterUnique", {
    applications: stringList("Application numbers of the matter."),
    client: opt(S.String, "Client number, when the matter is attributed."),
    clientName: opt(S.String, "Client name from the attorney's docket register, when it gives one."),
    dockets: stringList("Docket numbers of the matter."),
    familyKey: S.NonEmptyString.annotateKey({ description: "Client-keyed family key of the matter." }),
    matchedDockets: stringList("Dockets of the matter the references named; empty when they named the family."),
    patents: stringList("Patent numbers of the matter."),
    verified: S.Boolean.annotateKey({
      description: "False when the match is unattributed or its family number is recycled and unverified.",
    }),
  }).pipe($I.annoteSchema("MatterUnique", { description: "A reference resolved to exactly one matter." }))
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
export class MatterAmbiguous extends S.Opaque<MatterAmbiguous, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MatterAmbiguous", {
    familyKeys: stringList("Family keys of the candidate matters."),
  }).pipe($I.annoteSchema("MatterAmbiguous", { description: "A reference resolved to several matters." }))
) {}

/**
 * No matter owns the references, but documents of one or more matters
 * mention one of them.
 *
 * **Details**
 *
 * The practice KG attaches an application or patent number to a matter only
 * when the matter's own dockets were filed under it. A number that the
 * documents of other matters merely cite is not a match, so those matters
 * are offered to the attorney as candidates, never chosen. One candidate is
 * still a suggestion.
 *
 * **Example** (Make a suggested match)
 *
 * ```ts
 * import { MatterSuggested } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(MatterSuggested.make({ familyKeys: ["0000.0001"] }).familyKeys.length);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterSuggested extends S.Opaque<MatterSuggested, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MatterSuggested", {
    familyKeys: stringList("Family keys of the matters whose documents mention a reference."),
  }).pipe(
    $I.annoteSchema("MatterSuggested", {
      description: "No matter owns the references; matters whose documents mention one are suggested.",
    })
  )
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
export class MatterNotFound extends S.Opaque<MatterNotFound, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MatterNotFound", {}).pipe($I.annoteSchema("MatterNotFound", { description: "No matter was found." }))
) {}

/**
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
export const MatterLookupResult = S.Union([MatterUnique, MatterAmbiguous, MatterSuggested, MatterNotFound]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MatterLookupResult", { description: "Answer of a practice-KG matter lookup." })
);

/**
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
  "matter-suggested",
  "matter-not-found",
  "matter-unverified",
  "matter-lookup-failed",
  "ladder-truncated",
  "source-document-missing",
  "due-date-past",
  "junk-folder",
  "deleted-folder",
  "tracked-date-differs",
  "tracked-dates-unavailable",
]).pipe($I.annoteSchema("DocketEntryFlag", { description: "A reason the attorney should check a tentative entry." }));

/**
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
export class DocketCalendarEntry extends S.Opaque<DocketCalendarEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    bodyText: S.String.annotateKey({ description: "Plain-text body of the entry (never logged)." }),
    category: DocketCategory.annotateKey({ description: "The one docket category the entry carries." }),
    date: LocalDateFromString.annotateKey({ description: "The day the all-day entry falls on." }),
    key: S.NonEmptyString.annotateKey({ description: "Idempotency key stored on the entry." }),
    kind: DocketEntryKind.annotateKey({ description: "Kind of entry." }),
    subject: S.NonEmptyString.annotateKey({ description: "Subject of the entry (never logged)." }),
    tentative: S.Boolean.annotateKey({ description: "Shown as tentative when true, as free otherwise." }),
  }).pipe(
    $I.annoteSchema("DocketCalendarEntry", { description: "One all-day calendar entry the pipeline wants to exist." })
  )
) {}

/**
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
export class DocketWrittenEntry extends S.Opaque<DocketWrittenEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    eventId: S.NonEmptyString.annotateKey({ description: "Provider id of the calendar event." }),
    webLink: opt(S.String, "Link that opens the event in Outlook."),
  }).pipe($I.annoteSchema("DocketWrittenEntry", { description: "A calendar entry that exists in the mailbox." }))
) {}

/**
 * Why a docket item got a needs-review entry instead of a dated one.
 *
 * **Details**
 *
 * `flagged-low-confidence`, `flagged-max-rounds` and `deterministic-failure`
 * are the terminal statuses of a review that did not accept the item.
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
export const DocketNeedsReviewReason = LiteralKit([
  "no-usable-date",
  "due-date-past",
  "agents-disagree",
  "processing-failed",
  "flagged-low-confidence",
  "flagged-max-rounds",
  "deterministic-failure",
]).pipe($I.annoteSchema("DocketNeedsReviewReason", { description: "Why a docket item needs the attorney's review." }));

/**
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
export const DocketIntakeStage = LiteralKit([
  "mailbox",
  "enter",
  "review",
  "lookup",
  "tracked-dates",
  "calendar",
  "store",
]).pipe($I.annoteSchema("DocketIntakeStage", { description: "Docket intake pipeline stage." }));

/**
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
 * **Details**
 *
 * The sheet's `Date Type` column says `Due Date` (sometimes `Due`),
 * `Final Date` or `Reminder`; anything else is `other`. Only `due-date` and
 * `final-date` rows are deadlines the cross-check compares.
 *
 * **Example** (Guard a tracked date type)
 *
 * ```ts
 * import { TrackedDateType } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(TrackedDateType.is["final-date"]("final-date")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TrackedDateType = LiteralKit(["due-date", "reminder", "final-date", "other"]).pipe(
  $I.annoteSchema("TrackedDateType", { description: "Kind of a tracked date on the attorney's docket sheet." })
);

/**
 * **Example** (Type a tracked date type)
 *
 * ```ts
 * import type { TrackedDateType } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const type: TrackedDateType = "due-date";
 * console.log(type);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TrackedDateType = typeof TrackedDateType.Type;

/**
 * **Example** (Make a tracked date)
 *
 * ```ts
 * import { TrackedDate } from "@beep/law-practice-use-cases/DocketIntake";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const tracked = TrackedDate.make({
 *   date: LocalDate.make({ year: 2030, month: 4, day: 8 }),
 *   dateType: "due-date",
 *   docket: "0000.00001US01",
 *   name: "Response"
 * });
 * console.log(tracked.dateType);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TrackedDate extends S.Opaque<TrackedDate, { readonly brand: unique symbol }>()(
  S.Struct({
    date: LocalDateFromString.annotateKey({ description: "The tracked date." }),
    dateType: TrackedDateType.annotateKey({ description: "Kind of tracked date." }),
    docket: S.NonEmptyString.annotateKey({ description: "The docket the row belongs to, as asked for." }),
    name: S.String.annotateKey({ description: "What the date is for, as the sheet names it." }),
  }).pipe(
    $I.annoteSchema("TrackedDate", { description: "One tracked date of one docket on the attorney's docket sheet." })
  )
) {}

/**
 * **Details**
 *
 * - `stated`: the message states the date outright;
 * - `computed`: computed from the mailing date and the response period;
 * - `extractor`: the first reader's date in an agent review;
 * - `reviewer`: the second reader's date in an agent review;
 * - `tracked`: the date the attorney's docket sheet already tracks.
 *
 * **Example** (Guard a candidate source)
 *
 * ```ts
 * import { DocketCandidateDateSource } from "@beep/law-practice-use-cases/DocketIntake"
 *
 * console.log(DocketCandidateDateSource.is.stated("stated")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketCandidateDateSource = LiteralKit(["stated", "computed", "extractor", "reviewer", "tracked"]).pipe(
  $I.annoteSchema("DocketCandidateDateSource", {
    description: "Where a candidate due date came from: stated, computed, either agent reader, or the docket sheet.",
  })
);

/**
 * @see {@link DocketCandidateDateSource} for the sources.
 * @category models
 * @since 0.0.0
 */
export type DocketCandidateDateSource = typeof DocketCandidateDateSource.Type;

/**
 * **Example** (Decode a stated date)
 *
 * ```ts
 * import { DocketCandidateDate } from "@beep/law-practice-use-cases/DocketIntake"
 * import * as S from "effect/Schema"
 *
 * const candidate = S.decodeUnknownOption(DocketCandidateDate)({ date: "2026-11-02", source: "stated" })
 * console.log(candidate._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketCandidateDate extends S.Opaque<DocketCandidateDate, { readonly brand: unique symbol }>()(
  S.Struct({
    date: LocalDateFromString.annotateKey({ description: "The candidate due date." }),
    source: DocketCandidateDateSource.annotateKey({ description: "Where the date came from." }),
  }).pipe(
    $I.annoteSchema("DocketCandidateDate", {
      description: "One date a docket item's deadline could be, with where it came from.",
    })
  )
) {}

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
export class NotDocketItem extends S.Opaque<NotDocketItem, { readonly brand: unique symbol }>()(
  S.TaggedStruct("NotDocketItem", {
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
  }).pipe($I.annoteSchema("NotDocketItem", { description: "The message needs no docket entry." }))
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
export class DocketEntered extends S.Opaque<DocketEntered, { readonly brand: unique symbol }>()(
  S.TaggedStruct("DocketEntered", {
    dueDate: DocketDueDate.annotateKey({ description: "The date the entry is on, with both candidates." }),
    entry: DocketWrittenEntry.annotateKey({ description: "The due-date entry." }),
    flags: S.Array(DocketEntryFlag).annotateKey({ description: "Things the attorney should check." }),
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
    reminders: S.Array(DocketWrittenEntry).annotateKey({ description: "The reminder entries." }),
    review: opt(ReviewVerdict, "Verdict of the review that accepted the item."),
  }).pipe($I.annoteSchema("DocketEntered", { description: "A dated tentative docket entry exists." }))
) {}

/**
 * Outcome: a docket item without a usable date, one the agents disagree on,
 * or one the review flagged has a needs-review entry.
 *
 * **Details**
 *
 * Besides ids and flags, the outcome keeps what the attorney needs to know
 * which email it is about: its subject, sender, day of receipt and Outlook
 * link, its thread, the dates the deadline could be, and the matter. It also
 * keeps the docket item's title, the calendar title a date the attorney picks
 * gives the entry. Every one of those keys is optional or defaults to empty,
 * so ledger records written before they existed still decode. The subject,
 * the sender, the title and the matter are never logged.
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
export class DocketNeedsReview extends S.Opaque<DocketNeedsReview, { readonly brand: unique symbol }>()(
  S.TaggedStruct("DocketNeedsReview", {
    candidateDates: S.Array(DocketCandidateDate).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({ description: "Dates the deadline could be, from either reader or the docket sheet." }),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    conversationId: opt(S.NonEmptyString, "Mail thread (Graph conversationId) of the message."),
    docket: opt(S.NonEmptyString, "Docket number of the matched matter, when exactly one is known."),
    entry: DocketWrittenEntry.annotateKey({ description: "The needs-review entry." }),
    flags: S.Array(DocketEntryFlag).annotateKey({ description: "Things the attorney should check." }),
    matter: opt(S.NonEmptyString, "One-line summary of what the matter lookup found (never logged)."),
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
    messageLink: opt(S.NonEmptyString, "Link that opens the message in Outlook."),
    reason: DocketNeedsReviewReason.annotateKey({ description: "Why no dated entry was written." }),
    receivedDate: opt(CalendarDate, "Calendar day the message was received on, in the practice time zone."),
    review: opt(ReviewVerdict, "Verdict of the review, when the item went through one."),
    sender: opt(S.NonEmptyString, "Sender address of the message (never logged)."),
    subject: opt(S.NonEmptyString, "Subject line of the message (never logged)."),
    title: opt(
      S.NonEmptyString,
      "Title of the docket item, without the needs-review prefix: the calendar title a chosen date writes (never logged)."
    ),
  }).pipe($I.annoteSchema("DocketNeedsReview", { description: "A docket item needs the attorney's review." }))
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
export class IntakeFailed extends S.Opaque<IntakeFailed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("IntakeFailed", {
    messageId: S.NonEmptyString.annotateKey({ description: "Provider id of the message." }),
    stage: DocketIntakeStage.annotateKey({ description: "Stage that failed." }),
  }).pipe($I.annoteSchema("IntakeFailed", { description: "A pipeline step failed for the message." }))
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
 * times it has been attempted.
 *
 * **Details**
 *
 * A settled record holds ids, dates and flags, and, for a needs-review
 * message, what identifies the email to the attorney: its subject, sender,
 * Outlook link, candidate dates, matter and the item's title (see
 * {@link DocketNeedsReview}). The record stays in the state directory, and
 * those fields are never logged. While a review is still running, `review`
 * holds its completed rounds so a restart continues from the next round; a
 * record that has `review` is not settled, and the rounds are dropped when
 * the message settles.
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
export class DocketLedgerRecord extends S.Opaque<DocketLedgerRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    attempts: S.Natural.annotateKey({ description: "How many times the message has been processed." }),
    outcome: DocketIntakeOutcome.annotateKey({ description: "Latest outcome." }),
    processedOn: LocalDateFromString.annotateKey({ description: "Day of the latest attempt." }),
    receivedAt: S.NonEmptyString.annotateKey({ description: "UTC receipt timestamp of the message." }),
    review: opt(DocketReviewProgress, "Completed rounds of a review that has not settled yet."),
  }).pipe($I.annoteSchema("DocketLedgerRecord", { description: "Ledger record of one processed message." }))
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
export class DocketIntakeState extends S.Opaque<DocketIntakeState, { readonly brand: unique symbol }>()(
  S.Struct({
    cursor: opt(S.NonEmptyString, "UTC receipt timestamp up to which every message is settled."),
    digestedThrough: opt(LocalDateFromString, "Last day a digest was written for."),
    ledger: S.Record(S.String, DocketLedgerRecord).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.annotateKey({ description: "Ledger records keyed by message id." }),
      S.withDecodingDefaultTypeKey(Effect.succeed({}))
    ),
  }).pipe($I.annoteSchema("DocketIntakeState", { description: "Durable state of the docket intake service." }))
) {}
