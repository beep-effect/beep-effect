/**
 * Request and response values of the mail-tagging ports and use-cases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  ContentSha256,
  DocumentFileId,
  DocumentFolderId,
  FilingDestination,
  MailAttachmentId,
  MailConversationId,
  MailEnvelope,
  MailMessageId,
  MailTaxonomy,
  MatterIndex,
  MatterIndexEntry,
  MatterKey,
  TaggingMode,
  TaggingPolicy,
  TaggingRunId,
} from "@beep/law-practice-domain/values/MailTagging";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { PosInt } from "../internal/PosInt.ts";

const $I = $LawPracticeUseCasesId.create("MailTagging/MailTagging.values");

const defaultPolicy = TaggingPolicy.pipe(S.withConstructorDefault(Effect.sync(() => TaggingPolicy.make({}))));

/**
 * **Example** (Guard a page cursor)
 *
 * ```ts
 * import { MailPageCursor } from "@beep/law-practice-use-cases/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailPageCursor)("page-2")) // true
 * console.log(S.is(MailPageCursor)("")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MailPageCursor = S.NonEmptyString.pipe(
  S.brand("MailPageCursor"),
  $I.annoteSchema("MailPageCursor", {
    description: "Opaque continuation token of a mailbox listing.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type MailPageCursor = typeof MailPageCursor.Type;

/**
 * **Details**
 *
 * `since` is inclusive: a message received exactly at `since` is listed. The
 * job resumes from the received instant of the last message it processed, so
 * an exclusive bound would drop messages sharing that instant.
 *
 * **Example** (Ask for the first page)
 *
 * ```ts
 * import { ListMessagesSinceRequest } from "@beep/law-practice-use-cases/MailTagging"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const request = ListMessagesSinceRequest.make({ since: DateTime.makeUnsafe("2026-07-01T00:00:00.000Z") })
 * console.log(O.isNone(request.cursor)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ListMessagesSinceRequest extends S.Opaque<ListMessagesSinceRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    since: S.DateTimeUtcFromString.annotateKey({
      description: "Inclusive lower bound on the received instant.",
    }),
    cursor: S.Option(MailPageCursor).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Continuation token of the previous page; none for the first page.",
    }),
  }).pipe(
    $I.annoteSchema("ListMessagesSinceRequest", {
      description: "One page request of the ascending mailbox listing.",
    })
  )
) {}

/**
 * **Example** (Describe the last page)
 *
 * ```ts
 * import { MailPage } from "@beep/law-practice-use-cases/MailTagging"
 * import * as O from "effect/Option"
 *
 * const page = MailPage.make({ envelopes: [] })
 * console.log(O.isNone(page.next)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailPage extends S.Opaque<MailPage, { readonly brand: unique symbol }>()(
  S.Struct({
    envelopes: S.Array(MailEnvelope).annotateKey({
      description: "Envelopes of the page, ascending by received instant.",
    }),
    next: S.Option(MailPageCursor).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Continuation token of the next page; none on the last page.",
    }),
  }).pipe(
    $I.annoteSchema("MailPage", {
      description: "One page of envelopes in ascending received order.",
    })
  )
) {}

/**
 * **Details**
 *
 * The list replaces what the message carries, so a caller sends every category
 * it wants kept: the foreign ones first, in their existing order. `changeKey`
 * is the envelope's version token, passed through so the adapter can detect a
 * concurrent edit; re-reading and retrying is the adapter's concern.
 *
 * `expected` is the list the caller read before it computed `categories`. The
 * difference between the two is the edit the caller means: what `categories`
 * adds to `expected` and what it drops from it. An adapter that finds the
 * message changed underneath replays that edit on the fresh list, so a
 * category someone else added or removed in between is kept as they left it.
 *
 * **Example** (Append an owned category)
 *
 * ```ts
 * import { MailMessageId } from "@beep/law-practice-domain/values/MailTagging"
 * import { SetCategoriesRequest } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const request = SetCategoriesRequest.make({
 *   messageId: MailMessageId.make("msg-0001"),
 *   expected: ["Personal"],
 *   categories: ["Personal", "P: USPTO"]
 * })
 * console.log(request.categories.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetCategoriesRequest extends S.Opaque<SetCategoriesRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    messageId: MailMessageId.annotateKey({
      description: "Message whose categories are replaced.",
    }),
    expected: S.Array(S.String).annotateKey({
      description: "Category list the caller read before computing the new one.",
    }),
    categories: S.Array(S.String).annotateKey({
      description: "Complete category list the message carries afterwards, in order.",
    }),
    changeKey: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Version token the list was computed from; an adapter rejects the write when it is stale.",
    }),
  }).pipe(
    $I.annoteSchema("SetCategoriesRequest", {
      description: "Full-list replacement of one message's categories.",
    })
  )
) {}

/**
 * **Example** (Describe a file attachment)
 *
 * ```ts
 * import { MailAttachmentId } from "@beep/law-practice-domain/values/MailTagging"
 * import { MailAttachmentMeta } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const meta = MailAttachmentMeta.make({
 *   attachmentId: MailAttachmentId.make("att-0001"),
 *   name: "office-action.pdf",
 *   byteLength: 2048,
 *   isInline: false,
 *   isFile: true
 * })
 * console.log(meta.byteLength) // 2048
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailAttachmentMeta extends S.Opaque<MailAttachmentMeta, { readonly brand: unique symbol }>()(
  S.Struct({
    attachmentId: MailAttachmentId.annotateKey({
      description: "Provider id of the attachment.",
    }),
    name: S.String.annotateKey({
      description: "Attachment name as the provider reports it; may be empty.",
    }),
    contentType: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "MIME type, when the provider reports one.",
    }),
    byteLength: S.Natural.annotateKey({
      description: "Size in bytes as the provider reports it.",
    }),
    isInline: S.Boolean.annotateKey({
      description: "Whether the part is rendered inside the body.",
    }),
    isFile: S.Boolean.annotateKey({
      description: "Whether the part is a file rather than an attached item or a link.",
    }),
  }).pipe(
    $I.annoteSchema("MailAttachmentMeta", {
      description: "Metadata of one attachment, read before any download.",
    })
  )
) {}

/**
 * **Example** (Address an attachment)
 *
 * ```ts
 * import { MailAttachmentId, MailMessageId } from "@beep/law-practice-domain/values/MailTagging"
 * import { DownloadAttachmentRequest } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const request = DownloadAttachmentRequest.make({
 *   messageId: MailMessageId.make("msg-0001"),
 *   attachmentId: MailAttachmentId.make("att-0001")
 * })
 * console.log(request.attachmentId) // "att-0001"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DownloadAttachmentRequest extends S.Opaque<DownloadAttachmentRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    messageId: MailMessageId.annotateKey({
      description: "Message that carries the attachment.",
    }),
    attachmentId: MailAttachmentId.annotateKey({
      description: "Attachment to download.",
    }),
  }).pipe(
    $I.annoteSchema("DownloadAttachmentRequest", {
      description: "Address of one attachment's bytes.",
    })
  )
) {}

/**
 * **Example** (Address the USPTO correspondence folder)
 *
 * ```ts
 * import { MatterKey } from "@beep/law-practice-domain/values/MailTagging"
 * import { MatterFolderRequest } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const request = MatterFolderRequest.make({
 *   matterKey: MatterKey.make("acme.10001"),
 *   destination: "uspto-incoming"
 * })
 * console.log(request.destination) // "uspto-incoming"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterFolderRequest extends S.Opaque<MatterFolderRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    matterKey: MatterKey.annotateKey({
      description: "Matter whose folder is wanted; resolved by family key, never by client name.",
    }),
    destination: FilingDestination.annotateKey({
      description: "Subfolder of the matter the attachment is routed to.",
    }),
  }).pipe(
    $I.annoteSchema("MatterFolderRequest", {
      description: "Address of one filing subfolder of one matter.",
    })
  )
) {}

/**
 * **Example** (Describe an upload)
 *
 * ```ts
 * import { DocumentFolderId } from "@beep/law-practice-domain/values/MailTagging"
 * import { UploadDocumentRequest } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const request = UploadDocumentRequest.make({
 *   folderId: DocumentFolderId.make("folder-10001"),
 *   fileName: "2026-07-01 office-action.pdf",
 *   bytes: Uint8Array.of(1, 2, 3)
 * })
 * console.log(request.bytes.byteLength) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UploadDocumentRequest extends S.Opaque<UploadDocumentRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    folderId: DocumentFolderId.annotateKey({
      description: "Folder the file is created in.",
    }),
    fileName: S.NonEmptyString.annotateKey({
      description: "Name of the new file; the store refuses a name that already exists.",
    }),
    contentType: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "MIME type, when known.",
    }),
    bytes: S.Uint8Array.annotateKey({
      description: "Content of the new file.",
    }),
  }).pipe(
    $I.annoteSchema("UploadDocumentRequest", {
      description: "One new file for a matter's document folder.",
    })
  )
) {}

/**
 * **Example** (Report a created file)
 *
 * ```ts
 * import { DocumentFileId } from "@beep/law-practice-domain/values/MailTagging"
 * import { DocumentUploaded } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const result = DocumentUploaded.make({ fileId: DocumentFileId.make("file-0001") })
 * console.log(result._tag) // "DocumentUploaded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentUploaded extends S.Opaque<DocumentUploaded, { readonly brand: unique symbol }>()(
  S.TaggedStruct("DocumentUploaded", {
    fileId: DocumentFileId.annotateKey({
      description: "Id of the file the upload created.",
    }),
  }).pipe(
    $I.annoteSchema("DocumentUploaded", {
      description: "Outcome of an upload that created the file.",
    })
  )
) {}

/**
 * **Details**
 *
 * Document stores that report a content hash for a name conflict report
 * SHA-1. It is used only to recognize a file as the attachment that was
 * uploaded; the filing ledger's own identity stays SHA-256.
 *
 * **Example** (Guard a SHA-1 digest)
 *
 * ```ts
 * import { ContentSha1 } from "@beep/law-practice-use-cases/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ContentSha1)("da39a3ee5e6b4b0d3255bfef95601890afd80709")) // true
 * console.log(S.is(ContentSha1)("DA39A3EE")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContentSha1 = S.String.check(
  S.isPattern(
    /^[0-9a-f]{40}$/u,
    $I.annote("ContentSha1PatternCheck", {
      title: "Content SHA-1",
      description: "A SHA-1 digest as exactly 40 lowercase hexadecimal characters.",
      message: "Content SHA-1 must be 40 lowercase hexadecimal characters.",
    })
  )
).pipe(
  S.brand("ContentSha1"),
  $I.annoteSchema("ContentSha1", {
    description: "SHA-1 of a stored file's bytes as 40 lowercase hex characters.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type ContentSha1 = typeof ContentSha1.Type;

/**
 * **Details**
 *
 * A store reports what it can: always the id, and the size and SHA-1 when it
 * has them. The filer treats the holder as its own earlier upload only when a
 * reported hash, or failing that a reported size, matches the attachment.
 *
 * **Example** (Describe a holder by id only)
 *
 * ```ts
 * import { DocumentFileId } from "@beep/law-practice-domain/values/MailTagging"
 * import { ExistingDocument } from "@beep/law-practice-use-cases/MailTagging"
 * import * as O from "effect/Option"
 *
 * const holder = ExistingDocument.make({ fileId: DocumentFileId.make("file-0001") })
 * console.log(O.isNone(holder.contentSha1)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExistingDocument extends S.Opaque<ExistingDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    fileId: DocumentFileId.annotateKey({
      description: "Id of the file holding the name.",
    }),
    byteLength: S.Option(S.Natural).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Size of the holder in bytes, when the store reports it.",
    }),
    contentSha1: S.Option(ContentSha1).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "SHA-1 of the holder's bytes, when the store reports it.",
    }),
  }).pipe(
    $I.annoteSchema("ExistingDocument", {
      description: "What a document store says about the file that already holds a name.",
    })
  )
) {}

/**
 * Outcome of an upload the store refused because the folder already has a
 * file of that name; nothing was written.
 *
 * **Details**
 *
 * `existing` describes the file holding the name, when the store can tell.
 * The filer needs it to decide whether that file is an upload of its own that
 * landed before its ledger line did.
 *
 * **Example** (Report a held name)
 *
 * ```ts
 * import { DocumentNameTaken } from "@beep/law-practice-use-cases/MailTagging"
 * import * as O from "effect/Option"
 *
 * const result = DocumentNameTaken.make({})
 * console.log(O.isNone(result.existing)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentNameTaken extends S.Opaque<DocumentNameTaken, { readonly brand: unique symbol }>()(
  S.TaggedStruct("DocumentNameTaken", {
    existing: S.Option(ExistingDocument).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "The file that already holds the name, when the store describes it.",
    }),
  }).pipe(
    $I.annoteSchema("DocumentNameTaken", {
      description: "Outcome of an upload refused because the name already exists in the folder.",
    })
  )
) {}

/**
 * **Example** (Match an upload result)
 *
 * ```ts
 * import { DocumentNameTaken, DocumentUploadResult } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const outcome = DocumentUploadResult.match(DocumentNameTaken.make({}), {
 *   DocumentUploaded: () => "created",
 *   DocumentNameTaken: () => "name taken"
 * })
 * console.log(outcome) // "name taken"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentUploadResult = S.Union([DocumentUploaded, DocumentNameTaken]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DocumentUploadResult", {
    description: "What a create-only upload answers: the new file, or the name being taken.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type DocumentUploadResult = typeof DocumentUploadResult.Type;

/**
 * Question put to the known-documents index: is this content already in the
 * document system for this matter.
 *
 * **Example** (Ask about one hash)
 *
 * ```ts
 * import { ContentSha256, MatterKey } from "@beep/law-practice-domain/values/MailTagging"
 * import { KnownDocumentRequest } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const request = KnownDocumentRequest.make({
 *   contentSha256: ContentSha256.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   matterKey: MatterKey.make("acme.10001")
 * })
 * console.log(request.matterKey) // "acme.10001"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnownDocumentRequest extends S.Opaque<KnownDocumentRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    contentSha256: ContentSha256.annotateKey({
      description: "SHA-256 of the content in question.",
    }),
    matterKey: MatterKey.annotateKey({
      description: "Matter the content would be filed under.",
    }),
  }).pipe(
    $I.annoteSchema("KnownDocumentRequest", {
      description: "Content hash and matter to look up in the known-documents index.",
    })
  )
) {}

/**
 * **Example** (Build a context with the default policy)
 *
 * ```ts
 * import { MatterIndex, defaultMailTaxonomy } from "@beep/law-practice-domain/values/MailTagging"
 * import { MatterTaggerContext } from "@beep/law-practice-use-cases/MailTagging"
 * import * as DateTime from "effect/DateTime"
 *
 * const context = MatterTaggerContext.make({
 *   index: MatterIndex.make({ entries: [], builtAt: DateTime.makeUnsafe("2026-07-01T00:00:00.000Z") }),
 *   taxonomy: defaultMailTaxonomy([])
 * })
 * console.log(context.policy.confidenceThreshold) // 0.8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterTaggerContext extends S.Opaque<MatterTaggerContext, { readonly brand: unique symbol }>()(
  S.Struct({
    index: MatterIndex.annotateKey({
      description: "Snapshot of every taggable matter.",
    }),
    taxonomy: MailTaxonomy.annotateKey({
      description: "Taxonomy whose rule intents assign practice categories.",
    }),
    policy: defaultPolicy.annotateKey({
      description: "Thresholds that turn candidates into a decision.",
    }),
    conversationMatters: S.HashMap(MailConversationId, MatterKey)
      .pipe(S.withConstructorDefault(Effect.sync(() => HashMap.empty<MailConversationId, MatterKey>())))
      .annotateKey({
        description: "Matter each already-tagged conversation belongs to.",
      }),
  }).pipe(
    $I.annoteSchema("MatterTaggerContext", {
      description: "Everything the pure tagger reads besides the message itself.",
    })
  )
) {}

/**
 * **Example** (Plan the filing of one message)
 *
 * ```ts
 * import {
 *   MailEnvelope,
 *   MailMessageId,
 *   MatterClientKey,
 *   MatterIndexEntry,
 *   MatterKey,
 *   TaggingRunId,
 *   defaultMailTaxonomy
 * } from "@beep/law-practice-domain/values/MailTagging"
 * import { FileAttachmentsRequest } from "@beep/law-practice-use-cases/MailTagging"
 * import * as DateTime from "effect/DateTime"
 *
 * const matterKey = MatterKey.make("acme.10001")
 * const request = FileAttachmentsRequest.make({
 *   envelope: MailEnvelope.make({
 *     messageId: MailMessageId.make("msg-0001"),
 *     subject: "Office action",
 *     receivedAt: DateTime.makeUnsafe("2026-07-01T12:00:00.000Z"),
 *     hasAttachments: true
 *   }),
 *   matter: MatterIndexEntry.make({ matterKey, clientKey: MatterClientKey.make("acme") }),
 *   taxonomy: defaultMailTaxonomy([matterKey]),
 *   senderIsExclusiveContact: false,
 *   mode: "dry-run",
 *   runId: TaggingRunId.make("run-0001")
 * })
 * console.log(request.policy.maxAttachmentBytes) // 52428800
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileAttachmentsRequest extends S.Opaque<FileAttachmentsRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    envelope: MailEnvelope.annotateKey({
      description: "Matched message whose attachments are filed.",
    }),
    matter: MatterIndexEntry.annotateKey({
      description: "Index entry of the matter the message was matched to; its contacts route client mail.",
    }),
    taxonomy: MailTaxonomy.annotateKey({
      description: "Taxonomy whose USPTO rule routes office mail.",
    }),
    senderIsExclusiveContact: S.Boolean.annotateKey({
      description: "Whether the sender is a contact address of the matched matter and of no other matter in the index.",
    }),
    mode: TaggingMode.annotateKey({
      description: "Whether to upload or only count.",
    }),
    runId: TaggingRunId.annotateKey({
      description: "Run the filing belongs to.",
    }),
    policy: defaultPolicy.annotateKey({
      description: "Policy carrying the attachment size cap.",
    }),
  }).pipe(
    $I.annoteSchema("FileAttachmentsRequest", {
      description: "Request to file the attachments of one matched message.",
    })
  )
) {}

/**
 * **Example** (Plan a bounded dry run)
 *
 * ```ts
 * import { TaggingRunId } from "@beep/law-practice-domain/values/MailTagging"
 * import { RunMailTaggingRequest } from "@beep/law-practice-use-cases/MailTagging"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const request = RunMailTaggingRequest.make({
 *   mode: "dry-run",
 *   since: DateTime.makeUnsafe("2026-07-01T00:00:00.000Z"),
 *   runId: TaggingRunId.make("run-0001"),
 *   maxPages: O.some(2)
 * })
 * console.log(request.policy.ambiguityMargin) // 0.15
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunMailTaggingRequest extends S.Opaque<RunMailTaggingRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: TaggingMode.annotateKey({
      description: "Whether the run only reports or also writes.",
    }),
    since: S.DateTimeUtcFromString.annotateKey({
      description: "Instant the scan starts from when no checkpoint exists.",
    }),
    policy: defaultPolicy.annotateKey({
      description: "Thresholds and the attachment size cap.",
    }),
    runId: TaggingRunId.annotateKey({
      description: "Unique id of this run; ledger lines and undo are keyed by it.",
    }),
    maxPages: S.Option(PosInt).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Upper bound on pages read in this run; none reads to the end.",
    }),
  }).pipe(
    $I.annoteSchema("RunMailTaggingRequest", {
      description: "Request to tag the mailbox from an instant onwards.",
    })
  )
) {}

/**
 * **Example** (Plan an undo)
 *
 * ```ts
 * import { TaggingRunId } from "@beep/law-practice-domain/values/MailTagging"
 * import { UndoMailTaggingRequest } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const request = UndoMailTaggingRequest.make({
 *   originalRunId: TaggingRunId.make("run-0001"),
 *   runId: TaggingRunId.make("undo-0001"),
 *   mode: "dry-run"
 * })
 * console.log(request.originalRunId) // "run-0001"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UndoMailTaggingRequest extends S.Opaque<UndoMailTaggingRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    originalRunId: TaggingRunId.annotateKey({
      description: "Run whose additions are taken back.",
    }),
    runId: TaggingRunId.annotateKey({
      description: "Unique id of the undo run.",
    }),
    mode: TaggingMode.annotateKey({
      description: "Whether the undo only reports or also writes.",
    }),
  }).pipe(
    $I.annoteSchema("UndoMailTaggingRequest", {
      description: "Request to take back the categories one run added.",
    })
  )
) {}
