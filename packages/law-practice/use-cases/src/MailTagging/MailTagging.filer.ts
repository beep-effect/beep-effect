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
  FilingDestination,
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
import {
  AttachmentFilerShape,
  DocumentStore,
  FilingLedger,
  Mailbox,
  MatterFolderDirectory,
} from "./MailTagging.ports.ts";
import { senderRuleCategories } from "./MailTagging.tagger.ts";
import { DownloadAttachmentRequest, MatterFolderRequest, UploadDocumentRequest } from "./MailTagging.values.ts";
import type {
  AttachmentSkipReason,
  DocumentFolderId,
  MatterKey,
  TaggingPolicy,
  TaggingRunId,
} from "@beep/law-practice-domain/values/MailTagging";
import type { MailTaggingStateError } from "./MailTagging.errors.ts";
import type { FileAttachmentsRequest, MailAttachmentMeta } from "./MailTagging.values.ts";

type FiledContent = Pick<FilingLedgerEntry, "contentSha256" | "matterKey" | "fileName">;

type FilingState = {
  readonly report: TaggingRunReport;
  readonly known: ReadonlyArray<FiledContent>;
};

type FilingTarget = {
  readonly request: FileAttachmentsRequest;
  readonly destination: FilingDestination;
  readonly folderId: DocumentFolderId;
};

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

const isContentFiled = (known: ReadonlyArray<FiledContent>, content: FiledContent): boolean =>
  A.some(known, (filed) => filed.matterKey === content.matterKey && filed.contentSha256 === content.contentSha256);

const freeName = (known: ReadonlyArray<FiledContent>, content: FiledContent): string =>
  isNameTaken(known, content.matterKey, content.fileName)
    ? withShortHash(content.fileName, content.contentSha256)
    : content.fileName;

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

const deduped = (state: FilingState): FilingState => ({
  ...state,
  report: TaggingRunReport.make({ ...state.report, attachmentsDeduped: state.report.attachmentsDeduped + 1 }),
});

const filed = (state: FilingState, content: FiledContent, wrote: boolean): FilingState => ({
  known: A.append(state.known, content),
  report: TaggingRunReport.make({
    ...state.report,
    attachmentsFiled: state.report.attachmentsFiled + 1,
    wrote: state.report.wrote || wrote,
  }),
});

const decodeContentHash = S.decodeEffect(Sha256HexFromBytes);

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
 * Content already in the filing ledger for the same matter is counted as
 * deduplicated and not uploaded, whichever destination it went to. A new file
 * is named `<UTC received date> <sanitized original name>`. When the ledger
 * already has that name in the matter with different content, the first eight
 * hex characters of the hash go before the extension, so a new upload never
 * targets an existing name.
 *
 * `apply` uploads and then appends the filing-ledger line. `dry-run` counts
 * the attachment as filed and writes nothing; it remembers what it would have
 * filed per run id, in memory, so duplicates across the messages of one dry
 * run are counted the way `apply` would count them.
 *
 * **Example** (Reference the filer constructor)
 *
 * ```ts
 * import { makeAttachmentFiler } from "@beep/law-practice-use-cases/MailTagging"
 * import { Effect } from "effect"
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
      Effect.mapError(() => MailTaggingPortError.during("ContentHasher", "sha256", "SHA-256 digest failed"))
    );
    return ContentSha256.make(digest);
  });

  const store = Effect.fn("AttachmentFiler.store")(function* (
    target: FilingTarget,
    meta: MailAttachmentMeta,
    bytes: Uint8Array,
    content: FiledContent
  ): Effect.fn.Return<void, FilingError> {
    const fileId = yield* documents.upload(
      UploadDocumentRequest.make({
        folderId: target.folderId,
        fileName: content.fileName,
        contentType: meta.contentType,
        bytes,
      })
    );
    const recordedAt = yield* DateTime.now;
    yield* ledger.append(
      FilingLedgerEntry.make({
        ...content,
        destination: target.destination,
        folderId: target.folderId,
        fileId,
        messageId: target.request.envelope.messageId,
        attachmentId: meta.attachmentId,
        byteLength: bytes.byteLength,
        recordedAt,
      })
    );
  });

  const fileContent = Effect.fn("AttachmentFiler.fileContent")(function* (
    target: FilingTarget,
    state: FilingState,
    meta: MailAttachmentMeta
  ): Effect.fn.Return<FilingState, FilingError> {
    const { envelope, matter, mode } = target.request;
    const matterKey = matter.matterKey;
    const bytes = yield* mailbox.downloadAttachment(
      DownloadAttachmentRequest.make({ messageId: envelope.messageId, attachmentId: meta.attachmentId })
    );
    const contentSha256 = yield* contentHash(bytes);
    const candidate = { contentSha256, matterKey, fileName: datedName(target.request, meta) };
    if (isContentFiled(state.known, candidate)) {
      return deduped(state);
    }
    const content = { ...candidate, fileName: freeName(state.known, candidate) };
    const applies = TaggingMode.is.apply(mode);
    if (applies) {
      yield* store(target, meta, bytes, content);
    }
    return filed(state, content, applies);
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
    const entries = yield* ledger.entries;
    const plannedByRun = yield* Ref.get(planned);
    const known = A.appendAll<FiledContent, FiledContent>(
      entries,
      O.getOrElse(HashMap.get(plannedByRun, runId), () => [])
    );
    const state = yield* Effect.reduce(metas, (): FilingState => ({ report, known }), fileOne(target));
    if (TaggingMode.is["dry-run"](mode)) {
      yield* Ref.update(planned, (byRun) => HashMap.set(byRun, runId, A.drop(state.known, entries.length)));
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
