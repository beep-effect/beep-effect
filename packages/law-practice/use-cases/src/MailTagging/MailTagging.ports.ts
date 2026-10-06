/**
 * Mail-tagging ports: the mailbox, matter directory, document store, ledgers,
 * and checkpoint the use-cases reach through, plus the use-case services
 * themselves. Adapters live in the law-practice server tier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  BackfillCheckpoint,
  FilingLedgerRecord,
  MailMessageId,
  MasterCategoryIntent,
  TagLedgerRecord,
} from "@beep/law-practice-domain/values/MailTagging";
import { Fn } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { EffectOutput } from "../internal/effectOutput.ts";
import {
  DownloadAttachmentRequest,
  FileAttachmentsRequest,
  ListMessagesSinceRequest,
  MatterFolderRequest,
  RunMailTaggingRequest,
  SetCategoriesRequest,
  UndoMailTaggingRequest,
  UploadDocumentRequest,
} from "./MailTagging.values.ts";
import type {
  DocumentFolderId,
  MailEnvelope,
  MatterIndex,
  TaggingRunReport,
  TaggingUndoReport,
} from "@beep/law-practice-domain/values/MailTagging";
import type * as O from "effect/Option";
import type { MailTaggingPortError, MailTaggingStateError } from "./MailTagging.errors.ts";
import type { DocumentUploadResult, MailAttachmentMeta, MailPage } from "./MailTagging.values.ts";

const $I = $LawPracticeUseCasesId.create("MailTagging/MailTagging.ports");

/**
 * Service shape of the mailbox port.
 *
 * **Details**
 *
 * The only mutations are `setCategories` and `ensureMasterCategories`. There
 * is no move, delete, archive, or flag verb, so a mailbox adapter cannot be
 * asked to do more than categorize.
 *
 * `listMessagesSince` pages ascending by received instant with an inclusive
 * `since`. An implementation covers the inbox, its subfolders, and Sent Items,
 * and excludes Drafts, Deleted Items, and Junk. `getEnvelope` answers none for
 * a message the mailbox no longer has. `setCategories` carries the envelope's
 * `changeKey`; detecting a stale token and re-reading is the adapter's job.
 * `ensureMasterCategories` creates the missing master categories and answers
 * how many it created.
 *
 * **Example** (Build an empty mailbox)
 *
 * ```ts
 * import { MailboxShape, MailPage } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const mailbox = MailboxShape.make({
 *   listMessagesSince: () => Effect.succeed(MailPage.make({ envelopes: [] })),
 *   getEnvelope: () => Effect.succeedNone,
 *   setCategories: () => Effect.void,
 *   ensureMasterCategories: () => Effect.succeed(0),
 *   listAttachments: () => Effect.succeed([]),
 *   downloadAttachment: () => Effect.succeed(new Uint8Array())
 * })
 * console.log(typeof mailbox.setCategories) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class MailboxShape extends S.Class<MailboxShape>($I`MailboxShape`)(
  {
    listMessagesSince: Fn({
      input: ListMessagesSinceRequest,
      output: EffectOutput<MailPage, MailTaggingPortError>(),
    }).annotateKey({
      description:
        "Read one page of envelopes received at or after an instant, ascending, across the inbox, its subfolders, and Sent Items.",
    }),
    getEnvelope: Fn({
      input: MailMessageId,
      output: EffectOutput<O.Option<MailEnvelope>, MailTaggingPortError>(),
    }).annotateKey({
      description: "Read one message's current envelope; none when the mailbox no longer has it.",
    }),
    setCategories: Fn({
      input: SetCategoriesRequest,
      output: EffectOutput<void, MailTaggingPortError>(),
    }).annotateKey({
      description: "Replace one message's complete category list.",
    }),
    ensureMasterCategories: Fn({
      input: S.Array(MasterCategoryIntent),
      output: EffectOutput<number, MailTaggingPortError>(),
    }).annotateKey({
      description: "Create the master categories that do not exist yet and answer how many were created.",
    }),
    listAttachments: Fn({
      input: MailMessageId,
      output: EffectOutput<ReadonlyArray<MailAttachmentMeta>, MailTaggingPortError>(),
    }).annotateKey({
      description: "Read the attachment metadata of one message.",
    }),
    downloadAttachment: Fn({
      input: DownloadAttachmentRequest,
      output: EffectOutput<Uint8Array, MailTaggingPortError>(),
    }).annotateKey({
      description: "Download one attachment's bytes.",
    }),
  },
  $I.annote("MailboxShape", {
    description: "Category-only mailbox port: paged reads, attachment reads, and category writes.",
  })
) {}

/**
 * Mailbox port tag.
 *
 * **Example** (Provide a mailbox)
 *
 * ```ts
 * import { Mailbox, MailboxShape, MailPage } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const MailboxEmpty = Layer.succeed(
 *   Mailbox,
 *   MailboxShape.make({
 *     listMessagesSince: () => Effect.succeed(MailPage.make({ envelopes: [] })),
 *     getEnvelope: () => Effect.succeedNone,
 *     setCategories: () => Effect.void,
 *     ensureMasterCategories: () => Effect.succeed(0),
 *     listAttachments: () => Effect.succeed([]),
 *     downloadAttachment: () => Effect.succeed(new Uint8Array())
 *   })
 * )
 * console.log(Layer.isLayer(MailboxEmpty)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class Mailbox extends Context.Service<Mailbox, MailboxShape>()($I`Mailbox`) {}

/**
 * Service shape of the matter directory: one snapshot of every taggable
 * matter.
 *
 * **Example** (Build an empty directory)
 *
 * ```ts
 * import { MatterIndex } from "@beep/law-practice-domain/values/MailTagging"
 * import { MatterDirectoryShape } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 * import * as DateTime from "effect/DateTime"
 *
 * const directory = MatterDirectoryShape.make({
 *   snapshot: Effect.succeed(
 *     MatterIndex.make({ entries: [], builtAt: DateTime.makeUnsafe("2026-07-01T00:00:00.000Z") })
 *   )
 * })
 * console.log(Effect.isEffect(directory.snapshot)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class MatterDirectoryShape extends S.Class<MatterDirectoryShape>($I`MatterDirectoryShape`)(
  {
    snapshot: EffectOutput<MatterIndex, MailTaggingPortError>().annotateKey({
      description: "Read the identifiers and contacts of every taggable matter.",
    }),
  },
  $I.annote("MatterDirectoryShape", {
    description: "Matter directory port: one snapshot of every taggable matter.",
  })
) {}

/**
 * Matter directory port tag.
 *
 * **Example** (Read the snapshot through the tag)
 *
 * ```ts
 * import { MatterDirectory } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const matterCount = Effect.gen(function* () {
 *   const directory = yield* MatterDirectory
 *   const index = yield* directory.snapshot
 *   return index.entries.length
 * })
 * console.log(Effect.isEffect(matterCount)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class MatterDirectory extends Context.Service<MatterDirectory, MatterDirectoryShape>()($I`MatterDirectory`) {}

/**
 * Service shape of the matter-folder directory: which document folder one
 * filing destination of a matter is.
 *
 * **Example** (Build a directory without folders)
 *
 * ```ts
 * import { MatterFolderDirectoryShape } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const folders = MatterFolderDirectoryShape.make({ folderFor: () => Effect.succeedNone })
 * console.log(typeof folders.folderFor) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class MatterFolderDirectoryShape extends S.Class<MatterFolderDirectoryShape>($I`MatterFolderDirectoryShape`)(
  {
    folderFor: Fn({
      input: MatterFolderRequest,
      output: EffectOutput<O.Option<DocumentFolderId>, MailTaggingPortError>(),
    }).annotateKey({
      description: "Resolve one destination subfolder of one matter; none when it does not exist.",
    }),
  },
  $I.annote("MatterFolderDirectoryShape", {
    description: "Matter-folder directory port: the folder of one filing destination of one matter.",
  })
) {}

/**
 * Matter-folder directory port tag.
 *
 * **Example** (Resolve a folder through the tag)
 *
 * ```ts
 * import { MatterKey } from "@beep/law-practice-domain/values/MailTagging"
 * import { MatterFolderDirectory, MatterFolderRequest } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const folder = Effect.gen(function* () {
 *   const folders = yield* MatterFolderDirectory
 *   return yield* folders.folderFor(
 *     MatterFolderRequest.make({ matterKey: MatterKey.make("acme.10001"), destination: "from-client" })
 *   )
 * })
 * console.log(Effect.isEffect(folder)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class MatterFolderDirectory extends Context.Service<MatterFolderDirectory, MatterFolderDirectoryShape>()(
  $I`MatterFolderDirectory`
) {}

/**
 * Service shape of the document store.
 *
 * **Details**
 *
 * `upload` creates a new file and answers `DocumentUploaded` with its id. When
 * the folder already has a file of that name it writes nothing and answers
 * `DocumentNameTaken`, with the id of the file holding the name when the store
 * can tell. It never replaces a file. The port has no overwrite and no delete
 * verb, so filing cannot destroy a document.
 *
 * **Example** (Build a store that names every file the same)
 *
 * ```ts
 * import { DocumentFileId } from "@beep/law-practice-domain/values/MailTagging"
 * import { DocumentStoreShape, DocumentUploaded } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const store = DocumentStoreShape.make({
 *   upload: () => Effect.succeed(DocumentUploaded.make({ fileId: DocumentFileId.make("file-0001") }))
 * })
 * console.log(typeof store.upload) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocumentStoreShape extends S.Class<DocumentStoreShape>($I`DocumentStoreShape`)(
  {
    upload: Fn({
      input: UploadDocumentRequest,
      output: EffectOutput<DocumentUploadResult, MailTaggingPortError>(),
    }).annotateKey({
      description: "Create one new file in a folder, or report that its name is taken; never replaces a file.",
    }),
  },
  $I.annote("DocumentStoreShape", {
    description: "Create-only document store port.",
  })
) {}

/**
 * Document store port tag.
 *
 * **Example** (Upload through the tag)
 *
 * ```ts
 * import { DocumentFolderId } from "@beep/law-practice-domain/values/MailTagging"
 * import { DocumentStore, UploadDocumentRequest } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const upload = Effect.gen(function* () {
 *   const store = yield* DocumentStore
 *   return yield* store.upload(
 *     UploadDocumentRequest.make({
 *       folderId: DocumentFolderId.make("folder-10001"),
 *       fileName: "2026-07-01 notice.pdf",
 *       bytes: Uint8Array.of(1)
 *     })
 *   )
 * })
 * console.log(Effect.isEffect(upload)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocumentStore extends Context.Service<DocumentStore, DocumentStoreShape>()($I`DocumentStore`) {}

/**
 * Service shape of the append-only tag ledger.
 *
 * **Details**
 *
 * `records` answers every line in append order. A line that does not decode
 * fails the read: a ledger that silently dropped a line would let a run re-tag
 * a message or let an undo miss one.
 *
 * **Example** (Build an empty ledger)
 *
 * ```ts
 * import { TagLedgerShape } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const ledger = TagLedgerShape.make({ append: () => Effect.void, records: Effect.succeed([]) })
 * console.log(Effect.isEffect(ledger.records)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class TagLedgerShape extends S.Class<TagLedgerShape>($I`TagLedgerShape`)(
  {
    append: Fn({
      input: TagLedgerRecord,
      output: EffectOutput<void, MailTaggingStateError>(),
    }).annotateKey({
      description: "Append one applied or undone line.",
    }),
    records: EffectOutput<ReadonlyArray<TagLedgerRecord>, MailTaggingStateError>().annotateKey({
      description: "Read every line in append order, failing closed on a line that does not decode.",
    }),
  },
  $I.annote("TagLedgerShape", {
    description: "Append-only tag ledger port.",
  })
) {}

/**
 * Tag ledger port tag.
 *
 * **Example** (Count ledger lines through the tag)
 *
 * ```ts
 * import { TagLedger } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const lineCount = Effect.gen(function* () {
 *   const ledger = yield* TagLedger
 *   const records = yield* ledger.records
 *   return records.length
 * })
 * console.log(Effect.isEffect(lineCount)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class TagLedger extends Context.Service<TagLedger, TagLedgerShape>()($I`TagLedger`) {}

/**
 * Service shape of the append-only filing ledger.
 *
 * **Details**
 *
 * A filing writes two lines: a `FilingIntended` line before the upload and a
 * `FilingCompleted` line after it. `records` answers every line in append
 * order and fails closed on a line that does not decode.
 *
 * **Example** (Build an empty filing ledger)
 *
 * ```ts
 * import { FilingLedgerShape } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const ledger = FilingLedgerShape.make({ append: () => Effect.void, records: Effect.succeed([]) })
 * console.log(Effect.isEffect(ledger.records)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class FilingLedgerShape extends S.Class<FilingLedgerShape>($I`FilingLedgerShape`)(
  {
    append: Fn({
      input: FilingLedgerRecord,
      output: EffectOutput<void, MailTaggingStateError>(),
    }).annotateKey({
      description: "Append one filing intent or completion line.",
    }),
    records: EffectOutput<ReadonlyArray<FilingLedgerRecord>, MailTaggingStateError>().annotateKey({
      description: "Read every line in append order, failing closed on a line that does not decode.",
    }),
  },
  $I.annote("FilingLedgerShape", {
    description: "Append-only filing ledger port.",
  })
) {}

/**
 * Filing ledger port tag.
 *
 * **Example** (Count filing-ledger lines through the tag)
 *
 * ```ts
 * import { FilingLedger } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const lineCount = Effect.gen(function* () {
 *   const ledger = yield* FilingLedger
 *   const records = yield* ledger.records
 *   return records.length
 * })
 * console.log(Effect.isEffect(lineCount)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class FilingLedger extends Context.Service<FilingLedger, FilingLedgerShape>()($I`FilingLedger`) {}

/**
 * Service shape of the backfill checkpoint store.
 *
 * **Example** (Build a store without a checkpoint)
 *
 * ```ts
 * import { BackfillCheckpointStoreShape } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const store = BackfillCheckpointStoreShape.make({ load: Effect.succeedNone, save: () => Effect.void })
 * console.log(typeof store.save) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class BackfillCheckpointStoreShape extends S.Class<BackfillCheckpointStoreShape>(
  $I`BackfillCheckpointStoreShape`
)(
  {
    load: EffectOutput<O.Option<BackfillCheckpoint>, MailTaggingStateError>().annotateKey({
      description: "Read the saved checkpoint; none before the first save.",
    }),
    save: Fn({
      input: BackfillCheckpoint,
      output: EffectOutput<void, MailTaggingStateError>(),
    }).annotateKey({
      description: "Replace the saved checkpoint atomically.",
    }),
  },
  $I.annote("BackfillCheckpointStoreShape", {
    description: "Backfill checkpoint port: load and atomically replace the resume point.",
  })
) {}

/**
 * Backfill checkpoint store port tag.
 *
 * **Example** (Load the checkpoint through the tag)
 *
 * ```ts
 * import { BackfillCheckpointStore } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const checkpoint = Effect.gen(function* () {
 *   const store = yield* BackfillCheckpointStore
 *   return yield* store.load
 * })
 * console.log(Effect.isEffect(checkpoint)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class BackfillCheckpointStore extends Context.Service<BackfillCheckpointStore, BackfillCheckpointStoreShape>()(
  $I`BackfillCheckpointStore`
) {}

/**
 * Service shape of the attachment filer.
 *
 * **Example** (Build a filer that files nothing)
 *
 * ```ts
 * import { emptyTaggingRunReport } from "@beep/law-practice-domain/values/MailTagging"
 * import { AttachmentFilerShape } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const filer = AttachmentFilerShape.make({
 *   file: (request) => Effect.succeed(emptyTaggingRunReport(request.mode, request.runId))
 * })
 * console.log(typeof filer.file) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AttachmentFilerShape extends S.Class<AttachmentFilerShape>($I`AttachmentFilerShape`)(
  {
    file: Fn({
      input: FileAttachmentsRequest,
      output: EffectOutput<TaggingRunReport, MailTaggingPortError | MailTaggingStateError>(),
    }).annotateKey({
      description: "File one matched message's attachments and answer the attachment counts as a report fragment.",
    }),
  },
  $I.annote("AttachmentFilerShape", {
    description: "Attachment filer: content-deduplicated, create-only filing of one message's attachments.",
  })
) {}

/**
 * Attachment filer service tag.
 *
 * **Example** (Reference the filer tag)
 *
 * ```ts
 * import { AttachmentFiler } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const hasFiler = Effect.map(AttachmentFiler, (filer) => typeof filer.file === "function")
 * console.log(Effect.isEffect(hasFiler)) // true
 * ```
 *
 * @see {@link AttachmentFilerShape} for the service shape.
 * @category services
 * @since 0.0.0
 */
export class AttachmentFiler extends Context.Service<AttachmentFiler, AttachmentFilerShape>()($I`AttachmentFiler`) {}

/**
 * Service shape of the resumable tagging job.
 *
 * **Example** (Build a job that reports nothing)
 *
 * ```ts
 * import { emptyTaggingRunReport } from "@beep/law-practice-domain/values/MailTagging"
 * import { MailTaggingJobShape } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const job = MailTaggingJobShape.make({
 *   run: (request) => Effect.succeed(emptyTaggingRunReport(request.mode, request.runId))
 * })
 * console.log(typeof job.run) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MailTaggingJobShape extends S.Class<MailTaggingJobShape>($I`MailTaggingJobShape`)(
  {
    run: Fn({
      input: RunMailTaggingRequest,
      output: EffectOutput<TaggingRunReport, MailTaggingPortError | MailTaggingStateError>(),
    }).annotateKey({
      description: "Tag the mailbox from the checkpoint or the requested instant and answer the run's counts.",
    }),
  },
  $I.annote("MailTaggingJobShape", {
    description: "Resumable, ledger-backed mail-tagging job.",
  })
) {}

/**
 * Mail-tagging job service tag.
 *
 * **Example** (Reference the job tag)
 *
 * ```ts
 * import { MailTaggingJob } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const hasJob = Effect.map(MailTaggingJob, (job) => typeof job.run === "function")
 * console.log(Effect.isEffect(hasJob)) // true
 * ```
 *
 * @see {@link MailTaggingJobShape} for the service shape.
 * @category services
 * @since 0.0.0
 */
export class MailTaggingJob extends Context.Service<MailTaggingJob, MailTaggingJobShape>()($I`MailTaggingJob`) {}

/**
 * Service shape of the ledger-driven undo.
 *
 * **Details**
 *
 * An undone message is settled: the tagging job never decides it again on
 * its own. Re-tagging an undone run is a deliberate later operation.
 *
 * Undo restores categories only. It never removes a filed attachment: the
 * document port has no delete verb, and the filing ledger lists every stored
 * file for manual reversal.
 *
 * **Example** (Build an undo that finds nothing)
 *
 * ```ts
 * import { TaggingUndoReport } from "@beep/law-practice-domain/values/MailTagging"
 * import { MailTaggingUndoShape } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const undo = MailTaggingUndoShape.make({
 *   run: (request) =>
 *     Effect.succeed(
 *       TaggingUndoReport.make({
 *         mode: request.mode,
 *         runId: request.runId,
 *         originalRunId: request.originalRunId,
 *         entries: 0,
 *         messagesRestored: 0,
 *         messagesMissing: 0,
 *         categoriesRemoved: 0,
 *         wrote: false
 *       })
 *     )
 * })
 * console.log(typeof undo.run) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MailTaggingUndoShape extends S.Class<MailTaggingUndoShape>($I`MailTaggingUndoShape`)(
  {
    run: Fn({
      input: UndoMailTaggingRequest,
      output: EffectOutput<TaggingUndoReport, MailTaggingPortError | MailTaggingStateError>(),
    }).annotateKey({
      description: "Remove the categories one run added, where they are still present, and answer the counts.",
    }),
  },
  $I.annote("MailTaggingUndoShape", {
    description: "Ledger-driven undo of one tagging run.",
  })
) {}

/**
 * Mail-tagging undo service tag.
 *
 * **Example** (Reference the undo tag)
 *
 * ```ts
 * import { MailTaggingUndo } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * const hasUndo = Effect.map(MailTaggingUndo, (undo) => typeof undo.run === "function")
 * console.log(Effect.isEffect(hasUndo)) // true
 * ```
 *
 * @see {@link MailTaggingUndoShape} for the service shape.
 * @category services
 * @since 0.0.0
 */
export class MailTaggingUndo extends Context.Service<MailTaggingUndo, MailTaggingUndoShape>()($I`MailTaggingUndo`) {}
