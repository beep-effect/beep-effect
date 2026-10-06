/**
 * Live layers of the mail-tagging use-cases: the attachment filer, the
 * tagging job, and the undo, built from the use-case constructors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  AttachmentFiler,
  MailTaggingJob,
  MailTaggingUndo,
  makeAttachmentFiler,
  makeMailTaggingJob,
  makeMailTaggingUndo,
} from "@beep/law-practice-use-cases/MailTagging";
import { Layer } from "effect";
import type {
  BackfillCheckpointStore,
  DocumentStore,
  FilingLedger,
  KnownDocuments,
  Mailbox,
  MatterDirectory,
  MatterFolderDirectory,
  TagLedger,
} from "@beep/law-practice-use-cases/MailTagging";
import type * as Crypto from "effect/Crypto";

/**
 * Layer providing the attachment filer.
 *
 * **Example** (Wire the filer)
 *
 * ```ts
 * import { AttachmentFilerLive } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(AttachmentFilerLive)) // true
 * ```
 *
 * @see {@link makeAttachmentFiler} for the routing, dedupe, and naming rules.
 * @category layers
 * @since 0.0.0
 */
export const AttachmentFilerLive: Layer.Layer<
  AttachmentFiler,
  never,
  Mailbox | MatterFolderDirectory | DocumentStore | KnownDocuments | FilingLedger | Crypto.Crypto
> = Layer.effect(AttachmentFiler, makeAttachmentFiler);

/**
 * Layer providing the resumable mail-tagging job.
 *
 * **Example** (Wire the job)
 *
 * ```ts
 * import { MailTaggingJobLive } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(MailTaggingJobLive)) // true
 * ```
 *
 * @see {@link makeMailTaggingJob} for the run, resume, and repair semantics.
 * @category layers
 * @since 0.0.0
 */
export const MailTaggingJobLive: Layer.Layer<
  MailTaggingJob,
  never,
  Mailbox | MatterDirectory | TagLedger | BackfillCheckpointStore | AttachmentFiler
> = Layer.effect(MailTaggingJob, makeMailTaggingJob);

/**
 * Layer providing the ledger-driven undo of one tagging run.
 *
 * **Example** (Wire the undo)
 *
 * ```ts
 * import { MailTaggingUndoLive } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(MailTaggingUndoLive)) // true
 * ```
 *
 * @see {@link makeMailTaggingUndo} for what an undo removes and records.
 * @category layers
 * @since 0.0.0
 */
export const MailTaggingUndoLive: Layer.Layer<MailTaggingUndo, never, Mailbox | TagLedger> = Layer.effect(
  MailTaggingUndo,
  makeMailTaggingUndo
);

/**
 * Layer providing the filer, the job, and the undo together, with the job
 * wired to the filer.
 *
 * **Details**
 *
 * What remains to provide is every port: the mailbox, the matter and
 * matter-folder directories, the document store, the known-documents index,
 * both ledgers, the checkpoint store, and `Crypto` for content hashes.
 *
 * **Example** (Wire every mail-tagging use-case)
 *
 * ```ts
 * import { MailTaggingUseCasesLive } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(MailTaggingUseCasesLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailTaggingUseCasesLive: Layer.Layer<
  AttachmentFiler | MailTaggingJob | MailTaggingUndo,
  never,
  | Mailbox
  | MatterDirectory
  | MatterFolderDirectory
  | DocumentStore
  | KnownDocuments
  | TagLedger
  | FilingLedger
  | BackfillCheckpointStore
  | Crypto.Crypto
> = Layer.merge(MailTaggingUndoLive, Layer.provideMerge(MailTaggingJobLive, AttachmentFilerLive));
