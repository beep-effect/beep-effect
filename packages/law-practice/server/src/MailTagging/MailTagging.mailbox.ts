/**
 * The mailbox port over the `@beep/m365` driver: paged reads, attachment
 * reads, and category-only writes against one Outlook mailbox.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  InternetMessageId,
  MailAttachmentId,
  MailConversationId,
  MailEnvelope,
  MailMessageId,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  MailAttachmentMeta,
  Mailbox,
  MailboxShape,
  MailPage,
  MailPageCursor,
  MailTaggingPortError,
} from "@beep/law-practice-use-cases/MailTagging";
import {
  M365,
  M365DownloadMessageAttachmentRequest,
  M365EnsureMasterCategoriesRequest,
  M365Error,
  M365ErrorReason,
  M365GetMessageRequest,
  M365ListMessageAttachmentsRequest,
  M365ListMessagesRequest,
  M365UpdateMessageCategoriesRequest,
} from "@beep/m365";
import { EmailString } from "@beep/schema/Email";
import * as O from "@beep/utils/Option";
import { Context, Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PosInt } from "../internal/PosInt.ts";
import type { MasterCategoryIntent } from "@beep/law-practice-domain/values/MailTagging";
import type {
  DownloadAttachmentRequest,
  ListMessagesSinceRequest,
  SetCategoriesRequest,
} from "@beep/law-practice-use-cases/MailTagging";
import type { GraphAttachment, GraphMessage, GraphRecipient } from "@beep/m365";

const $I = $LawPracticeServerId.create("MailTagging/MailTagging.mailbox");

const defaultPageSize = 50;
const fileAttachmentType = "#microsoft.graph.fileAttachment";
const preconditionFailed = 412;
const notFound = 404;

/**
 * Configuration of the `@beep/m365` mailbox adapter.
 *
 * **Details**
 *
 * `userId` is the mailbox address or object id; every driver request carries
 * it, because the app-only lane has no signed-in user. `excludedFolderIds`
 * lists the Graph ids of the folders out of scope (Deleted Items and Junk);
 * drafts are excluded by the listing filter itself. The adapter reads no
 * environment variable: the caller builds this value.
 *
 * **Example** (Configure a mailbox)
 *
 * ```ts
 * import { MailboxM365Config } from "@beep/law-practice-server/MailTagging"
 *
 * const config = MailboxM365Config.make({ userId: "attorney@example.test" })
 * console.log(config.pageSize) // 50
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MailboxM365Config extends S.Class<MailboxM365Config>($I`MailboxM365Config`)(
  {
    userId: S.NonEmptyString.annotateKey({
      description: "Mailbox address or object id every driver request names.",
    }),
    pageSize: PosInt.pipe(
      S.withDecodingDefaultKey(Effect.succeed(defaultPageSize)),
      S.withConstructorDefault(Effect.succeed(defaultPageSize))
    ).annotateKey({
      description: "Messages requested per listing page; defaults to 50.",
    }),
    excludedFolderIds: S.Array(S.String)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Graph ids of the mail folders whose messages are never listed.",
      }),
  },
  $I.annote("MailboxM365Config", {
    description: "Configuration of the Microsoft 365 mailbox adapter.",
  })
) {}

/**
 * Service tag carrying the mailbox adapter's configuration.
 *
 * **Example** (Provide the mailbox options)
 *
 * ```ts
 * import { MailboxM365Config, MailboxM365Options } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Options = Layer.succeed(MailboxM365Options, MailboxM365Config.make({ userId: "attorney@example.test" }))
 * console.log(Layer.isLayer(Options)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MailboxM365Options extends Context.Service<MailboxM365Options, MailboxM365Config>()(
  $I`MailboxM365Options`
) {}

const decodeListRequest = S.decodeUnknownEffect(M365ListMessagesRequest);
const decodeGetRequest = S.decodeUnknownEffect(M365GetMessageRequest);
const decodeUpdateRequest = S.decodeUnknownEffect(M365UpdateMessageCategoriesRequest);
const decodeEnsureRequest = S.decodeUnknownEffect(M365EnsureMasterCategoriesRequest);
const decodeAttachmentsRequest = S.decodeUnknownEffect(M365ListMessageAttachmentsRequest);
const decodeDownloadRequest = S.decodeUnknownEffect(M365DownloadMessageAttachmentRequest);

const decodeMessageId = S.decodeUnknownOption(MailMessageId);
const decodeInternetMessageId = S.decodeUnknownOption(InternetMessageId);
const decodeConversationId = S.decodeUnknownOption(MailConversationId);
const decodeAttachmentId = S.decodeUnknownOption(MailAttachmentId);
const decodeAddress = S.decodeUnknownOption(EmailString);
const decodeCursor = S.decodeUnknownOption(MailPageCursor);

// A request the driver's own schema rejects never reaches Graph; it fails the way the driver reports it.
const encoded =
  <Request>(decode: (input: unknown) => Effect.Effect<Request, S.SchemaError>) =>
  (input: unknown): Effect.Effect<Request, M365Error> =>
    Effect.mapError(decode(input), () => M365Error.fromReason("request encoding", { resource: "messages" }));

const statusText = (error: M365Error): string =>
  O.match(error.status, {
    onNone: () => error.reason,
    onSome: (status) => `${error.reason} ${status}`,
  });

// Reason and status only: a driver error also carries the request URL, which names the mailbox.
const portFailure =
  (operation: string) =>
  (error: M365Error): MailTaggingPortError =>
    M365ErrorReason.is.throttled(error.reason)
      ? MailTaggingPortError.throttled("Mailbox", operation, statusText(error))
      : MailTaggingPortError.during("Mailbox", operation, statusText(error));

const hasStatus =
  (status: number) =>
  (error: M365Error): boolean =>
    M365ErrorReason.is["response status"](error.reason) && O.exists(error.status, (actual) => actual === status);

const isStale = hasStatus(preconditionFailed);
const isMissing = hasStatus(notFound);

const addressOf = (recipient: GraphRecipient): O.Option<EmailString> =>
  pipe(
    recipient.emailAddress,
    O.flatMap((emailAddress) => emailAddress.address),
    O.flatMap(decodeAddress)
  );

const recipientsOf = (message: GraphMessage): ReadonlyArray<EmailString> =>
  A.getSomes(
    A.map(
      A.appendAll(
        O.getOrElse(message.toRecipients, (): ReadonlyArray<GraphRecipient> => []),
        O.getOrElse(message.ccRecipients, (): ReadonlyArray<GraphRecipient> => [])
      ),
      addressOf
    )
  );

const senderOf = (message: GraphMessage): O.Option<EmailString> =>
  O.flatMap(
    O.orElse(message.from, () => message.sender),
    addressOf
  );

const envelopeOf = (message: GraphMessage): O.Option<MailEnvelope> =>
  O.map(
    O.all({
      messageId: decodeMessageId(message.id),
      receivedAt: O.flatMap(message.receivedDateTime, DateTime.make),
    }),
    ({ messageId, receivedAt }) =>
      MailEnvelope.make({
        messageId,
        receivedAt,
        internetMessageId: O.flatMap(message.internetMessageId, decodeInternetMessageId),
        conversationId: O.flatMap(message.conversationId, decodeConversationId),
        subject: O.getOrElse(message.subject, () => ""),
        senderAddress: senderOf(message),
        recipientAddresses: recipientsOf(message),
        categories: O.getOrElse(message.categories, (): ReadonlyArray<string> => []),
        hasAttachments: O.getOrElse(message.hasAttachments, () => false),
        changeKey: message.changeKey,
        bodyPreview: message.bodyPreview,
      })
  );

const isInScope =
  (excluded: HashSet.HashSet<string>) =>
  (message: GraphMessage): boolean =>
    !O.getOrElse(message.isDraft, () => false) &&
    !O.exists(message.parentFolderId, (folderId) => HashSet.has(excluded, folderId));

const attachmentMetaOf = (attachment: GraphAttachment): O.Option<MailAttachmentMeta> =>
  O.map(decodeAttachmentId(attachment.id), (attachmentId) =>
    MailAttachmentMeta.make({
      attachmentId,
      name: O.getOrElse(attachment.name, () => ""),
      contentType: attachment.contentType,
      byteLength: O.getOrElse(attachment.size, () => 0),
      isInline: O.getOrElse(attachment.isInline, () => false),
      isFile: O.exists(attachment["@odata.type"], (kind) => kind === fileAttachmentType),
    })
  );

// The caller's edit, replayed on what the message carries now: its removals leave, its additions join.
const replayed = (fresh: ReadonlyArray<string>, request: SetCategoriesRequest): ReadonlyArray<string> =>
  A.union(
    A.difference(fresh, A.difference(request.expected, request.categories)),
    A.difference(request.categories, request.expected)
  );

const makeMailbox = Effect.gen(function* () {
  const m365 = yield* M365;
  const options = yield* MailboxM365Options;
  const userId = options.userId;
  const inScope = isInScope(HashSet.fromIterable(options.excludedFolderIds));

  const listRequest = (request: ListMessagesSinceRequest) =>
    O.match(request.cursor, {
      onNone: () => ({
        userId,
        bodyContentType: "text",
        filter: `receivedDateTime ge ${DateTime.formatIso(request.since)} and isDraft eq false`,
        orderby: "receivedDateTime asc",
        top: options.pageSize,
      }),
      onSome: (nextLink) => ({ userId, bodyContentType: "text", nextLink }),
    });

  const getMessage = (messageId: MailMessageId) =>
    Effect.flatMap(encoded(decodeGetRequest)({ userId, messageId, bodyContentType: "text" }), m365.getMessage);

  const writeCategories = (messageId: MailMessageId, categories: ReadonlyArray<string>, changeKey: O.Option<string>) =>
    Effect.flatMap(
      encoded(decodeUpdateRequest)({
        userId,
        messageId,
        categories: A.filter(categories, Str.isNonEmpty),
        ...O.getSomesStruct({ changeKey: O.filter(changeKey, Str.isNonEmpty) }),
      }),
      m365.updateMessageCategories
    );

  const rewriteOnFresh = Effect.fn("MailboxM365.rewriteOnFresh")(function* (request: SetCategoriesRequest) {
    const fresh = yield* getMessage(request.messageId);
    return yield* writeCategories(
      request.messageId,
      replayed(
        O.getOrElse(fresh.categories, (): ReadonlyArray<string> => []),
        request
      ),
      fresh.changeKey
    );
  });

  return MailboxShape.make({
    listMessagesSince: Effect.fn("MailboxM365.listMessagesSince")(function* (request: ListMessagesSinceRequest) {
      const page = yield* Effect.flatMap(encoded(decodeListRequest)(listRequest(request)), m365.listMessages).pipe(
        Effect.mapError(portFailure("listMessagesSince"))
      );
      return MailPage.make({
        envelopes: A.getSomes(A.map(A.filter(page.value, inScope), envelopeOf)),
        next: O.flatMap(page["@odata.nextLink"], decodeCursor),
      });
    }),
    getEnvelope: (messageId: MailMessageId) =>
      getMessage(messageId).pipe(
        Effect.map(envelopeOf),
        Effect.catchIf(isMissing, () => Effect.succeedNone),
        Effect.mapError(portFailure("getEnvelope"))
      ),
    setCategories: (request: SetCategoriesRequest) =>
      writeCategories(request.messageId, request.categories, request.changeKey).pipe(
        Effect.catchIf(isStale, () => rewriteOnFresh(request)),
        Effect.mapError(portFailure("setCategories")),
        Effect.asVoid
      ),
    ensureMasterCategories: (intents: ReadonlyArray<MasterCategoryIntent>) =>
      Effect.flatMap(
        encoded(decodeEnsureRequest)({
          userId,
          categories: A.map(intents, (intent) => ({ displayName: intent.displayName, color: intent.color })),
        }),
        m365.ensureMasterCategories
      ).pipe(
        Effect.map((ensured) => ensured.created.length),
        Effect.mapError(portFailure("ensureMasterCategories"))
      ),
    listAttachments: (messageId: MailMessageId) =>
      Effect.flatMap(encoded(decodeAttachmentsRequest)({ userId, messageId }), m365.listMessageAttachments).pipe(
        Effect.map((attachments) => A.getSomes(A.map(attachments.value, attachmentMetaOf))),
        Effect.mapError(portFailure("listAttachments"))
      ),
    downloadAttachment: (request: DownloadAttachmentRequest) =>
      Effect.flatMap(
        encoded(decodeDownloadRequest)({ userId, messageId: request.messageId, attachmentId: request.attachmentId }),
        m365.downloadMessageAttachment
      ).pipe(
        Effect.map((content) => content.bytes),
        Effect.mapError(portFailure("downloadAttachment"))
      ),
  });
});

/**
 * Layer providing the mailbox port over the `@beep/m365` driver.
 *
 * **Details**
 *
 * `listMessagesSince` asks Graph for
 * `receivedDateTime ge <since> and isDraft eq false`, ordered by
 * `receivedDateTime asc`, `pageSize` at a time, with the plain-text body
 * format; a later page passes the cursor back as the driver's `nextLink`. A
 * message whose `parentFolderId` is one of `excludedFolderIds`, or that is a
 * draft, is dropped. A message Graph reports without a usable id or without a
 * parseable `receivedDateTime` is skipped and counted nowhere: the job orders
 * and checkpoints by received instant, so it cannot place one.
 *
 * The envelope mapping never fails: the sender is `from`, else `sender`; an
 * address that does not decode becomes no sender or a dropped recipient; a
 * missing subject is empty and missing categories are none. Nothing of a
 * message is logged.
 *
 * `getEnvelope` answers none for a 404. `setCategories` sends the list with
 * the `changeKey` as `If-Match`. On a 412 it reads the message once more and
 * writes, under the fresh key, the fresh categories minus what the caller's
 * edit removed plus what it added, so a category someone changed in between
 * is kept as they left it. A second 412, or a message gone by the re-read,
 * fails the call.
 *
 * `ensureMasterCategories` answers how many categories the driver created.
 * An attachment is a file when its `@odata.type` is
 * `#microsoft.graph.fileAttachment`; a missing size is 0.
 *
 * Every driver failure becomes a `MailTaggingPortError` whose reason is the
 * driver's reason and HTTP status, without the request URL. A throttled
 * driver failure is a `throttled` port failure.
 *
 * **Example** (Wire the mailbox over a configured driver)
 *
 * ```ts
 * import { MailboxM365, MailboxM365Config, MailboxM365Options } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Mailbox = MailboxM365.pipe(
 *   Layer.provide(Layer.succeed(MailboxM365Options, MailboxM365Config.make({ userId: "attorney@example.test" })))
 * )
 * console.log(Layer.isLayer(Mailbox)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailboxM365: Layer.Layer<Mailbox, never, M365 | MailboxM365Options> = Layer.effect(Mailbox, makeMailbox);
