/**
 * The live mail-tagging use-case layers over the file-backed state in a
 * scoped temporary directory, with in-memory fakes for the provider ports.
 * Every message, matter, and byte is synthetic.
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain";
import {
  DocumentFileId,
  DocumentFolderId,
  MailAttachmentId,
  MailEnvelope,
  MailMessageId,
  MatterClientKey,
  MatterIndex,
  MatterIndexEntry,
  MatterKey,
  TaggingRunId,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  MailTaggingStateConfig,
  MailTaggingStateFile,
  MailTaggingStateLocation,
  MailTaggingUseCasesLive,
} from "@beep/law-practice-server/MailTagging";
import {
  DocumentStore,
  DocumentStoreShape,
  KnownDocuments,
  KnownDocumentsShape,
  MailAttachmentMeta,
  Mailbox,
  MailboxShape,
  MailPage,
  MailTaggingJob,
  MailTaggingUndo,
  MatterDirectory,
  MatterDirectoryShape,
  MatterFolderDirectory,
  MatterFolderDirectoryShape,
  RunMailTaggingRequest,
  TagLedger,
  UndoMailTaggingRequest,
} from "@beep/law-practice-use-cases/MailTagging";
import { EmailString } from "@beep/schema/Email";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("test/MailTagging.layers.test");

const since = DateTime.makeUnsafe("2026-07-01T00:00:00.000Z");
const acme = MatterKey.make("acme.10001");
const notice = MailEnvelope.make({
  messageId: MailMessageId.make("msg-1"),
  subject: "Office action for 16/123,456",
  senderAddress: O.some(EmailString.make("notices@uspto.gov")),
  receivedAt: DateTime.add(since, { minutes: 1 }),
  categories: ["Personal"],
  hasAttachments: true,
});
const noticeAttachment = MailAttachmentMeta.make({
  attachmentId: MailAttachmentId.make("att-1"),
  name: "office-action.pdf",
  byteLength: 3,
  isInline: false,
  isFile: true,
});

/** The one mailbox message and the upload log of a test. */
class Inbox extends Context.Service<
  Inbox,
  { readonly message: Ref.Ref<MailEnvelope>; readonly uploads: Ref.Ref<ReadonlyArray<string>> }
>()($I`Inbox`) {}

const InboxLive = Layer.effect(
  Inbox,
  Effect.all({ message: Ref.make(notice), uploads: Ref.make<ReadonlyArray<string>>([]) })
);

const Providers = Layer.mergeAll(
  Layer.effect(
    Mailbox,
    Effect.map(Inbox, (inbox) =>
      MailboxShape.make({
        listMessagesSince: () =>
          Effect.map(Ref.get(inbox.message), (message) => MailPage.make({ envelopes: [message] })),
        getEnvelope: () => Effect.asSome(Ref.get(inbox.message)),
        setCategories: (request) =>
          Ref.update(inbox.message, (message) => MailEnvelope.make({ ...message, categories: request.categories })),
        ensureMasterCategories: (intents) => Effect.succeed(intents.length),
        listAttachments: () => Effect.succeed([noticeAttachment]),
        downloadAttachment: () => Effect.succeed(Uint8Array.of(1, 2, 3)),
      })
    )
  ),
  Layer.effect(
    DocumentStore,
    Effect.map(Inbox, (inbox) =>
      DocumentStoreShape.make({
        upload: (request) =>
          Effect.as(
            Ref.update(inbox.uploads, A.append(`${request.folderId}/${request.fileName}`)),
            DocumentFileId.make("file-1")
          ),
      })
    )
  ),
  Layer.succeed(
    MatterDirectory,
    MatterDirectoryShape.make({
      snapshot: Effect.succeed(
        MatterIndex.make({
          builtAt: since,
          entries: [
            MatterIndexEntry.make({
              matterKey: acme,
              clientKey: MatterClientKey.make("acme"),
              applicationNumbers: [UsptoNormalizedApplicationNumber.make("16123456")],
            }),
          ],
        })
      ),
    })
  ),
  Layer.succeed(KnownDocuments, KnownDocumentsShape.make({ has: () => Effect.succeed(false) })),
  Layer.succeed(
    MatterFolderDirectory,
    MatterFolderDirectoryShape.make({
      folderFor: (request) => Effect.succeedSome(DocumentFolderId.make(`folder-${request.destination}`)),
    })
  )
);

const TemporaryLocation = Layer.effect(
  MailTaggingStateLocation,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const stateDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "mail-tagging-live-" });
    return MailTaggingStateConfig.make({ stateDirectory });
  })
);

const live = () =>
  Layer.fresh(
    MailTaggingUseCasesLive.pipe(
      Layer.provideMerge(Layer.mergeAll(Providers, MailTaggingStateFile)),
      Layer.provideMerge(Layer.mergeAll(InboxLive, TemporaryLocation, BunCrypto.layer)),
      Layer.provideMerge(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))
    )
  );

const lines = Effect.fn("MailTaggingLayersTest.lines")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const location = yield* MailTaggingStateLocation;
  const target = path.join(location.stateDirectory, name);
  const exists = yield* fs.exists(target);
  return exists ? A.filter(Str.split(yield* fs.readFileString(target), "\n"), Str.isNonEmpty) : [];
});

const run = Effect.fn("MailTaggingLayersTest.run")(function* (mode: "dry-run" | "apply", id: string) {
  const job = yield* MailTaggingJob;
  return yield* job.run(RunMailTaggingRequest.make({ mode, since, runId: TaggingRunId.make(id) }));
});

describe("MailTagging live layers over file-backed state", () => {
  it.layer(live(), { timeout: "30 seconds" })("dry run then apply", (it) => {
    it.effect(
      "writes no state file on a dry run, then tags, files, and records on apply, and undoes from the ledger file",
      Effect.fnUntraced(function* () {
        const inbox = yield* Inbox;
        const preview = yield* run("dry-run", "run-0001");

        expect([preview.matched, preview.attachmentsFiled, preview.wrote]).toStrictEqual([1, 1, false]);
        expect(yield* lines("tag-ledger.jsonl")).toStrictEqual([]);
        expect(yield* lines("filing-ledger.jsonl")).toStrictEqual([]);
        expect(yield* lines("checkpoint.json")).toStrictEqual([]);

        const applied = yield* run("apply", "run-0002");
        const message = yield* Ref.get(inbox.message);

        expect([applied.matched, applied.attachmentsFiled, applied.wrote]).toStrictEqual([1, 1, true]);
        expect(message.categories).toStrictEqual(["Personal", "M: acme.10001", "P: USPTO"]);
        expect(yield* Ref.get(inbox.uploads)).toStrictEqual(["folder-uspto-incoming/2026-07-01 office-action.pdf"]);
        expect(yield* lines("tag-ledger.jsonl")).toHaveLength(1);
        expect(yield* lines("filing-ledger.jsonl")).toHaveLength(1);
        expect(yield* lines("checkpoint.json")).toHaveLength(1);

        const again = yield* run("apply", "run-0003");

        expect([again.alreadyTagged, again.attachmentsFiled]).toStrictEqual([1, 0]);
        expect(yield* lines("tag-ledger.jsonl")).toHaveLength(1);

        const undo = yield* MailTaggingUndo;
        const undone = yield* undo.run(
          UndoMailTaggingRequest.make({
            originalRunId: TaggingRunId.make("run-0002"),
            runId: TaggingRunId.make("undo-0001"),
            mode: "apply",
          })
        );
        const ledger = yield* TagLedger;

        expect([undone.entries, undone.categoriesRemoved]).toStrictEqual([1, 2]);
        expect((yield* Ref.get(inbox.message)).categories).toStrictEqual(["Personal"]);
        expect(A.map(yield* ledger.records, (record) => record._tag)).toStrictEqual(["TagApplied", "TagUndone"]);
      })
    );
  });
});
