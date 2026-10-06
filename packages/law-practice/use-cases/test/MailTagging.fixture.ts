/**
 * Synthetic mail-tagging world: Ref-backed fakes of every port that record
 * each write call. Clients, families, addresses, and bytes are invented.
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { PatentNumber, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain";
import {
  DocumentFileId,
  DocumentFolderId,
  defaultMailTaxonomy,
  MailAttachmentId,
  MailConversationId,
  MailDomain,
  MailEnvelope,
  MailMessageId,
  MatterClientKey,
  MatterDocketNumber,
  MatterIndex,
  MatterIndexEntry,
  MatterKey,
  TaggingRunId,
  UnattributedMatter,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  AttachmentFiler,
  BackfillCheckpointStore,
  BackfillCheckpointStoreShape,
  DocumentNameTaken,
  DocumentStore,
  DocumentStoreShape,
  DocumentUploaded,
  FilingLedger,
  FilingLedgerShape,
  MailAttachmentMeta,
  Mailbox,
  MailboxShape,
  MailPage,
  MailPageCursor,
  MailTaggingJob,
  MailTaggingPortError,
  MailTaggingStateError,
  MailTaggingUndo,
  MatterDirectory,
  MatterDirectoryShape,
  MatterFolderDirectory,
  MatterFolderDirectoryShape,
  makeAttachmentFiler,
  makeMailTaggingJob,
  makeMailTaggingUndo,
  TagLedger,
  TagLedgerShape,
} from "@beep/law-practice-use-cases/MailTagging";
import { EmailString } from "@beep/schema/Email";
import { Context, Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as HashMap from "effect/HashMap";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Str from "effect/String";
import type {
  BackfillCheckpoint,
  FilingLedgerRecord,
  TagLedgerRecord,
} from "@beep/law-practice-domain/values/MailTagging";
import type { SetCategoriesRequest, UploadDocumentRequest } from "@beep/law-practice-use-cases/MailTagging";

const $I = $LawPracticeUseCasesId.create("test/MailTagging.fixture");

export const acme = MatterKey.make("acme.10001");
export const globex = MatterKey.make("globex.20002");
const acmeContact = EmailString.make("counsel@acme.example.test");
export const runId = TaggingRunId.make("run-0001");
export const since = DateTime.makeUnsafe("2026-07-01T00:00:00.000Z");

export const acmeEntry = MatterIndexEntry.make({
  matterKey: acme,
  clientKey: MatterClientKey.make("acme"),
  docketNumbers: [MatterDocketNumber.make("ACME-10001-US")],
  applicationNumbers: [UsptoNormalizedApplicationNumber.make("16123456")],
  patentNumbers: [PatentNumber.make("10123456")],
  contactAddresses: [acmeContact],
  contactDomains: [MailDomain.make("acme.example.test"), MailDomain.make("gmail.com")],
});

export const globexEntry = MatterIndexEntry.make({
  matterKey: globex,
  clientKey: MatterClientKey.make("globex"),
  docketNumbers: [MatterDocketNumber.make("GLOBEX-20002-US")],
  applicationNumbers: [UsptoNormalizedApplicationNumber.make("17654321")],
  contactDomains: [MailDomain.make("globex.example.test")],
});

/** Two taggable matters plus one matter that has no client number. */
export const index = MatterIndex.make({
  builtAt: since,
  entries: [acmeEntry, globexEntry],
  unattributed: [
    UnattributedMatter.make({
      docketNumbers: [MatterDocketNumber.make("30003-US")],
      applicationNumbers: [UsptoNormalizedApplicationNumber.make("15000001")],
    }),
  ],
});

export const taxonomy = defaultMailTaxonomy([acme, globex]);

type EnvelopeOptions = {
  readonly at: number;
  /** Message id; defaults to `msg-<at>`. Lets two messages share one instant. */
  readonly id?: string;
  readonly subject?: string;
  readonly sender?: string;
  readonly recipients?: ReadonlyArray<string>;
  readonly conversation?: string;
  readonly categories?: ReadonlyArray<string>;
  readonly hasAttachments?: boolean;
  readonly bodyPreview?: string;
};

const envelopeDefaults = {
  subject: "Quarterly newsletter",
  recipients: [],
  categories: [],
  hasAttachments: false,
} satisfies Partial<EnvelopeOptions>;

/** Builds message `msg-<at>`, received `at` minutes after the backfill start. */
export const envelope = (options: EnvelopeOptions): MailEnvelope => {
  const filled = { ...envelopeDefaults, ...options };
  return MailEnvelope.make({
    messageId: MailMessageId.make(filled.id ?? `msg-${filled.at}`),
    subject: filled.subject,
    senderAddress: O.map(O.fromUndefinedOr(filled.sender), (address) => EmailString.make(address)),
    recipientAddresses: A.map(filled.recipients, (address) => EmailString.make(address)),
    conversationId: O.map(O.fromUndefinedOr(filled.conversation), (id) => MailConversationId.make(id)),
    changeKey: O.some(`ck-${filled.at}`),
    receivedAt: DateTime.add(since, { minutes: filled.at }),
    categories: filled.categories,
    hasAttachments: filled.hasAttachments,
    bodyPreview: O.fromUndefinedOr(filled.bodyPreview),
  });
};

type FakeAttachment = {
  readonly meta: MailAttachmentMeta;
  readonly bytes: Uint8Array;
};

type AttachmentOptions = {
  readonly id: string;
  readonly name: string;
  readonly bytes: ReadonlyArray<number>;
  readonly isInline?: boolean;
  readonly isFile?: boolean;
  readonly byteLength?: number;
};

export const attachment = (options: AttachmentOptions): FakeAttachment => ({
  bytes: Uint8Array.from(options.bytes),
  meta: MailAttachmentMeta.make({
    attachmentId: MailAttachmentId.make(options.id),
    name: options.name,
    contentType: O.some("application/pdf"),
    byteLength: options.byteLength ?? options.bytes.length,
    isInline: options.isInline ?? false,
    isFile: options.isFile ?? true,
  }),
});

type WorldOptions = {
  readonly envelopes: ReadonlyArray<MailEnvelope>;
  readonly attachments?: ReadonlyArray<readonly [MailMessageId, ReadonlyArray<FakeAttachment>]>;
  readonly pageSize?: number;
  /** Makes every SHA-256 digest fail, as an unavailable platform would. */
  readonly digestFails?: boolean;
};

type WorldShape = {
  readonly messages: Ref.Ref<ReadonlyArray<MailEnvelope>>;
  readonly writes: Ref.Ref<ReadonlyArray<string>>;
  readonly uploads: Ref.Ref<ReadonlyArray<UploadDocumentRequest>>;
  readonly tagRecords: Ref.Ref<ReadonlyArray<TagLedgerRecord>>;
  readonly filingRecords: Ref.Ref<ReadonlyArray<FilingLedgerRecord>>;
  /** Every `upload` call, including the ones the store refused. */
  readonly uploadCalls: Ref.Ref<number>;
  /** Files the store holds, keyed `<folderId>/<fileName>`. */
  readonly storedFiles: Ref.Ref<HashMap.HashMap<string, DocumentFileId>>;
  /** 1-based `upload` call that fails before storing anything, when set. */
  readonly failingUpload: Ref.Ref<O.Option<number>>;
  /** 1-based `upload` call that stores the file and then reports failure, when set. */
  readonly lyingUpload: Ref.Ref<O.Option<number>>;
  /** Current categories of the message with this id. */
  readonly categoriesById: (id: string) => Effect.Effect<ReadonlyArray<string>>;
  /** 1-based filing-ledger `append` call that fails, when set. */
  readonly failingFilingAppend: Ref.Ref<O.Option<number>>;
  /** Makes the store report a taken name without identifying the file. */
  readonly anonymousStore: Ref.Ref<boolean>;
  readonly checkpoint: Ref.Ref<O.Option<BackfillCheckpoint>>;
  readonly categoryWrites: Ref.Ref<ReadonlyArray<SetCategoriesRequest>>;
  readonly folderRequests: Ref.Ref<ReadonlyArray<string>>;
  readonly downloads: Ref.Ref<number>;
  /** 1-based `listMessagesSince` call that fails, when set. */
  readonly failingListCall: Ref.Ref<O.Option<number>>;
  /** 1-based `setCategories` call that fails, when set. */
  readonly failingCategoryWrite: Ref.Ref<O.Option<number>>;
  readonly folders: MatterFolderDirectoryShape;
  /** Current categories of message `msg-<at>`. */
  readonly categoriesOf: (at: number) => Effect.Effect<ReadonlyArray<string>>;
  /** Write calls whose name starts with a prefix. */
  readonly writesOf: (prefix: string) => Effect.Effect<ReadonlyArray<string>>;
  readonly mailbox: MailboxShape;
  readonly documents: DocumentStoreShape;
  readonly tagLedger: TagLedgerShape;
  readonly filingLedger: FilingLedgerShape;
  readonly checkpoints: BackfillCheckpointStoreShape;
};

/** The synthetic world of one test: mutable state plus the port fakes over it. */
export class World extends Context.Service<World, WorldShape>()($I`World`) {}

const digestUnavailable = PlatformError.systemError({
  _tag: "Unknown",
  module: "Crypto",
  method: "digest",
  description: "digest unavailable",
});

const testCrypto = (digestFails: boolean) =>
  Layer.succeed(
    Crypto.Crypto,
    Crypto.make({
      digest: (algorithm, data) =>
        digestFails
          ? Effect.fail(digestUnavailable)
          : Effect.promise(() => globalThis.crypto.subtle.digest(algorithm, Uint8Array.from(data))).pipe(
              Effect.map((buffer) => new Uint8Array(buffer))
            ),
      randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
    })
  );

const noSuchAttachment = MailTaggingPortError.during("Mailbox", "downloadAttachment", "no such attachment");

const makeWorld = Effect.fn("MailTaggingFixture.makeWorld")(function* (options: WorldOptions) {
  const messages = yield* Ref.make(options.envelopes);
  const writes = yield* Ref.make<ReadonlyArray<string>>([]);
  const uploads = yield* Ref.make<ReadonlyArray<UploadDocumentRequest>>([]);
  const tagRecords = yield* Ref.make<ReadonlyArray<TagLedgerRecord>>([]);
  const filingRecords = yield* Ref.make<ReadonlyArray<FilingLedgerRecord>>([]);
  const uploadCalls = yield* Ref.make(0);
  const storedFiles = yield* Ref.make(HashMap.empty<string, DocumentFileId>());
  const failingUpload = yield* Ref.make<O.Option<number>>(O.none());
  const lyingUpload = yield* Ref.make<O.Option<number>>(O.none());
  const categoriesById = Effect.fn("World.categoriesById")(function* (id: string) {
    const current = yield* Ref.get(messages);
    return A.flatMap(current, (message) => (message.messageId === id ? message.categories : []));
  });
  const failingFilingAppend = yield* Ref.make<O.Option<number>>(O.none());
  const anonymousStore = yield* Ref.make(false);
  const filingAppendCalls = yield* Ref.make(0);
  const checkpoint = yield* Ref.make<O.Option<BackfillCheckpoint>>(O.none());
  const failingListCall = yield* Ref.make<O.Option<number>>(O.none());
  const failingCategoryWrite = yield* Ref.make<O.Option<number>>(O.none());
  const categoryWrites = yield* Ref.make<ReadonlyArray<SetCategoriesRequest>>([]);
  const folderRequests = yield* Ref.make<ReadonlyArray<string>>([]);
  const downloads = yield* Ref.make(0);
  const categoryCalls = yield* Ref.make(0);
  const listCalls = yield* Ref.make(0);
  const attachments = HashMap.fromIterable(options.attachments ?? []);
  const pageSize = options.pageSize ?? 2;
  const wrote = (call: string) => Ref.update(writes, A.append(call));
  const attachmentsOf = (messageId: MailMessageId): ReadonlyArray<FakeAttachment> =>
    O.getOrElse(HashMap.get(attachments, messageId), () => []);

  const refuseTakenName = (existing: DocumentFileId) =>
    Effect.map(Ref.get(anonymousStore), (anonymous) =>
      DocumentNameTaken.make({ existingFileId: anonymous ? O.none() : O.some(existing) })
    );

  const createFile = Effect.fn("FakeDocumentStore.createFile")(function* (
    request: UploadDocumentRequest,
    key: string,
    call: number
  ) {
    yield* wrote(`upload:${request.fileName}`);
    const created = yield* Ref.updateAndGet(uploads, A.append(request));
    const fileId = DocumentFileId.make(`file-${created.length}`);
    yield* Ref.update(storedFiles, HashMap.set(key, fileId));
    if (O.contains(yield* Ref.get(lyingUpload), call)) {
      return yield* MailTaggingPortError.during("DocumentStore", "upload", "connection reset after the write");
    }
    return DocumentUploaded.make({ fileId });
  });

  const mailbox = MailboxShape.make({
    listMessagesSince: Effect.fn("FakeMailbox.listMessagesSince")(function* (request) {
      const call = yield* Ref.updateAndGet(listCalls, N.increment);
      const failing = yield* Ref.get(failingListCall);
      if (O.contains(failing, call)) {
        return yield* MailTaggingPortError.during("Mailbox", "listMessagesSince", "HTTP 503");
      }
      const offset = O.match(request.cursor, { onNone: () => 0, onSome: Number });
      const eligible = A.filter(yield* Ref.get(messages), (message) =>
        DateTime.isGreaterThanOrEqualTo(message.receivedAt, request.since)
      );
      const end = offset + pageSize;
      return MailPage.make({
        envelopes: A.take(A.drop(eligible, offset), pageSize),
        next: O.liftPredicate(MailPageCursor.make(`${end}`), () => end < eligible.length),
      });
    }),
    getEnvelope: (messageId) =>
      Effect.map(
        Ref.get(messages),
        A.findFirst((message) => message.messageId === messageId)
      ),
    setCategories: Effect.fn("FakeMailbox.setCategories")(function* (request) {
      const call = yield* Ref.updateAndGet(categoryCalls, N.increment);
      const failing = yield* Ref.get(failingCategoryWrite);
      if (O.contains(failing, call)) {
        return yield* MailTaggingPortError.during("Mailbox", "setCategories", "HTTP 503");
      }
      yield* wrote(`setCategories:${request.messageId}`);
      yield* Ref.update(categoryWrites, A.append(request));
      yield* Ref.update(
        messages,
        A.map((message) =>
          message.messageId === request.messageId
            ? MailEnvelope.make({ ...message, categories: request.categories })
            : message
        )
      );
    }),
    ensureMasterCategories: (intents) =>
      Effect.as(
        wrote(
          `ensureMasterCategories:${A.join(
            A.map(intents, (intent) => intent.displayName),
            "|"
          )}`
        ),
        intents.length
      ),
    listAttachments: (messageId) => Effect.succeed(A.map(attachmentsOf(messageId), (item) => item.meta)),
    downloadAttachment: (request) =>
      O.match(
        A.findFirst(attachmentsOf(request.messageId), (item) => item.meta.attachmentId === request.attachmentId),
        {
          onNone: () => Effect.fail(noSuchAttachment),
          onSome: (item) => Effect.as(Ref.update(downloads, N.increment), item.bytes),
        }
      ),
  });

  return World.of({
    messages,
    writes,
    uploads,
    tagRecords,
    filingRecords,
    uploadCalls,
    storedFiles,
    failingUpload,
    lyingUpload,
    categoriesById,
    failingFilingAppend,
    anonymousStore,
    checkpoint,
    failingListCall,
    failingCategoryWrite,
    categoryWrites,
    folderRequests,
    downloads,
    mailbox,
    folders: MatterFolderDirectoryShape.make({
      folderFor: (request) =>
        Effect.as(
          Ref.update(folderRequests, A.append(`${request.matterKey}:${request.destination}`)),
          O.map(
            O.liftPredicate(request.matterKey, (matterKey) => matterKey === acme),
            () => DocumentFolderId.make(`folder-acme-${request.destination}`)
          )
        ),
    }),
    categoriesOf: Effect.fn("World.categoriesOf")(function* (at: number) {
      return yield* categoriesById(`msg-${at}`);
    }),
    writesOf: Effect.fn("World.writesOf")(function* (prefix: string) {
      return A.filter(yield* Ref.get(writes), Str.startsWith(prefix));
    }),
    documents: DocumentStoreShape.make({
      upload: Effect.fn("FakeDocumentStore.upload")(function* (request) {
        const call = yield* Ref.updateAndGet(uploadCalls, N.increment);
        if (O.contains(yield* Ref.get(failingUpload), call)) {
          return yield* MailTaggingPortError.during("DocumentStore", "upload", "HTTP 503");
        }
        const key = `${request.folderId}/${request.fileName}`;
        return yield* O.match(HashMap.get(yield* Ref.get(storedFiles), key), {
          onNone: () => createFile(request, key, call),
          onSome: refuseTakenName,
        });
      }),
    }),
    tagLedger: TagLedgerShape.make({
      append: (record) => Effect.andThen(wrote("tagLedger.append"), Ref.update(tagRecords, A.append(record))),
      records: Ref.get(tagRecords),
    }),
    filingLedger: FilingLedgerShape.make({
      append: Effect.fn("FakeFilingLedger.append")(function* (record) {
        const call = yield* Ref.updateAndGet(filingAppendCalls, N.increment);
        if (O.contains(yield* Ref.get(failingFilingAppend), call)) {
          return yield* MailTaggingStateError.unavailable("filing-ledger", "filing-ledger.jsonl", "append");
        }
        yield* wrote(`filingLedger.append:${record._tag}`);
        yield* Ref.update(filingRecords, A.append(record));
      }),
      records: Ref.get(filingRecords),
    }),
    checkpoints: BackfillCheckpointStoreShape.make({
      load: Ref.get(checkpoint),
      save: (saved) => Effect.andThen(wrote("checkpoint.save"), Ref.set(checkpoint, O.some(saved))),
    }),
  });
});

const Ports = Layer.mergeAll(
  Layer.effect(
    Mailbox,
    Effect.map(World, (world) => world.mailbox)
  ),
  Layer.effect(
    DocumentStore,
    Effect.map(World, (world) => world.documents)
  ),
  Layer.effect(
    TagLedger,
    Effect.map(World, (world) => world.tagLedger)
  ),
  Layer.effect(
    FilingLedger,
    Effect.map(World, (world) => world.filingLedger)
  ),
  Layer.effect(
    BackfillCheckpointStore,
    Effect.map(World, (world) => world.checkpoints)
  ),
  Layer.effect(
    MatterFolderDirectory,
    Effect.map(World, (world) => world.folders)
  ),
  Layer.succeed(MatterDirectory, MatterDirectoryShape.make({ snapshot: Effect.succeed(index) }))
);

const UseCases = Layer.merge(
  Layer.effect(MailTaggingUndo, makeMailTaggingUndo),
  Layer.provideMerge(
    Layer.effect(MailTaggingJob, makeMailTaggingJob),
    Layer.effect(AttachmentFiler, makeAttachmentFiler)
  )
);

/**
 * A fresh world with every use-case built from its constructor over the port
 * fakes. Only the acme matter has document folders.
 */
export const scenario = (options: WorldOptions) =>
  Layer.fresh(
    UseCases.pipe(
      Layer.provideMerge(Layer.merge(Ports, testCrypto(options.digestFails === true))),
      Layer.provideMerge(Layer.effect(World, makeWorld(options)))
    )
  );
