/**
 * The attachment filer: sender-routed, content-deduplicated, create-only
 * filing of one matched message's attachments into its matter's folders.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ContentSha256,
  emptyTaggingRunReport,
  FilingAbandoned,
  FilingAbandonReason,
  FilingDestination,
  FilingIntent,
  FilingLedgerEntry,
  PracticeCategory,
  TaggingMode,
  TaggingRunReport,
} from "@beep/law-practice-domain/values/MailTagging";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import { Effect, flow, Ref } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MailTaggingPortError } from "./MailTagging.errors.ts";
import { completedFilings, pendingFilingIntents } from "./MailTagging.ledger.ts";
import {
  AttachmentFilerShape,
  DocumentStore,
  FilingLedger,
  KnownDocuments,
  Mailbox,
  MatterFolderDirectory,
} from "./MailTagging.ports.ts";
import { senderRuleCategories } from "./MailTagging.tagger.ts";
import {
  DocumentUploadResult,
  DownloadAttachmentRequest,
  KnownDocumentRequest,
  MatterFolderRequest,
  UploadDocumentRequest,
} from "./MailTagging.values.ts";
import type {
  AttachmentSkipReason,
  DocumentFileId,
  DocumentFolderId,
  MatterKey,
  TaggingPolicy,
  TaggingRunId,
} from "@beep/law-practice-domain/values/MailTagging";
import type { MailTaggingStateError } from "./MailTagging.errors.ts";
import type { FileAttachmentsRequest, MailAttachmentMeta } from "./MailTagging.values.ts";

type FiledContent = Pick<FilingLedgerEntry, "contentSha256" | "matterKey" | "fileName">;

type Placement = Pick<FilingIntent, "destination" | "folderId" | "fileName">;

type FilingState = {
  readonly report: TaggingRunReport;
  readonly completed: ReadonlyArray<FiledContent>;
  readonly pending: ReadonlyArray<FilingIntent>;
};

type FilingTarget = {
  readonly request: FileAttachmentsRequest;
  readonly destination: FilingDestination;
  readonly folderId: DocumentFolderId;
};

type Payload = {
  readonly meta: MailAttachmentMeta;
  readonly bytes: Uint8Array;
  readonly content: FiledContent;
};

type Outcome = "attachmentsFiled" | "attachmentsDeduped" | "attachmentsReconciled";

type FilingError = MailTaggingPortError | MailTaggingStateError;

const unsafeNamePattern = /[\p{Cc}<>:"/\\|?*]+/gu;
const whitespaceRunPattern = /\s+/gu;
const shortHashLength = 8;

const sanitizedName: (name: string) => string = flow(
  Str.replaceAll(unsafeNamePattern, "_"),
  Str.replaceAll(whitespaceRunPattern, " "),
  Str.trim,
  O.liftPredicate(Str.isNonEmpty),
  O.getOrElse(() => "attachment")
);

const datedName = (request: FileAttachmentsRequest, meta: MailAttachmentMeta): string =>
  `${DateTime.formatIsoDateUtc(request.envelope.receivedAt)} ${sanitizedName(meta.name)}`;

const withShortHash = (fileName: string, contentSha256: ContentSha256): string => {
  const tag = ` (${Str.takeLeft(contentSha256, shortHashLength)})`;
  return O.match(Str.lastIndexOf(".")(fileName), {
    onNone: () => `${fileName}${tag}`,
    onSome: (index) => `${Str.slice(0, index)(fileName)}${tag}${Str.slice(index)(fileName)}`,
  });
};

const isNameTaken = (known: ReadonlyArray<FiledContent>, matterKey: MatterKey, fileName: string): boolean =>
  A.some(known, (filed) => filed.matterKey === matterKey && filed.fileName === fileName);

const freeName = (known: ReadonlyArray<FiledContent>, content: FiledContent): string =>
  isNameTaken(known, content.matterKey, content.fileName)
    ? withShortHash(content.fileName, content.contentSha256)
    : content.fileName;

// The name to try first, then the short-hash name once, when it is a different name.
const candidateNames = (first: string, content: FiledContent): ReadonlyArray<string> =>
  A.dedupe([first, withShortHash(content.fileName, content.contentSha256)]);

const isUsptoSender = (request: FileAttachmentsRequest): boolean =>
  A.contains(senderRuleCategories(request.taxonomy, request.envelope), PracticeCategory.Enum["P: USPTO"]);

const destinationOf = (request: FileAttachmentsRequest): O.Option<FilingDestination> =>
  isUsptoSender(request)
    ? O.some(FilingDestination.Enum["uspto-incoming"])
    : O.liftPredicate(FilingDestination.Enum["from-client"], () => request.senderIsExclusiveContact);

const skipChecks: ReadonlyArray<
  readonly [AttachmentSkipReason, (meta: MailAttachmentMeta, policy: TaggingPolicy) => boolean]
> = [
  ["inline", (meta) => meta.isInline],
  ["not-a-file", (meta) => !meta.isFile],
  ["empty", (meta) => meta.byteLength === 0],
  ["too-large", (meta, policy) => meta.byteLength > policy.maxAttachmentBytes],
];

const skipReason = (meta: MailAttachmentMeta, policy: TaggingPolicy): O.Option<AttachmentSkipReason> =>
  O.map(
    A.findFirst(skipChecks, ([, applies]) => applies(meta, policy)),
    ([reason]) => reason
  );

const skipping = (report: TaggingRunReport, reason: AttachmentSkipReason, count: number): TaggingRunReport =>
  TaggingRunReport.make({
    ...report,
    attachmentsSkipped: { ...report.attachmentsSkipped, [reason]: report.attachmentsSkipped[reason] + count },
  });

const skipped = (state: FilingState, reason: AttachmentSkipReason): FilingState => ({
  ...state,
  report: skipping(state.report, reason, 1),
});

const isSameContent =
  (content: FiledContent) =>
  (other: FiledContent): boolean =>
    other.matterKey === content.matterKey && other.contentSha256 === content.contentSha256;

const tallied = (report: TaggingRunReport, outcome: Outcome, wrote: boolean): TaggingRunReport =>
  TaggingRunReport.make({ ...report, [outcome]: report[outcome] + 1, wrote: report.wrote || wrote });

const deduped = (state: FilingState): FilingState => ({
  ...state,
  report: tallied(state.report, "attachmentsDeduped", false),
});

// Content that is stored (or, in a dry run, would be) stops being pending and starts deduplicating.
const settled = (state: FilingState, content: FiledContent, outcome: Outcome, wrote: boolean): FilingState => ({
  report: tallied(state.report, outcome, wrote),
  completed: A.append(state.completed, content),
  pending: A.filter(state.pending, (intent) => !isSameContent(content)(intent)),
});

const nameHeld = (reason: string) => Effect.fail(MailTaggingPortError.during("DocumentStore", "upload", reason));

const decodeContentHash = S.decodeEffect(Sha256HexFromBytes);

/**
 * Builds the attachment filer over the mailbox, the matter-folder directory,
 * the document store, the known-documents index, and the filing ledger.
 *
 * **Details**
 *
 * The sender picks the destination. A sender the taxonomy's USPTO rule
 * matches files to `uspto-incoming`; a sender the request marks as an
 * exclusive contact (a contact address of the matched matter and of no other
 * matter) files to `from-client`; any other sender, including an address
 * shared by two matters, skips every attachment as `sender-not-routable` and
 * downloads nothing. A destination
 * without a folder skips every attachment as `no-folder`.
 *
 * Inline parts, non-file attachments, zero-byte parts, and parts larger than
 * the policy's `maxAttachmentBytes` are skipped from their metadata, before
 * any download. Everything else is downloaded and hashed with SHA-256.
 *
 * Content with a completion line in the filing ledger for the same matter is
 * counted as deduplicated and not uploaded, whichever destination it went to.
 * Content with neither a completion nor a pending intent is then looked up in
 * the known-documents index: a hit is counted as deduplicated too, with no
 * intent line, no upload, and no completion, in either mode. A pending intent
 * is resumed without asking the index, because the index may already list the
 * file that intent's own interrupted upload created.
 * A new file is named `<UTC received date> <sanitized original name>`. When a
 * completion or a pending intent already has that name in the matter with
 * different content, the first eight hex characters of the hash go before the
 * extension, so a new upload never targets a name the ledger knows.
 *
 * Filing is two-phase in `apply`. New content appends a `FilingIntended` line
 * first, then uploads, then appends the `FilingCompleted` line. When that
 * first upload finds its name taken, the name belongs to a file this ledger
 * never stored: the filer appends a `FilingAbandoned` line for the intent and
 * tries once more under the short-hash name, with a new intent. If that name
 * is taken as well it is abandoned too and the filer fails with a
 * `DocumentStore` port error.
 *
 * Because every name-taken outcome of a first attempt is abandoned, a pending
 * intent can only come from a run that stopped between its intent line and
 * its completion line, never from a known foreign-file collision. The next
 * run finds the pending intent and uploads to the intent's own folder and
 * name instead of computing a new one. The store then answers one of three
 * ways. It created the file: the earlier upload never landed, and the
 * completion is recorded as filed. It reports the name taken and identifies
 * the file: the earlier upload landed, and the completion is recorded with
 * that id and `reconciled: true`, counted as `attachmentsReconciled`. It
 * reports the name taken without an id: the filer fails with a
 * `DocumentStore` port error, because it cannot prove which file holds the
 * name.
 *
 * `dry-run` counts new content as filed and a pending intent as reconciled,
 * calls nothing, and writes nothing; it remembers what it would have stored
 * per run id, in memory, so duplicates across the messages of one dry run are
 * counted the way `apply` would count them. That memory is read by dry runs
 * only.
 *
 * **Gotchas**
 *
 * The port cannot read a stored file's content. If someone creates a file
 * under exactly the intended name between an interrupted attempt and its
 * retry, the retry records that foreign file as this attachment. Nothing
 * filed is ever undone here: the port has no delete verb.
 *
 * **Example** (Reference the filer constructor)
 *
 * ```ts
 * import { makeAttachmentFiler } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeAttachmentFiler)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeAttachmentFiler: Effect.Effect<
  AttachmentFilerShape,
  never,
  Mailbox | MatterFolderDirectory | DocumentStore | KnownDocuments | FilingLedger | Crypto.Crypto
> = Effect.gen(function* () {
  const mailbox = yield* Mailbox;
  const folders = yield* MatterFolderDirectory;
  const documents = yield* DocumentStore;
  const knownDocuments = yield* KnownDocuments;
  const ledger = yield* FilingLedger;
  const crypto = yield* Crypto.Crypto;
  const planned = yield* Ref.make(HashMap.empty<TaggingRunId, ReadonlyArray<FiledContent>>());

  const contentHash = Effect.fn("AttachmentFiler.contentHash")(function* (
    bytes: Uint8Array
  ): Effect.fn.Return<ContentSha256, MailTaggingPortError> {
    const digest = yield* decodeContentHash(bytes).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError(() => MailTaggingPortError.during("ContentHasher", "sha256", "SHA-256 digest failed"))
    );
    return ContentSha256.make(digest);
  });

  const upload = (placement: Placement, payload: Payload) =>
    documents.upload(
      UploadDocumentRequest.make({
        folderId: placement.folderId,
        fileName: placement.fileName,
        contentType: payload.meta.contentType,
        bytes: payload.bytes,
      })
    );

  const lineFields = (target: FilingTarget, payload: Payload, placement: Placement, recordedAt: DateTime.Utc) => ({
    runId: target.request.runId,
    contentSha256: payload.content.contentSha256,
    matterKey: payload.content.matterKey,
    destination: placement.destination,
    folderId: placement.folderId,
    fileName: placement.fileName,
    messageId: target.request.envelope.messageId,
    attachmentId: payload.meta.attachmentId,
    byteLength: payload.bytes.byteLength,
    recordedAt,
  });

  const complete = Effect.fn("AttachmentFiler.complete")(function* (
    target: FilingTarget,
    payload: Payload,
    placement: Placement,
    stored: { readonly fileId: DocumentFileId; readonly reconciled: boolean }
  ): Effect.fn.Return<void, FilingError> {
    const recordedAt = yield* DateTime.now;
    yield* ledger.append(FilingLedgerEntry.make({ ...lineFields(target, payload, placement, recordedAt), ...stored }));
  });

  const reconcile = Effect.fn("AttachmentFiler.reconcile")(function* (
    target: FilingTarget,
    state: FilingState,
    payload: Payload,
    intent: FilingIntent
  ): Effect.fn.Return<FilingState, FilingError> {
    const result = yield* upload(intent, payload);
    return yield* DocumentUploadResult.match(result, {
      DocumentUploaded: ({ fileId }) =>
        Effect.as(
          complete(target, payload, intent, { fileId, reconciled: false }),
          settled(state, payload.content, "attachmentsFiled", true)
        ),
      DocumentNameTaken: ({ existingFileId }) =>
        O.match(existingFileId, {
          onNone: () => nameHeld("the intended name is held by a file the store did not identify"),
          onSome: (fileId) =>
            Effect.as(
              complete(target, payload, intent, { fileId, reconciled: true }),
              settled(state, payload.content, "attachmentsReconciled", true)
            ),
        }),
    });
  });

  const abandon = Effect.fn("AttachmentFiler.abandon")(function* (
    target: FilingTarget,
    payload: Payload,
    placement: Placement
  ): Effect.fn.Return<void, FilingError> {
    const recordedAt = yield* DateTime.now;
    yield* ledger.append(
      FilingAbandoned.make({
        runId: target.request.runId,
        contentSha256: payload.content.contentSha256,
        matterKey: payload.content.matterKey,
        folderId: placement.folderId,
        fileName: placement.fileName,
        reason: FilingAbandonReason.Enum["name-taken"],
        recordedAt,
      })
    );
  });

  // One two-phase attempt under one name; answers whether the file was stored.
  const attempt = Effect.fn("AttachmentFiler.attempt")(function* (
    target: FilingTarget,
    payload: Payload,
    fileName: string
  ): Effect.fn.Return<boolean, FilingError> {
    const placement = { destination: target.destination, folderId: target.folderId, fileName };
    const recordedAt = yield* DateTime.now;
    yield* ledger.append(FilingIntent.make(lineFields(target, payload, placement, recordedAt)));
    const result = yield* upload(placement, payload);
    return yield* DocumentUploadResult.match(result, {
      DocumentUploaded: ({ fileId }) =>
        Effect.as(complete(target, payload, placement, { fileId, reconciled: false }), true),
      DocumentNameTaken: () => Effect.as(abandon(target, payload, placement), false),
    });
  });

  const fileFresh: (
    target: FilingTarget,
    state: FilingState,
    payload: Payload,
    names: ReadonlyArray<string>
  ) => Effect.Effect<FilingState, FilingError> = (target, state, payload, names) =>
    A.matchLeft(names, {
      onEmpty: () => nameHeld("every candidate name is held by a file the ledger did not store"),
      onNonEmpty: (fileName, rest) =>
        Effect.flatMap(attempt(target, payload, fileName), (stored) =>
          stored
            ? Effect.succeed(settled(state, { ...payload.content, fileName }, "attachmentsFiled", true))
            : fileFresh(target, state, payload, rest)
        ),
    });

  const resume = (target: FilingTarget, state: FilingState, payload: Payload, intent: FilingIntent) =>
    TaggingMode.is.apply(target.request.mode)
      ? reconcile(target, state, payload, intent)
      : Effect.succeed(settled(state, payload.content, "attachmentsReconciled", false));

  // Content the document system already holds is settled before any intent is written.
  const beginUnlessKnown = Effect.fn("AttachmentFiler.beginUnlessKnown")(function* (
    target: FilingTarget,
    state: FilingState,
    payload: Payload
  ): Effect.fn.Return<FilingState, FilingError> {
    const known = yield* knownDocuments.has(
      KnownDocumentRequest.make({
        contentSha256: payload.content.contentSha256,
        matterKey: payload.content.matterKey,
      })
    );
    return known ? deduped(state) : yield* begin(target, state, payload);
  });

  const begin = (target: FilingTarget, state: FilingState, payload: Payload) => {
    const first = freeName(A.appendAll(state.completed, state.pending), payload.content);
    return TaggingMode.is.apply(target.request.mode)
      ? fileFresh(target, state, payload, candidateNames(first, payload.content))
      : Effect.succeed(settled(state, { ...payload.content, fileName: first }, "attachmentsFiled", false));
  };

  const fileContent = Effect.fn("AttachmentFiler.fileContent")(function* (
    target: FilingTarget,
    state: FilingState,
    meta: MailAttachmentMeta
  ): Effect.fn.Return<FilingState, FilingError> {
    const { envelope, matter } = target.request;
    const bytes = yield* mailbox.downloadAttachment(
      DownloadAttachmentRequest.make({ messageId: envelope.messageId, attachmentId: meta.attachmentId })
    );
    const contentSha256 = yield* contentHash(bytes);
    const content = { contentSha256, matterKey: matter.matterKey, fileName: datedName(target.request, meta) };
    const payload = { meta, bytes, content };
    if (A.some(state.completed, isSameContent(content))) {
      return deduped(state);
    }
    return yield* O.match(A.findFirst(state.pending, isSameContent(content)), {
      onNone: () => beginUnlessKnown(target, state, payload),
      onSome: (intent) => resume(target, state, payload, intent),
    });
  });

  const fileOne = (target: FilingTarget) => (state: FilingState, meta: MailAttachmentMeta) =>
    O.match(skipReason(meta, target.request.policy), {
      onNone: () => fileContent(target, state, meta),
      onSome: (reason) => Effect.succeed(skipped(state, reason)),
    });

  const fileInto = Effect.fn("AttachmentFiler.fileInto")(function* (
    target: FilingTarget,
    metas: ReadonlyArray<MailAttachmentMeta>,
    report: TaggingRunReport
  ): Effect.fn.Return<TaggingRunReport, FilingError> {
    const { mode, runId } = target.request;
    const dryRun = TaggingMode.is["dry-run"](mode);
    const records = yield* ledger.records;
    const recorded = completedFilings(records);
    const plannedByRun = yield* Ref.get(planned);
    // What a dry run would have stored counts only for that dry run, never for an apply.
    const foreseen = dryRun ? O.getOrElse(HashMap.get(plannedByRun, runId), () => []) : [];
    const state = yield* Effect.reduce(
      metas,
      (): FilingState => ({
        report,
        completed: A.appendAll<FiledContent, FiledContent>(recorded, foreseen),
        pending: pendingFilingIntents(records),
      }),
      fileOne(target)
    );
    if (dryRun) {
      yield* Ref.update(planned, (byRun) => HashMap.set(byRun, runId, A.drop(state.completed, recorded.length)));
    }
    return state.report;
  });

  const fileTo = Effect.fn("AttachmentFiler.fileTo")(function* (
    request: FileAttachmentsRequest,
    destination: FilingDestination,
    metas: ReadonlyArray<MailAttachmentMeta>,
    report: TaggingRunReport
  ): Effect.fn.Return<TaggingRunReport, FilingError> {
    const folder = yield* folders.folderFor(
      MatterFolderRequest.make({ matterKey: request.matter.matterKey, destination })
    );
    return yield* O.match(folder, {
      onNone: () => Effect.succeed(skipping(report, "no-folder", metas.length)),
      onSome: (folderId) => fileInto({ request, destination, folderId }, metas, report),
    });
  });

  return AttachmentFilerShape.make({
    file: Effect.fn("AttachmentFiler.file")(function* (request: FileAttachmentsRequest) {
      const metas = yield* mailbox.listAttachments(request.envelope.messageId);
      const report = emptyTaggingRunReport(request.mode, request.runId);
      return yield* O.match(destinationOf(request), {
        onNone: () => Effect.succeed(skipping(report, "sender-not-routable", metas.length)),
        onSome: (destination) => fileTo(request, destination, metas, report),
      });
    }),
  });
});
