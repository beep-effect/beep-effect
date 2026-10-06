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
  M365GetMessageRequest,
  M365ListMessageAttachmentsRequest,
  M365ListMessagesRequest,
  M365MasterCategoryDraft,
  M365UpdateMessageCategoriesRequest,
  m365AllDayWindow,
} from "@beep/m365";
import { LocalDate } from "@beep/schema/LocalDate";
import { DateTime, Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DocketCalendarEntry, DocketIntakeStage } from "@beep/law-practice-use-cases/DocketIntake";
import type { GraphAttachment, GraphCategoryColor, GraphEvent, GraphMessage, M365Error, M365Shape } from "@beep/m365";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.graph");

const PositiveCount = S.Int.check(S.isGreaterThan(0));

const docketGraphConfigPageSizeDefault = 50;
const docketGraphConfigMaxDocumentsDefault = 3;
const docketGraphConfigMaxDocumentBytesDefault = 15_000_000;

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

// The listing spans every folder, so drafts and the mailbox's own sent mail are dropped here.
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
  (zone: DateTime.TimeZone) =>
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

const toWrittenEntry = (event: GraphEvent): O.Option<DocketWrittenEntry> =>
  pipe(
    O.liftPredicate(event.id, Str.isNonEmpty),
    O.map((eventId) => DocketWrittenEntry.make({ eventId, webLink: event.webLink }))
  );

const isStaleWrite = (error: M365Error): boolean =>
  error.reason === "response status" && O.contains(error.status, PRECONDITION_FAILED);

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

const makeMailbox = (m365: M365Shape, config: DocketGraphConfig) => {
  const userId = O.some(config.mailbox);
  const zone = config.timeZone;

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

  // Read the current categories, then write them back with the docket one added. The write is
  // conditional on the change key just read, so a concurrent edit is never overwritten.
  const addEnteredCategory = Effect.fnUntraced(function* (messageId: string) {
    const current = yield* m365.getMessage(M365GetMessageRequest.make({ messageId, userId }));
    const existing = A.filter(O.getOrElse(current.categories, A.empty<string>), Str.isNonEmpty);
    const categories = withDocketCategory(existing, ENTERED_CATEGORY);
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
  });

  return DocketMailbox.of({
    markEntered: Effect.fn("DocketGraph.markEntered")(function* (message) {
      yield* addEnteredCategory(message.messageId).pipe(
        Effect.retry({ times: 1, while: isStaleWrite }),
        Effect.mapError(mailboxError)
      );
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
      const inbound = A.filter(listed, isInbound(config.mailbox));
      const messages = A.getSomes(A.map(inbound, toDocketMessage(zone)));
      yield* Effect.annotateCurrentSpan({
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
      const readable = A.take(
        A.filter(attachments.value, isReadableDocument(config.maxDocumentBytes)),
        config.maxDocuments
      );
      yield* Effect.annotateCurrentSpan({
        docket_attachments: A.length(attachments.value),
        docket_documents: A.length(readable),
      });
      return yield* Effect.forEach(
        readable,
        (attachment) =>
          m365
            .downloadMessageAttachment(
              M365DownloadMessageAttachmentRequest.make({
                attachmentId: attachment.id,
                messageId: message.messageId,
                userId,
              })
            )
            .pipe(
              Effect.map((content) =>
                DocketSourceDocument.make({
                  bytes: content.bytes,
                  contentType: PDF_CONTENT_TYPE,
                  name: attachment.name,
                })
              )
            ),
        { concurrency: 1 }
      ).pipe(Effect.mapError(mailboxError));
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

/**
 * Build the Graph-backed mailbox and calendar ports of the docket intake
 * pipeline.
 *
 * **Details**
 *
 * Building the layer makes sure the six `Docket - *` master categories exist
 * in the mailbox; existing categories are never changed. On a message the
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
      yield* Effect.annotateCurrentSpan({ docket_categories_created: A.length(ensured.created) });
      return Layer.merge(
        Layer.succeed(DocketMailbox, makeMailbox(m365, config)),
        Layer.succeed(DocketCalendar, makeCalendar(m365, config))
      );
    }).pipe(Effect.withSpan("DocketGraph.make"))
  );
