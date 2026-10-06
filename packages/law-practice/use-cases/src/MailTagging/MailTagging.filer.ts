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
import * as Hex from "effect/encoding/Hex";
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
  Mailbox,
  MatterFolderDirectory,
} from "./MailTagging.ports.ts";
import { senderRuleCategories } from "./MailTagging.tagger.ts";
import {
  DocumentUploadResult,
  DownloadAttachmentRequest,
  MatterFolderRequest,
  UploadDocumentRequest,
} from "./MailTagging.values.ts";
import type {
  AttachmentSkipReason,
  DocumentFileId,
  DocumentFolderId,
  FilingAbandonReason,
  MatterKey,
  TaggingPolicy,
  TaggingRunId,
} from "@beep/law-practice-domain/values/MailTagging";
import type { MailTaggingStateError } from "./MailTagging.errors.ts";
import type { ExistingDocument, FileAttachmentsRequest, MailAttachmentMeta } from "./MailTagging.values.ts";

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

const shortHashNames = (content: FiledContent): ReadonlyArray<string> => [
  withShortHash(content.fileName, content.contentSha256),
];

// The name to try first, then the short-hash name once, when it is a different name.
const candidateNames = (first: string, content: FiledContent): ReadonlyArray<string> =>
  A.dedupe(A.prepend(shortHashNames(content), first));

const isUsptoSender = (request: FileAttachmentsRequest): boolean =>
  A.contains(senderRuleCategories(request.taxonomy, request.envelope), PracticeCategory.Enum["P: USPTO"]);

const isMatterContact = (request: FileAttachmentsRequest): boolean =>
  A.some(O.toArray(request.envelope.senderAddress), (address) => A.contains(request.matter.contactAddresses, address));

const destinationOf = (request: FileAttachmentsRequest): O.Option<FilingDestination> =>
  isUsptoSender(request)
    ? O.some(FilingDestination.Enum["uspto-incoming"])
    : O.liftPredicate(FilingDestination.Enum["from-client"], () => isMatterContact(request));

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

const hashFailed = (operation: "sha256" | "sha1") => () =>
  MailTaggingPortError.during("ContentHasher", operation, `${operation} digest failed`);

/**
 * Builds the attachment filer over the mailbox, the matter-folder directory,
 * the document store, and the filing ledger.
 *
 * **Details**
 *
 * The sender picks the destination. A sender the taxonomy's USPTO rule
 * matches files to `uspto-incoming`; a sender that is a contact address of the
 * matched matter files to `from-client`; any other sender skips every
 * attachment as `sender-not-routable` and downloads nothing. A destination
 * without a folder skips every attachment as `no-folder`.
 *
 * Inline parts, non-file attachments, zero-byte parts, and parts larger than
 * the policy's `maxAttachmentBytes` are skipped from their metadata, before
 * any download. Everything else is downloaded and hashed with SHA-256.
 *
 * Content with a completion line in the filing ledger for the same matter is
 * counted as deduplicated and not uploaded, whichever destination it went to.
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
 * intent comes from a run that stopped before recording its outcome. The next
 * run finds the pending intent and uploads to the intent's own folder and
 * name instead of computing a new one. The store then answers one of three
 * ways. It created the file: the earlier upload never landed, and the
 * completion is recorded as filed. It reports the name taken without
 * describing the holder: the filer fails with a `DocumentStore` port error.
 * It reports the name taken and describes the holder: the filer reconciles
 * only on a content match.
 *
 * The holder is the filer's own earlier upload when the store reports a
 * SHA-1 and it equals the SHA-1 of the attachment's bytes, or, when the store
 * reports no hash, when it reports a size equal to the intent's `byteLength`.
 * Then the completion is recorded with the holder's id and
 * `reconciled: true`, counted as `attachmentsReconciled`. A holder with a
 * different hash, a different size, or neither reported is not provably the
 * attachment: the intent is abandoned as `holder-mismatch` and the content is
 * filed through the same short-hash path a first attempt uses. If the pending
 * intent already carried the short-hash name there is no other name to try,
 * and the filer fails with a `DocumentStore` port error. So a pending intent
 * is never completed against a file that held the name before the first
 * attempt, whether that attempt failed before the store checked the name or
 * its abandonment line was lost.
 *
 * `dry-run` counts new content as filed and a pending intent as reconciled,
 * calls nothing, and writes nothing; it remembers what it would have stored
 * per run id, in memory, so duplicates across the messages of one dry run are
 * counted the way `apply` would count them. That memory is read by dry runs
 * only.
 *
 * **Gotchas**
 *
 * A store that describes a holder by id alone, with no size and no hash,
 * never lets the filer prove the holder is its own upload. After an
 * interrupted upload against such a store the filer abandons the intent and
 * files the content again under the short-hash name. That is the safe
 * default: the folder may end up with the same attachment twice, once under
 * the plain name and once under the short-hash name, and the attachment is
 * never lost or recorded against someone else's file.
 *
 * When the store reports a size and no hash, a foreign file of exactly the
 * attachment's size under the intended name is recorded as this attachment.
 * Nothing filed is ever undone here: the port has no delete verb.
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
  Mailbox | MatterFolderDirectory | DocumentStore | FilingLedger | Crypto.Crypto
> = Effect.gen(function* () {
  const mailbox = yield* Mailbox;
  const folders = yield* MatterFolderDirectory;
  const documents = yield* DocumentStore;
  const ledger = yield* FilingLedger;
  const crypto = yield* Crypto.Crypto;
  const planned = yield* Ref.make(HashMap.empty<TaggingRunId, ReadonlyArray<FiledContent>>());

  const contentHash = Effect.fn("AttachmentFiler.contentHash")(function* (
    bytes: Uint8Array
  ): Effect.fn.Return<ContentSha256, MailTaggingPortError> {
    const digest = yield* decodeContentHash(bytes).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError(hashFailed("sha256"))
    );
    return ContentSha256.make(digest);
  });

  // Computed only to compare with the hash a store reports for a held name.
  const contentSha1 = (bytes: Uint8Array): Effect.Effect<string, MailTaggingPortError> =>
    crypto.digest("SHA-1", bytes).pipe(Effect.map(Hex.encode), Effect.mapError(hashFailed("sha1")));

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

  const abandon = Effect.fn("AttachmentFiler.abandon")(function* (
    target: FilingTarget,
    payload: Payload,
    placement: Pick<Placement, "folderId" | "fileName">,
    reason: FilingAbandonReason
  ): Effect.fn.Return<void, FilingError> {
    const recordedAt = yield* DateTime.now;
    yield* ledger.append(
      FilingAbandoned.make({
        runId: target.request.runId,
        contentSha256: payload.content.contentSha256,
        matterKey: payload.content.matterKey,
        folderId: placement.folderId,
        fileName: placement.fileName,
        reason,
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
      DocumentNameTaken: () => Effect.as(abandon(target, payload, placement, "name-taken"), false),
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

  // The holder is ours when its reported hash matches, or, without a hash, its reported size.
  const isOwnUpload = (
    holder: ExistingDocument,
    payload: Payload,
    intent: FilingIntent
  ): Effect.Effect<boolean, MailTaggingPortError> =>
    O.match(holder.contentSha1, {
      onNone: () => Effect.succeed(O.exists(holder.byteLength, (byteLength) => byteLength === intent.byteLength)),
      onSome: (reported) => Effect.map(contentSha1(payload.bytes), (own) => own === reported),
    });

  // A holder that is not provably ours retires the intent; the content goes to the short-hash name.
  const disown = (
    target: FilingTarget,
    state: FilingState,
    payload: Payload,
    intent: FilingIntent
  ): Effect.Effect<FilingState, FilingError> =>
    Effect.andThen(
      abandon(target, payload, intent, "holder-mismatch"),
      fileFresh(
        target,
        state,
        payload,
        A.filter(shortHashNames(payload.content), (name) => name !== intent.fileName)
      )
    );

  const adopt = (
    target: FilingTarget,
    state: FilingState,
    payload: Payload,
    adoption: { readonly intent: FilingIntent; readonly holder: ExistingDocument }
  ): Effect.Effect<FilingState, FilingError> =>
    Effect.flatMap(isOwnUpload(adoption.holder, payload, adoption.intent), (ours) =>
      ours
        ? Effect.as(
            complete(target, payload, adoption.intent, { fileId: adoption.holder.fileId, reconciled: true }),
            settled(state, payload.content, "attachmentsReconciled", true)
          )
        : disown(target, state, payload, adoption.intent)
    );

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
      DocumentNameTaken: ({ existing }) =>
        O.match(existing, {
          onNone: () => nameHeld("the intended name is held by a file the store did not identify"),
          onSome: (holder) => adopt(target, state, payload, { intent, holder }),
        }),
    });
  });

  const resume = (target: FilingTarget, state: FilingState, payload: Payload, intent: FilingIntent) =>
    TaggingMode.is.apply(target.request.mode)
      ? reconcile(target, state, payload, intent)
      : Effect.succeed(settled(state, payload.content, "attachmentsReconciled", false));

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
      onNone: () => begin(target, state, payload),
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
