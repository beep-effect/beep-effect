/**
 * Microsoft Graph adapters for the docket intake mailbox and calendar ports.
 *
 * **Details**
 *
 * The adapters translate between Graph resources and the pipeline's models.
 * They hold no docketing policy and no date arithmetic: the only date they
 * produce is the calendar day a message was received on, in the practice time
 * zone.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  DocketCalendar,
  DocketIntakeError,
  DocketMailbox,
  DocketMessage,
  DocketSourceDocument,
  DocketWrittenEntry,
} from "@beep/law-practice-use-cases/DocketIntake";
import {
  M365,
  M365CreateEventRequest,
  M365DownloadMessageAttachmentRequest,
  M365EnsureMasterCategoriesRequest,
  M365EventBody,
  M365EventDraft,
  M365FindEventsByIdempotencyKeyRequest,
  M365GetMailFolderRequest,
  M365GetMessageRequest,
  M365ListMessageAttachmentsRequest,
  M365ListMessagesRequest,
  M365MasterCategoryDraft,
  M365UpdateMessageCategoriesRequest,
  m365AllDayWindow,
} from "@beep/m365";
import { LocalDate } from "@beep/schema/LocalDate";
import { DateTime, Effect, HashMap, HashSet, Layer, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  DocketCalendarEntry,
  DocketCalendarShape,
  DocketIntakeStage,
  DocketMailboxShape,
  DocketSourceFolder,
} from "@beep/law-practice-use-cases/DocketIntake";
import type { GraphAttachment, GraphCategoryColor, GraphEvent, GraphMessage, M365Error, M365Shape } from "@beep/m365";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.graph");

const PositiveCount = S.Int.check(S.isGreaterThan(0));

const docketGraphConfigPageSizeDefault = 50;
const docketGraphConfigMaxDocumentsDefault = 3;
const docketGraphConfigMaxDocumentBytesDefault = 15_000_000;
const docketGraphConfigMaxTotalDocumentBytesDefault = 20_000_000;

/**
 * Settings of the Graph mailbox and calendar adapters.
 *
 * **Details**
 *
 * `timeZone` has no default on purpose: it decides which calendar day a
 * message was received on and which day an all-day entry falls on. It is a
 * resolved IANA zone, not a string, so a config with an unknown zone cannot
 * be made; decoding one from its encoded form fails.
 *
 * **Example** (Make a Graph adapter config)
 *
 * ```ts
 * import { DocketGraphConfig } from "@beep/law-practice-server/DocketIntake";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * const config = S.decodeUnknownOption(DocketGraphConfig)({
 *   initialSince: "2030-01-01T00:00:00.000Z",
 *   mailbox: "mailbox-id",
 *   timeZone: "America/Chicago"
 * });
 * console.log(O.map(config, (value) => value.pageSize)); // Some(50)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketGraphConfig extends S.Class<DocketGraphConfig>($I`DocketGraphConfig`)(
  {
    initialSince: S.NonEmptyString.annotateKey({
      description: "UTC ISO-8601 timestamp used as the listing floor when the pipeline passes no cursor.",
    }),
    mailbox: S.NonEmptyString.annotateKey({ description: "Mailbox user id or address; never logged." }),
    maxDocumentBytes: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(docketGraphConfigMaxDocumentBytesDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketGraphConfigMaxDocumentBytesDefault))
    ).annotateKey({ description: "Largest source document, in bytes, handed to the reviewer." }),
    maxDocuments: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(docketGraphConfigMaxDocumentsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketGraphConfigMaxDocumentsDefault))
    ).annotateKey({ description: "Most source documents handed to the reviewer for one message." }),
    maxTotalDocumentBytes: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(docketGraphConfigMaxTotalDocumentBytesDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketGraphConfigMaxTotalDocumentBytesDefault))
    ).annotateKey({
      description:
        "Most raw bytes of source documents handed to the reviewer for one message. The default of 20,000,000 stays under a 32 MB request once base64 encoding inflates the bytes by four thirds.",
    }),
    pageSize: PositiveCount.pipe(
      S.withConstructorDefault(Effect.succeed(docketGraphConfigPageSizeDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketGraphConfigPageSizeDefault))
    ).annotateKey({ description: "Messages requested per Graph page." }),
    timeZone: S.TimeZoneNamedFromString.annotateKey({ description: "IANA time zone of the practice; required." }),
  },
  $I.annote("DocketGraphConfig", { description: "Settings of the docket intake Graph adapters." })
) {}

const ENTERED_CATEGORY: DocketCategory = "Docket - entered";
const FILE_ATTACHMENT_TYPE = "#microsoft.graph.fileAttachment";
const PDF_CONTENT_TYPE = "application/pdf";
const PDF_EXTENSION = ".pdf";
const PRECONDITION_FAILED = 412;

// Well-known folders whose mail is never inbound: what the mailbox wrote itself.
const EXCLUDED_FOLDERS = ["sentitems", "drafts", "outbox"] as const;

// Well-known folders whose mail is still docketed, marked with where it was found: a deadline
// that a filter or a stray click put away is still a deadline.
const MARKED_FOLDERS: ReadonlyArray<readonly [folder: string, sourceFolder: DocketSourceFolder]> = [
  ["junkemail", "junk"],
  ["deleteditems", "deleted"],
];

// The folder ids of one mailbox, resolved once when the layer is built.
type MailboxFolders = {
  readonly excluded: HashSet.HashSet<string>;
  readonly marked: HashMap.HashMap<string, DocketSourceFolder>;
};

const IN_MAILBOX: DocketSourceFolder = "mailbox";

const categoryColor = DocketCategory.$match({
  "Docket - digest": (): GraphCategoryColor => "preset12",
  "Docket - entered": (): GraphCategoryColor => "preset5",
  "Docket - needs review": (): GraphCategoryColor => "preset1",
  "Docket - reminder": (): GraphCategoryColor => "preset7",
  "Docket - unverified": (): GraphCategoryColor => "preset0",
  "Docket - verified": (): GraphCategoryColor => "preset4",
});

const masterCategories = A.map(DocketCategory.literals, (displayName) =>
  M365MasterCategoryDraft.make({ color: categoryColor(displayName), displayName })
);

/**
 * Add one docket category to a message's category list.
 *
 * **Details**
 *
 * Every existing category is kept in its original order, including the ones
 * other workstreams own. The list is returned unchanged when the category is
 * already present, so applying it twice is the same as applying it once.
 *
 * **Example** (Append the entered category)
 *
 * ```ts
 * import { withDocketCategory } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(withDocketCategory(["M: fixture"], "Docket - entered"));
 * // ["M: fixture", "Docket - entered"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const withDocketCategory: {
  (category: DocketCategory): (existing: ReadonlyArray<string>) => ReadonlyArray<string>;
  (existing: ReadonlyArray<string>, category: DocketCategory): ReadonlyArray<string>;
} = dual(
  2,
  (existing: ReadonlyArray<string>, category: DocketCategory): ReadonlyArray<string> =>
    A.contains(existing, category) ? existing : A.append(existing, category)
);

const portError =
  (stage: DocketIntakeStage) =>
  (error: M365Error): DocketIntakeError =>
    DocketIntakeError.make({
      ambiguousWrite: stage === "calendar" && error.reason === "ambiguous write",
      cause: error.reason,
      stage,
    });

const mailboxError = portError("mailbox");
const calendarError = portError("calendar");

const lowerCase = Str.toLowerCase;

const senderAddress = (message: GraphMessage): O.Option<string> =>
  pipe(
    message.from,
    O.flatMap((recipient) => recipient.emailAddress),
    O.flatMap((emailAddress) => emailAddress.address)
  );

// The listing spans every folder. The folder a message sits in decides whether it is inbound;
// that holds however the mailbox is addressed (by address or by id).
const isInExcludedFolder =
  (folders: MailboxFolders) =>
  (message: GraphMessage): boolean =>
    O.exists(message.parentFolderId, (folderId) => HashSet.has(folders.excluded, folderId));

const sourceFolderOf = (folders: MailboxFolders, message: GraphMessage): DocketSourceFolder =>
  pipe(
    message.parentFolderId,
    O.flatMap((folderId) => HashMap.get(folders.marked, folderId)),
    O.getOrElse(() => IN_MAILBOX)
  );

// Secondary guards for mail outside those folders: drafts, and mail the mailbox sent to itself
// when it is configured by address.
const isInbound =
  (mailbox: string) =>
  (message: GraphMessage): boolean =>
    Str.isNonEmpty(message.id) &&
    !O.contains(message.isDraft, true) &&
    !O.exists(senderAddress(message), (address) => lowerCase(address) === lowerCase(mailbox));

/**
 * The calendar day an instant falls on in a time zone.
 *
 * **Details**
 *
 * This is the only date the Graph adapters derive. It answers "which day did
 * this arrive on, at the practice", so a message received late in the evening
 * is not dated to the next day because UTC has already rolled over.
 *
 * **Example** (Read the practice day of an instant)
 *
 * ```ts
 * import { docketDayInZone } from "@beep/law-practice-server/DocketIntake";
 * import { DateTime } from "effect";
 * import * as O from "effect/Option";
 *
 * const day = O.map(
 *   O.all({ instant: DateTime.make("2030-01-10T03:30:00Z"), zone: DateTime.zoneMakeNamed("America/Chicago") }),
 *   ({ instant, zone }) => docketDayInZone(instant, zone).toISOString()
 * );
 * console.log(day); // Some("2030-01-09")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const docketDayInZone: {
  (zone: DateTime.TimeZone): (instant: DateTime.DateTime) => LocalDate;
  (instant: DateTime.DateTime, zone: DateTime.TimeZone): LocalDate;
} = dual(2, (instant: DateTime.DateTime, zone: DateTime.TimeZone): LocalDate => {
  const parts = DateTime.toParts(DateTime.setZone(instant, zone));
  return LocalDate.make({ day: parts.day, month: parts.month, year: parts.year });
});

const toDocketMessage =
  (zone: DateTime.TimeZone, folders: MailboxFolders) =>
  (message: GraphMessage): O.Option<DocketMessage> =>
    pipe(
      message.receivedDateTime,
      O.flatMap(DateTime.make),
      O.map((instant) =>
        DocketMessage.make({
          bodyText: pipe(
            message.body,
            O.flatMap((body) => body.content),
            O.getOrElse(() => "")
          ),
          internetMessageId: O.filter(message.internetMessageId, Str.isNonEmpty),
          messageId: message.id,
          // One timestamp format everywhere: the pipeline orders and compares these as strings.
          receivedAt: DateTime.formatIso(instant),
          receivedDate: docketDayInZone(instant, zone),
          sender: senderAddress(message),
          sourceFolder: sourceFolderOf(folders, message),
          subject: message.subject,
          webLink: message.webLink,
        })
      )
    );

const isPdf = (attachment: GraphAttachment): boolean =>
  O.exists(attachment.contentType, (contentType) => lowerCase(contentType) === PDF_CONTENT_TYPE) ||
  O.exists(attachment.name, (name) => Str.endsWith(PDF_EXTENSION)(lowerCase(name)));

const isReadableDocument =
  (maxDocumentBytes: number) =>
  (attachment: GraphAttachment): boolean =>
    O.contains(attachment["@odata.type"], FILE_ATTACHMENT_TYPE) &&
    !O.contains(attachment.isInline, true) &&
    isPdf(attachment) &&
    O.exists(attachment.size, (size) => size <= maxDocumentBytes);

type DocumentBudget<Document> = {
  readonly kept: ReadonlyArray<Document>;
  readonly remainingBytes: number;
};

// Keep a document when it fits what is left of the budget; one that does not fit is passed over
// and later, smaller ones are still considered.
const withinBudget = <Document>(
  budget: DocumentBudget<Document>,
  document: Document,
  bytes: number
): DocumentBudget<Document> =>
  bytes <= budget.remainingBytes
    ? { kept: A.append(budget.kept, document), remainingBytes: budget.remainingBytes - bytes }
    : budget;

type SizedAttachment = { readonly attachment: GraphAttachment; readonly bytes: number };

const sized = (attachment: GraphAttachment): O.Option<SizedAttachment> =>
  O.map(attachment.size, (bytes) => ({ attachment, bytes }));

const selectWithinBudget = (
  attachments: ReadonlyArray<GraphAttachment>,
  totalBytes: number
): ReadonlyArray<GraphAttachment> =>
  A.reduce(
    A.getSomes(A.map(attachments, sized)),
    { kept: A.empty<GraphAttachment>(), remainingBytes: totalBytes },
    (budget: DocumentBudget<GraphAttachment>, candidate) => withinBudget(budget, candidate.attachment, candidate.bytes)
  ).kept;

const toWrittenEntry = (event: GraphEvent): O.Option<DocketWrittenEntry> =>
  pipe(
    O.liftPredicate(event.id, Str.isNonEmpty),
    O.map((eventId) => DocketWrittenEntry.make({ eventId, webLink: event.webLink }))
  );

const isStaleWrite = (error: M365Error): boolean =>
  error.reason === "response status" && O.contains(error.status, PRECONDITION_FAILED);

/**
 * Rewrite one message's category list, conditional on the change key just
 * read, so a concurrent edit is never overwritten.
 *
 * **Details**
 *
 * The categories are read, empty names are dropped, and `edit` returns the
 * new list. Nothing is written when the edit leaves the list the same length.
 * A write refused with 412 because the message changed in between is retried
 * once from a fresh read.
 *
 * **Example** (Add the entered category)
 *
 * ```ts
 * import { rewriteMessageCategories, withDocketCategory } from "@beep/law-practice-server/DocketIntake";
 * import { M365 } from "@beep/m365";
 *
 * const program = M365.use((m365) =>
 *   rewriteMessageCategories({
 *     edit: withDocketCategory("Docket - entered"),
 *     m365,
 *     mailbox: "mailbox-id",
 *     messageId: "message-id"
 *   })
 * );
 * console.log(program);
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rewriteMessageCategories: (input: {
  readonly edit: (existing: ReadonlyArray<string>) => ReadonlyArray<string>;
  readonly m365: M365Shape;
  readonly mailbox: string;
  readonly messageId: string;
}) => Effect.Effect<void, M365Error> = Effect.fn("DocketGraph.rewriteMessageCategories")(
  function* (input) {
    const { m365, messageId } = input;
    const userId = O.some(input.mailbox);
    const current = yield* m365.getMessage(M365GetMessageRequest.make({ messageId, userId }));
    const existing = A.filter(O.getOrElse(current.categories, A.empty<string>), Str.isNonEmpty);
    const categories = input.edit(existing);
    if (A.length(categories) === A.length(existing)) {
      return;
    }
    yield* m365.updateMessageCategories(
      M365UpdateMessageCategoriesRequest.make({
        categories,
        changeKey: O.filter(current.changeKey, Str.isNonEmpty),
        messageId,
        userId,
      })
    );
  },
  Effect.retry({ times: 1, while: isStaleWrite })
);

const toEventDraft = (entry: DocketCalendarEntry, timeZone: string): M365EventDraft =>
  M365EventDraft.make({
    ...m365AllDayWindow(entry.date, timeZone),
    body: O.some(M365EventBody.make({ content: entry.bodyText, contentType: "text" })),
    categories: [entry.category],
    isAllDay: true,
    isReminderOn: O.some(true),
    reminderMinutesBeforeStart: O.some(0),
    showAs: O.some(entry.tentative ? "tentative" : "free"),
    subject: entry.subject,
  });

const makeMailbox = (m365: M365Shape, config: DocketGraphConfig, folders: MailboxFolders) => {
  const userId = O.some(config.mailbox);
  const zone = config.timeZone;

  // Download one selected document and keep it only when its real size fits both the
  // per-document cap and what is left of the total: metadata sizes are not always exact.
  const downloadWithinBudget = Effect.fnUntraced(function* (
    messageId: string,
    budget: DocumentBudget<DocketSourceDocument>,
    attachment: GraphAttachment
  ) {
    const content = yield* m365.downloadMessageAttachment(
      M365DownloadMessageAttachmentRequest.make({ attachmentId: attachment.id, messageId, userId })
    );
    const bytes = content.bytes.length;
    return bytes <= config.maxDocumentBytes
      ? withinBudget(
          budget,
          DocketSourceDocument.make({ bytes: content.bytes, contentType: PDF_CONTENT_TYPE, name: attachment.name }),
          bytes
        )
      : budget;
  });

  const listPages: (request: M365ListMessagesRequest) => Effect.Effect<ReadonlyArray<GraphMessage>, M365Error> =
    Effect.fnUntraced(function* (request) {
      const page = yield* m365.listMessages(request);
      if (O.isNone(page["@odata.nextLink"])) {
        return page.value;
      }
      const rest = yield* listPages(
        M365ListMessagesRequest.make({
          bodyContentType: request.bodyContentType,
          nextLink: page["@odata.nextLink"],
          userId,
        })
      );
      return A.appendAll(page.value, rest);
    });

  return DocketMailbox.of({
    markEntered: Effect.fn("DocketGraph.markEntered")(function* (message) {
      yield* rewriteMessageCategories({
        edit: withDocketCategory(ENTERED_CATEGORY),
        m365,
        mailbox: config.mailbox,
        messageId: message.messageId,
      }).pipe(Effect.mapError(mailboxError));
    }),
    receivedSince: Effect.fn("DocketGraph.receivedSince")(function* (since) {
      const floor = O.getOrElse(since, () => config.initialSince);
      const listed = yield* listPages(
        M365ListMessagesRequest.make({
          bodyContentType: O.some("text"),
          filter: O.some(`receivedDateTime ge ${floor}`),
          orderby: O.some("receivedDateTime asc"),
          top: O.some(config.pageSize),
          userId,
        })
      ).pipe(Effect.mapError(mailboxError));
      const inExcludedFolder = isInExcludedFolder(folders);
      const elsewhere = A.filter(listed, (received) => !inExcludedFolder(received));
      const inbound = A.filter(elsewhere, isInbound(config.mailbox));
      const messages = A.getSomes(A.map(inbound, toDocketMessage(zone, folders)));
      yield* Effect.annotateCurrentSpan({
        docket_dropped_sent_drafts_outbox: A.length(listed) - A.length(elsewhere),
        docket_found_in_junk_or_deleted: A.length(
          A.filter(messages, (received) => received.sourceFolder !== IN_MAILBOX)
        ),
        docket_listed: A.length(listed),
        docket_returned: A.length(messages),
        docket_skipped_undated: A.length(inbound) - A.length(messages),
      });
      return messages;
    }),
    sourceDocuments: Effect.fn("DocketGraph.sourceDocuments")(function* (message) {
      const attachments = yield* m365
        .listMessageAttachments(M365ListMessageAttachmentsRequest.make({ messageId: message.messageId, userId }))
        .pipe(Effect.mapError(mailboxError));
      const readable = A.filter(attachments.value, isReadableDocument(config.maxDocumentBytes));
      const selected = A.take(selectWithinBudget(readable, config.maxTotalDocumentBytes), config.maxDocuments);
      const downloaded = yield* Effect.reduce(
        selected,
        (): DocumentBudget<DocketSourceDocument> => ({
          kept: A.empty<DocketSourceDocument>(),
          remainingBytes: config.maxTotalDocumentBytes,
        }),
        (budget: DocumentBudget<DocketSourceDocument>, attachment) =>
          downloadWithinBudget(message.messageId, budget, attachment)
      ).pipe(Effect.mapError(mailboxError));
      yield* Effect.annotateCurrentSpan({
        docket_attachments: A.length(attachments.value),
        docket_documents: A.length(downloaded.kept),
        docket_documents_dropped_oversize: A.length(selected) - A.length(downloaded.kept),
      });
      return downloaded.kept;
    }),
  });
};

const makeCalendar = (m365: M365Shape, config: DocketGraphConfig) => {
  const userId = O.some(config.mailbox);

  return DocketCalendar.of({
    create: Effect.fn("DocketGraph.create")(function* (entry) {
      yield* Effect.annotateCurrentSpan({ docket_entry_kind: entry.kind });
      const event = yield* m365
        .createEvent(
          M365CreateEventRequest.make({
            event: toEventDraft(entry, DateTime.zoneToString(config.timeZone)),
            idempotencyKey: O.some(entry.key),
            userId,
          })
        )
        .pipe(Effect.mapError(calendarError));
      return yield* Effect.fromOption(toWrittenEntry(event), () =>
        DocketIntakeError.make({ cause: "event-without-id", stage: "calendar" })
      );
    }),
    findByKey: Effect.fn("DocketGraph.findByKey")(function* (key) {
      const found = yield* m365
        .findEventsByIdempotencyKey(M365FindEventsByIdempotencyKeyRequest.make({ idempotencyKey: key, userId }))
        .pipe(Effect.mapError(calendarError));
      yield* Effect.annotateCurrentSpan({ docket_events_found: A.length(found.value) });
      return O.flatMap(A.head(found.value), toWrittenEntry);
    }),
  });
};

// Resolve the folder ids of one mailbox once: the folders whose mail is never inbound, and the
// folders whose mail is docketed with where it was found.
const resolveFolders = Effect.fnUntraced(function* (
  m365: M365Shape,
  config: DocketGraphConfig
): Effect.fn.Return<MailboxFolders, DocketIntakeError> {
  const folderId = (folder: string) =>
    m365.getMailFolder(M365GetMailFolderRequest.make({ folder, userId: O.some(config.mailbox) })).pipe(
      Effect.map((resolved) => resolved.id),
      Effect.mapError(mailboxError)
    );
  const excluded = yield* Effect.forEach(EXCLUDED_FOLDERS, folderId, { concurrency: 1 });
  const marked = yield* Effect.forEach(
    MARKED_FOLDERS,
    ([folder, sourceFolder]) => Effect.map(folderId(folder), (id) => [id, sourceFolder] as const),
    { concurrency: 1 }
  );
  return { excluded: HashSet.fromIterable(excluded), marked: HashMap.fromIterable(marked) };
});

const portsLayer = (mailbox: DocketMailboxShape, calendar: DocketCalendarShape) =>
  Layer.merge(Layer.succeed(DocketMailbox, mailbox), Layer.succeed(DocketCalendar, calendar));

/**
 * Build the Graph-backed mailbox and calendar ports of the docket intake
 * pipeline.
 *
 * **Details**
 *
 * Building the layer makes sure the six `Docket - *` master categories exist
 * in the mailbox; existing categories are never changed. It also resolves the
 * ids of the Sent Items, Drafts, Outbox, Junk Email and Deleted Items folders
 * once. Mail in Sent Items, Drafts and Outbox is never handed to the
 * pipeline. Mail in Junk Email and Deleted Items is handed over with its
 * `sourceFolder` set to `junk` or `deleted`, so it is docketed and the entry
 * says where it was found. A failed folder lookup fails the build at stage
 * `mailbox`. On a message the
 * adapter only ever adds `Docket - entered`, and it writes the category list
 * back with every other category in place.
 *
 * **Example** (Make the Graph ports layer)
 *
 * ```ts
 * import { DocketGraphConfig, makeDocketGraphLayer } from "@beep/law-practice-server/DocketIntake";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * const layer = O.map(
 *   S.decodeUnknownOption(DocketGraphConfig)({
 *     initialSince: "2030-01-01T00:00:00.000Z",
 *     mailbox: "mailbox-id",
 *     timeZone: "America/Chicago"
 *   }),
 *   makeDocketGraphLayer
 * );
 * console.log(layer);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketGraphLayer = (
  config: DocketGraphConfig
): Layer.Layer<DocketCalendar | DocketMailbox, DocketIntakeError, M365> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const m365 = yield* M365;
      const ensured = yield* m365
        .ensureMasterCategories(
          M365EnsureMasterCategoriesRequest.make({ categories: masterCategories, userId: O.some(config.mailbox) })
        )
        .pipe(Effect.mapError(mailboxError));
      const folders = yield* resolveFolders(m365, config);
      yield* Effect.annotateCurrentSpan({ docket_categories_created: A.length(ensured.created) });
      return portsLayer(makeMailbox(m365, config, folders), makeCalendar(m365, config));
    }).pipe(Effect.withSpan("DocketGraph.make"))
  );

const readOnly = (stage: DocketIntakeStage) => () => Effect.fail(DocketIntakeError.make({ cause: "read-only", stage }));

/**
 * Build Graph-backed mailbox and calendar ports that only read, for a dry run.
 *
 * **Details**
 *
 * The ports read mail, attachments and calendar entries exactly as the
 * ports of {@link makeDocketGraphLayer} do, but building the layer creates no
 * master category, and `markEntered` and `create` fail with cause
 * `read-only` instead of writing. A dry run replaces those two with recording
 * versions; if it ever reached them, nothing would be written.
 *
 * **Example** (Make the read-only Graph ports layer)
 *
 * ```ts
 * import { DocketGraphConfig, makeDocketGraphReadOnlyLayer } from "@beep/law-practice-server/DocketIntake";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * const layer = O.map(
 *   S.decodeUnknownOption(DocketGraphConfig)({
 *     initialSince: "2030-01-01T00:00:00.000Z",
 *     mailbox: "mailbox-id",
 *     timeZone: "America/Chicago"
 *   }),
 *   makeDocketGraphReadOnlyLayer
 * );
 * console.log(layer);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketGraphReadOnlyLayer = (
  config: DocketGraphConfig
): Layer.Layer<DocketCalendar | DocketMailbox, DocketIntakeError, M365> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const m365 = yield* M365;
      const folders = yield* resolveFolders(m365, config);
      return portsLayer(
        { ...makeMailbox(m365, config, folders), markEntered: readOnly("mailbox") },
        { ...makeCalendar(m365, config), create: readOnly("calendar") }
      );
    }).pipe(Effect.withSpan("DocketGraph.makeReadOnly"))
  );
